# Screeps Minimal Starter

這個 repository 是一個簡化的 Screeps 策略範例，目標是快速穩定把房間 RCL 升到高等級，同時逐步建立安全與城市化的基礎設施。

主要特色

- 使用簡單的 role 與 manager 分工（miner/hauler/builder/upgrader + 多個 manager）
- Builder 會優先為 sources 建立 container（避免 miner 卡住）
- Upgrader 使用 memory.working 狀態，只有在裝滿能量時才優先升級
- Miner 在找不到儲存目標時會協助升級 controller
- 簡易的 layout 與 expansion manager：達到 RCL8 後規劃防禦與城市

如何使用

1. 把整個資料夾上傳到你的 Screeps 腳本空間（或使用 Screeps 的 CLI/IDE）。
2. 在遊戲中觀察 console 日誌、Memory 與控制台顯示的建造工地。
3. 調整 spawn 策略（`manager.spawnManager`）以增加 builder/hauler 數量以加速建造。

檔案與模組說明（重點）

- `main.js`：主迴圈與 housekeeping。會呼叫 `manager.expansionManager.run()`。
- `role.miner.js`：採礦行為。若無可交付儲存設施，會在靠近 controller 時協助升級。
- `role.builder.js`：建造者。工作階段會先檢查 source 附近是否需要 container，優先放置並建造 container site；支援全域強制 container 建造旗標 `Memory.forceContainerBuildUntil`。
- `role.upgrader.js`：升級者。使用 `creep.memory.working` 狀態，會等待裝滿後再升級；若沒有能量來源，允許用現有能量升級以避免卡死。
- `manager.layoutManager.js`：簡易規劃器，提供 `run()`, `planDefense(room)`, `planCity(room)`。
- `manager.expansionManager.js`：負責偵測 RCL 與觸發防禦/城市規劃，並以 `Memory.roomReadyForExpansion` / `Memory.roomPlannedCity` 管理狀態。

最近變更摘要

- 修復 upgrader 在未滿載時就開始升級的問題（改用 memory.working）。
- Builder 現在優先為 sources 建立 container 並可短期強制 builders 專注完成 containers。
- Miner 在無地方放能量時會協助升級 RC 而非一直停在 source 上撞牆。
- 新增簡易的防禦與城市規劃器：會在 RCL8 時放置 tower / storage / extensions / labs / roads 的建造工地。
- 修正 expansionManager 的 scope 錯誤並把相關 Memory 鍵加入 housekeeping 保留清單。
- 擴展 `manager.layoutManager.planCity`：更多 extensions、links、labs、roads 的規劃，並嘗試放置 rampart/tower 的基礎位置以利後續防守。
- 新增自動擴張 dispatch：當房間準備好並完成城市規劃時，`manager.expansionManager.dispatch()` 會將擴張 settler 放入 `Memory.spawnQueue`。
- 把 `forceContainerBuildUntil` 的時長移到 `util.config.js`（`FORCE_CONTAINER_BUILD_TICKS`）可調整。

除錯與觀察

- 日誌位置：遊戲內 console（會有 `[builder]`、`[housekeeping]`、`[expansionManager]` 等訊息）。
- 建議先觀察幾個 tick，確認 container 工地能被建立並由 builder 建造完成。

後續建議

- 把 `Memory` 中的參數（如 `forceContainerBuildUntil` 的持續時間）移到 `util.config.js` 以便調整。
- 擴展 `manager.layoutManager.planCity` 以規劃更完整的城市佈局（roads/links/labs/storages 的最佳位置）。

若要我：

- 把 `forceContainerBuildUntil` 移到 `util.config.js`（我可以自動修改），或
- 實作更完整的城市規劃器（需要更多設計決策），

請回覆你要的選項號碼或指示。
