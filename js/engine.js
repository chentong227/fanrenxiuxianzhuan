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
    // 世界不会因你停步：推进世间修士的命途
    this._tickWorld(months);
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
    else if (action === "alchemy") this.alchemy();
    else if (action === "investigate") this.investigate();
    else if (action === "explore") { this.enterExplore("houshan_explore"); return; }
    else if (action === "travel") { UI.openTravel(); return; }
    else if (action === "wujian") { this.doWujian(); return; }

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
      this.log("【剑法大成】三月闭关，你将千百次出剑的体悟尽数咀嚼——某夜剑光一闪，你忽然懂了：剑快不在手，在心。眨眼剑法至此大成：「眨眼连击」蜕变为「连环眨眼」——剑势所至，一剑化数剑！剑势上限+2。", "good");
      this.addMilestone("《眨眼剑法》大成，连击蜕变连环", "bigitem");
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

    // 异闻投放：山里走动，总会听到些风声（无活跃异闻且尚有未伏诛的妖王时）
    this._maybeBeastRumor(0.3);

    this.checkLifespan();
    this.checkStory();
    if (!s.pendingEvent && !s.combat && !this._pendingFortune) this._maybeInteraction();
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
    this.log(`【异闻】${r.rumor}　——若再入后山深处，或可遇上这桩"机缘"。`, "event");
    this.toast("听到一桩异闻（见际遇栏）");
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

    // 残页自悟·火弹术（考据：韩立在神手谷凭口诀自修火弹术等小法术）
    // 练气四层+悟性达标后，闭关中可能参透墨大夫遗册夹页里的火行口诀——玩家侧第一个火技（克金的本命答案）
    if (typeof Loadout !== "undefined" && !Loadout.knownPool(s).includes("huodan") && s.realmIndex >= 3 && s.flags.modafu_dead
        && Math.random() < 0.18 + months * 0.02) {
      Loadout.addKnownSkill(s, "huodan");
      this.log("整理墨大夫遗册时，一页夹着的残笺飘落——竟是一篇「火弹术」口诀！你依诀试演，指尖火光一闪而逝。苦修月余，终于小成。（习得火弹术：火气灼金，金行强敌的本命答案——记得在「功法」中装备）", "good");
      this.toast("残页自悟：火弹术");
      this.addMilestone("残页自悟「火弹术」", "deed");
      if (typeof Sfx !== "undefined") Sfx.play("success");
    }

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

  // 突破战结果结算
  _resolveBreakthroughResult(win) {
    const s = State.data;
    const wasBig = this._btWasBig;
    if (win) {
      const gains = [];
      s.realmIndex += 1;
      const nr = State.realm();
      s.cultivation = 0;
      const spGain = nr.spMax - (DATA.realms[s.realmIndex - 1] || nr).spMax;
      s.spirit = nr.spMax;
      s.sense += wasBig ? 8 : 3; s.body += wasBig ? 5 : 2;
      s.hpMax += wasBig ? 40 : 15; s.hp = s.hpMax;
      if (nr.lifespan) s.lifespan += nr.lifespan;
      s.demon = clamp(s.demon - (wasBig ? 12 : 5), 0, 100);
      gains.push(`灵气底蕴 +1（战斗每回合灵气增长）`);
      gains.push(`灵力上限 +${spGain}（至 ${nr.spMax}）`);
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
    return new CombatAPI.Fighter({
      name: s.name,
      hp: s.hp,
      sense: s.sense,
      speed: State.effectiveSpeed(),
      insight: s.insight,
      gongli: gongli,
      agility: Math.round(State.effectiveSpeed() * 0.6),   // 遁速提供基础闪避
      profile: "hanli_si",       // 四灵根·缺土
      elem: (DATA.techniques[s.technique] || {}).attr || null,   // 道基=主修功法行属（克制语言）
      spells,
      auxSkills: (typeof Loadout !== "undefined") ? Loadout.auxSkillSet(s) : [],
      technique: s.technique,     // 主修功法（影响同系招式）
      grade: (DATA.techniques[s.technique] || {}).grade || 1,  // 主修功法品阶
      realmTier: Chapters.realmTier(),   // 本章大境界序（影响法术成长）
      momentumCap: s.swordMastery ? 7 : 5,   // 眨眼剑法大成：剑势上限+2
      swordMastery: !!s.swordMastery,        // 大成：眨眼剑法本体蜕变（攒势翻倍）
      qiLayer: realm.layer,                  // 灵气底蕴随练气层数成长
      // fail-forward：决战每败一次=看破对方几分路数，再战伤害+8%（至多+24%）——
      // 韩立吃的每次亏都是学费（爽文契约：失败向前走）
      dmgBonus: 1 + Math.min(3, (s.flags[`losses_${this._nextFightType || ""}`] || 0)) * 0.08,
      // 底牌：平时准备的毒草、暗器、符箓带进战斗（准备内化进战斗）
      pouch: { duyao_cao: State.count("duyao_cao"), anqi: State.count("anqi"),
               huoshe_fu: State.count("huoshe_fu"), hanbing_fu: State.count("hanbing_fu"),
               jinguang_zhuan_charge: State.count("jinguang_zhuan_charge") },
    });
  },

  // 侧位单位（尸傀/灵宠/傀儡）：随行出战的第二单位（combat-arsenal-design.md 轴4）
  sideUnitFor(fightType) {
    const s = State.data;
    const u = s.sideUnit;
    if (!u || u.status === "broken" || u.carry === false) return null;
    if (fightType === "breakthrough") return null;   // 心魔是自己的战斗，外物难援
    return { id: u.id, name: u.name, hp: u.hp, hpMax: u.hpMax, atk: u.atk, atkName: u.atkName,
             elem: u.elem || null, nature: u.nature || null, guard: u.guard || 0.3 };
  },
  // 战后把侧位单位的损耗写回（hp 归零=破损，须修缮，不会永失——尸傀不死，只是坏了）
  _syncSideBack() {
    const c = this._combat, s = State.data;
    if (!c || !c.side || !s.sideUnit) return;
    s.sideUnit.hp = clamp(Math.round(c.side.hp), 0, s.sideUnit.hpMax);
    if (s.sideUnit.hp <= 0 && s.sideUnit.status !== "broken") {
      s.sideUnit.status = "broken";
      this.log(`「${s.sideUnit.name}」在战斗中损毁严重，再难驱使——回药庐以毒物阴材温养修缮，方可复原。`, "bad");
    }
  },

  // 战斗结束后，把战中消耗的底牌写回主背包
  _syncPouchBack() {
    const c = this._combat;
    if (!c) return;
    const p = c.player.pouch || {};
    ["duyao_cao", "anqi", "huoshe_fu", "hanbing_fu", "jinguang_zhuan_charge"].forEach(id => {
      const left = p[id] || 0;
      const had = State.count(id);
      if (left < had) State.take(id, had - left);
    });
  },

  // 普通遭遇战
  startEncounterFight(enemyId) {
    const tmpl = WORLD.enemies[enemyId];
    if (!tmpl) { this.log("虚惊一场，并无敌踪。", "sys"); return; }
    const enemy = this._applyDossier(Object.assign({}, tmpl));
    this._combat = new CombatAPI.Combat({
      player: this.playerFighter(),
      enemies: [enemy],
      maxRounds: 20,
      side: this.sideUnitFor("encounter"),
    });
    this._combatMeta = { type: "encounter", reward: tmpl.reward, enemyName: tmpl.name,
      namedBeast: enemyId.indexOf("beast_") === 0 ? enemyId : null, namedLoot: tmpl.namedLoot || null };
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

    const modafu = { name: "墨大夫", hp: 52, profile: "modafu", sense: 6, speed: 9, agility: 4, tactics: "cunning", qiLayer: 4, elem: "mu",
      attacks: [{ name: "毒掌", dmg: 12, kind: "normal", weight: 12 }, { name: "腐骨毒针", dmg: 14, pierce: true, kind: "pierce", weight: 8 }] };
    const tienu  = { name: "铁奴（张铁尸傀）", hp: 70, nature: "corpse", sense: 3, speed: 6, agility: 4, tactics: "feral",
      introNote: "铁奴乃尸傀死物——尸无血脉，百毒不侵！毒计无用，须以剑与暗器正面强攻。",
      attacks: [{ name: "尸傀挥击", dmg: 14, kind: "normal", weight: 14 }, { name: "崩山重捶", dmg: 19, kind: "charge", weight: 6 }] };
    const yuhun  = { name: "余子童元神", hp: 40, nature: "ghost", sense: 18, speed: 14, agility: 8, gongli: 22, qiLayer: 6,
      introNote: "元神无形无质——剑、毒、暗器皆穿身而过！唯「运功镇魂」能伤其分毫（需木1水1），神魂镇压正是鬼魅克星。留住灵气，稳住心神！",
      atkName: "夺舍侵神", atk: 11 };   // 失了傀儡与皮囊的虚弱残魂（被秒式难度违背爽文契约）

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
      this._combat.player.momentum = Math.min(this._combat.player.momentumCap, hidden * 2);
      this._combat.enemies.forEach(e => { e.dodgeBuff = (e.dodgeBuff || 0) - 0.1; });
      this._combat._log(`墨大夫瞳孔骤缩，声音都变了调："什么？！你……你竟然已是${realRealm}——这不可能！！"`);
      this._combat._log(`【扮猪吃虎】深藏 ${hidden} 层修为今夜尽数亮出——你开局即蓄剑势 ${this._combat.player.momentum}，敌方心神大乱（首回合更易命中）！`);
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
      name: "金光上人", hp: 120, profile: "common", sense: 14, speed: 13, agility: 10,
      tactics: "guarded", qiLayer: 7, elem: "jin",
      guardMove: { name: "金钟罩·重聚", shield: 16 },
      introNote: "金光上人乃修仙杀手，一身金系符术天克你的木行道基，金钟罩固若金汤且会重聚——硬拼必败！以毒续伤、以暗器破甲、以火符灼金，方有胜机。",
      attacks: [
        { name: "金符破空", dmg: 15, kind: "normal", weight: 12, elem: "jin" },
        { name: "剑符斩", dmg: 18, pierce: true, kind: "pierce", weight: 7, elem: "jin" },
        { name: "金刚伏魔", dmg: 20, kind: "charge", weight: 5, elem: "jin" },
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

    let bottleneckHp, maxRounds, demonName, demonAtk, intro;
    if (isBig) {
      // 大境界·心魔劫：以秘仪配置为基准，远比小境界凶险
      const rite = opts.rite || this._bigRealmRite() || {};
      bottleneckHp = Math.round((rite.trialHp || 90) - culRatio * 20);
      maxRounds = Math.max(6, (rite.trialRounds || 10) + Math.floor((s.spirit / realm.spMax) * 4) - Math.floor(s.demon / 25));
      demonName = `${rite.name || (nextRealm ? nextRealm.name : "瓶颈")}·心魔劫`;
      demonAtk = 14;
      intro = `你按秘仪引动天地之力冲击「${nextRealm ? nextRealm.name : "大境界"}」之关，生平执念尽数化作心魔劫扑面而来——成败、生死，皆在此一战！`;
    } else {
      bottleneckHp = Math.round(40 + s.realmIndex * 14 - culRatio * 22);
      maxRounds = Math.max(4, rounds);
      demonName = `${nextRealm ? nextRealm.name : "瓶颈"}·心魔`;
      demonAtk = 9;
      intro = `心魔过盛，冲关之际它趁虚而起——你须先在心战中降伏它，方能突破至「${nextRealm ? nextRealm.name : "下一层"}」！`;
    }

    const player = this.playerFighter();
    player.hp = Math.max(20, daoxin); player.hpMax = player.hp;

    this._combat = new CombatAPI.Combat({
      player,
      enemies: [{ name: demonName, hp: Math.max(20, bottleneckHp),
                  sense: 5, agility: 0, atkName: "心魔反噬", atk: demonAtk }],
      maxRounds,
      mode: "breakthrough",
    });
    this._combatMeta = { type: "breakthrough", big: isBig };
    s.combat = true;
    this._combat.startRound();
    this.log(intro, "event");
    UI.openCombat(this._combat, this._combatMeta);
  },

  // 玩家在战斗中施法
  combatCast(spellId, targetIndex) {
    if (!this._combat) return;
    const r = this._combat.cast(spellId, targetIndex);
    if (!r.ok) { this.toast(r.reason); return; }
    if (typeof UI !== "undefined" && UI.flushCombatFx) UI.flushCombatFx(this._combat);
    if (typeof UI !== "undefined" && UI.flashCombat) UI.flashCombat(spellId);
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
    // 交手自动补全：见过的招永久入册（情报面纱 L1）
    this._recordIntelFromCombat(c);
    // 克制揭示写回：打过才知道的道基行属，永久记入（图鉴/再战行徽）
    (c._reveals || []).forEach(r => { s.intelElems = s.intelElems || {}; s.intelElems[r.name] = r.elem; });
    // 漂亮的赢：赢的方式也值得记住
    if (win) this._checkMedals(c);

    // 同步战中消耗的底牌（毒、暗器、符箓）回主背包；侧位单位损耗回写
    this._syncPouchBack();
    this._syncSideBack();

    // 同步玩家气血回主状态（突破是"道心"，不回写气血）
    if (meta.type !== "breakthrough") {
      s.hp = clamp(Math.round(c.player.hp), 0, s.hpMax);
    }

    UI.closeCombat();

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
        // 异闻妖王伏诛：专属战利 + 年表勋章 + 名声入风云录（扬名雏形）
        if (meta.namedBeast) {
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
      } else {
        this._bountyFight = false;
        const dmg = Math.round(s.hpMax * 0.2);
        s.hp = clamp(s.hp - dmg, 1, s.hpMax);
        s.demon = clamp(s.demon + 8, 0, 100);
        this.log(`你不敌「${meta.enemyName}」，负伤遁走（气血-${dmg}）。`, "bad");
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
    } else if (meta.type === "breakthrough") {
      this._resolveBreakthroughResult(win);
    }
    this._combat = null;
    this._combatMeta = null;
    this.checkLifespan();
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
