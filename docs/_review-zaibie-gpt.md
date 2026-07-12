# 再别天南篇 · GPT 5.6「审机器」报告

> 2026-07-12 · 全章打磨巡礼第 4 站 · 只读审查  
> 范围：`js/chapters.js` 的 `zaibie`；`js/story.js` 的 15 个 `zaibie_*` 节点；
> `js/engine.js` 六战与 `_quhunSide()`；地点/月常/跨章流转；现有测试门禁。  
> 方法：以 `playtest/save-modao-e3.json` 经 `test/_loadgame.js` 加载真实引擎；
> 六战 `autoResolve N=200`；另测筑基后期 cap15、曲魂双线、温养/强催、绿煌剑即时装备；
> 64 组跨章旗矩阵驱动全 15 节点。临时脚本已删除，未改 `js/`、`test/`。

## 一、结论

这章不是“十分钟播完”的空壳：15 个剧情节点、6 场战，手操首通约 **1.0~1.7 小时**；
但它是一个**游戏内仅 3 个月、有效自由月为 0、Build 无法经营的纯轨道战斗章**。
“衔接为主、自由度适当低”可以成立，当前真正不能接受的是：

1. 正典曲魂留府线把夺舍战压到 **1.5%**，而带走曲魂线是 **100%**，形成约 **98.5pt 胜率断崖**；
2. 两段号称“帆窗”的 2 月/1 月等待，都落在 `scene:true + actions:[]` 的过场地点，行动层软锁；
3. 护山守点的保护对象并未被规则保护，李化元正常战死不会判败；
4. 黑煞血刃从未入袋，大挪移令用后不消耗；
5. v319 明确立案、本章设计明确落在 ep51 的白菊山之约仍完全不存在。

优先级统计：**P0 5 项 / P1 9 项 / P2 5 项**。

---

## 二、厚度十问（本路负责项）

| 维度 | 结论 | 机器依据 |
|---|---|---|
| 1 时长 | 现实手操约 1.0~1.7h；正典留府线常被夺舍战额外拖出 4~6 次重试。游戏内固定只走 3 月 | 15 节点、6 战；夺舍冷开约 1.5%，三败后仍仅约 40% |
| 2 自由度 | **实际 0 个可正常经营的自由月** | 唯二 due 窗都停在 `jinguyuan` / `yuekuang`，二者为 `scene:true, actions:[]` |
| 4 Build | 剑/丹/阵都没有本章可正常推进并在主线兑现的回路 | 无可用 home 帆窗；六战不读三路熟练/层数作章节特解 |
| 5 战斗张力 | 1 场断崖、3 场白给、1 场合格保护战、1 场偏软入场战 | 见 §四 N=200 |
| 8 重玩价值 | 主要差异只来自“此前是否带走曲魂”，但当前差异是 1.5% vs 100% 的失衡，不是公平重玩；本章内多选多数无后果 | 64 旗矩阵主干相同；多枚选择旗全仓只写不读 |
| 10 肝点质量 | **无可肝循环**。没有零耗月无限收益，但也没有任何值得反复投入的月常 | pending 锚链连续；场景窗无行动；无本章探索/请托/切磋/制符经营段 |

> 低自由度本身不判 P0；“承诺是帆窗、实现却无按钮”与“cap 提高但章内完全用不上”才是缺陷。

---

## 三、时间预算与地点流转

### 3.1 真时间账

