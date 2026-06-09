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
      sense: 5,               // 神识
      body: 8,                // 体魄

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
      knownSkills: ["tuna", "huti", "ningshen", "zhayan", "weidu"], // 已掌握技能池
      activeChapter: "qixuan",   // 当前篇章
      unlockedChapters: ["qixuan"], // 已解锁篇章
      flags: {},              // 剧情标志位
      firedFortunes: [],      // 已触发的一次性奇遇 id
      tasks: [],              // 限期任务 [{ id, dueAbs }]
      timeline: [],           // 预定事件 [{ id, fireAbs }]
      storyStage: 0,          // 主线阶段推进指针

      bottle: {
        unlocked: false,
        plots: [],            // [{ crop, growth }]
      },

      log: [],                // 叙事记录（仅保留最近若干条）
      worldNews: [],          // 风云录（世间修士命途事件）
      npcFates: [],           // NPC 命途模拟状态
      relations: {},          // 与各 NPC 的关系值（好感/仇怨）
      metNpcs: [],            // 已相识 NPC 的 id（人物图鉴）
      pendingEvent: null,     // 当前待处理的选择事件 id
      explore: null,          // 箱庭探索会话（进入副本时生成）
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
    if (!d.activeChapter) d.activeChapter = "qixuan";
    if (!d.unlockedChapters) d.unlockedChapters = ["qixuan"];
    if (!d.tasks) d.tasks = [];
    if (!d.timeline) d.timeline = [];
    if (!d.firedFortunes) d.firedFortunes = [];
    if (d.speed == null) d.speed = 10;
    if (d.insight == null) d.insight = 6;
    if (!d.technique) d.technique = DATA.startingTechnique;
    if (!d.worldNews) d.worldNews = [];
    if (!d.relations) d.relations = {};
    if (!d.metNpcs) d.metNpcs = [];
    if (!d.npcFates || !d.npcFates.length) { if (typeof NPCSIM !== "undefined") NPCSIM.init(d); }
    if (d.explore === undefined) d.explore = null;
    if (!d.flightId) d.flightId = "none";
    if (typeof Loadout !== "undefined") Loadout.migrate(d);
  },
  hasSave() { return !!localStorage.getItem(SAVE_KEY); },

  // ---- 便捷访问 ----
  realm() { return DATA.realms[this.data.realmIndex]; },
  root() { return DATA.spiritRoots.find(r => r.id === this.data.rootId); },
  location() { return WORLD.locations.find(l => l.id === this.data.location); },
  absMonth() { return this.data.year * 12 + this.data.month; },

  // 有效遁速 = 基础遁速 + 飞行法宝加成（移动速度可视化的数值来源）
  flightTreasure() {
    const id = this.data.flightId || "none";
    return (DATA.flightTreasures && DATA.flightTreasures[id]) || DATA.flightTreasures.none;
  },
  effectiveSpeed() {
    const ft = this.flightTreasure();
    return (this.data.speed || 0) + (ft ? ft.speedBonus || 0 : 0);
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
