// Expansion 排序：評分附近待擴張房間 (僅示意簡化版)
// Memory.expansion = { lastScan: <tick>, candidates: [{roomName, score, sources, distance}], target }

module.exports = {
	run() {
		try {
			if (!Memory.roomReadyForExpansion) Memory.roomReadyForExpansion = {};
			for (const name in Game.rooms) {
				const room = Game.rooms[name];
				if (!room.controller || !room.controller.my) continue;
				const level = room.controller.level;
				if (level < 8) {
					Memory.roomReadyForExpansion[name] = false;
					continue;
				}

				// if RCL 8, ensure at least one tower exists or is being built
				const towers = room.find(FIND_MY_STRUCTURES, { filter: s => s.structureType === STRUCTURE_TOWER });
				const towerSites = room.find(FIND_CONSTRUCTION_SITES, { filter: s => s.structureType === STRUCTURE_TOWER });
				if ((towers && towers.length > 0) || (towerSites && towerSites.length > 0)) {
					Memory.roomReadyForExpansion[name] = true;
					// if ready and not yet planned, plan the city
					if (!Memory.roomPlannedCity) Memory.roomPlannedCity = {};
					if (!Memory.roomPlannedCity[name]) {
						try { require('manager.layoutManager').planCity(room); Memory.roomPlannedCity[name] = true; } catch (e) {}
					}
					continue;
				}

				// try to plan defense (create a tower site)
				try { require('manager.layoutManager').planDefense(room); } catch (e) {}
				// leave Memory false until tower exists or site created
				Memory.roomReadyForExpansion[name] = false;
			}
			// (handled per-room inside loop)
		} catch (e) {
			try { console.log('[expansionManager] ' + e); } catch (e) {}
		}
	}
};

// attempt to dispatch a settler to next candidate room
module.exports.dispatch = function() {
	try {
		Memory.expansion = Memory.expansion || {};
		// if already have a target or spawnQueue has a settler, skip
		if (Memory.expansion.target) return;
		for (const name in Memory.roomReadyForExpansion) {
			if (Memory.roomReadyForExpansion[name] && Memory.roomPlannedCity && Memory.roomPlannedCity[name]) {
				// pick this room as target
				Memory.expansion.target = name;
				// queue a settler
				Memory.spawnQueue = Memory.spawnQueue || [];
				const cfg = require('util.config');
				Memory.spawnQueue.push({ body: cfg.SETTLER_BODY || [CLAIM, MOVE], memory: { role: 'settler', target: name } });
				return;
			}
		}
	} catch (e) { try { console.log('[expansionManager.dispatch] ' + e); } catch (e) {} }
};
