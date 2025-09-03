// ========= 全自動主迴圈 =========
// 新增 managers / roles 模組化。若初次部署仍只有 main.js，請將下列 require 對應檔案加入。
// 版本常數 (同步 README)
global.STRATEGY_NAME = 'Synapse Overmind';
global.STRATEGY_VERSION = '0.9.8'; // 佈局維護：錯置結構延遲拆除 + 低流量道路精簡

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
const labManager = require('manager.labManager');
const roiManager = require('manager.roiManager');
const roadManager = require('manager.roadManager');
const logisticsManager = require('manager.logisticsManager'); // A: 物流合併
let constructionManager; // 自動建設策略 (容錯)
try { constructionManager = require('manager.constructionManager'); }
catch(e){ console.log('[WARN] constructionManager require 失敗:', e && e.message); constructionManager = { run: function(){} }; }
const energyBalanceManager = require('manager.energyBalanceManager');
const boostManager = require('manager.boostManager');
const resourcePlanner = require('manager.resourcePlanner');
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
const roleMineralMiner = require('role.mineralMiner');
const roleSettler = require('role.settler');

module.exports.loop = function () {
    const startCpu = Game.cpu.getUsed();

    housekeeping();

    // (D) Profiler 包裝
    if (!Memory.profiler) Memory.profiler = { managers:{} };
    function prof(name, fn){ const b=Game.cpu.getUsed(); try{fn();}catch(e){console.log('[ERR mgr]',name,e.stack||e);} const u=Game.cpu.getUsed()-b; const slot=Memory.profiler.managers[name]||{t:0,c:0}; slot.t+=u; slot.c++; if(slot.c>=50){slot.avg=slot.t/slot.c; slot.t*=0.5; slot.c=Math.max(1,slot.c*0.5);} Memory.profiler.managers[name]=slot; }
    prof('task', ()=>taskManager.generateRoomTasks());
    prof('job', ()=>jobManager.buildGlobalQueue());
    prof('logistics', ()=>logisticsManager.run());
    prof('remoteScan', ()=>remoteManager.scanFlags());
    prof('remotePlan', ()=>remoteManager.plan());
    prof('pathCache', ()=>pathCache.run());
    prof('layout', ()=>layoutManager.run());
    prof('trafficRec', ()=>costMatrixManager.recordTraffic());
    prof('costMatrix', ()=>costMatrixManager.run());
    prof('market', ()=>marketManager.run());
    prof('terminal', ()=>terminalManager.run());
    prof('threat', ()=>threatManager.run());
    prof('economy', ()=>economyManager.run());
    prof('expansion', ()=>expansionManager.run());
    prof('lab', ()=>labManager.run());
    prof('boost', ()=>boostManager.run());
    prof('resourcePlan', ()=>resourcePlanner.run());
    prof('construction', ()=>constructionManager.run());
    prof('roi', ()=>roiManager.run());
    prof('road', ()=>roadManager.run());
    prof('energyBalance', ()=>energyBalanceManager.run());
    if (Game.time % 200 === 0 && global.scanRoadHealth) global.scanRoadHealth();

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
            case 'settler': roleSettler.run(creep); break;
            case 'pioneer': rolePioneer.run(creep); break;
            case 'mineralMiner': roleMineralMiner.run(creep); break;
            default:
                // 臨時未知角色 → 指派 upgrade
                creep.memory.role = 'upgrader';
                roleUpgrader.run(creep);
        }
    }

    hudManager.draw();

    const cpuUsed = Game.cpu.getUsed() - startCpu;
    // 指數平滑 CPU 監控 + 角色統計 + Hauler Idle (D)
    if (!Memory.metrics) Memory.metrics = {};
    Memory.metrics.cpuEma = Memory.metrics.cpuEma === undefined ? cpuUsed : (Memory.metrics.cpuEma * 0.95 + cpuUsed * 0.05);
    if (!Memory.metrics.hauler) Memory.metrics.hauler = { idle:0,total:0 };
    for (const hn in Game.creeps) {
        const hc = Game.creeps[hn];
        if (hc.memory.role === 'hauler') {
            Memory.metrics.hauler.total++;
            if (hc.memory.working && !hc.memory.jobId) Memory.metrics.hauler.idle++;
        }
    }
    if (Memory.metrics.market && Memory.metrics.market.revenue !== undefined && !Memory.metrics.market.start) Memory.metrics.market.start = Game.time;
    if (Game.time % 50 === 0) {
        const roleCount = {};
        for (const name in Game.creeps) {
            const r = Game.creeps[name].memory.role || 'unknown';
            roleCount[r] = (roleCount[r] || 0) + 1;
        }
        Memory.metrics.roles = roleCount;
    }
    if (Game.time % config.LOG_TICK_INTERVAL === 0) {
        log.info(`Tick ${Game.time} CPU:${cpuUsed.toFixed(2)} avg:${(Memory.metrics.cpuEma||0).toFixed(2)} bucket:${Game.cpu.bucket} warMode:${(Memory.threat && Memory.threat.warMode ? 'ON' : 'off')}`);
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

