import hashlib
import math
import re
from datetime import datetime


DEFAULT_CHUNK_SIZE = 1200
DEFAULT_CHUNK_OVERLAP = 200
DEFAULT_MAX_CHUNKS = 400
DEFAULT_EMBEDDING_DIM = 384

_TOKEN_RE = re.compile(r"[a-z0-9]+")
_STOPWORDS = frozenset(
    """
    a about above after again against all am an and any are as at be because
    been before being below between both but by can could did do does doing
    down during each few for from further had has have having he her here hers
    herself him himself his how i if in into is it its itself just me more most
    my myself no nor not now of off on once only or other our ours ourselves out
    over own same she should so some such than that the their theirs them
    themselves then there these they this those through to too under until up
    very was we were what when where which while who whom why will with would
    you your yours yourself yourselves
    """.split()
)


def tokenize(text):
    """Return lower-cased word and bigram tokens for local retrieval."""
    words = [word for word in _TOKEN_RE.findall(text.lower()) if len(word) > 2]
    words = [word for word in words if word not in _STOPWORDS]
    bigrams = [f"{left} {right}" for left, right in zip(words, words[1:])]
    return words + bigrams


def local_embedding(text, dimensions=DEFAULT_EMBEDDING_DIM):
    """Create a deterministic hashed bag-of-words embedding.

    This is intentionally simple and dependency-free. It gives useful lexical
    retrieval for lecture notes and keeps the app usable when Bedrock is not
    available. No network call or API key is involved.
    """
    vector = [0.0] * dimensions
    for token in tokenize(text):
        digest = hashlib.sha256(token.encode("utf-8")).digest()
        index = int.from_bytes(digest[:4], "big") % dimensions
        weight = 0.5 if " " in token else 1.0
        vector[index] += weight

    norm = math.sqrt(sum(value * value for value in vector))
    if norm == 0:
        return vector
    return [round(value / norm, 6) for value in vector]


def normalize_text(text):
    """Collapse the messy whitespace that PDF extraction produces."""
    text = text.replace("\x00", " ")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def chunk_pages(
    pages,
    chunk_size=DEFAULT_CHUNK_SIZE,
    overlap=DEFAULT_CHUNK_OVERLAP,
    max_chunks=DEFAULT_MAX_CHUNKS,
):
    """Split page text into overlapping chunks that keep their page number."""
    chunks = []
    for page in pages:
        text = page["text"]
        start = 0
        length = len(text)
        while start < length and len(chunks) < max_chunks:
            end = min(start + chunk_size, length)
            piece = text[start:end].strip()
            if piece:
                chunks.append(
                    {
                        "chunk": len(chunks),
                        "page": page["page"],
                        "text": piece,
                    }
                )
            if end >= length:
                break
            start = max(end - overlap, start + 1)
    return chunks


def build_index(chunks, file_name_full, model_id, embedding_mode="bedrock"):
    return {
        "version": 1,
        "model": model_id,
        "embeddingMode": embedding_mode,
        "filename": file_name_full,
        "created": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.%fZ"),
        "chunks": chunks,
    }
