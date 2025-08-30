// 簡易 Link 管理：將 Source Link 能量送往 Controller/Hub Link
const log = require('util.log');

function run() {
    for (const roomName in Game.rooms) {
        const room = Game.rooms[roomName];
        if (!room.controller) continue;
        const links = room.find(FIND_MY_STRUCTURES, { filter: s => s.structureType === STRUCTURE_LINK });
        if (links.length < 2) continue; // 至少要 2 個

        let controllerLink = room.controller.pos.findInRange(links, 3)[0];
        // 選最靠 storage 的當 hub
        let storageLink = null;
        if (room.storage) storageLink = room.storage.pos.findInRange(links, 2)[0];
        if (!controllerLink || !storageLink) {
            // fallback: 任意兩個
            controllerLink = links[0];
            storageLink = links[1];
        }

        for (const link of links) {
            if (link.id === controllerLink.id || link.id === storageLink.id) continue;
            // 視為 Source Link -> 若能量高則輸出
            if (link.store[RESOURCE_ENERGY] > 600) {
                if (controllerLink.store.getFreeCapacity(RESOURCE_ENERGY) > 0) link.transferEnergy(controllerLink);
                else if (storageLink.store.getFreeCapacity(RESOURCE_ENERGY) > 0) link.transferEnergy(storageLink);
            }
        }
    }
}

module.exports = { run: function(){} };
