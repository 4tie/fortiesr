const API_BASE = window.location.origin;
let latestRunId = null;
let lastAnalysis = null;

function status(selector, text) {
  const el = document.querySelector(selector);
  if (!el) return;
  if (typeof text !== 'string') {
    if (text && text.nodeType) {
      el.innerHTML = '';
      el.appendChild(text);
    }
    return;
  }
  el.textContent = text;
}

function show(id) {
  document.querySelectorAll('.pane').forEach((el) => {
    el.classList.toggle('active', el.id === id);
  });
  document.querySelectorAll('.tab').forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.target === id);
  });
}

async function api(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {'Content-Type': 'application/json'},
    ...options,
  });
  if (!res.ok) {
    const message = await res.text();
    throw new Error(message || res.statusText);
  }
  return res.json().catch(() => ({}));
}

async function loadLatestRun() {
  try {
    const data = await api('/api/aero/latest-run');
    latestRunId = data.latest_run_id || '';
    const select = document.getElementById('existing-run');
    if (select) {
      select.innerHTML = '';
      (data.runs || []).forEach((run) => {
        const option = document.createElement('option');
        option.value = run.run_id;
        option.textContent = `${run.created_at || run.run_id} - ${run.strategy_name || 'unknown'}`;
        select.appendChild(option);
      });
    }
  } catch (e) {
    console.warn(e);
  }
}

function populateRead(visit, findings) {
  const pre = document.getElementById('read-result');
  if (!pre || !visit) return;
  const findingsCount = Array.isArray(findings) ? findings.length : 0;
  const profit = visit.strategy_profit;
  const profitClass = profit > 0 ? 'value-pos' : profit < 0 ? 'value-neg' : 'value-neutral';
  pre.innerHTML = `
    <div class="metrics">
      <div class="metric">
        <div class="metric-label">Net Profit</div>
        <div class="metric-value ${profitClass}">${profit != null ? profit.toFixed(2) + '%' : 'n/a'}</div>
      </div>
      <div class="metric">
        <div class="metric-label">Trades</div>
        <div class="metric-value">${visit.trades_count ?? 'n/a'}</div>
      </div>
      <div class="metric">
        <div class="metric-label">Win Rate</div>
        <div class="metric-value">${visit.win_rate != null ? visit.win_rate.toFixed(1) + '%' : 'n/a'}</div>
      </div>
      <div class="metric">
        <div class="metric-label">Max Drawdown</div>
        <div class="metric-value value-neg">${visit.drawdown != null ? visit.drawdown.toFixed(2) + '%' : 'n/a'}</div>
      </div>
      <div class="metric">
        <div class="metric-label">Profit Factor</div>
        <div class="metric-value">${visit.profit_factor != null ? visit.profit_factor.toFixed(3) : 'n/a'}</div>
      </div>
      <div class="metric">
        <div class="metric-label">Expectancy</div>
        <div class="metric-value">${visit.expectancy != null ? visit.expectancy.toFixed(4) : 'n/a'}</div>
      </div>
      <div class="metric">
        <div class="metric-label">Final Balance</div>
        <div class="metric-value">${visit.final_balance != null ? visit.final_balance.toFixed(2) : 'n/a'}</div>
      </div>
      <div class="metric">
        <div class="metric-label">Findings</div>
        <div class="metric-value">${findingsCount}</div>
      </div>
    </div>
  `;
}

function populateLearn(findings, improvedPath) {
  const empty = document.getElementById('learn-empty');
  const list = document.getElementById('learn-list');
  if (!list) return;
  if (empty) empty.classList.add('hidden');
  list.innerHTML = '';
  const items = Array.isArray(findings) ? findings.slice(0, 20) : [];
  if (!items.length) {
    list.innerHTML = `<li class="empty">No findings.</li>`;
    return;
  }
  items.forEach((f) => {
    const li = document.createElement('li');
    const title = document.createElement('div');
    title.className = 'finding-title';
    title.textContent = f.title || f.finding_id || 'Finding';
    const sev = document.createElement('div');
    sev.className = `severity ${String(f.severity || 'low').toLowerCase()}`;
    sev.textContent = f.severity || 'low';
    const plain = document.createElement('div');
    plain.className = 'finding-text';
    plain.textContent = f.plain_explanation || '';
    const fix = document.createElement('div');
    fix.className = 'fix-text';
    fix.textContent = f.fix_description ? `Fix: ${f.fix_description}` : '';
    li.appendChild(title);
    li.appendChild(sev);
    li.appendChild(plain);
    if (fix.textContent) li.appendChild(fix);
    list.appendChild(li);
  });
}

