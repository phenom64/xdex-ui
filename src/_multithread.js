const cluster = require("cluster");

if (cluster.isMaster) {
    const electron = require("electron");
    const ipc = electron.ipcMain;
    const signale = require("signale");
    // Also, leave a core available for the renderer process
    const osCPUs = require("os").cpus().length - 1;
    // A small pool keeps systeminformation calls off the renderer without
    // paying the memory and startup cost of one worker per CPU core.
    const numCPUs = Math.max(1, Math.min(osCPUs, 3));

    const si = require("systeminformation");

    cluster.setupMaster({
        exec: require("path").join(__dirname, "_multithread.js")
    });

    let workers = [];
    cluster.on("fork", worker => {
        workers.push(worker.id);
    });

    for (let i = 0; i < numCPUs; i++) {
        cluster.fork();
    }

    signale.success("Multithreaded controller ready");

    var lastID = 0;
    const cacheTTL = {
        battery: 10000,
        blockDevices: 10000,
        chassis: 60000,
        cpu: 10000,
        currentLoad: 500,
        fsSize: 10000,
        mem: 1000,
        networkConnections: 2000,
        networkInterfaces: 5000,
        networkStats: 500,
        processes: 1000,
        system: 60000
    };
    const cache = {};

    function cacheKey(type, args) {
        return type + ":" + JSON.stringify(args || []);
    }

    function getCached(type, args) {
        const ttl = cacheTTL[type];
        if (!ttl) return null;

        const entry = cache[cacheKey(type, args)];
        if (entry && Date.now() - entry.time < ttl) {
            return entry.res;
        }

        return null;
    }

    function setCached(type, args, res) {
        if (!cacheTTL[type]) return;
        cache[cacheKey(type, args)] = {
            time: Date.now(),
            res
        };
    }

    function fallbackResult(type) {
        switch(type) {
            case "battery":
                return {hasBattery: false};
            case "blockDevices":
            case "networkConnections":
            case "networkInterfaces":
                return [];
            case "chassis":
                return {type: ""};
            case "cpu":
                return {cores: 0, manufacturer: "", brand: "", speed: "--", speedMax: "--"};
            case "cpuTemperature":
                return {max: "--"};
            case "currentLoad":
                return {cpus: []};
            case "fsSize":
                return [];
            case "mem":
                return {active: 0, available: 0, free: 0, total: 1, swapused: 0, swaptotal: 1};
            case "networkStats":
                return [{tx_sec: 0, rx_sec: 0, tx_bytes: 0, rx_bytes: 0}];
            case "processes":
                return {all: 0, list: []};
            case "system":
                return {manufacturer: "", model: ""};
            default:
                return null;
        }
    }

    function sendReply(sender, id, res) {
        if (sender && !sender.isDestroyed()) {
            sender.send("systeminformation-reply-"+id, res);
        }
    }

    function dispatch(type, id, args) {
        let selectedID = lastID+1;
        if (selectedID > numCPUs-1) selectedID = 0;

        const worker = cluster.workers[workers[selectedID]];
        if (worker && worker.isConnected()) {
            worker.send(JSON.stringify({
                id,
                type,
                args,
                arg: args[0]
            }));
            lastID = selectedID;
            return true;
        }

        lastID = selectedID;
        return false;
    }

    var queue = {};
    ipc.on("systeminformation-call", (e, type, id, ...args) => {
        if (!si[type]) {
            signale.warn("Illegal request for systeminformation");
            return;
        }

        const cached = getCached(type, args);
        if (cached !== null) {
            if (e.sender && !e.sender.isDestroyed()) {
                e.sender.send("systeminformation-reply-"+id, cached);
            }
            return;
        }

        if (args.length > 1 || workers.length <= 0) {
            si[type](...args).then(res => {
                setCached(type, args, res);
                sendReply(e.sender, id, res);
            }).catch(err => {
                signale.warn(`systeminformation.${type} failed: ${err.message || err}`);
                sendReply(e.sender, id, fallbackResult(type));
            });
        } else {
            queue[id] = e.sender;
            if (!dispatch(type, id, args)) {
                delete queue[id];
                si[type](args[0]).then(res => {
                    setCached(type, args, res);
                    sendReply(e.sender, id, res);
                }).catch(err => {
                    signale.warn(`systeminformation.${type} failed: ${err.message || err}`);
                    sendReply(e.sender, id, fallbackResult(type));
                });
            }
        }
    });

    cluster.on("message", (worker, msg) => {
        msg = JSON.parse(msg);
        try {
            if (queue[msg.id] && !queue[msg.id].isDestroyed()) {
                const res = msg.error ? fallbackResult(msg.type) : msg.res;
                setCached(msg.type, msg.args, res);
                queue[msg.id].send("systeminformation-reply-"+msg.id, res);
                delete queue[msg.id];
            }
        } catch(e) {
            // Window has been closed, ignore.
        }
    });
} else if (cluster.isWorker) {
    const signale = require("signale");
    const si = require("systeminformation");

    signale.info("Multithread worker started at "+process.pid);

    process.on("message", msg => {
        msg = JSON.parse(msg);
        si[msg.type](msg.arg).then(res => {
            process.send(JSON.stringify({
                id: msg.id,
                type: msg.type,
                args: msg.args,
                res
            }));
        }).catch(err => {
            process.send(JSON.stringify({
                id: msg.id,
                type: msg.type,
                args: msg.args,
                error: err.message || String(err)
            }));
        });
    });
}
