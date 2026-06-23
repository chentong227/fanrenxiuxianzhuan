# 箱庭舞台系统（Stage Scene）· 设计文档

> 2026-06-23 立项。复用 L3 箱庭轴渲染管线，让人物在横版背景上移动、对话、追逐、布阵、
> 逃跑——并随时无缝坠入战斗。剧情演出从"立绘+背景+文字框"升级为"横版舞台剧"。
>
> 红线：①复用现有底座（L3轴渲染/cutscene.js/Combat/ExploreMap），不另起炉灶；
> ②向后兼容旧 text:[]；③单屏铁律；④随时可跳；⑤动漫版为唯一剧情锚点。

---

## 一、问题与目标

### 现状痛点
- **追逐/逃跑无张力**：燕家堡逃出、皇宫布阵断后——全是"点对话→突然进战斗"
- **场景切换生硬**：箱庭→剧情卡→战斗是三个独立 UI 硬切
- **线性剧情缺空间感**：燕家堡纯线性四节点，玩家在堡内没有"走动"感觉

### 目标
一条 Stage Scene 管线，剧情可以这样写：

```
箱庭L3（韩立在燕家堡走动，偶遇墨彩环）
  → 立绘CG（重逢对话，切到传统演出卡）
  → 箱庭L3（战王蝉破阵，韩立逃跑）
  → 战斗（坠入对阵轴，继承轴上位置）
```

---

## 二、核心概念：Stage Beat

### 2.1 在 cutscene 编译器中新增 stage beat

```js
// story.js text:[] 里这样写
{
  stage: {
    bg: "yanjiabao_nei", W: 18,
    units: [
      { id: "hanli",     art: "bt_hanli",     pos: 2, name: "韩立",   face: "r" },
      { id: "mocaihuan", art: "bt_mocaihuan", pos: 8, name: "墨彩环", face: "l" },
    ],
    script: [
      { move: "mocaihuan", to: 5, ms: 1200 },
      { say: "mocaihuan", text: "韩大哥！真的是你！", emo: "cry" },
      { cgOut: true },  // 切回立绘CG
    ]
  }
}
```

### 2.2 生命周期

```
text:[] 编译
  → 普通台词 → story overlay（现行逻辑不变）
  → { stage:{...} } → 编译为 kind:"stage" beat
      → ui 遇到 stage beat → 进入舞台模式
      → 渲染 L3 轴（复用 _renderExmapScene）
      → 执行 script[]
      → cgOut → 回 story overlay
      → combat → 坠入战斗（复用 D1-a drop）
```

### 2.3 与现有系统的关系

| 现有系统 | 复用方式 |
|---|---|
| L3 轴渲染 `_renderExmapScene` | 舞台渲染直接复用：背景、死区镜头、视差、单位、格子 |
| cutscene.js 编译器 | stage 作为新 beat kind；内部 say/move/fx 复用现有原语 |
| story.js text:[] | stage 段落与旧台词混排，向后兼容 |
| Combat 对阵轴 | combat drop 时继承轴位置/热点/preps |
| ExploreMap 热点/preps | 舞台可放热点和布置物 |

---

## 三、舞台脚本原语

| 原语 | 形态 | 阻塞 | 说明 |
|------|------|------|------|
| `move` | `{move:id, to:pos, ms:1200}` | 否(定时续) | 单位滑到目标格 |
| `say` | `{say:id, text, emo, tone}` | 是(等点击) | 轴上对话气泡 |
| `narr` | `{narr:"..."}` | 是 | 底部字幕条(复用exmapNote) |
| `fx` | `{fx:"burst", at:pos, elem, n}` | 否 | 轴上指定格特效 |
| `sfx`/`bgm`/`amb` | 同 cutscene | 否 | 音效/配乐/环境床 |
| `cam`/`shot` | 同 cutscene | 否(定时续) | 镜头(复用死区镜头) |
| `wait` | `{wait:800}`/`{wait:"click"}` | 定时否/点击是 | 等待 |
| `chase` | `{chase:id, target:id, speed:1.5, onCatch:{...}}` | 是 | 追逐：每拍向目标移N格 |
| `flee` | `{flee:id, from:id, to:pos, ms, onCaught:{...}, onEscape:{...}}` | 是 | 逃跑：自动移动，追者在后 |
| `place` | `{place:id, prep:"flag", at:pos}` | 否 | 单位在格上布置 |
| `take` | `{take:id, hotId:"flag1"}` | 否 | 单位拾取热点 |
| `spawn` | `{spawn:id, art, pos, name}` | 否 | 新单位登场 |
| `despawn` | `{despawn:id}` | 否 | 单位退场 |
| `freeMove` | `{freeMove:true, hint, trigger:{pos,radius}}` | 是 | 玩家自由行走，走到触发区续演 |
| `choice` | `{choice:[{text,effect},...]}` | 是 | 轴上抉择 |
| `cgOut` | `{cgOut:true}` | 终止 | 退出舞台，回 story overlay |
| `combat` | `{combat:"id", inheritPos:true}` | 终止 | 坠入战斗 |

