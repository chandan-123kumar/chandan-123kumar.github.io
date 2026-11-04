"""Build inspectable embeddings. MiniLM is neural; TF-IDF is a lexical baseline."""
import argparse
from collections import Counter
import json
import math
import re
from pathlib import Path

MODEL = "sentence-transformers/all-MiniLM-L6-v2"


def terms(text):
    # Keep identifiers such as AX-409 as a token; lower-case consistently.
    return re.findall(r"\w+(?:[-.]\w+)*", text.lower())


def normalize(values):
    norm = math.sqrt(sum(v * v for v in values))
    return [v / norm for v in values] if norm else [0.0 for v in values]


def lexical_vector(text, config):
    counts = Counter(terms(text))
    return normalize([counts[t] * config["idf"][i]
                      for i, t in enumerate(config["vocabulary"])])


def load_neural(config):
    from sentence_transformers import SentenceTransformer
    return SentenceTransformer(config["model"], revision=config["revision"], device="cpu")


def neural_vectors(texts, model):
    # SentenceTransformer normally truncates silently. Fail before encoding.
    for text in texts:
        count = len(model.tokenizer.encode(text, add_special_tokens=True, truncation=False))
        if count > model.max_seq_length:
            raise ValueError(f"Text uses {count} tokens; encoder limit is {model.max_seq_length}. Rechunk first.")
    return model.encode(texts, normalize_embeddings=True, show_progress_bar=False).tolist()


def embed_query(text, config):
    if config["backend"] == "tfidf":
        return lexical_vector(text, config)
    if config["backend"] == "minilm":
        return neural_vectors([text], load_neural(config))[0]
    raise ValueError("Unsupported embedding backend")


def build_index(chunk_file, backend="minilm", revision="main"):
    if backend not in {"tfidf", "minilm"}:
        raise ValueError("Unsupported embedding backend")
    chunks = chunk_file["chunks"]
    if not chunks:
        raise ValueError("No chunks to embed")
    texts = [row["text"] for row in chunks.values()]
    if backend == "tfidf":
        vocabulary = sorted({term for text in texts for term in terms(text)})
        if not vocabulary:
            raise ValueError("No indexable terms")
        df = Counter(t for text in texts for t in set(terms(text)))
        config = {"backend": "tfidf", "model": "local-tfidf-v1",
                  "revision": "1", "normalized": True,
                  "vocabulary": vocabulary,
                  "idf": [math.log((1 + len(texts)) / (1 + df[t])) + 1 for t in vocabulary]}
        vectors = [lexical_vector(text, config) for text in texts]
    else:
        from huggingface_hub import hf_hub_download, try_to_load_from_cache
        # A cached config path identifies its resolved snapshot, even offline.
        cached = try_to_load_from_cache(MODEL, "config.json", revision=revision)
        config_path = cached if isinstance(cached, str) else hf_hub_download(MODEL, "config.json", revision=revision)
        resolved = Path(config_path).parent.name
        config = {"backend": "minilm", "model": MODEL, "revision": resolved,
                  "normalized": True}
        model = load_neural(config)
        vectors = neural_vectors(texts, model)
        config["max_input_tokens"] = model.max_seq_length
    config["dimensions"] = len(vectors[0])
    return {"schema_version": 1, "embedding": config,
            "chunking": chunk_file["chunking"],
            "items": {key: {**row, "vector": vector}
                      for (key, row), vector in zip(chunks.items(), vectors)}}


def validate_index(index):
    config, items = index["embedding"], index["items"]
    dimensions = config["dimensions"]
    if not items or not isinstance(dimensions, int) or dimensions < 1:
        raise ValueError("Empty index or invalid dimensions")
    if config.get("normalized") is not True:
        raise ValueError("Expected normalized vectors for cosine via dot product")
    if config["backend"] == "tfidf":
        if len(config["vocabulary"]) != dimensions or len(config["idf"]) != dimensions:
            raise ValueError("TF-IDF vocabulary/configuration mismatch")
    elif config["backend"] != "minilm":
        raise ValueError("Unsupported embedding backend")
    for row in items.values():
        vector = row["vector"]
        if len(vector) != dimensions or any(not isinstance(v, (int, float)) or not math.isfinite(v) for v in vector):
            raise ValueError("Invalid vector dimensions or non-finite value")
        norm = math.sqrt(sum(v * v for v in vector))
        if norm and abs(norm - 1) > 1e-4:
            raise ValueError("Stored vector is not normalized")


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--input", default="chunks.json")
    p.add_argument("--output", default="index.json")
    p.add_argument("--backend", choices=["minilm", "tfidf"], default="minilm")
    p.add_argument("--revision", default="main", help="Model revision, resolved to a commit SHA")
    p.add_argument("--inspect", type=int, default=0, help="Zero-based chunk whose ENTIRE vector is printed")
    a = p.parse_args()
    try:
        source = json.loads(Path(a.input).read_text())
        if not 0 <= a.inspect < len(source["chunks"]):
            raise ValueError("Inspect index is outside the available chunks")
        index = build_index(source, a.backend, a.revision)
        validate_index(index)
        Path(a.output).write_text(json.dumps(index, ensure_ascii=False, indent=2, allow_nan=False) + "\n")
        key, row = list(index["items"].items())[a.inspect]
        print(json.dumps({"chunk_id": key, "text": row["text"],
                          "embedding": index["embedding"], "vector": row["vector"]},
                         ensure_ascii=False, indent=2, allow_nan=False))
    except (ValueError, KeyError, TypeError, OSError, ImportError) as exc:
        p.error(str(exc))


if __name__ == "__main__":
    main()
