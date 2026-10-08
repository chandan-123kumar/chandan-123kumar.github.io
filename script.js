(function () {
  const nav = document.getElementById('site-nav');
  const toggle = document.querySelector('[data-nav-toggle]');
  const menu = document.querySelector('[data-nav-menu]');

  const setScrolled = () => {
    nav.classList.toggle('scrolled', window.scrollY > 8);
  };
  setScrolled();
  window.addEventListener('scroll', setScrolled, { passive: true });

  toggle.addEventListener('click', () => {
    const open = menu.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
  });

  menu.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      menu.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    });
  });
})();

(function () {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const sections = document.querySelectorAll('main > section');
  sections.forEach((s) => s.classList.add('fade-in'));

  const obs = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          obs.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 }
  );
  sections.forEach((s) => obs.observe(s));
})();

(function () {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const metrics = document.querySelectorAll('.metric');
  if (!metrics.length) return;

  const obs = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry, idx) => {
        if (!entry.isIntersecting) return;
        const metric = entry.target;
        setTimeout(() => metric.classList.add('metric-animate'), idx * 120);
        obs.unobserve(metric);
      });
    },
    { threshold: 0.4 }
  );
  metrics.forEach((m) => obs.observe(m));
})();

(function () {
  const mount = document.getElementById('writing-preview');
  if (!mount) return;

  const formatDate = (iso) => {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  fetch('blog/posts.json', { cache: 'no-cache' })
    .then((r) => { if (!r.ok) throw new Error('posts.json ' + r.status); return r.json(); })
    .then((posts) => {
      posts.sort((a, b) => b.date.localeCompare(a.date));
      const latest = posts.slice(0, 4);
      if (!latest.length) {
        mount.innerHTML = '<p class="writing-loading">First post coming soon.</p>';
        return;
      }
      mount.innerHTML = latest.map((p) => `
        <a class="writing-card" href="blog/post.html?slug=${encodeURIComponent(p.slug)}">
          <div class="post-meta"><span>${formatDate(p.date)}</span></div>
          <h3>${p.title}</h3>
          <p>${p.excerpt}</p>
        </a>
      `).join('');
    })
    .catch(() => {
      mount.innerHTML = '<p class="writing-loading">Posts are warming up — check back soon.</p>';
    });
})();

(function () {
  const status = document.querySelector('.karyo-status');
  document.querySelectorAll('[data-copy-command]').forEach((button) => {
    button.hidden = false;
    button.addEventListener('click', async () => {
      const command = document.getElementById(button.dataset.copyCommand);
      try {
        await navigator.clipboard.writeText(command.textContent);
        status.textContent = 'Copied to clipboard.';
      } catch (_) {
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(command);
        selection.removeAllRanges();
        selection.addRange(range);
        status.textContent = 'Command selected. Press Ctrl+C or ⌘C to copy.';
      }
    });
  });
})();