| 段落 | 强制耗月 | 所在地点 | 可用行动 | 结论 |
|---|---:|---|---|---|
| `zaibie_open` → 血刃附傀 → 金背 → 夺舍 → 战报 → 金鼓原 → 护山 → 李化元 | 0 | 嘉元城 → 金鼓原（剧情瞬移） | pending 连锁，不能行动 | 8 个锚/4 战在同一月完成 |
| 李化元殉道后 → `zaibie_a3_yuanwu` | **2** | `jinguyuan` | `scene:true, actions:[]` | 注释称“喘息帆段”，实际上没有调息/修炼/制符按钮 |
| 元武赠图 → 护道 → 跌境 → 南宫赠别 | 0 | 元武 → 燕家堡 → 越国矿洞（剧情瞬移） | pending 连锁 | 多地跨越不计月 |
| 南宫赠别后 → `zaibie_a4_kuangdong` | **1** | `yuekuang` | `scene:true, actions:[]` | 注释称“最后休整”，实际上无备牌/调息入口 |
| 矿洞战 → 离开天南 → 到达乱星海 | 0 | 矿洞 → 乱星海 | pending 连锁 | 收尾同月完成 |
| **合计** | **3 月** | 6 个大地点 | **有效自由月 0** | 时间账严重小于 14 集剧情体量 |

代码证据：

- 两个 due：`js/story.js:5032-5033`、`js/story.js:5241-5242`；
- 两个地点均为纯过场：`js/world.js:448-470`；
- UI 对 `scene` 强制清空行动：`js/ui.js:876-878`、`js/ui.js:941-942`；
- `currentObjective()` 没有 zaibie due 的动态倒计时分支：`js/engine.js:8897-8927`。

世界地图仍是全局入口，所以熟悉系统的玩家可以从纯过场地点强行发起旅途来烧月；但
`startJourney()` 此时找不到当前大陆节点，`journey.from=null`，且 due 可能在旅途中触发剧情、
留下未收完的 `s.journey`。这不是合格补救径，只是隐蔽逃生口。

### 3.2 cap15 与修为/功法层

真实存档入章为 `realmIndex=13`（筑基初期）、青元剑诀 3 层。章 cap 已抬到 15（筑基后期），
但本章没有正常闭关窗口：

| 目标 | 真成本 | 本章可用时间 |
|---|---:|---:|
| 青元 3→4 层 | 7 月 + 修为 1200 | 0 个可操作月 |
| 3→5 层（解锁护体剑盾） | 15 月 + 修为 2700 | 0 |
| 3→6 层 | 24 月 + 修为 4500 | 0 |
| 3→7 层（解锁剑影分光） | 34 月 + 修为 6600 | 0 |
| 筑基初期→中期→后期 | 两次小境突破 + 中期修为墙 | 0 |

成本源：`js/engine.js:3767-3769`；境界墙：`js/data.js:53-56`。

把同一真实档直接抬到 cap15 后重测六战，胜率几乎不变，尤其夺舍仍只有约 2%。
所以 cap15 目前只解决“上一章合法境界不倒挂”，**没有成为本章玩法空间**。

### 3.3 跌境核验

`zaibie_a4_diejing.onArrive` 只写：

- `zaibie_diejing`
- `zaibie_diejing_done`
- ledger / milestone

它**不改** `realmIndex`、`cultivation`、`spirit`、`techLayers`、`hpMax`，符合用户已拍板的
“只演出、不动数值”（`js/story.js:5178-5184`）。后续两选只改心境或回满气血；
矿洞战又强制满血上场。故“跌境没有真改数值”不是 bug，见伪问题剔除。

---

## 四、六战数值体检（真实存档 N=200）

### 4.1 主表

口径：`save-modao-e3.json`、筑基初期、真实装备/技能；正典 `quhun_stay_jiayuan=true`，
故前两战没有曲魂，夺回后四战为强催曲魂。末血只按胜局统计。

