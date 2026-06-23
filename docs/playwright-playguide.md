# Playwright 自动游玩引导文档

## 核心原则
**像真实玩家一样操作**：看截图 → 找按钮 → 点击 → 看结果。不用 eval/console 操纵游戏状态。

## 游戏界面结构

### 1. 标题界面
- `#screen-create` — 创建角色界面
- 按钮：测灵根、踏入此界
- 选择器：`button` 文本匹配

### 2. 主游戏界面
- `#screen-game` — 主游戏画面
- **顶栏**：`#top-time`（年月）、`#hero-name`、`#hero-portrait`（立绘）
- **行动按钮区**：`#action-buttons` 里的 `.btn-action` 按钮
  - 每个按钮有 `data-action` 属性（cultivate/rest/breakthrough/bottle/adventure/gather/explore等）
  - 点击触发 `Engine.doAction(action)`
- **底部导航**：`.mtab` 按钮（舆图/⋯/见闻/行动/韩立）
  - 切换主界面标签页

### 3. 剧情演出（视觉小说式）
- `#story-overlay` — 剧情覆盖层
- **推进对话**：点击 `#story-dialog`（整个对话框可点）
  - 题字卡期间（`st.titling`）点击无效，需等题字卡自动消失或手动跳过
  - 打字中点击会先补完文字
  - 跳过按钮：`#story-skip`（onclick=`UI.storySkip()`）
- **选择选项**：点击 `.choice` 按钮
  - 战斗类选项有 `.choice-fight` 类
  - 选项点击触发 `UI.storyChoose(i)`

### 4. 战斗界面
- `#combat-overlay` — 战斗覆盖层
- **法术按钮**：`#combat-spells` 里的按钮
- **结束回合**：`#combat-endround`
- **特殊行动**：`.combat-actions` 里的按钮（速战速决/升空/遁走）
- **战斗日志**：`#combat-logbtn`

### 5. 模态框
- `#modal-overlay` — 模态框覆盖层
- 闭关修炼、突破、采买等操作通过模态框进行
- 关闭：点击 `#modal-overlay` 或调用 `UI.closeModal()`

## 游玩操作方式

### 推进剧情
```
1. 截图看画面
2. 如果有 story-overlay（剧情卡）：
   a. 点击 #story-dialog 推进对话
   b. 等待打字/演出完成
   c. 重复直到出现 .choice 按钮
   d. 点击选择的 .choice 按钮
3. 截图确认结果
```

### 日常行动
```
1. 确认在主界面（无 story-overlay、无 combat-overlay、无 modal-overlay）
2. 截图看当前行动按钮
3. 点击对应的 .btn-action 按钮
4. 如果弹出模态框，在模态框内操作
5. 截图确认结果
```

### 修炼循环
```
1. 点击"闭关修炼"按钮 → 弹出闭关模态框
2. 选择闭关时长（1月/6月/1年/3年/至圆满）
3. 闭关后修为增加，心境下降
4. 心境过低时"打坐调息"恢复
5. 修为达到60% culMax 时可"尝试突破"
```

### 探索后山
```
1. 确认地点有"深入探索"行动按钮
2. 点击进入后山迷雾探索
3. 在迷雾中移动、发现灵草/遭遇
4. 获取灵草后用小绿瓶培养
5. 吃培养后的道具提升修为
```

### 战斗
```
1. 战斗界面出现后，截图看敌人状态
2. 点击法术按钮攻击
3. 注意射程（贴身/远程）
4. 点击"结束回合"让敌人行动
5. 重复直到胜利或失败
```

## Playwright 操作映射

| 游戏操作 | Playwright 代码 |
|---|---|
| 推进对话 | `page.click('#story-dialog')` |
| 跳过剧情 | `page.click('#story-skip')` |
| 选择选项 | `page.click('.choice:nth-child(n)')` 或文本匹配 |
| 点击行动 | `page.click('[data-action="cultivate"]')` |
| 切换标签 | `page.click('.mtab:nth-child(n)')` 或文本匹配 |
| 关闭模态 | `page.click('#modal-overlay')` |
| 结束回合 | `page.click('#combat-endround')` |

## 注意事项
1. **每次操作后都要截图确认**——不能盲目操作
2. **有头模式（headless: false）**——要看到立绘、CG、特效
3. **题字卡会阻塞推进**——需要等待或跳过
4. **心境系统**——不能无限闭关，心境低了要调息
5. **存档**——关键节点后手动保存
6. **截图命名**：frame_序号_描述.png
