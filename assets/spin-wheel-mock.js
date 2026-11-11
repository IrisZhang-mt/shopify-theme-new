// Fake App Proxy responses for ?spin_mock=… — loaded by spin-wheel.js only on non-live themes.
//   spins   → 2 spins left (auto-opens 02)
//   nospin  → 0 spins, unused prizes (auto-opens 06 once per session)
//   none    → 0 spins, no prizes (nothing auto-opens; manual open shows 02 at 0)
//   error   → every request fails
// &spin_draw=… picks what SPIN NOW wins (default coupon10):
//   coupon10 | coupon15 | giftcard25 | giftcard50 | gift | grand
//   nospins (40902) | ended (40901) | busy (50300, retry keeps the requestId) | login (40101)
// &spin_gift=… (after winning gift / grand) picks what CONFIRM does — see giftSelect below.
(() => {
  const params = new URLSearchParams(window.location.search);
  const scenario = params.get('spin_mock') || 'spins';
  const drawCase = params.get('spin_draw') || 'coupon10';
  let spinsLeft = scenario === 'spins' ? 2 : 0;
  const now = Date.now();
  const iso = (offsetMs) => new Date(now + offsetMs).toISOString().replace(/\.\d+Z$/, 'Z');
  const HOUR = 36e5;

  const slots = [
    { slot: 0, name: '10%', type: 'COUPON' },
    { slot: 1, name: '15%', type: 'COUPON' },
    { slot: 2, name: '25', type: 'GIFT_CARD' },
    { slot: 3, name: '50', type: 'GIFT_CARD' },
    { slot: 4, name: 'FREE OUTFIT', type: 'GIFT' },
    { slot: 5, name: 'SHERPA JACKET', type: 'GRAND' },
  ];

  const groups = {
    spins: [
      { source: 'ORDER', orderName: '#10234', orderAmount: '412.00', spins: 2, spinsUsed: 1, spinsTotal: 3, expiresAt: '2026-12-02T04:59:59Z', allPrizesUntil: iso(41 * 60e3 + 8e3) },
      { source: 'ORDER', orderName: '#10198', orderAmount: '236.00', spins: 0, spinsUsed: 1, spinsTotal: 1, expiresAt: '2026-12-02T04:59:59Z', allPrizesUntil: iso(-2 * HOUR) },
      { source: 'ORDER', orderName: '#10156', orderAmount: '168.50', spins: 0, spinsUsed: 1, spinsTotal: 1, expiresAt: '2026-12-02T04:59:59Z', allPrizesUntil: iso(-30 * HOUR) },
    ],
    used: [
      { source: 'ORDER', orderName: '#10234', orderAmount: '412.00', spins: 0, spinsUsed: 2, spinsTotal: 2, expiresAt: '2026-12-02T04:59:59Z', allPrizesUntil: iso(-1 * HOUR) },
      { source: 'ORDER', orderName: '#10198', orderAmount: '236.00', spins: 0, spinsUsed: 1, spinsTotal: 1, expiresAt: '2026-12-02T04:59:59Z', allPrizesUntil: iso(-2 * HOUR) },
    ],
  };

  const status = () => {
    const spins = scenario === 'spins';
    return {
      serverTime: iso(0),
      activity: { status: 'ONGOING', startAt: '2026-11-21T05:00:00Z', endAt: '2026-12-02T04:59:59Z' },
      slots,
      spinThreshold: '150.00',
      maxSpinsPerOrder: 5,
      loggedIn: true,
      spinsLeft,
      spinGroups: spins ? groups.spins : groups.used,
      pendingActions: 0,
      pendingGifts: [],
      hint: null,
    };
  };

  const unused = [
    { prizeId: 5521, type: 'COUPON', name: '15%', wonAt: iso(-3 * HOUR), orderName: '#10234', status: 'UNUSED', coupon: { code: 'BFSPIN-7K2Q9', startsAt: null, expiresAt: '2027-01-01T04:59:59Z' }, giftCard: null, gift: null },
    { prizeId: 5530, type: 'GIFT', name: 'FREE OUTFIT', wonAt: iso(-3 * HOUR), orderName: '#10234', status: 'TO_SELECT', coupon: null, giftCard: null, gift: { selectDeadline: iso(45 * HOUR), pickCount: 2, items: [] } },
    { prizeId: 5490, type: 'GIFT_CARD', name: '25', wonAt: iso(-50 * HOUR), orderName: '#10198', status: 'ISSUED', coupon: null, giftCard: { status: 'ISSUED', code: 'BFSPIN7K2Q9XX1234', last4: '1234', sentTo: 'e***@gmail.com', balance: '25.00' }, gift: null },
  ];
  const used = [
    { prizeId: 5401, type: 'COUPON', name: '10%', wonAt: iso(-70 * HOUR), orderName: '#10155', status: 'USED', coupon: { code: 'BFSPIN-2M8XA', startsAt: null, expiresAt: '2027-01-01T04:59:59Z' }, giftCard: null, gift: null },
  ];

  const DRAW_ERRORS = { nospins: 40902, ended: 40901, busy: 50300, login: 40101 };
  const prizeFor = (kind) => {
    const base = { prizeId: 10086, wonAt: iso(0), orderName: '#10234', coupon: null, giftCard: null, gift: null };
    const coupon = (name) => ({ ...base, type: 'COUPON', name, status: 'UNUSED', coupon: { code: 'BFSPIN-7K2Q9', startsAt: null, expiresAt: '2027-01-01T04:59:59Z' } });
    const card = (name) => ({ ...base, type: 'GIFT_CARD', name, status: 'ISSUED', giftCard: { status: 'ISSUED', code: 'BFSPIN7K2Q9XX1234', last4: '1234', sentTo: 'e***@gmail.com', balance: `${name}.00` } });
    const gift = (type, name, pickCount) => ({ ...base, type, name, status: 'TO_SELECT', gift: { selectDeadline: iso(48 * HOUR), pickCount, items: [] } });
    return {
      coupon10: [0, coupon('10%')],
      coupon15: [1, coupon('15%')],
      giftcard25: [2, card('25')],
      giftcard50: [3, card('50')],
      gift: [4, gift('GIFT', 'FREE OUTFIT', 2)],
      grand: [5, gift('GRAND', 'SHERPA JACKET', 1)],
    }[kind] || [0, coupon('10%')];
  };
  let busyOnce = true;
  const draw = () => {
    const code = DRAW_ERRORS[drawCase];
    if (code === 50300 && busyOnce) {
      busyOnce = false; // first try fails, the retry succeeds
      throw Object.assign(new Error('spin mock'), { code });
    }
    if (code && code !== 50300) throw Object.assign(new Error('spin mock'), { code });
    if (spinsLeft <= 0) throw Object.assign(new Error('spin mock'), { code: 40902 });
    spinsLeft -= 1;
    const [slot, prize] = prizeFor(code ? 'coupon10' : drawCase);
    return { drawId: 10086, slot, spinsLeft, prize };
  };

  // ---- 03 / 04b gift options + selection ----
  // Thumbnails are flat colour blocks (no real product images in the mock).
  const thumb = (bg, label) =>
    `data:image/svg+xml,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 168 216"><rect width="168" height="216" fill="${bg}"/><text x="84" y="116" font-family="sans-serif" font-size="18" text-anchor="middle" fill="#1d1d1d">${label}</text></svg>`,
    )}`;
  const KID_SIZES = ['3T', '4T', '5', '6', '7', '8', '10', '12'];
  const sizesFor = (styleNo, code, soldOut = []) =>
    KID_SIZES.map((size, i) => ({
      size,
      sku: `${styleNo}-${code}-${size}`,
      variantId: Number(`${styleNo}${i}`),
      available: !soldOut.includes(size),
    }));
  const OUTFIT = [
    ['Leggings', 'Flare Leggings', '#e8dfd0', '55.00', 'legging'],
    ['Jacket', 'Cozy Jacket', '#dde3d8', '85.00', 'cloth'],
    ['Tee', 'Everyday Tee', '#f2e3d7', '45.00', 'cloth'],
    ['Vest', 'Puffer Vest', '#e4e1db', '78.00', 'cloth'],
    ['Shorts', 'Play Shorts', '#ddd7e5', '38.00', null],
    ['Hoodie', 'Cloud Hoodie', '#e8dfd0', '68.00', 'cloth'],
    ['Leggings', 'Breezy Leggings', '#dde3d8', '52.00', 'legging'],
    ['Dress', 'Twirl Dress', '#f2e3d7', '62.00', 'cloth'],
    ['Tee', 'Long Sleeve Tee', '#e4e1db', '42.00', 'cloth'],
    ['Pants', 'Jogger Pants', '#ddd7e5', '58.00', 'cloth'],
    ['Skort', 'Tennis Skort', '#e8dfd0', '48.00', 'cloth'],
    ['Jacket', 'Wind Jacket', '#dde3d8', '88.00', 'cloth'],
    ['Bra', 'Sports Bra', '#f2e3d7', '32.00', 'cloth'],
    ['Tank', 'Racer Tank', '#e4e1db', '36.00', 'cloth'],
    ['Leggings', 'Pocket Leggings', '#ddd7e5', '56.00', 'legging'],
    ['Sweatshirt', 'Crew Sweatshirt', '#e8dfd0', '64.00', 'cloth'],
    ['Shorts', 'Bike Shorts', '#dde3d8', '34.00', 'cloth'],
    ['Set', 'Lounge Set', '#f2e3d7', '72.00', 'cloth'],
  ].map(([category, title, bg, value, sizeChart], i) => {
    const styleNo = String(63211400 + i);
    // Style 5 (Play Shorts) is sold out everywhere; Leopard Pink of style 1 has no stock at all.
    const all = i === 4 ? KID_SIZES : ['7', '12'];
    return {
      styleNo,
      title,
      category,
      sizeChart,
      image: thumb(bg, category),
      value,
      colors: [
        { name: 'Midnight Blue', sizes: sizesFor(styleNo, 'MB', all) },
        { name: 'Leopard Pink', sizes: sizesFor(styleNo, 'LP', i === 1 ? KID_SIZES : i === 4 ? KID_SIZES : ['3T', '12']) },
        { name: 'Cloud White', sizes: sizesFor(styleNo, 'CW', i === 4 ? KID_SIZES : ['5']) },
      ],
    };
  });
  const JACKET = [
    {
      styleNo: '64100100',
      title: 'Sherpa Jacket',
      category: 'Jacket',
      sizeChart: 'cloth',
      image: thumb('#eae1d2', 'Sherpa'),
      value: '89.00',
      colors: [
        { name: 'Midnight Blue', sizes: sizesFor('64100100', 'MB', ['7', '12']) },
        { name: 'Leopard Pink', sizes: sizesFor('64100100', 'LP', ['3T']) },
        { name: 'Cloud White', sizes: sizesFor('64100100', 'CW', []) },
      ],
    },
  ];
  // &spin_gift=… picks what CONFIRM does: ok (default) | taken (40910 once, the size goes out
  // of stock) | selected (40911) | deadline (40912) | invalid (40913) | busy (50300 once) | loadfail
  const giftCase = params.get('spin_gift') || 'ok';
  const takenSkus = new Set();
  let giftFailOnce = true;
  const giftOptions = (prizeId) => {
    if (giftCase === 'loadfail' && giftFailOnce) {
      giftFailOnce = false;
      throw Object.assign(new Error('spin mock'), { code: 50300 });
    }
    const jacket = String(prizeId) === 'jacket' || drawCase === 'grand';
    const styles = (jacket ? JACKET : OUTFIT).map((style) => ({
      ...style,
      colors: style.colors.map((color) => ({
        ...color,
        sizes: color.sizes.map((size) => ({ ...size, available: size.available && !takenSkus.has(size.sku) })),
      })),
    }));
    return { selectDeadline: iso(48 * HOUR), pickCount: jacket ? 1 : 2, styles };
  };
  const giftSelect = (body) => {
    const fail = (code) => {
      throw Object.assign(new Error('spin mock'), { code });
    };
    if (giftCase === 'taken' && giftFailOnce) {
      giftFailOnce = false;
      takenSkus.add(body.skus[body.skus.length - 1]);
      fail(40910);
    }
    if (giftCase === 'busy' && giftFailOnce) {
      giftFailOnce = false;
      fail(50300);
    }
    if (giftCase === 'selected') fail(40911);
    if (giftCase === 'deadline') fail(40912);
    if (giftCase === 'invalid') fail(40913);
    return { prizeId: 10086, status: 'SELECTED', giftOrderName: '#10301' };
  };

  const routes = {
    '/draw': draw,
    '/status': status,
    '/prizes?tab=unused': () => ({ items: scenario === 'none' ? [] : unused }),
    '/prizes?tab=used': () => ({ items: scenario === 'none' ? [] : used }),
  };
  const routeFor = (path, body) => {
    if (routes[path]) return () => routes[path](body);
    const match = path.match(/^\/prizes\/([^/]+)\/(gift-options|gift-selection)$/);
    if (!match) return null;
    return match[2] === 'gift-options' ? () => giftOptions(match[1]) : () => giftSelect(body);
  };

  window.mtSpinMock = (path, body) =>
    new Promise((resolve, reject) => {
      setTimeout(() => {
        const route = routeFor(path, body);
        if (scenario === 'error' || !route) {
          reject(Object.assign(new Error('spin mock'), { code: 50300 }));
          return;
        }
        try {
          resolve(route());
        } catch (err) {
          reject(err);
        }
      }, 300);
    });
})();
