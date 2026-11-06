if (!window.mtChartInit) {
  window.mtChartInit = true;

  const reducedMq = window.mtReducedMq;
  const closeTimers = new WeakMap();
  let trigger = null;

  const openedChart = () => document.querySelector('.mt-chart:not([hidden])');

  // Chart pages are plain page-editor tables. A blank header cell joins the cell to its left,
  // a blank body cell joins the cell above (e.g. one "S" across sizes 6 and 7).
  const isBlank = (cell) => !cell.textContent.trim() && !cell.querySelector('img');
  const mergeBlankCells = (table) => {
    const rows = [...table.rows].map((row) => [...row.cells]);
    if (!rows.length || rows.some((cells) => cells.length !== rows[0].length)) return;
    let left = null;
    rows[0].forEach((cell) => {
      if (isBlank(cell) && left) {
        left.colSpan += 1;
        cell.remove();
      } else left = cell;
    });
    rows[0].forEach((_, col) => {
      let above = null;
      rows.slice(1).forEach((cells) => {
        const cell = cells[col];
        if (isBlank(cell) && above) {
          above.rowSpan += 1;
          cell.remove();
        } else if (!isBlank(cell)) above = cell;
      });
    });
  };

  const UNIT_KEY = 'mt-chart-unit';
  const storedUnit = () => {
    try {
      return localStorage.getItem(UNIT_KEY);
    } catch {
      return null;
    }
  };

  const setUnit = (chart, unit) => {
    chart.querySelectorAll('[data-chart-unit]').forEach((wrap) => {
      wrap.hidden = wrap.dataset.chartUnit !== unit;
    });
    chart.querySelectorAll('[data-chart-unit-set]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.chartUnitSet === unit));
    });
  };

  // Two tables in a row (only empty paragraphs between) are one chart: metric first, imperial second.
  const prepareChart = (chart) => {
    if (chart.dataset.chartReady) return;
    chart.dataset.chartReady = '';
    const body = chart.querySelector('.mt-chart__body');
    body.querySelectorAll('table').forEach((table) => {
      mergeBlankCells(table);
      const wrap = document.createElement('div');
      wrap.className = 'mt-chart__scroll';
      table.before(wrap);
      wrap.append(table);
    });
    let paired = false;
    body.querySelectorAll('.mt-chart__scroll').forEach((wrap) => {
      if (wrap.dataset.chartUnit) return;
      let next = wrap.nextElementSibling;
      while (next?.matches('p, br') && isBlank(next)) next = next.nextElementSibling;
      if (!next?.classList.contains('mt-chart__scroll')) return;
      wrap.dataset.chartUnit = 'metric';
      next.dataset.chartUnit = 'imperial';
      paired = true;
    });
    if (!paired) return;
    chart.querySelector('[data-chart-units]').hidden = false;
    const unit = storedUnit();
    setUnit(chart, unit === 'metric' || unit === 'imperial' ? unit : chart.dataset.chartDefaultUnit);
  };

  const portal = (chart) => {
    if (chart.parentElement === document.body) return chart;
    document.querySelectorAll(`body > [data-chart="${chart.dataset.chart}"]`).forEach((el) => el.remove());
    document.body.append(chart);
    return chart;
  };

  const openChart = (chart) => {
    chart = portal(chart);
    prepareChart(chart);
    clearTimeout(closeTimers.get(chart));
    chart.hidden = false;
    document.documentElement.classList.add('mt-chart-lock');
    requestAnimationFrame(() => requestAnimationFrame(() => chart.classList.add('mt-chart--open')));
    chart.querySelector('.mt-chart__panel')?.focus({ preventScroll: true });
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
    // Kiwi Size Chart (app block on the PDP) injects its own .ks-chart-modal-link once it has a chart
    // for this product; the theme button then opens Kiwi's chart, otherwise the page fallback below.
    const kiwiLink = event.target.closest('[data-chart-kiwi]') && document.querySelector('.ks-chart-modal-link');
    if (kiwiLink) {
      event.preventDefault();
      kiwiLink.click();
      return;
    }
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
    const unitButton = event.target.closest('[data-chart-unit-set]');
    if (unitButton) {
      const unit = unitButton.dataset.chartUnitSet;
      setUnit(unitButton.closest('.mt-chart'), unit);
      try {
        localStorage.setItem(UNIT_KEY, unit);
      } catch {}
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
