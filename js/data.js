/* ============================================================
 * data.js — 静态数据 / 配置（忠于「七玄门篇」设定圣经）
 * 见 docs/lore-七玄门篇.md
 * ============================================================ */

const DATA = {};

/* ---------- 灵根资质 ----------
 * 韩立为四灵根（平庸）。测灵根时按动画设定，绝大多数为多灵根/伪灵根。
 * cul = 修为增长系数（越低越慢），breakBonus = 突破成功率加成
 */
DATA.spiritRoots = [
  { id: "tian",  name: "天灵根",   weight: 1,  cul: 2.4, breakBonus: 0.25, color: "#f0d493",
    desc: "万中无一的单灵根，修炼速度奇快，乃天生的仙苗。" },
  { id: "shuang", name: "双灵根",  weight: 6,  cul: 1.7, breakBonus: 0.12, color: "#9a7fd4",
    desc: "双属性灵根，资质上佳，前途不可限量。" },
  { id: "san",   name: "三灵根",   weight: 16, cul: 1.25, breakBonus: 0.05, color: "#7fe3c0",
    desc: "三属性灵根，资质中上，勤修亦可有所成。" },
  { id: "si",    name: "四灵根",   weight: 30, cul: 0.9, breakBonus: 0.0, color: "#6aa0d4",
    desc: "四属性杂灵根，资质平庸。修炼缓慢，唯有以苦修与万全准备弥补天资。" },
  { id: "wu",    name: "五灵根",   weight: 30, cul: 0.7, breakBonus: -0.05, color: "#8b97a7",
    desc: "五行俱全的伪灵根，资质低劣，修行举步维艰，多止步于练气。" },
];

// 韩立的命定灵根（默认随机偏向四灵根，符合原著）
DATA.fixedRootId = "si";

/* ---------- 境界体系 ----------
 * 七玄门篇封顶练气期。练气分层（动画/原著为十三层），本 MVP 做到练气七层即触发主线收尾。
 * culMax = 该层「修为」上限；spMax = 灵力上限基准
 */
DATA.realms = [
  { tier: "qi", layer: 1,  name: "练气一层",  culMax: 100,  spMax: 100,  lifespan: 0 },
  { tier: "qi", layer: 2,  name: "练气二层",  culMax: 160,  spMax: 140,  lifespan: 0 },
  { tier: "qi", layer: 3,  name: "练气三层",  culMax: 240,  spMax: 190,  lifespan: 5 },
  { tier: "qi", layer: 4,  name: "练气四层",  culMax: 340,  spMax: 250,  lifespan: 0 },
  { tier: "qi", layer: 5,  name: "练气五层",  culMax: 470,  spMax: 320,  lifespan: 5 },
  { tier: "qi", layer: 6,  name: "练气六层",  culMax: 640,  spMax: 400,  lifespan: 0 },
  { tier: "qi", layer: 7,  name: "练气七层",  culMax: 860,  spMax: 500,  lifespan: 10 },
  // —— 练气八层以上：须习得《长春功·后篇》方可冲击（考据：长春功十三层对应练气十三层，
  //    韩立修至十一层服筑基丹）。黄枫谷篇主场，七玄门篇锁定。 ——
  { tier: "qi", layer: 8,  name: "练气八层",  culMax: 1140, spMax: 620,  lifespan: 0 },
  { tier: "qi", layer: 9,  name: "练气九层",  culMax: 1500, spMax: 760,  lifespan: 5 },
  { tier: "qi", layer: 10, name: "练气十层",  culMax: 1950, spMax: 920,  lifespan: 0 },
  { tier: "qi", layer: 11, name: "练气十一层", culMax: 2500, spMax: 1100, lifespan: 5 },
  { tier: "qi", layer: 12, name: "练气十二层", culMax: 3200, spMax: 1300, lifespan: 0 },
  { tier: "qi", layer: 13, name: "练气十三层", culMax: 4000, spMax: 1550, lifespan: 10 },
  // —— 筑基期（大境界：服筑基丹+秘仪冲关，见 DATA.bigRealmRites.foundation）——
  { tier: "foundation", layer: 1, name: "筑基初期",   culMax: 6000,  spMax: 2400, lifespan: 80, big: true },
  { tier: "foundation", layer: 2, name: "筑基中期",   culMax: 8200,  spMax: 3100, lifespan: 0 },
  { tier: "foundation", layer: 3, name: "筑基后期",   culMax: 11000, spMax: 3900, lifespan: 40 },
  { tier: "foundation", layer: 4, name: "筑基大圆满", culMax: 15000, spMax: 4900, lifespan: 0 },
  // —— 结丹期（大境界：觅长生式渡劫——三转重元功+大衍诀三层+降尘丹/雪灵水/天火液/妖丹，见 DATA.bigRealmRites.core）——
  //    初入星海篇章末「金丹大成」= 结丹初期（realmTier 1→2）。结丹中后期/大圆满为后续篇章（星海飞驰）预留。
  { tier: "core", layer: 1, name: "结丹初期",   culMax: 28000, spMax: 9000,  lifespan: 320, big: true },
  { tier: "core", layer: 2, name: "结丹中期",   culMax: 38000, spMax: 11500, lifespan: 0 },
  { tier: "core", layer: 3, name: "结丹后期",   culMax: 52000, spMax: 14500, lifespan: 100 },
  { tier: "core", layer: 4, name: "结丹大圆满", culMax: 70000, spMax: 18000, lifespan: 0 },
];

// 本篇可突破到的最高境界索引（练气七层之后即进入主线收尾，封锁筑基）
DATA.realmCapIndex = 6; // 对应练气七层

/* ---------- 物品 ----------
 * rarity: common / rare / epic
 */
