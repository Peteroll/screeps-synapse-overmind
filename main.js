// Minimal starter: 儘快將 RCL 升滿的最小策略
const spawnManager = require('manager.spawnManager');
const roleMiner = require('role.miner');
const roleHauler = require('role.hauler');
const roleUpgrader = require('role.upgrader');
const roleBuilder = require('role.builder');

module.exports.loop = function () {
    // 清理 Memory：呼叫 housekeeping 做較完整的清理
    housekeeping();

    // 進行產生決策
    spawnManager.run();
    try { require('manager.expansionManager').run(); } catch (e) {}
    try { require('manager.expansionManager').dispatch(); } catch (e) {}

    // 執行每個 creep 的行為
    for (const name in Game.creeps) {
        const creep = Game.creeps[name];
        const role = creep.memory.role || 'upgrader';
    if (role === 'miner') roleMiner.run(creep);
    else if (role === 'hauler') roleHauler.run(creep);
    else if (role === 'builder') roleBuilder.run(creep);
    else roleUpgrader.run(creep);
    }
};
// end of minimal starter

function housekeeping() {
    // 清理已死亡的 creep 記憶
    for (const name in Memory.creeps) if (!Game.creeps[name]) { delete Memory.creeps[name]; }

    // allowed keys to keep in Memory
    const keep = new Set(['spawnQueue', 'roomContainers', 'meta', 'creeps', 'roomReadyForExpansion', 'roomPlannedCity', 'forceContainerBuildUntil', 'expansion']);

    // 保留以房間名稱為 key 的記憶（若房間存在）
    const roomNames = new Set(Object.keys(Game.rooms || {}));

    for (const key in Memory) {
        if (keep.has(key)) continue;
        if (roomNames.has(key)) continue; // keep room-level memory if room exists
        // remove other keys as unused
        try { console.log('[housekeeping] removing Memory.' + key); } catch (e) {}
        delete Memory[key];
    }
}

