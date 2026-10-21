import sys
import unittest
from pathlib import Path


sys.path.insert(
    0,
    str(Path(__file__).resolve().parents[1] / "src" / "generate_study_pack"),
)

from local_study_pack import build_local_study_pack, is_sample_text  # noqa: E402
from study_pack_core import validate_study_pack  # noqa: E402


SAMPLE_TEXT = """
Cell Biology Lecture: Cells, Membranes, and Energy
Cell theory says that all living organisms are made of cells.
The plasma membrane is a selectively permeable barrier around the cell.
"""


class LocalStudyPackTests(unittest.TestCase):
    def test_sample_text_is_detected(self):
        self.assertTrue(is_sample_text(SAMPLE_TEXT))
        self.assertFalse(is_sample_text("A history lecture about the Mughal Empire."))

    def test_sample_pack_has_expected_schema(self):
        pack = build_local_study_pack(SAMPLE_TEXT, "cell-biology-lecture.pdf")
        self.assertGreaterEqual(len(pack["keyConcepts"]), 5)
        self.assertGreaterEqual(len(pack["flashcards"]), 8)
        self.assertEqual(len(pack["quiz"]), 5)
        self.assertEqual(pack["title"], "Cell Biology: Cells, Membranes, and Energy")

    def test_heuristic_pack_is_valid_for_a_new_lecture(self):
        source = """
        Photosynthesis is the process by which plants convert light energy into
        chemical energy. Chlorophyll is the green pigment that absorbs light in
        the chloroplast. The chloroplast is the organelle where photosynthesis
        takes place. The thylakoid membrane is the site of the light-dependent
        reactions. The Calvin cycle is the stage that fixes carbon dioxide into
        sugar. Glucose is the sugar produced by photosynthesis.
        Oxygen is the gas released when water is split during the light reactions.
        Carbon dioxide enters the leaf through small pores called stomata.
        """
        pack = build_local_study_pack(source, "photosynthesis-lecture.pdf")
        validated = validate_study_pack(pack)
        self.assertEqual(validated["title"], "Photosynthesis Lecture")
        self.assertGreaterEqual(len(validated["keyConcepts"]), 5)
        self.assertGreaterEqual(len(validated["flashcards"]), 8)
        self.assertEqual(len(validated["quiz"]), 5)
        for question in validated["quiz"]:
            self.assertEqual(len(question["options"]), 4)
            self.assertIn(question["answerIndex"], range(4))

    def test_short_text_raises_a_clear_error(self):
        with self.assertRaises(ValueError):
            build_local_study_pack("Too short.", "short.pdf")


if __name__ == "__main__":
    unittest.main()
