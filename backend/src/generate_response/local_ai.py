"""Deterministic, no-Bedrock answer generation.

The deployed demo runs on the AWS Free plan, which does not include Amazon
Bedrock. This module keeps the chat useful by answering from the retrieved
lecture passages. The curated cell-biology lecture gets polished answers; any
other PDF gets a grounded extractive answer with page citations.
"""

import json
import re
from pathlib import Path

from retrieval_core import tokenize


SAMPLE_MARKER = "cell biology lecture: cells, membranes, and energy"
MAX_ANSWER_CHARS = 900
_SENTENCE_RE = re.compile(r"(?<=[.!?])\s+|\n+")

_DATA_PATH = Path(__file__).with_name("sample_cell_biology_answers.json")
with _DATA_PATH.open("r", encoding="utf-8") as _handle:
    _SAMPLE_DATA = json.load(_handle)


def is_sample_text(text):
    return SAMPLE_MARKER in (text or "").lower()


def is_sample_index(index):
    return any(is_sample_text(chunk.get("text", "")) for chunk in index.get("chunks", []))


def sample_answer(prompt):
    lower = (prompt or "").lower()
    for entry in _SAMPLE_DATA["answers"]:
        if any(keyword in lower for keyword in entry["keywords"]):
            return entry["answer"]
    return _SAMPLE_DATA["fallback"]


def split_sentences(text):
    sentences = []
    for piece in _SENTENCE_RE.split(text or ""):
        cleaned = " ".join(piece.split())
        if len(cleaned) >= 20:
            sentences.append(cleaned)
    return sentences


def extractive_answer(prompt, chunks, max_chars=MAX_ANSWER_CHARS):
    """Select the passages that best overlap the question and cite their pages."""
    query_terms = set(tokenize(prompt))
    candidates = []

    for chunk in chunks:
        page = chunk.get("page", "?")
        for position, sentence in enumerate(split_sentences(chunk.get("text", ""))):
            sentence_terms = set(tokenize(sentence))
            overlap = len(query_terms & sentence_terms)
            # Prefer passages with real overlap, then earlier sentences.
            score = overlap * 10 - position * 0.1
            candidates.append((score, page, sentence))

    candidates.sort(key=lambda item: item[0], reverse=True)
    selected = []
    seen = set()
    for score, page, sentence in candidates:
        key = sentence.lower()
        if key in seen:
            continue
        if score <= 0 and selected:
            break
        seen.add(key)
        selected.append((page, sentence))
        if len(selected) >= 3:
            break

    if not selected:
        return (
            "This document does not contain enough matching text to answer that "
            "question. Try rephrasing it with a term from the lecture."
        )

    parts = []
    used = 0
    for page, sentence in selected:
        if not sentence.endswith((".", "!", "?")):
            sentence += "."
        part = f"{sentence} (page {page})"
        if used + len(part) > max_chars:
            break
        parts.append(part)
        used += len(part) + 1

    return "From the lecture: " + " ".join(parts)


def answer_for(prompt, chunks, sample=False):
    if sample:
        return sample_answer(prompt)
    return extractive_answer(prompt, chunks)
