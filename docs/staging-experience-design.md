# 演出与体验升级 · 完整工作方案（v177 实代码对齐）

> 本稿替代此前那份"过时设计稿"。过时稿的根本错误：基于我本地一份 **v102 残缺副本**（缺 `cutscene.js`），
> 误判"没有演出导演"。**真实库已是 v177，`js/cutscene.js` 是成熟的演出推进器。**
> 所以本轮的定位不是"从零造演出系统"，而是**在现成 cutscene.js / fx.js / audio.js 之上"加料"**。
> 配套既有设计档（本稿与之衔接、不重复）：`docs/cutscene-design.md`、`docs/audio-design.md`、
> `docs/fx-design.md`、`docs/art-direction.md`。
>
> **决策已拍板（§7）。§9 的 9 条体验建议已全部采纳并并入 §6 Roadmap。** 本稿入库为 `docs/staging-experience-design.md`，作为后续逐项实装的总纲；实装前不动其它代码。

---

## 0. 一句话目标

让每个名场面（投信/夺丹/重逢/突破异象/观战/伏击/据点抵达）从"静图+文字"升级为
**镜头 + 立绘 + 分层视差 + 氛围粒子 + 环境声 + 交互**的可控动态演出，且——
**动态只在背景层，玩家亲手出手那一下永远在最上层、不可被夺走。**

---

## 1. 现状盘点（已有，别重建）

| 子系统 | 现状（v177 实代码） | 缺口（本轮要补） |
|--------|--------------------|------------------|
| **演出推进器** `js/cutscene.js` | 原语 `cam/actor/fx/sfx/bgm/wait/beat/guide`；`compile()` 纯函数（可无头测）；`run/runBeat/runGuide`；`_cam` 对 `#story-bg` 施 `translate+scale`；`beat:{kind:"window\|choice"}`（伺机出手/抉择）**已落地** | 分层视差、环境声触发、hit-stop、视频 |
| **演出舞台 DOM**（`ui.js _storyCtx`） | `bg=#story-bg`、左右立绘位、`fxHost=#story-overlay`、`beatHost=#story-choices`、`anchor()` | `#story-bg` 仍是**单层**背景 → 视差要拆层 |
| **特效引擎** `js/fx.js` | `flash/shake/burst/lightning/material/swordRing/ribbon/trail` + `ensure(host)`；`_budget`/`_degraded` 性能护栏；**常驻氛围粒 `ambient(ash/dust/spirit/beam)`（P1·B2）+ `hitStop(ms)` 顿帧（P1·B3）+ `haptic(pattern)` 手机触觉反馈（P1·§9-3）已落地** | — |
| **音频** `js/audio.js` | 合成 SFX 全套 + 合成 BGM(`daily/combat/tense`) + 9 条文件轨；**古钟 `bell` 已有**；**六环境床文件优先（P0·C1）+ 换轨 600ms 交叉淡化 + ducking（P1·C2）已落地** | — |
| **设计档** | cutscene/audio/fx/art 四份已成体系 | 本稿做"升级增补"，不另立门户 |

---

## 2. 设计纪律 / 红线（先立规矩，后谈功能）

1. **原语 ≤ ~8 种**（cutscene-design §二 铁律："多了就是另一个系统"）→ 新能力**优先"升级已有原语 / 复用底座"，慎开新原语**。
2. **复用底座、绝不另起炉灶**；**向后兼容**：`node test/cutscene.test.js` + `node test/journey.test.js` 必须保持全绿，旧剧情卡零回归。
3. **单次动效 ≤400ms**；**墨纸黑 + 烛光金**；**少即是贵**（每个新能力都要有清晰 ROI）。
4. **IP 锚点**：动漫版唯一正典。视差/视频**只微动**（镜头推近、发丝衣袂飘动），**不做大幅人物动作、不糊脸**。
5. **单屏铁律**（手机竖屏一屏放下，演出永不要求竖滚）；**随时可跳**（复访零负担）。
6. **GitHub Pages 静态托管 + iPhone 14PM 性能红线**：不增大包体（视频只点关键帧、懒加载）；粒子守 `_budget`/`_degraded`。
7. **生图/生乐 key 不入库**（audio-design §六）：临时使用、脱敏、不写进任何文件。

---

## 3. 演出效果升级（视觉）

