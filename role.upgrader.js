module.exports = {
    run(creep) {
        if (creep.memory.working && creep.store[RESOURCE_ENERGY] === 0) creep.memory.working = false;
        if (!creep.memory.working && creep.store.getFreeCapacity() === 0) creep.memory.working = true;

        if (creep.memory.working) {
            if (creep.room.controller) {
                const r = creep.upgradeController(creep.room.controller);
                if (r === ERR_NOT_IN_RANGE) creep.moveTo(creep.room.controller);
            }
        } else {
            const cont = creep.pos.findClosestByPath(FIND_STRUCTURES, { filter: s => [STRUCTURE_CONTAINER, STRUCTURE_STORAGE].includes(s.structureType) && s.store[RESOURCE_ENERGY] > 0 });
            if (cont) { if (creep.withdraw(cont, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) creep.moveTo(cont); return; }
            const src = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
            if (src && creep.harvest(src) === ERR_NOT_IN_RANGE) creep.moveTo(src);
            else {
                const jm = require('manager.jobManager');
                jm.fallbackTask(creep);
            }
        }
    }
};
