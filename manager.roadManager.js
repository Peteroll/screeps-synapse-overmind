// 道路維護與高流量補建
// 1. 掃描高 traffic (Memory.traffic) 且無道路 -> 建造 site
// 2. 找到受損道路 (hits < 50%) 加入 repair job (透過 jobManager 已有 repair 類型，自動觸發)

const THRESHOLD_TRAFFIC = 200; // 流量門檻
const MAX_SITES_PER_RUN = 3;

function run() {
    if (Game.time % 50 !== 0) return; // 節流
    for (const roomName in Game.rooms) {
        const room = Game.rooms[roomName];
        if (!room.controller || !room.controller.my) continue;
        maintain(room);
    }
}

function maintain(room) {
    const traffic = Memory.traffic && Memory.traffic[room.name];
    if (!traffic) return;
    let placed = 0;
    for (const key in traffic) {
        if (placed >= MAX_SITES_PER_RUN) break;
        const rec = traffic[key];
        if (rec.c < THRESHOLD_TRAFFIC) continue;
        const [x,y] = key.split('_').map(Number);
        const pos = new RoomPosition(x,y,room.name);
        // 已有道路或 site 跳過
        const hasRoad = pos.lookFor(LOOK_STRUCTURES).some(s=>s.structureType===STRUCTURE_ROAD);
        if (hasRoad) continue;
        const hasSite = pos.lookFor(LOOK_CONSTRUCTION_SITES).length>0;
        if (hasSite) continue;
        // 不放在牆或邊界
        if (room.getTerrain().get(x,y) === TERRAIN_MASK_WALL) continue;
        if (x<=1||x>=48||y<=1||y>=48) continue;
        if (room.createConstructionSite(x,y,STRUCTURE_ROAD) === OK) placed++;
    }
    // 受損道路 repair job 已由 jobManager 自動處理 (hits < 50%)
}

module.exports = { run };