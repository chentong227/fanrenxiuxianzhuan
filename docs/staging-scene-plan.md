# 剧情演出补完方案（Staging Backfill Plan）

> 配套 `docs/staging-experience-design.md`。后者定义"演出引擎能做什么"（P0–P2 已全部实装上线 v199）；
> **本文档定义"现有剧情还差哪些演出、各自怎么演"**——即把已就绪的演出工具（运镜预设 / 差速视差 / 危局血晕 / hit-stop / 声相 pan / 名场面回廊）逐节点落到 `js/story.js` 的 `text[]` 里。
>
> 补演出 = 往节点 `text[]` 插演出原语，**不动引擎**；每补一个含原语且有稳定 `id` 的节点，自动进"名场面回廊"可重温。

---

## 1. 现状审计（扫描 `js/story.js` 全 107 节点，2026-06）

判定口径：节点 `text[]` 含 `cam/actor/fx/sfx/bgm/amb/wait/beat/shot` 任一 = "已演出"；仅 `say/aside/scene/叙述` = "纯文本"。

| 篇章 | 节点区间 | 已演出 | 现状 |
|---|---|---|---|
| 七玄门篇 | 1–15 | 2/15（且仅 `amb` 环境床） | ❌ 开场三大高潮无运镜 |
| 嘉元城·升仙大会 | 16–24 | 2/9（`mo_arrive`/`mo_crisis` P0 打样） | 🟡 后半截没接上 |
| 黄枫谷篇 | 25–39 | 0/15 | ❌ 整篇零演出（含筑基质变） |
| 魔道争锋篇 | 40–72 | 0/33 | ❌ 整篇零演出（含整段皇宫决战） |
| 再别天南篇 | 73–87 | 11/15 | ✅ 基本完整 |
| 初入星海篇 | 88–107 | 19/20 | ✅ 最完整 |

**结论**：演出集中在最新两篇；最老三篇几乎全裸，而恰恰藏着最多名场面。补完优先级见 §4。

---

## 2. 通用演出配方（复用语言，保持一致手感）

为避免逐节点各写各的，先沉淀 6 种可复用"演出语法"，下面 §3 直接引用。所有原语均 `fail-soft`、受"演出速度"设置缩放、可跳过。

- **R-反杀（埋伏后一击毙命）**：`{shot:"focusLeft"}`（锁定目标、另一侧压暗）→ 台词蓄势 → `{beat:{kind:"window", action:"…出手！", onHit:{sfx:"backstab", cam:"shake", px:9, fx:{fx:"burst", elem:"jin", n:14}}, onMiss:{sfx:"whiff", cam:"shake", px:5}}}` → `{shot:"pullOut"}` 收束。（手感对标 `mo_crisis` 的飞针 beat。）
- **R-突破异象（筑基/结丹/金丹）**：`{bgm:"triumph"}` → `{shot:"pushIn"}` → `{fx:"flash", color:"#dff3ff", alpha:0.5, ms:700}`（灵光涨）→ `{sfx:"success"}` → `{fx:"burst", at:"center", elem:"…", n:18}` → `{shot:"pullOut"}` 释怀。
- **R-BOSS压境（撑过血线）**：`{bgm:"boss"}` → `{shot:"shock"}`（猛推+震，破阵登场）→ `{sfx:"farRoar"}` → `{fx:"shake"}` 多段 → 进战斗（战中危局血晕由 `Fx`/`Sfx.peril` 自动接管）。
- **R-惊变（突发转折）**：`{shot:"shock"}` → `{sfx:"thunder"}` / `{fx:"lightning"}` → `{wait:600}` 留白 → 台词。（对标 `starsea_a2_jingbian`。）
- **R-重逢/离别（情绪戏）**：`{shot:"establish"}` 定场 → `{actor:id, enter:"left|right"}` 立绘对位（双人对话靠 §7 声相 pan 自动左右）→ 缓推 `{shot:"pushIn"}`；离别收 `{shot:"pullOut"}` + `{bgm:"sorrow"}`。
- **R-定场（抵达/章首章尾）**：`{scene:"…"}` → `{bgm:"…"}` → `{shot:"establish"}` → 必要时 `{amb:"…"}` 环境床 → 章尾 `{guide:{…}}` 指路下一步。

---

## 3. 逐节点演出方案（按篇章）

> 每条给出"在该节点 `text[]` 中插入哪些原语、插在哪句前后"。`▶` = 建议插入项；保留原叙述/对白不动。

### 七玄门篇

