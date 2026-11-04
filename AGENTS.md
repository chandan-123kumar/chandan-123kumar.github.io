# Preparing learning material

These instructions apply to course content and supporting labs in this repository. Follow the user's latest directions when they change the scope or sequence.

## Teaching style

- Begin each day with a concrete problem statement. End by solving that same problem and explaining which concepts made the solution possible.
- Connect the opening to the previous day's working code and learning. Grow one understandable system rather than introducing unrelated demos.
- Keep the main lesson clear, crisp and easy to scan. Remove repeated definitions, takeaways and summaries. Put optional depth in expandable reference sections.
- Introduce concepts through a visible need: predict an outcome, run a small experiment, inspect the result, explain it, then improve the implementation.
- Start with a few sentences or records learners can inspect manually. Move to real documents and larger datasets after the mechanism is clear.
- Highlight the concepts covered near the beginning. Explain each concept in plain language where the learner first uses it.
- Include a system-design diagram showing components, data flow, storage and the boundary being studied. Distinguish the system built today from later extensions.
- Give each exercise exact commands, observable outputs and a small deliverable. End with acceptance checks, a short self-check and a reflection tied to an actual run.
- Fit the hands-on work into the session. Split broad scopes across days instead of rushing a catalogue of techniques.

## Retrieval and RAG sequence

Use this order unless the user requests otherwise:

1. Pose a retrieval problem and manually identify supporting sentences.
2. Chunk documents. Implement a few strategies first, then provide a broader reference table explaining when to choose each strategy, why and its retrieval tradeoffs.
3. Embed one chunk. Print every returned vector coordinate, its dimensions and the model/configuration. Explain that individual coordinates generally have no simple human interpretation.
4. Store chunks, metadata and vectors in inspectable flat files with stable chunk IDs.
5. Retrieve by vector similarity and show ranked chunks and scores before generating answers.
6. Introduce BM25; compare keyword-only, vector-only and hybrid search on identical queries. Explain rank fusion rather than adding incomparable scores directly.
7. Measure retrieval against known supporting evidence before introducing generation.
8. Introduce RAG using the earlier model adapter, followed by reranking, grounded citations, abstention and robustness practices in a later session when appropriate.

Keep chunking, embedding and retrieval in separate runnable files, normally `chunk.py`, `embedding.py` and `retrieve.py`. Explain broader chunking and embedding families in comparison tables; do not claim a finite list covers every possible strategy.

A vector-to-chunk flat file is a useful inspection exercise. Serialize vector keys and preserve collisions as lists. Use stable chunk IDs as primary keys in the main index; vectors are unsuitable durable identifiers.

## Examples, evidence and evaluation

- Include a paraphrase query, an exact term/error-code query and an unsupported query. Ask learners to predict differences between retrieval modes.
- Show how chunk size, boundaries, overlap, token limits, embedding choice and normalization affect retrieval. Treat improvements as hypotheses to test, not guarantees.
- Keep source IDs and source locations so learners can trace retrieved evidence back to documents.
- Prefer real public data from Hugging Face when it fits the problem. Cite the dataset, record a revision and retain applicable attribution/license notices.
- Label synthetic warm-up data, scripted results and real model outputs explicitly. Never invent embedding values, measured rankings or successful live runs.
- Keep reference answers and answerability labels out of model inputs and the retrieval corpus.
- Explain that returning a result, a high similarity score or a citation does not establish correctness or answerability. An unanswerable query can still have nearest neighbours.
- Compare retrieval using known relevant chunks/documents and metrics such as Recall@k and MRR, noting when chunk boundaries change the evaluation unit.

## Implementation and verification

- Provide runnable labs and download links when files are part of the lesson; do not present disconnected snippets as a complete implementation.
- Keep examples simple enough to read. Use flat-file storage and exact vector scanning before introducing databases or approximate indexes.
- Validate parameters, embedding dimensions, non-finite values and model/configuration compatibility. Surface token truncation rather than silently discarding evidence.
- Record enough metadata to reproduce indexing and search, including source revisions, chunk configuration and embedding configuration. Keep secrets out of logs and artifacts.
- Verify meaningful cases: chunk coverage/overlap, vector-to-source linkage, retrieval-mode differences, duplicate vector handling and rejected invalid inputs. Run existing portal checks when routes or navigation change.
- Verify lesson Markdown/diagrams survive the portal sanitizer. Update lesson titles, navigation, download routes and course documentation together.
- Report what was tested and any material limits. Do not claim deployment, live inference or a working download until verified.
