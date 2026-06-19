# 演出 / CG / 引导 缺口活文档（staging-catalog.md）

> 扫描基线：ver=206，`js/story.js` 全 107 主线节点。
> 口径取自引擎本体 `Cutscene.hasStaging(stage)`（`js/cutscene.js`）——
> 即 `text[]` 中含 `cam/actor/fx/sfx/bgm/amb/wait` 任一，或 `fight/warp`，或对象型 `beat`。
> 仅 `shot`/`guide` 视为「轻演出」（◔），运镜/指路但无氛围床，建议补足。
> 本文是「先扫缺口、再按章批量补」的活文档——每补完一章回填状态。

## 0. 状态图例

| 记号 | 含义 |
|:--:|---|
| ✓ | 已具引擎演出（含氛围/运镜/特效原语之一） |
| ◔ | 轻演出：仅 `shot`/`guide`，建议补氛围床 |
| ✗ | 纯文本，待补演出 |
| —停用 | `skipIf:()=>true` 死卡（已被舆图系统接管，不触发、无需补） |
| CG ✓xxx | 已配 CG（资源 id） / ✗ 缺 CG |

## 1. 总览（与交接文档 53/54 口径核对）

| 章 | 节点区间 | 总数 | 已具演出 | 待补演出 | 缺 CG |
|---|---|:--:|:--:|:--:|:--:|
| 1 七玄门 | 0–14 | 15 | 5 | 10 | 11 |
| 2 嘉元城·升仙 | 15–23 | 9 | 4 | 5 | 5 |
| 3 黄枫谷 | 24–38 | 15 | 4（+3停用） | 8 | 9 |
| 4 魔道争锋 | 39–71 | 33 | 12（+2◔） | 19 | 1 |
| 5 再别天南 | 72–86 | 15 | 15 | 0 | 0 |
| 6 初入星海 | 87–106 | 20 | 19（+1◔） | 1 | 9 |
| **合计** | — | **107** | **59** | **45** | **32** |

**与交接文档「53 齐备 / 54 待补」完全吻合**（实测复现）：

- **待补 54** = 缺演出 45 节点 ∪ 「有演出但缺 CG」9 节点（全在星海）= **54**。
- **齐备 53** = 107 − 54（其中含 3 张已停用死卡，无需补）= **53**。

即：**演出**与 **CG** 两个维度上，凡缺其一者计 54 节点待补，两者皆备者 53 节点齐备。

## 2. 血色禁地·去法调研（头号疑点 — 「入口都没开？」）

### 2.1 结论
**入口是「开」的，机制完全跑得通**（`test/journey.test.js` §5/§5.5 全程验证：
名额大会→五日舆图→墨蛟决战→出图筑基，绿灯）。**问题 100% 在引导，不在功能。**
血色禁地**不是舆图上一个能「走过去」的地点**——它是修为+日历到点后**在山门大殿自动触发的剧情**（`jindi_meeting`）。玩家在地图上找入口，自然「找不到」。

### 2.2 完整触发链（代码实证）

```
hf_yaoyuan (节点27, story.js:848-855)
  └─ onArrive: s.flags.xueshi_due = absMonth() + 30   // 立 30 月日历锚
        │
        ▼  自由大帆期（修炼 / 药园差事 / 坊市）
chen_rescue (节点28, story.js:869-871)   ← 隐藏总闸！
  cond: yaoyuan_started && realmIndex>=10 && fangshi_visited>=1 && !luyunfeng_dead
  ├─ realmIndex>=10  ……练气十一层（修炼达成）
  └─ fangshi_visited>=1 ……必须先去「万宝楼·坊市」买过东西 / 或听过向之礼
        │  （fangshi_visited 仅在 wanbaoBuy / xiangIntel 时 +1，engine.js:930 等）
        ▼  杀陆云风、救陈巧倩 → chen_after(节点29)
jindi_meeting (节点30, story.js:947-949)   ← 「名额之会」= 真正的「入口」
  cond: xueshi_due && absMonth()>=xueshi_due && realmIndex>=10 && !xueshi_opened
  └─ 选「踏入血幕」→ jindi_enter → ExploreMap L1「血色禁地五日」
```