DATA.items = {
  qingyuan_dan: { name: "养元丹",   rarity: "common", type: "pill",
    desc: "墨大夫药庐中的寻常丹药，服用后恢复灵力，略助修炼。", effect: { sp: 60, cul: 20 } },
  huixue_dan:   { name: "金疮药",   rarity: "common", type: "pill",
    desc: "墨大夫所制的疗伤之药，恢复气血。", effect: { hp: 50 } },
  ningshen_dan: { name: "凝神丹",   rarity: "rare", type: "pill",
    desc: "安神定志，平复心境、压制心魔。", effect: { mood: 40, demon: -20 } },
  // 小绿瓶催熟灵药服食 —— 韩立逆袭的核心
  lingyao_dan:  { name: "灵乳灵药", rarity: "rare", type: "pill",
    desc: "小绿瓶催熟的珍稀灵药，灵气浓郁。服之大补修为，是韩立瞒着墨大夫精进的本钱。", effect: { cul: 60, sp: 40 } },
  zhuji_dan:    { name: "筑基丹",   rarity: "epic", type: "pill",
    desc: "突破练气、凝聚灵根成基的无价之宝。入谷那日你曾握过一枚——它离开掌心的模样，你记到今天。（练气十一层后，于洞府行「尝试突破」冲击筑基）", effect: {} },
  lingcao:      { name: "灵草",     rarity: "common", type: "material",
    desc: "可入药的低阶灵草，栽入小绿瓶催熟后可炼成灵药。" },
  duyao_cao:    { name: "毒草",     rarity: "rare", type: "material",
    desc: "墨大夫药圃所植的毒草。经小绿瓶催熟后毒性剧增，是反杀墨大夫的杀招。" },
  lingshi:      { name: "下品灵石", rarity: "rare", type: "currency",
    desc: "蕴含灵气的灵石，修仙界的硬通货，亦可辅助修炼。" },
  zhayan_jian:  { name: "眨眼剑法", rarity: "rare", type: "skill",
    desc: "诡谲难测的近身剑法，身形快如眨眼。决战墨大夫的杀招之一。" },
  anqi:         { name: "暗器飞针", rarity: "common", type: "consumable",
    desc: "韩立惯用的隐藏飞针，无视部分闪避。战斗中「暗器飞针」招式的底牌，用一支少一支。" },
  shengxian_ling: { name: "升仙令", rarity: "epic", type: "key",
    desc: "金光上人的遗宝，乃踏入更高门派、求取筑基机缘的凭证。持此可赴黄枫谷。" },
  jinfu:        { name: "金符",     rarity: "epic", type: "treasure",
    desc: "金光上人遗物，金光灿灿的符箓，威力不俗。（后续章节可用）" },
  jinzhong_zhao:{ name: "金钟罩",   rarity: "epic", type: "treasure",
    desc: "金光上人的护身法宝，可结成金色钟罩护体。（后续章节可用）" },

  /* —— 符箓底牌（修仙界通货：一点灵气点燃符中封存的法术）——
   * 穷靠本命，富靠符箓：灵根缺什么行，花钱买什么符（克制轴的经济入口）。 */
  huoshe_fu:    { name: "火蛇符",   rarity: "rare", type: "consumable",
    desc: "符上封存火蛇之术，一点灵气即可激发。火克金——金行强敌（金钟罩、金行妖王）的破局之物。战斗底牌，用一张少一张。" },
  hanbing_fu:   { name: "寒冰符",   rarity: "rare", type: "consumable",
    desc: "符上封存寒冰锥击。水克火——火行凶兽的对策。战斗底牌，用一张少一张。" },
  jinguang_zhuan: { name: "符宝·金光砖", rarity: "epic", type: "treasure",
    desc: "金光上人赖以成名的符宝，韩立的第一件符宝。金光化砖凌空砸落，势大力沉且破甲。以充能催动，灵石可回充。" },
  jinguang_zhuan_charge: { name: "金光砖·充能", rarity: "rare", type: "consumable",
    desc: "金光砖中蕴存的灵力充能。战斗中每催动一次金光砖，耗去一道。" },
  nuanyang_yu: { name: "暖阳宝玉", rarity: "epic", type: "treasure",
    desc: "墨家祖传的护身宝玉，温润如春。它是墨彩环的嫁妆——「我不成亲，便不需要嫁妆了呀。」寒毒既解，玉犹有余温。" },

  /* —— 太南小会（离门远行）：修仙集市的家底 —— */
  changchun_houpian: { name: "《长春功》后篇全本", rarity: "epic", type: "book",
    desc: "长春功八至十三层全本，并载火弹术、御风诀、天眼术诸般小法术。卖家收钱时塞回来一块灵石：「你给多了，我们不占便宜。」（闭关时可研习）" },
  zhifu_bi: { name: "制符笔", rarity: "rare", type: "treasure",
    desc: "笔锋以灵兽尾毫所制，隐有灵光——摊主说原主是位姓菡的御灵宗女修。有此笔，他日学得制符之术，便可自画符箓（黄枫谷篇解锁）。" },
  fu_zhi: { name: "下阶符纸", rarity: "common", type: "material",
    desc: "以灵竹浆制成的空白符纸，制符的根基材料。眼下还用不上——但修仙人的家底，从来都是提前备下的。" },
  zheling_canbao: { name: "遮灵残宝", rarity: "rare", type: "treasure",
    desc: "一面残缺的青铜小镜，能遮掩周身灵气波动。配合那只神秘小瓶使用，足以瞒过大多数修士的耳目——藏拙者的至宝。" },

  /* —— 黄枫谷入门发放（入谷·吴师叔）：外门弟子制式低阶物品（多源核定：升仙令入谷，
   * 门派发放黄丝衫/青叶飞行法器/一柄下品战斗法器/储物袋等——详见 combat-arsenal §3.8。
   * 「烈阳剑」系坊间讹传，非正典：烈阳乃烈阳花（材料），故不取此名，落实为一柄制式铁剑）—— */
  waimen_tiejian: { name: "外门铁剑", rarity: "common", type: "gear",
    desc: "黄枫谷外门弟子制式下品法器：一柄寻常铁铸飞剑，灵力催动可御使飞刺。寒酸归寒酸——却是你头一件正经战斗法器，从此御剑有了凭依。" },

  /* —— 万宝楼二层：顶阶法器（练气十一层方可驱使——韩立血色禁地的底气）—— */
  jinfuzi_ren: { name: "金蚨子母刃", rarity: "epic", type: "gear",
    desc: "顶阶攻击法器：一大一小双刃如金蚨子母相随，可分进合击。练气十一层方可驱使。" },
  xuantie_dun: { name: "玄铁巨盾", rarity: "epic", type: "gear",
    desc: "顶阶防御法器：玄铁铸就的厚重巨盾，灵力灌注时如山岳横亘。练气十一层方可驱使。" },
  feixing_jujian: { name: "巨剑", rarity: "epic", type: "gear",
    desc: "顶阶攻击法器：丈余玄铁巨剑，灵力催动时可御使飞出、凌空斩敌，势大力沉。练气十一层方可驱使。" },

  /* —— 伴身法宝（v96 三类法宝制：被动面板件——装备即生效，战斗零操作）—— */
  yunling_zhu: { name: "蕴灵珠", rarity: "rare", type: "gear",
    desc: "伴身法宝：温润玉珠悬于气海之侧，吐纳灵机绵绵不绝——敛息回元与聚灵阵每口回灵+3。练气十一层方可伴身。" },
  hugen_jia: { name: "护根软甲", rarity: "rare", type: "gear",
    desc: "伴身法宝：千年藤心织就的贴身软甲——气血上限+20、护甲+1。练气十一层方可伴身。" },
  ningshen_huan: { name: "凝神玉环", rarity: "rare", type: "gear",
    desc: "伴身法宝：悬于眉心的青玉小环，凝神聚识——神识+2、灵力池+8。练气十一层方可伴身。" },
  qiannian_lingcao: { name: "千年灵草", rarity: "epic", type: "material",
    desc: "经小绿瓶以浓缩岁月之力催熟的灵草，药龄堪比千年野生之物。万宝楼见之眼开——一两棵，便够换楼上一件法器。" },

  /* —— 血色禁地 · 筑基丹链（huangfeng-design 第三/四幕）—— */
  xueshi_zhuyao: { name: "血色主药", rarity: "epic", type: "material",
    desc: "血色禁地特有的赤红灵药，根茎里流动着血色光华——炼制筑基丹的根本主药，外间有价无市。每一株，都是拿命换的。" },
  lieyang_hua: { name: "烈阳花", rarity: "rare", type: "material", sell: 14,
    desc: "向阳崖壁上才开的金红色灵花，离得老远就觉得脸上发烫——上好的制符与炼丹辅材，御灵宗的人尤其识货。" },
  mojiao_jiao: { name: "墨蛟之角", rarity: "epic", type: "material",
    desc: "墨蛟头顶初成的双角，质地胜过精铁，内蕴水行妖力。懂行的炼器师见了会两眼放光——听闻元武国有位姓齐的巧匠……（小大件链：乌龙夺）" },
  mojiao_lin: { name: "墨蛟鳞甲", rarity: "rare", type: "material",
    desc: "墨蛟周身的乌黑鳞片，刀剑难透。既是炼制护甲的上材，也是「神风舟」一类飞行法器的龙骨贴片。（小大件链：神风舟）" },
  mojiao_pi: { name: "墨蛟之皮", rarity: "epic", type: "material",
    desc: "整张剥下的蛟皮，韧逾百炼软甲、遇水不沉。炼器师以此为主材可制乘风破浪的「神风舟」——妖王身上没有一处是凡品。（小大件链：神风舟）" },

  /* —— 元武国·齐云霄代工成品（黄枫谷篇·血色禁地后真去元武国代工：墨蛟材料+千年灵草 → 大件）——
   *   ≥2 源：combat-arsenal §3.8（齐云霄炼乌龙夺/神风舟）/huangfeng-design 墨蛟链·阵法链/
   *   bigitem-design 首条范本（墨蛟之角→乌龙夺）/modao-design 裁决2·3（颠倒五行阵基础版·齐云霄千年灵草线）。
   *   立项即定义、授予在 story.js 齐云霄代工（增量C）；神风舟见 DATA.flightTreasures.shen_feng_zhou。 */
  wulong_duo: { name: "乌龙夺", rarity: "epic", type: "gear",
    desc: "齐云霄以墨蛟之角炼成的顶阶攻击法宝：黝黑双钩如蛟探爪，御使凌空绞夺、势大力沉且破甲。继金蚨子母刃之后，韩立筑基期的第二件主战法器。" },
  wuxing_zhen: { name: "颠倒五行阵图", rarity: "epic", type: "treasure",
    desc: "齐云霄以千年灵草为引、为韩立推演布设的护阵之法（基础版）——五行倒转、虚实易位，立于洞府可乱外敌方位、死守不破。〔他日魔道争锋·重逢齐云霄，可加强为改写战场规则的『真·颠倒五行阵』。〕" },

  /* —— 魔道争锋·第一幕·烽火征调（增量E）战利与机缘 ——
   *   考据源：modao-design §第一幕（用户修订裁决已并入 2026-06-16）。
   *   遵「妖材经济 v1」——掉的是"材/遗物"不是成品；机缘房三物各自起一条长线。 */
  yinling_sha: { name: "隐灵纱", rarity: "rare", type: "material",
    desc: "宣乐贴身的一幅乌黑软纱——掩月宗阴手敛息匿形的看家物。覆之于身，神识难察。从那阴人尸上剥下来时，纱面还透着一股化不开的阴寒。（遗物·制符炼器上材／敛息之用）" },
  pingtian_chi: { name: "平天尺", rarity: "epic", type: "material",
    desc: "队官吕天蒙临死塞进你手里的一截青铜短尺，尺身古拙、内蕴一缕沉雄法力——是他押在身上的保命法器。「替我……带出去。」他没能撑到说完。（遗物·他日可炼可参，自成一条法器长线）" },
  zhuluan: { name: "白玉蛛卵", rarity: "epic", type: "material",
    desc: "血玉蜘蛛腹下未及孵化的两枚卵，温润如羊脂玉，内里有一点灵性在缓缓搏动。懂行的人说，妖卵若以心血温养、得法孵化，可成贴身御使的灵宠——只是这一养，便是数十年的功夫。（开「灵宠」长线：得卵即立项，孵化随后续篇章实装）" },
  xueyu_sijin: { name: "血玉蛛丝", rarity: "rare", type: "material",
    desc: "血玉蜘蛛吐出的赤色灵丝，韧逾精钢、遇火不焚，缠丝间犹带噬血之性。是制符画箓、炼制束缚类法器的难得上材——坊市里有价无市。" },
  dayi_ling: { name: "大挪移令", rarity: "epic", type: "treasure",
    desc: "矿洞深处古传送阵心捧出的一枚青玉令牌，背面刻着早已无人能解的上古阵纹。传闻这类令符是开启某座跨域大阵的凭信，所通之处，远在天南之外的乱星海……此物太大，眼下握不住，却是一条通向极远未来的引线。（极长线·乱星海钥匙）" },
  butian_dan: { name: "补天丹", rarity: "epic", type: "pill",
    desc: "古丹方所炼的赤金色灵丹，专为补全先天残缺的灵根而设。伪灵根之体服之，经脉如逢甘霖、滞涩为之一畅——此后吐纳百脉，修炼之效永久略增。对你这等四灵根伪体，便是一线扳命的天机。（到手即服·永久修炼速度小幅提升）" },

  /* —— 魔道争锋·第二幕·金鼓原前线相持（增量F）——
   *   考据源：modao-design §第二幕（用户修订裁决 #1：本篇金鼓原只做小型前线相持）。
   *   傀儡获得包装【修#5】采「缴获图纸/残件」一路（非前线自炼）：巡逻战缴获魔修傀儡残件，
   *   既合"大衍诀在手方可炼傀儡"的考据时序（残件+图纸为引，炼制随后续篇章实装），
   *   又把傀儡线的引子落在一场练兵性质的遭遇战里——干净、可考、不抢戏。 */
  kuilei_canjian: { name: "缴获傀儡残件", rarity: "rare", type: "material",
    desc: "巡逻遭遇战中从魔修小队头目身上缴获的一捧傀儡残件——断臂残骸、半幅刻满阴纹的傀儡图纸，还沾着未干的尸油。魔道以血煞驱尸为傀，路子阴损，机巧却真。你已得大衍诀真传，此物便是他日参炼傀儡之术的引子。（开「傀儡」长线：缴获即立项，炼制随后续篇章实装）" },

  /* —— 魔道争锋·第四幕·皇宫决战（增量H下）战利 ——
   *   考据源：modao-design §76（动漫 ep46）："得：血凝五行丹/玄阴诀/血灵钻/锦帕/玉简/钵盂；彩蛋：刘宋渊源"。
   *   皆作"材/遗物/功法引子"无平衡扰动（type material/treasure/book、无 effect）——大件/伏笔随后续篇章实装。 */
  xuening_wuxing_dan: { name: "血凝五行丹", rarity: "epic", type: "treasure",
    desc: "胥王神魂溃散时坠落的一枚赤黑灵丹——血煞凝就、内蕴五行，本是他借以复生的逆天底牌。懂行的说，此丹大补五行灵气、若以正法化去其中血煞戾性，于他日结丹一关大有裨益。只是这血煞太重，眼下握不住，得是一条要慢慢驯的长线。（结丹率大件·炼化随后续篇章实装）" },
  xuanyin_jue: { name: "玄阴诀", rarity: "epic", type: "book",
    desc: "黑煞教秘藏的一卷阴损功法残篇，专言「煞妖化法」之术——以阴煞养出身外化身，遥制如臂使指。路子邪，机理却精，与你大衍诀的傀儡之道隐隐相通。此诀是「身外化身」一脉的引子，他日或能化出第二个你。（开「身外化身」长线·伏笔）" },
  xueling_zuan: { name: "血灵钻", rarity: "rare", type: "material",
    desc: "血煞秘法炼养多年的一枚赤色灵钻，触手冰凉、内有血光流转。是制符画箓、炼制血属法器的难得上材——魔道之物，坊市里有价无市。" },
  jinpa_liusong: { name: "锦帕", rarity: "rare", type: "material",
    desc: "皇宫废墟里拾得的一方素色锦帕，角上以银线绣着半枚旧时纹样，针脚细密、年岁已久。刘靖见之似有所动，宋蒙亦默然——这帕子背后，像是藏着两家一段无人再提的旧渊源。（彩蛋·刘宋渊源·线索）" },
  yujian_canpian: { name: "玉简", rarity: "rare", type: "material",
    desc: "一枚温润的旧玉简，神识探入只余断续残影——依稀是几句残缺口诀与一个早已作古的名号。来历不明，却与那方锦帕一同收在胥王密匣里。（彩蛋·刘宋渊源·线索）" },
  boyu_alms: { name: "钵盂", rarity: "rare", type: "treasure",
    desc: "一只古朴的青铜钵盂，内壁刻着早已斑驳的梵纹，盛物不腐、隐有敛息之效。不知怎么落在了这魔窟之中——亦是刘宋旧事里的一件遗物。（彩蛋·刘宋渊源·遗物）" },

  /* —— 妖材经济 v1（用户裁决）：妖兽掉的是"材"不是成品——
   * 普通妖兽掉皮骨牙（硝制贩卖/炼器打底），高阶妖兽掉妖丹（炼药炼器坊市硬通货），
   * 妖王伏诛掉具名稀有材→自然衔接大件链条（bigitem-design 妖材→法宝链）。 —— */
  langya_fang: { name: "妖狼牙", rarity: "common", type: "material", sell: 2,
    desc: "灵狼的尖牙，山民拿去镶刀头，符师拿去做符胆。零碎妖材，攒多了也是钱。" },
  shougu_bone: { name: "妖兽骨", rarity: "common", type: "material", sell: 3,
    desc: "妖兽的腿骨脊骨，比凡兽骨沉得多。炼器打底、入药煅灰，皆有人收。" },
  xuesha_jing: { name: "血煞结晶", rarity: "rare", type: "material", sell: 8,
    desc: "血煞兽心口凝的一粒暗红晶子，攥在手里微微发烫——制血煞符的主材，邪修出双倍价。" },
  yaodan_1: { name: "一阶妖丹", rarity: "epic", type: "material", sell: 30,
    desc: "开了灵智的妖兽颅内凝成的内丹，妖元未散。炼药入丹是大补，炼器淬火添灵性，坊市之上从不愁卖——妖丹即妖兽一生修为，硬通货中的硬通货。" },
  hupi_jinwen: { name: "金纹虎皮", rarity: "rare", type: "material", sell: 20,
    desc: "白额吊睛虎的整张皮，金纹隐有锋锐之气。制甲衬可御金煞，万宝楼见之眼开。" },
  tiebei_qiao: { name: "铁背甲壳", rarity: "rare", type: "material", sell: 16,
    desc: "蜈蚣王的背甲，敲之铮铮如铁。盾材、甲材的上选——它生前就是靠这身硬壳横行。" },
  chiyan_langpi: { name: "赤焰狼皮", rarity: "rare", type: "material", sell: 18,
    desc: "赤目狼王的火红皮毛，寒冬贴身可驱寒，制成甲衬能卸三分火煞。猎户传说里的宝贝。" },
  tayun_xue: { name: "踏云靴", rarity: "epic", type: "gear",
    desc: "封岳的杀手家底：一双轻若无物的灰色短靴，灵力注入时足下生云。穿上它，战阵之中身法快人一步——杀手的脚程，如今是你的。" },

  /* —— 战内瞬发牌（对阵轴 v2：灵力恢复链与控制符——combat-axis-rules.md §4/§5）—— */
  huiyuan_dan: { name: "回元丹", rarity: "rare", type: "consumable",
    desc: "速回灵力的丹药，战中一口吞下、灵力回涌（瞬发）。灵力池整场不复——这一粒，常是续命的那口气。" },
  dingshen_fu: { name: "定身符", rarity: "rare", type: "consumable",
    desc: "符上封存禁锢之术，扬手贴出、定住敌身一回合（瞬发）。拆大招、保蓄势、断追击——会用的人，一张顶半条命。" },
  zhenqi_kunzu: { name: "困足阵旗", rarity: "rare", type: "consumable",
    desc: "微缩阵旗，掷地即布两步困足之阵（持续数回合）：敌踏入阵中，脚下如陷泥沼、寸步难行。挡突进的硬墙（瞬发）。" },
  zhenqi_juling: { name: "聚灵阵旗", rarity: "rare", type: "consumable",
    desc: "微缩阵旗，掷于自家阵脚布两步聚灵之阵（持续数回合）：立于阵中，每回合灵力自回。久战续航的根本（瞬发）。" },

  /* —— 羁绊信物（社交深化：好感深交时，具名故人按身份回赠的唯一之物）——
   * keepsake: 入「人物图鉴」并于道途年表留痕；bound: 不可转赠、不可贩卖；全局只此一件。
   * 严守考据：只给那人真有、合身份之物——宁缺毋滥，不凭空生造法宝。 */
  ks_zhangtie: { name: "桃木平安牌", rarity: "epic", type: "treasure", keepsake: true, bound: true, from: "zhangtie",
    desc: "青牛镇老桃木雕的平安牌，边角是张铁亲手磨的。「带在身上挡灾——咱俩好歹一块儿出来的，你可别有事。」凡物一件，却是同乡少年攒了半月的心意。" },
  ks_lifeiyu: { name: "练武札记", rarity: "epic", type: "treasure", keepsake: true, bound: true, from: "lifeiyu",
    desc: "厉飞雨的随身札记，密密麻麻全是切磋心得与招式拆解。「你这记性，看一遍就够了——拿去，省得每回都缠着我问。」字里行间，都是拿你当自己人。" },
  ks_mashibo: { name: "辨药旧刀", rarity: "epic", type: "treasure", keepsake: true, bound: true, from: "mashibo",
    desc: "马师伯用了几十年的辨药刀，刀背磨得发亮。「拿去——别糟蹋了药材。」嘴上嫌弃，到底是把心尖子的家伙什，交到了你手里。" },
  /* —— 初入星海篇（乱星海·动漫年番镇妖大典脊柱·ep61~76）机缘与资粮 ——
   *   考据源：docs/churu-xinghai-design.md / docs/lore-churu-xinghai.md（≥2 动漫源·16 决议已锁）。
   *   多为「丹/材/虫/玉简」——结丹资粮与长线钩子，无平衡扰动（结丹率/灵宠/本命飞剑随剧情或后续篇章实装）。 */
  jiangchen_dan: { name: "降尘丹", rarity: "epic", type: "pill",
    desc: "镇妖大典「出力最大者」之赏——文樯领你赴会，正为这枚丹。服之可涤去筑基灵力中最后一缕尘浊、大降结丹一关的凶险门槛。结丹本是九死一生，得此丹便多三分生机。（结丹关·破关之资）" },
  xueling_shui: { name: "雪灵水", rarity: "epic", type: "material",
    desc: "乱星海深处寒灵脉眼里凝出的一汪灵水，触手砭骨、灵气清冽。结丹时引以温养、镇压丹中燥火，凝丹方不致崩裂。结丹之关的凝丹灵材。（结丹关·破关之资）" },
  tianhuo_ye: { name: "天火液", rarity: "epic", type: "material",
    desc: "火灵之精所化的一滴赤金灵液，遇风即燃、其温可熔金铁。结丹时以之作淬丹真火，与雪灵水一寒一热相济，方能将一身灵力反复压炼成丹。（结丹关·破关之资）" },
  xinghai_yaodan: { name: "乱星海妖丹", rarity: "epic", type: "material", sell: 60,
    desc: "乱星海外星海妖兽颅内所凝的内丹，比天南所见高出数阶、妖元雄浑。内星海防御大阵一失、乱星海大乱，外星海遂成猎场——以霓裳草引妖、噬金虫群猎，妖丹论筐取。这便是韩立发家致富、攒足结丹资粮的本钱。（外星海致富硬通货·结丹关·破关之资）" },
  nichang_cao: { name: "霓裳草", rarity: "rare", type: "material", sell: 12,
    desc: "乱星海特产的一种妖草，花气甜腻、最招妖兽。猎妖人采之为饵：布于礁岛、引妖来食，再纵噬金虫群一举围杀。外星海猎妖取丹的关窍之物。" },
  shijinchong: { name: "噬金虫", rarity: "epic", type: "treasure",
    desc: "外星海机缘偶得的一窝异种灵虫，通体金芒、专噬金铁，群飞如金云蔽日。奇虫榜上有名，可附体淬身、可出战群噬、可化虫为刃、亦可外化作虫之化身——一物四用，全凭灵机调遣（耗尽则哑火，取舍即战术）。韩立纵横外星海的看家虫器。（战斗·四用法见 combat.js）" },
  tianleizhu_yujian: { name: "天雷竹·玉简", rarity: "epic", type: "book",
    desc: "乱星海所闻的一枚古玉简，载着青元剑诀十三层全本与『青竹蜂云剑』的炼制之法——须以界中神竹『天雷竹』为材，养成万年金雷竹，方能炼就七十二口本命飞剑、以银月为器灵。眼下材料、火候皆远不能及，先记下这条通天的引线。（青竹蜂云剑·银月·长线钩子·实装留星海飞驰篇）" },

  ks_chenqiaoqian: { name: "陈家药引", rarity: "epic", type: "treasure", keepsake: true, bound: true, from: "chenqiaoqian",
    desc: "陈巧倩从陈家药圃匀来的稀罕药引，寻常炼丹师有价无市。她只淡淡说一句「顺路」，绝口不提坊市归途那一夜的相欠。" },
  ks_wanxiaoshan: { name: "护身符袋", rarity: "epic", type: "treasure", keepsake: true, bound: true, from: "wanxiaoshan",
    desc: "万小山缝的粗布符袋，里头塞着几张他亲挑的真符。「韩兄行走在外，这个你拿着——修仙界凉薄，别再被人当雏儿宰了。」" },
  ks_wushishu: { name: "护身青玉佩", rarity: "epic", type: "treasure", keepsake: true, bound: true, from: "wushishu",
    desc: "吴师叔贴身多年的青玉小佩，温润养神。「丹田里的气走岔了，就攥着它定神——出了这道谷门，师叔便护不到你身边了。」" },

  /* —— 再别天南篇（衔接过场大章·ep47~63）战利与机缘 ——
   *   考据源：docs/zaibie-tiannan-design.md（≥2 源·考据节点表已并入设计稿）。
   *   绿煌剑＝御灵宗夺舍者本命法宝（结丹本命），韩立越阶强驱威能不折但灵力消耗×3（杀手锏设计·driveRealm:2），
   *   配剑影分光术，仍是金蚨子母刃→乌龙夺之后的强力第三主战。曲魂·身外化身装黑煞教主血刃达假丹境（SideUnit 友军）。 */
  lvhuang_jian: { name: "绿煌剑", rarity: "epic", type: "gear",
    desc: "御灵宗夺舍者（败于你手那位）的本命法宝：一柄通体莹绿、剑吟如龙的古剑，结丹本命所凝，威能远在寻常法器之上。你越阶强驱灵力消耗剧增——但每一击都是结丹级的威能，配上剑影分光之术，仍是继金蚨子母刃、乌龙夺之后的第三件强力主战法宝。" },
  heisha_xueren: { name: "黑煞教主血刃", rarity: "epic", type: "treasure",
    desc: "皇宫决战缴获的胥王凶器——一柄赤黑染血的弯刃，内蕴未散的血煞戾性，凡人近之心悸。以正法化去戾性虽难，却正好作那身外化身的兵刃：血煞养煞身，如臂使指。（曲魂·身外化身的武装）" },
  qichong_yujian: { name: "奇虫榜玉简", rarity: "epic", type: "book",
    desc: "御灵宗夺舍者贴身收藏的一枚玉简，神识探入，是一卷遍录天下奇虫异种的「奇虫榜」——噬金虫、血玉蛛、金蚨之属皆在其列，附驯养之法与品阶高下。御灵宗以灵兽奇虫之道称雄，此简价值连城，于你他日灵宠虫器一道是难得的引路图。（开「奇虫/灵宠」长线·引子）" },
  guzhen_tuzhi: { name: "古传送阵·修复图纸", rarity: "epic", type: "treasure",
    desc: "辛如音耗尽精血、临去前推演补全的一幅阵图——越国矿洞那座残破古传送阵的修复与催动之法尽在其上。配上大挪移令，便能强启这座尘封万载的跨域大阵，一步踏出天南。此图既是你脱身天南的钥匙，也是你日后钻研阵法之道的开端。" },
  xinruyin_letter: { name: "辛如音绝笔", rarity: "epic", type: "treasure", keepsake: true, bound: true, from: "xinruyin",
    desc: "辛如音以将尽的神识在玉简上留下的最后几句话：阵成之后她已油尽灯枯，再走不动了。「韩道友，替我……去看看天南之外的天地。这阵，是我此生最后一座，也是最得意的一座。」字迹到末尾已淡得几乎看不见。" },
};

