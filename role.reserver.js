module.exports = {
    run(creep) {
        if (!creep.memory.targetRoom) assignTargetRoom(creep);
        if (!creep.memory.targetRoom) return;
        if (creep.room.name !== creep.memory.targetRoom) {
            const exitDir = Game.map.findExit(creep.room, creep.memory.targetRoom);
            const exit = creep.pos.findClosestByRange(exitDir);
            if (exit) creep.moveTo(exit);
            return;
        }
        if (!creep.room.controller) return;
        if (creep.reserveController(creep.room.controller) === ERR_NOT_IN_RANGE) creep.moveTo(creep.room.controller);
    }
};

function assignTargetRoom(creep) {
    if (!Memory.remotes) return;
    for (const r in Memory.remotes) {
        const meta = Memory.remotes[r];
        if (meta.reserver) {
            // 檢查是否已有 reserver 指派
            const existing = Object.values(Game.creeps).some(c => c.memory.role === 'reserver' && c.memory.targetRoom === r);
            if (!existing) { creep.memory.targetRoom = r; return; }
        }
    }
}
