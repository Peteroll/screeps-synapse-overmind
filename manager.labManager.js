// Lab 反應管理 (進階排程版)
// 功能:
// 1. 依 BOOST_PLAN 自動決定近期需要的高階 boost 產物列表 (優先序)。
// 2. 針對計劃產物遞迴展開 REACTION_GRAPH 取得基底 reagents 需求，生成 Reaction Queue。
// 3. 每房根據可用 labs (>=3) 指派兩座 input labs 與多座 output labs 連續生產。
// 4. 輸入 lab 資源不足時建立 labSupply job，output 達閾值建立 labPickup job。
// 5. 計算未來 boost 需求精準預留：依角色 body 未 boost 的對應部件數量 * 30。
// 6. 若庫存欠缺中間產物，排程先行合成 (拓撲順序)。
// 7. 具體策略簡化：一次僅鎖定當前 highestPriority 產物；若其前置缺貨 → 轉產前置。

const config = require('util.config');
const jobManager = require('manager.jobManager');

function ensureMemory(room) {
    if (!room.memory.labs) room.memory.labs = { current: undefined, stage: 'select', lastSwitch: 0 };
    return room.memory.labs;
}

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
        const mem = ensureMemory(room);
        const { reagentA, reagentB, outputs } = cls;

        // 選擇目標產物
        selectTarget(room, mem);

        if (!mem.current) continue;
        const targetProduct = mem.current;

        // 決定當前需要合成的 immediate product (可能是 targetProduct 或其前置)
        const product = chooseImmediateProduct(room, targetProduct);

        // 若 input labs 還沒被裝載對應 reagent -> 發補給工作
        if (room.storage) {
            supplyReagents(room, reagentA, reagentB, product);
        }

        // 執行反應
        for (const out of outputs) {
            if (reagentA.mineralType && reagentB.mineralType) out.runReaction(reagentA, reagentB);
        }

        handleOutput(room, outputs);
    }
}

function selectTarget(room, mem) {
    if (mem.current && Game.time - mem.lastSwitch < 500) return; // 500 tick 才檢查切換一次
    const plan = config.LAB.BOOST_PLAN;
    const priorities = Object.values(plan).flat();
    // 去重保留順序
    const unique = [...new Set(priorities)];
    for (const prod of unique) {
        // 若庫存低於預留需求則選它
        const need = projectedNeed(prod);
        const have = totalStore(room, prod);
        if (have < need) {
            mem.current = prod; mem.lastSwitch = Game.time; return;
        }
    }
    // 全部充足 → 不設定
    mem.current = undefined;
}

function projectedNeed(product) {
    // 依 boost 產物對應部件計算需求 (只計算尚未 boost 的目標部件)
    const partMap = {
        XKHO2: RANGED_ATTACK,
        XLHO2: WORK,
        XGHO2: MOVE
    };
    const partType = partMap[product];
    if (!partType) return 0;
    const costPer = config.LAB.BOOST_PART_COST || 30;
    let need = 0;
    for (const name in Game.creeps) {
        const c = Game.creeps[name];
        if (c.memory.boosted) continue;
        const plan = config.LAB.BOOST_PLAN[c.memory.role];
        if (!plan || plan.indexOf(product) === -1) continue;
        const partsNotBoosted = c.body.filter(p => (p.type||p) === partType && !p.boost).length;
        need += partsNotBoosted * costPer;
    }
    return need;
}

function totalStore(room, mineral) {
    let sum = 0;
    if (room.storage) sum += room.storage.store[mineral] || 0;
    if (room.terminal) sum += room.terminal.store[mineral] || 0;
    const labs = room.find(FIND_MY_STRUCTURES,{filter:s=>s.structureType===STRUCTURE_LAB});
    for (const l of labs) if (l.mineralType === mineral) sum += l.store[mineral] || 0;
    return sum;
}

function chooseImmediateProduct(room, target) {
    // 若 target 前置缺 → 先製前置，廣度往下直到找到第一個缺少的中間產物
    const graph = config.LAB.REACTION_GRAPH || {};
    const chain = expandChain(target, graph);
    for (let i = chain.length -1; i >=0; i--) { // 從最底層往上找第一個短缺的
        const node = chain[i];
        const have = totalStore(room, node);
        if (have < projectedNeed(target) * 0.5) return node; // 臨界值：目標需求一半以下視為缺
    }
    return target;
}

function expandChain(product, graph, acc=[]) {
    if (!graph[product]) return acc.concat([product]);
    const reagents = graph[product];
    let res = acc.concat([product]);
    for (const r of reagents) res = expandChain(r, graph, res);
    return res;
}

function supplyReagents(room, labA, labB, product) {
    const graph = config.LAB.REACTION_GRAPH || {};
    const reagents = graph[product];
    if (!reagents || reagents.length < 2) return; // 非可合成或原礦 (X placeholder)
    ensureReagentType(room, labA, reagents[0]);
    ensureReagentType(room, labB, reagents[1]);
}

function ensureReagentType(room, lab, type) {
    const targetMin = config.LAB.REAGENT_MIN;
    const batch = config.LAB.REAGENT_BATCH;
    if (lab.mineralType && lab.mineralType !== type && lab.store[lab.mineralType] > 0) {
        // 建立卸載任務
        if (!Memory.jobs) Memory.jobs = { queue: [] };
        const keyUnload = 'labUnload_'+lab.id+'_'+lab.mineralType;
        if (!Memory.jobs.queue.some(j=>j.id===keyUnload)) Memory.jobs.queue.push({ id:keyUnload, type:'labUnload', room:room.name, targetId:lab.id, priority:7, dynamicPriority:7, data:{ resource: lab.mineralType }, age:0 });
        return;
    }
    if (lab.mineralType === type && lab.store[type] >= targetMin) return;
    if (!(room.storage && (room.storage.store[type]||0) > batch)) return;
    if (!Memory.jobs) Memory.jobs = { queue: [] };
    const key = 'labSupply_'+lab.id+'_'+type;
    if (!Memory.jobs.queue.some(j=>j.id===key)) Memory.jobs.queue.push({ id:key, type:'labSupply', room:room.name, targetId:room.storage.id, priority:6, dynamicPriority:6, data:{ dest:lab.id, resource:type, amount:batch }, age:0 });
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

module.exports = { run: function(){} };
