/* ============================================================
 * exploremap.js — 箱庭探索 v3 · L1 舆图 + L2 楼阁 + L3 深窟 · 嵌套栈
 *
 * 设计（docs/explore-redesign.md 定稿）：
 *  - L1 野外舆图：地标节点+连线，移动耗灾厄钟；"用时间换安全"的战略层。
 *  - 巡逻威胁：会动的敌人棋子（封岳），相遇=对阵轴开打；路上永不随机强战。
 *  - 血幕收缩：钟到点关闭外环节点——地图本身在恶化。
 *  - 嵌套栈：节点可为子图入口（L2 楼阁 / L3 横版深窟），进=压栈、出=弹栈。
 *  - L2 楼阁层：多楼层平面图，楼梯切换楼层；每层节点+连线同 L1 逻辑。
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
      // 箱庭演出层（B3·2026-07-11 用户提案"箱庭也要据点级演出"）：
      //   ambience=常驻天象（fx 氛围粒+amb 声床+loops 间歇远声，UI._startExmapAmbience 起/收）；
      //   step=走格脚步声材质（grass/gravel/stone/mud/snow——节点可覆写）
      step: "grass",
      ambience: {
        fog: { tint: "158,84,94", opacity: 0.75 },   // 赤雾成片慢漂（DOM 雾层，非光斑粒）
        amb: "wind", ambVol: 0.2,
        loops: [{ lo: 14000, hi: 30000, sfx: "farRoar" }],   // 血雾深处不知名的兽吼
      },
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
        // polish-huangfeng D2（GPT P1-5）：禁地普通层暖身战——血煞兽（jindi_beast·130HP）终于有处可遇。
        // 可绕开：岩穴与花圃间的岔场（直连边仍在，不猎照走）；猎杀走既有 exmapHunt 管线（huntEnemy 节点级指定）。
        xunchang:{ name: "血煞兽巡场", kind: "danger", x: 32, y: 40, icon: "🩸",
                   huntEnemy: "jindi_beast", huntName: "血煞兽",
                   desc: "洼地里蹄爪印纵横、腥气刺鼻——血雾里游荡的血煞兽把这片草甸当了食场。绕开便是，但兽巢边的主药没人敢采。",
                   loot: { xueshi_zhuyao: 1, lingshi: 2 }, rich: false },
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
        // 血煞兽巡场：岩穴↔花圃的岔线（1+1 钟=与直线 2 钟等价——它在"路边"而非"路上"，可绕开）
        ["yanxue", "xunchang", 1], ["xunchang", "huapu", 1],
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
      // 巡场猎杀文案（D2 暖身战·胜负两报）
      huntWinNote: "血煞兽轰然扑倒，血雾里的腥气散了大半——巡场归于死寂，兽巢边那几株没人敢采的主药，如今是你的了。",
      huntLoseNote: "血煞兽的爪风撕开你的衣襟，你且战且退才甩脱了它——这头畜生守着食场，急不得。养好气血再来，或者干脆绕开。",
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
      // 箱庭演出层（B3）：城中=石板脚步 + 暖尘浮光 + 市声底床
      step: "stone",
      ambience: {
        fx: "dust", fxOpts: { interval: 380, cap: 12 },
        amb: "market", ambVol: 0.22,
      },
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

    /* ====== 后山 · L1 野外战争迷雾舆图（七玄门篇·猎王篇） ======
     * fog:true → 四态可见性（未知/窥见/风闻/已至）+ 三揭法（邻接/瞭望/远距感知）
     * 无灾厄钟、无巡逻——脚程折耗月（clock 仅作计数，不关节点）
     * 客观层：血食谷有妖兽王（异闻在耳=那一头）；传闻层：只降雾不增删世界 */
    houshan_l1: {
      id: "houshan_l1", kind: "field", fog: true,
      name: "七玄门后山",
      subtitle: "雾锁千山 · 猎王之道",
      bg: "houshan",
      clockMax: 0,               // 无灾厄钟（脚程折耗月，不关节点）
      entry: "linkou",
      // 箱庭演出层（B3）：林间=草地脚步 + 白岚横游 + 风床 + 偶有鸟鸣
      step: "grass",
      ambience: {
        fog: { tint: "196,209,205", opacity: 0.65 },   // 山岚白雾成片（DOM 雾层）
        amb: "wind", ambVol: 0.18,
        loops: [{ lo: 9000, hi: 20000, sfx: "bird" }],
      },
      nodes: {
        linkou:   { name: "林口", kind: "exit", x: 50, y: 82, icon: "◈",
                    desc: "后山入口的林缘。荆棘拨开，雾气便扑面而来——再往里，便没有现成的路了。" },
        caoyao:   { name: "采药小径", kind: "gather", x: 30, y: 62, icon: "🌿",
                    desc: "一条隐在灌木间的小径，灵草的气息混着泥土味飘来。",
                    loot: { lingcao: 2 } },
        guteng:   { name: "古藤深坡", kind: "gather", x: 72, y: 58, icon: "🌿",
                    desc: "老藤盘坡，岩缝间生着几株品相不差的灵草——坡陡，脚下得稳。",
                    loot: { lingcao: 3, duyao_cao: 1 } },
        wanglang: { name: "望狼石", kind: "lore", x: 50, y: 40, icon: "⛰",
                    desc: "一块突兀的巨石，登顶可俯瞰半片后山——雾气在此处薄了些。",
                    reveals: ["wulin", "xuegu", "qixue"],
                    lookoutNote: "登石一望，雾海翻涌间，林深处的一片阴影与一股血腥气赫然入目。" },
        qixue:    { name: "栖息岩穴", kind: "rest", x: 22, y: 38, icon: "⛺",
                    desc: "一处背风的岩洞，地上有旧火堆的痕迹——前人来过后山的证据。" },
        wulin:    { name: "雾林深处", kind: "gather", x: 68, y: 24, icon: "🌲",
                    desc: "雾气最浓的地带，能见度不过数丈。灵草的香气和某种腥味交织在一起。",
                    loot: { lingcao: 3, duyao_cao: 2 } },
        xuegu:    { name: "血食谷", kind: "danger", x: 48, y: 12, icon: "🩸",
                    desc: "碎骨遍地、腥气冲鼻——这是后山霸主的食场。那头异闻中的妖兽王，就盘踞在此。",
                    loot: { lingshi: 3, lingcao: 2 }, rich: true,
                    beastEnemy: true },
      },
      edges: [
        ["linkou", "caoyao", 1], ["linkou", "guteng", 1],
        ["caoyao", "guteng", 2], ["caoyao", "qixue", 1], ["caoyao", "wanglang", 1],
        ["guteng", "wanglang", 1], ["guteng", "wulin", 2],
        ["wanglang", "wulin", 1], ["wanglang", "qixue", 2],
        ["wulin", "xuegu", 2], ["qixue", "xuegu", 3],
      ],
      // 远距感知梯度：血食谷的兽吼/血腥气——四档由远及近（只报方位强弱，不报精确坐标）
      senseSources: [
        { node: "xuegu", kind: "beast", bands: [
          { within: 5, level: 1, text: "远处隐有兽吼传来，在雾里闷闷地响。" },
          { within: 4, level: 2, text: "兽吼渐清晰，混着一股若有若无的腥气。" },
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

    /* ====== 阴冥之地 · L1 灰白荒原走格图（外海风云篇·幕四·绝灵小篇章） ======
     * 返修池点名项（waihaifengyun-design §八决议6）：阴冥段从"地点轴暂驻"升级为独立走格图。
     * fog:true 复用后山战争迷雾（灰白迷障=天然雾）；无灾厄钟（风眼日期是剧情锚不是倒计时）。
     * jueling:true → 绝灵规则：走格/驻守不回灵（灵力提不起来），只养气血；
     * 巢穴猎杀走凡人战力（engine.startYinmingChaoFight·_mortalFighter），非灵力遭遇。
     * 唯一出口=风口栈道（山半腰）——离图即接主线 whfy_a4_baofeng（温天仁狭路）。 */
    yinming_l1: {
      id: "yinming_l1", kind: "field", fog: true, jueling: true,
      name: "阴冥之地 · 暴风山道",
      subtitle: "灰白无日 · 凡人步量",
      bg: "yinming_plain",
      clockMax: 0,               // 无灾厄钟（绝地里的日子按脚程折月，不关节点）
      entry: "cun",
      exitLabel: "攀上风口栈道 · 向罗睺裂缝（接主线）",
      // 箱庭演出层（B3）：绝地=碎石脚步 + 灰白死雾 + 干风床 + 阴兽远啸
      step: "gravel",
      ambience: {
        fog: { tint: "168,175,184", opacity: 0.7 },   // 灰白死雾成片慢漂（DOM 雾层）
        amb: "wind", ambVol: 0.3,
        loops: [{ lo: 16000, hi: 34000, sfx: "farRoar" }],
      },
      huntWinNote: "母巢塌了。阴兽的磷光一盏盏熄灭——吃惯了人味的兽群断了根，这条上山的路，从今夜起干净了。巢里坠雾者的遗物，正可细细搜刮。",
      huntLoseNote: "母巢的阴兽前赴后继，你且战且退、裹着伤退回了阴冥村口——凡人的仗急不得。养好气力，再来。",
      nodes: {
        cun:     { name: "阴冥村", kind: "rest", x: 50, y: 84, icon: "🏮", step: "stone",
                   desc: "石屋聚落蜷在荒原边上，村口一盏豆大的油灯。经了祭品之夜，村人待你们如再生父母——歇脚裹伤，都在这儿。" },
        huiyuan: { name: "灰白荒原", kind: "gather", x: 30, y: 66, icon: "🌿", step: "grass",
                   desc: "灰白的荒草齐膝，风过时像一片死水起了皱。村民说荒原里的灰喉草能淬毒，碎石棱子磨一磨就是暗器。",
                   loot: { duyao_cao: 2, anqi: 3 } },
        linzhao: { name: "磷火沼", kind: "gather", x: 68, y: 64, icon: "✨", step: "mud",
                   desc: "沼泽上磷火明灭，绿幽幽地飘——村里孩子叫它「鬼灯」。沼边的止血苔是这绝地里最金贵的药材。",
                   loot: { duyao_cao: 3, huixue_dan: 1 } },
        shaota:  { name: "戍风哨塔", kind: "lore", x: 48, y: 48, icon: "⛰",
                   desc: "半塌的石塔，不知是哪一代困居者垒的——登塔可望半座暴风山。",
                   reveals: ["jiuzhan", "chao", "zhandao"],
                   lookoutNote: "登塔一望：东面荒原上一片狼藉的旧营地、西面洼地里磷光聚成一团、山腰间一线栈道若隐若现——上山的路，看清了。" },
        jiuzhan: { name: "古战场", kind: "gather", x: 76, y: 40, icon: "🩸",
                   desc: "荒原上散着几十具白骨，兵刃锈成了红土——都是历代坠雾进来、没能等到裂缝的人。储物袋在这儿只是皮囊，可皮囊里的凡物还在。",
                   loot: { huixue_dan: 2, anqi: 4, lingshi: 3 }, rich: true },
        chao:    { name: "阴兽母巢", kind: "danger", x: 24, y: 36, icon: "🕳",
                   huntName: "阴兽母巢",
                   desc: "洼地深处磷光密如星子——大长老拿活人喂了几十年的阴兽群，源头就在这窝里。兽群吃惯了人味：不端了它，上山的路夜夜有伏兵。",
                   loot: { huixue_dan: 2, duyao_cao: 3, lingshi: 4 }, rich: true },
        yanwo:   { name: "避风岩窝", kind: "rest", x: 62, y: 26, icon: "⛺",
                   desc: "山脚一处背风的岩窝，有前人生火的焦痕——攀山前最后一处能合眼的地方。" },
        zhandao: { name: "风口栈道", kind: "exit", x: 50, y: 10, icon: "◈", step: "stone",
                   desc: "半腰栈道自此而上，罡风一阵紧过一阵——罗睺之息将至，山顶的灰云里那道裂缝将现，时机稍纵即逝。" },
      },
      edges: [
        ["cun", "huiyuan", 1], ["cun", "linzhao", 1],
        ["huiyuan", "shaota", 1], ["linzhao", "shaota", 1],
        ["linzhao", "jiuzhan", 2], ["shaota", "jiuzhan", 1],
        ["shaota", "chao", 1], ["huiyuan", "chao", 2],
        ["chao", "yanwo", 2], ["jiuzhan", "yanwo", 1],
        ["yanwo", "zhandao", 1], ["chao", "zhandao", 2],
      ],
      // 远距感知：阴兽母巢的腐腥气（绝灵之地神识出不了三尺——靠的是猎户的鼻子）
      senseSources: [
        { node: "chao", kind: "beast", bands: [
          { within: 4, level: 1, text: "风里有一缕若有若无的腐味，像什么东西在洼地里烂着。" },
          { within: 2, level: 2, text: "腐腥气渐浓，脚下碎石缝里开始见到阴兽蜕下的甲皮。" },
          { within: 1, level: 3, text: "磷光密如星子、腥气扑面——母巢就在眼前的洼地里。" },
        ] },
      ],
      notes: [
        "灰白的天穹低低压着，没有日月，也没有影子。",
        "风掠过荒草，声音干得像纸。",
        "远处磷火一明一灭，不知是鬼灯还是阴兽的眼睛。",
        "你下意识运了口气——丹田里静得像口枯井。凡人，就是凡人。",
        "紫灵与梅凝一前一后跟着，三个人的脚步声在荒原上格外清楚。",
        "路边一块石头上刻着道歪歪扭扭的箭头——前人留给后人的路标。",
      ],
    },

    /* ====== 墨蛟山洞 · L3 轴式洞窟（与对阵轴同构——探索/布阵/战斗同一条轴） ====== */
    mojiao_cave: {
      id: "mojiao_cave", kind: "cave",
      name: "深潭洞窟",
      step: "stone",   // B3 洞窟脚步：潭岸岩台的石地轻响
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

    /* ====== 测试用 L2 楼阁层（虚天殿内殿·简化版） ======
     * 楼层制：每层 = 一张 L1 式平面图（rooms+edges）；楼梯节点切换楼层。
     * kind: "tower" → _mkFrame 以 field 模式运行，mapOf 返回当前层 pseudo-map。
     * node.kind 新增：stairs_up（上楼）/ stairs_down（下楼） */
    test_tower_l2: {
      id: "test_tower_l2", kind: "tower",
      name: "虚天殿·内殿",
      bg: "xutian_neidian",
      entryFloor: 0,
      notes: [
        "殿内灵压沉沉，廊柱上的符纹忽明忽灭。",
        "远处传来阵法运转的嗡鸣，像心跳。",
      ],
      floors: [
        {
          name: "一层·前殿",
          entry: "entrance",
          rooms: {
            entrance:  { name: "殿门", kind: "exit", x: 50, y: 82, icon: "◈",
                         desc: "虚天殿内殿入口。灵光透过门缝洒出来，里面静得像坟墓。" },
            main_hall:  { name: "正殿", kind: "lore", x: 50, y: 50, icon: "📜",
                         desc: "正殿中央，虚天鼎的灵光透过禁制隐约可见——但禁制太强，近不得。",
                         read: "禁制上的符文你认得大半——这是一座元婴级困阵，硬闯是自寻死路。" },
            side_room:  { name: "偏室", kind: "gather", x: 25, y: 45, icon: "🌿",
                         desc: "一间不大的偏室，角落散落着前人遗物。",
                         loot: { lingshi: 3 } },
            stairs_up:  { name: "登仙梯", kind: "stairs_up", x: 75, y: 30, icon: "↑",
                         desc: "通往二楼的阶梯。灵压越往上越重，像有什么东西压着。" },
          },
          edges: [
            ["entrance", "main_hall", 1],
            ["main_hall", "side_room", 1],
            ["main_hall", "stairs_up", 1],
          ],
        },
        {
          name: "二层·藏宝阁",
          intro: "登上二层，灵压骤然加重。廊道尽头隐有金光——藏宝阁到了。",
          rooms: {
            stairs_down: { name: "阶梯下来", kind: "stairs_down", x: 75, y: 82, icon: "↓",
                           desc: "从一层上来，灵压明显更重了。" },
            corridor:    { name: "回廊", kind: "lore", x: 50, y: 60, icon: "📜",
                           desc: "回廊两侧刻满了古修士的壁画——修炼、斗法、飞升，一图接一图。",
                           read: "壁画末尾有一幅残图：一位古修士手持虚天鼎，鼎中炼化万物——这是虚天殿的由来。" },
            treasure:    { name: "藏宝阁", kind: "gather", x: 40, y: 30, icon: "💎",
                           desc: "藏宝阁中宝光隐隐。架上有几件品相不差的灵材。",
                           loot: { lingshi: 5, lingcao: 2 }, rich: true },
            stairs_up2:  { name: "顶层梯", kind: "stairs_up", x: 70, y: 25, icon: "↑",
                           desc: "通往顶层的窄梯。上面灵压如山——怕是有大阵镇守。" },
          },
          edges: [
            ["stairs_down", "corridor", 1],
            ["corridor", "treasure", 1],
            ["corridor", "stairs_up2", 2],
          ],
        },
        {
          name: "顶层·阵眼",
          intro: "顶层灵压如山。正中一座大阵，阵眼处灵光流转——这就是虚天殿的禁制核心。",
          rooms: {
            stairs_down2: { name: "窄梯下来", kind: "stairs_down", x: 70, y: 82, icon: "↓",
                            desc: "从二层上来，灵压重得像扛着一座山。" },
            array_eye:    { name: "阵眼", kind: "danger", x: 50, y: 45, icon: "⚔",
                            desc: "大阵阵眼——灵光流转间，隐约可见虚天鼎的影子被封在阵心。",
                            beastEnemy: true },
            final_room:   { name: "内室", kind: "enter", x: 30, y: 30, icon: "🕳",
                            sub: "mojiao_cave", boss: true,
                            desc: "阵眼后方一间密室。门上的符纹已暗——里面似乎通向更深处。" },
          },
          edges: [
            ["stairs_down2", "array_eye", 1],
            ["array_eye", "final_room", 1],
          ],
        },
      ],
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
      // L2 楼阁层：多楼层——frame 以 field 模式运行（复用 L1 全部逻辑），
      //   mapOf 返回当前层的 pseudo-map；楼梯节点触发 floorChange
      if (map.kind === "tower") {
        f.kind = "field";   // 对 L1 逻辑透明（travel/options/gather 等零改动）
        f.floor = map.entryFloor || 0;
        const fl = map.floors[f.floor];
        f.node = (fl && (fl.entry || Object.keys(fl.rooms)[0])) || null;
        if (f.node) f.visited[f.node] = true;
      }
      // 战争迷雾（map.fog 选启）：四态可见性——glimpsed 窥见 / rumored 风闻；visited 已至沿用 f.visited
      // hunted：巢穴猎物已伏诛（与 cleared「采尽」分开记——先猎杀，方可搜刮）
      if (map.fog) { f.glimpsed = {}; f.rumored = {}; f.senseBand = {}; f.hunted = {}; }
      if (map.entry) f.visited[map.entry] = true;
      if (map.fog && map.entry) this._revealFrom(f, map, map.entry, null);   // 入口即点亮四邻（+登高揭片）
      return f;
    },

    cur(x) { return x.stack[x.stack.length - 1]; },
    mapOf(f) {
      const map = MAPS[f.mapId];
      // L2 楼阁层：返回当前层的 pseudo-map（对 L1 逻辑透明）
      if (map && map.kind === "tower" && map.floors) {
        const fl = map.floors[f.floor || 0];
        return {
          id: map.id, kind: "field",
          nodes: fl.rooms, edges: fl.edges || [],
          notes: map.notes, clockMax: 0, fog: false,
        };
      }
      return map;
    },

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

    /* ---------- L1 舆图：选项与移动 ---------- */
    _neighbors(map, nodeId) {
      const out = [];
      (map.edges || []).forEach(([a, b, cost]) => {
        if (a === nodeId) out.push({ id: b, cost: cost || 1 });
        else if (b === nodeId) out.push({ id: a, cost: cost || 1 });
      });
      return out;
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

      // L2 楼阁层：抵达楼梯节点 → 发 stairs 事件（engine 可自动或手动触发 floorChange）
      if (node.kind === "stairs_up" || node.kind === "stairs_down") {
        events.push({ type: "stairs", direction: node.kind === "stairs_up" ? "up" : "down", node: nodeId });
      }
      events.push({ type: "arrive", node: nodeId, firstVisit, nodeDef: node });
      return { ok: true, events };
    },

    /* ---------- L2 楼阁层：楼层切换 ---------- */
    // direction: "up" | "down"——在楼梯节点上调用，切换到相邻楼层
    floorChange(x, direction) {
      const f = this.cur(x);
      const map = MAPS[f.mapId];
      if (!map || map.kind !== "tower") return { ok: false, reason: "非楼阁" };
      const newFloor = (f.floor || 0) + (direction === "up" ? 1 : -1);
      if (newFloor < 0 || newFloor >= map.floors.length) return { ok: false, reason: "无路可去" };
      const newDef = map.floors[newFloor];
      // 在新层找匹配的楼梯入口（上楼→找 stairs_down，下楼→找 stairs_up）
      const want = direction === "up" ? "stairs_down" : "stairs_up";
      let entryRoom = null;
      for (const [id, r] of Object.entries(newDef.rooms)) {
        if (r.kind === want) { entryRoom = id; break; }
      }
      if (!entryRoom) entryRoom = newDef.entry || Object.keys(newDef.rooms)[0];
      f.floor = newFloor;
      f.node = entryRoom;
      const firstVisit = !f.visited[entryRoom];
      f.visited[entryRoom] = true;
      const events = [
        { type: "floorChange", floor: newFloor, floorName: newDef.name || `第${newFloor + 1}层`,
          room: entryRoom, firstVisit },
      ];
      if (newDef.intro) events.push({ type: "note", text: newDef.intro });
      return { ok: true, events };
    },

    // 当前楼层信息（UI 用）
    floorInfo(x) {
      const f = this.cur(x);
      const map = MAPS[f.mapId];
      if (!map || map.kind !== "tower") return null;
      const fl = map.floors[f.floor || 0];
      return { floor: f.floor || 0, total: map.floors.length, name: (fl && fl.name) || "" };
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
