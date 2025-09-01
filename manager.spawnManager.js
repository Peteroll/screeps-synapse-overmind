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

        // 緊急：無 miner or 無 hauler → 先造緊急工人
        if (counts.miner === 0) {
            if (trySpawn(spawn, 'miner', [WORK, WORK, MOVE])) continue;
        }
        if (counts.hauler === 0) {
            if (trySpawn(spawn, 'hauler', [CARRY, CARRY, MOVE])) continue;
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
        for (const role of order) {
            if ((counts[role] || 0) < (target[role] || 0)) {
                const body = buildDynamicBody(role, room.energyCapacityAvailable);
                if (trySpawn(spawn, role, body)) break;
            }
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
    // 基本 pattern
    let pattern;
    let maxRepeat = 25;
    switch (role) {
        case 'miner': pattern = [WORK, WORK, MOVE]; maxRepeat = 3; break; // 最多 6 WORK
        case 'hauler': pattern = [CARRY, CARRY, MOVE]; maxRepeat = 8; break;
        case 'upgrader': pattern = [WORK, CARRY, MOVE]; maxRepeat = 10; break;
        case 'builder': pattern = [WORK, CARRY, MOVE]; maxRepeat = 8; break;
        case 'repairer': pattern = [WORK, CARRY, MOVE]; maxRepeat = 6; break;
    case 'ranger': pattern = [RANGED_ATTACK, MOVE, MOVE]; maxRepeat = 5; break;
    case 'reserver': pattern = [CLAIM, MOVE]; maxRepeat = 2; break;
    case 'remoteMiner': pattern = [WORK, WORK, MOVE]; maxRepeat = 5; break;
    case 'remoteHauler': pattern = [CARRY, CARRY, MOVE]; maxRepeat = 10; break;
    case 'pioneer': pattern = [WORK, CARRY, MOVE]; maxRepeat = 8; break;
    case 'settler': pattern = [CLAIM, WORK, CARRY, MOVE, MOVE]; maxRepeat = 1; break;
    case 'mineralMiner': pattern = [WORK, WORK, MOVE]; maxRepeat = 5; break;
        default: pattern = [WORK, CARRY, MOVE];
    }
    const cost = p => partCost(p);
    let body = [];
    for (let i = 0; i < maxRepeat; i++) {
        const next = body.concat(pattern);
        const price = next.reduce((s, p) => s + cost(p), 0);
        if (price > energyCap || next.length > 50) break;
        body = next;
    }
    if (body.length === 0) body = pattern; // fallback
    return body;
}

function trySpawn(spawn, role, body) {
    const name = role + '_' + Game.time;
    const res = spawn.spawnCreep(body, name, { memory: { role, working: false } });
    if (res === OK) {
        log.info(`[Spawn] ${spawn.name} -> ${name} (${body.length} parts)`);
        return true;
    }
    return false;
}

module.exports = { run };