### 2.3 引导为何不充分（三宗罪）

1. **隐藏总闸 `fangshi_visited` 全无明示。**
   `jindi_meeting` 排在 `chen_rescue` 之后（顺序指针），而 `chen_rescue` 要求**去过坊市**。
   若玩家从不光顾万宝楼，`chen_rescue` 永不触发 → `jindi_meeting` 永不到达 →
   纵然练气十一层、30 月已满，**也卡死在「约余 0 月」无路可走**。这正是「入口没开」的真相。
2. **天命提示是「叙事腔」不是「指令腔」。**
   `chen_rescue.objHint`（story.js:874）：「练气十一层、坊市备货齐整——血色试炼在望……」
   ——条件其实都写了（十一层＋坊市），但读起来像背景旁白，没有「→ 去万宝楼采买」的动作指令；
   也没告诉玩家坊市在哪、要**真买一件**才算数。
3. **「0 月逼迫」。** `ui.js:94-103` 血禁卡 `left=max(0, due-absMonth)`：
   日历到点但修为没到时，永远显示「约余 0 月 / 入选门槛：练气十一层」，
   既像 deadline 在催，又给不出下一步——劝退。

### 2.4 修法（= 交接文档 Fix①「门槛软化」）
- **story.js:949 双路触发**：让名额之会**修为到即可开**，不再死等 30 月日历——
  `(absMonth>=xueshi_due || realmIndex>=10) && realmIndex>=10 && chen 线已过 && !opened`，
  去掉「强到了还要空耗时间」与「时间到了修为没到卡 0 月」两头难受。
- **ui.js:94-103 写清主线**：血禁卡直接写路：
  「练气十一层 ＋ 去**万宝楼坊市**备货（顺道听廊下向之礼一席话）→ 大比时节于山门大殿自动开启名额之会」；
  修为未到时改写「修为到了即可参选，不必赶时间」，删掉催命的「约余 0 月」。

> 备注：游戏内**其实已有**一段绝佳引导——万宝楼廊下的「向之礼」(`Engine.xiangIntel`,
> engine.js:925-936) 会把血色禁地门道讲得明明白白，**且听他说话也会 `fangshi_visited+1`**。
> 它既是引导又是开闸，却藏在「上前听他闲谈」按钮后，玩家未必会点。Fix① 把这条路在天命栏点明即可。

## 3. 全主线引导审计（逐章「下一步是否清楚」）

总体：主线 95% 为**顺序自动推进**（`checkStory` 在度月/行动后自动放下一卡），
天命栏（`currentObjective`, engine.js:5134-5154）对未达条件的下一卡显示 objTitle/objHint，
日历锚（升仙大会）有专门倒计时（engine.js:5143）。**仅 4 处需要玩家「主动做特定事」而引导偏弱：**

| 关口 | 位置 | 现状 | 风险 | 建议 |
|---|---|---|:--:|---|
| **血色禁地** | 节点27→30 | 隐藏坊市闸 + 0月逼迫 | 🔴高 | Fix①（见 §2.4） |
| **筑基** | 节点34→35 `qingyuan_gift` cond=已筑基 | 无 objTitle；炼丹靠 home 按钮、突破靠洞府「尝试突破」 | 🟡中 | 给 mojiao_after/天命栏补一句「炼筑基丹 → 洞府冲击筑基」 |
| 升仙大会 | 节点21 | 已有倒计时 hint | 🟢低 | 无需改 |
| 代工·元武国 | 节点37 `where=yuanwu` | objTitle【北上元武国·代工】+「前往元武国」 | 🟢低 | 无需改 |

其余 where 门控仅 `showdown`(yaolu，玩家本就在场)、`gang_conflict`(wuting)、`ye_finale`(huangfeng_gate，玩家在家)，自洽。
**无任何节点使用动态 `[fn]` objHint**；无「条件已足却无任何提示」的断头节点（除 §2 血禁与 §3 筑基两处）。

