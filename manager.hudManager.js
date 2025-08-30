// HUD 視覺顯示：房間內輸出基礎經濟/威脅/模式
const economy = require('manager.economyManager');

function draw() {
    for (const roomName in Game.rooms) {
        const room = Game.rooms[roomName];
        if (!room.controller || !room.controller.my) continue;
        const econ = Memory.economy && Memory.economy[roomName];
        const threat = Memory.threat && Memory.threat.level || 0;
        const war = Memory.threat && Memory.threat.warMode ? 'WAR' : '';
        const mineral = room.find(FIND_MINERALS)[0];
        let mStr = '';
        if (mineral) {
            if (mineral.mineralAmount > 0) {
                mStr = `${mineral.mineralType}:${mineral.mineralAmount}`;
            } else {
                mStr = `${mineral.mineralType}:regen${mineral.ticksToRegeneration}`;
            }
        }
    const cpu = Memory.metrics && Memory.metrics.cpuEma ? Memory.metrics.cpuEma.toFixed(1) : '-';
    room.visual.text(`v${global.STRATEGY_VERSION} E:${(econ && econ.energy)||0} ${econ?econ.mode:''} T:${threat} ${war} ${mStr} CPU:${cpu}` , 1, 1, {align:'left',opacity:0.85,font:0.7});
    }
}
module.exports = { draw };
