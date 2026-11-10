// Fake App Proxy responses for ?spin_mock=… — loaded by spin-wheel.js only on non-live themes.
//   spins   → 2 spins left (auto-opens 02)
//   nospin  → 0 spins, unused prizes (auto-opens 06 once per session)
//   none    → 0 spins, no prizes (nothing auto-opens; manual open shows 02 at 0)
//   error   → every request fails
(() => {
  const scenario = new URLSearchParams(window.location.search).get('spin_mock') || 'spins';
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
      spinsLeft: spins ? 2 : 0,
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

  const routes = {
    '/status': status,
    '/prizes?tab=unused': () => ({ items: scenario === 'none' ? [] : unused }),
    '/prizes?tab=used': () => ({ items: scenario === 'none' ? [] : used }),
  };

  window.mtSpinMock = (path) =>
    new Promise((resolve, reject) => {
      setTimeout(() => {
        const route = routes[path];
        if (scenario === 'error' || !route) {
          reject(Object.assign(new Error('spin mock'), { code: 50300 }));
          return;
        }
        resolve(route());
      }, 300);
    });
})();
