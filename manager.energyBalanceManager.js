// 跨房能量平衡：富餘房 send 給 貧乏房 (透過 Terminal)
// 條件：
// - 富餘房 storage energy > 400k 且 terminal energy > 40k
// - 貧乏房 storage energy < 120k
// - 每 300 tick 執行一次，單次每對最多一次 30k (含交易費)

function run() {
    if (Game.time % 300 !== 0) return;
    const rich = [];
    const poor = [];
    for (const roomName in Game.rooms) {
        const room = Game.rooms[roomName];
        if (!room.controller || !room.controller.my) continue;
        if (!room.storage || !room.terminal) continue;
        const e = room.storage.store[RESOURCE_ENERGY] || 0;
        if (e > 400000 && room.terminal.store[RESOURCE_ENERGY] > 40000) rich.push(room);
        else if (e < 120000) poor.push(room);
    }
    if (!rich.length || !poor.length) return;
    // 簡單配對：最大富餘 -> 最低匱乏
    rich.sort((a,b)=> (b.storage.store[RESOURCE_ENERGY]||0) - (a.storage.store[RESOURCE_ENERGY]||0));
    poor.sort((a,b)=> (a.storage.store[RESOURCE_ENERGY]||0) - (b.storage.store[RESOURCE_ENERGY]||0));
    for (const donor of rich) {
        const receiver = poor.shift();
        if (!receiver) break;
        const amount = Math.min(30000, donor.terminal.store[RESOURCE_ENERGY]);
        if (amount < 5000) continue;
        const cost = Game.market.calcTransactionCost(amount, donor.name, receiver.name);
        if (donor.terminal.store[RESOURCE_ENERGY] < amount + cost) continue;
        const res = donor.terminal.send(RESOURCE_ENERGY, amount, receiver.name, 'balance');
        if (res === OK) {
            // 記錄
            if (!Memory.energyBalance) Memory.energyBalance = [];
            Memory.energyBalance.push({ t:Game.time, from:donor.name, to:receiver.name, amount });
        }
    }
}

module.exports = { run };