// 全域 Job 佇列：將 room.memory.tasks 轉換成細粒度工作單
// job 結構: {id,type,room,targetId,priority,data,assigned}
const log = require('util.log');

function buildGlobalQueue() {
    if (!Memory.jobs) Memory.jobs = {};
    if (!Memory.jobs.queue) Memory.jobs.queue = [];
    const queue = Memory.jobs.queue;

    // 每 50 tick 清理過期 (assigned 但 creep 不存在)
    if (Game.time % 50 === 0) {
        for (const job of queue) {
            if (job.assigned && !Game.creeps[job.assigned]) job.assigned = null;
        }
    }

    // 老化: 提升長時間未處理工作權重
    for (const job of queue) {
        if (!job.age) job.age = 0;
        job.age++;
        // ageBoost = log2(age+1)
        job.dynamicPriority = job.priority + Math.floor(Math.log2(job.age + 1));
        // 若 assigned 很久卻沒完成 (>1500 tick) 釋放
        if (job.assigned && job.age > 1500) job.assigned = null;
    }

    // 已存在 job 的 targetId 做索引避免重複 (含 data.dest)
    const existing = new Set(queue.map(j => (j.targetId||'') + '|' + j.type + '|' + (j.data && j.data.dest || '')));

    for (const roomName in Game.rooms) {
        const room = Game.rooms[roomName];
        // 建造 (依結構型別給不同優先級)
        const sites = room.find(FIND_CONSTRUCTION_SITES);
        for (const site of sites) {
            const key = site.id + '|build';
            if (!existing.has(key)) {
                var cfg = require('util.config');
                var pmap = cfg.CONSTRUCTION && cfg.CONSTRUCTION.PRIORITY;
                var st = site.structureType;
                var base = 5;
                if (pmap && pmap[st]) base = pmap[st];
                queue.push(makeJob('build', roomName, site.id, base));
            }
        }
        // 修理 (不含牆，牆由 defenseManager 漸進處理)
        const repairs = room.find(FIND_STRUCTURES, { filter: s => s.hits < s.hitsMax * 0.5 && s.structureType !== STRUCTURE_WALL });
        for (const s of repairs) {
            const key = s.id + '|repair|';
            if (!existing.has(key)) queue.push(makeJob('repair', roomName, s.id, 4));
        }
        // Tower 補能
        const towers = room.find(FIND_MY_STRUCTURES, { filter: s => s.structureType === STRUCTURE_TOWER && s.store.getFreeCapacity(RESOURCE_ENERGY) > 300 });
        for (const t of towers) {
            const key = t.id + '|refill|';
        if (!existing.has(key)) queue.push(makeJob('refill', roomName, t.id, 6));
        }
        // Terminal 補能任務 (外部 terminalManager 可能已 push 但補一層避免漏)
        if (room.terminal && room.storage) {
            const termNeed =  (room.terminal.store[RESOURCE_ENERGY] || 0) < 25000;
            if (termNeed) {
                const key = room.terminal.id + '|refillTerminal|';
                if (!existing.has(key)) queue.push(makeJob('refillTerminal', roomName, room.terminal.id, 4));
            }
        }
        // 礦物 container / 掉落資源 → haulMineral 任務
        const mineral = room.find(FIND_MINERALS)[0];
        if (mineral) {
            const cont = mineral.pos.findInRange(FIND_STRUCTURES,1,{filter:s=>s.structureType===STRUCTURE_CONTAINER && s.store.getUsedCapacity() > 200})[0];
            if (cont) {
                const key = cont.id + '|haulMineral|';
                if (!existing.has(key)) queue.push(makeJob('haulMineral', roomName, cont.id, 3));
            }
            const drops = mineral.pos.findInRange(FIND_DROPPED_RESOURCES,2,{filter:r=>r.resourceType!==RESOURCE_ENERGY && r.amount>100});
            for (const d of drops) {
                const key = d.id + '|haulMineral|';
                if (!existing.has(key)) queue.push(makeJob('haulMineral', roomName, d.id, 3));
            }
        }
    }

    // 依動態priority 排序 (高 → 低)
    queue.sort((a, b) => (b.dynamicPriority || b.priority) - (a.dynamicPriority || a.priority));

    // 限制長度防爆記憶
    if (queue.length > 300) queue.splice(300);
}

function makeJob(type, room, targetId, priority) {
    return { id: `${type}_${targetId}`, type, room, targetId, priority, dynamicPriority: priority, data: {}, assigned: null, age: 0 };
}

// creep 呼叫以取得一份 job
function claimJob(creep, filterFn) {
    if (!Memory.jobs || !Memory.jobs.queue) return null;
    const queue = Memory.jobs.queue;
    for (const job of queue) {
        if (job.assigned) continue;
        if (filterFn && !filterFn(job)) continue;
        job.assigned = creep.name;
        creep.memory.jobId = job.id;
        return job;
    }
    return null;
}

function getJob(jobId) {
    if (!Memory.jobs || !Memory.jobs.queue) return null;
    return Memory.jobs.queue.find(j => j.id === jobId);
}

function completeJob(jobId) {
    if (!Memory.jobs || !Memory.jobs.queue) return;
    const idx = Memory.jobs.queue.findIndex(j => j.id === jobId);
    if (idx >= 0) Memory.jobs.queue.splice(idx, 1);
}

// 當 creep 無法取得 job 時的備援行為，盡量讓 creep 做有用的事而非 idle
function fallbackTask(creep) {
    if (!creep || !creep.room) return false;
    const role = creep.memory.role;
    // hauler: 嘗試 withdraw 或 pickup 附近能量
    if (role === 'hauler' || role === 'remoteHauler') {
        const cont = creep.pos.findClosestByPath(FIND_STRUCTURES, { filter: s => [STRUCTURE_CONTAINER, STRUCTURE_STORAGE].includes(s.structureType) && s.store[RESOURCE_ENERGY] > 50 });
        if (cont) { if (creep.withdraw(cont, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) creep.moveTo(cont); return true; }
        const drop = creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES, { filter: d => d.resourceType === RESOURCE_ENERGY && d.amount > 50 });
        if (drop) { if (creep.pickup(drop) === ERR_NOT_IN_RANGE) creep.moveTo(drop); return true; }
        return false;
    }
    // repairer: 找受損 road / tower 做 repair
    if (role === 'repairer') {
        const target = creep.pos.findClosestByPath(FIND_STRUCTURES, { filter: s => s.hits < s.hitsMax && s.structureType !== STRUCTURE_WALL });
        if (target) { if (creep.repair(target) === ERR_NOT_IN_RANGE) creep.moveTo(target); return true; }
        return false;
    }
    // builder: 已有內建 fallback (upgrade)，此處返回 false 以讓 builder 使用其 own logic
    if (role === 'builder') return false;
    // upgrader: 若沒能量就去 harvest
    if (role === 'upgrader') {
        if (creep.store[RESOURCE_ENERGY] > 0) {
            if (creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) creep.moveTo(creep.room.controller);
            return true;
        }
        const src = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
        if (src) { if (creep.harvest(src) === ERR_NOT_IN_RANGE) creep.moveTo(src); return true; }
        return false;
    }
    return false;
}

module.exports = { buildGlobalQueue, claimJob, getJob, completeJob, fallbackTask };
