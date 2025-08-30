// 包裝 creep.moveTo 加入路徑快取 + 卡住檢測
const pathCache = require('manager.pathCache');
const costMatrixManager = require('manager.costMatrix');

if (!Creep.prototype._moveOriginal) {
    Creep.prototype._moveOriginal = Creep.prototype.moveTo;
    Creep.prototype.moveSmart = function(target, opts) {
        if (!this.memory._lastPos) this.memory._lastPos = {x:this.pos.x,y:this.pos.y,t:Game.time};
        else if (this.pos.x === this.memory._lastPos.x && this.pos.y === this.memory._lastPos.y) {
            if (Game.time - this.memory._lastPos.t >= 2) {
                // 卡住 → 清除快取路徑
                delete this.memory._cachedPathKey;
            }
        } else {
            this.memory._lastPos = {x:this.pos.x,y:this.pos.y,t:Game.time};
        }
        let pos = target.pos || target;
        // 快取路徑 key
        if (!this.memory._cachedPathKey || Game.time % 50 === 0) {
            // 嘗試使用 costMatrix 對單房間路徑優化
            let path = [];
            if (this.pos.roomName === pos.roomName) {
                const cm = costMatrixManager.get(this.pos.roomName);
                if (cm) {
                    const ret = PathFinder.search(this.pos, {pos:pos, range:1}, {
                        plainCost:2, swampCost:5,
                        roomCallback: () => cm
                    });
                    path = ret.path;
                } else {
                    path = pathCache.getPath(this.pos, pos) || [];
                }
            } else {
                path = pathCache.getPath(this.pos, pos) || [];
            }
            if (Array.isArray(path) && path.length) {
                this.memory._cachedPath = path.map(p => [p.x, p.y]);
                this.memory._cachedPathKey = Game.time + '_' + this.name;
            } else {
                delete this.memory._cachedPath;
            }
        }
        if (this.memory._cachedPath && this.memory._cachedPath.length) {
            const step = this.memory._cachedPath[0];
            if (this.pos.x === step[0] && this.pos.y === step[1]) {
                this.memory._cachedPath.shift();
            }
            if (this.memory._cachedPath.length) {
                const next = this.memory._cachedPath[0];
                this.move(this.pos.getDirectionTo(next[0], next[1]));
                return OK;
            }
        }
        return this._moveOriginal(target, opts);
    };
}

// 兼容：替換全局使用 moveTo 呼叫為 moveSmart (可逐步在角色檔改造)
Creep.prototype.moveTo = function(target, opts) {
    return this.moveSmart(target, opts);
};
