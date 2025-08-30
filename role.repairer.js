const jobManager = require('manager.jobManager');

module.exports = {
    run(creep) {
        if (creep.memory.working && creep.store[RESOURCE_ENERGY] === 0) creep.memory.working = false;
        if (!creep.memory.working && creep.store.getFreeCapacity() === 0) creep.memory.working = true;

        if (creep.memory.jobId && !jobManager.getJob(creep.memory.jobId)) delete creep.memory.jobId;

        if (creep.memory.working) {
            if (!creep.memory.jobId) jobManager.claimJob(creep, j => j.type === 'repair' || j.type === 'refill');
            const job = creep.memory.jobId ? jobManager.getJob(creep.memory.jobId) : null;
            if (job) {
                const target = Game.getObjectById(job.targetId);
                if (!target) {
                    jobManager.completeJob(job.id); delete creep.memory.jobId; return;
                }
                if (job.type === 'repair') {
                    const r = creep.repair(target);
                    if (r === ERR_NOT_IN_RANGE) creep.moveTo(target);
                    if (target.hits >= target.hitsMax * 0.9 || r === ERR_INVALID_TARGET) { jobManager.completeJob(job.id); delete creep.memory.jobId; }
                } else if (job.type === 'refill') {
                    if (creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) creep.moveTo(target);
                    if (target.store.getFreeCapacity(RESOURCE_ENERGY) === 0) { jobManager.completeJob(job.id); delete creep.memory.jobId; }
                }
            } else {
                // fallback 常規維護 rampart / wall 門檻
                const target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                    filter: s => s.hits < s.hitsMax * 0.5 && s.structureType !== STRUCTURE_WALL && s.structureType !== STRUCTURE_RAMPART
                }) || creep.pos.findClosestByPath(FIND_STRUCTURES, {
                    filter: s => (s.structureType === STRUCTURE_RAMPART) && s.hits < (Memory.defense.wallTarget || 5000)
                }) || creep.pos.findClosestByPath(FIND_STRUCTURES, {
                    filter: s => (s.structureType === STRUCTURE_WALL) && s.hits < (Memory.defense.wallTarget || 5000)
                });
                if (target) { if (creep.repair(target) === ERR_NOT_IN_RANGE) creep.moveTo(target); }
                else if (creep.room.controller && creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) creep.moveTo(creep.room.controller);
            }
        } else {
            const cont = creep.pos.findClosestByPath(FIND_STRUCTURES, { filter: s => [STRUCTURE_CONTAINER, STRUCTURE_STORAGE].includes(s.structureType) && s.store[RESOURCE_ENERGY] > 0 });
            if (cont) { if (creep.withdraw(cont, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) creep.moveTo(cont); return; }
            const drop = creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES, { filter: r => r.resourceType === RESOURCE_ENERGY && r.amount > 30 });
            if (drop) { if (creep.pickup(drop) === ERR_NOT_IN_RANGE) creep.moveTo(drop); return; }
            const src = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
            if (src && creep.harvest(src) === ERR_NOT_IN_RANGE) creep.moveTo(src);
        }
    }
};
