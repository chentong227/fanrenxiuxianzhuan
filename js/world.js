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
    desc: "你寄身的药庐，也是你潜修的洞府。煎药、辨药、打坐、闭关、冲关，皆在此处。小绿瓶亦藏于此。",
    travelCost: 1,
    map: { x: 50, y: 58 },
    home: true,   // 洞府/居所：闭关、调息、突破之所
    actions: ["cultivate", "breakthrough", "rest", "bottle", "alchemy"],
    encounters: [],
  },
  {
    id: "houshan",
    arc: "qixuan",
    name: "七玄门后山",
    desc: "门派后山，灵草丛生，亦有野兽与低阶修士出没。深入其间，自有采药、机缘与凶险。",
    travelCost: 2,
    map: { x: 72, y: 28 },
    actions: ["explore"],
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
    desc: "门中弟子切磋武艺之处。厉飞雨常在此。可与同门切磋、打探门派内外的风声。",
    travelCost: 2,
    map: { x: 38, y: 40 },
    actions: ["spar"],
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
    desc: "七玄门山下的凡俗集镇。可用纹银采买丹药材料，听市井传闻，会会南来北往的人。",
    travelCost: 3,
    map: { x: 28, y: 78 },
    actions: ["market"],
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

  /* —— 离门远行章 · 嘉元城（岚州第一城）——
   * 制作度：活感优先——一个落脚地点+采买+休整即可，繁华由文本与风闻撑起。 */
  {
    id: "jiayuan_city",
    arc: "huangfeng",
    name: "嘉元城 · 墨府",
    desc: "岚州第一大城，街市喧腾，车马如流。你暂居墨府客房——这座朱门宅院近来门庭冷落，暗流涌动。",
    travelCost: 1,
    map: { x: 50, y: 60 },
    home: true,   // 旅居：可调息休整（墨府客房）
    actions: ["rest", "market", "cultivate"],
    encounters: [],
  },

  /* —— 离门远行章 · 太南小会（修仙者的集市）——
   * 考据：岚州最南太南山中，万小山在此为韩立讲修仙常识；丹药换长春功后篇全本。 */
  {
    id: "tainan_fair",
    arc: "huangfeng",
    name: "太南谷 · 小会",
    desc: "太南山深谷中的修仙者集市。摊位上灵光隐现，往来者皆遮掩行藏——凡人勿近之地，你头一回置身真正的修仙人之间。",
    travelCost: 1,
    map: { x: 50, y: 60 },
    actions: ["fair", "rest", "cultivate"],
    encounters: [],
  },

  /* —— 黄枫谷 · 外门居所（驻地章入口——百药园三年的主场，主体下版本铺开）—— */
  {
    id: "huangfeng_gate",
    arc: "huangfeng",
    name: "黄枫谷 · 外门居所",
    desc: "太岳山脉深处的仙家洞天。你领了外门弟子的居所与一身青衫——百药园的差事、筑基丹的恩怨，都在前头等着。",
    travelCost: 1,
    map: { x: 50, y: 40 },
    home: true,
    actions: ["cultivate", "breakthrough", "rest", "bottle", "alchemy"],
    encounters: [],
  },
];

/* ---------- 大陆层（world-architecture L0）：天南 · 越国一带 ----------
 * 铁律：全图早见（远方=惦记），限制可达的不是迷雾是旅途成本。
 * 节点的 locs 指向地区层 locations 组；gate 为道途门槛（未达则只可远望）。
 * 旅途卷轴实装前，未解锁节点点击仅展示"道途未通"与门槛说明。 */
/* 地理考据（凡人手册/原文，2026-06-11 核定）：
 * 镜州=越国西北部（贫困）；彩霞山=镜州第二大山，原名落凤山（五色彩凤化山传说）；
 * 建州=北部第二大州（多山丘陵人口稀少，北接元武国），西部太岳山脉连绵数千里，黄枫谷在焉，
 * 血色禁地在建州北部；岚州=南部产粮大州（第二富足），嘉元城=岚州第一城（岚州中部），
 * 广贵城=岚州最南（三面环山一面靠湖），太南山在广贵城西四十里；越京=越国京城（郊外白菊山）。
 * 节点 pos 与 assets/tiannan_map.png 地貌对位（西北五色峰=彩霞山）。 */
