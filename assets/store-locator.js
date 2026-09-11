if (!window.mtStoreLocatorInit) {
  window.mtStoreLocatorInit = true;

  const HK_DEFAULT = { lat: 22.3193, lng: 114.1694 };
  const MAPS_API_KEY = 'AIzaSyAnhrA31cRuvHPcVtiggjoNtX05Tw1GG3U';
  const IMAGE_HOST = 'https://cdn.shopify.com/s/files/1/0475/6920/7457/files';
  const FILTERS = [
    'hongkong',
    'macau',
    'malaysia',
    'singapore',
    'usa',
    'uae',
    'shanghai',
    'beijing',
    'shenzhen',
    'guangzhou',
  ];

  let mapsLoading = null;

  const loadGoogleMaps = () => {
    if (window.google && window.google.maps) return Promise.resolve();
    if (mapsLoading) return mapsLoading;
    mapsLoading = new Promise((resolve, reject) => {
      window.mtInitStoreMap = () => resolve();
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_API_KEY}&callback=mtInitStoreMap&libraries=places`;
      script.async = true;
      script.defer = true;
      script.onerror = () => reject(new Error('Failed to load Google Maps'));
      document.head.appendChild(script);
    });
    return mapsLoading;
  };

  const toRad = (deg) => (deg * Math.PI) / 180;

  const milesBetween = (lat1, lng1, lat2, lng2) => {
    const R = 3959;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const matchesFilter = (store, filter) => {
    const city = (store.city || '').toLowerCase();
    const province = (store.province || '').toLowerCase();
    const name = (store.name || '').toLowerCase();
    const address = (store.address || '').toLowerCase();

    switch (filter) {
      case 'hongkong':
        return (
          city.includes('hong kong') ||
          province.includes('hong kong') ||
          name.includes('hong kong') ||
          address.includes('hong kong')
        );
      case 'macau':
        return city.includes('macau') || province.includes('macau') || name.includes('macau') || address.includes('macau');
      case 'malaysia':
        return (
          city.includes('kuala lumpur') ||
          city.includes('malaysia') ||
          province.includes('malaysia') ||
          name.includes('malaysia') ||
          address.includes('malaysia') ||
          address.includes('kuala lumpur')
        );
      case 'singapore':
        return (
          city.includes('singapore') ||
          province.includes('singapore') ||
          name.includes('singapore') ||
          address.includes('singapore')
        );
      case 'usa':
        return (
          city.includes('usa') ||
          city.includes('united states') ||
          province.includes('usa') ||
          province.includes('united states') ||
          name.includes('usa') ||
          name.includes('united states') ||
          address.includes('usa') ||
          address.includes('united states')
        );
      case 'uae':
        return (
          city.includes('dubai') ||
          city.includes('uae') ||
          city.includes('emirates') ||
          city.includes('abu dhabi') ||
          province.includes('uae') ||
          province.includes('emirates') ||
          name.includes('uae') ||
          name.includes('emirates') ||
          name.includes('dubai') ||
          address.includes('uae') ||
          address.includes('emirates') ||
          address.includes('dubai')
        );
      case 'shanghai':
        return city.includes('shanghai') || province.includes('shanghai') || name.includes('shanghai') || address.includes('上海');
      case 'beijing':
        return city.includes('beijing') || province.includes('beijing') || name.includes('beijing') || address.includes('北京');
      case 'shenzhen':
        return city.includes('shenzhen') || province.includes('shenzhen') || name.includes('shenzhen') || address.includes('深圳');
      case 'guangzhou':
        return city.includes('guangzhou') || province.includes('guangzhou') || name.includes('guangzhou') || address.includes('广州');
      default:
        return city.includes(filter) || province.includes(filter);
    }
  };

  const escapeHtml = (value) =>
    String(value ?? '').replace(/[&<>"']/g, (char) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]
    ));

  const fallbackImage = (name) => {
    const svg = `<svg width="300" height="200" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="300" height="200" fill="url(#g)"/>
      <text x="150" y="100" font-size="16" fill="white" text-anchor="middle" dominant-baseline="middle">${escapeHtml(name || 'Store')}</text>
    </svg>`;
    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
  };

  const storeImage = (storeId, defaultImage) => {
    if (storeId) return `${IMAGE_HOST}/${storeId}.jpg`;
    return defaultImage || fallbackImage();
  };

  const onImageError = (img, name) => {
    img.onerror = null;
    img.src = `${IMAGE_HOST}/US0001.jpg`;
    img.onerror = () => {
      img.onerror = null;
      img.src = fallbackImage(name);
    };
  };

  const createLocator = (root) => {
    const apiEndpoint = root.dataset.apiEndpoint;
    const defaultImage = root.dataset.defaultImage || '';
    const hiddenNames = (root.dataset.hiddenStores || '')
      .split(/\r?\n/)
      .map((line) => line.trim().toLowerCase())
      .filter(Boolean);

    let strings = {};
    try {
      strings = JSON.parse(document.getElementById('StoreLocatorStrings')?.textContent || '{}');
    } catch {
      strings = {};
    }

    const listEl = root.querySelector('#StoreList');
    const mapEl = root.querySelector('#StoreMap');
    const countEl = root.querySelector('#StoreCount');
    const chipsEl = root.querySelector('#StoreChips');
    const searchInput = root.querySelector('#StoreSearchInput');
    const searchBtn = root.querySelector('#StoreSearchBtn');

    let stores = [];
    let activeFilter = 'all';
    let userLocation = { ...HK_DEFAULT };
    let map = null;
    let geocoder = null;
    let markers = [];
    let activeInfoWindow = null;

    const filteredStores = () => (activeFilter === 'all' ? stores : stores.filter((store) => matchesFilter(store, activeFilter)));
    const visibleCountText = () => `${filteredStores().length} ${strings.storesLabel || 'Stores'}`;

    const itemMarkup = (store, index) => {
      const distanceLabel = (strings.milesAway || '__DISTANCE__ mi from your location').replace(
        '__DISTANCE__',
        store.distance.toFixed(1)
      );
      const directionsUrl = `https://www.google.com/maps/dir/?api=1&origin=${userLocation.lat},${userLocation.lng}&destination=${store.lat},${store.lng}`;
      const image = storeImage(store.storeId, defaultImage);
      return `
        <div class="mt-store__item" data-store-index="${index}" data-store-name="${escapeHtml(store.name)}">
          <div class="mt-store__item-media">
            <img src="${escapeHtml(image)}" alt="${escapeHtml(store.name)}" loading="lazy" data-store-img>
          </div>
          <div class="mt-store__item-body">
            <p class="mt-store__item-name">${escapeHtml(store.name)}</p>
            <p class="mt-store__item-address">${escapeHtml(store.address)}</p>
            <p class="mt-store__item-distance">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                <circle cx="12" cy="10" r="3"></circle>
              </svg>
              ${distanceLabel}
            </p>
            <div class="mt-store__item-meta">
              ${
                store.phone
                  ? `<span class="mt-store__item-line">
                      <span class="mt-store__item-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                          <path d="M6.62 10.79a15.05 15.05 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.01-.24c1.12.37 2.33.57 3.58.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1C10.61 21 3 13.39 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.46.57 3.58a1 1 0 0 1-.25 1.01l-2.2 2.2z"></path>
                        </svg>
                      </span>
                      ${escapeHtml(store.phone)}
                    </span>`
                  : ''
              }
              <a class="mt-store__directions" href="${directionsUrl}" target="_blank" rel="noopener" data-store-directions>
                ${escapeHtml(strings.getDirections || 'Directions →')}
              </a>
            </div>
          </div>
        </div>`;
    };

    const infoWindowMarkup = (store) => {
      const directionsUrl = `https://www.google.com/maps/dir/?api=1&origin=${userLocation.lat},${userLocation.lng}&destination=${store.lat},${store.lng}`;
      const image = storeImage(store.storeId, defaultImage);
      return `
        <div class="mt-store-iw">
          <img src="${escapeHtml(image)}" alt="${escapeHtml(store.name)}">
          <h3>${escapeHtml(store.name)}</h3>
          <p>${escapeHtml(store.address)}</p>
          ${store.phone ? `<p><strong>Phone:</strong> ${escapeHtml(store.phone)}</p>` : ''}
          ${store.hours ? `<p><strong>Hours:</strong> ${escapeHtml(store.hours)}</p>` : ''}
          ${store.email ? `<p><strong>Email:</strong> ${escapeHtml(store.email)}</p>` : ''}
          <a href="${directionsUrl}" target="_blank" rel="noopener">${escapeHtml(strings.getDirections || 'Get Directions')}</a>
        </div>`;
    };

    const selectStore = (index, list) => {
      const store = list[index];
      if (!store) return;
      listEl.querySelectorAll('[data-store-index]').forEach((item, i) => {
        item.classList.toggle('mt-store__item--active', i === index);
      });
      if (!map) return;
      map.setCenter({ lat: store.lat, lng: store.lng });
      map.setZoom(15);
      if (activeInfoWindow) activeInfoWindow.close();
      const marker = markers[index];
      if (!marker) return;
      const infoWindow = new google.maps.InfoWindow({ content: infoWindowMarkup(store) });
      infoWindow.open(map, marker);
      activeInfoWindow = infoWindow;
    };

    const renderMarkers = () => {
      if (!map) return;
      markers.forEach((marker) => marker.setMap(null));
      markers = [];
      const list = filteredStores();
      const bounds = new google.maps.LatLngBounds();
      bounds.extend(userLocation);
      list.forEach((store, index) => {
        const marker = new google.maps.Marker({
          position: { lat: store.lat, lng: store.lng },
          map,
          title: store.name,
          icon: { url: 'https://maps.google.com/mapfiles/ms/icons/orange-dot.png' },
        });
        marker.addListener('click', () => selectStore(index, list));
        markers.push(marker);
        bounds.extend({ lat: store.lat, lng: store.lng });
      });
      if (list.length) {
        map.fitBounds(bounds);
        const listener = google.maps.event.addListener(map, 'idle', () => {
          if (map.getZoom() > 15) map.setZoom(15);
          google.maps.event.removeListener(listener);
        });
      }
    };

    const renderList = () => {
      const list = filteredStores();
      if (!list.length) {
        listEl.innerHTML = `<p class="mt-store__empty">${escapeHtml(strings.noResults || 'No stores match this filter yet.')}</p>`;
        return;
      }
      listEl.innerHTML = list.map((store, index) => itemMarkup(store, index)).join('');
      listEl.querySelectorAll('[data-store-index]').forEach((item, index) => {
        item.addEventListener('click', () => selectStore(index, list));
        const img = item.querySelector('[data-store-img]');
        if (img) img.addEventListener('error', () => onImageError(img, item.dataset.storeName), { once: true });
        const directions = item.querySelector('[data-store-directions]');
        if (directions) directions.addEventListener('click', (event) => event.stopPropagation());
      });
    };

    const updateCounts = () => {
      const counts = { all: stores.length };
      FILTERS.forEach((filter) => {
        counts[filter] = stores.filter((store) => matchesFilter(store, filter)).length;
      });
      chipsEl.querySelectorAll('[data-store-count]').forEach((el) => {
        el.textContent = counts[el.dataset.storeCount] || 0;
      });
      countEl.textContent = visibleCountText();
    };

    const recalculate = () => {
      stores.forEach((store) => {
        store.distance = milesBetween(userLocation.lat, userLocation.lng, store.lat, store.lng);
      });
      stores.sort((a, b) => a.distance - b.distance);
      updateCounts();
      renderList();
      renderMarkers();
    };

    const setFilter = (filter) => {
      activeFilter = filter;
      chipsEl.querySelectorAll('[data-store-filter]').forEach((chip) => {
        chip.classList.toggle('mt-store__chip--active', chip.dataset.storeFilter === filter);
      });
      renderList();
      renderMarkers();
      countEl.textContent = visibleCountText();
    };

    const setupMap = () => {
      if (map) return;
      map = new google.maps.Map(mapEl, {
        center: userLocation,
        zoom: 12,
        minZoom: 2,
        styles: [{ featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] }],
        disableDefaultUI: true,
        gestureHandling: 'greedy',
      });
      geocoder = new google.maps.Geocoder();
      new google.maps.Marker({
        position: userLocation,
        map,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: '#4285F4',
          fillOpacity: 1,
          strokeColor: '#fff',
          strokeWeight: 2,
        },
        title: 'Your location',
      });
    };

    const search = () => {
      const query = searchInput.value.trim();
      if (!query || !geocoder) return;
      geocoder.geocode({ address: query }, (results, status) => {
        if (status === 'OK' && results[0]) {
          const location = results[0].geometry.location;
          userLocation = { lat: location.lat(), lng: location.lng() };
          recalculate();
          if (map) {
            map.setCenter(userLocation);
            map.setZoom(12);
          }
        } else {
          window.alert(strings.locationNotFound || 'Location not found. Please try a different search.');
        }
      });
    };

    const fetchStores = async () => {
      const response = await fetch(apiEndpoint);
      const result = await response.json();
      if (result.code !== '200') throw new Error(result.message || 'Store API error');
      stores = (result.data || [])
        .map((store) => ({
          storeId: store.store_id,
          name: (store.store_name_en || '').replace(/[\r\n]+/g, ' ').trim(),
          address: (store.store_address || '').replace(/[\r\n]+/g, ' ').trim(),
          city: store.city_en,
          province: store.province_or_state_en,
          lat: parseFloat(store.latitude),
          lng: parseFloat(store.longitude),
          phone: store.contact_number || '',
          hours: store.operation_hours || '',
          email: store.email || '',
        }))
        .filter((store) => store.name && store.address)
        .filter((store) => !hiddenNames.includes(store.name.toLowerCase()));
    };

    chipsEl.addEventListener('click', (event) => {
      const chip = event.target.closest('[data-store-filter]');
      if (!chip) return;
      setFilter(chip.dataset.storeFilter);
    });
    searchBtn.addEventListener('click', search);
    searchInput.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      search();
    });

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          userLocation = { lat: position.coords.latitude, lng: position.coords.longitude };
          recalculate();
          if (map) map.setCenter(userLocation);
        },
        () => {}
      );
    }

    fetchStores()
      .then(() => loadGoogleMaps())
      .then(() => {
        setupMap();
        recalculate();
      })
      .catch((error) => console.error('[store-locator]', error));
  };

  const initAll = (scope) => {
    scope.querySelectorAll('[data-store-locator]').forEach((root) => {
      if (root.dataset.mtReady) return;
      root.dataset.mtReady = 'true';
      createLocator(root);
    });
  };

  initAll(document);
  document.addEventListener('shopify:section:load', (event) => initAll(event.target));
}
