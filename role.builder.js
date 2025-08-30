// 移除 jobManager 依賴

module.exports = {
    run(creep) {
        if (creep.store[RESOURCE_ENERGY] === 0) {
            const cont = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: s => [STRUCTURE_CONTAINER, STRUCTURE_STORAGE].includes(s.structureType) && s.store[RESOURCE_ENERGY] > 0
            });
            if (cont) {
                if (creep.withdraw(cont, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) creep.moveTo(cont);
                return;
            }
            const src = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
            if (src && creep.harvest(src) === ERR_NOT_IN_RANGE) creep.moveTo(src);
        } else {
            const site = creep.pos.findClosestByPath(FIND_CONSTRUCTION_SITES);
            if (site) {
                if (creep.build(site) === ERR_NOT_IN_RANGE) creep.moveTo(site);
            } else if (creep.room.controller) {
                if (creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) creep.moveTo(creep.room.controller);
            }
        }
    }
};
