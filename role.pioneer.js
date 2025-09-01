// Pioneer：前往擴張目標房，建造、升級、初步道路
module.exports = {
    run(creep) {
        const targetRoom = (Memory.expansion && Memory.expansion.target) || creep.memory.targetRoom;
        if (!targetRoom) return;
        creep.memory.targetRoom = targetRoom;

        // === 跨房導航優化：直接對目標中心 pathFinder，多房間不再逐出口跳動 ===
        if (creep.room.name !== targetRoom) {
            // 卡住檢測
            if (!creep.memory._stk) creep.memory._stk = {x:creep.pos.x,y:creep.pos.y,t:Game.time};
            else if (creep.pos.x === creep.memory._stk.x && creep.pos.y === creep.memory._stk.y) {
                if (Game.time - creep.memory._stk.t >= 3) {
                    // 清路徑快取，並嘗試脫離邊界/牆
                    delete creep.memory._cachedPath; delete creep.memory._cachedPathKey;
                    // 若在邊界，往房間內側走一格避免反覆進出
                    if (creep.pos.x === 0) creep.move(RIGHT);
                    else if (creep.pos.x === 49) creep.move(LEFT);
                    else if (creep.pos.y === 0) creep.move(BOTTOM);
                    else if (creep.pos.y === 49) creep.move(TOP);
                }
            } else {
                creep.memory._stk = {x:creep.pos.x,y:creep.pos.y,t:Game.time};
            }
            const center = new RoomPosition(25, 25, targetRoom);
            // 目標不可見時 moveTo 仍會透過 PathFinder 跨房規劃
            creep.moveTo(center, { range: 20 });
            return;
        }

        // === 目標房內行為 ===
        if (creep.memory.working && creep.store[RESOURCE_ENERGY] === 0) creep.memory.working = false;
        if (!creep.memory.working && creep.store.getFreeCapacity() === 0) creep.memory.working = true;

        if (!creep.memory.working) {
            const src = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
            if (src && creep.harvest(src) === ERR_NOT_IN_RANGE) creep.moveTo(src);
        } else {
            const controller = creep.room.controller;
            // 先確保 spawn 建造 (若還沒有己方 spawn)
            const hasSpawn = creep.room.find(FIND_MY_STRUCTURES, {filter:s=>s.structureType===STRUCTURE_SPAWN}).length>0;
            const spawnSite = hasSpawn ? null : creep.room.find(FIND_CONSTRUCTION_SITES, { filter: s => s.structureType === STRUCTURE_SPAWN })[0];
            if (spawnSite) {
                if (creep.build(spawnSite) === ERR_NOT_IN_RANGE) creep.moveTo(spawnSite);
            } else if (controller && (!controller.owner || controller.owner.username === creep.owner.username)) {
                if (creep.upgradeController(controller) === ERR_NOT_IN_RANGE) creep.moveTo(controller);
            }
        }
    }
};