| 战斗 | 胜率 | 胜局末血 | 平均回合 | 玩家伤害占比 | 保护对象 | 判定 |
|---|---:|---:|---:|---:|---|---|
| `zb_jinbei` 金背妖螂 | **100%** | 86% | 5.4 | 100% | — | 偏软但仍掉血；可作阵图入场战 |
| `zb_duoshe` 夺舍者两阶段 | **1.5%** | 36% | 16.7 | 100% | — | **冷开近死局**；fail-forward 也救得太慢 |
| `zb_jingu` 金鼓原群战 | **100%** | 100% | 7.6 | **17%** | — | 宋蒙/钟卫娘/曲魂代打，玩家近乎观战 |
| `zb_hushan` 护山守点 | **100%** | 99.6% | 6.0 | **24%** | 李化元均末血约 86% | 白给；且保护判定本身失效 |
| `zb_hudao` 蒙面护道 | **86%** | 98% | 6.0 | 25% | 南宫婉倒下约 14%；胜局余血约 22% | **本章唯一成立的保护张力**：危险集中在被保护者 |
| `zb_kuangdong` 矿洞启阵 | **100%** | 99.7% | 6.0 | 26% | 阵枢末血约 77% | 章末战偏白，玩家与阵枢都太安全 |

### 4.2 曲魂分支断崖

| 夺舍战口径 | 胜率 | 末血 | 回合 |
|---|---:|---:|---:|
| 正典留府线（曲魂躯壳被占，前两战无 side） | **1.5%** | 36% | 16.7 |
| 早年选择“带走曲魂”（六战均有强催 side） | **100%** | 94% | 8.4 |
| 正典线抬到筑基后期 cap15 | 约 **2%** | 52% | 17.1 |

断崖约 **98.5pt**。这不是“选择有重量”，而是此前一个情感分支决定本章 boss
是近死局还是白给。

连败补偿（同一档 N=200）：

| 已败次数 | 伤害补偿 | 下一战胜率 |
|---:|---:|---:|
| 0 | 0% | 2.5%（重复采样波动；主表为 1.5%） |
| 1 | +8% | 12.5% |
| 2 | +16% | 25.5% |
| 3+ | +24% 封顶 | 40% |

虽非永久死档，但正常玩家需连续吃数次近必败，属于典型“胜率断崖+失败刷条”。

### 4.3 现有测试为何没抓到

`test/combat-sweep.bal.js` 从 `State.create()` 起步，默认没有 `quhun_stay_jiayuan`，
于是血刃附傀节点会直接造出曲魂 side，永远走 easy 线；现有输出因此是：

- `zb_duoshe` 100% / 末血 99%
- `zb_jingu`、`zb_hushan`、`zb_kuangdong` 全 100%

它只把“0% 且非 survive/阵法/fail-forward”判 FAIL，不会拦 100% 白给、同道代打或
跨分支 98pt 断崖。`backbone.audit.js` 又会把所有 `*_due` 清零并强制胜战，
恰好掩盖两段帆窗软锁。

---

## 五、Build 三路与曲魂成色

| 路线 | 本章能否推 | 本章主线读点 | 结论 |
|---|---|---|---|
| 剑道 | 理论上嘉元城 home 可闭关参研；实际剧情 pending 立即连锁，进不了行动。3→5 至少 15 月 | 绿煌剑是新法宝；六战没有章节专属层数/剑道门槛。即时装备后，白给三战胜率仍全 100%，玩家占比只约 17%→27% | 有奖品，无经营窗、无检验题 |
| 丹道 | 嘉元城无 `alchemy`；元武只有 `rest`；两个 due 窗在 scene | 只在辛如音选项可花 1 枚回血丹；六战只吃通用 pouch | 本章无推进、无兑现 |
| 阵法/制符 | v319 已修 home 自动注入 `lianfu`，每次真耗 1 月；但本章没有可用 home 帆窗 | 金背 `fieldCycle`、古阵修复全是无条件剧情赠送；不读制符熟练、阵法里程碑、阵图/图纸持有 | “阵法大家之路自辛如音始”目前只是一张物品卡 |

### 曲魂·血刃附傀

优点：

- 确实成为真实 `SideUnit`，后四战自动参战；
- 强催/温养有不同 hp、攻击、人格参数；
- 留府线夺回后会真实归位并结旧账。

问题：

