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

    // 活世界与你抢资源（drift-audit #4）：寿元将尽者会主动找上门求救命丹——
    //   不是被动等你拜会才碰上，而是"垂死者亲自来求"。你的丹有数、求助者不止一个：救谁是真选择。
    //   仅在你以医毒闻名（is_modafu·够得着求药的名头）时主动来访，避免早期打扰。
    if (s.flags.is_modafu) {
      const dying = alive.filter(f => f.desperate);
      if (dying.length && rng() < 0.55) {
        const who = dying[Math.floor(rng() * dying.length)];
        return { kind: "beg_pill", npcId: who.id, npcName: who.name };
      }
    }

    const who = alive[Math.floor(rng() * alive.length)];
    const kinds = [];
    // 求丹：你以医毒闻名时更常见
    if (s.flags.is_modafu) kinds.push("buy_pill", "buy_pill");
    kinds.push("secret_realm", "spar_request");
    // 寿元将尽者更可能上门求救命丹
    if (who.desperate) kinds.push("beg_pill", "beg_pill");
    let kind = kinds[Math.floor(rng() * kinds.length)];
    // 一致感：切磋者只按【示人境界】找上门（世界只认它看见的你）——
    //   练气八层不会跑来"讨教"一个示人练气一层的药童。挑不出同档对手就不来。
    if (kind === "spar_request") {
      const shown = this.shownLayer(s);
      const peers = alive.filter(f => Math.abs((f.realm || 1) - shown) <= 2);
      if (!peers.length) kind = "secret_realm";
      else {
        const p = peers[Math.floor(rng() * peers.length)];
        return { kind, npcId: p.id, npcName: p.name };
      }
    }
    return { kind, npcId: who.id, npcName: who.name };
  },

  // 玩家的【示人境界】折算成练气层数（1~13）——藏拙者以此示人，NPC 一律按它行事
  shownLayer(s) {
    const idx = (s.revealedRealm != null ? s.revealedRealm : s.realmIndex) || 0;
    return Math.min(13, idx + 1);
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
      case "beg_pill": {
        // 续命丹分级（drift-audit #4 资源竞争）：珍稀丹续得久——你的丹有数、垂死者不止一个，救谁/用哪颗是真取舍。
        // 灵乳灵药=小绿瓶量产的大补灵药（续 6 年）；养元丹=寻常丹（续 3 年）；凝神丹=安神（续 2 年·聊胜于无）。
        const PILLS = [
          { id: "lingyao_dan", name: "灵乳灵药", years: 6 },
          { id: "qingyuan_dan", name: "养元丹", years: 3 },
          { id: "ningshen_dan", name: "凝神丹", years: 2 },
        ];
        const owned = PILLS.filter(p => State.count(p.id) >= 1);
        const giveChoices = owned.map(p => ({
          text: `赠以${p.name}（续 ${p.years} 年寿）`, hint: "积德结善缘——但你的丹，救得了几人？",
          effect(st) {
            State.take(p.id, 1);
            INTERACTIONS.favor(st, f.id, p.years >= 6 ? 20 : p.years >= 3 ? 12 : 6);
            f.lifespan += p.years; f.desperate = false;
            st.mood = Math.min(st.moodMax, st.mood + 4);
            return { text: `你递出一枚${p.name}。${f.name}涕泪交加，重重一拜。续得 ${p.years} 年寿——能否更进一步，便看他造化了。`, kind: "good" };
          },
        }));
        // 高价出售（只对最珍稀的一颗给选项，避免刷屏）：救命之物从无公道价
        if (owned.length) {
          const top = owned[0];
          giveChoices.push({
            text: `高价出售${top.name}（要价灵石×3）`, hint: "趁人之危，但灵石实在",
            effect(st) {
              State.take(top.id, 1); State.give("lingshi", 3);
              INTERACTIONS.favor(st, f.id, 3);
              f.lifespan += top.years; f.desperate = false;
              return { text: `你坐地起价。${f.name}咬牙倾尽家底换药——救命之物，从无公道价。`, kind: "event" };
            },
          });
        }
        giveChoices.push({
          text: owned.length ? "爱莫能助（丹要留给更要紧的人/事）" : "爱莫能助（你也没有续命的丹）",
          effect(st) {
            INTERACTIONS.favor(st, f.id, -6);
            return { text: `你摇头婉拒。${f.name}失魂落魄地离去……修仙界的命，从来各凭天数。这一颗丹省下了，可省下，也是一条命没接住。`, kind: "bad" };
          },
        });
        return {
          title: "垂死求丹",
          text: `${f.name}（${realm}）寿元将尽、突破无望，辗转寻到以医毒闻名的"墨大夫"门上，红着眼眶恳求："求您一枚续命的灵药，多少灵石我都给！"`,
          choices: giveChoices,
        };
      }
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
      case "spar_request": {
        // 来由按【示人身份】写（藏拙者的世界只认它看见的你）：
        //   墨大夫=慕医毒之名顺道讨教；寻常散修=听闻你身手利落。绝不写"修为不凡"。
        const trueLayer = (s.realmIndex || 0) + 1;
        const hidden = trueLayer - this.shownLayer(s);   // 深藏的层数
        const intro = s.flags.is_modafu
          ? `${f.name}（${realm}）慕"墨大夫"之名登门求药，闲谈间起了较技之心，欲与你切磋一场。`
          : `${f.name}（${realm}）听闻你身手利落，前来讨教，欲与你切磋一场。`;
        const choices = [
          // 应战=真实斗法（战斗引擎×社交事件——乘法）：演武较技、点到即止，
          //   世间修士不再是日志里的一行字，而是摆开路数站到你对面的人。
          { text: "应战切磋", hint: "演武较技·点到即止——真刀真枪见高下", spar: true },
        ];
        if (hidden > 0 && trueLayer - (f.realm || 1) >= 2) {
          choices.push({
            text: "藏拙应付", hint: "压着修为陪练，不露真功",
            effect(st) {
              Engine.passTime(1);
              st.body += 1;
              INTERACTIONS.favor(st, f.id, 4);
              st.mood = Math.min(st.moodMax, st.mood + 4);
              return { text: `你压着修为陪${f.name}过招，胜负拿捏在方寸之间——对方只当棋逢对手，尽兴而去。收放由心，这份分寸也是修行（体魄+1，心境+4）。`, kind: "good" };
            },
          });
        }
        choices.push({
          text: "闭门谢客",
          effect(st) { INTERACTIONS.favor(st, f.id, -3); return { text: "你闭门不见。对方悻悻而去，似有不快。", kind: "sys" }; },
        });
        return { title: "登门切磋", text: intro, choices };
      }
    }
    return null;
  },

  // 关系值（好感/仇怨）记录在存档
  favor(s, npcId, delta) {
    if (!s.relations) s.relations = {};
    // v347 煞气×社交（原著同源）：煞气≥60 周身阴戾之意外露，寻常人不自觉地避着你——
    // 正向交情增速减半（向上取整保底1），负向照旧。杀伐果断的代价落在人情账上。
    if (delta > 1 && (s.demon || 0) >= 60) delta = Math.ceil(delta / 2);
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
