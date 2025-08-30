// 物流合併管理器 (A: 物流合併)
// 目的：將大量細碎補給任務 (refill / labSupply) 做批次化，降低往返次數。
// 策略：
// 1. 每數 tick 掃描 Memory.jobs.queue，尋找同房間未指派 refill (塔/Spawn/Extension) → 合併為單一 refillCluster。
// 2. 尋找同房間相同 resource 的 labSupply 任務 (同 storage 為來源) → 合併為 labSupplyBatch。
// 3. 避免重複建立：若目標已在某 cluster job data.targets 中則跳過。
// 4. 批次大小：refillCluster <= 5 結構；labSupplyBatch <= 3 labs，保持 creep 單趟可完成。
// 5. 僅在 Game.time % 5 === 0 執行以降低 CPU。

function run() {
    if (Game.time % 5 !== 0) return;
    if (!Memory.jobs || !Memory.jobs.queue) return;
    const q = Memory.jobs.queue;

    // 先處理 refill 合併
    batchRefill(q);
    // 再處理 labSupply 合併
    batchLabSupply(q);
}

function batchRefill(q) {
    // 收集房間內未指派 refill job
    const byRoom = {};
    for (let i = 0; i < q.length; i++) {
        const j = q[i];
        if (j.type !== 'refill') continue;
        if (j.assigned) continue; // 已有人處理就不併
        if (!byRoom[j.room]) byRoom[j.room] = [];
        byRoom[j.room].push(j);
    }
    for (const room in byRoom) {
        const list = byRoom[room];
        if (list.length < 2) continue; // 少量不併
        // 查看是否已有現存 cluster job
        const existingClusterTargets = new Set();
        for (const j of q) if (j.type === 'refillCluster' && j.room === room) (j.data.targets||[]).forEach(t=>existingClusterTargets.add(t));
        // 從未包含的挑選 up to 5
        const picked = [];
        for (const j of list) {
            if (picked.length >= 5) break;
            if (existingClusterTargets.has(j.targetId)) continue;
            picked.push(j);
        }
        if (picked.length >= 2) {
            // 建立 cluster job
            const targets = picked.map(p=>p.targetId);
            const id = 'refillCluster_'+room+'_'+Game.time;
            q.push({ id, type:'refillCluster', room, targetId: targets[0], priority:7, dynamicPriority:7, data:{ targets }, age:0, assigned:null });
            // 移除被合併的原 job (確保未指派)
            for (const pj of picked) {
                const idx = q.indexOf(pj);
                if (idx >=0) q.splice(idx,1);
            }
        }
    }
}

function batchLabSupply(q) {
    // 分組 key: room + resource + sourceId
    const groups = {};
    for (let i=0;i<q.length;i++) {
        const j = q[i];
        if (j.type !== 'labSupply') continue;
        if (j.assigned) continue;
        const res = j.data && j.data.resource;
        const dest = j.data && j.data.dest;
        if (!res || !dest) continue;
        const key = j.room+'|'+res+'|'+j.targetId; // targetId 為 storage id
        if (!groups[key]) groups[key] = [];
        groups[key].push(j);
    }
    for (const key in groups) {
        const list = groups[key];
        if (list.length < 2) continue;
        // 檢查現有 batch 是否已覆蓋
        const [room,res,storageId] = key.split('|');
        const existing = Memory.jobs.queue.some(j=> j.type==='labSupplyBatch' && j.room===room && j.data && j.data.resource===res && j.targetId===storageId);
        if (existing) continue;
        // 取前 3 labs
        const picked = list.slice(0,3);
        const labs = picked.map(p=>p.data.dest);
        const id = 'labSupplyBatch_'+room+'_'+res+'_'+Game.time;
        q.push({ id, type:'labSupplyBatch', room, targetId: storageId, priority: picked[0].priority+1, dynamicPriority: picked[0].dynamicPriority+1, data:{ resource:res, dests: labs, amount: picked[0].data.amount || 1500 }, age:0, assigned:null });
        // 移除原 job
        for (const pj of picked) {
            const idx = q.indexOf(pj);
            if (idx>=0) q.splice(idx,1);
        }
    }
}

module.exports = { run };