---

## 四、追逐与逃跑

### 4.1 追逐（chase）

```js
{ chase: "xuwang", target: "hanli", speed: 1.5, onCatch: { combat: "ambush", inheritPos: true } }
```

- 追逐者每拍(~800ms)向目标移动 speed 格
- 目标由玩家控制（点击格子移动）
- 追上(onCatch) → 战斗/台词/特效

### 4.2 逃跑（flee）

```js
{ flee: "hanli", from: "xuwang", to: 10, ms: 3000, onCaught: { combat: "ambush" }, onEscape: { say: "liujing", text: "阵成了！" } }
```

- 逃跑者自动向目标格移动
- 追击者自动跟随（速度略快，制造紧张感）
- 玩家可干预：点击格子改变逃跑路线
- 到达目标格 → onEscape；被追上 → onCaught

### 4.3 张力来源

- **距离可视化**：追兵在轴上逼近，每拍近一格
- **路径选择**：近路可能经过危险区，远路安全但耗时
- **布阵断后**：逃跑途中花一拍放阵旗——少跑一步 vs 阵法加持
- **引敌入阵**：退到阵法范围 → 阵法触发 → 战斗开场

---

## 五、场景衔接切换

### 5.1 三种渲染模式

| 模式 | 渲染层 | 触发 | 内容 |
|------|--------|------|------|
| Story Overlay（立绘CG） | `#story-overlay` | 普通台词 | 立绘+背景+文字框 |
| Stage Scene（箱庭舞台） | `#exmap-overlay`复用 | `{stage:{...}}` beat | 横版轴+单位+对话气泡 |
| Combat（对阵轴） | `#combat-overlay` | `{combat:id}` drop | 回合制战斗 |

### 5.2 切换流程

```
Story Overlay ──{stage}──→ Stage Scene ──{cgOut}──→ Story Overlay
                                │
                            {combat,inheritPos}
                                │
                                ▼
                            Combat ──结算──→ Story Overlay 或 Stage Scene
```

### 5.3 无缝切换关键

- **Story→Stage**：story overlay 淡出，exmap overlay 淡入（CSS opacity 300ms）
- **Stage→Story**（cgOut）：反向淡入淡出
- **Stage→Combat**（inheritPos）：舞台 W/单位位置/热点/preps 直接传给 Combat 构造函数——**同一根轴，规则从"脚本移动"切到"回合制"**
- **Combat→Story**：照现行 `_finishCombat` 逻辑

---

## 六、自由行走模式（freeMove）

```js
{ freeMove: true, hint: "前往校场中央", trigger: { pos: 8, radius: 2 } }
// 韩立走到 pos 6~10 → 触发后续脚本
```

或触发偶遇：
```js
{ freeMove: true, hint: "四处看看", trigger: { npc: "mocaihuan", radius: 2 } }
```

- 玩家点击格子自由行走，不耗时间
- 走到触发区域 → 自动续演
- 路上可放可选热点（NPC/物品），走过去才触发

用途：燕家堡调令后韩立从堡门走入堡内，玩家手动走到校场→偶遇墨彩环。线性剧情空间化。

---

## 七、无缝入战（inheritPos）

```js
{ combat: "tuoshi", inheritPos: true }
```

执行时：
1. 读取舞台的 W、单位位置、热点、preps
2. 传给 `Engine.startCombat()`：player.pos/enemies[].pos/hotspots/preps 全继承
3. 战斗 overlay 覆盖舞台——同一根轴，规则切换

与现有 `{fight:id}` 的区别：

| | `{fight:id}`（现有） | `{combat:id,inheritPos}`（新增） |
|---|---|---|
| 来源 | Story Overlay | Stage Scene |
| 位置继承 | 无 | 有 |
| 热点继承 | 无 | 有 |
| preps 继承 | 无 | 有 |

---

## 八、轴上对话气泡

