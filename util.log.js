const config = require('util.config');

function _log(level, msg) {
    if (level === 'DEBUG' && !config.DEBUG) return;
    console.log(`[${level}] ${msg}`);
}
module.exports = {
    debug: (m) => _log('DEBUG', m),
    info: (m) => _log('INFO', m),
    warn: (m) => _log('WARN', m),
    error: (m) => _log('ERROR', m)
};
