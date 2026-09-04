if (!window.mtBlogInit) {
  window.mtBlogInit = true;

  const init = (scope) => {
    scope.querySelectorAll('[data-blog]').forEach((root) => {
      if (root.dataset.mtReady) return;
      root.dataset.mtReady = 'true';
      const grid = root.querySelector('[data-blog-grid]');
      const sentinel = root.querySelector('[data-blog-more]');
      if (!grid || !sentinel) return;
      let loading = false;
      const observer = new IntersectionObserver(
        async (entries) => {
          if (loading || !entries.some((entry) => entry.isIntersecting)) return;
          if (!grid.isConnected) {
            observer.disconnect();
            return;
          }
          loading = true;
          try {
            const res = await fetch(sentinel.dataset.nextUrl);
            if (!res.ok) throw new Error(res.status);
            const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
            doc.querySelectorAll('[data-blog-grid] > *').forEach((card) => grid.append(card));
            const next = doc.querySelector('[data-blog-more]');
            if (next && next.dataset.nextUrl) {
              sentinel.dataset.nextUrl = next.dataset.nextUrl;
            } else {
              observer.disconnect();
              sentinel.remove();
            }
            document.dispatchEvent(new CustomEvent('mt:reveal-scan'));
          } catch {}
          loading = false;
        },
        { rootMargin: '600px' }
      );
      observer.observe(sentinel);
    });
  };

  init(document);
  document.addEventListener('shopify:section:load', (event) => init(event.target));
}
