# 篇章游玩体验调研 · Agent 引导手册（初入星海篇基准）

> 目的：让任何接手的 agent 都能**亲自把一整篇从头玩到尾**，并产出一份**结构化、可横向对比**的《篇章游玩体验报告》。
> 报告要回答的核心问题：**哪里太简单/太难、哪里太繁琐、哪些道具没做或没给提示、移动端体验如何、美术/演出是否到位、有没有 bug。**
>
> 本手册以**初入星海篇（`starsea`，增量 1-7 已上线）**为首个调研对象写成；换篇章时把第 4 节的 golden-path 节点表替换为对应篇章即可，其余流程通用。
>
> 🔖 **进行中的活实例**：**七玄门篇（qixuan）体验审阅**有可恢复存档 + 续玩 TODO，见 `playtest/RESUME-qixuan.md` 与 `playtest/save-qixuan.json`。接手 qixuan 审阅请先读那份交接文档（用户已显式要求该篇存档/文档落库续玩，对下方 R5 属本任务豁免）。

---

## 0. 这份文档怎么用

1. 通读本手册（尤其第 1 节红线、第 2 节启动、第 4 节逐节脚本）。
2. 按第 2 节把游戏在 **iPhone 14 Pro Max 视口**跑起来。
3. 按第 3 节选择「完整通关」或「聚焦本篇·快进」模式进入目标篇章。
4. 按第 4 节逐节游玩，边玩边按第 5 节的观察清单记笔记。
5. 全程按第 6 节录屏 + 注记。
6. 玩完按第 7 节模板写《体验报告》，按第 8 节交付。

---

## 1. 红线与前提（必须遵守）

- **R1 · 移动端基准（硬约束）**：本作主攻手机端。一切可视化游玩/验收/录屏**一律用 iPhone 14 Pro Max 视口（430×932，DPR 3）**。Chrome DevTools → 设备模式（`Ctrl+Shift+M`）→ 设备下拉选「iPhone 14 Pro Max」。桌面宽屏只作旁证。
- **R2 · 考据红线**：评判剧情/人物/物品是否「对/缺/错」时，**动漫版为唯一锚点**，小说仅补细节。拿不准就 `grep docs/`（尤其 `lore-churu-xinghai.md`、`churu-xinghai-design.md`），**绝不凭记忆下判断**。报告里写「考据问题」要标来源。
- **R3 · 只玩不改**：这是**体验调研**任务，默认**只观察、只记录、不改代码**。发现的问题写进报告交给用户定夺；**除非用户明确要你修**，不要边玩边改。
- **R4 · 报告而非臆断**：「太难/太简单」要尽量带**可复现的证据**（第几节、什么操作、看到什么数值/胜率/卡点），不要只写主观感受。
- **R5 · 不污染仓库**：报告、截图、临时脚本默认**不入库**（除非用户要求把报告归档到 `docs/playtest-reports/`）。临时存档/控制台脚本验毕即弃。

---

## 2. 怎么把游戏跑起来

游戏是**纯前端 vanilla JS**（无构建无依赖），全局对象架构，localStorage 存档（键名 `frxxz_save_v1`）。两种跑法任选：

### 方式 A · 本地起服（推荐·可玩最新本地代码）
```bash
cd <repo>            # 仓库根目录
node scripts/_serve.js        # 默认端口 8011；可传参 node scripts/_serve.js 8011
# 浏览器开 http://127.0.0.1:8011/
```
服务器已设 `Cache-Control: no-store`，改完代码刷新即生效。

### 方式 B · 线上已部署版（验已上线效果）
```
https://chentong227.github.io/fanrenxiuxianzhuan/
```
确认版本：`https://chentong227.github.io/fanrenxiuxianzhuan/ver.txt?cb=<随机>`（当前应 ≥ 166）。

### 视口与缓存
- 进页面后立刻按 R1 切到 iPhone 14 Pro Max 视口。
- 若怀疑旧缓存/旧存档干扰，开 DevTools Console 跑 `localStorage.clear()` 再刷新（会清掉存档，慎用）。

### 既有调试入口（URL 参数，免跑剧情直接验某系统）
- `?debugfight=<敌id>[&layer=N][&side=1]` —— 直接开一场战斗，调战斗 UI / 招式。
- `?debugmap=1[&m=<seed>]` —— 直接进血色禁地箱庭舆图（探索系统）。
- `?dbgpos=1` —— 战斗内打印单位几何快照（查"卡进地底"类 bug）。
> 这些只验单系统，**不能代替**完整篇章体验。篇章体验必须走第 3、4 节。

---

## 3. 怎么进入目标篇章（以 `starsea` 为例）

