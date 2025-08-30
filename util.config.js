module.exports = {
    MY_NAME: 'HTTP400',
    DEBUG: true,
    LOG_TICK_INTERVAL: 20,
    // 動態角色基本目標 (會再由 spawnManager 按房間調整)
    BASE_ROLE_TARGET: {
        miner: 2,       // 每 source 一隻 (會自動配對)
        hauler: 2,
        upgrader: 4,
        builder: 2,
        repairer: 1,
    ranger: 0,
    mineralMiner: 0
    },
    WALL_PROGRESS_STEP: 20000, // 每階段提升 wall/rampart 目標值
    MARKET: {
        ENERGY_MIN_PRICE: 0.7, // 低於不賣 (僅參考，不硬性)
        MINERAL_DEFAULT_BUFFER: 3000, // 每種礦物保留量
    MINERAL_DEFAULT_MIN_PRICE: 0.6, // 低於此價格暫不出售
    BUY_PRICE_CAP: 3.0 // (E) 主動補貨上限價
    },
    INTEL: {
        REMOTE_HOSTILE_SUSPEND_TICKS: 50, // 連續看到敵人多少 tick 暫停該 remote
        REMOTE_RESUME_CLEAR_TICKS: 200 // 多久無敵人後恢復
    },
    DEFENSE: {
        DISMANTLE_SURVIVE_TIME: 150, // 希望牆可撐幾 tick
        DISMANTLE_MIN_INCREASE: 20000 // 最少提升量
    },
    PATH: {
        HOSTILE_AVOID_COST: 50 // 在敵人攻擊半徑內提高 cost
    },
    CONSTRUCTION: {
        PRIORITY: {
            spawn: 10,
            storage: 9,
            tower: 9,
            extension: 8,
            link: 8,
            container: 7,
            terminal: 7,
            lab: 7,
            factory: 7,
            observer: 6,
            powerSpawn: 6,
            extractor: 6,
            road: 5,
            rampart: 4,
            wall: 2
        },
        ASSUMED_WORK_PARTS: 5,
        TARGET_WINDOW: 1200,
        MAX_BUILDERS_BASE: 5,
        LOW_BACKLOG_THRESHOLD: 20000
    },
    LAB: {
        ENABLE: true,
        PRIMARY_REACTION: 'XKHO2', // 示意主要生成的 boost (Ranged Attack Boost)
        REAGENT_MIN: 1000, // 若 input lab 低於此量則補給
        REAGENT_BATCH: 1500, // 每次補給目標
        OUTPUT_PICKUP: 1500, // 產物達到此量建立回收任務
        REACTION_GRAPH: { // 簡化反應圖 (僅展開到 T3 範例，可自行擴充)
            XKHO2: ['X','KHO2'], KHO2: ['KO2','H'], KO2:['K','O2'], X:['X','X'], // X 為終端購買或已有庫存 placeholder
            XLHO2: ['X','LHO2'], LHO2:['LO2','H'], LO2:['L','O2'],
            XGHO2: ['X','GHO2'], GHO2:['GO2','H'], GO2:['G','O2']
        },
        BOOST_PLAN: { // 指定角色類型對應期望 boost 清單 (優先序)
            ranger: ['XKHO2'],
            repairer: ['XLHO2'],
            hauler: [],
            miner: [],
            upgrader: ['XGHO2']
        },
    BOOST_PART_COST: 30, // 每部件消耗 30 單位 (標準規則)
    SAFETY_STOCK_RATIO: 0.3 // 中間產物/目標需求的安全庫存比例
    }
};
