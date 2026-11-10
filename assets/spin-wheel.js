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
  };

  const loggedIn = () => root.hasAttribute('data-logged-in');
  const $ = (selector) => root.querySelector(selector);
  const $$ = (selector) => [...root.querySelectorAll(selector)];

  // ---------- data ----------

  const api = async (path) => {
    if (window.mtSpinMock) return window.mtSpinMock(path);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(root.dataset.prefix + path, {
        headers: { Accept: 'application/json' },
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

  // Label for one wedge, centred on (x, y). Sizes are in wheel units (viewBox 340).
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
    const c = 170;
    const r = 160;
    const wheel = svg('svg', { viewBox: '0 0 340 364', class: 'mt-spin__svg', 'aria-hidden': 'true' });
    const rotor = svg('g', { class: 'mt-spin__rotor', 'data-spin-rotor': '' });
    rotor.append(svg('circle', { cx: c, cy: c, r: 166, class: 'mt-spin__rim' }));
    POSITION_SLOTS.forEach((slotId, i) => {
      const a0 = ((i * 60 - 90) * Math.PI) / 180;
      const a1 = (((i + 1) * 60 - 90) * Math.PI) / 180;
      const d = `M${c},${c} L${c + r * Math.cos(a0)},${c + r * Math.sin(a0)} A${r},${r} 0 0 1 ${c + r * Math.cos(a1)},${c + r * Math.sin(a1)} Z`;
      rotor.append(svg('path', { d, class: `mt-spin__wedge mt-spin__wedge--${POSITION_FILLS[i]}` }));
      const mid = (((i + 0.5) * 60 - 90) * Math.PI) / 180;
      const slot = bySlot[slotId] || FALLBACK_SLOTS[slotId];
      rotor.append(
        wedgeLabel(slot, c + 92 * Math.cos(mid), c + 92 * Math.sin(mid), POSITION_FILLS[i] === 'accent' ? 'is-inverse' : ''),
      );
    });
    wheel.append(rotor);
    wheel.append(svg('path', { d: 'M170 318 L189 352 L151 352 Z', class: 'mt-spin__pointer' }));
    $('[data-spin-wheel]').replaceChildren(wheel);

    const threshold = state.status?.spinThreshold;
    $$('[data-spin-rule]').forEach((el) => {
      el.textContent = threshold ? fill(str.earningRule, { amount: money(threshold) }) : '';
    });
  };

  // ---------- wheel view states ----------

  const showState = (name) => {
    $$('[data-spin-state]').forEach((el) => {
      el.hidden = el.dataset.spinState !== name;
    });
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
      .join(' ');

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
    if (state.status) {
      renderPlayer();
      return;
    }
    showState(null);
    try {
      await loadStatus();
      renderWheel();
      renderPlayer();
    } catch {
      showState('error');
    }
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

  // ---------- events ----------

  if (root && !root.hasAttribute('data-design-mode')) {
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

    document.addEventListener('keydown', (event) => {
      if (root.hidden) return;
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
