if (!window.mtReviewFormInit) {
  window.mtReviewFormInit = true;

  const CREATE_URL = 'https://judge.me/api/v1/reviews';
  const PRESIGN_URL = 'https://api.judge.me/api/v1/pictures/presigned_data';
  const MAX_BYTES = 10485760;
  const CLOSE_DELAY = 450;
  const FOCUSABLE = 'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), a[href]';

  const reducedMq = window.mtReducedMq;
  const state = { trigger: null, sending: false, closeTimer: 0 };

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

  const uploadPicture = async (root, file) => {
    const presign = await fetch(`${PRESIGN_URL}?${new URLSearchParams(shopParams(root))}`);
    if (!presign.ok) throw new Error(presign.status);
    const data = await presign.json();
    const body = new FormData();
    body.append('key', `${data.key_prefix}${file.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`);
    Object.entries(data.fields || {}).forEach(([key, value]) => body.append(key, value));
    body.append('file', file);
    const upload = await fetch(data.url, { method: 'POST', body });
    if (!upload.ok) throw new Error(upload.status);
    const parsed = new DOMParser().parseFromString(await upload.text(), 'application/xml');
    const location = parsed.querySelector('Location')?.textContent;
    if (!location) throw new Error(upload.status);
    return location;
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

    const picker = form.querySelector('[data-rf-file]');
    const file = picker?.files[0];
    if (file && file.size > MAX_BYTES) {
      note(root, root.dataset.rfPhotoLarge, true);
      return;
    }

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
      if (file) {
        const [location, preview] = await Promise.all([uploadPicture(root, file), readPreview(file)]);
        body.append('picture_urls[]', location);
        review.picture = preview;
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
    const fileName = root.querySelector('[data-rf-file-name]');
    if (fileName) fileName.textContent = '';
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
      open(trigger);
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
      const name = root.querySelector('[data-rf-file-name]');
      if (name) name.textContent = event.target.files[0]?.name || '';
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
