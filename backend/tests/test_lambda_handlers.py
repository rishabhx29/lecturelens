import importlib.util
import io
import json
import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
sys.path.insert(0, str(SRC / "generate_embeddings"))
sys.path.insert(0, str(SRC / "generate_response"))

os.environ["DOCUMENT_TABLE"] = "test-documents"
os.environ["MEMORY_TABLE"] = "test-memory"
os.environ["BUCKET"] = "test-bucket"
os.environ["EMBEDDING_MODEL_ID"] = "test-embedding-model"
os.environ["MODEL_ID"] = "test-chat-model"
os.environ.setdefault("AWS_DEFAULT_REGION", "us-east-1")
os.environ.setdefault("AWS_ACCESS_KEY_ID", "testing")
os.environ.setdefault("AWS_SECRET_ACCESS_KEY", "testing")
os.environ.setdefault("AWS_EC2_METADATA_DISABLED", "true")


def load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


embeddings = load_module(
    "lecturelens_embeddings_main",
    SRC / "generate_embeddings" / "main.py",
)
responses = load_module(
    "lecturelens_response_main",
    SRC / "generate_response" / "main.py",
)


def build_pdf(text):
    """Build a tiny one-page PDF with a text layer, using only the stdlib."""
    stream = f"BT\n/F1 18 Tf\n72 720 Td\n({text}) Tj\nET\n".encode("latin-1")
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
        b"/Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
        f"<< /Length {len(stream)} >>\nstream\n".encode("ascii")
        + stream
        + b"endstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]

    pdf = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for number, body in enumerate(objects, start=1):
        offsets.append(len(pdf))
        pdf.extend(f"{number} 0 obj\n".encode("ascii"))
        pdf.extend(body)
        pdf.extend(b"\nendobj\n")

    xref_offset = len(pdf)
    pdf.extend(f"xref\n0 {len(objects) + 1}\n".encode("ascii"))
    pdf.extend(b"0000000000 65535 f \n")
    for offset in offsets[1:]:
        pdf.extend(f"{offset:010d} 00000 n \n".encode("ascii"))
    pdf.extend(
        (
            f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\n"
            f"startxref\n{xref_offset}\n%%EOF\n"
        ).encode("ascii")
    )
    return bytes(pdf)


class FakeContext:
    function_name = "test-function"
    memory_limit_in_mb = 128
    invoked_function_arn = "arn:aws:lambda:us-east-1:123456789012:function:test"
    aws_request_id = "test-request-id"


