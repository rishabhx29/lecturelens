import sys
import unittest
from pathlib import Path


sys.path.insert(
    0,
    str(Path(__file__).resolve().parents[1] / "src" / "generate_response"),
)

from local_ai import answer_for, extractive_answer, sample_answer  # noqa: E402


class LocalAnswerTests(unittest.TestCase):
    def test_sample_answer_is_curated_and_cited(self):
        answer = sample_answer("What does the sodium-potassium pump do?")
        self.assertIn("three Na+", answer)
        self.assertIn("page 2", answer)

    def test_unknown_sample_question_returns_guidance(self):
        answer = sample_answer("What is the capital of France?")
        self.assertIn("Study Pack", answer)
        self.assertNotIn("Paris", answer)

    def test_extractive_answer_selects_matching_sentence_with_page(self):
        chunks = [
            {"page": 1, "text": "Cells are the basic unit of life."},
            {
                "page": 3,
                "text": "Mitochondria produce ATP through aerobic respiration.",
            },
        ]
        answer = extractive_answer("Where is ATP produced?", chunks)
        self.assertIn("Mitochondria", answer)
        self.assertIn("page 3", answer)

    def test_extractive_answer_handles_no_overlap(self):
        chunks = [{"page": 1, "text": "Cells are the basic unit of life."}]
        answer = extractive_answer("Quantum chromodynamics", chunks)
        self.assertIn("page 1", answer)

    def test_answer_for_uses_sample_path_only_when_requested(self):
        chunks = [{"page": 1, "text": "Cells are the basic unit of life."}]
        normal = answer_for("What is a cell?", chunks)
        sample = answer_for("What is a cell?", chunks, sample=True)
        self.assertTrue(normal.startswith("From the lecture:"))
        self.assertIn("Study Pack", sample)


if __name__ == "__main__":
    unittest.main()
