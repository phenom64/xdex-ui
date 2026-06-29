class Clock {
    constructor(parentId) {
        if (!parentId) throw "Missing parameters";

        // Load settings
        this.twelveHours = (window.settings.clockHours === 12);

        // Create DOM
        this.parent = document.getElementById(parentId);
        const container = document.createElement("div");
        container.id = "mod_clock";
        if (this.twelveHours) container.className = "mod_clock_twelve";
        container.innerHTML = `<h1 id="mod_clock_text"><span>?</span><span>?</span><span>:</span><span>?</span><span>?</span><span>:</span><span>?</span><span>?</span></h1>`;
        this.parent.appendChild(container);
        this.clockText = container.querySelector("#mod_clock_text");

        this.lastTime = new Date();

        this.updateClock();
        this.updater = setInterval(() => {
            this.updateClock();
        }, 1000);
    }
    updateClock() {
        if (document.visibilityState === "hidden") return;
        let time = new Date();
        let array = [time.getHours(), time.getMinutes(), time.getSeconds()];

        // 12-hour mode translation
        if (this.twelveHours) {
            this.ampm = (array[0] >= 12) ? "PM" : "AM";
            if (array[0] > 12) array[0] = array[0] - 12;
            if (array[0] === 0) array[0] = 12;
        }

        array.forEach((e, i) => {
            if (e.toString().length !== 2) {
                array[i] = "0"+e;
            }
        });
        let clockString = `${array[0]}:${array[1]}:${array[2]}`;
        array = clockString.match(/.{1}/g);
        clockString = "";
        array.forEach(e => {
            if (e === ":") clockString += "<em>"+e+"</em>";
            else clockString += "<span>"+e+"</span>";
        });
        
        if (this.twelveHours) clockString += `<span>${this.ampm}</span>`;

        if (this.clockText.innerHTML !== clockString) {
            this.clockText.innerHTML = clockString;
        }
        this.lastTime = time;
    }

    pause() {
        if (this.updater) { clearInterval(this.updater); this.updater = null; }
    }

    resume() {
        if (!this.updater) {
            this.updater = setInterval(() => this.updateClock(), 1000);
        }
    }
}

module.exports = {
    Clock
};