class GenerateEmbeddingsHandlerTests(unittest.TestCase):
    def test_handler_extracts_pdf_chunks_and_saves_index(self):
        pdf_bytes = build_pdf("Hello LectureLens. Cells use ATP for energy.")
        statuses = []
        saved = {}
        downloaded = {}

        def fake_download(bucket, key, filename):
            os.makedirs(os.path.dirname(filename), exist_ok=True)
            with open(filename, "wb") as handle:
                handle.write(pdf_bytes)
            downloaded["filename"] = filename

        def fake_status(user_id, document_id, status):
            statuses.append(status)

        def fake_save(index, user_id, file_name):
            saved["index"] = index
            saved["user"] = user_id
            saved["file"] = file_name

        event = {
            "Records": [
                {
                    "body": json.dumps(
                        {
                            "documentid": "doc-1",
                            "user": "user-1",
                            "key": "user-1/lecture.pdf/lecture.pdf",
                        }
                    )
                }
            ]
        }

        with patch.object(embeddings.s3, "download_file", side_effect=fake_download), patch.object(
            embeddings, "set_doc_status", side_effect=fake_status
        ), patch.object(
            embeddings, "embed_text", side_effect=lambda text: [1.0, 0.0, 0.0]
        ), patch.object(
            embeddings, "save_index", side_effect=fake_save
        ):
            embeddings.lambda_handler(event, FakeContext())

        if "filename" in downloaded and os.path.exists(downloaded["filename"]):
            os.remove(downloaded["filename"])

        self.assertEqual(statuses, ["PROCESSING", "READY"])
        self.assertEqual(saved["user"], "user-1")
        self.assertEqual(saved["file"], "lecture.pdf")
        self.assertEqual(len(saved["index"]["chunks"]), 1)
        self.assertEqual(saved["index"]["chunks"][0]["page"], 1)
        self.assertIn("LectureLens", saved["index"]["chunks"][0]["text"])
        self.assertEqual(saved["index"]["chunks"][0]["embedding"], [1.0, 0.0, 0.0])

    def test_local_mode_builds_a_local_embedding_index(self):
        pdf_bytes = build_pdf("Hello LectureLens. Cells use ATP for energy.")
        saved = {}
        statuses = []

        def fake_download(bucket, key, filename):
            os.makedirs(os.path.dirname(filename), exist_ok=True)
            with open(filename, "wb") as handle:
                handle.write(pdf_bytes)

        def fake_save(index, user_id, file_name):
            saved["index"] = index

        event = {
            "Records": [
                {
                    "body": json.dumps(
                        {
                            "documentid": "doc-local",
                            "user": "user-1",
                            "key": "user-1/local.pdf/local.pdf",
                        }
                    )
                }
            ]
        }

        try:
            with patch.object(embeddings, "AI_MODE", "local"), patch.object(
                embeddings.s3, "download_file", side_effect=fake_download
            ), patch.object(
                embeddings,
                "set_doc_status",
                side_effect=lambda user, doc, status: statuses.append(status),
            ), patch.object(
                embeddings, "save_index", side_effect=fake_save
            ):
                embeddings.lambda_handler(event, FakeContext())
        finally:
            embeddings._embedding_backend = "bedrock"

        self.assertEqual(statuses, ["PROCESSING", "READY"])
        self.assertEqual(saved["index"]["embeddingMode"], "local")
        self.assertEqual(saved["index"]["model"], "local-hash-v1")
        self.assertEqual(len(saved["index"]["chunks"][0]["embedding"]), 384)

    def test_handler_marks_failed_when_no_text_is_extracted(self):
        statuses = []

        def fake_status(user_id, document_id, status):
            statuses.append(status)

        event = {
            "Records": [
                {
                    "body": json.dumps(
                        {
                            "documentid": "doc-2",
                            "user": "user-2",
                            "key": "user-2/blank.pdf/blank.pdf",
                        }
                    )
                }
            ]
        }

        with patch.object(embeddings.s3, "download_file"), patch.object(
            embeddings, "extract_pages", return_value=[]
        ), patch.object(embeddings, "set_doc_status", side_effect=fake_status):
            with self.assertRaises(ValueError):
                embeddings.lambda_handler(event, FakeContext())

        self.assertEqual(statuses, ["PROCESSING", "FAILED"])


