if (!window.mtArticleInit) {
  window.mtArticleInit = true;

  const strings = window.mtStrings || {};

  const reducedMq = window.mtReducedMq;

  const isMediaBlock = (el) =>
    el.tagName === 'P' && el.querySelector('img') && el.textContent.trim() === '';

  const isMediaWrap = (el) => el.tagName === 'FIGURE' || el.classList.contains('mt-art__media');

  const rebuildLine = (line, out) => {
    const img = line.querySelector('img');
    const text = line.textContent.trim();
    if (img && !text) {
      const media = document.createElement('p');
      media.append(img);
      out.push(media);
      return;
    }
    if (!text) return;
    const strong = line.querySelector('strong, b');
    const heading = strong && strong.textContent.trim() === text && text.length <= 90;
    const block = document.createElement(heading ? 'h2' : 'p');
    if (heading) {
      block.textContent = text;
    } else {
      block.innerHTML = line.innerHTML;
      block.querySelectorAll('br').forEach((node) => node.remove());
      block.querySelectorAll('[class]').forEach((node) => node.removeAttribute('class'));
    }
    out.push(block);
  };

  const collectLines = (node, out) => {
    Array.from(node.children).forEach((child) => {
      if (child.tagName === 'BR') return;
      if (/^(H[1-6]|BLOCKQUOTE|UL|OL|TABLE|FIGURE|IFRAME|VIDEO)$/.test(child.tagName)) {
        out.push(child);
        return;
      }
      if (child.querySelector('div, p')) {
        collectLines(child, out);
        return;
      }
      rebuildLine(child, out);
    });
  };

  const normalize = (rte) => {
    if (!rte.querySelector('.ace-line')) return;
    const out = [];
    collectLines(rte, out);
    rte.textContent = '';
    out.forEach((el) => rte.append(el));
  };

  const moveLeadMedia = (rte) => {
    const lead = [];
    let el = rte.firstElementChild;
    while (el && isMediaWrap(el)) {
      lead.push(el);
      el = el.nextElementSibling;
    }
    if (!lead.length || !el) return;
    let anchor = el;
    while (
      anchor.nextElementSibling &&
      !isMediaWrap(anchor.nextElementSibling) &&
      anchor.nextElementSibling.tagName !== 'H2'
    ) {
      anchor = anchor.nextElementSibling;
    }
    lead.reverse().forEach((media) => anchor.after(media));
  };

  const insertQuote = (rte) => {
    if (!rte.dataset.artQuote || rte.querySelector('blockquote')) return;
    const quote = document.createElement('blockquote');
    const text = rte.dataset.artQuote;
    quote.textContent = /^["“]/.test(text) ? text : `“${text}”`;
    let anchor = Array.from(rte.children).find(isMediaWrap);
    if (!anchor) {
      const kids = Array.from(rte.children);
      anchor = kids[Math.min(kids.length - 1, Math.max(0, Math.ceil(kids.length / 3) - 1))];
    }
    if (!anchor) return;
    anchor.after(quote);
    if (rte.dataset.artQuoteAuthor) {
      const cite = document.createElement('p');
      cite.textContent = rte.dataset.artQuoteAuthor;
      quote.after(cite);
    }
  };

  // Image-only paragraphs: one image per row at the column width (Figma 1479:6788).
  const markMedia = (rte) => {
    Array.from(rte.children).forEach((el) => {
      if (isMediaBlock(el)) el.classList.add('mt-art__media');
    });
  };

  // Tables scroll sideways on small screens; a header-less two-column table is a list (1479:6846).
  const markTables = (rte) => {
    rte.querySelectorAll('table').forEach((table) => {
      if (!table.parentElement.classList.contains('mt-art__table')) {
        const wrap = document.createElement('div');
        wrap.className = 'mt-art__table';
        table.before(wrap);
        wrap.append(table);
      }
      const rows = Array.from(table.rows);
      if (rows.length && !table.querySelector('th') && rows.every((row) => row.cells.length === 2)) {
        table.classList.add('mt-art__list');
      }
    });
  };

  let uid = 0;
  const icon = () =>
    '<svg class="mt-art__icon" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M1 7h12" stroke="currentColor" stroke-width="1.25"/><path class="mt-art__icon-v" d="M7 1v12" stroke="currentColor" stroke-width="1.25"/></svg>';

  // Wraps nodes in a collapsible panel controlled by `button`.
  const fold = (button, nodes, open) => {
    const panel = document.createElement('div');
    panel.className = 'mt-art__fold';
    panel.id = `mt-art-fold-${(uid += 1)}`;
    const inner = document.createElement('div');
    inner.className = 'mt-art__fold-inner';
    nodes.forEach((node) => inner.append(node));
    panel.append(inner);
    button.setAttribute('aria-controls', panel.id);
    button.setAttribute('aria-expanded', String(open));
    panel.inert = !open;
    return panel;
  };

  const setOpen = (item, open) => {
    const button = item.querySelector('[aria-controls]');
    const panel = document.getElementById(button.getAttribute('aria-controls'));
    item.classList.toggle('is-open', open);
    button.setAttribute('aria-expanded', String(open));
    panel.inert = !open;
  };

  // Quick summary: the editor writes a list with class="quick-summary" (1479:6771).
  const buildSummary = (rte) => {
    rte.querySelectorAll('ul.quick-summary, ol.quick-summary').forEach((list) => {
      const box = document.createElement('section');
      box.className = 'mt-art__summary is-open';
      if (!rte.querySelector('#quick-summary')) box.id = 'quick-summary';
      const head = document.createElement('button');
      head.type = 'button';
      head.className = 'mt-art__summary-head';
      head.setAttribute('data-art-fold', '');
      head.innerHTML = `<span></span>${icon()}`;
      head.firstChild.textContent = rte.dataset.artSummary || 'Quick summary';
      list.before(box);
      box.append(head, fold(head, [list], true));
    });
  };

  // FAQ: H3 questions after an H2 "FAQ" / "Frequently asked questions"; one answer open at a time
  // (1479:6864). Schema.org microdata written in the body keeps working: only the DOM around it changes.
  const FAQ_TITLE = /^(faqs?|frequently asked questions)\b/i;
  const buildFaq = (rte) => {
    // FAQPage microdata block (its H2 inside or right before it, any name), else an H2 named
    // FAQ / Frequently asked questions and the H3s up to the next H2.
    let title = null;
    const questions = [];
    const page = rte.querySelector('[itemtype*="FAQPage"]');
    if (page) {
      title = page.querySelector('h2') || (page.previousElementSibling?.tagName === 'H2' ? page.previousElementSibling : null);
      questions.push(...page.querySelectorAll('h3'));
    } else {
      title = Array.from(rte.children).find((el) => el.tagName === 'H2' && FAQ_TITLE.test(el.textContent.trim()));
      for (let el = title?.nextElementSibling; el && el.tagName !== 'H2'; el = el.nextElementSibling) {
        if (el.tagName === 'H3') questions.push(el);
        else questions.push(...el.querySelectorAll('h3'));
      }
    }
    if (!questions.length) return;
    if (title) {
      title.setAttribute('data-art-faq-title', '');
      if (FAQ_TITLE.test(title.textContent.trim())) title.setAttribute('data-art-faq-short', '');
    }
    const items = questions.map((question, index) => {
      const answer = [];
      for (
        let el = question.nextElementSibling;
        el && !/^H[23]$/.test(el.tagName) && !el.querySelector('h3');
        el = el.nextElementSibling
      ) {
        answer.push(el);
      }
      const item = document.createElement('div');
      item.className = 'mt-art__faq-item';
      question.before(item);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'mt-art__faq-q';
      button.setAttribute('data-art-faq-q', '');
      const label = document.createElement('span');
      label.append(...question.childNodes);
      button.append(label);
      button.insertAdjacentHTML('beforeend', icon());
      question.append(button);
      item.append(question, fold(button, answer, index === 0));
      if (index === 0) item.classList.add('is-open');
      return item;
    });
    items[items.length - 1]?.classList.add('is-last');
  };

  // Chapters: the body H2s (plus Quick summary), current one marked while scrolling (1479:6883).
  const slug = (text) =>
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'section';

  const headerOffset = () => {
    const header = document.querySelector('.section-header');
    return header ? Math.max(header.getBoundingClientRect().bottom, 0) : 0;
  };

  const tocs = [];

  const buildToc = (root, rte) => {
    const toc = root.querySelector('[data-art-toc]');
    const list = toc?.querySelector('[data-art-toc-list]');
    if (!list) return;
    const targets = Array.from(rte.querySelectorAll(':scope > h2, #quick-summary, [data-art-faq-title]'));
    if (targets.length < 3) return;
    const used = new Set();
    const entries = targets.map((target) => {
      let label = target.textContent.trim();
      if (target.classList.contains('mt-art__summary')) label = rte.dataset.artSummary || label;
      else if (target.hasAttribute('data-art-faq-short')) label = rte.dataset.artFaq || label;
      else if (label.includes(':')) label = label.split(':')[0].trim();
      if (!target.id) {
        let id = slug(label);
        while (used.has(id) || document.getElementById(id)) id = `${id}-${used.size + 1}`;
        target.id = id;
      }
      used.add(target.id);
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.href = `#${target.id}`;
      link.textContent = label;
      item.append(link);
      list.append(item);
      return { target, item };
    });
    toc.hidden = false;
    const state = { toc, entries, current: -1 };
    tocs.push(state);
    // Desktop keeps the list open; narrower screens start folded to the current chapter.
    if (!window.matchMedia('(min-width: 1200px)').matches) setTocCollapsed(toc, true);
    spy();
  };

  const setTocCollapsed = (toc, collapsed) => {
    const toggle = toc.querySelector('[data-art-toc-toggle]');
    toc.classList.toggle('is-collapsed', collapsed);
    toggle.setAttribute('aria-expanded', String(!collapsed));
    toggle.textContent = collapsed ? toggle.dataset.show : toggle.dataset.hide;
  };

  let spyQueued = false;
  const spy = () => {
    if (spyQueued || !tocs.length) return;
    spyQueued = true;
    requestAnimationFrame(() => {
      spyQueued = false;
      const line = headerOffset() + 80;
      tocs.forEach((state) => {
        let current = 0;
        state.entries.forEach(({ target }, i) => {
          if (target.getBoundingClientRect().top <= line) current = i;
        });
        if (current === state.current) return;
        state.current = current;
        state.entries.forEach(({ item }, i) => {
          item.classList.toggle('is-current', i === current);
          const link = item.firstChild;
          if (i === current) link.setAttribute('aria-current', 'location');
          else link.removeAttribute('aria-current');
        });
      });
    });
  };

  // With motion.js smooth scrolling (html.mt-smooth) the page is drawn from .mt-scroll, whose scrollTop
  // eases behind window.scrollY; mtScrollTo drives that directly (same as anchor-tabs.js).
  const visualScrollY = () =>
    document.documentElement.classList.contains('mt-smooth')
      ? document.querySelector('.mt-scroll')?.scrollTop ?? window.scrollY
      : window.scrollY;

  const scrollToTarget = (target) => {
    const header = document.querySelector('.section-header');
    const top = Math.max(0, target.getBoundingClientRect().top + visualScrollY() - (header?.offsetHeight || 0) - 24);
    if (!reducedMq.matches && window.mtScrollTo) window.mtScrollTo(top);
    else window.scrollTo({ top, behavior: reducedMq.matches ? 'auto' : 'smooth' });
  };

  const markCites = (rte) => {
    rte.querySelectorAll('blockquote + p').forEach((p) => {
      const text = p.textContent.trim();
      if (text && text.length <= 48 && !p.querySelector('img')) {
        p.classList.add('mt-art__cite');
      }
    });
  };

  const wrapWords = (node, words) => {
    Array.from(node.childNodes).forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        const frag = document.createDocumentFragment();
        child.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) {
            frag.append(part);
          } else {
            const word = document.createElement('span');
            word.className = 'mt-art__w';
            word.textContent = part;
            frag.append(word);
            words.push(word);
          }
        });
        child.replaceWith(frag);
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        wrapWords(child, words);
      }
    });
  };

  const splitScrub = (rte) => {
    rte.querySelectorAll('blockquote').forEach((quote) => {
      if (quote.mtWords) return;
      const words = [];
      wrapWords(quote, words);
      quote.mtWords = words;
      quote.mtLast = -1;
    });
  };

  const measure = () => {
    const vh = window.innerHeight;
    const out = [];
    document.querySelectorAll('[data-art-rte] blockquote').forEach((quote) => {
      if (!quote.mtWords || !quote.mtWords.length) return;
      const rect = quote.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > vh) return;
      const raw = (vh * 0.85 - rect.top) / (rect.height + vh * 0.35);
      const progress = Math.min(Math.max(raw, 0), 1);
      const count = Math.round(progress * quote.mtWords.length);
      if (count !== quote.mtLast) out.push({ quote, count });
    });
    return out;
  };

  const apply = (items) => {
    items.forEach(({ quote, count }) => {
      quote.mtLast = count;
      quote.mtWords.forEach((word, i) => word.classList.toggle('mt-on', i < count));
    });
  };

  const queue = () => {
    if (reducedMq.matches) return;
    window.mtFrame(measure, apply);
  };

  const addReveals = (rte) => {
    Array.from(rte.children).forEach((el) => {
      el.setAttribute('data-reveal', '');
    });
  };

  const shareUrl = (button) =>
    button.closest('[data-art-share-url]')?.dataset.artShareUrl || window.location.href;

  // Copy link → "Link copied" for 1.5s.
  const copyLink = async (button) => {
    try {
      await navigator.clipboard.writeText(shareUrl(button));
    } catch {
      return;
    }
    const group = button.closest('.mt-art__share');
    const note = group?.querySelector('[data-art-copied]');
    if (!note) return;
    const box = group.getBoundingClientRect();
    const rect = button.getBoundingClientRect();
    note.style.setProperty('--art-copied-x', `${rect.left - box.left + rect.width / 2}px`);
    note.textContent = strings.linkCopied || 'Link copied';
    note.classList.add('is-shown');
    clearTimeout(note.mtTimer);
    note.mtTimer = setTimeout(() => note.classList.remove('is-shown'), 1500);
  };

  const nativeShare = async (button) => {
    try {
      await navigator.share({ title: document.title, url: shareUrl(button) });
    } catch {}
  };

  const init = (scope) => {
    scope.querySelectorAll('[data-art]').forEach((root) => {
      if (root.dataset.mtReady) return;
      root.dataset.mtReady = 'true';
      const rte = root.querySelector('[data-art-rte]');
      if (rte) {
        normalize(rte);
        markMedia(rte);
        moveLeadMedia(rte);
        insertQuote(rte);
        markCites(rte);
        markTables(rte);
        buildSummary(rte);
        buildFaq(rte);
        splitScrub(rte);
        addReveals(rte);
        buildToc(root, rte);
      }
      if (navigator.share) {
        root.querySelectorAll('[data-art-native]').forEach((button) => {
          button.hidden = false;
        });
      }
    });
    document.dispatchEvent(new CustomEvent('mt:reveal-scan'));
    queue();
  };

  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-art-copy]')) copyLink(event.target.closest('[data-art-copy]'));
    if (event.target.closest('[data-art-native]')) nativeShare(event.target.closest('[data-art-native]'));

    const tocToggle = event.target.closest('[data-art-toc-toggle]');
    if (tocToggle) {
      const toc = tocToggle.closest('[data-art-toc]');
      setTocCollapsed(toc, !toc.classList.contains('is-collapsed'));
      return;
    }

    const tocLink = event.target.closest('[data-art-toc-list] a');
    if (tocLink) {
      const target = document.getElementById(decodeURIComponent(tocLink.hash.slice(1)));
      if (target) {
        event.preventDefault();
        scrollToTarget(target);
        history.replaceState(null, '', tocLink.hash);
      }
      return;
    }

    const summary = event.target.closest('[data-art-fold]');
    if (summary) {
      const box = summary.parentElement;
      setOpen(box, !box.classList.contains('is-open'));
      return;
    }

    const question = event.target.closest('[data-art-faq-q]');
    if (question) {
      const item = question.closest('.mt-art__faq-item');
      const open = !item.classList.contains('is-open');
      if (open) {
        item
          .closest('[data-art-rte]')
          .querySelectorAll('.mt-art__faq-item.is-open')
          .forEach((other) => setOpen(other, false));
      }
      setOpen(item, open);
      return;
    }

    // Share icons and the shop / story tags read as one row of CTA "buttons" —
    // tracked together as Blog post button clicks.
    const tag = event.target.closest('.mt-art__tag, [data-art-share-to]');
    if (tag) {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({ event_parameters: null });
      window.dataLayer.push({
        event: 'ga4Event',
        event_name: 'select_content',
        event_parameters: {
          module_name: 'Blog Post',
          button_name: tag.dataset.artShareTo ? `Share - ${tag.dataset.artShareTo}` : tag.textContent.trim(),
        },
      });
      return;
    }

    const more = event.target.closest('.mt-art__more .mt-blog__card');
    if (more) {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({ event_parameters: null });
      window.dataLayer.push({
        event: 'ga4Event',
        event_name: 'select_content',
        event_parameters: {
          module_name: 'Blog Post',
          content_name: more.querySelector('.mt-blog__name')?.textContent.trim(),
        },
      });
      return;
    }

    const link = event.target.closest('[data-art-rte] a');
    if (link) {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({ event_parameters: null });
      window.dataLayer.push({
        event: 'ga4Event',
        event_name: 'links_entry',
        event_parameters: {
          button_name: link.textContent.trim(),
        },
      });
    }
  });

  document.addEventListener('scroll', queue, { capture: true, passive: true });
  document.addEventListener('scroll', spy, { capture: true, passive: true });
  window.addEventListener('resize', queue);
  window.addEventListener('resize', spy);
  reducedMq.addEventListener('change', () => {
    if (reducedMq.matches) {
      document.querySelectorAll('[data-art-rte] .mt-art__w.mt-on').forEach((word) => {
        word.classList.remove('mt-on');
      });
      document.querySelectorAll('[data-art-rte] blockquote').forEach((quote) => {
        quote.mtLast = -1;
      });
    } else {
      queue();
    }
  });

  init(document);
  document.addEventListener('shopify:section:load', (event) => init(event.target));
}
