// Terminal 能量緩衝管理：維持 terminal energy 在 target 範圍，超出賣 / 不足從 storage 補
// 設定：Memory.terminal = { target:30000, band:5000 }

function run() {
    for (const roomName in Game.rooms) {
        const room = Game.rooms[roomName];
        if (!room.controller || !room.controller.my) continue;
        if (!room.terminal || !room.storage) continue;
        const term = room.terminal;
        const store = room.storage;
        if (!Memory.terminal) Memory.terminal = {};
        if (!Memory.terminal[roomName]) Memory.terminal[roomName] = { target:30000, band:5000 };
        const cfg = Memory.terminal[roomName];
        const targetLow = cfg.target - cfg.band;
        const targetHigh = cfg.target + cfg.band;
        const energyTerm = term.store[RESOURCE_ENERGY] || 0;
        // 補充：terminal 能量太低 -> withdraw storage -> send (本地轉移需 creep，這裡直接使用 terminal 無法，故僅在市場/跨房 send 時觸發)
        if (energyTerm < targetLow) {
            // 嘗試從 storage 手動搬運需 hauler 指派 (簡化：產生 job)
            if (!Memory.jobs) Memory.jobs = { queue: [] };
            const need = Math.min(store.store[RESOURCE_ENERGY] || 0, targetLow - energyTerm);
            if (need > 0) {
                Memory.jobs.queue.push({ type:'refillTerminal', amount:need, room:roomName, id:term.id, priority:3, created:Game.time });
            }
        } else if (energyTerm > targetHigh) {
            // 嘗試掛賣 (簡化：與 marketManager 一致策略)
            if (Game.time % 50 === 0) sellSurplusEnergy(term, energyTerm - targetHigh);
        }
    }
}

function sellSurplusEnergy(terminal, surplus) {
    const orders = Game.market.getAllOrders(o => o.type === ORDER_BUY && o.resourceType === RESOURCE_ENERGY && o.remainingAmount > 5000);
    if (!orders.length) return;
    orders.sort((a,b) => b.price - a.price);
    const best = orders[0];
    const amount = Math.min(surplus, best.remainingAmount, 5000);
    const cost = Game.market.calcTransactionCost(amount, terminal.room.name, best.roomName);
    if (terminal.store[RESOURCE_ENERGY] >= amount + cost) {
        Game.market.deal(best.id, amount, terminal.room.name);
    }
}

module.exports = { run };
