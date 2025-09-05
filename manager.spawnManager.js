const config = require('util.config');
const log = require('util.log');
const taskManager = require('manager.taskManager');
const economyManager = require('manager.economyManager');

function run() {
    for (const spawnName in Game.spawns) {
        const spawn = Game.spawns[spawnName];
        if (spawn.spawning) continue;
        const room = spawn.room;
    const rcl = (room.controller && room.controller.level) || 1;

        // 統計現有角色
        const counts = countRoles();
        const totalCreeps = Object.keys(Game.creeps).length;

        // 檢查是否已存在任何含 WORK 的 creep
        const hasWorkCreep = Object.values(Game.creeps).some(c => c.body.some(p=>p.type===WORK));

        // 若完全沒有任何 WORK creep，先累積能量直到能產出 [WORK,MOVE] (150) 避免生出無法移動的 WORK 或無 WORK 單位耗能卡死
        if (!hasWorkCreep) {
            if (room.energyAvailable >= 150) {
                const body = [WORK, MOVE];
                if (trySpawn(spawn, 'miner', body)) continue; // 成功後下個 tick 重新評估
            } else {
                if (Game.time % 25 === 0 && config.DEBUG) log.debug(`[Bootstrap] 等待能量>=150 生出首個 WORK creep (現有 ${room.energyAvailable})`);
            }
            continue; // 先確保第一個 WORK 單位
        }

        // === 災後復原 / Bootstrap 模式 ===
        // 觸發條件：完全沒有 creep，或記憶仍標記 active
        if (totalCreeps === 0) {
            if (!Memory.bootstrap) Memory.bootstrap = {}; 
            Memory.bootstrap.active = true; 
            Memory.bootstrap.since = Game.time;
        }
        if (Memory.bootstrap && Memory.bootstrap.active) {
            // 嘗試產生 pioneer (具 harvest + carry + build 能力) 直到有 miner+hauler 或總數>=4
            const pioneerNeed = (counts.pioneer || 0) < 2 && (counts.miner||0) === 0 && (counts.hauler||0) === 0;
            if (pioneerNeed) {
                const body = buildPioneerBody(room.energyAvailable);
                if (trySpawn(spawn, 'pioneer', body)) continue; // 成功後等下一 tick
            }
            // 離開條件：已有至少 1 miner + 1 hauler 或總數 >= 4
            if ((counts.miner||0) > 0 && (counts.hauler||0) > 0 || totalCreeps >= 4) {
                Memory.bootstrap.active = false;
                Memory.bootstrap.recovered = Game.time;
            } else {
                // 在 bootstrap 未退出前，不進行後續正常流程 (避免浪費 CPU/錯誤配額)
                // 但仍會執行緊急 miner/hauler 判斷 (下方)
            }
        }

        // 無 creep 且能量 <100 → 無法組成含 WORK 的最小單位，直接等待 (避免刷 log)
        if (totalCreeps === 0 && room.energyAvailable < 100) {
            if (Game.time % 50 === 0) log.warn(`[Bootstrap] 能量不足 (${room.energyAvailable}) 無法生產任何帶 WORK 的單位，等待自然累積`);
            continue;
        }

        // 緊急：無 miner or 無 hauler → 先造緊急工人
        // (原本使用 counts.miner === 0 若 undefined 不會觸發，導致全滅後卡死)
        if (!counts.miner) {
            const eb = emergencyBody(room, 'miner');
            if (eb && trySpawn(spawn, 'miner', eb)) continue;
        }
        if (!counts.hauler) {
            // 沒 miner 先不要造 hauler 以免浪費能量
            if (counts.miner) {
                const hb = emergencyBody(room, 'hauler');
                if (hb && trySpawn(spawn, 'hauler', hb)) continue;
            }
        }

    // 動態目標
    const target = Object.assign({}, config.BASE_ROLE_TARGET);
        // 隨 RCL 調整
        if (rcl >= 3) target.builder += 1;
        if (rcl >= 4) target.upgrader += 2;
        if (rcl >= 5) target.ranger = 2;
        if (rcl >= 5) target.repairer += 1;

    // (C) 多維經濟模式倍率
    target.upgrader = Math.max(1, Math.round(target.upgrader * economyManager.modeRoleMultiplier(room,'upgrader')));
    target.builder = Math.max(1, Math.round(target.builder * economyManager.modeRoleMultiplier(room,'builder')));
    target.repairer = Math.max(1, Math.round(target.repairer * economyManager.modeRoleMultiplier(room,'repairer')));
    target.ranger = Math.max(target.ranger, Math.round((target.ranger||0) * economyManager.modeRoleMultiplier(room,'ranger')));

        // 戰爭模式增加防禦與運輸
        if (Memory.threat && Memory.threat.warMode) {
            target.ranger += 2;
            target.hauler += 1;
            target.repairer += 1;
        }

        // Controller 退化保護：若 ticksToDowngrade 剩餘過低 → 臨時提高 upgrader 需求並優先保證至少 1 名
        if (room.controller && room.controller.ticksToDowngrade !== undefined) {
            const ttd = room.controller.ticksToDowngrade;
            // RCL2+ 常態 5000 / RCL1=20000；低於 1/6 視為危險
            const danger = ttd < 4000; // 可再參數化
            if (danger) {
                if (!Memory.downgradeAlert) Memory.downgradeAlert = {};
                if (!Memory.downgradeAlert[room.name] || Game.time % 100 === 0) {
                    log.warn(`[Downgrade] ${room.name} ticksToDowngrade=${ttd} 啟動緊急升級保護`);
                    Memory.downgradeAlert[room.name] = Game.time;
                }
                // 設最少目標 2 並稍後再覆蓋 target.upgrader
            }
        }

        // Miner 數量 = sources 數量 (至多 pattern 所需)
        const sources = room.find(FIND_SOURCES);
        target.miner = Math.max(sources.length, target.miner);

        // 建設動態需求
        try {
            var cm = require('manager.constructionManager');
            var dynBuilder = cm.getBuilderTarget(room);
            if (dynBuilder && dynBuilder > target.builder) target.builder = dynBuilder;
        } catch(e) {}

        // 遠程需求 (由 remoteManager 填寫 Memory.remoteDesired)
        const remoteNeeds = Memory.remoteDesired || {};
        const aggregatedRemote = { remoteMiner: 0, remoteHauler: 0, reserver: 0 };
        for (const r in remoteNeeds) {
            aggregatedRemote.remoteMiner += remoteNeeds[r].remoteMiner || 0;
            aggregatedRemote.remoteHauler += remoteNeeds[r].remoteHauler || 0;
            aggregatedRemote.reserver += remoteNeeds[r].reserver || 0;
        }

    // 把遠程目標合併進 target
        target.remoteMiner = aggregatedRemote.remoteMiner;
        target.remoteHauler = aggregatedRemote.remoteHauler;
        target.reserver = aggregatedRemote.reserver;

        // Mineral Miner 啟用條件: RCL6+ 且有 extractor 且 mineral 尚有存量 且 Storage 容量未過高
        if (room.controller && room.controller.level >=6) {
            const mineral = room.find(FIND_MINERALS)[0];
            if (mineral) {
                const extractor = room.find(FIND_STRUCTURES, {filter:s=>s.structureType===STRUCTURE_EXTRACTOR})[0];
                const storage = room.storage;
                const storageOk = !storage || storage.store.getFreeCapacity() > 50000; // 避免爆倉
                if (extractor && mineral.mineralAmount > 0 && storageOk) {
                    target.mineralMiner = 1;
                }
            }
        }

        const order = ['miner', 'hauler', 'upgrader', 'builder', 'repairer', 'ranger', 'reserver', 'remoteMiner', 'remoteHauler', 'settler', 'pioneer', 'mineralMiner'];
        if (Memory.expansion && Memory.expansion.target) {
            const targetRoom = Memory.expansion.target;
            const owned = Game.rooms[targetRoom] && Game.rooms[targetRoom].controller && Game.rooms[targetRoom].controller.my;
            if (!owned) target.settler = 1;
        }
        // 若 controller 降階危險，確保 upgrader 數量 >=2 並把 upgrader 插到優先序最前
        let dangerDowngrade = false;
        if (room.controller && room.controller.ticksToDowngrade && room.controller.ticksToDowngrade < 4000) {
            dangerDowngrade = true;
            target.upgrader = Math.max(target.upgrader || 0, 2);
        }
        const execOrder = dangerDowngrade ? ['upgrader'].concat(order.filter(r=>r!=='upgrader')) : order;

        for (const role of execOrder) {
            if ((counts[role] || 0) >= (target[role] || 0)) continue;
            // 限制 settler / reserver 的最小能量門檻 (CLAIM 必須 >=600 + MOVE)
            if ((role === 'settler' || role === 'reserver') && room.energyAvailable < 650) continue;
            const body = buildDynamicBody(role, room.energyAvailable);
            if (!body || !body.length) continue;
            if (trySpawn(spawn, role, body)) break;
        }

        if (Game.time % config.LOG_TICK_INTERVAL === 0) {
            room.visual.text(order.map(r => r[0].toUpperCase() + ':' + (counts[r] || 0)).join(' '), spawn.pos.x + 1, spawn.pos.y, { align: 'left', font: 0.55, opacity: 0.8 });
        }
    }
}

