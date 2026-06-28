class Netstat {
    constructor(parentId) {
        if (!parentId) throw "Missing parameters";

        // Create DOM
        this.parent = document.getElementById(parentId);
        const container = document.createElement("div");
        container.id = "mod_netstat";
        container.innerHTML = `<div id="mod_netstat_inner">
                <h1>NETWORK STATUS<i id="mod_netstat_iname"></i></h1>
                <div id="mod_netstat_innercontainer">
                    <div>
                        <h1>STATE</h1>
                        <h2>UNKNOWN</h2>
                    </div>
                    <div>
                        <h1>IPv4</h1>
                        <h2>--.--.--.--</h2>
                    </div>
                    <div>
                        <h1>PING</h1>
                        <h2>--ms</h2>
                    </div>
                </div>
            </div>`;
        this.parent.appendChild(container);

        this.offline = false;
        this.lastconn = null;
        this.iface = null;
        this.failedAttempts = {};
        this.runsBeforeGeoIPUpdate = 0;
        this._geoLookupInFlight = false;
        this._pingLookupInFlight = false;
        this._nextGeoLookup = 0;
        this._nextPingLookup = 0;
        this._lastPing = null;
        this.ipinfo = {
            ip: null,
            geo: null
        };
        const inner = container.querySelector("#mod_netstat_innercontainer");
        const divs = inner.children;
        this._dom = {
            iface: container.querySelector("#mod_netstat_iname"),
            state: divs[0].querySelector("h2"),
            ip: divs[1].querySelector("h2"),
            ping: divs[2].querySelector("h2")
        };
        this._setText = (el, value) => {
            if (el && el.textContent !== value) el.textContent = value;
        };
        this._httpsAgent = new require("https").Agent({
            keepAlive: false,
            maxSockets: 10
        });

        // Init updaters
        this._renderInterface(this._selectInterface(this._nodeNetworkInterfaces()));
        this.updateInfo();
        this.infoUpdater = setInterval(() => {
            this.updateInfo();
        }, 2000);

        // Init GeoIP integrated backend
        this.geoLookup = {
            get: () => null
        };
        let geolite2 = require("geolite2-redist");
        let maxmind = require("maxmind");
        geolite2.downloadDbs(require("path").join(require("@electron/remote").app.getPath("userData"), "geoIPcache")).then(() => {
           geolite2.open('GeoLite2-City', path => {
                return maxmind.open(path);
            }).catch(e => {throw e}).then(lookup => {
                this.geoLookup = lookup;
            });
        }).catch(e => {
            console.warn("NetStat: GeoIP database unavailable:", e.message || e);
        });
    }
    _isUsableInterface(net) {
        return net &&
            net.internal !== true &&
            net.ip4 &&
            net.ip4 !== "127.0.0.1";
    }
    _selectInterface(data) {
        if (!Array.isArray(data)) return null;

        if (typeof window.settings.iface === "string" && window.settings.iface.length > 0) {
            const configured = data.find(net => net.iface === window.settings.iface || net.ifaceName === window.settings.iface);
            if (this._isUsableInterface(configured)) return configured;
        }

        return data.find(net => net.default === true && this._isUsableInterface(net)) ||
            data.find(net => net.virtual !== true && this._isUsableInterface(net)) ||
            data.find(net => this._isUsableInterface(net)) ||
            null;
    }
    _nodeNetworkInterfaces() {
        const osIfaces = require("os").networkInterfaces();
        let result = [];
        Object.keys(osIfaces).forEach(name => {
            osIfaces[name].forEach(addr => {
                if (addr.family === "IPv4") {
                    result.push({
                        iface: name,
                        ifaceName: name,
                        default: false,
                        ip4: addr.address,
                        mac: addr.mac || "",
                        internal: addr.internal === true,
                        virtual: false
                    });
                }
            });
        });
        return result;
    }
    _setOffline() {
        this.iface = null;
        this.offline = true;
        this._setText(this._dom.iface, "Interface: (offline)");
        this._setText(this._dom.state, "OFFLINE");
        this._setText(this._dom.ip, "--.--.--.--");
        this._setText(this._dom.ping, "--ms");
    }
    _renderInterface(net) {
        if (!net) {
            this._setOffline();
            return false;
        }

        this.iface = net.iface;
        this.internalIPv4 = net.ip4;
        this.offline = false;
        this._setText(this._dom.iface, "Interface: " + net.iface);
        this._setText(this._dom.state, "ONLINE");
        this._setText(this._dom.ip, net.ip4);
        return true;
    }
    _logDebug(message) {
        try {
            require("electron").ipcRenderer.send("log", "debug", "NetStat: " + message);
        } catch(e) {
            console.debug("NetStat:", message);
        }
    }
    _requestJson(options, timeout = 3500) {
        return new Promise((resolve, reject) => {
            const req = require("https").get(options, res => {
                let rawData = "";
                res.on("data", chunk => {
                    rawData += chunk;
                });
                res.on("end", () => {
                    try {
                        resolve(JSON.parse(rawData));
                    } catch(e) {
                        reject(e);
                    }
                });
            });
            req.on("error", reject);
            req.setTimeout(timeout, () => {
                req.destroy(new Error("JSON request timeout"));
            });
        });
    }
    _lookupRemoteGeo(ip, localAddress) {
        const providers = [
            {
                host: "ipwho.is",
                path: ip ? "/" + encodeURIComponent(ip) : "/",
                parse: data => {
                    if (data.success === false) return null;
                    if (typeof data.latitude !== "number" || typeof data.longitude !== "number") return null;
                    return { ip: data.ip, geo: { latitude: data.latitude, longitude: data.longitude } };
                }
            },
            {
                host: "ipapi.co",
                path: ip ? "/" + encodeURIComponent(ip) + "/json/" : "/json/",
                parse: data => {
                    const lat = Number(data.latitude);
                    const lon = Number(data.longitude);
                    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
                    return { ip: data.ip, geo: { latitude: lat, longitude: lon } };
                }
            },
            {
                host: "ipinfo.io",
                path: ip ? "/" + encodeURIComponent(ip) + "/json" : "/json",
                parse: data => {
                    if (typeof data.loc !== "string") return null;
                    const parts = data.loc.split(",").map(Number);
                    if (parts.length !== 2 || !Number.isFinite(parts[0]) || !Number.isFinite(parts[1])) return null;
                    return { ip: data.ip, geo: { latitude: parts[0], longitude: parts[1] } };
                }
            }
        ];
        const attempts = [];
        providers.forEach(provider => {
            if (localAddress) {
                attempts.push(Object.assign({ localAddress }, provider));
            }
            attempts.push(provider);
        });

        return attempts.reduce((chain, provider) => {
            return chain.catch(() => {
                return this._requestJson({
                    host: provider.host,
                    port: 443,
                    path: provider.path,
                    localAddress: provider.localAddress,
                    agent: this._httpsAgent,
                    headers: { "User-Agent": "xDEX-UI" }
                }).then(data => {
                    const result = provider.parse(data);
                    if (!result) throw new Error("Remote GeoIP response did not contain coordinates");
                    return result;
                });
            });
        }, Promise.reject());
    }
    _applyGeo(ip, geo) {
        if (!geo || typeof geo.latitude !== "number" || typeof geo.longitude !== "number") return;

        this.ipinfo = {
            ip: ip || this.ipinfo.ip || this.internalIPv4,
            geo
        };

        if (window.mods && window.mods.globe && typeof window.mods.globe.setEndpointGeo === "function") {
            window.mods.globe.setEndpointGeo(geo);
        }
    }
    _measurePing(target, port, local) {
        const ports = [port || 443, 443, 80].filter((value, index, arr) => arr.indexOf(value) === index);
        let attempts = Promise.reject();
        ports.forEach(p => {
            attempts = attempts
                .catch(() => local ? this.ping(target, p, local) : Promise.reject())
                .catch(() => this.ping(target, p));
        });
        return attempts
            .catch(() => this._nativePing(target))
            .catch(() => this._httpsTiming(local))
            .catch(() => this._httpsTiming());
    }
    _nativePing(target) {
        return new Promise((resolve, reject) => {
            const childProcess = require("child_process");
            const args = process.platform === "win32" ? ["-n", "1", "-w", "1800", target] : ["-c", "1", "-W", "2", target];
            childProcess.execFile("ping", args, { timeout: 2500, windowsHide: true }, (err, stdout) => {
                if (err && !stdout) {
                    reject(err);
                    return;
                }
                const output = stdout.toString();
                const direct = output.match(/time[=<]\s*([0-9.]+)\s*ms/i);
                const average = output.match(/Average\s*=\s*([0-9.]+)\s*ms/i) || output.match(/avg[^=]*=\s*[0-9.]+\/([0-9.]+)\//i);
                const value = Number((direct || average || [])[1]);
                if (Number.isFinite(value)) resolve(value);
                else reject(new Error("Native ping output did not contain latency"));
            });
        });
    }
    _httpsTiming(localAddress) {
        return new Promise((resolve, reject) => {
            let start = process.hrtime();
            const req = require("https").get({
                host: "ipwho.is",
                port: 443,
                path: "/",
                localAddress,
                agent: this._httpsAgent,
                headers: { "User-Agent": "xDEX-UI" }
            }, res => {
                res.resume();
                res.on("end", () => {
                    let time_arr = process.hrtime(start);
                    resolve((time_arr[0] * 1e9 + time_arr[1]) / 1e6);
                });
            });
            req.on("error", reject);
            req.setTimeout(2500, () => {
                req.destroy(new Error("HTTPS timing timeout"));
            });
        });
    }
    pause() {
        if (this.infoUpdater) { clearInterval(this.infoUpdater); this.infoUpdater = null; }
    }

    resume() {
        if (!this.infoUpdater) {
            this.infoUpdater = setInterval(() => this.updateInfo(), 2000);
        }
    }

    updateInfo() {
        if (document.visibilityState === "hidden") return;

        const localInterfaces = this._nodeNetworkInterfaces();
        const localNet = this._selectInterface(localInterfaces);
        if (localNet) this._renderInterface(localNet);

        window.si.networkInterfaces().catch(() => localInterfaces).then(async data => {
            if (!Array.isArray(data) || data.length === 0) {
                data = localInterfaces;
            }
            let net = this._selectInterface(data);
            if (!net) {
                this._logDebug("no usable interface found");
                this._setOffline();
                return false;
            }

            if (net.ip4 !== this.internalIPv4) this.runsBeforeGeoIPUpdate = 0;

            this._renderInterface(net);

            if (net.ip4 === "127.0.0.1") {
                this._setOffline();
            } else {
                const now = Date.now();
                if (!this._geoLookupInFlight && now >= this._nextGeoLookup) {
                    this._geoLookupInFlight = true;
                    this._nextGeoLookup = now + 60000;
                    this.lastconn = require("https").get({host: "myexternalip.com", port: 443, path: "/json", localAddress: net.ip4, agent: this._httpsAgent}, res => {
                        let rawData = "";
                        res.on("data", chunk => {
                            rawData += chunk;
                        });
                        res.on("end", () => {
                            try {
                                let data = JSON.parse(rawData);
                                let geo = null;
                                try {
                                    const geoData = this.geoLookup.get(data.ip);
                                    geo = geoData ? geoData.location : null;
                                } catch(e) {
                                    geo = null;
                                }

                                this.ipinfo.ip = data.ip;

                                this._setText(this._dom.ip, window._escapeHtml(net.ip4));

                                if (geo) {
                                    this._applyGeo(data.ip || net.ip4, geo);
                                    this._geoLookupInFlight = false;
                                } else {
                                    this._lookupRemoteGeo(data.ip, net.ip4).then(remoteGeo => {
                                        this._applyGeo(remoteGeo.ip || data.ip || net.ip4, remoteGeo.geo);
                                    }).catch(() => {
                                        return this._lookupRemoteGeo(null).then(remoteGeo => {
                                            this._applyGeo(remoteGeo.ip || data.ip || net.ip4, remoteGeo.geo);
                                        });
                                    }).catch(() => {
                                        this._nextGeoLookup = Date.now() + 15000;
                                    }).finally(() => {
                                        this._geoLookupInFlight = false;
                                    });
                                }

                                this.runsBeforeGeoIPUpdate = 10;
                            } catch(e) {
                                this.failedAttempts[e] = (this.failedAttempts[e] || 0) + 1;
                                console.warn(e);
                                console.info(rawData.toString());
                                let electron = require("electron");
                                electron.ipcRenderer.send("log", "note", "NetStat: Error parsing data from myexternalip.com");
                                electron.ipcRenderer.send("log", "debug", `Error: ${e}`);
                                if (this.failedAttempts[e] > 2) {
                                    this._nextGeoLookup = Date.now() + 15000;
                                    this._geoLookupInFlight = false;
                                    return false;
                                }
                                this._lookupRemoteGeo(null, net.ip4).then(remoteGeo => {
                                    this._applyGeo(remoteGeo.ip || net.ip4, remoteGeo.geo);
                                }).catch(() => {
                                    return this._lookupRemoteGeo(null).then(remoteGeo => {
                                        this._applyGeo(remoteGeo.ip || net.ip4, remoteGeo.geo);
                                    });
                                }).catch(() => {
                                    this._nextGeoLookup = Date.now() + 15000;
                                }).finally(() => {
                                    this._geoLookupInFlight = false;
                                });
                            }
                        });
                    });
                    this.lastconn.setTimeout(3500, () => {
                        this.lastconn.destroy(new Error("Public IP lookup timeout"));
                    });
                    this.lastconn.on("error", e => {
                        this.ipinfo.ip = net.ip4;
                        this.runsBeforeGeoIPUpdate = 3;
                        this._lookupRemoteGeo(null, net.ip4).then(remoteGeo => {
                            this._applyGeo(remoteGeo.ip || net.ip4, remoteGeo.geo);
                        }).catch(() => {
                            return this._lookupRemoteGeo(null).then(remoteGeo => {
                                this._applyGeo(remoteGeo.ip || net.ip4, remoteGeo.geo);
                            });
                        }).catch(() => {
                            this._nextGeoLookup = Date.now() + 15000;
                        }).finally(() => {
                            this._geoLookupInFlight = false;
                        });
                    });
                }

                if (this._lastPing !== null) this._setText(this._dom.ping, Math.round(this._lastPing)+"ms");
                if (!this._pingLookupInFlight && now >= this._nextPingLookup) {
                    this._pingLookupInFlight = true;
                    this._nextPingLookup = now + 10000;
                    this._measurePing(window.settings.pingAddr || "1.1.1.1", 443, net.ip4).then(p => {
                        this._lastPing = p;
                        this._setText(this._dom.state, "ONLINE");
                        this._setText(this._dom.ping, Math.round(p)+"ms");
                    }).catch(() => {
                        this._logDebug("ping failed for " + net.ip4);
                        this._setText(this._dom.ping, "--ms");
                        this._nextPingLookup = Date.now() + 5000;
                    }).finally(() => {
                        this._pingLookupInFlight = false;
                    });
                }
            }
        }).catch(e => {
            console.warn("NetStat: Error while updating network status:", e);
            const net = this._selectInterface(this._nodeNetworkInterfaces());
            if (net) {
                this._renderInterface(net);
            } else {
                this._setOffline();
            }
        });
    }
    ping(target, port, local) {
        return new Promise((resolve, reject) => {
            let s = new require("net").Socket();
            let start = process.hrtime();

            s.connect({
                port,
                host: target,
                localAddress: local,
                family: 4
            }, () => {
                let time_arr = process.hrtime(start);
                let time = (time_arr[0] * 1e9 + time_arr[1]) / 1e6;
                resolve(time);
                s.destroy();
            });
            s.on('error', e => {
                s.destroy();
                reject(e);
            });
            s.setTimeout(1900, function() {
                s.destroy();
                reject(new Error("Socket timeout"));
            });
        });
    }
}

module.exports = {
    Netstat
};
