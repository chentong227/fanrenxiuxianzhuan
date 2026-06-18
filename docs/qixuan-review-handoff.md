# 七玄门篇 · 审阅接手文档（Handoff）

> 目的：让任何账号 / 任何 agent 都能**无缝接着这次审阅**——不用重玩、不用重新搭环境。
> 本文件 + 测试存档 + 审阅报告 三件套同分支维护，每个 checkpoint 一起更新并 push。

- 仓库：`chentong227/fanrenxiuxianzhuan`
- 分支：`devin/qixuan-review`
- 三件套：
  - 接手文档（本文件）：`docs/qixuan-review-handoff.md`
  - 测试存档：`docs/testsaves/qixuan-save.json`
  - 审阅报告：`docs/playtest-七玄门篇-报告.md`

---

## 1. 当前进度快照（每个 checkpoint 更新）

| 项 | 值 |
|---|---|
| 更新时间（现实） | 2026-06-18（checkpoint #2） |
| 角色 | 韩立（四灵根；示人 练气一层·藏拙） |
| 境界 | **练气四层**（realmIndex 3），修为 0 / 340（刚突破） |
| 游戏时间 | 第 4 年 4 月，年龄 16 |
| 心境(mood) 40 / 100 ／ 心魔(demon) 0 ／ 气血 130/130 |
| 纹银 / 灵石 | 50 / 0 |
| 所在 | 墨大夫药庐（yaolu）；已解锁新地点「墨大夫密室」 |
| 主线指针 storyStage | 7 → **下一节点 `zhangtie`（挚友失踪/张铁之死）**；天命「挚友外出未归」已就绪，需推进时间触发 |
| 已遇 NPC | 张铁、墨大夫、厉飞雨 |
| 关键 flags | at_village, joined_sect, met_modafu, met_friends, qi_layer_4 |
| 背包 | 灵乳灵药 ×1（备用，下一层突破用） |
| 小绿瓶 | 已解锁，2 块空地（已演示一轮：灵草→灵乳） |

**已通过的主线节点**（storyStage 0→6）：
`0 village（青牛镇）` → `1 journey（赴考）` → `2 exam（选拔）` → `3 intro（拜师墨大夫）` → `4 friends（同门之谊·厉飞雨）` → `5 bottle（神秘小绿瓶·解锁）` → `6 secret_cultivate（暗藏的锋芒·已选「不动声色/深藏不露」藏拙）`

**七玄门篇剩余主线节点**（到 `14 arc_end` 本篇完）：
`7 zhangtie（挚友失踪/张铁之死）` → `8 showdown_prep（夺舍之谋）` → `9 showdown（夺舍之夜·战）` → `10 take_identity（李代桃僵）` → `11 gang_conflict（野狼帮）` → `12 jinguang_arrives（金光上人）` → `13 jinguang_fight（暗算金光·战）` → `14 arc_end（升仙令·离门，置 arc1_complete，解锁黄枫谷）`

> 节点 15+ 属黄枫谷篇及以后，不在本次七玄门审阅范围。

---

## 2. 怎么恢复存档（一行命令，免手动粘贴大段 JSON）

存档文件就在仓库里，本地服务器能静态访问。开好游戏页后，在 DevTools 控制台粘贴：

```js
fetch('/docs/testsaves/qixuan-save.json').then(r=>r.text()).then(t=>{localStorage.setItem('frxxz_save_v1',t);location.reload()})
```

刷新后点「读取存档」即回到上面的进度快照。

---

## 3. 怎么复现审阅环境

1. 起本地静态服务器（仓库根目录）：
   ```bash
   node scripts/_serve.js 8011
   ```
   → http://127.0.0.1:8011/index.html （Cache-Control: no-store）
2. Chrome 打开上面的地址。
3. **F12 → Ctrl+Shift+M 进入设备模拟，选 iPhone 14 Pro Max（430×932，DPR 3）**。这是审阅的硬性视口基准（见 `docs/playtest-experience-guide.md` R1）。
4. 用第 2 节命令读回存档。
5. 开屏幕录制（结构化注解 setup/test_start/assertion）。
6. 校验当前线上版本：`curl -s http://127.0.0.1:8011/ver.txt`（应为 168）。

---

