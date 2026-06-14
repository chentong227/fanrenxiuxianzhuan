/* ============================================================
 * engine.js — 游戏核心逻辑：行动、时间、突破、剧情推进、结算
 * ============================================================ */

const Engine = {
  /* -------- 叙事日志 -------- */
  log(text, kind = "event", meta = null) {
    const s = State.data;
    const id = (this._logSeq = (this._logSeq || 0) + 1);
    const entry = { id, t: `第${s.year}年${s.month}月`, body: text, kind };
    s.log.push(entry);
    if (s.log.length > 60) s.log.shift();
    UI.renderNarrative();
    // 叙述层（可选）：若启用 LLM，异步润色这条日志，回来后替换文字（失败则保留模板，玩家无感）
    if (meta && typeof LLM !== "undefined" && LLM.enabled()) {
      LLM.embellish(entry, meta, () => { UI.renderNarrative(); State.save(); });
    }
    return entry;
  },
  toast(msg, bad = false) { UI.toast(msg, bad); },

  // 据点在场人物的专属对话主题（一次性主题谈过即不再出现，杜绝刷道具/属性）
  dialogueTopic(npcId, idx) {
    const s = State.data;
    if (s.pendingEvent || s.combat) { this.toast("先处理眼前之事"); return; }
    if (typeof DIALOGUE === "undefined") return;
    const topics = DIALOGUE.forNpc(npcId, s);
    const t = topics[idx];
    if (!t) return;
    if (t.cond && !t.cond(s)) { this.toast("此时无法如此"); return; }
    const r = t.effect ? t.effect(s) : { text: "", kind: "event" };
    if (t.once) DIALOGUE.markDone(s, npcId, t.id);
    const n = (typeof WORLD !== "undefined" && WORLD.npcById) ? WORLD.npcById(npcId) : null;
    this.log(`【${n ? n.name : npcId}】${r.text}`, r.kind || "event");
    if (typeof UI !== "undefined" && UI.closeModal) UI.closeModal();
    this.checkLifespan();
    this.checkStory();
    State.save();
    if (typeof UI !== "undefined" && UI.renderAll) UI.renderAll();
  },

  // 结识 NPC：首次相遇给出明确反馈（toast + 叙事 + 录入图鉴）
  meetNpc(id, line) {
    const isNew = State.meetNpc(id);
    if (!isNew) return false;
    const npc = (typeof WORLD !== "undefined" && WORLD.npcById) ? WORLD.npcById(id) : null;
    const name = npc ? npc.name : id;
    const role = npc && npc.role ? `（${npc.role}）` : "";
    this.log(`【结识】你结识了「${name}」${role}。${line || ""}　——已录入「人物图鉴」。`, "event");
    this.toast(`结识新的人物：${name}`);
    return true;
  },

  /* -------- 时间流逝（以月为单位）-------- */
  passTime(months) {
    const s = State.data;
    s.month += months;
    while (s.month > 12) { s.month -= 12; s.year += 1; s.age += 1; }
    s.mood = clamp(s.mood + 1, 0, s.moodMax);
    // B1 战外恢复（世界层）：气血/灵力随时间吐纳自养，逐月回复。
    // 「战斗内灵力不自动回」是刻意设定——此处只动战斗外世界层；
    // 闭关的灵力抽干在 secludeCultivate 内单独结算（耗 14/月），足以盖过此处回复。
    const _rRecover = State.realm();
    s.hp = clamp(s.hp + Math.round(s.hpMax * 0.30 * months), 0, s.hpMax);
    if (_rRecover && _rRecover.spMax) {
      s.spirit = clamp(s.spirit + Math.round(_rRecover.spMax * 0.20 * months), 0, _rRecover.spMax);
    }
    // 墨府客居计时：住下些时日，独霸山庄才会找上门（离门远行·嘉元城）
    if (s.location === "jiayuan_city" && s.flags.mo_met && !s.flags.ouyang_dead) {
      s.flags.mo_months = (s.flags.mo_months || 0) + months;
    }
    // 世界不会因你停步：推进世间修士的命途
    this._tickWorld(months);
    // 异闻链：身在彩霞山一带，山野风声随月份酝酿（听闻→寻踪→相遇）
    this._tickBeastRumor(months);
    // 时间推进后检查到期的任务与预定事件
    this._checkSchedule();
  },

  // 世间百态：随时间流动的氛围事件（野狼帮/门派/市井三条线，只造氛围不改数值）
  _AMBIENT_EVENTS: [
    { cond: (s) => !s.flags.jinguang_dead, text: "听闻野狼帮又吞了一家镖局，山下商旅背地里骂声载道。" },
    { cond: (s) => !s.flags.jinguang_dead, text: "集镇酒肆里有人压低声音说，野狼帮在招揽亡命之徒，开的价钱不低。" },
    { cond: (s) => s.flags.gang_war, text: "七玄门与野狼帮的梁子越结越深，山下行人入夜便不敢出门。" },
    { cond: () => true, text: "门中贴出告示：后山深处近来有凶兽伤人，弟子结伴方可入山。" },
    { cond: () => true, text: "几名外门弟子因私斗被罚去担水三月，门规面前没人讲情面。" },
    { cond: () => true, text: "市集上新到了一批南边的药材，价钱压得很低，药铺掌柜们脸色难看。" },
    { cond: () => true, text: "听说邻县遭了蝗灾，逃难的人拖家带口往这边来，镇口多了不少生面孔。" },
    { cond: () => true, text: "山道上的老茶棚换了新主人，旧主人据说进山采药，再没回来。" },
    { cond: (s) => s.bottle && s.bottle.unlocked, text: "坊间又在传某位散修捡了天大机缘、一步登天的故事。你听着，只是笑笑。" },
    { cond: () => true, text: "夜里落了头场霜，门中老人说，今年的冬天会比往年冷。" },
  ],
  _tickAmbient(months) {
    const s = State.data;
    if (!s.worldNews) s.worldNews = [];
    const chance = clamp(0.06 * months, 0, 0.5);
    if (Math.random() > chance) return;
    const pool = this._AMBIENT_EVENTS.filter(e => !e.cond || e.cond(s));
    if (!pool.length) return;
    const ev = pool[Math.floor(Math.random() * pool.length)];
    // 同文不连发
    if (s._lastAmbient === ev.text) return;
    s._lastAmbient = ev.text;
    s.worldNews.push({ t: `第${s.year}年${s.month}月`, kind: "world", text: ev.text });
    if (s.worldNews.length > 40) s.worldNews.splice(0, s.worldNews.length - 40);
    // 三成概率浮到叙事日志（避免刷屏）
    if (Math.random() < 0.3) this.log("【世间】" + ev.text, "sys");
  },

  /* ===========================================================
   *  暗流涟漪链：大事不通报，分阶段渗透（流言→确证→可抓的窗口）
   * =========================================================== */
  _RIPPLES: [
    {
      id: "hunter_lost",
      stages: [
        { news: "坊间闲话：老猎户陈伯进山七八日了，还没见回来。家里人急得直哭。" },
        { news: "猎户陈伯的草鞋在后山涧边被人寻着了——人多半是没了。山里人叹：靠山吃山，也葬于山。" },
        { news: "有人说陈伯生前在后山深处拾掇了一片药园，如今成了无主之物……手快有，手慢无。", window: "herb_garden", windowMonths: 3,
          windowNote: "无主药园（后山·限时）" },
      ],
    },
    {
      id: "pill_theft",
      stages: [
        { news: "门里传开了：丹房昨夜失窃，丢了一批养元丹。管事们脸色铁青。" },
        { news: "失窃案有了眉目——竟是个外门弟子监守自盗，已被废了功夫逐出山门。" },
        { news: "那批赃丹几经转手流入了山下黑市，价钱压得极低。集镇的药贩子们闷声发财。", window: "cheap_pills", windowMonths: 3,
          windowNote: "黑市贱卖养元丹（集镇·限时）" },
      ],
    },
    {
      id: "wolf_draft",
      stages: [
        { news: "山下风声紧：野狼帮在挨村抽丁，青壮挨家被点名，不从者吃刀背。" },
        { news: "商路被野狼帮的关卡掐断了，集镇物价一日三涨，镖局的买卖也歇了。" },
        { news: "镖局贴出悬赏：剿杀野狼帮喽啰者，赏银十二两——刀口舔血的营生，干不干？", window: "wolf_bounty", windowMonths: 3,
          windowNote: "镖局悬赏剿匪（集镇·限时）" },
      ],
    },
  ],
  _tickRipples(months) {
    const s = State.data;
    // 窗口到期自动关闭
    if (s.rippleWindow && State.absMonth() > s.rippleWindow.dueAbs) {
      this.log("【涟漪】那桩限时的机会，随光阴一道溜走了。", "sys");
      s.rippleWindow = null;
    }
    // 推进活跃链
    if (s.ripple) {
      if (State.absMonth() >= s.ripple.nextAbs) {
        const chain = this._RIPPLES.find(r => r.id === s.ripple.id);
        if (!chain) { s.ripple = null; return; }
        s.ripple.stage += 1;
        const st = chain.stages[s.ripple.stage];
        if (!st) { s.doneRipples.push(chain.id); s.ripple = null; return; }
        s.worldNews = s.worldNews || [];
        s.worldNews.push({ t: `第${s.year}年${s.month}月`, kind: "rumor", text: st.news });
        this.log("【风声】" + st.news, "event");
        if (st.window) {
          s.rippleWindow = { id: st.window, dueAbs: State.absMonth() + (st.windowMonths || 3), note: st.windowNote };
          this.toast("限时机会出现（见际遇栏）");
          if (typeof Sfx !== "undefined") Sfx.play("chime");
          s.doneRipples.push(chain.id);
          s.ripple = null;
        } else {
          s.ripple.nextAbs = State.absMonth() + 1 + Math.floor(Math.random() * 2);
        }
      }
      return;
    }
    // 启动新链（无活跃链与窗口时低概率）
    if (s.rippleWindow) return;
    const pool = this._RIPPLES.filter(r => !(s.doneRipples || []).includes(r.id));
    if (!pool.length) return;
    if (Math.random() > Math.min(0.08 * months, 0.3)) return;
    const chain = pool[Math.floor(Math.random() * pool.length)];
    s.ripple = { id: chain.id, stage: 0, nextAbs: State.absMonth() + 1 + Math.floor(Math.random() * 2) };
    s.worldNews = s.worldNews || [];
    s.worldNews.push({ t: `第${s.year}年${s.month}月`, kind: "rumor", text: chain.stages[0].news });
    this.log("【风声】" + chain.stages[0].news, "sys");
  },
  // 窗口行动结算
  doRippleWindow(windowId) {
    const s = State.data;
    if (!s.rippleWindow || s.rippleWindow.id !== windowId) return;
    if (windowId === "herb_garden") {
      this.passTime(1);
      State.give("lingcao", 4); State.give("anqi", 2);
      s.skills.alchemy = (s.skills.alchemy || 0) + 2;
      this.log("【无主药园】你寻着陈伯生前的药园，仔细采撷——灵草×4、暗器×2（老猎户的防身物）。临走你朝山涧拜了一拜。（药理+2）", "good");
      s.rippleWindow = null;
      this.checkLifespan(); State.save(); UI.renderAll();
    } else if (windowId === "wolf_bounty") {
      this.log("【悬赏剿匪】你揭了镖局的赏格，循着线索堵住一伙野狼帮喽啰——", "event");
      this._bountyFight = true;
      this.startEncounterFight("wolf_gang_thug");
    }
  },

  // NPC 命途模拟：推进、收集风云录、偶尔向玩家播报重大事件
  _tickWorld(months) {
    const s = State.data;
    if (typeof NPCSIM === "undefined") return;
    if (!s.worldNews) s.worldNews = [];
    this._tickAmbient(months);
    this._tickRipples(months);
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
      this.log("【风云录】" + n.text, n.kind === "ascend" ? "good" : "bad",
        { label: "风云录传闻", prompt: "把这则世间修士的消息，写成一句更有沧桑感的江湖传闻（事实不变）：" + n.text, remember: true });
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
    this.flushNpcGifts();
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
    // 3) 动态请托/线索：到期清理
    this._checkDynamics();
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

  /* ===========================================================
   *  对谈的机制结果（TASK 10）
   *  红线：LLM 只提议"方向"（白名单 type），具体能否兑现、给多少、
   *        门槛与上限，全部由引擎在此裁决。越权一律驳回/夹紧。
   * =========================================================== */
  // 入口：由 UI 在每轮对谈拿到 LLM 的 effect 后调用
  // 返回 { note } 供对谈窗口内即时反馈（可为 null）
  resolveTalkEffect(npcId, effect) {
    if (!effect || effect.type === "none") return null;
    const s = State.data;
    const rel = (typeof INTERACTIONS !== "undefined") ? INTERACTIONS.relationOf(s, npcId) : 0;
    const npc = (typeof WORLD !== "undefined" && WORLD.npcById) ? WORLD.npcById(npcId) : null;
    const fromName = npc ? npc.name : "对方";
    try {
      if (effect.type === "intel") return this._talkIntel(s, npcId, fromName, rel, effect);
      if (effect.type === "mood") return this._talkMood(s, npcId, fromName, rel, effect);
      if (effect.type === "quest") return this._talkQuest(s, npcId, fromName, rel, effect);
    } catch (e) { /* 裁决出错则当作无结果，绝不崩游戏 */ }
    return null;
  },

  // 某 NPC「确实知道」的、且尚未被韩立听过的线索（供对谈白名单）
  knownLeadsFor(npcId) {
    if (typeof QUESTS === "undefined" || !QUESTS.leads) return [];
    const s = State.data;
    s.leads = s.leads || [];
    s.heardLeads = s.heardLeads || [];
    return QUESTS.leads.filter(L => {
      if (!L.source.includes(npcId)) return false;
      if (L.cond && !L.cond(s)) return false;
      if (s.heardLeads.includes(L.id)) return false;       // 已听过/未兑现的不重复给
      if (s.leads.some(x => x.id === L.id)) return false;
      return true;
    }).map(L => {
      const loc = (typeof WORLD !== "undefined" ? WORLD.locations : []).find(l => l.id === L.where) || {};
      return { id: L.id, title: L.title, whereName: loc.name || "别处" };
    });
  },

  // —— 情报：从 NPC 知道的线索白名单里点亮一条（leadId 由引擎校验）——
  _talkIntel(s, npcId, fromName, rel, effect) {
    s.leads = s.leads || [];
    s.heardLeads = s.heardLeads || [];
    const def = (typeof QUESTS !== "undefined" && QUESTS.leads) ? QUESTS.leads.find(L => L.id === effect.leadId) : null;
    // 校验：leadId 必须存在、该 NPC 确实知道、未听过、满足条件
    if (!def || !def.source.includes(npcId) || s.heardLeads.includes(def.id) || (def.cond && !def.cond(s))) return null;
    if (s.leads.length >= 4) return { note: "（线索已不少，先去查证一二再说。）" };
    const loc = (typeof WORLD !== "undefined" ? WORLD.locations : []).find(l => l.id === def.where) || {};
    s.leads.push({ id: def.id, npcId, fromName, where: def.where, title: def.title, dueAbs: State.absMonth() + 18 });
    s.heardLeads.push(def.id);
    this.log(`【线索】${fromName}向你透了底：${def.title}　——指向「${loc.name || "别处"}」，记入「际遇」。`, "event");
    this.toast("听到一条线索");
    if (typeof UI !== "undefined") UI.renderObjective && UI.renderObjective();
    return { note: `（记下了，或许该去「${loc.name || "别处"}」探查。）` };
  },

  // 玩家抵达线索地点时兑现（在 travelTo 后调用）
  _resolveLeadsAt(locId) {
    const s = State.data;
    if (!s.leads || !s.leads.length) return;
    const hit = s.leads.filter(l => l.where === locId);
    if (!hit.length) return;
    s.leads = s.leads.filter(l => l.where !== locId);
    for (const l of hit) {
      const def = (typeof QUESTS !== "undefined" && QUESTS.leads) ? QUESTS.leads.find(L => L.id === l.id) : null;
      const p = def ? def.payoff : null;
      // 该线索从"已听过"里移除，兑现后可再次被同人或他人提起（世界持续）
      s.heardLeads = (s.heardLeads || []).filter(id => id !== l.id);
      if (p && Math.random() < (p.chance != null ? p.chance : 0.7)) {
        if (p.give) for (const k of Object.keys(p.give)) State.give(k, p.give[k]);
        if (p.body) s.body += p.body;
        if (p.demon) s.demon = clamp(s.demon + p.demon, 0, 100);
        this.log(`【线索兑现】${p.log || "循着线索，你果然有所发现。"}`, p.demon ? "bad" : "good");
      } else {
        this.log(`【线索成空】你按${l.fromName}所说探查一番，却一无所获。江湖传言，本就半真半假。`, "sys");
      }
    }
    if (typeof UI !== "undefined") UI.renderObjective && UI.renderObjective();
  },

  // —— 心境：走心交谈真回心境/压心魔；话不投机则郁结 ——
  _talkMood(s, npcId, fromName, rel, effect) {
    if (effect.tone === "discord") {
      // 话不投机：心境略损、心魔微涨（不因闲聊就重罚）
      s.mood = clamp(s.mood - 4, 0, s.moodMax);
      s.demon = clamp(s.demon + 2, 0, 100);
      this.log(`你与${fromName}话不投机，几句下来心头横生郁结。（心境-4，心魔微长）`, "bad");
      return { note: "（这番话不欢而散，你胸中隐隐有些堵。）" };
    }
    // 走心宽慰：关系越好，开解越见效（引擎按关系给量）
    const amt = rel >= 18 ? 10 : (rel >= 6 ? 7 : 4);
    const dd = rel >= 18 ? 4 : 2;
    s.mood = clamp(s.mood + amt, 0, s.moodMax);
    s.demon = clamp(s.demon - dd, 0, 100);
    this.log(`一番推心置腹，${fromName}的话宽解了你不少。（心境+${amt}，心魔-${dd}）`, "good");
    return { note: `（这番交谈让你心境舒展了些。）` };
  },

  // —— 请托：NPC 委托办事 → 生成真任务（引擎从安全池选可兑现的差事）——
  _talkQuest(s, npcId, fromName, rel, effect) {
    s.dynQuests = s.dynQuests || [];
    if (s.dynQuests.length >= 2) return { note: "（你手上的托付还没办完，不好再应承。）" };
    if (s.dynQuests.some(q => q.npcId === npcId)) return { note: "（你已应下他一桩事，先办妥再说。）" };
    // 引擎从"可兑现差事"白名单里挑一个（LLM 的 ask 只作叙述包装）
    const tpl = this._pickQuestTemplate(s);
    if (!tpl) return { note: "（这忙眼下你帮不上，只得婉言。）" };
    const id = "dq_" + (this._dqSeq = (this._dqSeq || 0) + 1) + "_" + Date.now();
    const q = {
      id, npcId, fromName, kind: tpl.kind, need: tpl.need,
      title: tpl.title,
      desc: tpl.desc,
      reward: tpl.reward(rel),
      dueAbs: State.absMonth() + tpl.due,
    };
    s.dynQuests.push(q);
    this.log(`【请托·${q.title}】${fromName}托你办一件事：${q.desc}（期限 ${tpl.due} 月）`, "event");
    this.toast(`接下请托：${q.title}`);
    if (typeof UI !== "undefined") UI.renderObjective && UI.renderObjective();
    return { note: `（你应下了${fromName}的请托，记在「际遇」里了。）` };
  },

  // 可兑现差事白名单：每项都对应玩家在现有系统里真能完成的目标
  _pickQuestTemplate(s) {
    const pool = [
      {
        kind: "deliver_lingcao", title: "代采灵草", deliver: "凑齐灵草×3交付",
        desc: "替他采足三株灵草", need: 3, due: 8,
        cond: (st) => State.count("lingcao") >= 3,
        reward: (rel) => ({ silver: 8, favor: 8, take: { lingcao: 3 } }),
      },
      {
        kind: "deliver_pill", title: "求一炉丹", deliver: "炼一枚养元丹交付",
        desc: "替他炼一枚养元丹应急", need: 1, due: 10,
        cond: (st) => State.count("qingyuan_dan") >= 1,
        reward: (rel) => ({ silver: 6, favor: 10, lingshi: 1, take: { qingyuan_dan: 1 } }),
      },
      {
        kind: "deliver_duyao", title: "寻味毒草", deliver: "采毒草×2交付",
        desc: "替他寻两株趁手的毒草", need: 2, due: 8,
        cond: (st) => State.count("duyao_cao") >= 2,
        reward: (rel) => ({ silver: 5, favor: 7, take: { duyao_cao: 2 } }),
      },
    ];
    return pool[Math.floor(Math.random() * pool.length)];
  },

  // 玩家主动交付动态请托（UI 在「际遇」里点"交付"时调用）
  deliverDynQuest(id) {
    const s = State.data;
    const q = (s.dynQuests || []).find(x => x.id === id);
    if (!q) return;
    const tpl = (this._questTemplates || (this._questTemplates = {}));
    // 校验持有量
    const need = q.reward && q.reward.take ? q.reward.take : null;
    if (need) {
      for (const k of Object.keys(need)) {
        if (State.count(k) < need[k]) { this.toast("交付之物尚未备齐", true); return; }
      }
      for (const k of Object.keys(need)) State.take(k, need[k]);
    }
    if (q.reward.silver) s.silver += q.reward.silver;
    if (q.reward.lingshi) State.give("lingshi", q.reward.lingshi);
    if (q.reward.favor && typeof INTERACTIONS !== "undefined") INTERACTIONS.favor(s, q.npcId, q.reward.favor);
    s.dynQuests = s.dynQuests.filter(x => x.id !== id);
    const r = [];
    if (q.reward.silver) r.push(`纹银${q.reward.silver}两`);
    if (q.reward.lingshi) r.push(`灵石${q.reward.lingshi}`);
    r.push(`${q.fromName}的交情`);
    this.log(`【请托达成·${q.title}】你向${q.fromName}交付了所托之物，得${r.join("、")}。有来有往，情谊渐笃。`, "good");
    this.toast(`请托达成：${q.title}`);
    if (typeof UI !== "undefined") { UI.renderObjective && UI.renderObjective(); UI.renderAll && UI.renderAll(); }
    State.save();
  },

  // 动态请托是否可交付（持有量达标）
  dynQuestReady(q) {
    const need = q.reward && q.reward.take ? q.reward.take : null;
    if (!need) return true;
    return Object.keys(need).every(k => State.count(k) >= need[k]);
  },

  // 动态请托/线索的到期清理（在 _checkSchedule 里调用）
  _checkDynamics() {
    const s = State.data;
    const now = State.absMonth();
    if (s.dynQuests && s.dynQuests.length) {
      for (const q of s.dynQuests.slice()) {
        if (now >= q.dueAbs) {
          s.dynQuests = s.dynQuests.filter(x => x !== q);
          if (typeof INTERACTIONS !== "undefined") INTERACTIONS.favor(s, q.npcId, -5);
          this.log(`【请托逾期·${q.title}】你终究没能如期为${q.fromName}办妥此事，对方颇为失望。`, "bad");
        }
      }
    }
    if (s.leads && s.leads.length) {
      const now2 = State.absMonth();
      const live = s.leads.filter(l => now2 < l.dueAbs);
      if (live.length !== s.leads.length) {
        const expired = s.leads.filter(l => now2 >= l.dueAbs);
        s.heardLeads = (s.heardLeads || []).filter(id => !expired.some(e => e.id === id));
        this.log(`【线索过时】有些早年听来的线索，已随时移境迁化作过眼云烟。`, "sys");
        s.leads = live;
      }
    }
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
    else if (action === "fair") { UI.openFair(); return; }
    else if (action === "yaoyuan") { this.yaoyuanWork(); return; }
    else if (action === "wanbao") { UI.openWanbao(); return; }
    else if (action === "alchemy") this.alchemy();
    else if (action === "investigate") this.investigate();
    else if (action === "explore") { this.enterExplore("houshan_explore"); return; }
    else if (action === "travel") { UI.openTravel(); return; }
    else if (action === "wujian") { this.doWujian(); return; }
    else if (action === "liandan") { this.lianZhujiDan(); return; }

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
    const factor = Balance.travelTimeFactor(State.effectiveSpeed());
    const cost = Math.max(1, Math.round((loc.travelCost || 2) * factor));
    this.passTime(cost);
    s.location = locId;
    this.log(`你动身前往「${loc.name}」，行程耗时 ${cost} 月。${loc.desc}`, "event");
    this._resolveLeadsAt(locId);
    this.checkLifespan();
    this.checkStory();
    State.save();
    UI.renderAll();
  },

  /* -------- 采药（后山）：药理熟练度——干什么都有正反馈 -------- */
  gather() {
    const s = State.data;
    this.passTime(WORLD.activities.gather.timeCost);
    if (!s.skills) s.skills = { alchemy: 0, scouting: 0 };
    const bonus = Math.floor((s.skills.alchemy || 0) / 8);   // 药理每8级多识得一株
    const n = 1 + Math.floor(Math.random() * 3) + bonus;
    State.give("lingcao", n);
    if (Math.random() < 0.4 + (s.skills.alchemy || 0) * 0.01) State.give("duyao_cao", 1);
    s.skills.alchemy += 1;
    this.log(`你在灵草丛中采得灵草 ×${n}` + (s.inventory.duyao_cao ? "，还顺手挖到一株毒草" : "") + `。（药理+1，现 ${s.skills.alchemy}）`, "good");
  },

  /* -------- 切磋（演武厅，可能引出厉飞雨剧情提示）-------- */
  spar() {
    const s = State.data;
    this.passTime(WORLD.activities.spar.timeCost);
    s.body += 1;
    s.flags.adventured = true;
    s.mood = clamp(s.mood + 5, 0, s.moodMax);
    // 剑意修行链：与人对剑是练剑的正途
    let swordNote = "";
    if (!s.swordMastery) {
      s.swordIntent = clamp((s.swordIntent || 0) + 3, 0, 100);
      swordNote = s.swordIntent >= 100 ? "你隐隐觉得剑上的火候到了（剑意圆满，可回药庐悟剑）。" : `切磋间你的剑越发纯熟（剑意+3）。`;
      if (s.swordIntent === 100 && !s.flags.sword_intent_full) { State.setFlag("sword_intent_full"); this.toast("剑意圆满！可回药庐悟剑"); }
    }
    this.log("你与同门切磋武艺，身法体魄略有精进。厉飞雨笑你进境神速，直呼天才。" + swordNote, "good");
  },

  /* -------- 道途年表：质变/大件/勋章的永久记录 -------- */
  addMilestone(title, kind) {
    const s = State.data;
    if (!s.milestones) s.milestones = [];
    s.milestones.push({ t: `第${s.year}年${s.month}月 · ${s.age}岁`, title, kind: kind || "deed" });
    this.toast("道途留痕：" + title);
  },

  /* -------- 羁绊回赠结算：好感升段时，具名故人按身份一次性回赠（社交深化 ①②）-------- */
  flushNpcGifts() {
    const s = State.data;
    const I = (typeof INTERACTIONS !== "undefined") ? INTERACTIONS : null;
    if (!I || !I.claimGifts) return false;
    const q = I.claimGifts(s);
    if (!q || !q.length) return false;
    const TIER = ["", "相熟", "交情深厚", "挚交"];
    let any = false;
    for (const g of q) {
      const gift = I.giftFor(g.npcId, g.tier);
      if (!gift) continue;
      const n = (typeof WORLD !== "undefined") ? WORLD.npcById(g.npcId) : null;
      const nm = n ? n.name : g.npcId;
      const names = [];
      Object.entries(gift.items || {}).forEach(([k, v]) => {
        State.give(k, v);
        const it = DATA.items[k];
        names.push(`${it ? it.name : k}${v > 1 ? "×" + v : ""}`);
      });
      this.log(`【羁绊·${TIER[g.tier] || ""}】${gift.line}（${nm}赠你：${names.join("、")}）`, "good");
      s.worldNews = s.worldNews || [];
      s.worldNews.push({ t: `第${s.year}年${s.month}月`, kind: "fortune", text: `你与${nm}的交情更进一层（${TIER[g.tier] || ""}）。` });
      if (gift.keepsake) {
        const kid = Object.keys(gift.items || {})[0];
        s.keepsakes = s.keepsakes || [];
        if (kid && !s.keepsakes.some(x => x.id === kid)) {
          s.keepsakes.push({ id: kid, from: g.npcId, fromName: nm, t: `第${s.year}年${s.month}月` });
        }
        this.addMilestone(`${nm}赠你信物「${(kid && DATA.items[kid]) ? DATA.items[kid].name : kid}」`, "deed");
        if (typeof Sfx !== "undefined") Sfx.play("success");
      } else if (typeof Sfx !== "undefined") {
        Sfx.play("chime");
      }
      any = true;
    }
    if (any) State.save();
    return any;
  },

  /* -------- 悟剑（剑意圆满后，于洞府闭关参悟眨眼剑法至大成）-------- */
  doWujian() {
    const s = State.data;
    if (s.swordMastery) { this.toast("剑法已然大成"); return; }
    if ((s.swordIntent || 0) < 100) { this.toast("剑意未满，尚需实战磨剑", true); return; }
    this.passTime(3);
    s.spirit = clamp(s.spirit - 20, 0, State.realm().spMax);
    const rate = clamp(0.45 + s.insight * 0.03 + (s.mood / s.moodMax) * 0.2 - (s.demon / 100) * 0.2, 0.15, 0.95);
    if (Math.random() < rate) {
      s.swordMastery = true;
      // 进化而非并列：连环眨眼【替换】眨眼连击（技能栏不膨胀）
      if (!s.knownSkills.includes("lianhuan")) s.knownSkills.push("lianhuan");
      s.knownSkills = s.knownSkills.filter(id => id !== "zhayan_lian");
      if (s.spells.includes("zhayan_lian")) s.spells = s.spells.map(id => id === "zhayan_lian" ? "lianhuan" : id);
      else if (!s.spells.includes("lianhuan") && typeof Loadout !== "undefined") Loadout.equipSkill(s, "lianhuan");
      this.log("【剑法大成】三月闭关，你将千百次出剑的体悟尽数咀嚼——某夜剑光一闪，你忽然懂了：剑快不在手，在心。眨眼剑法至此大成，解锁绝技「连环眨眼」——剑势所至，一剑化数剑！剑势上限+2。", "good");
      this.addMilestone("《眨眼剑法》臻于大成，得连环眨眼", "bigitem");
      if (typeof Sfx !== "undefined") Sfx.play("bell");
    } else {
      s.swordIntent = 88;
      s.mood = clamp(s.mood - 8, 0, s.moodMax);
      this.log("【悟剑未成】三月枯坐，那层窗户纸偏偏差一指之力。所幸剑意未散——再经几场实战打磨，下次定能捅破。", "bad");
    }
    this.checkLifespan(); State.save(); UI.renderAll();
  },

  /* -------- 采买（集镇）-------- */
  buy(itemId) {
    const s = State.data;
    // 符箓是修仙界稀货：凡人集镇偶有流出，价不菲（穷靠本命，富靠符箓）
    const shop = { lingcao: 3, duyao_cao: 6, qingyuan_dan: 8, huixue_dan: 6, ningshen_dan: 14,
                   huoshe_fu: 20, hanbing_fu: 20 };
    let price = shop[itemId];
    if (!price) return;
    // 黑市窗口（涟漪链）：赃丹贱卖
    if (itemId === "qingyuan_dan" && s.rippleWindow && s.rippleWindow.id === "cheap_pills") price = 3;
    if (s.silver < price) { this.toast("纹银不足", true); return; }
    s.silver -= price;
    State.give(itemId, 1);
    this.log(`你花了 ${price} 两纹银，购得「${DATA.items[itemId].name}」。`, "event");
    State.save();
    UI.renderAll();
    UI.openMarket();
  },

  /* -------- 百药园差事（黄枫谷大帆主轴）：月月有产出的嗑瓜子循环 --------
   * 产出：例钱灵石+药草+药理熟练度+马师伯人情（暗涨）；
   * 「夹带私种」：以谷田种自己的草——高产但有巡查风险（账本计次，过线有事端）。 */
  _YAOYUAN_FLAVOR: [
    "晨雾未散，你赤脚踩进灵田引泉。水声潺潺里，新芽顶开了腐叶。",
    "捉了一上午的青叶虫，指尖染了一层药香，洗都洗不掉。",
    "马师伯背着手巡园，在你那畦参苗前站了半晌，什么也没说——这就是夸了。",
    "午后骤雨，你抢在雨前给娇贵的灵苗盖上草帘，淋了个透湿。",
    "你按《百草谱》试着给一畦老株换土，竟真救活了——有些门道，书上写的是真有用。",
    "邻畦的师兄又把灵泉引漏了，你顺手替他堵上。他塞给你两个灵果，咧嘴一笑。",
    "夜里巡园，月光落在药田上，满园灵草微微泛光——这景象，凡人一辈子也见不着。",
  ],
  yaoyuanWork() {
    const s = State.data;
    if (!s.flags.yaoyuan_started) { this.toast("尚未领百药园差事"); return; }
    const self = this;
    this._pendingFortune = {
      title: "百药园 · 当月差事",
      text: "一畦畦灵田铺到坡顶，露水压着药香。这个月，怎么干？",
      choices: [
        {
          text: "本分打理（例钱+药草+药理）",
          effect(sd) {
            self.passTime(1);
            sd.silver += 2;
            if (Math.random() < 0.5) State.give("lingshi", 1);
            State.give("lingcao", 1 + (Math.random() < 0.4 ? 1 : 0));
            sd.skills = sd.skills || {}; sd.skills.alchemy = (sd.skills.alchemy || 0) + 1;
            const flavor = self._YAOYUAN_FLAVOR[Math.floor(Math.random() * self._YAOYUAN_FLAVOR.length)];
            return { text: `${flavor}\n\n月底结算：例钱纹银+2${State.count("lingshi") ? "、灵石碎些许" : ""}、灵草入袋，药理+1。马师伯的脸色，又松快了一分。`, kind: "good" };
          },
        },
        {
          text: "夹带私种（高产，有巡查风险）",
          hint: "以谷田之利种自己的草——账，是会记下的",
          effect(sd) {
            self.passTime(1);
            sd.silver += 2;
            State.give("lingcao", 3);
            if (Math.random() < 0.35) State.give("duyao_cao", 1);
            sd.skills = sd.skills || {}; sd.skills.alchemy = (sd.skills.alchemy || 0) + 1;
            sd.flags.yaoyuan_private = (sd.flags.yaoyuan_private || 0) + 1;
            const n = sd.flags.yaoyuan_private;
            if (n === 3) Engine.writeLedger("yaoyuan_overharvest", "在百药园多次夹带私种（谷规不容）");
            const risk = n >= 3 && Math.random() < 0.3;
            if (risk) {
              return { text: "你在园角自留地里又埋下一批种子——直起腰时，马师伯就站在田埂上。\n\n他盯着你看了很久，最后只说了一句：「苗，别种到老夫的参畦边上。」转身走了。\n\n（他知道了。他没报上去——这份人情，比例钱重得多。）", kind: "bad" };
            }
            return { text: "你借着引泉的便利，把自家的种子混进了边角田。谷里的灵泉灵土不要钱似的滋养着它们——长势比小绿瓶催的也不差多少。\n\n（灵草+3，药理+1。账本上，这是第" + n + "笔私账。）", kind: "event" };
          },
        },
      ],
    };
    State.save();
    UI.renderAll();
    UI.openFortune(this._pendingFortune);
  },

  /* -------- 万宝楼（黄枫谷坊市）：修仙界的钱在这里花得出去 -------- */
  WANBAO_GOODS: [
    { id: "huoshe_fu", price: 2, note: "比小会还齐" },
    { id: "hanbing_fu", price: 2, note: "" },
    { id: "dingshen_fu", price: 3, note: "定身一瞬，胜负已分" },
    { id: "huiyuan_dan", price: 3, note: "战中回元的那口气" },
    { id: "zhenqi_kunzu", price: 3, note: "阵法轴 · 挡突进" },
    { id: "zhenqi_juling", price: 3, note: "阵法轴 · 久战续航" },
    { id: "fu_zhi", price: 1, n: 5, note: "制符根基" },
    { id: "ningshen_dan", price: 2, note: "凝神静心" },
    { id: "huixue_dan", price: 1, note: "伤药常备" },
    { id: "duyao_cao", price: 1, n: 2, note: "万宝楼什么都收，什么都卖" },
    // 二层（筑基期法器）：练气期就买得到，驱使不动——攒钱与筑基的双重惦记
    { id: "jinfuzi_ren", price: 40, once: true, note: "二层 · 镇楼之宝", floor2: true },
    { id: "xuantie_dun", price: 30, once: true, note: "二层", floor2: true },
    { id: "feixing_jujian", price: 35, once: true, note: "二层", floor2: true },
  ],
  wanbaoBuy(itemId) {
    const s = State.data;
    const g = this.WANBAO_GOODS.find(x => x.id === itemId);
    if (!g) return;
    if (g.once && State.count(itemId) > 0) { this.toast("此物已购得"); return; }
    if (State.count("lingshi") < g.price) { this.toast(`需要灵石 ×${g.price}`, true); return; }
    State.take("lingshi", g.price);
    State.give(itemId, g.n || 1);
    s.flags.fangshi_visited = (s.flags.fangshi_visited || 0) + 1;
    const item = DATA.items[itemId];
    this.log(`【万宝楼】购得「${item.name}」${g.n > 1 ? `×${g.n}` : ""}（灵石-${g.price}）。`, "event");
    if (g.floor2) {
      this.addMilestone(`万宝楼二层：购得「${item.name}」`, "bigitem");
      this.toast(`${item.name} 到手——筑基之后，它才真正属于你`);
    } else {
      this.toast(`${item.name} 到手`);
    }
    this.checkStory();
    State.save();
    UI.renderAll();
    UI.openWanbao();
  },
  /* -------- 法器装备：穿戴/卸下（属性即时结算，主动技入战）--------
   * v96 三类法宝制：slot:"side"=伴身法宝（被动面板件）——进 sideTreasures 数组，
   * 槽数=神识档（State.sideTreasureSlots：境界+大衍诀） */
  equipGear(itemId) {
    const s = State.data;
    const def = DATA.gear[itemId];
    if (!def) { this.toast("此物不可装备"); return; }
    if (!State.count(itemId)) return;
    const layer = (DATA.realms[s.realmIndex] || {}).layer || 1;
    if (def.minLayer && layer < def.minLayer) {
      this.toast(`修为不足（需练气${def.minLayer}层方可驱使）`, true);
      return;
    }
    if (def.slot === "side") {
      if (!s.sideTreasures) s.sideTreasures = [];
      if (s.sideTreasures.includes(itemId)) { this.toast("已在伴身之列"); return; }
      const cap = State.sideTreasureSlots();
      if (s.sideTreasures.length >= cap) {
        this.toast(`神识不济——同时伴身 ${cap} 件已是极限（境界精进或习得《大衍诀》可再驭）`, true);
        return;
      }
      s.sideTreasures.push(itemId);
      const item0 = DATA.items[itemId];
      this.log(`你将「${item0 ? item0.name : itemId}」炼入周身气机，伴身而悬——${(def.traits || []).map(t => t.desc).join("；")}`, "good");
      this.toast(`伴身：${item0 ? item0.name : itemId}（${s.sideTreasures.length}/${cap}）`);
      State.save();
      UI.renderAll();
      return;
    }
    // 同槽旧装备先卸
    if (s.gear[def.slot]) this.unequipGear(def.slot, true);
    s.gear[def.slot] = itemId;
    // 持久属性即时结算
    if (def.bonus) {
      if (def.bonus.hpMax) { s.hpMax += def.bonus.hpMax; s.hp += def.bonus.hpMax; }
      if (def.bonus.moodMax) { s.moodMax += def.bonus.moodMax; s.mood += def.bonus.moodMax; }
      if (def.bonus.sense) s.sense += def.bonus.sense;
      if (def.bonus.body) s.body += def.bonus.body;
    }
    const item = DATA.items[itemId];
    const fx = [];
    if (def.bonus) Object.entries(def.bonus).forEach(([k, v]) => {
      const names = { hpMax: "气血上限", moodMax: "心境上限", sense: "神识", body: "体魄", speed: "遁速" };
      fx.push(`${names[k] || k}+${v}`);
    });
    this.log(`你将「${item.name}」祭起灵力炼化驱使——${fx.join("，")}${def.grantSpells ? "；战斗技已入战" : ""}。${(def.traits || []).map(t => t.desc).join("；")}`, "good");
    this.toast(`已装备：${item.name}`);
    State.save();
    UI.renderAll();
  },
  // 伴身法宝卸下（按 itemId——伴身槽是数组不是固定位）
  unequipSideTreasure(itemId) {
    const s = State.data;
    if (!s.sideTreasures || !s.sideTreasures.includes(itemId)) return;
    s.sideTreasures = s.sideTreasures.filter(x => x !== itemId);
    const item = DATA.items[itemId];
    this.toast(`已收起：${item ? item.name : itemId}`);
    State.save();
    UI.renderAll();
  },
  unequipGear(slot, silent) {
    const s = State.data;
    const itemId = s.gear[slot];
    if (!itemId) return;
    const def = DATA.gear[itemId];
    s.gear[slot] = null;
    if (def && def.bonus) {
      if (def.bonus.hpMax) { s.hpMax -= def.bonus.hpMax; s.hp = Math.min(s.hp, s.hpMax); }
      if (def.bonus.moodMax) { s.moodMax -= def.bonus.moodMax; s.mood = Math.min(s.mood, s.moodMax); }
      if (def.bonus.sense) s.sense -= def.bonus.sense;
      if (def.bonus.body) s.body -= def.bonus.body;
    }
    if (!silent) {
      this.toast(`已卸下：${DATA.items[itemId].name}`);
      State.save();
      UI.renderAll();
    }
  },

  /* -------- 万宝楼收购：千年灵草/灵药 + 妖材（妖材经济 v1——皮骨牙丹皆是钱）-------- */
  wanbaoSell(itemId) {
    const s = State.data;
    const PRICES = { qiannian_lingcao: 22, lingyao_dan: 2 };
    const item = DATA.items[itemId];
    const p = PRICES[itemId] != null ? PRICES[itemId] : (item && item.sell) || 0;
    if (!p || !State.take(itemId, 1)) { this.toast("无此货可售", true); return; }
    State.give("lingshi", p);
    if (itemId === "qiannian_lingcao") {
      this.log(`【万宝楼】掌柜捧着那棵「千年灵草」手都在抖，二话不说点出 ${p} 枚灵石：「小友若还有，老朽照单全收！」`, "good");
      this.addMilestone("千年灵草换灵石：小绿瓶的奇迹第一次变现", "bigitem");
    } else if (itemId === "yaodan_1") {
      this.log(`【万宝楼】掌柜捏着那枚「一阶妖丹」对光一照，眼睛眯成了缝：「好丹！丹房炼器房都抢着要。」灵石+${p}。`, "good");
    } else {
      this.log(`【万宝楼】售出「${item.name}」，灵石+${p}。`, "event");
    }
    this.toast(`灵石+${p}`);
    State.save();
    UI.renderAll();
    UI.openWanbao();
  },

  // 向之礼的引导（考据：他给过韩立指点——分文不取，闲谈之间切中要害）
  xiangIntel() {
    const s = State.data;
    if (s.flags.xueshi_intel) { this.toast("老人的话，你已记在心里"); return; }
    State.setFlag("xueshi_intel");
    s.flags.fangshi_visited = (s.flags.fangshi_visited || 0) + 1;
    this.log("【闲谈】晒太阳的向老头眯着眼，慢悠悠地开了口：「血色禁地——谷里诸脉抢破头的机缘地。里头的血色主药，是炼筑基丹的根本。名额按各脉实力分，杂役想进去？修为先到练气十一层，再看大比时节的造化。」他顿了顿，又补一句：「里头死人是常事。但你这性子……去得，也回得来。」说完又眯上了眼，仿佛方才什么都没说过。（血色禁地的门道已知——这老人到底是谁？）", "good");
    this.writeLedger("xiang_guidance", "向之礼闲谈之间为你指点血色禁地的门道");
    this.toast("向之礼的指点：血色禁地=筑基丹主药所在");
    this.checkStory();
    State.save();
    UI.renderAll();
  },

  /* -------- 太南小会（离门远行）：修仙者集市——正反馈密集地 -------- */
  FAIR_GOODS: [
    { id: "changchun_houpian", price: 5, once: true, note: "镇摊之宝", rebate: 1,
      rebateText: "卖书的老者把一块灵石塞了回来：「你给多了，我们不占便宜。」" },
    { id: "zhifu_bi", price: 2, once: true, note: "御灵宗女修的旧物" },
    { id: "fu_zhi", price: 1, n: 5, note: "制符根基，提前囤些" },
    { id: "zheling_canbao", price: 3, once: true, note: "藏拙者的至宝" },
    { id: "huoshe_fu", price: 2, note: "比凡俗集镇地道得多" },
    { id: "hanbing_fu", price: 2, note: "同上" },
  ],
  fairBuy(itemId) {
    const s = State.data;
    const g = this.FAIR_GOODS.find(x => x.id === itemId);
    if (!g) return;
    if (g.once && State.count(itemId) > 0) { this.toast("此物已购得"); return; }
    if (State.count("lingshi") < g.price) { this.toast(`需要灵石 ×${g.price}`, true); return; }
    State.take("lingshi", g.price);
    State.give(itemId, g.n || 1);
    s.flags.fair_bought = (s.flags.fair_bought || 0) + 1;
    const item = DATA.items[itemId];
    this.log(`【小会】你以灵石×${g.price}购得「${item.name}」${g.n > 1 ? `×${g.n}` : ""}。`, "good");
    if (g.rebate) {
      State.give("lingshi", g.rebate);
      this.log(`【小会】${g.rebateText}（灵石+${g.rebate}）`, "event");
    }
    if (itemId === "changchun_houpian") {
      this.toast("《长春功·后篇》到手！回洞府闭关研习，八层之路自此开启");
      this.addMilestone("太南小会：购得《长春功》后篇全本", "bigitem");
    } else {
      this.toast(`${item.name} 到手`);
    }
    this.checkStory();
    State.save();
    UI.renderAll();
    UI.openFair();
  },
  fairSell(itemId) {
    const s = State.data;
    const PRICES = { qingyuan_dan: 1, duyao_cao: 1 };   // 毒草按两株一枚灵石（取整由调用保证）
    if (itemId === "qingyuan_dan") {
      if (!State.take("qingyuan_dan", 1)) { this.toast("没有养元丹了", true); return; }
      State.give("lingshi", 1);
      this.log("【小会】你售出「养元丹」×1，换得灵石×1——凡俗丹药在修仙集市上竟也有人收。", "event");
    } else if (itemId === "duyao_cao") {
      if (State.count("duyao_cao") < 2) { this.toast("毒草不足两株", true); return; }
      State.take("duyao_cao", 2);
      State.give("lingshi", 1);
      this.log("【小会】你售出「毒草」×2，换得灵石×1。收草的摊主与你心照不宣地对视了一眼。", "event");
    } else return;
    s.flags.fair_bought = (s.flags.fair_bought || 0) + 1;
    this.checkStory();
    State.save();
    UI.renderAll();
    UI.openFair();
  },

  /* -------- 金光砖回充（灵石×1 = 充能×1）：符宝吃资源——强力手段都有运营成本 -------- */
  rechargeZhuan() {
    const s = State.data;
    if (!State.count("jinguang_zhuan")) { this.toast("尚无金光砖"); return; }
    if (State.count("lingshi") < 1) { this.toast("需要灵石 ×1", true); return; }
    State.take("lingshi", 1);
    State.give("jinguang_zhuan_charge", 1);
    this.log(`你以灵石灵气温养金光砖，砖身金光复盛（充能+1，现 ${State.count("jinguang_zhuan_charge")} 道）。`, "good");
    this.toast(`金光砖充能 ×${State.count("jinguang_zhuan_charge")}`);
    State.save();
    UI.renderAll();
  },

  /* -------- 尸傀修缮（药庐）：毒物阴材温养——墨大夫的法子，如今你来用 -------- */
  repairSide() {
    const s = State.data;
    const u = s.sideUnit;
    if (!u) return;
    if (u.status !== "broken" && u.hp >= u.hpMax) { this.toast("尸傀完好，无须修缮"); return; }
    if (State.count("duyao_cao") < 2) { this.toast("需要毒草 ×2（阴毒之物养尸）", true); return; }
    State.take("duyao_cao", 2);
    this.passTime(1);
    u.hp = u.hpMax;
    u.status = "ok";
    this.log(`你依墨大夫遗册所载，以毒草阴气温养尸傀月余——「${u.name}」躯体复原，重新立于幡下待命。`, "good");
    this.toast(`${u.name}：修缮完毕`);
    this.checkLifespan();
    State.save();
    UI.renderAll();
  },

  /* -------- 尸傀随行开关 -------- */
  toggleSide() {
    const s = State.data;
    if (!s.sideUnit) return;
    s.sideUnit.carry = s.sideUnit.carry === false ? true : false;
    this.toast(s.sideUnit.carry ? `${s.sideUnit.name}：随行出战` : `${s.sideUnit.name}：留守药庐`);
    State.save();
    UI.renderAll();
  },

  /* -------- 侧位强化（通用·驭物）：按种类温养/饲育——尸傀今用，灵宠/傀儡后续复用同一界面 --------
     红线⑦：侧位是可选帮手非主线数值，逐级有上限、耗稀缺料；改后照跑 encounter/elem.bal 验基线未动。 */
  SIDE_ENH: {
    corpse: { track: "温养淬体", verb: "以阴毒之物温养尸躯、灵石淬其筋骨", maxLv: 5,
              cost: (lv) => ({ duyao_cao: 2 + lv, lingshi: lv }),
              gain: (lv) => ({ hpMax: 12, atk: 4, guard: lv % 2 === 0 ? 0.02 : 0 }),
              capNote: "凡俗之躯，温养有尽——再难逾越" },
    beast:  { track: "饲灵育性", verb: "以灵草、兽核饲育灵性", maxLv: 6,
              cost: (lv) => ({ lingcao: 3 + lv, lingshi: 1 + lv }),
              gain: (lv) => ({ hpMax: 14, atk: 5, guard: lv % 3 === 0 ? 0.03 : 0 }),
              capNote: "此兽灵慧已开至极，难再拔苗" },
  },
  sideEnhSpec(u) { return this.SIDE_ENH[(u && u.kind) || "corpse"] || this.SIDE_ENH.corpse; },
  _costText(cost) { return Object.keys(cost).map(k => `${(DATA.items[k] || {}).name || k}×${cost[k]}`).join("、"); },
  enhanceSideUnit() {
    const s = State.data;
    const u = s.sideUnit;
    if (!u) return;
    if (s.combat || s.pendingEvent) { this.toast("此刻无暇打理", true); return; }
    if (u.status === "broken") { this.toast("它已损毁，须先修缮", true); return; }
    const spec = this.sideEnhSpec(u);
    const lv = u.enhLv || 0;
    if (lv >= spec.maxLv) { this.toast(`${u.name}：${spec.capNote}`, true); return; }
    const next = lv + 1;
    const cost = spec.cost(next);
    for (const k in cost) { if (State.count(k) < cost[k]) { this.toast(`${spec.track}需 ${this._costText(cost)}`, true); return; } }
    for (const k in cost) State.take(k, cost[k]);
    const gain = spec.gain(next);
    u.enhLv = next;
    if (gain.hpMax) u.hpMax += gain.hpMax;
    if (gain.atk) u.atk += gain.atk;
    if (gain.guard) u.guard = Math.min(0.6, (u.guard || 0.3) + gain.guard);
    u.hp = u.hpMax;   // 温养既毕，躯体补满
    this.passTime(spec.months || 1);
    const gtxt = `气血上限+${gain.hpMax || 0}、攻+${gain.atk || 0}${gain.guard ? `、御+${Math.round(gain.guard * 100)}%` : ""}`;
    this.log(`你${spec.verb}，亲手温养「${u.name}」月余——其躯愈固、力道更沉（${spec.track} Lv.${next}：${gtxt}）。`, "good");
    this.toast(`${u.name}：${spec.track}至 Lv.${next}`);
    this.checkLifespan();
    State.save();
    UI.renderAll();
  },

  /* -------- 炼药（药庐）：药理熟练度——炼得越多手越稳，偶得双丹 -------- */
  alchemy() {
    const s = State.data;
    if (State.count("lingcao") < 2) { this.toast("缺少灵草（需2）", true); return; }
    this.passTime(WORLD.activities.alchemy.timeCost);
    State.take("lingcao", 2);
    if (!s.skills) s.skills = { alchemy: 0, scouting: 0 };
    const doubleChance = Math.min(0.35, (s.skills.alchemy || 0) * 0.015 + (s.insight || 0) * 0.01);
    const dbl = Math.random() < doubleChance;
    State.give("qingyuan_dan", dbl ? 2 : 1);
    s.skills.alchemy += 2;
    this.log(dbl
      ? `炉火纯青——这一炉竟得养元丹 ×2！（药理+2，现 ${s.skills.alchemy}）`
      : `你依墨大夫所授丹方，以灵草炼出一枚养元丹。（药理+2，现 ${s.skills.alchemy}）`, "good");
  },

  /* -------- 探查（密室，推进张铁/夺舍线索）-------- */
  investigate() {
    const s = State.data;
    this.passTime(WORLD.activities.investigate.timeCost);
    s.flags.investigated = (s.flags.investigated || 0) + 1;
    s.demon = clamp(s.demon + 5, 0, 100);
    this.log("你借着夜色潜入密室周遭探查，所见种种，令你愈发心惊。", "bad");
  },

  /* ===========================================================
   *  箱庭式网格探索（副本/秘境）—— 见 js/explore.js
   * =========================================================== */
  // 进入探索点：生成网格并打开探索界面
  enterExplore(siteId) {
    const s = State.data;
    if (s.combat) { this.toast("酣战之中，无暇他顾"); return; }
    const cfg = DATA.exploreSites[siteId];
    if (typeof Explore === "undefined" || !cfg) { this.toast("此地暂不可探"); return; }
    // 异闻链：身负异闻时，深处的"妖兽王"即异闻中的那一头（听闻在前，名实一致）
    // 探知熟练度：走得多了，眼睛和神识都更尖（暗室更易察觉，老手视野更阔）
    if (!s.skills) s.skills = { alchemy: 0, scouting: 0 };
    const xcfg = Object.assign({}, cfg, {
      senseVal: s.sense + Math.floor((s.skills.scouting || 0) / 8),
      sightRadius: (cfg.sightRadius || 1) + ((s.skills.scouting || 0) >= 16 ? 1 : 0),
    });
    if (s.beastRumor && WORLD.enemies[s.beastRumor]) xcfg.bossEnemy = s.beastRumor;
    s.explore = Explore.generate(xcfg, Math.random);
    if (s.beastRumor && WORLD.enemies[s.beastRumor]) {
      Explore._log(s.explore, `异闻在耳——「${WORLD.enemies[s.beastRumor].name}」就盘踞在此地深处。猎，或不猎？`);
    }
    UI.openExplore(s.explore);
    State.save();
  },

  // 探索异状小事件池（踩到"？"格：吉凶各半，搏不搏自己选）
  _EXPLORE_MYSTERIES: [
    {
      title: "塌陷的兽穴", text: "脚下的土层忽然松动，露出一个黑黢黢的洞口，隐有微光。",
      choices: [
        { text: "探身摸一把", effect(s) { if (Math.random() < 0.55) { s.explore.bag.lingshi = (s.explore.bag.lingshi || 0) + 2; return { text: "你摸到一枚冰凉的灵石——是头前个倒霉鬼的遗落！（灵石+2）", kind: "good" }; } const dmg = 10; s.hp = Math.max(1, s.hp - dmg); return { text: `穴中竟有蛇虫！你被狠狠咬了一口（气血-${dmg}），悻悻缩手。`, kind: "bad" }; } },
        { text: "不冒这个险", effect() { return { text: "你绕开洞口。深山之中，贪小利者多横死。", kind: "sys" }; } },
      ],
    },
    {
      title: "前人遗骸", text: "草丛里横着一具白骨，衣衫早已朽烂，指骨还紧紧攥着什么。",
      choices: [
        { text: "掰开看看", effect(s) { if (Math.random() < 0.6) { s.explore.bag.anqi = (s.explore.bag.anqi || 0) + 2; return { text: "是两支保存完好的飞针——前辈遗物，你拜了三拜收下。（暗器+2）", kind: "good" }; } s.demon = Math.min(100, s.demon + 4); return { text: "只是一截枯枝。死人攥着枯枝走完最后一程——你心头一寒。（心魔+4）", kind: "bad" }; } },
        { text: "就地掩埋", effect(s) { s.mood = Math.min(s.moodMax, s.mood + 4); return { text: "你拢土埋骨。或许他日也有人这样待你。（心境+4）", kind: "good" }; } },
      ],
    },
    {
      title: "灵气漩涡", text: "一小股灵气在岩缝间打着旋，吸之可补，但乱流刺骨。",
      choices: [
        { text: "吐纳吸取", effect(s) { const realm = State.realm(); if (Math.random() < 0.65) { s.spirit = Math.min(realm.spMax, s.spirit + 15); return { text: "你就地吐纳，灵力小补（灵力+15）。", kind: "good" }; } const dmg = 8; s.hp = Math.max(1, s.hp - dmg); return { text: `乱流入体如针扎（气血-${dmg}）！你赶忙收功。`, kind: "bad" }; } },
        { text: "绕开乱流", effect() { return { text: "来历不明的灵气，不吸也罢。", kind: "sys" }; } },
      ],
    },
    {
      title: "受困的灵狐", text: "一只皮毛雪白的小狐被藤蔓缠住，看到你，呜呜地低鸣。",
      choices: [
        { text: "割藤放生", effect(s) { if (Math.random() < 0.5) { s.explore.bag.lingcao = (s.explore.bag.lingcao || 0) + 2; return { text: "灵狐绕着你转了两圈，刨出两株灵草相赠，倏然遁去。（灵草+2）", kind: "good" }; } return { text: "灵狐头也不回地跑了。罢了，本也不图报。", kind: "sys" }; } },
        { text: "警惕绕行", effect() { return { text: "深山精怪，谁知真假。你按剑绕开。", kind: "sys" }; } },
      ],
    },
    {
      title: "雾中岔路", text: "浓雾忽起，眼前隐约岔出一条捷径，似能少绕半座山。",
      choices: [
        { text: "走捷径", effect(s) { if (Math.random() < 0.6) { s.explore.steps = Math.max(0, s.explore.steps - 3); return { text: "捷径果然通畅，省下不少脚程。（耗时-3步）", kind: "good" }; } s.explore.steps += 3; return { text: "雾中转向，你多绕了一大圈才回到原路。（耗时+3步）", kind: "bad" }; } },
        { text: "稳走大路", effect() { return { text: "迷雾古怪，你按原路稳步前行。", kind: "sys" }; } },
      ],
    },
  ],
  // 弹出异状事件（复用奇遇弹窗 UI）
  _openExploreMystery() {
    const pool = this._EXPLORE_MYSTERIES;
    const f = pool[Math.floor(Math.random() * pool.length)];
    this._pendingFortune = {
      title: f.title, text: f.text,
      choices: f.choices.map(c => ({ text: c.text, effect: c.effect })),
    };
    UI.openFortune(this._pendingFortune);
  },

  // 玩家在探索网格中移动
  exploreMove(dir) {
    const s = State.data;
    if (!s.explore || s.explore.finished) return;
    const r = Explore.move(s.explore, dir, Math.random);
    if (!r.ok) { this.toast(r.reason); return; }

    // 处理移动产生的事件
    let pendingBeast = null, pendingMystery = false;
    for (const ev of r.events) {
      if (ev.type === "collect") {
        this.toast(`${ev.rich ? "重获" : "采得"} ${ev.name}`);
        if (typeof Sfx !== "undefined") Sfx.play("pick");
        if (UI.flashExploreCell) UI.flashExploreCell(s.explore.player.x, s.explore.player.y);
      } else if (ev.type === "rival_take") {
        this.toast(`${ev.companion.name} 抢走了 ${ev.name}`, true);
      } else if (ev.type === "conflict") {
        pendingBeast = { kind: "conflict", companion: ev.companion };
      } else if (ev.type === "beast") {
        pendingBeast = { kind: "beast", enemy: ev.enemy, boss: ev.boss, bossLoot: ev.bossLoot };
      } else if (ev.type === "mystery") {
        pendingMystery = true;
      } else if (ev.type === "timeup") {
        // 限时秘境：禁制闭合，强制送出（血色禁地五日之限）
        UI.renderExplore(s.explore);
        this.log("【血色禁地】五日之限已至，血幕轰然闭合——一股巨力裹着你向外抛去。袋里装了多少，就是多少了。", "event");
        this.finishExplore(false);
        return;
      } else if (ev.type === "exit") {
        UI.renderExplore(s.explore);
        this.finishExplore(true);
        return;
      }
    }

    UI.renderExplore(s.explore);

    // 触发战斗（凶兽/妖兽王/同伴反目）——离开探索界面打一场，胜后回到原格继续
    if (pendingBeast) {
      if (pendingBeast.kind === "beast") {
        this._exploreFightReturn = true;
        // 妖兽王：胜后丰厚战利并入探索袋
        if (pendingBeast.boss && pendingBeast.bossLoot) {
          this._exploreBossLoot = {};
          Object.entries(pendingBeast.bossLoot).forEach(([k, range]) => {
            this._exploreBossLoot[k] = range[0] + Math.floor(Math.random() * (range[1] - range[0] + 1));
          });
          this.log("【妖兽王】盘踞深处的凶物被你惊动——这是本地最凶的一战，也是最肥的一笔！", "bad");
        }
        // 并肩同道（血色禁地·墨蛟之战）：深潭之主现身时，她也到了
        const siteCfg = DATA.exploreSites[s.explore.siteId] || {};
        if (pendingBeast.boss && siteCfg.bossSide === "nangongwan" && !s.flags.mojiao_slain) {
          this._sideOverride = this._nangongwanAlly();
          this.log("【并肩】血潭边早有一道白衣身影——掩月宗南宫婉，竟也循着主药到了此处。墨蛟暴起的刹那，你们背靠了背。", "event");
        }
        UI.closeExplore();
        this.startEncounterFight(pendingBeast.enemy);
      } else if (pendingBeast.kind === "conflict") {
        const cp = pendingBeast.companion;
        this.log(`【副本·内讧】${cp.name} 为争夺机缘与你反目，拔刀相向！`, "bad");
        this._exploreFightReturn = true;
        UI.closeExplore();
        this.startEncounterFight("rogue_cultivator");
      }
    } else if (pendingMystery) {
      // 异状小事件：踩上才知吉凶
      this._openExploreMystery();
    }
    State.save();
  },

  // 结束探索：把本次采集并入主背包，统一结算耗时
  finishExplore(reachedExit) {
    const s = State.data;
    const st = s.explore;
    if (!st || st.finished) return;
    st.finished = true;
    const months = Explore.timeCostMonths(st);

    // 采集并入主背包
    const gained = [];
    Object.entries(st.bag).forEach(([item, n]) => {
      if (n > 0) { State.give(item, n); gained.push(`${DATA.items[item] ? DATA.items[item].name : item}×${n}`); }
    });
    UI.closeExplore();
    this.passTime(months);
    s.flags.adventured = true;
    s.flags.adv_count = (s.flags.adv_count || 0) + 1;
    if (!s.skills) s.skills = { alchemy: 0, scouting: 0 };
    s.skills.scouting += 2;   // 探知：每趟探索都让你更熟悉山林（嗑瓜子轴）

    const summary = gained.length ? `满载而归：${gained.join("、")}。` : "空手而归，未有所获。";
    this.log(`你${reachedExit ? "寻到出口，离开了" : "退出了"}「${st.siteName}」，探索耗时约 ${months} 月。${summary}`, gained.length ? "good" : "sys");
    s.explore = null;

    // 异闻投放：深入后山探索，最易撞见风声（无活跃异闻且尚有未伏诛的妖王时）
    this._maybeBeastRumor(0.5);

    this.checkLifespan();
    this.checkStory();
    if (!s.pendingEvent && !s.combat && !this._pendingFortune) this._maybeInteraction();
    State.save();
    UI.renderAll();
  },

  /* ===========================================================
   *  箱庭探索 v3 —— L1 舆图 + 嵌套栈（见 js/exploremap.js）
   *  血色禁地：五日灾厄钟 / 封岳巡逻 / 血幕收缩 / 墨蛟洞（L3）
   * =========================================================== */
  enterJindiMap() {
    const s = State.data;
    if (s.combat) { this.toast("酣战之中，无暇他顾"); return; }
    s.exmap = ExploreMap.start("xueshi_l1", { flags: s.flags });
    State.setFlag("jindi_entered");
    this.log("入禁那日，三十人鱼贯踏入血幕。赤红的雾气吞掉每个人的身影——五日之内，生死各安天命。", "event");
    if (typeof UI !== "undefined" && UI.openExmap) UI.openExmap();
    State.save();
  },

  // 统一解释舆图事件（travel/stay/gather/readLore 共用）
  _exmapEvents(events) {
    const s = State.data, x = s.exmap;
    if (!x) return;
    for (const ev of events) {
      if (ev.type === "note") {
        if (UI.exmapNote) UI.exmapNote(ev.text);
      } else if (ev.type === "warning") {
        if (UI.exmapNote) UI.exmapNote(ev.text, "warn");
      } else if (ev.type === "curfew") {
        this.log(`【血色禁地】${ev.note}`, "bad");
        if (UI.exmapNote) UI.exmapNote(ev.note, "warn");
      } else if (ev.type === "lore") {
        this.log(`【血色禁地】${ev.text}`, "good");
        if (UI.exmapNote) UI.exmapNote("残阵之眼睁开——全图轮廓与那道杀气的路线，尽收识海。", "good");
      } else if (ev.type === "loot") {
        const names = Object.entries(ev.loot).map(([k, n]) => `${DATA.items[k] ? DATA.items[k].name : k}×${n}`).join("、");
        this.toast(`采得：${names}`);
        if (typeof Sfx !== "undefined") Sfx.play("pick");
      } else if (ev.type === "encounter") {
        if (UI.renderExmap) UI.renderExmap();
        this._exmapFight(ev);
        return;
      } else if (ev.type === "timeup") {
        this.finishExmap("timeup");
        return;
      } else if (ev.type === "arrive") {
        this._exmapArrive(ev);
      }
    }
    if (UI.renderExmap) UI.renderExmap();
    State.save();
  },

  exmapTravel(nodeId) {
    const s = State.data;
    if (!s.exmap) return;
    const r = ExploreMap.travel(s.exmap, nodeId);
    if (!r.ok) { this.toast(r.reason, true); return; }
    // B1 走格回灵：跋涉间吐纳，灵力随脚程缓回（气血的回复走月度，见 passTime）
    const _rTravel = State.realm();
    if (_rTravel && _rTravel.spMax) s.spirit = clamp(s.spirit + Math.round(_rTravel.spMax * 0.10), 0, _rTravel.spMax);
    this._exmapEvents(r.events);
  },

  // 驻守：耗钟等人/恢复。庇护岩穴恢复更厚（遮息阵下打坐）
  exmapStay(ticks) {
    const s = State.data;
    if (!s.exmap) return;
    const f = ExploreMap.cur(s.exmap);
    const map = ExploreMap.mapOf(f);
    const node = map.nodes[f.node];
    const n = ticks || 1;
    const realm = State.realm();
    if (node && node.kind === "rest") {
      s.hp = clamp(s.hp + Math.round(s.hpMax * 0.12 * n), 1, s.hpMax);
      s.spirit = clamp(s.spirit + Math.round(realm.spMax * 0.18 * n), 0, realm.spMax);
      this.toast("遮息阵下打坐调息——气血灵力小复");
    } else {
      s.spirit = clamp(s.spirit + Math.round(realm.spMax * 0.06 * n), 0, realm.spMax);
    }
    const r = ExploreMap.stay(s.exmap, n);
    this._exmapEvents(r.events);
  },

  exmapGather() {
    const s = State.data;
    if (!s.exmap) return;
    const r = ExploreMap.gather(s.exmap);
    if (!r.ok) { this.toast(r.reason, true); return; }
    this._exmapEvents(r.events);
  },

  exmapReadLore() {
    const s = State.data;
    if (!s.exmap) return;
    const r = ExploreMap.readLore(s.exmap);
    if (!r.ok) { this.toast(r.reason, true); return; }
    this.writeLedger("jindi_guzhen", "血色禁地中借古阵残纹窥得全局，封岳的猎杀路线尽在掌握");
    this._exmapEvents(r.events);
  },

  // 到达节点：首访给场景描述；NPC 在场自动相遇
  _exmapArrive(ev) {
    const s = State.data, x = s.exmap;
    const f = ExploreMap.cur(x);
    const map = ExploreMap.mapOf(f);
    const node = map.nodes[f.node];
    if (!node) return;
    if (ev.firstVisit && node.desc && UI.exmapNote) UI.exmapNote(node.desc, "desc");
    // NPC 时间表：presence 区间内在场
    if (node.kind === "npc" && node.presence) {
      const ci = ExploreMap.clockInfo(x);
      const here = ci.clock >= node.presence[0] && ci.clock < node.presence[1];
      if (here && node.npc === "zhongwu") this._exmapZhongwu();
      else if (here && node.npc === "hanyunzhi") this._exmapHanyunzhi();
      else if (!here && UI.exmapNote) {
        UI.exmapNote(node.npc === "zhongwu"
          ? "灯架空着，摊主不在——许是时候未到，许是已经收摊。"
          : "烈阳花将开未开，花圃里空无一人。（约的人，怕是还没到。）", "desc");
      }
    }
  },

  // 钟吾的摊：禁地里的黑市（地图情报=花钱版古阵）
  _exmapZhongwu() {
    const s = State.data, x = s.exmap;
    if (!s.metNpcs.includes("zhongwu")) s.metNpcs.push("zhongwu");
    const f = ExploreMap.cur(x);
    const choices = [];
    if (!f.intel.patrol_route) {
      choices.push({ text: "买他的禁地舆图（灵石×8）", reopen: "zhongwu", effect: (st) => {
        if (State.count("lingshi") < 8) return { text: "钟吾掂了掂你的钱袋，笑着摇头：「灵石不够，画押也不收。」", kind: "bad" };
        State.take("lingshi", 8);
        f.intel.patrol_route = true;
        Object.keys(ExploreMap.mapOf(f).nodes).forEach(id => { f.visited[id] = f.visited[id] || "seen"; });
        Engine.writeLedger("jindi_zhongwu_map", "血色禁地中重金购下钟吾手绘舆图——封岳的猎杀路线一目了然");
        return { text: "钟吾摊开一张兽皮舆图：禁地全貌、药圃方位，连那道游弋的杀气走哪条路，都用朱砂标得明明白白。\n\n「那位『猎人』的脾性，我观察三天了。」他压低声音，「拿好。命比灵石值钱。」", kind: "good" };
      }});
    }
    choices.push({ text: "血色主药×1 换回元丹×2", reopen: "zhongwu", effect: () => {
      if ((x.bag.xueshi_zhuyao || 0) < 1 && State.count("xueshi_zhuyao") < 1) return { text: "你袋里还没有主药。钟吾耸耸肩：「空手套白狼，禁地里行不通。」", kind: "bad" };
      if ((x.bag.xueshi_zhuyao || 0) >= 1) x.bag.xueshi_zhuyao -= 1; else State.take("xueshi_zhuyao", 1);
      State.give("huiyuan_dan", 2);
      return { text: "一手交药，一手交丹。钟吾的丹瓶在禁地里比外头贵三成——但灵力见底的时候，贵的是命。（回元丹×2）", kind: "good" };
    }});
    choices.push({ text: "灵石×5 换定身符×1", reopen: "zhongwu", effect: () => {
      if (State.count("lingshi") < 5) return { text: "灵石不够。钟吾把符纸收了回去。", kind: "bad" };
      State.take("lingshi", 5);
      State.give("dingshen_fu", 1);
      return { text: "「黄枫谷符堂的正货。」钟吾把符递来，「对上那位『猎人』，这张纸能换你一条命。」（定身符×1）", kind: "good" };
    }});
    choices.push({ text: "告辞", effect: () => ({ text: "钟吾朝你拱拱手：「五日之内，灯亮着我就在。——活着出去。」", kind: "sys" }) });
    this._pendingFortune = {
      title: "雾中灯火 · 钟吾的摊",
      text: "灯下坐着个圆脸的胖修士，面前兽皮上摆着丹瓶、符纸和一卷舆图。见你过来，他眼睛一弯：「同门，禁地里头一回见活人摆摊吧？——钟吾，童叟无欺。」",
      choices,
    };
    UI.openFortune(this._pendingFortune);
  },

  // 菡云芝的烈阳花委托（第三日抵达花圃）
  _exmapHanyunzhi() {
    const s = State.data, x = s.exmap;
    if (s.flags.hanyunzhi_done) return;
    if (!s.metNpcs.includes("hanyunzhi")) s.metNpcs.push("hanyunzhi");
    this._pendingFortune = {
      title: "烈阳花圃 · 故人",
      text: "花圃边立着个青裙女修，正对着崖上的烈阳花发愁——是菡云芝，太南小会上赠你制符笔的御灵宗女修。\n\n「韩道友？」她又惊又喜，旋即苦笑，「烈阳花三日内不采就谢了。可这崖壁陡得很，我一个人，盯不住四面。」",
      choices: [
        { text: "替她护法采花（耗一钟）", effect: (st) => {
          const r = ExploreMap.stay(x, 1);
          State.give("lieyang_hua", 1);
          State.give("huoshe_fu", 2);
          State.setFlag("hanyunzhi_done");
          Engine.writeLedger("hanyunzhi_flower", "血色禁地中替菡云芝护法采得烈阳花——御灵宗的人情，记下了");
          Engine._exmapEvents(r.events);
          return { text: "你按剑立在崖下，神识张开四面——她攀上崖壁，把开得最盛的几朵尽数收入玉盒。\n\n「分你一朵，再加两张火蛇符。」她把东西塞过来，眼睛弯弯，「御灵宗欠你一个人情。人情比符值钱。」\n\n（烈阳花×1、火蛇符×2）", kind: "good" };
        }},
        { text: "自顾采花，先走一步", effect: () => {
          State.give("lieyang_hua", 2);
          State.setFlag("hanyunzhi_done");
          return { text: "你抢在她前头攀上崖壁，把向阳的两朵摘了。菡云芝在崖下看着，没说话。\n\n下崖时她已经走了。（烈阳花×2——御灵宗的人情，没了。）", kind: "bad" };
        }},
        { text: "「花我不要。道友自取，我替你看着。」", effect: () => {
          State.give("huoshe_fu", 2);
          State.setFlag("hanyunzhi_done");
          State.setFlag("hanyunzhi_favor");
          Engine.writeLedger("hanyunzhi_flower", "血色禁地中分文不取替菡云芝护法——御灵宗的人情，厚厚记下了");
          return { text: "她怔了怔，笑出声来：「太南小会那支笔，果然没送错人。」\n\n采完花，她把两张火蛇符硬塞进你手里，又留下一句话：「御灵宗在天南，有人欠你人情。」（火蛇符×2）", kind: "good" };
        }},
      ],
    };
    UI.openFortune(this._pendingFortune);
  },

  // 舆图遭遇战（封岳）：伏击=开局先机
  _exmapFight(ev) {
    const s = State.data;
    this._exmapFightReturn = true;
    this._nextFightType = ev.enemy;
    if (ev.atRest) this.log("【遭遇】杀气破开血雾直压过来——他循着你的气息找上门了。", "bad");
    if (UI.closeExmap) UI.closeExmap();
    // 禁地野外开战：长卷全景做底（开战不换天地）
    this._caveFightCfg = (typeof Art !== "undefined" && Art.has && Art.has("pano_xueshi"))
      ? { sceneBg: "pano_xueshi" } : null;
    this.startEncounterFight(ev.enemy);
    this._caveFightCfg = null;
    if (ev.ambush && this._combat && this._combat.enemies[0]) {
      const e = this._combat.enemies[0];
      const cut = Math.round(e.hpMax * 0.12);
      e.hp = Math.max(1, e.hp - cut);
      e.exposed = 1;   // 破绽暴露一回合（伏击先机）
      this._combat._log(`伏击得手！你早读熟了他的路线——${e.name} 被你一击重创（气血-${cut}，破绽大开）。`);
      this.log("【伏击】这一次，是猎人走进了陷阱。", "good");
    }
  },

  // 深潭洞口 → 墨蛟洞（L3）：洞口印记快照 + 压栈
  exmapEnterSub() {
    const s = State.data, x = s.exmap;
    if (!x) return;
    const f = ExploreMap.cur(x);
    const map = ExploreMap.mapOf(f);
    const node = map.nodes[f.node];
    if (!node || node.kind !== "enter") return;
    const sub = ExploreMap.MAPS[node.sub];
    this._pendingFortune = {
      title: `${node.name} · 临渊`,
      text: sub.confirm || "要进去吗？",
      choices: [
        { text: "立下洞口印记，入洞", effect: () => {
          delete s._caveSnap;
          s._caveSnap = JSON.stringify(Object.assign({}, s, { _caveSnap: undefined }));
          const r = ExploreMap.enterSub(x);
          if (!r.ok) return { text: r.reason, kind: "bad" };
          return { text: "你在洞口岩壁上刻下一道印记，吸一口气，潜入水下的黑暗。\n\n（洞口印记已立——若有不测，可从此处重来。）", kind: "event" };
        }},
        { text: "再整备整备，稍后再来", effect: () => ({ text: "你退后一步。潭水无声，那个洞口像一只阖着的眼。", kind: "sys" }) },
      ],
    };
    UI.openFortune(this._pendingFortune);
  },

  /* ---------- L3 轴式洞窟：走格/采集/布置/动手（探索格=战斗格，无缝衔接） ---------- */
  exmapCaveMove(pos) {
    const s = State.data, x = s.exmap;
    if (!x) return;
    const r = ExploreMap.caveMove(x, pos);
    if (!r.ok) { this.toast(r.reason || "走不得", true); return; }
    // B1 走格回灵：洞窟潜行屏息凝神，灵力小幅缓回（幅度小于明路跋涉）
    const _rCave = State.realm();
    if (_rCave && _rCave.spMax) s.spirit = clamp(s.spirit + Math.round(_rCave.spMax * 0.06), 0, _rCave.spMax);
    for (const ev of (r.events || [])) {
      if (ev.type === "intel") {
        this.log(`【观战】${ev.text}`, "good");
        if (UI.exmapNote) UI.exmapNote(ev.text, "good");
        this.writeLedger("mojiao_watch", "深潭洞中伏岩观战，看清了墨蛟的路数与旧伤破绽");
      } else if (ev.type === "sound") {
        // 声纹梯度：远闻其声，近见其形——耳朵先于眼睛抵达战团
        if (UI.exmapNote) UI.exmapNote(`♪ ${ev.text}`, "desc");
        if (typeof Sfx !== "undefined" && ev.sfx) Sfx.play(ev.sfx);
      } else if (ev.type === "near") {
        // 近身惊动：贴得越近，每一步越响
        if (ev.text && UI.exmapNote) UI.exmapNote(ev.text, "warn");
      } else if (ev.type === "blown") {
        this.log("【惊动】潭面的涟漪猛地一滞——水底那双眼睛，扫过来了。", "bad");
        if (UI.exmapNote) UI.exmapNote("潭水死寂——它知道你在。", "warn");
        if (typeof Sfx !== "undefined") Sfx.play("danger");
      }
    }
    if (UI.renderExmap) UI.renderExmap();
    State.save();
  },

  exmapCaveTake(hotId) {
    const s = State.data, x = s.exmap;
    if (!x) return;
    const r = ExploreMap.caveTake(x, hotId);
    if (!r.ok) { this.toast(r.reason || "采不得", true); return; }
    const names = Object.entries(r.loot).map(([k, n]) => `${DATA.items[k] ? DATA.items[k].name : k}×${n}`).join("、");
    this.toast(`采得：${names}`);
    if (typeof Sfx !== "undefined") Sfx.play("pick");
    if (r.blown) {
      this.log("【惊动】潭面的涟漪猛地一滞——水底那双眼睛，扫过来了。", "bad");
      if (UI.exmapNote) UI.exmapNote("潭水死寂——它知道你在。", "warn");
    }
    if (UI.renderExmap) UI.renderExmap();
    State.save();
  },

  // 布置到格：UI 先选布置物（进入放置模式），点格落位
  exmapCavePlace(prepId, cell) {
    const s = State.data, x = s.exmap;
    if (!x) return;
    const f = ExploreMap.cur(x);
    const map = ExploreMap.mapOf(f);
    const p = (map.preps || []).find(pp => pp.id === prepId);
    if (!p) return;
    if (p.item && State.count(p.item) < 1) { this.toast(`没有${DATA.items[p.item] ? DATA.items[p.item].name : p.item}`, true); return; }
    if (p.side && (!s.sideUnit || s.sideUnit.status === "broken")) { this.toast("铁奴不在身边（或已破损）", true); return; }
    const r = ExploreMap.cavePlace(x, prepId, cell);
    if (!r.ok) { this.toast(r.reason || "布不得", true); return; }
    if (p.item) State.take(p.item, 1);
    this.toast(`已布下：${p.name}（第${cell + 1}步）`);
    if (typeof Sfx !== "undefined") Sfx.play("pick");
    this.log(`【布置】${p.name}落位于第${cell + 1}步——${p.hint}。`, "sys");
    if (UI.renderExmap) UI.renderExmap();
    State.save();
  },

  // 法宝出战开关：收起的法宝技不进战斗手牌（元婴期不被筑基期法器撑爆）
  toggleBenchTreasure(skillId) {
    const s = State.data;
    if (!s.benchTreasures) s.benchTreasures = [];
    const i = s.benchTreasures.indexOf(skillId);
    if (i >= 0) { s.benchTreasures.splice(i, 1); this.toast("法宝已重新出战"); }
    else { s.benchTreasures.push(skillId); this.toast("法宝已收起（不入战斗手牌）"); }
    State.save();
  },

  // 场景即战场：按地点开阔度给战场宽度（数据有 fieldW 用数据，否则按气质推断）
  /* 战场即场景（v96 用户裁决"战场大小随实际剧情动态变动，要做好"）：
   * 宽窄=地点开阔度；显式覆盖走 DATA.locations[].fieldW / fieldLanes（剧情战自定义
   * 走 _caveFightCfg.W/lanes——皇宫大殿/金鼓原旷野各按 modao-design 编排表给数）。
   * 排数与格数同源：方寸 2 排、街市 2 排、山野 3 排、旷野长轴 3~4 排 */
  _fieldWidthFor(locId) {
    const loc = (typeof DATA !== "undefined" && DATA.locations && DATA.locations[locId]) || {};
    if (loc.fieldW) return loc.fieldW;
    const id = locId || "";
    if (/yaolu|wuting|mishi|dihuo|miju/.test(id)) return 9;          // 室内/院落：方寸之地
    if (/town|jishi|fair|city|gate|men|fang/.test(id)) return 11;    // 街市/山门：放得开手脚
    if (/houshan|road|lin|valley|shan|jindi|ye/.test(id)) return 17; // 山野/官道：可跑可绕（v96 旷野再放宽）
    return 11;
  },
  _fieldLanesFor(locId, w) {
    const loc = (typeof DATA !== "undefined" && DATA.locations && DATA.locations[locId]) || {};
    if (loc.fieldLanes) return loc.fieldLanes;
    return w >= 17 ? 3 : w >= 11 ? 3 : 2;   // 旷野铺得开排，室内憋仄
  },

  // 退出洞窟：弹栈回 L1 深潭洞口（已采的带走，布置的算沉没——阵旗收不回来）
  exmapCaveLeave() {
    const s = State.data, x = s.exmap;
    if (!x || x.stack.length <= 1) return;
    ExploreMap.exitSub(x);
    delete s._caveSnap;
    this.log("你贴着洞壁退出深潭洞窟——水声在身后渐沉。（布下的阵旗收不回来了）", "sys");
    if (UI.renderExmap) UI.renderExmap();
    State.save();
  },

  /* 探索手牌：出手即开战——攻击常驻，但射程是把真尺（隔半个洞窟打不出剑）。
   * 只列即时攻击牌（蓄势/纯增益不能当开局第一击）；可打性=射程∩存货∩灵力。 */
  cavePlayerSpells() {
    const s = State.data, x = s.exmap;
    if (!x) return [];
    const f = ExploreMap.cur(x);
    if (!f || f.kind !== "cave") return [];
    const map = ExploreMap.mapOf(f);
    const beast = (map.watchers || []).find(wt => wt.beast);
    if (!beast || !map.fight) return [];
    const dist = Math.abs(f.pos - beast.pos);
    const pf = this.playerFighter();
    const SP = CombatAPI.SPELLS;
    const out = [];
    (pf.spells || []).forEach(id => {
      const sp = SP[id];
      if (!sp || !sp.dmg || sp.chargeTurns) return;
      if (!sp.range || sp.range[1] <= 0) return;
      const inRange = dist >= sp.range[0] && dist <= sp.range[1];
      const noPouch = sp.consume && !((pf.pouch || {})[sp.consume] > 0);
      const noMp = (sp.mp || 0) > pf.mp;
      out.push({
        id, name: sp.name, range: sp.range, source: sp.source || "art",
        quick: !!sp.quick, dist, ok: inRange && !noPouch && !noMp,
        why: !inRange ? (dist > sp.range[1] ? `射程${sp.range[1]}格·还差${dist - sp.range[1]}步` : "太近施展不开")
          : noPouch ? "无存货" : noMp ? "灵力不足" : "",
      });
    });
    return out;
  },

  // 出手即开战：第一招的伤害就是开战的那一下——攻击本身即宣战，无须"偷袭"按钮
  exmapCaveStrike(spellId) {
    const s = State.data, x = s.exmap;
    if (!x) return;
    const card = this.cavePlayerSpells().find(h => h.id === spellId);
    if (!card) return;
    if (!card.ok) { this.toast(card.why || "施展不得", true); return; }
    this.exmapCaveFight();   // 组战场：站位/布置/惊动/底图/镜头全继承（偷袭/迎战加成在内）
    const c = this._combat;
    if (!c || c.status !== "ongoing") return;
    const r = c.cast(spellId, 0);   // 开战第一击=这一招（照常占首回合行动经济）
    if (r && r.ok) c._log("这一招既是出手，也是宣战——洞里再没有躲着看的人了。");
    if (typeof UI !== "undefined") {
      if (UI.renderCombat) UI.renderCombat(c, this._combatMeta);
      if (UI.flushCombatFx) UI.flushCombatFx(c);
    }
    State.save();
  },

  // 动手：观战的对象原地转为敌方单位——探索轴即战斗轴（站位/阵法/伏着全部继承）
  // 同轴一体：攻击常驻——未惊动时动手=偷袭（敌措手不及），被惊动=迎战（敌有备而来）
  exmapCaveFight() {
    const s = State.data, x = s.exmap;
    if (!x) return;
    const info = ExploreMap.caveFightInfo(x);
    if (!info) return;
    this._nextFightType = info.enemy;
    this._exmapFightReturn = true;
    this.log(`【${info.sneak ? "偷袭" : "动手"}】${info.cue}`, "event");

    // 同道入战：南宫婉从观战位原地参战（战团消耗按你贪的程度折损她的气血）
    const ally = this._nangongwanAlly();
    const drain = Math.min(40, (info.takenCount || 0) * (info.allyDrain || 0));
    if (drain > 0) {
      ally.hp = Math.max(30, ally.hp - drain);
      this.log(`（你在岸上多采的每一株，都是她在潭心多撑的一招——南宫婉已带伤，气血 ${ally.hp}/${ally.hpMax}。）`, "sys");
    }
    this._sideOverride = ally;

    if (UI.closeExmap) UI.closeExmap();
    // 组战场：长轴宽度/站位继承/阵法格预铺/地雷埋设
    const zones = [], mines = [];
    (info.prepDefs || []).forEach(p => {
      const cell = info.preps[p.id];
      if (cell == null) return;
      if (p.zone) {
        zones.push({ from: Math.max(0, cell - 1), to: Math.min(info.W - 1, cell + 1),
                     type: p.zone, turns: p.zone === "juling" ? 5 : 4, team: "player" });
      } else if (p.mine) {
        mines.push({ cell, kind: p.mine, name: p.name,
                     dmg: p.mine === "tienu" ? Math.round(((s.sideUnit || {}).atk || 13) * 2) : 24,
                     hold: p.mine === "tienu" ? 1 : 0 });
      }
    });
    const fCur = ExploreMap.cur(x);
    const curMap = ExploreMap.mapOf(fCur);
    // 战场底图：长卷全景优先（已生成才用），回退洞窟场景图——开战不换天地
    const sceneBg = (typeof Art !== "undefined" && curMap.pano && Art.has(curMap.pano)) ? curMap.pano : info.sceneBg;
    this._caveFightCfg = { W: info.W, playerPos: info.playerPos, enemyPos: info.enemyPos,
                           sidePos: info.allyPos, zones, mines,
                           hotspots: info.hotspots, sceneBg, seamless: true,
                           cam: (typeof fCur._cam === "number") ? fCur._cam : null };
    this.startEncounterFight(info.enemy);
    this._caveFightCfg = null;
    const c = this._combat;
    if (c && c.enemies[0]) {
      const e0 = c.enemies[0];
      if (info.sneak) {
        // 偷袭开局：它的注意力全在缠身的绫光上——第一拍是白送你的
        e0.status.dingshen = (e0.status.dingshen || 0) + 1;
        c._log("偷袭得手！墨蛟的凶性全锁在缠身的绫光上，背门冲着你大开——它这一拍动不了。");
      }
      if (info.intel && !info.blown) {
        e0.exposed = 1;
        c._log("观战所得在此兑现——墨蛟出水必先摆尾、左肋旧伤未愈，你一眼盯住了破绽（破绽大开）。");
      } else if (info.blown) {
        e0.shield = (e0.shield || 0) + 14;
        c._log("你的动静早惊了潭底——墨蛟有备而来，黑雾护体（敌护体+14）。");
      }
      if (typeof UI !== "undefined" && UI.renderCombat) UI.renderCombat(c, this._combatMeta);
    }
  },

  // 离开禁地 / 五日强制传出：结算出图
  finishExmap(reason) {
    const s = State.data, x = s.exmap;
    if (!x) return;
    const gained = [];
    Object.entries(x.bag).forEach(([k, n]) => {
      if (n > 0) { State.give(k, n); gained.push(`${DATA.items[k] ? DATA.items[k].name : k}×${n}`); }
    });
    s.exmap = null;
    delete s._caveSnap;
    State.setFlag("jindi_left");
    if (UI.closeExmap) UI.closeExmap();
    this.passTime(1);
    const summary = gained.length ? `清点行囊：${gained.join("、")}。` : "行囊空空。";
    if (reason === "timeup") {
      this.log(`【血色禁地】五日之限已至，血幕轰然闭合——一股巨力裹着你向外抛去。${summary}`, "event");
    } else if (reason === "victory") {
      this.log(`【血色禁地】墨蛟伏诛，深潭归于死寂。你随南宫婉踏出血幕时，残阳正照在禁地门前。${summary}`, "good");
    } else {
      this.log(`【血色禁地】你赶在血幕闭合前从裂口退了出来。${summary}`, "event");
    }
    s.flags.adventured = true;
    if (!s.skills) s.skills = { alchemy: 0, scouting: 0 };
    s.skills.scouting += 3;
    this.checkLifespan();
    this.checkStory();
    State.save();
    UI.renderAll();
  },

  /* ===========================================================
   *  情报面纱：L0 传闻（免费）/ L1 交手自动补全 / L2 买底细（实战回报：料敌必中）
   * =========================================================== */
  _intelIdByEnemyName(name) {
    if (!name || typeof WORLD === "undefined" || !WORLD.intel) return null;
    for (const id of Object.keys(WORLD.intel)) {
      const n = WORLD.npcById ? WORLD.npcById(id) : null;
      if (n && name.indexOf(n.name) >= 0) return id;
    }
    return null;
  },
  // 战斗敌人构造时套用情报（L2=做过功课，料敌必中）
  _applyDossier(enemy) {
    const s = State.data;
    const id = this._intelIdByEnemyName(enemy.name);
    if (id && (s.intel || {})[id] >= 2) enemy._dossier = true;
    return enemy;
  },

  // 情报是双向的：你查人，人也查你（multiply-design 乘法B）。
  // 名声大噪且不藏拙的修士，对手早有耳闻——开局便凝护体严阵以待。
  // 藏拙者无此忧（轻敌→开局剑势），扬名者得风云榜与人情、失战场先手：真实的战略抉择。
  _applyFameWariness(enemy) {
    const s = State.data;
    if (!enemy || !(enemy.qiLayer > 0)) return enemy;        // 凡人不通修仙界消息网
    const reveal = s.revealedRealm != null ? s.revealedRealm : s.realmIndex;
    if ((s.fame || 0) >= 40 && reveal >= s.realmIndex) {
      enemy._wary = true;
    }
    return enemy;
  },
  // 交手自动补全：见过的招，永久记住（无论胜败）
  _recordIntelFromCombat(c) {
    const s = State.data;
    if (!s.intelMoves) s.intelMoves = {};
    c.enemies.forEach(e => {
      const moves = (e.attacks || []).map(a => a.name).filter(Boolean);
      if (e.guardMove && e.guardMove.name) moves.push(e.guardMove.name);
      if (!moves.length && e.atkName) moves.push(e.atkName);
      if (!moves.length) return;
      const key = e.name;
      const seen = new Set(s.intelMoves[key] || []);
      moves.forEach(m => seen.add(m));
      s.intelMoves[key] = [...seen];
      // 对应情报人物：交手即至少 L1
      const id = this._intelIdByEnemyName(e.name);
      if (id) { s.intel = s.intel || {}; if ((s.intel[id] || 0) < 1) s.intel[id] = 1; }
    });
  },
  /* ===========================================================
   *  大陆旅途（world-architecture §1.3）：旅途即内容，不是读条
   *  逐月走段：平安段只记一笔见闻；事件段弹出抉择（复用奇遇管线）；
   *  到达即结算。中途存档退出，重开自动续走（resumeJourney）。
   * =========================================================== */
  _JOURNEY_EVENTS: [
    {
      id: "jr_rumor", weight: 22, title: "茶棚风闻",
      text: "官道旁的茶棚里，几个行脚商人正压着嗓子说话——彩霞山的局势、修仙人的传说，真假掺半。",
      choices: [
        { text: "凑近听一耳朵", effect(s) {
          if (typeof Engine !== "undefined") Engine._tickAmbient && Engine._tickAmbient(1);
          return { text: "你装作歇脚，把几桩传闻听了个全。江湖事，多知道一分是一分。（见闻+）", kind: "event" };
        } },
        { text: "赶路要紧", effect() { return { text: "你灌下一碗粗茶便起身赶路。日头还高，再赶三十里。", kind: "sys" }; } },
      ],
    },
    {
      id: "jr_temple", weight: 16, title: "破庙夜宿",
      text: "天色已晚，前不着村后不着店。道旁一座破败山神庙，檐角的铃铛在风里哑哑作响。",
      choices: [
        { text: "进庙过夜", effect(s) {
          s.mood = Math.min(s.moodMax, s.mood + 4);
          return { text: "你拢了堆火，靠着神像打坐到天明。庙里无鬼，心里无事——难得一夜安眠。（心境+4）", kind: "good" };
        } },
        { text: "夜行赶路", effect(s) {
          s.hp = Math.max(1, s.hp - 5);
          return { text: "你摸黑赶了一夜山路，脚底磨出血泡（气血-5），却也多赶出半日路程。", kind: "sys" };
        } },
      ],
    },
    {
      id: "jr_merchant", weight: 14, title: "受伤的行商",
      text: "道边躺着个捂腹呻吟的行商，货担翻在一旁——像是遭了劫，伤得不轻。",
      choices: [
        { text: "出手救治（药理）", effect(s) {
          s.skills = s.skills || {}; s.skills.alchemy = (s.skills.alchemy || 0) + 1;
          s.silver += 6;
          if (typeof Engine !== "undefined" && Engine.writeLedger) Engine.writeLedger("saved_merchant_road", "官道上救了一名遭劫的行商");
          return { text: "你以药理止血敷创，救回他一命。行商千恩万谢，硬塞来六两碎银（药理+1，纹银+6）——出门在外，谁还没个难处。", kind: "good" };
        } },
        { text: "多一事不如少一事", effect() {
          return { text: "你压低斗笠绕道而行。修仙路上，心硬是本分——只是那呻吟声跟了你一路。", kind: "sys" };
        } },
      ],
    },
    {
      id: "jr_bandit", weight: 16, title: "剪径的毛贼",
      text: "三五个拿刀的汉子从林子里钻出来拦住去路：「此山是我开！留下买路财！」",
      choices: [
        { text: "报上名号", cond: (s) => (s.fame || 0) >= 30, effect(s) {
          return { text: `你眯眼报出名号。为首的汉子脸色一变："彩霞山的……韩爷？！"——一伙人连滚带爬钻回了林子。（名声的旅途红利）`, kind: "good" };
        } },
        { text: "拔剑", effect() {
          if (typeof Engine !== "undefined") Engine._fortuneFight = "bandit";
          return { text: "废话少说——你撂下行囊，剑已出鞘！", kind: "bad" };
        } },
        { text: "破财消灾（纹银5两）", cond: (s) => s.silver >= 5, effect(s) {
          s.silver -= 5;
          return { text: "你丢出一锭碎银。汉子们一哄而散——钱能解决的事，犯不上见血。（纹银-5）", kind: "sys" };
        } },
      ],
    },
    {
      id: "jr_herbs", weight: 12, title: "山坡野生灵草",
      text: "翻过一道山梁，向阳的坡上竟生着几株野灵草——叶尖泛着微光，是入药的好东西。",
      choices: [
        { text: "采了带走", effect(s) {
          State.give("lingcao", 2);
          return { text: "你手脚麻利地采下灵草（灵草+2）。识货的眼睛，走到哪都饿不着。", kind: "good" };
        } },
      ],
    },
  ],

  startJourney(nodeId) {
    const s = State.data;
    if (s.combat || s.journey) return;
    const C = WORLD.continent;
    const node = C.nodes.find(n => n.id === nodeId);
    if (!node || node.silhouette) return;
    const gateMsg = node.gate ? node.gate(s) : null;
    if (gateMsg) { this.toast(`道途未通：${gateMsg}`, true); return; }
    const months = Math.max(1, node.months || 2);
    s.journey = { to: nodeId, toName: node.name, leg: 0, total: months };
    this.log(`你收拾行囊，踏上去「${node.name}」的路——约${months}月行程。江湖路远，晓行夜宿。`, "event");
    this.toast(`启程：${node.name}`);
    UI.closeModal();
    State.save();
    this._journeyLeg();
  },

  // 走一段（1月）。平安则续走；遇事则停下弹抉择（选完自动续走）；走完即到达。
  _journeyLeg() {
    const s = State.data;
    const j = s.journey;
    if (!j) return;
    if (j.leg >= j.total) { this._journeyArrive(); return; }
    j.leg += 1;
    this.passTime(1);
    if (s.combat || s.pendingEvent) { State.save(); UI.renderAll(); return; }   // 旅途被世界打断（剧情/战斗）：事毕由钩子续走
    // 40% 遇事，60% 平安
    if (Math.random() < 0.4) {
      const pool = this._JOURNEY_EVENTS.filter(e => !e.cond || e.cond(s));
      const sum = pool.reduce((a, e) => a + (e.weight || 10), 0);
      let r = Math.random() * sum, pick = pool[0];
      for (const e of pool) { r -= (e.weight || 10); if (r <= 0) { pick = e; break; } }
      this._pendingFortune = {
        title: `旅途 · ${pick.title}`, text: pick.text,
        choices: pick.choices.filter(c => !c.cond || c.cond(s)).map(c => ({ text: c.text, effect: c.effect })),
      };
      this.log(`【旅途】第${j.leg}月：${pick.title}。`, "sys");
      State.save();
      UI.renderAll();
      UI.openFortune(this._pendingFortune);
      return;   // 等玩家抉择，chooseFortune 钩子续走
    }
    this.log(`【旅途】第${j.leg}月：晓行夜宿，一路无话。${j.toName}又近了些。`, "sys");
    State.save();
    UI.renderAll();
    this._journeyLeg();
  },

  _journeyArrive() {
    const s = State.data;
    const j = s.journey;
    if (!j) return;
    s.journey = null;
    const C = WORLD.continent;
    const node = C.nodes.find(n => n.id === j.to);
    // 舆图墨痕：走过的路，地图记得
    s.visitedNodes = s.visitedNodes || ["caixia"];
    if (node && !s.visitedNodes.includes(node.id)) s.visitedNodes.push(node.id);
    this.log(`风尘仆仆，你终于抵达「${j.toName}」。`, "good");
    if (typeof Sfx !== "undefined") Sfx.play("chime");
    // 有地区层的节点：落脚其首地点
    if (node && node.locs && node.locs.length) {
      s.location = node.locs[0];
      // 黄枫谷：入谷即开新篇（驻地章——百药园三年的主场）
      if (node.id === "huangfeng" && !s.flags.huangfeng_entered) {
        State.setFlag("huangfeng_entered");
        if (typeof Chapters !== "undefined") { Chapters.unlock("huangfeng"); s.activeChapter = "huangfeng"; }
        this.log("【黄枫谷篇 · 启】青石阶尽头，仙鹤掠过山门。接引修士领你登记名册、发放青衫与居所腰牌——「外门弟子韩立，先去百药园报到吧。」（本篇主线：百药园三年/筑基丹恩怨/血色禁地——后续版本陆续开放。当下练气八层之路已开，洞府诸事可自由经营。）", "event");
        this.addMilestone("入黄枫谷：外门弟子", "breakthrough");
        this.toast("黄枫谷篇 · 启（练气上限已放开至十三层）");
      }
      State.save(); UI.renderAll();
      return;
    }
    // 事件型节点（v1：青牛镇探家）
    if (node && node.visit === "home") { this._homeVisit(); return; }
    State.save(); UI.renderAll();
  },

  // 探家（青牛镇）：仙凡有别的最初一课——你在山上修行，他们在山下老去
  _homeVisit() {
    const s = State.data;
    const yrs = Math.max(1, s.age - 10);   // 十岁离家
    // 离门远行 · 拜别版：此去修仙路远，归期无定（动漫第8集：远行前回家做最后的告别）
    if (s.flags.arc1_complete && !s.flags.home_farewell) { this._homeFarewell(yrs); return; }
    this._pendingFortune = {
      title: "韩家小院",
      text: `柴门虚掩，院里的老槐树又粗了一圈。娘正在灶间忙活，听见脚步声回头——愣了半晌，手里的瓢"哐当"落了地："二……二郎？！"\n\n爹闻声从田里赶回来，烟杆在手里直抖。你离家已${yrs}年，爹娘鬓边的白发，比记忆里多了太多。`,
      choices: [
        {
          text: "住上几日，陪爹娘说说话（+1月）",
          effect(sd) {
            Engine.passTime(1);
            sd.mood = Math.min(sd.moodMax, sd.mood + 10);
            sd.demon = Math.max(0, sd.demon - 8);
            sd.silver = Math.max(0, sd.silver - 4);
            Engine.writeLedger("home_visited_qixuan", "七玄门学艺期间回乡探望过爹娘");
            Engine.addMilestone("回乡探亲：韩家小院的灯火", "deed");
            return { text: "你陪爹下了几日田，帮娘添了新棉被，又留下几两银子（纹银-4）。临走那晚，娘做了一桌子菜，爹破例多喝了两碗酒，红着眼说不出话。\n\n（心境+10，心魔-8）——山上的日子再苦，想起这盏灯火，便有了来处。", kind: "good" };
          },
        },
        {
          text: "放下银两，当夜便走（修行要紧）",
          effect(sd) {
            sd.silver = Math.max(0, sd.silver - 8);
            sd.mood = Math.min(sd.moodMax, sd.mood + 3);
            return { text: "你把八两银子压在枕下，天不亮就启程了。娘追出门塞给你一包干粮，站在村口望了很久。\n\n（纹银-8，心境+3）——你不敢回头。修仙人最怕的不是妖兽，是这一眼。", kind: "event" };
          },
        },
      ],
    };
    State.save();
    UI.renderAll();
    UI.openFortune(this._pendingFortune);
    // 探家结束后：归程提示由 chooseFortune 钩子接管（_afterHomeVisit）
    this._afterFortuneHook = "homeReturn";
  },

  // 拜别（离门远行版回乡）：此去山高水长——小妹的亲事、爹娘的白发、压在枕下的银子
  _homeFarewell(yrs) {
    const s = State.data;
    this._pendingFortune = {
      title: "韩家小院 · 拜别",
      text: `院里晒着新收的豆子，娘的背比上次又驼了些。这次回来，你带的是一个谁也不能说的消息——你要去很远的地方，去过一种他们无法想象的日子。\n\n饭桌上，娘絮絮说着小妹的亲事：邻村的后生，老实，家里有几亩水田，开春就办喜事。爹闷头喝酒，半晌冒出一句："山上的差事……还顺当吗？"\n\n你说顺当。你说要随门派远行，三年五载回不来。灯花噼啪响了一声，谁都没再说话。`,
      choices: [
        {
          text: "住到小妹出嫁，再启程（+2月）",
          effect(sd) {
            Engine.passTime(2);
            sd.mood = Math.min(sd.moodMax, sd.mood + 12);
            sd.demon = Math.max(0, sd.demon - 10);
            sd.silver = Math.max(0, sd.silver - 10);
            Engine.writeLedger("home_farewell_wedding", "留到小妹出嫁才远行");
            Engine.addMilestone("拜别：小妹出嫁，你在席上", "deed");
            State.setFlag("home_farewell");
            State.setFlag("demon_seed_sister");   // 心魔种子：花轿远去的背影（突破心魔战素材）
            return { text: "喜宴那日你坐在末席，看小妹蒙着红盖头给爹娘磕头。花轿抬出村口时，她忽然掀帘回头，朝你这边望了一眼。\n\n你在心里说：二哥对不住你，往后不能护着你了。\n\n临行前夜，你把三十两银子缝进娘的旧棉袄，又在房梁上压了张字条——若有急难，去彩霞山下托人带话。（心境+12，心魔-10，纹银-10）\n\n走出村口那一步，你没有回头。", kind: "good" };
          },
        },
        {
          text: "盘桓三日，放下银两便走（道途催人）",
          effect(sd) {
            sd.silver = Math.max(0, sd.silver - 15);
            sd.mood = Math.min(sd.moodMax, sd.mood + 4);
            sd.demon = Math.min(100, sd.demon + 4);
            Engine.writeLedger("home_farewell_haste", "未等小妹出嫁便匆匆远行");
            Engine.addMilestone("拜别：来去匆匆", "deed");
            State.setFlag("home_farewell");
            State.setFlag("demon_seed_sister");
            return { text: "第三日鸡鸣，你留下十五两银子和一句『山上事忙』，踏霜出门。\n\n走到村口老槐树下，身后传来小妹的喊声：「二哥！我成亲你回来不？」\n\n你挥了挥手，没有应声——修仙人最怕许诺。（心境+4，心魔+4，纹银-15）\n\n这一眼回望，往后许多年里，会在你闭关入定时一遍遍回来找你。", kind: "sys" };
          },
        },
      ],
    };
    State.save();
    UI.renderAll();
    UI.openFortune(this._pendingFortune);
    this._afterFortuneHook = "homeReturn";
  },

  // 旅途续走钩子：奇遇抉择/战斗结束后调用
  _resumeJourneyIfAny() {
    const s = State.data;
    // 探家归程：提供返程旅途
    if (this._afterFortuneHook === "homeReturn") {
      this._afterFortuneHook = null;
      const back = WORLD.continent.nodes.find(n => (n.locs || []).includes("yaolu"));
      if (back) {
        s.journey = { to: back.id, toName: back.name, leg: 0, total: back.months || 1, back: true };
        this.log(`乡情已了，你辞别爹娘，踏上归山之路。`, "sys");
        State.save();
        this._journeyLeg();
      }
      return true;
    }
    if (s.journey && !s.combat && !s.pendingEvent && !this._pendingFortune) {
      this._journeyLeg();
      return true;
    }
    return false;
  },

  // 启动恢复：中途存档退出的旅途，重开自动续走
  resumeJourney() {
    const s = State.data;
    if (s.journey && !s.combat && !s.pendingEvent) {
      this.log(`（你仍在去「${s.journey.toName}」的路上——继续赶路。）`, "sys");
      this._journeyLeg();
    }
  },

  /* ===========================================================
   *  因果账本（world-architecture §3）：插曲种因，主线读账
   *  设计三律：变数必有近响+远雷；改参数不改骨架；负因也是内容。
   * =========================================================== */
  writeLedger(id, label) {
    const s = State.data;
    s.ledger = s.ledger || {};
    if (s.ledger[id]) return false;   // 一因一记
    s.ledger[id] = { t: `第${s.year}年${s.month}月`, label };
    this.log(`【因果】${label}——此事已了，但未必就此了结。`, "sys");
    return true;
  },
  readLedger(id) {
    const s = State.data;
    return !!(s.ledger && s.ledger[id]);
  },
  // 远雷兑现：主线节点结算账本时调用——必须点名出处（投入有形化）
  settleLedger(id, echoText) {
    if (!this.readLedger(id)) return false;
    const entry = State.data.ledger[id];
    this.log(`【因果有报】${echoText}（因起于${entry.t}：${entry.label}）`, "good");
    this.addMilestone(`因果：${entry.label} → 今日有报`, "deed");
    return true;
  },

  /* ===========================================================
   *  名声与风云榜：事迹换名次——"别人眼里的你"
   * =========================================================== */
  addFame(n, why) {
    const s = State.data;
    const before = s.fame || 0;
    s.fame = before + n;
    this.log(`【名声】${why}——江湖名声 +${n}（现 ${s.fame}）`, "event");
    // 超越榜上人物的瞬间：单独播报（扬名时刻）
    if (typeof WORLD !== "undefined" && WORLD.fameBoard) {
      const passed = WORLD.fameBoard.filter(f => before < f.fame && s.fame >= f.fame);
      passed.sort((a, b) => b.fame - a.fame).slice(0, 1).forEach(f => {
        this.log(`【风云榜】茶馆酒肆间，你的名号已盖过「${f.name}（${f.title}）」。江湖排座次，你又上了一阶。`, "good");
        this.addMilestone(`风云榜名次盖过「${f.name}」`, "deed");
        if (typeof Sfx !== "undefined") Sfx.play("chime");
      });
      if (before <= 0 && s.fame > 0) this.toast("你的名字开始在江湖流传（见风云榜）");
    }
  },
  /* ===========================================================
   *  漂亮的赢：胜利的方式也值得记住（勋章）
   * =========================================================== */
  _MEDALS: {
    unscathed: { name: "全身而退", desc: "一场恶战，气血几乎无损——赢得干干净净。", fame: 4 },
    poison_master: { name: "毒手药王", desc: "大半伤害来自淬毒之刃——墨大夫若泉下有知，不知作何感想。", fame: 3 },
    giant_slayer: { name: "以下克上", desc: "击败修为高过自己的对手——以弱胜强，此为大勇。", fame: 8 },
  },
  awardMedal(id) {
    const s = State.data;
    const def = this._MEDALS[id];
    if (!def) return;
    s.medals = s.medals || {};
    const count = (s.medals[id] || 0) + 1;
    s.medals[id] = count;
    if (count === 1) {
      this.log(`【勋章】「${def.name}」——${def.desc}（首次达成，载入年表）`, "good");
      this.addMilestone(`勋章「${def.name}」：${def.desc}`, "medal");
      this.addFame(def.fame, `「${def.name}」的事迹传开`);
      if (typeof Sfx !== "undefined") Sfx.play("success");
    } else {
      this.toast(`勋章「${def.name}」×${count}`);
      if (count === 3 || count === 5 || count === 10) this.addFame(2, `屡次「${def.name}」，江湖侧目`);
    }
  },
  // 战斗胜利后的"赢法"判定
  _checkMedals(c) {
    const s = State.data;
    if (!c || c.status !== "win") return;
    const p = c.player;
    // 全身而退：恶战之后气血≥九成五
    if (p.hp >= Math.round(p.hpMax * 0.95)) this.awardMedal("unscathed");
    // 毒手药王：毒伤占比过半
    const stats = c.stats || {};
    const total = Object.values(stats).reduce((a, b) => a + b, 0);
    const poison = stats["淬毒"] || 0;
    if (total > 0 && poison / total >= 0.5) this.awardMedal("poison_master");
    // 以下克上：任一敌人的灵气底子高过自己
    const myLayer = p.qiLayer || 1;
    if ((c.enemies || []).some(e => (e.qiLayer || 0) > myLayer)) this.awardMedal("giant_slayer");
  },

  // 花灵石买底细（小算盘的门路）
  buyIntel(npcId) {
    const s = State.data;
    if (State.count("lingshi") < 1) { this.toast("需要灵石 ×1", true); return; }
    if ((s.intel || {})[npcId] >= 2) { this.toast("底细已尽在掌握"); return; }
    State.take("lingshi", 1);
    s.intel = s.intel || {};
    s.intel[npcId] = 2;
    const n = WORLD.npcById(npcId);
    const info = (WORLD.intel || {})[npcId];
    this.log(`【底细】你花了一块灵石，从小算盘处买到「${n ? n.name : npcId}」的底细：${info ? info.l2 : ""}（与其交手时，你将料敌于先）`, "good");
    this.toast("底细到手：交手时料敌必中");
    State.save();
    UI.renderAll();
  },

  // 异闻妖王：听闻其名（投放）——威名先至，相遇在后
  _maybeBeastRumor(chance) {
    const s = State.data;
    if (s.beastRumor) return;
    if (typeof WORLD === "undefined" || !WORLD.beastRumors) return;
    const pool = WORLD.beastRumors.filter(r => !(s.slainBeasts || []).includes(r.id));
    if (!pool.length || Math.random() > chance) return;
    const r = pool[Math.floor(Math.random() * pool.length)];
    s.beastRumor = r.id;
    s.beastRumorClue = 0;
    this.log(`【异闻】${r.rumor}`, "event");
    this.toast("听到一桩异闻（见际遇栏）");
    if (typeof Sfx !== "undefined") Sfx.play("chime");
  },
  // 当前是否身处彩霞山一带（后山可及）——异闻只在此处的山野风声里酝酿
  _nearHoushan() {
    const s = State.data;
    if (typeof WORLD === "undefined" || !WORLD.continent) return false;
    const caixia = (WORLD.continent.nodes.find(n => n.id === "caixia") || {}).locs || [];
    return caixia.includes(s.location);
  },
  // 异闻链 · 随时间渐起（听闻→寻踪→相遇）：山里的风声会自己找上门，不必非要深入后山才撞见
  _tickBeastRumor(months) {
    const s = State.data;
    if (typeof WORLD === "undefined" || !WORLD.beastRumors) return;
    if (!this._nearHoushan()) return;
    if (!s.beastRumor) {
      // 听闻：身在彩霞山，约 18%/月 听到一桩新异闻（比"深入后山30%"更易撞上）
      this._maybeBeastRumor(clamp(0.18 * months, 0, 0.4));
      return;
    }
    // 寻踪：身负异闻时，随月份逐条浮现线索——把"突然弹一条"拉成有铺垫的逼近
    const r = WORLD.beastRumors.find(x => x.id === s.beastRumor);
    if (!r || !r.clues || !r.clues.length) return;
    s.beastRumorClue = s.beastRumorClue || 0;
    if (s.beastRumorClue >= r.clues.length) return;
    if (Math.random() > clamp(0.34 * months, 0, 0.6)) return;
    this.log(`【异闻】${r.clues[s.beastRumorClue]}`, "event");
    s.beastRumorClue++;
    if (typeof Sfx !== "undefined") Sfx.play("chime");
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
    // 洞府加成：灵泉眼吐灵，闭关事半功倍（dongfu_pick 抉择的长期兑现）
    const dongfuMul = s.flags.dongfu_type === "lingquan" ? 1.15 : 1;
    const perMonth = Math.max(1, Math.round(base * root.cul * moodFactor * demonPenalty * dongfuMul));
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

    // （考据修正 2026-06-11：火弹术等小法术皆出自《长春功》后篇——
    //   太南小会购得 changchun_full 研习后自然入池，不再有"残页自悟"径。）

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
    if (roll < 0.26) {
      // 顿悟
      const bonus = Math.round(gain * 0.4) + 5;
      s.cultivation += bonus;
      if (Math.random() < 0.4) s.insight += 1;
      this.log("闭关插曲·顿悟：枯坐之中，你忽有所悟，《长春功》的运转豁然顺畅。修为额外+" + bonus + "，悟性或有精进。", "good",
        { label: "闭关顿悟", prompt: "描写主角闭关枯坐中忽然顿悟、《长春功》运转豁然顺畅的一瞬（一两句，不提具体数值）。" });
    } else if (roll < 0.50) {
      // 走火入魔
      const dmg = Math.round(s.hpMax * (0.15 + months * 0.01));
      s.hp = clamp(s.hp - dmg, 1, s.hpMax);
      s.demon = clamp(s.demon + 10 + Math.floor(months / 3), 0, 100);
      this.log(`闭关插曲·走火入魔：苦修过深，灵力一时逆冲经脉！你气血翻涌(气血-${dmg})，心魔大涨。修仙岂能急于求成。`, "bad");
    } else if (roll < 0.66) {
      // 心魔幻象：故人入梦（按经历演变，孤独苦修的代价）
      this._demonDream(months);
    } else if (roll < 0.84) {
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

  // 心魔幻象：长夜枯坐，故人入梦。梦随经历变化，勘破与否看悟性与心境。
  _demonDream(months) {
    const s = State.data;
    // 按剧情进度挑一段最切身的梦境
    let dream;
    if (s.flags.jinguang_dead) {
      dream = "梦里金光上人立在你榻前，半边脸还淌着血，咧嘴一笑：「以毒杀人者，他日必死于暗算。」";
    } else if (s.flags.modafu_dead || s.flags.is_modafu) {
      dream = "梦里墨大夫坐在药庐的老位置上煎药，头也不抬：「你我之间，差的不过是一次机会。你比我心狠，很好。」";
    } else if (s.flags.zhangtie_fated || s.flags.zhangtie_dead) {
      dream = "梦里张铁还是入门那天的样子，挠着头冲你笑：「韩立，等你出息了，可别忘了俺。」你想喊他，喉咙却发不出声。";
    } else {
      dream = "梦里你回到青牛镇的土屋，娘在灯下缝衣，爹蹲在门槛上抽旱烟。没人看见你——你已经不属于那里了。";
    }
    const seeThrough = Math.random() < 0.30 + s.insight * 0.03 + (s.mood / s.moodMax) * 0.15;
    if (seeThrough) {
      s.demon = clamp(s.demon - 6, 0, 100);
      s.insight += 1;
      this.log(`闭关插曲·心魔幻象：${dream}　你于梦中霍然睁眼，看破这是心魔作祟——执念既见，便不再是暗处的刺。心魔-6，悟性+1。`, "good",
        { label: "勘破心魔", prompt: "主角在长期闭关中梦见故人、识破心魔幻象后心境澄明。用一两句沉静苍凉的笔触描写醒来的瞬间，不提数值。" });
    } else {
      s.demon = clamp(s.demon + 8, 0, 100);
      s.mood = clamp(s.mood - 6, 0, s.moodMax);
      this.log(`闭关插曲·心魔幻象：${dream}　你惊醒时一身冷汗，静室里只有自己的呼吸声。修仙是条孤路，越往前走，梦越缠人。心魔+8。`, "bad",
        { label: "心魔入梦", prompt: "主角闭关中被故人梦境所扰、惊醒后枯坐到天明。用一两句孤寂的笔触描写，不提数值。" });
    }
  },

  // 闭关研习功法：习得一卷已持有的功法典籍（耗时）
  studyTechnique(techId) {
    const s = State.data;
    if (s.combat || s.pendingEvent) { this.toast("此刻分身乏术，难以静心研习", true); return; }
    if (typeof Loadout === "undefined") return;
    const def = DATA.techniques[techId];
    const r = Loadout.learnTechnique(s, techId);
    if (!r.ok) { this.toast(r.reason, true); return; }
    this.passTime(3);
    this.log(`你闭关静心研习《${def.name}》，初窥门径，自此习得此功法。可在「功法」中设为主修或辅修。`, "good");
    this.toast(`习得功法：${def.name}`);
    this.checkLifespan();
    State.save();
    UI.renderAll();
  },

  // 当前可研习的功法（持有典籍、未习得、未锁）
  studyableTechniques() {
    const s = State.data;
    if (typeof Loadout === "undefined") return [];
    return Object.keys(DATA.techniques).filter(id => {
      const def = DATA.techniques[id];
      const bookId = def.book;
      return bookId && State.count(bookId) > 0 && !def.locked && !Loadout.isLearned(s, id);
    });
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
        this.log(this._randomRumor(), "sys",
          { label: "市井传闻", prompt: "在「" + (State.location() ? State.location().name : "此地") + "」听到一句市井传闻，写一句即可，要符合当下世道：" });
        break;
      case "npc": {
        const npc = WORLD.randomNpc ? WORLD.randomNpc(loc.id, s) : null;
        if (npc) {
          const isNew = Engine.meetNpc(npc.id);
          const line = (npc.lines && npc.lines.length) ? npc.lines[Math.floor(Math.random() * npc.lines.length)] : (npc.line || "");
          if (!isNew) this.log(`你在${loc.name}又遇见「${npc.name}」（${npc.role}）。${line ? npc.name + "道：「" + line + "」" : ""}`, "event");
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
    // 奇遇选项可声明引发战斗（如硬闯野狼帮关卡）
    if (this._fortuneFight) {
      const enemy = this._fortuneFight;
      this._fortuneFight = null;
      State.save();
      this.startEncounterFight(enemy);
      return;
    }
    // 摊位重开：连续交易类奇遇（钟吾的摊——买完一样还能再买）
    if (choice.reopen === "zhongwu" && s.exmap) {
      State.save();
      if (UI.renderExmap) UI.renderExmap();
      this._exmapZhongwu();
      return;
    }
    // 旅途中的抉择已了：继续赶路（旅途即内容）
    if (this._resumeJourneyIfAny()) return;
    this.checkLifespan();
    this.checkStory();
    if (s.exmap && UI.renderExmap) UI.renderExmap();
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

  /* -------- 突破成功率计算（小境界·水到渠成时的直接成功率）-------- */
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

  // 下一境界（可能为 null）
  _nextRealm() { return DATA.realms[State.data.realmIndex + 1]; },

  // 这一步是否为「大境界」突破（大境界序 tier 改变 = 渡劫式破关）
  isBigRealmBreakthrough() {
    const cur = State.realm();
    const nxt = this._nextRealm();
    return !!(nxt && nxt.tier !== cur.tier);
  },

  // 大境界对应的破关秘仪配置（按目标 tier 索引）
  _bigRealmRite() {
    const nxt = this._nextRealm();
    if (!nxt) return null;
    return (DATA.bigRealmRites && DATA.bigRealmRites[nxt.tier]) || null;
  },

  // 校验大境界秘仪的前置准备，返回 { ok, items:[{label,ok}] }
  checkRite() {
    const s = State.data;
    const realm = State.realm();
    const rite = this._bigRealmRite();
    if (!rite) return { ok: true, items: [] };
    const items = (rite.require || []).map(req => {
      let ok = false;
      if (req.kind === "item") ok = State.count(req.id) >= (req.n || 1);
      else if (req.kind === "flag") ok = !!s.flags[req.key];
      else if (req.kind === "stat") {
        if (req.key === "spiritRatio") ok = s.spirit >= realm.spMax * req.min;
        else if (req.key === "moodRatio") ok = s.mood >= s.moodMax * req.min;
        else if (req.key === "demonMax") ok = s.demon <= req.min;
        else ok = (s[req.key] || 0) >= req.min;
      }
      return { label: req.label || req.id, ok };
    });
    return { ok: items.every(i => i.ok), items };
  },

  canBreakthrough() {
    const s = State.data;
    const realm = State.realm();
    if (this.atRealmCap()) return { ok: false, reason: "本篇封顶练气期。筑基乃后话，需「筑基丹」与机缘，黄枫谷篇再续。" };
    // 长春功前篇止于七层：冲八层须《长春功·后篇》（太南小会丹药换购——大件 gating）
    if (s.realmIndex >= 6 && DATA.realms[s.realmIndex + 1] && DATA.realms[s.realmIndex + 1].tier === "qi"
        && !(typeof Loadout !== "undefined" && Loadout.isLearned(s, "changchun_full"))) {
      return { ok: false, reason: "《长春功》前篇止于七层，再往上无诀可依。须得后篇全本（听闻太南小会上偶有流出），方能冲击八层。" };
    }
    if (s.cultivation < realm.culMax * 0.6) return { ok: false, reason: "修为尚浅，强行突破必败。再多苦修些时日。" };
    // 大境界：须备齐秘仪
    if (this.isBigRealmBreakthrough()) {
      const rite = this._bigRealmRite();
      const chk = this.checkRite();
      if (!chk.ok) {
        const lack = chk.items.filter(i => !i.ok).map(i => i.label).join("、");
        return { ok: false, reason: `${rite ? rite.name + "：" : ""}破关之资未备齐——尚缺 ${lack}。`, rite, riteCheck: chk };
      }
      return { ok: true, rite, riteCheck: chk };
    }
    return { ok: true };
  },

  /* -------- 执行突破 --------
   * 小境界（同大境界内分层）：心魔低于阈值 → 水到渠成，直接判定成功率；
   *                           心魔高于阈值 → 须先闯「心战」降伏心魔。
   * 大境界（练气→筑基→…）：消耗秘仪之物，必历一场凶险「心魔劫」，败则有跌境之险。
   */
  attemptBreakthrough() {
    const s = State.data;
    const isBig = this.isBigRealmBreakthrough();
    if (isBig) {
      // 消耗破关之物（如筑基丹）
      const rite = this._bigRealmRite();
      if (rite && rite.consume) rite.consume.forEach(c => State.take(c.id, c.n || 1));
      this.passTime(1);
      this.startBreakthroughFight({ big: true, rite });
      return;
    }
    // 小境界：心魔可控则水到渠成，无须心战
    const demonHigh = s.demon > Balance.demonTrialThreshold();
    if (!demonHigh) {
      this.passTime(1);
      const win = Math.random() < this.breakthroughRate();
      this._resolveBreakthroughResult(win);
      State.save();
      UI.renderAll();
      return;
    }
    // 心魔过盛：须闯心战
    this.passTime(1);
    this.startBreakthroughFight({ big: false });
  },

  // 突破成功率构成明细（"准备"的每一项都看得见、可优化）
  breakthroughRateParts() {
    const s = State.data;
    const realm = State.realm();
    const root = State.root();
    const culRatio = clamp(s.cultivation / realm.culMax, 0, 1.2);
    return [
      { label: "冲关底数", v: 0.15 },
      { label: `修为火候（${Math.round(culRatio * 100)}%）`, v: culRatio * 0.55 },
      { label: `灵根资质（${root.name}）`, v: root.breakBonus || 0 },
      { label: `心境（${s.mood}/${s.moodMax}）`, v: (s.mood / s.moodMax) * 0.15 },
      { label: `心魔拖累（${Math.round(s.demon)}）`, v: -(s.demon / 100) * 0.25 },
      { label: s.spirit < realm.spMax * 0.5 ? "灵力不济（<50%）" : "灵力充盈", v: s.spirit < realm.spMax * 0.5 ? -0.1 : 0 },
    ];
  },

  // 突破战结果结算（daoxinRatio：null=顺势水到渠成；0~1=心战收束时道心余裕）
  _resolveBreakthroughResult(win, daoxinRatio) {
    const s = State.data;
    const wasBig = this._btWasBig;
    if (win) {
      const gains = [];
      const poolBefore = Balance.manaPool(Chapters.realmTier(), State.realm().layer,
        (DATA.techniques[s.technique] || {}).grade || 1, s.poolBonus);
      s.realmIndex += 1;
      const nr = State.realm();
      s.cultivation = 0;
      s.spirit = nr.spMax;
      s.sense += wasBig ? 8 : 3; s.body += wasBig ? 5 : 2;
      s.hpMax += wasBig ? 40 : 15; s.hp = s.hpMax;
      if (nr.lifespan) s.lifespan += nr.lifespan;
      s.demon = clamp(s.demon - (wasBig ? 12 : 5), 0, 100);
      // —— 突破的水准刻进气海（用户裁决：灵力池严格随突破水准）——
      // 顺势=水到渠成；心战道心余裕≥70%=道心圆满；<35%=险胜伤了根基
      let poolGain, poolNote;
      if (daoxinRatio == null) { poolGain = wasBig ? 6 : 3; poolNote = "水到渠成，气海拓得开阔"; }
      else if (daoxinRatio >= 0.7) { poolGain = wasBig ? 8 : 4; poolNote = "道心圆满，气海拓得格外开阔"; }
      else if (daoxinRatio < 0.35) { poolGain = wasBig ? 3 : 1; poolNote = "险胜伤了些根基，气海略有滞涩"; }
      else { poolGain = wasBig ? 5 : 2; poolNote = "气海随之拓开"; }
      s.poolBonus = (s.poolBonus || 0) + poolGain;
      const poolAfter = Balance.manaPool(Chapters.realmTier(), nr.layer,
        (DATA.techniques[s.technique] || {}).grade || 1, s.poolBonus);
      gains.push(`灵力池 ${poolBefore} → ${poolAfter}（${poolNote}——突破的水准，刻进了气海）`);
      gains.push(`神识 +${wasBig ? 8 : 3}　体魄 +${wasBig ? 5 : 2}`);
      gains.push(`气血上限 +${wasBig ? 40 : 15}（伤势尽复）`);
      if (nr.lifespan) gains.push(`寿元 +${nr.lifespan} 载`);
      gains.push(`心魔 -${wasBig ? 12 : 5}（道心愈坚）`);
      if (typeof UI !== "undefined" && UI.breakthroughCeremony) UI.breakthroughCeremony(nr, gains, wasBig);
      if (typeof Sfx !== "undefined") Sfx.play("bell");
      if (wasBig) {
        this.log(`心魔劫已渡！你脱胎换骨，正式跻身「${nr.name}」——这一步，多少修士求而不得。`, "good");
      } else {
        this.log(`灵力冲关，经脉拓宽——你顺势突破至「${nr.name}」！`, "good");
      }
      this.addMilestone(`突破「${nr.name}」`, "breakthrough");
      this.toast(`突破成功：${nr.name}`);
      this.checkStory();
    } else {
      if (wasBig) {
        // 大境界渡劫失败：凶险——跌回上一层、重创、心魔暴涨
        const loss = Math.round(s.cultivation * 0.6) + Math.round(State.realm().culMax * 0.3);
        s.cultivation = Math.max(0, s.cultivation - loss);
        const dmg = Math.round(s.hpMax * 0.45);
        s.hp = clamp(s.hp - dmg, 1, s.hpMax);
        s.demon = clamp(s.demon + 25, 0, 100);
        s.mood = clamp(s.mood - 25, 0, s.moodMax);
        this.log(`心魔劫中道心崩动，灵力反噬如怒涛！渡劫失败——你修为大损(-${loss})、气血重创(-${dmg})，心魔几乎吞噬神智。大境界之关，岂容轻忽。`, "bad");
        this.toast("渡劫失败！反受重创", true);
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
    }
    this._btWasBig = false;
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
    // 符箓底牌：背包里有符即自动入战（符是买来就能用的通货，不占技能槽）
    const spells = s.spells.slice();
    const TALIS = (typeof Loadout !== "undefined" && Loadout.TALISMANS)
      || { huoshe_fu: "huoshe_fu", hanbing_fu: "hanbing_fu", jinguang_zhuan: "jinguang_zhuan_charge" };
    Object.entries(TALIS).forEach(([spellId, itemId]) => {
      if (State.count(itemId) > 0 && !spells.includes(spellId)) spells.push(spellId);
    });
    // 法器装备：主动技注入（战斗装备类）+被动属性（State.gearBonus 在各处生效）
    // 法宝出战位（bench）：收起的法宝不入战——元婴期不被筑基期法器撑爆手牌
    ["weapon", "armor", "accessory"].forEach(slot => {
      const g = State.gearOf(slot);
      if (g && g.grantSpells) g.grantSpells.forEach(sk => {
        if ((s.benchTreasures || []).includes(sk)) return;
        if (!spells.includes(sk)) spells.push(sk);
      });
    });
    const dunTrait = State.gearTrait("charge_resist");
    return new CombatAPI.Fighter({
      name: s.name,
      // 伴身件被动面板（v96）：血上限/灵力池/护甲走动态加成（State.sideBonus）
      hp: s.hp + State.sideBonus("hpMax"),
      hpMax: s.hpMax + State.sideBonus("hpMax"),
      armor: State.sideBonus("armor"),
      // 灵力池（v2：统一灵力，整场不刷新；战后按比例回写灵力——连战共享一池）
      // 池深=功法品阶×境界跳档×层成长+突破水准/特殊境遇累计（balance.manaPool，用户裁决）
      // 开战水位=灵力百分比映射（灵力没调息满，开战灵力就不满——打坐与丹药的真实意义）
      mp: (() => {
        const poolMax = Balance.manaPool(Chapters.realmTier(), realm.layer,
          (DATA.techniques[s.technique] || {}).grade || 1, s.poolBonus) + State.sideBonus("mpMax");
        const ratio = clamp(s.spirit / (realm.spMax || s.spirit || 1), 0, 1);
        return Math.max(15, Math.round(poolMax * ratio));
      })(),
      mpMax: Balance.manaPool(Chapters.realmTier(), realm.layer,
        (DATA.techniques[s.technique] || {}).grade || 1, s.poolBonus) + State.sideBonus("mpMax"),
      // 移动力：基础1；身法法器/功法另加（踏云靴时代 move 2）
      move: 1 + (State.gearTrait("swift") ? 1 : 0),
      sense: s.sense + State.gearBonus("sense"),
      speed: State.effectiveSpeed(),
      insight: s.insight,
      gongli: gongli,
      agility: Math.round(State.effectiveSpeed() * 0.6),   // 遁速提供基础闪避
      elem: (DATA.techniques[s.technique] || {}).attr || null,   // 道基=主修功法行属（克制语言）
      chargeResist: dunTrait ? (dunTrait.value || 0.3) : 0,
      spells,
      auxSkills: (typeof Loadout !== "undefined") ? Loadout.auxSkillSet(s) : [],
      technique: s.technique,     // 主修功法（影响同系招式）
      grade: (DATA.techniques[s.technique] || {}).grade || 1,  // 主修功法品阶
      realmTier: Chapters.realmTier(),   // 本章大境界序（影响法术成长）
      momentumCap: s.swordMastery ? 7 : 5,   // 眨眼剑法大成：剑势上限+2
      swordMastery: !!s.swordMastery,        // 大成：眨眼剑法本体蜕变（攒势翻倍）
      // 回灵效率（v96 伴身件管线）：不破"池制不自动回灵"铁律——只加成主动回灵动作
      // （敛息回元/聚灵阵的每口收益+X；蕴灵珠类伴身件由此生效）
      regenBoost: State.gearBonus("regenBoost"),
      qiLayer: realm.layer,                  // 灵气底蕴随练气层数成长
      // 腾空之能（空层 2.5D）：御器飞行（筑基）/风雷翅（后期）/调试旗——有翼方上天
      canFly: !!(s.flags.fly_unlocked || State.gearTrait("fly")),
      // 雷遁穿空（风雷翅时代）：御「风雷翅」方可施雷遁瞬移——未解锁则神雷·遁置灰
      blink: !!State.gearTrait("fenglei"),
      // 飞行档（depth-design D2/D3）：境界即高度——升空高度/视野/凌空身法三联动。
      // 练气·乘器=1（勉强离地），筑基·御器=1，结丹·御空=2，元婴·遁光=3（分档细调归 flight-ladder F0）
      airGrade: Math.max(1, Math.min(3, Chapters.realmTier())),
      // fail-forward：决战每败一次=看破对方几分路数，再战伤害+8%（至多+24%）——
      // 韩立吃的每次亏都是学费（爽文契约：失败向前走）
      dmgBonus: 1 + Math.min(3, (s.flags[`losses_${this._nextFightType || ""}`] || 0)) * 0.08,
      // 底牌：平时准备的毒草、暗器、符箓带进战斗（准备内化进战斗）。
      // 探索中：临时袋里刚采的毒草/暗器当场可用（multiply-design 乘法D——采集即底牌）
      pouch: (() => {
        const bag = (s.explore && !s.explore.finished) ? (s.explore.bag || {}) : {};
        const p = {};
        ["duyao_cao", "anqi", "huoshe_fu", "hanbing_fu", "jinguang_zhuan_charge",
         "huixue_dan", "huiyuan_dan", "dingshen_fu", "zhenqi_kunzu", "zhenqi_juling"].forEach(id => {
          p[id] = State.count(id) + (bag[id] || 0);
        });
        return p;
      })(),
    });
  },

  /* -------- 地火之屋炼筑基丹（筑基丹链的"造"环节：血色主药→二十颗丹的底气）--------
   * 动漫口径：韩立以禁地所采主药炼出二十余颗（旁人三五颗已是高产）——药理与主药数定产量。 */
  lianZhujiDan() {
    const s = State.data;
    if (!s.flags.mojiao_resolved) { this.toast("血色主药未备齐——禁地之行在前"); return; }
    if (s.flags.zhuji_lian_done) { this.toast("筑基丹已炼成，余药不必再耗"); return; }
    const zhuyao = State.count("xueshi_zhuyao");
    if (zhuyao < 4) { this.toast("血色主药不足四株，开炉无意义", true); return; }
    if (State.count("lingcao") < 4) { this.toast("辅药不足：还需灵草×4", true); return; }
    if (!s.skills) s.skills = { alchemy: 0, scouting: 0 };
    // 产量 = 基础6 + 主药×1.5 + 药理加成（动漫20颗口径：6株主药+高药理）
    const n = Math.min(22, Math.round(6 + zhuyao * 1.5 + Math.min(8, (s.skills.alchemy || 0) / 3)));
    State.take("xueshi_zhuyao", zhuyao);
    State.take("lingcao", 4);
    State.give("zhuji_dan", n);
    State.setFlag("zhuji_lian_done");
    s.skills.alchemy += 4;
    this.passTime(3);
    this.log(`【地火之屋】三个月闭门不出。地火翻腾，丹炉九转——开炉那刻，丹香冲得人眼眶发热：筑基丹 ×${n}！寻常弟子三五颗已是高产，你这一炉，够把"伪灵根"三个字砸碎了。（图鉴里那个空位，已无需讨还。）`, "good");
    this.addMilestone(`地火炼丹：筑基丹×${n} 出炉`, "bigitem");
    this.settleLedger("jindi_seat", "禁地名额没有白拼——主药化作了满匣筑基丹");
    this.toast(`筑基丹 ×${n} 入袋！洞府「尝试突破」冲击筑基`);
    if (typeof Sfx !== "undefined") Sfx.play("success");
    this.checkStory();
    State.save();
    UI.renderAll();
  },

  // —— 羁绊·战斗支援（社交深化③）——
  // 交情深厚的具名故人，在你陷战时挺身相助。考据红线：忠于动漫——只让那人来他真会管的仗，
  // 形态按「援者境界 ÷ 这场仗的份量」分三档（用户钦定，world-design 背景强者三态）：
  //   同阶 → 真参战（注入 sides[]，是个能打的帮手）
  //   低阶 → 只辅助（疗伤/护身/递把伞，绝不喧宾夺主——练气帮不上结丹的输出）
  //   高阶 → 只庇护/威压（挡一击、震慑对手露怯，按物理学不白送胜）
  // realm=战力档（凡武1 / 练气初2 中3 后4 / 筑基初6 中7 / 结丹10）；art 仅同阶真参战需要（有战斗立绘者方可上场）。
  _COMBAT_AIDERS: {
    wanxiaoshan:  { realm: 3, art: "wanxiaoshan", elem: "jin", ledger: "wan_hunt_together",
      onField: "「韩兄！这等恶客也敢拦你——算我万小山一个！」他按剑掠到你身侧，背靠了背。",
      atkName: "并肩一剑", atkLine: "斜身一剑递向" },
    nangongwan:   { realm: 7, art: "nangongwan", elem: "shui",
      onField: "一道白衣身影不知何时已立在侧——南宫婉眸光微冷：「韩师弟的符宝，用得很准。这一场，我陪你。」" },
    chenqiaoqian: { realm: 4, elem: "mu", ledger: "met_chen",
      support: "暗处一缕清冷剑光替你逼退了杀招——陈巧倩终究还是循着踪迹来了，只是仍不肯现身。「……那年的债，先还你一点。」" },
    lifeiyu:      { realm: 3, elem: "jin",
      support: "「韩立！你的架我替你抬住！」厉飞雨大笑着抢上半步，硬替你格开一记。" },
    mashibo:      { realm: 3,
      support: "「臭小子别逞强！」马师伯隔空掷来一只温养的药瓶，正落你手里。" },
    xiaosuanpan:  { realm: 2,
      support: "「韩师兄先撑住！」小算盘手忙脚乱甩出几张护身符，倒也解了燃眉。" },
    zhangtie:     { realm: 1, mortalOnly: true,
      support: "「韩立！我来给你搭把手！」张铁抡起象甲功的拳头，憨实地挡在你身前。" },
    wushishu:     { realm: 6,
      protect: "「住手。」吴师叔不疾不徐踏前一步，一身筑基气机如山压来——对方矮了三分。" },
    xiangzhili:   { realm: 8,
      protect: "向之礼眯眼晒着太阳，似笑非笑看了一眼。那股扑面的杀气，竟莫名散了大半。" },
    lihuayuan:    { realm: 10,
      protect: "李化元大长老的一缕神识扫过此地，结丹之威如九天垂落——对手骇得几乎握不住兵刃。" },
  },
  // 仅这两位友方有战斗立绘，可真上场；其余具名故人以辅助/庇护形态相助（无须立绘）。
  _AID_BATTLERS: { wanxiaoshan: 1, nangongwan: 1 },
  // 在场或在附近：同据点节点（continent node）算"附近"——他循着动静赶得过来
  _npcNearby(npcId, s) {
    const n = (typeof WORLD !== "undefined") ? WORLD.npcById(npcId) : null;
    if (!n || (n.cond && !n.cond(s))) return false;
    if (WORLD.localsAt(s.location, s).some(x => x.id === npcId)) return "here";
    const node = (WORLD.continent.nodes || []).find(nd => (nd.locs || []).includes(s.location));
    const nearLocs = node ? (node.locs || []) : [];
    return (n.where || []).some(w => nearLocs.includes(w)) ? "near" : false;
  },
  // 同阶援者的侧位配置：能打，但不喧宾夺主（战力对标这场仗的份量）
  _aidAlly(npcId) {
    if (npcId === "nangongwan") return this._nangongwanAlly();
    const A = this._COMBAT_AIDERS[npcId] || {};
    const nm = ((WORLD.npcById(npcId)) || {}).name || npcId;
    const hp = 56 + (A.realm || 3) * 8;
    const dmg = 8 + (A.realm || 3) * 2;
    return {
      id: "aid_" + npcId, name: nm, kind: "ally", art: A.art || null,
      hp, hpMax: hp, guard: 0.22, elem: A.elem || "jin", move: 1, mp: 40,
      persona: { aggr: 6, prot: 4, kite: 2 },
      moves: [
        { name: A.atkName || "并肩一击", dmg, weight: 10, elem: A.elem || "jin", range: [1, 2], mp: 0, line: A.atkLine || "并肩斫向" },
        { name: "掩护", dmg: Math.round(dmg * 0.5), weight: 5, elem: A.elem || "jin", range: [1, 1], mp: 0, line: "侧身一档，替你挡向" },
      ],
    };
  },
  // 战前判定：是否有深交故人挺身相助（机制咬合：羁绊→战场回报；难忘的一笔，非常驻拐杖）
  // 返回 true=已安排支援（已设 _sideOverride 或 _pendingAidBuff）。门槛层层咬合，触发稀有。
  _maybeCombatAid(enemyId, tmpl) {
    const s = State.data;
    if (this._sideOverride) return false;            // 已有剧情同道（如禁地南宫婉）——不重复
    if ((enemyId || "").indexOf("rogue_cultivator") === 0) return false;  // 副本内讧：同道反目，无人来援
    const abs = (typeof INTERACTIONS !== "undefined") ? INTERACTIONS._absMonth(s) : ((s.year || 0) * 12 + (s.month || 0));
    if (s.aidCd != null && abs - s.aidCd < 3) return false;   // 冷却：是难忘的一笔，不是每仗都有
    const boss = !!tmpl.boss || (enemyId || "").indexOf("beast_") === 0;
    const fightWeight = (tmpl.qiLayer || Math.ceil((tmpl.hp || 60) / 30)) + (boss ? 2 : 0);
    // 候选：交情深厚(≥20)、在场或在附近、在世且条件满足的具名故人
    const cands = [];
    for (const id in this._COMBAT_AIDERS) {
      const rel = (typeof INTERACTIONS !== "undefined") ? INTERACTIONS.relationOf(s, id) : ((s.relations && s.relations[id]) || 0);
      if (rel < 20) continue;
      const A = this._COMBAT_AIDERS[id];
      if (A.mortalOnly && (tmpl.qiLayer || 0) > 1) continue;   // 凡人张铁：只搭得上凡俗打手
      const prox = this._npcNearby(id, s);
      if (!prox) continue;
      cands.push({ id, A, rel, prox, repaid: !!(A.ledger && this.readLedger(A.ledger)) });
    }
    if (!cands.length) return false;
    if (Math.random() > 0.5) return false;            // 是机缘，不是必然
    // 择援：因果有亏者优先(还债)，其次交情深、在场胜在附近
    cands.sort((a, b) => (b.repaid - a.repaid) || (b.rel - a.rel) || ((a.prox === "here" ? 0 : 1) - (b.prox === "here" ? 0 : 1)));
    const pick = cands[0], A = pick.A, gap = (A.realm || 3) - fightWeight;
    const nm = (WORLD.npcById(pick.id) || {}).name || pick.id;
    const echo = pick.repaid ? "——当年那桩因果，今日有了回响。" : "";
    let form;
    if (gap >= 3) form = "protect";          // 高阶：只庇护/威压，不白送胜
    else if (gap <= -2) form = "support";    // 低阶：只辅助，递把伞
    else form = this._AID_BATTLERS[pick.id] ? "fight" : "support";  // 同阶真参战（需战斗立绘），否则暗助
    const myHpMax = (s.hpMax || 100);
    if (form === "fight") {
      this._sideOverride = this._aidAlly(pick.id);
      this._pendingAidBuff = { line: `【并肩·${this._tierName(pick.rel)}】${A.onField || nm + "赶来助阵。"}${echo}`, news: `${nm}与你并肩斩敌`, kind: "good" };
    } else if (form === "protect") {
      this._pendingAidBuff = { shield: Math.round(myHpMax * 0.35), cowEnemy: true,
        line: `【庇护·${this._tierName(pick.rel)}】${A.protect || nm + "出手震慑了对手。"}${echo}`, news: `${nm}出手为你护场`, kind: "event" };
    } else {
      s.hp = Math.min(myHpMax, (s.hp || 0) + Math.round(myHpMax * 0.25));   // 疗伤：战前先补一口（playerFighter 读 s.hp）
      this._pendingAidBuff = { shield: Math.round(myHpMax * 0.18),
        line: `【相助·${this._tierName(pick.rel)}】${A.support || nm + "递来一份相助。"}${echo}`, news: `${nm}暗中助你一臂之力`, kind: "good" };
    }
    s.aidCd = abs;
    return true;
  },
  _tierName(rel) { return rel >= 40 ? "挚交" : "交情深厚"; },

  // 南宫婉（同道侧位卡）：血色禁地并肩战——压制修为至炼气期的掩月宗天骄
  // 人格=背景：掩月宗水法天骄，战斗经验远在你之上——冷静拉距、专抓破绽窗口（接力打法）
  _nangongwanAlly() {
    return {
      id: "nangongwan", name: "南宫婉", kind: "ally", art: "nangongwan",
      hp: 95, hpMax: 95, guard: 0.25, elem: "shui", move: 1,
      // 同规则三件套（用户铁律：侧位与玩家/敌方一个规则）：灵力池+招式耗灵+腾空之能
      mp: 80, canFly: true, airGrade: 2,   // 掩月宗天骄=御空二档（飞得比练气的你高——境界的俯视）
      persona: { aggr: 6, prot: 3, kite: 6 },
      moves: [
        { name: "月华绫", dmg: 16, weight: 12, elem: "shui", range: [1, 3], mp: 4, line: "广袖一扬，月华如练卷向" },
        { name: "素女剑光", dmg: 24, weight: 5, elem: "shui", range: [1, 2], mp: 8, line: "眸光一冷，剑光裂空斩向" },
        { name: "拂尘一掸", dmg: 9, weight: 6, elem: "shui", range: [1, 1], mp: 0, line: "信手一掸，水袖击向" },
      ],
    };
  },

  // 侧位单位（尸傀/灵宠/傀儡）：随行出战的第二单位（combat-arsenal-design.md 轴4）
  sideUnitFor(fightType) {
    const s = State.data;
    const u = s.sideUnit;
    if (!u || u.status === "broken" || u.carry === false) return null;
    if (fightType === "breakthrough") return null;   // 心魔是自己的战斗，外物难援
    return { id: u.id, name: u.name, kind: u.kind || "corpse", hp: u.hp, hpMax: u.hpMax,
             atk: u.atk, atkName: u.atkName, move: u.move != null ? u.move : 1,
             moves: u.moves || null, art: u.art || null,
             elem: u.elem || null, nature: u.nature || null, guard: u.guard || 0.3,
             // 人格（背景即打法）：尸傀无智而忠——护主权重拉满，不抢窗口不惜身
             persona: u.persona || { aggr: 3, prot: 9, kite: 0 } };
  },
  // 升空/落地（空层 2.5D）：把战斗抬进修仙者的天空
  // 灵虫/灵宠形态轮换（化枪/附体/分身——u.forms 定义驱动；血玉蜘蛛单形态，
  // 噬金虫多形态随乱星海篇实装。moves 按形态切表：u.movesByForm[form]）
  cycleSideForm(idx = 0) {
    const c = this._combat;
    const u = c && c.sides ? c.sides[idx] : null;
    if (!c || !u || !u.forms || u.forms.length < 2) return;
    const cur = u.forms.indexOf(u.form || u.forms[0]);
    u.form = u.forms[(cur + 1) % u.forms.length];
    if (u.movesByForm && u.movesByForm[u.form]) u.moves = u.movesByForm[u.form];
    c._log(`「${u.name}」灵性流转，化作${u.form}之形！`);
    if (typeof UI !== "undefined" && UI.renderCombat) UI.renderCombat(c, this._combatMeta);
  },
  // 辟邪神雷三选（v97：单卡点选生效——劈=择敌上膛 / 附=即时 / 遁=即时瞬发）
  combatShenlei(mode) {
    const c = this._combat;
    if (!c || c.status !== "ongoing") return;
    if (mode === "shenlei_pi") {
      // 劈=攻击技：走二次确认（多敌择目标，单敌直放）
      if (typeof UI !== "undefined" && UI.armSpell) UI.armSpell("shenlei_pi");
      return;
    }
    const r = c.cast(mode);   // 附剑/雷遁：自身向，即时生效
    if (!r.ok) { this.toast(r.reason); return; }
    if (typeof Sfx !== "undefined") Sfx.play("thunder");
    if (typeof UI !== "undefined") {
      // 雷遁=待发态：真正的瞬移演出留给移动那一拍（combatMove 的 blink 分支），
      // 施放时只提示，不放消失帧（免得消失帧放两次）
      if (mode !== "leidun" && UI.flashCombat) UI.flashCombat(mode);
      else if (mode === "leidun") this.toast("雷遁待发——点亮起的格子，穿空而至");
      if (UI.flushCombatFx) UI.flushCombatFx(c);
      if (UI.renderCombat) UI.renderCombat(c, this._combatMeta);
      // 神雷附剑·应雷仪式（剑阵此刻已切 lei 态）：群剑齐震 + 金雷环炸开 + 应雷之声
      if (mode === "shenlei_fujian" && UI.leiRitual) UI.leiRitual();
    }
  },
  // 悬浮法宝祭起/收回（三位制·祭出位）
  combatFloat(spellId) {
    const c = this._combat;
    if (!c) return;
    const r = c.playerFloat(spellId);
    if (!r.ok) { this.toast(r.reason); return; }
    if (typeof Sfx !== "undefined") Sfx.play(r.recalled ? "click" : "bell");
    if (typeof UI !== "undefined") {
      if (UI.flushCombatFx) UI.flushCombatFx(c);
      if (UI.renderCombat) UI.renderCombat(c, this._combatMeta);
    }
  },
  combatFly() {
    const c = this._combat;
    if (!c) return;
    const r = c.playerFly();
    if (!r.ok) { this.toast(r.reason); return; }
    if (typeof Sfx !== "undefined") Sfx.play((c.player.alt || 0) === 1 ? "flyUp" : "landDown");
    if (typeof UI !== "undefined") {
      if (UI.flushCombatFx) UI.flushCombatFx(c);
      if (UI.renderCombat) UI.renderCombat(c, this._combatMeta);
    }
    State.save();
  },
  // 简令轮换：随→攻→守→撤（点助战卡）——指挥不是微操，是一句话的事
  // T4 多侧位：idx 指定第几位（每张助战卡各管各的）
  cycleSideStance(idx = 0) {
    const c = this._combat;
    const su = c && c.sides ? c.sides[idx] : (c ? c.side : null);
    if (!c || !su || su.hp <= 0) return;
    // 客随铁律（用户裁决）：境界远高于你的同道全自动——她指挥你（每回合点将），
    // 你指挥不了她。简令四档只对平辈/下属（尸傀/灵宠/低阶同道）生效
    if (su.kind === "ally" && (su.mastery || 0) >= 2) {
      this.toast(`${su.name}的境界远在你之上——接好她递的刀便是`);
      return;
    }
    const order = ["follow", "attack", "guard", "retreat"];
    const cur = order.indexOf(su.stance || "follow");
    c.setSideStance(order[(cur + 1) % 4], idx);   // 简令即阵型：换令同时换排（攻=压上战位/守=贴身僚位/撤=最深排）
    const txt = { follow: "随行——跟你的焦点打", attack: "强攻——压上战位排，下重手专补刀",
                  guard: "护主——贴身代刀，稳字当头", retreat: "后撤——退到阵后自保" }[su.stance];
    this.log(`【简令】${su.name}：${txt}。`, "sys");
    if (typeof UI !== "undefined" && UI.renderCombat) UI.renderCombat(c, this._combatMeta);
  },
  // 战后把侧位单位的损耗写回（hp 归零=破损，须修缮，不会永失——尸傀不死，只是坏了）
  // T4 多侧位：常驻随行（尸傀）按 id 对号回写
  _syncSideBack() {
    const c = this._combat, s = State.data;
    if (!c || !s.sideUnit) return;
    const mine = (c.sides || []).find(x => !x.id || !s.sideUnit.id || x.id === s.sideUnit.id);
    if (!mine) return;   // 全是剧情同道（南宫婉等）——不回写常驻侧位
    s.sideUnit.hp = clamp(Math.round(mine.hp), 0, s.sideUnit.hpMax);
    if (s.sideUnit.hp <= 0 && s.sideUnit.status !== "broken") {
      s.sideUnit.status = "broken";
      this.log(`「${s.sideUnit.name}」在战斗中损毁严重，再难驱使——回药庐以毒物阴材温养修缮，方可复原。`, "bad");
    }
  },

  // 战斗结束后，把战中消耗的底牌写回（探索临时袋优先消耗，再扣主背包）
  _syncPouchBack() {
    const c = this._combat;
    if (!c) return;
    const s = State.data;
    const p = c.player.pouch || {};
    const bag = (s.explore && !s.explore.finished) ? (s.explore.bag || {}) : null;
    ["duyao_cao", "anqi", "huoshe_fu", "hanbing_fu", "jinguang_zhuan_charge",
     "huixue_dan", "huiyuan_dan", "dingshen_fu", "zhenqi_kunzu", "zhenqi_juling"].forEach(id => {
      const left = p[id] || 0;
      const had = State.count(id) + (bag ? (bag[id] || 0) : 0);
      let used = had - left;
      if (used <= 0) return;
      if (bag && bag[id]) {
        const fromBag = Math.min(bag[id], used);
        bag[id] -= fromBag;
        if (!bag[id]) delete bag[id];
        used -= fromBag;
      }
      if (used > 0) State.take(id, used);
    });
  },

  // 普通遭遇战
  startEncounterFight(enemyId) {
    const s = State.data;
    const tmpl = WORLD.enemies[enemyId];
    if (!tmpl) { this.log("虚惊一场，并无敌踪。", "sys"); return; }
    const enemy = this._applyFameWariness(this._applyDossier(Object.assign({}, tmpl)));
    // 羁绊·战斗支援（社交深化③）：深交故人或挺身并肩、或暗中相助、或以威压庇护——可能设 _sideOverride/_pendingAidBuff
    this._maybeCombatAid(enemyId, tmpl);
    // 侧位（T4 多侧位）：剧情同道（_sideOverride，可单可数组）与常驻随行（尸傀）同场
    const ov = this._sideOverride;
    const sidesArr = (Array.isArray(ov) ? ov.slice() : ov ? [ov] : []);
    const perm = this.sideUnitFor("encounter");
    if (perm && !sidesArr.some(x => x.id && perm.id && x.id === perm.id)) sidesArr.push(perm);
    this._sideOverride = null;
    // L3 轴式洞窟开战：战场宽度/站位/阵法/伏着从探索轴无缝继承（_caveFightCfg 一次性）
    const caveCfg = this._caveFightCfg || {};
    // 场景即战场：宽度随地点开阔度展开（9~27），接敌距离照旧——多出来的全是身后与侧翼
    const sceneW = caveCfg.W || this._fieldWidthFor(s.location);
    const engage = Math.min(sceneW - 2, (tmpl.engageDist || (enemyId.indexOf("beast_") === 0 ? 6 : 7)));
    this._combat = new CombatAPI.Combat(Object.assign({
      player: this.playerFighter(),
      enemies: [enemy],
      maxRounds: sceneW > 12 ? 26 : 20,
      sides: sidesArr,
      W: sceneW,
      // 排数与格数同源（2.5 排制）：都看真实战场多大——洞窟憋仄 2 排，旷野 3 排
      lanes: caveCfg.lanes != null ? caveCfg.lanes : (caveCfg.seamless ? 2 : this._fieldLanesFor(s.location, sceneW)),
      enemyPos: caveCfg.enemyPos != null ? caveCfg.enemyPos : Math.min(sceneW - 1, 1 + engage),
    }, caveCfg));
    if (enemy._wary) {
      this._combat.enemies[0].shield = 12;
      this.log(`「${tmpl.name}」眯起眼："彩霞山那位……久闻大名。"——你的名声在外，对方早有防备（开局护体12）。`, "sys");
    }
    // 羁绊·战斗支援兑现：护体/疗伤已在 _maybeCombatAid 安排，此处落地到战场单位 + 见闻/风云录留痕
    if (this._pendingAidBuff) {
      const b = this._pendingAidBuff; this._pendingAidBuff = null;
      if (b.cowEnemy && this._combat.enemies[0]) this._combat.enemies[0].shield = 0;
      if (b.shield) this._combat.player.shield = (this._combat.player.shield || 0) + b.shield;
      if (b.line) this.log(b.line, b.kind || "event");
      if (b.news) {
        s.worldNews = s.worldNews || [];
        s.worldNews.push({ t: `第${s.year}年${s.month}月`, kind: "fortune", text: `【羁绊】${b.news}。` });
        if (s.worldNews.length > 40) s.worldNews.splice(0, s.worldNews.length - 40);
      }
    }
    // 速决资格：境界压人一头的寻常遭遇（异闻妖王与剧情 boss 除外——有名有姓的仗值得亲手打）
    const myLayer = (State.realm() || {}).layer || 1;
    const canQuick = enemyId.indexOf("beast_") !== 0 && !tmpl.boss
      && myLayer - (tmpl.qiLayer || Math.ceil((tmpl.hp || 60) / 30)) >= 2;
    this._combatMeta = { type: "encounter", reward: tmpl.reward, enemyName: tmpl.name, canQuick,
      namedBeast: enemyId.indexOf("beast_") === 0 ? enemyId : null, namedLoot: tmpl.namedLoot || null,
      sceneBg: caveCfg.sceneBg || null, seamless: !!caveCfg.seamless };
    // 镜头交接：探索镜头的位置原样带进战斗——开战那一拍，画框不跳
    if (caveCfg.cam != null) this._combat._cam = Math.max(0, Math.min(sceneW - 11, caveCfg.cam));
    State.data.combat = true;
    this._combat.startRound();
    this.log(`你在${State.location().name}遭遇「${tmpl.name}」，斗法一触即发！`, "bad");
    UI.openCombat(this._combat, this._combatMeta);
  },

  // 决战墨大夫：三阶段波次。准备（毒、暗器）内化为战斗底牌——带得越多越能赢
  startShowdownFight() {
    const s = State.data;
    this._nextFightType = "showdown";
    const player = this.playerFighter();
    player.hp = s.hpMax; player.hpMax = s.hpMax; // 决战前默认满血上场

    const modafu = { name: "墨大夫", hp: 52, sense: 6, speed: 9, agility: 4, move: 1, mp: 46, tactics: "cunning", qiLayer: 4, elem: "mu",
      attacks: [{ name: "毒掌", dmg: 12, kind: "normal", weight: 12, range: [1, 2], mp: 5 }, { name: "腐骨毒针", dmg: 14, pierce: true, kind: "pierce", weight: 8, mp: 7 }] };
    const tienu  = { name: "铁奴（张铁尸傀）", hp: 70, nature: "corpse", sense: 3, speed: 6, agility: 4, move: 2, tactics: "feral",
      introNote: "铁奴乃尸傀死物——尸无血脉，百毒不侵！毒计无用，须以剑与暗器正面强攻。",
      attacks: [{ name: "尸傀挥击", dmg: 14, kind: "normal", weight: 14 }, { name: "崩山重捶", dmg: 19, kind: "charge", weight: 6, aim: "cell" }] };
    const yuhun  = { name: "余子童元神", hp: 40, nature: "ghost", sense: 18, speed: 14, agility: 8, move: 2, mp: 50, gongli: 22, qiLayer: 6,
      introNote: "元神无形无质——剑、毒、暗器皆穿身而过！唯「运功镇魂」能伤其分毫，神魂镇压正是鬼魅克星。稳住心神！",
      attacks: [{ name: "夺舍侵神", dmg: 11, soul: true, kind: "normal", weight: 12, range: [1, 4], mp: 6 }] };   // 失了傀儡与皮囊的虚弱残魂

    this._combat = new CombatAPI.Combat({
      player,
      enemies: [this._applyDossier(modafu)],
      waves: [[tienu], [yuhun]],
      maxRounds: 16,
    });

    this._combatMeta = { type: "showdown" };
    s.combat = true;
    this._combat.startRound();
    const duCount = State.count("duyao_cao"), anCount = State.count("anqi");
    this.log(`夺舍之夜，决战开始！你怀揣 毒草×${duCount}、暗器×${anCount} 作底牌——能否反杀，全看准备。`, "event");
    // 扮猪吃虎的兑现时刻：深藏的修为在此一刻尽数亮出（藏得越深，雷霆越烈）
    const hidden = s.realmIndex - (s.revealedRealm != null ? s.revealedRealm : s.realmIndex);
    if (hidden >= 1) {
      const realRealm = State.realm().name;
      this._combat.enemies.forEach(e => { e.dodgeBuff = (e.dodgeBuff || 0) - 0.1; });
      this._combat._log(`墨大夫瞳孔骤缩，声音都变了调："什么？！你……你竟然已是${realRealm}——这不可能！！"`);
      this._combat._log(`【扮猪吃虎】深藏 ${hidden} 层修为今夜尽数亮出——敌方心神大乱、破绽尽显（首回合更易命中）！`);
      this.log(`你周身气机轰然炸开——深藏 ${hidden} 层的修为，今夜终于不必再藏！`, "good");
      this.addMilestone(`扮猪吃虎：夺舍之夜亮出${realRealm}`, "medal");
      if (typeof Sfx !== "undefined") Sfx.play("danger");
    }
    UI.openCombat(this._combat, this._combatMeta);
  },

  // 反杀金光上人：金钟罩护身（高护体），唯有毒+暗器破之
  startJinguangFight() {
    const s = State.data;
    this._nextFightType = "jinguang";
    const player = this.playerFighter();
    player.hp = s.hpMax; player.hpMax = s.hpMax;

    // 金光上人：修仙者（练气七层）——有灵气、有战斗AI（守御型：血危先固金钟罩）。
    // 金行道基天克长春功（动漫一致感：正面斗法=找死，毒/暗器/火符才是胜机）。
    const jinguang = {
      name: "金光上人", hp: 140, sense: 14, speed: 13, agility: 10, move: 1, mp: 72,
      tactics: "guarded", qiLayer: 7, elem: "jin",
      guardMove: { name: "金钟罩·重聚", shield: 16 },
      introNote: "金光上人乃修仙杀手，一身金系符术天克你的木行道基，金钟罩固若金汤且会重聚——硬拼必败！以毒续伤、以暗器破甲、以火符灼金；他的金刚伏魔砸的是脚下地界，看准落点挪开。",
      attacks: [
        { name: "金符破空", dmg: 22, kind: "normal", weight: 12, elem: "jin", mp: 6 },
        { name: "剑符斩", dmg: 26, pierce: true, kind: "pierce", weight: 7, elem: "jin", mp: 8 },
        { name: "金刚伏魔", dmg: 30, kind: "charge", weight: 5, elem: "jin", mp: 10, aim: "cell", range: [1, 3] },
      ],
    };
    this._combat = new CombatAPI.Combat({
      player,
      enemies: [this._applyDossier(jinguang)],
      maxRounds: 18,
      side: this.sideUnitFor("jinguang"),   // 动漫考据：伏杀金光上人，韩立放出了张铁尸傀
    });
    // 金钟罩护体：开局即有厚护盾，暗器(破甲)与毒(持续)是破局关键；金钟罩为法宝护体，不随回合消退
    this._combat.enemies[0].shield = 40;
    this._combat.enemies[0]._fixedShield = true;

    this._combatMeta = { type: "jinguang" };
    s.combat = true;
    this._combat.startRound();
    const duCount = State.count("duyao_cao"), anCount = State.count("anqi");
    this.log(`金光上人金钟罩护身，寻常攻击难伤分毫！你怀 毒草×${duCount}、暗器×${anCount}——以毒续伤、以暗器破甲，方有胜机。`, "event");
    UI.openCombat(this._combat, this._combatMeta);
  },

  // 心魔具象（multiply-design 乘法E）：心魔由剧情记忆生成——你最重的业障，就是它的脸
  _demonFace() {
    const s = State.data;
    // 最近的业障最重：拜别小妹（花轿那一眼）> 杀师 > 故友之死
    if (s.flags.demon_seed_sister && s.flags.home_farewell && Math.random() < 0.4) return {
      name: "心魔 · 韩家小妹",
      taunt: "幻象里是村口的老槐树。小妹掀开花轿的帘子回头望你：「二哥，我成亲你回来不？」——你当时没有应声。如今它要你应一万遍。",
    };
    if (s.flags.modafu_dead) return {
      name: "心魔 · 墨大夫",
      taunt: "幻象中那张枯槁的脸缓缓抬起，正是墨大夫：「用我的毒，驱我炼的尸，夺我的药庐……韩立，你我究竟有何分别？」",
    };
    if (s.flags.zhangtie_dead) return {
      name: "心魔 · 张铁",
      taunt: "雾里走出一个憨厚的身影，是张铁：「韩立，咱俩说好从青牛镇一块儿出来、互相照应的……你如今走的这条路，还回得了头吗？」",
    };
    return { name: null, taunt: null };
  },

  // 复仇战（升仙大会后）：杀害万小山的散修——同阶之争，你无敌（爽文公理：
  // 韩立的"险"永远来自高阶场合；回到同阶视角，他就是碾压）
  startRevengeFight() {
    const s = State.data;
    this._nextFightType = "revenge";
    const player = this.playerFighter();
    const mk = (name, hp, atk) => ({
      name, hp, sense: 5, speed: 9, agility: 4, move: 1, mp: 48, qiLayer: 3, elem: "tu", tactics: "cunning",
      attacks: [
        { name: "法器斩", dmg: atk, kind: "normal", weight: 12, elem: "tu", mp: 6 },
        { name: "土遁刺", dmg: atk - 3, kind: "pierce", weight: 6, elem: "tu", mp: 7 },
      ],
    });
    this._combat = new CombatAPI.Combat({
      player,
      enemies: [mk("刀疤散修", 95, 16), mk("瘦高散修", 85, 14)],
      maxRounds: 16,
    });
    this._combatMeta = { type: "revenge" };
    s.combat = true;
    this._combat.startRound();
    this._combat._log("三人中最年轻的那个看清你的眼神，掉头就跑——剩下两人狞笑着围了上来。");
    this.log("【复仇】杀万小山者，二人当面，一人遁走。先收眼前的账。", "bad");
    this.writeLedger("sanxiu_escaped", "杀万小山的第三名散修当场遁走");
    UI.openCombat(this._combat, this._combatMeta);
  },

  // 与万小山搭伴探山（同道系统首战：会期等待中的伙伴并肩）
  startWanHunt() {
    const s = State.data;
    if (s.flags.wan_hunt_done) return;
    State.setFlag("wan_hunt_done");
    const player = this.playerFighter();
    const wolf = Object.assign({}, WORLD.enemies.wild_wolf, { hp: 75 });
    this._combat = new CombatAPI.Combat({
      player,
      enemies: [wolf, Object.assign({}, WORLD.enemies.wild_wolf)],
      maxRounds: 14,
      side: { id: "wanxiaoshan", name: "万小山", kind: "ally", art: "wanxiaoshan",
              hp: 60, hpMax: 60, guard: 0.15, elem: "huo",
              // 人格=背景：商贾子弟野路子——惜命后排扔火球，绝不上前挡刀
              persona: { aggr: 4, prot: 1, kite: 4 },
              moves: [
                { name: "火球术", dmg: 11, weight: 12, elem: "huo", range: [1, 3], line: "搓出一颗火球砸去" },
                { name: "符纸·小火蛇", dmg: 15, weight: 5, elem: "huo", range: [1, 3], line: "肉痛地拍出一张符纸——「这张可值钱了！」" },
              ] },
    });
    this._combatMeta = { type: "wanhunt" };
    s.combat = true;
    this._combat.startRound();
    this._combat._log("万小山把行囊往树上一挂：「韩兄站我右边！我家传的火球术，照妖兽脸上招呼！」");
    this.log("等会期的日子里，万小山拉你搭伴进山采药——撞上了狼群。头一回，有人和你并肩而战。", "event");
    UI.openCombat(this._combat, this._combatMeta);
  },

  // 坊市归途：杀陆云风（黄枫谷中期大事件）——同阶恶战，杀人灭口的死局你不躲
  startLuyunfengFight() {
    const s = State.data;
    this._nextFightType = "luyunfeng";
    const player = this.playerFighter();
    const lu = this._applyDossier({
      name: "陆云风", hp: 190, sense: 11, speed: 12, agility: 9, move: 1, mp: 84,
      tactics: "cunning", qiLayer: 11, elem: "mu", armor: 3,
      introNote: "陆云风练气十一层，与你同阶——但他骄横惯了，杀人时从不想自己也会死。读他的招，他贪攻必露破绽；耗他的灵力，他的剑光会先于人哑火。",
      attacks: [
        { name: "青叶剑光", dmg: 26, kind: "normal", weight: 12, elem: "mu", mp: 7 },
        { name: "缚灵金索", dmg: 22, kind: "pierce", weight: 7, elem: "jin", mp: 9 },
        { name: "怒剑诀", dmg: 36, kind: "charge", weight: 6, elem: "mu", mp: 12, range: [1, 4] },
      ],
    });
    this._combat = new CombatAPI.Combat({
      player,
      enemies: [lu],
      maxRounds: 18,
      side: this.sideUnitFor("encounter"),
    });
    this._combatMeta = { type: "luyunfeng" };
    s.combat = true;
    this._combat.startRound();
    this._combat._log("陆云风霍然回头，认出你的瞬间杀意全开：「看药园的杂役？！——也好，一起埋了！」");
    this.log("【林中血】杀人灭口的死局——你出手了。对面是同阶的内门弟子，这一战没有退路。", "bad");
    UI.openCombat(this._combat, this._combatMeta);
  },

  // 突破战：与瓶颈心魔对战（复用战斗引擎）
  startBreakthroughFight(opts = {}) {
    const s = State.data;
    const realm = State.realm();
    const nextRealm = DATA.realms[s.realmIndex + 1];
    const isBig = !!opts.big;
    this._btWasBig = isBig;

    // 准备越充分 → 瓶颈越薄、可战回合越多、道心(hp)越足
    const culRatio = clamp(s.cultivation / realm.culMax, 0, 1.2);
    const daoxin = Math.round(40 + (s.mood / s.moodMax) * 40 - (s.demon / 100) * 25);
    const rounds = 6 + Math.floor((s.spirit / realm.spMax) * 4) - Math.floor(s.demon / 25);

    // 心魔具象：你最重的业障，就是它的脸（剧情记忆 × 战斗引擎）
    const face = this._demonFace();

    let bottleneckHp, maxRounds, demonName, demonAtk, intro;
    if (isBig) {
      // 大境界·心魔劫：以秘仪配置为基准，远比小境界凶险
      const rite = opts.rite || this._bigRealmRite() || {};
      bottleneckHp = Math.round((rite.trialHp || 90) - culRatio * 20);
      maxRounds = Math.max(6, (rite.trialRounds || 10) + Math.floor((s.spirit / realm.spMax) * 4) - Math.floor(s.demon / 25));
      demonName = face.name ? `心魔劫 · ${face.name.replace("心魔 · ", "")}` : `${rite.name || (nextRealm ? nextRealm.name : "瓶颈")}·心魔劫`;
      demonAtk = 14;
      intro = `你按秘仪引动天地之力冲击「${nextRealm ? nextRealm.name : "大境界"}」之关，生平执念尽数化作心魔劫扑面而来——成败、生死，皆在此一战！`;
    } else {
      bottleneckHp = Math.round(40 + s.realmIndex * 14 - culRatio * 22);
      maxRounds = Math.max(4, rounds);
      demonName = face.name || `${nextRealm ? nextRealm.name : "瓶颈"}·心魔`;
      demonAtk = 9;
      intro = `心魔过盛，冲关之际它趁虚而起——你须先在心战中降伏它，方能突破至「${nextRealm ? nextRealm.name : "下一层"}」！`;
    }

    const player = this.playerFighter();
    player.hp = Math.max(20, daoxin); player.hpMax = player.hp;

    this._combat = new CombatAPI.Combat({
      player,
      enemies: [{ name: demonName, hp: Math.max(20, bottleneckHp),
                  sense: 5, agility: 0, move: 2, mp: 999,   // 心魔不竭：意志之战没有耗蓝取巧
                  atkName: "心魔反噬", atk: demonAtk,
                  introNote: face.taunt || null }],
      maxRounds,
      mode: "breakthrough",
    });
    this._combatMeta = { type: "breakthrough", big: isBig };
    s.combat = true;
    this._combat.startRound();
    this.log(intro, "event");
    if (face.taunt) this._combat._log(face.taunt);
    UI.openCombat(this._combat, this._combatMeta);
  },

  // 战斗收束：先放演出与结算卡（看清楚发生了什么），确认后才真正落账
  _combatOver() {
    const c = this._combat, meta = this._combatMeta;
    if (!c) return;
    if (meta && meta.type === "breakthrough") { this._finishCombat(); return; }   // 突破有自己的仪式
    if (typeof UI !== "undefined" && UI.renderCombat) UI.renderCombat(c, meta);   // 定格终局画面
    if (typeof UI !== "undefined" && UI.showCombatOutro) UI.showCombatOutro(c, meta, () => this._finishCombat());
    else this._finishCombat();
  },

  // 玩家在战斗中施法
  combatCast(spellId, targetIndex) {
    if (!this._combat) return;
    const r = this._combat.cast(spellId, targetIndex);
    if (!r.ok) { this.toast(r.reason); return; }
    if (typeof UI !== "undefined" && UI.flushCombatFx) UI.flushCombatFx(this._combat);
    if (typeof UI !== "undefined" && UI.flashCombat) UI.flashCombat(spellId, targetIndex);
    // 剑意修行链：实战用剑积累剑意（大成前）
    const s = State.data;
    if (!s.swordMastery && (spellId === "zhayan" || spellId === "zhayan_lian")) {
      s.swordIntent = clamp((s.swordIntent || 0) + 2, 0, 100);
      if (s.swordIntent === 100 && !s.flags.sword_intent_full) {
        State.setFlag("sword_intent_full");
        this.log("【剑意】出剑的刹那，你忽觉指间与剑意隐隐相通——眨眼剑法的火候到了。回药庐闭关「悟剑」，或可更进一步！", "good");
        this.toast("剑意圆满！可回药庐悟剑");
      }
    }
    if (this._combat.status !== "ongoing") this._combatOver();
    else UI.renderCombat(this._combat, this._combatMeta);
  },

  // 择地施放（阵旗二次确认）：阵心落在玩家点的格上
  combatCastAt(spellId, cell) {
    if (!this._combat) return;
    const r = this._combat.cast(spellId, undefined, { cell });
    if (!r.ok) { this.toast(r.reason); return; }
    if (typeof UI !== "undefined" && UI.flushCombatFx) UI.flushCombatFx(this._combat);
    if (typeof UI !== "undefined" && UI.flashCombat) UI.flashCombat(spellId);
    if (this._combat.status !== "ongoing") this._combatOver();
    else UI.renderCombat(this._combat, this._combatMeta);
  },

  // 结束当前回合（敌方行动 + 状态结算）
  combatEndRound() {
    if (!this._combat) return;
    if (typeof UI !== "undefined") UI._armed = null;   // 收手：上膛的法术不跨回合
    this._combat.endRound();
    if (typeof UI !== "undefined" && UI.flushCombatFx) UI.flushCombatFx(this._combat);
    if (this._combat.status !== "ongoing") { this._combatOver(); return; }
    this._combat.startRound();
    UI.renderCombat(this._combat, this._combatMeta);
  },

  // 轴上移动（不结束回合：移动与出手同回合内自由编排）
  combatMove(toPos) {
    if (!this._combat) return;
    const c = this._combat;
    // 雷遁瞬移（v98）：blink 态下移动=穿亚空间——旧位放消失帧、关滑动、落点放出现帧
    const blink = !!c.player._blinkTurn;
    if (blink && typeof UI !== "undefined" && UI.el && typeof Fx !== "undefined") {
      const box = UI.el("axis-units"), pl = box && box.querySelector('[data-uid="player"]');
      if (pl && Fx.ensure(UI.el("axis-field")) && Fx.RECIPES.leidun) {
        const at = Fx.at(pl);
        if (at) { Fx.RECIPES.leidun(Fx, at); UI._blinkFrom = at; }   // 记下消失点——落定后画穿空金弧轨迹
      }
    }
    const r = c.playerMove(toPos);
    if (!r.ok) { this.toast(r.reason); return; }
    if (blink) { UI._blinkSnap = true; UI._blinkOut = true; }
    else if (typeof Sfx !== "undefined") Sfx.play("click");
    UI.renderCombat(c, this._combatMeta);
  },

  // 战中采集（同轴一体）：洞窟热点原格在战斗轴上，走到跟前花一个主行动摘下
  combatTake(hotId) {
    const c = this._combat;
    if (!c) return;
    const r = c.playerTake(hotId);
    if (!r.ok) { this.toast(r.reason || "采不得", true); return; }
    const s = State.data;
    const names = Object.entries(r.loot || {}).map(([k, n]) => `${DATA.items[k] ? DATA.items[k].name : k}×${n}`).join("、");
    if (s.exmap) {
      // 洞窟语境：照旧进探囊（出图统一结算；败北回印记时随快照一并回滚）
      const f = ExploreMap.cur(s.exmap);
      if (f && f.taken) f.taken[r.id] = true;
      Object.entries(r.loot || {}).forEach(([k, n]) => { s.exmap.bag[k] = (s.exmap.bag[k] || 0) + n; });
    } else {
      Object.entries(r.loot || {}).forEach(([k, n]) => State.give(k, n));
    }
    this.toast(`战中采得：${names}`);
    if (typeof Sfx !== "undefined") Sfx.play("pick");
    UI.renderCombat(c, this._combatMeta);
    State.save();
  },

  // 遁走（须在最左格）：抽身离场——留得青山在
  combatFlee() {
    if (!this._combat) return;
    const r = this._combat.playerFlee();
    if (!r.ok) { this.toast(r.reason); return; }
    this._combatOver();
  },

  // 速战速决：碾压局交给 AI 代打（同一引擎无头跑，平衡只此一处）
  combatQuickResolve() {
    if (!this._combat || !this._combatMeta || !this._combatMeta.canQuick) return;
    this._combat.autoResolve(this._combat.maxRounds);
    this._combatOver();
  },

  // 战斗结束结算
  _finishCombat() {
    const s = State.data;
    const c = this._combat;
    const meta = this._combatMeta;
    const win = c.status === "win";
    const fled = c.status === "fled";   // 主动遁走：非死之败——不掉血不加心魔，输的是机会
    s.combat = false;
    // 交手自动补全：见过的招永久入册（情报面纱 L1）
    this._recordIntelFromCombat(c);
    // 克制揭示写回：打过才知道的道基行属，永久记入（图鉴/再战行徽）
    (c._reveals || []).forEach(r => { s.intelElems = s.intelElems || {}; s.intelElems[r.name] = r.elem; });
    // 漂亮的赢：赢的方式也值得记住
    if (win) this._checkMedals(c);

    // 同步战中消耗的底牌（毒、暗器、符箓）回主背包；侧位单位损耗回写
    this._syncPouchBack();
    this._syncSideBack();

    // 同步玩家气血与灵力回主状态（突破是"道心"，不回写气血）
    // 灵力按比例回写灵力：战中耗了三成灵力=灵力掉三成——连战共享一池，
    // 打坐/丹药/聚灵阵是真实的续航手段
    if (meta.type !== "breakthrough") {
      s.hp = clamp(Math.round(c.player.hp), 0, s.hpMax);
      const spMax = (State.realm() || {}).spMax || s.spirit || 1;
      const ratio = c.player.mpMax > 0 ? clamp(c.player.mp / c.player.mpMax, 0, 1) : 1;
      s.spirit = clamp(Math.round(spMax * ratio), 0, spMax);
      // B1 战外恢复·战后整备（仅存活离场=胜/遁；真败另有败局结算，不在此回满）：
      // 只「气血」整顿回满——探索连战不再被迫带伤硬走。
      // 灵力刻意不在战后自动补：它是探索里的资源，靠走格(exmapTravel/CaveMove)、过月(passTime)、
      // 打坐、丹药回——如此走格回灵才有用、血色禁地/深潜才存资源张力（上面 ratio 即战中真实消耗）。
      if (win || fled) {
        s.hp = s.hpMax;
      }
    }

    UI.closeCombat();

    // 主动遁走：单独收尾（fail-forward 的另一翼——能走脱本身就是本事）
    if (fled) {
      this.log(`你且战且退，遁出了战圈。${meta.enemyName ? `「${meta.enemyName}」没有追来——` : ""}这一仗没输，只是没赢。`, "sys");
      // 舆图战遁走：退回探索层（洞窟=缩回洞口；交过手就再无偷袭——它认得你了）
      if (this._exmapFightReturn) {
        this._exmapFightReturn = false;
        this._combat = null; this._combatMeta = null;
        if (s.exmap) {
          const xx = s.exmap, fc = ExploreMap.cur(xx);
          if (fc && fc.kind === "cave") {
            const mp = ExploreMap.mapOf(fc);
            fc.pos = mp.playerPos != null ? mp.playerPos : 1;
            fc._cam = 0;
            if (mp.exposeLimit) fc.expose = Math.max(fc.expose || 0, mp.exposeLimit);
            this.log("你缩回洞口的岩影里。潭心的目光在水面下逡巡——它认得你了，背门不会再敞第二次。", "bad");
          }
          if (UI.openExmap) UI.openExmap();
          if (UI.renderExmap) UI.renderExmap();
        }
        this.checkLifespan();
        State.save();
        return;
      }
      if (meta.type === "showdown" || meta.type === "jinguang" || meta.type === "luyunfeng" || meta.type === "wanhunt" || meta.type === "revenge") {
        // 剧情战遁走=暂避锋芒，重开事件择机再战（不吃败仗重伤，但事情没办成）
        const retryMap = { showdown: "showdown", jinguang: "jinguang_fight", luyunfeng: "chen_rescue", wanhunt: "wan_hunt", revenge: "wan_death" };
        s.pendingEvent = retryMap[meta.type] || null;
        this._retryAfterLoss = retryMap[meta.type] || null;
        if (meta.type === "wanhunt") s.flags.wan_hunt_done = false;
      }
      this._combat = null;
      this._combatMeta = null;
      this.checkLifespan();
      State.save();
      UI.renderAll();
      if (this._retryAfterLoss) {
        const evId = this._retryAfterLoss;
        this._retryAfterLoss = null;
        this._retryStage = true;
        const stage = STORY.find(st => st.id === evId) || STORY[s.storyStage];
        try { UI.renderStory(stage); }
        catch (e) { this._retryStage = false; UI.renderStory(stage); }
      }
      return;
    }

    // 战后复盘一句话：胜归因关键手，败点明死因（败得明白才有再战的方向）
    if (win && c.stats && Object.keys(c.stats).length) {
      const top = Object.entries(c.stats).sort((a, b) => b[1] - a[1])[0];
      if (top && top[1] > 0) this.log(`【复盘】本战关键手：「${top[0]}」共建功 ${top[1]} 伤——你的打法立住了。`, "sys");
    } else if (!win && c.deathCause) {
      this.log(`【复盘】你倒在「${c.deathCause.by}」的「${c.deathCause.move}」之下。记住这一招——它不会再得手第二次。`, "sys");
    }

    if (meta.type === "encounter") {
      if (win) {
        if (meta.reward) {
          Object.entries(meta.reward).forEach(([k, v]) => {
            if (k === "silver") { s.silver += v; this.log(`战胜「${meta.enemyName}」，得纹银 ${v} 两。`, "good"); }
            else { State.give(k, v); this.log(`战胜「${meta.enemyName}」，获「${DATA.items[k] ? DATA.items[k].name : k}」×${v}。`, "good"); }
          });
        } else this.log(`你击退了「${meta.enemyName}」。`, "good");
        // 镖局悬赏（涟漪窗口）：兑现赏格
        if (this._bountyFight) {
          this._bountyFight = false;
          if (s.rippleWindow && s.rippleWindow.id === "wolf_bounty") {
            s.silver += 12;
            s.rippleWindow = null;
            this.log("【悬赏兑现】你提着喽啰头目的腰牌回镖局领赏——纹银十二两落袋。镖头抱拳：「壮士留名！」", "good");
            this.addFame(6, "应镖局悬赏，剿野狼帮喽啰");
          }
        }
        // 专属战利（namedLoot）：真伏诛才有——走脱者带着家底跑了
        const anyEscaped = c.enemies.some(e => e.escaped);
        if (meta.namedLoot && !meta.namedBeast) {
          if (anyEscaped) {
            this.log(`「${meta.enemyName}」带伤走脱——他身上那些好东西，也跟着跑了。`, "event");
          } else {
            const names = [];
            Object.entries(meta.namedLoot).forEach(([k, v]) => { State.give(k, v); names.push(`${DATA.items[k] ? DATA.items[k].name : k}×${v}`); });
            this.log(`【缴获】从「${meta.enemyName}」身上搜得：${names.join("、")}。`, "good");
          }
        }
        // 异闻妖王：伏诛=专属战利+勋章+扬名；走脱=异闻未了（它带着伤，还会回来）
        if (meta.namedBeast) {
          if (anyEscaped) {
            this.log(`「${meta.enemyName}」带着满身伤遁入深山——异闻未了。它记住你了，你也记住它了：这笔账，山里再算。`, "event");
            // 不入伏诛册、不掉专属战利——异闻链保持开启，再遇时它带旧伤（涟漪味）
          } else {
            if (meta.namedLoot) {
              const names = [];
              Object.entries(meta.namedLoot).forEach(([k, v]) => { State.give(k, v); names.push(`${DATA.items[k] ? DATA.items[k].name : k}×${v}`); });
              this.log(`【伏诛】异闻中的「${meta.enemyName}」死于你手！剥取战利：${names.join("、")}。`, "good");
            }
            this.addMilestone(`伏诛异闻妖王「${meta.enemyName}」`, "medal");
            this.addFame(10, `伏诛异闻妖王「${meta.enemyName}」`);
            s.slainBeasts = s.slainBeasts || [];
            if (!s.slainBeasts.includes(meta.namedBeast)) s.slainBeasts.push(meta.namedBeast);
            if (s.beastRumor === meta.namedBeast) s.beastRumor = null;
            s.worldNews = s.worldNews || [];
            s.worldNews.push({ t: `第${s.year}年${s.month}月`, kind: "fortune", text: `传言后山那头「${meta.enemyName}」已被门中一位弟子毙杀，山民拍手称快——据说是药庐那位韩师傅。` });
            if (typeof Sfx !== "undefined") Sfx.play("success");
          }
        }
        // —— 血色禁地剧情战钩子 ——
        if (meta.enemyName === "封岳" && !anyEscaped) {
          State.setFlag("fengyue_dead");
          State.setFlag("jindi_mid_done");
          if (s.exmap) {
            this.log("封岳的尸身滑进血雾里。你解下他脚上那双灰靴——杀手的脚程，自此归你。禁地里那道游弋的杀气，散了。", "good");
          } else {
            State.give("xueshi_zhuyao", 6);
            this.log("封岳的尸身滑进血雾里。你解下他脚上那双灰靴——杀手的脚程，自此归你。中环主药也采足了六株。", "good");
          }
          this.writeLedger("fengyue_slain", "血色禁地中反杀狙杀者封岳，夺其踏云靴");
          this.addMilestone("猎杀猎人：反杀封岳", "showdown");
        } else if (meta.enemyName === "封岳" && anyEscaped) {
          State.setFlag("jindi_mid_done");
          if (s.exmap) {
            this.log("封岳带伤遁走，没敢回头——那双靴子与你无缘了。但至少，这片血雾里少了一个猎人。", "event");
          } else {
            State.give("xueshi_zhuyao", 5);
            this.log("封岳带伤遁走，没敢回头。你在中环又采了两日——主药五株入袋，只是那双靴子与你无缘了。", "event");
          }
        }
        if (meta.enemyName === "墨蛟" && !anyEscaped) {
          State.setFlag("mojiao_slain");
        }
      } else {
        this._bountyFight = false;
        const dmg = Math.round(s.hpMax * 0.2);
        s.hp = clamp(s.hp - dmg, 1, s.hpMax);
        s.demon = clamp(s.demon + 8, 0, 100);
        this.log(`你不敌「${meta.enemyName}」，负伤遁走（气血-${dmg}）。`, "bad");
      }
      // 舆图（v3）途中触发的战斗：胜负各有归处
      if (this._exmapFightReturn) {
        this._exmapFightReturn = false;
        this._combat = null; this._combatMeta = null;
        this.checkLifespan();
        if (s.exmap) {
          const inCave = s.exmap.stack.length > 1;
          if (win && meta.enemyName === "墨蛟") {
            // 决战告捷：出洞出图，潭边戏（mojiao_after）由主线接管
            this.finishExmap("victory");
            return;
          }
          if (!win && inCave && s._caveSnap) {
            // 洞中败北：从洞口印记重来（进洞前的一切如旧）
            const snap = JSON.parse(s._caveSnap);
            Object.keys(s).forEach(k => { if (k !== "_caveSnap") delete s[k]; });
            Object.assign(s, snap);
            s._caveSnap = JSON.stringify(Object.assign({}, snap));
            this.log("【洞口印记】黑雾吞没意识的前一刻，洞口的印记亮起——再睁眼，你站在潭边，一切如刻下印记那一刻。", "event");
            this.toast("从洞口印记重来");
          } else if (!win && !inCave && meta.enemyName === "封岳") {
            // 败给猎人：他要的是药——劫走袋中主药，把你撂在血雾里
            const x = s.exmap;
            const robbed = Math.ceil((x.bag.xueshi_zhuyao || 0) / 2);
            if (robbed > 0) x.bag.xueshi_zhuyao -= robbed;
            const f = ExploreMap.cur(x);
            f.node = ExploreMap.mapOf(f).entry;
            this.log(`封岳翻走你袋中${robbed > 0 ? `主药${robbed}株` : "所有值钱物什"}，冷笑一声没下杀手：「杂役的命，不值我脏靴子。」——你拖着伤躲回了血幕裂口。`, "bad");
          }
          State.save();
          if (s.hp > 0 && s.exmap) { UI.openExmap && UI.openExmap(); return; }
        }
        State.save();
        UI.renderAll();
        return;
      }
      // 探索途中触发的战斗：打完回到探索网格继续
      if (this._exploreFightReturn) {
        this._exploreFightReturn = false;
        // 妖兽王战利：胜则丰收入袋，败则与你无缘
        if (this._exploreBossLoot) {
          if (win && s.explore) {
            Object.entries(this._exploreBossLoot).forEach(([k, n]) => {
              s.explore.bag[k] = (s.explore.bag[k] || 0) + n;
            });
            const names = Object.entries(this._exploreBossLoot).map(([k, n]) => `${DATA.items[k] ? DATA.items[k].name : k}×${n}`).join("、");
            this.log(`【妖兽王伏诛】你从兽穴中搜得：${names}——深入险地，果有厚报！`, "good");
            if (typeof Sfx !== "undefined") Sfx.play("success");
          }
          this._exploreBossLoot = null;
        }
        this._combat = null; this._combatMeta = null;
        this.checkLifespan();
        State.save();
        if (s.explore && !s.explore.finished && s.hp > 0) { UI.openExplore(s.explore); return; }
      }
      // 旅途中遭遇战打完：继续赶路（胜负皆然——劫道的打跑了，路还是要走）
      if (s.journey && s.hp > 0) {
        this._combat = null; this._combatMeta = null;
        this.checkLifespan();
        State.save();
        UI.renderAll();
        this._resumeJourneyIfAny();
        return;
      }
    } else if (meta.type === "showdown") {
      if (win) {
        State.setFlag("modafu_dead");
        this.log("墨大夫毒发倒地，铁奴被你击碎，余子童的元神也被你以功力生生镇灭！你赢了——靠的是准备、算计与一刻不敢松懈的苦修。", "good");
        this.addMilestone("夺舍之夜：反杀墨大夫（余子童）", "showdown");
        this.addFame(15, "药庐那位韩师傅，深藏不露");
        s.mood = clamp(s.mood + 12, 0, s.moodMax);
        // 曲魂幡到手：张铁尸傀自此随你驱使（侧位单位 v0——挚友之尸，为你而战）
        if (!s.sideUnit) {
          s.sideUnit = { id: "zhangtie_corpse", name: "铁奴·张铁", hp: 70, hpMax: 70, atk: 12,
                         atkName: "尸傀挥击", nature: "corpse", guard: 0.3, status: "ok", carry: true };
          this.log("你拾起墨大夫遗落的「曲魂幡」。幡下尸傀缓缓转向你，躬身待命——那身形，依稀还是当年演武厅里和你过招的少年。自此，张铁的遗蜕将随你出战（历练与遭遇战自动随行）。", "event");
          this.addMilestone("曲魂幡御尸：铁奴随行", "bigitem");
          this.toast("侧位随行：铁奴·张铁");
        }
        s.storyStage += 1;
        this.checkStory();
      } else {
        const dmg = Math.round(s.hpMax * 0.5);
        s.hp = clamp(s.hp - dmg, 1, s.hpMax);
        s.demon = clamp(s.demon + 20, 0, 100);
        s.flags.losses_showdown = (s.flags.losses_showdown || 0) + 1;
        const bonus = Math.min(3, s.flags.losses_showdown) * 8;
        this.log(`决战失利，你身受重伤(气血-${dmg})狼狈遁走。但这一败没有白吃——你看破了对方几分路数（再战伤害+${bonus}%）。回去备足毒草暗器，再来！`, "bad");
        s.pendingEvent = "showdown";
        this._retryAfterLoss = "showdown";   // 战斗状态彻底清理后再开重试剧情卡（防卡死）
      }
    } else if (meta.type === "jinguang") {
      if (win) {
        State.setFlag("jinguang_dead");
        State.give("jinfu", 1);
        State.give("jinzhong_zhao", 1);
        this.log("金光上人金钟罩虽固，终究敌不过你的毒与暗器。这矮胖和尚至死不信，自己竟栽在一个门派药师手里！七玄门之危，就此解去。", "good");
        this.addMilestone("以下克上：暗算金光上人", "showdown");
        this.addFame(25, "修仙杀手金光上人死于彩霞山");
        // 符宝·金光砖：杀手的凶器成为你的底牌（韩立的第一件符宝，动漫考据）
        State.give("jinguang_zhuan", 1);
        State.give("jinguang_zhuan_charge", 3);
        this.log("你从他怀中搜出一块巴掌大的金砖，灵光内蕴——正是他赖以成名的符宝「金光砖」！尚余三道充能（灵石可回充）。杀手的凶器，自此是你的底牌。", "good");
        this.addMilestone("夺得符宝「金光砖」", "bigitem");
        this.toast("符宝到手：金光砖（充能×3）");
        s.mood = clamp(s.mood + 12, 0, s.moodMax);
        s.storyStage += 1;
        this.checkStory();
      } else {
        const dmg = Math.round(s.hpMax * 0.5);
        s.hp = clamp(s.hp - dmg, 1, s.hpMax);
        s.demon = clamp(s.demon + 18, 0, 100);
        s.flags.losses_jinguang = (s.flags.losses_jinguang || 0) + 1;
        const bonus = Math.min(3, s.flags.losses_jinguang) * 8;
        this.log(`你低估了金光上人的金钟罩，反被其重创(气血-${dmg})，狼狈遁走。但你记住了他的招路（再战伤害+${bonus}%）——备足毒草暗器，再寻战机！`, "bad");
        s.pendingEvent = "jinguang_fight";
        this._retryAfterLoss = "jinguang_fight";
      }
    } else if (meta.type === "wanhunt") {
      if (win) {
        State.give("lingcao", 3);
        this.log("狼群伏诛。万小山一屁股坐在地上直喘，又突然跳起来翻检狼尸：「狼皮！狼皮也值钱！」——说好的五五分账，他硬把六成塞给了你（灵草+3）。", "good");
        this.writeLedger("wan_hunt_together", "与万小山并肩战过一场（山道狼群）");
        this.addMilestone("搭伴探山：头一回有人与你并肩", "deed");
      } else {
        s.hp = clamp(Math.max(1, s.hp), 1, s.hpMax);
        this.log("狼群势凶，万小山拽着你且战且退，总算脱身——他还在自责火球术练得不精。改日再来。", "bad");
        s.flags.wan_hunt_done = false;   // 可再来（轻战斗不设惩罚）
        s.pendingEvent = null;
        s.storyStage = Math.max(0, s.storyStage);   // 停留本节点重试
        this._retryAfterLoss = "wan_hunt";
      }
      if (win) { s.storyStage += 1; this.checkStory(); }
    } else if (meta.type === "luyunfeng") {
      if (win) {
        State.setFlag("luyunfeng_dead");
        State.give("zhuji_dan", 2);
        if (!s.metNpcs.includes("chenqiaoqian")) s.metNpcs.push("chenqiaoqian");
        this.log("陆云风毙命林间。你从他储物袋中得【筑基丹×2】——入谷之日被夺走的东西，今日连本带利讨了回来。", "good");
        this.addMilestone("坊市归途：杀陆云风，夺回筑基丹×2", "showdown");
        this.settleLedger("zhuji_dan_grudge", "叶师叔夺走一枚，他师侄还回两枚——这笔账，先收一半利息");
        Engine.writeLedger("met_chen", "林中救下陈巧倩——她的命途自此与你有了交点");
        this.addFame(5, "黄枫谷坊市一带，传闻有内门弟子失踪");
        s.mood = clamp(s.mood + 6, 0, s.moodMax);
        s.storyStage += 1;
        this.checkStory();
      } else {
        const dmg = Math.round(s.hpMax * 0.4);
        s.hp = clamp(s.hp - dmg, 1, s.hpMax);
        s.flags.losses_luyunfeng = (s.flags.losses_luyunfeng || 0) + 1;
        const bonus = Math.min(3, s.flags.losses_luyunfeng) * 8;
        this.log(`陆云风的剑光老辣，你负伤暂退、隐入林间（气血-${dmg}）。他还押着陈巧倩没走——调息再上，你看破了他几分剑路（再战伤害+${bonus}%）。`, "bad");
        s.pendingEvent = "chen_rescue";
        this._retryAfterLoss = "chen_rescue";
      }
    } else if (meta.type === "revenge") {
      if (win) {
        State.setFlag("wan_avenged");
        this.log("两名散修毙命当场。你从他们身上搜出万小山的灵石，一块不少地放回他的行囊——他攥着的那半张符纸，你轻轻取了下来。", "event");
        this.addMilestone("林间血债：为万小山复仇（一人遁走）", "showdown");
        if (this.readLedger("wan_friend")) {
          this.settleLedger("wan_friend", "他曾在集市上把第一张符纸让给你——今日你以两条人命，还了这份热乎气");
        }
        s.mood = clamp(s.mood - 6, 0, s.moodMax);   // 复仇不痛快——故人已逝
        s.storyStage += 1;
        this.checkStory();
      } else {
        const dmg = Math.round(s.hpMax * 0.35);
        s.hp = clamp(s.hp - dmg, 1, s.hpMax);
        s.flags.losses_revenge = (s.flags.losses_revenge || 0) + 1;
        this.log(`你怒火攻心、出手失了章法，反被二人合击所伤（气血-${dmg}）。冷静……万小山等得起你调息再来。`, "bad");
        s.pendingEvent = "wan_death";
        this._retryAfterLoss = "wan_death";
      }
    } else if (meta.type === "breakthrough") {
      // 心战收束的道心余裕=这次突破的"水准"（刻进气海的永久差异）
      this._resolveBreakthroughResult(win, c.player.hpMax > 0 ? c.player.hp / c.player.hpMax : 0);
    }
    this._combat = null;
    this._combatMeta = null;
    this.checkLifespan();
    // 战后剧情接续：禁地战斗等设下的 flag 立刻被主线拾起（封岳→深潭、墨蛟→潭边）
    if (!s.pendingEvent && !this._retryAfterLoss) this.checkStory();
    State.save();
    UI.renderAll();
    // 决战败北重试：一切战斗状态清理完毕后，再开剧情卡直达抉择（防中途状态残留卡死）
    if (this._retryAfterLoss) {
      const evId = this._retryAfterLoss;
      this._retryAfterLoss = null;
      this._retryStage = true;
      const stage = STORY.find(st => st.id === evId) || STORY[s.storyStage];
      try { UI.renderStory(stage); }
      catch (e) { this._retryStage = false; UI.renderStory(stage); }   // 兜底：重试径异常则完整重播
    }
  },

  /* -------- 服食丹药 / 使用物品 -------- */
  useItem(itemId) {
    const item = DATA.items[itemId];
    if (!item || item.type !== "pill") { this.toast("此物不可服用"); return; }
    if (!State.count(itemId)) return;
    const s = State.data;
    const realm = State.realm();
    const e = item.effect || {};
    // 记录变化量：吃药必须看得见效果（治"体验割裂"）
    const delta = [];
    const track = (label, before, after) => { const d = Math.round(after - before); if (d !== 0) delta.push(`${label}${d > 0 ? "+" : ""}${d}`); };
    const b = { sp: s.spirit, hp: s.hp, mood: s.mood, demon: s.demon, cul: s.cultivation };
    if (e.sp) s.spirit = clamp(s.spirit + e.sp, 0, realm.spMax);
    if (e.hp) s.hp = clamp(s.hp + e.hp, 0, s.hpMax);
    if (e.mood) s.mood = clamp(s.mood + e.mood, 0, s.moodMax);
    if (e.demon) s.demon = clamp(s.demon + e.demon, 0, 100);
    if (e.cul) s.cultivation += e.cul;
    track("灵力", b.sp, s.spirit); track("气血", b.hp, s.hp); track("心境", b.mood, s.mood);
    track("心魔", b.demon, s.demon); track("修为", b.cul, s.cultivation);
    State.take(itemId, 1);
    const fx = delta.length ? `（${delta.join("　")}）` : "（药力平平，未见起色）";
    this.log(`你服下「${item.name}」${fx}。`, "good");
    this.toast(`${item.name}：${delta.join(" ") || "无变化"}`);
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
    if (s.exmap) return;   // 秘境舆图会话中不插主线卡（出图结算时再查）
    let next = STORY[s.storyStage];
    // skipIf：分支节点的"已失效/已完成"判定——顺序流越过它（封岳线绕开/稳守线跳过狙杀等）
    let guard = 0;
    while (next && next.skipIf && next.skipIf(s) && guard++ < 12) {
      s.storyStage += 1;
      next = STORY[s.storyStage];
    }
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
    // 日历锚倒计时：天命有日子的，把日子亮出来（锚-帆模型：必须做的事永远可见）
    let hint = typeof next.objHint === "function" ? next.objHint(s) : next.objHint;
    if (next.id === "xianhui_open" && s.flags.xianhui_due) {
      const left = s.flags.xianhui_due - State.absMonth();
      if (left > 0) hint = `升仙大会还有 ${left} 月开——在太南谷等到会期（修炼/赶集度月皆可）。`;
    }
    if (!condOk) {
      return { title: next.objTitle || "静待时机", hint: hint || "继续修炼、历练，时机未到。" };
    }
    if (next.where && next.where !== s.location) {
      return { title: next.objTitle || "前往", hint: `时机已至——前往「${locName}」即有际遇。` };
    }
    return { title: next.objTitle || "际遇将至", hint: hint || "条件已足，留意眼前之事。" };
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

    // 选项副作用（账本/状态变化等，fortune 式 effect——返回 {text,kind} 则记入见闻）
    if (choice.effect) {
      const r = choice.effect(s) || {};
      if (r.text) this.log(r.text, r.kind || "event");
    }

    // 复仇战：万小山之仇（三散修——同阶之争你无敌；第三人遁走是远雷）
    if (choice.resolve === "revenge_fight") {
      s.pendingEvent = null;
      this.startRevengeFight();
      return;
    }
    // 搭伴探山：同道系统首战（万小山并肩）
    if (choice.resolve === "wan_hunt_fight") {
      s.pendingEvent = null;
      this.startWanHunt();
      return;
    }
    // 坊市归途：杀陆云风救陈巧倩（同阶恶战）
    if (choice.resolve === "luyunfeng_fight") {
      s.pendingEvent = null;
      this.startLuyunfengFight();
      return;
    }
    // 血色禁地：深入中环 → 封岳狙杀剧情卡（叙事径直达）
    if (choice.resolve === "fengyue_ambush") {
      s.pendingEvent = "fengyue_ambush";
      const st = STORY.find(x => x.id === "fengyue_ambush");
      if (st) { UI.renderStory(st); return; }
    }
    // 踏入血色禁地（v3 舆图：五日灾厄钟/封岳巡逻/墨蛟洞）
    if (choice.resolve === "jindi_enter") {
      s.pendingEvent = null;
      s.storyStage += 1;   // 越过 jindi_meeting（后续叙事卡均 skipIf 跳过）
      UI.clearStory();
      this.enterJindiMap();
      return;
    }
    // 封岳之战（狙杀者：胜得踏云靴）
    if (choice.resolve === "fengyue_fight") {
      s.pendingEvent = null;
      this._nextFightType = "fengyue";
      this.startEncounterFight("fengyue");
      return;
    }
    // 墨蛟之战（血潭并肩：南宫婉入战）
    if (choice.resolve === "mojiao_fight") {
      s.pendingEvent = null;
      this._nextFightType = "mojiao";
      this._sideOverride = this._nangongwanAlly();
      this.startEncounterFight("mojiao");
      return;
    }

    // 普通推进
    s.pendingEvent = null;
    s.storyStage += 1;
    if (choice.next === "end") { this.endArc(); return; }
    UI.clearStory();     // 先清掉旧选项，再触发下一段（否则会把新选项一起清掉）
    State.save();
    UI.renderAll();
    this.checkStory();   // 链式触发下一段（若条件已满足，会渲染新剧情卡+选项）
  },

  /* -------- 决战墨大夫：已改为真实三阶段战斗（见 startShowdownFight / _finishCombat）-------- */

  endArc() {
    State.data.pendingEvent = null;
    State.save();
    UI.renderAll();
    UI.clearStory();
    UI.openModal(`
      <h2>七玄门篇 · 通关</h2>
      <p>韩立以四灵根之资，靠苦修、算计与小绿瓶，反杀墨大夫、暗算金光上人，夺升仙令离开七玄门。</p>
      <p>这正是《凡人修仙传》的底色——凡人无天资，唯以谨慎与万全准备，步步为营，逆天改命。</p>
      <p style="color:var(--gold)">离门远行 · 启——寒毒在身，先南下嘉元城墨府（点顶栏「舆图」→ 越国 → 嘉元城 → 启程）。</p>
      <p style="color:var(--ink-dim);font-size:13px">行装清点：升仙令、灵石十块、墨大夫的遗信。江湖路远，备好毒草暗器再上路。</p>
      <div class="modal-actions">
        <button class="btn btn-primary" onclick="UI.closeModal()">上路</button>
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
