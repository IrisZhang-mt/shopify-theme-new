if (!window.mtCountdownInit) {
  window.mtCountdownInit = true;

  const ZONE = 'America/Los_Angeles';
  const timers = new WeakMap();

  const zoneParts = new Intl.DateTimeFormat('en-US', {
    timeZone: ZONE,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  // Milliseconds the zone is ahead of UTC at a given instant (negative for US Pacific).
  const zoneOffset = (ms) => {
    const p = Object.fromEntries(zoneParts.formatToParts(ms).map(({ type, value }) => [type, Number(value)]));
    return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(ms / 1000) * 1000;
  };

  // "YYYY-MM-DD HH:MM" as US Pacific wall-clock time → epoch ms, DST-aware.
  const parseEnd = (value) => {
    const m = /^(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{2})$/.exec(value.trim());
    if (!m) return NaN;
    const wall = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
    const guess = wall - zoneOffset(wall);
    return wall - zoneOffset(guess);
  };

  const pad = (n) => String(n).padStart(2, '0');

  const render = (el, end) => {
    const left = Math.max(0, Math.floor((end - Date.now()) / 1000));
    el.querySelector('[data-countdown-days]').textContent = Math.floor(left / 86400);
    el.querySelector('[data-countdown-hours]').textContent = pad(Math.floor((left % 86400) / 3600));
    el.querySelector('[data-countdown-minutes]').textContent = pad(Math.floor((left % 3600) / 60));
    el.querySelector('[data-countdown-seconds]').textContent = pad(left % 60);
    el.dataset.countdownReady = '';
    return left;
  };

  const stop = (el) => {
    clearTimeout(timers.get(el));
    timers.delete(el);
  };

  // Each tick re-reads the clock and lands on the next whole second,
  // so background-tab throttling never makes the display drift.
  const start = (el) => {
    stop(el);
    const end = parseEnd(el.dataset.countdownEnd || '');
    if (Number.isNaN(end)) return;
    const tick = () => {
      if (!el.isConnected || render(el, end) === 0) return timers.delete(el);
      timers.set(el, setTimeout(tick, 1000 - (Date.now() % 1000) + 20));
    };
    tick();
  };

  const scan = () => document.querySelectorAll('[data-countdown]').forEach(start);

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) scan();
  });
  document.addEventListener('shopify:section:load', scan);
  document.addEventListener('shopify:section:unload', (event) => {
    event.target.querySelectorAll?.('[data-countdown]').forEach(stop);
  });

  scan();
}