### B1 · 分层视差（2.5D）—— 最高性价比，P0
- **做法**：把背景从单层升级为 2–3 层（天/远景雾/前景人物），`cam:pan/zoom` 时**各层按 `depth` 系数分速位移**——
  背景半速退、中景全速、前景掠过 → 立刻有纵深。**复用箱庭 L3 已成熟的三层视差做法**（cutscene-design §三），纯 CSS transform、零额外依赖、零新性能成本。
- **接口（拟）**：`{scene:"…", layers:[{src, depth:0..1}], transition}`；`cutscene.js _cam` 由"对单个 `#story-bg` 施 transform"改为"遍历各层、按 depth 缩放位移幅度"。
- **向后兼容**：不写 `layers` 就是现在的单层背景，零回归。
- **资产**：现有 CG 切 2–3 层（见 §7 决策6 的资产来源）。

### B2 · 氛围粒子（叠在静图上）—— P1
- **做法**：`fx.js` 增"常驻/idle 氛围"发射器（灰烬/尘/灵气微光飘动、光束缓扫暗场），**复用现有粒子池 + `_budget`/`_degraded`**。
- **接口（拟）**：复用现有 `fx` 原语：`{fx:"ambient", preset:"ash|dust|spirit|beam", ...}`（**不新开原语**）。
- **预算**：常驻粒子桌面 ≤80 / 手机 ≤30，帧难看时 `_degraded` 自动减半。
- **实现 ✅（P1）**：`Fx.ambient(preset[,opts])` 起、`Fx.ambient(null|"off")` 收（beam 立撤、motes 缩余命自然散）；走身后层(z:1，在人物之后)，全部极淡慢飘。预算闸 `_ambCap`（手机 30/桌面 80）× `_degraded` 节流，按 `interval` 出粒（beam 单实体缓扫、屏缘淡入淡出）。原语 `{fx:"ambient", preset, interval?, cap?, color?, alpha?, speed?}` 已接 `cutscene._fx`；演出落幕（`UI.storyChoose`）即 `Fx.ambient(null)` 收束、`Fx.clear()` 兜底。

### B3 · hit-stop + 顿帧 —— P1
- **做法**：`Fx.hitStop(ms)` 全帧冻结 **60–90ms**，绑在**玩家决定性一击**（`beat:window` 的 `onHit` / 突破最后一下 / 破空金雷）。冻结 + 微震 = 打击感翻倍。
- **红线**：只在"玩家亲手那一下"，不滥用；总时长压在 ≤90ms。
- **实现 ✅（P1）**：`Fx.hitStop(ms=80)`——粒子主循环该窗口内强制 `dt=0`（粒子不推进/不老化＝定格），同时给 fx 宿主打 `.fx-hitstop`：宿主＋全部子层（背景/远景/立绘呼吸/震屏）`animation-play-state:paused`，整幕"咔"地凝住；过渡(transition)不动，避免在途镜头被强行收尾跳变。硬封顶 120ms、`prefers-reduced-motion` 直接跳过、`Fx.clear()` 兜底解冻。接法：演出原语 `{fx:"hitStop", ms}`，或 `beat.onHit:{hitStop:true|ms}` 便捷位（**常先 `{fx:"shake"}` 再 hitStop**＝抖到一半被冻）。

### B4 · 图生视频 `{video}`（只点 3–5 王炸）—— P2，视情况
- **节点**：升仙大会现身 / 万小山之死 / 破空金雷 / 突破金光 + 你心里第 5 个。
- **做法**：现有 HQ CG 当首帧出 2–4s 静默循环；**webm + webp 首帧兜底**；**ref 锁脸**防糊；**只微动**；铺在**交互层下层**（绝不用烘焙视频替掉玩家操作那一下）。
- **注意**：`docs/promo-video-handoff.md` 是**宣传片**（竖版母带），与"游戏内演出视频"是两件事，本轮不混。

---

## 4. 声音与代入感（你的重点）

### C1 · 环境床 Ambient（夜虫/萤火/烛火/风/市集）—— P0
- **诉求（你的原话方向）**：演出时做出"夜晚的感觉"，**不一直放 BGM**；**韩立入门那段=安静的夜，不是音乐**，才更有代入感。
- **做法**：在 `audio.js` 加一条**与 BGM 独立的环境母线**，**程序化合成**（复用现有 Web Audio `tone/noise` 底座：夜虫=带通噪脉冲、烛火=低频噼啪、风=低通噪缓动）——**零资源、零成本、即可做**；音量极低（art-direction"音是气口不是轰炸"）。
- **接口（拟）**：`Sfx.ambient(id)` / `Sfx.ambient(null)` 停；尊重静音开关。cutscene 里如何触发见 §7 决策2。

