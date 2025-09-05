const jobManager = require('manager.jobManager');

module.exports = {
    run(creep) {
        // 狀態切換
        if (creep.memory.working && creep.store[RESOURCE_ENERGY] === 0) creep.memory.working = false;
        if (!creep.memory.working && creep.store.getFreeCapacity() === 0) creep.memory.working = true;

        // 清理失效 jobId
        if (creep.memory.jobId && !jobManager.getJob(creep.memory.jobId)) delete creep.memory.jobId;

        // 若 controller 即將降階 (danger) 或房間缺少 upgrader，builder 在沒有工作時會做為臨時 upgrader
        const cfg = require('util.config');
        const room = creep.room;
        const ttd = room.controller && room.controller.ticksToDowngrade !== undefined ? room.controller.ticksToDowngrade : Infinity;
        const upgraderCount = room.find(FIND_MY_CREEPS, { filter: c => c.memory.role === 'upgrader' }).length;
        const minUp = (cfg.DOWNGRADE && cfg.DOWNGRADE.MIN_UPGRADERS) || 2;
        const danger = ttd < (cfg.DOWNGRADE && cfg.DOWNGRADE.DANGER_TICKS || 4000) || upgraderCount < minUp;

        if (creep.memory.working) {
            // 優先領取 build/repair 類 job
            if (!creep.memory.jobId) {
                jobManager.claimJob(creep, j => j.type === 'build' || j.type === 'repair');
            }
            const job = creep.memory.jobId ? jobManager.getJob(creep.memory.jobId) : null;
            if (job) {
                const target = Game.getObjectById(job.targetId);
                if (!target) {
                    jobManager.completeJob(job.id);
                    delete creep.memory.jobId;
                } else if (job.type === 'build' && target instanceof ConstructionSite) {
                    const r = creep.build(target);
                    if (r === ERR_NOT_IN_RANGE) creep.moveTo(target);
                    if (target.progress >= target.progressTotal) { jobManager.completeJob(job.id); delete creep.memory.jobId; }
                } else if (job.type === 'repair' && target.hits !== undefined) {
                    const r = creep.repair(target);
                    if (r === ERR_NOT_IN_RANGE) creep.moveTo(target);
                    if (target.hits >= target.hitsMax * 0.9) { jobManager.completeJob(job.id); delete creep.memory.jobId; }
                } else {
                    jobManager.completeJob(job.id);
                    delete creep.memory.jobId;
                }
            } else {
                // 無建造/修理工作 -> 當作 upgrader（或臨時 upgrader）去 controller 升級
                if (creep.room.controller && creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) creep.moveTo(creep.room.controller);
            }
        } else {
            // 取能策略
            const cont = creep.pos.findClosestByPath(FIND_STRUCTURES, { filter: s => [STRUCTURE_CONTAINER, STRUCTURE_STORAGE].includes(s.structureType) && s.store[RESOURCE_ENERGY] > 0 });
            if (cont) { if (creep.withdraw(cont, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) creep.moveTo(cont); return; }
            const drop = creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES, { filter: r => r.resourceType === RESOURCE_ENERGY && r.amount > 50 });
            if (drop) { if (creep.pickup(drop) === ERR_NOT_IN_RANGE) creep.moveTo(drop); return; }
            const src = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
            if (src && creep.harvest(src) === ERR_NOT_IN_RANGE) creep.moveTo(src);

            // 若在危險期且攜帶少量能量，立即前往 controller 升級
            if (danger && creep.store[RESOURCE_ENERGY] > 0) {
                if (creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) creep.moveTo(creep.room.controller);
                return;
            }
        }
    }
};
