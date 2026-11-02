"""Day 1: explicit inference boundary. Demo is offline; live opts into HF calls."""
import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import sys
from time import perf_counter
from uuid import uuid4


QUESTION = "How many active projects can I create on Atlas Basic today?"
PROMPT_VERSION = "day01-grounded-v1"
CASES = {
    "current": {
        "source_version": "atlas-plans-v2",
        "facts": (
            "Source: atlas-plans-v2. Effective from 2026-10-01. "
            "Atlas Basic supports 3 active projects per workspace. "
            "Atlas Pro supports 20 active projects per workspace. "
            "Archived projects do not count toward these limits."
        ),
        "demo_answer": "Atlas Basic permits 3 active projects per workspace.",
    },
    "missing": {
        "source_version": "atlas-overview-v1",
        "facts": "Atlas is project-management software. No plan limits are supplied.",
        "demo_answer": "The supplied facts do not establish the Basic-plan project limit.",
    },
    "stale": {
        "source_version": "atlas-plans-v1-expired",
        "facts": (
            "Source: atlas-plans-v1. Expired on 2026-09-30. "
            "Under this old policy Atlas Basic supported 5 active projects. "
            "The replacement policy is not supplied."
        ),
        "demo_answer": (
            "The supplied policy has expired, so it does not establish today's limit."
        ),
    },
}


class BoundaryError(Exception):
    """An intentionally small application-level error taxonomy."""
    def __init__(self, category):
        super().__init__(category)
        self.category = category


def build_messages(case_name):
    return [
        {
            "role": "system",
            "content": (
                "Answer briefly using only supplied facts applicable to the question's date. "
                "If the current answer is not established, say what information is missing. "
                "Do not invent a numerical limit."
            ),
        },
        {
            "role": "user",
            "content": (
                "Today in this synthetic exercise: 2026-11-02.\n"
                f"Facts: {CASES[case_name]['facts']}\nQuestion: {QUESTION}"
            ),
        },
    ]


def demo_answer(case_name, fault):
    # These are authored fixtures, not model-generated answers.
    if fault == "auth":
        raise BoundaryError("authentication")
    if fault == "timeout":
        raise BoundaryError("timeout_or_unavailable")
    if fault == "empty":
        return "", None
    return CASES[case_name]["demo_answer"], None


def http_error_category(status):
    if status == 401:
        return "authentication"
    if status == 403:
        return "permission_denied"
    if status == 429:
        return "rate_limited"
    if status in (408, 504):
        return "timeout_or_unavailable"
    if status == 503:
        return "service_unavailable"
    return "http_error"


def live_answer(messages):
    required = ("HF_TOKEN", "HF_CHAT_MODEL", "HF_PROVIDER")
    if any(not os.environ.get(name, "").strip() for name in required):
        raise BoundaryError("missing_configuration")
    try:
        from huggingface_hub import InferenceClient, InferenceTimeoutError
        from huggingface_hub.errors import HfHubHTTPError
    except ImportError:
        raise BoundaryError("missing_or_incompatible_dependency") from None

    try:
        client = InferenceClient(
            api_key=os.environ["HF_TOKEN"],
            provider=os.environ["HF_PROVIDER"],
            timeout=30,
        )
        response = client.chat.completions.create(
            model=os.environ["HF_CHAT_MODEL"],
            messages=messages,
            max_tokens=128,
        )
    except InferenceTimeoutError:
        raise BoundaryError("timeout_or_unavailable") from None
    except HfHubHTTPError as error:
        status = getattr(getattr(error, "response", None), "status_code", None)
        raise BoundaryError(http_error_category(status)) from None
    except (ValueError, TypeError):
        raise BoundaryError("configuration_or_capability") from None
    except Exception:
        # Keep unknown failures unknown; do not print potentially sensitive error text.
        raise BoundaryError("unclassified_provider_error") from None

    try:
        answer = response.choices[0].message.content
        response_id = getattr(response, "id", None)
    except (AttributeError, IndexError, TypeError):
        raise BoundaryError("invalid_response") from None
    return answer, response_id


def run_case(mode, case_name, fault="none"):
    started = perf_counter()
    record = {
        "run_id": str(uuid4()),
        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
        "mode": mode,
        "simulated": mode == "demo",
        "case": case_name,
        "source_version": CASES[case_name]["source_version"],
        "prompt_version": PROMPT_VERSION,
        "model_requested": os.environ.get("HF_CHAT_MODEL") if mode == "live" else "fixture",
        "provider_requested": os.environ.get("HF_PROVIDER") if mode == "live" else "offline",
        "provider_response_id": None,
        "fault": fault,
        "status": "error",
        "error_category": None,
        "quality_review": "not_applicable",
        "answer": None,
    }
    try:
        if mode == "live" and fault != "none":
            raise BoundaryError("faults_are_demo_only")
        messages = build_messages(case_name)
        answer, response_id = (
            demo_answer(case_name, fault) if mode == "demo" else live_answer(messages)
        )
        if not isinstance(answer, str) or not answer.strip():
            raise BoundaryError("invalid_response")
        record.update(
            status="ok", answer=answer.strip(), quality_review="pending",
            provider_response_id=response_id,
        )
    except BoundaryError as error:
        record["error_category"] = error.category
    record["elapsed_ms"] = round((perf_counter() - started) * 1000, 3)
    return record


def append_ledger(path, record):
    # Only the fixed synthetic cases are supported by this starter.
    # Do not expand this allowlist with credentials, raw errors or full prompts.
    fields = (
        "run_id", "timestamp_utc", "mode", "simulated", "case", "source_version",
        "prompt_version", "model_requested", "provider_requested", "provider_response_id",
        "fault", "status", "error_category", "quality_review", "elapsed_ms",
    )
    with Path(path).open("a", encoding="utf-8") as output:
        output.write(json.dumps({key: record[key] for key in fields}) + "\n")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--mode", choices=("demo", "live"), default="demo")
    parser.add_argument("--case", choices=tuple(CASES), default="current")
    parser.add_argument("--fault", choices=("none", "auth", "timeout", "empty"), default="none")
    parser.add_argument("--ledger", default="runs.jsonl")
    args = parser.parse_args()
    record = run_case(args.mode, args.case, args.fault)
    print(json.dumps(record, indent=2))
    try:
        append_ledger(args.ledger, record)
    except OSError:
        # The printed result remains available even if the ledger cannot be written.
        print("Ledger write failed. Choose a writable --ledger path.", file=sys.stderr)
        return 2
    return 0 if record["status"] == "ok" else 1


if __name__ == "__main__":
    raise SystemExit(main())
