/* ============================================================
 * chapters.js — 篇章系统（地基抽象层）
 *
 * 见 docs/chapter-template.md。把"当前在哪一篇、境界上限、大境界序、
 * 起始地点、收尾解锁下一章"等收口到一处，使引擎不再硬编码篇章假设。
 * 新增地区只需在 list 增配置 + 填数据，引擎核心不动。
 * ============================================================ */

const Chapters = {
  list: [
    {
      id: "qixuan",
      name: "七玄门篇",
      order: 1,
      locked: false,
      realmTier: 0,             // 练气
      realmCapIndex: 6,         // 练气七层（DATA.realms 索引）
      startLocation: "qingniu",
      startStage: "village",
      completeFlag: "arc1_complete",
      nextChapter: "huangfeng",
      currencyName: "纹银",
    },
    {
      id: "huangfeng",
      name: "黄枫谷篇",
      order: 2,
      locked: true,             // 由七玄门篇收尾解锁
      realmTier: 0,             // 主体仍练气（篇末筑基质变才入 tier 1）
      realmCapIndex: 13,        // 练气十三层 + 筑基初期（DATA.realms 已扩）
      startLocation: null,      // 入谷剧情设定（升仙大会后由 warline/旅途落点）
      completeFlag: "arc2_complete",
      nextChapter: "modao",     // 篇末·燕家堡调令接魔道争锋篇（增量D前置）
      currencyName: "灵石",
      // 主线已实装：入谷四连/百药园/坊市归途杀陆云风/筑基/青元剑诀。后续（血色禁地深入·出谷）随版本续填。
    },
    {
      id: "modao",
      name: "魔道争锋篇",
      order: 3,
      locked: true,             // 由黄枫谷篇尾·燕家堡调令（李化元强制进场）解锁
      realmTier: 1,             // 筑基（韩立已伪灵根筑基入魔道争锋）
      realmCapIndex: 13,        // 暂沿筑基初期；深层筑基随增量E/F续填（不预造中后期）
      startLocation: "yanjiabao",
      completeFlag: "arc3_complete",
      nextChapter: "zaibie",    // 京城血夜了结→回天南（modao_e4b_likjing 接 再别天南篇）
      currencyName: "灵石",
      // 前置·燕家堡之战（特别篇）已实装：李化元强制调令→重逢墨彩环/结识董萱儿→战王蝉大BOSS→逃出强征入伍。
    },
    {
      id: "zaibie",
      name: "再别天南篇",
      order: 4,
      locked: true,             // 由魔道争锋篇尾·京城血夜了结（modao_e4b_likjing）解锁
      realmTier: 1,             // 筑基（章末跌境为纯演出·不动数值；乱星海篇初方结丹）
      realmCapIndex: 13,        // 沿筑基（跌境只演出·境界不真掉）
      startLocation: "jiayuan_city",
      completeFlag: "arc4_complete",
      nextChapter: "starsea",   // 章末落海·首见乱星海定格→初入星海篇（钩子·随后续篇章实装）
      currencyName: "灵石",
      // 衔接为主、自由度适当低的过场大章，重头在两段演出（离开天南/到达乱星海）。
      // 已实装：寻魂夺剑(绿煌剑·奇虫榜玉简)/曲魂身外化身(SideUnit)/金鼓原崩盘/亡命元武/三人护道·跌境/矿洞拖时启阵·大挪移令传送/落海定格。
    },
  ],

  get(id) { return this.list.find(c => c.id === id) || null; },

  // 当前篇章：取存档 activeChapter，缺省回退到第一个未通关/已解锁的篇章
  active() {
    const s = (typeof State !== "undefined" && State.data) ? State.data : null;
    const id = s && s.activeChapter;
    return this.get(id) || this.list[0];
  },

  // 本章境界上限 / 大境界序（引擎统一从这里读）
  realmCap() { return this.active().realmCapIndex; },
  realmTier() { return this.active().realmTier; },

  // 篇章是否已解锁（存档记录）
  isUnlocked(id) {
    const c = this.get(id);
    if (!c) return false;
    if (!c.locked) return true;
    const s = (typeof State !== "undefined" && State.data) ? State.data : null;
    return !!(s && s.unlockedChapters && s.unlockedChapters.includes(id));
  },

  // 解锁某篇章（写入存档）
  unlock(id) {
    const s = State.data;
    if (!s.unlockedChapters) s.unlockedChapters = [];
    if (!s.unlockedChapters.includes(id)) s.unlockedChapters.push(id);
  },

  // 进入某篇章（切换 active + 设起始地点）
  enter(id) {
    const c = this.get(id);
    if (!c) return false;
    State.data.activeChapter = id;
    if (c.startLocation) State.data.location = c.startLocation;
    return true;
  },
};

if (typeof window !== "undefined") window.Chapters = Chapters;
if (typeof module !== "undefined" && module.exports) module.exports = Chapters;
