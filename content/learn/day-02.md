# Day 2 — Find the right evidence

## The problem — Which sentences answer the question?

**A support engineer needs the right passage before they can give a reliable answer. Build a retriever that finds it.**

Start with these nine sentences. They are authored Atlas teaching data, not real company policies:

| Document | Text |
|---|---|
| Account access | A forgotten password can be reset from the account sign-in page. The recovery link expires after fifteen minutes. If the link has expired, request a new recovery email. |
| Upload troubleshooting | Upload error AX-409 means that the workspace storage quota is full. Remove unused files or increase the storage allowance before retrying the upload. A network timeout requires checking the connection before another attempt. |
| Project limits | Atlas Basic allows three active projects per workspace. Archived projects do not count toward the active-project limit. Atlas Pro allows twenty active projects per workspace. |

**Before coding:** underline the evidence you would return for each question:

1. “How do I regain access if I forgot my credentials?” — a paraphrase.
2. “What should I do about AX-409?” — an exact identifier plus a next step.
3. “What is Atlas’s refund period?” — unsupported by these documents.

**Connect to Day 1:** we supplied the evidence by hand. Today we build the part that selects it. Keep generation out of the experiment until we can inspect retrieval.

## Concepts and system design

**Concepts covered:** **chunk boundaries**, **overlap**, **embeddings**, **vector dimensions**, **normalization**, **cosine similarity**, **flat-file indexing**, **BM25**, **hybrid search**, **rank fusion** and **retrieval evaluation**.

```text
INDEX DOCUMENTS ONCE
 documents.json
       |
       v
 chunk.py --strategy sentence / fixed / overlap
       |
       v
 chunks.json             chunk ID -> text + source + offsets
       |
       v
 embedding.py            text -> numerical vector
       |
       v
 index.json              chunk ID -> text + metadata + vector
       |
       +--> vector_key.py --> vector_to_chunks.json
                              serialized vector -> list of chunks
                              (inspection exercise)

SEARCH EACH QUESTION
 question
    |
    +--> same embedding configuration --> vector similarity --+
    |                                                        |
    +--> same lexical tokenizer -------> BM25 ----------------+
                                                             |
                          retrieve.py selects a search mode <-+
                                    |
                         vector / BM25 / hybrid RRF
                                    |
                         ranked chunks + scores + sources
                                    |
                           human evidence review
```

**Deliver today:** a working retriever, inspectable storage and a comparison of search modes. The lab uses exact scanning; a vector database is unnecessary for nine sentences.

| Stage | Time | Output |
|---|---:|---|
| Find supporting sentences manually | 15 min | Expected evidence |
| Compare chunking | 40 min | Three sets of chunks |
| Inspect embeddings and storage | 40 min | Full vector and two flat-file layouts |
| Compare vector, BM25 and hybrid search | 45 min | Ranked results for three questions |
| Evaluate and solve the opening problem | 40 min | Results table and design choices |

## Get the lab

[Download the complete Day 2 lab (.zip)](/api/learn/day2/lab). Extract it and open the `day-02` folder. Everything you need is included:

- `chunk.py` — three chunking strategies.
- `embedding.py` — neural embeddings and a TF-IDF baseline.
- `retrieve.py` — vector, BM25 and hybrid search.
- `vector_key.py` — reverse storage layout.
- `documents.json` — the nine sentences above.
- `requirements.txt` and `README.md` — setup and commands.

The ZIP also includes `fetch_techqa.py` for the real-data extension and `test_lab.py` for checks. Run all commands from the extracted `day-02` folder. Python 3.10+ is recommended. For neural embeddings:

```sh
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
```

No inference API token is needed: the public embedding model downloads from Hugging Face and runs locally. First use needs network access. A standard-library-only alternative is provided below.

## Step 1 — Chunk the documents

A **chunk** is a passage we index and retrieve as one unit. Too small can separate a cause from its remedy; too large can mix relevant evidence with unrelated material.

Run three experiments:

```sh
python chunk.py --strategy fixed --size 12 --output chunks-fixed.json
python chunk.py --strategy sentence --size 2 --output chunks.json
python chunk.py --strategy overlap --size 20 --overlap 6 --output chunks-overlap.json
```

