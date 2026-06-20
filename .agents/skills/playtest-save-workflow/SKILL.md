---
name: playtest-save-workflow
description: 凡人修仙传完整游戏测试流程——含8维体验观察、游戏性/难度/剧情/人设评估、每节点存档入库、体验报告产出。任何 agent 接手 playtest 任务时必读此文件。
---

# 凡人修仙传 · 游戏测试完整流程

## 一、任务定义

你是**体验调研员**：亲自从头到尾玩一段篇章，产出一份**结构化、可引导修复**的体验报告。
报告要回答：**哪里太难/太简单、哪里太繁琐、剧情是否合理通顺、人设是否突兀、道具有没有缺失、移动端体验如何、美术演出到不到位、有没有 bug。**

核心原则：**只观察只记录不改代码**（R3）。发现的问题写进报告交用户定夺。

## 二、红线（违者全错）

1. **R1 移动端基准（硬约束）**：一切游玩/验收 **一律 iPhone 14 Pro Max 视口（430×932，DPR 3）**。Chrome DevTools → Ctrl+Shift+M → 设备下拉选「iPhone 14 Pro Max」。
2. **R2 考据红线**：评判剧情/人物是否「对/错/突兀」时，**动漫版为唯一锚点**，小说仅补细节。拿不准先 `grep docs/`（lore-*.md），**绝不凭记忆下判断**。
3. **R3 只玩不改**：除非用户明确要你修，不要边玩边改代码。
4. **R4 报告而非臆断**：判断要带**可复现证据**（第几节、什么操作、什么数值），不写空洞主观感受。
5. **R5 每节点入库**：玩一个关键节点，存一次档，入一次库。绝不攒多个节点再统一提交。

## 三、环境启动

### 3.1 跑游戏
```bash
cd /home/ubuntu/fanrenxiuxianzhuan
node scripts/_serve.js 8099   # 或默认 8011
# 浏览器开 http://127.0.0.1:8099/
```

### 3.2 切视口
进页面后立刻：Ctrl+Shift+M → 设备下拉选「iPhone 14 Pro Max」（430×932）。

### 3.3 恢复存档
查看 `playtest/` 目录下最新的 `save-*.json`，在 Console 中：
```js
const saveData = '<paste JSON here>';
localStorage.setItem('frxxz_save_v1', saveData);
location.reload();
// 刷新后点「读取存档」
```

### 3.4 确认状态
```js
const s = State.data;
console.log(`storyStage=${s.storyStage}, realm=${s.realmIndex}, cul=${s.cultivation}`);
console.log(`location=${s.location}, chapter=${s.activeChapter}`);
console.log(`year=${s.year}, month=${s.month}`);
console.log('flags:', JSON.stringify(s.flags));
```

## 四、逐节点游玩流程

### 4.1 推进方式（全程 GUI 真人体验）
**核心原则**：像真人玩家一样在 430×932 手机视口里亲自操作，不用 JS 脚本跳过任何内容。
- **点选项**：每个剧情节点底部有选项按钮，点即推进
- **修炼度月**：用顶栏行动按钮（修炼/赶路/打坐等）推进月份，触发 `Engine.checkStory()`
- **舆图移动**：点顶栏「舆图」→ 点目标地点启程（注意条件：修为/盘缠/机缘）
- **战斗必须手动打**：亲自操作每一回合（选法术→选目标→结束回合），体验战斗手感和难度
- **Console 辅助仅用于**：恢复存档、确认状态变量、排查 bug。**不用于推进剧情或跳过内容**

### 4.2 截图策略（减少冗余，保留体验完整性）
**原则**：操作紧凑连续，只在"有信息量"的时刻截图，不对每个点击都截图。

| 场景 | 截图时机 | 不需要截图 |
|---|---|---|
| 剧情节点 | 文本全部渲染完后截 1 张（含选项） | 点击选项前的中间态 |
| 战斗 | 开战时 1 张 + 关键回合（发现问题时）+ 结束时 1 张 | 每回合的常规操作 |
| UI 问题 | 发现溢出/错位/太小时截 1 张 | 正常显示的 UI |
| 场景/CG | 新场景/新 CG 出现时截 1 张 | 重复出现的场景 |
| 赶集/修炼 | 操作完截 1 张确认结果 | 打开菜单的过程 |

**目标**：每个节点 3-6 张关键帧截图（而非 15-20 张），足够记录发现但不浪费时间。

