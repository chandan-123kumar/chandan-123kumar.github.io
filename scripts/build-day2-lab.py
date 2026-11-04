"""Build a reproducible download containing only the public Day 2 lab files."""
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

root = Path(__file__).resolve().parents[1]
source = root / 'content/learn/day-02'
files = ['chunk.py', 'embedding.py', 'retrieve.py', 'vector_key.py', 'fetch_techqa.py',
         'documents.json', 'requirements.txt', 'README.md', 'READING.md', 'test_lab.py']
with ZipFile(root / 'content/learn/day-02-lab.zip', 'w', compression=ZIP_DEFLATED) as archive:
    for filename in files:
        entry = ZipInfo('day-02/' + filename, date_time=(2026, 1, 1, 0, 0, 0))
        entry.compress_type = ZIP_DEFLATED
        entry.external_attr = 0o644 << 16
        archive.writestr(entry, (source / filename).read_bytes())
print('Built content/learn/day-02-lab.zip')