游戏剧情是**顺序制**：`Engine.checkStory()` 按 `STORY` 列表顺序找**第一个** `cond(s)` 为真且未被 `skipIf(s)` 跳过的节点弹出。篇章由 flag 链推进（见第 4 节）。已挂在 `window` 上的全局对象：`State` / `Engine` / `Chapters` / `DATA` / `UI`（其余如 `WORLD`/`STORY` 等在控制台用裸名直接访问，同属全局作用域）。

### 模式甲 · 完整通关（最真实，时间够就选这个）
从新档开始：七玄门篇 → 黄枫谷篇 → 魔道争锋篇 → 再别天南篇 → **初入星海篇**。
- 优点：角色境界/法术/法宝/心境**全程真实**，战斗手感与节奏评估最可信。
- 缺点：耗时长（四篇前置）。适合作为长任务或多次会话累积。

### 模式乙 · 聚焦本篇·控制台快进（推荐用于单次体验报告）
在 DevTools Console 里把存档推进到「再别天南篇末·刚落海」的状态，再让 `starsea` 首节弹出。**先开一次新游戏建档**（让 `State.data` 存在），然后：

```js
// —— 把角色推进到「准备进初入星海篇」的合理状态 ——
const s = State.data;
s.realmIndex = 13;                       // 筑基初期（本篇主体恒筑基；结丹在篇末叩关时玩家亲手破）
s.cultivation = 0;
s.age = 130; s.year = 117; s.month = 1;  // 时间观感对齐（漂泊星海多年；数值非硬性）
State.setFlag("arc1_complete");
State.setFlag("arc2_complete");
State.setFlag("arc3_complete");
State.setFlag("arc4_complete");          // ← 这一个是 starsea 首节 starsea_a1_open 的开闸条件
Chapters.unlock("starsea");
Chapters.enter("starsea");               // activeChapter=starsea，location=kuixing_island
State.save();
location.reload();                       // 重载后 Engine.checkStory() 会弹出 starsea_a1_open
```

> ⚠ **快进的代价（务必在报告里注明）**：这样进来的韩立**装备/法术/法宝是新手档水平**，不是真正打到筑基大圆满的配置。这会让**战斗手感评估失真**。两个补救：
> 1. 评战斗时，额外用控制台补一套筑基期代表手段再打（按需 `Loadout.equipSkill(s, "<技能id>")`、`State.give("<道具id>", n)`；技能/道具 id 去 `data.js` 查）；
> 2. 或在报告里明确写「本次为快进档，战斗平衡仅供参考，建议下次用完整通关复核」。
> 叙事/节奏/美术/移动端 UI/提示缺失这些维度，快进档评估**不受影响**，可放心写。

### 进入后如何"往下走"
每个节点底部是若干选项，点选项即推进（部分选项触发战斗，见第 4 节 `战斗` 列）。若某节点没自动弹出，可在 Console 手动 `Engine.checkStory()` 催一次；推进时间用顶栏的修炼/赶路/打坐等行动（会自然 `advanceMonth → checkStory`）。

---

## 4. 初入星海篇 · Golden-Path 逐节脚本（20 节）

顺序固定、flag 链闭合。**“预期美术”列是验收锚点**：到该节点该看到对应立绘/CG/场景/战姿；缺图/破图/张冠李戴都要记进报告（第 5 节 E 项）。资产清单依据 §九美术清单（已拍板）。

