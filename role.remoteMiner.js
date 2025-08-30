module.exports = {
    run(creep) {
        if (!creep.memory.targetRoom) assignRemote(creep);
        if (!creep.memory.targetRoom) { creep.say('noRemote'); return; }
        if (creep.room.name !== creep.memory.targetRoom) {
            moveToRoom(creep, creep.memory.targetRoom);
            return;
        }
        if (!creep.memory.sourceId) {
            const sources = creep.room.find(FIND_SOURCES);
            creep.memory.sourceId = sources[Math.floor(Math.random()*sources.length)].id;
        }
        const source = Game.getObjectById(creep.memory.sourceId);
        if (source) {
            if (creep.pos.getRangeTo(source) > 1) creep.moveTo(source);
            else creep.harvest(source);
        }
    }
};

function assignRemote(creep) {
    if (!Memory.remotes) return;
    for (const roomName in Memory.remotes) {
        const need = Memory.remotes[roomName];
        if (!need) continue;
        // 檢查現有 remoteMiner 數
        const count = Object.values(Game.creeps).filter(c => c.memory.role === 'remoteMiner' && c.memory.targetRoom === roomName).length;
        if (count < (need.miners || 1)) { creep.memory.targetRoom = roomName; return; }
    }
}

function moveToRoom(creep, roomName) {
    const exitDir = Game.map.findExit(creep.room, roomName);
    const exit = creep.pos.findClosestByRange(exitDir);
    if (exit) creep.moveTo(exit);
}