1. 强催与温养在本章结果近乎同值：后四战胜率差落在采样噪声内；
2. “徐徐温养”不耗月、不耗物，与“强催”同一瞬完成；
3. 曲魂固定输出太高：金鼓原/护山/矿洞玩家伤害占比仅 17%~26%；
4. `heisha_xueren` 从未入袋，选择也不检查持有，属于凭空武装；
5. 中途破损后本章无修缮窗，后续连续战会直接失去该轴。

判定：这是**有机制实体的一次性装置**，但还不是能经营、能构筑、能公平分化的 Build。

---

## 六、一次性装置 / 假选择 / 刷条

### 6.1 一次性装置清点

| 装置 | 当前机制 | 问题 |
|---|---|---|
| 黑煞血刃 | 剧情直接附给曲魂 | `DATA.items.heisha_xueren` 有定义，但全仓无 `State.give("heisha_xueren")`；附傀也不检查 |
| 曲魂附傀 | 两配置二选一 / 留府线夺回后补建 | 双配置实战差异极小；正典线前两战缺 side 导致夺舍断崖 |
| 绿煌剑 | 夺舍胜后入袋，可手动装备 | 章内没有明确整备窗口；后续三场被 sides 抬成 100%，到手蜕变难被看见 |
| 奇虫榜玉简 | 胜后入袋 | 长线知识钩，本站不兑现属合理 |
| 古传送阵图纸 | 元武节点入袋 | 不涨阵法、不授方案、矿洞 cond 不检查持有 |
| 南宫婉灵石 | 一次性给普通 `lingshi ×30` | 古阵启用不扣任何灵石，所谓“传送动力”全数留作可花货币 |
| 大挪移令 | 矿洞演出写“应手而碎” | 全仓无 `State.take("dayi_ling")`，用后仍在背包 |

### 6.2 假选择与严格占优

| 节点 | 表面取舍 | 实际 |
|---|---|---|
| `zaibie_open` | 赶路掉 8% 血 vs 调息满血但追兵靠近 | “追兵靠近”无人读；调息严格占优 |
| `zaibie_a1_duoshe` | 正常夺剑 vs 贪储物袋（额外材料/追兵更快） | `zaibie_greedy` 全仓只写一次；无额外材料、无追兵代价 |
| `zaibie_a1_after` | 连夜赶战掉 10% 血 vs 调息满血但战局恶化 | 战局恶化无人读；调息严格占优 |
| `zaibie_a4_diejing` | 强压境界 vs 卸力保命 | 两旗无人读；后续矿洞又满血上场。强压只多吃心境 -5 |
| `zaibie_a4_lingshi` | 干脆进洞 vs 温情回应 | 后者额外心境 +2 + temperament，前者无回报 |
| `zaibie_cut2_luanxinghai` | 豪气 +5 vs 冷静 -5 | `zaibie_calm` 无读点，豪气严格占优 |

李化元悼念双选、离开天南回望双选、辛如音赠药双选有真实 temperament/资源差异，
不列假选择。

### 6.3 刷条与无限收益

- 未发现本章可重复的零耗月正收益循环；
- `makeFulu()` 已在 v318 后真耗 1 月；
- 15 个节点的 `onArrive` 均有 done flag/顺序指针保护，不能正常重复领奖；
- 本章的问题是**没有循环可肝**，不是循环可无限刷。

---

## 七、skipIf / cond 死链矩阵

### 7.1 15 节点顺序矩阵

