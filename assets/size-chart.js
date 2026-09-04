if (!window.mtChartInit) {
  window.mtChartInit = true;

  const reducedMq = window.mtReducedMq;
  const closeTimers = new WeakMap();
  let trigger = null;

  const openedChart = () => document.querySelector('.mt-chart:not([hidden])');

  const portal = (chart) => {
    if (chart.parentElement === document.body) return chart;
    document.querySelectorAll(`body > [data-chart="${chart.dataset.chart}"]`).forEach((el) => el.remove());
    document.body.append(chart);
    return chart;
  };

  const openChart = (chart) => {
    chart = portal(chart);
    clearTimeout(closeTimers.get(chart));
    chart.hidden = false;
    document.documentElement.classList.add('mt-chart-lock');
    requestAnimationFrame(() => requestAnimationFrame(() => chart.classList.add('mt-chart--open')));
    chart.querySelector('.mt-chart__close')?.focus({ preventScroll: true });
  };

  const closeChart = (chart, restoreFocus) => {
    if (!chart || chart.hidden) return;
    chart.classList.remove('mt-chart--open');
    document.documentElement.classList.remove('mt-chart-lock');
    const finish = () => {
      chart.hidden = true;
    };
    if (reducedMq.matches) finish();
    else closeTimers.set(chart, setTimeout(finish, 450));
    if (restoreFocus) trigger?.focus({ preventScroll: true });
    trigger = null;
  };

  document.addEventListener('click', (event) => {
    const open = event.target.closest('[data-chart-open]');
    if (open) {
      const chart = document.querySelector(`[data-chart="${open.dataset.chartOpen}"]`);
      if (chart) {
        event.preventDefault();
        trigger = open;
        openChart(chart);
      }
      return;
    }
    const close = event.target.closest('[data-chart-close]');
    if (close) closeChart(close.closest('.mt-chart'), true);
  });

  document.addEventListener(
    'keydown',
    (event) => {
      const chart = openedChart();
      if (!chart) return;
      if (event.key === 'Escape') {
        event.stopPropagation();
        closeChart(chart, true);
        return;
      }
      if (event.key === 'Tab') window.mtFocusTrap(event, chart);
    },
    true
  );

  window.addEventListener('pageshow', (event) => {
    if (!event.persisted) return;
    document.querySelectorAll('.mt-chart').forEach((chart) => {
      clearTimeout(closeTimers.get(chart));
      chart.classList.remove('mt-chart--open');
      chart.hidden = true;
    });
    document.documentElement.classList.remove('mt-chart-lock');
    trigger = null;
  });

  document.addEventListener('shopify:section:load', () => {
    if (!openedChart()) document.documentElement.classList.remove('mt-chart-lock');
  });
}
