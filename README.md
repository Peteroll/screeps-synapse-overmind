# Synapse Overmind – Screeps 全自動策略框架

[![Strategy](https://img.shields.io/badge/strategy-Synapse%20Overmind-6cf)](#策略名稱與嵌入)
[![Version](https://img.shields.io/badge/version-0.9.0-blue)](#版本)
[![Screeps](https://img.shields.io/badge/screeps-live-green)](https://screeps.com)
[![License](https://img.shields.io/badge/license-Custom-lightgrey)](#授權)
[![Language](https://img.shields.io/badge/lang-%E4%B8%AD%E8%8B%B1%E9%9B%99%E8%AA%9E-orange)](#english-summary-new-features-addendum)

> 突觸式主腦：以模組化 Manager + 動態威脅/經濟/交通/佈局驅動，專注「長期穩定 + 擴張節奏 + 防禦彈性」。

作者：HTTP400  

---

## 策略名稱與嵌入

建議在 `main.js` 最上方加入：

```js
global.STRATEGY_NAME = 'Synapse Overmind';
if (!Memory.strategyName) Memory.strategyName = global.STRATEGY_NAME;
```

HUD 或 Visual 可引用 `global.STRATEGY_NAME` 統一顯示。

## 功能總覽

- 動態角色生產：miner / hauler / upgrader / builder / repairer / ranger / reserver / remoteMiner / remoteHauler / mineralMiner (RCL6+)
- Miner/Hauler 分離：miner 固定採收 + 自建 container，hauler 集中搬運
- 遠程擴張：旗標 `remote:<房間>:<模式>` (mine/reserve) 啟用遠程配置
- Link 管理：來源 Link 能量轉送至控制器 / 中央 Link
- 塔防禦：攻擊 > 治療 > 分階段牆 & rampart 修復
- 牆體漸進：`Memory.defense.wallTarget` 週期提升
- 任務佇列：`taskManager` 房間統計，`jobManager` 細粒度工作 (build/repair/refill/refillTerminal/haulMineral)
- 市場：能量與多餘礦物自動售出 (價格/Buffer + EMA 動態閾值) (新)
- 路徑快取 + 動態交通加權
- 遠程角色聚合目標 & 自動調整
- 經濟節流：Storage 能量驅動 conserve/normal/boost
- 威脅偵測：跨房 threat breakdown + warMode
- 跨房 Intel：記錄 hostileCount / energyStored / mineralType (新)
- Remote 安全：連續敵襲自動 Suspend，安全期滿恢復 (新)
- 拆牆預測：依敵方 WORK 計算目標壁量 (新)
- 路徑避敵：敵方攻擊半徑注入高 Cost (新)
- warMode 加強：提高 ranger/repairer/hauler
- MoveSmart：路徑快取 + 卡住檢測
- Job 老化優先級 (log2 boost)
- SafeMode 自動觸發 (條件複合)
- 建築規劃：道路 / extensions / links / Hub(storage/terminal/labs) / Rampart Ring / Factory / Labs 10 座擴展 / 高流量自動補路 (新)
- Terminal 能量緩衝 + Refill Job
- 礦物自動化：Extractor / mineralMiner / haulMineral / 枯竭轉職或回收 (新)
- Expansion BFS 掃描 + 評分 + 自動旗標 + Pioneer
- 跨房能量平衡 (Terminal send) (新)
- ROI 追蹤 (遠程收益/成本 + 低 ROI 自動暫停) (新)
- Ranger Boost Pipeline → 通用 Boost 佇列 / 多礦反應排程 / 部件精準需求 (新)

## 版本

| 版本 | 日期 | 重點 |
|------|------|------|
| 0.1.0 | 初始 | 核心管理器 / 動態威脅分解 / BFS 擴張 / Hub 規劃 / Traffic CostMatrix |
| 0.2.0 | 2025-08-30 | 礦物自動化：Extractor / mineralMiner / haulMineral / 市場礦物出售 |
| 0.3.0 | 2025-08-30 | 跨房 Intel / Remote 暫停恢復 / 拆牆壓力預測 / 路徑避敵 CostMatrix |
| 0.4.0 | 2025-08-30 | Rampart Ring / Hub 重要結構保護 Ramparts / Factory 佈局 / Labs 擴展 (最多10) / Container→Link 自動升級 |
| 0.5.0 | 2025-08-30 | 基礎 Lab 反應鏈 / Reagent 補給任務 / Output 回收任務 / Lab 擴展調度 |
| 0.6.0 | 2025-08-30 | 動態市場 EMA 價採樣 / 能量自適應賣出量 / 礦物平均價保護 / ROI 追蹤骨架 |
| 0.7.0 | 2025-08-30 | ROI 每遠程收益/成本細化 & 低 ROI 自動暫停 / Ranger 基礎 Boost 流程 |
| 0.8.0 | 2025-08-30 | 高流量道路自動補建 / 跨房能量平衡 / Boost 管線整合 / ROI 與遠程暫停互鎖 |
| 0.8.1 | 2025-08-30 | HUD 礦物剩餘/再生顯示 / mineralMiner 枯竭轉職或回收 |
| 0.9.0 | 2025-08-30 | 通用 Boost Manager / 多層反應鏈排程 / labUnload 卸載 / 部件級需求估算 |
| 0.9.1 | 2025-08-30 | 物流合併：refillCluster 多結構補能 / labSupplyBatch 批次補給 (降低往返) |
| 0.9.2 | 2025-08-30 | ROI 精細化：Energy / Mineral 拆分 roiEnergy 指標 |
| 0.9.3 | 2025-08-30 | 經濟多維：buildRush / upgradeRush / boost 模式動態倍率 |
| 0.9.4 | 2025-08-30 | Profiler + HUD KPI (harvestRate / upgradeRate / haulerIdle% / marketRev1k) |
| 0.9.5 | 2025-08-30 | 市場主動補貨 (需求缺口 <50% 自動買入) |

語義版號：MAJOR.MINOR.PATCH（現階段 API 未凍結）。

## 功能分類速覽

經濟 / 生產

- 動態角色生產、經濟節流、Terminal 緩衝、Market 能量 & 礦物出售
- 礦物鏈：mineralMiner + haulMineral + Buffer 價格條件

建造 / 佈局 / 路徑

- layoutManager：道路/extension/link/Hub/Rampart Ring/Factory/Lab 擴展 (新)
- CostMatrix：道路=1 + 交通熱度 + 敵域避讓 (新)
- moveSmart：快取與卡住修正

任務 / 排程

- jobManager：build / repair / refill / refillTerminal / haulMineral + 老化提升

防禦 / 威脅

- threatManager：heal/ranged/melee/dismantle/siege 分解 + warMode
- Intel (新)：跨房 hostileCount / energyStored / mineralType
- Remote Suspend (新)：敵連續出現暫停遠程派遣
- 拆牆預測 (新)：WORK 拆除輸出推估 wallTarget
- 塔：攻擊>治療>漸進修牆；敵時 wallTarget 提升
- SafeMode 自動化

擴張

- 遠程旗標 + 聚合目標 + 自動 Suspend/Resume
- Expansion BFS + 評分 + pioneer 引導

維運 / 可視化

- HUD 顯示模式/威脅/能量/礦物(剩餘或再生倒數) / 平滑 CPU / 版本 (新)
- pathCache / traffic heat 衰減
- Hostile Profile 記錄最大攻擊輸出


## English Summary (New Features Addendum)

Added cross-room intel (hostileCount, energyStored, mineralType), remote suspension on sustained hostiles, predictive wall HP scaling based on enemy WORK dismantle DPS, hostile zone path avoidance injected into CostMatrix, plus automated rampart ring, protected core (storage/terminal/factory/labs) ramparts, factory placement, lab expansion up to 10 labs, and container to link upgrade removal.

## 記憶體節點補充

`Memory.intel[room]`：跨房情報  
`Memory.remoteDesired[room].suspended`：遠程暫停狀態  
`Memory.defense.wallTarget`：當前牆/堡目標 hits
`layout.ramparts`：規劃的環型防禦座標 (cache 於 Memory.roomLayout)

## 新增邏輯摘要 (0.3.0 ~ 0.9.5)

1. threatManager 更新 intel 並維護總威脅
2. remoteManager 依 intel 將遠程房間 suspended= true/false
3. defenseManager 基於敵方 WORK 計算拆除壓力 → 提升 wallTarget
4. costMatrix 加入敵方攻擊半徑高 cost 區域
5. (0.4.0) layoutManager 產生 rampart ring + hub 擴展 labs / factory
6. (0.4.0) placeSites() 自動放置 ramparts 與 factory；核心結構套 rampart；source container 低載且附近有 link 時移除 (升級)
7. (0.5.0) labManager：自動分類 Reagent/Output、補給 reagent、runReaction、輸出回收任務
8. (0.6.0) 市場 EMA 採樣 + 能量價格動態下限(EMA*0.95) + 自適應賣出量
9. (0.6.0) 礦物賣出：近10筆平均價 *0.9 以下不賣，避免低谷拋售
10. (0.6.0) ROI manager 基礎收益/成本聚合 (後續細化至每遠程房)
11. (0.7.0) ROI 細化 per remote + 低 ROI >1500 tick 自動標記 suspended
12. (0.7.0) Ranger boost：若 lab 有 PRIMARY_REACTION 自動靠近並 boost
13. (0.8.0) roadManager：traffic 門檻自動放置道路 / repair 交給既有 job 流程
14. (0.8.0) energyBalanceManager：富餘 → 匱乏 房 Terminal 自動能量送貨
15. (0.8.0) ROI 與 remoteManager：低 ROI 長期標記 suspended
16. (0.8.1) HUD mineral 剩餘量/再生倒數；mineral 枯竭後 mineralMiner >300 TTL 轉 upgrader 否則 recycle
17. (0.9.0) Boost 一般化：自動角色請求 / 反應圖遞迴排程 / labUnload 卸載異種 / 部件級需求推估 / 達需求動態切換
18. (0.9.1) 物流合併：refillCluster / labSupplyBatch 減少往返
19. (0.9.2) ROI 拆分 energy / mineral 收益 (roiEnergy)
20. (0.9.3) 經濟多維模式：buildRush / upgradeRush / boost
21. (0.9.4) Profiler + HUD KPI 指標
22. (0.9.5) 市場主動補貨 BUY_PRICE_CAP 控制成本

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
