"""Mocked handler tests for the Study Pack API and worker Lambdas.

These tests load the real ``main.py`` modules with a fake AWS environment so
that request validation, DynamoDB status transitions, and the SQS message
contract are exercised without deploying anything.
"""

import importlib.util
import json
import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

from botocore.exceptions import ClientError


ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
sys.path.insert(0, str(SRC / "generate_study_pack"))

os.environ["DOCUMENT_TABLE"] = "test-documents"
os.environ["STUDY_PACK_QUEUE"] = (
    "https://sqs.us-east-1.amazonaws.com/123456789012/test-queue"
)
os.environ["BUCKET"] = "test-bucket"
os.environ.setdefault("MODEL_ID", "test-study-pack-model")
os.environ.setdefault("AWS_DEFAULT_REGION", "us-east-1")
os.environ.setdefault("AWS_ACCESS_KEY_ID", "testing")
os.environ.setdefault("AWS_SECRET_ACCESS_KEY", "testing")
os.environ.setdefault("AWS_EC2_METADATA_DISABLED", "true")

QUEUE_URL = os.environ["STUDY_PACK_QUEUE"]


def load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


request_pack = load_module(
    "lecturelens_request_study_pack_main",
    SRC / "request_study_pack" / "main.py",
)
get_pack = load_module(
    "lecturelens_get_study_pack_main",
    SRC / "get_study_pack" / "main.py",
)
generate_pack = load_module(
    "lecturelens_generate_study_pack_main",
    SRC / "generate_study_pack" / "main.py",
)


class FakeContext:
    function_name = "test-function"
    memory_limit_in_mb = 128
    invoked_function_arn = "arn:aws:lambda:us-east-1:123456789012:function:test"
    aws_request_id = "test-request-id"


def api_event():
    return {
        "pathParameters": {"documentid": "doc-1"},
        "requestContext": {"authorizer": {"claims": {"sub": "user-1"}}},
    }


def study_pack_fixture():
    return {
        "title": "Cells and Energy",
        "summary": "A short summary.",
        "keyConcepts": [
            {"term": "ATP", "definition": "Cellular energy currency."},
        ],
        "flashcards": [
            {"front": "What is ATP?", "back": "Cellular energy currency."},
        ],
        "quiz": [
            {
                "question": "What is ATP?",
                "options": ["A", "B", "C", "D"],
                "answerIndex": 0,
                "explanation": "ATP stores energy.",
            }
        ],
    }


class GetStudyPackHandlerTests(unittest.TestCase):
    def test_missing_document_returns_404(self):
        with patch.object(get_pack.document_table, "get_item", return_value={}):
            result = get_pack.lambda_handler(api_event(), FakeContext())

        self.assertEqual(result["statusCode"], 404)

    def test_unsaved_status_defaults_to_not_generated(self):
        item = {"userid": "user-1", "documentid": "doc-1"}

        with patch.object(
            get_pack.document_table, "get_item", return_value={"Item": item}
        ):
            result = get_pack.lambda_handler(api_event(), FakeContext())

        payload = json.loads(result["body"])
        self.assertEqual(result["statusCode"], 200)
        self.assertEqual(payload["status"], "NOT_GENERATED")
        self.assertIsNone(payload["studyPack"])

    def test_ready_document_returns_stored_pack(self):
        pack = study_pack_fixture()
        item = {
            "userid": "user-1",
            "documentid": "doc-1",
            "studypackstatus": "READY",
            "studypack": pack,
            "studypackupdated": "2026-01-01T00:00:00.000Z",
        }

        with patch.object(
            get_pack.document_table, "get_item", return_value={"Item": item}
        ):
            result = get_pack.lambda_handler(api_event(), FakeContext())

        payload = json.loads(result["body"])
        self.assertEqual(payload["status"], "READY")
        self.assertEqual(payload["studyPack"], pack)

    def test_failed_document_returns_error_without_pack(self):
        item = {
            "userid": "user-1",
            "documentid": "doc-1",
            "studypackstatus": "FAILED",
            "studypackerror": "Generation failed.",
        }

        with patch.object(
            get_pack.document_table, "get_item", return_value={"Item": item}
        ):
            result = get_pack.lambda_handler(api_event(), FakeContext())

        payload = json.loads(result["body"])
        self.assertEqual(payload["status"], "FAILED")
        self.assertIsNone(payload["studyPack"])
        self.assertEqual(payload["error"], "Generation failed.")


