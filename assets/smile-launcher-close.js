// Smile.io 积分悬浮按钮的关闭 ×：跟随按钮右上角定位，点击后本标签页内隐藏按钮（sessionStorage）。
// Smile 按钮在 iframe 内且外框 overflow:hidden，所以 × 是独立的 fixed 元素，按外框实际位置对齐。
//
// Smile 实测行为（2026-11-19，生产 / 预览一致）：
// - 首屏渲染 lite：#smile-ui-lite-container > #smile-ui-lite-launcher-frame-container（opacity 淡入）
// - 首次点击按钮：插入完整版 #smile-ui-container，删除 lite；按钮框 .smile-launcher-frame-container
//   在 smile-launcher-open / smile-launcher-closed 间切换，面板 .smile-panel-frame-container 打开时插入、收起后删除
// - 完整版首次渲染的按钮框（无 smile-launcher-animate）computed visibility:hidden，但内部 iframe
//   自身 visibility:visible，用户看得见 —— 所以可见性以 iframe 为准，不能看按钮框
// 全程事件驱动：没有定时轮询，用户不操作 Smile 时只有 body 监听里的 isConnected 判断。
(() => {
  const KEY = 'mt_smile_launcher_closed';
  const HALF = 16; // × 点击区域 32px 的一半，与 smile-launcher-close.css 保持一致
  const root = document.documentElement;
  const btn = document.querySelector('[data-smile-close]');
  if (!btn || root.classList.contains('mt-smile-closed')) return;

  const FULL_LAUNCHER = '#smile-ui-container .smile-launcher-frame-container';
  const LITE_LAUNCHER = '#smile-ui-lite-launcher-frame-container';
  const CONTAINER = '#smile-ui-container, #smile-ui-lite-container';
  const PANEL = '.smile-panel-frame-container';

  let container = null;
  let launcher = null;
  let containerObserver = null;
  let settleTimer = 0;

  // 完整版出现时 lite 不一定同一时刻删除，两者并存时优先完整版
  const findLauncher = () =>
    document.querySelector(FULL_LAUNCHER) || document.querySelector(LITE_LAUNCHER);

  const panelOpen = () => {
    const panel = container?.querySelector(PANEL);
    return !!panel && getComputedStyle(panel).display !== 'none';
  };

  const launcherVisible = () => {
    const rect = launcher.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const box = getComputedStyle(launcher);
    // opacity / display 不被子元素覆盖，看按钮框；visibility 可被 iframe 覆盖，看 iframe
    const frame = getComputedStyle(launcher.querySelector('iframe') || launcher);
    const visible =
      box.display !== 'none' && parseFloat(box.opacity) > 0 && frame.visibility !== 'hidden';
    return visible ? rect : null;
  };

  const place = () => {
    const rect =
      launcher?.isConnected &&
      !launcher.classList.contains('smile-launcher-open') &&
      !panelOpen() &&
      launcherVisible();
    btn.hidden = !rect;
    if (!rect) return;
    // × 圆心落在按钮框右上角
    btn.style.left = `${Math.round(rect.right - HALF)}px`;
    btn.style.top = `${Math.round(rect.top - HALF)}px`;
  };

  // 按钮框宽度有约 0.25s 过渡（收起面板后 60px → 原宽），变化后再补一次定位
  const schedule = () => {
    place();
    clearTimeout(settleTimer);
    settleTimer = setTimeout(place, 300);
  };

  // lite 淡入、按钮框宽度过渡、面板淡出都是动画，结束时补一次定位（只监听 Smile 外壳内的事件）
  const onSettle = (event) => {
    if (event.target === launcher || event.target.matches?.(PANEL)) place();
  };

  const attach = () => {
    const next = findLauncher();
    const found = next?.closest(CONTAINER);
    if (!found) {
      launcher = null;
      place();
      return;
    }
    if (found !== container) {
      if (container) {
        container.removeEventListener('animationend', onSettle);
        container.removeEventListener('transitionend', onSettle);
      }
      containerObserver?.disconnect();
      container = found;
      container.addEventListener('animationend', onSettle);
      container.addEventListener('transitionend', onSettle);
      containerObserver = new MutationObserver(() => {
        launcher = findLauncher();
        schedule();
      });
      containerObserver.observe(container, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'style'],
      });
      // 与 Smile 外壳同为最大 z-index，放到它之后才能盖在按钮上
      document.body.appendChild(btn);
    }
    launcher = next;
    schedule();
  };

  // Smile 外壳可能嵌在其他节点里，需要 subtree。已挂在完整版上时回调只做 isConnected 判断，不读布局；
  // 挂在 lite 上时额外查一次完整版是否已出现
  const bodyObserver = new MutationObserver(() => {
    if (
      !container?.isConnected ||
      !launcher?.isConnected ||
      (launcher.id && document.querySelector(FULL_LAUNCHER))
    ) {
      attach();
    }
  });
  bodyObserver.observe(document.body, { childList: true, subtree: true });
  attach();

  window.addEventListener('resize', place, { passive: true });

  btn.addEventListener('click', () => {
    try {
      sessionStorage.setItem(KEY, '1');
    } catch (e) {}
    root.classList.add('mt-smile-closed');
    btn.hidden = true;
    clearTimeout(settleTimer);
    bodyObserver.disconnect();
    containerObserver?.disconnect();
    container?.removeEventListener('animationend', onSettle);
    container?.removeEventListener('transitionend', onSettle);
    window.removeEventListener('resize', place);

    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event_parameters: null });
    window.dataLayer.push({
      event: 'ga4Event',
      event_name: 'click_function',
      event_parameters: { module_name: 'Rewards Launcher', button_name: 'Close' },
    });
  });
})();
