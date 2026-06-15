# 法宝设计模板（每件法宝照此四要素 + 落地五件套填）

> 2026-06-15 用户钦定：以后设计一件法宝/法器，先按本模板把 **来历考据 / 形制 / 特效怎么做 / 特点**
> 四要素填清楚，再开工。落地一律**复用既有系统**（乘法三律：先问旧系统相乘可得否、零教学红线、不立新引擎）。
> 范例见文末：青竹蜂云剑（特点＝可引辟邪神雷）、乌龙夺（特点＝四爪带毒）。

---

## 一、四要素（设计稿必填）

### ① 来历考据（哪里来）
按 AGENTS.md 考据红线办，**先查档再搜索后设计**：
- **动漫为唯一剧情锚点**：先在 `docs/` grep 既有考据（如 `combat-arsenal-design §1.1 时间线`），看这件东西在动漫哪一篇、怎么得。
- **≥2 独立来源交叉**：动漫细节拿不准时，再找 ≥2 个独立来源互证。
- **拿不准不臆造**：写死前标 `※待核实` 并问用户。**用户的 lore 裁决＝最高权威**（如乌龙夺＝墨蛟角/带毒/四爪/血色禁地可造，即用户 2026-06-15 直接裁定）。
- 产出：一行「时间线归属」+ 一句「获取方式」。例：*黄枫谷篇·血色禁地斩墨蛟得材 → 元武国巧匠齐云霄代炼。*

### ② 形制（什么样）
- **品类**：飞剑 / 短兵 / 幡旗 / 珠环 / 舟船……决定装备**槽位**（见三·A）。
- **材质·配色**：定特效主色谱（如墨蛟→墨绿、青竹→青碧、神雷→缠金）。
- **气质**：群剑御空？四爪连抓？绕身剑阵？一句话能想象出画面。
- **驱使门槛**：练气几层 / 筑基可御——落到 `minLayer`（经 `State.gateLayer()` 判定）。

### ③ 特效怎么做（怎么演）
落到 `js/fx.js` 的 `RECIPES`，见 **四、特效落地** 的写法与可用积木。一句话先描述「施放→命中→余韵」三拍画面，再翻译成 trail/burst/shard/mote/ring/flash 的组合。

### ④ 特点（signature·它的「脸」）
**一件法宝必须有一个一句话说得清的招牌特点**，区别于普通武器：
- 青竹蜂云剑 → **可引辟邪神雷附剑**（剑雷同源、72 剑 72 雷的取舍）。
- 乌龙夺 → **四爪带毒**（命中挂毒、持续掉血，缠斗愈久愈致命）。
- 特点优先用**既有机制**兑现（buff/charge/poison/fixedSegs/swordOrbit…），实在没有再议新机制——但那要单独走设计评审。

---

## 二、落地五件套（代码归位，全部复用现成系统）

一件法宝从「设计稿」到「能在战斗里用」，固定落在这五处。**id 全程一致**（物品 id＝法器 id＝战斗技按需另起）。

| # | 落点 | 文件 | 作用 |
|---|------|------|------|
| A | `DATA.items[id]` + `DATA.gear[id]` | `js/data.js` | 物品实体（rarity/desc）+ 装备定义（slot/minLayer/bonus/traits/grantSpells） |
| B | `SPELLS[spellId]` | `js/combat.js` | 法宝授予的战斗技（atk/buff/debuff…，多段/带毒/充能皆有现成字段） |
| C | `RECIPES[spellId]` | `js/fx.js` | 施放特效（缺省走 elem/type 通用弹道，可不写） |
| D | `WORLD.bigitems[]` 一条 | `js/world.js` | 大件图鉴条目（unheard→track→got；前路件标 `far:true`） |
| E | STORY 节点 | `js/story.js` | 获取/炼制演出（消材料→给法宝→置 flag→入年表） |

### A · 装备定义（`DATA.gear`）
```js
DATA.gear[id] = {
  slot: "weapon",            // weapon 主攻 / armor 护身 / accessory 饰物 / side 伴身
  minLayer: 11,              // 驱使门槛——经 State.gateLayer() 判定（筑基后视作远超练气全层）
  bonus: { sense: 1 },       // 被动属性加成
  traits: [{ id: "venom_claw", desc: "……四爪连抓、命中令敌中毒持续掉血——攻击带毒" }],
  grantSpells: ["wulong_zhua"], // 装备即把战斗技注入战斗手牌（卸下即收回）
};
```
装备走 `Engine.equipGear(id)`：校验拥有 + `minLayer` 门槛后入槽、加属性、注入 `grantSpells`。**不写新装配逻辑。**

