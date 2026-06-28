class AgentWatch {
    constructor(parentId) {
        if (!parentId) throw "Missing parameters";

        this.parent = document.getElementById(parentId);
        const container = document.createElement("div");
        container.id = "mod_agentwatch";
        container.className = "augmented-card"; // Hook to the styling of the app cards
        container.setAttribute("augmented-ui", "border");
        container.innerHTML = `
            <h1>AI AGENT WATCH<i>LIVE SESSIONS</i></h1>
            <table class="aw-table" id="aw_table_body"></table>
            <canvas id="mod_agentwatch_gauge" width="80" height="44"></canvas>
            <div class="aw-stats">
                <div class="aw-stat-row"><span>TODAY COST</span><strong id="aw_cost">$0.00</strong></div>
                <div class="aw-stat-row"><span>TOTAL TOKENS</span><strong id="aw_tokens">0</strong></div>
                <div class="aw-heatmap" id="aw_heatmap"></div>
                <div class="aw-tier" id="aw_tier">TYPE 0: DIGITAL WANDERER</div>
            </div>`;
        this.parent.appendChild(container);

        this._table = container.querySelector("#aw_table_body");
        this._gauge = container.querySelector("#mod_agentwatch_gauge");
        this._cost = container.querySelector("#aw_cost");
        this._tokens = container.querySelector("#aw_tokens");
        this._heatmap = container.querySelector("#aw_heatmap");
        this._tier = container.querySelector("#aw_tier");
        this._ctx = this._gauge.getContext("2d");

        this._data = { sessions: [], dailyCostUsd: 0, totalTokens: 0, dailyHistory: new Array(30).fill(0) };

        // Build initial heatmap cells
        for (let i = 0; i < 30; i++) {
            const cell = document.createElement("div");
            cell.className = "aw-heatmap-cell";
            this._heatmap.appendChild(cell);
        }

        // Listen for IPC updates
        const ipc = require("@electron/remote").ipcRenderer;
        ipc.on("agentwatch-update", (e, payload) => {
            this._data = payload;
            this._render();
        });
    }

    _render() {
        const { sessions, dailyCostUsd, totalTokens, dailyHistory } = this._data;

        // --- Session table ---
        this._table.innerHTML = "";
        const AGENT_LABELS = { claude: "CLAUDE CODE", antigravity: "ANTIGRAVITY", opencode: "OPENCODE", codex: "CODEX" };

        sessions.forEach(s => {
            const tr = document.createElement("tr");
            tr.className = s.state === "active" ? "aw-active" : "aw-idle";

            const ctxPct = typeof s.ctxUsedPct === "number" ? s.ctxUsedPct : null;
            const barClass = ctxPct === null ? "" : ctxPct >= 90 ? "danger" : ctxPct >= 65 ? "warn" : "";
            const barWidth = ctxPct !== null ? ctxPct : 0;
            const inFmt = this._fmtTokens(s.tokensIn);
            const outFmt = this._fmtTokens(s.tokensOut);
            const modelShort = (s.model || "").replace("claude-", "").replace("gpt-", "").slice(0, 14);

            tr.innerHTML = `
                <td>${AGENT_LABELS[s.agent] || s.agent.toUpperCase()}</td>
                <td>${modelShort}</td>
                <td>${inFmt}</td>
                <td>${outFmt}</td>
                <td><div class="aw-ctx-bar-wrap"><div class="aw-ctx-bar-fill ${barClass}" style="width:${barWidth}%"></div></div></td>
                <td><span class="aw-state ${s.state}">${s.state.toUpperCase()}</span></td>`;
            this._table.appendChild(tr);
        });

        // --- Gauge (most active session) ---
        const activeSession = sessions.filter(s => s.state === "active").sort((a, b) => b.lastActivity - a.lastActivity)[0];
        this._drawGauge(activeSession ? (activeSession.ctxUsedPct || 0) : 0);

        // --- Stats ---
        const costStr = "$" + dailyCostUsd.toFixed(2);
        if (this._cost.textContent !== costStr) this._cost.textContent = costStr;
        const tokStr = this._fmtTokens(totalTokens);
        if (this._tokens.textContent !== tokStr) this._tokens.textContent = tokStr;

        // --- Heatmap ---
        const maxDay = Math.max(1, ...dailyHistory);
        const cells = this._heatmap.querySelectorAll(".aw-heatmap-cell");
        dailyHistory.forEach((val, i) => {
            if (!cells[i]) return;
            const ratio = val / maxDay;
            const cls = ratio > 0.75 ? "d4" : ratio > 0.5 ? "d3" : ratio > 0.25 ? "d2" : ratio > 0 ? "d1" : "";
            cells[i].className = "aw-heatmap-cell" + (cls ? " " + cls : "");
        });

        // --- Tier ---
        const tier = this._kardashevTier(totalTokens);
        if (this._tier.textContent !== tier) this._tier.textContent = tier;
    }

    _drawGauge(pct) {
        const ctx = this._ctx;
        const w = this._gauge.width, h = this._gauge.height;
        const cx = w / 2, cy = h - 4;
        const r = 34;
        const startAngle = Math.PI;
        const endAngle = 2 * Math.PI;
        const fillAngle = startAngle + (pct / 100) * Math.PI;

        ctx.clearRect(0, 0, w, h);

        const tr = window.theme ? window.theme.r : 0;
        const tg = window.theme ? window.theme.g : 200;
        const tb = window.theme ? window.theme.b : 200;

        // Background arc
        ctx.beginPath();
        ctx.arc(cx, cy, r, startAngle, endAngle);
        ctx.strokeStyle = `rgba(${tr},${tg},${tb},0.15)`;
        ctx.lineWidth = 6;
        ctx.stroke();

        // Fill arc
        const fillColor = pct >= 90 ? "rgba(255,60,60,0.9)" : pct >= 65 ? "rgba(255,180,0,0.85)" : `rgba(${tr},${tg},${tb},0.85)`;
        ctx.beginPath();
        ctx.arc(cx, cy, r, startAngle, fillAngle);
        ctx.strokeStyle = fillColor;
        ctx.lineWidth = 6;
        ctx.stroke();

        // Label
        ctx.fillStyle = `rgba(${tr},${tg},${tb},0.9)`;
        ctx.font = "bold 11px monospace";
        ctx.textAlign = "center";
        ctx.fillText(pct + "%", cx, cy - 8);
        ctx.font = "8px monospace";
        ctx.fillStyle = `rgba(${tr},${tg},${tb},0.5)`;
        ctx.fillText("CTX", cx, cy + 2);
    }

    _fmtTokens(n) {
        if (!n || n === 0) return "—";
        if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
        if (n >= 1e3) return (n / 1e3).toFixed(0) + "K";
        return n.toString();
    }

    _kardashevTier(totalTokens) {
        if (totalTokens >= 100e9) return "TYPE III: GALACTIC ARCHITECT";
        if (totalTokens >= 1e9)   return "TYPE II: SYSTEM ENGINEER";
        if (totalTokens >= 100e6) return "TYPE I: PLANETARY CODER";
        if (totalTokens >= 10e6)  return "TYPE 0.5: REGIONAL DEVELOPER";
        if (totalTokens >= 1e6)   return "TYPE 0.2: LOCAL HACKER";
        return "TYPE 0: DIGITAL WANDERER";
    }

    pause() { /* no intervals to pause — IPC-driven */ }
    resume() {}
}

module.exports = { AgentWatch };
window.AgentWatch = AgentWatch;
