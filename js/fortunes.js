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
];

window.FORTUNES = FORTUNES;
