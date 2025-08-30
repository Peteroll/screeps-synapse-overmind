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
        ranger: 0
    },
    WALL_PROGRESS_STEP: 20000, // 每階段提升 wall/rampart 目標值
};
