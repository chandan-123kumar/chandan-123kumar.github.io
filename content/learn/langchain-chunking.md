# Chunking with LangChain — Keep the evidence together

## The problem — Can we keep a cause beside its remedy?

**A learner asks: “What should I do about AX-409?” We need a passage containing both the error’s meaning and the action to take. Which chunk boundaries preserve that evidence?**

In Day 1, you passed evidence into a model by hand. Day 2’s retriever will select passages automatically. This 75-minute workshop expands Day 2’s chunking step using LangChain, before embedding or searching anything. Use it before continuing to Day 2’s embedding exercise.

**Concepts covered:** chunks, LangChain `Document`, separators, character limits, recursive splitting, target overlap, source offsets and stable chunk IDs.

Start with this **synthetic teaching document**, shared with the Day 2 lab:

> Upload error AX-409 means that the workspace storage quota is full. Remove unused files or increase the storage allowance before retrying the upload. A network timeout requires checking the connection before another attempt.

Underline the cause and remedy. Predict whether a 65-character chunk can contain both. Then predict what a 160-character chunk might include. Do this before running the code.

## System design and setup

```text
TODAY: PREPARE PASSAGES FOR THE EXISTING DAY 2 RETRIEVER

documents.json (same synthetic Atlas sources as Day 2)
       |
       v
chunk.py: text + source metadata -> LangChain Documents
       |
       +--> CharacterTextSplitter: fixed character windows
       |
       +--> RecursiveCharacterTextSplitter: ordered boundaries
       |
       v
chunks.json: stable ID -> text + document ID + [start:end]
            source hashes + splitter version/configuration
       |
       v
Human inspection: cause/remedy together? coverage? duplicates?
---------------------- boundary studied today ----------------
       |
       v
LATER IN DAY 2: embedding.py -> index.json -> retrieve.py
               vectors / BM25 / rank fusion -> evidence review
LATER SESSION: Day 1 model adapter -> grounded answer generation
```

[Download the LangChain chunking lab (.zip)](/api/learn/chunking/lab). Extract it and open the `langchain-chunking` folder. It contains `chunk.py`, `documents.json`, `requirements.txt`, `test_chunk.py` and a README. Python 3.10+ and internet access for installation are required; splitting then runs locally without a model or API token.

```sh
cd langchain-chunking
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python -m pip freeze > environment.txt
```

Windows PowerShell activation: `.venv\Scripts\Activate.ps1`. Keep `environment.txt` with your results. The lab pins the text splitter to a teaching version and records the installed splitter and core versions in its output.

| Exercise | Time | Deliverable |
|---|---:|---|
| Mark evidence and install | 15 min | Underlined cause and remedy |
| Compare boundaries | 20 min | Two chunk files and one inspected boundary |
| Experiment with overlap and size | 20 min | Four-row observation table |
| Inspect storage, verify and reflect | 20 min | Checked source slice and design choice |

## Experiment 1 — A hard character boundary

A **chunk** is one passage that can later be retrieved. A character limit controls passage length; it does not know where an explanation ends. Run:

```sh
python chunk.py --strategy character --size 65 --overlap 0 --output character-65.json
```

The lab configures `CharacterTextSplitter(separator="")`. An empty separator makes fixed character windows. The class’s usual paragraph separator behaves differently: an individual paragraph can exceed the requested size if no matching boundary is available.

Inspect the `atlas-sync` rows. Output includes a stable chunk ID, document ID, `[start:end]`, character count, actual overlap and the text. Offsets are zero-based Python string positions; the end is exclusive. They are not UTF-8 byte offsets.

**Observe:** which chunk contains `AX-409`? Does it also tell you to remove unused files or increase the allowance? Save one boundary that separates useful evidence. The program prints real splitter output; no embedding or retrieval result is being simulated.

## Experiment 2 — Let separators guide the split

LangChain’s **recursive splitter** tries a list of separators in order. Here it tries paragraph breaks, line breaks, spaces, then individual characters. “Recursive” means it applies finer boundaries when a larger piece still exceeds the limit.

```sh
python chunk.py --strategy recursive --size 65 --overlap 0 --output recursive-65.json
```

The runnable file uses this configuration:

