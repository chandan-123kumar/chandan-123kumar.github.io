"""Add a written daily entry to the static blog's existing post index."""

import argparse
import json
from datetime import date, datetime
from pathlib import Path
from zoneinfo import ZoneInfo


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("content", type=Path, help="Reviewed Markdown entry")
    parser.add_argument("--title", required=True)
    parser.add_argument("--excerpt", required=True)
    parser.add_argument("--date", default=datetime.now(ZoneInfo("Asia/Kolkata")).date().isoformat())
    args = parser.parse_args()
    try:
        day = date.fromisoformat(args.date).isoformat()
    except ValueError:
        parser.error("Use a valid YYYY-MM-DD date")
    if not args.title.strip() or not args.excerpt.strip():
        parser.error("Title and excerpt must not be empty")
    content = args.content.read_text(encoding="utf-8")
    if not content.strip():
        parser.error("The Markdown entry must not be empty")

    blog = Path(__file__).resolve().parent.parent / "blog"
    index = blog / "posts.json"
    posts = json.loads(index.read_text(encoding="utf-8"))
    if any(post["date"] == day and "build-log" in post.get("tags", []) for post in posts):
        parser.error("A build-log entry already exists for this date; edit that entry instead")
    slug = day + "-build-log"
    target = blog / "posts" / (slug + ".md")
    with target.open("x", encoding="utf-8") as file:
        file.write(content)
    posts.append({"slug": slug, "title": args.title, "date": day,
                  "excerpt": args.excerpt, "tags": ["build-log", "ai-harness"]})
    posts.sort(key=lambda post: post["date"], reverse=True)
    index.write_text(json.dumps(posts, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Added blog/post.html?slug={slug}. Preview and review before deploying.")


if __name__ == "__main__":
    main()