### 4.3 关键节点判定
以下任一条件满足 = 必须触发存档入库：
1. 新剧情弹出（`Engine.checkStory()` 触发新节点）
2. 重大 flag 获得（如 `wan_met`, `xianhui_done`, `wan_avenged`, `departure_complete` 等）
3. `realmIndex` 提升（突破新境界）
4. `activeChapter` 变化
5. `location` 迁移到新区域
6. 战斗完成（boss 战/首次同道战/复仇战等）

## 五、8 维观察清单（边玩边记）

每到一个节点，按以下 8 个维度记录观察。格式：**「在第几节 / 什么操作 / 看到什么 / 我的判断」**

### A · 难度曲线
- 每场战斗：太简单（无脑过）/ 适中 / 太难（反复败）？
- 有没有「输得莫名其妙」（违反爽文契约：fail-forward）？
- 越阶战斗是否靠底牌咬？同阶是否一招好术≈敌血固定百分比？
- 具体记录：操作什么、血量变化、几回合结束、是否需要用底牌

### B · 节奏 / 繁琐度
- 「点了太多下才推进」的地方？
- 「赶路/集资粮太肝」的地方？
- 「连续纯文本太长没喘息」的地方？
- 锚-帆节奏是否成立？（锚=高紧张点，帆=日常舒展段）
- 每回合是否有小正反馈？有没有空等感？

### C · 缺道具 / 缺提示
- 剧情提到但游戏里**拿不到/没入背包**的道具？
- 该给玩家提示却没给的地方？（"接下来干什么"不明确）
- 天命/限时指引是否清晰准确？
- 商店/集市的物品是否合理可买？

### D · 移动端 UI（430×932）
- 竖屏单列布局是否正常？
- 顶栏「舆图＋⋯」/ 底部「见闻/行动/韩立」是否好用？
- 立绘/CG 有无被裁/溢出/糊？
- 文字是否过小/折行难看？
- 按钮是否够大可点（≥44px touch target）？
- 弹窗/对话框是否在视口内完整显示？

### E · 美术 / 演出
- 该出现的立绘/CG/场景/战姿是否出现？
- 是否对得上人物考据（R2）？有无张冠李戴？
- 有无破图/抠图毛边/黑边/竖图横图错位？
- BGM 是否贴合场景情绪（combat/tense/sorrow/triumph/journey/town/fair）？
- 音效（sfx）是否在正确时机触发？

### F · 游戏性 / 战斗手感
- 战斗操作是否有策略性？还是纯数值碾压？
- 手牌三区（法宝/法术/瞬发）是否清晰可辨？
- 底牌消耗品的取舍感是否传达到？
- 藏拙（示人境界≠真实境界）的设计意图是否被玩家感知？
- 同道系统（并肩作战）体验如何？

### G · Bug / 异常
- Console 红字报错？
- 卡死/无响应？
- 存读档异常（刷新后进度对不对）？
- 数值溢出/显示错误？
- 点击无响应/死循环？
- 条件判断死锁（无法推进）？

### H · 剧情 / 人设 / 沉浸
- 剧情逻辑是否通顺？有无漏洞？（前后矛盾/因果断裂）
- 人设是否一致？有无突兀转变？（韩立的谨慎/万小山的热心/青纹的阴狠）
- 剧情强度与数值强度是否匹配？（一致感）
- NPC 行为是否符合其身份和动机？
- 世界观细节是否自洽？（修仙体系/散修处境/七派关系）
- 有无出戏的地方？（台词违和/节奏断裂/情绪不连贯）
- 背景强者是否「在场但不抢玩家赛道」？（传说/在场/际遇三态）

## 六、存档入库标准流程（每个关键节点必做）

### 步骤 1：导出存档
浏览器 Console：
```js
const save = localStorage.getItem('frxxz_save_v1');
console.log('===SAVE_START===');
console.log(save);
console.log('===SAVE_END===');
```

### 步骤 2：写存档文件
```bash
# 将 JSON 格式化写入 playtest/save-<章节>.json
# 命名规则：save-<区域>-<节点>.json
# 例：save-tainan-meet.json, save-tainan-hunt.json
```

### 步骤 3：更新 RESUME 文件
更新 `playtest/RESUME-<章节>.md`：
- §0 当前进度概览表（storyStage / realmIndex / cultivation / location / flags / year+month）
- §1 Golden-Path 节点进度（✅已验 / 🟡当前 / ⬜待玩）
- §2 各维度观察笔记（A~H 维度的发现）
- §3 Bug/问题清单（P0/P1/P2 分级）