```python
from langchain_text_splitters import RecursiveCharacterTextSplitter

splitter = RecursiveCharacterTextSplitter(
    chunk_size=65,
    chunk_overlap=0,
    separators=["\n\n", "\n", " ", ""],
    length_function=len,
    keep_separator=True,
    strip_whitespace=False,
    add_start_index=True,
    is_separator_regex=False,
)
```

`length_function=len` measures **characters**, not tokens. `keep_separator=True` and `strip_whitespace=False` retain the original text for source checking; `repr` in terminal output makes whitespace visible. The final empty separator permits splitting a long unbroken string.

A LangChain **Document** pairs `page_content` with a metadata dictionary. The lab calls `create_documents([text], metadatas=[metadata])`, so each returned Document carries its source identity and `start_index`. `split_text(text)` returns strings; `split_documents(documents)` accepts existing Documents.

**Compare:** does the recursive run avoid cutting a word at the same boundary? Does it preserve a full cause and remedy? A word boundary helps readability, but the default separators do not recognize sentences or guarantee complete evidence.

**Deliver:** record one difference between `character-65.json` and `recursive-65.json` using the printed text and offsets.

## Experiment 3 — Change one variable at a time

**Overlap** repeats some text between neighbouring chunks. It can preserve context near a boundary, while increasing storage, embedding work and duplicate retrieval hits. LangChain’s recursive overlap is a target: separators and merge decisions can produce less overlap, including zero.

Predict which change will keep the AX-409 cause and remedy together, then run:

```sh
python chunk.py --strategy recursive --size 65 --overlap 20 --output recursive-65-20.json
python chunk.py --strategy recursive --size 160 --overlap 0 --output recursive-160.json
```

Fill this table from your own runs. A chunk “contains evidence” only if its text supports the question, not merely because it mentions the identifier.

| Run | Total chunks | Actual overlap for two adjacent upload chunks | Cause and remedy together in one chunk? |
|---|---:|---:|---|
| character / 65 / 0 | Record | Record | Inspect |
| recursive / 65 / 0 | Record | Record | Inspect |
| recursive / 65 / 20 | Record | Record | Inspect |
| recursive / 160 / 0 | Record | Record | Inspect |

Terminal `overlap=` is computed from neighbouring source spans. Compare it with the requested overlap. Do not assume every recursive pair repeats exactly 20 characters. The first chunk in each document has no predecessor.

**Deliver:** choose a configuration and cite the exact source span supporting your decision. A larger size or overlap is a hypothesis to evaluate, not a universal improvement. If the two sentences still cross a boundary in a new document, consider section-aware grouping or retrieving neighbouring chunks.

## Store inspectable chunks and verify them

Save the chosen configuration to the filename the existing embedding lab expects:

```sh
python chunk.py --strategy recursive --size 160 --overlap 0 --output chunks.json
python -m unittest -v test_chunk
python -c 'import json; x=json.load(open("chunks.json")); print(json.dumps(x["chunking"], indent=2)); print(next(iter(x["chunks"].values())))'
```

`chunks.json` stores `chunks[chunk_id]` with text, `doc_id`, title, source and start/end offsets. A source content hash and splitter configuration make indexing reproducible. IDs depend on source identity, source content, configuration and boundaries; changing those requires rebuilding the downstream index. Identical text from different documents keeps separate IDs.

For one chunk, verify `original_text[start:end] == chunk_text` by opening `documents.json`. The tests check coverage, exact source slices, character limits, fixed-window overlap, recursive overlap below its target, repeatable IDs, distinct source IDs and rejected invalid parameters. Expect a unittest report ending in `OK` when all checks pass.

To continue with Day 2, [download its complete lab](/api/learn/day2/lab), extract it beside this lab, and copy the chosen chunks into that folder. These commands assume both extracted folders share a parent:

```sh
cp chunks.json ../day-02/chunks.json
cd ../day-02
python embedding.py --backend tfidf --output index.json
python retrieve.py "What should I do about AX-409?" --mode bm25
```

This bridge uses Day 2’s standard-library lexical baseline. For neural embeddings, follow Day 2’s installation and model setup. The chunk schema is shared; chunking, embedding and retrieval stay in separate runnable files.