**`zhangtie`「挚友失踪」** —— 张铁惨死·炼成铁奴（情绪+惊悚）。现仅 `amb:"night"`。
- ▶ "绕到墨大夫密室之外"前：`{shot:"establish"}`（夜·药庐定场）
- ▶ `{show:"铁奴"}` 揭示前：`{shot:"pushIn"}` 缓推门缝 + `{fx:"flash", color:"#6f86a0", alpha:0.12, ms:500}`（幽光）+ `{sfx:"danger"}`
- ▶ "……张铁？"后：`{wait:700}` 留白 + `{cam:"shake", px:4}`（心震）

**`showdown_prep`「夺舍之谋」** —— 死局铺开（蓄势）。现零演出。
- ▶ "用小绿瓶催熟……毒草"句：`{shot:"focusLeft"}` + `{sfx:"cast"}`（催毒）
- ▶ "想夺我的身子……"冷然台词：`{shot:"pushIn"}` 聚气

**`showdown`「夺舍之夜」** —— **反杀墨大夫**，全书第一大高潮。现仅 `amb:"candle"`。
- ▶ "烛火无故熄灭"：`{fx:"flash", color:"#000", alpha:0.5, ms:300}`（骤暗）+ `{sfx:"danger"}`
- ▶ 墨大夫阴冷台词：`{shot:"shock"}`（猛推，揭露夺舍真身）
- ▶ "你心跳如鼓"：危局心跳由战斗内 `Sfx.peril` 接管；此处 `{wait:500}` 蓄势
- ▶ 进战斗前末句：`{shot:"focusRight"}` 锁定韩立出手位（接 R-反杀语法）

**`jinguang_fight`「暗算金光上人」** —— **反杀金光上人**。现零演出。
- 直接套 **R-反杀**：`{shot:"focusLeft"}`（佝偻老药师近身）→ "金钟罩再固……"台词 → `{beat:{kind:"window", action:"催毒·暗器·一击毙命！", onHit:{sfx:"backstab", cam:"shake", px:10, fx:{fx:"burst", elem:"mu", n:16}}, onMiss:{sfx:"whiff", cam:"shake", px:6}}}` → `{shot:"pullOut"}`

**`arc_end`「升仙令 · 离门」** —— 七玄门篇收官（仪式）。现零演出。
- ▶ 章首：`{shot:"establish"}`（山门外定场）
- ▶ "最后回望……七玄门"：`{shot:"pullOut"}` 释怀 + `{bgm:"journey"}`
- ▶ 末 `{scene:"…离门远行 · 启"}` 已有；补 `{guide:{tag:"七玄门篇 · 终", focus:"map", cta:"南下嘉元城"}}` 指路

### 嘉元城·升仙大会

**`xianhui_open`「升仙大会 · 测灵台」** —— **四灵根当众落选**（反差名场面）。现零演出。
- ▶ `{scene:"太南山 · 升仙大会"}`后：`{bgm:"town"}` + `{shot:"establish"}`（七面大旗·人山人海）
- ▶ "测灵璧前……四灵根落选"：`{shot:"focusRight"}`（聚韩立）+ `{sfx:"fail"}`（群嘲气口）+ `{fx:"flash", color:"#888", alpha:0.1}`

**`wan_death`「暮色森林 · 故人之血」** —— **万小山之死**（情绪）。现零演出。
- 套 **R-重逢/离别**（悲）：`{shot:"establish"}` 暮色森林 → `{amb:"wind"}` → 噩耗句 `{shot:"pushIn"}` + `{bgm:"sorrow"}` + `{wait:700}`

### 黄枫谷篇（整篇零演出，重点补 4 处）

**`hf_duodan`「得丹 · 夺丹」** —— **被掌门当众夺丹**（憋屈反差）。
- ▶ 夺丹一刻：`{shot:"focusLeft"}`（聚夺丹者）+ `{sfx:"hit"}` + `{cam:"shake", px:4}`
- ▶ "这一课，我记到筑基那天"心声：`{shot:"pushIn"}` + `{wait:600}`

**`chen_rescue`「坊市归途 · 林中血」** —— **杀陆云风·救陈巧倩**（战斗名场面）。
- 套 **R-反杀**/BOSS 轻量版：`{shot:"shock"}`（林中突袭）+ `{sfx:"sword"}` → beat 出手 → `{shot:"pullOut"}`

**`jindi_meeting`/`jindi_days`/`jindi_deep`「血色禁地」系列**
- 统一定场：`{scene}` → `{shot:"establish"}` → `{fx:"material"}`/氛围（血雾）；`jindi_deep`「血潭」加 `{shot:"tiltDown"}`（下探）+ `{sfx:"danger"}`
- `fengyue_ambush`「中环·狙杀者」：`{shot:"shock"}` + `{cam:"shake", px:8}`（伏击）

