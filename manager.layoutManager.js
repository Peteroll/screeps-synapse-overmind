// 建築規劃管理：在 RCL 變化或缺 layout 時生成基礎道路 / extension / link 初步佈局
// Memory.layout[roomName] = { rclPlanned: <number>, roads: [[x,y],...], extensions: [[x,y],...], links: [[x,y],...], lastUpdate: Game.time }

function run() {
    if (!Memory.layout) Memory.layout = {};
    for (const roomName in Game.rooms) {
        const room = Game.rooms[roomName];
        if (!room.controller || !room.controller.my) continue;
        const rcl = room.controller.level;
        const lay = Memory.layout[roomName];
        if (!lay || lay.rclPlanned !== rcl) {
            Memory.layout[roomName] = planRoom(room, rcl);
        }
        // 可擴充：放置 construction sites (節流)
        placeSites(room, Memory.layout[roomName]);
    }
}

function planRoom(room, rcl) {
    const spawn = room.find(FIND_MY_SPAWNS)[0];
    if (!spawn) return { rclPlanned: rcl, roads: [], extensions: [], links: [], lastUpdate: Game.time };
    const sources = room.find(FIND_SOURCES);
    const roads = [];
    // 簡單：spawn->sources 路徑紀錄
    for (const src of sources) {
        const path = room.findPath(spawn.pos, src.pos, { ignoreCreeps: true });
        for (const step of path) roads.push([step.x, step.y]);
    }
    // extensions 環繞 spawn 同心圈 (不疊加道路)
    const extSlots = extensionSlotsOrdered(spawn.pos, 25).filter(p => !roads.some(r => r[0] === p[0] && r[1] === p[1]));
    let extCount = Math.min(maxExtensions(rcl), extSlots.length);
    const extensions = extSlots.slice(0, extCount);
    // links: spawn 附近 1 個 + 每個 source 旁 1 個 (RCL >=5)
    const links = [];
    if (rcl >= 5) {
        links.push([spawn.pos.x + 1, spawn.pos.y]);
        for (const src of sources) {
            links.push([src.pos.x + 1, src.pos.y]);
        }
    }
    // Hub 規劃 (storage/terminal/labs) 簡化：在 spawn 附近 5x5 區域挑空格
    const hub = {};
    if (rcl >= 4) {
        hub.storage = [spawn.pos.x, spawn.pos.y + 2];
    }
    if (rcl >= 6) {
        hub.terminal = [spawn.pos.x + 1, spawn.pos.y + 2];
        // 簡化放 3 labs
        hub.labs = [
            [spawn.pos.x -1, spawn.pos.y +2],
            [spawn.pos.x -1, spawn.pos.y +3],
            [spawn.pos.x, spawn.pos.y +3]
        ];
    }
    return { rclPlanned: rcl, roads: dedupXY(roads), extensions, links, hub, lastUpdate: Game.time };
}

function dedupXY(arr) {
    const seen = new Set();
    const out = [];
    for (const [x,y] of arr) {
        const k = x + ',' + y;
        if (!seen.has(k)) { seen.add(k); out.push([x,y]); }
    }
    return out;
}

function extensionSlotsOrdered(center, maxRadius) {
    const coords = [];
    for (let r=1; r<=maxRadius; r++) {
        for (let dx=-r; dx<=r; dx++) {
            for (let dy=-r; dy<=r; dy++) {
                if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue; // 只取外圈
                const x = center.x + dx, y = center.y + dy;
                if (x<2||x>47||y<2||y>47) continue;
                coords.push([x,y]);
            }
        }
    }
    return coords;
}

function maxExtensions(rcl) {
    return [0,0,5,10,20,30,40,50,60][rcl] || 0;
}

function placeSites(room, layout) {
    if (Game.time % 25 !== 0) return; // 節流
    if (!layout) return;
    const existing = room.find(FIND_STRUCTURES).map(s => s.pos.x+','+s.pos.y);
    const sites = room.find(FIND_CONSTRUCTION_SITES).map(s => s.pos.x+','+s.pos.y);
    function tryPlace(type, list, limitPerRun=3) {
        let placed = 0;
        for (const [x,y] of list) {
            if (placed>=limitPerRun) break;
            const k = x+','+y;
            if (!existing.includes(k) && !sites.includes(k)) {
                if (room.createConstructionSite(x,y,type) === OK) placed++;
            }
        }
    }
    tryPlace(STRUCTURE_ROAD, layout.roads, 5);
    tryPlace(STRUCTURE_EXTENSION, layout.extensions, 2);
    if (room.controller.level >=5) tryPlace(STRUCTURE_LINK, layout.links, 1);
    // Hub 結構
    if (layout.hub) {
        if (layout.hub.storage) tryPlace(STRUCTURE_STORAGE, [layout.hub.storage], 1);
        if (layout.hub.terminal && room.controller.level >=6) tryPlace(STRUCTURE_TERMINAL, [layout.hub.terminal], 1);
        if (layout.hub.labs && room.controller.level >=6) tryPlace(STRUCTURE_LAB, layout.hub.labs, 2);
    }
}

module.exports = { run };
