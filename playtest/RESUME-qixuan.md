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
| 角色 | 韩立（四伪灵根 si，练气一层 realmIndex=0，修为 cultivation=102） |
| 时间/年龄 | 第 1 年 7 月 |
| 位置 | 药庐 yaolu（已拜墨大夫为药童） |
| 功法 | 《长春功》changchun 一层 |
| storyStage | **6 = `bottle`（小绿瓶到手）已展示，下一节点 `secret_cultivate`（暗修·练气四层）** |
| 关键 flag | at_village / joined_sect / met_modafu / met_friends |
| 小绿瓶 | bottle.unlocked=true（2 个空地块），已解锁「打理小瓶」行动 |
| 在途任务 | 天命「暗修精进·修到练气四层」 + 限时「墨大夫的期许·练气二层」 |
| activeChapter | qixuan |

**下一步要做的事（后续会话）**：从 `bottle` 往后推 —— 用「打理小瓶」催熟灵药 + 闭关，把《长春功》修到 **练气四层** 触发 `secret_cultivate`，再往后是张铁之死 / 反杀墨大夫。本会话按用户指定**到 bottle 即停**。

---

## 1. 一键恢复存档（任何 agent 接手第一步）

游戏服务在仓库根（本机 `node scripts/_serve.js 8011` → `http://127.0.0.1:8011/`，存档键 `frxxz_save_v1`）。

**最推荐（开局一条命令搞定起服+开页+灌档，幂等）**：
```bash
node playtest/session-init.js      # 起 _serve.js(8011) + 经 CDP 开游戏页 + 灌入 save-qixuan.json
```
**或（游戏页已开时，只灌档）**：
```bash
node playtest/savetool.js load     # 仓库 save-qixuan.json → localStorage → 自动 reload
```
回到页面点「读取存档」即进入存档局面（顶栏应显示「第1年1月 · 墨大夫药庐」）。

**或手动**（先把游戏页面打开，iPhone 14 Pro Max 视口），在 DevTools Console 跑：

```js
// 从仓库存档恢复并续玩
fetch('playtest/save-qixuan.json')
  .then(r => r.text())
  .then(t => { localStorage.setItem('frxxz_save_v1', JSON.stringify(JSON.parse(t))); location.reload(); });
```

> 若页面不是从仓库根服务（路径取不到），改用绝对路径 `fetch('http://localhost:8099/playtest/save-qixuan.json')`，或手动把 `save-qixuan.json` 全文粘进
> `localStorage.setItem('frxxz_save_v1', `（注意外层用反引号包裹 JSON 文本）然后 `location.reload()`。

恢复后顶栏应显示"第 1 年 1 月 · 药庐"，见闻里能看到「墨大夫初授《长春功》」。

### （可选）定点快进到「张铁之死」及之后
仅当你只想验后段（zhangtie→showdown→…）、不评估 friends/bottle/secret 体验时用：
```js
const s = State.data;
s.realmIndex = 3; s.cultivation = 0;          // 练气四层：过 friends(≥40)/bottle(≥70)/secret_cultivate(realmIndex≥3) 三道门禁
s.flags.adventured = true; s.flags.adv_count = 2;
State.save(); Engine.checkStory();             // 催出后续节点
```
⚠ **快进会跳过对 friends/bottle/secret_cultivate 的体验评估，报告里必须注明"该三节为快进、未实玩"。**

---

## 2. 第一章 Golden-Path 节点表（顺序固定·flag 链闭合）

