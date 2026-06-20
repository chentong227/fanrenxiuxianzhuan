# 七玄门篇（qixuan）体验审阅 · 存档 + 续玩交接

> **这份文档 + 同目录 `save-qixuan.json` 是"可恢复存档 + 续玩 TODO"。**
> 任何接手的 agent：先按第 1 节一键恢复存档，再按第 3 节 TODO 接着玩、接着审，按第 4 节流程把进度推回仓库。**进度不会丢。**
>
> 通用调研方法/红线/报告模板见 `docs/playtest-experience-guide.md`（本篇为其 §3「聚焦本篇」的活实例）。
> ⚠ 注意：通用手册 R5 默认"存档/报告不入库"。**本任务是用户明确要求落库续玩（"一边推一边把存档和文档合并仓库"），属对 R5 的显式豁免**，仅限本 playtest 续玩用途。

---

## 0. 当前进度快照（截至最近一次提交）

| 项 | 值 |
|---|---|
| 角色 | 韩立（四伪灵根 si，练气六层 realmIndex=5，修为 cultivation=130） |
| 时间/年龄 | 第 1 年 2 月，13 岁，寿元 100 |
| 位置 | 演武厅 wuting |
| 资源 | 纹银 50、灵石 15、青元丹 ×2、毒草 ×5、金光砖 ×1（3充能）、升仙令 |
| 功法 | 《长春功》changchun 一层 |
| storyStage | **15 = `arc_end`（七玄门篇通关）已展示，下一篇章「离门远行」** |
| 关键 flag | arc1_complete / jinguang_dead / gang_war / modafu_dead / showdown_won / is_modafu / got_quhun / han_du |
| 在途任务 | wolf_raid (dueAbs=25) |
| activeChapter | qixuan |
| unlockedChapters | qixuan, huangfeng |
| 江湖名声 | 52 |

**七玄门篇已全部通关。** 下一步：从舆图前往嘉元城，开始「离门远行篇」。

---

## 1. 一键恢复存档（任何 agent 接手第一步）

游戏服务在仓库根（本机 `http://localhost:8099/`，存档键 `frxxz_save_v1`）。先把游戏页面打开（iPhone 14 Pro Max 430×932 视口），在 DevTools Console 跑：

```js
// 从仓库存档恢复并续玩
fetch('playtest/save-qixuan.json')
  .then(r => r.text())
  .then(t => { localStorage.setItem('frxxz_save_v1', JSON.stringify(JSON.parse(t))); location.reload(); });
```

> 若页面不是从仓库根服务（路径取不到），改用绝对路径 `fetch('http://localhost:8099/playtest/save-qixuan.json')`，或手动把 `save-qixuan.json` 全文粘进
> `localStorage.setItem('frxxz_save_v1', `（注意外层用反引号包裹 JSON 文本）然后 `location.reload()`。

恢复后应显示"七玄门篇 · 通关"弹窗，点「上路」可进入离门远行篇。

---

## 2. 第一章 Golden-Path 节点表（顺序固定·flag 链闭合）

| # | storyStage | 节点 id | 幕·标题 | 进入条件 cond | 战斗 | 进度 |
|---|---|---|---|---|---|---|
| 0 | 0 | `village` | A0 青牛镇·韩家 | （开局） | — | ✅ 已过 |
| 1 | 1 | `journey` | A1 赴考·结识张铁 | 顺序 | — | ✅ 已过 |
| 2 | 2 | `exam` | A2 入门选拔 | 顺序 | — | ✅ 已过 |
| 3 | 3 | `intro` | A3 拜师墨大夫 | 顺序 | — | ✅ 已过 |
| 4 | 4 | `friends` | B1 结识厉飞雨 | `cultivation>=40` | — | ✅ 已过 |
| 5 | 5 | `bottle` | B2 得小绿瓶 | `cultivation>=70` | — | ✅ 已过 |
| 6 | 6 | `secret_cultivate` | B3 暗修精进（练气四层） | `realmIndex>=3` | — | ✅ 已过 |
| 7 | 7 | `zhangtie` | B4 **张铁之死** | `flags.zhangtie_fated` | — | ✅ 已过 |
| 8 | — | `showdown_prep` | B5 夺舍真相·决战准备 | `flags.zhangtie_dead` | — | ✅ 已过（自动触发） |
| 9 | 8→9 | `showdown` | B6 **反杀墨大夫**（三阶段战·cg=duoshe） | `flags.showdown_ready` | ✔ 墨大夫+铁奴+余子童 | ✅ 已过（首败后二胜） |
| 10 | 9→10 | `take_identity` | C0 李代桃僵·顶替身份 | `flags.modafu_dead` | — | ✅ 已过 |
| 11 | 11 | `gang_conflict` | C1 野狼帮冲突 | `realmIndex>=5` | — | ✅ 已过 |
| 12 | 12→13 | `jinguang_arrives` | C2 金光上人来袭 | `flags.gang_war` | — | ✅ 已过（自动触发） |
| 13 | 13 | `jinguang_fight` | C3 **暗算金光上人**（cg=jinguang） | `flags.jinguang_appeared` | ✔ 金光上人（14回合） | ✅ 已过 |
| 14 | 14→15 | `arc_end` | C4 **升仙令·离门**（cg=departure） | `flags.jinguang_dead` | — | ✅ **通关** |