### 步骤 4：Git 提交
```bash
cd /home/ubuntu/fanrenxiuxianzhuan
git add playtest/save-*.json playtest/RESUME-*.md
git commit -m "playtest(<篇章>): <节点id> checkpoint (storyStage=<N>, realm=<R>, <location>)"
```

### 步骤 5：推送远程分支
```bash
TS=$(date +%s)
BRANCH="devin/${TS}-playtest-<节点id>"
git push "https://${FRXX_PAT}@github.com/chentong227/fanrenxiuxianzhuan.git" HEAD:${BRANCH}
```
> PAT 仅在 push/curl 中使用，绝不 echo/sed 暴露。

### 步骤 6：创建并合并 PR
```bash
# 创建 PR
PR_RESP=$(curl -s -X POST \
  -H "Authorization: Bearer $FRXX_PAT" \
  -H "Accept: application/vnd.github+json" \
  https://api.github.com/repos/chentong227/fanrenxiuxianzhuan/pulls \
  -d "{\"title\":\"playtest(<篇章>): <节点id> checkpoint\",\"head\":\"${BRANCH}\",\"base\":\"main\",\"body\":\"存档入库\\n- storyStage: <N>\\n- realmIndex: <R>\\n- location: <loc>\\n- 新flag: <flags>\\n- 观察: <简要发现>\"}")

# 提取 PR 号
PR_NUM=$(echo "$PR_RESP" | grep -o '"number": [0-9]*' | head -1 | grep -o '[0-9]*')

# 合并 PR
curl -s -X PUT \
  -H "Authorization: Bearer $FRXX_PAT" \
  -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/chentong227/fanrenxiuxianzhuan/pulls/${PR_NUM}/merge" \
  -d '{"merge_method":"rebase"}'
```

### 步骤 7：验证部署
```bash
sleep 15
curl "https://chentong227.github.io/fanrenxiuxianzhuan/ver.txt?cb=$(date +%s)"
```

## 七、体验报告模板

测试完成后，按此模板产出报告（Markdown 附件发给用户）：

```markdown
# 《<篇章名>》游玩体验报告
- 调研人：<agent/session>　日期：<date>　版本：ver.txt=<n>
- 游玩模式：☐ 完整通关　☐ 接续存档（从 storyStage=<N> 起）
- 通关情况：走到第 __ 节（id ____）
- 视口：iPhone 14 Pro Max (430×932)

## 一句话总评
（最大优点 + 最该改的 1-3 件事）

## A 难度曲线
| 战斗节点 | 太简单/适中/太难 | 证据（操作·数值·回合数） | 建议 |
|---|---|---|---|

## B 节奏 / 繁琐度
（哪里拖、哪里赶、哪里点太多下；锚-帆是否成立）

## C 缺道具 / 缺提示
| 期望 | 现状（缺/没提示） | 出现节点 | 建议修复方式 |
|---|---|---|---|

## D 移动端 UI
（布局/立绘/文字/按钮；问题截图描述）

## E 美术 / 演出
| 节点 | 预期资产 | 实际表现 | 问题及建议 |
|---|---|---|---|

## F 游戏性 / 战斗手感
（策略性评估、手牌系统、底牌取舍感、藏拙设计）

## G Bug / 异常
| 现象 | 复现步骤 | Console 报错 | 严重度(P0/P1/P2) |
|---|---|---|---|

## H 剧情 / 人设 / 沉浸
（剧情逻辑、人设一致性、情感节奏、出戏点、世界观自洽性）

## 改进建议（按优先级排序）
1. （P0 必改）…  ← 引导：改哪个文件/函数/数值，怎么改
2. （P1 建议）…  ← 引导：影响范围、修复思路
3. （P2 锦上添花）…
4. （构想）…     ← 你自己提出的新想法/优化方向
```

## 八、Golden-Path 节点清单

