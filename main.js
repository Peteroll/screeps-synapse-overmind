// Minimal starter: 儘快將 RCL 升滿的最小策略
const spawnManager = require('manager.spawnManager');
const roleMiner = require('role.miner');
const roleHauler = require('role.hauler');
const roleUpgrader = require('role.upgrader');

module.exports.loop = function () {
    // 簡單清理 Memory
    for (const name in Memory.creeps) if (!Game.creeps[name]) delete Memory.creeps[name];

    // 進行產生決策
    spawnManager.run();

    // 執行每個 creep 的行為
    for (const name in Game.creeps) {
        const creep = Game.creeps[name];
        const role = creep.memory.role || 'upgrader';
        if (role === 'miner') roleMiner.run(creep);
        else if (role === 'hauler') roleHauler.run(creep);
        else roleUpgrader.run(creep);
    }
};
// end of minimal starter

