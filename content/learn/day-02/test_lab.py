"""Run with: python3 -m unittest -v test_lab (no external packages needed)."""
import copy
import unittest
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
from unittest.mock import patch
from chunk import chunk_documents
from embedding import build_index, validate_index, neural_vectors
from retrieve import bm25_scores, search
from vector_key import reverse_index


class RetrievalLabTests(unittest.TestCase):
    def setUp(self):
        self.docs = [
            {"id": "quota", "text": "Error AX-409 means storage is full. Delete unused files before retrying."},
            {"id": "access", "text": "Reset your password from sign-in. Recovery links expire in fifteen minutes."},
        ]
        self.index = build_index(chunk_documents(self.docs, size=2), "tfidf")

    def test_chunk_offsets_and_overlap_preserve_source(self):
        doc = [{"id": "one", "text": "one two three four five six seven"}]
        chunks = list(chunk_documents(doc, "overlap", 4, 2)["chunks"].values())
        self.assertEqual([r["text"] for r in chunks], ["one two three four", "three four five six", "five six seven"])
        covered = set()
        for row in chunks:
            self.assertEqual(doc[0]["text"][row["start"]:row["end"]], row["text"])
            covered.update(range(row["start"], row["end"]))
        self.assertTrue(all(i in covered for i, c in enumerate(doc[0]["text"]) if not c.isspace()))

    def test_sentence_split_keeps_version_number_and_identity(self):
        docs = [{"id": "one", "text": "Version 4.1 fails. Restart the service."}]
        a = chunk_documents(docs, size=1)
        self.assertEqual([r["text"] for r in a["chunks"].values()], ["Version 4.1 fails.", "Restart the service."])
        self.assertEqual(a, chunk_documents(docs, size=1))
        self.assertNotEqual(set(a["chunks"]), set(chunk_documents(docs, size=2)["chunks"]))

    def test_invalid_chunk_configuration_and_duplicate_doc_ids(self):
        for size, overlap in [(0, 0), (2, 2), (2, -1)]:
            with self.assertRaises(ValueError):
                chunk_documents(self.docs, "overlap", size, overlap)
        with self.assertRaises(ValueError):
            chunk_documents([self.docs[0], self.docs[0]])

    def test_retrieval_modes_find_identifier_and_expose_components(self):
        for mode in ["vector", "bm25", "hybrid"]:
            result = search(self.index, "AX-409", mode, 1)
            self.assertEqual(result[0]["doc_id"], "quota")
            self.assertGreater(result[0]["score"], 0)
            if mode == "hybrid":
                self.assertAlmostEqual(result[0]["score"], 2 / 61)
                self.assertGreater(result[0]["bm25_score"], 0)
                self.assertGreater(result[0]["vector_score"], 0)

    def test_bm25_no_matches_and_tfidf_unknown_query(self):
        self.assertEqual(bm25_scores("zzzzz", list(self.index["items"].values())), [0, 0])
        for mode in ["vector", "bm25", "hybrid"]:
            self.assertEqual(search(self.index, "zzzzz", mode), [])

    def test_reverse_index_preserves_identical_vector_collisions(self):
        index = build_index(chunk_documents([
            {"id": "a", "text": "Same text."}, {"id": "b", "text": "Same text."}]), "tfidf")
        reverse = reverse_index(index)
        self.assertEqual(len(reverse["vectors"]), 1)
        self.assertEqual(len(next(iter(reverse["vectors"].values()))), 2)

    def test_invalid_embeddings_fail_before_ranking(self):
        for vector in [[float("nan")], [1.0], [2.0] * self.index["embedding"]["dimensions"]]:
            broken = copy.deepcopy(self.index)
            next(iter(broken["items"].values()))["vector"] = vector
            with self.assertRaises(ValueError):
                validate_index(broken)

    def test_bm25_does_not_need_neural_model(self):
        index = copy.deepcopy(self.index)
        index["embedding"].update(backend="minilm", model="does-not-exist", revision="not-downloaded")
        self.assertEqual(search(index, "AX-409", "bm25", 1)[0]["doc_id"], "quota")


class CommandLineTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.folder = Path(self.temp.name)
        source = Path(__file__).resolve().parent
        for name in ["chunk.py", "embedding.py", "retrieve.py", "vector_key.py", "fetch_techqa.py", "documents.json"]:
            shutil.copyfile(source / name, self.folder / name)

    def run_cli(self, script, *args, success=True):
        result = subprocess.run([sys.executable, script, *args], cwd=self.folder,
                                text=True, capture_output=True, timeout=30)
        if success:
            self.assertEqual(result.returncode, 0, result.stderr)
        else:
            self.assertNotEqual(result.returncode, 0)
            self.assertNotIn("Traceback", result.stderr)
        return result

    def index(self):
        self.run_cli("chunk.py")
        return json.loads(self.run_cli("embedding.py", "--backend", "tfidf").stdout)

    def test_complete_pipeline_preserves_full_vectors_and_sources(self):
        inspected = self.index()
        index = json.loads((self.folder / "index.json").read_text())
        self.assertEqual(len(inspected["vector"]), index["embedding"]["dimensions"])
        self.assertEqual(inspected["vector"], index["items"][inspected["chunk_id"]]["vector"])
        self.run_cli("vector_key.py")
        reverse = json.loads((self.folder / "vector_to_chunks.json").read_text())
        self.assertEqual(sum(map(len, reverse["vectors"].values())), len(index["items"]))
        for flag in [[], ["--mode", "vector"], ["--mode", "bm25"], ["--mode", "hybrid"], ["--bm25"]]:
            result = json.loads(self.run_cli("retrieve.py", "AX-409", *flag).stdout)
            self.assertEqual(result["hits"][0]["doc_id"], "atlas-sync")
            self.assertIn(result["hits"][0]["chunk_id"], index["items"])
            if flag == ["--bm25"]:
                self.assertEqual(result["mode"], "hybrid")

    def test_each_chunking_cli_preserves_nonwhitespace_source_coverage(self):
        documents = json.loads((self.folder / "documents.json").read_text())
        for strategy, options in [("fixed", ["--size", "12"]), ("sentence", ["--size", "2"]),
                                  ("overlap", ["--size", "20", "--overlap", "6"])]:
            self.run_cli("chunk.py", "--strategy", strategy, *options)
            chunks = json.loads((self.folder / "chunks.json").read_text())["chunks"]
            for doc in documents:
                covered = set()
                for row in chunks.values():
                    if row["doc_id"] == doc["id"]:
                        self.assertEqual(row["text"], doc["text"][row["start"]:row["end"]])
                        covered.update(range(row["start"], row["end"]))
                self.assertTrue(all(i in covered for i, c in enumerate(doc["text"]) if not c.isspace()))

    def test_invalid_arguments_fail_cleanly(self):
        self.index()
        cases = [
            ("chunk.py", ["--size", "0"]),
            ("chunk.py", ["--strategy", "overlap", "--size", "2", "--overlap", "2"]),
            ("embedding.py", ["--backend", "tfidf", "--inspect", "-1"]),
            ("retrieve.py", ["   "]),
            ("retrieve.py", ["AX-409", "--top-k", "0"]),
            ("retrieve.py", ["AX-409", "--top-k", "4", "--candidates", "2"]),
            ("retrieve.py", ["AX-409", "--mode", "vector", "--bm25"]),
            ("fetch_techqa.py", ["--revision", "main"]),
            ("fetch_techqa.py", ["--revision", "a" * 40, "--limit", "0"]),
        ]
        for script, args in cases:
            with self.subTest(script=script, args=args):
                self.run_cli(script, *args, success=False)

    def test_malformed_document_rows_fail_cleanly(self):
        for value in [[None], ["not a document"], [1]]:
            (self.folder / "bad.json").write_text(json.dumps(value))
            with self.subTest(value=value):
                self.run_cli("chunk.py", "--input", "bad.json", success=False)

    def test_corrupt_vector_rejected_by_search_and_reverse_export(self):
        self.index()
        index = json.loads((self.folder / "index.json").read_text())
        next(iter(index["items"].values()))["vector"] = [float("inf")]
        (self.folder / "index.json").write_text(json.dumps(index))
        self.run_cli("retrieve.py", "AX-409", success=False)
        self.run_cli("vector_key.py", success=False)


class BoundaryTests(unittest.TestCase):
    def test_oversized_encoder_input_is_rejected_before_encoding(self):
        class FakeTokenizer:
            def encode(self, *args, **kwargs):
                return [1] * 257
        class FakeModel:
            tokenizer = FakeTokenizer()
            max_seq_length = 256
            def encode(self, *args, **kwargs):
                raise AssertionError("Must not encode truncated input")
        with self.assertRaisesRegex(ValueError, "Rechunk first"):
            neural_vectors(["too long"], FakeModel())

    def test_cached_neural_revision_does_not_require_metadata_request(self):
        import types
        fake_hub = types.ModuleType("huggingface_hub")
        fake_hub.try_to_load_from_cache = lambda *args, **kwargs: "/cache/snapshots/pinned-sha/config.json"
        def unexpected_network(*args, **kwargs):
            raise AssertionError("Cached indexing must not request remote metadata")
        fake_hub.hf_hub_download = unexpected_network
        model = types.SimpleNamespace(max_seq_length=256)
        with patch.dict(sys.modules, {"huggingface_hub": fake_hub}), \
             patch("embedding.load_neural", return_value=model), \
             patch("embedding.neural_vectors", return_value=[[1.0, 0.0]]):
            index = build_index(chunk_documents([{"id": "a", "text": "one"}]), "minilm")
        self.assertEqual(index["embedding"]["revision"], "pinned-sha")

    def test_query_dimension_mismatch_rejected(self):
        index = build_index(chunk_documents([{"id": "a", "text": "one two"}]), "tfidf")
        with patch("retrieve.embed_query", return_value=[1.0]):
            with self.assertRaisesRegex(ValueError, "configuration mismatch"):
                search(index, "one")


if __name__ == "__main__":
    unittest.main()
