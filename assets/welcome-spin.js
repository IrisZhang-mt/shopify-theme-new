// Welcome spin popup — markup in sections/welcome-spin.liquid, API in
// D:\购物车设计稿\新客抽奖\邮箱采集转盘-前端联调文档.md (App Proxy, no login).
(() => {
  if (window.mtWelcomeSpinInit) return;
  window.mtWelcomeSpinInit = true;

  const STORAGE_KEY = 'mt-welcome-spin-shown';
  const DELAY_MS = 8000;
  const INTERVAL_MS = 3 * 24 * 60 * 60 * 1000;
  const TIMEOUT_MS = 10000;
  const SPIN_MS = 4500;
  const SPIN_REDUCED_MS = 1000;
  const RESULT_PAUSE_MS = 400;
  const MIN_TURNS = 5;
  const BUSY_RETRIES = 3;
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const SVG_NS = 'http://www.w3.org/2000/svg';

  // Wheel geometry in desktop px: viewBox 0 0 500 500, centre 250/250 (= the dial at 250/300 in
  // the 1440 artboards' 500×600 panel). Wedges r212 → r122, labels on r167, tick ring r225,
  // won wedge r228 → r118.6 and 1° wider each side, pointer 16×19 above the ring.
  const C = 250;
  const R_OUT = 212;
  const R_IN = 122;
  const R_LABEL = 167;
  const R_TICKS = 225;
  const WIN_OUT = 228;
  const WIN_IN = 118.6;
  const WIN_PAD = 1;
  // Slot colours in slot order (fixed by design, not configurable); ink = label colour.
  const COLORS = [
    { fill: '#f4efe7', ink: '#1d1d1d' },
    { fill: '#f37434', ink: '#fafbf9' },
    { fill: '#d5c9b5', ink: '#1d1d1d' },
    { fill: '#818a7d', ink: '#fafbf9' },
    { fill: '#fafbf9', ink: '#1d1d1d' },
    { fill: '#1d1d1d', ink: '#fafbf9' },
  ];
  // Wedges with at least this share of the wheel get the two-line label (big word + small rest);
  // the design's smallest two-line wedge (10% off) is 15%. 25%+ get the 30px big word, else 28px.
  const TWO_LINE_SHARE = 0.15;
  const BIG_WORD_SHARE = 0.25;
  // Only for previewing in the theme editor (no API call there).
  const DESIGN_SLOTS = [
    { slot: 0, title: 'Free gift', sectorWeight: 30 },
    { slot: 1, title: '8% off', sectorWeight: 5 },
    { slot: 2, title: '10% off', sectorWeight: 15 },
    { slot: 3, title: '$5 off', sectorWeight: 5 },
    { slot: 4, title: 'Grand prize', sectorWeight: 40 },
    { slot: 5, title: 'Free shipping', sectorWeight: 5 },
  ];

  const reducedMq = window.mtReducedMq || window.matchMedia('(prefers-reduced-motion: reduce)');

  let root = null;
  let config = {};
  let str = {};
  let fineHtml = '';
  const state = {
    slots: [],
    rotation: 0, // cumulative rotor rotation in degrees
    busy: false, // a draw is in flight or the wheel is turning
    token: 0, // bumped on close so a late draw result doesn't show anything
    requestId: null, // kept across retries of the same draw (the backend dedupes by it)
    prize: null,
    kind: '', // coupon | gift | grand (the result shown)
    trigger: null,
  };

  const $ = (selector) => root.querySelector(selector);
  const $$ = (selector) => [...root.querySelectorAll(selector)];
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const mod360 = (deg) => ((deg % 360) + 360) % 360;
  const fill = (template, values) =>
    Object.entries(values).reduce((out, [key, value]) => out.split(`[${key}]`).join(value), template || '');

  const uuid = () =>
    window.crypto?.randomUUID?.() ||
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });

  // GA4 house shape: reset push, then the event. Never send emails or prize codes.
  const track = (eventName, parameters = {}) => {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event_parameters: null });
    window.dataLayer.push({ event: 'ga4Event', event_name: eventName, event_parameters: parameters });
  };

  // ---------- data ----------

  // GET by default; pass a body to POST it as JSON. Rejects with err.code = the API's business
  // code (undefined for network errors / timeouts).
  const api = async (path, body) => {
    if (window.mtWelcomeSpinMock) return window.mtWelcomeSpinMock(path, body);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(root.dataset.prefix + path, {
        method: body ? 'POST' : 'GET',
        headers: body ? { Accept: 'application/json', 'Content-Type': 'application/json' } : { Accept: 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      let json = null;
      try {
        json = await res.json();
      } catch {}
      if (!json || json.code !== 0) throw Object.assign(new Error('welcome spin api'), { code: json?.code });
      return json.data;
    } finally {
      clearTimeout(timer);
    }
  };

  const activityPath = () => `/activities/${encodeURIComponent(root.dataset.activity)}`;

  // ---------- wheel ----------

  const svg = (tag, attrs = {}, text) => {
    const el = document.createElementNS(SVG_NS, tag);
    Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
    if (text != null) el.textContent = text;
    return el;
  };

  // Angles are degrees clockwise from 12 o'clock.
  const point = (r, deg) => {
    const rad = (deg * Math.PI) / 180;
    return [C + r * Math.sin(rad), C - r * Math.cos(rad)];
  };
  const ring = (a0, a1, outer, inner) => {
    const large = a1 - a0 > 180 ? 1 : 0;
    const [x0, y0] = point(outer, a0);
    const [x1, y1] = point(outer, a1);
    const [x2, y2] = point(inner, a1);
    const [x3, y3] = point(inner, a0);
    return `M${x0} ${y0}A${outer} ${outer} 0 ${large} 1 ${x1} ${y1}L${x2} ${y2}A${inner} ${inner} 0 ${large} 0 ${x3} ${y3}Z`;
  };

  // Slot order clockwise; wedge sizes from sectorWeight (equal split if any weight is missing);
  // slot 0 is centred under the pointer before the first spin.
  const layout = (slots) => {
    const sorted = [...slots].sort((a, b) => a.slot - b.slot);
    const weights = sorted.map((s) => Number(s.sectorWeight ?? s.extra?.sectorWeight));
    const weighted = weights.every((w) => Number.isFinite(w) && w > 0);
    const total = weighted ? weights.reduce((sum, w) => sum + w, 0) : sorted.length;
    let angle = -(((weighted ? weights[0] : 1) / total) * 360) / 2;
    return sorted.map((s, i) => {
      const span = ((weighted ? weights[i] : 1) / total) * 360;
      const slot = { ...s, index: i, a0: angle, a1: angle + span, mid: angle + span / 2, share: span / 360 };
      angle += span;
      return slot;
    });
  };

  const textEl = (cls, y, content, ink, extra = {}) =>
    svg('text', { class: cls, x: 0, y, fill: ink, ...extra }, content);

  // Big wedges: first word large, the rest small underneath, upright with the top facing out.
  // Small wedges: mono along the radius, flipped on the left half so it never reads upside down.
  const label = (slot) => {
    const ink = COLORS[slot.index % COLORS.length].ink;
    const words = String(slot.title || '').trim().toUpperCase().split(/\s+/).filter(Boolean);
    const g = svg('g', { class: 'mt-ws__label', 'data-slot': slot.slot });
    let rotate = slot.mid;
    if (slot.share >= TWO_LINE_SHARE) {
      const size = slot.share >= BIG_WORD_SHARE ? 30 : 28;
      const rest = words.slice(1).join(' ');
      const top = rest ? -(size + 4 + 13) / 2 : -size / 2;
      g.append(textEl('mt-ws__lb-big', top + size / 2, words[0] || '', ink, { 'font-size': size }));
      if (rest) g.append(textEl('mt-ws__lb-small', top + size + 4 + 6.5, rest, ink));
    } else {
      const text = words.join(' ');
      if (text.length > 8 && words.length > 1) {
        g.append(textEl('mt-ws__lb-tag mt-ws__lb-tag--stack', -6.5, words[0], ink));
        g.append(textEl('mt-ws__lb-tag mt-ws__lb-tag--stack', 6.5, words.slice(1).join(' '), ink));
      } else {
        g.append(textEl('mt-ws__lb-tag', 0, text, ink));
      }
      rotate = mod360(slot.mid) < 180 ? slot.mid - 90 : slot.mid - 270;
    }
    const [x, y] = point(R_LABEL, slot.mid);
    g.setAttribute('transform', `translate(${x} ${y}) rotate(${rotate})`);
    return g;
  };

  const renderWheel = (slots) => {
    state.slots = layout(slots);
    const wheel = svg('svg', { viewBox: '0 0 500 500', 'aria-hidden': 'true', focusable: 'false' });
    const defs = svg('defs');
    const blur = svg('filter', { id: 'MtWsBlur', x: '-50%', y: '-50%', width: '200%', height: '200%' });
    blur.append(svg('feGaussianBlur', { stdDeviation: 2 }));
    const shadow = svg('filter', { id: 'MtWsShadow', x: '-25%', y: '-25%', width: '150%', height: '150%' });
    shadow.append(svg('feDropShadow', { dx: 0, dy: 6, stdDeviation: 8, 'flood-color': '#000', 'flood-opacity': 0.18 }));
    defs.append(blur, shadow);

    const rotor = svg('g', { class: 'mt-ws__rotor' });
    rotor.style.transform = `rotate(${state.rotation}deg)`;
    rotor.append(
      svg('circle', { class: 'mt-ws__ticks mt-ws__ticks--minor', cx: C, cy: C, r: R_TICKS, transform: `rotate(15 ${C} ${C})` }),
      svg('circle', { class: 'mt-ws__ticks mt-ws__ticks--major', cx: C, cy: C, r: R_TICKS, transform: `rotate(15 ${C} ${C})` }),
    );
    state.slots.forEach((slot) => {
      rotor.append(svg('path', { class: 'mt-ws__seg', d: ring(slot.a0, slot.a1, R_OUT, R_IN), fill: COLORS[slot.index % COLORS.length].fill }));
    });
    rotor.append(svg('g', { 'data-ws-winner': '' }));
    state.slots.forEach((slot) => rotor.append(label(slot)));

    wheel.append(defs, rotor, svg('path', { class: 'mt-ws__pointer', d: `M${C - 8} 25H${C + 8}L${C} 44Z` }));
    $('[data-ws-wheel]').replaceChildren(wheel);
  };

  const markWinner = (slotId) => {
    const layer = $('[data-ws-winner]');
    if (!layer) return;
    layer.replaceChildren();
    $$('.mt-ws__label.is-won').forEach((el) => el.classList.remove('is-won'));
    const slot = state.slots.find((s) => s.slot === slotId);
    if (!slot) return;
    layer.append(
      svg('path', {
        class: 'mt-ws__winner',
        d: ring(slot.a0 - WIN_PAD, slot.a1 + WIN_PAD, WIN_OUT, WIN_IN),
        filter: 'url(#MtWsShadow)',
      }),
    );
    $(`.mt-ws__label[data-slot="${slot.slot}"]`)?.classList.add('is-won');
  };

  // Turn clockwise at least MIN_TURNS times so the won wedge's centre stops under the pointer.
  const spinTo = (slotId) =>
    new Promise((resolve) => {
      const rotor = $('.mt-ws__rotor');
      const slot = state.slots.find((s) => s.slot === slotId);
      if (!rotor || !slot) {
        resolve();
        return;
      }
      const landing = mod360(-slot.mid);
      const from = state.rotation;
      let to = from - mod360(from) + MIN_TURNS * 360 + landing;
      if (to - from < MIN_TURNS * 360) to += 360;
      state.rotation = to;
      const reduced = reducedMq.matches;
      const ms = reduced ? SPIN_REDUCED_MS : SPIN_MS;
      const turning = [rotor, $('[data-ws-hub-bg]')].filter(Boolean);
      turning.forEach((el) => {
        el.style.transition = `transform ${ms}ms cubic-bezier(0.12, 0.6, 0.08, 1)`;
      });
      if (!reduced) rotor.classList.add('is-blur');
      requestAnimationFrame(() => {
        turning.forEach((el) => {
          el.style.transform = `rotate(${to}deg)`;
        });
      });
      setTimeout(() => rotor.classList.remove('is-blur'), ms * 0.7);
      setTimeout(() => {
        turning.forEach((el) => {
          el.style.transition = '';
        });
        resolve();
      }, ms + 50);
    });

  // ---------- views ----------

  const setCopy = ({ eyebrow, small, big, bigFirst = false, text }) => {
    $('[data-ws-eyebrow]').textContent = eyebrow;
    const make = (content, size) => {
      const span = document.createElement('span');
      span.className = `mt-ws__title-${size}`;
      span.textContent = content;
      return span;
    };
    const lines = [make(small, 'small'), make(big, 'big')];
    if (bigFirst) lines.reverse();
    $('[data-ws-title]').replaceChildren(...lines);
    $('[data-ws-text]').textContent = text;
  };

  const showOnly = (name) => {
    root.dataset.wsState = name;
    $$('[data-ws-only]').forEach((el) => {
      el.hidden = el.dataset.wsOnly !== name;
    });
    const content = $('[data-ws-scroll]');
    if (content) content.scrollTop = 0;
  };

  const setEmailError = (message, markField = true) => {
    const error = $('[data-ws-email-error]');
    error.textContent = message || '';
    error.hidden = !message;
    $('[data-ws-email]').classList.toggle('is-invalid', Boolean(message && markField));
  };
  const setConsentError = (on) => {
    $('[data-ws-consent-error]').hidden = !on;
    $('[data-ws-consent]').closest('.mt-ws__consent').classList.toggle('is-invalid', on);
  };

  const setBusy = (on) => {
    state.busy = on;
    root.toggleAttribute('data-ws-busy', on);
    const submit = $('[data-ws-submit]');
    submit.disabled = on;
    submit.textContent = on ? str.spinning : str.spin;
    $('[data-ws-email]').readOnly = on;
    $('[data-ws-consent]').disabled = on;
  };

  // A1: the form (also "Back to wheel" from A7, with an empty email field).
  const showForm = (clearEmail) => {
    state.prize = null;
    state.kind = '';
    setCopy({ eyebrow: str.eyebrow, small: str.titleSmall, big: str.titleBig, text: str.intro });
    $('[data-ws-fine]').innerHTML = fineHtml;
    markWinner(null);
    setEmailError('');
    setConsentError(false);
    if (clearEmail) $('[data-ws-email]').value = '';
    showOnly('form');
  };

  // A7
  const showMember = () => {
    setCopy({ eyebrow: str.memberEyebrow, small: str.memberTitleSmall, big: str.memberTitleBig, text: str.memberText });
    showOnly('member');
  };

  const sizedImage = (src, width) => {
    try {
      const url = new URL(src.startsWith('//') ? `https:${src}` : src, window.location.origin);
      url.searchParams.set('width', width);
      return url.toString();
    } catch {
      return src;
    }
  };

  // Gift / grand row: product photo + title from productHandle when it loads; the tiger mark
  // and the fixed copy stay otherwise.
  const loadGiftProduct = async (handle, token) => {
    const img = $('[data-ws-gift-img]');
    img.hidden = true;
    img.removeAttribute('src');
    $('[data-ws-gift-mark]').hidden = false;
    if (!handle) return;
    try {
      const res = await fetch(`/products/${encodeURIComponent(handle)}.js`, { headers: { Accept: 'application/json' } });
      if (!res.ok || token !== state.token || !state.prize) return;
      const product = await res.json();
      if (product.title) $('[data-ws-gift-name]').textContent = product.title;
      if (product.featured_image) {
        img.onload = () => {
          img.hidden = false;
          $('[data-ws-gift-mark]').hidden = true;
        };
        img.src = sizedImage(product.featured_image, 128);
      }
    } catch {}
  };

  const hubLabel = (title) => {
    const text = String(title || '').trim().toUpperCase();
    const space = text.indexOf(' ');
    const two = text.length > 8 && space > 0;
    const prize = $('[data-ws-hub-prize]');
    prize.replaceChildren();
    if (two) prize.append(text.slice(0, space), document.createElement('br'), text.slice(space + 1));
    else prize.textContent = text;
    prize.closest('.mt-ws__hub-won').classList.toggle('is-two', two);
  };

  // A4 coupon / A5 gift / A6 grand.
  const showResult = (prize) => {
    const type = String(prize.prizeType || '').toUpperCase();
    const kind = type === 'GIFT' ? 'gift' : type === 'GRAND' ? 'grand' : 'coupon';
    const code = String(prize.contentValue || '');
    state.prize = prize;
    state.kind = kind;
    root.dataset.wsPrize = kind;

    if (kind === 'coupon') {
      setCopy({
        eyebrow: str.youWon,
        big: prize.title || '',
        small: str.couponTitleSmall,
        bigFirst: true,
        text: prize.description || str.couponText,
      });
    } else if (kind === 'gift') {
      setCopy({ eyebrow: str.youWon, small: str.giftTitleSmall, big: str.giftTitleBig, text: prize.description || str.giftText });
    } else {
      setCopy({ eyebrow: str.grandEyebrow, small: str.grandTitleSmall, big: str.grandTitleBig, text: prize.description || str.grandText });
    }
    const fallbackFine = { coupon: str.couponFine, gift: fill(str.giftFine, { code }), grand: str.grandFine }[kind];
    $('[data-ws-fine]').textContent = prize.expireText || fallbackFine;

    $('[data-ws-code]').textContent = code;
    const copy = $('[data-ws-copy]');
    copy.hidden = !code;
    copy.textContent = copy.dataset.label || (copy.dataset.label = copy.textContent);

    const shop = $('[data-ws-shop]');
    shop.hidden = kind !== 'coupon';
    shop.href = code
      ? `/discount/${encodeURIComponent(code)}?redirect=${encodeURIComponent(config.shopPath)}`
      : config.shopPath;

    const add = $('[data-ws-add]');
    add.hidden = kind === 'coupon';
    add.disabled = false;
    add.textContent = str.addGift;

    $('[data-ws-gift]').hidden = kind === 'coupon';
    if (kind !== 'coupon') {
      $('[data-ws-gift-name]').textContent = kind === 'gift' ? str.giftName : str.grandName;
      $('[data-ws-gift-note]').textContent = kind === 'gift' ? str.giftNote : str.grandNote;
      loadGiftProduct(prize.extra?.productHandle, state.token);
    }

    hubLabel(prize.title);
    markWinner(prize.slot);
    showOnly('result');
  };

  // ---------- draw ----------

  const draw = async (email) => {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await api(`${activityPath()}/draws`, {
          email,
          consent: true,
          requestId: state.requestId,
          honeypot: $('[data-ws-honeypot]').value,
        });
      } catch (err) {
        // 40900 = the same request is still being processed: wait, retry with the same requestId.
        if (err.code === 40900 && attempt < BUSY_RETRIES) {
          await wait(1500);
          continue;
        }
        throw err;
      }
    }
  };

  const ERRORS = {
    40001: ['errorEmail', 'invalid_request', true],
    40002: ['errorEnded', 'ended', false],
    40004: ['errorUsed', 'already_spun', true],
    40005: ['errorRate', 'rate_limited', false],
  };

  const handleDrawError = (err) => {
    const code = err?.code;
    // A business answer means the next submit is a new draw; network errors / timeouts keep the
    // requestId so a retry can't draw twice if the first request did land.
    if (code && code !== 40900) state.requestId = null;
    if (code === 40003) {
      track('welcome_spin_error', { error_type: 'already_member' });
      showMember();
      return;
    }
    const [key, type, markField] = ERRORS[code] || ['errorGeneric', code ? `failed_${code}` : 'network', false];
    setEmailError(str[key], markField);
    track('welcome_spin_error', { error_type: type });
  };

  const submit = async () => {
    if (state.busy) return;
    const emailField = $('[data-ws-email]');
    const email = emailField.value.trim();
    const emailOk = EMAIL_RE.test(email);
    const consentOk = $('[data-ws-consent]').checked;
    setEmailError(emailOk ? '' : str.errorEmail);
    setConsentError(!consentOk);
    if (!emailOk || !consentOk) {
      track('welcome_spin_error', { error_type: emailOk ? 'no_consent' : 'invalid_email' });
      (emailOk ? $('[data-ws-consent]') : emailField).focus();
      return;
    }

    track('welcome_spin_submit');
    setBusy(true);
    const token = state.token;
    state.requestId = state.requestId || uuid().replace(/[{}]/g, '');
    let data;
    try {
      data = await draw(email);
    } catch (err) {
      if (token !== state.token) return;
      setBusy(false);
      handleDrawError(err);
      return;
    }
    if (token !== state.token) return;
    state.requestId = null;
    const prize = data?.prizes?.[0];
    if (!prize) {
      setBusy(false);
      setEmailError(str.errorGeneric, false);
      return;
    }
    track('welcome_spin_win', {
      prize_type: String(prize.prizeType || '').toLowerCase(),
      prize_name: prize.title || '',
    });
    await spinTo(prize.slot);
    if (token !== state.token) return;
    await wait(RESULT_PAUSE_MS);
    if (token !== state.token) return;
    setBusy(false);
    showResult(prize);
  };

  // ---------- result actions ----------

  const copyCode = async (button) => {
    const code = $('[data-ws-code]').textContent;
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      const field = document.createElement('textarea');
      field.value = code;
      field.setAttribute('readonly', '');
      field.style.cssText = 'position:fixed;opacity:0';
      document.body.append(field);
      field.select();
      try {
        document.execCommand('copy');
      } catch {}
      field.remove();
    }
    const label = button.dataset.label || (button.dataset.label = button.textContent);
    button.textContent = str.copied;
    clearTimeout(button._copiedTimer);
    button._copiedTimer = setTimeout(() => {
      button.textContent = label;
    }, 1500);
  };

  // Gift / grand: add the product (once), put the prize code on the cart, open the cart drawer.
  const addGift = async (button) => {
    const variantId = Number(state.prize?.extra?.variantId);
    const code = String(state.prize?.contentValue || '');
    const fail = () => {
      button.disabled = false;
      button.textContent = str.addFailed;
      setTimeout(() => {
        if (button.isConnected && button.textContent === str.addFailed) button.textContent = str.addGift;
      }, 2500);
    };
    if (!variantId) {
      fail();
      return;
    }
    button.disabled = true;
    button.textContent = str.adding;
    try {
      const json = { Accept: 'application/json', 'Content-Type': 'application/json' };
      const cart = await fetch('/cart.js', { headers: { Accept: 'application/json' } }).then((res) => res.json());
      if (!cart.items?.some((item) => item.variant_id === variantId)) {
        const res = await fetch('/cart/add.js', {
          method: 'POST',
          headers: json,
          body: JSON.stringify({ items: [{ id: variantId, quantity: 1 }] }),
        });
        if (!res.ok) throw new Error(res.status);
      }
      if (code) {
        await fetch('/cart/update.js', { method: 'POST', headers: json, body: JSON.stringify({ discount: code }) }).catch(() => {});
      }
    } catch {
      fail();
      return;
    }
    close();
    if (window.mtCartInit) document.dispatchEvent(new CustomEvent('mt:cart-added'));
    else window.location.href = '/cart';
  };

  // Same-tab links: push first, navigate 250ms later so GTM can send the hit.
  const followLink = (event, link) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    setTimeout(() => {
      window.location.href = link.href;
    }, 250);
  };

  const clickParams = (el) => ({
    button_name: el.textContent.trim(),
    module_name: root.dataset.wsState,
    ...(state.kind ? { prize_type: state.kind } : {}),
  });

  // ---------- open / close ----------

  const open = () => {
    if (!root.hidden) return;
    root.hidden = false;
    document.documentElement.classList.add('mt-ws-lock');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => root.classList.add('mt-ws--open'));
    });
    $('[data-ws-panel]').focus({ preventScroll: true });
  };

  const close = () => {
    if (!root || root.hidden) return;
    root.classList.remove('mt-ws--open');
    document.documentElement.classList.remove('mt-ws-lock');
    if (state.busy) {
      // Closed mid-draw: the prize is saved server-side and the email still goes out.
      state.token += 1;
      setBusy(false);
    }
    const finish = () => {
      root.hidden = true;
    };
    if (reducedMq.matches) finish();
    else setTimeout(finish, 350);
    state.trigger?.focus({ preventScroll: true });
    state.trigger = null;
  };

  // ---------- when to show ----------

  // Signed-in customers never get here (the section renders nothing for them).
  // Rule: no timestamp, or the last one is over 3 days old → show and store now; otherwise don't.
  // Storage blocked (private mode etc.) → don't show, so it can't pop on every page.
  const dueToShow = () => {
    try {
      const last = Number(window.localStorage.getItem(STORAGE_KEY));
      return !last || Date.now() - last > INTERVAL_MS;
    } catch {
      return false;
    }
  };
  const markShown = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(Date.now()));
    } catch {}
  };

  // Another dialog / drawer is open (they all put mt-*-lock on <html>): wait for it to close.
  const otherDialogOpen = () =>
    [...document.documentElement.classList].some((name) => /^mt-[a-z-]+-lock$/.test(name) && name !== 'mt-ws-lock');

  const autoOpen = async () => {
    while (otherDialogOpen()) await wait(1000);
    let data;
    try {
      data = await api(activityPath());
    } catch {
      return; // activity unavailable / 40002 / network: don't show
    }
    if (!data?.prizes?.length || !root.hidden) return;
    renderWheel(data.prizes);
    showForm(true);
    open();
    markShown();
    track('welcome_spin_view');
  };

  // ?ws_mock=… loads fake API answers — never on the live (role "main") theme.
  const mockParams = new URLSearchParams(window.location.search);
  const useMock = () => {
    const role = window.Shopify?.theme?.role;
    return Boolean(mockParams.get('ws_mock') && role && role !== 'main');
  };
  const loadMock = () =>
    new Promise((resolve) => {
      if (!useMock()) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = root.dataset.mockSrc;
      script.onload = resolve;
      script.onerror = resolve;
      document.head.append(script);
    });

  // ---------- events ----------

  const onClick = (event) => {
    const target = event.target;
    if (target.closest('[data-ws-keep]')) {
      track('welcome_spin_click', clickParams(target.closest('[data-ws-keep]')));
      close();
      return;
    }
    if (target.closest('[data-ws-close]')) {
      track('welcome_spin_close', { module_name: root.dataset.wsState });
      close();
      return;
    }
    const copy = target.closest('[data-ws-copy]');
    if (copy) {
      track('welcome_spin_click', clickParams(copy));
      copyCode(copy);
      return;
    }
    const add = target.closest('[data-ws-add]');
    if (add) {
      track('welcome_spin_click', clickParams(add));
      addGift(add);
      return;
    }
    const back = target.closest('[data-ws-back]');
    if (back) {
      track('welcome_spin_click', clickParams(back));
      showForm(true);
      $('[data-ws-email]').focus();
      return;
    }
    const link = target.closest('[data-ws-shop], [data-ws-sign-in]');
    if (link) {
      track('welcome_spin_click', clickParams(link));
      followLink(event, link);
    }
  };

  const bind = (el) => {
    root = el;
    state.token += 1;
    state.busy = false;
    state.rotation = 0;
    try {
      config = JSON.parse(root.querySelector('[data-ws-config]')?.textContent || '{}');
    } catch {
      config = {};
    }
    str = config.strings || {};
    fineHtml = $('[data-ws-fine]').innerHTML;

    root.addEventListener('click', onClick);
    $('[data-ws-form]').addEventListener('submit', (event) => {
      event.preventDefault();
      submit();
    });
    $('[data-ws-email]').addEventListener('input', () => setEmailError(''));
    $('[data-ws-consent]').addEventListener('change', (event) => {
      if (event.target.checked) setConsentError(false);
    });

    if (root.hasAttribute('data-design-mode')) return;
    loadMock().then(() => {
      const mock = useMock();
      if (!mock && !dueToShow()) return;
      const delay = mock && mockParams.has('ws_delay') ? Number(mockParams.get('ws_delay')) * 1000 : DELAY_MS;
      setTimeout(autoOpen, delay);
    });
  };

  document.addEventListener('keydown', (event) => {
    if (!root || root.hidden) return;
    if (event.key === 'Escape') {
      track('welcome_spin_close', { module_name: root.dataset.wsState });
      close();
      return;
    }
    if (event.key === 'Tab') {
      window.mtFocusTrap?.(event, $('[data-ws-panel]'), 'button:not(:disabled), a[href], input:not([tabindex="-1"]):not(:disabled)');
    }
  });

  // Theme editor: preview with the design's slots while the section is selected.
  document.addEventListener('shopify:section:load', (event) => {
    const el = event.target.querySelector?.('[data-ws]');
    if (el) bind(el);
  });
  document.addEventListener('shopify:section:select', (event) => {
    if (!root || !event.target.contains(root)) return;
    renderWheel(DESIGN_SLOTS);
    showForm(true);
    open();
  });
  document.addEventListener('shopify:section:deselect', (event) => {
    if (root && event.target.contains(root)) close();
  });

  const first = document.querySelector('[data-ws]');
  if (first) bind(first);
})();