function countRoles() {
    const out = {};
    for (const n in Game.creeps) {
        const r = Game.creeps[n].memory.role;
        out[r] = (out[r] || 0) + 1;
    }
    return out;
}

function partCost(part) {
    switch (part) {
        case WORK: return 100; case MOVE: return 50; case CARRY: return 50; case ATTACK: return 80; case RANGED_ATTACK: return 150; case HEAL: return 250; case CLAIM: return 600; case TOUGH: return 10; default: return 0;
    }
}

function buildDynamicBody(role, energyCap) {
    const cost = p => partCost(p);
    // 高價角色直接檢查 (CLAIM) — 無足夠能量返回 null 讓外層跳過
    if ((role === 'reserver' || role === 'settler') && energyCap < 650) return null;

    function repeatPattern(pattern, maxRepeat) {
        let body = [];
        for (let i=0;i<maxRepeat;i++) {
            const next = body.concat(pattern);
            const price = next.reduce((s,p)=>s+cost(p),0);
            if (price > energyCap || next.length>50) break;
            body = next;
        }
        return body;
    }

    switch (role) {
        case 'miner': {
            let body = repeatPattern([WORK, WORK, MOVE], 3);
            if (!body.length) {
                if (energyCap >= 150) return [WORK, MOVE];
                if (energyCap >= 100) return [WORK];
                return null; // 無法建置
            }
            return body;
        }
        case 'remoteMiner':
        case 'mineralMiner': {
            let body = repeatPattern([WORK, WORK, MOVE], 5);
            if (!body.length) {
                if (energyCap >= 150) return [WORK, MOVE];
                if (energyCap >= 100) return [WORK];
                return null;
            }
            return body;
        }
        case 'hauler':
        case 'remoteHauler': {
            let body = repeatPattern([CARRY, CARRY, MOVE], 10);
            if (!body.length) {
                if (energyCap >= 100) return [CARRY, MOVE];
                if (energyCap >= 50) return [MOVE];
                return null;
            }
            return body;
        }
        case 'upgrader':
        case 'builder':
        case 'repairer':
        case 'pioneer': {
            let body = repeatPattern([WORK, CARRY, MOVE], 10);
            if (!body.length) {
                if (energyCap >= 200) return [WORK, CARRY, MOVE];
                if (energyCap >= 150) return [WORK, MOVE];
                if (energyCap >= 100) return [WORK];
                return null;
            }
            return body;
        }
        case 'ranger': {
            // 首選 RA 輕量 kite，否則退而 ATTACK
            if (energyCap >= 250) {
                let body = repeatPattern([RANGED_ATTACK, MOVE, MOVE], 5);
                return body.length ? body : [RANGED_ATTACK, MOVE];
            }
            if (energyCap >= 130) return [ATTACK, MOVE];
            if (energyCap >= 50) return [MOVE];
            return null;
        }
        case 'reserver':
            return [CLAIM, MOVE]; // energyCap >=650 已前置檢查
        case 'settler':
            // 基本拓殖組合：CLAIM + WORK + CARRY + MOVE + MOVE (若不足降級)
            if (energyCap >= 850) return [CLAIM, WORK, CARRY, MOVE, MOVE];
            if (energyCap >= 700) return [CLAIM, WORK, MOVE, MOVE];
            return [CLAIM, MOVE];
        default:
            if (energyCap >= 200) return [WORK, CARRY, MOVE];
            if (energyCap >= 150) return [WORK, MOVE];
            if (energyCap >= 100) return [WORK];
            return null;
    }
}