WORLD.continent = {
  name: "天南 · 越国",
  map: "tiannan_map",
  nodes: [
    { id: "caixia",   name: "彩霞山",  pos: { x: 17, y: 19 }, locs: ["yaolu", "houshan", "wuting", "town", "miju"],
      desc: "镜州第二大山，原名落凤山——传说古时一头五色彩凤落于此地，化作此山。七玄门据此百年，是你修仙路的起点。" },
    { id: "qingniu",  name: "青牛镇",  pos: { x: 26, y: 31 }, locs: [],
      desc: "七玄门治下的小镇，你的家乡就在镇郊五里沟。爹娘的白发，几亩薄田。", months: 1, danger: "低", visit: "home" },
    { id: "huangfeng", name: "黄枫谷", pos: { x: 56, y: 13 }, locs: ["huangfeng_gate"],
      desc: "越国七大仙门之一，居建州太岳山脉深处——此山脉连绵数千里，北接元武国。升仙令在手，此处便是你的去处。", months: 3, danger: "高",
      gate: (s) => State.count("shengxian_ling") > 0
        ? (s.flags.departure_complete ? null : (s.flags.arc1_complete ? "升仙大会未了（太南谷）——仙门入谷自有章程" : "七玄门之事未了"))
        : "无升仙令者，仙门不纳" },
    { id: "yuejing",  name: "越京",    pos: { x: 34, y: 50 }, locs: [],
      desc: "越国京城，凡俗繁华之极。郊外白菊山是赏景名胜。", months: 2, danger: "低",
      gate: (s) => s.flags.arc1_complete ? null : "七玄门之事未了" },
    { id: "jiayuan",  name: "嘉元城",  pos: { x: 44, y: 60 }, locs: ["jiayuan_city"],
      desc: "岚州第一大城。岚州居越国之南，沃野产粮，富庶仅次京畿——城中鱼龙混杂，传闻有修仙者出没。", months: 3, danger: "中",
      gate: (s) => s.flags.arc1_complete ? null : "七玄门之事未了" },
    { id: "tainangu", name: "太南谷",  pos: { x: 28, y: 80 }, locs: ["tainan_fair"],
      desc: "岚州最南端，广贵城西四十里的太南山中。修仙者的集市「太南小会」每隔数年在此举办，凡人勿近。", months: 4, danger: "中",
      gate: (s) => s.flags.arc1_complete ? null : "七玄门之事未了" },
    { id: "farsea",   name: "乱星海（极远）", pos: { x: 86, y: 42 }, locs: [], silhouette: true,
      desc: "天南以东的无尽海域，星罗万岛，妖修横行。路远得连舆图都画不全。" },
  ],
  routes: [
    { from: "caixia", to: "qingniu" },
    { from: "caixia", to: "huangfeng" },
    { from: "qingniu", to: "yuejing" },
    { from: "yuejing", to: "jiayuan" },
    { from: "yuejing", to: "huangfeng" },
    { from: "jiayuan", to: "tainangu" },
    { from: "caixia", to: "yuejing" },
  ],
};

/* ---------- 历练遭遇用的敌人模板（战斗 Fighter 配置，数据驱动攻击）----------
 * AI v1：每个敌人 2~3 种攻击意图 + tactics 战斗天赋（feral兽性/cunning算计/guarded守御），
 * 让每个敌人都是一道"解谜题"——读招应招，而非无脑互殴。weight 为选招权重。
 */