class RequestStudyPackHandlerTests(unittest.TestCase):
    def document(self, **overrides):
        item = {
            "userid": "user-1",
            "documentid": "doc-1",
            "filename": "lecture.pdf",
            "docstatus": "READY",
        }
        item.update(overrides)
        return item

    def test_rejects_document_that_is_not_ready(self):
        item = self.document(docstatus="PROCESSING")

        with patch.object(
            request_pack.document_table, "get_item", return_value={"Item": item}
        ), patch.object(request_pack.sqs, "send_message") as send:
            result = request_pack.lambda_handler(api_event(), FakeContext())

        self.assertEqual(result["statusCode"], 409)
        send.assert_not_called()

    def test_existing_pack_is_returned_without_queueing(self):
        pack = study_pack_fixture()
        item = self.document(studypackstatus="READY", studypack=pack)

        with patch.object(
            request_pack.document_table, "get_item", return_value={"Item": item}
        ), patch.object(
            request_pack.document_table, "update_item"
        ) as update, patch.object(request_pack.sqs, "send_message") as send:
            result = request_pack.lambda_handler(api_event(), FakeContext())

        self.assertEqual(result["statusCode"], 200)
        self.assertEqual(json.loads(result["body"])["studyPack"], pack)
        update.assert_not_called()
        send.assert_not_called()

    def test_queued_status_returns_202_without_queueing_again(self):
        item = self.document(studypackstatus="QUEUED")

        with patch.object(
            request_pack.document_table, "get_item", return_value={"Item": item}
        ), patch.object(
            request_pack.document_table, "update_item"
        ) as update, patch.object(request_pack.sqs, "send_message") as send:
            result = request_pack.lambda_handler(api_event(), FakeContext())

        self.assertEqual(result["statusCode"], 202)
        self.assertEqual(json.loads(result["body"]), {"status": "QUEUED"})
        update.assert_not_called()
        send.assert_not_called()

    def test_not_generated_document_is_queued(self):
        item = self.document(studypackstatus="NOT_GENERATED")

        with patch.object(
            request_pack.document_table, "get_item", return_value={"Item": item}
        ), patch.object(
            request_pack.document_table, "update_item"
        ) as update, patch.object(request_pack.sqs, "send_message") as send:
            result = request_pack.lambda_handler(api_event(), FakeContext())

        self.assertEqual(result["statusCode"], 202)
        self.assertEqual(json.loads(result["body"]), {"status": "QUEUED"})
        update.assert_called_once()
        update_kwargs = update.call_args.kwargs
        self.assertIn("REMOVE studypack", update_kwargs["UpdateExpression"])
        self.assertEqual(
            update_kwargs["ExpressionAttributeValues"][":queued"], "QUEUED"
        )
        send.assert_called_once()
        self.assertEqual(send.call_args.kwargs["QueueUrl"], QUEUE_URL)
        self.assertEqual(
            json.loads(send.call_args.kwargs["MessageBody"]),
            {"user": "user-1", "documentid": "doc-1", "filename": "lecture.pdf"},
        )

    def test_failed_document_can_be_retried(self):
        item = self.document(studypackstatus="FAILED", studypackerror="old error")

        with patch.object(
            request_pack.document_table, "get_item", return_value={"Item": item}
        ), patch.object(
            request_pack.document_table, "update_item"
        ) as update, patch.object(request_pack.sqs, "send_message") as send:
            result = request_pack.lambda_handler(api_event(), FakeContext())

        self.assertEqual(result["statusCode"], 202)
        update.assert_called_once()
        send.assert_called_once()

    def test_concurrent_request_returns_current_status(self):
        not_generated = self.document(studypackstatus="NOT_GENERATED")
        queued = self.document(studypackstatus="QUEUED")
        race_error = ClientError(
            {
                "Error": {
                    "Code": "ConditionalCheckFailedException",
                    "Message": "race",
                }
            },
            "UpdateItem",
        )

        with patch.object(
            request_pack.document_table,
            "get_item",
            side_effect=[{"Item": not_generated}, {"Item": queued}],
        ), patch.object(
            request_pack.document_table, "update_item", side_effect=race_error
        ), patch.object(request_pack.sqs, "send_message") as send:
            result = request_pack.lambda_handler(api_event(), FakeContext())

        self.assertEqual(result["statusCode"], 202)
        self.assertEqual(json.loads(result["body"]), {"status": "QUEUED"})
        send.assert_not_called()

    def test_queue_failure_marks_document_failed(self):
        item = self.document(studypackstatus="NOT_GENERATED")

        with patch.object(
            request_pack.document_table, "get_item", return_value={"Item": item}
        ), patch.object(
            request_pack.document_table, "update_item"
        ) as update, patch.object(
            request_pack.sqs, "send_message", side_effect=RuntimeError("boom")
        ):
            result = request_pack.lambda_handler(api_event(), FakeContext())

        self.assertEqual(result["statusCode"], 500)
        self.assertEqual(update.call_count, 2)
        failure_values = update.call_args_list[-1].kwargs["ExpressionAttributeValues"]
        self.assertEqual(failure_values[":status"], "FAILED")


