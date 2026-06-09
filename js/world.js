/* ============================================================
 * world.js — 开放大世界（七玄门篇地图与据点）
 *
 * 设计：玩家在数个地点间自由往来，每个地点提供不同的「活动」与
 * 随机/条件事件。主线事件穿插在特定地点触发（见 story.js 的 location 条件）。
 *
 * 地点字段：
 *   id, name, desc
 *   travelCost  从他处前往所需光阴（月）
 *   actions     该地可做的活动 id 列表（映射 DATA.actions / 特殊活动）
 *   unlock(s)   解锁条件（未解锁则地图不显示），不写则默认解锁
 *   encounters  随机遭遇表（历练时抽取）
 * ============================================================ */

const WORLD = {};

WORLD.locations = [
  // —— 剧情过场地点（scene:true，不出现在云游列表，仅随剧情切换）——
  {
    id: "qingniu", arc: "qixuan", scene: true,
    name: "青牛镇", desc: "你的家乡，一个贫苦的小山村。",
    travelCost: 1, actions: [], encounters: [],
  },
  {
    id: "road", arc: "qixuan", scene: true,
    name: "赴考山路", desc: "通往七玄门的迢迢山路。",
    travelCost: 1, actions: [], encounters: [],
  },
  {
    id: "shanmen", arc: "qixuan", scene: true,
    name: "七玄门 · 山门", desc: "气派非凡的仙门，你将在此参加入门选拔。",
    travelCost: 1, actions: [], encounters: [],
  },
  {
    id: "yaolu",
    arc: "qixuan",
    name: "墨大夫药庐",
    desc: "你寄身的药庐。煎药、辨药、修炼《长春功》之所。也是小绿瓶藏匿之地。",
    travelCost: 1,
    map: { x: 50, y: 58 },
    actions: ["cultivate", "rest", "bottle", "alchemy"],
    encounters: [],
  },
  {
    id: "houshan",
    arc: "qixuan",
    name: "七玄门后山",
    desc: "门派后山，灵草丛生，亦有野兽与低阶修士出没。采药、历练的好去处。",
    travelCost: 2,
    map: { x: 72, y: 28 },
    actions: ["gather", "explore", "adventure"],
    encounters: [
      { id: "herb", weight: 38, kind: "gather" },
      { id: "duherb", weight: 16, kind: "gather_du" },
      { id: "beast", weight: 20, kind: "fight", enemy: "wild_wolf" },
      { id: "rival", weight: 14, kind: "fight", enemy: "outer_disciple" },
      { id: "silver", weight: 12, kind: "reward" },
    ],
  },
  {
    id: "wuting",
    arc: "qixuan",
    name: "演武厅",
    desc: "门中弟子切磋武艺之处。厉飞雨常在此。可习武、切磋、打探消息。",
    travelCost: 2,
    map: { x: 38, y: 40 },
    actions: ["spar", "adventure"],
    encounters: [
      { id: "spar_lifei", weight: 26, kind: "story_hint" },
      { id: "duel", weight: 22, kind: "fight", enemy: "outer_disciple" },
      { id: "rumor", weight: 18, kind: "rumor" },
      { id: "npc", weight: 18, kind: "npc" },
      { id: "temper", weight: 16, kind: "temper" },
    ],
  },
  {
    id: "town",
    arc: "qixuan",
    name: "山下集镇",
    desc: "七玄门山下的凡俗集镇。可用纹银采买丹药材料，听市井传闻。",
    travelCost: 3,
    map: { x: 28, y: 78 },
    actions: ["market", "adventure"],
    encounters: [
      { id: "merchant", weight: 28, kind: "market" },
      { id: "anqi", weight: 20, kind: "find_anqi" },
      { id: "rumor", weight: 18, kind: "rumor" },
      { id: "npc", weight: 20, kind: "npc" },
      { id: "thug", weight: 14, kind: "fight", enemy: "bandit" },
    ],
  },
  {
    id: "miju",
    arc: "qixuan",
    name: "墨大夫密室",
    desc: "墨大夫秘不示人的密室。阴气森森，似藏着不可告人的秘密。",
    travelCost: 2,
    map: { x: 58, y: 48 },
    actions: ["investigate"],
    unlock: (s) => s.flags.qi_layer_4,   // 修到练气四层、起疑后才会去探
    encounters: [],
  },
];

/* ---------- 历练遭遇用的敌人模板（战斗 Fighter 配置，数据驱动攻击）---------- */
WORLD.enemies = {
  wild_wolf:       { name: "灵狼", hp: 45, sense: 3, speed: 12, agility: 8, atkName: "扑咬", atk: 9, reward: { lingcao: 1 } },
  outer_disciple:  { name: "外门弟子", hp: 60, sense: 6, speed: 10, agility: 5, atkName: "拳脚", atk: 11, reward: { silver: 4 } },
  bandit:          { name: "山贼", hp: 50, sense: 4, speed: 8, agility: 3, atkName: "刀劈", atk: 10, reward: { silver: 3 } },
  rogue_cultivator:{ name: "散修", hp: 70, sense: 8, speed: 11, agility: 6, atkName: "法器袭", atk: 14, reward: { lingshi: 1 } },
  wolf_gang_thug:  { name: "野狼帮喽啰", hp: 65, sense: 5, speed: 9, agility: 4, atkName: "狼牙棒", atk: 13, reward: { silver: 6 } },
};

/* ---------- 人物名册（忠于动漫的过场/关键人物）----------
 * 不影响主线，纯增世界氛围与代入感；遇见后录入"人物图鉴"。
 * id 唯一；bio 为图鉴简介；lines 为随机搭话（数组）；where 出现地点；cond 出现条件。
 */
