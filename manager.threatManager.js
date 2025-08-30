// 計算威脅等級並設定 warMode
function run() {
    if (Game.time % 5 !== 0) return;
    if (!Memory.threat) Memory.threat = {};
    let aggregate = { heal:0, ranged:0, melee:0, dismantle:0, siege:0, total:0 };
    for (const roomName in Game.rooms) {
        const room = Game.rooms[roomName];
        const hostiles = room.find(FIND_HOSTILE_CREEPS);
        for (const e of hostiles) {
            const t = threatOf(e);
            aggregate.heal += t.heal;
            aggregate.ranged += t.ranged;
            aggregate.melee += t.melee;
            aggregate.dismantle += t.dismantle;
            aggregate.siege += t.siege;
        }
    }
    aggregate.total = aggregate.heal*30 + aggregate.ranged*25 + aggregate.melee*20 + aggregate.dismantle*15 + aggregate.siege*10;
    Memory.threat.breakdown = aggregate;
    Memory.threat.level = aggregate.total;
    // warMode 切換利用 heal 與總威脅雙閾值
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
