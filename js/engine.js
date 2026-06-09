/* ============================================================
 * engine.js — 游戏核心逻辑：行动、时间、突破、剧情推进、结算
 * ============================================================ */

const Engine = {
  /* -------- 叙事日志 -------- */
  log(text, kind = "event") {
    const s = State.data;
    s.log.push({ t: `第${s.year}年${s.month}月`, body: text, kind });
    if (s.log.length > 60) s.log.shift();
    UI.renderNarrative();
  },
  toast(msg, bad = false) { UI.toast(msg, bad); },

  /* -------- 时间流逝（以月为单位）-------- */
  passTime(months) {
    const s = State.data;
    s.month += months;
    while (s.month > 12) { s.month -= 12; s.year += 1; s.age += 1; }
    s.mood = clamp(s.mood + 1, 0, s.moodMax);
    // 世界不会因你停步：推进世间修士的命途
    this._tickWorld(months);
    // 时间推进后检查到期的任务与预定事件
    this._checkSchedule();
  },

  // NPC 命途模拟：推进、收集风云录、偶尔向玩家播报重大事件
  _tickWorld(months) {
    const s = State.data;
    if (typeof NPCSIM === "undefined") return;
    if (!s.worldNews) s.worldNews = [];
    const news = NPCSIM.tick(s, months, Math.random);
    if (!news.length) return;
    // 全部存入风云录（最多留近 40 条）
    for (const n of news) {
      s.worldNews.push({ t: `第${s.year}年${s.month}月`, kind: n.kind, text: n.text });
    }
    if (s.worldNews.length > 40) s.worldNews.splice(0, s.worldNews.length - 40);
    // 只把"身死/筑基"这类重大事件即时播报，避免刷屏
    const notable = news.filter(n => n.kind === "death" || n.kind === "ascend");
    notable.slice(0, 2).forEach(n => {
      this.log("【风云录】" + n.text, n.kind === "ascend" ? "good" : "bad");
    });
    // 世事反哺：有散修筑基成功 → 成为一方人物，世道随之变化
    const ascended = news.filter(n => n.kind === "ascend");
    if (ascended.length) {
      s.worldPowers = (s.worldPowers || 0) + ascended.length;
      this.log("【世道】又一位修士跻身筑基，成了一方人物。而你，仍困于练气。这世道从不等人。", "sys");
    }
  },

  // 行动后尝试触发 NPC 主动交互（参考鬼谷八荒：NPC 有主动性）
  _maybeInteraction() {
    const s = State.data;
    if (typeof INTERACTIONS === "undefined") return false;
    const inter = INTERACTIONS.shouldTrigger(s, Math.random);
    if (!inter) return false;
    s._pendingInteraction = inter;
    UI.openInteraction(INTERACTIONS.build(inter, s));
    State.save();
    return true;
  },

  // 玩家在主动交互中做出选择
  chooseInteraction(idx) {
    const s = State.data;
    const inter = s._pendingInteraction;
    if (!inter) return;
    const built = INTERACTIONS.build(inter, s);
    const choice = built.choices[idx];
    if (!choice) return;
    if (choice.cond && !choice.cond(s)) { this.toast("条件不足，无法如此"); return; }
    const r = choice.effect ? choice.effect(s) : { text: "", kind: "event" };
    s._pendingInteraction = null;
    this.log(`【${built.title}·${inter.npcName}】${r.text}`, r.kind || "event");
    UI.closeModal();
    this.checkLifespan();
    this.checkStory();
    State.save();
    UI.renderAll();
  },

  /* ===========================================================
   *  任务系统 与 时间线
   * =========================================================== */
  // 派发限期任务：dueInMonths 月内须达成
  assignTask(id, dueInMonths) {
    const def = QUESTS.tasks[id];
    if (!def) return;
    const s = State.data;
    s.tasks = s.tasks.filter(t => t.id !== id);
    s.tasks.push({ id, dueAbs: State.absMonth() + dueInMonths });
    this.log(`【新任务·${def.title}】${def.desc}（期限 ${dueInMonths} 个月）`, "event");
    this.toast(`接受任务：${def.title}`);
  },
  // 预定时间线事件：fireInMonths 月后发生
  scheduleEvent(id, fireInMonths) {
    const s = State.data;
    s.timeline = s.timeline.filter(e => e.id !== id);
    s.timeline.push({ id, fireAbs: State.absMonth() + fireInMonths });
  },
  hasTask(id) { return State.data.tasks.some(t => t.id === id); },

  // 检查到期：任务达标即结算，逾期则失败；时间线事件到点即触发
  _checkSchedule() {
    const s = State.data;
    const now = State.absMonth();
    if (this._inSchedule) return;     // 防重入（强制战斗等会再次推进时间）
    this._inSchedule = true;

    // 1) 任务：先看是否提前达成，再看是否逾期
    for (const t of s.tasks.slice()) {
      const def = QUESTS.tasks[t.id];
      if (!def) { s.tasks = s.tasks.filter(x => x !== t); continue; }
      if (def.cond && def.cond(s)) {
        s.tasks = s.tasks.filter(x => x !== t);
        if (def.onSuccess) def.onSuccess(s);
      } else if (now >= t.dueAbs) {
        s.tasks = s.tasks.filter(x => x !== t);
        if (def.onFail) def.onFail(s);
      }
    }

    // 2) 时间线：到点触发
    for (const e of s.timeline.slice()) {
      if (now >= e.fireAbs) {
        s.timeline = s.timeline.filter(x => x !== e);
        const def = QUESTS.events[e.id];
        if (def && def.onFire) def.onFire(s);
      }
    }
    this._inSchedule = false;
  },

  // 当前进行中的任务摘要（供 UI 展示）
  activeTasks() {
    const s = State.data;
    return s.tasks.map(t => {
      const def = QUESTS.tasks[t.id];
      const left = t.dueAbs - State.absMonth();
      return {
        title: def ? def.title : t.id,
        desc: def ? def.desc : "",
        progress: def && def.progress ? def.progress(s) : "",
        left: Math.max(0, left),
      };
    });
  },

  /* -------- 行动入口 -------- */
  doAction(action) {
    if (State.data.pendingEvent) { this.toast("先处理眼前之事"); return; }
    if (State.data.combat) { this.toast("酣战之中，无暇他顾"); return; }
    const s = State.data;

    if (action === "cultivate") { UI.openSeclusion(); return; }
    else if (action === "adventure") this.adventure();
    else if (action === "rest") this.rest();
    else if (action === "breakthrough") { UI.openBreakthrough(); return; }
    else if (action === "bottle") { UI.openBottle(); return; }
    else if (action === "gather") this.gather();
    else if (action === "spar") this.spar();
    else if (action === "market") { UI.openMarket(); return; }
    else if (action === "alchemy") this.alchemy();
    else if (action === "investigate") this.investigate();
    else if (action === "travel") { UI.openTravel(); return; }

    this.checkLifespan();
    this.checkStory();
    // 主线/战斗/奇遇都不抢占时，NPC 才可能主动找上门
    if (!s.pendingEvent && !s.combat && !this._pendingFortune) this._maybeInteraction();
    State.save();
    UI.renderAll();
  },
  /* -------- 前往其他地点（遁速影响赶路耗时）-------- */
  travelTo(locId) {
    const s = State.data;
    if (s.combat) return;
    const loc = WORLD.locations.find(l => l.id === locId);
    if (!loc) return;
    if (loc.id === s.location) { this.toast("你已在此处"); return; }
    const factor = Balance.travelTimeFactor(s.speed);
    const cost = Math.max(1, Math.round((loc.travelCost || 2) * factor));
    this.passTime(cost);
    s.location = locId;
    this.log(`你动身前往「${loc.name}」，行程耗时 ${cost} 月。${loc.desc}`, "event");
    this.checkLifespan();
    this.checkStory();
    State.save();
    UI.renderAll();
  },

  /* -------- 采药（后山）-------- */
  gather() {
    const s = State.data;
    this.passTime(WORLD.activities.gather.timeCost);
    const n = 1 + Math.floor(Math.random() * 3);
    State.give("lingcao", n);
    if (Math.random() < 0.4) State.give("duyao_cao", 1);
    this.log(`你在灵草丛中采得灵草 ×${n}` + (s.inventory.duyao_cao ? "，还顺手挖到一株毒草。" : "。"), "good");
  },

  /* -------- 切磋（演武厅，可能引出厉飞雨剧情提示）-------- */
  spar() {
    const s = State.data;
    this.passTime(WORLD.activities.spar.timeCost);
    s.body += 1;
    s.flags.adventured = true;
    s.mood = clamp(s.mood + 5, 0, s.moodMax);
    this.log("你与同门切磋武艺，身法体魄略有精进。厉飞雨笑你进境神速，直呼天才。", "good");
  },

  /* -------- 采买（集镇）-------- */
  buy(itemId) {
    const s = State.data;
    const shop = { lingcao: 3, duyao_cao: 6, qingyuan_dan: 8, huixue_dan: 6, ningshen_dan: 14 };
    const price = shop[itemId];
    if (!price) return;
    if (s.silver < price) { this.toast("纹银不足", true); return; }
    s.silver -= price;
    State.give(itemId, 1);
    this.log(`你花了 ${price} 两纹银，购得「${DATA.items[itemId].name}」。`, "event");
    State.save();
    UI.renderAll();
    UI.openMarket();
  },

  /* -------- 炼药（药庐，从简）-------- */
  alchemy() {
    const s = State.data;
    if (State.count("lingcao") < 2) { this.toast("缺少灵草（需2）", true); return; }
    this.passTime(WORLD.activities.alchemy.timeCost);
    State.take("lingcao", 2);
    State.give("qingyuan_dan", 1);
    this.log("你依墨大夫所授丹方，以灵草炼出一枚养元丹。", "good");
  },

  /* -------- 探查（密室，推进张铁/夺舍线索）-------- */
  investigate() {
    const s = State.data;
    this.passTime(WORLD.activities.investigate.timeCost);
    s.flags.investigated = (s.flags.investigated || 0) + 1;
    s.demon = clamp(s.demon + 5, 0, 100);
    this.log("你借着夜色潜入密室周遭探查，所见种种，令你愈发心惊。", "bad");
  },

  /* -------- 闭关修炼：修为主要来源。months=闭关时长（月）-------- */
  cultivate(months) {
    const s = State.data;
    const root = State.root();
    const realm = State.realm();
    if (s.spirit < 15) {
      this.log("灵力枯竭，难以入定。你勉强收功，不得寸进。", "bad");
      this.rest(true);
      return;
    }
    // months: 闭关时长（月）。时长越久，修为越多，但耗时（寿元）也越多，心境/心魔波动更大。
    months = Math.max(1, months || 1);
    this.passTime(months);

    // 单月基础修为 = 基数 * 灵根系数，受心境/心魔影响
    const base = 14 + Math.floor(s.sense * 0.4);
    const moodFactor = 0.6 + (s.mood / s.moodMax) * 0.6;
    const demonPenalty = 1 - (s.demon / 200);
    const perMonth = Math.max(1, Math.round(base * root.cul * moodFactor * demonPenalty));
    let gain = perMonth * months;

    // 心境告急：心乱则修为难进、心魔易侵（杂念丛生，事倍功半）
    const lowMood = s.mood < s.moodMax * 0.35;
    if (lowMood) gain = Math.round(gain * 0.6);

    s.cultivation += gain;
    // 灵力随闭关消耗（封顶到当前上限）；长闭关后灵力近乎抽干
    s.spirit = clamp(s.spirit - 14 * months, 0, realm.spMax);
    // 心境随枯坐缓降，心魔随苦修渐生（时长越久越明显）
    s.mood = clamp(s.mood - 3 * months, 0, s.moodMax);
    // 心境告急时，走火入魔几率显著升高
    let demonChance = clamp(0.12 + months * 0.02, 0, 0.5);
    if (lowMood) demonChance += 0.25;
    if (Math.random() < demonChance) {
      s.demon = clamp(s.demon + 3 + Math.floor(months / 2), 0, 100);
    }

    const full = s.cultivation >= realm.culMax;
    const span = months >= 12 ? `闭关 ${(months / 12).toFixed(months % 12 ? 1 : 0)} 年` : `闭关 ${months} 月`;
    this.log(`你${span}，潜心苦修《长春功》。修为+${gain}。` +
      (lowMood ? "心绪不宁，杂念丛生，进境大打折扣——该去打坐调息了。" : "") +
      (full ? "丹田之内灵力已近圆满，似可尝试突破。" : ""), lowMood ? "bad" : (full ? "good" : "event"));
    if (lowMood) Engine.toast("心境告急！闭关效率骤降，宜先打坐调息", true);

    // 闭关插曲：时长越久，越可能在静室中生变（顿悟 / 走火入魔 / 外界变故 / 灵感枯滞）
    this._seclusionInterlude(months, gain);
  },

  // 闭关插曲（体现"闭关是孤注一掷的赌博"）
  _seclusionInterlude(months, gain) {
    const s = State.data;
    if (months < 6) return;                       // 短闭关无插曲
    const chance = clamp(0.25 + months * 0.02, 0, 0.7);
    if (Math.random() > chance) return;

    const roll = Math.random();
    if (roll < 0.30) {
      // 顿悟
      const bonus = Math.round(gain * 0.4) + 5;
      s.cultivation += bonus;
      if (Math.random() < 0.4) s.insight += 1;
      this.log("闭关插曲·顿悟：枯坐之中，你忽有所悟，《长春功》的运转豁然顺畅。修为额外+" + bonus + "，悟性或有精进。", "good");
    } else if (roll < 0.58) {
      // 走火入魔
      const dmg = Math.round(s.hpMax * (0.15 + months * 0.01));
      s.hp = clamp(s.hp - dmg, 1, s.hpMax);
      s.demon = clamp(s.demon + 10 + Math.floor(months / 3), 0, 100);
      this.log(`闭关插曲·走火入魔：苦修过深，灵力一时逆冲经脉！你气血翻涌(气血-${dmg})，心魔大涨。修仙岂能急于求成。`, "bad");
    } else if (roll < 0.80) {
      // 外界变故（被打断）
      s.mood = clamp(s.mood - 8, 0, s.moodMax);
      this.log("闭关插曲·外扰：静室之外似有动静，你不得不分神戒备，这一程闭关被搅得难以尽兴。", "sys");
    } else {
      // 灵感枯滞
      const loss = Math.round(gain * 0.2);
      s.cultivation = Math.max(0, s.cultivation - loss);
      this.log(`闭关插曲·枯滞：这段时日心绪不宁，进境远不如预期(修为-${loss})。修仙之路，本就时进时滞。`, "bad");
    }
  },

  // 由闭关时长选择器调用：执行闭关并做后续结算
  doCultivate(months) {
    const s = State.data;
    if (s.pendingEvent || s.combat) return;
    // 长闭关分段执行：心境将告急时自动收功，避免"一键到底反受其害"
    let remaining = Math.max(1, months);
    let done = 0;
    while (remaining > 0) {
      // 预估几个月后心境就会跌破警戒线
      const safeMonths = Math.max(1, Math.floor((s.mood - s.moodMax * 0.35) / 3));
      const step = Math.min(remaining, Math.max(1, safeMonths));
      this.cultivate(step);
      done += step;
      remaining -= step;
      if (s.combat || s.pendingEvent) break;          // 闭关插曲触发事件则中断
      if (s.mood < s.moodMax * 0.4 && remaining > 0) { // 心境见底，自动收功
        this.log(`你察觉心绪渐乱，及时收了功——再强撑下去，恐有走火入魔之险。（原拟闭关 ${months} 月，实修 ${done} 月）`, "sys");
        break;
      }
    }
    this.checkLifespan();
    this.checkStory();
    if (!s.pendingEvent && !s.combat && !this._pendingFortune) this._maybeInteraction();
    State.save();
    UI.renderAll();
  },

  /* -------- 外出历练：按当前地点的遭遇表抽取 -------- */
  adventure() {
    const s = State.data;
    this.passTime(DATA.actions.adventure.timeCost);
    s.flags.adventured = true;
    s.flags.adv_count = (s.flags.adv_count || 0) + 1;
    s.spirit = clamp(s.spirit - 6, 0, State.realm().spMax);

    // 低概率触发奇遇（悟性/神识略微提升触发率），不改主线
    if (this._tryFortune()) return;

    const loc = State.location();
    const table = (loc && loc.encounters && loc.encounters.length) ? loc.encounters : [
      { id: "nothing", weight: 1, kind: "none" },
    ];
    const enc = weightedPick(table);

    switch (enc.kind) {
      case "gather": {
        const n = 1 + Math.floor(Math.random() * 2);
        State.give("lingcao", n);
        this.log(`你在${loc.name}采得灵草 ×${n}，可投入小绿瓶催熟。`, "good");
        break;
      }
      case "gather_du": {
        State.give("duyao_cao", 1);
        if (Math.random() < 0.4) State.give("lingcao", 1);
        this.log(`你寻到一丛幽僻的毒草，小心采下 ×1——催熟后便是杀招的底牌。`, "good");
        break;
      }
      case "temper": {
        s.body += 1;
        s.mood = clamp(s.mood + 6, 0, s.moodMax);
        this.log(`你在演武厅与同门拆招过手，体魄+1，筋骨舒展，心境也松快了几分。`, "good");
        break;
      }
      case "find_anqi": {
        const n = 1 + Math.floor(Math.random() * 2);
        State.give("anqi", n);
        this.log(`集镇铁匠铺新到一批精铁飞针，你买了几支傍身（暗器 ×${n}）。`, "good");
        break;
      }
      case "reward": {
        const silver = 2 + Math.floor(Math.random() * 4);
        s.silver += silver;
        this.log(`你在${loc.name}拾得些散碎物什，换得纹银 ${silver} 两。`, "good");
        break;
      }
      case "market":
        this.log("集镇商贩向你兜售丹药材料，你可在此采买。", "sys");
        break;
      case "rumor":
        this.log(this._randomRumor(), "sys");
        break;
      case "npc": {
        const npc = WORLD.randomNpc ? WORLD.randomNpc(loc.id, s) : null;
        if (npc) {
          if (!s.metNpcs) s.metNpcs = [];
          if (npc.id && !s.metNpcs.includes(npc.id)) s.metNpcs.push(npc.id);
          const line = (npc.lines && npc.lines.length) ? npc.lines[Math.floor(Math.random() * npc.lines.length)] : (npc.line || "");
          this.log(`你在${loc.name}遇见「${npc.name}」（${npc.role}）。${line ? npc.name + "道：「" + line + "」" : ""}`, "event");
        } else this.log("路上人来人往，并无相熟之人。", "sys");
        break;
      }
      case "story_hint":
        this.log("演武厅中，厉飞雨拉着你比试拳脚，你愈发觉得这门派的日子并不简单。", "event");
        break;
      case "fight": {
        this.startEncounterFight(enc.enemy);
        return; // 进入战斗，暂不结算后续
      }
      default:
        State.give("lingcao", 1);
        this.log("一路走走停停，你顺手采了株灵草，不虚此行。", "sys");
    }
  },

  _randomRumor() {
    const rumors = [
      "市井传闻：七玄门近来有弟子离奇失踪，门中讳莫如深。",
      "茶馆听闻：修仙之人寿元悠长，凡人却如蝼蚁，朝生暮死。",
      "有人低声议论，说墨大夫的医术，邪门得不像活人能有的。",
      "传言筑基丹千金难求，练气修士穷其一生也未必能得一枚。",
    ];
    return rumors[Math.floor(Math.random() * rumors.length)];
  },

  /* -------- 奇遇系统 -------- */
  _tryFortune() {
    const s = State.data;
    if (typeof FORTUNES === "undefined") return false;
    const loc = s.location;
    s.firedFortunes = s.firedFortunes || [];
    // 候选：地点匹配、未触发过的 once、满足 cond
    const pool = FORTUNES.filter(f => {
      if (f.where && !f.where.includes(loc)) return false;
      if (f.once && s.firedFortunes.includes(f.id)) return false;
      if (f.cond && !f.cond(s)) return false;
      return true;
    });
    if (!pool.length) return false;
    // 触发率：基础 22%，受悟性/神识轻微提升
    const baseChance = 0.22 + clamp((s.insight + s.sense) * 0.004, 0, 0.15);
    if (Math.random() > baseChance) return false;

    const f = weightedPick(pool);
    this._pendingFortune = f;
    if (f.once) s.firedFortunes.push(f.id);
    UI.openFortune(f);
    State.save();
    return true;
  },

  // 玩家在奇遇中做出选择
  chooseFortune(choiceIndex) {
    const f = this._pendingFortune;
    if (!f) return;
    const s = State.data;
    const choice = f.choices[choiceIndex];
    if (!choice) return;
    if (choice.cond && !choice.cond(s)) { this.toast("条件不足，无法如此"); return; }
    const result = choice.effect ? choice.effect(s) : { text: "", kind: "event" };
    this._pendingFortune = null;
    this.log(`【奇遇·${f.title}】${result.text}`, result.kind || "event");
    UI.closeModal();
    this.checkLifespan();
    this.checkStory();
    State.save();
    UI.renderAll();
  },

  /* -------- 打坐调息：恢复 -------- */
  rest(silent = false) {
    const s = State.data;
    const realm = State.realm();
    this.passTime(DATA.actions.rest.timeCost);
    s.spirit = clamp(s.spirit + Math.round(realm.spMax * 0.5), 0, realm.spMax);
    s.hp = clamp(s.hp + 25, 0, s.hpMax);
    s.mood = clamp(s.mood + 12, 0, s.moodMax);
    s.demon = clamp(s.demon - 6, 0, 100);
    if (!silent) this.log("你盘膝打坐，调息养神。灵力、气血与心境皆有恢复。", "event");
  },

  /* -------- 突破成功率计算（本篇仅练气层间小突破）-------- */
  breakthroughRate() {
    const s = State.data;
    const root = State.root();
    const realm = State.realm();
    const culRatio = clamp(s.cultivation / realm.culMax, 0, 1.5);
    let rate = 0.15 + culRatio * 0.55;          // 修为越满越稳
    rate += root.breakBonus;                     // 灵根资质
    rate += (s.mood / s.moodMax) * 0.15;         // 心境
    rate -= (s.demon / 100) * 0.25;              // 心魔拖累
    if (s.spirit < realm.spMax * 0.8) rate -= 0.15; // 灵力不足
    return clamp(rate, 0.02, 0.95);
  },

  // 是否已达本篇境界上限（封锁更高境界）
  atRealmCap() { return State.data.realmIndex >= Chapters.realmCap(); },

  canBreakthrough() {
    const s = State.data;
    const realm = State.realm();
    if (this.atRealmCap()) return { ok: false, reason: "本篇封顶练气期。筑基乃后话，需「筑基丹」与机缘，黄枫谷篇再续。" };
    if (s.cultivation < realm.culMax * 0.6) return { ok: false, reason: "修为尚浅，强行突破必败。再多苦修些时日。" };
    return { ok: true };
  },

  /* -------- 执行突破：进入「与瓶颈心魔」的突破战 -------- */
  attemptBreakthrough() {
    this.passTime(1);
    this.startBreakthroughFight();
  },

  // 突破战结果结算
  _resolveBreakthroughResult(win) {
    const s = State.data;
    if (win) {
      s.realmIndex += 1;
      const nr = State.realm();
      s.cultivation = 0;
      s.spirit = nr.spMax;
      s.sense += 3; s.body += 2;
      s.hpMax += 15; s.hp = s.hpMax;
      if (nr.lifespan) s.lifespan += nr.lifespan;
      s.demon = clamp(s.demon - 5, 0, 100);
      this.log(`灵力冲关，经脉拓宽，心魔被你一举降伏——你成功突破至「${nr.name}」！`, "good");
      this.toast(`突破成功：${nr.name}`);
      this.checkStory();
    } else {
      const loss = Math.round(s.cultivation * 0.3);
      s.cultivation = Math.max(0, s.cultivation - loss);
      const dmg = 15 + Math.floor(Math.random() * 15);
      s.hp = clamp(s.hp - dmg, 1, s.hpMax);
      s.demon = clamp(s.demon + 12, 0, 100);
      s.mood = clamp(s.mood - 15, 0, s.moodMax);
      this.log(`心魔未能降伏，灵力逆冲——突破失败！修为-${loss}，气血-${dmg}，心魔滋长。`, "bad");
      this.toast("突破失败，反受其害", true);
    }
  },

  /* ===========================================================
   *  战斗会话（接入 combat.js 引擎）
   * =========================================================== */
  // 用玩家当前状态构造战斗者
  playerFighter() {
    const s = State.data;
    const realm = State.realm();
    const culRatio = clamp(s.cultivation / realm.culMax, 0, 1.2);
    const gongli = Balance.gongli({ tier: realm.tier, layer: realm.layer, culRatio, sense: s.sense, body: s.body });
    return new CombatAPI.Fighter({
      name: s.name,
      hp: s.hp,
      sense: s.sense,
      speed: s.speed,
      insight: s.insight,
      gongli: gongli,
      agility: Math.round(s.speed * 0.6),   // 遁速提供基础闪避
      profile: "hanli_si",       // 四灵根·缺土
      spells: s.spells.slice(),
      technique: s.technique,     // 主修功法（影响同系招式）
      grade: (DATA.techniques[s.technique] || {}).grade || 1,  // 主修功法品阶
      realmTier: Chapters.realmTier(),   // 本章大境界序（影响法术成长）
      // 底牌：平时准备的毒草、暗器带进战斗（准备内化进战斗）
      pouch: { duyao_cao: State.count("duyao_cao"), anqi: State.count("anqi") },
    });
  },

  // 战斗结束后，把战中消耗的底牌写回主背包
  _syncPouchBack() {
    const c = this._combat;
    if (!c) return;
    const p = c.player.pouch || {};
    ["duyao_cao", "anqi"].forEach(id => {
      const left = p[id] || 0;
      const had = State.count(id);
      if (left < had) State.take(id, had - left);
    });
  },

  // 普通遭遇战
  startEncounterFight(enemyId) {
    const tmpl = WORLD.enemies[enemyId];
    if (!tmpl) { this.log("虚惊一场，并无敌踪。", "sys"); return; }
    const enemy = Object.assign({}, tmpl);
    this._combat = new CombatAPI.Combat({
      player: this.playerFighter(),
      enemies: [enemy],
      maxRounds: 20,
    });
    this._combatMeta = { type: "encounter", reward: tmpl.reward, enemyName: tmpl.name };
    State.data.combat = true;
    this._combat.startRound();
    this.log(`你在${State.location().name}遭遇「${tmpl.name}」，斗法一触即发！`, "bad");
    UI.openCombat(this._combat, this._combatMeta);
  },

  // 决战墨大夫：三阶段波次。准备（毒、暗器）内化为战斗底牌——带得越多越能赢
  startShowdownFight() {
    const s = State.data;
    const player = this.playerFighter();
    player.hp = s.hpMax; player.hpMax = s.hpMax; // 决战前默认满血上场

    const modafu = { name: "墨大夫", hp: 52, profile: "modafu", sense: 6, speed: 9, agility: 4,
      attacks: [{ name: "毒掌", dmg: 12, kind: "normal" }, { name: "腐骨毒针", dmg: 14, pierce: true, kind: "pierce" }] };
    const tienu  = { name: "铁奴（张铁尸傀）", hp: 70, immunePoison: true, sense: 3, speed: 6, agility: 4,
      attacks: [{ name: "尸傀挥击", dmg: 14, kind: "normal" }, { name: "崩山重捶", dmg: 19, kind: "charge" }] };
    const yuhun  = { name: "余子童元神", hp: 48, soulOnly: true, sense: 18, speed: 14, agility: 8, gongli: 22, atkName: "夺舍", atk: 15 };

    this._combat = new CombatAPI.Combat({
      player,
      enemies: [modafu],
      waves: [[tienu], [yuhun]],
      maxRounds: 16,
    });

    this._combatMeta = { type: "showdown" };
    s.combat = true;
    this._combat.startRound();
    const duCount = State.count("duyao_cao"), anCount = State.count("anqi");
    this.log(`夺舍之夜，决战开始！你怀揣 毒草×${duCount}、暗器×${anCount} 作底牌——能否反杀，全看准备。`, "event");
    UI.openCombat(this._combat, this._combatMeta);
  },

  // 反杀金光上人：金钟罩护身（高护体），唯有毒+暗器破之
  startJinguangFight() {
    const s = State.data;
    const player = this.playerFighter();
    player.hp = s.hpMax; player.hpMax = s.hpMax;

    // 金光上人：修仙杀手，金钟罩护体厚、攻击高；怕毒（持续伤害可绕过金钟罩续航）
    const jinguang = {
      name: "金光上人", hp: 120, profile: "common", sense: 14, speed: 13, agility: 10,
      attacks: [
        { name: "金符破空", dmg: 18, kind: "normal" },
        { name: "剑符斩", dmg: 22, pierce: true, kind: "pierce" },
        { name: "金刚伏魔", dmg: 24, kind: "charge" },
      ],
    };
    this._combat = new CombatAPI.Combat({
      player,
      enemies: [jinguang],
      maxRounds: 18,
    });
    // 金钟罩护体：开局即有厚护盾，暗器(破甲)与毒(持续)是破局关键
    this._combat.enemies[0].shield = 40;

    this._combatMeta = { type: "jinguang" };
    s.combat = true;
    this._combat.startRound();
    const duCount = State.count("duyao_cao"), anCount = State.count("anqi");
    this.log(`金光上人金钟罩护身，寻常攻击难伤分毫！你怀 毒草×${duCount}、暗器×${anCount}——以毒续伤、以暗器破甲，方有胜机。`, "event");
    UI.openCombat(this._combat, this._combatMeta);
  },

  // 突破战：与瓶颈心魔对战（复用战斗引擎）
  startBreakthroughFight() {
    const s = State.data;
    const realm = State.realm();
    const nextRealm = DATA.realms[s.realmIndex + 1];

    // 准备越充分 → 瓶颈越薄、可战回合越多、道心(hp)越足
    const culRatio = clamp(s.cultivation / realm.culMax, 0, 1.2);
    const bottleneckHp = Math.round(40 + s.realmIndex * 14 - culRatio * 22);
    const daoxin = Math.round(40 + (s.mood / s.moodMax) * 40 - (s.demon / 100) * 25);
    const rounds = 6 + Math.floor((s.spirit / realm.spMax) * 4) - Math.floor(s.demon / 25);

    const player = this.playerFighter();
    player.hp = Math.max(20, daoxin); player.hpMax = player.hp;

    this._combat = new CombatAPI.Combat({
      player,
      enemies: [{ name: `${nextRealm ? nextRealm.name : "瓶颈"}·心魔`, hp: Math.max(20, bottleneckHp),
                  sense: 5, agility: 0, atkName: "心魔反噬", atk: 9 }],
      maxRounds: Math.max(4, rounds),
      mode: "breakthrough",
    });
    this._combatMeta = { type: "breakthrough" };
    s.combat = true;
    this._combat.startRound();
    this.log(`你引动灵力冲击「${nextRealm ? nextRealm.name : "瓶颈"}」的瓶颈，心魔随之浮现——突破即一场心战！`, "event");
    UI.openCombat(this._combat, this._combatMeta);
  },

  // 玩家在战斗中施法
  combatCast(spellId, targetIndex) {
    if (!this._combat) return;
    const r = this._combat.cast(spellId, targetIndex);
    if (!r.ok) { this.toast(r.reason); return; }
    if (typeof UI !== "undefined" && UI.flushCombatFx) UI.flushCombatFx(this._combat);
    if (typeof UI !== "undefined" && UI.flashCombat) UI.flashCombat();
    if (this._combat.status !== "ongoing") this._finishCombat();
    else UI.renderCombat(this._combat, this._combatMeta);
  },

  // 结束当前回合（敌方行动 + 状态结算）
  combatEndRound() {
    if (!this._combat) return;
    this._combat.endRound();
    if (typeof UI !== "undefined" && UI.flushCombatFx) UI.flushCombatFx(this._combat);
    if (this._combat.status !== "ongoing") { this._finishCombat(); return; }
    this._combat.startRound();
    UI.renderCombat(this._combat, this._combatMeta);
  },

  // 战斗结束结算
  _finishCombat() {
    const s = State.data;
    const c = this._combat;
    const meta = this._combatMeta;
    const win = c.status === "win";
    s.combat = false;

    // 同步战中消耗的底牌（毒、暗器）回主背包
    this._syncPouchBack();

    // 同步玩家气血回主状态（突破是"道心"，不回写气血）
    if (meta.type !== "breakthrough") {
      s.hp = clamp(Math.round(c.player.hp), 0, s.hpMax);
    }

    UI.closeCombat();

    if (meta.type === "encounter") {
      if (win) {
        if (meta.reward) {
          Object.entries(meta.reward).forEach(([k, v]) => {
            if (k === "silver") { s.silver += v; this.log(`战胜「${meta.enemyName}」，得纹银 ${v} 两。`, "good"); }
            else { State.give(k, v); this.log(`战胜「${meta.enemyName}」，获「${DATA.items[k] ? DATA.items[k].name : k}」×${v}。`, "good"); }
          });
        } else this.log(`你击退了「${meta.enemyName}」。`, "good");
      } else {
        const dmg = Math.round(s.hpMax * 0.2);
        s.hp = clamp(s.hp - dmg, 1, s.hpMax);
        s.demon = clamp(s.demon + 8, 0, 100);
        this.log(`你不敌「${meta.enemyName}」，负伤遁走（气血-${dmg}）。`, "bad");
      }
    } else if (meta.type === "showdown") {
      if (win) {
        State.setFlag("modafu_dead");
        this.log("墨大夫毒发倒地，铁奴被你击碎，余子童的元神也被你以功力生生镇灭！你赢了——靠的是准备、算计与一刻不敢松懈的苦修。", "good");
        s.mood = clamp(s.mood + 12, 0, s.moodMax);
        s.storyStage += 1;
        this.checkStory();
      } else {
        const dmg = Math.round(s.hpMax * 0.5);
        s.hp = clamp(s.hp - dmg, 1, s.hpMax);
        s.demon = clamp(s.demon + 20, 0, 100);
        this.log(`决战失利，你身受重伤(气血-${dmg})狼狈遁走。修仙之路从无侥幸——回去多备毒草暗器、精进修为再来！`, "bad");
        s.pendingEvent = "showdown";
        UI.renderStory(STORY[s.storyStage]);
      }
    } else if (meta.type === "jinguang") {
      if (win) {
        State.setFlag("jinguang_dead");
        State.give("jinfu", 1);
        State.give("jinzhong_zhao", 1);
        this.log("金光上人金钟罩虽固，终究敌不过你的毒与暗器。这矮胖和尚至死不信，自己竟栽在一个门派药师手里！七玄门之危，就此解去。", "good");
        s.mood = clamp(s.mood + 12, 0, s.moodMax);
        s.storyStage += 1;
        this.checkStory();
      } else {
        const dmg = Math.round(s.hpMax * 0.5);
        s.hp = clamp(s.hp - dmg, 1, s.hpMax);
        s.demon = clamp(s.demon + 18, 0, 100);
        this.log(`你低估了金光上人的金钟罩，反被其重创(气血-${dmg})，狼狈遁走。须多备毒草暗器、以毒续伤、以暗器破甲，再寻战机！`, "bad");
        s.pendingEvent = "jinguang_fight";
        UI.renderStory(STORY[s.storyStage]);
      }
    } else if (meta.type === "breakthrough") {
      this._resolveBreakthroughResult(win);
    }
    this._combat = null;
    this._combatMeta = null;
    this.checkLifespan();
    State.save();
    UI.renderAll();
  },

  /* -------- 服食丹药 / 使用物品 -------- */
  useItem(itemId) {
    const item = DATA.items[itemId];
    if (!item || item.type !== "pill") { this.toast("此物不可服用"); return; }
    if (!State.count(itemId)) return;
    const s = State.data;
    const realm = State.realm();
    const e = item.effect || {};
    if (e.sp) s.spirit = clamp(s.spirit + e.sp, 0, realm.spMax);
    if (e.hp) s.hp = clamp(s.hp + e.hp, 0, s.hpMax);
    if (e.mood) s.mood = clamp(s.mood + e.mood, 0, s.moodMax);
    if (e.demon) s.demon = clamp(s.demon + e.demon, 0, 100);
    if (e.cul) s.cultivation += e.cul;
    State.take(itemId, 1);
    this.log(`你服下「${item.name}」。`, "good");
    this.checkStory();
    State.save();
    UI.renderAll();
  },

  /* ===========================================================
   *  神秘小绿瓶
   * =========================================================== */
  unlockBottle() {
    const s = State.data;
    if (!s.bottle.plots.length) {
      for (let i = 0; i < DATA.bottle.plotCount; i++) s.bottle.plots.push({ crop: null, growth: 0 });
    }
    UI.showBottleButton();
  },
  plantCrop(plotIndex, cropId) {
    const s = State.data;
    const crop = DATA.bottle.crops[cropId];
    if (!crop) return;
    if (!State.take(crop.seed, 1)) { this.toast("缺少种子原料"); return; }
    s.bottle.plots[plotIndex] = { crop: cropId, growth: 0 };
    this.log(`你将${DATA.items[crop.seed].name}投入小绿瓶培育。`, "event");
    State.save();
    UI.renderBottle();
    UI.renderAll();
  },
  tendBottle() {
    const s = State.data;
    this.passTime(1);
    let any = false;
    s.bottle.plots.forEach(p => {
      if (p.crop && p.growth < 100) {
        p.growth = clamp(p.growth + DATA.bottle.catalyzePerAction, 0, 100);
        any = true;
      }
    });
    if (any) this.log("你滴入小绿瓶中的神秘绿液，瓶内草木以肉眼可见之速抽长。", "good");
    else this.log("小绿瓶内空空如也，无物可催。", "sys");
    this.checkStory();
    State.save();
    UI.renderBottle();
    UI.renderAll();
  },
  harvestCrop(plotIndex) {
    const s = State.data;
    const p = s.bottle.plots[plotIndex];
    if (!p.crop || p.growth < 100) return;
    const crop = DATA.bottle.crops[p.crop];
    State.give(crop.matureItem, crop.yield);
    this.log(`小绿瓶催熟之物已成，你收获「${DATA.items[crop.matureItem].name}」×${crop.yield}。`, "good");
    s.bottle.plots[plotIndex] = { crop: null, growth: 0 };
    State.save();
    UI.renderBottle();
    UI.renderAll();
  },

  /* ===========================================================
   *  剧情推进
   * =========================================================== */
  checkStory() {
    const s = State.data;
    if (s.pendingEvent) return;
    const next = STORY[s.storyStage];
    if (!next) return;
    // 阶段 0 无 cond，直接触发；其余需满足 cond
    if (next.cond && !next.cond(s)) return;
    // 地点门禁：若该阶段指定了触发地点，须身在其处（开放世界——走到对的地方剧情才发生）
    if (next.where && next.where !== s.location) return;
    this.playStage(next);
  },

  // 当前际遇指引：告诉玩家下一段主线的触发条件（开放世界的"目标"提示）
  currentObjective() {
    const s = State.data;
    if (s.pendingEvent) return null;
    const next = STORY[s.storyStage];
    if (!next) return { title: "逍遥自在", hint: "本篇主线已了，你可继续自由修行。" };
    const condOk = !next.cond || next.cond(s);
    const locName = next.where ? (WORLD.locations.find(l => l.id === next.where) || {}).name : null;
    if (!condOk) {
      return { title: next.objTitle || "静待时机", hint: next.objHint || "继续修炼、历练，时机未到。" };
    }
    if (next.where && next.where !== s.location) {
      return { title: next.objTitle || "前往", hint: `时机已至——前往「${locName}」即有际遇。` };
    }
    return { title: next.objTitle || "际遇将至", hint: "条件已足，留意眼前之事。" };
  },
  playStage(stage) {
    const s = State.data;
    s.pendingEvent = stage.id;
    if (stage.onArrive) stage.onArrive(s);
    UI.renderStory(stage);
    State.save();
    UI.renderAll();
  },
  // 玩家在剧情选项上做出选择
  chooseStory(stage, choiceIndex) {
    const s = State.data;
    const choice = stage.choices[choiceIndex];

    // 需要特定物品的选项
    if (choice.requireItem && !State.count(choice.requireItem)) {
      this.toast(`需要：${DATA.items[choice.requireItem].name}`, true);
      return;
    }
    // 特殊结算（决战）：进入真正的三阶段战斗
    if (choice.resolve === "showdown_win" || choice.resolve === "showdown_risk") {
      s.pendingEvent = null;
      this.startShowdownFight();
      return;
    }
    // 反杀金光上人
    if (choice.resolve === "jinguang_win") {
      s.pendingEvent = null;
      this.startJinguangFight();
      return;
    }

    // 普通推进
    s.pendingEvent = null;
    s.storyStage += 1;
    if (choice.next === "end") { this.endArc(); return; }
    this.checkStory();   // 链式触发下一段（若条件已满足）
    State.save();
    UI.renderAll();
    UI.clearStory();
  },

  /* -------- 决战墨大夫：已改为真实三阶段战斗（见 startShowdownFight / _finishCombat）-------- */

  endArc() {
    State.data.pendingEvent = null;
    State.save();
    UI.renderAll();
    UI.clearStory();
    UI.openModal(`
      <h2>七玄门篇 · 通关</h2>
      <p>韩立以四灵根之资，靠苦修、算计与小绿瓶，斩杀墨大夫，带着曲魂离开七玄门。</p>
      <p>这正是《凡人修仙传》的底色——凡人无天资，唯以谨慎与万全准备，步步为营，逆天改命。</p>
      <p style="color:var(--ink-dim);font-size:13px">后续章节（黄枫谷篇 · 筑基之路）将在此基础上继续开发。你的存档已保留，可继续自由修炼。</p>
      <div class="modal-actions">
        <button class="btn btn-primary" onclick="UI.closeModal()">继续游玩</button>
      </div>
    `);
  },

  /* -------- 寿元 / 死亡检查 -------- */
  checkLifespan() {
    const s = State.data;
    if (s.age >= s.lifespan) {
      this.gameOver("寿元耗尽，你终究没能跳出这凡俗的生死。一缕道心，散于天地之间。");
    } else if (s.hp <= 0) {
      this.gameOver("你气血耗尽，身死道消。");
    }
  },
  gameOver(reason) {
    UI.openModal(`
      <h2>身死道消</h2>
      <p>${reason}</p>
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick="Main.toCreate()">重入轮回</button>
      </div>
    `);
  },
};

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function weightedPick(table) {
  const total = table.reduce((a, e) => a + (e.weight || 1), 0);
  let r = Math.random() * total;
  for (const e of table) { r -= (e.weight || 1); if (r <= 0) return e; }
  return table[table.length - 1];
}

window.Engine = Engine;
