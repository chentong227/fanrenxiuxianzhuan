/* ============================================================
 * dialogue.js — 据点在场人物的「对话主题」（深化临场交互）
 *
 * 每个 NPC 除了"闲谈攀谈"，还按其身份提供独特的交互主题：
 *   厉飞雨 → 切磋/听门派武风；小算盘 → 花灵石打探消息；
 *   走方郎中 → 行医问药；散修 → 修仙界见识……
 *
 * 平衡红线（针对"无限对话刷道具/属性"）：
 *   - 给「永久属性/白送道具」的主题标 once:true，一次性，谈过即不再出现。
 *   - 需消耗资源(灵石)的交易型主题可重复（本就有成本，不算白嫖）。
 *   - 仅给"耗时换微小收益"(切磋练体魄/诊治回血)的主题可重复，但都消耗光阴(寿元)，有机会成本。
 *
 * 主题结构：{ id, label, hint, once?, cond(s), effect(s) → { text, kind } }
 * 一次性主题完成后记入 state.dialogueDone[npcId+':'+topicId]。
 * 纯逻辑、可无头测试。
 * ============================================================ */

(function (root) {

  const DIALOGUE = {
    topics: {
      lifeiyu: [
        {
          id: "spar", label: "与厉飞雨切磋（耗时·练体魄）", hint: "他武学有成，点到为止",
          effect(s) {
            Engine.passTime(1);
            s.body += 1;
            s.mood = Math.min(s.moodMax, s.mood + 4);
            INTERACTIONS && INTERACTIONS.favor(s, "lifeiyu", 4);
            // 剑意修行链：与赠剑之人对剑，磨剑最快
            let sword = "";
            if (!s.swordMastery) {
              s.swordIntent = Math.min(100, (s.swordIntent || 0) + 4);
              sword = s.swordIntent >= 100 ? "（剑意圆满！可回药庐悟剑）" : "（剑意+4）";
            }
            return { text: "你与厉飞雨拆了几招。他越打越起劲，直夸你身手长进飞快。体魄+1，交情更近。" + sword, kind: "good" };
          },
        },
        {
          id: "sword_hint", label: "请教眨眼剑法的火候", hint: "剑是他赠的，路得自己走", once: true,
          cond: (s) => !s.swordMastery && (s.knownSkills || []).includes("zhayan"),
          effect(s) {
            INTERACTIONS && INTERACTIONS.favor(s, "lifeiyu", 2);
            s.swordIntent = Math.min(100, (s.swordIntent || 0) + 5);
            return { text: "厉飞雨掂着你的剑笑道：「招你都会了，差的是出剑的次数。我厉家这门剑法，练到后头快的不是手，是心——多上手，多见血光，火候到了自然懂。」（剑意修行开启：实战与切磋皆可磨剑）", kind: "event" };
          },
        },
        {
          id: "sword_awe", label: "「你这剑……」", hint: "他看出你的剑变了", once: true,
          cond: (s) => s.swordMastery,
          effect(s) {
            INTERACTIONS && INTERACTIONS.favor(s, "lifeiyu", 6);
            return { text: "你随手演了半式。厉飞雨怔了半晌，忽然大笑：「好你个韩立！这剑法到你手里，竟比我厉家人还快——我服了，往后这眨眼剑法，你才是正主！」", kind: "good" };
          },
        },
        {
          id: "sect_talk", label: "听他说门派武风", hint: "了解七玄门", once: true,
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
            Engine.passTime(1);
            s.mood = Math.min(s.moodMax, s.mood + 5);
            INTERACTIONS && INTERACTIONS.favor(s, "zhangtie", 4);
            return { text: "你与张铁聊起青牛镇的旧事，他憨憨地笑，说等攒了例钱，要给家里捎些盐米去。心头一暖。", kind: "good" };
          },
        },
      ],
      modafu: [
        {
          id: "learn", label: "向墨大夫请教医毒（一次·悟性+1）", hint: "辨药识毒，长见识", once: true,
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
        {
          id: "dossier_jinguang", label: "买「金光上人」的底细（灵石×1）", hint: "知其招路，料敌于先",
          cond: (s) => s.flags.jinguang_appeared && !s.flags.jinguang_dead && (s.intel || {}).jinguang !== 2,
          effect(s) {
            if ((typeof State !== "undefined" ? State.count("lingshi") : 0) < 1) return { text: "小算盘两手一摊：「没灵石，免谈。」", kind: "sys" };
            Engine.buyIntel("jinguang");
            return { text: "小算盘四下看了看，压着嗓子把金光上人的来路、招式、破绽说了个透。这一块灵石，花得值。", kind: "good" };
          },
        },
        {
          id: "dossier_jiatianlong", label: "买「贾天龙」的底细（灵石×1）", hint: "知己知彼",
          cond: (s) => s.flags.gang_war && (s.intel || {}).jiatianlong !== 2,
          effect(s) {
            if ((typeof State !== "undefined" ? State.count("lingshi") : 0) < 1) return { text: "小算盘两手一摊：「没灵石，免谈。」", kind: "sys" };
            Engine.buyIntel("jiatianlong");
            return { text: "小算盘扒拉着算珠，把贾天龙的武功路数、帮中恩怨一五一十道来。", kind: "good" };
          },
        },
      ],
      langzhong: [
        {
          id: "heal", label: "请走方郎中诊治（耗时·疗伤）", hint: "凡俗医术，省点气血",
          cond: (s) => s.hp < s.hpMax,
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
          id: "road_news", label: "打听江湖见闻", hint: "镖师走南闯北", once: true,
          effect(s) {
            return { text: "镖师灌了口酒：「这一路啊，野狼帮的关卡越来越多，买路钱一涨再涨。出门在外，多个心眼。」", kind: "event" };
          },
        },
      ],
      sanxiu: [
        {
          id: "cultivation_talk", label: "请教修仙界见识（一次·悟性+1）", hint: "散修四海漂泊", once: true,
          effect(s) {
            s.insight = (s.insight || 0) + 1;
            return { text: "散修嗤笑一声，却也说了几句真东西：「练气十三层是道坎，筑基丹千金难求。没有靠山的散修，十个有九个困死在练气。」悟性+1。", kind: "event" };
          },
        },
      ],
      nongfu: [
        {
          id: "herb_tip", label: "向采药老农讨教（一次·赠灵草）", hint: "熟知山中草木", once: true,
          effect(s) {
            State.give("lingcao", 2);
            return { text: "老农领你认了几株灵草，临了塞给你两株：「拿着拿着，老汉我识得门道。」灵草+2，往后采药也心里有数了。", kind: "good" };
          },
        },
      ],
      jiatianlong: [
        {
          id: "observe", label: "远远观察贾天龙", hint: "不可打草惊蛇", once: true,
          cond: (s) => s.flags.gang_war && !s.flags.jinguang_dead,
          effect(s) {
            return { text: "你隔着人群打量贾天龙——魁梧凶悍，眼里全是野心。这等人物，绝不会满足于几座城镇。山雨欲来了。", kind: "bad" };
          },
        },
      ],
    },

    _doneKey(npcId, topicId) { return npcId + ":" + topicId; },
    isDone(s, npcId, topicId) {
      return !!(s.dialogueDone && s.dialogueDone[this._doneKey(npcId, topicId)]);
    },
    markDone(s, npcId, topicId) {
      if (!s.dialogueDone) s.dialogueDone = {};
      s.dialogueDone[this._doneKey(npcId, topicId)] = true;
    },

    // 取某 NPC 当前可用的主题（满足 cond，且一次性主题未完成）
    forNpc(npcId, s) {
      const list = this.topics[npcId] || [];
      return list.filter(t => {
        if (t.cond && !t.cond(s)) return false;
        if (t.once && this.isDone(s, npcId, t.id)) return false;
        return true;
      });
    },
  };

  root.DIALOGUE = DIALOGUE;
  if (typeof module !== "undefined" && module.exports) module.exports = DIALOGUE;

})(typeof window !== "undefined" ? window : globalThis);
