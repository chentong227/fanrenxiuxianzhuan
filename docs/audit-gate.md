# 提交门禁（Audit Gate · 一致性与平衡的可勾选清单）

> 2026-06-29 创建。本文件是**宪法的执法工具**（CONSTITUTION.md 第〇·3 条）。
> 它把「前后一致 / 数值平衡」从「靠人记得住」变成「提交前必须逐条勾 + 必须跑绿的测试」。
>
> **用法**：任何新内容（节点/法宝/功法/敌人/系统）实装完成、push 之前，
> 走完本文件的 A（设计审计·人工勾选）+ B（机器门禁·必跑绿）。
> 任一条不过 = 不许 push。怪胎就是这样被挡在门外的。

---

## A. 设计审计（人工逐条勾选 · 对应宪法七铁律）

把下面这张表复制进 PR 描述 / commit 说明，逐条打勾。打不上勾的，要么修内容，要么明确豁免（注明理由）。

```
[ ] 铁律1 锚/帆定位：本内容是锚还是帆？（默认帆；升格锚须过 pacing §一三问）
[ ] 铁律2 时间货币：消耗了月？收益可被「值不值一个月」换算？无白嫖循环？
[ ] 铁律3 选择闭环：每个 writeLedger/关键 flag 都声明了兑现窗口（在哪个节点、何形式、settleLedger 点名）？
        找不到兑现窗口的因 → 已降级为纯 flavor（不写 ledger）或已补兑现节点？
[ ] 铁律4 数值吃尺子：走 balance.js？无裸 +N？法宝标了 driveRealm？
        tier 未决期：新数据旁留了 `// TODO:tier` 注释？