### C2 · BGM crossfade + 烈度叠层 + ducking —— P1
- 换轨 **600ms 交叉淡化**（现在是硬切，战斗↔日常尤其突兀；audio-design §2.4）。
- 战斗按烈度叠层（铺垫→对峙→决战）。
- **ducking**：古钟/天雷等关键 SFX 触发时，音乐瞬时 −6dB 让路，听感更清。
- **实现 ✅（P1）**：`audio.js` 新增 `fadeVol(el,to,ms)`（Audio 元素无 GainNode，用 40ms tick 缓变 volume）。`Sfx.bgm(track)` 换轨改为**交叉淡化**——旧文件轨 600ms 淡出后 `pause()`、新轨同时从 0 淡入到目标（床领奏中则续压到 ×0.16）；同轨幂等不重建。环境床/演出领奏 `duckBgm()/unduckBgm()` 改用 `fadeVol` 平滑（文件轨 240ms 落 / 320ms 回，合成轨 `setTargetAtTime`）。关键 SFX（`bell` 古钟 / `thunder` 天雷，`DUCK_SFX` 表）经 `keySfxDuck()` 触发**瞬时 −6dB 让路**（~80ms 落、~520ms 缓回；已被床压低时不叠）。头测 `test/audio.test.js` 覆盖换轨淡入/交叉淡出/关键 SFX 让路/起收床 duck/同轨幂等。

### C3 · 轨道→场景映射校验 —— P1
- 核对 `ui.js/main.js` 的切轨点（audio-design §三表），保证"该静的时候别打鼓"、进城切 town、决战切 boss、离别切 sorrow。
- **实现 ✅（P1）**：核对全部切轨点已对齐 §三表——`_bgmForLocation`（town/嘉元城→town、太南集市→fair、密室→tense、旅途→journey、余 daily）；战斗起手按烈度切 boss/tense/combat（`bossFight`=决战/越级/妖王），战罢 `_bgmForLocation` 归位地点轨；舆图 peaceful→town/险境→tense；破关→triumph（单次）；剧情节点 `stage.bgm` 显式切（sorrow/tense…），落幕经 `renderAll→renderLocation` 自动归位。**健壮性**：`Sfx.bgm()` 增**白名单校验**——未知轨名（typo/空串）一律告警忽略、**不扰动当前播放**（不再"切没了"），新增 `Sfx.isTrack/tracks/curBgm` 自省位。`test/audio.test.js` §6 验校验、`test/trackmap.test.js` 逐场景核对映射且产出轨名均在白名单内。

---

## 5. 游戏体验（更广，承接已有设计档）

- **D1 交互演出扩展**（cutscene-design §四）：在已有 `beat:{window\|choice}` 上扩 `hold-breath`（屏息/隐蔽）、`spectate`（观战）、`choice-QTE`——把操作嵌进高潮，"演出即操作"。
- **D2 据点抵达演出 + 据点节点图**（cutscene-design §五）：嘉元城打样，治你说的"据点没区别"。**代入感收益最大，但工作量也最大**（含 exploremap 据点化），建议独立排期。
- **D3 演出即引导 `guide`**：已落地，多用——落幕时顺势告诉玩家"下一步去干嘛"，降迷路。

---

## 6. 优先级 Roadmap（已并入全部建议 · 2026-06-18 拍板）

