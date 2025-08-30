// 市場策略：
// 1. 能量：terminal 能量 > 閾值出售高價買單
// 2. 礦物：超過 buffer 時 (config.MARKET.MINERAL_DEFAULT_BUFFER) 尋找高價買單出售
// 3. 簡單價格過濾：低於設定最小價格不賣
const log = require('util.log');
const config = require('util.config');
const resourcePlanner = require('manager.resourcePlanner');

function run() {
    if (!Memory.market) Memory.market = { priceHistory: {}, ema: {}, lastSample: 0 };
    samplePrices();
    if (Game.time % 100 !== 0) return; // 100 tick 一次交易決策
    for (const roomName in Game.rooms) {
        const room = Game.rooms[roomName];
        if (!room.terminal) continue;
        const terminal = room.terminal;
        handleEnergy(roomName, terminal);
        handleMinerals(roomName, terminal);
    handleProcurement(roomName, terminal); // (E)
    }
}

// 每 20 tick 採樣一次價格 (買單最高價) 建立簡易 EMA 與波動帶
function samplePrices() {
    if (Game.time % 20 !== 0) return;
    const targets = [RESOURCE_ENERGY]; // 可擴充加入常見礦物
    for (const res of targets) {
        const best = Game.market.getAllOrders({ type: ORDER_BUY, resourceType: res })
            .reduce((m,o)=> o.price>m?o.price:m,0);
        if (!Memory.market.priceHistory[res]) Memory.market.priceHistory[res] = [];
        const hist = Memory.market.priceHistory[res];
        hist.push(best);
        if (hist.length > 100) hist.shift();
        // EMA
        const alpha = 0.2;
        const prev = Memory.market.ema[res] || best;
        Memory.market.ema[res] = prev + alpha * (best - prev);
    }
}

function handleEnergy(roomName, terminal) {
    const energy = terminal.store[RESOURCE_ENERGY] || 0;
    if (energy < 20000) return; // 基礎庫存保留
    const ema = (Memory.market.ema && Memory.market.ema[RESOURCE_ENERGY]) || config.MARKET.ENERGY_MIN_PRICE || 0.7;
    const minPrice = ema * 0.95; // 動態底線 (95% EMA)
    const goodPrice = ema * 1.05; // 高於此視為良好
    const orders = Game.market.getAllOrders({ type: ORDER_BUY, resourceType: RESOURCE_ENERGY })
        .filter(o => o.remainingAmount > 1000);
    if (!orders.length) return;
    orders.sort((a,b)=> b.price - a.price);
    const top = orders[0];
    if (top.price < minPrice) return; // 價格低迷，暫緩
    const targetAmount = top.price >= goodPrice ? 8000 : 4000;
    const amount = Math.min(targetAmount, top.amount, terminal.store[RESOURCE_ENERGY]);
    if (amount < 500) return;
    const res = Game.market.deal(top.id, amount, roomName);
    if (res === OK) {
        if (!Memory.metrics) Memory.metrics = {};
        if (!Memory.metrics.market) Memory.metrics.market = { revenue:0 };
        Memory.metrics.market.revenue += amount * top.price;
        log.info(`[Market] Sell ${amount} energy @${top.price.toFixed(3)} ema:${ema.toFixed(3)} (${roomName} -> ${top.roomName})`);
    }
}

function handleMinerals(roomName, terminal) {
    const buffer = (config.MARKET && config.MARKET.MINERAL_DEFAULT_BUFFER) || 3000;
    for (const res in terminal.store) {
        if (res === RESOURCE_ENERGY) continue;
        const qty = terminal.store[res];
    if (qty <= buffer) continue;
    // 若為已預留 boost 資源且剩餘不足預留量 + buffer 則跳過
    if (resourcePlanner && resourcePlanner.isReserved && resourcePlanner.isReserved(res, qty)) continue;
    // 若 resourcePlanner 有 demand，僅賣出超出 demand+buffer 的部分
    const demand = (Memory.resource && Memory.resource.demand && Memory.resource.demand[res]) || 0;
    const reserved = (Memory.resource && Memory.resource.reserved && Memory.resource.reserved[res]) || 0;
    const protectedAmount = demand + reserved + buffer;
    if (qty <= protectedAmount) continue;
        const orders = Game.market.getAllOrders({ type: ORDER_BUY, resourceType: res });
        if (!orders.length) continue;
        orders.sort((a,b)=> b.price - a.price);
        const top = orders[0];
        // 動態過濾：若有歷史，取最近 10 筆平均為 base
        const hist = (Memory.market.priceHistory[res] || []);
        const recent = hist.slice(-10);
        const avg = recent.length ? recent.reduce((s,v)=>s+v,0)/recent.length : top.price;
        if (top.price < avg * 0.9) continue; // 低於 90% 平均不賣
    const sellAmount = Math.min(qty - protectedAmount, top.amount, 5000);
        if (sellAmount < 200) continue;
        const cost = Game.market.calcTransactionCost(sellAmount, roomName, top.roomName);
        if ((terminal.store[RESOURCE_ENERGY]||0) < cost) continue;
        const ok = Game.market.deal(top.id, sellAmount, roomName);
        if (ok === OK) {
            if (!Memory.metrics) Memory.metrics = {};
            if (!Memory.metrics.market) Memory.metrics.market = { revenue:0 };
            Memory.metrics.market.revenue += sellAmount * top.price;
            log.info(`[Market] Sell ${sellAmount} ${res} @${top.price.toFixed(3)} avg10:${avg.toFixed(3)} (${roomName} -> ${top.roomName})`);
        }
    }
}

module.exports = { run };

function handleProcurement(roomName, terminal) {
    if (Game.time % 200 !== 0) return; // 200 tick
    if (!Memory.resource || !Memory.resource.demand) return;
    const cfg = config;
    const demand = Memory.resource.demand;
    const reserved = (Memory.resource && Memory.resource.reserved) || {};
    const cap = (cfg.MARKET && cfg.MARKET.BUY_PRICE_CAP) || 3.0;
    for (const res in demand) {
        if (res === RESOURCE_ENERGY) continue;
        const need = demand[res] + (reserved[res]||0);
        if (need <= 0) continue;
        let have = (terminal.store[res]||0);
        if (terminal.room.storage) have += terminal.room.storage.store[res]||0;
        if (have >= need * 0.5) continue; // 低於 50% 才補
        const deficit = need - have;
        if (deficit < 200) continue;
        const orders = Game.market.getAllOrders({ type: ORDER_SELL, resourceType: res });
        if (!orders.length) continue;
        orders.sort((a,b)=> a.price - b.price);
        const pick = orders.find(o=>o.price <= cap);
        if (!pick) continue;
        const amount = Math.min(deficit, pick.remainingAmount, 2000);
        if (amount < 100) continue;
        const energyCost = Game.market.calcTransactionCost(amount, roomName, pick.roomName);
        if ((terminal.store[RESOURCE_ENERGY]||0) < energyCost + 500) continue;
        const ok = Game.market.deal(pick.id, amount, roomName);
        if (ok === OK) {
            if (!Memory.metrics) Memory.metrics = {};
            if (!Memory.metrics.procure) Memory.metrics.procure = {};
            Memory.metrics.procure[res] = (Memory.metrics.procure[res]||0) + amount;
        }
    }
}