class GenerateStudyPackHandlerTests(unittest.TestCase):
    def setUp(self):
        self.pack = study_pack_fixture()
        self.event = {
            "Records": [
                {
                    "body": json.dumps(
                        {
                            "user": "user-1",
                            "documentid": "doc-1",
                            "filename": "lecture.pdf",
                        }
                    )
                }
            ]
        }

    def document(self, **overrides):
        item = {
            "userid": "user-1",
            "documentid": "doc-1",
            "filename": "lecture.pdf",
            "docstatus": "READY",
        }
        item.update(overrides)
        return item

    def test_successful_generation_stores_pack(self):
        updates = []

        with patch.object(
            generate_pack.document_table,
            "get_item",
            return_value={"Item": self.document()},
        ), patch.object(
            generate_pack.document_table,
            "update_item",
            side_effect=lambda **kwargs: updates.append(kwargs),
        ), patch.object(
            generate_pack, "_download_pdf", return_value="/tmp/fake.pdf"
        ), patch.object(
            generate_pack,
            "extract_text_from_pdf",
            return_value=["Cells use ATP for energy."],
        ), patch.object(
            generate_pack, "_invoke_model", return_value=self.pack
        ):
            result = generate_pack.lambda_handler(self.event, FakeContext())

        self.assertEqual(result["statusCode"], 200)
        statuses = [
            call["ExpressionAttributeValues"][":status"] for call in updates
        ]
        self.assertEqual(statuses, ["PROCESSING", "READY"])
        self.assertEqual(
            updates[-1]["ExpressionAttributeValues"][":study_pack"], self.pack
        )

    def test_local_mode_uses_curated_pack_without_calling_bedrock(self):
        updates = []

        try:
            with patch.object(generate_pack, "AI_MODE", "local"), patch.object(
                generate_pack.document_table,
                "get_item",
                return_value={"Item": self.document()},
            ), patch.object(
                generate_pack.document_table,
                "update_item",
                side_effect=lambda **kwargs: updates.append(kwargs),
            ), patch.object(
                generate_pack, "_download_pdf", return_value="/tmp/fake.pdf"
            ), patch.object(
                generate_pack,
                "extract_text_from_pdf",
                return_value=[
                    "Cell Biology Lecture: Cells, Membranes, and Energy"
                ],
            ), patch.object(
                generate_pack, "_invoke_model"
            ) as invoke:
                result = generate_pack.lambda_handler(self.event, FakeContext())
        finally:
            generate_pack.AI_MODE = "bedrock"

        self.assertEqual(result["statusCode"], 200)
        invoke.assert_not_called()
        statuses = [
            call["ExpressionAttributeValues"][":status"] for call in updates
        ]
        self.assertEqual(statuses, ["PROCESSING", "READY"])
        stored = updates[-1]["ExpressionAttributeValues"][":study_pack"]
        self.assertEqual(stored["title"], "Cell Biology: Cells, Membranes, and Energy")
        self.assertEqual(len(stored["quiz"]), 5)

    def test_auto_mode_falls_back_when_bedrock_fails(self):
        updates = []

        try:
            with patch.object(generate_pack, "AI_MODE", "auto"), patch.object(
                generate_pack.document_table,
                "get_item",
                return_value={"Item": self.document()},
            ), patch.object(
                generate_pack.document_table,
                "update_item",
                side_effect=lambda **kwargs: updates.append(kwargs),
            ), patch.object(
                generate_pack, "_download_pdf", return_value="/tmp/fake.pdf"
            ), patch.object(
                generate_pack,
                "extract_text_from_pdf",
                return_value=["Cells use ATP for energy."],
            ), patch.object(
                generate_pack,
                "_invoke_model",
                side_effect=RuntimeError("Bedrock unavailable"),
            ), patch.object(
                generate_pack,
                "build_local_study_pack",
                return_value=self.pack,
            ) as local:
                result = generate_pack.lambda_handler(self.event, FakeContext())
        finally:
            generate_pack.AI_MODE = "bedrock"

        self.assertEqual(result["statusCode"], 200)
        local.assert_called_once()
        self.assertEqual(
            updates[-1]["ExpressionAttributeValues"][":status"], "READY"
        )
        self.assertEqual(
            updates[-1]["ExpressionAttributeValues"][":study_pack"], self.pack
        )

    def test_model_failure_records_safe_message(self):
        updates = []

        with patch.object(
            generate_pack.document_table,
            "get_item",
            return_value={"Item": self.document()},
        ), patch.object(
            generate_pack.document_table,
            "update_item",
            side_effect=lambda **kwargs: updates.append(kwargs),
        ), patch.object(
            generate_pack, "_download_pdf", return_value="/tmp/fake.pdf"
        ), patch.object(
            generate_pack,
            "extract_text_from_pdf",
            return_value=["Cells use ATP for energy."],
        ), patch.object(
            generate_pack,
            "_invoke_model",
            side_effect=ValueError("internal vector failure"),
        ):
            generate_pack.lambda_handler(self.event, FakeContext())

        statuses = [
            call["ExpressionAttributeValues"][":status"] for call in updates
        ]
        self.assertEqual(statuses, ["PROCESSING", "FAILED"])
        message = updates[-1]["ExpressionAttributeValues"][":error"]
        self.assertEqual(
            message, "The study pack could not be generated. Please try again."
        )
        self.assertNotIn("internal", message)

    def test_no_extractable_text_reports_specific_message(self):
        updates = []

        with patch.object(
            generate_pack.document_table,
            "get_item",
            return_value={"Item": self.document()},
        ), patch.object(
            generate_pack.document_table,
            "update_item",
            side_effect=lambda **kwargs: updates.append(kwargs),
        ), patch.object(
            generate_pack, "_download_pdf", return_value="/tmp/fake.pdf"
        ), patch.object(
            generate_pack,
            "extract_text_from_pdf",
            return_value=["Cells use ATP for energy."],
        ), patch.object(
            generate_pack,
            "_invoke_model",
            side_effect=ValueError(generate_pack.NO_EXTRACTABLE_TEXT_MESSAGE),
        ):
            generate_pack.lambda_handler(self.event, FakeContext())

        message = updates[-1]["ExpressionAttributeValues"][":error"]
        self.assertEqual(
            message,
            "This PDF does not contain enough extractable text to build "
            "a study pack.",
        )

    def test_missing_document_is_skipped(self):
        with patch.object(
            generate_pack.document_table, "get_item", return_value={}
        ), patch.object(
            generate_pack.document_table, "update_item"
        ) as update:
            result = generate_pack.lambda_handler(self.event, FakeContext())

        self.assertEqual(result["statusCode"], 200)
        update.assert_not_called()

    def test_ready_document_is_skipped(self):
        item = self.document(studypackstatus="READY")

        with patch.object(
            generate_pack.document_table, "get_item", return_value={"Item": item}
        ), patch.object(
            generate_pack.document_table, "update_item"
        ) as update:
            result = generate_pack.lambda_handler(self.event, FakeContext())

        self.assertEqual(result["statusCode"], 200)
        update.assert_not_called()


if __name__ == "__main__":
    unittest.main()