| 阶段 | 内容 | 理由 |
|------|------|------|
| **P0** | **C1 环境床（地点级 + 真实音源走 key，程序合成兜底）** + **§9-1 昼夜/天气骨架** + **B1 分层视差（升级 `{scene}`+复用 `{cam}`）** | 改动小、贴美学、不踩 IP/性能坑；"先 1+4" + 让整张地图都活起来 |
| **P1** | **§9-2 立绘微动** + **§9-3 手机触觉反馈** + B2 氛围粒子 + B3 hit-stop + C2 crossfade/ducking + C3 切轨校验 | 在 P0 地基上叠"质感"与名场面临门一脚 |
| **P1.5** | **§9-4 敌意预告+伺机出手** + **§9-5 危局氛围** + **§9-6 名场面回廊** | 深化战斗与情感 |
| **P2 ✅** | **§9-7 空间音声相 pan** + **§9-8 运镜分镜预设库** + **§9-9 体验设置项** | 锦上添花、收尾（三项均已实装，见 §9 第三梯队各条「实现 ✅（P2）」） |
| **演出补完** | **给现有剧情节点逐个补演出**（P0–P2 引擎已就绪，往 `text[]` 插原语即可，不动引擎） | 见 `docs/staging-scene-plan.md`：审计 107 节点（34 已演出/73 纯文本），逐节点演出方案 + 优先级。最老三篇（七玄门/黄枫谷/魔道争锋）几乎全裸，含反杀墨大夫·筑基·战王蝉·皇宫决战等名场面 |
| **持续** | D2 据点演出（P0/P1 全部扎实后，一个个做） | 大块、要美术/资产 |
| **暂缓** | B4 图生视频 | 你定：视频不急，先把优化做好 |

**每阶段闭环**：`cutscene.test.js`/`journey.test.js` 全绿 → `node scripts/bump.js <ver>` → 开 PR（仓库属 `chentong227`，内建 git 无写权限，**走 PAT + GitHub API**）→ 合并 → GitHub Pages 自动部署 → 手机 `?cb=` 绕缓存验收（iPhone 14PM 视口）。**每步入库**，进度不丢。

---

## 7. 已锁定决策（2026-06-18）

> **总准则：尽量高级的效果**（在 §2 红线内把质感拉满）。

1. **B1 接口形态**：✅ **升级现有 `{scene}` + 复用 `{cam}`**（守 ≤8 原语纪律，不新开 `{layer}`）。
2. **C1 触发形态**：✅ **独立 `{amb}` op**（像 `sfx/bgm` 的兄弟），外加地点配置（见决策3）。
3. **C1 生命周期**：✅ **延续到地点屏 —— 做"地点级环境声"**（更大更活）。→ 自然延伸为**昼夜/天气**联动（见 §9-1）。
4. **C1 音源**：✅ **走 key 出真实环境音文件**（Lyria/`genmusic`），**程序合成作兜底**（文件缺失/加载失败不静默）。
5. **视频**：✅ **暂缓**——先把优化做扎实，名场面 CG 定稿后再议。
6. **据点演出**：✅ **等 P0/P1 全部扎实后，一个个做**（"多的是演出要做"）。

> **资产来源**（待 P0 动工前细化）：分层视差先用现有 CG 切 2–3 层；后续可扩 `genart.js` 直接"分层出图"。环境音走 `genmusic`/Lyria 出 loop 文件。

---

## 8. 验收 & 不破坏的契约

- `node test/cutscene.test.js` + `node test/journey.test.js` 全绿；旧剧情卡（字符串/`scene`/`aside`/`say`）零回归。
- 低端/降级 **fail-soft**：无特效/无声也能把剧情读完。
- **单屏竖屏**放得下、**随时可跳**、复访零负担。
- iPhone 14PM（430×932, DPR3）视口验收；部署后 `?cb=` 绕缓存复验。
- key 不入库、不写文件。

---

## 9. 体验建议明细（2026-06-18 全部采纳，已并入 §6 Roadmap）

### 第一梯队（与你已满意的"动态演出+真实音效"强协同，强烈推荐）
1. **昼夜 · 天气系统**（和"地点级环境声"天生一对）：地点带 `时辰`（晨/昼/暮/夜）+ `天气`（晴/雨/雪/雾），一次投入驱动三件事——①场景染色 tint（墨黑烛金内的冷暖偏移）②环境床切换（昼:鸟鸣市声 / 夜:虫鸣萤火 / 雨:檐滴）③可选氛围粒子（雨丝/落叶/飞雪）。**让整张地图"活"，不止演出。**
2. **动态立绘微动**（idle 呼吸/眨眼/发丝衣袂）：纯 CSS、≤400ms 循环微幅，让立绘"活着"；配合视差，名场面质感拉满。**守 IP 红线：不碰大幅人物动作。**
3. **手机触觉反馈** `navigator.vibrate`：突破/暴击/重击/古钟 轻震，零资源、手机代入感暴涨；配合 hit-stop = 真物理打击感。
   - **实现 ✅（P1·§9-3）**：`Fx.haptic(pattern)`——预设 `tap/hit/heavy/breakthrough/bell`（或自定义 `ms`/`[ms,…]`）。三道守卫：能力缺失（桌面/不支持 `vibrate`）、`Fx.setHaptics(false)` 关闭（`localStorage:fx_haptics` 持久，留给 §9-9 体验设置翻）、`prefers-reduced-motion`（兼无障碍）——任一命中即静默跳过。接线：`Fx.hitStop()` 决定性一击同步一记 `heavy`（顿帧＋物理反馈合拍）；`Sfx.play()` 关键音效 `bell` 古钟→`bell` 震、`thunder` 天雷→`heavy` 震（`HAPTIC_SFX` 表）；演出原语 `{fx:"haptic", pattern}` 供名场面点触。头测 `test/haptic.test.js` 覆盖预设/守卫/开关持久化/hit-stop 与古钟接线。

