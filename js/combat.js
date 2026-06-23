/* ============================================================
 * combat.js — 对阵轴战斗引擎 v2（灵力池 + 一维线式战棋，纯逻辑无 DOM）
 *
 * 设计：docs/combat-axis-rules.md（规则书+纸面推演）/ docs/combat-redesign.md（调研）
 * 同一套引擎用于：遭遇战 / 决战 / 突破心战 / 速决（无头自动跑）
 *
 * 凡人范式 v2 核心：
 *  - 统一灵力池（弃五行灵气珠）：一切手段共用一池灵力，整场不自动恢复
 *  - 御物为主役：法器技威力随境界最陡；武学=贴身专属零耗（特解不保底）
 *  - 一维对阵轴：距离=格差；近战须贴邻、御物有射程、占格=挡线
 *  - 敌我对称：敌人也有灵力/装备/底牌，耗到蓝尽是合法胜利
 *  - 读招：敌方意图回合初亮牌；凝息/蓄势亮破绽（受击+30%）
 * ============================================================ */

(function (root) {

  const Balance = (typeof require !== "undefined") ? require("./balance.js") : root.Balance;

  const ELEMENTS = ["jin", "mu", "shui", "huo", "tu"];
  const ELEM_NAME = { jin: "金", mu: "木", shui: "水", huo: "火", tu: "土" };

  /* ---------- 法术 / 招式库（灵力定价 + 射程，严格随篇章解锁）----------
   * mp: 灵力消耗（0=武学零耗——成本是"只能贴身"）
   * range: [min,max] 射程（格差）；quick: 瞬发牌（不占主行动，每回合限一张）
   * 贴身规则：range 上限≥2 的攻击在距离1时威力×0.7（法修怕近身）；武学反之为主场。
   */
  const SPELLS = {
    // 《长春功》一系（功法法术·木属性）
    tuna:     { name: "长春吐纳", mp: 9, range: [0, 0], type: "heal", heal: 11, school: "mu", source: "art",
                desc: "运转《长春功》吐纳调息，固本回元。修长春功者，回元更多。战中调息终是杯水车薪——胜负在攻。" },
    huti:     { name: "长春护体", mp: 9, range: [0, 0], type: "def", shield: 16, school: "mu", source: "art",
                desc: "以木灵之力护住周身。修长春功者，护体更坚。护体随回合消散——是应招，不是存款。" },
    // 凝息（原凝神静气）：弃攻回气——但破绽毕露
    ningshen: { name: "凝息回元", mp: 0, range: [0, 0], type: "buff", regen: 14, expose: true, source: "art", oncePerRound: true,
                desc: "敛息凝神，引天地灵气回补灵力（+14）。但凝息之际破绽毕露——本回合受击伤害+30%。敢不敢当他面回气，是个赌局。" },

    // 武学（贴身专属·零耗——韩立的杀手锏传统，灵力耗尽时的特解）
    zhayan:   { name: "眨眼剑法", mp: 0, range: [1, 1], type: "atk", dmg: 15, dodgeSelf: 0.15, buildMomentum: 1, source: "martial",
                desc: "凡人剑术，身形快如眨眼，欺身一剑。唯贴身可用，不耗灵力。每施一剑积累「剑势」。" },
    zhayan_lian:{ name: "眨眼连击", mp: 0, range: [1, 1], type: "atk", dmg: 20, dodgeSelf: 0.1, spendMomentum: true, momentumDmg: 6, source: "martial",
                desc: "凡人剑术，倾尽剑势连环爆发。每点「剑势」额外+6伤害，施后剑势清零。唯贴身可用。" },
    lianhuan: { name: "连环眨眼", mp: 0, range: [1, 1], type: "atk", dmg: 15, multiSeg: true, segPer: 2, dodgeSelf: 0.2, spendMomentum: true, source: "martial",
                desc: "眨眼剑法大成之技：身剑合一，一剑化作数剑（每2点剑势多斩一剑），剑剑独立结算。施后剑势清零。唯贴身可用。" },
    weidu:    { name: "喂毒一击", mp: 0, range: [1, 1], type: "debuff", poison: { dmg: 10, turns: 4 }, source: "martial",
                consume: "duyao_cao",
                desc: "剑尖淬毒，贴身一击令敌持续中毒。消耗一份毒草。" },
    feizhen:  { name: "暗器飞针", mp: 1, range: [1, 3], type: "atk", dmg: 22, pierce: true, source: "martial",
                consume: "anqi",
                desc: "凡人暗器，扬手激射，例不虚发，破甲。消耗一支暗器。" },

    // 运功镇魂：对元神之敌（神识所及，不拘远近）
    zhenhun:  { name: "运功镇魂", mp: 11, range: [1, 4], type: "soul", source: "art", elem: "shui",
                slays: { ghost: 1.5 },
                desc: "凝聚周身功力镇压神魂。唯对元神之敌有效，伤害取决于你的功力。神魂镇压本是鬼魅克星。" },

    // 火弹术（长春功后篇所授）：法术=控场补刀位，射程短于御物
    huodan:   { name: "火弹术", mp: 12, range: [1, 2], type: "atk", dmg: 24, school: "huo", source: "art", elem: "huo",
                desc: "凝火灵之气为弹，激射而出。火气灼金——对金行道基的修士妖兽事半功倍。" },

    /* —— 符箓（瞬发牌：一点灵气点燃封存法术，不占主行动）—— */
    huoshe_fu: { name: "火蛇符", mp: 1, range: [1, 4], type: "atk", dmg: 26, source: "art", elem: "huo", consume: "huoshe_fu", quick: true,
                desc: "符上封存火蛇之术，扬手即发（瞬发，不占行动）。火克金——金行强敌的破局之物。消耗一张符。" },
    hanbing_fu:{ name: "寒冰符", mp: 1, range: [1, 4], type: "atk", dmg: 26, source: "art", elem: "shui", consume: "hanbing_fu", quick: true,
                desc: "符上封存寒冰锥击，扬手即发（瞬发）。水克火——火行凶兽的对策。消耗一张符。" },

    // 符宝·金光砖（瞬发大杀器：充能制+冷却——杀手的凶器，如今是你的底牌）
    jinguang_zhuan: { name: "金光砖", mp: 3, range: [1, 4], type: "atk", dmg: 42, pierce: true, source: "art", elem: "jin",
                consume: "jinguang_zhuan_charge", cd: 2, quick: true,
                desc: "金光上人的符宝遗赠：金光化砖凌空砸落，势大力沉、无视护体（瞬发）。每次催动耗一道充能（灵石可回充），催动后须回气两回合。" },

    /* —— 战内丹药（瞬发：灵力恢复链的实战落点——灵力池整场不复，丹药是续命的那口气）—— */
    jinchuang_yao: { name: "服金疮药", mp: 0, range: [0, 0], type: "heal", heal: 40, quick: true, consume: "huixue_dan", source: "item",
                desc: "战中匀出一瞬吞下金疮药，气血回稳（瞬发，不占行动）。消耗一份金疮药。" },
    huiyuan_dan: { name: "回元丹", mp: 0, range: [0, 0], type: "buff", regen: 40, quick: true, consume: "huiyuan_dan", source: "item",
                desc: "一口吞下、灵力回涌 +40（瞬发，不占行动）。灵力池整场不复——这一粒，常是续命的那口气。消耗一枚回元丹。" },

    /* —— 控制符（瞬发）：拆大招、保蓄势、断追击 —— */
    dingshen_fu: { name: "定身符", mp: 1, range: [1, 4], type: "debuff", dingshen: 1, quick: true, consume: "dingshen_fu", source: "art",
                desc: "符上禁锢之术扬手贴出，定住敌身一回合（瞬发）——它动不了，你做什么都来得及。消耗一张符。" },

    /* —— 阵旗（瞬发）：往轴上铺区间，改写战场规则（阵法轴 v0）—— */
    zhenqi_kunzu: { name: "困足阵旗", mp: 2, range: [1, 4], type: "zone", zone: "kunzu", zoneSpan: 1, zoneTurns: 4, quick: true, consume: "zhenqi_kunzu", source: "art",
                desc: "掷向敌方脚下，布两步困足之阵（4回合）：敌踏入阵中寸步难行、移动即止。挡突进的硬墙（瞬发）。消耗一面阵旗。" },
    zhenqi_juling: { name: "聚灵阵旗", mp: 2, range: [0, 0], type: "zone", zone: "juling", zoneSpan: 1, zoneTurns: 5, selfZone: true, quick: true, consume: "zhenqi_juling", source: "art",
                desc: "掷于自己脚下，布两步聚灵之阵（5回合）：立于阵中每回合灵力+8。久战续航的根本（瞬发）。消耗一面阵旗。" },

    /* —— 青元剑诀（筑基后主修，李化元所赠——grade3 玄阶功法的威能跃迁）—— */
    qingyuan_jianmang: { name: "青元剑芒", mp: 11, range: [1, 3], type: "atk", dmg: 30, school: "mu", source: "art", elem: "mu",
                desc: "青元剑诀三层之技：灵力凝成三尺青芒，隔空斩落。玄阶功法的锋锐，远非黄阶小术可比。" },
    qingyuan_jiandun: { name: "青元剑盾", mp: 12, range: [0, 0], type: "def", shield: 24, school: "mu", source: "art",
                desc: "青元剑诀五层之技：剑芒环身结盾，密不透风。比长春护体坚实得多——筑基修士的防御底气。" },
    qingyuan_jianying: { name: "剑影分光", mp: 20, range: [1, 3], type: "atk", dmg: 16, fixedSegs: 3, cd: 2, minLayer: 7, school: "mu", source: "art", elem: "mu",
                desc: "青元剑诀七层之技·形态A分影多段：青芒一分为三、各自扑敌，每道分影独立结算克制与破甲。修为愈深、法宝相佐，分影愈众（更高层与绿煌剑解锁分光扫敌）。催动后须回气两回合。" },
    // 巨剑术（用户裁决·v149：随青元剑诀直授的大杀招——不纠结 canon 获取路径，重特效演出）：
    // 聚周身青芒铸丈余巨剑、自天倾斩。source:"art" 走标度尺(realmBand)同青元线；破甲+回气两回合。
    jujian_shu: { name: "巨剑术", mp: 16, range: [1, 3], type: "atk", dmg: 40, pierce: true, cd: 2, school: "mu", source: "art", elem: "mu",
                desc: "青元剑诀所附之大杀招：聚周身青芒凝铸丈余巨剑，自天倾斩而下——势大力沉、破甲裂阵，一剑之威胜百剑之繁。催动后须回气两回合。" },

    /* —— 法器战斗技（装备授予，gear grantSpells）——
     * source:"treasure"（御物）：威力随境界成长最陡（威力=注入灵力）；贴身-30%。 */
    tiejian_ci:  { name: "御剑刺", mp: 5, range: [1, 3], type: "atk", dmg: 10, source: "treasure", elem: "jin",
                desc: "御使外门铁剑凌空飞刺——黄枫谷入门下品法器的本分一击，威力寻常却胜在练气期便可催动。贴身施展不开（-30%）。" },
    zimu_ren:    { name: "金蚨子母刃", mp: 8, range: [1, 3], type: "atk", dmg: 15, fixedSegs: 2, source: "treasure", elem: "jin",
                desc: "万宝楼千年药草换得的顶阶法器：一柄母刃居中驭使，八柄子刃随神识分袭（动漫官设一母八子）。子刃两段连斩、每段独立结算，威力随灵力雄厚而涨。贴身施展不开（-30%）。" },
    jujian_zhan: { name: "巨剑斩", mp: 14, range: [1, 3], type: "atk", dmg: 40, pierce: true, source: "treasure", elem: "jin", cd: 2,
                desc: "御使丈余巨剑凌空斩落，势大力沉且破甲——一剑之威，胜过百剑之繁。催动后须回气两回合。贴身施展不开（-30%）。" },
    /* —— 乌龙夺（黄枫谷篇·元武国齐云霄以墨蛟之角炼成的四爪带毒攻击法宝——韩立筑基期第二主战）——
     * 四枚蛟爪分袭连抓、每爪独立结算；爪尖淬水行妖毒，抓痕入体持续掉血。
     * 非本命（本命=青竹蜂云剑）；授予在 story.js 齐云霄代工（增量C）。 */
    wulong_zhua: { name: "乌龙夺", mp: 11, range: [1, 3], type: "atk", dmg: 9, fixedSegs: 4, poison: { dmg: 8, turns: 3 }, source: "treasure", elem: "shui", cd: 1,
                desc: "墨蛟双角炼成的四爪短法宝御空飞出，四枚蛟爪分袭连抓、每爪独立结算；爪尖淬着墨蛟未散的水行妖毒，抓痕入体则毒发持续掉血。御物之技，威力随灵力雄厚而涨。贴身施展不开（-30%）。" },
    /* —— 绿煌剑（再别天南篇·御灵宗夺舍者本命法宝·结丹本命）——
     * driveRealm:2（结丹方可主驱）。越阶催动（统一设计）：威能×0.7^gap + 灵力×3^gap——
     *   筑基强驱（1档差）：80×2.4×0.7≈134 伤、13×3=39 灵力（杀手锏级，仍冠绝筑基）。
     *   达标后（结丹）灵力正常（13 MP），非本命×1.0。 */
    lvhuang_jian: { name: "绿煌剑", mp: 13, range: [1, 4], type: "atk", dmg: 80, pierce: true, source: "treasure", elem: "jin", driveRealm: 2, cd: 1,
                desc: "御使御灵宗夺舍者的本命古剑·绿煌剑凌空斩落——通体莹绿、剑吟如龙，势大力沉且破甲。这是结丹本命之器，你越阶强驱灵力消耗剧增——但每一击都是结丹级的威能。贴身施展不开（-30%）。" },
    jianying_fenguang: { name: "剑影分光", mp: 11, range: [1, 4], type: "atk", dmg: 26, fixedSegs: 3, source: "treasure", elem: "jin", driveRealm: 2,
                desc: "绿煌剑所附剑诀：一剑化作三道分光剑影分袭来敌，每道独立结算——越阶强驱灵力剧增，分影之利却最适缠斗群敌。贴身施展不开（-30%）。" },

    /* —— 悬浮法宝（驭物特例，combat-arsenal 二·五）——三类法宝制下大多数伴身件
     * 走被动面板，少数"驭物类"保留祭起态（float: { upkeep, auto }）。
     * ⚠ ruyi_hualan 为演武占位样例（正典获得=乱星海篇，届时精核） */
    ruyi_hualan: { name: "如意花篮（演武）", mp: 6, range: [0, 0], type: "float", source: "treasure", elem: "mu",
                float: { upkeep: 3, auto: { kind: "atk", dmg: 8, range: 4, name: "花雨" } },
                desc: "祭于半空的古朴花篮，彩花自篮中泉涌而出——花雨溅射近处之敌（每回合自动 8 伤），悬浮燃灵 3/回合。点击收回。" },

    /* —— 青竹蜂云剑（本命法宝·主攻；正典=星海飞驰篇炼成，演武先行）——
     * swordOrbit:true=持续绕身剑阵（UI 渲染 au-swords）；神雷附剑给它缠金雷 */
    qingzhu_jian: { name: "青竹蜂云剑", mp: 9, range: [1, 4], type: "atk", dmg: 22, fixedSegs: 2, source: "treasure", elem: "mu", swordOrbit: true, natal: true, driveRealm: 2,
                desc: "本命法宝·青竹蜂云剑：群剑御空、剑随神念分袭，两段连斩各自结算，威力随灵力雄厚而涨。可引辟邪神雷附剑、凌空劈落、雷遁穿空。" },

    /* —— 辟邪神雷三用途（v96 用户裁决：72 剑 72 雷=独立资源，取舍即战术）——
     * chargeCost: { id, n }——特色资源消耗（战斗内不回充——池制同源）。
     * ⚠ 正典获得=星海飞驰篇青竹蜂云剑炼成（结丹）；演武先行验证编排 */
    shenlei_pi: { name: "辟邪神雷·劈", mp: 6, range: [1, 10], type: "atk", dmg: 34, source: "treasure", elem: "mu", driveRealm: 2,
                aoe: true, aoeSpan: 10,
                chargeCost: { id: "shenlei", n: 1 }, slays: { ghost: 1.8, demon: 1.8 },
                desc: "自身畔引爆辟邪神雷、左右十格横扫——金雷自人而发（非法宝飞袭），近处之敌尽数笼罩（专克邪魔鬼物×1.8）。耗神雷一道，雷尽则止。" },
    shenlei_fujian: { name: "神雷附剑", mp: 4, range: [0, 0], type: "buff", source: "treasure", elem: "mu",
                chargeCost: { id: "shenlei", n: 3 }, leiEnchant: 3,
                desc: "三道神雷缠上本命飞剑——三回合内主攻法宝带金雷（伤害×1.25、克邪×1.5）。耗神雷三道。" },
    leidun:     { name: "雷遁", mp: 5, range: [0, 0], type: "buff", quick: true, source: "treasure", elem: "mu",
                chargeCost: { id: "shenlei", n: 1 }, blinkMove: true, needTrait: "fenglei",
                desc: "化一道银弧穿亚空间而行——本回合可瞬移到场上任意空位、无视挡线困足（瞬发）。需御「风雷翅」方可施展。耗神雷一道。韩跑跑的本钱。" },

    /* —— 噬金虫·四用法（初入星海篇·#5 用户裁决：复用神雷 chargeCost 共享池）——
     * 一窝灵虫四种调遣，同抽一池"灵机"（charges.shijinchong），打一分少一分、耗尽则哑火——取舍即战术。
     * 正典获得＝外星海致富偶得一窝噬金虫（见 data.js 同名条目）；持虫即四式入战（engine.playerFighter 注入 + 上膛）。
     * 全 source:"treasure"·driveRealm:2，chargeCost 消耗性底牌豁免越阶灵力倍率（Balance.driveMpMul 豁免）。 */
    shijin_fu:    { name: "噬金·附体", mp: 5, range: [0, 0], type: "def", shield: 36, source: "treasure", elem: "jin",
                chargeCost: { id: "shijinchong", n: 1 },
                desc: "纵噬金虫附于体表、淬结一层金芒虫甲护身（结盾 36）。耗灵机一分，虫尽则止。" },
    shijin_chao:  { name: "噬金·出战", mp: 6, range: [1, 5], type: "atk", dmg: 14, fixedSegs: 3, source: "treasure", elem: "jin", driveRealm: 2,
                chargeCost: { id: "shijinchong", n: 1 },
                desc: "放虫群如金云扑敌、分头撕咬（三段连噬、各自结算）——金芒专噬金铁，远近皆可笼罩。耗灵机一分，虫尽则止。" },
    shijin_blade: { name: "噬金·变武器", mp: 8, range: [1, 3], type: "atk", dmg: 36, pierce: true, cd: 1, source: "treasure", elem: "jin", driveRealm: 2,
                chargeCost: { id: "shijinchong", n: 2 },
                desc: "聚虫群凝成一柄噬金巨刃御使斩落——专啮金铁、破甲裂宝（必破甲）。耗灵机二分；催动后须回气一回合。虫尽则止。" },
    shijin_huashen: { name: "噬金·变身外化身", mp: 12, range: [1, 4], type: "atk", dmg: 24, fixedSegs: 3, pierce: true, cd: 2, source: "treasure", elem: "jin", driveRealm: 2,
                chargeCost: { id: "shijinchong", n: 3 },
                desc: "倾巢而出——万千噬金虫外化作一尊丈余虫王化身，扑食撕咬、势不可挡（三段破甲连击）。噬金虫的全力一击，耗灵机三分（半池倾覆）；催动后须回气两回合。虫尽则哑火。" },
  };

  function clampNum(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  /* ---------- 克制：灵技 × 道基（element-design.md）---------- */
  const KE = { jin: "mu", mu: "tu", tu: "shui", shui: "huo", huo: "jin" };
  function elemMul(atkElem, defElem) {
    if (!atkElem || !defElem) return 1;
    if (KE[atkElem] === defElem) return 1.25;
    if (KE[defElem] === atkElem) return 0.8;
    return 1;
  }

  /* ---------- 战斗者（轴上单位）---------- */
  class Fighter {
    constructor(cfg) {
      this.name = cfg.name;
      this.hp = cfg.hp;
      this.hpMax = cfg.hpMax || cfg.hp;
      this.shield = 0;
      // —— 灵力池（v2 核心资源：整场不自动恢复）——
      // mp=开战时的当前灵力；mpMax=池上限（丹药/聚灵阵最多回到这里）
      this.mpMax = cfg.mpMax != null ? cfg.mpMax : (cfg.mp != null ? cfg.mp : (30 + (cfg.qiLayer || 1) * 6));
      this.mp = cfg.mp != null ? Math.min(cfg.mp, this.mpMax) : this.mpMax;
      // —— 轴上属性 ——
      this.pos = cfg.pos != null ? cfg.pos : 0;   // 格号（开战时由 Combat 排位）
      this.move = cfg.move != null ? cfg.move : 1; // 移动力（格/回合）
      this.blink = !!cfg.blink;   // 雷遁（风雷翅类）：穿亚空间而非走步——无视挡线与困足，只看落点
      this.alt = 0;               // 高度层：0 地面 / 1 空中（2.5D 空层——修仙者的天空）
      this.canFly = !!cfg.canFly; // 有无腾空之能（御器/妖禽/风雷翅）
      this.lane = cfg.lane || 0;  // 排（2.5 排制）：0 战位排=规则主排；1+ 僚位排（演出纵深+少量规则钩子）
      // —— 仇恨账本（tactics T0）：谁打过它/谁在嘲讽它——敌方选目标的唯一依据 ——
      this.aggro = {};
      // —— 阵型（tactics T3）：pack=领队队形带 / loose=散兵 / anchor=钉桩守位 ——
      this.formation = cfg.formation || null;
      this.leader = !!cfg.leader;
      this.homePos = null;          // anchor 的岗位（开战时记下）
      // 飞行档（境界即高度——flight-ladder F0 分档：筑基1/结丹2/元婴3…）：
      // 档位同时驱动 凌空机动加成（airMove）/ 升空视觉高度 / 镜头后拉幅度——
      // "韩立飞得比南陇侯高"是实力的俯视；档位差=空层上的境界压制可见
      this.airGrade = cfg.airGrade != null ? cfg.airGrade : 1;
      this.airMove = cfg.airMove != null ? cfg.airMove : (1 + this.airGrade);   // 凌空身法加成：档1=+2
      this.team = cfg.team || "enemy";             // "player" | "enemy"
      this.sense = cfg.sense || 5;
      this.speed = cfg.speed || 10;
      this.insight = cfg.insight || 5;
      this.gongli = cfg.gongli || 20;
      this.agility = cfg.agility || 0;
      this.spells = cfg.spells || [];
      this.pouch = cfg.pouch || {};
      this.status = {};
      this.cooldowns = {};
      this.armor = cfg.armor || 0;
      this.elem = cfg.elem || null;
      this.nature = cfg.nature || null;
      this.slays = cfg.slays || null;
      this.immunePoison = cfg.immunePoison || cfg.nature === "corpse" || false;
      this.soulOnly = cfg.soulOnly || cfg.nature === "ghost" || false;
      this.dodgeBuff = 0;
      this.momentum = 0;
      this.momentumCap = cfg.momentumCap || 5;
      this.swordMastery = !!cfg.swordMastery;
      this.qiLayer = cfg.qiLayer || 1;
      this.dmgBonus = cfg.dmgBonus || 1;
      this.chargeResist = cfg.chargeResist || 0;
      this.tactics = cfg.tactics || null;
      this.regenBoost = cfg.regenBoost || 0;   // 回灵效率（伴身件：敛息/聚灵每口+X，池制不破）
      this.stubborn = !!cfg.stubborn;   // 蓄势韧性（妖王/大修士）：受击打断率减半
      this.boss = !!cfg.boss;
      this.mastery = cfg.mastery != null ? cfg.mastery : null;   // AI 熟练度：0 本能/1 老练/2 宗师（境界即经验）
      this.guardMove = cfg.guardMove || null;
      this.introNote = cfg.introNote || null;
      this.art = cfg.art || null;   // 专属立绘 key（侧位/敌人共用：渲染层 "bt_"+art 优先于按名匹配）
      this._dossier = !!cfg._dossier;
      this.technique = cfg.technique || null;
      this.grade = cfg.grade || 1;
      this.auxSkills = cfg.auxSkills || [];
      this.realmTier = cfg.realmTier || 0;
      this.layerMul = cfg.layerMul != null ? cfg.layerMul : 1;   // 主修功法层进度乘子（technique-tiers §5.4）
      this.techSpells = cfg.techSpells || [];                    // 吃 layerMul 的主修招式 id（仅主修当前层所授）
      this.exposed = false;          // 破绽（凝息/蓄势中受击+30%）
      this.floats = [];              // 悬浮中的法宝（驭物特例——绕身自动运转）
      // 特色资源（v96 用户裁决"一定要有取舍/耗尽"）：神雷/煞气/符力……
      // { id: { name, cur, max } }——战斗内不回充（池制同源），耗尽则相关手段哑火
      this.charges = cfg.charges || null;
      this.gearMpMul = cfg.gearMpMul || {};  // 越阶催动灵力消耗倍率（spellId → multiplier）
      this.escaped = false;          // 已遁走离场
      this.intent = null;
      this.attacks = cfg.attacks || null;
      this.atk = cfg.atk; this.atkName = cfg.atkName; this.soulAtk = cfg.soulAtk; this.pierceAtk = cfg.pierce;
      // 敌人卡的妖兽/修士范式：妖兽肉搏不耗蓝，修士技耗蓝（卡上可逐招标 mp）
      this.desiredRange = cfg.desiredRange != null ? cfg.desiredRange
        : (this.nature === "beast" || this.nature === "corpse") ? 1
        : 2;                          // 法修默认中距对轰
      this.canFlee = cfg.canFlee !== false && !/心魔|劫/.test(this.name || "");
    }
    get alive() { return this.hp > 0 && !this.escaped; }
    // 越阶催动：法器 minLayer > 玩家 layer 时灵力消耗倍增（杀手锏设计）
    spellMp(spellId, sp) { return Math.round((sp.mp || 0) * (this.gearMpMul[spellId] || 1)); }
    hasConsumable(id) { return (this.pouch[id] || 0) > 0; }
    takeDamage(dmg, opts = {}) {
      if (this.soulOnly && !opts.soul) return { blocked: true, dealt: 0 };
      let remaining = dmg;
      if (this.exposed) remaining = Math.round(remaining * 1.3);   // 破绽：受击+30%
      if (this.armor > 0 && !opts.pierce && !opts.soul) {
        remaining = Math.max(1, remaining - this.armor);
      }
      if (this.shield > 0 && !opts.pierce) {
        const absorbed = Math.min(this.shield, remaining);
        this.shield -= absorbed;
        remaining -= absorbed;
      }
      this.hp = clampNum(this.hp - remaining, 0, this.hpMax);
      return { blocked: false, dealt: remaining, exposed: this.exposed };
    }
  }

  /* ---------- 对阵轴战斗主体 ---------- */
  class Combat {
    constructor(cfg) {
      this.player = cfg.player instanceof Fighter ? cfg.player : new Fighter(cfg.player);
      this.player.team = "player";
      this.enemies = (cfg.enemies || []).map(e => e instanceof Fighter ? e : new Fighter(e));
      this.enemies.forEach(e => { e.team = "enemy"; });
      this.maxRounds = cfg.maxRounds || 30;
      this.round = 0;
      this.stats = {};
      this._stat = (key, n) => { if (n > 0) this.stats[key] = (this.stats[key] || 0) + n; };
      this._startHp = this.player.hp;
      this.status = "ongoing";       // ongoing | win | lose | fled
      this.log = [];
      this.rng = cfg.rng || Math.random;
      this.mode = cfg.mode || "battle";
      this._pendingEnemyWaves = cfg.waves || null;
      // —— H·下·皇宫决战两块新机制——
      //   objective：拖时布阵战——{kind:"survive", rounds:N} 拖满 N 回合不死即胜（败有所得首例）；
      //   fieldCycle：真·颠倒五行阵——逐回合战场规则切换（相位数组，阵成后压制敌、佐助我）。
      this.objective = cfg.objective || null;
      this.fieldCycle = cfg.fieldCycle || null;
      this.fieldManual = !!cfg.fieldManual;
      this._fieldPhase = null;
      this._fieldUsed = [];   // 手动模式下已用过的相位索引
      // —— 轴战场：格数随战斗规格（v95 大战场小人物：标准 11，多敌/boss 15——
      //    战场大→走位与射程才有意义；突破=心象方寸不变）——
      this.W = cfg.W || (cfg.fronts && cfg.fronts.length ? this._frontsWidth(cfg.fronts)
        : this.mode === "breakthrough" ? 5
        : (this.enemies.length >= 2 || cfg.boss) ? 15 : 11);
      // —— 排数（2.5 排制）：与 W 同源——都由"真实战场有多大"决定（洞窟2/旷野3/大战4）
      this.L = Math.max(2, cfg.lanes || 2);
      // —— 侧位单位（T4 sides[] 复数化）：同道/灵宠/傀儡可同场多位——
      //    皇宫三组对位的引擎基石；cfg.side（单）与 cfg.sides（数组）双入口，
      //    旧代码经 get side()（=sides[0]）零破坏过渡。⚠ 必须先于 units() 任何调用
      this.sides = [];
      (cfg.sides ? cfg.sides : (cfg.side ? [cfg.side] : [])).forEach(s => {
        this.sides.push(this._makeSideFighter(s));
      });
      // 排位整理：敌方至少一人压战位排（全员僚位=贴身永远够不着，规则上不成立）；排号封顶
      this.units().forEach(u => { u.lane = clampNum(u.lane || 0, 0, this.L - 1); });
      if (this.enemies.length && !this.enemies.some(e => e.alive && (e.lane || 0) === 0)) {
        const first = this.enemies.find(e => e.alive);
        if (first) first.lane = 0;
      }
      // —— 阵法格（zones）：往轴上铺的区间规则 { from, to, type, turns, team } ——
      this.zones = cfg.zones ? cfg.zones.slice() : [];
      // —— 地雷（mines）：埋在格上的伏着（伏火符/铁奴埋伏）——敌踏入即触发
      //    { cell, kind: "anfu"|"tienu", name, dmg, hold, used }
      this.mines = cfg.mines ? cfg.mines.slice() : [];
      // —— 热点（hotspots）：洞窟没采完的灵草灵石原格上轴——战中走到跟前花一个主行动照采
      //    （同轴一体：探索与战斗是同一条轴的两种时间规则，东西不会因为开打就消失）
      this.hotspots = cfg.hotspots ? cfg.hotspots.map(h => Object.assign({}, h)) : [];
      this._layoutUnits();
      // 探索→战斗无缝衔接：站位继承（L3 轴式洞窟——探索格即战斗格）
      if (cfg.playerPos != null) this.player.pos = clampNum(cfg.playerPos, 0, this.W - 1);
      if (cfg.enemyPos != null) this.enemies.forEach((e, i) => { e.pos = clampNum(cfg.enemyPos - i, 0, this.W - 1); });
      // 逐敌定位（多组对位/三战线用）：把每个敌人摆进各自的战区（覆盖 enemyPos 的统一排布）
      if (cfg.enemiesPos) cfg.enemiesPos.forEach((p, i) => { if (p != null && this.enemies[i]) this.enemies[i].pos = clampNum(p, 0, this.W - 1); });
      const sposArr = cfg.sidesPos || (cfg.sidePos != null ? [cfg.sidePos] : null);
      this.sides.forEach((s, i) => {
        if (sposArr && sposArr[i] != null) s.pos = clampNum(sposArr[i], 0, this.W - 1);
        else if (cfg.playerPos != null) s.pos = clampNum(this.player.pos + 1 + i, 0, this.W - 1);
      });
      // —— 战区（front）声明式布局（teamfight-camera-design §3.A/D）：报一张战线表即得整片大战场——
      //    自动落位（我方锚点 at，敌人右贴 at+1…）＋锁线（本区敌人杀意锁本区我方）＋暴露 _fronts 给 UI 导演层。
      //    以后所有复杂团战只填 fronts:[{ally,enemies,at,name}] 即复用同款效果；不填的老战斗零回归。
      if (cfg.fronts && cfg.fronts.length) this._layoutFronts(cfg);
      // 跨线驰援开关（皇宫三组对位 startSantuanFight）：本方某战线告急时，已了结当面之敌的同袍横越驰援。
      //   多战区默认开（可被 cfg.crossSupport 显式关）——“互相协助、自由协作”靠这一口。
      this.crossSupport = cfg.crossSupport != null ? !!cfg.crossSupport
        : !!(this._fronts && this._fronts.length >= 2);
      // 开场扫场（teamfight-camera-design B3）：多战线团战开战时镜头横扫各战区亮一遍再落回韩立——
      //   "一眼看清三摊架在哪"。多战区默认开（日常单挑无 fronts 不扰），cfg.openingSweep 显式开/关。
      this._sweepOnOpen = cfg.openingSweep != null ? !!cfg.openingSweep
        : !!(this._fronts && this._fronts.length >= 2);
      // 初始仇恨播种（多组对位锁线/钓怪）：开战前先定杀意流向——三组对位才成"三条战线"而非一锅端混战
      //   形如 [{ e:敌序号, key:"side:0"|"player", amt:数值 }]；须在 _rollEnemyIntents 之前
      if (cfg.aggroSeed) cfg.aggroSeed.forEach(seed => {
        const e = this.enemies[seed.e]; if (e) e.aggro[seed.key] = (e.aggro[seed.key] || 0) + seed.amt;
      });
      // —— AI 熟练度分级（用户裁决"分境界多级 AI"：境界即战斗经验）——
      //    0 本能：按权重乱打（野兽/低阶散修）；1 老练：会抓你的破绽下重手（同阶修士/兽王）；
      //    2 宗师：还会读你的布置（不踩困足阵）、挑你起不来的时机蓄势（高阶/剧情 boss）。
      const pL = this.player.qiLayer || 1;
      this.enemies.forEach(e => {
        if (e.mastery != null) return;
        if (e.nature === "beast" || e.nature === "corpse") e.mastery = e.boss ? 1 : 0;
        else if ((e.qiLayer || 1) - pL >= 3 || (e.boss && e.stubborn)) e.mastery = 2;
        else e.mastery = (e.qiLayer || 1) >= pL - 1 ? 1 : 0;
      });
      // 回合内玩家行动经济：移动 ≤move 格 + 1 主行动 + 1 瞬发
      this._resetPlayerEconomy();
      this._rollEnemyIntents();
    }

    // 战区表→战场宽度：我方锚点 at，敌人右贴 at+1…at+n；取最右占格 +2 留白，下限 14 触发宽轴巡游相机。
    _frontsWidth(fronts) {
      let maxCell = 0;
      fronts.forEach(f => {
        const n = (f.enemies || []).length;
        maxCell = Math.max(maxCell, (f.at || 0) + n);
      });
      return Math.max(14, maxCell + 2);
    }
    // 战区表→落位+锁线（声明式大战场的引擎落点）。allyKey: "player" | "side:N"。
    _layoutFronts(cfg) {
      this._fronts = [];
      cfg.fronts.forEach(f => {
        const allyKey = f.ally || "player";
        const si = allyKey === "player" ? -1 : +(allyKey.split(":")[1] || 0);
        const ally = si < 0 ? this.player : this.sides[si];
        if (ally) ally.pos = clampNum(f.at, 0, this.W - 1);
        const akey = si < 0 ? "player" : "side:" + si;   // aggro 账本键（side 一律用 side:N）
        const enemyIdxs = [];
        (f.enemies || []).forEach((ei, k) => {
          const e = this.enemies[ei];
          if (!e) return;
          e.pos = clampNum(f.at + 1 + k, 0, this.W - 1);
          (e.aggro || (e.aggro = {}))[akey] = (e.aggro[akey] || 0) + 120;   // 锁线：本区敌人咬本区我方
          enemyIdxs.push(ei);
        });
        this._fronts.push({ name: f.name || null, at: f.at, allyKey, enemyIdxs });
      });
    }
    _makeSideFighter(s) {
      const f = new Fighter({
        name: s.name, hp: s.hp, hpMax: s.hpMax, team: "player",
        move: s.move != null ? s.move : 1,
        elem: s.elem || null, nature: s.nature || null, slays: s.slays || null,
        // 同规则灵力池：进场 mp 可低（带伤上阵），池上限独立（敛息/聚灵能回到这）
        mp: s.mp != null ? s.mp : 30,
        mpMax: s.mpMax != null ? s.mpMax : Math.max(s.mp != null ? s.mp : 30, 30),
      });
      f.isSide = true;
      f.kind = s.kind || "corpse";
      f.sideRef = s;                 // 原始引用（Engine 战后回写用；persona 人格权重在此）
      f.atk = s.atk; f.atkName = s.atkName;
      f.moves = s.moves || null;
      f.guard = s.guard || 0.3;
      f.art = s.art || null;
      f.soulTouch = !!s.soulTouch;
      f.stance = s.stance || "follow";   // 简令：follow随 / attack攻 / guard守 / retreat撤
      // 排位天性：远程手站僚位（演出纵深+贴身打不到）；纯近战（尸傀类）天生顶在战位排
      const ranged = (s.moves || []).some(m => m.range && m.range[1] > 1);
      f.lane = s.lane != null ? s.lane : (ranged ? 1 : 0);
      // 腾空之能（敌我同规则）：结丹同道天生御空——airGrade 随定义传入
      f.canFly = !!s.canFly;
      f.airGrade = s.airGrade != null ? s.airGrade : 1;
      f.mastery = s.mastery != null ? s.mastery : 1;   // 同道默认老练；≥2=客随（它主导，你配合）
      // 灵虫/灵宠形态（用户裁决：点形态章切换化枪/附体/分身——乱星海噬金虫开多形态）
      f.forms = s.forms || null;
      f.form = s.form || (s.forms ? s.forms[0] : null);
      f.movesByForm = s.movesByForm || null;
      return f;
    }

    /* 旧接口兼容（T4）：c.side 读=首位侧位——单侧位场景的全部旧路径零改动 */
    get side() { return this.sides && this.sides[0] || null; }

    /* ----- 开战排位：我方左、敌方右；侧位（尸傀/同道）顶前排=挡线位 ----- */
    _layoutUnits() {
      const W = this.W;
      this.player.pos = 1;
      this.sides.forEach((s, i) => { s.pos = 2 + i; });
      if (this.mode === "breakthrough") { this.player.pos = 1; }
      const n = this.enemies.length;
      this.enemies.forEach((e, i) => { e.pos = clampNum(W - 1 - i, this.player.pos + 1, W - 1); });
    }

    _log(msg) { this.log.push(msg); }

    /* ----- 所有存活单位（轴渲染/占格判定用）----- */
    units() {
      const u = [this.player];
      this.sides.forEach(s => { if (s.hp > 0) u.push(s); });
      this.enemies.forEach(e => { if (e.alive) u.push(e); });
      return u;
    }
    /* 占格语义（2.5 排制）：默认只看战位排（lane 0）——僚位不占格、不挡路。
     * alt=null 任意层；lane=null 任意排（少数全场查找用）。 */
    unitAt(pos, alt = null, lane = 0) {
      return this.units().find(u => u.pos === pos
        && (alt == null || (u.alt || 0) === alt)
        && (lane == null || (u.lane || 0) === lane)) || null;
    }
    /* 简令→排位映射（2.5 排制）：攻=压上战位排拼输出（可被贴身）；
     * 守=贴玩家的僚位随时挡刀；撤=缩到最深排；随=远程僚位/近战战位的天性 */
    setSideStance(st, idx = 0) {
      const s = this.sides[idx];
      if (!s) return;
      s.stance = st;
      const natural = (s.moves || []).some(m => m.range && m.range[1] > 1) ? 1 : 0;
      s.lane = st === "attack" ? 0 : st === "retreat" ? (this.L - 1)
        : st === "guard" ? Math.min(1, this.L - 1) : natural;
    }
    dist(a, b) { return Math.abs(a.pos - b.pos); }
    zoneAt(pos, type) { return this.zones.find(z => z.type === type && pos >= z.from && pos <= z.to) || null; }
    /* 己方单位（韩立本体 / 同道 / 我驭使的尸傀·灵宠）——封逃口判定（阶段8 堵口=封逃）用 */
    _isAlly(u) { return u === this.player || !!(u && u.isSide); }

    /* D1 玩家本格不容他人驻足：除「境界比你高」的单位外，谁都不能停在你脚下那一格；
     * 你亲手操控的傀儡/灵宠（非「同道」侧位）更是绝无例外。可借道穿过、不得落脚。 */
    _mayShareCell(unit) {
      if (unit === this.player) return true;
      if (unit.isSide && unit.kind !== "ally") return false;   // 我驭使的尸傀/灵宠：永不占我格
      return (unit.realmTier || 0) > (this.player.realmTier || 0);   // 余者唯高我一境者可越次
    }
    /* 兜底：某单位行动结束若仍立于玩家本格（且无权如此），就近挪开半步——你脚下不站旁人 */
    _ejectFromPlayerCell(u) {
      if (this._mayShareCell(u) || u.pos !== this.player.pos) return;
      for (const dp of [1, -1, 2, -2]) {
        const np = u.pos + dp;
        if (np < 0 || np >= this.W || np === this.player.pos) continue;
        if (this.unitAt(np, u.alt || 0, u.lane || 0)) continue;
        u.pos = np; return;
      }
    }
    /* 身法上限：凌空+airMove（御空本就比脚程快——视野与可动范围随升空同步扩大；
     * airMove 随 airGrade 境界分档：筑基+2/结丹+3/元婴+4……敌我同规则） */
    moveCap(u) { return (u.move || 1) + ((u.alt || 0) === 1 ? (u.airMove != null ? u.airMove : 2) : 0); }

    /* ===== 悬浮法宝（三位制·祭出位，v96）=====
     * 神识=并用上限（大衍诀的战斗意义）：基础1，dayan/结丹/元婴逐档+1 */
    floatSlots(u) {
      let n = 1 + Math.max(0, (u.realmTier || 0) - 1);   // 结丹(2)+1、元婴(3)+2…
      if (u._dayan) n += 1;
      return n;
    }
    playerFloat(spellId) {
      const p = this.player, sp = SPELLS[spellId];
      if (!sp || sp.type !== "float") return { ok: false, reason: "非悬浮法宝" };
      if (p.floats.includes(spellId)) {
        // 收回：不占行动（撤掉神识便是）
        p.floats = p.floats.filter(x => x !== spellId);
        this._log(`你心念一动，「${sp.name}」化光收回袖中。`);
        return { ok: true, recalled: true };
      }
      if (p.floats.length >= this.floatSlots(p)) return { ok: false, reason: `神识不济——同时驭使 ${this.floatSlots(p)} 件已是极限` };
      if (this._pActsUsed >= this._pActsMax) return { ok: false, reason: "行动已尽" };
      if (p.spellMp(spellId, sp) > p.mp) return { ok: false, reason: "灵力不足" };
      this._pActsUsed++;
      p.mp -= p.spellMp(spellId, sp);
      p.floats.push(spellId);
      this._log(`你掐诀祭起「${sp.name}」——宝光绕身悬浮，自行运转（燃灵 ${sp.float.upkeep}/回合）！`);
      this._emitFx("player", "miss", "祭起");
      return { ok: true };
    }
    /* 悬浮结算（startRound）：抽灵+自动运转；灵力不济=坠收+破绽（同凌空灵竭的物理学） */
    _floatUpkeep(u) {
      if (!u.floats || !u.floats.length) return;
      for (const id of u.floats.slice()) {
        const sp = SPELLS[id];
        const cost = (sp.float && sp.float.upkeep) || 3;
        if ((u.mp || 0) < cost) {
          u.floats = u.floats.filter(x => x !== id);
          u.exposed = true;
          this._log(`灵力不济——「${sp.name}」宝光一黯坠回${u === this.player ? "你" : u.name}袖中，气机一滞（破绽）！`);
          continue;
        }
        u.mp -= cost;
        const auto = sp.float && sp.float.auto;
        if (auto && auto.kind === "atk") {
          // 自动出力：打最近的活敌（敌我同规则——敌方悬浮则打我方最近者）
          const foes = u.team === "player" ? this.enemies.filter(e => e.alive)
            : [this.player].concat(this.sides.filter(x => x.hp > 0));
          const near = foes.filter(f => this.dist(u, f) <= (auto.range || 4))
            .sort((a, b) => this.dist(u, a) - this.dist(u, b))[0];
          if (near) {
            let fd = auto.dmg || 6;
            if (sp.elem && near.elem) fd = Math.round(fd * elemMul(sp.elem, near.elem));
            const r = near.takeDamage(fd, {});
            this._log(`「${sp.name}」自行运转，${auto.name || "宝光"}溅向 ${near === this.player ? "你" : near.name}（-${r.dealt}）。`);
            this._emitFx(this._refOf(near), "dmg", r.dealt);
            if (near.team === "enemy") this.addAggro(near, u === this.player ? "player" : this.sideKey(u), r.dealt);
          }
        } else if (auto && auto.kind === "shield") {
          const cap = u._shieldCap || Math.round(u.hpMax * 0.5);
          if ((u.shield || 0) < cap) {
            u.shield = Math.min(cap, (u.shield || 0) + (auto.shield || 6));
            this._log(`「${sp.name}」宝光流转，自行补上护体（+${auto.shield || 6}）。`);
          }
        }
      }
      this._checkEnd();
    }

    /* ===== 仇恨账本（tactics T0）——一切战术的地基 =====
     * 积累：被谁打（主项=伤害）/嘲讽挡线/贴身压力/控制技；衰减：每回合 15%+远距加倍。
     * 消费分 mastery 三档：本能=纯仇恨；老练=仇恨×挑软柿子；宗师=还会读防御姿态。
     * anchor 阵型仇恨封顶（钉桩拉不走——强攻或绕过，玩家的抉择）。 */
    addAggro(e, key, amt) {
      if (!e || e.team !== "enemy" || !e.alive) return;
      const cap = e.formation === "anchor" ? 24 : 999;
      e.aggro[key] = Math.min(cap, (e.aggro[key] || 0) + amt);
    }
    /* 仇恨键（T4 多侧位）："player" | "side:0" | "side:1"…（旧键 "side" 视同 "side:0"） */
    _aggroUnit(key) {
      if (key === "player") return this.player;
      const m = /^side(?::(\d+))?$/.exec(key);
      return m ? this.sides[+(m[1] || 0)] || null : null;
    }
    sideKey(s) { const i = this.sides.indexOf(s); return i >= 0 ? "side:" + i : "side:0"; }
    _decayAggro() {
      this.enemies.forEach(e => {
        if (!e.alive) return;
        for (const k in e.aggro) {
          const u = this._aggroUnit(k);
          let f = 0.85;
          if (!u || u.hp <= 0) f = 0;                      // 死人无仇可记
          else if (this.dist(e, u) > 6) f = 0.68;          // 拉远了，杀意冷却
          e.aggro[k] *= f;
          if (e.aggro[k] < 0.5) delete e.aggro[k];
        }
      });
    }
    // 塌线重定向（teamfight-camera-design C3）：某战线我方锚点已倒、本区尚有活敌——把这些"无主"
    //   之敌的杀意改投最近仍有活我方的战线，战场由"三摊"自然收束成"两摊→一摊"（导演镜头随之聚焦）。
    //   一次性改投（_collapsedTo 防每回合重复刷）；只在 fronts/crossSupport 团战里动，老战斗零回归。
    _redirectOrphanFronts() {
      if (!this._fronts || this._fronts.length < 2 || !this.crossSupport) return;
      const allyOf = key => key === "player" ? this.player : this.sides[+(key.split(":")[1] || 0)];
      const liveFronts = this._fronts.filter(f => { const a = allyOf(f.allyKey); return a && a.hp > 0; });
      if (!liveFronts.length) return;
      this._fronts.forEach(f => {
        const a = allyOf(f.allyKey);
        if (a && a.hp > 0) return;   // 锚点尚在，不算塌线
        const orphans = f.enemyIdxs.map(i => this.enemies[i]).filter(e => e && e.alive && !e._collapsedTo);
        if (!orphans.length) return;
        const tgt = liveFronts.slice().sort((x, y) => Math.abs(x.at - f.at) - Math.abs(y.at - f.at))[0];
        if (!tgt) return;
        orphans.forEach(e => {
          e.aggro = e.aggro || {};
          e.aggro[tgt.allyKey] = (e.aggro[tgt.allyKey] || 0) + 150;   // 改锁最近活线锚点
          e._collapsedTo = tgt.allyKey;
        });
        const tn = tgt.name || (allyOf(tgt.allyKey) ? allyOf(tgt.allyKey).name : "邻线");
        this._log(`${f.name || "一线"}我方已倒，余下凶徒循着杀气涌向「${tn}」——战线塌作一处！`);
      });
    }
    /* 开口的同道（T4 多侧位）：统帅优先，其次第一个活着的 ally */
    _allyVoice() {
      if (this._leadBy && this._leadBy.hp > 0) return this._leadBy;
      return this.sides.find(s => s.hp > 0 && s.kind === "ally") || null;
    }
    /* ===== 台词活化（T2）：情境开口+一场不复读——说话因为发生了事 ===== */
    _say(u, key) {
      if (!u || typeof WarLines === "undefined") return false;
      const persona = u._persona || u.art
        || (u.team === "enemy" ? ((u.nature === "beast" || u.nature === "corpse") ? "enemy_beast" : "enemy_cultivator") : null);
      if (!persona || !WarLines.has(persona)) return false;
      this._linesUsed = this._linesUsed || new Set();
      const line = WarLines.pick(persona, key, this._linesUsed);
      if (!line) return false;
      this._log(line.startsWith("（") ? `${u.name}${line}` : `${u.name}：「${line}」`);
      return true;
    }

    /* 它现在最恨谁（敌方选目标/朝向/背袭判定共用）——返回 Fighter。
     * T4：候选=玩家+全部活侧位（多组对位由仇恨自然分流） */
    aggroTarget(e) {
      const cands = [{ u: this.player, key: "player" }];
      this.sides.forEach((s, i) => {
        if (s.hp > 0) cands.push({ u: s, key: "side:" + i, alt: i === 0 ? "side" : null });
      });
      let best = null, bestScore = -1;
      for (const c of cands) {
        const raw = (e.aggro[c.key] || 0) + (c.alt ? (e.aggro[c.alt] || 0) : 0);   // 旧键 "side" 并账
        let s = raw + (c.key === "player" ? 0.01 : 0);   // 平手时杀气最重的是你
        if ((e.mastery || 0) >= 1) s *= 1 + (1 - c.u.hp / c.u.hpMax) * 0.6;   // 老练：先挑软柿子（阴手"先攻最弱"）
        if ((e.mastery || 0) >= 2) {
          // 宗师：读防御姿态——护体厚/身法拉满的目标先放一放
          if ((c.u.shield || 0) > c.u.hpMax * 0.2 || (c.u.dodgeBuff || 0) >= 0.2) s *= 0.8;
        }
        if (s > bestScore) { bestScore = s; best = c.u; }
      }
      return best || this.player;
    }

    /* ----- 移动合法性：目标格须空（同层）；路径上同层敌方单位阻挡（挡线），友方可穿。
     * 雷遁（blink）例外：穿亚空间越界而行——无视挡线，只看落点（风雷翅的拉扯资本）。
     * 空中单位互不挡地面（天上的拦不住地上的路）。 ----- */
    canMoveTo(unit, toPos, capOverride) {
      const lv = unit.alt || 0, ln = unit.lane || 0;
      if (toPos < 0 || toPos >= this.W) return false;
      if (toPos === unit.pos) return false;
      if (Math.abs(toPos - unit.pos) > (capOverride != null ? capOverride : this.moveCap(unit))) return false;
      if (this.unitAt(toPos, lv, ln)) return false;
      if (unit.blink || unit._blinkTurn || lv === 1) return true;   // 雷遁（常驻/本回合）/凌空：挡线如无物
      const dir = toPos > unit.pos ? 1 : -1;
      for (let p = unit.pos + dir; p !== toPos; p += dir) {
        const o = this.unitAt(p, 0, ln);
        if (o && o.team !== unit.team) return false;   // 敌方占格=真墙（仅同排地面层——僚位不挡战位的路）
      }
      return true;
    }
    movableCells(unit) {
      // 玩家中途盘点：只亮"剩余步数"够得着的格（凌空步程大，亮的格也随之多——视野与可动同扩）
      // 雷遁本回合(_blinkTurn)：穿亚空间——可达范围放大到全场（只看落点空否，长距离瞬移）
      const cap = unit === this.player
        ? (this.player._blinkTurn ? this.W : Math.max(0, this.moveCap(unit) - (this._pMoved || 0)))
        : this.moveCap(unit);
      const cells = [];
      for (let p = 0; p < this.W; p++) if (this.canMoveTo(unit, p, cap)) cells.push(p);
      return cells;
    }

    /* ----- 玩家回合行动经济：移动 + 主行动×N + 瞬发×1 -----
     * 主行动数默认 1；遁速远胜敌手时概率+1（风雷翅时代的具象）。
     * 重型技 actCost=2：一招吃掉整回合行动——"快而轻"与"慢而重"的 build 语言。 */
    _resetPlayerEconomy() {
      this._pMoved = 0;          // 已移动格数
      this._pActsUsed = 0;       // 已用主行动数
      this._pActsMax = this._pActsMax || 1;
      this._pQuickUsed = false;  // 瞬发已用
    }
    get _pActed() { return this._pActsUsed >= this._pActsMax; }   // 兼容旧判定
    playerCanMove() { return this.status === "ongoing" && this._pMoved < (this.player._blinkTurn ? this.W : this.moveCap(this.player)); }
    playerMove(toPos) {
      if (this.status !== "ongoing") return { ok: false, reason: "战斗已结束" };
      // 雷遁本回合：穿亚空间——移动上限放大到全场（只看落点，长距离瞬移）
      const cap = this.player._blinkTurn ? this.W : this.moveCap(this.player);
      const left = cap - this._pMoved;
      if (left <= 0) return { ok: false, reason: "本回合身法已尽" };
      const d = Math.abs(toPos - this.player.pos);
      if (d > left) return { ok: false, reason: "脚程不够" };
      const ok = this.canMoveTo(this.player, toPos, left);
      if (!ok) return { ok: false, reason: "去不了那里（有人挡路或格被占）" };
      // 困足阵（敌方所布）：途经即陷——停在入阵那格，本回合步数耗尽。
      // 雷遁不踩地：亚空间穿行，困足阵奈何不得
      const dir0 = toPos > this.player.pos ? 1 : -1;
      let finalPos = toPos, trapped = false;
      if (!this.player.blink && !this.player._blinkTurn && (this.player.alt || 0) === 0) {   // 雷遁/凌空不踩地，困足阵奈何不得
        for (let p = this.player.pos + dir0; ; p += dir0) {
          const z = this.zoneAt(p, "kunzu");
          if (z && z.team !== "player") { finalPos = p; trapped = true; break; }
          if (p === toPos) break;
        }
      }
      const dUsed = trapped ? this.moveCap(this.player) : Math.abs(finalPos - this.player.pos);
      // 蓄势中移动：心神一散，蓄势溃了
      if (this.player._charging) {
        this._log(`你挪动脚步，凝聚到一半的「${this.player._charging.name}」溃散了。`);
        this.player._charging = null;
        this.player.exposed = false;
      }
      // 绕后判定：穿过敌人身位（身法迂回）——背门大开，下一击+20%（它行动时转过身来即失效）
      const before = this.player.pos;
      this.enemies.forEach(e => {
        if (!e.alive) return;
        const wasLeft = before < e.pos, nowLeft = finalPos < e.pos;
        if (wasLeft !== nowLeft && before !== e.pos && finalPos !== e.pos) {
          e._backTurned = true;
          this._log(`你身形一闪绕到 ${e.name} 身后——背门大开！（下一击+2成）`);
        }
      });
      this.player.pos = finalPos;
      this._pMoved += dUsed;
      if (trapped) this._log(`你一脚踏进困足阵——脚下如陷泥沼，寸步难移！`);
      this._emitFx("player", "move", null);
      return { ok: true };
    }
    /* ----- 战中采集：同格/邻格的热点，花一个主行动摘下（一边打一边贪）-----
     * 蹲下去摘东西的那一拍不打人——这是"贪与稳"在回合制里的等价物。 */
    playerCanTake(h) {
      return this.status === "ongoing" && h && !h.taken
        && Math.abs(this.player.pos - h.pos) <= 1
        && this._pActsUsed < this._pActsMax;
    }
    playerTake(hotId) {
      if (this.status !== "ongoing") return { ok: false, reason: "战斗已结束" };
      const h = this.hotspots.find(hh => hh.id === hotId && !hh.taken);
      if (!h) return { ok: false, reason: "已被采过" };
      if (Math.abs(this.player.pos - h.pos) > 1) return { ok: false, reason: "隔得太远，够不着" };
      if (this._pActsUsed >= this._pActsMax) return { ok: false, reason: "行动已尽——腾不出手去摘" };
      this._pActsUsed++;
      h.taken = true;
      this._log(`你矮身一探，趁乱将「${h.name}」收入袖中——这一拍没出手，全场只有你知道值不值。`);
      this._emitFx("player", "move", null);
      if (typeof this._afterTake === "function") this._afterTake(h);
      return { ok: true, id: h.id, name: h.name, loot: h.loot };
    }

    /* ----- 空层（2.5D）：升空/落地——把战场抬进修仙者的天空 -----
     * 升降花全部身法（垂直方向也是赶路）；凌空每回合燃灵力 3（御器悬空非白来）；
     * 空中免地面贴身/困足/地雷，重击会被打落（击落=坠地+硬直）。 */
    playerCanFly() {
      return this.status === "ongoing" && this.player.canFly
        && this._pMoved < this.moveCap(this.player)
        && ((this.player.alt || 0) === 1 || this.player.mp >= 3);
    }
    playerFly() {
      if (this.status !== "ongoing") return { ok: false, reason: "战斗已结束" };
      if (!this.player.canFly) return { ok: false, reason: "尚无腾空之能" };
      if (this._pMoved >= this.moveCap(this.player)) return { ok: false, reason: "本回合身法已尽" };
      if (this.player._charging) {
        this._log(`你拔身而起，凝聚到一半的「${this.player._charging.name}」溃散了。`);
        this.player._charging = null;
        this.player.exposed = false;
      }
      if ((this.player.alt || 0) === 0) {
        if (this.player.mp < 3) return { ok: false, reason: "灵力不济，托不住身子" };
        this.player.alt = 1;
        this._pMoved = this.player.move;
        this._log(`你一咬牙催动遁术拔身而起——天地倏然开阔，地上的獠牙再够不到你的衣角。（凌空每回合耗灵3）`);
        this._emitFx("player", "move", null);
        return { ok: true, alt: 1 };
      }
      if (this.unitAt(this.player.pos, 0)) return { ok: false, reason: "脚下有人占着，落不下去" };
      this.player.alt = 0;
      this._pMoved = this.player.move;
      this._log(`你按下遁光、足尖点地——重新踏回了这片战场。`);
      this._emitFx("player", "move", null);
      return { ok: true, alt: 0 };
    }

    /* 遁走：退到己方边缘格后可脱离战斗（主行动） */
    playerCanFlee() { return this.player.pos === 0 && this._pActsUsed < this._pActsMax && this.mode !== "breakthrough"; }
    playerFlee() {
      if (!this.playerCanFlee()) return { ok: false, reason: "须先退至阵脚（最左格）方能抽身" };
      this.status = "fled";
      this._log(`你足尖一点、身形暴退，趁敌势一滞遁出了战圈——留得青山在。`);
      return { ok: true };
    }

    /* ----- 神识优势 ----- */
    senseVs(enemy) {
      if (!enemy) return { diff: 0, seeIntent: false, hitBonus: 0, critBonus: 0 };
      const adv = Balance.senseAdvantage(this.player.sense, enemy.sense || 5);
      if (enemy._dossier && !adv.seeIntent) return Object.assign({}, adv, { seeIntent: true });
      return adv;
    }

    /* ----- 敌人意图（回合初亮牌：移动企图 + 出招企图）-----
     * 七型谱的轴上行为由 desiredRange + tactics 表达：
     *   武修/妖兽 desiredRange=1 死命贴身；法修=2~3 中距对轰；狙击=4~5 贴身哑火。
     * 攻击三型（aim）：lock 锁头（盾挡）/ cell 打格子（意图亮格，移动可躲）/
     *   zone 范围（区间全体，侧位也吃）——剪刀石头布的攻防语言。 */
    _rollEnemyIntents() {
      this.enemies.forEach(e => this._rollOneIntent(e));
    }
    _rollOneIntent(e) {
      {
        if (!e.alive) { e.intent = null; return; }
        // 它的杀意流向（T0）：意图与落点全部以仇恨目标为准——傀儡引怪/钓离的机制根
        const prey = this.aggroTarget(e);
        if (e._charging) {
          e.intent = { name: e._charging.name + "·爆发", dmg: e._charging.dmg, kind: "release", pierce: e._charging.pierce,
            aim: e._charging.aim, targetCell: e._charging.aim === "cell" ? prey.pos : undefined,
            zoneFrom: e._charging.aim === "zone" ? Math.max(0, prey.pos - 1) : undefined,
            zoneTo: e._charging.aim === "zone" ? Math.min(this.W - 1, prey.pos + 1) : undefined };
          return;
        }
        // —— 遁走判定（阶段8 参数化·逃遁→击杀闭环）：重伤即倾向遁逃，境界越高/越级越想跑
        //    （元婴尤甚）；练气沿旧值"别动辄就跑"（用户裁决）。阈值按境界差加权（Balance.fleeProfile）。
        //    兽性危急时更可能拼命（feral 蓄力权重激增）由后续分支承接。
        const fp = Balance.fleeProfile(e.realmTier || 0, this.player.realmTier || 0);
        if (e.canFlee && e.hp < e.hpMax * fp.hpThresh && this.mode !== "breakthrough" && !e._desperate
          && this.rng() < fp.prob) {
          e.intent = { name: "遁走", kind: "flee" };
          return;
        }
        // —— 蓝尽判定（修士）：灵力不足出招 → 孤注一掷或遁 ——
        const attacks = this._enemyAttacks(e);
        const affordable = attacks.filter(a => (a.mp || 0) <= e.mp);
        if (!affordable.length) {
          if (e.mp <= 2 && e.hp < e.hpMax * 0.35 && e.canFlee && this.rng() < 0.4) { e.intent = { name: "遁走", kind: "flee" }; return; }
          e.intent = { name: "拼死一搏", dmg: Math.round((e.atk || 10) * 1.2), kind: "normal", mp: 0, desperate: true };
          e._desperate = true;
          return;
        }
        // 守御型：血危先固护体
        if (e.tactics === "guarded" && e.guardMove && e.hp < e.hpMax * 0.55 && (e.shield || 0) < (e.guardMove.shield || 12) * 0.5) {
          e.intent = { name: e.guardMove.name, kind: "guard", shield: e.guardMove.shield };
          return;
        }
        // —— 空层应对：猎物在天上——能飞的跟着上天；地面的滤掉贴身/砸地手段 ——
        const pAir = (prey.alt || 0) === 1 && (e.alt || 0) === 0;
        if (pAir && e.canFly) { e.intent = { name: "腾空追击", kind: "rise" }; return; }
        if (!((prey.alt || 0) === 1) && (e.alt || 0) === 1) { e.intent = { name: "俯冲落地", kind: "dive" }; return; }
        // —— 可达性过滤：本回合移动之后也够不着的招不选（狼在七格外不会"预告扑咬"）——
        //    全部够不着 → 意图=逼近（纯移动回合，亮"近"气泡、不亮危险格）
        const dNow = this.dist(e, prey);
        const reach = (a) => {
          const r = a.range || ((e.nature === "beast" || e.nature === "corpse") ? [1, 1] : [1, 3]);
          return dNow - this.moveCap(e) <= r[1];
        };
        const vsAlt = (a) => {
          if (!pAir) return true;
          if (a.antiAir) return true;                        // 腾身扑杀：跳得起来的兽专治低空
          const r = a.range || ((e.nature === "beast" || e.nature === "corpse") ? [1, 1] : [1, 3]);
          if (r[1] <= 1) return false;                       // 贴身够不到天上
          if (a.aim === "cell" || a.aim === "zone") return false;   // 砸地的手段打不了空中
          return true;
        };
        // 排间滤招（2.5 排制）：缩在僚位的只能用够得着战位排的远手（贴身要等阵脚补位）
        const vsLane = (a) => {
          if ((e.lane || 0) === 0) return true;
          const r = a.range || ((e.nature === "beast" || e.nature === "corpse") ? [1, 1] : [1, 3]);
          return r[1] > 1;
        };
        const inReach = affordable.filter(reach).filter(vsAlt).filter(vsLane);
        if (!inReach.length) {
          e.intent = pAir
            ? { name: "仰首戒备", kind: "approach" }   // 够不着天上的你——干瞪眼（风筝的胜利）
            : { name: "逼近", kind: "approach" };
          return;
        }
        // 按天赋+熟练度调权重选招（mastery：境界即经验——高手的"随手一招"都挑时机）
        const weighted = [];
        const heaviest = Math.max(...inReach.map(a => a.dmg || 0));
        inReach.forEach(a => {
          let w = a.weight || 10;
          if (e.tactics === "cunning") {
            if (a.kind === "pierce" && (prey.shield || 0) > 0) w *= 3;
            if (a.kind === "charge" && prey.hp < prey.hpMax * 0.5) w *= 2;
          }
          if (e.tactics === "feral") {
            if (a.kind === "charge" && e.hp < e.hpMax * 0.35) w *= 6;
          }
          // 老练（≥1）：猎物破绽毕露时，专挑重手招呼（凝息/蓄势的代价被行家放大）
          if ((e.mastery || 0) >= 1 && prey.exposed && (a.dmg || 0) >= heaviest) w *= 2.5;
          // 宗师（≥2）：猎物被击落/起不来的那拍，正是蓄势的天赐良机
          if ((e.mastery || 0) >= 2 && (prey._knocked || prey.exposed) && a.kind === "charge") w *= 3;
          // 资源取舍（v96 敌我同规则）：特色资源（神雷/煞气）见底时省着用——
          // 血危拼命才舍得掏（老练以上才有这份算计；本能档有就用）
          if (a.chargeCost && (e.mastery || 0) >= 1) {
            const ch = e.charges && e.charges[a.chargeCost.id];
            if (ch && ch.cur <= ch.max * 0.3) {
              w *= (e.hp < e.hpMax * 0.35 || prey.exposed) ? 1.6 : 0.3;   // 留底牌等时机
            }
          }
          weighted.push([a, w]);
        });
        const sum = weighted.reduce((t, x) => t + x[1], 0) || 1;
        let r = this.rng() * sum;
        let pick = weighted[0][0];
        for (const [a, w] of weighted) { r -= w; if (r <= 0) { pick = a; break; } }
        if (!pick.kind) pick.kind = pick.pierce ? "pierce" : "normal";
        pick = Object.assign({}, pick);
        // 打格子：意图阶段锁定猎物"现在站的格"——移开就是躲开（身法的主场）。
        // 蓄力技例外：蓄力回合只亮"蓄"，落点在爆发回合才重新锁定（防误导走位）
        if (pick.aim === "cell" && pick.kind !== "charge") pick.targetCell = prey.pos;
        // 范围：以猎物当前位置为中心的区间预告（区间内的其他人也吃）
        if (pick.aim === "zone" && pick.kind !== "charge") {
          const span = pick.zoneSpan || 1;
          pick.zoneFrom = Math.max(0, prey.pos - span);
          pick.zoneTo = Math.min(this.W - 1, prey.pos + span);
        }
        e.intent = pick;
      }
    }
    /* 敌方击打侧位单位（挡线/挡刀共用收尾） */
    _strikeSideUnit(e, atkDef, victim) {
      let sdmg = atkDef.dmg || 8;
      if (atkDef.elem && victim.elem) sdmg = Math.round(sdmg * elemMul(atkDef.elem, victim.elem));
      const r0 = victim.takeDamage(sdmg, { pierce: atkDef.pierce });
      this._log(`${e.name} 使「${atkDef.name}」，${victim.name} 代受 ${r0.dealt} 伤（${Math.max(0, Math.round(victim.hp))}/${victim.hpMax}）`);
      this._emitFx(this._refOf(victim), "hurt", r0.dealt);
      // 挨打的开口（T2）：重伤与轻伤两个口气
      if (victim.isSide && victim.hp > 0) {
        this._say(victim, victim.hp < victim.hpMax * 0.35 ? "heavyHurt" : "hurt");
      }
      this._checkSideDown();
    }

    /* 侧位倒下的收尾文案（cell/zone 路径）——T4 多侧位逐个清账 */
    _checkSideDown() {
      this.sides.forEach(s => {
        if (s.hp <= 0 && !s._downNoted) {
          s._downNoted = true;
          this._log(s.kind === "ally"
            ? `${s.name} 身负重伤，踉跄退出了战圈——「韩兄……剩下的，看你的了！」`
            : `${s.name} 轰然倒地，再难动弹——战后须得修缮。`);
        }
      });
    }
    /* 敌人招式表（带射程默认规则：妖兽/尸傀=贴身肉搏零耗；修士=中距耗蓝） */
    _enemyAttacks(e) {
      const isMelee = e.nature === "beast" || e.nature === "corpse";
      const list = (e.attacks && e.attacks.length ? e.attacks
        : [{ name: e.atkName || "攻击", dmg: e.atk || 8, soul: e.soulAtk, pierce: e.pierceAtk }]).map(a => {
        const r = a.range || (a.kind === "charge" ? [1, 1] : isMelee ? [1, 1] : [1, 3]);
        const mp = a.mp != null ? a.mp : (isMelee ? 0 : (a.kind === "pierce" ? 8 : a.kind === "charge" ? 10 : 6));
        return Object.assign({}, a, { range: r, mp });
      // 断尾（_maim）：被废的看家手段从此出不了手
      }).filter(a => !e._maimedMove || a.name !== e._maimedMove)
      // 特色资源耗尽（敌我同规则）：神雷/煞气打光，那一手就没了
      .filter(a => {
        if (!a.chargeCost) return true;
        const ch = e.charges && e.charges[a.chargeCost.id];
        return ch && ch.cur >= a.chargeCost.n;
      });
      return list;
    }

    /* ----- 回合开始：灵力不再刷新（池制）；遁速差决定本回合行动数 ----- */
    startRound() {
      if (this.status !== "ongoing") return;
      this.round++;
      this.player.exposed = false;
      this.player._blinkTurn = false;   // 雷遁只管一回合（再遁再耗神雷）
      // 神雷附剑余威递减
      if (this.player._leiEnchant > 0) {
        this.player._leiEnchant--;
        if (this.player._leiEnchant === 0) this._log(`（剑身雷光黯去——神雷附剑之效已尽。）`);
      }
      this.sides.forEach(s => { if (s.exposed && !s._charging) s.exposed = false; });   // 同道破绽同节奏消退（同规则）
      this._usedOnce = {};
      // 遁速差 → 行动经济：玩家遁速远胜 → 概率抢得第二主行动；高速强敌 → 概率连动
      const foes = this.enemies.filter(e => e.alive);
      const fastest = foes.length ? Math.max(...foes.map(e => e.speed || 10)) : 10;
      const ini = Balance.initiative(this.player.speed, fastest, this.rng);
      this._pActsMax = 1 + (ini.extraAction ? 1 : 0);
      foes.forEach(e => {
        e._doubleNext = (e.speed || 10) - this.player.speed > 8 && this.rng() < 0.3;
      });
      this._resetPlayerEconomy();
      this.player._shieldCap = Math.round(this.player.hpMax * 0.5);
      // 被击落的下一拍：撑地起身——身法尽失（空层的代价要真）
      if (this.player._knocked) {
        this.player._knocked = false;
        this._pMoved = this.player.move;
        this._log(`（你撑地而起、气血未定——这一回合迈不开步子。）`);
      }
      // —— 客随统帅（T2.5 四式战术指导）：境界明显高的同道不是复读点将机——
      //    她读战局给真指令：集火收口/缠正面教你背袭/稳住等空门/血危叫你归位。
      //    "配合"是双向的：它弱时听你的简令，它强时你接它的球。
      this._leadPlan = null;
      // 统帅指令的上一回合兑现：hold 听话（没抢攻）→ 这回合身法预判+接应窗口
      if (this._holdReward) {
        this._holdReward = false;
        this.player.dodgeBuff = (this.player.dodgeBuff || 0) + 0.15;
        this._followBoost = true;
        this._log(`（你按住了性子，让它那一击落了空——此刻空门大开，身法与刀都更利了！）`);
      }
      // 统帅=场上 mastery 最高的同道（T4 多侧位：只有一人发号施令——军令不出二门）
      const lead = this.sides.filter(s => s.hp > 0 && s.kind === "ally" && (s.mastery || 0) >= 2 && s.stance !== "retreat")
        .sort((a, b) => (b.mastery || 0) - (a.mastery || 0))[0] || null;
      this._leadBy = lead;
      if (lead) {
        const s = lead;
        const alive = this.enemies.filter(e => e.alive);
        // ① 你血危 → 归位令（回合结束站到她身侧=护体）
        if (this.player.hp < this.player.hpMax * 0.35) {
          this._leadPlan = { kind: "regroup", used: false };
          if (!this._say(s, "cmd_regroup")) this._log(`${s.name}：「到我身后来。」`);
          this._log(`（统帅令·归位：回合结束时退到她身侧一格内——她会为你布下护体）`);
        }
        // ② 有敌在蓄力且盯着你 → 稳住令（这回合别抢攻=下回合空门）
        else if (alive.some(e => e._charging || (e.intent && e.intent.kind === "charge"))) {
          this._leadPlan = { kind: "hold", used: false };
          if (!this._say(s, "cmd_hold")) this._log(`${s.name}：「稳住，别抢——空门在它落空之后。」`);
          this._log(`（统帅令·稳住：本回合不出主攻手段，下回合身法+15%并得接应之势）`);
        }
        // ③ 某敌的杀意全在她身上 → 拉开令（她锁正面，你绕背——背袭再+15%）
        else if (alive.some(e => this.aggroTarget(e) === s)) {
          const ti = this.enemies.findIndex(e => e.alive && this.aggroTarget(e) === s);
          this._leadPlan = { kind: "spread", target: ti, used: false };
          if (!this._say(s, "cmd_spread")) this._log(`${s.name}：「它的眼里只有我——去，取它后心。」`);
          this._log(`（统帅令·拉开：${this.enemies[ti].name} 正死盯着她——绕到它身后动手，背袭再+15%）`);
        }
        // ④ 默认 → 点将集火（优先点破绽大开的）
        else {
          const winOf = e => (e._charging || e._whiffed || (e.status && e.status.dingshen > 0));
          let ti = this.enemies.findIndex(e => e.alive && winOf(e));
          if (ti < 0) {
            let best = Infinity;
            this.enemies.forEach((e, i) => { if (e.alive && e.hp < best) { best = e.hp; ti = i; } });
          }
          if (ti >= 0) {
            this._leadPlan = { kind: "focus", target: ti, used: false };
            if (!this._say(s, "cmd_focus")) this._log(`${s.name}：「这只交给你收口——接好了！」`);
            this._log(`（统帅令·集火：本回合打 ${this.enemies[ti].name}，伤害+15%）`);
          }
        }
      }
      // —— 仇恨流转（T0/T4 多侧位）：旧仇衰减 + 守势嘲讽 + 贴身压力 ——
      this._decayAggro();
      this._redirectOrphanFronts();   // 塌线重定向（C3）：锚点已倒的战线之敌改投最近活线

      this.enemies.forEach(e => {
        if (!e.alive) return;
        // 贴身压力：脸贴脸的人很难被无视
        if (this.dist(e, this.player) <= 1) this.addAggro(e, "player", 2.5);
        this.sides.forEach((s, i) => {
          if (s.hp <= 0) return;
          // 守简令=嘲讽：横在阵前对周围敌人持续拉仇恨（傀儡引怪战法的根）
          if (s.stance === "guard" && this.dist(e, s) <= 2) this.addAggro(e, "side:" + i, 7);
          if (this.dist(e, s) <= 1) this.addAggro(e, "side:" + i, 2.5);
        });
      });
      // 凌空开销（敌我侧三方同规则，用户铁律：消耗战是以弱胜强的正路——
      // 拖到对方灵竭跌落，和打掉它血条一样光彩）：悬空燃灵逐回合递增（3/4/5…），
      // 灵竭=跌落+破绽。谁都一样：你、同道、敌修、妖禽，无人白飞
      this.units().forEach(u => this._airUpkeep(u));
      // 悬浮法宝运转（三位制·祭出位）：同一条资源物理学——绕身宝光也要灵力喂
      this.units().forEach(u => this._floatUpkeep(u));
      // 聚灵阵：立于阵中灵力自回（久战续航的根本）——同规则：我方全体皆可受益，
      // 敌方踩进我方聚灵阵不回灵（阵认主），反之敌阵（若有）也只济敌
      this.units().forEach(u => {
        const z = this.zoneAt(u.pos, "juling");
        if (!z || z.team !== u.team || (u.alt || 0) === 1) return;
        const cap = u.mpMax || u.mp || 0;
        if ((u.mp || 0) >= cap) return;
        const got = Math.min(8 + (u.regenBoost || 0), cap - u.mp);   // 伴身件：阵中每口更足
        u.mp += got;
        this._log(u === this.player ? `（聚灵阵灵气汇入——灵力+${got}）` : `（${u.name} 借阵中灵气回元——灵力+${got}）`);
      });
      // 玩家蓄势推进：每回合自动凝聚一分（移动或受击可能打断）
      if (this.player._charging) {
        this.player._charging.left--;
        this.player.exposed = true;
        if (this.player._charging.left <= 0) {
          this._log(`「${this.player._charging.name}」蓄势已成——雷霆只待一击！（再点一次释放）`);
        } else {
          this._log(`「${this.player._charging.name}」蓄势中（还差${this.player._charging.left}回合）——破绽毕露，稳住！`);
        }
      }
      this._fieldPhaseApplied = false;   // 手动模式：本回合尚未激活相位
      this._rollEnemyIntents();
      this._actorRef = "player";   // 切镜（T6）：你的回合，镜头回到你
      // 开战的开口（T2）：第一回合，同道一句、敌方一句——人未动，气先到
      if (this.round === 1) {
        const av = this._allyVoice();
        if (av) this._say(av, "open");
        const talker = this.enemies.find(e => e.alive);
        if (talker) this._say(talker, "open");
      }
      this._log(`【第${this.round}回合】灵力 ${Math.round(this.player.mp)}/${this.player.mpMax}`
        + (this._pActsMax > 1 ? "（遁速远胜——本回合可出手两次！）" : ""));
      // —— 真颠倒五行阵：手动模式由玩家选相位（Engine.combatFieldPhase），自动模式逐回合轮转 ——
      if (this.fieldCycle && this.fieldCycle.length && !this.fieldManual) {
        this._applyFieldPhase(this.fieldCycle[(this.round - 1) % this.fieldCycle.length]);
      }
      // —— H·下·拖时布阵战：survive 目标进度提示（师兄妹与傀儡蜥蜴正布阵，拖满即胜）——
      if (this.objective && this.objective.kind === "survive") {
        const left = Math.max(0, this.maxRounds - this.round);
        if (left > 0) this._log(`【拖时布阵】师兄妹与傀儡蜥蜴正催动「真·颠倒五行阵」——再撑 ${left} 回合，阵即可成！`);
      }
    }

    /* ----- 出招合法性 ----- */
    inRange(caster, sp, target) {
      if (!target || sp.range[1] === 0) return true;   // 自身向技
      const d = this.dist(caster, target);
      return d >= sp.range[0] && d <= sp.range[1];
    }
    canAfford(spellId) {
      const sp = SPELLS[spellId];
      if (!sp) return false;
      if (sp.oncePerRound && this._usedOnce && this._usedOnce[spellId]) return false;
      if ((this.player.cooldowns[spellId] || 0) > 0) return false;
      if (sp.quick && this._pQuickUsed) return false;
      if (!sp.quick && this._pActsUsed >= this._pActsMax) return false;
      if (this.player.spellMp(spellId, sp) > this.player.mp) return false;
      // 特色资源（神雷等）：耗尽则手段哑火——取舍即战术
      if (sp.chargeCost) {
        const ch = this.player.charges && this.player.charges[sp.chargeCost.id];
        if (!ch || ch.cur < sp.chargeCost.n) return false;
      }
      const consumeOk = !sp.consume || this.player.hasConsumable(sp.consume);
      return consumeOk;
    }
    /* 扣特色资源（cast 收口共用） */
    _spendCharge(u, sp) {
      if (!sp.chargeCost || !u.charges) return;
      const ch = u.charges[sp.chargeCost.id];
      if (ch) ch.cur = Math.max(0, ch.cur - sp.chargeCost.n);
    }
    /* 射程外但其余可负担（UI 置灰区分提示用） */
    castableAt(spellId, targetIndex) {
      const sp = SPELLS[spellId];
      const t = this.enemies[targetIndex];
      if (!sp) return false;
      if (sp.range[1] === 0) return true;
      return t ? this.inRange(this.player, sp, t) : false;
    }
    cooldownLeft(spellId) { return this.player.cooldowns[spellId] || 0; }
    affordableSpells() { return this.player.spells.filter(id => this.canAfford(id)); }

    /* ----- 施放（玩家）：主行动或瞬发；opts.cell=阵旗择地（二次确认的规则层）----- */
    cast(spellId, targetIndex = this._firstAliveEnemy(), opts = {}) {
      if (this.status !== "ongoing") return { ok: false, reason: "战斗已结束" };
      if (!this.player.spells.includes(spellId)) return { ok: false, reason: "未习得此法术" };
      const sp = SPELLS[spellId];
      if (sp.consume && !this.player.hasConsumable(sp.consume)) return { ok: false, reason: "底牌已用尽" };
      if (sp.oncePerRound && this._usedOnce && this._usedOnce[spellId]) return { ok: false, reason: "本回合已凝息，不可再用" };
      if ((this.player.cooldowns[spellId] || 0) > 0) return { ok: false, reason: `尚在回气（余${this.player.cooldowns[spellId]}回合）` };
      if (sp.quick && this._pQuickUsed) return { ok: false, reason: "本回合瞬发牌已用" };
      if (!sp.quick && this._pActsUsed >= this._pActsMax) return { ok: false, reason: "本回合主行动已用——可打瞬发牌或结束回合" };
      if (this.player.spellMp(spellId, sp) > this.player.mp) return { ok: false, reason: "灵力不济，催动不了" };
      if (sp.blinkMove && !this.player.blink) return { ok: false, reason: "需御「风雷翅」方能雷遁穿空（尚未解锁）" };
      const target = this.enemies[targetIndex];
      if (sp.type === "zone" && !sp.selfZone && opts.cell != null) {
        // 择地布阵：射程量到所点之格，不看敌人站哪
        const dc = Math.abs(opts.cell - this.player.pos);
        if (sp.range[1] > 0 && (dc < sp.range[0] || dc > sp.range[1]))
          return { ok: false, reason: `阵旗掷不到那处（需${sp.range[0]}~${sp.range[1]}格，那处距${dc}格）` };
      } else if (sp.range[1] > 0 && target && !this.inRange(this.player, sp, target)) {
        const d = this.dist(this.player, target);
        return { ok: false, reason: d < sp.range[0] ? `贴得太近，「${sp.name}」施展不开` : `距离不够（需${sp.range[0]}~${sp.range[1]}格，现距${d}格）` };
      }
      // 空层贴身规则：武学/贴身技隔层够不着（天上地下不是一个战圈）
      if (sp.type === "atk" && target && sp.range[1] <= 1 && (target.alt || 0) !== (this.player.alt || 0)) {
        return { ok: false, reason: (target.alt || 0) === 1 ? `${target.name} 在半空，贴身手段够不着` : "你在半空，贴身手段够不着地面" };
      }
      // 排间贴身规则（2.5 排制）：缩在僚位的敌人贴身够不着——御物远程或等它压上前来
      if (sp.type === "atk" && target && sp.range[1] <= 1 && (target.lane || 0) !== 0) {
        return { ok: false, reason: `${target.name} 游走在阵后，贴身手段够不着——御物法术可越排而击` };
      }
      // 集火黑板：你打谁，侧位单位就跟谁（随令）——配合从"看见你的选择"开始
      if (sp.type === "atk" && target) { this._pFocus = targetIndex; this._pAttacked = true; }
      // 接应（客随·集火令）：打统帅点的将——这一手是给她递的刀（+15%，每回合首次）
      if (sp.type === "atk" && target && this._leadPlan && this._leadPlan.kind === "focus"
        && !this._leadPlan.used && targetIndex === this._leadPlan.target && !sp.chargeTurns) {
        this._leadPlan.used = true;
        this._followBoost = true;
        this._stat("接应配合", 1);
      }

      // —— 蓄势技（chargeTurns）：第一次施放=起势（占行动、亮破绽、先付灵力）；
      //    蓄满后再次施放=全威力释放。移动/受击可能打断（坠魔谷名场面的玩家侧）——
      if (sp.chargeTurns) {
        const ch = this.player._charging;
        if (!ch || ch.spellId !== spellId) {
          this.player.mp -= this.player.spellMp(spellId, sp);   // 定金先付：被打断=白付（蓄势之险）
          if (sp.consume) this.player.pouch[sp.consume]--;
          this._pActsUsed += (sp.actCost || 1);
          this.player._charging = { spellId, name: sp.name, left: sp.chargeTurns };
          this.player.exposed = true;
          this._log(`${this.player.name} 凝势蓄力「${sp.name}」（需${sp.chargeTurns}回合）——周身气机暴涨，破绽毕露！`);
          return { ok: true, charging: true };
        }
        if (ch.left > 0) return { ok: false, reason: `「${sp.name}」尚在蓄势（还差${ch.left}回合）` };
        // 蓄满释放：全威力（×1.8），不再耗蓝
        this.player._charging = null;
        this.player.exposed = false;
        this._pActsUsed += (sp.actCost || 1);
        if (sp.cd) this.player.cooldowns[spellId] = sp.cd + 1;
        const boosted = Object.assign({}, sp, { dmg: Math.round((sp.dmg || 0) * 1.8) });
        this._log(`「${sp.name}」蓄势全开——倾力一击！`);
        this._emitFx("global", "ult", sp.name);
        this._applySpell(this.player, boosted, target, spellId);
        this._checkEnd();
        return { ok: true };
      }

      // 特色资源闸（神雷等）：耗尽则手段哑火——"取舍/耗尽才有战术"（用户铁律）
      if (sp.chargeCost) {
        const ch = this.player.charges && this.player.charges[sp.chargeCost.id];
        if (!ch || ch.cur < sp.chargeCost.n) return { ok: false, reason: `${ch ? ch.name : "灵机"}已耗尽——此手段哑火` };
      }
      this.player.mp -= this.player.spellMp(spellId, sp);
      this._spendCharge(this.player, sp);
      if (sp.consume) this.player.pouch[sp.consume]--;
      if (sp.oncePerRound) { (this._usedOnce || (this._usedOnce = {}))[spellId] = true; }
      if (sp.cd) this.player.cooldowns[spellId] = sp.cd + 1;
      if (sp.quick) this._pQuickUsed = true; else this._pActsUsed += (sp.actCost || 1);

      // 神雷附剑/雷遁（buff 型特技）：不走 _applySpell 的通用 buff——专项结算
      if (sp.leiEnchant) {
        this.player._leiEnchant = sp.leiEnchant;
        this._log(`三道银蛇自剑鞘窜出、缠上本命飞剑——剑光转为雷色（${sp.leiEnchant} 回合内主攻法宝带雷×1.25、克邪×1.5）！`);
        this._emitFx("player", "crit", "神雷附剑");
        this._checkEnd();
        return { ok: true };
      }
      if (sp.blinkMove) {
        this.player._blinkTurn = true;
        this._pMoved = 0;   // 穿亚空间：本回合移动上限放大到全场（落点随心、长距离瞬移——只看落点空否）
        this._log(`你周身银光一闪、整个人没入亚空间——本回合穿空遁走、无视挡线困足，落点随心（移动范围大增）！`);
        this._emitFx("player", "miss", sp.name);
        this._checkEnd();
        return { ok: true };
      }

      // 横扫型攻击（辟邪神雷·劈）：自身畔为心、左右 aoeSpan 格内之敌尽数受击——金雷自人而发
      if (sp.aoe && sp.type === "atk") {
        const span = sp.aoeSpan || (sp.range ? sp.range[1] : this.W);
        const center = this.player.pos;
        let victims = this.enemies.filter(e => e && e.alive && Math.abs((e.pos || 0) - center) <= span);
        if (target && target.alive && victims.indexOf(target) < 0) victims.unshift(target);
        if (!victims.length && target) victims = [target];
        this._log(`${this.player.name}引动辟邪神雷——左右十格金雷自身畔轰然炸开、横扫诸敌！`);
        victims.forEach(v => { if (this.status === "ongoing" && v && v.alive) this._applySpell(this.player, sp, v, spellId, opts); });
        this._checkEnd();
        return { ok: true };
      }

      this._applySpell(this.player, sp, target, spellId, opts);
      this._checkEnd();
      return { ok: true };
    }

    _emitFx(targetRef, kind, text, extra) {
      (this._fx || (this._fx = [])).push(Object.assign({ ref: targetRef, kind, text }, extra || null));
    }
    // 中毒结算（通用）：嗂毒类减益与“攻击带毒”类武器共用——元神无形/百毒不侵者免疫，余者叠加每回合接毒伤害
    _applyPoison(caster, target, tref, poison) {
      if (!poison || !target) return;
      if (target.soulOnly) { this._log(`${caster.name} 对 ${target.name} 用毒——可元神无形无质，毒物根本无处着力！`); this._emitFx(tref, "miss", "元神无形"); return; }
      if (target.immunePoison) { this._log(`${caster.name} 对 ${target.name} 用毒，但对方百毒不侵（死物）！`); this._emitFx(tref, "miss", "百毒不侵"); return; }
      const p = target.status.poison;
      if (p) { p.dmg += poison.dmg; p.turns = Math.max(p.turns, poison.turns); }
      else target.status.poison = { dmg: poison.dmg, turns: poison.turns };
      this._log(`${caster.name} 嗂毒，${target.name} 中毒叠加至 ${target.status.poison.dmg}/回合`);
      this._emitFx(tref, "poison", "中毒 " + target.status.poison.dmg);
    }
    _refOf(unit) {
      if (unit === this.player) return "player";
      if (unit.isSide) { const i = this.sides.indexOf(unit); return i > 0 ? `side:${i}` : "side"; }
      return `enemy:${this.enemies.indexOf(unit)}`;
    }

    _noteElem(caster, target, sp, eMul, sMul, tref) {
      if (sMul > 1) {
        this._emitFx(tref, "crit", "克星！");
        this._log(`（${sp.name}正是${target.name}这等${target.nature === "ghost" ? "鬼魅之物" : "邪物"}的克星——威力大涨！）`);
      }
      if (eMul > 1) {
        // 材质反应（动漫官设）：克制命中带"物理化学反应"——瓷裂/白雾/余烬（UI 按 defElem 演）
        this._emitFx(tref, "crit", "克制！", { defElem: target.elem });
        if (caster === this.player && target.elem) {
          (this._reveals || (this._reveals = [])).push({ name: target.name, elem: target.elem });
          if (!this._elemNoted) { this._elemNoted = true; this._log(`（${ELEM_NAME[sp.elem]}气压过${ELEM_NAME[target.elem]}行道基——${target.name}的护体灵光黯了一分！伤害+25%）`); }
        }
      } else if (eMul < 1) {
        this._emitFx(tref, "miss", "相抵");
        if (caster === this.player && target.elem) {
          (this._reveals || (this._reveals = [])).push({ name: target.name, elem: target.elem });
          if (!this._elemNoted2) { this._elemNoted2 = true; this._log(`（对方${ELEM_NAME[target.elem]}行道基天克你的${ELEM_NAME[sp.elem]}气——这一手威力打了折扣）`); }
        }
      }
    }

    _applySpell(caster, sp, target, spellId, opts = {}) {
      const adv = (caster === this.player) ? this.senseVs(target) : { hitBonus: 0, critBonus: 0 };
      const tref = (caster === this.player && target) ? `enemy:${this.enemies.indexOf(target)}` : "player";
      const auxMul = (spellId && caster.auxSkills && caster.auxSkills.includes(spellId)) ? Balance.auxiliaryMul() : 1;
      // 功法层进度乘子：仅作用于"主修当前层所授"的功法法术（techSpells），武学/法器/辅修不吃（technique-tiers §5.4）
      const lm = (sp.source === "art" && spellId && caster.techSpells && caster.techSpells.includes(spellId)) ? (caster.layerMul || 1) : 1;

      if (sp.type === "atk" && target) {
        let dodge = (target.dodgeBuff || 0) + (target.agility || 0) / 100;
        if (sp.pierce) dodge *= 0.3;
        // 符箓灵光锁敌：符一旦激发便有灵性追身（消耗品空掷太伤——高敏兽也压一截闪避）
        if (sp.consume) dodge -= 0.10;
        dodge = clampNum(dodge - adv.hitBonus, 0, 0.45);
        // 定身即定靶：被定住的目标闪不开任何一击（定身符的承诺、偷袭首击的先机，皆系于此）
        if (target.status && target.status.dingshen > 0) dodge = 0;
        const spentMomentum = sp.spendMomentum ? (caster.momentum || 0) : 0;
        const segs = sp.multiSeg ? 1 + Math.floor(spentMomentum / (sp.segPer || 2)) : (sp.fixedSegs || 1);
        let baseDmg = sp.dmg;
        if (sp.spendMomentum && !sp.multiSeg) { baseDmg += spentMomentum * (sp.momentumDmg || 0); }
        baseDmg = Balance.spellPower(baseDmg, sp.source, caster.grade, caster.realmTier, lm);
        // A2 承重墙：法宝驱动门槛 + 本命系数（消耗性底牌 chargeCost 不吃门槛折扣）——读时计算，存档 schema 不变
        if (sp.source === "treasure") {
          baseDmg = Math.round(baseDmg * Balance.driveMul(caster.realmTier, sp.driveRealm, sp.natal, !!sp.chargeCost, caster.realmLayer));
        }
        baseDmg = Math.max(1, Math.round(baseDmg * auxMul * (caster.dmgBonus || 1)));
        // 贴身惩罚：御物/法术类远程攻击在距离1施展不开（-30%）——武学的主场
        let closeSqueeze = false;
        if (sp.source !== "martial" && sp.range && sp.range[1] >= 2 && this.dist(caster, target) === 1) {
          baseDmg = Math.round(baseDmg * 0.7); closeSqueeze = true;
        }
        // 神雷附剑（v96→A2）：主攻法宝带雷——伤害×1.25、克邪×1.5（三回合余威）。
        // 乘性而非平铺：高境界注入法力后基数已高，平铺 +8 会被几何标度淹没（高境界归零）。
        if (caster._leiEnchant > 0 && sp.source === "treasure" && caster === this.player) {
          baseDmg = Math.round(baseDmg * 1.25);
          if (target.nature === "ghost" || target.nature === "demon") baseDmg = Math.round(baseDmg * 1.5);
        }
        const eMul = elemMul(sp.elem, target.elem);
        const sMul = (sp.slays && target.nature && sp.slays[target.nature]) || 1;
        if (eMul !== 1 || sMul !== 1) {
          baseDmg = Math.round(baseDmg * eMul * sMul);
          this._noteElem(caster, target, sp, eMul, sMul, tref);
        }
        let exploitCharge = false;
        if ((target._charging || target._whiffed) && caster === this.player) { baseDmg = Math.round(baseDmg * 1.3); exploitCharge = true; }
        // 绕后背击：身法迂回穿过身位后的第一击（+20%，与趁虚可叠——背后捅趁虚是极致操作）
        if (target._backTurned && caster === this.player) {
          baseDmg = Math.round(baseDmg * 1.2);
          target._backTurned = false;
          this._log(`（背击！${target.name} 背门大开——这一手又狠又刁！伤害+2成）`);
        }
        // —— 背袭（tactics T1）：它的杀意在别处+你在它背面=死门一击 ——
        // 仇恨账本的几何兑现（刘靖杀青纹后被阴手所杀，是同一条规则的反面）
        let backstab = false, assassin = false;
        if (caster === this.player && target.team === "enemy" && sp.dmg) {
          const at = this.aggroTarget(target);
          if (at && at !== this.player && at.hp > 0) {
            const dF = Math.sign(at.pos - target.pos), dM = Math.sign(caster.pos - target.pos);
            if (dF !== 0 && dM !== 0 && dF !== dM) {
              backstab = true;
              baseDmg = Math.round(baseDmg * 1.35);
              // 死角绝杀：本回合首次出手（它毫无防备）+非 boss——这一刀留下永久的伤
              assassin = this._pActsUsed === 0 && !this._pQuickUsed && !target.boss;
              // 统帅"拉开"指令的兑现：她缠住正面，你取后心——再+15%
              if (this._leadPlan && this._leadPlan.kind === "spread"
                && this.enemies[this._leadPlan.target] === target && !this._leadPlan.used) {
                this._leadPlan.used = true;
                baseDmg = Math.round(baseDmg * 1.15);
                this._log(`（她缠住了它的正面，你自死角而入——这一手正是她递来的局！再+15%）`);
              }
            }
          }
        }
        // 俯击：居高临下打地面目标——势从天降（+15%）
        if ((caster.alt || 0) > (target.alt || 0)) {
          baseDmg = Math.round(baseDmg * 1.15);
          if (caster === this.player && !this._diveNoted) { this._diveNoted = true; this._log(`（凌空俯击——居高临下，势如破竹！伤害+15%）`); }
        }
        // 接应（客随统帅点将）：顺着她的局下刀（+15%）
        if (this._followBoost && caster === this.player) {
          this._followBoost = false;
          baseDmg = Math.round(baseDmg * 1.15);
          this._log(`（你接住了她递的局——这一手顺势而入，伤害+15%！）`);
          this._emitFx("global", "exploit", "接应！");
        }
        if (this.rng() < dodge) {
          this._log(`${caster.name} 施「${sp.name}」，被 ${target.name} 闪避！`);
          this._emitFx(tref, "miss", "闪避");
        } else {
          let totalDealt = 0, anyCrit = false;
          for (let i = 0; i < segs && target.alive; i++) {
            let dmg = baseDmg, crit = false;
            if (this.rng() < clampNum(0.05 + adv.critBonus, 0, 0.4)) { dmg = Math.round(dmg * 1.6); crit = true; anyCrit = true; }
            const r = target.takeDamage(dmg, { pierce: sp.pierce });
            totalDealt += r.dealt;
            this._emitFx(tref, crit ? "crit" : (sp.pierce ? "pierce" : "dmg"), (crit ? "暴击 " : sp.pierce ? "破甲 " : "") + r.dealt);
            if (target.hp <= 0) break;
          }
          if (caster === this.player) this._stat(sp.name, totalDealt);
          // 仇恨入账：打谁谁记仇（敌方下回合的杀意流向）
          if (target.team === "enemy") this.addAggro(target, caster === this.player ? "player" : this.sideKey(caster), totalDealt);
          // —— 背袭结算：硬直（打掉它的章法）+ 死角绝杀的永久损伤 ——
          if (backstab && totalDealt > 0 && target.alive) {
            target.intent = null;
            this._log(`（背袭！它的杀意全在别处——你这一手自死角而入，${target.name} 踉跄回身、章法尽失！）`);
            this._emitFx(tref, "crit", "背袭！");
            if (assassin) this._maim(target);
            { const av = this._allyVoice(); if (av) this._say(av, "backstabPraise"); }
          }
          if (anyCrit) this._log(`（神识料敌于先，一击中的！）`);
          if (exploitCharge) {
            this._log(target._whiffed
              ? `（趁其扑空收势不及——这一手打在了节骨眼上！伤害+30%）`
              : `（趁其蓄力、旧力已尽新力未生——这一手打在了节骨眼上！伤害+30%）`);
            if (caster === this.player) this._emitFx("global", "exploit", "趁虚！");
          }
          // 终结一击：胜负在此一手（UI 给慢放水墨演出）
          if (target.hp <= 0 && caster === this.player && this.enemies.every(x => !x.alive || x === target)) {
            this._emitFx(tref, "slay", null);
          }
          // 击落：空中目标挨了一记重的（≥16）——遁光被打散，坠地硬直一拍
          if ((target.alt || 0) === 1 && totalDealt >= 16 && target.alive) {
            target.alt = 0;
            target.status.dingshen = (target.status.dingshen || 0) + 1;
            this._log(`${target.name} 的遁光被这一记砸散——直直从半空栽落，烟尘里一时爬不起来！（击落）`);
            this._emitFx(tref, "miss", "击落");
          }
          if (closeSqueeze) this._log(`（贴身缠斗，御物施展不开——威力打了三成折扣）`);
          // 蓄势打断判定：蓄力中受击概率被震断（妖王/大修士蓄势更稳——定身符才是百分百的答案）
          if (target._charging && totalDealt > 0 && this.rng() < (target.stubborn ? 0.12 : 0.22)) {
            this._log(`${target.name} 的「${target._charging.name}」被这一击震断——蓄势烟消云散！`);
            target._charging = null;
            if (target.intent && target.intent.kind === "release") target.intent = { name: "心神不稳", dmg: Math.round((target.atk || 8) * 0.6), kind: "normal", mp: 0 };
          }
          this._log(segs > 1
            ? `${caster.name} 施「${sp.name}」——剑光连闪，${segs} 段连环，共造成 ${totalDealt} 伤害！` + (target.shield > 0 ? `（余护体${target.shield}）` : "")
            : `${caster.name} 施「${sp.name}」，对 ${target.name} 造成 ${totalDealt} 伤害` + (target.shield > 0 ? `（余护体${target.shield}）` : ""));
          // 攻击带毒：命中且破防后毒入伤口（任何带 poison 的攻击技通用——乌龙夺四爪淬毒）
          if (sp.poison && totalDealt > 0 && target.alive) this._applyPoison(caster, target, tref, sp.poison);
        }
        if (sp.dodgeSelf) caster.dodgeBuff = (caster.dodgeBuff || 0) + sp.dodgeSelf;
        if (sp.buildMomentum) {
          const gain = sp.buildMomentum * (caster.swordMastery ? 2 : 1);
          caster.momentum = Math.min(caster.momentumCap || 5, (caster.momentum || 0) + gain);
        }
        if (sp.spendMomentum) { caster.momentum = 0; }

      } else if (sp.type === "soul" && target) {
        if (!target.soulOnly) { this._log(`${caster.name} 运功镇魂，但 ${target.name} 乃血肉之躯，此法无用！`); this._emitFx(tref, "miss", "无效"); return; }
        let dmg = Balance.soulSuppressDamage(caster.gongli, target.gongli || 20);
        const sMul = (sp.slays && target.nature && sp.slays[target.nature]) || 1;
        if (sMul > 1) { dmg = Math.round(dmg * sMul); this._emitFx(tref, "crit", "克星！"); }
        const r = target.takeDamage(dmg, { soul: true });
        if (caster === this.player) this._stat(sp.name, r.dealt);
        if (target.team === "enemy") this.addAggro(target, caster === this.player ? "player" : this.sideKey(caster), r.dealt);
        this._log(`${caster.name} 运功镇魂，以功力冲击 ${target.name} 的神魂，造成 ${r.dealt} 伤害（${Math.max(0, Math.round(target.hp))}/${target.hpMax}）`);
        this._emitFx(tref, "soul", "镇魂 " + r.dealt);

      } else if (sp.type === "zone") {
        // 阵旗：往轴上铺区间（阵法轴 v0——改写战场规则的手段）
        // 择地优先（opts.cell=玩家点的格）：阵随心落，不再黏着敌人站位
        const center = sp.selfZone ? caster.pos
          : (opts.cell != null ? opts.cell : (target ? target.pos : caster.pos));
        const span = sp.zoneSpan || 1;
        const z = { from: Math.max(0, center - span), to: Math.min(this.W - 1, center + span),
                    type: sp.zone, turns: sp.zoneTurns || 4, team: caster.team };
        this.zones.push(z);
        const zname = { kunzu: "困足阵", juling: "聚灵阵", mizong: "迷踪阵" }[sp.zone] || "阵法";
        this._log(`${caster.name} 掷出阵旗——第${z.from + 1}~${z.to + 1}步亮起${zname}灵纹（${z.turns}回合）！`);
        this._emitFx(this._refOf(caster), "heal", zname);

      } else if (sp.type === "debuff" && target) {
        // 控制即挑衅：定身/减益的仇恨不输于伤害（它记得是谁锁的它）
        if (target.team === "enemy") this.addAggro(target, caster === this.player ? "player" : this.sideKey(caster), 12);
        if (sp.dingshen) {
          target.status.dingshen = (target.status.dingshen || 0) + sp.dingshen;
          // 定身拆蓄势：定住的同时，蓄到一半的大招也散了
          if (target._charging) {
            this._log(`${target.name} 被定身符定在原地——蓄到一半的「${target._charging.name}」也散了！`);
            target._charging = null;
            if (target.intent && target.intent.kind === "release") target.intent = { name: "心神不稳", dmg: Math.round((target.atk || 8) * 0.6), kind: "normal", mp: 0 };
          } else {
            this._log(`${caster.name} 扬手贴出定身符——${target.name} 身形一僵，定在原地！`);
          }
          this._emitFx(this._refOf(target), "miss", "定身");
          return;
        }
        if (sp.poison) { this._applyPoison(caster, target, tref, sp.poison); }
      } else if (sp.type === "heal") {
        const boost = ((caster.technique === "changchun" || caster.technique === "changchun_full") && sp.school === "mu") ? 1.4 : 1;
        const heal = Math.max(1, Math.round(Balance.spellPower(Math.round(sp.heal * boost), sp.source, caster.grade, caster.realmTier, lm) * auxMul));
        caster.hp = clampNum(caster.hp + heal, 0, caster.hpMax);
        this._log(`${caster.name} 施「${sp.name}」，回气血 ${heal}（${Math.round(caster.hp)}/${caster.hpMax}）`);
      } else if (sp.type === "def") {
        const boost = ((caster.technique === "changchun" || caster.technique === "changchun_full") && sp.school === "mu") ? 1.4 : 1;
        const shield = Math.max(1, Math.round(Balance.spellPower(Math.round(sp.shield * boost), sp.source, caster.grade, caster.realmTier, lm) * auxMul));
        const cap = caster._shieldCap || 0;
        if (cap > 0 && caster.shield >= cap) {
          this._log(`${caster.name} 周身护体已至极限，再难叠加（护体${caster.shield}）。`);
        } else {
          caster.shield = cap > 0 ? Math.min(cap, caster.shield + shield) : caster.shield + shield;
          this._log(`${caster.name} 施「${sp.name}」，护体 +${shield}（共${caster.shield}${cap ? `/${cap}` : ''}）`);
        }
      } else if (sp.type === "buff") {
        // 凝息回元：灵力回补 + 破绽毕露（v2 的资源赌局）。
        // regenBoost（伴身件）：每口回元更足——池制铁律不破（仍要花动作冒破绽）
        if (sp.regen) {
          const got = Math.min(sp.regen + (caster.regenBoost || 0), caster.mpMax - caster.mp);
          caster.mp += got;
          if (sp.expose) caster.exposed = true;
          this._log(`${caster.name} 敛息凝神，灵力回涌 +${got}（${Math.round(caster.mp)}/${caster.mpMax}）${sp.expose ? "——但破绽毕露！" : ""}`);
          this._emitFx(this._refOf(caster), "heal", "回元 " + got);
        }
      }
    }

    /* 死角绝杀的永久损伤（tactics T1 通用版）：兽断其势、修毁其器。
     * boss 在 assassin 判定已排除（只吃背袭硬直）——风云榜赛道不崩 */
    _maim(e) {
      if (e._maimed) return;
      e._maimed = true;
      if (e.nature === "beast" || e.nature === "corpse") {
        // 断尾：废掉它最重的看家手段（zone 横扫/蓄力扑杀优先）——从此这招再使不出
        const moves = e.attacks || [];
        const heavy = moves.find(m => m.aim === "zone" || m.kind === "charge" || m.charge)
          || moves.reduce((a, b) => (!a || (b.dmg || 0) > (a.dmg || 0)) ? b : a, null);
        if (heavy) {
          e._maimedMove = heavy.name;
          this._log(`（绝杀入髓！${e.name} 的筋骨被这一记自死角的重击废去一截——「${heavy.name}」从此再难使出！）`);
        } else {
          e.dmgBonus = (e.dmgBonus || 1) * 0.75;
          this._log(`（绝杀入髓！${e.name} 的爪牙被废去三分——往后的撕咬都软了下来。）`);
        }
      } else {
        // 毁器：法修的本钱在器——护身法器应声而裂
        e.dmgBonus = (e.dmgBonus || 1) * 0.75;
        e.armor = Math.max(0, (e.armor || 0) - 2);
        this._log(`（绝杀入髓！${e.name} 贴身的护道法器应声而裂——气势与防护一并塌了下去。）`);
      }
      this._emitFx(`enemy:${this.enemies.indexOf(e)}`, "crit", "重创！");
    }

    _firstAliveEnemy() { return this.enemies.findIndex(e => e.alive); }

    /* ----- 结束回合：侧位行动 → 敌方（移动+出招）→ 结算 ----- */
    endRound() {
      if (this.status !== "ongoing") return;
      // —— 统帅令结算（T2.5）：听话有糖，抗令无罚（她不是你娘）——
      const ld = this._leadBy;
      if (this._leadPlan && this._leadPlan.kind === "hold" && !this._pAttacked) {
        this._holdReward = true;
        this._log(`（你收住了刀锋——${ld ? ld.name : "她"}眼中闪过一丝赞许。）`);
      }
      if (this._leadPlan && this._leadPlan.kind === "regroup" && ld && ld.hp > 0
        && this.dist(this.player, ld) <= 1) {
        const got = 16;
        this.player.shield = Math.min(this.player._shieldCap || 999, (this.player.shield || 0) + got);
        this._log(`你退至 ${ld.name} 身侧——她广袖一拂，月华化盾罩定你周身（护体+${got}）。`);
      }
      this._pAttacked = false;
      this._tickStatus(this.player);
      this._sideAct();
      if (this.status !== "ongoing") return;

      this.enemies.forEach(e => {
        if (!e.alive) return;
        this._tickStatus(e);
        if (!e.alive) return;
        if (e.status.dingshen > 0) { e.status.dingshen--; this._log(`${e.name} 被定身，无法行动`); return; }
        this._enemyAct(e);
        // 高速强敌连动：遁速碾压玩家时概率再动一次（高阶压迫感）
        if (e._doubleNext && e.alive && this.status === "ongoing" && this.player.hp > 0) {
          e._doubleNext = false;
          this._log(`${e.name} 快得只剩残影——竟连动再袭！`);
          this._rollOneIntent(e);
          this._enemyAct(e);
        }
      });

      this._checkEnd();
      if (this.status === "ongoing") {
        Object.keys(this.player.cooldowns).forEach(k => {
          if (this.player.cooldowns[k] > 0) this.player.cooldowns[k]--;
        });
        [this.player, ...this.enemies].forEach(f => {
          if (f.shield > 0 && !f._fixedShield) {
            const lost = Math.ceil(f.shield * 0.5);
            f.shield -= lost;
          }
        });
        // 阵法格随时间消散
        this.zones = this.zones.filter(z => --z.turns > 0);
        this._maybeSpawnWave();
        if (this.round >= this.maxRounds) {
          if (this.objective && this.objective.kind === "survive") {
            // 拖时布阵战：拖满回合不死＝阵成＝胜（败有所得首例）
            this.status = "win";
            this._log(this.objective.winLog || `拖到了时辰——师兄妹的「真·颠倒五行阵」终于布成！`);
          } else {
            this.status = "lose"; this._log(`回合耗尽，未能取胜。`);
          }
        }
      }
    }

    /* 凌空经济（三方同规则）：悬空者每回合燃灵 2+悬空回合数（3/4/5…递增），
     * 灵力不济=遁光散、跌落地面、破绽毕露——消耗战的物理学：飞得起，未必撑得住 */
    _airUpkeep(u) {
      if ((u.alt || 0) !== 1) { u._airRounds = 0; return; }
      u._airRounds = (u._airRounds || 0) + 1;
      const cost = 2 + u._airRounds;
      if ((u.mp || 0) >= cost) {
        u.mp -= cost;
        if (u === this.player && u._airRounds >= 2) this._log(`（悬空愈久灵力愈沉——本回合燃灵 ${cost}）`);
      } else {
        u.alt = 0;
        u._airRounds = 0;
        u.exposed = true;
        this._log(u === this.player
          ? `灵力枯竭，遁光一散——你从半空踉跄跌落，气血翻涌破绽毕露！`
          : `${u.name} 灵力不继、遁光溃散——从半空栽落下来，破绽毕露！`);
        this._emitFx(this._refOf(u), "miss", "灵竭坠落");
      }
    }

    _tickStatus(f) {
      if (f.status.poison && f.status.poison.turns > 0) {
        if (f.soulOnly) { delete f.status.poison; return; }
        const dmg = f.status.poison.dmg;
        f.hp = clampNum(f.hp - dmg, 0, f.hpMax);
        f.status.poison.turns--;
        if (f !== this.player) this._stat("淬毒", dmg);
        else if (f.hp <= 0) this.deathCause = { by: "淬毒", move: "毒发攻心" };
        this._log(`${f.name} 毒发，气血-${dmg}（${Math.max(0, Math.round(f.hp))}/${f.hpMax}）`);
        this._emitFx(this._refOf(f), "poison", "毒 " + dmg);
        if (f.status.poison.turns <= 0) delete f.status.poison;
      }
      if (f.status.fengling > 0) { f.status.fengling--; if (f.status.fengling <= 0) delete f.status.fengling; }
    }

    /* ----- 侧位单位行动：人格化协同 AI（ally-ai-design A0/A1）-----
     * 人格=背景+境界+功法（persona 权重：aggr 求战/prot 护主/kite 风筝），不是脚本；
     * 简令四档（随/攻/守/撤）；黑板=玩家焦点(_pFocus)+破绽窗口+玩家血危。
     * 协同三式落地：集火（打你打的）/接力（抓你定住的那一拍）/挡线（血危时挪身代刀）。 */
    /* T4 多侧位：全部侧位依序行动（同道/灵宠/傀儡各打各的——多组对位的我方端） */
    _sideAct() {
      for (let i = 0; i < this.sides.length; i++) {
        if (this.status !== "ongoing") return;
        const s = this.sides[i];
        if (s.hp > 0) { this._sideActOne(s, i); this._ejectFromPlayerCell(s); }
      }
    }
    _sideActOne(s, sideIdx) {
      this._actorRef = this._refOf(s);   // 切镜（T6）：谁行动，镜头看谁
      if (this.W > 13) this._emitFx(this._refOf(s), "turn", null);   // 导演（B1）：本拍先把镜头交给行动者，再演他的走位/出手
      const stance = s.stance || "follow";
      const persona = (s.sideRef && s.sideRef.persona) || { aggr: 5, prot: 5, kite: 0 };
      const isMelee = !s.moves || s.moves.every(m => !m.range || m.range[1] <= 1);

      // —— 空层机动（同规则）：升降占整个行动、悬空照样燃灵（_airUpkeep 统一扣）——
      if (s.canFly && stance !== "retreat") {
        const meleeThreat = this.enemies.some(e => e.alive && (e.alt || 0) === (s.alt || 0)
          && this.dist(e, s) <= 1 && (!e.attacks || e.attacks.some(a => (a.range || [1, 1])[1] <= 1)));
        // 升空：被贴身的远程手抽身上天（kite 本能），或统帅自第2回合居高临下压阵
        if ((s.alt || 0) === 0 && (s.mp || 0) >= 6
          && (meleeThreat && persona.kite >= 4 || ((s.mastery || 0) >= 2 && this.round >= 2 && persona.kite >= 4))) {
          s.alt = 1;
          this._say(s, "fly");
          this._log(meleeThreat
            ? `${s.name} 袖袂一振拔身而起——脱开爪牙，凌空再战！`
            : `${s.name} 足尖轻点、遁光托身而起——居高临下，俯瞰全局。`);
          this._emitFx(this._refOf(s), "move", null);
          return;
        }
        // 落地：威胁已无且灵力见底——收遁光省灵（消耗战的自觉：不为排场白烧灵力）
        if ((s.alt || 0) === 1 && !meleeThreat && (s.mp || 0) < (s.mpMax || 30) * 0.3) {
          s.alt = 0;
          this._log(`${s.name} 按下遁光、足尖点地——灵力将尽，不作无谓之耗。`);
          return;
        }
      }

      // —— 撤令：脱离接触，退到玩家身后半步，不出手 ——
      if (stance === "retreat") {
        const foes = this.enemies.filter(e => e.alive);
        if (foes.length) {
          const nearest = foes.reduce((a, b) => this.dist(s, a) <= this.dist(s, b) ? a : b);
          const dir = s.pos >= nearest.pos ? 1 : -1;   // 背向最近的敌人退
          const step = this._stepToward(s, { pos: clampNum(s.pos + dir * 3, 0, this.W - 1) }, this.moveCap(s));
          if (step != null && step !== s.pos) { s.pos = step; this._log(`${s.name} 依令后撤，退出了战团。`); return; }
        }
        this._log(`${s.name} 收势自保，不再出手。`);
        return;
      }

      // —— 跨线赶援倾向（crossSupport·皇宫三组对位）：当面之敌已了结（身周 2 格无活敌），
      //    而别处战线告急（同袍/玩家血<50% 且有敌贴身）——AI 重定目标、提步赶去扑杀威胁同袍的血侍。
      //    复用现有配合系统：只改「打谁」的倾向，移动仍走正常脚程（moveCap）、不瞬移横越。
      let rescueTi = -1, rescueWard = null;
      if (this.crossSupport && stance !== "retreat"
        && !this.enemies.some(e => e.alive && this.dist(e, s) <= 2)) {
        const wards = [this.player].concat(this.sides.filter(x => x !== s && x.hp > 0));
        for (const a of wards) {
          if (a.hp / a.hpMax >= 0.5) continue;
          const fi = this.enemies.findIndex(e => e.alive && this.dist(e, a) <= 2);
          if (fi >= 0) { rescueTi = fi; rescueWard = a; break; }
        }
      }
      // 塌线收束（teamfight-camera-design C3）：自己这条线已清空（身周 2 格无活敌）、别处仍在交火——
      //   AI 倾向就近并入最近的交火战线（提步走正常脚程 moveCap、不瞬移）。保留「自己线没清完不许跑」的约束。
      //   优先级最低：只在无血危同袍可救（rescueTi<0）时才并线，绝不抢真·赶援。
      if (rescueTi < 0 && this.crossSupport && stance !== "retreat"
        && !this.enemies.some(e => e.alive && this.dist(e, s) <= 2)) {
        let best = -1, bestD = Infinity;
        this.enemies.forEach((e, i) => {
          if (!e.alive) return;
          const d = this.dist(s, e);
          if (d > 2 && d < bestD) { bestD = d; best = i; }
        });
        if (best >= 0) rescueTi = best;   // converge：纯并线，rescueWard 留空（台词走"并线"分支）
      }

      // —— 选敌评分（T5 流动战团）：就近接战是天性——你把对手拉到她身边，
      //    她顺手就接；正缠着她的、你点名的、破绽大开的各有权重。
      //    统帅令（focus/spread）依然说到做到：点了谁就缠谁 ——
      let ti = -1;
      if (rescueTi >= 0) {
        ti = rescueTi;
      } else if (this._leadPlan && this._leadPlan.target != null
        && this.enemies[this._leadPlan.target] && this.enemies[this._leadPlan.target].alive) {
        ti = this._leadPlan.target;
      } else {
        let bestScore = -Infinity;
        this.enemies.forEach((e, i) => {
          if (!e.alive) return;
          let sc = 4 - Math.min(4, this.dist(s, e));                       // 近水楼台：送到面前的先打
          if (this._pFocus === i && stance !== "attack") sc += 2.5;        // 你点名的
          if (this.aggroTarget(e) === s) sc += 2;                          // 正咬着她的
          if (e._charging || e._whiffed || (e.status && e.status.dingshen > 0)) sc += 1.5;   // 破绽
          if (stance === "attack") sc += (1 - e.hp / e.hpMax) * 3;         // 攻令：补刀血少的
          if (sc > bestScore) { bestScore = sc; ti = i; }
        });
        // 顺手接战的开口（嘴上清冷，手底利落）——离她 1 格内且不是你点的目标
        if (ti >= 0 && this._pFocus !== ti && this.dist(s, this.enemies[ti]) <= 1
          && s._lastTi !== ti) {
          this._say(s, "assist");
        }
        s._lastTi = ti;
      }
      if (ti < 0) ti = this._firstAliveEnemy();
      if (ti < 0) return;
      let target = this.enemies[ti];
      // —— 跨线赶援（grounded·复用配合系统）：锁定别处战线的目标后，朝它逐格挪近（与普通靠拢同一套
      //    moveCap，绝不瞬移/横越）——镜头靠 turn 拍自然跟过去。够近了才落到下方正常出招。
      const winOf = e => (e._charging || e._whiffed || (e.status && e.status.dingshen > 0));
      if (rescueTi >= 0) {
        const reach = isMelee ? 1 : 2;
        let dR = this.dist(s, target);
        if (dR > reach) {
          const step = this._stepToward(s, target, this.moveCap(s));   // 正常脚程（非全场瞬移）
          if (step != null && step !== s.pos) { s.pos = step; dR = this.dist(s, target); }
          this._sideTarget = ti;
          if (dR > reach) {
            if (rescueWard) {
              const wn = rescueWard === this.player ? "韩师弟" : rescueWard.name;
              if (s._rescueSaid !== wn) { this._log(`${s.name} 了结当面血侍，提步赶去接应 ${wn}！`); s._rescueSaid = wn; }
              else this._log(`${s.name} 朝 ${wn} 那头赶去……`);
            } else {
              if (s._rescueSaid !== "_converge") { this._log(`${s.name} 这边血侍已清、提步赶往交火处打配合！`); s._rescueSaid = "_converge"; }
              else this._log(`${s.name} 向 ${target.name} 逼近。`);
            }
            return;
          }
        }
      }
      // —— 接力黑板：场上若有"破绽大开"的敌人（蓄势/扑空/定身），按人格概率改打它（驰援锁线时不改）——
      if (rescueTi < 0 && !winOf(target)) {
        const wi = this.enemies.findIndex(e => e.alive && winOf(e));
        if (wi >= 0 && this.rng() < 0.4 + persona.aggr * 0.05) { ti = wi; target = this.enemies[wi]; }
      }

      // —— 挡线掩护（护主）：玩家血危且近战敌已贴近——挪到玩家身前代刀，这回合不打 ——
      const hpRatio = this.player.hp / this.player.hpMax;
      const blockAt = stance === "guard" ? 0.55 : 0.32 * (persona.prot / 5);
      if (stance !== "attack" && hpRatio < blockAt) {
        const melee = this.enemies.find(e => e.alive && this.dist(e, this.player) <= 2
          && (!e.attacks || e.attacks.some(a => a.range && a.range[1] <= 1)));
        if (melee) {
          const between = this.player.pos + (melee.pos > this.player.pos ? 1 : -1);
          if ((s.pos !== between || (s.lane || 0) !== 0) && between !== melee.pos && !this.unitAt(between)) {
            s.pos = clampNum(between, 0, this.W - 1);
            s.lane = 0;   // 挡线=从僚位挤进战位排——真身堵在刀口上（直到下次简令换排）
            this._log(s.kind === "ally"
              ? `${s.name} 瞥见你气血翻涌，身形一错挡在你身前——"这一刀，我替你接。"`
              : `${s.name} 轰然横移，铁壁般挡在你与 ${melee.name} 之间。`);
            this._emitFx(this._refOf(s), "miss", "挡线");
            return;
          }
        }
      }

      // —— 走位：近战贴敌 / 远程风筝（kite 人格：被贴身先拉开再打）——
      let d = this.dist(s, target);
      if (isMelee && d > 1) {
        const step = this._stepToward(s, target, this.moveCap(s));
        if (step != null) { s.pos = step; d = this.dist(s, target); }
        if (d > 1) { this._log(`${s.name} 向 ${target.name} 逼近。`); return; }
      } else if (!isMelee && persona.kite > 0 && d <= 1) {
        const dir = s.pos >= target.pos ? 1 : -1;
        const back = clampNum(s.pos + dir, 0, this.W - 1);
        if (!this.unitAt(back, s.alt || 0, s.lane || 0) && !(back === this.player.pos && !this._mayShareCell(s)) && this.rng() < persona.kite * 0.12) {
          s.pos = back; d = this.dist(s, target);
          this._log(`${s.name} 袖风一卷飘然后掠，拉开了身位。`);
        }
      }
      // 排间贴身（2.5 排制）：近战手要咬僚位里的目标，得先欺身入那一排
      if (isMelee && d <= 1 && (target.lane || 0) !== (s.lane || 0)) {
        s.lane = target.lane || 0;
        this._log(`${s.name} 欺身切进 ${target.name} 的身位！`);
      }
      this._sideTarget = ti;   // 接力运镜：镜头知道它在打谁

      // —— 出招：攻令/破绽窗口选最重的一手；否则按权重（人格 aggr 推高重招概率）。
      //    同规则：招式耗灵（mv.mp），灵力不济的招出不了；全负担不起=敛息回元
      //    （跳过出手回灵+亮破绽——同道也会被耗蓝，消耗战对三方都成立）——
      let mv = null;
      if (s.moves && s.moves.length) {
        const affordable = s.moves.filter(m => (m.mp || 0) <= (s.mp || 0));
        if (!affordable.length) {
          s.mp = Math.min((s.mpMax || 30), (s.mp || 0) + 14);
          s.exposed = true;
          this._log(`${s.name} 灵力告罄，就地敛息回元——周身气机一滞，破绽毕露！`);
          return;
        }
        const usable = affordable.filter(m => !m.range || (d >= m.range[0] && d <= m.range[1]));
        const pool = usable.length ? usable : affordable;
        if (stance === "attack" || winOf(target)) {
          mv = pool.reduce((a, b) => (b.dmg || 0) > (a.dmg || 0) ? b : a, pool[0]);
        } else {
          const sum = pool.reduce((a, m) => a + (m.weight || 10) + persona.aggr, 0);
          let r = this.rng() * sum;
          mv = pool[0];
          for (const m of pool) { r -= (m.weight || 10) + persona.aggr; if (r <= 0) { mv = m; break; } }
        }
        if (mv && mv.mp) s.mp = Math.max(0, (s.mp || 0) - mv.mp);
      }
      let dmg = mv ? mv.dmg : (s.atk || 8);
      const elem = mv && mv.elem !== undefined ? mv.elem : s.elem;
      const eMul = elemMul(elem, target.elem);
      const sMul = (s.slays && target.nature && s.slays[target.nature]) || 1;
      dmg = Math.round(dmg * eMul * sMul);
      const exploit = winOf(target);
      if (exploit) dmg = Math.round(dmg * 1.3);   // 接力：抓住破绽窗口
      if (target.soulOnly && !s.soulTouch) { this._log(`${s.name} 攻向 ${target.name}，却如击虚空——元神无形，此路不通。`); return; }
      const r = target.takeDamage(dmg, { soul: !!s.soulTouch, pierce: mv && mv.pierce });
      this._stat(s.name, r.dealt);
      // 侧位也记仇恨（T0 同规则）：她打的，敌人也记她的账
      this.addAggro(target, this.sideKey(s), r.dealt);
      const moveName = mv ? mv.name : (s.atkName || "扑击");
      // 侧位出手特效：月华绫=白绫光带（波形），其余按行属弹道/贴身爪弧
      this._emitFx(`enemy:${ti}`, "fxcast", null, {
        elem, from: this._refOf(s), melee: d <= 1 && isMelee, wave: /月华|绫|素女/.test(moveName) ? 1 : 0,
      });
      if (s.kind === "ally") {
        const act = `${mv && mv.line ? mv.line : `祭出「${moveName}」`} ${target.name}，造成 ${r.dealt} 伤害！` + (eMul > 1 ? "（克制）" : "");
        if (exploit) {
          const w = (target.status && target.status.dingshen > 0) ? "你定住它的那一拍" : "它旧力已尽的破绽";
          this._log(`${s.name} 看准${w}——${act}`);
        } else {
          this._log(`${s.name} ${act}`);
        }
      } else {
        this._log(`${s.name} 使「${moveName}」${exploit ? "（趁虚）" : ""}，对 ${target.name} 造成 ${r.dealt} 伤害` + (eMul > 1 ? "（克制）" : ""));
      }
      this._emitFx(`enemy:${ti}`, "dmg", r.dealt);
      // 击杀/灵力告急的开口（T2）
      if (!target.alive) this._say(s, "kill");
      else if ((s.mp || 0) < (s.mpMax || 30) * 0.25) this._say(s, "lowMp");
      this._checkEnd();
    }

    /* 朝目标走 n 格（被挡则停在挡前；敌对困足阵踏入即陷），返回新 pos 或 null */
    _stepToward(unit, target, n) {
      const dir = target.pos > unit.pos ? 1 : -1;
      let best = null;
      for (let i = 1; i <= n; i++) {
        const p = unit.pos + dir * i;
        if (p < 0 || p >= this.W) break;
        // 钉桩（T3 anchor）：守位者寸步不离岗（±1 格）——拉不走的，绕过或强攻
        if (unit.formation === "anchor" && unit.homePos != null && Math.abs(p - unit.homePos) > 1) break;
        // D1：玩家本格不容驻足——唯境界高于你者可越次而立（你操控的傀儡/灵宠绝无此例外）。
        //     可借道穿过、不得停步：玩家格若已贴着目标则停在前一格，否则穿过玩家继续逼近。
        if (p === this.player.pos && !this._mayShareCell(unit)) {
          if (Math.abs(p - target.pos) <= 1) break;
          continue;
        }
        const o = this.unitAt(p, unit.alt || 0, unit.lane || 0);
        if (o) { if (o.team !== unit.team) break; else continue; }   // 敌挡停步；友方穿过但不能落脚同格
        const z = this.zoneAt(p, "kunzu");
        if (z && z.team !== unit.team && (unit.alt || 0) === 0) {
          // 宗师读阵：瞥一眼灵纹就收脚——你的布置在高手眼里是明牌（mastery 2）
          if ((unit.mastery || 0) >= 2) { unit._zoneDodged = true; break; }
          best = p;
          unit._zonedNote = "kunzu";   // 踏入困足阵：陷住，移动终止
          break;
        }
        best = p;
        if (Math.abs(p - target.pos) === 1) break;   // 到贴身位即可
      }
      return best;
    }

    /* ----- 地雷（伏着）：敌单位踏入埋设格即触发——战前布置的"诱敌入局" ----- */
    _checkMine(e) {
      if (!e || !e.alive || !this.mines || !this.mines.length) return;
      if ((e.alt || 0) === 1) return;   // 凌空不踩地——埋伏只候地上的脚
      const m = this.mines.find(mm => !mm.used && mm.cell === e.pos);
      if (!m) return;
      m.used = true;
      if (m.kind === "anfu") {
        const dmg = m.dmg || 24;
        e.hp -= dmg;
        this._log(`${e.name} 踏上第${m.cell + 1}步——砂砾下的伏火符轰然引爆！烈焰吞身（-${dmg}）！`);
        this._emitFx(`enemy:${this.enemies.indexOf(e)}`, "hit", "伏火");
      } else if (m.kind === "tienu") {
        const dmg = m.dmg || 26;
        e.hp -= dmg;
        e.status.dingshen = (e.status.dingshen || 0) + (m.hold || 1);
        this._log(`第${m.cell + 1}步的淤泥猛然炸开——铁奴破土而出，死死抱住 ${e.name} 狠击一记（-${dmg}，动弹不得）！随即力竭归于尘土。`);
        this._emitFx(`enemy:${this.enemies.indexOf(e)}`, "hit", "伏兵");
      }
      if (e.hp <= 0) { e.hp = 0; e.alive = false; this._log(`${e.name} 倒在了伏着里——猎物至死没看清陷阱。`); }
      this._checkEnd();
    }

    /* ----- 敌方行动：先按意图调位（突进/拉距/遁走），再出招。
     * T0 起：追谁打谁由仇恨账本决定（prey）——傀儡引怪/钓离/换仇恨全在这一口 ----- */
    _enemyAct(e) {
      e._whiffed = false;   // 趁虚窗口关闭：收招硬直只持续到它再次出手
      e._backTurned = false;   // 它转过身来了——绕后窗口关闭
      this._actorRef = "enemy:" + this.enemies.indexOf(e);   // 切镜：行动者镜头（T6）
      if (this.W > 13) this._emitFx("enemy:" + this.enemies.indexOf(e), "turn", null);   // 导演（B1）：镜头先拖到行动的敌人
      const prey = this.aggroTarget(e);
      const a = e.intent || { name: e.atkName || "攻击", dmg: e.atk || 8, soul: e.soulAtk, pierce: e.pierceAtk, kind: "normal", mp: 0, range: [1, 3] };
      // —— 阵型纪律（T3 pack）：从者离领队太远先归队（队形带 ±2 格）——
      //    领队在世，狼群是一张网；领队一死，网就散了
      if (e.formation === "pack" && !e.leader && a.kind !== "flee") {
        const lead = this.enemies.find(x => x.alive && x.leader && x.formation === "pack");
        if (lead && Math.abs(e.pos - lead.pos) > 2 && this.dist(e, prey) > 1) {
          const step = this._stepToward(e, lead, this.moveCap(e));
          if (step != null && Math.abs(step - lead.pos) < Math.abs(e.pos - lead.pos)) {
            e.pos = step;
            this._checkMine(e); if (!e.alive) return;
            this._log(`${e.name} 收势靠拢头领——阵形不乱。`);
            return;
          }
        }
      }
      // anchor 钉桩：守位者绝不离岗（拉不走的，绕过或强攻）
      if (e.formation === "anchor" && e.homePos == null) e.homePos = e.pos;

      // —— 空层机动：腾空追击 / 俯冲落地（升降占整个行动——天地之间没有白来的路）——
      if (a.kind === "rise") {
        e.alt = 1;
        this._log(`${e.name} 振身而起紧追上来——天上也没有躲处了！`);
        this._emitFx(`enemy:${this.enemies.indexOf(e)}`, "miss", "腾空");
        return;
      }
      if (a.kind === "dive") {
        e.alt = 0;
        this._log(`${e.name} 收翅俯冲、轰然落地——烟尘四起！`);
        this._emitFx(`enemy:${this.enemies.indexOf(e)}`, "miss", "落地");
        return;
      }

      // —— 逼近：这回合赶路（够不着猎物——老实跑路，不虚张声势）。
      //    去路被挡线者拦住时，近战系顺势撕咬挡路者（挡线的代价照旧）——
      if (a.kind === "approach") {
        const step = this._stepToward(e, prey, this.moveCap(e));
        if (step != null) { e.pos = step; this._checkMine(e); if (!e.alive) return; }
        if (e._zoneDodged) {
          e._zoneDodged = null;
          this._log(`${e.name} 瞥了一眼地上的灵纹，硬生生收住脚步——这点布置瞒不过行家的眼。`);
        }
        if (e._zonedNote === "kunzu") {
          e._zonedNote = null;
          this._log(`${e.name} 一头撞进困足阵——脚下如陷泥沼，进势戛然而止！`);
          this._emitFx(`enemy:${this.enemies.indexOf(e)}`, "miss", "困足");
          return;
        }
        const blocker = [this.unitAt(e.pos - 1), this.unitAt(e.pos + 1)]
          .find(u => u && u.team === "player" && u !== this.player);
        if (blocker) {
          const melee = this._enemyAttacks(e).find(x => (x.range || [1, 1])[1] <= 1 && (x.mp || 0) <= e.mp);
          if (melee) {
            e.mp -= (melee.mp || 0);
            this._strikeSideUnit(e, melee, blocker);
            return;
          }
        }
        this._log(prey === this.player
          ? `${e.name} 向你逼近（距${this.dist(e, this.player)}格）。`
          : `${e.name} 的杀意锁向 ${prey.name}，步步紧逼（距${this.dist(e, prey)}格）。`);
        return;
      }

      // —— 遁走（阶段8 逃遁→击杀闭环）：撤离口收窄=只能从最前排(lane0)最右那一格离场；
      //    该格被己方占住（韩立站/控）→ 无合法撤离格 → 遁走失败、滞留受死（堵口=封逃）。
      //    雷遁抢占此格或够狠够快补刀，即"元婴难杀"的破局点。——
      if (a.kind === "flee") {
        const exitPos = this.W - 1;                       // 撤离口：最前排(lane0)最右格
        const ei = this.enemies.indexOf(e);
        const blocker = this.unitAt(exitPos, null, 0);    // 谁占着撤离口（战位排）
        // 撤离口被己方占住 → 退路已封，遁走失败、滞留受死
        if (blocker && blocker !== e && this._isAlly(blocker)) {
          this._say(e, "flee");
          this._log(`${e.name} 夺路欲遁，撤离口却被你死死封住——退无可退，只得滞留待死！`);
          this._emitFx(`enemy:${ei}`, "miss", "退路已封");
          return;
        }
        // 已抵撤离口（最前排最右格）→ 脱离战斗
        if ((e.lane || 0) === 0 && e.pos >= exitPos) {
          e.escaped = true;
          this._log(`${e.name} 化作一道遁光夺路而走——逃了！`);
          this._emitFx(`enemy:${ei}`, "miss", "遁走");
          return;
        }
        // 僚位先并回战位排，再向撤离口疾退（逃命脚程+1；战位排被占即堵路，含韩立封口）
        if ((e.lane || 0) !== 0) e.lane = 0;
        let p = e.pos;
        for (let i = 1; i <= this.moveCap(e) + 1; i++) {
          const np = e.pos + i;
          if (np >= this.W) break;
          if (this.unitAt(np, null, 0)) break;
          p = np;
        }
        e.pos = p;
        this._checkMine(e); if (!e.alive) return;
        this._say(e, "flee");
        this._log(`${e.name} 且战且退，向最前排的撤离口奔逃（再不拦就走脱了）！`);
        return;
      }

      // —— 守御：原地固盾 ——
      if (a.kind === "guard") {
        const cap = Math.round(e.hpMax * 0.5);
        e.shield = Math.min(cap, (e.shield || 0) + (a.shield || 12));
        this._log(`${e.name} 凝聚「${a.name}」，护体 +${a.shield}（共${e.shield}）——一时间固若金汤！`);
        this._emitFx(`enemy:${this.enemies.indexOf(e)}`, "miss", "护体");
        return;
      }

      // —— 蓄力：原地蓄势（破绽毕露，可被打断）——
      if (a.kind === "charge" && !e._charging) {
        // 蓄力技须先到位（贴身技先突进）——盯着的是它的仇恨目标
        const need = a.range || [1, 1];
        const dHere = this.dist(e, prey);
        if (dHere > need[1]) {
          const step = this._stepToward(e, prey, this.moveCap(e));
          if (step != null) { e.pos = step; this._checkMine(e); if (!e.alive) return; }
        }
        e._charging = { name: a.name, dmg: Math.round((a.dmg || 8) * 2), pierce: a.pierce, range: need, aim: a.aim, zoneSpan: a.zoneSpan };
        e.exposed = true;
        this._log(`${e.name} 周身气势暴涨，正在蓄力「${a.name}」——下回合将有雷霆一击！（蓄势中破绽毕露）`);
        this._emitFx(`enemy:${this.enemies.indexOf(e)}`, "miss", "蓄力");
        return;
      }

      // —— 释放/普通出招：先调位到射程，再打 ——
      let atkDef = a;
      if (a.kind === "release") {
        atkDef = Object.assign({}, e._charging, { kind: "release",
          aim: a.aim || (e._charging && e._charging.aim),
          targetCell: a.targetCell, zoneFrom: a.zoneFrom, zoneTo: a.zoneTo });
        e._charging = null;
        e.exposed = false;
      }
      const range = atkDef.range || [1, 3];
      let d = this.dist(e, prey);
      // 调位：太远→突进；太近（狙击被贴）→ 拉距——一切以仇恨目标为准
      if (d > range[1]) {
        const step = this._stepToward(e, prey, this.moveCap(e));
        if (step != null) { e.pos = step; this._checkMine(e); if (!e.alive) return; d = this.dist(e, prey); }
        if (e._zoneDodged) {
          e._zoneDodged = null;
          this._log(`${e.name} 在阵纹前堪堪收脚，绕不过去便不踏——老辣得很。`);
        }
        if (e._zonedNote === "kunzu") {
          e._zonedNote = null;
          this._log(`${e.name} 一头撞进困足阵——脚下如陷泥沼，进势戛然而止！`);
          this._emitFx(`enemy:${this.enemies.indexOf(e)}`, "miss", "困足");
          if (d > range[1]) return;   // 困在阵中且够不着：这回合废了
        }
        if (d > range[1]) {
          // 去路被挡：近战系转而撕咬挡路者——这就是挡线者的价值与代价
          const blocker = [this.unitAt(e.pos - 1), this.unitAt(e.pos + 1)].find(u => u && u.team === "player" && u !== this.player);
          if (blocker && range[1] <= 1 && (atkDef.mp || 0) <= e.mp) {
            e.mp -= (atkDef.mp || 0);
            this._strikeSideUnit(e, atkDef, blocker);
            return;
          }
          this._log(prey === this.player ? `${e.name} 向你逼近（距${d}格）。` : `${e.name} 紧追 ${prey.name}（距${d}格）。`);
          return;   // 这回合只能赶路
        }
      } else if (d < range[0]) {
        // 后撤拉距（远程系被贴身）
        const dir = e.pos > prey.pos ? 1 : -1;
        let p = e.pos;
        for (let i = 1; i <= this.moveCap(e); i++) {
          const np = e.pos + dir * i;
          if (np < 0 || np >= this.W) break;
          if (this.unitAt(np, null, e.lane || 0)) break;
          p = np;
        }
        if (p !== e.pos) { e.pos = p; this._checkMine(e); if (!e.alive) return; d = this.dist(e, prey); this._log(`${e.name} 急退拉开距离！`); }
        if (d < range[0]) { this._log(`${e.name} 被贴得太近，招式施展不开！`); return; }
      }

      // 扣蓝（修士技耗蓝；蓝不够时这招放空——_rollEnemyIntents 已尽量避免）
      if ((atkDef.mp || 0) > e.mp) { this._log(`${e.name} 灵力不济，一招落空！`); return; }
      e.mp -= (atkDef.mp || 0);
      // 扣特色资源（敌我同规则）：它的神雷/煞气也是打一道少一道
      if (atkDef.chargeCost) {
        this._spendCharge(e, atkDef);
        const ch = e.charges && e.charges[atkDef.chargeCost.id];
        if (ch && ch.cur <= 0) this._log(`（${e.name} 的${ch.name}已尽——这一手是它最后的本钱！）`);
      }

      // —— 打格子（cell）：砸意图时亮出的那个格——你移开了就是空（身法的胜利）——
      if (atkDef.targetCell != null) {
        let cell = atkDef.targetCell;
        // 追踪修正（track，稀有高阶技）：落点追你一格——一步躲不开
        if (atkDef.track && this.player.pos !== cell) {
          const dir = this.player.pos > cell ? 1 : -1;
          cell += dir;
          this._log(`「${atkDef.name}」竟随你身形一折——落点追了过来！`);
        }
        // 打格子=瞄着战位排那个落点砸（depth:"all" 的罕见重击才殃及僚位）
        const victims = this.units().filter(u => u.team === "player" && u.pos === cell && (u.alt || 0) === 0
          && (atkDef.depth === "all" || (u.lane || 0) === 0));
        if (!victims.length) {
          this._log(`${e.name} 的「${atkDef.name}」轰然砸落第${cell + 1}步——却砸了个空！你早已移形换位。`);
          this._emitFx("global", "exploit", "看破走位！");
          // 趁虚窗口：落空收招硬直——它下次行动前，受击+30%（前躲钻怀里的人才吃得到这口肉）
          e._whiffed = true;
          this._log(`（${e.name} 旧力已尽、新力未生——趁虚的窗口只有这一瞬！）`);
          // 扑击惯性（lunge）：扑空的身子收不住，冲进落点格——距离几何重写（后躲拉不开，前躲已绕背）
          if (atkDef.lunge && !this.unitAt(cell, null, e.lane || 0)) {
            e.pos = cell;
            this._log(`${e.name} 收势不住，扑进了第${cell + 1}步！`);
            this._checkMine(e);
          }
          return;
        }
        victims.forEach(v => {
          let cdmg = atkDef.dmg || 8;
          if (atkDef.elem && v.elem) cdmg = Math.round(cdmg * elemMul(atkDef.elem, v.elem));
          if (atkDef.kind === "release" && v.chargeResist > 0) cdmg = Math.round(cdmg * (1 - v.chargeResist));
          const r = v.takeDamage(cdmg, { pierce: atkDef.pierce });   // 命中即实打（盾甲照常）：躲的机会给过了，不再掷闪避
          if (v === this.player && this.player.hp <= 0) this.deathCause = { by: e.name, move: atkDef.name };
          this._log(`${e.name} 的「${atkDef.name}」结结实实砸在${v === this.player ? "你" : v.name}身上——${r.dealt} 伤害${r.exposed ? "（破绽+30%）" : ""}（${Math.max(0, Math.round(v.hp))}/${v.hpMax}）`);
          this._emitFx(this._refOf(v), "hurt", r.dealt, { elem: atkDef.elem, slam: true, from: `enemy:${this.enemies.indexOf(e)}` });
          if (v === this.player) this._maybeBreakPlayerCharge(r.dealt);
        });
        // 扑击命中也有惯性：贴到目标身侧（落点旁的空格）
        if (atkDef.lunge) {
          const near = [cell - 1, cell + 1].filter(p => p >= 0 && p < this.W && !this.unitAt(p, null, e.lane || 0))
            .sort((a, b) => Math.abs(a - e.pos) - Math.abs(b - e.pos))[0];
          if (near != null) { e.pos = near; this._checkMine(e); }
        }
        this._checkSideDown();
        return;
      }
      // —— 范围（zone）：区间内全体我方单位（侧位也吃——阵型的代价）——
      if (atkDef.aim === "zone") {
        const from = atkDef.zoneFrom != null ? atkDef.zoneFrom : Math.max(0, this.player.pos - 1);
        const to = atkDef.zoneTo != null ? atkDef.zoneTo : Math.min(this.W - 1, this.player.pos + 1);
        // 方阵（2.5 排制）：范围技默认"罩"全排（吐息/毒雾/啸震——AOE 打得到同道，阵型的代价）；
        // depth:"front" 的"扫"类（横扫尾击）只扫战位排——僚位读懂一字之差就躲掉
        const victims = this.units().filter(u => u.team === "player" && u.pos >= from && u.pos <= to && (u.alt || 0) === 0
          && (atkDef.depth !== "front" || (u.lane || 0) === 0));
        if (!victims.length) {
          this._log(`${e.name} 的「${atkDef.name}」横扫第${from + 1}~${to + 1}步——无人在内，扑了个空！`);
          this._emitFx("player", "miss", "拉出区间");
          e._whiffed = true;
          this._log(`（${e.name} 大开大合扑了个空——趁虚的窗口只有这一瞬！）`);
          return;
        }
        this._log(`${e.name} 的「${atkDef.name}」席卷第${from + 1}~${to + 1}步！`);
        victims.forEach(v => {
          let zdmg = atkDef.dmg || 8;
          if (atkDef.elem && v.elem) zdmg = Math.round(zdmg * elemMul(atkDef.elem, v.elem));
          const r = v.takeDamage(zdmg, { pierce: atkDef.pierce });
          if (v === this.player && this.player.hp <= 0) this.deathCause = { by: e.name, move: atkDef.name };
          this._log(`　${v === this.player ? "你" : v.name} 受到 ${r.dealt} 伤害（${Math.max(0, Math.round(v.hp))}/${v.hpMax}）`);
          this._emitFx(this._refOf(v), "hurt", r.dealt, { elem: atkDef.elem, slam: true, from: `enemy:${this.enemies.indexOf(e)}` });
          if (v === this.player) this._maybeBreakPlayerCharge(r.dealt);
        });
        this._checkSideDown();
        return;
      }

      // 攻击目标判定（T0 仇恨消费）：杀意流向仇恨目标；贴身系仍先打挡线者
      // （近战必须打相邻——傀儡/侧位的真墙价值不因仇恨而失效）
      let victim = prey;
      // 排间贴身兜底（2.5 排制）：僚位敌真要近咬（拼死一搏类）——先欺身扑出战位排
      if (range[1] <= 1 && (e.lane || 0) !== 0) {
        e.lane = 0;
        this._log(`${e.name} 自阵后欺身扑出！`);
      }
      if (range[1] <= 1 && !atkDef.antiAir) {
        // 空层错位：贴身手段够不到不同高度的目标——爪牙落空（地面单位优先转打同层挡线者）
        // antiAir 例外：腾身扑杀本就是跳起来咬的，低空拦不住兽王
        if ((victim.alt || 0) !== (e.alt || 0)) {
          const adjSame = [this.unitAt(e.pos - 1, e.alt || 0, e.lane || 0), this.unitAt(e.pos + 1, e.alt || 0, e.lane || 0)]
            .find(u => u && u.team === "player" && u !== victim);
          if (adjSame) { this._strikeSideUnit(e, atkDef, adjSame); return; }
          this._log(`${e.name} 的「${atkDef.name}」对着${(victim.alt || 0) === 1 ? "半空" : "地面"}徒劳挥落——够不着${victim === this.player ? "你" : "目标"}！`);
          e._whiffed = true;
          return;
        }
        // 近战只咬得到嘴边的：仇恨目标不相邻时，先撕相邻的我方单位
        if (this.dist(e, victim) > 1) {
          const adj = [this.unitAt(e.pos - 1), this.unitAt(e.pos + 1)].find(u => u && u.team === "player");
          if (adj) victim = adj;
          else { this._log(`${e.name} 扑了个空——无人在其爪牙之内。`); return; }
        }
      }
      // 远程攻击仍可被侧位掷骰挡刀（侧位的护卫本能——只挡飞向你的；多侧位依序掷）
      if (victim === this.player) {
        for (const s of this.sides) {
          if (s.hp > 0 && this.rng() < (s.guard || 0)) {
            victim = s;
            this._log(`${s.name} ${s.kind === "ally" ? "侧身替你接下这一击" : "横身挡在你身前"}！`);
            break;
          }
        }
      }

      if (victim !== this.player) { this._strikeSideUnit(e, atkDef, victim); return; }

      // 打玩家（出手特效：行属弹道/贴身爪弧——敌人的招也要"看得见是什么"）
      this._emitFx("player", "fxcast", null, { elem: atkDef.elem, from: `enemy:${this.enemies.indexOf(e)}`, melee: range[1] <= 1 });
      let dodge = (this.player.dodgeBuff || 0) + (this.player.agility || 0) / 100;
      const enemyAdv = Balance.senseAdvantage(e.sense || 5, this.player.sense);
      dodge = clampNum(dodge - enemyAdv.hitBonus, 0, 0.6);
      if (this.rng() < dodge) { this._log(`${e.name} 使「${atkDef.name}」，被 ${this.player.name} 闪避！`); this._emitFx("player", "miss", "闪避"); return; }
      let edmg = atkDef.dmg || 8;
      if (atkDef.elem && this.player.elem) {
        const m = elemMul(atkDef.elem, this.player.elem);
        if (m > 1 && !this._eNoted) { this._eNoted = true; this._log(`（${e.name}的${ELEM_NAME[atkDef.elem]}系法术天克你的道基——护体灵力被压着打！）`); }
        edmg = Math.round(edmg * m);
      }
      if (atkDef.kind === "release" && this.player.chargeResist > 0) {
        edmg = Math.round(edmg * (1 - this.player.chargeResist));
        this._log(`玄铁巨盾横亘身前，山岳之御卸去重击大半力道！`);
      }
      const r = this.player.takeDamage(edmg, { soul: atkDef.soul, pierce: atkDef.pierce });
      if (r.blocked) { this._log(`${e.name} 的「${atkDef.name}」对你无效`); this._emitFx("player", "miss", "无效"); }
      else {
        if (this.player.hp <= 0) this.deathCause = { by: e.name, move: atkDef.name };
        this._log(`${e.name} 使「${atkDef.name}」，你受到 ${r.dealt} 伤害${r.exposed ? "（破绽+30%）" : ""}（${Math.max(0, Math.round(this.player.hp))}/${this.player.hpMax}）`);
        this._emitFx("player", "hurt", r.dealt);
        // 同道的关切（T2）：你血线垮半时她开口（账本保证一场只说一次）
        if (this.player.hp > 0 && this.player.hp < this.player.hpMax * 0.5) {
          const av = this._allyVoice();
          if (av) this._say(av, "playerHurt");
        }
        this._maybeBreakPlayerCharge(r.dealt);
        // 击落（玩家侧）：凌空挨重击——遁光散落坠地，下回合身法尽失
        if ((this.player.alt || 0) === 1 && r.dealt >= 16 && this.player.hp > 0) {
          this.player.alt = 0;
          this.player._knocked = true;
          this._log(`这一记结结实实砸散了你的遁光——你从半空栽落，下一拍只能就地撑起身子！（击落）`);
          this._emitFx("player", "miss", "击落");
        }
      }
    }

    /* 玩家蓄势受击打断判定（30%，与敌方蓄势对称） */
    _maybeBreakPlayerCharge(dealt) {
      if (this.player._charging && dealt > 0 && this.rng() < 0.3) {
        this._log(`你被这一击打得气机一乱——「${this.player._charging.name}」蓄势溃散！`);
        this.player._charging = null;
        this.player.exposed = false;
      }
    }

    _maybeSpawnWave() {
      if (!this._pendingEnemyWaves || !this._pendingEnemyWaves.length) return;
      if (this.enemies.every(e => !e.alive)) {
        const wave = this._pendingEnemyWaves.shift();
        this.enemies = wave.map(e => { const f = e instanceof Fighter ? e : new Fighter(e); f.team = "enemy"; return f; });
        // 新一波从右侧入场
        this.enemies.forEach((e, i) => { e.pos = clampNum(this.W - 1 - i, this.player.pos + 1, this.W - 1); });
        this._rollEnemyIntents();
        this._log(`—— 新的敌人现身！——`);
        this.enemies.forEach(e => { if (e.introNote) this._log(`【敌情】${e.introNote}`); });
        const heal = Math.round(this.player.hpMax * 0.12);
        this.player.hp = clampNum(this.player.hp + heal, 0, this.player.hpMax);
        // 波次衔接同时回一口灵力（决战是阶段战不是马拉松）
        const mpBack = Math.round(this.player.mpMax * 0.15);
        this.player.mp = clampNum(this.player.mp + mpBack, 0, this.player.mpMax);
        this._log(`斩敌之威，气势如虹——你抢回片刻喘息（气血+${heal}，灵力+${mpBack}）。`);
        this.status = "ongoing";
      }
    }

    /* ----- H·下·真·颠倒五行阵：逐回合战场相位（startRound 内调用）-----
     * 阵成之后，五行倒转、虚实易位：每回合一相，反噬场上敌人、佐助我方。
     * ph: { name, log, suppress(占敌 hpMax 之比·穿甲), expose(令敌破绽毕露), player:{shield,dodge,mp} } */
    // 手动选相位：玩家点一个未用过的相位激活（每相位整场只能用一次）
    chooseFieldPhase(idx) {
      if (!this.fieldManual || !this.fieldCycle || !this.fieldCycle[idx]) return { ok: false };
      if (this._fieldUsed.includes(idx)) return { ok: false, reason: "此相位已用过" };
      if (this._fieldPhaseApplied) return { ok: false, reason: "本回合已激活相位" };
      this._fieldUsed.push(idx);
      this._fieldPhaseApplied = true;
      this._applyFieldPhase(this.fieldCycle[idx]);
      return { ok: true };
    }

    _applyFieldPhase(ph) {
      if (!ph) return;
      this._fieldPhase = ph;
      this._log(`【真·颠倒五行阵·${ph.name}】${ph.log || ""}`);
      const living = this.enemies.filter(e => e.alive);
      if (ph.suppress > 0) {
        living.forEach(e => {
          const dmg = Math.max(1, Math.round((e.hpMax || e.hp) * ph.suppress));
          e.takeDamage(dmg, { pierce: true });   // 阵法之力·穿甲不可挡
          this._log(`${e.name} 被阵中「${ph.name}」之力反噬（-${dmg}）。`);
        });
      }
      if (ph.expose) living.forEach(e => { e.exposed = true; });
      if (ph.player) {
        if (ph.player.shield) {
          const cap = this.player._shieldCap || Math.round(this.player.hpMax * 0.5);
          this.player.shield = Math.min(cap, (this.player.shield || 0) + ph.player.shield);
        }
        if (ph.player.dodge) this.player.dodgeBuff = (this.player.dodgeBuff || 0) + ph.player.dodge;
        if (ph.player.mp) this.player.mp = clampNum(this.player.mp + ph.player.mp, 0, this.player.mpMax);
      }
    }

    _checkEnd() {
      if (this.player.hp <= 0) {
        this.status = "lose";
        { const av = this._allyVoice(); if (av) this._say(av, "playerDown"); }
        this._log(`${this.player.name} 气血耗尽，败。`);
        return;
      }
      // 阵型崩溃（T3）：领队殒命，群势立溃——阵散为各自为战，爪牙皆软三分
      if (!this._packBroken) {
        const deadLead = this.enemies.find(x => x.leader && x.formation === "pack" && !x.alive);
        if (deadLead) {
          this._packBroken = true;
          let n = 0;
          this.enemies.forEach(x => {
            if (x.alive && x.formation === "pack" && !x.leader) {
              x.formation = "loose";
              x.dmgBonus = (x.dmgBonus || 1) * 0.85;
              n++;
            }
          });
          if (n) this._log(`（${deadLead.name} 既殒，群势立溃——余下爪牙乱了章法，凶性弱了三分！）`);
        }
      }
      // 阵脚补位（2.5 排制）：战位排清空而僚位还有人——缩在后头的被逼上前来
      //（没有"永远缩在僚位躲贴身"的无解龟壳；近战 build 杀穿前排即可触及全员）
      if (this.enemies.some(e => e.alive) && !this.enemies.some(e => e.alive && (e.lane || 0) === 0)) {
        this.enemies.forEach(e => {
          if (e.alive && (e.lane || 0) !== 0) { e.lane = 0; this._log(`阵脚已破——${e.name} 被逼上前来！`); }
        });
      }
      const allGone = this.enemies.every(e => !e.alive);
      if (allGone && (!this._pendingEnemyWaves || this._pendingEnemyWaves.length === 0)) {
        const fledAny = this.enemies.some(e => e.escaped);
        this.status = "win";
        this._log(fledAny && this.enemies.every(e => e.escaped) ? `敌人尽数遁走——战场是你的了。` : `敌人尽灭，胜！`);
        { const av = this._allyVoice(); if (av) this._say(av, "win"); }
      }
    }

    /* ----- 速决：AI 代打全场（无头跑——速战按钮/蒙特卡洛共用）-----
     * 玩家策略（贪心）：射程内最高伤害可负担技能；够不着就突进；血危吃口气。 */
    autoResolve(maxR) {
      const cap = maxR || this.maxRounds;
      let guard = 0;
      while (this.status === "ongoing" && guard++ < cap * 4) {
        this._autoPlayerTurn();
        if (this.status !== "ongoing") break;
        this.endRound();
        if (this.status !== "ongoing") break;
        this.startRound();
      }
      if (this.status === "ongoing") { this.status = "lose"; this._log("僵持不下，只得罢手。"); }
      return this.status;
    }
    _autoPlayerTurn() {
      const ti = this._firstAliveEnemy();
      if (ti < 0) return;
      const t = this.enemies[ti];
      const effDmg = id => (SPELLS[id].dmg || 0) * (SPELLS[id].fixedSegs || 1);
      // 0) 危险格预警：敌方 cell/zone 砸向我 → 能移就移开（AI 也会走位）
      const threat = this.enemies.find(e => e.alive && e.intent
        && ((e.intent.targetCell === this.player.pos)
          || (e.intent.aim === "zone" && this.player.pos >= e.intent.zoneFrom && this.player.pos <= e.intent.zoneTo)));
      if (threat && this.playerCanMove()) {
        const cells = this.movableCells(this.player).filter(p =>
          p !== threat.intent.targetCell
          && !(threat.intent.aim === "zone" && p >= threat.intent.zoneFrom && p <= threat.intent.zoneTo));
        if (cells.length) {
          // 优先仍能出招的格
          const good = cells.find(p => Math.abs(p - t.pos) <= 3) != null ? cells.find(p => Math.abs(p - t.pos) <= 3) : cells[0];
          this.playerMove(good);
        }
      }
      // 0.7) 拦遁：敌欲走脱且定身符在手——锁死它（伏诛与走脱的分水岭）
      const ri = this.enemies.findIndex(e => e.alive && e.intent && e.intent.kind === "flee");
      if (ri >= 0 && this.canAfford("dingshen_fu") && this.castableAt("dingshen_fu", ri)) {
        this.cast("dingshen_fu", ri);
      }
      // 1) 瞬发：威力最大的先甩（金光砖>符）
      const quicks = this.player.spells
        .filter(id => SPELLS[id] && SPELLS[id].quick && this.canAfford(id) && this.castableAt(id, ti))
        .sort((a, b) => effDmg(b) - effDmg(a));
      if (quicks.length && t.hp > 25) this.cast(quicks[0], ti);
      if (this.status !== "ongoing") return;
      // 1.5) 贴身且目标可毒未毒：喂毒（绕盾的胜负手——金钟罩挡不住入体之毒）
      if (this.canAfford("weidu") && this.castableAt("weidu", ti)
        && !t.status.poison && !t.immunePoison && !t.soulOnly && t.hp > 40) {
        this.cast("weidu", ti);
        return;
      }
      // 2) 血危先举盾
      if (this.player.hp < this.player.hpMax * 0.35 && (this.player.shield || 0) < 10 && this.canAfford("huti")) {
        this.cast("huti", ti);
        return;
      }
      // 3) 主行动：可打的攻击技里挑实效最高（元神之敌唯镇魂可伤）
      const wantType = t.soulOnly ? "soul" : "atk";
      const pick = () => this.player.spells
        .filter(id => SPELLS[id] && !SPELLS[id].quick && SPELLS[id].type === wantType && this.canAfford(id) && this.castableAt(id, ti))
        .sort((a, b) => effDmg(b) - effDmg(a))[0];
      let best = pick();
      if (best) { this.cast(best, ti); return; }
      // 4) 够不着：突进再打
      if (this._pActsUsed < this._pActsMax && this.playerCanMove()) {
        const step = this._stepToward(this.player, t, this.player.move - this._pMoved);
        if (step != null) this.playerMove(step);
        best = pick();
        if (best) { this.cast(best, ti); return; }
      }
      // 5) 没招了：灵力见底就凝息（远距才敢），否则护体
      if (this.canAfford("ningshen") && this.player.mp < this.player.mpMax * 0.4 && this.dist(this.player, t) >= 3) { this.cast("ningshen", ti); return; }
      if (this.canAfford("huti")) { this.cast("huti", ti); return; }
      if (this.canAfford("ningshen") && this.player.mp < this.player.mpMax * 0.6) { this.cast("ningshen", ti); }
    }
  }

  const CombatAPI = { Combat, Fighter, SPELLS, ELEMENTS, ELEM_NAME, elemMul };
  root.Combat = Combat;
  root.CombatAPI = CombatAPI;
  if (typeof module !== "undefined" && module.exports) module.exports = CombatAPI;

})(typeof window !== "undefined" ? window : globalThis);
