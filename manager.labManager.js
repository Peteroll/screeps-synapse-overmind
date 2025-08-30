// Lab 反應與 Boost 管理 (基礎版本)
// 功能: 
// 1. 維護核心 PRIMARY_REACTION 連鎖 (僅處理二階/三階簡化: XKHO2)
// 2. Input Labs 補給、Output Lab 產物回收 → 建立 haulMineral job (重用 hauler 流程)
// 3. 預留 boost 給 ranger (示意) 並依需求對特定角色提出 boost 任務
// 
// 反應鏈 (示例 XKHO2): X + KHO2 -> XKHO2，需要 KHO2: KO2 + H => K + OH => 等完整鏈極長，此處簡化為直接假設已有 X 與 KHO2 庫存
// 實務可擴展 reactionGraph。

const config = require('util.config');
const jobManager = require('manager.jobManager');

// 簡化: 尋找 labs: 兩座當作 reagents (前兩個) 其餘為 output
function classifyLabs(room) {
    const labs = room.find(FIND_MY_STRUCTURES,{filter:s=>s.structureType===STRUCTURE_LAB});
    if (labs.length < 3) return null; // 需求最少3 (2 input +1 output)
    // 排序：距離 storage 由近到遠
    const storePos = room.storage ? room.storage.pos : labs[0].pos;
    labs.sort((a,b)=>storePos.getRangeTo(a)-storePos.getRangeTo(b));
    const reagentA = labs[0];
    const reagentB = labs[1];
    const outputs = labs.slice(2);
    return { reagentA, reagentB, outputs };
}

function run() {
    if (!config.LAB.ENABLE) return;
    for (const roomName in Game.rooms) {
        const room = Game.rooms[roomName];
        if (!room.controller || !room.controller.my) continue;
        if (room.controller.level < 6) continue;
        const cls = classifyLabs(room);
        if (!cls) continue;
        const { reagentA, reagentB, outputs } = cls;

        // 決定反應主題
        const product = config.LAB.PRIMARY_REACTION; // XKHO2

        // Lab 反應: 所有 output labs 嘗試 runReaction(reagentA,reagentB)
        for (const out of outputs) {
            if (reagentA.mineralType && reagentB.mineralType) {
                out.runReaction(reagentA, reagentB);
            }
        }

        // 補給 reagent labs (目標保持 >= REAGENT_BATCH)
        if (room.storage) {
            ensureReagent(room, reagentA, product);
            ensureReagent(room, reagentB, product);
        }

        // Output 收集 (若 output lab 某 mineral 達到閾值 建立 haulMineral job 模式：透過 container 模式 -> 這裡直接新增特別 job 類型 'labPickup')
    handleOutput(room, outputs);
    handleBoostRequests(room, outputs);
    }
}

function ensureReagent(room, lab, product) {
    // 簡化：若 lab 沒資源，嘗試從 storage 補入鏈上可能需求的任意原料 (假設 product = XKHO2 -> 需要 X 與 KHO2，這裡輪替補 X / KHO2)
    // 若已有 mineralType 但 < REAGENT_MIN → 仍建立補給 (同 mineralType)
    const targetMin = config.LAB.REAGENT_MIN;
    const batch = config.LAB.REAGENT_BATCH;

    const mineral = lab.mineralType;
    if (mineral && lab.store[mineral] >= targetMin) return; // 足量

    // 選擇需要的 reagent 種類
    const neededList = guessNeededReagents(product); // e.g., ['X','KHO2']
    let want = mineral || neededList.find(r => (room.storage.store[r]||0) > batch);
    if (!want) return;

    // 建立一個補給工作: 使用通用 haulMineral job (target= storage id, data.dest = lab.id, data.resource=want)
    if (!Memory.jobs) Memory.jobs = { queue: [] };
    const key = 'labSupply_'+lab.id+'_'+want;
    const exists = Memory.jobs.queue.some(j=>j.id===key);
    if (!exists) {
        Memory.jobs.queue.push({ id:key, type:'labSupply', room:room.name, targetId:room.storage.id, priority:6, dynamicPriority:6, data:{ dest:lab.id, resource:want, amount:batch }, age:0 });
    }
}

function guessNeededReagents(product) {
    // 極簡對映，可擴充
    if (product === 'XKHO2') return ['X','KHO2'];
    return [];
}

function handleOutput(room, outputs) {
    const threshold = config.LAB.OUTPUT_PICKUP;
    for (const lab of outputs) {
        if (!lab.mineralType) continue;
        if (lab.store[lab.mineralType] >= threshold) {
            if (!Memory.jobs) Memory.jobs = { queue: [] };
            const key = 'labPickup_'+lab.id;
            const exists = Memory.jobs.queue.some(j=>j.id===key);
            if (!exists) Memory.jobs.queue.push({ id:key, type:'labPickup', room:room.name, targetId:lab.id, priority:5, dynamicPriority:5, data:{ resource:lab.mineralType }, age:0 });
        }
    }
}

// 角色 boost 請求 (簡化)：ranger 若未 boost 且房間有對應 mineral (XKHO2) 則標記並指派第一個輸出 lab 做 boost
function handleBoostRequests(room, outputs) {
    if (!outputs.length) return;
    const mineral = config.LAB.PRIMARY_REACTION; // 假設產物即想要 boost 資源
    const outputLab = outputs.find(l=> l.mineralType === mineral && l.store[mineral] >= 30); // 足夠一次 boost
    if (!outputLab) return;
    for (const name in Game.creeps) {
        const c = Game.creeps[name];
        if (c.memory.role !== 'ranger') continue;
        if (c.room.name !== room.name) continue;
        if (c.memory.boosted) continue;
        // 發出 boost 任務: creep 前往 lab.runBoost()
        c.memory.boostTarget = outputLab.id;
    }
    // 讓有 boostTarget 的 creep 嘗試執行 (由 movement 呼叫不便，這裡直接介入)
    for (const name in Game.creeps) {
        const c = Game.creeps[name];
        if (!c.memory.boostTarget) continue;
        const lab = Game.getObjectById(c.memory.boostTarget);
        if (!lab || !lab.mineralType) { delete c.memory.boostTarget; continue; }
        if (c.pos.isNearTo(lab)) {
            const res = lab.boostCreep(c);
            if (res === OK) { c.memory.boosted = true; delete c.memory.boostTarget; }
        } else {
            c.moveTo(lab, { visualizePathStyle:{stroke:'#ffaa00'} });
        }
    }
}

module.exports = { run };