/* ---------- 法器装备体系（v1）：大多做属性+特性（被动），少数做战斗装备（主动技）----------
 * slot: weapon 武器 / armor 护身 / accessory 饰物。
 * minLayer: 驱使门槛（练气层数）；bonus: 被动属性；traits: 特性（被动规则，文字+钩子字段）；
 * grantSpells: 主动战斗技（仅战斗装备类有）。
 */
DATA.gear = {
  // —— 黄枫谷入门发放的下品战斗法器（练气即可驱使——韩立头一件正经战斗法器）——
  waimen_tiejian: {
    slot: "weapon", minLayer: 1,
    grantSpells: ["tiejian_ci"],
    traits: [{ id: "starter_sword", desc: "御剑入门：催动灵力御使铁剑凌空飞刺（战斗技「御剑刺」）——下品法器，威力寻常，胜在练气期便可驱使" }],
  },
  // —— 战斗装备类（主动技）——
  jinfuzi_ren: {
    slot: "weapon", minLayer: 11,
    bonus: { sense: 2 },
    grantSpells: ["zimu_ren"],
    traits: [{ id: "twin_blade", desc: "一母八子分进合击：战斗技「金蚨子母刃」子刃两段连击，每段独立结算" }],
  },
  feixing_jujian: {
    slot: "weapon", minLayer: 11,
    bonus: { body: 1 },
    grantSpells: ["jujian_zhan"],
    traits: [{ id: "heavy_sword", desc: "御剑凌空：战斗技「巨剑斩」势大力沉且破甲——一剑之威，胜过百剑之繁" }],
  },
  // —— 元武国·齐云霄代工（墨蛟之角炼成的顶阶攻击法宝——韩立筑基期第二主战；授予见 story.js 增量C）——
  wulong_duo: {
    slot: "weapon", minLayer: 11,
    bonus: { body: 1 },
    grantSpells: ["wulong_duo"],
    traits: [{ id: "wulong_seize", desc: "蛟爪绞夺：战斗技「乌龙夺」势大力沉且破甲——继金蚨子母刃后的主战法器（齐云霄以墨蛟之角炼成）" }],
  },
  // —— 再别天南·夺剑（御灵宗夺舍者本命法宝·结丹本命）：韩立越阶强驱威能不折、灵力消耗×3（杀手锏设计·driveRealm:2），
  //    配剑影分光术，仍是金蚨子母刃→乌龙夺之后的第三件强力主战法宝（授予见 story.js Act1 御灵宗夺舍者战胜后）——
  lvhuang_jian: {
    slot: "weapon", minLayer: 11,
    bonus: { sense: 2, body: 1 },
    grantSpells: ["lvhuang_jian", "jianying_fenguang"],
    traits: [{ id: "lvhuang_sword", desc: "越阶御剑：战斗技「绿煌剑」势大力沉、「剑影分光」分影多段——结丹本命之器，你越阶强驱灵力消耗剧增但威能不折（御灵宗夺舍者本命法宝）" }],
  },
  // —— 属性/特性类（被动）——
  xuantie_dun: {
    slot: "armor", minLayer: 11,
    bonus: { hpMax: 30 },
    traits: [{ id: "charge_resist", value: 0.3, desc: "山岳之御：气血上限+30；受「蓄力重击」伤害-30%" }],
  },
  tayun_xue: {
    slot: "accessory", minLayer: 11,
    bonus: { speed: 3 },
    traits: [{ id: "swift", desc: "足下生云：遁速+3；战阵中每回合可多挪一步（移动力+1）——杀手的脚程" }],
  },
  nuanyang_yu: {
    slot: "accessory", minLayer: 1,
    bonus: { moodMax: 10 },
    traits: [{ id: "warm_jade", desc: "暖玉生温：心境上限+10，寒毒阴煞不侵——她的嫁妆，护你周全" }],
  },
  zheling_canbao: {
    slot: "accessory", minLayer: 1,
    bonus: { sense: 1 },
    traits: [{ id: "veil_aura", desc: "遮灵敛息：神识+1；周身灵气波动被遮掩，藏拙更深（示人境界不易被看破）" }],
  },

  // —— 伴身法宝（v96 三类法宝制：被动面板件，slot:"side"——装备即生效战斗零操作；
  //    槽数=神识档（境界+大衍诀）。数值过 encounter.bal 箱线 ——
  yunling_zhu: {
    slot: "side", minLayer: 11,
    bonus: { regenBoost: 3 },
    traits: [{ id: "regen_pearl", desc: "蕴灵珠伴身：敛息回元与聚灵阵每口回灵+3——久战的底气（池制不破：仍须花动作回灵）" }],
  },
  hugen_jia: {
    slot: "side", minLayer: 11,
    bonus: { hpMax: 20, armor: 1 },
    traits: [{ id: "root_armor", desc: "护根软甲贴身：气血上限+20、护甲+1——挨打的本钱" }],
  },
  ningshen_huan: {
    slot: "side", minLayer: 11,
    bonus: { sense: 2, mpMax: 8 },
    traits: [{ id: "mind_ring", desc: "凝神玉环悬于眉心：神识+2、灵力池+8——多驭一物的余裕" }],
  },
};

