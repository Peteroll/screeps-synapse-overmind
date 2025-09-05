module.exports = {
    run(creep) {
        if (creep.memory.working && creep.store[RESOURCE_ENERGY] === 0) creep.memory.working = false;
        if (!creep.memory.working && creep.store.getFreeCapacity() === 0) creep.memory.working = true;
        if (!creep.memory.targetRoom) assignRemote(creep);
        if (!creep.memory.targetRoom) return;

        if (!creep.memory.working) {
            // 前往遠程房間撿/取能量
            if (creep.room.name !== creep.memory.targetRoom) { moveToRoom(creep, creep.memory.targetRoom); return; }
            const drop = creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES, { filter: r => r.resourceType === RESOURCE_ENERGY && r.amount > 50 });
            if (drop) { if (creep.pickup(drop) === ERR_NOT_IN_RANGE) creep.moveTo(drop); return; }
            const cont = creep.pos.findClosestByPath(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_CONTAINER && s.store[RESOURCE_ENERGY] > 100 });
            if (cont) { if (creep.withdraw(cont, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) creep.moveTo(cont); return; }
            const src = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
            if (src && creep.harvest(src) === ERR_NOT_IN_RANGE) creep.moveTo(src);
            else {
                const jm = require('manager.jobManager');
                jm.fallbackTask(creep);
            }
        } else {
            // 回母房
            const firstSpawnName = Object.keys(Game.spawns)[0];
            const home = firstSpawnName ? Game.spawns[firstSpawnName].room : null;
            if (home && creep.room.name !== home.name) { moveToRoom(creep, home.name); return; }
            const target = creep.pos.findClosestByPath(FIND_STRUCTURES, { filter: s => [STRUCTURE_SPAWN, STRUCTURE_EXTENSION, STRUCTURE_STORAGE, STRUCTURE_TOWER].includes(s.structureType) && s.store.getFreeCapacity(RESOURCE_ENERGY) > 0 });
            if (target) { if (creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) creep.moveTo(target); }
            else {
                const jm = require('manager.jobManager');
                jm.fallbackTask(creep);
            }
        }
    }
};

function assignRemote(creep) {
    if (!Memory.remotes) return;
    for (const roomName in Memory.remotes) {
        const need = Memory.remotes[roomName];
        if (!need) continue;
        const count = Object.values(Game.creeps).filter(c => c.memory.role === 'remoteHauler' && c.memory.targetRoom === roomName).length;
        if (count < (need.haulers || 1)) { creep.memory.targetRoom = roomName; return; }
    }
}

function moveToRoom(creep, roomName) {
    const exitDir = Game.map.findExit(creep.room, roomName);
    const exit = creep.pos.findClosestByRange(exitDir);
    if (exit) creep.moveTo(exit);
}
