# 体验审阅：离门远行篇 → 初入星海篇（全量静态+运行时扫描）

**审阅方式**：headless 引擎走查（全 107 个 story node）+ Playwright 浏览器实机渲染验证 + 静态资产交叉比对
**审阅范围**：七玄门篇结尾 → 离门远行篇 → 黄枫谷篇 → 燕家堡之战 → 魔道争锋篇 → 再别天南篇 → 初入星海篇
**基准**：`devin/1781943174-v149-bugfix` 分支（PR #94 后）

---

## §1 审阅结论

| 类别 | P0 | P1 | P2 | 合计 |
|------|----|----|----|----|
| 黑屏（地点场景缺失） | 7 | — | — | 7 |
| 立绘缺失（有映射无文件） | — | 9 | — | 9 |
| 说话人映射缺失 | — | 12 | — | 12 |
| BGM 引用无音频 | — | — | 9 | 9 |
| **合计** | **7** | **21** | **9** | **37** |

**已验证 OK（不是 bug）**：
- ✓ 全部 83 个 CG 注册正确、文件存在、浏览器可渲染（实机验证 mofu CG）
- ✓ journey.test.js 全绿（全量 E2E 从离门远行到初入星海）
- ✓ 立绘串位修复有效（PR #94 的 `leftNpc` 清除逻辑）
- ✓ 所有 story node 的 `cond`/`onArrive`/`choices` 格式合法
- ✓ 无空 text 数组、无 null 对话行

---

## §2 P0 · 黑屏 Bug：7 个地点缺少场景图

玩家在以下地点**关闭剧情 CG 后**或**日常行动时**，背景完全黑屏。
根因：`SCENES` 注册表（art.js）无对应条目 → `Art.locUrl()` 返回 null → UI 无图可贴。

| # | 地点 ID | 名称 | 所属篇章 | 影响 |
|---|---------|------|----------|------|
| 1 | `fangshi` | 黄枫谷 · 坊市 | 黄枫谷篇 | 玩家购物/互动时黑屏（**高频场景**） |
| 2 | `yuanwu` | 元武国 · 百艺坊 | 黄枫谷篇 | 代工·齐云霄场景黑屏 |
| 3 | `yanjiabao` | 燕家堡 | 燕家堡之战 | 战前战后黑屏（**整章主场景**） |
| 4 | `modao_front` | 魔道前线 · 待命营 | 魔道争锋篇 | 闭关/调息/等候征调时黑屏（**home 场景**） |
| 5 | `jinguyuan` | 金鼓原 | 再别天南篇 | 决战旷野黑屏 |
| 6 | `yuekuang` | 越国矿洞 · 古传送阵 | 再别天南篇 | 离天南逃生路黑屏 |
| 7 | `luanxinghai` | 乱星海 | 初入星海篇 | 开篇落脚地黑屏（**新篇第一印象**） |

**修复方案**：
- `yanjiabao`/`jinguyuan`/`yuekuang`/`luanxinghai` 在 world.js 已标 `scene: true`，说明设计意图有场景图，只是还没生成
- 需为每个地点用 `genart.js` 生成场景图（横版 + 竖版 `_p`），然后在 art.js `SCENES` 注册
- `fangshi`/`modao_front` 未标 `scene: true`，需要先确认设计意图

---

## §3 P1 · 立绘缺失：9 个有名有姓的 NPC 无立绘文件

这些 NPC 在 `_npcIdByName` 或 `WORLD.npcs` 中有映射，但 `assets/portraits/` 下无对应文件。
说话时左侧立绘区为空白（不会串位，PR #94 已修）。

| # | 角色名 | NPC ID | 出场节点 | 篇章 |
|---|--------|--------|----------|------|
| 1 | 齐云霄 | `qiyunxiao` | qiyunxiao_daigong | 黄枫谷篇 |
| 2 | 执旗使 | `zhiqishi` | yanjia_escape | 燕家堡之战 |
| 3 | 刘靖（六镜） | `liujing` | modao_e2~e4（8个节点） | 魔道争锋篇 |
| 4 | 钟卫娘 | `zhongweiniang` | modao_e2~e4（5个节点） | 魔道争锋篇 |
| 5 | 宋蒙 | `songmeng` | modao_e2~e4（4个节点） | 魔道争锋篇 |
| 6 | 武炫 | `wuxuan` | modao_e2（3个节点） | 魔道争锋篇 |
| 7 | 铁罗 | `tieluo` | modao_e3_tieluo | 魔道争锋篇 |
| 8 | 五色门主 | `wuse_menzhu` | modao_e3_wuse | 魔道争锋篇 |
| 9 | 胥王 | `xuwang` | modao_e4_dive/xuwang | 魔道争锋篇 |