/* ---------- 行动配置 ----------
 * 时间以月为单位。行动耗时偏短，保证节奏明快又有时间压力（限期任务/寿元）。
 */
DATA.actions = {
  cultivate: { name: "闭关修炼", timeCost: 1, desc: "潜心修炼《长春功》，是修为的主要来源。" },
  adventure: { name: "外出历练", timeCost: 1, desc: "在七玄门内外走动，可能触发际遇、事件或危险。" },
  rest:      { name: "打坐调息", timeCost: 1, desc: "恢复气血与心境，平复心魔。" },
};

/* ---------- 功法库（严格按篇章锁定，见 docs/techniques-lore.md）----------
 * arc: 所属篇章。七玄门篇仅开放「长春功」；青元剑诀/大衍诀为后续篇章功法，本篇锁定。
 * locked: true 表示当前篇章不可得（仅作埋线展示，不可学）。
 */
/* 主修功法演进线（考据核定 2026-06-11）：
 * 长春功＝木属性纯练气功法，共十三层对应练气十三层，筑基后彻底失效；
 * 韩立修至十一层服筑基丹筑基 → 主修换青元剑诀（亦木属性——道基行属不变）。
 * 火弹术/御风诀/天眼术等小法术皆是长春功高层所授（太南小会购得后篇方可修）。 */
