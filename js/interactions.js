/* ============================================================
 * interactions.js — NPC 主动交互（参考鬼谷八荒：NPC 有主动性）
 *
 * 世间修士不只是背景数字——他们会主动找上韩立：
 *   - 求购丹药（你是"墨大夫"，医毒闻名）
 *   - 邀约组队闯秘境/副本
 *   - 上门挑衅、寻仇、或求助
 * 玩家的回应改变关系（好感/仇怨）与资源，并可能引出战斗或收益。
 *
 * 红线：交互只发生在"背景修士"(npcFates) 身上；主线人物命运忠于动漫。
 * 纯逻辑、可注入 rng，便于无头测试。
 * ============================================================ */

const INTERACTIONS = {
  /* —— 羁绊回赠表（社交深化 ①②）——
   * 交情升段（相熟≥8 / 交情深厚≥20 / 挚交≥40）那一刻，具名故人按身份一次性回赠。
   * 升段才给、每段只给一次（s.npcGifts 记录），叠加月度拜会冷却 + 收益递减 → 刷不出来。
   * keepsake:true 为唯一信物（全局只此一件，入图鉴/年表）；严守考据：只给那人真有、合身份之物。 */
  TIER_GIFTS: {
    zhangtie: {
      1: { items: { huixue_dan: 2 }, line: "张铁把自己习武跌打用的金疮药一股脑塞给你：「省着点用，疼起来真要命。」" },
      2: { items: { ks_zhangtie: 1 }, keepsake: true, line: "张铁挠着头，递来一块亲手磨的桃木平安牌——同乡少年的笨拙心意。" },
    },
    lifeiyu: {
      1: { items: { ningshen_dan: 1 }, line: "厉飞雨抛来一枚凝神丹：「闭关走火可别硬扛，记着寻我。」" },
      2: { items: { ks_lifeiyu: 1 }, keepsake: true, line: "厉飞雨把贴身的练武札记拍进你怀里：「你这记性，看一遍就够了——拿去！」" },
    },
    modafu: {
      1: { items: { qingyuan_dan: 2 }, line: "墨大夫眯眼看你半晌，丢来两枚养元丹：「丹炉看好了，火候差一分都不成。」" },
    },
    xiaosuanpan: {
      1: { items: { lingshi: 1 }, line: "小算盘破天荒没提灵石，反塞给你一块：「韩师兄是自己人，这点意思——消息我也给你留着。」" },
      2: { items: { lingshi: 2 }, line: "小算盘压低声音：「门里门外的风声，往后你先知道。」顺手又匀了两块灵石给你。" },
    },
    mashibo: {
      1: { items: { lingcao: 2 }, line: "马师伯哼了一声，把两株灵草往你筐里一扔：「手脚麻利点，别盖坏了草帘。」" },
      2: { items: { ks_mashibo: 1 }, keepsake: true, line: "马师伯把用了几十年的辨药旧刀塞给你：「拿去——别糟蹋了药材。」" },
    },
    chenqiaoqian: {
      1: { items: { lingcao: 2 }, line: "陈巧倩匀给你两株药圃灵草，只道一句「顺路」，便别过脸去。" },
      2: { items: { ks_chenqiaoqian: 1 }, keepsake: true, line: "陈巧倩递来一份陈家药圃的稀罕药引，眉目清冷：「……欠你的，先还一点。」" },
    },
    wanxiaoshan: {
      1: { items: { huoshe_fu: 1 }, line: "万小山挑了张真火蛇符给你：「这才是真货，那摊的可千万别碰！」" },
      2: { items: { ks_wanxiaoshan: 1 }, keepsake: true, line: "万小山把亲手缝的护身符袋塞给你：「韩兄行走在外，别再被人当雏儿宰了。」" },
    },
    wushishu: {
      1: { items: { qingyuan_dan: 2 }, line: "吴师叔温言递来两枚养元丹：「本分修行，谁也难为不了你。」" },
      2: { items: { ks_wushishu: 1 }, keepsake: true, line: "吴师叔解下贴身的青玉佩按进你手心：「丹田气乱时攥着它定神。」" },
    },
  },
  // 交情段位：0 相识 / 1 相熟 / 2 交情深厚（深交）/ 3 挚交
  tierOf(rel) { return rel >= 40 ? 3 : rel >= 20 ? 2 : rel >= 8 ? 1 : 0; },
  giftFor(npcId, tier) {
    const t = this.TIER_GIFTS[npcId];
    return (t && t[tier]) ? t[tier] : null;
  },
  // 取出并清空待发的升段回赠队列（由 Engine.flushNpcGifts 结算）
  claimGifts(s) {
    const q = s._giftQueue || [];
    s._giftQueue = [];
    return q;
  },

  // 是否触发一次主动交互（在历练/行动后按概率）
  shouldTrigger(s, rng) {
    rng = rng || Math.random;
    if (!s.flags.is_modafu && !s.flags.met_friends) return null; // 早期不打扰
    if (s.combat || s.pendingEvent || s._pendingInteraction) return null;
    if (rng() > 0.16) return null;
    return this.pick(s, rng);
  },

  // 选一个活着的背景修士 + 一种交互
  pick(s, rng) {
    rng = rng || Math.random;
    const alive = (s.npcFates || []).filter(f => f.status === "alive");
    if (!alive.length) return null;

    // 羁绊回报：你气血危殆时，关系深厚者更可能主动来援（人情味=正向奖励）
    const friends = alive.filter(f => this.relationOf(s, f.id) >= 18);
    if (friends.length && (s.hp < s.hpMax * 0.4 || rng() < 0.3)) {
      const who = friends[Math.floor(rng() * friends.length)];
      const kind = (s.hp < s.hpMax * 0.4) ? "aid_rescue" : "aid_gift";
      return { kind, npcId: who.id, npcName: who.name };
    }

    const who = alive[Math.floor(rng() * alive.length)];
    const kinds = [];
    // 求丹：你以医毒闻名时更常见
    if (s.flags.is_modafu) kinds.push("buy_pill", "buy_pill");
    kinds.push("secret_realm", "spar_request");
    // 寿元将尽者更可能上门求救命丹
    if (who.desperate) kinds.push("beg_pill", "beg_pill");
    const kind = kinds[Math.floor(rng() * kinds.length)];
    return { kind, npcId: who.id, npcName: who.name };
  },

  // 构造交互内容（标题/正文/选项）。选项 effect(s) 返回结算文案。
  build(inter, s) {
    const f = (s.npcFates || []).find(x => x.id === inter.npcId) || { name: inter.npcName, realm: 3 };
    const realm = NPCSIM.realmName(f.realm);
    switch (inter.kind) {
      case "aid_rescue":
        return {
          title: "雪中送炭",
          text: `你身受重伤、气血垂危之际，${f.name}（${realm}）竟寻上门来——当年你的恩情，他始终记在心里。他二话不说，塞来一枚疗伤灵药。`,
          choices: [
            {
              text: "感念其义，收下相助",
              effect(st) {
                const heal = Math.round(st.hpMax * 0.5);
                st.hp = Math.min(st.hpMax, st.hp + heal);
                st.mood = Math.min(st.moodMax, st.mood + 8);
                INTERACTIONS.favor(st, f.id, 5);
                return { text: `灵药入腹，气血回暖(气血+${heal})。患难见真情——这条修仙路，你并非全然孤身一人。`, kind: "good" };
              },
            },
          ],
        };
      case "aid_gift":
        return {
          title: "故人来访",
          text: `${f.name}（${realm}）特来探望，说上回多亏你相助，一直记挂于心，带了些薄礼答谢。`,
          choices: [
            {
              text: "叙旧收礼",
              effect(st) {
                const roll = Math.random();
                if (roll < 0.5) { State.give("lingyao_dan", 1); var g = "一枚灵乳灵药"; }
                else if (roll < 0.8) { State.give("duyao_cao", 2); g = "两株上好的毒草"; }
                else { State.give("lingshi", 2); g = "两枚灵石"; }
                st.mood = Math.min(st.moodMax, st.mood + 6);
                INTERACTIONS.favor(st, f.id, 4);
                return { text: `${f.name}留下${g}，又与你叙了半日旧情方去。有来有往，情谊愈笃。`, kind: "good" };
              },
            },
          ],
        };
      case "buy_pill":
        return {
          title: "有人求购丹药",
          text: `${f.name}（${realm}）慕"墨大夫"医毒之名，登门求购一炉养元丹，愿以灵石相酬。`,
          choices: [
            {
              text: "卖给他（养元丹×1 → 灵石×1）",
              cond: () => State.count("qingyuan_dan") >= 1,
              effect(st) {
                State.take("qingyuan_dan", 1); State.give("lingshi", 1);
                INTERACTIONS.favor(st, f.id, 8);
                return { text: `你卖出一枚养元丹，得灵石一枚。${f.name}称谢而去，与你交情渐厚。`, kind: "good" };
              },
            },
            { text: "婉拒", effect() { return { text: "你推说丹药不足，婉言谢绝。", kind: "sys" }; } },
          ],
        };
      case "beg_pill":
        return {
          title: "垂死求丹",
          text: `${f.name}（${realm}）寿元将尽，突破无望，红着眼眶恳求："墨大夫，求您一枚续命的灵药，多少灵石我都给！"`,
          choices: [
            {
              text: "赠以灵药（灵乳灵药×1）", hint: "积德，亦结善缘",
              cond: () => State.count("lingyao_dan") >= 1,
              effect(st) {
                State.take("lingyao_dan", 1);
                INTERACTIONS.favor(st, f.id, 20);
                f.lifespan += 4; f.desperate = false;
                st.mood = Math.min(st.moodMax, st.mood + 6);
                return { text: `你递出一枚灵乳灵药。${f.name}涕泪交加，重重一拜。续得几年寿，能否更进一步，便看他造化了。`, kind: "good" };
              },
            },
            {
              text: "高价出售（要价灵石×3）",
              cond: () => State.count("lingyao_dan") >= 1,
              effect(st) {
                State.take("lingyao_dan", 1); State.give("lingshi", 3);
                INTERACTIONS.favor(st, f.id, 4);
                f.lifespan += 4; f.desperate = false;
                return { text: `你坐地起价。${f.name}咬牙倾尽家底换药——救命之物，从无公道价。`, kind: "event" };
              },
            },
            {
              text: "爱莫能助",
              effect(st) {
                INTERACTIONS.favor(st, f.id, -6);
                return { text: `你摇头婉拒。${f.name}失魂落魄地离去……修仙界的命，从来各凭天数。`, kind: "bad" };
              },
            },
          ],
        };
      case "secret_realm":
        return {
          title: "邀约闯秘境",
          text: `${f.name}（${realm}）寻来，说近日发现一处低阶秘境，机缘与凶险并存，邀你结伴同闯，所获均分。`,
          choices: [
            {
              text: "同往（耗时，机缘与凶险并存）",
              effect(st) {
                Engine.passTime(2);
                const roll = Math.random();
                INTERACTIONS.favor(st, f.id, 6);
                if (roll < 0.5) {
                  State.give("lingcao", 2); State.give("lingshi", 1);
                  return { text: `秘境中你与${f.name}同进退，采得灵草与灵石。患难之交，情谊更笃。`, kind: "good" };
                } else if (roll < 0.8) {
                  const dmg = 16; st.hp = Math.max(1, st.hp - dmg);
                  return { text: `秘境凶险，你们遭遇机关埋伏，险象环生(气血-${dmg})，勉强全身而退。`, kind: "bad" };
                }
                State.give("anqi", 2);
                return { text: `秘境深处别无长物，只拾得几枚他人遗落的暗器。`, kind: "event" };
              },
            },
            { text: "婉拒（修仙惜命，不涉险）", effect() { return { text: "你谢绝了邀约。来历不明的秘境，多是葬身之地。", kind: "sys" }; } },
          ],
        };
      case "spar_request":
        return {
          title: "登门切磋",
          text: `${f.name}（${realm}）听闻你修为不凡，前来讨教，欲与你切磋一场。`,
          choices: [
            {
              text: "应战切磋", hint: "胜负皆增见识",
              effect(st) {
                Engine.passTime(1);
                INTERACTIONS.favor(st, f.id, 5);
                st.body += 1;
                return { text: `你与${f.name}过了几招，点到即止。互有进益，也算不打不相识。`, kind: "good" };
              },
            },
            {
              text: "闭门谢客",
              effect(st) { INTERACTIONS.favor(st, f.id, -3); return { text: "你闭门不见。对方悻悻而去，似有不快。", kind: "sys" }; },
            },
          ],
        };
    }
    return null;
  },

  // 关系值（好感/仇怨）记录在存档
  favor(s, npcId, delta) {
    if (!s.relations) s.relations = {};
    const before = s.relations[npcId] || 0;
    s.relations[npcId] = before + delta;
    // 好感升段 → 具名故人按身份回赠（升段一次性、每段只给一次；背景修士 npcFates 不触发）
    if (delta > 0 && typeof WORLD !== "undefined" && WORLD.npcById && WORLD.npcById(npcId)) {
      const prevTier = (s.npcGifts && s.npcGifts[npcId]) || 0;
      const newTier = this.tierOf(s.relations[npcId]);
      if (newTier > prevTier) {
        for (let t = prevTier + 1; t <= newTier; t++) {
          if (this.giftFor(npcId, t)) (s._giftQueue = s._giftQueue || []).push({ npcId, tier: t });
        }
        if (!s.npcGifts) s.npcGifts = {};
        s.npcGifts[npcId] = newTier;
      }
    }
    return s.relations[npcId];
  },
  relationOf(s, npcId) { return (s.relations && s.relations[npcId]) || 0; },

  // —— 拜会节律（E3 社交机制咬合）——
  // 月度拜会：每名修士每月只应一次实质交往（切磋/赠礼/威胁/探查），把社交并入「回合=月份」的经济。
  _absMonth(s) {
    if (typeof State !== "undefined" && State.absMonth) return State.absMonth();
    return (s.year || 0) * 12 + (s.month || 0);
  },
  onCooldown(s, npcId) {
    const last = s.npcCd && s.npcCd[npcId];
    return last != null && last >= this._absMonth(s);
  },
  markInteract(s, npcId) {
    if (!s.npcCd) s.npcCd = {};
    s.npcCd[npcId] = this._absMonth(s);
  },
  // 收益随交情递减：交情越深，单次好感增益越小——不能无限刷满。
  favorGain(s, npcId, base) {
    const rel = this.relationOf(s, npcId);
    if (rel >= 40) return Math.max(1, Math.round(base * 0.34));
    if (rel >= 20) return Math.max(1, Math.round(base * 0.6));
    return base;
  },
};

if (typeof window !== "undefined") window.INTERACTIONS = INTERACTIONS;
if (typeof module !== "undefined" && module.exports) module.exports = INTERACTIONS;
