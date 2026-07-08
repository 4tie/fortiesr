const API_BASE = window.location.origin;
let latestRunId = null;
let lastAnalysis = null;
const loaded = new Set();

function status(selector, text) {
  const el = document.querySelector(selector);
  if (!el) return;
  if (typeof text === "string") {
    el.textContent = text;
  } else if (text && text.nodeType) {
    el.innerHTML = "";
    el.appendChild(text);
  }
}

function show(id) {
  document.querySelectorAll(".pane").forEach((el) => {
    el.classList.toggle("active", el.id === id);
  });
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.target === id);
  });
}

async function api(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {"Content-Type": "application/json"},
    ...options,
  });
  if (!res.ok) {
    const message = await res.text();
    throw new Error(message || res.statusText);
  }
  return res.json().catch(() => ({}));
}

async function loadSection(name) {
  if (loaded.has(name)) {
    populateSectionIfReady(name);
    return;
  }
  loaded.add(name);
  const pane = document.getElementById(name);
  if (!pane) return;
  try {
    const res = await fetch(`/aero/static/sections/${name}.html`);
    if (!res.ok) throw new Error(`section missing: ${res.status}`);
    pane.innerHTML = await res.text();
    attachSectionActions(name, pane);
    populateSectionIfReady(name);
  } catch (e) {
    pane.innerHTML = `<div class="error">${e.message}</div>`;
  }
}

function populateSectionIfReady(name) {
  if (!lastAnalysis) return;
  if (name === "read") populateRead(lastAnalysis.visit, lastAnalysis.findings);
  if (name === "learn") populateLearn(lastAnalysis.findings, lastAnalysis.improved_path);
  if (name === "fix") populateFix(lastAnalysis.findings, lastAnalysis.improved_path);
}

function attachSectionActions(name, pane) {
  if (name === "upload") {
    const form = pane.querySelector("#upload-form");
    const statusEl = pane.querySelector("#upload-status");
    const fileInput = pane.querySelector("#strategy-file");
    const runSelect = pane.querySelector("#existing-run");
    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        status(statusEl, "Preparing...");
        try {
          if (fileInput && fileInput.files && fileInput.files[0]) {
            const file = fileInput.files[0];
            const reader = new FileReader();
            status(statusEl, "Reading file...");
            const uploadText = await new Promise((resolve, reject) => {
              reader.onerror = () => reject(new Error("Failed to read file"));
              reader.onload = () => resolve(reader.result);
              reader.readAsDataURL(file);
            });
            const [, base64] = uploadText.split(",", 2);
            const res = await fetch(`${API_BASE}/api/aero/upload`, {
              method: "POST",
              headers: {"Content-Type": "application/json"},
              body: JSON.stringify({filename: file.name, content: base64}),
            });
            if (!res.ok) throw new Error(await res.text());
            const data = await res.json();
            latestRunId = data.run_id || latestRunId;
            status(statusEl, `Saved to: ${data.path}`);
            show("test");
            await loadSection("test");
          } else if (runSelect && runSelect.value) {
            latestRunId = runSelect.value;
            status(statusEl, `Selected run: ${latestRunId}`);
            show("test");
            await loadSection("test");
          } else {
            status(statusEl, "Choose a file or an existing run.");
          }
        } catch (err) {
          status(statusEl, `Error: ${err.message}`);
        }
      });
    }
  }
  if (name === "test") {
    const button = pane.querySelector("#run-button");
    const log = pane.querySelector("#test-log");
    if (button) {
      button.addEventListener("click", async () => {
        if (!latestRunId) {
          status(log, "Select a strategy or run first.");
          return;
        }
        status(log, "Analyzing...");
        try {
          const response = await api("/api/aero/analyze", {
            method: "POST",
            body: JSON.stringify({run_id: latestRunId}),
          });
          lastAnalysis = response;
          status(log, "Analysis complete. Check Read, Learn, and Fix tabs.");
          
          const sections = ["read", "learn", "fix"];
          for (const section of sections) {
            show(section);
            await loadSection(section);
          }
          
          populateRead(response.visit, response.findings);
          populateLearn(response.findings, response.improved_path);
          populateFix(response.findings, response.improved_path);
          
          show("read");
        } catch (err) {
          status(log, `Error: ${err.message}`);
        }
      });
    }
  }
}

