// ========= 全自動主迴圈 =========
// 新增 managers / roles 模組化。若初次部署仍只有 main.js，請將下列 require 對應檔案加入。

const config = require('util.config');
const log = require('util.log');
const taskManager = require('manager.taskManager');
const jobManager = require('manager.jobManager');
const remoteManager = require('manager.remoteManager');
const pathCache = require('manager.pathCache');
const marketManager = require('manager.marketManager');
const spawnManager = require('manager.spawnManager');
const defenseManager = require('manager.defenseManager');
const linkManager = require('manager.linkManager');
const economyManager = require('manager.economyManager');
const threatManager = require('manager.threatManager');
const hudManager = require('manager.hudManager');
const layoutManager = require('manager.layoutManager');
const costMatrixManager = require('manager.costMatrix');
const terminalManager = require('manager.terminalManager');
const expansionManager = require('manager.expansionManager');
require('util.movement'); // 會覆寫 moveTo 做快取

const roleMiner = require('role.miner');
const roleHauler = require('role.hauler');
const roleUpgrader = require('role.upgrader');
const roleBuilder = require('role.builder');
const roleRanger = require('role.ranger');
const roleRepairer = require('role.repairer');
const roleReserver = require('role.reserver');
const roleRemoteMiner = require('role.remoteMiner');
const roleRemoteHauler = require('role.remoteHauler');
const rolePioneer = require('role.pioneer');

module.exports.loop = function () {
    const startCpu = Game.cpu.getUsed();

    housekeeping();

    // 生成/更新任務 (依房間狀態)
    taskManager.generateRoomTasks();
    jobManager.buildGlobalQueue(); // 內含 aging 與加權排序
    remoteManager.scanFlags();
    remoteManager.plan();
    pathCache.run();
    layoutManager.run();
    costMatrixManager.recordTraffic();
    costMatrixManager.run();
    marketManager.run();
    terminalManager.run();
    threatManager.run();
    economyManager.run();
    expansionManager.run();

    // Link 網路
    linkManager.run();

    // 防禦 & 塔
    defenseManager.run();

    // 生產調度 (會根據 economy / threat 狀態調整)
    spawnManager.run();

    // 角色執行
    for (const name in Game.creeps) {
        const creep = Game.creeps[name];
        switch (creep.memory.role) {
            case 'miner': roleMiner.run(creep); break;
            case 'hauler': roleHauler.run(creep); break;
            case 'upgrader': roleUpgrader.run(creep); break;
            case 'builder': roleBuilder.run(creep); break;
            case 'ranger': roleRanger.run(creep); break;
            case 'repairer': roleRepairer.run(creep); break;
            case 'reserver': roleReserver.run(creep); break;
            case 'remoteMiner': roleRemoteMiner.run(creep); break;
            case 'remoteHauler': roleRemoteHauler.run(creep); break;
            case 'pioneer': rolePioneer.run(creep); break;
            default:
                // 臨時未知角色 → 指派 upgrade
                creep.memory.role = 'upgrader';
                roleUpgrader.run(creep);
        }
    }

    hudManager.draw();

    if (Game.time % config.LOG_TICK_INTERVAL === 0) {
        var cpuUsed = (Game.cpu.getUsed() - startCpu).toFixed(2);
        log.info('Tick ' + Game.time + ' CPU:' + cpuUsed + ' bucket:' + Game.cpu.bucket + ' warMode:' + (Memory.threat && Memory.threat.warMode ? 'ON' : 'off'));
    }
};

function housekeeping() {
    // 清 Memory 亡魂 + 版本遷移
    for (const name in Memory.creeps) if (!Game.creeps[name]) delete Memory.creeps[name];
    if (!Memory.meta) Memory.meta = { version: 1 };
    // Wall 目標初值
    if (!Memory.defense || Memory.defense.wallTarget === undefined) {
        Memory.defense = Memory.defense || {}; 
        Memory.defense.wallTarget = 5000;
    }
}

