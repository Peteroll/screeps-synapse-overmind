module.exports = {
    run(creep) {
    // working = true means performing upgrade; false means gathering
    if (creep.memory.working === undefined) creep.memory.working = false;
    if (creep.memory.working && creep.store[RESOURCE_ENERGY] === 0) {
            creep.memory.working = false;
        } else if (!creep.memory.working && creep.store.getFreeCapacity() === 0) {
            // full -> switch to working (upgrade)
            creep.memory.working = true;
        }

        if (creep.memory.working) {
            if (creep.room.controller) {
                if (creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(creep.room.controller);
                }
            }
            return;
        }

        // gather energy: prefer containers/storage then active sources
        const cont = creep.pos.findClosestByPath(FIND_STRUCTURES, {
            filter: s => [STRUCTURE_CONTAINER, STRUCTURE_STORAGE].includes(s.structureType) && s.store[RESOURCE_ENERGY] > 0
        });
        if (cont) {
            if (creep.withdraw(cont, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) creep.moveTo(cont);
            return;
        }

        const src = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
        if (src) {
            if (creep.harvest(src) === ERR_NOT_IN_RANGE) creep.moveTo(src);
            return;
        }

        // no energy sources found; if we have any energy, allow upgrading with what we have
        if (creep.store[RESOURCE_ENERGY] > 0) {
            creep.memory.working = true;
            return;
        }
    }
};
