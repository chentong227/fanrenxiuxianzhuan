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
    actions: ["stroll", "rest", "market", "cultivate"],
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

  /* —— 黄枫谷（驻地章主场）：外门居所（修行）+ 百药园（差事/大帆主轴）—— */
  {
    id: "huangfeng_gate",
    arc: "huangfeng",
    name: "黄枫谷 · 外门居所",
    desc: "太岳山脉深处的仙家洞天。你领了外门弟子的居所与一身青衫——百药园的差事、筑基丹的恩怨，都在前头等着。",
    travelCost: 1,
    map: { x: 38, y: 36 },
    home: true,
    actions: ["cultivate", "breakthrough", "rest", "bottle", "alchemy"],
    encounters: [],
  },
  {
    id: "baiyao_yuan",
    arc: "huangfeng",
    name: "黄枫谷 · 百药园",
    desc: "谷东南向阳坡上的灵田药园，一畦畦灵草顺山势铺开。你的差事、你的私种、园角那间无人过问的旧丹房——三年家底，都从这里长出来。",
    travelCost: 1,
    map: { x: 64, y: 58 },
    unlock: (s) => s.flags.yaoyuan_started,
    actions: ["yaoyuan", "gather", "rest"],
    encounters: [],
  },
  {
    id: "fangshi",
    arc: "huangfeng",
    name: "黄枫谷 · 坊市",
    desc: "谷中弟子互通有无的坊市，万宝楼三层飞檐最是气派。法器灵符、丹方玉简，皆论灵石——修仙界的钱，在这里才花得出去。",
    travelCost: 1,
    map: { x: 30, y: 64 },
    unlock: (s) => s.flags.yaoyuan_started,
    actions: ["wanbao", "rest"],
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
 * 节点 pos 与 assets/maps/tiannan_map.png 地貌对位（西北五色峰=彩霞山）。 */
WORLD.continent = {
  name: "越国",
  atlasId: "yueguo",   // 舆图叶层：越国十三州（水墨舆图）属「天南」大区
  parent: "tiannan",
  map: "tiannan_map",
  nodes: [
    { id: "caixia",   name: "彩霞山",  pos: { x: 17, y: 19 }, locs: ["yaolu", "houshan", "wuting", "town", "miju"],
      desc: "镜州第二大山，原名落凤山——传说古时一头五色彩凤落于此地，化作此山。七玄门据此百年，是你修仙路的起点。" },
    { id: "qingniu",  name: "青牛镇",  pos: { x: 26, y: 31 }, locs: [],
      desc: "七玄门治下的小镇，你的家乡就在镇郊五里沟。爹娘的白发，几亩薄田。", months: 1, danger: "低", visit: "home" },
    { id: "huangfeng", name: "黄枫谷", pos: { x: 56, y: 13 }, locs: ["huangfeng_gate", "baiyao_yuan", "fangshi"],
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

/* ============================================================
 * 舆图（分层大地图）——人界 ▸ 大区 ▸ 国别/联盟 ▸ 据点
 * 参考 docs/ref-renjie-worldmap.png + world-architecture.md L0a/L0b/L0c。
 * 上层（人界/大区/国别）由 UI.openAtlas 通用渲染；越国(国别)叶层复用 WORLD.continent
 * 的水墨舆图与据点节点（UI.openContinent）。当前可达=越国，余皆「远眺」剪影
 * （考据红线：未实装大区只标名远观、不杜撰可达细节；信息面纱亦如是）。
 * 升级到一级，上一级缩为「远眺」入口——逐级下钻/上卷，永远知道身在何处、可往何方。
 * ============================================================ */
WORLD.atlas = {
  root: "renjie",
  levels: {
    // —— L0a 人界全图 ——
    renjie: {
      name: "人界", kind: "world", crumb: "人界",
      blurb: "你脚下这方天地。天南一隅是起点，乱星海、大晋、慕兰、天荒……皆在云水之外。",
      nodes: [
        { id: "tiannan", name: "天南", to: "tiannan", pos: { x: 22, y: 76 }, reach: true,
          desc: "人界西南一隅。越国、元武、紫金诸国与正魔两道犬牙交错——你的修行，从这里启程。" },
        { id: "luanxinghai", name: "乱星海", pos: { x: 60, y: 34 }, silhouette: true,
          desc: "天南以东的无尽海域，星罗万岛。古传送阵与天星城藏于其间——金雷竹、青竹蜂云剑的所在。" },
        { id: "dajin", name: "大晋", pos: { x: 82, y: 60 }, silhouette: true,
          desc: "人界东部巨陆，疆域万里、昆吾山高耸。元婴之后，方有资格踏足。" },
        { id: "mulan", name: "慕兰草原", pos: { x: 70, y: 86 }, silhouette: true,
          desc: "大晋以西的辽阔草原，慕兰异族游牧其上，与人族修士争锋不休。" },
        { id: "tianhuang", name: "天荒大陆", pos: { x: 14, y: 22 }, silhouette: true,
          desc: "西北极远的荒漠绝陆，灵族、妖族盘踞，乃渡劫飞升之地。路远得连舆图都画不全。" },
        { id: "jibei", name: "极北冰原", pos: { x: 42, y: 9 }, silhouette: true,
          desc: "人界最北的万里冰原，小极宫隐于风雪。" },
      ],
    },
    // —— L0b 大区图：天南多国格局 ——
    tiannan: {
      name: "天南", kind: "region", parent: "renjie", crumb: "天南",
      blurb: "天南多国格局——越国只是其中一隅。诸国并立，正魔两道犬牙交错。",
      nodes: [
        { id: "yueguo", name: "越国", to: "yueguo", pos: { x: 24, y: 30 }, reach: true,
          desc: "七玄门、黄枫谷所在之国。十三州山河，是你前半生的舞台。" },
        { id: "yuanwuguo", name: "元武国", pos: { x: 30, y: 14 }, silhouette: true,
          desc: "越国之北的大国，太岳山脉北麓与之接壤。" },
        { id: "zijinguo", name: "紫金国", pos: { x: 52, y: 40 }, silhouette: true,
          desc: "天南中部强国，亦修仙世家林立之地。" },
        { id: "chejiguo", name: "车骑国", pos: { x: 64, y: 22 }, silhouette: true,
          desc: "边境妖兽横行之国——练气士只身赴此，多半葬身兽口。看得见、去不了。" },
        { id: "jiuguomeng", name: "九国盟", pos: { x: 72, y: 58 }, silhouette: true,
          desc: "天南数国结成的修仙联盟，以御外侮、共抗魔道。" },
        { id: "zhengdaomeng", name: "正道盟", pos: { x: 46, y: 72 }, silhouette: true,
          desc: "魔道争锋之际，天南正道诸派结成的联盟。" },
        { id: "modao", name: "魔道六宗", pos: { x: 62, y: 84 }, silhouette: true,
          desc: "长生、合欢诸宗盘踞之地——魔道入侵的源头。" },
      ],
    },
    // —— L0c 国别图：越国 —— 复用 WORLD.continent（水墨舆图），由 UI.openContinent 渲染
  },
};

/* ---------- 历练遭遇用的敌人模板（战斗 Fighter 配置，数据驱动攻击）----------
 * AI v1：每个敌人 2~3 种攻击意图 + tactics 战斗天赋（feral兽性/cunning算计/guarded守御），
 * 让每个敌人都是一道"解谜题"——读招应招，而非无脑互殴。weight 为选招权重。
 */
/* 对阵轴字段（combat-axis-rules.md）：
 *   move 移动力；mp 法力/妖力池（修士技耗蓝，肉搏零耗）；
 *   攻击 aim：缺省=lock 锁头（盾挡）/ cell 打格子（亮格可躲，lunge=落空惯性冲入）/
 *   zone 范围（区间全体）；range 缺省按物性推断（妖兽[1,1]/修士[1,3]）。 */
WORLD.enemies = {
  wild_wolf: {
    name: "灵狼", hp: 55, sense: 3, speed: 12, agility: 6, move: 2, mp: 40, tactics: "feral",
    reward: { lingcao: 1 }, namedLoot: { langya_fang: 1 },   // 普通妖兽掉普通材料（妖材经济 v1）
    attacks: [
      { name: "扑咬", dmg: 14, kind: "normal", weight: 12, aim: "cell", lunge: true, range: [1, 3] },
      { name: "撕喉", dmg: 11, kind: "pierce", weight: 5 },
      { name: "弓背低嚎", dmg: 18, kind: "charge", weight: 6 },
    ],
  },
  outer_disciple: {
    name: "外门弟子", hp: 85, sense: 6, speed: 10, agility: 5, move: 2, mp: 40, reward: { silver: 4 },
    attacks: [
      { name: "拳脚", dmg: 15, kind: "normal", weight: 14, range: [1, 1] },
      { name: "锁喉擒拿", dmg: 11, kind: "pierce", weight: 6, range: [1, 1] },
    ],
  },
  bandit: {
    name: "山贼", hp: 75, sense: 4, speed: 8, agility: 3, move: 2, mp: 40, tactics: "feral", reward: { silver: 3 },
    attacks: [
      { name: "刀劈", dmg: 14, kind: "normal", weight: 14, range: [1, 1] },
      { name: "狠命抡刀", dmg: 20, kind: "charge", weight: 6, aim: "cell", range: [1, 1] },
    ],
  },
  rogue_cultivator: {
    // lane:1=法修天性缩在阵后放术（编队成立时生效；落单时引擎自动压上战位排——无敌龟壳不存在）
    name: "散修", hp: 130, sense: 9, speed: 11, agility: 8, move: 1, mp: 52, tactics: "cunning", qiLayer: 3, elem: "tu", armor: 2, lane: 1, reward: { lingshi: 1 },
    attacks: [
      { name: "土遁石击", dmg: 26, kind: "normal", weight: 12, elem: "tu", mp: 7 },
      { name: "法器贯刺", dmg: 20, kind: "pierce", weight: 8, mp: 8 },
      { name: "聚灵蓄势", dmg: 30, kind: "charge", weight: 5, mp: 12, range: [1, 4] },
    ],
  },
  wolf_gang_thug: {
    name: "野狼帮喽啰", hp: 95, sense: 5, speed: 9, agility: 4, move: 2, mp: 40, reward: { silver: 6 },
    attacks: [
      { name: "狼牙棒", dmg: 17, kind: "normal", weight: 14, range: [1, 1] },
      { name: "横扫蓄力", dmg: 23, kind: "charge", weight: 6, aim: "zone", zoneSpan: 1, range: [1, 2] },
    ],
  },

  /* —— 异闻妖王（听闻其名 → 深入后山 → 真实可战）：威名先至，名实一致。
   * 妖兽吐纳天地灵气，妖气亦有行属（elem）——传闻里就写明行属，做功课备克制符是正解。
   * 三型攻击各有其王：白虎=cell 扑杀（躲格）、蜈蚣=zone 毒雾（拉区间）、狼王=高速连动。 —— */
  beast_baihu: {
    name: "白额吊睛虎", hp: 240, sense: 7, speed: 14, agility: 12, move: 2, mp: 60, stubborn: true, tactics: "feral", elem: "jin", nature: "beast",
    introNote: "正是异闻中那头噬人虎王！金风裂爪天克你的木行道基——它的血怒扑杀会随你身形一折再扑，寻常一步躲不开：要么两步开外，要么趁它蓄势打断，要么举盾硬接。火符灼其金煞，别恋战。",
    attacks: [
      { name: "裂风虎爪", dmg: 30, kind: "normal", weight: 12, elem: "jin", range: [1, 1] },
      { name: "虎啸震林", dmg: 16, kind: "normal", weight: 6, aim: "zone", zoneSpan: 1, range: [1, 4] },
      { name: "血怒扑杀", dmg: 32, kind: "charge", weight: 7, aim: "cell", lunge: true, track: true, range: [1, 4] },
      { name: "腾身虎扑", dmg: 24, kind: "normal", weight: 6, elem: "jin", antiAir: true, range: [1, 2] },
    ],
    // 妖王掉妖材不掉成品：整皮+妖丹+骨（卖给万宝楼/留作大件料）——妖材经济 v1
    reward: { silver: 12 }, namedLoot: { hupi_jinwen: 1, yaodan_1: 1, shougu_bone: 2 },
  },
  beast_wugong: {
    name: "铁背蜈蚣王", hp: 185, immunePoison: true, sense: 6, speed: 8, agility: 7, move: 1, mp: 60, tactics: "cunning", elem: "tu", nature: "beast",
    introNote: "铁背蜈蚣王——土行厚甲、自身百毒不侵！你的毒计无用，但木气克土：长春功门下的法术正中其门。它的腥毒雾会罩住一片地界——拉出区间再打。",
    attacks: [
      { name: "百足绞缠", dmg: 22, kind: "normal", weight: 12, range: [1, 1] },
      { name: "毒牙噬咬", dmg: 26, kind: "pierce", weight: 8, range: [1, 1] },
      { name: "腥风毒雾", dmg: 15, kind: "normal", weight: 8, aim: "zone", zoneSpan: 1, range: [1, 4] },
    ],
    reward: { lingshi: 1 }, namedLoot: { tiebei_qiao: 2, yaodan_1: 1, duyao_cao: 2 },
  },
  /* —— 血色禁地（黄枫谷篇第三幕）—— */
  jindi_beast: {
    name: "血煞兽", hp: 130, sense: 6, speed: 12, agility: 8, move: 2, mp: 50, tactics: "feral", elem: "huo", nature: "beast",
    introNote: "禁地中游荡的血雾凶兽——通体赤红、嗜血成性。水克火，寒冰符正中其门。",
    attacks: [
      { name: "血爪", dmg: 22, kind: "normal", weight: 12, elem: "huo", range: [1, 1] },
      { name: "血雾喷吐", dmg: 14, kind: "normal", weight: 6, elem: "huo", aim: "zone", zoneSpan: 1, range: [1, 3] },
      { name: "嗜血扑杀", dmg: 26, kind: "charge", weight: 6, aim: "cell", lunge: true, range: [1, 3] },
    ],
    reward: { lingshi: 1 }, namedLoot: { xuesha_jing: 1 },
  },
  fengyue: {
    name: "封岳", hp: 235, sense: 14, speed: 15, agility: 11, move: 2, mp: 90, qiLayer: 13, elem: "jin", armor: 3,
    tactics: "cunning", stubborn: true,
    introNote: "黄枫谷的狙杀者封岳——靠猎杀同门换取资粮的亡命之徒。淬毒短刺又快又毒，踏云靴让他来去如风。他的「贯心刺」会追着你的身形折转，一步躲不开！",
    attacks: [
      { name: "淬毒短刺", dmg: 24, kind: "normal", weight: 12, elem: "jin", mp: 7 },
      { name: "穿喉一线", dmg: 20, kind: "pierce", weight: 8, mp: 9 },
      { name: "贯心刺", dmg: 30, kind: "charge", weight: 6, aim: "cell", track: true, mp: 12, range: [1, 4] },
    ],
    reward: { lingshi: 6 }, namedLoot: { tayun_xue: 1, anqi: 3 },
  },
  mojiao: {
    name: "墨蛟", hp: 270, sense: 9, speed: 13, agility: 9, move: 2, mp: 85, elem: "shui", nature: "beast",
    tactics: "feral", stubborn: true, canFlee: false, boss: true,
    introNote: "禁地深潭之主——通体墨鳞的蛟龙幼体，黑雾护体、利齿如戟！它的「泥流潜袭」会循着你的气息追击，一步躲不开：要么两步开外，要么趁它蓄势打断。鳞厚甲坚，破甲与符宝方是正解。",
    attacks: [
      { name: "撕咬", dmg: 26, kind: "normal", weight: 12, range: [1, 1] },
      // 横扫=蛟尾"扫"战位排（depth:front——僚位的她躲得掉）；毒雾/啸震类不标=默认"罩"全排
      { name: "横扫", dmg: 20, kind: "normal", weight: 7, aim: "zone", zoneSpan: 1, range: [1, 2], depth: "front" },
      { name: "水矢", dmg: 15, kind: "normal", weight: 7, elem: "shui", range: [2, 5], mp: 6 },
      { name: "泥流潜袭", dmg: 32, kind: "charge", weight: 7, aim: "cell", lunge: true, track: true, mp: 12, range: [1, 5] },
    ],
    armor: 5,
    // 大妖王=大件之源：角→乌龙夺、皮鳞→神风舟（bigitem 妖材→法宝链；动漫/原著：燕家堡代工）
    reward: { lingshi: 4 }, namedLoot: { mojiao_jiao: 1, mojiao_pi: 1, mojiao_lin: 3, xueshi_zhuyao: 2 },
  },

  beast_chimu: {
    name: "赤目狼王", hp: 185, sense: 9, speed: 19, agility: 16, move: 2, mp: 60, tactics: "feral", elem: "huo", nature: "beast",
    introNote: "赤目狼王——一身火煞，身法鬼魅快得只剩残影，稍有不慎便是连袭两击！水克火，寒冰符是它的克星。它越是受伤越疯，看准蓄力回合全力压制。",
    attacks: [
      { name: "撕咬", dmg: 22, kind: "normal", weight: 12, range: [1, 1] },
      { name: "炎爪影袭", dmg: 18, kind: "normal", weight: 7, elem: "huo", aim: "cell", lunge: true, range: [1, 3] },
      { name: "狂性大发", dmg: 29, kind: "charge", weight: 8 },
      // 对空压力：兽王腾身扑杀专咬低空——悬空不是免死金牌（antiAir 绕开空层滤招/挥空）
      { name: "凌空扑杀", dmg: 20, kind: "normal", weight: 6, elem: "huo", antiAir: true, range: [1, 2] },
    ],
    reward: { silver: 10 }, namedLoot: { chiyan_langpi: 1, yaodan_1: 1, langya_fang: 2 },
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
// clues：听闻→寻踪→相遇 的渐进铺垫（随月份在后山一带逐条浮现，逼近真相、酝酿"代入感"）
WORLD.beastRumors = [
  { id: "beast_baihu",  title: "白额虎王噬人",
    rumor: "集镇炸了锅：又一个采药人没回来。有人在后山深处见过一头白额吊睛猛虎，大如牛犊，眼有灵光。",
    clues: [
      "山民又抬回一具残尸，胸口三道爪痕深可见骨——后山那头白额虎，越发肆无忌惮了。",
      "你在后山溪畔见到一行碗大的虎爪印，泥里还嵌着半截碎裂的猎叉。脚印往密林深处去了。",
      "夜里风送来一声闷雷似的虎啸，惊起满林宿鸟。那畜生，就盘踞在不远处的后山深处。",
    ] },
  { id: "beast_wugong", title: "铁背蜈蚣成王",
    rumor: "猎户说后山岩缝里的铁背蜈蚣成了气候，甲壳泛着铁光，寻常刀剑斩上去只留一道白印。",
    clues: [
      "采石的力夫慌慌张张跑回镇里，说凿开的岩层里渗出墨绿黏液，腥臭刺鼻——那虫子蜕了壳。",
      "后山一处山坳的草木成片枯黄，地上残留着环节状的拖痕，足有水桶粗细。",
      "你在岩缝里拾到一片脱落的铁背甲壳，入手沉重冰凉，叩之铮然有声。它就蛰伏在这下面。",
    ] },
  { id: "beast_chimu",  title: "赤目狼王啸月",
    rumor: "近来夜半常闻狼啸，凄厉非常。老人们说狼群有了新王，双目赤红，疾如鬼魅。",
    clues: [
      "镇外的羊圈一夜被屠空，只余满地碎骨与赤色兽毛——狼群，是冲着人来的了。",
      "你在后山林间见到狼群环坐的痕迹，正中一行特大的足印——那狼王亲临过此地。",
      "满月之夜，一声长嗥撕开夜幕，群狼齐应。那双赤目，仿佛正从林影里盯着你。",
    ] },
];

/* ---------- 大件图鉴（第一公民系统总表，docs/bigitem-design.md）----------
 * 大件=节点非奖品：听闻→获取→开轴→里程碑→下一个入口。此处收拢散落各篇的大件，
 * 一表看全、明牌惦记、附「如何开启·获取」引导——治"机制间割裂"，不漏任何一件。
 * 每条 stat(s) 返回 { state:"got"|"track"|"unheard", prog?:{cur,max}, note? }；
 * far:true = 后续篇章的前路剪影（明牌惦记，尚不可得）。考据红线：忠于动漫版。
 */
WORLD.bigitemCats = [
  { id: "gongfa", name: "功法 · 剑意" },
  { id: "dan",    name: "丹道 · 药" },
  { id: "fabao",  name: "法宝 · 飞剑" },
  { id: "kuilei", name: "傀儡 · 灵宠" },
  { id: "jiban",  name: "羁绊 · 信物" },
  { id: "shijie", name: "世界 · 际遇" },
];
WORLD.bigitems = [
  // —— 七玄门篇（现行可得）——
  { id: "changchun", cat: "gongfa", name: "《长春功》",
    blurb: "立身之本。前篇止于练气七层，后篇兼载火弹御风诸般小法术，暗开「过目不忘」之效。",
    guide: "前篇——拜入七玄门、墨大夫授业即修；后篇全本——练气七层后，于太南小会以丹药换购。",
    stat: (s) => ({ state: "got", note: State.count("changchun_houpian") > 0 ? "已得后篇 · 八层之路已开" : "后篇待于太南小会换购" }) },
  { id: "zhayan", cat: "gongfa", name: "眨眼剑法 · 剑意",
    blurb: "七玄门篇的成长主轴。实战出剑磨砺剑意，圆满「悟剑」，大成解锁绝技「连环眨眼」。",
    guide: "厉飞雨一脉剑法（开局已习）——演武厅切磋、遭遇战出剑皆可累积剑意；满100回药庐闭关「悟剑」。",
    stat: (s) => s.swordMastery
      ? ({ state: "got", note: "已大成 · 连环眨眼（剑势上限+2）" })
      : ({ state: "track", prog: { cur: s.swordIntent || 0, max: 100 },
           note: (s.swordIntent || 0) >= 100 ? "剑意圆满 · 可回药庐悟剑" : "剑意 " + (s.swordIntent || 0) + "/100 · 出剑可磨" }) },
  { id: "bottle", cat: "dan", name: "小绿瓶",
    blurb: "催熟灵植的机缘至宝，自炼丹药的一切根基——开「催熟」轴（药圃经营）。",
    guide: "机缘获得——七玄门篇剧情中偶得的神秘小瓶，滴水可催熟灵植。",
    stat: (s) => (s.bottle && s.bottle.unlocked) ? ({ state: "got", note: "催熟轴已开 · 药圃可经营" }) : ({ state: "unheard", note: "机缘未至" }) },
  { id: "quhun", cat: "kuilei", name: "曲魂 · 铁奴",
    blurb: "你的第一具尸傀底牌，傀儡之路的原型——尸无血脉、百毒不侵，坏而不死可温养修缮。",
    guide: "夺舍之夜后，以秘法收服张铁尸身，炼成尸傀「铁奴」（墨大夫线收尾）。",
    stat: (s) => s.sideUnit ? ({ state: "got", note: s.sideUnit.name + (s.sideUnit.status === "broken" ? " · 损毁待修" : " · 随行听用") }) : ({ state: "unheard", note: "尚未收服" }) },
  { id: "keepsake", cat: "jiban", name: "唯一信物",
    blurb: "故人相赠、全局唯一的羁绊凭证——入图鉴留痕，不可转赠贩卖。养羁绊的有形回报。",
    guide: "与具名故人养到「交情深厚(≥20)」乃至「挚交(≥40)」，对方按身份一次性回赠贴身之物。",
    stat: (s) => {
      const max = Object.values(DATA.items).filter(i => i.keepsake).length || 6;
      const cur = (s.keepsakes || []).length;
      const names = (s.keepsakes || []).map(k => (DATA.items[k.id] ? DATA.items[k.id].name : k.id) + "（" + (k.fromName || "") + "）");
      return { state: cur >= max ? "got" : cur > 0 ? "track" : "unheard", prog: { cur, max },
        note: cur ? "已得：" + names.join("、") : "尚无故人以信物相托" };
    } },
  { id: "yiwen", cat: "shijie", name: "异闻妖王",
    blurb: "传闻→寻踪→伏诛的妖王猎杀链，伏诛掉落具名稀材——稀材即下一段大件链的入口。",
    guide: "身在彩霞山一带每月或有听闻；深入后山探索寻踪，踪迹了然后入深处与之一战。",
    stat: (s) => {
      const max = (WORLD.beastRumors || []).length || 3;
      const cur = (s.slainBeasts || []).length;
      const active = s.beastRumor && WORLD.enemies[s.beastRumor] ? WORLD.enemies[s.beastRumor].name : null;
      return { state: cur > 0 ? "got" : active ? "track" : "unheard", prog: { cur, max },
        note: active ? "正在追猎：" + active : cur ? "已伏诛 " + cur + " 头妖王" : "静待后山风声" };
    } },
  { id: "atlas", cat: "shijie", name: "舆图远行",
    blurb: "人界分层舆图——人界▸大区▸国别·联盟▸据点，一图到底，永远知道自己在何处、能去何方。",
    guide: "顶栏「舆图」常驻可览；通关七玄门篇后解锁跨城远行（嘉元城/越京/太南谷）。",
    stat: (s) => s.flags.arc1_complete
      ? ({ state: "got", note: "远行已开 · 行迹遍及 " + ((s.visitedNodes || []).length) + " 地" })
      : ({ state: "track", note: "舆图可览 · 跨城远行待通关本篇" }) },
  // —— 前路：后续篇章的大件剪影（明牌惦记，尚不可得）——
  { id: "qingyuanjian", cat: "gongfa", name: "《青元剑诀》", far: true,
    blurb: "黄枫谷剑修主轴——筑基之后真正的飞剑根基。",
    guide: "黄枫谷篇——筑基大成后，李化元大长老亲授。", stat: () => ({ state: "unheard" }) },
  { id: "zhujidan", cat: "dan", name: "筑基丹链", far: true,
    blurb: "三段式突破的超大件——从让丹的屈辱起点，到自炼成丹的扬眉一刻。",
    guide: "黄枫谷篇——让丹屈辱→血色禁地取药→地火之屋自炼，三段缺一不可。", stat: () => ({ state: "unheard" }) },
  { id: "yuzhizhu", cat: "kuilei", name: "灵宠之缘", far: true,
    blurb: "可养成的灵宠（玉蜘蛛之属），开灵宠成长轴。",
    guide: "黄枫谷篇——灵宠之缘（名称·获取以动漫版为准）。", stat: () => ({ state: "unheard" }) },
  { id: "fengyunjian", cat: "fabao", name: "青竹蜂云剑", far: true,
    blurb: "大件范式原型——神识驭剑 1→9→36→72，轴尽头亮出大庚剑阵的路子。",
    guide: "黄枫谷取炼制之法→分步收集材料(每步有剧情)→乱星海炼成。", stat: () => ({ state: "unheard" }) },
  { id: "pixieshenlei", cat: "fabao", name: "辟邪神雷", far: true,
    blurb: "特攻区大件·克魔功——与蜂云剑双底牌，以下克上的杀手锏。",
    guide: "乱星海篇——机缘所得，克魔利器。", stat: () => ({ state: "unheard" }) },
  { id: "shenfengzhou", cat: "fabao", name: "乌龙夺 · 神风舟", far: true,
    blurb: "墨蛟之材炼成：乌龙夺(重击法宝)、神风舟(飞行载具，与空层战斗咬合)。",
    guide: "伏诛墨蛟得角·皮·鳞→魔道争锋篇燕家堡代工炼制。", stat: () => ({ state: "unheard" }) },
  { id: "fengleichi", cat: "fabao", name: "风雷翅", far: true,
    blurb: "速度均势区至宝——遁速翻倍的飞行至宝。",
    guide: "乱星海篇——金雷竹炼制（协助紫灵九死一生的任务线）。", stat: () => ({ state: "unheard" }) },
  { id: "dageng", cat: "fabao", name: "大庚剑阵", far: true,
    blurb: "控剑轴尽头的兑现——七十二剑齐御，方能催动的杀阵。",
    guide: "重返天南篇——青竹蜂云剑控剑轴走到尽头后解锁。", stat: () => ({ state: "unheard" }) },
  { id: "yufengche", cat: "fabao", name: "御风车", far: true,
    blurb: "元婴期速度区至宝。",
    guide: "重返天南篇——元婴大战穆兰之后所得。", stat: () => ({ state: "unheard" }) },
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
    where: ["town", "houshan"], cond: (s) => s.flags.gang_war && !s.flags.jinguang_dead,
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
  {
    id: "wushishu", name: "吴师叔", role: "黄枫谷 · 引路前辈",
    bio: "领新弟子入谷的温和前辈，筑基初期。不嫌你伪灵根，处处提点——夺丹之日，满殿只有他为你出过头。谷中第一个对你好的人。",
    lines: ["本分修行，谁也难为不了你。", "丹田里的气走岔了就来寻我，别硬挺。", "叶师叔那边……你少去招惹，听我的。"],
    where: ["huangfeng_gate"], cond: (s) => s.flags.hf_arrived,
  },
  {
    id: "luyunfeng", name: "陆云风", role: "黄枫谷 · 内门弟子",
    bio: "锦袍倨傲的内门弟子。太南小会上被你抢先换走法宝残片，怀恨至今；执事殿发难欲夺你的筑基丹未遂。睚眦必报之人——这道梁子，结得不浅。",
    lines: ["（他斜睨你一眼，嗤笑着别过头去）", "四灵根的杂役，也配走在这条道上？"],
    where: ["huangfeng_gate"], cond: (s) => s.flags.zhuji_dan_stolen && !s.flags.luyunfeng_dead,
  },
  {
    id: "yeshishu", name: "叶师叔", role: "黄枫谷 · 长老",
    bio: "鹰目薄唇的青袍老者，筑基中期。借「调解」之名换走你的筑基丹，满殿无人敢言。深谋老辣，在谷中树大根深——你直觉此人藏着更深的东西。",
    lines: ["（他从廊下踱过，目光在你身上停了一瞬，意味难明）"],
    where: ["huangfeng_gate"], cond: (s) => s.flags.zhuji_dan_stolen && !s.flags.yeshishu_dead,
  },
  {
    id: "mashibo", name: "马师伯", role: "百药园 · 管园",
    bio: "黑瘦干瘪的看园老者，刀子嘴豆腐心。你初到便凭药理让他另眼相看，把心尖子的青元参苗交了给你。对药草是真心，对人——大概也是。",
    lines: ["参苗盖草帘了没有？没盖就滚去盖。", "你这手辨药的功夫，跟哪个学的……还行。", "例钱在房梁上，自己取，少一个子儿算老夫的。"],
    where: ["baiyao_yuan"], cond: (s) => s.flags.yaoyuan_started,
  },
  {
    id: "wanbao_zhanggui", name: "万宝楼掌柜", role: "坊市 · 掌柜",
    bio: "黄枫谷坊市万宝楼的掌柜，八面玲珑，无货不卖。楼上二层陈着几件筑基期方可驱使的好法器——金蚨子母刃、玄铁巨盾、飞行巨剑，价钱也配得上它们的成色。",
    lines: ["客官面生——头回来万宝楼吧？楼上请，好东西都在二层。", "灵石管够的话，没有老朽弄不来的货。", "二层那几件？呵，先筑了基，再谈价钱不迟。"],
    where: ["fangshi"], cond: (s) => s.flags.yaoyuan_started,
  },
  {
    id: "xiangzhili", name: "向之礼", role: "谷中老修 · 深不可测",
    bio: "常在坊市与药园间闲逛的青衫老修，自称练气杂役，谷中无人在意他。可他随口一句闲谈，往往切中要害——血色禁地的门道，他熟稔得不像个杂役。你直觉：此老身上的平静，深得见不到底。",
    lines: ["小友又在攒家底？嗯，是个稳当性子。", "血色禁地么……去得，也回得来——只看你贪不贪。", "（他眯眼晒着太阳，仿佛谷中百年风雨都与他无关）"],
    where: ["fangshi", "baiyao_yuan"], cond: (s) => s.flags.yaoyuan_started,
  },
  {
    id: "nangongwan", name: "南宫婉", role: "掩月宗 · 天之骄女",
    bio: "掩月宗百年一遇的天才女修，姿容明艳不可方物，眼神却清冷矜贵。血色禁地中她压制修为与你并肩斩蛟——「我叫韩立，立碑的立。」你说这话时，她笑了一下。",
    lines: ["（她看了你一眼，没有说话）", "韩师弟的符宝，用得很准。", "禁地一别，后会有期。"],
    where: ["huangfeng_gate"], cond: (s) => !!s.flags.mojiao_slain,
  },
  {
    id: "lihuayuan", name: "李化元", role: "黄枫谷 · 首席大长老",
    bio: "黄枫谷首席大长老，结丹大修士——入谷时同门口中的「李师祖」，名额会上亲自分配禁地名额的那位老人。墨蛟之战后，他破例收你为记名弟子。",
    lines: ["伪灵根能走到这一步，老夫有些意外。", "筑基之后，来寻老夫。", "心性比资质难得，你两样都有。"],
    where: ["huangfeng_gate"], cond: (s) => !!s.flags.xueshi_opened,
  },
  {
    id: "chenqiaoqian", name: "陈巧倩", role: "黄枫谷 · 师姐",
    bio: "黄枫谷陈家的师姐，眉目清冷。坊市归途那夜之后，她欠你一条命，你欠她一个无法回答的问题。自那以后，她待人愈发疏离——除了你。",
    lines: ["韩师弟。……没什么，顺路。", "丹方若缺药引，陈家药圃或可匀你一些。", "（她欲言又止，最终只是颔首而过）"],
    where: ["fangshi", "baiyao_yuan"], cond: (s) => s.flags.luyunfeng_dead,
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