DATA.techniques = {
  changchun: {
    name: "长春功", arc: "qixuan", attr: "mu", locked: false, grade: 1,
    grantSpells: ["tuna", "huti", "ningshen", "zhayan"],
    desc: "墨大夫所授的木属性练气功法（前篇，止于七层）。资质要求低，正合你这四伪灵根；练至五层有过目不忘之效。此功唯能修到练气圆满——筑基之后，便是它功成身退之日。",
    origin: "墨大夫早年机缘所得（夺自余子童），授予韩立。",
  },
  changchun_full: {
    name: "长春功 · 后篇", arc: "huangfeng", attr: "mu", grade: 1,
    book: "changchun_houpian",
    grantSpells: ["tuna", "huti", "ningshen", "zhayan", "huodan"],
    desc: "长春功八至十三层全本，并载火弹术、御风诀、天眼术等诸般小法术——凡人眼中已是仙法，修仙界里不过入门。修至十一层，便可服丹冲击筑基。",
    origin: "太南小会上以丹药换得的全本（卖家：「你给多了，我们不占便宜。」）。",
    acquireArc: "离门远行（太南小会）",
  },
  qingyuan_sword: {
    name: "青元剑诀", arc: "huangfeng", attr: "mu", locked: true, grade: 3,
    // 入门即授的基础内功（吐纳/护体/凝神）；剑系战技按"功法层数轴"逐层解锁（layerUnlocks）。
    grantSpells: ["tuna", "huti", "ningshen"],
    maxLayers: 9,                                  // 黄枫谷流传的九层版（完整十三层另藏于金色书页，后期）
    layerUnlocks: {
      3: ["qingyuan_jianmang", "jujian_shu"],      // 三层·青元剑芒 + 巨剑术（用户裁决：随诀直授的大杀招）
      5: ["qingyuan_jiandun"],                     // 五层·护体剑盾
      7: ["qingyuan_jianying"],                    // 七层·剑影分光（分影多段）
    },
    desc: "青元子所创的木属性剑修功法。黄枫谷流传的只有九层（弟子多止步三层作辅修），韩立筑基后以此为主修——三层可发青元剑芒、聚芒成剑的巨剑术，五层护体剑盾，七层剑影分光。传闻完整剑诀共十三层，可修至化神。",
    origin: "黄枫谷篇：筑基后李化元所赠；金色书页中藏着完整十三层法诀与青竹蜂云剑炼制之法。",
    acquireArc: "黄枫谷篇（筑基之后）",
  },
  great_development: {
    name: "大衍诀", arc: "huangfeng", attr: "sense", locked: true, grade: 4,
    desc: "神识类无上功法（天阶），可大幅强化神识、御使傀儡，修炼极难。",
    origin: "黄枫谷篇末（动漫17集，多源核定）：叶师叔即千竹教卧底——吴师兄撞破他与灵兽山钟吾的勾结，遭傀儡追杀；韩立驾神风舟救回洞府、颠倒五行阵死守，吴师兄伤重身亡；结丹雷万鹤赶到诛杀叛徒，韩立从其遗物中得此诀。",
    acquireArc: "黄枫谷篇末（叶师叔之乱）",
  },
};

