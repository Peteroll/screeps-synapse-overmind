// 遠程房間管理：依旗標命名部署 reserver / remoteMiner / remoteHauler
// 旗標命名格式: remote:W1N1:mine  or remote:W1N1:reserve
const log = require('util.log');

function scanFlags() {
    if (!Memory.remotes) Memory.remotes = {};
    for (const name in Game.flags) {
        if (!name.startsWith('remote:')) continue;
        const parts = name.split(':');
        if (parts.length < 3) continue;
        const targetRoom = parts[1];
        const mode = parts[2];
        if (!Memory.remotes[targetRoom]) Memory.remotes[targetRoom] = { mode, miners: 1, haulers: 1, reserver: (mode === 'reserve' || mode === 'mine') };
    }
}

function plan() {
    // 計算目前遠程相關 creep 數
    const counts = { remoteMiner: 0, remoteHauler: 0, reserver: 0 };
    for (const n in Game.creeps) {
        const r = Game.creeps[n].memory.role;
        if (counts[r] !== undefined) counts[r]++;
    }
    // 產出 global 欲求 (存 Memory 供 spawnManager 可讀)
    Memory.remoteDesired = {};
    for (const roomName in Memory.remotes) {
        const meta = Memory.remotes[roomName];
        Memory.remoteDesired[roomName] = {
            remoteMiner: meta.miners,
            remoteHauler: meta.haulers,
            reserver: meta.reserver ? 1 : 0
        };
    }
}

module.exports = { scanFlags, plan };
