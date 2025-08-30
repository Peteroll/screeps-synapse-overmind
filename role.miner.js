module.exports = {
    run(creep) {
        // 若有空間就採集
        if (creep.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
            const src = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
            if (src) {
                if (creep.harvest(src) === ERR_NOT_IN_RANGE) creep.moveTo(src, { visualizePathStyle: { stroke: '#ffaa00' } });
            }
            return;
        }

        // 滿載後嘗試交付能量
        // 優先使用記錄在 Memory.roomContainers 的 container
        const roomContainers = (Memory.roomContainers && Memory.roomContainers[creep.room.name]) || [];
        for (const id of roomContainers) {
            const c = Game.getObjectById(id);
            if (c && c.store && c.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                if (creep.transfer(c, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) creep.moveTo(c);
                return;
            }
        }

        // 若沒有 container 或 container 已滿，退回到附近的 spawn/extension/storage
        const target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
            filter: (s) => (s.structureType === STRUCTURE_CONTAINER || s.structureType === STRUCTURE_STORAGE || s.structureType === STRUCTURE_SPAWN || s.structureType === STRUCTURE_EXTENSION) &&
                ((s.store && s.store.getFreeCapacity && s.store.getFreeCapacity(RESOURCE_ENERGY) > 0) || (s.energy !== undefined && s.energy < s.energyCapacity))
        });

        if (target) {
            if (target.store && target.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                if (creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' } });
                return;
            }
            if (target.energy !== undefined && target.energy < target.energyCapacity) {
                if (creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) creep.moveTo(target);
                return;
            }
        }

        // 沒有可交付目標就丟在地上，等待 hauler 或 upgrader 撿取
        creep.drop(RESOURCE_ENERGY);
    }
};
