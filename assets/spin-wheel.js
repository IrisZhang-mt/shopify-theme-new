if (!window.mtSpinInit) {
  window.mtSpinInit = true;

  const root = document.querySelector('[data-spin]');
  const TIMEOUT_MS = 8000;
  const SESSION_KEY = 'mt-spin-prizes-shown';
  const SVG_NS = 'http://www.w3.org/2000/svg';

  // Wheel positions clockwise from 12 o'clock → slot shown there (fixed by design).
  const POSITION_SLOTS = [0, 1, 4, 2, 3, 5];
  const POSITION_FILLS = ['light', 'accent', 'sand', 'light', 'accent', 'sand'];
  // Used when /status hasn't answered yet (or failed) — same contents the backend returns.
  const FALLBACK_SLOTS = [
    { slot: 0, name: '10%', type: 'COUPON' },
    { slot: 1, name: '15%', type: 'COUPON' },
    { slot: 2, name: '25', type: 'GIFT_CARD' },
    { slot: 3, name: '50', type: 'GIFT_CARD' },
    { slot: 4, name: 'FREE OUTFIT', type: 'GIFT' },
    { slot: 5, name: 'SHERPA JACKET', type: 'GRAND' },
  ];

  const config = (() => {
    try {
      return JSON.parse(root?.querySelector('[data-spin-config]')?.textContent || '{}');
    } catch {
      return {};
    }
  })();
  const str = config.strings || {};
  const fill = (template, values) =>
    Object.entries(values).reduce((out, [key, value]) => out.split(`[${key}]`).join(value), template || '');
  const plural = (count, one, other) => fill(count === 1 ? one : other, { count });

  const state = {
    status: null,
    clockOffset: 0,
    counts: { unused: null, used: null },
    tab: 'unused',
    timer: 0,
    trigger: null,
    rotation: 0, // cumulative wheel rotation in degrees (kept when the svg is re-rendered)
    busy: false, // a draw is in flight or the wheel is turning
    drawToken: 0, // bumped on close so a late draw result doesn't reopen anything
    requestId: null, // kept across retries of the same draw (the backend dedupes by it)
    stale: false, // status changed by a draw; reload before showing 02 again
    copyCode: '',
  };

  const loggedIn = () => root.hasAttribute('data-logged-in');
  const $ = (selector) => root.querySelector(selector);
  const $$ = (selector) => [...root.querySelectorAll(selector)];

  // ---------- data ----------

  // GET by default; pass a body to POST it as JSON.
  const api = async (path, body) => {
    if (window.mtSpinMock) return window.mtSpinMock(path, body);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(root.dataset.prefix + path, {
        method: body ? 'POST' : 'GET',
        headers: body ? { Accept: 'application/json', 'Content-Type': 'application/json' } : { Accept: 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      const json = await res.json();
      if (!json || json.code !== 0) throw Object.assign(new Error('spin api'), { code: json?.code });
      return json.data;
    } finally {
      clearTimeout(timer);
    }
  };

  const loadStatus = async () => {
    const data = await api('/status');
    state.status = data;
    state.clockOffset = Date.parse(data.serverTime) - Date.now() || 0;
    return data;
  };

  const money = (value) => {
    const num = Number(value);
    if (!Number.isFinite(num)) return '';
    return `$${Number.isInteger(num) ? num : num.toFixed(2)}`;
  };

  // ---------- wheel ----------

  const svg = (tag, attrs, text) => {
    const el = document.createElementNS(SVG_NS, tag);
    Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
    if (text != null) el.textContent = text;
    return el;
  };

  const splitTwo = (name) => {
    const words = String(name).split(' ');
    if (words.length < 2) return [name];
    const mid = Math.ceil(words.length / 2);
    return [words.slice(0, mid).join(' '), words.slice(mid).join(' ')];
  };

  // Label for one wedge, centred on (x, y). Sizes are in wheel units (viewBox 334 × 391 = mobile design px).
  const wedgeLabel = (slot, x, y, cls) => {
    const g = svg('g', { class: `mt-spin__label ${cls}` });
    const text = (attrs, content) => g.append(svg('text', { x, 'text-anchor': 'middle', ...attrs }, content));
    if (slot.type === 'COUPON') {
      const t = svg('text', { x, y: y + 9, 'text-anchor': 'middle' });
      t.append(svg('tspan', { class: 'mt-spin__label-big' }, slot.name));
      t.append(svg('tspan', { class: 'mt-spin__label-small', dx: 1 }, str.slotOff));
      g.append(t);
    } else if (slot.type === 'GIFT_CARD') {
      text({ y: y + 4, class: 'mt-spin__label-big' }, `$${slot.name}`);
      text({ y: y + 18, class: 'mt-spin__label-small' }, str.slotGiftCard);
    } else {
      const lines = splitTwo(slot.name);
      const note = slot.type === 'GIFT' ? str.slotGiftNote : '';
      let top = y - (lines.length - 1) * 10 + (note ? -2 : 6);
      lines.forEach((line) => {
        text({ y: top, class: 'mt-spin__label-mid' }, line);
        top += 20;
      });
      if (note) text({ y: top - 2, class: 'mt-spin__label-small' }, note);
    }
    return g;
  };

  const renderWheel = () => {
    const slots = state.status?.slots?.length === 6 ? state.status.slots : FALLBACK_SLOTS;
    const bySlot = Object.fromEntries(slots.map((s) => [s.slot, s]));
    // viewBox = the mobile 01 "Prize wheel" frame (334 × 391): rim r166 centred at (167, 200),
    // wedges r160, pointer tip 145 below centre, base 182 below (CSS rotor origin must match).
    const cx = 167;
    const cy = 200;
    const r = 160;
    const wheel = svg('svg', { viewBox: '0 0 334 391', class: 'mt-spin__svg', 'aria-hidden': 'true' });
    const rotor = svg('g', { class: 'mt-spin__rotor', 'data-spin-rotor': '' });
    rotor.style.transform = `rotate(${state.rotation}deg)`;
    rotor.append(svg('circle', { cx, cy, r: 166, class: 'mt-spin__rim' }));
    POSITION_SLOTS.forEach((slotId, i) => {
      const a0 = ((i * 60 - 90) * Math.PI) / 180;
      const a1 = (((i + 1) * 60 - 90) * Math.PI) / 180;
      const d = `M${cx},${cy} L${cx + r * Math.cos(a0)},${cy + r * Math.sin(a0)} A${r},${r} 0 0 1 ${cx + r * Math.cos(a1)},${cy + r * Math.sin(a1)} Z`;
      rotor.append(svg('path', { d, class: `mt-spin__wedge mt-spin__wedge--${POSITION_FILLS[i]}` }));
      const mid = (((i + 0.5) * 60 - 90) * Math.PI) / 180;
      const slot = bySlot[slotId] || FALLBACK_SLOTS[slotId];
      rotor.append(
        wedgeLabel(slot, cx + 92 * Math.cos(mid), cy + 92 * Math.sin(mid), POSITION_FILLS[i] === 'accent' ? 'is-inverse' : ''),
      );
    });
    wheel.append(rotor);
    wheel.append(svg('path', { d: 'M167 345 L185.5 382 L148.5 382 Z', class: 'mt-spin__pointer' }));
    $('[data-spin-wheel]').replaceChildren(wheel);

    const threshold = state.status?.spinThreshold;
    $$('[data-spin-rule]').forEach((el) => {
      el.textContent = threshold ? fill(str.earningRule, { amount: money(threshold) }) : '';
    });
  };

  // ---------- wheel view states ----------

  const showState = (name) => {
    root.dataset.spinState = name || ''; // CSS: 01 (guest) sizes the dialog to its content on mobile
    $$('[data-spin-state]').forEach((el) => {
      el.hidden = el.dataset.spinState !== name;
    });
    updateGiftCue();
  };

  const formatLeft = (ms) => {
    const total = Math.max(0, Math.floor(ms / 1000));
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
  };

  const tick = () => {
    const now = Date.now() + state.clockOffset;
    let live = 0;
    $$('[data-spin-until]').forEach((el) => {
      const left = Number(el.dataset.spinUntil) - now;
      if (left <= 0) {
        el.remove();
        return;
      }
      live += 1;
      el.textContent = fill(str.useWithin, { time: formatLeft(left) });
    });
    if (!live) stopTimer();
  };

  const stopTimer = () => {
    clearInterval(state.timer);
    state.timer = 0;
  };

  const renderPlayer = () => {
    const s = state.status;
    const left = Number(s.spinsLeft) || 0;
    $('[data-spin-greeting]').textContent = config.firstName
      ? fill(str.greetingName, { name: config.firstName })
      : str.greeting;
    $('[data-spin-count]').textContent = left;
    $('[data-spin-count-suffix]').textContent = left === 1 ? str.suffixOne : str.suffixOther;

    $('[data-spin-draw-error]').hidden = true;
    const draw = $('[data-spin-draw]');
    draw.disabled = left <= 0;
    draw.textContent = left > 0 ? fill(str.spinNow, { count: left }) : str.noSpins;

    const list = $('[data-spin-orders]');
    list.replaceChildren(
      ...(s.spinGroups || []).map((group) => {
        const li = document.createElement('li');
        li.className = 'mt-spin__order';
        const main = document.createElement('div');
        main.className = 'mt-spin__order-main';
        const name = document.createElement('p');
        name.className = 'mt-spin__order-name';
        name.textContent = fill(str.orderLine, { order: group.orderName, amount: money(group.orderAmount) });
        main.append(name);
        const until = Date.parse(group.allPrizesUntil);
        if (group.spins > 0 && until > Date.now() + state.clockOffset) {
          const exp = document.createElement('p');
          exp.className = 'mt-spin__order-exp';
          exp.dataset.spinUntil = until;
          main.append(exp);
        }
        const side = document.createElement('p');
        side.className = 'mt-spin__order-spins';
        if (group.spinsUsed > 0) {
          const used = document.createElement('span');
          used.className = 'mt-spin__order-used';
          used.textContent = plural(group.spinsUsed, str.usedOne, str.usedOther);
          side.append(used);
        }
        if (group.spins > 0) {
          const avail = document.createElement('span');
          avail.className = 'mt-spin__order-left';
          avail.textContent = plural(group.spins, str.spinsOne, str.spinsOther);
          side.append(avail);
        }
        li.append(main, side);
        return li;
      }),
    );
    list.hidden = !list.children.length;

    $('[data-spin-terms]').textContent = [
      str.expiryRule,
      s.spinThreshold ? fill(str.spendRule, { amount: money(s.spinThreshold) }) : '',
    ]
      .filter(Boolean)
      .join('\n'); // design breaks after the first sentence (PC + mobile); CSS pre-line renders it

    stopTimer();
    tick();
    if ($('[data-spin-until]')) state.timer = setInterval(tick, 1000);
    showState('player');
  };

  const fillWheelView = async () => {
    renderWheel();
    if (!loggedIn()) {
      showState('guest');
      if (!state.status) {
        // Slots and threshold only; signed-out status needs no login.
        loadStatus().then(renderWheel).catch(() => {});
      }
      return;
    }
    if (state.busy && root.dataset.spinState === 'player') return; // wheel is turning
    if (state.status && !state.stale) {
      renderPlayer();
      return;
    }
    state.stale = false;
    showState(null);
    try {
      await loadStatus();
      renderWheel();
      renderPlayer();
    } catch {
      showState('error');
    }
  };

  // ---------- draw: spin the wheel, then 04 / 05 ----------

  const SPIN_MS = 4000;
  const SPIN_REDUCED_MS = 1000;
  const RESULT_PAUSE_MS = 600;
  const MIN_TURNS = 5;

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const uuid = () =>
    window.crypto?.randomUUID?.() ||
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });

  const escapeHtml = (value) =>
    String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  // "Dec 31" in US Eastern time (the campaign's clock), e.g. from coupon.expiresAt.
  const easternDate = (iso) => {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' }).format(date);
  };

  // Turn the rotor clockwise at least MIN_TURNS times so the won slot's wedge centre sits
  // on the pointer at 6 o'clock. Resolves when the wheel has stopped.
  const spinTo = (slot) =>
    new Promise((resolve) => {
      const rotor = $('[data-spin-rotor]');
      const position = Math.max(0, POSITION_SLOTS.indexOf(slot));
      const centre = position * 60 + 30; // clockwise from 12 o'clock
      const landing = (((180 - centre) % 360) + 360) % 360;
      const from = state.rotation;
      let to = from - (((from % 360) + 360) % 360) + MIN_TURNS * 360 + landing;
      if (to - from < MIN_TURNS * 360) to += 360;
      state.rotation = to;
      const ms = window.mtReducedMq?.matches ? SPIN_REDUCED_MS : SPIN_MS;
      if (!rotor) {
        resolve();
        return;
      }
      rotor.style.transition = `transform ${ms}ms cubic-bezier(0.12, 0.6, 0.08, 1)`;
      requestAnimationFrame(() => {
        rotor.style.transform = `rotate(${to}deg)`;
      });
      setTimeout(() => {
        rotor.style.transition = '';
        resolve();
      }, ms + 50);
    });

  const setOnly = (kind) => {
    root.dataset.spinResult = kind; // CSS: 04 and 05 space their shared parts differently
    $$('[data-spin-only]').forEach((el) => {
      el.hidden = el.dataset.spinOnly !== kind;
    });
  };

  const showResult = (prize, spinsLeft) => {
    if (prize.type === 'GIFT' || prize.type === 'GRAND') {
      openGift(prize, spinsLeft);
      return;
    }
    const left = Number(spinsLeft) || 0;
    if (prize.type === 'GIFT_CARD') {
      const card = prize.giftCard || {};
      const amount = `$${prize.name}`;
      setOnly('card');
      $('[data-spin-result-title]').textContent = fill(str.resultGiftCard, { amount });
      $('[data-spin-card-value]').textContent = amount;
      $('[data-spin-card-code]').textContent = card.code || '';
      const recipient = $('[data-spin-recipient]');
      recipient.textContent = card.sentTo ? fill(str.sentTo, { email: card.sentTo }) : '';
      recipient.hidden = !card.sentTo;
      $('[data-spin-result-terms]').innerHTML = fill(str.cardTerms, { order: escapeHtml(prize.orderName) });
      state.copyCode = card.code || '';
    } else {
      const coupon = prize.coupon || {};
      const date = escapeHtml(easternDate(coupon.expiresAt));
      setOnly('coupon');
      $('[data-spin-result-title]').textContent = fill(str.resultCoupon, { value: prize.name });
      $('[data-spin-code]').textContent = coupon.code || '';
      $('[data-spin-coupon-rule]').textContent = fill(str.couponRule, { date });
      $('[data-spin-result-terms]').innerHTML = fill(str.couponTerms, { date });
      state.copyCode = coupon.code || '';
    }

    const copy = $('[data-spin-copy]');
    copy.hidden = !state.copyCode;
    copy.textContent = copy.dataset.label || (copy.dataset.label = copy.textContent);

    const again = $('[data-spin-again-link]');
    again.hidden = left <= 0;
    again.textContent = plural(left, str.againOne, str.againOther);
    $('[data-spin-again-divider]').hidden = left <= 0;

    stopTimer();
    showState('result');
    const view = $('[data-spin-view="wheel"]');
    view.scrollTop = 0;
    $('.mt-spin__content').scrollTop = 0;
  };

  const showDrawError = (message, retry) => {
    const error = $('[data-spin-draw-error]');
    error.textContent = message;
    error.hidden = false;
    if (retry) $('[data-spin-draw]').textContent = str.tryAgain;
  };

  const handleDrawError = async (err) => {
    const code = err?.code;
    const business = [40101, 40900, 40901, 40902].includes(code);
    if (business) state.requestId = null; // a new attempt is a new operation
    if (code === 40101) {
      showState('guest');
      return;
    }
    if (code === 40902) {
      // Out of spins: refresh 02 so the count and button match, then explain how to earn one.
      try {
        await loadStatus();
        renderPlayer();
      } catch {}
      const threshold = state.status?.spinThreshold;
      showDrawError(threshold ? fill(str.spendRule, { amount: money(threshold) }) : str.drawError, false);
      return;
    }
    if (code === 40901) {
      showDrawError(str.drawEnded, false);
      return;
    }
    if (code === 40900) {
      const date = easternDate(state.status?.activity?.startAt);
      showDrawError(date ? fill(str.drawNotStarted, { date }) : str.drawError, false);
      return;
    }
    // Network, timeout, 42900, 50300…: retry with the same requestId so a spin is never charged twice.
    showDrawError(str.drawError, true);
  };

  const drawSpin = async () => {
    if (state.busy || !loggedIn()) return;
    state.busy = true;
    root.dataset.spinBusy = '';
    $('[data-spin-draw-error]').hidden = true;
    state.requestId = state.requestId || uuid();
    const token = ++state.drawToken;
    const current = () => token === state.drawToken;
    try {
      const data = await api('/draw', { requestId: state.requestId });
      state.requestId = null;
      if (state.status) state.status.spinsLeft = data.spinsLeft;
      state.stale = true;
      state.counts = { unused: null, used: null };
      if (!current()) return;
      await spinTo(data.slot);
      if (!current()) return;
      await wait(RESULT_PAUSE_MS);
      if (!current()) return;
      showResult(data.prize || {}, data.spinsLeft);
    } catch (err) {
      if (current()) await handleDrawError(err);
    } finally {
      if (current()) {
        state.busy = false;
        delete root.dataset.spinBusy;
      }
    }
  };

  const copyCode = async (button) => {
    if (!state.copyCode) return;
    try {
      await navigator.clipboard.writeText(state.copyCode);
    } catch {
      const field = document.createElement('textarea');
      field.value = state.copyCode;
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
    }, 2000);
  };

  // ---------- 03 FREE OUTFIT / 04b SHERPA JACKET: gift selection ----------
  // One flow for both: GET gift-options, pick style (outfit only) → color → size per gift,
  // POST the chosen skus. Picks are kept by styleNo / color name so a refreshed option list
  // (40910 "size just taken") can keep whatever is still available.

  const desktopMq = window.matchMedia('(min-width: 990px)');
  const gift = {
    prize: null,
    styles: [],
    picks: [], // [{ styleNo, color, size }]
    spinsLeft: 0,
    requestId: null, // kept across retries of the same submit
    busy: false,
    error: '', // html shown under CONFIRM after a failed submit; cleared by the next pick
    token: 0, // bumped per options load so a stale response is ignored
  };

  const isJacket = () => root.dataset.spinGift === 'jacket';

  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  };

  // Shopify's handleize, enough for color names ("Midnight Blue" → "midnight-blue").
  const handleize = (value) =>
    String(value)
      .toLowerCase()
      .replace(/['"’]/g, '')
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-+|-+$/g, '');

  // Same priority as snippets/color-swatch.liquid (quick shop / PDP): mapping (HEX or Files
  // filename) → "<handle>.png" in Files, with off-white showing through when it 404s.
  const swatchFor = (name) => {
    const fileUrl = (filename) =>
      `url('${String(config.swatchFile || '').replace('mt-swatch-file.png', encodeURIComponent(filename))}')`;
    const custom = config.swatches?.[String(name).trim().toLowerCase()];
    if (custom && custom.includes('.')) return fileUrl(custom);
    if (custom) return custom;
    return `${fileUrl(`${handleize(name)}.png`)} var(--mt-off-white)`;
  };

  const sizedImage = (url, width) => {
    if (!url) return '';
    try {
      const parsed = new URL(url, window.location.href);
      if (parsed.hostname.endsWith('cdn.shopify.com') || parsed.pathname.includes('/cdn/shop/')) {
        parsed.searchParams.set('width', width);
      }
      return parsed.href;
    } catch {
      return url;
    }
  };

  const colorInStock = (color) => (color?.sizes || []).some((size) => size.available);
  const styleInStock = (style) => (style?.colors || []).some(colorInStock);

  const pickParts = (pick) => {
    const style = gift.styles.find((s) => s.styleNo === pick.styleNo);
    const color = style?.colors?.find((c) => c.name === pick.color);
    const size = color?.sizes?.find((s) => s.size === pick.size && s.available);
    return { style, color, size };
  };
  // 0 = no style, 1 = no color, 2 = no size, 3 = complete
  const pickLevel = (pick) => {
    const { style, color, size } = pickParts(pick);
    if (!style) return 0;
    if (!color) return 1;
    return size ? 3 : 2;
  };

  const buildPick = (index) => {
    const jacket = isJacket();
    const section = el('section', 'mt-spin__pick');
    section.dataset.giftPick = index;
    let step = 1;
    if (!jacket) {
      const row = el('div', 'mt-spin__pick-row');
      // "18 styles · swipe ›" also pages the strip on click (mouse users can't swipe).
      const nav = el('button', 'mt-spin__pick-nav', fill(str.stylesNav, { count: gift.styles.length }));
      nav.type = 'button';
      nav.dataset.giftNav = index;
      row.append(el('p', 'mt-spin__pick-step', fill(str.stepStyle, { step: step++ })), nav);
      const list = el('div', 'mt-spin__styles');
      gift.styles.forEach((style) => {
        const out = !styleInStock(style);
        const button = el('button', 'mt-spin__style');
        button.type = 'button';
        button.dataset.giftStyle = style.styleNo;
        button.dataset.giftIndex = index;
        button.disabled = out;
        button.setAttribute('aria-label', [style.title, out ? str.soldOut : ''].filter(Boolean).join(' · '));
        const thumb = el('span', 'mt-spin__style-thumb');
        if (style.image) {
          const img = el('img');
          img.src = sizedImage(style.image, 240);
          img.alt = '';
          img.width = 84;
          img.height = 108;
          img.loading = 'lazy';
          thumb.append(img);
        }
        if (out) thumb.append(el('span', 'mt-spin__style-out', str.soldOut));
        button.append(thumb, el('span', 'mt-spin__style-name', style.category || ''));
        list.append(button);
      });

      const chosen = el('div', 'mt-spin__chosen');
      chosen.dataset.giftChosen = '';
      chosen.hidden = true;
      const box = el('span', 'mt-spin__chosen-box');
      const img = el('img');
      img.alt = '';
      img.width = 44;
      img.height = 44;
      box.append(img);
      const text = el('span', 'mt-spin__chosen-text');
      text.append(el('span', 'mt-spin__chosen-name'), el('span', 'mt-spin__chosen-value'));
      chosen.append(box, text);

      section.append(el('p', 'mt-spin__pick-label', fill(str.giftOf, { number: index + 1 })), row, list, chosen);
    }

    const colorLabel = el('p', 'mt-spin__pick-step mt-spin__pick-step--color');
    colorLabel.dataset.giftColorLabel = step++;
    const colors = el('div', 'mt-spin__colors');
    colors.dataset.giftColors = '';
    const sizeRow = el('div', 'mt-spin__pick-row mt-spin__pick-row--size');
    const guide = el('button', 'mt-spin__pick-guide', str.sizeGuide);
    guide.type = 'button';
    guide.dataset.giftGuide = '';
    guide.hidden = true;
    sizeRow.append(el('p', 'mt-spin__pick-step', fill(str.stepSize, { step: step++ })), guide);
    const sizes = el('div', 'mt-spin__sizes');
    sizes.dataset.giftSizes = '';
    section.append(colorLabel, colors, sizeRow, sizes);
    return section;
  };

  const updatePick = (index) => {
    const section = $(`[data-gift-pick="${index}"]`);
    if (!section) return;
    const pick = gift.picks[index];
    const { style, color } = pickParts(pick);

    section.querySelectorAll('[data-gift-style]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.giftStyle === pick.styleNo));
    });
    const chosen = section.querySelector('[data-gift-chosen]');
    if (chosen) {
      chosen.hidden = !style;
      if (style) {
        const img = chosen.querySelector('img');
        img.hidden = !style.image;
        if (style.image) img.src = sizedImage(style.image, 120);
        chosen.querySelector('.mt-spin__chosen-name').textContent = style.title || '';
        chosen.querySelector('.mt-spin__chosen-value').textContent = fill(str.giftValue, { amount: money(style.value) });
      }
    }

    const label = section.querySelector('[data-gift-color-label]');
    label.textContent = fill(str.stepColor, { step: label.dataset.giftColorLabel }) + (color ? ` · ${color.name}` : '');

    section.querySelector('[data-gift-colors]').replaceChildren(
      ...(style?.colors || []).map((c) => {
        const button = el('button', 'mt-spin__color');
        button.type = 'button';
        button.dataset.giftColor = c.name;
        button.dataset.giftIndex = index;
        button.style.setProperty('--mt-swatch', swatchFor(c.name));
        button.setAttribute('aria-label', c.name);
        button.setAttribute('aria-pressed', String(c === color));
        return button;
      }),
    );

    section.querySelector('[data-gift-sizes]').replaceChildren(
      ...(color?.sizes || []).map((s) => {
        const button = el('button', 'mt-spin__size', s.size);
        button.type = 'button';
        button.dataset.giftSize = s.size;
        button.dataset.giftIndex = index;
        button.disabled = !s.available;
        button.setAttribute('aria-pressed', String(s.available && s.size === pick.size));
        return button;
      }),
    );

    // sizeChart cloth / legging / shoe; missing or unknown → cloth (same pages as the PDP).
    const charts = config.sizeCharts || {};
    const chart = style ? charts[style.sizeChart] || charts.cloth : null;
    const guide = section.querySelector('[data-gift-guide]');
    guide.hidden = !chart;
    if (chart) guide.dataset.chartOpen = chart;
  };

  // Only the first unfinished step is named; when both gifts are stuck on it, one sentence covers both.
  const giftHint = (levels) => {
    const min = Math.min(...levels);
    if (min === 3) return '';
    if (isJacket()) return min <= 1 ? str.hintColorOne : str.hintSizeOne;
    const stuck = levels.map((level, i) => (level === min ? i + 1 : 0)).filter(Boolean);
    const both = stuck.length > 1;
    if (min === 0) return both ? str.hintPickAll : fill(str.hintStyle, { number: stuck[0] });
    if (min === 1) return both ? str.hintColorBoth : fill(str.hintColor, { number: stuck[0] });
    return both ? str.hintSizeBoth : fill(str.hintSize, { number: stuck[0] });
  };

  const renderGiftNotes = (complete) => {
    const lines = [escapeHtml(str.noteSoldOut)];
    if (isJacket()) lines.push(escapeHtml(str.noteShipsBf));
    let ships = escapeHtml(fill(str.noteShips, { order: gift.prize.orderName || '' }));
    // The return line (with the picked styles' total value) only shows once CONFIRM can be sent.
    if (complete) {
      const total = gift.picks.reduce((sum, pick) => sum + (Number(pickParts(pick).style?.value) || 0), 0);
      const sentence = escapeHtml(fill(str.noteReturn, { amount: money(total) }));
      ships += (isJacket() ? '<br class="mt-spin__br-desktop"> ' : ' ') + sentence;
    }
    lines.push(ships);
    $('[data-gift-notes]').innerHTML = lines.join('<br>');
  };

  const updateGift = () => {
    gift.picks.forEach((_, i) => updatePick(i));

    // A style is always pre-selected, so a tile swaps the "?" box for the product image only
    // once that gift is fully chosen (size picked).
    $$('[data-gift-tile]').forEach((tile) => {
      const pick = gift.picks[Number(tile.dataset.giftTile)];
      const { style } = pick && pickLevel(pick) === 3 ? pickParts(pick) : {};
      const img = tile.querySelector('[data-gift-tile-img]');
      const src = style?.image ? sizedImage(style.image, 320) : '';
      img.hidden = !src;
      if (src && img.getAttribute('src') !== src) img.src = src;
      tile.classList.toggle('is-picked', Boolean(src));
    });
    const prizeImg = $('[data-gift-prize-img]');
    const prizeSrc = isJacket() && gift.styles[0]?.image ? sizedImage(gift.styles[0].image, 240) : '';
    prizeImg.hidden = !prizeSrc;
    if (prizeSrc) prizeImg.src = prizeSrc;

    const levels = gift.picks.map(pickLevel);
    const complete = levels.length > 0 && levels.every((level) => level === 3);
    const confirm = $('[data-gift-confirm]');
    confirm.textContent = isJacket() ? str.confirmJacket : str.confirmOutfit;
    confirm.disabled = !complete || gift.busy;

    const message = gift.error || (levels.length ? escapeHtml(giftHint(levels)) : '');
    const msg = $('[data-gift-msg]');
    msg.innerHTML = message;
    msg.hidden = !message;

    renderGiftNotes(complete);
    updateGiftCue();
  };

  // Desktop 04b: "Scroll to choose color & size" floats over the bottom of the right column
  // until the column is scrolled (mobile and 03 show the cue inline instead).
  const updateGiftCue = () => {
    const overlay = $('[data-gift-overlay]');
    if (!overlay) return;
    const content = $('.mt-spin__content');
    overlay.hidden = !(
      root.dataset.spinState === 'gift' &&
      isJacket() &&
      desktopMq.matches &&
      content.scrollHeight > content.clientHeight + 1 &&
      content.scrollTop < 8
    );
  };

  const scrollToGift = (index, part) => {
    const pick = $(`[data-gift-pick="${index}"]`);
    const target = (part && pick?.querySelector(part)) || pick || $('[data-gift-picks]');
    target?.scrollIntoView({ behavior: window.mtReducedMq?.matches ? 'auto' : 'smooth', block: 'start' });
  };

  const loadGiftOptions = async (keepPicks) => {
    const token = ++gift.token;
    $('[data-gift-load]').hidden = true;
    try {
      const data = await api(`/prizes/${encodeURIComponent(gift.prize.prizeId)}/gift-options`);
      if (token !== gift.token) return false;
      gift.styles = data.styles || [];
      const count = isJacket() ? 1 : 2;
      let cleared = -1;
      if (keepPicks && gift.picks.length === count) {
        // Drop only what the refresh made unavailable.
        gift.picks.forEach((pick, i) => {
          const { style, color, size } = pickParts(pick);
          if (!style) Object.assign(pick, { styleNo: null, color: null, size: null });
          else if (!color) Object.assign(pick, { color: null, size: null });
          if (pick.size && !size) {
            pick.size = null;
            if (cleared < 0) cleared = i;
          }
        });
      } else {
        // Every gift starts on the first style with stock and its first color with stock; size stays empty.
        const style = gift.styles.find(styleInStock) || gift.styles[0];
        const color = style?.colors?.find(colorInStock) || style?.colors?.[0];
        gift.picks = Array.from({ length: count }, () => ({
          styleNo: style?.styleNo || null,
          color: color?.name || null,
          size: null,
        }));
      }
      if (!isJacket()) {
        $('[data-gift-sub]').textContent = fill(str.giftSubOutfit, {
          total: gift.styles.length,
          order: gift.prize.orderName || '',
        });
      }
      $('[data-gift-picks]').replaceChildren(...gift.picks.map((_, i) => buildPick(i)));
      updateGift();
      return cleared;
    } catch {
      if (token !== gift.token) return false;
      $('[data-gift-load]').hidden = false;
      return false;
    }
  };

  const openGift = (prize, spinsLeft) => {
    gift.prize = prize;
    gift.spinsLeft = Number(spinsLeft) || 0;
    gift.styles = [];
    gift.picks = [];
    gift.requestId = null;
    gift.busy = false;
    gift.error = '';
    const jacket = prize.type === 'GRAND';
    root.dataset.spinGift = jacket ? 'jacket' : 'outfit';
    $('[data-gift-title]').textContent = prize.name || '';
    $('[data-gift-sub]').textContent = jacket ? fill(str.giftSubJacket, { order: prize.orderName || '' }) : '';
    $('[data-gift-prize-name]').textContent = prize.name || '';
    $('[data-gift-picks]').replaceChildren();

    const left = gift.spinsLeft;
    const again = $('[data-gift-again]');
    again.hidden = left <= 0;
    again.textContent = plural(left, str.againOne, str.againOther);
    $('[data-gift-again-divider]').hidden = left <= 0;

    updateGift();
    stopTimer();
    showState('gift');
    $('[data-spin-view="wheel"]').scrollTop = 0;
    $('.mt-spin__content').scrollTop = 0;
    loadGiftOptions(false);
  };

  const selectStyle = (index, styleNo) => {
    const pick = gift.picks[index];
    const style = gift.styles.find((s) => s.styleNo === styleNo);
    if (!pick || !style || !styleInStock(style) || pick.styleNo === styleNo) return;
    // First color with stock; a size already picked stays if the new style has it in stock.
    const color = style.colors.find(colorInStock);
    const keepSize = pick.size && color.sizes.some((s) => s.size === pick.size && s.available);
    Object.assign(pick, { styleNo, color: color.name, size: keepSize ? pick.size : null });
    gift.error = '';
    updateGift();
  };

  const selectColor = (index, name) => {
    const pick = gift.picks[index];
    const color = pick && pickParts(pick).style?.colors?.find((c) => c.name === name);
    if (!color) return;
    pick.color = name;
    if (!color.sizes.some((s) => s.size === pick.size && s.available)) pick.size = null;
    gift.error = '';
    updateGift();
  };

  const selectSize = (index, size) => {
    const pick = gift.picks[index];
    const color = pick && pickParts(pick).color;
    if (!color?.sizes.some((s) => s.size === size && s.available)) return;
    pick.size = size;
    gift.error = '';
    updateGift();
  };

  const handleGiftError = async (err) => {
    const code = err?.code;
    if ([40000, 40101, 40400, 40910, 40911, 40912, 40913].includes(code)) gift.requestId = null;
    if (code === 40101) {
      showState('guest');
      return;
    }
    if (code === 40911 || code === 40400) {
      // Already chosen (or gone): My prizes shows where it stands.
      state.counts = { unused: null, used: null };
      showView('prizes');
      return;
    }
    if (code === 40910) {
      const cleared = await loadGiftOptions(true);
      gift.error = escapeHtml(str.giftTaken);
      if (cleared >= 0) scrollToGift(cleared, '[data-gift-sizes]');
      return;
    }
    if (code === 40912) {
      gift.error = str.giftDeadline; // locale html (mailto link)
      return;
    }
    if (code === 40913 || code === 40000) {
      gift.error = escapeHtml(str.giftInvalid);
      return;
    }
    // Network, timeout, 42900, 50300…: CONFIRM again reuses the requestId.
    gift.error = escapeHtml(str.giftNetwork);
  };

  const submitGift = async () => {
    if (gift.busy || !gift.prize) return;
    const parts = gift.picks.map(pickParts);
    if (!parts.length || parts.some((part) => !part.size)) return;
    gift.busy = true;
    gift.error = '';
    root.dataset.giftBusy = '';
    updateGift();
    gift.requestId = gift.requestId || uuid();
    try {
      await api(`/prizes/${encodeURIComponent(gift.prize.prizeId)}/gift-selection`, {
        requestId: gift.requestId,
        skus: parts.map((part) => part.size.sku),
      });
      gift.requestId = null;
      gift.prize = null;
      state.counts = { unused: null, used: null };
      state.tab = 'unused';
      showView('prizes');
    } catch (err) {
      await handleGiftError(err);
    } finally {
      gift.busy = false;
      delete root.dataset.giftBusy;
      if (gift.prize && root.dataset.spinState === 'gift') updateGift();
    }
  };

  // Clicks inside the gift pickers; returns true when handled.
  const giftClick = (target) => {
    const style = target.closest('[data-gift-style]');
    if (style) {
      selectStyle(Number(style.dataset.giftIndex), style.dataset.giftStyle);
      return true;
    }
    const color = target.closest('[data-gift-color]');
    if (color) {
      const index = Number(color.dataset.giftIndex);
      selectColor(index, color.dataset.giftColor);
      $(`[data-gift-pick="${index}"] [data-gift-color="${CSS.escape(color.dataset.giftColor)}"]`)?.focus({ preventScroll: true });
      return true;
    }
    const size = target.closest('[data-gift-size]');
    if (size) {
      const index = Number(size.dataset.giftIndex);
      selectSize(index, size.dataset.giftSize);
      $(`[data-gift-pick="${index}"] [data-gift-size="${CSS.escape(size.dataset.giftSize)}"]`)?.focus({ preventScroll: true });
      return true;
    }
    const nav = target.closest('[data-gift-nav]');
    if (nav) {
      // One visible width to the right; back to the start once the end is reached.
      const strip = $(`[data-gift-pick="${nav.dataset.giftNav}"] .mt-spin__styles`);
      if (strip) {
        const atEnd = strip.scrollLeft + strip.clientWidth >= strip.scrollWidth - 2;
        strip.scrollTo({
          left: atEnd ? 0 : strip.scrollLeft + strip.clientWidth * 0.9,
          behavior: window.mtReducedMq?.matches ? 'auto' : 'smooth',
        });
      }
      return true;
    }
    const scroll = target.closest('[data-gift-scroll]');
    if (scroll) {
      scrollToGift(Number(scroll.dataset.giftScroll) || 0);
      return true;
    }
    if (target.closest('[data-gift-confirm]')) {
      submitGift();
      return true;
    }
    if (target.closest('[data-gift-reload]')) {
      loadGiftOptions(false);
      return true;
    }
    return false;
  };

  // ---------- prizes view ----------

  const renderTabs = () => {
    $$('[data-spin-tab]').forEach((tab) => {
      const key = tab.dataset.spinTab;
      const count = state.counts[key];
      const template = key === 'unused' ? str.tabUnused : str.tabUsed;
      tab.textContent = count == null ? template.replace(/\s*·\s*\[count\]/, '') : fill(template, { count });
      tab.setAttribute('aria-selected', String(key === state.tab));
    });
    $$('[data-spin-note]').forEach((note) => {
      note.hidden = note.dataset.spinNote !== state.tab;
    });
  };

  const fillPrizesView = async () => {
    const left = Number(state.status?.spinsLeft) || 0;
    $('[data-spin-again]').hidden = left <= 0;
    $('[data-spin-again-text]').textContent = plural(left, str.spinsLeftOne, str.spinsLeftOther);
    $('[data-spin-prizes-error]').hidden = true;
    renderTabs();
    const [unused, used] = await Promise.allSettled([api('/prizes?tab=unused'), api('/prizes?tab=used')]);
    if (unused.status === 'fulfilled') state.counts.unused = unused.value.items?.length || 0;
    if (used.status === 'fulfilled') state.counts.used = used.value.items?.length || 0;
    if (unused.status === 'rejected' && used.status === 'rejected') $('[data-spin-prizes-error]').hidden = false;
    renderTabs();
  };

  // ---------- dialog ----------

  const showView = (name) => {
    // Back on 02 (SPIN AGAIN, reopening…) the wheel starts upright again.
    if (name === 'wheel' && !state.busy) state.rotation = 0;
    root.dataset.spinCurrent = name; // CSS: the close button differs between 01/02 and 06/07
    $$('[data-spin-view]').forEach((view) => {
      view.hidden = view.dataset.spinView !== name;
    });
    if (name === 'prizes') fillPrizesView();
    else fillWheelView();
  };

  const isOpen = () => !root.hidden && root.classList.contains('mt-spin--open');

  const open = (view = 'wheel') => {
    if (!root) return;
    const target = view === 'prizes' && loggedIn() ? 'prizes' : 'wheel';
    showView(target);
    if (isOpen()) return;
    root.hidden = false;
    document.documentElement.classList.add('mt-spin-lock');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => root.classList.add('mt-spin--open'));
    });
    $('[data-spin-panel]').focus({ preventScroll: true });
  };

  const close = () => {
    if (root.hidden) return;
    root.classList.remove('mt-spin--open');
    document.documentElement.classList.remove('mt-spin-lock');
    stopTimer();
    if (state.busy) {
      // Closing mid-spin: the prize is already saved server-side (My prizes); drop the animation.
      state.drawToken += 1;
      state.busy = false;
      state.stale = true;
      delete root.dataset.spinBusy;
    }
    const finish = () => {
      root.hidden = true;
    };
    if (window.mtReducedMq?.matches) finish();
    else setTimeout(finish, 300);
    state.trigger?.focus({ preventScroll: true });
    state.trigger = null;
  };

  window.mtSpin = { open, close };

  // ---------- auto-open ----------

  const prizesShownThisSession = () => {
    try {
      return sessionStorage.getItem(SESSION_KEY) === '1';
    } catch {
      return true;
    }
  };

  const markPrizesShown = () => {
    try {
      sessionStorage.setItem(SESSION_KEY, '1');
    } catch {}
  };

  const autoOpen = async () => {
    if (!loggedIn()) return;
    try {
      const status = await loadStatus();
      if (Number(status.spinsLeft) > 0) {
        open('wheel');
        return;
      }
      if (prizesShownThisSession()) return;
      const unused = await api('/prizes?tab=unused');
      if (unused.items?.length) {
        markPrizesShown();
        open('prizes');
      }
    } catch {
      // Status or prizes unavailable: stay quiet on the landing page.
    }
  };

  // ?spin_mock=… loads fake data — never on the live (role "main") theme.
  const loadMock = () =>
    new Promise((resolve) => {
      const role = window.Shopify?.theme?.role;
      const mock = new URLSearchParams(window.location.search).get('spin_mock');
      if (!mock || !role || role === 'main') {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = root.dataset.mockSrc;
      script.onload = resolve;
      script.onerror = resolve;
      document.head.append(script);
    });

  // ---------- always-visible scrollbar on touch devices ----------
  // Touch browsers use overlay scrollbars that fade out and can't be styled, so the CSS
  // hides them there and we draw a thin track + thumb for every scroll area instead.
  // (Hover-capable browsers get a styled native scrollbar from CSS, which never hides.)

  const setupScrollbars = () => {
    if (!window.matchMedia('(hover: none)').matches || !('ResizeObserver' in window)) return;
    const panel = $('[data-spin-panel]');
    const scrollers = $$('[data-spin-scroll]');
    const bars = scrollers.map(() => {
      const bar = document.createElement('div');
      bar.className = 'mt-spin__bar';
      bar.setAttribute('aria-hidden', 'true');
      bar.hidden = true;
      bar.append(document.createElement('span'));
      panel.append(bar);
      return bar;
    });

    const update = () => {
      if (root.hidden) return;
      const box = panel.getBoundingClientRect();
      scrollers.forEach((el, i) => {
        const bar = bars[i];
        const scrollable =
          el.offsetParent !== null &&
          /(auto|scroll)/.test(getComputedStyle(el).overflowY) &&
          el.scrollHeight > el.clientHeight + 1;
        bar.hidden = !scrollable;
        if (!scrollable) return;
        const rect = el.getBoundingClientRect();
        const inset = 4;
        const track = el.clientHeight - inset * 2;
        const thumb = Math.max(24, (track * el.clientHeight) / el.scrollHeight);
        const max = el.scrollHeight - el.clientHeight;
        bar.style.top = `${rect.top - box.top + inset}px`;
        bar.style.height = `${track}px`;
        bar.style.right = `${box.right - rect.right + 3}px`;
        bar.firstChild.style.height = `${thumb}px`;
        bar.firstChild.style.transform = `translateY(${(el.scrollTop / max) * (track - thumb)}px)`;
      });
    };

    const observer = new ResizeObserver(() => requestAnimationFrame(update));
    scrollers.forEach((el) => {
      el.addEventListener('scroll', update, { passive: true });
      observer.observe(el);
      [...el.children].forEach((child) => observer.observe(child));
    });
    window.addEventListener('resize', update);
  };

  // ---------- events ----------

  if (root && !root.hasAttribute('data-design-mode')) {
    setupScrollbars();
    loadMock().then(autoOpen);

    document.addEventListener('click', (event) => {
      const opener = event.target.closest?.('[data-spin-open]');
      if (opener) {
        event.preventDefault();
        state.trigger = window.mtKeyboardFocus?.(opener) ? opener : null;
        open(opener.dataset.spinOpen || 'wheel');
        return;
      }
      if (root.hidden) return;
      if (event.target.closest?.('[data-spin-close]')) {
        close();
        return;
      }
      if (event.target.closest?.('[data-spin-draw]')) {
        drawSpin();
        return;
      }
      const copy = event.target.closest?.('[data-spin-copy]');
      if (copy) {
        copyCode(copy);
        return;
      }
      if (giftClick(event.target)) return;
      const go = event.target.closest?.('[data-spin-go]');
      if (go) {
        showView(go.dataset.spinGo);
        return;
      }
      const tab = event.target.closest?.('[data-spin-tab]');
      if (tab) {
        state.tab = tab.dataset.spinTab;
        renderTabs();
      }
    });

    $('.mt-spin__content').addEventListener('scroll', updateGiftCue, { passive: true });
    desktopMq.addEventListener?.('change', updateGiftCue);

    document.addEventListener('keydown', (event) => {
      // A size chart opened from the gift pickers sits on top and handles its own keys.
      if (root.hidden || document.querySelector('.mt-chart:not([hidden])')) return;
      if (event.key === 'Escape') {
        close();
        return;
      }
      if (event.key === 'Tab') {
        window.mtFocusTrap?.(event, $('[data-spin-panel]'), 'button:not(:disabled), a[href]');
      }
    });
  }
}
