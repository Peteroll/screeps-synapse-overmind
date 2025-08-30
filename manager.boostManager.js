// 通用 Boost 管理器
// 目標：
// 1. 角色提出 boost 請求 (memory.boostRequest = { type:'range', minerals:['XKHO2'], level:1 })
// 2. boostManager 將請求轉為內部隊列 Memory.boost.queue
// 3. labManager 生產 / 供應對應 mineral (簡化：假設已有資源)
// 4. boostManager 指派可用 lab 給 creep，處理 move 與 boostCreep 執行
// 5. 預留資源：Memory.boost.reserved[mineral] = amount (避免市場或其他流程賣出)

function run() {
    if (!Memory.boost) Memory.boost = { queue: [], reserved: {} };
    autoRoleRequests();
    collectNewRequests();
    assignLabs();
    processBoosting();
    cleanup();
}

// 收集 creep 記憶中的新請求 => queue
function collectNewRequests() {
    for (const name in Game.creeps) {
        const c = Game.creeps[name];
        if (!c.memory.boostRequest || c.memory.boosted) continue;
        const req = c.memory.boostRequest;
        const id = `${c.name}:${req.minerals.join(',')}`;
        if (!Memory.boost.queue.find(q=>q.id===id)) {
            Memory.boost.queue.push({ id, creep: c.name, minerals: req.minerals, status:'pending' });
            // 預留資源數量粗估 (每 boost 一個部件 30，先抓 creep body 長度 * 30)
            const need = c.body.length * 30;
            for (const m of req.minerals) {
                Memory.boost.reserved[m] = (Memory.boost.reserved[m]||0) + need;
            }
        }
        delete c.memory.boostRequest; // 轉入隊列後清除一次性請求
    }
}

// 指派 lab：尋找含有對應 mineral 且庫存 >= 30 的 lab 作為 boost lab
function assignLabs() {
    if (!Memory.boost.queue.length) return;
    for (const roomName in Game.rooms) {
        const room = Game.rooms[roomName];
        if (!room.controller || !room.controller.my) continue;
        const labs = room.find(FIND_MY_STRUCTURES,{filter:s=>s.structureType===STRUCTURE_LAB});
        if (!labs.length) continue;
        for (const node of Memory.boost.queue) {
            if (node.status !== 'pending') continue;
            const needed = node.minerals[0]; // 簡化：只用第一種
            const lab = labs.find(l=> l.mineralType === needed && l.store[needed] >= 30);
            if (lab) {
                node.labId = lab.id;
                node.room = room.name;
                node.status = 'assigned';
            }
        }
    }
}

function processBoosting() {
    for (const node of Memory.boost.queue) {
        if (node.status !== 'assigned') continue;
        const creep = Game.creeps[node.creep];
        const lab = Game.getObjectById(node.labId);
        if (!creep || !lab) { node.status = 'failed'; continue; }
        if (creep.memory.boosted) { node.status = 'done'; continue; }
        if (!creep.pos.isNearTo(lab)) {
            creep.moveTo(lab, { visualizePathStyle:{stroke:'#00ffff'} });
            continue;
        }
        const res = lab.boostCreep(creep);
        if (res === OK) {
            creep.memory.boosted = true;
            node.status = 'done';
        } else if (res === ERR_NOT_ENOUGH_RESOURCES) {
            node.status = 'waiting';
        }
    }
}

function cleanup() {
    if (Game.time % 200 !== 0) return;
    Memory.boost.queue = Memory.boost.queue.filter(n=>!(n.status==='done'||n.status==='failed'));
}

function isReserved(mineral, amount) {
    const r = Memory.boost && Memory.boost.reserved && Memory.boost.reserved[mineral] || 0;
    return r >= amount;
}

module.exports = { run, isReserved };

function autoRoleRequests() {
    const cfg = require('util.config');
    const plan = cfg.LAB.BOOST_PLAN;
    for (const name in Game.creeps) {
        const c = Game.creeps[name];
        if (c.memory.boosted || c.memory.boostRequest) continue;
        const plist = plan[c.memory.role];
        if (plist && plist.length) {
            c.memory.boostRequest = { minerals: plist };
        }
    }
}
