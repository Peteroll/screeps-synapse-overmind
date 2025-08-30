// 遠程房間管理：依旗標命名部署 reserver / remoteMiner / remoteHauler
// 旗標命名格式: remote:W1N1:mine  or remote:W1N1:reserve
const log = require('util.log');
const config = require('util.config');

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
        // Hostile 基於 intel 暫停：若連續看到敵人 hostiles >0，標記 suspended
        if (!meta.state) meta.state = { hostileTicks:0, clearTicks:0, suspended:false };
        const intel = Memory.intel && Memory.intel[roomName];
        const lowROI = meta.state.lowROI;
        if (intel && intel.hostileCount > 0) {
            meta.state.hostileTicks++;
            meta.state.clearTicks = 0;
            if (meta.state.hostileTicks >= config.INTEL.REMOTE_HOSTILE_SUSPEND_TICKS) meta.state.suspended = true;
        } else if (lowROI) {
            // ROI 低時保持暫停 (若已連續低 ROI 在 roiManager 中設定)，這裡直接掛起
            meta.state.suspended = true;
        } else {
            meta.state.clearTicks++;
            if (meta.state.clearTicks >= config.INTEL.REMOTE_RESUME_CLEAR_TICKS) {
                meta.state.suspended = false;
                meta.state.hostileTicks = 0;
                meta.state.lowROI = false;
            }
        }
        Memory.remoteDesired[roomName] = {
            remoteMiner: meta.state.suspended ? 0 : meta.miners,
            remoteHauler: meta.state.suspended ? 0 : meta.haulers,
            reserver: meta.state.suspended ? 0 : (meta.reserver ? 1 : 0),
            suspended: meta.state.suspended
        };
    }
}

module.exports = { scanFlags, plan };
