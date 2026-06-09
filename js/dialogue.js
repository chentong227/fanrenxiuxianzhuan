/* ============================================================
 * dialogue.js — 据点在场人物的「对话主题」（深化临场交互）
 *
 * 每个 NPC 除了"闲谈攀谈"，还按其身份提供独特的交互主题：
 *   厉飞雨 → 切磋/听门派武风；小算盘 → 花灵石打探消息；
 *   走方郎中 → 行医问药；镖师 → 江湖见闻；散修 → 修仙界见识……
 *
 * 主题结构：{ id, label, hint, cond(s), effect(s) → { text, kind } }
 * 纯逻辑、可无头测试。effect 内可调用 Engine/State（运行时存在）。
 * ============================================================ */

(function (root) {

  const DIALOGUE = {
    // 按 npcId 注册主题列表
    topics: {
      lifeiyu: [
        {
          id: "spar", label: "与厉飞雨切磋（耗时·练体魄）", hint: "他武学有成，点到为止",
          effect(s) {
            Engine.passTime(1);
            s.body += 1;
            s.mood = Math.min(s.moodMax, s.mood + 4);
            INTERACTIONS && INTERACTIONS.favor(s, "lifeiyu", 4);
            return { text: "你与厉飞雨拆了几招。他越打越起劲，直夸你身手长进飞快。体魄+1，交情更近。", kind: "good" };
          },
        },
        {
          id: "sect_talk", label: "听他说门派武风", hint: "了解七玄门",
          effect(s) {
            INTERACTIONS && INTERACTIONS.favor(s, "lifeiyu", 1);
            return { text: "厉飞雨说，门中弟子多重武艺，能引气入体修《长春功》者寥寥。他还笑你这药童闷头不响，进境却最快。", kind: "event" };
          },
        },
      ],
      zhangtie: [
        {
          id: "old_days", label: "叙青牛镇旧情", hint: "同乡之谊",
          cond: (s) => !s.flags.zhangtie_dead,
          effect(s) {
            s.mood = Math.min(s.moodMax, s.mood + 5);
            INTERACTIONS && INTERACTIONS.favor(s, "zhangtie", 4);
            return { text: "你与张铁聊起青牛镇的旧事，他憨憨地笑，说等攒了例钱，要给家里捎些盐米去。心头一暖。", kind: "good" };
          },
        },
      ],
      modafu: [
        {
          id: "learn", label: "向墨大夫请教医毒", hint: "辨药识毒，长见识",
          cond: (s) => !s.flags.modafu_dead,
          effect(s) {
            Engine.passTime(1);
            s.insight = (s.insight || 0) + 1;
            return { text: "墨大夫枯瘦的手指点过一味味药材，讲解药性毒理。你听得入神——悟性+1。只是他偶尔投来的眼神，让你莫名发寒。", kind: "event" };
          },
        },
      ],
      xiaosuanpan: [
        {
          id: "buy_rumor", label: "花灵石打探消息（灵石×1）", hint: "消息灵通的管事弟子",
          cond: (s) => State.count("lingshi") >= 1,
          effect(s) {
            State.take("lingshi", 1);
            INTERACTIONS && INTERACTIONS.favor(s, "xiaosuanpan", 5);
            const intel = [
              "他压低声音：野狼帮近来在城里大肆收拢打手，怕是要对七玄门下狠手了。",
              "他说：门里三位师叔为帮派之事愁得睡不着，听闻贾天龙在外头请了能人。",
              "他神秘兮兮：后山深处近来不太平，有弟子说看见诡异的光，劝你少去。",
            ];
            return { text: "你递过一枚灵石。小算盘眉开眼笑——「" + intel[Math.floor(Math.random() * intel.length)] + "」", kind: "event" };
          },
        },
      ],
      langzhong: [
        {
          id: "heal", label: "请走方郎中诊治（疗伤）", hint: "凡俗医术，省点气血",
          effect(s) {
            Engine.passTime(1);
            const heal = Math.round(s.hpMax * 0.3);
            s.hp = Math.min(s.hpMax, s.hp + heal);
            return { text: `老郎中替你把脉抓药，气血回了 ${heal}。他絮叨：「年轻人莫要逞强，命是自己的。」`, kind: "good" };
          },
        },
      ],
      biaoshi: [
        {
          id: "road_news", label: "打听江湖见闻", hint: "镖师走南闯北",
          effect(s) {
            return { text: "镖师灌了口酒：「这一路啊，野狼帮的关卡越来越多，买路钱一涨再涨。出门在外，多个心眼。」", kind: "event" };
          },
        },
      ],
      sanxiu: [
        {
          id: "cultivation_talk", label: "请教修仙界见识", hint: "散修四海漂泊",
          effect(s) {
            s.insight = (s.insight || 0) + 1;
            return { text: "散修嗤笑一声，却也说了几句真东西：「练气十三层是道坎，筑基丹千金难求。没有靠山的散修，十个有九个困死在练气。」悟性+1。", kind: "event" };
          },
        },
      ],
      nongfu: [
        {
          id: "herb_tip", label: "向采药老农讨教", hint: "熟知山中草木",
          effect(s) {
            if (Math.random() < 0.6) { State.give("lingcao", 1); return { text: "老农领你认了几株灵草，临了还塞给你一株：「拿着拿着，山里有的是。」灵草+1。", kind: "good" }; }
            return { text: "老农指点你后山何处灵草最盛、何处野兽出没。记下了，往后采药心里有数。", kind: "event" };
          },
        },
      ],
      jiatianlong: [
        {
          id: "observe", label: "远远观察贾天龙", hint: "不可打草惊蛇",
          cond: (s) => s.flags.gang_war && !s.flags.jinguang_dead,
          effect(s) {
            return { text: "你隔着人群打量贾天龙——魁梧凶悍，眼里全是野心。这等人物，绝不会满足于几座城镇。山雨欲来了。", kind: "bad" };
          },
        },
      ],
    },

    // 取某 NPC 当前可用的主题（满足 cond）
    forNpc(npcId, s) {
      const list = this.topics[npcId] || [];
      return list.filter(t => !t.cond || t.cond(s));
    },
  };

  root.DIALOGUE = DIALOGUE;
  if (typeof module !== "undefined" && module.exports) module.exports = DIALOGUE;

})(typeof window !== "undefined" ? window : globalThis);
