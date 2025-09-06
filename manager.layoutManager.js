// Simple layout planner: when there are no construction sites, try to place an Extension
module.exports = {
	run(room) {
		try {
			if (!room) return;
			const r = typeof room === 'string' ? Game.rooms[room] : room;
			if (!r) return;

			// if there are any my construction sites, don't plan
			const mySites = r.find(FIND_MY_CONSTRUCTION_SITES);
			if (mySites && mySites.length > 0) return;

			// find a spawn to base placement around
			const spawn = r.find(FIND_MY_SPAWNS)[0];
			const center = spawn ? spawn.pos : (r.controller ? r.controller.pos : null);
			if (!center) return;

			// search nearby tiles for a free spot to create an extension
			for (let dx = -3; dx <= 3; dx++) {
				for (let dy = -3; dy <= 3; dy++) {
					const x = center.x + dx;
					const y = center.y + dy;
					if (x < 1 || y < 1 || x > 48 || y > 48) continue;
					const pos = new RoomPosition(x, y, r.name);
					const structures = pos.lookFor(LOOK_STRUCTURES);
					const sites = pos.lookFor(LOOK_CONSTRUCTION_SITES);
					if ((structures && structures.length > 0) || (sites && sites.length > 0)) continue;
					const terrain = pos.lookFor(LOOK_TERRAIN)[0];
					if (terrain === 'wall') continue;
					// try to create an extension site
					const res = r.createConstructionSite(pos, STRUCTURE_EXTENSION);
					if (res === OK) return;
					// otherwise ignore and continue searching
				}
			}
		} catch (e) {
			try { console.log('[layoutManager] error ' + e); } catch (e) {}
		}
	}
};

// plan defense: attempt to place a tower construction site near spawn or controller
module.exports.planDefense = function(room) {
	try {
		if (!room) return ERR_INVALID_ARGS;
		const r = typeof room === 'string' ? Game.rooms[room] : room;
		if (!r) return ERR_NOT_FOUND;

		const spawn = r.find(FIND_MY_SPAWNS)[0];
		const center = spawn ? spawn.pos : (r.controller ? r.controller.pos : null);
		if (!center) return ERR_NOT_FOUND;

		for (let dx = -4; dx <= 4; dx++) {
			for (let dy = -4; dy <= 4; dy++) {
				const x = center.x + dx;
				const y = center.y + dy;
				if (x < 1 || y < 1 || x > 48 || y > 48) continue;
				const pos = new RoomPosition(x, y, r.name);
				const structures = pos.lookFor(LOOK_STRUCTURES);
				const sites = pos.lookFor(LOOK_CONSTRUCTION_SITES);
				if ((structures && structures.length > 0) || (sites && sites.length > 0)) continue;
				const terrain = pos.lookFor(LOOK_TERRAIN)[0];
				if (terrain === 'wall') continue;
				const res = r.createConstructionSite(pos, STRUCTURE_TOWER);
				if (res === OK) return OK;
			}
		}
		return ERR_FULL;
	} catch (e) {
		try { console.log('[layoutManager.planDefense] ' + e); } catch (e) {}
		return ERR_INVALID_ARGS;
	}
};