### B · 战斗技（`SPELLS`，`source:"treasure"`）
常用字段（按需取，全部已实现）：
- `type`：`atk`/`heal`/`debuff`/`buff`/`soul`/`zone`/`def`。
- `fixedSegs: N`：固定 N 段连击（每段独立结算克制/破甲）——「四爪」「双剑」即用它。
- `poison: { dmg, turns }`：命中挂毒，`_tickStatus` 逐回合掉血（死物 `corpse` 百毒不侵、元神 `ghost/soulOnly` 无形免疫——已通用兜底）。
- `cd: N`：冷却；`pierce: true`：破甲；`elem`：`jin/mu/shui/huo/tu`（克制系统自动算）。
- `chargeCost: { id, n }`：特色资源消耗（如辟邪神雷 72 道池）；`aoe`/`aoeSpan`：横扫。
- `swordOrbit: true`：持续绕身剑阵（UI 渲染 `au-swords`）。

### D · 大件图鉴（`WORLD.bigitems`）
```js
{ id: "wulongduo", cat: "fabao", name: "乌龙夺", blurb: "…", guide: "…",
  stat: (s) => State.count("wulong_duo") > 0 ? { state: "got" }
              : s.flags.mojiao_slain      ? { state: "track" }
              :                             { state: "unheard" } }
```
同一来源的「后续篇章才炼得成」的姊妹件，拆成独立条目并标 `far: true`（前路剪影，不进当前可炼清单）。例：神风舟 `shenfengzhou`（与乌龙夺同出墨蛟一身）。

### E · 获取/炼制节点（`js/story.js`）
**红线：`skipIf` 必须是 `cond` 的逻辑反（`skipIf ≡ !cond`），否则会卡住 `checkStory` 的顺序遍历。**
```js
{ id: "wulong_forge", title: "蛟角成器 · 乌龙夺",
  skipIf: (s) => s.flags.wulong_forged || !s.flags.mojiao_slain || State.count("mojiao_jiao") < 1,
  cond:   (s) => s.flags.mojiao_slain && !s.flags.wulong_forged && State.count("mojiao_jiao") >= 1,
  onArrive: (s) => {                      // 注意：onArrive 在「触发即结算」(playStage)，不在选项时
    State.take("mojiao_jiao", 1); State.give("wulong_duo", 1); State.setFlag("wulong_forged");
    Engine.writeLedger("wulong_forge", "……"); Engine.addMilestone("妖材成器：乌龙夺（四爪毒法宝）", "bigitem");
  },
  body: [ /* scene/say/cg/aside */ ],
  choices: [{ text: "收下乌龙夺", resolve: "advance" }] }
```

---

## 三、装备槽位速查（`slot`）
- `weapon` 主攻位 · `armor` 护身位 · `accessory` 饰物位 · `side` 伴身位（数组，可多件）。
- 悬浮/神识档另有 `floatSlots`（上限随境界）——本模板法宝默认走前四类。

---

## 四、特效落地（`js/fx.js` · `RECIPES`）

**分发**：战斗施放调用 `Fx.castSpell(spellId, fromAnchor, toAnchor, sp)` → 优先取 `RECIPES[spellId]` 精确配方；
没有就按 `sp.elem`/`sp.type` 走通用弹道（**所以不写配方也有缺省特效，写了才是「专属脸」**）。

**一个配方就是一个函数** `spellId(F, from, to) { …; F._run(); }`：
- 施放拍：`F.trail(from, to, { core, elem, size, flyMs, gap, fade, curve|wave })` 画飞行轨迹；多段/多爪用 `setTimeout(..., i*60)` 错落。
- 命中拍：`F.burst(to.x, to.y, elem, n, { power })` 迸溅、`F.shard(x, y, {vx,vy,c,size,life})` 碎芒、`F.ring(x,y,{c,vr,life,lw})` 冲击环、`F.flash(color, ms, alpha)` 屏闪。
- 余韵拍：`F.mote(x, y, {vy,life,size,c,delay})` 漂浮粒子（毒雾/灵气）。
- 身后层用 `F._emit("back", () => { … F._run(); })`（绕身而非贴脸，如绕身剑阵/吐纳）。
- 性能：所有循环乘 `F._degraded`（掉帧自动减粒）；随机用模块内 `rnd(a, b)`。
- 配色随②的材质主色谱（`core` 给主色，`elem` 决定积木默认色）。

