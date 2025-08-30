// Remote ROI 追蹤：計算遠程房間採集輸出與角色維護成本，供後續自動撤離/重啟決策。
// 策略：
// 1. 每 tick 掃描 remoteMiner / remoteHauler 採集與運回增量，以 storage/terminal/mineral 容量增長估算。
// 2. 成本：遠程 creep body 成本 / 壽命 -> 每 tick 攤提，加總。
// 3. 每 200 tick 計算 1000 tick 窗口 ROI = 收益 / 成本；若 < 0.6 標記 low。
// 4. 將結果寫入 Memory.roi[remoteRoom] = { income, cost, roi, lowSince }。

function run() {
    if (!Memory.roi) Memory.roi = { samples: {}, remotes: {}, cost:0 };
    trackIncome();
    trackCost();
    if (Game.time % 50 === 0) smooth();
    if (Game.time % 200 === 0) evaluate();
}

function trackIncome() {
    // (B) 精細化：分離 energy / mineral 收益
    if (!Memory.roi.creepLoad) Memory.roi.creepLoad = {};
    for (var name in Game.creeps) {
        var c = Game.creeps[name];
        if (c.memory.role !== 'remoteHauler') continue;
        var home = c.room.storage && c.room.storage.my ? c.room : null;
        if (!home) continue;
        var key = name;
        var prev = Memory.roi.creepLoad[key];
        if (!prev) {
            prev = { last:{} };
            for (var r in c.store) prev.last[r] = c.store[r];
        }
        var deliveredEnergy = 0, deliveredMineral = 0;
        for (var res in prev.last) {
            var before = prev.last[res] || 0;
            var nowAmt = c.store[res] || 0;
            if (before > nowAmt) {
                var diff = before - nowAmt;
                if (res === RESOURCE_ENERGY) deliveredEnergy += diff; else deliveredMineral += diff;
            }
        }
        if (deliveredEnergy > 0 || deliveredMineral > 0) {
            var remoteRoom = c.memory.remoteRoom || c.memory.sourceRoom || 'unknown';
            if (!Memory.roi.remotes[remoteRoom]) Memory.roi.remotes[remoteRoom] = { income:0, cost:0 };
            var node = Memory.roi.remotes[remoteRoom];
            node.incomeEnergy = (node.incomeEnergy||0) + deliveredEnergy;
            node.incomeMineral = (node.incomeMineral||0) + deliveredMineral;
            node.income += deliveredEnergy + deliveredMineral;
        }
        prev.last = {};
        for (var cur in c.store) prev.last[cur] = c.store[cur];
        Memory.roi.creepLoad[key] = prev;
    }
}

function trackCost() {
    let tickCost = 0;
    for (const name in Game.creeps) {
        const c = Game.creeps[name];
        if (!c.memory.role || c.memory.role.indexOf('remote') === -1) continue;
        const remoteRoom = c.memory.remoteRoom || c.memory.sourceRoom || 'unknown';
        const partCost = creepCost(c.body) / CREEP_LIFE_TIME;
        tickCost += partCost;
        if (!Memory.roi.remotes[remoteRoom]) Memory.roi.remotes[remoteRoom] = { income:0, cost:0 };
        Memory.roi.remotes[remoteRoom].cost += partCost;
    }
    Memory.roi.cost += tickCost;
}

function creepCost(body) {
    return body.reduce((s,p)=> s + BODYPART_COST[p.type || p],0);
}

function evaluate() {
    let totalIncome = 0, totalCost = 0;
    for (var r in Memory.roi.remotes) {
        var node = Memory.roi.remotes[r];
        var roi = node.cost > 0 ? node.income / node.cost : 0;
        var roiEnergy = node.cost > 0 ? (node.incomeEnergy||0) / node.cost : 0;
        node.roi = roi;
        node.roiEnergy = roiEnergy;
        node.roiEma = node.roiEma === undefined ? roi : (node.roiEma * 0.8 + roi * 0.2);
        totalIncome += node.income; totalCost += node.cost;
        const lowThreshold = 0.6;
        const recoverThreshold = 0.75;
        if (node.roiEma < lowThreshold) {
            if (!node.lowSince) node.lowSince = Game.time; else if (Game.time - node.lowSince > 1500) markRemoteLow(r);
            node.recoverSince = undefined;
        } else if (node.roiEma >= recoverThreshold) {
            if (node.lowSince) {
                if (!node.recoverSince) node.recoverSince = Game.time;
                if (Game.time - node.recoverSince > 1000) clearRemoteLow(r);
            }
        }
        // 衰減
        node.income *= 0.9; node.cost *= 0.9;
    }
    Memory.roi.summary = { income: totalIncome, cost: totalCost, roi: totalCost>0? totalIncome/totalCost:0, lastEval: Game.time };
}

function markRemoteLow(roomName) {
    // 標記對應 Memory.remotes[roomName].state.lowROI = true 供 remoteManager 參考暫停
    if (Memory.remotes && Memory.remotes[roomName]) {
        if (!Memory.remotes[roomName].state) Memory.remotes[roomName].state = {};
        Memory.remotes[roomName].state.lowROI = true;
    }
}

function clearRemoteLow(roomName) {
    if (Memory.remotes && Memory.remotes[roomName] && Memory.remotes[roomName].state) {
        Memory.remotes[roomName].state.lowROI = false;
    }
    const node = Memory.roi.remotes[roomName];
    if (node) { node.lowSince = undefined; node.recoverSince = undefined; }
}

function smooth() { /* hook for future higher freq smoothing */ }

module.exports = { run };