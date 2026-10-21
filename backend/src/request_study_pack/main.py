import json
import os
from datetime import datetime, timezone
from decimal import Decimal

import boto3
from aws_lambda_powertools import Logger
from botocore.exceptions import ClientError


DOCUMENT_TABLE = os.environ["DOCUMENT_TABLE"]
STUDY_PACK_QUEUE = os.environ["STUDY_PACK_QUEUE"]

ddb = boto3.resource("dynamodb")
document_table = ddb.Table(DOCUMENT_TABLE)
sqs = boto3.client("sqs")
logger = Logger()

CORS_HEADERS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "*",
}


def _utc_now():
    # Millisecond precision keeps the timestamp easy for browser Date parsers.
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


def _json_default(value):
    if isinstance(value, Decimal):
        if value == value.to_integral_value():
            return int(value)
        return float(value)
    return str(value)


def _response(status_code, payload):
    return {
        "statusCode": status_code,
        "headers": CORS_HEADERS,
        "body": json.dumps(payload, default=_json_default),
    }


def _get_document(user_id, document_id):
    response = document_table.get_item(
        Key={"userid": user_id, "documentid": document_id}
    )
    return response.get("Item")


def _study_pack_payload(document):
    status = document.get("studypackstatus") or "NOT_GENERATED"
    return {
        "status": status,
        "studyPack": document.get("studypack") if status == "READY" else None,
        "updated": document.get("studypackupdated"),
        "error": document.get("studypackerror"),
    }


def _mark_failed(user_id, document_id, message):
    document_table.update_item(
        Key={"userid": user_id, "documentid": document_id},
        UpdateExpression=(
            "SET studypackstatus = :status, studypackerror = :error, "
            "studypackupdated = :updated REMOVE studypack"
        ),
        ExpressionAttributeValues={
            ":status": "FAILED",
            ":error": message,
            ":updated": _utc_now(),
            ":queued": "QUEUED",
        },
        ConditionExpression=(
            "attribute_exists(documentid) AND studypackstatus = :queued"
        ),
    )


@logger.inject_lambda_context(log_event=True)
def lambda_handler(event, context):
    user_id = event["requestContext"]["authorizer"]["claims"]["sub"]
    document_id = event["pathParameters"]["documentid"]

    document = _get_document(user_id, document_id)
    if not document:
        return _response(404, {"error": "Document not found."})

    if document.get("docstatus") != "READY":
        return _response(
            409,
            {
                "error": (
                    "This document is not ready yet. Please try again once "
                    "processing is complete."
                )
            },
        )

    status = document.get("studypackstatus")
    if status == "READY":
        return _response(200, _study_pack_payload(document))

    if status in ("QUEUED", "PROCESSING"):
        return _response(202, {"status": status})

    filename = document.get("filename")
    if not filename:
        logger.error(
            "Document is missing a filename",
            extra={"documentid": document_id},
        )
        return _response(
            409,
            {"error": "This document cannot be used to generate a study pack."},
        )

    # Only claim the request if no other request is already queued/running and
    # no study pack exists. This keeps duplicate POSTs from queuing extra jobs.
    try:
        document_table.update_item(
            Key={"userid": user_id, "documentid": document_id},
            UpdateExpression=(
                "SET studypackstatus = :queued, studypackupdated = :updated "
                "REMOVE studypack, studypackerror"
            ),
            ConditionExpression=(
                "attribute_not_exists(studypackstatus) OR "
                "studypackstatus IN (:failed, :not_generated)"
            ),
            ExpressionAttributeValues={
                ":queued": "QUEUED",
                ":updated": _utc_now(),
                ":failed": "FAILED",
                ":not_generated": "NOT_GENERATED",
            },
        )
    except ClientError as exception:
        if (
            exception.response.get("Error", {}).get("Code")
            != "ConditionalCheckFailedException"
        ):
            raise

        # Another request changed the status between our read and write.
        document = _get_document(user_id, document_id)
        if not document:
            return _response(404, {"error": "Document not found."})

        current_status = document.get("studypackstatus")
        if current_status == "READY":
            return _response(200, _study_pack_payload(document))
        if current_status in ("QUEUED", "PROCESSING"):
            return _response(202, {"status": current_status})

        return _response(
            409,
            {"error": "A study pack request is already in progress."},
        )

    message = {
        "user": user_id,
        "documentid": document_id,
        "filename": filename,
    }

    try:
        sqs.send_message(
            QueueUrl=STUDY_PACK_QUEUE,
            MessageBody=json.dumps(message),
        )
    except Exception:
        logger.exception(
            "Failed to queue study pack generation",
            extra={"documentid": document_id},
        )
        try:
            _mark_failed(
                user_id,
                document_id,
                "Study pack generation could not be started. Please try again.",
            )
        except Exception:
            logger.exception(
                "Failed to record study pack queue failure",
                extra={"documentid": document_id},
            )
        return _response(
            500,
            {"error": "Could not start study pack generation. Please try again."},
        )

    return _response(202, {"status": "QUEUED"})
