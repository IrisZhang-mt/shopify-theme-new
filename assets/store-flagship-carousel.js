if (!window.mtStoreFlagshipInit) {
  window.mtStoreFlagshipInit = true;

  const IMAGE_HOST = "https://cdn.shopify.com/s/files/1/0475/6920/7457/files";

  const escapeHtml = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (char) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[char],
    );

  const fallbackImage = (name) => {
    const svg = `<svg width="300" height="200" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="300" height="200" fill="url(#g)"/>
      <text x="150" y="100" font-size="16" fill="white" text-anchor="middle" dominant-baseline="middle">${escapeHtml(name || "Store")}</text>
    </svg>`;
    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
  };

  // Cards render at most ~450px wide (see --mt-flagship-card-w); ask the CDN for a
  // right-sized file instead of shipping the full-resolution store photo.
  const IMAGE_WIDTH = 700;

  const storeImage = (storeId, defaultImage) => {
    if (storeId) return `${IMAGE_HOST}/${storeId}.jpg?width=${IMAGE_WIDTH}`;
    return defaultImage || fallbackImage();
  };

  const onImageError = (img, name) => {
    img.onerror = null;
    img.src = `${IMAGE_HOST}/US0001.jpg?width=${IMAGE_WIDTH}`;
    img.onerror = () => {
      img.onerror = null;
      img.src = fallbackImage(name);
    };
  };

  // Only the cards visible before any horizontal scroll benefit from loading eagerly;
  // the rest sit off-screen until autoplay reveals them, so they stay lazy.
  const EAGER_CARD_COUNT = 4;

  const cardMarkup = (store, defaultImage, index) => {
    const image = storeImage(store.storeId, defaultImage);
    const caption = store.city ? `${store.city} · ${store.name}` : store.name;
    const loading = index < EAGER_CARD_COUNT ? "eager" : "lazy";
    return `
      <div class="mt-flagship__card">
        <div class="mt-flagship__media">
          <img src="${escapeHtml(image)}" alt="${escapeHtml(store.name)}" loading="${loading}" data-flagship-img data-store-name="${escapeHtml(store.name)}">
        </div>
        <p class="mt-flagship__caption">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
            <circle cx="12" cy="10" r="3"></circle>
          </svg>
          ${escapeHtml(caption)}
        </p>
      </div>`;
  };

  const createFlagshipCarousel = async (root) => {
    const rowEl = root.querySelector("[data-autoplay]");
    if (!rowEl) return;
    const apiEndpoint = root.dataset.apiEndpoint;
    const defaultImage = root.dataset.defaultImage || "";
    const hiddenNames = (root.dataset.hiddenStores || "")
      .split(/\r?\n/)
      .map((line) => line.trim().toLowerCase())
      .filter(Boolean);

    try {
      const data = await window.mtFetchStores(apiEndpoint);

      const stores = (data || [])
        .map((store) => ({
          storeId: store.store_id,
          name: (store.store_name_en || "").replace(/[\r\n]+/g, " ").trim(),
          city: (store.city_en || "").replace(/[\r\n]+/g, " ").trim(),
          address: (store.store_address_en || store.store_address || "").replace(/[\r\n]+/g, " ").trim(),
        }))
        .filter((store) => store.name && store.address)
        .filter((store) => !hiddenNames.includes(store.name.toLowerCase()));

      if (!stores.length) return;

      rowEl.innerHTML = stores
        .map((store, index) => cardMarkup(store, defaultImage, index))
        .join("");
      rowEl.querySelectorAll("[data-flagship-img]").forEach((img) => {
        img.addEventListener(
          "error",
          () => onImageError(img, img.dataset.storeName),
          { once: true },
        );
      });

      document.dispatchEvent(new CustomEvent("mt:reveal-scan"));
    } catch (error) {
      console.error("[store-flagship-carousel]", error);
    }
  };

  const initAll = (scope) => {
    scope.querySelectorAll("[data-store-flagship-carousel]").forEach((root) => {
      if (root.dataset.mtReady) return;
      root.dataset.mtReady = "true";
      createFlagshipCarousel(root);
    });
  };

  initAll(document);
  document.addEventListener("shopify:section:load", (event) =>
    initAll(event.target),
  );
}
