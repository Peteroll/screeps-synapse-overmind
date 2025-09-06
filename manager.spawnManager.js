// 進階 spawn 管理：根據房間礦點數量生產 miner，依據房間可用能量大量生產 upgrader
module.exports = {
	run: function () {
	// 初始化 spawn queue
		Memory.spawnQueue = Memory.spawnQueue || [];

		// 計算現有 role 數量與 queue 中的 pending
		const counts = {};
		for (const name in Game.creeps) {
			const r = Game.creeps[name].memory.role || 'upgrader';
			counts[r] = (counts[r] || 0) + 1;
		}
		const pending = {};
		for (const q of Memory.spawnQueue) pending[q.memory.role] = (pending[q.memory.role] || 0) + 1;

		// 房間 container 記錄
		Memory.roomContainers = Memory.roomContainers || {};

		// 處理每個 spawn 的生產/派遣
		for (const sname in Game.spawns) {
			const spawn = Game.spawns[sname];
			const room = spawn.room;

			// logging
			try { require('util.log').debug(`[spawnManager] processing spawn ${sname} in room ${room.name}`); } catch(e) {}

			// 掃描並記錄 container
			if (room && room.find) {
				const containers = room.find(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_CONTAINER });
				Memory.roomContainers[room.name] = containers.map(c => c.id);
			}

			// 若 spawn 正在生產就跳過啟動新任務，但仍允許佇列處理
			if (!spawn.spawning && Memory.spawnQueue.length > 0) {
				const job = Memory.spawnQueue.shift();
				const name = `${job.memory.role}_${Game.time}`;
				const res = spawn.spawnCreep(job.body, name, { memory: job.memory });
				if (res !== OK) {
					// 若能量不足則把任務放回佇列尾端，其他錯誤則記錄
					if (res === ERR_NOT_ENOUGH_ENERGY) Memory.spawnQueue.unshift(job);
					else console.log('[spawnManager] spawnCreep failed', res, job);
				}
				// 只嘗試一個任務每個 spawn tick
				continue;
			}

			// 決定期望數量
			const sources = (room.find && room.find(FIND_SOURCES).length) || 1;
			const desiredMiner = sources;
			const energyCap = room.energyCapacityAvailable || 300;
			let desiredUpgrader = Math.min(12, Math.max(2, Math.floor(energyCap / 250)));
			if (room.controller && room.controller.level < 8) desiredUpgrader = Math.max(desiredUpgrader, 4);

			// 若房內有 container，維持至少 1 個 hauler
			const containers = Memory.roomContainers[room.name] || [];
			const desiredHauler = containers.length > 0 ? 1 : 0;

			// 檢查是否有建築工地，需要 builder
			const sites = room.find ? room.find(FIND_CONSTRUCTION_SITES) : [];
			const desiredBuilder = sites.length > 0 ? Math.min(3, sites.length) : 0;

			// 當前含 pending 的數量
			const haveMiner = (counts.miner || 0) + (pending.miner || 0);
			const haveUpgrader = (counts.upgrader || 0) + (pending.upgrader || 0);
			const haveHauler = (counts.hauler || 0) + (pending.hauler || 0);

			// 先排 miner 任務到佇列
			if (haveMiner < desiredMiner) {
				Memory.spawnQueue.push({ body: buildMinerBody(room.energyAvailable), memory: { role: 'miner' } });
				pending.miner = (pending.miner || 0) + 1;
				continue;
			}

			// 再排 hauler（若有需求）
			if (haveHauler < desiredHauler) {
				Memory.spawnQueue.push({ body: [CARRY, CARRY, MOVE, MOVE], memory: { role: 'hauler' } });
				pending.hauler = (pending.hauler || 0) + 1;
				continue;
			}

			// 建築工地存在時排 builder
			const haveBuilder = (counts.builder || 0) + (pending.builder || 0);
			if (haveBuilder < desiredBuilder) {
				Memory.spawnQueue.push({ body: buildBuilderBody(room.energyAvailable), memory: { role: 'builder' } });
				pending.builder = (pending.builder || 0) + 1;
				continue;
			}

			// 最後排 upgrader
			if (haveUpgrader < desiredUpgrader) {
				Memory.spawnQueue.push({ body: buildUpgraderBody(room.energyAvailable), memory: { role: 'upgrader' } });
				pending.upgrader = (pending.upgrader || 0) + 1;
				continue;
			}
		}

		function buildMinerBody(energy) {
			if (energy >= 800) return [WORK, WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE];
			if (energy >= 600) return [WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE];
			if (energy >= 400) return [WORK, WORK, CARRY, MOVE, MOVE];
			return [WORK, CARRY, MOVE];
		}

		function buildBuilderBody(energy) {
			// builder 以平衡 WORK/CARRY/MOVE 為主，避免太大導致等待過久
			if (energy >= 800) return [WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE];
			if (energy >= 600) return [WORK, WORK, CARRY, MOVE, MOVE];
			if (energy >= 400) return [WORK, CARRY, MOVE, MOVE];
			return [WORK, CARRY, MOVE];
		}

		function buildUpgraderBody(energy) {
			const unitCost = 100 + 50 + 50;
			let sets = Math.floor(energy / unitCost);
			if (sets < 1) sets = 1;
			if (sets > 8) sets = 8;
			const body = [];
			for (let i = 0; i < sets; i++) { body.push(WORK); body.push(CARRY); body.push(MOVE); }
			return body;
		}
	}
};
