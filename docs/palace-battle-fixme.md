# 皇宫决战 · 需求与待修复清单（魔道争锋 · 第四幕）

> **给「修复皇宫问题」的 agent：先读这份。**
> 这里记录了用户对皇宫决战（增量H）的完整需求、首版（PR #55）做了什么、以及
> 用户明确指出的**做错 / 不到位**的地方和可执行的修复方向。改完请同步勾掉「验收标准」。
>
> 关联：**PR #55**（增量H 首版——已生成美术 + 接入正经流程，但存在下列待修问题；用户要求先把
> 这份文档推上去，问题留给后续修复）。

---

## 1. 用户原始需求（背景）

- **方案②「真皇宫」**：生成皇宫背景图 + 人物立绘，**接入游戏正经流程**（不只是录制用的 demo 入口）。
- 三场战斗（魔道争锋第四幕，真实剧情可达节点）：
  - `startSantuanFight`（开幕 · **三组对位群架**）— story.js `santuan_fight`(1932)
  - `startTuoshiFight`（拖时布阵 · survive 拖满回合）— story.js `tuoshi_fight`(2077)
  - `startXuwangFight`（阵成决战 · 万象星河高潮 · 二阶段假丹 boss）— story.js `xuwang_final_fight`(2099)
- 最终目的是**剪一条竖屏宣传片**：14 Pro Max 竖屏、卡王铮亮《不凡》副歌「这一路破空」，
  燃点 = **雷电 + 飞控 + 战场拉大 + 群战**。
- 录制入口 `?demo=palace`（`&climax=1` 直进万象星河高潮）。

## 2. 首版（PR #55）已完成

- **5 张美术**（走 `scripts/genart.js` 同款画风生成）：
  - `assets/scenes/huanggong.png`（皇城宫门夜战底图）
  - `assets/battlers/bt_liujing.png` / `bt_songmeng.png` / `bt_zhongweiniang.png` / `bt_xueshi.png`
- **接线**：`art.js` 注册场景 + 4 立绘、`ASSET_VER` 24→25；`engine.js` 三场战斗 `_combatMeta`
  挂 `sceneBg:"huanggong"`；`ui.js` `_battlerByName` 增 `[/血侍/,"bt_xueshi"]`；`main.js` 加 `?demo=palace`。
- `build` 168→169；`test/run.js` + `test/journey.test.js` + `test/combat.test.js` 全过。

---

## 3. 待修复问题（用户 2026-06-18 反馈）★ 重点

### 问题 A — 血侍是「克隆」，要做成**不同风格的人**

- **现状**：`world.js` 只有单一敌人定义 `xueshi_zu`（name「血侍」），`startSantuanFight` 里
  `enemies:[xs(),xs(),xs()]` 三个完全相同；渲染时 enemy 走 `_battlerByName(u.name)`
  （**不读 `art` 字段**，见 ui.js 3454），三个「血侍」全部命中同一张 `bt_xueshi` → 长一模一样。
- **期望**：三个血侍**各异**——不同体格 / 兵器 / 姿态 / 血煞色，像三个不同的人。
- **修复方向**：
  1. 生成 2~3 张差异化立绘，如 `bt_xueshi_a/b/c`（或 `bt_xueshi2`、`bt_xueshi3`）——
     `genart.js` battler 条目，遵循 `STYLE_BATTLER`（纯白底、全身、自动抠图）。
  2. 让三个血侍用上不同立绘，二选一：
     - **(推荐)** 改 ui.js 3454 的 enemy 分支，让它像 side 分支一样**优先读 `art` 字段**：
       `bid = u.art && Art.hasBattler("bt_"+u.art) ? "bt_"+u.art : this._battlerByName(u.name);`
       然后在 `startSantuanFight` 给三个实例各加 `art:"xueshi_a/ b/ c"`。
     - 或给三个血侍**不同 name**（如「血侍·甲/乙/丙」「血煞役」「血煞奴」），在 `_battlerByName`
       各映射到不同 `bt_`。注意保留通用 `[/血侍/,"bt_xueshi"]` 作兜底（须排在更具体规则之后）。
  3. 保留 `bt_xueshi` 作通用回退，别删。

### 问题 B — 要「**三个战场分别战斗 + 互相支援**」，不是一锅端混战

- **现状**：`startSantuanFight` 是**单个 Combat**（`W:13, lanes:2`），3 个 side + 3 个 enemy
  全部塞在一个竞技场里混战。「三组分头缠住血侍」「三组背靠背列开」目前**只存在于台词/旁白**
  （engine.js 3557-3558），**机制上并没有三条战线**。
- **期望**：**三组对位**——刘靖、宋蒙、钟卫娘各自缠住一组血侍，形成**三条战线 / 三个战场**；
  并且能**互相支援**（跨线驰援：打完自己这组去帮别人；韩立用**飞控/雷遁瞬移**跨场支援）。
  这正是宣传片的燃点：副歌「这一路破空」配跨场驰援 + 战场拉大。
