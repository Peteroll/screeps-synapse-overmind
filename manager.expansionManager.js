// Expansion 排序：評分附近待擴張房間 (僅示意簡化版)
// Memory.expansion = { lastScan: <tick>, candidates: [{roomName, score, sources, distance}], target }

function run() {
    if (!Memory.expansion) Memory.expansion = { lastScan:0, candidates:[] };
    if (Game.time - Memory.expansion.lastScan < 2000) return; // 節流
    const myRooms = Object.values(Game.rooms).filter(r => r.controller && r.controller.my);
    if (!myRooms.length) return;
    const origin = myRooms[0]; // 簡化以第一個房為中心
    const nearby = findNearbyRooms(origin.name, 5);
    const candidates = [];
    for (const rn of nearby) {
        if (Game.map.getRoomStatus(rn).status !== 'normal') continue;
        if (Game.rooms[rn] && Game.rooms[rn].controller && Game.rooms[rn].controller.my) continue;
        const intel = roomIntel(rn);
        if (!intel) continue;
        const score = intel.sources*50 - intel.hostileStructures*100 - intel.distance*10;
        candidates.push({ roomName: rn, score, sources:intel.sources, distance:intel.distance });
    }
    candidates.sort((a,b)=> b.score - a.score);
    Memory.expansion.candidates = candidates.slice(0,10);
    Memory.expansion.target = candidates[0] && candidates[0].roomName;
    Memory.expansion.lastScan = Game.time;
    // 自動放置擴張旗標 (若無現有旗標)
    if (Memory.expansion.target && !Game.flags['expand:' + Memory.expansion.target]) {
        // 嘗試在可視房間邊界放旗標 (若有視野)
        const vis = Game.rooms[Memory.expansion.target];
        if (vis) vis.createFlag(25,25,'expand:' + Memory.expansion.target);
    }
}

function findNearbyRooms(start, range) {
    const visited = new Set([start]);
    const queue = [{ room:start, dist:0 }];
    const result = [];
    while (queue.length) {
        const cur = queue.shift();
        if (cur.dist >= 1) result.push(cur.room);
        if (cur.dist === range) continue;
        const exits = Game.map.describeExits(cur.room) || {};
        for (const dir in exits) {
            const rn = exits[dir];
            if (!visited.has(rn)) {
                visited.add(rn);
                queue.push({ room: rn, dist: cur.dist + 1 });
            }
        }
    }
    return result;
}

function roomIntel(rn) {
    // 簡化：若未視野回傳預估 (sources=2,distance=3)
    const visible = Game.rooms[rn];
    if (!visible) return { sources:2, hostileStructures:0, distance:3 };
    const sources = visible.find(FIND_SOURCES).length;
    const hostileStructures = visible.find(FIND_HOSTILE_STRUCTURES).length;
    const distance = 1; // 目前 BFS 近似，可進一步使用 Game.map.findRoute
    return { sources, hostileStructures, distance };
}

module.exports = { run };
