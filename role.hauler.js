const jobManager = require('manager.jobManager');

module.exports = {
    run(creep) {
        if (creep.memory.working && creep.store[RESOURCE_ENERGY] === 0) creep.memory.working = false;
        if (!creep.memory.working && creep.store.getFreeCapacity() === 0) creep.memory.working = true;

        // 清除失效 job
        if (creep.memory.jobId && !jobManager.getJob(creep.memory.jobId)) delete creep.memory.jobId;

        if (!creep.memory.working) {
            // 先撿掉落
            const drop = creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES, { filter: r => r.resourceType === RESOURCE_ENERGY && r.amount > 30 });
            if (drop) { if (creep.pickup(drop) === ERR_NOT_IN_RANGE) creep.moveTo(drop); return; }
            // 再從 container 取
            const cont = creep.pos.findClosestByPath(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_CONTAINER && s.store[RESOURCE_ENERGY] > 60 });
            if (cont) { if (creep.withdraw(cont, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) creep.moveTo(cont); return; }
            // 最後 source (備援)
            const src = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
            if (src && creep.harvest(src) === ERR_NOT_IN_RANGE) creep.moveTo(src);
        } else {
            // 若存在專用 refillTerminal job
            if (!creep.memory.jobId) jobManager.claimJob(creep, j => j.type === 'refillTerminal');
            const job = creep.memory.jobId && jobManager.getJob(creep.memory.jobId);
            if (job && job.type === 'refillTerminal') {
                const tgt = Game.getObjectById(job.targetId);
                if (!tgt) { jobManager.completeJob(job.id); delete creep.memory.jobId; }
                else {
                    if (creep.transfer(tgt, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) creep.moveTo(tgt);
                    if (tgt.store.getFreeCapacity(RESOURCE_ENERGY) === 0) { jobManager.completeJob(job.id); delete creep.memory.jobId; }
                    return;
                }
            }
            // 一般補給：spawn/extension/tower/storage
            const target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: s => [STRUCTURE_SPAWN, STRUCTURE_EXTENSION, STRUCTURE_TOWER].includes(s.structureType) && s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
            }) || creep.room.storage || creep.pos.findClosestByPath(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_CONTAINER && s.store.getFreeCapacity(RESOURCE_ENERGY) > 0 });
            if (target && creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) creep.moveTo(target);
        }
    }
};
