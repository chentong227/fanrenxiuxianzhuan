# 篇章开发规范（Chapter Template）

> 目的：把"七玄门篇"沉淀为一套**标准结构**，使后续地区（黄枫谷篇、乱星海篇…）能按同一模板扩展，
> 不必再改动引擎核心。新增一章 = 填一份配置 + 一组剧情/地点/敌人数据，并通过结构校验测试。

## 一、一个篇章包含什么

| 组成 | 文件 | 说明 |
|------|------|------|
| 篇章配置 | `js/chapters.js` | id、名称、顺序、境界上限、大境界序、起始地点、收尾flag、下一章、是否锁定 |
| 剧情脚本 | `js/story.js` | 每个 stage 标 `arc`，按篇章分组；触发用 cond + where(地点门禁) |
| 大世界地点 | `js/world.js` | 每个 location 标 `arc`；地图只显示当前篇章地点 |
| 遭遇/NPC/奇遇 | `world.js`/`fortunes.js` | 标 `arc`（或 where 指向本章地点） |
| 功法/物品 | `data.js` | 功法标 `arc` + `locked`；未到篇章不可得 |
| 平衡 | `balance.js` | realmPower/spellPower 已是全局公式，新章套用即可 |

## 二、新增篇章的步骤（Checklist）

1. **设定圣经**：新建 `docs/lore-XX篇.md`，核实剧情（优先忠于动漫改编），固定人物/功法/因果/境界上限。
2. **篇章配置**：在 `chapters.js` 的 `CHAPTERS.list` 增加一项，填齐字段（见三）。把 `locked` 置 false（或由上一章收尾解锁）。
3. **境界**：在 `data.js` `DATA.realms` 补本章新增的境界层；本章 `realmCapIndex` 指向本章可达上限。
4. **地点**：在 `world.js` 增加本章 location（标 `arc`）、敌人模板、NPC、活动。
5. **剧情**：在 `story.js` 末尾追加本章 stage（标 `arc`），用 cond/where 串联；收尾 stage 设 `completeFlag` 并解锁下一章。
6. **功法/物品**：把本章可得功法 `locked` 在剧情中按原著节点解锁；新物品加入 `DATA.items`。
7. **测试**：跑 `node test/chapter.test.js` 校验结构合规；新增本章的平衡/流程用例。

## 三、篇章配置字段（chapters.js 单项）

```
{
  id: "qixuan",            // 篇章唯一标识
  name: "七玄门篇",         // 显示名
  order: 1,                 // 顺序（用于推进/排序）
  locked: false,            // 是否未解锁（后续章默认 true，由上一章收尾解锁）
  realmTier: 0,             // 本章大境界序（0练气/1筑基/...）影响法术成长
  realmCapIndex: 6,         // 本章可突破到的最高境界（DATA.realms 索引）
  startLocation: "yaolu",   // 本章默认所在地点
  startStage: "village",    // 本章首个剧情 stage id（可选）
  completeFlag: "arc1_complete", // 本章通关标志
  nextChapter: "huangfeng", // 下一章 id（收尾时解锁）
  currencyName: "纹银",      // 本章主要凡俗通货名（仅展示用）
}
```

## 四、引擎与篇章的契约（不可破坏）

- **境界上限**：引擎读 `Chapters.active().realmCapIndex`，**不得**再硬编码数字。
- **大境界序**：战斗 `realmTier` 读 `Chapters.active().realmTier`。
- **地图**：云游/历练只在当前篇章（且已解锁）的地点间进行。
- **收尾→解锁**：通关 stage 设 `completeFlag`，并把 `nextChapter` 的 `locked` 解除（存档记录已解锁篇章）。
- **存档兼容**：新增字段必须给老存档兜底默认值（见 state 的迁移逻辑）。

## 五、红线（沿用）
- 优先忠于动漫改编；人物/功法/因果不可篡改。
- 强功法有代价、有铺垫；平衡由蒙特卡洛持续校验。
- 随机只进世界与过程，主角人设固定。
