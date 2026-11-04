# Day 2 — Find the right evidence

Start with nine authored Atlas sentences. Build chunking, embeddings, flat-file storage and retrieval before introducing generated answers. The lesson explains strategy selection and evaluation.

## Setup

Use Python 3.10+ and run commands from this folder.

```sh
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
```

MiniLM downloads from Hugging Face on first use and runs locally on CPU. No inference API token is required. The model's requested revision is resolved to a commit and saved in the index; query encoding uses that same commit. Save the dependency versions used with `python -m pip freeze` for a reproducible cohort environment.

## Run in order

```sh
python chunk.py --strategy fixed --size 12 --output chunks-fixed.json
python chunk.py --strategy sentence --size 2 --output chunks.json
python chunk.py --strategy overlap --size 20 --overlap 6 --output chunks-overlap.json
python embedding.py --backend minilm --inspect 0 --output index.json
python vector_key.py
python retrieve.py "How do I regain access if I forgot my credentials?" --mode vector
python retrieve.py "What should I do about AX-409?" --mode bm25
python retrieve.py "What should I do about AX-409?" --mode vector
python retrieve.py "What should I do about AX-409?" --mode hybrid
python retrieve.py "What is Atlas's refund period?" --mode hybrid
```

`--bm25` adds BM25 to vector search and is equivalent to `--mode hybrid`. Use `--top-k 3 --candidates 10` to control the output and each branch's candidate depth. Do not combine `--mode` with `--bm25`.

`embedding.py` prints the entire selected vector; `--inspect` is a zero-based chunk position. MiniLM produces 384-dimensional normalized vectors. The lab rejects texts longer than the encoder limit. Rechunk and rebuild if this happens. Word-count chunk limits do not guarantee token limits.

## Standard-library baseline

Without third-party packages or network access:

```sh
python3 chunk.py --strategy sentence --size 2
python3 embedding.py --backend tfidf --output index.json
python3 vector_key.py
python3 retrieve.py "AX-409" --mode vector
python3 retrieve.py "AX-409" --mode bm25
python3 retrieve.py "AX-409" --bm25
python3 -m unittest -v test_lab
```

TF-IDF is a lexical representation, not a neural semantic model. It uses the stored corpus vocabulary/IDF for queries; unknown-only queries have a zero vector and return no hits. MiniLM may return candidates for unsupported queries. Neither similarity nor RRF scores are answer confidence.

## Inspect the files

- `documents.json`: source documents, explicitly synthetic.
- `chunks.json`: `chunks[chunk_id]` stores text, document ID, provenance and source character offsets.
- `index.json`: `items[chunk_id]` adds the full vector; top-level metadata saves chunking and embedding settings.
- `vector_to_chunks.json`: serialized vectors map to lists of chunks, preserving collisions. This is an inspection export, not the search index.

Chunk IDs depend on the document content, source ID, boundaries and chunking configuration. Rebuild the index whenever these change. The teaching sentence splitter is English-oriented and approximate; use a proper parser for complex documents. Exact vector search scans all chunks, so runtime grows linearly with the corpus.

## Real-data extension

Install `datasets` separately, then provide an actual commit SHA from https://huggingface.co/datasets/nvidia/TechQA-RAG-Eval/tree/main:

```sh
python -m pip install "datasets==4.4.2" "huggingface-hub<2"
python fetch_techqa.py --revision YOUR_40_CHARACTER_COMMIT_SHA --limit 8
python chunk.py --input techqa/documents.json --strategy overlap --size 80 --overlap 16
python embedding.py --backend minilm
```

The export separates source documents from `evaluation-only.json`. Never index reference answers, relevance labels or `is_impossible`. The dataset card lists Apache-2.0: retain applicable upstream license, NOTICE files and attribution when redistributing extracts. Treat IBM material as historical support evidence.

## Evaluation

Label relevant chunks before comparing search modes on the same index. Record Recall@k, reciprocal rank, duplicate hits and evidence completeness. For chunking comparisons, use consistent document-level relevance or relabel each chunk set. Add held-out queries; a nine-sentence development corpus is not evidence of production accuracy. Evaluate unsupported queries separately, since every nearest neighbour need not be relevant.

RAG, reranking, grounded citations and robust answer generation follow in the next session.

## Reading material

See [READING.md](READING.md) for four research comparisons, a suggested reading order and a hypothesis to test in the workshop.