> **fx.js 无测试覆盖**（纯 canvas、浏览器层）——特效只能浏览器目验，不要在测试里断言它。

---

## 五、验收清单（每件法宝交付前过一遍）
- [ ] 四要素填全：来历（含 ≥2 源/动漫锚或用户裁定）、形制、特效、特点。
- [ ] 五件套归位且 id 一致；存档 schema 若新增字段则同步 `state.js _migrate()`（只加 flag/item 不必动）。
- [ ] `node --check js/*.js`；新增/扩展测试覆盖：物品/装备/战斗技/特点机制/大件链/获取节点（节点须验 `skipIf ≡ !cond` 非阻塞）。
- [ ] 全测绿（`test/` 全套）。
- [ ] UI/特效（法宝阁/装备/施放特效）浏览器目验（无测试覆盖处）。

---

## 六、范例

### 范例 A：青竹蜂云剑 —— 特点＝可引辟邪神雷（已实装战斗技，正典获取尚远）
- **① 来历**：本命法宝，正典＝**星海飞驰篇**炼成（结丹）；黄枫谷篇金色书页已藏「青竹蜂云剑炼制法」伏笔。演武先行验证编排。
- **② 形制**：群剑御空、剑随神念分袭的本命飞剑；青碧主色；`swordOrbit:true`＝持续绕身剑阵（UI 渲染 `au-swords`）。
- **③ 特效**：剑随神念分袭、两段连斩；引神雷时缠金雷（缠金配色）。
- **④ 特点（招牌）**：**可引辟邪神雷附剑**——`SPELLS.qingzhu_jian`（`fixedSegs:2` 两段连斩、`elem:"mu"`）配套 `shenlei_fujian`（神雷附剑 buff，`leiEnchant:3`）/ `shenlei_pi`（自身畔左右十格横扫、`chargeCost:{shenlei,1}`、专克邪魔鬼物 ×1.8）。**72 剑 72 雷＝独立资源，取舍即战术**——这是它区别于普通飞剑的「脸」。
- *状态：战斗技已可用（演武先行）；正典「炼成」演出绑星海飞驰篇＝还很久。*

### 范例 B：乌龙夺 —— 特点＝四爪带毒（本周期已实装·首件妖材→法宝链）
- **① 来历**：黄枫谷篇·**血色禁地斩墨蛟**得「墨蛟之角」→ 元武国巧匠**齐云霄**代炼（用户 2026-06-15 裁定）。
- **② 形制**：墨蛟双角炼成的**四爪短法宝**；墨绿主色；练气十一层方可驭（`minLayer:11`）。
- **③ 特效**：`RECIPES.wulong_zhua`——四道墨绿蛟爪扇形错落连抓（`setTimeout(i*60)` 错峰 `F.trail` core `#86e6a0`）→ 命中 `F.burst("shui")`＋墨绿碎芒 `F.shard`＋青紫毒雾 `F.mote`（与喂毒同色谱），把「四爪带毒」演在脸上。
- **④ 特点（招牌）**：**四爪带毒**——`SPELLS.wulong_zhua`（`type:"atk"`、`fixedSegs:4` 四爪连抓、`poison:{dmg:8,turns:3}` 命中挂毒、`elem:"shui"`、`cd:1`）。配套抽出的通用 `_applyPoison` rider 让攻击技也能挂毒；死物百毒不侵、元神无形免疫。
- **⑤ 落地五件套**：`DATA.items/gear.wulong_duo`（A）/ `SPELLS.wulong_zhua`（B）/ `RECIPES.wulong_zhua`（C）/ 图鉴 `wulongduo` 非 far、姊妹件 `shenfengzhou` far（D）/ 节点 `wulong_forge`（E）。

---

## 七、复制即填·骨架
```
法宝名：____
① 来历考据：动漫篇章＝____；获取＝____；来源/裁定＝____（拿不准标 ※待核实）
② 形制：品类＝____；槽位＝____；材质·主色＝____；门槛＝练气__层/筑基；气质一句＝____
③ 特效：施放＝____ → 命中＝____ → 余韵＝____（落 RECIPES.____）
④ 特点（招牌一句）：____（兑现机制＝fixedSegs/poison/charge/buff/swordOrbit…）
落地五件套：A items/gear ____ ｜ B SPELLS ____ ｜ C RECIPES ____ ｜ D bigitem ____（far?）｜ E story ____
```
