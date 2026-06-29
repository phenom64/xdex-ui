class Sysinfo {
    constructor(parentId) {
        if (!parentId) throw "Missing parameters";

        // See #255
        let os;
        switch (require("os").platform()) {
            case "darwin":
                os = "macOS";
                break;
            case "win32":
                os = "win";
                break;
            default:
                os = require("os").platform();
        }

        // Create DOM
        this.parent = document.getElementById(parentId);
        const container = document.createElement("div");
        container.id = "mod_sysinfo";
        container.innerHTML = `<div>
                <h1>1970</h1>
                <h2>JAN 1</h2>
            </div>
            <div>
                <h1>UPTIME</h1>
                <h2>0:0:0</h2>
            </div>
            <div>
                <h1>TYPE</h1>
                <h2>${os}</h2>
            </div>
            <div>
                <h1>POWER</h1>
                <h2>--%</h2>
            </div>`;
        this.parent.appendChild(container);

        const divs = container.children;
        this._dom = {
            year: divs[0].querySelector("h1"),
            date: divs[0].querySelector("h2"),
            uptime: divs[1].querySelector("h2"),
            power: divs[3].querySelector("h2")
        };
        this._setHTML = (el, value) => {
            if (el && el.innerHTML !== value) el.innerHTML = value;
        };
        this._windowsBatteryCache = {
            updated: 0,
            data: null,
            pending: null
        };

        this.updateDate();
        this.updateUptime();
        this.uptimeUpdater = setInterval(() => {
            this.updateUptime();
        }, 60000);
        this.updateBattery();
        this.batteryUpdater = setInterval(() => {
            this.updateBattery();
        }, 15000);
    }
    updateDate() {
        let time = new Date();

        this._setHTML(this._dom.year, time.getFullYear().toString());

        let month = time.getMonth();
        switch(month) {
            case 0:
                month = "JAN";
                break;
            case 1:
                month = "FEB";
                break;
            case 2:
                month = "MAR";
                break;
            case 3:
                month = "APR";
                break;
            case 4:
                month = "MAY";
                break;
            case 5:
                month = "JUN";
                break;
            case 6:
                month = "JUL";
                break;
            case 7:
                month = "AUG";
                break;
            case 8:
                month = "SEP";
                break;
            case 9:
                month = "OCT";
                break;
            case 10:
                month = "NOV";
                break;
            case 11:
                month = "DEC";
                break;
        }
        this._setHTML(this._dom.date, month+" "+time.getDate());

        let timeToNewDay = ((23 - time.getHours()) * 3600000) + ((59 - time.getMinutes()) * 60000);
        setTimeout(() => {
            this.updateDate();
        }, timeToNewDay);
    }
    updateUptime() {
        let uptime = {
            raw: Math.floor(require("os").uptime()),
            days: 0,
            hours: 0,
            minutes: 0
        };

        uptime.days = Math.floor(uptime.raw/86400);
        uptime.raw -= uptime.days*86400;
        uptime.hours = Math.floor(uptime.raw/3600);
        uptime.raw -= uptime.hours*3600;
        uptime.minutes = Math.floor(uptime.raw/60);

        if (uptime.hours.toString().length !== 2) uptime.hours = "0"+uptime.hours;
        if (uptime.minutes.toString().length !== 2) uptime.minutes = "0"+uptime.minutes;

        this._setHTML(this._dom.uptime, uptime.days + '<span style="opacity:0.5;">d</span>' + uptime.hours + '<span style="opacity:0.5;">:</span>' + uptime.minutes);
    }
    updateBattery() {
        if (document.visibilityState === "hidden") return;
        window.si.battery().then(bat => {
            const percent = bat && Number(bat.percent);
            const needsWindowsFallback = process.platform === "win32" &&
                (!bat || bat.hasBattery !== true || !Number.isFinite(percent) || percent <= 0);

            if (needsWindowsFallback) {
                return this._getWindowsBattery().then(winBat => {
                    this._renderBattery(winBat || bat);
                });
            }

            this._renderBattery(bat);
        }).catch(e => {
            console.error("Battery Info Error:", e);
            if (process.platform === "win32") {
                this._getWindowsBattery().then(winBat => {
                    this._renderBattery(winBat);
                }).catch(() => {
                    this._setHTML(this._dom.power, "ON");
                });
            } else {
                this._setHTML(this._dom.power, "ON");
            }
        });
    }
    _renderBattery(bat) {
        if (bat && bat.hasBattery) {
            if (bat.isCharging) {
                this._setHTML(this._dom.power, "CHARGE");
            } else if (bat.acConnected) {
                this._setHTML(this._dom.power, "WIRED");
            } else {
                const percent = Number(bat.percent);
                this._setHTML(this._dom.power, Number.isFinite(percent) ? Math.round(percent)+"%" : "--%");
            }
        } else {
            this._setHTML(this._dom.power, "ON");
        }
    }
    _normalizeWindowsBattery(raw) {
        const item = Array.isArray(raw) ? raw[0] : raw;
        if (!item) return null;

        const percent = Number(item.EstimatedChargeRemaining);
        if (!Number.isFinite(percent)) return null;

        const status = Number(item.BatteryStatus);
        return {
            hasBattery: true,
            percent,
            isCharging: [6, 7, 8, 9, 11].includes(status),
            acConnected: [2, 3].includes(status)
        };
    }
    _getWindowsBattery() {
        const now = Date.now();
        if (this._windowsBatteryCache.data && now - this._windowsBatteryCache.updated < 60000) {
            return Promise.resolve(this._windowsBatteryCache.data);
        }
        if (this._windowsBatteryCache.pending) return this._windowsBatteryCache.pending;

        const childProcess = require("child_process");
        const command = "Get-CimInstance Win32_Battery | Select-Object EstimatedChargeRemaining,BatteryStatus | ConvertTo-Json -Compress";
        this._windowsBatteryCache.pending = new Promise(resolve => {
            childProcess.execFile("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command], {
                timeout: 4000,
                windowsHide: true
            }, (err, stdout) => {
                if (err || !stdout) {
                    this._getWindowsBatteryWmic().then(resolve);
                    return;
                }

                try {
                    resolve(this._normalizeWindowsBattery(JSON.parse(stdout)));
                } catch(e) {
                    this._getWindowsBatteryWmic().then(resolve);
                }
            });
        }).then(data => {
            if (data) {
                this._windowsBatteryCache.data = data;
                this._windowsBatteryCache.updated = Date.now();
            }
            this._windowsBatteryCache.pending = null;
            return data;
        });

        return this._windowsBatteryCache.pending;
    }
    _getWindowsBatteryWmic() {
        const childProcess = require("child_process");

        return new Promise(resolve => {
            childProcess.execFile("wmic.exe", ["path", "Win32_Battery", "get", "BatteryStatus,EstimatedChargeRemaining", "/format:list"], {
                timeout: 3000,
                windowsHide: true
            }, (err, stdout) => {
                if (err || !stdout) {
                    resolve(null);
                    return;
                }

                const percentMatch = stdout.match(/EstimatedChargeRemaining=(\d+)/i);
                const statusMatch = stdout.match(/BatteryStatus=(\d+)/i);
                if (!percentMatch) {
                    resolve(null);
                    return;
                }

                resolve(this._normalizeWindowsBattery({
                    EstimatedChargeRemaining: Number(percentMatch[1]),
                    BatteryStatus: statusMatch ? Number(statusMatch[1]) : 0
                }));
            });
        });
    }

    pause() {
        if (this.uptimeUpdater) { clearInterval(this.uptimeUpdater); this.uptimeUpdater = null; }
        if (this.batteryUpdater) { clearInterval(this.batteryUpdater); this.batteryUpdater = null; }
    }

    resume() {
        if (!this.uptimeUpdater) {
            this.uptimeUpdater = setInterval(() => this.updateUptime(), 60000);
        }
        if (!this.batteryUpdater) {
            this.batteryUpdater = setInterval(() => this.updateBattery(), 15000);
        }
    }
}

module.exports = {
    Sysinfo
};