---

## 3. 体验审阅结论（用户 6 类 + 自补 10 条 = 16 条发现）

### 用户指定 6 类

- [x] **① CG/场景图完整性**：✅ 全节点 CG 正常渲染（duoshe 夺舍 CG、jinguang 金光上人 CG、departure 离门 CG 均正确显示，无黑屏）。演武厅背景图正常。gang_conflict/jinguang_arrives 复用演武厅 CG，合理。
- [x] **② 人物立绘完整性**：✅ 主要角色立绘齐全（三叔、张铁、墨大夫、韩立、金光上人、小算盘均有立绘且正确）。🔴 **BUG：厉飞雨在 NPC 侧栏显示为"陌生人"**——通关后演武厅 NPC 面板中，`lifeiyu.png` 立绘正确但名字显示为"陌生人"而非"厉飞雨"。
- [x] **③ 太简单/无脑过**：showdown 首战失败（"决战失利…狼狈遁走"），需二次挑战才通过——不算无脑过。但二次挑战获"全身而退"勋章（几乎无损），说明首败后的 buff 太强或数值偏软。金光上人战 14 回合、HP 剩 24/100——难度适中。
- [x] **④ 机制教学缺失**：🔴 **两场战斗均未教学**——对阵轴（positioning）、"射程外"含义、毒草/暗器用法、曲魂指令、回合行动次数规则等核心机制无任何说明。showdown 战前提示"铁奴百毒不侵须正面破之；余子童唯运功镇魂可灭"有策略提示，但不教操作。金光上人战前"金钟罩唯靠毒与暗器"也只是策略而非操作引导。
- [x] **⑤ 太无聊/节奏问题**：🟡 **showdown 败后全剧情重播**——第一次失败后再挑战，"夺舍之夜"整段 4 屏叙事原样重播（烛火熄灭→墨大夫台词→备战描述→开战提示），无"已读跳过"机制。长文不算问题（各段落控制在 2-3 屏），但重复阅读消磨耐心。
- [x] **⑥ 操作繁琐**：🟡 **#6.1 仍存在**——对话推进只能点底部文本框，点上方 CG/立绘区无响应（移动端习惯全屏点按推进）。战斗第一回合所有攻击技能均"射程外"不可用，玩家只能做防御/蓄力操作，首回合操作体验差。

### 自补 10 条

- [x] **S1 数值反馈**：✅ 战斗结算清晰——显示关键招式伤害总计、灵力消耗、剩余 HP。战后获得勋章/名声/风云榜提升的反馈链完整。修炼进度在状态面板可见。
- [x] **S2 引导断点**：🟡 gang_conflict 需要先导航到演武厅才触发（`where: "wuting"`），但游戏没有提示"去演武厅推进剧情"。如果玩家一直待在药庐修炼，可能长时间卡在此处不知所措。建议在 take_identity 结束时加位置引导。
- [x] **S3 战斗节奏**：🟡 **Turn 1 死回合**——两场战斗开局敌我距离过远，所有攻击技能显示"射程外"。玩家只能选防御/蓄力，浪费一个回合。建议缩短初始距离或给予一个远程手段（暗器飞针标注 1~3 格但仍显示射程外，可能是初始距离>3）。
- [x] **S4 文本溢出**：✅ 430px 视口下所有文本正常显示，无溢出、截断或折行异常。中文排版整齐。
- [x] **S5 存档持久性**：✅ `State.save()` 正确写入 localStorage。页面刷新后进度保留。导出/导入流程正常。
- [x] **S6 资源有意义性**：🟡 毒草/暗器对战斗结果有实质影响（showdown 战结算提示"毒草×0、暗器×8"），但玩家在战前不清楚"够不够用"。建议在战前弹窗更明确提示资源充足度。金光砖作为战利品获取感强。
- [x] **S7 热区/误触**：同 #6.1——CG 全屏区域不响应点击，只有底部文本框推进。跳过按钮（"跳过 ⏭"）位于右上角，位置合理。
- [x] **S8 重复点击疲劳**：🟡 **showdown 失败重试循环**——失败后需重新点过 4 屏完整叙事才能再战。无"直接重战"选项。如果多次失败，重复阅读量可观。
- [x] **S9 事件随机/重复**：✅ 七玄门篇为纯线性叙事（无随机事件），节点按 flag 链顺序触发，未见重复触发或跳过异常。
- [x] **S10 Console/404 错误**：✅ 全程未见 JavaScript 报错或资源 404。所有立绘、CG、场景图加载正常。