## 4. 玩法思路 / 策略（接手者照此打）

- **冲层用「小绿瓶 → 灵乳灵药」，不要硬闭关。**（实测 + 代码核对）
  - 后山「采药」得灵草 → 小绿瓶种灵草（2 地）→「打理小瓶」每次 +34 成熟度、3 次满 → 收获**灵乳灵药**（`cul:60, sp:40`，即 +60 修为且**不掉心境**）。
  - 对比闭关：约 +13~15 修为/月，但狂掉心境，约 4~5 月就「走火」中断、被迫打坐回神 → 来回拉锯极繁琐。
  - 灵乳路线 ≈ 闭关 3 倍效率且无走火风险，且这是设定里韩立「瞒着墨大夫精进的本钱」（`js/data.js` 灵乳灵药条目）。炼药(养元丹 +20)远不如灵乳。
- **已验证（checkpoint #2）**：种 2 灵草 → 打理 3 次（3 个月，第4年1-3月）→ 收 2 枚灵乳；服 1 枚（修为 200→260，可超上限）→ 80% 顺势冲关成功 → 练气四层。**全程心境未掉**（36→40，反而因时间流逝回升）。实测 ≈ +40 修为/月 vs 闭关 +13/月，约 3 倍且无走火。余 1 枚灵乳留下一层（练气五层 culMax 470）用。
- **当前这一步**：天命「挚友外出未归」，需用打坐/闭关推进数月触发 `zhangtie`。
- **突破时的藏拙选择**：每次突破会问「深藏不露 / 渐露锋芒」——本篇韩立人设是藏拙，按剧情需要选（影响 revealedRealm 示人境界）。
- **战斗**（待打）：
  - `showdown 夺舍之夜`：三阶段（铁奴·百毒不侵 + 余子童·元神），关键要「运功镇魂」。带好暗器飞针。
  - `jinguang_fight 暗算金光上人`：暗算流，注意金行强敌，可用火蛇符等克制。
- **每个大节点后**：用第 5 节流程更新存档 + 报告 + 本文件，commit & push。

---

## 5. checkpoint 工作流（接手者务必照做，防切窗口丢进度）

节奏：**按里程碑（每个主线大节点）为主 + 15 分钟兜底**。每次：

1. 游戏内先存档（或控制台 `State.save()`）。
2. 导出存档到仓库（见下「CDP 小工具」或手动 `copy(localStorage.getItem('frxxz_save_v1'))`）。
3. 更新本文件第 1 节快照 + 报告对应章节。
4. `git add docs/testsaves/qixuan-save.json docs/qixuan-review-handoff.md docs/playtest-七玄门篇-报告.md && git commit -m "..." && git push`（分支 `devin/qixuan-review`）。

### CDP 小工具（可选，自动导出存档 / 读状态，不污染仓库）
Chrome 已开 CDP 端点 `http://localhost:29229`。临时目录装 `ws` 即可脚本化：
```bash
mkdir -p ~/cdptool && cd ~/cdptool && npm init -y && npm i ws
```
脚本 `cdp.js` 连到含 `index.html` 的 page target，跑 `Runtime.evaluate`：
- 导出存档：`node cdp.js --expr "localStorage.getItem('frxxz_save_v1')" --out <repo>/docs/testsaves/qixuan-save.json`
- 读进度：`node cdp.js --expr "JSON.stringify({realm:DATA.realms[State.data.realmIndex].name,cul:State.data.cultivation,stage:State.data.storyStage,next:STORY[State.data.storyStage].id})"`

（脚本源码见会话；或直接用 DevTools 控制台手动跑同样表达式。）

---

## 6. 审阅红线（来自 `docs/playtest-experience-guide.md`）

- **R1** 移动端基准视口 iPhone 14 Pro Max 430×932（DPR 3）。
- **R2** 剧情/人物/道具对错以**动画**为准（细节可查原著）；不确定就 grep `docs/`（尤其 lore 文档），别凭记忆，报告里标出处。
- **R3** 只观察、只记录、**默认不改代码**；这是体验研究。除非用户明确要求才改。
- **R5** 不污染主仓库——但**本审阅三件套经用户明确同意**，push 到 `devin/qixuan-review` 分支（不进 main）。