- **修复方向（需先评估 `combat.js` 能力，成本可能较高）**：
  1. **方案1（lane = 战线）**：`lanes:3`，每组对位放在不同 lane，敌我按 lane 配对；
     「支援」= 跨 lane 移动 / 远程打击 / 韩立瞬移跨线。战场拉大已有
     （combat.js：单位铺开 `dist>6 → f=0.68` 自动拉镜）。
  2. **方案2（分段串联）**：三场子战斗串联，每打完一组触发「驰援」叙事再合流。
  3. **方案3（front/zone 概念）**：若 combat 引擎不支持多战线，需要扩展（成本高，先评估再动）。
  - 无论哪个方案，**「互相支援」要既有机制也有可视化**（这是燃点，别只做成台词）。
  - 同步现有 log「三组分头缠住血侍」与实际机制保持一致。

### 问题 C — 皇宫**不能只有地板**

- **现状**：`assets/scenes/huanggong.png` 画面几乎全是广场地砖，建筑（朱墙 / 宫门 / 盘龙柱 /
  飞檐 / 石狮 / 宫灯）很暗很远，读起来像「一块地板」，不像皇宫。
- **期望**：画面要有**明确的皇宫建筑感**——宫门洞开、朱墙金瓦、盘龙石柱、飞檐斗拱、丹陛石阶、
  宫灯 / 冷月血光；下半幅仍**留出可站位的地面**（舞台盒构图）。
- **注意**：`genart.js` 的 `STYLE_BATTLE_SCENE` 强制「横 16:9、下半幅开阔地面、无人」。
  重画时把建筑往**中上部**压、强化建筑剪影与体量感，但别填满下半幅的站位区。
- **可选**：若问题 B 做成三战场，可考虑**三张分场底图**（宫门广场 / 丹陛石阶 / 大殿前），
  三场战斗各用各的 `sceneBg`。

---

## 4. 关键文件与入口地图（修复用）

| 用途 | 位置 |
| --- | --- |
| 生图命令 | `GEN_PROXY=none HTTPS_PROXY="" HTTP_PROXY="" node scripts/genart.js <OPENROUTER_KEY> <ids>` |
| 生图 DEFS | `scripts/genart.js`（皇宫批 ~290-300）；battler→`assets/battlers`，bgscene→`assets/scenes`；battler 自动抠图、bgscene 自动裁边 |
| 资产注册 | `js/art.js`：SCENES(54-56) / BATTLERS(89-91) / `ASSET_VER`(116) |
| 立绘解析 | `js/ui.js` `_battlerByName`(2909-2941，血侍 entry 2925-2926)；render 路径 3447-3468（player→`bt_hanli`；side→`"bt_"+u.art` 优先否则 `_battlerByName(name)`；**enemy→`_battlerByName(name)`，不读 art**） |
| 场景底图渲染 | `js/ui.js` 2806-2807（`Art.sceneUrl(id,{landscape:true})`；biome 由 `/^bt_/` 前缀决定，`huanggong` 非 bt_ → 中性无色偏） |
| 战斗构建 | `js/engine.js` `startSantuanFight`(3516) / `startTuoshiFight`(3566) / `startXuwangFight`(3615)；`_combatMeta.sceneBg` 在 3554 / 3603 / 3658 |
| 敌我定义 | `js/world.js` `xueshi_zu`(851-861，**无 art 字段**)；刘靖(1360) / 宋蒙(1366) / 钟卫娘(1372)；三组对位 lore(848-850) |
| 剧情入口 | `js/story.js` `santuan_fight`(1932) / `tuoshi_fight`(2077) / `xuwang_final_fight`(2099) |
| demo 入口 | `js/main.js` `?demo=palace`(266-302)，`&climax=1`→`startXuwangFight` |
| 录制 / 验收视口 | iPhone 14 Pro Max（430×932，DPR 3）——见 AGENTS.md「移动端测试基准」 |
| 发版 / 测试 | `node scripts/bump.js <ver>`；`node test/{run,journey,combat}.test.js` |

---

## 5. 验收标准（改完逐条核对）

- [ ] 三个血侍**外观各异**（非克隆）。
- [ ] 三组对位在**机制上是三条战线 / 三个战场**，且有**可见的「互相支援」**（跨线驰援 / 韩立瞬移支援）。
- [ ] 皇宫底图有**明确建筑感**（不只是地板），下半幅仍可站位。
- [ ] **14 Pro Max 竖屏视口**下渲染正常，**无字块 / 无默认土地**。
- [ ] `?demo=palace` 与正经流程（santuan / tuoshi / xuwang）表现一致。
- [ ] `node test/{run,journey,combat}.test.js` 全过；`node scripts/bump.js` 升版。
