"""Compare LangChain splitters and export chunks for the Day 2 embedding lab."""
import argparse
import hashlib
import json
from importlib.metadata import version
from pathlib import Path

from langchain_text_splitters import CharacterTextSplitter, RecursiveCharacterTextSplitter


def chunk_documents(documents, strategy="recursive", size=160, overlap=0):
    if strategy not in {"character", "recursive"}:
        raise ValueError("Unknown strategy")
    if type(size) is not int or type(overlap) is not int or size <= 0 or not 0 <= overlap < size:
        raise ValueError("Require integer size > 0 and 0 <= overlap < size")
    if not isinstance(documents, list) or not documents:
        raise ValueError("Expected a non-empty list of documents")
    config = {
        "library": "langchain-text-splitters", "version": version("langchain-text-splitters"),
        "core_version": version("langchain-core"),
        "strategy": strategy, "size": size, "overlap": overlap, "unit": "characters",
        "separators": [""] if strategy == "character" else ["\n\n", "\n", " ", ""],
        "keep_separator": strategy == "recursive", "strip_whitespace": False,
        "add_start_index": True, "is_separator_regex": False,
    }
    options = dict(chunk_size=size, chunk_overlap=overlap, length_function=len,
                   add_start_index=True, strip_whitespace=False, is_separator_regex=False)
    if strategy == "character":
        splitter = CharacterTextSplitter(separator="", **options)
    else:
        splitter = RecursiveCharacterTextSplitter(separators=config["separators"],
                                                  keep_separator=True, **options)
    chunks, sources, seen = {}, {}, set()
    for doc in documents:
        if not isinstance(doc, dict):
            raise ValueError("Each document must be an object")
        doc_id, text = doc.get("id"), doc.get("text")
        if not isinstance(doc_id, str) or not doc_id.strip() or doc_id in seen:
            raise ValueError("Document IDs must be non-empty and unique")
        if not isinstance(text, str) or not text.strip():
            raise ValueError("Each document needs non-empty text")
        seen.add(doc_id)
        digest = hashlib.sha256(text.encode("utf-8")).hexdigest()
        sources[doc_id] = {"sha256": digest, "source": doc.get("source", "local")}
        metadata = {"doc_id": doc_id, "title": doc.get("title", doc_id),
                    "source": doc.get("source", "local")}
        # create_documents carries source metadata onto every returned Document.
        for part in splitter.create_documents([text], metadatas=[metadata]):
            start = part.metadata["start_index"]
            end = start + len(part.page_content)
            if start < 0 or text[start:end] != part.page_content:
                raise ValueError("Splitter returned an invalid source offset")
            identity = json.dumps([doc_id, digest, config, start, end], sort_keys=True)
            key = hashlib.sha256(identity.encode("utf-8")).hexdigest()[:20]
            chunks[key] = {**metadata, "text": part.page_content, "start": start, "end": end}
    return {"schema_version": 1, "chunking": config, "sources": sources, "chunks": chunks}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", default="documents.json")
    parser.add_argument("--output", default="chunks.json")
    parser.add_argument("--strategy", choices=["character", "recursive"], default="recursive")
    parser.add_argument("--size", type=int, default=160)
    parser.add_argument("--overlap", type=int, default=0)
    args = parser.parse_args()
    try:
        result = chunk_documents(json.loads(Path(args.input).read_text(encoding="utf-8")),
                                 args.strategy, args.size, args.overlap)
        Path(args.output).write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n",
                                     encoding="utf-8")
    except (ValueError, TypeError, OSError) as exc:
        parser.error(str(exc))
    previous = {}
    for key, row in result["chunks"].items():
        actual_overlap = max(0, previous.get(row["doc_id"], 0) - row["start"])
        print(f"{key} | {row['doc_id']} [{row['start']}:{row['end']}] "
              f"| chars={len(row['text'])} overlap={actual_overlap} | {row['text']!r}")
        previous[row["doc_id"]] = row["end"]
    print(f"Saved {len(result['chunks'])} chunks to {args.output}")


if __name__ == "__main__":
    main()
