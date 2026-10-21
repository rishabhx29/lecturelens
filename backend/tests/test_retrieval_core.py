import sys
import unittest
from pathlib import Path


sys.path.insert(
    0,
    str(Path(__file__).resolve().parents[1] / "src" / "generate_response"),
)

from retrieval_core import (  # noqa: E402
    build_system_prompt,
    cosine_similarity,
    format_context,
    history_to_messages,
    local_embedding,
    search,
)


class RetrievalCoreTests(unittest.TestCase):
    def test_cosine_similarity(self):
        self.assertAlmostEqual(cosine_similarity([1, 0], [1, 0]), 1.0)
        self.assertAlmostEqual(cosine_similarity([1, 0], [0, 1]), 0.0)
        self.assertEqual(cosine_similarity([1, 0], [1, 0, 0]), 0.0)
        self.assertEqual(cosine_similarity([], [1]), 0.0)

    def test_local_embedding_matches_the_indexer_contract(self):
        query = local_embedding("plasma membrane transport")
        related = local_embedding("the plasma membrane controls what enters the cell")
        unrelated = local_embedding("mitosis produces two identical daughter cells")
        self.assertGreater(
            cosine_similarity(query, related),
            cosine_similarity(query, unrelated),
        )
        self.assertAlmostEqual(
            cosine_similarity(query, local_embedding("plasma membrane transport")),
            1.0,
        )

    def test_search_orders_chunks_by_relevance(self):
        index = {
            "chunks": [
                {"page": 1, "text": "irrelevant", "embedding": [0, 1]},
                {"page": 2, "text": "relevant", "embedding": [1, 0]},
                {"page": 3, "text": "also relevant", "embedding": [1, 0]},
                {"page": 4, "text": "missing embedding"},
            ]
        }
        results = search(index, [1, 0], top_k=2)
        self.assertEqual([chunk["page"] for chunk in results], [2, 3])

    def test_format_context_includes_pages_and_truncates(self):
        chunks = [
            {"page": 1, "text": "a" * 50},
            {"page": 2, "text": "b" * 50},
        ]
        context = format_context(chunks, max_chars=130)
        self.assertIn("[Page 1]", context)
        self.assertIn("[Page 2]", context)
        self.assertLessEqual(len(context), 130)

    def test_history_to_messages_maps_roles(self):
        history = [
            {"type": "human", "data": {"content": "question"}},
            {"type": "ai", "data": {"content": "answer"}},
            {"type": "human", "data": {}},
        ]
        messages = history_to_messages(history)
        self.assertEqual([message["role"] for message in messages], ["user", "assistant"])
        self.assertEqual(messages[0]["content"][0]["text"], "question")

    def test_history_to_messages_respects_limit(self):
        history = [
            {"type": "human", "data": {"content": f"message {index}"}}
            for index in range(10)
        ]
        messages = history_to_messages(history, limit=3)
        self.assertEqual(len(messages), 3)
        self.assertEqual(messages[-1]["content"][0]["text"], "message 9")

    def test_system_prompt_names_document(self):
        prompt = build_system_prompt("lecture.pdf")
        self.assertIn("LectureLens", prompt)
        self.assertIn("lecture.pdf", prompt)
        self.assertIn("source excerpts", prompt)


if __name__ == "__main__":
    unittest.main()
