# Synapse Overmind – Screeps 全自動策略框架

[![Strategy](https://img.shields.io/badge/strategy-Synapse%20Overmind-6cf)](#策略名稱與嵌入)
[![Version](https://img.shields.io/badge/version-0.1.0-blue)](#版本)
[![Screeps](https://img.shields.io/badge/screeps-live-green)](https://screeps.com)
[![License](https://img.shields.io/badge/license-Custom-lightgrey)](#授權)
[![Language](https://img.shields.io/badge/lang-%E4%B8%AD%E8%8B%B1%E9%9B%99%E8%AA%9E-orange)](#english-overview)

> 突觸式主腦：以模組化 Manager + 動態威脅/經濟/交通/佈局驅動，專注「長期穩定 + 擴張節奏 + 防禦彈性」。

作者標識：HTTP400 (可自行替換)

---

## 策略名稱與嵌入

建議在 `main.js` 最上方加入：

```js
global.STRATEGY_NAME = 'Synapse Overmind';
if (!Memory.strategyName) Memory.strategyName = global.STRATEGY_NAME;
```

HUD 或 Visual 可引用 `global.STRATEGY_NAME` 統一顯示。

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

## 版本

| 版本 | 日期 | 重點 |
|------|------|------|
| 0.1.0 | 初始 | 核心管理器 / 動態威脅分解 / BFS 擴張 / Hub 規劃 / Traffic CostMatrix |

語義版號預計：MAJOR(破壞性).MINOR(功能) .PATCH(修補)。現階段仍屬快速迭代原型，API 未凍結。

## 功能分類速覽

經濟 / 生產

- 動態角色生產、經濟節流 (模式倍率)、Terminal 能量緩衝與補能 job、Market 高價出售
- Miner/Hauler 分離，遠程礦鏈 (remoteMiner / remoteHauler / reserver)

建造 / 佈局 / 路徑

- 建築規劃 layoutManager：道路 / extension / link + Hub v2 (storage / terminal / labs)
- 路徑快取 + CostMatrix 動態交通加權 + moveSmart 卡住檢測

任務 / 排程

- 任務統計 taskManager → jobManager 細粒度工作 (build / repair / refill / refillTerminal)
- 工作老化 + 動態優先級 (log2 boost) 防餓死

防禦 / 威脅 / 作戰

- 塔防：攻擊 > 治療 > 分階段牆/堡維護 + 動態 wallTarget Boost
- Threat 分解 (heal/ranged/melee/dismantle/siege) + warMode 閾值
- Ranger：風箏 (flee) + 集火優先次序 (受傷 healer > healer > ranged > melee)
- SafeMode 自動啟動條件（spawn 受損 + 塔能低 + 敵襲）

擴張 / 規模化

- 遠程旗標 `remote:<room>:<mode>` + 自動角色目標聚合
- Expansion BFS 掃描 + 評分 + 自動旗標 + Pioneer 先遣

維運 / 視覺

- HUD：能量/模式/威脅顯示；CPU & bucket 週期紀錄
- 記憶體清理 / wallTarget 漸進 / 交通統計衰減

## English Overview

High‑level automated Screeps framework focusing on adaptive economy, layered defense, expansion pacing and low CPU path infrastructure.

Core Highlights

- Dynamic spawning & economy throttling (conserve / normal / boost)
- Job queue with aging + logarithmic priority inflation
- Remote operations (mining / reservation) with aggregated targets
- Layout & Hub planner (roads, extensions, links, storage, terminal, labs)
- Cached paths + adaptive CostMatrix (roads + congestion heat)
- Threat breakdown (heal / ranged / melee / dismantle / siege) → warMode switch
- Ranger micro: flee kiting + healer focus fire ordering
- Auto SafeMode trigger (spawn damage + low tower energy + hostiles)
- Expansion BFS scan + scoring + auto flag + pioneer bootstrap
- Terminal energy band buffering + market sell logic

Modules Summary

- spawn / defense / link / task / job / remote / pathCache / market / economy / threat / hud / layout / costMatrix / terminal / expansion

Planned Roadmap (next)

- Lab reaction scheduler & boost provisioning
- Multi-room energy balancing via terminal trade
- Advanced combat formations & target clustering
- Remote ROI tracking & auto decommission
- Full cost matrix persistence across shards (optional compression)

Naming
Synapse Overmind underscores modular managers acting like neural synapses feeding a central orchestration layer.

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

此專案可自由修改、延伸。若公開發布，建議：

1. 移除作者識別 (HTTP400) 或改為團隊名。
2. 增加 CHANGELOG.md 追蹤改動。
3. 使用分支 `develop` 做新功能合併再推 `main`。


---

\n## 命名補充：Synapse Overmind
Synapse (突觸) 象徵多 Manager 之間高頻訊號交換；Overmind 意指統御層決策協調經濟 / 軍事 / 擴張。名稱旨在突出「訊號驅動 + 模組協奏」的結構哲學。

如需改名，可直接全域搜 `Synapse Overmind` 替換。
