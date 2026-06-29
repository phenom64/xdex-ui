class PanelManager {
    constructor(ipc, settingsFile, fs) {
        this._ipc = ipc;
        this._settingsFile = settingsFile;
        this._fs = fs;
        this._panels = {};
        this._fitTimer = null;
        this._state = (window.settings && window.settings.panelToggles)
            ? Object.assign({}, window.settings.panelToggles)
            : {};
        this._layout = Object.assign({
            agentWatchSlot: "bottom-left"
        }, (window.settings && window.settings.panelLayout) ? window.settings.panelLayout : {});
        this._agentWatchSlots = ["bottom-left", "bottom-right", "right-rail"];
        this._layout.agentWatchSlot = this._normalizeSlot(this._layout.agentWatchSlot || "bottom-left");
    }

    _normalizeSlot(slot) {
        if (this._agentWatchSlots.indexOf(slot) === -1) return "bottom-left";
        return slot;
    }

    register(name, containerEl, module) {
        this._panels[name] = { el: containerEl, module: module || null };
        const visible = (this._state[name] !== undefined) ? this._state[name] : true;
        if (!visible) this._applyHide(name);
    }

    initLayout() {
        this.applyLayout();
    }

    toggle(name) {
        if (!this._panels[name]) return;
        const currentlyVisible = !this._panels[name].el.classList.contains('panel-hidden');
        if (currentlyVisible) {
            this._applyHide(name);
            this._state[name] = false;
        } else {
            this._applyShow(name);
            this._state[name] = true;
        }
        this._persist();
        this.applyLayout();
        if (window.audioManager && window.audioManager.panels) window.audioManager.panels.play();
    }

    isVisible(name) {
        if (!this._panels[name]) return true;
        return !this._panels[name].el.classList.contains('panel-hidden');
    }

    _applyHide(name) {
        const { el, module } = this._panels[name];
        el.classList.add('panel-hidden');
        if (module && typeof module.pause === 'function') module.pause();
    }

    _applyShow(name) {
        const { el, module } = this._panels[name];
        el.classList.remove('panel-hidden');
        if (module && typeof module.resume === 'function') module.resume();
        this._fitActiveTerminalSoon();
    }

    cycleAgentWatchSlot() {
        const current = this._normalizeSlot(this._layout.agentWatchSlot || "bottom-left");
        const idx = this._agentWatchSlots.indexOf(current);
        this._layout.agentWatchSlot = this._agentWatchSlots[(idx + 1) % this._agentWatchSlots.length];
        this._persist();
        this.applyLayout();
        if (window.audioManager && window.audioManager.panels) window.audioManager.panels.play();
        return this._layout.agentWatchSlot;
    }

    applyLayout() {
        if (!document || !document.body) return;
        const body = document.body;
        const toggleClass = (klass, enabled) => {
            if (enabled) body.classList.add(klass);
            else body.classList.remove(klass);
        };

        toggleClass("panel-keyboard-hidden", !this.isVisible("keyboard"));
        toggleClass("panel-filesystem-hidden", !this.isVisible("filesystem"));
        toggleClass("panel-agentwatch-hidden", !this.isVisible("agentWatch"));
        toggleClass("panel-left-hidden", !this.isVisible("leftColumn"));
        toggleClass("panel-network-hidden", !this.isVisible("rightColumn"));

        const slot = this._normalizeSlot(this._layout.agentWatchSlot || "bottom-left");
        this._layout.agentWatchSlot = slot;
        this._agentWatchSlots.forEach(s => body.classList.remove("agent-watch-" + s));
        body.classList.add("agent-watch-" + slot);

        const slotLabel = document.getElementById("agent_watch_slot_label");
        if (slotLabel) slotLabel.textContent = slot.replace(/-/g, " ");
        this._fitActiveTerminalSoon();
    }

    _fitActiveTerminalSoon() {
        if (this._fitTimer) clearTimeout(this._fitTimer);
        this._fitTimer = setTimeout(() => {
            this._fitTimer = null;
            if (window.term && window.currentTerm !== undefined && window.term[window.currentTerm]) {
                window.term[window.currentTerm].fit();
            }
        }, 350);
    }

    reloadFromSettings(settings) {
        settings = settings || window.settings || {};
        this._state = Object.assign({}, settings.panelToggles || {});
        this._layout = Object.assign({ agentWatchSlot: "bottom-left" }, settings.panelLayout || {});
        this._layout.agentWatchSlot = this._normalizeSlot(this._layout.agentWatchSlot);

        Object.keys(this._panels).forEach(name => {
            const visible = this._state[name] !== undefined ? this._state[name] : true;
            if (visible) this._applyShow(name);
            else this._applyHide(name);
        });
        this.applyLayout();
    }

    syncSettings(settings) {
        if (!settings) return;
        settings.panelToggles = Object.assign({}, this._state);
        settings.panelLayout = Object.assign({}, this._layout);
    }

    _persist(mergedSettings) {
        try {
            const settings = mergedSettings || JSON.parse(this._fs.readFileSync(this._settingsFile, 'utf-8'));
            settings.panelToggles = this._state;
            settings.panelLayout = this._layout;
            this._fs.writeFileSync(this._settingsFile, JSON.stringify(settings, '', 4));
            if (window.settings) {
                window.settings.panelToggles = Object.assign({}, this._state);
                window.settings.panelLayout = Object.assign({}, this._layout);
            }
        } catch(e) {
            console.error('PanelManager: could not persist toggle state', e);
        }
    }
}

module.exports = { PanelManager };