```
┌─────────────────────────────────┐
│  横版背景（燕家堡校场）          │
│                                 │
│  [韩立]    ┌──────────┐         │
│   立绘     │ 韩大哥！ │ [墨彩环] │
│            │ 真的是你！│  立绘    │
│            └──────────┘         │
│  ═══════════════════════════    │
│  · · · ●· · · · ●· · · · ·     │
│        韩立    墨彩环            │
│  ▽ 轻触继续                     │
└─────────────────────────────────┘
```

- 说话者气泡在立绘上方/下方（按立绘位置决定）
- 气泡有尾尖指向说话者
- 非说话者立绘暗淡（复用 `.dim`）
- 打字机复用 `_typeText`
- 旁白用底部字幕条（复用 `exmapNote`）

新增渲染：只有对话气泡（~80行 CSS+DOM），其余全复用。

---

## 九、舞台状态管理

```js
this._stageState = {
  bg: "yanjiabao_nei", W: 18,
  units: {
    hanli:     { id:"hanli",     art:"bt_hanli",     pos:3, name:"韩立",   face:"r" },
    mocaihuan: { id:"mocaihuan", art:"bt_mocaihuan", pos:9, name:"墨彩环", face:"l" },
  },
  hotspots: [ { id:"flag1", name:"阵旗·木", pos:10, taken:false } ],
  preps: { array_wood: 10 },
  cam: { x:0, y:0, s:1 },
};
```

- **进入舞台**：初始化 `_stageState` → 渲染 L3 轴
- **脚本执行**：每条原语修改 state → 增量更新
- **退出**：cgOut → 销毁 state；combat → 传给战斗构造函数
- **存档**：舞台瞬态不入存档，退出后 flag/进度由 `onArrive` 保证

---

## 十、完整案例：燕家堡篇改造

### 现状（纯线性四节点）
```
yanjia_summon → yanjia_reunion → yanjia_boss → yanjia_escape
（全立绘CG）
```

### 改造后（舞台+CG交替）
```
yanjia_summon（调令·立绘CG）
  →【舞台】韩立抵达燕家堡，从堡门走入
    → freeMove：走到校场中央
    → 偶遇墨彩环（spawn + 轴上对话）
    → cgOut → 切回立绘CG
  → yanjia_reunion（重逢·立绘CG，保留现有演出）
  →【舞台】战王蝉破阵
    → chase：战王蝉追韩立
    → 董萱儿断后
    → combat：坠入战王蝉战斗(inheritPos)
  → yanjia_boss（战王蝉·舞台→战斗）
  →【舞台】逃出燕家堡
    → flee：韩立护墨彩环向堡门跑
    → 沿途可选热点（受伤同门→给丹/不管）
    → cgOut → 切回立绘CG
  → yanjia_escape（逃出·立绘CG，保留现有演出）
```

### 改造原则
- **保留现有立绘 CG**：现有 text:[] 不删，前后插入 stage 段落
- **stage 段落承担空间叙事**：移动/偶遇/追逐/逃跑
- **立绘 CG 段落承担情感叙事**：重逢的泪/离别的愁
- **两者交替**：舞台→CG→舞台→CG→战斗→CG

---

## 十一、完整案例：皇宫决战改造

### 改造后
```
【立绘CG】皇宫议事——师兄弟分工
  →【舞台】师兄弟跑向布阵位（move + place）
    → 韩立断后，胥王追来（chase + flee）
    → 退到阵法范围 → combat: tuoshi（inheritPos，阵旗已在轴上）
  →【战斗】拖时布阵战
  →【立绘CG】阵成——师兄弟归位
  →【舞台】胥王真身现形（spawn + fx）
    → combat: xuwang_final（inheritPos）
  →【战斗】阵成决战
```

### 皇宫布阵断后脚本

```js
{
  stage: {
    bg: "huanggong_square", W: 15,
    units: [
      { id:"hanli",    art:"bt_hanli",    pos:2,  name:"韩立",  face:"r" },
      { id:"liujing",  art:"bt_liujing",  pos:3,  name:"刘靖",  face:"r" },
      { id:"songmeng", art:"bt_songmeng", pos:4,  name:"宋蒙",  face:"r" },
      { id:"xuwang",   art:"bt_xuwang",   pos:14, name:"胥王",  face:"l" },
    ],
    script: [
      { move:"liujing",  to:10, ms:1800 },
      { move:"songmeng", to:12, ms:1800 },
      { say:"liujing", text:"韩师弟，我们先去布阵——你且断后，引他入阵！", tone:"急" },
      { say:"hanli", text:"两位师兄快去——胥王交给我！" },
      { move:"xuwang", to:9, ms:1200 },
      { say:"xuwang", text:"哪里走！", tone:"厉" },
      { fx:"burst", at:9, elem:"huo", n:12 },
      { flee:"hanli", from:"xuwang", to:8, ms:2500,
        onCaught:{ combat:"tuoshi_ambush", inheritPos:true } },
      { say:"liujing", text:"阵成了——韩师弟，引他进来！" },
      { combat:"tuoshi", inheritPos:true },
    ]
  }
}
```