| # | storyStage | 节点 id | 幕·标题 | 进入条件 cond | 战斗 | 进度 |
|---|---|---|---|---|---|---|
| 0 | 0 | `village` | A0 青牛镇·韩家 | （开局） | — | ✅ 已过 |
| 1 | 1 | `journey` | A1 赴考·结识张铁 | 顺序 | — | ✅ 已过 |
| 2 | 2 | `exam` | A2 入门选拔（→ location=shanmen, flag joined_sect） | 顺序 | — | ✅ 已过 |
| 3 | 3 | `intro` | A3 拜师墨大夫（→ 药童·授《长春功》） | 顺序 | — | 🟡 **当前** |
| 4 | — | `friends` | B1 结识厉飞雨 | `adventured || cultivation>=40` | — | ⬜ 待玩 |
| 5 | — | `bottle` | B2 得小绿瓶 | `cultivation>=70 || adv_count>=2` | — | ⬜ 待玩 |
| 6 | — | `secret_cultivate` | B3 暗修精进（练气四层） | `realmIndex>=3` | — | ⬜ 待玩 |
| 7 | — | `zhangtie` | B4 **张铁之死** | `flags.zhangtie_fated`（由 quests 排程置位） | — | ⬜ 待玩 |
| 8 | — | `showdown_prep` | B5 夺舍真相→决战准备 | `flags.zhangtie_dead` | — | ⬜ 待玩 |
| 9 | — | `showdown` | B6 **反杀墨大夫**（三阶段战·cg=duoshe） | `flags.showdown_ready` | ✔ | ⬜ 待玩 |
| 10 | — | `take_identity` | C0 李代桃僵·顶替身份 | `flags.modafu_dead` | — | ⬜ 待玩 |
| 11 | — | `gang_conflict` | C1 野狼帮冲突（→ 金光上人） | `realmIndex>=5` | ✔ | ⬜ 待玩 |
| 12 | — | `arc_end` | C4 **夺升仙令·离门**（cg=departure，本篇收尾） | `flags.jinguang_dead` | — | ⬜ 待玩 |

**推进手段**：节点底部选项点选推进；时间用顶栏行动（修炼/外出历练/打坐）自然 `advanceMonth→checkStory`。门禁靠修为/realmIndex，按部就班需刷修为。

---

## 3. 体验审阅 TODO（用户 6 类 + 自补 ≥10 条）

边玩边按下表记「第几节 / 什么操作 / 看到什么 / 判断」。**目标：6 类各有结论 + 补充 ≥10 条，合计 ≥16。**

### 用户指定 6 类
- [ ] **① 图片不全 / CG 缺失**：逐节点核对 cg/场景图是否出现、破图、黑边、张冠李戴（重点 showdown 的 `duoshe`、arc_end 的 `departure`）。
- [ ] **② 人物不全 / 立绘缺失**：三叔/张铁/墨大夫/厉飞雨/金光上人等立绘是否齐、是否对考据。
- [ ] **③ 太简单**：哪场战斗/哪段推进无脑过。重点 showdown 三阶段、gang_conflict。
- [ ] **④ 太难**：哪场反复败/看不懂怎么赢；铁奴(百毒不侵)、元神(唯镇魂)、金钟罩(唯毒+暗器破)机制是否教给玩家。
- [ ] **⑤ 太无聊**：哪段纯文本过长无喘息 / 帆区刷修为太肝。
- [ ] **⑥ 操作太繁琐**：点几下才推进、热区误触、战斗每回合点击数。

### 自补 ≥10 条（实玩才感受得到，逐条落实证据）
- [ ] S1 数值反馈：修为/突破进度、距下一锚（40/70/练气四层）差多少是否清晰可见。
- [ ] S2 引导断点：intro 后玩家是否知道"要修到 40 或外出历练"才能推进（已补 objHint，验是否生效/够清楚）。
- [ ] S3 战斗节奏：每回合点击次数、回合是否拖沓。
- [ ] S4 文案溢出：430 窄屏下截断/折行/溢出、错别字、过场能否跳过。
- [ ] S5 存读档：刷新后进度是否保留（本任务已建仓库存档，另验游戏自身 localStorage）。
- [ ] S6 资源体感：纹银/灵石/寿元/月份流逝是否有意义、有无冗余。
- [ ] S7 操作热区/误触：**[已发现]** 见第 5 节 #6.1（点上方 CG 区不推进，仅底部文本框推进）。
- [ ] S8 重复点击疲劳：cultivate/历练 要点几次到下一门禁。
- [ ] S9 奇遇随机性：帆区是否反复刷同一事件、是否乏味。
- [ ] S10 console 报错/资源 404：全程开 Console 看红字、Network 看 404。
- [ ] S11+ 其他实玩发现……

---

## 4. 续玩 / 续审 / 交接流程（保证进度不丢）

