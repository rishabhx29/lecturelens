import json
import os
from decimal import Decimal

import boto3
from aws_lambda_powertools import Logger


DOCUMENT_TABLE = os.environ["DOCUMENT_TABLE"]

ddb = boto3.resource("dynamodb")
document_table = ddb.Table(DOCUMENT_TABLE)
logger = Logger()

CORS_HEADERS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "*",
}


def _json_default(value):
    """DynamoDB returns numbers as Decimal; serialize them as JSON numbers."""
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


@logger.inject_lambda_context(log_event=True)
def lambda_handler(event, context):
    user_id = event["requestContext"]["authorizer"]["claims"]["sub"]
    document_id = event["pathParameters"]["documentid"]

    response = document_table.get_item(
        Key={"userid": user_id, "documentid": document_id}
    )
    document = response.get("Item")
    if not document:
        return _response(404, {"error": "Document not found."})

    status = document.get("studypackstatus") or "NOT_GENERATED"

    if status == "NOT_GENERATED":
        payload = {
            "status": status,
            "studyPack": None,
            "updated": None,
            "error": None,
        }
    else:
        payload = {
            "status": status,
            "studyPack": (
                document.get("studypack") if status == "READY" else None
            ),
            "updated": document.get("studypackupdated"),
            "error": document.get("studypackerror"),
        }

    return _response(200, payload)
