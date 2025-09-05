const jobManager = require('manager.jobManager');

module.exports = {
    run(creep) {
    // working=true 表示在投遞 (任何資源) 階段
    if (creep.memory.working && creep.store.getUsedCapacity() === 0) creep.memory.working = false;
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
            // 新增批次類型優先權：labSupplyBatch > refillCluster
            if (!creep.memory.jobId) jobManager.claimJob(creep, j => j.type === 'labSupplyBatch');
            if (!creep.memory.jobId) jobManager.claimJob(creep, j => j.type === 'refillCluster');
            // 若有 haulMineral 工作尚未領取，優先處理
            if (!creep.memory.jobId) jobManager.claimJob(creep, j => j.type === 'haulMineral');
            // Lab 卸載 (清空異種) > 補給 > Output 回收
            if (!creep.memory.jobId) jobManager.claimJob(creep, j => j.type === 'labUnload');
            if (!creep.memory.jobId) jobManager.claimJob(creep, j => j.type === 'labSupply');
            if (!creep.memory.jobId) jobManager.claimJob(creep, j => j.type === 'labPickup');
            // 若存在專用 refillTerminal job
            if (!creep.memory.jobId) jobManager.claimJob(creep, j => j.type === 'refillTerminal');
            const job = creep.memory.jobId && jobManager.getJob(creep.memory.jobId);
            // 批次補給 (能源多目標)
            if (job && job.type === 'refillCluster') {
                // 確保攜帶能源
                if (creep.store[RESOURCE_ENERGY] === 0) {
                    const src = creep.room.storage || creep.pos.findClosestByPath(FIND_STRUCTURES,{filter:s=>s.structureType===STRUCTURE_CONTAINER && s.store[RESOURCE_ENERGY]>100});
                    if (src && creep.withdraw(src, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) creep.moveTo(src);
                    return; // 取能量階段
                }
                if (!job.data._cursor) job.data._cursor = 0;
                const targets = job.data.targets || [];
                if (job.data._cursor >= targets.length) { jobManager.completeJob(job.id); delete creep.memory.jobId; return; }
                const tgt = Game.getObjectById(targets[job.data._cursor]);
                if (!tgt || !tgt.store || tgt.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
                    job.data._cursor++;
                    return;
                }
                if (creep.transfer(tgt, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) creep.moveTo(tgt);
                // 若能源耗盡或目標填滿，移動到下一個
                if (creep.store[RESOURCE_ENERGY] === 0 || tgt.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
                    job.data._cursor++;
                }
                return;
            }
            // Lab Supply 批次
            if (job && job.type === 'labSupplyBatch') {
                // 當前正在處理第 data._cursor 個 lab
                if (!job.data._cursor) job.data._cursor = 0;
                const res = job.data.resource;
                const storage = Game.getObjectById(job.targetId);
                const dests = job.data.dests || [];
                if (job.data._cursor >= dests.length) { jobManager.completeJob(job.id); delete creep.memory.jobId; return; }
                const destLab = Game.getObjectById(dests[job.data._cursor]);
                if (!destLab) { job.data._cursor++; return; }
                // 若手上沒有該資源 → 從 storage withdraw
                if ((creep.store[res]||0) === 0) {
                    if (storage && creep.withdraw(storage,res) === ERR_NOT_IN_RANGE) creep.moveTo(storage);
                    return;
                }
                if (creep.transfer(destLab,res) === ERR_NOT_IN_RANGE) creep.moveTo(destLab);
                if (creep.store[res] === 0 || (destLab.store[res]||0) >= (job.data.amount||1500)) {
                    job.data._cursor++;
                }
                return;
            }
            if (job && job.type === 'haulMineral') {
                const tgt = Game.getObjectById(job.targetId);
                if (!tgt) { jobManager.completeJob(job.id); delete creep.memory.jobId; }
                else {
                    // 可能是 container 或 dropped resource
                    if (tgt.store) {
                        // 取出所有非 energy 資源
                        let took = false;
                        for (const r in tgt.store) {
                            if (tgt.store[r] > 0 && r !== RESOURCE_ENERGY) {
                                if (creep.withdraw(tgt, r) === ERR_NOT_IN_RANGE) creep.moveTo(tgt); else took = true;
                                break;
                            }
                        }
                        if (!took && tgt.store.getUsedCapacity() === 0) { jobManager.completeJob(job.id); delete creep.memory.jobId; }
                    } else if (tgt.amount) {
                        if (creep.pickup(tgt) === ERR_NOT_IN_RANGE) creep.moveTo(tgt);
                        else if (tgt.amount === 0) { jobManager.completeJob(job.id); delete creep.memory.jobId; }
                    }
                    // 已滿 → 投遞
                    if (creep.store.getFreeCapacity() === 0) creep.memory.working = true;
                    return;
                }
            }
            if (job && job.type === 'refillTerminal') {
                const tgt = Game.getObjectById(job.targetId);
                if (!tgt) { jobManager.completeJob(job.id); delete creep.memory.jobId; }
                else {
                    if (creep.transfer(tgt, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) creep.moveTo(tgt);
                    if (tgt.store.getFreeCapacity(RESOURCE_ENERGY) === 0) { jobManager.completeJob(job.id); delete creep.memory.jobId; }
                    return;
                }
            }
            if (job && job.type === 'labSupply') {
                // targetId=storage, data.dest=lab, resource
                const storage = Game.getObjectById(job.targetId);
                const lab = Game.getObjectById(job.data.dest);
                if (!storage || !lab) { jobManager.completeJob(job.id); delete creep.memory.jobId; }
                else if (!creep.memory.filling && creep.store.getUsedCapacity() === 0) {
                    creep.memory.filling = true;
                    const res = job.data.resource;
                    if ((storage.store[res]||0) === 0) { jobManager.completeJob(job.id); delete creep.memory.jobId; }
                    else if (creep.withdraw(storage,res) === ERR_NOT_IN_RANGE) creep.moveTo(storage);
                } else {
                    const res = job.data.resource;
                    if (creep.store[res] > 0) {
                        if (creep.transfer(lab,res) === ERR_NOT_IN_RANGE) creep.moveTo(lab);
                        else if ((lab.store[res]||0) >= config && creep.store[res] === 0) { /* noop */ }
                    }
                    if (creep.store.getUsedCapacity() === 0 || (lab && lab.store.getFreeCapacity(job.data.resource) === 0)) { jobManager.completeJob(job.id); delete creep.memory.jobId; delete creep.memory.filling; }
                }
                return;
            }
            if (job && job.type === 'labPickup') {
                const lab = Game.getObjectById(job.targetId);
                if (!lab || !lab.mineralType || lab.store[lab.mineralType] === 0) { jobManager.completeJob(job.id); delete creep.memory.jobId; }
                else {
                    const res = lab.mineralType;
                    if (creep.store.getFreeCapacity() > 0 && lab.store[res] > 0) {
                        if (creep.withdraw(lab,res) === ERR_NOT_IN_RANGE) creep.moveTo(lab);
                    } else {
                        if (creep.room.storage) {
                            for (const r in creep.store) {
                                if (creep.transfer(creep.room.storage,r) === ERR_NOT_IN_RANGE) creep.moveTo(creep.room.storage);
                                break;
                            }
                        }
                        if (lab.store[res] < 200) { jobManager.completeJob(job.id); delete creep.memory.jobId; }
                    }
                }
                return;
            }
            if (job && job.type === 'labUnload') {
                const lab = Game.getObjectById(job.targetId);
                if (!lab || !lab.mineralType || lab.store[lab.mineralType] === 0) { jobManager.completeJob(job.id); delete creep.memory.jobId; }
                else {
                    const res = job.data.resource || lab.mineralType;
                    if (creep.store.getFreeCapacity() > 0 && lab.store[res] > 0) {
                        if (creep.withdraw(lab,res) === ERR_NOT_IN_RANGE) creep.moveTo(lab);
                    } else {
                        if (creep.room.storage) {
                            for (const r in creep.store) {
                                if (creep.transfer(creep.room.storage,r) === ERR_NOT_IN_RANGE) creep.moveTo(creep.room.storage);
                                break;
                            }
                        }
                        if (lab.store[res] === 0) { jobManager.completeJob(job.id); delete creep.memory.jobId; }
                    }
                }
                return;
            }
            // 一般補給：spawn/extension/tower/storage
            const target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: s => [STRUCTURE_SPAWN, STRUCTURE_EXTENSION, STRUCTURE_TOWER].includes(s.structureType) && s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
            }) || creep.room.storage || creep.pos.findClosestByPath(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_CONTAINER && s.store.getFreeCapacity(RESOURCE_ENERGY) > 0 });
            // 若有非 energy 資源，優先送 storage / terminal
            const hasNonEnergy = Object.keys(creep.store).some(r => r !== RESOURCE_ENERGY);
            if (hasNonEnergy && creep.room.storage) {
                for (const r in creep.store) {
                    if (creep.store[r] > 0 && r !== RESOURCE_ENERGY) {
                        if (creep.transfer(creep.room.storage, r) === ERR_NOT_IN_RANGE) creep.moveTo(creep.room.storage);
                        return;
                    }
                }
            }
            if (target && creep.store[RESOURCE_ENERGY] > 0) {
                if (creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) creep.moveTo(target);
            } else if (creep.room.storage && creep.store.getUsedCapacity() > 0) {
                for (const r in creep.store) {
                    if (creep.transfer(creep.room.storage, r) === ERR_NOT_IN_RANGE) { creep.moveTo(creep.room.storage); break; }
                }
            } else {
                // fallback to jobManager helper
                const jm = require('manager.jobManager');
                if (jm.fallbackTask(creep)) return;
            }
        }
    }
};
