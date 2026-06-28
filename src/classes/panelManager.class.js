class PanelManager {
    constructor(ipc, settingsFile, fs) {
        this._ipc = ipc;
        this._settingsFile = settingsFile;
        this._fs = fs;
        this._panels = {};
        this._state = (window.settings && window.settings.panelToggles)
            ? Object.assign({}, window.settings.panelToggles)
            : {};
    }

    register(name, containerEl, module) {
        this._panels[name] = { el: containerEl, module: module || null };
        const visible = (this._state[name] !== undefined) ? this._state[name] : true;
        if (!visible) this._applyHide(name);
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
        setTimeout(() => {
            if (window.term && window.currentTerm !== undefined && window.term[window.currentTerm]) {
                window.term[window.currentTerm].fit();
            }
        }, 350);
    }

    _persist() {
        try {
            const settings = JSON.parse(this._fs.readFileSync(this._settingsFile, 'utf-8'));
            settings.panelToggles = this._state;
            this._fs.writeFileSync(this._settingsFile, JSON.stringify(settings, '', 4));
        } catch(e) {
            console.error('PanelManager: could not persist toggle state', e);
        }
    }
}

module.exports = { PanelManager };
