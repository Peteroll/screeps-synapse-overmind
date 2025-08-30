// Pioneer：前往擴張目標房，建造、升級、初步道路
module.exports = {
    run(creep) {
        const targetRoom = (Memory.expansion && Memory.expansion.target) || creep.memory.targetRoom;
        if (!targetRoom) return;
        creep.memory.targetRoom = targetRoom;
        if (creep.room.name !== targetRoom) {
            const exitDir = Game.map.findExit(creep.room, targetRoom);
            if (exitDir < 0) return;
            const exit = creep.pos.findClosestByRange(exitDir);
            if (exit) creep.moveTo(exit);
            return;
        }
        // 在目標房：確保控制器升級 / 建造 spawn (若無)
        if (creep.memory.working && creep.store[RESOURCE_ENERGY] === 0) creep.memory.working = false;
        if (!creep.memory.working && creep.store.getFreeCapacity() === 0) creep.memory.working = true;
        if (!creep.memory.working) {
            const src = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
            if (src && creep.harvest(src) === ERR_NOT_IN_RANGE) creep.moveTo(src);
        } else {
            const controller = creep.room.controller;
            const spawnSite = creep.room.find(FIND_CONSTRUCTION_SITES, { filter: s => s.structureType === STRUCTURE_SPAWN })[0];
            if (spawnSite) {
                if (creep.build(spawnSite) === ERR_NOT_IN_RANGE) creep.moveTo(spawnSite);
            } else if (controller && (!controller.owner || controller.owner.username === creep.owner.username)) {
                if (creep.upgradeController(controller) === ERR_NOT_IN_RANGE) creep.moveTo(controller);
            }
        }
    }
};
