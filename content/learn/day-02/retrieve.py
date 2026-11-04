"""Exact vector search, BM25, or hybrid search over an inspectable JSON index."""
import argparse
from collections import Counter
import json
import math
from pathlib import Path
from embedding import embed_query, terms, validate_index


def bm25_scores(query, items, k1=1.5, b=0.75):
    documents = [terms(row["text"]) for row in items]
    n = len(documents)
    avg = sum(map(len, documents)) / n if n else 0
    if not avg:
        return [0.0] * n
    dfs = Counter(t for doc in documents for t in set(doc))
    result = []
    for doc in documents:
        tf, score = Counter(doc), 0.0
        for term in set(terms(query)):
            frequency = tf[term]
            if frequency:
                idf = math.log(1 + (n - dfs[term] + 0.5) / (dfs[term] + 0.5))
                score += idf * frequency * (k1 + 1) / (frequency + k1 * (1 - b + b * len(doc) / avg))
        result.append(score)
    return result


def search(index, query, mode="vector", top_k=3, candidates=10):
    validate_index(index)
    if mode not in {"vector", "bm25", "hybrid"} or not query.strip() or top_k < 1 or candidates < top_k:
        raise ValueError("Require a query, valid mode, top_k > 0 and candidates >= top_k")
    keys, rows = list(index["items"]), list(index["items"].values())
    lexical = bm25_scores(query, rows) if mode != "vector" else [None] * len(rows)
    vectors = [None] * len(rows)
    if mode != "bm25":
        q = embed_query(query, index["embedding"])
        if len(q) != index["embedding"]["dimensions"] or any(not math.isfinite(v) for v in q):
            raise ValueError("Query and index embedding configuration mismatch; rebuild the index")
        vectors = [sum(a * b for a, b in zip(q, row["vector"])) for row in rows]
    def ranked(scores, positive_only=False):
        return sorted((i for i, value in enumerate(scores)
                       if value is not None and (not positive_only or value > 0)),
                      key=lambda i: (-scores[i], keys[i]))[:candidates]
    vr = ranked(vectors) if mode != "bm25" and any(q) else []
    br = ranked(lexical, positive_only=True)
    if mode == "hybrid":
        fused = {}
        for ranking in (vr, br):
            for rank, i in enumerate(ranking, 1):
                fused[i] = fused.get(i, 0.0) + 1 / (60 + rank)
        scores = fused
        order = sorted(fused, key=lambda i: (-fused[i], keys[i]))
    else:
        scores = vectors if mode == "vector" else lexical
        order = vr if mode == "vector" else br
    return [{"chunk_id": keys[i], "score": scores[i], "vector_score": vectors[i],
             "bm25_score": lexical[i], **{k: v for k, v in rows[i].items() if k != "vector"}}
            for i in order[:top_k]]


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("query")
    p.add_argument("--index", default="index.json")
    modes = p.add_mutually_exclusive_group()
    modes.add_argument("--mode", choices=["vector", "bm25", "hybrid"], default="vector")
    modes.add_argument("--bm25", action="store_const", const="hybrid", dest="mode",
                       help="Add BM25 to vector search (same as --mode hybrid)")
    p.add_argument("--top-k", type=int, default=3)
    p.add_argument("--candidates", type=int, default=10)
    a = p.parse_args()
    try:
        index = json.loads(Path(a.index).read_text())
        hits = search(index, a.query, a.mode, a.top_k, a.candidates)
        print(json.dumps({"query": a.query, "mode": a.mode,
                          "embedding_backend": index["embedding"]["backend"],
                          "score_kind": "rrf" if a.mode == "hybrid" else ("bm25" if a.mode == "bm25" else "cosine"),
                          "note": "Ranked candidates, not verified answers. Scores are not confidence probabilities.",
                          "hits": hits}, ensure_ascii=False, indent=2, allow_nan=False))
    except (ValueError, KeyError, TypeError, OSError, ImportError) as exc:
        p.error(str(exc))


if __name__ == "__main__":
    main()