WORLD.enemies = {
  wild_wolf: {
    name: "灵狼", hp: 55, sense: 3, speed: 12, agility: 6, tactics: "feral", reward: { lingcao: 1 },
    attacks: [
      { name: "扑咬", dmg: 14, kind: "normal", weight: 14 },
      { name: "撕喉", dmg: 11, kind: "pierce", weight: 5 },
      { name: "弓背低嚎", dmg: 18, kind: "charge", weight: 6 },
    ],
  },
  outer_disciple: {
    name: "外门弟子", hp: 85, sense: 6, speed: 10, agility: 5, reward: { silver: 4 },
    attacks: [
      { name: "拳脚", dmg: 15, kind: "normal", weight: 14 },
      { name: "锁喉擒拿", dmg: 11, kind: "pierce", weight: 6 },
    ],
  },
  bandit: {
    name: "山贼", hp: 75, sense: 4, speed: 8, agility: 3, tactics: "feral", reward: { silver: 3 },
    attacks: [
      { name: "刀劈", dmg: 14, kind: "normal", weight: 14 },
      { name: "狠命抡刀", dmg: 20, kind: "charge", weight: 6 },
    ],
  },
  rogue_cultivator: {
    name: "散修", hp: 130, sense: 9, speed: 11, agility: 8, tactics: "cunning", qiLayer: 3, elem: "tu", reward: { lingshi: 1 },
    attacks: [
      { name: "土遁石击", dmg: 26, kind: "normal", weight: 12, elem: "tu" },
      { name: "法器贯刺", dmg: 20, kind: "pierce", weight: 8 },
      { name: "聚灵蓄势", dmg: 30, kind: "charge", weight: 5 },
    ],
  },
  wolf_gang_thug: {
    name: "野狼帮喽啰", hp: 95, sense: 5, speed: 9, agility: 4, reward: { silver: 6 },
    attacks: [
      { name: "狼牙棒", dmg: 17, kind: "normal", weight: 14 },
      { name: "横扫蓄力", dmg: 23, kind: "charge", weight: 6 },
    ],
  },

  /* —— 异闻妖王（听闻其名 → 深入后山 → 真实可战）：威名先至，名实一致。
   * 妖兽吐纳天地灵气，妖气亦有行属（elem）——传闻里就写明行属，做功课备克制符是正解。 —— */
  beast_baihu: {
    name: "白额吊睛虎", hp: 200, sense: 7, speed: 14, agility: 12, tactics: "feral", elem: "jin", nature: "beast",
    introNote: "正是异闻中那头噬人虎王！金风裂爪天克你的木行道基——爪疾力沉，血怒时必拼命扑杀。火符能灼其金煞，稳住护体，别贪刀。",
    attacks: [
      { name: "裂风虎爪", dmg: 26, kind: "normal", weight: 12, elem: "jin" },
      { name: "虎啸震林", dmg: 22, kind: "pierce", weight: 6 },
      { name: "血怒扑杀", dmg: 32, kind: "charge", weight: 7 },
    ],
    reward: { silver: 12 }, namedLoot: { huixue_dan: 2, lingcao: 2, huoshe_fu: 1 },
  },
  beast_wugong: {
    name: "铁背蜈蚣王", hp: 185, immunePoison: true, sense: 6, speed: 8, agility: 7, tactics: "cunning", elem: "tu", nature: "beast",
    introNote: "铁背蜈蚣王——土行厚甲、自身百毒不侵！你的毒计无用，但木气克土：长春功门下的法术正中其门，再以暗器破其节甲。",
    attacks: [
      { name: "百足绞缠", dmg: 22, kind: "normal", weight: 12 },
      { name: "毒牙噬咬", dmg: 26, kind: "pierce", weight: 8 },
    ],
    reward: { lingshi: 1 }, namedLoot: { duyao_cao: 4, anqi: 2 },
  },
  beast_chimu: {
    name: "赤目狼王", hp: 185, sense: 9, speed: 15, agility: 16, tactics: "feral", elem: "huo", nature: "beast",
    introNote: "赤目狼王——一身火煞，身法鬼魅难以捉摸！水克火，寒冰符是它的克星。它越是受伤越疯，看准蓄力回合全力压制。",
    attacks: [
      { name: "撕咬", dmg: 22, kind: "normal", weight: 12 },
      { name: "炎爪影袭", dmg: 18, kind: "pierce", weight: 7, elem: "huo" },
      { name: "狂性大发", dmg: 29, kind: "charge", weight: 8 },
    ],
    reward: { silver: 10 }, namedLoot: { lingshi: 2, huixue_dan: 1, hanbing_fu: 1 },
  },
};

/* ---------- 情报面纱：关键人物的可打探底细（L0 传闻 / L1 见过出手 / L2 买过底细） ----------
 * 强者的 build 可见但要"挣"：威名先至（L0 免费）→ 交手自动补全（L1）→ 花钱买底（L2 解锁弱点）。
 * L2 的实战回报：战斗开局即看穿其意图（做过功课 = 神识料敌首回合必中）。
 */
