// 建築規劃管理：在 RCL 變化或缺 layout 時生成基礎道路 / extension / link 初步佈局
// Memory.layout[roomName] = { rclPlanned: <number>, roads: [[x,y],...], extensions: [[x,y],...], links: [[x,y],...], lastUpdate: Game.time }

function run() {
    if (!Memory.layout) Memory.layout = {};
    if (!Memory.layoutEval) Memory.layoutEval = {};
    for (const roomName in Game.rooms) {
        const room = Game.rooms[roomName];
        if (!room.controller || !room.controller.my) continue;
        const rcl = room.controller.level;
        const lay = Memory.layout[roomName];
        if (!lay || lay.rclPlanned !== rcl) {
            Memory.layout[roomName] = planRoom(room, rcl);
        }
        placeSites(room, Memory.layout[roomName]);
        evaluateExisting(room, Memory.layout[roomName]);
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
        // Labs 初階 (3)
        const baseLabs = [
            [spawn.pos.x -1, spawn.pos.y +2],
            [spawn.pos.x -1, spawn.pos.y +3],
            [spawn.pos.x, spawn.pos.y +3]
        ];
        // RCL8 追加擴展 labs (最多 10) 圍繞 storage/terminal 區域
        if (rcl >= 8) {
            const extra = [
                [spawn.pos.x +2, spawn.pos.y +2],
                [spawn.pos.x +2, spawn.pos.y +1],
                [spawn.pos.x +2, spawn.pos.y +3],
                [spawn.pos.x +1, spawn.pos.y +3],
                [spawn.pos.x -2, spawn.pos.y +2],
                [spawn.pos.x, spawn.pos.y +4],
                [spawn.pos.x +1, spawn.pos.y +4]
            ];
            hub.labs = baseLabs.concat(extra).slice(0,10);
        } else hub.labs = baseLabs;
    }
    // Factory 放置 (RCL7+) 若未放置：
    if (rcl >=7) {
        hub.factory = [spawn.pos.x +2, spawn.pos.y +1];
    }
    // Rampart ring (RCL5+)：以 spawn 為中心半徑3 形成方形護盾
    let ramparts = [];
    if (rcl >=5) {
        const radius = 3;
        for (let dx=-radius; dx<=radius; dx++) {
            for (let dy=-radius; dy<=radius; dy++) {
                if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue; // 只取外框
                const x = spawn.pos.x + dx, y = spawn.pos.y + dy;
                if (x<1||x>48||y<1||y>48) continue;
                ramparts.push([x,y]);
            }
        }
    }
    // 記錄礦物座標 (便於後續建立 extractor)
    const mineral = room.find(FIND_MINERALS)[0];
    const mineralPos = mineral ? [mineral.pos.x, mineral.pos.y] : null;
    return { rclPlanned: rcl, roads: dedupXY(roads), extensions, links, hub, ramparts: dedupXY(ramparts), mineral: mineralPos, lastUpdate: Game.time };
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
        if (layout.hub.factory && room.controller.level >=7) tryPlace(STRUCTURE_FACTORY, [layout.hub.factory], 1);
        // 保護核心設施：在 storage / terminal / factory / labs 上擺 rampart (RCL6+)
        if (room.controller.level >=6) {
            const protect = [];
            ['storage','terminal','factory'].forEach(k=> layout.hub[k] && protect.push(layout.hub[k]));
            if (layout.hub.labs) protect.push(...layout.hub.labs);
            tryPlace(STRUCTURE_RAMPART, protect, 6);
        }
    }
    // Rampart ring 放置 (RCL5+)
    if (room.controller.level >=5 && layout.ramparts) tryPlace(STRUCTURE_RAMPART, layout.ramparts, 4);
    // Extractor (RCL6+) 若房有 mineral 且尚未有 extractor
    if (room.controller.level >=6 && layout.mineral) {
        const hasExtractor = room.find(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_EXTRACTOR }).length > 0
            || room.find(FIND_CONSTRUCTION_SITES, { filter: s => s.structureType === STRUCTURE_EXTRACTOR }).length > 0;
        if (!hasExtractor) {
            const [mx,my] = layout.mineral;
            room.createConstructionSite(mx,my,STRUCTURE_EXTRACTOR);
        }
        // 旁邊 container site (若無 container / site) 讓 builder 先建，避免等待 miner 出現才放
        const [mx,my] = layout.mineral;
        const mineralPos = new RoomPosition(mx,my,room.name);
        const hasContainer = mineralPos.findInRange(FIND_STRUCTURES,1,{filter:s=>s.structureType===STRUCTURE_CONTAINER}).length>0;
        const hasContainerSite = mineralPos.findInRange(FIND_CONSTRUCTION_SITES,1,{filter:s=>s.structureType===STRUCTURE_CONTAINER}).length>0;
        if (!hasContainer && !hasContainerSite) {
            // 嘗試在 mineral 四周找可建地形
            for (let dx=-1; dx<=1; dx++) for (let dy=-1; dy<=1; dy++) {
                if (dx===0 && dy===0) continue;
                const x=mx+dx, y=my+dy;
                if (x<1||x>48||y<1||y>48) continue;
                if (room.getTerrain().get(x,y) === TERRAIN_MASK_WALL) continue;
                if (room.createConstructionSite(x,y,STRUCTURE_CONTAINER) === OK) { dx=2; dy=2; break; }
            }
        }
    }
    // Container -> Link 升級：若 source 旁已有 link 則嘗試移除幾乎空的 container
    if (room.controller.level >=6) {
        const sourceLinks = room.find(FIND_STRUCTURES,{filter:s=>s.structureType===STRUCTURE_LINK});
        for (const src of room.find(FIND_SOURCES)) {
            const hasLink = sourceLinks.some(l=> l.pos.inRangeTo(src.pos,2));
            if (!hasLink) continue;
            const cont = src.pos.findInRange(FIND_STRUCTURES,1,{filter:s=>s.structureType===STRUCTURE_CONTAINER})[0];
            if (cont && cont.store.getUsedCapacity() < 200) cont.destroy();
        }
    }
}

