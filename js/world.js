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
    // 潜修洞府：夜里安静，夜虫领奏（韩立入门那股劲儿，不一直放乐）；2.5D 前景＝室内框（梁柱收口·暖黑），远雾偏淡
    env: { phase: "night", amb: "night", depth: { fg: "interior", far: 0.3 } },
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
    // 山野户外：随季——冬雪/夏雨/余晴（落粒子+染色）；2.5D 前景＝近景枝叶框（不被染、快漂），远雾偏淡
    env: { outdoor: true, depth: { fg: "forest", far: 0.4 } },
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
    // 殿堂切磋：2.5D 前景＝演武厅殿堂框（上檐+左右石柱），远雾偏淡
    env: { depth: { fg: "hall", far: 0.32 } },
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
    // 凡俗集镇：2.5D 前景＝坊市框（幌子檐影+暖灯晕），远雾中等（街市烟火气）
    env: { depth: { fg: "market", far: 0.4 } },
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
    // 阴气森森：夜雾冷色诡谧，amb:null 静默不放床（留 tense BGM）；
    // 2.5D 前景＝近景洞口岩壁框（"从洞里往外看"的纵深，不被染、快漂），远雾偏浓
    env: { phase: "night", weather: "fog", amb: null, depth: { fg: "cave", far: 0.6 } },
    actions: ["investigate"],
    unlock: (s) => s.flags.qi_layer_4,   // 修到练气四层、起疑后才会去探
    encounters: [],
  },

  /* —— 离门远行章 · 嘉元城（岚州第一城）—— 地点屏（非箱庭）：专属背景＋城味行动＋复访变迁拉区分度。
   * 箱庭只留战斗探索区（John 裁决）；复访风味单一数据源＝据点风味 ExploreMap.MAPS.jiayuan_city_l1。 */
  {
    id: "jiayuan_city",
    arc: "huangfeng",
    name: "嘉元城 · 墨府",
    desc: "岚州第一大城，街市喧腾，车马如流。你暂居墨府客房——这座朱门宅院近来门庭冷落，暗流涌动。",
    travelCost: 1,
    map: { x: 50, y: 60 },
    home: true,   // 旅居：可调息休整（墨府客房）
    // 岚州第一大城·街市喧腾：2.5D 前景＝坊市框（幌子檐影+暖灯晕），远雾中等（城郭烟尘）
    env: { depth: { fg: "market", far: 0.42 } },
    actions: ["market", "board", "rumor", "rest", "cultivate"],
    // 城味行动名（一眼区别七玄门）：长街/告示/风声 把繁华与暗流用市井语写活
    actionLabels: {
      market: "逛长街坊市 · 采买 🏮",
      board: "细读城门告示 📜",
      rumor: "城南堂口 · 探风声 🗡",
      rest: "回墨府客房 · 调息",
      cultivate: "客房打坐 · 潜修",
    },
    // 复访变迁：地点描述随剧情 flag 改写（取墨府风味）；告示/风声各引一据点节点的 read 文
    flavorRef: { map: "jiayuan_city_l1", node: "mofu" },
    reads: { board: "chengmen", rumor: "tangkou" },
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
    // 深谷修仙集市：2.5D 前景＝纯雾框（四缘灰白雾气合拢·灵光隐现），远雾极浓
    env: { depth: { fg: "mist", far: 0.68 } },
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
    // 外门居所·潜修洞天：2.5D 前景＝室内框（梁柱收口·暖黑），远雾偏淡
    env: { depth: { fg: "interior", far: 0.34 } },
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
    // 向阳坡灵田：2.5D 前景＝山野框（底两角近岩·开阔），远雾偏浓（山间空气透视）
    env: { depth: { fg: "mountain", far: 0.5 } },
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
    // 谷中坊市·万宝楼飞檐：2.5D 前景＝坊市框（飞檐幌影+暖灯晕），远雾中等
    env: { depth: { fg: "market", far: 0.42 } },
    actions: ["wanbao", "rest"],
    encounters: [],
  },

  /* —— 元武国 · 百艺坊（黄枫谷篇起永久可进：剧情真到访过的地点即做成永久据点）——
   *   考据：太岳山脉以北的邻国，巧匠齐云霄在此；韩立洞府落定后真往代工（神风舟/乌龙夺/颠倒五行阵基础版），
   *   首访不遇辛如音（modao-design 裁决3；faction-timeline §8 元武国到访×3 之首）。 */
  {
    id: "yuanwu",
    arc: "huangfeng",
    name: "元武国 · 百艺坊",
    desc: "太岳山脉那头的邻国，比胥国更尚武，炼器炉火彻夜不熄。坊市街尾那间「百艺坊」招牌不大，名头却响——巧匠齐云霄一炉好风火，墨蛟皮、千年灵草这等好料，到了他手里才不算糟蹋。",
    travelCost: 2,
    map: { x: 50, y: 30 },
    unlock: (s) => s.flags.dongfu_done,
    // 邻国百艺坊·炼器炉火：2.5D 前景＝坊市框（街尾檐影+炉火暖晕），远雾中等
    env: { depth: { fg: "market", far: 0.4 } },
    actions: ["rest"],
    encounters: [],
  },

  /* —— 魔道争锋篇·前置（增量D）——
   *   燕家堡：天南正道七派齐聚御魔的临时大堡（⚠燕家堡≠天阙堡，modao-design 考据红线）。
   *   李化元一纸调令把伪灵根筑基的韩立也压了进来——战王蝉破阵的血夜由此而起。过场地点，循剧情前行。 */
  {
    id: "yanjiabao", arc: "modao", scene: true,
    name: "燕家堡",
    desc: "魔道入侵前夜，天南正道七派齐聚的临时大堡。堡墙旌旗猎猎，堡内人心惶惶——李化元一纸调令，连你这伪灵根筑基也压了进来。堡外妖氛冲天，魔道巨擘战王蝉，正在破阵。",
    travelCost: 1, actions: [], encounters: [],
  },
  /* 魔道前线·待命营：燕家堡血战后随正道残部退守的前线据点。非过场（home:true 出闭关/调息），
   * 但暂无 map（不入云游列表）——「被七派强征入伍·等候征调」的留白，矿道箱庭随增量E开。 */
  {
    id: "modao_front", arc: "modao",
    name: "魔道前线 · 待命营",
    desc: "燕家堡一夜血战后，你随溃退的正道残部退守前线营地。七派强征入伍的旗令已下——且闭关调息、等候征调，下一道军令不知落在天南哪一处的矿道。（第一幕·烽火征调随后续版本开启）",
    travelCost: 1,
    home: true,
    // 前线待命营·闭关调息：2.5D 前景＝营帐内框（梁柱收口·沉黑），远雾偏浓（前线肃杀）
    env: { depth: { fg: "interior", far: 0.42 } },
    actions: ["cultivate", "breakthrough", "rest", "bottle", "alchemy"],
    encounters: [],
  },

  /* —— 再别天南篇（衔接过场大章·ep47~63）场景地点 ——
   *   过场地点，循剧情前行（非云游列表·由剧情 onArrive 落点）。考据见 docs/zaibie-tiannan-design.md。 */
  {
    id: "jinguyuan", arc: "zaibie", scene: true,
    name: "金鼓原",
    desc: "天南正道与魔道大军决战的旷野——战鼓如雷、血染黄沙。黑煞教倾巢而出，灵兽山倒戈反水，正道节节败退。李化元燃尽残命布下的护山大阵，是这溃局里最后一道光。",
    travelCost: 1, actions: [], encounters: [],
  },
  {
    id: "yuekuang", arc: "zaibie", scene: true,
    name: "越国矿洞 · 古传送阵",
    desc: "胥国边陲一座废弃矿洞的最深处，藏着一座尘封万载的古传送阵。残破的阵纹仍透着幽光——辛如音耗尽精血补全的修复图纸、加上大挪移令，便能强启这跨域大阵，一步踏出天南。身后，魔道的追兵已踏碎洞口。",
    travelCost: 1, actions: [], encounters: [],
  },
  {
    id: "luanxinghai", arc: "zaibie", scene: true,
    name: "乱星海",
    desc: "古阵崩毁的洪流把你抛入一片无边无际的汪洋——海天一色，星罗万岛，妖氛弥漫天际。这便是传说中的乱星海，天南以东的无尽海域。你孤身一人，落在了一个全然陌生的天地。",
    travelCost: 1, actions: [], encounters: [],
  },

  /* —— 初入星海篇（动漫年番·镇妖大典脊柱·ep61~76）地点 · 乱星海 6 点阵 ——
   *   首次解锁天南之外的全新海图（world-architecture 新大陆层）。可游 home/猎场按 map 入云游列表，
   *   纯演出节点（事变/炸岛）置 scene:true 由剧情 onArrive 落点。考据见 docs/lore-churu-xinghai.md。 */
  {
    id: "kuixing_island", arc: "starsea",
    name: "魁星岛",
    desc: "乱星海西南缘的一座外星岛，韩立携曲魂落海后登陆的首站。岛上顾家坐地经营，镇妖台擂台日日有妖兽相搏——藏拙赢上一场，便能换得一纸居留。逆星盟的黑袍乌丑，也在这岛上鬼祟出没。",
    travelCost: 1,
    home: true,
    // 乱星海外岛·镇妖台：2.5D 前景＝水景框（底缘水汀+两角岸影·冷碧），远雾偏浓（海天一色）
    env: { depth: { fg: "water", far: 0.5 } },
    actions: ["cultivate", "rest", "bottle"],
    map: { x: 27, y: 67 },
    encounters: [],
  },
  {
    id: "xiaohuan_island", arc: "starsea",
    name: "小寰岛",
    desc: "一座荒僻无人的外岛，韩立择此辟洞府闭关。借三转重元功散功重修、一转之后真元愈纯，筑基修为重攀巅峰；岛畔礁缝里那只贪金的灵虫，日后便是他护身的噬金虫。",
    travelCost: 2,
    home: true,
    // 荒岛洞府·岛畔礁缝：2.5D 前景＝水景框（底缘礁汀+冷碧水气），远雾偏浓（孤岛海雾）
    env: { depth: { fg: "water", far: 0.5 } },
    actions: ["cultivate", "breakthrough", "rest", "bottle", "alchemy"],
    map: { x: 15, y: 45 },
    unlock: (s) => !!(s.flags && s.flags.kuixing_resident),
    encounters: [],
  },
  {
    id: "xinghai_tongdao", arc: "starsea", scene: true,
    name: "内外星海通道",
    desc: "镇妖大典惊变之夜，乌丑勾结风希、六连殿反水长老炸开镇妖台，连同封镇百年的雷鹏一并放出，更轰开了这道内外星海之间的天然壁障。自此外海妖兽长驱涌入内海，乱星海大乱由此而起。",
    travelCost: 1, actions: [], encounters: [],
  },
  {
    id: "waixinghai", arc: "starsea",
    name: "外星海猎场",
    desc: "内星海防御大阵失效后，韩立顺势远赴外星海猎妖取丹。这片海域妖兽横行、人迹罕至，却也遍地是财——以霓裳草引妖、放噬金虫群猎杀，六七级妖丹论颗装袋，正是他发家结丹的资粮。",
    travelCost: 3,
    // 外星海猎场：2.5D 前景＝水景框（底缘水汀+两角岸影·冷碧），远雾偏浓（海天一色）
    env: { depth: { fg: "water", far: 0.55 } },
    actions: ["rest", "cultivate"],
    map: { x: 81, y: 53 },
    unlock: (s) => !!(s.flags && s.flags.luanxinghai_chaos),
    encounters: [],
  },
  {
    id: "jiyin_island", arc: "starsea", scene: true,
    name: "极阴岛",
    desc: "逆星盟极阴祖师一脉的老巢、乌丑的根脚所在。星宫大长老金魁孤身踏临、当众示威、一炮轰碎此岛——这是星宫着手收复内星海的起点，也是乱星海风云再变的先声（背景演出）。",
    travelCost: 1, actions: [], encounters: [],
  },
  {
    id: "tianxing_city", arc: "starsea",
    name: "天星城",
    desc: "内星海中枢的修仙大都会，星宫治下、坊市林立。韩立携外海挣下的妖丹与降尘丹返此苦修叩关——首番结丹铩羽，再以觅长生之姿择吉布坛、九死渡劫，终成金丹大成。",
    travelCost: 3,
    home: true,
    // 内星海中枢大都会·坊市林立：2.5D 前景＝坊市框（飞檐幌影+暖灯晕），远雾偏浓（星海都会）
    env: { depth: { fg: "market", far: 0.45 } },
    actions: ["cultivate", "breakthrough", "rest", "alchemy"],
    map: { x: 52, y: 36 },
    unlock: (s) => !!(s.flags && s.flags.tianxing_open),
    encounters: [],
  },
];