Here `size` means **words** for fixed/overlap and **sentences** for sentence grouping. Word windows are a teaching simplification; production limits should use the embedding model’s tokenizer.

Inspect every chunk’s text, document ID and `[start:end]` character offsets. Check those offsets against the original text.

**Explore the animation below:** choose any strategy, then use Play, Pause or Next step to watch the input become chunks. Query-time chunking and late chunking have separate explainers because they operate differently.

**Discuss:** does the chunk containing `AX-409` also contain its remedy? Does overlap preserve the answer or simply repeat it? The sentence splitter is intentionally simple; abbreviations, tables and other languages need better parsing.

<details>
<summary>Chunking strategies — when to choose each, why and retrieval impact</summary>

These are common families, which can be combined; there is no universal best strategy.

| Strategy | Choose when / why | Retrieval tradeoff |
|---|---|---|
| Whole document | Documents are short and focused | Preserves context; long documents dilute relevance and may exceed encoder limits |
| Fixed characters | Quick baseline with predictable character sizes | Cheap; may split words and evidence; character size is not token size |
| Fixed words | Readable baseline, as in this lab | May split sentences and ignore model token limits |
| Fixed tokens | Need precise control over encoder input size | Respects token budget but can cut across meaning |
| Sliding overlap | Relevant facts cross window boundaries | Improves boundary coverage; increases duplicates, storage and embedding work |
| Sentence groups | Prose has meaningful sentence boundaries | Readable passages; isolated sentences can lose referents |
| Paragraph groups | Paragraphs express coherent ideas | Preserves local context; lengths vary |
| Recursive splitting | Mixed documents need a maximum size | Prefer headings/paragraphs/sentences before hard splits; not inherently semantic |
| Structure-aware | Markdown, HTML, code, tables or manuals | Preserves headings, functions, rows and steps; needs a format-aware parser |
| Semantic boundaries | Topic transitions do not match layout | Uses similarity changes to group text; adds model cost and threshold sensitivity |
| Hierarchical / parent-child | Small passages retrieve well but need larger context | Retrieve children, expand to parents; more bookkeeping and context use |
| Proposition / entity-based | Need fine-grained facts and relations | Precise units; extraction can lose qualifiers or introduce errors |
| Context-enriched | A passage lacks its title, product or section | Add verified metadata/context before embedding; invented context can mislead retrieval |
| Query-time chunking | Need spans assembled for a specific question | Adds per-query selection work; not a static precomputed-chunk lookup |
| Late chunking | Need chunk vectors contextualized by the wider input | Encode token representations before span pooling; requires a suitable encoder and its full-input limit |

**Measure:** evidence coverage, duplicate results, token length and retrieval quality. Rebuild the index after changing chunk boundaries. Overlap and extra title text change both vector representations and BM25 statistics.

</details>

**Deliver:** choose one strategy for the opening questions and justify it with a boundary example.

## Step 2 — Embed one chunk and inspect every number

An **embedding** represents text numerically. A retrieval encoder aims to place relevant queries and passages near each other under its trained similarity function.

```sh
python embedding.py --backend minilm --inspect 0 --output index.json
```

The command prints the selected chunk, resolved model revision, dimension count and **the entire vector**, without an ellipsis. All chunks are saved in `index.json`.

We use [all-MiniLM-L6-v2](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2), a Hugging Face sentence encoder with **384 dimensions**. Its default input limit is **256 word pieces**. The lab checks token length and rejects oversized text instead of silently truncating it.

**Inspect:** count the coordinates; notice positive and negative values. Individual coordinates generally have no simple human-readable meaning. A 384-dimensional vector is one representation of one chunk, not 384 separate embeddings.

Vectors are L2-normalized. Their dot product therefore gives cosine similarity. Similarity is a ranking signal, **not a probability that the passage answers the question**.

<details>
<summary>Embedding techniques — when to choose them and their retrieval impact</summary>

The table groups representation families and training choices; these are not mutually exclusive options.