WORLD.npcs = [
  {
    id: "zhangtie", name: "张铁", role: "同乡挚友 · 习武",
    bio: "与韩立同赴七玄门补考入门的同乡少年，憨厚仗义。无法引气入体，止步长春功第一层，改修象甲功强身。",
    lines: ["韩立，又在捣鼓你那些草药？", "咱俩好歹也是从青牛镇一块儿出来的，可得互相照应。"],
    where: ["wuting", "yaolu"], cond: (s) => !s.flags.zhangtie_dead,
  },
  {
    id: "lifeiyu", name: "厉飞雨", role: "好友 · 武学有成",
    bio: "七玄门弟子，爽朗仗义，武学天赋出众。常赞韩立记性奇佳，唤他天才。后凭服食精元丹在门派大比中崭露头角。",
    lines: ["韩立！又躲在药庐？走，陪我过两招！", "你这记性简直是妖孽，换我早成高手了。"],
    where: ["wuting"],
  },
  {
    id: "modafu", name: "墨大夫", role: "授业之师 · 医毒",
    bio: "七玄门以医毒闻名的怪人，收韩立为药童、授《长春功》。看似衰朽老者，实则另有图谋——体内附着余子童的残魂。",
    lines: ["丹炉看好了，火候差一分都不成。", "（他咳嗽两声，浑浊的眼里掠过一丝你读不懂的精光）"],
    where: ["yaolu"], cond: (s) => s.flags.met_modafu && !s.flags.modafu_dead,
  },
  {
    id: "xiaosuanpan", name: "小算盘", role: "门中管事弟子",
    bio: "管着门中杂务、消息灵通的精明弟子，一笔账算得门儿清，最爱打探与传播门派内外的风声。",
    lines: ["韩师兄消息可不灵通，门里这么大的事都不晓得？", "灵石灵石，没灵石什么都免谈。"],
    where: ["wuting", "town"],
  },
  {
    id: "jiatianlong", name: "贾天龙", role: "野狼帮帮主",
    bio: "野狼帮帮主，野心勃勃，靠掳掠、吞并周边小帮做大，意图夺取七玄门治下的富庶城镇。后重金请来金光上人助阵。",
    lines: ["（远远望见一队凶悍帮众簇拥着一个魁梧身影掠过，正是野狼帮的人）"],
    where: ["town"], cond: (s) => s.flags.gang_war && !s.flags.jinguang_dead,
  },
  {
    id: "langhao", name: "野狼帮喽啰", role: "野狼帮帮众",
    bio: "野狼帮中横行乡里的凡俗打手，仗着帮派势大，时常滋扰集镇商旅。",
    lines: ["这条道是我们野狼帮的，留下买路钱！", "七玄门？哼，迟早是我们帮主的囊中之物。"],
    where: ["town", "houshan"], cond: (s) => s.flags.gang_war,
  },
  { id: "langzhong", name: "走方郎中", role: "凡俗医者", bio: "走街串巷的凡俗大夫，医术平平却见多识广。", lines: ["客官面色不佳，可要抓副药？"], where: ["town"] },
  { id: "biaoshi", name: "镖局趟子手", role: "押镖汉子", bio: "替商队押镖的江湖汉子，刀口舔血讨生活。", lines: ["这年头跑镖，最怕撞上野狼帮的人。"], where: ["town"] },
  { id: "nongfu", name: "采药老农", role: "山民", bio: "在后山采药为生的老山民，熟知山中草木与凶险。", lines: ["后山近来不太平，娃娃采药当心些。"], where: ["houshan"] },
  { id: "sanxiu", name: "云游散修", role: "外来修士", bio: "无门无派、四海漂泊的低阶散修，眼高于顶，却也朝不保夕。", lines: ["区区七玄门，也配称仙门？呵。"], where: ["houshan", "town"] },
  {
    id: "jinguang", name: "金光上人", role: "青苓修仙杀手",
    bio: "青苓来的矮胖和尚，野狼帮帮主贾天龙重金请来的修仙杀手。会金符、剑符、金钟罩等术法，轻易击败七玄门三位师叔。最终被以毒、暗器与算计反杀。",
    lines: ["七玄门？也配？"], where: [], cond: (s) => s.flags.jinguang_appeared,
  },
];

WORLD.npcById = function (id) { return WORLD.npcs.find(n => n.id === id) || null; };

// 某地点当前在场的人物（据点临场感：忠于剧情阶段与出现条件）
WORLD.localsAt = function (locId, s) {
  return WORLD.npcs.filter(n => n.where && n.where.includes(locId) && (!n.cond || n.cond(s)));
};

WORLD.randomNpc = function (locId, s) {
  const pool = WORLD.npcs.filter(n => (!n.where || n.where.includes(locId)) && (!n.cond || n.cond(s)));
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)];
};

/* ---------- 特殊活动说明（非战斗）----------
 * 与 DATA.actions 合并使用；这里补充世界特有活动的耗时与描述
 */
WORLD.activities = {
  gather:      { name: "采药",   timeCost: 1, desc: "在灵草丛中采撷草药与灵草。" },
  spar:        { name: "切磋",   timeCost: 1, desc: "与同门切磋武艺，磨炼身法。" },
  market:      { name: "采买",   timeCost: 1, desc: "用纹银购置丹药与材料。" },
  alchemy:     { name: "炼药",   timeCost: 1, desc: "以草药炼制丹药（七玄门篇从简）。" },
  investigate: { name: "探查",   timeCost: 1, desc: "暗中查访，搜寻线索。" },
};

window.WORLD = WORLD;
