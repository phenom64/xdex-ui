class Conninfo {
    constructor(parentId) {
        if (!parentId) throw "Missing parameters";

        // Create DOM
        this.parent = document.getElementById(parentId);
        const container = document.createElement("div");
        container.id = "mod_conninfo";
        container.innerHTML = `<div id="mod_conninfo_innercontainer">
                <h1>NETWORK TRAFFIC<i>UP / DOWN, MB/S</i></h1>
                <h2>TOTAL<i>0B OUT, 0B IN</i></h2>
                <canvas id="mod_conninfo_canvas_top"></canvas>
                <canvas id="mod_conninfo_canvas_bottom"></canvas>
                <h3>OFFLINE</h3>
            </div>`;
        this.parent.appendChild(container);

        const inner = container.querySelector("#mod_conninfo_innercontainer");
        this.current = inner.querySelector("h1 > i");
        this.total = inner.querySelector("h2 > i");
        this.container = container;
        let pbModule = require("pretty-bytes");
        this._pb = typeof pbModule === "function" ? pbModule : pbModule.default;

        // Init Smoothie
        let TimeSeries = require("smoothie").TimeSeries;
        let SmoothieChart = require("smoothie").SmoothieChart;

        // Set chart options
        let chartOptions = [{
            limitFPS: 40,
            responsive: true,
            millisPerPixel: 70,
            interpolation: 'linear',
            grid:{
                millisPerLine: 5000,
                fillStyle:'transparent',
                strokeStyle:`rgba(${window.theme.r},${window.theme.g},${window.theme.b},0.4)`,
                verticalSections:3,
                borderVisible:false
            },
            labels:{
                fontSize: 10,
                fillStyle: `rgb(${window.theme.r},${window.theme.g},${window.theme.b})`,
                precision: 2
            }
        }];
        chartOptions.push(Object.assign({}, chartOptions[0]));  // Deep copy object, see http://jsben.ch/bWfk9
        chartOptions[0].minValue = 0;
        chartOptions[1].maxValue = 0;

        // Create chart
        this.series = [new TimeSeries(), new TimeSeries()];
        this.charts = [new SmoothieChart(chartOptions[0]), new SmoothieChart(chartOptions[1])];

        this.charts[0].addTimeSeries(this.series[0], {lineWidth:1.7,strokeStyle:`rgb(${window.theme.r},${window.theme.g},${window.theme.b})`});
        this.charts[1].addTimeSeries(this.series[1], {lineWidth:1.7,strokeStyle:`rgb(${window.theme.r},${window.theme.g},${window.theme.b})`});

        this.charts[0].streamTo(container.querySelector("#mod_conninfo_canvas_top"), 1000);
        this.charts[1].streamTo(container.querySelector("#mod_conninfo_canvas_bottom"), 1000);

        // Init updater
        this.updateInfo();
        this.infoUpdater = setInterval(() => {
            this.updateInfo();
        }, 1000);
    }
    updateInfo() {
        if (document.visibilityState === "hidden") return;
        let time = new Date().getTime();

        if (window.mods.netstat.offline || window.mods.netstat.iface === null) {
            this.series[0].append(time, 0);
            this.series[1].append(time, 0);
            if (this.container.className !== "offline") this.container.setAttribute("class", "offline");
            return;
        } else {
            if (this.container.className !== "") this.container.setAttribute("class", "");
            window.si.networkStats(window.mods.netstat.iface).then(data => {

                let max0 = this.series[0].maxValue;
                let max1 = -this.series[1].minValue;
                if (max0 > max1) {
                    this.series[1].minValue = -max0;
                } else if (max1 > max0) {
                    this.series[0].maxValue = max1;
                }

                this.series[0].append(time, data[0].tx_sec/125000);
                this.series[1].append(time, -data[0].rx_sec/125000);

                const total = `${this._pb(data[0].tx_bytes)} OUT, ${this._pb(data[0].rx_bytes)} IN`.toUpperCase();
                const current = "UP " + parseFloat(data[0].tx_sec/125000).toFixed(2) + " DOWN " + parseFloat(data[0].rx_sec/125000).toFixed(2);
                if (this.total.innerText !== total) this.total.innerText = total;
                if (this.current.innerText !== current) this.current.innerText = current;
            }).catch(e => {
                console.error("Connection Info Error:", e);
            });
        }
    }
}

module.exports = {
    Conninfo
};