## 4. 逐节点缺口表

### 1.七玄门（5/15 已具引擎演出）

| # | id | 题 | 演出 | CG | 天命锚 | 现有原语 |
|---|----|----|:--:|:--:|------|--------|
| 0 | village | 青牛镇 · 韩家 | ✗ | ✗ | — | （纯文本） |
| 1 | journey | 赴 考 | ✗ | ✗ | — | （纯文本） |
| 2 | exam | 七玄门 · 入门选拔 | ✗ | ✗ | — | （纯文本） |
| 3 | intro | 拜师 · 墨大夫 | ✗ | ✗ | — | （纯文本） |
| 4 | friends | 同门之谊 | ✗ | ✗ | — | （纯文本） |
| 5 | bottle | 神秘小瓶 | ✗ | ✓bottle | — | （纯文本） |
| 6 | secret_cultivate | 暗藏的锋芒 | ✗ | ✗ | 【暗修精进】 | （纯文本） |
| 7 | zhangtie | 挚友失踪 | ✓ | ✓qixuan_ye | 【挚友外出未归】 | amb shot fx sfx bgm wait |
| 8 | showdown_prep | 夺舍之谋 | ✓ | ✓qixuan_ye | — | bgm shot |
| 9 | showdown | 夺舍之夜 | ✓ | ✓duoshe | 【夺舍之夜将至】 | amb fx shot sfx wait fight |
| 10 | take_identity | 李代桃僵 | ✗ | ✗ | — | （纯文本） |
| 11 | gang_conflict | 野狼帮 | ✗ | ✗ | 【蛰伏待时】 | （纯文本） |
| 12 | jinguang_arrives | 金光上人 | ✗ | ✗ | — | （纯文本） |
| 13 | jinguang_fight | 暗算金光上人 | ✓ | ✓jinguang | — | shot wait sfx fight |
| 14 | arc_end | 升仙令 · 离门 | ✓ | ✓departure | — | shot fx sfx bgm wait |

### 2.嘉元城·升仙（4/9 已具引擎演出）

| # | id | 题 | 演出 | CG | 天命锚 | 现有原语 |
|---|----|----|:--:|:--:|------|--------|
| 15 | mo_arrive | 嘉元城 · 墨府投信 | ✓ | ✓mofu | 【南下嘉元城】 | bgm cam fx actor guide |
| 16 | mo_crisis | 墨府 · 暗流 | ✓ | ✓mofu | 【墨府客居】 | bgm cam sfx beat actor |
| 17 | mo_resolve | 暖阳宝玉 · 嫁妆 | ✗ | ✗ | 【墨府之诺】 | （纯文本） |
| 18 | wan_meet | 太南小会 · 引路人 | ✗ | ✗ | 【南下太南谷】 | （纯文本） |
| 19 | qingwen_plot | 青纹道人 · 黑手 | ✗ | ✗ | 【小会风云】 | （纯文本） |
| 20 | wan_hunt | 搭伴探山 | ✗ | ✗ | 【会期将近】 | （纯文本） |
| 21 | xianhui_open | 升仙大会 · 测灵台 | ✓ | ✓xianhui_tai | 【升仙大会】 | bgm shot sfx fx |
| 22 | wan_death | 暮色森林 · 故人之血 | ✓ | ✓tainan_lin | — | shot amb wait sfx |
| 23 | xianhui_end | 升仙令 · 入谷 | ✗ | ✗ | — | （纯文本） |

### 3.黄枫谷（4/15 已具引擎演出）