### 第二梯队（深化战斗与情感）
4. **敌人意图预告（telegraph）+ 伺机出手**：回合制战棋深度——预告敌人下一手（蓄力/破绽），玩家"看破→屏息→反制"。把 `beat:{window}` 从演出延伸进战斗核心。
5. **危局氛围（低血/濒死）**：屏幕边缘暗红脉动 + 心跳低鼓 + 音乐 duck，绝境感。
   - **实现 ✅（P1.5·§9-5）**：`renderCombat` 按玩家气血分档——≤28% 危局(`.peril`)、≤12% 濒死(`.brink`)，战毕/转危为安即收（`closeCombat` 也强制清）。**视觉**：`#combat-overlay.peril::after` 纯屏幕边框血晕（inset box-shadow 集中四缘 + 极淡 radial 收口、`pointer-events:none` 不挡操作），`@keyframes peril-pulse` 呼吸脉动（濒死 0.85s 更急更浓）；`prefers-reduced-motion` 去脉动留静态血框。**音**：`Sfx.peril(level)` 心跳低鼓——极低频双跳(lub-dub) `tone(60→36Hz)+`(50→32Hz)`，危局 ~1s/濒死 ~0.64s 一记；**刻意不动全局 duck**（那是环境床/演出领奏的 `bgmDucked`，复用会互踩），心跳作加法层叠在 BGM 之上＝"音是气口不是轰炸"；同档幂等、静音空转不发声。头测 `test/audio.test.js §7` 覆盖起/收/幂等/分档/静音空转。
6. **名场面回廊（演出回放）**：叙事日志里可重温关键演出（已有 `_archiveStory` 底子），情感回报 + QoL。
   - **实现 ✅（P1.5·§9-6）**：**收录**——`_archiveStory` 落日志的同时，凡 `Cutscene.hasStaging(stage)===true`（含 cam/actor/fx/sfx/bgm/amb/wait 或交互 beat）且有稳定 `id` 的节点，经纯函数 `Cutscene.recordScene(list, stage, {t})` 登记进 `State.data.scenes`（按 id 去重、最近置末、限容 60、不就地改入参）；纯文字对白不算名场面、不收录。**入口**——风云录(`openChronicle`) 新增「名场面回廊」一栏，每条可点 `UI.replayScene(id)`。**回放**——复用整套演出调度：`renderStory(stage, {replay:true})` 走 `_story.replay` 路径，镜头/立绘/特效/声/环境床/台词原样重演；唯①交互 beat 是玩法非演出→回放里自动演"命中那一手"的 fx/镜头/反应台词（`Cutscene._react(onHit)`，零输入续演）②落幕指路 guide 是导航→回放里跳过（不脉冲地点按钮）。重温**绝不动剧情指针/不结算/不写存档**：落幕只给「再看一次/合上回廊」，`closeReplay` 拆演出层、收床、复位镜头、回落地点轨。头测 `test/replay.test.js` 覆盖名场面判定/条目结构/去重置末/限容/纯净。

### 第三梯队（锦上添花）
7. **空间音 / 声相 pan**：左/右立绘说话时音相偏移，配真实音效 = 临场感。
   - **实现 ✅（P2·§9-7）**：`audio.js` 合成原语 `tone/noise` 的最终落点改经 `panOut(c,g)`——`play(name,{pan})` 把 `pan∈[-1,1]`（左负右正）临时置入模块级 `_sfxPan`，配方同步建节点时一并读到，经 `StereoPanner` 偏声相后落 `destination`；`pan=0` 或环境不支持 `createStereoPanner` 时直连（零回归）。接线：`ui.js _renderTextBeat` 按双人相对立绘定位说话人——韩立(右) `+0.45` / 对话 NPC(左) `−0.45` / 旁白·心声·场景=居中，写入 `this._sayPan`，打字机逐字轻嗒 `Sfx.play("type",{pan})` 即从说话人那一侧发声＝"谁在说话，声音偏向谁"。头测 `test/audio.test.js §8` 覆盖建 panner/钳制/无 pan 直连。
8. **运镜分镜预设库**：推/拉/摇/跟 等电影化镜头预设，作者拖一个就用——名场面产能 + 一致性。
   - **实现 ✅（P2·§9-8）**：`cutscene.js` 新增 `SHOTS` 预设库（13 条：`pushIn/pullOut/panLeft/panRight/tiltUp/tiltDown/trackLeft/trackRight/establish/shock/focusLeft/focusRight/reset`），每条＝一串 `cam` 原语；作者在 `text:[]` 写 `{shot:"pushIn"}` 即在 `compile()` 展开为对应 cam 拍，**复用既有 `_cam` 差速视差（B1 双平面）与 `_dur` 速度缩放**，不另起镜头系统。可带 `ms/scale/to/px/at` 覆盖，且**仅覆盖该预设本就含有的键**（不给 pan 拍塞 scale，避免污染语义）；未知预设名安全跳过。头测 `test/cutscene.test.js §8` 覆盖单/多拍展开、覆盖语义、未知名跳过、全表齐备。
9. **体验设置项**：演出速度 / 动效强度 / 震动开关（兼无障碍）。
   - **实现 ✅（P2·§9-9）**：新增 `js/settings.js`（`Settings` 模块，localStorage 持久 + 全程 typeof 守卫可无头测）：①**演出速度** `set_story_speed`（慢×1.5 / 正常×1 / 快×0.6 / 极快×0.35）——`speedScale()` 缩放打字逐字间隔(`ui.js` 26ms 基准)、题字卡停留(1500ms)、`cutscene._dur()`(镜头 ms / wait / cam 自走计时)；②**动效强度** `set_motion`（满 / 简 / 关）——`reduceMotion()`(关 或 系统 `prefers-reduced-motion`)拦 `Fx.shake/hitStop/ambient`，`liteMotion()`(简)砍顿帧，`applyMotionClass()` 给 `body` 挂 `motion-off/lite` 让 CSS 静态化 idle 动画（与既有 `@media reduced-motion` 并列）；③**震动反馈**——委托 `Fx.setHaptics`（单一真相源 `fx_haptics`，不双写）+ `navigator.vibrate` 能力探测。入口：系统菜单(`openSystemMenu`)新增「体验设置」→ `UI.openExpSettings()` 分档面板（当前档高亮、即点即存即生效）；开机 `Main.init` 调 `applyMotionClass` 复原。头测 `test/settings.test.js` 覆盖默认/钳制/落盘/速度系数/动效并联无障碍/震动委托。

### 红线提醒（"尽量高级"也不越界）
- 不做全身大幅人物动画、不糊脸（动漫版唯一正典）。
- 不上语音配音（包体/质量/一致性不划算；文字+音效+节奏已是此类游戏最优解）。
- 一切守：单屏竖屏、≤400ms、随时可跳、手机性能。

---

## 10. v180 实机反馈（P0-1.5 上线后，待修订）

> 来源：作者 iPhone 14 Pro Max 实机验收 P0-1.5（昼夜·天气骨架）后的两条意见。**优先级最高**，放在后续 P0 推进的最前面。

### R1 · 染色/天气"像滤镜"，要真前景分层（不是调色）
- **现象**：P0-1.5 的 `.scene-tint` / `.scene-weather` 是**铺满整张图的全屏 overlay**，观感像"给图片调了个色 / 加了层滤镜"，**没有纵深**。密室尤其明显——只是冷色+雾罩盖在单层背景图上。
- **根因**：P0-1.5 按计划只做了**染色骨架**；真正的"前景分层（2.5D 纵深）"是 **B1 分层视差（§3 B1）**，尚未实装。
- **要做**：把 B1 提到 P0 最前——把地点/演出背景从**单层**拆成 **天/远景/前景** 多层，`cam` 时各层按 `depth` 差速位移；**地点屏也要分层**（不止演出几幕）。染色应叠在分层之上、并允许**前景层不被染**（近处实、远处虚），而不是一张全屏滤镜。
- **退一步的兜底**：若分层资产一时不齐，至少**提升染色/粒子质量**——景深渐变（近处不压暗）、染色限定中远景、粒子近大远小，避免"纯滤镜"观感。
- **红线不变**：只微动、不糊脸、≤400ms、手机性能（粒子守 `_budget`/`_degraded`）。
- **更新（2026-06-19 · B1 演出态镜头差速视差落地）**：演出舞台由**单层** `#story-bg` 升级为**双平面**——`#story-far`（远景气面，z-index 0；与背景同图，程序化"推远"：`blur(3px)` + 压暗 + 基准 `scale(1.08)` + `inset:-7%`）置于 `#story-bg`（中景，z-index 1）之下。`cutscene.js` 的 `_cam` 改为对两平面**差速施 transform**：中景全幅 `translate+scale`，远景按 `FAR_K=0.42` 取约 42% 幅度（位移与推拉同向但更小），背景移动时远景在边缘"露出"＝一次推镜里的纵深视差（aerial perspective）。**向后兼容**：无 `far`（旧 DOM / 无头测试）退化为单层，零回归（中景 transform 与旧版逐字等价）；静止态远景被不透明中景完全盖住＝零观感变化，仅演出态 `.on` 点亮。立绘层（z-index 2）不受影响，沿用既有 in/out/quake/speak-bump。`cutscene.test.js` 增 §2c 验证差速数值与单层退化；15 套测试 + run.js 全绿。**仍待**：真·切图多层（`{scene, layers:[{src,depth}]}`，等 CG 切片资产）与**地点屏**真分层（当前地点屏为程序化前景框 8 预设 + 远景气层，非按 depth 差速的实体切图）。