**`qingyuan_gift`「筑基 · 青元剑诀」** —— **筑基质变·突破异象**（名场面）。现零演出。
- 套 **R-突破异象**：`{scene:"黄枫谷 · 山门大殿"}`后 `{bgm:"triumph"}` → "一缕青芒自纸面流过" `{fx:"flash", color:"#bfead0", alpha:0.45, ms:700}` + `{fx:"ribbon", color:"#7fe0a0"}` + `{sfx:"success"}` → "青芒可凝成……巨剑，自天倾斩" `{shot:"pushIn"}` → 收 `{shot:"pullOut"}`

### 魔道争锋篇（整篇零演出 —— 最大一块，分两批）

**批一·燕家堡（前置）**
- `yanjia_reunion`「故人重逢」：R-重逢 → `{shot:"establish"}` + `{actor:"mocaihuan", enter:"left"}` + `{shot:"pushIn"}`
- `yanjia_boss`「战王蝉破阵」：套 **R-BOSS**（已有 `bgm:"boss"`）→ "堡墙轰然炸裂"`{shot:"shock"}` + `{sfx:"farRoar"}` + `{fx:"shake"}` → "双镰开阖……裂石分风"`{cam:"shake", px:10}`
- `yanjia_escape`「逃出生天」：`{shot:"shock"}`（四面起火）+ `{fx:"flash", color:"#ff7a3a", alpha:0.2}` → 执旗使压旗 `{bgm:"triumph"}`（已有）

**批二·皇宫决战 `modao_e4_*`（10 节点连演，单篇收益最大）**

按"决战节拍"统一编排，节点间镜头语言递进：

| 节点 | 题 | 演出 |
|---|---|---|
| `modao_e4_shenxun` | 审讯与集结 | `{shot:"establish"}` 大殿定场 + `{bgm:"tense"}` |
| `modao_e4_santuan` | 三组对位群架 | `{shot:"shock"}` 开打 + `{sfx:"farClash"}` + 多段 `{cam:"shake"}` |
| `modao_e4_dive` | 血池大殿 | `{shot:"tiltDown"}`（下探血池）+ `{fx:"material"}` 血雾 + `{sfx:"danger"}` |
| `modao_e4_liujing_live/die` | 阴手·示警/身陨 | 示警 `{shot:"shock"}`+`{sfx:"danger"}`；身陨 `{bgm:"sorrow"}`+`{wait:700}`+`{shot:"pushIn"}` |
| `modao_e4_xuwang` | 胥王现身 | **R-BOSS**：`{bgm:"boss"}`+`{shot:"shock"}`+`{sfx:"farRoar"}` |
| `modao_e4b_tuoshi` | 拖时布阵 | `{shot:"focusRight"}` 聚阵眼 + `{sfx:"cast"}` |
| `modao_e4b_zhencheng` | 阵成·反制 | `{fx:"lightning"}`+`{sfx:"thunder"}`+`{cam:"shake", px:9}` |
| `modao_e4b_finale_live/die` | 真凰符·终结 | `{shot:"shock"}`+`{fx:"flash", color:"#ffd27a", alpha:0.5}`+`{sfx:"success"/"die"}`+`{shot:"pullOut"}` |
| `modao_e4b_likjing` | 离京 | `{shot:"pullOut"}`+`{bgm:"journey"}`+`{guide:{focus:"map", cta:"回天南"}}` |

### 再别天南篇（零星补齐，比照同篇已演出节点）

- `zaibie_open`「回天南」：`{shot:"establish"}` + `{bgm:"journey"}`
- `zaibie_a1_duoshe`「夺剑」：R-反杀（`{beat}` 夺剑一手）
- `zaibie_a1_after`「战报」：`{shot:"pullOut"}` 收束
- `zaibie_a3_yuanwu`「亡命元武」：`{shot:"shock"}` + 危局血晕（战中自动）

### 初入星海篇（仅一处可选）

- `starsea_a4_jieguan`「择吉叩关」：现仅 `guide`；可补 `{shot:"establish"}` 结丹前定场（可选，非必需）。

---

## 4. 优先级（建议排期）

1. **皇宫决战全段（`modao_e4_*` ×10）** —— 一次连成大决战，单篇收益最大。
2. **七玄门开场三高潮** —— `showdown`（反杀墨大夫）/`zhangtie`（张铁之死）/`jinguang_fight`（反杀金光）。第一印象，ROI 最高。
3. **筑基·青元剑诀（`qingyuan_gift`）** —— 突破异象，配方现成。
4. **战王蝉 BOSS（`yanjia_boss`）** + **坊市林中血（`chen_rescue`）** —— 战斗名场面。
5. 嘉元城后半（`xianhui_open`/`wan_death`）→ 黄枫谷血色禁地 → 再别零星 依次补齐。

> 每批补完：跑 `node test/run.js` + `test/*.test.js` 保绿（`hasStaging`/`recordScene`/`compile` 已有用例）→ `node scripts/bump.js` 提版本同步缓存戳 → PR。
