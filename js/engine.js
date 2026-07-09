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

  // 在场人物是否应显示真名（metNpcs / 剧情旗 / 交情）
  isNpcKnown(id) {
    const s = State.data;
    if (!id) return false;
    if ((s.metNpcs || []).includes(id)) return true;
    if (typeof INTERACTIONS !== "undefined") {
      const rel = INTERACTIONS.relationOf(s, id);
      if (rel && rel > 0) return true;
    }
    const KNOWN = {
      lifeiyu: () => !!s.flags.met_friends,
      zhangtie: () => !!s.flags.met_friends && !s.flags.zhangtie_dead,
      modafu: () => !!s.flags.met_modafu,
      mocaihuan: () => !!s.flags.mo_met,
      wanxiaoshan: () => !!s.flags.wan_met,
    };
    return KNOWN[id] ? KNOWN[id]() : false;
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
    // 材料传闻链：同构的"风声→寻踪→探索采得"
    this._tickMaterialRumor(months);
    // 时间推进后检查到期的任务与预定事件
    this._checkSchedule();
  },

  // 世间百态：随时间流动的氛围事件（野狼帮/门派/市井三条线，只造氛围不改数值）
  _AMBIENT_EVENTS: [
    // —— 七玄门篇·凡俗小镇市井（仅本篇语境，jinguang_dead 后退场；黄枫谷起不再播凡俗旧闻）——
    { cond: (s) => s.activeChapter === "qixuan" && !s.flags.jinguang_dead, text: "听闻野狼帮又吞了一家镖局，山下商旅背地里骂声载道。" },
    { cond: (s) => s.activeChapter === "qixuan" && !s.flags.jinguang_dead, text: "集镇酒肆里有人压低声音说，野狼帮在招揽亡命之徒，开的价钱不低。" },
    { cond: (s) => s.activeChapter === "qixuan" && s.flags.gang_war && !s.flags.jinguang_dead, text: "七玄门与野狼帮的梁子越结越深，山下行人入夜便不敢出门。" },
    { cond: (s) => s.activeChapter === "qixuan", text: "门中贴出告示：后山深处近来有凶兽伤人，弟子结伴方可入山。" },
    { cond: (s) => s.activeChapter === "qixuan", text: "几名外门弟子因私斗被罚去担水三月，门规面前没人讲情面。" },
    { cond: (s) => s.activeChapter === "qixuan", text: "市集上新到了一批南边的药材，价钱压得很低，药铺掌柜们脸色难看。" },
    { cond: (s) => s.activeChapter === "qixuan", text: "听说邻县遭了蝗灾，逃难的人拖家带口往这边来，镇口多了不少生面孔。" },
    { cond: (s) => s.activeChapter === "qixuan", text: "山道上的老茶棚换了新主人，旧主人据说进山采药，再没回来。" },
    // —— 黄枫谷篇·仙门驻地百态（各脉机锋／灵药行情／禁地余响／同门轶事——本分修行的仙家日子）——
    { cond: (s) => s.activeChapter === "huangfeng", text: "万宝楼挂出新到的丹方玉简，几位内门弟子围着争看，灵石拍得叮当响。" },
    { cond: (s) => s.activeChapter === "huangfeng", text: "听说炼丹堂走水了半间，烧了某位师叔积攒多年的火候——丹道一途，急不得。" },
    { cond: (s) => s.activeChapter === "huangfeng", text: "谷中又有弟子闭死关，三月不出。同门私下打赌：这回是破境，还是走火。" },
    { cond: (s) => s.activeChapter === "huangfeng", text: "血色禁地的灵气一年薄似一年，老弟子叹气：当年遍地主药的光景，再不会有了。" },
    { cond: (s) => s.activeChapter === "huangfeng", text: "坊市口的告示换了——各脉灵田歉收，今年的例钱怕是要打折扣。" },
    { cond: (s) => s.activeChapter === "huangfeng", text: "执法堂抓了个偷采百药园的杂役，杖责三十、逐出谷去。园里人这几日都安分了许多。" },
    { cond: (s) => s.activeChapter === "huangfeng", text: "听闻掩月宗的人又来谷里走动了——那等大派的修士，眼睛长在头顶上。" },
    { cond: (s) => s.activeChapter === "huangfeng", text: "谷外乌龙潭近来不太平，记名弟子结伴去试剑的，回来时少了一个。" },
    // —— 魔道争锋篇·前线/京城（战时肃杀·正魔交锋·京城暗流）——
    { cond: (s) => s.activeChapter === "modao", text: "前线又添了新坟。征调令一道接一道，待命营里的脸一天比一天沉。" },
    { cond: (s) => s.activeChapter === "modao", text: "营中私语：魔道这回是倾巢而出，七派会盟也未必压得住。" },
    { cond: (s) => s.activeChapter === "modao", text: "京城连着几日有散修失踪，巡夜的兵卒讳莫如深，只说『莫要夜行』。" },
    { cond: (s) => s.activeChapter === "modao", text: "听闻黑煞教以血祭炼煞，所过之处人畜不留——这等邪法，天理难容。" },
    // —— 初入星海篇·乱星海（海客江湖·妖兽猎场·星宫秩序）——
    { cond: (s) => s.activeChapter === "starsea", text: "码头又靠了艘满载妖丹的商船，引得半个坊市的修士围上去问价。" },
    { cond: (s) => s.activeChapter === "starsea", text: "外海传回消息：某座灵岛被妖潮淹了，岛上散修十不存一。海凶莫测。" },
    { cond: (s) => s.activeChapter === "starsea", text: "星宫又出了新的悬赏，猎杀外海妖兽的玉牌挂了一长串，价高者得。" },
    { cond: (s) => s.activeChapter === "starsea", text: "坊间传说乱星海深处有上古洞府现世，引得不少结丹修士结伴远航。" },
    // —— 通用（任何篇章·点季节/修行感，不带凡俗地域）——
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
      cond: (s) => s.activeChapter === "qixuan",
      stages: [
        { news: "坊间闲话：老猎户陈伯进山七八日了，还没见回来。家里人急得直哭。" },
        { news: "猎户陈伯的草鞋在后山涧边被人寻着了——人多半是没了。山里人叹：靠山吃山，也葬于山。" },
        { news: "有人说陈伯生前在后山深处拾掇了一片药园，如今成了无主之物……手快有，手慢无。", window: "herb_garden", windowMonths: 3,
          windowNote: "无主药园（后山·限时）" },
      ],
    },
    {
      id: "pill_theft",
      cond: (s) => s.activeChapter === "qixuan",
      stages: [
        { news: "门里传开了：丹房昨夜失窃，丢了一批养元丹。管事们脸色铁青。" },
        { news: "失窃案有了眉目——竟是个外门弟子监守自盗，已被废了功夫逐出山门。" },
        { news: "那批赃丹几经转手流入了山下黑市，价钱压得极低。集镇的药贩子们闷声发财。", window: "cheap_pills", windowMonths: 3,
          windowNote: "黑市贱卖养元丹（集镇·限时）" },
      ],
    },
    {
      // 黄枫谷篇·涟漪链：某脉灵田歉收→灵草价涨→坊市抢购窗口（贴百药园灵药经济·无需新战斗）
      id: "lingtian_blight",
      cond: (s) => s.activeChapter === "huangfeng",
      stages: [
        { news: "坊市传开：青芫峰一脉的灵田闹了药瘟，半数灵草烂在田里，今秋怕是要歉收。" },
        { news: "歉收坐实了——万宝楼的灵草价一日三涨，囤了货的弟子捂着不卖，等着再翻一倍。" },
        { news: "你掌着百药园，手里的灵草此刻正是稀罕物。趁这波价高出手，能换不少灵石。", window: "lingcao_boom", windowMonths: 3,
          windowNote: "灵草涨价·囤货高价出手（坊市·限时）" },
      ],
    },
    {
      id: "wolf_draft",
      cond: (s) => !s.flags.departure_complete,
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
        // 链条件不再满足（如已入仙门）——中止推进，标记完成
        if (chain.cond && !chain.cond(s)) { s.doneRipples.push(chain.id); s.ripple = null; return; }
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
    const pool = this._RIPPLES.filter(r => {
      if ((s.doneRipples || []).includes(r.id)) return false;
      // 已入仙门则不再起凡俗涟漪链（野狼帮等）
      if (r.cond && !r.cond(s)) return false;
      return true;
    });
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
    } else if (windowId === "lingcao_boom") {
      // 黄枫谷篇·灵草涨价窗口：把囤的灵草高价出手换灵石（百药园经济兑现·无战斗）
      const n = State.count("lingcao");
      if (n < 1) { this.toast("你手里没有灵草可卖", true); return; }
      const sell = Math.min(n, 20);
      State.take("lingcao", sell);
      const gain = sell * 2;   // 涨价行情：每株 2 灵石（平日万宝楼难有此价）
      State.give("lingshi", gain);
      this.log(`【灵草行情】趁着青芫峰歉收的涨价潮，你把囤的灵草 ${sell} 株尽数出手——换得灵石 ${gain}。掌着百药园，这波你吃得最饱。`, "good");
      s.rippleWindow = null;
      if (typeof Sfx !== "undefined") Sfx.play("success");
      this.checkLifespan(); State.save(); UI.renderAll();
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
    // 应战切磋：进真实斗法（结算在 _finishCombat 的 spar 分支）
    if (choice.spar) {
      s._pendingInteraction = null;
      UI.closeModal();
      this.startSparFight(inter);
      State.save();
      return;
    }
    const r = choice.effect ? choice.effect(s) : { text: "", kind: "event" };
    s._pendingInteraction = null;
    this.log(`【${built.title}·${inter.npcName}】${r.text}`, r.kind || "event");
    this.flushNpcGifts();
    // 结果就地呈现（不黑箱）：同一个弹窗切成结算页，玩家看清后再自己关
    if (typeof UI !== "undefined" && UI.showInteractionResult) UI.showInteractionResult(built.title, r);
    else UI.closeModal();
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

    // L3: 行动过程叠层动画
    const _overlayMap = { cultivate: "meditate", rest: "meditate", gather: "gather", explore: "explore", adventure: "explore", alchemy: "meditate", investigate: "explore", spar: "explore" };
    if (_overlayMap[action] && UI._playActionOverlay) UI._playActionOverlay(_overlayMap[action]);

    if (action === "cultivate") { UI.openSeclusion(); return; }
    else if (action === "adventure") this.adventure();
    else if (action === "rest") this.rest();
    else if (action === "breakthrough") { UI.openBreakthrough(); return; }
    else if (action === "bottle") { UI.openBottle(); return; }
    else if (action === "lianfu") { UI.openFuluCraft(); return; }
    else if (action === "gather") this.gather();
    else if (action === "spar") this.spar();
    else if (action === "market") { UI.openMarket(); return; }
    else if (action === "fair") { UI.openFair(); return; }
    else if (action === "yaoyuan") { this.yaoyuanWork(); return; }
    else if (action === "wanbao") { UI.openWanbao(); return; }
    else if (action === "alchemy") this.alchemy();
    else if (action === "investigate") this.investigate();
    else if (action === "explore") { this.enterHoushan(); return; }
    else if (action === "board") { this.cityRead("board"); return; }
    else if (action === "rumor") { this.cityRead("rumor"); return; }
    else if (action === "travel") { UI.openTravel(); return; }  // openTravel 已重定向到世界地图 Z4
    else if (action === "wujian") { this.doWujian(); return; }
    else if (action === "liandan") { this.lianZhujiDan(); return; }

    this.checkLifespan();
    this.checkStory();
    // 主线/战斗/奇遇都不抢占时，NPC 才可能主动找上门
    if (!s.pendingEvent && !s.combat && !this._pendingFortune) this._maybeInteraction();
    // 即时反馈（嗑瓜子）：直接执行的行动（打坐/历练/采药/切磋…）结算后亮一条见闻
    if (!s.pendingEvent && !s.combat && !this._pendingFortune) this._flashLastLog();
    State.save();
    UI.renderAll();
  },
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

  /* -------- 城味·复访变迁：细读告示 / 城南探风声 -------- */
  /* 把既有剧情 flag 投影成市井见闻（门庭冷落→豺狗缩爪→寒毒解·太南榜文）。
   * 驻足一瞬不耗月；文案单一数据源＝据点风味 ExploreMap.MAPS（箱庭退役为风味库，只留战斗探索）。 */
  cityRead(kind) {
    const s = State.data;
    const loc = State.location();
    if (!loc || !loc.reads || !loc.flavorRef || typeof ExploreMap === "undefined") return;
    const map = ExploreMap.MAPS[loc.flavorRef.map];
    const node = map && map.nodes[loc.reads[kind]];
    if (!node) return;
    const fl = ExploreMap.flavor(node, s.flags);
    this.log((fl && fl.read) || node.read, "event");
    State.save();
    UI.renderAll();
  },

  /* -------- 采药（后山）：药理熟练度——干什么都有正反馈 -------- */
  gather() {
    const s = State.data;
    this.passTime(WORLD.activities.gather.timeCost);
    if (!s.skills) s.skills = { alchemy: 0, scouting: 0 };
    const div = s.flags && s.flags.dan_ms_bianyao ? 6 : 8;   // 丹道·辨药入门里程碑：识别量更丰（每6级多识一株）
    const bonus = Math.floor((s.skills.alchemy || 0) / div);
    const n = 1 + Math.floor(Math.random() * 3) + bonus;
    State.give("lingcao", n);
    if (Math.random() < 0.4 + (s.skills.alchemy || 0) * 0.01) State.give("duyao_cao", 1);
    s.skills.alchemy += 1;
    this.log(`你在灵草丛中采得灵草 ×${n}` + (s.inventory.duyao_cao ? "，还顺手挖到一株毒草" : "") + `。（药理+1，现 ${s.skills.alchemy}）`, "good");
    this._checkSkillMilestones("alchemy");
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

  /* -------- 杂学里程碑：丹道(alchemy)/阵法(fulu) 深耕的「独占能力台阶」 --------
   * 设计哲学（用户裁决 2026-06-30·非对称三路）：丹/阵不塞伤害公式（违一致感），
   *   而以「里程碑解锁独占能力/被动增强」做深耕甜头——剑道=直接战力乘区，丹道=底牌制造路，
   *   阵法=控场/洞府乘区。三路各填战力公式不同格子，刻意不对称。
   * 解锁即置 flag（存档惰性·不改 schema）+ 报喜 + 入年表。读时检查、幂等（flag 防重）。 */
  _SKILL_MILESTONES: {
    alchemy: [
      { at: 20, flag: "dan_ms_bianyao", title: "丹道·辨药入门", log: "【丹道精进】药理通了关窍——采药辨药一眼定真假，往后采得更丰（识别量+）。" },
      { at: 40, flag: "dan_ms_anshen", title: "丹道·自炼凝神丹", log: "【丹道精进】凝神丹的火候你已了然——自此洞府可亲手炼制凝神丹（安神压魔），不必再仰仗坊市稀货。" },
      { at: 60, flag: "dan_ms_chunqing", title: "丹道·丹火纯青", log: "【丹道精进】丹火纯青，一炉常得双丹——炼药出丹率更稳、偶得三丹。" },
    ],
    fulu: [
      { at: 15, flag: "zhen_ms_wengu", title: "阵法·布阵稳固", log: "【阵法精进】阵脚扎得更稳——探索中布下的阵旗多撑两回合。" },
      { at: 30, flag: "zhen_ms_juling", title: "阵法·洞府聚灵阵", log: "【阵法精进】你能在洞府铺设永久聚灵阵了——阵眼吐灵，自此闭关修为增速再进一档（×1.08·与灵泉/补天叠乘）。" },
    ],
  },
  // 检查并解锁某条熟练度的到点里程碑（采药/炼药/制符后调用）。
  _checkSkillMilestones(skill) {
    const s = State.data;
    const lv = (s.skills && s.skills[skill]) || 0;
    const table = this._SKILL_MILESTONES[skill];
    if (!table) return;
    s.flags = s.flags || {};
    for (const m of table) {
      if (lv >= m.at && !s.flags[m.flag]) {
        s.flags[m.flag] = true;
        this.log(m.log, "good");
        this.addMilestone(m.title, "deed");
        if (typeof Sfx !== "undefined") Sfx.play("bell");
      }
    }
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
      const gdef = DATA.gear[itemId];
      const layer = State.gateLayer();
      const canFull = gdef && (!gdef.minLayer || layer >= gdef.minLayer);
      if (canFull) {
        this.toast(`${item.name} 到手——修为已够，当即祭起炼化！`);
      } else if (gdef && gdef.minLayer) {
        const mpMul = Balance.gearLayerMpMul(layer, gdef.minLayer);
        this.toast(`${item.name} 到手——越阶催动，灵力消耗×${mpMul.toFixed(1)}！`);
      } else {
        this.toast(`${item.name} 到手`);
      }
    } else {
      this.toast(`${item.name} 到手`);
    }
    // 法器自动装备：购得即驱使——越阶催动只增灵力消耗，不拦截装备（杀手锏设计）
    const gearDef = DATA.gear[itemId];
    if (gearDef) {
      this.equipGear(itemId);
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
    const layer = State.gateLayer();
    // 越阶催动：不设硬门槛——修为不够只是灵力消耗倍增（杀手锏设计），不拦截装备
    if (def.minLayer && layer < def.minLayer) {
      const mpMul = Balance.gearLayerMpMul(layer, def.minLayer);
      this.toast(`越阶催动——灵力消耗×${mpMul.toFixed(1)}`, true);
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
    // 符箓方案（制符 v2）：购谱即解锁，自此可自产此符（并入大件图鉴）
    { id: "huoshe_fu", plan: "huoshe_fu", price: 3, once: true, note: "符谱·火蛇符（购得即可自制）" },
    { id: "hanbing_fu", plan: "hanbing_fu", price: 3, once: true, note: "符谱·寒冰符（购得即可自制）" },
    { id: "zheling_canbao", price: 3, once: true, note: "藏拙者的至宝" },
    { id: "huoshe_fu_done", buy: "huoshe_fu", price: 2, note: "现成符·比凡俗集镇地道得多" },
    { id: "hanbing_fu_done", buy: "hanbing_fu", price: 2, note: "现成符·同上" },
  ],
  fairBuy(itemId) {
    const s = State.data;
    const g = this.FAIR_GOODS.find(x => x.id === itemId);
    if (!g) return;
    // 符箓方案：购谱解锁配方（非入背包），走 learnFuluPlan
    if (g.plan) {
      if ((s.fuluPlans || []).includes(g.plan)) { this.toast("此符谱已购得"); return; }
      if (State.count("lingshi") < g.price) { this.toast(`需要灵石 ×${g.price}`, true); return; }
      State.take("lingshi", g.price);
      s.flags.fair_bought = (s.flags.fair_bought || 0) + 1;
      this.learnFuluPlan(g.plan, `太南小会购得符谱，灵石×${g.price}。`);
      this.checkStory();
      State.save(); UI.renderAll(); UI.openFair();
      return;
    }
    const buyId = g.buy || itemId;   // 现成符等：实际入袋的道具 id（与摊位 id 可不同）
    if (g.once && State.count(buyId) > 0) { this.toast("此物已购得"); return; }
    if (State.count("lingshi") < g.price) { this.toast(`需要灵石 ×${g.price}`, true); return; }
    State.take("lingshi", g.price);
    State.give(buyId, g.n || 1);
    s.flags.fair_bought = (s.flags.fair_bought || 0) + 1;
    const item = DATA.items[buyId];
    this.log(`【小会】你以灵石×${g.price}购得「${item.name}」${g.n > 1 ? `×${g.n}` : ""}。`, "good");
    if (g.rebate) {
      State.give("lingshi", g.rebate);
      this.log(`【小会】${g.rebateText}（灵石+${g.rebate}）`, "event");
    }
    if (buyId === "changchun_houpian") {
      this.toast("《长春功·后篇》到手！回洞府闭关研习，八层之路自此开启");
      this.addMilestone("太南小会：购得《长春功》后篇全本", "bigitem");
    } else {
      this.toast(`${item.name} 到手`);
    }
    const triggered = this.checkStory();
    State.save();
    UI.renderAll();
    if (!triggered) UI.openFair();
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
    // 丹道·丹火纯青里程碑：双丹基础上偶得三丹（独占增强）
    const tripleChance = s.flags && s.flags.dan_ms_chunqing ? 0.18 : 0;
    const trp = dbl && Math.random() < tripleChance;
    const got = trp ? 3 : (dbl ? 2 : 1);
    State.give("qingyuan_dan", got);
    s.skills.alchemy += 2;
    this.log(trp
      ? `丹火纯青，三花聚顶——这一炉竟得养元丹 ×3！（药理+2，现 ${s.skills.alchemy}）`
      : dbl
        ? `炉火纯青——这一炉竟得养元丹 ×2！（药理+2，现 ${s.skills.alchemy}）`
        : `你依墨大夫所授丹方，以灵草炼出一枚养元丹。（药理+2，现 ${s.skills.alchemy}）`, "good");
    this._checkSkillMilestones("alchemy");
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
   *  后山·野外战争迷雾舆图（七玄门篇·猎王篇）—— 见 js/exploremap.js
   *  入图整片覆雾，循迹寻王：① 邻接点亮 ② 望狼石登高揭片 ③ 远距感知梯度（兽吼/血腥气）。
   *  传闻层（异闻线索进度）按信息经济预亮巢穴并予伏击先手——只降雾，绝不增删世界。
   * =========================================================== */
  enterHoushan() {
    const s = State.data;
    if (s.combat) { this.toast("酣战之中，无暇他顾"); return; }
    s.exmap = ExploreMap.start("houshan_l1", { flags: s.flags });
    if (!s.exmap) { this.toast("此地暂不可探"); return; }
    this._applyHoushanRumors();   // 异闻在耳→按线索进度预亮巢穴（信息经济）
    this.log("你拨开后山口的荆棘，雾气扑面而来——再往里，便没有现成的路了。", "event");
    if (UI.openExmap) UI.openExmap();
    this._exmapSenseHint();       // 入口先递一句血腥气方位（诚实预告而非精确雷达）
    State.save();
  },

  // 传闻层（applyRumors）：异闻线索越多，越省摸索。clue<2 一无所知（循声自寻）；
  // clue≥2 知栖踪（预亮雾林）；clue 满（≥3）知巢穴与路数（预亮血食谷 + 伏击先手）。
  _applyHoushanRumors() {
    const s = State.data, x = s.exmap;
    if (!x || !s.beastRumor) return;
    const rdef = ((ExploreMap.MAPS.houshan_l1 || {}).rumors || {})[s.beastRumor];
    if (!rdef) return;
    const clue = s.beastRumorClue || 0;
    if (clue < 2) return;
    const nodes = clue >= 3 ? rdef.nodes : ["wulin"];
    const intel = clue >= 3 ? rdef.intel : null;
    const r = ExploreMap.applyRumors(x, [{ nodes, intel, note: rdef.note }]);
    if (r.ok && UI.exmapNote) {
      UI.exmapNote(rdef.note + (intel ? "——它的巢与路数，你已了然于胸。" : "——栖踪已现，巢穴仍需循声摸索。"), "good");
    }
  },

  // 远距感知读数：当前节点对最强危险源的方位强弱（一行预告，不报精确坐标）
  _exmapSenseHint() {
    const s = State.data, x = s.exmap;
    if (!x) return;
    const sf = ExploreMap.senseField(x);
    if (sf && UI.exmapNote) UI.exmapNote(`${sf.text}（${sf.dir}）`, sf.level >= 3 ? "warn" : "desc");
  },

  // 巢穴猎杀：在血食谷主动出击（异闻妖王即此处那一头）。传闻在握＝伏击先机。
  exmapHunt() {
    const s = State.data, x = s.exmap;
    if (!x) return;
    const f = ExploreMap.cur(x);
    const map = ExploreMap.mapOf(f);
    const node = map.nodes[f.node];
    if (!node || node.kind !== "danger" || f.hunted[f.node]) { this.toast("此处已无猎可寻", true); return; }
    const beast = (s.beastRumor && WORLD.enemies[s.beastRumor]) ? s.beastRumor : (map.beastEnemy || "wild_wolf");
    const ambush = !!(f.intel && f.intel.lair_route);
    this._exmapFightReturn = true;
    this._nextFightType = beast;
    if (UI.closeExmap) UI.closeExmap();
    this._caveFightCfg = (typeof Art !== "undefined" && Art.has && Art.has("houshan")) ? { sceneBg: "houshan" } : null;
    this.startEncounterFight(beast);
    this._caveFightCfg = null;
    if (ambush && this._combat && this._combat.enemies[0]) {
      const e = this._combat.enemies[0];
      const cut = Math.round(e.hpMax * 0.12);
      e.hp = Math.max(1, e.hp - cut);
      e.exposed = 1;   // 破绽暴露一回合（伏击先机）
      if (this._combat._log) this._combat._log(`你循着传闻摸清了它的巢与路数——伏击得手！${e.name} 当头中创（气血-${cut}，破绽大开）。`);
      this.log("【伏击】传闻里的那些弱点，这一刻全派上了用场。", "good");
    }
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
    // 探知熟练度：走得多了，眼睛和神识都更尖（暗室更易察觉，老手视野更阔）
    if (!s.skills) s.skills = { alchemy: 0, scouting: 0 };
    const xcfg = Object.assign({}, cfg, {
      senseVal: s.sense + Math.floor((s.skills.scouting || 0) / 8),
      sightRadius: (cfg.sightRadius || 1) + ((s.skills.scouting || 0) >= 16 ? 1 : 0),
    });
    // 妖王客观恒在：妖王本就盘踞栖地（beastHabitat），与"听没听过异闻"无关——
    //  · 身负异闻 → 名实一致 + 预知层（线索/弱点先至，深处必遇其名）；
    //  · 未闻异闻 → 仍可能在深处撞见（按 beastHabitatChance），只是事先不知（无预知、不弹听闻语）。
    // 已伏诛者退出栖地池；非栖地点（如血色禁地·墨蛟）保留其自有 boss 配置，不受异闻牵动。
    let foreknown = false;
    if (cfg.beastHabitat) {
      const slain = s.slainBeasts || [];
      const localIds = cfg.beastPool || (WORLD.beastRumors || []).map(r => r.id);
      if (s.beastRumor && localIds.includes(s.beastRumor) && WORLD.enemies[s.beastRumor] && !slain.includes(s.beastRumor)) {
        xcfg.bossEnemy = s.beastRumor;
        foreknown = true;
      } else {
        const pool = (WORLD.beastRumors || []).filter(r => localIds.includes(r.id) && !slain.includes(r.id) && WORLD.enemies[r.id]);
        const chance = cfg.beastHabitatChance != null ? cfg.beastHabitatChance : 0.3;
        if (pool.length && Math.random() < chance) {
          xcfg.bossEnemy = pool[Math.floor(Math.random() * pool.length)].id;
        }
      }
    }
    s.explore = Explore.generate(xcfg, Math.random);
    if (foreknown) {
      Explore._log(s.explore, `异闻在耳——「${WORLD.enemies[s.beastRumor].name}」就盘踞在此地深处。猎，或不猎？`);
    }
    // 材料传闻激活：传闻指向此站点 → 注入 specialHerb（传闻在耳，采得在脚）
    if (s.materialRumor && WORLD.materialRumors) {
      const mr = WORLD.materialRumors.find(x => x.id === s.materialRumor);
      if (mr && mr.site === siteId) {
        xcfg.specialHerb = mr.item;
        xcfg.specialHerbN = 2;
        // 重新生成（specialHerb 在 generate 时读取，需重新调用）
        s.explore = Explore.generate(xcfg, Math.random);
        Explore._log(s.explore, `传闻在耳——${mr.title}，就在这片地界深处。`);
      }
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

    // 异闻投放：深入栖地探索，最易撞见风声（按本地妖王池限定·无活跃异闻且尚有未伏诛妖王时）
    this._maybeBeastRumor(0.5, (DATA.exploreSites[st.siteId] || {}).beastPool);
    // 材料传闻投放：探索归来，风声更易入耳
    this._maybeMaterialRumor(0.35, [this._currentBeastArea()].filter(Boolean));

    // 材料传闻兑现：采得传闻指向的材料 → 标记已得、清除活跃传闻
    if (s.materialRumor && WORLD.materialRumors) {
      const mr = WORLD.materialRumors.find(x => x.id === s.materialRumor);
      if (mr && State.count(mr.item) > 0) {
        if (!(s.foundMaterials || []).includes(mr.id)) s.foundMaterials.push(mr.id);
        s.materialRumor = null;
        s.materialRumorClue = 0;
        s.materialRumorClueAt = null;
        this.log(`【传闻兑现】${mr.title}——传闻不虚，此物到手。`, "good");
        if (typeof Sfx !== "undefined") Sfx.play("success");
      }
    }

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

  /* ===========================================================
   *  据点节点图（和平·复用箱庭 L1 引擎，无灾厄钟/无巡逻）
   *  打样＝嘉元城（cutscene-design §五 / explore-redesign §P3.5）：
   *  地标+风物给"到了另一座城"的地方感；复访见变迁（既有 flag 投影）。
   *  "城中走走"是免费看一圈——走格不耗月；歇脚/采买/突破才走正常流程。
   * =========================================================== */
  enterStronghold(mapId) {
    const s = State.data;
    if (s.combat) { this.toast("酣战之中，无暇他顾"); return; }
    s.exmap = ExploreMap.start(mapId, { flags: s.flags });
    if (!s.exmap) return;
    if (typeof UI !== "undefined" && UI.openExmap) UI.openExmap();
    this._strongholdArrive();   // 入城落脚点的风物（复访变迁）
    State.save();
  },

  // 据点移动：相邻地标信步（不耗月、永无强战）。路途见闻+抵达风物走字幕。
  strongholdTravel(nodeId) {
    const s = State.data, x = s.exmap;
    if (!x) return;
    const r = ExploreMap.travel(x, nodeId);
    if (!r.ok) { this.toast(r.reason, true); return; }
    for (const ev of (r.events || [])) {
      if (ev.type === "note" && UI.exmapNote) UI.exmapNote(ev.text);
    }
    this._strongholdArrive();
    if (UI.renderExmap) UI.renderExmap();
    State.save();
  },

  // 抵达地标：按当前 flags 取风物变体（复访变迁），底部字幕呈现。
  _strongholdArrive() {
    const s = State.data, x = s.exmap;
    if (!x) return;
    const f = ExploreMap.cur(x);
    const node = ExploreMap.mapOf(f).nodes[f.node];
    if (!node) return;
    const fl = ExploreMap.flavor(node, s.flags);
    const desc = (fl && fl.desc) || node.desc;
    if (desc && UI.exmapNote) UI.exmapNote(desc, "desc");
  },

  // 地标交互·歇脚/采买/修炼：退出节点图，回正常地点流程（既有系统不重写、不叠浮层）。
  strongholdDo(action) {
    this.finishStronghold();
    this.doAction(action);
  },

  // 地标交互·告示/风声：复访变迁的"活感"——按 flags 念一段当前风闻（不离图、零负担）。
  strongholdRead(nodeId) {
    const s = State.data, x = s.exmap;
    if (!x) return;
    const node = ExploreMap.mapOf(ExploreMap.cur(x)).nodes[nodeId];
    if (!node) return;
    const fl = ExploreMap.flavor(node, s.flags);
    const txt = (fl && fl.read) || node.read || (fl && fl.desc) || node.desc;
    if (txt && UI.exmapNote) UI.exmapNote(txt, "desc");
  },

  // 离开据点节点图：只是收起这一层看一圈的视图，回到城中地点屏（无耗时、无结算）。
  finishStronghold() {
    const s = State.data;
    if (!s.exmap) return;
    s.exmap = null;
    if (UI.closeExmap) UI.closeExmap();
    this.checkStory();
    State.save();
    if (UI.renderAll) UI.renderAll();
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
      } else if (ev.type === "lookout") {
        // 登高揭片（后山·望狼石）：山坳里的去处一时尽收眼底
        if (UI.exmapNote) UI.exmapNote(ev.text, "good");
        if (typeof Sfx !== "undefined") Sfx.play("chime");
      } else if (ev.type === "sense") {
        // 远距感知梯度（后山·兽吼/血腥气）：只报方位强弱，不报精确坐标
        if (UI.exmapNote) UI.exmapNote(`${ev.text}（${ev.dir}）`, ev.level >= 3 ? "warn" : "desc");
        if (typeof Sfx !== "undefined" && ev.level >= 3) Sfx.play("danger");
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
          Engine.learnFuluPlan("dingshen_fu", "菡云芝在崖下随手画与你看的御灵宗控符法门。");
          Engine._exmapEvents(r.events);
          return { text: "你按剑立在崖下，神识张开四面——她攀上崖壁，把开得最盛的几朵尽数收入玉盒。\n\n「分你一朵，再加两张火蛇符。」她把东西塞过来，眼睛弯弯，「御灵宗欠你一个人情。人情比符值钱。」\n\n临别她又蹲下身，就着崖边的湿泥画了道符纹给你看：「这定身符的法子，你既会运笔，便拿去。」\n\n（烈阳花×1、火蛇符×2，习得「定身符方案」）", kind: "good" };
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
          Engine.learnFuluPlan("dingshen_fu", "菡云芝倾囊相授的御灵宗控符法门。");
          return { text: "她怔了怔，笑出声来：「太南小会那支笔，果然没送错人。」\n\n采完花，她把两张火蛇符硬塞进你手里，又取过一张空符纸，当场运笔画了道定身符纹，连禁锢的诀窍一并讲与你听：「这法子御灵宗不外传——可你不一样。」\n\n临别又留一句：「御灵宗在天南，有人欠你人情。」（火蛇符×2，习得「定身符方案」）", kind: "good" };
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
        // 阵法·布阵稳固里程碑：探索布阵旗化战场阵法多撑 2 回合（深耕被动）
        const wengu = (s.flags && s.flags.zhen_ms_wengu) ? 2 : 0;
        zones.push({ from: Math.max(0, cell - 1), to: Math.min(info.W - 1, cell + 1),
                     type: p.zone, turns: (p.zone === "juling" ? 5 : 4) + wengu, team: "player" });
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
    const isFog = !!(ExploreMap.MAPS[x.stack[0].mapId] || {}).fog;   // 后山野外迷雾图：无灾厄钟、脚程折耗月
    const gained = [];
    Object.entries(x.bag).forEach(([k, n]) => {
      if (n > 0) { State.give(k, n); gained.push(`${DATA.items[k] ? DATA.items[k].name : k}×${n}`); }
    });
    const fogClock = x.stack[0].clock || 0;
    s.exmap = null;
    delete s._caveSnap;
    if (isFog) {
      if (UI.closeExmap) UI.closeExmap();
      const summary = gained.length ? `清点行囊：${gained.join("、")}。` : "行囊空空。";
      this.passTime(Math.max(1, Math.round(fogClock * 0.5)));   // 脚程折耗月（与旧网格 finishExplore 同量级）
      this.log(`你循原路退出后山，雾气在身后缓缓合拢。${summary}`, "event");
      s.flags.adventured = true;
      if (!s.skills) s.skills = { alchemy: 0, scouting: 0 };
      s.skills.scouting += 2;
      this.checkLifespan();
      this.checkStory();
      State.save();
      UI.renderAll();
      return;
    }
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
      // 远雷·官道救行商兑现（铁律3）：当年救的行商缓过来了，发了家——投桃报李
      id: "jr_merchant_repay", weight: 30, title: "故人·官道重逢",
      cond: (s) => !!(s.ledger && s.ledger.saved_merchant_road) && !s.flags.merchant_repaid,
      text: "前方道旁支着顶气派的商棚，一队镖车正歇脚。一个圆胖商人远远瞧见你，愣了一下，忽然撇下伙计快步迎上来——「恩公！可算又遇着您了！」\n\n你定睛一看，竟是当年官道上那个遭劫、被你救回一命的行商。如今他气色红润、绸衫革靴，俨然发了家。",
      choices: [
        { text: "「举手之劳，不必挂怀。」", effect(s) {
          State.setFlag("merchant_repaid");
          s.silver += 20;
          State.give("lingshi", 2);
          if (typeof Engine !== "undefined" && Engine.settleLedger) {
            Engine.settleLedger("saved_merchant_road", "当年官道上随手救的那名行商，缓过命来发了家——今日重逢，他认得你这恩公，硬塞来盘缠与灵石，还递了句生意人的耳报");
          }
          s.mood = Math.min(s.moodMax, s.mood + 4);
          s.worldNews = s.worldNews || [];
          s.worldNews.push({ t: `第${s.year}年${s.month}月`, kind: "rumor", text: "行脚商人间传：那位走南闯北的‘恩公’，又被人念叨起来了。" });
          if (s.worldNews.length > 40) s.worldNews.splice(0, s.worldNews.length - 40);
          return { text: "他不由分说塞来一袋碎银和两枚灵石（纹银+20，灵石+2），又压低声音道：「恩公行走在外，消息最是要紧——近来这条道上哪伙人不好惹、哪处坊市的价钱实在，小的都替您记着。」\n\n（心境+4。一桩随手的善，绕了一圈，连本带利回到你手里。）", kind: "good" };
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
    const curNode = C.nodes.find(n => (n.locs || []).includes(s.location));
    s.journey = { to: nodeId, toName: node.name, leg: 0, total: months, from: curNode ? curNode.id : null };
    this.log(`你收拾行囊，踏上去「${node.name}」的路——约${months}月行程。江湖路远，晓行夜宿。`, "event");
    this.toast(`启程：${node.name}`);
    UI.closeModal();
    // 旅途可视化（P3）：切到地图主界面（Z3），头像将沿路线移动
    if (typeof UI !== "undefined" && UI._enterJourneyMap) UI._enterJourneyMap();
    State.save();
    this._journeyLeg();
  },

  // 走一段（1月）。每月主动抉择：赶路/扎营搜寻/采药/打听/跟商队（P0·旅途即内容升级）
  _journeyLeg() {
    const s = State.data;
    const j = s.journey;
    if (!j) return;
    if (j.leg >= j.total) { this._journeyArrive(); return; }
    j.leg += 1;
    this.passTime(1);
    if (s.combat || s.pendingEvent) { State.save(); UI.renderAll(); return; }   // 旅途被世界打断（剧情/战斗）：事毕由钩子续走
    // 旅途行动面板：每月主动抉择
    const panel = this._buildJourneyPanel(j);
    panel.journeyPanel = true;   // P3：底部 sheet 呈现——地图与头像移动不被遮挡
    this._pendingFortune = panel;
    this.log(`【旅途】第${j.leg}/${j.total}月：行至半途，须择路而行。`, "sys");
    State.save();
    UI.renderAll();
    // P3 移动一拍：先让头像沿路线滑行（CSS 过渡），再弹面板——旅途「走」被看见
    const openIt = () => { if (Engine._pendingFortune === panel) UI.openFortune(panel); };
    if (typeof UI !== "undefined" && UI._journeyReveal) UI._journeyReveal(openIt);
    else openIt();
  },

  // 旅途行动面板构建（P0）
  _buildJourneyPanel(j) {
    const s = State.data;
    const C = WORLD.continent;
    const fromNode = C.nodes.find(n => n.id === j.from);
    const route = C.routes.find(r =>
      (r.from === j.from && r.to === j.to) ||
      (r.from === j.to && r.to === j.from)
    );
    const terrain = (route && route.terrain) || "官道";
    j.terrain = terrain;

    const terrainDesc = {
      "山道": "山路崎岖，峰峦叠嶂——灵草隐于崖壁，野兽出没林间。",
      "官道": "官道平坦，车马往来——行脚商旅络绎不绝，消息也灵通些。",
      "平原": "旷野平畴，一览无余——路好走，却也少了藏身之处。",
      "丘陵": "丘陵起伏，林木葱茏——说不准哪里藏着好东西，也说不准哪里蹿出什么来。",
    };

    const choices = [];

    // 1. 赶路（兼程前进）
    choices.push({
      text: "赶路（兼程前进）",
      hint: "快速推进，可能遭遇旅途事件",
      effect: (s) => Engine._journeyActionTravel(s, j),
    });

    // 2. 扎营搜寻（探查四周）
    choices.push({
      text: "扎营搜寻（探查四周）",
      hint: "耗灵力4，可能发现物资或遭遇妖兽",
      cond: (s) => s.spirit >= 4,
      effect: (s) => Engine._journeyActionScout(s, j),
    });

    // 3. 采药（沿途采集）
    choices.push({
      text: "采药（沿途采集）",
      hint: "耗灵力2，采集灵草",
      cond: (s) => s.spirit >= 2,
      effect: (s) => Engine._journeyActionGather(s, j),
    });

    // 4. 打听风闻（留意消息）
    choices.push({
      text: "打听风闻（留意消息）",
      hint: "在途经之处打听消息",
      effect: (s) => Engine._journeyActionRumor(s, j),
    });

    // 5. 跟商队（结伴同行）
    choices.push({
      text: "跟商队（结伴同行）",
      hint: "耗纹银3，安全且心境回升",
      cond: (s) => s.silver >= 3,
      effect: (s) => Engine._journeyActionCaravan(s, j),
    });

    return {
      title: `旅途 · 第${j.leg}/${j.total}月`,
      text: `从「${fromNode ? fromNode.name : "出发地"}」往「${j.toName}」——${terrainDesc[terrain] || terrainDesc["官道"]}`,
      choices,
    };
  },

  // 旅途行动：赶路
  _journeyActionTravel(s, j) {
    // 25% 概率触发旅途事件（交互式，复用 _JOURNEY_EVENTS 池）
    if (Math.random() < 0.25) {
      const pool = this._JOURNEY_EVENTS.filter(e => !e.cond || e.cond(s));
      const sum = pool.reduce((a, e) => a + (e.weight || 10), 0);
      let r = Math.random() * sum, pick = pool[0];
      for (const e of pool) { r -= (e.weight || 10); if (r <= 0) { pick = e; break; } }
      this._pendingJourneyEvent = {
        title: `旅途 · ${pick.title}`,
        text: pick.text,
        choices: pick.choices.filter(c => !c.cond || c.cond(s)).map(c => ({ text: c.text, effect: c.effect })),
      };
      return { text: "你兼程赶路，行至一处——", kind: "sys" };
    }
    // 平安推进
    s.mood = clamp(s.mood - 2, 0, s.moodMax);
    const scenes = [
      "晓行夜宿，一路无话。",
      "道上行人渐稀，你独自走了半日，只有山雀相伴。",
      "日头偏西，你寻了处避风的山坳歇脚，明日再行。",
      "沿途风光平淡，偶尔掠过几只惊起的飞鸟。",
      "你脚下不停，翻过一道坡，远处山色渐近。",
    ];
    return { text: scenes[Math.floor(Math.random() * scenes.length)] + `「${j.toName}」又近了些。`, kind: "sys" };
  },

  // 旅途行动：扎营搜寻
  _journeyActionScout(s, j) {
    s.spirit = clamp(s.spirit - 4, 0, State.realm().spMax);
    const terrain = j.terrain || "官道";
    const roll = Math.random();
    const beastChance = terrain === "山道" ? 0.28 : terrain === "丘陵" ? 0.22 : 0.15;
    const herbChance = terrain === "山道" ? 0.35 : terrain === "丘陵" ? 0.30 : 0.25;

    if (roll < beastChance) {
      // 妖兽遭遇——山道出灵狼，官道出山贼
      const enemy = terrain === "山道" ? "wild_wolf" : "bandit";
      this._fortuneFight = enemy;
      return { text: terrain === "山道" ? "你在林中搜寻时，灌木丛猛然炸开——一头灵狼龇牙扑来！" : "你扎营探查时，几个拿刀的汉子从林子里钻出来——剪径的毛贼！", kind: "bad" };
    }
    if (roll < beastChance + herbChance) {
      // 发现物资
      const n = 1 + Math.floor(Math.random() * 2);
      State.give("lingcao", n);
      if (terrain === "山道" && Math.random() < 0.3) {
        State.give("duyao_cao", 1);
        return { text: `你在崖壁缝隙中寻得灵草×${n}，另采到一株毒草——山道险峻，好东西也多。（灵草+${n}，毒草+1）`, kind: "good" };
      }
      return { text: `你四处探查，寻得灵草×${n}。识货的眼睛，走到哪都饿不着。`, kind: "good" };
    }
    // 无所获
    s.mood = clamp(s.mood - 1, 0, s.moodMax);
    return { text: "你仔细搜寻了四周，除了一些寻常草木，并无特别发现。", kind: "sys" };
  },

  // 旅途行动：采药
  _journeyActionGather(s, j) {
    s.spirit = clamp(s.spirit - 2, 0, State.realm().spMax);
    const terrain = j.terrain || "官道";
    s.skills = s.skills || { alchemy: 0, scouting: 0 };
    s.skills.alchemy = (s.skills.alchemy || 0) + 1;
    const bonus = Math.floor((s.skills.alchemy || 0) / 8);
    let n = 1 + Math.floor(Math.random() * 2) + bonus;
    if (terrain === "山道") n += 1;
    if (terrain === "平原") n = Math.max(1, n - 1);
    State.give("lingcao", n);
    if (terrain === "山道" && Math.random() < 0.25) {
      State.give("duyao_cao", 1);
      this.log(`你在山道崖壁间采得灵草×${n}、毒草×1。山野灵药丰富，不虚此行。（药理+1）`, "good");
      return { text: `山道旁灵草丰茂——灵草×${n}，另得毒草×1。药理+1。`, kind: "good" };
    }
    this.log(`你沿途采集灵草×${n}，可投入小绿瓶催熟。（药理+1）`, "good");
    return { text: `你放慢脚步，沿途留意药草——灵草×${n}。药理+1。`, kind: "good" };
  },

  // 旅途行动：打听风闻
  _journeyActionRumor(s, j) {
    const terrain = j.terrain || "官道";
    const roll = Math.random();
    // 官道更容易打听到消息
    const rumorChance = terrain === "官道" ? 0.65 : terrain === "平原" ? 0.55 : 0.40;
    const npcChance = terrain === "官道" ? 0.20 : 0.10;

    if (roll < npcChance) {
      // 遇到 NPC
      const npc = WORLD.randomNpc ? WORLD.randomNpc(null, s) : null;
      if (npc) {
        const isNew = this.meetNpc(npc.id);
        const line = (npc.lines && npc.lines.length) ? npc.lines[Math.floor(Math.random() * npc.lines.length)] : (npc.line || "");
        this.log(`途中偶遇「${npc.name}」（${npc.role}）。${line ? npc.name + "道：「" + line + "」" : ""}${isNew ? "——初见记入图鉴。" : ""}`, "event");
        return { text: `你在歇脚处遇到一位行旅之人——「${npc.name}」，${npc.role}。${line ? "他道：「" + line + "」" : ""}`, kind: "event" };
      }
    }
    if (roll < npcChance + rumorChance) {
      // 听到传闻
      const rumor = this._randomRumor();
      this.log(`【旅途风闻】${rumor}`, "sys",
        { label: "旅途风闻", prompt: "在旅途中听到一句市井传闻，写一句即可，要符合当下世道：" });
      return { text: rumor, kind: "sys" };
    }
    // 没打听到什么
    s.mood = clamp(s.mood - 1, 0, s.moodMax);
    return { text: "你向路过的行脚商打听了一圈，都是些鸡毛蒜皮的事——没什么值得留意的。", kind: "sys" };
  },

  // 旅途行动：跟商队
  _journeyActionCaravan(s, j) {
    s.silver = Math.max(0, s.silver - 3);
    s.mood = clamp(s.mood + 5, 0, s.moodMax);
    // 5% 概率遭遇劫匪（但商队有护卫，战斗更轻松）
    if (Math.random() < 0.05) {
      this._fortuneFight = "bandit";
      return { text: "商队行至一处山口，几个毛贼拦住去路——商队护卫拔刀在前，你从旁策应！", kind: "bad" };
    }
    const scenes = [
      "你随商队一路同行，车马辚辚，倒也安稳。护卫们粗声大气地聊着江湖事，你听了一耳朵。",
      "商队老板是个健谈的胖子，一路上讲了不少沿途风物——什么地方的水甜、什么地方的匪多，都门儿清。",
      "你跟着商队走了半日，混在货车间不显山不露水。到得驿站，老板还请你喝了碗热汤。",
      "夜宿商队营地，篝火旁听行脚商讲外头的新鲜事——修仙人的传说越传越离谱，你听着暗自好笑。",
    ];
    return { text: scenes[Math.floor(Math.random() * scenes.length)] + `（纹银-3，心境+5）`, kind: "good" };
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
    // 旅途抵达：从地图切到场景（P3）
    if (typeof UI !== "undefined" && UI._journeyArriveTransition) UI._journeyArriveTransition();
    // 有地区层的节点：落脚其首地点
    if (node && node.locs && node.locs.length) {
      s.location = node.locs[0];
      // 黄枫谷：入谷即开新篇（驻地章——百药园三年的主场）
      if (node.id === "huangfeng" && !s.flags.huangfeng_entered) {
        State.setFlag("huangfeng_entered");
        if (typeof Chapters !== "undefined") { Chapters.unlock("huangfeng"); s.activeChapter = "huangfeng"; }
        this.log("【黄枫谷篇 · 启】青石阶尽头，仙鹤掠过山门。接引修士领你登记名册、发放青衫与居所腰牌——「外门弟子韩立，先去百药园报到吧。」（本篇主线：百药园三年、筑基丹恩怨、坊市归途、血色禁地——拾级而上。练气上限已放开至十三层，洞府诸事可自由经营。）", "event");
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
            return { text: "喜宴那日你坐在末席，看小妹蒙着红盖头给爹娘磕头。花轿抬出村口时，她忽然掀帘回头，朝你这边望了一眼。\n\n你在心里说：二哥对不住你，往后不能护着你了。\n\n临行前夜，你把十两银子缝进娘的旧棉袄，又在房梁上压了张字条——若有急难，去彩霞山下托人带话。（心境+12，心魔-10，纹银-10）\n\n走出村口那一步，你没有回头。", kind: "good" };
          },
        },
        {
          text: "盘桓三日，放下银两便走（+1月）",
          effect(sd) {
            Engine.passTime(1);
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
        s.journey = { to: back.id, toName: back.name, leg: 0, total: back.months || 1, back: true, from: "qingniu" };
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
    // 沉浸式呈现：缓冲一条「因果有报」演出拍，由 renderStory 在剧情流开头插入（不再只埋在日志里）
    this._pendingEchoes = this._pendingEchoes || [];
    this._pendingEchoes.push({ echo: echoText, cause: entry.label });
    return true;
  },

  /* 心性抉择（名场面态度·铁律3 闭环）：
   *   "回望/克制/动情"这类态度选择，它的「果」就是它当场塑造了「你是谁」——
   *   故种因即结算（写 ledger 闭环 + 计入 temperament 维度 + 留一行心性批注）。
   *   axis: "stoic"（克制/承志/斩牵绊）｜"sentiment"（动情/牵挂/回望）。
   *   兑现在「我的修仙人生」总结处统一呼应（temperamentEcho）。 */
  recordTemperament(id, axis, label) {
    const s = State.data;
    if (!s.temperament) s.temperament = { stoic: 0, sentiment: 0, marks: [] };
    // ledger 闭环：态度选择写读一体（不再是只记不结的悬空因）
    s.ledger = s.ledger || {};
    if (!s.ledger[id]) s.ledger[id] = { t: `第${s.year}年${s.month}月`, label };
    if (axis === "stoic" || axis === "sentiment") s.temperament[axis] = (s.temperament[axis] || 0) + 1;
    s.temperament.marks = s.temperament.marks || [];
    s.temperament.marks.push({ t: `第${s.year}年${s.month}月`, axis, label });
    return true;
  },

  /* 心性基调读数：克制 vs 动情的累计倾向 → 一句"你是谁"的总结（我的修仙人生·呼应位）。 */
  temperamentEcho() {
    const tm = (State.data && State.data.temperament) || { stoic: 0, sentiment: 0 };
    const st = tm.stoic || 0, se = tm.sentiment || 0;
    if (st + se === 0) return null;
    const diff = st - se;
    if (diff >= 2) return { tone: "stoic", text: "一路行来，你惯于把痛与念压进心底，化作前行的脚力。世人见你冷峻自持——这份克制，是你在仙途上为自己锻的甲。" };
    if (diff <= -2) return { tone: "sentiment", text: "一路行来，你始终不肯让那些人、那些牵挂轻易散去。回望、悼念、记挂——这份不肯凉透的心，是你修仙路上没丢的那点人味。" };
    return { tone: "balanced", text: "一路行来，你在克制与动情之间走着——该断时断得决绝，该念时念得真切。刚柔之间，自有你的分寸。" };
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

  // 异闻录留痕：听闻一桩异闻（风声在耳）即入录——图鉴卡态派生之一（恒在原则·非门槛）
  _seeYiwen(id) {
    const s = State.data;
    if (!s.yiwenSeen) s.yiwenSeen = [];
    if (id && !s.yiwenSeen.includes(id)) s.yiwenSeen.push(id);
  },

  // 异闻录卡态派生：done（已了）/ active（风声在耳）/ unseen（未闻）
  _yiwenState(e, s) {
    if (!e || !s) return "unseen";
    const lk = e.link || {};
    // done：doneFlag 优先（材料已消耗但 flag 为真）
    if (e.doneFlag && s.flags && s.flags[e.doneFlag]) return "done";
    if (lk.kind === "beastRumor" && (s.slainBeasts || []).includes(lk.id)) return "done";
    if (lk.kind === "ripple" && (s.doneRipples || []).includes(lk.id)) return "done";
    if (lk.kind === "item" && typeof State !== "undefined" && State.count(lk.id) > 0) return "done";
    if (lk.kind === "story" && s.flags && s.flags[lk.id]) return "done";
    // active：已听闻但未了
    const seen = (s.yiwenSeen || []).includes(e.id);
    return seen ? "active" : "unseen";
  },

  // 异闻妖王：听闻其名（投放）——威名先至，相遇在后。beastIds：限定可投放的异闻 id（区域投放）
  _maybeBeastRumor(chance, beastIds) {
    const s = State.data;
    if (s.beastRumor) return;
    if (typeof WORLD === "undefined" || !WORLD.beastRumors) return;
    let pool = WORLD.beastRumors.filter(r => !(s.slainBeasts || []).includes(r.id));
    if (beastIds) pool = pool.filter(r => beastIds.includes(r.id));
    if (!pool.length || Math.random() > chance) return;
    const r = pool[Math.floor(Math.random() * pool.length)];
    s.beastRumor = r.id;
    s.beastRumorClue = 0;
    s.beastRumorClueAt = (s.year || 0) * 12 + (s.month || 0);
    this._seeYiwen(r.id);
    this.log(`【异闻】${r.rumor}`, "event");
    this.toast("听到一桩异闻（见际遇栏）");
    if (typeof Sfx !== "undefined") Sfx.play("chime");
  },
  // 当前所在大陆节点 id（异闻按区域投放：彩霞山一带=caixia，黄枫谷一带=huangfeng）
  _currentBeastArea() {
    const s = State.data;
    if (typeof WORLD === "undefined" || !WORLD.continent) return null;
    const node = (WORLD.continent.nodes || []).find(n => (n.locs || []).includes(s.location));
    return node ? node.id : null;
  },
  // 当前是否身处彩霞山一带（后山可及）——保留兼容旧调用
  _nearHoushan() { return this._currentBeastArea() === "caixia"; },
  // 异闻链 · 随时间渐起（听闻→寻踪→相遇）：山里的风声会自己找上门，不必非要深入栖地才撞见
  _tickBeastRumor(months) {
    const s = State.data;
    if (typeof WORLD === "undefined" || !WORLD.beastRumors) return;
    const area = this._currentBeastArea();
    if (!area) return;
    // 本区域可投放的异闻（按 area 字段分区；未标 area 的旧条目归彩霞山）
    const areaIds = WORLD.beastRumors.filter(r => (r.area || "caixia") === area).map(r => r.id);
    if (!areaIds.length) return;
    if (!s.beastRumor) {
      // 听闻：身在异闻区域，约 18%/月 听到一桩新异闻（比"深入栖地30%"更易撞上）
      this._maybeBeastRumor(clamp(0.18 * months, 0, 0.4), areaIds);
      return;
    }
    // 寻踪：身负异闻时，随月份逐条浮现线索——把"突然弹一条"拉成有铺垫的逼近
    const r = WORLD.beastRumors.find(x => x.id === s.beastRumor);
    if (!r || !r.clues || !r.clues.length) return;
    s.beastRumorClue = s.beastRumorClue || 0;
    if (s.beastRumorClue >= r.clues.length) return;
    // 隔月铺陈：两条线索之间至少相隔 2 个月，连点跳月不会把 0→3/3 挤成一瞬
    const now = (s.year || 0) * 12 + (s.month || 0);
    if (s.beastRumorClueAt == null) s.beastRumorClueAt = now;
    if (now - s.beastRumorClueAt < 2) return;
    if (Math.random() > clamp(0.26 * months, 0, 0.5)) return;
    this.log(`【异闻】${r.clues[s.beastRumorClue]}`, "event");
    s.beastRumorClue++;
    s.beastRumorClueAt = now;
    if (typeof Sfx !== "undefined") Sfx.play("chime");
  },

  // 材料传闻：听闻→寻踪→探索采得（与异闻妖王同构的"风声→行动"链）
  _maybeMaterialRumor(chance, areaIds) {
    const s = State.data;
    if (s.materialRumor) return;
    if (typeof WORLD === "undefined" || !WORLD.materialRumors) return;
    let pool = WORLD.materialRumors.filter(r => !(s.foundMaterials || []).includes(r.id));
    if (areaIds) pool = pool.filter(r => areaIds.includes(r.area));
    if (!pool.length || Math.random() > chance) return;
    const r = pool[Math.floor(Math.random() * pool.length)];
    s.materialRumor = r.id;
    s.materialRumorClue = 0;
    s.materialRumorClueAt = (s.year || 0) * 12 + (s.month || 0);
    this._seeYiwen(r.id);
    this.log(`【传闻】${r.rumor}`, "event");
    this.toast("听到一桩材料传闻（见际遇栏）");
    if (typeof Sfx !== "undefined") Sfx.play("chime");
  },
  _tickMaterialRumor(months) {
    const s = State.data;
    if (typeof WORLD === "undefined" || !WORLD.materialRumors) return;
    const area = this._currentBeastArea();
    if (!area) return;
    const areaIds = [area];
    if (!s.materialRumor) {
      this._maybeMaterialRumor(clamp(0.14 * months, 0, 0.3), areaIds);
      return;
    }
    const r = WORLD.materialRumors.find(x => x.id === s.materialRumor);
    if (!r || !r.clues || !r.clues.length) return;
    s.materialRumorClue = s.materialRumorClue || 0;
    if (s.materialRumorClue >= r.clues.length) return;
    const now = (s.year || 0) * 12 + (s.month || 0);
    if (s.materialRumorClueAt == null) s.materialRumorClueAt = now;
    if (now - s.materialRumorClueAt < 2) return;
    if (Math.random() > clamp(0.22 * months, 0, 0.45)) return;
    this.log(`【传闻】${r.clues[s.materialRumorClue]}`, "event");
    s.materialRumorClue++;
    s.materialRumorClueAt = now;
    if (typeof Sfx !== "undefined") Sfx.play("chime");
  },
  cultivate(months) {
    const s = State.data;
    const root = State.root();
    const realm = State.realm();
    if (s.spirit < 15) {
      this.log("灵力枯竭，难以入定。你勉强收功，不得寸进。", "bad");
      this.rest(true);
      return 0;
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
    // 补天丹：伪灵根改善，吐纳百脉之效永久略增（乘性·非平铺，吃 A2 承重墙；幅度【设计取舍·待平衡组校】）
    const butianMul = s.flags.butian_used ? 1.10 : 1;
    // 三转重元功·真元精纯乘性印记：散功重修一遍，根基更纯，闭关修为增速永久略增（乘性·非平铺，吃 A2 承重墙）
    const zhuanMul = s.zhuanImprint || 1;
    // 阵法·洞府聚灵阵里程碑：阵眼吐灵，闭关增速再进一档（乘性·与灵泉/补天/三转叠乘——小绿瓶×灵泉×阵法三重乘法）
    const formationMul = s.flags && s.flags.zhen_ms_juling ? 1.08 : 1;
    const perMonth = Math.max(1, Math.round(base * root.cul * moodFactor * demonPenalty * dongfuMul * butianMul * zhuanMul * formationMul));
    let gain = perMonth * months;

    // 心境告急：心乱则修为难进、心魔易侵（杂念丛生，事倍功半）
    const lowMood = s.mood < s.moodMax * 0.35;
    if (lowMood) gain = Math.round(gain * 0.6);

    s.cultivation += gain;
    // 灵力随闭关消耗（封顶到当前上限）；长闭关后灵力近乎抽干
    s.spirit = clamp(s.spirit - 14 * months, 0, realm.spMax);
    // 心境随枯坐缓降，心魔随苦修渐生（时长越久越明显）
    s.mood = clamp(s.mood - 3 * months, 0, s.moodMax);
    // 心境安稳时，苦修本身可缓释心魔（水磨功夫——修为不只是灵力，也是心性）
    if (!lowMood && s.demon > 0) {
      const decay = Math.min(s.demon, Math.max(1, Math.floor(months * 1.5)));
      s.demon = clamp(s.demon - decay, 0, 100);
    }
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
    return gain;
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

  /* -------- 三转重元功·散功重修（一转）：根基重炼，刻入真元精纯乘性印记 --------
   * 散功＝青元剑诀重修（叙事「跌回入门重修」），但保留一份持久乘性印记 zhuanImprint
   * （每转 ×imprintMul 累乘），令重修一遍后比上一轮更纯——闭关修为增速永久略增。
   * 本篇只行一转（DATA.reforge.chapterZhuan.starsea=1）。乘性·不动 balance.js。
   * 二十载闭关时间跳已覆盖重修过程，故不剥离 techLayers（中途清零只惩罚无收益）。 */
  doReforge() {
    const s = State.data;
    const cfg = (typeof DATA !== "undefined") ? DATA.reforge : null;
    if (!cfg) return false;
    if (s.flags[cfg.doneFlag]) return false;           // 已转过·幂等
    const before = s.zhuanImprint || 1;
    s.zhuanImprint = Math.round(before * cfg.imprintMul * 1000) / 1000;
    State.setFlag(cfg.doneFlag);
    s.flags.zhuanCount = (s.flags.zhuanCount || 0) + 1;
    this.writeLedger("sanzhuan_yizhuan", `${cfg.name}·一转——散功重修青元剑诀，根基反比从前更纯。真元精纯乘性印记 ×${cfg.imprintMul}（闭关修为增速永久略增），不剥离已修层数（二十载苦修已重炼归位）。`);
    return true;
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

  // —— 功法升层（technique-tiers §5.2）：闭关肝条，成本＝时间(月)＋修为消耗，门槛＝须筑基方可推进剑系高层 ——
  // 返回 { ok, reason?, techId, name, cur, next, max, months, cultCost }
  canRefineLayer(techId) {
    const s = State.data;
    if (typeof Loadout === "undefined") return { ok: false, reason: "尚不可参研功法层" };
    techId = techId || s.technique;
    const def = DATA.techniques[techId];
    if (!def) return { ok: false, reason: "无此功法" };
    if (!Loadout.isLearned(s, techId)) return { ok: false, reason: "尚未习得此功法" };
    if (!def.maxLayers || def.maxLayers <= 1) return { ok: false, reason: "此功法无层数可进" };
    const cur = Loadout.techLayer(s, techId);
    const max = Loadout.maxLayer(techId);
    if (cur >= max) return { ok: false, reason: `${def.name}已至此版顶层（${max}层）` };
    const next = cur + 1;
    const realmTier = (typeof Chapters !== "undefined") ? Chapters.realmTier() : 0;
    // 境界门槛：剑系高层须筑基之后方可精进（剑芒三层即筑基初，再上须真元渐厚）
    if (realmTier < 1) return { ok: false, reason: "修为尚浅，须筑基之后方能参研更高层" };
    const months = 3 + next;                                   // 第4层7月 … 第9层12月，逐层递增
    const cultCost = Math.round(next * 200 * (1 + realmTier * 0.5));
    return { ok: true, techId, name: def.name, cur, next, max, months, cultCost };
  },
  refineLayer(techId) {
    const s = State.data;
    if (s.combat || s.pendingEvent) { this.toast("此刻分身乏术，难以静心参研", true); return; }
    const c = this.canRefineLayer(techId);
    if (!c.ok) { this.toast(c.reason, true); return; }
    if ((s.cultivation || 0) < c.cultCost) { this.toast(`修为积淀不足（需 ${c.cultCost}），尚不足以推进下一层`, true); return; }
    this.passTime(c.months);
    s.cultivation = Math.max(0, (s.cultivation || 0) - c.cultCost);
    s.spirit = clamp(s.spirit - 15, 0, State.realm().spMax);
    const r = Loadout.raiseLayer(s, c.techId);
    if (!r.ok) { this.toast(r.reason, true); State.save(); UI.renderAll(); return; }
    const newNames = (r.newSkills || []).map(id => (CombatAPI.SPELLS[id] || {}).name || id).filter(Boolean);
    if (newNames.length) {
      this.log(`【功法精进】${c.months}月闭关参研，《${c.name}》臻至第 ${r.layer} 层——新得战技：${newNames.join("、")}！可在「功法／技能」中装备。`, "good");
      this.addMilestone(`《${c.name}》进至第${r.layer}层，得「${newNames.join("、")}」`, "bigitem");
      if (typeof Sfx !== "undefined") Sfx.play("bell");
    } else {
      this.log(`【功法精进】${c.months}月闭关参研，《${c.name}》臻至第 ${r.layer} 层，根基更厚（同系法术威力随层渐涨）。`, "good");
      this.addMilestone(`《${c.name}》进至第${r.layer}层`, "minor");
    }
    this.checkLifespan(); State.save(); UI.renderAll();
  },
  // 当前可升层的主修功法（供 UI「参研功法层」入口判断）
  refinableMain() {
    const s = State.data;
    const c = this.canRefineLayer(s.technique);
    return c.ok ? c : null;
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
    // 长闭关分段执行：心境将告急时不再收功赶人（旧版=玩家反复重开菜单的死循环），
    // 而是「停功调息」——在静室里自己打坐几月再续闭。时间照扣、寿元照耗（代价不变），
    // 但决策只做一次：这才是"闭一次关"该有的样子。
    let remaining = Math.max(1, months);
    let done = 0;
    let restMonths = 0;                                // 途中停功调息的月数（额外耗时·如实报账）
    let totalGain = 0;
    let cutReason = "";                                // 中断原因（空=修满到期）
    let guard = 0;
    while (remaining > 0 && guard++ < 300) {
      // 心浮气躁：先停功调息到心境安稳再续（低心境硬修=六折效率+走火风险，不替玩家踩坑）
      let calmed = 0;
      while ((s.mood < s.moodMax * 0.45 || s.spirit < 20) && calmed < 4) {
        this.rest(true);
        restMonths++; calmed++;
        if (s.combat || s.pendingEvent) break;
      }
      if (s.combat || s.pendingEvent) { if (remaining > 0) cutReason = "静室生变"; break; }
      // 预估几个月后心境就会跌破警戒线
      const safeMonths = Math.max(1, Math.floor((s.mood - s.moodMax * 0.35) / 3));
      const step = Math.min(remaining, Math.max(1, safeMonths));
      totalGain += this.cultivate(step) || 0;
      done += step;
      remaining -= step;
      if (s.combat || s.pendingEvent) {                // 闭关插曲触发事件则中断
        if (remaining > 0) cutReason = "静室生变";
        break;
      }
    }
    // 闭关结算暂存：无论到期/中断，前台都给一条明白账（中断被事件演出接管时，事件完了再报）
    this._retreatSettle = { plan: months, done, rest: restMonths, gain: totalGain, reason: cutReason, remain: remaining, at: State.absMonth() };
    this.checkLifespan();
    this.checkStory();
    if (!s.pendingEvent && !s.combat && !this._pendingFortune) this._maybeInteraction();
    if (!s.pendingEvent && !s.combat) this.flushRetreatSettle();
    State.save();
    UI.renderAll();
  },

  // 闭关结算前台化：闭了几月、修为+多少、为何中止——主界面一条结算 toast + 见闻留档
  // 被事件/战斗接管时由 UI.renderActions 在空闲帧补报（不与演出抢屏）
  flushRetreatSettle() {
    const r = this._retreatSettle;
    if (!r) return;
    const s = State.data;
    if (s.pendingEvent || s.combat) return;            // 演出中不抢屏，等下一次渲染
    this._retreatSettle = null;
    const restNote = r.rest ? `（另停功调息 ${r.rest} 月）` : "";
    if (r.reason) {
      this.toast(`闭关中断（${r.reason}）：实修 ${r.done}/${r.plan} 月${restNote}，修为 +${r.gain}`, false);
    } else {
      this.toast(`闭关圆满：${r.done} 月${restNote}，修为 +${r.gain}`, false);
      this.log(`这一程闭关圆满收功：潜修 ${r.done} 月${restNote}，修为共精进 ${r.gain}。`, "sys");
    }
    // 中断且还差得多：留一个限时续闭快捷（renderActions 读取），玩家不必重开菜单再点两下
    if (r.reason && r.remain > 0) {
      this._retreatResume = { months: r.remain, until: State.absMonth() + 3 };
    }
  },

  // 把最近一条见闻闪成 toast（行动即时反馈）——剧情/战斗/奇遇接管时不弹（各自有演出）
  _flashLastLog() {
    try {
      const log = State.data && State.data.log;
      if (!log || !log.length) return;
      const e = log[log.length - 1];
      const tmp = (typeof document !== "undefined") ? document.createElement("div") : null;
      let txt = e.body || "";
      if (tmp) { tmp.innerHTML = txt; txt = (tmp.textContent || "").trim(); }
      txt = txt.replace(/\s+/g, " ");
      if (txt.length > 42) txt = txt.slice(0, 42) + "…";
      if (txt) this.toast(txt, e.kind === "bad");
    } catch (e) {}
  },
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
    s.fortuneCooldowns = s.fortuneCooldowns || {};   // id -> 可再触发的绝对月份（冷却中的际遇不入候选）
    const nowAbs = State.absMonth();
    // 候选：地点匹配、未触发过的 once、未在冷却、满足 cond
    const pool = FORTUNES.filter(f => {
      if (f.where && !f.where.includes(loc)) return false;
      if (f.once && s.firedFortunes.includes(f.id)) return false;
      if (f.cooldown && s.fortuneCooldowns[f.id] && nowAbs < s.fortuneCooldowns[f.id]) return false;
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
    if (f.cooldown) s.fortuneCooldowns[f.id] = nowAbs + f.cooldown;
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
    // 旅途/奇遇行动结果即时反馈：弹 toast 让玩家看清"这一手做了什么"（否则面板瞬间翻到下一月，搜寻/采药结果一闪而过）。
    // 仅当本次不会立刻进入战斗/后续事件面板时弹（那些自带演出，不需重复）。
    if (result.text && !this._fortuneFight && !this._pendingJourneyEvent) this.toast(result.text, result.kind === "bad");
    UI.closeModal();
    if (UI.closeSheet) UI.closeSheet(true);   // 旅途面板走锁定 sheet——选完强制收起
    // 奇遇选项可声明引发战斗（如硬闯野狼帮关卡）
    if (this._fortuneFight) {
      const enemy = this._fortuneFight;
      this._fortuneFight = null;
      State.save();
      this.startEncounterFight(enemy);
      return;
    }
    // 旅途行动触发了后续事件（赶路遇事）：弹出事件面板，选完后继续旅途
    if (this._pendingJourneyEvent) {
      const ev = this._pendingJourneyEvent;
      this._pendingJourneyEvent = null;
      this._pendingFortune = ev;
      State.save();
      UI.renderAll();
      UI.openFortune(ev);
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
    // 心魔递进消解：心魔越重，调息越要紧（阈值以上额外消减，防止死循环）
    const demonDrop = 8 + Math.max(0, Math.floor((s.demon - 30) / 10));
    s.demon = clamp(s.demon - demonDrop, 0, 100);
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
    if (s.cultivation < realm.culMax * 0.6) {
      const pct = Math.round(s.cultivation / realm.culMax * 100);
      const need = Math.ceil(realm.culMax * 0.6);
      return { ok: false, reason: `修为约 ${pct}%（须满盈逾六成，约 ${need} 点方可冲关）。再多苦修些时日。` };
    }
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
    // 连败保底：每5次连败，心战阈值+15（屡败屡战者终得道心通透）
    const pity = s.btPity || 0;
    const threshold = Balance.demonTrialThreshold() + Math.floor(pity / 5) * 15;
    const demonHigh = s.demon > threshold;
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
      ...((s.btPity || 0) > 0 ? [{ label: `屡败弥坚（连败${s.btPity}次）`, v: (s.btPity * 0.02) }] : []),
    ];
  },

  // 突破战结果结算（daoxinRatio：null=顺势水到渠成；0~1=心战收束时道心余裕）
  _resolveBreakthroughResult(win, daoxinRatio) {
    const s = State.data;
    const wasBig = this._btWasBig;
    if (win) {
      s.btPity = 0;   // 突破成功：重置连败保底
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
      s.btPity = (s.btPity || 0) + 1;   // 连败保底：每败一次，下次心战心魔更弱、道心更坚
      if (wasBig) {
        // 大境界渡劫失败：凶险——跌回上一层、重创、心魔暴涨
        const loss = Math.round(s.cultivation * 0.6) + Math.round(State.realm().culMax * 0.3);
        s.cultivation = Math.max(0, s.cultivation - loss);
        const dmg = Math.round(s.hpMax * 0.45);
        s.hp = clamp(s.hp - dmg, 1, s.hpMax);
        s.demon = clamp(s.demon + 25, 0, 100);
        if (typeof UI !== "undefined" && UI.breakthroughSetback) UI.breakthroughSetback({ big: true, loss, dmg, demonGain: 25, pity: s.btPity });
        s.mood = clamp(s.mood - 25, 0, s.moodMax);
        this.log(`心魔劫中道心崩动，灵力反噬如怒涛！渡劫失败——你修为大损(-${loss})、气血重创(-${dmg})，心魔几乎吞噬神智。大境界之关，岂容轻忽。`, "bad");
        this.toast("渡劫失败！反受重创", true);
      } else {
        const loss = Math.round(s.cultivation * 0.3);
        s.cultivation = Math.max(0, s.cultivation - loss);
        const dmg = 15 + Math.floor(Math.random() * 15);
        s.hp = clamp(s.hp - dmg, 1, s.hpMax);
        // 心魔增长递减：心魔已高时，失败带来的额外心魔冲击趋缓（你已见过最深的恐惧）
        const demonGain = Math.max(3, Math.round(12 * (1 - s.demon / 150)));
        s.demon = clamp(s.demon + demonGain, 0, 100);
        s.mood = clamp(s.mood - 15, 0, s.moodMax);
        this.log(`心魔未能降伏，灵力逆冲——突破失败！修为-${loss}，气血-${dmg}，心魔滋长。`, "bad");
        this.toast("突破失败，反受其害", true);
        if (typeof UI !== "undefined" && UI.breakthroughSetback) UI.breakthroughSetback({ big: false, loss, dmg, demonGain, pity: s.btPity });
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
    // 越阶催动：法器 minLayer > 玩家 layer → 灵力消耗倍增（gearMpMul），威能不折（杀手锏设计）
    const gearMpMul = {};
    const pLayer = realm.layer || 1;
    ["weapon", "armor", "accessory"].forEach(slot => {
      const g = State.gearOf(slot);
      if (g && g.grantSpells) {
        const mul = Balance.gearLayerMpMul(pLayer, g.minLayer);
        g.grantSpells.forEach(sk => {
          if ((s.benchTreasures || []).includes(sk)) return;
          if (!spells.includes(sk)) spells.push(sk);
          if (mul > 1) gearMpMul[sk] = mul;
        });
      }
    });
    // 噬金虫·四用法（初入星海篇·#5：复用神雷 chargeCost 共享池）——背包持噬金虫即四式入战
    // （外星海致富偶得后解锁；此前与神雷同理"演武先行·池未上膛"则四式不入手牌）
    if (State.count("shijinchong") > 0) {
      ["shijin_fu", "shijin_chao", "shijin_blade", "shijin_huashen"].forEach(sk => {
        if (!spells.includes(sk)) spells.push(sk);
      });
    }
    // 青竹蜂云剑·本命法宝（星海飞驰篇·S5 炼成后持有即入战）——本命飞剑 qingzhu_jian + 辟邪神雷二式
    // （雷遁 leidun 需御「风雷翅」方可施展·留外海风云篇；此处不注入）
    if (State.count("qingzhu_fengyun_jian") > 0) {
      ["qingzhu_jian", "shenlei_pi", "shenlei_fujian"].forEach(sk => {
        if (!spells.includes(sk)) spells.push(sk);
      });
    }
    // 越阶催动（跨大境界）：driveRealm > realmTier → 灵力消耗倍增（杀手锏设计）
    // 连续衰减：含小境界（初期/中期/后期/大圆满），大圆满接近达标→灵力倍率更低
    const pTier = Chapters.realmTier();
    const rLayer = realm.layer || 1;
    const SP = CombatAPI.SPELLS;
    spells.forEach(sk => {
      const sp = SP[sk];
      if (!sp || sp.source === "martial") return;
      const dr = sp.tier != null ? sp.tier : (sp.driveRealm || 0);
      if (dr <= pTier) return;
      const dMul = Balance.driveMpMul(pTier, dr, !!sp.chargeCost, rLayer);
      if (dMul > 1) gearMpMul[sk] = (gearMpMul[sk] || 1) * dMul;
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
      gearMpMul,   // 越阶催动灵力消耗倍率（spellId → multiplier）
      auxSkills: (typeof Loadout !== "undefined") ? Loadout.auxSkillSet(s) : [],
      technique: s.technique,     // 主修功法（影响同系招式）
      grade: (DATA.techniques[s.technique] || {}).grade || 1,  // 主修功法品阶
      realmTier: Chapters.realmTier(),   // 本章大境界序（影响法术成长）
      realmLayer: realm.layer || 1,    // 小境界层（初期1/中期2/后期3/大圆满4；越阶连续衰减用）
      // 功法层数轴（technique-tiers §5.4）：主修当前层的温和增益，只作用于主修当前层所授招式
      layerMul: (() => {
        const info = State.mainTechLayerInfo(s);
        return info ? Balance.layerMul(info.layer, info.max) : 1;
      })(),
      techSpells: (typeof Loadout !== "undefined") ? Loadout.mainScaledSpells(s) : [],
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
      // 特色资源池（神雷式·战斗内不回充·每战重置）：持噬金虫→四用法同抽一池"灵机"（满 6 分）
      charges: (() => {
        const ch = {};
        if (State.count("shijinchong") > 0) ch.shijinchong = { name: "噬金虫", cur: 6, max: 6 };
        if (State.count("qingzhu_fengyun_jian") > 0) ch.shenlei = { name: "辟邪神雷", cur: 9, max: 9 };
        return Object.keys(ch).length ? ch : null;
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
    // 远雷·百药园底子兑现（铁律3）：马师伯的栽培与园角的私账，都在这一炉里开花——点名出处
    if (this.settleLedger("ma_approval", "马师伯当年那句「倒不是个棒槌」、那本翻烂的《百草谱》、那排交你管的青元参苗——三年看园攒下的辨药火候，今日全熔进了这炉丹里。他对药草是真心，没看错你这双手")) {
      s.mood = clamp(s.mood + 3, 0, s.moodMax);
    }
    if (this.settleLedger("yaoyuan_overharvest", "园角自留地里偷种的那几批药苗，到底没白费——它们补足了这一炉的辅药亏空。马师伯当年睁只眼闭只眼那份默许，此刻也算有了回报")) {
      s.mood = clamp(s.mood + 2, 0, s.moodMax);
    }
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
             elem: u.elem || null, nature: u.nature || null, slays: u.slays || null, guard: u.guard || 0.3,
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
  // 手动选阵法相位（真·颠倒五行阵·手动模式）：玩家每回合选一个未用过的相位激活
  combatFieldPhase(idx) {
    const c = this._combat;
    if (!c || c.status !== "ongoing") return;
    const r = c.chooseFieldPhase(idx);
    if (!r.ok) { if (r.reason) this.toast(r.reason); return; }
    if (typeof UI !== "undefined" && UI.renderCombat) UI.renderCombat(c, this._combatMeta);
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
    const order = ["follow", "attack", "guard", "ultimate", "retreat"];
    const cur = order.indexOf(su.stance || "follow");
    c.setSideStance(order[(cur + 1) % 5], idx);   // 简令即阵型：换令同时换排（攻=压上战位/守=贴身僚位/撤=最深排）
    const txt = { follow: "随行——跟你的焦点打", attack: "强攻——压上战位排，下重手专补刀",
                  guard: "护主——贴身代刀，稳字当头",
                  ultimate: "憋大招——蓄灵攒最强招，灵力满后×1.5爆发，放完归位",
                  retreat: "后撤——退到阵后自保" }[su.stance];
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
    // v267：接敌距离收近（7→4·beast 同）——开局 gap=4（玩家 pos1·敌 pos5），
    //   射程≤4 的法术开局即可命中、近战一步即接战，砍掉"前2~3回合空走等敌走过来"的空转。
    //   战场仍可宽（身后/侧翼留白不变），只是把"敌人"摆到够得着的接战位。洞窟无缝继承不受影响。
    const engage = Math.min(sceneW - 2, (tmpl.engageDist || 4));
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
    if (enemy.introNote) this._combat._log(`【敌情】${enemy.introNote}`);
    UI.openCombat(this._combat, this._combatMeta);
  },

  /* -------- 登门切磋 = 真实斗法（战斗引擎 × 社交事件·乘法）--------
   * 世间修士不再是日志里的一行结算——按其练气层数现场生成战斗档案，摆开路数站到你对面。
   * 点到即止规则：败不重伤不长心魔（演武非仇杀）、对方残血自会抱拳认输（canFlee）；
   * 曲魂不上场（尸傀是不能见光的秘密，公开演武绝不能露）。 */
  _SPAR_STYLES: {
    jin: { n1: "金刃诀", n2: "金锋贯刺", n3: "金煞蓄势", intro: "使一手金行刀法，刃气凌厉、招招走直线" },
    mu:  { n1: "青木鞭影", n2: "木刺缠身", n3: "凝青蓄势", intro: "行木行功法，鞭影缠绵、后劲绵长" },
    shui:{ n1: "寒水箭", n2: "冰棱贯刺", n3: "凝霜蓄势", intro: "修水行道基，寒气渗人、打法阴柔" },
    huo: { n1: "流火弹", n2: "赤焰贯刺", n3: "聚炎蓄势", intro: "一身火行灵力，出手爆烈、越打越急" },
    tu:  { n1: "土遁石击", n2: "石锋贯刺", n3: "聚灵蓄势", intro: "土行功底扎实、皮糙肉厚，是耐磨的路数" },
  },
  // 按练气层数生成切磋对手（数值锚=encounter.bal makePlayer 同一把尺——公平的同道，不是怪物模板）
  _makeSparFoe(f) {
    const L = Math.max(1, Math.min(13, f.realm || 1));
    const elems = ["jin", "mu", "shui", "huo", "tu"];
    // 行属对人稳定（同一 NPC 每次切磋同路数——世界的一致感）：按 id 哈希定行属
    let h = 0; for (const ch of (f.id || f.name || "x")) h = (h * 31 + ch.charCodeAt(0)) % 997;
    const elem = elems[h % 5];
    const st = this._SPAR_STYLES[elem];
    // 成长曲线刻意缓于玩家（spar.bal 校准：玩家法术池到练气八层才换代，
    // 对手 dmg 若走 3/层，七层同层胜率会塌到 39%）——演武是社交内容，不是墙
    return {
      name: f.name, hp: 95 + (L - 1) * 12, mp: 40 + L * 6,
      sense: 4 + L * 2, speed: 10 + Math.floor(L / 3), agility: Math.round((9 + L) * 0.6),
      move: 1, qiLayer: L, elem, armor: elem === "tu" ? 2 : L >= 5 ? 1 : 0,
      tactics: L >= 5 ? "cunning" : undefined, nature: "human",
      introNote: `${f.name}${st.intro}。演武较技、点到即止——但拳脚无眼，把他当真对手打。`,
      attacks: [
        { name: st.n1, dmg: 14 + L * 2, kind: "normal", weight: 12, elem, mp: 5 + Math.floor(L / 2), range: [1, 3] },
        { name: st.n2, dmg: 10 + Math.round(L * 1.8), kind: "pierce", weight: 8, mp: 6, range: [1, 1] },
        { name: st.n3, dmg: 17 + Math.round(L * 2.8), kind: "charge", weight: 5, mp: 9 + Math.floor(L / 2), range: [1, 4] },
      ],
    };
  },
  startSparFight(inter) {
    const s = State.data;
    const f = (s.npcFates || []).find(x => x.id === inter.npcId) || { id: inter.npcId, name: inter.npcName, realm: 1 };
    const foe = this._makeSparFoe(f);
    this.passTime(1);   // 演武较技也是一桩正事（回合=月）
    this._nextFightType = "spar";
    const player = this.playerFighter();
    const myLayer = (State.realm() || {}).layer || 1;
    this._combat = new CombatAPI.Combat({
      player, enemies: [foe], maxRounds: 18, W: 11, lanes: 2, sides: [],   // 演武无侧位：曲魂是秘密
      enemyPos: 5,
    });
    this._combatMeta = {
      type: "spar", npcId: f.id, enemyName: f.name,
      canQuick: myLayer - (foe.qiLayer || 1) >= 2,
    };
    s.combat = true;
    this._combat.startRound();
    this.log(`你与「${f.name}」在场院里摆开架势——演武较技，点到即止。`, "event");
    this._combat._log(`【敌情】${foe.introNote}`);
    UI.openCombat(this._combat, this._combatMeta);
  },

  /* -------- 风云榜·夺名比斗（spar 管线 × fameBoard × npcFates 三乘）--------
   * 扬名赛道：向彩霞山一带的散修下战书、公开比斗——胜则名声入账、在石碑上步步攀高。
   * 藏拙的代价在此兑现：当众赢下的比斗做不得假，示人境界随之抬到对方层数（露一手=扬名时刻）。
   * 红线：只打背景修士（npcFates）；金光上人/王门主/厉飞雨等剧情人物命运忠于动漫，不入赛道。 */
  fameOfNpc(f) { return (f.realm || 1) * 8 + (f.apt > 1 ? 6 : 0); },
  startFameDuel(npcId) {
    const s = State.data;
    if (s.pendingEvent || s.combat) return;
    if (s.flags.arc1_complete) { this.toast("你早已远行——彩霞山的座次，与你无关了"); return; }
    const f = (s.npcFates || []).find(x => x.id === npcId);
    if (!f || f.status !== "alive") { this.toast("此人已不在江湖"); return; }
    const I = (typeof INTERACTIONS !== "undefined") ? INTERACTIONS : null;
    if (I && I.onCooldown(s, npcId)) { this.toast("本月已与其照过面——下月再去下战书"); return; }
    if (I) I.markInteract(s, npcId);
    const foe = this._makeSparFoe(f);
    this.passTime(1);
    this._nextFightType = "fame_duel";
    const player = this.playerFighter();
    const myLayer = (State.realm() || {}).layer || 1;
    this._combat = new CombatAPI.Combat({
      player, enemies: [foe], maxRounds: 18, W: 11, lanes: 2, sides: [],   // 公开比斗：曲魂更不能露
      enemyPos: 5,
    });
    this._combatMeta = {
      type: "fame_duel", npcId: f.id, enemyName: f.name, foeLayer: f.realm || 1,
      canQuick: myLayer - (foe.qiLayer || 1) >= 2,
    };
    s.combat = true;
    this._combat.startRound();
    this.log(`你向「${f.name}」下了战书。消息传开，看热闹的修士围了一圈——这一场，是当众的比斗，赢了名声入账，输了也当众。`, "event");
    this._combat._log(`【敌情】${foe.introNote}`);
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
      // 药庐子夜·密室夺舍＝贴身近战：窄场(W9·室内方寸) + 敌起手近距(pos5，距玩家4格)，
      //   一两回合即接战——不是旷野大战场，不该让玩家空点六回合「结束回合」等敌人走过来。
      W: 9, enemyPos: 5,
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
      // 「以药师身份从容近身」暗算＝贴身突袭：敌起手近距(pos5，距玩家4格)，毒/暗器一两回合即可招呼，
      //   不必空走六回合（叙事上韩立本就贴近了才动手，不是隔着旷野对峙）。
      enemyPos: 5,
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
    player.hp = s.hpMax; player.hpMax = s.hpMax;   // 复仇战满血上场（对齐决战；破"残血重进"死亡螺旋）
    // 兜底：连败 2 次以上削弱敌人，保证新手也能通过
    const losses = s.flags.losses_revenge || 0;
    const nerf = losses >= 2 ? 0.55 : 1;
    const mk = (name, hp, atk) => ({
      name, hp: Math.round(hp * nerf), sense: 4, speed: 8, agility: 3, move: 1, mp: 48, qiLayer: 2, elem: "tu", tactics: "cunning",
      attacks: [
        { name: "法器斩", dmg: Math.round(atk * nerf), kind: "normal", weight: 12, elem: "tu", mp: 6 },
        { name: "土遁刺", dmg: Math.round((atk - 3) * nerf), kind: "pierce", weight: 6, elem: "tu", mp: 7 },
      ],
    });
    this._combat = new CombatAPI.Combat({
      player,
      enemies: [mk("刀疤散修", 78, 13), mk("瘦高散修", 66, 11)],
      maxRounds: 18,
      // 林间伏击复仇＝近身遭遇（"二人当面…围了上来"）：W11 + 起手近距，开局即接战，
      //   不是旷野大战场（练气期无阵法/傀儡可布，不该空等数回合等散修走过来）。
      W: 11, enemyPos: 5,
    });
    this._combatMeta = { type: "revenge" };
    s.combat = true;
    this._combat.startRound();
    this._combat._log("三人中最年轻的那个看清你的眼神，掉头就跑——剩下两人狞笑着围了上来。");
    if (losses >= 2) this._combat._log("你深吸一口气——前几次交手已摸清了他们的路数，这回从容得多。");
    this.log("【复仇】杀万小山者，二人当面，一人遁走。先收眼前的账。", "bad");
    this.writeLedger("sanxiu_escaped", "杀万小山的第三名散修当场遁走");
    UI.openCombat(this._combat, this._combatMeta);
  },

  // 金鼓原巡逻遭遇战（增量F·魔道争锋第二幕）——魔修小队 pack 阵型练兵场：
  // 领队（pack leader）在世则喽啰随队形成网，先斩领队=群势立溃（combat.js 阵型崩溃 T3）。
  // 七派同袍武炫并肩入战（sides[] 练兵），为 Act4 皇宫三组对位群架预热。
  startPatrolFight() {
    const s = State.data;
    this._nextFightType = "patrol";
    const player = this.playerFighter();
    const leader = Object.assign({}, WORLD.enemies.moxiu_toumu, { formation: "pack", leader: true });
    const zu = () => Object.assign({}, WORLD.enemies.moxiu_zu, { formation: "pack" });
    this._combat = new CombatAPI.Combat({
      player,
      enemies: [leader, zu(), zu()],
      maxRounds: 20,
      // 七派同袍并肩：好勇斗狠的横练好手——前压抢攻、专挑喽啰收割（persona=人格即打法）
      side: { id: "wuxuan", name: "武炫", kind: "ally", art: "wuxuan",
              hp: 92, hpMax: 92, guard: 0.2, elem: "jin",
              persona: { aggr: 7, prot: 3, kite: 1 },
              moves: [
                { name: "横练拳", dmg: 14, weight: 12, range: [1, 1], line: "嗷一嗓子扑上去就是一套拳" },
                { name: "金刃斩", dmg: 18, weight: 6, elem: "jin", range: [1, 2], line: "抖手一道金刃斩向喽啰" },
              ] },
    });
    this._combatMeta = { type: "patrol" };
    s.combat = true;
    this._combat.startRound();
    this._combat._log("武炫往掌心啐了口唾沫，狞笑着抄起家伙：「韩兄护住中路——先斩那领队！」");
    this.log("金鼓原巡逻撞上一支魔修游猎小队。武炫与你并肩——这是你头一回正面会魔修的「群阵」：擒贼先擒王。", "event");
    UI.openCombat(this._combat, this._combatMeta);
  },

  // 皇宫决战开幕·三组对位群架（增量H·魔道争锋第四幕）——sides[] 复数化的首个内容关卡：
  // 韩立＋黄枫谷三同袍（刘靖/宋蒙/钟卫娘）同场，对阵黑煞教血侍×3。三个 side 各有打法
  // （刘靖前压斩魔、宋蒙重元珠护中、钟卫娘急性子游火），玩家可凭简令交叉支援。这是"人多势众
  // 撕开缺口杀进皇宫"的群架演出，不是单挑硬 boss——血侍数值刻意压低（见 world.xueshi_zu）。
  startSantuanFight() {
    const s = State.data;
    this._nextFightType = "santuan";
    const player = this.playerFighter();
    // 三血侍非克隆（palace-battle-fixme 问题A + 差异化设计）：
    //   甲魁梧斧奴=Ⅰ型铁壁（高甲高血·慢·须破甲/毒/灼烧穿透）
    //   乙枯瘦刺奴=Ⅱ型高闪（低血·极高闪避·须远程/必中/暴露debuff）
    //   丙精悍链奴=Ⅴ型远程（中血·远程链索·须追击/封锁移动）
    const base = WORLD.enemies.xueshi_zu;
    const xsA = Object.assign({}, base, {   // Ⅰ型·铁壁
      name: "血侍·甲魁梧斧奴", art: "xueshi_a", formation: "pack",
      hp: 180, hpMax: 180, armor: 8, agility: 6, move: 1, speed: 10,
      introNote: "魁梧如山的斧奴——血煞淬体、一身铜皮铁骨，寻常剑芒砍上去只留白印。甲厚血长但步履沉重：破甲手段（毒/灼烧/穿甲符宝）方能伤其根本。",
      attacks: [
        { name: "血煞重斧", dmg: 26, kind: "normal", weight: 12, elem: "huo", range: [1, 1], mp: 5 },
        { name: "裂地斩", dmg: 32, kind: "charge", weight: 7, range: [1, 1], mp: 10 },
      ],
    });
    const xsB = Object.assign({}, base, {   // Ⅱ型·高闪
      name: "血侍·乙枯瘦刺奴", art: "xueshi_b", formation: "pack",
      hp: 90, hpMax: 90, armor: 0, agility: 22, move: 3, speed: 20,
      introNote: "枯瘦如鬼的刺奴——身法鬼魅，剑芒刀光皆从他肋下穿过。近战几乎打不中：须用远程法术、必中技能、或先令其暴露破绽方能命中。",
      attacks: [
        { name: "血影刺", dmg: 16, kind: "pierce", weight: 12, range: [1, 2], mp: 4 },
        { name: "鬼步连刺", dmg: 14, kind: "normal", weight: 8, range: [1, 1], mp: 5, lunge: true, track: true },
      ],
    });
    const xsC = Object.assign({}, base, {   // Ⅴ型·远程
      name: "血侍·丙精悍链奴", art: "xueshi_c", formation: "pack",
      hp: 110, hpMax: 110, armor: 2, agility: 12, move: 2, speed: 14,
      introNote: "精悍狡猾的链奴——手持血链隔空抽人，近身就退。须追击封锁、或远程对射：让他一直放风筝，同袍的血线迟早被他磨穿。",
      attacks: [
        { name: "血链横扫", dmg: 18, kind: "normal", weight: 12, elem: "huo", range: [2, 4], mp: 5 },
        { name: "锁链绞杀", dmg: 22, kind: "pierce", weight: 7, range: [1, 3], mp: 7 },
        { name: "退步抽链", dmg: 14, kind: "normal", weight: 6, range: [2, 3], mp: 4, kite: true },
      ],
    });
    this._combat = new CombatAPI.Combat({
      player,
      enemies: [xsA, xsB, xsC],
      maxRounds: 24,
      // —— 30 格大战场·三战区声明式布局（palace-battle-fixme 问题B / teamfight-camera-design §3·§5）——
      //   报一张 fronts 表即得整片大战场：引擎据此自动落位 + 锁线（本区血侍杀意锁本区同袍）+
      //   默认开跨场驰援 + 暴露 _fronts 给镜头导演层。左·刘靖×甲(4) / 中·宋蒙×乙(15) / 右·钟卫娘×丙(26)，
      //   三战区间各留 ~9 格缓冲空地——韩立居中策应(13)，逐格移动补刀策应；W=30>13 触发宽轴巡游相机
      //   （队友行动时 turn 拍把镜头自然拖过去，衔接顺滑）。以后复杂团战只换这张 fronts 表即复用同款演出。
      W: 30, lanes: 2,
      playerPos: 13,
      fronts: [
        { ally: "side:0", enemies: [0], at: 4,  name: "左·刘靖" },
        { ally: "side:1", enemies: [1], at: 15, name: "中·宋蒙" },
        { ally: "side:2", enemies: [2], at: 26, name: "右·钟卫娘" },
      ],
      // 三同袍 side 同场（sides[] 复数化）：人格即打法——
      sides: [
        // 刘靖·除魔卫道之楷模：前压抢攻、剑光凌厉（凤凰符是后话，此战只显其正道剑修本色）
        { id: "liujing", name: "刘靖", kind: "ally", art: "liujing",
          hp: 138, hpMax: 138, guard: 0.28, elem: "jin",
          persona: { aggr: 8, prot: 4, kite: 1 },
          moves: [
            { name: "除魔剑光", dmg: 22, weight: 12, elem: "jin", range: [1, 2], line: "一道凌厉剑光当头斩落血侍" },
            { name: "浩然斩", dmg: 28, weight: 6, elem: "jin", range: [1, 1], line: "「魔道役尸，人人得而诛之！」长剑过处煞气崩散" },
          ] },
        // 宋蒙·持重元珠的稳重师兄：护中后压、远程砸珠，prot 高（替同袍挡刀）
        { id: "songmeng", name: "宋蒙", kind: "ally", art: "songmeng",
          hp: 150, hpMax: 150, guard: 0.38, elem: "tu",
          persona: { aggr: 4, prot: 8, kite: 2 },
          moves: [
            { name: "重元珠击", dmg: 20, weight: 12, elem: "tu", range: [1, 3], line: "一枚温润圆珠破空砸下，沉得砸碎血煞" },
            { name: "厚土镇压", dmg: 16, weight: 6, elem: "tu", range: [1, 2], line: "沉声一喝，土行真元如壁压向血侍" },
          ] },
        // 钟卫娘·心直口快的女修：急性子游火、抢攻收割，护短认死理
        { id: "zhongweiniang", name: "钟卫娘", kind: "ally", art: "zhongweiniang",
          hp: 108, hpMax: 108, guard: 0.18, elem: "huo",
          persona: { aggr: 8, prot: 2, kite: 3 },
          moves: [
            { name: "烈焰掌", dmg: 18, weight: 12, elem: "huo", range: [1, 2], line: "「都是些役尸的玩意儿！」一掌烈焰拍出" },
            { name: "火羽刺", dmg: 22, weight: 6, elem: "huo", range: [1, 3], line: "抖手一蓬火羽攒射" },
          ] },
      ],
    });
    this._combatMeta = Art.has("huanggong") ? { type: "santuan", sceneBg: "huanggong" } : { type: "santuan" };
    s.combat = true;
    this._combat.startRound();
    this._combat._log("刘靖长剑出鞘、剑指皇城深处：「左中右三处分头缠住血侍——韩师弟你居中策应，哪条线吃紧便驰援哪边！注意：斧奴皮糙肉厚须破甲、刺奴鬼魅难中须暴露、链奴隔空抽人须追击——各有所惧，对症下药！」");
    this.log("巍峨宫门轰然洞开、朱墙金瓦下血煞翻腾——三名血侍各扑一方：左厢刘靖缠住魁梧斧奴、中路宋蒙稳压枯瘦刺奴、右翼钟卫娘斗着精悍链奴，三条战线就此拉开。斧奴铜皮铁骨、刺奴鬼魅难中、链奴隔空放风筝——各有所长，须对症下药。你居中策应：哪条线告急，便提步赶过去补刀。", "event");
    UI.openCombat(this._combat, this._combatMeta);
  },

  // —— 皇宫决战·拖时布阵战（增量H下·survive 拖满回合机制首演）——
  // 几人不敌胥王假丹之威、且战且退：玩家+傀儡蜥蜴(+刘靖若在)死守，撑满 N 回合即胜——
  // 师兄妹（宋蒙/钟卫娘）此刻正叼旗布「真·颠倒五行阵」（场外·叙事）；拖到阵成便翻盘。
  // 差异化改造（§C 资源型）：场上散落3面阵旗，玩家须在6回合内移动+拾取阵旗——
  //   拾齐3面=阵提前布成（速胜）；6回合未拾齐但活着=拖到阵成（险胜）；死了=败。
  startTuoshiFight() {
    const s = State.data;
    this._nextFightType = "tuoshi";
    const player = this.playerFighter();
    player.hp = s.hpMax; player.hpMax = s.hpMax;   // 拖时之战满血上场（避免残血死螺）

    // 傀儡蜥蜴×2：师兄妹驱使的筑基傀儡，叼阵旗、护阵脚、替同袍挡刀（高 prot 顶前排吸火）
    const xiyi = (n) => ({ id: "xiyi" + n, name: "傀儡蜥蜴", kind: "ally", art: "kuilei",
      hp: 120, hpMax: 120, guard: 0.42, elem: "tu",
      persona: { aggr: 3, prot: 9, kite: 0 },
      moves: [
        { name: "甩尾横扫", dmg: 14, weight: 12, elem: "tu", range: [1, 1], line: "一条傀儡蜥蜴甩尾横扫，替同袍挡下黑血刀的余势" },
        { name: "叼旗镇位", dmg: 8, weight: 6, elem: "tu", range: [1, 2], line: "傀儡蜥蜴死死叼住阵旗、寸步不退，护住阵脚" },
      ] });
    const sides = [xiyi(1), xiyi(2)];
    // 刘靖若在（jingcheng_intel≥2 救下）则重伤并肩死守；身殛则不在场
    if (s.flags.liujing_survived) {
      sides.unshift({ id: "liujing", name: "刘靖", kind: "ally", art: "liujing",
        hp: 96, hpMax: 96, guard: 0.30, elem: "jin",
        persona: { aggr: 6, prot: 6, kite: 1 },
        moves: [
          { name: "强撑剑光", dmg: 18, weight: 12, elem: "jin", range: [1, 2], line: "刘靖按着伤口、剑光仍利：「韩师弟，撑住——阵就快成了！」" },
          { name: "护身剑幕", dmg: 10, weight: 6, elem: "jin", range: [1, 1], line: "刘靖横剑挡在你身前，替你卸下一记黑血刀" },
        ] });
    }

    // 拖时之敌：胥王假丹肉身（刻意拔高 hp/armor——硬拼必败，意在"拖到阵成"而非速杀）
    const boss = Object.assign({}, WORLD.enemies.xuwang_danshen, { hp: 600, hpMax: 600, armor: 7 });
    // 阵旗×3散落战场（资源型 survive）：玩家须移动到旗旁花一个主行动拾取——
    //   拾齐3面=阵提前布成（速胜）；拖满6回合活着=阵也成（险胜）。
    //   旗位散在战场各处（3/8/12），玩家须在躲避黑血刀的同时跑位拾旗——不能原地防御了事。
    const flags = [
      { id: "flag1", name: "阵旗·木", pos: 3, icon: "木" },
      { id: "flag2", name: "阵旗·火", pos: 8, icon: "火" },
      { id: "flag3", name: "阵旗·土", pos: 12, icon: "土" },
    ];
    this._combat = new CombatAPI.Combat({
      player,
      enemies: [boss],
      objective: { kind: "survive", rounds: 6,
        holdLog: (left) => `【拖时布阵】师兄妹与傀儡蜥蜴正催动「真·颠倒五行阵」——再撑 ${left} 回合，阵即可成！`,
        winLog: "「阵成了——！」最后一道阵旗插定，整座广场五行光华暴涨——总算拖到了这一刻！" },
      maxRounds: 6,
      W: 15, lanes: 2,
      sides,
      hotspots: flags,
    });
    this._combat._flagsTaken = 0;
    // 钩子：拾旗时计数，3面齐=速胜
    this._combat._afterTake = function(h) {
      this._flagsTaken++;
      this._log(`【阵旗】已得 ${this._flagsTaken}/3 面阵旗——${this._flagsTaken >= 3 ? "三旗齐至，阵法可成！" : "继续拾取！"}`);
      if (this._flagsTaken >= 3) {
        this.status = "win";
        this._log("「三旗齐——阵成！」你将最后一面阵旗猛然插定，五行光华暴涨——不必再拖了！");
      }
    };
    this._combatMeta = Art.has("huanggong") ? { type: "tuoshi", sceneBg: "huanggong" } : { type: "tuoshi" };
    s.combat = true;
    this._combat.startRound();
    this._combat._log("宋蒙、钟卫娘急退布阵：「拖住他！阵旗散落在场上——你跑过去拾起来，三旗齐至阵法即成！不拾也行，撑满六息工夫我们自己也布得完——但快一步是一步！」");
    this.log("胥王假丹之威如山压下，几人节节败退。三面阵旗散落在战场上——你须在躲避黑血刀的同时跑位拾旗：拾齐三面，阵法立成；拾不齐，撑满六息也行。总之，活着！", "event");
    UI.openCombat(this._combat, this._combatMeta);
  },

  // —— 皇宫决战·阵成决战（增量H下·真·颠倒五行阵 fieldCycle 逐回合压制 + 二阶段假丹 boss waves）——
  // 阵成后五行倒转逐回合反噬胥王（fieldCycle 六相·万象星河为 climax），玩家以金光砖符宝等底牌齐发；
  // 三符宝齐轰毁假丹肉身（phase1）→血凝五行丹借阵复生神魂（phase2 wave·脆）→战胜后真凰符剧情杀。
  // 师兄妹维系阵法（=fieldCycle，场外）；刘靖若在则并肩补刀。满血上场 + 确保金光砖符宝底牌在手。
  startXuwangFight() {
    const s = State.data;
    this._nextFightType = "xuwang_final";
    // 确保金光砖符宝底牌在手（体验"底牌天花板"）——阵成决战发一枚应急符宝充能
    if (State.count("jinguang_zhuan_charge") < 1) State.give("jinguang_zhuan_charge", 1);
    const player = this.playerFighter();
    player.hp = s.hpMax; player.hpMax = s.hpMax;   // 决战满血上场

    // 真·颠倒五行阵·六相（逐回合切换）：木缠足→火灼烧→金镜影→水心魔→土陷脚→万象星河(climax)。
    // suppress=占敌 hpMax 之比(穿甲·不可挡)；阵法只"反制+佐助"，多回合 suppress 不可独自速杀——
    // 留出底牌天花板与同袍补刀的空间（万象星河为收官重击，其余相位平缓）。
    const fieldCycle = [
      { name: "木·竹海缠足", log: "竹海自地涌生、缠住胥王手脚，黑血刀招式一滞。", suppress: 0.05, expose: true, player: { dodge: 0.05 } },
      { name: "火·焚天灼烧", log: "九天真火倒灌而下，他那身血煞赤焰反被克制焚烧。", suppress: 0.07 },
      { name: "金·镜影分身", log: "镜影分身错乱了他的杀招落点，破绽毕露。", suppress: 0.05, expose: true },
      { name: "水·渊薮心魔", log: "渊薮水气勾起他的心魔，神识一阵恍惚。", suppress: 0.05, player: { mp: 8 } },
      { name: "土·沙葬陷脚", log: "黄沙陷脚、厚土镇压，胥王步法尽废。", suppress: 0.06, expose: true, player: { shield: 12 } },
      { name: "万象星河·倒悬", log: "六行归一、万象星河倒悬——这是颠倒五行阵的极致一击！", suppress: 0.13, expose: true },
    ];

    const p1 = Object.assign({}, WORLD.enemies.xuwang_danshen);   // 假丹肉身（phase1）
    const p2 = Object.assign({}, WORLD.enemies.xuwang_shenhun);   // 血凝五行丹·复生神魂（phase2·脆）

    const sides = [];
    if (s.flags.liujing_survived) {
      sides.push({ id: "liujing", name: "刘靖", kind: "ally", art: "liujing",
        hp: 110, hpMax: 110, guard: 0.30, elem: "jin",
        persona: { aggr: 8, prot: 3, kite: 1 },
        moves: [
          { name: "除魔剑光", dmg: 22, weight: 12, elem: "jin", range: [1, 2], line: "刘靖剑光如练，趁阵法压制狠斩胥王" },
          { name: "浩然斩", dmg: 28, weight: 6, elem: "jin", range: [1, 1], line: "「魔道巨擘，今日伏诛！」刘靖一剑递出，浩然无前" },
        ] });
    }

    this._combat = new CombatAPI.Combat({
      player,
      enemies: [p1],
      waves: [[p2]],
      fieldCycle,
      fieldManual: true,       // 手动模式：玩家每回合选一个相位激活（每相位只能用一次）
      maxRounds: 16,
      W: 15, lanes: 2,
      sides,
    });
    this._combatMeta = Art.has("huanggong") ? { type: "xuwang_final", sceneBg: "huanggong" } : { type: "xuwang_final" };
    s.combat = true;
    this._combat.startRound();
    this._combat._log("「阵成——压！」师兄妹齐声厉喝，颠倒五行阵轰然运转，五行之力如山倒灌向胥王。机会只此一次：底牌齐发，趁阵法镇住他的工夫，将这魔道巨擘连肉身带神魂一并轰碎！");
    this.log("真·颠倒五行阵布成，五行倒转死死镇住胥王——轮到你了！金光砖、平天尺、重元珠、赤红剑……此刻不留底牌，更待何时？阵法逐回合反噬，底牌齐发，毕其功于一役！", "event");
    UI.openCombat(this._combat, this._combatMeta);
  },

  /* ===================== 再别天南篇（衔接过场大章）战斗编排 =====================
   * 复用既有机制（无新系统）：fieldCycle 颠倒五行阵图 / waves 二阶段 / sides[] 群战 / objective:survive 守阵。
   * 曲魂·身外化身（s.sideUnit·假丹境·黑煞教主血刃）随章首祭炼，全程并肩——本章核心底牌。
   * 考据见 docs/zaibie-tiannan-design.md。 */

  // 曲魂·身外化身随战（章首祭炼后 s.sideUnit 即此；越国矿洞落海前始终在场）
  _quhunSide() { return this.sideUnitFor("zaibie"); },

  // —— C1 金背妖螂·险战（fieldCycle 复用：韩立祭出随身「颠倒五行阵图」逐回合反制金背大妖）——
  startJinbeiFight() {
    const s = State.data;
    this._nextFightType = "zb_jinbei";
    const player = this.playerFighter();
    // 颠倒五行阵图（player-favorable·五相循环）：suppress=占敌 hpMax 之比（穿甲），平缓佐助、不独力速杀
    const fieldCycle = [
      { name: "木·竹海缠足", log: "你掷出颠倒五行阵图——竹海自地涌生，缠住妖螂六足，金鸣镰势一滞。", suppress: 0.05, expose: true, player: { dodge: 0.05 } },
      { name: "火·离焰灼甲", log: "阵中离火腾起，灼着那身金背硬甲，妖螂烦躁地振翅。", suppress: 0.06 },
      { name: "土·厚土镇足", log: "黄沙陷足、厚土镇压，妖螂步法一窒。", suppress: 0.05, player: { shield: 10 } },
      { name: "水·寒渊滞翅", log: "寒渊水气凝在翅上，金鸣裂空之势缓了三分。", suppress: 0.05, player: { mp: 6 } },
      { name: "金·镜影乱锋", log: "镜影分光错乱了它的扑击落点，破绽毕露。", suppress: 0.07, expose: true },
    ];
    const enemy = Object.assign({}, WORLD.enemies.jinbei_yaolang);
    const sides = []; const qu = this._quhunSide(); if (qu) sides.push(qu);
    this._combat = new CombatAPI.Combat({
      // v267：1v1 险战缩开局间距（玩家 pos3·敌 pos7·gap4）——颠倒五行阵图逐回合反制即刻生效，
      //   不空走（再别天南篇遗漏·补齐全篇接战距离一致）。
      player, enemies: [enemy], fieldCycle, maxRounds: 16, W: 11, lanes: 2, sides,
      playerPos: 3, enemyPos: 7,
    });
    this._combatMeta = { type: "zb_jinbei" };
    s.combat = true;
    this._combat.startRound();
    this._combat._log("「金克木，硬碰要吃亏——」你反手掷出颠倒五行阵图，五行光华铺地而开，逐相循环反制这头金背大妖。曲魂提着黑煞血刃，已抢上前去。");
    this.log("嘉元城外，御灵宗夺舍者驱使一头金背妖螂拦下了你。金克木、甲坚镰利——你祭出颠倒五行阵图逐回合反制，曲魂·身外化身当先迎战。这是你回到天南的第一场硬仗。", "event");
    UI.openCombat(this._combat, this._combatMeta);
  },

  // —— C2 御灵宗夺舍者·夺剑（waves 二阶段：夺舍体 → 结丹残念；胜得绿煌剑+奇虫榜玉简）——
  startDuosheFight() {
    const s = State.data;
    this._nextFightType = "zb_duoshe";
    const player = this.playerFighter();
    const p1 = Object.assign({}, WORLD.enemies.yuling_duoshe);
    const p2 = Object.assign({}, WORLD.enemies.yuling_zhenshen);
    const sides = []; const qu = this._quhunSide(); if (qu) sides.push(qu);
    this._combat = new CombatAPI.Combat({
      // v267：越阶恶战(1v1+waves)缩开局间距（玩家 pos3·敌 pos7·gap4）——夺剑硬撼即刻接战，不空走。
      player, enemies: [p1], waves: [[p2]], maxRounds: 18, W: 11, lanes: 2, sides,
      playerPos: 3, enemyPos: 7,
    });
    this._combatMeta = { type: "zb_duoshe" };
    s.combat = true;
    this._combat.startRound();
    this._combat._log("绿煌剑光大盛，那夺舍者厉声冷笑：「区区筑基，也敢觊觎本座的本命之器？」曲魂血刃横在你身前——假丹之躯，正面硬撼那柄结丹古剑。");
    this.log("御灵宗夺舍者执绿煌剑迎面而来。他神魂虽是结丹，强占的躯壳却催不全本命之力——这是一场势均的越阶恶战。打碎躯壳，他那缕结丹残念仍会负隅顽抗（二阶段）。胜，则绿煌剑归你。", "event");
    UI.openCombat(this._combat, this._combatMeta);
  },

  // —— C3 金鼓原大决战（sides[] 群战：李化元/南宫婉并肩 vs 黑煞教残众）——
  startJinguFight() {
    const s = State.data;
    this._nextFightType = "zb_jingu";
    const player = this.playerFighter();
    const leader = Object.assign({}, WORLD.enemies.moxiu_toumu, { formation: "pack", leader: true });
    const zu = () => Object.assign({}, WORLD.enemies.moxiu_zu, { formation: "pack" });
    const xs = () => Object.assign({}, WORLD.enemies.xueshi_zu, { formation: "pack" });
    const sides = []; const qu = this._quhunSide(); if (qu) sides.push(qu);
    // 李化元·黄枫谷大长老：老成持重、燃命护阵之楷模——前压镇魔、护中拉满（prot 高）
    sides.push({ id: "lihuayuan", name: "李化元", kind: "ally", art: "lihuayuan",
      hp: 150, hpMax: 150, guard: 0.4, elem: "tu",
      persona: { aggr: 5, prot: 8, kite: 1 },
      moves: [
        { name: "调令剑光", dmg: 22, weight: 12, elem: "jin", range: [1, 2], line: "李化元一道沉雄剑光斩落，魔气崩散：「黄枫谷的弟子，给我顶住！」" },
        { name: "厚土镇魔", dmg: 16, weight: 6, elem: "tu", range: [1, 2], line: "李化元沉喝一声，土行真元如壁压向魔修" },
      ] });
    sides.push(this._nangongwanAlly());
    this._combat = new CombatAPI.Combat({
      player, enemies: [leader, zu(), xs(), xs()], maxRounds: 24, W: 15, lanes: 2, sides,
    });
    this._combatMeta = { type: "zb_jingu" };
    s.combat = true;
    this._combat.startRound();
    this._combat._log("李化元白须猎猎、剑指魔阵：「韩立——先斩那领队，群势自溃！曲魂护住中路！」南宫婉广袖一扬，月华如练卷向魔修。");
    this.log("金鼓原决战，黑煞教倾巢而出、灵兽山倒戈反水，正道节节败退。你与李化元、南宫婉并肩冲杀——擒贼先擒王，先斩魔修领队，撕开一条血路。", "event");
    UI.openCombat(this._combat, this._combatMeta);
  },

  // —— C4 护山大阵·守阵（objective:survive·守点型：李化元钉桩阵眼，敌人若贴身则他额外受创）——
  startHushanFight() {
    const s = State.data;
    this._nextFightType = "zb_hushan";
    const player = this.playerFighter();
    player.hp = s.hpMax; player.hpMax = s.hpMax;   // 守阵满血上场（避免残血死螺）
    const xs = () => Object.assign({}, WORLD.enemies.xueshi_zu, { formation: "pack" });
    const sides = []; const qu = this._quhunSide(); if (qu) sides.push(qu);
    sides.push({ id: "lihuayuan", name: "李化元", kind: "ally", art: "lihuayuan",
      hp: 130, hpMax: 130, guard: 0.45, elem: "tu",
      persona: { aggr: 3, prot: 9, kite: 0 },
      moves: [
        { name: "燃命护阵", dmg: 14, weight: 12, elem: "tu", range: [1, 1], line: "李化元燃着本命真元死死撑住阵眼：「再撑一阵——护山大阵就要成了！」" },
        { name: "调令剑幕", dmg: 10, weight: 6, elem: "jin", range: [1, 2], line: "李化元横剑挡在阵前，替众人卸下一记魔刃" },
      ] });
    this._combat = new CombatAPI.Combat({
      player, enemies: [xs(), xs(), xs()],
      objective: { kind: "survive", rounds: 6,
        winLog: "「成了——护山大阵！」李化元燃尽最后一缕真元，整座山口腾起一道齐天光幕，魔潮被生生挡在阵外。" },
      maxRounds: 6, W: 15, lanes: 2, sides,
    });
    // 守点型钩子：李化元钉桩阵眼（pos=14），每回合若有敌人贴身则他额外受创——
    // 玩家须主动拦截、挡线，不能放任敌人涌到阵眼
    const lihuayuan = sides.find(sd => sd.id === "lihuayuan");
    this._combat._afterEnemyTick = function() {
      const li = this.sides.find(sd => sd.id === "lihuayuan");
      if (!li || li.hp <= 0) return;
      const adjacent = this.enemies.filter(e => e.alive && this.dist(e, li) <= 1);
      if (adjacent.length > 0) {
        const dmg = adjacent.length * 8;
        li.hp = Math.max(0, li.hp - dmg);
        this._log(`魔修突至阵眼，李化元分神抵挡、本命真元剧颤（-${dmg}）——挡住他们，别让任何人近阵心！`);
        if (li.hp <= 0) {
          this._log("李化元真元断绝、轰然倒地——阵眼失守！");
          this.status = "lose";
        }
      }
    };
    this._combatMeta = { type: "zb_hushan" };
    s.combat = true;
    this._combat.startRound();
    this._combat._log("李化元盘膝阵心、白须无风自动：「韩立、曲魂——给我守住阵脚六息！我以残命换这一道护山大阵，护黄枫谷弟子退走！」");
    this._combat._log("【守点】李化元钉桩阵眼不可移动——若有魔修突至他身旁，他本命真元将剧震受损。挡住每一波，别让敌人近阵心！");
    this.log("溃局已不可挽。李化元盘坐阵心，燃起本命真元强布「护山大阵」——你与曲魂死守阵脚。这一战不必胜，只须撑住：拖到阵成，黄枫谷的弟子便能退走。", "event");
    UI.openCombat(this._combat, this._combatMeta);
  },

  // —— C5 三人护道战（objective:survive·移动型：原地不动则追兵咬住后背受额外伤害）——
  startHudaoFight() {
    const s = State.data;
    this._nextFightType = "zb_hudao";
    const player = this.playerFighter();
    player.hp = s.hpMax; player.hpMax = s.hpMax;
    const leader = Object.assign({}, WORLD.enemies.moxiu_toumu, { formation: "pack", leader: true });
    const xs = () => Object.assign({}, WORLD.enemies.xueshi_zu, { formation: "pack" });
    const sides = []; const qu = this._quhunSide(); if (qu) sides.push(qu);
    sides.push(this._nangongwanAlly());
    sides.push({ id: "chenqiaoqian", name: "陈巧倩", kind: "ally", art: "chenqiaoqian",
      hp: 112, hpMax: 112, guard: 0.22, elem: "huo",
      persona: { aggr: 7, prot: 4, kite: 2 },
      moves: [
        { name: "赤红剑光", dmg: 22, weight: 12, elem: "huo", range: [1, 2], line: "陈巧倩赤红剑光裂空，将扑近的魔修逼退" },
        { name: "火羽攒射", dmg: 18, weight: 6, elem: "huo", range: [1, 3], line: "「韩师弟当心——」一蓬火羽朝缺口攒射而去" },
      ] });
    this._combat = new CombatAPI.Combat({
      player, enemies: [leader, xs(), xs()],
      objective: { kind: "survive", rounds: 6,
        winLog: "三人背靠背、寸土不让，终是撑过了这一波追杀——身后那条退路，护住了。" },
      maxRounds: 6, W: 15, lanes: 2, sides,
    });
    // 移动型钩子：玩家若本回合未移动则受额外伤害（追兵咬住后背）——
    // 逼玩家每回合换位，不能原地防御
    this._combat._lastPlayerPos = player.pos;
    this._combat._afterEnemyTick = function() {
      if (this.player.hp <= 0) return;
      if (this.player.pos === this._lastPlayerPos) {
        const dmg = 10;
        this.player.hp = Math.max(0, this.player.hp - dmg);
        this._log(`原地不动——追兵从身后一刀劈来（-${dmg}）！边打边退，不能站死！`);
        if (this.player.hp <= 0) {
          this.deathCause = { by: "追兵", move: "背后一刀" };
          this.status = "lose";
        }
      }
      this._lastPlayerPos = this.player.pos;
    };
    this._combatMeta = { type: "zb_hudao" };
    s.combat = true;
    this._combat.startRound();
    this._combat._log("南宫婉与陈巧倩一左一右护住你的两翼：「韩立，护住退路——撑住这一波！」曲魂血刃翻飞，替三人挡下扑近的魔修。");
    this._combat._log("【移动】追兵咬得极紧——每回合须移动换位，原地不动则背后挨刀！边打边退，撑过六息。");
    this.log("追兵咬得极紧。你与南宫婉、陈巧倩三人结阵护道，曲魂当先——撑住这一波追杀，护住身后那条退往矿洞的退路。", "event");
    UI.openCombat(this._combat, this._combatMeta);
  },

  // —— C6 矿洞拖时·启阵（objective:survive·保护型：辛如音修阵中不可阵亡，她死=失败）——
  startKuangdongFight() {
    const s = State.data;
    this._nextFightType = "zb_kuangdong";
    const player = this.playerFighter();
    player.hp = s.hpMax; player.hpMax = s.hpMax;
    const leader = Object.assign({}, WORLD.enemies.moxiu_toumu, { formation: "pack", leader: true });
    const xs = () => Object.assign({}, WORLD.enemies.xueshi_zu, { formation: "pack" });
    const sides = []; const qu = this._quhunSide(); if (qu) sides.push(qu);
    // 辛如音·耗尽精血修阵（低战·叼旗护阵脚，prot 拉满）——保护对象：她死=传送阵断=败
    sides.push({ id: "xinruyin", name: "辛如音", kind: "ally", art: "xinruyin",
      hp: 88, hpMax: 88, guard: 0.4, elem: "shui",
      persona: { aggr: 2, prot: 9, kite: 1 },
      moves: [
        { name: "凝血护阵", dmg: 10, weight: 12, elem: "shui", range: [1, 1], line: "辛如音咬破指尖，以精血催动残破阵纹：「韩道友再撑片刻——古阵就要启了！」" },
        { name: "水盾凝形", dmg: 6, weight: 6, elem: "shui", range: [1, 2], line: "辛如音凝起一面水盾，替你挡下扑近的魔刃" },
      ] });
    this._combat = new CombatAPI.Combat({
      player, enemies: [leader, xs(), xs()],
      objective: { kind: "survive", rounds: 6,
        winLog: "「阵启了——！」辛如音泣血一喝，古传送阵心爆起一道贯天光柱——大挪移令的契机，只在这一瞬。" },
      maxRounds: 6, W: 15, lanes: 2, sides,
    });
    // 保护型钩子：辛如音阵亡=传送阵断=败——
    // 敌人优先追击辛如音（她是最弱目标），玩家须挡线掩护
    this._combat._afterEnemyTick = function() {
      const xin = this.sides.find(sd => sd.id === "xinruyin");
      if (!xin) return;
      if (xin.hp <= 0) {
        this._log("辛如音精血耗尽、瘫倒阵心——古传送阵的光柱骤然黯灭！没了她，这阵启不了了。");
        this.status = "lose";
      }
    };
    // 敌人优先目标偏向辛如音（保护型核心：敌人追最弱目标）
    this._combat._enemyTargetBias = function(e) {
      const xin = this.sides.find(sd => sd.id === "xinruyin");
      if (!xin || xin.hp <= 0) return null;
      if (this.dist(e, xin) <= 3) return xin;   // 近距离时优先打辛如音
      return null;
    };
    this._combatMeta = { type: "zb_kuangdong" };
    s.combat = true;
    this._combat.startRound();
    this._combat._log("辛如音瘫坐阵心、指尖泣血，拼着最后一口精血补全那座万载古阵：「韩道友——拖住追兵六息！大挪移令一催，这古传送阵就能送你一步踏出天南！」");
    this._combat._log("【保护】辛如音是唯一能修古阵之人——她若阵亡，传送阵断，万劫不复。魔修正追击她——挡在他们面前，护住辛如音！");
    this.log("越国矿洞最深处，尘封的古传送阵幽光明灭。辛如音耗尽精血强行修阵，你与曲魂死守洞口——只须拖住追兵，待大挪移令催动古阵，便能离开天南。", "event");
    UI.openCombat(this._combat, this._combatMeta);
  },

  /* ===================== 初入星海篇·第一/二幕 战斗编排（增量5）=====================
   * 复用 fieldCycle / 单挑藏拙 / sides[]＋waves＋objective / survive 护送——零新增系统。
   * 越阶范式（A2·balance.js 不动）：韩立筑基后期巅峰；越级妖兽/假丹人修靠 fieldCycle 困势＋曲魂＋底牌咬。 */

  // —— 一①·落海·低阶海妖遭遇（fieldCycle 海域相位·曲魂并肩；致富妖丹 loot 抑制·留增量6）——
  startStarseaYaoshouFight() {
    const s = State.data;
    this._nextFightType = "ss_yaoshou";
    const player = this.playerFighter();
    // 海域相位（player-favorable·暗潮/寒流/暗礁/乱涡/浪沫五相）：suppress=占敌 hpMax 之比，平缓佐助
    const fieldCycle = [
      { name: "水·暗潮缚足", log: "一道暗潮自海底卷起，缠住那海妖的鳍足，扑势一滞。", suppress: 0.06, expose: true, player: { dodge: 0.05 } },
      { name: "水·寒流凝甲", log: "冰冷洋流漫过兽躯，海妖的动作迟缓了几分。", suppress: 0.05, player: { shield: 8 } },
      { name: "土·暗礁阻浪", log: "脚下暗礁劈开浪头，替你卸去一记冲撞。", suppress: 0.05, player: { mp: 6 } },
      { name: "水·回旋乱涡", log: "回旋的乱涡搅乱了海妖的扑击落点，破绽微露。", suppress: 0.07, expose: true },
      { name: "金·浪沫映芒", log: "碎浪映着你的剑芒，乱了海妖的视线。", suppress: 0.05, player: { dodge: 0.04 } },
    ];
    const enemy = Object.assign({}, WORLD.enemies.waihai_yaoshou, {
      canFlee: false,            // 落海绝境·此兽不可遁（活下去之战）
      reward: { lingshi: 2 },    // 抑制 xinghai_yaodan——致富妖丹线留增量6
      namedLoot: null,
    });
    const sides = []; const qu = this._quhunSide(); if (qu) sides.push(qu);
    this._combat = new CombatAPI.Combat({
      // v266：缩开局间距（玩家 pos3·敌 pos7·gap4＝近4格内）——落海绝境是"被扑求生"，
      //   张力来自海妖逼身、非前几回合空走；曲魂(pos4)并肩贴前。
      player, enemies: [enemy], fieldCycle, maxRounds: 14, W: 11, lanes: 2, sides,
      playerPos: 3, enemyPos: 7,
    });
    this._combatMeta = { type: "ss_yaoshou" };
    s.combat = true;
    this._combat.startRound();
    this._combat._log("「神识尚在，便不算绝路。」你强提滞涩的灵力，神识铺开锁定海妖命门，曲魂黑煞血刃已破水迎上。");
    this.log("乱星海近岛海域，一头低阶海妖循着气血味扑来。你落海修为暂虚、神识却利——借海域相位（暗潮/暗礁/乱涡）层层迟滞，与曲魂并肩斩兽求生。这是你在星海的第一战。", "event");
    UI.openCombat(this._combat, this._combatMeta);
  },

  // —— 一③·镇妖台擂台 1v1（藏拙叙事·筑基压炼气八层·假苦战险胜；公开擂台·不召曲魂）——
  startStarseaLeitaiFight() {
    const s = State.data;
    this._nextFightType = "ss_leitai";
    const player = this.playerFighter();
    // 对手＝鲸吞商行重金请的炼气八层打手（弱·筑基碾压；藏拙为纯叙事·不做硬性减益）
    const foe = {
      name: "鲸吞商行打手", hp: 96, sense: 11, speed: 13, agility: 11, move: 2, mp: 40, qiLayer: 8,
      elem: "jin", nature: "human", tactics: "feral", stubborn: false, canFlee: false, boss: false, armor: 1,
      introNote: "鲸吞商行重金请来的炼气八层打手，灵光外放、气势汹汹。他不知道台上这个看似炼气五层的散修，藏着怎样的真境。",
      attacks: [
        { name: "裂石拳", dmg: 14, kind: "normal", weight: 12, elem: "jin", range: [1, 1] },
        { name: "金光小盾", dmg: 9, kind: "normal", weight: 6, elem: "jin", range: [1, 2], mp: 5 },
        { name: "蛮力扑摔", dmg: 18, kind: "charge", weight: 5, aim: "cell", lunge: true, range: [1, 3], mp: 6, elem: "jin" },
      ],
      reward: { lingshi: 3 }, namedLoot: null,
    };
    this._combat = new CombatAPI.Combat({
      // v266：擂台藏拙纯演出战——缩开局间距（玩家 pos4·敌 pos7·gap3＝即可接战），
      //   砍掉"走两步才打到"的空转，让"假苦战"的演出立刻开场。
      player, enemies: [foe], maxRounds: 12, W: 11, lanes: 2, sides: [],
      playerPos: 4, enemyPos: 7,
    });
    this._combatMeta = { type: "ss_leitai" };
    s.combat = true;
    this._combat.startRound();
    this._combat._log("你刻意只引动炼气五层的灵力，把一身真元压在丹田里，与那汉子缠斗得险象环生——格挡踉跄、还击勉强，台下惊呼连连。");
    this.log("镇妖台擂台，替顾家一战。对手不过炼气八层，你却是藏了真境的筑基——要赢，更要赢得「狼狈」：露半分锋芒，便要招来不必要的觊觎。藏拙，藏拙。", "event");
    UI.openCombat(this._combat, this._combatMeta);
  },

  // —— 二③·镇妖大典·极限斩杀婴鲤兽（sides[冯三娘＋曲魂]＋waves[婴鲤兽→困兽暴走]＋fieldCycle 水罡＋越阶）——
  startStarseaYingliFight() {
    const s = State.data;
    this._nextFightType = "ss_yingli";
    const player = this.playerFighter();
    player.hp = s.hpMax; player.hpMax = s.hpMax;   // 越阶 boss·满血上阵（避免残血死螺）
    // 冯三娘困兽阵图·水罡相位（player-favorable·阵法困势）
    const fieldCycle = [
      { name: "阵·水牢锁鳞", log: "冯三娘阵旗一引，水牢自地涌生，锁住婴鲤兽赤鳞巨躯，扑势一滞。", suppress: 0.06, expose: true, player: { dodge: 0.05 } },
      { name: "阵·罡风裂甲", log: "六道罡风顺阵纹卷起，撕扯着那身赤鳞，巨兽烦躁翻涌。", suppress: 0.06 },
      { name: "阵·厚土镇浪", log: "厚土阵眼镇住狂涛，婴鲤兽的尾扫被生生压短。", suppress: 0.05, player: { shield: 10 } },
      { name: "阵·寒渊滞游", log: "寒渊水气凝住兽躯，越阶冲撞的势头缓了三分。", suppress: 0.05, player: { mp: 6 } },
      { name: "阵·镜分乱踪", log: "镜影分光错乱了它的扑击落点，命门破绽毕露——斩它，就趁此刻！", suppress: 0.07, expose: true },
    ];
    const ying = Object.assign({}, WORLD.enemies.yingli_beast);
    // 困兽暴走（waves 二阶段：水牢将合·巨兽负伤狂暴反扑，残血更凶，正是极限斩杀之机）
    const yingRage = Object.assign({}, WORLD.enemies.yingli_beast, {
      name: "婴鲤兽·困兽暴走", hp: 170, armor: 6,
      introNote: "水牢将合，婴鲤兽负伤狂暴，赤鳞倒竖、猩红双目尽是疯狂——这是它力竭前的最后反扑，也正是极限斩杀的一线之机！它已蓄起「绝命冲撞」——你只有一回合：要么抢在它爆发前斩落／打断（重击震断·定身符封死），要么挨这雷霆一撞。",
      attacks: [
        // —— 「绝命冲撞」蓄力杀招（v268·一致感修）：剧情许诺的"凶险越阶恶战"须数值兑现——
        //   kind:"charge" 蓄力一回合（破绽毕露·可被重击/定身打断），爆发约 ×2≈88 伤（玩家半血级威胁）。
        //   把"极限斩杀·一线之机"做成真决策：抢先秒/打断/定身/硬扛——不再是毫发无伤的表演。
        { name: "绝命冲撞", dmg: 44, kind: "charge", weight: 13, aim: "cell", lunge: true, track: true, range: [1, 5], elem: "shui", mp: 12 },
        { name: "狂暴撕咬", dmg: 30, kind: "pierce", weight: 9, range: [1, 1], elem: "shui", mp: 6 },
        { name: "绝命尾扫", dmg: 26, kind: "normal", weight: 7, aim: "zone", zoneSpan: 1, range: [1, 2], depth: "front", elem: "shui", mp: 7 },
      ],
      reward: {}, namedLoot: null,
    });
    const sides = []; const qu = this._quhunSide(); if (qu) sides.push(qu);
    // 冯三娘·六连殿阵法师·大典团战领队（友军侧·阵法困势·prot 偏高）
    // v266 参与感修：她的本分是「困兽递刀」不是「替你斩杀」——降其输出、强化困阵，
    //   把那一线极限斩杀的杀招留给玩家（治"高潮战友军自动磨死、玩家干看着"）。
    sides.push({ id: "feng_sanniang", name: "冯三娘", kind: "ally", art: "feng_sanniang",
      hp: 140, hpMax: 140, guard: 0.4, elem: "shui",
      persona: { aggr: 3, prot: 8, kite: 3 },
      moves: [
        { name: "困兽阵旗", dmg: 8, weight: 16, elem: "shui", range: [1, 3], line: "冯三娘阵旗翻飞，水罡困势又紧一分：「第六组听令——困住它，斩它的机会留给韩道友！」" },
        { name: "六合压阵", dmg: 10, weight: 5, elem: "jin", range: [1, 2], line: "冯三娘剑指如电，一道六合剑光逼住婴鲤兽的扑势，替你卡死它的退路" },
      ] });
    this._combat = new CombatAPI.Combat({
      // v266：W 15→11、显式贴近布阵（玩家 pos4·敌 pos7·gap3＝攻击射程内）——
      //   砍掉"前2~3回合空走"，玩家开战即可出手，把极限斩杀的参与感还给玩家。
      player, enemies: [ying], waves: [[yingRage]], fieldCycle, maxRounds: 24, W: 11, lanes: 2, sides,
      playerPos: 4, enemyPos: 7,
    });
    this._combatMeta = { type: "ss_yingli" };
    s.combat = true;
    this._combat.startRound();
    this._combat._log("「众修法阵难伤它分毫，唯有困而后杀。」你与曲魂隐于阵后按兵不动，只待冯三娘的水牢合拢、巨兽力竭的那一线之机。");
    if (!s.flags.logged_ss_yingli) {
      this.log("镇妖大典斗兽场，越级五阶婴鲤兽破水而出（幼体堪比六阶）。众修法阵不能伤、损失惨重——你与曲魂后发，借冯三娘的困兽阵图层层迟滞，待它困兽暴走、力竭露隙，便是极限斩杀、夺彩之时。", "event");
      s.flags.logged_ss_yingli = true;
    }
    UI.openCombat(this._combat, this._combatMeta);
  },

  // —— 二⑥·救小紫灵·斩逆星盟古长老脱身（objective:survive 护送逃脱型＋精英战·曲魂断后）——
  //    护送机制：紫灵须移动到撤离点（pos=0·海雾脱身路），每回合自动向撤离点移1步——
  //    但有敌近身2格内时她吓得不敢动。玩家须拦截追兵、清出安全距离，护她走到撤离点。
  //    胜利条件：紫灵抵达撤离点 OR 拖满6回合（曲魂斩长老·兜底）。
  startStarseaJiuzilingFight() {
    const s = State.data;
    this._nextFightType = "ss_jiuziling";
    const player = this.playerFighter();
    player.hp = s.hpMax; player.hpMax = s.hpMax;   // 护送满血上场
    const elder = Object.assign({}, WORLD.enemies.nixingmeng_guzhanglao);
    const hei = () => ({
      name: "逆星盟黑袍", hp: 72, sense: 12, speed: 14, agility: 12, move: 2, mp: 36,
      elem: "jin", nature: "human", tactics: "feral", stubborn: false, canFlee: false, armor: 1, formation: "pack",
      attacks: [
        { name: "星盟黑芒", dmg: 16, kind: "normal", weight: 12, elem: "jin", range: [1, 2], mp: 4 },
        { name: "贴身夺命", dmg: 20, kind: "charge", weight: 5, aim: "cell", lunge: true, range: [1, 3], mp: 6, elem: "jin" },
      ],
      reward: {}, namedLoot: null,
    });
    const sides = []; const qu = this._quhunSide(); if (qu) sides.push(qu);
    // 小紫灵·护送对象（VIP·不参战·移动由 _afterEnemyTick 接管）——hp 抬至 170 撑住护送（防被古长老+黑袍集火秒杀）
    sides.push({ id: "wang_ning", name: "小紫灵", kind: "ally", art: "wang_ning",
      hp: 170, hpMax: 170, guard: 0.25, elem: "shui",
      noAct: true, persona: { aggr: 0, prot: 0, kite: 0 }, moves: [],
    });
    this._combat = new CombatAPI.Combat({
      player, enemies: [elder, hei(), hei()],
      objective: { kind: "survive", rounds: 6,
        winLog: "曲魂血刃自侧翼洞穿古长老命门，你一剑封喉——黑袍人影颓然坠地。你抄起惊魂未定的小紫灵，趁乱杀出重围、遁入海雾。斩古长老·携紫灵脱身！" },
      maxRounds: 6, W: 15, lanes: 2, sides,
    });
    // 撤离点 = pos=0（左端·海雾脱身路）
    this._combat.escapePos = 0;
    // 护送钩子：紫灵自动向撤离点移动，近身有敌则吓得不敢动
    this._combat._afterEnemyTick = function() {
      const zl = this.sides.find(sd => sd.id === "wang_ning");
      if (!zl) return;
      if (zl.hp <= 0) {
        this._log("小紫灵气绝倒地——你没能护住她！妙音门掌门临终的托付，碎了。");
        this.status = "lose";
        return;
      }
      if (zl.pos <= 0) {
        this._log("小紫灵跌跌撞撞扑进海雾深处——成了！你断后挡住追兵，她脱身了！");
        this.status = "win";
        this._log(this.objective.winLog || "");
        return;
      }
      const threat = this.enemies.find(e => e.alive && this.dist(e, zl) <= 2);
      if (threat) {
        this._log(`小紫灵被${threat.name}的杀气吓得腿软——不敢迈步！清开近身的追兵，她才能继续跑！`);
        return;
      }
      const oldPos = zl.pos;
      zl.pos = Math.max(0, zl.pos - 1);
      if (zl.pos !== oldPos) {
        const left = zl.pos;
        this._log(`小紫灵趁空隙向海雾挪了一步（距撤离点还差${left}步）——护住她，别让追兵近身！`);
        this._emitFx(this._refOf(zl), "move", null);
      }
    };
    // 敌人优先追击紫灵（护送核心：追兵冲着她来）
    this._combat._enemyTargetBias = function(e) {
      const zl = this.sides.find(sd => sd.id === "wang_ning");
      if (!zl || zl.hp <= 0) return null;
      if (this.dist(e, zl) <= 2) return zl;   // 仅贴近(≤2格)的追兵扑紫灵——给玩家挡线/清场空间
      return null;
    };
    this._combatMeta = { type: "ss_jiuziling" };
    s.combat = true;
    this._combat.startRound();
    this._combat._log("你将小紫灵护在身后，曲魂黑影横刀断后。古长老血遁追命、黑袍杂兵合围——");
    this._combat._log("【护送】小紫灵须走到左端撤离点（蓝光标记）——每回合自动向撤离点移1步，但有敌近身2格内则吓得不敢动。清开追兵、护她到撤离点，或拖满6回合由曲魂斩长老兜底！");
    this.log("大典惊变·妙音门门主夫妇殉难。你接住坠落的小紫灵，逆星盟古长老挟假丹之威拦杀，黑袍杂兵合围。护住她、清开追兵、护她到撤离点——杀出这场惊变。", "event");
    UI.openCombat(this._combat, this._combatMeta);
  },

  // —— 三②·外星海·霓裳草引妖·噬金虫群猎杀（致富妖丹线·噬金虫四用法实战＋fieldCycle 妖氛相位＋waves 群猎＋曲魂）——
  startStarseaWaihaiFight() {
    const s = State.data;
    this._nextFightType = "ss_waihai";
    const player = this.playerFighter();   // 背包持噬金虫→四用法（附体/出战/变武器/变身外化身）共池入战
    // 外海妖氛相位（player-favorable·霓裳草香气惑妖·妖氛潮汐露隙）
    const fieldCycle = [
      { name: "妖氛·霓裳惑神", log: "霓裳草的异香在妖氛里漫开，那妖兽迷了一瞬神智，扑势一滞。", suppress: 0.06, expose: true, player: { dodge: 0.05 } },
      { name: "妖氛·暗潮裹身", log: "外海暗潮裹住兽躯，迟滞了它的腾挪。", suppress: 0.05, player: { shield: 8 } },
      { name: "妖氛·潮信乱涌", log: "潮信乱涌搅乱妖兽落点，破绽微露。", suppress: 0.06, expose: true },
      { name: "妖氛·咸雾蚀目", log: "咸涩海雾迷住妖兽双目，攻势偏了几分。", suppress: 0.05, player: { mp: 6 } },
    ];
    // 中阶海妖（霓裳草引出·噬金虫群缠困不令遁走，剖丹取财）
    const yao = Object.assign({}, WORLD.enemies.waihai_yaoshou, {
      canFlee: false,            // 霓裳草引妖·噬金虫群缠身，困而后杀（不令带丹遁走）
      reward: { lingshi: 2 }, namedLoot: null,
    });
    // 群猎二阶段（waves：血腥引来第二头同阶海妖，正是积妖丹的进项）
    const yao2 = Object.assign({}, WORLD.enemies.waihai_yaoshou, {
      name: "外星海妖兽·闻血而来", hp: 210, armor: 4, canFlee: false,
      introNote: "血腥气漫开，又一头中阶海妖循味扑来——霓裳草引妖、噬金虫群缠，正是连斩积丹的好时候。",
      reward: { lingshi: 2 }, namedLoot: null,
    });
    const sides = []; const qu = this._quhunSide(); if (qu) sides.push(qu);
    this._combat = new CombatAPI.Combat({
      // v266：外海致富猎杀战——缩开局间距（玩家 pos3·敌 pos7·gap4），引妖即战、
      //   噬金虫四用法立刻上桌，不空走（致富战节奏要爽快）。
      player, enemies: [yao], waves: [[yao2]], fieldCycle, maxRounds: 20, W: 11, lanes: 2, sides,
      playerPos: 3, enemyPos: 7,
    });
    this._combatMeta = { type: "ss_waihai" };
    s.combat = true;
    this._combat.startRound();
    this._combat._log("你将霓裳草悬于礁石引妖，掌心噬金虫蠢蠢欲动——附体结甲、放群出战、化刃破甲、化身全力一击，四式同抽一池灵机，打一分少一分。妖兽循香扑来，曲魂黑刃已迎上。");
    this.log("外星海猎场，霓裳草引妖、噬金虫群缠。海妖循香而来——以噬金虫四用法（附体/出战/变武器/变身外化身·共池取舍）困而后杀，剖取妖丹。这是星海的硬通货，发家致富，自此开始。", "event");
    UI.openCombat(this._combat, this._combatMeta);
  },

  /* ============================================================
   * 星海飞驰篇 · S2「蝎岛之战」三战（设计 docs/xinghaifeichi-design.md §十·10.2）
   *   敌人内联装配（仿 showdown/jiuziling 先例·不污染 WORLD.enemies）。
   *   数值锚定 §八结丹标度：越级大妖 hp520·假丹人修 hp380·寻常妖兽 hp200。
   * ============================================================ */

  // —— 2-A·蝎岛团战（妙音门 vs 隐煞门·紫灵/妙音门客卿×2/曲魂并肩·群战）——
  startXhXiedaoFight() {
    const s = State.data;
    this._nextFightType = "xh_xiedao";
    const player = this.playerFighter();
    player.hp = s.hpMax; player.hpMax = s.hpMax;   // 团战满血上场
    // 隐煞门弟子·结丹初期 pack 喽啰（人修·金/阴煞·阵型成网）
    const dizi = () => ({
      name: "隐煞门弟子", hp: 160, sense: 13, speed: 15, agility: 12, move: 2, mp: 50,
      elem: "jin", nature: "human", tactics: "feral", stubborn: false, canFlee: false, armor: 2, formation: "pack",
      attacks: [
        { name: "隐煞刀光", dmg: 20, kind: "normal", weight: 12, elem: "jin", range: [1, 2], mp: 4 },
        { name: "贴身阴斩", dmg: 26, kind: "charge", weight: 5, aim: "cell", lunge: true, range: [1, 3], mp: 6, elem: "jin" },
      ],
      reward: {}, namedLoot: null,
    });
    const sides = []; const qu = this._quhunSide(); if (qu) sides.push(qu);
    // 紫灵·妙音门少主（友军侧·音攻·结丹·调度有方）
    sides.push({ id: "zi_ling", name: "紫灵", kind: "ally", art: "zi_ling",
      hp: 150, hpMax: 150, guard: 0.4, elem: "shui",
      persona: { aggr: 5, prot: 5, kite: 4 },
      moves: [
        { name: "妙音裂魂", dmg: 16, weight: 14, elem: "jin", range: [1, 4], line: "紫灵素手抚弦，一缕妙音裂空而至：「韩大哥只管放手，这些杂鱼交给妙音门！」" },
        { name: "清音定神", dmg: 6, weight: 5, elem: "shui", range: [1, 3], line: "紫灵一声清越长音荡开，替你卸去缠身的隐煞之气" },
      ] });
    // 妙音门客卿×2（正面牵制·结丹·prot 偏高）
    const keqing = (nm) => ({ id: "miaoyin_keqing_" + nm, name: "妙音门客卿·" + nm, kind: "ally", art: null,
      hp: 130, hpMax: 130, guard: 0.45, elem: "shui",
      persona: { aggr: 6, prot: 4, kite: 2 },
      moves: [
        { name: "音波荡", dmg: 14, weight: 14, elem: "shui", range: [1, 3], line: "妙音门客卿一道音波层层荡开，逼住隐煞门的攻势" },
      ] });
    sides.push(keqing("甲")); sides.push(keqing("乙"));
    this._combat = new CombatAPI.Combat({
      player, enemies: [dizi(), dizi(), dizi()],
      maxRounds: 22, W: 15, lanes: 3, sides,
      playerPos: 4, enemyPos: 8,
    });
    this._combatMeta = { type: "xh_xiedao" };
    s.combat = true;
    this._combat.startRound();
    this._combat._log("妙音门两位客卿正面牵制，紫灵居中调度，你与曲魂自侧翼突入——隐煞门弟子结阵迎来。乱军中，赵峥的身影一闪，竟趁隙往后退去……");
    this.log("蝎岛之战开打——妙音门强攻隐煞门据点，你随紫灵一侧突入。清开隐煞门弟子的阵列！（留意那个'撤退'的赵峥——此战另有玄机）", "event");
    UI.openCombat(this._combat, this._combatMeta);
  },

  // —— 2-C·击杀赵峥（被紫灵暗算削弱·护体寸裂·结丹中期→初期·必胜恶战）——
  startXhZhaozhengFight() {
    const s = State.data;
    this._nextFightType = "xh_zhaozheng";
    const player = this.playerFighter();
    player.hp = s.hpMax; player.hpMax = s.hpMax;
    // 赵峥：结丹中期·被暗算削弱（真元逆乱·护体法宝寸裂）→ hp/armor 大降·困兽犹斗
    const zhao = {
      name: "赵峥", hp: 240, sense: 15, speed: 14, agility: 9, move: 1, mp: 60, qiLayer: 18,
      elem: "jin", nature: "human", tactics: "guarded", stubborn: true, canFlee: false, armor: 1, boss: true,
      introNote: "赵峥被紫灵暗算，护体法宝已裂、真元逆乱——这身结丹中期的修为只剩个空架子。但困兽犹斗、阴招狠辣，仍不可大意。",
      attacks: [
        { name: "逆乱掌风", dmg: 22, kind: "normal", weight: 12, elem: "jin", range: [1, 2], mp: 5 },
        { name: "拼死阴斩", dmg: 30, kind: "charge", weight: 6, aim: "cell", lunge: true, range: [1, 3], mp: 8, elem: "jin" },
      ],
      reward: { lingshi: 16 }, namedLoot: null,
    };
    const sides = []; const qu = this._quhunSide(); if (qu) sides.push(qu);
    this._combat = new CombatAPI.Combat({
      player, enemies: [zhao], maxRounds: 18, W: 11, lanes: 2, sides,
      playerPos: 4, enemyPos: 7,
    });
    this._combatMeta = { type: "xh_zhaozheng" };
    s.combat = true;
    this._combat.startRound();
    this.log("赵峥护体法宝寸裂、真元逆乱——紫灵的局已成。困兽犹斗，了结这个勾结极阴岛的叛徒！", "event");
    UI.openCombat(this._combat, this._combatMeta);
  },

  // —— 2-E·逃亡·天都炼傀追杀（objective:survive 6回合·白玉蜘蛛吐丝掩护·撑到海底遁避）——
  startXhTaowangFight() {
    const s = State.data;
    this._nextFightType = "xh_taowang";
    const player = this.playerFighter();
    player.hp = s.hpMax; player.hpMax = s.hpMax;   // 逃亡满血上场（避免残血死螺）
    const solo = !!s.flags.xh_zuoling_solo;   // 独走分支：未除赵峥→追兵更凶（+1 喽啰）
    // 天都炼傀·结丹中期·追击型傀儡（construct/百毒不侵·track 招式一步躲不开）
    const liankui = {
      name: "天都炼傀", hp: 460, sense: 16, speed: 18, agility: 13, move: 3, mp: 90, qiLayer: 18,
      elem: "jin", nature: "corpse", tactics: "feral", stubborn: true, canFlee: false, armor: 6, boss: true,
      introNote: "天都炼傀乃结丹中期的追击傀儡——尸傀死物、百毒不侵，「循气追命」一步躲不开。它非要不可，硬拼无益；撑到白玉蜘蛛吐丝掩护，遁入海底即脱身。",
      attacks: [
        { name: "循气追命", dmg: 34, kind: "charge", weight: 12, aim: "cell", lunge: true, track: true, range: [1, 5], mp: 10, elem: "jin" },
        { name: "傀儡铁臂", dmg: 26, kind: "normal", weight: 9, range: [1, 1], elem: "jin" },
        { name: "锁魂钢索", dmg: 22, kind: "pierce", weight: 7, range: [1, 3], elem: "jin", mp: 6 },
      ],
      reward: {}, namedLoot: null,
    };
    const enemies = [liankui];
    if (solo) enemies.push({
      name: "隐煞门追兵", hp: 160, sense: 13, speed: 15, agility: 12, move: 2, mp: 50,
      elem: "jin", nature: "human", tactics: "feral", canFlee: false, armor: 2, formation: "pack",
      attacks: [{ name: "隐煞刀光", dmg: 20, kind: "normal", weight: 12, elem: "jin", range: [1, 2], mp: 4 }],
      reward: {}, namedLoot: null,
    });
    const sides = []; const qu = this._quhunSide(); if (qu) sides.push(qu);
    // 白玉蜘蛛·掩护脱身（beast 侧·吐丝迟滞·低战·prot 拉满）
    sides.push({ id: "baiyu_zhizhu_aid", name: "白玉蜘蛛", kind: "beast", art: null,
      hp: 90, hpMax: 90, guard: 0.5, elem: "tu",
      persona: { aggr: 2, prot: 8, kite: 5 },
      moves: [
        { name: "缚仙蛛丝", dmg: 6, weight: 16, elem: "tu", range: [1, 4], line: "白玉蜘蛛吐出漫天银丝，将天都炼傀的追势死死迟滞——「快走！这边我挡着！」" },
      ] });
    this._combat = new CombatAPI.Combat({
      player, enemies,
      objective: { kind: "survive", rounds: 6,
        winLog: "白玉蜘蛛漫天蛛丝迟滞了追兵那一瞬——你趁隙遁入海底暗流，天都炼傀的循气追命被蛛丝缠在身后。脱身了！" },
      maxRounds: 6, W: 15, lanes: 2, sides,
      playerPos: 4, enemyPos: 8,
    });
    this._combatMeta = { type: "xh_taowang" };
    s.combat = true;
    this._combat.startRound();
    this._combat._log("【逃亡】天都炼傀循气追命、一步躲不开——硬拼无益。撑过 6 回合，白玉蜘蛛吐丝掩护，你便能遁入海底脱身！");
    this.log(`天都炼傀结丹中期、专修追击之术，杀赵峥后循气追来。${solo ? "你未除赵峥，他竟联了隐煞门追兵一道压来——" : ""}硬拼无益，撑到白玉蜘蛛吐丝掩护、遁入海底即可。`, "bad");
    UI.openCombat(this._combat, this._combatMeta);
  },

  // —— S6·古修士洞府练手（金青邀约·石蝶法修+老胡甲坚·结丹遭遇·组队则金青侧助）——
  //    韩立此时已炼成青竹蜂云剑（playerFighter 自动注入）——这是本命法宝的首场实战练手。
  startXhGuxiushiFight() {
    const s = State.data;
    this._nextFightType = "xh_guxiushi";
    const player = this.playerFighter();
    player.hp = s.hpMax; player.hpMax = s.hpMax;
    // 石蝶·法修型（远程法术·脆皮高输出）
    const shidie = {
      name: "石蝶", hp: 185, sense: 17, speed: 16, agility: 13, move: 2, mp: 90, qiLayer: 17,
      elem: "jin", nature: "human", tactics: "kite", canFlee: false, armor: 2, boss: true,
      introNote: "石蝶修的是远程法修一路，灵光锋锐、走位刁钻——放任她拉开距离便要吃苦头，须贴身逼杀。",
      attacks: [
        { name: "锋芒灵光", dmg: 20, kind: "normal", weight: 12, elem: "jin", range: [1, 5], mp: 6 },
        { name: "破空锥", dmg: 26, kind: "pierce", weight: 7, range: [1, 4], elem: "jin", mp: 8 },
      ],
      reward: { lingshi: 12 }, namedLoot: null,
    };
    // 老胡·甲坚型（高护甲·硬碰硬）
    const laohu = {
      name: "老胡", hp: 220, sense: 13, speed: 12, agility: 8, move: 1, mp: 70, qiLayer: 17,
      elem: "tu", nature: "human", tactics: "guarded", canFlee: false, armor: 3, boss: true,
      introNote: "老胡一身横练护体、甲坚如铁——寻常法术挠不动他，须以破甲/重击或辟邪神雷破其防。",
      attacks: [
        { name: "厚土撞", dmg: 22, kind: "normal", weight: 12, elem: "tu", range: [1, 1] },
        { name: "崩山压顶", dmg: 28, kind: "charge", weight: 6, aim: "cell", lunge: true, range: [1, 3], mp: 8, elem: "tu" },
      ],
      reward: { lingshi: 12 }, namedLoot: null,
    };
    const sides = []; const qu = this._quhunSide(); if (qu) sides.push(qu);
    // 组队径：金青为结丹辅助侧位（独行径则无援·但叙事多一分凶险）
    if (s.flags.xh_guxiushi_team) {
      sides.push({ id: "jin_qing", name: "金青", kind: "ally", art: null,
        hp: 130, hpMax: 130, guard: 0.35, elem: "jin",
        persona: { aggr: 5, prot: 3, kite: 4 },
        moves: [
          { name: "青锋符光", dmg: 14, weight: 14, elem: "jin", range: [1, 4], line: "金青打出一道青锋符光：「韩道友，这两个交给咱俩了！」" },
        ] });
    }
    this._combat = new CombatAPI.Combat({
      player, enemies: [shidie, laohu], maxRounds: 22, W: 15, lanes: 3, sides,
      playerPos: 4, enemyPos: 9,
    });
    this._combatMeta = { type: "xh_guxiushi" };
    s.combat = true;
    this._combat.startRound();
    this._combat._log("古修士洞府机关重重，石蝶老胡守在宝室之前。你心念一引，七十二口青竹蜂云剑应念出鞘——本命法宝的第一战，便在此地。");
    this.log("古修士洞府练手——石蝶远程刁钻、老胡甲坚难破。试试新成的青竹蜂云剑与辟邪神雷之威！", "event");
    UI.openCombat(this._combat, this._combatMeta);
  },

  // —— S7·虚天殿第一关·鬼冤之地（鬼王+阴灵兽·邪魔·辟邪神雷克鬼首秀 ×1.8）——
  //    nature:"demon"（非 ghost）——既吃 shenlei slays.demon×1.8，又不触发 soulOnly 锁（辟邪神雷正面可伤）。
  startXhGuiyuanFight() {
    const s = State.data;
    this._nextFightType = "xh_guiyuan";
    const player = this.playerFighter();
    player.hp = s.hpMax; player.hpMax = s.hpMax;
    const yinling = () => ({
      name: "阴灵兽", hp: 170, sense: 14, speed: 15, agility: 12, move: 2, mp: 50,
      elem: "shui", nature: "demon", tactics: "feral", canFlee: false, armor: 2, formation: "pack",
      attacks: [
        { name: "阴煞扑噬", dmg: 22, kind: "normal", weight: 12, elem: "shui", range: [1, 1] },
        { name: "怨煞冲", dmg: 26, kind: "charge", weight: 5, aim: "cell", lunge: true, range: [1, 3], mp: 5, elem: "shui" },
      ],
      reward: {}, namedLoot: null,
    });
    const guiwang = {
      name: "鬼王", hp: 420, sense: 18, speed: 15, agility: 11, move: 2, mp: 100, qiLayer: 21,
      elem: "shui", nature: "demon", tactics: "cunning", canFlee: false, armor: 4, boss: true, regen: 8,
      introNote: "鬼冤之地阴灵弥漫——鬼王能驱使阴灵兽、自身亦能回煞自愈。它是鬼物邪魔，辟邪神雷正是它的克星：神雷劈/附剑专克邪魔×1.8。先清阴灵、再以神雷集火鬼王。",
      attacks: [
        { name: "万鬼噬魂", dmg: 30, kind: "normal", weight: 12, elem: "shui", range: [1, 4], mp: 6 },
        { name: "怨煞潮", dmg: 26, kind: "normal", weight: 8, aim: "zone", zoneSpan: 1, range: [1, 3], depth: "front", elem: "shui", mp: 7 },
        { name: "夺命阴爪", dmg: 36, kind: "pierce", weight: 7, range: [1, 1], elem: "shui", mp: 8 },
      ],
      reward: { lingshi: 18 }, namedLoot: null,
    };
    const sides = [];
    // 紫灵同闯关（妙音门盟·若结盟）
    if (s.flags.xh_miaoyin_ally) {
      sides.push({ id: "zi_ling", name: "紫灵", kind: "ally", art: "zi_ling",
        hp: 160, hpMax: 160, guard: 0.4, elem: "shui", persona: { aggr: 5, prot: 4, kite: 4 },
        moves: [{ name: "妙音裂魂", dmg: 16, weight: 14, elem: "jin", range: [1, 4], slays: { demon: 1.4 }, line: "紫灵妙音裂空，专荡阴灵之煞：「韩大哥，神雷克它们，放手打！」" }] });
    }
    const qu = this._quhunSide(); if (qu) sides.push(qu);   // 曲魂已失·此处通常为空
    this._combat = new CombatAPI.Combat({
      player, enemies: [yinling(), yinling(), guiwang],
      maxRounds: 24, W: 15, lanes: 3, sides,
      playerPos: 4, enemyPos: 9,
    });
    this._combatMeta = { type: "xh_guiyuan" };
    s.combat = true;
    this._combat.startRound();
    this._combat._log("鬼冤之地阴风惨惨，鬼王驱阴灵兽扑来。你心念一引，七十二口青竹蜂云剑出鞘——辟邪神雷在剑阵间金光流转，正是这些邪魔鬼物的克星！");
    this.log("虚天殿·第一关·鬼冤之地——辟邪神雷专克邪魔鬼物（×1.8）！这是本命法宝克鬼的首秀。先清阴灵兽，再以神雷集火鬼王。", "event");
    UI.openCombat(this._combat, this._combatMeta);
  },

  // —— S7·虚天殿第二关·冰火道·铁火蚁群（虫群·甲坚火属·噬金虫对决）——
  startXhBinghuoFight() {
    const s = State.data;
    this._nextFightType = "xh_binghuo";
    const player = this.playerFighter();
    player.hp = s.hpMax; player.hpMax = s.hpMax;
    const tiehuoyi = () => ({
      name: "铁火蚁", hp: 150, sense: 13, speed: 14, agility: 11, move: 2, mp: 40,
      elem: "huo", nature: "beast", tactics: "feral", canFlee: false, armor: 5, formation: "pack",
      introNote: "铁火蚁群专噬金铁、甲坚如熔铁——奇虫榜第九。与你的噬金虫同源相克：附体结甲抗咬、放虫群对冲、化刃破其重甲。",
      attacks: [
        { name: "熔铁噬咬", dmg: 18, kind: "normal", weight: 12, elem: "huo", range: [1, 1] },
        { name: "火蚁喷焰", dmg: 15, kind: "normal", weight: 7, elem: "huo", range: [1, 3], mp: 4 },
      ],
      reward: {}, namedLoot: null,
    });
    const sides = []; const qu = this._quhunSide(); if (qu) sides.push(qu);
    this._combat = new CombatAPI.Combat({
      player, enemies: [tiehuoyi(), tiehuoyi(), tiehuoyi()],
      maxRounds: 22, W: 15, lanes: 3, sides,
      playerPos: 4, enemyPos: 9,
    });
    this._combatMeta = { type: "xh_binghuo" };
    s.combat = true;
    this._combat.startRound();
    this._combat._log("冰火道熔岩路上，铁火蚁群如赤潮涌来。你掌心噬金虫蠢蠢欲动——同源相克，正好以虫斗蚁：附体结甲、放群对冲、化刃破其熔铁重甲。");
    this.log("虚天殿·第二关·冰火道（熔岩路）——铁火蚁群甲坚火属。以噬金虫四用法对耗、青竹蜂云剑破甲，杀出一条路。", "event");
    UI.openCombat(this._combat, this._combatMeta);
  },

  // —— S9·玄骨终战（全章最高潮·survive 撑到修罗圣火失控自毁+啼魂吞食残魂·以下克上）——
  //    玄骨=前元婴后期·夺曲魂身躯·约结丹后期·修罗圣火（触之必死）。韩立底牌：青竹蜂云剑+辟邪神雷+啼魂兽+皇鳞甲。
  startXhXuanguFight() {
    const s = State.data;
    this._nextFightType = "xh_xuangu_fight";
    const player = this.playerFighter();
    player.hp = s.hpMax; player.hpMax = s.hpMax;
    // 皇鳞甲：替韩立硬抗元婴一击（开局护体厚盾·保命法宝兑现）
    if (State.count("huanglin_jia") > 0) player.shield = (player.shield || 0) + 60;
    // 收果：6-B 反应影响玄骨备防（暴怒=他有防备更难；藏拙=他轻敌更易）
    const wary = !!s.flags.xh_xuangu_rage;       // 暴怒露过辟邪神雷→玄骨有防备
    const careless = !!s.flags.xh_xuangu_endure; // 藏拙示弱→玄骨轻敌
    const dmgMul = wary ? 1.12 : (careless ? 0.9 : 1.0);
    const D = (n) => Math.round(n * dmgMul);
    const xuangu = {
      name: "玄骨上人", hp: 620, sense: 22, speed: 18, agility: 13, move: 2, mp: 160, qiLayer: 24,
      elem: "huo", nature: "demon", tactics: "cunning", canFlee: false, armor: 6, boss: true, regen: 6,
      shield: wary ? 40 : 0,
      introNote: "玄骨夺舍曲魂身躯、改修鬼道，仍远胜于你。他手握修罗圣火——触之必死。但修罗圣火与曲魂身躯不兼容……撑住，待他强融圣火、失控自毁的那一刻，便是你的机会。辟邪神雷克其鬼道、啼魂兽收其残魂。",
      attacks: [
        { name: "鬼煞夺魂", dmg: D(34), kind: "normal", weight: 12, elem: "shui", range: [1, 4], mp: 6 },
        { name: "修罗业火", dmg: D(40), kind: "normal", weight: 9, aim: "zone", zoneSpan: 3, range: [1, 6], depth: "front", elem: "huo", mp: 12 },
        { name: "蚀骨阴爪", dmg: D(44), kind: "pierce", weight: 7, range: [1, 1], elem: "shui", mp: 8 },
      ],
      reward: {}, namedLoot: null,
    };
    const sides = []; const qu = this._quhunSide(); if (qu) sides.push(qu);   // 啼魂兽（克鬼物·吞噬残魂）
    this._combat = new CombatAPI.Combat({
      player, enemies: [xuangu],
      objective: { kind: "survive", rounds: 8,
        winLog: "玄骨强融修罗圣火、结丹后期的躯壳再也压不住那股至焰——圣火轰然失控，曲魂的身躯在金红烈焰中崩塌！你抓住这一线，粘有修罗圣火的飞剑刺入再收回，玄骨粘火灰飞烟灭。残魂欲遁——啼魂兽一声厉鸣扑上，将那缕藏于金雷竹小箭中的残魂一口吞食。玄骨，彻底消亡了。" },
      maxRounds: 8, W: 13, lanes: 2, sides,
      playerPos: 4, enemyPos: 8,
    });
    this._combatMeta = { type: "xh_xuangu_fight" };
    s.combat = true;
    this._combat.startRound();
    this._combat._log("【终战】玄骨实力远胜于你——硬拼无益。撑过 8 回合：辟邪神雷克其鬼道、啼魂兽收其残魂、皇鳞甲替你挡命，待修罗圣火与曲魂身躯相冲、失控自毁的那一刻，便是了断之时！");
    if (State.count("huanglin_jia") > 0) this._combat._log("（皇鳞甲鳞光层叠，替你撑起一道厚盾——蛮胡子这件保命法宝，此刻派上了用场。）");
    this.log("玄骨终战——夺你曲魂的鬼骷髅，今日了断。撑到修罗圣火失控、以辟邪神雷+啼魂兽以下克上，斩前元婴后期！", "bad");
    UI.openCombat(this._combat, this._combatMeta);
  },

  // —— S10·救凌玉灵（objective survive·护星宫双圣之女·关系线种子）——
  startXhLingyulingFight() {
    const s = State.data;
    this._nextFightType = "xh_lingyuling";
    const player = this.playerFighter();
    player.hp = s.hpMax; player.hpMax = s.hpMax;
    const yaoshou = () => ({
      name: "外海妖兽", hp: 180, sense: 13, speed: 16, agility: 12, move: 2, mp: 40,
      elem: "shui", nature: "beast", tactics: "feral", canFlee: false, armor: 3, formation: "pack",
      attacks: [
        { name: "獠牙撕咬", dmg: 22, kind: "normal", weight: 12, elem: "shui", range: [1, 1] },
        { name: "扑击", dmg: 28, kind: "charge", weight: 6, aim: "cell", lunge: true, range: [1, 4], mp: 6, elem: "shui" },
      ],
      reward: {}, namedLoot: null,
    });
    const sides = []; const qu = this._quhunSide(); if (qu) sides.push(qu);   // 啼魂兽随行
    // 凌玉灵·护送对象（VIP·不参战·筑基后期·护住勿令气绝）——hp 抬至 150 撑得住护送
    sides.push({ id: "ling_yuling", name: "凌玉灵", kind: "ally", art: null,
      hp: 150, hpMax: 150, guard: 0.3, elem: "shui", noAct: true, persona: { aggr: 0, prot: 0, kite: 0 }, moves: [] });
    this._combat = new CombatAPI.Combat({
      player, enemies: [yaoshou(), yaoshou()],
      objective: { kind: "survive", rounds: 4,
        winLog: "外海妖兽尽数退散——凌玉灵脱险了。星宫双圣之女承你这一份救命之情，星宫的关系线，自此种下。" },
      maxRounds: 4, W: 15, lanes: 3, sides,
      playerPos: 5, enemyPos: 9,
    });
    // 妖兽优先扑凌玉灵（护送：清开近身追兵）
    this._combat._enemyTargetBias = function(e) {
      const ly = this.sides.find(sd => sd.id === "ling_yuling");
      if (!ly || ly.hp <= 0) return null;
      return this.dist(e, ly) <= 4 ? ly : null;
    };
    this._combat._afterEnemyTick = function() {
      const ly = this.sides.find(sd => sd.id === "ling_yuling");
      if (ly && ly.hp <= 0 && this.status === "ongoing") {
        this._log("凌玉灵气绝倒地——你没能护住星宫双圣之女！");
        this.status = "lose";
      }
    };
    this._combatMeta = { type: "xh_lingyuling" };
    s.combat = true;
    this._combat.startRound();
    this._combat._log("【护人】外海妖兽群围攻凌玉灵——护住她、撑过 4 回合（清开近身妖兽，别让她气绝）！");
    this.log("出殿途中，星宫双圣之女凌玉灵被外海妖兽围困。护住她撑过 4 回合——不必恋战。", "event");
    UI.openCombat(this._combat, this._combatMeta);
  },

  // —— S10·海王兽斩杀（战力验证·碾压·章末扬眉）——
  startXhHaiwangFight() {
    const s = State.data;
    this._nextFightType = "xh_haiwang";
    const player = this.playerFighter();
    player.hp = s.hpMax; player.hpMax = s.hpMax;
    const haiwang = {
      name: "海王兽", hp: 360, sense: 16, speed: 17, agility: 13, move: 2, mp: 80, qiLayer: 18,
      elem: "shui", nature: "beast", tactics: "feral", canFlee: false, armor: 5, boss: true,
      introNote: "七级海王兽——搁在开篇是要逃命的对手。如今你结丹中期、青竹蜂云剑在手、辟邪神雷+噬金虫俱全……正好拿它验一验这一身的脱胎换骨。",
      attacks: [
        { name: "巨涛碾压", dmg: 30, kind: "normal", weight: 12, elem: "shui", range: [1, 2] },
        { name: "海王怒吼", dmg: 26, kind: "normal", weight: 7, aim: "zone", zoneSpan: 1, range: [1, 3], depth: "front", elem: "shui", mp: 7 },
        { name: "吞天巨口", dmg: 38, kind: "pierce", weight: 6, range: [1, 1], elem: "shui", mp: 8 },
      ],
      reward: { lingshi: 20 }, namedLoot: null,
    };
    const sides = []; const qu = this._quhunSide(); if (qu) sides.push(qu);
    this._combat = new CombatAPI.Combat({
      player, enemies: [haiwang], maxRounds: 18, W: 13, lanes: 2, sides,
      playerPos: 4, enemyPos: 8,
    });
    this._combatMeta = { type: "xh_haiwang", canQuick: true };
    s.combat = true;
    this._combat.startRound();
    this.log("外星海闭关出关，七级海王兽撞上枪口。开篇要逃的对手，如今且看你结丹中期+青竹蜂云剑，如何从容斩之——章末扬眉吐气。", "event");
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
      W: 9,
      maxRounds: 14,
      enemyPos: 5,   // 林间遭遇·起手近距，一两回合即接战（playtest：灵狼战勿空转等走近）
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
      // 坊市归途·陆云风拦路夺丹＝狭路对峙（当面叫阵后动手）：起手中近距，一两回合即接战，
      //   不是隔旷野远望（练气期无布置手段，远距=纯空等）。
      enemyPos: 6,
    });
    this._combatMeta = { type: "luyunfeng", canQuick: false };
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
    const pity = s.btPity || 0;
    const daoxin = Math.round(40 + (s.mood / s.moodMax) * 40 - (s.demon / 100) * 25 + pity * 3);
    const rounds = 6 + Math.floor((s.spirit / realm.spMax) * 4) - Math.floor(s.demon / 25);

    // 心魔具象：你最重的业障，就是它的脸（剧情记忆 × 战斗引擎）
    const face = this._demonFace();

    let bottleneckHp, maxRounds, demonName, demonAtk, intro;
    if (isBig) {
      // 大境界·心魔劫：以秘仪配置为基准，远比小境界凶险
      const rite = opts.rite || this._bigRealmRite() || {};
      bottleneckHp = Math.max(15, Math.round((rite.trialHp || 90) - culRatio * 20 - pity * 2));
      maxRounds = Math.max(6, (rite.trialRounds || 10) + Math.floor((s.spirit / realm.spMax) * 4) - Math.floor(s.demon / 25));
      demonName = face.name ? `心魔劫 · ${face.name.replace("心魔 · ", "")}` : `${rite.name || (nextRealm ? nextRealm.name : "瓶颈")}·心魔劫`;
      demonAtk = 14;
      intro = `你按秘仪引动天地之力冲击「${nextRealm ? nextRealm.name : "大境界"}」之关，生平执念尽数化作心魔劫扑面而来——成败、生死，皆在此一战！`;
    } else {
      bottleneckHp = Math.max(15, Math.round(40 + s.realmIndex * 14 - culRatio * 22 - pity * 2));
      maxRounds = Math.max(4, rounds);
      demonName = face.name || `${nextRealm ? nextRealm.name : "瓶颈"}·心魔`;
      demonAtk = 9;
      intro = `心魔过盛，冲关之际它趁虚而起——你须先在心战中降伏它，方能突破至「${nextRealm ? nextRealm.name : "下一层"}」！`;
    }

    const player = this.playerFighter();
    player.hp = Math.max(20, daoxin); player.hpMax = player.hp;

    if (isBig) {
      // —— P0-1 心魔战三阶段：执念之相 → 心魔反扑 → 道心一击 ——
      // 灵力压半：大境界渡劫限制爆发（设计模板 §B）
      player.mp = Math.round((player.mpMax || player.mp || 0) * 0.5);

      const pHp = player.hpMax;
      const p1Hp = Math.max(30, Math.round(pHp * 1.5));
      const p2Hp = Math.max(25, Math.round(pHp * 0.8));
      const cloneHp = Math.max(15, Math.round(pHp * 0.4));
      const p3Hp = Math.max(20, Math.round(pHp * 0.5));

      const mkDemon = (name, hp, atk, extra) => Object.assign({
        name, hp, hpMax: hp, sense: 5, agility: 0, move: 2, mp: 999,
        atkName: "心魔反噬", atk,
        introNote: null,
      }, extra || {});

      // Phase 1: 执念之相——HP×1.5，纯对攻
      const phase1 = mkDemon(demonName, p1Hp, demonAtk, {
        introNote: face.taunt || null,
      });

      // Phase 2: 心魔反扑——本体回血 + 两个心魔分身（clones）
      // 分身血少但分散玩家输出——须先清分身再集火本体，否则回血压不住
      const phase2Name = face.name ? face.name.replace("心魔 · ", "心魔劫 · ") : "心魔劫";
      const phase2 = mkDemon(`${phase2Name}·反扑`, p2Hp, demonAtk, {
        introNote: "心魔不灭——它汲取你的道心裂隙愈合伤痕，更裂出两道分身围攻！须先清分身、再集火本体——否则回血压不住！",
        _demonRegen: true,
      });
      const cloneA = mkDemon(`${phase2Name}·分身甲`, cloneHp, Math.round(demonAtk * 0.6), {
        introNote: null,
      });
      const cloneB = mkDemon(`${phase2Name}·分身乙`, cloneHp, Math.round(demonAtk * 0.6), {
        introNote: null,
      });

      // Phase 3: 道心一击——狂暴（攻击力×1.5），须撑过最后一击
      const phase3 = mkDemon(`${phase2Name}·狂相`, p3Hp, Math.round(demonAtk * 1.5), {
        introNote: "心魔濒死反扑——分身尽碎，它将所有执念凝于一击，狂暴之力铺天盖地！撑过这一波，道心即成！",
        _demonEnrage: true,
      });

      this._combat = new CombatAPI.Combat({
        player,
        enemies: [phase1],
        waves: [[phase2, cloneA, cloneB], [phase3]],
        maxRounds: Math.max(12, maxRounds + 6),
        mode: "breakthrough",
      });
      // 心魔回血钩子：Phase 2 每隔一回合回 5% HP
      this._combat._demonRegenRound = 0;
      this._combat._afterEnemyTick = function() {
        const demon = this.enemies.find(e => e._demonRegen);
        if (!demon || !demon.alive) return;
        this._demonRegenRound = (this._demonRegenRound || 0) + 1;
        if (this._demonRegenRound % 2 === 0 && demon.alive) {
          const heal = Math.round(demon.hpMax * 0.05);
          demon.hp = Math.min(demon.hpMax, demon.hp + heal);
          this._log(`心魔汲取道心裂隙愈合伤痕（+${heal}）——须加快输出！`);
        }
      };
    } else {
      // 小境界心战：保持原样（单阶段）
      this._combat = new CombatAPI.Combat({
        player,
        enemies: [{ name: demonName, hp: Math.max(20, bottleneckHp),
                    sense: 5, agility: 0, move: 2, mp: 999,
                    atkName: "心魔反噬", atk: demonAtk,
                    introNote: face.taunt || null }],
        maxRounds,
        mode: "breakthrough",
      });
    }
    this._combatMeta = { type: "breakthrough", big: isBig, canQuick: false };
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
    // 新手引导：追踪连续未攻击回合数，3 回合未出手弹提示
    const c = this._combat;
    const attacked = c._pActsUsed > 0 || c._pQuickUsed;
    if (attacked) { c._idleRounds = 0; }
    else { c._idleRounds = (c._idleRounds || 0) + 1; }
    if (c._idleRounds >= 2 && !c._idleHinted) {
      c._idleHinted = true;
      // 根据手牌是否够得着给不同提示（比笼统「点法术」更有用）
      let hint = "点法术出牌，或点「结束回合」等候敌方行动";
      if (typeof UI !== "undefined" && UI._anySpellInRange) {
        const reach = UI._anySpellInRange(c);
        if (reach === false) hint = "术法够不着——先点脚下格子「走」贴近，再点法术";
        else if (reach === "only_defend") hint = "够不着敌身——先「走」贴近；或先防御蓄势";
      }
      this.toast(hint);
    }
    c.endRound();
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
    if (names) this.toast(`战中采得：${names}`);
    if (typeof Sfx !== "undefined") Sfx.play("pick");
    if (c.status !== "ongoing") { this._combatOver(); return; }
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
    if (!this._combat || !this._combatMeta) return;
    if (!this._combatMeta.canQuick) {
      this.toast("此战须亲手应对，不可速决");
      return;
    }
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
          // 远雷·禁地情报兑现（铁律3）：摸清的猎杀路线，化作伏击封岳的先手——点名出处
          if (this.settleLedger("jindi_guzhen", "古阵残纹里窥得的那张猎杀路线图，今日全应在了刀口上——你算准他游弋到哪一步、从哪个方位扑来，先手伏击一击咬死。是猎人，反成了猎物")) {
            s.mood = clamp(s.mood + 2, 0, s.moodMax);
          }
          if (this.settleLedger("jindi_zhongwu_map", "钟吾那张朱砂舆图值回了八块灵石——他用三天看清的封岳脾性，让你避开正面、卡住他的巡逻死角下手。命，果然比灵石值钱")) {
            s.mood = clamp(s.mood + 2, 0, s.moodMax);
          }
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
          // 远雷·伏岩观战兑现（铁律3）：看清的路数与旧伤破绽，化作斩蛟那一击的落点——点名出处
          if (this.settleLedger("mojiao_watch", "深潭洞中那阵伏岩观战没有白费——墨蛟的出招路数、左肋那道旧伤，你早记在心里。今日斩蛟那一击，正落在它最痛的破绽上。看，比莽撞动手值钱")) {
            s.mood = clamp(s.mood + 2, 0, s.moodMax);
          }
        }
        // —— 燕家堡之战·战王蝉（增量D）：撑过血线=打到其溃退（剧情撤离，非诛杀）——
        if (meta.enemyName === "战王蝉") {
          State.setFlag("yanjia_boss_done");
          this.meetNpc("zhanwangchan", "燕家堡破阵的魔道巨擘——重伤遁空，与你结下不死不休之仇。");
          this.writeLedger("zhanwangchan_grudge", "燕家堡之战力挫战王蝉——魔道巨擘重伤遁空，与你结下不死不休之仇");
          this.addMilestone("燕家堡之战：力挫战王蝉（不死不休之仇已结）", "showdown");
          this.log("战王蝉甲胄迸裂、振翅遁空——这等魔道巨擘岂是一战可诛？它临去前那一眼死死咬住你的气息：不死不休。这一关，你撑过来了。", "event");
          if (typeof Sfx !== "undefined") Sfx.play("success");
          s.storyStage += 1;   // 越过 yanjia_boss → 由公共尾部 checkStory 接 yanjia_escape
        }
        // —— 矿洞黑吃黑·阴手宣乐（增量E）：识破偷袭→反杀诛之（隐灵纱已由 namedLoot 自动入袋）——
        if (meta.enemyName === "宣乐" && !anyEscaped) {
          State.setFlag("xuanle_slain");
          State.setFlag("modao_e1_betray_done");
          this.meetNpc("xuanle", "掩月宗潜伏征军的阴手——黑吃黑害死队官吕天蒙，反被韩立识破诛杀。");
          this.writeLedger("xuanle_slain", "矿洞黑吃黑——识破并诛杀掩月宗阴手宣乐，为队官吕天蒙讨回那一刀");
          this.addMilestone("阴手首演：识破宣乐的偷袭，反杀诛之", "showdown");
          this.log("宣乐至死不信，自己竟栽在一个伪灵根的征卒手里。那条藏在征军里的毒蛇，断在了你手上。", "good");
          if (typeof Sfx !== "undefined") Sfx.play("success");
          s.storyStage += 1;   // 越过 modao_e1_betray → 公共尾部 checkStory 接 modao_e1_spider
        }
        // —— 血玉蜘蛛 boss（增量E）：狂化态伏诛（蛛卵×2 已由 namedLoot 自动入袋，开灵宠线在机缘房结算）——
        if (meta.enemyName === "血玉蜘蛛" && !anyEscaped) {
          State.setFlag("xueyu_zhizhu_slain");
          State.setFlag("modao_e1_spider_done");
          this.meetNpc("xueyu_zhizhu", "矿洞最深处镇压的四级蛛妖——封印松脱狂化，伏诛于韩立之手。");
          this.writeLedger("xueyu_slain", "诛杀狂化的血玉蜘蛛——剖腹得白玉蛛卵两枚，一条「灵宠」长线自此开端");
          this.addMilestone("矿洞伏诛四级妖·血玉蜘蛛（得蛛卵×2）", "showdown");
          this.addFame(8, "矿场征军里传出，有个伪灵根征卒独毙了狂化的血玉蜘蛛");
          this.log("血玉蜘蛛蜷起八足、血玉甲壳寸寸碎裂——这头镇了不知多少年的狂妖，终究死在你的木行剑光之下。", "good");
          if (typeof Sfx !== "undefined") Sfx.play("success");
          s.storyStage += 1;   // 越过 modao_e1_spider → 公共尾部 checkStory 接 modao_e1_fortune
        }
        // —— 血侍铁罗·二阶段·一（增量G·京城暗流）：硬战逼入绝境→木行剑光断其一臂→化血茧蜕出二阶段（接 modao_e3_tieluo2）——
        if (meta.enemyName === "铁罗") {
          State.setFlag("modao_e3_tieluo_p1_done");
          this.log("血池边的硬仗终于撕开缺口——你聚起一道木行剑光斜斜劈落，铁罗一臂自肩头齐根断飞，断口血煞狂喷！他却不退反进，仰头一声厉啸，周身血煞骤然内缩、结成一枚暗红血茧。茧丝翻卷暴涨间，一头独臂、血肉外露的狂暴畸变之物，正从茧中挣裂而出——他还没死，他在搏命。", "event");
          if (typeof Sfx !== "undefined") Sfx.play("danger");
          s.storyStage += 1;   // 越过 modao_e3_tieluo → 公共尾部 checkStory 接 modao_e3_tieluo2（化茧二阶段大战）
        }
        // —— 血茧铁罗·二阶段·二（增量G·京城暗流）：化茧大战告捷→血侍秘术再蜕一茧真正遁走（仇恨账本跨场首例）——
        if (meta.enemyName === "血茧铁罗") {
          State.setFlag("modao_e3_tieluo_done");
          State.setFlag("tieluo_escaped");
          this.meetNpc("tieluo", "黑煞教的血侍——京城连环失踪案的爪牙。血池一战被你断去一臂、又打垮其化茧搏命的形态，终以血侍秘术蜕茧遁走，与你结下跨场血仇。");
          this.writeLedger("tieluo_escaped", "京城救萧爷爷——断黑煞教血侍铁罗一臂、再打垮其化血茧的狂暴形态，他终以血侍秘术蜕茧金蝉脱壳遁走（仇恨账本首次跨场：断臂之仇、化茧之恨，他会带着记忆回来，皇宫决战再算）");
          this.addMilestone("京城暗流：断臂铁罗、力破血茧形态，黑煞教浮出水面（boss 蜕茧遁走）", "showdown");
          this.addFame(6, "京城散修间传开，有个外来的筑基修士断了血侍一臂、又破了他化茧的搏命形态，从血池里救回被掳的凡人");
          this.log("血茧铁罗被你一招招逼到油尽灯枯，那具独臂的畸变躯壳终于支撑不住、轰然崩裂。可这血侍到底是黑煞教豢养的死士——崩裂的血肉里竟又内缩出一枚更小的血茧，化作一缕血光遁入夜色，真正脱了身。他临去那一眼死死咬住你的气息：这笔断臂化茧的账，黑煞教记下了。血池边，萧爷爷与几名被掳的散修，总算救了出来。", "event");
          if (typeof Sfx !== "undefined") Sfx.play("success");
          s.storyStage += 1;   // 越过 modao_e3_tieluo2 → 公共尾部 checkStory 接 modao_e3_wuse
        }
        // —— 五色门主·王管事（增量G·京城暗流）：妖化伏诛=为墨彩环报仇·墨府之祸总兑现（情感落点交由 modao_e3_farewell 收束）——
        if (meta.enemyName === "王管事" && !anyEscaped) {
          State.setFlag("modao_e3_wuse_done");
          State.setFlag("mofu_avenged");
          this.meetNpc("wuse_menzhu", "嘉元城墨府之祸的真凶——藏身京城五色门的妖化门主，伏诛于韩立之手，墨彩环的血债至此了结。");
          this.writeLedger("mofu_avenged", "京城五色门收口——诛杀妖化王管事，为墨彩环了结墨府之祸的血债（七玄门篇种下的因果，至此总兑现）");
          this.addMilestone("京城暗流·收口：诛五色门主王管事，为墨彩环报仇（墨府之祸了结）", "showdown");
          this.addFame(10, "京城散修间传开，那外来的修士竟独力端了害人的五色门，为故人雪了血仇");
          this.log("妖化的王管事在你木行剑光下煞气溃散、轰然倒地——这桩压了墨彩环半生的血债，今日了结。墨彩环立在尸身前久久未语，肩头那口压了半生的浊气，终于缓缓松了下来。", "good");
          if (typeof Sfx !== "undefined") Sfx.play("success");
          s.storyStage += 1;   // 越过 modao_e3_wuse → 公共尾部 checkStory 接 modao_e3_farewell（墨彩环·不遗憾的告别）
        }
      } else if (meta.enemyName === "战王蝉") {
        // 撑不住血线：浴血退守、就地整顿再战（fail-forward·不设死局）——不诛杀、不死亡螺旋
        this._bountyFight = false;
        s.flags.losses_zhanwangchan = (s.flags.losses_zhanwangchan || 0) + 1;
        const bonus = Math.min(3, s.flags.losses_zhanwangchan) * 8;
        s.hp = s.hpMax;
        s.demon = clamp(s.demon + 10, 0, 100);
        this.log(`战王蝉势大如崩山，你浴血退守、就地整顿（再战伤害+${bonus}%）。这一蝉不死不休——你不退，它更不会退。调息再上！`, "bad");
        s.pendingEvent = "yanjia_boss";
        this._retryAfterLoss = "yanjia_boss";
      } else if (meta.enemyName === "宣乐" || meta.enemyName === "血玉蜘蛛") {
        // 矿洞两战·fail-forward：浴血暂退、就地敷伤整顿再战，败有所偿（不设死局）——回各自来源节点
        this._bountyFight = false;
        const isSpider = meta.enemyName === "血玉蜘蛛";
        const lk = isSpider ? "losses_xueyu_zhizhu" : "losses_xuanle";
        s.flags[lk] = (s.flags[lk] || 0) + 1;
        const bonus = Math.min(3, s.flags[lk]) * 8;
        s.hp = s.hpMax;
        s.demon = clamp(s.demon + 8, 0, 100);
        const node = isSpider ? "modao_e1_spider" : "modao_e1_betray";
        this.log(isSpider
          ? `血玉蜘蛛狂性大发，你浴血暂退、就地敷伤整顿（再战伤害+${bonus}%）。这等狂妖退无可退——调息，再上！`
          : `宣乐阴招狠辣，你识破却仍中了一记，错身暂退、敛息蓄势（再战伤害+${bonus}%）。这条毒蛇绝不能放——稳住，反杀他！`,
          "bad");
        s.pendingEvent = node;
        this._retryAfterLoss = node;
      } else if (meta.enemyName === "铁罗" || meta.enemyName === "血茧铁罗" || meta.enemyName === "王管事") {
        // 京城三战·fail-forward（增量G·二阶段铁罗）：浴血暂退、就地敷伤整顿再战，败有所偿（不设死局）——回各自来源节点
        this._bountyFight = false;
        const KC = {
          "铁罗":     { lk: "losses_tieluo",      node: "modao_e3_tieluo" },
          "血茧铁罗": { lk: "losses_tieluo_mao",  node: "modao_e3_tieluo2" },
          "王管事":   { lk: "losses_wuse_menzhu", node: "modao_e3_wuse" },
        }[meta.enemyName];
        s.flags[KC.lk] = (s.flags[KC.lk] || 0) + 1;
        const bonus = Math.min(3, s.flags[KC.lk]) * 8;
        s.hp = s.hpMax;
        s.demon = clamp(s.demon + 8, 0, 100);
        const msg = {
          "铁罗":     `铁罗血煞缠身、阴诡难缠，你错身暂退、敛息蓄势（再战伤害+${bonus}%）。血池里还有被掳的人在等——稳住，逼他现出形迹、断他一臂！`,
          "血茧铁罗": `化茧的铁罗痛觉尽失、亡命搏杀，你浴血暂退、就地敷伤整顿（再战伤害+${bonus}%）。这具血茧已是强弩之末——咬住他，把这搏命的躯壳彻底打垮！`,
          "王管事":   `妖化的王管事煞气滔天，你浴血暂退、就地敷伤整顿（再战伤害+${bonus}%）。墨彩环半生的血债压在你肩上——他行土，你木行正克，凭相克与底牌啃下他！调息，再上！`,
        }[meta.enemyName];
        this.log(msg, "bad");
        s.pendingEvent = KC.node;
        this._retryAfterLoss = KC.node;
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
        const isFog = !!(ExploreMap.MAPS[s.exmap.stack[0].mapId] || {}).fog;   // 后山野外迷雾图
        if (s.exmap) {
          const inCave = s.exmap.stack.length > 1;
          if (win && meta.enemyName === "墨蛟") {
            // 决战告捷：出洞出图，潭边戏（mojiao_after）由主线接管
            this.finishExmap("victory");
            return;
          }
          if (win && isFog) {
            // 后山猎杀告捷：巢穴的猎物伏诛，血食谷归于沉寂——回图可搜刮、自行离山
            const f = ExploreMap.cur(s.exmap);
            f.hunted[f.node] = true;
            this.log("血食谷重归沉寂。那头盘踞后山的凶兽，终成你剑下亡魂——谷中遍地骸骨，正可细细搜刮。", "good");
            if (UI.exmapNote) UI.exmapNote("血食谷归于死寂——巢穴空了，腥气散了。", "good");
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
          } else if (!win && !inCave && isFog) {
            // 后山猎败：负伤退出血食谷，退回林口（猎物仍在，可调息再来）
            const f = ExploreMap.cur(s.exmap);
            f.node = ExploreMap.mapOf(f).entry;
            this.log("你负伤退出血食谷，那畜生的吼声仍在身后林子里回荡——这一场，败了。退回林口，且容你喘口气。", "bad");
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
    } else if (meta.type === "spar") {
      // 登门切磋收场（点到即止）：胜负皆有所得、皆不结仇——演武是交情，不是仇杀
      const I = (typeof INTERACTIONS !== "undefined") ? INTERACTIONS : null;
      s.body += 1;
      if (win) {
        if (I) { I.markInteract(s, meta.npcId); I.favor(s, meta.npcId, 6); }
        s.mood = clamp(s.mood + 5, 0, s.moodMax);
        const hid = s.realmIndex - (s.revealedRealm != null ? s.revealedRealm : s.realmIndex);
        this.log(`「${meta.enemyName}」收势抱拳，心服口服："受教了！"${hid > 0 ? "他上下打量你半晌，终究没看透你的深浅。" : ""}演武见真章，交情反而更近了（体魄+1，心境+5）。`, "good");
        if (typeof Sfx !== "undefined") Sfx.play("success");
      } else {
        // 败也点到即止：对方收手指点破绽——不重伤、不长心魔，挨打也是长进
        s.hp = Math.max(s.hp, Math.round(s.hpMax * 0.35));
        if (I) { I.markInteract(s, meta.npcId); I.favor(s, meta.npcId, 4); }
        const gotInsight = Math.random() < 0.5;
        if (gotInsight) s.insight += 1;
        this.log(`「${meta.enemyName}」一招将你逼出圈外，随即收势扶你起身，指了你招式里的破绽——演武点到即止，挨打也是长进（体魄+1${gotInsight ? "，悟性+1" : ""}）。`, "event");
      }
    } else if (meta.type === "fame_duel") {
      // 风云榜·夺名比斗收场：当众之战，赢了扬名、输了也当众——但江湖比斗留手，不至重伤结仇
      const I = (typeof INTERACTIONS !== "undefined") ? INTERACTIONS : null;
      s.body += 1;
      const wonBefore = !!s.flags[`duel_won_${meta.npcId}`];
      if (win) {
        if (I) I.favor(s, meta.npcId, 3);
        s.mood = clamp(s.mood + 6, 0, s.moodMax);
        // 公开比斗做不得假：示人境界随之抬到对方层数（藏拙的代价在此兑现——露一手=扬名时刻）
        const shownIdx = s.revealedRealm != null ? s.revealedRealm : s.realmIndex;
        const needIdx = Math.min(s.realmIndex, Math.max(0, (meta.foeLayer || 1) - 1));
        let revealNote = "";
        if (needIdx > shownIdx) {
          s.revealedRealm = needIdx;
          revealNote = `当众放开的手脚做不得假——江湖眼里，你的修为如今至少是「${DATA.realms[needIdx].name}」。`;
        }
        if (wonBefore) {
          this.addFame(2, `再胜「${meta.enemyName}」（旧闻不再新鲜）`);
          this.log(`你再度胜过「${meta.enemyName}」。围观的修士点点头便散了——赢过的人再赢一次，江湖不会多看第二眼。${revealNote}`, "event");
        } else {
          s.flags[`duel_won_${meta.npcId}`] = true;
          const gain = (meta.foeLayer || 1) * 3 + 4;
          this.addFame(gain, `当众比斗胜「${meta.enemyName}」`);
          this.addMilestone(`比斗胜「${meta.enemyName}」·座次又进一步`, "deed");
          this.log(`「${meta.enemyName}」收势认负，围观的修士一片哗然。这一场当众的胜利做不得假——茶馆酒肆间，你的名号今夜就会传开。${revealNote}`, "good");
          if (typeof Sfx !== "undefined") Sfx.play("success");
        }
      } else {
        // 当众落败：名声受挫（不至归零）、心境受挫——但比斗留手，不重伤不长心魔
        s.hp = Math.max(s.hp, Math.round(s.hpMax * 0.35));
        const loss = Math.min(s.fame || 0, 4);
        if (loss > 0) { s.fame -= loss; }
        s.mood = clamp(s.mood - 6, 0, s.moodMax);
        if (I) I.favor(s, meta.npcId, 2);
        this.log(`「${meta.enemyName}」一招将你逼出圈外。围观的窃语像针一样扎人${loss > 0 ? `（名声-${loss}）` : ""}——当众下的战书，输了也得当众咽下。回去练，再来。`, "bad");
      }
    } else if (meta.type === "showdown") {
      if (win) {
        State.setFlag("modafu_dead");
        this.log("墨大夫毒发倒地，铁奴被你击碎，余子童的元神也被你以功力生生镇灭！你赢了——靠的是准备、算计与一刻不敢松懈的苦修。", "good");
        this.addMilestone("夺舍之夜：反杀墨大夫（余子童）", "showdown");
        // 远雷·决战前准备兑现（铁律3）：以武/以毒为先，皆在此役开花结果——点名出处
        if (this.settleLedger("showdown_prep_martial", "苦练到极致的眨眼剑法，在夺舍之夜近身那一瞬递了出去——快到墨大夫的元神来不及反扑。当初日夜磨剑的执拗，今夜全数兑成了那道致命的快")) {
          s.mood = clamp(s.mood + 3, 0, s.moodMax);
        }
        if (this.settleLedger("showdown_prep_poison", "催熟的剧毒与满袖暗器，在三段恶斗里一寸寸耗垮了铁奴的百毒之躯——以弱胜强的本钱，全是当初一味一味备下的。备得越足，今夜便走得越稳")) {
          s.mood = clamp(s.mood + 3, 0, s.moodMax);
        }
        if (this.settleLedger("showdown_prep_swift", "你没有多备一物、只抢一个「快」字——余子童尚未起疑便已动手，今夜他连惊觉的工夫都没有。备得久不如下手早：这一注速攻，押对了")) {
          s.mood = clamp(s.mood + 3, 0, s.moodMax);
        }
        // 远雷·暗修期与拜师初的伏笔在反杀夜一并兑现（铁律3）——点名出处
        if (this.settleLedger("intro_watch_modafu", "拜师那天起你就暗暗记下墨大夫的每一处反常——密室的气味、看你的眼神。今夜动手前，正是这些点滴让你早早识破了「师恩」底下的杀机，没等到刀架脖子才醒悟")) {
          s.mood = clamp(s.mood + 2, 0, s.moodMax);
        }
        if (this.settleLedger("secret_cultivate_push", "暗修期那一截抢出来的修为，今夜成了压垮余子童元神的最后一分功力。当初把小绿瓶的灵药尽数砸进苦修——这一注，押对了")) {
          s.mood = clamp(s.mood + 2, 0, s.moodMax);
        }
        if (this.settleLedger("secret_cultivate_probe", "当初故意露破绽试探，摸清了墨大夫并不知你真实修为——今夜这道信息差，成了你抢得先手的底牌。他至死都没料到药童的功力深到这般")) {
          s.mood = clamp(s.mood + 2, 0, s.moodMax);
        }
        if (this.settleLedger("friends_learn_martial", "厉飞雨教的那几手凡人武学，早与眨眼剑法融在了一处。近身搏杀那一瞬的三分底气，是兄弟当年笑着递来的——他不知道，这几招今夜替你挡了命")) {
          s.mood = clamp(s.mood + 2, 0, s.moodMax);
        }
        this.addFame(15, "药庐那位韩师傅，深藏不露");
        s.mood = clamp(s.mood + 12, 0, s.moodMax);
        // 曲魂幡到手：张铁尸傀自此随你驱使（侧位单位 v0——挚友之尸，为你而战）
        if (!s.sideUnit) {
          s.sideUnit = { id: "zhangtie_corpse", name: "曲魂", hp: 70, hpMax: 70, atk: 12,
                         atkName: "尸傀挥击", nature: "corpse", guard: 0.3, status: "ok", carry: true };
          this.log("你拾起墨大夫遗落的「曲魂幡」。幡下尸傀缓缓转向你，躬身待命——那身形，依稀还是当年演武厅里和你过招的少年。自此，张铁的遗蜕将随你出战（历练与遭遇战自动随行）。", "event");
          this.addMilestone("曲魂幡御尸：曲魂随行", "bigitem");
          this.toast("侧位随行：曲魂");
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
        // 远雷·丹毒传承与身份伏笔在以下克上一役兑现（铁律3）——点名出处
        if (this.settleLedger("identity_study_poison", "毒杀这位修仙杀手的方子，正出自当年从墨大夫遗物里抄录的那几卷毒方。他用了一辈子的医毒之术，最终成了取他性命的人的本钱——这老鬼若泉下有知，怕要气活")) {
          s.mood = clamp(s.mood + 3, 0, s.moodMax);
        }
        if (this.settleLedger("identity_practice_medicine", "以墨大夫身份行医这些年打探来的门中虚实，让你算准了金光上人的来路与软肋。新身份最大的好处——谁都不防一个看病抓药的老药师")) {
          s.mood = clamp(s.mood + 2, 0, s.moodMax);
        }
        if (this.settleLedger("intro_observe_herbs", "当年拜师初时一味一味记下的药庐门道，早把你练成了半个丹毒行家——催熟剧毒、淬炼暗器，全靠这点根基。丹道启蒙那一步，原来走得不冤")) {
          s.mood = clamp(s.mood + 2, 0, s.moodMax);
        }
        if (this.settleLedger("gang_use_xiaosuanpan", "当初托小算盘盯着野狼帮，那些人手分布、头目习性的零碎情报，到金光上人现身这一刻全串成了线——你算准了野狼帮的底、也算准了这尊请来的杀神几时落单")) {
          s.mood = clamp(s.mood + 2, 0, s.moodMax);
        }
        if (this.settleLedger("gang_focus_cultivate", "野狼帮闹得最凶那阵子，你没去蹚浑水，闷头把修为又拔高一截——今日对上金光上人，正是这点不动声色攒下的功力，让你的毒与暗器递得到、收得回")) {
          s.mood = clamp(s.mood + 2, 0, s.moodMax);
        }
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
    } else if (meta.type === "patrol") {
      // 金鼓原巡逻遭遇战（增量F）：先斩领队群势溃→缴获傀儡残件（傀儡线引子·缴获包装【修#5】）
      if (win) {
        State.setFlag("modao_e2_patrol_done");
        State.give("kuilei_canjian", 1);
        this.meetNpc("wuxuan", "金鼓原前线七派同袍——巡逻遭遇战中与你并肩斩魔修小队的筑基初期好手。");
        this.writeLedger("modao_patrol_won", "金鼓原巡逻遭遇战告捷——先斩魔修领队、群势立溃，缴获傀儡残件，初窥傀儡之术的引子");
        this.addMilestone("金鼓原练兵：擒贼先擒王，平魔修小队（缴获傀儡残件）", "showdown");
        this.addFame(6, "金鼓原前线传开，有个伪灵根筑基带着同袍平了一支魔修游猎队");
        this.log("领队一倒，那两个喽啰登时没了主心骨——被你与武炫三两下料理干净。你从领队尸身上搜出一捧傀儡残件与半幅刻满阴纹的图纸：魔道役尸为傀的机巧，竟与你大衍诀所习暗合。武炫抹了把血，咧嘴：「痛快！」", "good");
        if (typeof Sfx !== "undefined") Sfx.play("success");
        s.storyStage += 1;
        this.checkStory();
      } else {
        // fail-forward：浴血整顿、再战+伤——点醒"擒贼先擒王"（不设死局）
        this._bountyFight = false;
        s.flags.losses_moxiu_patrol = (s.flags.losses_moxiu_patrol || 0) + 1;
        const bonus = Math.min(3, s.flags.losses_moxiu_patrol) * 8;
        s.hp = s.hpMax;
        s.demon = clamp(s.demon + 8, 0, 100);
        this.log(`魔修结阵难缠，你与武炫浴血暂退、就地整顿（再战伤害+${bonus}%）。记着——擒贼先擒王，先斩了那领队，网就散了。调息，再上！`, "bad");
        s.pendingEvent = "modao_e2_patrol";
        this._retryAfterLoss = "modao_e2_patrol";
      }
    } else if (meta.type === "santuan") {
      // 皇宫决战开幕·三组对位群架（增量H·第四幕）：三同袍并肩撕开缺口→杀进皇宫深处（接 modao_e4_zhanluo 之死）
      if (win) {
        State.setFlag("modao_e4_santuan_done");
        this.meetNpc("liujing", "皇宫决战并肩的黄枫谷师兄——除魔卫道之楷模，身负祖传真宝凤凰符。");
        this.writeLedger("modao_santuan_won", "九筑基夜闯皇城·开幕三组对位群架告捷——韩立与刘靖/宋蒙/钟卫娘三组同袍并肩冲杀，撕开血侍阵线、杀进皇宫深处（sides[] 复数化群架首演）");
        this.addMilestone("皇宫决战开幕：三组对位群架告捷，杀入皇宫深处", "showdown");
        this.addFame(8, "京中传开，九名筑基修士夜闯皇城、当街力破黑煞教血侍阵");
        this.log("血侍一片片倒下——三组同袍背靠背、攻守交替，竟把黑煞教的血侍阵生生撕开一道口子。刘靖长剑遥指深处：「不要恋战！贼首就在皇宫最底下——杀进去！」众人合身突入，一路向皇宫深处杀去。", "good");
        if (typeof Sfx !== "undefined") Sfx.play("success");
        s.storyStage += 1;
        this.checkStory();
      } else {
        // fail-forward：浴血整顿、再战+伤（不设死局）——群架人多势众，调息再上必能撕开缺口
        this._bountyFight = false;
        s.flags.losses_santuan = (s.flags.losses_santuan || 0) + 1;
        const bonus = Math.min(3, s.flags.losses_santuan) * 8;
        s.hp = s.hpMax;
        s.demon = clamp(s.demon + 6, 0, 100);
        this.log(`血侍一拥而上、阵脚一时被冲乱，你与同袍浴血暂退、就地整顿（再战伤害+${bonus}%）。三组对位、交叉支援——莫各自为战，护住彼此侧翼，再杀回去！`, "bad");
        s.pendingEvent = "modao_e4_santuan";
        this._retryAfterLoss = "modao_e4_santuan";
      }
    } else if (meta.type === "tuoshi") {
      // 拖时布阵战（增量H下·survive 首例）：几人不敌胥王假丹之威、且战且退，撑到师兄妹「真·颠倒五行阵」布成
      if (win) {
        State.setFlag("modao_e4b_tuoshi_done");
        this.writeLedger("modao_tuoshi_won", "皇宫决战·拖时布阵——几人不敌胥王假丹之威、且战且退拖延时辰，终待师兄妹与傀儡蜥蜴将「真·颠倒五行阵」布成（survive 拖满回合·败有所得首例）");
        this.addMilestone("皇宫决战：拖住胥王，真·颠倒五行阵布成", "showdown");
        this.log("「阵成了——！」师兄妹一声厉喝，五道阵旗同时插定，整座皇城广场陡然光华大作。胥王脚下五行倒转、虚实易位，那柄黑血刀第一次劈了个空。轮到我们了。", "good");
        if (typeof Sfx !== "undefined") Sfx.play("success");
        s.storyStage += 1;
        this.checkStory();
      } else {
        // fail-forward：浴血退守、重整阵线（拖时之战不设死局）——撑住待阵成
        s.flags.losses_tuoshi = (s.flags.losses_tuoshi || 0) + 1;
        const bonus = Math.min(3, s.flags.losses_tuoshi) * 8;
        s.hp = s.hpMax;
        s.demon = clamp(s.demon + 6, 0, 100);
        this.log(`胥王假丹之威太盛，一时险些被冲垮——你与同袍浴血退守、重整阵线（再战伤害+${bonus}%）。撑住！只要拖到阵成，便有胜机——护住彼此，莫要恋战！`, "bad");
        s.pendingEvent = "modao_e4b_tuoshi";
        this._retryAfterLoss = "modao_e4b_tuoshi";
      }
    } else if (meta.type === "xuwang_final") {
      // 阵成决战（增量H下）：颠倒五行阵逐回合压制+底牌齐发→三符宝毁假丹肉身→血凝五行丹复生神魂（waves）→战胜后真凰符剧情杀
      if (win) {
        State.setFlag("modao_e4b_xuwang_done");
        this.writeLedger("modao_xuwang_slain", "皇宫决战·阵成压制——颠倒五行阵逐回合反噬胥王，三符宝齐轰毁其假丹肉身，血凝五行丹借阵复生之神魂亦被打散，终由钟卫娘祭真凰符灭其神魂。黑煞教覆灭。");
        this.addMilestone("皇宫决战：胥王伏诛，黑煞教覆灭", "showdown");
        this.addFame(14, "京城血夜终了——九筑基夜闯皇城，力诛黑煞教主胥王，越国魔患一朝荡平");
        if (typeof Sfx !== "undefined") Sfx.play("success");
        s.storyStage += 1;
        this.checkStory();
      } else {
        // fail-forward：阵法仍镇着他，再蓄底牌、卷土重来（决战不设死局）
        s.flags.losses_xuwang = (s.flags.losses_xuwang || 0) + 1;
        const bonus = Math.min(3, s.flags.losses_xuwang) * 8;
        s.hp = s.hpMax;
        s.demon = clamp(s.demon + 6, 0, 100);
        this.log(`胥王假丹肉身悍勇异常，一击险些破阵——你与同袍咬牙稳住阵脚、再蓄底牌（再战伤害+${bonus}%）。阵法仍在镇着他，底牌齐发、莫给他喘息之机——再来！`, "bad");
        s.pendingEvent = "modao_e4b_zhencheng";
        this._retryAfterLoss = "modao_e4b_zhencheng";
      }
    } else if (meta.type === "zb_jinbei") {
      // 再别天南·Act1 金背妖螂险战（fieldCycle 反制·越阶硬仗）
      if (win) {
        State.setFlag("zaibie_jinbei_done");
        this.writeLedger("zaibie_jinbei_won", "再别天南·嘉元城外——颠倒五行阵图逐回合反制金背妖螂，曲魂·身外化身当先，越阶硬仗告捷。");
        this.addMilestone("再别天南：阵图破金背妖螂", "zaibie");
        this.log("金背妖螂金鸣一窒、轰然坠地。颠倒五行阵图收去光华——那夺舍者驱使的灵兽，没能拦下你。", "good");
        if (typeof Sfx !== "undefined") Sfx.play("success");
        s.storyStage += 1;
        this.checkStory();
      } else {
        s.flags.losses_zb_jinbei = (s.flags.losses_zb_jinbei || 0) + 1;
        const bonus = Math.min(3, s.flags.losses_zb_jinbei) * 8;
        s.hp = s.hpMax;
        s.demon = clamp(s.demon + 6, 0, 100);
        this.log(`金背镰势太猛，一时险些被掀翻——你退开半步、重新催动阵图（再战伤害+${bonus}%）。金克木，硬碰吃亏，借阵反制、曲魂掠阵，再来！`, "bad");
        s.pendingEvent = "zaibie_a1_jinbei";
        this._retryAfterLoss = "zaibie_a1_jinbei";
      }
    } else if (meta.type === "zb_duoshe") {
      // 再别天南·Act1 御灵宗夺舍者（waves 二阶段）——胜得绿煌剑+奇虫榜玉简
      if (win) {
        State.setFlag("zaibie_duoshe_done");
        if (State.count("lvhuang_jian") < 1) State.give("lvhuang_jian", 1);
        if (State.count("qichong_yujian") < 1) State.give("qichong_yujian", 1);
        this.writeLedger("zaibie_duoshe_won", "再别天南·夺剑——曲魂假丹之躯硬撼结丹本命剑，先碎夺舍躯壳、再散结丹残念。绿煌剑（越阶第三主战·配剑影分光术）与奇虫榜玉简归你。");
        this.addMilestone("再别天南：夺御灵宗夺舍者之绿煌剑", "zaibie");
        this.addFame(8, "嘉元城外，一名筑基修士越阶夺下御灵宗结丹修士的本命古剑——绿煌剑易主");
        this.log("那缕结丹残念再凝不住，终被打散。绿煌剑通体莹绿，应声落入你掌中——可在【行头】中装备，配剑影分光术，便是你越阶驱使的第三柄主战法宝。奇虫榜玉简亦一并到手。", "good");
        if (typeof Sfx !== "undefined") Sfx.play("success");
        s.storyStage += 1;
        this.checkStory();
      } else {
        s.flags.losses_zb_duoshe = (s.flags.losses_zb_duoshe || 0) + 1;
        const bonus = Math.min(3, s.flags.losses_zb_duoshe) * 8;
        s.hp = s.hpMax;
        s.demon = clamp(s.demon + 6, 0, 100);
        this.log(`那柄绿煌剑越阶之威仍是棘手，一时奈何不得——你与曲魂错身退开、重整气息（再战伤害+${bonus}%）。他躯壳催不全结丹本命，缠住、磨掉这口越阶劲，再上！`, "bad");
        s.pendingEvent = "zaibie_a1_duoshe";
        this._retryAfterLoss = "zaibie_a1_duoshe";
      }
    } else if (meta.type === "zb_jingu") {
      // 再别天南·Act2 金鼓原大决战（sides[] 群战）
      if (win) {
        State.setFlag("zaibie_jingu_done");
        this.writeLedger("zaibie_jingu_won", "再别天南·金鼓原决战——与李化元、南宫婉并肩斩魔，先斩魔修领队、撕开缺口。然黑煞教势大、灵兽山倒戈，正道大局已不可挽。");
        this.addMilestone("再别天南：金鼓原力斩魔修领队", "zaibie");
        this.log("魔修领队被你与曲魂合力斩落，余众一时溃乱。可放眼整片金鼓原——倒戈的灵兽山、潮水般的黑煞教众，这一局，终究是回天乏术。", "good");
        if (typeof Sfx !== "undefined") Sfx.play("success");
        s.storyStage += 1;
        this.checkStory();
      } else {
        s.flags.losses_zb_jingu = (s.flags.losses_zb_jingu || 0) + 1;
        const bonus = Math.min(3, s.flags.losses_zb_jingu) * 8;
        s.hp = s.hpMax;
        s.demon = clamp(s.demon + 6, 0, 100);
        this.log(`魔潮人多势众，阵脚一时被冲乱——你与李化元、南宫婉浴血暂退、重整阵线（再战伤害+${bonus}%）。擒贼先擒王，护住彼此侧翼，再杀回去！`, "bad");
        s.pendingEvent = "zaibie_a2_jingu";
        this._retryAfterLoss = "zaibie_a2_jingu";
      }
    } else if (meta.type === "zb_hushan") {
      // 再别天南·Act2 护山大阵·守阵（objective:survive→李化元燃命殉道）
      if (win) {
        State.setFlag("zaibie_hushan_done");
        this.writeLedger("zaibie_hushan_won", "再别天南·护山大阵——死守阵脚六息，李化元燃尽本命真元布成护山大阵，挡下魔潮、护黄枫谷弟子退走，自己却灯枯油尽。");
        this.addMilestone("再别天南：护山大阵成，李化元燃命殉道", "zaibie");
        this.log("齐天光幕轰然立起，魔潮被生生挡在阵外。可阵心那道白须身影，已悄然伏倒——李化元燃尽了最后一缕真元。", "good");
        if (typeof Sfx !== "undefined") Sfx.play("success");
        s.storyStage += 1;
        this.checkStory();
      } else {
        s.flags.losses_zb_hushan = (s.flags.losses_zb_hushan || 0) + 1;
        const bonus = Math.min(3, s.flags.losses_zb_hushan) * 8;
        s.hp = s.hpMax;
        s.demon = clamp(s.demon + 6, 0, 100);
        this.log(`阵脚险些被冲破——你与曲魂咬牙退守、重整防线（再战伤害+${bonus}%）。这一战不必胜，只须撑住：拖到护山大阵布成，再来！`, "bad");
        s.pendingEvent = "zaibie_a2_hushan";
        this._retryAfterLoss = "zaibie_a2_hushan";
      }
    } else if (meta.type === "zb_hudao") {
      // 再别天南·Act4 三人护道战（objective:survive→战后吸修跌境·纯演出）
      if (win) {
        State.setFlag("zaibie_hudao_done");
        this.writeLedger("zaibie_hudao_won", "再别天南·护道——与南宫婉、陈巧倩三人结阵护住退路，撑过追杀。然此役后韩立为吸修所趁、修为暴跌（跌境·纯演出·不动数值）。");
        this.addMilestone("再别天南：三人护道，撑过追杀", "zaibie");
        this.log("追兵那一波势头终于缓了下来——身后退往矿洞的退路，护住了。", "good");
        if (typeof Sfx !== "undefined") Sfx.play("success");
        s.storyStage += 1;
        this.checkStory();
      } else {
        s.flags.losses_zb_hudao = (s.flags.losses_zb_hudao || 0) + 1;
        const bonus = Math.min(3, s.flags.losses_zb_hudao) * 8;
        s.hp = s.hpMax;
        s.demon = clamp(s.demon + 6, 0, 100);
        this.log(`追兵咬得太紧，护道阵脚一时松动——三人背靠背、重新结阵（再战伤害+${bonus}%）。护住退路，撑住这一波，再来！`, "bad");
        s.pendingEvent = "zaibie_a4_hudao";
        this._retryAfterLoss = "zaibie_a4_hudao";
      }
    } else if (meta.type === "zb_kuangdong") {
      // 再别天南·Act4 矿洞拖时·启阵（objective:survive→大挪移令强启古传送阵·接演出①离开天南）
      if (win) {
        State.setFlag("zaibie_kuangdong_done");
        this.writeLedger("zaibie_kuangdong_won", "再别天南·矿洞拖时——死守洞口六息，辛如音耗尽精血修阵，大挪移令催动万载古传送阵，一步踏出天南。");
        this.addMilestone("再别天南：古阵强启，离开天南", "zaibie");
        this.log("贯天光柱自古阵心爆起——大挪移令催动的契机，只在这一瞬。该走了。", "good");
        if (typeof Sfx !== "undefined") Sfx.play("success");
        s.storyStage += 1;
        this.checkStory();
      } else {
        s.flags.losses_zb_kuangdong = (s.flags.losses_zb_kuangdong || 0) + 1;
        const bonus = Math.min(3, s.flags.losses_zb_kuangdong) * 8;
        s.hp = s.hpMax;
        s.demon = clamp(s.demon + 6, 0, 100);
        this.log(`追兵几乎要踏破洞口——你与曲魂死死封住隘口（再战伤害+${bonus}%）。辛如音的古阵就要成了，拖住这六息，再来！`, "bad");
        s.pendingEvent = "zaibie_a4_kuangdong";
        this._retryAfterLoss = "zaibie_a4_kuangdong";
      }
    } else if (meta.type === "ss_yaoshou") {
      // 初入星海·一① 落海·低阶海妖（fieldCycle 海域相位·曲魂并肩）
      if (win) {
        State.setFlag("starsea_yaoshou_done");
        this.writeLedger("starsea_yaoshou_won", "初入星海·落海——海域相位层层迟滞，韩立携曲魂斩退循血来袭的低阶海妖，于乱星海立住第一口气。");
        this.addMilestone("初入星海·落海：斩海妖、立身星海", "starsea");
        this.log("海妖沉尸碧波，血腥气被洋流冲散。你伏在浮木上喘息——这片陌生的妖海，你算是活着踏进来了。", "good");
        if (typeof Sfx !== "undefined") Sfx.play("success");
        s.storyStage += 1;
        this.checkStory();
      } else {
        s.flags.losses_ss_yaoshou = (s.flags.losses_ss_yaoshou || 0) + 1;
        const bonus = Math.min(3, s.flags.losses_ss_yaoshou) * 8;
        s.hp = s.hpMax;
        s.demon = clamp(s.demon + 6, 0, 100);
        this.log(`海妖凶蛮，险些将你拖入海底——你强提真元、与曲魂背水再战（再战伤害+${bonus}%）。落海绝境，唯有杀出去！`, "bad");
        s.pendingEvent = "starsea_a1_open";
        this._retryAfterLoss = "starsea_a1_open";
      }
    } else if (meta.type === "ss_leitai") {
      // 初入星海·一③ 镇妖台擂台 1v1（藏拙叙事·筑基压炼气八层）——胜得居留，藏拙故不扬名（不 addFame）
      if (win) {
        State.setFlag("starsea_leitai_done");
        State.setFlag("kuixing_resident");
        this.writeLedger("starsea_leitai_won", "初入星海·镇妖台擂台——韩立藏拙佯作苦战，以「炼气五层」之姿险胜炼气八层打手，替顾家夺下经商权，换得魁星岛居留。露而不显，正是凡人韩立的火候。");
        this.addMilestone("初入星海·擂台藏拙：助顾家、得魁星岛居留", "starsea");
        this.log("你「踉跄」着一招制胜，台下哗然。顾家如愿，居留玉牌到手——而人人只当你是个运气尚可的落难散修。藏拙，成了。", "good");
        if (typeof Sfx !== "undefined") Sfx.play("success");
        s.storyStage += 1;
        this.checkStory();
      } else {
        s.flags.losses_ss_leitai = (s.flags.losses_ss_leitai || 0) + 1;
        const bonus = Math.min(3, s.flags.losses_ss_leitai) * 8;
        s.hp = s.hpMax;
        s.demon = clamp(s.demon + 6, 0, 100);
        this.log(`藏拙的分寸没拿稳，险些「真」输了这场——你调息再上，重新拿捏那「将败未败」的火候（再战伤害+${bonus}%）。`, "bad");
        s.pendingEvent = "starsea_a1_leitai";
        this._retryAfterLoss = "starsea_a1_leitai";
      }
    } else if (meta.type === "ss_yingli") {
      // 初入星海·二③ 镇妖大典·极限斩杀婴鲤兽（sides[冯三娘＋曲魂]＋waves＋fieldCycle＋越阶）——胜得降尘丹·夺彩扬名
      if (win) {
        State.setFlag("starsea_yingli_done");
        if (State.count("jiangchen_dan") < 1) State.give("jiangchen_dan", 1);
        this.writeLedger("starsea_yingli_won", "镇妖大典·极限斩杀——众修法阵难伤越级五阶婴鲤兽，韩立携曲魂后发，借冯三娘困兽阵图困而后杀，于巨兽力竭一线之机极限斩杀夺彩，得榜首奖『降尘丹』（降一分结丹门槛）。");
        this.addMilestone("镇妖大典夺彩：极限斩杀婴鲤兽，得降尘丹", "starsea");
        this.addFame(8, "镇妖大典·越阶极限斩杀婴鲤兽、夺彩榜首");
        this.log("巨兽轰然倒在血泊里，满场死寂，旋即爆出震天喝彩。降尘丹入手——结丹之门，被你撬开了一线。", "good");
        if (typeof Sfx !== "undefined") Sfx.play("success");
        s.storyStage += 1;
        this.checkStory();
      } else {
        s.flags.losses_ss_yingli = (s.flags.losses_ss_yingli || 0) + 1;
        const bonus = Math.min(3, s.flags.losses_ss_yingli) * 8;
        s.hp = s.hpMax;
        s.demon = clamp(s.demon + 6, 0, 100);
        this.log(`婴鲤兽越级之威终究太盛，这一击没能竟全功——你与曲魂退回阵后，再候那困兽力竭的一线之机（再战伤害+${bonus}%）。`, "bad");
        s.pendingEvent = "starsea_a2_yingli";
        this._retryAfterLoss = "starsea_a2_yingli";
      }
    } else if (meta.type === "ss_jiuziling") {
      // 初入星海·二⑥ 救小紫灵·斩逆星盟古长老脱身（objective:survive 护送逃亡＋精英战·曲魂断后）
      if (win) {
        State.setFlag("starsea_jiuziling_done");
        this.meetNpc("wang_ning", "你护下的紫衣小女孩——汪凝，小字紫灵，妙音门遗孤。她死死攥着你的衣袖，那张脸总叫你心头泛起一缕说不清的熟悉。");
        this.writeLedger("starsea_jiuziling_won", "镇妖大典惊变·救小紫灵——妙音门门主夫妇为护女力竭殉难，韩立接住坠落的汪凝，于乱局中越阶斩逆星盟古长老（假丹/筑基巅峰人修）、杀出黑袍合围，携小紫灵脱身。");
        this.addMilestone("大典惊变：救汪凝、斩古长老脱身", "starsea");
        this.addFame(8, "乱星海大典惊变·越阶斩逆星盟古长老、护妙音门遗孤脱身");
        this.log("古长老命门洞穿、颓然坠地。你抄起惊魂未定的小紫灵，趁这滔天乱局，杀出了重围。", "good");
        if (typeof Sfx !== "undefined") Sfx.play("success");
        s.storyStage += 1;
        this.checkStory();
      } else {
        s.flags.losses_ss_jiuziling = (s.flags.losses_ss_jiuziling || 0) + 1;
        const bonus = Math.min(3, s.flags.losses_ss_jiuziling) * 8;
        s.hp = s.hpMax;
        s.demon = clamp(s.demon + 6, 0, 100);
        this.log(`古长老的血遁追命缠得死紧，护住紫灵已是勉力——你将她护在身后，与曲魂背水再撑这一阵（再战伤害+${bonus}%）。撑住，斩了他，杀出去！`, "bad");
        s.pendingEvent = "starsea_a2_jiuziling";
        this._retryAfterLoss = "starsea_a2_jiuziling";
      }
    } else if (meta.type === "ss_waihai") {
      // 初入星海·三② 外星海·霓裳草引妖·噬金虫群猎杀（致富妖丹线·噬金虫四用法实战）——胜得乱星海妖丹（结丹资粮·硬通货）
      if (win) {
        State.setFlag("starsea_zhifu_done");
        State.give("xinghai_yaodan", 34);   // 结丹关 consume×30 + 余裕（连斩积丹·一笔进项的代表战）
        State.give("lingshi", 8);
        this.writeLedger("starsea_zhifu_won", "外星海发家——霓裳草引妖、噬金虫群缠（附体/出战/变武器/变身外化身四用法共池取舍），连斩中阶海妖、剖取乱星海妖丹。妖丹乃星海硬通货，韩立自此积起结丹资粮。");
        this.addMilestone("外星海致富：噬金虫群猎积妖丹（结丹资粮）", "starsea");
        this.addFame(6, "外星海猎场·噬金虫群猎中阶海妖、积妖丹发家");
        this.log("两头海妖先后沉入碧波，妖丹剖出、温润生光。三十余颗乱星海妖丹入囊——星海的硬通货，结丹的资粮，你算是攒下了第一桶金。", "good");
        if (typeof Sfx !== "undefined") Sfx.play("success");
        s.storyStage += 1;
        this.checkStory();
      } else {
        s.flags.losses_ss_waihai = (s.flags.losses_ss_waihai || 0) + 1;
        const bonus = Math.min(3, s.flags.losses_ss_waihai) * 8;
        s.hp = s.hpMax;
        s.demon = clamp(s.demon + 6, 0, 100);
        this.log(`海妖凶蛮、群起反扑，这一趟险些反被它们拖入深海——你调息再引霓裳草、重放噬金虫群困而后杀（再战伤害+${bonus}%）。妖丹到手前，绝不能让它遁了。`, "bad");
        s.pendingEvent = "starsea_a3_waihai";
        this._retryAfterLoss = "starsea_a3_waihai";
      }
    } else if (meta.type === "xh_xiedao") {
      // 星海飞驰·2-A 蝎岛团战（妙音门 vs 隐煞门·紫灵/客卿×2/曲魂并肩）——胜→紫灵做局（2-B）
      if (win) {
        State.setFlag("xh_a2_xiedao_done");
        this.writeLedger("xh_a2_xiedao_won", "蝎岛之战——随妙音门强攻隐煞门据点，紫灵居中调度、两客卿正面牵制，韩立携曲魂自侧翼荡平隐煞门弟子。乱军中赵峥趁隙'撤退'，玄机已伏。");
        this.addMilestone("星海飞驰·蝎岛团战：荡平隐煞门弟子", "xinghaifeichi");
        this.log("隐煞门的阵列被生生撕开、溃散——蝎岛之战，妙音门胜了这一场。可那'撤退'的赵峥，紫灵似乎并不急着追……", "good");
        if (typeof Sfx !== "undefined") Sfx.play("success");
        s.storyStage += 1;
        this.checkStory();
      } else {
        s.flags.losses_xh_xiedao = (s.flags.losses_xh_xiedao || 0) + 1;
        const bonus = Math.min(3, s.flags.losses_xh_xiedao) * 8;
        s.hp = s.hpMax;
        s.demon = clamp(s.demon + 6, 0, 100);
        this.log(`隐煞门弟子结阵死缠，一时撕不开口子——你与曲魂退半步、重整攻势（再战伤害+${bonus}%）。妙音门两位客卿还在牵制，再压上去！`, "bad");
        s.pendingEvent = "xh_a2_xiedao";
        this._retryAfterLoss = "xh_a2_xiedao";
      }
    } else if (meta.type === "xh_zhaozheng") {
      // 星海飞驰·2-C 击杀赵峥（削弱版叛徒）——胜→极阴现身（2-D）
      if (win) {
        State.setFlag("xh_a2_zhaoyu_done");
        this.meetNpc("zhao_zheng", "妙音门勾结极阴岛的叛徒客卿——被紫灵设局暗算削弱，伏诛于韩立之手。");
        this.writeLedger("xh_zhaozheng_slain", "蝎岛·诛赵峥——紫灵的局已成，被暗算削弱、护体寸裂的赵峥困兽犹斗仍难逃一死。妙音门内勾结极阴岛的叛徒，清了一个。");
        this.addMilestone("星海飞驰·诛赵峥（紫灵做局收口）", "xinghaifeichi");
        this.log("赵峥逆乱的真元再也撑不住，颓然倒地——这个勾结极阴岛的叛徒，了结了。", "good");
        if (typeof Sfx !== "undefined") Sfx.play("success");
        s.storyStage += 1;
        this.checkStory();
      } else {
        s.flags.losses_xh_zhaozheng = (s.flags.losses_xh_zhaozheng || 0) + 1;
        const bonus = Math.min(3, s.flags.losses_xh_zhaozheng) * 8;
        s.hp = s.hpMax;
        s.demon = clamp(s.demon + 6, 0, 100);
        this.log(`赵峥困兽犹斗、阴招狠辣，一时没能竟全功——你调息再上（再战伤害+${bonus}%）。他护体已裂，只是空架子，咬住他！`, "bad");
        s.pendingEvent = "xh_a2_zhaozheng";
        this._retryAfterLoss = "xh_a2_zhaozheng";
      }
    } else if (meta.type === "xh_taowang") {
      // 星海飞驰·2-E 逃亡·天都炼傀追杀（survive 6·白玉蜘蛛掩护）——胜→客卿长老·天雷竹（2-F）
      if (win) {
        State.setFlag("xh_a2_taowang_done");
        this.writeLedger("xh_baiyu_zhizhu_use", "蝎岛遁逃——杀赵峥后被结丹中期天都炼傀循气追命，硬拼无益；撑到白玉蜘蛛吐丝迟滞那一瞬，韩立携曲魂遁入海底暗流脱身。");
        this.addMilestone("星海飞驰·逃亡：白玉蜘蛛掩护·遁入海底", "xinghaifeichi");
        this.log("天都炼傀的循气追命被漫天蛛丝缠住那一瞬，你已遁入海底暗流——脱身了。", "good");
        if (typeof Sfx !== "undefined") Sfx.play("success");
        s.storyStage += 1;
        this.checkStory();
      } else {
        s.flags.losses_xh_taowang = (s.flags.losses_xh_taowang || 0) + 1;
        const bonus = Math.min(3, s.flags.losses_xh_taowang) * 8;
        s.hp = s.hpMax;
        s.demon = clamp(s.demon + 6, 0, 100);
        this.log(`天都炼傀追得太急，白玉蜘蛛的蛛丝还差一口气没缠死它——你与曲魂再咬牙撑一阵（再战伤害+${bonus}%）。撑到它被缠住，就走得脱！`, "bad");
        s.pendingEvent = "xh_a2_taowang";
        this._retryAfterLoss = "xh_a2_taowang";
      }
    } else if (meta.type === "xh_guxiushi") {
      // 星海飞驰·S6 古修士洞府练手（石蝶/老胡·青竹蜂云剑首战）——胜→玄骨夺曲魂（6-B）
      if (win) {
        State.setFlag("xh_a4_guxiushi_done");
        this.writeLedger("xh_guxiushi_won", "古修士洞府练手——青竹蜂云剑首战，斩石蝶老胡、破宝室之守。本命法宝之威，初露锋芒。");
        this.addMilestone("星海飞驰·古修士洞府：青竹蜂云剑首战告捷", "xinghaifeichi");
        this.log("石蝶老胡先后倒下——七十二口青竹蜂云剑收发由心，辟邪神雷金光灼灼。本命法宝的第一战，赢得漂亮。", "good");
        if (typeof Sfx !== "undefined") Sfx.play("success");
        s.storyStage += 1;
        this.checkStory();
      } else {
        s.flags.losses_xh_guxiushi = (s.flags.losses_xh_guxiushi || 0) + 1;
        const bonus = Math.min(3, s.flags.losses_xh_guxiushi) * 8;
        s.hp = s.hpMax;
        s.demon = clamp(s.demon + 6, 0, 100);
        this.log(`石蝶刁钻、老胡甲坚，一时没能竟全功——你调息再上（再战伤害+${bonus}%）。青竹蜂云剑在手，没有打不破的局！`, "bad");
        s.pendingEvent = "xh_a4_guxiushi_fight";
        this._retryAfterLoss = "xh_a4_guxiushi_fight";
      }
    } else if (meta.type === "xh_guiyuan") {
      // 星海飞驰·S7 虚天殿第一关·鬼冤之地（辟邪神雷克鬼首秀）——胜→冰火道
      if (win) {
        State.setFlag("xh_a4_guiyuan_done");
        this.writeLedger("xh_guiyuan_won", "虚天殿第一关·鬼冤之地——辟邪神雷专克邪魔鬼物，越级斩鬼王、灭阴灵兽。本命法宝克鬼之威，名副其实。");
        this.addMilestone("虚天殿·第一关：鬼冤之地（辟邪神雷克鬼首秀）", "xinghaifeichi");
        this.log("鬼王在金色神雷中煞气溃散、灰飞烟灭——辟邪神雷克鬼，名不虚传。第一关，过了。", "good");
        if (typeof Sfx !== "undefined") Sfx.play("success");
        s.storyStage += 1;
        this.checkStory();
      } else {
        s.flags.losses_xh_guiyuan = (s.flags.losses_xh_guiyuan || 0) + 1;
        const bonus = Math.min(3, s.flags.losses_xh_guiyuan) * 8;
        s.hp = s.hpMax; s.demon = clamp(s.demon + 6, 0, 100);
        this.log(`鬼王回煞自愈、阴灵难缠，一时没能竟全功——你调息再上（再战伤害+${bonus}%）。辟邪神雷克它们，集中神雷打鬼王！`, "bad");
        s.pendingEvent = "xh_a4_guiyuan"; this._retryAfterLoss = "xh_a4_guiyuan";
      }
    } else if (meta.type === "xh_binghuo") {
      // 星海飞驰·S7 虚天殿第二关·冰火道·铁火蚁群（噬金虫对决）——胜→元瑶·啼魂兽
      if (win) {
        State.setFlag("xh_a4_binghuo_done");
        this.writeLedger("xh_binghuo_won", "虚天殿第二关·冰火道——以噬金虫对耗铁火蚁群、青竹蜂云剑破其熔铁重甲，杀穿熔岩路。");
        this.addMilestone("虚天殿·第二关：冰火道·铁火蚁群（噬金虫对决）", "xinghaifeichi");
        this.log("最后一只铁火蚁被噬金虫群吞没——熔岩路杀穿了。前方似有打斗声传来……", "good");
        if (typeof Sfx !== "undefined") Sfx.play("success");
        s.storyStage += 1;
        this.checkStory();
      } else {
        s.flags.losses_xh_binghuo = (s.flags.losses_xh_binghuo || 0) + 1;
        const bonus = Math.min(3, s.flags.losses_xh_binghuo) * 8;
        s.hp = s.hpMax; s.demon = clamp(s.demon + 6, 0, 100);
        this.log(`铁火蚁甲坚难破、火毒缠身，一时杀不透——你调息再上（再战伤害+${bonus}%）。噬金虫附体抗咬、化刃破甲，再冲！`, "bad");
        s.pendingEvent = "xh_a4_binghuo"; this._retryAfterLoss = "xh_a4_binghuo";
      }
    } else if (meta.type === "xh_xuangu_fight") {
      // 星海飞驰·S9 玄骨终战（survive·修罗圣火失控+啼魂收尾·以下克上）——胜→虚天殿收获
      if (win) {
        State.setFlag("xh_a4_xuangu_fight_done");
        this.writeLedger("xh_xuangu_kill", "玄骨终战——撑到修罗圣火与曲魂身躯相冲失控自毁，韩立以粘火飞剑补刀、啼魂兽吞食残魂，斩前元婴后期玄骨（萧诧）。以下克上的两大底牌（辟邪神雷克鬼道+啼魂兽收残魂）兑现。曲魂之仇，了结。");
        this.settleLedger("xh_xuangu_react", "当初眼睁睁看曲魂被夺时你那一念——是暴怒劈雷露了底，是藏拙示弱诱他轻敌，还是忍痛退走——都在今日这一战玄骨的备防与破绽里，结成了了断的果。");
        this.addMilestone("玄骨终战·以下克上（斩前元婴后期·全章最高潮）", "medal");
        this.log("修罗圣火失控、玄骨灰飞烟灭，啼魂兽吞下最后那缕残魂——这个夺你曲魂的鬼骷髅，彻底消亡了。结丹初期斩前元婴后期，以下克上！", "good");
        if (typeof Sfx !== "undefined") Sfx.play("success");
        s.storyStage += 1;
        this.checkStory();
      } else {
        s.flags.losses_xh_xuangu = (s.flags.losses_xh_xuangu || 0) + 1;
        const bonus = Math.min(3, s.flags.losses_xh_xuangu) * 8;
        s.hp = s.hpMax; s.demon = clamp(s.demon + 8, 0, 100);
        this.log(`修罗圣火太盛、玄骨太强，没能撑到他自毁那一刻——你浴血整顿、备齐底牌再战（再战伤害+${bonus}%）。辟邪神雷克他、啼魂兽护你、皇鳞甲挡命——撑住八回合，他必自焚！`, "bad");
        s.pendingEvent = "xh_a4_xuangu_fight"; this._retryAfterLoss = "xh_a4_xuangu_fight";
      }
    } else if (meta.type === "xh_lingyuling") {
      // 星海飞驰·S10 救凌玉灵（护送 survive·星宫关系种子）——胜→外星海闭关
      if (win) {
        State.setFlag("xh_a5_lingyuling_done");
        this.meetNpc("ling_yuling", "星宫双圣之女——出殿途中被外海妖兽围困、为韩立所救，星宫关系线的种子。");
        this.writeLedger("ling_yuling_saved", "出殿·救凌玉灵——护星宫双圣之女撑过外海妖兽围攻，结下星宫关系线（外海风云篇星宫双圣之缘）。");
        this.addMilestone("星海飞驰·救凌玉灵（星宫关系种子）", "xinghaifeichi");
        this.log("妖兽退散，凌玉灵脱险——星宫双圣之女承你救命之情。这份善缘，日后自有回响。", "good");
        if (typeof Sfx !== "undefined") Sfx.play("success");
        s.storyStage += 1;
        this.checkStory();
      } else {
        s.flags.losses_xh_lingyuling = (s.flags.losses_xh_lingyuling || 0) + 1;
        const bonus = Math.min(3, s.flags.losses_xh_lingyuling) * 8;
        s.hp = s.hpMax; s.demon = clamp(s.demon + 4, 0, 100);
        this.log(`妖兽扑得太急，护人有些手忙脚乱——你调息再上（再战伤害+${bonus}%）。清开她近身的妖兽，撑住 4 回合！`, "bad");
        s.pendingEvent = "xh_a5_lingyuling"; this._retryAfterLoss = "xh_a5_lingyuling";
      }
    } else if (meta.type === "xh_haiwang") {
      // 星海飞驰·S10 海王兽斩杀（战力验证·碾压·章末扬眉）——胜→四大势力追杀（章末钩）
      if (win) {
        State.setFlag("xh_a5_haiwang_done");
        this.writeLedger("xh_haiwang_won", "外星海出关·斩七级海王兽——开篇要逃的对手，如今结丹中期+青竹蜂云剑从容碾压。对比开篇的挣扎，章末扬眉吐气。");
        this.addMilestone("星海飞驰·海王兽斩杀（结丹中期从容碾压·章末扬眉）", "xinghaifeichi");
        this.addFame(8, "外星海·结丹修士韩立轻取七级海王兽");
        this.log("海王兽庞大的躯体沉入碧波——七级妖兽，今日于你不过探囊取物。这一身脱胎换骨，对得起虚天殿那一趟九死一生。", "good");
        if (typeof Sfx !== "undefined") Sfx.play("success");
        s.storyStage += 1;
        this.checkStory();
      } else {
        s.flags.losses_xh_haiwang = (s.flags.losses_xh_haiwang || 0) + 1;
        const bonus = Math.min(3, s.flags.losses_xh_haiwang) * 8;
        s.hp = s.hpMax; s.demon = clamp(s.demon + 4, 0, 100);
        this.log(`海王兽到底是七级巨妖，一时大意没拿稳——你调息再上（再战伤害+${bonus}%）。青竹蜂云剑+辟邪神雷俱全，碾过去！`, "bad");
        s.pendingEvent = "xh_a5_haiwang"; this._retryAfterLoss = "xh_a5_haiwang";
      }
    } else if (meta.type === "breakthrough") {
      // 心战收束的道心余裕=这次突破的"水准"（刻进气海的永久差异）
      this._resolveBreakthroughResult(win, c.player.hpMax > 0 ? c.player.hp / c.player.hpMax : 0);
    }
    this._combat = null;
    this._combatMeta = null;
    // 安全网：无论上面哪条分支走了 return 或抛异常，确保战斗 overlay 被清除
    if (typeof UI !== "undefined" && UI.closeCombat) UI.closeCombat();
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
    if (crop.gateFlag && !(s.flags && s.flags[crop.gateFlag])) { this.toast("此谱尚未参透"); return; }
    if ((s.realmIndex || 0) < (crop.minRealmIdx || 0)) { this.toast("境界未到，参不透此谱"); return; }
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
   *  符箓自制（制符 v2，combat-arsenal-design.md §3.7）
   *  复用：符纸(fu_zhi)＝可买消耗品；方案＝大件图鉴可解锁配方；
   *        制作＝有方案 + 符纸 + 灵力 → 成（无绘画、无材料 grind）。
   * =========================================================== */
  hasFuluTable() { return State.count("zhifu_bi") > 0; },
  learnFuluPlan(planId, srcText) {
    const s = State.data;
    const plan = DATA.fuluPlans[planId];
    if (!plan) return false;
    if (!s.fuluPlans) s.fuluPlans = [];
    if (s.fuluPlans.includes(planId)) { this.toast(`已掌握「${plan.name}」`); return false; }
    s.fuluPlans.push(planId);
    this.log(`【符箓方案】你参得「${plan.name}」——${srcText || "他日持制符笔、备符纸灵力，便可自画此符。"}`, "good");
    this.addMilestone(`习得符箓方案：${plan.name}`, "bigitem");
    if (typeof Sfx !== "undefined") Sfx.play("chime");
    State.save();
    UI.renderAll();
    return true;
  },
  makeFulu(planId) {
    const s = State.data;
    const plan = DATA.fuluPlans[planId];
    if (!plan) return;
    if (!this.hasFuluTable()) { this.toast("尚无制符笔，开不得制符台"); return; }
    if (!(s.fuluPlans || []).includes(planId)) { this.toast("尚未参透此符方案"); return; }
    const paperN = plan.paperN || 1;
    if (State.count(plan.paper) < paperN) { this.toast(`缺少${DATA.items[plan.paper].name}（需${paperN}）`, true); return; }
    if (s.spirit < plan.spirit) { this.toast("灵力不足以运笔成符", true); return; }
    State.take(plan.paper, paperN);
    s.spirit = clamp(s.spirit - plan.spirit, 0, State.realm().spMax);
    if (!s.skills) s.skills = { alchemy: 0, scouting: 0, fulu: 0 };
    if (s.skills.fulu == null) s.skills.fulu = 0;
    const rate = Math.min(0.97, 0.6 + (s.skills.fulu || 0) * 0.02 + (s.insight || 0) * 0.01);
    s.skills.fulu += 2;
    const item = DATA.items[plan.result];
    if (Math.random() < rate) {
      const dblChance = Math.min(0.3, (s.skills.fulu || 0) * 0.012);
      const n = Math.random() < dblChance ? 2 : 1;
      State.give(plan.result, n);
      this.log(`你以灵力运笔，符纸上灵光一显——「${item.name}」${n > 1 ? `×${n} ` : ""}制成。（制符术+2，现 ${s.skills.fulu}）`, "good");
      if (typeof Sfx !== "undefined") Sfx.play("bell");
    } else {
      this.log(`运笔时灵力一滞，符纹溃散——一张符纸就此作废。（制符术+2，现 ${s.skills.fulu}）`, "bad");
    }
    this._checkSkillMilestones("fulu");
    State.save();
    UI.renderAll();
    if (typeof UI.openFuluCraft === "function") UI.openFuluCraft();
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
    if (!next) return false;
    // 阶段 0 无 cond，直接触发；其余需满足 cond
    if (next.cond && !next.cond(s)) return false;
    // 地点门禁：若该阶段指定了触发地点，须身在其处（开放世界——走到对的地方剧情才发生）
    if (next.where && next.where !== s.location) return false;
    this.playStage(next);
    return true;
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
    // text/choices 可为函数（按 state 动态生成）——选项钩子的基础设施
    const resolved = (typeof stage.text === "function" || typeof stage.choices === "function")
      ? Object.assign({}, stage, {
          text: typeof stage.text === "function" ? stage.text(s) : stage.text,
          choices: typeof stage.choices === "function" ? stage.choices(s) : stage.choices,
        })
      : stage;
    UI.renderStory(resolved);
    State.save();
    UI.renderAll();
  },
  /* ============================================================
   * D1-a 直接坠入·薄封装：演出落幕 → 直挂既有战斗/箱庭，跳过「临战准备」选择屏。
   *   不新增任何战斗逻辑——startFight(id) 仅按 id→fn 路由表 switch 到既有 startXxxFight()。
   *   id 取既有 choice.resolve 名（战斗派发的单一事实源），另收几个短别名兼容剧本写法。
   *   返回 true=已派发；false=未知 id（调用方 fail-soft 退回选择屏，等价旧行为、零回归）。
   * ============================================================ */
  _fightRoutes() {
    if (this.__fightRoutes) return this.__fightRoutes;
    // encounter 型：统一经 startEncounterFight(type)，before 钩子布置 _nextFightType 之外的临场参数
    const enc = (type, before) => function () {
      this._nextFightType = type;
      if (before) before.call(this);
      this.startEncounterFight(type);
      this._caveFightCfg = null;     // 用过即清（仅 xuanle/xueyu 会设；其余本就为空）
    };
    const caveCfg = () => (typeof Art !== "undefined" && Art.has && Art.has("pano_kuangdong"))
      ? { sceneBg: "pano_kuangdong", seamless: true } : null;
    return (this.__fightRoutes = {
      // 决战墨大夫（真实三阶段战斗）
      showdown_win:  function () { this.startShowdownFight(); },
      showdown_risk: function () { this.startShowdownFight(); },
      showdown:      function () { this.startShowdownFight(); },   // 别名（剧本简写）
      // 反杀金光上人
      jinguang_win:  function () { this.startJinguangFight(); },
      jinguang:      function () { this.startJinguangFight(); },
      // 复仇 / 同道并肩
      revenge_fight:   function () { this.startRevengeFight(); },
      wan_hunt_fight:  function () { this.startWanHunt(); },
      luyunfeng_fight: function () { this.startLuyunfengFight(); },
      // encounter 型（含临场布景/侧援）
      fengyue_fight:      enc("fengyue"),
      mojiao_fight:       enc("mojiao", function () { this._sideOverride = this._nangongwanAlly(); }),
      zhanwangchan_fight: enc("zhanwangchan"),
      zhanwangchan:       enc("zhanwangchan"),                     // 别名（战王蝉）
      xuanle_fight:       enc("xuanle",       function () { this._caveFightCfg = caveCfg(); }),
      xueyu_zhizhu_fight: enc("xueyu_zhizhu", function () { this._caveFightCfg = caveCfg(); }),
      tieluo_fight:       enc("tieluo"),
      tieluo2_fight:      enc("tieluo_mao"),
      wuse_fight:         enc("wuse_menzhu"),
      // 专用战斗入口
      moxiu_patrol_fight: function () { this._nextFightType = "patrol"; this.startPatrolFight(); },
      santuan_fight:      function () { this.startSantuanFight(); },
      tuoshi_fight:       function () { this.startTuoshiFight(); },
      xuwang_final_fight: function () { this.startXuwangFight(); },
      jinbei_fight:    function () { this.startJinbeiFight(); },
      duoshe_fight:    function () { this.startDuosheFight(); },
      jingu_fight:     function () { this.startJinguFight(); },
      hushan_fight:    function () { this.startHushanFight(); },
      hudao_fight:     function () { this.startHudaoFight(); },
      kuangdong_fight: function () { this.startKuangdongFight(); },
      starsea_yaoshou_fight:   function () { this.startStarseaYaoshouFight(); },
      starsea_leitai_fight:    function () { this.startStarseaLeitaiFight(); },
      starsea_yingli_fight:    function () { this.startStarseaYingliFight(); },
      starsea_jiuziling_fight: function () { this.startStarseaJiuzilingFight(); },
      starsea_waihai_fight:    function () { this.startStarseaWaihaiFight(); },
      xh_xiedao_fight:         function () { this.startXhXiedaoFight(); },
      xh_zhaozheng_fight:      function () { this.startXhZhaozhengFight(); },
      xh_taowang_fight:        function () { this.startXhTaowangFight(); },
      xh_guxiushi_fight:       function () { this.startXhGuxiushiFight(); },
      xh_guiyuan_fight:        function () { this.startXhGuiyuanFight(); },
      xh_binghuo_fight:        function () { this.startXhBinghuoFight(); },
      xh_xuangu_fight:         function () { this.startXhXuanguFight(); },
      xh_lingyuling_fight:     function () { this.startXhLingyulingFight(); },
      xh_haiwang_fight:        function () { this.startXhHaiwangFight(); },
    });
  },
  hasFight(id) { return !!(id && this._fightRoutes()[id]); },
  startFight(id) {
    const fn = id && this._fightRoutes()[id];
    if (!fn) return false;                 // 未知 id：交回调用方 fail-soft 退回旧选择屏
    State.data.pendingEvent = null;
    try { fn.call(this); } catch (e) { return false; }
    return true;
  },

  // 从舞台坠入战斗（可继承轴位置——snap={W,units,hotspots,preps}）
  // 目前直接路由到 startFight；后续可在 snap 中提取位置信息传给战斗构造函数
  startFightFromStage(id, snap) {
    // snap 保留位：后续可把轴上的单位位置/布置/热点带入战斗初始状态
    return this.startFight(id);
  },

  /* —— D1-a 直接坠入·地点/箱庭（薄封装，复用既有地点系统）——
   *   与 travelTo 区别：剧情驱动的"坠入"，不耗赶路时月、不计遁速（演出已交代位移）。
   *   目标地点不存在 → 返回 false（调用方 fail-soft 退回选择屏）。
   *   opts.spot=箱庭内据点（保留位，D2 抵达据点演出实装后接）；opts.arrive=触发抵达演出（保留位）。 */
  canWarp(locId) {
    return !!(locId && typeof WORLD !== "undefined" && WORLD.locations && WORLD.locations.some(l => l.id === locId));
  },
  gotoLocation(locId, opts) {
    opts = opts || {};
    const s = State.data;
    if (s.combat) return false;
    const loc = (typeof WORLD !== "undefined" && WORLD.locations) ? WORLD.locations.find(l => l.id === locId) : null;
    if (!loc) return false;                // 未知目标：fail-soft
    s.pendingEvent = null;
    s.location = locId;
    this.log(`你来到「${loc.name}」。${loc.desc || ""}`, "event");
    if (typeof this._resolveLeadsAt === "function") this._resolveLeadsAt(locId);
    this.checkLifespan();
    this.checkStory();
    State.save();
    UI.renderAll();
    return true;
  },

  // 玩家在剧情选项上做出选择
  chooseStory(stage, choiceIndex) {
    const s = State.data;
    if (!stage || !stage.choices || choiceIndex < 0 || choiceIndex >= stage.choices.length) {
      this.toast("选项无效"); return;
    }
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
      if (r.text) { this.log(r.text, r.kind || "event"); this.toast(r.text, r.kind === "bad"); }
    }

    // 复仇战：万小山之仇（三散修——同阶之争你无敌；第三人遁走是远雷）
    if (choice.resolve === "revenge_fight") {
      s.pendingEvent = null;
      this.startRevengeFight();
      return;
    }
    // 复仇·退去后山备货（破"无底牌→打不过也跑不掉"死局：给真出口，韩立的道本就是万全准备）
    if (choice.resolve === "revenge_prep") {
      if (!s.flags.revenge_prepped) {
        State.setFlag("revenge_prepped");
        State.give("duyao_cao", 3);
        State.give("anqi", 3);
        this.log("你强压杀意，退入太南山后山——三日间寻得毒草、淬足飞针（毒草+3、暗器+3）。调息既毕，伤势已敷。", "good");
      } else {
        s.hp = s.hpMax;
        this.log("你再退一步，调息敷伤、清点底牌，定了定神。", "event");
      }
      s.hp = s.hpMax;
      s.pendingEvent = "wan_death";
      State.save();
      UI.renderAll();
      this._retryStage = true;
      const stage = STORY.find(st => st.id === "wan_death") || STORY[s.storyStage];
      try { UI.renderStory(stage); }
      catch (e) { this._retryStage = false; UI.renderStory(stage); }
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
    // 战王蝉之战（增量D·燕家堡之战大BOSS：撑过血线即剧情撤离，本战不诛杀）
    if (choice.resolve === "zhanwangchan_fight") {
      s.pendingEvent = null;
      this._nextFightType = "zhanwangchan";
      this.startEncounterFight("zhanwangchan");
      return;
    }
    // 宣乐之战（增量E·矿洞黑吃黑：阴手敌型首演，识破偷袭→反杀）
    // 矿洞坑道开战：长卷全景做底（L3 战斗轴横移长背景），镜头一沉推近——开战不换天地
    if (choice.resolve === "xuanle_fight") {
      s.pendingEvent = null;
      this._nextFightType = "xuanle";
      this._caveFightCfg = (typeof Art !== "undefined" && Art.has && Art.has("pano_kuangdong"))
        ? { sceneBg: "pano_kuangdong", seamless: true } : null;
      this.startEncounterFight("xuanle");
      this._caveFightCfg = null;
      return;
    }
    // 血玉蜘蛛之战（增量E·矿洞最深处四级蛛妖：封印松脱狂化·单形态 boss）
    if (choice.resolve === "xueyu_zhizhu_fight") {
      s.pendingEvent = null;
      this._nextFightType = "xueyu_zhizhu";
      this._caveFightCfg = (typeof Art !== "undefined" && Art.has && Art.has("pano_kuangdong"))
        ? { sceneBg: "pano_kuangdong", seamless: true } : null;
      this.startEncounterFight("xueyu_zhizhu");
      this._caveFightCfg = null;
      return;
    }
    // 金鼓原巡逻遭遇战（增量F·魔修小队 pack 阵型练兵场：擒贼先擒王，七派同袍武炫并肩）
    if (choice.resolve === "moxiu_patrol_fight") {
      s.pendingEvent = null;
      this._nextFightType = "patrol";
      this.startPatrolFight();
      return;
    }
    // 京城暗流·血侍铁罗·一阶段（增量G·二阶段演出·一：硬战逼入绝境→断其一臂→化血茧）
    if (choice.resolve === "tieluo_fight") {
      s.pendingEvent = null;
      this.startEncounterFight("tieluo");
      return;
    }
    // 京城暗流·血茧铁罗·二阶段（增量G·二阶段演出·二：化茧狂暴大战→败后蜕茧遁走，仇恨账本跨场）
    if (choice.resolve === "tieluo2_fight") {
      s.pendingEvent = null;
      this.startEncounterFight("tieluo_mao");
      return;
    }
    // 京城暗流·五色门收口（增量G·妖化王管事，为墨彩环报仇·墨府之祸总兑现）
    if (choice.resolve === "wuse_fight") {
      s.pendingEvent = null;
      this.startEncounterFight("wuse_menzhu");
      return;
    }
    // 皇宫决战开幕·三组对位群架（增量H·第四幕：sides[] 复数化首演——三同袍 vs 血侍×3）
    if (choice.resolve === "santuan_fight") {
      s.pendingEvent = null;
      this.startSantuanFight();
      return;
    }
    // 皇宫决战·拖时布阵战（增量H下：survive 拖满回合机制首演——撑到师兄妹布成颠倒五行阵）
    if (choice.resolve === "tuoshi_fight") {
      s.pendingEvent = null;
      this.startTuoshiFight();
      return;
    }
    // 皇宫决战·阵成决战（增量H下：颠倒五行阵 fieldCycle 逐回合压制 + 二阶段假丹 boss waves）
    if (choice.resolve === "xuwang_final_fight") {
      s.pendingEvent = null;
      this.startXuwangFight();
      return;
    }
    // —— 再别天南篇战斗派发 ——
    if (choice.resolve === "jinbei_fight")   { s.pendingEvent = null; this.startJinbeiFight();   return; }
    if (choice.resolve === "duoshe_fight")   { s.pendingEvent = null; this.startDuosheFight();   return; }
    if (choice.resolve === "jingu_fight")    { s.pendingEvent = null; this.startJinguFight();    return; }
    if (choice.resolve === "hushan_fight")   { s.pendingEvent = null; this.startHushanFight();   return; }
    if (choice.resolve === "hudao_fight")    { s.pendingEvent = null; this.startHudaoFight();    return; }
    if (choice.resolve === "kuangdong_fight"){ s.pendingEvent = null; this.startKuangdongFight();return; }
    // —— 初入星海篇·第一/二幕战斗派发（增量5）——
    if (choice.resolve === "starsea_yaoshou_fight")  { s.pendingEvent = null; this.startStarseaYaoshouFight();  return; }
    if (choice.resolve === "starsea_leitai_fight")   { s.pendingEvent = null; this.startStarseaLeitaiFight();   return; }
    if (choice.resolve === "starsea_yingli_fight")   { s.pendingEvent = null; this.startStarseaYingliFight();   return; }
    if (choice.resolve === "starsea_jiuziling_fight"){ s.pendingEvent = null; this.startStarseaJiuzilingFight();return; }

    // —— 初入星海篇·第三幕战斗派发（增量6·外星海致富·噬金虫四用法实战）——
    if (choice.resolve === "starsea_waihai_fight")   { s.pendingEvent = null; this.startStarseaWaihaiFight();   return; }

    // —— 星海飞驰篇·S2 蝎岛之战战斗派发 ——
    if (choice.resolve === "xh_xiedao_fight")    { s.pendingEvent = null; this.startXhXiedaoFight();    return; }
    if (choice.resolve === "xh_zhaozheng_fight") { s.pendingEvent = null; this.startXhZhaozhengFight(); return; }
    if (choice.resolve === "xh_taowang_fight")   { s.pendingEvent = null; this.startXhTaowangFight();   return; }
    if (choice.resolve === "xh_guxiushi_fight")  { s.pendingEvent = null; this.startXhGuxiushiFight();  return; }
    if (choice.resolve === "xh_guiyuan_fight")   { s.pendingEvent = null; this.startXhGuiyuanFight();   return; }
    if (choice.resolve === "xh_binghuo_fight")   { s.pendingEvent = null; this.startXhBinghuoFight();   return; }
    if (choice.resolve === "xh_xuangu_fight")    { s.pendingEvent = null; this.startXhXuanguFight();    return; }
    if (choice.resolve === "xh_lingyuling_fight"){ s.pendingEvent = null; this.startXhLingyulingFight();return; }
    if (choice.resolve === "xh_haiwang_fight")   { s.pendingEvent = null; this.startXhHaiwangFight();   return; }

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
      <p style="color:var(--gold)">离门远行 · 启——寒毒在身，先南下嘉元城墨府（点「舆图」→ 胥国 → 嘉元城 → 启程）。</p>
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
    const s = State.data;
    // —— 我的修仙人生·终章总结：一缕道心散尽前，把这一生挣来的都摆出来给玩家看 ——
    // 复用既有数据（境界/年表/伏诛/名声/心性/世间众生），不新增存档字段。
    const realm = (State.realm && State.realm()) ? State.realm().name : "凡夫";
    const yrs = (s.year || 1);
    // 一生几桩"质变/大件/勋章"——年表里挑分量最重的几条作墓志（按 kind 权重，取前 6）
    const KIND_RANK = { breakthrough: 5, bigitem: 4, showdown: 4, medal: 3, story: 2, deed: 1, minor: 0 };
    const KIND_ICON = { breakthrough: "▲", bigitem: "◆", showdown: "⚔", medal: "★", story: "◇", deed: "·", minor: "·" };
    const ms = (s.milestones || []).slice();
    const topMs = ms.map((m, i) => ({ m, i }))
      .sort((a, b) => ((KIND_RANK[b.m.kind] || 0) - (KIND_RANK[a.m.kind] || 0)) || (b.i - a.i))
      .slice(0, 6)
      .sort((a, b) => a.i - b.i)
      .map(x => x.m);
    const msHtml = topMs.length
      ? topMs.map(m => `<div class="chron-item breakthrough"><span class="chron-t">${m.t}</span><b>${KIND_ICON[m.kind] || "·"} ${m.title}</b></div>`).join("")
      : `<div class="inv-empty">道途尚浅，来不及在世间留下痕迹。</div>`;
    const slain = (s.slainBeasts || []).length;
    const fame = s.fame || 0;
    const fameTxt = fame >= 30 ? "威名赫赫，一方人物" : fame >= 12 ? "薄有名声，渐为人知" : fame > 0 ? "略有耳闻，籍籍之间" : "默默无名，无人记得";
    const te = (this.temperamentEcho && this.temperamentEcho()) || null;
    // 世间众生：你走后，故人各自的命数（活着的/已殁的）——"你离开，世界不会停"
    const fates = (s.npcFates || []);
    const aliveN = fates.filter(f => f.status === "alive").length;
    const deadN = fates.filter(f => f.status === "dead").length;
    const worldTxt = fates.length
      ? `你身后，世间故人${aliveN ? `尚有 ${aliveN} 人各奔前程` : ""}${deadN ? `${aliveN ? "，" : ""}${deadN} 人已先你而去` : ""}。江湖照旧，只是再没有你。`
      : "";
    UI.openModal(`
      <h2>我的修仙人生 · 终</h2>
      <p style="color:var(--ink-dim);line-height:1.7">${reason}</p>
      <div class="ending-epitaph">
        <div class="ending-line"><span>姓名</span><b>${s.name || "韩立"}</b></div>
        <div class="ending-line"><span>止步</span><b style="color:var(--gold)">${realm}</b></div>
        <div class="ending-line"><span>享年</span><b>${s.age || 13} 岁 · 修行 ${yrs} 载</b></div>
        <div class="ending-line"><span>名望</span><b>${fameTxt}</b></div>
        ${slain ? `<div class="ending-line"><span>伏诛</span><b>异闻妖王 ${slain} 头</b></div>` : ""}
      </div>
      ${te ? `<h3 class="panel-title" style="margin-top:12px">心性 · 你是谁</h3><div class="temperament-echo temperament-${te.tone}">${te.text}</div>` : ""}
      <h3 class="panel-title" style="margin-top:12px">此生几桩 · 你挣来的</h3>
      <div class="chronicle">${msHtml}</div>
      ${worldTxt ? `<p style="color:var(--ink-faint);font-size:12px;margin-top:10px">${worldTxt}</p>` : ""}
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
