// 統一資源預留 / 製程需求 / 可售盈餘計算
// Memory.resource = { reserved: { mineral: amount }, demand: { mineral: targetNeed }, lastCalc }

function run() {
    if (!Memory.resource) Memory.resource = { reserved:{}, demand:{}, surplus:{} };
    aggregateBoostReservations();
    computeLabDemand();
    computeSurplus();
}

function aggregateBoostReservations() {
    if (!Memory.boost) return;
    const reserved = Memory.resource.reserved;
    // 目前 boost.reserved 為總需求，複製 (未細分房)
    for (const m in Memory.boost.reserved) {
        reserved[m] = Math.max(reserved[m]||0, Memory.boost.reserved[m]);
    }
}

function computeLabDemand() {
    const cfg = require('util.config');
    const graph = cfg.LAB.REACTION_GRAPH || {};
    const demand = Memory.resource.demand;
    var targetList = [];
    var bp = cfg.LAB.BOOST_PLAN || {};
    for (var role in bp) {
        var arr = bp[role];
        if (!arr) continue;
        for (var i=0;i<arr.length;i++) targetList.push(arr[i]);
    }
    var uniqueTargets = [];
    for (var j=0;j<targetList.length;j++) {
        var t = targetList[j];
        if (uniqueTargets.indexOf(t) === -1) uniqueTargets.push(t);
    }
    const safety = cfg.LAB.SAFETY_STOCK_RATIO || 0;
    // 對每個目標展開鏈並設定對應安全庫存
    for (const prod of uniqueTargets) {
        const need = projectedNeed(prod); // 使用 labManager 的需求估算法 (若可訪問)
        const chain = expand(prod, graph);
        for (const node of chain) {
            if (!demand[node]) demand[node] = 0;
            demand[node] = Math.max(demand[node], need * safety);
        }
    }
}

function projectedNeed(prod) {
    // 粗估：若沒有 boost.reserved 記錄則 0
    if (Memory.boost && Memory.boost.reserved && Memory.boost.reserved[prod]) return Memory.boost.reserved[prod];
    return 0;
}

function expand(p, graph, acc, visited) {
    acc = acc || [];
    visited = visited || {};
    if (visited[p]) return acc; // 已展開過，避免循環
    visited[p] = true;
    if (!graph[p]) return acc;
    const reagents = graph[p];
    for (var i=0;i<reagents.length;i++) {
        var r = reagents[i];
        if (r === p) continue; // 自我引用保護
        if (acc.indexOf(r) === -1) acc.push(r);
        // 若下一層自我或已訪問則不再遞迴
        if (!visited[r]) expand(r, graph, acc, visited);
    }
    return acc;
}

function computeSurplus() {
    if (!Memory.resource) Memory.resource = { reserved:{}, demand:{}, surplus:{} };
    if (!Memory.resource.surplus) Memory.resource.surplus = {};
    if (!Memory.resource.reserved) Memory.resource.reserved = {};
    if (!Memory.resource.demand) Memory.resource.demand = {};
    const surplus = Memory.resource.surplus;
    const demand = Memory.resource.demand;
    for (const roomName in Game.rooms) {
        const room = Game.rooms[roomName];
        if (!room.storage) continue;
        for (const res in room.storage.store) {
            const have = room.storage.store[res];
            const need = (demand[res]||0) + (Memory.resource.reserved[res]||0);
            const free = have - need;
            if (free > 0) surplus[res] = (surplus[res]||0) + free; // 聚合
        }
    }
}

function isReserved(resource, amount) {
    const r = Memory.resource && Memory.resource.reserved && Memory.resource.reserved[resource] || 0;
    return r >= amount;
}

module.exports = { run, isReserved };