| # | 节点 | cond 主前置 | skipIf | 结论 |
|---:|---|---|---|---|
| 1 | `zaibie_open` | `modao_e4_done` | `zaibie_open_done` | 正常进入 chapter/location |
| 2 | `zaibie_quhun_refine` | open done | quhun done | 动态 choices 双线都有出口 |
| 3 | `zaibie_a1_jinbei` | quhun done | jinbei done | 胜负重试可回本节点 |
| 4 | `zaibie_a1_duoshe` | jinbei done | duoshe done | 逻辑通，数值断崖 |
| 5 | `zaibie_a1_after` | duoshe done | after done | 留府 pending 会补 side |
| 6 | `zaibie_a2_jingu` | after done | jingu done | 通 |
| 7 | `zaibie_a2_hushan` | jingu done | hushan done | 通；目标机制坏，不是 cond 死链 |
| 8 | `zaibie_a2_lihuayuan` | hushan done | lhy done | 写 due+2 |
| 9 | `zaibie_a3_yuanwu` | lhy done + due 到点 | a3 done | 逻辑可达；UI 帆窗软锁 |
| 10 | `zaibie_a4_hudao` | a3 done | hudao done | 通 |
| 11 | `zaibie_a4_diejing` | hudao done | diejing done | 通；只演出 |
| 12 | `zaibie_a4_lingshi` | diejing done | lingshi done | 写 due+1 |
| 13 | `zaibie_a4_kuangdong` | lingshi done + due 到点 | kuangdong done | 逻辑可达；UI 帆窗软锁 |
| 14 | `zaibie_cut1_likai` | kuangdong done | likai done | 通 |
| 15 | `zaibie_cut2_luanxinghai` | likai done | arc4 complete | 通；解锁 starsea |

### 7.2 组合实测

以下 6 轴做 2⁶ = **64 组**：

- 曲魂留府 / 带走
- 陈巧倩 forgot / remember
- 刘靖死 / 生
- `baiju_appt` 无 / 有
- `fujia_grudge_start` 无 / 有
- `modao_awol` 无 / 有

结果：**64/64 在直接推进时间的无头驱动下都能经过 15/15 节点并到 starsea，零 cond/skipIf 主干死链。**

但矩阵也证明：

- `baiju_appt`、`chen_front_reunion` 对本章 15 节点完全无影响；
- `fujia_grudge_start` 不改变齐云霄死讯拍，只是与新写的 `fujia_grudge` 并存；
- `modao_awol` 可一路残留到 starsea，但当前无读点，不会误扣；
- `liujing_survived` 仅在开篇追加一条伤愈风闻，不污染六战；
- `jingcheng_intel` 本章无直接残留 buff，其价值已在魔道章生成 `liujing_survived`，这是正确隔离。

存档兼容风险：若旧档已有 `zaibie_quhun_done`，却没有 `sideUnit` 也没有
`zaibie_quhun_pending`，`skipIf` 会直接跳过建 side，整章核心底牌永久缺失。建议给进入章首加一次
“done ⇒ side/pending invariant”自愈。

---

## 八、跨章衔接

### 8.1 魔道 → 再别

正确项：

- `modao_e4b_likjing` 写 `modao_e4_done` 并解锁 `zaibie`；
- `zaibie_open` 调 `Chapters.enter("zaibie")`，落点 `jiayuan_city`；
- activeChapter 切换后，`qianxian.hidden` 自动藏掉战时前线；
- `liujing_survived` 只留世界余韵，`jingcheng_intel` 不重复带入战斗。

缺陷：

- 章配置声明 `completeFlag:"arc3_complete"`，但 `modao_e4b_likjing` 从未写
  `arc3_complete`；全仓也没有其他写处。魔道章在配置/前路 UI 语义上并未真正完成，
  直到后续 `arc4_complete` 被 UI 的单调回填视觉掩盖；
- `modao_awol` 不在离京/enter 时清理，可成为永久休眠垃圾旗；
- v319 的 `baiju_appt` 在本章没有兑现。

### 8.2 再别 → 初入星海

主链正确：

- `zaibie_cut2_luanxinghai.onArrive` 写 `arc4_complete`、解锁 `starsea`；
- 下一节点 `starsea_a1_open.onArrive` 切 `activeChapter="starsea"`，同时保留
  `location="luanxinghai"`，没有被 `Chapters.enter` 错跳到魁星岛；
