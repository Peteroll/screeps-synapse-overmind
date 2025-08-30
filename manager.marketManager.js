// 市場策略：簡化版 (能量 > 閾值才掛賣單；低於不賣)
const log = require('util.log');

function run() {
    if (Game.time % 100 !== 0) return; // 100 tick 一次
    for (const roomName in Game.rooms) {
        const room = Game.rooms[roomName];
        if (!room.terminal) continue;
        const terminal = room.terminal;
        const energy = terminal.store[RESOURCE_ENERGY] || 0;
        if (energy < 20000) continue; // 保留底線
        // 尋找高價買單
        const orders = Game.market.getAllOrders({ type: ORDER_BUY, resourceType: RESOURCE_ENERGY });
        const sorted = orders.filter(o => Game.market.calcTransactionCost(1000, roomName, o.roomName) < 1000)
            .sort((a, b) => b.price - a.price);
        if (sorted.length === 0) continue;
        const top = sorted[0];
        const amount = Math.min(5000, top.amount, terminal.store[RESOURCE_ENERGY]);
        if (amount > 0) {
            const res = Game.market.deal(top.id, amount, roomName);
            if (res === OK) log.info(`[Market] Sell ${amount} energy @${top.price.toFixed(3)} (${roomName} -> ${top.roomName})`);
        }
    }
}

module.exports = { run };