| # | id | 题 | 演出 | CG | 天命锚 | 现有原语 |
|---|----|----|:--:|:--:|------|--------|
| 24 | hf_arrive | 入谷 · 吴师叔 | ✗ | ✗ | 【黄枫谷报到】 | （纯文本） |
| 25 | hf_duodan | 得丹 · 夺丹 | ✓ | ✓huangfeng_zhishi | — | shot sfx cam wait |
| 26 | hf_zhangmen | 掌门 · 无公道 | ✗ | ✗ | — | （纯文本） |
| 27 | hf_yaoyuan | 百药园 · 马师伯 | ✗ | ✗ | — | （纯文本） |
| 28 | chen_rescue | 坊市归途 · 林中血 | ✓ | ✓huangfeng_lin | 【山雨欲来】 | amb shot sfx cam fight |
| 29 | chen_after | 林中事了 · 忘尘丹 | ✗ | ✗ | — | （纯文本） |
| 30 | jindi_meeting | 血色禁地 · 名额之会 | ✓ | ✓huangfeng_dadian | 【大比时节】 | shot sfx |
| 31 | jindi_days | 血色禁地 · 五日 | —停用 | ✗ | — | （纯文本） |
| 32 | fengyue_ambush | 中环 · 狙杀者 | —停用 | ✗ | — | （纯文本） |
| 33 | jindi_deep | 深处 · 血潭 | —停用 | ✗ | — | （纯文本） |
| 34 | mojiao_after | 潭边 · 不能说的，与记一辈子的 | ✗ | ✗ | — | （纯文本） |
| 35 | qingyuan_gift | 筑基 · 青元剑诀 | ✓ | ✓huangfeng_dadian | — | shot bgm fx sfx |
| 36 | dongfu_pick | 洞府 · 安身之地 | ✗ | ✗ | — | （纯文本） |
| 37 | qiyunxiao_daigong | 代工 · 百艺坊巧匠 | ✗ | ✗ | 【北上元武国 · 代工】 | （纯文本） |
| 38 | ye_finale | 尾声 · 叶师叔之报 | ✗ | ✗ | — | （纯文本） |

### 4.魔道争锋（12/33 已具引擎演出）

