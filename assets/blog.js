if (!window.mtBlogInit) {
  window.mtBlogInit = true;

  const parser = new DOMParser();

  const swap = (root, doc) => {
    const nextTags = doc.querySelector('[data-blog-tags]');
    const tags = root.querySelector('[data-blog-tags]');
    if (tags && nextTags) tags.replaceWith(nextTags);
    else if (tags && !nextTags) tags.remove();

    const results = root.querySelector('[data-blog-results]');
    const nextResults = doc.querySelector('[data-blog-results]');
    if (results && nextResults) results.replaceWith(nextResults);
  };

  const scrollToTitle = (root) => {
    const title = root.querySelector('#mt-blog-title');
    if (!title) return;
    const rootStyle = getComputedStyle(document.documentElement);
    const headerOffset =
      parseFloat(rootStyle.getPropertyValue('--mt-header-h')) * parseFloat(rootStyle.fontSize) || 0;
    let top = -headerOffset;
    let node = title;
    while (node) {
      top += node.offsetTop;
      node = node.offsetParent;
    }
    if (window.mtScrollTo) {
      window.mtScrollTo(top);
    } else {
      window.scrollTo(0, top);
    }
  };

  const load = async (root, url) => {
    root.setAttribute('aria-busy', 'true');
    try {
      const sep = url.includes('?') ? '&' : '?';
      const res = await fetch(`${url}${sep}section_id=${root.dataset.sectionId}`);
      if (!res.ok) throw new Error(res.status);
      const doc = parser.parseFromString(await res.text(), 'text/html');
      swap(root, doc);
      document.dispatchEvent(new CustomEvent('mt:reveal-scan'));
      scrollToTitle(root);
    } catch {
      window.location.href = url;
      return;
    } finally {
      root.removeAttribute('aria-busy');
    }
  };

  const init = (scope) => {
    scope.querySelectorAll('[data-blog]').forEach((root) => {
      if (root.dataset.mtReady) return;
      root.dataset.mtReady = 'true';

      root.addEventListener('click', (event) => {
        if (event.defaultPrevented || event.button !== 0) return;
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

        const card = event.target.closest('.mt-blog__card');
        if (card) {
          window.dataLayer = window.dataLayer || [];
          window.dataLayer.push({ event_parameters: null });
          window.dataLayer.push({
            event: 'ga4Event',
            event_name: 'select_content',
            event_parameters: {
              module_name: 'Blog',
              content_name: card.querySelector('.mt-blog__name')?.textContent.trim(),
            },
          });
          return;
        }

        const link = event.target.closest('a[href]');
        if (!link) return;
        if (link.closest('[data-blog-tags]')) {
          window.dataLayer = window.dataLayer || [];
          window.dataLayer.push({ event_parameters: null });
          window.dataLayer.push({
            event: 'ga4Event',
            event_name: 'select_content_category',
            event_parameters: {
              module_name: 'Blog',
              button_name: link.textContent.trim(),
            },
          });
        }
        if (!link.closest('[data-blog-tags], [data-blog-pager]')) return;
        event.preventDefault();
        const href = link.getAttribute('href');
        history.pushState({ mtBlog: true }, '', href);
        load(root, href.split('#')[0]);
      });
    });
  };

  window.addEventListener('popstate', (event) => {
    const root = document.querySelector('[data-blog]');
    if (!root || !event.state || !event.state.mtBlog) return;
    load(root, window.location.pathname + window.location.search);
  });

  init(document);
  document.addEventListener('shopify:section:load', (event) => init(event.target));
}
