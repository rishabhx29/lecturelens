"""Deterministic Study Pack generation without Amazon Bedrock.

The sample cell-biology lecture uses a curated pack so the demo is polished.
Any other PDF is summarized with a transparent extractive algorithm: sentence
scoring for the summary, definition patterns for key concepts, and
multiple-choice questions built from those concepts.
"""

import json
import re
from collections import Counter
from pathlib import Path

from study_pack_core import clean_text, validate_study_pack


SAMPLE_MARKER = "cell biology lecture: cells, membranes, and energy"
MAX_SUMMARY_SENTENCES = 6
MAX_CONCEPTS = 8
MAX_FLASHCARDS = 12

_WORD_RE = re.compile(r"[A-Za-z][A-Za-z0-9'-]{2,}")
_SENTENCE_RE = re.compile(r"(?<=[.!?])\s+")
_DEFINITION_RE = re.compile(
    r"^\s*(?P<term>[A-Z][A-Za-z0-9 +&/'-]{2,70}?)\s+"
    r"(?:is|are|refers to|means|is defined as|can be defined as)\s+"
    r"(?P<definition>.{10,500})$",
    re.IGNORECASE,
)
_ARTICLES = ("the ", "a ", "an ")

_STOPWORDS = frozenset(
    """
    a about above after again against all also am an and any are as at be
    because been before being below between both but by can could did do does
    during each few for from further had has have having he her here his how
    i if in into is it its itself just me more most my no nor not now of off
    on once only or other our out over own same she should so some such than
    that the their them then there these they this those through to too under
    until up very was we were what when where which while who why will with
    would you your
    """.split()
)

_DATA_PATH = Path(__file__).with_name("sample_cell_biology_study_pack.json")
with _DATA_PATH.open("r", encoding="utf-8") as _handle:
    _SAMPLE_PACK = json.load(_handle)


def is_sample_text(source_text):
    return SAMPLE_MARKER in clean_text(source_text).lower()


def _sentences(text):
    cleaned = clean_text(text)
    return [
        sentence.strip()
        for sentence in _SENTENCE_RE.split(cleaned)
        if len(sentence.strip()) >= 20
    ]


def _words(text):
    return [
        word.lower()
        for word in _WORD_RE.findall(text)
        if word.lower() not in _STOPWORDS
    ]


def _title_from_filename(filename):
    stem = Path(filename or "lecture.pdf").stem
    title = re.sub(r"[_-]+", " ", stem).strip()
    if not title:
        return "Lecture Study Pack"
    return title.title()


def _clean_term(term):
    value = term.strip().strip(".,:;")
    lower = value.lower()
    for article in _ARTICLES:
        if lower.startswith(article):
            value = value[len(article) :].strip()
            break
    return value[:200].strip()


def _definition_pairs(sentences):
    pairs = []
    seen = set()
    for sentence in sentences:
        match = _DEFINITION_RE.match(sentence)
        if not match:
            continue
        term = _clean_term(match.group("term"))
        definition = match.group("definition").strip().rstrip(".")
        key = term.lower()
        if len(term) < 3 or len(definition) < 10 or key in seen:
            continue
        seen.add(key)
        pairs.append((term, definition))
    return pairs


def _summary(sentences):
    if not sentences:
        return "The document does not contain enough text for a summary."

    frequencies = Counter(_words(" ".join(sentences)))
    if not frequencies:
        return " ".join(sentences[:MAX_SUMMARY_SENTENCES])[:6000]

    scored = []
    for index, sentence in enumerate(sentences):
        words = _words(sentence)
        score = sum(frequencies[word] for word in words) / (len(words) + 1)
        scored.append((score, index, sentence))

    top = sorted(scored, key=lambda item: item[0], reverse=True)
    selected = sorted(top[:MAX_SUMMARY_SENTENCES], key=lambda item: item[1])
    return " ".join(item[2] for item in selected)[:6000]


