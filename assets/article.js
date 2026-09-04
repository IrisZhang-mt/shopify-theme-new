if (!window.mtArticleInit) {
  window.mtArticleInit = true;

  const strings = window.mtStrings || {};

  const reducedMq = window.mtReducedMq;

  const isMediaBlock = (el) =>
    el.tagName === 'P' && el.querySelector('img') && el.textContent.trim() === '';

  const isMediaWrap = (el) => /mt-art__(full|pair|gallery|stage)/.test(el.className);

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

  const wrapRun = (run) => {
    const wrap = document.createElement('div');
    if (run.length === 1) {
      wrap.className = 'mt-art__full';
      run[0].setAttribute('data-mt-parallax', '');
    } else if (run.length === 2) {
      wrap.className = 'mt-art__pair';
    } else {
      wrap.className = 'mt-art__gallery';
      wrap.dataset.autoplay = '25';
      wrap.setAttribute('data-wheel-lock', '');
      wrap.tabIndex = 0;
      wrap.setAttribute('role', 'region');
      wrap.setAttribute('aria-label', 'Image gallery');
      run.forEach((el, i) => {
        el.setAttribute('data-reveal', '');
        el.style.setProperty('--mt-reveal-i', i % 3);
      });
    }
    run[0].before(wrap);
    run.forEach((el) => wrap.append(el));
    if (wrap.classList.contains('mt-art__gallery')) stageGallery(wrap);
  };

  const stageGallery = (gallery) => {
    const rte = gallery.closest('[data-art-rte]');
    if (!rte?.dataset.artArrow) return;
    const stage = document.createElement('div');
    stage.className = 'mt-art__stage';
    stage.setAttribute('data-row-stage', '');
    gallery.before(stage);
    stage.append(gallery);
    [
      ['prev', rte.dataset.artPrev],
      ['next', rte.dataset.artNext],
    ].forEach(([dir, label]) => {
      const nav = document.createElement('button');
      nav.type = 'button';
      nav.className = `mt-row-nav mt-row-nav--${dir}`;
      nav.dataset.rowArrow = dir;
      nav.setAttribute('aria-label', label || dir);
      const icon = document.createElement('img');
      icon.src = rte.dataset.artArrow;
      icon.width = 18;
      icon.height = 12;
      icon.alt = '';
      nav.append(icon);
      stage.append(nav);
    });
  };

  const groupMedia = (rte) => {
    let run = [];
    Array.from(rte.children).forEach((el) => {
      if (isMediaBlock(el)) {
        run.push(el);
        return;
      }
      if (run.length) wrapRun(run);
      run = [];
    });
    if (run.length) wrapRun(run);
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
      if (el.classList.contains('mt-art__gallery') || el.classList.contains('mt-art__stage')) return;
      el.setAttribute('data-reveal', '');
    });
  };

  const share = async (button) => {
    const payload = { title: document.title, url: window.location.href };
    if (navigator.share) {
      try {
        await navigator.share(payload);
      } catch {}
      return;
    }
    try {
      await navigator.clipboard.writeText(payload.url);
    } catch {
      return;
    }
    if (button.dataset.mtLabel) return;
    button.dataset.mtLabel = button.textContent;
    button.textContent = strings.linkCopied;
    setTimeout(() => {
      button.textContent = button.dataset.mtLabel;
      delete button.dataset.mtLabel;
    }, 2000);
  };

  const init = (scope) => {
    scope.querySelectorAll('[data-art]').forEach((root) => {
      if (root.dataset.mtReady) return;
      root.dataset.mtReady = 'true';
      const rte = root.querySelector('[data-art-rte]');
      if (rte) {
        normalize(rte);
        groupMedia(rte);
        moveLeadMedia(rte);
        insertQuote(rte);
        markCites(rte);
        splitScrub(rte);
        addReveals(rte);
      }
    });
    document.dispatchEvent(new CustomEvent('mt:reveal-scan'));
    queue();
  };

  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-art-share]');
    if (button) share(button);
  });

  document.addEventListener('scroll', queue, { capture: true, passive: true });
  window.addEventListener('resize', queue);
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