// 本篇主修功法（恒为长春功，不开放更换）
DATA.startingTechnique = "changchun";

/* ---------- 三转重元功（散功重修·#2 用户裁决：层数清零·属性适当保留·乘性印记）----------
 * 考据：原著卷三韩立以「三转重元功」散功重修青元剑诀以叩结丹之门；动漫年番·初入星海篇·小寰岛闭关重修。
 * 机制（引擎逻辑见 engine.js·增量6，本处仅配置·不动 balance.js）：
 *   触发后将所修剑诀层数清零、重新累升；每完成「一转」铭刻一份「真元精纯」乘性印记（imprintMul），
 *   重升至原层数时基底更强——给「重修＝变强」的即时正反馈（#2）。神识/体魄等属性按 keepStatRatio 保留，不清零。
 *   本篇只实装「重元一转」（筑基巅峰→叩结丹门槛之一），余两转为后续篇章预留。完成后置 doneFlag（结丹关 require 之一）。
 */
DATA.reforge = {
  id: "sanzhuan",
  name: "三转重元功",
  appliesTo: "qingyuan_sword",   // 散功重修的对象功法（青元剑诀层数轴）
  maxZhuan: 3,                   // 全本三转
  chapterZhuan: { starsea: 1 }, // 各篇章实装的转数（本篇一转）
  imprintMul: 1.1,              // 每转·真元精纯乘性印记（layerMul 之外的独立乘子·引擎侧施加）
  keepStatRatio: 0.6,           // 散功时神识/体魄等属性保留比例（#2 属性适当保留）
  doneFlag: "sanzhuan_done",    // 完成一转后置位（结丹关 require 之一）
  intro: "灵力滞于筑基巅峰、再难寸进。你依三转重元功散去一身剑诀修为，自最浅一层重新累升——散功之痛刻骨，重修之路却愈走愈快：旧日窠臼一朝荡尽，真元淬得格外精纯。这一转，是叩开结丹门户的第一步。",
};

