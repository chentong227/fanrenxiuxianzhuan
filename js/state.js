/* ============================================================
 * state.js — 游戏状态：创建、存档、读档
 * ============================================================ */

const SAVE_KEY = "frxxz_save_v1";                     // 自动档（每月行动自动写入·兼容旧单档存档）
const SLOT_KEYS = ["frxxz_slot_1", "frxxz_slot_2", "frxxz_slot_3"];   // 手动档位 ×3（v343）

const State = {
  data: null,

  // 创建新存档
  create(name, rootId) {
    const root = DATA.spiritRoots.find(r => r.id === rootId) || DATA.spiritRoots[3];
    const realm = DATA.realms[0];
    this.data = {
      name: name || "韩立",
      rootId: root.id,

      realmIndex: 0,          // 当前境界索引（指向 DATA.realms）
      cultivation: 0,         // 当前层修为
      spirit: 60,             // 灵力
      poolBonus: 0,           // 灵力池永久加成（突破水准+天材地宝/特殊境遇累计——balance.manaPool）
      sense: 5,               // 神识
      body: 8,                // 体魄
      zhuanImprint: 1,        // 三转重元功·真元精纯乘性印记（每转累乘·吃进闭关修为增速——见 DATA.reforge）

      hp: 100, hpMax: 100,
      mood: 100, moodMax: 100,
      demon: 0,               // 心魔（越高越危险）

      speed: 10,              // 遁速（赶路耗时 + 战斗先手）
      insight: 6,             // 悟性（突破削瓶颈 + 顿悟 + 习功法/炼丹）

      lifespan: 100,          // 寿元上限（练气期凡俗之躯）
      age: 13,                // 年龄
      year: 1,                // 入门后第几年
      month: 1,               // 1~12，便于时间叙事

      stones: 0,              // 灵石
      silver: 20,             // 纹银（七玄门篇凡俗通货，墨大夫按层赏银）

      location: "qingniu",    // 当前所在地点（开局在青牛镇）
      flightId: "none",       // 飞行法宝（影响移动速度），默认徒步

      heroSkin: null,         // 手动选定的韩立立绘 ID（null=跟随境界默认；v213 三级换装）

      inventory: {},          // { itemId: count }
      spells: ["tuna", "huti", "ningshen", "zhayan", "weidu"], // 长春功一系 + 眨眼剑法 + 喂毒（七玄门篇真实手段）
      technique: DATA.startingTechnique, // 主修功法（本篇恒为长春功）
      auxTechniques: [],      // 辅修功法
      learnedTechniques: [DATA.startingTechnique], // 已习得功法
      techLayers: { [DATA.startingTechnique]: 1 }, // 功法层数轴（§5.3）：主修起始入门层（与 Loadout.migrate 兜底一致）
      knownSkills: ["tuna", "huti", "ningshen", "zhayan", "weidu"], // 已掌握技能池
      activeChapter: "qixuan",   // 当前篇章
      unlockedChapters: ["qixuan"], // 已解锁篇章
      flags: {},              // 剧情标志位
      firedFortunes: [],      // 已触发的一次性奇遇 id
      tasks: [],              // 限期任务 [{ id, dueAbs }]
      dynQuests: [],          // 对谈中接下的动态请托 [{ id, title, desc, kind, target, reward, dueAbs, npcId, fromName }]
      leads: [],              // 对谈中听到的线索 [{ id, title, where, npcId, fromName, dueAbs }]
      heardLeads: [],         // 已听过(未兑现)的线索 id，避免重复透露
      timeline: [],           // 预定事件 [{ id, fireAbs }]
      storyStage: 0,          // 主线阶段推进指针

      bottle: {
        unlocked: false,
        plots: [],            // [{ crop, growth }]
      },
      fuluPlans: [],          // 已解锁的符箓方案 id（制符 v2，combat-arsenal §3.7）

      log: [],                // 叙事记录（仅保留最近若干条）
      scenes: [],             // §9-6 名场面回廊：已演完的"含演出"剧情节点 [{ id, title, t, cg }]，可在风云录重温
      worldNews: [],          // 风云录（世间修士命途事件）
      npcFates: [],           // NPC 命途模拟状态
      relations: {},          // 与各 NPC 的关系值（好感/仇怨）
      npcCd: {},              // 拜会节律：{ npcId: 上次实质交往的绝对月 }（每人每月一次切磋/赠礼/探查/威胁）
      npcGifts: {},           // 羁绊回赠节点：{ npcId: 已回赠到的最高交情段位 }（升段一次性，不可刷）
      keepsakes: [],          // 已得唯一信物 [{ id, from, fromName, t }]（入图鉴/年表）
      aidCd: -99,             // 羁绊战斗支援冷却：上次故人来援的绝对月（难忘的一笔，非常驻拐杖）
      metNpcs: [],            // 已相识 NPC 的 id（人物图鉴）
      pendingEvent: null,     // 当前待处理的选择事件 id
      explore: null,          // 箱庭探索会话（旧网格，进入副本时生成）
      exmap: null,            // 箱庭探索 v3：L1 舆图+嵌套栈会话（exploremap.js）
      benchTreasures: [],     // 收起不出战的法宝技（gear grantSpells 的出战开关）
      dialogueDone: {},       // 已完成的一次性对话主题（防刷）

      swordIntent: 0,         // 剑意（眨眼剑法修行链：实战用剑积累，满则可悟剑）
      swordMastery: false,    // 眨眼剑法大成（解锁连环眨眼）
      milestones: [],         // 道途年表 [{ t, title, kind }]（质变/大件/勋章永久记录）
      beastRumor: null,       // 活跃的异闻妖王 id（听闻在前，深入后山可遇）
      beastRumorClue: 0,      // 异闻寻踪进度（听闻→寻踪→相遇：随月份逐渐逼近真相）
      beastRumorClueAt: null, // 上一条线索浮现的绝对月份（隔月铺陈：两条线索至少相隔 2 月）
      slainBeasts: [],        // 已伏诛的异闻妖王（不再重复出没）
      materialRumor: null,    // 活跃的材料传闻 id（听闻→寻踪→探索采得）
      materialRumorClue: 0,   // 材料传闻寻踪进度
      materialRumorClueAt: null, // 上一条线索浮现的绝对月份
      foundMaterials: [],     // 已采得的传闻材料（不再重复投放）
      revealedRealm: 0,       // 藏拙：示人境界（真实境界=realmIndex；差值=深藏的层数）
      skills: { alchemy: 0, scouting: 0, fulu: 0 },   // 杂学熟练度：药理 / 探知 / 制符（嗑瓜子轴）
      intel: {},              // 情报面纱：{ npcId: 0听闻|1见过出手|2买过底细 }
      intelMoves: {},         // 交手自动补全：{ enemyName: [已见招式名] }
      ripple: null,           // 活跃的涟漪事件链 { id, stage, nextAbs }
      rippleWindow: null,     // 涟漪开出的限时窗口 { id, dueAbs, note }
      doneRipples: [],        // 已走完的涟漪链
      fame: 0,                // 名声（事迹累积，风云榜位次依据）
      medals: {},             // 漂亮的赢勋章 { id: count }
      sideUnit: null,         // 侧位单位（尸傀/灵宠/傀儡）{ id,name,hp,hpMax,atk,...,status,carry }
      intelElems: {},         // 已揭示的敌方道基行属 { 敌名: elem }（打了才知道）
      ledger: {},             // 因果账本：{ id: {t,label} }——插曲种因，主线节点读账结果（world-architecture §3）
      temperament: { stoic: 0, sentiment: 0, marks: [] },   // 心性账本：名场面态度累计（克制承志 vs 动情牵挂），铸"我是谁"——名场面回望选择在此结算（铁律3 闭环）
      journey: null,          // 大陆旅途 { to, toName, leg, total, back }（旅途即内容：world-architecture §1.3）
      gear: { weapon: null, armor: null, accessory: null },   // 法器装备三槽（DATA.gear）
      sideTreasures: [],      // 伴身法宝槽（v96 三类法宝制：被动面板件，槽数=神识档）
      visitedNodes: ["caixia"],   // 到过的大陆节点（舆图墨痕：走过的路，地图记得）
      yiwenSeen: [],          // 异闻录：已听闻（风声在耳）的异闻 id（触发留痕；WORLD.yiwen 图鉴卡态派生之一）
    };
    this.give("qingyuan_dan", 2);
    if (typeof NPCSIM !== "undefined") NPCSIM.init(this.data);
    return this.data;
  },

  // ---- 存读档 ----
  save() {
    // 演武场/调试入口不落档（v340·遗留数据丢失陷阱）：?demo/?debugfight/?citydemo 等
    // 会 State.create 覆盖内存态，行动一结算 save() 就把玩家真档冲掉——点过一次演武链接=进度清零。
    // main.init 检出调试参数即挂 _ephemeral 旗，本局只玩不存。
    if (this._ephemeral) return true;
    // 不落死档（v343·用户裁决「死亡不能就此结束」）：身死/寿尽那一拍的状态不写盘——
    // 自动档永远停在殒身前的最后一个活月，终章屏「回档再来」读回去就是生路。
    if (this.data && (this.data.hp <= 0 || this.data.age >= this.data.lifespan)) return true;
    // v344 成就惰性检查：每次落档前扫一遍（O(1) 字段比对 ×20，开销可忽略；新达成即报喜）
    try { if (typeof ACH !== "undefined" && this.data) ACH.check(this.data); } catch (e) {}
    // v347 煞气峰值记账（终章总结用）：一生煞气最重到过几分
    try {
      const d0 = this.data;
      if (d0 && d0.flags && (d0.demon || 0) > (d0.flags.sha_peak || 0)) d0.flags.sha_peak = d0.demon;
    } catch (e) {}
    try {
      this.data.savedAt = Date.now();
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
      // v345 落档指示：每月首存闪一粒墨点（写没写上，眼角有数）；失败则红点常驻警示
      try { if (typeof UI !== "undefined" && UI.flashSaveDot) UI.flashSaveDot((this.data.year || 1) * 12 + (this.data.month || 1), true); } catch (e) {}
      return true;
    } catch (e) {
      try { if (typeof UI !== "undefined" && UI.flashSaveDot) UI.flashSaveDot(null, false); } catch (e2) {}
      return false;
    }
  },
  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      this.data = JSON.parse(raw);
      this._migrate();
      return true;
    } catch (e) { return false; }
  },

  // ---- 手动档位（v343）：3 槽手动 + 1 槽自动，存/读/看均走这里 ----
  // n=0..2 手动槽；n=-1 自动档。读手动档时顺手把自动档对齐——刷新后续读的仍是同一段进度。
  saveSlot(n) {
    if (this._ephemeral || !this.data || !SLOT_KEYS[n]) return false;
    try {
      this.data.savedAt = Date.now();
      localStorage.setItem(SLOT_KEYS[n], JSON.stringify(this.data));
      return true;
    } catch (e) { return false; }
  },
  loadSlot(n) {
    const key = n < 0 ? SAVE_KEY : SLOT_KEYS[n];
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return false;
      this.data = JSON.parse(raw);
      this._migrate();
      if (n >= 0) { try { localStorage.setItem(SAVE_KEY, raw); } catch (e) {} }
      return true;
    } catch (e) { return false; }
  },
  slotInfo(n) {
    const key = n < 0 ? SAVE_KEY : SLOT_KEYS[n];
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const d = JSON.parse(raw);
      return {
        name: d.name || "韩立",
        realm: (DATA.realms[d.realmIndex] || {}).name || "凡夫",
        year: d.year || 1, month: d.month || 1,
        chapter: d.activeChapter || "qixuan",
        savedAt: d.savedAt || 0,
      };
    } catch (e) { return { corrupt: true }; }
  },
  hasAnySave() {
    try { return !!(localStorage.getItem(SAVE_KEY) || SLOT_KEYS.some(k => localStorage.getItem(k))); }
    catch (e) { return false; }
  },
  // 老存档兜底：新增字段补默认值（保证篇章扩展后旧档不崩）
  _migrate() {
    const d = this.data;
    // 道号防呆（v328·QA 实锤）：name 若被误存成对象（旧 gen-saves 传对象的夹具/异常写入），
    // 战斗名牌/对话说话人会渲染成 [object Object]——读档一律归一成字符串
    if (typeof d.name !== "string") d.name = (d.name && typeof d.name.name === "string") ? d.name.name : "韩立";
    // 战中残旗防软锁（v332·全篇章级）：开战即有一次 State.save()（战况铭牌落档），此时 combat=true
    // 已写进存档——玩家战斗中刷新/杀进程后读档，战斗对象早已不在内存，这面旗却把所有行动
    // 拦成「酣战之中，无暇他顾」、手机端连行动 sheet 都不弹＝死档。战斗本就不可序列化续打，
    // 读档一律清旗；待决的战斗剧情仍在 pendingEvent 里，重开演出可再战，一分不丢。
    d.combat = false;
    // 死档吊命（v343）：v343 之前死亡瞬间的状态可能已写进档——读回来一动就再死=死循环。
    // 一口真气吊回 1 点气血，给玩家嗑药/调息的活路（寿尽档无解，终章屏自会再见）。
    if (typeof d.hp === "number" && d.hp <= 0) d.hp = 1;
    // v344 成就：读档即补判一轮——老档的既有成绩（境界/伏诛/家财）立刻点亮，不用等下一次行动
    try { if (typeof ACH !== "undefined") ACH.check(d); } catch (e) {}
    if (!d.benchTreasures) d.benchTreasures = [];
    if (!d.activeChapter) d.activeChapter = "qixuan";
    if (!d.unlockedChapters) d.unlockedChapters = ["qixuan"];
    if (!d.tasks) d.tasks = [];
    if (!d.dynQuests) d.dynQuests = [];
    if (!d.leads) d.leads = [];
    if (!d.heardLeads) d.heardLeads = [];
    if (!d.timeline) d.timeline = [];
    if (!d.firedFortunes) d.firedFortunes = [];
    if (d.speed == null) d.speed = 10;
    if (d.insight == null) d.insight = 6;
    if (!d.technique) d.technique = DATA.startingTechnique;
    if (!d.worldNews) d.worldNews = [];
    if (!d.relations) d.relations = {};
    if (!d.npcCd) d.npcCd = {};
    if (!d.npcGifts) d.npcGifts = {};
    if (!d.keepsakes) d.keepsakes = [];
    if (d.aidCd == null) d.aidCd = -99;
    if (!d.metNpcs) d.metNpcs = [];
    if (!d.npcFates || !d.npcFates.length) { if (typeof NPCSIM !== "undefined") NPCSIM.init(d); }
    if (d.explore === undefined) d.explore = null;
    if (!d.dialogueDone) d.dialogueDone = {};
    if (!d.flightId) d.flightId = "none";
    if (d.swordIntent == null) d.swordIntent = 0;
    if (d.swordMastery == null) d.swordMastery = false;
    if (!d.milestones) d.milestones = [];
    if (d.beastRumor === undefined) d.beastRumor = null;
    if (d.beastRumorClue === undefined) d.beastRumorClue = 0;
    if (d.beastRumorClueAt === undefined) d.beastRumorClueAt = null;
    if (!d.slainBeasts) d.slainBeasts = [];
    if (d.materialRumor === undefined) d.materialRumor = null;
    if (d.materialRumorClue === undefined) d.materialRumorClue = 0;
    if (d.materialRumorClueAt === undefined) d.materialRumorClueAt = null;
    if (!d.foundMaterials) d.foundMaterials = [];
    if (d.revealedRealm == null) d.revealedRealm = d.realmIndex;   // 老档：示人=真实（未藏过）
    if (d.zhuanImprint == null) d.zhuanImprint = 1;   // 三转重元功·乘性印记（增6）
    if (!d.skills) d.skills = { alchemy: 0, scouting: 0, fulu: 0 };
    if (d.skills.fulu == null) d.skills.fulu = 0;   // 制符术熟练度（制符 v2）
    // 随身灵圃 v2：老档兜底（早于小绿瓶的存档无 bottle 字段，惰性初始化）
    if (!d.bottle) d.bottle = { unlocked: false, plots: [] };
    if (!d.fuluPlans) d.fuluPlans = [];              // 已解锁符箓方案（制符 v2）
    if (!d.medals) d.medals = {};
    if (!d.intel) d.intel = {};
    if (!d.intelMoves) d.intelMoves = {};
    if (d.ripple === undefined) d.ripple = null;
    if (d.rippleWindow === undefined) d.rippleWindow = null;
    if (!d.doneRipples) d.doneRipples = [];
    if (!d.yiwenSeen) d.yiwenSeen = [];
    if (d.fame == null) d.fame = 0;
    if (d.sideUnit === undefined) d.sideUnit = null;
    if (!d.gear) d.gear = { weapon: null, armor: null, accessory: null };
    if (!d.sideTreasures) d.sideTreasures = [];   // 伴身法宝槽（v96）
    if (!d.intelElems) d.intelElems = {};
    if (!d.ledger) d.ledger = {};
    // 健壮性：location 必须是有效地点 id——老档/重构改 id 后若失配，静默回退会让玩家"莫名被传回青牛镇"。
    //   这里兜底为 qingniu（安全默认），但留一条 console 警告便于排查（不改 schema、不卡档）。
    if (typeof WORLD !== "undefined" && WORLD.locations && d.location
        && !WORLD.locations.some(l => l.id === d.location)) {
      try { console.warn("[migrate] 无效地点 id：" + d.location + " → 回退 qingniu"); } catch (e) {}
      d.location = "qingniu";
    }
    if (!d.temperament) d.temperament = { stoic: 0, sentiment: 0, marks: [] };   // 心性账本：克制/承志 vs 动情/牵挂（名场面态度累计，铸"我是谁"）
    if (d.journey === undefined) d.journey = null;
    if (d.exmap === undefined) d.exmap = null;
    if (d.heroSkin === undefined) d.heroSkin = null;   // v213 三级换装：手动选定立绘（老档默认跟随境界）
    // 灵力池永久加成（突破水准+特殊境遇累计）。老档按"普通水准"补偿已突破的层数
    if (d.poolBonus == null) d.poolBonus = (d.realmIndex || 0) * 2;
    if (!d.visitedNodes) d.visitedNodes = ["caixia"];
    // 老档补发：已反杀墨大夫者，曲魂幡尸傀随行（玄骨夺曲魂后 quhun_lost·不再补发）
    if (d.flags && d.flags.modafu_dead && !d.sideUnit && !d.flags.quhun_stay_jiayuan && !d.flags.quhun_lost) {
      d.sideUnit = { id: "zhangtie_corpse", name: "曲魂", hp: 70, hpMax: 70, atk: 12,
                     atkName: "尸傀挥击", nature: "corpse", guard: 0.3, status: "ok", carry: true };
    }
    // 老档补发：已杀金光上人者，金光砖入袋
    if (d.flags && d.flags.jinguang_dead && !(d.inventory && d.inventory.jinguang_zhuan)) {
      d.inventory = d.inventory || {};
      d.inventory.jinguang_zhuan = 1;
      d.inventory.jinguang_zhuan_charge = (d.inventory.jinguang_zhuan_charge || 0) + 3;
    }
    // 旧档修正：剑法大成者，连环眨眼【替换】眨眼连击（v30 曾并列，致"没有提升感"）
    if (d.swordMastery) {
      d.knownSkills = (d.knownSkills || []).filter(id => id !== "zhayan_lian");
      if (!d.knownSkills.includes("lianhuan")) d.knownSkills.push("lianhuan");
      d.spells = (d.spells || []).filter(id => id !== "zhayan_lian");
      if (!d.spells.includes("lianhuan")) d.spells.push("lianhuan");
    } else {
      // C3 修正：眨眼连击在当前进程不可得（眨眼剑法本体经剑意大成直接进化为连环眨眼，无独立连击档）。
      // 老档若残留 zhayan_lian（C1 配装重构前的遗留），剥离回基础眨眼剑法——
      // 免得早期（如夺舍之夜）越权使出与彼时能力不符的连击。
      d.knownSkills = (d.knownSkills || []).filter(id => id !== "zhayan_lian");
      d.spells = (d.spells || []).filter(id => id !== "zhayan_lian");
    }
    if (typeof Loadout !== "undefined") Loadout.migrate(d);
  },
  hasSave() { return !!localStorage.getItem(SAVE_KEY); },

  // ---- 便捷访问 ----
  realm() { return DATA.realms[this.data.realmIndex]; },

  // 主修功法层进度信息（technique-tiers §5.3）。无层数轴功法返回 null。
  mainTechLayerInfo(s) {
    s = s || this.data;
    const def = DATA.techniques[s.technique];
    if (!def || !def.maxLayers) return null;
    const layer = (typeof Loadout !== "undefined")
      ? Loadout.techLayer(s, s.technique)
      : ((s.techLayers && s.techLayers[s.technique]) || 1);
    return { name: def.name, layer, max: def.maxLayers };
  },
  // 大境界内部 初入↔中坚↔巅峰（由主修功法层进度派生，不污染 DATA.realms）。
  // 练气期用本身离散层数（练气N层），不派生 → null。
  realmStage(s) {
    s = s || this.data;
    const realm = DATA.realms[s.realmIndex];
    if (!realm || realm.tier === "qi") return null;
    const info = this.mainTechLayerInfo(s);
    if (!info || !info.max || info.max <= 1) return null;
    const t = Math.max(0, Math.min(1, (info.layer - 1) / (info.max - 1)));
    if (t < 0.34) return { key: "early", name: "初入" };
    if (t < 0.67) return { key: "mid", name: "中坚" };
    return { key: "peak", name: "巅峰" };
  },

  root() { return DATA.spiritRoots.find(r => r.id === this.data.rootId); },
  location() { return WORLD.locations.find(l => l.id === this.data.location); },
  absMonth() { return this.data.year * 12 + this.data.month; },

  // 有效遁速 = 基础遁速 + 境界遁光增益 + 遁术功法 + 飞行法宝（移动速度可视化的数值来源）
  flightTreasure() {
    const id = this.data.flightId || "none";
    return (DATA.flightTreasures && DATA.flightTreasures[id]) || DATA.flightTreasures.none;
  },
  // 修为/境界本身带来的遁光增益（境界越高，遁光越快）
  realmSpeedBonus() {
    const tier = (typeof Chapters !== "undefined") ? Chapters.realmTier() : 0;
    return tier * 8;   // 练气0 / 筑基8 / 结丹16 ...
  },
  // 已习「遁术功法/身法」累计加成（与飞行法宝叠加）
  movementArtBonus() {
    if (typeof DATA.movementArts === "undefined") return 0;
    const learned = this.data.learnedTechniques || [];
    let bonus = 0;
    for (const id of Object.keys(DATA.movementArts)) {
      const m = DATA.movementArts[id];
      // 已习得对应功法，或本篇默认可用（未锁）的随身身法
      if (learned.includes(id) || (!m.locked && id === "zhayan_bushi" && (this.data.spells || []).includes("zhayan"))) {
        bonus += m.speedBonus || 0;
      }
    }
    return bonus;
  },
  // 法器「驱使门槛」用的等效练气层：筑基及以上已超练气全层，统一视作远超任何练气门槛
  // （否则筑基后 layer 归 1，会把练气十一层购入的顶阶法器误判为驱使不动）。
  gateLayer(s) {
    s = s || this.data;
    const realm = DATA.realms[s.realmIndex] || {};
    if (realm.tier && realm.tier !== "qi") return 999;
    return realm.layer || 1;
  },
  // 装备的法器（按槽取 DATA.gear 定义；越阶催动=灵力消耗倍增，不再硬拦截）
  gearOf(slot) {
    const id = this.data.gear && this.data.gear[slot];
    if (!id) return null;
    const def = DATA.gear && DATA.gear[id];
    if (!def) return null;
    return Object.assign({ id }, def);
  },
  /* —— 伴身法宝（v96 三类法宝制：主攻1/主防1/伴身N）——
   * 被动面板件：装备即生效，战斗零操作（决策前移到洞府）。
   * 槽数=神识档（Balance.sideTreasureSlots：境界+大衍诀——"神识=并用上限"的兑现） */
  sideTreasureSlots() {
    const tier = (typeof Chapters !== "undefined") ? Chapters.realmTier() : 0;
    const hasDayan = !!(this.data.flags && this.data.flags.dayan_learned);
    return (typeof Balance !== "undefined" && Balance.sideTreasureSlots)
      ? Balance.sideTreasureSlots(tier, hasDayan) : 1;
  },
  sideTreasureOf(idx) {
    const id = (this.data.sideTreasures || [])[idx];
    if (!id) return null;
    const def = DATA.gear && DATA.gear[id];
    if (!def) return null;
    return Object.assign({ id }, def);
  },
  sideTreasures() {
    return (this.data.sideTreasures || []).map((_, i) => this.sideTreasureOf(i)).filter(Boolean)
      .slice(0, this.sideTreasureSlots());
  },
  // 伴身件被动面板（v96）：与三槽分账——三槽的 hpMax 等直写 s.hpMax（装备时结算），
  // 伴身件全部动态计算（装备/卸下零状态污染）
  sideBonus(key) {
    let n = 0;
    this.sideTreasures().forEach(g => { if (g.bonus && g.bonus[key]) n += g.bonus[key]; });
    return n;
  },
  gearBonus(key) {
    let n = 0;
    ["weapon", "armor", "accessory"].forEach(slot => {
      const g = this.gearOf(slot);
      if (g && g.bonus && g.bonus[key]) n += g.bonus[key];
    });
    n += this.sideBonus(key);
    return n;
  },
  gearTrait(traitId) {
    for (const slot of ["weapon", "armor", "accessory"]) {
      const g = this.gearOf(slot);
      if (g && g.traits) {
        const t = g.traits.find(x => x.id === traitId);
        if (t) return t;
      }
    }
    for (const g of this.sideTreasures()) {
      if (g.traits) {
        const t = g.traits.find(x => x.id === traitId);
        if (t) return t;
      }
    }
    // 飞行法宝特性（外海风云·风雷翅兑现）：feng_lei_chi 的 fenglei（雷遁）/fly 挂在
    // DATA.flightTreasures 上——御着它才生效（flightId 即"穿在身上"）
    const ft = this.flightTreasure();
    if (ft && ft.traits) {
      const t = ft.traits.find(x => x.id === traitId);
      if (t) return t;
    }
    return null;
  },

  effectiveSpeed() {
    const ft = this.flightTreasure();
    // 元武国代工·精工神风舟（M3 取舍）：帆骨风纹——御舟遁速+2（仅御神风舟时生效）
    const fineZhou = (this.data.flags && this.data.flags.daigong_fine_zhou && this.data.flightId === "shen_feng_zhou") ? 2 : 0;
    // 风雷翅·初驭不善（外海风云·喜剧成长弧："使脚刹"）：未精通前只发挥一半脚力
    let ftBonus = ft ? ft.speedBonus || 0 : 0;
    if (this.data.flightId === "feng_lei_chi" && !(this.data.flags && this.data.flags.whfy_chi_mastered)) {
      ftBonus = Math.round(ftBonus * 0.5);
    }
    return (this.data.speed || 0)
      + this.realmSpeedBonus()
      + this.movementArtBonus()
      + ftBonus
      + this.gearBonus("speed")
      + fineZhou;
  },

  // ---- 物品操作 ----
  give(itemId, n = 1) {
    const inv = this.data.inventory;
    inv[itemId] = (inv[itemId] || 0) + n;
    if (inv[itemId] <= 0) delete inv[itemId];
  },
  take(itemId, n = 1) {
    const inv = this.data.inventory;
    if ((inv[itemId] || 0) < n) return false;
    inv[itemId] -= n;
    if (inv[itemId] <= 0) delete inv[itemId];
    return true;
  },
  count(itemId) { return this.data.inventory[itemId] || 0; },

  // ---- 标志位 ----
  flag(key) { return !!this.data.flags[key]; },
  setFlag(key, v = true) { this.data.flags[key] = v; },

  // ---- 人物图鉴：记录已相识 NPC（返回是否首次结识）----
  meetNpc(id) {
    if (!this.data.metNpcs) this.data.metNpcs = [];
    if (id && !this.data.metNpcs.includes(id)) { this.data.metNpcs.push(id); return true; }
    return false;
  },
};

window.State = State;