function populateFix(findings, improvedPath) {
  const empty = document.getElementById('fix-empty');
  const container = document.getElementById('fix-body');
  const download = document.getElementById('fix-download');
  const apply = document.getElementById('fix-apply');
  if (!container) return;
  if (empty) empty.classList.add('hidden');
  const items = Array.isArray(findings) ? findings : [];
  const applied = items.filter((f) => f.applied);
  const pending = items.filter((f) => !f.applied);

  let html = '';
  if (improvedPath) {
    if (download) {
      download.href = `/api/aero/improved/${encodeURIComponent(latestRunId || '')}/download`;
      download.classList.remove('hidden');
    }
    if (apply) {
      apply.classList.remove('hidden');
      apply.disabled = false;
    }
    html += `<div class="chip-row">
      <span class="chip chip-ok">Improved copy ready</span>
    </div>`;
  } else {
    if (download) download.classList.add('hidden');
    if (apply) {
      apply.classList.add('hidden');
      apply.disabled = true;
    }
  }
  if (pending.length) {
    html += `<div class="pending">
      <div class="pending-title">Pending suggestions</div>
      <ul class="pending-list">
        ${pending.map((f) => `<li><span class="pending-name">${f.title || f.finding_id}</span>: ${f.diff ? `<code>${escapeHtml(f.diff)}</code>` : 'no diff'}</li>`).join('')}
      </ul>
    </div>`;
  }
  if (!html) {
    html = `<div class="empty">No fixes yet.</div>`;
  }
  container.innerHTML = html;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function wireTestActions() {
  const button = document.getElementById('run-button');
  const log = document.getElementById('test-log');
  if (!button || button.dataset.aeroWired) return;
  button.dataset.aeroWired = 'true';
  button.addEventListener('click', async () => {
    if (!latestRunId) {
      try {
        const data = await api('/api/aero/latest-run');
        latestRunId = data.latest_run_id || '';
      } catch (e) {
        console.warn(e);
      }
    }
    if (!latestRunId) {
      status('#test-log', 'Select a strategy or run first.');
      return;
    }
    status('#test-log', 'Analyzing...');
    try {
      const response = await api('/api/aero/analyze', {
        method: 'POST',
        body: JSON.stringify({run_id: latestRunId}),
      });
      lastAnalysis = response;
      status('#test-log', 'Analysis complete. Checking Read, Learn, and Fix...');

      for (const name of ['read', 'learn', 'fix']) {
        if (name === 'read') populateRead(response.visit, response.findings);
        if (name === 'learn') populateLearn(response.findings, response.improved_path);
        if (name === 'fix') populateFix(response.findings, response.improved_path);
      }

      show('read');
    } catch (err) {
      status('#test-log', `Error: ${err.message}`);
    }
  });
}

function wireUploadAction() {
  const uploadAction = document.getElementById('upload-action');
  if (!uploadAction || uploadAction.dataset.aeroWired) return;
  uploadAction.dataset.aeroWired = 'true';
  uploadAction.addEventListener('click', async () => {
    const statusEl = document.getElementById('upload-status');
    const runSelect = document.getElementById('existing-run');
    try {
      if (runSelect && runSelect.value) {
        latestRunId = runSelect.value;
        if (statusEl) statusEl.textContent = `Selected run: ${latestRunId}`;
        show('test');
        wireTestActions();
      } else {
        if (statusEl) statusEl.textContent = 'Choose an existing run first.';
      }
    } catch (err) {
      if (statusEl) statusEl.textContent = `Error: ${err.message}`;
    }
  });
}

function wireFixActions() {
  const apply = document.getElementById('fix-apply');
  if (!apply || apply.dataset.aeroWired) return;
  apply.dataset.aeroWired = 'true';
  apply.addEventListener('click', async () => {
    if (!latestRunId) {
      alert('Run doctor first so AeRo knows which result to apply.');
      return;
    }
    apply.disabled = true;
    try {
      const response = await api(`/api/aero/improved/${encodeURIComponent(latestRunId)}/apply`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: '{}',
      });
      const message = response && response.applied
        ? `Applied to sandbox: ${response.path || latestRunId}`
        : 'Apply failed.';
      const statusEl = document.getElementById('fix-status');
      if (statusEl) statusEl.textContent = message;
    } catch (err) {
      const statusEl = document.getElementById('fix-status');
      if (statusEl) statusEl.textContent = `Error: ${err.message}`;
    } finally {
      apply.disabled = false;
    }
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadLatestRun();
  wireUploadAction();
  wireTestActions();
  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', async () => {
      const name = tab.dataset.target;
      show(name);
      if (name === 'upload') {
        const runSelect = document.getElementById('existing-run');
        if (runSelect && !runSelect.children.length) {
          await loadLatestRun();
        }
      }
    });
  });
});