### 七玄门篇（storyStage 0-12）
| # | 节点 id | 标题 | 战斗 | 关键 flag |
|---|---|---|---|---|
| 0 | village | 青牛镇 | — | at_village |
| 1 | journey | 赴考 | — | — |
| 2 | exam | 入门选拔 | — | joined_sect |
| 3 | intro | 拜墨大夫 | — | met_modafu |
| 4 | friends | 结识厉飞雨 | — | adventured |
| 5 | bottle | 得绿瓶 | — | — |
| 6 | secret_cultivate | 暗中精进 | — | — |
| 7 | zhangtie | 张铁之死 | — | zhangtie_dead |
| 8 | showdown_prep | 决战准备 | — | showdown_ready |
| 9 | showdown | 反杀墨大夫 | ✔ | modafu_dead, showdown_won |
| 10 | take_identity | 顶替身份 | — | is_modafu |
| 11 | gang_conflict | 野帮冲突 | ✔ | gang_war |
| 12 | arc_end | 夺仙离去 | ✔ | jinguang_dead, arc1_complete |

### 离门远行篇（storyStage 13-21，太南小会区域）
| # | 节点 id | 标题 | 战斗 | 位置 | 关键 flag | 预期美术/BGM |
|---|---|---|---|---|---|---|
| 13 | han_du_meet | 韩堵相遇 | — | jiayuan | han_du | — |
| 14 | mo_arrive | 墨府谋主 | — | jiayuan | mo_met | — |
| 15-17 | mo系列 | 嘉城三连 | ✔ | jiayuan | han_du_cured | — |
| 18 | wan_meet | 太南小会·引人 | — | tainan_fair | wan_met | bgm:fair, amb:crowd |
| 19 | qingwen_plot | 青纹道·黑手 | — | tainan_fair | qingwen_seen | bgm:tense, sfx:danger |
| 20 | wan_hunt | 搭伴探山 | ✔ 灵狼 | tainan_fair | wan_hunt_done | bgm:combat |
| 21 | xianhui_open | 升仙大会·测灵台 | — | tainan_fair | xianhui_done | cg:xianhui_tai, sfx:fail |
| 22 | wan_death | 暮色森林·故人之血 | ✔ 复仇战 | tainan_fair | wan_avenged | cg:tainan_lin, bgm:sorrow |
| 23 | xianhui_end | 升仙令·入谷 | — | tainan_fair | departure_complete | bgm:triumph |

### 黄枫谷篇（storyStage 24+）
| # | 节点 id | 标题 | 关键 flag |
|---|---|---|---|
| 24 | hf_arrive | 入谷·吴师叔 | hf_arrived |
| … | … | （见 story.js 后续节点） | … |

## 九、接续指引

### 如何找到当前进度
1. 查 `playtest/` 目录下最新的 `save-*.json` 和 `RESUME-*.md`
2. 读 RESUME 文件的 §0 了解当前 storyStage / location / flags
3. 按 §三.3 恢复存档
4. 按 §四 继续游玩

### 节点条件速查
如果剧情卡住推不动，检查：
```js
// 看下一个节点的 cond 条件
// 例如 wan_meet 需要: han_du_cured && location === "tainan_fair"
// qingwen_plot 需要: wan_met && fair_bought >= 1
// wan_hunt 需要: qingwen_seen && absMonth >= xianhui_due - 1
// xianhui_open 需要: qingwen_seen && absMonth >= xianhui_due && location === "tainan_fair"
// wan_death 需要: xianhui_done
// xianhui_end 需要: wan_avenged
```

### 推进时间（等会期类节点）
部分节点有时间条件（如 `xianhui_due`），需推进月份：
- 方法一：点游戏内"修炼"/"打坐"/"赶集"行动按钮度月
- 方法二（Console）：`Engine.advanceMonth(); Engine.checkStory();`

## 十、注意事项

1. **PAT 安全**：PAT 只在 git push / curl 命令中直用，不写入任何文件、不 echo 打印
2. **测试视口**：始终 iPhone 14 Pro Max (430×932)，桌面宽屏只作旁证
3. **commit 格式**：`playtest(<篇章>): <节点id> checkpoint (storyStage=<N>, realm=<R>, <location>)`
4. **bug 按 P0/P1/P2 分级**：P0=卡死/无法推进；P1=体验严重受损；P2=小瑕疵
5. **考据争议标来源**：写"人设突兀"时必须引用动漫版/docs/具体台词作为依据
6. **构想标注为构想**：自己的新想法/优化方向明确标为「构想」而非「问题」
7. **不录屏**：产出文字报告 + 截图描述即可，无需视频录制
8. **报告含修复引导**：每个问题不只记录现象，还要写**建议怎么改**（哪个文件/函数/数值/思路）
