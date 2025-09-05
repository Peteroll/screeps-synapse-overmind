// HUD 視覺顯示：房間內輸出基礎經濟/威脅/模式
const economy = require('manager.economyManager');

function draw() {
    for (var roomName in Game.rooms) {
        var room = Game.rooms[roomName];
        if (!room.controller || !room.controller.my) continue;
        var econ = Memory.economy && Memory.economy[roomName];
        var threat = Memory.threat && Memory.threat.level || 0;
        var war = Memory.threat && Memory.threat.warMode ? 'WAR' : '';
        var mineral = room.find(FIND_MINERALS)[0];
        var mStr = '';
        if (mineral) {
            mStr = mineral.mineralAmount > 0 ? `${mineral.mineralType}:${mineral.mineralAmount}` : `${mineral.mineralType}:regen${mineral.ticksToRegeneration}`;
        }
        var cpu = Memory.metrics && Memory.metrics.cpuEma ? Memory.metrics.cpuEma.toFixed(1) : '-';
        var kpi = buildKPI();
        room.visual.text(`v${global.STRATEGY_VERSION} E:${(econ && econ.energy)||0} ${econ?econ.mode:''} T:${threat} ${war} ${mStr} CPU:${cpu}`, 1, 1, {align:'left',opacity:0.85,font:0.7});
        room.visual.text(`KPI H:${kpi.harvestRate} U:${kpi.upgradeRate} Idle:${kpi.haulerIdle}% Rev1k:${kpi.marketRev}`, 1, 2, {align:'left', opacity:0.7, font:0.6});
        if (room.controller && room.controller.ticksToDowngrade < 5000) {
            room.visual.text(`DOWNGRADE ${room.controller.ticksToDowngrade}`, 1, 3, {align:'left', color:'#ff5555', font:0.8, opacity:0.9});
        }
    }
}

function buildKPI() { // (D) KPI
    var harvest = Memory.roi && Memory.roi.summary ? Math.round((Memory.roi.summary.income||0)/100) : 0;
    var upgradeRate = 0;
    if (Memory.economy) for (var r in Memory.economy) { var e = Memory.economy[r]; if (e && e.upgradeDelta) upgradeRate += e.upgradeDelta; }
    upgradeRate = Math.round(upgradeRate / 1000);
    var idlePct = 0;
    if (Memory.metrics && Memory.metrics.hauler) {
        var m = Memory.metrics.hauler; if (m.total>0) idlePct = Math.round(m.idle/m.total*100);
    }
    var rev1k = 0;
    if (Memory.metrics && Memory.metrics.market) {
        var ticks = (Game.time - (Memory.metrics.market.start||Game.time)) + 1;
        rev1k = Math.round(Memory.metrics.market.revenue * 1000 / ticks);
    }
    return { harvestRate: harvest, upgradeRate: upgradeRate, haulerIdle: idlePct, marketRev: rev1k };
}
module.exports = { draw };