另有 3 个 WORLD.npcs 无立绘（不直接说话但可能出现在侧栏）：
- `wanbao_zhanggui`（万宝掌柜）、`zhanwangchan`（战王蝉）

**修复方案**：用 `genart.js` 批量生成立绘。魔道争锋篇有 6 个角色集中缺失（刘靖/钟卫娘/宋蒙/武炫/铁罗/五色门主/胥王），建议一批处理。

---

## §4 P1 · 说话人映射缺失：12 个命名角色无 `_npcIdByName` 条目

这些角色在剧情中有 `{ say: "名字" }` 台词但 `_npcIdByName()` 返回 null。
即使有立绘文件也无法关联显示。需在 ui.js `_npcIdByName` 的 `extra` 对象中补映射。

| # | 说话人 | 出场节点 | 备注 |
|---|--------|----------|------|
| 1 | 黄枫谷掌门 | hf_zhangmen | 黄枫谷篇 重要 NPC |
| 2 | 封岳 | fengyue_ambush | 黄枫谷篇 关键反派 |
| 3 | 青纹道人 | qingwen_plot | 离门远行篇 |
| 4 | 血茧铁罗 | modao_e3_tieluo2 | 铁罗变身态，需映射到 `tieluo` 或新 ID |
| 5 | 秦府老门房 | modao_e3_rujing | 魔道争锋篇 |
| 6 | 御灵宗夺舍者 | zaibie_a1 | 再别天南篇 |
| 7 | 辛如音 | zaibie_a3~cut1（4节点） | 再别天南篇 **重要角色** |
| 8 | 冯三娘 | starsea_a2（2节点） | 初入星海篇 |
| 9 | 雷鹏 | starsea_a2_jingbian | 初入星海篇 |
| 10 | 妙音门掌门 | starsea_a2_jiuziling | 初入星海篇 |
| 11 | 汪凝 | starsea_a2~a3（3节点） | 初入星海篇 **重要角色** |
| 12 | 古长老 | starsea_a2_jiuziling | 初入星海篇 |

另有 5 个**龙套角色**（不需要立绘，映射缺失可接受）：
司仪修士、刀疤散修、接引修士、探马、魁星城散修

---

## §5 P2 · BGM 引用无音频

story.js 中使用了 9 个 BGM 标记（`{ bgm: "xxx" }`），但 audio.js 中无对应注册。
当前效果：BGM 切换指令被静默忽略（不影响功能，但无配乐体验）。

| BGM key | 含义 |
|---------|------|
| `sorrow` | 悲伤 |
| `tense` | 紧张 |
| `journey` | 旅途 |
| `town` | 城镇 |
| `fair` | 集市 |
| `combat` | 战斗 |
| `triumph` | 凯旋 |
| `daily` | 日常 |
| `boss` | BOSS战 |

---

## §6 修复优先级建议

### 第一批（最小可玩）：
1. **生成 7 个地点场景图** → 消灭所有黑屏
2. **ui.js 补 12 个 _npcIdByName 映射** → 2 分钟代码改动

### 第二批（角色完整性）：
3. **生成 9+2 个 NPC 立绘** → 魔道争锋篇 7 个角色一批跑

### 第三批（锦上添花）：
4. **生成 9 首 BGM** → `genmusic.js` 批量生成

---

## §7 检测方法与工具

- `playtest-departure.js`：headless 引擎全量走查（107 个 story node）
- `check-speakers.js`：说话人 ↔ _npcIdByName ↔ portrait 文件三方交叉
- `cg-check.js`：Playwright 浏览器实机 CG 渲染验证（Art.cgUrl → Image.decode）
- `check-story-bugs.js`：story node 结构验证（cond/onArrive/choices/text/bgm）
- `journey.test.js`：E2E 全量主线测试（已全绿）