[ ] 铁律5 乘法优先：用旧系统相乘可得否？若立新系统，过了四问且 roadmap 留案？零教学？
[ ] 铁律6 三层惦记：远/中/近三层在本内容场景下皆非空？近反馈喂养了某个中/远惦记？
[ ] 铁律7 败有所得：失败路径不卡死、给信息/资源/补救径？背景强者未进风云榜赛道？
[ ] 治理   唯一权威源：本内容引用的事实只有一个出处？没有复制别处数据？
[ ] 考据   骨架内容 ≥2 源互证？（仅锚类/canon 内容需要；纯原创帆内容免）
```

### 三张专项质量表（继承 gameplay-template.md，按节点类型再勾）

**选择质量**（剧情节点必勾）：
```
[ ] 连续纯单选 ≤ 2 个（第 3 个必须是多选/有后果）
[ ] 每个选项 effect 改变 ≥1 持久状态（flag/资源/属性/ledger）
[ ] 选项体现韩立性格（谨慎/藏拙），不出戏
```

**战斗质量**（战斗节点必勾）：
```
[ ] 同章遭遇 ≥2 种敌人原型（不全是同一型）
[ ] boss 有 introNote（战术题面：行属克制+核心招应对+推荐解法）
[ ] 越阶 boss 有底牌路径（消耗底牌不吃越阶折扣）
[ ] 同阶胜率锚点 ≥90%（蒙特卡洛验，见 B）
```

**篇章质量**（新篇章必勾）：
```
[ ] 章内有锚有帆（不是纯锚链 = 七玄门「看完就空」老毛病）
[ ] 系统推进表 A~E 填齐（chapter-systems-manifest）
[ ] 退潮后旧地区不死（保留地标/故人/采买）
```

---

## B. 机器门禁（必跑、必须全绿 · 对应宪法第二章）

> 仓库无 `npm test` 聚合脚本；逐个 `node` 运行。**改了对应领域就必须跑对应组，全绿才 push。**

### B1 改了战斗 / 数值 / balance.js —— 平衡组（强制）
```
node test/scale.bal.js      # A2 标度承重墙（5 条断言：轴内恒定/越阶胜率带/TTK带/元婴致死不趋零/驱动门槛）
node test/encounter.bal.js  # 遭遇胜率锚点
node test/elem.bal.js       # 五行克制/做功课价值
node test/tier.bal.js       # 标度公式/功法层
```
**铁律4 的执法线**：`scale.bal.js` 不全绿 = 数值违宪，禁止 push。

### B2 改了存档 schema / state.js —— 迁移组（强制）
```
node test/run.js            # 无头全流程 + 存档迁移 roundtrip
```
**宪法第二章执法线**：老档不崩、roundtrip 一致。

### B3 改了剧情 / 主线 / story.js / engine.js —— 主线组（强制）
```
node test/journey.test.js   # E2E 主线全链路
node test/chapter.test.js   # 篇章解锁/切换
node test/ledger.audit.js   # 因果闭环棘轮（铁律3 执法线）——新增 writeLedger 必过
```
**铁律3 的执法线**：`ledger.audit.js` FAIL（发现不在 baseline 的新未闭环账目）= 因果违宪，禁止 push。

### B4 改了对应子系统 —— 按域跑
```
combat.test.js / loadout.test.js / explore.test.js / exploremap.test.js /
dialogue.test.js / cutscene.test.js / world.test.js / env.test.js / quest.test.js / ...
```

### B5 全量回归（篇章收尾 / 大改后）
```
# 逐个跑 test/*.test.js + test/*.bal.js，全绿
```

---

## C. 因果闭环专项审计（针对漂移 #1 · 治本工具）

> 这是本门禁最重要的一张表——它直接防住「账本只记不结」的怪胎根源。
> **每次新增 writeLedger 调用，必须在此登记。** 建议日后做成自动化脚本（见 D）。

每个 `writeLedger(id, ...)` 必须能填满下表一行，否则不许种这个因：

| ledger id | 种因处（节点/行动） | 兑现窗口（哪个未来节点） | 兑现形式（演出/难度/资源/命途） | 是否已实装兑现 |
|-----------|--------------------|------------------------|------------------------------|--------------|
| 示例 chen_remember | chen_after 选择 | modao_e1_chen_remember | 演出分叉 | ✅ |
| 示例 saved_merchant_road | 旅途奇遇 | （待定）| —— | ❌ 待补或降级 flavor |

**红线**：「是否已实装兑现」列为 ❌ 的条目，在该内容所属篇章收尾前必须清零——
要么补兑现节点，要么把 writeLedger 降级成纯 flavor 文字（不占 ledger）。

---

## D. 自动化门禁

把人工审计里可机器化的部分写成脚本，进一步堵漂移：

1. **`test/ledger.audit.js`** —— ✅ **已实装（2026-06-29）·铁律3 的机器执法器**：
   - 静态扫描 `js/*.js`，提取所有 `writeLedger("X")` 的 id 集合 W（种因）。
   - 提取所有读账本形式的 id 集合 R：`readLedger` / `settleLedger` / `s.ledger.X` /
     `s.ledger["X"]` / NPC 数据 `ledger: "X"`（经 `readLedger(A.ledger)` 动态读取）。
   - 报告 `W − R`（种了因、全仓从不结果的 id 列表）。
   - **棘轮（ratchet）执法**：`test/ledger.baseline.json` 存量豁免表存在时，
     任何「未结算且不在豁免表的 **A 类选择债**」= **新债 → FAIL(exit 1)**；存量债被宽限。
     **只许还债、不许欠新选择债。** baseline 缺失则为引导模式（只报告、exit 0）。
   - **三分类（v241）**：A 选择债（铁律3 正主·严格门禁）／B 成就记录（伴 addMilestone 的流水账·合法只记不结·不阻断）／
     H 真钩子（label 含未来承诺词·等 readLedger 兑现·不阻断）。门禁只对 A 类新债 FAIL，B/H 新增仅提示不拦截。
   - 用法：`node test/ledger.audit.js`（审计）／`--write-baseline`（铺底/接受存量）／`--json`（机读）。
   - **首测结果（2026-06-29）**：134 种因 id，仅 7 闭环 → **闭环率 5%**（比 drift-audit 估计的还重）。
     127 条存量债已铺进 baseline，门禁即刻生效。
   - **执法线（铁律3）**：改了 story.js / engine.js 新增 writeLedger 后必跑；FAIL = 因果违宪，禁止 push。
2. **`test/quality.audit.js`** —— ✅ **已实装（2026-06-30）·玩法质量（§五战斗/§四选择）机器执法器**：
   - 战斗质量：boss/named 敌人（`boss`/`namedLoot`/名字含「妖王/巨擘/教主/老祖/长老」）必须有
     `introNote`（战术题面）+ `attacks`（出招表）；任一缺失 = FAIL。
   - 选择质量：剧情节点不得出现「假多选」（≥2 选项全部同 `resolve` 且无 `effect`/`fight`＝伪装的单选）。
   - 用法：`node test/quality.audit.js`（exit 0=全过）。改了 world.js 敌人表 / story.js 选项后必跑。
   - 首测（2026-06-30）：PASS——31 敌人 boss/named 全有 introNote+attacks，108 剧情节点 0 假多选。
3. **`test/balance.todo.js`**（待做）：扫描 data.js 中新增 gear/spell 是否缺 `driveRealm` 或 `// TODO:tier` 标注。
3. **commit 钩子**（待做）：改了 `js/balance.js|combat.js` 自动提示「跑 scale.bal.js」。

> D1（ledger.audit）已把漂移 #1 从「靠自觉」变「靠门禁」。**还债工作流**：从 baseline
> 挑一条 → 补 settleLedger 兑现节点（或降级纯 flavor 去掉 writeLedger）→ 从 baseline
> 删该 id → 跑 `node test/ledger.audit.js` 全绿。baseline 清空之日 = 因果账本治愈之时。

---

## E. 一页速记

```
push 前：
  A 人工勾 7 铁律 + 治理/考据 + 对应类型专项表
  B 改哪块跑哪组 .bal/.test，全绿
  C 新 writeLedger 必须登记兑现窗口（❌ 不许带进篇章收尾）
不全绿 / 勾不满 / 因果不闭环 = 不许 push。
```
