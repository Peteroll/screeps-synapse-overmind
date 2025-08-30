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
    if (Game.time % 200 === 0) evaluate();
}

function trackIncome() {
    // Per remote: 以 remoteHauler 背回的能量增長 (看 creep carry 的 energy 交付到 home storage 時) 需標記來源房間 -> 這裡簡化：當 remoteHauler 在自家 storage 附近 unload 時記錄其 difference。
    if (!Memory.roi.creepLoad) Memory.roi.creepLoad = {};
    for (const name in Game.creeps) {
        const c = Game.creeps[name];
        if (c.memory.role !== 'remoteHauler') continue;
        const home = c.room.storage && c.room.storage.my ? c.room : null;
        if (!home) continue;
        // 估算其上次負載 - 現在負載的 energy 作為一次交付
        const key = name;
        const prev = Memory.roi.creepLoad[key] || { last: c.store.getUsedCapacity(RESOURCE_ENERGY) };
        const now = c.store.getUsedCapacity(RESOURCE_ENERGY);
        if (prev.last > now) { // 發生卸貨
            const delivered = prev.last - now;
            const remoteRoom = c.memory.remoteRoom || c.memory.sourceRoom || 'unknown';
            if (!Memory.roi.remotes[remoteRoom]) Memory.roi.remotes[remoteRoom] = { income:0, cost:0 };
            Memory.roi.remotes[remoteRoom].income += delivered;
        }
        prev.last = now;
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
    for (const r in Memory.roi.remotes) {
        const node = Memory.roi.remotes[r];
        const roi = node.cost > 0 ? node.income / node.cost : 0;
        node.roi = roi;
        totalIncome += node.income; totalCost += node.cost;
        if (roi < 0.6) {
            if (!node.lowSince) node.lowSince = Game.time; else if (Game.time - node.lowSince > 1500) markRemoteLow(r);
        } else node.lowSince = undefined;
        // 衰減，使數值不無限成長 (每 200 tick 評估時做輕微 decay)
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

module.exports = { run };