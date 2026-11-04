"""Optional: export TechQA documents and separate evaluation questions from a pinned revision."""
import argparse
import hashlib
import json
from pathlib import Path
import re


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--revision", required=True, help="40-character dataset commit SHA")
    p.add_argument("--limit", type=int, default=8)
    p.add_argument("--output-dir", default="techqa")
    a = p.parse_args()
    if not re.fullmatch(r"[0-9a-fA-F]{40}", a.revision) or a.limit < 1:
        p.error("Supply a real 40-character commit SHA and limit > 0")
    try:
        from datasets import load_dataset
        data = load_dataset("nvidia/TechQA-RAG-Eval", revision=a.revision, split="train")
        docs, questions = {}, []
        for row in data.select(range(min(a.limit, len(data)))):
            sources = []
            for context in row["contexts"]:
                text = context["text"]
                if not text.strip():
                    continue
                identity = context["filename"] + "\n" + text
                key = hashlib.sha256(identity.encode()).hexdigest()[:20]
                docs[key] = {"id": key, "title": context["filename"], "text": text,
                             "source": {"dataset": "nvidia/TechQA-RAG-Eval", "revision": a.revision,
                                        "filename": context["filename"]}}
                sources.append(key)
            questions.append({"id": row["id"], "query": row["question"],
                              "relevant_doc_ids": sorted(set(sources)),
                              "is_impossible": row["is_impossible"],
                              "reference_answer": row["answer"]})
        out = Path(a.output_dir)
        out.mkdir(parents=True, exist_ok=True)
        (out / "documents.json").write_text(json.dumps(list(docs.values()), ensure_ascii=False, indent=2) + "\n")
        (out / "evaluation-only.json").write_text(json.dumps(questions, ensure_ascii=False, indent=2) + "\n")
        (out / "SOURCE.md").write_text(
            "# TechQA source\n\nhttps://huggingface.co/datasets/nvidia/TechQA-RAG-Eval\n\n"
            f"Revision: {a.revision}\n\nDataset card lists Apache-2.0. Retain upstream license/NOTICE "
            "files and applicable attribution when redistributing extracts. These are historical IBM support documents.\n"
            "\nReference answers and answerability labels live only in evaluation-only.json; do not index that file.\n")
        print(f"Exported {len(docs)} unique documents and {len(questions)} evaluation cases to {out}")
    except (ImportError, ValueError, OSError) as exc:
        p.error(str(exc))


if __name__ == "__main__":
    main()
