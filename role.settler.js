// Settler：comehere 手動拓殖或自動 expansion 目標 帶 CLAIM 建據點
module.exports = {
    run(creep) {
        const targetRoom = (Memory.expansion && Memory.expansion.target) || creep.memory.targetRoom;
        if (!targetRoom) return;
        creep.memory.targetRoom = targetRoom;
        if (creep.room.name !== targetRoom) {
            const dest = new RoomPosition(25,25,targetRoom);
            creep.moveTo(dest,{range:20});
            return;
        }
        const controller = creep.room.controller;
        if (controller && !controller.my) {
            if (creep.claimController(controller) === ERR_NOT_IN_RANGE) creep.moveTo(controller);
            return;
        }
        const hasSpawn = creep.room.find(FIND_MY_STRUCTURES,{filter:s=>s.structureType===STRUCTURE_SPAWN}).length>0;
        if (!hasSpawn) {
            const spawnSite = creep.room.find(FIND_CONSTRUCTION_SITES,{filter:s=>s.structureType===STRUCTURE_SPAWN})[0];
            if (!spawnSite && controller) {
                for (let dx=-3; dx<=3; dx++) for (let dy=-3; dy<=3; dy++) {
                    const x=controller.pos.x+dx, y=controller.pos.y+dy;
                    if (x<2||x>47||y<2||y>47) continue;
                    if (creep.room.getTerrain().get(x,y) === TERRAIN_MASK_WALL) continue;
                    if (creep.room.createConstructionSite(x,y,STRUCTURE_SPAWN) === OK) { dx=4; dy=4; break; }
                }
            }
        }
        if (creep.memory.working && creep.store[RESOURCE_ENERGY] === 0) creep.memory.working = false;
        if (!creep.memory.working && creep.store.getFreeCapacity() === 0) creep.memory.working = true;
        if (!creep.memory.working) {
            const src = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
            if (src && creep.harvest(src) === ERR_NOT_IN_RANGE) creep.moveTo(src);
        } else {
            const spawnSite = creep.room.find(FIND_CONSTRUCTION_SITES,{filter:s=>s.structureType===STRUCTURE_SPAWN})[0];
            if (spawnSite) {
                if (creep.build(spawnSite) === ERR_NOT_IN_RANGE) creep.moveTo(spawnSite);
            } else if (controller && controller.my) {
                if (creep.upgradeController(controller) === ERR_NOT_IN_RANGE) creep.moveTo(controller);
            }
            else {
                const jm = require('manager.jobManager');
                jm.fallbackTask(creep);
            }
        }
    }
};