| # | id | 题 | 演出 | CG | 天命锚 | 现有原语 |
|---|----|----|:--:|:--:|------|--------|
| 39 | yanjia_summon | 魔道争锋篇·前置 · 燕家堡调令 | ✗ | ✗ | 【燕家堡调令】 | （纯文本） |
| 40 | yanjia_reunion | 燕家堡 · 故人重逢 | ✓ | ✓yanjia_jiaochang | — | amb shot sfx |
| 41 | yanjia_boss | 燕家堡之战 · 战王蝉破阵 | ✓ | ✓yanjia_xueye | — | amb sfx shot fx fight |
| 42 | yanjia_escape | 燕家堡 · 逃出生天 | ✓ | ✓yanjia_kuiwei | — | shot sfx fx |
| 43 | modao_e1_conscript | 魔道争锋·第一幕 · 烽火征调 | ✗ | ✓kuangchang | 【听候征调】 | （纯文本） |
| 44 | modao_e1_betray | 矿洞黑吃黑 · 阴手现形 | ✗ | ✓kuangdong | — | （纯文本） |
| 45 | modao_e1_spider | 矿洞最深处 · 血玉蜘蛛 | ✗ | ✓kuangdong | — | （纯文本） |
| 46 | modao_e1_fortune | 矿洞密室 · 机缘 | ✗ | ✓jiyuan_shi | — | （纯文本） |
| 47 | modao_e1_chen_forgot | 待命营 · 故人不识 | ✗ | ✓kuangchang | — | （纯文本） |
| 48 | modao_e1_chen_remember | 待命营 · 故人相识 | ✗ | ✓kuangchang | — | （纯文本） |
| 49 | modao_e2_muster | 金鼓原 · 前哨集结 | ✗ | ✓kuangchang | — | （纯文本） |
| 50 | modao_e2_patrol | 金鼓原 · 巡逻遭遇战 | ✗ | ✓kuangchang | — | （纯文本） |
| 51 | modao_e2_dongxuaner | 金鼓原 · 暗线·一纸急报 | ✗ | ✓kuangchang | — | （纯文本） |
| 52 | modao_e2_nangongwan | 金鼓原 · 一枚炒栗子 | ✗ | ✓kuangchang | — | （纯文本） |
| 53 | modao_e2_jingcheng | 金鼓原 · 赴京 | ✗ | ✓departure | — | （纯文本） |
| 54 | modao_e3_rujing | 京城 · 天子脚下 | ✗ | ✓jingcheng | 【入京】 | （纯文本） |
| 55 | modao_e3_shizong | 京城 · 连环失踪案 | ✗ | ✓jingcheng | 【查案】 | （纯文本） |
| 56 | modao_e3_yanhui | 馨王府 · 夜宴重逢 | ✗ | ✓wangfu_yan | 【夜宴】 | （纯文本） |
| 57 | modao_e3_tieluo | 血池 · 血侍铁罗 | ✗ | ✓jingcheng | 【救人】 | （纯文本） |
| 58 | modao_e3_tieluo2 | 血池 · 化茧·血茧铁罗 | ✗ | ✓jingcheng | 【力破血茧】 | （纯文本） |
| 59 | modao_e3_wuse | 五色门 · 收口 | ✗ | ✓jingcheng | 【报仇】 | （纯文本） |
| 60 | modao_e3_farewell | 京城 · 长街晨别 | ✗ | ✓jingcheng | 【道别】 | （纯文本） |
| 61 | modao_e4_shenxun | 皇宫决战 · 审讯与集结 | ◔ | ✓jingcheng | 【夜闯皇城】 | shot |
| 62 | modao_e4_santuan | 皇宫决战 · 三组对位群架 | ✓ | ✓huanggong_men | 【群架·杀开一条道】 | shot sfx fight |
| 63 | modao_e4_dive | 皇宫决战 · 血池大殿 | ✓ | ✓xuechi_dian | 【杀至最底】 | shot fx sfx |
| 64 | modao_e4_liujing_live | 皇宫决战 · 阴手·示警 | ✓ | ✓xuechi_dian | 【喝破伏兵】 | cam sfx |
| 65 | modao_e4_liujing_die | 皇宫决战 · 阴手·身陨 | ✓ | ✓xuechi_dian | 【猝不及防】 | shot wait |
| 66 | modao_e4_xuwang | 皇宫决战 · 胥王现身 | ✓ | ✓xuechi_dian | 【且战且退】 | shot sfx fx |
| 67 | modao_e4b_tuoshi | 皇宫决战 · 拖时布阵 | ✓ | ✓xuechi_dian | 【且战且退·拖住他】 | shot sfx fight |
| 68 | modao_e4b_zhencheng | 皇宫决战 · 阵成·反制 | ✓ | ✓xuechi_dian | 【颠倒五行·反制】 | fx sfx cam fight |
| 69 | modao_e4b_finale_live | 皇宫决战 · 真凰符·终结 | ✓ | ✓xuechi_dian | 【毕其功于一役】 | shot fx sfx |
| 70 | modao_e4b_finale_die | 皇宫决战 · 真凰符·终结 | ✓ | ✓xuechi_dian | 【为刘师兄·了结此獠】 | shot fx sfx |
| 71 | modao_e4b_likjing | 皇宫决战 · 离京 | ◔ | ✓xuechi_dian | 【尘埃落定·离京】 | shot guide |

### 5.再别天南（15/15 已具引擎演出）

