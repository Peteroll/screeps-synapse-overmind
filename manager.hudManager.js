// HUD 視覺顯示：房間內輸出基礎經濟/威脅/模式
const economy = require('manager.economyManager');

function draw() {
    for (const roomName in Game.rooms) {
        const room = Game.rooms[roomName];
        if (!room.controller || !room.controller.my) continue;
        const econ = Memory.economy && Memory.economy[roomName];
        const threat = Memory.threat && Memory.threat.level || 0;
        const war = Memory.threat && Memory.threat.warMode ? 'WAR' : '';
        room.visual.text(`E:${(econ && econ.energy)||0} ${econ?econ.mode:''} T:${threat} ${war}`, 1, 1, {align:'left',opacity:0.8,font:0.7});
    }
}
module.exports = { draw };
