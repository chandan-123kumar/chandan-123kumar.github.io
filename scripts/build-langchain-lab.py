"""Build the focused LangChain lab using the same Atlas corpus as Day 2."""
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

root = Path(__file__).resolve().parents[1]
source = root / "content/learn/langchain-chunking"
files = {name: source / name for name in ["chunk.py", "requirements.txt", "README.md", "test_chunk.py"]}
files["documents.json"] = root / "content/learn/day-02/documents.json"
with ZipFile(root / "content/learn/langchain-chunking-lab.zip", "w", compression=ZIP_DEFLATED) as archive:
    for name, path in files.items():
        entry = ZipInfo("langchain-chunking/" + name, date_time=(2026, 1, 1, 0, 0, 0))
        entry.compress_type = ZIP_DEFLATED
        entry.external_attr = 0o644 << 16
        archive.writestr(entry, path.read_bytes())
print("Built content/learn/langchain-chunking-lab.zip")