| # | id | 题 | 演出 | CG | 天命锚 | 现有原语 |
|---|----|----|:--:|:--:|------|--------|
| 72 | zaibie_open | 再别天南 · 回天南 | ✓ | ✓jiayuan_guandao | 【南返嘉元城】 | shot amb |
| 73 | zaibie_quhun_refine | 再别天南 · 身外化身 | ✓ | ✓jingshi_huashen | 【祭炼曲魂·身外化身】 | fx sfx |
| 74 | zaibie_a1_jinbei | 再别天南 · 金背妖螂 | ✓ | ✓luanshipo | 【御灵宗拦路·金背妖螂】 | fx |
| 75 | zaibie_a1_duoshe | 再别天南 · 夺剑 | ✓ | ✓luanshipo | 【夺御灵宗夺舍者之绿煌剑】 | cam sfx fx |
| 76 | zaibie_a1_after | 再别天南 · 战报 | ✓ | ✓jiayuan_inn | 【绿煌剑入手·金鼓原急报】 | shot sfx |
| 77 | zaibie_a2_jingu | 再别天南 · 金鼓原决战 | ✓ | ✓jingu_yuan | 【金鼓原·擒贼先擒王】 | fx actor |
| 78 | zaibie_a2_hushan | 再别天南 · 护山大阵 | ✓ | ✓hushan_zhen | 【死守阵脚·待阵成】 | fx |
| 79 | zaibie_a2_lihuayuan | 再别天南 · 燃命 | ✓ | ✓hushan_zhen | 【李化元殉道】 | cam actor fx |
| 80 | zaibie_a3_yuanwu | 再别天南 · 亡命元武 | ✓ | ✓yuanwu_diku | 【元武国·古阵图纸】 | shot amb |
| 81 | zaibie_a4_hudao | 再别天南 · 护道 | ✓ | ✓yanjia_canyuan | 【三人护道·撑过追杀】 | actor |
| 82 | zaibie_a4_diejing | 再别天南 · 跌境 | ✓ | ✓yanjia_canyuan | 【暗算·修为暴跌】 | fx sfx |
| 83 | zaibie_a4_lingshi | 再别天南 · 赠别 | ✓ | ✓kuangdong_kou | 【南宫婉赠灵石】 | actor |
| 84 | zaibie_a4_kuangdong | 再别天南 · 矿洞拖时 | ✓ | ✓chuansong_zhen | 【死守洞口·待古阵启】 | fx |
| 85 | zaibie_cut1_likai | 再别天南 · 离开天南 | ✓ | ✓chuansong_zhen | 【大挪移令·强启古阵】 | cam actor beat fx sfx |
| 86 | zaibie_cut2_luanxinghai | 再别天南 · 到达乱星海 | ✓ | ✓luanxinghai | 【落海 · 首见乱星海】 | cam fx sfx wait guide |

### 6.初入星海（19/20 已具引擎演出）

| # | id | 题 | 演出 | CG | 天命锚 | 现有原语 |
|---|----|----|:--:|:--:|------|--------|
| 87 | starsea_a1_open | 初入星海 · 落海 | ✓ | ✓luanxinghai | 【落海 · 海中遇袭】 | cam fx sfx |
| 88 | starsea_a1_kuixing | 初入星海 · 登临魁星岛 | ✓ | ✓kuixing_land | 【登岛 · 魁星城】 | cam fx |
| 89 | starsea_a1_leitai | 初入星海 · 镇妖台擂台 | ✓ | ✗ | 【擂台 · 藏拙险胜】 | fx sfx |
| 90 | starsea_a1_xiaohuan | 初入星海 · 小寰岛洞府 | ✓ | ✓xiaohuan_dongfu | 【立身 · 小寰岛】 | cam |
| 91 | starsea_a1_biguan | 初入星海 · 闭关二十载 | ✓ | ✓sanzhuan | 【苦修 · 拾回巅峰】 | cam fx sfx |
| 92 | starsea_a2_wenqiang | 镇妖大典 · 再遇文樯 | ✓ | ✗ | 【引线 · 降尘丹】 | fx |
| 93 | starsea_a2_dadian | 镇妖大典 · 擂台开场 | ✓ | ✓doushouchang | 【大典 · 婴鲤兽登场】 | cam fx sfx |
| 94 | starsea_a2_yingli | 镇妖大典 · 极限斩杀 | ✓ | ✗ | 【困兽 · 越级斩杀】 | fx sfx |
| 95 | starsea_a2_jingbian | 镇妖大典 · 惊变 | ✓ | ✓leipeng_pofeng | 【惊变 · 雷鹏破封】 | cam fx sfx wait |
| 96 | starsea_a2_jiuziling | 镇妖大典 · 救小紫灵 | ✓ | ✓jiu_ziling | 【护送 · 斩古长老脱身】 | fx sfx |
| 97 | starsea_a2_luan | 镇妖大典 · 乱星海大乱 | ✓ | ✓luanxinghai | 【大乱 · 遁出魁星岛】 | cam fx sfx guide |
| 98 | starsea_a3_chuhai | 外星海 · 顺乱出海 | ✓ | ✗ | 【乱中取利 · 出海】 | cam fx |
| 99 | starsea_a3_shijin | 外星海 · 噬金虫 · 霓裳草 | ✓ | ✗ | 【奇虫 · 取丹之器】 | fx sfx guide |
| 100 | starsea_a3_waihai | 外星海 · 噬金虫群猎杀 | ✓ | ✓waihai_lie | 【群猎 · 积丹发家】 | fx sfx |
| 101 | starsea_a3_jinkui | 星海风云 · 金魁示威极阴岛 | ✓ | ✗ | 【远观 · 大修士的手段】 | cam fx sfx |
| 102 | starsea_a4_tianxing | 天星城 · 落户 | ✓ | ✗ | 【内海都会 · 叩关之地】 | bgm fx |
| 103 | starsea_a4_ziliang | 天星城 · 集齐资粮 | ✓ | ✗ | 【觅长生 · 攒资粮】 | fx sfx |
| 104 | starsea_a4_shibai | 天星城 · 首番结丹 · 铩羽 | ✓ | ✓luanxinghai | 【屡挫 · 平生执念】 | cam fx sfx guide |
| 105 | starsea_a4_jieguan | 天星城 · 择吉叩关 | ◔ | ✗ | 【觅长生 · 择时渡劫】 | guide |
| 106 | starsea_a4_jindan | 天星城 · 金丹大成 | ✓ | ✓jindan | 【正向质变 · 扬眉吐气】 | cam fx sfx guide |

