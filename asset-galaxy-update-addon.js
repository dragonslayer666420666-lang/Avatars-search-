(() => {
  "use strict";

  const SETTINGS_KEY = "ag_settings_v1";
  const LOG_KEY = "ag_logs_v1";
  const UPDATE_KEY = "ag_update_request_v1";

  const defaults = {
    mode: "council",
    role: "playcanvas",
    workspace: true,
    search: true,
    queue: true,
    compact: false,
    confirmClear: true,
    autoScroll: true
  };

  let settings = load(SETTINGS_KEY, defaults);
  let logs = load(LOG_KEY, []);

  function $(selector, root = document) {
    return root.querySelector(selector);
  }

  function $$(selector, root = document) {
    return [...root.querySelectorAll(selector)];
  }

  function load(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key)) || JSON.parse(JSON.stringify(fallback));
    } catch {
      return JSON.parse(JSON.stringify(fallback));
    }
  }

  function saveSettings() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }

  function saveLogs() {
    logs = logs.slice(-200);
    localStorage.setItem(LOG_KEY, JSON.stringify(logs));
  }

  function log(category, title, details = "") {
    logs.push({
      time: new Date().toISOString(),
      category,
      title,
      details
    });

    saveLogs();
    renderLogs();
    updateBadge();
  }

  function safe(text) {
    return String(text || "").replace(/[&<>"']/g, character => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[character]);
  }

  function addStyles() {
    const style = document.createElement("style");

    style.textContent = `
      #aifusionPanel button,
      #aifusionPanel input,
      #aifusionPanel select,
      #aifusionPanel textarea {
        appearance:none;
        -webkit-appearance:none;
        color:#f5f7ff!important;
        background:#080e1e!important;
        border:1px solid rgba(115,236,255,.2)!important;
        box-shadow:none!important;
      }

      #aifusionPanel input::placeholder,
      #aifusionPanel textarea::placeholder {
        color:#7883a5!important;
      }

      #aifusionPanel select option {
        color:white;
        background:#080e1e;
      }

      #aifusionPanel .ai-fusion-primary,
      .ag-primary {
        color:#06101b!important;
        background:linear-gradient(135deg,#63e6ff,#aa78ff)!important;
        border:0!important;
      }

      #aifusionPanel.ag-compact .ai-fusion-hero,
      #aifusionPanel.ag-compact .ai-fusion-note {
        display:none;
      }

      .ag-toolbar {
        position:sticky;
        top:132px;
        z-index:75;
        display:grid;
        grid-template-columns:repeat(4,1fr);
        gap:6px;
        margin:0 0 12px;
        padding:7px;
        border:1px solid rgba(99,230,255,.22);
        border-radius:15px;
        background:rgba(7,12,25,.96);
      }

      .ag-toolbar button {
        min-width:0;
        min-height:42px;
        padding:7px 4px;
        border-radius:10px;
        font-size:11px;
        font-weight:900;
      }

      .ag-badge {
        display:inline-grid;
        place-items:center;
        min-width:17px;
        height:17px;
        margin-left:3px;
        padding:0 3px;
        border-radius:999px;
        color:#06101b;
        background:#63e6ff;
        font-size:9px;
      }

      .ag-modal {
        position:fixed;
        inset:0;
        z-index:300;
        display:grid;
        place-items:center;
        padding:10px;
        background:rgba(1,4,12,.8);
        backdrop-filter:blur(9px);
      }

      .ag-hidden {
        display:none!important;
      }

      .ag-panel {
        width:min(760px,100%);
        max-height:92vh;
        display:flex;
        flex-direction:column;
        overflow:hidden;
        border:1px solid rgba(115,236,255,.23);
        border-radius:21px;
        color:#f5f7ff;
        background:linear-gradient(145deg,#11172b,#080d1a);
      }

      .ag-head {
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:10px;
        padding:13px;
        border-bottom:1px solid rgba(255,255,255,.1);
      }

      .ag-head h3 {
        margin:0;
        font-size:17px;
      }

      .ag-close {
        width:41px;
        height:41px;
        border:1px solid rgba(255,255,255,.12);
        border-radius:11px;
        color:white;
        background:rgba(255,255,255,.05);
      }

      .ag-tabs {
        display:flex;
        gap:7px;
        overflow-x:auto;
        padding:10px;
      }

      .ag-tab {
        flex:0 0 auto;
        padding:9px 11px;
        border:1px solid rgba(255,255,255,.1);
        border-radius:999px;
        color:#aeb8d8;
        background:rgba(255,255,255,.04);
        font-size:11px;
        font-weight:900;
      }

      .ag-tab.active {
        color:#06101b;
        border-color:transparent;
        background:linear-gradient(135deg,#63e6ff,#aa78ff);
      }

      .ag-body {
        overflow:auto;
        padding:13px;
      }

      .ag-page {
        display:none;
      }

      .ag-page.active {
        display:block;
      }

      .ag-section {
        margin-bottom:11px;
        padding:12px;
        border:1px solid rgba(255,255,255,.09);
        border-radius:14px;
        background:rgba(255,255,255,.03);
      }

      .ag-section h4 {
        margin:0 0 5px;
      }

      .ag-section p {
        margin:0;
        color:#9ca6c7;
        font-size:12px;
        line-height:1.5;
      }

      .ag-field {
        display:grid;
        gap:5px;
        margin-top:10px;
      }

      .ag-field label {
        font-size:11px;
        font-weight:900;
      }

      .ag-field input,
      .ag-field select,
      .ag-field textarea {
        width:100%;
        padding:11px;
        border:1px solid rgba(115,236,255,.18);
        border-radius:11px;
        outline:0;
        color:white;
        background:#080e1e;
        font:inherit;
      }

      .ag-field textarea {
        min-height:95px;
        resize:vertical;
      }

      .ag-check {
        display:flex;
        align-items:flex-start;
        gap:8px;
        margin-top:10px;
        font-size:12px;
        line-height:1.4;
      }

      .ag-check input {
        width:18px;
        height:18px;
        accent-color:#63e6ff;
      }

      .ag-actions {
        display:flex;
        flex-wrap:wrap;
        gap:8px;
        margin-top:11px;
      }

      .ag-actions button,
      .ag-actions a {
        flex:1 1 135px;
        min-height:42px;
        display:grid;
        place-items:center;
        padding:9px;
        border:1px solid rgba(255,255,255,.11);
        border-radius:11px;
        color:white;
        background:rgba(255,255,255,.05);
        font-size:11px;
        font-weight:900;
        text-align:center;
        text-decoration:none;
      }

      .ag-help {
        margin-top:9px;
        padding:10px;
        border:1px solid rgba(255,255,255,.08);
        border-radius:11px;
        background:rgba(255,255,255,.025);
      }

      .ag-help strong {
        display:block;
        margin-bottom:4px;
      }

      .ag-help span {
        color:#9ca6c7;
        font-size:11px;
        line-height:1.45;
      }

      .ag-log {
        margin-top:8px;
        padding:10px;
        border:1px solid rgba(255,255,255,.08);
        border-radius:11px;
        background:rgba(255,255,255,.025);
      }

      .ag-log-top {
        display:flex;
        justify-content:space-between;
        gap:8px;
      }

      .ag-log-category {
        color:#bff9ff;
        font-size:9px;
        font-weight:900;
        text-transform:uppercase;
      }

      .ag-log-time {
        color:#7f89aa;
        font-size:9px;
      }

      .ag-log strong {
        display:block;
        margin-top:6px;
        font-size:12px;
      }

      .ag-log p {
        margin:4px 0 0;
        color:#9ca6c7;
        font-size:11px;
        white-space:pre-wrap;
        overflow-wrap:anywhere;
      }

      .ag-empty {
        padding:22px;
        text-align:center;
        color:#9ca6c7;
        font-size:12px;
      }
    `;

    document.head.appendChild(style);
  }

  function addToolbar() {
    const panel = $("#aifusionPanel");
    if (!panel || $("#agToolbar")) return;

    const toolbar = document.createElement("div");
    toolbar.id = "agToolbar";
    toolbar.className = "ag-toolbar";

    toolbar.innerHTML = `
      <button data-open="settings">⚙ Settings</button>
      <button id="agRefresh">↻ Refresh</button>
      <button data-open="help">? Help</button>
      <button data-open="logs">Logs <span class="ag-badge" id="agBadge">0</span></button>
    `;

    const hero = panel.querySelector(".ai-fusion-hero");
    hero?.after(toolbar);

    $("#agRefresh").addEventListener("click", () => {
      log("system", "Website refreshed", "Refresh button tapped.");
      location.reload();
    });

    $$("[data-open]", toolbar).forEach(button => {
      button.addEventListener("click", () => openModal(button.dataset.open));
    });
  }

  function addModal() {
    if ($("#agModal")) return;

    const modal = document.createElement("div");
    modal.id = "agModal";
    modal.className = "ag-modal ag-hidden";

    modal.innerHTML = `
      <div class="ag-panel">
        <div class="ag-head">
          <h3>Asset Galaxy Control Center</h3>
          <button class="ag-close" id="agClose">✕</button>
        </div>

        <div class="ag-tabs">
          <button class="ag-tab active" data-tab="settings">Settings</button>
          <button class="ag-tab" data-tab="updates">Updates</button>
          <button class="ag-tab" data-tab="help">Help</button>
          <button class="ag-tab" data-tab="logs">Activity Log</button>
        </div>

        <div class="ag-body">
          <section class="ag-page active" data-page="settings">
            <div class="ag-section">
              <h4>AI Fusion settings</h4>
              <p>Choose the defaults used by your AI Fusion controls.</p>

              <div class="ag-field">
                <label>Fusion level</label>
                <select id="agMode">
                  <option value="fast">Fast · 1 model</option>
                  <option value="council">Council · up to 3</option>
                  <option value="full">Full fusion · up to 6</option>
                </select>
              </div>

              <div class="ag-field">
                <label>Assistant role</label>
                <select id="agRole">
                  <option value="playcanvas">PlayCanvas builder</option>
                  <option value="debugger">Bug and code debugger</option>
                  <option value="assets">Game asset planner</option>
                  <option value="designer">Game design assistant</option>
                  <option value="general">General AI assistant</option>
                </select>
              </div>

              <label class="ag-check"><input id="agWorkspace" type="checkbox"> Include Code Hub workspace</label>
              <label class="ag-check"><input id="agSearch" type="checkbox"> Include current asset search</label>
              <label class="ag-check"><input id="agQueue" type="checkbox"> Include PlayCanvas queue</label>
              <label class="ag-check"><input id="agCompact" type="checkbox"> Compact phone layout</label>
              <label class="ag-check"><input id="agConfirm" type="checkbox"> Confirm before clearing chat</label>
              <label class="ag-check"><input id="agScroll" type="checkbox"> Auto-scroll to newest response</label>

              <div class="ag-actions">
                <button class="ag-primary" id="agSave">Save Settings</button>
                <button id="agReset">Reset Defaults</button>
              </div>
            </div>
          </section>

          <section class="ag-page" data-page="updates">
            <div class="ag-section">
              <h4>Safe Update Assistant</h4>
              <p>AI prepares the update. You still review and approve the GitHub edit.</p>

              <div class="ag-field">
                <label>Website update request</label>
                <textarea id="agUpdate" placeholder="Describe the update you want..."></textarea>
              </div>

              <div class="ag-actions">
                <button class="ag-primary" id="agPrepare">Prepare with AI Fusion</button>
                <button id="agCopyUpdate">Copy Request</button>
                <a href="https://github.com/dragonslayer666420666-lang/Avatars-search-/edit/main/index.html" target="_blank">Open index.html</a>
              </div>
            </div>

            <div class="ag-section">
              <h4>Add update, fix, bug, or glitch</h4>

              <div class="ag-field">
                <label>Log type</label>
                <select id="agManualType">
                  <option value="update">Update</option>
                  <option value="fix">Fix</option>
                  <option value="bug">Bug</option>
                  <option value="glitch">Glitch</option>
                </select>
              </div>

              <div class="ag-field">
                <label>Details</label>
                <textarea id="agManualText" placeholder="Describe what happened..."></textarea>
              </div>

              <div class="ag-actions">
                <button class="ag-primary" id="agAddLog">Add to Activity Log</button>
              </div>
            </div>
          </section>

          <section class="ag-page" data-page="help">
            <div class="ag-section">
              <h4>Help</h4>

              <div class="ag-help">
                <strong>Worker not tested</strong>
                <span>Paste the Worker URL, save it, then tap Test.</span>
              </div>

              <div class="ag-help">
                <strong>Authentication error</strong>
                <span>Check the Cloudflare secret named OPENROUTER_API_KEY.</span>
              </div>

              <div class="ag-help">
                <strong>Website shows an older update</strong>
                <span>Wait about one minute, then use the Refresh button.</span>
              </div>

              <div class="ag-help">
                <strong>Bug or glitch</strong>
                <span>Add it under Updates so it is saved in the Activity Log.</span>
              </div>

              <div class="ag-actions">
                <button id="agHelpRefresh">Refresh Website</button>
                <button data-switch="logs">Open Activity Log</button>
                <a href="https://github.com/dragonslayer666420666-lang/Avatars-search-/issues" target="_blank">GitHub Issues</a>
              </div>
            </div>
          </section>

          <section class="ag-page" data-page="logs">
            <div class="ag-section">
              <h4>Activity Log</h4>
              <p>Tracks updates, fixes, bugs, glitches, AI messages, and browser errors.</p>

              <div class="ag-field">
                <label>Filter</label>
                <select id="agFilter">
                  <option value="all">All activity</option>
                  <option value="update">Updates</option>
                  <option value="fix">Fixes</option>
                  <option value="bug">Bugs</option>
                  <option value="glitch">Glitches</option>
                  <option value="error">Errors</option>
                  <option value="ai">AI Fusion</option>
                  <option value="system">System</option>
                </select>
              </div>

              <div id="agLogList"></div>

              <div class="ag-actions">
                <button id="agCopyLogs">Copy Logs</button>
                <button id="agDownloadLogs">Download Logs</button>
                <button id="agClearLogs">Clear Logs</button>
              </div>
            </div>
          </section>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    $("#agClose").addEventListener("click", closeModal);

    modal.addEventListener("click", event => {
      if (event.target === modal) closeModal();
    });

    $$(".ag-tab").forEach(button => {
      button.addEventListener("click", () => switchPage(button.dataset.tab));
    });

    $$("[data-switch]").forEach(button => {
      button.addEventListener("click", () => switchPage(button.dataset.switch));
    });

    bindControls();
    fillSettings();
    renderLogs();
  }

  function openModal(page) {
    $("#agModal").classList.remove("ag-hidden");
    document.body.style.overflow = "hidden";
    switchPage(page);
  }

  function closeModal() {
    $("#agModal").classList.add("ag-hidden");
    document.body.style.overflow = "";
  }

  function switchPage(page) {
    $$(".ag-tab").forEach(button => {
      button.classList.toggle("active", button.dataset.tab === page);
    });

    $$(".ag-page").forEach(panel => {
      panel.classList.toggle("active", panel.dataset.page === page);
    });

    if (page === "logs") renderLogs();
  }

  function fillSettings() {
    $("#agMode").value = settings.mode;
    $("#agRole").value = settings.role;
    $("#agWorkspace").checked = settings.workspace;
    $("#agSearch").checked = settings.search;
    $("#agQueue").checked = settings.queue;
    $("#agCompact").checked = settings.compact;
    $("#agConfirm").checked = settings.confirmClear;
    $("#agScroll").checked = settings.autoScroll;
    $("#agUpdate").value = localStorage.getItem(UPDATE_KEY) || "";
  }

  function applySettings() {
    $("#aifusionPanel")?.classList.toggle("ag-compact", settings.compact);

    const values = [
      ["#aiFusionMode", settings.mode],
      ["#aiFusionRole", settings.role]
    ];

    values.forEach(([selector, value]) => {
      const element = $(selector);
      if (element) element.value = value;
    });

    const checks = [
      ["#aiFusionIncludeWorkspace", settings.workspace],
      ["#aiFusionIncludeSearch", settings.search],
      ["#aiFusionIncludeQueue", settings.queue]
    ];

    checks.forEach(([selector, value]) => {
      const element = $(selector);
      if (element) element.checked = value;
    });
  }

  function updatePrompt(request) {
    return `Prepare a reviewed update for my Asset Galaxy GitHub Pages website.

REQUEST:
${request}

RULES:
- Preserve every working feature.
- Never include passwords, API keys, or tokens.
- State the exact file and exact changes.
- Check for bugs, glitches, broken HTML, and duplicate event listeners.
- Give phone-friendly testing instructions.
- Do not claim anything was committed or published.
- Wait for my approval before destructive changes.`;
  }

  async function copy(text) {
    await navigator.clipboard.writeText(text);
  }

  function bindControls() {
    $("#agSave").addEventListener("click", () => {
      settings = {
        mode: $("#agMode").value,
        role: $("#agRole").value,
        workspace: $("#agWorkspace").checked,
        search: $("#agSearch").checked,
        queue: $("#agQueue").checked,
        compact: $("#agCompact").checked,
        confirmClear: $("#agConfirm").checked,
        autoScroll: $("#agScroll").checked
      };

      saveSettings();
      applySettings();
      log("update", "Settings saved", JSON.stringify(settings));
    });

    $("#agReset").addEventListener("click", () => {
      settings = JSON.parse(JSON.stringify(defaults));
      saveSettings();
      fillSettings();
      applySettings();
      log("fix", "Settings reset", "Defaults restored.");
    });

    $("#agUpdate").addEventListener("input", event => {
      localStorage.setItem(UPDATE_KEY, event.target.value);
    });

    $("#agPrepare").addEventListener("click", () => {
      const request = $("#agUpdate").value.trim();

      if (!request) {
        alert("Describe the update first.");
        return;
      }

      const prompt = $("#aiFusionPrompt");
      const send = $("#aiFusionSend");

      if (!prompt || !send) {
        log("error", "AI Fusion controls missing", "Refresh the website.");
        alert("AI Fusion controls were not found.");
        return;
      }

      prompt.value = updatePrompt(request);
      log("update", "Update sent to AI Fusion", request);
      closeModal();
      send.click();
    });

    $("#agCopyUpdate").addEventListener("click", async () => {
      const request = $("#agUpdate").value.trim();

      if (!request) {
        alert("Describe the update first.");
        return;
      }

      try {
        await copy(updatePrompt(request));
        log("system", "Update request copied", request);
      } catch {
        alert("Copy failed.");
      }
    });

    $("#agAddLog").addEventListener("click", () => {
      const type = $("#agManualType").value;
      const details = $("#agManualText").value.trim();

      if (!details) {
        alert("Enter the log details first.");
        return;
      }

      log(type, `Manual ${type} entry`, details);
      $("#agManualText").value = "";
      switchPage("logs");
    });

    $("#agHelpRefresh").addEventListener("click", () => {
      log("system", "Website refreshed from Help");
      location.reload();
    });

    $("#agFilter").addEventListener("change", renderLogs);

    $("#agCopyLogs").addEventListener("click", async () => {
      try {
        await copy(logText());
      } catch {
        alert("Copy failed.");
      }
    });

    $("#agDownloadLogs").addEventListener("click", () => {
      const blob = new Blob([logText()], {
        type: "text/plain;charset=utf-8"
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `asset-galaxy-log-${Date.now()}.txt`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });

    $("#agClearLogs").addEventListener("click", () => {
      if (!confirm("Clear all activity logs?")) return;
      logs = [];
      saveLogs();
      log("system", "Activity log cleared");
    });

    const clearChat = $("#aiFusionClearChat");

    clearChat?.addEventListener("click", event => {
      if (settings.confirmClear && !confirm("Clear the AI Fusion conversation?")) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }, true);
  }

  function renderLogs() {
    const list = $("#agLogList");
    if (!list) return;

    const filter = $("#agFilter")?.value || "all";

    const shown = logs
      .filter(item => filter === "all" || item.category === filter)
      .slice()
      .reverse();

    list.innerHTML = shown.length
      ? shown.map(item => `
          <article class="ag-log">
            <div class="ag-log-top">
              <span class="ag-log-category">${safe(item.category)}</span>
              <span class="ag-log-time">${safe(new Date(item.time).toLocaleString())}</span>
            </div>
            <strong>${safe(item.title)}</strong>
            ${item.details ? `<p>${safe(item.details)}</p>` : ""}
          </article>
        `).join("")
      : `<div class="ag-empty">No activity logs yet.</div>`;
  }

  function updateBadge() {
    const badge = $("#agBadge");
    if (badge) badge.textContent = String(Math.min(logs.length, 99));
  }

  function logText() {
    return [
      "ASSET GALAXY ACTIVITY LOG",
      "",
      ...logs.map(item =>
        `[${item.time}] [${item.category.toUpperCase()}] ${item.title}\n${item.details || ""}\n`
      )
    ].join("\n");
  }

  function automaticLogging() {
    window.addEventListener("error", event => {
      log("error", "Browser error", event.message || "Unknown error");
    });

    window.addEventListener("unhandledrejection", event => {
      log("error", "Promise error", String(event.reason || "Unknown error"));
    });

    const status = $("#aiFusionConnectionStatus");

    if (status) {
      let oldStatus = status.textContent;

      new MutationObserver(() => {
        const current = status.textContent.trim();

        if (current && current !== oldStatus) {
          oldStatus = current;

          log(
            current.toLowerCase().includes("failed") ? "error" : "ai",
            "AI Fusion status changed",
            current
          );
        }
      }).observe(status, {
        childList: true,
        subtree: true,
        characterData: true
      });
    }

    const messages = $("#aiFusionMessages");

    if (messages) {
      new MutationObserver(() => {
        if (settings.autoScroll) {
          messages.scrollTop = messages.scrollHeight;
        }
      }).observe(messages, {
        childList: true,
        subtree: true
      });
    }
  }

  function start() {
    addStyles();
    addToolbar();
    addModal();
    applySettings();
    automaticLogging();
    updateBadge();

    log("system", "Control Center loaded",
      "Settings, Refresh, Help, Updates, and Activity Log are active.");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
