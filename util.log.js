const config = require('util.config');

function _log(level, msg) {
    if (level === 'DEBUG' && !config.DEBUG) return;
    console.log(`[${level}] ${msg}`);
}
module.exports = { info: function(){}, warn: function(){}, debug: function(){}, error: function(){} };
