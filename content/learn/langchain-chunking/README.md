# Chunking with LangChain

A focused companion to Day 2. Use the same synthetic Atlas corpus to compare fixed character windows, recursive separators and target overlap. No model or API token is needed.

Use Python 3.10+. From this extracted folder:

```sh
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python -m pip freeze > environment.txt
python chunk.py --strategy character --size 65 --overlap 0 --output character-65.json
python chunk.py --strategy recursive --size 65 --overlap 0 --output recursive-65.json
python chunk.py --strategy recursive --size 65 --overlap 20 --output recursive-65-20.json
python chunk.py --strategy recursive --size 160 --overlap 0 --output chunks.json
python -m unittest -v test_chunk
```

PowerShell activation: `.venv\Scripts\Activate.ps1`.

In a repository checkout rather than the ZIP, first copy the corpus with `cp ../day-02/documents.json documents.json`. The archive builder includes that shared file automatically.

For each run, record chunk count, actual overlap and whether one upload chunk contains both the AX-409 cause and remedy. Compare source slices using zero-based, end-exclusive Python character offsets. The program prints original text with whitespace escaped, actual overlap and stable chunk IDs. Recursive overlap is a target and may be smaller than requested. CharacterTextSplitter uses an empty separator for fixed windows; its normal paragraph splitting has different size behaviour.

The output is compatible with Day 2's `embedding.py --input chunks.json`. Extract the Day 2 lab beside this folder, then continue with the standard-library baseline:

```sh
cp chunks.json ../day-02/chunks.json
cd ../day-02
python embedding.py --backend tfidf --output index.json
python retrieve.py "What should I do about AX-409?" --mode bm25
```

Configuration, installed package versions and source content hashes are saved. IDs include source/configuration/boundaries, so rebuild embeddings when those change. Character limits are not token limits. No retrieval or answer-quality improvement is claimed by the splitting exercise.

Full lesson: `/learn/#chunking`. Official guide: https://docs.langchain.com/oss/python/integrations/splitters/recursive_text_splitter