---

## 十二、工程落点

### 新增代码量估算

| 文件 | 改动 | 估算 |
|------|------|------|
| `js/cutscene.js` | compile() 识别 stage 段落；新增 stage beat 执行器 | ~120行 |
| `js/ui.js` | stage beat 渲染调度；对话气泡 DOM/CSS；cgOut/combat 切换 | ~150行 |
| `js/engine.js` | `startCombatFromStage()` 继承轴状态 | ~30行 |
| `css/style.css` | 对话气泡样式 | ~60行 |
| `js/story.js` | 改造燕家堡/皇宫节点（插入 stage 段落） | ~200行 |

### 不改动的文件
- `js/combat.js` — 战斗构造函数已支持 hotspots/preps/自定义W，无需改
- `js/exploremap.js` — 舞台不复用 ExploreMap 逻辑（只复用渲染管线）
- `js/art.js` / `js/fx.js` / `js/audio.js` — 原样复用

### 实装顺序

1. **P0：stage beat 编译 + 基础渲染**（cutscene.js + ui.js）
   - compile 识别 `{stage:{...}}` → kind:"stage"
   - ui 遇到 stage beat → 初始化 _stageState → 复用 _renderExmapScene 渲染
   - 执行 script[] 中的 move/say/narr/wait（最基础的4个原语）
   - cgOut → 销毁舞台，回 story overlay

2. **P1：对话气泡 + 自由行走**（ui.js + css）
   - 轴上 say 渲染为气泡
   - freeMove 模式：玩家点击格子行走 + 触发区域判定

3. **P2：追逐/逃跑**（cutscene.js）
   - chase/flee 原语执行器
   - onCatch/onEscape/onCaught 事件处理

4. **P3：无缝入战**（engine.js + cutscene.js）
   - combat drop with inheritPos
   - startCombatFromStage() 继承轴状态

5. **P4：打样——燕家堡篇改造**（story.js）
   - 改造 yanjia_summon/reunion/boss/escape 四节点
   - 插入 stage 段落，保留现有立绘 CG

6. **P5：皇宫决战改造**（story.js）
   - 布阵断后 stage + tuoshi/xuwang_final 无缝入战

### 测试

- `node test/cutscene.test.js`：新增 stage beat 编译测试
- `node test/journey.test.js`：燕家堡改造后 E2E 必须全绿
- 手动验收：iPhone 14 Pro Max 视口，舞台→CG→战斗切换流畅

---

## 十三、与现有设计文档的关系

| 文档 | 关系 |
|------|------|
| `cutscene-design.md` | Stage beat 是 cutscene DSL 的新原语，扩展而非替代 |
| `explore-redesign.md` | Stage Scene 复用 L3 轴渲染管线，但不走 ExploreMap 逻辑 |
| `pacing-design.md` | 舞台段落用于硬锚高潮幕的空间叙事，不改变锚-帆节奏 |
| `multiply-design.md` | 舞台=既有系统相乘（L3轴×cutscene×Combat），不新建系统 |
| `chapter-systems-manifest.md` | 舞台段落是剧情演出升级，不影响系统推进清单 |

---

## 十四、验收标准

1. **燕家堡**：调令后韩立在堡内走动（freeMove）→ 偶遇墨彩环（轴上对话）→ 切立绘CG重逢 → 战王蝉追来（chase）→ 坠入战斗（inheritPos）→ 逃跑（flee）→ 切立绘CG逃出。全程舞台↔CG↔战斗无缝切换
2. **皇宫决战**：师兄弟跑位布阵（move+place）→ 韩立断后引胥王（flee+chase）→ 退到阵法范围坠入拖时战（inheritPos，阵旗已在轴上）→ 阵成决战无缝衔接
3. **旧剧情卡零回归**：不含 stage 段落的旧 text:[] 照常运行，journey E2E 全绿
4. **单屏竖屏**：舞台在 430×932 视口一屏放下，对话气泡不超出
5. **随时可跳**：点击快进到 stage 段尾（或最近的 cgOut/combat）
