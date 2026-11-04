"""Export an inspection file: serialized vector -> list of source chunks."""
import argparse
import json
from pathlib import Path
from embedding import validate_index


def reverse_index(index):
    validate_index(index)
    result = {}
    for chunk_id, row in index["items"].items():
        # JSON object keys must be strings. Do not round floats or lose collisions.
        key = json.dumps(row["vector"], separators=(",", ":"), allow_nan=False)
        result.setdefault(key, []).append({"chunk_id": chunk_id,
                                          **{k: v for k, v in row.items() if k != "vector"}})
    return {"embedding": index["embedding"], "vectors": result}


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--input", default="index.json")
    p.add_argument("--output", default="vector_to_chunks.json")
    a = p.parse_args()
    try:
        result = reverse_index(json.loads(Path(a.input).read_text()))
        Path(a.output).write_text(json.dumps(result, ensure_ascii=False, indent=2, allow_nan=False) + "\n")
        print(f"Wrote {len(result['vectors'])} vector keys to {a.output}; duplicate vectors retain every chunk.")
    except (ValueError, KeyError, TypeError, OSError) as exc:
        p.error(str(exc))


if __name__ == "__main__":
    main()