class GenerateResponseHandlerTests(unittest.TestCase):
    def setUp(self):
        self.index = {
            "chunks": [
                {
                    "page": 1,
                    "text": "Cells use ATP for energy.",
                    "embedding": [1.0, 0.0],
                },
                {
                    "page": 2,
                    "text": "Mitochondria produce ATP.",
                    "embedding": [0.9, 0.1],
                },
                {
                    "page": 3,
                    "text": "An unrelated paragraph.",
                    "embedding": [0.0, 1.0],
                },
            ]
        }
        self.event = {
            "body": json.dumps(
                {
                    "fileName": "lecture.pdf",
                    "prompt": "How do cells get energy?",
                }
            ),
            "pathParameters": {"conversationid": "conversation-1"},
            "requestContext": {"authorizer": {"claims": {"sub": "user-1"}}},
        }

    def test_load_index_uses_expected_s3_key(self):
        body = io.BytesIO(json.dumps(self.index).encode("utf-8"))
        with patch.object(responses.s3, "get_object", return_value={"Body": body}) as get:
            loaded = responses.load_index("user-1", "lecture.pdf")

        get.assert_called_once_with(
            Bucket="test-bucket",
            Key="user-1/lecture.pdf/index.json",
        )
        self.assertEqual(loaded["chunks"][0]["page"], 1)

    def test_handler_returns_answer_and_stores_history(self):
        captured = {}

        def fake_converse(system_prompt, messages):
            captured["system"] = system_prompt
            captured["messages"] = messages
            return "Cells use ATP (page 1)."

        with patch.object(responses, "load_index", return_value=self.index), patch.object(
            responses, "embed_query", return_value=[1.0, 0.0]
        ), patch.object(responses, "get_history", return_value=[]), patch.object(
            responses, "converse", side_effect=fake_converse
        ), patch.object(responses, "append_history") as append:
            result = responses.lambda_handler(self.event, FakeContext())

        self.assertEqual(result["statusCode"], 200)
        self.assertEqual(json.loads(result["body"]), "Cells use ATP (page 1).")
        self.assertIn("LectureLens", captured["system"])
        self.assertIn("[Page 1]", captured["messages"][-1]["content"][0]["text"])
        self.assertIn("How do cells get energy?", captured["messages"][-1]["content"][0]["text"])
        append.assert_called_once_with(
            "user-1",
            "conversation-1",
            "How do cells get energy?",
            "Cells use ATP (page 1).",
        )

    def test_handler_includes_prior_history(self):
        history = [
            {"type": "human", "data": {"content": "What is ATP?"}},
            {"type": "ai", "data": {"content": "ATP is cellular energy."}},
        ]
        captured = {}

        def fake_converse(system_prompt, messages):
            captured["messages"] = messages
            return "Answer."

        with patch.object(responses, "load_index", return_value=self.index), patch.object(
            responses, "embed_query", return_value=[1.0, 0.0]
        ), patch.object(responses, "get_history", return_value=history), patch.object(
            responses, "converse", side_effect=fake_converse
        ), patch.object(responses, "append_history"):
            responses.lambda_handler(self.event, FakeContext())

        roles = [message["role"] for message in captured["messages"]]
        self.assertEqual(roles, ["user", "assistant", "user"])
        self.assertEqual(
            captured["messages"][0]["content"][0]["text"],
            "What is ATP?",
        )

    def test_local_mode_returns_a_grounded_sample_answer(self):
        index = {
            "embeddingMode": "local",
            "chunks": [
                {
                    "page": 2,
                    "text": (
                        "Cell Biology Lecture: Cells, Membranes, and Energy. "
                        "The plasma membrane controls transport."
                    ),
                    "embedding": [1.0, 0.0],
                }
            ],
        }
        event = json.loads(json.dumps(self.event))
        event["body"] = json.dumps(
            {
                "fileName": "cell-biology-lecture.pdf",
                "prompt": "What does the sodium-potassium pump do?",
            }
        )

        try:
            with patch.object(responses, "AI_MODE", "local"), patch.object(
                responses, "load_index", return_value=index
            ), patch.object(
                responses, "embed_query", return_value=[1.0, 0.0]
            ), patch.object(
                responses, "get_history", return_value=[]
            ), patch.object(
                responses, "append_history"
            ) as append:
                result = responses.lambda_handler(event, FakeContext())
        finally:
            responses.AI_MODE = "bedrock"

        self.assertEqual(result["statusCode"], 200)
        answer = json.loads(result["body"])
        self.assertIn("three Na+", answer)
        self.assertIn("page 2", answer)
        append.assert_called_once()

    def test_empty_prompt_is_rejected(self):
        event = json.loads(json.dumps(self.event))
        event["body"] = json.dumps({"fileName": "lecture.pdf", "prompt": "   "})

        result = responses.lambda_handler(event, FakeContext())

        self.assertEqual(result["statusCode"], 400)
        self.assertIn("Please enter a question", json.loads(result["body"])["message"])


if __name__ == "__main__":
    unittest.main()
