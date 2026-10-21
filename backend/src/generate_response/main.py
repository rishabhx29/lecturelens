import json
import os

import boto3
from aws_lambda_powertools import Logger
from botocore.config import Config

from local_ai import answer_for, is_sample_index
from retrieval_core import (
    build_system_prompt,
    format_context,
    history_to_messages,
    local_embedding,
    search,
)


MEMORY_TABLE = os.environ["MEMORY_TABLE"]
BUCKET = os.environ["BUCKET"]
MODEL_ID = os.environ["MODEL_ID"]
EMBEDDING_MODEL_ID = os.environ["EMBEDDING_MODEL_ID"]
BEDROCK_REGION = os.environ.get("BEDROCK_REGION", "us-east-1")
AI_MODE = os.environ.get("AI_MODE", "bedrock").lower()
TOP_K = int(os.environ.get("TOP_K", "6"))
MAX_HISTORY_ENTRIES = int(os.environ.get("MAX_HISTORY_ENTRIES", "40"))
MAX_CONTEXT_CHARS = int(os.environ.get("MAX_CONTEXT_CHARS", "12000"))

_query_embedding_mode = "bedrock"

s3 = boto3.client("s3")
ddb = boto3.resource("dynamodb")
memory_table = ddb.Table(MEMORY_TABLE)
bedrock_runtime = boto3.client(
    "bedrock-runtime",
    region_name=BEDROCK_REGION,
    config=Config(retries={"max_attempts": 8, "mode": "standard"}),
)
logger = Logger()


def load_index(user, file_name):
    response = s3.get_object(Bucket=BUCKET, Key=f"{user}/{file_name}/index.json")
    return json.loads(response["Body"].read())


def embed_query(text):
    if _query_embedding_mode == "local":
        return local_embedding(text)
    response = bedrock_runtime.invoke_model(
        modelId=EMBEDDING_MODEL_ID,
        body=json.dumps({"inputText": text[:8000]}),
        accept="application/json",
        contentType="application/json",
    )
    payload = json.loads(response["body"].read())
    return payload["embedding"]


def get_history(user_id, conversation_id):
    response = memory_table.get_item(
        Key={"userid": user_id, "SessionId": conversation_id}
    )
    item = response.get("Item")
    if not item:
        return []
    return item.get("History", [])


def append_history(user_id, conversation_id, prompt, answer):
    history = get_history(user_id, conversation_id)
    history.append(
        {
            "type": "human",
            "data": {
                "content": prompt,
                "additional_kwargs": {},
                "example": False,
            },
        }
    )
    history.append(
        {
            "type": "ai",
            "data": {
                "content": answer,
                "additional_kwargs": {},
                "example": False,
            },
        }
    )
    if len(history) > MAX_HISTORY_ENTRIES:
        history = history[-MAX_HISTORY_ENTRIES:]
    memory_table.put_item(
        Item={
            "userid": user_id,
            "SessionId": conversation_id,
            "History": history,
        }
    )


def converse(system_prompt, messages):
    response = bedrock_runtime.converse(
        modelId=MODEL_ID,
        system=[{"text": system_prompt}],
        messages=messages,
        inferenceConfig={"maxTokens": 1024, "temperature": 0.0},
    )
    content = response["output"]["message"]["content"]
    text_parts = [part["text"] for part in content if "text" in part]
    if not text_parts:
        raise ValueError("The model returned an empty response.")
    return "\n".join(text_parts).strip()


def generate_answer(system_prompt, messages, human_input, chunks, index):
    if AI_MODE == "local":
        return answer_for(
            human_input,
            chunks,
            sample=is_sample_index(index),
        )

    if AI_MODE == "auto":
        try:
            return converse(system_prompt, messages)
        except Exception:
            logger.exception("Bedrock chat unavailable; using local answer")
            return answer_for(
                human_input,
                chunks,
                sample=is_sample_index(index),
            )

    return converse(system_prompt, messages)


def error_response(status_code, message):
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "*",
        },
        "body": json.dumps({"message": message}),
    }


@logger.inject_lambda_context(log_event=True)
def lambda_handler(event, context):
    global _query_embedding_mode

    event_body = json.loads(event["body"])
    file_name = event_body["fileName"]
    human_input = event_body["prompt"].strip()
    conversation_id = event["pathParameters"]["conversationid"]
    user = event["requestContext"]["authorizer"]["claims"]["sub"]

    if not human_input:
        return error_response(400, "Please enter a question.")

    try:
        index = load_index(user, file_name)
    except s3.exceptions.NoSuchKey:
        return error_response(
            409,
            "This document is still being processed. Wait for the READY status and try again.",
        )

    _query_embedding_mode = index.get("embeddingMode", "bedrock")
    query_embedding = embed_query(human_input)
    chunks = search(index, query_embedding, top_k=TOP_K)
    context = format_context(chunks, max_chars=MAX_CONTEXT_CHARS)
    if not context:
        return error_response(
            422,
            "This document does not contain enough extractable text to answer questions.",
        )

    messages = history_to_messages(
        get_history(user, conversation_id),
        limit=MAX_HISTORY_ENTRIES,
    )
    messages.append(
        {
            "role": "user",
            "content": [
                {
                    "text": (
                        "Source excerpts:\n\n"
                        f"{context}\n\n"
                        f"Question: {human_input}"
                    )
                }
            ],
        }
    )

    answer = generate_answer(
        build_system_prompt(file_name),
        messages,
        human_input,
        chunks,
        index,
    )
    append_history(user, conversation_id, human_input, answer)
    logger.info(
        {
            "model": MODEL_ID if AI_MODE != "local" else "local-extractive-v1",
            "embedding_mode": _query_embedding_mode,
            "prompt_chars": len(human_input),
            "context_chars": len(context),
            "answer_chars": len(answer),
        }
    )

    return {
        "statusCode": 200,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "*",
        },
        "body": json.dumps(answer),
    }