## 5. 补演出 / CG 排期（按交接文档优先级）

配方参考 `docs/staging-scene-plan.md`（R-反杀 / R-突破异象 / R-群架 等模板）。

1. **七玄门开篇（~10 节点：0-6,10-12）** — 开场三大高潮零运镜，优先。村→赴考→选拔→拜师→结友→小瓶→暗修→李代桃僵→野狼帮→金光上人。
2. **黄枫谷（8 节点：24,26,27,29,34,36,37,38）** — 入谷四连后半截 + 潭边筑基前后 + 洞府/代工/尾声，整篇偏薄。
3. **魔道 e1–e3（18 节点：43-60）** — **全部已有 CG、零演出**，性价比最高，纯补 `text[]` 演出原语即可。
4. **升仙（≈3 节点：17/18/19/20/23 中择叙事高潮）** — 升仙大会后半截接续。
5. **星海缺 CG（9 节点：89,92,94,98,99,101,102,103,105）** — 已有演出，缺 CG，`GEN_PROXY=none node scripts/genart.js <KEY> <id>`（横版 `cg_xxx`／竖版 `cg_xxx_p`）。

## 6. 四件小项（交接文档锚点复核）

| # | 项 | 锚点（已复核） | 备注 |
|---|---|---|---|
| ① | 血色禁地门槛软化 | story.js:949（cond 双路）＋ ui.js:94-103（血禁卡文案） | 见 §2.4 |
| ② | 铁奴·张铁 → 曲魂 改名 | engine.js:4602/4606、state.js:183、main.js:140、ui.js:1516（`"曲魂":"tienu"`） | **不动** engine.js:3364 战斗敌人；story.js 中「生前张铁」对白保留 |
| ③ | 曲魂驻守抉择+钩子 | story.js:493-527 `mo_resolve` 改抉择（flag `quhun_stay_jiayuan`）＋ state.js:182-184 随从去重 | — |
| ④ | 顶部 UI 排版重叠 | ui.js `renderLocals()` | — |

> 流程硬约束：改完 `node test/run.js` + `node test/*.test.js`；`node scripts/bump.js` 同步版本戳；
> 推码走 GitHub REST API + PAT（git push/gh 走代理 403）；合并后拉 `ver.txt` 核验。