| # | 节点 id | 幕·标题 | 玩家该做什么 | 战斗 | 预期美术（看到没/对不对） | 推进 flag |
|---|---|---|---|---|---|---|
| 1 | `starsea_a1_open` | 一①·落海·斩低阶妖兽 | 选战斗·清场 | ✔ 外星海妖兽 | CG `luanxinghai`；战姿 `bt_waihai` | `starsea_yaoshou_done` |
| 2 | `starsea_a1_kuixing` | 一②·登临魁星岛 | 读世界观·乌丑露出 | — | CG `kuixing_land`；场景 `kuixing_island`；立绘 `gu_family`/`wuchou` | `starsea_kuixing_done` |
| 3 | `starsea_a1_leitai` | 一③·镇妖台擂台·藏拙 | 1v1·演示「藏拙」 | ✔ 擂台对手 | bgm `combat` | `starsea_leitai_done` |
| 4 | `starsea_a1_xiaohuan` | 一④·小寰岛开洞府 | 安家·灵气稀薄孤岛 | — | CG `xiaohuan_dongfu`；场景 `xiaohuan_island` | `starsea_xiaohuan_done` |
| 5 | `starsea_a1_biguan` | 一⑤·闭关二十载·三转一转 | 叙事压缩（不动数值） | — | CG `sanzhuan` | `starsea_biguan_done` |
| 6 | `starsea_a2_wenqiang` | 二①·再遇文樯·闻大典/降尘丹 | 对话·擦肩小紫灵 | — | 立绘 `wen_qiang`；bgm `journey` | `starsea_wenqiang_done` |
| 7 | `starsea_a2_dadian` | 二②·镇妖大典开场 | 入斗兽场·嘉宾席 | — | CG `doushouchang`；立绘 `miaoyin_zhangmen`/`fengxi`/`wuchou` | `starsea_dadian_done` |
| 8 | `starsea_a2_yingli` | 二③·极限斩婴鲤兽 | 越阶斩杀（boss） | ✔ 婴鲤兽 | 战姿 `bt_yingli`；立绘 `feng_sanniang`；bgm `boss` | `starsea_yingli_done` |
| 9 | `starsea_a2_jingbian` | 二④⑤·大典惊变（cutscene） | 雷鹏破封·风希斩雷鹏 | —(演出) | CG `leipeng_pofeng` | `starsea_jingbian_done` |
| 10 | `starsea_a2_jiuziling` | 二⑥·救小紫灵·斩古长老 | 护送逃亡（survive） | ✔ 逆星盟古长老 | CG `jiu_ziling`；战姿 `bt_guzhanglao`；立绘 `wang_ning` | `starsea_jiuziling_done` |
| 11 | `starsea_a2_luan` | 二⑦·乱星海大乱·遁出 | 携汪凝出海 | — | CG `luanxinghai` | `starsea_luan_done` |
| 12 | `starsea_a3_chuhai` | 三①·顺乱出海·外星海猎场 | 决意猎妖积丹 | — | bgm `journey` | `starsea_chuhai_done` |
| 13 | `starsea_a3_shijin` | 三②·偶得噬金虫·霓裳草 | 授噬金虫→**四用法入战** | — | （噬金虫四式上膛·验法宝栏） | `starsea_shijin_done` |
| 14 | `starsea_a3_waihai` | 三③·外星海致富 | 引妖·群猎（FIGHT） | ✔ 外星海妖兽群 | CG `waihai_lie`；战姿 `bt_waihai` | `starsea_zhifu_done` |
| 15 | `starsea_a3_jinkui` | 三④·金魁示威极阴岛 | 背景强者演出·worldNews | — | 立绘 `jinkui`；场景 `jiyin_island` | `starsea_jinkui_done` |
| 16 | `starsea_a4_tianxing` | 四①·落户天星城 | 人修文明中心·双骄惊鸿 | — | 场景 `tianxing_city`；bgm `town` | `starsea_tianxing_done` |
| 17 | `starsea_a4_ziliang` | 四②·集齐结丹资粮 | 雪灵水/天火液+大衍诀三层 | — | bgm `journey` | `starsea_ziliang_done` |
| 18 | `starsea_a4_shibai` | 四③·首次结丹·铩羽 | **脚本必败演出**（fail-forward） | —(演出) | CG `luanxinghai` | `starsea_jiedan_fail_done` |
| 19 | `starsea_a4_jieguan` | 四④·择吉叩关引导 | **去天星城洞府叩关·亲手渡劫破 16→17** | ✔ 心魔劫（突破 UI） | bgm `tense` | `starsea_jieguan_done` |
| 20 | `starsea_a4_jindan` | 四⑤·金丹大成 | realmIndex→17·章末高潮 | — | CG `jindan`；故人钟 | `arc5_complete` + 解锁 `xinghaifeichi` |

> 关键依赖：第 1 节需 `arc4_complete`；第 20 节需 `realmIndex >= 17`（必须在第 19 节真渡劫破上去，光走剧情不会自动升）。`内外星海通道` 场景（`xinghai_tongdao`）在惊变/乱海相关节点的背景里出现，留意。

---

## 5. 重点观察清单（边玩边记，对应报告各章）

为每一项记下「**在第几节 / 什么操作 / 看到什么 / 我的判断**」：

- **A · 难度曲线**：哪场战斗太简单（无脑过）/太难（反复败、看不懂怎么赢）？藏拙擂台(3)、越阶斩婴鲤兽(8)、护送survive(10)、致富群猎(14)、结丹渡劫心魔劫(19) 五场逐一评。胜率手感、是否有「输得莫名其妙」（违反 fail-forward 契约）。
- **B · 节奏/繁琐度**：有没有「点了太多下才推进」「赶路/集资粮(17)太肝」「连续纯文本太长没喘息」？锚-帆节奏是否成立。
- **C · 缺道具 / 缺提示**：剧情提到但游戏里**拿不到/没入背包**的道具？该给提示却没给（如「噬金虫四用法」上膛后玩家是否知道怎么用、法宝栏是否有引导）？结丹六资是否清楚「还差什么、去哪拿」？
- **D · 移动端 UI（R1 视口）**：竖屏单列布局、顶栏「舆图＋⋯」、底部「见闻/行动/韩立」是否好用？立绘/CG 在 430 宽下是否被裁/溢出/糊；文字是否过小/折行难看；按钮是否够大可点。
- **E · 美术 / 演出**：按第 4 节「预期美术」列逐一核对——该出现的立绘/CG/场景/战姿是否出现、是否对得上人物考据（R2）、有无破图/抠图毛边/黑边/张冠李戴/竖图横图错位。BGM 是否贴合（boss/tense/sorrow/triumph…）。
- **F · 战斗手感细节**：手牌三区（法宝/法术/瞬发）是否清晰；噬金虫四式共享池「打一分少一分」的取舍感是否传达到；越阶靠底牌咬的设计意图是否被玩家感知。
- **G · Bug / 异常**：报错（开 Console 看红字）、卡死、存读档异常（刷新后进度对不对）、数值溢出、立绘错位、点击无响应。
- **H · 一致感 / 沉浸**：剧情强度与数值强度是否匹配；背景强者（金魁等）是否「在场但不抢玩家赛道」；有没有出戏的地方。

