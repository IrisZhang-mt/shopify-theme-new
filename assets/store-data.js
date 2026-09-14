if (!window.mtFetchStores) {
  const CACHE_TTL_MS = 15 * 60 * 1000;
  const FETCH_TIMEOUT_MS = 60000;
  const inFlight = new Map();

  const cacheKey = (apiEndpoint) => `mt:store-data:${apiEndpoint}`;

  const readCache = (apiEndpoint) => {
    try {
      const raw = localStorage.getItem(cacheKey(apiEndpoint));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.data) || typeof parsed.savedAt !== 'number') return null;
      if (Date.now() - parsed.savedAt > CACHE_TTL_MS) return null;
      return parsed.data;
    } catch {
      return null;
    }
  };

  const writeCache = (apiEndpoint, data) => {
    try {
      localStorage.setItem(cacheKey(apiEndpoint), JSON.stringify({ data, savedAt: Date.now() }));
    } catch {
      // localStorage unavailable (private mode / quota) — caching is a bonus, not a requirement.
    }
  };

  const fetchFromNetwork = async (apiEndpoint) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(apiEndpoint, { signal: controller.signal });
      const result = await response.json();
      if (result.code !== '200') throw new Error(result.message || 'Store API error');
      const data = result.data || [];
      writeCache(apiEndpoint, data);
      return data;
    } finally {
      clearTimeout(timer);
    }
  };

  // Shared by every section that needs the store list (store-locator, flagship carousel, …):
  // serves a recent localStorage copy when there is one, otherwise fetches once and lets any
  // other caller in the same page load ride the same in-flight request instead of firing again.
  window.mtFetchStores = (apiEndpoint) => {
    const cached = readCache(apiEndpoint);
    if (cached) return Promise.resolve(cached);

    if (inFlight.has(apiEndpoint)) return inFlight.get(apiEndpoint);

    const promise = fetchFromNetwork(apiEndpoint).finally(() => {
      inFlight.delete(apiEndpoint);
    });
    inFlight.set(apiEndpoint, promise);
    return promise;
  };
}
