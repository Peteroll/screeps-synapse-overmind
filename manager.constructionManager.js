// 自動建設策略管理器
// 動態估算 builder 需求 + 建築 backlog 記錄
// 依 util.config.CONSTRUCTION 參數

const config = require('util.config');

function run() {
    if (!Memory.construction) Memory.construction = {};
    for (var roomName in Game.rooms) {
        var room = Game.rooms[roomName];
        if (!room.controller || !room.controller.my) continue;
        var sites = room.find(FIND_CONSTRUCTION_SITES);
        if (!Memory.construction[roomName]) Memory.construction[roomName] = {};
        var state = Memory.construction[roomName];
        var totalRemaining = 0;
        for (var i=0;i<sites.length;i++) totalRemaining += (sites[i].progressTotal - sites[i].progress);
        state.totalRemaining = totalRemaining;
        state.siteCount = sites.length;
        var cfg = config.CONSTRUCTION;
        var econ = Memory.economy && Memory.economy[roomName];
        var mode = econ && econ.mode || 'normal';
        var targetWindow = cfg.TARGET_WINDOW;
        if (mode === 'buildRush') targetWindow = Math.max(200, Math.floor(targetWindow * 0.7));
        if (mode === 'conserve') targetWindow = Math.floor(targetWindow * 1.6);
        var assumedPerBuilder = cfg.ASSUMED_WORK_PARTS * 5; // 每 tick progress
        var rawNeed = totalRemaining / (targetWindow * assumedPerBuilder);
        var desired = Math.ceil(rawNeed);
        if (desired < 0) desired = 0;
        var maxBuilders = cfg.MAX_BUILDERS_BASE;
        if (mode === 'buildRush') maxBuilders = Math.floor(maxBuilders * 1.5);
        if (mode === 'conserve') maxBuilders = Math.min(maxBuilders, 1);
        if (totalRemaining < cfg.LOW_BACKLOG_THRESHOLD) desired = Math.min(desired, 1);
        desired = Math.min(desired, maxBuilders);
        if (sites.length === 0) desired = 0; else desired = Math.max(desired, 1);
        state.builderTarget = desired;
        state.mode = mode;
        state.lastUpdate = Game.time;
    }
}

function getBuilderTarget(room) {
    if (!Memory.construction || !Memory.construction[room.name]) return 0;
    return Memory.construction[room.name].builderTarget || 0;
}

module.exports = { run, getBuilderTarget };
