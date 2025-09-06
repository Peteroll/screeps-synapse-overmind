// 移除 jobManager 依賴

module.exports = {
    run(creep) {
        if (creep.memory.working === undefined) creep.memory.working = false;
        if (creep.memory.working && creep.store[RESOURCE_ENERGY] === 0) {
            creep.memory.working = false;
        } else if (!creep.memory.working && creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
            creep.memory.working = true;
        }

        if (!creep.memory.working) {
            const cont = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: s => [STRUCTURE_CONTAINER, STRUCTURE_STORAGE].includes(s.structureType) && s.store[RESOURCE_ENERGY] > 0
            });
            if (cont) {
                if (creep.withdraw(cont, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) creep.moveTo(cont);
                return;
            }
            const src = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
            if (src && creep.harvest(src) === ERR_NOT_IN_RANGE) creep.moveTo(src);
            return;
        }

        const tgt = creep.pos.findClosestByPath(FIND_STRUCTURES, {
            filter: s => s.hits < s.hitsMax * 0.9
        });
        if (tgt) {
            if (creep.repair(tgt) === ERR_NOT_IN_RANGE) creep.moveTo(tgt);
            return;
        }

        if (creep.room.controller) {
            if (creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) creep.moveTo(creep.room.controller);
        }
    }
};
