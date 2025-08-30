module.exports = {
    run(creep) {
        // 初始化
        if (creep.memory.working === undefined) creep.memory.working = false;

        // 狀態切換：收集 -> 交付
        if (!creep.memory.working && creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
            creep.memory.working = true;
        }
        if (creep.memory.working && creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
            creep.memory.working = false;
            creep.memory.targetId = undefined;
        }

        if (!creep.memory.working) {
            // 收集階段：優先地面 -> container/storage -> harvest
            const drop = creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES, { filter: r => r.resourceType === RESOURCE_ENERGY && r.amount > 20 });
            if (drop) { if (creep.pickup(drop) === ERR_NOT_IN_RANGE) creep.moveTo(drop); return; }

            const cont = creep.pos.findClosestByPath(FIND_STRUCTURES, { filter: s => (s.structureType === STRUCTURE_CONTAINER || s.structureType === STRUCTURE_STORAGE) && s.store && s.store[RESOURCE_ENERGY] > 50 });
            if (cont) { if (creep.withdraw(cont, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) creep.moveTo(cont); return; }

            const src = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
            if (src) { if (creep.harvest(src) === ERR_NOT_IN_RANGE) creep.moveTo(src); return; }

            // 沒有可收集時待命
            return;
        }

        // 交付階段：保持 memory.targetId，直到交付完或目標不可用
        let target = creep.memory.targetId ? Game.getObjectById(creep.memory.targetId) : null;

        if (target) {
            // 目標若已滿或不可用就清除
            const full = (target.store && target.store.getFreeCapacity(RESOURCE_ENERGY) === 0) || (target.energy !== undefined && target.energy >= target.energyCapacity);
            if (full) { creep.memory.targetId = undefined; target = null; }
        }

        if (!target) {
            // 找到新的目標：spawn/extension/tower（優先），否則 storage
            target = creep.pos.findClosestByPath(FIND_STRUCTURES, { filter: s => ([STRUCTURE_SPAWN, STRUCTURE_EXTENSION, STRUCTURE_TOWER].includes(s.structureType) && ((s.store && s.store.getFreeCapacity && s.store.getFreeCapacity(RESOURCE_ENERGY) > 0) || (s.energy !== undefined && s.energy < s.energyCapacity))) });
            if (!target) target = creep.pos.findClosestByPath(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_STORAGE && s.store && s.store.getFreeCapacity(RESOURCE_ENERGY) > 0 });
            if (target) creep.memory.targetId = target.id;
        }

        if (target) {
            if (creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) creep.moveTo(target, { visualizePathStyle: { stroke: '#00ff00' } });
            return;
        }

        // 沒有目標就丟在 controller 附近
        const ctrl = creep.room && creep.room.controller;
        if (ctrl && creep.pos.getRangeTo(ctrl) > 3) creep.moveTo(ctrl);
        else creep.drop(RESOURCE_ENERGY);
    }
};

