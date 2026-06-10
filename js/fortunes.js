/* ============================================================
 * fortunes.js — 奇遇系统（随机支线事件，不改主线）
 *
 * 见 docs/randomness-plan.md
 * 奇遇在「外出历练」时低概率触发，带选择与正负后果。
 * 韩立人设固定，随机只体现在际遇——结果可正可负，强化修仙世界的凶险莫测。
 *
 * 事件字段：
 *   id, title, text
 *   where     可触发的地点 id 数组（不填=任意地点）
 *   cond(s)   额外触发条件（可选）
 *   weight    抽取权重
 *   once      true=一局只触发一次
 *   choices[] { text, hint, effect(s) -> 返回结算文案; log: 文案种类 }
 * ============================================================ */

const FORTUNES = [
  {
    id: "old_herb",
    title: "崖畔奇草",
    text: "历练途中，你在一处险峭崖缝里瞥见一株从未见过的草药，灵气隐隐，却生在探手难及之处。",
    where: ["houshan"],
    weight: 20,
    choices: [
      {
        text: "冒险攀崖去采",
        hint: "可能受伤，也可能有所得",
        effect(s) {
          if (Math.random() < 0.6) {
            State.give("lingcao", 2); State.give("duyao_cao", 1);
            return { text: "你小心攀下，采得灵草×2、毒草×1，满载而归。", kind: "good" };
          }
          const dmg = 12 + Math.floor(Math.random() * 14);
          s.hp = Math.max(1, s.hp - dmg);
          return { text: `崖石松动，你险些跌落，慌乱中只擦伤了手脚（气血-${dmg}），草药也没够着。`, kind: "bad" };
        },
      },
      {
        text: "量力而行，不去强求",
        hint: "谨慎为上",
        effect(s) {
          s.mood = Math.min(s.moodMax, s.mood + 5);
          return { text: "你记下此处，悄然离去。修仙惜命，来日方长，心境反倒平和了些。", kind: "event" };
        },
      },
    ],
  },

  {
    id: "wandering_pedlar",
    title: "游方货郎",
    text: "山道上遇一游方货郎，挑着担子，神秘兮兮地说有些“好东西”，只换灵石或纹银。",
    where: ["town", "houshan", "wuting"],
    weight: 16,
    choices: [
      {
        text: "花 10 两纹银买他的“秘药”",
        hint: "真假难辨",
        cond: (s) => s.silver >= 10,
        effect(s) {
          s.silver -= 10;
          if (Math.random() < 0.5) {
            State.give("ningshen_dan", 1);
            return { text: "拆开油纸，竟是一枚货真价实的凝神丹，捡了便宜！", kind: "good" };
          }
          return { text: "回去一看，不过是几味寻常草药压成的假药，被坑了十两。", kind: "bad" };
        },
      },
      {
        text: "婉拒离开",
        effect() { return { text: "你不动声色地走开。江湖骗子十之八九，不上当为妙。", kind: "sys" }; },
      },
    ],
  },

  {
    id: "wounded_cultivator",
    title: "重伤修士",
    text: "林中一名重伤的散修倒在血泊里，气息奄奄，见你过来，挣扎着想说什么。",
    where: ["houshan", "town"],
    weight: 12,
    once: true,
    choices: [
      {
        text: "上前施救",
        hint: "善心未必有善报，但……",
        effect(s) {
          if (State.count("huixue_dan") > 0) State.take("huixue_dan", 1);
          if (Math.random() < 0.7) {
            State.give("lingshi", 2);
            s.mood = Math.min(s.moodMax, s.mood + 8);
            return { text: "你为他敷药包扎。他感激涕零，留下两块灵石作谢，蹒跚而去。", kind: "good" };
          }
          const dmg = 18;
          s.hp = Math.max(1, s.hp - dmg);
          s.demon = Math.min(100, s.demon + 10);
          return { text: `不料他竟是装伤的歹人，趁你近身偷袭！你挨了一下（气血-${dmg}）才将其逼退。人心难测，你心头一沉。`, kind: "bad" };
        },
      },
      {
        text: "远远绕开",
        hint: "明哲保身",
        effect(s) {
          return { text: "你想起墨大夫的城府，硬下心肠绕道而行。修仙世界，恻隐之心有时是催命符。", kind: "event" };
        },
      },
    ],
  },

  {
    id: "ancient_chant",
    title: "残卷",
    text: "你在一处废弃石室的角落，发现半卷被虫蛀的功法残页，字迹模糊，却隐隐透着玄机。",
    where: ["houshan", "miju"],
    weight: 10,
    once: true,
    choices: [
      {
        text: "潜心参悟",
        hint: "悟性越高，所得越多",
        effect(s) {
          const gain = 1 + (Math.random() < (s.insight / 20) ? 1 : 0);
          s.insight += gain;
          return { text: `你对着残页苦思数日，竟有所悟，悟性+${gain}。残页虽不全，亦受用无穷。`, kind: "good" };
        },
      },
      {
        text: "收起来再说",
        effect() { return { text: "你将残页仔细收好，留待日后修为精进再参详。", kind: "sys" }; },
      },
    ],
  },

  {
    id: "quiet_spring",
    title: "灵泉小憩",
    text: "走得乏了，你寻到一汪清冽的山泉，泉水隐隐有灵气流转。",
    where: ["houshan"],
    weight: 14,
    choices: [
      {
        text: "就着灵泉打坐调息",
        effect(s) {
          const realm = State.realm();
          s.spirit = Math.min(realm.spMax, s.spirit + Math.round(realm.spMax * 0.4));
          s.hp = Math.min(s.hpMax, s.hp + 20);
          s.mood = Math.min(s.moodMax, s.mood + 10);
          return { text: "灵泉滋养，你灵力与气血皆有恢复，心境也舒展开来。", kind: "good" };
        },
      },
    ],
  },

  {
    id: "black_market",
    title: "黑市掮客",
    text: "集镇暗巷里，一名独眼掮客冲你招手，压低声音：「这位道友，要不要看看好货？灵石现结，概不赊欠。」",
    where: ["town"],
    weight: 12,
    choices: [
      {
        text: "用 2 灵石换他的「神秘丹药」", hint: "灵石难得，风险自负",
        cond: (s) => s.stones >= 2 || State.count("lingshi") >= 2,
        effect(s) {
          if (State.count("lingshi") >= 2) State.take("lingshi", 2); else s.stones -= 2;
          if (Math.random() < 0.55) { State.give("lingyao_dan", 1); return { text: "竟是一枚灵乳灵药，赚了！", kind: "good" }; }
          return { text: "丹药入口竟是哑药，被这独眼贼坑了。", kind: "bad" };
        },
      },
      { text: "不与黑市之人来往", effect() { return { text: "你摇头离去。黑市水深，沾上易惹祸端。", kind: "sys" }; } },
    ],
  },

  {
    id: "injured_beast",
    title: "受伤灵兽",
    text: "草丛中一头幼小的灵兽蜷缩着，腿上有伤，警惕地望着你。",
    where: ["houshan"],
    weight: 12,
    once: true,
    choices: [
      {
        text: "取金疮药为它疗伤", hint: "善因或结善果",
        cond: (s) => State.count("huixue_dan") >= 1,
        effect(s) {
          State.take("huixue_dan", 1);
          State.give("lingcao", 2);
          s.mood = Math.min(s.moodMax, s.mood + 6);
          return { text: "灵兽伤愈，叼来几株灵草相赠，转身没入林中。", kind: "good" };
        },
      },
      { text: "悄然退开，莫管闲事", effect() { return { text: "你不愿节外生枝，绕道而行。", kind: "sys" }; } },
    ],
  },

  {
    id: "senior_warning",
    title: "前辈警示",
    text: "一位面色苍白的老修士与你擦肩，忽然停步，意味深长地看你一眼：「小友身负秘宝吧？财不露白，慎之，慎之。」说罢飘然而去。",
    where: ["town", "wuting"],
    weight: 8,
    once: true,
    cond: (s) => s.bottle.unlocked,
    choices: [
      {
        text: "默记于心，愈发谨慎",
        effect(s) { s.insight += 1; return { text: "你心头一凛，更加小心地藏起锋芒。这份警觉，本身就是修仙的护身符。悟性+1。", kind: "good" }; },
      },
    ],
  },

  {
    id: "abandoned_cave",
    title: "废弃洞府",
    text: "你在后山深处发现一处坍塌的废弃洞府，依稀是某位散修的遗迹，隐隐透出危险气息。",
    where: ["houshan"],
    weight: 9,
    once: true,
    choices: [
      {
        text: "入内探宝", hint: "富贵险中求",
        effect(s) {
          if (Math.random() < 0.5) {
            State.give("lingshi", 2); State.give("anqi", 2);
            return { text: "你在尘封的石室里寻得灵石与一把暗器，是那散修的遗物。", kind: "good" };
          }
          const dmg = 20;
          s.hp = clamp(s.hp - dmg, 1, s.hpMax);
          return { text: `洞府机关未失效，你触动埋伏，险些被困(气血-${dmg})，狼狈退出。`, kind: "bad" };
        },
      },
      { text: "遗迹凶险，不入为妙", effect() { return { text: "你绕开了这处洞府。无名遗迹十有八九是修士的葬身之地。", kind: "sys" }; } },
    ],
  },

  {
    id: "fellow_disciple_plea",
    title: "同门求药",
    text: "一名年轻弟子捧着几枚铜板，红着眼眶求到「墨大夫」面前：「求您救救我娘，她病得很重……我只有这些钱。」",
    where: ["yaolu", "town"],
    weight: 10,
    cond: (s) => s.flags.is_modafu,
    choices: [
      {
        text: "施药救人，分文不取",
        effect(s) { s.mood = Math.min(s.moodMax, s.mood + 10); s.demon = clamp(s.demon - 5, 0, 100); return { text: "你配了副好药递过去。弟子千恩万谢。行医积善，你心境也澄明了几分。", kind: "good" }; },
      },
      {
        text: "照价收钱，公事公办",
        effect(s) { s.silver += 2; return { text: "你按规矩收了诊金。墨大夫的身份，本就不该太惹眼。", kind: "sys" }; },
      },
    ],
  },

  /* ============ 扩充批次：负面/两难/伏笔型为主（对齐觅长生"世界不空"） ============ */

  {
    id: "wolf_toll",
    title: "野狼帮设卡",
    text: "进镇的路口被几条野狼帮的汉子拦住，横着狼牙棒：「此路是我开。识相的，留下五两买路钱。」",
    where: ["town"],
    weight: 14,
    cond: (s) => !s.flags.jinguang_dead,
    choices: [
      {
        text: "破财消灾，交五两",
        cond: (s) => s.silver >= 5,
        effect(s) { s.silver -= 5; s.mood = Math.max(0, s.mood - 4); return { text: "你不动声色地交了钱。匹夫之怒无济于事——但这口气，你记下了。", kind: "bad" }; },
      },
      {
        text: "不交，硬闯",
        hint: "免不了动手",
        effect(s) {
          if (typeof Engine !== "undefined") { Engine._fortuneFight = "wolf_gang_thug"; }
          return { text: "「不识抬举！」狼牙棒兜头砸下——", kind: "bad" };
        },
      },
      {
        text: "绕远路进镇",
        hint: "多耗光阴",
        effect(s) { Engine.passTime(1); return { text: "你多绕了半日山路，避开了纠缠。光阴换平安，于修仙人而言未必划算。", kind: "sys" }; },
      },
    ],
  },

  {
    id: "corpse_pouch",
    title: "倒毙的散修",
    text: "深林里横着一具修士尸首，死去多时了，腰间的储物袋还在。四下无人，只有风声。",
    where: ["houshan"],
    weight: 10,
    once: true,
    choices: [
      {
        text: "取走储物袋",
        hint: "死人无须身外物……吗",
        effect(s) {
          State.give("lingshi", 2); State.give("huixue_dan", 1);
          s.demon = Math.min(100, s.demon + 6);
          return { text: "你默念一声「得罪」，解下储物袋——灵石两块、金疮药一瓶。捡尸这一行，做一次就有第二次，你的心沉了沉。", kind: "bad" };
        },
      },
      {
        text: "就地掩埋，合什而去",
        effect(s) {
          s.mood = Math.min(s.moodMax, s.mood + 6); s.demon = clamp(s.demon - 3, 0, 100);
          return { text: "你挖了个浅坑将他葬下。散修如蝼蚁，朝生暮死——今日葬人，他日谁葬你？心境反倒澄澈了。", kind: "good" };
        },
      },
    ],
  },

  {
    id: "night_demon_whisper",
    title: "夜半低语",
    text: "夜半打坐，丹田处忽有阴冷之意上涌，耳边仿佛有声音低低地笑：「修得这般苦，何不……走捷径？」",
    where: ["yaolu", "miju"],
    weight: 11,
    cond: (s) => s.demon >= 20,
    choices: [
      {
        text: "咬破舌尖，强行镇压",
        effect(s) {
          const dmg = 6;
          s.hp = Math.max(1, s.hp - dmg);
          s.demon = clamp(s.demon - 8, 0, 100);
          return { text: `剧痛让你霍然清醒（气血-${dmg}），那点阴冷被你硬生生压了回去。心魔此物，一次妥协便万劫不复。`, kind: "good" };
        },
      },
      {
        text: "顺着那声音想下去",
        hint: "凶险，或有所悟",
        effect(s) {
          if (Math.random() < 0.4) { s.insight += 1; s.demon = clamp(s.demon - 4, 0, 100); return { text: "你直面心底的贪念与不甘，看清了它的来处。所谓修心，不过是一次次与自己对坐。悟性+1。", kind: "good" }; }
          s.demon = Math.min(100, s.demon + 9); s.mood = Math.max(0, s.mood - 6);
          return { text: "那声音越来越响，你猛地惊醒，后背全是冷汗——心魔趁虚而入，又深了几分。", kind: "bad" };
        },
      },
    ],
  },

  {
    id: "mo_cabinet_scratch",
    title: "药柜暗痕",
    text: "替墨大夫整理药柜时，你的指尖在柜底摸到几道极深的刻痕——像是常年搬动重物留下的，方向直指里间的墙壁。",
    where: ["yaolu"],
    weight: 9,
    once: true,
    cond: (s) => !s.flags.is_modafu && !s.flags.qi_layer_4,
    choices: [
      {
        text: "不动声色，记在心里",
        effect(s) { s.insight += 1; return { text: "你把刻痕原样遮好，面上若无其事。这药庐里，恐怕藏着不为人知的东西。悟性+1。", kind: "good" }; },
      },
      {
        text: "只当没看见",
        effect(s) { s.demon = Math.min(100, s.demon + 3); return { text: "你缩回手，强迫自己忘掉。可有些念头一旦生根，夜里便会发芽。", kind: "sys" }; },
      },
    ],
  },

  {
    id: "festival_lanterns",
    title: "上元灯火",
    text: "山下集镇正逢灯节，满街灯火，孩童提灯笑闹着跑过。你忽然想起，离家那年，娘也给你扎过一盏兔儿灯。",
    where: ["town"],
    weight: 9,
    once: true,
    choices: [
      {
        text: "驻足看一会儿灯",
        effect(s) {
          s.mood = Math.min(s.moodMax, s.mood + 12);
          return { text: "你在灯影里站了很久。凡人的热闹与你已隔了一层，可那点暖意，仍照进了心底。心境大悦。", kind: "good" };
        },
      },
      {
        text: "转身离开人群",
        effect(s) {
          s.demon = clamp(s.demon - 2, 0, 100); s.mood = Math.max(0, s.mood - 3);
          return { text: "修仙之人，早晚要看着同辈凡人老去。你不敢多看，转身没入夜色。", kind: "sys" };
        },
      },
    ],
  },

  {
    id: "herb_stall_fake",
    title: "药摊辨伪",
    text: "集上药摊摆着一株「百年血参」，摊主赌咒发誓货真价实，开价八两。你在药庐耳濡目染，看出几分蹊跷。",
    where: ["town"],
    weight: 12,
    choices: [
      {
        text: "细看真伪再说",
        hint: "悟性越高越有把握",
        effect(s) {
          if (Math.random() < 0.35 + s.insight * 0.05) {
            return { text: "你一眼认出参须是染过色的山萝卜根，转身便走。摊主在背后讪讪收摊。药庐的日子没白过。", kind: "good" };
          }
          if (s.silver >= 8) { s.silver -= 8; State.give("lingcao", 1); return { text: "你瞧了半天没瞧出破绽，掏钱买下——回去一验，参是假的，好在须子里还缠着一小株真灵草，算是不幸中的万幸。", kind: "bad" }; }
          return { text: "你盘缠不足，只得作罢。倒省了一桩破财。", kind: "sys" };
        },
      },
      { text: "不淌这浑水", effect() { return { text: "集市水深，你看了一眼便走。", kind: "sys" }; } },
    ],
  },

  {
    id: "qi_deer",
    title: "灵鹿引路",
    text: "一头通体雪白的小鹿在林缘望着你，不惊不惧，转身走出几步，又回头望你，似在引路。",
    where: ["houshan"],
    weight: 10,
    choices: [
      {
        text: "跟它走",
        hint: "或是机缘，或是迷途",
        effect(s) {
          if (Math.random() < 0.55) {
            State.give("lingcao", 2);
            s.mood = Math.min(s.moodMax, s.mood + 5);
            return { text: "白鹿将你引至一片背阴的洼地——好几株灵草长得正盛！再回头，鹿已不见踪影。", kind: "good" };
          }
          Engine.passTime(1);
          return { text: "你跟着它在山里转了大半日，最后它一跃没入深林，只留你原地辨认来路。莫名其妙地耗了些光阴。", kind: "bad" };
        },
      },
      { text: "心存戒备，不去招惹", effect() { return { text: "深山之中，越是通灵之物越不可轻信。你目送它离去。", kind: "sys" }; } },
    ],
  },

  {
    id: "nameless_grave",
    title: "无名坟冢",
    text: "山坳里立着一座无碑的旧坟，坟头压着一柄锈剑——是某位无名修士的安息处。",
    where: ["houshan"],
    weight: 8,
    once: true,
    choices: [
      {
        text: "拔草培土，拜上三拜",
        effect(s) {
          s.mood = Math.min(s.moodMax, s.mood + 7);
          if (Math.random() < 0.4) { State.give("anqi", 2); return { text: "你整理坟茔时，从浮土里翻出一小匣保存完好的飞针——许是前辈冥冥中相赠。你郑重谢过。", kind: "good" }; }
          return { text: "你拜了三拜。同是天涯修行人，他的今日，未必不是你的明日。心境沉静了几分。", kind: "good" };
        },
      },
      {
        text: "翻找陪葬之物",
        hint: "发死人财，损心境",
        effect(s) {
          s.demon = Math.min(100, s.demon + 8); s.mood = Math.max(0, s.mood - 5);
          if (Math.random() < 0.5) { State.give("lingshi", 1); return { text: "你掘开浮土，摸出一块灵石——可那柄锈剑始终正对着你，看得你心里发毛。", kind: "bad" }; }
          return { text: "坟里空空如也，只有一具枯骨。你悻悻填回土，总觉得背后有视线。", kind: "bad" };
        },
      },
    ],
  },

  {
    id: "wuting_bully",
    title: "仗势欺人",
    text: "演武厅外，一名管事弟子正逼着几个新入门的杂役弟子「孝敬」月例，见你路过，眯眼打量：「你也是杂役房的？」",
    where: ["wuting"],
    weight: 10,
    cond: (s) => !s.flags.is_modafu,
    choices: [
      {
        text: "「我是药庐的人。」",
        hint: "抬出墨大夫的名头",
        effect(s) { return { text: "对方脸色一变——墨大夫的怪脾气门中皆知，没人愿意招惹。他挥挥手放你过去。背靠大树，亦是生存之道。", kind: "sys" }; },
      },
      {
        text: "替那几个杂役弟子说话",
        hint: "出头有风险",
        effect(s) {
          if (Math.random() < 0.5) { s.mood = Math.min(s.moodMax, s.mood + 6); return { text: "你不卑不亢地点破此事传出去对谁都不好。对方权衡再三，骂骂咧咧地走了。杂役弟子们感激地望着你。", kind: "good" }; }
          const dmg = 8; s.hp = Math.max(1, s.hp - dmg);
          return { text: `对方恼羞成怒，「不知好歹」，一掌将你搡翻在地（气血-${dmg}）。门派里的腌臜事，从来不少。`, kind: "bad" };
        },
      },
      { text: "低头走开", effect(s) { s.demon = Math.min(100, s.demon + 2); return { text: "你垂下眼睛走过去。弱者连愤怒都要藏好——这道理你比谁都懂，可心里仍像堵了块石头。", kind: "sys" }; } },
    ],
  },

  {
    id: "storeroom_rats",
    title: "药材鼠患",
    text: "药庐的储藏间进了山鼠，几包晒好的药材被啃得乱七八糟。墨大夫若知道了，少不了一顿训斥。",
    where: ["yaolu"],
    weight: 10,
    cond: (s) => !s.flags.is_modafu,
    choices: [
      {
        text: "连夜设陷阱，捉鼠补漏",
        effect(s) {
          if (Math.random() < 0.7) { State.give("lingcao", 1); return { text: "一夜折腾，山鼠尽数落网。你在鼠洞深处竟还掏出一株被它们囤着的灵草——因祸得福。", kind: "good" }; }
          s.mood = Math.max(0, s.mood - 4);
          return { text: "鼠是捉了，可损失的药材补不回来。你挨了墨大夫好一顿数落。", kind: "bad" };
        },
      },
      {
        text: "用自己的纹银悄悄补上",
        cond: (s) => s.silver >= 3,
        effect(s) { s.silver -= 3; return { text: "你去集上自掏腰包补齐了药材，神不知鬼不觉。破财免灾。", kind: "sys" }; },
      },
    ],
  },

  {
    id: "beggar_child",
    title: "市井小贼",
    text: "集市人潮里一个瘦小的身影撞了你一下——你腰间的钱袋应声而失。那乞儿钻进巷子，跑得飞快。",
    where: ["town"],
    weight: 10,
    cond: (s) => s.silver >= 2,
    choices: [
      {
        text: "提气追上去",
        hint: "遁速越高越容易追回",
        effect(s) {
          if (Math.random() < 0.35 + (s.speed || 0) * 0.03) {
            return { text: "你几个起落便堵住巷口。乞儿吓得面无人色，奉还钱袋。你看他枯瘦，到底没有为难，丢下两个铜板走了。", kind: "good" };
          }
          const loss = Math.min(s.silver, 2);
          s.silver -= loss;
          return { text: `巷子七拐八绕，人早没影了（纹银-${loss}）。市井之间，竟也藏着这等身手。`, kind: "bad" };
        },
      },
      {
        text: "罢了，权当施舍",
        effect(s) {
          const loss = Math.min(s.silver, 2);
          s.silver -= loss; s.mood = Math.min(s.moodMax, s.mood + 3);
          return { text: `你看着那身影消失在巷尾，想起自己也曾是个吃不饱的孩子（纹银-${loss}）。罢了。`, kind: "sys" };
        },
      },
    ],
  },

  {
    id: "stone_vein_glint",
    title: "石隙微光",
    text: "你在一处塌方的山岩间瞥见一线微光——竟是一小条裸露的灵石矿苗，量不大，但确是真的。",
    where: ["houshan"],
    weight: 7,
    once: true,
    cond: (s) => s.realmIndex >= 2,
    choices: [
      {
        text: "花力气凿下来",
        hint: "耗时一月",
        effect(s) {
          Engine.passTime(1);
          State.give("lingshi", 2);
          return { text: "你寻来钎凿，足足忙了月余，凿得灵石两块。指尖磨出了血泡，心里却是踏实的。", kind: "good" };
        },
      },
      {
        text: "位置太显眼，不宜久留",
        effect(s) { s.insight += 1; return { text: "矿苗虽诱人，可这等地方难保没有别人盯着。你抹去痕迹悄然离开——保命的直觉，又敏锐了几分。", kind: "good" }; },
      },
    ],
  },

  {
    id: "biaoshi_night_talk",
    title: "邸店夜话",
    text: "雨夜投宿，同屋的老镖师就着一壶浊酒讲起江湖见闻——哪条道上不太平，哪家镖局折了人，野狼帮近来又在招兵买马……",
    where: ["town"],
    weight: 11,
    cond: (s) => !s.flags.jinguang_dead,
    choices: [
      {
        text: "添一角酒，听他细说",
        cond: (s) => s.silver >= 1,
        effect(s) {
          s.silver -= 1; s.mood = Math.min(s.moodMax, s.mood + 5);
          return { text: "老镖师酒酣耳热，话也多了：「野狼帮那个贾天龙，野心不小，迟早要跟七玄门碰一碰……」你把这话记在了心里。", kind: "good" };
        },
      },
      { text: "早些歇息", effect() { return { text: "江湖事听得再多，路还是要自己走。你吹灯睡下。", kind: "sys" }; } },
    ],
  },
];

window.FORTUNES = FORTUNES;
