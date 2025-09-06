const config = require('util.config');

function _log(level, msg) {
    try {
        if (level === 'DEBUG' && !config.DEBUG) return;
        console.log(`[${level}] ${msg}`);
    } catch (e) {
        // swallow
    }
}

module.exports = {
    info: (msg) => _log('INFO', msg),
    warn: (msg) => _log('WARN', msg),
    debug: (msg) => _log('DEBUG', msg),
    error: (msg) => {
        _log('ERROR', msg);
        try { if (config.NOTIFY_ON_ERROR && Game && Game.notify) Game.notify(msg); } catch(e) {}
    }
};
