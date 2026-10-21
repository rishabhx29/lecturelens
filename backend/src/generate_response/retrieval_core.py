import hashlib
import math
import re


DEFAULT_TOP_K = 6
DEFAULT_MAX_CONTEXT_CHARS = 12000
DEFAULT_MAX_HISTORY_ENTRIES = 40
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
    """Create the same deterministic embedding used by the indexer."""
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


def cosine_similarity(left, right):
    if not left or not right or len(left) != len(right):
        return 0.0
    dot = sum(a * b for a, b in zip(left, right))
    left_norm = math.sqrt(sum(a * a for a in left))
    right_norm = math.sqrt(sum(b * b for b in right))
    if left_norm == 0 or right_norm == 0:
        return 0.0
    return dot / (left_norm * right_norm)


def search(index, query_embedding, top_k=DEFAULT_TOP_K):
    scored = []
    for chunk in index.get("chunks", []):
        embedding = chunk.get("embedding")
        if not embedding:
            continue
        scored.append((cosine_similarity(query_embedding, embedding), chunk))
    scored.sort(key=lambda item: item[0], reverse=True)
    return [chunk for _, chunk in scored[:top_k]]


def format_context(chunks, max_chars=DEFAULT_MAX_CONTEXT_CHARS):
    sections = []
    used = 0
    for chunk in chunks:
        text = chunk.get("text", "")
        if not text:
            continue
        section = f"[Page {chunk.get('page', '?')}]\n{text}"
        if used + len(section) > max_chars:
            remaining = max_chars - used
            if remaining > 200:
                sections.append(section[:remaining])
            break
        sections.append(section)
        used += len(section)
    return "\n\n---\n\n".join(sections)


def history_to_messages(history, limit=DEFAULT_MAX_HISTORY_ENTRIES):
    messages = []
    for entry in history[-limit:]:
        message_type = entry.get("type")
        content = entry.get("data", {}).get("content", "")
        if not content:
            continue
        role = "assistant" if message_type == "ai" else "user"
        messages.append({"role": role, "content": [{"text": content}]})
    return messages


def build_system_prompt(file_name):
    return (
        "You are LectureLens, a patient study assistant. Answer the user's "
        "question using only the source excerpts provided by the user. If the "
        "answer is not in the excerpts, say that the document does not appear to "
        "contain it. Cite page numbers like (page 4) when helpful. Keep answers "
        "concise, accurate, and educational.\n\n"
        f"Document: {file_name}"
    )
