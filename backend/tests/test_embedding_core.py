import math
import sys
import unittest
from pathlib import Path


sys.path.insert(
    0,
    str(Path(__file__).resolve().parents[1] / "src" / "generate_embeddings"),
)

from embedding_core import (  # noqa: E402
    build_index,
    chunk_pages,
    local_embedding,
    normalize_text,
)


class EmbeddingCoreTests(unittest.TestCase):
    def test_normalize_text_collapses_whitespace(self):
        raw = "  Lecture   notes\n\n\n\nPage   1\tcontent  "
        self.assertEqual(normalize_text(raw), "Lecture notes\n\nPage 1 content")

    def test_chunk_pages_keeps_page_numbers_and_overlap(self):
        pages = [{"page": 3, "text": "abcdefghij"}]
        chunks = chunk_pages(pages, chunk_size=4, overlap=1, max_chunks=10)

        self.assertEqual([chunk["text"] for chunk in chunks], ["abcd", "defg", "ghij"])
        self.assertTrue(all(chunk["page"] == 3 for chunk in chunks))
        self.assertEqual([chunk["chunk"] for chunk in chunks], [0, 1, 2])

    def test_chunk_pages_respects_max_chunks(self):
        pages = [{"page": 1, "text": "a" * 100}]
        chunks = chunk_pages(pages, chunk_size=10, overlap=0, max_chunks=3)
        self.assertEqual(len(chunks), 3)

    def test_chunk_pages_skips_empty_pages(self):
        pages = [{"page": 1, "text": ""}, {"page": 2, "text": "hello"}]
        chunks = chunk_pages(pages, chunk_size=10, overlap=0, max_chunks=10)
        self.assertEqual(len(chunks), 1)
        self.assertEqual(chunks[0]["page"], 2)

    def test_build_index_contains_metadata(self):
        index = build_index([{"text": "hello"}], "lecture.pdf", "embed-model")
        self.assertEqual(index["version"], 1)
        self.assertEqual(index["filename"], "lecture.pdf")
        self.assertEqual(index["model"], "embed-model")
        self.assertEqual(index["embeddingMode"], "bedrock")
        self.assertIn("created", index)
        self.assertEqual(len(index["chunks"]), 1)

    def test_local_embedding_is_deterministic_and_normalized(self):
        first = local_embedding("The plasma membrane controls transport.")
        second = local_embedding("The plasma membrane controls transport.")
        self.assertEqual(first, second)
        self.assertEqual(len(first), 384)
        self.assertAlmostEqual(
            math.sqrt(sum(value * value for value in first)), 1.0, places=5
        )

    def test_local_embeddings_are_lexically_related(self):
        plasma = local_embedding("plasma membrane phospholipid bilayer")
        transport = local_embedding("the plasma membrane controls transport")
        mitosis = local_embedding("mitosis produces genetically identical cells")

        def cosine(left, right):
            return sum(a * b for a, b in zip(left, right))

        self.assertGreater(cosine(plasma, transport), cosine(plasma, mitosis))


if __name__ == "__main__":
    unittest.main()
