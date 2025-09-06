module.exports = {
    run(creep) {
        if (creep.memory.working === undefined) creep.memory.working = false;
        if (creep.memory.working && creep.store[RESOURCE_ENERGY] === 0) {
            creep.memory.working = false;
        } else if (!creep.memory.working && creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
            creep.memory.working = true;
        }

        if (!creep.memory.working) {
            // gather
            const cont = creep.pos.findClosestByPath(FIND_STRUCTURES, { filter: s => (s.structureType === STRUCTURE_CONTAINER || s.structureType === STRUCTURE_STORAGE) && s.store && s.store[RESOURCE_ENERGY] > 50 });
            if (cont) { if (creep.withdraw(cont, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) creep.moveTo(cont); return; }

            const drop = creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES, { filter: r => r.resourceType === RESOURCE_ENERGY && r.amount > 20 });
            if (drop) { if (creep.pickup(drop) === ERR_NOT_IN_RANGE) creep.moveTo(drop); return; }

            const src = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
            if (src) { if (creep.harvest(src) === ERR_NOT_IN_RANGE) creep.moveTo(src); return; }

            return;
        }

        // work: prioritize building containers next to sources if missing
        // if any source lacks a container, set a global timer to force builders to focus on containers
        const sources = creep.room.find(FIND_SOURCES);
        let missing = 0;
        for (const s of sources) {
            // check for nearby container or site within 1 tile
            const nearby = s.pos.findInRange(FIND_STRUCTURES, 1, { filter: st => st.structureType === STRUCTURE_CONTAINER });
            const siteNear = s.pos.findInRange(FIND_CONSTRUCTION_SITES, 1, { filter: st => st.structureType === STRUCTURE_CONTAINER });
            if (!nearby || nearby.length === 0) {
                missing++;
                // set global force flag for a short period so other builders prioritize containers
                try {
                    const cfg = require('util.config');
                    const dur = cfg.FORCE_CONTAINER_BUILD_TICKS || 500;
                    if (!Memory.forceContainerBuildUntil || Memory.forceContainerBuildUntil < Game.time) Memory.forceContainerBuildUntil = Game.time + dur;
                } catch (e) {}
                // try to create a container site at an adjacent free tile
                if (siteNear && siteNear.length > 0) {
                    // there is a container site; build it
                    const contSite = siteNear[0];
                    try { require('util.log').info(`[builder] ${creep.name} building container site ${contSite.id} at ${contSite.pos}`); } catch(e) {}
                    if (creep.build(contSite) === ERR_NOT_IN_RANGE) creep.moveTo(contSite);
                    return;
                }
                // try to place a site adjacent to source
                for (let dx = -1; dx <= 1; dx++) {
                    for (let dy = -1; dy <= 1; dy++) {
                        if (dx === 0 && dy === 0) continue;
                        const x = s.pos.x + dx;
                        const y = s.pos.y + dy;
                        if (x < 1 || y < 1 || x > 48 || y > 48) continue;
                        const pos = new RoomPosition(x, y, creep.room.name);
                        const structures = pos.lookFor(LOOK_STRUCTURES);
                        const sites = pos.lookFor(LOOK_CONSTRUCTION_SITES);
                        const terrain = pos.lookFor(LOOK_TERRAIN)[0];
                        if ((structures && structures.length > 0) || (sites && sites.length > 0)) continue;
                        if (terrain === 'wall') continue;
                        const res = creep.room.createConstructionSite(pos, STRUCTURE_CONTAINER);
                        if (res === OK) {
                            try { require('util.log').info(`[builder] ${creep.name} placed container site at ${pos}`); } catch(e) {}
                            return;
                        }
                    }
                }
            }
        }
        // if force flag active, only build container construction sites (if any)
        const forced = (Memory.forceContainerBuildUntil && Memory.forceContainerBuildUntil > Game.time);
        if (forced) {
            const containerSite = creep.pos.findClosestByPath(FIND_CONSTRUCTION_SITES, { filter: s => s.structureType === STRUCTURE_CONTAINER });
            if (containerSite) {
                try { require('util.log').info(`[builder] ${creep.name} building container site ${containerSite.id} at ${containerSite.pos}`); } catch(e) {}
                if (creep.build(containerSite) === ERR_NOT_IN_RANGE) creep.moveTo(containerSite);
                return;
            }
            // no container sites to build, wait until flag expires
            return;
        }

        // if no source container tasks, build nearest existing construction site
        const site = creep.pos.findClosestByPath(FIND_CONSTRUCTION_SITES);
        if (site) {
            try { require('util.log').info(`[builder] ${creep.name} building site ${site.id} at ${site.pos}`); } catch(e) {}
            if (creep.build(site) === ERR_NOT_IN_RANGE) creep.moveTo(site);
            return;
        }

        // no construction sites -> request a new plan
        try { require('manager.layoutManager').run(creep.room); } catch (e) {}

        if (creep.room.controller) {
            if (creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) creep.moveTo(creep.room.controller);
        }
    }
};
// 移除 jobManager 依賴

// ...existing code...
