// 簡化任務系統：產生房間層級任務 (建造/修理/補充 tower energy 等)
// 供將來 creep 依需求 claim 使用。此範例先放生成，後續可擴展到真正任務佇列。
const log = require('util.log');

function generateRoomTasks() {
    for (const roomName in Game.rooms) {
        const room = Game.rooms[roomName];
        if (!room.memory.tasks) room.memory.tasks = {};

        // 建造任務
        const sites = room.find(FIND_CONSTRUCTION_SITES);
        room.memory.tasks.buildCount = sites.length;

        // 修理統計 (不含牆過大)
        const repairTargets = room.find(FIND_STRUCTURES, { filter: s => s.hits < s.hitsMax * 0.5 && s.hits < 200000 && s.structureType !== STRUCTURE_WALL });
        room.memory.tasks.repairCount = repairTargets.length;

        // Tower 能量補給需求
        const towers = room.find(FIND_MY_STRUCTURES, { filter: s => s.structureType === STRUCTURE_TOWER && s.store.getFreeCapacity(RESOURCE_ENERGY) > 200 });
        room.memory.tasks.towerRefill = towers.length;
    }
}

module.exports = { generateRoomTasks: function(){} };