// 評估既有結構是否保留：
// 1. extension / link / lab 等若不在 layout 計畫座標且屬於本房，標記拆除 (延遲執行)
// 2. 道路：使用 traffic delta 判斷長期低使用且不在 layout.roads -> 拆除
function evaluateExisting(room, layout) {
    const cfg = require('util.config').LAYOUT;
    if (Game.time % cfg.EVALUATE_INTERVAL !== 0) return;
    if (!layout) return;
    const rec = Memory.layoutEval[room.name] || (Memory.layoutEval[room.name] = { dismantleQueue: {} });
    const plannedSets = buildPlannedSets(layout);
    const all = room.find(FIND_STRUCTURES);
    for (const s of all) {
        if (!shouldConsider(s)) continue;
        const key = s.pos.x+','+s.pos.y+'_'+s.structureType;
        if (isPlanned(plannedSets, s)) {
            // 若之前排拆現在又成為計畫 -> 取消
            if (rec.dismantleQueue[key]) delete rec.dismantleQueue[key];
            continue;
        }
        // 道路特殊：看 traffic delta
        if (s.structureType === STRUCTURE_ROAD) {
            if (room.controller.level < cfg.UNUSED_ROAD_MIN_RCL) continue;
            const tRec = Memory.traffic && Memory.traffic[room.name] && Memory.traffic[room.name][s.pos.x+'_'+s.pos.y];
            if (!tRec) continue; // 無資料暫不處理
            const delta = (tRec.c || 0) - (tRec.lc || 0); // 使用前後紀錄計算 delta
            if (plannedSets.roads.has(s.pos.x+','+s.pos.y)) continue; // 計畫內道路保留
            if (delta >= cfg.UNUSED_ROAD_DELTA_THRESHOLD) continue; // 有使用
            enqueue(rec.dismantleQueue, key, s.id);
            continue;
        }
        // 其他結構 (extension/link/lab/container...) 若不在計畫座標 -> 排拆
        enqueue(rec.dismantleQueue, key, s.id);
    }
    // 執行延遲拆除 (限制數量)
    let removed = 0;
    for (const k in rec.dismantleQueue) {
        if (removed >= cfg.MAX_DISMANTLE_PER_RUN) break;
        const d = rec.dismantleQueue[k];
        if (!d || !d.id) { delete rec.dismantleQueue[k]; continue; }
        const obj = Game.getObjectById(d.id);
        if (!obj) { delete rec.dismantleQueue[k]; continue; }
        if (Game.time - d.ts < cfg.MISPLACED_DISMANTLE_DELAY) continue; // 尚未達等待時間
        // 避免誤拆：spawn / storage / terminal / controller 還是保留
        if (obj.structureType === STRUCTURE_SPAWN || obj.structureType === STRUCTURE_STORAGE || obj.structureType === STRUCTURE_TERMINAL || obj.structureType === STRUCTURE_CONTROLLER) { delete rec.dismantleQueue[k]; continue; }
        obj.destroy();
        removed++;
        delete rec.dismantleQueue[k];
    }
}

function buildPlannedSets(layout) {
    const setOf = arr => {
        const s = new Set();
        if (!arr) return s; for (let i=0;i<arr.length;i++) s.add(arr[i][0]+','+arr[i][1]);
        return s;
    };
    return {
        roads: setOf(layout.roads),
        extensions: setOf(layout.extensions),
        links: setOf(layout.links),
        labs: layout.hub && layout.hub.labs ? setOf(layout.hub.labs) : new Set(),
        storage: layout.hub && layout.hub.storage ? new Set([layout.hub.storage[0]+','+layout.hub.storage[1]]) : new Set(),
        terminal: layout.hub && layout.hub.terminal ? new Set([layout.hub.terminal[0]+','+layout.hub.terminal[1]]) : new Set(),
        factory: layout.hub && layout.hub.factory ? new Set([layout.hub.factory[0]+','+layout.hub.factory[1]]) : new Set()
    };
}

function isPlanned(sets, s) {
    const k = s.pos.x+','+s.pos.y;
    switch (s.structureType) {
        case STRUCTURE_ROAD: return sets.roads.has(k);
        case STRUCTURE_EXTENSION: return sets.extensions.has(k);
        case STRUCTURE_LINK: return sets.links.has(k);
        case STRUCTURE_LAB: return sets.labs.has(k);
        case STRUCTURE_STORAGE: return sets.storage.has(k);
        case STRUCTURE_TERMINAL: return sets.terminal.has(k);
        case STRUCTURE_FACTORY: return sets.factory.has(k);
        default: return true; // 其他暫不強制規劃 (如 tower / rampart / container)
    }
}

function shouldConsider(s) {
    // 僅處理我方所有權 (except road 也屬於我方) & 排除 controller / wall / rampart (不要自動拆)
    if (s.structureType === STRUCTURE_CONTROLLER) return false;
    if (s.structureType === STRUCTURE_RAMPART) return false;
    if (s.structureType === STRUCTURE_WALL) return false;
    if (s.structureType === STRUCTURE_TOWER) return false; // 暫不自動調整 tower 位置
    if (s.structureType === STRUCTURE_CONTAINER && s.pos.findInRange(FIND_SOURCES,1).length>0) return false; // source container 暫保留
    return true;
}

function enqueue(queue, key, id) {
    if (!queue[key]) queue[key] = { id:id, ts: Game.time };
}

module.exports = { run };
