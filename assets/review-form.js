if (!window.mtReviewFormInit) {
  window.mtReviewFormInit = true;

  const CREATE_URL = 'https://judge.me/api/v1/reviews';
  const PRESIGN_URL = 'https://api.judge.me/api/v1/pictures/presigned_data';
  const MAX_BYTES = 10485760;
  const MAX_PHOTOS = 5;
  const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  const CLOSE_DELAY = 450;
  const FOCUSABLE = 'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), a[href]';

  const reducedMq = window.mtReducedMq;
  const state = { trigger: null, sending: false, closeTimer: 0 };
  const photosOf = new WeakMap();

  const field = (form, name) => form.querySelector(`[name="${name}"]`);

  const note = (root, message, isError) => {
    const element = root.querySelector('[data-rf-note]');
    if (!element) return;
    element.textContent = message || '';
    element.classList.toggle('mt-rf__note--error', Boolean(isError));
    element.hidden = !message;
  };

  const paintStars = (root) => {
    root.querySelectorAll('.mt-rf__star').forEach((star) => star.classList.remove('mt-rf__star--on'));
    const checked = root.querySelector('[data-rf-stars] input:checked');
    let star = checked?.closest('.mt-rf__star');
    while (star) {
      star.classList.add('mt-rf__star--on');
      star = star.nextElementSibling;
    }
  };

  const shopParams = (root) => ({
    shop_domain: root.dataset.rfShop,
    url: root.dataset.rfShop,
    platform: 'shopify',
  });

  const readPreview = (file) =>
    new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    });

  // Index prefix keeps same-named files (e.g. several iOS "image.jpg") from sharing an upload key.
  const uploadPicture = async (root, file, index) => {
    const presign = await fetch(`${PRESIGN_URL}?${new URLSearchParams(shopParams(root))}`);
    if (!presign.ok) throw new Error(presign.status);
    const data = await presign.json();
    const body = new FormData();
    body.append('key', `${data.key_prefix}${index}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`);
    Object.entries(data.fields || {}).forEach(([key, value]) => body.append(key, value));
    body.append('file', file);
    const upload = await fetch(data.url, { method: 'POST', body });
    if (!upload.ok) throw new Error(upload.status);
    const parsed = new DOMParser().parseFromString(await upload.text(), 'application/xml');
    const location = parsed.querySelector('Location')?.textContent;
    if (!location) throw new Error(upload.status);
    return location;
  };

  const photos = (root) => {
    if (!photosOf.has(root)) photosOf.set(root, []);
    return photosOf.get(root);
  };

  const paintPhotos = (root) => {
    const list = root.querySelector('[data-rf-thumbs]');
    if (!list) return;
    const picked = photos(root);
    list.replaceChildren(
      ...picked.map((photo, index) => {
        const item = document.createElement('li');
        item.className = 'mt-rf__thumb';
        const image = new Image(64, 64);
        image.src = photo.url;
        image.alt = '';
        const remove = document.createElement('button');
        remove.className = 'mt-rf__thumb-remove';
        remove.type = 'button';
        remove.dataset.rfRemove = index;
        remove.setAttribute('aria-label', `${root.dataset.rfPhotoRemove} ${index + 1}`);
        remove.innerHTML =
          '<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.25" aria-hidden="true"><path d="M1 1l8 8M9 1L1 9"/></svg>';
        item.append(image, remove);
        return item;
      })
    );
    list.hidden = !picked.length;
  };

  const addPhotos = (root, files) => {
    const picked = photos(root);
    let message = '';
    files.forEach((file) => {
      if (!PHOTO_TYPES.includes(file.type)) {
        message = root.dataset.rfPhotoType;
        return;
      }
      if (file.size > MAX_BYTES) {
        message = root.dataset.rfPhotoLarge;
        return;
      }
      if (picked.length >= MAX_PHOTOS) {
        message = root.dataset.rfPhotoMany;
        return;
      }
      if (picked.some((photo) => photo.file.name === file.name && photo.file.size === file.size)) return;
      picked.push({ file, url: URL.createObjectURL(file) });
    });
    note(root, message, Boolean(message));
    paintPhotos(root);
  };

  const clearPhotos = (root) => {
    photos(root).forEach((photo) => URL.revokeObjectURL(photo.url));
    photosOf.set(root, []);
    paintPhotos(root);
  };

  const validate = (form) => {
    let first = null;
    form.querySelectorAll('input[required], textarea[required]').forEach((input) => {
      if (input.type === 'radio') {
        if (!form.querySelector(`[name="${input.name}"]:checked`) && !first) first = input;
        return;
      }
      const valid = Boolean(input.value.trim()) && input.checkValidity();
      input.setAttribute('aria-invalid', String(!valid));
      if (!valid && !first) first = input;
    });
    return first;
  };

  const submit = async (root) => {
    const form = root.querySelector('[data-rf-form]');
    const button = root.querySelector('[data-rf-submit]');
    if (!form || !button || state.sending) return;

    const invalid = validate(form);
    if (invalid) {
      note(root, root.dataset.rfInvalid, true);
      invalid.focus();
      return;
    }

    const files = photos(root).map((photo) => photo.file);

    const label = button.textContent;
    state.sending = true;
    button.disabled = true;
    button.textContent = root.dataset.rfSending;
    note(root, '');

    const review = {
      scope: root.dataset.rfScope,
      productId: root.dataset.rfProduct,
      name: field(form, 'name').value.trim(),
      rating: form.querySelector('[name="rating"]:checked').value,
      title: field(form, 'title').value.trim(),
      body: field(form, 'body').value.trim(),
      picture: '',
      pictures: [],
    };

    const body = new FormData();
    Object.entries(shopParams(root)).forEach(([key, value]) => body.append(key, value));
    body.append('id', review.productId);
    body.append('name', review.name);
    body.append('email', field(form, 'email').value.trim());
    body.append('rating', review.rating);
    body.append('title', review.title);
    body.append('body', review.body);
    if (root.dataset.rfCustomer) body.append('shopify_customer_id', root.dataset.rfCustomer);

    try {
      // Any failed upload rejects the whole submit, so a review never posts with missing photos.
      if (files.length) {
        const [locations, previews] = await Promise.all([
          Promise.all(files.map((file, index) => uploadPicture(root, file, index))),
          Promise.all(files.map(readPreview)),
        ]);
        locations.forEach((location) => body.append('picture_urls[]', location));
        review.pictures = previews.filter(Boolean);
        review.picture = review.pictures[0] || '';
      }
      const response = await fetch(CREATE_URL, { method: 'POST', body });
      if (!response.ok) throw new Error(response.status);
    } catch {
      state.sending = false;
      button.disabled = false;
      button.textContent = label;
      note(root, root.dataset.rfError, true);
      return;
    }

    review.time = Date.now();
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event_parameters: null });
    window.dataLayer.push({ event: 'ga4Event', event_name: 'submit_review' });
    window.mtReviewStore.add({
      scope: review.scope,
      productId: review.productId,
      name: review.name,
      rating: Number(review.rating) || 0,
      title: review.title,
      body: review.body,
      time: review.time,
    });
    document.dispatchEvent(new CustomEvent('mt:review-added', { detail: review }));
    state.sending = false;
    form.reset();
    paintStars(root);
    form.querySelectorAll('[aria-invalid]').forEach((input) => input.removeAttribute('aria-invalid'));
    clearPhotos(root);
    note(root, root.dataset.rfThanks);
    button.disabled = false;
    button.type = 'button';
    button.textContent = root.dataset.rfCloseLabel;
    button.setAttribute('data-rf-close', '');
  };

  const restore = (root) => {
    const button = root.querySelector('[data-rf-submit]');
    if (!button) return;
    button.disabled = false;
    button.type = 'submit';
    button.textContent = button.dataset.rfLabel;
    button.removeAttribute('data-rf-close');
  };

  const openRoot = () => document.querySelector('[data-rf]:not([hidden])');

  const reset = (root) => {
    root.classList.remove('mt-rf--open');
    root.hidden = true;
    document.documentElement.classList.remove('mt-rf-lock');
  };

  const open = (trigger) => {
    const scope = trigger.dataset.rfOpen;
    const root =
      document.querySelector(`[data-rf][data-rf-scope="${scope}"]`) || document.querySelector('[data-rf]');
    if (!root) return;
    clearTimeout(state.closeTimer);
    if (!root.hidden && root.classList.contains('mt-rf--open')) return;
    reset(root);
    state.trigger = window.mtKeyboardFocus(trigger) ? trigger : null;
    note(root, '');
    restore(root);
    root.hidden = false;
    document.documentElement.classList.add('mt-rf-lock');
    requestAnimationFrame(() => root.classList.add('mt-rf--open'));
    root.querySelector('[data-rf-box]')?.focus({ preventScroll: true });
  };

  const close = (root) => {
    if (!root || root.hidden) return;
    root.classList.remove('mt-rf--open');
    document.documentElement.classList.remove('mt-rf-lock');
    if (reducedMq.matches) reset(root);
    else state.closeTimer = setTimeout(() => reset(root), CLOSE_DELAY);
    state.trigger?.focus({ preventScroll: true });
    state.trigger = null;
  };

  document.addEventListener('click', (event) => {
    const trigger = event.target.closest?.('[data-rf-open]');
    if (trigger) {
      event.preventDefault();
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({ event_parameters: null });
      window.dataLayer.push({ event: 'ga4Event', event_name: 'write_review' });
      open(trigger);
      return;
    }
    const remove = event.target.closest?.('[data-rf-remove]');
    if (remove) {
      const root = remove.closest('[data-rf]');
      const [photo] = photos(root).splice(Number(remove.dataset.rfRemove), 1);
      if (photo) URL.revokeObjectURL(photo.url);
      note(root, '');
      paintPhotos(root);
      return;
    }
    if (event.target.closest?.('[data-rf-close]')) close(openRoot());
  });

  document.addEventListener('change', (event) => {
    const root = event.target.closest?.('[data-rf]');
    if (!root) return;
    if (event.target.matches('[data-rf-stars] input')) {
      paintStars(root);
      return;
    }
    if (event.target.matches('[data-rf-file]')) {
      addPhotos(root, [...event.target.files]);
      event.target.value = '';
    }
  });

  document.addEventListener('submit', (event) => {
    const form = event.target.closest?.('[data-rf-form]');
    if (!form) return;
    event.preventDefault();
    submit(form.closest('[data-rf]'));
  });

  document.addEventListener('keydown', (event) => {
    const root = openRoot();
    if (!root) return;
    if (event.key === 'Escape') {
      close(root);
      return;
    }
    if (event.key === 'Tab') window.mtFocusTrap(event, root, FOCUSABLE);
  });

  window.addEventListener('pageshow', (event) => {
    if (!event.persisted) return;
    clearTimeout(state.closeTimer);
    document.querySelectorAll('[data-rf]').forEach(reset);
    state.trigger = null;
    state.sending = false;
  });
}