/* ---------- 大境界突破·秘仪（每个大境界的破关之法各不相同）----------
 * 忠于「真实修仙」：小境界（同大境界内的分层）水到渠成，唯心魔过盛才需心战；
 * 大境界（练气→筑基→结丹→元婴…）则各有独门关隘，须十足准备，并历一场凶险心魔劫。
 *
 * 按"目标大境界 tier"索引。字段：
 *   name        关隘之名
 *   intro       破关前的演出旁白
 *   require[]   前置准备（{ kind:'item', id, n } / { kind:'stat', key, min } / { kind:'flag', key }）
 *   consume[]   破关时消耗的物品（{ id, n }）
 *   trialHp     心魔劫·心魔气血基数（越高越难）
 *   trialRounds 心战可战回合基数
 *   failRealmLoss 失败时是否跌境（true=大境界失败有跌境风险）
 *
 * 注：各篇章封顶境界由 chapters.js 的 realmCapIndex 控制；DATA.realms 现已扩展至结丹大圆满。
 *     foundation 关于七玄门篇为远景钩；core（结丹关）于初入星海篇章末「金丹大成」实装（觅长生式·见上方 require/consume）；nascent 仍为后续篇章预留。
 */
DATA.bigRealmRites = {
  foundation: {
    name: "筑基关 · 凝基化灵",
    intro: "练气至圆满，灵力已无处可纳。欲跻身筑基，须以「筑基丹」化去周身灵力杂质，引天地灵气灌入百窍，凝散为基。此关九死一生，心魔劫尤烈——一旦失手，轻则跌境散功，重则身死道消。",
    require: [
      { kind: "item", id: "zhuji_dan", n: 1, label: "筑基丹 ×1" },
      { kind: "stat", key: "spiritRatio", min: 0.9, label: "灵力近乎圆满" },
      { kind: "stat", key: "moodRatio", min: 0.6, label: "心境平和" },
      { kind: "stat", key: "demonMax", min: 30, label: "心魔已伏（≤30）" },
    ],
    consume: [{ id: "zhuji_dan", n: 1 }],
    trialHp: 90, trialRounds: 10, failRealmLoss: true,
  },
  core: {
    name: "结丹关 · 凝灵成丹",
    intro: "筑基百窍灵力已盈，再难寸进——欲破此关，须以三转重元功散功重修、淬出一身精纯真元，更得大衍诀三层凝炼神识，方堪驾驭结丹之劫。临关再以降尘丹涤尽尘浊、雪灵水与天火液一寒一热相济，将一身灵力反复压炼、凝散为丹。结丹心魔为平生执念所化，最是难缠；首番叩关，鲜有不败。此乃「觅长生」之关——备得越足，活路越宽。",
    require: [
      { kind: "flag", key: "sanzhuan_done",  label: "三转重元功·重元一转（散功重修圆满）" },
      { kind: "flag", key: "dayan_layer3",   label: "大衍诀·三层（神识淬炼大成）" },
      { kind: "item", id: "jiangchen_dan", n: 1,  label: "降尘丹 ×1（降结丹门槛）" },
      { kind: "item", id: "xueling_shui",  n: 1,  label: "雪灵水 ×1（凝丹灵材）" },
      { kind: "item", id: "tianhuo_ye",    n: 1,  label: "天火液 ×1（淬丹真火）" },
      { kind: "item", id: "xinghai_yaodan", n: 30, label: "乱星海妖丹 ×30（外星海猎妖所积·温养金丹）" },
      { kind: "stat", key: "spiritRatio", min: 0.95, label: "灵力圆满" },
      { kind: "stat", key: "moodRatio", min: 0.7, label: "道心澄明" },
      { kind: "stat", key: "demonMax", min: 25, label: "心魔已伏（≤25）" },
    ],
    consume: [
      { id: "jiangchen_dan", n: 1 },
      { id: "xueling_shui", n: 1 },
      { id: "tianhuo_ye", n: 1 },
      { id: "xinghai_yaodan", n: 30 },
    ],
    trialHp: 360, trialRounds: 13, failRealmLoss: true,
  },
  nascent: {
    name: "元婴关 · 婴变出窍",
    intro: "破碎金丹，化丹为婴，元婴自识海孕生。此乃脱胎换骨之劫，元神离体最易遭心魔反噬，一念之差便万劫不复。",
    require: [
      { kind: "stat", key: "spiritRatio", min: 0.98, label: "灵力极盈" },
      { kind: "stat", key: "moodRatio", min: 0.8, label: "道心通明" },
      { kind: "stat", key: "demonMax", min: 20, label: "心魔尽伏（≤20）" },
    ],
    consume: [],
    trialHp: 700, trialRounds: 14, failRealmLoss: true,
  },
};

/* ---------- 飞行/遁speed 法宝（可视化"移动速度"，忠于原著获取脉络）----------
 * 装备后大幅提升遁速 → 大世界赶路耗时骤减、战斗先手更稳。
 * 七玄门篇凡人之躯无飞行法宝；风雷翅为乱星海篇机缘，先埋配置。
 *   speedBonus 直接叠加到遁速；arc 标注所属篇章；locked 表示当前篇章不可得。
 */
