# Synapse Overmind – Screeps 全自動策略框架

[![Strategy](https://img.shields.io/badge/strategy-Synapse%20Overmind-6cf)](#策略名稱與嵌入)
[![Version](https://img.shields.io/badge/version-0.9.8-blue)](#版本)
[![Screeps](https://img.shields.io/badge/screeps-live-green)](https://screeps.com)
[![License](https://img.shields.io/badge/license-Custom-lightgrey)](#授權)
[![Language](https://img.shields.io/badge/lang-%E4%B8%AD%E8%8B%B1%E9%9B%99%E8%AA%9E-orange)](#english-summary-addendum)

> 突觸式主腦：以模組化 Manager + 動態威脅/經濟/交通/佈局驅動，專注「長期穩定 + 擴張節奏 + 防禦彈性」。

作者：HTTP400  

---

## 策略名稱與嵌入
新增 DOWNGRADE 設定 (`util.config.DOWNGRADE`):

- DANGER_TICKS: controller.ticksToDowngrade 小於此視為危險（預設 4000）
- MIN_UPGRADERS: 危險期期望至少有幾名 upgrader

global.STRATEGY_NAME = 'Synapse Overmind';
if (!Memory.strategyName) Memory.strategyName = global.STRATEGY_NAME;
```


Builder 行為變更：

- 當 controller 進入危險期或房內 `upgrader` 數量低於 `util.config.DOWNGRADE.MIN_UPGRADERS` 時，`builder` 在沒有建造/修復工作時會自動擔任 `upgrader`（前往 controller 升級）以防止降階。
- 在危險期或缺乏 upgrader 時，builder 也會在取到少量能量後立刻優先前往 controller 升級，而不是等待填滿負載。
HUD 或 Visual 可引用 `global.STRATEGY_NAME` 統一顯示。

## 功能總覽

- 動態角色生產：miner / hauler / upgrader / builder / repairer / ranger / reserver / remoteMiner / remoteHauler / mineralMiner (RCL6+)
- Miner/Hauler 分離：miner 固定採收 + 自建 container，hauler 集中搬運
- 遠程擴張：旗標 `remote:<房間>:<模式>` (mine/reserve)
- Link 管理：來源 Link 能量轉送控制器 / 中央 Link
- 塔防禦：攻擊 > 治療 > 分階段牆 & rampart 修復
- 牆體漸進：`Memory.defense.wallTarget` 動態提升
- 任務佇列：`taskManager` + `jobManager` 細粒度 build/repair/refill/haulMineral
- 市場：能量 & 礦物自動售出 (EMA 價 + Buffer) (新)
- 路徑快取 + 動態交通加權
- 經濟節流：Storage 能量驅動 conserve/normal/boost
- 威脅偵測：跨房 breakdown + warMode
- 跨房 Intel：hostileCount / energyStored / mineralType (新)
- Remote Suspend：連續敵襲暫停 (新)
- 拆牆預測：WORK 拆除壓力推估 wall 目標 (新)
- 路徑避敵：敵攻範圍高 cost (新)
- MoveSmart：快取 + 卡住修復
- Job 老化優先級 (log2)
- SafeMode 自動觸發
- 建築規劃：道路 / extensions / links / Hub(storage/terminal/labs) / Rampart Ring / Factory / Labs(最多10) / 高流量補路 (新)
- 佈局維護：錯置結構延遲拆除 + 低流量道路精簡 (0.9.8)
- Terminal 能量緩衝 + Refill Job
- 礦物自動化：Extractor / mineralMiner / haulMineral / 枯竭轉職或回收 (新)
- Expansion BFS + Pioneer + 評分
- 跨房能量平衡 (Terminal send) (新)
- ROI 追蹤 + 低 ROI 暫停 (新)
- Ranger Boost Pipeline / 通用 Boost 佇列 / 多礦反應排程 (新)

## 版本

| 版本 | 日期 | 重點 |
|------|------|------|
| 0.1.0 | 初始 | 核心管理器 / 動態威脅分解 / BFS 擴張 / Hub 規劃 / Traffic CostMatrix |
| 0.2.0 | 2025-08-30 | 礦物自動化：Extractor / mineralMiner / haulMineral / 市場礦物出售 |
| 0.3.0 | 2025-08-30 | 跨房 Intel / Remote 暫停恢復 / 拆牆壓力預測 / 路徑避敵 CostMatrix |
| 0.4.0 | 2025-08-30 | Rampart Ring / Hub 防護 / Factory / Labs 擴展 / Container→Link 升級 |
| 0.5.0 | 2025-08-30 | Lab 反應鏈 / Reagent 補給 / Output 回收 / 排程 |
| 0.6.0 | 2025-08-30 | 市場 EMA / 能量自適應賣出 / 價格保護 / ROI 骨架 |
| 0.7.0 | 2025-08-30 | ROI per remote / 低 ROI 暫停 / Ranger Boost 初版 |
| 0.8.0 | 2025-08-30 | 高流量補路 / 跨房能量平衡 / Boost 管線 / ROI 暫停互鎖 |
| 0.8.1 | 2025-08-30 | HUD 礦物再生顯示 / mineralMiner 枯竭行為 |
| 0.9.0 | 2025-08-30 | 通用 Boost Manager / 多層反應鏈 / 部件級需求 |
| 0.9.1 | 2025-08-30 | 物流合併 refillCluster / labSupplyBatch |
| 0.9.2 | 2025-08-30 | ROI energy / mineral 拆分 (roiEnergy) |
| 0.9.3 | 2025-08-30 | 經濟 buildRush / upgradeRush / boost 模式 |
| 0.9.4 | 2025-08-30 | Profiler + HUD KPI 指標 |
| 0.9.5 | 2025-08-30 | 市場主動補貨 BUY_PRICE_CAP |
| 0.9.6 | 2025-08-30 | 自動建設：優先級 + 動態 builder 估算 |
| 0.9.7 | 2025-09-01 | comehere 旗標 + Settler 拓殖 CLAIM 流程 |
| 0.9.8 | 2025-09-03 | 佈局維護：錯置延遲拆除 + 低流量道路精簡 + LAYOUT 參數 |

語義版號：MAJOR.MINOR.PATCH

## 記憶體節點補充

`Memory.intel[room]` / `Memory.remoteDesired[room].suspended` / `Memory.defense.wallTarget`
`layout.ramparts` / `Memory.layoutEval[room].dismantleQueue`

## 新增邏輯摘要 (核心到 0.9.8)

1..22 舊版本說明略 (見舊記錄)
23. 0.9.6 建造優先級 + 動態 builder 目標
24. 0.9.7 comehere 手動拓殖 + Settler
25. 0.9.8 evaluateExisting()：錯置結構延遲拆除 / 低 traffic 道路精簡

### LAYOUT 維護 (0.9.8)

`util.config.LAYOUT`：

- EVALUATE_INTERVAL：幾 tick 評估一次 (150)
- MISPLACED_DISMANTLE_DELAY：排拆等待 (500)
- UNUSED_ROAD_DELTA_THRESHOLD：低使用道路 traffic delta 門檻 (5)
- UNUSED_ROAD_MIN_RCL：啟用道路精簡最低 RCL (5)
- MAX_DISMANTLE_PER_RUN：單次最多 destroy (2)

流程：

1. 組合規劃座標集合 (roads/extensions/links/labs/storage/terminal/factory)。
2. extension/link/lab 不在規劃 → 進 queue 等待延遲後 `destroy()`。
3. 道路不在規劃且 traffic delta < 門檻 → 進 queue (達 RCL 門檻)。
4. spawn/storage/terminal/controller/rampart/wall/tower/source container 永不自拆。
5. 若座標重新規劃即移除 queue。

觀察：`Memory.layoutEval['WxxNyy'].dismantleQueue`
取消拆除：將座標加入 `Memory.layout[room]` 對應清單即可。

### Controller Downgrade Protection

新增 DOWNGRADE 設定 (`util.config.DOWNGRADE`):
- DANGER_TICKS: controller.ticksToDowngrade 小於此視為危險（預設 4000）
- MIN_UPGRADERS: 危險期期望至少有幾名 upgrader

Builder 行為變更：
- 當 controller 進入危險期或全場 upgrader 不足時，`builder` 在沒有建造/修復工作時會自動擔任 `upgrader`（前往 controller 升級）以防止降階。
- 在危險期，builder 也會在取到少量能量後立刻優先前往 controller 升級，而不是等待填滿負載。 

此改動旨在降低 controller 降階風險，特別是在初期或災後復原階段。

## English Summary (Addendum)

Added misplaced structure evaluation & delayed dismantle queue plus low-traffic road pruning (configurable LAYOUT). Continues to provide cross-room intel, adaptive spawning, economic throttling, ROI-based remote suspension, boost pipeline, hub & rampart planning, path caching and threat-aware cost matrices.

## 後續 Roadmap 方向

- Boost Pipeline (Lab 反應基礎已完成，下一步為針對角色注入)
- Remote ROI & 自動撤離與重啟策略 (結合 suspended 資料)
- 進階編隊：ranged kite cluster / guard escort
- 交易動態價格學習 (移動平均+滑動窗)

---

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
manager.labManager.js
manager.roiManager.js
manager.roadManager.js
manager.energyBalanceManager.js
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
  (礦物功能採即時掃描，不新增額外 Memory 節點)

## 自動化邏輯摘要

1. main.js 每 tick 執行 managers → 產生任務/遠程規劃 → 生產 → 角色行為。
2. spawnManager 依 RCL 與遠程需求動態拼接身體 (pattern repeat)；緊急缺工自救。
3. builder / repairer 透過 jobManager.claimJob() 取得建造/修理/補能任務；達成條件後 completeJob。
4. defenseManager 控制塔：攻擊 > 治療 > 修理 (牆體分階段)。
5. linkManager 讓來源 link 高能量時輸出到控制器 / storage link。
6. remoteManager 解析旗標，建立遠程角色目標數；由 spawnManager 生成遠程單位。
7. marketManager 每 100 tick 檢查賣單，依成本挑選高價買單出售能量。
8. 礦物流程：layoutManager 記錄礦物 → RCL6 建 extractor → mineralMiner 採集/建 container → jobManager 產生 haulMineral → hauler 搬運非能源至 storage/terminal。

## 擴充建議 (下一步)

- 將 harvester/hauler 也改由 job 佇列 (refill / withdraw 任務細分)。
- moveTo 改為使用 pathCache.getPath() + creep.memory.cachedPath，提高 CPU 效率。
- 加入 storage energy 閾值控制 upgrader 數量 (經濟模式/壓縮模式)。
- 加入 Lab / Factory / Reaction / Boost 自動化 (礦物基礎完成)。
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

此專案可自由修改、延伸。若公開發布，建議：

1. 移除作者識別 (HTTP400) 或改為團隊名。
2. 增加 CHANGELOG.md 追蹤改動。
3. 使用分支 `develop` 做新功能合併再推 `main`。


---

\n## 命名補充：Synapse Overmind
Synapse (突觸) 象徵多 Manager 之間高頻訊號交換；Overmind 意指統御層決策協調經濟 / 軍事 / 擴張。名稱旨在突出「訊號驅動 + 模組協奏」的結構哲學。

如需改名，可直接全域搜 `Synapse Overmind` 替換。