| Technique | Choose when / why | Retrieval impact and limits |
|---|---|---|
| One-hot / bag of words | Need an interpretable lexical baseline | Exact vocabulary matching; little synonym understanding |
| TF-IDF | Want sparse, corpus-weighted lexical vectors | Downweights common terms; misses unseen paraphrases; vocabulary/IDF must stay consistent |
| Feature hashing | Need bounded-memory lexical features | No stored vocabulary; collisions can merge unrelated terms |
| Static word vectors: Word2Vec, GloVe, fastText | Lightweight word-level features | Pooling can capture related words but loses order; subwords help spelling, not full context |
| Pooled contextual token embeddings | Exploring transformer representations | Pooling and training matter; an arbitrary language model is not automatically a good retriever |
| Sentence bi-encoders | Need one reusable vector per passage | Efficient semantic search; exact codes, negation and domain distinctions can be missed |
| Retrieval-trained / asymmetric encoders | Questions and documents have different roles | Query/document training can improve relevance; follow required prompts or prefixes |
| Learned sparse encoders, e.g. SPLADE | Want learned term weighting/expansion | Can bridge vocabulary gaps with sparse retrieval; requires compatible indexing |
| Multi-vector / late interaction, e.g. ColBERT | Need token-level matching | Richer matching than one pooled vector; greater storage and scoring cost |
| Multilingual encoders | Queries and documents use different languages | Enables cross-language matching; test each language and domain |
| Domain-adapted / fine-tuned encoders | General models miss specialist meaning | Can improve domain retrieval with suitable training data; evaluate on held-out cases |
| Multimodal encoders | Retrieve images or mixed text/visual material | Requires aligned representations; text-only models cannot represent all visual evidence |
| Reduced / quantized / Matryoshka representations | Memory or latency is constrained | Smaller vectors can save resources; quality depends on model support and configuration |

**BM25 is a lexical scoring function**, not a neural embedding technique. A **cross-encoder reranker** scores query–passage pairs; it does not provide reusable passage embeddings in the same way.

For this lab, keep the model, revision, normalization and preprocessing identical for queries and documents. Changing the embedding model requires rebuilding document vectors. More dimensions do not automatically mean better retrieval.

</details>

**No model download available?** Run `python3 embedding.py --backend tfidf --output index.json`. This prints a real TF-IDF vector and exercises storage/search with no packages. It is a lexical baseline, so do not describe its results as neural semantic retrieval. Return to MiniLM for the paraphrase experiment.

## Step 3 — Inspect both flat-file layouts

The main files use stable chunk IDs as keys:

```text
chunks.json:  chunk ID -> {text, doc_id, source, start, end}
index.json:   chunk ID -> {text, doc_id, source, start, end, vector}
              plus embedding and chunking configuration
```

Create the reverse layout:

```sh
python vector_key.py
```

`vector_to_chunks.json` maps a **serialized full vector** to a **list of chunks**. JSON keys must be strings, so the vector is stored as a JSON-array string.

**Why a list?** Identical text can produce identical vectors in different documents. Overwriting one chunk would lose provenance. Float serialization and model changes also make vectors awkward durable IDs. Search uses `index.json`; the reverse file is for inspection, not a nearest-neighbour index.

**Deliver:** locate the same chunk in all three files. Explain which fields let you recover its source passage.

## Step 4 — Retrieve without BM25

```sh
python retrieve.py "How do I regain access if I forgot my credentials?" --mode vector
```

The retriever embeds the question using the index’s saved configuration, computes cosine similarity against each stored vector and returns the top chunks with scores and source offsets.

**Predict first:** will the access passage rank above project limits even though it uses “password” rather than “credentials”? Then inspect the actual output. Keep surprising rankings.

This is **exact search** over every vector. Approximate nearest-neighbour indexes are a later scaling choice.

## Step 5 — Add BM25 and hybrid search

**BM25** ranks passages using matching terms, how rare those terms are, term-frequency saturation and document-length normalization. It is useful for identifiers, product names and exact vocabulary, but does not directly understand paraphrases.

```sh
python retrieve.py "What should I do about AX-409?" --mode bm25
python retrieve.py "What should I do about AX-409?" --mode vector
python retrieve.py "What should I do about AX-409?" --mode hybrid
```

`--bm25` is also an alias for adding BM25 to the default vector search. BM25-only search does not load the embedding model.

**Hybrid retrieval** runs both branches and combines their candidate ranks using **reciprocal rank fusion (RRF)**:

