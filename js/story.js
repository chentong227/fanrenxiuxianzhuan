/* ============================================================
 * story.js — 七玄门篇主线剧情脚本（忠于 docs/lore-七玄门篇.md，完整三幕）
 *
 * 第一幕 · 入门：青牛镇 → 赴考 → 选拔 → 拜师墨大夫
 * 第二幕 · 夺舍危机：习功结友 → 小绿瓶 → 暗修 → 张铁之死 → 反杀墨大夫
 * 第三幕 · 帮派之争：顶替身份蛰伏 → 野狼帮冲突 → 金光上人 → 反杀 → 升仙令离门
 *
 * 阶段字段：id / cond(s) / title / text[] / choices[] / onArrive(s)
 * 主线靠 storyStage 指针顺序推进；主线之外（闭关/历练/小瓶）自由进行。
 * ============================================================ */

const STORY = [
  /* ============ 第一幕 · 入门 ============ */

  /* ---- A0 青牛镇 ---- */
  {
    id: "village",
    title: "青牛镇 · 韩家",
    text: [
      "你叫韩立，青牛镇韩家老二。家中清贫，几亩薄田勉强糊口，年成不好时连盐都吃不起。",
      "这年，在七玄门做事的三叔回乡省亲。他见你机灵懂事，私下对你爹娘提议：七玄门正招收记名弟子，管吃管住，每月还有例钱，何不让韩立去碰碰运气？",
      "爹娘犹豫，你却已动了心——若能进了那高门大派，家里的日子或许就能好过些。",
    ],
    onArrive(s) { State.setFlag("at_village"); },
    choices: [
      { text: "拜别爹娘，随三叔去七玄门", hint: "踏出青牛镇", next: true },
    ],
  },

  /* ---- A1 赴考途中，结识张铁 ---- */
  {
    id: "journey",
    title: "赴 考",
    onArrive(s) { s.location = "road"; },
    text: [
      "出了青牛镇，山路迢迢。同行的还有几个各乡来应试的少年。",
      "其中一个虎背熊腰、憨厚老实的少年叫张铁，与你一见投缘。一路上你俩互相照应，渐成好友。",
      "「听说七玄门收徒极严，十个里取不了一个。」张铁挠头，「不过……总得试试不是？」",
    ],
    onArrive(s) {
      s.location = "road";
      Engine.meetNpc("zhangtie", "你与他一见投缘，结伴同行。");
    },
    choices: [
      { text: "与张铁结伴，同赴选拔", hint: "继续", next: true },
    ],
  },

  /* ---- A2 入门选拔 ---- */
  {
    id: "exam",
    title: "七玄门 · 入门选拔",
    onArrive(s) { s.location = "shanmen"; State.setFlag("joined_sect"); },
    text: [
      "七玄门依山而建，气派非凡。选拔场上人头攒动，你和张铁夹在其中，显得格外不起眼。",
      "测筋骨、考悟性、试胆识……你二人资质平平，初试竟未能入选。",
      "眼看就要被刷下，你不肯认命，硬着头皮求得一个补考的机会。半年后再试，凭着一股韧劲，你和张铁终于挤进了记名弟子的名册。",
    ],
    choices: [
      { text: "入门记名，正式踏入七玄门", hint: "继续", next: true },
    ],
  },

  /* ---- A3 拜师墨大夫 ---- */
  {
    id: "intro",
    title: "拜师 · 墨大夫",
    text: [
      { scene: "七玄门 · 药庐" },
      "选拔的喧嚣散去，你和张铁被一名枯瘦老者叫到跟前。他便是门中以医毒闻名、性情古怪的墨大夫。",
      { say: "墨大夫", tone: "打量着你，忽然咳了两声", text: "你二人资质平平，却有股不肯认命的韧劲……也罢，就留在我药庐做个药童吧。" },
      "他枯枝似的手指递来一卷泛黄的功法。",
      { say: "墨大夫", text: "这《长春功》，你且用心修习。每练成一层，我便赏你纹银。" },
      { aside: "纹银……家里若能宽裕些就好了。你压下心头的念头，恭敬接过。" },
      "自此你住进药庐，日里辨药煎药，闲时打坐修《长春功》。修仙之路，就在这草药的苦香里，悄然开端。",
    ],
    onArrive(s) {
      State.setFlag("met_modafu");
      s.location = "yaolu";
      Engine.meetNpc("modafu", "门中以医毒闻名的怪人，收你为药童。");
      Engine.assignTask("modafu_deadline", 24);
      Engine.toast("你拜入墨大夫门下，习《长春功》");
    },
    choices: [
      { text: "叩首谢恩，潜心修炼", hint: "开始自由修行", next: true },
    ],
  },

  /* ============ 第二幕 · 夺舍危机 ============ */

  /* ---- B1 结识厉飞雨 ---- */
  {
    id: "friends",
    cond: (s) => s.flags.adventured || s.cultivation >= 40,
    title: "同门之谊",
    text: [
      { scene: "演武厅" },
      "药庐之外，你结识了同门厉飞雨——一个武学有成、性子爽朗的师兄。",
      { say: "厉飞雨", tone: "拍着你肩膀大笑", text: "韩立，你这记性简直是天才！我练了三月的招式，你看两遍就会了！" },
      { aside: "你笑而不语。这哪是什么天才——是《长春功》练到些火候后，记忆愈发清明罢了。这等隐秘，自然不能与人说。" },
      "张铁却没这般顺遂。他无论如何引气不入体，《长春功》死死卡在第一层。",
      { say: "墨大夫", tone: "摇头", text: "你这身子骨，不是修仙的料。改修武体吧，练练象甲功，强身健骨也好。" },
      "张铁憨憨地应了，没半分怨言。三人意气相投，结为好友——这七玄门的日子，总算有了些暖意。",
    ],
    onArrive(s) {
      State.setFlag("met_friends");
      Engine.meetNpc("lifeiyu", "爽朗仗义的同门师兄，武学有成。");
    },
    choices: [
      { text: "与好友同行历练", hint: "继续", next: true },
    ],
  },

  /* ---- B2 得小绿瓶 ---- */
  {
    id: "bottle",
    cond: (s) => s.cultivation >= 70 || s.flags.adv_count >= 2,
    title: "神秘小瓶",
    text: [
      "一次外出，你于无意间得了一只不起眼的小绿瓶。",
      "瓶中残留着几滴神秘绿液。你试着将一株枯萎灵草投入瓶内——",
      "不过一夜，那灵草竟抽枝展叶，灵气盎然，仿佛被催着长了整整一季！",
      "你心头剧跳，强压下狂喜。此物若善加利用……以你这平庸的四灵根，未必没有出头之日。此事，断不可让任何人知晓。",
    ],
    onArrive(s) {
      s.bottle.unlocked = true;
      State.give("lingcao", 2);
      Engine.unlockBottle();
      Engine.toast("获得「神秘小绿瓶」，可种植催熟灵草！");
    },
    choices: [
      { text: "暗中培育灵药，瞒过墨大夫", hint: "解锁「打理小瓶」", next: true },
    ],
  },

  /* ---- B3 暗修精进（练气四层）---- */
  {
    id: "secret_cultivate",
    cond: (s) => s.realmIndex >= 3,
    objTitle: "暗修精进",
    objHint: "借小绿瓶催熟灵药、闭关苦修，将《长春功》修到练气四层。",
    title: "暗藏的锋芒",
    text: [
      "靠着小绿瓶催熟的灵药，你瞒着墨大夫，将《长春功》一路偷修到了练气四层。",
      "表面上，你仍是那个进境平平、按层领赏的笨拙药童；暗地里，你的修为早已远超墨大夫的预料。",
      "你愈发谨慎。墨大夫待你太好了——好得不像个寻常师父。这份反常，让你脊背发凉。",
    ],
    onArrive(s) {
      State.setFlag("qi_layer_4");
      Engine.scheduleEvent("zhangtie_death", 3);  // 张铁外出，三月后归期不至 → 真相浮现
    },
    choices: [
      { text: "藏锋守拙，静观其变", hint: "继续", next: true },
    ],
  },

  /* ---- B4 张铁之死 ---- */
  {
    id: "zhangtie",
    cond: (s) => s.flags.zhangtie_fated,
    objTitle: "挚友外出未归",
    objHint: "张铁奉命外出，归期将至。静待时日，留意他的下落。",
    title: "挚友失踪",
    text: [
      { scene: "数月后 · 深夜" },
      "练象甲功的张铁奉墨大夫之命外出探查，此后再无音讯。门中只道他离门远游了。",
      { aside: "可你心里总堵着一块石头。张铁不是那种不辞而别的人。" },
      "你四处打听，蛛丝马迹却都指向一个令你脊背发凉的方向。直到这一夜，你绕到墨大夫密室之外——",
      { beat: "……" },
      "门缝里透出幽幽的光。一具铁灰色、毫无生气的人偶，正被诡异的术法驱使着缓缓转身。那身形、那轮廓——",
      { say: "韩立", tone: "几乎脱口，又死死咬住", text: "……张铁？" },
      { aside: "挚友早已被害，尸身被魔道之术炼成了无魂的「铁奴」。七玄门的温情，原来从头到尾都是一张网。" },
      "你退回阴影里，指甲掐进掌心，一声不敢出。这一刻，你彻底认清了脚下这条路有多冷。",
    ],
    onArrive(s) {
      State.setFlag("zhangtie_dead");
      s.demon += 20; s.mood -= 25;
      Engine.toast("张铁惨死、炼成铁奴，你心境剧震", true);
    },
    choices: [
      { text: "强忍悲愤，暗自筹谋", hint: "万全准备，方能一击", next: true },
    ],
  },

  /* ---- B5 夺舍真相 → 决战准备 ---- */
  {
    id: "showdown_prep",
    cond: (s) => s.flags.zhangtie_dead,
    title: "夺舍之谋",
    text: [
      "拼凑起所有线索，那个深埋的真相终于浮出水面：墨大夫这具躯壳里，附着一缕名为「余子童」的修士残魂。",
      { aside: "余子童元神受损，又夺不了墨大夫这具承不住灵力的凡躯。于是……" },
      "于是他借墨大夫之手养你、授你《长春功》，把你的身躯一步步炼成最趁手的夺舍容器。等的，就是有朝一日鸠占鹊巢，占了你的身体重获新生。",
      { aside: "他自以为算无遗策——却不知你早已暗修到练气四层，更不知你手里藏着那只小绿瓶。" },
      "硬拼，绝无胜算。你不动声色，用小绿瓶催熟墨大夫药圃里的毒草，又日夜苦练那卷诡谲的「眨眼剑法」。",
      { say: "韩立", tone: "心中冷然", text: "想夺我的身子……得先问过我手里的毒。" },
      "一张死局，就此铺开。只等那夺舍之夜降临。",
    ],
    onArrive(s) {
      State.setFlag("showdown_ready");
      if (!s.spells.includes("zhenhun")) s.spells.push("zhenhun");
      if (!s.spells.includes("feizhen")) s.spells.push("feizhen");
      if (!s.spells.includes("zhayan_lian")) s.spells.push("zhayan_lian");
      State.give("anqi", 3);
      Engine.toast("习得运功镇魂、暗器飞针、眨眼连击；得暗器×3。去小绿瓶催熟毒草备战");
    },
    choices: [
      { text: "布下死局，静待夺舍之夜", hint: "进入决战", next: true },
    ],
  },

  /* ---- B6 反杀墨大夫（三阶段战斗）---- */
  {
    id: "showdown",
    cond: (s) => s.flags.showdown_ready,
    where: "yaolu",
    objTitle: "夺舍之夜将至",
    objHint: "回到「墨大夫药庐」，了结这场夺舍之局。",
    title: "夺舍之夜",
    text: [
      { scene: "药庐 · 子夜" },
      "烛火无故熄灭。黑暗里，墨大夫缓缓直起佝偻的背，浑浊的眼睛亮起一种贪婪而陌生的光。",
      { say: "墨大夫", tone: "声音不再苍老，阴冷彻骨", text: "乖徒儿，养了你这么些年……这具好皮囊，也该还给为师了。" },
      { aside: "来了。你心跳如鼓，面上却古井无波——这一刻，你已等了太久。" },
      "眨眼剑法、催熟的剧毒、藏在袖中的暗器，还有这数年隐忍苦修的功力……全得用上。成败，就在今夜。",
      { beat: "——" },
      "（铁奴百毒不侵，须正面破之；余子童元神非血肉，唯运功镇魂可灭。备得越足，胜算越大。）",
    ],
    choices: [
      {
        text: "拔剑，决一死战！",
        hint: "进入三阶段战斗。毒草/暗器即你的底牌，带得越多越稳",
        resolve: "showdown_win",
      },
    ],
  },

  /* ============ 第三幕 · 帮派之争 ============ */

  /* ---- C0 顶替墨大夫身份，蛰伏 ---- */
  {
    id: "take_identity",
    cond: (s) => s.flags.modafu_dead,
    title: "李代桃僵",
    text: [
      "墨大夫的尸身渐渐冷却，余子童那缕不甘的残魂也已被你彻底镇灭。药庐里重归死寂。",
      { aside: "声张吗？不。一个练气小修在七玄门这样的门派眼里，轻如草芥。这桩事，谁都不能知道。" },
      "你做了一个大胆的决定——索性顶替墨大夫的身份活下去。对外，你仍是那个深居简出、医毒双绝的「墨大夫」；暗里，你是这门中唯一无人知晓的修仙者。",
      "你收殓了遗物：储物袋、灵石、灵药、毒方、《长春功》的后续口诀，还有那具沉默的尸傀——日后随你闯荡的「曲魂」。",
      { say: "韩立", tone: "对着铜镜里那张陌生的老脸，低声", text: "委屈你了，张铁。从今往后，你我兄弟，再不分离。" },
      "此后数年，你低调行医，潜心修炼，悄悄积蓄着毒、暗器与底牌。山雨欲来，你需要时间。",
    ],
    onArrive(s) {
      State.give("lingshi", 5);
      State.give("ningshen_dan", 2);
      State.setFlag("got_quhun");
      State.setFlag("is_modafu");
      Engine.assignTask("wolf_raid", 12);
      Engine.toast("你顶替墨大夫身份，得曲魂相随。继续修炼以备将来");
    },
    choices: [
      { text: "深藏功与名，静待时机", hint: "继续修炼，提升修为", next: true },
    ],
  },

  /* ---- C1 野狼帮冲突 ---- */
  {
    id: "gang_conflict",
    cond: (s) => s.realmIndex >= 5,
    where: "wuting",
    objTitle: "蛰伏待时",
    objHint: "继续修炼至练气六层。修为既成，去「演武厅」探听门派局势。",
    title: "野狼帮",
    text: [
      { scene: "数年后 · 演武厅" },
      "门外早已不太平。野狼帮在帮主贾天龙麾下日渐坐大，为争夺七玄门治下几座富庶城镇的税赋，与门派屡屡冲突，前后交手十余次，互有死伤。",
      { say: "小算盘", tone: "压低声音", text: "墨大夫，您是没瞧见……野狼帮那帮人，一次比一次凶。门里三位师叔都坐不住了。" },
      { aside: "起初不过是凡俗江湖的厮杀。可你嗅到一丝不安——贾天龙的野心，似乎不止于几座城镇。" },
      "山雨欲来，风满楼。气氛一日紧过一日。",
    ],
    onArrive(s) { State.setFlag("gang_war"); Engine.meetNpc("xiaosuanpan", "门中管事弟子，消息灵通。"); Engine.meetNpc("jiatianlong", "野狼帮帮主，野心勃勃。"); },
    choices: [
      { text: "暗中戒备，留意局势", hint: "继续", next: true },
    ],
  },

  /* ---- C2 金光上人登场，师叔落败 ---- */
  {
    id: "jinguang_arrives",
    cond: (s) => s.flags.gang_war,
    title: "金光上人",
    text: [
      { scene: "七玄门 · 校场" },
      "果然，贾天龙亮出了底牌——他重金请来一名修仙者：青苓来的矮胖和尚，「金光上人」。",
      { say: "金光上人", tone: "金光绕身，睥睨众人", text: "七玄门？也配？今日，便让尔等见识见识何为仙法。" },
      "金符、剑符、金钟罩，道道术法璀璨夺目。三位武艺最高的师叔联手而上——",
      { beat: "——" },
      "片刻之间，尽数被击倒在地。门派危在旦夕，眼看就要被血洗。",
      { aside: "满场绝望。可无人知道，这门中还藏着一个修仙者。那就是你——「墨大夫」。" },
    ],
    onArrive(s) {
      State.setFlag("jinguang_appeared");
      Engine.meetNpc("jinguang", "贾天龙重金请来的修仙杀手。");
      if (!s.spells.includes("zhayan_lian")) s.spells.push("zhayan_lian");
      if (!s.spells.includes("feizhen")) s.spells.push("feizhen");
      State.give("anqi", 4);
      State.give("duyao_cao", 2);
      Engine.toast("金光上人重创七玄门！备好毒与暗器，准备出手");
    },
    choices: [
      { text: "不能再等——出手！", hint: "硬拼非其对手，唯靠毒、暗器与算计", next: true },
    ],
  },

  /* ---- C3 反杀金光上人（战斗）---- */
  {
    id: "jinguang_fight",
    cond: (s) => s.flags.jinguang_appeared,
    title: "暗算金光上人",
    text: [
      { aside: "正面硬拼，你绝非这和尚的对手。但修仙之争，从来不是比谁拳头硬——而是比谁算计更深、准备更足、出手更狠。" },
      "你以「墨大夫」医者的身份从容近身，谁也不会提防一个佝偻的老药师。就在咫尺之间——",
      { say: "韩立", tone: "心中默念", text: "金钟罩再固，也挡不住由内而发的毒。" },
      "催熟的剧毒、淬毒的暗器，尽数招呼上去。一击不中，便是粉身碎骨；可一旦得手……",
    ],
    choices: [
      {
        text: "毒、暗器、算计——一击毙命！",
        hint: "进入战斗。毒草/暗器越足越稳；硬拼必败",
        resolve: "jinguang_win",
      },
    ],
  },

  /* ---- C4 夺升仙令，离门赴黄枫谷（本篇收尾）---- */
  {
    id: "arc_end",
    cond: (s) => s.flags.jinguang_dead,
    title: "升仙令 · 离门",
    text: [
      { scene: "七玄门 · 山门外" },
      "金光上人到死都瞪大着眼——他怎么也想不通，自己竟会折在一个不起眼的门派药师手里。",
      "你从他身上搜得宝物：升仙令、金符、剑符、金钟罩——皆是你做梦都不敢想的修仙之资。",
      { aside: "尤其这枚「升仙令」……它是踏入更高门派、求取筑基机缘的凭证。我的机会，到了。" },
      "你最后回望了一眼这座困了你数年的七玄门。这里有过暖意，也有过欺骗与杀机。",
      { say: "韩立", tone: "极轻", text: "张铁，飞雨……后会有期。" },
      "转身，山风扑面。前方是黄枫谷，是那道横亘在练气与筑基之间的天堑。凡人之路，仍在脚下延伸。",
      { scene: "七玄门篇 · 终　（黄枫谷篇 · 筑基之路，敬请期待）" },
    ],
    onArrive(s) {
      State.give("shengxian_ling", 1);
      State.give("lingshi", 10);
      State.setFlag("arc1_complete");
      // 篇章契约：通关解锁下一章
      if (typeof Chapters !== "undefined") {
        const next = Chapters.active().nextChapter;
        if (next) Chapters.unlock(next);
      }
      Engine.toast("七玄门篇通关！夺得升仙令，启程黄枫谷");
    },
    choices: [
      { text: "持升仙令，奔赴黄枫谷", hint: "完成本篇", next: "end" },
    ],
  },
];

window.STORY = STORY;
