/* Comparison uses full imported peaks, independent of plot ranges and label thresholds. */
var SpectrumComparison = (() => {
  function buildRows(spectra, tolerance = 0, unit = 'da') {
    if (!Number.isFinite(tolerance) || tolerance < 0) throw new Error('Enter a non-negative tolerance.');
    const peaks = spectra.flatMap((s, column) => s.peaks
      .filter(p => Number.isFinite(p.mz) && p.mz > 0 && Number.isFinite(p.intensity) && p.intensity > 0)
      .map(p => ({ ...p, column })));
    peaks.sort((a, b) => a.mz - b.mz || a.column - b.column || b.intensity - a.intensity);
    const rows = [];
    for (const peak of peaks) {
      let row = rows[rows.length - 1];
      const limit = row ? (unit === 'ppm' ? row.mz * tolerance / 1e6 : tolerance) : 0;
      // Compare against the lowest mass, preventing chains wider than the tolerance.
      if (!row || peak.mz - row.mz > limit + (tolerance === 0 ? 0 : Number.EPSILON * Math.max(1, peak.mz) * 4)) {
        row = { mz: peak.mz, maxMz: peak.mz, cells: Array(spectra.length).fill(null) };
        rows.push(row);
      }
      row.maxMz = peak.mz;
      const cell = row.cells[peak.column];
      if (!cell) row.cells[peak.column] = { intensity: peak.intensity, count: 1, mz: peak.mz };
      else {
        cell.count++;
        if (peak.intensity > cell.intensity) { cell.intensity = peak.intensity; cell.mz = peak.mz; }
      }
    }
    return rows;
  }
  function formatIntensity(value) {
    return value !== 0 && Math.abs(value) < 0.001 ? value.toExponential(3) : String(Number(value.toPrecision(6)));
  }
  function matrix(spectra, rows, mode) {
    const maxima = spectra.map(s => s.peaks.reduce((max,p) => (Number.isFinite(p.mz) && p.mz > 0 && Number.isFinite(p.intensity) ? Math.max(max, p.intensity) : max), 0));
    const suffix = mode === 'relative' ? ' (%)' : mode === 'raw' ? ' (intensity)' : '';
    return [['m/z (lowest in group)', ...spectra.map(s => s.name + suffix)],
      ...rows.map(row => [String(row.mz), ...row.cells.map((cell, i) => !cell ? '—' : mode === 'presence' ? '✓' : formatIntensity(mode === 'relative' ? cell.intensity / maxima[i] * 100 : cell.intensity))])];
  }
  function serialize(data, delimiter) {
    return data.map(row => row.map(value => {
      let text = String(value);
      // Treat user-provided names as text in spreadsheet applications.
      if (/^[=+@-]/.test(text)) text = "'" + text;
      return /["\r\n\t,]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
    }).join(delimiter)).join('\r\n');
  }
  let active = false, selection = new Map(), data = [], page = 0;
  const pageSize = 200;
  const el = id => document.getElementById(id);
  function sources() { return spectrumSlots.map(slot => ({ ...slot, ...parseSpectrum(slot.data) })); }
  function syncSources() {
    const spectra = sources();
    const list = el('comparisonSpectra');
    list.replaceChildren();
    spectra.forEach(s => {
      if (!selection.has(s.id)) selection.set(s.id, s.visible !== false);
      const label = document.createElement('label');
      const check = document.createElement('input');
      check.type = 'checkbox'; check.checked = selection.get(s.id);
      check.addEventListener('change', () => { selection.set(s.id, check.checked); page = 0; render(); });
      label.append(check, document.createTextNode(s.name || 'Untitled spectrum'));
      list.append(label);
    });
    for (const id of selection.keys()) if (!spectra.some(s => s.id === id)) selection.delete(id);
    return spectra.filter(s => selection.get(s.id));
  }
  function render() {
    if (!active) return;
    const spectra = syncSources();
    const table = el('comparisonTable'); table.replaceChildren();
    data = [];
    const tolerance = el('comparisonTolerance').value.trim() === '' ? NaN : Number(el('comparisonTolerance').value);
    let rows;
    try { rows = buildRows(spectra, tolerance, el('comparisonUnit').value); }
    catch (error) { el('comparisonSummary').textContent = error.message; updateButtons(0); return; }
    if (!spectra.length) { el('comparisonSummary').textContent = 'Select at least one spectrum.'; updateButtons(0); return; }
    data = matrix(spectra, rows, el('comparisonMode').value);
    page = Math.max(0, Math.min(page, Math.ceil(rows.length / pageSize) - 1));
    const head = document.createElement('thead'), header = document.createElement('tr');
    data[0].forEach(text => { const cell = document.createElement('th'); cell.scope = 'col'; cell.textContent = text; header.append(cell); });
    head.append(header); table.append(head);
    const body = document.createElement('tbody');
    data.slice(1 + page * pageSize, 1 + (page + 1) * pageSize).forEach((values, offset) => {
      const row = document.createElement('tr');
      const source = rows[page * pageSize + offset];
      values.forEach((text,i) => {
        const cell = document.createElement(i === 0 ? 'th' : 'td');
        cell.textContent = text;
        if (!i) { cell.scope = 'row'; cell.title = `Group range: ${source.mz}–${source.maxMz}`; }
        else { const match = source.cells[i - 1]; cell.title = match ? `Matched m/z: ${match.mz}; ${match.count} peak(s); maximum intensity used` : 'No positive-intensity peak in this group'; }
        row.append(cell);
      }); body.append(row);
    }); table.append(body);
    const skipped = spectra.reduce((n,s) => n + s.skipped, 0);
    const empty = spectra.filter(s => !s.peaks.some(p => p.mz > 0 && p.intensity > 0)).length;
    el('comparisonSummary').textContent = `${rows.length} m/z groups · ${spectra.length} spectra · tolerance ${tolerance} ${el('comparisonUnit').value === 'ppm' ? 'ppm' : 'm/z'}.` + (rows.length ? ` Showing ${page * pageSize + 1}–${Math.min((page + 1) * pageSize, rows.length)}.` : ' No positive-intensity peaks.') + (empty ? ` ${empty} selected spectrum/spectra have no positive-intensity peaks.` : '') + (skipped ? ` ${skipped} unreadable line(s) skipped.` : '');
    updateButtons(rows.length);
  }
  function updateButtons(count) {
    el('copyComparison').disabled = !count; el('exportComparison').disabled = !count;
    el('comparisonPrevious').disabled = page === 0 || !count;
    el('comparisonNext').disabled = (page + 1) * pageSize >= count;
  }
  function toggle() {
    active = !active;
    if (active && annotationStage) setAnnotationStage(false);
    el('comparisonPanel').hidden = !active;
    el('plotViewport').hidden = active;
    el('finalSizePreviewInfo').style.display = active ? 'none' : '';
    el('toggleAnnotations').disabled = active;
    el('toggleComparison').textContent = active ? 'Back to spectrum' : 'Compare spectra';
    el('toggleComparison').setAttribute('aria-expanded', String(active));
    if (active) { page = 0; render(); }
    else if (el('plot').data) Plotly.Plots.resize(el('plot'));
  }
  function refresh() { if (active) render(); }
  function init() {
    el('toggleComparison').addEventListener('click', toggle);
    ['comparisonTolerance', 'comparisonUnit', 'comparisonMode'].forEach(id => el(id).addEventListener('input', () => { page = 0; render(); }));
    el('comparisonPrevious').addEventListener('click', () => { page--; render(); });
    el('comparisonNext').addEventListener('click', () => { page++; render(); });
    el('copyComparison').addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(serialize(data, '\t')); el('comparisonSummary').textContent = 'Full table copied. Paste it into your document or spreadsheet.'; }
      catch { el('comparisonSummary').textContent = 'Clipboard unavailable. Use Download CSV instead.'; }
    });
    el('exportComparison').addEventListener('click', () => {
      const url = URL.createObjectURL(new Blob(['\uFEFF' + serialize(data, ',')], {type: 'text/csv;charset=utf-8'}));
      const link = document.createElement('a'); link.href = url; link.download = 'spectrum-comparison.csv'; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  }
  return { buildRows, formatIntensity, matrix, serialize, init, refresh };
})();
if (typeof module !== 'undefined') module.exports = SpectrumComparison;