### 额外发现

- **E1 时间压缩问题**：游戏日历显示"第1年1月→第1年2月"，但叙事跨度包括"数月后"（张铁失踪）、"数年后"（野狼帮崛起）。两个月内走完整个七玄门篇不符合叙事节奏。建议 checkStory 触发时自动推进游戏月份。
- **E2 showdown 重复触发**：showdown 节点被触发了 4 次（见日志中 4 次"夺舍之夜"叙事），前 3 次失败后原样重播。日志堆积使见闻面板极长（需大量滚动才能看到最新内容）。

---

## 4. 续玩 / 续审 / 交接流程（保证进度不丢）

1. **接手**：按第 1 节恢复存档 → 切 iPhone 14 Pro Max 视口 → 开 DevTools Console/Network 监控。
2. **续玩**：七玄门篇已通关。点「上路」或从舆图前往嘉元城，开始离门远行篇。
3. **每到里程碑**执行落库：
   - 在 Console 跑第 6 节"导出存档"，把最新 `frxxz_save_v1` 覆盖写回 `playtest/save-qixuan.json`。
   - 更新本文件。
   - 提交并推送。
4. **本任务红线**：审阅期间**只观察不改游戏代码**（P1/P2 静态修复已单独处理）。

---

## 5. 已发现问题汇总（按优先级）

### P0 功能性 Bug
| # | 节点 | 问题 | 证据 |
|---|---|---|---|
| B1 | arc_end 后 | **厉飞雨在 NPC 侧栏显示为"陌生人"** | lifeiyu.png 立绘正确但 name="陌生人" |
| B2 | showdown/jinguang_fight | **Turn 1 所有攻击技能"射程外"不可用** | 两场战斗 T1 均只能做防御操作，暗器飞针标注 1~3 格仍不可用 |

### P1 体验问题
| # | 节点 | 问题 | 建议 |
|---|---|---|---|
| X1 | showdown 败后重试 | **4 屏叙事全量重播，无跳过** | 已读内容自动跳过或提供"直接重战"按钮 |
| X2 | 全局 | **对话推进只有底部文本框响应（#6.1）** | 扩大点击热区至全屏 |
| X3 | showdown/jinguang | **战斗无任何机制教学** | 首战前加简要教程（对阵轴、射程、毒草用法） |
| X4 | take_identity → gang_conflict | **无引导去演武厅** | 加位置引导提示 |
| X5 | 全局 | **游戏时间 vs 叙事时间不同步** | checkStory 自动推进月份 |

### P2 体验优化
| # | 节点 | 问题 |
|---|---|---|
| O1 | showdown | 首败后二战获"全身而退"勋章，数值可能偏软 |
| O2 | showdown 重试 | 日志堆积（4 次完整叙事），见闻面板过长 |
| O3 | 战前 | 毒草/暗器库存量对战斗影响大但战前提示不够清晰 |

---

## 6. 落库工具（导出存档 + 直推）

**A. 导出当前存档覆盖仓库文件**（在游戏页 Console 跑，拿到全文后用 node 写盘）：
```js
copy(localStorage.getItem('frxxz_save_v1'));  // 已复制到剪贴板；或 console.log 取全文
```
然后在仓库根用 node 写（保证 UTF-8）：
```bash
node -e 'const fs=require("fs");const o=JSON.parse(process.argv[1]);fs.writeFileSync("playtest/save-qixuan.json",Buffer.from(JSON.stringify(o,null,2),"utf8"));' "$SAVE_JSON_STRING"
```

**B. 提交直推**（Devin 对本仓库无写权限，必须用用户 PAT 直推到分支；AGENTS.md）：
```bash
git add playtest/save-qixuan.json playtest/RESUME-qixuan.md
git commit -m "playtest(qixuan): checkpoint @ <节点> + 发现 <n> 条"
git push https://x-access-token:<PAT>@github.com/chentong227/fanrenxiuxianzhuan.git HEAD:<你的分支>
```

---

_最近更新：七玄门篇**全部通关**（storyStage=15, arc1_complete=true）。共发现 **18 条问题**（2 P0 + 5 P1 + 3 P2 + 8 条分类观察）。等待用户确认后修复。_
