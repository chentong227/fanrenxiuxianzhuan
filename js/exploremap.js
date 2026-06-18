/* ============================================================
 * exploremap.js — 箱庭探索 v3 · L1 舆图引擎 + 嵌套栈
 *
 * 设计（docs/explore-redesign.md 定稿）：
 *  - L1 野外舆图：地标节点+连线，移动耗灾厄钟；"用时间换安全"的战略层。
 *  - 巡逻威胁：会动的敌人棋子（封岳），相遇=对阵轴开打；路上永不随机强战。
 *  - 血幕收缩：钟到点关闭外环节点——地图本身在恶化。
 *  - 嵌套栈：节点可为子图入口（L3 横版深窟），进=压栈、出=弹栈。
 *  - L3 scene 图：线性段落制（入口/观察/采集/决战），暴露值只在此局部存在。
 *
 * 纯逻辑、无 DOM、可序列化（状态挂 State.data.exmap）、可无头测试。
 * 事件由 engine.js 解释（战斗/对话/采集/剧情卡），本文件不触 UI。
 * ============================================================ */

(function (root) {

  /* ---------- 地图定义（声明式数据） ---------- */
  // node.kind: gather(采集) | npc(见人) | rest(庇护) | lore(情报) |
  //            danger(威胁巢) | enter(子图入口) | exit(离开/传送阵)
  // edge: [a, b, 钟耗]
  const MAPS = {

    /* ====== 血色禁地 · L1 野外舆图（黄枫谷篇） ====== */
    xueshi_l1: {
      id: "xueshi_l1", kind: "field",
      name: "血色禁地",
      bg: "xueshi_jindi",
      clockMax: 30,                  // 五日 × 每日六钟
      ticksPerDay: 6,
      entry: "rukou",
      nodes: {
        rukou:   { name: "血幕裂口", kind: "exit", x: 50, y: 80, icon: "◈",
                   desc: "进出禁地的唯一通道。血幕在身后嗡嗡作响，像一张随时会闭拢的嘴。" },
        waipu_d: { name: "外环药圃·东", kind: "gather", x: 77, y: 67, icon: "🌿",
                   desc: "赤岩间一片血色草甸，主药稀稀拉拉——外环的药，胜在安稳。",
                   loot: { xueshi_zhuyao: 1, lingcao: 2 }, rich: false },
        waipu_x: { name: "外环药圃·西", kind: "gather", x: 23, y: 65, icon: "🌿",
                   desc: "靠近血幕的洼地，雾气最薄。几株主药贴着毒草长——下手得准。",
                   loot: { xueshi_zhuyao: 1, duyao_cao: 2 }, rich: false },
        jishi:   { name: "雾中灯火", kind: "npc", x: 13, y: 44, icon: "🏮", npc: "zhongwu",
                   presence: [4, 24],   // 第一日下半到第四日：钟吾在此摆摊
                   desc: "血雾里悬着一盏昏黄的灯。有胆子在禁地里摆摊的，整个黄枫谷只有钟吾一个。" },
        huapu:   { name: "烈阳花圃", kind: "npc", x: 30, y: 27, icon: "🌺", npc: "hanyunzhi",
                   presence: [12, 30],  // 第三日起：菡云芝抵达花圃
                   gatherLoot: { lieyang_hua: 2 },
                   desc: "崖壁向阳处一蓬金红色的花，烈阳花——离得老远就觉得脸上发烫。" },
        zhongtan:{ name: "中环药泽", kind: "gather", x: 57, y: 46, icon: "🌿",
                   desc: "湿热的洼泽，血色主药一丛连着一丛——中环的厚药，人人眼红，连猎人也是。",
                   loot: { xueshi_zhuyao: 3, lingcao: 2 }, rich: true },
        liechang:{ name: "封岳猎场", kind: "danger", x: 80, y: 33, icon: "🗡",
                   desc: "岩壁上几道干涸的暗红刮痕，地上散着断刃与空了的储物袋——猎人的食槽。",
                   loot: { xueshi_zhuyao: 2, lingshi: 3 }, rich: true },
        yanxue:  { name: "庇护岩穴", kind: "rest", x: 38, y: 53, icon: "⛺",
                   desc: "一处背风的岩洞，洞口有前人布过的简陋遮息阵——禁地里难得能喘气的地方。" },
        guzhen:  { name: "古阵残纹", kind: "lore", x: 66, y: 17, icon: "✦",
                   desc: "半埋在赤岩里的古阵残纹，灵光将熄未熄。读懂它，或许能借残阵之眼一窥全局。" },
        shentan: { name: "深潭洞口", kind: "enter", x: 44, y: 11, icon: "🕳", sub: "mojiao_cave",
                   boss: true,
                   desc: "禁地最深处的水潭，潭心一个漆黑的洞口没在水下。主药最厚的地方——也最静，静得不对。" },
      },
      edges: [
        ["rukou", "waipu_d", 1], ["rukou", "waipu_x", 1],
        ["waipu_d", "zhongtan", 2], ["waipu_d", "liechang", 2],
        ["waipu_x", "jishi", 1], ["waipu_x", "yanxue", 1],
        ["jishi", "huapu", 1],
        ["yanxue", "zhongtan", 1], ["yanxue", "huapu", 2],
        ["huapu", "shentan", 2],
        ["zhongtan", "liechang", 1], ["zhongtan", "guzhen", 2],
        ["liechang", "guzhen", 1],
        ["guzhen", "shentan", 1],
      ],
      // 巡逻者：封岳——会动的杀局。路线环巡，玩家每动一步他走一步。
      patrol: {
        enemy: "fengyue", name: "封岳", art: "fengyue",
        route: ["liechang", "zhongtan", "yanxue", "zhongtan"],   // 猎场为巢，环猎中环
        killFlag: "fengyue_dead",   // 此 flag 立起=巡逻消失（被杀/被逐）
      },
      // 血幕收缩：到钟关闭节点（外环先没——地图在恶化）
      curfew: [
        { at: 18, nodes: ["waipu_d", "waipu_x"], note: "第四日。血幕向内卷了一里——外环的药圃没在赤红里，再也进不去了。" },
        { at: 24, nodes: ["jishi", "huapu"], note: "第五日。血幕再次收拢，灯火与花圃尽数吞没。禁地只剩下最深的一圈。" },
      ],
      // 路途见闻（移动演出的一行字——纯氛围，永不强制战斗）
      notes: [
        "血雾贴着地皮流，三丈外人影难辨。",
        "远处传来短促的惨叫，旋即没了声息。你放轻了脚步。",
        "一具焦黑的尸骸靠在岩边，储物袋早被人褪走了。",
        "脚边的血色草叶轻轻颤动，像在替谁报信。",
        "头顶的血幕低低压着，像一层凝住的血。",
        "风里有若有若无的药香——主药就在不远处。",
      ],
    },

    /* ====== 嘉元城 · 据点节点图（和平·无灾厄钟/无巡逻——地标+风物+复访变迁） ======
     * 据点风味打样（docs/cutscene-design.md §五；explore-redesign §P3.5）：
     *  解决"嘉元城和七玄门没区别"——朱门高墙/市集喧腾/帮派暗桩，一眼分得出在哪座城。
     *  peaceful:true → 引擎无钟无巡逻；据点是活的：node.flavors 把既有剧情 flag 投影到界面
     *  （门庭冷落→豺狗暗桩→退敌缩爪→寒毒解·曲魂留府），复访见变迁，不另起新系统。 */
    jiayuan_city_l1: {
      id: "jiayuan_city_l1", kind: "field", peaceful: true,
      name: "嘉元城 · 城东",
      subtitle: "岚州第一大城 · 信步城中",
      bg: "jiayuan_city",
      entry: "mofu",
      nodes: {
        mofu: { name: "墨府", kind: "rest", act: "rest", x: 24, y: 58, icon: "🏯",
          actLabel: "回墨府客房·调息",
          desc: "墨府坐落城东，朱门高墙，匾上漆色已剥落——岚州名医的宅院，如今门庭冷落。",
          flavors: [
            { flag: "han_du_cured", desc: "寒毒已解，墨府夜夜安生。檐角的阴影里仿佛多了一道沉默的身影，府里格外安心。" },
            { flag: "mo_warned", desc: "退了几拨探子后，墨府总算清净了些。可门里依旧只剩孤儿寡母——这点安宁，像借来的。" },
          ] },
        changjie: { name: "长街坊市", kind: "npc", act: "market", x: 52, y: 36, icon: "🏮",
          actLabel: "逛长街坊市·采买",
          desc: "城中长街市声鼎沸，车马如流——比山下集镇繁华十倍不止。药铺、绸庄、酒肆鳞次栉比。",
          flavors: [
            { flag: "mo_warned", desc: "长街依旧喧腾。可你如今走过，总觉得有几道目光黏在背上——眼线混在挑夫货郎里。" },
          ] },
        chengmen: { name: "城门告示", kind: "lore", act: "board", x: 50, y: 80, icon: "📜",
          actLabel: "细读城门告示",
          desc: "城门内侧立着一面斑驳的告示板，贴满悬赏、商旅榜文与城防告示。",
          read: "告示板上：『岚州府征募护院教头』『城西绸庄寻失窃货物线索，重金酬谢』——市井气息扑面。一角还贴着褪色的旧榜，墨府医馆早已不再应诊。",
          flavors: [
            { flag: "han_du_cured", read: "角落新贴一张陌生榜文：岚州最南的太南山，『太南小会』将启——修仙人的集市。算日子，快开了。" },
            { flag: "mo_warned", read: "告示板新换了几张：城南几家商铺『易主』的红榜挨在一处，落款都是同一个堂口。岚州的地面，正悄悄换主人。" },
          ] },
        tangkou: { name: "城南堂口", kind: "lore", act: "rumor", x: 78, y: 62, icon: "🗡",
          actLabel: "暗处探听风声",
          desc: "城南一带几处挂着帮派幌子的堂口。墨大夫在时，岚州这些豺狗没一个敢正眼看墨府。",
          read: "茶肆里压低的闲话：墨大夫一去，城里几个帮派都盯上了墨府那点家底。『孤儿寡母，守得住么？』",
          flavors: [
            { flag: "han_du_cured", read: "风声里说，墨府近来夜夜安生，连最胆大的贼也绕着走——没人说得清那宅子里多了什么。" },
            { flag: "mo_warned", read: "堂口里的人这几日老实了不少：『墨府那位姓韩的，邪门得很，碰不得。』豺狗缩了爪子，却没走远，都在等你离城。" },
          ] },
      },
      edges: [
        ["mofu", "changjie", 1], ["mofu", "chengmen", 1],
        ["changjie", "chengmen", 1], ["changjie", "tangkou", 1],
        ["chengmen", "tangkou", 1],
      ],
      // 城中信步见闻（移动一行字——纯氛围，据点永无强战）
      notes: [
        "卖炊饼的吆喝穿过长街，热气混着远处的药香。",
        "几个孩童追着糖人跑过，险些撞到你。",
        "墙根下，瞎眼的说书人正讲着某位散修的旧事。",
        "一队披甲的城卫列队走过，行人纷纷避让。",
        "茶楼二层传来拨弦声，半阕小调散在风里。",
      ],
    },

    /* ====== 彩霞山后山 · L1 野外舆图（七玄门篇·猎王迷雾） ======
     * P3 野图迁移：旧 explore.js 81 格网格 → 节点图 + 战争迷雾（fog:true）。
     * 入图整片覆雾，循迹寻王：① 邻接点亮 ② 望狼石登高揭片 ③ 远距感知梯度（兽吼/血腥气）。
     * 猎物=异闻妖王（WORLD.beastRumors：白额虎王/铁背蜈蚣/赤目狼王）——由 engine 按
     *  s.beastRumor 注入血食谷那一头；传闻层（applyRumors）按线索进度预亮巢穴并予伏击先手。
     * 后山无灾厄钟（不渲染钟盘）；clockMax 仅作软预算，把脚程折成耗月。 */
    houshan_l1: {
      id: "houshan_l1", kind: "field", fog: true,
      name: "彩霞山 · 后山深处",
      subtitle: "雾锁千山 · 循迹寻踪",
      bg: "houshan",
      clockMax: 200,
      ticksPerDay: 6,
      entry: "linkou",
      nodes: {
        linkou:   { name: "后山林口", kind: "exit", x: 50, y: 86, icon: "◈",
          desc: "七玄门后山的入口。再往里，雾就浓了——采药人轻易不敢深入。" },
        yaojing:  { name: "采药小径", kind: "gather", x: 27, y: 67, icon: "🌿",
          desc: "一道被踩出来的浅径，两旁灵草杂生——后山最安稳的一片药。",
          loot: { lingcao: 2, duyao_cao: 1 }, rich: false },
        guteng:   { name: "古藤深坡", kind: "gather", x: 73, y: 65, icon: "🌿",
          desc: "老藤盘结的陡坡，岩缝里嵌着灵石，也藏着毒草——下手得挑。",
          loot: { lingcao: 1, lingshi: 2 }, rich: false },
        wanglang: { name: "望狼石", kind: "rest", x: 50, y: 50, icon: "🪨",
          reveals: ["wulin", "xuegu", "qixi"],
          lookoutNote: "你攀上望狼石极目四望——雾林的轮廓、那道飘着血腥气的山坳，一时尽收眼底。",
          desc: "后山中拔地而起的一块巨岩，登顶可俯瞰大半个山坳。猎户旧时在此守夜望狼。" },
        qixi:     { name: "栖息岩穴", kind: "rest", x: 36, y: 36, icon: "⛺",
          desc: "一处背风的浅穴，地上还留着旧火堆的灰——后山里难得能喘口气的地方。" },
        wulin:    { name: "雾林深处", kind: "gather", x: 61, y: 22, icon: "🌫",
          desc: "雾浓得化不开，灵气与腥气一同弥漫。越往里，越觉得有什么在暗处看着你。",
          loot: { lingcao: 1, duyao_cao: 2 }, rich: false },
        xuegu:    { name: "血食谷", kind: "danger", x: 81, y: 30, icon: "🐾", boss: true,
          desc: "谷中遍地碎骨断角，腥气冲天——那头异兽的食场。再没有比这更凶、也更肥的地方。",
          loot: { lingshi: 3, lingcao: 2 }, rich: true },
      },
      edges: [
        ["linkou", "yaojing", 1], ["linkou", "guteng", 1],
        ["yaojing", "wanglang", 1], ["guteng", "wanglang", 1],
        ["yaojing", "qixi", 2], ["wanglang", "qixi", 1],
        ["wanglang", "wulin", 2], ["qixi", "wulin", 1],
        ["wulin", "xuegu", 1],
      ],
      // 远距感知梯度：血食谷的兽吼/血腥气——只报方位强弱、不报精确坐标（零传闻也能循声逼近）
      senseSources: [
        { node: "xuegu", kind: "roar", bands: [
          { within: 4, level: 1, text: "风里裹着一丝若有若无的血腥气，自山坳深处飘来。" },
          { within: 3, level: 2, text: "一声闷雷似的兽吼滚过林梢——那畜生，就在前头不远。" },
          { within: 2, level: 3, text: "腥风扑面，惊起满林宿鸟。巢穴近了。" },
          { within: 1, level: 4, text: "碎骨遍地、腥气冲鼻——兽王的食场就在眼前。" },
        ] },
      ],
      // 传闻层：异闻在耳→预亮巢穴与栖踪，并予伏击先手（applyRumors，engine 按线索进度调用）
      rumors: {
        beast_baihu:  { nodes: ["xuegu", "wulin"], intel: { lair_route: true },
          note: "白额虎王盘踞后山深处，踪迹已隐隐可循。" },
        beast_wugong: { nodes: ["xuegu", "wulin"], intel: { lair_route: true },
          note: "铁背蜈蚣的巢穴方位，从风声里渐渐明朗。" },
        beast_chimu:  { nodes: ["xuegu", "wulin"], intel: { lair_route: true },
          note: "赤目狼王的栖处，循着月下的踪迹已可锁定。" },
      },
      // 路途见闻（移动一行字——纯氛围；后山永不随机强战，强战只在血食谷主动猎杀）
      notes: [
        "雾贴着林梢流动，三步外枝影模糊。",
        "脚边的灌木无风自动，又倏地静了。",
        "远处一声短促的兽鸣，旋即被雾吞没。",
        "湿泥上压着一行碗大的爪印，往林子深处去了。",
        "风里有若有若无的药香——灵草就在近旁。",
        "宿鸟惊起又落下，像是替谁望了一回风。",
      ],
    },

    /* ====== 墨蛟山洞 · L3 轴式洞窟（与对阵轴同构——探索/布阵/战斗同一条轴） ====== */
    mojiao_cave: {
      id: "mojiao_cave", kind: "cave",
      name: "深潭洞窟",
      bg: "xueshi_jindi",
      pano: "pano_dongku",   // 长卷全景（21:9）：镜头横移时背景跟着退——洞口到潭心是一幅连续长卷
      parentNode: "shentan",
      snapshot: true,    // 入洞前打"洞口印记"（败退可从洞口重来）
      confirm: "潭底洞窟幽深，妖气如渊——里面那位，恐怕不是练气修士该招惹的东西。\n（进入后将立下洞口印记：若败退，可从洞口重来。）",
      W: 27,             // 长轴洞窟：三倍战斗轴——探索格即战斗格（开战不切屏不换轴）
      playerPos: 1,
      // 战团（动漫版）：南宫婉正独战墨蛟本体——观战的对象就是开战的对象
      watchers: [
        { art: "bt_nangongwan", name: "南宫婉", pos: 22, ally: true },
        { art: "bt_mojiao", name: "墨蛟", pos: 25, beast: true },
      ],
      // 入场氛围（exmapNote 字幕队列）
      intro: [
        "你贴着洞壁潜入。暗红的水光在岩顶流转，像倒悬的河。",
        "脚边横着几具兽骨，断口平滑——是被一口咬断的。",
        "洞窟深处轰然作响——白衣广袖的身影凌波而立：掩月宗南宫婉，正独战一头漆黑蛟影！",
      ],
      // 走近战团（pos≥intelAt）触发观战情报：看清墨蛟路数=决战先机
      intelAt: 17,
      intelNote: "你伏在岩后看了片刻——墨蛟出水必先摆尾，黑雾是虚、撞角是实，左肋有道旧伤未愈；南宫婉的月华绫缠字诀正缠着它的角。看一眼，就是一眼的便宜。",
      intelExpose: 8,
      // 声纹梯度：离战团越近，听得越真（dist=与最近战团单位的距离，跨档触发一次）
      soundCues: [
        { dist: 14, sfx: "farClash", text: "绫帛破空之声渐渐清晰——岩顶的红光，随那厢的打斗忽明忽灭。" },
        { dist: 9,  sfx: "farRoar",  text: "妖兽的腥风顺着水面扑过来，吼声震得岩屑簌簌而落——就在前面了。" },
      ],
      // 近身惊动：贴近战团的每一步都在它耳边（落点结算，取最里档）——
      // "从多远动手"由此成为真决策：贴身开局最狠，但每走近一步都可能惊动它
      nearExpose: [
        { dist: 3, expose: 6, note: "你已贴到它水沫溅得到的地方——潭面的呼吸，乱了一拍。" },
        { dist: 6, expose: 3, note: "太近了——脚下碎石的每一声轻响，都像在它耳边敲。" },
      ],
      // 友军战耗：你每多贪一个热点，她就多撑一阵（开战时她的气血按此折损）
      allyDrain: 7,
      // 热点：散布在长轴上（走到跟前才能采——越深越肥，离墨蛟越近越险）
      hotspots: [
        { id: "guteng", name: "千年藤芯", pos: 4, loot: { lingcao: 3 }, expose: 6 },
        { id: "zhuyao1", name: "血色主药", pos: 8, loot: { xueshi_zhuyao: 2 }, expose: 10 },
        { id: "lingshi", name: "岩缝灵石", pos: 13, loot: { lingshi: 4 }, expose: 12 },
        { id: "zhuyao2", name: "血色主药", pos: 18, loot: { xueshi_zhuyao: 2 }, expose: 16 },
        { id: "laozh", name: "潭心老株", pos: 21, loot: { xueshi_zhuyao: 2 }, expose: 22 },
      ],
      exposeLimit: 50,   // 暴露满=墨蛟提前察觉（决战失先机+它有备而来，fail-forward 不判负）
      // 战前布置：阵旗/符箓/伏兵布到具体格子——开战原格生效（诱敌入阵的物理语义）
      preps: [
        { id: "kunzu", item: "zhenqi_kunzu", name: "困足阵旗", expose: 8, zone: "kunzu",
          hint: "布在它扑向你的来路上——踏入即陷，进势戛然而止" },
        { id: "juling", item: "zhenqi_juling", name: "聚灵阵旗", expose: 6, zone: "juling",
          hint: "布在自己立足之地——立于阵中每回合回灵" },
        { id: "anfu", item: "huoshe_fu", name: "伏火符", expose: 8, mine: "anfu",
          hint: "埋进砂砾——它踏过此格当头引爆一记火伤" },
        { id: "tienu", side: true, name: "铁奴埋伏", expose: 10, mine: "tienu",
          hint: "让铁奴沉进淤泥蛰伏——它踏过此格，铁奴破土死缠一记（本场南宫婉并肩，铁奴正好打伏）" },
      ],
      fight: { enemy: "mojiao", ally: "nangongwan",
        cue: "南宫婉的绫光忽然一滞——墨蛟猩红的竖瞳，越过她，直直锁住了潭岸上的你。" },
    },
  };

  function edgeKey(a, b) { return a < b ? a + "|" + b : b + "|" + a; }

  const ExploreMap = {
    MAPS,

    /* ---------- 栈与帧 ---------- */
    // 开图：建栈底帧。ctx={ flags }（引擎注入只读上下文，用于巡逻者存活判定等）
    start(mapId, ctx) {
      const map = MAPS[mapId];
      if (!map) return null;
      const frame = this._mkFrame(map);
      return { stack: [frame], bag: {}, ctx: ctx || {} };
    },

    _mkFrame(map) {
      const f = {
        mapId: map.id, kind: map.kind,
        node: map.entry || null,
        clock: 0,
        visited: {}, cleared: {}, closed: {},
        patrolIdx: 0, patrolDead: false,
        guzhenUsed: false, intel: {},
        log: [],
      };
      if (map.kind === "cave") {
        f.pos = map.playerPos != null ? map.playerPos : 1;
        f.expose = 0; f.taken = {}; f.preps = {}; f.introDone = false;
      }
      // 战争迷雾（map.fog 选启）：四态可见性——glimpsed 窥见 / rumored 风闻；visited 已至沿用 f.visited
      // hunted：巢穴猎物已伏诛（与 cleared「采尽」分开记——先猎杀，方可搜刮）
      if (map.fog) { f.glimpsed = {}; f.rumored = {}; f.senseBand = {}; f.hunted = {}; }
      if (map.entry) f.visited[map.entry] = true;
      if (map.fog && map.entry) this._revealFrom(f, map, map.entry, null);   // 入口即点亮四邻（+登高揭片）
      return f;
    },

    cur(x) { return x.stack[x.stack.length - 1]; },
    mapOf(f) { return MAPS[f.mapId]; },

    // 据点风味·复访变迁：按 flags 选节点的风物变体（最进展者列在前=优先命中）。
    // 纯函数、无 DOM/无 State——可无头测；返回命中的 flavor 对象或 null（用 node 基础风物）。
    flavor(node, flags) {
      if (!node || !node.flavors) return null;
      flags = flags || {};
      for (const fv of node.flavors) {
        if (fv.flag && flags[fv.flag]) return fv;
      }
      return null;
    },

    /* ---------- 钟与日 ---------- */
    clockInfo(x) {
      // 钟挂在栈底帧（L1）——子图内行动也烧大图的钟
      const base = x.stack[0], map = MAPS[base.mapId];
      const tpd = map.ticksPerDay || 6;
      return {
        clock: base.clock, max: map.clockMax || 0,
        day: Math.floor(base.clock / tpd) + 1,
        tick: base.clock % tpd,
        left: (map.clockMax || 0) - base.clock,
      };
    },

    _tickClock(x, n, events) {
      const base = x.stack[0], map = MAPS[base.mapId];
      if (!map.clockMax) return false;
      base.clock += n;
      // 血幕收缩：到点关节点
      (map.curfew || []).forEach(cf => {
        if (base.clock >= cf.at && !base.closed[cf.at]) {
          base.closed[cf.at] = true;
          cf.nodes.forEach(id => { base.closed[id] = true; });
          events.push({ type: "curfew", note: cf.note, nodes: cf.nodes });
          // 玩家正身处被吞节点：被血幕逼向相邻开放节点
          if (cf.nodes.includes(base.node) && x.stack.length === 1) {
            const fallback = this._neighbors(map, base.node).find(nb => !base.closed[nb.id]);
            if (fallback) {
              base.node = fallback.id;
              events.push({ type: "note", text: `血幕贴着脚跟卷来——你连滚带爬退到了「${map.nodes[fallback.id].name}」。` });
            }
          }
        }
      });
      if (base.clock >= map.clockMax) { events.push({ type: "timeup" }); return true; }
      return false;
    },

    /* ---------- L1 舆图：选项与移动 ---------- */
    _neighbors(map, nodeId) {
      const out = [];
      (map.edges || []).forEach(([a, b, cost]) => {
        if (a === nodeId) out.push({ id: b, cost: cost || 1 });
        else if (b === nodeId) out.push({ id: a, cost: cost || 1 });
      });
      return out;
    },

    /* ---------- 战争迷雾（map.fog）：四态可见性 + 三揭法 + 传闻层 ----------
     * 客观/迷雾/传闻三层各司其职（信息 ≠ 现实）。非 fog 图全部短路，零回归。 */

    // 抵达一个节点时揭雾：① 邻接点亮（四邻升为窥见）② 登高揭片（node.reveals）
    _revealFrom(f, map, nodeId, events) {
      if (!map.fog || !f.glimpsed) return;
      this._neighbors(map, nodeId).forEach(nb => { if (f.visited[nb.id] !== true) f.glimpsed[nb.id] = true; });
      const node = map.nodes[nodeId];
      if (node && node.reveals) {
        let any = false;
        node.reveals.forEach(id => {
          if (map.nodes[id] && f.visited[id] !== true && !f.glimpsed[id]) { f.glimpsed[id] = true; any = true; }
        });
        if (any && events) events.push({ type: "lookout", text: node.lookoutNote || "登高一望，山坳里的去处尽收眼底。", reveals: node.reveals });
      }
    },

    // 抵达揭雾 + 远距感知梯度（极深兽吼/血腥气：报方位与强弱，不报精确坐标）
    _fogArrive(x, f, map, nodeId, events) {
      if (!map.fog) return;
      this._revealFrom(f, map, nodeId, events);
      (map.senseSources || []).forEach((src, si) => {
        const d = this._dist(map, nodeId, src.node);
        const band = (src.bands || []).filter(b => d <= b.within).sort((a, b) => a.within - b.within)[0];
        if (!band) return;
        const prev = f.senseBand[si];
        if (prev == null || band.within < prev) {   // 只在"逼近一档"时鸣一次（跨档才触发，同档不复鸣）
          f.senseBand[si] = band.within;
          if (events) events.push({ type: "sense", text: band.text, kind: src.kind,
                                    dir: this._dir(map, nodeId, src.node), level: band.level || 1 });
        }
      });
    },

    // 图上两节点的跳数（BFS·用于感知梯度强弱分档）
    _dist(map, from, to) {
      if (from === to) return 0;
      const seen = { [from]: true }; let frontier = [from], d = 0;
      while (frontier.length) {
        d++; const next = [];
        for (const id of frontier) {
          for (const nb of this._neighbors(map, id)) {
            if (seen[nb.id]) continue;
            if (nb.id === to) return d;
            seen[nb.id] = true; next.push(nb.id);
          }
        }
        frontier = next;
      }
      return Infinity;
    },

    // 由坐标算八向罗盘（只给方位，不给坐标——诚实预告而非精确雷达）
    _dir(map, fromId, toId) {
      const a = map.nodes[fromId], b = map.nodes[toId];
      if (!a || !b) return "";
      const dx = b.x - a.x, dy = a.y - b.y;   // 屏幕 y 向下，翻成世界 y 向上
      if (dx === 0 && dy === 0) return "近在咫尺";
      const ang = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
      return ["东", "东北", "北", "西北", "西", "西南", "南", "东南"][Math.round(ang / 45) % 8] + "方";
    },

    // 节点四态：unknown 未知 / glimpsed 窥见 / rumored 风闻 / visited 已至
    fogState(x, nodeId) {
      const f = this.cur(x), map = this.mapOf(f);
      if (!map.fog) return "visited";              // 无雾图：一切照旧全显
      if (f.visited[nodeId] === true) return "visited";
      if (f.rumored && f.rumored[nodeId]) return "rumored";
      if (f.glimpsed && f.glimpsed[nodeId]) return "glimpsed";
      if (f.visited[nodeId]) return "glimpsed";    // 读阵等"只在图上见过"
      return "unknown";
    },

    // 远距感知读数（当前节点对最强危险源的感知：方位 + 强弱 + 一行预告）
    senseField(x) {
      const f = this.cur(x), map = this.mapOf(f);
      if (!map.fog || !map.senseSources) return null;
      let best = null;
      for (const src of map.senseSources) {
        const d = this._dist(map, f.node, src.node);
        const band = (src.bands || []).filter(b => d <= b.within).sort((a, b) => a.within - b.within)[0];
        if (!band) continue;
        const lvl = band.level || 1;
        if (!best || lvl > best.level) best = { src: src.node, kind: src.kind, dist: d, level: lvl,
                                                text: band.text, dir: this._dir(map, f.node, src.node) };
      }
      return best;
    },

    // 传闻层：只降雾、绝不增删世界。把若干节点预亮为"风闻"，并落情报红利（intel）。
    // rumors: [ ruleId | { nodes:[...], intel:{...}, note } ]——字符串走 map.rumors 查表。
    applyRumors(x, rumors) {
      const f = this.cur(x), map = this.mapOf(f);
      if (!map.fog) return { ok: false, reason: "此图无雾可降" };
      f.rumored = f.rumored || {};
      const applied = [];
      (rumors || []).forEach(r => {
        const def = (typeof r === "string") ? (map.rumors || {})[r] : r;
        if (!def) return;
        (def.nodes || []).forEach(id => { if (map.nodes[id] && f.visited[id] !== true) f.rumored[id] = true; });
        if (def.intel) Object.assign(f.intel, def.intel);
        applied.push({ id: (typeof r === "string") ? r : null, note: def.note, nodes: def.nodes || [] });
      });
      return { ok: true, applied };
    },

    // 巡逻者当前/下一步位置（杀气阴影=诚实预告）
    patrolAt(x) {
      const f = x.stack[0], map = MAPS[f.mapId];
      if (!map.patrol || f.patrolDead) return null;
      if (x.ctx && x.ctx.flags && x.ctx.flags[map.patrol.killFlag]) return null;
      const route = map.patrol.route;
      return { node: route[f.patrolIdx % route.length], next: route[(f.patrolIdx + 1) % route.length], def: map.patrol };
    },

    // 当前可去节点（带钟耗/风险/关闭标注）——UI 与 AI 共用
    options(x) {
      const f = this.cur(x);
      if (f.kind !== "field") return [];
      const map = this.mapOf(f);
      const pat = this.patrolAt(x);
      return this._neighbors(map, f.node).map(nb => {
        const n = map.nodes[nb.id];
        let risk = null;
        if (pat && nb.id === pat.node) risk = "killer";          // 杀气盈格：他就在那
        else if (pat && nb.id === pat.next) risk = "shadow";     // 杀气残痕：他正往那去
        else if (n.kind === "danger") risk = "lair";             // 威胁巢穴
        else if (n.kind === "enter" && n.boss) risk = "boss";
        return { id: nb.id, name: n.name, icon: n.icon, kind: n.kind, cost: nb.cost,
                 risk, closed: !!f.closed[nb.id], visited: !!f.visited[nb.id], cleared: !!f.cleared[nb.id] };
      });
    },

    // 移动到相邻节点。返回 { ok, events: [...] }——事件由 engine 解释。
    travel(x, nodeId) {
      const f = this.cur(x);
      if (f.kind !== "field") return { ok: false, reason: "身在窟中，先出去再说" };
      const map = this.mapOf(f);
      const nb = this._neighbors(map, f.node).find(n => n.id === nodeId);
      if (!nb) return { ok: false, reason: "无路可达" };
      if (f.closed[nodeId]) return { ok: false, reason: "血幕已吞掉那里" };

      const events = [];
      const node = map.nodes[nodeId];

      // 路途见闻（移动演出的一行字）
      if (map.notes && map.notes.length) {
        events.push({ type: "note", text: map.notes[Math.floor(Math.random() * map.notes.length)] });
      }

      f.node = nodeId;
      const firstVisit = !f.visited[nodeId];
      f.visited[nodeId] = true;
      this._fogArrive(x, f, map, nodeId, events);   // 迷雾：邻接点亮 + 登高揭片 + 远距感知梯度（map.fog 才生效）

      // 钟先走（移动的代价），血幕可能恰好在此刻吞节点
      const timeup = this._tickClock(x, nb.cost, events);
      if (timeup) { events.push({ type: "arrive", node: nodeId, firstVisit }); return { ok: true, events }; }

      // 相遇判定一：你踩进了他守着的格子（他还没挪窝）
      const patBefore = this.patrolAt(x);
      if (patBefore && patBefore.node === nodeId) {
        const ambush = !!f.intel.patrol_route;   // 读过他的路线=有备而来（伏击先手）
        events.push({ type: "encounter", enemy: patBefore.def.enemy, name: patBefore.def.name, ambush });
        return { ok: true, events };
      }

      // 巡逻者走一步（你动他也动）
      this._patrolStep(x, events);

      // 相遇判定二：他这一步刚好撞进你落脚的格子
      const pat = this.patrolAt(x);
      if (pat && pat.node === f.node) {
        const ambush = !!f.intel.patrol_route;
        events.push({ type: "encounter", enemy: pat.def.enemy, name: pat.def.name, ambush });
        return { ok: true, events };
      }

      events.push({ type: "arrive", node: nodeId, firstVisit, nodeDef: node });
      return { ok: true, events };
    },

    _patrolStep(x, events) {
      const f = x.stack[0], map = MAPS[f.mapId];
      if (!map.patrol || f.patrolDead) return;
      if (x.ctx && x.ctx.flags && x.ctx.flags[map.patrol.killFlag]) { f.patrolDead = true; return; }
      f.patrolIdx = (f.patrolIdx + 1) % map.patrol.route.length;
      const pat = this.patrolAt(x);
      // 他逼近你所在节点：神识警兆（诚实预告，给你一步反应）
      if (pat && pat.next === f.node) {
        events.push({ type: "warning", text: `神识里一根弦绷紧——有杀气正朝「${map.nodes[f.node].name}」压来。` });
      }
    },

    // 驻守：原地耗钟（等人/恢复由 engine 结算）。巡逻者照走，可能撞上你。
    stay(x, ticks) {
      const f = this.cur(x);
      const events = [];
      const timeup = this._tickClock(x, ticks || 1, events);
      if (timeup) return { ok: true, events };
      this._patrolStep(x, events);
      const pat = this.patrolAt(x);
      if (pat && pat.node === x.stack[0].node && x.stack.length === 1) {
        events.push({ type: "encounter", enemy: pat.def.enemy, name: pat.def.name, ambush: false, atRest: true });
      }
      return { ok: true, events };
    },

    // 采集当前节点（gather 类）：一次性掏空，钟+1
    gather(x) {
      const f = this.cur(x);
      const map = this.mapOf(f);
      const node = map.nodes[f.node];
      const loot = node.loot || node.gatherLoot;
      if (!loot || f.cleared[f.node]) return { ok: false, reason: "此处已无可采" };
      f.cleared[f.node] = true;
      Object.entries(loot).forEach(([k, n]) => { x.bag[k] = (x.bag[k] || 0) + n; });
      const events = [{ type: "loot", loot, node: f.node }];
      this._tickClock(x, 1, events);
      this._patrolStep(x, events);
      const pat = this.patrolAt(x);
      if (pat && pat.node === f.node) {
        events.push({ type: "encounter", enemy: pat.def.enemy, name: pat.def.name, ambush: false });
      }
      return { ok: true, events };
    },

    // 古阵残纹：读阵——获得巡逻路线情报（伏击资格）+全图节点显形
    readLore(x) {
      const f = this.cur(x);
      const map = this.mapOf(f);
      if (map.nodes[f.node].kind !== "lore" || f.guzhenUsed) return { ok: false, reason: "残阵灵光已尽" };
      f.guzhenUsed = true;
      f.intel.patrol_route = true;
      Object.keys(map.nodes).forEach(id => { f.visited[id] = f.visited[id] || "seen"; });
      return { ok: true, events: [{ type: "lore",
        text: "你以神识沁入残纹，残阵之眼骤然睁开——整片禁地的轮廓在识海里铺陈开来。那道游弋的杀气走的路线，也看得一清二楚。" }] };
    },

    /* ---------- 嵌套栈：进出子图 ---------- */
    enterSub(x) {
      const f = this.cur(x);
      const map = this.mapOf(f);
      const node = map.nodes[f.node];
      if (!node || node.kind !== "enter" || !MAPS[node.sub]) return { ok: false, reason: "此处无可入之门" };
      x.stack.push(this._mkFrame(MAPS[node.sub]));
      return { ok: true, sub: node.sub, snapshot: !!MAPS[node.sub].snapshot };
    },

    exitSub(x) {
      if (x.stack.length <= 1) return { ok: false, reason: "已在最外层" };
      x.stack.pop();
      return { ok: true };
    },

    /* ---------- L3 轴式洞窟（与对阵轴同构：探索格=战斗格） ---------- */
    // 走格：纯空间移动（无回合制）。走近战团（≥intelAt）首次触发观战情报。
    caveMove(x, pos) {
      const f = this.cur(x);
      if (f.kind !== "cave") return { ok: false };
      const map = this.mapOf(f);
      if (pos < 0 || pos >= map.W) return { ok: false, reason: "无路" };
      // 战团所在格不可踏入（人家正打着）
      if ((map.watchers || []).some(wt => wt.pos === pos)) return { ok: false, reason: "战团方向不可近——绫光剑气未长眼" };
      f.pos = pos;
      const events = [];
      // 声纹梯度：离战团越近听得越真——每跨进一档触发一次（远闻其声，近见其形）
      const nearest = (map.watchers || []).reduce((m, wt) => Math.min(m, Math.abs(wt.pos - pos)), 99);
      (map.soundCues || []).forEach((cue, i) => {
        f._heard = f._heard || {};
        if (nearest <= cue.dist && !f._heard[i]) {
          f._heard[i] = true;
          events.push({ type: "sound", text: cue.text, sfx: cue.sfx });
        }
      });
      // 近身惊动：落点在战团跟前=每一步都在它耳边（取最里档；首次进档附说明）
      const wasBlown = map.exposeLimit ? (f.expose || 0) >= map.exposeLimit : false;
      const band = (map.nearExpose || []).find(b => nearest <= b.dist);
      if (band) {
        f.expose = (f.expose || 0) + band.expose;
        f._nearSeen = f._nearSeen || {};
        events.push({ type: "near", expose: band.expose,
          text: !f._nearSeen[band.dist] ? band.note : null });
        f._nearSeen[band.dist] = true;
      }
      if (!f.intel.cave_watch && pos >= (map.intelAt != null ? map.intelAt : 99)) {
        f.intel.cave_watch = true;
        f.expose = (f.expose || 0) + (map.intelExpose || 0);
        events.push({ type: "intel", text: map.intelNote });
      }
      // 走动走漏了风声：在这一步越过惊动线（与采集的 blown 同语义）
      if (!wasBlown && map.exposeLimit && (f.expose || 0) >= map.exposeLimit) {
        events.push({ type: "blown" });
      }
      return { ok: true, events, expose: f.expose };
    },

    // 采热点：须走到跟前（同格或邻格）。loot 入袋、暴露累积。
    caveTake(x, hotId) {
      const f = this.cur(x);
      if (f.kind !== "cave") return { ok: false };
      const map = this.mapOf(f);
      const hot = (map.hotspots || []).find(h => h.id === hotId);
      if (!hot || f.taken[hotId]) return { ok: false, reason: "已采过" };
      if (Math.abs(f.pos - hot.pos) > 1) return { ok: false, reason: "隔得太远，够不着" };
      f.taken[hotId] = true;
      Object.entries(hot.loot).forEach(([k, n]) => { x.bag[k] = (x.bag[k] || 0) + n; });
      f.expose = (f.expose || 0) + (hot.expose || 0);
      const blown = map.exposeLimit ? f.expose >= map.exposeLimit : false;
      return { ok: true, loot: hot.loot, expose: f.expose, blown };
    },

    // 布置到格：阵旗/伏符落在具体格子上——开战时原格生效（诱敌入阵的物理语义）。
    // 道具校验/扣除由 engine 做（引擎不触 State），这里只记账。
    cavePlace(x, prepId, cell) {
      const f = this.cur(x);
      if (f.kind !== "cave") return { ok: false };
      const map = this.mapOf(f);
      const p = (map.preps || []).find(pp => pp.id === prepId);
      if (!p) return { ok: false };
      if (f.preps[prepId] != null) return { ok: false, reason: "已布下" };
      if (cell < 0 || cell >= map.W) return { ok: false, reason: "落点无效" };
      if ((map.watchers || []).some(wt => wt.pos === cell)) return { ok: false, reason: "战团脚下布不得" };
      if (Math.abs(f.pos - cell) > 2) return { ok: false, reason: "隔得太远——走近些再布" };
      f.preps[prepId] = cell;
      f.expose = (f.expose || 0) + (p.expose || 0);
      return { ok: true, prep: p, cell, expose: f.expose };
    },

    // 开战参数：玩家站位/布置格/情报/惊动/友军战耗，全部带进对阵轴
    // 同轴一体：没采完的热点也上轴（战中走到跟前花一个主行动照采——贪在战斗里也是贪）
    caveFightInfo(x) {
      const f = this.cur(x);
      if (f.kind !== "cave") return null;
      const map = this.mapOf(f);
      const beast = (map.watchers || []).find(wt => wt.beast);
      const ally = (map.watchers || []).find(wt => wt.ally);
      const blown = map.exposeLimit ? (f.expose || 0) >= map.exposeLimit : false;
      return {
        enemy: map.fight.enemy, ally: map.fight.ally, cue: map.fight.cue,
        playerPos: f.pos, W: map.W,
        enemyPos: beast ? beast.pos : map.W - 1,
        allyPos: ally ? ally.pos : null,
        preps: f.preps, prepDefs: map.preps || [],
        intel: !!f.intel.cave_watch,
        blown,
        sneak: !blown,    // 未惊动=偷袭开局（敌措手不及）
        sceneBg: map.bg,  // 战场底图继承洞窟（开战不换天地）
        hotspots: (map.hotspots || []).filter(h => !f.taken[h.id])
          .map(h => ({ id: h.id, pos: h.pos, name: h.name, loot: h.loot })),
        takenCount: Object.keys(f.taken || {}).length,
        allyDrain: map.allyDrain || 0,
      };
    },
  };

  root.ExploreMap = ExploreMap;
  if (typeof module !== "undefined" && module.exports) module.exports = ExploreMap;

})(typeof window !== "undefined" ? window : globalThis);