- 64 组合矩阵均成功进入 starsea。

缺陷是资源状态：大挪移令未消耗、30 灵石全留、`modao_awol` 可继续休眠。

---

## 九、P0 / P1 / P2 清单

### P0（5 项）

| # | 问题 | 证据 | 最小修法 | 工程 |
|---|---|---|---|---|
| P0-1 | **正典留府线夺舍战 1.5%，带走线 100%，断崖约 98.5pt** | `quhun_stay_jiayuan` 令前两战无 side；N=200；cap15 仍约 2% | 留府线在一阶段碎躯壳后“夺回曲魂”，二阶段让曲魂临时入场；或做 branch 专属削弱/底牌，目标冷开 35~65%，带走线不超过 85% | 中 |
| P0-2 | **两段 due 帆窗落在纯 scene，行动层软锁** | `story.js:5032-5033,5241-5242`；`world.js:448-470`；`ui.js:876-878` | 把两窗落到真实可行动据点/临时营地（home+rest/cultivate/alchemy/lianfu），补动态倒计时；或明确自动 `passTime`，不要伪称帆 | 小~中 |
| P0-3 | **护山“守李化元”目标是假的** | side 未设 `move:0`；无 target bias；hp≤0 时 hook 直接 return；探针：李化元 hp=0 后 status 仍 ongoing | 钉桩 `move:0`；敌人毁阵偏置；普通受击死亡也立即 lose；最好复用/扩展 protect+survive 目标 | 小 |
| P0-4 | **核心一次性物品链断裂**：黑煞血刃从未获得；大挪移令碎后仍在 | 全仓 `heisha_xueren` 只有数据定义；全仓无 `State.take("dayi_ling")` | 胥王结算真实 give 血刃；附傀 require/consume-or-bind；传送命中时 take 大挪移令（保留现有 starsea 开篇的 ledger 点名结算） | 小 |
| P0-5 | **白菊山之约仍是空头支票** | v319 已写 `baiju_appt`；设计稿本章 ep51；全章无 read/settle/节点 | 在金鼓原前补 remember 专属白菊山节点；forgot 线 `skipIf` 自然越过；兑现并 settle `baiju_appt` | 中 |

### P1（9 项）

| # | 问题 | 最小方向 |
|---|---|---|
| P1-1 | 时间预算与 cap15 不匹配：3 月账、0 可行动月，青元 3→5 要 15 月，cap 本章不可经营 | 两帆窗至少允许一条 7~10 月深耕或改成“短准备窗+章节特解”，不必把过场章拉成长驻地章 |
| P1-2 | 剑/丹/阵三路没有章节乘法点；阵图/古阵全部无条件赠送 | 六战各接至少两路：剑=绿煌/层数；丹=备丹护曲魂/护南宫；阵=图纸/formation 决定阵枢或相位 |
| P1-3 | 金鼓原/护山/矿洞三战全 100%，玩家末血近满；玩家伤害仅 17%/24%/26% | 降 side 输出、抬目标压力、让“先斩首/挡线/护阵”成为真解；玩家占比建议 ≥35% |
| P1-4 | 至少 6 组多选严格占优或后果虚假 | 让追兵/战局/跌境姿态真进下一战，或降级成单选 flavor；`zaibie_greedy` 必须真给材料且真加代价 |
| P1-5 | 大件到手/使用不诚实：绿煌剑无整备窗；图纸/阵图/灵石/令牌均不作 gate 或成本 | 战报后给法宝阁整备拍；矿洞 require 图纸+令牌；30 灵石划出阵能消耗或改文案为“余下可用” |
| P1-6 | `arc3_complete` 从未写，与 Chapters 配置冲突 | 魔道离京 onArrive 写 `arc3_complete`，加 chapter/handoff 断言 |
| P1-7 | 战斗持久账仍是旧正典/旧编队 | 改 `zaibie_jingu_won` 的李化元/南宫婉→宋蒙/钟卫娘；护山 ledger/milestone 去“燃命布阵”，对齐“催既有大阵→下节点碎丹” |
| P1-8 | 现有门禁系统性漏测本站 | 新增 `zaibie.bal.js`：曲魂双线、六战胜率/末血/玩家占比/保护目标；新增 `zaibie-time.audit.js`：due 窗必须有可耗月行动 |
| P1-9 | v319 后入章经济更富，本章再白送 30 灵石且零消费，真档约从 61+ 抬到 91+ | 与初入星海站联审物价；若灵石是阵能，明确扣除；若是礼金，降低或给本章真实备战出口 |