## Acceptance checks and self-check

Before embedding, accept your chunk set only when every source character is covered, source slices match, IDs repeat for identical inputs and no chunk exceeds your configured character size. Whitespace is intentionally retained in this lab.

Prepare these three queries for the later retrieval comparison:

| Query | Inspect now; predict later |
|---|---|
| “How do I regain access if I forgot my credentials?” | Mark the password-reset evidence. Predict how keyword and vector retrieval may differ. |
| “What should I do about AX-409?” | Check that the cause and remedy survive chunking. Predict the value of the exact identifier for BM25. |
| “What is Atlas’s refund period?” | Confirm no supporting sentence exists. Predict whether a vector search could still return neighbours. |

Reference answers and relevance labels belong in your worksheet, outside `documents.json` and model inputs. A returned neighbour, high score or citation does not establish answerability. Later, compare retrieval on identical queries using known evidence and Recall@k/MRR. When boundaries change, relabel relevant chunks or compare at a consistent document level.

**Self-check:** Is `chunk_size=160` a 160-token guarantee? Why might requested overlap differ from actual overlap? Why do source offsets matter when two chunks contain the same words?

**Solve the opening problem:** in the verified local run with `langchain-text-splitters==1.0.0`, recursive size 160 and overlap 0 produced six chunks. The `atlas-sync` span `[0:159]` contains both the AX-409 cause and the full remedy. Compare your output and explain how the size budget and chosen boundaries made this possible. That passage also starts the unrelated network sentence: preserving this evidence does not make every boundary ideal. We now have passages ready for indexing; retrieval quality remains to be measured.

The verified BM25 handoff ranked a project-limits passage ahead of that upload passage for “What should I do about AX-409?”. Inspect the actual ranked text when you continue Day 2. Keeping evidence in a chunk and ranking that chunk first are separate problems.

**Reflection:** “In run ___, boundary ___ separated ___. Changing ___ produced ___. I would keep ___ because ___.” Use one actual printed chunk as evidence.

<details>
<summary>Reference: choosing other chunking families</summary>

These are useful families, not an exhaustive catalogue. Choose according to document structure and evaluate the result.

| Family | When and why | Retrieval tradeoff |
|---|---|---|
| Fixed character windows | Simple baseline or tightly bounded text | Predictable limits; can cut words and evidence |
| Recursive separators | Prose with paragraph/line structure | Readable boundaries; no semantic-completeness guarantee |
| Sentence grouping | Explanations organized as sentences | Preserves sentences; abbreviations and long sentences need care |
| Token-aware recursive splitting | Budget against a known tokenizer | Better budget control; tokenizer must match the encoder and special-token allowance |
| Markdown/HTML headers | Manuals with meaningful headings | Preserves hierarchy; carry section metadata and subdivide oversized sections |
| Code-aware splitting | Source files with classes/functions | Better structural cues; syntax and large functions need inspection |
| Semantic splitting | Topic transitions poorly match formatting | Extra model cost; boundaries depend on embeddings and thresholds |
| Parent/child passages | Retrieve precise spans, return broader context | Additional linkage and deduplication; inspect the expanded context budget |

Character limits cannot guarantee an embedding model’s token limit. Count with that model’s tokenizer and reject or rechunk oversized inputs; do not silently truncate evidence. Tokenizer changes can change boundaries. Embedding model choice and normalization later change similarity geometry; hold the chunk set fixed when testing those variables.

For real documents, continue with Day 2’s Hugging Face TechQA extension: it records a source revision and keeps evaluation labels separate. Preserve dataset attribution and applicable license notices. Inspect headings, tables and extraction quality before reusing the warm-up settings.

</details>

<details>
<summary>Reference: official LangChain documentation</summary>

See the [recursive splitter guide](https://docs.langchain.com/oss/python/integrations/splitters/recursive_text_splitter), [TextSplitter API](https://reference.langchain.com/python/langchain-text-splitters/base/TextSplitter) and [splitter catalogue](https://reference.langchain.com/python/langchain-text-splitters). The lab uses `langchain_text_splitters`, supplied by the separate `langchain-text-splitters` package.

</details>
