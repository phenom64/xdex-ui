class LocationGlobe {
    constructor(parentId) {
        if (!parentId) throw "Missing parameters";

        const path = require("path");

        this._geodata = require(path.join(__dirname, "assets/misc/grid.json"));
        require(path.join(__dirname, "assets/vendor/encom-globe.js"));
        this.ENCOM = window.ENCOM;

        // Create DOM and include lib
        this.parent = document.getElementById(parentId);
        const container = document.createElement("div");
        container.id = "mod_globe";
        container.innerHTML = `<div id="mod_globe_innercontainer">
                <h1>WORLD VIEW<i>GLOBAL NETWORK MAP</i></h1>
                <h2>ENDPOINT LAT/LON<i class="mod_globe_headerInfo">0.0000, 0.0000</i></h2>
                <div id="mod_globe_canvas_placeholder"></div>
                <h3>OFFLINE</h3>
            </div>`;
        this.parent.appendChild(container);

        this.lastgeo = {};
        this.conns = [];
        this.container = container;
        this.headerInfo = container.querySelector("i.mod_globe_headerInfo");
        this._isVisible = () => document.visibilityState !== "hidden";

        setTimeout(() => {
            let innerContainer = this.container.querySelector("#mod_globe_innercontainer");
            let placeholder = this.container.querySelector("#mod_globe_canvas_placeholder");

            // Create Globe
            this.globe = new this.ENCOM.Globe(placeholder.offsetWidth, placeholder.offsetHeight, {
                font: window.theme.cssvars.font_main,
                data: [],
                tiles: this._geodata.tiles,
                baseColor: window.theme.globe.base || `rgb(${window.theme.r},${window.theme.g},${window.theme.b})`,
                markerColor: window.theme.globe.marker || `rgb(${window.theme.r},${window.theme.g},${window.theme.b})`,
                pinColor: window.theme.globe.pin || `rgb(${window.theme.r},${window.theme.g},${window.theme.b})`,
                satelliteColor: window.theme.globe.satellite || `rgb(${window.theme.r},${window.theme.g},${window.theme.b})`,
                scale: 1.1,
                viewAngle: 0.630,
                dayLength: 1000 * 45,
                introLinesDuration: 2000,
                introLinesColor: window.theme.globe.marker || `rgb(${window.theme.r},${window.theme.g},${window.theme.b})`,
                maxPins: 300,
                maxMarkers: 100
            });

            // Place Globe
            placeholder.remove();
            innerContainer.append(this.globe.domElement);

            // Init animations
            this._animate = () => {
                if (window.mods.globe.globe && window.mods.globe._isVisible()) {
                    window.mods.globe.globe.tick();
                }
                if (window.mods.globe._animate) {
                    setTimeout(() => {
                        try {
                            requestAnimationFrame(window.mods.globe._animate);
                        } catch(e) {
                            // We probably got caught in a theme change. Print it out but everything should keep running fine.
                            console.warn(e);
                        }
                    }, 1000 / 30);
                }
            };
            this.globe.init(window.theme.colors.light_black, () => {
                this._animate();
                window.audioManager.scan.play();
            });

            // resize handler
            this.resizeHandler = () => {
                let canvas = this.container.querySelector("canvas");
                if (canvas && window.mods.globe.globe) {
                    window.mods.globe.globe.camera.aspect = canvas.offsetWidth / canvas.offsetHeight;
                    window.mods.globe.globe.camera.updateProjectionMatrix();
                    window.mods.globe.globe.renderer.setSize(canvas.offsetWidth, canvas.offsetHeight);
                }
            };
            window.addEventListener("resize", this.resizeHandler);

            // Connections
            this.conns = [];
            this.setEndpointGeo = geo => {
                if (!geo || typeof geo.latitude !== "number" || typeof geo.longitude !== "number") return;

                const normalized = {
                    latitude: Math.round(geo.latitude*10000)/10000,
                    longitude: Math.round(geo.longitude*10000)/10000
                };
                const header = `${normalized.latitude}, ${normalized.longitude}`;
                if (this.headerInfo.innerText !== header) this.headerInfo.innerText = header;

                if (normalized.latitude !== this.lastgeo.latitude || normalized.longitude !== this.lastgeo.longitude) {
                    this.removePins();
                    this.removeMarkers();
                    this.conns = [];
                    this._locPin = this.globe.addPin(normalized.latitude, normalized.longitude, "", 1.2);
                    this._locMarker = this.globe.addMarker(normalized.latitude, normalized.longitude, "", false, 1.2);
                    this.lastgeo = normalized;
                }

                if (this.container.className !== "") this.container.setAttribute("class", "");
            };
            this.addConn = ip => {
                let data = null;
                try {
                    data = window.mods.netstat.geoLookup.get(ip);
                } catch {
                    // do nothing
                }
                let geo = (data !== null ? data.location : {});
                if (geo.latitude && geo.longitude) {
                    const lat = Number(geo.latitude);
                    const lon = Number(geo.longitude);
                    window.mods.globe.conns.push({
                        ip,
                        pin: window.mods.globe.globe.addPin(lat, lon, "", 1.2),
                    });
                }
            };
            this.removeConn = ip => {
                let index = this.conns.findIndex(x => x.ip === ip);
                if (index === -1) return;
                this.conns[index].pin.remove();
                this.conns.splice(index, 1);
            };

            // Add random satellites
            let constellation = [];
            for(var i = 0; i< 2; i++){
                for(var j = 0; j< 3; j++){
                    constellation.push({
                        lat: 50 * i - 30 + 15 * Math.random(),
                        lon: 120 * j - 120 + 30 * i,
                        altitude: Math.random() * (1.7 - 1.3) + 1.3
                    });
                }
            }

            this.globe.addConstellation(constellation);
        }, 2000);

        // Init updaters when intro animation is done
        setTimeout(() => {
            this.updateLoc();
            this.locUpdater = setInterval(() => {
                this.updateLoc();
            }, 1000);

            this.updateConns();
            this.connsUpdater = setInterval(() => {
                this.updateConns();
            }, 3000);
        }, 4000);
    }

    addRandomConnectedMarkers() {
        const randomLat = this.getRandomInRange(40, 90, 3);
        const randomLong = this.getRandomInRange(-180, 0, 3);
        this.globe.addMarker(randomLat, randomLong, '');
        this.globe.addMarker(randomLat - 20, randomLong + 150, '', true);
    }
    addTemporaryConnectedMarker(ip) {
        let data = window.mods.netstat.geoLookup.get(ip);
        let geo = (data !== null ? data.location : {});
        if (geo.latitude && geo.longitude) {
            const lat = Number(geo.latitude);
            const lon = Number(geo.longitude);

            window.mods.globe.conns.push({
                ip,
                pin: window.mods.globe.globe.addPin(lat, lon, "", 1.2)
            });
            let mark = window.mods.globe.globe.addMarker(lat, lon, '', true);
            setTimeout(() => {
                mark.remove();
            }, 3000);
        }
    }
    removeMarkers() {
        if (this.globe && this.globe.markers) {
            this.globe.markers.forEach(marker => { marker.remove(); });
            this.globe.markers = [];
        }
    }
    removePins() {
        if (this.globe && this.globe.pins) {
            this.globe.pins.forEach(pin => {
                pin.remove();
            });
            this.globe.pins = [];
        }
    }
    getRandomInRange(from, to, fixed) {
        return (Math.random() * (to - from) + from).toFixed(fixed) * 1;
    }
    updateLoc() {
        if (window.mods.netstat.offline) {
            if (this.container.className !== "offline") this.container.setAttribute("class", "offline");
            if (this.headerInfo.innerText !== "(OFFLINE)") this.headerInfo.innerText = "(OFFLINE)";

            this.removePins();
            this.removeMarkers();
            this.conns = [];
            this.lastgeo = {
                latitude: 0,
                longitude: 0
            };
        } else {
            this.updateConOnlineConnection().then(() => {
                if (this.container.className !== "") this.container.setAttribute("class", "");
            }).catch(() => {
                if (this.headerInfo.innerText !== "UNKNOWN") this.headerInfo.innerText = "UNKNOWN";
            })
        }
    }
    async updateConOnlineConnection() {
        let newgeo = window.mods.netstat.ipinfo.geo;
        if (!newgeo || typeof newgeo.latitude !== "number" || typeof newgeo.longitude !== "number") {
            if (this.lastgeo && typeof this.lastgeo.latitude === "number" && typeof this.lastgeo.longitude === "number") {
                const header = `${this.lastgeo.latitude}, ${this.lastgeo.longitude}`;
                if (this.headerInfo.innerText !== header) this.headerInfo.innerText = header;
            } else if (this.headerInfo.innerText !== "GEOIP PENDING") {
                this.headerInfo.innerText = "GEOIP PENDING";
            }
            return;
        }
        this.setEndpointGeo(newgeo);
    }
    updateConns() {
        if (!this._isVisible()) return false;
        if (!window.mods.globe.globe || window.mods.netstat.offline) return false;
        window.si.networkConnections().then(conns => {
            let newconns = [];
            conns.forEach(conn => {
                let ip = conn.peeraddress;
                let state = conn.state;
                if (state === "ESTABLISHED" && ip !== "0.0.0.0" && ip !== "127.0.0.1" && ip !== "::") {
                    newconns.push(ip);
                }
            });

            this.conns.forEach(conn => {
                if (newconns.indexOf(conn.ip) !== -1) {
                    newconns.splice(newconns.indexOf(conn.ip), 1);
                } else {
                    this.removeConn(conn.ip);
                }
            });

            newconns.forEach(ip => {
                this.addConn(ip);
            });
        }).catch(e => {
            console.error("Globe Connections Error:", e);
        });
    }
}

module.exports = {
    LocationGlobe
};