```text
RRF(chunk) = sum of 1 / (60 + rank) for each branch containing it
```

Ranks start at one. A chunk absent from a branch contributes zero there. We combine ranks because BM25 scores and cosine scores use different scales. Candidate depth controls which passages reach fusion. See the [RRF reference](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/reciprocal-rank-fusion).

Hybrid search can help, but it can also promote an irrelevant lexical match. Compare all three modes using the same index, questions, top-k and expected evidence.

<details>
<summary>After predicting — inspect an actual run</summary>

Using the supplied sentence chunks, MiniLM revision `1110a243fdf4706b3f48f1d95db1a4f5529b4d41`, and “What should I do about AX-409?”:

| Mode | First document | Score |
|---|---|---:|
| Vector | `atlas-sync` | 0.4006 cosine |
| BM25 | `atlas-plans` | 1.4214 BM25 |
| Hybrid | `atlas-sync` | 0.0325 RRF |

The simple lexical tokenizer lets “do” match “Archived projects do not count…”. It does not know that this is irrelevant to the error code. Try the shorter query `AX-409` and compare. Then discuss stopword handling, identifier boosts and why removing words indiscriminately can also lose meaning. These are observed development results, not a quality benchmark; different chunking or model configurations can change the rankings.

</details>

## Step 6 — Evaluate and solve the opening problem

Run all three opening questions in each mode. Inspect the full passage, not just the top score.

| Question | Expected supporting document | Vector top 3 | BM25 top 3 | Hybrid top 3 |
|---|---|---|---|---|
| Regain access | `atlas-access` | Record | Record | Record |
| AX-409 and remedy | `atlas-sync` | Record | Record | Record |
| Refund period | None | Review unsupported hits | Review unsupported hits | Review unsupported hits |

Use **Recall@3**: fraction of relevant passages retrieved in the first three results. Use **MRR**: average reciprocal rank of the first relevant result. For this tiny corpus, manually label relevant chunks after chunking. When comparing different chunk boundaries, use consistent document-level labels or relabel passage relevance; deduplicate document IDs for document-level metrics.

Score answerable queries separately from unsupported ones. The supplied examples are development cases; add an unseen paraphrase and an exact-term question before claiming improvement.

**An unsupported question can still have nearest neighbours.** BM25 returns no hits when no terms match; incidental words can still create matches. Dense retrieval can return similar but unhelpful passages. No-hit handling and a calibrated answerability policy need their own evaluation.

**Finish the problem:** show the best evidence for access recovery and AX-409, explain how your chosen chunking preserved it, and mark the refund question unsupported after reading the candidates. You have built the evidence-selection component that Day 1 was missing.

## Scale up — Use real Hugging Face documents

