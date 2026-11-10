if (!window.mtGateInit) {
  window.mtGateInit = true;

  const TIMEOUT_MS = 5000;
  const gate = document.querySelector('[data-gate]');

  // ?spin_mock=ended shows the ended view, any other value acts as ONGOING.
  // Never honoured on the live (role "main") theme.
  const mockStatus = () => {
    const role = window.Shopify && window.Shopify.theme && window.Shopify.theme.role;
    if (!role || role === 'main') return null;
    const mock = new URLSearchParams(window.location.search).get('spin_mock');
    if (!mock) return null;
    return mock === 'ended' ? 'ENDED' : 'ONGOING';
  };

  const fetchStatus = async (url) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      if (!res.ok) return null;
      const json = await res.json();
      if (!json || json.code !== 0) return null;
      return (json.data && json.data.activity && json.data.activity.status) || null;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  };

  const run = async () => {
    if (!gate) return;
    const status = mockStatus() || (await fetchStatus(gate.dataset.statusUrl));
    if (status === 'ENDED') {
      const ended = gate.querySelector('[data-gate-ended]');
      if (ended) ended.hidden = false;
      return;
    }
    // ONGOING, NOT_STARTED, error or timeout: campaign page if logged in, otherwise sign in.
    window.location.replace(gate.dataset.nextUrl);
  };

  run();
}
