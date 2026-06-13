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
  { tier: "foundation", layer: 1, name: "筑基初期", culMax: 6000, spMax: 2400, lifespan: 80, big: true },
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
    desc: "小绿瓶催熟的珍稀灵药，灵气浓郁。服之大补修为，是韩立瞒着墨大夫精进的本钱。", effect: { cul: 120, sp: 40 } },
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
};

/* ---------- 法器装备体系（v1）：大多做属性+特性（被动），少数做战斗装备（主动技）----------
 * slot: weapon 武器 / armor 护身 / accessory 饰物。
 * minLayer: 驱使门槛（练气层数）；bonus: 被动属性；traits: 特性（被动规则，文字+钩子字段）；
 * grantSpells: 主动战斗技（仅战斗装备类有）。
 */
DATA.gear = {
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
    grantSpells: ["tuna", "huti", "ningshen", "qingyuan_jianmang", "qingyuan_jiandun"],
    desc: "青元子所创的木属性剑修功法。黄枫谷流传的只有九层（弟子多止步三层作辅修），韩立筑基后以此为主修——三层可发青元剑芒，五层护体剑盾，七层剑影分光。传闻完整剑诀共十三层，可修至化神。",
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
 * 注：本篇封顶练气，foundation 及以上为后续篇章预留（届时 data.realms 扩展真实境界即生效）。
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
    name: "结丹关 · 灵力成丹",
    intro: "筑基灵力已盈，须觅一处灵脉，借天材地宝温养，将一身灵力反复压缩、凝而成丹。结丹心魔为生平执念所化，最是难缠。",
    require: [
      { kind: "stat", key: "spiritRatio", min: 0.95, label: "灵力圆满" },
      { kind: "stat", key: "moodRatio", min: 0.7, label: "道心澄明" },
      { kind: "stat", key: "demonMax", min: 25, label: "心魔已伏（≤25）" },
    ],
    consume: [],
    trialHp: 260, trialRounds: 12, failRealmLoss: true,
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
