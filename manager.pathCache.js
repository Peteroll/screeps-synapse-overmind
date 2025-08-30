// 簡易路徑快取：serialize 常用來源->結構路徑
// Memory.pathCache = { key: { path, lastUse } }

function run() {
    if (!Memory.pathCache) Memory.pathCache = {};
    // 週期清理過久未用路徑
    if (Game.time % 1500 === 0) {
        for (const k in Memory.pathCache) {
            if (Game.time - Memory.pathCache[k].lastUse > 5000) delete Memory.pathCache[k];
        }
    }
}

function isSerializedPath(str) {
    // Room.serializePath returns a string (may contain non-printable chars).
    // Only need to check it's a non-empty string here.
    return typeof str === 'string' && str.length > 0;
}

function getPath(fromPos, toPos) {
    const key = `${fromPos.roomName}:${fromPos.x},${fromPos.y}->${toPos.roomName}:${toPos.x},${toPos.y}`;
    const cacheEntry = Memory.pathCache[key];
    if (cacheEntry) {
        cacheEntry.lastUse = Game.time;
        const stored = cacheEntry.path;
        if (isSerializedPath(stored)) {
            try {
                const steps = Room.deserializePath(stored);
                // 轉成簡單 {x,y} 物件 (後續 moveSmart 只用 x,y)
                return steps.map(s => ({ x: s.x, y: s.y }));
            } catch (e) {
                delete Memory.pathCache[key]; // 失敗重算
            }
        } else {
            // 舊格式或無效 → 移除
            delete Memory.pathCache[key];
        }
    }

    const ret = PathFinder.search(fromPos, { pos: toPos, range: 1 }, { swampCost: 3 });
    // 僅快取單房間完整路徑 (Room.serializePath 限制)
    const singleRoom = ret.path.length > 0 && ret.path.every(p => p.roomName === fromPos.roomName);
    if (!ret.incomplete && singleRoom && ret.path.length) {
        try {
            Memory.pathCache[key] = { path: Room.serializePath(ret.path), lastUse: Game.time };
        } catch (e) {
            // 序列化失敗則忽略快取
        }
    }
    return ret.path;
}

module.exports = { run };