DATA.flightTreasures = {
  none: { name: "徒步赶路", speedBonus: 0, grade: "凡", arc: null,
    desc: "全凭两条腿与粗浅遁术，跋山涉水。练气修士的常态。" },

  // —— 黄枫谷入门发放：青叶法器（韩立第一件飞行法器——考据核定）——
  qingye_fazhan: {
    name: "青叶法器", speedBonus: 10, grade: "下品法器", arc: "huangfeng",
    desc: "黄枫谷入门发放的最低阶飞行法器——一片青叶大如门板，灵力催动可载人低空疾掠。寒酸是寒酸，却是你头一回离地。",
    origin: "黄枫谷篇：入谷时随青衫腰牌一并发放。",
  },
  // —— 神风舟（墨蛟皮所制——血色禁地战利交予齐云霄炼成，考据核定）——
  shen_feng_zhou: {
    name: "神风舟", speedBonus: 30, grade: "黄阶法器", arc: "huangfeng", locked: true,
    desc: "以墨蛟之皮为帆、御风疾驰的小舟形法器，比徒步遁光快上数倍。韩立前期赶路全靠它。",
    origin: "黄枫谷篇：血色禁地斩墨蛟取其皮，托元武国齐云霄炼制而成（墨蛟链小大件）。",
  },
  // —— 乱星海篇：渡海乘风雷舟（跨海远行）——
  du_hai_lei_zhou: {
    name: "渡海乘风雷舟", speedBonus: 48, grade: "玄阶法器", arc: "luanxinghai", locked: true,
    desc: "以风雷之力驱动的飞舟，破浪凌空，专为茫茫乱星海的远渡而设。",
    origin: "乱星海篇：跨海所用。",
  },
  // —— 乱星海篇：风雷翅（贴身飞遁，极速且灵活）——
  feng_lei_chi: {
    name: "风雷翅", speedBonus: 70, grade: "宝品·极速", arc: "luanxinghai", locked: true,
    traits: [{ id: "fenglei", desc: "御风雷翅——可施「雷遁」穿亚空间瞬移（无视挡线困足，遁程极远）。" }, { id: "fly" }],
    desc: "以金雷竹等天材炼成的稀世飞遁至宝，振翅风雷相生，遁速奇快且贴身灵动。韩立纵横乱星海、屡屡险中脱身的依仗之一。",
    origin: "乱星海篇：金雷竹机缘炼成。",
  },
  // —— 重返天南篇：御风车（元婴期大战穆兰后所得的飞遁至宝）——
  yu_feng_che: {
    name: "御风车", speedBonus: 95, grade: "古宝·极速", arc: "tiannan_return", locked: true,
    desc: "上古飞遁至宝，驾之如雷云逐电，神速冠绝天南。寻常修士终其一生未必得见。",
    origin: "重返天南篇：元婴期大战穆兰神师后所得——与七玄门/黄枫谷/乱星海皆无关，须严守获取时序。",
  },
};

/* ---------- 遁术功法（功法本身亦可提升遁速，独立于飞行法宝）----------
 * 忠于设定：修为/功法精进本就提升遁光之速；某些功法/秘术专擅速度。
 * speedBonus 叠加到有效遁速（与飞行法宝叠加）；本篇长春功无额外加成。
 */
DATA.movementArts = {
  // 通用：境界提升带来的遁光增益由 effectiveSpeed 的境界项体现，这里只放"专精速度"的功法/身法
  zhayan_bushi: {
    name: "眨眼身法", speedBonus: 4, arc: "qixuan", locked: false,
    desc: "眨眼剑法附带的诡谲身法，临阵腾挪极快——略助遁速与战斗先手。",
  },
};

/* ---------- 神秘小绿瓶（掌天瓶前身） ----------
 * 韩立逆袭核心：催熟灵草→灵药（服食大补修为），催熟毒草→杀招。
 * seed 为投入的种子/原材料，matureItem 为成熟收获物。
 */
DATA.bottle = {
  plotCount: 2,           // 初始可种植地块
  catalyzePerAction: 34,  // 每次"打理"推进的成熟度
  crops: {
    lingcao:   { seed: "lingcao",   matureItem: "lingyao_dan", yield: 1, growth: 100, name: "灵草→灵药" },
    duyao_cao: { seed: "duyao_cao", matureItem: "duyao_cao",   yield: 2, growth: 100, name: "毒草（催熟）" },
    // 千年灵草：小绿瓶的真正奇迹——岁月可以催熟（考据：韩立换购万宝楼法器的本钱）
    qiannian:  { seed: "lingcao",   matureItem: "qiannian_lingcao", yield: 1, growth: 300, name: "灵草→千年灵草（耗时极长）" },
  },
};

/* ---------- 探索点 / 副本（箱庭式网格探索，见 js/explore.js）----------
 * 后山为七玄门篇可探索的箱庭点；虚天殿/坠魔谷为后续篇章副本预留。
 * density：各类内容投放量；companions：可同行 NPC（greed 贪婪度，relation 初始交情）。
 */
DATA.exploreSites = {
  houshan_explore: {
    id: "houshan_explore", name: "七玄门后山 · 深处",
    w: 9, h: 9, stepCost: 0.34, sightRadius: 1,
    density: { herb: 6, duherb: 4, ore: 2, chest: 1, beast: 4 },
    beastEnemy: "wild_wolf",
    companions: [],   // 七玄门篇暂独行；可由剧情/交互加入同伴
    arc: "qixuan",
  },
  // —— 血色禁地（黄枫谷篇第三幕：五日限时深探索，死亡=真死的硬仗）——
  // 主药=筑基丹的根本；深处水潭=墨蛟（南宫婉并肩战）；中层游弋着狙杀者封岳。
  xueshi_jindi: {
    id: "xueshi_jindi", name: "血色禁地",
    w: 12, h: 12, stepCost: 0, sightRadius: 1,   // 禁地内不走大世界月份——走"天"（步数预算）
    maxSteps: 60,                                 // 五日之限：每步≈一刻，60 步禁地闭合（强制传送出）
    density: { herb: 7, duherb: 4, ore: 4, chest: 4, beast: 6 },
    specialHerb: "xueshi_zhuyao",                 // 部分灵草格替换为血色主药（主线目标）
    specialHerbN: 6,
    stalker: "fengyue",                           // 狙杀者：中层游弋的修士杀局（撞上=恶战，胜得踏云靴）
    beastEnemy: "jindi_beast",
    bossEnemy: "mojiao",
    bossSide: "nangongwan",                       // 深处 boss 战的并肩同道（考据：压制修为的南宫婉）
    arc: "huangfeng", locked: true,               // 由禁地开启剧情解锁进入
  },
  // —— 后续篇章副本（占位，待对应篇章开放）——
  xutian_dian: {
    id: "xutian_dian", name: "虚天殿", w: 11, h: 11, stepCost: 0.4, sightRadius: 1,
    density: { herb: 4, duherb: 2, ore: 5, chest: 5, beast: 8 },
    beastEnemy: "rogue_cultivator", arc: "huangfeng", locked: true,
  },
  zhuimo_gu: {
    id: "zhuimo_gu", name: "坠魔谷", w: 11, h: 11, stepCost: 0.45, sightRadius: 1,
    density: { herb: 3, duherb: 5, ore: 4, chest: 4, beast: 10 },
    beastEnemy: "rogue_cultivator", arc: "huangfeng", locked: true,
  },
};

window.DATA = DATA;