function buildPioneerBody(energyCap){
    // 以 [WORK,CARRY,MOVE] pattern 疊加
    const pattern = [WORK, CARRY, MOVE];
    const cost = p => partCost(p);
    let body = [];
    for (let i=0;i<10;i++) { // 最多 10 次 => 30 parts
        const next = body.concat(pattern);
        const price = next.reduce((s,p)=>s+cost(p),0);
        if (price > energyCap || next.length>50) break;
        body = next;
    }
    if (body.length === 0) {
        if (energyCap >= 200) return [WORK, CARRY, MOVE];
        if (energyCap >= 150) return [WORK, MOVE];
        return [WORK];
    }
    return body;
}

// 緊急身體：盡可能用現有 energy 組裝最小 pattern
function emergencyBody(room, role){
    const avail = room.energyAvailable;
    if (role === 'miner') {
    if (avail >= 250) return [WORK, WORK, MOVE];
    if (avail >= 150) return [WORK, MOVE];
    return null; // 不產生只有 WORK 無法移動的單位，等待能量
    }
    if (role === 'hauler') {
        if (avail >= 150) return [CARRY, CARRY, MOVE];
        if (avail >= 100) return [CARRY, MOVE];
        return [MOVE];
    }
    return [WORK, CARRY, MOVE];
}

function shrinkBody(body){
    if (body.length <= 3) return body; // 已是最小
    // 嘗試按 3 個一組 (pattern) 移除，否則移除最後一個
    const size = Math.max(3, Math.floor(body.length/2));
    return body.slice(0, size);
}

function trySpawn(spawn, role, body) {
    const name = role + '_' + Game.time;
    const res = spawn.spawnCreep(body, name, { memory: { role, working: false } });
    if (res === OK) {
        log.info(`[Spawn] ${spawn.name} -> ${name} (${body.length} parts)`);
        return true;
    }
    if (res === ERR_NOT_ENOUGH_ENERGY && Game.time % 10 === 0) {
        if (config.DEBUG) log.debug(`[SpawnFail] energy不足 role=${role} cost=${body.reduce((s,p)=>s+partCost(p),0)} avail=${spawn.room.energyAvailable}`);
    } else if (res !== ERR_BUSY && res !== ERR_NOT_ENOUGH_ENERGY && Game.time % 10 === 0) {
        log.warn(`[SpawnFail] role=${role} code=${res}`);
    }
    return false;
}

module.exports = { run };