function populateRead(visit, findings) {
  const pre = document.getElementById("read-result");
  if (!pre || !visit) return;
  const findingsCount = Array.isArray(findings) ? findings.length : 0;
  const profit = visit.strategy_profit;
  const profitClass = profit > 0 ? "value-pos" : profit < 0 ? "value-neg" : "value-neutral";
  pre.innerHTML = `
    <div class="metrics">
      <div class="metric">
        <div class="metric-label">Net Profit</div>
        <div class="metric-value ${profitClass}">${profit != null ? profit.toFixed(2) + "%" : "n/a"}</div>
      </div>
      <div class="metric">
        <div class="metric-label">Trades</div>
        <div class="metric-value">${visit.trades_count ?? "n/a"}</div>
      </div>
      <div class="metric">
        <div class="metric-label">Win Rate</div>
        <div class="metric-value">${visit.win_rate != null ? visit.win_rate.toFixed(1) + "%" : "n/a"}</div>
      </div>
      <div class="metric">
        <div class="metric-label">Max Drawdown</div>
        <div class="metric-value value-neg">${visit.drawdown != null ? visit.drawdown.toFixed(2) + "%" : "n/a"}</div>
      </div>
      <div class="metric">
        <div class="metric-label">Profit Factor</div>
        <div class="metric-value">${visit.profit_factor != null ? visit.profit_factor.toFixed(3) : "n/a"}</div>
      </div>
      <div class="metric">
        <div class="metric-label">Expectancy</div>
        <div class="metric-value">${visit.expectancy != null ? visit.expectancy.toFixed(4) : "n/a"}</div>
      </div>
      <div class="metric">
        <div class="metric-label">Final Balance</div>
        <div class="metric-value">${visit.final_balance != null ? visit.final_balance.toFixed(2) : "n/a"}</div>
      </div>
      <div class="metric">
        <div class="metric-label">Findings</div>
        <div class="metric-value">${findingsCount}</div>
      </div>
    </div>
  `;
}

function populateLearn(findings, improvedPath) {
  const empty = document.getElementById("learn-empty");
  const list = document.getElementById("learn-list");
  if (!list) return;
  if (empty) empty.classList.add("hidden");
  list.innerHTML = "";
  const items = Array.isArray(findings) ? findings.slice(0, 20) : [];
  if (!items.length) {
    list.innerHTML = `<li class="empty">No findings.</li>`;
    return;
  }
  items.forEach((f) => {
    const li = document.createElement("li");
    const title = document.createElement("div");
    title.className = "finding-title";
    title.textContent = f.title || f.finding_id || "Finding";
    const sev = document.createElement("div");
    sev.className = `severity ${String(f.severity || "low").toLowerCase()}`;
    sev.textContent = f.severity || "low";
    const plain = document.createElement("div");
    plain.className = "finding-text";
    plain.textContent = f.plain_explanation || "";
    const fix = document.createElement("div");
    fix.className = "fix-text";
    fix.textContent = f.fix_description ? `Fix: ${f.fix_description}` : "";
    li.appendChild(title);
    li.appendChild(sev);
    li.appendChild(plain);
    if (fix.textContent) li.appendChild(fix);
    list.appendChild(li);
  });
}

function populateFix(findings, improvedPath) {
  const empty = document.getElementById("fix-empty");
  const container = document.getElementById("fix-body");
  if (!container) return;
  if (empty) empty.classList.add("hidden");
  const items = Array.isArray(findings) ? findings : [];
  const applied = items.filter((f) => f.applied);
  const pending = items.filter((f) => !f.applied);
  
  let html = "";
  if (applied.length) {
    html += `<div class="chip-row">
      <span class="chip chip-ok">Improved copy ready: ${improvedPath ? "yes" : "pending"}</span>
      <a class="button" href="/api/aero/improved/${encodeURIComponent(latestRunId || "")}" target="_blank">Open improved copy</a>
    </div>`;
  }
  if (pending.length) {
    html += `<div class="pending">
      <div class="pending-title">Pending suggestions</div>
      <ul class="pending-list">
        ${pending.map((f) => `<li><span class="pending-name">${f.title || f.finding_id}</span>: ${f.diff ? `<code>${escapeHtml(f.diff)}</code>` : "no diff"}</li>`).join("")}
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
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function loadLatestRun() {
  try {
    const data = await api("/api/aero/latest-run");
    latestRunId = data.latest_run_id || "";
    const select = document.getElementById("existing-run");
    if (!select) return;
    select.innerHTML = "";
    (data.runs || []).forEach((run) => {
      const option = document.createElement("option");
      option.value = run.run_id;
      option.textContent = `${run.created_at || run.run_id} - ${run.strategy_name || "unknown"}`;
      select.appendChild(option);
    });
  } catch (e) {
    console.warn(e);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadLatestRun();
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", async () => {
      const name = tab.dataset.target;
      show(name);
      await loadSection(name);
    });
  });
});
