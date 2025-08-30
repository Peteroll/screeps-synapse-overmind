// CostMatrix 快取：預建房間移動成本，含道路/不可走/基本權重 + 動態擁擠度
// Memory.costMatrix[roomName] = { tick: <Game.time>, data: <serialized> }
// Memory.traffic = { roomName: { x_y: { c:count, last:tick } } }
// 在 main 每 tick 呼叫 recordTraffic() 再 run() 重建 (run() 已節流)

function run() {
    if (!Memory.costMatrix) Memory.costMatrix = {};
    for (const roomName in Game.rooms) {
        const room = Game.rooms[roomName];
        if (!room.controller || !room.controller.my) continue;
        // 每 500 tick 重建一次或第一次
        if (!Memory.costMatrix[roomName] || Game.time - Memory.costMatrix[roomName].tick > 500) {
            const cm = buildMatrix(room);
            Memory.costMatrix[roomName] = { tick: Game.time, data: cm.serialize() };
        }
    }
}

function buildMatrix(room) {
    const cm = new PathFinder.CostMatrix();
    // 道路 = 1
    room.find(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_ROAD })
        .forEach(s => cm.set(s.pos.x, s.pos.y, 1));
    // 不可走：牆、不可穿越建築
    room.find(FIND_STRUCTURES, { filter: s => ![STRUCTURE_ROAD, STRUCTURE_CONTAINER, STRUCTURE_RAMPART].includes(s.structureType) })
        .forEach(s => cm.set(s.pos.x, s.pos.y, 0xff));
    // 建造中的建築（除了道路/容器/斜坡）
    room.find(FIND_CONSTRUCTION_SITES, { filter: s => ![STRUCTURE_ROAD, STRUCTURE_CONTAINER, STRUCTURE_RAMPART].includes(s.structureType) })
        .forEach(s => cm.set(s.pos.x, s.pos.y, 0xff));
    // 動態擁擠度：將高流量格調升 cost (不超 20)
    const tMap = Memory.traffic && Memory.traffic[room.name];
    if (tMap) {
        for (const key in tMap) {
            const rec = tMap[key];
            if (Game.time - rec.last > 1000) continue; // 太久不使用忽略
            const [x,y] = key.split('_').map(Number);
            const base = cm.get(x,y);
            if (base !== 0xff) {
                const extra = Math.min(20, 1 + Math.floor(rec.c / 50));
                const val = base === 0 ? extra : Math.min(254, base + extra);
                cm.set(x,y,val);
            }
        }
    }
    return cm;
}

function get(roomName) {
    const entry = Memory.costMatrix && Memory.costMatrix[roomName];
    if (!entry) return null;
    try {
        return PathFinder.CostMatrix.deserialize(entry.data);
    } catch(e) {
        delete Memory.costMatrix[roomName];
        return null;
    }
}

module.exports = { run, get };
// 記錄交通熱度
function recordTraffic() {
    if (!Memory.traffic) Memory.traffic = {};
    for (const name in Game.creeps) {
        const c = Game.creeps[name];
        if (!c.room.controller || !c.room.controller.my) continue;
        const rn = c.room.name;
        if (!Memory.traffic[rn]) Memory.traffic[rn] = {};
        const key = c.pos.x + '_' + c.pos.y;
        const spot = Memory.traffic[rn][key] || { c:0, last:Game.time };
        spot.c = Math.min(10000, spot.c + 1);
        spot.last = Game.time;
        Memory.traffic[rn][key] = spot;
    }
    // 週期性衰減 (每 100 tick)
    if (Game.time % 100 === 0) {
        for (const rn in Memory.traffic) {
            for (const k in Memory.traffic[rn]) {
                Memory.traffic[rn][k].c = Math.floor(Memory.traffic[rn][k].c * 0.5);
            }
        }
    }
}

module.exports.recordTraffic = recordTraffic;
