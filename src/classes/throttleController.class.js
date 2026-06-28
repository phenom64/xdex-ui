class ThrottleController {
    constructor(ipc) {
        this.onBattery = false;
        this._listeners = [];
        ipc.on('power-state-change', (e, data) => {
            if (data && data.onBattery !== this.onBattery) {
                this.onBattery = !!data.onBattery;
                this._listeners.forEach(fn => fn(this.onBattery));
            }
        });
        document.addEventListener('visibilitychange', () => {
            this._listeners.forEach(fn => fn(this.onBattery));
        });
    }

    getFPS() {
        return (this.onBattery || document.visibilityState === 'hidden') ? 15 : 40;
    }

    getInterval(baseMs) {
        if (document.visibilityState === 'hidden') return baseMs * 4;
        return this.onBattery ? baseMs * 2 : baseMs;
    }

    addEventListener(event, fn) {
        if (event === 'change') this._listeners.push(fn);
    }
}

module.exports = { ThrottleController };