### R2 · 环境音是"音乐"，要的是"音效"（代入感，不是又一条 BGM）
- **现象**：P0-1 用 Lyria 生成的 `amb_night` / `amb_firefly` / `amb_candle` 听起来**是有旋律的音乐**，跟想要的**环境音效（虫鸣 / 烛火噼啪 / 夜风 / 檐滴）差距很大**。
- **定位纠偏**：环境床的目的是**代入感的"气口"**——让人觉得"真的在那个夜里"，**不是多提供一条可选 BGM**。它该是**底噪式的场景实录质感**，几乎无旋律、无明显乐器与节拍。
- **要做**：改 `scripts/genambient.js` 的**提示词**——
  - 明确**去掉**：melody / instruments / musical / rhythm / beat / harmony / score。
  - 明确**要**：field recording / foley / ambience / nature SFX / no music；具体场景词（"crickets chirping at night, soft", "candle flame crackle, faint", "low night wind", "water dripping from eaves"）；**可循环、极低动态、长尾**。
  - 验收：盲听应像"环境实录"而非"配乐"；若 Lyria 这类**生乐**模型本质难产出纯音效，改走**纯环境音/SFX 数据源**或**强化程序合成兜底**（虫鸣=带通噪脉冲、烛火=低频噼啪、夜风=低通噪缓动），audio.js 已是"文件优先、合成兜底"，二者择优。
- **音量**：守 art-direction"音是气口不是轰炸"，极低、压在 BGM 之下。
- **更新（2026-06-19 · 作者拍板）**：环境床定调改走"**舒缓暖音垫为底 + 各自极淡场景细节**"，**六床全部文件优先**（"夜晚不必只有干虫鸣，舒缓平静也是夜"），**定向覆盖 R2 的"纯音效"定位**。落库 `assets/audio/amb_{night,firefly,candle,wind,rain,market}.mp3`，`audio.js` 的 `AMB_FILES` 含全部六者，文件缺失/加载失败回退本引擎对应程序合成（不静默）。基调统一（暖音垫=夜床锁定的 glass pad）：night 远处稀虫/夜风、firefly 微光+稀虫、candle 暖底+极淡不刺耳火光、wind 低缓夜风、rain 檐雨嘶+稀落檐滴、market 远处人语+稀疏远钟。细节层为纯 numpy 合成（非 Lyria）的噪声/带噪短事件，随机间隔、无固定音高串联——实测包络周期性 ≈0.13（无节拍栅格）。
