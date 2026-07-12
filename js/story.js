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
        { bgm: "daily" },
        { shot: "establish" },
        "你叫韩立，青牛镇韩家老二。家中清贫，几亩薄田勉强糊口，年成不好时连盐都吃不起。",
        { wait: 250 },
        "这年，在七玄门做事的三叔回乡省亲。他见你机灵懂事，私下对你爹娘提议——",
        { shot: "pushIn" },
        { sfx: "page" },
        { say: "三叔", tone: "压低了声音，带着几分得意", text: "七玄门正招收记名弟子，管吃管住，每月还有例钱。二郎这孩子机灵，何不让他去碰碰运气？" },
        { shot: "pullOut" },
        "爹娘犹豫，你却已动了心——若能进了那高门大派，家里的日子或许就能好过些。",
      ];
      return t;
    },
    onArrive(s) { State.setFlag("at_village"); },
    choices: [
      // polish B3：第一选项也要"是一种做"——本分辞行=韩立式的稳（心性入账）
      { text: "拜别爹娘，随三叔去七玄门", hint: "本本分分辞行——稳，也是一种底色",
        effect(s) {
          Engine.recordTemperament("village_plain", "stoic", "拜别爹娘·不多拿一物不多问一句——本分上路，稳字当头");
          return { text: "你给爹娘磕了头，什么也没多带、什么也没多问，跟着三叔上了路。娘在村口望了很久。", kind: "event" };
        },
        next: true },
      { text: "临行前，偷偷揣一包干粮盐巴", hint: "穷家孩子，路上不能空着手",
        effect(s) {
          State.give("lingshi", 1);
          State.setFlag("village_provisions");   // flag 供剧情台词分支读；writeLedger 管远雷兑现
          Engine.writeLedger("village_provisions", "离家前偷偷揣了干粮盐巴——穷家孩子的谨慎");
          return { text: "你趁爹娘不注意，往怀里塞了几块干粮和一小包盐巴。三叔见了，笑而不语。", kind: "good" };
        },
        next: true },
      { text: "向三叔细问七玄门的底细", hint: "知己知彼，方能踏稳第一步",
        effect(s) {
          s.skills = s.skills || {}; s.skills.scouting = (s.skills.scouting || 0) + 1;
          State.setFlag("village_inquiry");   // flag 供剧情台词分支读；writeLedger 管远雷兑现
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
      { text: "与张铁结伴，同赴选拔", hint: "有伴同行，心里踏实",
        effect(s) {
          s.mood = Math.min(s.moodMax || 100, (s.mood || 0) + 3);
          return { text: "山路虽长，有张铁一路说说笑笑，倒也不觉得累。到山门时，你们已经像认识了半辈子。（心境+3）", kind: "good" };
        },
        next: true },
      { text: "路上暗中观察同行少年的身手深浅", hint: "知己知彼",
        effect(s) {
          s.skills = s.skills || {}; s.skills.scouting = (s.skills.scouting || 0) + 1;
          Engine.writeLedger("journey_observe", "赴考路上暗中观察同行少年——探知本能");
          return { text: "一路上你不动声色地打量同行的少年们。有人筋骨强健，有人步履轻盈，也有人跟你一样不起眼。你把每个人的长处短处都默默记在心里。", kind: "good" };
        },
        next: true },
      { text: "教张铁几招防身的小手法", hint: "兄弟互助",
        effect(s) {
          State.setFlag("journey_help_zhangtie");   // flag 供剧情台词分支读；writeLedger 管远雷兑现（两者各司其职）
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
        { amb: "market" },   // 选拔场人声嘈杂（jank#6：序章每拍有声相——市声垫底，远钟点缀）
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
        { sfx: "fail" },
        { shot: "pullOut" },
        "眼看就要被刷下，你不肯认命，硬着头皮求得一个补考的机会。",
        { wait: 350 },
        { sfx: "success" },
        "半年后再试，凭着一股韧劲，你和张铁终于挤进了记名弟子的名册。",
      );
      return t;
    },
    choices: [
      { text: "入门记名，正式踏入七玄门", hint: "尘埃落定，心头一块石头落地",
        effect(s) {
          s.mood = Math.min(s.moodMax || 100, (s.mood || 0) + 2);
          s.demon = Math.max(0, (s.demon || 0) - 2);
          return { text: "名册上添了「韩立」两个字。你盯着那两个字看了半晌——从今往后，顿顿有白面馍了。（心境+2·心魔-2）", kind: "good" };
        },
        next: true },
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
      { text: "叩首谢恩，潜心修炼", hint: "藏起心思，先把功课做稳",
        effect(s) {
          Engine.recordTemperament("intro_plain", "stoic", "拜师墨大夫·恭敬叩首不多看不多问——把心思藏进本分里");
          return { text: "你端端正正磕了三个头，接过功法退到一旁。墨大夫多看了你一眼——一个不多话、不多看、不多问的药童，正合他意。", kind: "event" };
        },
        next: true },
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
      { text: "与好友同行历练", hint: "同门之谊，细水长流",
        effect(s) {
          s.mood = Math.min(s.moodMax || 100, (s.mood || 0) + 4);
          return { text: "不结拜、不请教，就这么处着——一起吃饭、一起挨骂、一起在演武厅外看人过招。日子平常，暖意是真的。（心境+4）", kind: "good" };
        },
        next: true },
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
      // polish A7①：盘账拍——把嗑药线的账当场算给玩家（这条才是本章的主路，不能藏在弹窗里）
      t.push({ aside: "你心里飞快盘着账：后山一趟采回几株灵草，入瓶三月便是一枚灵药丹——一丹入腹，抵得上大半年枯坐苦修。采草、入瓶、嗑药……这条路，比闭死关快得多。" });
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
      { text: "暗中培育灵药，瞒过墨大夫", hint: "采草→入瓶→嗑药：以此瓶为路，快过闭死关", next: true },
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
        t.push({ aside: "结拜时说过有难同当……可你连他出了什么事都不知道。" });
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
      // polish D3 收口：演武厅喂招的那些下午——并肩过的人才死得重
      if (Engine.settleLedger("zhangtie_spar", "演武厅里你一下一下陪他喂出来的象甲功，终究没能护住他自己。那句「等我练成了，换我护着你」——他再也兑不了了。你喂他招时握过的那双手，如今是铁灰色的")) {
        s.demon = Math.min(100, s.demon + 3);
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
    objTitle: "决战备战",
    objHint: "夺舍真相已明——以毒为先、以武为先、或速战速决，三选一互斥。留意眼前剧情抉择。",
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
      { text: "以毒为先——催熟剧毒、多备暗器（耗时备战）", hint: "互斥·选了即赴决战——毒与暗器是你以弱胜强的本钱（决战毒杀更狠）",
        effect(s) {
          State.give("duyao_cao", 2);
          State.give("anqi", 2);
          State.setFlag("showdown_prep_poison");   // flag 供决战台词分支读；writeLedger 管远雷兑现
          Engine.writeLedger("showdown_prep_poison", "决战前以毒为先——催熟剧毒、多备暗器");
          return { text: "你将小绿瓶催熟的毒草尽数炼成剧毒，又淬了数枚暗器。这些东西，就是你以弱胜强的本钱。", kind: "good" };
        },
        next: true },
      { text: "以武为先——苦练眨眼剑法、磨砺身法（耗时备战）", hint: "互斥·选了即赴决战——近身搏杀唯快不破（决战剑招更利、身法更稳）",
        effect(s) {
          State.setFlag("showdown_martial_focus");
          Engine.writeLedger("showdown_prep_martial", "决战前苦练眨眼剑法——以武为先");
          return { text: "你日夜苦练眨眼剑法，将每一招的出剑角度、身法变化都打磨到极致。墨大夫若要夺舍，近身之际就是你唯一的机会——那一剑，必须快到他反应不过来。", kind: "good" };
        },
        next: true },
      { text: "稳住心境，速战速决——不拖延，今夜就动手", hint: "互斥·不另备物，但抢得先机（心境+，敌少一分防备）",
        effect(s) {
          s.mood = Math.min(s.moodMax, s.mood + 8);
          s.demon = Math.max(0, s.demon - 6);
          State.setFlag("showdown_prep_swift");
          Engine.writeLedger("showdown_prep_swift", "决战前不拖延、稳心境速动手——抢先机，趁余子童尚未起疑便下杀手");
          return { text: "你没有再多备什么。备得越久，露馅的风险越大——余子童的疑心，会随每一个反常的夜晚加重。你压下心绪、定住道心，决意趁他尚未起疑，今夜就动手。", kind: "good" };
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
        // canon-audit Q2（2026-07-10 勘正·原著65章「韩神医」+动漫5集双源）：非"扮成墨大夫"——
        // 伪造其回乡书信、以弟子身份名正言顺接任药师（门中渐唤"小韩大夫"），并为墨老立碑全了师徒名分
        "你做了一个大胆的决定——伪造一封墨大夫「回乡探亲、暂不归门」的书信送呈门中，自己则以其亲传弟子的身份，名正言顺地接任了药庐。你还在后山替这位「远行」的师父立了一方衣冠碑——名分做足，无人起疑。门中人渐渐改口，唤你一声「小韩大夫」。",
        "你收殓了遗物：储物袋、灵石、灵药、毒方、《长春功》的后续口诀，还有那具沉默的尸傀——日后随你闯荡的「曲魂」。",
      ];
      // 钩子：结拜兄弟 → 对曲魂的台词不同
      if (s.flags.sworn_brothers) {
        t.push(
          { bgm: "sorrow" },
          { shot: "pushIn" },
          { say: "韩立", tone: "对着案头孤灯与那具沉默的身影，低声", text: "兄弟，结拜时说过有难同当。如今你走了，我替你走完这条路——从今往后，你我兄弟，再不分离。" },
        );
      } else {
        t.push(
          { bgm: "sorrow" },
          { shot: "pushIn" },
          { say: "韩立", tone: "对着案头孤灯与那具沉默的身影，低声", text: "委屈你了，张铁。从今往后，你我兄弟，再不分离。" },
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
      State.setFlag("is_modafu");   // flag 名保留（存档兼容）——语义=接任药庐（"小韩大夫"），非扮成墨大夫本人（canon Q2）
      Engine.assignTask("wolf_raid", 12);
      // polish A3：门派大比日历锚——蛰伏期正中的锚点（xianhui_due 同构·天命栏倒计时）
      s.flags.dabi_due = State.absMonth() + 14;
      Engine.toast("你以弟子身份接任药庐（小韩大夫），得曲魂相随。继续修炼以备将来");
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
      { text: "以「小韩大夫」的身份坐堂行医，暗中打探门中虚实", hint: "医者的好处，就是谁都不防你",
        effect(s) {
          s.skills = s.skills || {}; s.skills.scouting = (s.skills.scouting || 0) + 1;
          State.give("lingshi", 3);
          State.setFlag("identity_practice_medicine");   // flag 供野狼帮/太南台词分支读；writeLedger 管远雷兑现
          Engine.writeLedger("identity_practice_medicine", "以小韩大夫身份坐堂行医——打探门中虚实");
          return { text: "你这位新晋的「小韩大夫」坐堂问诊，门中弟子来找你看病，你一边把脉一边闲聊——谁跟谁有隙、野狼帮最近有何动静、三位师叔的脾气秉性……不出数月，门中的虚实你已摸得七七八八。", kind: "good" };
        },
        next: true },
    ],
  },

  /* ---- C0.5 门派大比（polish A3：蛰伏期正中锚 + 厉飞雨命途首装·fate-design §五）----
   * 双审同锚：蛰伏期（练气4→6·实际耗时最长段）内容真空 × 厉飞雨命途零实装——一块补丁补两个洞。
   * world.js bio 的既有设定"后凭服食精元丹在门派大比中崭露头角"在此落地：
   * 精元丹=玩家的药理+灵草炼给他（代价吃丹道资源池），账本指名兑现窗=筑基后回七玄门（黄枫谷篇回访）。 */
  {
    id: "qixuan_dabi",
    skipIf: (s) => s.flags.dabi_done,
    cond: (s) => s.flags.is_modafu && s.flags.dabi_due && State.absMonth() >= s.flags.dabi_due && !s.flags.dabi_done,
    bgm: "fair",
    title: "七玄门 · 门派大比",
    objTitle: "大比之期",
    objHint: "三年一度的门派大比开锣——蛰伏的日子里，这是全门上下最热闹的几天。厉飞雨遣人捎话：他要下场。",
    text(s) {
      const t = [
        { scene: "七玄门 · 演武大场" },
        { amb: "market" },
        { shot: "establish" },
        "演武大场四周旌旗猎猎，各堂弟子里三层外三层。三年一度的门派大比，是凡俗弟子出头的独木桥。",
        { shot: "focusLeft" },
        { say: "厉飞雨", emo: "laugh", tone: "隔着人群朝你挥手", text: "「韩立！来得正好——我抽的签不错，一路打上去就是钱堂主那关。看我这次的！」" },
      ];
      if (s.flags.sworn_brothers) {
        t.push({ aside: "结拜那晚他说要「看遍大千世界」。凡俗武人的天花板就在眼前这座擂台上——他离得那么近，又那么远。" });
      } else {
        t.push({ aside: "他还是那样，笑起来满场都听得见。凡俗武人的天花板就在眼前这座擂台上——他离得那么近，又那么远。" });
      }
      t.push({ wait: 400 });
      t.push({ aside: "你如今是「小韩大夫」——药理在手、小绿瓶在袖。赛前替他炼一炉精元丹，是你能帮他的、唯一不越界的忙。" });
      return t;
    },
    onArrive(s) { State.setFlag("dabi_done"); },
    choices: [
      {
        text: "为他炼一炉精元丹（灵草×2·耗一月）",
        hint: "药理越深丹效越足——命途之扶（道岔）",
        effect(s) {
          if (State.count("lingcao") < 2) {
            return { text: "你翻遍药柜——灵草不够两株。只得空手去看他比武。（缺灵草×2：这一炉，终究没炼成）", kind: "bad" };
          }
          State.take("lingcao", 2);
          Engine.passTime(1);
          const deep = (s.skills && s.skills.alchemy >= 12);
          State.setFlag("lifeiyu_dabi_helped");
          Engine.writeLedger("lifeiyu_dabi_dan", "门派大比前为厉飞雨炼下一炉精元丹——他的武道，你搭了一把手。此恩此丹，日后筑基归来、重回七玄门时再算（远雷·黄枫谷篇回访兑现）。" + (deep ? "（药理精深·足色足量）" : "（火候尚浅·聊胜于无）"));
          Engine.recordTemperament("lifeiyu_dabi", "sentiment", "门派大比·为厉飞雨炼精元丹——仙凡殊途，扶得一把是一把");
          return { text: `你闭门一月，以墨大夫留下的方子炼出一炉精元丹${deep ? "——药理精深，丹成足色，搁在掌心温温发烫" : "——火候尚浅，成色平平，但心意是足的"}。大比那日，厉飞雨服丹上场、气血如虹，一路打进前三，看台上炸了锅。他冲你坐的方向抱拳一礼，笑得见牙不见眼。`, kind: "good" };
        },
        next: true,
      },
      {
        text: "只当看客 · 为他叫好",
        hint: "不出手——命途归他自己",
        effect(s) {
          s.mood = Math.min(s.moodMax, (s.mood || 0) + 3);
          Engine.writeLedger("lifeiyu_dabi_watch", "门派大比只当看客——厉飞雨凭自己的拳脚打进前十。他的路他自己走，你在台下用力鼓了掌。这份各自成全，日后筑基归来重逢时再算（远雷·黄枫谷篇回访兑现）。");
          return { text: "你挤在人群里看完了他每一场。没有丹药，他照样凭一口气打进前十——落败那场输给的是钱堂主的亲传，输得漂亮。他下台时满脸是汗，看见你，咧嘴一笑：「看见没？下次就是前三！」（心境+3）", kind: "event" };
        },
        next: true,
      },
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
        t.push({ say: "小算盘", tone: "压低声音", text: "韩大夫，您之前问的那些，我都替您留意着——野狼帮新招了批亡命徒，贾天龙还跟青苓那边搭上了线。您是不知道，门里上上下下都慌了神。" });
        t.push({ aside: "你早有耳闻。行医数月，门中的虚实你已摸透——此刻小算盘带来的，不过是拼图的最后几块。" });
      } else {
        t.push({ say: "小算盘", tone: "压低声音", text: "韩大夫，您是没瞧见……野狼帮那帮人，一次比一次凶。门里三位师叔都坐不住了。" });
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
          State.setFlag("gang_use_xiaosuanpan");   // flag 供野狼帮/太南台词分支读；writeLedger 管远雷兑现
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
        // canon-audit Q3（2026-07-10 勘正·Bangumi+电视猫+头条三源·动漫6集）：双方约**死契血斗**；
        // 金光上人以符宝**秒杀顾师叔一人**（非三师叔联手被击倒）
        "果然，贾天龙亮出了底牌——双方约下「死契血斗」，生死各安天命。而野狼帮的阵中，走出一名修仙者：青苓来的矮胖和尚，「金光上人」。",
        { shot: "shock" },
        { fx: "flash", color: "#ffd27a", alpha: 0.35, ms: 320 },
        { sfx: "castJin" },
        { say: "金光上人", tone: "金光绕身，睥睨众人", text: "七玄门？也配？今日，便让尔等见识见识何为仙法。" },
        "出战的是门中武艺最高的顾师叔。刀光才起——",
        { beat: "——" },
        { sfx: "hit" },
        { cam: "shake", px: 6 },
        "一道剑符破空，顾师叔连招都没能拆完，便直挺挺栽倒在血泊里。一符，一命。满场死寂——死契血斗尚未过半，门派已然见血，眼看就要被这和尚屠尽。",
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
        t.push({ aside: "满场绝望。可无人知道，这门中还藏着一个修仙者。那就是你——药庐里那位不起眼的「小韩大夫」。" });
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
    // canon-audit Q3（2026-07-10 勘正·动漫6集）：**公开出手**的死契血斗——收飞剑符、假意还符诱其解金钟罩、
    // 趁隙毒针暗器齐发（非"医者身份近身暗算"）。此战韩立名动全门=离门动因（arc_end 承接）。
    text(s) {
      const t = [
        { aside: "顾师叔的血还没凉。你从人群里一步步走了出去——满场哗然：那个不起眼的小韩大夫，疯了么？" },
        { shot: "focusLeft" },
        "金光上人斜眼打量你，随手一道飞剑符掷来试探。你不闪不避——扬手一张符纸相触，竟把那道剑符生生收了下来。全场倒吸一口凉气。",
        { say: "金光上人", tone: "眯起眼，头一次正眼看你", text: "「咦？你这小子……也是道上的人？」" },
        { say: "韩立", emo: "calm", tone: "low", text: "「上人的符，还给你。」你双手捧符、躬身递上——姿态放得极低。" },
        { aside: "他果然起了轻慢之心，抬手来接——接符的这一瞬，金钟罩的护体金光，微微敛了。" },
      ];
      // 钩子：以毒为先 → 毒备充足台词
      if (s.flags.showdown_prep_poison) {
        t.push({ say: "韩立", tone: "心中默念", text: "金钟罩一敛，便是死门。毒草、暗器——我备得比谁都足。" });
      } else if (s.flags.showdown_martial_focus) {
        t.push({ say: "韩立", tone: "心中默念", text: "金钟罩一敛，近身一剑也能破。眨眼剑法——厉飞雨教的底子，今日见真章。" });
      } else {
        t.push({ say: "韩立", tone: "心中默念", text: "金钟罩一敛，便是死门。" });
      }
      t.push(
        { wait: 400 },
        // polish C3：全章最好的伺机时机做成 beat-window（staging-plan 原案）——中=开战先手 buff
        { beat: {
            kind: "window",
            prompt: "他抬手接符——金钟罩的护体金光，敛了。窗口只有一瞬。",
            action: "催毒·暗器·就是现在！",
            ms: 2400,
            onHit: {
              sfx: "backstab", cam: "shake", px: 10, hitStop: 90,
              fx: { fx: "burst", at: "center", elem: "jin", n: 16 },
              flag: "jinguang_window_hit",
              line: "毒针与暗器自袖中暴射而出——快过他重聚金光的念头！第一蓬毒雾结结实实扑进了敛光的护罩缺口。",
            },
            onMiss: {
              sfx: "whiff", cam: "shake", px: 5,
              line: "你出手迟了半拍——金钟罩重聚的金光挡下了大半毒雾。他勃然大怒，杀机全开。",
            },
        } },
        { sfx: "backstab" },
        { fight: "jinguang_win" },
      );
      return t;
    },
    choices: [
      {
        text: "毒、暗器、时机——一击毙命！",
        hint: "进入战斗。毒草/暗器越足越稳；硬拼必败",
        resolve: "jinguang_win",
      },
    ],
  },

  /* ---- C3.5 临行前夜 · 厉飞雨（polish D4：告别从 arc_end 五拍合一中拆出——全章第二情感重拍值得独立节点+真选择）---- */
  {
    id: "lify_farewell",
    skipIf: (s) => s.flags.lify_farewell_done,
    cond: (s) => s.flags.jinguang_dead && !s.flags.lify_farewell_done,
    bgm: "sorrow",
    title: "药庐 · 临行前夜",
    objTitle: "话别",
    objHint: "升仙令在手、寒毒在身，离门只在旦夕。临行前夜，厉飞雨提着酒来了药庐——满门上下，只有他还敢跟你同桌喝酒。",
    text(s) {
      const t = [
        { scene: "药庐 · 深夜" },
        { amb: "candle" },
        { shot: "establish" },
        "临行前夜，厉飞雨提着酒来了药庐。金光上人死后，门中人人躬身唤你「仙师」——只有他，进门就把酒坛子墩在你案上。",
        { shot: "focusLeft" },
        { say: "厉飞雨", emo: "laugh", tone: "他仰头灌了口酒，笑得还是那么亮", text: "「仙师？呸。在我这儿你就是韩立。……走吧，走得越远越好。你家里那头，有我看着。」" },
      ];
      if (s.flags.lifeiyu_dabi_helped) {
        t.push({ say: "厉飞雨", tone: "他晃了晃酒碗，声音低了些", text: "「大比那炉丹的账，我记着呢。这辈子怕是还不上了——就用往后年年替你看着韩家来还吧。」" });
      }
      t.push(
        { wait: 500 },
        { aside: "他早年练抽髓丸伤了根底——透支的亏空压在骨头里，寻常郎中看不出来，你看得出来。案头那卷药方，是你连夜替他写的。" },
      );
      return t;
    },
    onArrive(s) { State.setFlag("lify_farewell_done"); },
    choices: [
      {
        text: "把药方和丹药推过去 · 还他短刀",
        hint: "压住抽髓丸的亏空——命途之扶",
        effect(s) {
          Engine.writeLedger("lifeiyu_farewell_fang", "临行前夜赠厉飞雨压制抽髓丸亏空的药方与丹药、还他短刀——他的武人之躯能走多远，这卷方子说了算——日后筑基归来再算（远雷·黄枫谷篇回访兑现）。");
          return { text: "你把药方和几瓶丹药推到他面前，又把那柄借了多年的短刀郑重还到他手里：「按方吃药，别逞强。」他愣了愣，收起笑，把方子仔细揣进怀里最贴身的地方——「好。」", kind: "good" };
        },
        next: true,
      },
      {
        text: "方子照给——再多留一夜，陪他喝完这坛酒",
        hint: "启程晚一月·心境大回（时间换情义）",
        effect(s) {
          Engine.passTime(1);
          s.mood = Math.min(s.moodMax, (s.mood || 0) + 6);
          s.demon = Math.max(0, (s.demon || 0) - 4);
          Engine.writeLedger("lifeiyu_farewell_fang", "临行前夜赠厉飞雨药方丹药、还短刀，又陪他喝完了整坛酒——从五里沟说到演武厅，把这些年一口气聊完——日后筑基归来再算（远雷·黄枫谷篇回访兑现）。");
          Engine.recordTemperament("lify_farewell", "sentiment", "临行前夜多留一夜——修行路长，这样的酒喝一坛少一坛");
          return { text: "那坛酒你们喝到了天亮。从五里沟的红浆果说到演武厅的第一课，从张铁的憨笑说到「看遍大千世界」——他趴在案上睡着时，手里还攥着那卷药方。你替他掩上门，晨光正好。（心境+6·心魔-4·多留一月）", kind: "good" };
        },
        next: true,
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
        "金光上人到死都瞪大着眼——他怎么也想不通，自己竟会折在一个不起眼的门派药师手里。贾天龙亦随之伏诛，野狼帮树倒猢狲散。",
        "你从他身上搜得宝物：升仙令、金符、剑符、金钟罩——皆是你做梦都不敢想的修仙之资。",
        { aside: "尤其这枚「升仙令」……它是踏入更高门派、求取筑基机缘的凭证。我的机会，到了。" },
        { fx: "flash", color: "#bfe0ff", alpha: 0.3, ms: 300 },
        // canon-audit Q3 补拍（动漫6集）：此战当众出手=名动全门；「仙师」二字隔开了所有人——离门的情感动因
        { wait: 500 },
        "只是自那一战后，门中再没人唤你「小韩大夫」了。人人躬身称你「仙师」，敬畏、疏远、连眼神都不敢多碰——凡人与修仙者之间，隔了一层看不破的东西。这门派，待不下去了。",
        { sfx: "danger" },
      ];
      // 钩子：早期警觉 → 寒毒的伏笔不同
      // canon-audit Q1（2026-07-10 勘正·TMDB ep4+红袖 ep5 双源）：寒毒=夺舍之夜交手中的「魔银手」阴毒，非长春功暗手
      if (s.flags.early_suspicion) {
        t.push("可夜里收功之时，一缕阴寒自丹田窜起。你早有预感——夺舍之夜与墨大夫拼斗时，被他那一手阴冷的『魔银手』擦中过一记，余毒潜伏至今，终于发作了。遗书里写得明白：解药唯有墨家祖传的「暖阳宝玉」。");
        t.push({ aside: "我早该防的……那一掌擦过时的刺骨阴寒，我当时就觉得不对，却没来得及细查。也罢，去嘉元城解毒，正好替这老鬼了结因果。" });
      } else {
        t.push("可夜里收功之时，一缕阴寒自丹田窜起，冻得你指尖发麻——夺舍之夜墨大夫那一手阴冷的『魔银手』浮上心头：拼斗中被擦中的那一记，余毒潜伏至今，终于发作了。遗书里写得明白：解药唯有墨家祖传的「暖阳宝玉」。");
        t.push({ aside: "遗书末尾是一行小字：去岚州嘉元城墨府，解你的毒，也……替我安顿好她们。这老鬼，到死还要驱使我。" });
      }
      // 告别已拆独立节点 lify_farewell（polish D4）——此处只留启程回望
      t.push(
        { bgm: "journey" },
        "昨夜的酒气还没散尽。行囊上，压着厉飞雨天不亮时悄悄放来的一包干粮。",
        { shot: "pullOut" },
        "你最后回望了一眼这座困了你数年的七玄门。这里有过暖意，也有过欺骗与杀机。",
      );
      // 钩子：结拜兄弟 → 告别台词不同
      if (s.flags.sworn_brothers) {
        t.push({ say: "韩立", tone: "极轻", text: "张铁……结拜时说过的，有福同享。升仙令在手，我替咱们三兄弟走出这条路。后会有期。" });
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
        t.push({ aside: "暖阳宝玉……墨大夫魔银手的阴毒，解药恰是他家祖传之物。这老鬼连死后被人念着好都算到了——用一桩恩情换一桩托付，高明。可彩环的嫁妆换我的命，这笔账我记着，日后必还。" });
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
        { amb: "market" },
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
        { amb: "market" },
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
      // polish-huangfeng P1-1（Fable）：丹账人账分立——人账在叶师叔身败名裂时结（旧版 ye_finale 死结算=从未 write）
      Engine.writeLedger("ye_grudge", "叶师叔以势压人、借「谷例」换走你拼来的筑基丹——丹的账是丹的账，人的账是人的账。此人此行，日后必有报应落到他自己头上");
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
   *  陆云风（陈巧倩道侣）为攀附董萱儿求入红拂座下+筑基丹之争，对道侣暗下杀手 →
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
          // polish-huangfeng C4（Fable P1-5）：封存一夜的一拍——冷色一闪 + 万籁俱寂（记忆被抹去的留白）
          if (typeof Fx !== "undefined" && Fx.flash) Fx.flash("#8fa4bd", 760, 0.4);
          if (typeof Sfx !== "undefined" && Sfx.ambientStop) Sfx.ambientStop();
          return { text: "她盯着你掌心的丹丸看了很久，忽然笑了一下，仰头服下。\n\n「原来恩公要的是……干净。」她阖眼前最后说了这一句。\n\n你把她安置在陈家坊铺外，转身离开。明日她醒来，只会记得自己遇了袭、被无名氏所救——而你，是个无名氏。\n\n（账本：忘尘丹。她的情路，被你亲手封存在了今夜。）", kind: "sys" };
        },
      },
      {
        text: "收回手：「记着也好——记着，往后躲恩人远些。」",
        hint: "改命的起点：她会记得你（命途参数自此不同）",
        effect(s) {
          Engine.writeLedger("chen_remember", "救陈巧倩之后，没有喂忘尘丹——她记得你");
          // polish-huangfeng C4（Fable P1-5）：被记住的一拍——一声清磬 + 暖光微漾（有些事没有被封存）
          if (typeof Sfx !== "undefined" && Sfx.play) Sfx.play("chime");
          if (typeof Fx !== "undefined" && Fx.flash) Fx.flash("#ffe9c8", 620, 0.22);
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
    // polish-huangfeng A1①（GPT P0-1）：xueshi_due 成真门槛——大比时节是日历锚（xianhui_due/
    // dabi_due 同构），名额大会「时节到 且 修为到（练气十一层=踏入血幕的命线）」双门槛齐备才开。
    // 旧「门槛软化」只查修为＝日历锚形同虚设（倒计时挂在天命栏，大会却随到随开——时间预算失真之根）。
    // 修为曲线已校准至 30~48 月可达十一层（A1③），与 due=+30 月天然对齐：快者等时节（备货窗口），
    // 慢者时节已过、修为一到即开——两头都不死等。
    cond: (s) => !s.flags.xueshi_opened && !!s.flags.xueshi_due && s.realmIndex >= 10
                 && State.absMonth() >= s.flags.xueshi_due,
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
      // polish-huangfeng P0-3（Fable）：旧 nangongwan_bond 读点=时序死分支（bond 在禁地潭边才置位，本节点必先播）——删。
      t.push({ aside: "掩月宗……天之骄女。传闻她筑基用了不到四年。" });
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
      { text: "名额到手——可血幕之内五日生死，临行这三月，须得备足。", resolve: "advance" },
    ],
  },
  {
    /* —— 时间窗口互斥·首例（drift-audit P0 #3 落地）：血色禁地临行·三月备战 ——
     * 名额已定、血幕未开。临行三个月只够把一件事做到位——三选一，选了即无暇他顾（互斥）。
     * 铁律2：耗 3 月（passTime）。铁律6：收益各有所值、无最优解（修为/底牌/丹药各喂一条路）。
     * 铁律7：错过不卡死——没选的那两条，禁地里自有更难更贵的补救（采集/硬拼）。
     * 复用既有系统（cultivate 修为 / give 底牌 / skills.alchemy），零新系统（乘法律）。 */
    id: "jindi_prep",
    skipIf: (s) => s.flags.jindi_prep_done,
    cond: (s) => s.flags.xueshi_opened && !s.flags.jindi_prep_done && !s.flags.jindi_entered,
    bgm: "tense",
    objTitle: "临行三月 · 备战血色禁地",
    objHint: "血幕未开，临行尚有三月。这三个月只够把一件事做到位——闭关冲修为、坊市备底牌、丹房精炼，三者只能择一。",
    title: "血色禁地 · 临行三月",
    text(s) {
      return [
        { scene: "黄枫谷 · 居所" },
        { amb: "candle" },
        "名额到手那日起，血幕开启便定在了三个月后。三个月——于修仙者不长，却也容不得你既要又要。",
        { aside: "血色禁地五日生死局：主药在深、凶险在深。临行这三月怎么花，进去那五日就怎么活。修为、底牌、丹药——你只来得及把其中一样备到位。" },
        { say: "韩立", emo: "serious", tone: "low", text: "「贪多嚼不烂。这三个月，押一处——押对了，便是血幕里多一条命。」" },
      ];
    },
    choices: [
      {
        text: "闭关冲修为：把这三月尽数砸进苦修，临阵境界更稳。",
        hint: "互斥·耗3月——修为大涨（冲层/突破缓冲），但底牌与丹药无暇置备",
        effect(s) {
          State.setFlag("jindi_prep_done");
          State.setFlag("jindi_prep_cultivate");
          // polish-huangfeng Bug③（GPT P0-6）：旧版 passTime(3)+cultivate(3) 实耗 6 月——cultivate 内部自过月
          if (typeof Engine.cultivate === "function") Engine.cultivate(3); else Engine.passTime(3);
          s.mood = Math.min(s.moodMax, s.mood + 2);
          Engine.writeLedger("jindi_prep_cultivate", "血色禁地临行三月——尽数闭关苦修、不备底牌不炼丹，押的是临阵境界更稳（互斥窗口·选了修为弃了备战）");
          Engine.addMilestone("临行备战：三月闭关冲修为", "deed");
          return { text: "三个月，你足不出洞府，灵力在经脉里一寸寸拓宽。临行那日推开石门，境界比月前沉稳了不止一线——血幕之内，硬实力才是底气。\n\n（修为大进；底牌与丹药未及置备——禁地里，省着用。）", kind: "good" };
        },
        resolve: "jindi_enter",
      },
      {
        text: "坊市备底牌：跑遍黄枫谷坊市，把符箓暗器囤足。",
        hint: "互斥·耗3月——得火蛇符/寒冰符/定身符/暗器一批，但这三月不长修为",
        effect(s) {
          State.setFlag("jindi_prep_done");
          State.setFlag("jindi_prep_stock");
          Engine.passTime(3);
          State.give("huoshe_fu", 2);
          State.give("hanbing_fu", 2);
          State.give("dingshen_fu", 1);
          State.give("anqi", 4);
          s.mood = Math.min(s.moodMax, s.mood + 2);
          Engine.writeLedger("jindi_prep_stock", "血色禁地临行三月——跑遍坊市囤足符箓暗器（火蛇/寒冰/定身符＋飞针），押的是临阵底牌厚（互斥窗口·选了备战弃了修为/丹药）");
          Engine.addMilestone("临行备战：三月坊市囤底牌", "bigitem");
          return { text: "三个月，你把黄枫谷坊市跑了个遍，灵石换成了满袋的符箓与飞针——火蛇克金、寒冰克火、定身拆招，暗器补刀。\n\n（得火蛇符×2、寒冰符×2、定身符×1、暗器×4；修为未进——血幕里，靠这些底牌咬硬骨头。）", kind: "good" };
        },
        resolve: "jindi_enter",
      },
      {
        text: "丹房精炼：守着地火丹炉，磨药理、囤回元丹。",
        hint: "互斥·耗3月——药理大涨＋得回元丹一批（战内续命），但不长修为、不囤符箓",
        effect(s) {
          State.setFlag("jindi_prep_done");
          State.setFlag("jindi_prep_alchemy");
          Engine.passTime(3);
          s.skills = s.skills || { alchemy: 0, scouting: 0 };
          s.skills.alchemy = (s.skills.alchemy || 0) + 6;
          State.give("huiyuan_dan", 3);
          s.mood = Math.min(s.moodMax, s.mood + 2);
          Engine.writeLedger("jindi_prep_alchemy", "血色禁地临行三月——守地火丹炉磨药理、囤回元丹，押的是临阵续航＋丹道根基（互斥窗口·选了丹药弃了修为/符箓）");
          Engine.addMilestone("临行备战：三月丹房精炼（药理+6·回元丹×3）", "bigitem");
          return { text: "三个月，你守着地火丹炉寸步不离，火候手感又精进一层，炉里滚出几粒救命的回元丹。\n\n（药理+6、回元丹×3；修为未进、符箓未囤——血幕里，灵力见底时这几粒丹便是续命的那口气。）", kind: "good" };
        },
        resolve: "jindi_enter",
      },
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
          // 【死代码·留档】本节点 skipIf:()=>true 已被舆图系统接管，永不触发。
          //   原先此处的"稳守外环"种因已移除（jindi_safe）——它种因永不发生且全仓无人读，属死代码债（drift-audit 清理）。
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
        hint: "藏拙分寸——铸入心性",
        effect(s) {
          Engine.recordTemperament("hanli_formal_bow", "stoic", "拜师李化元·只拱手不跪——恩要认，分寸要留，这是你在权势里活下来的姿势");
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
    // polish-huangfeng P1-4（Fable）：妖材→法宝链首件落地补炉火三拍——大件"到手蜕变"要被看见
    bgm: "triumph",
    text(s) {
      const t = [
        { scene: "黄枫谷 · 丹房偏院" },
        { amb: "candle" },
        { shot: "establish" },
        "记名拜师后未几，李化元唤你到丹房偏院。院中地火幽幽，一名青衫老者正就着炉火翻看你那对墨蛟之角，眼里精光闪烁。",
        { say: "李化元", text: "这位是齐云霄，元武国姓齐的炼器巧匠，与老夫是多年旧识。你这对蛟角内蕴水行妖力，寻常炉火炼它不动——正该他出手。" },
        { say: "齐云霄", emo: "smile", text: "双角质胜精铁，毒性犹存。小子，要老夫给你炼把称手的？依这角的脾性，做成短法宝最是凶毒——四爪攥握、御空连抓，爪尖带着蛟毒，缠上谁都难受。" },
        { sfx: "castHuo" },
        { fx: "flash", color: "#ff9a4a", alpha: 0.25, ms: 420 },
        { cam: "shake", px: 5 },
        "老者袖中飞出一具小巧法器雏形，四道墨绿如四枚蛟爪攥成一握。地火轰然窜起，蛟角入炉，缕缕毒雾被逼回器身。",
        { wait: 600 },
        { shot: "pushIn", ms: 1200, scale: 1.12 },
        { sfx: "sword" },
        { aside: "三日后开炉——四爪墨绿、爪尖泛着幽幽青芒，正是那墨蛟未散的毒。「乌龙夺」。血色禁地拼死斩下的角，成了随你征战的第一件法宝。" },
        { sfx: "success" },
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
        hint: "即刻试手——铸入心性",
        effect(s) {
          Engine.recordTemperament("wulong_test", "sentiment", "乌龙夺到手当场试爪——拼死换来的东西，藏不住那点少年心气");
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
    // polish-huangfeng B3（Fable P1-6）：收官段天命栏不再"静待时机"——出禁地→炼丹→嗑丹→渡劫全程指路
    objTitle: "筑基之路",
    objHint(s) {
      if (!s.flags.zhuji_lian_done) {
        return State.count("xueshi_zhuyao") >= 4
          ? "血色主药在手——回洞府（黄枫谷山门）借地火之屋「地火炼丹」，炼出你的筑基丹"
          : "血色主药不足四株——凑足四株，方能借地火之屋开炉炼丹";
      }
      return `筑基丹×${State.count("zhuji_dan")} 满匣——回洞府「尝试突破」，以丹开路冲击筑基`;
    },
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
        hint: "先安身——铸入心性",
        effect(s) {
          s.mood = Math.min(s.moodMax, s.mood + 3);
          Engine.recordTemperament("qingyuan_settle_first", "stoic", "得青元剑诀不急参剑·先安顿洞府——磨刀不误砍柴工，你惯于把根基打稳再动手");
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
        hint: "闭关修为 +15%（动漫之选·得先斗一场灵猿）",
        effect(s) {
          State.setFlag("dongfu_done"); s.flags.dongfu_type = "lingquan";
          Engine.addMilestone("洞府落成：灵泉眼", "bigitem");
          Engine.writeLedger("dongfu_lingquan", "择灵泉眼开洞府（修炼效率+），驱走了占洞的灵猿");
          return { text: "你提剑上山，洞中盘踞的白毛灵猿与你斗了半日，终是不敌，呜咽着让出泉眼。\n\n泉水叮咚，灵气氤氲——你的第一座洞府，悬在黄枫谷的云雾里。自此闭关修炼，事半功倍（修炼效率+15%）。", kind: "good" };
        },
      },
      {
        text: "僻静谷：藏风聚气，最不打眼。",
        hint: "藏拙者之选：闭关走火入魔概率 -15%（藏得深，睡得着）",
        effect(s) {
          State.setFlag("dongfu_done"); s.flags.dongfu_type = "pijing";
          Engine.addMilestone("洞府落成：僻静谷", "bigitem");
          Engine.writeLedger("dongfu_pijing", "择僻静幽谷开洞府——藏拙者的本能");
          return { text: "你选了最不打眼的那道幽谷。同门都说杂役出身就是小家子气——你笑笑不答。\n\n谷口布下迷踪阵旗，云雾一锁，神仙难寻。藏得深，才睡得着。（洞府清静：闭关走火入魔概率 -15%。）", kind: "good" };
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
    /* M3·代工取舍（chapter-differentiation §三·黄枫谷「经营」）：三件皆炼，但齐云霄只有一双手——
     * 「首炼」那件由他亲手精工（永久乘性微增益·A2 承重墙合规），余下两件徒弟按图代锤（标准品质）。
     * 舟=旅途遁速（时间货币）／夺=主战爪锋（战斗）／阵=洞府聚灵（修炼）——Build 三向真取舍。 */
    choices: [
      {
        text: "先炼乌龙夺——搏命的家伙，须他亲手淬锋。",
        hint: "互斥·精工乌龙夺：佩夺出战伤害+6%（余两件徒弟代锤）",
        effect(s) {
          State.setFlag("daigong_fine_wulong");
          return Engine.daigongForge(s, "齐云霄把墨蛟双角亲自上炉，七日淬锋、爪尖喂毒：「搏命的东西，我不放手给徒弟。」——此后你佩乌龙夺出战，四爪更利（伤害+6%）。");
        },
      },
      {
        text: "先炼神风舟——路在脚下，赶路的家伙不能将就。",
        hint: "互斥·精工神风舟：帆稳风顺——远行途中时有一月并作两月的路程",
        effect(s) {
          State.setFlag("daigong_fine_zhou");
          // polish-huangfeng C6：旧承诺「遁速+2」撞 travelTimeFactor 下限=实际无感——改写实：
          // 真读点在 Engine._journeyActionTravel（御精工舟赶路，平安月有几成并作两月路程）
          return Engine.daigongForge(s, "齐云霄亲手裁皮为帆、削角为骨，帆骨间暗刻风纹：「船是脚，脚快一步，命长一寸。」——此后你御神风舟远行赶路，帆骨引风，时常一月赶出两月的路程。");
        },
      },
      {
        text: "先推演阵图——洞府是根本，阵成则家安。",
        hint: "互斥·精推阵图：洞府闭关修炼+4%（聚灵入阵）",
        effect(s) {
          State.setFlag("daigong_fine_zhen");
          return Engine.daigongForge(s, "齐云霄闭门三日、亲手把千年灵草的药性推进阵枢：「阵是家底。灵气聚得拢，家才立得住。」——此后洞府闭关，聚灵入阵（修炼+4%）。");
        },
      },
    ],
  },
  // canon-audit H1（2026-07-10 重写·动漫 ep17）：叶师叔=千竹教卧底，吴师叔撞破其与灵兽山钟吾的勾结遭傀儡追杀→
  // 韩立救回洞府、颠倒五行阵死守→结丹长老雷万鹤赶到诛叶→吴师叔殉难→韩立当场自叶的储物袋拾得《大衍诀》残卷。
  // （旧版"越狱死于路过散修·残卷归档执法堂"系实装偏离自家档案 techniques-lore.md——档案对、代码错的漂移。）
  {
    id: "ye_finale",
    where: "huangfeng_gate",
    skipIf: (s) => s.flags.huangfeng_complete,
    cond: (s) => s.flags.dongfu_done && !s.flags.huangfeng_complete,
    bgm: "tense",
    title: "尾声 · 叶师叔之乱",
    text(s) {
      const t = [
        { scene: "洞府 · 深夜" },
        { amb: "night" },
        { shot: "establish" },
        "你筑基后第三个月的一个深夜，急促的敲门声砸碎了山间的静。",
        { amb: null },
        { shot: "shock", scale: 1.12, px: 8 },
        { sfx: "danger" },
        "门外是吴师叔——当年领你入谷的那位老好人，此刻胸前一片血污，半条胳膊耷拉着：「韩师侄……快、快关门！叶……叶师叔是千竹教的卧底！我撞破他与灵兽山钟吾私下交易——他的傀儡，追上来了！」",
        { fx: "flash", color: "#1a2430", alpha: 0.3, ms: 400 },
        "话音未落，林间传来「咔、咔」的机括之声——一头铁木傀儡撞碎树影扑来，关节缝里透着幽绿的符光！",
        { shot: "focusRight" },
        { say: "韩立", emo: "cold", tone: "low", text: "「进来！」你反手将吴师叔拽进洞府，掐诀便催那座尚未完工的颠倒五行阵——阵旗嗡鸣，五行灵光交错成墙！" },
        { fx: "burst", at: "center", elem: "tu", n: 16, ms: 500 },
        { sfx: "castTu" },
        { cam: "shake", px: 9 },
        "傀儡一记重似一记地砸在阵光上。阵纹寸寸崩裂——这座基础版的阵，撑不了几息了。",
        { wait: 600 },
        { fx: "flash", color: "#ffe9ad", alpha: 0.4, ms: 500 },
        { sfx: "thunder" },
        "千钧一发，一道剑虹自天而落——黄枫谷结丹长老雷万鹤到了。剑光过处，傀儡断作两截；再一剑掠出，林外传来一声不甘的惨嚎：躲在暗处操纵傀儡的叶师叔，被一剑穿心。",
        { say: "雷万鹤", tone: "cold", text: "「千竹教的钉子，潜伏二十年……宗门竟无一人察觉。此獠死不足惜——只是委屈了吴师弟。」" },
      ];
      // 钩子：夺丹之辱 → 对叶师叔真面目的回响更深
      if (s.flags.zhuji_dan_stolen) {
        t.push({ aside: "叶师叔……当日执事殿上强换走你筑基丹的那位叶师叔。掌门的「不主持公道」，背后竟还有这一层——你丢的那枚丹，早顺着暗线送去了魔道。" });
      } else {
        t.push({ aside: "叶师叔……当日满殿无人敢言的那位叶师叔，竟是魔道安插了二十年的钉子。" });
      }
      t.push(
        { amb: null },
        { wait: 700 },
        { shot: "pushIn", ms: 1400, scale: 1.14 },
        "洞府里，吴师叔的气息一点点弱了下去。他抓着你的手腕，笑得比哭还难看：「韩师侄……当年领你入谷时，老朽就说你面相长寿……好好活……替谷里，多看几眼……」",
        { wait: 700 },
        "手，垂了下去。当年山门前那句「面相长寿」，成了他留给你的最后一句话。",
        { fx: "ambient", preset: "spirit" },
        { sfx: "bell" },
        { shot: "pullOut", ms: 1600 },
        "事后清点，叶师叔的储物袋滚落在林间。雷万鹤拣出其中脏物归档，却把一卷无人能识的功法残卷抛给了你：「你护吴师弟这一场，此物你留着——神识一触便知深浅，谷中无人修得动它。」卷首两个古字：大衍。",
        { aside: "「大衍诀」……残卷入手沉甸甸的。以你如今的神识，翻开第一页便头痛欲裂——此物太深，须来日方长。" },
      );
      return t;
    },
    onArrive(s) {
      State.setFlag("huangfeng_complete");
      // polish-huangfeng B2（GPT P0-5）：记下篇终时刻——燕家堡调令延后 3 月（安家修行帆段），
      // 厉飞雨回访窗（C1）也以此计时
      s.flags.hf_complete_at = State.absMonth();
      State.setFlag("dayan_canjuan_got");
      State.give("dayan_canjuan", 1);
      Engine.settleLedger("ye_grudge", "夺丹的叶师叔身败名裂、死于雷万鹤剑下——这笔账，世界替你收了");
      Engine.settleLedger("zhangmen_no_justice", "掌门殿前那句「实力为上」你记到了今日——掌门不给的公道，世界亲手补给了你：夺丹之人死于门规雷剑之下，满谷皆见");
      Engine.settleLedger("wu_kindness", "当年山门前那句「面相长寿」的善意，你还他一场颠倒五行阵的死守——吴师叔终究没能撑过这一夜，可他是握着你的手走的");
      Engine.writeLedger("dayan_clue", "叶师叔之乱中拾得《大衍诀》残卷（雷万鹤所赠）——神识不足暂难参研，实物在囊，来日方长");
      Engine.addMilestone("黄枫谷篇 · 完：伪灵根筑基，谷中立足；大衍诀残卷入手", "breakthrough");
      if (typeof Sfx !== "undefined") Sfx.play("bell");
    },
    choices: [
      {
        text: "魔道暗流已动——天南，要变天了。（黄枫谷篇·完）",
        hint: "警醒——暗流涌动",
        effect(s) {
          s.mood = Math.max(0, s.mood - 1);
          return { text: "你望向太岳山脉外那片越来越浓的妖氛——连吴师叔这样的老好人都死在了暗线之下。天南，真的要变天了。", kind: "event" };
        },
        resolve: "advance",
      },
      {
        text: "「大衍诀……总有一天，我会修得动它。」郑重收起残卷。",
        hint: "远虑——大衍诀线伏笔",
        effect(s) {
          State.setFlag("dayan_remembered");
          Engine.writeLedger("dayan_remembered", "将大衍诀残卷贴身收好——神识不足暂难参研，但你记下了：总有一天，修得动它（星海·神识线伏笔）");
          return { text: "你把那卷残卷仔细裹好、贴身收起。头痛欲裂的那一触，反倒叫你认定了它的分量。", kind: "event" };
        },
        resolve: "advance",
      },
    ],
  },

  /* ============================================================
   * 彩霞山回访：厉飞雨（polish-huangfeng C1·Fable P0-1）
   *   上一站种的三笔账（dabi_dan/dabi_watch/farewell_fang）全部指名"筑基归来再算"——兑现窗在此。
   *   窗口=篇终后 6 月内亲赴演武厅；错过则燕家堡调令兜底结算（捎酒·账不赖）。
   *   与 B2 篇终帆段同一段时间：调令延后 3 月，这 3~6 月正是回乡的空档。
   * ============================================================ */
  {
    id: "lify_revisit",
    where: "wuting",
    skipIf: (s) => s.flags.lify_revisit_done
      || (State.absMonth() - (s.flags.hf_complete_at || 0) >= 6),
    cond: (s) => !!s.flags.huangfeng_complete,
    bgm: "daily",
    objTitle: "故人之约",
    objHint(s) {
      const left = 6 - (State.absMonth() - (s.flags.hf_complete_at || 0));
      return `筑基已成，谷务未催——彩霞山的方向有人等你回去看一眼（演武厅的老位置）。这趟若不走，往后未必有空档${left > 0 ? `（约还等得起 ${left} 月）` : ""}。`;
    },
    title: "彩霞山 · 演武厅的老位置",
    // bgm：daily（药庐古琴——回乡的调子）
    text(s) {
      const t = [
        { scene: "七玄门 · 演武厅" },
        { amb: "market" },
        { shot: "establish" },
        "重回彩霞山那日，山门的石阶还是老样子，只是巡山弟子的面孔全换了新的。演武厅里刀风霍霍——场院中央那个正在给弟子喂招的背影，你隔着半座山也认得。",
        { shot: "focusRight" },
        "厉飞雨。腰牌换成了执法堂首座的鎏金牌，鬓角有了风霜，可收刀转身看见你的那一瞬，咧开的嘴还是当年那个五里沟少年。",
        { say: "厉飞雨", emo: "laugh", text: "「韩立！」他把刀往架上一插，大步流星走过来，一拳捶在你肩上，「好小子，一走这些年——听说你在仙门里出息了？」" },
      ];
      if (Engine.readLedger("lifeiyu_farewell_fang")) {
        t.push("他从怀里摸出一卷边角磨毛的旧纸——正是你临行那夜留下的药方。「一顿没落。」他扬了扬下巴，中气十足，「你听听这嗓门，亏空压住了。」");
      }
      if (Engine.readLedger("lifeiyu_dabi_dan")) {
        t.push({ aside: "大比前那炉精元丹、临别那坛酒——这些年你在谷里拼死拼活的时候，这里的账，他一笔一笔都记着。" });
      } else if (Engine.readLedger("lifeiyu_dabi_watch")) {
        t.push({ aside: "当年大比你在台下给他鼓的掌，他记到了今日。" });
      }
      t.push(
        { wait: 500 },
        { say: "厉飞雨", emo: "laugh", tone: "loud", text: "「少废话——」他反手又把刀抄了起来，刀尖点地，眼里烧起当年大比的那股火，「韩立！陪我过两招！用拳脚，别拿你那些仙家把戏糊弄我！」" },
      );
      return t;
    },
    onArrive(s) {
      State.setFlag("lify_revisit_done");
      if (typeof Sfx !== "undefined") Sfx.play("confirm");
    },
    choices: [
      {
        text: "「请。」收起法力，用七玄门的老本行陪他打",
        hint: "真切磋——凡人相搏，点到即止（他如今是执法堂首座，半分不会让你）",
        effect(s) {
          Engine.startLifyRevisitFight();
          return { text: "你把外袍搭上兵器架，法力压回丹田——演武厅的老位置，还是当年那两个人。", kind: "event" };
        },
        resolve: "advance",
      },
      {
        text: "「这身骨头生疏了——坐下喝酒，把这些年补给我听。」",
        hint: "只叙旧——账一样结，只是他会念叨很久「没打成」",
        effect(s) {
          s.mood = Math.min(s.moodMax, (s.mood || 0) + 6);
          s.demon = Math.max(0, (s.demon || 0) - 4);
          Engine._settleLifyLedgers("talk");
          Engine.addMilestone("彩霞山回访：与厉飞雨把这些年一口气聊完", "sentiment");
          return { text: "他撇撇嘴收了刀：「没劲。」酒却搬得飞快。从执法堂的新差事说到五里沟的旧红浆果，一坛见底，他忽然压低声音：「在外头……好好活着。」（心境+6·心魔-4）", kind: "good" };
        },
        resolve: "advance",
      },
    ],
  },

  /* ============================================================
   * 魔道争锋篇·前置：燕家堡之战（特别篇）——增量D
   *   官方序：风起天南 → 燕家堡之战（特别篇）→ 魔道争锋（22~46话）。
   *   考据 ≥2 源：modao-design §前置·燕家堡之战 + 裁决6（李化元强制进场 / 王蝉=大BOSS·结不死不休之仇·
   *   本战不诛 / 重逢墨彩环 / 结识董萱儿 / 篇末逃出被七派强征入伍 / ⚠燕家堡≠天阙堡）。
   *   ⚠ 2026-07-09 考据勘误（用户指正·百度百科+动漫指南双源）：王蝉=鬼灵门少主·人修·戴面具·修血灵大法，
   *   借医病联姻入堡、夺宝大会布血祭大阵（燕家举族投魔）；韩立突围时报「厉飞雨」之名背锅——旧版"战王蝉"虫妖破阵为误。
   *   四节点强制链（无 where，靠 flag 门禁顺序自动演出）：调令 → 重逢 → 大BOSS → 逃出强征入伍。
   * ============================================================ */
  {
    id: "yanjia_summon",
    skipIf: (s) => s.flags.yanjia_summoned,
    // polish-huangfeng B2（GPT P0-5）：调令延后 3 月——篇终留一段"安家修行"帆段
    // （回彩霞山赴约/闭关/采买皆可；旧版 ye_finale 一落幕调令即至，篇终零喘息）
    cond: (s) => s.flags.huangfeng_complete && !s.flags.yanjia_summoned
      && (State.absMonth() - (s.flags.hf_complete_at || 0) >= 3),
    bgm: "tense",
    objTitle(s) {
      const waiting = State.absMonth() - (s.flags.hf_complete_at || 0) < 3;
      return waiting ? "山雨欲来" : "燕家堡调令";
    },
    objHint(s) {
      const waiting = State.absMonth() - (s.flags.hf_complete_at || 0) < 3;
      return waiting
        ? "叶师叔之乱方平，谷中气氛一日紧过一日——传闻魔道于北面集结，谷务的调令怕是不远了。趁这几个月安顿修行、了却私事。"
        : "李化元一纸调令已下——魔道入侵在即，燕家堡夺宝大会暗流涌动，七派各遣弟子赴会探底，伪灵根筑基的你也在名单之列。";
    },
    title: "魔道争锋篇·前置 · 燕家堡调令",
    text(s) {
      const t = [
        { scene: "黄枫谷 · 外门居所" },
        "大衍诀的事还压在心头，谷中一道加急调令便到了你手上——朱漆封口，落款是首席大长老李化元。",
        "「魔道入侵在即，燕家于此时大开『夺宝大会』广邀各派，居心叵测。七派各遣筑基弟子赴会探底。凡谷中筑基弟子，无论灵根，皆在遴选——三日内动身。」",
      ];
      // 钩子：藏拙本能 → 对「无论灵根」的内心反应
      if (s.flags.early_suspicion) {
        t.push({ aside: "无论灵根。这四个字，分明是冲着你这伪灵根来的。修为压制，军令如山——这一回，没有「不去」的选项。……也好。藏拙藏了这么久，也该试试这身修为够不够用了。" });
      } else {
        t.push({ aside: "无论灵根。这四个字，分明是冲着你这伪灵根来的。修为压制，军令如山——这一回，没有「不去」的选项。" });
      }
      t.push(
        { say: "李化元", tone: "cold", text: "你筑基了，便是谷中战力。燕家这场『大会』水浑得很，与其日后被人推上去送死，不如老夫先把你这条命，用在该用的地方——去，替谷里看看那潭水有多深。临行前，藏书阁里的功法你可自选一门带着防身。" },
      );
      // canon P2·书页合璧（红袖「金银书页」词条·动漫线）：赴燕家堡前李化元处自选功法→无意得银页；
      // 与血色禁地杀封岳所得金页合璧=青元剑诀完整十三层之钥（远线·不即时解锁层数）
      t.push(
        "藏书阁中你翻检半日，指尖忽然一顿——一册旧功法的夹层里，滑出一页银色薄篇，非金非帛、纹理古奥。",
      );
      if (State.count("jinse_shuye") > 0) {
        t.push(
          { fx: "flash", color: "#cdd8ee", alpha: 0.3, ms: 460 },
          { sfx: "chime" },
          "你心头剧震——这纹理，与封岳尸身上搜得的那页金色薄篇分明是一对！你屏息将金银两页相合：接缝严丝合缝，页上残文相互补全，隐约显出《青元剑诀》完整十三层的端倪，还有一式……以「万年金雷竹」炼制七十二口本命飞剑之法。",
          { aside: "谷传九层之外，竟真有完整十三层。只是此诀太深，以你如今的层数远远够不着——先收好。这对书页，是往后很多年的一枚种子。" },
        );
      } else {
        t.push(
          { aside: "银页上的残文与《青元剑诀》一脉同源，却似乎只是下半页——世间该还有与之成对的另一页。你把它贴身收好：说不清为什么，只觉得这一页，日后有大用。" },
        );
      }
      t.push(
        "你收拾起神风舟、乌龙夺与那张颠倒五行阵图，望了一眼太岳山脉北面那片越来越浓的妖氛——天南，真的要变天了。",
      );
      return t;
    },
    onArrive(s) {
      Chapters.unlock("modao");
      Chapters.enter("modao");   // activeChapter=modao + location=yanjiabao（realmCap 抬进筑基）
      State.setFlag("yanjia_summoned");
      State.give("yinse_shuye", 1);
      if (State.count("jinse_shuye") > 0) {
        State.setFlag("qingyuan_pages_merged");
        Engine.writeLedger("qingyuan_quanben", "金银书页合璧——封岳身上的金页与李化元藏书阁的银页相合，青元剑诀完整十三层与青竹蜂云剑（金雷竹七十二剑）炼制之法的端倪尽显。层数太深眼下够不着（远线·星海炼剑与大庚剑阵之根）。");
      } else {
        Engine.writeLedger("yinse_shuye_got", "李化元藏书阁自选功法·无意得一页银色薄篇（青元剑诀同源·似为成对书页之下半）——上半页不知在何人之手（远线钩）。");
      }
      Engine.writeLedger("yanjia_summon", "李化元强制调令——遣伪灵根筑基的你赴燕家堡夺宝大会，替黄枫谷探底");
      // C1 兜底：回访窗错过（6 月内未赴彩霞山）——账不赖，形式换成他捎来的那坛酒
      if (!s.flags.lify_revisit_done && !s.flags.lify_ledgers_settled
        && (Engine.readLedger("lifeiyu_dabi_dan") || Engine.readLedger("lifeiyu_dabi_watch") || Engine.readLedger("lifeiyu_farewell_fang"))) {
        Engine._settleLifyLedgers("missed");
        Engine.log("收拾行装时，门房送来一坛用麻绳捆得结结实实的老酒——彩霞山来的。附的字条只有一行刀刻般的字：「等你回来补上这两招。——厉」", "event");
      }
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
        hint: "谨慎打探——铸入心性",
        effect(s) {
          s.mood = Math.min(s.moodMax, s.mood + 2);
          Engine.recordTemperament("yanjia_recon", "stoic", "赴燕家堡前先打探地形与魔道风声——谋定而后动，你从不打没数的仗");
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
        "燕家堡——燕家经营数代的大堡，夺宝大会宾客如云，堡墙旌旗猎猎，热闹底下却透着说不出的古怪。（这里是燕家，可不是天阙堡——那是更往后的事了。）",
        { shot: "pushIn" },
        "你正随人流入堡，一道熟悉的身影迎面撞来——竟是墨彩环。嘉元城一别，她眉眼间已添了几分风霜。",
        { say: "墨彩环", emo: "cry", text: "韩大哥……真的是你！娘的旧疾要一味『萦香丸』，听说燕家大会上有——我便随商队来了。你……你也来赴会？这回，可别又把人丢下不管。" },
        { sfx: "sword" },
        { shot: "panRight" },
        "校场另一头，一位眉眼高华的红拂座下女修按剑而立，目光在你那柄乌龙夺上停了一瞬——后来你才知她姓董，名萱儿。当年陆云风为攀附的，正是她这条线。",
        { say: "董萱儿", tone: "cold", text: "伪灵根能筑基，倒是稀奇。鬼灵门的人已经进了堡——那位借医病联姻入门的『王少主』，红拂座下档册上可不是善类。活着出了这堡，再论你够不够格同我说话。" },
      ];
      // 钩子：杀陆云风 → 对董萱儿有额外内心
      if (s.flags.luyunfeng_dead) {
        t.push({ aside: "陆云风为攀附她而杀道侣，死在我手里。她不知道那条线的尽头站着一个杀人灭口的小人——如今这把剑，倒在我面前横起来了。" });
      }
      return t;
    },
    onArrive(s) {
      Engine.meetNpc("mocaihuan", "墨大夫之女、嘉元城墨府小姐——为母求药赴燕家夺宝大会，与你重逢。");
      Engine.meetNpc("dongxuaner", "红拂座下名门之后——陆云风当年为攀附她而痛下杀手；燕家堡血夜中与你并肩杀出。");
      State.setFlag("yanjia_reunion_done");
      State.setFlag("mocaihuan_reunion");
      Engine.writeLedger("yanjia_reunion", "燕家堡重逢墨彩环、结识董萱儿——魔道入侵下的故人与名门");
      // 因果联动：坊市归途杀陆云风（luyunfeng_dead）→ 陈家暗中相助
      if (s.flags.luyunfeng_dead || (s.ledger && s.ledger.chen_remember)) {
        // polish-modao B④：文案说递来丹药就真入袋（谎报掉落修）
        State.give("huixue_dan", 1);
        Engine.log("陈家的人也在堡中——为陆云风一事，陈巧倩那一脉暗中给你递来一囊疗伤丹药，未发一言。这份人情，你记下了。（回血丹+1）", "event");
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
        hint: "先保人——铸入心性",
        effect(s) {
          Engine.recordTemperament("yanjia_protect_mocaihuan", "sentiment", "燕家堡血夜·先护墨彩环退到安全处再回身迎敌——刀口之下，你先想着别人");
          return { text: "你没有急着列入战阵——先护住墨彩环退到安全处，再转身面对魔道。", kind: "event" };
        },
        resolve: "advance",
      },
    ],
  },
  /* ---- 增量D·燕家堡·临战三日（侦察玩法：五处可探只够走三处——篇章动词「侦察」落地）
   *  chapter-differentiation §三：这章的自由在"信息收集"。5 选 3 互斥取舍，探得越足决战越有底。
   *  驻留选项（choice.stay）：一张卡内多轮分配——选一处、卡还在、余下的接着选。
   *  兑现：兵器架/药房/墨彩环=即时入袋；望塔/董萱儿=写 ledger→王蝉决战开局兑现（护体/伤害+）。
   *  考据（2026-07-09 勘误后）：王蝉=鬼灵门少主，借为燕家小姐医病联姻入堡、暗布血祭大阵——
   *  危机自堡内起（燕家背叛），非外敌攻城。 ---- */
  {
    id: "yanjia_scout",
    skipIf: (s) => s.flags.yanjia_scout_done,
    cond: (s) => s.flags.yanjia_reunion_done && !s.flags.yanjia_scout_done,
    objTitle: "临会三日 · 堡内侦察",
    objHint: "夺宝大会开阵在即，鬼灵门少主王蝉已借联姻入堡——堡内五处可探，三日只够走三处。探得越足，变起时越有底。",
    title: "燕家堡 · 临会三日",
    text(s) {
      const n = s.flags.yanjia_scout_n || 0;
      if (n === 0) {
        return [
          { scene: "燕家堡 · 堡内" },
          { amb: "wind" },
          "夺宝大会三日后开阵。鬼灵门少主王蝉借着为燕家小姐医病联姻的名头入了堡，燕家上下待他如上宾——可你总觉得，这座堡里的血腥气，一日浓过一日。",
          "三日。武库兵器架、堡中药房、堡墙望塔、按剑而立的董萱儿、安置家眷的墨彩环——五处可探，脚程只够走三处。",
          { aside: "医病联姻？鬼灵门的人做善事，比墨大夫收徒还可疑。多备一分，多活一分——这三日，一步都不能走空。" },
        ];
      }
      const left = 3 - n;
      return [
        `第${["一", "二", "三"][n - 1]}日已过，堡外妖啸又近了几分。${left > 0 ? `你还余${left > 1 ? "两日" : "最后一日"}脚程。` : "三日已尽——该上堡墙了。"}`,
      ];
    },
    choices(s) {
      const n = s.flags.yanjia_scout_n || 0;
      const out = [];
      const mk = (key, text, hint, apply) => {
        if (s.flags["yanjia_scout_" + key]) return;
        out.push({
          text, hint, stay: true,
          effect(st) {
            State.setFlag("yanjia_scout_" + key);
            st.flags.yanjia_scout_n = (st.flags.yanjia_scout_n || 0) + 1;
            return apply(st);
          },
        });
      };
      if (n < 3) {
        mk("arms", "翻检武库兵器架——挑几件称手的应急物", "互斥·得火蛇符与暗器（战中底牌）", () => {
          State.give("huoshe_fu", 1); State.give("anqi", 3);
          return { text: "武库已被搬得半空。你在架底翻出一张火蛇符、三枚淬好的飞针，尽数收进袖里。（火蛇符+1、暗器+3）", kind: "good" };
        });
        mk("meds", "搜罗堡中药房——伤药备足才敢言战", "互斥·得回血丹（战中续命）", () => {
          State.give("huixue_dan", 2);
          return { text: "药房里早没了人影——掌柜收拾细软跑了。你从架上取走两枚回血丹，乱局之中，谁也顾不上谁的银钱。（回血丹+2）", kind: "good" };
        });
        mk("tower", "登堡墙望塔——看熟地形走势", "互斥·决战开局占地形先机（开局护体）", () => {
          Engine.writeLedger("yanjia_scout_tower", "临会登望塔看熟堡墙走势——大阵若起，何处可守、何处可逃、落脚位在哪，尽在胸中");
          return { text: "你在望塔上站了半日：堡墙哪段最薄、瓦砾堆在何处、退路通向哪条巷——尽收眼底。若真变起，这些就是命。", kind: "good" };
        });
        mk("dong", "寻董萱儿——打探王蝉的路数", "互斥·得弱点情报（决战伤害+8%）", () => {
          Engine.writeLedger("yanjia_scout_dong", "向董萱儿打探王蝉路数——血遁突袭之后气门微滞，红拂座下档册里记得明白");
          return { text: "董萱儿斜了你一眼，到底还是开了口：「红拂座下档册记着——鬼灵门那位少主修的是《血灵大法》，血遁突袭之后气门微滞、有半息破绽。接得住，就是你的机会。」", kind: "good" };
        });
        mk("mo", "帮墨彩环安置墨府家眷", "互斥·得养元丹、心境+（她会记得）", (st) => {
          st.mood = Math.min(st.moodMax, st.mood + 6);
          State.give("qingyuan_dan", 2);
          Engine.writeLedger("yanjia_scout_mo", "临战三日帮墨彩环把墨府老小安置进堡心地窖——乱世里的一点人情");
          return { text: "你帮着把墨府老小安置进堡心地窖。墨彩环把仅剩的两枚养元丹塞进你手里：「韩大哥，活着回来。」（养元丹+2，心境+6）", kind: "good" };
        });
      }
      const done = n >= 3;
      out.push({
        text: done ? "三日已尽——赴夺宝大会。" : (n > 0 ? "不再探了——径赴大会。" : "什么都不备——径赴大会。"),
        hint: done ? "大会开阵在即，变数将至" : "余下的机会就此作罢（互斥·过时不候）",
        effect(st) {
          State.setFlag("yanjia_scout_done");
          const got = ["arms", "meds", "tower", "dong", "mo"].filter(k => st.flags["yanjia_scout_" + k]).length;
          return {
            text: got ? `该备的备了，该探的探了（${got}/5 处）。你收拾停当，随人流走向大会会场。` : "你两手空空走向大会会场。艺高，未必胆大到这份上——但事已至此。",
            kind: got ? "event" : "bad",
          };
        },
        next: true,
      });
      return out;
    },
  },
  {
    id: "yanjia_boss",
    cg: "yanjia_xueye",
    skipIf: (s) => s.flags.yanjia_boss_done,
    cond: (s) => s.flags.yanjia_reunion_done && !s.flags.yanjia_boss_done,
    bgm: "boss",
    title: "燕家堡之战 · 血祭大阵",
    text(s) {
      const t = [
        { scene: "燕家堡 · 大会血夜" },
        { amb: "wind" },
        { sfx: "danger" },
        { shot: "shock" },
        { fx: "burst", elem: "huo", n: 18 },
        { sfx: "castHuo" },
        "夺宝大会开阵那一刻，异变陡生——会场四角血光冲天，暗红大阵轰然锁死全场！燕家老祖立于高台之上袖手旁观：燕家，早已举族投了魔道。",
        "阵中七派弟子的灵力精魄被丝丝抽离、成片倒下。血雾深处，那位「医病联姻」的贵客缓步走出，摘下面具的半张脸上笑意森冷——鬼灵门少主，王蝉。",
        { shot: "pushIn" },
        { say: "王蝉", tone: "含笑，笑意冷入骨髓", text: "诸位道友的精血，就都留给本少主的血祭大阵吧。" },
        { say: "董萱儿", tone: "cold", text: "血灵大法！他要血祭全场——韩立，护住人，往阵眼薄处杀！你那柄破甲的钩子，该出鞘了！" },
      ];
      // 钩子：以毒为先 → 对王蝉的判断更务实
      if (s.flags.showdown_prep_poison) {
        t.push({ aside: "诛他？鬼灵门少主岂是今日的你能诛的。撑过他的杀势、护着人活着杀出这座堡——这一战，只为这一个字：活。毒、暗器、乌龙夺——全用上。" });
      } else {
        t.push({ aside: "诛他？鬼灵门少主岂是今日的你能诛的。撑过他的杀势、护着人活着杀出这座堡——这一战，只为这一个字：活。" });
      }
      t.push({ fight: "zhanwangchan_fight", guard: { hint: "破甲的钩子该出鞘了" } });
      return t;
    },
    choices: [
      { text: "御乌龙夺，迎上王蝉！（撑过血线即突围）", resolve: "zhanwangchan_fight" },
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
        "王蝉重伤遁走，血祭大阵随之溃散，可燕家堡已是魔窟——燕家举族投魔，四面火起。幸存的七派修士护着家眷夺路突围，你断后掩护，护着墨彩环、随董萱儿杀出一条血路。",
        "临出堡那一刻，血雾里传来王蝉怨毒的嘶声：「报上名来！」你头也不回，扔下三个字——「厉飞雨。」",
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
        hint: "谨慎——铸入心性",
        effect(s) {
          s.mood = Math.min(s.moodMax, s.mood + 2);
          Engine.recordTemperament("modao_e1_ask_lvtianmeng", "stoic", "入矿道前先向队官多问一句虚实——不打没数的仗，是你保命的老规矩");
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
          // polish-modao B④：谎报掉落修——文案说找到灵矿碎屑就真给（黄枫谷 E① 并案现行犯）
          State.give("lingshi", 2);
          Engine.recordTemperament("modao_e1_extra_search", "stoic", "机缘房里多搜一刻——稳里再抠一分的性子");
          return { text: "你又多翻了几处角落——果然在石室偏壁找到一小摄灵矿碎屑，虽不多，聊胜于无。（灵石+2）", kind: "good" };
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
        hint: "低语——铸入心性",
        effect(s) {
          s.mood = Math.max(0, s.mood - 3);
          Engine.recordTemperament("chen_forgot_murmur", "sentiment", "前线再遇不识你的陈巧倩·对着她的背影低声道了句保重——她忘了，你没忘");
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
        hint: "克制——铸入心性",
        effect(s) {
          Engine.recordTemperament("chen_remember_restrain", "stoic", "陈巧倩仍记挂你·你退一步收下玉瓶——情可以领，界不能越，藏拙守距是你给彼此的护身符");
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
    // polish-modao A1①-4：时锚等待期的自由段收口节点补 where——换防期云游在外者，
    // 金鼓原集结不再在百药园里弹出（天命栏自动缀「去处：魔道前线」，A3 军法申斥同向引导归营）
    where: "modao_front",
    cg: "kuangchang",
    bgm: "tense",
    // polish-modao B⑥：四段时锚里唯一的天命栏黑洞——补双态 objTitle/objHint（倒计时管线同 e1/e3/e4）
    objTitle(s) {
      return State.absMonth() < (s.flags.modao_act2_due || 0) ? "换防休整" : "金鼓原调令";
    },
    objHint(s) {
      const left = (s.flags.modao_act2_due || 0) - State.absMonth();
      return left > 0
        ? `黑风岭矿洞守备换防，这一队征卒暂得喘息——约 ${left} 月后拔往金鼓原前线。趁这几个月安顿修行。`
        : "调令已下——金鼓原前哨集结，七派征军与黑煞教隔原相持，真正的仗要来了。";
    },
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
      // canon-audit M3（2026-07-10 勘正·百科各条）：四人皆李化元门下（刘靖行三/宋蒙行四/武炫行六）；
      // 宋蒙=豪放血性、逢厮杀就兴奋（旧"稳重持珠"写反）；武炫=同门师弟、因董萱儿之故对韩立存了情绪
      "他身后还立着三人：抱臂大笑的宋蒙、叉腰啐声的钟卫娘，与一个年纪轻轻、眼神却不太友善的武炫——细论起来，这几位都是李化元门下，你这记名弟子的同门师兄弟。",
      { say: "钟卫娘", tone: "心直口快", text: "伪灵根？我只问你打不打得过魔修。打得过，就是好同袍——打不过，宋师兄给你收尸！" },
      { say: "宋蒙", tone: "他哈哈一笑，掌心一枚温润圆珠抛了又接", text: "收什么尸！前线天天有仗打，这地方来得太对了——韩师弟，回头遇上魔修，你我比比斩获！痛快！" },
      { say: "武炫", tone: "皮笑肉不笑", text: "师父新收的记名师兄？久仰。……听说连董萱儿师姐都夸过你那柄乌龙夺。呵——巡逻时自己当心，我可顾不上你。" },
      { shot: "pullOut" },
      { aside: "你默默记下这四张脸。藏拙惯了的人，难得在这刀山火海的前线，遇上几个肯把后背交给你的同袍。这份善缘，记账。" },
    ],
    onArrive(s) {
      State.setFlag("modao_e2_muster_done");
      Engine.meetNpc("liujing", "黄枫谷除魔卫道之楷模——金鼓原前哨集结时不轻你伪灵根，反生惜才之意；身负祖传真宝凤凰符。");
      Engine.meetNpc("songmeng", "黄枫谷李化元门下行四的师兄，豪放血性、逢厮杀就眼亮，持护身大件重元珠；与刘靖之间似有一段不便明言的旧渊源。");
      Engine.meetNpc("zhongweiniang", "黄枫谷心直口快的女修，常与宋蒙同行——刀子嘴，倒不是坏心。");
      Engine.meetNpc("wuxuan", "黄枫谷李化元门下行六的师弟，年轻气盛——因董萱儿之故，对你这位记名师兄没什么好脸色。");
      Engine.writeLedger("modao_muster", "金鼓原前哨集结：与李化元门下同门刘靖/宋蒙/钟卫娘/武炫结识，结下并肩同袍之谊（武炫因董萱儿之故对你存着别扭）");
      Engine.addMilestone("魔道争锋·第二幕·启：金鼓原前哨集结，同袍并肩", "story");
      // polish-modao A1④·涟漪①上（Fable P1-7）：厉飞雨背锅风声链——燕家堡报名之债开始发酵（重返天南对质拍的糖·本站只种风声）
      s.worldNews = s.worldNews || [];
      s.worldNews.push({ t: `第${s.year}年${s.month}月`, kind: "rumor", text: "营中风闻：鬼灵门重金悬赏一个叫『厉飞雨』的黄枫谷弟子——可七玄门那位执法堂首座也叫这名，怕是要莫名其妙背一口大锅。" });
      if (s.worldNews.length > 40) s.worldNews.splice(0, s.worldNews.length - 40);
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
        hint: "谦抑——铸入心性",
        effect(s) {
          Engine.recordTemperament("modao_e2_humble", "stoic", "金鼓原集结·同袍面前仍自称『韩某』压低身段——底牌不亮给任何人，是你刻进骨头的习惯");
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
      "随正道大军压上的红拂座下一队，前日在东翼遇袭溃散。门中那位名门之后董萱儿，乱军里失了踪影，据逃回的散卒说，是被一股魔道高手裹挟着，往魔道腹地去了。",
      { aside: "董萱儿。燕家堡那一夜与你并肩御魔、杀出血路的红拂女修。你握剑的手紧了一紧——那夜王蝉重伤遁走，原来这笔账，鬼灵门一直没忘。" },
      // canon M2：被掳动机=解去合欢宗云露老魔处「认亲」（她=红拂与云露的私生女·天生媚体——身世正主）
      { say: "探马", tone: "气喘", text: "……据说，掳她的不是冲着财物，是冲着她这个『人』来的——要解去合欢宗一位姓云的老祖处，说是……『认亲』。具体内情，无人知晓。" },
      { aside: "合欢宗、云露、认亲……她那讳莫如深的身世，与魔道大宗牵着一条什么线？你记下了。前线之大，你眼下救不得她——但这条断线，总有接上的一日。（伏笔归账·再别天南显影）" },
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
        hint: "愤懑——铸入心性",
        effect(s) {
          s.mood = Math.max(0, s.mood - 2);
          Engine.recordTemperament("modao_e2_dongxuaner_rage", "sentiment", "闻董萱儿被掳·攥拳咬牙怒而无力——并肩杀出血路的人被掳走，你咽不下这口气");
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
      { wait: 500 },
      { say: "南宫婉", emo: "smile", tone: "低声，几不可闻", text: "……木头。" },
      { aside: "你没听清那两个字。她已敛了神色，将瓦罐往你这边推了推，转身要走——掩月宗另有调遣，她得回西线去了。" },
      { say: "南宫婉", emo: "cold", text: "栗子给你。——别死在京城。听说你要随征军开赴京城了，那地方水深，比这焦土更杀人。" },
      { shot: "pullOut" },
      { aside: "她白衣一卷，没入营帐间的人流，再没回头。你低头看着掌心那枚渐凉的炒栗子，又看看她留下的半罐——心里某处微微一动，却到底没琢磨明白。仙凡修途各有各的劫，有些情分，你眼下还接不住，也辨不清。（正宫线·留白·此生缓续）" },
    ],
    onArrive(s) {
      State.setFlag("modao_e2_nangongwan_done");
      State.setFlag("nangongwan_jingcheng_farewell");   // 正宫线·金鼓原一别（fate 正宫线窗口）
      // polish-huangfeng P0-3（Fable）：血色之夜的账在此结——正宫线之根不再是哑账
      Engine.settleLedger("mojiao_oath", "血潭一别、金鼓原重逢——「立碑的立」她果然记到了今日。那句『此生不得对第三人提起』谁都没破，可这枚炒栗子，就是提起");
      Engine.writeLedger("nangongwan_chestnut", "金鼓原营侧重逢南宫婉——她含栗吃醋、旁敲侧击你与黄枫谷女修的传闻，你木讷未解；她留半罐炒栗、叮嘱『别死在京城』，转身赴西线");
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
        hint: "回关——铸入心性",
        effect(s) {
          s.mood = Math.min(s.moodMax, s.mood + 3);
          Engine.recordTemperament("nangongwan_reciprocal", "sentiment", "金鼓原一别·罕见地回了南宫婉一句『道友也保重』——木讷如你，这一句已是掏心");
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
    cg: "kuangchang",   // polish-modao E池：原复用七玄门离乡 CG（departure=少年离家）画面错位——换前线拔营（矿场地表）
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
        hint: "警醒——铸入心性",
        effect(s) {
          s.mood = Math.max(0, s.mood - 1);
          Engine.recordTemperament("modao_e2_jingcheng_alert", "stoic", "拔营赴京·别人看繁华你先看水深——「别死在京城」这句叮嘱，你揣着上路");
          return { text: "你没有因为拔营而松懈——南宫婉那句「别死在京城」，你记着。", kind: "event" };
        },
        resolve: "advance",
      },
    ],
  },

  /* —— polish-modao D7（GPT P1-3 + Fable P2-1）：二/三幕间·京城拍卖会重逢齐云霄 ——
   * 补设计稿承诺（modao-design §第二幕幕间"拍卖会救齐云霄→阵图加强完整版"）：
   * ①wuxing_zhen 基础版全章零读点→此节点升级完整版（wuxing_zhen_full），startXuwangFight 读 flag
   *   裁剪六相（无完整版=万象星河凝不出·准备的差距被看见）；②灭付家暗线起点（元婴远线）——
   *   ⚠ ledger id 用 fujia_grudge_start：fujia_grudge 已被再别天南「齐云霄之死=付家所害」占用
   *   （story 齐云霄死讯节点），两账同链不同拍——拍卖会结怨=因，之死=果，重返天南篇总清算。
   * 演出从简（无 CG·场景字幕+对话）；抵京当日、入京安顿（modao_e3_rujing）之前。 */
  {
    id: "modao_qiyunxiao",
    skipIf: (s) => s.flags.modao_qiyunxiao_done,
    cond: (s) => s.flags.modao_act2_done && !s.flags.modao_qiyunxiao_done && !s.flags.modao_e3_rujing_done
      && State.absMonth() >= (s.flags.modao_act3_due || 0),
    bgm: "town",
    title: "京城 · 万宝拍卖会",
    text: [
      { scene: "胥国京城 · 万宝拍卖行外" },
      { amb: "market" },
      { shot: "establish" },
      "大军抵京、各营分驻安顿的当口，你信步经过京城万宝拍卖行——战争潮里天下奇珍都往这座金粉之城汇聚，拍卖行门前车马塞街。人群里，一个熟悉的赭褐色身影正被三名锦服修士堵在廊柱下。",
      { shot: "pushIn" },
      "是齐云霄。元武国百艺坊那位一炉好风火的巧匠——他携看家的炉艺图卷来京城大拍会寻好料，却被元武国付家的强人盯上了：三人围着他，皮笑肉不笑，话里话外要他「奉图入府、专为付家开炉」，那卷图卷已被为首者捏在手里掂来掂去。",
      { say: "齐云霄", tone: "梗着脖子，指节发白", text: "百艺坊的炉子，只认料、不认主！这图是我吃饭的家伙——付家好大的脸面，强买强卖买到京城来了！" },
      { aside: "为首那名付家供奉修为不过练气大圆满，仗的是付家在元武国只手遮天的势。齐云霄一介凡体匠人，眼看要吃大亏——这一炉好风火，替你炼过乌龙夺、裁过神风舟的帆。" },
    ],
    onArrive(s) {
      State.setFlag("modao_qiyunxiao_done");
      State.setFlag("wuxing_zhen_full");
      if (State.count("wuxing_zhen") < 1) State.give("wuxing_zhen", 1);   // 稳妥：基础版阵图缺则补（代工线漏网档）
      Engine.meetNpc("qiyunxiao", "元武国百艺坊的巧匠——京城拍卖会上被付家强人所迫，得你解围，以完整版颠倒五行阵图相谢。");
      Engine.writeLedger("fujia_grudge_start", "京城拍卖会解围齐云霄——元武国付家强人强买其炉艺图卷，被你搅了局。付家的跋扈你记下了（远线·此怨自此结下：他日重返天南，连本带利一并清算）");
      Engine.addMilestone("京城拍卖会：重逢齐云霄，得完整版颠倒五行阵图", "story");
      if (typeof Sfx !== "undefined") Sfx.play("chime");
    },
    choices: [
      {
        text: "跨步而出，筑基威压当头压下——「放手。」",
        hint: "出手震慑——以力断事，付家的脸面不值一文（——铸入心性）",
        effect(s) {
          Engine.recordTemperament("modao_qiyunxiao_stoic", "stoic", "京城拍卖会——筑基威压慑退付家强人，一个字都懒得多说");
          return { text: "你一步跨出，筑基修士的威压毫不遮掩地罩下——三名付家强人脸色霎时惨白，图卷脱手落地，讪讪抱拳退走。为首者临去回头看了你一眼，把你的脸记下了。齐云霄拾起图卷拍拍灰，咧嘴一笑：「痛快！韩道友，这份情百艺坊记下了——」他从怀里取出一卷以朱砂密绘的图轴塞进你手里：「颠倒五行阵的完整版补全图。燕家堡给你的那卷基础版只得其形，配上这卷，六行归一的『万象星河』才凝得出来。拿去，别客气——你我这是第二桩买卖了。」", kind: "good" };
        },
        resolve: "advance",
      },
      {
        text: "挤进人群打圆场，暗中递灵石平了这桩事。",
        hint: "花灵石平事——和气收场，给故人留个体面（灵石-5·——铸入心性）",
        effect(s) {
          const cost = Math.min(5, State.count("lingshi"));
          if (cost > 0) State.take("lingshi", cost);
          Engine.recordTemperament("modao_qiyunxiao_sentiment", "sentiment", "京城拍卖会——破财替故人平事，给齐云霄留足体面");
          return { text: `你挤进人群拱手打个圆场，袖底不动声色递过${cost > 0 ? `一小袋灵石（-${cost}）` : "几件不起眼的战利小物"}——「几位道友，行个方便，这位匠师与在下有旧。」付家强人掂了掂分量，冷哼一声抱拳走了。齐云霄面色涨红：「让韩道友破费……不成，这情得还！」他执意把一卷朱砂密绘的图轴塞进你手里：「颠倒五行阵的完整版补全图。燕家堡那卷基础版只得其形，配上这卷，六行归一的『万象星河』才凝得出来——这才对得起你那袋灵石！」`, kind: "good" };
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
    // polish-modao A1①-4：赴京从前线大营开拔（随征军入京）——等待期云游在外者，天命栏缀「去处：魔道前线」
    where: "modao_front",
    cg: "jingcheng",
    bgm: "town",
    title: "京城 · 天子脚下",
    objTitle: "入京 · 李化元所托",
    objHint: "李化元亲派之任：赴京护持秦家（秦家先祖=其师兄·累世照拂）——天子脚下，暗流将起。",
    // canon-audit M5（2026-07-10 勘正·百科李化元/秦言条+jpbeta 30集）：入京=李化元亲自派任务护秦家，非泛泛"随征军抽调"
    text: [
      { scene: "胥国京城 · 朱雀长街" },
      { amb: "market" },
      { shot: "establish" },
      "临行前李化元亲自寻你交代了一桩私事：京城秦家的先祖，是他早年的同门师兄——两家累世照拂的情分，如今秦家有难处，托你入京护持一二。「黄枫谷欠秦家的，你替老夫还上这一程。」",
      "金粉楼台，车马如流。随征军一路开抵京城，焦土的血腥气还没散尽，眼前已是天下最繁华的金粉之地。你这等外来的筑基修士，在京城权贵眼里，不过是又一个被征调来听用的『客卿』——只有你自己知道，袖中还揣着大长老那封亲笔荐书。",
      "长街拐角，一个挎着花篮的小姑娘脆生生地拦住你，篮里的栀子开得正好。",
      { shot: "pushIn" },
      { say: "萧翠儿", emo: "smile", text: "这位公子，买朵花吧？今早现摘的，可新鲜啦——戴在身上，京城的晦气都冲散咯！" },
      { aside: "小姑娘叫萧翠儿，跟相依为命的萧爷爷住在巷尾。她眼睛亮得很，三两句就看出你不是寻常人——却也不怕，只当是桩新鲜事。市井的暖意，是这冷硬京城里难得的一点人气。" },
      { say: "萧翠儿", tone: "歪着头，忽然认真", text: "公子……我听说有种神仙，能不老不死。像我爷爷那样的普通人，是不是这辈子，都没那个福气呀？" },
      { aside: "你怔了一下。这问题，你在嘉元城墨府里、被另一个古灵精怪的小姑娘问过一模一样的一句——你那时答不上来，此刻依旧。仙凡之间那道沟，不是一句话填得平的。" },
      { scene: "秦府 · 客卿门第" },
      { shot: "establish" },
      "你持李化元的亲笔荐书入秦府做客卿。那看门的老门房替你引路，一路点头哈腰、堆着笑脸，絮絮叨叨说着府里的体面、修仙老爷的神通——说着说着，那张笑脸却忽然皱起来，浑浊的老眼里滚下泪来。",
      { shot: "pushIn" },
      { say: "秦府老门房", tone: "抹着眼角，自己也不好意思", text: "公子莫笑……老汉是欢喜的。能伺候上仙长这样的贵人，是几辈子修来的福分……可一想，老汉这把骨头，到底是凡胎，眼睁睁看着儿孙也都是凡胎，熬不过这几十年的命……就，就忍不住……" },
      { aside: "他笑着笑着就哭了。你站在朱门之下，第一次这样近地，从一个凡人的眼睛里，看见『修仙者』四个字落在尘世里的分量——是仰望，是欢喜，也是一道永远跨不过去的、无声的悲凉。" },
    ],
    onArrive(s) {
      State.setFlag("modao_e3_rujing_done");
      // polish-modao A1①（Fable P0-1）：京城真地点——人到京城，地也到京城（主界面/底图/行动随之切京城客居；
      // 离京无需手动迁出：zaibie_open 的 Chapters.enter("zaibie") 落 jiayuan_city）
      s.location = "jingcheng_ke";
      Engine.meetNpc("xiaocui", "京城市井卖花的小姑娘，聪慧伶俐——她问了你那个墨彩环问过的问题：凡人，是不是没福气修仙。");
      Engine.writeLedger("modao_rujing", "受李化元亲托入京护持秦家（秦家先祖=其师兄·累世照拂）、持荐书入秦府做客卿——市井偶遇萧翠儿爷孙，秦府老门房『笑着笑着就哭了』：头一回从凡人眼里看清『修仙者』落在尘世的分量");
      Engine.addMilestone("魔道争锋·第三幕·京城暗流：入京（萧翠儿·秦府门房哭戏）", "story");
      // polish-modao A1④·涟漪①下（Fable P1-7）：厉飞雨背锅风声链·笑点收拍——重返天南对质拍的糖（跨站立案见 polish-modao C 组）
      s.worldNews = s.worldNews || [];
      s.worldNews.push({ t: `第${s.year}年${s.month}月`, kind: "rumor", text: "天南来的行脚修士笑谈：彩霞山那位厉首座近来托人四处带话——「哪个王八蛋用老子的名字在外面结仇？！」听说鬼灵门的悬赏客都摸到七玄门山门口了。" });
      if (s.worldNews.length > 40) s.worldNews.splice(0, s.worldNews.length - 40);
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
        hint: "温言——铸入心性",
        effect(s) {
          s.mood = Math.min(s.moodMax, s.mood + 2);
          Engine.recordTemperament("modao_e3_comfort_doorkeeper", "sentiment", "秦府朱门下·多停一步宽慰哭了的老门房——仙凡有别，善意没有别");
          return { text: "你多停了一步，宽慰了那老门房两句——他抹了抹眼角，笑了，说“公子心善”。", kind: "event" };
        },
        resolve: "advance",
      },
    ],
  },
  /* ---- polish-modao B1+B2（双审 P0 同锚·2026-07-12）：京城查案重做——
   *  一次性三选一 → choice.stay 多轮侦察（模板照抄 yanjia_scout）。三条线可反复投入攒 jingcheng_intel（上限3）：
   *  ①蒙山五友门路（灵石8/次·不耗月）②茶楼蹲点（耗1月·免费·40%额外风味见闻）③翠儿追踪（耗1月·免费·首次触发翠儿小拍）。
   *  收网随时可走（intel≥1 才亮·hint 写明档位效果）；intel=0 只能硬闯（决战开局吃亏）。
   *  读点兑现（engine 侧）：≥1=santuan 开局我方全体护体 / ≥2=刘靖示警改命线（原读点不动）/
   *  =3=胥王决战开局敌破绽一拍 / =0=santuan 敌先手一拍（开局气血-8%）——「情报量决定皇宫决战难度」自此成真。 ---- */
  {
    id: "modao_e3_shizong",
    skipIf: (s) => s.flags.modao_e3_shizong_done,
    cond: (s) => s.flags.modao_e3_rujing_done && !s.flags.modao_e3_shizong_done,
    cg: "jingcheng",
    bgm: "tense",
    title: "京城 · 连环失踪案",
    objTitle: "查案",
    objHint: "京城散修接连失踪——三条线可反复投入：蒙山五友的门路（花灵石·快）、茶楼蹲点（耗月）、顺翠儿的线追踪（耗月）。情报越足，皇宫决战越有把握；何时收网，你说了算。",
    text(s) {
      if (!s.flags.modao_e3_shizong_seen) {
        return [
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
          { aside: "翠儿的爷爷，也卷进了这桩连环失踪案。线索千头万绪：蒙山五友手里的门路要花灵石、茶楼蹲点与翠儿追踪要花工夫。怎么查、查到几分再动手，是你的事——查得越透，等真捣了贼窝，胜算越大。" },
        ];
      }
      const intel = s.flags.jingcheng_intel || 0;
      const tier = [
        "贼窝的虚实，眼下还是一团迷雾。",
        "你摸到了贼窝的大致方位——可暗处还有看不真切的东西。",
        "各坊失踪者的时辰路径、煞气流向已尽在胸中——只差最后一层窗户纸。",
        "虚实尽在掌握——连那尊从不露面的『教主真身』，都被你蹲了出来。",
      ][Math.min(3, intel)];
      return [`查案还在继续。${tier}（情报 ${intel}/3）`];
    },
    onArrive(s) {
      if (s.flags.modao_e3_shizong_seen) return;
      State.setFlag("modao_e3_shizong_seen");
      Engine.meetNpc("mengshan_wuyou", "京城讨生活的五个散修，结义抱团、消息灵通——连环失踪案里最肯透底的线人。");
      Engine.writeLedger("modao_shizong", "京城连环失踪案浮出：散修接连被『怪物』掳走，手法不像魔道作风；结识蒙山五友、萧翠儿爷爷亦遭掳——查案情报量将决定皇宫决战难度");
      Engine.addMilestone("魔道争锋·第三幕：连环失踪案（蒙山五友登场·翠儿求救）", "story");
      if (typeof Sfx !== "undefined") Sfx.play("danger");
    },
    choices(s) {
      const intel = s.flags.jingcheng_intel || 0;
      const out = [];
      if (intel < 3) {
        if (State.count("lingshi") >= 8) {
          out.push({
            text: "花灵石买蒙山五友的门路（灵石8）",
            hint: "地头蛇的消息不便宜，胜在快——不耗月（情报+1）",
            stay: true,
            effect(st) {
              State.take("lingshi", 8);
              st.flags.jingcheng_intel = (st.flags.jingcheng_intel || 0) + 1;
              return { text: "你把八枚灵石推过桌面。蒙山五友对视一眼，为首的把声音压得更低——加密的茶话、各坊失踪者的名册、煞气流向的蛛丝马迹，一样样摆到你面前。地头蛇的门路，果然值这个价（情报+1）。", kind: "good" };
            },
          });
        } else {
          out.push({
            text: "花灵石买蒙山五友的门路（灵石不足）",
            hint: "囊中羞涩——先去前线巡逻挣军功、或回黄枫谷变现，再来买这份门路",
            stay: true,
            effect() {
              return { text: "你摸了摸储物袋——凑不齐八枚灵石。蒙山五友倒不催：「道友什么时候凑齐了，什么时候来。消息又跑不了。」", kind: "event" };
            },
          });
        }
        out.push({
          text: "亲自蹲茶楼——守着消息的集散（耗1月）",
          hint: "不花钱，花工夫——以神识窃听加密茶话（情报+1）",
          stay: true,
          effect(st) {
            Engine.passTime(1);
            st.flags.jingcheng_intel = (st.flags.jingcheng_intel || 0) + 1;
            let extra = "";
            if (Math.random() < 0.4) {
              const bits = [
                "【茶楼风闻】馨王府又进了一批西域舞姬，王爷近来夜夜笙歌——仗打到金鼓原，权贵的日子照旧。",
                "【茶楼风闻】北城米价一月里翻了三成，茶客骂声不绝——战事一起，最先挨饿的从来是凡人。",
                "【茶楼风闻】有茶客赌咒发誓半夜见过屋脊上立着个『纸人』，一眨眼就没了——满座笑他失心疯，你却默默多记了一笔。",
              ];
              st.worldNews = st.worldNews || [];
              st.worldNews.push({ t: `第${st.year}年${st.month}月`, kind: "rumor", text: bits[Math.floor(Math.random() * bits.length)] });
              if (st.worldNews.length > 40) st.worldNews.splice(0, st.worldNews.length - 40);
              extra = "顺带还听来一耳朵市井闲谈，记进了风云录。";
            }
            return { text: "你在茶楼雅座泡了一个月，以神识细细过滤南来北往的闲话——几条对得上失踪案的线头，被你从满楼喧嚣里一根根拣了出来（情报+1）。" + extra, kind: "good" };
          },
        });
        out.push({
          text: "顺着翠儿的线追踪（耗1月）",
          hint: "小姑娘眼睛亮、巷子熟——顺藤摸瓜（情报+1）",
          stay: true,
          effect(st) {
            Engine.passTime(1);
            st.flags.jingcheng_intel = (st.flags.jingcheng_intel || 0) + 1;
            if (!st.flags.jingcheng_cuier_track) {
              State.setFlag("jingcheng_cuier_track");
              return { text: "翠儿带你把爷爷失踪前走过的巷子一条条认过去。走到巷尾药铺她忽然停住：「爷爷的咳疾一入冬就重，他自己不肯花钱抓药，说要把钱给我留着买花种……」她仰起头，眼睛红红的，「公子，爷爷要是回不来，这些巷子我认得再熟，又有什么用呀。」你一时无话——凡人的一辈子，就系在这几条巷子里（情报+1）。", kind: "good" };
            }
            return { text: "翠儿又领着你钻了一个月的巷子——失踪者最后现身的地点被你们一处处串起来，煞气的来路渐渐收拢（情报+1）。", kind: "good" };
          },
        });
      }
      if (intel >= 1) {
        const eff = ["", "我方开局有备（全体护体）", "开局有备＋『教主真身』线报（决战或能救同袍一命）", "开局有备＋线报＋贼首开局破绽（虚实尽知）"][Math.min(3, intel)];
        out.push({
          text: "收网——动身端了贼窝。",
          hint: `以当前情报动身（${intel}/3 档）：${eff}`,
          effect(st) {
            State.setFlag("modao_e3_shizong_done");
            if (intel >= 2) {
              st.worldNews = st.worldNews || [];
              st.worldNews.push({ t: `第${st.year}年${st.month}月`, kind: "rumor", text: "【线报】黑煞教真正的杀招藏在暗处：台面上行走的那尊『黑煞教主』竟非本体，不过是一具身外化身——真教主从不露面，惯伪作无害凡人、混在人前伺机暴起。皇宫决战，须防这一手阴的（风云录可复看）。" });
              if (st.worldNews.length > 40) st.worldNews.splice(0, st.worldNews.length - 40);
            }
            const txt = [
              "",
              "线索只摸到个大致方位，你却已按捺不住——贼窝的门朝哪边开，知道了。剩下的，进去再说（情报 1/3）。",
              "各坊失踪者的时辰路径、煞气流向尽数摸清。更紧要的是，你从一条加密茶话里抠出一桩隐秘：台面上那尊『黑煞教主』只是一具化身，真教主从不露面、惯伪作凡人潜伏（情报 2/3；『教主真身』线报已记入风云录）。",
              "加密茶话、名册路径、煞气流向，连贼首藏起来的后手都被你蹲了出来——虚实尽在胸中。此去不是闯贼窝，是猎人进了自家猎场（情报 3/3；『教主真身』线报已记入风云录）。",
            ][Math.min(3, intel)];
            return { text: txt, kind: "good" };
          },
          resolve: "advance",
        });
      } else {
        out.push({
          text: "不查了——循着煞气直捣黄龙（硬闯）",
          hint: "快是快——贼窝里藏了多少爪牙、布了什么后手，你一概不知（决战开局吃亏）",
          effect(st) {
            State.setFlag("modao_e3_shizong_done");
            return { text: "你按捺不住，循着隐约的血煞之气径直追下去——快是快，可贼窝里藏了多少爪牙、布了什么后手，你一概不知（情报 0/3）。", kind: "bad" };
          },
          resolve: "advance",
        });
      }
      return out;
    },
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
        hint: "稳进——铸入心性",
        effect(s) {
          Engine.recordTemperament("modao_e3_cautious_revenge", "stoic", "劝墨彩环缓一步·先摸清五色门虚实再收血债——仇要收，命更要留着收仇");
          return { text: "你按住她的急切——仇要收，但不能莽撞。先摸清五色门的虚实，再动手不迟。", kind: "event" };
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
      { amb: null },
      { wait: 600 },
      { aside: "你转身离去，晨光把两个人的影子拉得很长。这一别，她没有遗憾，你也没有。仙途漫漫，曾有人与你并肩收过一桩血债，又笑着放你远行——这便已是难得。" },
    ],
    onArrive(s) {
      State.setFlag("modao_e3_farewell_done");
      State.setFlag("modao_act3_done");
      // 远雷·燕家堡重逢兑现（铁律3）：燕家堡那场重逢结下的故人之缘，在京城长街走到了无憾的尽头
      Engine.settleLedger("yanjia_reunion", "燕家堡火光里重逢的墨彩环，一路从魔道入侵走到京城血夜——今日长街晨别，她放下血仇、卸了易容，循父亲的医道为自己而活。当年那场乱世重逢，到底有了个不遗憾的收梢");
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
    // polish-modao A1①-4：第四幕自由段收口——皇宫夜袭从京城客居出发（等待期离京者，天命栏缀「去处：越京·秦府客居」）
    where: "jingcheng_ke",
    cg: "jingcheng",
    bgm: "tense",
    title: "皇宫决战 · 审讯与集结",
    objTitle: "夜闯皇城",
    objHint: "黑煞教老巢现形于皇宫地底——传讯黄枫谷，九筑基夜闯皇城。",
    text(s) {
      const t = [
        { scene: "京城 · 暗夜" },
        { shot: "establish" },
        "墨彩环走后不过一月，京城连环失踪案的最后一根线，被你攥到了手里。你以幻色眼的迷幻术撬开了越国小王爷的嘴——血池、煞气、失踪的散修，桩桩件件背后那只手，竟一路指向了京城最不该指向的地方：皇宫。",
        { aside: "黑煞教的老巢，就在越国皇城最底下。贼首豢养血侍、掳人炼煞，把一国之都经营成了吞人的血窟。这等魔窟，凭你一人闯不得——你修书一封，急传黄枫谷。" },
        "三日后，黄枫谷的师兄弟星夜赶到：刘靖、宋蒙、钟卫娘……连同闻讯赶来的几派同道，凑足了九名筑基修士。月黑风高，众人立在皇城根下，刀剑入鞘、灵光内敛。",
      ];
      // polish-modao C1（Fable P1-1）：陈巧倩集结点名——她不再凭空出现在终结拍（读 chen_wangchen 分 forgot/remember 双版）
      if (s.ledger && s.ledger.chen_wangchen) {
        t.push({ aside: "赶来的同道里，押丹药的那位陈姓女修也在——她不认得你，却认得魔道的血债。清点符宝时，她那柄赤虹剑，正横在你身侧不远。" });
      } else {
        t.push({ aside: "赶来的同道里，还有一张你认得的脸——陈巧倩。她隔着人群看了你一眼，欲言又止，终究只是握紧了怀中那柄赤虹剑，站进了战阵。" });
      }
      t.push(
        // canon M4：武炫命途收口（前哨）——未随剿黑煞教：他在京郊失了踪，掳人手法与连环失踪案如出一辙
        { say: "钟卫娘", tone: "她压着嗓子，眉头拧紧", text: "……武炫师弟没到。他前日在京郊访友，人就没了——手法跟城里那些失踪案一模一样。宋师兄，他不会是……" },
        { aside: "武炫。那个横竖看你不顺眼、斗法却嗷嗷卖力的师弟。你心头一沉：黑煞教掳修士炼煞——但愿今夜掀了这魔窟，还来得及。" },
        { say: "刘靖", tone: "他一身正气，遥望那座吞了无数性命的皇城", text: "黑煞教以一国之都为炉、炼人煞为丹，天理难容。今夜，我辈便替这京城、替那些活不见人的散修，把这魔窟，掀了！" },
        { say: "钟卫娘", emo: "angry", text: "早憋着这口气了！宋师兄你别拦我——今夜我非把那帮役尸的玩意儿挨个收拾了不可！" },
        { say: "宋蒙", tone: "他掂着掌心温润的重元珠，眼里战意灼灼", text: "掀魔窟这等痛快买卖，怎能少了宋某！——都护住彼此侧翼，进去放开了打。韩师弟，你心细，替大伙盯着点暗处。" },
        { aside: "九道身影没入夜色，直扑皇城。一场决定京城气运的大战，自皇宫大门轰然洞开的那一刻，开始了。" },
      );
      return t;
    },
    onArrive(s) {
      State.setFlag("modao_e4_shenxun_done");
      Engine.meetNpc("liujing", "皇宫决战并肩的黄枫谷师兄——除魔卫道之楷模，身负祖传真宝凤凰符。");
      Engine.meetNpc("songmeng", "黄枫谷持重元珠的稳重师兄，护中后压、替同袍挡刀。");
      Engine.meetNpc("zhongweiniang", "黄枫谷心直口快的女修，急性子游火、抢攻收割。");
      Engine.writeLedger("wuxuan_missing", "夜闯皇城前夕——武炫师弟在京郊失踪，手法与连环失踪案如出一辙（黑煞教掳修炼煞）。这条命，须在皇宫里找答案。");
      Engine.writeLedger("modao_e4_shenxun", "幻色眼审出黑煞教老巢＝越国皇宫地底血窟——传讯黄枫谷，刘靖/宋蒙/钟卫娘等九名筑基修士星夜集结、夜闯皇城（武炫失踪在前·魔道争锋第四幕·黑煞覆灭开幕）");
      Engine.addMilestone("魔道争锋·第四幕开幕：审出老巢、九筑基夜闯皇城", "story");
      if (typeof Sfx !== "undefined") Sfx.play("danger");
    },
    choices: [
      // polish-modao D8（Fable P1-10）：两选项各有真代价——一鼓作气=扣血换开局剑势；稳进=回满血但暗哨传警（敌开局小增益）
      {
        text: "「一鼓作气——直扑皇城！」",
        hint: "气势如虹——气血略亏，但挟势破门（决战开局剑势+1）",
        effect(s) {
          s.hp = Math.max(1, Math.floor(s.hp * 0.92));
          s.mood = Math.min(s.moodMax, s.mood + 3);
          State.setFlag("modao_e4_rush");
          return { text: "九道灵光如利剑破夜，直扑皇城——气势如虹，纵然气血略亏，这股势头，进宫门那一刻用得上。", kind: "event" };
        },
        resolve: "advance",
      },
      {
        text: "「稳进——先探虚实，再动手。」",
        hint: "稳扎稳打——气血充盈，可多耗的时辰会让暗哨递出警讯（敌方开局有备）",
        effect(s) {
          s.hp = s.hpMax;
          State.setFlag("modao_e4_steady");
          return { text: "你压住众人的锐气，先行探路——皇城根下的暗哨被一一拔除，气血充盈。可到底慢了半步：有一缕血煞讯号，先一步递进了宫里。", kind: "event" };
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
      { aside: "刘靖当锋斩斧奴、宋蒙持珠压刺奴、钟卫娘游火斗链奴——血池深处又爬出一头通体玄冰的冰妖，刘靖指名交给了你。这是九筑基夜闯皇城的开幕，也是你头一回以『群阵』之姿与同袍同场冲杀——先了结当面的冰妖，再看哪条线告急、战中下简令交叉支援。" },
      // D1-a 终止拍：落幕直接坠入三组对位群架
      { fight: "santuan_fight" },
    ],
    choices: [
      { text: "「列阵——杀开一条道！」", hint: "韩立对冰妖＋刘靖/宋蒙/钟卫娘各缠血侍（四线群架），可交叉支援", resolve: "santuan_fight" },
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
      { aside: "凤凰符化作一只赤金火凰，长唳一声、俯冲而下——扑上来的几名血侍连惨叫都未及发出，便被真火焚成了灰烬！正道楷模的这一手高光，惊得满殿血煞为之一滞。" },
      { wait: 300 },
      // canon B14（ep41~42）：凤凰符焚灭的血侍里有旧敌具名——青纹入教为侍，太南小会与万小山两笔旧账就地清结
      { aside: "火凰掠过之处，一名血侍的蒙面巾被真火燎落——那张山羊胡的脸，你认得。太南小会上那个说『会再见的』的青纹道人。他果然与你『再见』了：入了黑煞教、炼成了血侍，又在凤凰真火里烧成了灰。可你心里，却莫名升起一丝寒意：这贼首，未免太『沉得住气』了。" },
    ],
    onArrive(s) {
      State.setFlag("modao_e4_dive_done");
      Engine.writeLedger("modao_e4_dive", "三组同袍杀至皇宫最底·血池大殿——越国之主胥王『恭候』；刘靖祭出祖传凤凰符，赤金火凰一击焚尽数名血侍（正道楷模高光）");
      Engine.addMilestone("皇宫决战：杀至血池大殿，越国之主胥王现身、刘靖凤凰符大放异彩", "showdown");
      // 远雷清结（canon：青纹=当年杀万小山后遁走的第三名散修，逃后入黑煞教为血侍——两笔账同一人）
      Engine.settleLedger("qingwen_grudge", "太南小会上那句「会再见的」应验了——青纹道人入黑煞教炼成血侍，在血池大殿被刘靖的凤凰真火焚成灰烬。这笔黑手的账，火凰替你收了");
      Engine.settleLedger("sanxiu_escaped", "焚成灰烬的血侍里还有一张年轻的脸——当年杀万小山后遁走的第三名散修。原来他逃出你的刀口后，也被黑煞教收进血池炼成了血侍。万小山这条命的最后一笔账，今日在凤凰真火里烧清了");
      if (typeof Sfx !== "undefined") Sfx.play("danger");
    },
    choices: [
      {
        text: "「……太沉得住气了。」心生警觉，暗中戒备。",
        hint: "暗中戒备——铸入心性",
        effect(s) {
          Engine.recordTemperament("modao_e4_alert", "stoic", "血池大殿·察觉胥王沉得过分·暗自凝力戒备——多疑自持，是你活下来的本能");
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
    // 刘靖之命·示警分支（live）：唯前期京城情报拉满（jingcheng_intel>=2，挖到「教主真身」线报）者触发。
    // skipIf 在「未挖到线报」时跳过本节点 → 落到下一个 die 节点（checkStory 语义：false cond 会阻塞，故必须用 skipIf 跳）。
    // canon 追认②（2026-07-10 用户拍板恢复双体制）：偷袭刘靖的=越皇本体（真教主）；台面教主=其身外化身——"第五血侍"自造术语删除。
    id: "modao_e4_liujing_live",
    skipIf: (s) => s.flags.modao_e4_liujing_done || !(s.flags.jingcheng_intel >= 2),
    cond: (s) => s.flags.modao_e4_dive_done && s.flags.jingcheng_intel >= 2,
    cg: "xuechi_dian",
    bgm: "tense",
    title: "皇宫决战 · 阴手·示警",
    objTitle: "喝破伏兵",
    objHint: "你前期挣到的『教主真身』线报，此刻或能救刘靖一命。",
    text: [
      { scene: "皇宫 · 血池大殿" },
      "就在凤凰符的赤金火光最盛、所有人的目光都被它吸住的刹那——你脑中那条重金买来的线报，骤然炸响：『台面上的黑煞教主只是化身，真教主从不露面，惯伪作无害凡人、混在人前伺机暴起……』",
      { aside: "你猛地看向那位『温煦无害』的越国之主——他袖中，一缕几不可察的血煞，正悄然凝向刘靖的后心！从不露面的教主真身，从来就不是别人——就是他！" },
      { cam: "zoom", scale: 1.16, ms: 240 },
      { sfx: "danger" },
      { say: "韩立", emo: "shout", tone: "你想都没想，厉喝出声", text: "刘师兄当心后心——那越皇才是教主真身！" },
      { aside: "刘靖久经沙场，闻声不及回头，本能地侧身一拧——那道本要贯穿心脉的血煞阴手，堪堪偏开寸许、自他左肩透出！刘靖闷哼一声、单膝跪地，凤凰符的火光骤然黯了下去，可那条命，到底是保住了。" },
      { say: "刘靖", tone: "他捂着血涌的左肩，咬牙回望那道阴手的来处，眼里是劫后的凝重", text: "好险……好阴毒的暗手！韩师弟，若非你这一声……刘某这条命，今日便要交代在这儿了。这份情，记下了。" },
      { aside: "重伤的刘靖被宋蒙一把扶到身后。那条你在京城一步步蹲出来的线报，方才那一瞬，值回了它的每一分本钱。" },
    ],
    onArrive(s) {
      State.setFlag("modao_e4_liujing_done");
      s.flags.liujing_survived = true;
      Engine.writeLedger("modao_liujing_live", "皇宫血池大殿——伪装成越国之主的黑煞教主真身（越皇本体·台面教主实为其身外化身）暗手偷袭刘靖；因韩立前期在京城挣足情报、喝破伏兵，刘靖避开致命一击、重伤退场不死（修#7·示警改命·转机＝挣来）");
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
        hint: "趁势追击——铸入心性",
        effect(s) {
          s.mood = Math.min(s.moodMax, s.mood + 2);
          Engine.recordTemperament("modao_e4_chase", "sentiment", "喝破阴手后拔剑直扑胥王——同袍血未凉，你这口血性压不住");
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
    // polish-modao D4（Fable P1-9）：本章情感最重锤补齐名场面五件套——amb 骤停+白闪+danger 骤响；
    //   教学句移出戏文（onArrive 战后 sys 条目），哀恸拍不再被攻略提示打断。
    text: [
      { scene: "皇宫 · 血池大殿" },
      { amb: null },
      { fx: "flash", color: "#fff", alpha: 0.5, ms: 200 },
      { sfx: "danger" },
      "就在凤凰符的赤金火光最盛、所有人的目光都被它吸住的刹那——那位『温煦无害』的越国之主，袖中骤然探出一缕血煞阴手，悄无声息地，贯入了刘靖的后心！",
      { shot: "pushIn" },
      { wait: 700 },
      { aside: "无人料到这一手。无人来得及喝破。等众人惊觉，那道血煞已自刘靖前胸透出——他低头怔怔看着胸口的血窟，凤凰符的火光，一寸寸地黯了下去。" },
      { say: "刘靖", tone: "他踉跄回身，难以置信地看着那个『一国之君』，嘴角溢出血来", text: "是你……黑煞教主……竟藏在……一国之君的皮囊底下……" },
      { aside: "正道楷模刘靖，一生除魔卫道、行事方正，终究没能防住这藏在『凡人』皮下的最毒一手。他重重倒下，凤凰符失了主人、化作一道赤金流光没入虚空，追之不及。" },
      { say: "钟卫娘", emo: "cry", tone: "她嘶声尖叫，几乎是扑过去的", text: "刘师兄——！！" },
      { wait: 600 },
      { aside: "恭送除魔卫道的正道楷模，刘师兄。" },
    ],
    onArrive(s) {
      State.setFlag("modao_e4_liujing_done");
      s.flags.liujing_dead = true;
      Engine.writeLedger("modao_liujing_die", "皇宫血池大殿——黑煞教主胥王伪装成越国之主、以阴手偷袭，正道楷模刘靖后心中招身陨（命途＝原著默认；玩家前期情报未拉满、未能喝破伏兵）。凤凰符失主、化光遁去");
      Engine.addMilestone("皇宫决战·阴手身陨：恭送正道楷模刘靖", "showdown");
      // D4：教学句出戏文、入见闻（sys）——哀恸归哀恸，攻略归攻略
      Engine.log("（若前期在京城挖到『教主真身伪装凡人』的线报，本可喝破这记阴手、为刘靖挣回一线生机——命途如此，转机要趁早挣。）", "sys");
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
        hint: "强忍悲痛——铸入心性",
        effect(s) {
          s.hp = Math.max(1, Math.floor(s.hp * 0.95));
          Engine.recordTemperament("modao_e4_hold", "stoic", "刘靖倒下的那一刻强压悲愤稳住阵脚——哀恸留给活下来以后，此刻你只许自己清醒");
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
    // canon 追认②（双体制恢复）：越皇=本体·台面「黑煞教主」=其身外化身（兄弟献身所祭·体内血凝五行丹）——
    // 血池养的正是这具化身；此拍=化身归窍、二体合一跃入假丹（战斗仍是单一 boss·平衡不动）
    text: [
      { scene: "皇宫 · 血池大殿" },
      "那位『越国之主』缓缓站起身。他脸上温煦的皮相，正一寸寸剥落、簌簌而下——原来从头到尾，坐在龙椅上的这位，才是黑煞教真正的教主；外间行走的那尊「教主」，不过是他的一具影子。",
      { say: "胥王", tone: "凡人的皮囊褪尽，声音陡然森冷如渊", text: "装了这许多年凡人，也腻了。诸位仙长……可知，寡人这血池，养的是什么？" },
      { fx: "flash", color: "#8a1f1a", alpha: 0.3, ms: 500 },
      "血池轰然炸开——一具与他眉目一般无二的躯壳自赤水中破池而出：那正是外间人人惧称『黑煞教主』的身外化身！化身化作一道血虹，没入他眉心。",
      { aside: "二体合一的刹那，他周身血煞冲天而起、池中赤水尽数倒灌入体！一股远超筑基的恐怖气息轰然炸开——本体携化身之力，竟生生跃入了『假丹』之境，那是寻常筑基修士仰望不及的筑基巅峰！" },
      { shot: "shock" },
      { sfx: "farRoar" },
      { fx: "burst", elem: "huo", n: 16 },
      "假丹之威一压，满殿同袍如坠冰窟。宋蒙的重元珠被震得嗡嗡作响，钟卫娘一口气血上涌，连你也只觉那身木行道基被压得几乎喘不过气。",
      { say: "宋蒙", emo: "shout", tone: "他护住众人，厉声", text: "不是对手——退！韩师弟，你脑子活，想法子拖住他，我们另寻生路！" },
      { aside: "几人且战且退、节节败北。你一边周旋、一边飞快盘算：硬拼必死，可若能拖到师兄妹与那几头傀儡蜥蜴布成阵势……一个疯狂的念头，在你脑中渐渐成形。" },
    ],
    onArrive(s) {
      State.setFlag("modao_e4_xuwang_done");
      State.setFlag("modao_e4_part1_done");
      Engine.meetNpc("xuwang", "黑煞教主真身＝越皇本体——外间行走的『教主』只是他以兄弟献身所祭的身外化身。皇宫决战中化身归窍、二体合一跃入假丹境的魔道巨擘。");
      Engine.writeLedger("modao_e4_xuwang", "皇宫血池大殿——『越国之主』褪去凡人皮囊：越皇=黑煞教主真身，台面上那尊『教主』实为其身外化身（血池所养）。化身归窍、二体合一跃入假丹境；众人不敌、且战且退，韩立谋划拖时布阵（皇宫决战·下篇待续）");
      Engine.addMilestone("魔道争锋·第四幕（上）收束：胥王现身·入假丹·众人且战且退", "showdown");
      s.flags.modao_e4b_due = State.absMonth();   // 下篇时锚（拖时布阵→真·颠倒五行阵→决战·待实装）
      if (typeof Sfx !== "undefined") Sfx.play("danger");
    },
    choices: [
      {
        text: "「拖住他——给师兄妹布阵争时间！」",
        hint: "缠斗拖敌——铸入心性",
        effect(s) {
          Engine.recordTemperament("modao_e4_tangle", "sentiment", "假丹威压下主动缠住胥王为同袍争布阵工夫——最险的位置，你留给了自己");
          return { text: "你咬牙缠住胥王——每多拖一息，师兄妹就多一分布阵的工夫。", kind: "event" };
        },
        resolve: "advance",
      },
      {
        text: "「全力防御——先退再图反制。」",
        hint: "退守保命——铸入心性",
        effect(s) {
          s.hp = s.hpMax;
          s.mood = Math.max(0, s.mood - 3);
          Engine.recordTemperament("modao_e4_defensive", "stoic", "假丹威压下先退守保命再图反制——留得青山，是你在绝境里的第一反应");
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
      // polish-modao C4（Fable P1-4）：傀儡残件的回响——金鼓原缴获在此点名兑现（settle 在 onArrive）
      { aside: "退开的一瞬，你把金鼓原缴获的那捧傀儡残件连同半幅阴纹图纸塞进宋蒙手里：「魔道驱傀的阴纹路数，参照着使——蜥蜴叼旗，稳一分是一分！」宋蒙抓过图纸扫了一眼，眼中精光一闪。" },
      { shot: "focusRight" },
      { sfx: "castTu" },
      // D1-a 终止拍：落幕直接坠入拖时布阵战
      { fight: "tuoshi_fight", guard: { hint: "撑满回合即胜，败有所得" } },
    ],
    onArrive(s) {
      // polish-modao C4：kuilei_canjian 哑账结清——「等着回响」的回响，就是皇宫拖时战的傀儡叼旗
      Engine.settleLedger("modao_patrol_won", "金鼓原缴获的傀儡残件与那半幅阴纹图纸，在皇宫血夜里等到了回响——你把它们交给宋蒙参照御傀，傀儡蜥蜴叼旗镇位、替众人挡下黑血刀。那场练兵的缴获，没有白拿");
    },
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
      "平天尺、重元珠、赤虹剑——你与宋蒙，还有那位自集结夜便按剑随行的陈巧倩，三件符宝齐轰而下，胥王那具假丹肉身轰然崩碎。可血凝五行丹借阵中五行之力，犹自凝起一缕复生神魂，被颠倒五行阵死死镇在原地、寸步难逃。",
      { say: "刘靖", tone: "他按着左肩的伤、剑还握不稳，却把一枚古拙符箓郑重递向钟卫娘", text: "卫娘——刘家祖传的真凰符，一生只可一击。我这身子催不动它了……了结这魔头，托付你了。" },
      { say: "钟卫娘", emo: "shout", tone: "她双手捧符、赤金凰焰冲天而起", text: "真凰符——焚！" },
      { shot: "shock" },
      { fx: "flash", color: "#ffd27a", alpha: 0.5 },
      { fx: "burst", elem: "jinlei", n: 18 },
      { sfx: "success" },
      { aside: "一只赤金火凰自符中振翅而出，长鸣一声，将那缕负隅顽抗的复生神魂连同满殿血煞，尽数吞没、焚作飞灰。胥王、越皇、黑煞教主——这魔道巨擘，终于伏诛。" },
      { shot: "pullOut" },
      // canon M4：武炫之死收口——皇宫密室被吸尽精血（未随剿而先遭毒手）
      { wait: 600 },
      { aside: "清点魔窟时，宋蒙在血池侧殿的一间密室里停住了脚——武炫瘫在锁链间，周身干瘪如枯柴，精血早被吸得一滴不剩。钟卫娘背过身去，肩膀抖了很久。那个横竖看你不顺眼的师弟，终究没等到你们掀了这座魔窟。" },
      { aside: "（彩蛋·刘宋渊源：宋蒙扶住力竭的刘靖，低声道「当年若非令尊援手，我宋家早已……这一符之恩，记下了。」——两家的旧渊源，是后话了。）" },
      { aside: "（战利品入囊：血凝五行丹／玄阴诀／血灵钻／锦帕／玉简／钵盂。）" },
    ],
    onArrive(s) {
      State.setFlag("modao_e4b_finale_done");
      // polish-zaibie B④：黑煞血刃入袋——再别篇"自胥王处所得"的附傀邪宝，缴获点就在这一夜（旧版全库无 give=凭空武装）
      ["xuening_wuxing_dan", "xuanyin_jue", "xueling_zuan", "jinpa_liusong", "yujian_canpian", "boyu_alms", "heisha_xueren"].forEach(k => State.give(k, 1));
      Engine.writeLedger("modao_e4b_finale", "皇宫血池大殿·终结——三符宝（韩立平天尺/宋蒙重元珠/陈巧倩赤虹剑）齐轰毁胥王假丹肉身→血凝五行丹借阵复生神魂→颠倒五行阵镇之、刘靖将祖传真凰符托付钟卫娘、师妹祭符灭神魂。黑煞教覆灭。得：血凝五行丹/玄阴诀/血灵钻/锦帕/玉简/钵盂/胥王血刃。彩蛋：刘宋渊源");
      Engine.addMilestone("皇宫决战·终结：真凰符灭胥王神魂，黑煞教覆灭（刘靖生还）", "showdown");
      // 远雷·跨场仇恨兑现（铁律3）：京城血池蜕茧遁走的铁罗，随黑煞教覆灭同灭——断臂化茧的旧账，在皇宫血夜清了
      Engine.settleLedger("tieluo_escaped", "那个在血池里断你一臂、化血茧金蝉脱壳遁走的血侍铁罗——他到底没能再逃过这一劫。黑煞教教主既灭，满殿血侍同遭真凰符焚尽，他亦在其中。当日他咬着你气息撂下的那句「下次是你进血池」，终究只是句没能兑现的狠话");
      Engine.settleLedger("wuxuan_missing", "血池侧殿密室里那具被吸尽精血的枯瘦尸身，给京郊失踪的悬念画上了最沉的句点——武炫师弟没能等到你们掀了魔窟。黄枫谷替他收殓了遗骸，归葬谷中");
      if (typeof Sfx !== "undefined") Sfx.play("success");
    },
    choices: [
      {
        text: "（赤金凰焰吞没神魂——胥王，终于伏诛。）",
        hint: "感慨正道楷模——铸入心性",
        effect(s) {
          Engine.recordTemperament("modao_finale_respect", "sentiment", "皇宫决战终结·向刘靖与钟卫娘默拜——记得住别人的好，是你没丢的人味");
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
      "平天尺、重元珠、赤虹剑——你与宋蒙，还有那位自集结夜便按剑随行的陈巧倩，三件符宝齐轰而下，胥王那具假丹肉身轰然崩碎。可血凝五行丹借阵中五行之力，犹自凝起一缕复生神魂，被颠倒五行阵死死镇在原地、寸步难逃。",
      { say: "钟卫娘", emo: "cry", tone: "她攥着刘师兄留下的那枚祖传真凰符，泪流满面，双手却稳得出奇", text: "刘师兄……你护道一生，这最后一击，师妹替你了结他——真凰符，焚！" },
      { shot: "shock" },
      { fx: "flash", color: "#ffd27a", alpha: 0.5 },
      { fx: "burst", elem: "jinlei", n: 18 },
      { sfx: "success" },
      { aside: "一只赤金火凰自符中振翅而出，长鸣一声，将那缕负隅顽抗的复生神魂连同满殿血煞，尽数吞没、焚作飞灰。胥王、越皇、黑煞教主——这魔道巨擘，终于伏诛。这一焚，是为天下苍生，也是为那位再回不来的正道楷模。" },
      { shot: "pullOut" },
      // canon M4：武炫之死收口——皇宫密室被吸尽精血（未随剿而先遭毒手）
      { wait: 600 },
      { aside: "清点魔窟时，宋蒙在血池侧殿的一间密室里停住了脚——武炫瘫在锁链间，周身干瘪如枯柴，精血早被吸得一滴不剩。这一夜，黄枫谷折了两位同门。钟卫娘背过身去，肩膀抖了很久。" },
      { aside: "（战利品入囊：血凝五行丹／玄阴诀／血灵钻／锦帕／玉简／钵盂。）" },
    ],
    onArrive(s) {
      State.setFlag("modao_e4b_finale_done");
      // polish-zaibie B④：黑煞血刃入袋（同 live 线）
      ["xuening_wuxing_dan", "xuanyin_jue", "xueling_zuan", "jinpa_liusong", "yujian_canpian", "boyu_alms", "heisha_xueren"].forEach(k => State.give(k, 1));
      Engine.writeLedger("modao_e4b_finale", "皇宫血池大殿·终结——三符宝（韩立平天尺/宋蒙重元珠/陈巧倩赤虹剑）齐轰毁胥王假丹肉身→血凝五行丹借阵复生神魂→颠倒五行阵镇之、钟卫娘含泪祭刘靖遗下的祖传真凰符灭神魂（为身陨的刘师兄报仇）。黑煞教覆灭。得：血凝五行丹/玄阴诀/血灵钻/锦帕/玉简/钵盂/胥王血刃");
      Engine.addMilestone("皇宫决战·终结：真凰符灭胥王神魂，黑煞教覆灭（刘靖身陨）", "showdown");
      // 远雷·跨场仇恨兑现（铁律3）：京城血池蜕茧遁走的铁罗，随黑煞教覆灭同灭——断臂化茧的旧账，在皇宫血夜清了
      Engine.settleLedger("tieluo_escaped", "那个在血池里断你一臂、化血茧金蝉脱壳遁走的血侍铁罗——他到底没能再逃过这一劫。黑煞教教主既灭，满殿血侍同遭真凰符焚尽，他亦在其中。当日他咬着你气息撂下的那句「下次是你进血池」，终究只是句没能兑现的狠话");
      Engine.settleLedger("wuxuan_missing", "血池侧殿密室里那具被吸尽精血的枯瘦尸身，给京郊失踪的悬念画上了最沉的句点——武炫师弟没能等到你们掀了魔窟。黄枫谷替他收殓了遗骸，归葬谷中");
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
        hint: "承遗志——铸入心性",
        effect(s) {
          s.mood = Math.max(0, s.mood - 2);
          Engine.recordTemperament("modao_finale_resolve", "stoic", "皇宫决战终结·承刘靖遗志——把悲愤压成前行的脚力");
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
    // polish-modao C1/C2/C3/C8/E池（2026-07-12）：离京拍收账——秦家谢仪（modao_rujing 结）、翠儿谢恩（凡俗吐纳法）、
    //   蒙山五友下文（护院·静候灵兽山收编）、刘靖生还线养伤道别、陈巧倩托宋蒙捎话（remember 线·baiju_appt 远线立账）。
    text(s) {
      const t = [
        { scene: "皇宫 · 血池大殿" },
        { amb: null },
        { shot: "pullOut" },
        { wait: 600 },
        "血池熄了，赤水褪尽。这一夜，九名筑基修士夜闯皇城、力诛假丹境的黑煞教主胥王——蟠踞越国多年、以血祭邪法残害散修的黑煞教，自此覆灭。",
        { sfx: "yearBell" },
        { aside: "天光将明，众人各自收拾伤势与心绪。宋蒙拍了拍你的肩：「韩师弟，京城这趟，多亏有你。各派的烂账，七派自会去理——你我，是该回天南了。」" },
        { aside: "动身那日，秦府老管家领着仆役候在城门，奉上秦家备下的谢仪——五枚灵石、几色京中土仪，不厚，却是全府上下的心意。那位爱哭的老门房也来了，隔着人群朝你深深一揖。李化元那句『替老夫还上这一程』，你还上了：京城之难随黑煞教覆灭而解，秦府上下，全须全尾（灵石+5）。" },
        { say: "萧翠儿", emo: "smile", tone: "她挎着花篮追出城门，篮里的栀子开得正盛", text: "韩公子！爷爷让我一定送送你——他身子好起来啦，就是老念叨，说仙长救的命，凡人没什么还得起的……" },
        { aside: "你想起她问过的那句『凡人是不是没福气』。这一回你没有答不上来——你从袖中取出一册连夜手抄的凡俗吐纳法，放进她的花篮：不是仙家功法，只是套强身祛病、延年少灾的把式。「回去教给爷爷，每日清晨练上一遍。」她愣愣接过，忽然咧开嘴笑了，眼泪却先掉了下来。凡人有凡人的福气——你给不了长生，却给得起一份念想。" },
        { aside: "蒙山五友也来了，五个人挤挤挨挨作了个团揖。为首的搓着手，半是讨账半是道别：「道友，『灵兽山收编』那茬……哥五个可还等着信儿呢。」你面不改色：「黑煞教既覆，京城正缺看家护院的好手——先把名声挣起来，灵兽山来人时，也好看。」五人对视一眼，咧嘴应了：改行护院，静候收编，两不耽误。" },
      ];
      if (s.flags.liujing_survived) {
        t.push({ aside: "刘靖裹着厚厚的伤，被钟卫娘半扶半押着来送行。他左肩还吊着，拱手只能拱半个：「韩师弟，这条命是你喝回来的。我先回谷养伤——养好了，来日再并肩。」" });
      }
      if (s.flags.chen_front_reunion) {
        t.push({ aside: "临上路，宋蒙忽然一拍脑门，凑过来压低声音：「差点忘了——陈家那位女修托我捎句话。她说：『白菊山春时花开，师弟若路过越京——』」他挠挠头，「就说到这儿，后半句没说。」你把这半句话，连同那半个没说尽的约，一并收进了心里。" });
      }
      t.push(
        { aside: "你握着囊中那枚自矿洞古传送阵心捧出的大挪移令，心头掠过一个念头：残缺的古传送阵、远在天南之外的乱星海……这条极长的线，今日还握不住，却已悄然牵起。" },
        { guide: { tag: "魔道争锋 · 京城篇 · 收束", hint: "黑煞教覆灭——再别天南篇已解锁，回天南。", focus: "map", cta: "回天南" } },
      );
      return t;
    },
    onArrive(s) {
      State.setFlag("modao_e4_done");
      State.setFlag("modao_e4b_done");
      State.setFlag("arc3_complete");   // polish-zaibie B⑦（GPT P1-6）：chapters.js 声明的 completeFlag 此前全库零写点
      // polish-zaibie C8（GPT P2-2）：章切清休眠旗——征军离队记号出章即销（避免残留至星海）
      delete s.flags.modao_awol;
      Chapters.unlock("zaibie");   // 京城血夜了结→解锁再别天南篇
      Engine.writeLedger("modao_e4b_likjing", "皇宫决战收束·离京——黑煞教覆灭，九筑基功成离京、各返天南。埋「再别天南篇」长线钩：回天南旧人旧事/矿洞古传送阵修补/通向乱星海的大挪移令引线（本增量止于此·下一篇章后续窗口实装）");
      Engine.addMilestone("魔道争锋·第四幕·皇宫决战·收官：黑煞教覆灭，韩立离京回天南", "showdown");
      // polish-modao C2：秦家护持结案——李化元亲托的私债，离京拍点名收清（谢仪入袋）
      State.give("lingshi", 5);
      Engine.settleLedger("modao_rujing", "师兄的人情，你替师父还上了——京城之难随黑煞教覆灭而解，秦府上下全须全尾。城门谢仪不厚，情分收足");
      // polish-modao C1：remember 线捎话立账——白菊山之约落地成账（真兑现节点立案重返天南站）
      if (s.flags.chen_front_reunion) {
        Engine.writeLedger("baiju_appt", "白菊山春时花开，师弟若路过越京——陈巧倩托宋蒙捎来的半句话。这半个没说尽的约，日后重返天南时再赴（远线）");
      }
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
        hint: "回望京城——铸入心性",
        effect(s) {
          Engine.recordTemperament("jingcheng_lookback", "sentiment", "离京时回望那座皇城——血夜的人与事，你舍不得就此翻篇");
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

  // ——【进入·回天南】京城收官后南返嘉元城——
  //     canon-audit Z7（2026-07-10 修正）：按曲魂去向分文案——留府线（动漫正典 ep47~49）=回城寻魂、
  //     发现已被御灵宗修士夺舍诈话（「假曲魂」名场面）；带走线（玩家自由分支）=幡在囊中、御灵宗循气追来。
  //     旧版无条件「携曲魂幡南返」与留府存档自相矛盾。——
  {
    id: "zaibie_open",
    skipIf: (s) => s.flags.zaibie_open_done,
    cond: (s) => s.flags.modao_e4_done && !s.flags.zaibie_open_done,
    cg: "jiayuan_guandao",
    bgm: "journey",
    title: "再别天南 · 回天南",
    objTitle: "南返嘉元城",
    objHint: "京城的烂账了了。南返天南，先回嘉元城——曲魂那头，御灵宗的人也盯上了。",
    text(s) {
      const t = [
        { scene: "嘉元城外 · 官道" },
        { shot: "establish" },
        { amb: "wind" },
        "离了京城，一路南行。越往天南腹地走，那股熟悉的山水气息便越浓——这是你筑基之后，第一次踏回天南的土地。",
      ];
      if (s.flags.quhun_stay_jiayuan) {
        // 留府线（动漫正典）：回城寻魂——假曲魂诈话·识破夺舍
        t.push(
          "进城第一件事，你绕去墨府旧宅看那道留守的影子。檐角阴影里，曲魂如旧地立着——可你唤它近前时，它竟微微一顿，喉间挤出沙哑的人声：「主人……一切、如常。」",
          { amb: null },
          { wait: 600 },
          { shot: "pushIn", ms: 1300, scale: 1.14 },
          { sfx: "danger" },
          { aside: "你的血一瞬间凉了半截。张铁的遗蜕是尸傀——尸傀，从来不会说话。" },
          { say: "韩立", emo: "cold", tone: "low", text: "「你不是曲魂。……哪来的东西，占了我兄弟的身子？」" },
          "那「曲魂」眼底闪过一丝惊惶，旋即身形暴退、破窗而出——御灵宗的夺舍者，不知何时已鸠占鹊巢，正要携着这具躯壳远遁！",
          { aside: "（再别天南篇·开篇。追——把张铁的身子，夺回来。）" },
        );
      } else {
        // 带走线（玩家自由分支）：幡在囊中·御灵宗循气追来
        t.push(
          { aside: "囊中那面曲魂幡幽幽震动，似在感应着什么。自燕家堡一路带到京城、又带回天南的这具遗蜕，御灵宗的人也惦记上了。" },
          { say: "韩立", emo: "cold", tone: "low", text: "「曲魂幡躁动得厉害……是御灵宗的人，循着这缕魂气追来了。」" },
          { aside: "（再别天南篇·开篇。御灵宗的夺舍者已在城外候着了。）" },
        );
      }
      return t;
    },
    onArrive(s) {
      Chapters.unlock("zaibie");
      Chapters.enter("zaibie");
      s.location = "jiayuan_city";
      State.setFlag("zaibie_open_done");
      Engine.writeLedger("zaibie_open", s.flags.quhun_stay_jiayuan
        ? "再别天南·开篇——回嘉元城寻曲魂，檐角的『曲魂』竟开口说话：尸傀不会说话——张铁的遗蜕已被御灵宗修士夺舍鸠占。追夺开始。"
        : "再别天南·开篇——京城血夜了结，韩立携曲魂幡南返嘉元城。御灵宗夺舍者循曲魂魂气追至。");
      Engine.addMilestone("再别天南：回到天南，重履嘉元城", "zaibie");
      s.worldNews = s.worldNews || [];
      const t = `第${s.year}年${s.month}月`;
      s.worldNews.push({ t, kind: "rumor", text: "嘉元城传闻：御灵宗放出重赏，悬缉一缕『曲魂』残识——据说与早年一桩夺舍秘辛有关，引得不少散修暗中打探。" });
      // polish-modao E池：刘靖生还线余韵——「挣来的转机」在下一章有回甘
      if (s.flags.liujing_survived) {
        s.worldNews.push({ t, kind: "rumor", text: "京城传来消息：皇宫血夜里重伤的黄枫谷刘靖已伤愈归谷，闭门谢客月余，出关头一件事便是往演武场立了柄新剑——「除魔的剑，不能歇」。" });
      }
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
    // canon-audit C3/追认①（2026-07-10 用户拍板改回正典）：身外化身祭炼在乱星海小寰岛闭关（ep66），
    // 本章曲魂=尸傀·执血刃强催（战力数值不动·仅正名）；"曲魂本是假丹残魂"错话删除。
    title: "再别天南 · 血刃附傀",
    objTitle: "血刃附傀·强催曲魂",
    objHint: "以玄阴诀御尸法门为曲魂附上黑煞教主的血刃，强催其威——真正的『身外化身』之术，须待神识修为更进一步方能祭炼。眼下，这已是能压你一头的底牌。",
    text(s) {
      const t = [
        { scene: "嘉元城 · 墨府旧宅 · 静室" },
        { amb: "candle" },
        { shot: "establish" },
      ];
      if (s.flags.quhun_stay_jiayuan) {
        t.push("追踪整夜，你在城郊废窑截住了那名夺舍者的踪迹——他挟着曲魂的躯壳，一时遁不远。你退回静室，先做临战的准备：请出自黑煞教主胥王处所得的那柄『血刃』——通体暗红、煞气森森的一件邪宝。");
        t.push({ aside: "玄阴诀的御尸法门在识海中流转。夺回曲魂之后，以此刃附傀、以此法强催——张铁的遗蜕，会比从前更能护你。" });
      } else {
        t.push("你寻了处隐秘静室，取出曲魂幡，又请出自黑煞教主胥王处所得的那柄『血刃』——通体暗红、煞气森森的一件邪宝。");
        t.push({ aside: "玄阴诀的御尸法门在识海中流转。所谓『身外化身』之术亦录于其上——只是那一步须神识远超同侪方能落子，眼下还够不着。先以血刃附傀、强催曲魂之威，已足堪一用。" });
      }
      t.push(
        { say: "韩立", tone: "low", text: "「张铁的遗蜕，配上这柄血刃……便是一记能压我一头的杀招。」" },
        { amb: null },
        { shot: "pushIn", ms: 1300, scale: 1.14 },
        { fx: "material", at: "center", elem: "huo" },
        { sfx: "cast" },
        { fx: "flash", color: "#a03a2a", alpha: 0.24, ms: 460 },
        s.flags.quhun_stay_jiayuan
          ? "血刃在掌中低鸣，煞气与玄阴诀的法门一寸寸咬合——万事俱备，只欠把张铁的身子夺回来。"
          : "你掐诀催动，血刃没入曲魂掌中——尸傀周身煞气勃发，那具沉默的身躯里，透出一股前所未有的凶悍威势。",
      );
      return t;
    },
    choices(s) {
      // 留府线：曲魂尚在夺舍者手中——本节点只做临战准备，附傀在夺回后（zaibie_a1_after）兑现
      if (s.flags.quhun_stay_jiayuan) {
        return [{
          text: "「张铁——等我。」循魂气追去。",
          hint: "先夺回曲魂（血刃附傀·夺回后兑现）",
          effect(st) {
            State.setFlag("zaibie_quhun_done");
            State.setFlag("zaibie_quhun_pending");   // 待夺回后附刃（zaibie_a1_after 读）
            Engine.writeLedger("zaibie_quhun_huashen", "再别天南·血刃附傀（备）——玄阴诀御尸法门已熟、黑煞血刃在手，只待从御灵宗夺舍者手中夺回曲魂的躯壳。");
            return { text: "你收起血刃，循着废窑方向的魂气掠出——张铁的身子，一寸都不能留给外人。", kind: "event" };
          },
          resolve: "advance",
        }];
      }
      return [
        {
          text: "「以玄阴诀强催——曲魂，执刃。」",
          hint: "SideUnit 友军·血刃附傀·全程并肩",
          effect(st) {
            st.sideUnit = {
              id: "quhun_xieren", name: "曲魂", kind: "corpse",
              hp: 200, hpMax: 200, mp: 60, mpMax: 60,
              atk: 30, atkName: "血刃斩",
              elem: "huo", nature: "corpse", guard: 0.32, move: 1, mastery: 1,
              persona: { aggr: 8, prot: 5, kite: 2 }, status: "ok", carry: true,
              moves: [
                { name: "血刃斩", dmg: 30, weight: 12, elem: "huo", range: [1, 2], line: "曲魂血刃一闪，赤煞裂空斩向" },
                { name: "血煞噬魂", dmg: 24, weight: 7, elem: "huo", range: [1, 3], line: "曲魂吐出一道血煞，缠噬而上" },
                { name: "血遁突袭", dmg: 40, weight: 5, elem: "huo", range: [1, 4], line: "曲魂化作一道血虹，贯阵突袭" },
              ],
            };
            State.take("heisha_xueren", 1);   // polish-zaibie B④：血刃附傀=真消耗（离背包·入曲魂之手）
            State.setFlag("zaibie_quhun_done");
            Engine.writeLedger("zaibie_quhun_huashen", "再别天南·血刃附傀——以玄阴诀御尸法门为曲魂附上黑煞教主血刃、强催其威。乱星海结丹前，这具执刃尸傀的战力始终压韩立一头（SideUnit 友军·全程并肩）。真正的身外化身之术，留待神识大成再祭。");
            Engine.addMilestone("再别天南：血刃附傀（曲魂·黑煞血刃）", "zaibie");
            return { text: "血刃附傀功成——曲魂执刃而立，煞气凛然，自此随你并肩而战。在乱星海结丹之前，它的战力始终压你一头，是你最硬的一张底牌。", kind: "good" };
          },
          resolve: "advance",
        },
        {
          text: "「不急——慢慢温养，稳为先。」以温养之法徐徐附刃。",
          hint: "曲魂气血略低，但护主心更切（prot+3）",
          effect(st) {
            st.sideUnit = {
              id: "quhun_xieren", name: "曲魂", kind: "corpse",
              hp: 180, hpMax: 180, mp: 60, mpMax: 60,
              atk: 28, atkName: "血刃斩",
              elem: "huo", nature: "corpse", guard: 0.32, move: 1, mastery: 1,
              persona: { aggr: 6, prot: 8, kite: 2 }, status: "ok", carry: true,
              moves: [
                { name: "血刃斩", dmg: 28, weight: 12, elem: "huo", range: [1, 2], line: "曲魂血刃一闪，赤煞裂空斩向" },
                { name: "血煞噬魂", dmg: 22, weight: 7, elem: "huo", range: [1, 3], line: "曲魂吐出一道血煞，缠噬而上" },
                { name: "血遁突袭", dmg: 38, weight: 5, elem: "huo", range: [1, 4], line: "曲魂化作一道血虹，贯阵突袭" },
              ],
            };
            State.take("heisha_xueren", 1);   // polish-zaibie B④：血刃附傀=真消耗
            State.setFlag("zaibie_quhun_done");
            State.setFlag("quhun_safe_refine");
            Engine.writeLedger("zaibie_quhun_huashen", "再别天南·血刃附傀——以玄阴诀温养之法徐徐为曲魂附上黑煞血刃。稳为先，气血略低而护主心切。真正的身外化身之术，留待神识大成再祭。");
            Engine.addMilestone("再别天南：血刃附傀（曲魂·黑煞血刃·温养法）", "zaibie");
            return { text: "温养之法虽慢，曲魂与你的神魂契合却更深——执刃而立，护主之心尤切。", kind: "good" };
          },
          resolve: "advance",
        },
      ];
    },
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
    objHint: "御灵宗夺舍者放出一头金背妖螂断路。金克木、甲坚镰利——祭出颠倒五行阵图逐回合反制。",
    text(s) {
      const t = [{ scene: "嘉元城外 · 乱石坡" }];
      if (s.flags.quhun_stay_jiayuan) {
        t.push(
          "循魂气追至乱石坡，那夺舍者终于停下遁光。他挟着曲魂的躯壳退开数丈，袖一挥——一头金背如铁、双镰开阖的庞然大妖伏地拦在你面前。",
          { say: "御灵宗夺舍者", tone: "cold", text: "「一具尸傀而已，也值得你追出百里？识相的就此止步——本座还能留你个全尸。」" },
          { say: "韩立", emo: "cold", text: "「那是我兄弟的身子。放下它——或者，连你这条借来的命一起留下。」" },
        );
      } else {
        t.push(
          "才出城门，一股凌厉煞气当头压下。乱石坡上，一道清癯人影负手而立，身前伏着一头金背如铁、双镰开阖的庞然大妖。",
          { say: "御灵宗夺舍者", tone: "cold", text: "「曲魂的气息，果然在你身上。识相的，把它交出来——本座还能留你个全尸。」" },
          { say: "韩立", emo: "cold", text: "「御灵宗的人……来得倒快。这具遗蜕，如今是我的底牌——想要，自己来取。」" },
        );
      }
      t.push(
        { fx: "lightning", at: "left", elem: "jin" },
        "那夺舍者冷哼一声，袖一挥——金背妖螂双镰一振，金鸣裂石，朝你扑来！",
      );
      return t;
    },
    onArrive(s) { s.location = "jiayuan_city"; },
    choices(s) {
      return [{ text: "掷出颠倒五行阵图——迎战！",
        hint: s.flags.quhun_stay_jiayuan ? "fieldCycle 险战·独力破妖" : "fieldCycle 险战·曲魂并肩",
        resolve: "jinbei_fight" }];
    },
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
    objHint: "妖螂既毙，那夺舍者亲自下场。他神魂结丹、躯壳筑基，催不全本命之力——先碎躯壳、再散残念。胜得绿煌剑。",
    text(s) {
      const t = [
        { scene: "嘉元城外 · 乱石坡" },
        { cam: "zoom", scale: 1.16, ms: 240 },
        { sfx: "sword" },
        { fx: "swordRing", elem: "mu" },
        "金背妖螂轰然坠地。那夺舍者面色铁青，一柄通体莹绿的古剑应声出鞘，剑气森森——竟是一件结丹本命之器！",
        { say: "御灵宗夺舍者", tone: "angry", text: "「区区筑基，也敢坏本座的事！这绿煌剑乃我本命之宝，今日便叫你死在它下！」" },
        { aside: "你心头雪亮：他神魂虽是结丹，强占的这具躯壳却催不全本命真元——战力被生生压在筑基一档。这柄绿煌剑，今日志在必得。" },
      ];
      t.push(s.flags.quhun_stay_jiayuan
        ? { say: "韩立", emo: "cold", tone: "low", text: "「催不全的本命之力……那便是你的死穴。把我兄弟的身子，还回来！」" }
        : { say: "韩立", emo: "cold", tone: "low", text: "「催不全的本命之力……那便是你的死穴。曲魂——上！」" });
      return t;
    },
    onArrive(s) { s.location = "jiayuan_city"; },
    choices: [
      { text: "越阶夺剑——硬撼！", hint: "waves 二阶段·胜得绿煌剑+奇虫榜玉简", resolve: "duoshe_fight" },
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
    text(s) {
      const t = [
        { scene: "嘉元城 · 客栈" },
        { shot: "establish" },
      ];
      if (s.flags.zaibie_quhun_pending) {
        t.push(
          "夺舍者的残念散尽，曲魂的躯壳静静躺在乱石之间——完好无损。你把它接回来，以玄阴诀重新温养安魂，再将那柄黑煞血刃按入它掌中。",
          { fx: "material", at: "center", elem: "huo" },
          { sfx: "cast" },
          "尸傀周身煞气勃发，缓缓握紧了刃柄。张铁的遗蜕，回来了——比从前更能护你。",
          { wait: 500 },
        );
      }
      t.push(
        "绿煌剑通体莹绿、剑身流转着古拙的纹路。你越阶一试，剑影分光、威势赫赫——虽催不出结丹本命的全威，已足以列为你第三柄主战法宝。",
        { aside: "那卷奇虫榜玉简亦是意外之喜——内里录着诸般天地奇虫的来历与豢养之法，于你日后大有用处。" },
        { sfx: "danger" },
        { aside: "可还未及细看，城中已是一片哗然——金鼓原方向，黑煞教残部竟与天南各路魔修合流、倾巢来犯，灵兽山一脉临阵倒戈反水，正道大军节节败退……" },
        { say: "韩立", emo: "cold", tone: "low", text: "「金鼓原……黄枫谷的人，怕是都在那里。」" },
        { shot: "pullOut" },
      );
      return t;
    },
    onArrive(s) {
      s.location = "jiayuan_city";
      State.setFlag("zaibie_a1_after_done");
      // 留府线·血刃附傀兑现（Z7）：夺回曲魂躯壳→附血刃入侧位（数值与带走线一致）
      if (s.flags.zaibie_quhun_pending && !s.sideUnit) {
        s.sideUnit = {
          id: "quhun_xieren", name: "曲魂", kind: "corpse",
          hp: 200, hpMax: 200, mp: 60, mpMax: 60,
          atk: 30, atkName: "血刃斩",
          elem: "huo", nature: "corpse", guard: 0.32, move: 1, mastery: 1,
          persona: { aggr: 8, prot: 5, kite: 2 }, status: "ok", carry: true,
          moves: [
            { name: "血刃斩", dmg: 30, weight: 12, elem: "huo", range: [1, 2], line: "曲魂血刃一闪，赤煞裂空斩向" },
            { name: "血煞噬魂", dmg: 24, weight: 7, elem: "huo", range: [1, 3], line: "曲魂吐出一道血煞，缠噬而上" },
            { name: "血遁突袭", dmg: 40, weight: 5, elem: "huo", range: [1, 4], line: "曲魂化作一道血虹，贯阵突袭" },
          ],
        };
        delete s.flags.zaibie_quhun_pending;
        State.take("heisha_xueren", 1);   // polish-zaibie B④：血刃附傀=真消耗（留府线兑现点）
        Engine.settleLedger("zaibie_quhun_huashen", "血刃附傀之备在夺回曲魂躯壳的这一夜兑了现——张铁的遗蜕执刃归位，往后的路，它仍走在你身前半步");
        Engine.settleLedger("quhun_left_mo", "当年留在墨府檐角的那道影子，被御灵宗鸠占过一回——你追出百里把它夺了回来。留它护人是情义，夺它回来也是");
        Engine.toast("曲魂归位·血刃附傀（侧位随行）");
      }
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
    objHint: "战鼓如雷、血染黄沙。与宋蒙、钟卫娘的撤离小组并肩冲杀，先斩魔修领队、撕开缺口——纵知大局难挽，也要为黄枫谷的弟子搏一条退路。",
    // canon-audit Z6：正典此战李化元不在韩立身侧（他去救红拂）、南宫婉不在场——同伴=黄枫谷同门宋蒙/钟卫娘
    text: [
      { scene: "金鼓原 · 旷野战场" },
      { shot: "shock", scale: 1.12, px: 8 },
      { sfx: "farClash" },
      { fx: "shake", px: 10 },
      "金鼓原上，战鼓如雷、血染黄沙。黑煞教倾巢而出，倒戈的灵兽山妖兽成群，正道联军被压得节节后退。",
      { fx: "flash", color: "#8a2b20", alpha: 0.16, ms: 420 },
      "溃军之中两道熟悉的身影杀了过来——皇宫血夜并肩过的宋蒙与钟卫娘。撤离小组，又聚齐了。",
      { say: "宋蒙", tone: "大笑", text: "「哈哈——韩师弟！又是这种要命的场面碰上你，痛快！先斩那魔修领队，群势自溃！」" },
      { say: "钟卫娘", tone: "急切", text: "「师父带人去接应红拂师伯了，这边交给我们——韩师弟，撕开缺口，给弟子们搏条退路！」" },
    ],
    onArrive(s) {
      s.location = "jinguyuan";
    },
    choices: [
      { text: "与宋蒙、钟卫娘并肩——先斩领队！", hint: "sides[] 群战·曲魂并肩", resolve: "jingu_fight" },
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
    objTitle: "死守阵脚·待阵启",
    objHint: "溃局已不可挽，残军退向山口——黄枫谷世代经营的「护山大阵」是弟子们最后的活路。李化元坐镇阵心催动大阵，你与曲魂死守阵脚六息，拖到阵启即可，不必胜。",
    // canon-audit Z3 前置修正：护山大阵=既有设施（ep56 撤离通道），李化元是「催阵」非「燃命布阵」——燃命一笔归还给下节点的赌约碎丹
    text: [
      { scene: "金鼓原 · 山口阵眼" },
      { sfx: "farClash" },
      { fx: "shake", px: 7 },
      "领队虽斩，魔潮却如决堤之水涌来。残军且战且退，退到山口——黄枫谷世代经营的护山大阵就在这里，只是仓促之间，阵枢尚未全开。",
      { shot: "focusLeft" },
      { say: "李化元", tone: "low", text: "「弟子们先进阵！老夫来催阵枢——韩立、曲魂，给我守住阵脚六息！一个魔修都不许放到阵心来！」" },
      { fx: "material", at: "center", elem: "tu" },
      { sfx: "castTu" },
      { shot: "focusRight" },
      { say: "韩立", emo: "cold", tone: "low", text: "「好。曲魂，封住阵口——一个都别放进来！」" },
    ],
    onArrive(s) { s.location = "jinguyuan"; },
    choices: [
      { text: "死守阵脚，拖到护山大阵开启！", hint: "objective:survive 6 回合·满血上阵", resolve: "hushan_fight" },
    ],
  },

  // ——【Act2 收束】李化元殉道（cutscene·sorrow）——
  //     canon-audit Z3（2026-07-10 修正·ep57~58）：正典=云露老魔（元婴中期）擒红拂压境→
  //     李化元立赌约「逼你出手便算我赢、放她走」→自碎金丹拼出巅峰一击逼云露出手→力竭死在红拂怀中。
  //     非「燃命布护山大阵」（大阵是既有设施，上节点已守成）。——
  {
    id: "zaibie_a2_lihuayuan",
    cg: "hushan_zhen",
    skipIf: (s) => s.flags.zaibie_lhy_done,
    cond: (s) => s.flags.zaibie_hushan_done && !s.flags.zaibie_lhy_done,
    bgm: "sorrow",
    title: "再别天南 · 碎丹一诺",
    objTitle: "李化元殉道",
    objHint: "护山大阵既成，魔潮却送来了真正的主人——元婴中期的合欢宗云露老魔，手里擒着重伤的红拂。李化元一步踏出光幕。",
    text: [
      { scene: "金鼓原 · 护山光幕外" },
      { fx: "flash", color: "#e8d9a0", alpha: 0.3, ms: 600 },
      { sfx: "castTu" },
      "齐天光幕轰然立起，整座山口被一道光墙护住，溃退的弟子们终于得了喘息。",
      { amb: null },
      { wait: 600 },
      { shot: "shock", scale: 1.12, px: 8 },
      { sfx: "danger" },
      "可魔潮让开的正中，一道慵懒的身影踏空而来——合欢宗云露老魔，元婴中期。他手里像拎一件玩物般，擒着一个重伤昏迷的白衣女修：黄枫谷第一结丹、红拂。",
      { say: "云露老魔", tone: "似笑非笑", text: "「李化元。拿你这位师姐，换这满山门的弟子——还是说，你要老夫亲手来取？」" },
      { wait: 600 },
      "光幕内一片死寂。然后，一道白须身影一步踏了出去，把整座大阵、整山门弟子，关在了自己身后。",
      { actor: "lihuayuan", enter: "left", emote: null, name: "李化元" },
      { shot: "focusLeft" },
      { say: "李化元", tone: "平静得可怕", text: "「云露。老夫与你赌一局——我这结丹之身，若能逼你元婴之尊认真出上一手，便算我赢。我赢了，你放她走，也放这满山弟子走。」" },
      { say: "云露老魔", tone: "嗤笑", text: "「就凭你？好，老夫陪你赌。」" },
      { wait: 700 },
      { shot: "pushIn", ms: 1400, scale: 1.16 },
      { aside: "你在光幕内看见：李化元缓缓阖眼，周身真元忽然狂涨——那不是催动功法的涨法，是金丹寸寸碎裂、把一甲子修为一次性烧尽的涨法。他把自己毕生的道，压进了这一击里。" },
      { fx: "flash", color: "#ffe8b0", alpha: 0.5, ms: 500 },
      { fx: "burst", at: "center", elem: "tu", n: 18, ms: 500 },
      { sfx: "thunder" },
      { cam: "shake", px: 10 },
      "碎丹一击，天地失色。云露老魔脸上的嗤笑第一次敛去——他挥袖、凝罡，认认真真地接了这一手。",
      { wait: 700 },
      { say: "云露老魔", tone: "沉默片刻，掷下红拂", text: "「……算你赢。合欢宗，今日收兵。」" },
      { fx: "ambient", preset: "spirit" },
      { fx: "flash", color: "#ffe8b0", ms: 240 },
      { sfx: "bell" },
      { say: "李化元", tone: "weak", text: "「师姐……接住你了。咳……韩立，黄枫谷的根……就，拜托了……」" },
      { actor: "lihuayuan", exit: true },
      { shot: "pullOut", ms: 1800 },
      "白须老人倒在赶来的红拂怀中，气息一点点散去——嘴角却带着笑。一位结丹修士，以碎丹一诺，从元婴老魔手里赢回了一个人、一山门。",
      { wait: 600 },
      { aside: "你将这份沉甸甸的托付记在心头。天南的旧人旧事，原来真的会一桩桩、一件件地凋零下去。" },
    ],
    onArrive(s) {
      s.location = "jinguyuan";
      State.setFlag("zaibie_lhy_done");
      Engine.writeLedger("zaibie_lihuayuan", "再别天南·金鼓原收束——云露老魔（元婴中期）擒红拂压境，李化元立赌约、自碎金丹拼出巅峰一击逼其出手，赢回红拂与满山弟子生路，力竭殉道于师姐怀中。韩立受其临终托付。");
      Engine.addMilestone("再别天南：李化元碎丹一诺，殉道金鼓原", "zaibie");
      if (typeof Sfx !== "undefined") Sfx.play("fail");
      // 帆段：李化元殉道后给2月喘息——护阵退走、调息养伤、再亡命元武
      s.flags.zaibie_a3_due = State.absMonth() + 2;
    },
    choices: [
      {
        text: "「前辈的托付，我记下了。」",
        hint: "沉痛悼念——铸入心性",
        effect(s) {
          Engine.recordTemperament("lihuayuan_death_mourn", "sentiment", "李化元自碎金丹赢下赌约·向那道倒下的白须身影深深一拜——师恩重，你记一辈子");
          return { text: "你向着那道倒在红拂怀中的白须身影，深深一拜。", kind: "event" };
        },
        resolve: "advance",
      },
      {
        text: "「……黄枫谷的根，我来守。」沉默承受，不发一语。",
        hint: "沉默承受——铸入心性",
        effect(s) {
          Engine.recordTemperament("lihuayuan_death_stoic", "stoic", "李化元殉道·把痛压进心底护住退走的弟子——不发一语，是你扛事的方式");
          s.mood = Math.max(0, s.mood - 3);
          return { text: "你将那份沉甸甸的痛压进心底，不发一语，转身护住退走的弟子。", kind: "event" };
        },
        resolve: "advance",
      },
    ],
  },

  // ——【Act3·亡命元武】齐云霄已殁（付家所害）·辛如音赠古阵图纸——
  //     canon-audit Z4/Z5/M7（2026-07-10 修正）：①齐云霄之死=付家所害（ep59），非泛泛"魔劫"；
  //     ②辛如音只赠图纸、不随行矿洞、更不死——她死在韩立赴星海之后（灭付家远线宿题·ep 重返天南收）；
  //     ③补 ep30 京城道上齐辛修阵之约的回叙（M7：动漫魔道篇辛如音已登场，旧档"本篇不出场"系考据错）。——
  {
    id: "zaibie_a3_yuanwu",
    cg: "yuanwu_diku",
    skipIf: (s) => s.flags.zaibie_a3_done,
    cond: (s) => s.flags.zaibie_lhy_done && !s.flags.zaibie_a3_done
                 && State.absMonth() >= (s.flags.zaibie_a3_due || 0),
    bgm: "sorrow",
    title: "再别天南 · 亡命元武",
    objTitle: "元武国·古阵图纸",
    objHint: "金鼓原既崩，天南再无你立锥之地。循大挪移令的线索，你亡命奔向元武国——故人齐云霄已遭付家毒手，唯有辛如音守着一座残破的古传送阵。",
    text: [
      { scene: "元武国 · 百艺坊 · 地窟" },
      { shot: "establish" },
      { amb: "candle" },
      "金鼓原一败，天南正道再难给你容身之处。你循着大挪移令与古传送阵的线索，一路亡命，奔入元武国境内。",
      { aside: "百艺坊深处的地窟里，藏着一座尘封万载的古传送阵。可当年精研此阵的齐云霄，竟已身死道消——不是死于魔劫，是遭本地付家觊觎其阵道秘术、下的毒手。只剩一个清瘦女子，守着残阵，形容枯槁。" },
      { shot: "pushIn" },
      { actor: "xinruyin", enter: "left", name: "辛如音" },
      { say: "辛如音", tone: "weak", text: "「你便是……韩立？当年百艺坊代工、后来京城重逢，齐前辈都提起过你。他自京城归来，便与我定下修复此阵之约……他临终前说：若有持大挪移令者来，便把这座古阵，交托于他。」" },
      { say: "辛如音", tone: "low", text: "「这阵残损得太重，我一人之力修不全了。这卷修复图纸，你拿着——配上大挪移令，按图补全阵纹，或许真能强启它一次，送你离开天南。」" },
      { wait: 500 },
      // polish-zaibie B⑥（Fable P1-3）：玉简与叮嘱在此种下（旧版 cut1 凭空引用"托付的玉简"）
      { say: "辛如音", tone: "low", text: "「还有这枚玉简——阵启的时机、方位、诀窍，齐前辈与我推演的心血都在里面。切记：阵启只此一次，迟一息便塌。」" },
      { aside: "你接过那卷《古传送阵·修复图纸》与那枚沉甸甸的玉简。付家……你把这两个字记下了。原来通往乱星海的那条线，竟要踏着这许多故人的死生，才牵得起来。" },
    ],
    onArrive(s) {
      s.location = "yuanwu";
      State.setFlag("zaibie_a3_done");
      if (State.count("guzhen_tuzhi") < 1) State.give("guzhen_tuzhi", 1);
      if (State.count("xinruyin_letter") < 1) State.give("xinruyin_letter", 1);   // polish-zaibie B⑥：玉简在赠图时入袋
      // 远雷·元武首访伏笔兑现（铁律3）：当年北上代工首访不遇辛如音，今日故地重来终于照面
      Engine.settleLedger("yuanwu_first", "当年北上元武国代工，百艺坊里只见齐云霄、不遇辛如音——你那时怎会想到，再来元武国竟是亡命，齐云霄已遭付家毒手，唯辛如音守着残阵等你这持令之人。一坊之缘，绕成了生死之托");
      Engine.writeLedger("zaibie_a3_yuanwu", "再别天南·亡命元武——故人齐云霄遭付家所害（觊觎其阵道秘术），辛如音守残破古传送阵，赠《古传送阵·修复图纸》。配大挪移令可强启古阵、离开天南。");
      Engine.writeLedger("fujia_grudge", "齐云霄之死=元武国付家所害——这笔账韩立记下了（远线·灭付家：待他日重返天南清算）。");
      Engine.addMilestone("再别天南：得古传送阵修复图纸（辛如音赠）", "zaibie");
      s.worldNews = s.worldNews || [];
      const t = `第${s.year}年${s.month}月`;
      s.worldNews.push({ t, kind: "rumor", text: "元武国传闻：修阵大家齐云霄暴毙，坊间皆传是付家觊觎其古阵秘术下的毒手——付家近来行事，愈发无所忌惮。" });
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
        text: "「图纸我收。这瓶金疮药你留着——保重。」留下一瓶金疮药。",
        hint: "消耗1瓶金疮药，结一分善缘",
        requireItem: "huixue_dan",
        effect(s) {
          State.take("huixue_dan", 1);
          Engine.recordTemperament("xinruyin_helped", "sentiment", "赠辛如音一枚疗伤丹——对憔悴守阵人递一分善意，你心还热着");
          return { text: "你取出一枚疗伤丹搁在她手心。辛如音怔了怔，唇角微微一弯——这清瘦的女子，竟也有了一丝血色。", kind: "good" };
        },
        resolve: "advance",
      },
    ],
  },

  // ——【Act4·再别天南·其一】蒙面相援（objective:survive·保护型：韩立救被围的南宫婉——
  //     canon-audit Z2：正典 ep60 是韩立救她（敌=童老/鬼老·王蝉一方），董萱儿紧要关头卖破绽；陈巧倩不在场）——
  {
    id: "zaibie_a4_hudao",
    cg: "yanjia_canyuan",
    skipIf: (s) => s.flags.zaibie_hudao_done,
    cond: (s) => s.flags.zaibie_a3_done && !s.flags.zaibie_hudao_done,
    bgm: "combat",
    title: "再别天南 · 蒙面相援",
    objTitle: "驰援 · 被围的故人",
    objHint: "携图纸西行途中，前方灵光冲天——南宫婉被王蝉一伙围困，已然重伤。你蒙上面巾，出手。护住她，撑过这一波围杀。",
    text: [
      { scene: "燕家堡旧地 · 残垣" },
      { amb: "wind" },
      "携图纸西行，绕行燕家堡旧地时，前方残垣间骤然灵光冲天、剑气纵横——有人被围杀。",
      { shot: "shock", scale: 1.12, px: 8 },
      { sfx: "danger" },
      "你敛息掠近一看，心头一沉：白衣染血、且战且退的，竟是南宫婉！两名阴恻恻的老者一持阴灵刃、一转七鬼珠，将她困在垣心——王蝉的人。阵侧还立着一个你认得的身影：董萱儿。",
      { shot: "pushIn", ms: 1200 },
      { aside: "她伤得很重，撑不了几息了。你与她非亲非故，此地追兵环伺，出手便是引火烧身……可血色禁地那一夜背靠背的人，你做不到看着她死在这里。" },
      { wait: 500 },
      { say: "韩立", emo: "cold", tone: "low", text: "「……罢了。」你扯下一幅衣角蒙住口鼻，乌龙夺已在掌中。" },
    ],
    onArrive(s) { s.location = "yanjiabao"; },
    choices: [
      { text: "蒙面出手——护住她，撑过这一波！", hint: "objective:survive 6 回合·护住重伤的南宫婉（她若倒下即败）", resolve: "hudao_fight" },
    ],
  },

  // ——【Act4·再别天南·其二】跌境·纯演出（不动数值）——
  //     canon-audit Z1（2026-07-10 修正）：正典 ep60=韩立搀扶昏迷的南宫婉，她护身功法失控暴走、
  //     吸干韩立大半法力致其跌回炼气级——两人因果最重的一笔名场面，非路人吸修所为。——
  {
    id: "zaibie_a4_diejing",
    cg: "yanjia_canyuan",
    skipIf: (s) => s.flags.zaibie_diejing_done,
    cond: (s) => s.flags.zaibie_hudao_done && !s.flags.zaibie_diejing_done,
    bgm: "sorrow",
    title: "再别天南 · 跌境",
    objTitle: "她失控的功法·修为暴跌",
    objHint: "破围之后，你搀住昏迷的南宫婉——她体内的护身功法骤然失控暴走，一股蛮不讲理的吸力攫住你的修为。气海骤空，外人看去，你竟跌回了炼气数层。",
    text: [
      { scene: "燕家堡旧地 · 残垣外" },
      { amb: "wind" },
      "童鬼二老退去，残垣间重归死寂。南宫婉终于撑不住，身子一软——你伸手搀住了她。",
      { shot: "shock", scale: 1.14, px: 9 },
      { sfx: "danger" },
      "就在触到她手腕的刹那，她体内骤然涌起一股蛮不讲理的吸力——昏迷中的护身功法失控暴走，竟顺着相触之处，疯了一样抽取你的法力！",
      { fx: "burst", at: "center", elem: "shui" },
      { sfx: "hit" },
      { fx: "flash", color: "#3a2b4a", alpha: 0.32, ms: 460 },
      { say: "韩立", emo: "cold", tone: "weak", text: "「唔——！甩不开……我的灵力，被她吸走了大半……！」" },
      { shot: "pushIn", ms: 1300, scale: 1.14 },
      { wait: 500 },
      { aside: "你咬牙不曾撒手——撒手，她就死了。待那股吸力终于平息，她的气息稳了下来，你的气海却已十去七八。外人看去，你竟像是跌回了炼气数层的孱弱模样。" },
    ],
    onArrive(s) {
      s.location = "yanjiabao";
      // polish-zaibie B⑤（Fable P1-1）：教学括号移出戏文（modao D4 同款原则）——剧透"一举踏入结丹"删
      Engine.log("【跌境】外人眼中你已跌回炼气之弱——这只是气海暂虚的表象，你的境界与战力并未真损（详情见天命栏）。", "sys");
      State.setFlag("zaibie_diejing");      // 纯演出标记（引擎不读·不动任何数值）
      State.setFlag("zaibie_diejing_done");
      Engine.writeLedger("zaibie_diejing", "再别天南·跌境（纯演出·不动数值）——搀扶昏迷的南宫婉时其护身功法失控暴走，吸去韩立大半修为，外人看去如跌回炼气数层。他自始至终没有撒手。境界/战力数值实际未变，乱星海之初自会拾回并结丹。");
      Engine.addMilestone("再别天南：护她失控吸修为，『跌境』（纯演出）", "zaibie");
      if (typeof Sfx !== "undefined") Sfx.play("fail");
    },
    choices: [
      {
        text: "「……不过是一时的。这口气，我迟早拿回来。」咬牙硬撑。",
        hint: "强压伤势维持境界——心境受挫但志不倒",
        effect(s) {
          State.setFlag("zaibie_hold_realm");
          s.mood = Math.max(0, s.mood - 5);
          return { text: "你咬碎牙关，硬生生将翻涌的气海压住——外人看去虽狼狈，内里一口气始终未散。这笔账，你没记在她头上：救人救到底，怨不得谁。", kind: "event" };
        },
        resolve: "advance",
      },
      {
        text: "「留得青山在。」顺势力卸跌境，先保命再说。",
        hint: "卸力保命——气血充盈，但外人看你更弱",
        effect(s) {
          State.setFlag("zaibie_accept_drop");
          s.hp = s.hpMax;
          return { text: "你顺势卸去翻涌的真元，气海虽空，气血反倒稳住了——只是外人看去，你更像个废人了。她醒来时欲言又止的那个眼神，你只当没看见。", kind: "event" };
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
      { amb: "wind" },
      { shot: "establish" },
      "一路退到越国边陲那座废弃矿洞外，追兵被远远甩开。南宫婉看着你跌境后孱弱的模样——她知道这一身孱弱是怎么来的。沉默了很久，她将一袋沉甸甸的灵石塞进你手里。",
      { actor: "nangongwan", enter: "left", name: "南宫婉" },
      { shot: "pushIn", ms: 1400, scale: 1.12 },
      { say: "南宫婉", tone: "soft", text: "「这是一袋中品灵石，拿着——你如今这副样子，路上总要用得着。古阵那边，进去之后，就别再回头了。」" },
      { wait: 600 },
      { say: "韩立", emo: "cold", tone: "low", text: "「……南宫姑娘，多谢。后会，总该有期。」" },
      { amb: null },
      { shot: "pullOut", ms: 1700 },
      { wait: 500 },
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
        hint: "难得流露一丝温情——铸入心性",
        effect(s) {
          Engine.recordTemperament("nangong_lingshi_grateful", "sentiment", "受南宫婉赠灵石·难得多说了一句·喉头微动——冷面人也有软处");
          s.mood = Math.min(s.moodMax, s.mood + 2);
          return { text: "你握了握那袋灵石，喉头微动，到底多说了一句。南宫婉微微一怔，旋即别过脸去——夜风里，似有一声极轻的叹息。", kind: "good" };
        },
        resolve: "advance",
      },
    ],
  },

  // ——【Act4·再别天南·其四】矿洞拖时·启阵（objective:survive·守阵枢）——
  //     canon-audit Z4（2026-07-10 修正）：正典修阵=韩立自己按辛如音所赠图纸补全阵纹（ep61~63），
  //     辛如音不在矿洞、更不殒身——她的戏止于元武国赠图。守护对象改为「阵枢灵光」。——
  {
    id: "zaibie_a4_kuangdong",
    skipIf: (s) => s.flags.zaibie_kuangdong_done,
    cond: (s) => s.flags.zaibie_lingshi_done && !s.flags.zaibie_kuangdong_done
                 && State.absMonth() >= (s.flags.zaibie_kuangdong_due || 0),
    cg: "chuansong_zhen",
    bgm: "boss",
    title: "再别天南 · 矿洞拖时",
    objTitle: "死守阵枢·待古阵启",
    objHint: "这一个月里，你按辛如音所赠图纸，把残破的阵纹一笔一笔补全。今日大挪移令入枢蓄力——追兵却踏碎了洞口。护住阵枢六息，古阵一启，便能一步踏出天南。",
    text: [
      { scene: "越国矿洞 · 古传送阵 · 阵心" },
      { amb: "candle" },
      "矿洞最深处，那座尘封万载的古传送阵幽光明灭。这一个月，你按图纸将残破阵纹一笔一笔补全——今日，大挪移令嵌入阵枢，灵光开始蓄涨。",
      { aside: "阵枢蓄力须六息。六息之后，光柱起、大阵开——天南之外的万里之遥，一步即至。" },
      { amb: null },
      { shot: "shock", scale: 1.1, px: 8 },
      { fx: "shake", px: 8 },
      { sfx: "danger" },
      "便在此时，洞口轰然炸碎——追兵循着灵光的异动，潮水般涌入！曲魂血刃横身拦在阵前——只剩这最后六息了。",
    ],
    onArrive(s) { s.location = "yuekuang"; },
    choices: [
      { text: "死守阵枢六息——待古阵启动！", hint: "objective:survive·满血上阵·阵枢被毁即败·胜接演出①", resolve: "kuangdong_fight" },
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
    objHint: "六息撑过、阵枢蓄满，贯天光柱已起。踏入阵心，亲手催动这跨域大阵——一步踏出天南，再毁阵断后，斩断身后所有追路。",
    text: [
      { scene: "越国矿洞 · 古传送阵 · 阵心" },
      { cam: "focus", at: "center" },
      "六息撑过，古阵心爆起一道贯天光柱——一个月来你按图纸一笔笔补全的阵纹尽数亮起，大挪移令催动的契机，只在这一瞬。",
      { aside: "辛如音玉简里的叮嘱犹在耳边：「阵启只此一次，迟一息便塌。」" },
      { actor: "hanli", enter: "right", emote: "cold", name: "韩立" },
      "你迎着贯天光柱踏入阵心，掌心按上那枚已然蓄满的大挪移令——",
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
      // polish-zaibie B⑧：南宫婉那袋灵石的承诺兑现——"助催古阵"的账面在此结（不再默默进钱包）
      "南宫婉留下的那袋中品灵石，被你尽数嵌入阵眼——阵光过处，灵石一枚枚化作齑粉，把最后一段残纹生生喂亮。",
      "光柱冲霄的刹那，古阵自身也轰然崩裂——身后追兵的咒骂、袖中辛如音那枚托付的玉简、整座天南的山河……都在这一瞬被青光彻底吞没、抛在了脑后。",
      { aside: "追兵最前那道戴着半面银具的身影你认得——鬼灵门王蝉。燕家堡那一夜结下的不死不休，他从天南腹地一路咬到了这阵前，眼睁睁看你踏入光柱。「总有一天我会回来的」——这句话，一半说给天南，一半，说给他听。（宿敌未了·重返天南再算）" },
      { say: "韩立", emo: "cold", tone: "low", text: "「天南……生我、养我、也负我之地。总有一天——我会回来的。」" },
      { aside: "大挪移令碎了，古阵塌了，身后所有的追路，就此斩断。再别天南——这一别，是天南之外、茫茫数万里的未知。" },
    ],
    onArrive(s) {
      s.location = "yuekuang";
      State.setFlag("zaibie_likai_done");
      // polish-zaibie B④：大挪移令"应手而碎"=真消耗（旧版碎后仍躺背包）
      State.take("dayi_ling", 1);
      // polish-zaibie B⑧：南宫婉赠的 30 灵石=阵能（账面写"助催古阵"）——嵌入阵眼真消耗（本章无处可花，不伤经济）
      State.take("lingshi", Math.min(30, State.count("lingshi")));
      if (State.count("xinruyin_letter") < 1) State.give("xinruyin_letter", 1);
      Engine.writeLedger("zaibie_likai", "再别天南·演出①离开天南——韩立按辛如音所赠图纸自修古阵，持大挪移令强启跨域大阵、一步踏出天南，古阵随之崩毁、斩断追路。辞天南之誓：『总有一天，我会回来的。』辛如音托付之信随身（她仍守在元武国——重返天南时的故人灯）。");
      Engine.addMilestone("再别天南：大挪移令强启古阵，离开天南", "zaibie");
    },
    choices: [
      {
        text: "青光吞没前——最后回望一眼天南。",
        hint: "回望故土——铸入心性",
        effect(s) {
          Engine.recordTemperament("zaibie_lookback", "sentiment", "离天南赴星海·最后一瞬回望故土山河——故土的牵绊，你带着走");
          return { text: "你在青光吞没的最后一瞬回头望去——天南的山河在光柱之外渐渐模糊、远去，终至不见。", kind: "event" };
        },
        resolve: "advance",
      },
      {
        text: "头也不回——踏光而去。",
        hint: "斩断牵绊——铸入心性",
        effect(s) {
          Engine.recordTemperament("zaibie_no_lookback", "stoic", "离天南赴星海·不回头·把故土一切抛在身后——断得决绝，是你向前的狠劲");
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
        // 远雷·跨篇收果（铁律3/篇章质量）：魔道矿洞捧出的大挪移令，是把韩立送到这片万里妖海的唯一钥匙——落海这一刻兑现
        Engine.settleLedger("dayi_ling_got", "当年魔道矿洞古阵心里捧出的那枚大挪移令，你说不清它通向何处，只觉牵着个极遥远的去处——今日终于知道了：正是它配上辛如音修复的古阵，把你一步掷过数万里，掷到了这片陌生的乱星海。那条悄然牵起的极长的线，今日落到了脚下");
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
          Engine.recordTemperament("starsea_xiaohuan_explore", "stoic", "落脚星海前·多盘桓数日打听外岛灵脉·谋定而后动——你惯于先看清再落子");
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
      // canon C3（2026-07-10 用户拍板改回正典·ep66）：身外化身祭炼在此次闭关——玄阴诀之术终于落子
      { fx: "material", at: "center", elem: "huo", ms: 500 },
      { fx: "flash", color: "#a03a2a", alpha: 0.22, ms: 460 },
      { sfx: "cast" },
      "这二十年里，你还做成了一件蓄谋已久的事：以玄阴诀那一脉『身外化身』的秘术，将曲魂正式祭炼成可离体而战的化身——头戴玄笠、身负血刃，煞气凝而不散。张铁的遗蜕，自此脱胎换骨。",
      { aside: "身外化身既成，它的战力压你一头——在这处处陌生的乱星海，这是你最硬的一张底牌。" },
    ],
    // M5·二十载分两段（各十年）各择一向：复用 choice.stay 驻留——前十年选完卡还在，接着选后十年。
    //   两段同向=专精（加成叠满）／分两头=均衡；三转重元功一转在收关时统一结算（doReforge）。
    onArrive(s) {
      s.location = "xiaohuan_island";
      // 分两段的进度计数（不入永久 schema——本节点内瞬态，收关清）
      s._biguanSeg = 0;
    },
    // 每段的三个方向：剑意/体魄/道心（effect 幂等·可叠加，专精=同向两次）
    choices(s) {
      const seg = s._biguanSeg || 0;
      const applyDir = (dir, st) => {
        if (dir === "sword") {
          if (!st.swordMastery) {
            st.swordIntent = Math.min(100, (st.swordIntent || 0) + 15);
            if (st.swordIntent >= 100 && !st.flags.sword_intent_full) { State.setFlag("sword_intent_full"); Engine.toast && Engine.toast("剑意圆满！可回洞府悟剑"); }
            return "剑意+15";
          }
          st.mood = Math.min(st.moodMax, (st.mood || 0) + 6); return "剑势更沉（心境+6）";
        }
        if (dir === "body") { st.hpMax += 9; st.hp = st.hpMax; return "气血上限+9"; }
        st.zhuanImprint = Math.round((st.zhuanImprint || 1) * 1.02 * 1000) / 1000; return "闭关增速+2%";
      };
      if (seg < 2) {
        const yr = seg === 0 ? "前十年" : "后十年";
        return [
          { text: `${yr}·苦修剑诀——青元剑芒再淬一寸`, hint: "剑上功夫最该磨", stay: true,
            effect(st) { const g = applyDir("sword", st); st._biguanSeg = (st._biguanSeg || 0) + 1; return { text: `${yr}，你把心力倾在青元剑诀上，一寸寸打磨（${g}）。`, kind: "good" }; } },
          { text: `${yr}·磨砺体魄——以曲魂为假想敌推演战法`, hint: "拿曲魂练手，把破绽摸透", stay: true,
            effect(st) { const g = applyDir("body", st); st._biguanSeg = (st._biguanSeg || 0) + 1; return { text: `${yr}，你以曲魂为假想敌日夜推演战法（${g}）。`, kind: "good" }; } },
          { text: `${yr}·澄心悟道——打坐参悟，道心再澄一寸`, hint: "根基要紧，心境更要紧", stay: true,
            effect(st) { const g = applyDir("dao", st); st._biguanSeg = (st._biguanSeg || 0) + 1; return { text: `${yr}，你除日常功课外多了几分打坐参悟（${g}）。`, kind: "good" }; } },
        ];
      }
      // 两段皆定 → 收关（doReforge + 里程碑 + 账本；一次性）
      return [
        { text: "二十载功成，出关。", hint: "根基重夯，真元更纯——启程外星海",
          effect(st) {
            State.setFlag("starsea_biguan_done");
            Engine.doReforge();
            // canon C3：身外化身祭炼在小寰岛闭关（ep66）——曲魂尸傀→化身（数值不动·正名+换立绘）
            if (st.sideUnit && !st.flags.quhun_lost) {
              st.sideUnit.name = "曲魂·身外化身";
              st.sideUnit.kind = "incarnation";
              st.sideUnit.nature = null;
              State.setFlag("quhun_avatar");   // 曲魂立绘自此升级为玄笠化身（Art.quhunId）
              Engine.writeLedger("starsea_quhun_huashen", "小寰岛闭关·以玄阴诀祭曲魂为身外化身（玄笠执血刃·战力压韩立一头）——张铁的遗蜕脱胎换骨，乱星海最硬的一张底牌自此立起。");
            }
            Engine.addMilestone("初入星海·一幕：小寰岛闭关二十载，拾回筑基后期巅峰（三转一转·曲魂化身祭成）", "starsea");
            Engine.writeLedger("starsea_biguan", "初入星海·孤岛立身——小寰岛闭关苦修二十载（分两段各择一向），行三转重元功一转，散功重修而真元愈纯（乘性印记 zhuanImprint），拾回落海暂失之修为，重回筑基后期巅峰。");
            delete st._biguanSeg;   // 节点内瞬态计数，收关即清（不留进存档长期字段）
            return { text: "二十载寒暑，在小寰岛的潮声里悄然流过。你一寸寸拾回落海暂失的修为，重回筑基后期巅峰——重修过的真元比当年更听使唤，曲魂亦已祭成身外化身。", kind: "good" };
          },
          next: true },
      ];
    },
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
      { amb: null },
      { shot: "shock", scale: 1.16, px: 9 },
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
      // canon-audit S2（2026-07-10 修正）：大典现场风希是**救走**雷鹏（70~71集）；斩鹏夺翅在 ep76 外海摊牌——后置为传闻（jinkui 节点 worldNews 兑现）
      { scene: "炼狱 · 风希出手" },
      "便在这屠戮无人能挡之际，那位白衣「大善人」风希终于动了——却不是加入屠戮，而是一晃身掠至雷鹏侧翼。",
      { say: "风希", emo: "cold", tone: "low", text: "「百年之囚，王上元气未复——此地耗不得。随我入外海。」" },
      { cam: "zoom", scale: 1.25, ms: 700 },
      { fx: "burst", at: "center", elem: "jin", ms: 400 },
      { sfx: "thunder" },
      "元婴期裂风兽化人的真正修为骤然爆发，漫天风刃如幕，硬生生替雷鹏挡开星宫修士的围截。两道遁光一前一后，没入那道被打通的内外星海通道——妖兽旧王与它的「救主」，转瞬不见。",
      { aside: "放出雷鹏的是他，救走雷鹏的也是他——这位「大善人」的算盘，只怕深得很。雷鹏那对垂天的疾雷双翅……这一笔，你默默记下了。" },
      { say: "韩立", emo: "cold", tone: "low", text: "「元婴之上的博弈……我连插手的余地都没有。当务之急，是从这场大乱里活着出去。」" },
    ],
    onArrive(s) {
      s.location = "kuixing_island";
      State.setFlag("starsea_jingbian_done");
      Engine.meetNpc("wuchou", "逆星盟黑袍·乌丑——炸开镇妖台禁制、放出雷鹏的元凶之一，幽冷狠辣。");
      Engine.meetNpc("fengxi", "妖修『大善人』风希——元婴期裂风兽化人，勾结乌丑放出雷鹏、又亲手救走雷鹏遁入外海。笑里全是算盘。");
      Engine.writeLedger("starsea_jingbian", "镇妖大典惊变——逆星盟乌丑勾结妖修风希、六连殿古长老反水，炸开镇妖台禁制，放出镇压百年的十级雷鹏并打通内外星海通道；雷鹏破封屠戮、踩碎星宫双圣石像，旋被风希救走同遁外海（其图谋雷鹏双翅=风雷翅之材——斩鹏夺翅的后文在外海，本篇留线索）。");
      Engine.addMilestone("镇妖大典惊变：雷鹏破封·风希救鹏遁外海（风雷翅材料远线）", "starsea");
    },
    /* M5·惊变三分支（chapter-differentiation §三「立足」）：元婴级厮杀你插不了手（一致感红线），
     * 但大乱里怎么活、怎么算计——是你的选择：躲藏观戏（情报）/危中救人（人情）/乱中捡漏（实利+险）。 */
    choices: [
      {
        text: "藏身断壁——把风希出手的每一式看在眼里。",
        hint: "躲藏·最稳——元婴的手段，记下日后有用（情报径）",
        effect(s) {
          State.setFlag("jingbian_hid");
          Engine.writeLedger("starsea_jingbian_observe", "镇妖大典惊变·藏身断壁将风希出手的每一式看在眼里——元婴修士的手段，今日记下，日后或有用处（星海后续伏笔）");
          return { text: "你缩进崩塌的看台断壁之后，把风希出手的每一式都看在眼里——元婴的手段，今日记下，日后或有用处。全场奔逃的人流里，你毫发无伤。", kind: "event" };
        },
        resolve: "advance",
      },
      {
        text: "冲进塌方——拽出那个被石梁压住的散修。",
        hint: "救人·担险——气血-15%，换一份星海人情（人情径）",
        effect(s) {
          const dmg = Math.floor(s.hpMax * 0.15);
          s.hp = Math.max(1, s.hp - dmg);
          s.mood = Math.min(s.moodMax, s.mood + 6);
          State.setFlag("jingbian_saved");
          Engine.recordTemperament("jingbian_save", "sentiment", "镇妖大典惊变·雷罡横扫中折返塌方救人——险地里没把命看得比人情重");
          Engine.writeLedger("jingbian_saved_one", "镇妖大典惊变·从塌方里拽出一名素不相识的散修——雷罡余波掀伤了你，他捂着断腿只来得及喊出一句「魁星城丙字丹铺，恩公来寻我」。这份星海的人情，日后有用处（伏笔）");
          return { text: `雷罡横扫，看台成片垮塌。你折返冲进塌方，拽出一个被石梁压住的散修——余波掀得你气血翻涌（气血-${dmg}），那人捂着断腿朝你嘶声喊：「魁星城丙字丹铺！恩公来寻我！」`, kind: "good" };
        },
        resolve: "advance",
      },
      {
        text: "反身扑向雷鹏破封之地——乱中拾遗。",
        hint: "捡漏·行险——妖王震落之物就在眼前，心魔+（实利径）",
        effect(s) {
          s.demon = Math.min(100, s.demon + 5);
          State.give("leipeng_yu", 1);
          State.setFlag("jingbian_loot");
          Engine.writeLedger("jingbian_leiyu", "镇妖大典惊变·众人奔逃你独行险——自雷鹏破封挣扎之地拾得一枚震落的「雷鹏遗羽」（犹带雷光）。妖王随风希遁走，这枚遗羽成了你的：风雷翅之材的线索实物，日后有大用处（外海风云伏笔）");
          return { text: "众人往外逃，你偏往里冲。雷鹏破封挣扎之地焦土百丈——你在碎石间拾起一枚它震落的遗羽，入手微麻。贪险入怀，心口那点躁意也重了几分（心魔+5）。得：雷鹏遗羽×1。", kind: "good" };
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
    objHint: "乱局里，妙音门门主夫妇以命护女、殁于乌丑一伙之手。那紫衣小女孩自高台坠落——正是与你擦肩的「莫名熟悉」之人。反水的六连殿古长老盯上了你，你须护住她、斩长老、杀出重围。",
    // canon-audit S3/S6（2026-07-10 勘正）：①门主夫妇=被乌丑等人所杀（紫灵复仇线之根），非雷罡误伤；
    // ②拦路者=六连殿古长老（反水者本人·结丹初期），动机=见曲魂玄阴诀手段、欲生擒韩立问极阴岛之秘
    text: [
      { scene: "崩塌的看台 · 坠落" },
      "乱局之中，乌丑一伙对观礼的各派下了死手——嘉宾高台上，妙音门掌门夫妇以血肉之躯死死护住女儿，硬受了乌丑党羽的合击，力竭殒落。坠落前，那位母亲用尽最后气力，将女儿向台下安全处奋力一掷。",
      { say: "妙音门掌门", tone: "weak", text: "「凝儿……活下去……」" },
      { wait: 600 },
      { fx: "lightning", at: "center", elem: "jin", ms: 300 },
      { sfx: "thunder" },
      "那紫衣小女孩自高台跌落，惊惶无措——正是先前与你擦肩、令你莫名心颤的那张脸！电光火石间，你身形已动，稳稳将她接在臂弯。",
      { say: "汪凝", tone: "weak", text: "「爹……娘……」（小女孩泪眼婆娑，却死死攥住了你的衣袖。）" },
      "未及喘息，一道阴冷剑罡破空而至——拦路的竟是六连殿那位古长老：反水放雷鹏的叛徒本人！结丹初期的气息因仓促强催而虚浮，可他盯着你身侧曲魂的眼神，贪婪得发亮。",
      { say: "古长老", emo: "cold", tone: "cold", text: "「玄阴诀的路数……你与极阴岛是什么干系？束手就擒，随本座走一趟——那丫头，也一并留下。」" },
      { say: "韩立", emo: "cold", tone: "low", text: "「她我护定了，我的来历更轮不到叛徒来问。要拦——便先问过我剑，和我身侧这位的刃。」" },
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
          Engine.recordTemperament("starsea_luan_help", "sentiment", "乱星海大乱·顺手拉起两名跌落的散修同遁·多一分凶险换几分人望——危难里不踩着别人走");
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
          Engine.recordTemperament("starsea_shijin_breed", "stoic", "得噬金虫·留几只做种不竭泽而渔·远虑——你算的是长远的账");
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
      { shot: "shock", scale: 1.1, px: 6 },
      { sfx: "thunderFar" },
      "天际骤然一暗，极远处的海面竟被一股无形威压齐齐压沉！极阴岛方向，一道身影孤身踏空而立。",
      { say: "韩立", emo: "shock", tone: "low", text: "「那威压……元婴中期巅峰？是星宫大长老金魁！他孤身踏临极阴岛——这是要当众示威。」" },
      { fx: "lightning", at: "center", elem: "jin", px: 0, ms: 600 },
      { sfx: "thunder" },
      { cam: "shake", px: 9 },
      "只见金魁信手一引，一道毁天灭地的法光当空轰落——极阴岛半壁山崖在惊天动地的轰鸣里崩成齑粉、沉入海底。这一击不为屠灭，为示威：逼那位极阴祖师现身，当众受训。乌丑等辈，早躲得不见踪影。",
      { wait: 700 },
      { shot: "pullOut", ms: 1500 },
      { aside: "一击碎半岛，点到即止——极阴岛的根基还在，可星宫收复内星海的先声已经敲响。仙凡有别，这等人物的棋局，眼下还轮不到我来落子——可这片海，怕是要为之再变一回了。" },
    ],
    onArrive(s) {
      s.location = "waixinghai";
      State.setFlag("starsea_jinkui_done");
      Engine.meetNpc("jinkui", "星宫大长老金魁，元婴中期巅峰。你于外海远远见他孤身踏临极阴岛、一击轰碎半岛示威——这等大修士的手段，只可远观。星宫收复内星海的棋局，自此落下第一子。");
      Engine.writeLedger("starsea_jinkui", "初入星海·三幕——星宫大长老金魁孤身踏临极阴岛、轰碎半岛当众示威、逼极阴祖师现身受训（岛与势力存续·乌丑远遁），星宫着手收复内星海。韩立于外海远观，识得元婴大修士之威（背景强者·在场远见）。");
      Engine.addMilestone("星海风云：远观金魁炸极阴岛·星宫收复内星海", "starsea");
      s.worldNews = s.worldNews || [];
      const t = `第${s.year}年${s.month}月`;
      // canon S5：金魁=炸毁部分示威·极阴岛势力存续（旧文案"老巢覆灭"与后文极阴反派线自相矛盾）
      s.worldNews.push({ t, kind: "world", text: "巨变：星宫大长老金魁孤身踏临极阴岛，信手轰碎半岛示威、逼极阴祖师现身受训——星宫着手收复内星海，乱星海格局再变。" });
      // canon S2 后置兑现（ep76）：风希斩雷鹏夺翅·继任妖王——大典救走的那一笔在外海收梢
      s.worldNews.push({ t, kind: "rumor", text: "外海骇闻：妖王雷鹏与裂风兽风希于外海摊牌——雷鹏以妖王之尊一战成全，风希斩之取风雷双翅，继任乱星海妖族新王。那对垂天之翅的下落，自此成谜。" });
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
   *  落户天星城 → 集齐资粮（雪灵水/天火液/大衍诀第四层）→ 首次结丹失败演出
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
      { say: "韩立", emo: "calm", tone: "low", text: "「内海第一都会，气象果然不同。在此落户置一处洞府，再闭关备齐资粮——结丹之关，便在这里叩了。」" },
      // canon P2·紫灵辞别（正典 ep72 分道·她自走妙音门复兴线）——衔接星海飞驰 xh_a1_miaoyin 门主重逢
      { wait: 500 },
      "安顿已定，紫灵却来向你郑重一拜。这些年跟着你外海漂泊，小姑娘的个子蹿高了、眼神也定了——她说，妙音门还有旧部散在内海，爹娘的门派，她要亲手撑回来。",
      { say: "汪凝", tone: "她仰起脸，眼睛亮得惊人", text: "「大哥哥，我要变得很强很强——强到再没有人能从我身边夺走谁。等我做到了，一定来寻你。」" },
      { aside: "你没有拦。有些路，只能自己走——你比谁都懂。你把攒下的一小袋灵石塞进她行囊，看着那道紫色的小身影消失在天都街的人潮尽头。" },
      { fx: "flash", at: "center", color: "#caa6ff", ms: 200 },
      { aside: "天都街上人潮如织，曾有两道惊才绝艳的身影擦肩而过，气度迥异于常人……可惜只是惊鸿一瞥，转瞬便没入了人海。（你心头掠过一丝异样，却也未及细想。）" },
    ],
    onArrive(s) {
      s.location = "tianxing_city";
      State.setFlag("starsea_tianxing_done");
      State.setFlag("tianxing_open");   // 解锁天星城（home·可 cultivate/breakthrough/alchemy）
      Engine.writeLedger("starsea_ziling_farewell", "天星城安顿后紫灵辞别——妙音门旧部散落内海，爹娘的门派她要亲手撑回来。「等我变得很强很强，一定来寻你」（远雷：星海飞驰篇妙音门门主重逢兑现）。");
      Engine.writeLedger("starsea_tianxing", "初入星海·四幕——韩立携外海妖丹返内海，落户星宫治下第一都会天星城，置洞府备齐结丹资粮叩关；紫灵辞别自走妙音门复兴线。天都街双骄惊鸿一瞥（cameo·仅留印象，羁绊正戏在后续篇章）。");
      Engine.addMilestone("初入星海·四幕：落户天星城（内海第一都会）", "starsea");
    },
    choices: [
      {
        text: "置洞府——着手集齐结丹资粮。",
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
          Engine.recordTemperament("starsea_tianxing_public", "sentiment", "天星城·公开露面广打听结丹消息·宁担注目之险也要入世求机——你不甘只做个隐者");
          return { text: "你在天都坊市公开露面，广打听结丹的消息——多了几分人望与线索，却也多了几分被人注目的风险。", kind: "event" };
        },
        resolve: "advance",
      },
    ],
  },

  // —— 第四幕②·集齐结丹资粮（雪灵水/天火液补齐＋大衍诀第四层蓄力·神识淬炼大成）——
  {
    id: "starsea_a4_ziliang",
    cg: "ziliang",
    skipIf: (s) => s.flags.starsea_ziliang_done,
    cond: (s) => s.flags.starsea_tianxing_done && !s.flags.starsea_ziliang_done,
    bgm: "journey",
    title: "天星城 · 集齐资粮",
    objTitle: "觅长生 · 攒资粮",
    objHint: "结丹是「觅长生」之关——备得越足，活路越宽。妖丹已积、降尘丹在手，再以天星城的财力补齐雪灵水、天火液，并以大衍诀入门法门把神识淬炼大成——结丹的本钱，一样样凑齐了。",
    text: [
      { scene: "天星城 · 洞府静室" },
      "结丹之关，最是凶险，可备得越足，活路便越宽——这是「觅长生」的道理。你在天星城的丹铺药行间奔走，以外海妖丹为本钱，将魁星城求而未得的两味灵药一一补齐。",
      { say: "韩立", emo: "serious", tone: "low", text: "「雪灵水一寒、天火液一热，一寒一热相济，方能把一身灵力反复压炼成丹。再加降尘丹涤去尘浊、妖丹温养——资粮，算是齐了。」" },
      { fx: "material", at: "center", elem: "shui", ms: 500 },
      { sfx: "cast" },
      "更要紧的是神识。二十载闭关加这一程外海历练，你的神识已远超同侪——是时候翻开那卷压箱多年的东西了。",
      // 大衍诀参研拍（返修池点名项）：残卷开卷=一段小演出，不再一句话带过——但不请大衍神君出场（正典他在很后面）
      { amb: "candle" },
      { shot: "pushIn", ms: 1300, scale: 1.14 },
      { wait: 400 },
      "静室烛火如豆。你自储物袋最深处取出那卷泛黄的兽皮古卷——《大衍诀》残卷，黄枫谷叶师叔之乱中拾得，贴身收了几十年。卷上蝌蚪古篆曾让你的神识一触即痛，今日指尖抚过，那些字竟一个个「浮」了起来。",
      { fx: "ambient", preset: "spirit" },
      { sfx: "cast" },
      { wait: 500 },
      { aside: "第一页入目的刹那，识海轰然一震——不是痛，是「开」。仿佛有人把你识海里一扇从未察觉的窗推开了一条缝：神识如水银泻地，静室梁上的每一粒尘、崖外每一声浪，纤毫毕现。这功法的来历深不可测，卷尾残缺处似乎还藏着什么……但眼下，入门法门足矣。" },
      { shot: "pullOut", ms: 1400 },
      { fx: "material", at: "center", elem: "mu", ms: 500 },
      { say: "韩立", emo: "calm", tone: "low", text: "「大衍诀入了门，神识已足。三转重元功一转的精纯真元、淬炼大成的神识、外海妖丹、降尘丹、雪灵水、天火液——结丹六资，齐备。」" },
      { aside: "万事俱备。可越是齐备，心里那根弦反倒绷得越紧——结丹的心魔，是平生执念所化，最难缠。这一关，终究要亲身去闯。" },
    ],
    onArrive(s) {
      s.location = "tianxing_city";
      State.setFlag("starsea_ziliang_done");
      // canon-audit S1：大衍诀高层与结丹无关（红尘劫=结丹后·第四层）——此处只立「入修」（结丹 require 改读 dayan_learned）；
      // dayan_layer3 唯一出处=红尘劫渡过（xh_a3_hongchen_du），层级因果链自此闭合
      State.setFlag("dayan_learned");   // 大衍诀入修·神识伴身位（slot 由 balance.js 自读）
      // M5·结丹备料多路径：外海猎妖已可挣雪灵水（寒潭海眼）/天火液（火鬣海蛟）——自己猎来的不再重复给；
      // 未挣到者此处仍以天星城财力补齐（兜底，主线不因运气卡死）
      const hadXue = State.count("xueling_shui") >= 1, hadHuo = State.count("tianhuo_ye") >= 1;
      if (hadXue || hadHuo) {
        Engine.log(`结丹两味主料，你在外海便已亲手挣下${hadXue && hadHuo ? "雪灵水与天火液" : hadXue ? "雪灵水" : "天火液"}——省下的灵石，是猎场里一刀一刀换来的。${hadXue && hadHuo ? "（两味俱全·分文未花）" : ""}`, "good");
        State.give("lingshi", hadXue && hadHuo ? 12 : 6);   // 自己挣来=省下购药灵石（时间投入的回报）
      }
      if (!hadXue) State.give("xueling_shui", 1);   // 雪灵水（凝丹灵材·结丹关 require/consume）
      if (!hadHuo) State.give("tianhuo_ye", 1);     // 天火液（淬丹真火·结丹关 require/consume）
      if (State.count("jiangchen_dan") < 1) State.give("jiangchen_dan", 1); // 降尘丹兜底（镇妖大典若漏得）
      // 远雷·惊变救人兑现（铁律3）：塌方里拽出的那位断腿散修——丙字丹铺的人情，在求药最难处开花
      if (Engine.settleLedger("jingbian_saved_one", "镇妖大典塌方里拽出的那位断腿散修，果真在丙字丹铺候着你——他辗转托同乡捎来一小匣上品凝神香并几味稀缺辅药：「恩公结丹，小人帮不上大忙，这点心意务必收下。」乱世星海，一命换来的人情最重")) {
        s.mood = Math.min(s.moodMax, s.mood + 5);
        State.give("ningshen_dan", 2);
      }
      Engine.settleLedger("dayan_clue", "黄枫谷叶师叔之乱中拾得的那卷《大衍诀》残卷，压箱多年——今日神识终于够格翻开第一页：结丹关前，它替你把神识淬炼到了如臂使指");
      Engine.settleLedger("dayan_remembered", "「总有一天，我会修得动它」——当年贴身收起残卷时的那句话，在天星城的洞府静室里兑了现");
      Engine.writeLedger("starsea_ziliang", "初入星海·四幕——集齐结丹资粮：大衍诀入修（dayan_learned·神识淬炼大成）、补齐雪灵水/天火液，合三转一转之精纯真元、外海妖丹、镇妖大典所得降尘丹，结丹六资齐备（喂 bigRealmRites.core）。");
      Engine.addMilestone("结丹资粮齐备：大衍诀入修＋雪灵水/天火液（觅长生·攒资源）", "starsea");
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
      { amb: "candle" },
      { cam: "zoom", scale: 1.05, ms: 320 },
      "静室之内，你盘膝凝神，引一身精纯真元向丹田汇聚，要将那盈满百窍的灵力反复压炼、凝散成丹。雪灵水寒、天火液炽，一寒一热在丹田里相搏——",
      { amb: null },
      { shot: "shock", scale: 1.14, px: 8 },
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
          hint: "灵力圆满后，于天星城（行动→突破）叩结丹之关——校验六资（三转一转/大衍诀第四层/降尘丹/雪灵水/天火液/妖丹×30＋道心澄明·心魔已伏），齐备即闯心魔劫（trialHp 360/13 回合）。胜则金丹大成 · 结丹初期。",
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
      { amb: "candle" },
      { cam: "zoom", scale: 1.08, ms: 360 },
      "这一回，当平生执念所化的心魔再度扑来，你已不再退避——青牛镇、墨大夫、七玄门、孤岛二十载……你一一受之、一一勘破，任它翻涌，自有一颗道心如磐。",
      { fx: "lightning", at: "center", elem: "jin", ms: 560 },
      { sfx: "thunder" },
      // ——凝丹拍（三拍：万籁俱寂的预兆 → 金丹落地的一声轻响 → 金光满室的余韵）——
      { amb: null },
      { wait: 600 },
      "心魔伏、真元聚，丹田之内，盈满百窍的灵力被你反复压炼、层层凝散——终于，「噗」的一声轻响，一枚温润生光的金丹，在丹田里凝成了。",
      { shot: "pushIn", ms: 900, scale: 1.14 },
      { fx: "burst", at: "center", elem: "jin", ms: 420 },
      { fx: "flash", color: "#ffe9ad", ms: 360 },
      { sfx: "success" },
      { say: "韩立", emo: "joy", tone: "low", text: "「成了……金丹大成！我韩立，结丹了！」" },
      "二十载孤岛苦修、镇妖大典的九死一生、外海猎妖的发家积淀、首番结丹的铩羽——尽数化作此刻丹田里这一点温润的金芒。这是你修仙以来，第一次能正面打得过同阶的扬眉吐气之时。",
      // ——故人钟：欢喜正盛时，远处一记极轻的钟——
      { shot: "pullOut", ms: 1500 },
      { sfx: "bell" },
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
          Engine.recordTemperament("starsea_jindan_calm", "stoic", "结丹大成·不喜形于色·视为又一个起点——心境愈沉，是你走得远的根");
          return { text: "你没有太过激动——结丹不过是修仙路上的又一个起点。前路更远、更险，心境反倒比方才更沉了几分。", kind: "event" };
        },
        resolve: "advance",
      },
    ],
  },

  /* ============================================================
   * 星海飞驰篇 · S1（章节注册 + 天星城主场景 + 结丹后日常）
   *   设计：docs/xinghaifeichi-design.md §十·10.1（节点 1-A / 1-C）
   *   切片边界：1-A 切章 + 帆①天星城日常（home 已可 cultivate/breakthrough/alchemy）
   *   + 1-C 妙音门·紫灵登场（蝎岛之战 S2 待续）。战斗/虚天殿等高风险切片后排。
   *   注：本批节点 APPEND 在 STORY 末尾——不移动既有 storyStage 索引，存档零迁移。
   * ============================================================ */

  // —— 节点 1-A·结丹后过渡（锚①·硬锚 cutscene·切入星海飞驰篇）——
  {
    id: "xh_a1_jieguo",
    skipIf: (s) => s.flags.xh_a1_done,
    cond: (s) => s.flags.arc5_complete && !s.flags.xh_a1_done,
    bgm: "town",
    title: "星海飞驰 · 金丹初成",
    objTitle: "结丹后 · 新程",
    objHint: "金丹既成，天星城的日子却与想象中不同——结丹初期的修士，在这片星海里不过刚刚站稳脚跟。先沉下心来，巩固金丹、打理日常。",
    text: [
      { scene: "天星城 · 洞府静室" },
      { cam: "zoom", scale: 1.06, ms: 320 },
      "丹田之内，那枚温润金丹缓缓旋转，吐纳间将百窍灵力压炼得越发凝实。结丹之后，识海开阔、神识倍增——你能清晰感到，体内那座『法力之池』比筑基时深了不止一倍。",
      { aside: "金丹大成的实惠，不止是打得过同阶。新的法术位、法宝悬浮祭出的余裕、伴身法宝的额外槽——结丹修士的底子，正一点点在你身上铺开。" },
      { scene: "天星城 · 坊市长街" },
      "推开洞府石门，天星城的喧嚣扑面而来。这座内星海中枢的修仙大都会，坊市林立、飞舟往来，结丹修士在街上不算稀奇——你这枚新成的金丹，在这里只是刚刚够格。",
      { say: "韩立", tone: "low", text: "「结丹，不过是又一个起点。这星海万里……该往哪里去？」" },
      "茶肆酒楼间，隐隐有传闻飘来：三百年一开的『虚天殿』将现世，内藏上古大能的至宝……你心头微动，却不动声色。修为未稳，凑这等热闹只是取死。",
      { aside: "正思忖间，一名妙音门的执事寻上门来，递来一封素笺邀帖——落款，是个你既陌生又莫名熟悉的名字。" },
    ],
    onArrive(s) {
      s.activeChapter = "xinghaifeichi";   // 切入星海飞驰篇（章名/境界上限 realmCap=22 由此读）
      s.location = "tianxing_city";
      State.setFlag("xh_a1_done");
      State.setFlag("tianxing_open");      // 防御性：确保天星城 home 可进（前篇应已设）
      s.flags.xh_a1_month = State.absMonth();   // 记录开篇月——帆①自由期满 2 月方触发 1-C 妙音门
      Engine.writeLedger("xh_a1_jieguo", "星海飞驰篇·开篇——金丹大成后落定天星城，结丹初期立身内星海中枢；虚天殿传闻初起，妙音门邀帖至。");
      Engine.addMilestone("星海飞驰篇·启：金丹初成·天星城立身", "xinghaifeichi");
      s.worldNews = s.worldNews || [];
      const t = `第${s.year}年${s.month}月`;
      s.worldNews.push({ t, kind: "world", text: "天星城：结丹散修韩立落户内星海中枢，于坊市间打理金丹后的修行日常。" });
      s.worldNews.push({ t, kind: "world", text: "星海传闻：三百年一开的『虚天殿』将现世之说渐起，内外星海诸多修士闻风而动。" });
      if (s.worldNews.length > 40) s.worldNews.splice(0, s.worldNews.length - 40);
    },
    choices: [
      {
        text: "低调闭关·先巩固金丹",
        hint: "结丹初期·稳为上——闭关/打理日常皆可",
        effect(s) {
          s.mood = Math.min(s.moodMax, (s.mood || 0) + 3);
          s.hp = s.hpMax;
          State.setFlag("xh_a1_lowkey");
          return { text: "你压下凑热闹的念头，回洞府静心吐纳——金丹初成，稳固为先。天星城的坊市、猎场、修炼，都随你慢慢打理。", kind: "good" };
        },
        resolve: "advance",
      },
      {
        text: "去坊市打听虚天殿的消息",
        hint: "远方=惦记——先探探风声",
        effect(s) {
          s.mood = Math.min(s.moodMax, (s.mood || 0) + 1);
          State.setFlag("xh_a1_curious");
          Engine.writeLedger("xh_a1_curious", "开篇即留意虚天殿风声——天生谨慎，先探后动。");
          return { text: "你在坊市茶肆间不动声色地听了几耳朵：虚天殿、虚天残图、上古至宝……传闻纷杂，真假难辨。心里有了底，眼下还是先把金丹养稳要紧。", kind: "good" };
        },
        resolve: "advance",
      },
    ],
  },

  // —— 节点 1-C·材料交易·妙音门线（锚②·地点锚·紫灵登场·蝎岛之战 S2 待续）——
  {
    id: "xh_a1_miaoyin",
    skipIf: (s) => s.flags.xh_a1_miaoyin_done,
    cond: (s) => s.flags.xh_a1_done && !s.flags.xh_a1_miaoyin_done && (State.absMonth() - (s.flags.xh_a1_month || 0) >= 2),
    where: "tianxing_city",
    bgm: "town",
    title: "天星城 · 妙音门商会",
    objTitle: "材料交易 · 紫灵邀约",
    objHint: "妙音门商会愿以公道价收购你外海挣下的妖兽材料，少主紫灵更亲递邀帖，要谈一桩合作。回天星城商会一见便知。",
    text: [
      { scene: "天星城 · 妙音门商会" },
      { amb: "market" },
      { shot: "establish" },
      "妙音门商会金碧辉煌，乐声隐隐。一名身着淡紫宫装的女修自屏风后转出——结丹气息温润内敛，眉眼间却有几分说不出的熟稔。",
      { shot: "focusLeft" },
      { say: "紫灵", emo: "calm", text: "「韩大哥，别来无恙。」" },
      { shot: "pushIn", ms: 1300, scale: 1.12 },
      { wait: 500 },
      { aside: "韩大哥……这称呼，这眉眼，还有那缕莫名让人心安的熟悉之感——你一时怔住。当年镇妖大典的乱军里，那个躲在你身后、哭着说『就剩我一个了』的小丫头汪凝，竟已长大成这般模样。" },
      { say: "紫灵", emo: "smile", text: "「这些年，我做到了当初说的——变得很强很强。如今妙音门的事，多半也由我做主了。」" },
      "她不提那些旧事，只笑吟吟地引你入座：妙音门商会愿以公道价收购你外海挣下的妖兽材料；另有一桩差事，想请你这位结丹道友帮衬。",
      { say: "紫灵", tone: "low", text: "「妙音门正缺一位结丹期的客卿长老。报酬么——」她顿了顿，眸光微亮，「绝不会亏待故人。」" },
      { aside: "（你心头那缕莫名的熟悉始终散不去，却又说不上来由——只当是救命之缘的余温。这丫头的心计眼界，早已不是当年那个孤雏了。）" },
    ],
    onArrive(s) {
      s.location = "tianxing_city";
      Engine.meetNpc("zi_ling", "镇妖大典惊变中你从乱军里救下的孤雏汪凝（小紫灵），如今已长大成人——结丹修为、妙音门门主，名动内星海的紫灵。");
      State.setFlag("xh_a1_miaoyin_done");
      // 远雷·天星城辞别兑现（P2·紫灵线）：「等我变得很强很强，一定来寻你」——她做到了
      Engine.settleLedger("starsea_ziling_farewell", "天星城街头那道说着「等我变得很强很强」的紫色小身影，如今以妙音门门主之姿坐在你面前——她果真把爹娘的门派，亲手撑了回来，也果真来寻你了");
      Engine.writeLedger("xh_miaoyin_meet", "天星城妙音门商会重逢长大成人的紫灵（汪凝）——她以门主之姿邀韩立任结丹客卿长老、收购外海妖材，蝎岛之战的线头自此牵起。故人钟·墨彩环转世的软伏笔在『莫名熟悉』里轻轻应了一声（不写死）。");
      Engine.addMilestone("星海飞驰篇·妙音门线：紫灵重逢·客卿邀约", "xinghaifeichi");
    },
    choices: [
      {
        text: "答应合作·先把外海妖材交易了",
        hint: "妙音门客卿——蝎岛之战将启（待续）",
        effect(s) {
          State.give("lingshi", 200);
          State.setFlag("xh_miaoyin_ally");
          Engine.writeLedger("xh_miaoyin_ally", "应下妙音门客卿长老之职、交易外海妖材（灵石+200）——与紫灵/妙音门结深，蝎岛之战将以妙音门一员入局。");
          return { text: "你应下了客卿之职，外海积攒的妖兽材料尽数交予妙音门商会，换得灵石二百。紫灵眉眼舒展：「那蝎岛的差事，便托付韩大哥了——只是眼下时机未到，且容我从长计议。」", kind: "good" };
        },
        resolve: "advance",
      },
      {
        text: "只卖材料·客卿之事容后再议",
        hint: "保持独立——蝎岛之战延后（待续）",
        effect(s) {
          State.give("lingshi", 120);
          State.setFlag("xh_miaoyin_trade_only");
          return { text: "你只将妖材作了交易，换得灵石一百二，客卿之事婉言推后。紫灵也不勉强，只浅浅一笑：「韩大哥还是这般谨慎。无妨，门常开着，差事也留着。」", kind: "event" };
        },
        resolve: "advance",
      },
    ],
  },
  // —— 节点 2-A·蝎岛团战（锚③·硬锚·sides combat·妙音门 vs 隐煞门）——
  {
    id: "xh_a2_xiedao",
    skipIf: (s) => s.flags.xh_a2_xiedao_done,
    cond: (s) => s.flags.xh_a1_miaoyin_done && !s.flags.xh_a2_xiedao_done,
    bgm: "combat",
    title: "蝎岛 · 妙音门 vs 隐煞门",
    objTitle: "团战 · 侧翼突入",
    objHint: "随妙音门赴蝎岛、强攻隐煞门据点。紫灵居中调度，两位客卿正面牵制，你带曲魂自侧翼突入——荡平隐煞门弟子。",
    text(s) {
      const ally = s.flags.xh_miaoyin_ally;
      const t = [
        { scene: "蝎岛 · 隐煞门据点" },
        "浪涛拍岸，蝎岛礁石嶙峋。妙音门倾巢而出，强攻隐煞门据点——这是内星海两家积怨已久的一仗。",
      ];
      if (ally) {
        t.push({ say: "紫灵", emo: "calm", text: "「韩大哥，两位客卿替你正面牵制，你随我从侧翼切进去。隐煞门那些弟子，先清了。」" });
      } else {
        t.push({ aside: "你虽只应了'卖材料'、未受客卿之名，紫灵仍以一份薄面请你出手——你便以散修身份，自侧翼旁助一臂。" });
      }
      t.push(
        "隐煞门弟子结阵迎来，金煞刀光森森。乱军之中，一道身影却悄然往后退去——是妙音门客卿赵峥。紫灵眼角余光扫过，却不动声色。",
        { aside: "（这场仗，似乎不只是'攻打据点'这么简单……）" },
      );
      return t;
    },
    choices: [
      { text: "迎战 · 随紫灵自侧翼突入", hint: "荡平隐煞门弟子（团战）", resolve: "xh_xiedao_fight" },
    ],
  },

  // —— 节点 2-B·紫灵做局（锚④·硬锚·关键抉择 3 选 1）——
  {
    id: "xh_a2_zuoling",
    skipIf: (s) => s.flags.xh_a2_zuoling_done,
    cond: (s) => s.flags.xh_a2_xiedao_done && !s.flags.xh_a2_zuoling_done,
    bgm: "tense",
    title: "蝎岛 · 紫灵的棋局",
    objTitle: "做局 · 钓极阴",
    objHint: "攻打隐煞门只是幌子——紫灵真正的盟友是星宫金魁：蝎岛是饵、孙门主（极阴叛徒）是钓极阴岛现身的饵料，顺手还要清掉星宫派驻的内奸赵峥。她要你配合杀赵峥。",
    // canon-audit X1（2026-07-10 勘正·腾讯20231209+movie-247 官方梗概双源）：紫灵的盟友=星宫金魁（非孙门主）；
    // 孙门主=极阴叛徒（持虚天残图·乌丑师叔）——是这局棋的**饵**；赵峥/符长老=星宫派驻妙音门的客卿（内奸·暗通极阴）
    text: [
      { scene: "蝎岛 · 礁石背风处" },
      "战事既歇，紫灵屏退左右，向你低声开口——礁石那头，隐煞门孙门主犹自负隅，浑然不知自己在这局棋里是什么角色。",
      { say: "紫灵", tone: "low", text: "「韩大哥可看出来了？这一仗，是我与星宫金魁大长老合作做的局。蝎岛是饵——那位孙门主，是极阴老祖叛出的弟子、手里还捏着虚天殿的残图。打他，就是钓极阴岛的人现身。」" },
      { aside: "原来'攻打隐煞门'只是台面——真正的棋盘上坐着星宫。而这局里她还要顺手清一样东西：混在妙音门里的蛀虫。这女子的心计……不愧是那缕'熟悉'之人。" },
      { say: "紫灵", emo: "calm", text: "「赵峥、符长老——星宫派驻门中的客卿，却暗通极阴岛、出卖门中机密。赵峥已被我暗算、护体寸裂，真元逆乱。韩大哥可愿替我，了结这个叛徒？」" },
    ],
    onArrive(s) {
      State.setFlag("xh_a2_zuoling_done");
      Engine.meetNpc("sun_menzhu", "隐煞门门主——极阴老祖叛出的弟子（乌丑的师叔），手握虚天殿残图。他自以为据岛称雄，实则是紫灵与星宫合谋钓极阴现身的一枚饵。");
    },
    choices: [
      {
        text: "配合紫灵 · 击杀赵峥",
        hint: "妙音门关系最深 · 客卿长老顺理成章",
        effect(s) {
          State.setFlag("xh_zuoling_ally");
          return { text: "你颔首应下。既已看清这局棋，便替她落下这一子——勾结极阴岛的叛徒，留不得。", kind: "good" };
        },
        resolve: "advance",
      },
      {
        text: "质疑紫灵 · 要求解释",
        hint: "谨慎为先 · 紫灵尊重你的持重",
        effect(s) {
          State.setFlag("xh_zuoling_question");
          s.mood = Math.min(s.moodMax, (s.mood || 0) + 2);
          return { text: "你不急着动手，先要她把前因后果说个明白。紫灵也不恼，将赵峥通敌的证据一一道来——你这才点头。谨慎，是你一贯的活法。", kind: "good" };
        },
        resolve: "advance",
      },
      {
        text: "独走 · 不掺和内部清算",
        hint: "保持独立 · 后续逃亡难度增（赵峥仍活）",
        effect(s) {
          State.setFlag("xh_zuoling_solo");
          return { text: "你摇头——妙音门的家务事，你不愿沾手。紫灵深深看你一眼，也不勉强。赵峥趁这空隙，遁走了。", kind: "event" };
        },
        resolve: "advance",
      },
    ],
  },

  // —— 节点 2-C·击杀赵峥（锚④续·Combat·配合/质疑径才有·独走 skip）——
  {
    id: "xh_a2_zhaozheng",
    skipIf: (s) => s.flags.xh_zuoling_solo || s.flags.xh_a2_zhaoyu_done,
    cond: (s) => (s.flags.xh_zuoling_ally || s.flags.xh_zuoling_question) && !s.flags.xh_a2_zhaoyu_done,
    bgm: "combat",
    title: "蝎岛 · 困兽赵峥",
    objTitle: "了结 · 勾结极阴岛的叛徒",
    objHint: "赵峥被紫灵暗算，护体法宝已裂、真元逆乱——只剩个空架子。但困兽犹斗，不可大意。",
    text: [
      { scene: "蝎岛 · 礁石背风处" },
      "赵峥自知事败，再不掩饰，厉声反扑——可他护体灵光时明时暗，真元逆乱，那身结丹中期的修为已是空壳。",
      { say: "赵峥", emo: "angry", text: "「你们早有预谋——极阴岛不会放过你们的！」" },
    ],
    choices: [
      { text: "出手 · 了结赵峥", hint: "削弱版恶战 · 困兽犹斗", resolve: "xh_zhaozheng_fight" },
    ],
  },

  // —— 节点 2-D·极阴现身（锚⑤·硬锚·观战演出·3 选 1 旁观）——
  {
    id: "xh_a2_jiyin",
    skipIf: (s) => s.flags.xh_a2_jiyin_done,
    cond: (s) => s.flags.xh_a2_zuoling_done && !s.flags.xh_a2_jiyin_done,
    bgm: "sorrow",
    title: "蝎岛 · 极阴现身",
    objTitle: "元婴之威 · 不可敌",
    objHint: "一道幽冷身影自天际降临——乌丑。可他身上那股气息，绝非结丹期……极阴祖师，以附身之法借乌丑行事。藏拙，是唯一的活法。",
    text: [
      { scene: "蝎岛 · 阴云骤合" },
      { amb: null },
      { shot: "shock", scale: 1.12, px: 8 },
      { sfx: "danger" },
      { fx: "flash", color: "#2a3040", alpha: 0.35, ms: 500 },
      "叛徒既清，众人正欲收兵——海天交界处，一道幽冷身影破空而降。是逆星盟的乌丑。",
      { shot: "focusLeft" },
      { say: "乌丑", tone: "苍老阴冷、不似本人", text: "「妙音门的小丫头，倒会做局……可惜，本座要的人，你们动不得。」" },
      { shot: "pushIn", ms: 1400, scale: 1.15 },
      { wait: 600 },
      { aside: "那声音……绝不是乌丑本人！苍老、阴冷、煌煌如渊——是元婴！极阴祖师，以附身之法借乌丑的口在说话。孙门主竟被一招活捉。藏拙！这等存在，结丹修士连喘息都是奢侈。" },
    ],
    onArrive(s) {
      State.setFlag("xh_a2_jiyin_done");
      Engine.meetNpc("jiyin_zushi", "极阴岛岛主、元婴初期顶峰的老怪物——以附身之法借乌丑行事。蝎岛上空一现身，便活捉孙门主，元婴威压煌煌如渊。");
      Engine.meetNpc("wuchou", "逆星盟黑袍乌丑——此刻成了极阴祖师附身行事的傀儡。");
    },
    choices: [
      {
        text: "全力藏拙 · 屏息隐匿",
        hint: "结丹小修的活法——别被元婴神识扫到",
        effect(s) {
          s.mood = Math.max(0, (s.mood || 0) - 2);
          State.setFlag("xh_jiyin_hidden");
          return { text: "你将气息敛到极致，如一粒微尘隐于乱军——极阴的神识扫过，未作停留。藏拙，是凡人韩立刻进骨子里的本能。", kind: "good" };
        },
        resolve: "advance",
      },
      {
        text: "趁乱暗记极阴的手法",
        hint: "险中取知——对极阴功法有所了解（远期）",
        effect(s) {
          s.mood = Math.max(0, (s.mood || 0) - 4);
          State.setFlag("xh_jiyin_observe_deep");
          Engine.writeLedger("xh_jiyin_observe", "蝎岛·极阴现身——冒险暗记极阴附身控魂、活捉孙门主的手法路数。日后若与极阴一脉再交手，这一线对其功法的了解便是伏笔。");
          return { text: "你冒着被神识扫中的风险，死死记下极阴附身控魂、举手活捉结丹门主的手法。多看一眼是一眼——这等元婴的路数，日后或许用得上。", kind: "event" };
        },
        resolve: "advance",
      },
      {
        text: "立刻催遁术先逃",
        hint: "保命为先——被威压波及但脱身更快",
        effect(s) {
          s.hp = Math.max(1, Math.round(s.hp * 0.95));
          State.setFlag("xh_jiyin_flee");
          return { text: "你不作他想，催动遁术抢先撤离。元婴余威扫过，气血一荡——但你已遁出了那片死域。命，比什么都要紧。", kind: "event" };
        },
        resolve: "advance",
      },
    ],
  },

  // —— 节点 2-E·逃亡·天都炼傀追杀（锚⑥·硬锚·survive 战）——
  {
    id: "xh_a2_taowang",
    skipIf: (s) => s.flags.xh_a2_taowang_done,
    cond: (s) => s.flags.xh_a2_jiyin_done && !s.flags.xh_a2_taowang_done,
    bgm: "combat",
    title: "蝎岛 · 天都炼傀追杀",
    objTitle: "逃亡 · 撑到海底遁避",
    objHint: "杀赵峥惊动了极阴岛，一具结丹中期的天都炼傀循气追来。硬拼无益——撑到白玉蜘蛛吐丝掩护、遁入海底即脱身。",
    text: [
      { scene: "蝎岛外海 · 追亡" },
      "退离蝎岛途中，一具通体玄铁的傀儡循气追来——天都炼傀，结丹中期的追杀利器，循气追命、一步躲不开。",
      { aside: "硬拼无益。好在白玉蜘蛛尚在身畔——它那漫天蛛丝，足以将这傀儡迟滞片刻。撑住，遁入海底暗流就走得脱。" },
    ],
    choices: [
      { text: "且战且退 · 撑到遁入海底", hint: "survive · 白玉蜘蛛吐丝掩护", resolve: "xh_taowang_fight" },
    ],
  },

  // —— 节点 2-F·客卿长老·天雷竹（帆②·地点锚·大件链起点·S2 收口）——
  {
    id: "xh_a2_keqing",
    skipIf: (s) => s.flags.xh_a2_keqing_done,
    cond: (s) => s.flags.xh_a2_taowang_done && !s.flags.xh_a2_keqing_done,
    bgm: "town",
    title: "妙音门 · 客卿长老",
    objTitle: "客卿 · 天雷竹 · 虚天残图",
    objHint: "海底遁避一月后，紫灵正式邀你任妙音门客卿长老，以三大神木之一『天雷竹』为报；又将金魁因蝎岛之功赐予她的『虚天残图』取出，邀你同探。青竹蜂云剑与虚天殿的引线，齐了。",
    text: [
      { scene: "天星城 · 妙音门商会" },
      "海底遁避一月，风声渐歇。紫灵于商会设宴，郑重邀你正式担任妙音门客卿长老——这一回，是货真价实的名分。",
      { say: "紫灵", emo: "smile", text: "「蝎岛一事，多谢韩大哥。这份报酬，旁人求都求不来——」她取出一只玉匣，匣中一截青翠竹枝，竹节间隐隐雷纹游走。" },
      { aside: "天雷竹——界中三大神木之一！这正是青竹蜂云剑的命材。再以小绿瓶催熟为万年金雷竹，那七十二口本命飞剑，便有了根。" },
      { say: "紫灵", tone: "low", text: "「还有一桩——蝎岛清查叛徒之功，金魁大长老赐了我一片『虚天残图』。」她将残卷轻轻推到你面前，「三百年一开的虚天殿要现世了……韩大哥，可愿与我同探？」" },
      { aside: "原来这虚天残图，是紫灵从金魁处得来的赏赐——她竟愿与你共此通天之线。天雷竹、小绿瓶、虚天残图……本命法宝的线索，与那座龙潭虎穴的引线，竟在同一日齐了。只是这天雷竹催熟需时，催熟之前，还有一道红尘劫要渡——那是后话了。" },
    ],
    onArrive(s) {
      s.location = "tianxing_city";
      State.give("tianlei_zhu", 1);
      State.give("xutian_tucan", 1);
      State.setFlag("xh_a2_keqing_done");
      State.setFlag("xh_keqing_accept");
      Engine.writeLedger("xh_tianlei_zhu", "妙音门客卿之报——紫灵赠三大神木『天雷竹』（青竹蜂云剑命材·待小绿瓶催熟为万年金雷竹）；又将金魁因蝎岛清查叛徒之功赐予她的『虚天残图』与韩立共探（残图源出金魁→紫灵→共享·非金魁直授韩立）。大件链与虚天殿引线齐备。");
      Engine.addMilestone("星海飞驰·客卿长老：天雷竹入手·与紫灵共探虚天殿（虚天残图源出金魁赐紫灵）", "xinghaifeichi");
      s.worldNews = s.worldNews || [];
      const t = `第${s.year}年${s.month}月`;
      s.worldNews.push({ t, kind: "fortune", text: "妙音门：散修韩立受聘为结丹期客卿长老，得赐神木一截。" });
      s.worldNews.push({ t, kind: "world", text: "星海传闻：三百年一开的『虚天殿』将现世，星宫已暗中遣人勘定方位、赐图于功臣。" });
      if (s.worldNews.length > 40) s.worldNews.splice(0, s.worldNews.length - 40);
    },
    choices: [
      {
        text: "接下天雷竹 · 着手催熟",
        hint: "青竹蜂云剑大件链启动——红尘劫在前（待续）",
        effect(s) {
          return { text: "你郑重收下天雷竹与虚天残图。这截神木催熟需以年月计，催熟之前，还有大衍诀第四层的红尘劫要渡——本命法宝之路，自此铺开。", kind: "good" };
        },
        resolve: "advance",
      },
      {
        text: "先细问虚天殿的门道",
        hint: "远方=惦记——多探一分虚实",
        effect(s) {
          Engine.writeLedger("xh_xutian_curious", "接天雷竹之余，先向紫灵细问虚天殿门道——虚天殿探索时多一条线索。");
          s.mood = Math.min(s.moodMax, (s.mood || 0) + 1);
          return { text: "你收下神木，却先就虚天殿多问了几句。紫灵将所知尽数相告：三关、元婴老怪云集、内藏通天灵宝……你默默记下。多知一分，少险一分。", kind: "good" };
        },
        resolve: "advance",
      },
    ],
  },
  // —— 节点 3-0·天雷竹催熟（帆③→锚·小绿瓶催熟天雷竹→万年金雷竹·叙事时间压缩）——
  {
    id: "xh_a3_cuishu",
    skipIf: (s) => s.flags.xh_a3_cuishu_done,
    cond: (s) => s.flags.xh_a2_keqing_done && !s.flags.xh_a3_cuishu_done,
    bgm: "journey",
    title: "洞府 · 催熟天雷竹",
    objTitle: "小绿瓶 · 万年金雷竹",
    objHint: "天雷竹催熟需以年月计——所幸你有那只七玄门带出的小绿瓶。日夜以其灵液温养，催数十年之功于数载，方得『万年金雷竹』，青竹蜂云剑的成材。",
    text: [
      { scene: "天星城 · 洞府静室" },
      { cam: "zoom", scale: 1.04, ms: 300 },
      "你将天雷竹移入洞府静室，取出那只伴你半生的小绿瓶——自青牛镇墨大夫处得来的至宝，催灵第一神物。",
      "一滴灵液落下，天雷竹便贪婪地舒展开来；日夜温养，数载光阴压着数十年之功，那截青翠竹枝一寸寸转作流金，竹身雷纹奔涌如活物。",
      { fx: "material", at: "center", elem: "mu", ms: 600 },
      { sfx: "success" },
      { say: "韩立", emo: "calm", tone: "low", text: "「万年金雷竹……成了。七十二口本命飞剑的料，齐了。」" },
      { aside: "可金雷竹虽熟，炼剑却还须再等——大衍诀第四层未圆，神识不足以同时驭使七十二口飞剑。那道『红尘劫』，是绕不过去的关。" },
    ],
    onArrive(s) {
      s.location = "tianxing_city";
      State.setFlag("xh_a3_cuishu_done");
      if (State.count("tianlei_zhu") > 0) State.take("tianlei_zhu", 1);
      State.give("jinleizhu", 1);
      s.year += 5; s.age = (s.age || 0) + 5;
      Engine.writeLedger("xh_jinleizhu", "以小绿瓶灵液催熟天雷竹·数载温养得『万年金雷竹』（青竹蜂云剑成材）。炼剑尚须渡大衍诀第四层红尘劫——神识圆满方可驭七十二剑。");
      Engine.addMilestone("星海飞驰·万年金雷竹炼成（青竹蜂云剑成材·待红尘劫后开炉）", "xinghaifeichi");
    },
    choices: [
      { text: "金雷竹既成——去渡那道红尘劫", hint: "大衍诀第四层·入世修心（待续）", resolve: "advance" },
    ],
  },

  // —— 节点 4-0·红尘劫·入世（锚⑦·独占玩法开场·青竹小轩开张）——
  {
    id: "xh_a3_hongchen_open",
    skipIf: (s) => s.flags.xh_a3_hongchen_open_done,
    cond: (s) => s.flags.xh_a3_cuishu_done && !s.flags.xh_a3_hongchen_open_done,
    cg: "qingzhu",
    bgm: "daily",
    title: "红尘劫 · 青竹小轩",
    objTitle: "入世修心 · 开张",
    objHint: "大衍诀第四层须渡红尘劫——非闭关可成，唯入世可破。你在天星城凡人区盘下一间小铺，唤作『青竹小轩』，卖些符箓丹药给凡人。人间疾苦，皆是修行。",
    text: [
      { scene: "天星城 · 凡人坊巷" },
      { amb: "market" },
      { shot: "establish" },
      "大衍诀第四层的修炼之法，玄之又玄：不在闭门苦参，而在入世历劫——所谓『红尘劫』，要你于市井烟火里照见人心、磨砺道念。",
      "你寻了天星城凡人区一处僻静街角，盘下一间小铺，挂上『青竹小轩』的幌子。柜上摆些最浅近的符箓、丹药，卖给那些连修士都算不上的凡人。",
      { say: "韩立", tone: "low", text: "「修了这些年仙……倒是头一回，这样近地看着凡人的日子。」" },
      { shot: "pushIn" },
      { aside: "青牛镇的爹娘、墨大夫、七玄门……那些尘封的旧影，竟在这市井烟火里一一浮了上来。这一关，渡的不是劫，是自己的心。" },
    ],
    onArrive(s) {
      s.location = "tianxing_city";
      State.setFlag("xh_a3_hongchen_open_done");
    },
    choices: [
      { text: "开张——看一看这红尘众生", hint: "入世修心，照见人心", resolve: "advance" },
    ],
  },

  // —— 节点 4-1·红尘小故事·情侣定情符（凡人小故事①·帮/不帮·心境）——
  {
    id: "xh_a3_hc_couple",
    skipIf: (s) => s.flags.xh_a3_hc_couple_done,
    cond: (s) => s.flags.xh_a3_hongchen_open_done && !s.flags.xh_a3_hc_couple_done,
    bgm: "daily",
    title: "青竹小轩 · 仙凡一对",
    objTitle: "红尘 · 仙凡之隔",
    objHint: "一名刚入练气的年轻修士，领着青梅竹马的凡人姑娘来求一道驻颜延寿的符——他要随师门远行修行，少则数十年，怕归来时她已白头。仙凡之隔，最是磨人。",
    text: [
      { scene: "青竹小轩 · 柜前" },
      { amb: "candle" },
      "一个练气初期的年轻修士站在柜前，身旁依着个荆钗布裙的凡人姑娘。「先生……可有驻颜、延寿的符？我要随师门去远方修行，少则数十年……」他声音发紧，攥紧了姑娘的手，「我怕回来时，她已经……」",
      { shot: "pushIn", ms: 1400 },
      { aside: "仙凡之隔，最是无解。你看着那姑娘强撑的笑脸，恍了一恍——很多年前，嘉元城里也有过这样一张脸。" },
    ],
    onArrive(s) { State.setFlag("xh_a3_hc_couple_done"); },
    choices: [
      {
        text: "赠符·并实言相劝仙凡有别",
        hint: "点破却不忍——心境+",
        effect(s) {
          s.mood = Math.min(s.moodMax, (s.mood || 0) + 4);
          Engine.writeLedger("hongchen_helped_couple", "红尘劫·仙凡一对求驻颜符——你赠了符，却实言相告：凡人的寿数仙符也续不得，劝他莫负眼下相守的光阴。柜前那一恍，是很多年前嘉元城里一张没敢回头的脸。");
          return { text: "你画了道安神驻颜的浅符递过去，却没瞒他：「符能护她安康，却扳不动凡人寿数。仙凡一途，最难两全——能守的光阴，莫负了。」那修士眼圈一红，重重点头。门外天光正好。你转身去寻符纸，没让他看见自己的脸色。", kind: "good" };
        },
        resolve: "advance",
      },
      {
        text: "只卖符·不多言他人姻缘",
        hint: "公道买卖——无对错",
        effect(s) {
          Engine.writeLedger("hongchen_helped_couple", "红尘劫·仙凡一对求驻颜符——你只照价卖符，不掺和他人姻缘。公道买卖，可那对仙凡背影，到底在心里硌了一下。");
          return { text: "你照实收了符钱，旁的一概不言——他人的姻缘，与你何干？那修士谢过，扶着姑娘出了门。望着那一前一后的身影，你站在柜后，半晌没有动。", kind: "event" };
        },
        resolve: "advance",
      },
    ],
  },

  // —— 节点 4-2·红尘小故事·小龙（凡人小故事·有灵根少年混帮派半残·韩立救治·暗示小绿瓶已耗尽）——
  // 触发序为第二个（情侣→小龙→老者）。物理顺序＝触发顺序（checkStory 严格 storyStage+1，勿打乱）。
  {
    id: "xh_a3_hc_bully",
    skipIf: (s) => s.flags.xh_a3_hc_bully_done,
    cond: (s) => s.flags.xh_a3_hc_couple_done && !s.flags.xh_a3_hc_bully_done,
    bgm: "tense",
    title: "青竹小轩 · 半残的少年",
    objTitle: "红尘 · 埋没的灵根",
    objHint: "一个唤作小龙的少年被街坊抬进小轩——浑身是伤。你搭脉一探，竟发现他天生有灵根、本该是修仙的料，却为讨生活混了帮派，被打成半残。可惜了。",
    text: [
      { scene: "青竹小轩 · 门口" },
      { amb: "rain" },
      { shot: "shock", scale: 1.1, px: 6 },
      "几个街坊七手八脚把一个浑身是伤的少年抬进来：「先生救救他！小龙这孩子跟错了人，被帮派的打成这样……」",
      { shot: "pushIn", ms: 1200 },
      "你伸手搭上他的脉门，心头微微一动——这少年竟天生有灵根，本是块修仙的好料子，却生生埋在市井泥潭里，混帮派混到半身残废。",
      // canon X2 勘正：掌天瓶灵液按日自凝、不存在"耗尽"——只是近年积蓄尽数喂了金雷竹、眼下无存货
      { aside: "若手头还有小绿瓶的存货，滴几滴灵液温养，这点伤、这条灵根，都能救得回来。可近年凝出的每一滴，都喂了那截万年金雷竹——眼下瓶中空空，新液又须经年累月地攒。如今的你，反倒要像青牛镇的墨大夫当年那样，靠一身药理，一寸寸地拼。" },
    ],
    onArrive(s) { State.setFlag("xh_a3_hc_bully_done"); },
    choices: [
      {
        text: "倾力救治·以药理接续他的经脉",
        hint: "无小绿瓶·全凭药理硬救——心境+",
        effect(s) {
          s.mood = Math.min(s.moodMax, (s.mood || 0) + 4);
          s.skills = s.skills || {}; s.skills.alchemy = (s.skills.alchemy || 0) + 1;
          Engine.writeLedger("hongchen_helped_bully", "红尘劫·救治有灵根的半残少年小龙——没了小绿瓶，全凭一身药理一寸寸接续他的断脉。救回一条灵根，也照见自己当年那个攥着灵根的凡人少年（药理+1）。");
          return { text: "你没了那只催灵神瓶，便像个寻常郎中一样，一味味地配药、一寸寸地接他断裂的经脉。数月之后，小龙能下地了，灵根也保住了。你只淡淡叮嘱他一句：「这身根骨，莫再糟践了。」（药理+1）", kind: "good" };
        },
        resolve: "advance",
      },
      {
        text: "止住伤势·点醒他灵根之事",
        hint: "救命+指路·让他自己选",
        effect(s) {
          s.mood = Math.min(s.moodMax, (s.mood || 0) + 2);
          Engine.writeLedger("hongchen_helped_bully", "红尘劫·止住小龙伤势、点醒他身负灵根——救命指路，路怎么走由他自己选。一句话或许就改了一个凡人少年的一生。");
          return { text: "你先止住他的伤势，临了点了一句：「你这身子骨，本是修仙的料。混帮派，是把好端端一条命往泥里踩。」少年怔怔地望着你，眼里第一次有了别的光。路怎么走，是他自己的事了。", kind: "good" };
        },
        resolve: "advance",
      },
    ],
  },

  // —— 节点 4-3·红尘小故事·棋友坐化（凡人小故事·收束高潮·数十年棋友·遗书·韩立顿悟）——
  // 美学铁律（用户明令）：收敛·含蓄·留白——真正震撼的是说不清的余味，不是写满的字。
  //   遗书用 CG+分镜+逐句台词演绎；韩立反应极简；偈语顿悟留到「渡过」节点爆发，此处只留余味。
  //   遗书全文为动漫红尘劫经典台词（用户提供原文·一字未改）；老者=与韩立手谈数十年的男性老修士。
  // 触发序为第三个（情侣→小龙→老者），紧接「渡过」节点。物理顺序＝触发顺序（checkStory 严格 storyStage+1）。
  {
    id: "xh_a3_hc_elder",
    skipIf: (s) => s.flags.xh_a3_hc_elder_done,
    cond: (s) => s.flags.xh_a3_hc_bully_done && !s.flags.xh_a3_hc_elder_done,
    cg: "hongchen",
    bgm: "sorrow",
    title: "青竹小轩 · 一局未了",
    objTitle: "红尘 · 棋友坐化",
    objHint: "这些年里，常有一位老者来青竹小轩与你手谈。你们下了一局又一局，从不论修为来历。这日你如常赴约，他却已坐化在棋枰前——只留下一纸遗书，和一局没有下完的残棋。",
    text: [
      { scene: "青竹小轩 · 棋枰前" },
      { amb: "market" },
      { sfx: "goClick" },
      "这些年里，常有一位白发老者来青竹小轩，与你手谈一局。你不问他来历修为，他不问你深浅——只论棋。一局又一局，下了几十年。",
      // ——发现坐化：市声骤收=世界安静下来（静默也是设计）+ 缓缓推近——
      { amb: null },
      { shot: "pushIn", ms: 1500, scale: 1.1 },
      { wait: 500 },
      "这一日，他没有抬头。老人安静地伏在棋枰上，气息早断，走得像是睡着了。棋盘黑白未终，一角压着一纸字。",
      { aside: "（你没有惊动谁，只默默在惯常的位置坐下——像每一局那样。）" },
      { fx: "flash", color: "#d8c9a0", ms: 260 },
      { say: "遗书", tone: "苍老的笔迹", text: "「吾幼时好棋，名震乡野，人皆谓神童。年岁稍长，遇一山野老道，三日对弈，终得一胜——老道愿赌服输，施展法术，通天遁地。吾顿生神往，遂弃棋修道。」" },
      { say: "遗书", tone: "笔迹渐淡", text: "「可惜吾天赋一般，只求兢兢业业、苦心钻研，不惜远家人、抛爱侣、弃友人，漂泊四海，无所依绊。几经险境，半生贫苦，老来方有定所——可惜，时日无多。」" },
      { say: "遗书", tone: "墨色沉沉", text: "「近来常思：人生百年，蜉蝣一日，长生于我何有哉？不过又入樊笼尔。不若二三好友，弈棋饮酒；良缘佳侣，人间携手——风光百年，同归尘土。」" },
      { shot: "pushIn", ms: 900, scale: 1.16 },
      { say: "遗书", tone: "笔锋忽重", text: "「但，问道之心，终归难改。纵使蹉跎一生，也要争那一线天机——只因幼时便知：人生如棋，落子无悔。」" },
      { shot: "pullOut", ms: 1600 },
      { aside: "落款没有名姓。窗外日影偏了偏，小轩里很静。有些东西堵在胸口，说不上来，却再也化不开。" },
    ],
    onArrive(s) { State.setFlag("xh_a3_hc_elder_done"); },
    choices: [
      {
        text: "替他下完这最后一局残棋",
        hint: "无言的告别——收子入盒",
        effect(s) {
          s.mood = Math.min(s.moodMax, (s.mood || 0) + 6);
          s.demon = Math.max(0, (s.demon || 0) - 4);
          // 一手一手替他下完：棋子落枰声错落三记，渐轻——无言的告别
          if (typeof Sfx !== "undefined") [0, 900, 2100].forEach(t => setTimeout(() => Sfx.play("goClick"), t));
          Engine.writeLedger("hongchen_helped_elder", "红尘劫·与你手谈数十年的老者坐化于棋枰前，只留一纸『人生如棋，落子无悔』的遗书——你默默替他下完了那局残棋，收子入盒。说不清的东西堵在胸口，那是红尘劫真正的份量（顿悟留到出关时）。");
          return { text: "你没有说话，执起棋子，替他把那局残棋一手手地下完，而后收子入盒。窗外日影一寸寸移过柜台。\n\n有些懂得，是从这一刻起的——说不出，却再也忘不掉。", kind: "good" };
        },
        resolve: "advance",
      },
      {
        text: "收起遗书·默坐一局的工夫",
        hint: "留白——有些事不必说出口",
        effect(s) {
          s.mood = Math.min(s.moodMax, (s.mood || 0) + 6);
          s.demon = Math.max(0, (s.demon || 0) - 4);
          Engine.writeLedger("hongchen_helped_elder", "红尘劫·与你手谈数十年的老者坐化于棋枰前，留下『人生如棋，落子无悔』的遗书——你将它叠好收入袖中，在惯常的位置默坐了许久，一子未落。有些事不必说出口（顿悟留到出关时）。");
          return { text: "你把那纸遗书叠好，收进袖中，在惯常的位置默默坐了很久，一子未落。临走时，轻轻合上了棋盒。\n\n小轩外，人来人往，一如往常。", kind: "good" };
        },
        resolve: "advance",
      },
    ],
  },

  // —— 节点 4-4·红尘劫·渡过（锚⑦收口·30年弹指·侧重3选1·Build三路）——
  {
    id: "xh_a3_hongchen_du",
    skipIf: (s) => s.flags.xh_a3_hongchen_done,
    cond: (s) => s.flags.xh_a3_hc_elder_done && !s.flags.xh_a3_hongchen_done,
    cg: "hongchen_du",
    bgm: "triumph",
    title: "红尘劫 · 渡过",
    objTitle: "三十年 · 一朝悟道",
    objHint: "青竹小轩开了三十年。生老病死、悲欢离合，你都看在眼里、记在心上。某个寻常的午后，你忽然心念通明——大衍诀第四层，成了。",
    text: [
      { scene: "青竹小轩 · 三十年后" },
      { amb: "market" },
      { shot: "establish" },
      "三十年，弹指而过。仙凡情侣的离合、有灵根少年的浮沉、那位棋友留在棋枰上的最后一局……青竹小轩的柜台后，你看尽了一茬又一茬的红尘众生。",
      "这一日午后，阳光斜照进小轩，你正给一个孩童画着平安符——忽然心念一通，万般尘缘如潮水般在识海里涨落又退去，澄澈如洗。",
      // ——顿悟拍：市声退去=尘缘落潮，金光迸现+古钟一记——
      { amb: null },
      { shot: "pushIn", ms: 1000, scale: 1.12 },
      { fx: "burst", at: "center", elem: "jin", ms: 420 },
      { fx: "flash", color: "#ffe9ad", ms: 300 },
      { sfx: "bell" },
      { say: "韩立", emo: "joy", tone: "low", text: "「原来如此……大衍诀第四层，要的不是闭门苦参，是这三十年的红尘。生老病死，因缘聚合，世间纷繁，皆有其意；迷之则轮回苦，悟之则天地宽——神识，圆满了。」" },
      { shot: "pullOut", ms: 1500 },
      { aside: "红尘劫渡过，大衍诀第四层大成。神识之广，已足以同时驭使七十二口飞剑——青竹蜂云剑，可以开炉了。" },
    ],
    onArrive(s) {
      s.location = "tianxing_city";
      State.setFlag("xh_a3_hongchen_done");
      State.setFlag("dayan_layer3");   // 大衍诀第四层大成（神识圆满·可驭72剑）——flag 名保留 layer3 仅为存档兼容（canon S1/X3 勘正）
      s.year += 30; s.age = (s.age || 0) + 30;
      Engine.writeLedger("xh_hongchen", "红尘劫渡过·30年入世修心——青竹小轩看尽红尘众生，一朝心念通明，大衍诀第四层大成（神识圆满·足驭72飞剑）。");
      Engine.addMilestone("红尘劫渡过·大衍诀第四层大成（神识圆满）", "xinghaifeichi");
      // 远雷·红尘小故事兑现（铁律3）：青竹小轩里那对仙凡情侣、那个有灵根的少年小龙、那位对弈迎关的老者，正是渡过红尘劫的道心养料——点名出处
      let hcEcho = 0;
      if (Engine.settleLedger("hongchen_helped_couple", "那对仙凡情侣后来如何，你已无从知晓——可当年柜前那一句『能守的光阴莫负了』，何尝不是说给某个早已模糊的旧影听。那点意难平，红尘劫替你轻轻放下了")) hcEcho += 2;
      if (Engine.settleLedger("hongchen_helped_bully", "那个有灵根的少年小龙，听说真的离了帮派、寻了正经修行的门路——你当年没了小绿瓶、全凭药理硬救回的那条根骨，到底没有白费。救他，原也是渡自己")) hcEcho += 2;
      if (Engine.settleLedger("hongchen_helped_elder", "棋枰前那位下了几十年棋的老者，到底没能等到结丹——可那纸『人生如棋，落子无悔』的遗书，你记到了今天。问道之心终归难改，纵蹉跎一生也要争那一线天机：他用一条命，替你把红尘劫的最后一子落定了")) hcEcho += 4;
      if (hcEcho) s.mood = Math.min(s.moodMax, (s.mood || 0) + hcEcho);
    },
    choices: [
      {
        text: "苦修大衍诀·神识更进一层",
        hint: "剑道侧重——神识控剑",
        effect(s) {
          s.sense = (s.sense || 0) + 3;
          return { text: "你将这三十年的感悟尽数化入大衍诀，神识又厚实了一分。日后驭使飞剑、布设阵法，皆赖这缕日益广阔的神识（神识+3）。", kind: "good" };
        },
        resolve: "advance",
      },
      {
        text: "悟道红尘·道心更澄一寸",
        hint: "心境侧重——道心稳则万事稳",
        effect(s) {
          s.mood = Math.min(s.moodMax, (s.mood || 0) + 12);
          s.demon = Math.max(0, (s.demon || 0) - 10);
          return { text: "你将这三十年的悲欢化作道心的养分——红尘看尽，反生出一份'看山仍是山'的通透。心境大涨、心魔消减，往后无论炼丹渡劫，都多了一份稳如磐石的定力（心境+12·心魔-10）。", kind: "good" };
        },
        resolve: "advance",
      },
      {
        text: "制符积药·把这三十年的手艺攒下",
        hint: "丹道/阵法侧重——制符即阵法之基",
        effect(s) {
          s.skills = s.skills || {};
          s.skills.alchemy = (s.skills.alchemy || 0) + 3;
          State.give("lingshi", 80);
          return { text: "三十年卖符卖药，手上的功夫也实打实地涨了。出关时，你的丹道符法都比从前精熟了几分，柜上积攒的灵石也颇为可观（丹道熟练+3·灵石+80）。", kind: "good" };
        },
        resolve: "advance",
      },
    ],
  },

  // —— 节点 5-0·青竹蜂云剑炼成（锚⑧·终极大件兑现·本命法宝成·用户最在意节点）——
  {
    id: "xh_a3_lianjian",
    skipIf: (s) => s.flags.xh_a3_lianjian_done,
    cond: (s) => s.flags.xh_a3_hongchen_done && !s.flags.xh_a3_lianjian_done,
    cg: "jindan",
    bgm: "triumph",
    title: "青竹蜂云剑 · 炼成",
    objTitle: "本命法宝 · 七十二口飞剑",
    objHint: "红尘劫渡过、神识圆满，万年金雷竹也已成材。是时候开炉——以金雷竹为胎、辟邪神雷为魂，炼就七十二口本命飞剑。这是韩立战力质变的一刻。",
    text: [
      { scene: "天星城 · 洞府炼器室" },
      { amb: "candle" },
      { cam: "zoom", scale: 1.06, ms: 360 },
      "洞府深处，地火幽幽。你取出万年金雷竹，以圆满的神识为引、地火为炉，一节节金雷竹在烈焰中抽丝、淬炼、塑形——",
      { fx: "material", at: "center", elem: "mu", ms: 500 },
      { amb: null },
      { sfx: "swordWhoosh" },
      { fx: "flash", color: "#bfead0", alpha: 0.3, ms: 520 },
      "七十二道青碧剑光自炉中飞起，绕着你的身周盘旋成阵，剑随神念、应念分袭。金雷竹本蕴的辟邪神雷被你一并炼入剑身——青芒之间，金雷游走。",
      { fx: "lightning", at: "center", elem: "jin", ms: 560 },
      { sfx: "thunder" },
      { shot: "pushIn", ms: 1100, scale: 1.14 },
      { say: "韩立", emo: "joy", tone: "low", text: "「七十二口青竹蜂云剑……成了！剑随心动、雷随剑发——这一回，我韩立，总算有了一件真正的本命法宝。」" },
      { fx: "burst", at: "center", elem: "mu", ms: 420 },
      { sfx: "success" },
      { shot: "pullOut", ms: 1400 },
      { wait: 600 },
      { aside: "剑成之时，剑阵深处似有一缕微弱的灵识一闪而过——旋即又沉寂了下去，仿佛从未醒来。" },
    ],
    onArrive(s) {
      s.location = "tianxing_city";
      State.setFlag("xh_a3_lianjian_done");
      if (State.count("jinleizhu") > 0) State.take("jinleizhu", 1);
      State.give("qingzhu_fengyun_jian", 1);   // 持有即入战：playerFighter 注入 qingzhu_jian + 辟邪神雷二式 + charges.shenlei
      // 远雷·金银书页合璧兑现（P2·书页线）：合璧残文所载七十二剑炼制之法，在此开炉应验
      Engine.settleLedger("qingyuan_quanben", "金银书页合璧时隐约显出的那式『金雷竹炼七十二剑』之法，今日开炉应验——封岳身上的金页、藏书阁的银页，绕了两个篇章，在这座炼器室里合成了你的本命法宝");
      Engine.writeLedger("xh_qingzhu_jian", "青竹蜂云剑炼成（本命法宝·大件兑现）——万年金雷竹为胎、辟邪神雷为魂，炼就72口青碧飞剑：swordOrbit 绕身剑阵、剑随神念分袭、辟邪神雷可附剑/横扫（克邪魔×1.8）。器灵银月尚沉睡（待虚天殿狼首玉如意苏醒）。韩立战力自此质变。");
      Engine.addMilestone("青竹蜂云剑炼成（本命法宝·七十二口飞剑·辟邪神雷·战力质变）", "medal");
      if (typeof Sfx !== "undefined") Sfx.play("success");
      Engine.toast("本命法宝到手：青竹蜂云剑（战斗自动入战·辟邪神雷三式）");
    },
    choices: [
      {
        text: "立即试剑·感受这七十二口飞剑之威",
        hint: "战斗中即可驭剑·辟邪神雷三式登场",
        effect(s) {
          s.mood = Math.min(s.moodMax, (s.mood || 0) + 10);
          return { text: "你心念一动，七十二口飞剑齐齐震鸣、绕身急旋——剑随神念，收发由心。", kind: "good" };
        },
        resolve: "advance",
      },
      {
        text: "闭关参悟·与飞剑神识相合",
        hint: "剑道轴推进·人剑相合更深",
        effect(s) {
          s.sense = (s.sense || 0) + 2;
          return { text: "你没有急着出关，而是静心参悟人剑相合之道。七十二缕神念与七十二口飞剑日渐相契——驭剑愈发如臂使指（神识+2）。", kind: "good" };
        },
        resolve: "advance",
      },
    ],
  },
  // —— 节点 6-A·金青邀约·古修士洞府（锚⑨·练手前奏·组队/独行 2选1）——
  {
    id: "xh_a4_guxiushi",
    skipIf: (s) => s.flags.xh_a4_guxiushi_intro_done,
    cond: (s) => s.flags.xh_a3_lianjian_done && !s.flags.xh_a4_guxiushi_intro_done,
    bgm: "journey",
    title: "古修士洞府 · 金青邀约",
    objTitle: "练手 · 入殿前奏",
    objHint: "旧识金青寻来，邀你同探一处古修士遗址——石蝶、老胡同行，正好试试新成的青竹蜂云剑。这是踏入虚天殿前的练手。",
    text: [
      { scene: "外星海 · 古修士遗址外" },
      "本命法宝既成，你正欲择日往虚天殿一探，旧识金青却寻上门来——他探得一处古修士遗址，邀你同去练手淘宝。",
      { say: "金青", emo: "smile", text: "「韩道友！这古修士洞府机关重重，寻常人进不去。石蝶老胡都是老搭档，路上有个照应——同去开开眼界？」" },
      { aside: "去虚天殿之前，正好拿这古修士洞府试试七十二口青竹蜂云剑的成色。只是……你心底那点说不清的不安，是从何而来？" },
    ],
    onArrive(s) {
      s.location = "tianxing_city";
      State.setFlag("xh_a4_guxiushi_intro_done");
      Engine.meetNpc("jin_qing", "乱星海一名结丹散修、消息灵通的旧交——邀韩立同探古修士遗址练手。");
    },
    choices: [
      {
        text: "与金青组队探索",
        hint: "团队探索·金青入战侧助",
        effect(s) {
          State.setFlag("xh_guxiushi_team");
          return { text: "你与金青一行结伴而入。石蝶老胡在前探路，金青与你押后——人多照应，稳妥些。", kind: "good" };
        },
        resolve: "advance",
      },
      {
        text: "独自先行探路",
        hint: "独行·多一分险、多一分得（灵石+）",
        effect(s) {
          State.setFlag("xh_guxiushi_solo");
          State.give("lingshi", 20);
          return { text: "你谢过金青的好意，独自先行——你这般修为，反倒嫌人多碍事。一路暗格机关被你摸了个透，顺手淘换了些散碎灵石（灵石+20）。", kind: "good" };
        },
        resolve: "advance",
      },
    ],
  },

  // —— 节点 6-A 战·古修士洞府守卫（Combat·青竹蜂云剑首战）——
  {
    id: "xh_a4_guxiushi_fight",
    skipIf: (s) => s.flags.xh_a4_guxiushi_done,
    cond: (s) => s.flags.xh_a4_guxiushi_intro_done && !s.flags.xh_a4_guxiushi_done,
    bgm: "combat",
    title: "古修士洞府 · 宝室之守",
    objTitle: "练手 · 石蝶与老胡",
    objHint: "宝室之前，石蝶（远程法修）与老胡（甲坚横练）拦路。试试新成的青竹蜂云剑与辟邪神雷——这是本命法宝的第一战。",
    text: [
      { scene: "古修士洞府 · 宝室前" },
      "层层机关之后，一座宝室赫然在目，石蝶老胡守在阶前。你心念一引——七十二口青竹蜂云剑应念出鞘，绕身成阵。",
      { aside: "本命法宝的第一战。石蝶走位刁钻须贴身逼杀，老胡甲坚如铁须破甲——辟邪神雷，正好破他这身横练。" },
    ],
    choices: [
      { text: "出手 · 青竹蜂云剑首战", hint: "石蝶远程·老胡甲坚（练手恶战）", resolve: "xh_guxiushi_fight" },
    ],
  },

  // —— 节点 6-B·玄骨夺曲魂（锚⑩·硬锚·cutscene·情感冲击·失去曲魂）——
  {
    id: "xh_a4_xuangu",
    skipIf: (s) => s.flags.xh_a4_xuangu_done,
    cond: (s) => s.flags.xh_a4_guxiushi_done && !s.flags.xh_a4_xuangu_done,
    bgm: "sorrow",
    title: "玄骨上人 · 夺舍",
    objTitle: "曲魂 · 失去",
    objHint: "宝室深处，鬼骷髅现身——金青被一击秒杀。你眼睁睁看着玄骨上人夺舍了曲魂的身躯。从七玄门一路陪伴至今的曲魂，在这一刻……失去了。",
    text: [
      { scene: "古修士洞府 · 宝室深处" },
      { amb: null },
      { shot: "shock", scale: 1.12, px: 9 },
      { sfx: "danger" },
      "宝室深处骤起阴风，一具鬼骷髅自黑暗里飘出——元婴级的死气铺天盖地压下。金青甚至来不及惨叫，便被一击打得形神俱灭。",
      { say: "玄骨", tone: "森冷", text: "「这具尸傀的躯壳……倒是难得的好皮囊。」" },
      { aside: "鬼骷髅的目光，落在了你身畔的曲魂身上。你想拦——可在元婴级的威压下，你连动一根手指都艰难万分。" },
      { shot: "pushIn", ms: 1100, scale: 1.16 },
      "一道鬼气没入曲魂体内。那具从青牛镇张铁、到七玄门尸傀、再到身外化身、一路沉默地陪你从天南走到星海的躯壳，竟被玄骨生生夺舍占据。",
      { fx: "flash", color: "#9fb8a8", ms: 260 },
      // ——失去拍：世界静下来，只剩他叫不回来的那个名字——
      { wait: 700 },
      { aside: "张铁……铁奴……曲魂。那个憨厚地说『以后你就是我兄弟』的少年，那具替你挡过无数刀光的身外化身——在这一刻，被夺走了。从今往后，并肩的位置，空了。" },
      { say: "韩立", emo: "anger", tone: "low", text: "「……曲魂！」" },
    ],
    onArrive(s) {
      s.location = "tianxing_city";
      State.setFlag("xh_a4_xuangu_done");
      Engine.meetNpc("xuangu", "本名萧诧、改修鬼道的前元婴后期老怪——古修士洞府中一击秒杀金青、夺舍曲魂身躯重获肉身。日后虚天殿的终战之敌。");
      s.sideUnit = null;                 // 曲魂被夺——侧位永久失去
      State.setFlag("quhun_lost");       // 防 _migrate 老档补发再生曲魂
      s.demon = Math.min(100, (s.demon || 0) + 8);
      s.mood = Math.max(0, (s.mood || 0) - 10);
      Engine.writeLedger("xh_quhun_lost", "古修士洞府·玄骨夺曲魂——鬼骷髅萧诧一击秒杀金青、夺舍曲魂身躯重获肉身。从青牛镇张铁、七玄门尸傀、身外化身一路陪伴至今的曲魂，自此失去（侧位永久移除·情感低谷·心魔+8）。这笔账，留待虚天殿终战。");
      Engine.addMilestone("曲魂被夺·情感低谷（玄骨夺舍·终战之敌结仇）", "story");
      s.worldNews = s.worldNews || [];
      const t = `第${s.year}年${s.month}月`;
      s.worldNews.push({ t, kind: "sorrow", text: "古修士洞府：散修金青身死，韩立失其相伴多年的身外化身曲魂——夺舍者，一个改修鬼道的元婴老怪。" });
      if (s.worldNews.length > 40) s.worldNews.splice(0, s.worldNews.length - 40);
    },
    choices: [
      {
        text: "暴怒出手 · 辟邪神雷劈向玄骨",
        hint: "玄骨记下你有辟邪神雷·终战他有防备",
        effect(s) {
          s.mood = Math.max(0, (s.mood || 0) - 3);
          State.setFlag("xh_xuangu_rage");
          Engine.writeLedger("xh_xuangu_react", "玄骨夺曲魂·暴怒——辟邪神雷劈向玄骨却被轻松挡下，玄骨记住了你有此物（终战他有防备）。");
          return { text: "你再忍不住，一道金色神雷劈出！玄骨随手一挡，鬼气翻卷间冷笑：「辟邪神雷？有点意思。」——他记住了你的底牌。你重伤之下，被迫退走。", kind: "bad" };
        },
        resolve: "advance",
      },
      {
        text: "强忍怒火 · 藏拙示弱",
        hint: "玄骨轻视你·终战他轻敌",
        effect(s) {
          State.setFlag("xh_xuangu_endure");
          Engine.writeLedger("xh_xuangu_react", "玄骨夺曲魂·强忍——藏拙示弱、不露辟邪神雷，玄骨只当你是个寻常结丹小修（终战他轻敌）。");
          return { text: "你死死压住翻涌的杀意，佯作惊惧退避。玄骨扫你一眼，懒得多顾——一个结丹小修罢了。藏拙的本能，让你把辟邪神雷的底牌，死死藏住了。这笔账，来日再算。", kind: "event" };
        },
        resolve: "advance",
      },
      {
        text: "趁乱撤退 · 保命为先",
        hint: "中间路线·留得青山",
        effect(s) {
          s.hp = Math.max(1, Math.round((s.hp || s.hpMax) * 0.9));
          State.setFlag("xh_xuangu_flee");
          Engine.writeLedger("xh_xuangu_react", "玄骨夺曲魂·撤退——保命为先、趁乱遁走，玄骨未追。曲魂之仇，记在心里。");
          return { text: "你强压悲愤，催遁光趁乱遁走。玄骨夺舍方成、肉身未稳，懒得追击。你逃出洞府，胸中那口血气堵得发疼——曲魂的仇，你记下了。", kind: "event" };
        },
        resolve: "advance",
      },
    ],
  },
  // —— 节点 4-C·虚天殿现世·入殿（锚·大限钟·三百年一开·不可回头）——
  {
    id: "xh_a4_xutian_enter",
    skipIf: (s) => s.flags.xh_a4_xutian_enter_done,
    cond: (s) => s.flags.xh_a4_xuangu_done && !s.flags.xh_a4_xutian_enter_done,
    bgm: "tense",
    title: "虚天殿 · 现世",
    objTitle: "入殿 · 三百年一开",
    objHint: "循着虚天残图的指引，虚天殿现世了。你与紫灵一同步入——禁制在身后轰然合拢，三百年一开的龙潭虎穴，自此再无回头路。元婴老怪们，也都来了。",
    text: [
      { scene: "虚天殿 · 殿门" },
      { cam: "zoom", scale: 1.05, ms: 340 },
      "失曲魂之痛尚未平复，虚天残图却已灼灼发烫——三百年一开的虚天殿，现世了。你与紫灵循图而入，巨大的殿门在身后轰然合拢。",
      { aside: "这一进来，没有禁制松开之前是出不去的。殿中早已不止你们——极阴祖师、蛮胡子、青易居士……一个个元婴级的恐怖气息，在殿宇深处若隐若现。一个结丹小修，要在这群老怪之间求生、夺宝。藏拙，求活。" },
      { say: "紫灵", tone: "low", text: "「韩大哥，殿中三关，闯过去才能到内殿。万事小心——这里头，没一个是善茬。」" },
    ],
    onArrive(s) {
      s.location = "tianxing_city";
      State.setFlag("xh_a4_xutian_enter_done");
      Engine.writeLedger("xh_xutian_enter", "虚天殿现世——循虚天残图入殿、禁制合拢不可回头。极阴/蛮胡子/青易居士三元婴入场，韩立携紫灵闯外殿三关。");
      Engine.addMilestone("虚天殿现世·入殿（三关之始·元婴云集）", "xinghaifeichi");
    },
    choices: [
      { text: "步入虚天殿 · 闯外殿三关", hint: "鬼冤之地 → 冰火道 → 极妙幻境", resolve: "advance" },
    ],
  },

  // —— 节点 4-D·第一关·鬼冤之地（Combat·辟邪神雷克鬼首秀）——
  {
    id: "xh_a4_guiyuan",
    skipIf: (s) => s.flags.xh_a4_guiyuan_done,
    cond: (s) => s.flags.xh_a4_xutian_enter_done && !s.flags.xh_a4_guiyuan_done,
    bgm: "combat",
    title: "虚天殿 · 第一关 · 鬼冤之地",
    objTitle: "鬼冤之地 · 辟邪神雷克鬼",
    objHint: "第一关阴灵弥漫，鬼王驱使阴灵兽扑来。辟邪神雷专克邪魔鬼物（×1.8）——这是本命法宝克鬼的首秀。先清阴灵、再以神雷集火鬼王。",
    text: [
      { scene: "虚天殿 · 鬼冤之地" },
      "踏入第一关，阴风惨惨、怨煞冲天。鬼王自阴雾深处浮现，身侧阴灵兽嘶吼着扑来。",
      { aside: "邪魔鬼物……正是辟邪神雷的克星。金雷一引，七十二剑齐鸣——是时候让这些阴物，尝尝青竹蜂云剑缠雷的滋味了。" },
    ],
    choices: [
      { text: "出手 · 辟邪神雷破鬼冤", hint: "神雷克邪魔×1.8（首秀）", resolve: "xh_guiyuan_fight" },
    ],
  },

  // —— 节点 4-E·第二关·冰火道·熔岩路（Combat·铁火蚁群·噬金虫对决）——
  {
    id: "xh_a4_binghuo",
    skipIf: (s) => s.flags.xh_a4_binghuo_done,
    cond: (s) => s.flags.xh_a4_guiyuan_done && !s.flags.xh_a4_binghuo_done,
    bgm: "combat",
    title: "虚天殿 · 第二关 · 冰火道",
    objTitle: "冰火道 · 铁火蚁群",
    objHint: "第二关冰火道分熔岩路与玄晶道。你择熔岩路而入——金魁暗设的陷阱里，本不该有的铁火蚁群涌出。隐约还有一道女子呼救声……以噬金虫对耗铁火蚁。",
    text: [
      { scene: "虚天殿 · 冰火道 · 熔岩路" },
      "冰火道一分为二：熔岩路炽热如炉，玄晶道极寒刺骨。你择熔岩路而入——岩浆翻涌间，一群甲坚如熔铁的铁火蚁如赤潮涌来。",
      { aside: "铁火蚁……奇虫榜第九，与我的噬金虫同源相克。岩壁那头隐约传来一道女子的呼救——先杀穿这群火蚁再说！" },
    ],
    choices: [
      { text: "出手 · 噬金虫对耗铁火蚁", hint: "甲坚火属·虫群对决", resolve: "xh_binghuo_fight" },
    ],
  },

  // —— 节点 4-E2·元瑶重逢·啼魂兽获取（story·新侧位·填补曲魂之缺）——
  {
    id: "xh_a4_yuanyao",
    skipIf: (s) => s.flags.xh_a4_yuanyao_done,
    cond: (s) => s.flags.xh_a4_binghuo_done && !s.flags.xh_a4_yuanyao_done,
    bgm: "town",
    title: "冰火道 · 元瑶 · 啼魂兽",
    objTitle: "救人 · 得啼魂兽",
    objHint: "你从铁火蚁群中救下一位戴面纱的结丹女修——元瑶。她为谢恩欲以身相许、又献上青火雷三枚，皆被你婉拒。你只看中了她随身那头天生克鬼的灵兽：啼魂兽。",
    text: [
      { scene: "虚天殿 · 冰火道 · 岩壁后" },
      "杀穿火蚁，岩壁后一位戴面纱的结丹女修正被困死角——你出手援之。她自称元瑶，为复活亡友而入虚天殿寻养魂木。",
      { say: "元瑶", emo: "calm", text: "「道友救命之恩，元瑶无以为报……愿以身相许，或这三枚青火雷——魔道青阳门秘制，一枚可抵元婴一击——皆赠予道友。」" },
      { aside: "以身相许？青火雷？都不必。你的目光，落在她身侧那头通体幽碧、正啼啼低鸣的小兽身上——啼魂兽，天生吞噬精魂、克制鬼物。曲魂走后空着的那个位置……或许，正该是它。" },
      { say: "韩立", tone: "low", text: "「这些都不必。元瑶道友若过意不去……便将这头啼魂兽，连同鸣魂珠，赠予我罢。」" },
    ],
    onArrive(s) {
      s.location = "tianxing_city";
      State.setFlag("xh_a4_yuanyao_done");
      Engine.meetNpc("yuan_yao", "为复活亡友妍丽而入虚天殿寻养魂木的结丹女修——冰火道中为韩立所救，赠啼魂兽+鸣魂珠。还阳术之事留外海风云篇。");
      State.give("mingshun_zhu", 1);
      // 啼魂兽：填补曲魂之缺的新侧位·天生克鬼物（slays ghost/demon ×2）
      s.sideUnit = { id: "tihun_shou", name: "啼魂兽", kind: "beast", art: null,
        hp: 95, hpMax: 95, atk: 18, atkName: "吞魂啮咬", move: 2,
        nature: "beast", elem: "shui", slays: { ghost: 2, demon: 2 }, guard: 0.3, status: "ok", carry: true,
        persona: { aggr: 6, prot: 3, kite: 2 },
        moves: [
          { name: "吞魂啮咬", dmg: 18, weight: 12, range: [1, 1], slays: { ghost: 2, demon: 2 }, elem: "shui", line: "啼魂兽扑上撕咬、吞噬精魂——对鬼物邪魔尤为致命" },
          { name: "啼魂摄魄", dmg: 14, weight: 6, range: [1, 3], slays: { ghost: 2, demon: 2 }, elem: "shui", line: "啼魂兽一声幽鸣，摄魂之音荡开" },
        ] };
      Engine.writeLedger("xh_tihun_get", "冰火道·救元瑶——婉拒以身相许与青火雷×3，只取啼魂兽+鸣魂珠。啼魂兽天生克鬼物精魂（slays ghost/demon ×2），填补曲魂走后的侧位——这是玄骨终战收尾残魂的关键底牌。");
      Engine.addMilestone("虚天殿·啼魂兽到手（新侧位·天生克鬼·终战底牌）", "xinghaifeichi");
      Engine.toast("侧位随行：啼魂兽（天生克鬼物）");
    },
    choices: [
      {
        text: "收下啼魂兽与鸣魂珠 · 带元瑶过道",
        hint: "新侧位·克鬼底牌（玄骨终战关键）",
        effect(s) {
          s.mood = Math.min(s.moodMax, (s.mood || 0) + 4);
          return { text: "元瑶将啼魂兽与鸣魂珠郑重交予你。那小兽歪头打量你片刻，竟亲昵地蹭了蹭你的衣袖。你带着元瑶一道穿过冰火道——空了的侧位，重新有了温度。", kind: "good" };
        },
        resolve: "advance",
      },
    ],
  },

  // —— 节点 4-F·极阴收徒·三元婴赠宝（story·藏拙周旋·得婆罗珠/青冥针/皇鳞甲）——
  {
    id: "xh_a4_sanyuanying",
    skipIf: (s) => s.flags.xh_a4_sanyuanying_done,
    cond: (s) => s.flags.xh_a4_yuanyao_done && !s.flags.xh_a4_sanyuanying_done,
    bgm: "tense",
    title: "虚天殿 · 三元婴博弈",
    objTitle: "藏拙周旋 · 各怀鬼胎",
    objHint: "三位魔道元婴盯上了你那能拉虚天鼎的血玉蜘蛛。极阴强收你为徒，玄骨（萧诧）暗示你拜极阴更稳妥；蛮胡子、青易居士各赠宝物拉拢。各怀鬼胎——你便藏拙周旋，照单全收。",
    text: [
      { scene: "虚天殿 · 殿宇深处" },
      "三关将半，三位元婴老怪却先后寻上了你——因你那只能拉动虚天鼎的白玉蜘蛛。",
      { say: "极阴祖师", tone: "森冷", text: "「这小子的白玉蜘蛛，拉鼎正合用。本座收你为徒——不得拒绝。」" },
      { aside: "夺了曲魂身躯的玄骨（萧诧）在一旁，竟以传音暗示你：拜极阴更稳妥，此人更危险、不宜结仇。你心知肚明——三个老怪都想利用你拉鼎，用完即弃。既如此，藏拙周旋、宝物照收便是。" },
      { say: "蛮胡子", tone: "豪烈", text: "「小子，老夫这件皇鳞甲给你——能挡元婴一击。别问为什么，先收下！」" },
      { say: "青易居士", emo: "smile", text: "「韩道友，这枚青冥针权当见面礼……虚天殿凶险，有我青易照拂。」" },
      { aside: "极阴赠婆罗珠（安神定魂，过极妙幻境正用得上）、蛮胡子赠皇鳞甲（保命）、青易赠青冥针（防身+日后冒充其徒的信物）。三件礼，三把算计——你一一收下，心里却跟明镜似的。" },
    ],
    onArrive(s) {
      s.location = "tianxing_city";
      State.setFlag("xh_a4_sanyuanying_done");
      Engine.meetNpc("man_huzi", "魔道元婴中期巨擘——赠皇鳞甲拉拢韩立（元婴大战中替韩立挡下致命一击的保命法宝）。");
      Engine.meetNpc("qingyi_jushi", "南鹤岛元婴初期散修——赠青冥针符宝、虚情假意收徒，日后成韩立冒充其徒出殿的信物。");
      State.give("boluo_zhu", 1);
      State.give("huanglin_jia", 1);
      State.give("qingming_zhen", 1);
      Engine.writeLedger("xh_sanyuanying", "虚天殿三元婴博弈——极阴强收韩立为徒（玄骨暗示拜极阴更稳）、三元婴各赠宝物拉拢：极阴婆罗珠（过极妙幻境）、蛮胡子皇鳞甲（保命）、青易青冥针（防身+出殿冒充信物）。各怀鬼胎觊觎血玉蜘蛛，韩立藏拙周旋、照单全收。");
      Engine.addMilestone("虚天殿·三元婴赠宝（婆罗珠/皇鳞甲/青冥针·藏拙周旋）", "xinghaifeichi");
    },
    choices: [
      {
        text: "拜入极阴门下 · 藏拙周旋（玄骨建议）",
        hint: "动漫核定·更稳妥·照收三宝",
        effect(s) {
          State.setFlag("xh_baibai_jiyin");
          Engine.writeLedger("xh_baibai_jiyin", "拜入极阴门下（藏拙之举·玄骨建议·极阴更危险不宜结仇）——名为师徒，实为相互利用。");
          return { text: "你依玄骨暗示，恭敬拜入极阴门下。极阴皮笑肉不笑地受了——双方都清楚，这师徒名分不过是各取所需的幌子。三件宝物，你尽数收入囊中。", kind: "event" };
        },
        resolve: "advance",
      },
      {
        text: "虚与委蛇 · 不拜师只收礼",
        hint: "保持距离·埋下隐患",
        effect(s) {
          State.setFlag("xh_baibai_refuse");
          Engine.writeLedger("xh_baibai_jiyin", "婉拒极阴拜师、只收三元婴赠礼——保持距离，却也埋下元婴记恨的隐患。");
          return { text: "你打着哈哈，礼收了，拜师却含糊推脱。极阴眼底寒光一闪，到底没当场发作——但这梁子，算是悄悄结下了。", kind: "event" };
        },
        resolve: "advance",
      },
    ],
  },

  // —— 节点 4-G·宝光阁（story·古宝 4 选 1）——
  {
    id: "xh_a4_baoguang",
    skipIf: (s) => s.flags.xh_a4_baoguang_done,
    cond: (s) => s.flags.xh_a4_sanyuanying_done && !s.flags.xh_a4_baoguang_done,
    bgm: "journey",
    title: "虚天殿 · 宝光阁",
    objTitle: "古宝 · 四路选一",
    objHint: "冰火道后、极妙幻境前——宝光阁四条路分别通向宝物/功法/丹药/直通第三关。以噬金虫切断灵力进入能量罩，可取其一。",
    text: [
      { scene: "虚天殿 · 宝光阁" },
      "宝光阁内，四条光路分向四处：一路通古宝『五行环』，一路通古宝『血色披风』，一路通一卷功法残篇，一路则可直通第三关、省去周折。",
      { aside: "能量罩拦在宝物之前——你纵噬金虫切断灵力，方可入内取宝。四路只能择一，且看你要什么。" },
    ],
    onArrive(s) { s.location = "tianxing_city"; State.setFlag("xh_a4_baoguang_done"); },
    choices: [
      {
        text: "取五行环（阵法古宝）",
        hint: "五行流转·阵法一道有妙用",
        effect(s) {
          State.give("wuxing_huan", 1);
          return { text: "你切断能量罩，取下五枚循五行流转的色环——五行环入手。阵法一道，又添一臂之力。", kind: "good" };
        },
        resolve: "advance",
      },
      {
        text: "取血色披风（护身遁光）",
        hint: "护身+遁走两便",
        effect(s) {
          State.give("xuese_pifeng", 1);
          return { text: "你取下那件血色猎猎的披风——内蕴一缕遁光之力，护身遁走两便。血色披风入手。", kind: "good" };
        },
        resolve: "advance",
      },
      {
        text: "取功法残篇（丹道/阵法精进）",
        hint: "熟练度+",
        effect(s) {
          s.skills = s.skills || {}; s.skills.alchemy = (s.skills.alchemy || 0) + 2;
          State.give("lingshi", 30);
          return { text: "你取下一卷古修士的功法残篇——参研之下，丹道阵法的火候都精进了几分（熟练度+2·灵石+30）。", kind: "good" };
        },
        resolve: "advance",
      },
      {
        text: "直通第三关（省时·大限将近）",
        hint: "不取宝·节省时间",
        effect(s) {
          s.mood = Math.min(s.moodMax, (s.mood || 0) + 2);
          return { text: "你不为宝物所动，径直走向通往第三关的光路。元婴环伺、大限将近——稳妥，比贪宝要紧。", kind: "event" };
        },
        resolve: "advance",
      },
    ],
  },

  // —— 节点 4-H·第三关·极妙幻境（story·心性考验·非战斗·婆罗珠安神·S7 收口）——
  {
    id: "xh_a4_jimiao",
    skipIf: (s) => s.flags.xh_a4_jimiao_done,
    cond: (s) => s.flags.xh_a4_baoguang_done && !s.flags.xh_a4_jimiao_done,
    cg: "jindan",
    bgm: "sorrow",
    title: "虚天殿 · 第三关 · 极妙幻境",
    objTitle: "心性 · 回溯人生",
    objHint: "第三关极妙幻境非战斗——心性考验。婆罗珠安神定魂，助你穿过幻象。回溯人生的种种选择，唯有道心澄明者，方能勘破。",
    text(s) {
      return [
        { scene: "虚天殿 · 极妙幻境" },
        { cam: "zoom", scale: 1.04, ms: 320 },
        "第三关没有敌人，只有幻象。青牛镇的爹娘、墨大夫、七玄门、孤岛二十载、曲魂被夺的那一刻……平生种种，如潮水般在识海里翻涌，要将你拖入心魔。",
        { aside: State.count("boluo_zhu") > 0
            ? "你取出极阴所赠的婆罗珠——幽光温润，心神为之一定。红尘劫渡过的那份通透，此刻成了你最坚实的道心。"
            : "你没有安神之宝，只能凭一身道心硬抗这幻象洪流。红尘劫渡过的那份通透，是你唯一的依凭。" },
        { say: "韩立", emo: "calm", tone: "low", text: "「来过、痛过、失去过……可我韩立的道心，从不在这些幻象里。勘破。」" },
      ];
    },
    onArrive(s) {
      s.location = "tianxing_city";
      State.setFlag("xh_a4_jimiao_done");
      const hasBoluo = State.count("boluo_zhu") > 0;
      s.mood = Math.min(s.moodMax, (s.mood || 0) + (hasBoluo ? 10 : 6));
      s.demon = Math.max(0, (s.demon || 0) - (hasBoluo ? 8 : 4));
      Engine.writeLedger("xh_jimiao", `极妙幻境·心性考验通过${hasBoluo ? "（婆罗珠安神·道心愈固）" : "（无安神之宝·凭道心硬抗）"}——外殿三关终局，回溯人生而勘破幻象。`);
      Engine.addMilestone("虚天殿·极妙幻境通过（外殿三关终局）", "xinghaifeichi");
    },
    choices: [
      {
        text: "勘破幻境 · 道心如磐",
        hint: "外殿三关·终（内殿取鼎·待续）",
        effect(s) {
          return { text: "幻象一层层崩碎、消散。你睁开眼，已立于通往内殿的殿门之前。外殿三关，过了——接下来，是虚天鼎、是元婴大战、是与玄骨的了断。", kind: "good" };
        },
        resolve: "advance",
      },
    ],
  },
  // —— 节点 4-I·寒骊台破阵（锚·智谋·戏耍乌丑·获虚天殿地图）——
  {
    id: "xh_a4_hanli",
    skipIf: (s) => s.flags.xh_a4_hanli_done,
    cond: (s) => s.flags.xh_a4_jimiao_done && !s.flags.xh_a4_hanli_done,
    bgm: "tense",
    title: "虚天殿 · 寒骊台破阵",
    objTitle: "智谋 · 戏耍乌丑",
    objHint: "内殿寒骊台需四方位同破。蛮胡子、极阴、青易居士分头去找，你被支去跟乌丑找第四方位——正好凭你对阵法的研究，戏耍这个蠢货，顺手在夹层里摸到虚天殿全图。",
    text: [
      { scene: "虚天殿 · 内殿 · 寒骊台" },
      "内殿寒骊台镇着一座四方大阵，须四个方位同时破才能入。三位元婴各占一方，你被支去和乌丑找第四方位。",
      { aside: "乌丑（极阴的提线木偶）对阵法一窍不通，全凭你。你心思电转——与其老实破阵，不如借机戏耍这蠢货、自己摸清门道。果然，在阵眼夹层里，你摸到了一卷东西：虚天殿全图！这逃命的关键，神不知鬼不觉落进了你手里。" },
    ],
    onArrive(s) {
      s.location = "tianxing_city";
      State.setFlag("xh_a4_hanli_done");
      State.setFlag("xh_xutian_ditu");   // 虚天殿全图入手（逃命关键·flag 记）
      Engine.writeLedger("xh_xutian_ditu", "寒骊台破阵——跟乌丑找第四方位、戏耍这提线木偶，于阵眼夹层摸到虚天殿全图（后续逃命关键）。韩立对阵法之研究的智谋节点。");
      Engine.addMilestone("虚天殿·寒骊台破阵（戏耍乌丑·得虚天殿全图）", "xinghaifeichi");
      // 远雷·虚天殿门道兑现（铁律3）：早先打听的风声、细问的门道，此刻在破阵识图时全派上用场——点名出处
      let xtEcho = 0;
      if (Engine.settleLedger("xh_a1_curious", "金丹初成时在天星城坊市茶肆听来的那些『虚天残图、上古至宝』的传闻，今日站在寒骊台前一一对上了号——先探后动的谨慎，让你比旁人早一步看穿这阵的门道")) xtEcho += 2;
      if (Engine.settleLedger("xh_xutian_curious", "当初接天雷竹那日，多向紫灵细问的几句虚天殿门道——三关、阵眼、夹层藏图——此刻成了你戏耍乌丑、摸到全图的底气。多知一分，果然少险一分")) xtEcho += 2;
      if (xtEcho) s.mood = Math.min(s.moodMax, (s.mood || 0) + xtEcho);
    },
    choices: [
      {
        text: "大力戏耍 · 让乌丑出尽洋相",
        hint: "情绪爽·乌丑记恨（玄骨杀乌丑时更有戏）",
        effect(s) {
          s.mood = Math.min(s.moodMax, (s.mood || 0) + 3);
          State.setFlag("xh_hanli_humiliate");
          return { text: "你故意把乌丑支得团团转，看他在错误的方位上白费力气、急得跳脚，心头那口失曲魂的闷气，总算泄了几分。地图，你早揣进了怀里。", kind: "good" };
        },
        resolve: "advance",
      },
      {
        text: "低调取图 · 不结无谓的仇",
        hint: "稳健·神不知鬼不觉",
        effect(s) {
          State.setFlag("xh_hanli_lowkey");
          return { text: "你不动声色地配合，趁乌丑不备摸走夹层里的地图，半分破绽不露。多一事不如少一事——这虚天殿里，谁知道哪根葱日后会要你的命。", kind: "event" };
        },
        resolve: "advance",
      },
    ],
  },

  // —— 节点 4-J·内殿·取鼎+元婴大战（锚·cutscene观战·皇鳞甲救命·3选1夺鼎策略）——
  {
    id: "xh_a4_neidian",
    skipIf: (s) => s.flags.xh_a4_neidian_done,
    cond: (s) => s.flags.xh_a4_hanli_done && !s.flags.xh_a4_neidian_done,
    cg: "luanxinghai",
    bgm: "boss",
    title: "虚天殿 · 内殿 · 元婴大战",
    objTitle: "观战 · 藏拙求生",
    objHint: "正道万天明用金丝蚕取鼎失败、假意离去；魔道三元婴以你的白玉蜘蛛拉鼎成功——虚天鼎现世！元婴混战骤起，一道杀机扫向你，皇鳞甲在这一刻替你挡下致命一击。",
    text: [
      { scene: "虚天殿 · 内殿 · 虚天塔" },
      "寒骊台破开，内殿虚天塔现出真容。万法门万天明先以金丝蚕取鼎——失败，假意愤然离去（金魁分化正魔的一步棋）。",
      "随后，极阴、蛮胡子、青易居士合力，以你那只白玉蜘蛛为引，竟将虚天鼎缓缓拉出！蓝光冲天——通天灵宝，现世了。",
      { fx: "burst", at: "center", elem: "shui", ms: 420 },
      "鼎一出世，元婴老怪再无半分情面，混战骤起！万天明一行去而复返，六个元婴杀作一团。乱流之中，一道凌厉杀机毫无征兆地扫向你——",
      { say: "韩立", emo: "fear", tone: "low", text: "「不好——！」" },
      { fx: "burst", at: "center", elem: "jin", ms: 360 },
      { sfx: "danger" },
      { aside: "千钧一发，蛮胡子赠的皇鳞甲鳞光暴涨，硬生生替你接下了那记元婴一击！甲碎人安——若没这件甲，你早已魂飞魄散。蛮胡子那点'真'，救了你一命。虚天鼎中更爆出一枚补天丹，元婴们争得更凶了。" },
      // canon P2·血玉蜘蛛之死（正典：混战中被星宫长老击杀）——灵宠情感节点；袖中尚余一枚蛛卵=长线不断
      { wait: 600 },
      { aside: "而替他们拉鼎立了大功的白玉蜘蛛，却没能躲过这场乱流——一名星宫长老嫌它碍事，随手一道剑光，把它碾灭在虚天塔前。那只从蛛卵里孵出、蝎岛替你挡过追兵的小东西，连一声哀鸣都没来得及发出。你攥紧了袖中仅剩的那枚蛛卵，指节发白。" },
    ],
    onArrive(s) {
      s.location = "tianxing_city";
      State.setFlag("xh_a4_neidian_done");
      Engine.meetNpc("wan_tianming", "万法门元婴修士——金丝蚕取鼎失败假意离去（金魁分化正魔之棋），后率众闯入元婴大战。");
      Engine.settleLedger("xh_baiyu_zhizhu_use", "蝎岛外海替你吐丝挡下天都炼傀的那只白玉蜘蛛，最终死在虚天塔前的元婴乱流里——它替人拉出了通天灵宝，人却没把它当一条命。袖中那枚仅剩的蛛卵，你会孵好的");
      Engine.writeLedger("xh_neidian", "虚天殿内殿·元婴大战——正道万天明金丝蚕取鼎失败、魔道三元婴以韩立白玉蜘蛛拉鼎成功，虚天鼎现世。六元婴混战，皇鳞甲替韩立挡下致命一击（蛮胡子保命之恩兑现）；白玉蜘蛛被星宫长老随手碾灭（袖中尚余一枚蛛卵·灵宠线未断）；虚天鼎爆出补天丹，元婴争夺更烈。");
      Engine.addMilestone("虚天殿·元婴大战（虚天鼎现世·皇鳞甲救命·痛失白玉蜘蛛）", "xinghaifeichi");
    },
    choices: [
      {
        text: "趁乱偷鼎 · 浑水摸鱼",
        hint: "虚天鼎到手·但仇恨增（动漫核定·韩立智取）",
        effect(s) {
          State.setFlag("xh_neidian_steal");
          Engine.writeLedger("xh_dingce", "元婴大战·趁乱浑水摸鱼智取虚天鼎——韩立的胆识与智谋（仇恨增·四大势力追杀的根）。");
          return { text: "你瞅准元婴们杀红眼、谁也顾不上鼎的那一瞬，催动青竹蜂云剑卷起虚天鼎，借血色披风的遁光闪身而退——通天灵宝，竟被你这结丹小修浑水摸鱼夺了去！", kind: "good" };
        },
        resolve: "advance",
      },
      {
        text: "稳住 · 等元婴内讧再下手",
        hint: "稳健·风险低",
        effect(s) {
          State.setFlag("xh_neidian_wait");
          Engine.writeLedger("xh_dingce", "元婴大战·按兵不动等内讧——更稳，待时机再取鼎。");
          return { text: "你强压贪念，藏在暗处冷眼旁观，待元婴们两败俱伤、玄骨发难杀乌丑的混乱时刻，才悄然取鼎。稳，是你活到现在的本钱。", kind: "event" };
        },
        resolve: "advance",
      },
    ],
  },

  // —— 节点 4-K·玄骨终战（锚⑰·Combat·全章最高潮·以下克上）——
  {
    id: "xh_a4_xuangu_fight",
    skipIf: (s) => s.flags.xh_a4_xuangu_fight_done,
    cond: (s) => s.flags.xh_a4_neidian_done && !s.flags.xh_a4_xuangu_fight_done,
    bgm: "boss",
    title: "虚天殿 · 玄骨终战",
    objTitle: "了断 · 修罗圣火",
    objHint: "夺鼎之后，夺你曲魂的玄骨拦在出路上。他手握修罗圣火、实力远胜于你——硬拼无益。撑到他强融圣火、失控自毁那一刻，以辟邪神雷+啼魂兽以下克上，了断这段血仇。",
    text: [
      { scene: "虚天殿 · 内殿 · 出路" },
      "得了虚天鼎，正欲脱身——一道鬼气拦在出路上。是玄骨，那具曾属于曲魂的躯壳，此刻盛满了元婴级的死气与一团金红的修罗圣火。",
      { say: "玄骨", tone: "森冷", text: "「夺了老夫看中的鼎，还想走？把命，还有那虚天鼎，都留下。」" },
      { aside: "他强得可怕。可你看得分明——那修罗圣火，与结丹后期的曲魂躯壳，根本不兼容。撑住，待他驾驭不住、圣火失控的那一刻，便是你以下克上的机会。辟邪神雷克他鬼道，啼魂兽收他残魂，皇鳞甲替你挡命。" },
    ],
    choices: [
      { text: "了断 · 撑到修罗圣火失控", hint: "survive·辟邪神雷+啼魂兽以下克上", resolve: "xh_xuangu_fight" },
    ],
  },

  // —— 节点 4-L·虚天殿收获（锚⑱·结算·大件丰收·S8-S9 收口）——
  {
    id: "xh_a4_shouhuo",
    skipIf: (s) => s.flags.xh_a4_shouhuo_done,
    cond: (s) => s.flags.xh_a4_xuangu_fight_done && !s.flags.xh_a4_shouhuo_done,
    cg: "jindan",
    bgm: "triumph",
    title: "虚天殿 · 收获",
    objTitle: "满载而归 · 大件丰收",
    objHint: "玄骨身死，修罗圣火瓦解成乾蓝冰焰。虚天鼎、乾蓝珠、玄阴经、养魂木、狼首玉如意（银月）——这一趟虚天殿，满载而归。",
    text: [
      { scene: "虚天殿 · 内殿" },
      { cam: "zoom", scale: 1.05, ms: 360 },
      { fx: "flash", color: "#9fd8f0", alpha: 0.26, ms: 520 },
      { sfx: "castShui" },
      "玄骨灰飞烟灭，那团修罗圣火失了驾驭者，竟缓缓瓦解、汇聚成一枚幽蓝冰晶——乾蓝冰焰，至阴寒焰，落入你手。",
      "你清点这一趟的收获：通天灵宝虚天鼎、至阴寒焰乾蓝珠、玄骨遗下的完整版玄阴诀、向元瑶讨来的一截养魂木、一株九曲盘结的万年灵参（大补元气·据说能大增进阶元婴之望），还有一柄雕作狼首的古玉如意——其中似封着一缕沉睡的器灵。",
      { fx: "burst", at: "center", elem: "shui", ms: 420 },
      { sfx: "success" },
      { shot: "pushIn", ms: 1300, scale: 1.12 },
      { aside: "虚天鼎、乾蓝冰焰——这两件，是你将来问鼎元婴的资本。那柄狼首玉如意里那缕沉睡的器灵，还没有醒。" },
      { wait: 600 },
      { say: "韩立", emo: "calm", tone: "low", text: "「曲魂……这一趟的收获，我替你一起带出去了。」" },
    ],
    onArrive(s) {
      s.location = "tianxing_city";
      State.setFlag("xh_a4_shouhuo_done");
      State.give("xutian_ding", 1);
      State.give("qianlan_zhu", 1);
      State.give("langshou_ruyi", 1);
      State.give("yanghun_mu", 1);
      State.give("jiuqu_lingshen", 1);   // canon P2·九曲灵参（正典虚天殿收获·玄骨相助所得——元婴线大件）
      if (State.count("butian_dan") < 1) State.give("butian_dan", 1);   // 虚天鼎补天丹（外星海闭关服食·改善灵根）
      if (State.count("xuanyin_jue") < 1) State.give("xuanyin_jue", 1);
      State.setFlag("xuanyin_full");   // 完整版玄阴诀（身外化身线·远期第二元婴/法体双修前置）
      Engine.writeLedger("xh_xutian_harvest", "虚天殿收获结算——虚天鼎（通天灵宝·第一件）+乾蓝珠（至阴寒焰·远期超级杀招）+完整版玄阴诀（身外化身线）+养魂木（念珠安神）+狼首玉如意（银月载体·器灵沉睡待唤）+补天丹（外星海闭关改善灵根）。失曲魂、得大件，有失有得。");
      Engine.addMilestone("虚天殿满载而归（虚天鼎+乾蓝冰焰+玄阴经+养魂木+银月载体）", "medal");
      if (typeof Sfx !== "undefined") Sfx.play("success");
      Engine.toast("虚天殿大丰收：虚天鼎·乾蓝珠·养魂木·狼首玉如意（银月）");
    },
    choices: [
      {
        text: "向元瑶要一截养魂木做念珠",
        hint: "动漫核定·与婆罗珠同用安神",
        effect(s) {
          State.setFlag("xh_yanghun_share");
          return { text: "你向元瑶要了一截养魂木，做成念珠，与婆罗珠一同用以安神固魂。元瑶也不吝惜——她得偿所愿，要去复活亡友的心愿，便也圆满了大半。", kind: "good" };
        },
        resolve: "advance",
      },
      {
        text: "养魂木尽数让给元瑶",
        hint: "利他·元瑶关系+（远期还阳助力）",
        effect(s) {
          State.setFlag("xh_yanghun_give");
          s.mood = Math.min(s.moodMax, (s.mood || 0) + 4);
          Engine.writeLedger("xh_yuanyao_deal", "养魂木尽让元瑶——成全她复活妍丽的心愿（日后外海风云篇还阳术助力增·埋下一线人情）。");
          return { text: "你把养魂木尽数让给元瑶——她为复活亡友奔波至此，你这点成全，权当还她赠啼魂兽之情。元瑶深深一礼，眼里有泪光：「此恩，元瑶记下了。」", kind: "good" };
        },
        resolve: "advance",
      },
    ],
  },
  // —— 节点 5-A·出殿·温天仁拦路（锚⑲·关键抉择·冒充/硬闯）——
  {
    id: "xh_a5_wentianren",
    skipIf: (s) => s.flags.xh_a5_wentianren_done,
    cond: (s) => s.flags.xh_a4_shouhuo_done && !s.flags.xh_a5_wentianren_done,
    bgm: "tense",
    title: "出殿 · 温天仁拦路",
    objTitle: "拦路 · 冒充蒙混",
    objHint: "虚天殿出口，温天仁（六道极圣之徒·结丹后期）看守离岛。正面打不过——但你有青易居士赠的青冥针，可冒充其徒弟蒙混过关。",
    text: [
      { scene: "虚天殿 · 出口" },
      { amb: "wind" },
      { shot: "establish" },
      { sfx: "danger" },
      "满载而归，出口却立着一人——温天仁，六道极圣的徒弟，结丹后期。他逐一盘问出殿之人的来路。",
      { shot: "pushIn", ms: 1200 },
      { aside: "正面硬闯，绝非这结丹后期的对手。好在……青易居士那枚青冥针还在身上——拿它作信物，冒充青易的徒弟蒙混过关，最是稳妥。" },
      { shot: "focusLeft" },
      { say: "温天仁", tone: "冷峻", text: "「出殿者，报上名号师承。」" },
    ],
    onArrive(s) {
      s.location = "tianxing_city";
      State.setFlag("xh_a5_wentianren_done");
      Engine.meetNpc("wen_tianren", "六道极圣之徒·结丹后期，虚天殿出口看守——正面对决留外海风云篇，此处只是初遇。");
      Engine.writeLedger("xh_wentianren_encounter", "出殿·温天仁拦路——结丹后期的六道极圣之徒看守离岛，韩立初遇。正面对决留待外海风云篇日后了断。");
    },
    choices: [
      {
        text: "冒充青易居士的徒弟·蒙混过关",
        hint: "需青冥针为信物（动漫核定·不暴露）",
        requireItem: "qingming_zhen",
        effect(s) {
          State.setFlag("xh_wentianren_fake");
          Engine.writeLedger("xh_wentianren_react", "出殿·凭青冥针冒充青易居士之徒蒙混过关——青易赠宝的虚情假意，竟阴差阳错帮了韩立。温天仁这一面之缘，日后外海风云篇还会再算。");
          return { text: "你不慌不忙取出青冥针：「南鹤岛青易居士门下。」温天仁盯着那枚青易的符宝看了一瞬，终是颔首放行。青易那点虚情假意，倒成了你脱身的护身符。", kind: "good" };
        },
        resolve: "advance",
      },
      {
        text: "强行突围 · 以遁术脱身",
        hint: "暴露身份·温天仁记下你（远期仇恨）",
        effect(s) {
          s.hp = Math.max(1, Math.round((s.hp || s.hpMax) * 0.7));
          State.setFlag("xh_wentianren_force");
          Engine.writeLedger("xh_wentianren_react", "出殿·强行突围——青竹蜂云剑+血色披风遁光强闯，暴露了身份，温天仁记下了韩立（外海风云篇仇恨增）。");
          return { text: "你懒得废话，青竹蜂云剑卷起一道剑光、血色披风遁光暴涨，强行突围而去！温天仁一击未能拦下，眯起眼记住了你这道身影——这梁子，外海风云再算。", kind: "event" };
        },
        resolve: "advance",
      },
    ],
  },

  // —— 节点 5-B·救凌玉灵（锚⑳·Combat·survive 护人·星宫关系种子）——
  {
    id: "xh_a5_lingyuling",
    skipIf: (s) => s.flags.xh_a5_lingyuling_done,
    cond: (s) => s.flags.xh_a5_wentianren_done && !s.flags.xh_a5_lingyuling_done,
    bgm: "combat",
    title: "出殿途中 · 救凌玉灵",
    objTitle: "护人 · 星宫之女",
    objHint: "出殿途中，星宫双圣之女凌玉灵被逆星盟追兵咬住——星宫与逆星盟已然开战。护住她、撑过 4 回合即可——不必恋战。",
    // canon P2·凌玉灵之围（ep120·腾讯20240921）：追杀她的是**逆星盟修士**（星宫-逆星盟开战背景），非妖兽
    text: [
      { scene: "外星海 · 离岛海域" },
      "离岛途中，前方海面剑光交错——一名女扮男装的年轻修士被几名黑袍修士围在礁石上空，眼看不支。她身上那缕气息，是星宫一脉；围她的黑袍，是逆星盟的路数。",
      { aside: "南明岛一役后，星宫与逆星盟已经撕破了脸——这是开战的余波烧到了外海。举手之劳。护她撑过这一阵，结个善缘，日后星海行走，总比多一个敌人要好。" },
    ],
    choices: [
      { text: "出手 · 护住凌玉灵", hint: "survive 4 回合·清开近身妖兽", resolve: "xh_lingyuling_fight" },
    ],
  },

  // —— 节点 5-C·外星海闭关（帆⑦·时间跳跃·补天丹改善灵根·玄阴诀·噬金虫变异·3选1侧重）——
  {
    id: "xh_a5_biguan",
    skipIf: (s) => s.flags.xh_a5_biguan_done,
    cond: (s) => s.flags.xh_a5_lingyuling_done && !s.flags.xh_a5_biguan_done,
    cg: "waihai_lie",
    bgm: "journey",
    title: "外星海 · 闭关",
    objTitle: "蛰伏 · 整理战利品",
    objHint: "携虚天殿满载之获，躲入外星海一处偏僻孤岛开辟洞府。服补天丹改善灵根、修炼完整版玄阴诀、培育噬金虫变异——二三十年弹指而过。",
    text: [
      { scene: "外星海 · 孤岛洞府" },
      { cam: "zoom", scale: 1.04, ms: 320 },
      "虚天鼎在手，天下皆敌。你不敢张扬，寻了外星海一处偏僻孤岛，开辟洞府、闭死关，整理这一趟泼天的收获。",
      { aside: "补天丹服下——伪灵根之体如逢甘霖，经脉滞涩为之一畅，资质竟真改善了几分；完整版玄阴诀参研入门；从虚天殿带出的灵机喂养下，噬金虫也隐隐有了变异三色的征兆。二三十年，弹指即过。" },
      { say: "韩立", emo: "calm", tone: "low", text: "「虚天鼎、乾蓝冰焰、玄阴诀……这一身的底子，够我在这星海里，走得更远了。」" },
    ],
    onArrive(s) {
      s.location = "tianxing_city";
      State.setFlag("xh_a5_biguan_done");
      s.year += 25; s.age = (s.age || 0) + 25;
      // 补天丹·改善灵根（外星海闭关服食）——take 一枚、narrate；不叠既有 butian_used 速率，避免数值漂移
      if (State.count("butian_dan") > 0 && !s.flags.xh_butian_used) {
        State.take("butian_dan", 1);
        State.setFlag("xh_butian_used");
      }
      Engine.writeLedger("xh_biguan", "外星海闭关二三十年——服补天丹改善灵根、修炼完整版玄阴诀、噬金虫变异征兆。携虚天鼎蛰伏，整理战利品。");
      Engine.addMilestone("外星海闭关·二三十年蛰伏（补天丹改善灵根·玄阴诀）", "xinghaifeichi");
    },
    choices: [
      {
        text: "潜修玄阴诀 · 真元更进一层",
        hint: "剑道/真元侧重",
        effect(s) {
          s.mood = Math.min(s.moodMax, (s.mood || 0) + 6);
          s.sense = (s.sense || 0) + 2;
          Engine.writeLedger("xh_biguan_focus", "闭关侧重·潜修玄阴诀——真元/神识精进。");
          return { text: "你将大半光阴倾注于完整版玄阴诀，真元一层层淬炼得愈发精纯，神识也更上一层（神识+2）。", kind: "good" };
        },
        resolve: "advance",
      },
      {
        text: "温养金丹 · 巩固结丹中期",
        hint: "稳固境界·心境侧重",
        effect(s) {
          s.mood = Math.min(s.moodMax, (s.mood || 0) + 10);
          s.demon = Math.max(0, (s.demon || 0) - 8);
          Engine.writeLedger("xh_biguan_focus", "闭关侧重·温养金丹——境界稳固、道心澄明（心魔消减）。");
          return { text: "你不急着求进，只温养金丹、稳固结丹中期的根基。二三十年沉淀下来，道心愈发澄明，心魔消减（心境大涨·心魔-8）。", kind: "good" };
        },
        resolve: "advance",
      },
      {
        text: "培育噬金虫变异 · 三色虫群",
        hint: "虫群战力·阵法侧重",
        effect(s) {
          s.skills = s.skills || {}; s.skills.alchemy = (s.skills.alchemy || 0) + 2;
          State.give("lingshi", 60);
          Engine.writeLedger("xh_biguan_focus", "闭关侧重·培育噬金虫——三色变异征兆、虫群战力渐长（灵石+60）。");
          return { text: "你以虚天殿带出的灵机喂养噬金虫，那一窝灵虫渐渐显出变异三色的征兆，虫群更显灵性。闲暇炼丹制符，也攒下不少灵石（熟练+2·灵石+60）。", kind: "good" };
        },
        resolve: "advance",
      },
    ],
  },

  // —— 节点 5-D·海王兽斩杀（锚㉑·Combat·战力验证·碾压·章末扬眉）——
  {
    id: "xh_a5_haiwang",
    skipIf: (s) => s.flags.xh_a5_haiwang_done,
    cond: (s) => s.flags.xh_a5_biguan_done && !s.flags.xh_a5_haiwang_done,
    bgm: "combat",
    title: "外星海 · 海王兽",
    objTitle: "战力验证 · 从容碾压",
    objHint: "出关途中，一头七级海王兽撞上枪口。开篇要逃的对手，如今你结丹中期、青竹蜂云剑在手——正好验一验这一身脱胎换骨。",
    text: [
      { scene: "外星海 · 怒涛之上" },
      "出关试手，恰逢一头七级海王兽掀涛而来。搁在初入星海那会儿，这是要拼命逃的对手。",
      { aside: "如今么——结丹中期、青竹蜂云剑七十二口、辟邪神雷、噬金虫俱全。来得正好，拿你验一验这一身的本事。" },
    ],
    choices: [
      { text: "斩之 · 验这一身脱胎换骨", hint: "碾压·章末扬眉", resolve: "xh_haiwang_fight" },
    ],
  },

  // —— 节点 5-E·四大势力追杀（锚㉒·章末钩·通关·解锁外海风云篇）——
  {
    id: "xh_a5_zhuisha",
    skipIf: (s) => s.flags.arc6_complete,
    cond: (s) => s.flags.xh_a5_haiwang_done && !s.flags.arc6_complete,
    cg: "luanxinghai",
    bgm: "tense",
    title: "星海飞驰 · 终 · 四大势力追杀",
    objTitle: "章末 · 危机四伏",
    objHint: "虚天鼎的消息终究泄露——极阴、碧云门、万法门、星宫四路追杀接踵而至。你携至宝遁入外星海深处，闭关二三十年避风头……下一篇章『外海风云』，自此开始。",
    text: [
      { scene: "外星海 · 深处" },
      { amb: "wind" },
      { shot: "establish" },
      { cam: "zoom", scale: 1.06, ms: 360 },
      { sfx: "danger" },
      "纸终究包不住火——你夺走虚天鼎的消息，到底走漏了。极阴岛、碧云门、万法门、星宫……四方势力的追杀令，接踵而至。",
      { shot: "pushIn", ms: 1300, scale: 1.12 },
      { say: "韩立", tone: "low", text: "「虚天鼎在手，天下皆敌……可这，不正是修仙路该有的样子么。」" },
      { amb: null },
      { shot: "pullOut", ms: 1600 },
      { aside: "你携虚天鼎、乾蓝冰焰、青竹蜂云剑，遁入外星海最深处，开辟洞府、闭死关——避过这一波风头，再图后计。结丹初成时的那个韩立，如今已能在元婴老怪环伺的星海里，挣出一条活路。" },
      {
        guide: {
          tag: "星海飞驰篇 · 终　——　满载而归·危机四伏",
          title: "章末钩 · 下一篇：外海风云篇",
          hint: "青竹蜂云剑、辟邪神雷、虚天鼎、乾蓝冰焰、银月（沉睡）、玄阴诀……一身底牌已成。远处的钩子已隐隐浮现：风雷翅炼制、银月苏醒、温天仁的正面对决、元瑶的还阳术、蛮胡子之困、星宫双圣之缘——这一切，都留待《外海风云篇》。",
          cta: "（遁入外星海深处·闭关避风头——星海飞驰篇 终）",
        },
      },
    ],
    onArrive(s) {
      s.location = "tianxing_city";
      State.setFlag("arc6_complete");
      // 篇章契约：通关解锁下一篇（外海风云篇·钩子）
      if (typeof Chapters !== "undefined") {
        const next = Chapters.active().nextChapter;
        if (next) Chapters.unlock(next);
      }
      Engine.writeLedger("xh_arc6_complete", "星海飞驰篇·终——虚天鼎消息泄露，极阴/碧云门/万法门/星宫四大势力追杀，韩立携至宝遁入外星海深处闭关避风头。一身底牌（青竹蜂云剑/辟邪神雷/虚天鼎/乾蓝冰焰/玄阴诀/银月沉睡）已成。下一篇章外海风云。星海飞驰篇·终。");
      Engine.addMilestone("星海飞驰篇通关·四大势力追杀（章末钩·realmTier 结丹中期）", "medal");
      s.worldNews = s.worldNews || [];
      const t = `第${s.year}年${s.month}月`;
      s.worldNews.push({ t, kind: "world", text: "乱星海：虚天鼎下落成谜，极阴岛/碧云门/万法门/星宫四方势力悬赏追缉一名结丹散修。" });
      s.worldNews.push({ t, kind: "fortune", text: "传闻那结丹散修携至宝遁入外星海深处，自此销声匿迹——明眼人都知道，这不过是下一场风云的序幕。" });
      if (s.worldNews.length > 40) s.worldNews.splice(0, s.worldNews.length - 40);
      if (typeof Sfx !== "undefined") Sfx.play("success");
      Engine.toast("星海飞驰篇通关！携虚天鼎遁入外星海");
    },
    choices: [
      {
        text: "（遁入外星海深处·闭关避风头——且待外海风云）",
        hint: "满载而归·危机四伏——星海飞驰篇 终",
        effect(s) {
          s.mood = Math.min(s.moodMax, (s.mood || 0) + 8);
          return { text: "你抚着储物镯中那尊温润的虚天鼎，遁光一闪，没入外星海无边的妖雾深处。结丹初成到满载而归——这一篇星海飞驰，你走得九死一生，却也脱胎换骨。", kind: "good" };
        },
        resolve: "advance",
      },
    ],
  },

  /* ============================================================
   *  外海风云篇（动漫 125~152 · docs/waihaifengyun-design.md）
   *  幕一 · 恶名与出关（S1）：孤崖蛰伏→公孙杏误闯→出关立威→拍卖会
   *  境界轴：全程结丹后期→大圆满（破元婴留重返天南篇·用户核定）
   * ============================================================ */

  // —— 幕一①·开篇·孤崖岁月（时间跳跃·三载蛰伏·3选1侧重）——
  {
    id: "whfy_a1_open",
    skipIf: (s) => s.flags.whfy_open,
    cond: (s) => s.flags.arc6_complete && !s.flags.whfy_open,
    bgm: "journey",
    title: "外海风云 · 孤崖蛰伏",
    objTitle: "蛰伏 · 风声渐紧",
    objHint: "携虚天鼎遁入外星海深处，你在一座怒涛孤崖下开辟洞府、闭关三载避风头。风声没有小下去——反而越来越邪门：外面有人顶着你的名字，杀人夺宝。",
    text: [
      { scene: "外星海 · 孤崖洞府" },
      { amb: "wind" },
      { shot: "establish" },
      "怒涛孤崖之下，你盘膝已三载。虚天鼎的风头未过，四大势力的缉令仍贴满内海坊市——蛰伏，是眼下唯一的正路。",
      { sfx: "danger" },
      "可偶尔潜出补给的散修口中，风声却越来越邪门：外海各处，接连有修士洞府被屠、宝物被掠——下手之人自报名号，「韩老魔」。",
      { shot: "pushIn", ms: 1100 },
      { say: "韩立", emo: "serious", tone: "low", text: "「韩、老、魔？……我在此地闭关三年，何曾杀过一人。有人顶着我的名字，替我在外面『扬名』。」" },
      { aside: "极阴岛与万法门找不到你，便造一个「你」出来——败你名声，再借死者亲友之手，替他们满天下地找你。好狠的阳谋。" },
    ],
    onArrive(s) {
      s.activeChapter = "waihaifengyun";   // 切入外海风云篇（realmCap=结丹大圆满）
      s.location = "waihai_dongfu";
      State.setFlag("whfy_open");
      s.year += 3; s.age = (s.age || 0) + 3;   // 三载蛰伏
      Engine.writeLedger("whfy_a1_open", "外海风云篇·开篇——孤崖洞府蛰伏三载；极阴岛/万法门假扮『韩老魔』杀人夺宝败其名声，借死者亲友之手满海寻他。恶名阳谋始。");
      Engine.addMilestone("外海风云篇·启：孤崖蛰伏·韩老魔恶名起", "waihaifengyun");
      s.worldNews = s.worldNews || [];
      const t = `第${s.year}年${s.month}月`;
      s.worldNews.push({ t, kind: "rumor", text: "外海血案频传：魔修「韩老魔」连屠三处洞府、杀人夺宝——各方遗属悬红寻仇，风声鹤唳。" });
      s.worldNews.push({ t, kind: "world", text: "极阴岛、万法门明面收缩了对虚天鼎的追缉——明眼人却觉得，这潭水只是变深了。" });
      if (s.worldNews.length > 40) s.worldNews.splice(0, s.worldNews.length - 40);
    },
    choices: [
      {
        text: "温养金丹 · 直指结丹大圆满",
        hint: "境界侧重——为破婴打底",
        effect(s) {
          s.cultivation = (s.cultivation || 0) + 9000;
          s.mood = Math.min(s.moodMax, (s.mood || 0) + 5);
          Engine.writeLedger("whfy_a1_focus", "蛰伏侧重·温养金丹——三载水磨，修为直指结丹大圆满。");
          return { text: "三载死关，你把心神尽数沉入丹田那枚金丹——温养、压炼、再温养。出关之日，金丹圆润欲滴，离大圆满只隔一层窗纸（修为大进）。", kind: "good" };
        },
        resolve: "advance",
      },
      {
        text: "参研玄阴诀 · 神识再进",
        hint: "神识侧重——秘术更深",
        effect(s) {
          s.sense = (s.sense || 0) + 3;
          Engine.writeLedger("whfy_a1_focus", "蛰伏侧重·参研完整版玄阴诀——神识淬炼再进一层。");
          return { text: "你以三载光阴深研完整版玄阴诀，阴煞真元与神识相互淬炼，出关时神识之锐，几可匹敌寻常结丹大圆满（神识+3）。", kind: "good" };
        },
        resolve: "advance",
      },
      {
        text: "整备炼器 · 底牌再磨一层",
        hint: "资粮侧重——符丹器全面整备",
        effect(s) {
          s.skills = s.skills || {}; s.skills.alchemy = (s.skills.alchemy || 0) + 2;
          State.give("dingshen_fu", 2); State.give("huiyuan_dan", 2);
          Engine.writeLedger("whfy_a1_focus", "蛰伏侧伏·整备符丹器——底牌磨得更利。");
          return { text: "你把三载光阴摊在丹炉与符案上——定身符、回元丹一摞摞码进储物镯。风雨欲来，底牌越厚，腰杆越硬（熟练+2·符丹入囊）。", kind: "good" };
        },
        resolve: "advance",
      },
    ],
  },

  // —— 幕一②·公孙杏误闯（妖禽追杀·救/旁观抉择）——
  //   canon 勘正（2026-07-11 复核 #2）：公孙杏=散修（无门派·为采金盏草救父出海遇兽潮），
  //   旧稿"青灵门/鹰鸢兽"均自造名——门派改散修、兽名改泛称，生祠彩蛋随裂风岛逃生兑现
  {
    id: "whfy_a1_gongsun",
    skipIf: (s) => s.flags.whfy_gongsun_done,
    cond: (s) => s.flags.whfy_open && !s.flags.whfy_gongsun_done,
    bgm: "tense",
    title: "孤崖 · 不速之客",
    objTitle: "误闯 · 救或不救",
    objHint: "一行散修出海采药，被妖禽追杀、慌不择路逃到你洞府外的礁滩。出手，行踪必露；不出手，这群人撑不过一炷香。",
    text: [
      { scene: "孤崖洞府外 · 礁滩" },
      { amb: null },
      { shot: "shock", scale: 1.1, px: 7 },
      { sfx: "farRoar" },
      "闭关尾声，崖外骤起打斗声与哭喊——你神识一扫：七八名筑基散修被两头七级海妖禽追得走投无路，正朝你洞府所在的礁滩亡命奔逃。",
      { shot: "focusLeft" },
      "为首的青衫女修且战且退，把两名重伤同伴护在身后。她的剑光已经散了，妖禽的铁翎利爪堪堪掠过她的肩头。",
      { aside: "出手，三年蛰伏的行踪便露了；不出手……这滩礁石上今日就要多七八具尸首。「韩老魔」杀人如麻——真韩立呢？" },
    ],
    onArrive(s) { State.setFlag("whfy_gongsun_done"); },
    choices: [
      {
        text: "出手 · 崖上一剑清场",
        hint: "救人=行踪暴露（动漫线）",
        effect(s) {
          State.setFlag("whfy_saved_gongsun");
          Engine.writeLedger("whfy_saved_gongsun", "孤崖·出手救下被海妖禽追杀的散修公孙杏一行——恶名满海之时的一缕善声。行踪因此暴露。");
          Engine.recordTemperament("whfy_saved_gongsun", "sentiment", "孤崖救落难散修——恶名压顶仍不改本心，杀伐由我、善恶也由我");
          return { text: "你一步跨出洞府，青竹蜂云剑破匣而出。", kind: "event" };
        },
        resolve: "whfy_yingyuan_fight",
      },
      {
        text: "静观 · 蛰伏为重",
        hint: "不暴露——但这滩上要见血",
        effect(s) {
          s.demon = Math.min(100, (s.demon || 0) + 4);
          s.mood = Math.max(0, (s.mood || 0) - 6);
          State.setFlag("whfy_gongsun_watched");
          Engine.writeLedger("whfy_gongsun_watched", "孤崖·未第一时间出手——迟了半刻，两名散修殒命爪下，韩立终究还是出剑清了场。这半刻，记在了心魔账上。");
          return { text: "你按住了剑。半刻之后，两声惨叫刺进耳膜——你到底还是跨了出去，一剑清场。可那两名散修，已经凉了。公孙杏跪谢救命之恩时，你没敢受全这个礼。", kind: "bad" };
        },
        resolve: "whfy_yingyuan_fight",
      },
    ],
  },

  // —— 幕一③·战后·公孙杏之请（救父一次抉择·用户拍板=不展开支线）——
  {
    id: "whfy_a1_gongsun2",
    skipIf: (s) => s.flags.whfy_gongsun2_done,
    cond: (s) => s.flags.whfy_yingyuan_won && !s.flags.whfy_gongsun2_done,
    bgm: "daily",
    title: "孤崖 · 公孙杏之请",
    objTitle: "结缘 · 一诺",
    objHint: "散修女子公孙杏拜谢救命之恩，又硬着头皮再求一事：她此番出海本为采药救父——其父真元逆转、命悬一线，愿为奴为婢换一线生机。",
    text: [
      { scene: "孤崖洞府外 · 礁滩" },
      "青衫女修敛衽下拜，自报家门：散修公孙杏，无门无派。谢过救命之恩，她却没有起身。",
      { say: "公孙杏", tone: "soft", text: "「前辈修为通天……小女子斗胆再求一事。此番出海本为采一味灵药救父——家父修炼出岔、真元逆转，命不久矣。若前辈肯施援手，公孙杏……甘愿为奴为婢，绝无二话。」" },
      { aside: "真元逆转——是疑难，却难不倒一个丹道浸淫多年、又见过大世面的结丹修士。难的从来不是病，是要不要多沾一桩因果。" },
    ],
    onArrive(s) { State.setFlag("whfy_gongsun2_done"); },
    choices: [
      {
        text: "赠丹赐方 · 「为奴为婢就免了」",
        hint: "药理仁心——结一段善缘",
        effect(s) {
          s.mood = Math.min(s.moodMax, (s.mood || 0) + 5);
          State.setFlag("whfy_gongsun_father_saved");
          Engine.writeLedger("whfy_gongsun_father", "孤崖·赠丹赐方救公孙杏之父（真元逆转）——为奴为婢免谈，结下一段善缘。她说：外海但有公孙一家在处，前辈的名字我们替你洗。");
          return { text: "你取出两枚调元丹，又提笔写下一张温养方子：「按方服用，百日可稳。为奴为婢就免了——把人照顾好。」公孙杏怔怔接过，眼圈通红：「公孙杏无以为报。『韩老魔』这三个字的真假，我们一家替前辈说与人听——说一辈子。」", kind: "good" };
        },
        resolve: "advance",
      },
      {
        text: "婉拒 · 「令尊之疾，另请高明」",
        hint: "少沾因果——乱世自保",
        effect(s) {
          Engine.writeLedger("whfy_gongsun_father", "孤崖·婉拒公孙杏救父之请——乱世之中少沾一桩因果。她没有怨怼，只再拜了一拜，扶着伤者走了。");
          return { text: "你摇了摇头：「我一身麻烦缠身，令尊之疾，另请高明吧。」公孙杏眼底的光黯了黯，却没有怨怼，只又深深拜了一拜，扶起伤者，一行人消失在海雾里。", kind: "event" };
        },
        resolve: "advance",
      },
    ],
  },

  // —— 幕一④·出关·沧澜坊市立威（云天啸挑衅→碾压战）——
  {
    id: "whfy_a1_chuguan",
    skipIf: (s) => s.flags.whfy_yunt_done,
    cond: (s) => s.flags.whfy_gongsun2_done && !s.flags.whfy_yunt_done,
    bgm: "town",
    title: "沧澜坊市 · 韩老魔",
    objTitle: "出关 · 立威",
    objHint: "行踪既露，蛰伏已无意义。你现身外海沧澜坊市采买破境资粮——满市风声都是「韩老魔」的血案。一名魔修当众叫破你的身份，狮子大开口。",
    text: [
      { scene: "沧澜坊市 · 大街" },
      { amb: "market" },
      { shot: "establish" },
      "行踪既露，缩回孤崖已无意义。你索性现身沧澜坊市，采买冲击大圆满的资粮——一路行来，满市都在议论「韩老魔」新添的几桩血案。",
      { shot: "shock", scale: 1.1, px: 6 },
      { sfx: "danger" },
      // canon 复核 #3（2026-07-11）：云天啸=妙音门叛徒长老（勾结元婴妙鹤真人谋权·遭门中通缉）——身份归位
      "一声冷笑自身后炸起。拦路者一身华袍、气度倨傲——有识货的低呼出声：云天啸，妙音门的叛徒长老，勾结元婴老怪谋夺门权不成、正遭门中通缉的亡命之徒。他声音故意放得满街都听得见：",
      { say: "云天啸", tone: "冷笑", text: "「韩老魔？好大的名头。云某如今正缺安身的本钱——把储物镯留下，再自废一臂，云某便当没见过你。否则，今日这满街的人，都是见证！」" },
      { amb: null },
      { wait: 500 },
      { shot: "pushIn", ms: 1000, scale: 1.14 },
      { say: "韩立", emo: "calm", tone: "low", text: "「威胁的言语，道友还是少说些的好。」" },
      { aside: "满街的议论声，不知何时静了下来。他要的是名，是财，是当众踩着「韩老魔」上位。那便让他看看——韩老魔这三个字，究竟是谁在替谁扬名。" },
    ],
    onArrive(s) {
      s.location = "waihai_fangshi";
      State.setFlag("whfy_chuguan");
    },
    choices: [
      { text: "出手 · 「否则厉某心情不好，血洗了这里也说不定」", hint: "一招立威（动漫名场面）", resolve: "whfy_yunt_fight" },
    ],
  },

  // —— 幕一⑤·拍卖会·救文思月（故人之女·铜片+巢穴情报）——
  {
    id: "whfy_a1_paimai",
    skipIf: (s) => s.flags.whfy_paimai_done,
    cond: (s) => s.flags.whfy_yunt_won && !s.flags.whfy_paimai_done,
    bgm: "fair",
    title: "沧澜坊市 · 地下拍卖会",
    objTitle: "拍卖 · 故人之女",
    objHint: "立威之后，无人再敢当街聒噪。你循线摸进地下拍卖会寻破境资粮——压轴「拍品」却是个活人：故人文樯之女文思月，被妙音门余孽当货卖。",
    text: [
      { scene: "沧澜坊市 · 地下拍场" },
      { amb: "candle" },
      { shot: "establish" },
      // canon 复核 #5（2026-07-11）：铜片=孙姓道友所有、韩立以妖丹换购（挟立威余威）；正典为记载妖修功法的梵圣真片
      "地下拍场鱼龙混杂。你压着气息连拍了几味辅药，邻座一名孙姓散修却摊开一枚残破铜片高价求售——铜片上隐有三头六臂的法相纹路，你心头莫名一动。挟着当街败云天啸的余威，你放下一颗外海妖丹，孙姓散修掂了掂分量，没敢讨价。",
      { fx: "flash", color: "#c9a86a", alpha: 0.14, ms: 320 },
      { shot: "pushIn", ms: 1200 },
      { sfx: "danger" },
      "压轴的「拍品」被推上台时，你的眼神冷了下来——竟是个被禁制锁住的年轻女修。报名之时，她咬着唇报出家门：文氏思月。",
      { wait: 500 },
      { aside: "文樯之女。镇妖大典上与你并肩报名的那个爽朗汉子——他的女儿，如今被妙音门余孽当货物一样标价。" },
      { say: "文思月", tone: "soft", text: "「哪位前辈肯救思月出去……思月愿执箕帚、为侍为妾，绝无怨言！」" },
    ],
    onArrive(s) {
      State.setFlag("whfy_paimai_done");
      State.give("santou_tongpian", 1);
      Engine.writeLedger("whfy_tongpian", "地下拍场以一颗外海妖丹换得三头六臂法相纹残破铜片——细察之下竟隐载一门妖修功法的残篇，法相狞恶、深不可测，不敢修习、暂且收之（远线功法·只种不收）。");
    },
    choices: [
      {
        text: "拍下并解禁 · 「令尊与我有一面之缘」",
        hint: "救故人之女（动漫线）——得裂风岛情报",
        effect(s) {
          State.setFlag("whfy_saved_wensiyue");
          State.setFlag("whfy_liefeng_open");
          Engine.writeLedger("whfy_saved_wensiyue", "地下拍场·拍下并解禁文思月（文樯之女）——为侍为妾免谈，念故人之谊放她自去。她以裂风岛八级妖兽巢穴与『伴妖草』的情报相报。");
          return { text: "你抬手报出一个无人敢跟的价，当场解了她的禁制：「令尊与我有一面之缘。为侍为妾就免了——好自珍重。」文思月泣拜于地，临别低声相报：外海裂风岛地底有八级妖兽巢穴，巢外崖缝生着炼傀奇物「伴妖草」——那是她被掳前家中商队用命换来的情报。", kind: "good" };
        },
        resolve: "advance",
      },
      {
        text: "不趟浑水 · 散场后再暗中跟去",
        hint: "谨慎——救人于无人处（代价：多费周章）",
        effect(s) {
          s.spirit = Math.max(0, (s.spirit || 0) - 300);
          State.setFlag("whfy_saved_wensiyue");
          State.setFlag("whfy_liefeng_open");
          Engine.writeLedger("whfy_saved_wensiyue", "地下拍场·未当场出手，散场后循气暗蹑、于海上截杀押送者救下文思月——不显山露水，却多费了一夜周章。同样得裂风岛情报。");
          return { text: "你没有举牌。散场后循着押送灵舟的气息追出百里，一剑沉舟、于无人海域救下文思月——不显山不露水。她惊魂甫定，同样以裂风岛「伴妖草」与八级妖兽巢穴的情报相报（耗灵力·多费一夜周章）。", kind: "event" };
        },
        resolve: "advance",
      },
    ],
  },

  // —— 幕一收口·裂风岛之引（幕二钩）——
  {
    id: "whfy_a1_close",
    skipIf: (s) => s.flags.whfy_a1_done,
    cond: (s) => s.flags.whfy_paimai_done && !s.flags.whfy_a1_done,
    bgm: "journey",
    title: "外海 · 裂风岛之引",
    objTitle: "幕一收口 · 目标伴妖草",
    objHint: "破境大圆满需一味主药引，「伴妖草」正合用——它就长在八级妖兽裂风兽的洞口。恶名未清、强敌环伺，你决意先取此草。",
    text: [
      { scene: "沧澜坊市 · 客舍" },
      { amb: "candle" },
      { shot: "establish" },
      "灯下盘点：三头六臂铜片来历成谜；「韩老魔」的血案还在外海各处添新账；而文思月所报的「伴妖草」，恰是你冲击结丹大圆满缺的那味主药引。",
      { say: "韩立", emo: "serious", tone: "low", text: "「八级妖兽的洞口……虎口拔牙。可这毛，不拔也得拔了。」" },
      {
        guide: {
          tag: "外海风云 · 幕一终 —— 恶名与出关",
          title: "下一步：裂风岛 · 采伴妖草",
          hint: "舆图前往「裂风岛」探索采药。八级裂风兽的巢穴就在地底——脚步放轻些。（幕二 · 智夺风雷翅，即将展开）",
          cta: "（整备行装 · 往裂风岛去）",
        },
      },
    ],
    onArrive(s) {
      State.setFlag("whfy_a1_done");
      Engine.addMilestone("外海风云·幕一终：立威沧澜·得裂风岛之引", "waihaifengyun");
      const t = `第${s.year}年${s.month}月`;
      s.worldNews = s.worldNews || [];
      s.worldNews.push({ t, kind: "rumor", text: "沧澜坊市传遍：真「韩老魔」当街一招败云天啸——「威胁言语少说，血洗此地也说不定」。真伪韩老魔之说，自此四起。" });
      if (s.worldNews.length > 40) s.worldNews.splice(0, s.worldNews.length - 40);
      // —— 铁律3·幕一账本收口（近响在此结清；远线由 flags/实物继续承载：
      //    whfy_saved_gongsun flag→幕二夺翅撤离、santou_tongpian 实物→远线法宝、恶名→幕四清算抉择）——
      let echo = 0;
      if (Engine.settleLedger("whfy_a1_focus", "孤崖三载的侧重，在出关这几日一一显了形——蛰伏没有虚度，你带出关的每一分底气，都是那一千多个日夜一寸寸磨出来的")) echo += 2;
      if (Engine.settleLedger("whfy_yingyuan_won", "出关第一剑斩双海妖禽的风声，比你先一步到了沧澜坊市——听过的人都说：那一剑，不像传闻里滥杀的『韩老魔』，倒像个救人的")) echo += 1;
      if (Engine.settleLedger("whfy_yunt_won", "云天啸当街跪着爬走的样子，成了坊市这半月最热的谈资——从此在沧澜地界，再没人敢当面聒噪『韩老魔』三个字")) echo += 2;
      if (Engine.settleLedger("whfy_saved_gongsun", "公孙杏一行的谢礼悄悄送到了客舍门口：一匣东拼西凑的灵材，附一张字条——『前辈之名，我们记下了』。恶名满海的日子里，这一匣子东西烫得暖手")) { echo += 2; State.give("lingshi", 40); }
      if (Engine.settleLedger("whfy_gongsun_watched", "那半刻的迟疑换来两条人命——夜里打坐，爪撕布帛的声音总在耳边。你把这笔账记在自己头上：下一次，剑要快过算计")) echo -= 1;
      if (Engine.settleLedger("whfy_gongsun_father", "公孙杏托商船捎来口信：其父按方服药，真元逆转之势已稳。信末只有一句——『公孙一家上下，不信韩老魔杀人』")) echo += 2;
      if (Engine.settleLedger("whfy_saved_wensiyue", "文思月的情报当夜就兑了现——裂风岛的海图与巢穴方位详尽得可怕，那是文家商队用命换来的东西，如今原原本本交在你手上")) echo += 1;
      Engine.settleLedger("whfy_tongpian", "三头六臂铜片收进乾坤袋最深处——它安安静静，可你总觉得，这枚残片与你之间有条看不见的线（远线·实物在囊即惦记）");
      if (echo) s.mood = Math.min(s.moodMax, Math.max(0, (s.mood || 0) + echo));
    },
    choices: [
      { text: "整备行装 · 往裂风岛去", hint: "幕二 · 智夺风雷翅（待续）", resolve: "advance" },
    ],
  },

  /* ============================================================
   *  外海风云 · 幕二 · 风希做客·智夺风雷翅（S2·动漫129~134·原著风希视角互证）
   * ============================================================ */

  // —— 幕二①·裂风岛·洞口采药（采草惊主·风希现身）——
  {
    id: "whfy_a2_liefeng",
    skipIf: (s) => s.flags.whfy_liefeng_done,
    cond: (s) => s.flags.whfy_a1_done && !s.flags.whfy_liefeng_done,
    bgm: "tense",
    title: "裂风岛 · 洞口的草",
    objTitle: "采药 · 虎口拔牙",
    objHint: "伴妖草就长在裂风兽洞口的崖缝里。神识探过：洞中妖气深不见底——快取快走，别惊动里面的东西。",
    text: [
      { scene: "裂风岛 · 火山崖穴" },
      { amb: "wind" },
      { shot: "establish" },
      "裂风岛妖气冲天。你敛尽气息贴崖而行，几株莹白的伴妖草果然生在洞口崖缝——探手便得。",
      { amb: null },
      { shot: "shock", scale: 1.14, px: 8 },
      { sfx: "farRoar" },
      { fx: "flash", color: "#1a2430", alpha: 0.3, ms: 380 },
      "指尖刚触到第三株，整座山腹忽地一沉。洞中黑风倒卷，一道人影负手立在洞口——化形妖修，周身妖压如山如渊。",
      { wait: 500 },
      { shot: "focusLeft" },
      { say: "风希", tone: "含笑", text: "「进本座的洞，只拿了几株草？——有意思。人族小修士，胆子不小，眼力……也不错。」" },
      { aside: "九级妖兽·化形！比结丹更高一头的存在。打，是万万打不过的；跑，他一爪就能按住你。他没动手——那便还有斡旋的余地。" },
    ],
    onArrive(s) {
      s.location = "liefeng_dao";
      State.setFlag("whfy_liefeng_done");
      State.give("banyao_cao", 3);
      Engine.meetNpc("fengxi", "裂风兽·刚化形的九级妖修，自号『风大善人』——笑里全是爪子。");
      Engine.writeLedger("whfy_liefeng", "裂风岛洞口采伴妖草惊动风希（九级化形妖修）——他不杀反笑，邀『做客』。黄鼠狼给鸡拜年。");
    },
    choices: [
      {
        text: "拱手陪笑 · 「妖王当面，失礼了」",
        hint: "顺着他——先活下来",
        effect(s) {
          return { text: "你把姿态放得极低，草也双手奉还。风希摆摆手，笑意更深：「草，送你了。走，随本座进洞喝一杯——本座请客，你敢不来么？」", kind: "event" };
        },
        resolve: "advance",
      },
      {
        text: "不卑不亢 · 「拿草可以，命不奉陪」",
        hint: "硬气三分——他反而高看一眼",
        effect(s) {
          State.setFlag("whfy_fengxi_hardline");
          Engine.recordTemperament("whfy_fengxi_hardline", "sentiment", "九级妖王当面不折腰——命可以拼，膝盖不能软");
          return { text: "风希盯着你看了三息，忽而放声大笑：「好胆色！几百年没见过敢和本座这么说话的人族了。走，进洞喝一杯——放心，本座`请`你。」那个『请』字，咬得极重。", kind: "event" };
        },
        resolve: "advance",
      },
    ],
  },

  // —— 幕二②·做客·碧焰酒（被迫进步·破境结丹大圆满）——
  {
    id: "whfy_a2_zuoke",
    skipIf: (s) => s.flags.whfy_zuoke_done,
    cond: (s) => s.flags.whfy_liefeng_done && !s.flags.whfy_zuoke_done,
    bgm: "tense",
    title: "裂风兽洞 · 碧焰酒",
    objTitle: "做客 · 杯中有物",
    objHint: "风希设宴，一坛「碧焰酒」推到你面前——妖王亲酿，一杯可助破境。他笑得太热情了，热情得让人后颈发凉。",
    text: [
      { scene: "裂风兽洞 · 石殿" },
      { amb: "candle" },
      { shot: "establish" },
      "石殿深处灯火煌煌。风希自称「风大善人」，绝口不提采草之事，只把一坛幽绿的酒推过来：",
      { fx: "flash", color: "#3ddc84", alpha: 0.12, ms: 420 },
      { shot: "pushIn", ms: 1100 },
      { say: "风希", tone: "热络", text: "「碧焰酒——本座亲酿，妖界一绝。你这瓶颈卡了有些年头了吧？一杯下去，管保你破境。喝！」" },
      { wait: 500 },
      { aside: "酒香里缠着一缕若有似无的异样气机。可妖王劝酒，推拒便是撕破脸……而且那酒里蕴的天地灵机，货真价实——他要控制你，也要先把你喂肥。" },
    ],
    onArrive(s) { State.setFlag("whfy_zuoke_done"); },
    choices: [
      {
        text: "饮 · 顺水推舟破此境",
        hint: "明知有诈也喝——境界是真的",
        effect(s) {
          State.setFlag("whfy_drank_open");
          Engine.writeLedger("whfy_biyan_jiu", "裂风兽洞·明知碧焰酒有诈仍饮——混沌邪气与风灵劲入体受制于人，但借酒中灵机真的破境：结丹大圆满。被迫进步，货真价实。");
          return { text: "你举杯一饮而尽。灵机如岩浆入喉、卡了数年的瓶颈应声而裂——可与此同时，两缕阴冷的异气顺着酒力钻入经脉深处，盘踞不去。风希笑眯眯看着你：「恭喜。从今日起，你我就是『自己人』了。」", kind: "event" };
        },
        resolve: "advance",
      },
      {
        text: "饮 · 暗运玄阴诀锁截异气",
        hint: "药理+神识——把『锁』咬松半扣（夺翅战开局占先）",
        effect(s) {
          State.setFlag("whfy_drank_guarded");
          Engine.writeLedger("whfy_biyan_jiu", "裂风兽洞·饮碧焰酒破境（结丹大圆满），却暗运玄阴诀截流——混沌邪气与风灵劲只种进去半扣。风希自以为上了双保险，殊不知锁眼里早塞了沙。");
          return { text: "你举杯而尽，酒力入体的刹那暗转玄阴诀——阴煞真元裹住那两缕异气，生生截下半数封入气海死角。瓶颈碎裂、境界破关，风希端详你片刻，满意点头：「好根骨。」他没看出来。", kind: "good" };
        },
        resolve: "advance",
      },
    ],
  },

  // —— 幕二③·破境·结丹大圆满（碧焰酒兑现）——
  {
    id: "whfy_a2_pojing",
    skipIf: (s) => s.flags.whfy_pojing_done,
    cond: (s) => s.flags.whfy_zuoke_done && !s.flags.whfy_pojing_done,
    bgm: "triumph",
    title: "裂风兽洞 · 被迫进步",
    objTitle: "破境 · 结丹大圆满",
    objHint: "碧焰酒的灵机在丹田轰然炸开——结丹大圆满，成了。代价是经脉里那两缕受制于人的异气，和一场躲不开的『帮工』。",
    text: [
      { scene: "裂风兽洞 · 客洞" },
      { amb: null },
      { shot: "pushIn", ms: 1400, scale: 1.1 },
      "客洞之中你盘膝三日。碧焰酒的灵机如熔金淬体，金丹一圈圈涨圆——",
      { fx: "flash", color: "#ffe9ad", alpha: 0.4, ms: 600 },
      { fx: "burst", at: "center", elem: "jin", ms: 420 },
      { sfx: "bell" },
      { say: "韩立", emo: "calm", tone: "low", text: "「结丹大圆满……离元婴，只差临门一脚了。这一杯，倒真没白喝。」" },
      { shot: "pullOut", ms: 1300 },
      { aside: "只是经脉深处那缕「风灵劲」像一根看不见的缰绳——风希摊牌了：三妖合炼一件大宝，缺你的木属性灵力『帮工』。炼成之前，你哪儿也去不了。" },
    ],
    onArrive(s) {
      State.setFlag("whfy_pojing_done");
      if ((s.realmIndex || 0) < 20) {
        s.realmIndex = 20;   // 结丹大圆满（DATA.realms[20]）
        s.cultivation = 0;
        const nr = State.realm();
        if (nr && nr.spMax) s.spirit = nr.spMax;
        s.hpMax += 40; s.hp = s.hpMax;
        s.sense = (s.sense || 0) + 5;
      }
      Engine.addMilestone("外海风云·碧焰酒破境：结丹大圆满（被迫进步）", "breakthrough");
      Engine.writeLedger("whfy_pojing", "碧焰酒破境·结丹大圆满——妖王的酒喂肥了猎物，也喂出一头他按不住的狼。风灵劲缰绳在身，助炼风雷翅之局开场。");
    },
    choices: [
      { text: "「帮工就帮工——先看看你炼的是什么宝贝。」", hint: "入局·伺机而动", resolve: "advance" },
    ],
  },

  // —— 幕二④·助炼·时间跳跃（数月·3选1侧重——影响夺翅战开局）——
  {
    id: "whfy_a2_zhulian",
    skipIf: (s) => s.flags.whfy_zhulian_done,
    cond: (s) => s.flags.whfy_pojing_done && !s.flags.whfy_zhulian_done,
    bgm: "journey",
    title: "裂风兽洞 · 炉边岁月",
    objTitle: "助炼 · 暗蓄一手",
    objHint: "毒蛟、玄龟二妖应邀而至，三妖合炼「风雷翅」——雷鹏遗骸为材，你的木属性灵力司调和。炉边数月，你有的是时间留心眼。",
    text: [
      { scene: "裂风兽洞 · 炼宝石窟" },
      { amb: "candle" },
      { shot: "establish" },
      "毒蛟阴测测、玄龟慢吞吞——两位化形大妖应邀而至。石窟中央，那对雷鹏遗骸的骨翅在阵中悬浮，风雷之气交缠如活物。",
      { fx: "lightning", at: "center", elem: "shui", ms: 420 },
      { sfx: "thunderFar" },
      "你的活计是以木灵调和风雷相冲之性。炉火经年，日日与那对骨翅相对——风希偶尔投来的目光，越来越像在看一块养熟的『材料』。",
      { aside: "炼成之日，就是灭口之时。这几个月，每一天都得当最后一天来备。" },
    ],
    onArrive(s) {
      State.setFlag("whfy_zhulian_done");
      s.year += 1;   // 助炼经年
      s.age = (s.age || 0) + 1;
      // 雷鹏遗羽伏笔兑现（前篇实物）
      if (State.count("leipeng_yu") > 0) {
        Engine.log("你袖中那枚镇妖大典拾得的雷鹏遗羽微微发烫——与阵中骨翅同源共鸣。原来那日被风希救出生天、又被他亲手斩杀的妖王，就是眼前这对翅的主人。", "event");
        Engine.writeLedger("whfy_leipeng_echo", "助炼风雷翅·袖中雷鹏遗羽与骨翅同源共鸣——镇妖大典乱中拾遗的伏笔，在裂风兽的炼宝炉前对上了号。");
      }
    },
    choices: [
      {
        text: "偷师 · 参悟翅纹与风雷运转",
        hint: "夺翅后驾驭更快（精通弧缩短）",
        effect(s) {
          State.setFlag("whfy_zhulian_canwu");
          Engine.writeLedger("whfy_zhulian_focus", "助炼侧重·偷师参悟翅纹——风雷运转的每一道纹路都刻进神识。此宝到手之日，就是如臂使指之时。");
          return { text: "调和之余，你把那对骨翅的每道纹路、风雷交缠的每分火候都默默刻进神识。风希只当你敬业——他不知道，你连『怎么飞』都学好了。", kind: "good" };
        },
        resolve: "advance",
      },
      {
        text: "固本 · 借炉火温养金丹",
        hint: "气血上限+·大圆满坐稳",
        effect(s) {
          s.hpMax += 30; s.hp = s.hpMax;
          Engine.writeLedger("whfy_zhulian_focus", "助炼侧重·借炼宝炉火温养金丹——大圆满境界彻底坐稳，气血雄浑更胜从前。");
          return { text: "你借炼宝的地火余温日日淬体温丹，新破的大圆满境界一寸寸夯实（气血上限+30）。风希乐见其成——猎物越肥，他越高兴。", kind: "good" };
        },
        resolve: "advance",
      },
      {
        text: "谋逃 · 暗查地穴退路",
        hint: "逃亡战有捷径（撤离更稳）",
        effect(s) {
          State.setFlag("whfy_zhulian_tuilu");
          Engine.writeLedger("whfy_zhulian_focus", "助炼侧重·暗查退路——借采买灵材之机把地穴岔道、传送阵位置摸了个透。逃，也要逃得专业。");
          return { text: "你借外出采买灵材的机会，把整座地穴的岔道、风口、乃至角落里那座半废的传送阵摸了个一清二楚。地图在心里，腿就有了主意。", kind: "good" };
        },
        resolve: "advance",
      },
    ],
  },

  // —— 幕二⑤·毒计·万年灵乳（掺绿液时机抉择）——
  {
    id: "whfy_a2_duji",
    skipIf: (s) => s.flags.whfy_duji_done,
    cond: (s) => s.flags.whfy_zhulian_done && !s.flags.whfy_duji_done,
    bgm: "tense",
    title: "裂风兽洞 · 献乳",
    objTitle: "毒计 · 就在今夜",
    objHint: "炼宝一年，三妖灵力耗竭、正围炉调息。你「适时」献上一小瓶稀释的万年灵乳助其回元——袖中还藏着最后一点小绿瓶灵液：掺进去，时机只有一次。",
    text: [
      { scene: "裂风兽洞 · 石殿" },
      { amb: "candle" },
      { shot: "establish" },
      // canon 复核 #10（2026-07-11）：正典=三妖炼宝耗竭调息时，韩立主动献灵乳掺绿液骗饮——"谁献的酒"归位
      "翅成前夜，三妖灵力耗竭、盘坐炉边调息。你捧出一只玉瓶躬身上前：「晚辈蛰伏岁月里重金购得一瓶稀释的万年灵乳，本欲留作破境之用——三位前辈炼宝辛苦，正该此物回元。」风希眯眼一嗅，倨傲地哼了一声：「算你识相。」",
      { shot: "pushIn", ms: 1300, scale: 1.12 },
      { aside: "杀机就藏在恭顺里：收翅之后，「帮工」就没用了——他们不会留活口，你也没打算留。玉瓶入手前，你袖中捏着这些年一滴滴攒下的小半瓶绿液——催生万物，也能催得万年灵乳药力暴涨、涨到妖躯撑不住。掺，还是不掺？怎么掺？" },
      { wait: 600 },
      { say: "韩立", emo: "serious", tone: "low", text: "「风大善人……这瓶乳，该我敬你才是。」" },
    ],
    onArrive(s) { State.setFlag("whfy_duji_done"); },
    choices: [
      {
        text: "整瓶皆掺 · 三妖分饮",
        hint: "剂量足——三妖尽疲（逃亡战最稳）",
        effect(s) {
          State.setFlag("whfy_duji_full");
          Engine.writeLedger("whfy_duji", "献乳之夜·绿液尽数掺入那瓶稀释万年灵乳——三妖分饮，药力在妖躯里暴涨如潮。明日开炉，便是图穷匕见之时。");
          return { text: "献瓶之前，袖口一翻，绿液早已无声没入乳中。三妖分饮而尽，浑然不觉那股狂暴的生机正在腑脏里生根。", kind: "good" };
        },
        resolve: "advance",
      },
      {
        text: "只掺风希那一份 · 集中一击",
        hint: "剂量专攻主敌——风希重创、二妖清醒",
        effect(s) {
          State.setFlag("whfy_duji_focus");
          Engine.writeLedger("whfy_duji", "献乳之夜·绿液只掺进风希亲执的那一份——主敌一人吃足全量。二妖清醒，但风希这头九级化形，明日将疲得像滩烂泥。");
          return { text: "灵乳分作三盏，你把全部绿液拢进风希亲执的那一盏。九级妖王仰脖饮尽，咂了咂嘴：「好乳！」——好得他明日会终生难忘。", kind: "event" };
        },
        resolve: "advance",
      },
    ],
  },

  // —— 幕二⑥·夺翅（图穷匕见→逃亡战）——
  {
    id: "whfy_a2_duoyi",
    skipIf: (s) => s.flags.whfy_duoyi_done,
    cond: (s) => s.flags.whfy_duji_done && !s.flags.whfy_duoyi_done,
    bgm: "boss",
    title: "裂风兽洞 · 图穷匕见",
    objTitle: "夺翅 · 带人族走",
    objHint: "开炉之日，三妖药力翻涌、妖躯臃胀——就是现在！夺翅、破阵、带地穴里的人族俘虏一起飞出去。风希不可力敌——撑住撤离的每一息。",
    text: [
      { scene: "裂风兽洞 · 炼宝石窟" },
      { amb: null },
      { shot: "shock", scale: 1.14, px: 9 },
      "开炉刹那，三妖同时闷哼——万年灵乳的药力在腑脏里炸开，妖躯臃胀、灵力滞涩！",
      { sfx: "farRoar" },
      { say: "风希", tone: "暴怒", text: "「灵乳有问题……是你！！人族小贼——本座要把你抽筋剥皮！！」" },
      { fx: "flash", color: "#ff7a3a", alpha: 0.28, ms: 420 },
      { cam: "shake", px: 8 },
      { sfx: "thunder" },
      "你已一把攫住阵中双翅、反手一剑劈碎主阵眼！山腹地火倒灌、岩浆轰然上涌——整座裂风岛开始崩塌。地穴深处，是黑压压一片被掳来做苦役的人族修士。",
      { shot: "focusRight" },
      { say: "韩立", emo: "anger", tone: "low", text: "「要走一起走！人族的——跟我杀出去！！」" },
    ],
    onArrive(s) { State.setFlag("whfy_duoyi_done"); },
    choices: [
      { text: "背翅断后 · 护人族杀出崩塌的地穴", hint: "survive 撤离战·风希不可力敌", resolve: "whfy_duoyi_fight" },
    ],
  },

  // —— 幕二⑦·炼化风雷翅（神雷染金+初驭喜剧+精通弧）——
  {
    id: "whfy_a2_lianhua",
    skipIf: (s) => s.flags.whfy_lianhua_done,
    cond: (s) => s.flags.whfy_duoyi_won && !s.flags.whfy_lianhua_done,
    bgm: "triumph",
    title: "外海 · 风雷染金",
    objTitle: "大件到手 · 炼化风雷翅",
    objHint: "甩脱癫狂的风希，你在一座无名礁岛落脚炼化风雷翅——以辟邪神雷为引，逼出原有蓝雷、金雷灌翅。宝是绝世的宝——但九级妖王的本命双翅，岂是一炼就服帖的。",
    text: [
      { scene: "无名礁岛 · 崖洞" },
      { amb: "wind" },
      { shot: "establish" },
      "礁岛崖洞，你盘膝七日。辟邪神雷一道道注入翅中——翅上原生的蓝雷被一丝丝逼出，聚成雷球在洞外自爆；金雷反客为主，双翅通体染金。",
      { fx: "flash", color: "#ffe9ad", alpha: 0.35, ms: 500 },
      { fx: "lightning", at: "center", elem: "jin", ms: 520 },
      { sfx: "thunder" },
      { shot: "pushIn", ms: 1000, scale: 1.14 },
      { say: "韩立", emo: "joy", tone: "low", text: "「风雷翅——成了！」" },
      { shot: "reset" },
      { sfx: "whiff" },
      { cam: "shake", px: 6 },
      // canon 复核 #13（2026-07-11）："初驭三连摔喜剧"经外源证伪系粉丝二创，不再当动漫桥段演——
      // 精通弧保留为纯玩法（大件"到手蜕变"须有过程），文案改"烈宝难驯"的正经写法
      "你振翅一试——风雷轰鸣、身形快过神识！极速是真极速，可雷遁的每一次转折都凶险如走刀锋：九级妖王的本命双翅，认力不认人。",
      { shot: "pullOut", ms: 1200 },
      { aside: "这宝贝烈得像匹没上过鞍的野马——真要人翅合一，还得花些时日，一寸寸驯。" },
    ],
    onArrive(s) {
      State.setFlag("whfy_lianhua_done");
      s.location = "waihai_dongfu";   // 甩脱追杀退回孤崖洞府炼化（地图归位）
      s.flightId = "feng_lei_chi";   // 御风雷翅（traits: fenglei 雷遁 / fly——State.gearTrait 直读）
      State.setFlag("fly_unlocked");
      if (s.flags.whfy_zhulian_canwu) {
        State.setFlag("whfy_chi_mastered");   // 助炼时偷师参悟——到手即如臂使指（精通弧跳过）
        Engine.log("助炼时偷师的翅纹运转此刻全数派上用场——旁人要驯数年的烈宝，你七日便如臂使指（风雷翅·精通）。", "good");
      }
      Engine.addMilestone("外海风云·风雷翅到手炼化（辟邪神雷染金·雷遁解锁）", "bigitem");
      Engine.writeLedger("whfy_fenglei_chi", "智夺风雷翅并以辟邪神雷炼化染金——雷遁瞬移解锁、遁速冠绝同侪。风希癫狂追杀未果，帝国崩塌、双翅易主。" + (s.flags.whfy_zhulian_canwu ? "（助炼偷师·到手即精通）" : "（初驭不善——精通弧待磨）"));
      Engine.settleLedger("whfy_leipeng_echo", "雷鹏的遗羽与它主人的双翅，最终都归了同一个人——镇妖大典那场乱，绕了一整篇章，在这对金翅上落定");
      // —— 铁律3·幕二账本收口 ——
      Engine.settleLedger("whfy_liefeng", "洞口那三株伴妖草，最终换来了一对风雷翅——裂风岛这趟虎口拔牙，连本带利");
      // canon 复核 #14（2026-07-11）：风灵劲正典=一直带到落云宗才解决的隐患——改"暂压未除"留重返天南钩
      Engine.settleLedger("whfy_biyan_jiu", "碧焰酒的『恩情』，你用他炼了一辈子的翅还了——只是他种下的那缕风灵劲仍缠在气海深处：暂以真元压住，未除。这条看不见的缰绳，日后须寻高明手段连根拔起");
      Engine.writeLedger("whfy_fenglingjin", "风希种下的风灵劲暂压未除——追踪与反噬的隐患仍缠气海，须寻大宗门秘法连根拔除（重返天南再算）。");
      Engine.settleLedger("whfy_zhulian_focus", "炉边一年的那点侧重，在夺翅这一夜全数兑现——炉火没白看，心眼没白留");
      Engine.settleLedger("whfy_duji", "攒了经年的小半瓶绿液，换了三妖一夜疲软——这瓶子陪你从青牛镇走到外海，攒下的每一滴都用在了刀刃上");
      Engine.settleLedger("whfy_duoyi_won", "裂风岛的火光熄了很多天后，外海还在传那一夜——数十名人族修士，是被『韩老魔』背着翅膀断后送出来的");
      // canon 复核 #11（2026-07-11）：正典夺翅夜斩杀毒蛟收其精魄（蛟魂=日后青竹蜂云剑升级材料）——远线只种不收
      Engine.writeLedger("whfy_jiaohun", "夺翅乱战中神雷贯体、噬金虫蚀甲——八级毒蛟殒身，你顺手摄住了它溃散前的一缕精魄蛟魂。此物阴寒精纯，隐隐与青竹蜂云剑相和——日后炼剑再进一步时，或有大用（远线只种不收·重返天南再算）。");
      const t = `第${s.year}年${s.month}月`;
      s.worldNews = s.worldNews || [];
      s.worldNews.push({ t, kind: "world", text: "裂风岛一夜崩塌：九级妖王风希的『帝国』毁于地火，妖修圈盛传——是一个人族结丹修士，端了化形大妖的老巢。" });
      s.worldNews.push({ t, kind: "rumor", text: "被掳的数十名人族修士尽数生还归来，人人都说：带他们杀出火海的，是那个被叫作『韩老魔』的人。" });
      if (s.flags.whfy_saved_gongsun) {
        s.worldNews.push({ t, kind: "rumor", text: "有生还的散修在家乡为『韩老魔』立了生祠——公孙氏一家四时供奉，说要世代传下去。传闻者无不咋舌。" });
      }
      // canon 彩蛋（复核 #3）：叛徒云天啸的下场——妙音门清理门户（正典 134 集韩立受托瞬杀，此处归门中收尾不代玩家出手）
      s.worldNews.push({ t, kind: "rumor", text: "妙音门清理门户：叛徒长老云天啸重伤未愈之际，终为门中所诛——有人说，借的是真『韩老魔』当街那一剑的余威。" });
      if (s.worldNews.length > 40) s.worldNews.splice(0, s.worldNews.length - 40);
    },
    choices: [
      {
        text: "驯翅 · 一寸寸磨这匹烈马",
        hint: "偷过师=即刻精通；否则数月磨合",
        effect(s) {
          if (!s.flags.whfy_chi_mastered) {
            State.setFlag("whfy_chi_mastered");
            s.month += 3; while (s.month > 12) { s.month -= 12; s.year += 1; }
            return { text: "三个月里你日日御翅掠海：从压不住的横冲直撞，到雷遁转折收发由心——当最后一次振翅收势、稳稳钉在浪尖上时，风雷翅终于认了主。自此，乱星海再没有你去不了、逃不掉的地方。", kind: "good" };
          }
          return { text: "翅随念动、风雷如臂——助炼时偷的师，一分都没白费。", kind: "good" };
        },
        resolve: "advance",
      },
    ],
  },

  /* ============================================================
   *  外海风云 · 幕三 · 还阳术·大战温天仁（S3·动漫135~140）
   * ============================================================ */

  // —— 幕三①·重遇元瑶（虚天殿养魂木之诺收果）——
  {
    id: "whfy_a3_yuanyao",
    skipIf: (s) => s.flags.whfy_yuanyao_done,
    cond: (s) => s.flags.whfy_lianhua_done && !s.flags.whfy_yuanyao_done,
    bgm: "sorrow",
    title: "内海 · 故人元瑶",
    objTitle: "重逢 · 三十年之诺",
    objHint: "内海航路上一叶素舟拦住去路——元瑶。虚天殿一别经年，她终于凑齐了还阳术所需，只差一个信得过的护法之人。",
    text: [
      { scene: "内星海 · 航路" },
      { amb: "wind" },
      { shot: "establish" },
      "一叶素舟拦在航路正中，舟头女子面覆轻纱——元瑶。虚天殿养魂木分账的旧约，她记到今日。",
      { shot: "focusLeft" },
      { say: "元瑶", tone: "soft", text: "「韩道友，别来无恙。妍丽师姐的魂灯……我养了三十年，养魂木、聚魂砂、还有那部禁术，都齐了。只差一个——肯在阴冥之地边缘，替我护法三日的人。」" },
      { shot: "pushIn", ms: 1300 },
      { aside: "还阳术，逆天改命的禁术；阴冥之地，鬼雾出没的凶海。她把身家性命摊开在你面前——因为整片乱星海，她只信你一个。" },
      { wait: 600 },
      { say: "韩立", emo: "calm", tone: "low", text: "「三日护法。可以。」" },
    ],
    onArrive(s) {
      State.setFlag("whfy_yuanyao_done");
      Engine.settleLedger("xh_yuanyao_deal", "虚天殿里分给元瑶的那半段养魂木，三十年后长成了妍丽复生的指望——她拦舟相托的这份信，是当年那一念之仁自己长出来的果");
      Engine.writeLedger("whfy_hufa_promise", "内海重遇元瑶——应下阴冥之地边缘护法三日之诺（还阳术复活妍丽）。禁术异象必引各路修士，三日之内刀兵难免。");
      Engine.meetNpc("yuan_yao", "结丹女修·为复活替她挡死的师姐妍丽奔走三十年——还阳术之约，托付于韩立。");
    },
    choices: [
      { text: "随她赴阴冥之地边缘 · 布阵护法", hint: "三日之约·风雨将至", resolve: "advance" },
    ],
  },

  // —— 幕三②·护法三日（互斥策略→护阵波次战）——
  {
    id: "whfy_a3_hufa",
    skipIf: (s) => s.flags.whfy_hufa_done,
    cond: (s) => s.flags.whfy_yuanyao_done && !s.flags.whfy_hufa_done,
    bgm: "tense",
    title: "阴冥之地边缘 · 护法三日",
    objTitle: "护法 · 三日刀兵",
    objHint: "还阳术的异象冲天而起，四方修士闻风而聚。三日护法怎么打，由你定策——策不同，来敌不同。",
    text: [
      { scene: "阴冥之地边缘 · 礁原" },
      { amb: "wind" },
      { shot: "establish" },
      { fx: "burst", at: "center", elem: "shui", n: 16, ms: 520 },
      { fx: "flash", color: "#6fd0e8", alpha: 0.25, ms: 480 },
      { sfx: "castShui" },
      "元瑶咬破指尖，还阳阵蓝焰冲天——异象半海可见。第一天，就有零散修士循光而来。",
      { aside: "三日之约。是把阵守成铁桶，是主动出去清场，还是敛尽气息装作无人？——策略定了，来的『客人』也就定了。" },
    ],
    onArrive(s) { State.setFlag("whfy_hufa_done"); },
    choices: [
      {
        text: "铁桶阵 · 层层布阵死守阵眼",
        hint: "阵法解——开局满阵佐助，敌蜂拥",
        effect(s) {
          State.setFlag("whfy_hufa_zhen");
          Engine.writeLedger("whfy_hufa_plan", "护法定策·铁桶阵——三重阵法围着还阳阵眼层层布下，人来多少收多少。");
          return { text: "三日里你把随身阵旗尽数布开——困足、聚灵、迷踪三重套叠。修士来了一茬又一茬，全在阵里撞得头破血流。第三日，来了硬茬。", kind: "good" };
        },
        resolve: "whfy_hufa_fight",
      },
      {
        text: "主动清场 · 御翅巡海逐一驱杀",
        hint: "剑道解——敌来得少但每个都硬",
        effect(s) {
          State.setFlag("whfy_hufa_qing");
          Engine.writeLedger("whfy_hufa_plan", "护法定策·主动清场——风雷翅巡海百里，靠近者驱、顽抗者杀。杀鸡儆猴，第三日只剩不怕死的。");
          return { text: "你御翅巡海，方圆百里凡有靠近者，先礼后剑。头两日驱走十七拨、斩顽抗者三人——第三日还敢来的，都是真不怕死的。", kind: "good" };
        },
        resolve: "whfy_hufa_fight",
      },
      {
        text: "匿踪守株 · 敛息藏于阵侧",
        hint: "藏拙解——放进来打，背袭先手",
        effect(s) {
          State.setFlag("whfy_hufa_ni");
          Engine.writeLedger("whfy_hufa_plan", "护法定策·匿踪守株——不显山露水，放贪心人走到阵前，再从死角里给他们一个『惊喜』。");
          return { text: "你敛尽气息伏于阵侧礁影。头两日，三拨蟊贼刚摸到阵前就被你从死角放翻，捆成粽子丢去下风口。第三日来的，闻见了同伴的血腥味。", kind: "good" };
        },
        resolve: "whfy_hufa_fight",
      },
    ],
  },

  // —— 幕三③·第三日·温天仁到场（前篇因果兑现+紫灵道岔→六魔战转正）——
  {
    id: "whfy_a3_wentianren",
    skipIf: (s) => s.flags.whfy_wtr_done,
    cond: (s) => s.flags.whfy_hufa_won && !s.flags.whfy_wtr_done,
    bgm: "boss",
    title: "阴冥之地边缘 · 六道传人",
    objTitle: "决战 · 元婴之下第一人",
    objHint: "第三日黄昏，一驾华贵妖辇压海而来——温天仁。辇中还锁着一个你认得的人：紫灵。元婴之下第一人之争，避无可避。",
    text: [
      { scene: "阴冥之地边缘 · 礁原" },
      { amb: null },
      { sfx: "thunderFar" },
      { shot: "shock", scale: 1.12, px: 8 },
      { fx: "flash", color: "#b98fe0", alpha: 0.2, ms: 460 },
      "第三日黄昏，海平线上压来一驾九首妖辇，紫金华盖遮天——来人麻衣早换作紫袍鎏金，眉宇金芒灼灼。",
      { shot: "focusLeft" },
      { say: "温天仁", tone: "倨傲", text: "「还阳术？有点意思。……咦，你这气息——」" },
      { shot: "pushIn", ms: 1200, scale: 1.15 },
      "辇帘掀起一角，一张你认得的脸撞进眼里：紫灵。腕上一圈紫金禁环，眸中半是惊喜半是急切，朝你无声地摇头——让你走。",
      { wait: 600 },
      { aside: "虚天殿出口那一面，终究躲不过去。他身后是六道极圣、整个逆星盟；你身后，是还差最后一夜的还阳阵、和辇中那个朝你摇头的人。" },
    ],
    onArrive(s) {
      State.setFlag("whfy_wtr_done");
      // 前篇因果兑现：虚天殿出口的应对方式，决定这一战怎么开场
      if (s.flags.xh_wentianren_force) {
        Engine.log("温天仁眯起眼，认出了你——「虚天殿外强闯的那道剑光！好，好得很，本座记你三年了。」（旧怨开局：他起手便是杀招）", "bad");
        Engine.settleLedger("xh_wentianren_react", "虚天殿出口强行突围结下的梁子，三年后在阴冥之地边缘兑了现——他记了你三年，起手便不留余地");
      } else if (s.flags.xh_wentianren_fake) {
        Engine.log("温天仁盯着你看了三息，忽而嗤笑出声——「青易居士门下？本座后来查过，青易那老儿根本没有你这号弟子。敢骗本座……胆子不小。」（伪装被识破：他带着三分玩味、七分杀意）", "event");
        Engine.settleLedger("xh_wentianren_react", "虚天殿出口冒充青易弟子的那一晃，终究被他查穿——三年后阴冥之地边缘对上，玩味与杀意各半");
      }
      Engine.writeLedger("whfy_wtr_open", "阴冥之地边缘·温天仁携妖辇到场（紫灵被紫金禁环锁于辇中）——元婴之下第一人之争，避无可避。");
      // —— 铁律3·护法段收口 ——
      Engine.settleLedger("whfy_hufa_promise", "三日之诺践到第三日黄昏——前两日你替她挡下的每一拨人，都是为这最后一夜攒的底");
      Engine.settleLedger("whfy_hufa_plan", "三日定策此刻见了真章——小鱼小虾照单全收之后，真正的大鱼压海而来");
      Engine.settleLedger("whfy_hufa_won", "碧云门老怪败走的消息还没传开，更硬的茬已经到了——可还阳阵的蓝焰，已经烧到了最后一夜：她只差一夜，你就给她争一夜");
    },
    choices: [
      {
        text: "应战 · 并分出一缕神识断辇中禁制",
        hint: "战中救紫灵（分神·战斗稍险）",
        effect(s) {
          State.setFlag("whfy_saved_ziling");
          Engine.writeLedger("whfy_saved_ziling", "决战之际分出一缕神识入辇、暗蚀紫灵腕上禁环——混战中她挣脱妖辇。战斗因分神而更险，但有些人不能不救。");
          return { text: "你踏前一步应战，神识却悄然分出一缕缠上那圈紫金禁环——蚀、松、断。战端一起，辇中人便有了脱身之机。", kind: "good" };
        },
        resolve: "whfy_wtr_fight",
      },
      {
        text: "应战 · 全力以赴不留余力",
        hint: "专注对敌（战斗更稳）",
        effect(s) {
          Engine.writeLedger("whfy_wtr_focus", "决战·全力以赴——紫灵之事战后再说，眼前这个人，值得拿出十成十的力气。");
          return { text: "你缓缓拔剑，把所有杂念压进剑鞘——元婴之下第一人之争，一分心神都不能省。", kind: "event" };
        },
        resolve: "whfy_wtr_fight",
      },
    ],
  },

  // —— 幕三④·鬼雾骤至（灵力尽失·五人陷落）——
  //   canon 复核 #19（2026-07-11·推翻旧决议修②④）：三源一致=鬼雾吞五人含元瑶、还阳术只成一半
  //   （元瑶碎丹、妍丽半人半鬼）——旧拍板"元瑶先走/术固定成功"所引"动漫锚"与动漫实情相反，按正典改
  {
    id: "whfy_a3_guiwu",
    skipIf: (s) => s.flags.whfy_guiwu_done,
    cond: (s) => s.flags.whfy_wtr_fought && !s.flags.whfy_guiwu_done,
    cg: "guiwu",
    bgm: "tense",
    title: "阴冥之地 · 鬼雾",
    objTitle: "骤变 · 灵力尽失",
    objHint: "胜负将分之际，天地骤暗——铺天盖地的灰白鬼雾自海底翻涌而上，吞没了战场上的所有人。",
    text: [
      { scene: "阴冥之地边缘 · 礁原" },
      { amb: null },
      { wait: 600 },
      "胜负将分之际，海面骤然死寂。",
      { shot: "shock", scale: 1.14, px: 9 },
      { fx: "ambient", preset: "moqi" },
      { fx: "flash", color: "#8a9490", alpha: 0.3, ms: 500 },
      { sfx: "danger" },
      "下一瞬，铺天盖地的灰白浓雾自海底翻涌而上——所过之处，灵光尽灭。",
      { say: "温天仁", tone: "骇然", text: "「鬼雾？！——不好，快退！！」" },
      "迟了。雾墙合拢的刹那，还阳阵的蓝焰堪堪烧至最后一重——元瑶嘶喊着扑向阵心、死死抱住那具只凝了一半的躯壳。你、温天仁、刚脱身的紫灵、一个仓皇的路人女修、还有抱着半成之躯的元瑶——五个人，尽数被雾浪卷了进去。",
      { fx: "flash", color: "#9fb8a8", ms: 300 },
      { shot: "pushIn", ms: 1600, scale: 1.16 },
      { wait: 700 },
      { aside: "坠落。无边的灰白里，你听见自己的心跳越来越响——因为丹田里那枚金丹，那枚温养了几十年、堪比性命的金丹……没有声音了。灵力，一丝都提不起来。" },
      { say: "韩立", emo: "pain", tone: "low", text: "「绝灵之地……我们，都成凡人了。」" },
    ],
    onArrive(s) {
      State.setFlag("whfy_guiwu_done");
      State.setFlag("whfy_yinming_in");
      Engine.writeLedger("whfy_guiwu", "鬼雾骤至吞五人（韩立/温天仁/紫灵/梅凝/元瑶）坠入阴冥之地——绝灵秘境，众皆法力尽失退回凡人。元瑶的还阳术只完成一半：施术已碎金丹，怀中妍丽的新躯半人半鬼。");
      Engine.addMilestone("外海风云·鬼雾陷落：阴冥之地（绝灵·凡人小篇章开幕）", "story");
      // —— 铁律3·决战段收口 ——
      Engine.settleLedger("whfy_wtr_open", "妖辇压海那一幕成了这场大战的开场，也成了它的绝响——辇碎于鬼雾，人坠入绝地，恩怨全被雾墙卷着往下带");
      Engine.settleLedger("whfy_wtr_focus", "十成十的专注换来将分的胜负——可老天在最后一线掀了棋盘。这口气，阴冥之地里找他算");
    },
    choices: [
      { text: "落地 · 先活下来", hint: "阴冥之地·凡人玩法开幕", resolve: "advance" },
    ],
  },

  /* ============================================================
   *  外海风云 · 幕四 · 阴冥之地（S4·动漫140~144·绝灵凡人小篇章）
   *  ⚠ 凡人终结战演出逐拍=用户口述钩子（决议#3）——本切片为机制骨架
   * ============================================================ */

  // —— 幕四①·阴冥村（绝灵规则+村中暗涌）——
  //   canon 复核 #21/#22/#24（2026-07-11 黑暗反转归位）：阴冥村=靠"吃人规则"运转的黑暗村庄
  //   （大长老以外来者尸体喂阴兽产兽晶维持阵法）；此地=上古真灵罗睺腹中；出口=罗睺裂缝（非"三十年风眼"）
  {
    id: "whfy_a4_cun",
    skipIf: (s) => s.flags.whfy_cun_done,
    cond: (s) => s.flags.whfy_guiwu_done && !s.flags.whfy_cun_done,
    bgm: "tense",
    title: "阴冥之地 · 阴冥村",
    objTitle: "绝灵 · 凡人度日",
    objHint: "灰白天穹下没有日月。你们寻到一座凡人聚落「阴冥村」——村民世代困居此地。大长老殷勤留客，可这村子安静得……不对。",
    text: [
      { scene: "阴冥之地 · 阴冥村" },
      { amb: "wind" },
      { shot: "establish" },
      "灰白的天穹不见日月，荒原尽头蜷着一座石屋聚落——阴冥村。村民面色灰败，见到活人进来，眼神里先是惊、后是一种说不出的……怜悯。",
      "村中大长老周姓，拄杖出迎、殷勤得过分：「又是被鬼雾卷进来的仙师……到了这儿，仙凡都一样喽。快请进村歇脚——出去的路是有的：暴风山山顶，天上那位『大人』呼吸吐纳间会裂开一道缝，赶上了，就出去了。」",
      { wait: 500 },
      { aside: "元瑶谢绝了同行——还阳术只成一半，妍丽的新躯半人半鬼、阴气反是养料，她要携着师姐寻一处僻静阴穴稳魂。临别她只留了一句：这村子的灯，是用什么点亮的，问清楚再住。" },
      { shot: "pushIn", ms: 1300 },
      { aside: "灵力提不起、法宝催不动、神识出不了三尺——储物镯还打得开，可里面的每一件宝贝都成了『铁疙瘩』。眨眼剑法、喂毒、暗器……七玄门那些年的老本行，从来没有这么亲切过。而这村子：栅栏上镶着幽幽发亮的灰白晶石，村民看你们的眼神躲躲闪闪——像在看客人，也像在看……祭品。" },
      { wait: 600 },
      { say: "韩立", emo: "calm", tone: "low", text: "「凡人就凡人。当年在七玄门，我本来就是个凡人。——不过这村子，夜里得留一只眼。」" },
    ],
    onArrive(s) {
      s.location = "waihai_dongfu";   // 地点轴暂驻（阴冥走格图=whfy_a4_shanlu 后的 yinming_l1）
      State.setFlag("whfy_cun_done");
      State.give("duyao_cao", 4); State.give("anqi", 4); State.give("huixue_dan", 2);   // 金疮药物品 id=huixue_dan（jinchuang_yao 是技能名）
      Engine.log("大长老命村民奉上粗盐草药，殷勤得反常。一个疤脸汉子（村人唤他封天极）冷冷扫了你们一眼，什么也没说。", "event");
      Engine.writeLedger("whfy_cun", "阴冥村落脚——大长老殷勤留客、指路暴风山（罗睺裂缝）。可元瑶留了句提醒：这村子的灯用什么点亮的，问清楚再住。栅栏上的灰白晶石、村民躲闪的眼神——夜里得留一只眼。");
    },
    choices: [
      { text: "在村中休整 · 夜里留一只眼", hint: "凡人的路，一步步走——警觉些", resolve: "advance" },
    ],
  },

  // —— 幕四②·阴冥村生死战（绝灵凡人战斗首演·canon 黑暗反转：祭品之夜）——
  //   正典（141~143）：大长老以外来者喂阴兽产兽晶维持阵法——韩立梅凝被选作祭品；
  //   封天极带部分村民反水相救；韩立抓兽晶变身的间隙劈杀大长老
  {
    id: "whfy_a4_cunzhan",
    skipIf: (s) => s.flags.whfy_cunzhan_done,
    cond: (s) => s.flags.whfy_cun_done && !s.flags.whfy_cunzhan_done,
    bgm: "combat",
    title: "阴冥村 · 祭品之夜",
    objTitle: "生死战 · 人心即绝地",
    objHint: "入夜，殷勤的面孔全变了——大长老要拿你们喂阴兽换兽晶，「客人」原来是「祭品」。没有法术、没有法宝：一口剑、一把毒、一袋暗器。",
    text: [
      { scene: "阴冥村 · 祭坑" },
      { amb: "night" },
      "入夜，你留的那只眼派上了用场——石屋外火把围拢，人影幢幢。",
      { amb: null },
      { shot: "shock", scale: 1.1, px: 7 },
      { sfx: "danger" },
      "大长老立在火光中央，殷勤的笑一寸寸敛去，枯手里攥着一枚幽幽发亮的灰白晶石：「仙师莫怪。村里的阵法要兽晶，兽晶要拿活人喂阴兽换——祖祖辈辈，都是这么活下来的。外来的人，就是村里的『粮』。」",
      { wait: 500 },
      "他把兽晶按进胸口——枯瘦的身躯轰然膨胀，筋肉虬结、双目泛起兽性的灰光！人群里忽有一声暴喝，疤脸汉子封天极提着柴刀横身挡在你们身前：「够了！拿活人喂兽，咱们和阴兽有什么分别！——仙师，这村子疯了，我帮你！」",
      { shot: "focusRight" },
      { say: "韩立", emo: "serious", tone: "low", text: "「眨眼剑法——二十年没用它保过命了。手，还热着。……人心，果然比绝地更黑。」" },
    ],
    onArrive(s) { State.setFlag("whfy_cunzhan_done"); },
    choices: [
      { text: "拔剑 · 凡人之躯迎战兽晶邪身", hint: "绝灵战斗·武学/毒/暗器是全部本钱（封天极助战）", resolve: "whfy_cunzhan_fight" },
    ],
  },

  // —— 幕四③·梅凝（同陷之人·危机结缘）——
  //   canon 复核 #23：梅凝=宗门筑基女修（非剑修）·与兄长同来被卷入·身怀通玉凤髓之体（重返天南钩）
  {
    id: "whfy_a4_meining",
    skipIf: (s) => s.flags.whfy_meining_done,
    cond: (s) => s.flags.whfy_cunzhan_won && !s.flags.whfy_meining_done,
    bgm: "sorrow",
    title: "阴冥村 · 同是天涯",
    objTitle: "同陷 · 梅凝",
    objHint: "祭品之夜，同陷的女修梅凝为替你挡开背后村勇的一记闷棍，肩头挨了实实一刀。绝灵之地，修士的骄傲一文不值，人心却看得真真切切。",
    text: [
      { scene: "阴冥村 · 石屋" },
      { amb: "candle" },
      { shot: "establish" },
      "同坠鬼雾的女修唤作梅凝——祭品之夜的乱战里，她抄起半截门闩替你挡开了背后袭来的一记闷棍，自己肩头却挨了实实一刀。",
      { shot: "focusLeft" },
      { say: "梅凝", tone: "soft", text: "「别谢我。……我兄长与我一同坠进这鬼地方，走散了。方才那一下，是替他积德——盼着有人也这样帮他一把。你那剑法，不是修士的剑，是杀出来的剑。跟着你，我兄妹兴许都能活。」" },
      { say: "韩立", emo: "calm", tone: "low", text: "「修仙之前，我在江湖门派烧了七年火。剑，是那时候学的。——令兄的下落，路上帮你留意。」" },
      { shot: "pullOut", ms: 1300 },
      { aside: "包扎时你留意到一桩异处：她伤口周围隐有温润玉光流转，愈合快得不像凡躯——她自己似乎浑然不觉。绝灵之地像一面镜子，照掉境界、照掉法宝，也照出些平日藏得极深的东西。同路去暴风山的，又多了一个。" },
    ],
    onArrive(s) {
      State.setFlag("whfy_meining_done");
      Engine.meetNpc("mei_ning", "同陷阴冥之地的宗门女修——祭品之夜舍身相护。与兄长一同坠入阴冥后走散；其体质隐有异处（玉光愈伤）。共赴暴风山的同路人。");
      Engine.writeLedger("whfy_meining", "阴冥村结识梅凝（同陷宗门女修·祭品之夜舍身相护）——其兄长同坠阴冥后走散；她伤处隐现玉光、愈合奇速（通玉凤髓之体？远线只种不收）。与紫灵三人结伴，同赴暴风山。");
    },
    choices: [
      {
        text: "把金疮药分她一半 · 「路还长」",
        hint: "同路人——雪中送炭",
        effect(s) {
          s.mood = Math.min(s.moodMax, (s.mood || 0) + 4);
          State.setFlag("whfy_meining_helped");
          Engine.writeLedger("whfy_meining_helped", "把仅有的金疮药分了梅凝一半——绝灵之地，一贴药比一件法宝重。她收下了，也把背转向你时不再设防。");
          return { text: "你把金疮药分了一半过去。梅凝一怔，没推辞——绝灵之地，谁都知道这一贴药的分量。她低声道了句谢，从那天起，她守夜时的背，肯朝你这边转了。", kind: "good" };
        },
        resolve: "advance",
      },
      {
        text: "只指点她两手贴身短打",
        hint: "授艺不授药——各留余地",
        effect(s) {
          Engine.writeLedger("whfy_meining_helped", "指点梅凝两手贴身短打——宗门弟子的章法在绝灵之地不好使，江湖的野路子好使。药各自省着用，艺不藏私。");
          return { text: "你没动药囊，只在她能下地后拆了两手贴身短打给她看——肘、膝、撤步、锁喉。宗门的章法讲究体面，江湖的路数只讲活命。她学得很快。", kind: "event" };
        },
        resolve: "advance",
      },
    ],
  },

  // —— 幕四③½·暴风山道（阴冥独立走格图·返修池点名项落地）——
  //   封天极指的路自己走：灰白荒原→哨塔望山→端阴兽母巢→古战场拾遗→风口栈道。
  //   fog 走格复用后山迷雾管线（exploremap yinming_l1）；绝灵规则=不回灵、母巢战走凡人战力。
  //   出图（风口栈道）即接 whfy_a4_baofeng 温天仁狭路。
  {
    id: "whfy_a4_shanlu",
    skipIf: (s) => s.flags.whfy_shanlu_done,
    cond: (s) => s.flags.whfy_meining_done && !s.flags.whfy_shanlu_done,
    bgm: "journey",
    title: "阴冥之地 · 上山之路",
    objTitle: "启程 · 暴风山",
    objHint: "封天极说，天上那位「大人」的呼吸快到了——罗睺裂缝将现，时机稍纵即逝。辞别阴冥村，带上紫灵与梅凝，凡人的腿，一步步把暴风山量上去。",
    text: [
      { scene: "阴冥村 · 村口" },
      { amb: "wind" },
      { shot: "establish" },
      "封天极把三人送到村口，拿猎叉朝灰白的天际点了点：「顺荒原向北，过磷火沼别踩绿光，见着半塌的哨塔就登上去望一眼——路就都看清了。老辈人传：这方天地是上古真灵『罗睺』的腹中，山顶那道缝，是它呼吸时裂开的——快了，赶不上就得再等不知多少年。」",
      { shot: "pushIn", ms: 1200 },
      { say: "封天极", tone: "soft", text: "「荒原上那窝阴兽的母巢，绕是绕得开的……可大长老拿人喂了它们几十年，兽群早吃惯了人味。你们要是顺手端了它，村里往后的夜，才算真的干净。」" },
      { wait: 400 },
      { aside: "没有遁光、没有神识、没有储物袋里的千百张符——去暴风山的每一里路，都要用脚量。这一段路怎么走、走多稳、顺手管不管别人的闲事，都是你的事。" },
    ],
    onArrive(s) {
      State.setFlag("whfy_shanlu_done");
      Engine.writeLedger("whfy_shanlu", "辞别阴冥村启程暴风山（罗睺裂缝将现·时机稍纵即逝）——封天极指路（哨塔可望全局），并托付顺手之请：端掉吃惯了人味的阴兽母巢，村里的夜才算真干净。");
    },
    choices: [
      { text: "整装 · 踏上灰白荒原", hint: "阴冥走格图：望路/采药/拾遗/端巢，行止由你——终点风口栈道", resolve: "yinming_map" },
    ],
  },

  // —— 幕四④·暴风山·狭路（终结战前夜）——
  {
    id: "whfy_a4_baofeng",
    skipIf: (s) => s.flags.whfy_baofeng_done,
    cond: (s) => s.flags.whfy_shanlu_done && !s.flags.whfy_baofeng_done,
    bgm: "tense",
    title: "暴风山 · 狭路",
    objTitle: "攀登 · 冤家路窄",
    objHint: "三十年一开的风眼将至，暴风山半腰——你们与另一支攀山的队伍狭路相逢：温天仁，和被他重新扣住的紫灵。",
    text: [
      { scene: "暴风山 · 半腰栈道" },
      { amb: "wind" },
      { shot: "establish" },
      "暴风山黑岩如刃，罡风割面。攀至半腰，前方栈道转角处，一行人影迎面而来——为首者紫袍褴褛、发冠歪斜，可那双眼睛里的倨傲一分未减。",
      { shot: "shock", scale: 1.1, px: 6 },
      { sfx: "danger" },
      { shot: "focusLeft" },
      { say: "温天仁", tone: "冷笑", text: "「真是……冤家路窄。韩、老、魔。」" },
      { shot: "pushIn", ms: 1200 },
      "他身后，紫灵的手腕又被一根粗麻绳缚住——法力尽失的地方，他用的是最凡人的办法。",
      { wait: 600 },
      { aside: "风眼只容一线先后。他杀意已决：在这个没有六极真魔功、没有八门金光镜的地方，用拳头、用刀，把所有旧账一并清了。" },
      { shot: "focusLeft" },
      { say: "温天仁", tone: "森然", text: "「没了法力，本座倒要看看——你这条从虚天殿溜出去的泥鳅，骨头有多硬！」" },
    ],
    onArrive(s) {
      State.setFlag("whfy_baofeng_done");
      Engine.writeLedger("whfy_baofeng", "暴风山半腰与温天仁狭路相逢（紫灵被麻绳缚于其后）——绝灵之地凡人相搏，避无可避。全篇最高之战，以最『凡人』的方式收束。");
      // —— 铁律3·入山前收口 ——
      Engine.settleLedger("whfy_wtr_battle", (s.flags.whfy_wtr_result === "upper"
        ? "边缘那一战你占了上风——他记得。此刻他眼底的狠，一半是杀意，一半是雪耻"
        : "边缘那一战他占了上风——他记得。此刻他眼底的轻蔑，比暴风山的罡风更刺骨"));
      Engine.settleLedger("whfy_saved_ziling", "你战中蚀断的那圈紫金禁环救过她一次——所以这次他改用了麻绳，捆得更狠。紫灵看你的眼神里没有求救，只有『别管我，赢他』");
      Engine.settleLedger("whfy_cun", "阴冥村的毒草暗器金疮药，此刻全在腰间——凡人的家当，打凡人的仗");
      Engine.settleLedger("whfy_cunzhan_won", "祭品之夜那一战把你的手彻底打热了——诛兽晶邪身用的眨眼剑法，找回了当年在七玄门喂招的手感。正好，用在他身上");
    },
    choices: [
      { text: "解剑鞘 · 「来。」", hint: "凡人终结战（正典：韩立杀之）", resolve: "whfy_mortal_fight" },
    ],
  },

  /* ============================================================
   *  外海风云 · 幕五/收口（S5·动漫145~152）
   * ============================================================ */

  // —— 收口①·脱困·见天南（乡愁名场面）——
  {
    id: "whfy_a5_tuokun",
    skipIf: (s) => s.flags.whfy_tuokun_done,
    cond: (s) => s.flags.whfy_mortal_won && !s.flags.whfy_tuokun_done,
    cg: "tiannan_gui",
    bgm: "sorrow",
    title: "暴风山顶 · 罗睺裂缝",
    objTitle: "脱困 · 故土",
    objHint: "罗睺之息到了——山顶裂开那道缝。你带着紫灵与梅凝跃入撕裂天穹的白光——坠出雾墙的刹那，脚下的山河让你怔在原地。",
    text: [
      { scene: "暴风山顶 · 罗睺裂缝" },
      { amb: "wind" },
      { shot: "establish" },
      "山顶罡风如瀑，天穹裂开一线刺目的白——封天极说的罗睺之息，就是此刻。这道缝几时再开，没人说得准：赶不上的人，骨头都留在了这面山坡上。",
      { fx: "flash", color: "#ffffff", alpha: 0.55, ms: 600 },
      { fx: "burst", at: "center", elem: "jin", n: 14, ms: 420 },
      { sfx: "bell" },
      "你拽住紫灵与梅凝，纵身跃入白光。天旋地转、五感尽灭——再睁眼时，丹田里的金丹「嗡」的一声苏醒，灵力如潮水灌回四肢百骸。",
      { amb: null },
      { shot: "pushIn", ms: 1400, scale: 1.12 },
      "而脚下……青山如黛，梯田如镜，一条官道蜿蜒入谷，道旁酒旗上一个褪色的「胥」字。",
      { wait: 700 },
      { say: "韩立", emo: "calm", tone: "low", text: "「这是——天南。……我回来了。」" },
      { shot: "pullOut", ms: 1800 },
      { wait: 500 },
      { aside: "离乡渡海，星海沉浮几十年。鬼雾把你吞进九死一生的绝地，又把你吐回了故土的天空下。青牛镇的方向，你望了很久很久。" },
    ],
    onArrive(s) {
      State.setFlag("whfy_tuokun_done");
      Engine.addMilestone("外海风云·脱阴冥：重返天南故土", "story");
      Engine.writeLedger("whfy_tuokun", "暴风山顶罗睺裂缝脱困——携紫灵/梅凝坠出雾墙，灵力尽复。落点竟是天南故土：离乡渡海数十年，鬼雾把人吐回了起点的天空下。");
      // —— 铁律3·阴冥段收口 ——
      Engine.settleLedger("whfy_meining", "同坠鬼雾的路人，最终成了同出生天的同路人——梅凝在裂缝白光里抓住你手腕的力道，比任何道谢都重");
      Engine.settleLedger("whfy_meining_helped", "阴冥村里分出去的那点东西，在暴风山换回了一个把后背交给你的人");
      Engine.settleLedger("whfy_baofeng", "狭路的那场对峙，以他伏尸栈道作结——暴风山替全乱星海记下了这一笔：元婴之下第一人，死于凡人之剑");
      // canon #19 收口：元瑶留阴冥（转鬼修·远线伏笔）——她没有来暴风山
      Engine.writeLedger("whfy_yuanyao_stay", "元瑶携半复活的妍丽留在了阴冥之地——金丹已碎，二人改修魂术、转投鬼修一途：『以后不能再入轮回，但起码可以活下去。』临别她朝暴风山的方向遥遥一礼（远线·日后重逢）。");
      const tYY = `第${s.year}年${s.month}月`;
      s.worldNews = s.worldNews || [];
      s.worldNews.push({ t: tYY, kind: "rumor", text: "你时常想起阴冥之地里那对姐妹——元瑶与半人半鬼的妍丽。绝地断了她们的仙途，却断不了活下去的路。" });
      if (s.worldNews.length > 40) s.worldNews.splice(0, s.worldNews.length - 40);
    },
    choices: [
      { text: "落下云头 · 先寻一处落脚", hint: "故土·蛰伏", resolve: "advance" },
    ],
  },

  // —— 收口②·银月化形（侧位同道兑现·用户拍板）——
  //   canon 复核 #27（2026-07-11）：器灵化形必须夺舍肉身（正典=夺舍雪云狐救主·灵魂吞噬天赋）——
  //   "自剑光凭空凝形"旧稿推翻；时点保留本章末（正典雪云狐段在落云宗·此处妖狐因地制宜）
  {
    id: "whfy_a5_yinyue",
    skipIf: (s) => s.flags.whfy_yinyue_done,
    cond: (s) => s.flags.whfy_tuokun_done && !s.flags.whfy_yinyue_done,
    cg: "yinyue_hua",
    bgm: "tense",
    title: "天南 · 银月化形",
    objTitle: "器灵 · 夺舍化形",
    objHint: "天南山中觅洞府，你循灵气追猎一头通体雪白的妖狐——却撞上假扮村妇的凶灵设局。危急之际，狼首玉如意里沉睡经年的那缕灵识，醒了。",
    text: [
      { scene: "天南 · 深山雪林" },
      { amb: "wind" },
      { shot: "establish" },
      "觅洞府途中，你循一缕清冽灵气追猎一头通体雪白的妖狐——雪云狐，天南罕见的灵狐。追至深谷，一名素衣村妇拦路求助，言辞恳切。",
      { shot: "shock", scale: 1.1, px: 7 },
      { sfx: "danger" },
      "你抬手施礼的刹那，「村妇」面皮寸寸龟裂——一头积年凶灵藏在人皮之下，阴风裹着腐气当头罩落！鬼雾绝地里耗空的神识尚未养满，这一下，竟被它抢了先手。",
      { wait: 400 },
      { fx: "flash", color: "#cdd8ee", ms: 300 },
      { sfx: "swordWhoosh" },
      "千钧一发——你袖中狼首玉如意银芒暴涨，一道银光激射而出，不偏不倚没入那头仓皇窜过的雪云狐体内！雪狐周身银辉大盛、身形拔节而起——凶灵的阴风扑到半途，被一只素白的手轻轻按碎。",
      { fx: "ambient", preset: "spirit" },
      { sfx: "bell" },
      { shot: "pushIn", ms: 1300, scale: 1.14 },
      "银发银眸的少女立在雪地里，指尖拈着凶灵残魂，仰头一口吞了。她回身朝你恭恭敬敬一福：",
      { say: "银月", tone: "soft", text: "「器灵银月，拜见主人。睡了好久好久……借这具狐身，总算能替主人做点事了。主人的剑养得真好，银月在梦里都闻得到雷的味道——往后，让银月住进剑里可好？」" },
      { shot: "pullOut", ms: 1400 },
      { aside: "狼首玉如意里沉睡的那缕银月狼族灵识，以灵魂吞噬的天赋夺舍雪云狐、得了肉身，又吞了凶灵残魂稳固形体——随后一场移灵小仪式，她主动认主、移灵入青竹蜂云剑为器灵。往后的路上，剑里住着一个会说话的伙伴——她能替你御剑、掌灯、看家，也能并肩而战。" },
    ],
    onArrive(s) {
      State.setFlag("whfy_yinyue_done");
      State.setFlag("yinyue_awake");
      // 银月·器灵侧位（用户拍板=侧位同道）：随行出战（sideUnitFor 直读 s.sideUnit）
      s.sideUnit = {
        id: "yinyue", name: "银月", kind: "ally", art: "yinyue",
        hp: 130, hpMax: 130, guard: 0.25, elem: "shui", mp: 90, mpMax: 90,
        canFly: true, airGrade: 2, status: "ok", carry: true, mastery: 1,
        persona: { aggr: 5, prot: 5, kite: 5 },
        moves: [
          { name: "银辉剑雨", dmg: 20, weight: 10, elem: "shui", range: [1, 3], mp: 5, line: "银芒漫卷，剑雨倾向" },
          { name: "月华护幕", dmg: 10, weight: 5, elem: "shui", range: [1, 1], mp: 3, line: "银幕横展，月华挡下" },
          { name: "器灵共鸣", dmg: 28, weight: 4, elem: "jin", range: [1, 2], mp: 9, line: "与本命剑共鸣，雷芒并剪斩向" },
        ],
      };
      Engine.meetNpc("yinyue", "狼首玉如意沉睡的银月狼族灵识——夺舍雪云狐化形救主、吞凶灵残魂固形，主动认主、移灵入青竹蜂云剑为器灵。御剑、看家、并肩而战的『小秘书』。");
      Engine.addMilestone("外海风云·银月夺舍化形（器灵伙伴·侧位随行）", "bigitem");
      Engine.writeLedger("whfy_yinyue", "狼首玉如意器灵银月夺舍雪云狐化形——危局救主、吞凶灵残魂，认主移灵入青竹蜂云剑。自此侧位随行出战（御剑/护幕/器灵共鸣）。");
      Engine.toast("侧位随行：银月（器灵）");
    },
    choices: [
      { text: "「醒了就好。往后——一起走。」", hint: "器灵伙伴·随行出战", resolve: "advance" },
    ],
  },

  // —— 收口③·恶名清算（澄清 vs 将错就错——返修池点名项·喂重返天南钩）——
  //   幕一的恶名阳谋是别人替你开的局；篇末这一手，是你自己收的口。两个方向都不是「结清」，
  //   而是把「韩老魔」这三个字定成什么用途——真名入局或凶名作盾，都在重返天南篇兑现。
  {
    id: "whfy_a5_eming",
    skipIf: (s) => s.flags.whfy_eming_done,
    cond: (s) => s.flags.whfy_yinyue_done && !s.flags.whfy_eming_done,
    bgm: "tense",
    title: "天南 · 恶名清算",
    objTitle: "「韩老魔」· 定名",
    objHint: "乱星海的风声跟着商船渡海而来——「韩老魔」三个字在天南坊市悄悄流传。极阴岛替你造的这顶帽子，如今戴不戴、怎么戴，头一回轮到你自己说了算。",
    text: [
      { scene: "天南 · 无名山洞府" },
      { amb: "night" },
      { shot: "establish" },
      "银月夜巡归来，剑光里带回几张坊市抄来的传单：乱星海的风声渡海了。「韩老魔」连屠洞府、力挫云天啸、火烧裂风岛、阴冥绝地搏杀六道传人——真账假账混作一团，在天南的酒肆里越传越邪。",
      { say: "银月", tone: "soft", text: "「主人，他们把您传成了三头六臂的老魔头。……可裂风岛背着翅膀救人的也是您呀。这名声，要不要银月去剑削了那些说书人的桌子？」" },
      { shot: "pushIn", ms: 1200 },
      { aside: "极阴岛与万法门替你造了这顶帽子，本意是借满海仇家逼你现形。可如今仇家隔着一片汪洋，帽子却跟到了故土——是摘，是戴，头一回轮到你自己定。" },
    ],
    onArrive(s) {
      State.setFlag("whfy_eming_done");
      Engine.settleLedger("whfy_a1_open", "极阴岛替你造的「韩老魔」，一路从孤崖跟到了天南故土——这顶帽子如今怎么处置，终于轮到你亲手来定。恶名阳谋的局，收口在你");
    },
    choices: [
      {
        text: "澄清 · 借活口与善账正名",
        hint: "青灵门/文家/裂风岛生还者之口——真名入局",
        effect(s) {
          State.setFlag("whfy_eming_clear");
          Engine.addFame(10, "青灵门与文家商队的口信随海船播散：裂风岛救数十人族修士出火海的，正是被泼作『韩老魔』的韩立");
          Engine.writeLedger("whfy_eming_clear", "恶名清算·澄清——托青灵门/文家把裂风岛救人、坊市立威的真账放出去，血案传单不攻自破。真名立起，日后天南试剑大会自有人持帖来请（重返天南再算）");
          Engine.recordTemperament("whfy_eming", "sentiment", "恶名清算·选澄清——名声是别人泼的，账却要自己一笔笔洗清。行得正，不借鬼名吓人");
          return { text: "你修书两封，托海船带回乱星海——青灵门与文家欠你的人情，正好用在嘴上。数月之后，天南坊市的说书人换了新段子：「韩老魔？人家救的人排到码头外——那是给魔头泼的脏水！」真名立起来了。往后在天南入局，你行不更名。", kind: "good" };
        },
        resolve: "advance",
      },
      {
        text: "将错就错 · 让凶名做挡箭牌",
        hint: "戴着帽子走——魔道自会来认「同道」",
        effect(s) {
          State.setFlag("whfy_eming_keep");
          s.demon = Math.min(100, (s.demon || 0) + 3);
          Engine.writeLedger("whfy_eming_keep", "恶名清算·将错就错——不辩不洗，任「韩老魔」凶名在天南发酵：宵小闻名绕道，魔道六宗的探子却把这名字记进了名册。日后自有魔道持「同道」之礼登门（重返天南再算）");
          Engine.recordTemperament("whfy_eming", "stoic", "恶名清算·选将错就错——名声是刀，握柄的是自己。让怕这名字的人替你省事，让认这名字的人替你带路");
          return { text: "你把传单丢进炉火：「让它传。」凶名是别人铸的刀，如今刀柄在你手里——宵小闻「韩老魔」三字绕道而行，蛰伏清净了不少；只是银月夜巡时留意到，魔道六宗的探子已把这名字工工整整记进了名册。这份「同道」的误会，日后有的是用处。（心魔+3）", kind: "event" };
        },
        resolve: "advance",
      },
    ],
  },

  // —— 收口④·章末钩（卷入天南之争→重返天南篇）——
  {
    id: "whfy_a5_close",
    skipIf: (s) => s.flags.arc7_complete,
    cond: (s) => s.flags.whfy_eming_done && !s.flags.arc7_complete,
    bgm: "journey",
    title: "外海风云 · 终 · 故土暗流",
    objTitle: "章末 · 天南棋局",
    objHint: "蛰伏之地初定，你本想寻处灵山静修、冲击元婴——可银月夜巡带回的消息，让你眉头再度皱起：这片阔别数十年的故土，正在酝酿一场大乱。",
    text: [
      { scene: "天南 · 无名山洞府" },
      { amb: "night" },
      { shot: "establish" },
      "洞府初定不过数月，银月夜巡带回一串消息：云梦山三派放出「试剑大会」的风声、魔道六宗的探子在各州游走、落云宗在广收结丹客卿——故土的水面下，暗流已经涨到了喉咙口。",
      { shot: "pushIn", ms: 1300 },
      { say: "韩立", emo: "serious", tone: "low", text: "「树欲静而风不止。……也罢。要在天南冲击元婴，总归绕不开这盘棋。」" },
      { shot: "pullOut", ms: 1500 },
      {
        guide: {
          tag: "外海风云篇 · 终　——　凡人归乡·风云再起",
          title: "章末钩 · 下一篇：重返天南篇",
          hint: "风雷翅、银月、结丹大圆满、凡人之躯杀温天仁的胆气——一身行装已齐。远处的钩子：试剑大会、灵眼之树、落云宗、破婴之机、慕沛灵……这一切，都留待《重返天南篇》。",
          cta: "（蛰伏天南·静待风起——外海风云篇 终）",
        },
      },
    ],
    onArrive(s) {
      State.setFlag("arc7_complete");
      if (typeof Chapters !== "undefined") {
        const next = Chapters.active().nextChapter;
        if (next) Chapters.unlock(next);
      }
      Engine.writeLedger("whfy_arc7_complete", "外海风云篇·终——恶名阳谋/智夺风雷翅/还阳术之诺/六魔大战/阴冥凡人终结战/银月化形，一篇走完。韩立携紫灵梅凝重返天南故土蛰伏，试剑大会与破婴之机在前。下一篇章重返天南。");
      Engine.addMilestone("外海风云篇通关·重返天南故土（章末钩）", "medal");
      const t = `第${s.year}年${s.month}月`;
      s.worldNews = s.worldNews || [];
      s.worldNews.push({ t, kind: "world", text: "天南暗流：云梦山三派试剑大会风声渐起，魔道探子游走各州——阔别数十年的故土，山雨欲来。" });
      s.worldNews.push({ t, kind: "rumor", text: "乱星海旧闻渡海而来：『韩老魔』于阴冥绝地以凡人之躯搏杀六道传人——听过的人都说是渔夫的醉话。只有极少数人知道那是真的。" });
      if (s.worldNews.length > 40) s.worldNews.splice(0, s.worldNews.length - 40);
      if (typeof Sfx !== "undefined") Sfx.play("success");
      Engine.toast("外海风云篇通关！重返天南故土");
    },
    choices: [
      {
        text: "（蛰伏天南·静待风起——外海风云篇 终）",
        hint: "凡人归乡·风云再起",
        effect(s) {
          s.mood = Math.min(s.moodMax, (s.mood || 0) + 8);
          return { text: "你立于洞府崖口，望着天南熟悉又陌生的群山。从这里出发，也回到这里——只是当年那个攥着升仙令的少年，如今已是能以凡人之躯搏杀天骄的结丹大圆满。元婴之门，就在前方。", kind: "good" };
        },
        resolve: "advance",
      },
    ],
  },
];

window.STORY = STORY;
