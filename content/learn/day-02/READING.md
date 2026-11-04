# Day 2 reading material — Chunking and retrieval

Start with readings 1 and 2. Read the abstract, evaluation setup, results and limitations; you do not need to read every page before the workshop.

| Reading | Comparison and finding | What to look for |
|---|---|---|
| **1. [Is Semantic Chunking Worth the Computational Cost?](https://aclanthology.org/2025.findings-naacl.114/)** — Qu, Tu and Bao; NAACL Findings, 2025 | Compares semantic and fixed-size chunking across document retrieval, evidence retrieval and answer generation. Semantic chunking does not deliver consistent gains that justify its added computation. | When does a more expensive strategy actually improve the task? |
| **2. [Evaluating Chunking Strategies for Retrieval](https://www.trychroma.com/research/evaluating-chunking)** — Smith and Troynikov; Chroma technical report, 2024 | Evaluates heuristic, semantic and LLM-based chunking. Well-configured simple methods can perform strongly; token-level precision, recall and intersection-over-union measure evidence coverage and unnecessary text. | How can we compare different chunk boundaries fairly? |
| **3. [A Systematic Analysis of Chunking Strategies for Reliable Question Answering](https://arxiv.org/abs/2601.14123)** — Bennani and Moslonka; preprint, 2026 | Varies method, size, overlap and context length. In its Natural Questions/SPLADE/Mistral setup, sentence chunking is cost-effective and overlap gives no measurable benefit. | Why might overlap fail to help, even though it preserves boundary text? |
| **4. [A Systematic Investigation of Document Chunking Strategies and Embedding Sensitivity](https://arxiv.org/abs/2603.06976)** — Shaukat, Adnan and Kuhn; preprint, 2026 | Compares 36 methods across six domains and five embedding models. Reports strong paragraph-grouping results and domain-dependent benefits; relevance is judged using an LLM evaluator. | How do domain, embedding choice and relevance judging affect the conclusion? |

**Read the findings within their experimental settings.** Different corpora, chunk lengths, retrievers, embedding models and evaluation targets can produce different winners. The two preprints are additional evidence, not universal prescriptions.

**Bring one hypothesis to the lab:** which strategy should retrieve all necessary evidence with the least irrelevant or duplicated text? Keep the embedding model and retrieval settings fixed, record actual chunk lengths, and compare evidence recall, irrelevant text, duplicate hits, index size and processing time. Explain any disagreement between your results and a paper's findings.
