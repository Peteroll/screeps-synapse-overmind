// 控制經濟節流：依 storage/terminal 能量調整 upgrader/hauler 目標，並標記節流模式
const config = require('util.config');

function run() {
    if (Game.time % 20 !== 0) return;
    for (const roomName in Game.rooms) {
        const room = Game.rooms[roomName];
        if (!room.controller || !room.controller.my) continue;
        const energyStore = (room.storage && room.storage.store[RESOURCE_ENERGY]) || 0;
        if (!Memory.economy) Memory.economy = {};
        if (!Memory.economy[roomName]) Memory.economy[roomName] = {};
        const state = Memory.economy[roomName];
        state.energy = energyStore;
        if (energyStore < 40000) state.mode = 'conserve';
        else if (energyStore > 200000) state.mode = 'boost';
        else state.mode = 'normal';
    }
}

// 供 spawnManager 讀取：根據 mode 附加加權調整數量
function modeMultiplier(room) {
    const econ = Memory.economy && Memory.economy[room.name];
    if (!econ) return 1;
    if (econ.mode === 'conserve') return 0.6;
    if (econ.mode === 'boost') return 1.3;
    return 1;
}

module.exports = { run, modeMultiplier };
