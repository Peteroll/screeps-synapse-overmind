const config = require('util.config');
const log = require('util.log');

function run() {
    for (const roomName in Game.rooms) {
        const room = Game.rooms[roomName];
        const towers = room.find(FIND_MY_STRUCTURES, { filter: s => s.structureType === STRUCTURE_TOWER });
        let hostilePresent = false;
        for (const tower of towers) {
            const hostile = tower.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
            if (hostile) { hostilePresent = true; tower.attack(hostile); continue; }
            // 治療友軍
            const hurt = tower.pos.findClosestByRange(FIND_MY_CREEPS, { filter: c => c.hits < c.hitsMax });
            if (hurt) { tower.heal(hurt); continue; }
            // 修理 (逐步提升 wall 目標)
            let wallTarget = Memory.defense.wallTarget || 5000;
            if (Game.time % 2000 === 0) { // 定期提升
                wallTarget += config.WALL_PROGRESS_STEP;
                Memory.defense.wallTarget = wallTarget;
            }
            const structure = room.find(FIND_STRUCTURES, {
                filter: s => s.hits < s.hitsMax &&
                    ((s.structureType === STRUCTURE_WALL || s.structureType === STRUCTURE_RAMPART) ? s.hits < wallTarget : s.hits < s.hitsMax * 0.6)
            }).sort((a, b) => a.hits - b.hits)[0];
            if (structure) tower.repair(structure);
        }

        // SafeMode 觸發條件：hostile + spawn/rampart 快速掉血 + tower 能量低
        if (room.controller && room.controller.my && room.controller.safeModeAvailable && !room.controller.safeMode) {
            if (hostilePresent) {
                const spawns = room.find(FIND_MY_SPAWNS);
                const critical = spawns.some(s => s.hits < s.hitsMax * 0.6);
                const avgTowerEnergy = towers.length ? towers.reduce((a,t)=>a+t.store[RESOURCE_ENERGY],0)/towers.length : 0;
                if (critical && avgTowerEnergy < 300) {
                    const res = room.controller.activateSafeMode();
                    if (res === OK) log.warn('[Defense] SafeMode activated in ' + room.name);
                }
            }
        }
            const hostiles = room.find(FIND_HOSTILE_CREEPS);
            // Hostile profiling 簡化：記錄玩家名稱與其最大攻擊總量
            if (hostiles.length) {
                if (!Memory.hostileProfile) Memory.hostileProfile = {};
                for (const h of hostiles) {
                    const dmg = (h.body.filter(p=>p.type===ATTACK||p.type===RANGED_ATTACK).length)*30; // 粗略
                    const name = h.owner.username;
                    const prof = Memory.hostileProfile[name] || { maxDmg:0, last:0 };
                    if (dmg>prof.maxDmg) prof.maxDmg = dmg;
                    prof.last = Game.time;
                    Memory.hostileProfile[name] = prof;
                }
            }

            // 動態 rampart/ wall 目標 (加速前線加固) - 簡化：若有敵人則臨時把 wallTarget 乘 1.5
            if (hostiles.length) {
                if (!Memory.defense.tempBoost || Game.time - Memory.defense.tempBoost.tick > 50) {
                    Memory.defense.tempBoost = { tick: Game.time, original: Memory.defense.wallTarget };
                    Memory.defense.wallTarget = Math.floor(Memory.defense.wallTarget * 1.5);
                }
                // 拆牆預測：估算敵方 WORK (dismantle) 潛在輸出，目標牆值 = 拆除輸出 * surviveTime
                const dismantleParts = hostiles.reduce((s,c)=> s + c.getActiveBodyparts(WORK),0);
                if (dismantleParts>0) {
                    const cfg = require('util.config');
                    const perWork = 50; // 每 WORK 每 tick 拆牆 hits (Screeps 拆除建築 50/tick)
                    const desire = dismantleParts * perWork * cfg.DEFENSE.DISMANTLE_SURVIVE_TIME;
                    const increase = Math.max(cfg.DEFENSE.DISMANTLE_MIN_INCREASE, desire);
                    if (Memory.defense.wallTarget < increase) Memory.defense.wallTarget = increase;
                }
            } else if (Memory.defense.tempBoost && Game.time - Memory.defense.tempBoost.tick > 200) {
                Memory.defense.wallTarget = Memory.defense.tempBoost.original;
                delete Memory.defense.tempBoost;
            }
    }
}

module.exports = { run };