/* ---------- 大陆层（world-architecture L0）：天南 · 胥国一带 ----------
 * 铁律：全图早见（远方=惦记），限制可达的不是迷雾是旅途成本。
 * 节点的 locs 指向地区层 locations 组；gate 为道途门槛（未达则只可远望）。
 * 旅途卷轴实装前，未解锁节点点击仅展示"道途未通"与门槛说明。 */
/* 地理考据（凡人手册/原文，2026-06-11 核定）：
 * （动画将越国改称胥国，本作从之——以下「胥国」即原著越国；越京等地名不改）
 * 镜州=胥国西北部（贫困）；彩霞山=镜州第二大山，原名落凤山（五色彩凤化山传说）；
 * 建州=北部第二大州（多山丘陵人口稀少，北接元武国），西部太岳山脉连绵数千里，黄枫谷在焉，
 * 血色禁地在建州北部；岚州=南部产粮大州（第二富足），嘉元城=岚州第一城（岚州中部），
 * 广贵城=岚州最南（三面环山一面靠湖），太南山在广贵城西四十里；越京=胥国京城（郊外白菊山）。
 * 节点 pos 与 assets/maps/tiannan_map.png 地貌对位（西北五色峰=彩霞山）。 */
WORLD.continent = {
  name: "胥国",
  atlasId: "yueguo",   // 舆图叶层：胥国（动画即原著越国）十三州（水墨舆图）属「天南」大区
  parent: "tiannan",
  map: "tiannan_map",
  nodes: [
    { id: "caixia",   name: "彩霞山",  pos: { x: 17, y: 19 }, locs: ["yaolu", "houshan", "wuting", "town", "miju"],
      desc: "镜州第二大山，原名落凤山——传说古时一头五色彩凤落于此地，化作此山。七玄门据此百年，是你修仙路的起点。" },
    { id: "qingniu",  name: "青牛镇",  pos: { x: 26, y: 31 }, locs: [],
      desc: "七玄门治下的小镇，你的家乡就在镇郊五里沟。爹娘的白发，几亩薄田。", months: 1, danger: "低", visit: "home" },
    { id: "huangfeng", name: "黄枫谷", pos: { x: 56, y: 13 }, locs: ["huangfeng_gate", "baiyao_yuan", "fangshi"],
      faction: "qipai", factionByEpoch: { 1: "neutral" },
      nameByEpoch: { 1: "黄枫谷旧址" }, ruinByEpoch: { 1: true },
      descByEpoch: { 1: "黄枫谷旧址——魔道入侵后，黄枫谷携门人远遁南方北凉国重立山门，太岳山脉深处只余断壁颓垣。" },
      desc: "胥国七大仙门之一，居建州太岳山脉深处——此山脉连绵数千里，北接元武国。升仙令在手，此处便是你的去处。", months: 3, danger: "高",
      gate: (s) => State.count("shengxian_ling") > 0
        ? (s.flags.departure_complete ? null : (s.flags.arc1_complete ? "升仙大会未了（太南谷）——仙门入谷自有章程" : "七玄门之事未了"))
        : "无升仙令者，仙门不纳" },
    // —— 元武国（邻国·黄枫谷篇起永久可进）：太岳山脉以北，齐云霄百艺坊所在。洞府落定后开通北行。
    { id: "yuanwu",   name: "元武国",  pos: { x: 64, y: 5 }, locs: ["yuanwu"],
      factionByEpoch: { 1: "modao" },
      desc: "胥国之北、太岳山脉那头的邻国，比胥国更尚武。黄枫谷北面群山之外便是元武国——巧匠齐云霄的「百艺坊」在此，墨蛟皮、千年灵草这等好料，寻他代工最相宜。", months: 2, danger: "中",
      gate: (s) => s.flags.dongfu_done ? null : "太岳山脉以北的邻国——黄枫谷洞府落定、有了北行的由头，方可前往" },
    { id: "yuejing",  name: "越京",    pos: { x: 34, y: 50 }, locs: [],
      desc: "胥国京城，凡俗繁华之极。郊外白菊山是赏景名胜。", months: 2, danger: "低",
      gate: (s) => s.flags.arc1_complete ? null : "七玄门之事未了" },
    { id: "jiayuan",  name: "嘉元城",  pos: { x: 44, y: 60 }, locs: ["jiayuan_city"],
      desc: "岚州第一大城。岚州居胥国之南，沃野产粮，富庶仅次京畿——城中鱼龙混杂，传闻有修仙者出没。", months: 3, danger: "中",
      gate: (s) => s.flags.arc1_complete ? null : "七玄门之事未了" },
    { id: "tainangu", name: "太南谷",  pos: { x: 28, y: 80 }, locs: ["tainan_fair"],
      desc: "岚州最南端，广贵城西四十里的太南山中。修仙者的集市「太南小会」每隔数年在此举办，凡人勿近。", months: 4, danger: "中",
      gate: (s) => s.flags.arc1_complete ? null : "七玄门之事未了" },
    // —— 胥国七派（L3 宗门级势力，§9）：黄枫谷之外六派——远观剪影（未到访不造假据点），
    //   开「势力」时按宗门势力染色；魔道入侵（纪元1）灵兽山/天阙堡叛变归魔道，黄枫谷战败远遁北凉（旧址），余派坚守仍属七派。
    { id: "yanyue",  name: "掩月宗", pos: { x: 67, y: 30 }, locs: [], silhouette: true,
      faction: "qipai",
      desc: "胥国七派之首，脱胎于魔道合欢宗，七派中最强——远观之地，且记在心头。" },
    { id: "lingshou", name: "灵兽山", pos: { x: 76, y: 53 }, locs: [], silhouette: true,
      faction: "qipai", factionByEpoch: { 1: "modao" },
      desc: "胥国七派之一。法宝兽之道第一——据传乃魔道御灵宗埋下的千年暗桩，魔道入侵时反水。远观之地，且记在心头。" },
    { id: "tianque", name: "天阙堡", pos: { x: 60, y: 44 }, locs: [], silhouette: true,
      faction: "qipai", factionByEpoch: { 1: "modao" },
      desc: "胥国七派之一。动画中魔道入侵时亦随之投敌——远观之地，且记在心头。" },
    { id: "qingxu",  name: "清虚门", pos: { x: 49, y: 35 }, locs: [], silhouette: true,
      faction: "qipai",
      desc: "胥国七派之一——远观之地，且记在心头。" },
    { id: "huadao",  name: "化刀坞", pos: { x: 40, y: 24 }, locs: [], silhouette: true,
      faction: "qipai",
      desc: "胥国七派之一——远观之地，且记在心头。" },
    { id: "jujian",  name: "巨剑门", pos: { x: 52, y: 71 }, locs: [], silhouette: true,
      faction: "qipai",
      desc: "胥国七派之一——远观之地，且记在心头。" },
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
    { from: "huangfeng", to: "yuanwu" },
  ],
  /* —— L3 州块（v147 §10.4「拆越国→镜/建/岚州」）：凡俗政区，叠在胥国水墨图上的州界区块（非破坏，底图零改）。
   *   区分度：L3＝块状州界（点州看一州城·宗），L4＝点状城/宗（点钉启程/下钻 L5）。
   *   canon（§6.3，≥2 源：凡人手册·地理篇 + 动画/原著）：镜州=西北贫州（彩霞山·七玄门起点）；
   *   建州=东北多山、北接元武国（太岳山脉·黄枫谷·血色禁地）；岚州=南部产粮富州（嘉元城·太南谷）；
   *   京畿=越京京城（郊白菊山）。其余诸州（越国共十三州）此处从略，远观为「诸州」。
   *   poly/label＝% 坐标，与 tiannan_map.png 地貌方位对位；七派据点按方位归州（L3 起可原创）。 */
  prefectures: [
    { id: "jingzhou", name: "镜州", poly: "6,7 40,7 33,40 23,49 6,46", label: { x: 14, y: 12 },
      nodes: ["caixia", "qingniu"],
      desc: "胥国西北贫州，山多田瘠。镜州第二大山彩霞山（原名落凤山）在此，七玄门据此百年——韩立修仙路的起点。" },
    { id: "jianzhou", name: "建州", poly: "40,7 82,9 82,45 52,44 33,40", label: { x: 70, y: 13 },
      nodes: ["huadao", "huangfeng", "qingxu", "tianque", "yanyue"],
      desc: "胥国东北第二大州，山丘连绵、人口稀少，北与元武国接壤。太岳山脉横亘数千里，黄枫谷与血色禁地俱在其中。" },
    { id: "jingji", name: "京畿", poly: "33,40 52,44 50,57 30,57 23,49", label: { x: 30, y: 46 },
      nodes: ["yuejing"],
      desc: "胥国京城越京所在，凡俗繁华之极、王畿重地。郊外白菊山为赏景名胜，富庶冠绝诸州。" },
    { id: "lanzhou", name: "岚州", poly: "6,46 23,49 30,57 50,57 52,44 82,45 82,90 8,90", label: { x: 66, y: 80 },
      nodes: ["jiayuan", "tainangu", "jujian", "lingshou"],
      desc: "胥国南部产粮大州，沃野千里、富庶仅次京畿。嘉元城为岚州第一城；最南广贵城外太南山中，数年一度太南小会。" },
  ],
};

/* ============================================================
 * 舆图（分层大地图）——人界 ▸ 大区 ▸ 国别/联盟 ▸ 据点
 * 参考 docs/ref-renjie-worldmap.png + world-architecture.md L0a/L0b/L0c。
 * 上层（人界/大区/国别）由 UI.openAtlas 通用渲染；胥国(国别)叶层复用 WORLD.continent
 * 的水墨舆图与据点节点（UI.openContinent）。当前可达=胥国，余皆「远眺」剪影
 * （考据红线：未实装大区只标名远观、不杜撰可达细节；信息面纱亦如是）。
 * 升级到一级，上一级缩为「远眺」入口——逐级下钻/上卷，永远知道身在何处、可往何方。
 * ============================================================ */
/* —— 区块数据模型（v143 F舆图骨架，map-redesign-design.md §2.2）——
 * 每个 atlas 节点（L1/L2/L3 区块）扩展字段：
 *   to?       可下钻的子层 id（衔接，§9）
 *   poly?     区块多边形（SVG points "x,y x,y…"，% 坐标）；缺省由 UI._atlasPoly 据 pos 生成占位六边形（v144 描准）
 *   label?    题字锚点 {x,y}；缺省取 pos（块中心）
 *   unlock(s) 解锁判定 → 三态（暗/雾·亮起·在此，§3.2）；复用 s.flags / s.visitedNodes，不新开存档字段
 *   faction?         势力归属标签（势力叠加层，§9 多级 toggle，非第6级）：qipai|zhengdao|modao|jiuguo|tiandao|mulan
 *   factionByEpoch?  动态归属 {纪元→势力}，取 ≤当前纪元的最近一档（"neutral"=显式原色）；缺省用恒定 faction
 *   nameByEpoch?/descByEpoch?/ruinByEpoch?  随纪元改名/改述/废墟态（如黄枫谷→黄枫谷旧址）
 *   silhouette/desc  远眺剪影 / 描述（保留）
 * L4/L5 不加 poly（保持点状/单屏）。朝向＝§7.4 方案①（大晋在南；海北/慕兰南/魔道东/正道西）。 */