1. **接手**：按第 1 节恢复存档 → 切 iPhone 14 Pro Max 视口 → 开 DevTools Console/Network 监控。
2. **续玩**：按第 2 节节点表从"🟡 当前"往后推，边玩边按第 3 节记录。
3. **每到里程碑**（如过一个门禁、到张铁之死、反杀墨大夫等）执行**验证同步落库 SOP**（详见 `docs/playtest-experience-guide.md` §9，下面是要点）：
   1. 导出存档：`node playtest/savetool.js dump`（覆盖写 `playtest/save-qixuan.json`，UTF-8）。
   2. 更新 `playtest/REVIEW-qixuan.md`（本里程碑机制发现）+ 本文件第 0 节快照、第 2 节进度勾选。
   3. `git add` 上述文件 → `git commit`。
   4. `git push`（用户 PAT，见第 6 节）。
   5. **验证同步（过了才算"落库成功"，不许只凭 push 退出码）**：
      ```bash
      L=$(git rev-parse HEAD); R=$(git ls-remote origin <你的分支> | cut -f1)
      [ "$L" = "$R" ] && echo SYNCED || echo "NOT SYNCED -> 重推"
      git fetch origin >/dev/null && git diff --quiet HEAD origin/<你的分支> && echo CLEAN
      ```
      `SYNCED` + `CLEAN` 都出现才算同步成功；任一不符立刻重推。
   6. 把 `REVIEW-qixuan.md` 本里程碑那段**贴给用户看**。
4. **录屏**：全程录屏作凭证，关键节点加 `test_start`/`assertion` 注记。
5. **玩完**：合计 ~15 条机制发现（重点判断是否不合理：难度/节奏/平衡）→ 汇总报告发用户确认 → 用户点头后再改代码（按 `docs/playtest-experience-guide.md` §10「发现→修复 SOP」：查档定位→最小改→`node scripts/bump.js`→跑回归→复玩验证→§9 落库→PAT 开 PR）。
6. **本任务红线**：审阅期间**只观察不改游戏代码**（P1/P2 静态修复已单独处理）；存档/文档落库是用户显式要求。

---

## 5. 已发现问题（持续累加）

### 已修（静态审阅，Phase 1）
- **P1**：`js/story.js` journey 幕重复 `onArrive` 键（死代码）→ 已合并。
- **P2**：friends / bottle 帆区缺 `objHint` → 已补引导。

### 实玩发现
- **#6.1（操作繁琐/热区）**：对话推进只能点**底部文本框**，点上方 CG/立绘区**无响应**。移动端习惯"全屏点按推进"，点图区像卡死。证据：intro 拜师墨大夫节点。建议：把推进热区扩到全屏（或上方区也响应）。〔待用户确认后修〕

---

## 6. 落库工具（导出存档 + 直推）

**A. 导出当前存档覆盖仓库文件**（推荐用脚本，自动保证 UTF-8）：
```bash
node playtest/savetool.js dump        # localStorage frxxz_save_v1 → playtest/save-qixuan.json（pretty, UTF-8）
```
> 脚本经 CDP（`localhost:29229`）读取游戏页 localStorage；如端口不同用 `CDP_URL=... node playtest/savetool.js dump`。
> 手动兜底：游戏页 Console 跑 `copy(localStorage.getItem('frxxz_save_v1'))`，再 `node -e '...Buffer.from(...,"utf8")...'` 写盘（**勿用 PowerShell Set-Content**，中文乱码）。

**B. 提交 + 直推 + 验证同步**（Devin 对本仓库无写权限，必须用用户 PAT 直推到分支；AGENTS.md）：
```bash
git add playtest/save-qixuan.json playtest/REVIEW-qixuan.md playtest/RESUME-qixuan.md
git commit -m "playtest(qixuan): checkpoint @ <节点> + 机制发现 <n> 条"
git push https://x-access-token:<PAT>@github.com/chentong227/fanrenxiuxianzhuan.git HEAD:<你的分支>
# 验证同步（见 §4 步骤 5）：本地 HEAD 必须 == 远端分支 SHA，diff 为空
```
PR 走 GitHub API + PAT(curl)。该仓库无 CI，GitHub Pages 从 main 自动部署。

---

_最近更新：第一章审阅 playtest 进行中，进度 `intro`（storyStage=3）。下一步：推进至 `friends`。_
