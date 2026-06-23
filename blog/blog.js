(function () {
  const formatDate = (iso) => {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const renderIndex = async (mount) => {
    try {
      const res = await fetch('posts.json', { cache: 'no-cache' });
      if (!res.ok) throw new Error('posts.json ' + res.status);
      const posts = await res.json();
      posts.sort((a, b) => b.date.localeCompare(a.date));

      if (!posts.length) {
        mount.innerHTML = '<p class="post-loading">No posts yet — first one is coming.</p>';
        return;
      }

      mount.innerHTML = posts.map((p) => `
        <a class="post-list-item" href="post.html?slug=${encodeURIComponent(p.slug)}">
          <div class="post-meta">
            <span>${formatDate(p.date)}</span>
            ${p.tags && p.tags.length ? `<div class="post-tags">${p.tags.map((t) => `<span class="post-tag">${t}</span>`).join('')}</div>` : ''}
          </div>
          <h3>${p.title}</h3>
          <p>${p.excerpt}</p>
        </a>
      `).join('');
    } catch (err) {
      mount.innerHTML = `<p class="post-error">Could not load posts: ${err.message}</p>`;
    }
  };

  const renderPost = async (mount) => {
    const params = new URLSearchParams(window.location.search);
    const slug = params.get('slug');
    if (!slug) {
      mount.innerHTML = '<p class="post-error">No post specified. <a href="index.html">Back to blog</a>.</p>';
      return;
    }

    try {
      const [metaRes, mdRes] = await Promise.all([
        fetch('posts.json', { cache: 'no-cache' }),
        fetch(`posts/${slug}.md`, { cache: 'no-cache' }),
      ]);
      if (!metaRes.ok) throw new Error('posts.json ' + metaRes.status);
      if (!mdRes.ok) throw new Error('post not found');

      const posts = await metaRes.json();
      const meta = posts.find((p) => p.slug === slug);
      const md = await mdRes.text();

      if (!meta) throw new Error('post not in index');

      document.title = meta.title + ' — Chandan Kumar';

      const html = window.marked.parse(md, { breaks: false, gfm: true });
      const stripFirstH1 = html.replace(/^\s*<h1[^>]*>[^<]*<\/h1>\s*/i, '');

      mount.innerHTML = `
        <article class="post">
          <header class="post-header">
            <h1>${meta.title}</h1>
            <div class="post-meta">
              <span>${formatDate(meta.date)}</span>
              ${meta.tags && meta.tags.length ? `<div class="post-tags">${meta.tags.map((t) => `<span class="post-tag">${t}</span>`).join('')}</div>` : ''}
            </div>
          </header>
          <div class="post-body">${stripFirstH1}</div>
          <a class="post-back" href="index.html">&larr; All posts</a>
        </article>
      `;
    } catch (err) {
      mount.innerHTML = `<p class="post-error">Could not load post: ${err.message}. <a href="index.html">Back to blog</a>.</p>`;
    }
  };

  const indexMount = document.getElementById('post-list');
  const postMount = document.getElementById('post-view');
  if (indexMount) renderIndex(indexMount);
  if (postMount) renderPost(postMount);
})();