WORLD.atlas = {
  root: "renjie",
  /* —— 势力注册表（v146 动态多级势力叠加层 §9）：id→图例文案；实际染色见 css .faction-<id> —— */
  factions: {
    qipai:    { name: "胥国七派", short: "七派",   blurb: "胥国（动画即原著越国）七大仙门联盟" },
    zhengdao: { name: "正道盟",   short: "正道盟", blurb: "天南西境·风都国正道诸派" },
    modao:    { name: "魔道六宗", short: "魔道",   blurb: "天南东境·天罗国合欢/御灵/魔焰等六宗" },
    jiuguo:   { name: "九国盟",   short: "九国盟", blurb: "天南最南·抗慕兰的松散九国之盟" },
    tiandao:  { name: "天道盟",   short: "天道盟", blurb: "天南北境·十几中小国抗正魔之盟（韩立赴乱星海后方兴）" },
    mulan:    { name: "慕兰",     short: "慕兰",   blurb: "天南之外·慕兰草原法士，屡屡南侵" },
  },
  /* 当前剧情纪元：0 七玄门篇 / 1 魔道入侵 / 2 四分天下 / 3 慕兰大举入侵·天南联盟——读 s.flags，默认 0。
     纪元由章节/剧情自动推进（红线：魔道·慕兰篇内容待 John 修订，此处只留 flag 钩子）。 */
  factionEpoch(s) {
    const f = (s && s.flags) || {};
    if (f.mulan_invasion || f.tiannan_alliance) return 3;
    if (f.tiandao_formed) return 2;
    if (f.modao_invasion || f.huangfeng_relocated) return 1;
    return 0;
  },
  /* 节点在某纪元的势力归属：factionByEpoch 取 ≤epoch 的最近一档（"neutral"=显式原色不染），
     否则恒定 faction，否则 null（原色）。 */
  factionAt(node, epoch) {
    if (!node) return null;
    const fbe = node.factionByEpoch;
    if (fbe) {
      for (let e = epoch; e >= 0; e--) if (fbe[e] !== undefined) return fbe[e] === "neutral" ? null : fbe[e];
    }
    return node.faction || null;
  },
  /* 某纪元「存在」的大势力（L1 概览图例用；不留虚影——天道盟纪元2 起才列）。 */
  factionsAtEpoch(epoch) {
    const base = ["qipai", "zhengdao", "modao", "jiuguo", "mulan"];
    if (epoch >= 2) base.splice(4, 0, "tiandao");
    return base;
  },
  /* 通用「按纪元取值」：name/desc/ruin 等 *ByEpoch 字段——取 ≤epoch 的最近一档。 */
  epochPick(map, epoch) {
    if (!map) return undefined;
    for (let e = epoch; e >= 0; e--) if (map[e] !== undefined) return map[e];
    return undefined;
  },
  levels: {
    // —— L0a 人界全图 ——
    renjie: {
      name: "人界", kind: "world", crumb: "人界", map: "renjie_map",
      blurb: "你脚下这方天地。天南一隅是起点，乱星海、大晋、慕兰、天沙……皆在云水之外。",
      // 势力概览（L1）：开「势力」时于图例处给一句天南割据概述（§9，不留虚影——纪元0 不提天道盟）。
      factionOverview: "天南——七派据中（胥国），正道盟在西、魔道六宗在东、九国盟偏南，慕兰屡屡南侵。下钻天南，可览各国主导势力。",
      nodes: [
        // 天南＝本图东北角，起点常亮，下钻 L2（§6.1）
        { id: "tiannan", name: "天南", to: "tiannan", pos: { x: 88, y: 30 }, label: { x: 88, y: 30 }, reach: true,
          poly: "74,21 82,17 92,18 100,20 100,43 93,45 86,41 72,39",
          unlock: () => true,
          desc: "人界东北一隅。胥国、元武诸国与正魔两道犬牙交错——你的修行，从这里启程。" },
        // 慕兰草原＝天南正下方（南），慕兰篇点亮（§6.0/§7.4）
        { id: "mulan", name: "慕兰草原", pos: { x: 88, y: 51 }, label: { x: 88, y: 51 }, silhouette: true,
          poly: "72,39 86,41 93,45 100,43 100,66 93,67 84,63 74,58",
          unlock: (s) => !!(s.flags && s.flags.mulan_arc),
          desc: "紧挨天南南侧的辽阔草原，慕兰法士游牧其上，屡屡南侵天南九国。" },
        // 天澜草原＝慕兰之下（更南），突兀族·天澜圣殿（§6.0）
        { id: "tianlan", name: "天澜草原", pos: { x: 90, y: 78 }, label: { x: 90, y: 78 }, silhouette: true,
          poly: "74,58 84,63 93,67 100,66 100,100 78,100 72,89 76,74",
          unlock: () => false,
          desc: "慕兰之外更南的草原，突兀族与天澜圣殿据之，与慕兰法士争锋不休。" },
        // 大晋＝中央偏南、最大陆，元婴后方可游历（§6.0c 韩立路线）
        { id: "dajin", name: "大晋", pos: { x: 49, y: 75 }, label: { x: 50, y: 75 }, silhouette: true,
          poly: "12,56 22,48 34,43 48,41 60,45 72,39 74,58 76,74 72,89 78,100 14,100 13,90 18,78",
          unlock: (s) => !!(s.flags && s.flags.yuanying_complete),
          desc: "面积胜过整个天南的修仙圣地，隔慕兰、天澜草原与天南相望。元婴之后，方有资格踏足。" },
        // 乱星海＝西北，结丹篇离天南而往（§6.0c）
        { id: "luanxinghai", name: "乱星海", pos: { x: 32, y: 21 }, label: { x: 32, y: 20 }, silhouette: true,
          poly: "0,0 74,0 74,21 72,39 60,45 48,41 34,43 22,48 12,56 0,61",
          unlock: (s) => !!(s.flags && s.flags.jiedan_complete),
          desc: "人界西北的无尽海域，内星海人修、外星海妖修。韩立于此结丹、得虚天鼎。" },
        // 天沙大陆＝西南角（原著一笔带过）
        { id: "tiansha", name: "天沙大陆", pos: { x: 6, y: 86 }, label: { x: 8, y: 84 }, silhouette: true,
          poly: "0,61 12,56 18,78 13,90 14,100 0,100",
          unlock: () => false,
          desc: "人界西南的莽荒之陆，原著一笔带过，所知不详——且记在心头。" },
        // 极西之地（千竹教）＝天南以西、隔飓风沙漠（§6.0）
        { id: "jixi", name: "极西之地", pos: { x: 82, y: 16 }, label: { x: 82, y: 15 }, silhouette: true,
          poly: "74,0 100,0 100,20 92,18 82,17 74,21",
          unlock: () => false,
          desc: "天南正道盟以西、隔万里飓风沙漠的飞地。大衍神君于此创千竹教，精擅傀儡之道。" },
      ],
    },
    // —— L0b 大区图：天南多国格局 ——
    tiannan: {
      name: "天南", kind: "region", parent: "renjie", crumb: "天南", map: "tiannan_atlas",
      blurb: "天南多国格局——胥国（韩立出身）只是其中一隅。诸国并立，海北、慕兰南、魔道东、正道西。",
      // 势力概览（L2 国级）：开「势力」时给一句「整国主导势力」概述（非「国内每宗皆属此」，宗门级见 L3）。
      factionOverview: "国级图层标的是各国「主导势力」——七派（中·胥国）、正道盟（西·风都）、魔道六宗（东·天罗）、九国盟（南）、慕兰（最南）；中北诸国纪元0 多为独立小国（原色），随剧情渐次归并。",
      // 国别格子（v145）：相邻切片铺满天南大区图，共享边界严丝合缝（poly 由 Voronoi 剖分算得，
      // 按 canon 罗盘 + 边城玖女天南图 + v2 实际地势落位）。解锁三态：胥国·在此/可下钻，余压雾。
      nodes: [
        // —— 中：胥国（动画即原著越国，韩立出身；七派；下钻 L3）——
        //   节点 id 仍为 yueguo（不动下钻/存档逻辑），仅显示名改胥国；魔道入侵后胥国陷落魔道。
        { id: "yueguo", name: "胥国", to: "yueguo", pos: { x: 42, y: 44 }, reach: true,
          faction: "qipai", factionByEpoch: { 1: "modao" }, unlock: () => true,
          poly: "36.10,56.66 32.57,55.29 28.17,49.35 27.99,44.13 47.38,32.82 51.60,36.16 55.11,45.80",
          desc: "天南中部之国，七派分立——韩立出身于此。十三州山河，是你前半生的舞台。" },
        // —— 北 ——
        { id: "wubianhai", name: "无边海", pos: { x: 48, y: 4 }, silhouette: true, unlock: () => false,
          poly: "62.33,5.54 40.34,10.42 34.21,0.00 64.46,0.00",
          desc: "天南最北的无尽之海，自古无人穿越，传与别处大陆隔绝。" },
        { id: "huayuguo", name: "花雨国", pos: { x: 31, y: 14 }, silhouette: true, unlock: () => false,
          factionByEpoch: { 2: "tiandao" },
          poly: "40.34,10.42 40.91,21.24 30.45,23.57 11.60,0.00 34.21,0.00",
          desc: "天南北陲小国，凡修寥寥——远观之地，且记在心头。" },
        { id: "xiguo", name: "溪国", pos: { x: 50, y: 13 }, silhouette: true, unlock: () => false,
          factionByEpoch: { 2: "tiandao" },
          poly: "61.98,14.06 44.62,24.18 40.91,21.24 40.34,10.42 62.33,5.54",
          desc: "天南北境小国——后为天道盟核心地之一（云梦山）。远观之地，且记在心头。" },
        { id: "yuanwuguo", name: "元武国", pos: { x: 57, y: 25 },
          unlock: (s) => !!(s.flags && s.flags.dongfu_done),
          factionByEpoch: { 1: "modao" },
          poly: "51.60,36.16 47.38,32.82 44.62,24.18 61.98,14.06 69.08,25.04",
          desc: "胥国之北的大国，黄枫谷北面太岳山脉与之接壤。巧匠齐云霄的百艺坊在此——韩立洞府落定后真往代工（神风舟·乌龙夺·颠倒五行阵基础版），首访不遇辛如音；后亦为再别天南、元婴灭付家旧地。" },
        { id: "tianluguo", name: "天卢国", pos: { x: 74, y: 14 }, silhouette: true, unlock: () => false,
          factionByEpoch: { 2: "tiandao" },
          poly: "73.58,27.08 69.08,25.04 61.98,14.06 62.33,5.54 64.46,0.00 100.00,0.00 100.00,14.50",
          desc: "天南东北之国——远观之地，且记在心头。" },
        // —— 西北 ——
        { id: "shayunguo", name: "刹云国", pos: { x: 21, y: 22 }, silhouette: true, unlock: () => false,
          factionByEpoch: { 2: "tiandao" },
          poly: "30.45,23.57 22.31,34.96 0.00,28.17 0.00,0.00 11.60,0.00",
          desc: "天南西北之国——远观之地，且记在心头。" },
        { id: "dongyuguo", name: "东裕国", pos: { x: 35, y: 32 }, silhouette: true, unlock: () => false,
          poly: "22.31,34.96 30.45,23.57 40.91,21.24 44.62,24.18 47.38,32.82 27.99,44.13",
          desc: "天南西北之国——远观之地，且记在心头。" },
        // —— 西：正道盟·风都国 ——
        { id: "fengduguo", name: "风都国", pos: { x: 14, y: 45 }, silhouette: true,
          faction: "zhengdao", unlock: () => false,
          poly: "0.00,58.16 0.00,28.17 22.31,34.96 27.99,44.13 28.17,49.35",
          desc: "天南正道盟祭酒之国，居天南之西；再西即飓风沙漠与极西之地。" },
        { id: "hanshuiguo", name: "寒水国", pos: { x: 19, y: 61 }, silhouette: true, unlock: () => false,
          poly: "0.00,58.16 28.17,49.35 32.57,55.29 1.62,100.00 0.00,100.00",
          desc: "天南西南之国——远观之地，且记在心头。" },
        // —— 东：魔道·天罗国 ——
        { id: "jiangguo", name: "姜国", pos: { x: 64, y: 36 }, silhouette: true, unlock: () => false,
          factionByEpoch: { 1: "modao" },
          poly: "61.40,49.80 55.11,45.80 51.60,36.16 69.08,25.04 73.58,27.08 74.39,43.30",
          desc: "天南东境之国——胥国与魔道天罗，正隔着姜国、车骑国相望。" },
        { id: "tianluoguo", name: "天罗国", pos: { x: 84, y: 35 }, silhouette: true,
          faction: "modao", unlock: () => false,
          poly: "74.39,43.30 73.58,27.08 100.00,14.50 100.00,55.50",
          desc: "天南最东之国，魔道六宗老巢——长生、合欢诸宗盘踞，魔道入侵的源头。" },
        { id: "chejiguo", name: "车骑国", pos: { x: 74, y: 56 }, silhouette: true, unlock: () => false,
          factionByEpoch: { 1: "modao" },
          poly: "84.88,91.34 62.36,61.31 61.40,49.80 74.39,43.30 100.00,55.50 100.00,100.00 97.54,100.00",
          desc: "边境妖兽横行之国——练气士只身赴此，多半葬身兽口。看得见、去不了。" },
        // —— 中南 ——
        { id: "zijinguo", name: "紫金国", pos: { x: 50, y: 58 }, silhouette: true, unlock: () => false,
          poly: "43.15,67.22 36.10,56.66 55.11,45.80 61.40,49.80 62.36,61.31",
          desc: "天南中部强国，修仙世家林立之地。" },
        // —— 南：九国盟（黄枫谷南迁扎根地）——
        { id: "beiliangguo", name: "北凉国", pos: { x: 32, y: 70 }, silhouette: true,
          faction: "jiuguo", unlock: (s) => !!(s.flags && s.flags.huangfeng_relocated),
          poly: "32.57,55.29 36.10,56.66 43.15,67.22 42.93,71.95 12.54,100.00 1.62,100.00",
          desc: "天南之南、九国盟一国，紧邻慕兰草原。魔道入侵后，黄枫谷携门人远遁至此重立山门。" },
        // 越/胥对调（John 定）：此节点 id 仍 xuguo，显示名改「越国」——不可访问的远观剪影（原色不染）。
        { id: "xuguo", name: "越国", pos: { x: 54, y: 71 }, silhouette: true, unlock: () => false,
          poly: "57.70,84.25 42.93,71.95 43.15,67.22 62.36,61.31 84.88,91.34",
          desc: "天南极南一隅，偏处九国盟之外——远观之地，无由得至。" },
        { id: "fengyuanguo", name: "丰原国", pos: { x: 44, y: 83 }, silhouette: true, unlock: () => false,
          faction: "jiuguo",
          poly: "42.93,71.95 57.70,84.25 14.38,100.00 12.54,100.00",
          desc: "天南南境之国，九国盟之一——远观之地，且记在心头。" },
        // —— 最南：慕兰·天澜草原 ——
        { id: "mulan_tianlan", name: "慕兰·天澜草原", pos: { x: 48, y: 94 }, silhouette: true,
          faction: "mulan", unlock: (s) => !!(s.flags && s.flags.mulan_arc),
          poly: "57.70,84.25 84.88,91.34 97.54,100.00 14.38,100.00",
          desc: "天南最南的辽阔草原。慕兰法士游牧其北，突兀族·天澜圣殿据其南，与人族修士争锋不休。" },
      ],
    },
    // —— L0c 国别图：胥国 —— 复用 WORLD.continent（水墨舆图），由 UI.openContinent 渲染
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

  /* 战王蝉（增量D·燕家堡之战大BOSS）——魔道争锋中威名赫赫的巨擘。
   * 撑过血线即剧情撤离：本战不诛杀（考据：他日再别天南重现），故 reward/namedLoot 皆无。
   * 数值参照墨蛟(hp270)上抬一档至筑基初期：破甲(pierce)/范围(zone)/追击(charge·track) 俱全，护甲更厚，
   * 行金属（甲胄如铁·金鸣）——金克木，对主修木系功法的韩立是一场货真价实的硬仗（败则浴血整顿·再战+伤，fail-forward）。 */
  zhanwangchan: {
    name: "战王蝉", hp: 360, sense: 12, speed: 15, agility: 11, move: 2, mp: 110, elem: "jin", nature: "beast",
    tactics: "feral", stubborn: true, canFlee: false, boss: true,
    introNote: "燕家堡破阵而出的魔道巨擘——甲胄如铁，双镰开阖，振翅之间裂石分风！它的「振翅冲撞」会循着你的气息追击，破甲贯刺更是专破护体灵光。这一战不为诛它，只为撑过它的杀势、活着退出燕家堡。甲坚势猛，破甲与符宝方能扛得住。",
    attacks: [
      { name: "镰爪斩", dmg: 30, kind: "normal", weight: 12, range: [1, 1] },
      // 裂翅横扫=扫战位前排（depth:front——僚位躲得掉）
      { name: "裂翅横扫", dmg: 22, kind: "normal", weight: 7, aim: "zone", zoneSpan: 1, range: [1, 2], depth: "front" },
      { name: "破甲贯刺", dmg: 26, kind: "pierce", weight: 7, range: [1, 2] },
      { name: "振翅冲撞", dmg: 36, kind: "charge", weight: 7, aim: "cell", lunge: true, track: true, mp: 12, range: [1, 5] },
      { name: "金鸣音波", dmg: 16, kind: "normal", weight: 6, elem: "jin", aim: "zone", zoneSpan: 1, range: [2, 5], mp: 8 },
    ],
    armor: 8,
    reward: null, namedLoot: null,
  },

  /* 宣乐（增量E·魔道争锋第一幕）——阴手敌型首演。掩月宗潜伏征军的阴人修士。
   * 数值参照同为筑基初刺客的封岳(hp235)：淬毒(jin)/破甲(pierce)/循气追击(charge·track) 俱全，护甲薄、身法快，
   * 阴诡偷袭起手——这是一场比拼"识破与底牌"的恶斗（败则浴血暂退·再战+伤，fail-forward）。 */
  xuanle: {
    name: "宣乐", hp: 245, sense: 14, speed: 16, agility: 14, move: 2, mp: 95, qiLayer: 13, elem: "jin", armor: 3,
    tactics: "cunning", stubborn: true, canFlee: false,
    introNote: "阴手敌型首演——掩月宗潜伏在征军里的阴人。惯于敛息匿形、趁乱下杀手，专挑落单与背身者。淬毒匕首又快又阴，「附骨索命」循着你的气息折转追击，一步躲不开。识破他的偷袭，破甲与毒方能反制这条毒蛇。",
    attacks: [
      { name: "淬毒匕首", dmg: 22, kind: "normal", weight: 12, elem: "jin", range: [1, 1], mp: 6 },
      { name: "阴风穿喉", dmg: 20, kind: "pierce", weight: 8, range: [1, 2], mp: 8 },
      { name: "附骨索命", dmg: 28, kind: "charge", weight: 7, aim: "cell", lunge: true, track: true, range: [1, 5], mp: 12 },
      { name: "袖底淬毒针", dmg: 14, kind: "normal", weight: 6, elem: "jin", range: [2, 4], mp: 5 },
    ],
    reward: { lingshi: 5 }, namedLoot: { yinling_sha: 1 },
  },

  /* 血玉蜘蛛（增量E·矿洞最深处的四级蛛妖）——封印松脱→狂化（叙事；机制单形态，
   * 多形态轮换随乱星海篇噬金虫实装，见 engine.cycleSideForm 注）。数值参照墨蛟(hp270)上抬半档至筑基初期 boss：
   * 破甲(pierce)/吐丝罩排(zone)/狂噬追击(charge·track) 俱全，甲坚(armor6)。行土(岩穴血玉甲)——
   * 主修木系的韩立占着木克土的一线相克之利，是一场"可凭相克+底牌啃下"的硬 boss（败则 fail-forward）。 */
  xueyu_zhizhu: {
    name: "血玉蜘蛛", hp: 300, sense: 10, speed: 12, agility: 8, move: 2, mp: 95, elem: "tu", nature: "beast",
    tactics: "feral", stubborn: true, canFlee: false, boss: true,
    introNote: "矿洞最深处镇压的四级蛛妖——封印松脱，狂化在即！血玉甲壳刀剑难透，「血丝缚」吐丝罩战阵、「狂噬」循着你的气息猛扑，一步躲不开。它越受伤越狂。破甲、火攻与相克方是正解——你那身木行道基，正克它岩穴血玉的土煞。",
    attacks: [
      { name: "毒牙撕咬", dmg: 26, kind: "normal", weight: 12, range: [1, 1] },
      // 血丝缚=吐丝罩战位前排（depth:front——僚位躲得掉）；血玉刺破甲
      { name: "血丝缚", dmg: 16, kind: "normal", weight: 7, aim: "zone", zoneSpan: 1, range: [1, 3], depth: "front", mp: 6 },
      { name: "血玉刺", dmg: 24, kind: "pierce", weight: 7, range: [1, 2] },
      { name: "狂噬", dmg: 34, kind: "charge", weight: 7, aim: "cell", lunge: true, track: true, range: [1, 5], mp: 12 },
      { name: "血雾喷吐", dmg: 16, kind: "normal", weight: 6, elem: "tu", aim: "zone", zoneSpan: 1, range: [2, 5], mp: 8 },
    ],
    armor: 6,
    reward: { lingshi: 6 }, namedLoot: { zhuluan: 2, xueyu_sijin: 1 },
  },

  /* 魔修小队头目（增量F·魔道争锋第二幕·金鼓原巡逻遭遇战）——pack 阵型领队首演。
   * 黑煞教外围的魔道修士，驱使血煞尸傀、领着两名喽啰沿金鼓原游猎。数值取筑基初期偏下
   * （hp200·低于宣乐/封岳的单挑档），因这是"领队+从者"的群战练兵场：领队在世狼群成网、
   * 领队一死群势立溃（combat.js 阵型崩溃 T3）。行土（尸煞血玉甲），主修木系的韩立占木克土
   * 之利——一场可凭"先斩首、相克啃"打赢的战术练兵（败则浴血整顿·再战+伤，fail-forward）。 */
  moxiu_toumu: {
    name: "魔修小队头目", hp: 200, sense: 12, speed: 14, agility: 11, move: 2, mp: 90, qiLayer: 13, elem: "tu", armor: 4,
    tactics: "cunning",
    introNote: "黑煞教外围的魔道头目——驱血煞、役尸傀，领着两名喽啰沿金鼓原游猎。「血煞镰」又快又毒，「驱尸扑」会循着你的气息折转猛扑。这是你头一回正面会魔修小队的「群阵」：他在，喽啰成网；先斩了这领队，剩下两个就散了。他行土煞，正撞你木行道基的相克——啃得动。",
    attacks: [
      { name: "血煞镰", dmg: 24, kind: "normal", weight: 12, elem: "tu", range: [1, 1], mp: 6 },
      { name: "驱尸扑", dmg: 30, kind: "charge", weight: 7, aim: "cell", lunge: true, track: true, range: [1, 5], mp: 12 },
      { name: "尸煞贯刺", dmg: 22, kind: "pierce", weight: 7, range: [1, 2], mp: 8 },
      // 厉啸催阵=罩战位前排（depth:front——僚位躲得掉），领队鞭策从者的群战手段
      { name: "厉啸催阵", dmg: 14, kind: "normal", weight: 6, elem: "tu", aim: "zone", zoneSpan: 1, range: [1, 3], depth: "front", mp: 6 },
    ],
    reward: { lingshi: 4 }, namedLoot: { kuilei_canjian: 1 },
  },

  /* 魔修喽啰（增量F·巡逻遭遇战·pack 从者）——领队麾下的低阶魔修，练气圆满偏上（hp110）。
   * 领队在世时随队形带（队形带 ±2 格）成网，领队一死即转散兵·爪牙软三分（dmgBonus ×0.85）。 */
  moxiu_zu: {
    name: "魔修喽啰", hp: 110, sense: 8, speed: 12, agility: 9, move: 2, mp: 50, qiLayer: 11, elem: "tu", armor: 1,
    tactics: "feral",
    introNote: "魔修头目麾下的喽啰，路子野、底子薄。仗着领队的阵势才敢扑上来——一旦群龙无首，便是各自为战的乌合之众。",
    attacks: [
      { name: "煞气抓击", dmg: 16, kind: "normal", weight: 12, range: [1, 1] },
      { name: "黑血掷", dmg: 14, kind: "normal", weight: 6, elem: "tu", range: [1, 3], mp: 5 },
    ],
    reward: { lingshi: 2 }, namedLoot: null,
  },

  /* 血侍·铁罗（增量G·魔道争锋第三幕·京城暗流）——黑煞教浮出水面的第一面【二阶段·一】。
   * 黑煞教豢养的血侍，筑基初期，一身血煞赤焰（行火·木生火，主修木系的韩立这回讨不到相克便宜，
   * 是一场货真价实的硬仗）。二阶段演出·一阶段：硬战将他逼入绝境，韩立木行剑光斩断其一臂——
   * 铁罗厉啸、血煞内缩结成血茧，蜕出狂暴畸变的「血茧铁罗」二阶段形态（见 tieluo_mao）。
   * canFlee:false——一阶段是正经硬仗、断其一臂，他不是"逼一下就跑"，而是被打到化茧（_finishCombat
   * 按 enemyName "铁罗" 接管：断臂+化茧过场→挂二阶段 modao_e3_tieluo2）。故 reward/namedLoot 皆无。 */
  tieluo: {
    name: "铁罗", hp: 250, sense: 14, speed: 16, agility: 13, move: 2, mp: 100, qiLayer: 13, elem: "huo", armor: 4,
    tactics: "cunning", canFlee: false, boss: true,
    introNote: "黑煞教的血侍——筑基初期，浑身缠着血煞赤焰，「血煞爪」又快又毒，「血遁突袭」循着你的气息折转猛扑，一步躲不开。他行火，木生火，你那身木行道基这回泄气、占不到相克的便宜，是场硬仗。把他逼入绝境、以木行剑光断其一臂——他不会就此倒下，而会厉啸化作血茧，蜕出更狂暴的形态。",
    attacks: [
      { name: "血煞爪", dmg: 26, kind: "normal", weight: 12, elem: "huo", range: [1, 1], mp: 6 },
      { name: "噬血贯刺", dmg: 24, kind: "pierce", weight: 7, range: [1, 2], mp: 8 },
      { name: "血遁突袭", dmg: 32, kind: "charge", weight: 7, aim: "cell", lunge: true, track: true, range: [1, 5], mp: 12 },
      { name: "血雾缠身", dmg: 16, kind: "normal", weight: 6, elem: "huo", aim: "zone", zoneSpan: 1, range: [1, 3], depth: "front", mp: 6 },
    ],
    reward: null, namedLoot: null,
  },

  /* 血茧铁罗（增量G·京城暗流·二阶段·二）——铁罗断臂后化血茧蜕出的狂暴畸变形态。
   * 独臂、却以血侍秘术「化血茧」把残余血煞尽数榨出——血气暴涨、痛觉尽失、近乎不死的搏命态。
   * 数值：筑基初期同档（吃 A2 几何标度·与一阶段同 realmBand），但弃守换攻——hp 更厚（330·濒死反扑）、
   * armor 降到 3（蜕去皮甲、血肉外露）、招式更重更猛（独臂血爪/血遁狂扑伤害拔高）。canFlee:false——
   * 二阶段是正面血战，败之后才以秘术真正遁走（_finishCombat 按 enemyName "血茧铁罗" 接管：化茧大战告捷
   * → 血侍秘术遁走 + 仇恨账本跨场记你一笔，皇宫决战再算）。reward/namedLoot 皆无——他带着家底跑了。 */
  tieluo_mao: {
    name: "血茧铁罗", hp: 330, sense: 15, speed: 17, agility: 12, move: 2, mp: 100, qiLayer: 13, elem: "huo", armor: 3,
    tactics: "feral", stubborn: true, canFlee: false, boss: true,
    introNote: "断臂化茧后的铁罗——独臂，血煞却暴涨到近乎不死。「独臂血爪」一爪比先前更沉更狠，「血遁狂扑」循着你的气息亡命扑来，「血煞爆」掀起一片赤焰罩住战位前排。他蜕了皮甲、血肉外露（破甲更易），可血气狂涌、痛觉尽失，是头濒死搏命的凶兽。他行火，木生火——你那身木行道基仍占不到相克便宜，只能凭底牌与硬功，把这具血茧彻底打垮。",
    attacks: [
      { name: "独臂血爪", dmg: 33, kind: "normal", weight: 12, elem: "huo", range: [1, 1], mp: 6 },
      { name: "血茧贯刺", dmg: 30, kind: "pierce", weight: 7, range: [1, 2], mp: 8 },
      { name: "血遁狂扑", dmg: 42, kind: "charge", weight: 8, aim: "cell", lunge: true, track: true, range: [1, 5], mp: 12 },
      { name: "血煞爆", dmg: 22, kind: "normal", weight: 6, elem: "huo", aim: "zone", zoneSpan: 1, range: [1, 3], depth: "front", mp: 8 },
    ],
    reward: null, namedLoot: null,
  },

  /* 五色门主·王管事（增量G·魔道争锋第三幕·京城暗流·墨府之祸总兑现）——妖化 boss。
   * 嘉元城墨府之祸的真凶，受黑煞教煞气供养、藏身京城五色门的管事。剧情演绎"妖化"：临战煞气骤升、
   * 半人半妖（设定取舍：战中变身以叙事承载，数值直接给妖化态——多形态轮换随后续篇章实装）。
   * 行土厚甲（armor5），主修木系的韩立占木克土之利——这是一场"凭相克+底牌啃下、为墨彩环了结因果"
   * 的报仇硬 boss（败则浴血整顿·再战+伤，fail-forward）。canFlee:false——这一回，他跑不了。 */
  wuse_menzhu: {
    name: "王管事", hp: 285, sense: 12, speed: 14, agility: 10, move: 2, mp: 100, qiLayer: 13, elem: "tu", nature: "beast",
    tactics: "feral", stubborn: true, canFlee: false, boss: true, armor: 5,
    introNote: "墨府之祸的真凶——京城五色门的王管事，受黑煞教煞气供养。临阵煞气骤升、半人半妖，「妖爪裂砍」势大力沉，「噬魂扑」循着你的气息猛扑，「五色煞罩」罩住战位前排。妖化厚甲刀剑难透，可他行土，你那身木行道基正克他——凭相克与底牌，能为墨彩环把这笔血债，了了。",
    attacks: [
      { name: "妖爪裂砍", dmg: 28, kind: "normal", weight: 12, range: [1, 1], mp: 6 },
      { name: "破甲尾刺", dmg: 24, kind: "pierce", weight: 7, range: [1, 2], mp: 8 },
      { name: "噬魂扑", dmg: 36, kind: "charge", weight: 8, aim: "cell", lunge: true, track: true, range: [1, 5], mp: 12 },
      { name: "五色煞罩", dmg: 18, kind: "normal", weight: 6, elem: "tu", aim: "zone", zoneSpan: 1, range: [1, 4], depth: "front", mp: 8 },
    ],
    reward: { lingshi: 6 }, namedLoot: null,
  },

  /* 血侍（增量H·魔道争锋第四幕·皇宫决战开幕·三组对位群架的 mook 群）——黑煞教豢养的低阶血侍，
   * 筑基初期偏下（hp130·比 boss 铁罗弱一档），一身血煞赤焰（行火）。皇宫大门一战玩家与刘靖/宋蒙/
   * 钟卫娘三位同袍 side 同场围杀血侍×3（sides[] 复数化首演关卡 startSantuanFight）。数值刻意压低：
   * 这是"群架·人多势众"的演出，不是单挑硬 boss——靠同袍交叉支援干净利落地撕开缺口、杀进皇宫深处。 */
  xueshi_zu: {
    name: "血侍", hp: 130, sense: 12, speed: 14, agility: 11, move: 2, mp: 60, qiLayer: 13, elem: "huo", armor: 2,
    tactics: "feral",
    introNote: "黑煞教豢养的血侍——筑基初期，浑身缠着血煞赤焰，路子凶野。仗着教中血煞秘术敢往人堆里扑，可底子到底浅，一旦被同袍合围、便压不住阵脚。他行火，木生火，你那身木行道基占不到相克便宜——好在这回你不是一个人。",
    attacks: [
      { name: "血煞爪", dmg: 18, kind: "normal", weight: 12, elem: "huo", range: [1, 1], mp: 5 },
      { name: "噬血贯刺", dmg: 16, kind: "pierce", weight: 7, range: [1, 2], mp: 6 },
      { name: "血遁扑", dmg: 22, kind: "charge", weight: 6, aim: "cell", lunge: true, track: true, range: [1, 4], mp: 9 },
    ],
    reward: { lingshi: 2 }, namedLoot: null,
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

  /* —— 胥王·假丹肉身（增量H下·皇宫决战 phase1）——
   *   胥王褪凡人皮、催血煞秘法跃入假丹境（筑基巅峰）；执残缺法宝「黑血刀」破壁仍困。
   *   拖时布阵战里他强压几人（survive 目标，玩家只需撑住待阵成）；阵成决战里被颠倒五行阵
   *   逐回合反噬，终被三符宝齐轰毁去肉身（waves phase1）。A2 几何标度：假丹 boss·stubborn→mastery2。 */
  xuwang_danshen: {
    name: "胥王（假丹肉身）", hp: 380, sense: 18, speed: 16, agility: 12, move: 2, mp: 90, qiLayer: 14,
    elem: "huo", armor: 5, boss: true, stubborn: true, canFlee: false, tactics: "cunning",
    introNote: "胥王褪去凡人君王的皮囊，血煞冲天、跃入假丹之境——执一柄残缺法宝「黑血刀」，破壁之威仍能困住数名筑基。硬拼必败；唯有拖到师兄妹「真·颠倒五行阵」布成、借阵反制，方有胜机。他行血煞赤焰，木生火，你木行道基占不到相克便宜。",
    attacks: [
      { name: "黑血刀斩", dmg: 30, kind: "normal", weight: 12, elem: "huo", range: [1, 2], mp: 6 },
      { name: "血煞噬刃", dmg: 26, kind: "pierce", weight: 8, range: [1, 2], mp: 8 },
      { name: "黑血刀·破壁", dmg: 44, kind: "charge", weight: 7, aim: "cell", lunge: true, track: true, range: [1, 5], mp: 12 },
      { name: "血煞燎原", dmg: 20, kind: "normal", weight: 6, elem: "huo", aim: "zone", zoneSpan: 1, range: [1, 4], depth: "front", mp: 8 },
    ],
    reward: { lingshi: 12 }, namedLoot: null,
  },

  /* —— 血凝五行丹·神魂（增量H下·皇宫决战 phase2·复生态）——
   *   肉身被三符宝齐轰碎裂后，胥王催「血凝五行丹」借阵中五行之力复生神魂——气血已残（脆），
   *   神魂态出招以夺舍侵神为主。⚠ 刻意不设 nature:"ghost"（那会令引擎置 soulOnly=true、
   *   令底牌/阵法全数零伤＝死局）——此神魂残虚态被颠倒五行阵死死镇出半实之形，故底牌+阵可破；
   *   终由钟卫娘祭真凰符（刘靖祖传真宝·只可一击）灭其神魂（剧情杀·战胜后演出）。 */
  xuwang_shenhun: {
    name: "胥王（血凝五行丹·神魂）", hp: 150, sense: 22, speed: 18, agility: 10, move: 2, mp: 80, qiLayer: 14,
    elem: "huo", armor: 1, boss: true, stubborn: true, canFlee: false, tactics: "cunning",
    introNote: "平天尺、重元珠、赤红剑——韩立、宋蒙、陈巧倩三件符宝齐轰而下，胥王那具假丹肉身轰然崩碎！可血凝五行丹借阵中五行之力，竟凝起一缕复生神魂——肉身已毁、神魂残虚，却仍要夺舍逃命！颠倒五行阵正死死镇着它，趁此底牌齐发将其打散——真凰符已在钟卫娘手中蓄势，只待这一击。",
    attacks: [
      { name: "夺舍侵神", dmg: 22, soul: true, kind: "normal", weight: 12, range: [1, 4], mp: 7 },
      { name: "五行血煞", dmg: 18, kind: "normal", weight: 8, elem: "huo", range: [1, 3], mp: 6 },
    ],
    reward: { lingshi: 8 }, namedLoot: null,
  },

  /* ===== 再别天南篇（衔接过场大章·ep47~63）敌模板（考据见 docs/zaibie-tiannan-design.md） ===== */

  /* —— 金背妖螂（Act1·嘉元城·御灵宗夺舍者驱使的灵兽）——
   *   御灵宗一脉以灵兽奇虫役战。这头金背妖螂甲坚镰利、行金属，金克木，对主修木系的韩立是场硬仗。
   *   战中韩立祭出随身的「颠倒五行阵图」（fieldCycle 复用·player-favorable）逐回合反制其凶威。
   *   A2 几何标度：筑基大妖·参照墨蛟(hp270)上抬半档→hp300，armor5。 */
  jinbei_yaolang: {
    name: "金背妖螂", hp: 300, sense: 11, speed: 15, agility: 13, move: 2, mp: 80, elem: "jin", nature: "beast",
    tactics: "feral", stubborn: true, canFlee: false, boss: true, armor: 5,
    introNote: "御灵宗夺舍者驱使的一头筑基大妖——金背如铁、双镰开阖，振翅之间金鸣裂石！它行金属，金克木，专破你木行道基的护体灵光；「镰突贯袭」更会循着你的气息折转追击。甲坚势猛，破甲与符宝、再借颠倒五行阵逐回合反制，方能扛住这场越阶硬仗。",
    attacks: [
      { name: "金背镰斩", dmg: 28, kind: "normal", weight: 12, elem: "jin", range: [1, 1] },
      { name: "裂空横扫", dmg: 22, kind: "normal", weight: 7, aim: "zone", zoneSpan: 1, range: [1, 2], depth: "front", elem: "jin" },
      { name: "破甲贯刺", dmg: 26, kind: "pierce", weight: 7, range: [1, 2], elem: "jin" },
      { name: "镰突贯袭", dmg: 36, kind: "charge", weight: 7, aim: "cell", lunge: true, track: true, range: [1, 5], mp: 12, elem: "jin" },
    ],
    reward: { lingshi: 6 }, namedLoot: null,
  },

  /* —— 御灵宗夺舍者·夺舍体（Act2·waves phase1）——
   *   一名御灵宗结丹修士夺舍败露：神魂强占了一具筑基躯壳，结丹本命之力催不全（镜像韩立越阶驱剑），
   *   故战力压在筑基一档。执其本命古剑「绿煌剑」（败后入韩立之手·配剑影分光术）。
   *   A2 几何标度：筑基巅峰 boss·参照胥王假丹肉身略低一线→hp340，armor5。 */
  yuling_duoshe: {
    name: "御灵宗夺舍者", hp: 340, sense: 16, speed: 16, agility: 12, move: 2, mp: 90, qiLayer: 13,
    elem: "jin", armor: 5, boss: true, stubborn: true, canFlee: false, tactics: "cunning",
    introNote: "御灵宗一名结丹修士夺舍败露——神魂强占了一具筑基躯壳，结丹本命催发不全，战力被生生压在筑基一档。他执一柄通体莹绿的古剑「绿煌剑」，剑势大力沉、剑影分光多段攒袭；「越阶剑罡」循气追击、专破护体。甲坚剑利，这是一场势均的越阶恶战——胜则那柄结丹本命之器，归你。",
    attacks: [
      { name: "绿煌剑斩", dmg: 30, kind: "normal", weight: 12, elem: "jin", range: [1, 2], mp: 6 },
      { name: "剑影分光", dmg: 16, kind: "normal", weight: 8, aim: "zone", zoneSpan: 1, range: [1, 3], depth: "front", elem: "jin", mp: 7 },
      { name: "破甲剑芒", dmg: 26, kind: "pierce", weight: 7, range: [1, 3], elem: "jin", mp: 8 },
      { name: "越阶剑罡", dmg: 40, kind: "charge", weight: 7, aim: "cell", lunge: true, track: true, range: [1, 5], mp: 12, elem: "jin" },
    ],
    reward: { lingshi: 10 }, namedLoot: null,
  },

  /* —— 御灵宗夺舍者·结丹残念（Act2·waves phase2·复生态）——
   *   筑基躯壳被打碎后，那缕结丹神魂强自凝出半实之形负隅顽抗——气血已残（脆），出招以夺舍侵神为主。
   *   ⚠ 同 xuwang_shenhun：刻意不设 nature:"ghost"（否则 soulOnly=true→底牌全零伤死局），
   *   神魂残虚态被韩立法宝逼出半实之形，故符宝/剑可破。败后绿煌剑与奇虫榜玉简归韩立。 */
  yuling_zhenshen: {
    name: "御灵宗夺舍者（结丹残念）", hp: 170, sense: 20, speed: 18, agility: 11, move: 2, mp: 80, qiLayer: 13,
    elem: "jin", armor: 1, boss: true, stubborn: true, canFlee: false, tactics: "cunning",
    introNote: "筑基躯壳轰然崩碎——那缕结丹神魂却不肯散，强自凝出一道半实的剑影残念，犹要夺舍逃命！神魂残虚（脆），出招以侵神夺舍为主。趁它肉身已失、被你法宝逼出半实之形，底牌齐发将其彻底打散——那柄绿煌剑与奇虫榜玉简，再无主人。",
    attacks: [
      { name: "夺舍侵神", dmg: 22, soul: true, kind: "normal", weight: 12, range: [1, 4], mp: 7 },
      { name: "本命剑气", dmg: 20, kind: "pierce", weight: 8, range: [1, 3], elem: "jin", mp: 6 },
    ],
    reward: { lingshi: 8 }, namedLoot: null,
  },

  /* ===== 初入星海篇（动漫年番·镇妖大典脊柱·ep61~76）敌模板（考据见 docs/lore-churu-xinghai.md） ===== */

  /* —— 婴鲤兽（镇妖大典·擂台团战 boss·五阶越级·幼体堪比六阶）——
   *   动漫魔改：镇妖大典斗兽场放出的越级凶兽，冯三娘领队团战、以阵法困兽极限斩杀夺彩（得降尘丹）。
   *   是本篇最硬的一场越阶恶战——韩立携曲魂并肩、冯三娘等友军侧助（剧情编排见增量5）。
   *   A2 几何标度：越级大妖·较御灵宗夺舍者(hp340)再上一档半→hp520，armor7。 */
  yingli_beast: {
    name: "婴鲤兽", hp: 520, sense: 18, speed: 17, agility: 14, move: 2, mp: 110,
    elem: "shui", nature: "beast", tactics: "feral", stubborn: true, canFlee: false, boss: true, armor: 7,
    introNote: "镇妖台斗兽场铁笼掀开，一头形如赤鳞巨鲤的越级凶兽破水而出——虽只是幼体，凶威已堪比六阶！它行水属，狂涛裹尾、巨口吞噬，「越阶冲撞」更循气追身、势如雷霆。寻常修士近不得身，唯赖冯三娘的困兽阵层层迟滞、众人合力，方能寻那一线极限斩杀的破绽。",
    attacks: [
      { name: "赤鳞水箭", dmg: 30, kind: "normal", weight: 12, elem: "shui", range: [1, 4], mp: 6 },
      { name: "狂涛尾扫", dmg: 24, kind: "normal", weight: 8, aim: "zone", zoneSpan: 1, range: [1, 2], depth: "front", elem: "shui", mp: 7 },
      { name: "巨口吞噬", dmg: 34, kind: "pierce", weight: 7, range: [1, 1], elem: "shui", mp: 8 },
      { name: "越阶冲撞", dmg: 44, kind: "charge", weight: 7, aim: "cell", lunge: true, track: true, range: [1, 5], mp: 14, elem: "shui" },
    ],
    reward: { lingshi: 18 }, namedLoot: null,
  },

  /* —— 雷鹏（上代妖兽之王·十级化形雷属性神禽·镇妖大典惊变破封）——
   *   动漫年番原创悲情妖王：被星宫双圣镇压百年，乌丑/风希炸台放出后破封屠戮、踩碎双圣石像，
   *   终为元婴期风希斩杀、夺其双翅（风雷翅之材料）离场。本篇定位＝奇观演出（非韩立可独胜）：
   *   作 survive/编排奇观出场，由风希 SideUnit 终结（剧情编排见增量5）。
   *   A2 几何标度：十级妖王·碾压档→hp1500，armor12（远超筑基/结丹标度，刻意不可硬撼）。 */
  leipeng: {
    name: "雷鹏", hp: 1500, sense: 24, speed: 20, agility: 16, move: 3, mp: 200,
    elem: "jin", nature: "beast", tactics: "feral", stubborn: true, canFlee: false, boss: true, armor: 12,
    introNote: "镇压百年的封印轰然炸碎——一头通体雷光的巨大神禽冲霄而起，正是上代妖兽之王·十级雷鹏！疾雷双翅一振，劲气横扫连营；它踏碎镇妖台上的双圣石像，雷罡过处寸草不生。这等碾压之威绝非筑基修士可撼，韩立能做的，唯有在这场惊变里护住要护的人、活着退出去。",
    attacks: [
      { name: "疾雷双翅", dmg: 60, kind: "normal", weight: 12, aim: "zone", zoneSpan: 2, range: [1, 4], depth: "front", elem: "jin", mp: 10 },
      { name: "落雷屠戮", dmg: 80, kind: "charge", weight: 9, aim: "cell", lunge: true, track: true, range: [1, 6], mp: 18, elem: "jin" },
      { name: "雷罡横绝", dmg: 50, kind: "pierce", weight: 8, range: [1, 5], elem: "jin", mp: 12 },
    ],
    reward: {}, namedLoot: null,
  },

  /* —— 外星海妖兽（致富猎场·可反复猎杀的杂妖·妖丹来源·#11）——
   *   内星海大阵失效后，韩立赴外星海以霓裳草引妖、噬金虫群猎杀，妖丹论颗装袋＝发家结丹的资粮。
   *   定位＝可反复 encounter 的猎物（reward 落乱星海妖丹）；带伤可遁（canFlee·走脱则财货随之溜走·添致富张力）。
   *   A2 几何标度：外海寻常妖兽·略低于筑基大妖→hp200，armor3。 */
  waihai_yaoshou: {
    name: "外星海妖兽", hp: 200, sense: 13, speed: 15, agility: 12, move: 2, mp: 70,
    elem: "shui", nature: "beast", tactics: "feral", stubborn: false, canFlee: true, boss: false, armor: 3,
    introNote: "外星海妖氛缭绕处，一头中阶海妖循着霓裳草的香气扑来——獠牙利爪、喷吐水箭。放出噬金虫群缠住它，了结之后剖取妖丹，便是一笔进项。它见势不妙也会带伤遁走，跑了，那颗到嘴的妖丹也就跟着没了。",
    attacks: [
      { name: "獠牙撕咬", dmg: 22, kind: "normal", weight: 12, elem: "shui", range: [1, 1] },
      { name: "喷射水箭", dmg: 18, kind: "normal", weight: 8, elem: "shui", range: [1, 3], mp: 5 },
      { name: "扑击", dmg: 26, kind: "charge", weight: 6, aim: "cell", lunge: true, range: [1, 4], mp: 8, elem: "shui" },
    ],
    reward: { xinghai_yaodan: 1, lingshi: 2 }, namedLoot: null,
  },

  /* —— 逆星盟古长老（人修·假丹境·韩立大典脱身一战）——
   *   动漫：大典惊变中逆星盟古姓长老围杀妙音门、阻韩立救汪凝脱身；韩立斩之、携小紫灵逃离。
   *   A2 几何标度：假丹/筑基巅峰人修 boss·参照御灵宗夺舍者上抬一线→hp380，armor5。 */
  nixingmeng_guzhanglao: {
    name: "逆星盟古长老", hp: 380, sense: 19, speed: 17, agility: 12, move: 2, mp: 100, qiLayer: 13,
    elem: "jin", armor: 5, boss: true, stubborn: true, canFlee: false, tactics: "cunning",
    introNote: "逆星盟一名古姓长老拦在退路上——黑袍翻卷、星芒森冷，假丹境的威压压得人喘不过气。他出招阴狠，「噬星黑芒」专破护体、「血遁追命」循气贴身。要救下妙音门那对孤雏、要活着退出这场惊变，就得先把这道拦路的黑影斩了。",
    attacks: [
      { name: "噬星黑芒", dmg: 30, kind: "normal", weight: 12, elem: "jin", range: [1, 3], mp: 6 },
      { name: "星盟剑罡", dmg: 24, kind: "pierce", weight: 8, range: [1, 3], elem: "jin", mp: 7 },
      { name: "血遁追命", dmg: 40, kind: "charge", weight: 7, aim: "cell", lunge: true, track: true, range: [1, 5], mp: 12, elem: "jin" },
    ],
    reward: { lingshi: 14 }, namedLoot: null,
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

/* 前路风闻：已知的远方传闻（明牌惦记·只示意不剧透）——尚未亲历，先入传闻图鉴占个位。
 * 与「风云录·前路」同理：动漫党的欲望地图。考据红线：忠于动漫版，措辞不剧透具体走向。
 * 真正的剧情线报由各篇 worldNews 投放（如 modao 第三幕「第五血侍」线报，story.js），届时入「风闻线报」。 */
WORLD.rumorAhead = [
  { id: "ahead_liujing", far: true, title: "京华血夜 · 阴手救刘靖",
    hint: "隐约风声里有这么一桩远事：他日九名筑基修士夜闯皇城血战黑煞教，同袍刘靖的性命系于一条藏得极深的线报——传闻买得越全，越能从风声里抠出那一手阴的。【魔道争锋篇·未至】" },
  { id: "ahead_jingu", far: true, title: "金鼓原 · 烽烟征调",
    hint: "天南将乱，七派征调令如山——金鼓原会战、灵兽山倒戈的风声，迟早顺着南来北往的商旅传到你耳里。【魔道争锋篇·未至】" },
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
    bio: "墨大夫（墨居仁）之女，嘉元城墨府的小姐。古灵精怪，娇憨狡黠，初见便骗走了你的萦香丸。她问过你一个你答不上来的问题：凡人，就真的不能修仙吗？魔道入侵，墨府随正道避入燕家堡——她又出现在你面前，眉眼里已添了几分风霜。",
    lines: ["韩大哥，今天的药膳你又没喝完！", "爹的信里写了你好多坏话哦——骗你的啦。", "等你走了，这院子又要冷清下来了……", "（燕家堡上重逢）韩大哥……你也来了。这回，可别又把人丢下不管。"],
    where: ["jiayuan_city", "yanjiabao"], cond: (s) => s.flags.mo_met,
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
  {
    id: "qiyunxiao", name: "齐云霄", role: "元武国 · 百艺坊巧匠",
    bio: "元武国百艺坊的炼器巧匠，一炉好风火。韩立持血色禁地的墨蛟皮鳞角北上代工——他一炉炼成神风舟、乌龙夺，又以自家千年灵草为引奉上颠倒五行阵图（基础版）。坊中那位掌账的女子首访不遇，是后话。",
    lines: ["墨蛟的料，到了我手里才不算糟蹋。", "要快、要狠，还是要稳？百艺坊都给你办了。", "（他三角眼一眯，算盘打得噼啪响）"],
    where: ["yuanwu"], cond: (s) => s.flags.daigong_done,
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
  {
    id: "dongxuaner", name: "董萱儿", role: "红拂门下 · 名门之后",
    bio: "出身名门的红拂门下女修，眉眼高华、心思深沉。陆云风当年正是为攀附她这条线，才对道侣陈巧倩痛下杀手（那笔血债，最终算在了你手上）。燕家堡之战中她与你并肩御魔——这位心高气傲的名门之后，记下了你这个伪灵根筑基。",
    lines: ["（她淡淡扫你一眼，目光在你那柄乌龙夺上停了一瞬）", "伪灵根能筑基，倒是稀奇。活着出了这堡，再论你够不够格同我说话。", "战王蝉那一蝉……记着，它也记着你了。"],
    where: ["yanjiabao"], cond: (s) => s.flags.yanjia_reunion_done,
  },
  {
    id: "zhanwangchan", name: "战王蝉", role: "魔道巨擘 · 不死宿敌",
    bio: "魔道争锋中威名赫赫的巨擘，甲胄如铁、双镰开阖，振翅裂石分风。燕家堡一战你力挫其锋，却未能诛之——它带伤遁空，结下不死不休之仇。再见之日，必在更凶险的杀场（再别天南）。",
    lines: ["（甲叶摩擦的森然声响，自黑暗里步步逼近）", "蝼蚁……也敢挡我的路。", "记住这口气息——下次，我啃碎你的骨头。"],
    where: [],   // 纯图鉴宿敌：燕家堡力挫后由 meetNpc("zhanwangchan") 录入「人物图鉴」
  },
  {
    id: "lvtianmeng", name: "吕天蒙", role: "魔道争锋 · 矿场队官",
    bio: "把守前线矿场的征军小队官，筑基初期修为。沉默寡言，待麾下被强征来的征卒尚存几分照拂，是这片冷硬矿场里少有的一点暖意。矿洞黑吃黑的塌方中被同袍宣乐暗算重伤，临死把贴身保命的平天尺塞进你手里——「替我……带出去。」话没说完，人就凉了。",
    lines: ["新来的？记住——矿场里活下去，比立功要紧。", "宣乐那种人的笑脸，别信。", "（他望着矿洞深处，眉头锁得死紧）"],
    where: [],   // 纯图鉴：矿场守备节点 meetNpc 录入
  },
  {
    id: "xuanle", name: "宣乐", role: "掩月宗 · 潜伏阴手",
    bio: "混在征军里的掩月宗阴手，平日扮作沉默的征卒，惯于敛息匿形、专挑落单与背身者下手。矿洞塌方的黑吃黑里，他借乱暗算队官吕天蒙、欲独吞矿脉机缘——却被你识破反杀。这是你头一回正面撞上「阴手」这一路阴诡难缠的魔道敌型。",
    lines: ["（他冲你笑了笑，那笑意却没到眼底）", "矿洞底下的东西，见者有份……可惜你见得太多了。", "一个伪灵根，也配坏我的事？"],
    where: [],
  },
  {
    id: "xueyu_zhizhu", name: "血玉蜘蛛", role: "矿洞 · 四级蛛妖",
    bio: "镇压在前线矿洞最深处的四级蛛妖，通体血玉甲壳、八足如戟。不知被封印了多少年，封印一朝松脱便狂化噬人。你以木行剑光将其诛杀，剖腹得白玉蛛卵两枚——一条「灵宠」的长线，自此埋下。",
    lines: ["（幽深矿洞里，八只猩红的眼睛次第亮起）", "（血玉甲壳摩擦岩壁，发出令人牙酸的声响）"],
    where: [],
  },
  {
    id: "tieluo", name: "铁罗", role: "黑煞教 · 血侍",
    bio: "黑煞教豢养的血侍，筑基初期，浑身缠着血煞赤焰。京城连环失踪案的爪牙——掳掠散修与凡人入血池供养煞气。血池一战你以木行剑光斩断他一臂，他厉啸化作血茧、蜕出独臂狂暴的「血茧铁罗」搏命再战；血茧大战终被你打垮，他才以血侍秘术蜕茧真正遁走，临去死死咬住你的气息。这是「可逃逸宿敌」与「跨场仇恨账本」的头一笔——断臂之仇、化茧之恨，皇宫决战再算。",
    lines: ["（一团暗红血雾里，赤瞳森然亮起）", "黑煞教的事，也是你一个外来户能管的？", "（断臂处血煞翻涌、内缩结茧）记住这口气息——下次，是你进血池。"],
    where: [],
  },
  {
    id: "wuse_menzhu", name: "王管事", role: "京城五色门 · 妖化门主",
    bio: "嘉元城墨府之祸的真凶——藏身京城五色门的管事，受黑煞教煞气供养，临阵煞气骤升、半人半妖。当年墨居仁一家的血债，皆出其手。你为墨彩环寻仇，于京城五色门将这妖化门主诛杀，墨府之祸的因果，至此总兑现。",
    lines: ["（皮囊下煞气翻涌，一双眼渐渐泛起妖异的金）", "墨家那点旧账……也值得你千里寻来送死？", "（妖化的嘶吼，再不似人声）"],
    where: [],
  },
  /* —— 魔道争锋·第二幕·金鼓原前哨集结：黄枫谷师兄弟/七派同袍（增量F）——
   *   考据源：modao-design §一·节点 27/38~46（用户修订裁决已并入）。四人皆为后续京城决战
   *   （Act4·皇宫三组对位群架）的同袍，此处前哨集结首次入图鉴；其京城高光与命途（刘靖凤凰符
   *   秒三血侍后被阴手偷袭身陨、钟卫娘祭真凰符、宋蒙重元珠齐轰）为后续篇章实装，此处只作引介与轻钩。 */
  {
    id: "liujing", name: "刘靖", role: "黄枫谷 · 除魔卫道之楷模",
    bio: "黄枫谷一脉的筑基中期修士，正道楷模式的人物——除魔卫道四字写在脸上，行事方正、待人赤诚。身负一道祖传真宝「凤凰符」，轻易不肯动用。金鼓原前哨集结时与你照过面，对你这伪灵根能筑基不轻看、反生几分惜才之意。",
    lines: ["伪灵根能走到筑基，是你自己挣来的——同袍面前，没人有资格小看你。", "魔道以血煞役尸，伤天害理。我辈修士，自当除之。", "（他按了按腰间一道古朴符箓，神色一肃）这东西，是家传的念想，不到万不得已不动它。"],
    where: [],
  },
  {
    id: "songmeng", name: "宋蒙", role: "黄枫谷 · 持重元珠的稳重师兄",
    bio: "黄枫谷筑基中期修士，性子稳重、心思缜密，身边总跟着钟卫娘。手中一枚「重元珠」是压箱底的护身大件。与刘靖之间似有一段不便明言的旧渊源——金鼓原集结时只与你点头之交，那段渊源是后话。",
    lines: ["前线相持，最忌浮躁。沉住气，活着比立功要紧。", "（他掂了掂掌心一枚温润圆珠，又不动声色地收回袖中）", "卫娘性子急，韩师弟多担待。"],
    where: [],
  },
  {
    id: "zhongweiniang", name: "钟卫娘", role: "黄枫谷 · 心直口快的女修",
    bio: "黄枫谷筑基初期女修，心直口快、护短认死理，常与宋蒙同行。嘴上不饶人，对看不惯的魔道修士尤其没好气。金鼓原前哨集结时与你打过照面——刀子嘴，倒不是坏心。",
    lines: ["伪灵根？我只问你打不打得过魔修。打得过，就是好同袍。", "宋师兄就是太闷了，闷得人着急！", "（她叉着腰冲魔道方向啐了一口）那帮役尸的玩意儿，迟早一个个收拾了！"],
    where: [],
  },
  {
    id: "wuxuan", name: "武炫", role: "七派同袍 · 筑基初期",
    bio: "金鼓原前线七派征调来的筑基初期同袍，年轻气盛、好勇斗狠，巡逻遭遇战中与你并肩搏过魔修小队。打起来嗷嗷叫，收兵了又咧嘴朝你笑——是前线难得让人省心的一把好手。",
    lines: ["韩兄你护住中路，喽啰交给我！", "先斩那领队！头一倒，剩下的就是乌合之众——你看好了！", "（他抹了把脸上的血污，咧嘴一笑）痛快！下回巡逻还叫我。"],
    where: [],
  },
  /* —— 魔道争锋·第三幕·京城暗流：市井机缘 + 散修班底（增量G）——
   *   考据源：modao-design §一·节点 30~36 + §二·第三幕（用户修订裁决已并入）。
   *   萧翠儿=凡人市井机缘线（聪慧小姑娘+爷爷被掳=连环失踪案引子，仙凡有别·只给陪伴窗口）；
   *   蒙山五友=炼气十至圆满的京城散修班底（情报面纱京城版的线人，灵兽山收编线为后续篇章实装）。 */
  {
    id: "xiaocui", name: "萧翠儿", role: "京城 · 市井小姑娘",
    bio: "京城市井里卖花的小姑娘，与相依为命的萧爷爷住在巷尾。聪慧伶俐、嘴甜心善，初见便看出你这「韩公子」不是寻常人。她问过你一个和墨彩环如出一辙的问题：像她爷爷这样的凡人，是不是这辈子都没法修仙、没法不老不死？——后来爷爷在连环失踪案里被「怪物」掳走，是她哭着来求的你。",
    lines: ["韩公子买朵花吧，今早现摘的，可新鲜啦！", "爷爷说京城最近不太平，入夜了就别出门……可爷爷他自己却……（声音哽住）", "韩公子，凡人……是不是真的没办法修仙呀？"],
    where: [], cond: (s) => s.metNpcs && s.metNpcs.includes("xiaocui"),
  },
  {
    id: "mengshan_wuyou", name: "蒙山五友", role: "京城 · 散修班底",
    bio: "在京城讨生活的五个散修，自炼气十层到圆满不等，结义抱团、消息灵通，靠跑腿打探、护院押货糊口。江湖气重却有侠骨——京城散修接连失踪，他们也人人自危。你查连环失踪案时，他们是最肯透底的一拨线人；「敢问……想不想当个英雄？」这话，日后还要再说一遍。",
    lines: ["这位道友面生啊——京城的水深，多少要先递个投名状。", "散修接二连三地没了，活不见人死不见尸……这事邪门。", "情报不是白给的，可你要是真要除了那害人的东西，我们五个，算你一份。"],
    where: [], cond: (s) => s.metNpcs && s.metNpcs.includes("mengshan_wuyou"),
  },
  /* —— 魔道争锋·第四幕·黑煞覆灭（皇宫决战·增量H）——
   *   考据裁决：胥王＝越皇＝黑煞教主＝同一人（modao-design §裁决#3）。皇宫决战时一直以"无害的
   *   越国之主／隐匿的第五血侍"装凡人潜伏，暴起偷袭刘靖（阴手剧情杀），随即褪去凡人皮囊、催动
   *   血煞秘法跃入假丹境（褪皮=同一人实力暴涨，非两人合体）。其二阶段假丹 boss 决战（颠倒五行阵
   *   /三符宝/真凰符终结）为增量H下篇实装；此处于"刘靖之命"节点褪皮现身时首次入图鉴。 */
  {
    id: "xuwang", name: "胥王", role: "黑煞教主 · 越皇（同一人）",
    bio: "黑煞教的教主，亦是越国之主——胥王、越皇、黑煞教主，本是同一人。他在皇宫决战中一直装作无害的凡人君主、隐于「第五血侍」之名潜伏，待刘靖凤凰符尽兴、防备一松，便暴起以阴手偷袭。继而当众褪去凡人皮囊、催动血煞秘法，神魂气息暴涨直入假丹之境（筑基巅峰）——那一身越国君王的温吞皮相，原是这魔道巨擘藏了半生的一张面具。",
    lines: ["（一身越王常服，温声笑着）诸位仙长远来辛苦，寡人……备了些薄礼。", "（皮囊寸寸剥落，声音陡然森冷）装了这许多年凡人，也该腻了。", "（血煞冲天、气息暴涨）假丹之威，岂是尔等筑基蝼蚁可挡？"],
    where: [], cond: (s) => s.metNpcs && s.metNpcs.includes("xuwang"),
  },

  /* —— 初入星海篇（动漫年番·镇妖大典脊柱·ep61~76）人物（考据见 docs/lore-churu-xinghai.md） ——
   *   忠于动漫年番原创脊柱：文樯/汪凝/冯三娘/顾家＝人族友侧；乌丑/风希/古长老＝乱星海大乱之源；
   *   金魁＝星宫收复内星海的背景强者。羁绊正落点＝救汪凝（小紫灵）。均由剧情 onArrive/节点入图鉴。 */
  {
    id: "wen_qiang", name: "文樯", role: "魁星岛旧识 · 文思月之父",
    bio: "韩立在魁星岛结识的一位中年修士，文思月之父。为人热络、消息通达，正是他引韩立同赴六连殿镇妖大典，又点醒他「降尘丹」可降结丹门槛之妙。其女文思月，外海风云时还要再来求韩立相助（远线）。",
    lines: ["韩道友既要结丹，这镇妖大典就非去不可——出力最大者，赏的可是降尘丹。", "降尘丹一枚，能把结丹的门槛降下好大一截，多少人求而不得。", "（他压低声音）这岛上水深，逆星盟的人，最近格外不安分。"],
    where: ["kuixing_island"], cond: (s) => s.metNpcs && s.metNpcs.includes("wen_qiang"),
  },
  {
    id: "wang_ning", name: "汪凝（小紫灵）", role: "妙音门少主 · 掌门之女",
    bio: "妙音门掌门之女、门中少主，年方十二、修为炼气六层。镇妖大典惊变中父母双亡，是韩立在乱军里救下、联手逃出的孤雏——这是本篇真正的情感羁绊落点。多年后她长大成人，便是那位名动星海的紫灵（墨彩环转世的软彩蛋，片尾暗示）。",
    lines: ["韩……韩大哥，他们都死了……就剩我一个了。", "（她把脸埋进膝盖，肩膀一抽一抽）爹娘让我活下去……我答应过的。", "等我长大，一定要变得很强很强——强到再没人能从我身边把人抢走。"],
    where: ["xiaohuan_island", "tianxing_city"], cond: (s) => s.metNpcs && s.metNpcs.includes("wang_ning"),
  },
  {
    id: "feng_sanniang", name: "冯三娘（冯钰）", role: "六连殿阵法师 · 大典团战领队",
    bio: "六连殿的女阵法师，本名冯钰，镇妖大典上领队团战的中坚。布得一手好困兽阵，临危不乱、调度有方——婴鲤兽越级肆虐时，正是她邀韩立联手、以阵法层层迟滞，才换来那一线极限斩杀的破绽。",
    lines: ["这婴鲤兽是幼体却堪比六阶，硬拼是找死——听我的，进阵，困住它。", "韩道友的手段倒出乎我意料，难怪敢应这一场。", "阵眼我来守，破绽你来抓——成与不成，就这一下了。"],
    where: ["kuixing_island"], cond: (s) => s.metNpcs && s.metNpcs.includes("feng_sanniang"),
  },
  {
    id: "gu_family", name: "顾家家主", role: "魁星岛 · 坐地豪族",
    bio: "魁星岛上坐地经营的修仙豪族之主。岛上居留、坊市、镇妖台擂台皆由顾家张罗。韩立藏拙在擂台上赢了一场，替顾家挣了脸面、也争了一桩经商之利，这才换来一纸落脚乱星海的居留。",
    lines: ["道友这一场打得漂亮，魁星岛的居留，顾某替你担保了。", "外来散修要在乱星海立足，没有一处落脚的岛、一纸居留，寸步难行。", "镇妖大典在即，道友既得了居留，不妨随六连殿的人去见见世面。"],
    where: ["kuixing_island"], cond: (s) => s.metNpcs && s.metNpcs.includes("gu_family"),
  },
  {
    id: "miaoyin_zhangmen", name: "妙音门门主", role: "汪凝之父 · 大典殉难",
    bio: "妙音门掌门，汪凝（小紫灵）之父。携妻女赴镇妖大典，却撞上乌丑一伙蓄谋的惊变。夫妇二人为护女儿力战殉难，临终将汪凝托付给乱军中仗义出手的韩立——一句托孤，系起了韩立与紫灵跨越岁月的缘分。",
    lines: ["（他护着妻女且战且退，嘶声喝道）凝儿，跟着这位道友走，别回头！", "（重伤倒地，气若游丝）这位道友……求你……把我女儿……带出去……", "妙音门……到我这一代，也算……尽了。"],
    where: [], cond: (s) => s.metNpcs && s.metNpcs.includes("miaoyin_zhangmen"),
  },
  {
    id: "wuchou", name: "乌丑", role: "逆星盟黑袍 · 极阴祖师后人",
    bio: "逆星盟的黑袍修士，极阴岛极阴祖师一脉的后人。在魁星岛便鬼祟出没，暗中勾结妖修风希、策反六连殿一名长老，于镇妖大典上炸毁镇妖台、放出雷鹏、算计妙音门——乱星海大乱的人族元凶之一。此战未除，远线纠缠直到下一年番。",
    lines: ["（黑袍下一双眼睛阴恻恻地扫过全场）镇妖台镇了百年的东西，也该放出来透透气了。", "祖师当年栽在星宫双圣手里，这笔账，今日连本带利讨回来。", "（阴笑）乱起来才好——乱世里，才有我逆星盟的活路。"],
    where: [], cond: (s) => s.metNpcs && s.metNpcs.includes("wuchou"),
  },
  {
    id: "fengxi", name: "风希", role: "妖修「大善人」 · 元婴期裂风兽化人",
    bio: "一头裂风兽化形的元婴期妖修，世称「大善人」，行事自有一套妖族的盘算。与乌丑各取所需、合谋炸台放雷鹏；待雷鹏破封肆虐，他却一剑斩杀这上代妖王，夺走雷鹏双翅（风雷翅之材料）扬长而去。那对翅膀，要到外海风云篇才被炼成风雷翅——也才被韩立惦记上。",
    lines: ["（负手立于狂风之中，温和地笑）诸位放心，风某素来与人为善。", "雷鹏是头好妖兽，可惜……它这对翅膀，我更喜欢。", "（一剑斩落妖王，拎翅而起）合作愉快。后会，未必有期。"],
    where: [], cond: (s) => s.metNpcs && s.metNpcs.includes("fengxi"),
  },
  {
    id: "jinkui", name: "金魁", role: "星宫大长老 · 元婴中期巅峰",
    bio: "天星宫大长老，元婴中期巅峰的强者，动画年番原创人物。乱星海大乱之后，他孤身踏临逆星盟老巢极阴岛、当众示威、一炮轰碎此岛——星宫着手收复内星海，自此开端。于本篇只作背景演出登场，年番2中他才是举足轻重的角色。",
    lines: ["（立于极阴岛上空，声若洪钟）逆星盟也敢在内星海翻天？星宫，收回来了。", "（指尖星芒一凝，整座岛在脚下崩裂）此岛，除名。", "乱星海的乱，到此为止——往后，是星宫说了算。"],
    where: [], cond: (s) => s.metNpcs && s.metNpcs.includes("jinkui"),
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