### P2（5 项）

1. **死旗清理**：`zaibie_rush/rest/rush_jingu/rest_jingu/hold_realm/accept_drop/calm`
   等均只写不读；选择重做后删旗或改 `recordTemperament`。
2. **休眠旗清理**：`modao_awol` 在离京/enter 时未销，可残留至星海；虽当前无副作用，宜章切时清掉。
3. **文档/注释漂移**：`zaibie-tiannan-design.md` 仍称 v0 未实装；engine 头注仍写“假丹身外化身”；
   护山函数有未使用 `lihuayuan` 局部量。
4. **ledger B 类冗余**：ledger.audit 把本章 13 条流程账判为“成就流水账”，与 milestone 重复；
   后续分批降级，避免账本噪声。
5. **随机与月味为零**：本章只有确定性 worldNews，没有本章 ambient/战败后整备小池；
   过场章可薄，但两段真帆窗至少各需 2~3 条战乱/告别风味。

---

## 十、伪问题剔除

1. **“15 节点 cond/skipIf 主干会因陈/刘双线死锁”——不成立。**  
   64 组旗矩阵全部 15/15 可达；逻辑链是直的，问题在 UI 时间窗与未兑现账，不在顺序指针。
2. **“跌境暗改数值”——不成立。**  
   `realmIndex/cultivation/spirit/techLayers` 均未动，严格执行“只演出”拍板。
3. **“liujing_survived / jingcheng_intel 会把上一章 buff 带进六战”——不成立。**  
   本章只给刘靖一条伤愈风闻；情报价值已在上一章转成生死旗，没有重复加战力。
4. **“fujia_grudge_start 未在本章 settle 就是死账”——暂不判。**  
   v319 明确规定它与 `fujia_grudge` 是同链不同拍、重返天南总清算；本章不结可接受。
   可选优化是齐云霄死讯按 start 账多一句回响，但不是主干缺陷。
5. **“qianxian hidden 机制会挡再别入口”——不成立。**  
   `zaibie_open` 先 `Chapters.enter("zaibie")` 并落嘉元城；activeChapter 改变后前线 pin 自然隐藏。
6. **“zaibie→starsea 派发死链”——不成立。**  
   `arc4_complete` + unlock 后，下一节点在乱星海原地切 activeChapter；backbone 与 64 组合矩阵均通过。
7. **“本章存在零耗月无限刷资源”——未发现。**  
   这里是反问题：没有可重复月常，收益装置又几乎全是一次性白送。

---

## 十一、推荐落地顺序

1. 先修 P0-1/P0-2/P0-3（胜率断崖、帆窗软锁、保护目标失效）；
2. 同批清 P0-4/P0-5（物品链、白菊山）；
3. 建 `zaibie.bal.js` + `zaibie-time.audit.js`，再校三场白给战；
4. 最后重做假选择与 Build 乘法点，经济交给初入星海站联审；
5. 全部完成后再做 P2 清噪。

现有只读验证：

- `node test/backbone.audit.js` ✅
- `node test/combat-sweep.bal.js` ✅（但已证实口径漏正典留府线）
- `node test/ledger.audit.js` ✅（`baiju_appt` 作为 H 类开放债不阻断，不能替代本站人工审计）

