"""Check evidence coverage, offsets, overlap, IDs and rejected inputs."""
import unittest

from chunk import chunk_documents


class ChunkTests(unittest.TestCase):
    def test_coverage_and_linkage(self):
        text = "First paragraph.\n\nSecond paragraph has AX-409. " * 4
        for strategy in ("character", "recursive"):
            with self.subTest(strategy=strategy):
                result = chunk_documents([{"id": "a", "text": text}], strategy, 55, 12)
                covered = set()
                for row in result["chunks"].values():
                    self.assertEqual(text[row["start"]:row["end"]], row["text"])
                    self.assertEqual(row["doc_id"], "a")
                    self.assertLessEqual(len(row["text"]), 55)
                    covered.update(range(row["start"], row["end"]))
                self.assertEqual(covered, set(range(len(text))))

    def test_exact_character_overlap_and_stability(self):
        docs = [{"id": "a", "text": "0123456789abcdefghij"}]
        result = chunk_documents(docs, "character", 10, 3)
        rows = list(result["chunks"].values())
        self.assertEqual(rows[0]["text"][-3:], rows[1]["text"][:3])
        self.assertEqual(rows[0]["end"] - rows[1]["start"], 3)
        self.assertEqual(result, chunk_documents(docs, "character", 10, 3))
        changed = chunk_documents(docs, "character", 10, 0)
        self.assertTrue(set(result["chunks"]).isdisjoint(changed["chunks"]))

    def test_recursive_target_overlap_can_be_zero(self):
        docs = [{"id": "a", "text": "alpha\n\nbeta\n\ngamma"}]
        rows = list(chunk_documents(docs, size=9, overlap=2)["chunks"].values())
        self.assertEqual(rows[0]["end"], rows[1]["start"])

    def test_identical_documents_keep_separate_ids(self):
        result = chunk_documents([{"id": "a", "text": "same"}, {"id": "b", "text": "same"}])
        self.assertEqual(len(result["chunks"]), 2)
        self.assertEqual({r["doc_id"] for r in result["chunks"].values()}, {"a", "b"})

    def test_rejected_inputs(self):
        docs = [{"id": "a", "text": "hello"}]
        for size, overlap in [(0, 0), (10, -1), (10, 10), (2.5, 0), (True, 0)]:
            with self.subTest(size=size, overlap=overlap), self.assertRaises(ValueError):
                chunk_documents(docs, size=size, overlap=overlap)
        for invalid in [[], {}, [None], [{"id": "a", "text": " "}], docs + docs]:
            with self.subTest(invalid=invalid), self.assertRaises(ValueError):
                chunk_documents(invalid)
        with self.assertRaises(ValueError):
            chunk_documents(docs, strategy="unknown")


if __name__ == "__main__":
    unittest.main()
