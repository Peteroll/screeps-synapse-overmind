// Helper for creeps to request boost
// Usage: require('util.boost').request(creep, { minerals:['XKHO2'] });
module.exports.request = function(creep, opt) {
    if (creep.memory.boosted) return false;
    if (!opt || !opt.minerals || !opt.minerals.length) return false;
    creep.memory.boostRequest = { minerals: opt.minerals };
    return true;
};