def _key_concepts(source_text, sentences):
    pairs = _definition_pairs(sentences)
    frequencies = Counter(
        word for word in _words(source_text) if len(word) > 3
    )

    scored = []
    for term, definition in pairs:
        term_frequency = sum(
            frequencies[word.lower()] for word in _WORD_RE.findall(term)
        )
        scored.append((term_frequency + len(definition) / 200.0, term, definition))
    scored.sort(key=lambda item: item[0], reverse=True)

    concepts = []
    seen = set()
    for _, term, definition in scored:
        key = term.lower()
        if key in seen:
            continue
        seen.add(key)
        concepts.append({"term": term, "definition": definition})
        if len(concepts) >= MAX_CONCEPTS:
            break

    if len(concepts) < 5:
        for keyword, _ in frequencies.most_common(20):
            if len(keyword) < 4:
                continue
            for sentence in sentences:
                if keyword in sentence.lower():
                    term = keyword.replace("-", " ").title()
                    key = term.lower()
                    if key not in seen:
                        seen.add(key)
                        concepts.append(
                            {"term": term, "definition": sentence.rstrip(".")}
                        )
                    break
            if len(concepts) >= 6:
                break

    return concepts[:MAX_CONCEPTS]


def _flashcards(concepts, sentences):
    cards = []
    seen = set()

    def add(front, back):
        key = front.lower()
        if key in seen or len(back.strip()) < 10:
            return
        seen.add(key)
        cards.append({"front": front[:600], "back": back[:2000]})

    for concept in concepts:
        add(f"What is {concept['term']}?", concept["definition"])

    for sentence in sentences:
        if len(cards) >= 8:
            break
        words = _words(sentence)
        if not words:
            continue
        keyword = max(set(words), key=words.count)
        add(
            f'What does the lecture say about "{keyword}"?',
            sentence.rstrip("."),
        )

    index = 0
    while len(cards) < 8 and sentences:
        sentence = sentences[index % len(sentences)]
        add(f"Explain this lecture point #{index + 1}", sentence.rstrip("."))
        index += 1
        if index > len(sentences) * 2:
            break

    return cards[:MAX_FLASHCARDS]


def _quiz(concepts, sentences):
    definitions = [
        concept["definition"] for concept in concepts if concept["definition"]
    ]
    extra_sentences = [sentence.rstrip(".") for sentence in sentences]
    questions = []

    for index, concept in enumerate(concepts[:5]):
        correct = concept["definition"]
        distractors = [
            definition
            for definition in definitions
            if definition.lower() != correct.lower()
        ]
        if len(distractors) < 3:
            distractors.extend(
                sentence
                for sentence in extra_sentences
                if sentence.lower() != correct.lower()
            )

        options = [correct]
        for candidate in distractors:
            if candidate.lower() not in {option.lower() for option in options}:
                options.append(candidate)
            if len(options) == 4:
                break

        while len(options) < 4:
            options.append(f"None of the above (option {len(options) + 1})")

        answer_index = index % 4
        options[0], options[answer_index] = options[answer_index], options[0]
        questions.append(
            {
                "question": f"Which statement best describes {concept['term']}?",
                "options": options,
                "answerIndex": answer_index,
                "explanation": (
                    f"{concept['term']}: {concept['definition']} (from the lecture)"
                ),
            }
        )

    return questions


def build_local_study_pack(source_text, filename="lecture.pdf"):
    """Return a validated Study Pack without calling a foundation model."""
    if is_sample_text(source_text):
        return validate_study_pack(json.loads(json.dumps(_SAMPLE_PACK)))

    sentences = _sentences(source_text)
    concepts = _key_concepts(source_text, sentences)
    if len(concepts) < 5:
        raise ValueError(
            "The document needs more explanatory text before a study pack can be built."
        )

    pack = {
        "title": _title_from_filename(filename),
        "summary": _summary(sentences),
        "keyConcepts": concepts,
        "flashcards": _flashcards(concepts, sentences),
        "quiz": _quiz(concepts, sentences),
    }
    return validate_study_pack(pack)
