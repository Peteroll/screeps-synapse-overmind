// 計算威脅等級並設定 warMode
function run() {
    if (Game.time % 5 !== 0) return;
    if (!Memory.threat) Memory.threat = {};
    if (!Memory.intel) Memory.intel = {};
    let aggregate = { heal:0, ranged:0, melee:0, dismantle:0, siege:0, total:0 };
    for (const roomName in Game.rooms) {
        const room = Game.rooms[roomName];
        const hostiles = room.find(FIND_HOSTILE_CREEPS);
        // 建立/更新 intel
        const rec = Memory.intel[roomName] || { firstSeen: Game.time };
        rec.lastSeen = Game.time;
        rec.hostileCount = hostiles.length;
        rec.hostileOwnerSample = hostiles[0] && hostiles[0].owner && hostiles[0].owner.username;
        // 粗略經濟估值：storage+terminal energy + mineral 額度
        rec.energyStored = (room.storage && room.storage.store[RESOURCE_ENERGY] || 0) + (room.terminal && room.terminal.store[RESOURCE_ENERGY] || 0);
        const mineral = room.find(FIND_MINERALS)[0];
        if (mineral) rec.mineralType = mineral.mineralType;
        Memory.intel[roomName] = rec;
        for (const e of hostiles) {
            const t = threatOf(e);
            aggregate.heal += t.heal;
            aggregate.ranged += t.ranged;
            aggregate.melee += t.melee;
            aggregate.dismantle += t.dismantle;
            aggregate.siege += t.siege;
            // 記錄敵對拆除壓力 (供後續拆牆預測)
        }
    }
    aggregate.total = aggregate.heal*30 + aggregate.ranged*25 + aggregate.melee*20 + aggregate.dismantle*15 + aggregate.siege*10;
    Memory.threat.breakdown = aggregate;
    Memory.threat.level = aggregate.total;
    if (aggregate.total > 200 || aggregate.heal > 5) Memory.threat.warMode = true;
    else if (aggregate.total === 0) Memory.threat.warMode = false;
}

function threatOf(creep) {
    return {
        heal: creep.getActiveBodyparts(HEAL),
        ranged: creep.getActiveBodyparts(RANGED_ATTACK),
        melee: creep.getActiveBodyparts(ATTACK),
        dismantle: creep.getActiveBodyparts(WORK), // WORK 可拆建築
        siege: creep.getActiveBodyparts(CLAIM) // CLAIM 對控制器威脅
    };
}

module.exports = { run };