// planCity: place storage, a few extensions, labs and roads from spawn to controller/sources
module.exports.planCity = function(room) {
	try {
		if (!room) return ERR_INVALID_ARGS;
		const r = typeof room === 'string' ? Game.rooms[room] : room;
		if (!r) return ERR_NOT_FOUND;

		// avoid re-planning if there are many construction sites
		const mySites = r.find(FIND_MY_CONSTRUCTION_SITES);
		if (mySites && mySites.length > 20) return ERR_FULL;

		const spawn = r.find(FIND_MY_SPAWNS)[0];
		const center = spawn ? spawn.pos : (r.controller ? r.controller.pos : null);
		if (!center) return ERR_NOT_FOUND;

		// 1) place storage near spawn if none exists
		const hasStorage = r.find(FIND_MY_STRUCTURES, { filter: s => s.structureType === STRUCTURE_STORAGE }).length > 0;
		if (!hasStorage) {
			for (let dx = -2; dx <= 2; dx++) {
				for (let dy = -2; dy <= 2; dy++) {
					const x = center.x + dx;
					const y = center.y + dy;
					if (x < 1 || y < 1 || x > 48 || y > 48) continue;
					const pos = new RoomPosition(x, y, r.name);
					const structures = pos.lookFor(LOOK_STRUCTURES);
					const sites = pos.lookFor(LOOK_CONSTRUCTION_SITES);
					const terrain = pos.lookFor(LOOK_TERRAIN)[0];
					if ((structures && structures.length > 0) || (sites && sites.length > 0)) continue;
					if (terrain === 'wall') continue;
					const res = r.createConstructionSite(pos, STRUCTURE_STORAGE);
					if (res === OK) return OK;
				}
			}
		}

		// 2) place a number of extensions near spawn (up to 20)
		let placedExt = 0;
		const maxExt = 20;
		for (let dx = -4; dx <= 4 && placedExt < maxExt; dx++) {
			for (let dy = -4; dy <= 4 && placedExt < maxExt; dy++) {
				const x = center.x + dx;
				const y = center.y + dy;
				if (x < 1 || y < 1 || x > 48 || y > 48) continue;
				const pos = new RoomPosition(x, y, r.name);
				const structures = pos.lookFor(LOOK_STRUCTURES);
				const sites = pos.lookFor(LOOK_CONSTRUCTION_SITES);
				const terrain = pos.lookFor(LOOK_TERRAIN)[0];
				if ((structures && structures.length > 0) || (sites && sites.length > 0)) continue;
				if (terrain === 'wall') continue;
				const res = r.createConstructionSite(pos, STRUCTURE_EXTENSION);
				if (res === OK) placedExt++;
			}
		}

		// 3) place up to 4 labs near spawn/storage (if space)
		let placedLabs = 0;
		for (let dx = -5; dx <= 5 && placedLabs < 4; dx++) {
			for (let dy = -5; dy <= 5 && placedLabs < 4; dy++) {
				const x = center.x + dx;
				const y = center.y + dy;
				if (x < 1 || y < 1 || x > 48 || y > 48) continue;
				const pos = new RoomPosition(x, y, r.name);
				const structures = pos.lookFor(LOOK_STRUCTURES);
				const sites = pos.lookFor(LOOK_CONSTRUCTION_SITES);
				const terrain = pos.lookFor(LOOK_TERRAIN)[0];
				if ((structures && structures.length > 0) || (sites && sites.length > 0)) continue;
				if (terrain === 'wall') continue;
				const res = r.createConstructionSite(pos, STRUCTURE_LAB);
				if (res === OK) placedLabs++;
			}
		}

		// 3.5) try to place a link near spawn and near storage for future linking
		try {
			const hasLink = r.find(FIND_MY_STRUCTURES, { filter: s => s.structureType === STRUCTURE_LINK }).length > 0;
			if (!hasLink) {
				const linkTargets = [center];
				const stor = r.find(FIND_MY_STRUCTURES, { filter: s => s.structureType === STRUCTURE_STORAGE })[0];
				if (stor) linkTargets.push(stor.pos);
				for (const lt of linkTargets) {
					for (let dx = -2; dx <= 2; dx++) {
						for (let dy = -2; dy <= 2; dy++) {
							const x = lt.x + dx;
							const y = lt.y + dy;
							if (x < 1 || y < 1 || x > 48 || y > 48) continue;
							const pos = new RoomPosition(x, y, r.name);
							const structures = pos.lookFor(LOOK_STRUCTURES);
							const sites = pos.lookFor(LOOK_CONSTRUCTION_SITES);
							const terrain = pos.lookFor(LOOK_TERRAIN)[0];
							if ((structures && structures.length > 0) || (sites && sites.length > 0)) continue;
							if (terrain === 'wall') continue;
							const res = r.createConstructionSite(pos, STRUCTURE_LINK);
							if (res === OK) { throw 'link_placed'; }
						}
					}
				}
			}
		} catch (e) {}

		// 4) create roads from spawn to controller and to sources
		if (spawn) {
			const targets = [];
			if (r.controller) targets.push(r.controller.pos);
			const sources = r.find(FIND_SOURCES);
			for (const s of sources) targets.push(s.pos);
			for (const tpos of targets) {
				const path = PathFinder.search(spawn.pos, { pos: tpos, range: 1 }, { plainCost: 2, swampCost: 10, maxOps: 2000 }).path;
				for (const step of path) {
					const pos = new RoomPosition(step.x, step.y, r.name);
					const structures = pos.lookFor(LOOK_STRUCTURES);
					const sites = pos.lookFor(LOOK_CONSTRUCTION_SITES);
					if ((structures && structures.length > 0) || (sites && sites.length > 0)) continue;
					const terrain = pos.lookFor(LOOK_TERRAIN)[0];
					if (terrain === 'wall') continue;
					r.createConstructionSite(pos, STRUCTURE_ROAD);
				}
			}
		}

		// 5) attempt to place simple rampart/tower positions near spawn for early defense
		try {
			const towerCount = r.find(FIND_MY_STRUCTURES, { filter: s => s.structureType === STRUCTURE_TOWER }).length;
			if (towerCount < 2) {
				for (let dx = -3; dx <= 3; dx++) {
					for (let dy = -3; dy <= 3; dy++) {
						const x = center.x + dx;
						const y = center.y + dy;
						if (x < 1 || y < 1 || x > 48 || y > 48) continue;
						const pos = new RoomPosition(x, y, r.name);
						const structures = pos.lookFor(LOOK_STRUCTURES);
						const sites = pos.lookFor(LOOK_CONSTRUCTION_SITES);
						const terrain = pos.lookFor(LOOK_TERRAIN)[0];
						if ((structures && structures.length > 0) || (sites && sites.length > 0)) continue;
						if (terrain === 'wall') continue;
						r.createConstructionSite(pos, STRUCTURE_RAMPART);
					}
				}
			}
		} catch (e) {}

		return OK;
	} catch (e) {
		try { console.log('[layoutManager.planCity] ' + e); } catch (e) {}
		return ERR_INVALID_ARGS;
	}
};
