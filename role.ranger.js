module.exports = {
    run(creep) {
    // 目標選擇：受傷 healer > healer > ranged > melee > others
    const hostiles = creep.room.find(FIND_HOSTILE_CREEPS);
    let hostile = null;
    const woundedHealers = hostiles.filter(h=> h.getActiveBodyparts(HEAL)>0 && h.hits < h.hitsMax);
    const healers = hostiles.filter(h=> h.getActiveBodyparts(HEAL)>0);
    const ranged = hostiles.filter(h=> h.getActiveBodyparts(RANGED_ATTACK)>0);
    const melee = hostiles.filter(h=> h.getActiveBodyparts(ATTACK)>0);
    hostile = pickClosest(creep, woundedHealers) || pickClosest(creep, healers) || pickClosest(creep, ranged) || pickClosest(creep, melee) || creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
    if (hostile) {
            const range = creep.pos.getRangeTo(hostile);
            if (range <= 3) {
                const fleeRes = PathFinder.search(creep.pos, [{pos:hostile.pos, range:4}], {
                    flee: true,
                    plainCost:2, swampCost:5
                });
                if (fleeRes.path && fleeRes.path.length) {
                    creep.move(creep.pos.getDirectionTo(fleeRes.path[0]));
                }
            }
            if (creep.rangedAttack(hostile) === ERR_NOT_IN_RANGE) creep.moveTo(hostile, { visualizePathStyle: { stroke: '#ff4d4d' } });
        } else {
            // 待命在控制器附近或 spawn 附近
            const anchor = creep.room.controller || Game.spawns[Object.keys(Game.spawns)[0]];
            if (anchor && creep.pos.getRangeTo(anchor) > 5) creep.moveTo(anchor, { visualizePathStyle: { stroke: '#99ccff' } });
        }
    }
};

function pickClosest(creep, list) {
    if (!list.length) return null;
    let best=null, bestRange=999;
    for (const h of list) {
        const r = creep.pos.getRangeTo(h);
        if (r<bestRange) { bestRange=r; best=h; }
    }
    return best;
}