WORLD.intel = {
  jinguang: {
    l0: "修仙杀手，练气七层。受雇杀人，金光铸罩，凶名在外。",
    elem: "jin",
    moves: ["金符破空", "剑符斩", "金刚伏魔", "金钟罩·重聚"],
    l2: "弱点：金行道基天克木行功法，正面斗法万不可取。金钟罩固而不化——挡得住刀剑，挡不住入体之毒；火符可灼其金光；其人贪功冒进，蓄力时门户大开。",
  },
  jiatianlong: {
    l0: "野狼帮帮主，凡俗武人巅峰。野心勃勃，正图谋吞并七玄门。",
    moves: ["劈山掌", "狼牙横扫"],
    l2: "弱点：外门横练罩门在腋下三寸；其人多疑，帮中树敌不少，金光上人也未必真心助他。",
  },
  modafu: {
    l0: "门中医师，性情古怪。医毒双绝，深居简出。",
    elem: "mu",
    moves: ["毒掌", "腐骨毒针"],
    l2: "底细：他收徒的真意恐怕不在传艺——药庐密室常年阴气不散，夜里偶有尸臭。其功法与你同出一门（木行长春功），斗法无相克之利，胜负全看准备。早做防备。",
  },
};

/* 风云榜：彩霞山一带的江湖座次（石碑）。名实一致：榜上人物的强弱与游戏内数值一致。
 * 玩家凭 s.fame 攀榜——藏拙者榜上无名，正合其意；扬名者步步登高。
 * 王门主是背景型强者雏形：榜上有名、世人皆知，但你在本篇见不到他出全力。 */
WORLD.fameBoard = [
  { id: "jinguang",    name: "金光上人", title: "修仙杀手 · 金钟罩", fame: 120, note: "传闻刀枪不入，杀人越货。凡俗武人见之如见鬼神。" },
  { id: "menzhu",      name: "王门主",   title: "七玄门之主",        fame: 90,  note: "深不可测，常年闭关。野狼帮再猖狂，也不敢真攻上山门。" },
  { id: "modafu",      name: "墨大夫",   title: "七玄门 · 医毒双绝", fame: 85,  note: "门中老人讳莫如深。" },
  { id: "jiatianlong", name: "贾天龙",   title: "野狼帮帮主",        fame: 66,  note: "野心勃勃，广纳亡命。" },
  { id: "lifeiyu",     name: "厉飞雨",   title: "七玄门 · 后起之秀",  fame: 38,  note: "门派大比锋芒初露。" },
  { id: "yuelu",       name: "岳鹿道人", title: "云游散修",          fame: 22,  note: "来历不明的散修，在彩霞山一带出没。" },
];

/* 异闻池：投放到风云录/际遇的"有名有姓的猎物"——听闻在前，相遇在后 */
WORLD.beastRumors = [
  { id: "beast_baihu",  title: "白额虎王噬人", rumor: "集镇炸了锅：又一个采药人没回来。有人在后山深处见过一头白额吊睛猛虎，大如牛犊，眼有灵光。" },
  { id: "beast_wugong", title: "铁背蜈蚣成王", rumor: "猎户说后山岩缝里的铁背蜈蚣成了气候，甲壳泛着铁光，寻常刀剑斩上去只留一道白印。" },
  { id: "beast_chimu",  title: "赤目狼王啸月", rumor: "近来夜半常闻狼啸，凄厉非常。老人们说狼群有了新王，双目赤红，疾如鬼魅。" },
];

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
  {
    id: "mocaihuan", name: "墨彩环", role: "墨府小姐 · 故人之女",
    bio: "墨大夫（墨居仁）之女，嘉元城墨府的小姐。古灵精怪，娇憨狡黠，初见便骗走了你的萦香丸。她问过你一个你答不上来的问题：凡人，就真的不能修仙吗？",
    lines: ["黑小子，今天的药膳你又没喝完！", "爹的信里写了你好多坏话哦——骗你的啦。", "等你走了，这院子又要冷清下来了……"],
    where: ["jiayuan_city"], cond: (s) => s.flags.mo_met,
  },
  {
    id: "wanxiaoshan", name: "万小山", role: "散修 · 修仙世家子弟",
    bio: "修仙世家出身的年轻散修，心善热忱，不谙世事。太南小会上主动为你这个「雏儿」讲解修仙界的门道——他是你在修仙界遇到的第一个好人。",
    lines: ["韩兄，这摊上的符纸是真货，那摊的「灵丹」可千万别碰！", "我家祖上也阔过，传到我这辈就剩这点家底啦，哈哈。", "修仙人多凉薄，韩兄是个例外。"],
    where: ["tainan_fair"], cond: (s) => s.flags.wan_met,
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
