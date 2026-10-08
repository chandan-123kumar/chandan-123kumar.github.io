# chandan-123kumar.github.io

Personal website for Chandan Kumar — Senior AI Engineer.

Plain HTML + CSS + vanilla JS. No build step.

## Local preview

```
cd chandan-123kumar.github.io
python3 -m http.server 8000
```

Open http://localhost:8000.

## Deploy

1. Create a new GitHub repository named `chandan-123kumar.github.io` (user site — name must match your GitHub username).
2. From this directory:
   ```
   git init
   git add .
   git commit -m "Initial site"
   git branch -M main
   git remote add origin git@github.com:chandan-123kumar/chandan-123kumar.github.io.git
   git push -u origin main
   ```
3. GitHub Pages auto-publishes from `main`. Visit https://chandan-123kumar.github.io within ~1 minute.

## Editing

- Copy: edit `index.html`.
- Visual style: edit CSS custom properties in `styles.css`.
- Resume PDF: replace `resume.pdf`.
- YouTube URL: search `script.js` and `index.html` for `href="#"` and update.

## Daily progress blog

The existing blog lives at `blog/index.html`. Markdown articles in `blog/posts/`
are listed in `blog/posts.json`; the homepage automatically shows the newest posts.
The daily build log documents building my personal assistant and coding agent,
starting with the 2026-10-07 coding-agent entry. Content and the daily-entry
workflow were imported from `ai-harness/website-blog`.

After each working session:

1. Write an entry using `blog/DAILY-POST-TEMPLATE.md`. Include changes, one learning,
   checks actually run, and the next step. Avoid credentials, private file paths,
   or unverified claims.
2. Add the reviewed entry with Python 3.9+:

   ```sh
   python3 scripts/add_daily_post.py /path/to/todays-entry.md \
     --title "A concrete title" \
     --excerpt "One sentence about today's outcome."
   ```

   The helper uses today's date in Asia/Kolkata. Use `--date YYYY-MM-DD` for a
   different date. It writes the Markdown file and updates the index.
   One build-log entry per date is allowed; extend the existing file if another
   session happens on the same day.

3. Preview the homepage, blog index, and article using the local server above.
4. Review `git diff`, then use the repository's configured deployment workflow.
   If the live site uses S3, both the Markdown file and updated `posts.json`
   must be uploaded along with the site assets.

This is an ongoing session-based writing workflow. It does not invent updates
on inactive days or schedule automatic publishing. The source directory can be
served unchanged; no new build step or service is required.
