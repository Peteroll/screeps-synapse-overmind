module.exports = {
    name: 'mineralMiner',
    run(creep) {
        if (!creep.memory.roomName) creep.memory.roomName = creep.room.name;
        const room = Game.rooms[creep.memory.roomName];
        if (!room) return;
        const mineral = room.find(FIND_MINERALS)[0];
        if (!mineral) { creep.say('no min'); return; }
        // 等待礦物再生
        if (mineral.mineralAmount === 0) { creep.say('regen'); return; }
        const extractor = room.find(FIND_STRUCTURES, {filter:s=>s.structureType===STRUCTURE_EXTRACTOR})[0];
        if (!extractor) { creep.say('no ext'); return; }
        // 嘗試使用 container (若在礦物旁)
        let container = mineral.pos.findInRange(FIND_STRUCTURES,1,{filter:s=>s.structureType===STRUCTURE_CONTAINER})[0];
        if (!container) {
            // 若沒有 container 則放置一個建造工地 (一次即可)
            const hasSite = mineral.pos.findInRange(FIND_CONSTRUCTION_SITES,1,{filter:s=>s.structureType===STRUCTURE_CONTAINER})[0];
            if (!hasSite) mineral.pos.createConstructionSite(STRUCTURE_CONTAINER);
        }
        if (creep.store.getFreeCapacity() === 0) {
            // 把礦物丟在地上讓 hauler 撿 (或移動到 container 丟)
            if (container && !creep.pos.isEqualTo(container.pos)) {
                creep.moveTo(container, {reusePath:10, visualisePathStyle:{stroke:'#ffaa00'}});
                return;
            }
            // 嘗試轉移到 container
            if (container) {
                for (const r in creep.store) {
                    creep.transfer(container, r);
                }
            } else {
                creep.drop(mineral.mineralType);
            }
            return;
        }
        const res = creep.harvest(mineral);
        if (res === ERR_NOT_IN_RANGE) {
            creep.moveTo(mineral, {reusePath:15, visualisePathStyle:{stroke:'#ffffff'}});
        } else if (res === OK) {
            if (!Memory.metrics) Memory.metrics = {};
            if (!Memory.metrics.minerals) Memory.metrics.minerals = {};
            const type = mineral.mineralType;
            if (!Memory.metrics.minerals[type]) Memory.metrics.minerals[type] = { tickHarvest: 0, lastTick: Game.time };
            const m = Memory.metrics.minerals[type];
            m.tickHarvest += creep.getActiveBodyparts(WORK); // 粗略記帳：每 WORK 視為 1 單位 (實際與冷卻/提煉一致即可總覽)
            m.lastTick = Game.time;
        }
    }
};
