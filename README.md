# Screeps 自動化程式 (HTTP400)

## 功能總覽
- 動態角色生產：miner / hauler / upgrader / builder / repairer / ranger / reserver / remoteMiner / remoteHauler
- Miner/Hauler 分離：miner 固定採收 + 自建 container，hauler 集中搬運
- 遠程擴張：旗標 `remote:<房間>:<模式>` (模式: `mine` 或 `reserve`) 啟用遠程配置
- Link 管理：來源 Link 能量轉送至控制器 / 中央 Link
- 塔防禦：攻擊 > 治療 > 分階段牆 & rampart 修復
- 牆體漸進：`Memory.defense.wallTarget` 週期提升，減少能源浪費
- 任務統計與工作佇列：`taskManager` 生成房間統計，`jobManager` 產生細粒度工作 (build/repair/refill)
- Builder / Repairer 已整合 job 佇列 (會 claim/completion)
- 市場：高價出售多餘能量 (terminal 能量 > 20k 時)
- 路徑快取：`manager.pathCache` 底層提供序列化路徑 (尚未全面替換 moveTo，可後續擴充)
- 遠程角色：自動指派目標房間 (依旗標與 Memory.remotes)
- 經濟節流：economyManager 依 Storage 能量調整角色比例 (conserve/normal/boost)
- 威脅偵測：threatManager 計算敵方威脅分數，自動切換 warMode
- warMode：提高 ranger/repairer/hauler 目標，HUD 顯示 WAR
- HUD：房間左上顯示能量庫存 / 模式 / 威脅值
- 移動優化：覆寫 moveTo 為 moveSmart，具有路徑快取與卡住檢測
- 工作老化：job 會逐 tick age，動態提升優先權避免長期飢餓
- SafeMode 自動觸發：偵測敵襲 + spawn 掉血 + 塔能不足時啟用
- 建築規劃：layoutManager 依 RCL 產生道路 / extension / link 佈局並限速放 site
- CostMatrix 快取：預建房間移動權重，moveSmart 單房搜尋優先使用
- 動態交通加權：記錄高流量格提高 cost，PathFinder 避擁擠
- Terminal 能量緩衝：維持 terminal 能量區間並賣出過量
- Terminal 補能工作：hauler 透過 refillTerminal job 補足 terminal 能量
- 擴張評分：expansionManager 週期評估候選房 (示意版)
- 擴張掃描優化：BFS 多層房間探索收集候選
- 動態防禦強化：敵人來襲時臨時提升 wallTarget；主動記錄敵方火力檔案
- Ranger 風箏：近距離自動後退嘗試保持距離
- Ranger 進階風箏：PathFinder flee 半徑拉開
- Ranger 集火：優先受傷 healer > healer > ranged > melee
- Threat 分解：heal/ranged/melee/dismantle/siege 細項 + 雙閾值切換 warMode
- Hub 佈局 v2：spawn 周邊自動規劃 storage / terminal / labs 放置
- 擴張自動旗標 + 先遣 pioneer 角色生成

## 目錄結構

```text
main.js
util.config.js / util.log.js
manager.spawnManager.js
manager.defenseManager.js
manager.linkManager.js
manager.taskManager.js
manager.jobManager.js
manager.remoteManager.js
manager.pathCache.js
manager.marketManager.js
manager.economyManager.js
manager.threatManager.js
manager.hudManager.js
util.movement.js
manager.layoutManager.js
manager.costMatrix.js
manager.terminalManager.js
manager.expansionManager.js
role.*.js (各角色行為)
```

## 旗標使用

放置旗標名稱：`remote:W1N1:mine`
 
- 會在 Memory.remotes 建立對應遠程設定：需要 reserver / remoteMiner / remoteHauler。
- 模式 `reserve` 僅預定控制器；`mine` 代表採收與搬運。

## 記憶體 (Memory) 關鍵節點

- `Memory.defense.wallTarget`：當前牆壁/防護目標生命值門檻。
- `Memory.jobs.queue`：工作佇列 (job)。
- `room.memory.tasks`：房間統計 (建造數、修理數、塔補給需求)。
- `Memory.remotes`：遠程房間設定。
- `Memory.remoteDesired`：聚合遠程角色目標供 spawn manager 使用。
- `Memory.pathCache`：路徑快取資料。


## 自動化邏輯摘要

1. main.js 每 tick 執行 managers → 產生任務/遠程規劃 → 生產 → 角色行為。
2. spawnManager 依 RCL 與遠程需求動態拼接身體 (pattern repeat)；緊急缺工自救。
3. builder / repairer 透過 jobManager.claimJob() 取得建造/修理/補能任務；達成條件後 completeJob。
4. defenseManager 控制塔：攻擊 > 治療 > 修理 (牆體分階段)。
5. linkManager 讓來源 link 高能量時輸出到控制器 / storage link。
6. remoteManager 解析旗標，建立遠程角色目標數；由 spawnManager 生成遠程單位。
7. marketManager 每 100 tick 檢查賣單，依成本挑選高價買單出售能量。


## 擴充建議 (下一步)

- 將 harvester/hauler 也改由 job 佇列 (refill / withdraw 任務細分)。
- moveTo 改為使用 pathCache.getPath() + creep.memory.cachedPath，提高 CPU 效率。
- 加入 storage energy 閾值控制 upgrader 數量 (經濟模式/壓縮模式)。
- 增加 Lab / Factory / Mineral 管理 (RCL6+)。
- 加入戰爭模式 (敵人威脅時暫停市場與部分建造)。


## 簡易除錯指令 (Console)

```js
// 查看工作數
Memory.jobs.queue.length
// 重置牆目標
Memory.defense.wallTarget = 5000
// 查看遠程設定
Memory.remotes
```


## 安全注意

- 市場策略簡化，若需更進階請加入最小單價與 resource 白名單判斷。
- 遠程房間未加入敵人避讓與撤退判斷，可再擴充。

## 授權

此代碼可自由修改、延伸，請依個人需要調整。
