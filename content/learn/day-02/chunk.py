"""Inspect three chunking strategies. Offsets refer to the original document text."""
import argparse
import hashlib
import json
import re
from pathlib import Path


def chunk_documents(documents, strategy="sentence", size=2, overlap=0):
    if strategy not in {"fixed", "sentence", "overlap"}:
        raise ValueError("Unknown chunking strategy")
    if size < 1 or overlap < 0 or overlap >= size:
        raise ValueError("Require size > 0 and 0 <= overlap < size")
    if strategy != "overlap" and overlap:
        raise ValueError("Only the overlap strategy accepts a nonzero overlap")
    if not isinstance(documents, list) or not documents:
        raise ValueError("Expected a non-empty list of documents")
    chunks, seen = {}, set()
    for doc in documents:
        if not isinstance(doc, dict):
            raise ValueError("Each document must be a JSON object with id and text")
        if not isinstance(doc.get("id"), str) or not doc["id"] or doc["id"] in seen:
            raise ValueError("Document IDs must be non-empty and unique")
        seen.add(doc["id"])
        text = doc.get("text")
        if not isinstance(text, str) or not text.strip():
            raise ValueError("Each document needs non-empty text")
        if strategy == "sentence":
            # Small English teaching splitter: decimals/error codes stay intact.
            # Abbreviations, tables and multilingual text need a stronger parser.
            boundaries = list(re.finditer(r"(?<=[.!?])\s+(?=[A-Z])|\n+", text))
            spans, start = [], 0
            for boundary in boundaries:
                if text[start:boundary.start()].strip():
                    spans.append((start, boundary.start()))
                start = boundary.end()
            if text[start:].strip():
                spans.append((start, len(text)))
        else:
            spans = [(m.start(), m.end()) for m in re.finditer(r"\S+", text)]
        step = size - overlap if strategy == "overlap" else size
        for i in range(0, len(spans), step):
            window = spans[i:i + size]
            start, end = window[0][0], window[-1][1]
            while start < end and text[start].isspace():
                start += 1
            while end > start and text[end - 1].isspace():
                end -= 1
            identity = json.dumps([doc["id"], text, strategy, size, overlap, start, end])
            key = hashlib.sha256(identity.encode()).hexdigest()[:20]
            chunks[key] = {
                "text": text[start:end], "doc_id": doc["id"],
                "title": doc.get("title", doc["id"]),
                "source": doc.get("source", "local"),
                "start": start, "end": end,
            }
            if i + size >= len(spans):
                break
    return {"schema_version": 1,
            "chunking": {"strategy": strategy, "size": size, "overlap": overlap,
                         "unit": "sentences" if strategy == "sentence" else "words"},
            "chunks": chunks}


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--input", default="documents.json")
    p.add_argument("--output", default="chunks.json")
    p.add_argument("--strategy", choices=["fixed", "sentence", "overlap"], default="sentence")
    p.add_argument("--size", type=int, default=2)
    p.add_argument("--overlap", type=int, default=0)
    a = p.parse_args()
    try:
        result = chunk_documents(json.loads(Path(a.input).read_text()), a.strategy, a.size, a.overlap)
        Path(a.output).write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    except (ValueError, KeyError, TypeError, OSError) as exc:
        p.error(str(exc))
    for key, row in result["chunks"].items():
        print(f"{key} | {row['doc_id']} [{row['start']}:{row['end']}] | {row['text']}")


if __name__ == "__main__":
    main()
