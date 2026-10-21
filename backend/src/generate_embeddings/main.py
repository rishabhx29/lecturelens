import json
import os

import boto3
from aws_lambda_powertools import Logger
from botocore.config import Config
from pypdf import PdfReader

from embedding_core import (
    build_index,
    chunk_pages,
    local_embedding,
    normalize_text,
)


DOCUMENT_TABLE = os.environ["DOCUMENT_TABLE"]
BUCKET = os.environ["BUCKET"]
EMBEDDING_MODEL_ID = os.environ["EMBEDDING_MODEL_ID"]
BEDROCK_REGION = os.environ.get("BEDROCK_REGION", "us-east-1")
AI_MODE = os.environ.get("AI_MODE", "bedrock").lower()
CHUNK_SIZE = int(os.environ.get("CHUNK_SIZE", "1200"))
CHUNK_OVERLAP = int(os.environ.get("CHUNK_OVERLAP", "200"))
MAX_CHUNKS = int(os.environ.get("MAX_CHUNKS", "400"))

_embedding_backend = "bedrock"

s3 = boto3.client("s3")
ddb = boto3.resource("dynamodb")
document_table = ddb.Table(DOCUMENT_TABLE)
bedrock_runtime = boto3.client(
    "bedrock-runtime",
    region_name=BEDROCK_REGION,
    config=Config(retries={"max_attempts": 8, "mode": "standard"}),
)
logger = Logger()


def set_doc_status(user_id, document_id, status):
    document_table.update_item(
        Key={"userid": user_id, "documentid": document_id},
        UpdateExpression="SET docstatus = :docstatus",
        ExpressionAttributeValues={":docstatus": status},
    )


def extract_pages(local_path):
    """Return a page-numbered list of extractable text blocks."""
    reader = PdfReader(local_path)
    pages = []
    for page_number, page in enumerate(reader.pages, start=1):
        text = normalize_text(page.extract_text() or "")
        if text:
            pages.append({"page": page_number, "text": text})
    return pages


def _titan_embedding(text):
    """Create one Titan embedding for a chunk of text."""
    response = bedrock_runtime.invoke_model(
        modelId=EMBEDDING_MODEL_ID,
        body=json.dumps({"inputText": text[:8000]}),
        accept="application/json",
        contentType="application/json",
    )
    payload = json.loads(response["body"].read())
    embedding = payload.get("embedding")
    if not embedding:
        raise ValueError("The embedding model returned an empty embedding.")
    return embedding


def embed_text(text):
    """Embed a chunk with the backend selected for this invocation."""
    if _embedding_backend == "local":
        return local_embedding(text)
    return _titan_embedding(text)


def save_index(index, user_id, file_name_full):
    # Store the whole index as JSON. It is small enough for S3 and avoids
    # native-architecture dependencies such as FAISS.
    s3.put_object(
        Bucket=BUCKET,
        Key=f"{user_id}/{file_name_full}/index.json",
        Body=json.dumps(index, ensure_ascii=False).encode("utf-8"),
        ContentType="application/json",
    )


@logger.inject_lambda_context(log_event=True)
def lambda_handler(event, context):
    global _embedding_backend

    event_body = json.loads(event["Records"][0]["body"])
    document_id = event_body["documentid"]
    user_id = event_body["user"]
    key = event_body["key"]
    file_name_full = key.split("/")[-1]

    set_doc_status(user_id, document_id, "PROCESSING")
    local_path = f"/tmp/{file_name_full}"

    try:
        s3.download_file(BUCKET, key, local_path)
        pages = extract_pages(local_path)
        chunks = chunk_pages(
            pages,
            chunk_size=CHUNK_SIZE,
            overlap=CHUNK_OVERLAP,
            max_chunks=MAX_CHUNKS,
        )
        if not chunks:
            raise ValueError(
                "No extractable text was found. Scanned PDFs need OCR before they can be indexed."
            )

        if AI_MODE == "local":
            _embedding_backend = "local"
        elif AI_MODE == "auto":
            _embedding_backend = "bedrock"
            try:
                # Probe once before paying for a full embedding run. If the
                # account is not allowed to use Bedrock, switch to the local
                # hashing embedding and continue.
                embed_text(chunks[0]["text"])
            except Exception:
                logger.exception(
                    "Bedrock embeddings unavailable; using local embeddings"
                )
                _embedding_backend = "local"
        else:
            _embedding_backend = "bedrock"

        for position, chunk in enumerate(chunks):
            chunk["embedding"] = embed_text(chunk["text"])
            if (position + 1) % 25 == 0:
                logger.info({"embedded_chunks": position + 1, "total_chunks": len(chunks)})

        embedding_mode = _embedding_backend
        model_name = (
            "local-hash-v1" if embedding_mode == "local" else EMBEDDING_MODEL_ID
        )
        index = build_index(
            chunks,
            file_name_full,
            model_name,
            embedding_mode=embedding_mode,
        )
        save_index(index, user_id, file_name_full)
        set_doc_status(user_id, document_id, "READY")
        logger.info(
            {
                "status": "READY",
                "document_id": document_id,
                "pages": len(pages),
                "chunks": len(chunks),
            }
        )
    except Exception:
        logger.exception("Failed to build the document index")
        set_doc_status(user_id, document_id, "FAILED")
        raise
