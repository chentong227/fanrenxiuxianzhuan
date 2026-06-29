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
    text(s) {
      const t = [
        { amb: "wind" },
        { shot: "establish" },
        "你叫韩立，青牛镇韩家老二。家中清贫，几亩薄田勉强糊口，年成不好时连盐都吃不起。",
        "这年，在七玄门做事的三叔回乡省亲。他见你机灵懂事，私下对你爹娘提议——",
        { shot: "pushIn" },
        { say: "三叔", tone: "压低了声音，带着几分得意", text: "七玄门正招收记名弟子，管吃管住，每月还有例钱。二郎这孩子机灵，何不让他去碰碰运气？" },
        { shot: "pullOut" },
        "爹娘犹豫，你却已动了心——若能进了那高门大派，家里的日子或许就能好过些。",
      ];
      return t;
    },
    onArrive(s) { State.setFlag("at_village"); },
    choices: [
      { text: "拜别爹娘，随三叔去七玄门", hint: "踏出青牛镇", next: true },
      { text: "临行前，偷偷揣一包干粮盐巴", hint: "穷家孩子，路上不能空着手",
        effect(s) {
          State.give("lingshi", 1);
          Engine.writeLedger("village_provisions", "离家前偷偷揣了干粮盐巴——穷家孩子的谨慎");
          return { text: "你趁爹娘不注意，往怀里塞了几块干粮和一小包盐巴。三叔见了，笑而不语。", kind: "good" };
        },
        next: true },
      { text: "向三叔细问七玄门的底细", hint: "知己知彼，方能踏稳第一步",
        effect(s) {
          s.skills = s.skills || {}; s.skills.scouting = (s.skills.scouting || 0) + 1;
          Engine.writeLedger("village_inquiry", "离家前向三叔细问七玄门底细——天生谨慎");
          return { text: "一路上你拉着三叔问了个底朝天：门中有多少弟子？谁说了算？药庐是干什么的？三叔被你问得直笑：「你这娃儿，心眼倒多。」", kind: "good" };
        },
        next: true },
    ],
  },

  /* ---- A1 赴考途中，结识张铁 ---- */
  {
    id: "journey",
    title: "赴 考",
    text(s) {
      const t = [
        { amb: "wind" },
        { shot: "establish" },
        "出了青牛镇，山路迢迢。同行的还有几个各乡来应试的少年。",
      ];
      // 钩子：离家前向三叔打听过七玄门底细 → 韩立已有认知
      if (s.flags.village_inquiry) {
        t.push("三叔路上说的那些——门中弟子百余人、掌门姓王、药庐在北坡——你一一记在心里。有了底，看这山路便不觉茫然。");
      } else {
        t.push(`你对七玄门一无所知，只凭三叔一句「管吃管住」便上了路。前路如何，全凭造化。`);
      }
      t.push(
        "其中一个虎背熊腰、憨厚老实的少年叫张铁，与你一见投缘。一路上你俩互相照应，渐成好友。",
        { shot: "pushIn" },
        { say: "张铁", tone: "挠着头", text: "听说七玄门收徒极严，十个里取不了一个。" },
      );
      // 钩子：打听过底细 → 韩立能回应张铁
      if (s.flags.village_inquiry) {
        t.push({ aside: "十个取一个……三叔说过，选拔考筋骨、悟性、胆识三项。你资质平平，唯有胆识一途，或可一搏。" });
      }
      t.push(
        { say: "张铁", text: "不过……总得试试不是？我娘说了，考上了顿顿有白面馍。" },
        { aside: "顿顿有白面馍……这倒是和我想到一块儿去了。" },
      );
      // 钩子：离家揣了干粮 → 路上分给张铁
      if (s.flags.village_provisions) {
        t.push("你从怀里掏出几块干粮递给张铁。他憨憨一笑，也不客气，三口两口便吞了。\n「韩立，你这人实在。」张铁拍着胸脯，「以后你就是我兄弟。」");
      }
      return t;
    },
    onArrive(s) {
      s.location = "road";
      Engine.meetNpc("zhangtie", "你与他一见投缘，结伴同行。");
    },
    choices: [
      { text: "与张铁结伴，同赴选拔", hint: "继续", next: true },
      { text: "路上暗中观察同行少年的身手深浅", hint: "知己知彼",
        effect(s) {
          s.skills = s.skills || {}; s.skills.scouting = (s.skills.scouting || 0) + 1;
          Engine.writeLedger("journey_observe", "赴考路上暗中观察同行少年——探知本能");
          return { text: "一路上你不动声色地打量同行的少年们。有人筋骨强健，有人步履轻盈，也有人跟你一样不起眼。你把每个人的长处短处都默默记在心里。", kind: "good" };
        },
        next: true },
      { text: "教张铁几招防身的小手法", hint: "兄弟互助",
        effect(s) {
          Engine.writeLedger("journey_help_zhangtie", "赴考路上教张铁几招防身手法——兄弟情谊");
          s.mood = Math.min(s.moodMax || 100, (s.mood || 0) + 5);
          return { text: "张铁憨厚，功夫底子差，你便教他几招简单实用的防身手法。他学得笨，却学得认真，一边练一边咧嘴笑：「韩立，有你这兄弟，我心里踏实多了。」", kind: "good" };
        },
        next: true },
    ],
  },

  /* ---- A2 入门选拔 ---- */
  {
    id: "exam",
    title: "七玄门 · 入门选拔",
    onArrive(s) {
      s.location = "shanmen"; State.setFlag("joined_sect");
      // 远雷·离家准备兑现（铁律3）：当年那点谨慎，在初入门的关口有了回响——点名出处
      if (Engine.settleLedger("village_provisions", "补考那半年最难捱，灵石早花尽、米缸见了底——亏得离家时偷揣的那包干粮盐巴撑着，没在山门外先饿垮。穷家孩子的那点谨慎，原来是保命的本钱")) {
        s.mood = Math.min(s.moodMax, s.mood + 2);
      }
      if (Engine.settleLedger("village_inquiry", "三叔在路上被你问出的那些门道——选拔考筋骨悟性胆识三项、药庐是冷灶——临到场上桩桩对得上。知己知彼，让你这资质平平的杂役坯子没在第一关就慌了手脚")) {
        s.mood = Math.min(s.moodMax, s.mood + 2);
      }
      if (Engine.settleLedger("journey_observe", "赴考路上默记下的那些少年长短，到了选拔场全派上用场——谁筋骨强、谁步子虚，你心里有数，连自己几斤几两也照得清楚。这份探知的本能，从踏出青牛镇就开始磨了")) {
        s.mood = Math.min(s.moodMax, s.mood + 2);
      }
      if (Engine.settleLedger("exam_train_body", "补考那半年夜夜苦练的筋骨，再试时结实得连考官都多看一眼——天资不够，毅力来凑。挤进记名弟子名册的最后那一把力气，是自己一拳一拳攒出来的")) {
        s.mood = Math.min(s.moodMax, s.mood + 2);
      }
    },
    text(s) {
      const t = [
        { shot: "establish" },
        "七玄门依山而建，气派非凡。选拔场上人头攒动，你和张铁夹在其中，显得格外不起眼。",
      ];
      // 钩子：赴考路上观察过同行少年 → 到了选拔场能分辨强弱
      if (s.skills && s.skills.scouting >= 1) {
        t.push({ aside: "你扫了一眼场上——那个步履轻盈的少年筋骨不错，那个沉默寡言的或许悟性高。至于你和张铁……确实不起眼。" });
      }
      t.push(
        "测筋骨、考悟性、试胆识……你二人资质平平，初试竟未能入选。",
        { shot: "pushIn" },
      );
      // 钩子：路上教过张铁防身 → 张铁胆识项多一分底气
      if (s.flags.journey_help_zhangtie) {
        t.push("胆识一项，张铁竟比你得分高——你教他的那几招防身手法，让他面对试胆时多了几分底气。他憨笑：「韩立，多亏你路上教我那几下！」");
      }
      t.push(
        "眼看就要被刷下，你不肯认命，硬着头皮求得一个补考的机会。半年后再试，凭着一股韧劲，你和张铁终于挤进了记名弟子的名册。",
      );
      return t;
    },
    choices: [
      { text: "入门记名，正式踏入七玄门", hint: "继续", next: true },
      { text: "补考半年间，苦练筋骨体魄", hint: "资质不够，毅力来凑",
        effect(s) {
          s.hpMax = Math.round(s.hpMax * 1.05);
          s.hp = s.hpMax;
          Engine.writeLedger("exam_train_body", "补考半年间苦练筋骨——以毅力补天资");
          return { text: "初试落选后的半年里，你白天帮家里干活，夜里在院子里苦练筋骨。再试之时，你的体魄比半年前结实了不少，连考官都多看了你一眼。", kind: "good" };
        },
        next: true },
    ],
  },

  /* ---- A3 拜师墨大夫 ---- */
  {
    id: "intro",
    title: "拜师 · 墨大夫",
    text(s) {
      const t = [
        { scene: "七玄门 · 药庐" },
        { amb: "candle" },
        { shot: "establish" },
        "选拔的喧嚣散去，你和张铁被一名枯瘦老者叫到跟前。他便是门中以医毒闻名、性情古怪的墨大夫。",
        { shot: "pushIn" },
        { say: "墨大夫", tone: "打量着你，忽然咳了两声", text: "你二人资质平平，却有股不肯认命的韧劲……也罢，就留在我药庐做个药童吧。" },
        { sfx: "page" },
        "他枯枝似的手指递来一卷泛黄的功法。",
        { say: "墨大夫", text: "这《长春功》，你且用心修习。每练成一层，我便赏你纹银。" },
        { aside: "纹银……家里若能宽裕些就好了。你压下心头的念头，恭敬接过。" },
        "自此你住进药庐，日里辨药煎药，闲时打坐修《长春功》。修仙之路，就在这草药的苦香里，悄然开端。",
      ];
      if (s.skills && s.skills.scouting >= 1) {
        t.push({ aside: "资质平平……他在说张铁，也在说你。可选拔场上那些筋骨强健的少年，未必有你这股韧劲。墨大夫看人的眼光，倒不只在资质。" });
      }
      return t;
    },
    onArrive(s) {
      State.setFlag("met_modafu");
      s.location = "yaolu";
      Engine.meetNpc("modafu", "门中以医毒闻名的怪人，收你为药童。");
      Engine.assignTask("modafu_deadline", 24);
      Engine.toast("你拜入墨大夫门下，习《长春功》");
    },
    choices: [
      { text: "叩首谢恩，潜心修炼", hint: "开始自由修行", next: true },
      { text: "留心观察药庐中的药材布局", hint: "药童的本分，也是眼力",
        effect(s) {
          s.skills = s.skills || {}; s.skills.alchemy = (s.skills.alchemy || 0) + 1;
          Engine.writeLedger("intro_observe_herbs", "拜师后留心观察药庐药材——丹道启蒙");
          return { text: "你一边辨药煎药，一边暗暗记下药庐里每味药材的方位、气味和功效。墨大夫见了，只当你学得用心，却不知你记的是药理、看的是门道。", kind: "good" };
        },
        next: true },
      { text: "暗中留意墨大夫的日常行止", hint: "这师父……好得不太对劲",
        effect(s) {
          s.skills = s.skills || {}; s.skills.scouting = (s.skills.scouting || 0) + 1;
          State.setFlag("early_suspicion");
          Engine.writeLedger("intro_watch_modafu", "拜师后暗中留意墨大夫行止——直觉警觉");
          return { text: "你嘴上恭敬，心里却留了根弦。墨大夫何时出门、何时闭关、密室里传出的气味……你不动声色地记着。说不上为什么——只是这师父待你太好了，好得让人不安。", kind: "event" };
        },
        next: true },
    ],
  },

  /* ============ 第二幕 · 夺舍危机 ============ */

  /* ---- B1 结识厉飞雨 ---- */
  {
    id: "friends",
    cond: (s) => s.flags.adventured || s.cultivation >= 40,
    objTitle: "初入门径",
    objHint: "在药庐闭关修炼《长春功》，修为积累到一定程度自有机缘。",
    title: "同门之谊",
    text(s) {
      const t = [
        { scene: "演武厅" },
        { shot: "establish" },
        "药庐之外，你结识了同门厉飞雨——一个武学有成、性子爽朗的师兄。",
        { shot: "pushIn" },
        { say: "厉飞雨", emo: "laugh", tone: "拍着你肩膀大笑", text: "韩立，你这记性简直是天才！我练了三月的招式，你看两遍就会了！" },
        { aside: "你笑而不语。这哪是什么天才——是《长春功》练到些火候后，记忆愈发清明罢了。这等隐秘，自然不能与人说。" },
      ];
      // 钩子：结拜兄弟 → 厉飞雨和张铁的关系更近一层
      if (s.flags.sworn_brothers) {
        t.push("厉飞雨搂着张铁的肩：「咱们三兄弟，以后有福同享、有难同当！」张铁憋得脸通红，只会点头憨笑。");
      }
      t.push(
        "张铁却没这般顺遂。他无论如何引气不入体，《长春功》死死卡在第一层。",
        { say: "墨大夫", tone: "摇头", text: "你这身子骨，不是修仙的料。改修武体吧，练练象甲功，强身健骨也好。" },
      );
      // 钩子：早期警觉 → 韩立注意到墨大夫对张铁的安排别有深意
      if (s.flags.early_suspicion) {
        t.push({ aside: "墨大夫让张铁练象甲功……你说不上哪里不对，只觉得他看张铁的眼神，和看你时不一样——少了那份算计，多了几分随意。" });
      }
      t.push(
        { shot: "pullOut" },
        "张铁憨憨地应了，没半分怨言。三人意气相投，结为好友——这七玄门的日子，总算有了些暖意。",
      );
      return t;
    },
    onArrive(s) {
      State.setFlag("met_friends");
      Engine.meetNpc("lifeiyu", "爽朗仗义的同门师兄，武学有成。");
    },
    choices: [
      { text: "与好友同行历练", hint: "继续", next: true },
      { text: "向厉飞雨请教武学招式", hint: "他武学有成，正好偷师",
        effect(s) {
          State.setFlag("learned_from_lify");
          Engine.writeLedger("friends_learn_martial", "向厉飞雨请教武学——取长补短");
          return { text: "厉飞雨爽快，把几手看家招式都教了你。你学得快，他教得也开心——「韩立，你这悟性，练武可惜了！」你笑而不语。这几招虽是凡人武学，关键时候或许能救命。", kind: "good" };
        },
        next: true },
      { text: "与张铁、厉飞雨结为异姓兄弟", hint: "三人意气相投，不如就此结拜",
        effect(s) {
          State.setFlag("sworn_brothers");
          s.mood = Math.min(s.moodMax || 100, (s.mood || 0) + 10);
          Engine.writeLedger("friends_sworn", "与张铁、厉飞雨结为异姓兄弟——七玄门的暖意");
          return { text: "三人一拍即合，在演武厅后院焚香结拜。张铁最大为兄，厉飞雨次之，你最小。张铁憨笑：「以后就是亲兄弟了！」厉飞雨拍你肩：「谁欺负你，跟我说！」这一刻，七玄门的日子有了真正的暖意。", kind: "good" };
        },
        next: true },
    ],
  },

  /* ---- B2 得小绿瓶 ---- */
  {
    id: "bottle",
    cond: (s) => s.cultivation >= 70 || s.flags.adv_count >= 2,
    cg: "bottle",
    objTitle: "机缘暗至",
    objHint: "继续修炼或外出历练，修为渐深时自有造化登门。",
    title: "神秘小瓶",
    text(s) {
      const t = [
        { shot: "establish" },
        "一次外出，你于无意间得了一只不起眼的小绿瓶。",
        "瓶中残留着几滴神秘绿液。你试着将一株枯萎灵草投入瓶内——",
        { shot: "pushIn" },
        { fx: "flash", color: "#dff3ff", alpha: 0.4, ms: 500 },
        { fx: "burst", elem: "mu", n: 14 },
        { sfx: "chime" },
        "不过一夜，那灵草竟抽枝展叶，灵气盎然，仿佛被催着长了整整一季！",
      ];
      // 钩子：药理启蒙（alchemy>=1）→ 韩立立刻意识到此物的修仙价值
      if (s.skills && s.skills.alchemy >= 1) {
        t.push({ aside: "催熟灵草……你在药庐辨了这么久的药，从没见过这等手段。这不是凡间药理能解释的——此物，必是修仙界的异宝。" });
      } else {
        t.push("你心头剧跳，强压下狂喜。此物若善加利用……以你这平庸的四灵根，未必没有出头之日。");
      }
      t.push({ shot: "pullOut" });
      // 钩子：早期警觉 → 第一反应是「不能让墨大夫知道」
      if (s.flags.early_suspicion) {
        t.push({ aside: "此物绝不能让墨大夫知晓。他若知道你有这等异宝……你不敢想。" });
      }
      return t;
    },
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
    text(s) {
      const t = [
        { amb: "candle" },
        { shot: "establish" },
        "靠着小绿瓶催熟的灵药，你瞒着墨大夫，将《长春功》一路偷修到了练气四层。",
        "表面上，你仍是那个进境平平、按层领赏的笨拙药童；暗地里，你的修为早已远超墨大夫的预料。",
        { shot: "pushIn" },
        { sfx: "danger" },
      ];
      // 钩子：早期警觉 → 怀疑从模糊变为确认
      if (s.flags.early_suspicion) {
        t.push({ aside: "你早就觉得墨大夫不对劲。如今修为渐深，那些蛛丝马迹便越发清晰——他密室的气味、他看你的眼神、他授你《长春功》时的那份「用心」……这不是师恩，是图谋。" });
      } else {
        t.push("你愈发谨慎。墨大夫待你太好了——好得不像个寻常师父。这份反常，让你脊背发凉。");
      }
      // 钩子：向厉飞雨请教过武学 → 眨眼剑法已有武学根基
      if (s.flags.learned_from_lify) {
        t.push("厉飞雨教你的那几招凡人武学，如今与眨眼剑法融会贯通——近身搏杀，你比从前多了三分底气。");
      }
      return t;
    },
    onArrive(s) {
      State.setFlag("qi_layer_4");
      Engine.scheduleEvent("zhangtie_death", 3);  // 张铁外出，三月后归期不至 → 真相浮现
    },
    choices: [
      { text: "藏锋守拙，静观其变", hint: "继续", next: true },
      { text: "暗中加紧修炼，争取早日突破", hint: "实力不够，什么都是空谈",
        effect(s) {
          s.cultivation = (s.cultivation || 0) + 20;
          Engine.writeLedger("secret_cultivate_push", "暗修期间加紧修炼——以实力为底牌");
          return { text: "你将小绿瓶催熟的灵药尽数用于修炼，修为又精进了一截。墨大夫若真有不轨，你至少多一分自保之力。", kind: "good" };
        },
        next: true },
      { text: "试探墨大夫，看他对你的修为了解多少", hint: "知己知彼",
        effect(s) {
          s.skills = s.skills || {}; s.skills.scouting = (s.skills.scouting || 0) + 1;
          Engine.writeLedger("secret_cultivate_probe", "暗修期间试探墨大夫——摸底");
          return { text: "你故意在墨大夫面前露出半分修为破绽，观察他的反应。他似乎毫无察觉——又或者，是装作毫无察觉。你更加不安了。", kind: "event" };
        },
        next: true },
    ],
  },

  /* ---- B4 张铁之死 ---- */
  {
    id: "zhangtie",
    cg: "qixuan_ye",
    cond: (s) => s.flags.zhangtie_fated,
    objTitle: "挚友外出未归",
    objHint: "张铁奉命外出，归期将至。静待时日，留意他的下落。",
    title: "挚友失踪",
    text(s) {
      const t = [
        { scene: "数月后 · 深夜" },
        { amb: "night" },
        { shot: "establish" },
        "练象甲功的张铁奉墨大夫之命外出探查，此后再无音讯。门中只道他离门远游了。",
      ];
      // 钩子：结拜兄弟 → 悲痛更深
      if (s.flags.sworn_brothers) {
        t.push({ aside: "结拜时说过有难同当……可你连他出了什么事都不知道。这份无力感，比什么都冷。" });
      } else {
        t.push({ aside: "可你心里总堵着一块石头。张铁不是那种不辞而别的人。" });
      }
      t.push(
        "你四处打听，蛛丝马迹却都指向一个令你脊背发凉的方向。直到这一夜，你绕到墨大夫密室之外——",
        { beat: "……" },
        { fx: "flash", color: "#0a0a12", alpha: 0.45, ms: 320 },
        { show: "铁奴", text: "门缝里透出幽幽的光。一具铁灰色、毫无生气的人偶，正被诡异的术法驱使着缓缓转身。那身形、那轮廓——" },
        { shot: "shock" },
        { sfx: "danger" },
      );
      // 钩子：早期警觉 → 震惊中带着「果然」的冷意
      if (s.flags.early_suspicion) {
        t.push({ say: "韩立", tone: "咬紧牙关，眼中没有泪", text: "……果然。" });
        t.push({ aside: "你没有震惊——只有一种冰冷的「果然如此」。那个你暗中观察了许久的墨大夫，果然藏着这等丧尽天良的秘密。" });
      } else {
        t.push({ say: "韩立", tone: "几乎脱口，又死死咬住", text: "……张铁？" });
      }
      t.push(
        { bgm: "sorrow" },
        { wait: 500 },
        { aside: "挚友早已被害，尸身被魔道之术炼成了无魂的「铁奴」。七玄门的温情，原来从头到尾都是一张网。" },
      );
      // 钩子：结拜兄弟 → 对曲魂的誓言不同
      if (s.flags.sworn_brothers) {
        t.push("你退回阴影里，指甲掐进掌心。结拜时焚的香还在鼻尖——「有难同当」……你连他的难都没替他挡住。但从今往后，这具铁奴，你定要带走。兄弟，我不会再让你落在旁人手里。");
      } else {
        t.push("你退回阴影里，指甲掐进掌心，一声不敢出。这一刻，你彻底认清了脚下这条路有多冷。");
      }
      return t;
    },
    onArrive(s) {
      State.setFlag("zhangtie_dead");
      s.demon += 20; s.mood -= 25;
      // 远雷·结拜之情兑现（铁律3）：当年那炷结拜香，在兄弟惨死这一刻结出最沉的果——点名出处
      if (Engine.settleLedger("friends_sworn", "结拜时焚的那炷香还在鼻尖，张铁却已被炼成了铁奴。异姓兄弟的誓言「有难同当」，此刻成了压在你心头一辈子的债——也成了你带走曲魂、走完这条路的执念")) {
        s.demon = Math.min(100, s.demon + 5);   // 兄弟之死，心魔更重
      }
      if (Engine.settleLedger("journey_help_zhangtie", "赴考路上教他那几招防身手法，护得了他选拔场上的胆识，却护不住他在墨大夫手里的命。那句「有你这兄弟我心里踏实」言犹在耳——你教他的本事，终究太轻太浅")) {
        s.demon = Math.min(100, s.demon + 3);
      }
      Engine.toast("张铁惨死、炼成铁奴，你心境剧震", true);
    },
    choices: [
      { text: "强忍悲愤，暗自筹谋", hint: "万全准备，方能一击", next: true },
    ],
  },

  /* ---- B5 夺舍真相 → 决战准备 ---- */
  {
    id: "showdown_prep",
    cg: "qixuan_ye",
    cond: (s) => s.flags.zhangtie_dead,
    title: "夺舍之谋",
    text(s) {
      const t = [
        { bgm: "tense" },
        "拼凑起所有线索，那个深埋的真相终于浮出水面：墨大夫这具躯壳里，附着一缕名为「余子童」的修士残魂。",
        { aside: "余子童元神受损，又夺不了墨大夫这具承不住灵力的凡躯。于是……" },
        "于是他借墨大夫之手养你、授你《长春功》，把你的身躯一步步炼成最趁手的夺舍容器。等的，就是有朝一日鸠占鹊巢，占了你的身体重获新生。",
      ];
      // 钩子：早期警觉 → 「我早该想到」
      if (s.flags.early_suspicion) {
        t.push({ aside: "密室的气味、反常的师恩、张铁的失踪……所有碎片终于拼合在一起。我早该想到的——只是不愿相信罢了。" });
      } else {
        t.push({ aside: "他自以为算无遗策——却不知你早已暗修到练气四层，更不知你手里藏着那只小绿瓶。" });
      }
      // 钩子：以武为先 → 眨眼剑法准备台词
      if (s.flags.showdown_martial_focus) {
        t.push("硬拼，绝无胜算。你日夜苦练眨眼剑法——厉飞雨教的凡人武学底子，此刻成了你磨砺剑招的根基。近身一剑，必须快到他反应不过来。");
      } else {
        t.push("硬拼，绝无胜算。你不动声色，用小绿瓶催熟墨大夫药圃里的毒草，又日夜苦练那卷诡谲的「眨眼剑法」。");
      }
      t.push(
        { shot: "focusLeft" },
      );
      // 钩子：以毒为先 vs 以武为先 → 心中冷然台词不同
      if (s.flags.showdown_prep_poison) {
        t.push({ say: "韩立", tone: "心中冷然", text: "想夺我的身子……得先问过我手里这些毒。" });
      } else if (s.flags.showdown_martial_focus) {
        t.push({ say: "韩立", tone: "心中冷然", text: "想夺我的身子……得先接下我这一剑。" });
      } else {
        t.push({ say: "韩立", tone: "心中冷然", text: "想夺我的身子……得先问过我手里的毒。" });
      }
      t.push("一张死局，就此铺开。只等那夺舍之夜降临。");
      return t;
    },
    onArrive(s) {
      State.setFlag("showdown_ready");
      if (!s.spells.includes("zhenhun")) s.spells.push("zhenhun");
      if (!s.spells.includes("feizhen")) s.spells.push("feizhen");
      State.give("anqi", 3);
      Engine.toast("习得运功镇魂、暗器飞针；得暗器×3。去小绿瓶催熟毒草备战");
    },
    choices: [
      { text: "布下死局，静待夺舍之夜", hint: "进入决战", next: true },
      { text: "以毒为先——催熟剧毒，多备暗器", hint: "毒与暗器，是你唯一的优势",
        effect(s) {
          State.give("duyao_cao", 2);
          State.give("anqi", 2);
          Engine.writeLedger("showdown_prep_poison", "决战前以毒为先——催熟剧毒、多备暗器");
          return { text: "你将小绿瓶催熟的毒草尽数炼成剧毒，又淬了数枚暗器。这些东西，就是你以弱胜强的本钱。", kind: "good" };
        },
        next: true },
      { text: "以武为先——苦练眨眼剑法，磨砺身法", hint: "近身搏杀，唯快不破",
        effect(s) {
          State.setFlag("showdown_martial_focus");
          Engine.writeLedger("showdown_prep_martial", "决战前苦练眨眼剑法——以武为先");
          return { text: "你日夜苦练眨眼剑法，将每一招的出剑角度、身法变化都打磨到极致。墨大夫若要夺舍，近身之际就是你唯一的机会——那一剑，必须快到他反应不过来。", kind: "good" };
        },
        next: true },
    ],
  },

  /* ---- B6 反杀墨大夫（三阶段战斗）---- */
  {
    id: "showdown",
    cond: (s) => s.flags.showdown_ready,
    where: "yaolu",
    cg: "duoshe",
    objTitle: "夺舍之夜将至",
    objHint: "回到「墨大夫药庐」，了结这场夺舍之局。",
    title: "夺舍之夜",
    text(s) {
      const t = [
        { scene: "药庐 · 子夜" },
        { amb: "candle" },
        { fx: "flash", color: "#000000", alpha: 0.5, ms: 300 },
        "烛火无故熄灭。黑暗里，墨大夫缓缓直起佝偻的背，浑浊的眼睛亮起一种贪婪而陌生的光。",
        { shot: "pushIn" },
        { sfx: "danger" },
        { say: "墨大夫", emo: "sinister", tone: "声音不再苍老，阴冷彻骨", text: "乖徒儿，养了你这么些年……这具好皮囊，也该还给为师了。" },
        { aside: "来了。你心跳如鼓，面上却古井无波——这一刻，你已等了太久。" },
        { wait: 500 },
      ];
      // 钩子：以毒为先 → 战前盘点更冷峻
      if (s.flags.showdown_prep_poison) {
        t.push("毒针淬好了，暗器藏在袖里，眨眼剑法已练到出剑无痕。催熟的剧毒、数年隐忍苦修的功力——全得用上。成败，就在今夜。");
      } else {
        t.push("眨眼剑法、催熟的剧毒、藏在袖中的暗器，还有这数年隐忍苦修的功力……全得用上。成败，就在今夜。");
      }
      t.push(
        { beat: "——" },
        "（铁奴百毒不侵，须正面破之；余子童元神非血肉，唯运功镇魂可灭。备得越足，胜算越大。）",
        { shot: "shock" },
        { fight: "showdown_win", guard: { hint: "毒草/暗器带得越多越稳" } },
      );
      return t;
    },
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
    text(s) {
      const t = [
        { amb: "candle" },
        { shot: "establish" },
        "墨大夫的尸身渐渐冷却，余子童那缕不甘的残魂也已被你彻底镇灭。药庐里重归死寂。",
        { aside: "声张吗？不。一个练气小修在七玄门这样的门派眼里，轻如草芥。这桩事，谁都不能知道。" },
        "你做了一个大胆的决定——索性顶替墨大夫的身份活下去。对外，你仍是那个深居简出、医毒双绝的「墨大夫」；暗里，你是这门中唯一无人知晓的修仙者。",
        "你收殓了遗物：储物袋、灵石、灵药、毒方、《长春功》的后续口诀，还有那具沉默的尸傀——日后随你闯荡的「曲魂」。",
      ];
      // 钩子：结拜兄弟 → 对曲魂的台词不同
      if (s.flags.sworn_brothers) {
        t.push(
          { bgm: "sorrow" },
          { shot: "pushIn" },
          { say: "韩立", tone: "对着铜镜里那张陌生的老脸，低声", text: "兄弟，结拜时说过有难同当。如今你走了，我替你走完这条路——从今往后，你我兄弟，再不分离。" },
        );
      } else {
        t.push(
          { bgm: "sorrow" },
          { shot: "pushIn" },
          { say: "韩立", tone: "对着铜镜里那张陌生的老脸，低声", text: "委屈你了，张铁。从今往后，你我兄弟，再不分离。" },
        );
      }
      t.push(
        { shot: "pullOut" },
      );
      // 钩子：药理启蒙（alchemy>=1）→ 收敛遗物时更从容
      if (s.skills && s.skills.alchemy >= 1) {
        t.push("你早有药理根基，收敛墨大夫遗物时比常人从容得多——那些毒方笔记你一看便知深浅，哪些是珍方、哪些是诱饵，分得清清楚楚。");
      } else {
        t.push("此后数年，你低调行医，潜心修炼，悄悄积蓄着毒、暗器与底牌。山雨欲来，你需要时间。");
      }
      // 钩子：早期警觉 → 对墨大夫遗书的冷评
      if (s.flags.early_suspicion) {
        t.push({ aside: "遗书里还夹着一张纸条——「暖阳宝玉在嘉元城墨府」。这老鬼到死都在算计，连解药都拿来当筹码。你将纸条收好，心里冷笑：你的算计，到此为止了。" });
      }
      return t;
    },
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
      { text: "收敛遗物时，细查墨大夫的毒方笔记", hint: "毒术也是本事，不学白不学",
        effect(s) {
          s.skills = s.skills || {}; s.skills.alchemy = (s.skills.alchemy || 0) + 2;
          State.give("duyao_cao", 1);
          Engine.writeLedger("identity_study_poison", "收敛遗物时细查墨大夫毒方笔记——毒术传承");
          return { text: "你翻遍墨大夫的遗物，找到几卷毒方笔记。这老鬼的医毒之术确实精湛——你将有用的方子一一抄录。日后这些毒方，或许能派上大用场。", kind: "good" };
        },
        next: true },
      { text: "以墨大夫身份行医，暗中打探门中虚实", hint: "新身份的好处，就是谁都不防你",
        effect(s) {
          s.skills = s.skills || {}; s.skills.scouting = (s.skills.scouting || 0) + 1;
          State.give("lingshi", 3);
          Engine.writeLedger("identity_practice_medicine", "以墨大夫身份行医——打探门中虚实");
          return { text: "你顶着墨大夫的身份行医问诊，门中弟子来找你看病，你一边把脉一边闲聊——谁跟谁有隙、野狼帮最近有何动静、三位师叔的脾气秉性……不出数月，门中的虚实你已摸得七七八八。", kind: "good" };
        },
        next: true },
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
    text(s) {
      const t = [
        { scene: "数年后 · 演武厅" },
        { bgm: "tense" },
        { shot: "establish" },
        "门外早已不太平。野狼帮在帮主贾天龙麾下日渐坐大，为争夺七玄门治下几座富庶城镇的税赋，与门派屡屡冲突，前后交手十余次，互有死伤。",
        { shot: "pushIn" },
      ];
      // 钩子：行医打探过门中虚实 → 小算盘带来的消息更详细
      if (s.flags.identity_practice_medicine) {
        t.push({ say: "小算盘", tone: "压低声音", text: "墨大夫，您之前问的那些，我都替您留意着——野狼帮新招了批亡命徒，贾天龙还跟青苓那边搭上了线。您是不知道，门里上上下下都慌了神。" });
        t.push({ aside: "你早有耳闻。行医数月，门中的虚实你已摸透——此刻小算盘带来的，不过是拼图的最后几块。" });
      } else {
        t.push({ say: "小算盘", tone: "压低声音", text: "墨大夫，您是没瞧见……野狼帮那帮人，一次比一次凶。门里三位师叔都坐不住了。" });
        t.push({ aside: "起初不过是凡俗江湖的厮杀。可你嗅到一丝不安——贾天龙的野心，似乎不止于几座城镇。" });
      }
      // 钩子：托小算盘盯野狼帮 → 已有情报
      if (s.flags.gang_use_xiaosuanpan) {
        t.push("你之前让小算盘盯着野狼帮——此刻他带来的情报果然派上了用场：野狼帮的人手分布、头目习性，你早已心中有数。");
      }
      t.push("山雨欲来，风满楼。气氛一日紧过一日。");
      return t;
    },
    onArrive(s) { State.setFlag("gang_war"); Engine.meetNpc("xiaosuanpan", "门中管事弟子，消息灵通。"); Engine.meetNpc("jiatianlong", "野狼帮帮主，野心勃勃。"); },
    choices: [
      { text: "暗中戒备，留意局势", hint: "继续", next: true },
      { text: "加紧修炼，不问外事", hint: "实力不够，什么局都是白搭",
        effect(s) {
          s.cultivation = (s.cultivation || 0) + 15;
          Engine.writeLedger("gang_focus_cultivate", "野狼帮冲突之际加紧修炼——不问外事");
          return { text: "你两耳不闻窗外事，一心只在药庐打坐修炼。外面的纷争再吵，也吵不进你的静室。修为又精进了几分。", kind: "good" };
        },
        next: true },
      { text: "让小算盘替你留意野狼帮的动向", hint: "消息灵通的人，用起来最顺手",
        effect(s) {
          s.skills = s.skills || {}; s.skills.scouting = (s.skills.scouting || 0) + 1;
          Engine.writeLedger("gang_use_xiaosuanpan", "托小算盘留意野狼帮动向——借力打力");
          return { text: "你私下给了小算盘几块灵石，让他替你盯着野狼帮的动静。他消息灵通，果然不负所托——不出半月，野狼帮的人手分布、头目习性，你都摸了个清楚。", kind: "good" };
        },
        next: true },
    ],
  },

  /* ---- C2 金光上人登场，师叔落败 ---- */
  {
    id: "jinguang_arrives",
    cond: (s) => s.flags.gang_war,
    title: "金光上人",
    text(s) {
      const t = [
        { scene: "七玄门 · 校场" },
        { shot: "establish" },
        "果然，贾天龙亮出了底牌——他重金请来一名修仙者：青苓来的矮胖和尚，「金光上人」。",
        { shot: "shock" },
        { fx: "flash", color: "#ffd27a", alpha: 0.35, ms: 320 },
        { sfx: "castJin" },
        { say: "金光上人", tone: "金光绕身，睥睨众人", text: "七玄门？也配？今日，便让尔等见识见识何为仙法。" },
        "金符、剑符、金钟罩，道道术法璀璨夺目。三位武艺最高的师叔联手而上——",
        { beat: "——" },
        { sfx: "hit" },
        { cam: "shake", px: 6 },
        "片刻之间，尽数被击倒在地。门派危在旦夕，眼看就要被血洗。",
        { shot: "pushIn" },
      ];
      // 钩子：托小算盘盯野狼帮 → 你早知贾天龙跟青苓搭上线
      if (s.flags.gang_use_xiaosuanpan) {
        t.push({ aside: "青苓来的修仙者……小算盘早说过贾天龙跟青苓那边搭上了线。你当时还不信——如今看来，这步棋你早就该料到。" });
      }
      // 钩子：向厉飞雨请教过武学 → 看到师叔落败更有感触
      if (s.flags.learned_from_lify) {
        t.push({ aside: "厉飞雨教的几招，师叔们也用过——可在真正的修仙者面前，凡人武学如纸糊一般。你更加确信：这条路，唯有修仙一途。" });
      } else {
        t.push({ aside: "满场绝望。可无人知道，这门中还藏着一个修仙者。那就是你——「墨大夫」。" });
      }
      return t;
    },
    onArrive(s) {
      State.setFlag("jinguang_appeared");
      Engine.meetNpc("jinguang", "贾天龙重金请来的修仙杀手。");
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
    cg: "jinguang",
    title: "暗算金光上人",
    text(s) {
      const t = [
        { aside: "正面硬拼，你绝非这和尚的对手。但修仙之争，从来不是比谁拳头硬——而是比谁算计更深、准备更足、出手更狠。" },
        "你以「墨大夫」医者的身份从容近身，谁也不会提防一个佝偻的老药师。就在咫尺之间——",
        { shot: "focusLeft" },
      ];
      // 钩子：以毒为先 → 毒备充足台词
      if (s.flags.showdown_prep_poison) {
        t.push({ say: "韩立", tone: "心中默念", text: "金钟罩再固，也挡不住由内而发的毒。毒草、暗器——我备得比谁都足。" });
      } else if (s.flags.showdown_martial_focus) {
        t.push({ say: "韩立", tone: "心中默念", text: "金钟罩再固，近身一剑也能破。眨眼剑法——厉飞雨教的底子，今日见真章。" });
      } else {
        t.push({ say: "韩立", tone: "心中默念", text: "金钟罩再固，也挡不住由内而发的毒。" });
      }
      t.push(
        { wait: 400 },
        "催熟的剧毒、淬毒的暗器，尽数招呼上去。一击不中，便是粉身碎骨；可一旦得手……",
        { sfx: "backstab" },
        { fight: "jinguang_win" },
      );
      return t;
    },
    choices: [
      {
        text: "毒、暗器、算计——一击毙命！",
        hint: "进入战斗。毒草/暗器越足越稳；硬拼必败",
        resolve: "jinguang_win",
      },
    ],
  },

  /* ---- C4 夺升仙令，离门远行（本篇收尾 → 离门远行章开启）---- */
  {
    id: "arc_end",
    cond: (s) => s.flags.jinguang_dead,
    cg: "departure",
    title: "升仙令 · 离门",
    text(s) {
      const t = [
        { scene: "七玄门 · 山门外" },
        { shot: "establish" },
        "金光上人到死都瞪大着眼——他怎么也想不通，自己竟会折在一个不起眼的门派药师手里。",
        "你从他身上搜得宝物：升仙令、金符、剑符、金钟罩——皆是你做梦都不敢想的修仙之资。",
        { aside: "尤其这枚「升仙令」……它是踏入更高门派、求取筑基机缘的凭证。我的机会，到了。" },
        { fx: "flash", color: "#bfe0ff", alpha: 0.3, ms: 300 },
        { sfx: "danger" },
      ];
      // 钩子：早期警觉 → 寒毒的伏笔不同
      if (s.flags.early_suspicion) {
        t.push("可夜里收功之时，一缕阴寒自丹田窜起。你早有预感——墨大夫传你《长春功》时埋的暗手，此刻终于发作了。遗书里写得明白：解药唯有墨家祖传的「暖阳宝玉」。");
        t.push({ aside: "我早该查的……密室的气味、功法里的暗手——这些线索我全看到了，却没来得及深究。也罢，去嘉元城解毒，正好替这老鬼了结因果。" });
      } else {
        t.push("可夜里收功之时，一缕阴寒自丹田窜起，冻得你指尖发麻——墨大夫临死的冷笑浮上心头。遗书里写得明白：他在传你功法时早埋了寒毒，解药唯有墨家祖传的「暖阳宝玉」。");
        t.push({ aside: "遗书末尾是一行小字：去岚州嘉元城墨府，解你的毒，也……替我安顿好她们。这老鬼，到死还要驱使我。" });
      }
      t.push(
        { bgm: "journey" },
        { shot: "pullOut" },
        "你最后回望了一眼这座困了你数年的七玄门。这里有过暖意，也有过欺骗与杀机。",
      );
      // 钩子：结拜兄弟 → 告别台词不同
      if (s.flags.sworn_brothers) {
        t.push({ say: "韩立", tone: "极轻", text: "张铁，飞雨……结拜时说过的，有福同享。升仙令在手，我替咱们三兄弟走出这条路。后会有期。" });
      } else {
        t.push({ say: "韩立", tone: "极轻", text: "张铁，飞雨……后会有期。" });
      }
      t.push(
        { wait: 500 },
        "转身，山风扑面。先去嘉元城解毒，再寻修仙人的踪迹——凡人之路，仍在脚下延伸。",
        { scene: "七玄门篇 · 终　——　离门远行 · 启" },
      );
      return t;
    },
    onArrive(s) {
      State.give("shengxian_ling", 1);
      State.give("lingshi", 10);
      State.setFlag("arc1_complete");
      State.setFlag("han_du");   // 寒毒在身：嘉元城主线的驱动力（暖阳宝玉可解）
      // 篇章契约：通关解锁下一章
      if (typeof Chapters !== "undefined") {
        const next = Chapters.active().nextChapter;
        if (next) Chapters.unlock(next);
      }
      Engine.toast("七玄门篇通关！寒毒在身——启程嘉元城");
    },
    choices: [
      { text: "收拾行装，南下嘉元城", hint: "点「舆图」→胥国，择嘉元城启程；寒毒不除，修行难安", next: "end" },
    ],
  },

  /* ============================================================
   *  离门远行章（旅途章）· 站一：嘉元城墨府
   *  考据：lore-departure.md（动漫7~8集：投信入府/彩环接待/独霸山庄欺门/
   *  铲除欧阳飞天/嫁妆暖阳宝玉/曲魂留府/太南小会线索）
   * ============================================================ */
  {
    id: "mo_arrive",
    cg: "mofu",
    cond: (s) => s.flags.arc1_complete && s.location === "jiayuan_city" && !s.flags.mo_met,
    objTitle: "南下嘉元城",
    objHint: "寒毒在身——点「舆图」择嘉元城启程，持遗信投墨府求暖阳宝玉。",
    title: "嘉元城 · 墨府投信",
    text(s) {
      const t = [
        { scene: "嘉元城 · 墨府门前" },
        { bgm: "town" },
        { cam: "zoom", scale: 1.06, ms: 1500 },
        { fx: "flash", color: "#f3e8c8", alpha: 0.16, ms: 600 },
        "三个月风尘，嘉元城到了。岚州第一大城名不虚传——街市喧腾，车马如流，比山下集镇繁华十倍不止。",
        "墨府坐落在城东，朱门高墙，只是门庭冷落，匾上漆色已有些剥落。你递上墨大夫的亲笔信。",
        { cam: "pan", to: { x: -3, y: 1 }, ms: 1100 },
        "片刻后，一个梳双髻的少女蹦跳着出来，上下打量你，眼睛骨碌碌地转。",
        { actor: "mocaihuan", enter: "left", emote: "scheme", name: "墨彩环" },
        { say: "墨彩环", emo: "scheme", text: "你就是我爹信里说的那个……土里土气的韩大哥？" },
        { aside: "……墨大夫信里到底写了什么。" },
        { say: "墨彩环", emo: "scheme", text: "娘说了，爹的弟子就是自家人。进来吧——哎对了，你包袱里那是什么香味？萦香丸？给我看看嘛，就看一眼！" },
      ];
      // 钩子：药理启蒙（alchemy>=1）→ 一眼认出萦香丸，反应不同
      if (s.skills && s.skills.alchemy >= 1) {
        t.push("你还没来得及反应，药丸已经到了她手里。萦香丸——你在墨大夫药庐辨药时见过方子，主治寒湿淤积，寻常药铺卖不出三块灵石。这位墨家小姐拿药的手法又快又准，古灵精怪里透着药理世家的底子。");
      } else {
        t.push("你还没反应过来，药丸已经到了她手里。这位墨家小姐古灵精怪，眼泪、撒娇、装可怜轮番上阵，半点不像深宅闺秀。");
      }
      t.push(
        "墨夫人款待了你。提及墨大夫的死讯时，她沉默良久，只说了一句：「他既有遗信安排，想必……早料到有这一日。」",
      );
      // 钩子：结拜兄弟 → 对墨大夫遗信的内心独白不同（他曾是结拜兄弟）
      if (s.flags.sworn_brothers) {
        t.push({ aside: "信中所托有二：取暖阳宝玉解我的寒毒；安顿墨家。这老鬼……到死都在驱使我。可他也是张铁的师父、我的结拜兄弟。这笔账，算不清。" });
      } else if (s.flags.early_suspicion) {
        t.push({ aside: "信中所托有二：取暖阳宝玉解我的寒毒；安顿墨家。这老鬼到死都在算计——遗书、解药、安顿家小，桩桩件件都拿捏得死死的。可暖阳宝玉是墨家祖传之物——如何开得了口？" });
      } else {
        t.push({ aside: "信中所托有二：取暖阳宝玉解我的寒毒；安顿墨家。可这暖阳宝玉是墨家祖传之物——如何开得了口？" });
      }
      t.push(
        { guide: {
          tag: "初来乍到 · 指路",
          title: "接下来：让日子往前走",
          hint: "城中暂无急务。安顿下来后，点「回墨府客房 · 调息」歇上些时日（或「客房打坐 · 潜修」用功），月份自会推进——这座没了主心骨的宅院，正被许多双眼睛盯着，静极必有变数找上门来。",
          focus: "rest",
          cta: "我记下了",
        } },
      );
      return t;
    },
    onArrive(s) {
      State.setFlag("mo_met");
      if (!s.metNpcs.includes("mocaihuan")) s.metNpcs.push("mocaihuan");
      Engine.addMilestone("嘉元城：墨府投信", "deed");
    },
    choices: [
      { text: "在墨府住下，从长计议", hint: "解毒之事，急不来" },
    ],
  },
  {
    id: "mo_crisis",
    cg: "mofu",
    cond: (s) => s.flags.mo_met && !s.flags.mo_warned && (s.flags.mo_months || 0) >= 1,
    objTitle: "墨府客居",
    objHint: "在墨府住下（嘉元城内调息/修炼度月）——这座没了主心骨的宅院，正被许多双眼睛盯着。",
    title: "墨府 · 暗流",
    text(s) {
      const t = [
        { scene: "墨府 · 夜" },
        { bgm: "tense" },
        "你在墨府住了些时日，寒毒一日重过一日——运功时丹田如坠冰窟。",
        { cam: "zoom", scale: 1.08, ms: 1100 },
        "这夜三更，院墙上瓦片轻响。你掀帘而出，只见两条黑影正撬后库的窗——手法娴熟，不是寻常毛贼。",
        { sfx: "danger" },
      ];
      // 钩子：以毒为先 → 飞针淬毒，出手更有底气
      if (s.flags.showdown_prep_poison) {
        t.push({ aside: "飞针早已淬好——在七玄门对付金光上人时你就备足了毒草暗器，这习惯一直没丢。今夜来犯的宵小，撞上的是淬毒的针。" });
      } else if (s.flags.learned_from_lify) {
        t.push({ aside: "厉飞雨教过你——夜间接敌，先听风辨位，再出手不迟。你屏息凝神，锁定了两条黑影的方位。" });
      }
      t.push(
        { beat: {
            kind: "window",
            prompt: "两条黑影正撬后库的窗——飞针已扣在你指间。",
            action: "袖中飞针·破空！",
            ms: 2600,
            onHit: {
              sfx: "backstab", cam: "shake", px: 9,
              fx: { fx: "burst", at: "center", elem: "jin", n: 14 },
              line: "你冷喝一声，袖中飞针破空！黑影中有人闷哼，两条人影翻墙而逃，墙头落下一块腰牌。",
            },
            onMiss: {
              sfx: "whiff", cam: "shake", px: 5,
              line: "你出手稍迟，飞针擦着夜色掠过——两条黑影已翻墙而逃，慌乱中墙头落下一块腰牌。",
            },
        } },
        "墨彩环披衣赶来，捡起腰牌看了一眼，脸色发白。",
        { actor: "mocaihuan", enter: "left", emote: "scheme", name: "墨彩环" },
        { say: "墨彩环", tone: "低声", text: "……是城里帮派的人。爹在时，岚州的这些豺狗没一个敢正眼看墨府。如今……" },
        "她没说下去。你环顾这座大宅——朱门依旧，可门里只剩孤儿寡母。墙外的嘉元城，已经换了天。",
      );
      // 钩子：曾以墨大夫身份行医 → 对帮派势力更了解
      if (s.flags.identity_practice_medicine) {
        t.push({ aside: "城里帮派……你冒充墨大夫行医时，听过嘉元城几股势力的名头。这些豺狗欺的是墨府没了顶梁柱——可他们不知道，这座宅子里住着一个比墨大夫更狠的角色。" });
      } else {
        t.push({ aside: "墨大夫遗书所托『安顿墨家』……我能杀退一两拨宵小，可我终究要走。这宅子需要的，是一道不走的影子。" });
      }
      return t;
    },
    onArrive(s) {
      State.setFlag("mo_warned");
    },
    choices: [
      { text: "「夫人，彩环，容我想想。」", hint: "解毒在即，去留之策也该定了" },
    ],
  },
  {
    id: "mo_resolve",
    cond: (s) => s.flags.mo_warned && !s.flags.han_du_cured,
    objTitle: "墨府之诺",
    objHint: "宵小已退，人心未安——墨家的报答，与下一程的线索，都在墨府等你。",
    title: "暖阳宝玉 · 嫁妆",
    text(s) {
      const t = [
        { scene: "墨府 · 后园" },
        { amb: "wind" },
        { shot: "establish" },
        "那夜之后，你在墨府明里暗里又退了两拨探子。嘉元城的豺狗们暂时缩回了爪子——但你看得出，它们只是在等你离开。",
        { shot: "pushIn" },
        "清晨，墨彩环在后园叫住你，双手捧着一只锦盒，盒中玉光温润——暖阳宝玉。",
        { say: "墨彩环", text: "给你。我知道你身上有寒毒，娘也同意了。" },
        { aside: "这是墨家祖传之物，更是她的嫁妆——" },
        { say: "墨彩环", tone: "故作轻快", text: "我们姐妹每人都有一份嫁妆，这玉是我的。我同娘说了——我不成亲，便不需要嫁妆了呀。" },
        { fx: "flash", color: "#ffd27a", alpha: 0.35, ms: 600 },
        { sfx: "heal" },
        "玉贴上丹田的一刻，暖流如春水化冰，寒毒节节败退。你长出一口气，多日的阴寒一扫而空。",
        { bgm: "sorrow" },
        { shot: "pushIn" },
        { say: "墨彩环", emo: "sad", tone: "轻声", text: "韩立……凡人，就真的不能修仙吗？" },
        "你答不上来。你也曾是凡人——你拼了命才摸到这条路的门槛。而对她来说，这条路生来就是断的。",
        { say: "墨彩环", text: "对了，你要找修仙的人吧？我听爹提过——岚州最南的太南山里，每隔几年有个「太南小会」，是修仙人的集市。算日子，快开了。" },
        { amb: "wind" },
        { shot: "pullOut" },
        "当夜，你独自登上后库房顶，取出了那杆曲魂幡。幡下的身影立在檐角的阴影里，像一座沉默的碑——那是张铁的遗蜕，如今唤作曲魂。",
      ];
      // 钩子：结拜兄弟 → 对曲魂/张铁的称呼与感情不同
      if (s.flags.sworn_brothers) {
        t.push({ aside: "兄弟，又是你。结拜时说过有难同当——如今我替你走完了墨大夫的路，你也替我守着这方寸之地。带 你走，刀口上多一分照应；留你下来，墨府便有一道不走的影子。该如何决断？" });
      } else {
        t.push({ aside: "带它走，刀口上多一分照应；留它下来，墨府便有一道不走的影子，护这一家人安稳度日。该如何决断？" });
      }
      // 钩子：早期警觉 → 对暖阳宝玉的冷评
      if (s.flags.early_suspicion) {
        t.push({ aside: "暖阳宝玉……墨大夫传功时埋的寒毒，解药恰是他家祖传之物。这老鬼连死后被人念着好都算到了——用一桩恩情换一桩托付，高明。可彩环的嫁妆换我的命，这笔账我记着，日后必还。" });
      }
      return t;
    },
    onArrive(s) {
      State.setFlag("han_du_cured");
      State.give("nuanyang_yu", 1);
      Engine.addMilestone("寒毒得解：暖阳宝玉（墨彩环的嫁妆）", "bigitem");
      Engine.addFame(8, "嘉元城里，墨府来了位深藏不露的韩公子");
    },
    // 抉择：曲魂随行 / 留府（动漫线）。留府埋燕家堡·京城篇远线（曲魂夺舍·奇虫榜）；
    // 随行则侧位不空。两路皆辞别墨府、南下太南山（修仙人的集市「太南小会」将开）。
    choices: [
      {
        text: "留曲魂驻守墨府——一道不走的影子，护这一家人",
        hint: "侧位将空缺；墨府从此有靠，此因将在燕家堡／京城篇结果（动漫线）",
        effect(s) {
          State.setFlag("quhun_stay_jiayuan");
          Engine.writeLedger("quhun_left_mo", "将曲魂（张铁遗蜕）留在墨府护卫");
          if (s.sideUnit && s.sideUnit.id === "zhangtie_corpse") s.sideUnit = null;
          Engine.addMilestone("曲魂留府：一道不走的影子", "deed");
          Engine.toast("曲魂留守墨府（侧位空缺——修仙路上，再觅新的依仗）");
          return { text: "「张铁，」你轻声唤它，「替我护着这家人。」它没有回答，只是握紧了拳，立回檐角的阴影里。墨彩环不知道檐上多了什么——她只觉得那夜之后，府里格外安心。\n你辞别墨府，南下太南山。", kind: "good" };
        },
      },
      {
        text: "带曲魂同行——刀口上飘零，也好有个照应",
        hint: "侧位随行不变；墨府的安危，只能托付给你退散豺狗的余威",
        effect(s) {
          Engine.writeLedger("quhun_with_han", "将曲魂（张铁遗蜕）带在身边，继续同行");
          if (s.sideUnit && s.sideUnit.id === "zhangtie_corpse") s.sideUnit.carry = true;
          Engine.addMilestone("曲魂随行：挚友之蜕，仍在身侧", "deed");
          Engine.toast("曲魂随行（侧位：刀口上多一分照应）");
          return { text: "你收起曲魂幡，檐角的身影无声落回你影子里——张铁这一回，仍跟着你走。你最后望了一眼墨府的灯火，转身没入夜色，南下太南山。", kind: "good" };
        },
      },
    ],
  },

  /* ============================================================
   *  离门远行章 · 站三：太南小会（修仙者的集市）
   *  考据：万小山讲修仙常识；丹药换长春功后篇；青纹道人阴谋被揭穿（黑煞教伏笔）；
   *  陈巧倩惊鸿一瞥（不交名——正式结识留给黄枫谷师姐线）。
   * ============================================================ */
  {
    id: "wan_meet",
    cond: (s) => s.flags.han_du_cured && s.location === "tainan_fair" && !s.flags.wan_met,
    objTitle: "南下太南谷",
    objHint: "修仙人的集市「太南小会」开了——点「舆图」择太南谷启程。",
    title: "太南小会 · 引路人",
    text(s) {
      const t = [
        { scene: "太南谷 · 小会" },
        { amb: "crowd" },
        { bgm: "fair" },
        { shot: "establish" },
      ];
      // 钩子：曾以墨大夫身份行医/托小算盘盯野狼帮 → 见过世面，不那么"土包子"
      if (s.flags.identity_practice_medicine || s.flags.gang_use_xiaosuanpan) {
        t.push("山谷两侧摊位绵延，灵光隐现。御器飞行的修士掠过头顶——你见过七玄门的江湖、嘉元城的帮派，到了这修仙人的集市，虽是头一遭，倒也没露怯。你不动声色地打量着摊位上的货色，把值钱的、唬人的，默默分了分档。");
      } else {
        t.push("山谷两侧摊位绵延，灵光隐现。御器飞行的修士掠过头顶，你竭力不让自己显得像个没见过世面的土包子——失败了。");
      }
      t.push(
        { shot: "pushIn" },
        { say: "万小山", text: "兄台第一次来小会吧？别盯着人家的飞剑看啦，会被当肥羊宰的！" },
        "搭话的是个二十出头的年轻人，圆脸带笑，背着鼓鼓囊囊的行囊。他自称万小山，修仙世家出身。",
        { say: "万小山", text: "家道中落啦，就剩我一个跑散修。哎，看兄台面生——头一回来小会吧？" },
        { say: "万小山", text: "我看兄台气息，是练气中后期？厉害呀！我家祖上说，散修最要紧三件事：一不露财，二不结仇，三——逛集市要带个识货的！走走走，我带你转转！" },
        "他半点不见外地拉着你穿行摊位之间：哪家符纸是真货，哪摊「灵丹」是糖丸，何处的功法残卷值得一翻——如数家珍。",
      );
      // 钩子：早期警觉 → 对万小山的热络更警惕
      if (s.flags.early_suspicion) {
        t.push({ aside: "修仙人多凉薄，这人倒是热得反常。墨大夫当年也热络——热络到把寒毒埋进了我的丹田。是真心善，还是另有所图……且看着吧。" });
      } else {
        t.push({ aside: "修仙人多凉薄，这人倒是热得反常。是真心善，还是另有所图……且看着吧。" });
      }
      t.push(
        { shot: "focusRight" },
        "人流里，一个着青衫的年轻女修与同伴擦肩而过，眉目清冷。",
        { say: "万小山", tone: "压低声音", text: "黄枫谷的师姐们也来了——七派的人都会来小会备货。" },
      );
      return t;
    },
    onArrive(s) {
      State.setFlag("wan_met");
      if (!s.metNpcs.includes("wanxiaoshan")) s.metNpcs.push("wanxiaoshan");
      Engine.writeLedger("wan_friend", "太南小会上，万小山热心为你引路");
      Engine.addMilestone("太南小会：初入修仙人的世界", "deed");
    },
    choices: [
      { text: "「有劳万兄。」（去逛集市）", hint: "行动栏「赶集」——长春功后篇就在某个摊上" },
    ],
  },
  {
    id: "qingwen_plot",
    cond: (s) => s.flags.wan_met && (s.flags.fair_bought || 0) >= 1 && !s.flags.qingwen_seen,
    objTitle: "小会风云",
    objHint: "集市上人多眼杂——你出手买了东西，有些目光便黏上来了。",
    title: "青纹道人 · 黑手",
    text(s) {
      const t = [
        { scene: "太南谷 · 小会" },
        { amb: "crowd" },
        { shot: "establish" },
        "你在摊位间出手了几次。不知何时起，一道目光黏在了你的储物袋上。",
        "一名山羊胡道人踱了过来，身后跟着个贼眉鼠眼的瘦子。道人拂尘一甩，笑容可掬。",
        { shot: "pushIn" },
        { say: "青纹道人", text: "这位小友面生得很。贫道青纹，添为散修盟的执事——小会的摊位费，小友可还没缴吧？" },
        "万小山脸色一变，刚要开口，你抬手拦住了他。",
      ];
      // 钩子：探知≥2 → 识破更从容
      if (s.skills && s.skills.scouting >= 2) {
        t.push({ aside: "散修盟？小会乃自发集市，何来执事。这道人方才一直在我身后三个摊位外打转——他的『拂尘』甩动时，瘦子的手就往人群里的储物袋摸。老套路了。" });
      } else {
        t.push({ aside: "散修盟？小会乃自发集市，何来执事。这道人方才一直在我身后三个摊位外打转——他的『拂尘』甩动时，瘦子的手就往人群里的储物袋摸。" });
      }
      t.push(
        { bgm: "tense" },
        { shot: "focusRight" },
        { say: "韩立", tone: "平静", text: "摊位费？也好。道长先把『散修盟』的印信请出来一观——再让你身后这位，把方才顺走的三只香囊还了。" },
        { wait: 400 },
        { sfx: "danger" },
        "四周霎时静了。瘦子脸色煞白，青纹道人眯起眼上下打量你，半晌，忽然嗤笑一声。",
        { say: "青纹道人", text: "好眼力。小友，路走宽些，来日方长——咱们，会再见的。" },
        "两人身形一晃，没入人流。万小山长出一口气，连拍胸口。",
        { say: "万小山", text: "好险好险……这两个是惯吃黑食的，被他们盯上的散修没几个有好下场。韩兄，你这双眼睛，绝了！" },
      );
      return t;
    },
    onArrive(s) {
      State.setFlag("qingwen_seen");
      Engine.writeLedger("qingwen_grudge", "太南小会上当众揭穿青纹道人的黑手");
      s.skills = s.skills || {}; s.skills.scouting = (s.skills.scouting || 0) + 2;
      // 日历锚：升仙大会两月后就在太南山开——修士云集小会，本就是为它而来
      s.flags.xianhui_due = State.absMonth() + 2;
      Engine.toast("探知+2（识破黑手）");
    },
    choices: [
      { text: "「来日方长。」", hint: "万小山：「对了韩兄，两月后升仙大会就在这太南山开——七派联合收徒！」" },
    ],
  },

  /* ---- 等会期：与万小山搭伴探山（同道系统首战——并肩过的人，才死得重）---- */
  {
    id: "wan_hunt",
    cond: (s) => s.flags.qingwen_seen && s.location === "tainan_fair" && !s.flags.wan_hunt_done
                 && State.absMonth() >= (s.flags.xianhui_due || 0) - 1,
    objTitle: "会期将近",
    objHint: "升仙大会开前的闲日子——万小山约你搭伴进山采药。",
    title: "搭伴探山",
    text(s) {
      const t = [
        { scene: "太南山 · 山道" },
        { amb: "wind" },
        { bgm: "journey" },
        { shot: "establish" },
        "离大会还有些日子。万小山一早来敲你的门，背着他那标志性的大行囊。",
        { say: "万小山", text: "韩兄韩兄！后山有片野灵草地，会期前去采一茬，正好凑明年的盘缠！你药理好，我认路——五五分账！" },
        "山道上他话没停过：家里以前的风光、第一次御器摔进泥塘、攒钱想买的那柄飞剑。",
        { say: "万小山", text: "等攒够了灵石，我就去考清虚门的外门——我这资质，散修是熬不出头的，可我爹说过，万家的人不能断了仙路！" },
      ];
      // 钩子：药理≥1 → 万小山夸药理更具体
      if (s.skills && s.skills.alchemy >= 1) {
        t.push({ aside: "药理好……墨大夫的药庐里学来的本事，到这儿成了搭伙的资本。倒也不亏。" });
      }
      t.push(
        { bgm: "combat" },
        { sfx: "danger" },
        { shot: "shock" },
        "话音未落，前方草丛一阵翻动——两头灵狼压低了身子，绿油油的眼睛盯着你们。",
        { say: "万小山", emo: "panic", tone: "声音发紧但没退", text: "韩、韩兄站我右边！我家传的火球术——照妖兽脸上招呼！" },
      );
      return t;
    },
    choices: [
      { text: "拔剑：「好。」", hint: "头一回，有人和你并肩而战", resolve: "wan_hunt_fight" },
    ],
  },

  /* ============================================================
   *  离门远行章 · 站四：升仙大会（收官）
   *  考据：灵根测试四属性伪灵根落选；高台远观结丹女修南宫婉（传说态）；
   *  会后森林万小山被三散修谋财追杀致死，韩立灭其二（一人遁走——远雷）；
   *  凭升仙令入黄枫谷。
   * ============================================================ */
  {
    id: "xianhui_open",
    cg: "xianhui_tai",
    cond: (s) => s.flags.qingwen_seen && State.absMonth() >= (s.flags.xianhui_due || 0) && s.location === "tainan_fair" && !s.flags.xianhui_done,
    objTitle: "升仙大会",
    objHint: "七派联合收徒的大会就在太南山——在太南谷等到会期（修炼/赶集度月皆可）。",
    title: "升仙大会 · 测灵台",
    text(s) {
      const t = [
        { scene: "太南山 · 升仙大会" },
        { bgm: "town" },
        { shot: "establish" },
        "会期到了。太南山腰人山人海，七面大旗猎猎作响——掩月宗、黄枫谷、灵兽山、清虚门、化刀坞、天阙堡、巨剑门。",
        "高台之上立着一面丈许高的测灵璧。少年男女们排着长队挨个上前按手，璧上灵光忽明忽暗，台下不时爆出欢呼或叹息。",
        "万小山陪你排在队尾，比你还紧张。",
        { say: "万小山", emo: "panic", text: "韩兄放轻松！你修为都练气中后期了，怎么也比这些没开过灵窍的娃娃强！" },
        "轮到你。掌心贴上测灵璧——四色灵光同时亮起，又同时黯下去，浑浊不清。",
        { shot: "pushIn" },
        { sfx: "fail" },
        { fx: "flash", color: "#888888", alpha: 0.12 },
        { say: "司仪修士", tone: "毫无起伏", text: "四属性，伪灵根。——下一个。" },
        "台下一阵低低的嗤笑。有人摇头：「四灵根还来凑什么热闹。」",
        { aside: "嗤笑就嗤笑吧。你们不知道的是——我袖中有一枚升仙令。" },
        "高台另一侧，七派的接引修士分坐云台。最东侧一位白衣女修绝丽出尘，眉目疏淡地俯瞰全场——人群里有人压着嗓子说，那是掩月宗的南宫仙子，结丹期的大人物。",
      ];
      // 钩子：早期警觉 → 对南宫婉的观察更冷静
      if (s.flags.early_suspicion) {
        t.push({ aside: "结丹……那是凌驾于筑基之上的境界。同样一双眼睛，她看这满山的人，会是什么样子？怕是和墨大夫看药童差不多——都是药引子罢了。" });
      } else {
        t.push({ aside: "结丹……那是凌驾于筑基之上的境界。同样一双眼睛，她看这满山的人，会是什么样子？" });
      }
      return t;
    },
    onArrive(s) {
      State.setFlag("xianhui_done");
      Engine.addMilestone("升仙大会：测灵璧前，四灵根当众落选", "deed");
    },
    choices: [
      { text: "退下高台（袖中令牌，不急在此刻）", hint: "大会散场再做计较" },
    ],
  },
  {
    id: "wan_death",
    cg: "tainan_lin",
    cond: (s) => s.flags.xianhui_done && !s.flags.wan_avenged,
    onArrive(s) {
      State.save();
      if (!State.count("anqi")) Engine.toast("暗器飞针耗尽——可选「退去后山」补给再战");
    },
    bgm: "sorrow",
    title: "暮色森林 · 故人之血",
    text(s) {
      const t = [
        { scene: "太南山 · 林间" },
        { shot: "establish" },
        { amb: "wind" },
        "大会散场，人潮四散。万小山说要抄近路回谷里收摊子，与你约好黄昏会合，一头扎进了林子。",
        "黄昏。他没有来。",
        "你沿小路寻进林中，远远便觉不对——草叶上有血。",
        { shot: "pushIn" },
        "林间空地，万小山仰面躺着，行囊被翻得底朝天，胸前一个焦黑的掌印。三个散修正蹲在他身边分拣财物，见你来了，懒洋洋地抬眼。",
        { wait: 700 },
        { say: "刀疤散修", text: "哟，又来一个肥羊。这穷小子身上就几块灵石，你身上想必多些——" },
        "万小山的眼睛还睁着，望着天。那个在集市上拉着你、教你『散修最要紧三件事』的人，到死攥着半张没卖完的符纸。",
      ];
      // 钩子：结拜兄弟 → 万小山之死更痛
      if (s.flags.sworn_brothers) {
        t.push({ aside: "一不露财，二不结仇，三……他说漏了一件——这世道，心善的人活不长。万小山……你是我在七玄门之后唯一的兄弟。这口气，我替你咽不下去。" });
      } else {
        t.push({ aside: "一不露财，二不结仇，三……他说漏了一件——这世道，心善的人活不长。" });
      }
      t.push(
        { sfx: "backstab" },
        "你缓缓放下行囊。袖中飞针滑入指间，淬过毒的那种。",
        { say: "韩立", emo: "cold", tone: "极冷", text: "他叫万小山。记住这个名字——到了底下，好报路引。" },
      );
      return t;
    },
    choices: [
      {
        text: "杀。",
        hint: "同阶之争，你无敌（毒、暗器、剑——全用上）",
        resolve: "revenge_fight",
      },
      {
        text: "（强压杀意——先退去后山，备足毒草暗器，再回来取这三条命）",
        hint: "韩立的道是万全准备：调息满血、底牌在手，再回此地。仇等得起。",
        resolve: "revenge_prep",
        calm: true,
      },
    ],
  },
  {
    id: "xianhui_end",
    cond: (s) => s.flags.wan_avenged,
    bgm: "triumph",
    title: "升仙令 · 入谷",
    text(s) {
      const t = [
        { scene: "太南山 · 黄枫谷接引处" },
        { shot: "establish" },
        "你在林中埋了万小山，坟头朝着他念叨过的家乡。他行囊里那半张符纸，你替他收了——往后你画出的每一张符，都算有他一份。",
        "三日后，黄枫谷接引处。你越过长队，将一枚令牌放在案上。",
        "接引修士本待呵斥，看清令牌的一瞬，霍然起身。",
        { sfx: "chime" },
        { shot: "pushIn" },
        { say: "接引修士", tone: "压低声音", text: "升仙令？！……阁下稍候，此令可直入我谷，无须测选。" },
        "队伍里炸开嗡嗡的议论。方才在测灵台上嗤笑过你的几张脸，此刻表情精彩纷呈。",
        { shot: "pullOut" },
      ];
      // 钩子：结拜兄弟 → 坟前多一句
      if (s.flags.sworn_brothers) {
        t.push({ aside: "测灵璧量得出灵根，量不出人心。万小山，你教我的那三件事，我记住了——可这第四件，你用命教的。黄枫谷——筑基之路，我来了。" });
      } else {
        t.push({ aside: "测灵璧量得出灵根，量不出人心。黄枫谷——筑基之路，我来了。" });
      }
      t.push({ scene: "离门远行 · 终　——　黄枫谷篇 · 启" });
      return t;
    },
    onArrive(s) {
      State.setFlag("departure_complete");
      Engine.addMilestone("凭升仙令直入黄枫谷（离门远行 · 完）", "showdown");
      Engine.addFame(6, "升仙大会上有人凭升仙令直入黄枫谷");
    },
    choices: [
      { text: "踏入黄枫谷山门", hint: "新的篇章（驻地章：百药园三年）——筑基丹的恩怨，自此开始" },
    ],
  },

  /* ============================================================
   *  黄枫谷篇（驻地章）· 序：入谷四连（多源核定：豆瓣逐集+B站+用户记忆）
   *  ① 吴师叔领新弟子入谷（发放物品/分配住所——谷中第一个善意）
   *  ② 领筑基丹 → 陆云风发难欲夺 → 叶师叔借"调解"之名抢走（吴师叔维护未果）
   *  ③ 拜见掌门，掌门不愿主持公道——"实力为上，无公平可言"
   *  ④ 百机堂领差事 → 百药园马师伯（先冷后认可——凭药理积累获其认可）
   *  恨点设计：先给再夺+告状无门——图鉴空位+前路栏常驻，直到地火屋自炼二十颗。
   * ============================================================ */
  {
    id: "hf_arrive",
    cond: (s) => s.flags.huangfeng_entered && s.location === "huangfeng_gate" && !s.flags.hf_arrived,
    objTitle: "黄枫谷报到",
    objHint: "外门弟子的青衫、腰牌与制式法器（青叶飞行法器、一柄铁剑）——还有升仙令许诺的那样东西。",
    title: "入谷 · 吴师叔",
    text(s) {
      const t = [
        { scene: "黄枫谷 · 山门" },
        { amb: "wind" },
        { bgm: "journey" },
        { shot: "establish" },
        { shot: "tiltUp" },
      ];
      // 钩子：曾以墨大夫身份行医/见过世面 → 入谷时更沉稳
      if (s.flags.identity_practice_medicine) {
        t.push("青石阶尽头云雾翻涌，仙鹤掠过殿宇飞檐。你随新弟子的队伍拾级而上——嘉元城的墨府、太南谷的小会、升仙大会的测灵璧，你都走过了。到了这真正的仙家山门，心里虽激荡，脚下倒还稳。");
      } else {
        t.push("青石阶尽头云雾翻涌，仙鹤掠过殿宇飞檐。你随新弟子的队伍拾级而上，腿肚子都有些发飘——这才是真正的仙家气象。");
      }
      t.push(
        "领队的是个面容温和的中年修士，一路不厌其烦地替众人指点：哪里是讲法堂，哪里是百机堂，灵田灵泉各在何处。",
        { say: "吴师叔", text: "都跟紧些。谷里规矩多，但记住一条就够——本分修行，谁也难为不了你。" },
        { sfx: "pick" },
        "发放青衫、腰牌、住所木牌，连同一片青叶法器、一柄制式铁剑时，他注意到你的入门名册。",
        { say: "吴师叔", text: "青叶法器助你御风赶路，铁剑虽是下品，到底是件正经战斗法器——御剑的本事，趁早练熟。" },
      );
      // 钩子：学过厉飞雨武学 → 对铁剑更有感触
      if (s.flags.learned_from_lify) {
        t.push({ aside: "铁剑……厉飞雨在七玄门教你的那几招眨眼剑法，底子还在。如今有了正经法器，剑法配灵力，该有一番新气象。" });
      }
      t.push(
        { say: "吴师叔", tone: "略一挑眉", text: "升仙令入谷？少见。小友，按谷例你可领一枚筑基丹——随我去执事殿。路上我教你：丹领了就收进贴身袋，谷里……不是人人都古道热肠。" },
        { shot: "pushIn" },
      );
      // 钩子：早期警觉 → 对吴师叔的善意更警惕（与墨大夫对比）
      if (s.flags.early_suspicion) {
        t.push({ aside: "萍水相逢，肯说这句话的，是个好人。……墨大夫当年也像好人。可这回，我不用等别人来告诉我——谷里的水深不深，我自己会探。" });
      } else {
        t.push({ aside: "萍水相逢，肯说这句话的，是个好人。" });
      }
      // 钩子：曲魂留府 → 入谷时孤身一人的感慨
      if (s.flags.quhun_stay_jiayuan) {
        t.push({ aside: "曲魂留在嘉元城了。从七玄门到墨府再到这里，头一回，身后没有那道沉默的影子跟着。也好——轻装上阵，路是自己走的。" });
      }
      return t;
    },
    onArrive(s) {
      State.setFlag("hf_arrived");
      if (!s.metNpcs.includes("wushishu")) s.metNpcs.push("wushishu");
      // 入门发放：青叶法器（韩立第一件飞行法器——头一回离地）
      s.flightId = "qingye_fazhan";
      // 入门发放：外门铁剑（头一件正经战斗法器——下品御剑法器，练气即可驱使）
      State.give("waimen_tiejian", 1);
      if (s.gear && !s.gear.weapon) s.gear.weapon = "waimen_tiejian";
      Engine.writeLedger("wu_kindness", "入谷之日，吴师叔的提点之恩");
      Engine.toast("入门发放：青叶法器（遁速+10）、外门铁剑（御剑刺）——头一回离地，头一件战斗法器");
    },
    choices: [
      { text: "随吴师叔去执事殿", hint: "升仙令许诺的东西，就在前头；袖里那片青叶还微微发烫" },
    ],
  },
  {
    id: "hf_duodan",
    cg: "huangfeng_zhishi",
    cond: (s) => s.flags.hf_arrived && !s.flags.zhuji_dan_stolen,
    bgm: "tense",
    title: "得丹 · 夺丹",
    text(s) {
      const t = [
        { scene: "黄枫谷 · 执事殿" },
        { shot: "establish" },
        "执事殿内，管事修士验过升仙令，从玉匣中取出一枚龙眼大的乳白丹丸。丹香入鼻，你丹田里的灵力都为之一颤。",
        { sfx: "pick" },
        "筑基丹。入手微温，你的指尖几乎在抖——筑基之路，就握在掌心里。",
        { aside: "苦修、算计、亡命——值了。都值了。" },
        "你还没把丹收进贴身袋，殿外一声冷笑。一个锦袍青年大步而入，身后跟着几名弟子。",
        { say: "陆云风", tone: "倨傲", text: "好啊——一个四灵根的杂役坯子，也配领筑基丹？这丹给你是浪费，识相的，自己交出来。" },
        { aside: "陆云风……太南小会上，被我抢先换走法宝残片的那位。好记性。" },
        "吴师叔脸色一沉，往你身前一站。",
        { say: "吴师叔", tone: "沉声", text: "陆师侄，谷例就是谷例。升仙令入谷授丹，掌门亲定的规矩——你要造次？" },
        "陆云风眼神闪烁之际，殿外又踱进来一个鹰目薄唇的青袍老者。满殿修士的腰瞬间弯了下去：「叶师叔。」",
        { say: "叶师叔", tone: "皮笑肉不笑", text: "吵什么。老夫来调解：云风啊，丹是人家凭令领的，你抢，没规矩——" },
        "陆云风躬身退后，嘴角却挂着笑。叶师叔转向你，抬手一招，一只布袋飘到你面前：十几块灵石、几株药草。",
        { say: "叶师叔", tone: "不容置疑", text: "不过，小友才练气七层，丹放在你手里是糟蹋。老夫门下有个后辈正当火候——这些换你那枚丹，公平买卖。日后你到了火候，自有机缘。" },
        { cam: "shake", px: 4 },
        { sfx: "hit" },
        "吴师叔还要开口，叶师叔一道眼风扫过去，筑基中期的灵压无声铺开。吴师叔的手攥紧又松开——他只是筑基初期。",
        { say: "吴师叔", tone: "低声，几乎是从牙缝里", text: "叶师叔，这不合谷例……" },
        { say: "叶师叔", text: "老夫说合，便合。" },
      ];
      // 钩子：早期警觉 → 对权力本质的洞察更深（与七玄门金光上人对比）
      if (s.flags.early_suspicion) {
        t.push({ aside: "反抗？练气七层对筑基中期。七玄门的金光上人也是这般——修仙者欺凡人，筑基欺练气。换了壳子，规矩没变。可金光上人死在了我的毒针下。这一幕，我记下了。" });
      } else {
        t.push({ aside: "反抗？练气七层对筑基中期。这就是修仙界——七玄门换了个更大的壳子罢了。但这一幕，我记下了。" });
      }
      t.push(
        { say: "韩立", tone: "极平静", text: "……成交。" },
        { shot: "pushIn" },
        { wait: 600 },
        "你松开手。那枚乳白的丹丸离开掌心的一瞬，你把它的模样刻进了心里。",
      );
      // 钩子：以毒为先 → 内心已有反制手段的盘算
      if (s.flags.showdown_prep_poison) {
        t.push({ aside: "叶师叔……筑基中期。此刻我杀不了你。可毒针淬的是慢性毒，暗器上的是闭灵散——你不知道我备了多少，也不知道我什么时候会用。这枚丹，我会自己拿回来。" });
      }
      return t;
    },
    onArrive(s) {
      State.setFlag("zhuji_dan_stolen");
      if (!s.metNpcs.includes("luyunfeng")) s.metNpcs.push("luyunfeng");
      if (!s.metNpcs.includes("yeshishu")) s.metNpcs.push("yeshishu");
      State.give("lingshi", 12);
      State.give("lingcao", 3);
      // 远雷·吴师叔之恩兑现（铁律3）：入谷那点提点之恩，在夺丹这关有人替你挡了一句话——点名出处
      if (Engine.settleLedger("wu_kindness", "陆云风发难时，是吴师叔脸色一沉、往你身前一站——入谷那日他递青叶法器、教你早练御剑的提点之恩，今日化作满殿权势倾轧里替你顶住的那一句「谷例就是谷例」。寒门杂役难得的一点暖")) {
        s.mood = Math.min(s.moodMax, s.mood + 3);
      }
      Engine.writeLedger("zhuji_dan_grudge", "入谷之日，叶师叔借调解之名换走你的筑基丹（陆云风发难在先）");
      Engine.addMilestone("夺丹之辱：筑基丹得而复失", "showdown");
      Engine.toast("筑基丹：得而复失（此仇此辱，记在前路）");
    },
    choices: [
      { text: "去见掌门——总该有个说理的地方", hint: "吴师叔欲言又止，终是叹了口气" },
    ],
  },
  {
    id: "hf_zhangmen",
    cond: (s) => s.flags.zhuji_dan_stolen && !s.flags.zhangmen_seen,
    title: "掌门 · 无公道",
    text(s) {
      const t = [
        { scene: "黄枫谷 · 掌门殿" },
        { bgm: "tense" },
        { shot: "establish" },
        "掌门殿高阔幽深。你陈明原委，垂手而立。半晌，上首的中年掌门放下茶盏。",
        { shot: "pushIn" },
        { say: "黄枫谷掌门", tone: "语气平淡得像在说天气", text: "叶师叔既已给了灵石药草，便算两讫。修仙界中，机缘灵物，向来有德者居之——" },
        { say: "黄枫谷掌门", text: "——而所谓德，便是实力。你若有叶师叔的修为，这丹，谁拿得走？" },
        "他挥挥手，示意你退下。自始至终，没问过你一句。",
        { shot: "pullOut" },
        { amb: "wind" },
        "殿外山风浩荡，云海翻腾。你立在白玉阶上，忽然笑了一声。",
      ];
      // 钩子：早期警觉 → 已两次经历"强者即理"，反应更冷更硬
      if (s.flags.early_suspicion) {
        t.push({ aside: "好。问世间讨公道，原是我天真。七玄门教过我一回，黄枫谷又教一回——两回了。可金光上人也曾这般高高在上，如今坟头草都青了。这一课，我记到筑基那天。" });
      } else {
        t.push({ aside: "好。问世间讨公道，原是我天真。七玄门教过我一回，黄枫谷又教一回——这一课，我记到筑基那天。" });
      }
      t.push(
        { say: "韩立", emo: "cold", tone: "极轻", text: "实力为上。多谢掌门赐教。" },
      );
      return t;
    },
    onArrive(s) {
      State.setFlag("zhangmen_seen");
      Engine.writeLedger("zhangmen_no_justice", "掌门对夺丹之事不置一词——公道要自己挣");
      Engine.addMilestone("掌门殿前：无公道，唯实力", "deed");
    },
    choices: [
      { text: "下殿，去百机堂领差事", hint: "日子还得过——而日子，就是武器" },
    ],
  },
  {
    id: "hf_yaoyuan",
    cond: (s) => s.flags.zhangmen_seen && !s.flags.yaoyuan_started,
    title: "百药园 · 马师伯",
    text(s) {
      const t = [
        { scene: "黄枫谷 · 百药园" },
        { amb: "wind" },
        { bgm: "daily" },
        { shot: "establish" },
        "百机堂的执事翻着名册，把你打发去了百药园——谷东南向阳坡上，一畦一畦的灵田顺着山势铺开，药香沁人。",
        "看园的是个黑瘦干瘪的老者，背着手把你从头到脚扫了三遍，鼻子里哼了一声。",
        { say: "马师伯", text: "又塞个不要的来。丑话在前：卯时起垄，辰时引灵泉，巳时捉虫——误一炷香，扣一月例钱。手脚不干净的，老夫亲自打断。" },
        "他随手指着一畦蔫头耷脑的灵草：「先说说，这畦怎么了。」",
      ];
      // 钩子：曾以墨大夫身份行医 → 药理实战经验更丰富，回答更利落
      if (s.flags.identity_practice_medicine) {
        t.push({ aside: "叶片卷边发暗，根部却无虫眼——是灵泉引多了，涝着了。墨大夫的《百草谱》第三卷讲过——可真正认准这症候，是我在嘉元城冒充他行医时，亲手救活过两畦这样涝死的灵稻。" });
      } else {
        t.push({ aside: "叶片卷边发暗，根部却无虫眼——是灵泉引多了，涝着了。墨大夫的《百草谱》第三卷讲过。" });
      }
      t.push(
        "你把症候、根由、救法一一道来，又顺手指出旁边两畦的早衰之相。老者的眉毛挑了挑，上下重新打量你。",
        { say: "马师伯", tone: "哼了一声，语气却松了", text: "……倒不是个棒槌。行，西头那排青元参苗归你管——那是老夫的心尖子，照料好了，例钱翻倍。" },
        { sfx: "page" },
        "他扔给你一本翻烂了的《百草谱》，转身就走，走两步又顿住，没回头。",
        { say: "马师伯", tone: "含糊地", text: "夜里霜重，参苗记得盖草帘。……例钱在房梁上，自己取。" },
        { aside: "刀子嘴。这园子打理得一丝不苟，他对药草是真心，对人——大概也是。" },
        "自此，你成了百药园的看园弟子。差事不重，月例不薄，更要紧的是——这满园灵药，和园角那间无人过问的旧丹房。",
        { shot: "pushIn" },
      );
      // 钩子：药理>=1 → 对自炼筑基丹更有底气
      if (s.skills && s.skills.alchemy >= 1) {
        t.push({ aside: "叶师叔当我在这里磋磨光阴。可对我来说……药园、丹房、小绿瓶，加上墨大夫教我的辨药底子——三年之内，我要让『筑基丹』四个字，重新回到我自己手里。不是领，是炼。" });
      } else {
        t.push({ aside: "叶师叔当我在这里磋磨光阴。可对我来说……药园、丹房、小绿瓶。三年——三年之内，我要让『筑基丹』四个字，重新回到我自己手里。" });
      }
      return t;
    },
    onArrive(s) {
      State.setFlag("yaoyuan_started");
      if (!s.metNpcs.includes("mashibo")) s.metNpcs.push("mashibo");
      // 血色禁地日历锚：约两年半后的大比时节开启名额之争（天命栏常驻倒计时）
      s.flags.xueshi_due = State.absMonth() + 30;
      Engine.writeLedger("ma_approval", "初到百药园便凭药理获马师伯另眼相看");
      Engine.addMilestone("百药园看园弟子：三年之约（对自己的）", "deed");
    },
    choices: [
      { text: "接过《百草谱》", hint: "百药园差事开启（行动栏「药园差事」）——大帆时代：种药、修炼、攒家底" },
    ],
  },

  /* ============================================================
   *  黄枫谷篇 · 中期大事件：坊市归途（多源核定）
   *  考据：长春功十一层遇瓶颈备战血色试炼 → 坊市购装备归途 →
   *  陆云风（陈巧倩道侣）为攀附董萱儿求入红拂门下+筑基丹之争，对道侣暗下杀手 →
   *  韩立被迫出手杀陆云风、救陈巧倩，夺得两枚筑基丹 → （动漫线）喂忘尘丹。
   *  游戏化：忘尘丹之择=陈巧倩命途最早的改命道岔（fate-design §一）。
   * ============================================================ */
  {
    id: "chen_rescue",
    cg: "huangfeng_lin",
    cond: (s) => s.flags.yaoyuan_started && s.realmIndex >= 10 && (s.flags.fangshi_visited || 0) >= 1 && !s.flags.luyunfeng_dead,
    bgm: "tense",
    objTitle: "山雨欲来",
    objHint: "练气十一层、坊市备货齐整——血色试炼在望。这日黄昏，你照例从坊市抄小路回药园。",
    title: "坊市归途 · 林中血",
    text(s) {
      const t = [
        { scene: "黄枫谷 · 林间小路" },
        { amb: "wind" },
        { shot: "establish" },
        "黄昏，你从坊市抄小路回药园，背篓里是新购的符纸丹瓶。林深处忽然传来灵力炸响——还有一声压抑的女子闷哼。",
        { sfx: "farClash" },
        { shot: "pushIn" },
        "你隐去身形摸过去。林间空地上，一个青衫女修被金色光索捆在树上，灵力被封，发髻散乱——是坊市里见过的陈家师姐，陈巧倩。",
        "她对面站着的人，你也认得。锦袍，折扇——陆云风。",
        { say: "陆云风", tone: "温柔得发冷", text: "巧倩，别怪我。红拂师叔的门下只收无牵无挂之人……你说，我一个有道侣的，怎么攀得上董师妹那条线？" },
        { say: "陈巧倩", tone: "嘶声", text: "陆云风！结缘那日你说的话，你的道心就喂了狗——" },
        { say: "陆云风", text: "道心？我的道心就是筑基。你身上那两枚筑基丹，也一并留下吧——黄泉路上，用不着。" },
        { sfx: "sword" },
        "他扬手，一道剑光缓缓抵上她的咽喉。",
      ];
      // 钩子：早期警觉 → 对陆云风的判断更冷
      if (s.flags.early_suspicion) {
        t.push({ aside: "为攀高枝杀道侣灭口……这种东西也配修仙。墨大夫也是这路人——利用完了就杀。更要紧的是——他手里有两枚筑基丹。" });
      } else {
        t.push({ aside: "为攀高枝杀道侣灭口……这种东西也配修仙。更要紧的是——他手里有两枚筑基丹。" });
      }
      t.push(
        { aside: "出手，是杀人灭口的死局开端；不出手，眼睁睁看人死。……墨大夫、金光上人、杀万小山的散修——我什么时候怕过死局了。" },
        { cam: "zoom", scale: 1.18, ms: 220 },
        { sfx: "backstab" },
        { fight: "luyunfeng_fight", guard: { hint: "袖中飞针，破他剑光——杀！" } },
      );
      return t;
    },
    choices: [
      {
        text: "袖中飞针，破他剑光——杀。",
        hint: "同阶恶战（陆云风练气十一层）——为救人，也为那两枚丹",
        resolve: "luyunfeng_fight",
      },
    ],
  },
  {
    id: "chen_after",
    cond: (s) => s.flags.luyunfeng_dead && !s.flags.chen_resolved,
    title: "林中事了 · 忘尘丹",
    text(s) {
      const t = [
        { scene: "黄枫谷 · 林间小路" },
        { shot: "establish" },
        { amb: "wind" },
        { bgm: "sorrow" },
        "陆云风的尸身倒在血泊里，眼睛还瞪着——他到死也没想明白，一个看药园的杂役弟子，出手为什么这么狠。",
        { sfx: "pick" },
        "你从他储物袋里翻出那两枚筑基丹。乳白的丹丸躺在掌心，温润微凉——和入谷那日一模一样。",
      ];
      // 钩子：夺丹之辱记忆 → 讨回的感受更深
      if (s.flags.zhuji_dan_stolen) {
        t.push({ aside: "两枚。叶师叔夺走的，今日从他师侄手里讨回来了——连本带利。这枚丹的滋味，我比谁都清楚。" });
      } else {
        t.push({ aside: "两枚。叶师叔夺走的，今日从他师侄手里讨回来了——连本带利。" });
      }
      t.push(
        "树上的陈巧倩已被你解开。她抱着膝盖坐在地上，半晌，忽然低声开口。",
        { shot: "pushIn" },
        { say: "陈巧倩", tone: "声音很轻", text: "师弟……今日之事，你要杀我灭口吗？" },
        "你摇头。她看着你，眼睛在暮色里亮得吓人。",
        { say: "陈巧倩", text: "那你要什么？救命之恩，巧倩……无以为报。" },
        { aside: "麻烦。知情人是麻烦，恩情更是麻烦。储物袋里还有半瓶忘尘丹——抹去今夜，干干净净。这是最稳的路。" },
        { aside: "可是……万小山攥着符纸的手，彩环递玉时的眼睛。被人记得，真的是坏事吗？" },
      );
      return t;
    },
    choices: [
      {
        text: "递上忘尘丹：「服下它，忘了今夜。」（动漫之选）",
        hint: "最稳的路——她不记得你，也就不会被你牵连",
        effect(s) {
          Engine.writeLedger("chen_wangchen", "救陈巧倩之后，喂她服下忘尘丹");
          return { text: "她盯着你掌心的丹丸看了很久，忽然笑了一下，仰头服下。\n\n「原来恩公要的是……干净。」她阖眼前最后说了这一句。\n\n你把她安置在陈家坊铺外，转身离开。明日她醒来，只会记得自己遇了袭、被无名氏所救——而你，是个无名氏。\n\n（账本：忘尘丹。她的情路，被你亲手封存在了今夜。）", kind: "sys" };
        },
      },
      {
        text: "收回手：「记着也好——记着，往后躲恩人远些。」",
        hint: "改命的起点：她会记得你（命途参数自此不同）",
        effect(s) {
          Engine.writeLedger("chen_remember", "救陈巧倩之后，没有喂忘尘丹——她记得你");
          return { text: "你把忘尘丹收了回去。她怔住，随即极轻地、极认真地点了点头。\n\n「韩师弟。」她记下了你的名字，一字一顿，像刻进什么地方，「大恩不言谢。往后你在谷中，凡有陈家在的地方——必有你一席。」\n\n暮色四合，她朝你深深一礼，转身没入林间。\n\n（账本：她记得。这一夜没有被封存——它会长成什么，谁也不知道。）", kind: "good" };
        },
      },
    ],
  },

  /* ============================================================
   * 黄枫谷篇 · 第三幕「血色试炼」（动漫 9/12~15 话考据）
   * 注：禁地箱庭探索 v2 重制中——本链先以叙事+对阵轴战斗跑通主线，
   *     重制完成后「五日采药」段将替换为真探索（docs/explore-redesign.md）。
   * ============================================================ */
  {
    id: "jindi_meeting",
    cg: "huangfeng_dadian",
    // 门槛软化·双路触发：练气十一层是踏入血幕的硬门槛（杂役入禁地的命线）——一旦达成即可参选，
    // 不必空等大比日历到点（旧 absMonth>=xueshi_due 那路会卡出天命栏「约余0月」的死等）。
    cond: (s) => !s.flags.xueshi_opened && !!s.flags.xueshi_due && s.realmIndex >= 10,
    bgm: "tense",
    objTitle: "大比时节",
    objHint: "血色禁地开启在即——名额之争，今日在大殿见分晓。",
    title: "血色禁地 · 名额之会",
    text(s) {
      const t = [
        { scene: "黄枫谷 · 山门大殿" },
        { shot: "establish" },
        "大比时节，议事大殿内挤满了各脉弟子。你随百药园的杂役队伍站在最末，前面是一片赭黄道袍的海。",
        "高台之上坐着一位白发玉冠的老者——入谷那日同门口中的「李师祖」，黄枫谷首席大长老，李化元。",
        { say: "李化元", text: "血色禁地，六十年灵气一衰。此番开启，名额三十，各脉按例分派。" },
        "台下顿时嗡声一片。有人高声问为何不再依五年旧例，李化元尚未答话，殿侧一个清冷的声音先开了口。",
        { sfx: "chime" },
        { say: "南宫婉", emo: "cold", text: "诸位若是看过近三十年的灵药产数，就不会问这句话了。禁地灵气衰减，主药一茬比一茬薄——再按五年开，开到后头就是空山。" },
        "白衣广袖的年轻女修立在殿侧，眉目清艳，声音不高，满殿却静了下来。有人低声道：那是掩月宗的南宫婉，此番代宗门观礼。",
      ];
      // 钩子：南宫婉羁绊 → 识出她就是血潭那个人
      if (s.flags.nangongwan_bond) {
        t.push({ aside: "掩月宗……天之骄女。传闻她筑基用了不到四年。——可你认得她。血色禁地深潭边，那双冷冷的眼睛，和那一夜化开的月亮。" });
      } else {
        t.push({ aside: "掩月宗……天之骄女。传闻她筑基用了不到四年。" });
      }
      t.push(
        "名额分派到百药园一脉时，管事的报上去三个名字，没有你。",
        { shot: "pushIn" },
        "你出列，朝高台一礼，只说了一句：「弟子练气十一层，药理粗通——禁地里的主药，认得全。」",
        "满殿哄笑。李化元却抬了抬眼皮，目光落在你身上，停了一息。",
        { say: "李化元", text: "百药园马师伯荐过你。也罢——多你一个名额。活着回来。" },
      );
      return t;
    },
    onArrive(s) {
      State.setFlag("xueshi_opened");
      if (!s.metNpcs.includes("lihuayuan")) s.metNpcs.push("lihuayuan");
      if (!s.metNpcs.includes("nangongwan")) s.metNpcs.push("nangongwan");
      // 远雷·向之礼指点兑现（铁律3）：晒太阳老人当年那番闲谈门道，今日字字应验——点名出处
      if (Engine.settleLedger("xiang_guidance", "晒太阳的向老头当年那番闲谈——血色主药是筑基丹根本、名额按各脉实力分、修为先到练气十一层——今日大殿之上字字应验。那句「你去得，也回得来」，原来早把这条路给你点透了")) {
        s.mood = Math.min(s.moodMax, s.mood + 2);
      }
      Engine.writeLedger("jindi_seat", "名额大会上凭一句「主药认得全」拼下血色禁地席位");
      Engine.addMilestone("血色禁地：名额到手", "deed");
    },
    choices: [
      { text: "清点行装，踏入血幕——五日生死局，开始了。", resolve: "jindi_enter" },
    ],
  },
  {
    // 【已被舆图系统接管】血色禁地五日 → js/exploremap.js（L1 舆图）。叙事卡留档不再触发。
    id: "jindi_days",
    skipIf: () => true,
    cond: (s) => s.flags.xueshi_opened && !s.flags.jindi_mid_done && !s.flags.mojiao_slain,
    bgm: "tense",
    title: "血色禁地 · 五日",
    text(s) {
      return [
        { scene: "血色禁地" },
        "入禁那日，三十人鱼贯踏入血幕。赤红的雾气吞掉每个人的身影——从这一刻起，五日之内，生死各安天命。",
        "禁地里的天是暗红色的。赤岩嶙峋，藤蔓如血管般攀爬，脚边的草叶泛着诡异的血色微光。",
        { aside: "血色主药多生在中环以深。外环安稳，药也薄；越深，药越足——人也越凶。" },
        "第一日，你在外环摸清了禁地的脾性，袋里已有两株主药。前方岔路，血雾深处隐隐传来争斗声与……极轻的脚步声。",
        { aside: "有人在猎人。猎的不是妖兽——是同门。" },
      ];
    },
    choices: [
      {
        text: "稳守外环：按药理按图索骥，安稳采满五日。",
        hint: "主药×4 稳稳到手——但中环的厚药与你无缘",
        effect(s) {
          State.give("xueshi_zhuyao", 4);
          State.setFlag("jindi_mid_done");
          Engine.writeLedger("jindi_safe", "血色禁地中稳守外环，安稳采药");
          Engine.passTime(1);
          return { text: "三日下来，你像在百药园当值一样按部就班：辨土、寻脉、起药——主药四株稳稳入袋。\n\n远处偶有惨叫声穿透血雾，你充耳不闻。稳，是你在七玄门学会的第一个字。\n\n（血色主药×4。第四日，该往深处的水潭去了——主药最厚的地方，绕不开。）", kind: "good" };
        },
      },
      {
        text: "深入中环：药足之地，富贵险中求。",
        hint: "主药×6——但血雾里那个猎人，恐怕正等着你这样的",
        resolve: "fengyue_ambush",
      },
    ],
  },
  {
    // 【已被舆图系统接管】封岳=舆图巡逻棋子，相遇即战。叙事卡留档不再触发。
    id: "fengyue_ambush",
    skipIf: () => true,
    cond: (s) => false,   // 仅由 jindi_days 选择直达（resolve 径）
    bgm: "tense",
    title: "中环 · 狙杀者",
    text(s) {
      return [
        { scene: "血色禁地" },
        "中环的主药果然厚——两日不到，你已采足六株。第三日清晨，你蹲身起第七株药时，后颈的寒毛忽然全竖了起来。",
        "你侧身的刹那，一枚淬黑短刺擦着耳际钉进岩壁，没柄。",
        { say: "封岳", tone: "blood", text: "好警觉。难怪马老头肯荐你这么个杂役。" },
        "血雾里走出一个墨绿劲装的精瘦男修，足下一双灰靴轻得没有声音。你认得这双靴子——谷里失踪弟子的卷宗上，画过。",
        { say: "封岳", text: "把药袋留下。再把储物袋也留下。我赶时间。" },
        { aside: "狙杀者封岳——靠猎杀同门换资粮的亡命徒。他的靴子能让他快人一步……杀了他，那双靴子就是我的。" },
      ];
    },
    choices: [
      { text: "「药我自己拿命换的。你的命，也一样。」——战！", resolve: "fengyue_fight" },
    ],
  },
  {
    // 【已被舆图系统接管】深潭=L3 墨蛟洞（观战/隐蔽采集/决战）。叙事卡留档不再触发。
    id: "jindi_deep",
    skipIf: () => true,
    cond: (s) => s.flags.jindi_mid_done && !s.flags.mojiao_slain,
    bgm: "boss",
    title: "深处 · 血潭",
    text(s) {
      return [
        { scene: "血色禁地" },
        "第四日，你循着主药的脉络一路向深，到了禁地最深处——一汪暗红的水潭。",
        "潭边的血色主药密得像园圃，株株饱满欲滴。而潭水中央，一道白衣身影正凌波而立，广袖轻扬间摘走潭心最大的那株。",
        { say: "南宫婉", emo: "cold", text: "……是你。名额会上多出来的那个。" },
        "她话音未落，潭水轰然炸开——漆黑的蛟影自水底暴起，黑雾翻涌，血红的竖瞳冷冷扫过潭岸的两个人。",
        { say: "南宫婉", tone: "blood", text: "墨蛟！它早就守着这片药——退！" },
        { aside: "退？潭边的主药、它身上的角与鳞……还有这个压制了修为也敢进禁地的女人。今天没有退路，也不需要。" },
      ];
    },
    choices: [
      { text: "「掩月宗的道友——借个背。」背靠背，战墨蛟！", resolve: "mojiao_fight" },
    ],
  },
  {
    id: "mojiao_after",
    // 兜底：没杀墨蛟就出了禁地（提前走/五日强制传出）→ 跳过潭边戏，主线照走
    skipIf: (s) => s.flags.mojiao_resolved || (s.flags.jindi_left && !s.flags.mojiao_slain),
    cond: (s) => s.flags.mojiao_slain && !s.flags.mojiao_resolved,
    title: "潭边 · 不能说的，与记一辈子的",
    text(s) {
      const t = [
        { scene: "血色禁地", cg: "mojiao" },
        { shot: "establish" },
        { sfx: "landDown" },
        { cam: "shake", px: 5 },
        "墨蛟庞大的尸身轰然砸进浅滩，黑雾散尽。你拄着膝盖喘息，后劲一阵阵涌上来——赢了。",
        "就在这时，蛟腹之下「啵」地一声轻响。一缕说不出名目的异香，混进血色雾气里，丝丝缕缕，避无可避。",
        { fx: "flash", color: "#b06a9a", alpha: 0.25, ms: 600 },
        { sfx: "whiff" },
        { aside: "不好——妖兽临死的脏东西破了。屏息！……来不及了。" },
        "香气入肺，识海像被温水漫过。你最后的清明里，只看见她回头望来的那一眼——那双总是冷冷的眼睛，此刻雾蒙蒙的，像化开的月亮。",
        { wait: 700 },
        "（血色的雾，遮住了潭边。）",
        { wait: 500 },
        { shot: "establish" },
        "——醒来时，天光已经换了颜色。",
        "她背对着你坐在三步外，白衣整整齐齐，乌发一丝不乱，仿佛什么都没有发生。只有潭水知道发生过什么。",
        { shot: "pushIn" },
        { say: "南宫婉", emo: "cold", text: "墨蛟淫囊之毒，你我皆中，谁也怪不得谁。——今日之事，此生不得对第三人提起。" },
        "她的声音冷静得近乎残忍，说完便起身取材：割角、剥鳞、自蛟首中摄出元神。最后，她把一枚拳头大的暗色「内丹」抛了过来。",
        { say: "南宫婉", text: "内丹归你，角鳞也归你。掩月宗要的元神，我已取了。两清。" },
        "你接住内丹，应了声「好」。她广袖一拂便要凌空而去——却在血雾边缘，停了一步。",
        { say: "南宫婉", text: "……还没问你名字。" },
        "「韩立。」你说，「立碑的立。」",
        "她背对着你，半晌没动。血色雾气里，你听见她极轻地重复了一遍。",
        { bgm: "sorrow" },
        { shot: "pushIn" },
        { say: "南宫婉", emo: "smile", text: "韩立。立碑的立。……我记下了。" },
        { aside: "她说此生不得提起。可有些事不必提起，也烂不掉——它会跟着人走很远，远到谁也想不到的地方。" },
        "出禁地那日，李化元亲自在血幕外等着。听完你报上的灵药数目，老人捋须的手停了一停。",
        { shot: "pullOut" },
        { say: "李化元", text: "三十五种。比老夫赌约里押的还多三种。——韩立，可愿做老夫的记名弟子？" },
      ];
      return t;
    },
    onArrive(s) {
      State.setFlag("mojiao_resolved");
      State.setFlag("nangongwan_bond");   // 正宫线之根：血色之夜（命途线 fate-design）
      State.give("xueshi_zhuyao", 2);
      Engine.writeLedger("mojiao_together", "血色禁地深潭，与南宫婉背靠背斩杀墨蛟");
      Engine.writeLedger("mojiao_oath", "墨蛟淫囊之毒下共度血色一夜——此生不得对第三人提起的约定，与一个被记住的名字");
      Engine.writeLedger("mojiao_neidan", "墨蛟「内丹」入袋——这枚丹的来路，日后见分晓");
      Engine.addMilestone("血色之夜：南宫婉记住了你的名字", "showdown");
      Engine.addMilestone("拜入李化元门下（记名弟子）", "deed");
      Engine.addFame(12, "血色禁地中斩杀墨蛟的杂役弟子");
      if (typeof Sfx !== "undefined") Sfx.play("success");
    },
    choices: [
      {
        text: "把这五日、连同不能说的那一夜，都埋进血色雾气里。「弟子韩立，拜见师尊。」",
        hint: "郑重拜师——跪下磕头",
        effect(s) {
          s.mood = Math.min(s.moodMax, s.mood + 5);
          return { text: "你跪下磕了三个头——血色雾气里，那五个字轻得像烟，却重得像铁。", kind: "event" };
        },
        resolve: "advance",
      },
      {
        text: "「弟子韩立，拜见师尊。」只拱手，不跪。",
        hint: "藏拙——保持分寸",
        effect(s) {
          State.setFlag("hanli_formal_bow");
          return { text: "你拱手为礼，不卑不亢——李化元看在眼里，倒也没说什么，只捋须一笑。", kind: "event" };
        },
        resolve: "advance",
      },
    ],
  },

  {
    id: "wulong_forge",
    // 妖材→法宝链·首件落地：墨蛟之角在手 → 元武国巧匠齐云霄代炼乌龙夺
    // 兜底：已炼成 / 没斩墨蛟 / 蛟角已不在手 → 跳过（与 cond 互补，绝不卡主线）
    skipIf: (s) => s.flags.wulong_forged || !s.flags.mojiao_slain || State.count("mojiao_jiao") < 1,
    cond: (s) => s.flags.mojiao_slain && !s.flags.wulong_forged && State.count("mojiao_jiao") >= 1,
    title: "蛟角成器 · 乌龙夺",
    text(s) {
      const t = [
        { scene: "黄枫谷 · 丹房偏院" },
        "记名拜师后未几，李化元唤你到丹房偏院。院中地火幽幽，一名青衫老者正就着炉火翻看你那对墨蛟之角，眼里精光闪烁。",
        { say: "李化元", text: "这位是齐云霄，元武国姓齐的炼器巧匠，与老夫是多年旧识。你这对蛟角内蕴水行妖力，寻常炉火炼它不动——正该他出手。" },
        { say: "齐云霄", emo: "smile", text: "双角质胜精铁，毒性犹存。小子，要老夫给你炼把称手的？依这角的脾性，做成短法宝最是凶毒——四爪攥握、御空连抓，爪尖带着蛟毒，缠上谁都难受。" },
        "老者袖中飞出一具小巧法器雏形，四道墨绿如四枚蛟爪攥成一握。地火轰然窜起，蛟角入炉，缕缕毒雾被逼回器身。",
        { aside: "三日后开炉——四爪墨绿、爪尖泛着幽幽青芒，正是那墨蛟未散的毒。「乌龙夺」。" },
        { say: "齐云霄", text: "记着，它的厉害不在一击之力，在那口毒——抓得越久，敌人烂得越透。拿去吧。" },
      ];
      return t;
    },
    onArrive(s) {
      State.take("mojiao_jiao", 1);
      State.give("wulong_duo", 1);
      State.setFlag("wulong_forged");
      Engine.writeLedger("wulong_forged", "墨蛟双角托元武国巧匠齐云霄炼成四爪毒法宝「乌龙夺」——妖材成器，攻击带毒");
      Engine.addMilestone("妖材成器：乌龙夺（四爪毒法宝）", "bigitem");
      if (typeof Sfx !== "undefined") Sfx.play("success");
    },
    choices: [
      {
        text: "接过乌龙夺，四爪在掌心一收。「多谢齐前辈。」",
        hint: "即刻试手——感受法宝脾性",
        effect(s) {
          State.setFlag("wulong_test");
          return { text: "你催动灵力，四道墨绿爪影在掌心一收一放——蛟毒隐隐流转，果然凶毒。", kind: "event" };
        },
        resolve: "advance",
      },
      {
        text: "「前辈厚赐，韩立记下了。」收好不试，先回洞府再参。",
        hint: "藏拙——不在长辈面前暴露底细",
        effect(s) {
          s.mood = Math.min(s.moodMax, s.mood + 2);
          return { text: "你没有当场试手——在齐云霄面前暴露灵力深浅，不是明智之举。收好乌龙夺，回去再慢慢参。", kind: "event" };
        },
        resolve: "advance",
      },
    ],
  },

  /* ============================================================
   * 黄枫谷篇 · 第四幕「筑基」：地火炼丹 → 狂嗑筑基 → 青元剑诀 → 洞府 → 叶师叔之报
   * ============================================================ */
  {
    id: "qingyuan_gift",
    cg: "huangfeng_dadian",
    skipIf: (s) => s.flags.qingyuan_given,
    cond: (s) => State.realm().tier === "foundation" && !s.flags.qingyuan_given,
    title: "筑基 · 青元剑诀",
    text(s) {
      const t = [
        { scene: "黄枫谷 · 山门大殿" },
        { shot: "establish" },
        "筑基的消息传开那日，整个百药园都炸了——四灵根伪灵根筑基，黄枫谷立谷以来，数得出几个？",
        "李化元把你唤去丹房，案上摊着一卷泛黄的剑诀。",
        { say: "李化元", text: "长春功到头了。筑基之后主修须换——这卷《青元剑诀》，谷中流传九层，弟子多止步三层。以你的心性，不止于此。" },
        { bgm: "triumph" },
        { shot: "pushIn" },
        "你双手接过。卷册入手微沉，翻开第一页，一缕青芒自纸面流过——青芒可凝成三尺剑芒，亦可聚作丈余巨剑，自天倾斩。",
        { fx: "flash", color: "#dff3ff", alpha: 0.5, ms: 700 },
        { sfx: "success" },
        { fx: "burst", elem: "mu", n: 18 },
        { shot: "pullOut" },
        { say: "李化元", tone: "soft", text: "去吧。把它练出名堂来——别辜负你那二十颗丹。" },
      ];
      // 钩子：夺丹之辱 → 筑基的滋味更沉
      if (s.flags.zhuji_dan_stolen) {
        t.push({ aside: "十九颗碎在丹田里，最后一颗成了。筑基这条路，是拿命堆出来的——往后的路，更是。叶师叔夺走的那枚丹，如今看来，倒是逼出了二十枚。这笔账，算他输。" });
      } else {
        t.push({ aside: "十九颗碎在丹田里，最后一颗成了。筑基这条路，是拿命堆出来的——往后的路，更是。" });
      }
      return t;
    },
    onArrive(s) {
      State.setFlag("qingyuan_given");
      DATA.techniques.qingyuan_sword.locked = false;
      if (typeof Loadout !== "undefined") {
        // 李化元赠九层版：筑基初即第三层（剑芒即出）；五层剑盾、七层剑影分光须日后闭关参研逐层精进。
        Loadout.learnTechnique(s, "qingyuan_sword", { layer: 3 });
        Loadout.setMain(s, "qingyuan_sword");
        Loadout.equipSkill(s, "qingyuan_jianmang");   // 三层·剑芒（剑盾/剑影分光未达层，暂入不了技能池）
        Loadout.equipSkill(s, "jujian_shu");          // 巨剑术：随诀直授的大杀招（用户裁决·v149）——聚芒成剑、倾天斩落
      }
      Engine.addMilestone("主修换代：《青元剑诀》（三层·剑芒＋巨剑术）", "bigitem");
      Engine.settleLedger("zhuji_dan_grudge", "入谷那日被夺走的东西，你用二十颗丹与一个境界，彻底讨了回来");
    },
    choices: [
      {
        text: "闭关参剑——青元剑芒，当自指间出。",
        hint: "苦修参悟——闭关不出",
        effect(s) {
          s.mood = Math.max(0, s.mood - 2);
          return { text: "你闭关不出，日夜参悟剑诀——青芒初时凝不住，反复百遍，才在指间聚出第一缕剑芒。", kind: "event" };
        },
        resolve: "advance",
      },
      {
        text: "「先去洞府安顿，再参也不迟。」",
        hint: "先安身——磨刀不误砍柴工",
        effect(s) {
          s.mood = Math.min(s.moodMax, s.mood + 3);
          State.setFlag("qingyuan_settle_first");
          return { text: "你没有急着闭关——先去洞府安顿好日常，再静心参剑。磨刀不误砍柴工。", kind: "event" };
        },
        resolve: "advance",
      },
    ],
  },
  {
    id: "dongfu_pick",
    skipIf: (s) => s.flags.dongfu_done,
    cond: (s) => s.flags.qingyuan_given && !s.flags.dongfu_done,
    title: "洞府 · 安身之地",
    text(s) {
      const t = [
        { scene: "huangfeng_gate" },
        { amb: "wind" },
        { bgm: "daily" },
        { shot: "establish" },
        "筑基弟子，有开洞府之权。掌门殿发下三处可选之地的图册，附赠一面「迷踪阵旗」——这是规制内的体面。",
        { shot: "pushIn" },
      ];
      // 钩子：藏拙本能 → 选址倾向更冷
      if (s.flags.early_suspicion) {
        t.push({ aside: "杂役棚里睡了三年，如今也轮到自己择一处山头了。……可越是风光的地方，越是眼多。藏拙，从选址开始。" });
      } else {
        t.push({ aside: "杂役棚里睡了三年，如今也轮到自己择一处山头了。" });
      }
      return t;
    },
    choices: [
      {
        text: "灵泉眼：泉眼吐灵，修炼事半功倍——但先得击退占洞的妖物。",
        hint: "修炼效率最高（动漫之选）",
        effect(s) {
          State.setFlag("dongfu_done"); s.flags.dongfu_type = "lingquan";
          Engine.addMilestone("洞府落成：灵泉眼", "bigitem");
          Engine.writeLedger("dongfu_lingquan", "择灵泉眼开洞府（修炼效率+），驱走了占洞的灵猿");
          return { text: "你提剑上山，洞中盘踞的白毛灵猿与你斗了半日，终是不敌，呜咽着让出泉眼。\n\n泉水叮咚，灵气氤氲——你的第一座洞府，悬在黄枫谷的云雾里。自此闭关修炼，事半功倍（修炼效率+15%）。", kind: "good" };
        },
      },
      {
        text: "僻静谷：藏风聚气，最不打眼。",
        hint: "藏拙者之选：洞府不显，扬名涟漪-（低调度+）",
        effect(s) {
          State.setFlag("dongfu_done"); s.flags.dongfu_type = "pijing";
          Engine.addMilestone("洞府落成：僻静谷", "bigitem");
          Engine.writeLedger("dongfu_pijing", "择僻静幽谷开洞府——藏拙者的本能");
          return { text: "你选了最不打眼的那道幽谷。同门都说杂役出身就是小家子气——你笑笑不答。\n\n谷口布下迷踪阵旗，云雾一锁，神仙难寻。藏得深，才睡得着。（洞府隐蔽：是非更难寻上门。）", kind: "good" };
        },
      },
    ],
  },
  {
    /* —— 元武国·齐云霄代工（黄枫谷篇·血色禁地后真去元武国：墨蛟材料+千年灵草 → 一炉三件大件）——
     *   考据 ≥2 源：combat-arsenal §3.8 / huangfeng-design 墨蛟链·阵法链 / bigitem-design 首条范本 /
     *   modao-design 裁决3·5（真去元武国代工·首访不遇辛如音·须排在大衍诀演出之前）。
     *   where:"yuanwu" 地点门禁——玩家须真北上元武国方触发；发放在此（增量B 仅立项定义）。 */
    id: "qiyunxiao_daigong",
    where: "yuanwu",
    skipIf: (s) => s.flags.daigong_done,
    cond: (s) => s.flags.dongfu_done && !s.flags.daigong_done,
    objTitle: "北上元武国 · 代工",
    objHint: "携血色禁地的墨蛟皮鳞角，越太岳山脉北上元武国，寻百艺坊巧匠齐云霄代工。",
    title: "代工 · 百艺坊巧匠",
    text(s) {
      const t = [
        { scene: "元武国 · 百艺坊" },
        { bgm: "fair" },
        { shot: "establish" },
        "出黄枫谷北行，过太岳山脉，便是元武国——比胥国更尚武的邻邦。坊市街尾那间「百艺坊」招牌不大，炉火却彻夜不熄。",
        "你解下行囊里那一捆血色禁地的战利品：墨蛟之皮、之鳞、之角，腥气未散。柜后转出一个精瘦汉子，三角眼往那堆料上一扫，先是一亮，随即慢条斯理敲起算盘。",
        { shot: "pushIn" },
        { say: "齐云霄", text: "墨蛟的料？啧——好东西，到了旁人手里是糟蹋。皮可裁帆、角可炼钩、鳞可衬骨。小兄弟，是要快、要狠，还是要稳？" },
        { say: "韩立", text: "都要。" },
        { fx: "flash", color: "#ff7a3a", alpha: 0.2, ms: 400 },
        { sfx: "castHuo" },
        { say: "齐云霄", emo: "smile", text: "痛快！那便一炉三件：神风舟载你赶路，乌龙夺替你搏命；再奉送一张护阵的图——颠倒五行阵，基础的式子，我那口千年灵草的老底，匀你一份作引。" },
        { shot: "pullOut" },
      ];
      // 钩子：探知≥2 → 察觉坊里缺了一个人
      if (s.skills && s.skills.scouting >= 2) {
        t.push({ aside: "坊里似乎还该有个掌账的女子打理这些，却始终不见人影。齐云霄只字未提，你也没多问——有些人，要等再来一趟，才遇得上。" });
      } else {
        t.push({ aside: "坊里似乎还该有个掌账的女子打理这些，却始终不见人影。齐云霄只字未提，你也没多问。" });
      }
      return t;
    },
    onArrive(s) {
      Engine.meetNpc("qiyunxiao", "元武国百艺坊的巧匠，一炉好风火——墨蛟皮、千年灵草这等好料，到他手里方不算糟蹋。");
      Engine.writeLedger("yuanwu_first", "北上元武国百艺坊，会巧匠齐云霄代工——首访不遇辛如音");
    },
    choices: [
      {
        text: "「尽数托付。」把墨蛟的皮鳞角，连同这一程赶路与搏命的指望，都交进这炉火里。",
        effect(s) {
          const made = [];
          if (State.count("wulong_duo") < 1 && State.take("mojiao_jiao", 1)) {
            State.give("wulong_duo", 1);
            made.push("乌龙夺（御物·破甲水属攻击法宝——继金蚨子母刃后的筑基主战法器）");
          }
          if (s.flightId !== "shen_feng_zhou" && State.take("mojiao_pi", 1)) {
            State.take("mojiao_lin", 1);   // 龙骨贴片：有则用，缺亦不阻
            s.flightId = "shen_feng_zhou";
            if (DATA.flightTreasures.shen_feng_zhou) DATA.flightTreasures.shen_feng_zhou.locked = false;
            made.push("神风舟（御风疾驰的小舟形法器——前期赶路全靠它）");
          }
          if (State.count("wuxing_zhen") < 1) {
            State.take("qiannian_lingcao", 1);   // 引子：自带千年灵草则耗，缺则齐云霄以自家老底补
            State.give("wuxing_zhen", 1);
            made.push("颠倒五行阵图·基础版（洞府护阵——他日魔道重逢齐云霄，可加强为「真·颠倒五行阵」）");
          }
          State.setFlag("daigong_done");
          Engine.addMilestone("元武国代工：齐云霄一炉三件（神风舟·乌龙夺·颠倒五行阵基础版）", "bigitem");
          Engine.writeLedger("daigong_done", "墨蛟之料托元武国齐云霄炼成三件大件——神风舟、乌龙夺、颠倒五行阵基础版");
          if (typeof Sfx !== "undefined") Sfx.play("success");
          const body = made.length
            ? "炉火三日不熄。再开炉时——\n\n" + made.map(m => "· " + m).join("\n") + "\n\n齐云霄拍去掌上的灰：「拿好。墨蛟没白杀，你也没白来这一趟。」"
            : "你料囊空空，齐云霄两手一摊：「巧妇难为无米之炊。下回带足墨蛟的料，再来寻我。」";
          return { text: body, kind: "good" };
        },
      },
    ],
  },
  {
    id: "ye_finale",
    where: "huangfeng_gate",
    skipIf: (s) => s.flags.huangfeng_complete,
    cond: (s) => s.flags.dongfu_done && !s.flags.huangfeng_complete,
    bgm: "tense",
    title: "尾声 · 叶师叔之报",
    text(s) {
      const t = [
        { scene: "黄枫谷 · 山门大殿" },
        { shot: "establish" },
        "你筑基后第三个月，黄枫谷出了大事。",
        { shot: "pushIn" },
        { sfx: "danger" },
        "执法堂深夜锁拿叶师叔——罪名是「私通魔道」。卷宗上写得分明：千竹教卧底，潜伏二十年，入谷四连里被他夺走的那枚筑基丹，早顺着暗线送去了魔道。",
      ];
      // 钩子：夺丹之辱 → 对叶师叔落马的回响更深
      if (s.flags.zhuji_dan_stolen) {
        t.push({ aside: "当日满殿无人敢言的那位叶师叔……原来掌门的「不主持公道」，背后还有这一层。那枚被他夺走的筑基丹，竟是从魔道来的暗线。我丢的那枚丹，不过是这条线上不起眼的一环。" });
      } else {
        t.push({ aside: "当日满殿无人敢言的那位叶师叔……原来掌门的「不主持公道」，背后还有这一层。" });
      }
      t.push(
        "可惜执法堂晚了一步。叶师叔越狱遁走，三日后，尸身在谷外百里的乱石滩上被发现——出手的是路过的散修雷万鹤，一击毙命。",
        { say: "马师伯", tone: "soft", text: "千竹教的人，死在自己买凶的路上。报应这东西，从来不缺席，只是不挑时辰。" },
        "执法堂清点叶师叔洞府时，搜出的赃物里有一卷无人能识的功法残卷——神识一触，深奥得叫人头痛。卷首两个古字：大衍。",
        { shot: "pushIn" },
        { aside: "「大衍诀」……执法堂当它是废卷归档了。可那一眼，你记住了——总有一天，它会是你的。" },
      );
      return t;
    },
    onArrive(s) {
      State.setFlag("huangfeng_complete");
      Engine.settleLedger("ye_grudge", "夺丹的叶师叔身败名裂、死于非命——这笔账，世界替你收了");
      Engine.writeLedger("dayan_clue", "叶师叔遗物中那卷「大衍诀」残卷，归档在执法堂库房——你记住了");
      Engine.addMilestone("黄枫谷篇 · 完：伪灵根筑基，谷中立足", "breakthrough");
      if (typeof Sfx !== "undefined") Sfx.play("bell");
    },
    choices: [
      {
        text: "魔道暗流已动——天南，要变天了。（黄枫谷篇·完）",
        hint: "警醒——暗流涌动",
        effect(s) {
          s.mood = Math.max(0, s.mood - 1);
          return { text: "你望向太岳山脉外那片越来越浓的妖氛——天南，真的要变天了。", kind: "event" };
        },
        resolve: "advance",
      },
      {
        text: "「大衍诀……总有一天，它是我的。」先记下这卷残卷。",
        hint: "远虑——记下大衍诀的归处",
        effect(s) {
          State.setFlag("dayan_remembered");
          Engine.writeLedger("dayan_remembered", true);
          return { text: "你没有急着走——在执法堂库房前多停了一步，将那卷残卷的归处牢牢记在心里。", kind: "event" };
        },
        resolve: "advance",
      },
    ],
  },

  /* ============================================================
   * 魔道争锋篇·前置：燕家堡之战（特别篇）——增量D
   *   官方序：风起天南 → 燕家堡之战（特别篇）→ 魔道争锋（22~46话）。
   *   考据 ≥2 源：modao-design §前置·燕家堡之战 + 裁决6（李化元强制进场 / 战王蝉=大BOSS·结不死不休之仇·
   *   本战不诛 / 重逢墨彩环 / 结识董萱儿 / 篇末逃出被七派强征入伍 / ⚠燕家堡≠天阙堡）。
   *   四节点强制链（无 where，靠 flag 门禁顺序自动演出）：调令 → 重逢 → 大BOSS → 逃出强征入伍。
   * ============================================================ */
  {
    id: "yanjia_summon",
    skipIf: (s) => s.flags.yanjia_summoned,
    cond: (s) => s.flags.huangfeng_complete && !s.flags.yanjia_summoned,
    bgm: "tense",
    objTitle: "燕家堡调令",
    objHint: "李化元一纸调令已下——魔道入侵在即，正道七派齐聚燕家堡御魔，伪灵根筑基的你也在征调之列。",
    title: "魔道争锋篇·前置 · 燕家堡调令",
    text(s) {
      const t = [
        { scene: "黄枫谷 · 外门居所" },
        "大衍诀的事还压在心头，谷中一道加急调令便到了你手上——朱漆封口，落款是首席大长老李化元。",
        "「魔道入侵在即。天南正道七派会盟燕家堡，共御魔锋。凡谷中筑基弟子，无论灵根，尽数征调——三日内动身。」",
      ];
      // 钩子：藏拙本能 → 对「无论灵根」的内心反应
      if (s.flags.early_suspicion) {
        t.push({ aside: "无论灵根。这四个字，分明是冲着你这伪灵根来的。修为压制，军令如山——这一回，没有「不去」的选项。……也好。藏拙藏了这么久，也该试试这身修为够不够用了。" });
      } else {
        t.push({ aside: "无论灵根。这四个字，分明是冲着你这伪灵根来的。修为压制，军令如山——这一回，没有「不去」的选项。" });
      }
      t.push(
        { say: "李化元", tone: "cold", text: "你筑基了，便是谷中战力。燕家堡那一战躲不过，与其日后被人推上去送死，不如老夫先把你这条命，用在该用的地方。" },
        "你收拾起神风舟、乌龙夺与那张颠倒五行阵图，望了一眼太岳山脉北面那片越来越浓的妖氛——天南，真的要变天了。",
      );
      return t;
    },
    onArrive(s) {
      Chapters.unlock("modao");
      Chapters.enter("modao");   // activeChapter=modao + location=yanjiabao（realmCap 抬进筑基）
      State.setFlag("yanjia_summoned");
      Engine.writeLedger("yanjia_summon", "李化元强制调令——征调伪灵根筑基的你赴燕家堡，正道七派会盟御魔");
      Engine.addMilestone("魔道争锋篇·前置：燕家堡之战 启（李化元强制进场）", "story");
      if (typeof Sfx !== "undefined") Sfx.play("danger");
    },
    choices: [
      {
        text: "「军令如山。」收拾行装，北上燕家堡。",
        hint: "从命——收拾行装即刻动身",
        effect(s) {
          return { text: "你收拾好行囊，没有多想——军令如山，不是你能抗的。", kind: "event" };
        },
        resolve: "advance",
      },
      {
        text: "「三日内动身……」先多打探一番燕家堡的虚实。",
        hint: "谨慎——多打听一日再走",
        effect(s) {
          s.mood = Math.min(s.moodMax, s.mood + 2);
          State.setFlag("yanjia_recon");
          return { text: "你没有急着动身——先向谷中同门打听了燕家堡的地形与魔道的风声，多一分了解，少一分凶险。", kind: "event" };
        },
        resolve: "advance",
      },
    ],
  },
  {
    id: "yanjia_reunion",
    cg: "yanjia_jiaochang",
    skipIf: (s) => s.flags.yanjia_reunion_done,
    cond: (s) => s.flags.yanjia_summoned && !s.flags.yanjia_reunion_done,
    bgm: "sorrow",
    title: "燕家堡 · 故人重逢",
    text(s) {
      const t = [
        { scene: "燕家堡 · 堡内校场" },
        { amb: "wind" },
        { shot: "establish" },
        "燕家堡——天南正道七派临时会盟的大堡，堡墙旌旗猎猎，堡内却人心惶惶。（这里是燕家，可不是天阙堡——那是更往后的事了。）",
        { shot: "pushIn" },
        "你正寻自己的战位，一道熟悉的身影从避难的墨府家眷中迎面撞来——竟是墨彩环。嘉元城一别，她眉眼间已添了几分风霜。",
        { say: "墨彩环", emo: "cry", text: "韩大哥……真的是你。魔道打过来，爹让我们随墨府避进堡里。你……你也来了。这回，可别又把人丢下不管。" },
        { sfx: "sword" },
        { shot: "panRight" },
        "校场另一头，一位眉眼高华的红拂门下女修按剑而立，目光在你那柄乌龙夺上停了一瞬——后来你才知她姓董，名萱儿。当年陆云风为攀附的，正是她这条线。",
        { say: "董萱儿", tone: "cold", text: "伪灵根能筑基，倒是稀奇。战王蝉就要破阵了——活着出了这堡，再论你够不够格同我说话。" },
      ];
      // 钩子：杀陆云风 → 对董萱儿有额外内心
      if (s.flags.luyunfeng_dead) {
        t.push({ aside: "陆云风为攀附她而杀道侣，死在我手里。她不知道那条线的尽头站着一个杀人灭口的小人——如今这把剑，倒在我面前横起来了。" });
      }
      return t;
    },
    onArrive(s) {
      Engine.meetNpc("mocaihuan", "墨大夫之女、嘉元城墨府小姐——魔道入侵随家眷避入燕家堡，与你重逢。");
      Engine.meetNpc("dongxuaner", "红拂门下名门之后——陆云风当年为攀附她而痛下杀手；燕家堡之战中与你并肩御魔。");
      State.setFlag("yanjia_reunion_done");
      State.setFlag("mocaihuan_reunion");
      Engine.writeLedger("yanjia_reunion", "燕家堡重逢墨彩环、结识董萱儿——魔道入侵下的故人与名门");
      // 因果联动：坊市归途杀陆云风（luyunfeng_dead）→ 陈家暗中相助
      if (s.flags.luyunfeng_dead || (s.ledger && s.ledger.chen_remember)) {
        Engine.log("陈家的人也在堡中——为陆云风一事，陈巧倩那一脉暗中给你递来一囊疗伤丹药，未发一言。这份人情，你记下了。", "event");
      }
      if (typeof Sfx !== "undefined") Sfx.play("chime");
    },
    choices: [
      {
        text: "「都到这步了，谁也别想再把谁丢下。」握紧乌龙夺，列入战阵。",
        hint: "护人——握紧乌龙夺，列入战阵",
        effect(s) {
          s.mood = Math.min(s.moodMax, s.mood + 3);
          return { text: "你握紧乌龙夺，站到墨彩环身前——这一战，你不退。", kind: "event" };
        },
        resolve: "advance",
      },
      {
        text: "「彩环，你跟紧我。」先护住她，再看战局。",
        hint: "先保人——护住墨彩环再论其他",
        effect(s) {
          State.setFlag("yanjia_protect_mocaihuan");
          return { text: "你没有急着列入战阵——先护住墨彩环退到安全处，再转身面对魔道。", kind: "event" };
        },
        resolve: "advance",
      },
    ],
  },
  {
    id: "yanjia_boss",
    cg: "yanjia_xueye",
    skipIf: (s) => s.flags.yanjia_boss_done,
    cond: (s) => s.flags.yanjia_reunion_done && !s.flags.yanjia_boss_done,
    bgm: "boss",
    title: "燕家堡之战 · 战王蝉破阵",
    text(s) {
      const t = [
        { scene: "燕家堡 · 堡墙血夜" },
        { amb: "wind" },
        { sfx: "farRoar" },
        { shot: "shock" },
        { fx: "burst", elem: "tu", n: 18 },
        { sfx: "landDown" },
        "妖氛冲天，堡墙轰然炸裂——魔道巨擘战王蝉破阵而出！甲胄如铁，双镰开阖，振翅之间裂石分风，正道修士成片倒下。",
        { shot: "pushIn" },
        { say: "董萱儿", tone: "cold", text: "它的目标是堡心！挡不住它，今夜谁也活不成——韩立，你那柄破甲的钩子，该出鞘了！" },
      ];
      // 钩子：以毒为先 → 对战王蝉的判断更务实
      if (s.flags.showdown_prep_poison) {
        t.push({ aside: "诛它？这等魔道巨擘岂是今日的你能诛的。撑过它的杀势、活着退出燕家堡——这一战，只为这一个字：活。毒、暗器、乌龙夺——全用上。" });
      } else {
        t.push({ aside: "诛它？这等魔道巨擘岂是今日的你能诛的。撑过它的杀势、活着退出燕家堡——这一战，只为这一个字：活。" });
      }
      t.push({ fight: "zhanwangchan_fight", guard: { hint: "破甲的钩子该出鞘了" } });
      return t;
    },
    choices: [
      { text: "御乌龙夺，迎上战王蝉！（撑过血线即撤离）", resolve: "zhanwangchan_fight" },
    ],
  },
  {
    id: "yanjia_escape",
    cg: "yanjia_kuiwei",
    skipIf: (s) => s.flags.yanjia_done,
    cond: (s) => s.flags.yanjia_boss_done && !s.flags.yanjia_done,
    bgm: "triumph",
    title: "燕家堡 · 逃出生天",
    text(s) {
      const t = [
        { scene: "燕家堡 · 溃围" },
        { shot: "establish" },
        { sfx: "castHuo" },
        { fx: "flash", color: "#ff7a3c", alpha: 0.32 },
        "战王蝉重伤遁空，可燕家堡也守不住了。堡墙四面起火，正道修士护着家眷夺路突围——你断后掩护，护着墨彩环、随董萱儿杀出一条血路。",
        { say: "墨彩环", emo: "cry", text: "你又要走了……我知道你拦不住自己。可你得活着——答应我。" },
        { shot: "tiltUp" },
        { sfx: "danger" },
        "堡外，七派会盟的执旗使早已等在那里。一面「征」字大旗压下来——凡今夜活着出堡的筑基修士，尽数编入魔道争锋的战阵，即刻开赴前线。",
        { say: "执旗使", tone: "cold", text: "活下来的，都是战力。黄枫谷韩立——编入前线待命营，听候征调。魔道争锋，才刚开始。" },
        { shot: "pullOut" },
        { aside: "你回头望了一眼火光里的燕家堡。这一战撑过来了，可真正的修罗场，是前头那一片不知尽头的矿道与杀阵。" },
      ];
      return t;
    },
    onArrive(s) {
      State.setFlag("yanjia_done");
      State.setFlag("modao_conscripted");
      State.data.location = "modao_front";   // 退守前线待命营（home:闭关/调息），矿道箱庭随增量E开
      // 征调时锚：编入待命营后约两月，征调令方下（先给一段闭关备战的喘息，再开矿场硬仗）
      s.flags.modao_call_due = State.absMonth() + 2;
      Engine.writeLedger("modao_conscript", "逃出燕家堡，被七派强征入伍——编入魔道争锋前线待命营，听候征调");
      Engine.addMilestone("魔道争锋篇·启：逃出燕家堡，被强征入伍", "story");
      // 远雷·洞府选址兑现（铁律3）：藏拙者的僻静谷挡不住军令，显达者的灵泉苦修则换来赴战底气——点名出处
      if (Engine.settleLedger("dongfu_pijing", "你把洞府藏进最不打眼的幽谷，自以为神仙难寻——可宗门一纸征令照样找上门来。藏得了是非，藏不过军令。这一课记下了：在七派的棋盘上，棋子无处可藏")) {
        s.mood = Math.max(0, s.mood - 2);
      } else if (Engine.settleLedger("dongfu_lingquan", "灵泉眼这些年事半功倍的苦修，此刻全化作赴战的底气——别的征卒两股战战，你提剑的手却稳。当初为修为险些与灵猿拼命，今日方知值得")) {
        s.mood = Math.min(s.moodMax, s.mood + 2);
      }
      if (typeof Sfx !== "undefined") Sfx.play("bell");
    },
    choices: [
      {
        text: "「这一仗，才刚开始。」随征旗开赴前线。（燕家堡之战·完）",
        hint: "认命——随征旗开赴前线",
        effect(s) {
          s.mood = Math.max(0, s.mood - 3);
          return { text: "你望了一眼火光里的燕家堡，转身随征旗而去——这一仗，才刚开始。", kind: "event" };
        },
        resolve: "advance",
      },
      {
        text: "「彩环，保重。」回头多看她一眼。",
        hint: "牵挂——多看故人一眼",
        effect(s) {
          s.mood = Math.min(s.moodMax, s.mood + 2);
          State.setFlag("yanjia_lookback");
          return { text: "你在人群中回头多看了一眼——墨彩环站在火光里，也在望着你。", kind: "event" };
        },
        resolve: "advance",
      },
    ],
  },

  /* ============================================================
   *  魔道争锋 · 第一幕 · 烽火征调（矿道箱庭）—— 增量E（87~100话）
   *  官方序：燕家堡之战 → 魔道争锋（22~46话）。考据源 docs/modao-design.md §第一幕（用户修订裁决并入 2026-06-16）。
   *  链：征调矿场守备 → 矿洞黑吃黑·阴手宣乐 → 血玉蜘蛛 boss → 机缘房 → 陈巧倩读档分支。
   *  设计取舍：灵宠孵化系统与 L3 矿洞箱庭暂以叙事+直战承载（得卵即立项，孵化随后续篇章实装）；
   *  血玉蜘蛛单形态（多形态随乱星海篇）。陈巧倩未喂忘尘丹线情感戏已执笔（我执笔·考据为据 fate-design §一·待用户定夺）。
   * ============================================================ */
  {
    id: "modao_e1_conscript",
    skipIf: (s) => s.flags.modao_e1_conscript_done,
    cond: (s) => s.flags.modao_conscripted && !s.flags.modao_e1_conscript_done
                 && State.absMonth() >= (s.flags.modao_call_due || 0),
    cg: "kuangchang",   // 黑风岭矿场地表/前线营垒
    bgm: "tense",
    objTitle: "听候征调",
    objHint: "前线待命营——闭关修炼、调息备战（度月即可）。征调令旦夕将至，矿场守备的硬仗在前头等你。",
    title: "魔道争锋·第一幕 · 烽火征调",
    text(s) {
      const t = [
        { scene: "魔道前线 · 黑风岭矿场" },
        { amb: "wind" },
        { shot: "establish" },
        "待命营里熬了些时日，一纸征调令终于压下来——你被拨去黑风岭矿场守备。这片矿脉出产炼器炼丹的灵矿，正魔两道都红了眼，是前线绞肉机般的死争之地。",
        "领你的是个沉默寡言的小队官，姓吕名天蒙，筑基初期。他扫了你一眼，没问灵根，只把一面刻着编号的腰牌丢给你。",
        { shot: "pushIn" },
        { say: "吕天蒙", tone: "声音沉冷", text: "新来的，记住一句话——矿场里活下去，比立功要紧。前头那些『弃子』，就是没记住这句话。" },
        { fx: "flash", color: "#0a0a12", alpha: 0.34, ms: 360 },
        "他抬了抬下巴。矿道口外，几个修为低微的征卒正被推去填魔物的口子——所谓弃子战术，拿人命去探路、去耗魔物的杀招。你望着那几个再没回来的背影，心口发沉。",
      ];
      if (s.flags.early_suspicion) {
        t.push({ aside: "弃子。在这片矿场，伪灵根筑基的你，和那些被推上去的人，本就只隔着一层窗户纸。想活着走出去，就得比谁都清醒。……尤其是，那些笑面虎。" });
      } else {
        t.push({ aside: "弃子。在这片矿场，伪灵根筑基的你，和那些被推上去的人，本就只隔着一层窗户纸。想活着走出去，就得比谁都清醒。" });
      }
      t.push(
        "队伍里还有个总含着浅笑的征卒，唤作宣乐，话不多，眼神却总在人背后转。你说不上哪里不对，只是本能地，不愿把后背交给他。",
        { shot: "pullOut" },
      );
      return t;
    },
    onArrive(s) {
      Engine.meetNpc("lvtianmeng", "黑风岭矿场的征军小队官——待麾下征卒尚存几分照拂，在这冷硬矿场里难得。");
      State.setFlag("modao_e1_conscript_done");
      State.data.location = "modao_front";
      Engine.writeLedger("modao_conscript_post", "拨入黑风岭矿场守备——初识队官吕天蒙，亲见『弃子战术』的冷酷");
      Engine.addMilestone("魔道争锋·第一幕：烽火征调，拨守黑风岭矿场", "story");
      if (typeof Sfx !== "undefined") Sfx.play("danger");
    },
    choices: [
      {
        text: "「我不做弃子。」收起腰牌，打起十二分精神。",
        hint: "警醒——不做弃子",
        effect(s) {
          return { text: "你收起腰牌，心口发沉——在这片矿场，活下去比什么都重要。", kind: "event" };
        },
        resolve: "advance",
      },
      {
        text: "「吕队官，这矿道里……到底藏着什么？」先向他打听虚实。",
        hint: "谨慎——多问一句再入矿",
        effect(s) {
          s.mood = Math.min(s.moodMax, s.mood + 2);
          State.setFlag("modao_e1_ask_lvtianmeng");
          return { text: "你多问了一句——吕天蒙看了你一眼，低声道：“矿道里不只有魔物。有些东西，比魔物更险。”", kind: "event" };
        },
        resolve: "advance",
      },
    ],
  },
  {
    id: "modao_e1_betray",
    skipIf: (s) => s.flags.modao_e1_betray_done,
    cond: (s) => s.flags.modao_e1_conscript_done && !s.flags.modao_e1_betray_done,
    cg: "kuangdong",   // 矿洞坑道
    bgm: "boss",
    heroSkin: "hanli_yexing",   // v213：矿洞黑吃黑·夜行潜行装（场景强制）
    title: "矿洞黑吃黑 · 阴手现形",
    text(s) {
      const t = [
        { scene: "黑风岭 · 矿洞深处" },
        { shot: "establish" },
        { sfx: "landDown" },
        { shot: "shock" },
        { fx: "burst", elem: "tu", n: 16 },
        "一队人奉命深入矿洞清剿渗进来的魔物。行至深处，一声闷响——有人炸了矿！岩层轰然垮塌，烟尘里惨叫四起，整支小队转眼被冲散在塌方与黑暗之间。",
        { fx: "flash", color: "#2a0810", alpha: 0.3, ms: 280 },
        { sfx: "backstab" },
      ];
      if (s.skills && s.skills.scouting >= 1) {
        t.push({ aside: "混乱中你瞥见一道身影贴上了吕天蒙的后背——是宣乐。他脸上那点浅笑终于咧开，一柄淬毒的匕首已抵住队官的命门。……你早觉得这人眼神不对，如今果然露出了马脚。" });
      } else {
        t.push("混乱中你瞥见一道身影贴上了吕天蒙的后背——是宣乐。他脸上那点浅笑终于咧开，一柄淬毒的匕首已抵住队官的命门。");
      }
      t.push(
        { say: "宣乐", tone: "声音阴狠", text: "队官，得罪了。这矿脉底下的好东西，掩月宗惦记很久了……黑吃黑而已，乱矿里死个把人，谁查得清？" },
        { aside: "掩月宗的阴手！平日扮作征卒敛息匿形，专挑这种乱局对自己人下手——这一路阴诡敌型，你还是头一回正面撞上。" },
        "吕天蒙吐着血，用尽最后力气将一截青铜短尺塞进你手里。",
        { say: "吕天蒙", tone: "气若游丝", text: "平天尺……替我，带出去。这条毒蛇，别……别让他得逞——" },
        { shot: "pushIn" },
        "话没说完，人就凉了。宣乐的匕首已转向了你。识破了他的偷袭，退无可退——这一战，替死去的队官，讨回那一刀！",
      );
      return t;
    },
    onArrive(s) {
      State.setFlag("modao_e1_betray_seen");
      State.setFlag("skin_yexing");   // v213：点亮「玄甲夜行」换装窗口选项
      if (!s.flags.pingtian_got) {
        State.give("pingtian_chi", 1);
        State.setFlag("pingtian_got");
        Engine.log("【遗物】吕天蒙拼死塞来的「平天尺」入手——一截不起眼的青铜短尺，他日可炼可参，自成一条法器长线。", "good");
      }
      if (typeof Sfx !== "undefined") Sfx.play("danger");
    },
    choices: [
      { text: "「这一刀，是替吕队官还的。」御剑反杀宣乐！", resolve: "xuanle_fight" },
    ],
  },
  {
    id: "modao_e1_spider",
    skipIf: (s) => s.flags.modao_e1_spider_done,
    cond: (s) => s.flags.modao_e1_betray_done && !s.flags.modao_e1_spider_done,
    cg: "kuangdong",   // 矿洞最深处坑道
    bgm: "boss",
    heroSkin: "hanli_yexing",   // v213：矿洞最深处·夜行潜行装（场景强制）
    title: "矿洞最深处 · 血玉蜘蛛",
    text(s) {
      const t = [
        { scene: "黑风岭 · 矿洞最深处" },
        { shot: "establish" },
        "诛了宣乐，你循着塌方撕开的缺口，摸进了矿洞从未有人到过的最深处。岩壁上密布暗红的丝网，空气里浮着一股腥甜的血气。",
        "缺口尽头，一道古旧的封印阵纹正在崩裂——方才那场炸矿塌方，竟把镇在矿脉底下不知多少年的东西，给震松了。",
        { sfx: "farRoar" },
        { fx: "flash", color: "#7a0a18", alpha: 0.4, ms: 300 },
        { shot: "shock" },
        { fx: "burst", elem: "tu", n: 18 },
        "血光一闪，一头通体血玉甲壳、八足如戟的巨妖自封印中挣出——四级蛛妖，血玉蜘蛛！封印松脱，它狂化在即，猩红的复眼里只剩噬人的疯狂。",
        { shot: "pushIn" },
      ];
      if (s.skills && s.skills.alchemy >= 2) {
        t.push({ aside: "四级妖，气息比寻常筑基还凶悍几分。可它那一身岩穴血玉，是土煞之质——你这身木行道基，正克它。狭路相逢，避无可避：杀了它，或被它吞了。……这妖物周身血气凝而不散，若能辅以克制血煞的丹药，当能事半功倍。" });
      } else {
        t.push({ aside: "四级妖，气息比寻常筑基还凶悍几分。可它那一身岩穴血玉，是土煞之质——你这身木行道基，正克它。狭路相逢，避无可避：杀了它，或被它吞了。" });
      }
      return t;
    },
    onArrive(s) {
      State.setFlag("modao_e1_spider_seen");
      if (typeof Sfx !== "undefined") Sfx.play("danger");
    },
    choices: [
      { text: "「以木克土。」聚起木行剑光，迎上狂化的血玉蜘蛛！", resolve: "xueyu_zhizhu_fight" },
    ],
  },
  {
    id: "modao_e1_fortune",
    skipIf: (s) => s.flags.modao_e1_fortune_done,
    cond: (s) => s.flags.modao_e1_spider_done && !s.flags.modao_e1_fortune_done,
    cg: "jiyuan_shi",   // 蛛妖巢穴尽头机缘石室
    bgm: "triumph",
    title: "矿洞密室 · 机缘",
    text(s) {
      const t = [
        { scene: "矿洞 · 蛛妖巢穴密室" },
        { shot: "establish" },
        "血玉蜘蛛伏诛，你剖开它腹下的卵囊，得了两枚温润的白玉蛛卵——未及孵化，灵机犹存。得卵即立项，这是一条「灵宠」的长线，孵化之法，留待来日。",
        "巢穴尽头还藏着一间石室。室心一座古旧的传送阵盘早已残破熄灭，阵心却嵌着一枚古朴玉令——「大挪移令」。你说不清它的来历，只觉这东西通着某个极遥远的去处。",
        "石室一角的玉匣里，静静躺着一枚赤金色的灵丹。古丹方所炼的「补天丹」，专为补全先天残缺的灵根——对你这伪灵根而言，简直是天赐之物。",
      ];
      if (s.skills && s.skills.alchemy >= 2) {
        t.push({ aside: "补天丹……古丹方所载的补灵圣药，专补先天灵根残缺。以你丹道所学研判，这枚丹品相完好、药力未散，服之可永久增益吐纳之效——伪灵根的桎梏，能松一松了。" });
      } else {
        t.push({ aside: "补天丹……伪灵根的桎梏，能松一松了。" });
      }
      t.push(
        { shot: "pushIn" },
        { fx: "flash", color: "#dff3ff", alpha: 0.5, ms: 700 },
        { fx: "burst", elem: "mu", n: 18 },
        "你当即盘膝服下补天丹。一股暖流游走百脉，残缺的灵根被丝丝补全，往后吐纳百脉之效，永久地长进了一分。",
        { shot: "pullOut" },
      );
      return t;
    },
    onArrive(s) {
      if (!s.flags.modao_e1_fortune_done) {
        State.give("dayi_ling", 1);
        State.setFlag("butian_used");   // 补天丹·服下：修炼速度永久小幅提升（butianMul ×1.10，见 engine.cultivate）
        State.setFlag("lingchong_line_open");
        Engine.writeLedger("lingchong_line", "剖血玉蜘蛛得白玉蛛卵两枚——「灵宠」长线立项，孵化随后续篇章实装");
        Engine.writeLedger("dayi_ling_got", "矿洞古传送阵心得「大挪移令」——一把通往极远之地的钥匙（乱星海长线）");
        Engine.addMilestone("矿洞机缘：得大挪移令·服补天丹·开灵宠长线", "bigitem");
      }
      State.setFlag("modao_e1_fortune_done");
      if (typeof Sfx !== "undefined") Sfx.play("chime");
    },
    choices: [
      {
        text: "收起大挪移令与两枚蛛卵，循原路退出矿洞。",
        hint: "见好就收——不贪不留",
        effect(s) {
          return { text: "你收好三样收获，循原路退出——矿洞里的机缘已尽，多留无益。", kind: "event" };
        },
        resolve: "advance",
      },
      {
        text: "「再搜一搜……」多翻几处角落再走。",
        hint: "贪多——多搜一刻或有意外",
        effect(s) {
          s.mood = Math.min(s.moodMax, s.mood + 2);
          State.setFlag("modao_e1_extra_search");
          return { text: "你又多翻了几处角落——果然在石室偏壁找到一小摄灵矿碎屑，虽不多，聊胜于无。", kind: "good" };
        },
        resolve: "advance",
      },
    ],
  },
  {
    id: "modao_e1_chen_forgot",
    skipIf: (s) => s.flags.modao_e1_chen_done || !(s.ledger && s.ledger.chen_wangchen),
    cond: (s) => s.flags.modao_e1_fortune_done && !s.flags.modao_e1_chen_done
                 && !!(s.ledger && s.ledger.chen_wangchen),
    cg: "kuangchang",   // 前线营垒（矿场地表）
    bgm: "sorrow",
    title: "待命营 · 故人不识",
    text(s) {
      return [
        { scene: "魔道前线 · 待命营" },
        { amb: "wind" },
        { shot: "establish" },
        "退出矿洞，回到待命营。一支运送丹药的队伍正从营门进来——押队的女修一身黄枫谷装束，眉目清冷。是陈巧倩。",
        { aside: "黄枫谷一别，没想到在这魔道前线又遇上她。只是……那枚忘尘丹下去之后，她眼里那段过往，早被你亲手抹去了。" },
        { shot: "focusLeft" },
        { say: "陈巧倩", tone: "语气疏淡", text: "这位道友，借过。前线丹药紧着伤号，闲人莫挡道。" },
        "她的目光在你脸上停了不到一瞬，便淡淡移开，没有半分波澜——她是真的，不记得你了。",
        { aside: "也好。这一世的恩怨牵扯，到此干净两清。她不必记得坊市归途那一夜，也不必记得你欠她、她欠你的那些。就当……从没相识过。" },
        { shot: "pullOut" },
        "你侧身让开。她押着丹药队走远，背影没有一次回头。",
      ];
    },
    onArrive(s) {
      State.setFlag("modao_e1_chen_done");
      State.setFlag("modao_act1_done");
      // 第二幕时锚：第一幕收口后约两月，金鼓原前哨方集结（先给一段前线度月的喘息，再开第二幕）
      s.flags.modao_act2_due = State.absMonth() + 2;
      Engine.writeLedger("chen_qiaoqian_forgot", "前线再遇陈巧倩——忘尘丹既下，她已不识你，平淡道别，恩怨两清");
      Engine.addMilestone("魔道争锋·第一幕·完：故人不识，烽火征调了结", "story");
      if (typeof Sfx !== "undefined") Sfx.play("chime");
    },
    choices: [
      {
        text: "「就当从没相识过。」（魔道争锋·第一幕·完）",
        hint: "释然——恩怨两清",
        effect(s) {
          s.mood = Math.max(0, s.mood - 1);
          return { text: "你侧身让开，看着她走远——就当从没相识过。", kind: "event" };
        },
        resolve: "advance",
      },
      {
        text: "「……保重。」低声说了一句，她听不见。",
        hint: "低语——她已不记得，你却还没忘",
        effect(s) {
          s.mood = Math.max(0, s.mood - 3);
          State.setFlag("chen_forgot_murmur");
          return { text: "你低声说了两个字——她已走远，自然听不见。可你心里清楚，有些事忘了比记着好。", kind: "event" };
        },
        resolve: "advance",
      },
    ],
  },
  {
    id: "modao_e1_chen_remember",
    skipIf: (s) => s.flags.modao_e1_chen_done || !!(s.ledger && s.ledger.chen_wangchen),
    cond: (s) => s.flags.modao_e1_fortune_done && !s.flags.modao_e1_chen_done
                 && !(s.ledger && s.ledger.chen_wangchen),
    cg: "kuangchang",   // 前线营垒（矿场地表）
    bgm: "sorrow",
    title: "待命营 · 故人相识",
    text(s) {
      return [
        { scene: "魔道前线 · 待命营" },
        { amb: "wind" },
        { shot: "establish" },
        "退出矿洞，回到待命营。一支运送丹药的队伍正从营门进来——押队的女修一身黄枫谷装束，眉目清冷。是陈巧倩。",
        { aside: "当年那枚忘尘丹，你终究没让她服下。于是黄枫谷的恩怨、坊市归途那一夜，她都还记着——记着你。" },
        // —— 增量E·我执笔·考据为据（fate-design §一·黄枫谷未喂忘尘丹线）·待用户定夺 ——
        // 锚点：未喂忘尘丹→她记得救命之恩与坊市那夜；白菊山表白尚在将来，此刻情愫未宣、唯劫后重逢；
        //       韩立伪灵根·谨身自保、藏拙守距（in-character，不臆造越界的情爱）；埋「郁结」分野→白菊山之约窗口。
        "她本垂着眼清点药匣，目光扫过让道的人群，在你脸上倏地一顿——那一顿里，清冷的眉眼霎时漾开，又被她极快地收住，只剩指尖捏着药匣，微微发紧。",
        { shot: "pushIn" },
        { say: "陈巧倩", emo: "sad", tone: "声音微不可察地一颤", text: "……韩师弟。真的是你。" },
        { say: "陈巧倩", emo: "sad", tone: "话放得极轻，怕惊散了什么", text: "我听闻黑风岭矿场守备死了大半，名册上又迟迟不见你的牌号……我还当，这一面是再见不着了。" },
        "她到底没把那句话说尽。当着满营征卒，押队的女修把翻涌的心绪压回那身清冷底下，只是看你的眼神，比黄枫谷那年要深得多。",
        { aside: "她记得。坊市归途那一夜你拼死护下的人，终究没忘。那枚没喂下去的忘尘丹，让她把这一点记挂，一路揣到了这刀山火海的前线。" },
        { say: "韩立", emo: "cold", tone: "拱手，话说得淡", text: "巧倩师姐。让师姐挂心了。矿洞塌方，侥幸捡回条命——命大而已，当不得什么。" },
        { aside: "你刻意把话头压平。伪灵根走到今日，全凭不与人深交、不教人看清深浅——这魔道前线更是如此。她待你的这份好，你领；可这份情，你给不起，也不敢接。" },
        "陈巧倩看着你这副疏淡模样，唇瓣动了动，欲言又止，终是将一只青玉小瓶搁进你掌心——是上等的疗伤丹。",
        { say: "陈巧倩", emo: "sad", tone: "低声", text: "前线不比黄枫谷，刀剑无眼。这个你收着……我不图你记着我什么，只盼你能活着走出去。" },
        { aside: "你握着那只尚带她掌心温度的玉瓶，心里某处微微一动，又被你稳稳按了下去。仙凡修途各有各的劫——有些话此刻说不得，有些约，也要留给往后的山水。" },
        { shot: "pullOut" },
        "丹药队在营门外催着启程。她押队远去，这一回，走出几步，到底回了一次头。",
        { aside: "黄枫谷那年她说，凡有陈家在的地方，必有你一席。如今看来，这一席，她还替你留着。来日方长——若真有缘再见，总该有个交代。" },
      ];
    },
    onArrive(s) {
      State.setFlag("modao_e1_chen_done");
      State.setFlag("modao_act1_done");
      // 第二幕时锚：第一幕收口后约两月，金鼓原前哨方集结
      s.flags.modao_act2_due = State.absMonth() + 2;
      Engine.writeLedger("chen_qiaoqian_remember", "前线再遇陈巧倩——忘尘丹未下，她仍记得你：劫后重逢、赠疗伤丹、情愫未宣，埋下白菊山之约的伏笔");
      State.setFlag("chen_front_reunion");   // 白菊山之约（fate baiju_appt）前置：她仍记挂你
      Engine.addMilestone("魔道争锋·第一幕·完：故人相识，前路未了", "story");
      if (typeof Sfx !== "undefined") Sfx.play("chime");
    },
    choices: [
      {
        text: "「巧倩师姐。……是我。」（魔道争锋·第一幕·完）",
        hint: "回应——接下这份情",
        effect(s) {
          s.mood = Math.min(s.moodMax, s.mood + 3);
          return { text: "你接下那只青玉瓶——掌心的温度，你知道这份情，你欠着。", kind: "event" };
        },
        resolve: "advance",
      },
      {
        text: "「师姐，前线凶险，你也保重。」退一步，保持距离。",
        hint: "克制——领情但不越界",
        effect(s) {
          State.setFlag("chen_remember_restrain");
          return { text: "你退了一步，将玉瓶收好——这份情你领了，可你给不起更多。藏拙守距，是为你好，也是为我好。", kind: "event" };
        },
        resolve: "advance",
      },
    ],
  },

  /* ============================================================
   *  魔道争锋·第二幕·金鼓原前线相持（增量F）
   *  考据源：docs/modao-design.md §一·节点表 ep27~30 + §二 + 修订裁决 #1
   *  （金鼓原大决战/灵兽山倒戈/菡长老内奸已移「再别天南」，本篇只做小型前线相持）。
   *  顺序流五节点：前哨集结 → 巡逻遭遇战 → 董萱儿被掳暗线 → 南宫婉吃醋告别 → 赴京。
   *  时锚 modao_act2_due 由第一幕两条 chen 分支 onArrive 埋（收口后约两月方集结），
   *  故第一幕一收，主线先挂在前线度月的喘息里，不会紧接着第二幕直弹（守 journey.test 断言）。
   * ============================================================ */
  {
    id: "modao_e2_muster",
    skipIf: (s) => s.flags.modao_e2_muster_done,
    cond: (s) => s.flags.modao_act1_done && !s.flags.modao_e2_muster_done
                 && State.absMonth() >= (s.flags.modao_act2_due || 0),
    cg: "kuangchang",
    bgm: "tense",
    title: "金鼓原 · 前哨集结",
    text: [
      { scene: "魔道前线 · 金鼓原" },
      { amb: "wind" },
      { shot: "establish" },
      "两月过去。黑风岭的矿洞守备换防，你这一队征卒被拨往更北的金鼓原——七派征军与黑煞教魔修在这片焦土上隔原相持，已僵了小半年。",
      "前哨营盘扎在一道矮坡后。集结的号角里，几名筑基修士陆续到帐——比起黑风岭那些苦熬的征卒，这些是真正能上阵的同袍。",
      { shot: "pushIn" },
      { say: "刘靖", tone: "声音方正", text: "黄枫谷刘靖。听闻这一队里有个伪灵根筑基的——是你？" },
      { aside: "你拱手称是，已做好了被轻看的准备。出乎意料，那叫刘靖的修士只是上下打量你一眼，神色反倒郑重了几分。" },
      { say: "刘靖", text: "伪灵根能走到筑基，是自己一寸寸挣来的。同袍面前，没人有资格小看你。——魔道役尸为傀，伤天害理，这一仗，并肩。" },
      "他身后还立着三人：稳重持珠的宋蒙、叉腰啐声的钟卫娘，与一个年纪轻轻、嗷嗷好斗的武炫。",
      { say: "钟卫娘", tone: "心直口快", text: "伪灵根？我只问你打不打得过魔修。打得过，就是好同袍——打不过，宋师兄给你收尸！" },
      { say: "宋蒙", tone: "不疾不徐", text: "卫娘。……韩道友，前线相持最忌浮躁，沉住气。活着，比立功要紧。" },
      { say: "武炫", emo: "smile", tone: "咧嘴", text: "别听他们文绉绉的！韩兄，回头巡逻遇上魔修，你护中路，喽啰交给我——嗷！" },
      { shot: "pullOut" },
      { aside: "你默默记下这四张脸。藏拙惯了的人，难得在这刀山火海的前线，遇上几个肯把后背交给你的同袍。这份善缘，记账。" },
    ],
    onArrive(s) {
      State.setFlag("modao_e2_muster_done");
      Engine.meetNpc("liujing", "黄枫谷除魔卫道之楷模——金鼓原前哨集结时不轻你伪灵根，反生惜才之意；身负祖传真宝凤凰符。");
      Engine.meetNpc("songmeng", "黄枫谷稳重师兄，持护身大件重元珠；与刘靖之间似有一段不便明言的旧渊源。");
      Engine.meetNpc("zhongweiniang", "黄枫谷心直口快的女修，常与宋蒙同行——刀子嘴，倒不是坏心。");
      Engine.meetNpc("wuxuan", "金鼓原七派同袍，年轻气盛好勇斗狠——是前线难得让人省心的一把好手。");
      Engine.writeLedger("modao_muster", "金鼓原前哨集结：结识黄枫谷刘靖/宋蒙/钟卫娘与七派武炫，结下并肩同袍之谊");
      Engine.addMilestone("魔道争锋·第二幕·启：金鼓原前哨集结，同袍并肩", "story");
      if (typeof Sfx !== "undefined") Sfx.play("chime");
    },
    choices: [
      {
        text: "「韩立。承蒙诸位不弃。」",
        hint: "坦诚——报上真名",
        effect(s) {
          s.mood = Math.min(s.moodMax, s.mood + 3);
          return { text: "你拱手报上真名——藏拙归藏拙，同袍面前，不必再藏。", kind: "event" };
        },
        resolve: "advance",
      },
      {
        text: "「在下韩某。灵根低微，只盼不拖诸位后腿。」",
        hint: "谦抑——低调自居",
        effect(s) {
          State.setFlag("modao_e2_humble");
          return { text: "你报了个「韩某」，将身段压到最低——同袍是好意，可你习惯了不把底牌亮给人看。", kind: "event" };
        },
        resolve: "advance",
      },
    ],
  },
  {
    id: "modao_e2_patrol",
    skipIf: (s) => s.flags.modao_e2_patrol_done,
    cond: (s) => s.flags.modao_e2_muster_done && !s.flags.modao_e2_patrol_done,
    cg: "kuangchang",
    bgm: "tense",
    title: "金鼓原 · 巡逻遭遇战",
    text: [
      { scene: "魔道前线 · 金鼓原焦土" },
      { shot: "establish" },
      { sfx: "danger" },
      { shot: "shock" },
      "轮到你与武炫一队出哨。焦土上腥风阵阵，没走多远，前方残垣后忽地窜出三道人影——黑袍束发、煞气缭绕，是黑煞教外围的魔修游猎小队。",
      "为首一个手提血煞长镰，脚边半拖着两具被阴纹符箓驱动的尸傀；身后两名喽啰呈犄角散开，竟隐隐结成一张小阵。",
      { say: "武炫", tone: "压低嗓子", text: "韩兄留神——这帮魔修惯走群阵，领队在，那俩喽啰就缠成一团网。" },
      { say: "武炫", emo: "smile", tone: "舔了舔牙", text: "可领队一倒，剩下的就是各自逃命的乌合之众。擒贼先擒王——先斩那提镰子的！" },
      { shot: "pushIn" },
      { aside: "你头一回正面会魔修的「群阵」。那领队行的是土煞尸气，正撞你木行道基的相克——啃得动。心念电转间，你已看准了破阵的眼：那柄血煞镰后头那张脸。" },
    ],
    choices: [
      { text: "擒贼先擒王——先斩领队！（迎战魔修小队）", resolve: "moxiu_patrol_fight" },
    ],
  },
  {
    id: "modao_e2_dongxuaner",
    skipIf: (s) => s.flags.modao_e2_dongxuaner_done,
    cond: (s) => s.flags.modao_e2_patrol_done && !s.flags.modao_e2_dongxuaner_done,
    cg: "kuangchang",
    bgm: "sorrow",
    title: "金鼓原 · 暗线·一纸急报",
    text: [
      { scene: "魔道前线 · 金鼓原" },
      { amb: "wind" },
      { shot: "establish" },
      "巡逻收兵回营，营里却乱作一团。一骑染血的探马刚从侧翼撤回，带来一桩噩耗——",
      { shot: "pushIn" },
      "随正道大军压上的红拂门一队，前日在东翼遇袭溃散。门中那位名门之后董萱儿，乱军里失了踪影，据逃回的散卒说，是被一股魔道高手裹挟着，往魔道腹地去了。",
      { aside: "董萱儿。燕家堡那一夜与你并肩御魔、杀出血路的红拂女修。你握剑的手紧了一紧——那夜战王蝉重伤遁空，原来这笔账，魔道一直没忘。" },
      { say: "探马", tone: "气喘", text: "……据说，掳她的是冲着她红拂门下的身份来的，要解去合欢宗一位姓云的老祖处『验明正身』。具体为何，无人知晓。" },
      { aside: "合欢宗、云露、验身份……这些名字你一个也搭不上。可你记下了。前线之大，你眼下救不得她——但这条断线，总有接上的一日。（伏笔归账·再别天南显影）" },
    ],
    onArrive(s) {
      State.setFlag("modao_e2_dongxuaner_done");
      Engine.writeLedger("dongxuaner_captured", "金鼓原急报：董萱儿于侧翼溃战中被魔道掳走，将解往合欢宗云露处『验身份』——燕家堡同袍之厄，暗线归账（再别天南显影）");
      Engine.addMilestone("魔道争锋·第二幕·暗线：董萱儿被掳，断线待续", "story");
      if (typeof Sfx !== "undefined") Sfx.play("chime");
    },
    choices: [
      {
        text: "「这笔账，记下了。」",
        hint: "隐忍——记下这笔账，待来日",
        effect(s) {
          return { text: "你将这条断线记在心里——眼下救不得她，可这笔账，总有清算的一天。", kind: "event" };
        },
        resolve: "advance",
      },
      {
        text: "「……董萱儿。」攥紧拳头，暗暗咬牙。",
        hint: "愤懑——怒而无力",
        effect(s) {
          s.mood = Math.max(0, s.mood - 2);
          State.setFlag("modao_e2_dongxuaner_rage");
          return { text: "你攥紧拳头——燕家堡那一夜并肩杀出血路的人，就这么被掳走了。可你眼下，连自保都勉强。", kind: "event" };
        },
        resolve: "advance",
      },
    ],
  },
  {
    id: "modao_e2_nangongwan",
    skipIf: (s) => s.flags.modao_e2_nangongwan_done,
    cond: (s) => s.flags.modao_e2_dongxuaner_done && !s.flags.modao_e2_nangongwan_done,
    cg: "kuangchang",
    bgm: "daily",
    title: "金鼓原 · 一枚炒栗子",
    // —— 【修#6·南宫婉吃醋分寸】我执笔取「轻糖·克制」一路（已对齐 fate-design 正宫线之根/血色之夜未越界基调）：
    //    含栗吃醋＝一个小动作（弹来一枚炒栗子）+ 三两句旁敲侧击，她以清冷掩心绪、不点破；
    //    韩立藏拙木讷、真没听懂——糖而不腻、不臆造越界情爱，留白给白菊山/正宫线的将来。两线（陈巧倩识/不识）通吃。
    text: [
      { scene: "魔道前线 · 金鼓原营侧" },
      { amb: "candle" },
      { shot: "establish" },
      "营侧背风处，一道白衣身影正立在火堆边烘手——掩月宗这回也派了人押阵前线，南宫婉竟也在金鼓原。血潭一别，再见已是这刀光剑影的所在。",
      { say: "南宫婉", emo: "cold", text: "韩立。立碑的立。——还活着。" },
      { say: "韩立", emo: "cold", tone: "拱手", text: "南宫道友。……侥幸。" },
      { sfx: "pick" },
      "她“嗯”了一声，伸手从火堆边的瓦罐里捻起一枚炒得焦香的栗子，指尖一弹——那栗子不偏不倚，正打在你胸口，又落进你掌里，兀自温热。",
      { say: "南宫婉", emo: "cold", tone: "语气淡得听不出情绪", text: "听说……前几日有位押丹药的黄枫谷女修，在你这队里停了好一会儿。盯着你看的。" },
      { say: "南宫婉", tone: "拨了拨火，没看你", text: "前线人多眼杂。韩师弟的『艳福』，倒比你那点修为来得显眼。" },
      { aside: "你被这没头没脑的一句问得怔住，老老实实想了半天，只当她是提点你前线少惹是非，便郑重应道——" },
      { say: "韩立", emo: "cold", text: "道友放心。在下伪灵根之身，一向谨言慎行，绝不敢因私废了军务。" },
      "南宫婉拨火的手一顿，侧过脸深深看了你一眼，那眼神里似有千言，最终只化作一声极轻的嗤笑，眉眼间的清冷竟柔和了一瞬。",
      { shot: "pushIn" },
      { say: "南宫婉", emo: "smile", tone: "低声，几不可闻", text: "……木头。" },
      { aside: "你没听清那两个字。她已敛了神色，将瓦罐往你这边推了推，转身要走——掩月宗另有调遣，她得回西线去了。" },
      { say: "南宫婉", emo: "cold", text: "栗子给你。——别死在京城。听说你要随征军开赴京城了，那地方水深，比这焦土更杀人。" },
      { shot: "pullOut" },
      { aside: "她白衣一卷，没入营帐间的人流，再没回头。你低头看着掌心那枚渐凉的炒栗子，又看看她留下的半罐——心里某处微微一动，却到底没琢磨明白。仙凡修途各有各的劫，有些情分，你眼下还接不住，也辨不清。（正宫线·留白·此生缓续）" },
    ],
    onArrive(s) {
      State.setFlag("modao_e2_nangongwan_done");
      State.setFlag("nangongwan_jingcheng_farewell");   // 正宫线·金鼓原一别（fate 正宫线窗口）
      Engine.writeLedger("nangongwan_chestnut", "金鼓原营侧重逢南宫婉——她含栗吃醋、旁敲侧击你与黄枫谷女修的传闻，你木讷未解；她留半罐炒栗、叮嘱『别死在京城』，转身赴west线");
      Engine.addMilestone("魔道争锋·第二幕：金鼓原一别，一枚炒栗子", "story");
      if (typeof Sfx !== "undefined") Sfx.play("chime");
    },
    choices: [
      {
        text: "「……多谢。道友珍重。」（揣好那枚炒栗子）",
        hint: "珍重——揣好栗子，目送她走",
        effect(s) {
          s.mood = Math.min(s.moodMax, s.mood + 2);
          return { text: "你揣好那枚炒栗子——温热渐凉，却一直贴在胸口。", kind: "event" };
        },
        resolve: "advance",
      },
      {
        text: "「道友也保重。西线凶险。」",
        hint: "回关——叮嘱她也保重",
        effect(s) {
          s.mood = Math.min(s.moodMax, s.mood + 3);
          State.setFlag("nangongwan_reciprocal");
          return { text: "你罕见地多了一句——她脚步微微一顿，没有回头，却微微点了点头。", kind: "event" };
        },
        resolve: "advance",
      },
    ],
  },
  {
    id: "modao_e2_jingcheng",
    skipIf: (s) => s.flags.modao_e2_jingcheng_done,
    cond: (s) => s.flags.modao_e2_nangongwan_done && !s.flags.modao_e2_jingcheng_done,
    cg: "departure",
    bgm: "journey",
    title: "金鼓原 · 赴京",
    text: [
      { scene: "魔道前线 · 拔营" },
      { shot: "establish" },
      "金鼓原的相持，到底没等来一场决战。魔道主力忽然回缩，七派征军接令——抽调一部精锐，随大军开赴京城。",
      { aside: "京城。胥国的心脏。魔道争锋这盘棋，真正的杀招，原来不在这片焦土，而在那座金粉楼台之下。南宫婉那句『别死在京城』，此刻想来，竟是一语成谶的提点。" },
      { shot: "trackLeft" },
      "你随宋蒙、刘靖、钟卫娘、武炫几位同袍一道拔营。焦土在身后渐远，前路是天子脚下、暗流汹涌的繁华京华。",
      { shot: "pullOut" },
      { aside: "前线相持的练兵，到此告一段落。你按了按行囊里那捧缴获的傀儡残件，又摸了摸怀中渐凉的炒栗子——这两样，一明一暗，都将在那座京城里，等着各自的回响。（魔道争锋·第二幕·完）" },
    ],
    onArrive(s) {
      State.setFlag("modao_e2_jingcheng_done");
      State.setFlag("modao_act2_done");
      // 第三幕时锚（京城暗流·待实装）：赴京途中约一月抵京，先留出窗口
      s.flags.modao_act3_due = State.absMonth() + 1;
      Engine.writeLedger("modao_to_jingcheng", "金鼓原相持收束，随征军精锐开赴京城——魔道争锋的真正杀招在天子脚下");
      Engine.addMilestone("魔道争锋·第二幕·完：拔营赴京，京城暗流将起", "story");
      if (typeof Sfx !== "undefined") Sfx.play("chime");
    },
    choices: [
      {
        text: "「赴京。」（魔道争锋·第二幕·完）",
        hint: "从命——随军赴京",
        effect(s) {
          return { text: "你随征军拔营北上——京城在前方等着。", kind: "event" };
        },
        resolve: "advance",
      },
      {
        text: "「京城……水深。」摸了摸怀中的炒栗子，暗暗提防。",
        hint: "警醒——京城水深，提前留心",
        effect(s) {
          s.mood = Math.max(0, s.mood - 1);
          State.setFlag("modao_e2_jingcheng_alert");
          return { text: "你没有因为拔营而松懈——南宫婉那句「别死在京城」，你记着。", kind: "event" };
        },
        resolve: "advance",
      },
    ],
  },

  /* ============================================================================
   * 魔道争锋 · 第三幕 · 京城暗流（增量G，ep31~36）——京城箱庭
   * 考据源：docs/modao-design.md §一·节点 30~36 + §二·第三幕（用户修订裁决已并入）。
   * 顺序五节点：入京·萧翠儿+秦府门房哭戏 → 连环失踪案·情报面纱（蒙山五友/intel 计数·复用
   *   story 选项的乘法设计，不另起 exploremap 箱庭，情报量定皇宫战难度）→ 馨王府夜宴·墨彩环重逢
   *   【修#2·占位待亲笔】→ 血侍铁罗血茧遁走（可逃逸 boss 首演·仇恨账本跨场）→ 五色门收口·诛
   *   王管事为墨彩环报仇（墨府之祸总兑现·妖化 boss，挂 Act4 时锚）。
   *   灵兽山收编蒙山五友（节点34「敢问想当英雄」）只作台词钩，不另起灵兽山箱庭（避修订裁决外内容）。
   * ========================================================================== */
  {
    id: "modao_e3_rujing",
    skipIf: (s) => s.flags.modao_e3_rujing_done,
    cond: (s) => s.flags.modao_act2_done && !s.flags.modao_e3_rujing_done && State.absMonth() >= (s.flags.modao_act3_due || 0),
    cg: "jingcheng",
    bgm: "town",
    title: "京城 · 天子脚下",
    objTitle: "入京",
    objHint: "随征军抵京——天子脚下，暗流将起。",
    text: [
      { scene: "胥国京城 · 朱雀长街" },
      { amb: "crowd" },
      { shot: "establish" },
      "金粉楼台，车马如流。随征军一路开抵京城，焦土的血腥气还没散尽，眼前已是天下最繁华的金粉之地。你这等外来的筑基修士，在京城权贵眼里，不过是又一个被征调来听用的『客卿』。",
      "长街拐角，一个挎着花篮的小姑娘脆生生地拦住你，篮里的栀子开得正好。",
      { shot: "pushIn" },
      { say: "萧翠儿", emo: "smile", text: "这位公子，买朵花吧？今早现摘的，可新鲜啦——戴在身上，京城的晦气都冲散咯！" },
      { aside: "小姑娘叫萧翠儿，跟相依为命的萧爷爷住在巷尾。她眼睛亮得很，三两句就看出你不是寻常人——却也不怕，只当是桩新鲜事。市井的暖意，是这冷硬京城里难得的一点人气。" },
      { say: "萧翠儿", tone: "歪着头，忽然认真", text: "公子……我听说有种神仙，能不老不死。像我爷爷那样的普通人，是不是这辈子，都没那个福气呀？" },
      { aside: "你怔了一下。这问题，你在嘉元城墨府里、被另一个古灵精怪的小姑娘问过一模一样的一句——你那时答不上来，此刻依旧。仙凡之间那道沟，不是一句话填得平的。" },
      { scene: "秦府 · 客卿门第" },
      { shot: "establish" },
      "随征军荐你入秦府做客卿。那看门的老门房替你引路，一路点头哈腰、堆着笑脸，絮絮叨叨说着府里的体面、修仙老爷的神通——说着说着，那张笑脸却忽然皱起来，浑浊的老眼里滚下泪来。",
      { shot: "pushIn" },
      { say: "秦府老门房", tone: "抹着眼角，自己也不好意思", text: "公子莫笑……老汉是欢喜的。能伺候上仙长这样的贵人，是几辈子修来的福分……可一想，老汉这把骨头，到底是凡胎，眼睁睁看着儿孙也都是凡胎，熬不过这几十年的命……就，就忍不住……" },
      { aside: "他笑着笑着就哭了。你站在朱门之下，第一次这样近地，从一个凡人的眼睛里，看见『修仙者』四个字落在尘世里的分量——是仰望，是欢喜，也是一道永远跨不过去的、无声的悲凉。" },
    ],
    onArrive(s) {
      State.setFlag("modao_e3_rujing_done");
      Engine.meetNpc("xiaocui", "京城市井卖花的小姑娘，聪慧伶俐——她问了你那个墨彩环问过的问题：凡人，是不是没福气修仙。");
      Engine.writeLedger("modao_rujing", "随征军入京、入秦府做客卿——市井偶遇萧翠儿爷孙，秦府老门房『笑着笑着就哭了』：头一回从凡人眼里看清『修仙者』落在尘世的分量");
      Engine.addMilestone("魔道争锋·第三幕·京城暗流：入京（萧翠儿·秦府门房哭戏）", "story");
      if (typeof Sfx !== "undefined") Sfx.play("chime");
    },
    choices: [
      {
        text: "「老人家言重了。」（默然记下这一幕）",
        hint: "默然——记下这一幕",
        effect(s) {
          s.mood = Math.max(0, s.mood - 1);
          return { text: "你默然站在朱门之下——仙凡之间的那道沟，不是一句话填得平的。", kind: "event" };
        },
        resolve: "advance",
      },
      {
        text: "「老人家，你好好保重。」多宽慰他一句。",
        hint: "温言——宽慰凡人",
        effect(s) {
          s.mood = Math.min(s.moodMax, s.mood + 2);
          State.setFlag("modao_e3_comfort_doorkeeper");
          return { text: "你多停了一步，宽慰了那老门房两句——他抹了抹眼角，笑了，说“公子心善”。", kind: "event" };
        },
        resolve: "advance",
      },
    ],
  },
  {
    id: "modao_e3_shizong",
    skipIf: (s) => s.flags.modao_e3_shizong_done,
    cond: (s) => s.flags.modao_e3_rujing_done && !s.flags.modao_e3_shizong_done,
    cg: "jingcheng",
    bgm: "tense",
    title: "京城 · 连环失踪案",
    objTitle: "查案",
    objHint: "京城散修接连失踪——查清底细，情报越足，皇宫决战越有把握。情报买得越全，越能从风声里挖出黑煞教藏起来的杀招（譬如那位深藏不露的『第五血侍』）；皇宫决战时，同袍的一条命，可能就系在这条线报上。",
    text: [
      { scene: "京城 · 茶楼" },
      { shot: "establish" },
      "京城近来不太平：散修接二连三地失踪，活不见人、死不见尸。手法干净利落、专挑落单的修士下手——不像魔道一贯的张扬作风，倒像是有人在悄没声地『收割』。",
      "茶楼雅座里，五个散修凑作一桌低声议事。为首的拱手招呼你——蒙山五友，自炼气十层到圆满不等，结义抱团、消息灵通，是这京城里最肯透底的一拨地头蛇。",
      { shot: "pushIn" },
      { say: "蒙山五友", tone: "压低声音", text: "这位道友面生啊。京城的水深，想打听失踪案……多少得先递个投名状。情报不是白给的——可你要真想除了那害人的东西，我们五个，到时候算你一份。" },
      "话音未落，巷口传来一阵急促的脚步——是萧翠儿，小脸煞白，眼泪糊了满脸。",
      { sfx: "danger" },
      { shot: "pushIn" },
      { say: "萧翠儿", emo: "cry", text: "韩公子！我爷爷……我爷爷昨夜被『怪物』抓走了！邻里都说，是那专吃人的妖邪……公子你神通广大，求求你救救爷爷！" },
      { aside: "翠儿的爷爷，也卷进了这桩连环失踪案。线索千头万绪：蒙山五友手里有加密的消息、茶楼是消息的集散、翠儿的聪慧又能顺藤摸瓜。怎么查，是你的事——查得越透，等真捣了贼窝，胜算越大。" },
    ],
    onArrive(s) {
      State.setFlag("modao_e3_shizong_done");
      Engine.meetNpc("mengshan_wuyou", "京城讨生活的五个散修，结义抱团、消息灵通——连环失踪案里最肯透底的线人。");
      Engine.writeLedger("modao_shizong", "京城连环失踪案浮出：散修接连被『怪物』掳走，手法不像魔道作风；结识蒙山五友、萧翠儿爷爷亦遭掳——查案情报量将决定皇宫决战难度");
      Engine.addMilestone("魔道争锋·第三幕：连环失踪案（蒙山五友登场·翠儿求救）", "story");
      if (typeof Sfx !== "undefined") Sfx.play("danger");
    },
    // —— 情报面纱·京城版（复用 story 选项的乘法设计，不另起 exploremap 箱庭）：
    //    三档查案投入 → s.flags.jingcheng_intel(0/1/2) 持久存档，第四幕皇宫决战据此调难度（情报足=看穿伏兵/先手）。
    choices: [
      { text: "花重金买齐蒙山五友的消息，再亲自蹲茶楼、以神识窃听（情报最全·可挖出黑煞教藏起来的杀招）",
        hint: "情报拉满才能摸到贼首藏的后手——这条线报，皇宫决战时或能救同袍一命。",
        effect: (s) => {
          s.flags.jingcheng_intel = 2;
          s.flags.jingcheng_xueshi_intel = true;   // 第四幕刘靖之命「示警」改命口：唯情报拉满者才挖到「第五血侍/教主伪装」线报
          s.worldNews = s.worldNews || [];
          s.worldNews.push({ t: `第${s.year}年${s.month}月`, kind: "rumor", text: "【线报·重金购得】黑煞教真正的杀招藏在暗处：贼首身边豢养血侍，其中第五名从不露面、最是诡谲——据说常伪作无害凡人、混在人前伺机暴起。皇宫决战，须防这一手阴的（风云录可复看）。" });
          if (s.worldNews.length > 40) s.worldNews.splice(0, s.worldNews.length - 40);
          return { text: "你舍得下本钱：蒙山五友的加密茶话、各坊失踪者的时辰路径、煞气流向的蛛丝马迹——尽数摸清。更紧要的是，你从一条加密茶话里抠出一桩隐秘：黑煞教那第五名血侍从不露面、惯于伪作凡人潜伏。贼窝的虚实，已了然于胸（情报·full；这条『第五血侍』线报已记入风云录）。", kind: "good" };
        },
        resolve: "advance" },
      { text: "顺着翠儿的聪慧追踪，配蒙山五友递来的零星线索（折中）",
        effect: (s) => { s.flags.jingcheng_intel = 1; return { text: "翠儿带你认了爷爷失踪前走过的巷子，蒙山五友又递来几条线头。脉络渐明，却仍有暗处看不真切（情报·half）。", kind: "event" }; },
        resolve: "advance" },
      { text: "不耐烦细查，循着煞气直捣黄龙（急进·情报最少）",
        effect: (s) => { s.flags.jingcheng_intel = 0; return { text: "你按捺不住，循着隐约的血煞之气径直追下去——快是快，可贼窝里藏了多少爪牙、布了什么后手，你一概不知（情报·none）。", kind: "bad" }; },
        resolve: "advance" },
    ],
  },
  {
    id: "modao_e3_yanhui",
    skipIf: (s) => s.flags.modao_e3_yanhui_done,
    cond: (s) => s.flags.modao_e3_shizong_done && !s.flags.modao_e3_yanhui_done,
    cg: "wangfu_yan",
    bgm: "sorrow",
    title: "馨王府 · 夜宴重逢",
    objTitle: "夜宴",
    objHint: "馨王府夜宴——京城权贵云集，故人或在其中。",
    text: [
      { scene: "馨王府 · 夜宴" },
      { shot: "establish" },
      "查案的线头牵到馨王府。这位王爷广结方士术士，府中夜宴丝竹喧阗、冠盖如云。你混在客卿之列入席，目光在满堂珠翠间逡巡——忽然顿住。",
      "席间一位易了容的女子，正端着酒盏浅笑应酬。那眉眼、那神态被脂粉与术法改了七八分，可你认得——是墨彩环。燕家堡血光里匆匆一别，她竟也辗转到了京城。",
      { shot: "pushIn" },
      { say: "墨彩环", emo: "smile", tone: "声音压得极低，笑意却抵到了眼底", text: "……韩大哥。真有你的，连这儿都能撞见。" },
      { aside: "她借着敬酒的由头侧身过来，三言两语，把这些年的飘零轻描淡写地揭了过去——墨府之难后，她改名换姓、易容藏形，一路追着仇人的踪迹，追到了这京城五色门的门下。" },
      { say: "墨彩环", tone: "指尖在酒盏沿上轻轻一叩，眼里却有光", text: "害我墨家满门的人，就在这京城。我蹲了这么久，等的就是动手的时机。——没想到，等来的还有你。" },
      // 修#2·墨彩环情感线（执笔）：夜宴重逢=团聚+并肩起誓的暖场；那句动漫名台词「谢谢你，出现在我微不足道的生命里」
      //   留到血债了结后的 modao_e3_farewell（长街晨别·不遗憾的结局）作情感正落点——此处先写一版重逢的踏实与托付。
      { say: "墨彩环", emo: "smile", tone: "她笑意微敛，声音轻下来", text: "这些年我刀口上舔血，谁都信不过，独自一个人撑着。可一见着你这张老实脸，我这心里，没来由地就踏实了。——韩大哥，有你在，这桩血债，我敢去收了。" },
      { shot: "pullOut" },
      { aside: "你一向木讷，此刻竟也说不出话，只重重点了点头。墨府那笔血债，从今往后，你陪她一道收。" },
    ],
    onArrive(s) {
      State.setFlag("modao_e3_yanhui_done");
      Engine.meetNpc("mocaihuan", "燕家堡一别，易容藏形追仇至京城五色门门下的故人——墨府之难的因果，在此续上第二章。");
      Engine.writeLedger("modao_yanhui", "馨王府夜宴重逢易容的墨彩环——她追墨家仇人至京城五色门，约你并肩共收这桩血债（修#2·情感线·重逢托付，正落点在血债了结后的长街晨别）");
      Engine.addMilestone("魔道争锋·第三幕：馨王府夜宴·墨彩环重逢", "story");
      if (typeof Sfx !== "undefined") Sfx.play("chime");
    },
    choices: [
      {
        text: "「这笔账，我陪你一起收。」",
        hint: "并肩——陪她收这笔血债",
        effect(s) {
          s.mood = Math.min(s.moodMax, s.mood + 3);
          return { text: "你重重点头——墨府那笔血债，从今往后，你陪她一道收。", kind: "event" };
        },
        resolve: "advance",
      },
      {
        text: "「彩环，先摸清五色门的底细，再动手。」",
        hint: "稳进——先查再动手",
        effect(s) {
          State.setFlag("modao_e3_cautious_revenge");
          return { text: "你按住她的急切——仇要收，但不能葬撞。先摸清五色门的虚实，再动手不迟。", kind: "event" };
        },
        resolve: "advance",
      },
    ],
  },
  {
    id: "modao_e3_tieluo",
    skipIf: (s) => s.flags.modao_e3_tieluo_done || s.flags.modao_e3_tieluo_p1_done,
    cond: (s) => s.flags.modao_e3_yanhui_done && !s.flags.modao_e3_tieluo_done && !s.flags.modao_e3_tieluo_p1_done,
    cg: "jingcheng",
    bgm: "boss",
    title: "血池 · 血侍铁罗",
    objTitle: "救人",
    objHint: "循着煞气找到血池——救出被掳的萧爷爷与散修。",
    text: [
      { scene: "京城地底 · 血池" },
      { shot: "establish" },
      "要端这处血池，单凭你一人脱不开身——既要缠住血侍，又要抢救池中活人。临行前，你寻上了那帮替你查案的散修，蒙山五友。",
      { say: "蒙山五友", tone: "几个散修面面相觑，有些发怵", text: "黑煞教的血侍……我等几个无根无派的散修，凭什么去趟这趟要命的浑水？" },
      { aside: "你一向不善言辞，情急之下信口诌了个名头——「灵兽山」。这三个字一出口，连你自己都愣了半拍。" },
      { say: "韩立", tone: "面不改色，半真半假", text: "我身后是灵兽山。这趟收编诸位，正是要剿了这京城的魔教余孽。事成之后，自有交代。" },
      { aside: "「灵兽山」三个字是你随口胡诌的——你压根与那等大派沾不上半点边。可这名头唬人，蒙山五友将信将疑，到底是被血池里那些人命牵着，咬牙跟了上来。说到底，他们要打的，是黑煞教这魔教。" },
      "顺着失踪案的线索摸下去，京城地底竟藏着一处腥气冲天的血池——被掳的散修与凡人尽数泡在池中，被一点点抽干气血、供养着某种邪法。萧爷爷也在其中，气息奄奄。",
      { sfx: "farRoar" },
      { shot: "shock" },
      { fx: "flash", color: "#7a0a18", alpha: 0.4, ms: 320 },
      { fx: "burst", elem: "huo", n: 18 },
      "血雾翻涌，一道缠满血煞赤焰的身影自池畔升起——黑煞教的血侍，铁罗。他便是这桩连环失踪案的爪牙。",
      { shot: "pushIn" },
      { say: "铁罗", tone: "赤瞳森然", text: "黑煞教的事，也是你一个外来户能管的？既然撞进来了……就留下，一并入池吧。" },
      { aside: "蒙山五友散开扑向血池、七手八脚地抢救池中活人；缠住铁罗这条恶犬的活儿，落在你身上。他行火，木生火——你这身木行道基这回占不到相克的便宜，是场硬仗。逼他现出黑煞教的形迹、断他一臂，再说！" },
    ],
    onArrive(s) {
      State.setFlag("modao_e3_tieluo_seen");
      if (typeof Sfx !== "undefined") Sfx.play("danger");
    },
    choices: [
      { text: "「把人放了——黑煞教的血侍。」御木行剑光，逼上铁罗！", resolve: "tieluo_fight" },
    ],
  },
  {
    id: "modao_e3_tieluo2",
    skipIf: (s) => s.flags.modao_e3_tieluo_done,
    cond: (s) => s.flags.modao_e3_tieluo_p1_done && !s.flags.modao_e3_tieluo_done,
    cg: "jingcheng",
    bgm: "boss",
    title: "血池 · 化茧·血茧铁罗",
    objTitle: "力破血茧",
    objHint: "断臂的铁罗化血茧蜕出狂暴形态——把这具搏命的躯壳彻底打垮！",
    text: [
      { scene: "京城地底 · 血池" },
      { sfx: "farRoar" },
      { shot: "shock" },
      { fx: "burst", elem: "huo", n: 20 },
      "那枚暗红血茧在血雾里剧烈搏动、茧丝翻卷暴涨——只听「噗」的一声闷响，茧壳自内炸裂，一头独臂、血肉外露的畸变之物从中挣出。",
      "断了一臂的铁罗，竟以血侍秘术「化血茧」把残余血煞尽数榨入这具躯壳：血气暴涨、痛觉尽失，只剩仅存的一条手臂暴长狰狞、化作滴血巨爪。他发须皆赤、双目猩红如血珠暴突，再不似先前那阴诡的模样。",
      { shot: "pushIn" },
      { say: "血茧铁罗", tone: "声音嘶哑扭曲、近乎癫狂", text: "断我一臂……好，好得很！黑煞教的血侍，便是化成一摊烂肉，也要把你拖进这血池！" },
      { aside: "这是头濒死搏命的凶兽——蜕了皮甲、血肉外露（破甲更易），可血气狂涌、招式更重更猛。他仍行火，木生火，你那身木行道基依旧占不到相克的便宜。只能凭底牌与硬功，把这具血茧，彻底打垮！" },
    ],
    onArrive(s) {
      State.setFlag("modao_e3_tieluo2_seen");
      if (typeof Sfx !== "undefined") Sfx.play("danger");
    },
    choices: [
      { text: "「化成血茧，也留不住你。」聚起木行剑光，迎上狂暴的血茧铁罗！", resolve: "tieluo2_fight" },
    ],
  },
  {
    id: "modao_e3_wuse",
    skipIf: (s) => s.flags.modao_e3_wuse_done,
    cond: (s) => s.flags.modao_e3_tieluo_done && !s.flags.modao_e3_wuse_done,
    cg: "jingcheng",
    bgm: "boss",
    title: "五色门 · 收口",
    objTitle: "报仇",
    objHint: "五色门收口——为墨彩环了结墨府之祸的血债。",
    text: [
      { scene: "京城 · 五色门" },
      { shot: "establish" },
      "血侍遁走，黑煞教的形迹却已坐实，所有线索一并指向京城五色门——而那门下管事，正是墨彩环追了大半生的仇人：当年血洗嘉元城墨府的真凶，王管事。",
      "你与墨彩环一道杀进五色门内堂。王管事见事已败露，索性撕了那张人皮——皮囊下煞气翻涌，一双眼渐渐泛起妖异的金，临阵竟生生妖化，半人半妖、煞气滔天。",
      { sfx: "farRoar" },
      { shot: "shock" },
      { fx: "flash", color: "#caa70a", alpha: 0.4, ms: 320 },
      { fx: "burst", elem: "tu", n: 16 },
      { say: "王管事", tone: "嘶哑的、再不似人声", text: "墨家那点旧账……也值得你们千里寻来送死？黑煞教供养的煞体，岂是尔等撼得动的！" },
      { aside: "他行土，你那身木行道基，正克他。妖化厚甲虽然刀剑难透，可凭木克土的相克之利与底牌，能把这桩压了墨彩环半生的血债，今日了结。墨彩环立在你身侧，握剑的手在抖，眼里却是十年磨一日的决绝。" },
    ],
    onArrive(s) {
      State.setFlag("modao_e3_wuse_seen");
      if (typeof Sfx !== "undefined") Sfx.play("danger");
    },
    choices: [
      { text: "「墨府的血债，今日来收。」聚木行剑光，斩向妖化的王管事！", resolve: "wuse_fight" },
    ],
  },
  {
    id: "modao_e3_farewell",
    skipIf: (s) => s.flags.modao_e3_farewell_done,
    cond: (s) => s.flags.mofu_avenged && !s.flags.modao_e3_farewell_done,
    cg: "jingcheng",
    bgm: "sorrow",
    title: "京城 · 长街晨别",
    objTitle: "道别",
    objHint: "血债了结——与墨彩环在京城长街作别。",
    text: [
      { scene: "京城 · 长街晨别" },
      { amb: "wind" },
      { shot: "establish" },
      "血债了结的那一夜过后，墨彩环褪了易容的脂粉，露出本来的眉眼。压在她身上十数年的那口戾气，连同那张追凶的假面，一并卸了下来。晨光里，她竟比你记忆中任何时候都要松快。",
      { say: "墨彩环", emo: "smile", tone: "她望着渐亮的天色，像卸下了千斤重担", text: "报了。爹娘，墨家满门……我追了大半辈子的这桩仇，今日，总算替他们讨回来了。" },
      { aside: "你以为她会哭，她却只是笑。那笑里没有恨了，也没有那股一直绷着、要同谁拼命的劲——只剩一种你说不上来的、尘埃落定的平静。" },
      { say: "墨彩环", tone: "她转过头，认真地看着你", text: "这些年我活着，是替死人活着——为我爹的仇，为墨家满门的命。今日仇了了，我才回过神来：我自己，还没好好活过一回。" },
      { say: "墨彩环", emo: "smile", tone: "她顿了顿，眉眼弯起来", text: "我爹墨居仁，是个郎中。当年墨府上下，靠他一双手不知活了多少人。我想……把医馆重新支起来。这京城繁华，从来不缺杀人的刀，缺的是救人的手。" },
      { shot: "pushIn" },
      { say: "墨彩环", emo: "smile", tone: "她忽然认真起来，声音很轻，却字字落到实处", text: "韩大哥，谢谢你。谢谢你，出现在我这微不足道的一生里。若没有你，我大约早死在追凶路上的某个夜里了，连块碑都不会有。如今我能堂堂正正地、为我自己活下去——这条命，有一半是你给的。" },
      { aside: "你一向木讷，搜肠刮肚，也只憋出一句「保重」。她却像是听懂了千言万语，重重点了点头。" },
      { say: "墨彩环", tone: "她退后一步，朝你拱了拱手，眼里有光", text: "你的路，在更高更远的地方，我拦不住，也不想拦。去吧。我在这京城悬壶济世，等着听你扬名天下的消息。——这一回，换我，目送你了。" },
      { shot: "pullOut" },
      { aside: "你转身离去，晨光把两个人的影子拉得很长。这一别，她没有遗憾，你也没有。仙途漫漫，曾有人与你并肩收过一桩血债，又笑着放你远行——这便已是难得。" },
    ],
    onArrive(s) {
      State.setFlag("modao_e3_farewell_done");
      State.setFlag("modao_act3_done");
      Engine.writeLedger("mocaihuan_farewell", "京城长街晨别——墨彩环放下血仇、卸了易容，循父亲墨居仁的医道留在京城悬壶济世、为自己而活；她目送你远行，无憾而别（修#2·墨彩环情感线·不遗憾的结局，执笔）");
      Engine.addMilestone("魔道争锋·第三幕·收束：墨彩环放下仇恨、悬壶济世，无憾而别", "story");
      s.flags.modao_act4_due = State.absMonth() + 1;   // 第四幕时锚（黑煞覆灭·皇宫决战·待实装）：告别后约一月，黑煞教老巢现形
      if (typeof Sfx !== "undefined") Sfx.play("chime");
    },
    choices: [
      {
        text: "「保重。等我扬名的消息。",
        hint: "远行——扬名天下再聚",
        effect(s) {
          s.mood = Math.min(s.moodMax, s.mood + 3);
          return { text: "你转身离去，晨光把两个人的影子拉得很长——这一别，她没有遗憾，你也没有。", kind: "event" };
        },
        resolve: "advance",
      },
      {
        text: "「彩环……谢谢你。」多说了一句，停了一步。",
        hint: "珍重——多说一句再走",
        effect(s) {
          s.mood = Math.min(s.moodMax, s.mood + 5);
          State.setFlag("mocaihuan_extra_farewell");
          return { text: "你停了一步，回头多说了一句——她愣了愣，随即笑了，眉眼弯起来：“去吧。”", kind: "event" };
        },
        resolve: "advance",
      },
    ],
  },

  /* ============================================================================
   *  第四幕 · 黑煞覆灭 · 皇宫决战（增量H·上篇）——魔道争锋全篇收官的开幕段
   *  考据锚：docs/modao-design §第四幕（用户演出顺序裁决已并入）。
   *  本篇（H·上）实装：审讯集结·夜闯皇城 → 三组对位群架（sides[] 复数化首演）→ 一路杀到
   *  皇宫最底·血池大殿（刘靖凤凰符高光）→ 阴手偷袭刘靖（die/live 双分支·jingcheng_intel 示警改命）
   *  → 胥王褪凡人皮·入假丹·众人且战且退（cliffhanger）。
   *  待 H·下篇：拖时布阵战 → 真·颠倒五行阵 → 三符宝＋真凰符终结胥王 → 收官·离京钩。
   * ========================================================================== */
  {
    id: "modao_e4_shenxun",
    skipIf: (s) => s.flags.modao_e4_shenxun_done,
    cond: (s) => s.flags.modao_act3_done && !s.flags.modao_e4_shenxun_done && State.absMonth() >= (s.flags.modao_act4_due || 0),
    cg: "jingcheng",
    bgm: "tense",
    title: "皇宫决战 · 审讯与集结",
    objTitle: "夜闯皇城",
    objHint: "黑煞教老巢现形于皇宫地底——传讯黄枫谷，九筑基夜闯皇城。",
    text: [
      { scene: "京城 · 暗夜" },
      { shot: "establish" },
      "墨彩环走后不过一月，京城连环失踪案的最后一根线，被你攥到了手里。你以幻色眼的迷幻术撬开了越国小王爷的嘴——血池、煞气、失踪的散修，桩桩件件背后那只手，竟一路指向了京城最不该指向的地方：皇宫。",
      { aside: "黑煞教的老巢，就在越国皇城最底下。贼首豢养血侍、掳人炼煞，把一国之都经营成了吞人的血窟。这等魔窟，凭你一人闯不得——你修书一封，急传黄枫谷。" },
      "三日后，黄枫谷的师兄弟星夜赶到：刘靖、宋蒙、钟卫娘……连同闻讯赶来的几派同道，凑足了九名筑基修士。月黑风高，众人立在皇城根下，刀剑入鞘、灵光内敛。",
      { say: "刘靖", tone: "他一身正气，遥望那座吞了无数性命的皇城", text: "黑煞教以一国之都为炉、炼人煞为丹，天理难容。今夜，我辈便替这京城、替那些活不见人的散修，把这魔窟，掀了！" },
      { say: "钟卫娘", emo: "angry", text: "早憋着这口气了！宋师兄你别拦我——今夜我非把那帮役尸的玩意儿挨个收拾了不可！" },
      { say: "宋蒙", tone: "他掂了掂掌心温润的重元珠，沉声", text: "……都护住彼此侧翼，活着掀了它，比逞英雄要紧。韩师弟，你心细，替大伙盯着点暗处。" },
      { aside: "九道身影没入夜色，直扑皇城。一场决定京城气运的大战，自皇宫大门轰然洞开的那一刻，开始了。" },
    ],
    onArrive(s) {
      State.setFlag("modao_e4_shenxun_done");
      Engine.meetNpc("liujing", "皇宫决战并肩的黄枫谷师兄——除魔卫道之楷模，身负祖传真宝凤凰符。");
      Engine.meetNpc("songmeng", "黄枫谷持重元珠的稳重师兄，护中后压、替同袍挡刀。");
      Engine.meetNpc("zhongweiniang", "黄枫谷心直口快的女修，急性子游火、抢攻收割。");
      Engine.writeLedger("modao_e4_shenxun", "幻色眼审出黑煞教老巢＝越国皇宫地底血窟——传讯黄枫谷，刘靖/宋蒙/钟卫娘等九名筑基修士星夜集结、夜闯皇城（魔道争锋第四幕·黑煞覆灭开幕）");
      Engine.addMilestone("魔道争锋·第四幕开幕：审出老巢、九筑基夜闯皇城", "story");
      if (typeof Sfx !== "undefined") Sfx.play("danger");
    },
    choices: [
      {
        text: "「一鼓作气——直扑皇城！」",
        hint: "气势如虹——但连日奔波，气血略亏",
        effect(s) {
          s.hp = Math.max(1, Math.floor(s.hp * 0.92));
          s.mood = Math.min(s.moodMax, s.mood + 3);
          State.setFlag("modao_e4_rush");
          return { text: "九道灵光如利剑破夜，直扑皇城——气势如虹，纵然气血略亏，士气正盛。", kind: "event" };
        },
        resolve: "advance",
      },
      {
        text: "「稳进——先探虚实，再动手。」",
        hint: "稳扎稳打——气血充盈，但夜长梦多",
        effect(s) {
          s.hp = s.hpMax;
          State.setFlag("modao_e4_steady");
          return { text: "你压住众人的锐气，先行探路——皇城根下的暗哨被一一拔除，气血充盈，只怕夜长梦多。", kind: "event" };
        },
        resolve: "advance",
      },
    ],
  },
  {
    id: "modao_e4_santuan",
    skipIf: (s) => s.flags.modao_e4_santuan_done,
    cond: (s) => s.flags.modao_e4_shenxun_done && !s.flags.modao_e4_santuan_done,
    cg: "huanggong_men",
    bgm: "boss",
    title: "皇宫决战 · 三组对位群架",
    objTitle: "群架·杀开一条道",
    objHint: "皇宫大门洞开，血侍蜂拥——三组同袍背靠背，撕开血侍阵线、杀进皇宫深处。",
    text: [
      { scene: "皇宫 · 大门" },
      { shot: "shock" },
      { sfx: "farClash" },
      "皇宫大门在九道灵光合击下轰然洞开。门后，是黑压压一片缠着血煞赤焰的血侍——黑煞教豢养的死士，闻到生人气息，嘶吼着扑了上来。",
      { say: "刘靖", tone: "长剑出鞘，剑指深处", text: "韩师弟，三组分头缠住血侍——莫要恋战！杀开一条道，直取贼首！" },
      { aside: "你与刘靖一组当锋、宋蒙持珠护中、钟卫娘游火收割，三组同袍背靠背列开阵势。这是九筑基夜闯皇城的开幕，也是你头一回以『群阵』之姿、与三组同袍同场冲杀——战中可下简令，让同袍交叉支援、护住彼此侧翼。" },
      // D1-a 终止拍：落幕直接坠入三组对位群架
      { fight: "santuan_fight" },
    ],
    choices: [
      { text: "「列阵——杀开一条道！」", hint: "韩立＋刘靖/宋蒙/钟卫娘三组同袍 vs 黑煞教血侍×3（sides[] 复数化群架），可交叉支援", resolve: "santuan_fight" },
    ],
  },
  {
    id: "modao_e4_dive",
    skipIf: (s) => s.flags.modao_e4_dive_done,
    cond: (s) => s.flags.modao_e4_santuan_done && !s.flags.modao_e4_dive_done,
    cg: "xuechi_dian",
    bgm: "tense",
    title: "皇宫决战 · 血池大殿",
    objTitle: "杀至最底",
    objHint: "一路杀到皇宫最底部——血池大殿，越国之主『恭候』多时。",
    text: [
      { scene: "皇宫 · 血池大殿" },
      { shot: "tiltDown" },
      { fx: "material" },
      { sfx: "danger" },
      "三组同袍撕开血侍阵线，一路向下、向下——皇宫的地底深处，竟藏着一座吞天的血池大殿。腥气冲天，池水赤红如凝血，池底沉浮着不知多少散修的残躯。",
      "大殿尽头的玉阶之上，端坐着一个意想不到的人——越国之主，胥王。他一身常服、面带温煦，竟像是早已『恭候』多时。",
      { say: "胥王", tone: "他温声而笑，仿佛只是设宴待客", text: "诸位仙长远来辛苦。寡人……备了些薄礼相待。" },
      { aside: "众人一时愕然：贼首竟是这位看似无害的一国之君？刘靖却不为所动——他长身而立，腰间那道祖传真宝『凤凰符』，已悄然燃起一缕赤金灵光。" },
      { say: "刘靖", tone: "他一声清叱，凤凰符腾空而起", text: "魔道役尸、以国炼煞，便是天王老子也该诛！家传凤凰符在此——黑煞教的血侍，今日休想再害一人！" },
      { fx: "burst", elem: "jin", n: 14 },
      { sfx: "castHuo" },
      { aside: "凤凰符化作一只赤金火凰，长唳一声、俯冲而下——扑上来的几名血侍连惨叫都未及发出，便被真火焚成了灰烬！正道楷模的这一手高光，惊得满殿血煞为之一滞。可你心里，却莫名升起一丝寒意：这贼首，未免太『沉得住气』了。" },
    ],
    onArrive(s) {
      State.setFlag("modao_e4_dive_done");
      Engine.writeLedger("modao_e4_dive", "三组同袍杀至皇宫最底·血池大殿——越国之主胥王『恭候』；刘靖祭出祖传凤凰符，赤金火凰一击焚尽数名血侍（正道楷模高光）");
      Engine.addMilestone("皇宫决战：杀至血池大殿，越国之主胥王现身、刘靖凤凰符大放异彩", "showdown");
      if (typeof Sfx !== "undefined") Sfx.play("danger");
    },
    choices: [
      {
        text: "「……太沉得住气了。」心生警觉，暗中戒备。",
        hint: "暗中戒备——直觉救命",
        effect(s) {
          Engine.writeLedger("modao_e4_alert", true);
          return { text: "你没有被凤凰符的光芒分去心神——那股莫名的寒意，让你悄悄将灵力凝于掌心。", kind: "event" };
        },
        resolve: "advance",
      },
      {
        text: "「刘师兄好手段！」为凤凰符的威势暗暗喝彩。",
        hint: "士气大振——但心防松了",
        effect(s) {
          s.mood = Math.min(s.moodMax, s.mood + 2);
          return { text: "凤凰符的赤金火光令你精神一振——正道楷模，名不虚传！可那股寒意，被你暂时抛在了脑后。", kind: "event" };
        },
        resolve: "advance",
      },
    ],
  },
  {
    // 刘靖之命·示警分支（live）：唯前期京城情报拉满（jingcheng_intel>=2，挖到「第五血侍」线报）者触发。
    // skipIf 在「未挖到线报」时跳过本节点 → 落到下一个 die 节点（checkStory 语义：false cond 会阻塞，故必须用 skipIf 跳）。
    id: "modao_e4_liujing_live",
    skipIf: (s) => s.flags.modao_e4_liujing_done || !(s.flags.jingcheng_intel >= 2),
    cond: (s) => s.flags.modao_e4_dive_done && s.flags.jingcheng_intel >= 2,
    cg: "xuechi_dian",
    bgm: "tense",
    title: "皇宫决战 · 阴手·示警",
    objTitle: "喝破伏兵",
    objHint: "你前期挣到的『第五血侍』线报，此刻或能救刘靖一命。",
    text: [
      { scene: "皇宫 · 血池大殿" },
      "就在凤凰符的赤金火光最盛、所有人的目光都被它吸住的刹那——你脑中那条重金买来的线报，骤然炸响：『黑煞教第五名血侍，从不露面，惯于伪作凡人、混在人前伺机暴起……』",
      { aside: "你猛地看向那位『温煦无害』的越国之主——他袖中，一缕几不可察的血煞，正悄然凝向刘靖的后心！第五血侍，从来就不是别人——就是他！" },
      { cam: "zoom", scale: 1.16, ms: 240 },
      { sfx: "danger" },
      { say: "韩立", emo: "shout", tone: "你想都没想，厉喝出声", text: "刘师兄当心后心——他就是第五血侍！" },
      { aside: "刘靖久经沙场，闻声不及回头，本能地侧身一拧——那道本要贯穿心脉的血煞阴手，堪堪偏开寸许、自他左肩透出！刘靖闷哼一声、单膝跪地，凤凰符的火光骤然黯了下去，可那条命，到底是保住了。" },
      { say: "刘靖", tone: "他捂着血涌的左肩，咬牙回望那道阴手的来处，眼里是劫后的凝重", text: "好险……好阴毒的暗手！韩师弟，若非你这一声……刘某这条命，今日便要交代在这儿了。这份情，记下了。" },
      { aside: "（你前期在京城挣到的那条『第五血侍』线报，喝破了这记必杀的阴手——命途本是身陨，是你替刘靖挣回了一线生机。重伤的刘靖被宋蒙一把扶到身后。）" },
    ],
    onArrive(s) {
      State.setFlag("modao_e4_liujing_done");
      s.flags.liujing_survived = true;
      Engine.writeLedger("modao_liujing_live", "皇宫血池大殿——伪装成越国之主的『第五血侍』（＝黑煞教主胥王本人）暗手偷袭刘靖；因韩立前期在京城挣足情报、喝破伏兵，刘靖避开致命一击、重伤退场不死（修#7·示警改命·转机＝挣来）");
      Engine.addMilestone("皇宫决战·示警改命：喝破阴手，刘靖重伤不死", "showdown");
      if (typeof Sfx !== "undefined") Sfx.play("danger");
    },
    choices: [
      {
        text: "「师兄退后！——我来挡。」护住刘靖，退入阵中。",
        hint: "稳住阵脚——先保人再追敌",
        effect(s) {
          return { text: "你一把扶住刘靖，将他推到宋蒙身后——先保住人，再追那贼首不迟。", kind: "event" };
        },
        resolve: "advance",
      },
      {
        text: "「贼子敢尔！」拔剑直扑伪装的胥王。",
        hint: "趁势追击——但孤身犯险",
        effect(s) {
          s.mood = Math.min(s.moodMax, s.mood + 2);
          State.setFlag("modao_e4_chase");
          return { text: "你怒喝一声，剑光直取那正在剥落伪装的胥王——可那假丹之威，岂是你一人能挡的？", kind: "event" };
        },
        resolve: "advance",
      },
    ],
  },
  {
    // 刘靖之命·身陨分支（die·默认命途）：情报未拉满时由上一节点 skipIf 落到此处。
    id: "modao_e4_liujing_die",
    skipIf: (s) => s.flags.modao_e4_liujing_done,
    cond: (s) => s.flags.modao_e4_dive_done,
    cg: "xuechi_dian",
    bgm: "sorrow",
    title: "皇宫决战 · 阴手·身陨",
    objTitle: "猝不及防",
    objHint: "那位『越国之主』，袖中探出了一缕谁也没料到的血煞……",
    text: [
      { scene: "皇宫 · 血池大殿" },
      "就在凤凰符的赤金火光最盛、所有人的目光都被它吸住的刹那——那位『温煦无害』的越国之主，袖中骤然探出一缕血煞阴手，悄无声息地，贯入了刘靖的后心！",
      { shot: "pushIn" },
      { wait: 700 },
      { aside: "无人料到这一手。无人来得及喝破。等众人惊觉，那道血煞已自刘靖前胸透出——他低头怔怔看着胸口的血窟，凤凰符的火光，一寸寸地黯了下去。" },
      { say: "刘靖", tone: "他踉跄回身，难以置信地看着那个『一国之君』，嘴角溢出血来", text: "是你……黑煞教主……竟藏在……一国之君的皮囊底下……" },
      { aside: "正道楷模刘靖，一生除魔卫道、行事方正，终究没能防住这藏在『凡人』皮下的最毒一手。他重重倒下，凤凰符失了主人、化作一道赤金流光没入虚空——那是后话了。" },
      { say: "钟卫娘", emo: "cry", tone: "她嘶声尖叫，几乎是扑过去的", text: "刘师兄——！！" },
      { aside: "（恭送除魔卫道的正道楷模，刘师兄。——若你前期在京城挖到过『第五血侍/教主伪装』的线报，本可喝破这记阴手、为他挣回一线生机；命途如此，转机要趁早挣。）" },
    ],
    onArrive(s) {
      State.setFlag("modao_e4_liujing_done");
      s.flags.liujing_dead = true;
      Engine.writeLedger("modao_liujing_die", "皇宫血池大殿——黑煞教主胥王伪装成越国之主、以阴手偷袭，正道楷模刘靖后心中招身陨（命途＝原著默认；玩家前期情报未拉满、未能喝破伏兵）。凤凰符失主、化光遁去");
      Engine.addMilestone("皇宫决战·阴手身陨：恭送正道楷模刘靖", "showdown");
      if (typeof Sfx !== "undefined") Sfx.play("danger");
    },
    choices: [
      {
        text: "「刘师兄——！」悲痛欲绝，嘶声怒吼。",
        hint: "悲愤交加——心境暴跌",
        effect(s) {
          s.mood = Math.max(0, s.mood - 5);
          return { text: "你嘶声怒吼，眼眶赤红——又一个人，倒在了你面前。", kind: "event" };
        },
        resolve: "advance",
      },
      {
        text: "「……不能乱。」强压悲愤，护住众人退守。",
        hint: "强忍悲痛——气血略亏但阵脚不乱",
        effect(s) {
          s.hp = Math.max(1, Math.floor(s.hp * 0.95));
          State.setFlag("modao_e4_hold");
          return { text: "你咬碎牙关，将悲愤压进心底——此刻不是哀恸的时候，活着的人还得活下去。", kind: "event" };
        },
        resolve: "advance",
      },
    ],
  },
  {
    id: "modao_e4_xuwang",
    skipIf: (s) => s.flags.modao_e4_xuwang_done,
    cond: (s) => s.flags.modao_e4_liujing_done && !s.flags.modao_e4_xuwang_done,
    cg: "xuechi_dian",
    bgm: "boss",
    title: "皇宫决战 · 胥王现身",
    objTitle: "且战且退",
    objHint: "胥王褪去凡人皮囊、跃入假丹境——几人不敌，且战且退（皇宫决战·下篇待续）。",
    text: [
      { scene: "皇宫 · 血池大殿" },
      "那位『越国之主』缓缓站起身。他脸上温煦的皮相，正一寸寸剥落、簌簌而下——胥王、越皇、黑煞教主，原来从头到尾，都是同一个人。",
      { say: "胥王", tone: "凡人的皮囊褪尽，声音陡然森冷如渊", text: "装了这许多年凡人，也腻了。诸位仙长……可知，寡人这血池，养的是什么？" },
      { aside: "话音未落，他周身血煞冲天而起、池中赤水尽数倒灌入体！一股远超筑基的恐怖气息轰然炸开——他催动血煞秘法，竟生生跃入了『假丹』之境，那是寻常筑基修士仰望不及的筑基巅峰！" },
      { shot: "shock" },
      { sfx: "farRoar" },
      { fx: "burst", elem: "huo", n: 16 },
      "假丹之威一压，满殿同袍如坠冰窟。宋蒙的重元珠被震得嗡嗡作响，钟卫娘一口气血上涌，连你也只觉那身木行道基被压得几乎喘不过气。",
      { say: "宋蒙", emo: "shout", tone: "他护住众人，厉声", text: "不是对手——退！韩师弟，你脑子活，想法子拖住他，我们另寻生路！" },
      { aside: "几人且战且退、节节败北。你一边周旋、一边飞快盘算：硬拼必死，可若能拖到师兄妹与那几头傀儡蜥蜴布成阵势……一个疯狂的念头，在你脑中渐渐成形。" },
      { aside: "（皇宫决战·下篇·待续：拖时布阵战 → 真·颠倒五行阵 → 三符宝＋真凰符终结胥王 → 收官·离京钩。增量H下篇实装中。）" },
    ],
    onArrive(s) {
      State.setFlag("modao_e4_xuwang_done");
      State.setFlag("modao_e4_part1_done");
      Engine.meetNpc("xuwang", "黑煞教主＝越皇＝同一人——皇宫决战中褪去凡人皮囊、跃入假丹境的魔道巨擘。");
      Engine.writeLedger("modao_e4_xuwang", "皇宫血池大殿——『越国之主』褪去凡人皮囊，露出黑煞教主真身（胥王＝越皇＝同一人），催血煞秘法跃入假丹境；众人不敌、且战且退，韩立谋划拖时布阵（皇宫决战·下篇待续）");
      Engine.addMilestone("魔道争锋·第四幕（上）收束：胥王现身·入假丹·众人且战且退", "showdown");
      s.flags.modao_e4b_due = State.absMonth();   // 下篇时锚（拖时布阵→真·颠倒五行阵→决战·待实装）
      if (typeof Sfx !== "undefined") Sfx.play("danger");
    },
    choices: [
      {
        text: "「拖住他——给师兄妹布阵争时间！」",
        hint: "缠斗拖敌——赌一个疯狂的念头",
        effect(s) {
          State.setFlag("modao_e4_tangle");
          return { text: "你咬牙缠住胥王——每多拖一息，师兄妹就多一分布阵的工夫。", kind: "event" };
        },
        resolve: "advance",
      },
      {
        text: "「全力防御——先退再图反制。」",
        hint: "退守保命——气血充盈但气势被压",
        effect(s) {
          s.hp = s.hpMax;
          s.mood = Math.max(0, s.mood - 3);
          State.setFlag("modao_e4_defensive");
          return { text: "你护住众人全力退守——气血虽满，可胥王的假丹之威如影随形，压得人喘不过气。", kind: "event" };
        },
        resolve: "advance",
      },
    ],
  },

  /* ========== 皇宫决战·下篇（增量H下·收官）：拖时布阵 → 阵成反制 → 三符宝＋真凰符终结 → 离京钩 ========== */
  {
    // ① 拖时布阵战（survive 拖满回合机制首演·败有所得）。时锚由 modao_e4_xuwang.onArrive 落定（due=当月）；
    //    胜负在 _finishCombat(meta.type==="tuoshi") 结算并 setFlag modao_e4b_tuoshi_done → storyStage++。
    id: "modao_e4b_tuoshi",
    skipIf: (s) => s.flags.modao_e4b_tuoshi_done,
    cond: (s) => s.flags.modao_e4_xuwang_done && State.absMonth() >= (s.flags.modao_e4b_due || 0),
    cg: "xuechi_dian",
    bgm: "boss",
    title: "皇宫决战 · 拖时布阵",
    objTitle: "且战且退·拖住他",
    objHint: "硬拼必死——撑住，拖到师兄妹与傀儡蜥蜴把「真·颠倒五行阵」布成！",
    text: [
      { scene: "皇宫 · 血池大殿" },
      "假丹之威如山压顶，黑血刀所过之处血煞横飞。你一边周旋一边厉声招呼众人：莫要硬碰，只管退、只管缠！",
      { say: "韩立", emo: "shout", tone: "你飞快盘算着，把那个疯狂的念头喊了出来", text: "宋师兄、钟师姐——带傀儡蜥蜴叼旗布阵！『真·颠倒五行阵』！我们几个，给你们拖时间！" },
      { aside: "宋蒙眼睛一亮，重元珠当即护身：「好胆识——就这么办！」他与钟卫娘急急退向四角，驱使着那几头筑基傀儡蜥蜴叼起阵旗，往血池广场的方位上死死镇去。" },
      { shot: "focusRight" },
      { sfx: "castTu" },
      { aside: "（拖时布阵战：你这一战不必胜，只须撑住——拖满回合，师兄妹的颠倒五行阵便成，便是翻盘之时。败有所得，浴血退守也能再上。）" },
      // D1-a 终止拍：落幕直接坠入拖时布阵战
      { fight: "tuoshi_fight", guard: { hint: "撑满回合即胜，败有所得" } },
    ],
    choices: [
      { text: "「都听我的——结阵死守，拖住胥王！」", hint: "拖时布阵战：撑满回合即胜（败有所得·浴血再战）", resolve: "tuoshi_fight" },
    ],
  },
  {
    // ② 阵成·反制（真·颠倒五行阵 fieldCycle 逐回合压制 + 二阶段假丹 boss waves）。
    //    胜负在 _finishCombat(meta.type==="xuwang_final") 结算并 setFlag modao_e4b_xuwang_done → storyStage++。
    id: "modao_e4b_zhencheng",
    skipIf: (s) => s.flags.modao_e4b_xuwang_done,
    cond: (s) => s.flags.modao_e4b_tuoshi_done && !s.flags.modao_e4b_xuwang_done,
    cg: "xuechi_dian",
    bgm: "boss",
    title: "皇宫决战 · 阵成·反制",
    objTitle: "颠倒五行·反制",
    objHint: "阵成！五行倒转逐回合反噬胥王——底牌齐发，毕其功于一役！",
    text: [
      { scene: "皇宫 · 血池大殿" },
      "最后一道阵旗轰然插定，整座血池广场五行光华暴涨——木、火、金、水、土，倒转生克、虚实易位！「真·颠倒五行阵」终于布成！",
      { fx: "lightning" },
      { sfx: "thunder" },
      { cam: "shake", px: 9 },
      { say: "宋蒙", emo: "shout", tone: "他与钟卫娘联手稳住阵眼，厉声", text: "阵成——压！韩师弟，机会只此一次，五行倒转镇着他的工夫，你的底牌，全给我招呼上去！" },
      { aside: "竹海缠足、九天真火倒灌、镜影分身、渊薮心魔、黄沙陷脚……五行之力逐息反噬，那不可一世的假丹之威，竟被一寸寸地压了下去。胥王第一次露出了惊怒之色。" },
      { aside: "（阵成决战：颠倒五行阵逐回合反噬胥王、佐助于你；金光砖等符宝底牌已在手——此刻不留底牌，更待何时！注意：他有二阶段，毁其肉身后仍会借丹复生。）" },
      { cam: "zoom", scale: 1.16, ms: 240 },
      // D1-a 终止拍：落幕直接坠入阵成决战（二阶段假丹 boss）
      { fight: "xuwang_final_fight", guard: { hint: "底牌尽出，毕其功于一役" } },
    ],
    choices: [
      { text: "「就是现在——金光砖！」底牌尽出，毕其功于一役！", hint: "阵成决战：颠倒五行阵逐回合压制 + 二阶段假丹 boss", resolve: "xuwang_final_fight" },
    ],
  },
  {
    // ③-live 真凰符·终结（刘靖示警支线·重伤生还）。三符宝齐轰已在 phase 切换的波次旁白演过，
    //     此节点收尾：钟卫娘祭真凰符灭神魂（剧情杀·玩家不操作）+ 发战利品。彩蛋：刘宋渊源。
    //     分支契约同 liujing_live/die：本节点 skipIf 在「刘靖已殁」时跳过 → 落到下一 die 节点。
    id: "modao_e4b_finale_live",
    skipIf: (s) => s.flags.modao_e4b_finale_done || !s.flags.liujing_survived,
    cond: (s) => s.flags.modao_e4b_xuwang_done && s.flags.liujing_survived,
    cg: "xuechi_dian",
    bgm: "triumph",
    title: "皇宫决战 · 真凰符·终结",
    objTitle: "毕其功于一役",
    objHint: "三符宝毁其肉身、复生神魂被阵法死死镇住——只待那一击。",
    text: [
      { scene: "皇宫 · 血池大殿" },
      "平天尺、重元珠、赤红剑——你与宋蒙、陈巧倩三件符宝齐轰而下，胥王那具假丹肉身轰然崩碎。可血凝五行丹借阵中五行之力，犹自凝起一缕复生神魂，被颠倒五行阵死死镇在原地、寸步难逃。",
      { say: "刘靖", tone: "他按着左肩的伤、剑还握不稳，却把一枚古拙符箓郑重递向钟卫娘", text: "卫娘——刘家祖传的真凰符，一生只可一击。我这身子催不动它了……了结这魔头，托付你了。" },
      { say: "钟卫娘", emo: "shout", tone: "她双手捧符、赤金凰焰冲天而起", text: "真凰符——焚！" },
      { shot: "shock" },
      { fx: "flash", color: "#ffd27a", alpha: 0.5 },
      { fx: "burst", elem: "jinlei", n: 18 },
      { sfx: "success" },
      { aside: "一只赤金火凰自符中振翅而出，长鸣一声，将那缕负隅顽抗的复生神魂连同满殿血煞，尽数吞没、焚作飞灰。胥王、越皇、黑煞教主——这魔道巨擘，终于伏诛。" },
      { shot: "pullOut" },
      { aside: "（彩蛋·刘宋渊源：宋蒙扶住力竭的刘靖，低声道「当年若非令尊援手，我宋家早已……这一符之恩，记下了。」——两家的旧渊源，是后话了。）" },
      { aside: "（战利品入囊：血凝五行丹／玄阴诀／血灵钻／锦帕／玉简／钵盂。）" },
    ],
    onArrive(s) {
      State.setFlag("modao_e4b_finale_done");
      ["xuening_wuxing_dan", "xuanyin_jue", "xueling_zuan", "jinpa_liusong", "yujian_canpian", "boyu_alms"].forEach(k => State.give(k, 1));
      Engine.writeLedger("modao_e4b_finale", "皇宫血池大殿·终结——三符宝（韩立平天尺/宋蒙重元珠/陈巧倩赤红剑）齐轰毁胥王假丹肉身→血凝五行丹借阵复生神魂→颠倒五行阵镇之、刘靖将祖传真凰符托付钟卫娘、师妹祭符灭神魂。黑煞教覆灭。得：血凝五行丹/玄阴诀/血灵钻/锦帕/玉简/钵盂。彩蛋：刘宋渊源");
      Engine.addMilestone("皇宫决战·终结：真凰符灭胥王神魂，黑煞教覆灭（刘靖生还）", "showdown");
      if (typeof Sfx !== "undefined") Sfx.play("success");
    },
    choices: [
      {
        text: "（赤金凰焰吞没神魂——胥王，终于伏诛。）",
        hint: "感慨正道楷模——这份敬意，记入因果",
        effect(s) {
          Engine.writeLedger("modao_finale_respect", true);
          return { text: "你望着那道渐渐散去的赤金凰焰，心中默默向刘靖与钟卫娘一拜——正道楷模，当之无愧。", kind: "event" };
        },
        resolve: "advance",
      },
      {
        text: "（……先清点战利品。）默然收囊。",
        hint: "实用主义——活着才是硬道理",
        effect(s) {
          s.mood = Math.max(0, s.mood - 2);
          return { text: "你没有感慨——活下来的人，才有资格清点战利品。你默默将散落的物件收入囊中。", kind: "event" };
        },
        resolve: "advance",
      },
    ],
  },
  {
    // ③-die 真凰符·终结（刘靖身陨·默认命途）：情报未拉满时由上一 live 节点 skipIf 落到此处（fallback·无附加 cond）。
    id: "modao_e4b_finale_die",
    skipIf: (s) => s.flags.modao_e4b_finale_done,
    cond: (s) => s.flags.modao_e4b_xuwang_done,
    cg: "xuechi_dian",
    bgm: "triumph",
    title: "皇宫决战 · 真凰符·终结",
    objTitle: "为刘师兄·了结此獠",
    objHint: "三符宝毁其肉身、复生神魂被阵法死死镇住——只待那一击。",
    text: [
      { scene: "皇宫 · 血池大殿" },
      "平天尺、重元珠、赤红剑——你与宋蒙、陈巧倩三件符宝齐轰而下，胥王那具假丹肉身轰然崩碎。可血凝五行丹借阵中五行之力，犹自凝起一缕复生神魂，被颠倒五行阵死死镇在原地、寸步难逃。",
      { say: "钟卫娘", emo: "cry", tone: "她攥着刘师兄留下的那枚祖传真凰符，泪流满面，双手却稳得出奇", text: "刘师兄……你护道一生，这最后一击，师妹替你了结他——真凰符，焚！" },
      { shot: "shock" },
      { fx: "flash", color: "#ffd27a", alpha: 0.5 },
      { fx: "burst", elem: "jinlei", n: 18 },
      { sfx: "success" },
      { aside: "一只赤金火凰自符中振翅而出，长鸣一声，将那缕负隅顽抗的复生神魂连同满殿血煞，尽数吞没、焚作飞灰。胥王、越皇、黑煞教主——这魔道巨擘，终于伏诛。这一焚，是为天下苍生，也是为那位再回不来的正道楷模。" },
      { shot: "pullOut" },
      { aside: "（战利品入囊：血凝五行丹／玄阴诀／血灵钻／锦帕／玉简／钵盂。）" },
    ],
    onArrive(s) {
      State.setFlag("modao_e4b_finale_done");
      ["xuening_wuxing_dan", "xuanyin_jue", "xueling_zuan", "jinpa_liusong", "yujian_canpian", "boyu_alms"].forEach(k => State.give(k, 1));
      Engine.writeLedger("modao_e4b_finale", "皇宫血池大殿·终结——三符宝（韩立平天尺/宋蒙重元珠/陈巧倩赤红剑）齐轰毁胥王假丹肉身→血凝五行丹借阵复生神魂→颠倒五行阵镇之、钟卫娘含泪祭刘靖遗下的祖传真凰符灭神魂（为身陨的刘师兄报仇）。黑煞教覆灭。得：血凝五行丹/玄阴诀/血灵钻/锦帕/玉简/钵盂");
      Engine.addMilestone("皇宫决战·终结：真凰符灭胥王神魂，黑煞教覆灭（刘靖身陨）", "showdown");
      if (typeof Sfx !== "undefined") Sfx.play("success");
    },
    choices: [
      {
        text: "（赤金凰焰吞没神魂——含泪默哀。）",
        hint: "含泪送别——心境暴跌",
        effect(s) {
          s.mood = Math.max(0, s.mood - 5);
          return { text: "你望着那道赤金凰焰渐渐散去，心中五味杂陈——刘师兄，你护道一生，到头来……", kind: "event" };
        },
        resolve: "advance",
      },
      {
        text: "「刘师兄，安息。」化悲愤为前行之力。",
        hint: "承遗志——心境微降但志不倒",
        effect(s) {
          s.mood = Math.max(0, s.mood - 2);
          Engine.writeLedger("modao_finale_resolve", true);
          return { text: "你向那道散去的凰焰微微颔首——正道楷模的遗志，自有活着的人替他走下去。", kind: "event" };
        },
        resolve: "advance",
      },
    ],
  },
  {
    // ④ 离京钩（收官·接「再别天南篇」）：京城血夜终了、黑煞教覆灭；韩立离京回天南。
    //    传闻系统埋三条长线钩（回天南/古传送阵·乱星海/天南故人），不在本增量内实装下一篇章。
    id: "modao_e4b_likjing",
    skipIf: (s) => s.flags.modao_e4_done,
    cond: (s) => s.flags.modao_e4b_finale_done && !s.flags.modao_e4_done,
    cg: "xuechi_dian",
    bgm: "journey",
    title: "皇宫决战 · 离京",
    objTitle: "尘埃落定·离京",
    objHint: "京城的事了了——是时候回天南了。江湖传闻里，已有再起波澜的引线。",
    text: [
      { scene: "皇宫 · 血池大殿" },
      { shot: "pullOut" },
      "血池熄了，赤水褪尽。这一夜，九名筑基修士夜闯皇城、力诛假丹境的黑煞教主胥王——蟠踞越国多年、以血祭邪法残害散修的黑煞教，自此覆灭。",
      { aside: "天光将明，众人各自收拾伤势与心绪。宋蒙拍了拍你的肩：「韩师弟，京城这趟，多亏有你。各派的烂账，七派自会去理——你我，是该回天南了。」" },
      { aside: "你握着囊中那枚自矿洞古传送阵心捧出的大挪移令，心头掠过一个念头：残缺的古传送阵、远在天南之外的乱星海……这条极长的线，今日还握不住，却已悄然牵起。" },
      { aside: "（魔道争锋·京城篇·收束。下一程「再别天南」：天南旧人旧事、古传送阵的修补、以及那条通向乱星海的引线——皆是后话。注意听各地江湖传闻，便知风从何起。）" },
      { guide: { tag: "魔道争锋 · 京城篇 · 收束", hint: "黑煞教覆灭——再别天南篇已解锁，回天南。", focus: "map", cta: "回天南" } },
    ],
    onArrive(s) {
      State.setFlag("modao_e4_done");
      State.setFlag("modao_e4b_done");
      Chapters.unlock("zaibie");   // 京城血夜了结→解锁再别天南篇
      Engine.writeLedger("modao_e4b_likjing", "皇宫决战收束·离京——黑煞教覆灭，九筑基功成离京、各返天南。埋「再别天南篇」长线钩：回天南旧人旧事/矿洞古传送阵修补/通向乱星海的大挪移令引线（本增量止于此·下一篇章后续窗口实装）");
      Engine.addMilestone("魔道争锋·第四幕·皇宫决战·收官：黑煞教覆灭，韩立离京回天南", "showdown");
      s.worldNews = s.worldNews || [];
      const t = `第${s.year}年${s.month}月`;
      s.worldNews.push({ t, kind: "world", text: "京城血夜：九名筑基修士夜闯皇城，力诛伪作越皇的黑煞教主胥王——蟠踞越国多年的黑煞教，一夜覆灭。" });
      s.worldNews.push({ t, kind: "rumor", text: "传闻黄枫谷一脉的修士们已动身南返天南——天南那边，旧人旧事，怕是又要起些波澜了。" });
      s.worldNews.push({ t, kind: "rumor", text: "市井奇谈：有人说天南之外的茫茫『乱星海』里藏着上古传送大阵，得其钥者可往返极远之地——只是那等机缘，凡修连边都摸不着。" });
      if (s.worldNews.length > 40) s.worldNews.splice(0, s.worldNews.length - 40);
      if (typeof Sfx !== "undefined") Sfx.play("success");
    },
    choices: [
      {
        text: "「京城的事，了了。」回望一眼那座血夜中的皇城。",
        hint: "回望京城——这份沉重，记入因果",
        effect(s) {
          Engine.writeLedger("jingcheng_lookback", true);
          return { text: "你回头望了一眼那座渐渐远去的皇城——京城血夜，终成过往。", kind: "event" };
        },
        resolve: "advance",
      },
      {
        text: "「是时候，回天南了。」头也不回，转身南行。",
        hint: "干脆利落——前路只向天南",
        effect(s) {
          s.mood = Math.min(s.moodMax, s.mood + 2);
          return { text: "你没有回头——京城的血夜已了，天南的旧人旧事，正等着你。", kind: "event" };
        },
        resolve: "advance",
      },
    ],
  },

  /* ============================================================
   * 再别天南篇（order 4·衔接过场大章）——考据见 docs/zaibie-tiannan-design.md
   * 定位：衔接为主、自由度适当低的过场大章，重头在两段高代入演出
   *   （①离开天南·矿洞古阵大挪移令传送毁阵断追；②到达乱星海·落海首见妖海定格）。
   * 链路：linear（skipIf+cond flag 链；onArrive 设 s.location 供场景图），非 where 门控。
   * 复用：fieldCycle / waves / sides[] / objective:survive / s.sideUnit / cutscene 原语，无新系统。
   * ============================================================ */

  // ——【进入·回天南】京城收官后，韩立携曲魂幡南返嘉元城——
  {
    id: "zaibie_open",
    skipIf: (s) => s.flags.zaibie_open_done,
    cond: (s) => s.flags.modao_e4_done && !s.flags.zaibie_open_done,
    cg: "jiayuan_guandao",
    bgm: "journey",
    title: "再别天南 · 回天南",
    objTitle: "南返嘉元城",
    objHint: "京城的烂账了了。携曲魂幡南返天南，先回嘉元城——御灵宗的人，似乎也循着曲魂的气息追来了。",
    text: [
      { scene: "嘉元城外 · 官道" },
      { shot: "establish" },
      { amb: "wind" },
      "离了京城，一路南行。越往天南腹地走，那股熟悉的山水气息便越浓——这是你筑基之后，第一次踏回天南的土地。",
      { aside: "囊中那面曲魂幡幽幽震动，似在感应着什么。自燕家堡一路带到京城、又带回天南的这缕残魂，是你筹谋已久的一着暗棋。" },
      { say: "韩立", emo: "cold", tone: "low", text: "「曲魂幡躁动得厉害……是御灵宗的人，循着这缕魂气追来了。在他们动手之前——这缕曲魂，得先成我的底牌。」" },
      { aside: "（再别天南篇·开篇。先在嘉元城将曲魂祭成身外化身；御灵宗的夺舍者已在城外候着了。）" },
    ],
    onArrive(s) {
      Chapters.unlock("zaibie");
      Chapters.enter("zaibie");
      s.location = "jiayuan_city";
      State.setFlag("zaibie_open_done");
      Engine.writeLedger("zaibie_open", "再别天南·开篇——京城血夜了结，韩立携曲魂幡南返嘉元城。御灵宗夺舍者循曲魂魂气追至。");
      Engine.addMilestone("再别天南：回到天南，重履嘉元城", "zaibie");
      s.worldNews = s.worldNews || [];
      const t = `第${s.year}年${s.month}月`;
      s.worldNews.push({ t, kind: "rumor", text: "嘉元城传闻：御灵宗放出重赏，悬缉一缕『曲魂』残识——据说与早年一桩夺舍秘辛有关，引得不少散修暗中打探。" });
      if (s.worldNews.length > 40) s.worldNews.splice(0, s.worldNews.length - 40);
    },
    choices: [
      {
        text: "「先成底牌，再会来敌。」星夜兼程，直奔嘉元城。",
        hint: "抢先祭曲魂——但连日奔波，气血略亏",
        effect(s) {
          s.hp = Math.max(1, Math.floor(s.hp * 0.92));
          State.setFlag("zaibie_rush");
          return { text: "连日奔波，气血略亏——但御灵宗的人，终究慢了一步。", kind: "event" };
        },
        resolve: "advance",
      },
      {
        text: "「磨刀不误砍柴工。」先调息半日，再动身。",
        hint: "状态满——但御灵宗的鼻子更近了",
        effect(s) {
          s.hp = s.hpMax;
          State.setFlag("zaibie_rest");
          return { text: "调息既毕，气血充盈——只是御灵宗的人，又近了几分。", kind: "event" };
        },
        resolve: "advance",
      },
    ],
  },

  // ——【曲魂·身外化身】开篇一步祭炼：以玄阴诀祭曲魂为身外化身，装黑煞教主血刃·达假丹境——
  {
    id: "zaibie_quhun_refine",
    cg: "jingshi_huashen",
    skipIf: (s) => s.flags.zaibie_quhun_done,
    cond: (s) => s.flags.zaibie_open_done && !s.flags.zaibie_quhun_done,
    bgm: "tense",
    title: "再别天南 · 身外化身",
    objTitle: "祭炼曲魂·身外化身",
    objHint: "以玄阴诀祭曲魂为身外化身，装黑煞教主血刃，达假丹之境——乱星海结丹之前，这便是你压自己一头的核心底牌。",
    text: [
      { scene: "嘉元城 · 墨府旧宅 · 静室" },
      "你寻了处隐秘静室，取出曲魂幡，又请出自黑煞教主胥王处所得的那柄『血刃』——通体暗红、煞气森森的一件邪宝。",
      { aside: "玄阴诀的法门在识海中流转。这一脉『身外化身』之术，正是要以秘法将一缕强魂祭炼成可离体而战的化身——再以利器附之，便是一具不惧伤亡、可挡在身前的战傀。" },
      { say: "韩立", tone: "low", text: "「曲魂本就是一缕假丹境的残魂，配上这柄血刃……成了它，便是一记能压我一头的杀招。」" },
      { fx: "material", at: "center", elem: "huo" },
      { sfx: "cast" },
      "你掐诀祭炼，曲魂幡中那缕残魂被血刃一引，煞气勃发、缓缓凝出一道人形虚影——假丹之威扑面而来。",
    ],
    choices: [
      {
        text: "「以玄阴诀祭炼——曲魂，成我身外化身。」",
        hint: "祭成 SideUnit 友军·假丹境·全程并肩",
        effect(s) {
          s.sideUnit = {
            id: "quhun_huashen", name: "曲魂·身外化身", kind: "incarnation",
            hp: 200, hpMax: 200, mp: 60, mpMax: 60,
            atk: 30, atkName: "血刃斩",
            elem: "huo", nature: null, guard: 0.32, move: 1, mastery: 1,
            persona: { aggr: 8, prot: 5, kite: 2 }, status: "ok", carry: true,
            moves: [
              { name: "血刃斩", dmg: 30, weight: 12, elem: "huo", range: [1, 2], line: "曲魂血刃一闪，赤煞裂空斩向" },
              { name: "血煞噬魂", dmg: 24, weight: 7, elem: "huo", range: [1, 3], line: "曲魂吐出一道血煞，缠噬而上" },
              { name: "假丹·血遁突袭", dmg: 40, weight: 5, elem: "huo", range: [1, 4], line: "曲魂化作一道血虹，假丹之威贯阵突袭" },
            ],
          };
          State.setFlag("zaibie_quhun_done");
          State.setFlag("quhun_avatar");   // v213：曲魂立绘自此升级为玄笠化身（Art.quhunId）
          Engine.writeLedger("zaibie_quhun_huashen", "再别天南·身外化身——以玄阴诀祭曲魂为身外化身，装黑煞教主血刃、达假丹之境。乱星海结丹前，战力始终压韩立一头，为本章核心底牌（SideUnit 友军·全程并肩）。");
          Engine.addMilestone("再别天南：曲魂祭成身外化身（假丹·黑煞血刃）", "zaibie");
          return { text: "曲魂·身外化身祭炼功成——假丹之境、执黑煞血刃，自此随你并肩而战。在乱星海结丹之前，它的战力始终压你一头，是你最硬的一张底牌。", kind: "good" };
        },
        resolve: "advance",
      },
      {
        text: "「不急——慢慢祭炼，稳为先。」以温养之法徐徐炼成。",
        hint: "曲魂气血略低，但护主心更切（prot+3）",
        effect(s) {
          s.sideUnit = {
            id: "quhun_huashen", name: "曲魂·身外化身", kind: "incarnation",
            hp: 180, hpMax: 180, mp: 60, mpMax: 60,
            atk: 28, atkName: "血刃斩",
            elem: "huo", nature: null, guard: 0.32, move: 1, mastery: 1,
            persona: { aggr: 6, prot: 8, kite: 2 }, status: "ok", carry: true,
            moves: [
              { name: "血刃斩", dmg: 28, weight: 12, elem: "huo", range: [1, 2], line: "曲魂血刃一闪，赤煞裂空斩向" },
              { name: "血煞噬魂", dmg: 22, weight: 7, elem: "huo", range: [1, 3], line: "曲魂吐出一道血煞，缠噬而上" },
              { name: "假丹·血遁突袭", dmg: 38, weight: 5, elem: "huo", range: [1, 4], line: "曲魂化作一道血虹，假丹之威贯阵突袭" },
            ],
          };
          State.setFlag("zaibie_quhun_done");
          State.setFlag("quhun_avatar");
          State.setFlag("quhun_safe_refine");
          Engine.writeLedger("zaibie_quhun_huashen", "再别天南·身外化身——以玄阴诀温养之法徐徐祭曲魂为身外化身，装黑煞教主血刃、达假丹之境。稳为先，气血略低而护主心切。");
          Engine.addMilestone("再别天南：曲魂祭成身外化身（假丹·黑煞血刃·温养法）", "zaibie");
          return { text: "温养之法虽慢，曲魂与你的神魂契合却更深——假丹之境、执黑煞血刃，护主之心尤切。", kind: "good" };
        },
        resolve: "advance",
      },
    ],
  },

  // ——【Act1·寻魂夺剑·其一】御灵宗夺舍者驱兽拦路：金背妖螂险战（fieldCycle 颠倒五行阵图反制）——
  {
    id: "zaibie_a1_jinbei",
    skipIf: (s) => s.flags.zaibie_jinbei_done,
    cond: (s) => s.flags.zaibie_quhun_done && !s.flags.zaibie_jinbei_done,
    cg: "luanshipo",
    bgm: "boss",
    title: "再别天南 · 金背妖螂",
    objTitle: "御灵宗拦路·金背妖螂",
    objHint: "御灵宗夺舍者放出一头金背妖螂拦路。金克木、甲坚镰利——祭出颠倒五行阵图逐回合反制，曲魂当先迎战。",
    text: [
      { scene: "嘉元城外 · 乱石坡" },
      "才出城门，一股凌厉煞气当头压下。乱石坡上，一道清癯人影负手而立，身前伏着一头金背如铁、双镰开阖的庞然大妖。",
      { say: "御灵宗夺舍者", tone: "cold", text: "「曲魂的气息，果然在你身上。识相的，把它交出来——本座还能留你个全尸。」" },
      { say: "韩立", emo: "cold", text: "「御灵宗的人……来得倒快。这缕曲魂，如今是我的底牌——想要，自己来取。」" },
      { fx: "lightning", at: "left", elem: "jin" },
      "那夺舍者冷哼一声，袖一挥——金背妖螂双镰一振，金鸣裂石，朝你扑来！",
    ],
    onArrive(s) { s.location = "jiayuan_city"; },
    choices: [
      { text: "掷出颠倒五行阵图，曲魂当先——迎战！", hint: "fieldCycle 险战·曲魂并肩", resolve: "jinbei_fight" },
    ],
  },

  // ——【Act1·寻魂夺剑·其二】御灵宗夺舍者·夺剑（waves 二阶段；胜得绿煌剑+奇虫榜玉简）——
  {
    id: "zaibie_a1_duoshe",
    skipIf: (s) => s.flags.zaibie_duoshe_done,
    cond: (s) => s.flags.zaibie_jinbei_done && !s.flags.zaibie_duoshe_done,
    cg: "luanshipo",
    bgm: "boss",
    title: "再别天南 · 夺剑",
    objTitle: "夺御灵宗夺舍者之绿煌剑",
    objHint: "妖螂既毙，那夺舍者亲自下场。他神魂结丹、躯壳筑基，催不全本命之力——曲魂假丹之躯硬撼，先碎躯壳、再散残念。胜得绿煌剑。",
    text: [
      { scene: "嘉元城外 · 乱石坡" },
      { cam: "zoom", scale: 1.16, ms: 240 },
      { sfx: "sword" },
      { fx: "swordRing", elem: "mu" },
      "金背妖螂轰然坠地。那夺舍者面色铁青，一柄通体莹绿的古剑应声出鞘，剑气森森——竟是一件结丹本命之器！",
      { say: "御灵宗夺舍者", tone: "angry", text: "「区区筑基，也敢坏本座的事！这绿煌剑乃我本命之宝，今日便叫你死在它下！」" },
      { aside: "你心头雪亮：他神魂虽是结丹，强占的这具躯壳却催不全本命真元——战力被生生压在筑基一档。这柄绿煌剑，今日志在必得。" },
      { say: "韩立", emo: "cold", tone: "low", text: "「催不全的本命之力……那便是你的死穴。曲魂——上！」" },
    ],
    onArrive(s) { s.location = "jiayuan_city"; },
    choices: [
      { text: "曲魂掠阵硬撼，越阶夺剑！", hint: "waves 二阶段·胜得绿煌剑+奇虫榜玉简", resolve: "duoshe_fight" },
      {
        text: "「夺剑之后，顺手取他储物袋——不拿白不拿。」",
        hint: "胜后额外掠取材料，但追兵循气息更快",
        effect(s) {
          State.setFlag("zaibie_greedy");
          return { text: "你多了个心眼——这夺舍者身上，少说还有几件好东西。", kind: "event" };
        },
        resolve: "duoshe_fight",
      },
    ],
  },

  // ——【Act1 收束·过渡 Act2】得绿煌剑·奇虫榜玉简；金鼓原战火传来——
  {
    id: "zaibie_a1_after",
    cg: "jiayuan_inn",
    skipIf: (s) => s.flags.zaibie_a1_after_done,
    cond: (s) => s.flags.zaibie_duoshe_done && !s.flags.zaibie_a1_after_done,
    bgm: "tense",
    title: "再别天南 · 战报",
    objTitle: "绿煌剑入手·金鼓原急报",
    objHint: "绿煌剑与奇虫榜玉简到手。可还未及细看，金鼓原方向已传来天崩地裂的战报——黑煞教倾巢、灵兽山倒戈，正道危如累卵。",
    text: [
      { scene: "嘉元城 · 客栈" },
      { shot: "establish" },
      "绿煌剑通体莹绿、剑身流转着古拙的纹路。你越阶一试，剑影分光、威势赫赫——虽催不出结丹本命的全威，已足以列为你第三柄主战法宝。",
      { aside: "那卷奇虫榜玉简亦是意外之喜——内里录着诸般天地奇虫的来历与豢养之法，于你日后大有用处。" },
      { sfx: "danger" },
      { aside: "可还未及细看，城中已是一片哗然——金鼓原方向，黑煞教残部竟与天南各路魔修合流、倾巢来犯，灵兽山一脉临阵倒戈反水，正道大军节节败退……" },
      { say: "韩立", emo: "cold", tone: "low", text: "「金鼓原……黄枫谷的人，怕是都在那里。」" },
      { shot: "pullOut" },
    ],
    onArrive(s) {
      s.location = "jiayuan_city";
      State.setFlag("zaibie_a1_after_done");
      Engine.writeLedger("zaibie_a1_after", "再别天南·夺剑收束——绿煌剑（越阶第三主战·配剑影分光术）与奇虫榜玉简入手。金鼓原急报传来：黑煞教倾巢、灵兽山倒戈，正道危殆。");
      s.worldNews = s.worldNews || [];
      const t = `第${s.year}年${s.month}月`;
      s.worldNews.push({ t, kind: "world", text: "金鼓原战报：黑煞教残部与天南诸路魔修合流倾巢来犯，灵兽山一脉临阵倒戈，正道联军节节败退、血染旷野。" });
      s.worldNews.push({ t, kind: "rumor", text: "灵兽山倒戈：素来中立的灵兽山竟在金鼓原反水投魔，天南正道一时人心惶惶，皆道大厦将倾。" });
      if (s.worldNews.length > 40) s.worldNews.splice(0, s.worldNews.length - 40);
    },
    choices: [
      {
        text: "「黄枫谷有难——连夜赶赴金鼓原！」",
        hint: "抢先赶到战场，但气血未复",
        effect(s) {
          s.hp = Math.max(1, Math.floor(s.hp * 0.9));
          State.setFlag("zaibie_rush_jingu");
          return { text: "你按住伤势，星夜奔赴金鼓原——黄枫谷的安危，等不得。", kind: "event" };
        },
        resolve: "advance",
      },
      {
        text: "「磨刀不误砍柴工。」先调息一夜，明日再赴。",
        hint: "气血充盈上阵——但金鼓原又多熬了一夜",
        effect(s) {
          s.hp = s.hpMax;
          State.setFlag("zaibie_rest_jingu");
          return { text: "调息一夜，气血充盈——可金鼓原的战报，一夜比一夜凶险。", kind: "event" };
        },
        resolve: "advance",
      },
    ],
  },

  // ——【Act2·金鼓原崩盘·其一】群战（sides[]：李化元/南宫婉并肩 vs 黑煞教残众）——
  {
    id: "zaibie_a2_jingu",
    skipIf: (s) => s.flags.zaibie_jingu_done,
    cond: (s) => s.flags.zaibie_a1_after_done && !s.flags.zaibie_jingu_done,
    cg: "jingu_yuan",
    bgm: "combat",
    title: "再别天南 · 金鼓原决战",
    objTitle: "金鼓原·擒贼先擒王",
    objHint: "战鼓如雷、血染黄沙。与李化元、南宫婉并肩冲杀，先斩魔修领队、撕开缺口——纵知大局难挽，也要为黄枫谷的弟子搏一条退路。",
    text: [
      { scene: "金鼓原 · 旷野战场" },
      { fx: "shake", px: 10 },
      "金鼓原上，战鼓如雷、血染黄沙。黑煞教倾巢而出，倒戈的灵兽山妖兽成群，正道联军被压得节节后退。",
      { actor: "lihuayuan", enter: "left", name: "李化元" },
      { say: "李化元", tone: "stern", text: "「韩立！你来得正好——先斩那魔修领队，群势自溃！曲魂护住中路！」" },
      { actor: "nangongwan", enter: "left", name: "南宫婉" },
      { say: "南宫婉", tone: "cold", text: "「我掠左翼。韩立，你我合力——擒贼先擒王。」" },
    ],
    onArrive(s) {
      s.location = "jinguyuan";
    },
    choices: [
      { text: "与李化元、南宫婉并肩——先斩领队！", hint: "sides[] 群战·曲魂并肩", resolve: "jingu_fight" },
    ],
  },

  // ——【Act2·金鼓原崩盘·其二】护山大阵·守阵（objective:survive；撑到李化元燃命布阵）——
  {
    id: "zaibie_a2_hushan",
    skipIf: (s) => s.flags.zaibie_hushan_done,
    cond: (s) => s.flags.zaibie_jingu_done && !s.flags.zaibie_hushan_done,
    cg: "hushan_zhen",
    bgm: "boss",
    title: "再别天南 · 护山大阵",
    objTitle: "死守阵脚·待阵成",
    objHint: "溃局已不可挽。李化元燃起本命真元强布护山大阵，护黄枫谷弟子退走——你与曲魂死守阵脚六息，拖到阵成即可，不必胜。",
    text: [
      { scene: "金鼓原 · 山口阵眼" },
      "领队虽斩，魔潮却如决堤之水涌来。正道大势已去，李化元面色惨白，却忽然盘膝坐定阵心，白须无风自动。",
      { say: "李化元", tone: "low", text: "「大势已去……老夫这条残命，便换一道护山大阵，护黄枫谷的弟子退走！韩立、曲魂——给我守住阵脚六息！」" },
      { fx: "material", at: "center", elem: "tu" },
      { say: "韩立", emo: "cold", tone: "low", text: "「李前辈——！……好。曲魂，封住阵口，一个都别放进来！」" },
    ],
    onArrive(s) { s.location = "jinguyuan"; },
    choices: [
      { text: "死守阵脚，拖到护山大阵布成！", hint: "objective:survive 6 回合·满血上阵", resolve: "hushan_fight" },
    ],
  },

  // ——【Act2 收束】李化元燃命殉道（cutscene·sorrow）——
  {
    id: "zaibie_a2_lihuayuan",
    cg: "hushan_zhen",
    skipIf: (s) => s.flags.zaibie_lhy_done,
    cond: (s) => s.flags.zaibie_hushan_done && !s.flags.zaibie_lhy_done,
    bgm: "sorrow",
    title: "再别天南 · 燃命",
    objTitle: "李化元殉道",
    objHint: "护山大阵成，魔潮被挡在阵外。可阵心那道白须身影，已灯枯油尽——李化元燃尽了最后一缕真元。",
    text: [
      { scene: "金鼓原 · 护山大阵 · 阵心" },
      { cam: "zoom", scale: 1.12, ms: 1200 },
      "齐天光幕轰然立起，整座山口被一道光墙护住，溃退的弟子们终于得了喘息。可阵心那道白须身影，却悄然伏倒，气息一点点散去。",
      { actor: "lihuayuan", enter: "left", emote: null, name: "李化元" },
      { say: "李化元", tone: "weak", text: "「咳……护山大阵，能撑上三日。韩立……黄枫谷的根，就……拜托了……」" },
      { say: "韩立", emo: "cold", tone: "low", text: "「李前辈！……前辈！」" },
      { fx: "flash", color: "#ffe8b0", ms: 240 },
      { actor: "lihuayuan", exit: true },
      "白须身影化作点点流光，散入那道护山光幕里。一位老人，把自己烧成了黄枫谷最后一道屏障。",
      { aside: "你将这份沉甸甸的托付记在心头。天南的旧人旧事，原来真的会一桩桩、一件件地凋零下去。" },
    ],
    onArrive(s) {
      s.location = "jinguyuan";
      State.setFlag("zaibie_lhy_done");
      Engine.writeLedger("zaibie_lihuayuan", "再别天南·金鼓原收束——李化元燃尽本命真元布成护山大阵，护黄枫谷弟子退走，自己灯枯油尽、殉道于阵心。韩立受其临终托付。");
      Engine.addMilestone("再别天南：李化元燃命殉道，护山大阵成", "zaibie");
      if (typeof Sfx !== "undefined") Sfx.play("fail");
      // 帆段：李化元殉道后给2月喘息——护阵退走、调息养伤、再亡命元武
      s.flags.zaibie_a3_due = State.absMonth() + 2;
    },
    choices: [
      {
        text: "「前辈的托付，我记下了。」",
        hint: "沉痛悼念——这份情，记入因果账本",
        effect(s) {
          Engine.writeLedger("lihuayuan_death_mourn", true);
          return { text: "你向着那道散入光幕的流光，深深一拜。", kind: "event" };
        },
        resolve: "advance",
      },
      {
        text: "「……黄枫谷的根，我来守。」沉默承受，不发一语。",
        hint: "沉默承受——化悲愤为前行的力",
        effect(s) {
          Engine.writeLedger("lihuayuan_death_stoic", true);
          s.mood = Math.max(0, s.mood - 3);
          return { text: "你将那份沉甸甸的痛压进心底，不发一语，转身护住退走的弟子。", kind: "event" };
        },
        resolve: "advance",
      },
    ],
  },

  // ——【Act3·亡命元武】齐云霄已殁·辛如音耗血修阵·赠古阵图纸——
  {
    id: "zaibie_a3_yuanwu",
    cg: "yuanwu_diku",
    skipIf: (s) => s.flags.zaibie_a3_done,
    cond: (s) => s.flags.zaibie_lhy_done && !s.flags.zaibie_a3_done
                 && State.absMonth() >= (s.flags.zaibie_a3_due || 0),
    bgm: "sorrow",
    title: "再别天南 · 亡命元武",
    objTitle: "元武国·古阵图纸",
    objHint: "金鼓原既崩，天南再无你立锥之地。循大挪移令的线索，你亡命奔向元武国——故人齐云霄已殁，唯有辛如音守着一座残破的古传送阵。",
    text: [
      { scene: "元武国 · 百艺坊 · 地窟" },
      { shot: "establish" },
      { amb: "candle" },
      "金鼓原一败，天南正道再难给你容身之处。你循着大挪移令与古传送阵的线索，一路亡命，奔入元武国境内。",
      { aside: "百艺坊深处的地窟里，藏着一座尘封万载的古传送阵。可当年精研此阵的齐云霄，早已在魔劫中身死道消——只剩一个清瘦女子，守着残阵，形容枯槁。" },
      { shot: "pushIn" },
      { say: "辛如音", tone: "weak", text: "「你便是……韩立？齐前辈临终前说过，若有持大挪移令者来，便把这座古阵……交托于他。」" },
      { say: "辛如音", tone: "low", text: "「这阵残损得太重，凭我之力修不全了。这卷修复图纸，你拿着——配上大挪移令，或许真能强启它一次，送你离开天南。」" },
      { aside: "你接过那卷《古传送阵·修复图纸》，指尖一沉。原来通往乱星海的那条线，竟要踏着这许多故人的死生，才牵得起来。" },
    ],
    onArrive(s) {
      s.location = "yuanwu";
      State.setFlag("zaibie_a3_done");
      if (State.count("guzhen_tuzhi") < 1) State.give("guzhen_tuzhi", 1);
      Engine.writeLedger("zaibie_a3_yuanwu", "再别天南·亡命元武——故人齐云霄已殁，辛如音守残破古传送阵，赠《古传送阵·修复图纸》。配大挪移令可强启古阵、离开天南。");
      Engine.addMilestone("再别天南：得古传送阵修复图纸（辛如音赠）", "zaibie");
      s.worldNews = s.worldNews || [];
      const t = `第${s.year}年${s.month}月`;
      s.worldNews.push({ t, kind: "rumor", text: "元武国传闻：付家昔年延请的修阵大家齐云霄，已殁于天南魔劫；其遗下的古传送阵秘术，不知落入何人之手。" });
      if (s.worldNews.length > 40) s.worldNews.splice(0, s.worldNews.length - 40);
    },
    choices: [
      {
        text: "「这份图纸，我收下了。——多谢。」",
        hint: "收图即走——亡命要紧",
        effect(s) {
          return { text: "你将图纸收入储物袋，向辛如音一拱手。", kind: "event" };
        },
        resolve: "advance",
      },
      {
        text: "「图纸我收。这瓶金疮药你留着——续命要紧。」留下一瓶金疮药。",
        hint: "消耗1瓶金疮药，辛如音或能多撑几日",
        requireItem: "huixue_dan",
        effect(s) {
          State.take("huixue_dan", 1);
          Engine.writeLedger("xinruyin_helped", true);
          return { text: "你取出一枚疗伤丹搁在她手心。辛如音怔了怔，唇角微微一弯——这枯槁的女子，竟也有了一丝血色。", kind: "good" };
        },
        resolve: "advance",
      },
    ],
  },

  // ——【Act4·再别天南·其一】三人护道战（objective:survive；南宫婉/陈巧倩护道）——
  {
    id: "zaibie_a4_hudao",
    cg: "yanjia_canyuan",
    skipIf: (s) => s.flags.zaibie_hudao_done,
    cond: (s) => s.flags.zaibie_a3_done && !s.flags.zaibie_hudao_done,
    bgm: "combat",
    title: "再别天南 · 护道",
    objTitle: "三人护道·撑过追杀",
    objHint: "魔道追兵咬得极紧。南宫婉、陈巧倩赶来与你结阵护道——撑住这一波追杀，护住身后那条退往越国矿洞的退路。",
    text: [
      { scene: "燕家堡 · 残垣" },
      "携图纸西行，魔道的追兵却咬得极紧。退至燕家堡旧地的残垣时，两道身影自侧翼掠来，替你挡下了当头一击。",
      { actor: "nangongwan", enter: "left", name: "南宫婉" },
      { say: "南宫婉", tone: "cold", text: "「韩立，护住退路——这一波追兵，我与巧倩替你拦下。」" },
      { actor: "chenqiaoqian", enter: "left", name: "陈巧倩" },
      { say: "陈巧倩", tone: "anxious", text: "「韩师弟当心！往矿洞去的路，绝不能断！」" },
    ],
    onArrive(s) { s.location = "yanjiabao"; },
    choices: [
      { text: "三人结阵护道——撑住这一波！", hint: "objective:survive 6 回合·满血上阵", resolve: "hudao_fight" },
    ],
  },

  // ——【Act4·再别天南·其二】吸修跌境·纯演出（不动数值）——
  {
    id: "zaibie_a4_diejing",
    cg: "yanjia_canyuan",
    skipIf: (s) => s.flags.zaibie_diejing_done,
    cond: (s) => s.flags.zaibie_hudao_done && !s.flags.zaibie_diejing_done,
    bgm: "sorrow",
    title: "再别天南 · 跌境",
    objTitle: "暗算·修为暴跌",
    objHint: "追兵中混着一名阴狠的吸修。混战间他贴身偷袭，一缕诡异魔功攫住你的修为——气海骤空，外人看去，你竟跌回了炼气数层。",
    text: [
      { scene: "燕家堡 · 残垣" },
      "追兵将退之际，人群中却悄然欺近一道阴影——是个修『吸星噬元』一脉邪法的吸修，专挑你护体真元最薄的一瞬，贴身一击！",
      { fx: "burst", at: "center", elem: "huo" },
      { sfx: "hit" },
      { say: "韩立", emo: "cold", tone: "weak", text: "「唔——！我的灵力……被他吸走了大半……！」" },
      { aside: "气海骤然一空。曲魂血刃及时反手将那吸修绞杀，可你的修为已被夺去大半——外人看去，你竟像是跌回了炼气数层的孱弱模样。" },
      { aside: "（跌境·纯演出——你的境界与战力数值并未真正改变；这只是外人眼中、与你自己心境上的一道阴影。乱星海之初，你自会重新拾回这口气，并一举踏入结丹。）" },
    ],
    onArrive(s) {
      s.location = "yanjiabao";
      State.setFlag("zaibie_diejing");      // 纯演出标记（引擎不读·不动任何数值）
      State.setFlag("zaibie_diejing_done");
      Engine.writeLedger("zaibie_diejing", "再别天南·跌境（纯演出·不动数值）——吸修贴身暗算，夺走韩立大半修为，外人看去如跌回炼气数层。境界/战力数值实际未变，乱星海之初自会拾回并结丹。");
      Engine.addMilestone("再别天南：遭吸修暗算，修为『跌境』（纯演出）", "zaibie");
      if (typeof Sfx !== "undefined") Sfx.play("fail");
    },
    choices: [
      {
        text: "「……不过是一时的。这口气，我迟早拿回来。」咬牙硬撑。",
        hint: "强压伤势维持境界——心境受挫但志不倒",
        effect(s) {
          State.setFlag("zaibie_hold_realm");
          s.mood = Math.max(0, s.mood - 5);
          return { text: "你咬碎牙关，硬生生将翻涌的气海压住——外人看去虽狼狈，内里一口气始终未散。", kind: "event" };
        },
        resolve: "advance",
      },
      {
        text: "「留得青山在。」顺势力卸跌境，先保命再说。",
        hint: "卸力保命——气血充盈，但外人看你更弱",
        effect(s) {
          State.setFlag("zaibie_accept_drop");
          s.hp = s.hpMax;
          return { text: "你顺势卸去翻涌的真元，气海虽空，气血反倒稳住了——只是外人看去，你更像个废人了。", kind: "event" };
        },
        resolve: "advance",
      },
    ],
  },

  // ——【Act4·再别天南·其三】南宫婉赠灵石——
  {
    id: "zaibie_a4_lingshi",
    cg: "kuangdong_kou",
    skipIf: (s) => s.flags.zaibie_lingshi_done,
    cond: (s) => s.flags.zaibie_diejing_done && !s.flags.zaibie_lingshi_done,
    bgm: "sorrow",
    title: "再别天南 · 赠别",
    objTitle: "南宫婉赠灵石",
    objHint: "退至越国矿洞外，南宫婉默默塞来一袋中品灵石，助你疗复、催动古阵。再别天南，这一程，到了分别的时候。",
    text: [
      { scene: "越国矿洞 · 洞口" },
      "一路退到越国边陲那座废弃矿洞外，追兵被远远甩开。南宫婉看着你跌境后孱弱的模样，沉默片刻，将一袋沉甸甸的灵石塞进你手里。",
      { actor: "nangongwan", enter: "left", name: "南宫婉" },
      { say: "南宫婉", tone: "soft", text: "「这是一袋中品灵石，拿着——你如今这副样子，路上总要用得着。古阵那边，进去之后，就别再回头了。」" },
      { say: "韩立", emo: "cold", tone: "low", text: "「……南宫姑娘，多谢。后会，总该有期。」" },
      { aside: "她没有再说话，只是退开一步，目送你走向矿洞深处。这一别，便是天南之外、茫茫数万里了。" },
    ],
    onArrive(s) {
      s.location = "yuekuang";
      State.setFlag("zaibie_lingshi_done");
      State.give("lingshi", 30);
      Engine.writeLedger("zaibie_lingshi", "再别天南·赠别——越国矿洞外，南宫婉赠中品灵石一袋，助跌境后的韩立疗复、催动古阵。");
      Engine.addMilestone("再别天南：南宫婉赠灵石，矿洞前赠别", "zaibie");
      // 帆段：矿洞前给1月最后休整——调息、备牌、与天南做最后的告别
      s.flags.zaibie_kuangdong_due = State.absMonth() + 1;
    },
    choices: [
      {
        text: "「就此别过。——进矿洞，启古阵。」",
        hint: "干脆利落——韩立的道，不拖泥带水",
        effect(s) {
          return { text: "你接过灵石，转身走向矿洞深处，没有回头。", kind: "event" };
        },
        resolve: "advance",
      },
      {
        text: "「南宫姑娘的心意，韩某……愧领了。」",
        hint: "难得流露一丝温情——记入因果账本",
        effect(s) {
          Engine.writeLedger("nangong_lingshi_grateful", true);
          s.mood = Math.min(s.moodMax, s.mood + 2);
          return { text: "你握了握那袋灵石，喉头微动，到底多说了一句。南宫婉微微一怔，旋即别过脸去——海风里，似有一声极轻的叹息。", kind: "good" };
        },
        resolve: "advance",
      },
    ],
  },

  // ——【Act4·再别天南·其四】矿洞拖时·启阵（objective:survive；辛如音耗血修阵+大挪移令）——
  {
    id: "zaibie_a4_kuangdong",
    skipIf: (s) => s.flags.zaibie_kuangdong_done,
    cond: (s) => s.flags.zaibie_lingshi_done && !s.flags.zaibie_kuangdong_done
                 && State.absMonth() >= (s.flags.zaibie_kuangdong_due || 0),
    cg: "chuansong_zhen",
    bgm: "boss",
    title: "再别天南 · 矿洞拖时",
    objTitle: "死守洞口·待古阵启",
    objHint: "矿洞最深处，辛如音耗尽精血强行修阵。追兵踏碎洞口扑来——你与曲魂死守隘口六息，待大挪移令催动古阵，便能一步踏出天南。",
    text: [
      { scene: "越国矿洞 · 古传送阵 · 阵心" },
      "矿洞最深处，那座尘封万载的古传送阵幽光明灭。辛如音竟先你一步赶到，正瘫坐阵心、咬破指尖，以精血一笔一笔补全残破的阵纹。",
      { say: "辛如音", tone: "weak", text: "「韩道友——我以精血替你强修这古阵！你与那化身……替我拖住追兵六息！大挪移令一催，古阵就能送你走！」" },
      { fx: "shake", px: 8 },
      "话音未落，追兵已踏碎洞口、潮水般涌入。曲魂血刃横身拦在阵前——只剩这最后六息了。",
    ],
    onArrive(s) { s.location = "yuekuang"; },
    choices: [
      { text: "死守隘口六息——待古阵启动！", hint: "objective:survive·满血上阵·胜接演出①", resolve: "kuangdong_fight" },
    ],
  },

  // ============================================================
  // 演出① 离开天南（矿洞古阵·大挪移令当面传送·毁阵断追·韩立辞别天南之誓）
  // ============================================================
  {
    id: "zaibie_cut1_likai",
    skipIf: (s) => s.flags.zaibie_likai_done,
    cond: (s) => s.flags.zaibie_kuangdong_done && !s.flags.zaibie_likai_done,
    cg: "chuansong_zhen",
    bgm: "boss",
    title: "再别天南 · 离开天南",
    objTitle: "大挪移令·强启古阵",
    objHint: "辛如音泣血修成古阵，贯天光柱已起。取出大挪移令，亲手催动这跨域大阵——一步踏出天南，再毁阵断后，斩断身后所有追路。",
    text: [
      { scene: "越国矿洞 · 古传送阵 · 阵心" },
      { cam: "focus", at: "center" },
      "六息撑过，古阵心爆起一道贯天光柱。辛如音泣血一喝，指尖最后一道阵纹补全——大挪移令催动的契机，只在这一瞬。",
      { say: "辛如音", tone: "weak", text: "「就是现在——！持令入阵心，催动它！迟一息，这古阵就要塌了！」" },
      { actor: "hanli", enter: "right", emote: "cold", name: "韩立" },
      "你取出那枚自胥王矿洞古阵心捧出的大挪移令，掌心一热，迎着贯天光柱踏入阵心——",
      {
        beat: {
          kind: "window",
          prompt: "贯天光柱将熄、追兵已扑至阵前——",
          action: "催动大挪移令·强启古阵！",
          ms: 2600,
          onHit: { sfx: "success", fx: { fx: "flash", color: "#bfe9ff", ms: 320 }, cam: "shake", px: 12,
                   line: "大挪移令应手而碎，跨域大阵轰然全开——刺目青光自脚下冲天而起，将你整个人吞没！" },
          onMiss: { sfx: "cast", fx: { fx: "flash", color: "#bfe9ff", ms: 320 },
                    line: "千钧一发，你咬牙将大挪移令拍入阵心——青光暴涨，将你整个人吞没！" },
        },
      },
      { fx: "flash", color: "#dff3ff", ms: 360 },
      { sfx: "thunder" },
      { cam: "shake", px: 14 },
      "光柱冲霄的刹那，古阵自身也轰然崩裂——身后追兵的咒骂、辛如音最后那个虚弱而释然的笑、整座天南的山河……都在这一瞬被青光彻底吞没、抛在了脑后。",
      { say: "韩立", emo: "cold", tone: "low", text: "「天南……生我、养我、也负我之地。总有一天——我会回来的。」" },
      { aside: "大挪移令碎了，古阵塌了，身后所有的追路，就此斩断。再别天南——这一别，是天南之外、茫茫数万里的未知。" },
    ],
    onArrive(s) {
      s.location = "yuekuang";
      State.setFlag("zaibie_likai_done");
      if (State.count("xinruyin_letter") < 1) State.give("xinruyin_letter", 1);
      Engine.writeLedger("zaibie_likai", "再别天南·演出①离开天南——辛如音泣血修成古阵，韩立持大挪移令强启跨域大阵、一步踏出天南，古阵随之崩毁、斩断追路。辞天南之誓：『总有一天，我会回来的。』辛如音绝笔随身。");
      Engine.addMilestone("再别天南：大挪移令强启古阵，离开天南", "zaibie");
    },
    choices: [
      {
        text: "青光吞没前——最后回望一眼天南。",
        hint: "回望故土——这份牵绊，记入因果账本",
        effect(s) {
          Engine.writeLedger("zaibie_lookback", true);
          return { text: "你在青光吞没的最后一瞬回头望去——天南的山河在光柱之外渐渐模糊、远去，终至不见。", kind: "event" };
        },
        resolve: "advance",
      },
      {
        text: "头也不回——踏光而去。",
        hint: "斩断牵绊——前路只向星海",
        effect(s) {
          Engine.writeLedger("zaibie_no_lookback", true);
          return { text: "你没有回头。青光自脚下冲天而起，将故土的一切抛在身后——前路只有茫茫星海。", kind: "event" };
        },
        resolve: "advance",
      },
    ],
  },

  // ============================================================
  // 演出② 到达乱星海（落海·首见浩瀚妖海·大远景空镜·章末定格）+ 解锁初入星海钩
  // ============================================================
  {
    id: "zaibie_cut2_luanxinghai",
    skipIf: (s) => s.flags.arc4_complete,
    cond: (s) => s.flags.zaibie_likai_done && !s.flags.arc4_complete,
    cg: "luanxinghai",
    bgm: "journey",
    title: "再别天南 · 到达乱星海",
    objTitle: "落海 · 首见乱星海",
    objHint: "古阵崩毁的洪流将你抛入一片无边汪洋——海天一色、星罗万岛、妖氛弥天。这便是传说中的乱星海。再别天南篇·终。",
    text: [
      { scene: "乱星海 · 无边汪洋" },
      { cam: "zoom", scale: 1.0, ms: 200 },
      "青光骤散。脚下一空——你竟自半空跌落，重重砸进一片冰凉的咸涩海水里！",
      { fx: "burst", at: "center", elem: "shui" },
      { sfx: "splash" },
      "古阵崩毁的空间乱流，把你抛到了一个全然陌生的所在。你拼力浮出水面，环顾四周——",
      { cam: "pan", to: { x: 0, y: -6 }, ms: 1600 },
      { wait: 600 },
      "海天一色，无边无际。远处星罗棋布般散着大大小小的岛屿，天际线上妖氛弥漫、隐有庞然之物翻涌的气息。这片汪洋，比你见过的任何天地都更辽阔、也更凶险。",
      { say: "韩立", emo: "cold", tone: "low", text: "「这里……便是传说中的乱星海么。内星海人修、外星海妖修……我落在了哪一边？」" },
      { cam: "zoom", scale: 1.15, ms: 2000 },
      { aside: "孤身一人，落在这片陌生的浩瀚妖海。身后是再回不去的天南，身前是吉凶未卜的星海万里。一段全新的命途，自这片海平线上，缓缓拉开。" },
      {
        guide: {
          tag: "再别天南篇 · 终",
          title: "下一程：初入星海",
          hint: "古阵将你抛入乱星海。茫茫妖海、孤身一人——你将自孤岛立身，拾回跌境暂失的修为，一步步叩问结丹之境。初入星海篇，自这片海平线上展开。",
          cta: "（踏入乱星海·初入星海篇·启）",
        },
      },
    ],
    onArrive(s) {
      s.location = "luanxinghai";
      State.setFlag("arc4_complete");
      State.setFlag("zaibie_luanxinghai_done");
      Chapters.unlock("starsea");   // 解锁初入星海篇钩子（篇章配置待后续窗口实装）
      Engine.writeLedger("zaibie_luanxinghai", "再别天南·演出②到达乱星海——古阵崩毁的空间乱流将韩立抛入乱星海，落海·首见浩瀚妖海。章末定格于无边海景。解锁『初入星海篇』钩子（待后续实装）。再别天南篇·终。");
      Engine.addMilestone("再别天南·终：落海乱星海，首见浩瀚妖海（章末定格）", "zaibie");
      s.worldNews = s.worldNews || [];
      const t = `第${s.year}年${s.month}月`;
      s.worldNews.push({ t, kind: "world", text: "异闻：天南越国一座废弃矿洞深处的万载古传送阵骤然崩毁，光华冲霄数十里——有人说，那是有人借古阵远遁出了天南。" });
      s.worldNews.push({ t, kind: "rumor", text: "乱星海传说：人界西北那片无尽汪洋，内星海人修、外星海妖修，凶险莫测；得入其中者，再难循原路返回天南。" });
      if (s.worldNews.length > 40) s.worldNews.splice(0, s.worldNews.length - 40);
      if (typeof Sfx !== "undefined") Sfx.play("success");
    },
    choices: [
      {
        text: "「乱星海……我来了。」",
        hint: "豪气顿生——心境微升",
        effect(s) {
          s.mood = Math.min(s.moodMax, s.mood + 5);
          return { text: "你深吸一口咸涩的海风，胸中豪气顿生——天南留不住的人，这片海未必也留不住。", kind: "good" };
        },
        resolve: "advance",
      },
      {
        text: "环顾四方，默然不语。",
        hint: "沉静以对——心境微降但更冷静",
        effect(s) {
          s.mood = Math.max(0, s.mood - 5);
          State.setFlag("zaibie_calm");
          return { text: "你没有说话，只是默默打量着这片陌生的汪洋——冷静，才是活下来的本钱。", kind: "event" };
        },
        resolve: "advance",
      },
    ],
  },

  /* ===================== 初入星海篇 · 第一/二幕（增量5）=====================
   * 第一幕·孤岛立身（落海→魁星岛镇妖台擂台→小寰岛闭关）
   * 第二幕·镇妖大典惊变（极限斩杀婴鲤兽·雷鹏破封·风希斩雷鹏夺翅材料·救小紫灵·乱星海大乱）。
   * 复用：fieldCycle / sides[] / waves / objective:survive / SideUnit（曲魂）/ cutscene 原语——零新增系统。
   * 越阶范式（A2·balance.js 不动）：韩立筑基后期巅峰（realmBand≈2.4），越阶 ×0.45；雷鹏/风希＝元婴·仅 cutscene。
   * 考据见 docs/lore-churu-xinghai.md / docs/churu-xinghai-design.md（动漫年番原创·镇妖大典）。 */

  // —— 第一幕①·落海·低阶妖兽遭遇（fieldCycle 海域相位·神识强/修为弱反差·凡人味开局）——
  {
    id: "starsea_a1_open",
    skipIf: (s) => s.flags.starsea_yaoshou_done,
    cond: (s) => s.flags.arc4_complete && !s.flags.starsea_yaoshou_done,
    cg: "luanxinghai",
    bgm: "tense",
    title: "初入星海 · 落海",
    objTitle: "落海 · 海中遇袭",
    objHint: "你与曲魂随古阵乱流跌入乱星海。咸涩海水里，一头低阶妖兽循着气血味扑来——神识虽在、落海修为却虚，先稳住阵脚活下来。",
    text: [
      { scene: "乱星海 · 近岛海域" },
      { cam: "zoom", scale: 1.05, ms: 300 },
      "咸涩的海水呛入口鼻。你在浪头里浮沉，灵力被这冰凉海水搅得滞涩——落海这一摔，到底虚了几分修为。好在曲魂·身外化身随你一同被抛了出来，黑煞血刃在水里划开一道暗芒，护在你身侧。",
      "你定下神，神识如网铺开——海面之下，一道幽影正循着你逸散的气血味，悄无声息地逼近。",
      { fx: "lightning", at: "left", elem: "shui", ms: 280 },
      { sfx: "splash" },
      { say: "韩立", emo: "cold", tone: "low", text: "「神识尚在，修为却虚……也罢。这片海的第一课，便拿你来开。」" },
      { aside: "举目皆是陌生的妖海。身后是再回不去的天南，身前是吉凶未卜的星海万里——可活下去，永远是第一位的。" },
    ],
    onArrive(s) {
      s.activeChapter = "starsea";   // 切入初入星海篇（章名/境界上限由此读；落海仍在海中，不跳魁星岛）
      s.location = "luanxinghai";
      if (!s.flags.starsea_entered) {
        State.setFlag("starsea_entered");
        Engine.writeLedger("starsea_entered", "初入星海·落海——古阵乱流将韩立与曲魂抛入乱星海近岛海域，落海修为暂虚、神识犹在；一头低阶妖兽循血味来袭。孤岛立身，自此一战开篇。");
        Engine.addMilestone("初入星海·落海：携曲魂坠入乱星海", "starsea");
      }
    },
    choices: [
      { text: "神识锁定·先发制人——斩了这头海兽！", hint: "fieldCycle·海域相位·曲魂并肩；越阶轴内恒定", resolve: "starsea_yaoshou_fight" },
    ],
  },

  // —— 第一幕②·登临魁星岛魁星城（海岛异域风·内外海世界观铺陈·乌丑反派露出）——
  {
    id: "starsea_a1_kuixing",
    skipIf: (s) => s.flags.starsea_kuixing_done,
    cond: (s) => s.flags.starsea_yaoshou_done && !s.flags.starsea_kuixing_done,
    cg: "kuixing_land",
    bgm: "journey",
    title: "初入星海 · 登临魁星岛",
    objTitle: "登岛 · 魁星城",
    objHint: "斩退海兽，你随洋流漂至一座外星岛——魁星岛。城中巨像高耸、坊市喧嚣，「内海人修、外海妖修」之说第一次在你耳边铺开；一个黑袍人的目光，曾不动声色地掠过你。",
    text: [
      { scene: "魁星岛 · 魁星城" },
      "斩退那头海兽，你伏在一截浮木上随洋流漂了三日，终于望见一座岛影破开海雾——巨大的石像高踞港口，俯瞰着楼宇层叠、帆樯如林的一座海城。魁星岛，魁星城。",
      { cam: "pan", to: { x: 0, y: -4 }, ms: 1400 },
      "坊市里南腔北调，灵石叮当。你听人议论：这片乱星海以一道大阵划作内外——内星海是人修的地盘，外星海则是万千妖兽的猎场；而魁星岛，正悬在内外之交的边角上。",
      { say: "魁星城散修", tone: "low", text: "「外来的散修？落难漂上岛的多了去了。想在魁星岛落脚，没点本事、没座靠山，连块礁石都轮不到你。」" },
      { aside: "孑然一身、人地两生。要在这片海立住脚，先得有个能遮风的去处——和一身藏得住的本事。" },
      "你正盘算，一道黑袍身影自巷口掠过，目光在你身上若有若无地停了一瞬，又淡淡移开。你心头莫名一凛——那点幽冷的气息，不像善类。",
      { fx: "flash", at: "center", color: "#3a2a55", ms: 220 },
      "未及多想，岛上坐地豪族顾家的管事却寻上了你：顾家正与人争一桩跨海商路的经商权，急需一位「面生、底细干净」的修士，替他们上镇妖台擂台走一遭。报酬，正是你眼下最缺的——魁星岛居留。",
    ],
    onArrive(s) {
      s.location = "kuixing_island";
      State.setFlag("starsea_kuixing_done");
      Engine.meetNpc("gu_family", "顾家管事递来一枚居留玉牌作定：「替我顾家擂台胜了那一场，魁星岛便有阁下一席之地。」");
      s.worldNews = s.worldNews || [];
      const t = `第${s.year}年${s.month}月`;
      s.worldNews.push({ t, kind: "world", text: "见闻：乱星海以大阵划内外——内星海人修聚居、外星海妖兽纵横；魁星岛悬于内外之交，鱼龙混杂。" });
      if (s.worldNews.length > 40) s.worldNews.splice(0, s.worldNews.length - 40);
    },
    choices: [
      {
        text: "接下顾家之邀，登镇妖台。",
        hint: "藏拙立身——以擂台换居留",
        effect(s) {
          State.setFlag("starsea_gu_accept");
          return { text: "你接过玉牌——替人打一场擂台，换一席之地，这笔买卖划算。", kind: "event" };
        },
        resolve: "advance",
      },
      {
        text: "「容我想想。」先观望魁星城形势再说。",
        hint: "谨慎观望——多打听一日再决定",
        effect(s) {
          s.mood = Math.max(0, s.mood - 2);
          State.setFlag("starsea_gu_cautious");
          return { text: "你没有立刻答应——在这片陌生的海域，多看一日、少一分险。顾家管事倒也不急，只说「阁下想好了随时来寻」。", kind: "event" };
        },
        resolve: "advance",
      },
    ],
  },

  // —— 第一幕③·镇妖台擂台 1v1（演示「藏拙」机制·炼气五层假苦战胜八层·猥琐发育）——
  {
    id: "starsea_a1_leitai",
    cg: "leitai",
    skipIf: (s) => s.flags.starsea_leitai_done,
    cond: (s) => s.flags.starsea_kuixing_done && !s.flags.starsea_leitai_done,
    bgm: "combat",
    title: "初入星海 · 镇妖台擂台",
    objTitle: "擂台 · 藏拙险胜",
    objHint: "替顾家上镇妖台。对手不过炼气八层，你却是藏了真境的筑基——要赢，更要赢得「狼狈」：露半分锋芒，便要惹来不必要的觊觎。",
    text: [
      { scene: "魁星岛 · 镇妖台" },
      "镇妖台高三丈，四周看客如堵。对家请来的打手是个炼气八层的精瘦汉子，灵光外放、气势汹汹。台下窃窃私语，都说顾家这回怕是要输。",
      { say: "韩立", emo: "cold", tone: "low", text: "「筑基之身压炼气八层，本是手到擒来。可锋芒一露，便要招来比这擂台凶险百倍的麻烦……藏拙，藏拙。」" },
      "你故意只引动炼气五层的灵力，把一身真元死死压在丹田里，与那汉子缠斗得险象环生——格挡时踉跄半步，还击时似强弩之末，引得台下一阵阵惊呼。",
      { fx: "burst", at: "center", elem: "jin", ms: 260 },
      { sfx: "hit" },
      { aside: "凡人堆里摸爬滚打出来的本事，从不只是斗法——更是「让人小看你」的火候。这一身狼狈，演得比那汉子的灵光还要费神。" },
    ],
    onArrive(s) {
      s.location = "kuixing_island";
    },
    choices: [
      { text: "佯作力竭·一招险胜——既要赢，也要赢得不起眼。", hint: "藏拙叙事·单挑·筑基压炼气八层", resolve: "starsea_leitai_fight" },
    ],
  },

  // —— 第一幕④·获魁星岛居留·寻小寰岛开洞府（新 home·灵气稀薄的孤岛）——
  {
    id: "starsea_a1_xiaohuan",
    skipIf: (s) => s.flags.starsea_xiaohuan_done,
    cond: (s) => s.flags.starsea_leitai_done && !s.flags.starsea_xiaohuan_done,
    cg: "xiaohuan_dongfu",
    bgm: "journey",
    title: "初入星海 · 小寰岛洞府",
    objTitle: "立身 · 小寰岛",
    objHint: "擂台险胜，顾家赢了经商权，你也换来了魁星岛居留。寻一座荒僻外岛安身——小寰岛，灵气稀薄、人迹罕至，却正合你藏身重修。",
    text: [
      { scene: "魁星岛 · 小寰岛航路" },
      "顾家如愿夺了那桩经商权，按约把一枚居留玉牌交到你手里。台上那场「苦战」反倒成了护身符——人人只当你是个修为平平、运气尚可的落难散修。",
      "你不愿在魁星城的眼皮底下久留，向人打听了一座僻处外缘的孤岛——小寰岛。岛小、灵气稀薄、连个常住的修士都没有，正合你的心意。",
      { cam: "pan", to: { x: 0, y: -3 }, ms: 1200 },
      "你在岛上择了一处背风的山腹，布下简陋禁制，开出一座洞府。海风呜咽，唯有曲魂的黑影静立一侧，与你相伴。",
      { aside: "独岛、独修、唯一具身外化身相伴。这份孤独，是落难者的清苦，却也是一段苦修最好的火候。" },
    ],
    onArrive(s) {
      s.location = "xiaohuan_island";
      State.setFlag("starsea_xiaohuan_done");
      State.setFlag("kuixing_resident");   // 镇妖台居留兜底（擂台胜处已置；此处确保小寰岛解锁）
    },
    choices: [
      {
        text: "于小寰岛安身，闭关重修。",
        hint: "孤岛清修——灵气稀薄但无人打扰",
        effect(s) {
          return { text: "你在小寰岛择了一处背风山腹，布下禁制，开出洞府——清苦，却安宁。", kind: "event" };
        },
        resolve: "advance",
      },
      {
        text: "先在魁星城坊市多打听几日，再择岛。",
        hint: "多探一日——或许有更好的去处",
        effect(s) {
          s.mood = Math.min(s.moodMax, s.mood + 2);
          Engine.writeLedger("starsea_xiaohuan_explore", true);
          return { text: "你没有急着找岛——在坊市多盘桓了几日，打听过外岛灵脉的传闻。最终还是小寰岛最合心意，只是多这几日，让你对这片海多了几分了解。", kind: "event" };
        },
        resolve: "advance",
      },
    ],
  },

  // —— 第一幕⑤·闭关苦修二十载（叙事压缩·拾回筑基后期巅峰·三转一转·纯叙事不动数值）——
  {
    id: "starsea_a1_biguan",
    skipIf: (s) => s.flags.starsea_biguan_done,
    cond: (s) => s.flags.starsea_xiaohuan_done && !s.flags.starsea_biguan_done,
    cg: "sanzhuan",
    bgm: "journey",
    title: "初入星海 · 闭关二十载",
    objTitle: "苦修 · 拾回巅峰",
    objHint: "小寰岛灵气虽薄，胜在清静。二十载寒暑，你一寸寸拾回落海暂失的修为，行三转重元功之一转——重修一遍，根基反比从前更纯。",
    text: [
      { scene: "小寰岛 · 洞府" },
      { cam: "zoom", scale: 1.04, ms: 300 },
      "二十载寒暑，在小寰岛的潮声里悄然流过。",
      "灵气稀薄，你便以耐心补拙：青元剑诀一层层重新筑起，三转重元功行至一转——散功重修这一遭，看似跌回入门，真元却淬炼得比从前更精纯几分。落海所失的那点修为，也终于一寸寸拾了回来，重回筑基后期巅峰。",
      { fx: "material", at: "center", elem: "mu", ms: 600 },
      { sfx: "cast" },
      { say: "韩立", emo: "calm", tone: "low", text: "「二十年……总算把根基重新夯实了。这一回重修过的真元，比当年更听使唤。」" },
      { aside: "孤岛一隅，二十年如一日。曲魂静立洞府之侧，从不言语，却让这份清苦的苦修，多了一丝不至于太冷的暖意。" },
    ],
    onArrive(s) {
      s.location = "xiaohuan_island";
      State.setFlag("starsea_biguan_done");
      Engine.doReforge();   // 三转重元功·一转：散功重修，刻入真元精纯乘性印记 zhuanImprint（闭关增速永久略增·不剥层数）
      Engine.addMilestone("初入星海·一幕：小寰岛闭关二十载，拾回筑基后期巅峰（三转一转）", "starsea");
      Engine.writeLedger("starsea_biguan", "初入星海·孤岛立身——小寰岛闭关苦修二十载，行三转重元功一转，散功重修而真元愈纯（乘性印记 zhuanImprint），拾回落海暂失之修为，重回筑基后期巅峰。");
    },
    choices: [
      { text: "苦修剑诀——青元剑芒再淬一寸", hint: "二十载苦修，剑上功夫最该磨",
        effect: (s) => {
          if (!s.swordMastery) {
            s.swordIntent = Math.min(100, (s.swordIntent || 0) + 25);
            if (s.swordIntent === 100) { State.setFlag("sword_intent_full"); Engine.toast && Engine.toast("剑意圆满！可回药庐悟剑"); }
            return { text: "二十载寒暑，你将青元剑诀一寸寸打磨。孤岛潮声中，剑意日渐纯熟——出关之时，指间与剑意已隐隐相通（剑意+25）。", kind: "good" };
          }
          s.mood = Math.min(s.moodMax, (s.mood || 0) + 10);
          return { text: "二十载寒暑，你将青元剑诀一寸寸打磨。眨眼剑法既已大成，你便将心力倾于青元剑芒——出关之时，剑势更沉了几分（心境+10）。", kind: "good" };
        },
        resolve: "advance" },
      { text: "磨砺体魄——以曲魂为假想敌推演战法", hint: "纸上谈兵终觉浅，拿曲魂练手",
        effect: (s) => {
          s.hpMax += 15; s.hp = s.hpMax;
          return { text: "二十载寒暑，你时常以曲魂为假想敌推演战法。它不知疲倦、不会受伤，正好让你把每一招的破绽都摸透。日复一日的实战模拟，你的体魄与反应都比闭门前更扎实了几分（气血上限+15）。", kind: "good" };
        },
        resolve: "advance" },
      { text: "澄心悟道——打坐参悟，道心再澄一寸", hint: "根基要紧，心境更要紧",
        effect: (s) => {
          s.zhuanImprint = Math.round((s.zhuanImprint || 1) * 1.03 * 1000) / 1000;
          return { text: "二十载寒暑，你除日常功课外，更多了几分打坐参悟的功夫。潮起潮落间，道心比从前更澄明了几分——三转重元功的精纯印记，又添了一层（闭关修为增速额外+3%）。", kind: "good" };
        },
        resolve: "advance" },
    ],
  },

  // —— 第二幕①·魁星城寻药未果·再遇文樯·听闻镇妖大典与降尘丹·途中擦肩小紫灵 ——
  {
    id: "starsea_a2_wenqiang",
    cg: "wenqiang",
    skipIf: (s) => s.flags.starsea_wenqiang_done,
    cond: (s) => s.flags.starsea_biguan_done && !s.flags.starsea_wenqiang_done,
    bgm: "journey",
    title: "镇妖大典 · 再遇文樯",
    objTitle: "引线 · 降尘丹",
    objHint: "出关入魁星城遍寻结丹灵药（雪灵水、天火液）皆无果。一座坊市里，你竟撞见旧识文樯——他要拉你同赴六连殿的镇妖大典，去搏那降低结丹门槛的榜首奖：降尘丹。",
    text: [
      { scene: "魁星城 · 天工坊市" },
      "出关之后，你入魁星城遍访丹铺药行，想寻结丹所需的雪灵水、天火液——可这两味灵药价比连城，有市无货，问得你一筹莫展。",
      "正失意间，一道熟悉的声音在身后响起。",
      { say: "文樯", tone: "soft", text: "「这位道友的背影……韩道友？真是你！当年一别，竟在这乱星海的魁星城重逢，缘分不浅啊。」" },
      "竟是文樯——昔年的一面之识，文思月之父，如今也漂泊在这片星海。故人乡音，叫这陌生的海城都暖了几分。",
      { say: "文樯", tone: "soft", text: "「韩道友也为结丹灵药犯难？正巧——六连殿要在魁星岛办一场镇妖大典，榜首之奖是一枚『降尘丹』，能降一分结丹门槛！你我联手报名，未必没有一搏之力。」" },
      "你心中一动：降尘丹，正是叩开结丹之门的一线契机。当下与文樯约定，同往六连殿报名。",
      { fx: "flash", at: "center", color: "#caa6ff", ms: 220 },
      "随文樯穿过人潮时，一个抱着乐器的紫衣小女孩与你擦肩而过。你心头莫名一颤——那张脸，竟生出一种说不清、道不明的熟悉感，仿佛在很久很久以前便已相识。可那女孩很快没入人流，再寻不见了。",
      { aside: "那点熟悉，像一缕够不着的旧梦。你摇摇头，把它压下——眼下，先是大典与降尘丹。" },
    ],
    onArrive(s) {
      s.location = "kuixing_island";
      State.setFlag("starsea_wenqiang_done");
      Engine.meetNpc("wen_qiang", "「韩道友肯与我同往，这镇妖大典便多了三分底气。」文樯抚须而笑。");
      s.worldNews = s.worldNews || [];
      const t = `第${s.year}年${s.month}月`;
      s.worldNews.push({ t, kind: "world", text: "魁星岛风传：六连殿将办『镇妖大典』，榜首奖降尘丹（可降结丹门槛），群修云集、妖兽为彩——各方势力俱已动身。" });
      if (s.worldNews.length > 40) s.worldNews.splice(0, s.worldNews.length - 40);
    },
    choices: [
      {
        text: "与文樯同往，报名镇妖大典。",
        hint: "故人联手——多一份底气",
        effect(s) {
          State.setFlag("starsea_wenqiang_ally");
          return { text: "你与文樯约定同往——在这片陌生的海域，故人联手总好过孤身。", kind: "event" };
        },
        resolve: "advance",
      },
      {
        text: "「文道友好意心领，我先独自去看看。」",
        hint: "独行探路——藏拙不暴露底细",
        effect(s) {
          s.mood = Math.max(0, s.mood - 1);
          State.setFlag("starsea_wenqiang_solo");
          return { text: "你婉言谢绝了文樯的邀约——初来乍到，与人联手便意味着多暴露一分底细。先独自去看看，更稳妥。", kind: "event" };
        },
        resolve: "advance",
      },
    ],
  },

  // —— 第二幕②·镇妖大典擂台开场（六连殿·罗马斗兽场·嘉宾席妙音门一家·观众席风希/乌丑）——
  {
    id: "starsea_a2_dadian",
    skipIf: (s) => s.flags.starsea_dadian_done,
    cond: (s) => s.flags.starsea_wenqiang_done && !s.flags.starsea_dadian_done,
    cg: "doushouchang",
    bgm: "tense",
    title: "镇妖大典 · 擂台开场",
    objTitle: "大典 · 婴鲤兽登场",
    objHint: "镇妖大典在六连殿的斗兽场开场。嘉宾席上坐着妙音门掌门一家与苗、古二位长老，观众席里隐着风希与那黑袍人。轮到你这一组——对手，竟是一头越级五阶的婴鲤兽。",
    text: [
      { scene: "魁星岛 · 镇妖大典斗兽场" },
      { cam: "pan", to: { x: 0, y: -5 }, ms: 1500 },
      "镇妖台筑成一座环形斗兽场，层层看台坐满了观礼的修士。台心的禁制幽幽流转，封着大典用作彩头的妖兽。",
      "嘉宾席上，妙音门掌门携夫人、女儿端坐其间，六连殿的苗、古两位长老分列左右；观众席的阴影里，一个白衣妖修「大善人」风希含笑而坐，离他不远，那道黑袍身影也赫然在列。",
      { say: "冯三娘", tone: "stern", text: "「报名第六组的两位道友？我是六连殿冯三娘，这一阵的领队。你们这组抽到的彩头不轻——是头越级的婴鲤兽，幼体便堪比六阶。诸位且听我阵图调度，万勿轻敌。」" },
      { fx: "burst", at: "center", elem: "shui", ms: 280 },
      { sfx: "thunder" },
      "禁制开启，一头浑身赤鳞、双目猩红的巨兽自台心水牢中翻涌而出——婴鲤兽！才是幼体，那扑面而来的妖威便压得满场修士呼吸一窒。",
      { say: "韩立", emo: "cold", tone: "low", text: "「越级五阶……正面硬撼是取死之道。」（你眼神微动，曲魂的黑影悄然没入人群。）「冯领队尽管布阵困它——真正的杀招，待它力竭时再出。」" },
      { aside: "众目睽睽，强敌环伺。这一战，不只为降尘丹——更是在风希、乌丑那等人物眼皮底下，露多少、藏多少的分寸。" },
    ],
    onArrive(s) {
      s.location = "kuixing_island";
      State.setFlag("starsea_dadian_done");
      Engine.meetNpc("feng_sanniang", "「第六组听我号令——阵图既起，便是生死与共。」冯三娘按剑而立。");
      Engine.meetNpc("miaoyin_zhangmen", "妙音门掌门远远朝场中颔首致意，雍容温雅，一家三口同坐嘉宾席。");
    },
    choices: [
      {
        text: "应冯三娘列阵·入场迎敌。",
        hint: "信任阵图——按调度行事",
        effect(s) {
          State.setFlag("starsea_trust_formation");
          return { text: "你点头应下——冯三娘的阵图调度自有章法，按部就班未必不是正途。", kind: "event" };
        },
        resolve: "advance",
      },
      {
        text: "先冷眼观察婴鲤兽的弱点，不急着入场。",
        hint: "伺机而动——多看几息再出手",
        effect(s) {
          State.setFlag("starsea_observe_first");
          return { text: "你没有急着入场——在场边多看了几息，将那婴鲤兽的扑击路线、鳞甲缝隙一一记在心里。", kind: "event" };
        },
        resolve: "advance",
      },
    ],
  },

  // —— 第二幕③·极限斩杀婴鲤兽（sides[冯三娘+曲魂]＋waves[婴鲤兽幼体→困兽暴走]＋fieldCycle 水罡＋越阶斩杀）——
  {
    id: "starsea_a2_yingli",
    cg: "yingli",
    skipIf: (s) => s.flags.starsea_yingli_done,
    cond: (s) => s.flags.starsea_dadian_done && !s.flags.starsea_yingli_done,
    bgm: "boss",
    title: "镇妖大典 · 极限斩杀",
    objTitle: "困兽 · 越级斩杀",
    objHint: "众修法阵不能伤其分毫、损失惨重。你与曲魂后发，借冯三娘的阵图困住越级的婴鲤兽——待它力竭，便是极限斩杀、夺彩之时。",
    text: [
      { scene: "斗兽场 · 困兽阵心" },
      "婴鲤兽狂暴突进，赤鳞水箭与狂涛尾扫横扫全场，众修的法器击在它鳞甲上只溅起一片火星，转眼便有数人被掀飞重伤。冯三娘的阵图艰难合拢，却难伤其分毫。",
      { fx: "lightning", at: "center", elem: "shui", ms: 300 },
      { sfx: "thunder" },
      { say: "冯三娘", tone: "anxious", text: "「困不住多久！它越级的蛮力太强——谁能给我一击致命的机会？！」" },
      { say: "韩立", emo: "cold", tone: "low", text: "「机会，我来制造。」" },
      "你与曲魂一直按兵不动，只待这一刻——巨兽力竭、阵图收束的须臾之隙。黑煞血刃与你的剑光自两翼同时没入它的命门！",
      { aside: "越级而战，从不靠硬碰硬。耗它、困它、算准那一线之机——这，才是凡人韩立的杀法。" },
    ],
    onArrive(s) {
      s.location = "kuixing_island";
    },
    choices: [
      { text: "阵心已合·力竭即斩——曲魂并刃，极限斩杀！", hint: "越级 ×0.45·后发困杀·夺彩", resolve: "starsea_yingli_fight" },
    ],
  },

  // —— 第二幕④⑤·大典惊变（雷鹏破封屠戮·风希斩雷鹏夺双翅离场·非可玩 cutscene）——
  {
    id: "starsea_a2_jingbian",
    skipIf: (s) => s.flags.starsea_jingbian_done,
    cond: (s) => s.flags.starsea_yingli_done && !s.flags.starsea_jingbian_done,
    cg: "leipeng_pofeng",
    bgm: "boss",
    title: "镇妖大典 · 惊变",
    objTitle: "惊变 · 雷鹏破封",
    objHint: "夺彩的喝彩未落，镇妖台中心的禁制骤然炸裂——逆星盟的黑袍人勾结妖修风希、六连殿一长老反水，放出了被星宫双圣镇压百年的上代妖兽之王·十级雷鹏。",
    text: [
      { scene: "镇妖台 · 中央禁制" },
      "你斩落婴鲤兽，满场喝彩还未落下——",
      { cam: "shake", ms: 400 },
      { fx: "burst", at: "center", elem: "jin", ms: 320 },
      { sfx: "thunder" },
      "镇妖台正中那道幽幽流转了百年的禁制，竟毫无征兆地自内炸裂！碎光冲霄数十里。",
      "那黑袍人——逆星盟乌丑——立于裂口之上，狞笑出声；他身侧，白衣风希负手而立；六连殿一名长老竟也反水相助，三道身影合力撕开了封印的最后一线。",
      { say: "乌丑", emo: "cold", tone: "cold", text: "「镇压了百年的旧主，也该出来透透气了。诸位，便拿这一场镇妖大典，给它陪葬罢！」" },
      { cam: "zoom", scale: 1.2, ms: 600 },
      { fx: "lightning", at: "center", elem: "jin", ms: 360 },
      { sfx: "thunder" },
      "封印之下，一声撼动海天的鹏唳炸响——一头通体雷光、双翅垂天的神禽冲天而起！上代妖兽之王，十级雷鹏！被星宫双圣镇压在镇妖台下整整百年的它，此刻睥睨众生，眸中尽是百年屈辱化成的滔天恨意。",
      { say: "雷鹏", tone: "angry", text: "「噫——！百年之囚，今日尽数还来！」" },
      { cam: "shake", ms: 500 },
      { fx: "lightning", at: "left", elem: "jin", ms: 300 },
      { fx: "lightning", at: "right", elem: "jin", ms: 300 },
      { sfx: "thunder" },
      "疾雷双翅一振，雷罡横扫，看台轰然崩塌；它一爪踏碎了镇压自己百年的星宫双圣石像，电芒过处，修士成片殒落。镇妖大典的盛景，顷刻化作修罗炼狱。同一刻，台心裂口轰然洞开——内外星海的通道，竟被一并打通了！",
      { wait: 500 },
      { scene: "炼狱 · 风希出手" },
      "便在这屠戮无人能挡之际，那位白衣「大善人」风希终于动了。",
      { say: "风希", emo: "cold", tone: "low", text: "「上代之王又如何？这身雷骨、这对疾雷双翅……正是我炼制风雷翅的绝佳之材。莫怪。」" },
      { cam: "zoom", scale: 1.25, ms: 700 },
      { fx: "burst", at: "center", elem: "jin", ms: 400 },
      { sfx: "thunder" },
      "元婴期裂风兽化人的真正修为骤然爆发，风刃如海。雷鹏虽悍，终究困兽百年、力有不逮——一场惊天动地的妖王对决之后，雷鹏哀鸣坠落。风希探手一抄，竟生生斩落、夺走了那对垂天的疾雷双翅，身形一晃，没入打通的星海通道，飘然离场。",
      { aside: "雷鹏的双翅，正是风雷翅之材——风希取了材料便走，炼制之事，显然另有图谋。这一笔，你默默记下了。" },
      { say: "韩立", emo: "cold", tone: "low", text: "「元婴之上的厮杀……我连插手的余地都没有。当务之急，是从这场大乱里活着出去。」" },
    ],
    onArrive(s) {
      s.location = "kuixing_island";
      State.setFlag("starsea_jingbian_done");
      Engine.meetNpc("wuchou", "逆星盟黑袍·乌丑——炸开镇妖台禁制、放出雷鹏的元凶之一，幽冷狠辣。");
      Engine.meetNpc("fengxi", "妖修『大善人』风希——元婴期裂风兽化人，斩雷鹏、夺其双翅（风雷翅之材料）后飘然离场。");
      Engine.writeLedger("starsea_jingbian", "镇妖大典惊变——逆星盟乌丑勾结妖修风希、六连殿长老反水，炸开镇妖台禁制，放出镇压百年的十级雷鹏并打通内外星海通道；雷鹏破封屠戮、踩碎星宫双圣石像，旋为风希斩杀、夺走双翅（风雷翅之材料）离场。本篇仅得材料线索，炼制留外海风云篇。");
      Engine.addMilestone("镇妖大典惊变：雷鹏破封·风希斩雷鹏夺翅（风雷翅材料钩）", "starsea");
    },
    choices: [
      {
        text: "（雷鹏陨、风希去——这场大乱，才刚刚开始）",
        hint: "震撼之余——记下风希的弱点",
        effect(s) {
          Engine.writeLedger("starsea_jingbian_observe", true);
          return { text: "你将风希出手的每一式都看在眼里——元婴的手段，今日记下，日后或有用处。", kind: "event" };
        },
        resolve: "advance",
      },
      {
        text: "「先保命要紧。」不去多看，转身就跑。",
        hint: "果断撤离——不多看一眼",
        effect(s) {
          s.hp = Math.min(s.hpMax, s.hp + Math.floor(s.hpMax * 0.05));
          return { text: "你没有多看——元婴的厮杀不是你该掺和的。转身就跑，反而比旁人快了一步。", kind: "event" };
        },
        resolve: "advance",
      },
    ],
  },

  // —— 第二幕⑥·妙音门主殉难·救小紫灵·斩逆星盟古长老脱身（objective:survive 护送逃亡＋精英战）——
  {
    id: "starsea_a2_jiuziling",
    skipIf: (s) => s.flags.starsea_jiuziling_done,
    cond: (s) => s.flags.starsea_jingbian_done && !s.flags.starsea_jiuziling_done,
    cg: "jiu_ziling",
    bgm: "boss",
    title: "镇妖大典 · 救小紫灵",
    objTitle: "护送 · 斩古长老脱身",
    objHint: "雷鹏的余威里，妙音门门主夫妇为护女儿力竭殉难。那紫衣小女孩自高台坠落——正是与你擦肩的「莫名熟悉」之人。逆星盟古长老趁乱拦杀，你须护住她、斩长老、杀出重围。",
    text: [
      { scene: "崩塌的看台 · 坠落" },
      "雷鹏的余波犹在，崩塌的看台间一片哀嚎。嘉宾高台上，妙音门掌门夫妇以血肉之躯护住女儿，被横扫的雷罡击中，力竭殒落——坠落前，那位母亲用尽最后气力，将女儿向台下安全处奋力一掷。",
      { say: "妙音门掌门", tone: "weak", text: "「凝儿……活下去……」" },
      { fx: "lightning", at: "center", elem: "jin", ms: 300 },
      { sfx: "thunder" },
      "那紫衣小女孩自高台跌落，惊惶无措——正是先前与你擦肩、令你莫名心颤的那张脸！电光火石间，你身形已动，稳稳将她接在臂弯。",
      { say: "汪凝", tone: "weak", text: "「爹……娘……」（小女孩泪眼婆娑，却死死攥住了你的衣袖。）" },
      "未及喘息，一道阴冷剑罡破空而至——逆星盟古长老不知何时已盯上这边，假丹之威、筑基巅峰的人修，挟血遁追命之术拦住了你的去路。",
      { say: "古长老", emo: "cold", tone: "cold", text: "「妙音门的余孽，留不得。小子，把人交出来，或可饶你一命。」" },
      { say: "韩立", emo: "cold", tone: "low", text: "「她我护定了。要拦——便先问过我剑，和我身侧这位的刃。」" },
      { aside: "怀中是一条托付给你的性命。护住她、杀出去——曲魂在侧，这一程逃亡，你不会孤身。" },
    ],
    onArrive(s) {
      s.location = "kuixing_island";
    },
    choices: [
      { text: "护住紫灵·曲魂断后——斩古长老，杀出重围！", hint: "objective:survive 护送逃亡＋精英战", resolve: "starsea_jiuziling_fight" },
    ],
  },

  // —— 第二幕⑦·内星海防御大阵失效·乱星海大乱·遁出魁星岛海域（增量5 末·接外星海致富）——
  {
    id: "starsea_a2_luan",
    skipIf: (s) => s.flags.starsea_luan_done,
    cond: (s) => s.flags.starsea_jiuziling_done && !s.flags.starsea_luan_done,
    cg: "luanxinghai",
    bgm: "sorrow",
    title: "镇妖大典 · 乱星海大乱",
    objTitle: "大乱 · 遁出魁星岛",
    objHint: "内外星海通道既开、防御大阵失效，外海妖兽汹涌涌入内海——乱星海大乱。你携小紫灵，趁这滔天乱局，遁出了魁星岛海域。",
    text: [
      { scene: "乱星海 · 魁星岛外海" },
      { cam: "pan", to: { x: 0, y: -6 }, ms: 1600 },
      "斩开古长老的拦截，你护着紫灵杀出重围。身后的魁星岛已成一片火海——内外星海的通道既被打通，内海防御大阵随之失效，外海的妖兽如黑潮般汹涌涌入。乱星海，大乱了。",
      { fx: "burst", at: "center", elem: "shui", ms: 320 },
      { sfx: "splash" },
      "你借着这场吞天的乱局掩护，驾起遁光，载着惊魂未定的小女孩，一头扎进茫茫外海，将魁星岛的火光与喊杀，远远抛在身后。",
      { say: "汪凝", tone: "soft", text: "「……谢谢你，大哥哥。我叫汪凝。」（小女孩怯生生抬头，那双眼睛，又叫你心头泛起那缕说不清的熟悉。）" },
      { say: "韩立", emo: "calm", tone: "low", text: "「先离了这是非之地再说。这片海要乱上好一阵了——乱中，也未必没有机缘。」" },
      { aside: "降尘丹到手、雷鹏与风希的因果落下、怀里多了一条要护的性命。一场大乱，把所有人都卷向未知的海域——而你，已嗅到了乱中取利的气息。" },
      {
        guide: {
          tag: "初入星海篇 · 第一/二幕 暂告段落",
          title: "下一程：外星海 · 顺乱致富",
          hint: "内外星海通道已开、乱星海大乱。你携紫灵遁入外海——接下来，将以霓裳草引妖、噬金虫群猎杀，积攒妖丹硬通货发家致富（外星海致富线·后续窗口实装）。",
          cta: "（遁入外海·乱中取利）",
        },
      },
    ],
    onArrive(s) {
      s.location = "waixinghai";
      State.setFlag("starsea_luan_done");
      State.setFlag("luanxinghai_chaos");   // 内外海通道开·解锁外星海猎场
      Engine.writeLedger("starsea_luan", "乱星海大乱——内外星海通道打通、内海防御大阵失效，外海妖兽涌入内海。韩立携小紫灵（汪凝）趁乱遁出魁星岛海域，奔赴外星海。初入星海篇第一/二幕（孤岛立身·镇妖大典惊变）至此收束。");
      Engine.addMilestone("初入星海·二幕终：乱星海大乱，携紫灵遁出魁星岛海域", "starsea");
      s.worldNews = s.worldNews || [];
      const t = `第${s.year}年${s.month}月`;
      s.worldNews.push({ t, kind: "world", text: "巨变：镇妖台禁制被炸，雷鹏破封、内外星海通道洞开——内海防御大阵失效，外海妖兽汹涌涌入，乱星海大乱。" });
      s.worldNews.push({ t, kind: "rumor", text: "传闻：星宫震怒，大长老金魁已动身——只待乱局稍定，便要孤身示威极阴岛，着手收复内星海。" });
      if (s.worldNews.length > 40) s.worldNews.splice(0, s.worldNews.length - 40);
      if (typeof Sfx !== "undefined") Sfx.play("success");
    },
    choices: [
      {
        text: "（携紫灵·遁入外海——乱中取利，自此开始）",
        hint: "果断出海——趁乱局先行脱身",
        effect(s) {
          State.setFlag("starsea_luan_flee");
          return { text: "你不再多看一眼——怀中紫灵要紧，趁乱遁走，方为上策。", kind: "event" };
        },
        resolve: "advance",
      },
      {
        text: "先助几个跌落的散修一同脱身，再走。",
        hint: "仗义出手——多救几人，但多一分险",
        effect(s) {
          s.mood = Math.min(s.moodMax, s.mood + 4);
          s.hp = Math.max(1, Math.floor(s.hp * 0.95));
          State.setFlag("starsea_luan_help");
          Engine.writeLedger("starsea_luan_help", true);
          return { text: "你没有独自先走——顺手拉起两名跌落看台的散修，一同遁出混乱。多了一分凶险，却也多了几分人望。", kind: "good" };
        },
        resolve: "advance",
      },
    ],
  },

  /* ============================================================
   *  初入星海篇 · 第三幕 —— 外星海取丹 · 发家致富（增量6）
   *  考据：churu-xinghai-design.md §二第三幕 + 动漫《初入星海》ep61~72
   *  顺乱出海 → 霓裳草引妖·噬金虫群猎杀 → 妖丹硬通货 → 金魁示威极阴岛·收复内星海
   * ============================================================ */

  // —— 第三幕①·顺乱出海·外星海猎场（携紫灵漂泊·决意猎妖积丹）——
  {
    id: "starsea_a3_chuhai",
    cg: "chuhai",
    skipIf: (s) => s.flags.starsea_chuhai_done,
    cond: (s) => s.flags.starsea_luan_done && !s.flags.starsea_chuhai_done,
    bgm: "journey",
    title: "外星海 · 顺乱出海",
    objTitle: "乱中取利 · 出海",
    objHint: "乱星海的妖潮把无数散修逼向外海，你却看出这是机缘——外星海妖兽虽凶，妖丹却是结丹的硬通货。安顿好紫灵，备齐行装，往那妖氛弥漫的猎场去。",
    text: [
      { scene: "外星海 · 妖氛猎场边缘" },
      { cam: "pan", to: { x: 0, y: -4 }, ms: 1400 },
      "乱星海一乱，内海待不得了。你驾遁光载着汪凝一路向外海漂去——越往外，海水越是幽碧，妖氛越是浓重，寻常修士避之不及，你却嗅出了机会。",
      { say: "汪凝", emo: "worried", tone: "soft", text: "「大哥哥，外面……外面好多妖兽的气息。我们真要去那种地方吗？」" },
      { say: "韩立", emo: "calm", tone: "low", text: "「越凶险的地方，越藏着旁人不敢取的利。结丹要的资粮，就在那一头头海妖的妖丹里。你且寻处安稳礁岛待着，剩下的，交给我。」" },
      { aside: "结丹三资——降尘丹已得其一，雪灵水、天火液在魁星城寻而未果，更缺的是温养金丹的妖丹。这片外海，正是发家致富的本钱。" },
      { fx: "flash", at: "center", color: "#7fd4c4", ms: 220 },
    ],
    onArrive(s) {
      s.location = "waixinghai";
      State.setFlag("starsea_chuhai_done");
      Engine.writeLedger("starsea_chuhai", "初入星海·三幕——顺乱星海大乱之势启程外海猎场，安顿汪凝，决意以猎妖取丹积攒结丹资粮（妖丹＝星海硬通货）。");
      Engine.addMilestone("初入星海·三幕：顺乱出海，赴外星海猎场", "starsea");
    },
    choices: [
      {
        text: "深入外海猎场——猎妖取丹，发家就从这里起。",
        hint: "胆大心细——深入才有大妖",
        effect(s) {
          State.setFlag("starsea_chuhai_deep");
          return { text: "你选择深入——越往深处，妖兽越强、妖丹越值钱。风险与收益，从来一体。", kind: "event" };
        },
        resolve: "advance",
      },
      {
        text: "先在猎场边缘试探，不急着深入。",
        hint: "稳扎稳打——先拿小妖练手",
        effect(s) {
          s.hp = s.hpMax;
          State.setFlag("starsea_chuhai_cautious");
          return { text: "你选择先在猎场边缘试探——拿几头低阶海妖练手噬金虫的用法，比贸然深入更稳妥。气血充盈，蓄势待发。", kind: "event" };
        },
        resolve: "advance",
      },
    ],
  },

  // —— 第三幕②·偶得噬金虫·霓裳草引妖之法（授噬金虫→四用法入战）——
  {
    id: "starsea_a3_shijin",
    cg: "shijin",
    skipIf: (s) => s.flags.starsea_shijin_done,
    cond: (s) => s.flags.starsea_chuhai_done && !s.flags.starsea_shijin_done,
    bgm: "journey",
    title: "外星海 · 噬金虫 · 霓裳草",
    objTitle: "奇虫 · 取丹之器",
    objHint: "外海一处沉船灵窟，你撞见一窝通体金芒、专噬金铁的异种灵虫——奇虫榜十二「噬金虫」。一物四用，正是纵横外海的看家虫器；再以霓裳草为饵引妖，取丹之法便成了。",
    text: [
      { scene: "外星海 · 沉船灵窟" },
      "猎场边缘一艘不知沉了多少年的古修仙舟里，金芒乱窜——一窝异种灵虫盘踞其中，通体如熔金、振翅如金云蔽日，啃噬着船骸上的精铁法器。",
      { say: "韩立", emo: "serious", tone: "low", text: "「群飞如金云、专噬金铁……奇虫榜上有名的『噬金虫』？这等灵虫，落到旁人手里是祸，落到我手里——便是一桩大机缘。」" },
      { fx: "burst", at: "center", elem: "jin", ms: 300 },
      { sfx: "cast" },
      "你以神识小心收伏这窝噬金虫，纳入灵机豢养。这虫一物四用：可附体淬身结甲、可放群出战噬敌、可化虫为刃破甲、亦可外化作虫之化身全力一击——四式同抽一池灵机，打一分少一分，取舍即战术。",
      { say: "韩立", emo: "calm", tone: "low", text: "「再以乱星海特产的霓裳草为饵——花气甜腻、最招妖兽。布饵引妖来食，纵虫群一举围杀，剖丹取财……这取丹的关窍，齐了。」" },
      { aside: "噬金虫＋霓裳草，一引一杀。这片外海的妖丹，从今日起，便是我韩某人的进项了。" },
      {
        guide: {
          tag: "新虫器 · 噬金虫（四用法）",
          title: "战斗·噬金虫四用法（共池取舍）",
          hint: "噬金虫入战后于法宝栏出战：附体结甲 / 出战群噬 / 变武器破甲 / 变身外化身全力一击——四式同抽一池灵机（满6·每战重置），打一分少一分、耗尽则哑火。下一战即可实战。",
          cta: "（携虫引妖·下海猎杀）",
        },
      },
    ],
    onArrive(s) {
      s.location = "waixinghai";
      State.setFlag("starsea_shijin_done");
      if (State.count("shijinchong") < 1) State.give("shijinchong", 1);   // 授噬金虫→playerFighter 四用法入战
      State.give("nichang_cao", 6);   // 霓裳草·引妖之饵
      Engine.writeLedger("starsea_shijin", "初入星海·三幕——外海沉船灵窟偶得奇虫榜『噬金虫』（一物四用·附体/出战/变武器/变身外化身），并以乱星海特产『霓裳草』为引妖之饵。猎妖取丹之法成。");
      Engine.addMilestone("外星海·偶得噬金虫（四用法）＋霓裳草引妖之法", "starsea");
    },
    choices: [
      {
        text: "布霓裳草为饵·携噬金虫下海——猎杀第一头海妖！",
        hint: "引妖猎杀——噬金虫四用法实战",
        effect(s) {
          State.setFlag("starsea_shijin_hunt");
          return { text: "你将霓裳草悬上礁岩——花气甜腻，很快便有海妖循香而来。", kind: "event" };
        },
        resolve: "advance",
      },
      {
        text: "先留几只噬金虫做种，不全收。",
        hint: "留种繁衍——日后或能更多",
        effect(s) {
          s.mood = Math.min(s.moodMax, s.mood + 3);
          State.setFlag("starsea_shijin_breed");
          Engine.writeLedger("starsea_shijin_breed", true);
          return { text: "你没有将噬金虫尽数收走——留了几只做种，日后繁衍起来，便不愁虫源了。多一分远虑，少一分近忧。", kind: "good" };
        },
        resolve: "advance",
      },
    ],
  },

  // —— 第三幕③·外星海致富·霓裳草引妖·噬金虫群猎杀（FIGHT·妖丹硬通货）——
  {
    id: "starsea_a3_waihai",
    skipIf: (s) => s.flags.starsea_zhifu_done,
    cond: (s) => s.flags.starsea_shijin_done && !s.flags.starsea_zhifu_done,
    cg: "waihai_lie",
    bgm: "combat",
    title: "外星海 · 噬金虫群猎杀",
    objTitle: "群猎 · 积丹发家",
    objHint: "霓裳草悬于礁岛，妖氛里很快有海妖循香扑来。以噬金虫四用法（附体/出战/变武器/变身外化身·共池取舍）困而后杀，连斩积丹——这是星海的硬通货，发家致富，自此开始。",
    text: [
      { scene: "外星海 · 礁岛猎场" },
      "你将一束霓裳草悬上礁岩，甜腻花气随妖氛漫开。不过片刻，幽碧海面下黑影攒动——一头中阶海妖破水而出，獠牙利爪、喷吐水箭，正是循香而来。",
      { say: "韩立", emo: "serious", tone: "low", text: "「来得正好。噬金虫——围杀。」" },
      { fx: "burst", at: "center", elem: "jin", ms: 280 },
      { sfx: "splash" },
      "掌心金芒暴起，噬金虫群如金云扑出。曲魂黑刃自侧翼并上——困而后杀，剖丹取财，星海的第一桶金，就在这一战。",
    ],
    onArrive(s) { s.location = "waixinghai"; },
    choices: [
      { text: "霓裳引妖·噬金虫群围杀——困而后杀，剖丹！", hint: "噬金虫四用法实战＋fieldCycle 妖氛相位＋waves 群猎", resolve: "starsea_waihai_fight" },
    ],
  },

  // —— 第三幕④·金魁示威极阴岛·星宫收复内星海（背景演出·worldNews·#背景强者三态）——
  {
    id: "starsea_a3_jinkui",
    cg: "jinkui",
    skipIf: (s) => s.flags.starsea_jinkui_done,
    cond: (s) => s.flags.starsea_zhifu_done && !s.flags.starsea_jinkui_done,
    bgm: "boss",
    title: "星海风云 · 金魁示威极阴岛",
    objTitle: "远观 · 大修士的手段",
    objHint: "外海猎丹多日，妖丹积囊。一日天际骤暗、海面齐齐下沉——星宫大长老金魁孤身踏临极阴岛，当众示威、一炮轰碎此岛。这是星宫着手收复内星海的先声，乱局又要变了。",
    text: [
      { scene: "外星海 · 远眺极阴岛" },
      { cam: "pan", to: { x: 0, y: -8 }, ms: 1800 },
      "这些时日，霓裳草引妖、噬金虫群杀，妖丹一颗颗剖出、装满了储物袋。正当你盘算着该往内海销丹之际——",
      { fx: "flash", at: "center", color: "#fff0c0", ms: 260 },
      "天际骤然一暗，极远处的海面竟被一股无形威压齐齐压沉！极阴岛方向，一道身影孤身踏空而立。",
      { say: "韩立", emo: "shock", tone: "low", text: "「那威压……元婴中期巅峰？是星宫大长老金魁！他孤身踏临极阴岛——这是要当众示威。」" },
      { fx: "lightning", at: "center", elem: "jin", px: 0, ms: 600 },
      { sfx: "thunder" },
      "只见金魁信手一引，一道毁天灭地的法光当空轰落——整座极阴岛连同逆星盟极阴祖师一脉的老巢，在惊天动地的轰鸣里崩成齑粉，沉入海底。乌丑等辈，早躲得不见踪影。",
      { aside: "一炮碎一岛。这便是元婴大修士的手段，也是星宫收复内星海的先声。仙凡有别，这等人物的棋局，眼下还轮不到我来落子——可这片海，怕是要为之再变一回了。" },
    ],
    onArrive(s) {
      s.location = "waixinghai";
      State.setFlag("starsea_jinkui_done");
      Engine.meetNpc("jinkui", "星宫大长老金魁，元婴中期巅峰。你于外海远远见他孤身炸碎极阴岛——这等大修士的手段，只可远观。星宫收复内星海的棋局，自此落下第一子。");
      Engine.writeLedger("starsea_jinkui", "初入星海·三幕——星宫大长老金魁孤身踏临极阴岛、当众示威、一炮轰碎此岛（乌丑远遁），星宫着手收复内星海。韩立于外海远观，识得元婴大修士之威（背景强者·在场远见）。");
      Engine.addMilestone("星海风云：远观金魁炸极阴岛·星宫收复内星海", "starsea");
      s.worldNews = s.worldNews || [];
      const t = `第${s.year}年${s.month}月`;
      s.worldNews.push({ t, kind: "world", text: "巨变：星宫大长老金魁孤身炸碎极阴岛，逆星盟极阴祖师一脉老巢覆灭——星宫着手收复内星海，乱星海格局再变。" });
      if (s.worldNews.length > 40) s.worldNews.splice(0, s.worldNews.length - 40);
      if (typeof Sfx !== "undefined") Sfx.play("success");
    },
    choices: [
      {
        text: "妖丹已积·内海局势将变——该往天星城落户叩关了。",
        hint: "顺势而为——内海变局正是时机",
        effect(s) {
          return { text: "你收好妖丹——金魁炸岛、星宫收复在即，内海即将变天，正是落户天星城的好时机。", kind: "event" };
        },
        resolve: "advance",
      },
      {
        text: "「不急。」再多猎几日，多攒些妖丹。",
        hint: "贪多务得——多一分本钱",
        effect(s) {
          s.mood = Math.min(s.moodMax, s.mood + 2);
          State.setFlag("starsea_jinkui_greedy");
          return { text: "你没有急着走——再多猎几日，多攒几颗妖丹。结丹之路，本钱越多越稳。", kind: "event" };
        },
        resolve: "advance",
      },
    ],
  },

  /* ============================================================
   *  初入星海篇 · 第四幕 —— 天星城叩关 · 结丹（增量6·章末高潮）
   *  考据：churu-xinghai-design.md §二第四幕 + §六结丹机制（觅长生手感）
   *        ＋ 动漫《凡人星海飞驰》序章末（ep76·天星城结丹成功）
   *  落户天星城 → 集齐资粮（雪灵水/天火液/大衍诀三层）→ 首次结丹失败演出
   *        → 觅长生式可玩渡劫·结丹关心魔劫（bigRealmRites.core）→ 金丹大成（realmIndex 16→17）→ 章末钩
   * ============================================================ */

  // —— 第四幕①·落户内海第一都会·天星城（星宫治下·人修文明中心）——
  {
    id: "starsea_a4_tianxing",
    cg: "tianxing",
    skipIf: (s) => s.flags.starsea_tianxing_done,
    cond: (s) => s.flags.starsea_jinkui_done && !s.flags.starsea_tianxing_done,
    bgm: "town",
    title: "天星城 · 落户",
    objTitle: "内海都会 · 叩关之地",
    objHint: "携外海挣下的妖丹返回内海，落户星宫治下的第一都会——天星城。坊市林立、传送阵网纵横，正是闭关苦修、择吉叩结丹之关的好去处。",
    text: [
      { scene: "天星城 · 天都坊市" },
      { bgm: "town" },
      "循着内海航路，你携满囊妖丹与降尘丹来到天星城——内星海中枢的修仙大都会，星宫治下，巨塔接云、坊市连绵、传送阵网四通八达，人修云集，是这片妖海里难得的太平中枢。",
      { say: "韩立", emo: "calm", tone: "low", text: "「内海第一都会，气象果然不同。在此落户置一处洞府，安顿好紫灵，再闭关备齐资粮——结丹之关，便在这里叩了。」" },
      { fx: "flash", at: "center", color: "#caa6ff", ms: 200 },
      { aside: "天都街上人潮如织，曾有两道惊才绝艳的身影擦肩而过，气度迥异于常人……可惜只是惊鸿一瞥，转瞬便没入了人海。（你心头掠过一丝异样，却也未及细想。）" },
    ],
    onArrive(s) {
      s.location = "tianxing_city";
      State.setFlag("starsea_tianxing_done");
      State.setFlag("tianxing_open");   // 解锁天星城（home·可 cultivate/breakthrough/alchemy）
      Engine.writeLedger("starsea_tianxing", "初入星海·四幕——韩立携外海妖丹返内海，落户星宫治下第一都会天星城，置洞府、安顿汪凝，备齐结丹资粮叩关。天都街双骄惊鸿一瞥（cameo·仅留印象，羁绊正戏在后续篇章）。");
      Engine.addMilestone("初入星海·四幕：落户天星城（内海第一都会）", "starsea");
    },
    choices: [
      {
        text: "置洞府·安顿紫灵——着手集齐结丹资粮。",
        hint: "低调落户——不张扬",
        effect(s) {
          State.setFlag("starsea_tianxing_lowkey");
          return { text: "你在天星城偏僻处置了一间洞府——不张扬、不惹眼，正合藏拙之意。", kind: "event" };
        },
        resolve: "advance",
      },
      {
        text: "在天都坊市公开露面，打听结丹消息。",
        hint: "公开露面——消息灵通但引人注目",
        effect(s) {
          s.mood = Math.min(s.moodMax, s.mood + 3);
          State.setFlag("starsea_tianxing_public");
          Engine.writeLedger("starsea_tianxing_public", true);
          return { text: "你在天都坊市公开露面，广打听结丹的消息——多了几分人望与线索，却也多了几分被人注目的风险。", kind: "event" };
        },
        resolve: "advance",
      },
    ],
  },

  // —— 第四幕②·集齐结丹资粮（雪灵水/天火液补齐＋大衍诀三层蓄力·神识淬炼大成）——
  {
    id: "starsea_a4_ziliang",
    cg: "ziliang",
    skipIf: (s) => s.flags.starsea_ziliang_done,
    cond: (s) => s.flags.starsea_tianxing_done && !s.flags.starsea_ziliang_done,
    bgm: "journey",
    title: "天星城 · 集齐资粮",
    objTitle: "觅长生 · 攒资粮",
    objHint: "结丹是「觅长生」之关——备得越足，活路越宽。妖丹已积、降尘丹在手，再以天星城的财力补齐雪灵水、天火液，并将大衍诀催至三层、神识淬炼大成——结丹的本钱，一样样凑齐了。",
    text: [
      { scene: "天星城 · 洞府静室" },
      "结丹之关，最是凶险，可备得越足，活路便越宽——这是「觅长生」的道理。你在天星城的丹铺药行间奔走，以外海妖丹为本钱，将魁星城求而未得的两味灵药一一补齐。",
      { say: "韩立", emo: "serious", tone: "low", text: "「雪灵水一寒、天火液一热，一寒一热相济，方能把一身灵力反复压炼成丹。再加降尘丹涤去尘浊、妖丹温养——资粮，算是齐了。」" },
      { fx: "material", at: "center", elem: "shui", ms: 500 },
      { sfx: "cast" },
      "更要紧的是神识。二十载闭关加这一程外海历练，你将叶师叔遗下的《大衍诀》参研至三层——神识如臂使指、淬炼大成，方堪驾驭结丹之劫的反噬。",
      { fx: "material", at: "center", elem: "mu", ms: 500 },
      { say: "韩立", emo: "calm", tone: "low", text: "「大衍诀三层既成，神识已足。三转重元功一转的精纯真元、大衍诀三层的神识、外海妖丹、降尘丹、雪灵水、天火液——结丹六资，齐备。」" },
      { aside: "万事俱备。可越是齐备，心里那根弦反倒绷得越紧——结丹的心魔，是平生执念所化，最难缠。这一关，终究要亲身去闯。" },
    ],
    onArrive(s) {
      s.location = "tianxing_city";
      State.setFlag("starsea_ziliang_done");
      State.setFlag("dayan_learned");   // 大衍诀入修·神识伴身位（slot 由 balance.js 自读）
      State.setFlag("dayan_layer3");    // 大衍诀三层·神识淬炼大成（结丹关 require 之一）
      if (State.count("xueling_shui") < 1) State.give("xueling_shui", 1);   // 雪灵水（凝丹灵材·结丹关 require/consume）
      if (State.count("tianhuo_ye") < 1) State.give("tianhuo_ye", 1);       // 天火液（淬丹真火·结丹关 require/consume）
      if (State.count("jiangchen_dan") < 1) State.give("jiangchen_dan", 1); // 降尘丹兜底（镇妖大典若漏得）
      Engine.writeLedger("starsea_ziliang", "初入星海·四幕——集齐结丹资粮：大衍诀催至三层（dayan_layer3·神识淬炼大成）、补齐雪灵水/天火液，合三转一转之精纯真元、外海妖丹、镇妖大典所得降尘丹，结丹六资齐备（喂 bigRealmRites.core）。");
      Engine.addMilestone("结丹资粮齐备：大衍诀三层＋雪灵水/天火液（觅长生·攒资源）", "starsea");
    },
    choices: [
      {
        text: "资粮齐备——先试着叩一叩这结丹之关。",
        hint: "急叩——迫不及待",
        effect(s) {
          State.setFlag("starsea_ziliang_eager");
          return { text: "你迫不及待地引灵入丹田——资粮既齐，早一日结丹早一日安心。", kind: "event" };
        },
        resolve: "advance",
      },
      {
        text: "「不急。」先定心调息，将道心推至最佳。",
        hint: "先定心——磨刀不误砍柴工",
        effect(s) {
          s.mood = Math.min(s.moodMax, s.mood + 5);
          s.hp = s.hpMax;
          State.setFlag("starsea_ziliang_calm");
          return { text: "你没有急着叩关——先定心调息数日，将道心推至最佳状态。磨刀不误砍柴工。", kind: "good" };
        },
        resolve: "advance",
      },
    ],
  },

  // —— 第四幕③·首次结丹·铩羽（#4 脚本必败演出·对照曲魂结煞丹成·屡挫屡战）——
  {
    id: "starsea_a4_shibai",
    skipIf: (s) => s.flags.starsea_jiedan_fail_done,
    cond: (s) => s.flags.starsea_ziliang_done && !s.flags.starsea_jiedan_fail_done,
    cg: "luanxinghai",
    bgm: "sorrow",
    heroSkin: "hanli_jindan_kouguan",   // v213：首番结丹叩关·月白叩关装（场景强制）
    title: "天星城 · 首番结丹 · 铩羽",
    objTitle: "屡挫 · 平生执念",
    objHint: "资粮齐备，你迫不及待地引灵入丹田凝丹——可结丹的心魔是平生执念所化，最是难缠。首番叩关，丹未凝成、反遭心魔反噬，铩羽而归。对照曲魂结煞丹的水到渠成，更显这一关之难。",
    text: [
      { scene: "天星城 · 洞府静室" },
      { cam: "zoom", scale: 1.05, ms: 320 },
      "静室之内，你盘膝凝神，引一身精纯真元向丹田汇聚，要将那盈满百窍的灵力反复压炼、凝散成丹。雪灵水寒、天火液炽，一寒一热在丹田里相搏——",
      { fx: "lightning", at: "center", elem: "huo", ms: 520 },
      { sfx: "thunder" },
      "丹将凝时，一缕心魔自识海猛然窜起！青牛镇的土屋、墨大夫临终的冷笑、七玄门的旧人、落海二十载的孤苦……平生执念尽数翻涌而上，搅得真元逆乱、凝丹之势骤崩。",
      { say: "韩立", emo: "pain", tone: "low", text: "「唔——！心魔……结丹的心魔，竟这般难缠！」" },
      { fx: "shake", at: "center", ms: 360 },
      "一口逆血喷出，将凝的丹胚溃散回灵力。首番叩关，败了。",
      { aside: "曲魂当年结煞丹水到渠成，我却在这一关前栽了跟头。可这本就是『鲜有不败』的结丹关——执念既是劫，便要亲手勘破。调息、定心，再来。" },
      {
        guide: {
          tag: "结丹关 · 屡挫屡战",
          title: "下一步：择吉·再闯结丹关心魔劫",
          hint: "首番失败是结丹必经的挫折。先调息平复心魔（道心澄明≥0.7、心魔已伏≤25），待灵力圆满，再于天星城洞府择吉叩关——这一回，是可玩的渡劫。",
          cta: "（定心·择时再闯）",
        },
      },
    ],
    onArrive(s) {
      s.location = "tianxing_city";
      State.setFlag("starsea_jiedan_fail_done");
      s.demon = clamp((s.demon || 0) + 6, 0, 100);   // 心魔翻涌（轻推·教玩家结丹前须定心；非跌境）
      s.mood = clamp((s.mood || 0) - 8, 0, s.moodMax || 100);
      Engine.writeLedger("starsea_jiedan_fail", "初入星海·四幕——首番结丹铩羽：资粮虽齐，结丹心魔为平生执念所化，凝丹之际心魔反噬、丹胚溃散，首番叩关而败（脚本必经之挫·对照曲魂结煞丹水到渠成）。屡挫屡战——定心再闯。");
      Engine.addMilestone("首番结丹·铩羽（平生执念·心魔反噬）", "starsea");
    },
    choices: [
      {
        text: "调息定心——择吉时，再闯结丹关！",
        hint: "屡挫屡战——执念越是劫越要勘破",
        effect(s) {
          s.mood = Math.max(0, s.mood - 2);
          return { text: "你咽下逆血，闭目调息——这一关，迟早要闯过去。", kind: "event" };
        },
        resolve: "advance",
      },
      {
        text: "「先出去走走，散散心。」暂缓一口气。",
        hint: "暂缓——心魔不可硬拼",
        effect(s) {
          s.mood = Math.min(s.moodMax, s.mood + 3);
          State.setFlag("starsea_shibai_walk");
          return { text: "你没有立刻再闯——走出洞府，在天星城坊市走了一圈，散了散心。心魔不可硬拼，暂缓一口气，反而更清朗。", kind: "event" };
        },
        resolve: "advance",
      },
    ],
  },

  // —— 第四幕④·择吉叩关引导（觅长生式·准备-择时·框可玩渡劫·等玩家真破 16→17）——
  {
    id: "starsea_a4_jieguan",
    cg: "jieguan",
    skipIf: (s) => s.flags.starsea_jieguan_done,
    cond: (s) => s.flags.starsea_jiedan_fail_done && !s.flags.starsea_jieguan_done,
    bgm: "tense",
    heroSkin: "hanli_jindan_kouguan",   // v213：择吉叩关·月白叩关装（场景强制）
    title: "天星城 · 择吉叩关",
    objTitle: "觅长生 · 择时渡劫",
    objHint: "资粮齐备、心魔已伏，只待灵力圆满、择一吉时，亲身去闯结丹关的心魔劫。在天星城洞府「行动→突破」叩关——这一回，胜则金丹大成。",
    text: [
      { scene: "天星城 · 洞府静室" },
      "首番之败让你看清了这一关的分量。你闭门调息、勘破执念，将那翻涌的心魔一寸寸压伏，又把一身灵力推向圆满——只待择一吉时，再叩结丹之门。",
      { say: "韩立", emo: "serious", tone: "low", text: "「觅长生之关，备得越足、活路越宽。资粮齐、神识足、心魔伏——剩下的，是亲手去闯那一场心魔劫。这一回，不容有失。」" },
      { aside: "结丹的心魔劫，是生平执念所化，最是凶险，败则有跌境之险。可凡人韩立的路，从来都是把万全准备做到极致，再以命相搏。" },
      {
        guide: {
          tag: "结丹关 · 觅长生式渡劫（可玩）",
          title: "前往天星城洞府叩关：行动 → 突破",
          hint: "灵力圆满后，于天星城（行动→突破）叩结丹之关——校验六资（三转一转/大衍诀三层/降尘丹/雪灵水/天火液/妖丹×30＋道心澄明·心魔已伏），齐备即闯心魔劫（trialHp 360/13 回合）。胜则金丹大成 · 结丹初期。",
          cta: "（择吉·叩结丹之关）",
        },
      },
    ],
    onArrive(s) {
      s.location = "tianxing_city";
      State.setFlag("starsea_jieguan_done");
      State.setFlag("skin_kouguan");   // v213：点亮「月白叩关」换装窗口选项
      Engine.writeLedger("starsea_jieguan", "初入星海·四幕——勘破首败之心魔、调息至灵力圆满，择吉叩关：于天星城洞府以 bigRealmRites.core 闯结丹关心魔劫（觅长生式·可玩渡劫）。等玩家亲破筑基大圆满→结丹初期（realmIndex 16→17）。");
    },
    choices: [
      {
        text: "（前往天星城洞府·择吉叩结丹之关——行动→突破）",
        hint: "可玩渡劫——胜则金丹大成",
        effect(s) {
          return { text: "你回到洞府静室，盘膝凝神——这一回，不容有失。", kind: "event" };
        },
        resolve: "advance",
      },
      {
        text: "「再等一等。」将心境调至极致再叩。",
        hint: "精益求精——多等一刻更稳",
        effect(s) {
          s.mood = Math.min(s.moodMax, s.mood + 2);
          State.setFlag("starsea_jieguan_wait");
          return { text: "你没有立刻叩关——多等一刻，将心境调至极致。结丹之关，宁可多一分准备，不可少一分侥幸。", kind: "event" };
        },
        resolve: "advance",
      },
    ],
  },

  // —— 第四幕⑤·金丹大成（realmIndex 16→17·章末高潮·扬眉吐气·章末钩·故人钟）——
  {
    id: "starsea_a4_jindan",
    skipIf: (s) => s.flags.arc5_complete,
    cond: (s) => s.realmIndex >= 17 && s.flags.starsea_jieguan_done && !s.flags.arc5_complete,
    cg: "jindan",
    bgm: "triumph",
    title: "天星城 · 金丹大成",
    objTitle: "正向质变 · 扬眉吐气",
    objHint: "心魔劫闯过，丹胚终凝！一身灵力尽数压炼成一枚温润金丹，金丹大成、结丹初期。自此你第一次能正面打得过同阶——凡人韩立，结丹了。",
    text: [
      { scene: "天星城 · 洞府静室" },
      { cam: "zoom", scale: 1.08, ms: 360 },
      "这一回，当平生执念所化的心魔再度扑来，你已不再退避——青牛镇、墨大夫、七玄门、孤岛二十载……你一一受之、一一勘破，任它翻涌，自有一颗道心如磐。",
      { fx: "lightning", at: "center", elem: "jin", ms: 560 },
      { sfx: "thunder" },
      "心魔伏、真元聚，丹田之内，盈满百窍的灵力被你反复压炼、层层凝散——终于，「噗」的一声轻响，一枚温润生光的金丹，在丹田里凝成了。",
      { fx: "burst", at: "center", elem: "jin", ms: 420 },
      { sfx: "success" },
      { say: "韩立", emo: "joy", tone: "low", text: "「成了……金丹大成！我韩立，结丹了！」" },
      "二十载孤岛苦修、镇妖大典的九死一生、外海猎妖的发家积淀、首番结丹的铩羽——尽数化作此刻丹田里这一点温润的金芒。这是你修仙以来，第一次能正面打得过同阶的扬眉吐气之时。",
      { aside: "曲魂静立一旁。这一程，它陪你从天南到星海、从筑基到结丹。可不知为何，就在金丹大成的这一刻，远在嘉元城的某座旧府里，似有一缕故人的气息悄然黯淡了下去……（故人钟·低鸣）" },
      {
        guide: {
          tag: "初入星海篇 · 终　——　金丹大成（realmTier 1→2）",
          title: "章末钩 · 下一篇：星海飞驰篇",
          hint: "金丹既成，星海万里任去来。远处的钩子已隐隐浮现：虚天殿与虚天鼎、银月、青竹蜂云剑、风希夺去的风雷翅（炼制在后）、将夺曲魂身躯的玄骨上人、乾蓝冰焰……——这一切，都留待《星海飞驰篇》。",
          cta: "（金丹大成·初入星海篇 终）",
        },
      },
    ],
    onArrive(s) {
      s.location = "tianxing_city";
      State.setFlag("arc5_complete");
      // 篇章契约：通关解锁下一篇（星海飞驰篇·钩子）
      if (typeof Chapters !== "undefined") {
        const next = Chapters.active().nextChapter;
        if (next) Chapters.unlock(next);
      }
      Engine.writeLedger("starsea_jindan", "初入星海·四幕·章末高潮——韩立勘破平生执念之心魔、闯过结丹关心魔劫，金丹大成（筑基大圆满→结丹初期·realmTier 1→2质变·本作第一次正面打得过同阶的扬眉吐气节点）。故人钟低鸣：墨彩环病逝于远渡期间（#13·软伏笔墨彩环转世＝紫灵·不写死）。章末埋钩：虚天殿/虚天鼎/银月/青竹蜂云剑/风雷翅炼制/玄骨上人夺曲魂身躯/乾蓝冰焰（皆留星海飞驰篇）。初入星海篇·终。");
      Engine.addMilestone("初入星海·章末：金丹大成（结丹初期·realmTier 1→2）", "breakthrough");
      s.worldNews = s.worldNews || [];
      const t = `第${s.year}年${s.month}月`;
      s.worldNews.push({ t, kind: "world", text: "天星城：散修韩立于洞府结丹大成，跻身结丹修士之列。" });
      s.worldNews.push({ t, kind: "sorrow", text: "故人钟·低鸣：嘉元城墨府传来音讯——墨彩环于韩立远渡星海期间病逝。仙凡有别，凡人之命，终是扳不动的。" });
      if (s.worldNews.length > 40) s.worldNews.splice(0, s.worldNews.length - 40);
      if (typeof Sfx !== "undefined") Sfx.play("success");
      Engine.toast("初入星海篇通关！金丹大成 · 结丹初期");
    },
    choices: [
      {
        text: "（金丹在腹·星海万里——且待星海飞驰）",
        hint: "扬眉吐气——凡人韩立结丹了",
        effect(s) {
          s.mood = Math.min(s.moodMax, s.mood + 10);
          return { text: "你抚着丹田那枚温润金丹，二十载孤岛苦修、镇妖大典的九死一生、外海猎妖的发家积淀——尽数化作此刻的扬眉吐气。", kind: "good" };
        },
        resolve: "advance",
      },
      {
        text: "「结丹……不过是又一个起点。",
        hint: "沉静以对——前路更远",
        effect(s) {
          s.mood = Math.max(0, s.mood - 1);
          Engine.writeLedger("starsea_jindan_calm", true);
          return { text: "你没有太过激动——结丹不过是修仙路上的又一个起点。前路更远、更险，心境反倒比方才更沉了几分。", kind: "event" };
        },
        resolve: "advance",
      },
    ],
  },
];

window.STORY = STORY;
