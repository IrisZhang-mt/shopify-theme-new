// Fake App Proxy answers for the welcome spin — loaded by welcome-spin.js only when the URL has
// ?ws_mock=… and the theme isn't the live one. Also skips the 3-day check; &ws_delay=0 opens
// immediately (default 8s).
//   ws_mock=coupon10 | coupon8 | coupon5 | ship | gift | grand   → that prize
//   ws_mock=member (40003) | used (40004) | rate (40005) | ended (40002 on draw)
//   ws_mock=busy (40900 twice, then the prize — same requestId) | error (50300) | network
//   ws_mock=closed → GET /activities fails (popup must not open)
(() => {
  const scenario = new URLSearchParams(window.location.search).get('ws_mock') || 'coupon10';
  const SHOP = '/pages/black-friday2026';

  const slots = [
    { prizeCode: 'WELCOMEGIFT', slot: 0, title: 'Free gift', prizeType: 'GIFT', sectorWeight: 30 },
    { prizeCode: 'WELCOME8', slot: 1, title: '8% off', prizeType: 'COUPON', sectorWeight: 5 },
    { prizeCode: 'WELCOME10', slot: 2, title: '10% off', prizeType: 'COUPON', sectorWeight: 15 },
    { prizeCode: 'WELCOME5OFF', slot: 3, title: '$5 off', prizeType: 'COUPON', sectorWeight: 5 },
    { prizeCode: 'WELCOMEGRAND', slot: 4, title: 'Grand prize', prizeType: 'GRAND', sectorWeight: 40 },
    { prizeCode: 'WELCOMESHIP', slot: 5, title: 'Free shipping', prizeType: 'COUPON', sectorWeight: 5 },
  ].map((s) => ({ ...s, extra: { sectorWeight: s.sectorWeight } }));

  const coupon = (slot) => ({
    ...slot,
    userPrizeId: 3,
    description: "For your first order. We've sent the code to your inbox, too.",
    contentType: 'code',
    contentValue: slot.prizeCode,
    expireText: 'Apply at checkout · valid for 30 days',
    extra: { ctaUrl: SHOP },
  });
  const prizes = {
    coupon10: coupon(slots[2]),
    coupon8: coupon(slots[1]),
    coupon5: coupon(slots[3]),
    ship: coupon(slots[5]),
    gift: {
      ...slots[0],
      userPrizeId: 4,
      description: "Add it to your cart and it's free on orders of $79 or more.",
      contentType: 'code',
      contentValue: 'WELCOMEGIFT',
      expireText: 'Code WELCOMEGIFT applies automatically at checkout · valid for 30 days',
      extra: { variantId: '12345678901234', productHandle: 'welcome-gift-placeholder', ctaUrl: SHOP },
    },
    grand: {
      ...slots[4],
      userPrizeId: 5,
      description: 'A moodytiger gift bundle, shipped free with your first order.',
      contentType: 'code',
      contentValue: 'WELCOMEGRAND',
      expireText: 'Applies to your first order · valid for 30 days',
      extra: { variantId: '98765432109876', productHandle: 'grand-prize-placeholder', ctaUrl: SHOP },
    },
  };
  const failures = { member: 40003, used: 40004, rate: 40005, ended: 40002, error: 50300 };

  let busyLeft = 2;
  const later = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const fail = (code) => {
    throw Object.assign(new Error('mock'), { code });
  };

  window.mtWelcomeSpinMock = async (path, body) => {
    await later(300);
    console.info('[welcome-spin mock]', path, body || '');
    if (!body) {
      if (scenario === 'closed') fail(40002);
      return { activityCode: 'welcome-spin-bf2026', name: 'Mock Welcome Spin', status: 'ONLINE', prizes: slots };
    }
    if (scenario === 'network') fail(undefined);
    if (failures[scenario]) fail(failures[scenario]);
    if (scenario === 'busy' && busyLeft > 0) {
      busyLeft -= 1;
      fail(40900);
    }
    const prize = prizes[scenario] || prizes.coupon10;
    return { winningId: 1, requestId: body.requestId, activityCode: 'welcome-spin-bf2026', prizes: [prize] };
  };
})();
