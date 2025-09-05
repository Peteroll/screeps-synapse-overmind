const log = require('util.log');

module.exports = {
    run(creep) {
        // 若沒有任何 WORK 部件，標記為 upgrader（避免無法採集的死板礦工）
        if (creep.getActiveBodyparts(WORK) === 0) {
            creep.memory.role = 'upgrader';
            return;
        }
        if (!creep.memory.sourceId) assignSource(creep);
        const source = Game.getObjectById(creep.memory.sourceId);
        if (!source) { creep.say('nosrc'); return; }
        if (creep.pos.getRangeTo(source) > 1) {
            creep.moveTo(source, { visualizePathStyle: { stroke: '#ffaa00' } });
        } else {
            const res = creep.harvest(source);
            if (res !== OK) creep.say(res.toString());
            // 若腳下沒有 container 且有 WORK>2 可以自動建造 container
            if (!creep.memory.containerChecked) {
                const containers = source.pos.findInRange(FIND_STRUCTURES, 1, { filter: s => s.structureType === STRUCTURE_CONTAINER });
                const sites = source.pos.findInRange(FIND_CONSTRUCTION_SITES, 1, { filter: s => s.structureType === STRUCTURE_CONTAINER });
                if (containers.length === 0 && sites.length === 0) {
                    const pos = creep.pos; // 直接在當前位置放 (簡化)
                    creep.room.createConstructionSite(pos, STRUCTURE_CONTAINER);
                }
                creep.memory.containerChecked = true;
            }
        }
    }
};

function assignSource(creep) {
    const sources = creep.room.find(FIND_SOURCES);
    // 統計已被綁定數
    const usage = {};
    for (const s of sources) usage[s.id] = 0;
    for (const name in Game.creeps) {
        const c = Game.creeps[name];
        if (c.memory.role === 'miner' && c.memory.sourceId) usage[c.memory.sourceId] = (usage[c.memory.sourceId] || 0) + 1;
    }
    let pick = sources[0];
    for (const s of sources) if (usage[s.id] < usage[pick.id]) pick = s;
    creep.memory.sourceId = pick.id;
}