After the nine-sentence example works, use [TechQA-RAG-Eval](https://huggingface.co/datasets/nvidia/TechQA-RAG-Eval). Its historical IBM support documents let you test longer passages, product versions and error codes.

Use the bundled `fetch_techqa.py`, install `datasets` and choose an actual dataset commit SHA from Files and versions:

```sh
python -m pip install "datasets==4.4.2" "huggingface-hub<2"
python fetch_techqa.py --revision YOUR_40_CHARACTER_COMMIT_SHA --limit 8
python chunk.py --input techqa/documents.json --strategy overlap --size 80 --overlap 16
python embedding.py --backend minilm
```

The export keeps reference answers, relevance labels and answerability flags in `evaluation-only.json`. **Do not index that file.** Start with case `TRAIN_Q000` and its supporting document; the initial subset is a teaching corpus, not a representative benchmark. Record source revision and inspect encoder token counts on real text.

## Practice and self-check

**Submit:** your three chunking outputs, index, reverse lookup, query comparisons and one paragraph justifying your design. Rebuild embeddings after every chunking change.

Check these behaviours:

- A chunk’s offsets reproduce its original source text.
- The full embedding vector is visible, and its dimensions/configuration are saved.
- Oversized encoder inputs are rejected; incompatible vector dimensions fail clearly.
- Identical vectors preserve all corresponding chunks in the reverse file.
- All three retrieval modes run; unsupported results are not presented as answers.

**Self-check:** why can overlap help? Why can BM25 beat vector search on an error code? Why does a high cosine score not establish answerability?

**Reflection:** record one query whose ranking surprised you and what you changed after inspecting the evidence.

## Reading material — Chunking research

Start with readings 1 and 2. Read the abstract, evaluation setup, results and limitations; you do not need to read every page before the workshop.

| Reading | Comparison and finding | What to look for |
|---|---|---|
| **1. [Is Semantic Chunking Worth the Computational Cost?](https://aclanthology.org/2025.findings-naacl.114/)** — Qu, Tu and Bao; NAACL Findings, 2025 | Compares semantic and fixed-size chunking across document retrieval, evidence retrieval and answer generation. Semantic chunking does not deliver consistent gains that justify its added computation. | When does a more expensive strategy actually improve the task? |
| **2. [Evaluating Chunking Strategies for Retrieval](https://www.trychroma.com/research/evaluating-chunking)** — Smith and Troynikov; Chroma technical report, 2024 | Evaluates heuristic, semantic and LLM-based chunking. Well-configured simple methods can perform strongly; token-level precision, recall and intersection-over-union measure evidence coverage and unnecessary text. | How can we compare different chunk boundaries fairly? |
| **3. [A Systematic Analysis of Chunking Strategies for Reliable Question Answering](https://arxiv.org/abs/2601.14123)** — Bennani and Moslonka; preprint, 2026 | Varies method, size, overlap and context length. In its Natural Questions/SPLADE/Mistral setup, sentence chunking is cost-effective and overlap gives no measurable benefit. | Why might overlap fail to help, even though it preserves boundary text? |
| **4. [A Systematic Investigation of Document Chunking Strategies and Embedding Sensitivity](https://arxiv.org/abs/2603.06976)** — Shaukat, Adnan and Kuhn; preprint, 2026 | Compares 36 methods across six domains and five embedding models. Reports strong paragraph-grouping results and domain-dependent benefits; relevance is judged using an LLM evaluator. | How do domain, embedding choice and relevance judging affect the conclusion? |

**Read the findings within their experimental settings.** Different corpora, chunk lengths, retrievers, embedding models and evaluation targets can produce different winners. The two preprints are additional evidence, not universal prescriptions.

**Bring one hypothesis to the lab:** which strategy should retrieve all necessary evidence with the least irrelevant or duplicated text? Keep the embedding model and retrieval settings fixed, record actual chunk lengths, and compare evidence recall, irrelevant text, duplicate hits, index size and processing time. Explain any disagreement between your results and a paper's findings.

[Download the reading list](/api/learn/day2/files/READING.md), also included in the complete lab ZIP.

## Next session — Turn retrieval into robust RAG

Only after inspecting retrieval do we introduce **retrieval-augmented generation**:

```text
question → retrieve candidates → rerank → select / deduplicate
         → budget evidence → Day 1 model adapter
         → answer with chunk citations → verify support or abstain
```

We will compare candidate retrieval with **cross-encoder reranking**, which scores the question and passage together. A reranker cannot recover evidence missing from its candidate set. [Cross-encoder reference](https://www.sbert.net/examples/cross_encoder/applications/README.html).

Then build citations that resolve to actual source spans and check each factual claim. Robustness work includes metadata/version filters, document permissions before retrieval, treating retrieved instructions as untrusted text, token budgets, no-evidence behaviour, timeouts, safe traces and separate retrieval/answer evaluation. These extend the retriever built today.

<details>
<summary>References and implementation status</summary>

Model: [MiniLM model card](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2). Data: [TechQA-RAG-Eval and its listed Apache-2.0 license](https://huggingface.co/datasets/nvidia/TechQA-RAG-Eval). Retain applicable upstream attribution and notices when redistributing extracts.

The nine-sentence corpus is authored teaching data. Embeddings and rankings are produced when the scripts run; the lesson does not invent example vectors or promise a particular winner. The lab's BM25 is a readable positive-IDF implementation with `k1=1.5`, `b=0.75`; tokenization is shared and simple. Its exact scan, in-memory term counts and JSON files teach mechanics rather than production-scale indexing. Semantic/structure-aware chunking and advanced embedding families are reference topics, not implemented strategies in this lab.

</details>