---

## 6. 录屏与注记规范

- 录屏**前**先最大化窗口、切好 iPhone 14 Pro Max 视口。
- 用结构化注记标记关键时刻：
  - `setup`：进入/快进/切视口等准备动作。
  - `test_start`：一段要考察的体验开始（用 “It should …” 句式，如 *It should 让玩家在藏拙擂台靠算计取胜*）。
  - `assertion`：核对结果后给 `passed`/`failed`/`untested` + 一句话结论（合并相关检查，别太碎）。
- 至少覆盖：开局落海战(1)、藏拙擂台(3)、越阶斩婴鲤兽(8)、大典惊变演出(9)、救小紫灵护送(10)、致富群猎(14)、首次结丹必败演出(18)、叩关渡劫(19)、金丹大成(20)。
- 录屏交付给用户做凭证。

---

## 7. 《篇章游玩体验报告》输出模板

> 复制以下模板填写。一句话结论优先，再给证据。

```markdown
# 《初入星海篇》游玩体验报告
- 调研人：<agent/session>　日期：<date>　版本：ver.txt=<n>
- 游玩模式：☐ 完整通关　☐ 聚焦快进（快进则注明角色配置如何补齐）
- 通关情况：走到第 __ 节（id ____），是否走完 arc5_complete：是/否
- 录屏：<链接/附件>

## 一句话总评
（这一篇玩起来最大的优点 + 最该改的 1-3 件事）

## A 难度曲线
| 战斗节点 | 太简单/适中/太难 | 证据（操作·数值·胜率） | 建议 |
| 落海(1) / 擂台(3) / 婴鲤兽(8) / 护送(10) / 致富(14) / 渡劫(19) | | | |

## B 节奏 / 繁琐度
（哪里拖、哪里赶、哪里点太多下；锚-帆是否成立）

## C 缺道具 / 缺提示
| 期望 | 现状（缺/没提示） | 出现节点 | 建议 |

## D 移动端 UI（iPhone 14 Pro Max）
（布局/立绘/文字/按钮；附截图）

## E 美术 / 演出核对
| 节点 | 预期资产 | 实际（出现?对考据?有无破图） | 问题 |

## F 战斗手感
（手牌三区、噬金虫四式取舍感、越阶底牌设计是否被感知）

## G Bug / 异常
| 现象 | 复现步骤 | Console 报错 | 严重度 |

## H 一致感 / 沉浸
（剧情强=数值强？背景强者三态？出戏点？）

## 改进建议（按优先级排序）
1. （P0 必改）…
2. （P1 建议）…
3. （P2 锦上添花）…
```

---

## 8. 产出与交付

- 报告以 `message_user` 附件形式发给用户（Markdown）。
- **默认不入库**；若用户要求归档，存到 `docs/playtest-reports/初入星海篇-<日期>-<agent>.md` 再走正常 PR 流程。
- 临时存档/控制台脚本/截图用完即弃，不要 `git add`。
- 报告里发现的代码/数值/美术问题，**交给用户决定是否修**（R3）；用户点头后再按 AGENTS.md 工程惯例改、测、发版、合 main。

---

## 附 · 换篇章复用本手册

调研其他篇章时，仅需替换：
1. 第 3 节快进 flag（改对应篇章的 `arcN_complete` 与 `Chapters.unlock/enter` 目标 id，见 `js/chapters.js` 的 `list`）。
2. 第 4 节 golden-path 节点表（`grep 'id: "<篇章前缀>_' js/story.js` 拉出节点顺序 + `cond/skipIf` flag + `cg/bgm` + 战斗 `resolve`）。
3. 第 4 节「预期美术」列（对照该篇章 design 文档的美术清单 + `js/art.js` 注册表）。
其余（红线、启动、观察清单、录屏、报告模板）通用。
