/* ============================================================
 * state.js — 游戏状态：创建、存档、读档
 * ============================================================ */

const SAVE_KEY = "frxxz_save_v1";

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
      revealedRealm: 0,       // 藏拙：示人境界（真实境界=realmIndex；差值=深藏的层数）
      skills: { alchemy: 0, scouting: 0 },   // 杂学熟练度：药理 / 探知（嗑瓜子轴）
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
      journey: null,          // 大陆旅途 { to, toName, leg, total, back }（旅途即内容：world-architecture §1.3）
      gear: { weapon: null, armor: null, accessory: null },   // 法器装备三槽（DATA.gear）
      sideTreasures: [],      // 伴身法宝槽（v96 三类法宝制：被动面板件，槽数=神识档）
      visitedNodes: ["caixia"],   // 到过的大陆节点（舆图墨痕：走过的路，地图记得）
    };
    this.give("qingyuan_dan", 2);
    if (typeof NPCSIM !== "undefined") NPCSIM.init(this.data);
    return this.data;
  },

  // ---- 存读档 ----
  save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
      return true;
    } catch (e) { return false; }
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
  // 老存档兜底：新增字段补默认值（保证篇章扩展后旧档不崩）
  _migrate() {
    const d = this.data;
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
    if (d.revealedRealm == null) d.revealedRealm = d.realmIndex;   // 老档：示人=真实（未藏过）
    if (d.zhuanImprint == null) d.zhuanImprint = 1;   // 三转重元功·乘性印记（增6）
    if (!d.skills) d.skills = { alchemy: 0, scouting: 0 };
    if (!d.medals) d.medals = {};
    if (!d.intel) d.intel = {};
    if (!d.intelMoves) d.intelMoves = {};
    if (d.ripple === undefined) d.ripple = null;
    if (d.rippleWindow === undefined) d.rippleWindow = null;
    if (!d.doneRipples) d.doneRipples = [];
    if (d.fame == null) d.fame = 0;
    if (d.sideUnit === undefined) d.sideUnit = null;
    if (!d.gear) d.gear = { weapon: null, armor: null, accessory: null };
    if (!d.sideTreasures) d.sideTreasures = [];   // 伴身法宝槽（v96）
    if (!d.intelElems) d.intelElems = {};
    if (!d.ledger) d.ledger = {};
    if (d.journey === undefined) d.journey = null;
    if (d.exmap === undefined) d.exmap = null;
    // 灵力池永久加成（突破水准+特殊境遇累计）。老档按"普通水准"补偿已突破的层数
    if (d.poolBonus == null) d.poolBonus = (d.realmIndex || 0) * 2;
    if (!d.visitedNodes) d.visitedNodes = ["caixia"];
    // 老档补发：已反杀墨大夫者，曲魂幡尸傀随行
    if (d.flags && d.flags.modafu_dead && !d.sideUnit) {
      d.sideUnit = { id: "zhangtie_corpse", name: "铁奴·张铁", hp: 70, hpMax: 70, atk: 12,
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
  // 装备的法器（按槽取 DATA.gear 定义；未达驱使门槛视为未装备）
  gearOf(slot) {
    const id = this.data.gear && this.data.gear[slot];
    if (!id) return null;
    const def = DATA.gear && DATA.gear[id];
    if (!def) return null;
    const layer = this.gateLayer();
    if (def.minLayer && layer < def.minLayer) return null;   // 修为不够，驱使不动
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
    const layer = this.gateLayer();
    if (def.minLayer && layer > 0 && layer < def.minLayer) return null;
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
    return null;
  },

  effectiveSpeed() {
    const ft = this.flightTreasure();
    return (this.data.speed || 0)
      + this.realmSpeedBonus()
      + this.movementArtBonus()
      + (ft ? ft.speedBonus || 0 : 0)
      + this.gearBonus("speed");
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
