// 控制經濟節流：依 storage/terminal 能量調整 upgrader/hauler 目標，並標記節流模式
const config = require('util.config');

function run() {
    if (Game.time % 10 !== 0) return;
    if (!Memory.economy) Memory.economy = {};
    for (var roomName in Game.rooms) {
        var room = Game.rooms[roomName];
        if (!room.controller || !room.controller.my) continue;
        if (!Memory.economy[roomName]) Memory.economy[roomName] = {};
        var state = Memory.economy[roomName];
        var energyStore = (room.storage && room.storage.store[RESOURCE_ENERGY]) || 0;
        var termEnergy = (room.terminal && room.terminal.store[RESOURCE_ENERGY]) || 0;
        var totalEnergy = energyStore + termEnergy;
        var siteCount = room.find(FIND_CONSTRUCTION_SITES).length;
        var controllerProgress = room.controller.progress || 0;
        if (!state.prevCtrl) state.prevCtrl = controllerProgress;
        state.upgradeDelta = controllerProgress - state.prevCtrl;
        state.prevCtrl = controllerProgress;
        state.energy = energyStore;
        state.totalEnergy = totalEnergy;
        state.sites = siteCount;
        var mode = 'normal';
        if (totalEnergy < 40000) mode = 'conserve';
        else if (siteCount > 15 && totalEnergy > 120000) mode = 'buildRush';
        else if (totalEnergy > 250000 && room.controller.level < 8) mode = 'upgradeRush';
        else if (totalEnergy > 200000 && hasBoostNeed()) mode = 'boost';
        state.mode = mode;
    }
}

function hasBoostNeed() {
    if (!Memory.boost || !Memory.boost.reserved) return false;
    for (var k in Memory.boost.reserved) if (Memory.boost.reserved[k] > 0) return true;
    return false;
}

// 供 spawnManager 讀取：根據 mode 附加加權調整數量
function modeRoleMultiplier(room, role) {
    var econ = Memory.economy && Memory.economy[room.name];
    if (!econ) return 1;
    var m = econ.mode;
    if (m === 'conserve') {
        if (role === 'upgrader') return 0.4; if (role === 'builder') return 0.5; return 1;
    }
    if (m === 'buildRush') {
        if (role === 'builder') return 1.8; if (role === 'repairer') return 1.2; return 1;
    }
    if (m === 'upgradeRush') {
        if (role === 'upgrader') return 2.2; return 1;
    }
    if (m === 'boost') {
        if (role === 'ranger' || role === 'repairer') return 1.5; return 1;
    }
    return 1; // normal
}
module.exports = { run, modeRoleMultiplier };
