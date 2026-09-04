if (!window.mtFooterInit) {
  window.mtFooterInit = true;

  const followMq = window.matchMedia('(hover: hover) and (pointer: fine)');
  const reducedMq = window.mtReducedMq;

  let club = null;
  let mark = null;
  let raf = 0;
  let last = 0;
  const cur = { x: 0, y: 0 };
  const tgt = { x: 0, y: 0 };

  const step = (now) => {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    const k = 1 - Math.exp(-8 * dt);
    cur.x += (tgt.x - cur.x) * k;
    cur.y += (tgt.y - cur.y) * k;
    if (Math.abs(tgt.x - cur.x) < 0.3) cur.x = tgt.x;
    if (Math.abs(tgt.y - cur.y) < 0.3) cur.y = tgt.y;
    mark.style.transform = `translate3d(${cur.x}px, ${cur.y}px, 0) rotate(15deg)`;
    if (cur.x === tgt.x && cur.y === tgt.y) {
      if (!club) {
        mark.style.transform = '';
        mark = null;
      }
      raf = 0;
      return;
    }
    raf = requestAnimationFrame(step);
  };

  const start = () => {
    if (raf || !mark) return;
    last = performance.now();
    raf = requestAnimationFrame(step);
  };

  const release = () => {
    if (!club) return;
    club.classList.remove('mt-footer__club--follow');
    club = null;
    tgt.x = 0;
    tgt.y = 0;
    start();
  };

  document.addEventListener('mousemove', (event) => {
    if (!followMq.matches || reducedMq.matches) return;
    const target = event.target.closest?.('.mt-footer__club');
    if (!target) {
      release();
      return;
    }
    const targetMark = target.querySelector('.mt-footer__mark');
    if (!targetMark) return;
    if (mark && mark !== targetMark) {
      mark.style.transform = '';
      cur.x = 0;
      cur.y = 0;
    }
    mark = targetMark;
    club = target;
    club.classList.add('mt-footer__club--follow');
    const rect = mark.getBoundingClientRect();
    tgt.x = event.clientX - (rect.left + rect.width / 2 - cur.x);
    tgt.y = event.clientY - (rect.top + rect.height / 2 - cur.y);
    start();
  });

  document.addEventListener('mouseout', (event) => {
    if (club && !club.contains(event.relatedTarget)) release();
  });

  document.addEventListener('change', (event) => {
    const select = event.target.closest?.('.mt-footer__pill select');
    select?.form?.submit();
  });

  const msg = document.querySelector('.mt-footer__form-msg');
  msg?.closest('.mt-footer__signup')?.scrollIntoView({ block: 'center', behavior: 'instant' });
}
