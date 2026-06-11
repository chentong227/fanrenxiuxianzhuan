/* ============================================================
 * ui.js — 渲染与界面交互
 * ============================================================ */

const UI = {
  el(id) { return document.getElementById(id); },

  /* -------- 全量渲染 -------- */
  renderAll() {
    this.renderStats();
    this.renderInventory();
    this.renderTopbar();
    this.renderLocation();
    this.renderActions();
    this.renderObjective();
    this.renderRecentLog();
  },

  // 行动页"刚刚发生"反馈条：最新一条见闻的摘要（修复行动/见闻分屏割裂）
  renderRecentLog() {
    const box = this.el("recent-log");
    if (!box) return;
    const log = (State.data && State.data.log) || [];
    const side = this._sideStrip();
    if (!log.length && !side) { box.innerHTML = ""; box.style.display = "none"; return; }
    let html = side;
    if (log.length) {
      const last = log[log.length - 1];
      const tmp = document.createElement("div");
      tmp.innerHTML = last.body || "";
      let txt = (tmp.textContent || "").trim().replace(/\s+/g, " ");
      if (txt.length > 64) txt = txt.slice(0, 64) + "…";
      html += `<span class="rl-tag">${last.t}</span><span class="rl-txt entry-${last.kind || 'event'}">${txt}</span><span class="rl-more">见闻 ›</span>`;
    }
    box.style.display = "";
    box.innerHTML = html;
  },

  // 侧位随行条：尸傀状态+随行开关+修缮（曲魂幡御尸——挚友之尸，为你而战）
  _sideStrip() {
    const u = State.data && State.data.sideUnit;
    if (!u) return "";
    const broken = u.status === "broken";
    const st = broken ? `<span style="color:var(--red)">损毁</span>`
      : `${u.hp}/${u.hpMax}${u.carry === false ? "（留守）" : "（随行）"}`;
    const btn = broken || u.hp < u.hpMax
      ? `<button class="btn btn-mini" onclick="event.stopPropagation();Engine.repairSide()">修缮（毒草×2·1月）</button>`
      : `<button class="btn btn-mini" onclick="event.stopPropagation();Engine.toggleSide()">${u.carry === false ? "携行" : "留守"}</button>`;
    return `<div class="side-strip"><span class="ss-name">⚰ ${u.name}</span><span class="ss-st">${st}</span>${btn}</div>`;
  },

  // 手机分页：切换显示哪一栏（stage=界面 / hero=韩立+储物）
  switchMobileTab(tab) {
    const layout = document.querySelector(".layout");
    if (!layout) return;
    layout.setAttribute("data-mtab", tab);
    document.querySelectorAll(".mtab").forEach(t =>
      t.classList.toggle("active", t.dataset.tab === tab));
    // 切到见闻页时定位到最新一条
    if (tab === "stage") this._scrollNarrativeBottom();
    else layout.scrollTop = 0;
  },

  // 际遇栏 · 天命/机缘分区（world-architecture §2：锚与帆）——
  // 玩家永远知道"必须做的"（天命=主线锚/限时任务）和"可以做的"（机缘=风声/异闻/修行）各是什么
  renderObjective() {
    const box = this.el("objective-bar");
    if (!box) return;
    const obj = Engine.currentObjective ? Engine.currentObjective() : null;
    const tasks = Engine.activeTasks ? Engine.activeTasks() : [];
    let fate = "";   // 天命：主线锚、限时剧情任务
    let luck = "";   // 机缘：请托/线索/异闻/修行/涟漪窗口
    if (obj) {
      fate += `<div class="obj-main"><span class="obj-key">天命</span>
        <b>${obj.title}</b><span class="obj-hint">${obj.hint}</span></div>`;
    }
    if (tasks.length) {
      fate += tasks.map(t => {
        const urgent = t.left <= 2;
        return `<div class="obj-task ${urgent ? 'urgent' : ''}">
          <span class="obj-key">限时</span><b>${t.title}</b>
          <span class="obj-prog">${t.progress}</span>
          <span class="obj-left">限 ${t.left} 月</span>
        </div>`;
      }).join("");
    }
    // 动态请托（对谈接下的差事）
    const dq = (State.data && State.data.dynQuests) || [];
    if (dq.length) {
      luck += dq.map(q => {
        const left = Math.max(0, q.dueAbs - State.absMonth());
        const ready = Engine.dynQuestReady ? Engine.dynQuestReady(q) : false;
        return `<div class="obj-task ${left <= 2 ? 'urgent' : ''}">
          <span class="obj-key" style="background:var(--gold);color:#1a1208">请托</span><b>${q.title}</b>
          <span class="obj-prog">${q.fromName}所托</span>
          <span class="obj-left">限 ${left} 月</span>
          ${ready ? `<button class="obj-deliver" onclick="Engine.deliverDynQuest('${q.id}')">交付</button>` : ""}
        </div>`;
      }).join("");
    }
    // 线索（对谈听来的消息）
    const leads = (State.data && State.data.leads) || [];
    if (leads.length) {
      luck += leads.map(l => {
        const wn = (WORLD.locations.find(x => x.id === l.where) || {}).name || "别处";
        return `<div class="obj-task">
          <span class="obj-key" style="background:var(--jade);color:#08140f">线索</span><b>${l.title}</b>
          <span class="obj-prog">指向「${wn}」</span>
        </div>`;
      }).join("");
    }
    // 异闻妖王：听闻在前，深处可猎（一致感微缩循环）
    const sb = State.data;
    if (sb && sb.beastRumor && typeof WORLD !== "undefined" && WORLD.enemies[sb.beastRumor]) {
      luck += `<div class="obj-task urgent" style="border-left-color:var(--cinnabar)">
        <span class="obj-key" style="background:var(--cinnabar);color:#f3e4d8">异闻</span>
        <b>${WORLD.enemies[sb.beastRumor].name}</b>
        <span class="obj-hint">盘踞后山深处——深入探索可猎，伏诛有厚报</span>
      </div>`;
    }
    // 剑意修行链：实战用剑积累，圆满可悟剑（大件范式：明牌进度=惦记）
    const sd = State.data;
    if (sd && !sd.swordMastery && (sd.swordIntent || 0) > 0) {
      const full = sd.swordIntent >= 100;
      luck += `<div class="obj-task">
        <span class="obj-key" style="background:var(--wx-jin);color:#1a1208">修行</span>
        <b>眨眼剑法 · 剑意</b>
        <span class="obj-prog">${sd.swordIntent}/100</span>
        <span class="obj-hint">${full ? "圆满！回药庐闭关「悟剑」" : "切磋、实战出剑可磨剑意"}</span>
      </div>`;
    }
    // 涟漪窗口：限时机会（错过即逝——世界不等人）
    if (sd && sd.rippleWindow) {
      const rw = sd.rippleWindow;
      const left = Math.max(0, rw.dueAbs - State.absMonth());
      const whereTxt = rw.id === "herb_garden" ? "后山" : rw.id === "wolf_bounty" ? "集镇" : rw.id === "cheap_pills" ? "集镇采买" : "";
      luck += `<div class="obj-task ${left <= 1 ? 'urgent' : ''}">
        <span class="obj-key" style="background:var(--cinnabar);color:#f3e4d8">风声</span>
        <b>${rw.note || "限时机会"}</b>
        ${whereTxt ? `<span class="obj-prog">去「${whereTxt}」</span>` : ""}
        <span class="obj-left">余 ${left} 月</span>
      </div>`;
    }
    let html = "";
    if (fate) html += `<div class="obj-sect fate">${fate}</div>`;
    if (luck) html += `<div class="obj-sect luck"><div class="obj-sect-tag">机缘</div>${luck}</div>`;
    box.innerHTML = html;
    box.style.display = html ? "" : "none";
  },

  renderLocation() {
    const loc = State.location();
    if (!loc) return;
    const nm = this.el("loc-name"); if (nm) nm.textContent = loc.name;
    const ds = this.el("loc-desc-inline"); if (ds) ds.textContent = loc.desc;
    this.renderSceneStage(loc);
    this.renderLocals(loc);
  },

  // 场景大图做底，可去之处=图上发光按钮（取代独立小地图）
  renderSceneStage(loc) {
    const bg = this.el("scene-bg");
    const pinsBox = this.el("scene-pins");
    const confirmBox = this.el("scene-confirm");
    if (!bg || !pinsBox) return;
    const s = State.data;

    // 背景图
    const url = (typeof Art !== "undefined") ? Art.locUrl(loc) : null;
    bg.style.backgroundImage = url ? `url("${url}")` : "";
    bg.classList.toggle("has-img", !!url);

    // 过场地点 / 待决剧情 / 战斗：不显示前往按钮（不能乱走）
    if (loc.scene || s.pendingEvent || s.combat) {
      pinsBox.innerHTML = ""; if (confirmBox) confirmBox.innerHTML = "";
      return;
    }

    const arc = Chapters.active().id;
    const cur = s.location;
    const dests = WORLD.locations.filter(l =>
      l.id !== cur && !l.scene && l.map && (!l.arc || l.arc === arc) && (!l.unlock || l.unlock(s)));
    const factor = Balance.travelTimeFactor(State.effectiveSpeed());
    const sel = this._mapSel;

    // 可去之处 → 图上发光按钮（按 map 坐标定位，落在场景图上）
    pinsBox.innerHTML = dests.map(l => {
      const cost = Math.max(1, Math.round((l.travelCost || 2) * factor));
      const seld = (sel === l.id) ? " selected" : "";
      const home = l.home ? " home" : "";
      return `<button class="scene-pin${seld}${home}" style="left:${l.map.x}%;top:${l.map.y}%"
        onclick="UI.selectMapPin('${l.id}')" title="${l.desc}">
        <span class="sp-dot"></span><span class="sp-name">${l.name}</span><span class="sp-cost">${cost}月</span>
      </button>`;
    }).join("");

    // 确认前往条
    if (confirmBox) {
      if (sel && sel !== cur) {
        const l = WORLD.locations.find(x => x.id === sel);
        if (l) {
          const cost = Math.max(1, Math.round((l.travelCost || 2) * factor));
          confirmBox.innerHTML = `<div class="sc-info"><b>${l.name}</b><span>${l.desc}</span></div>
            <button class="btn btn-primary btn-mini" onclick="UI.confirmTravel()">前往（${cost} 月）</button>
            <button class="btn btn-ghost btn-mini" onclick="UI.selectMapPin('${l.id}')">取消</button>`;
        } else confirmBox.innerHTML = "";
      } else confirmBox.innerHTML = "";
    }
  },

  // 兼容旧调用（已由 renderSceneStage 取代）
  renderLocMap(loc) { this.renderSceneStage(loc); },
  // 点选场景按钮：先选中（高亮 + 出确认条），不直接前往
  selectMapPin(locId) {
    this._mapSel = (this._mapSel === locId) ? null : locId;
    const loc = State.location();
    if (loc) this.renderSceneStage(loc);
  },
  // 确认前往选中的地点
  confirmTravel() {
    const dest = this._mapSel;
    this._mapSel = null;
    if (dest) Engine.travelTo(dest);
  },

  // 据点在场人物（城内有人气，可交谈）
  renderLocals(loc) {
    let box = this.el("locals");
    if (!box) {
      const locBox = document.querySelector(".loc-box");
      if (!locBox) return;
      box = document.createElement("div");
      box.id = "locals";
      box.className = "locals";
      locBox.appendChild(box);
    }
    const s = State.data;
    // 过场地点 / 待决剧情时不显示
    const locals = (loc.scene || s.pendingEvent) ? [] : (WORLD.localsAt ? WORLD.localsAt(loc.id, s) : []);
    if (!locals.length) { box.innerHTML = ""; box.style.display = "none"; return; }
    box.style.display = "";
    // 透明底立绘直接"站"在场景里；未结识者呈剪影
    box.innerHTML = locals.map(n => {
      const met = (s.metNpcs || []).includes(n.id);
      const line = (n.lines && n.lines.length) ? n.lines[0] : "";
      const url = (typeof Art !== "undefined") ? Art.url(n.id) : null;
      const fig = url
        ? `<span class="ln-figure"><img src="${url}" alt="${n.name}" loading="lazy" /></span>`
        : `<span class="ln-figure no-img">${met ? "🧑" : "❓"}</span>`;
      return `<div class="local-npc${met ? "" : " unmet"}" onclick="UI.talkLocal('${n.id}')" title="${line}">
        ${fig}
        <span class="ln-plate">${met ? n.name : "陌生人"}<span class="lr">${n.role}</span></span>
      </div>`;
    }).join("");
  },

  // 点在场人物：打开「交互轮盘」（立绘居中，左绿善意/右红敌对）
  talkLocal(npcId) {
    const s = State.data;
    const n = WORLD.npcById(npcId);
    if (!n) return;
    Engine.meetNpc(npcId);
    State.save();
    this.openNpcWheel(npcId);
  },

  // NPC 对你的称呼：随【示人境界】变化（藏拙：世界只认它看见的你）
  honorific() {
    const s = State.data;
    if (s.flags.is_modafu) return "墨大夫";
    const r = (s.revealedRealm != null ? s.revealedRealm : s.realmIndex) || 0;
    if (r >= 6) return "韩高人";
    if (r >= 4) return "韩师傅";
    if (r >= 2) return "韩兄弟";
    return "韩家小子";
  },

  // 交互轮盘
  openNpcWheel(npcId) {
    const s = State.data;
    const n = WORLD.npcById(npcId);
    if (!n) return;
    const rel = (typeof INTERACTIONS !== "undefined") ? INTERACTIONS.relationOf(s, npcId) : 0;
    const relTxt = rel >= 20 ? "交情深厚" : rel >= 8 ? "相熟" : rel <= -8 ? "心存芥蒂" : "相识";
    const heart = rel >= 8 ? "♥" : rel <= -8 ? "✖" : "·";
    const url = (typeof Art !== "undefined") ? Art.url(npcId) : null;
    const portrait = url ? `<img src="${url}" alt="${n.name}" />` : `<span class="nw-emoji">${(s.metNpcs||[]).includes(npcId) ? "🧑" : "❓"}</span>`;

    // 善意侧（左，绿）
    const good = [
      { k: "talk",  label: "交谈", icon: "💬", on: true },
      { k: "ask",   label: "请教", icon: "📖", on: true },
      { k: "spar",  label: "切磋", icon: "⚔", on: true },
      { k: "gift",  label: "赠礼", icon: "🎁", on: true },
    ];
    // 敌对侧（右，红）
    const bad = [
      { k: "probe",  label: "探查", icon: "🔍", on: true },
      { k: "threat", label: "威胁", icon: "💢", on: true },
    ];
    const btn = (a, side) =>
      `<button class="nw-act ${side}" onclick="UI.npcWheelAct('${npcId}','${a.k}')">
        <span class="nw-ic">${a.icon}</span><span class="nw-lb">${a.label}</span>
      </button>`;
    this.openModal(`
      <div class="npc-wheel">
        <div class="nw-side left">${good.map(a=>btn(a,"good")).join("")}</div>
        <div class="nw-center">
          <div class="nw-portrait">${portrait}</div>
          <div class="nw-name">${n.name}</div>
          <div class="nw-role">${n.role}</div>
          <div class="nw-rel ${rel>=8?'good':rel<=-8?'bad':''}">${heart} ${relTxt}</div>
          <div class="nw-rel" style="color:var(--gold)">称你：${this.honorific()}</div>
        </div>
        <div class="nw-side right">${bad.map(a=>btn(a,"bad")).join("")}</div>
      </div>
      <div class="modal-actions"><button class="btn btn-ghost" onclick="UI.closeModal()">离开</button></div>
    `, "wheel");
  },

  // 轮盘动作分发
  npcWheelAct(npcId, kind) {
    const s = State.data;
    if (kind === "talk") {
      if (typeof LLM !== "undefined" && LLM.enabled()) { this.openLiveTalk(npcId); return; }
      this._openTopics(npcId); return;
    }
    if (kind === "ask") { this._openTopics(npcId); return; }
    if (kind === "gift") { this._npcGift(npcId); return; }
    if (kind === "spar") {
      if (s.pendingEvent || s.combat) { this.toast("先处理眼前之事"); return; }
      Engine.passTime(1);
      if (typeof INTERACTIONS !== "undefined") INTERACTIONS.favor(s, npcId, 4);
      s.body += 1; s.mood = clamp(s.mood + 3, 0, s.moodMax);
      const n = WORLD.npcById(npcId);
      Engine.log(`你与「${n?n.name:''}」切磋了一场，点到即止，体魄+1，交情见长。`, "good");
      this.closeModal(); Engine.checkLifespan(); State.save(); this.renderAll();
      return;
    }
    if (kind === "probe") {
      if (typeof INTERACTIONS !== "undefined") INTERACTIONS.favor(s, npcId, -1);
      const n = WORLD.npcById(npcId);
      Engine.log(`你暗中打量「${n?n.name:''}」，揣摩其底细。${n?n.bio:''}`, "sys");
      this.closeModal(); State.save(); this.renderAll();
      return;
    }
    if (kind === "threat") {
      if (typeof INTERACTIONS !== "undefined") INTERACTIONS.favor(s, npcId, -8);
      s.demon = clamp(s.demon + 3, 0, 100);
      const n = WORLD.npcById(npcId);
      Engine.log(`你出言恐吓「${n?n.name:''}」，对方面色一变，记恨在心。修仙人的恶名，就是这么攒下的。`, "bad");
      this.closeModal(); State.save(); this.renderAll();
      return;
    }
  },

  // 赠礼：从背包挑一件相赠，换交情
  _npcGift(npcId) {
    const s = State.data;
    const inv = Object.keys(s.inventory).filter(k => s.inventory[k] > 0);
    if (!inv.length) { this.toast("储物袋空空，无礼可赠", true); return; }
    const n = WORLD.npcById(npcId);
    const rows = inv.map(k => {
      const it = DATA.items[k];
      return `<button class="choice" onclick="UI._giveGift('${npcId}','${k}')">${it?it.name:k} ×${s.inventory[k]}</button>`;
    }).join("");
    this.openModal(`
      <h2>赠礼予${n?n.name:''}</h2>
      <p style="color:var(--ink-dim);font-size:13px">投其所好，礼下于人——交情自然渐厚。</p>
      <div class="choices" style="margin-top:12px">${rows}</div>
      <div class="modal-actions"><button class="btn btn-ghost" onclick="UI.openNpcWheel('${npcId}')">返回</button></div>
    `);
  },
  _giveGift(npcId, itemId) {
    const s = State.data;
    if (State.count(itemId) < 1) { this.toast("没有此物", true); return; }
    State.take(itemId, 1);
    const it = DATA.items[itemId];
    // 稀有度越高交情越多
    const gain = it && it.rarity === "epic" ? 14 : it && it.rarity === "rare" ? 9 : 5;
    if (typeof INTERACTIONS !== "undefined") INTERACTIONS.favor(s, npcId, gain);
    const n = WORLD.npcById(npcId);
    Engine.log(`你将「${it?it.name:itemId}」赠予${n?n.name:''}，对方欣然收下，交情+${gain}。`, "good");
    this.closeModal(); State.save(); this.renderAll();
  },

  // 与在场人物交谈：静态对话主题（降级/请教路径）
  _openTopics(npcId) {
    const s = State.data;
    const n = WORLD.npcById(npcId);
    if (!n) return;
    const line = (n.lines && n.lines.length) ? n.lines[Math.floor(Math.random() * n.lines.length)] : "";
    const rel = (typeof INTERACTIONS !== "undefined") ? INTERACTIONS.relationOf(s, npcId) : 0;
    const relTxt = rel >= 20 ? "交情深厚" : rel >= 8 ? "相熟" : rel <= -8 ? "心存芥蒂" : "相识";
    const topics = (typeof DIALOGUE !== "undefined") ? DIALOGUE.forNpc(npcId, s) : [];
    const topicBtns = topics.map((t, i) =>
      `<button class="btn btn-secondary" style="text-align:left" onclick="Engine.dialogueTopic('${npcId}', ${i})">
        ${t.label}${t.hint ? `<span style="display:block;color:var(--ink-dim);font-size:12px">${t.hint}</span>` : ""}
      </button>`).join("");
    this.openModal(`
      <div class="fortune-tag" style="border-color:var(--jade);color:var(--jade)">闲谈</div>
      <h2>${n.name}<span style="color:var(--gold);font-size:13px;margin-left:8px">${n.role}</span></h2>
      <p style="color:var(--ink-dim);font-size:13px">${n.bio}</p>
      ${line ? `<div class="seg-dlg"><span class="dlg-name">${n.name}</span><span class="dlg-text">「${line}」</span></div>` : ""}
      <p style="color:var(--ink-dim);font-size:12px">关系：${relTxt}</p>
      <div class="modal-actions">
        ${topicBtns}
        <button class="btn btn-secondary" onclick="UI.chatLocal('${npcId}')">攀谈叙旧（耗时）</button>
        <button class="btn btn-ghost" onclick="UI.openNpcWheel('${npcId}')">返回</button>
      </div>
    `);
    this.renderAll();
  },

  /* ===========================================================
   *  实时对话（活世界）：可说的话 + NPC 回应 全部实时生成
   * =========================================================== */
  _talk: null,   // { npcId, history:[{who,text}], options:[], busy }
  openLiveTalk(npcId) {
    const n = WORLD.npcById(npcId);
    if (!n) return;
    this._talk = { npcId, history: [], options: [], busy: true };
    this._talkNote = null;
    this._renderLiveTalk(true);
    this._talkRequest(null);   // 首轮：只要 options
  },
  _talkCtx() {
    const s = State.data;
    const rel = (typeof INTERACTIONS !== "undefined") ? INTERACTIONS.relationOf(s, this._talk.npcId) : 0;
    const relText = rel >= 20 ? "交情深厚" : rel >= 8 ? "相熟" : rel <= -8 ? "心存芥蒂，颇有龃龉" : "萍水相识";
    const realm = State.realm ? State.realm().name : "";
    const loc = (State.location && State.location()) ? State.location().name : "";
    const intel = (typeof Engine !== "undefined" && Engine.knownLeadsFor) ? Engine.knownLeadsFor(this._talk.npcId) : [];
    return { relText, player: `${realm}，身处「${loc}」，第${s.year}年${s.month}月，年${s.age}。对方惯常称呼主角为「${this.honorific()}」`, intel };
  },
  _talkRequest(chosenLine) {
    const t = this._talk; if (!t) return;
    const n = WORLD.npcById(t.npcId);
    t.busy = true; this._renderLiveTalk();
    LLM.converse(n, this._talkCtx(), t.history, chosenLine).then(res => {
      if (!this._talk || this._talk.npcId !== t.npcId) return;
      t.busy = false;
      if (!res) {
        t.options = [];
        this._renderLiveTalk(false, "（一时无言以对……稍后再谈。）");
        return;
      }
      if (chosenLine && res.reply) {
        t.history.push({ who: "npc", text: res.reply });
        // 关系按语气流动
        if (res.favor && typeof INTERACTIONS !== "undefined") INTERACTIONS.favor(State.data, t.npcId, res.favor);
        LLM.remember(`与${n.name}交谈：${chosenLine}→${res.reply}`);
        // 机制结果：LLM 只提议方向，引擎裁决兑现
        if (res.effect && res.effect.type && res.effect.type !== "none" && typeof Engine !== "undefined") {
          const out = Engine.resolveTalkEffect(t.npcId, res.effect);
          if (out && out.note) t._effectNote = out.note;
        }
      }
      t.options = res.options || [];
      this._talkNote = t._effectNote || null;
      this._renderLiveTalk();
      t._effectNote = null;
      State.save();
    }).catch(() => { t.busy = false; this._renderLiveTalk(false, "（交谈不畅。）"); });
  },
  pickTalkOption(idx) {
    const t = this._talk; if (!t || t.busy) return;
    const line = t.options[idx]; if (!line) return;
    t.history.push({ who: "player", text: line });
    t.options = [];
    this._talkNote = null;
    this._renderLiveTalk();
    this._talkRequest(line);
  },
  endLiveTalk() {
    const t = this._talk; this._talk = null;
    this.closeModal();
    if (t && t.history.length) {
      const n = WORLD.npcById(t.npcId);
      Engine.passTime(1);  // 一番交谈耗些光阴
      Engine.log(`你与「${n ? n.name : ""}」攀谈了一番。`, "event");
      Engine.checkLifespan();
    }
    State.save(); this.renderAll();
  },
  _renderLiveTalk(first, note) {
    const t = this._talk; if (!t) return;
    const n = WORLD.npcById(t.npcId);
    const av = this._speakerAvatar(n.name);
    const rel = (typeof INTERACTIONS !== "undefined") ? INTERACTIONS.relationOf(State.data, t.npcId) : 0;
    const relTxt = rel >= 20 ? "交情深厚" : rel >= 8 ? "相熟" : rel <= -8 ? "心存芥蒂" : "相识";
    const convo = t.history.map(h => {
      const self = h.who === "player";
      const a = self ? this._speakerAvatar(State.data.name) : av;
      return `<div class="dlg-row ${self ? "right" : "left"}">
        <div class="dlg-portrait${a.img ? ' has-img' : ''}" style="--pc:${a.color}">${this._avatarInner(a)}</div>
        <div class="dlg-bubble"><div class="dlg-who"><span class="dlg-name" style="color:${a.color}">${self ? State.data.name : n.name}</span></div>
        <div class="dlg-text">${h.text}</div></div></div>`;
    }).join("");
    let optionsHtml;
    if (t.busy) {
      optionsHtml = `<div class="talk-thinking">……${t.history.length && t.history[t.history.length-1].who==="player" ? n.name+"正在思量" : "正在斟酌可说的话"}……</div>`;
    } else if (note) {
      optionsHtml = `<div class="talk-thinking">${note}</div>`;
    } else {
      optionsHtml = (t.options || []).map((o, i) =>
        `<button class="choice" onclick="UI.pickTalkOption(${i})">${o}</button>`).join("")
        || `<div class="talk-thinking">（似乎没什么好说的了）</div>`;
    }
    this.openModal(`
      <div class="fortune-tag" style="border-color:var(--jade);color:var(--jade)">对谈 · ${relTxt}</div>
      <h2>${n.name}<span style="color:var(--gold);font-size:13px;margin-left:8px">${n.role}</span></h2>
      <div class="talk-convo" id="talk-convo">${convo || `<p style="color:var(--ink-dim);font-size:13px">${n.bio}</p>`}</div>
      ${this._talkNote ? `<div class="talk-effect">${this._talkNote}</div>` : ""}
      <div class="talk-options">${optionsHtml}</div>
      <div class="modal-actions"><button class="btn btn-ghost" onclick="UI.endLiveTalk()">告辞</button></div>
    `);
    const box = this.el("talk-convo"); if (box) box.scrollTop = box.scrollHeight;
  },

  // 攀谈（降级路径用）：花点时间增进交情
  chatLocal(npcId) {
    const s = State.data;
    if (s.pendingEvent || s.combat) { this.closeModal(); return; }
    Engine.passTime(1);
    if (typeof INTERACTIONS !== "undefined") INTERACTIONS.favor(s, npcId, 3);
    s.mood = clamp(s.mood + 3, 0, s.moodMax);
    const n = WORLD.npcById(npcId);
    Engine.log(`你与「${n ? n.name : npcId}」攀谈了一番，叙了些闲话，交情更近了几分。`, "event");
    this.closeModal();
    Engine.checkLifespan();
    State.save();
    this.renderAll();
  },

  // 根据当前地点动态生成可用行动按钮
  renderActions() {
    const loc = State.location();
    const box = this.el("action-buttons");
    const zone = document.querySelector(".mid-col");
    if (!loc) { box.innerHTML = ""; return; }

    // 有待决剧情时，日常行动暂时灰掉（引导玩家先做剧情选择）
    const storyPending = !!State.data.pendingEvent;
    if (zone) zone.classList.toggle("story-pending", storyPending);

    const labels = {
      cultivate: "闭关修炼", rest: "打坐调息", breakthrough: "尝试突破", bottle: "打理小瓶",
      adventure: "外出历练", gather: "采药", spar: "切磋武艺", market: "采买", alchemy: "炼药", investigate: "暗中探查",
      explore: "深入探索", wujian: "闭关悟剑 ⚔",
    };
    // 剧情过场地点（scene）：无日常行动，只随剧情推进
    // 各地行动由 world 数据决定，不再到处自动塞「打坐/突破」——突破/调息只在洞府(home)出现
    let acts = (loc.scene ? [] : loc.actions.slice());
    if (!loc.scene) {
      acts = acts.filter(a => a !== "bottle" || State.data.bottle.unlocked);
      // 剑意圆满：洞府出现「悟剑」（大件链攻坚入口）
      if (loc.home && (State.data.swordIntent || 0) >= 100 && !State.data.swordMastery) acts.unshift("wujian");
    }

    // 涟漪窗口：限时机会在对应地点浮现（过期即逝）
    let windowBtn = "";
    const rw = State.data.rippleWindow;
    if (rw && !loc.scene) {
      const left = rw.dueAbs - State.absMonth();
      if ((rw.id === "herb_garden" && loc.id === "houshan") || (rw.id === "wolf_bounty" && loc.id === "town")) {
        const lbl = rw.id === "herb_garden" ? "寻无主药园" : "应悬赏剿匪";
        windowBtn = `<button class="btn btn-action btn-window" onclick="Engine.doRippleWindow('${rw.id}')">${lbl} <span class="win-left">余${left}月</span></button>`;
      }
    }

    box.innerHTML = (acts.length || windowBtn)
      ? windowBtn + acts.map(a => `<button class="btn btn-action" data-action="${a}">${labels[a] || a}</button>`).join("")
      : (loc.scene ? `<div class="act-hint">— 此地仅供过场，循剧情前行 —</div>` : "");
    box.querySelectorAll("[data-action]").forEach(btn => {
      btn.addEventListener("click", () => Engine.doAction(btn.dataset.action));
    });
  },

  renderTopbar() {
    const s = State.data;
    const t = this.el("top-time");
    if (t) t.textContent = `第${s.year}年${s.month}月`;
    // 角色卡
    const hn = this.el("hero-name"); if (hn) hn.textContent = s.name;
    const ha = this.el("hero-age"); if (ha) ha.textContent = `${s.age} 岁`;
    const hl = this.el("hero-lifespan"); if (hl) hl.textContent = s.lifespan;
    // 韩立立绘（仓库固定图）
    const hp = this.el("hero-portrait");
    if (hp && typeof Art !== "undefined") {
      const url = Art.url("hanli");
      if (url && !hp.dataset.img) { hp.innerHTML = `<img src="${url}" alt="${s.name}" />`; hp.dataset.img = "1"; }
    }
  },

  renderStats() {
    const s = State.data;
    const realm = State.realm();
    const root = State.root();
    this.el("st-root").textContent = root.name;
    this.el("st-root").style.color = root.color;
    // 藏拙：真实境界 +（示人境界）
    const hid = s.realmIndex - (s.revealedRealm != null ? s.revealedRealm : s.realmIndex);
    this.el("st-realm").textContent = hid > 0
      ? `${realm.name}（示人：${DATA.realms[s.revealedRealm].name}）`
      : realm.name;
    this.el("st-sense").textContent = s.sense;
    this.el("st-speed").textContent = s.speed;
    this.el("st-insight").textContent = s.insight;
    this.el("st-body").textContent = s.body;
    this.el("st-stones").textContent = s.stones;
    const alch = this.el("st-alch"); if (alch) alch.textContent = (s.skills && s.skills.alchemy) || 0;
    const scout = this.el("st-scout"); if (scout) scout.textContent = (s.skills && s.skills.scouting) || 0;
    const fame = this.el("st-fame"); if (fame) fame.textContent = s.fame || 0;
    this.el("st-time").textContent = `${s.year}年${s.month}月`;

    this.setBar("cul", s.cultivation, realm.culMax);
    this.setBar("sp", s.spirit, realm.spMax);
    this.setBar("hp", s.hp, s.hpMax);
    this.setBar("mood", s.mood, s.moodMax);
    this.setBar("demon", s.demon, 100);
  },

  setBar(key, val, max) {
    const pct = clamp((val / max) * 100, 0, 100);
    this.el(`${key}-bar`).style.width = pct + "%";
    const txt = this.el(`${key}-text`);
    if (txt) txt.textContent = (key === "cul" || key === "sp") ? `${Math.round(val)} / ${max}` : Math.round(val);
  },

  renderInventory() {
    const inv = State.data.inventory;
    const box = this.el("inventory");
    const keys = Object.keys(inv).filter(k => inv[k] > 0);
    if (!keys.length) { box.innerHTML = `<div class="inv-empty">储物袋空空如也</div>`; return; }
    box.innerHTML = keys.map(k => {
      const item = DATA.items[k];
      const sl = itemSeal(item);
      return `<div class="inv-item" onclick="UI.showItem('${k}')">
        <span class="seal sm wx-${sl.wx}">${sl.ch}</span>
        <span class="iname ${item.rarity === 'rare' ? 'rare' : item.rarity === 'epic' ? 'epic' : ''}">${item.name}</span>
        <span class="icount">×${inv[k]}</span>
      </div>`;
    }).join("");
  },

  showItem(itemId) {
    const item = DATA.items[itemId];
    const isPill = item.type === "pill";
    const isSeed = !!DATA.bottle.crops[itemId] || itemId === "lingcao" || itemId === "duyao_cao";
    let actions = "";
    if (isPill) actions += `<button class="btn btn-primary" onclick="Engine.useItem('${itemId}'); UI.closeModal();">服用</button>`;
    if (State.data.bottle.unlocked && DATA.bottle.crops[itemId]) {
      actions += `<button class="btn btn-secondary" onclick="UI.closeModal(); UI.openBottle();">投入小绿瓶</button>`;
    }
    // 符宝金光砖：灵石回充（符宝吃资源——强力手段都有运营成本）
    if (itemId === "jinguang_zhuan") {
      actions += `<button class="btn btn-secondary" onclick="Engine.rechargeZhuan(); UI.closeModal();">灵石回充（灵石×1 → 充能×1）</button>`;
    }
    this.openModal(`
      <h2>${item.name}</h2>
      ${isPill ? this._statusStrip() : ""}
      <p style="color:var(--ink-dim)">${rarityLabel(item.rarity)} · ${typeLabel(item.type)}　持有 ×${State.count(itemId)}</p>
      <p>${item.desc}</p>
      ${item.effect && Object.keys(item.effect).length ? `<p style="color:var(--jade-bright)">服用：${effectText(item.effect)}</p>` : ""}
      <div class="modal-actions">
        ${actions}
        <button class="btn btn-ghost" onclick="UI.closeModal()">收起</button>
      </div>
    `);
  },

  renderActionAvailability() { /* 已由 renderActions 取代 */ },

  /* -------- 叙事区 -------- */
  renderNarrative() {
    const box = this.el("narrative");
    if (!box) return;
    const s = State.data;
    const icons = { good: "✦", bad: "⚠", event: "·", sys: "…" };
    const last = s.log.length - 1;
    box.innerHTML = s.log.map((e, i) => `
      <div class="entry ${e.kind}${i === last ? ' latest' : ''}">
        <div class="time-stamp"><span class="ek-icon">${icons[e.kind] || "·"}</span>${e.t}</div>
        <div class="body">${e.body}</div>
      </div>`).join("");
    this._scrollNarrativeBottom();
  },
  // 滚到最新见闻：桌面滚 .narrative 自身；手机上滚动容器是 .layout（修复"回到最上面"）
  _scrollNarrativeBottom() {
    const box = this.el("narrative");
    if (!box) return;
    requestAnimationFrame(() => {
      if (box.scrollHeight > box.clientHeight + 4) { box.scrollTop = box.scrollHeight; return; }
      const layout = document.querySelector(".layout");
      if (layout && layout.scrollHeight > layout.clientHeight + 4) layout.scrollTop = layout.scrollHeight;
    });
  },

  /* -------- 剧情卡渲染（视觉小说式：大立绘 + 逐句推进）-------- */
  renderStory(stage) {
    const overlay = this.el("story-overlay");
    // 兜底：若剧情舞台 DOM 缺失，退回把整段剧情写入叙事日志并直接出选项，绝不卡住
    if (!overlay) { this._renderStoryFallback(stage); return; }
    // 将 stage.text 的混合段落解析成统一的"演出节拍"序列
    const beats = this._buildStoryBeats(stage);
    this._story = { stage, beats, idx: -1 };
    overlay.hidden = false;
    document.body.classList.add("story-on");
    // 重置双人立绘
    const lb = this.el("story-portrait-left"), rb = this.el("story-portrait-right");
    if (lb) { lb.innerHTML = ""; lb.className = "story-portrait left"; }
    if (rb) { rb.innerHTML = ""; rb.className = "story-portrait right"; rb.dataset.set = ""; }
    // 场景背景：优先该阶段声明的 CG，否则用当前地点的场景图
    this._storySetScene(stage);
    // 败北重试：剧情已看过，跳过题字与正文直达抉择（免重复演出之扰）
    if (typeof Engine !== "undefined" && Engine._retryStage) {
      Engine._retryStage = false;
      this._story.idx = beats.length;
      const stageName = this.el("story-stage-name");
      if (stageName) stageName.textContent = stage.title || "";
      const sp = this.el("story-speaker"), tx = this.el("story-text");
      if (sp) sp.innerHTML = "";
      if (tx) tx.innerHTML = `<span class="story-line narr">（你重整旗鼓，伤势已敷、底牌再备——这一次，结局会不同。）</span>`;
      this._storyShowChoices();
      return;
    }
    // 转场题字卡（番剧分集感）：黑场亮出章节题字，轻触或稍候自动入戏
    this._storyTitleCard(stage);
  },

  // 黑场题字卡：显示阶段标题，1.4s 后（或轻触）开始演出
  _storyTitleCard(stage) {
    const overlay = this.el("story-overlay");
    let card = this.el("story-titlecard");
    if (!card) {
      card = document.createElement("div");
      card.id = "story-titlecard";
      card.className = "story-titlecard";
      overlay.appendChild(card);
    }
    const st = this._story;
    if (!stage.title) { this.storyAdvance(); return; }
    st.titling = true;
    card.innerHTML = `<div class="tc-frame"><div class="tc-title">${stage.title}</div><div class="tc-seal">凡人</div></div>`;
    card.classList.add("show");
    if (typeof Sfx !== "undefined") Sfx.play("chime");
    const begin = () => {
      if (!st.titling) return;
      st.titling = false;
      card.classList.remove("show");
      this.storyAdvance();
    };
    card.onclick = (e) => { e.stopPropagation(); begin(); };
    this._titleTimer = setTimeout(begin, 1500);
  },

  // 降级渲染（无 overlay 时）：把剧情写进右侧叙事区并在下方出选项
  _renderStoryFallback(stage) {
    const box = this.el("narrative");
    if (box) {
      const bodyHtml = (stage.text || []).map(seg => this._renderSegment(seg)).join("");
      box.innerHTML += `<div class="entry story"><div class="title">${stage.title}</div><div class="body">${bodyHtml}</div></div>`;
      box.scrollTop = box.scrollHeight;
    }
    const choicesBox = this.el("choices");
    if (choicesBox) {
      choicesBox.innerHTML = (stage.choices || []).map((c, i) => {
        const lack = c.requireItem && !State.count(c.requireItem);
        return `<button class="choice${c.resolve ? ' choice-fight' : ''}" onclick="Engine.chooseStory(STORY[${State.data.storyStage}], ${i})">
          ${c.text}${c.hint ? `<span class="c-hint">${c.hint}${lack ? '（尚缺）' : ''}</span>` : ""}
        </button>`;
      }).join("");
    }
  },

  // 把 text[]（字符串/对象混排）拍平成节拍：{ kind:'narr'|'say'|'scene', who, text, tone, showWho }
  _buildStoryBeats(stage) {
    const beats = [];
    (stage.text || []).forEach(seg => {
      if (typeof seg === "string") { beats.push({ kind: "narr", text: seg }); return; }
      if (seg.scene) { beats.push({ kind: "scene", text: seg.scene }); return; }
      if (seg.aside) { beats.push({ kind: "aside", who: State.data.name, text: seg.aside }); return; }
      if (seg.beat) { beats.push({ kind: "narr", text: seg.beat || "……" }); return; }
      if (seg.show) { beats.push({ kind: "narr", text: seg.text || "", showWho: seg.show }); return; }   // 立绘亮相（无对白）
      if (seg.say) { beats.push({ kind: "say", who: seg.say, text: seg.text, tone: seg.tone }); return; }
      if (seg.narr) { beats.push({ kind: "narr", text: seg.narr }); return; }
    });
    return beats;
  },

  // 设定剧情背景图：阶段 CG（关键剧情大图）优先，其次当前地点场景
  _storySetScene(stage) {
    const bg = this.el("story-bg");
    if (!bg || typeof Art === "undefined") return;
    let url = null;
    if (stage && stage.cg && Art.cgUrl) url = Art.cgUrl(stage.cg);
    if (!url) {
      const loc = State.location();
      if (loc) url = Art.locUrl(loc);
    }
    if (url) { bg.style.backgroundImage = `url("${url}")`; bg.classList.add("on"); }
    else { bg.style.backgroundImage = ""; bg.classList.remove("on"); }
  },

  // 打字机逐字显示；点击时若在打字 → 立即完成本句
  _typeText(el, html, instant) {
    const st = this._story;
    if (this._typeTimer) { clearInterval(this._typeTimer); this._typeTimer = null; }
    // 用一个临时节点取纯文本逐字打；保留外层 span 的样式类
    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    const span = tmp.firstChild;
    const full = span ? span.textContent : "";
    if (instant || !full || full.length <= 2) { el.innerHTML = html; if (st) st.typing = false; return; }
    span.textContent = "";
    el.innerHTML = "";
    el.appendChild(span);
    if (st) st.typing = true;
    let i = 0;
    this._typeTimer = setInterval(() => {
      i += 1;
      span.textContent = full.slice(0, i);
      if (i >= full.length) {
        clearInterval(this._typeTimer); this._typeTimer = null;
        if (st) st.typing = false;
      }
    }, 26);
  },
  // 立即完成当前打字
  _typeFinish() {
    const st = this._story;
    if (this._typeTimer) { clearInterval(this._typeTimer); this._typeTimer = null; }
    if (st && st.typing && st.idx >= 0 && st.idx < st.beats.length) {
      const b = st.beats[st.idx];
      const textEl = this.el("story-text");
      if (textEl && b) {
        if (b.kind === "scene") textEl.innerHTML = `<span class="scene-line">· ${b.text} ·</span>`;
        else textEl.innerHTML = `<span class="story-line${b.kind === "narr" ? ' narr' : ''}${b.kind === "aside" ? ' aside' : ''}">${b.text}</span>`;
      }
      st.typing = false;
    }
  },

  // 逐句推进：每次轻触显示下一节拍；打字中则先补完；到末尾给出选项
  storyAdvance() {
    const st = this._story; if (!st) return;
    if (st.titling) return;           // 题字卡期间由卡自己处理
    if (st.typing) { this._typeFinish(); return; }
    // 已到结尾：不再推进（选项已显示）
    if (st.done) return;
    st.idx++;
    if (st.idx >= st.beats.length) { this._storyShowChoices(); return; }
    const b = st.beats[st.idx];
    const stageName = this.el("story-stage-name");
    if (stageName) stageName.textContent = st.stage.title || "";
    if (typeof Sfx !== "undefined") Sfx.play("page");

    const speakerEl = this.el("story-speaker");
    const textEl = this.el("story-text");
    const dialog = this.el("story-dialog");
    const cue = this.el("story-cue");

    // 场景过场：居中淡入一行
    if (b.kind === "scene") {
      dialog.classList.add("scene-beat");
      speakerEl.innerHTML = "";
      this._typeText(textEl, `<span class="scene-line">· ${b.text} ·</span>`, true);
    } else {
      dialog.classList.remove("scene-beat");
      const who = b.who;
      const isNarr = (b.kind === "narr");
      const isAside = (b.kind === "aside");
      speakerEl.innerHTML = isNarr ? "" :
        `<span class="sp-name${isAside ? ' aside' : ''}">${who}${isAside ? "（心声）" : ""}</span>`;
      this._typeText(textEl, `<span class="story-line${isNarr ? ' narr' : ''}${isAside ? ' aside' : ''}">${b.text}</span>`);
      // 立绘：旁白用当前地点/无；对话/心声用说话人立绘；showWho=立绘亮相（无对白）
      this._storySetPortrait(b.showWho || (isNarr ? null : who));
    }

    const last = (st.idx === st.beats.length - 1);
    if (cue) cue.textContent = last ? "▽ 轻触，到此抉择" : "▽ 轻触继续";
    this.el("story-choices").innerHTML = "";
  },

  // 双人相对立绘：韩立固定在右，对话 NPC 在左；说话者高亮，另一人暗淡
  _storySetPortrait(who) {
    const st = this._story;
    const lbox = this.el("story-portrait-left");
    const rbox = this.el("story-portrait-right");
    if (!lbox || !rbox) return;

    // 右侧固定为韩立立绘
    if (!rbox.dataset.set) {
      const hurl = (typeof Art !== "undefined") ? Art.url("hanli") : null;
      rbox.innerHTML = hurl ? `<img src="${hurl}" alt="韩立" />` : "";
      rbox.dataset.set = hurl ? "1" : "";
    }

    const self = who && (who === State.data.name || who === "韩立");

    // 出场的对话 NPC（非旁白、非主角）→ 放左侧并记住
    if (who && !self) {
      const id = this._npcIdByName(who);
      const url = id && typeof Art !== "undefined" ? Art.url(id) : null;
      if (url && st && st.leftNpc !== who) {
        lbox.innerHTML = `<img src="${url}" alt="${who}" />`;
        if (st) st.leftNpc = who;
      }
    }

    const hasLeft = !!lbox.querySelector("img");
    const hasRight = !!rbox.querySelector("img");
    rbox.classList.toggle("on", hasRight);
    lbox.classList.toggle("on", hasLeft);

    // 高亮谁：旁白时两边都暗；主角说话右亮左暗；NPC 说话左亮右暗
    const speakRight = self;
    const speakLeft = who && !self;
    rbox.classList.toggle("dim", hasRight && !speakRight);
    lbox.classList.toggle("dim", hasLeft && !speakLeft);
  },

  _storyShowChoices() {
    const st = this._story; if (!st) return;
    st.done = true;
    const stage = st.stage;
    const cue = this.el("story-cue"); if (cue) cue.textContent = "";
    const box = this.el("story-choices");
    // 战斗类抉择前的「临战准备」一览
    const isFight = (stage.choices || []).some(c => c.resolve);
    let prepHtml = "";
    if (isFight) {
      const du = State.count("duyao_cao"), an = State.count("anqi");
      const ready = (du >= 3 && an >= 3);
      const warn = (du === 0 && an === 0);
      prepHtml = `<div class="fight-prep ${ready ? 'ok' : warn ? 'bad' : 'mid'}">
        <span class="fp-tag">临战准备</span>
        <span class="fp-item">毒草 ×${du}</span><span class="fp-item">暗器 ×${an}</span>
        <span class="fp-note">${ready ? '准备充分，可放手一搏' : warn ? '毫无底牌！硬拼九死一生，建议先去后山备足毒草暗器' : '底牌偏少，胜算有限，宜再备一些'}</span>
      </div>`;
    }
    box.innerHTML = prepHtml + (stage.choices || []).map((c, i) => {
      const lack = c.requireItem && !State.count(c.requireItem);
      return `<button class="choice${c.resolve ? ' choice-fight' : ''}" onclick="UI.storyChoose(${i})">
        ${c.text}${c.hint ? `<span class="c-hint">${c.hint}${lack ? '（尚缺）' : ''}</span>` : ""}
      </button>`;
    }).join("");
  },

  // 选项点击：先把这段剧情沉淀到叙事日志（留痕），再关闭演出、推进
  storyChoose(i) {
    const st = this._story; if (!st) return;
    const stage = st.stage;
    if (this._titleTimer) { clearTimeout(this._titleTimer); this._titleTimer = null; }
    if (this._typeTimer) { clearInterval(this._typeTimer); this._typeTimer = null; }
    this._archiveStory(stage);
    this.el("story-overlay").hidden = true;
    document.body.classList.remove("story-on");
    this._story = null;
    Engine.chooseStory(STORY[State.data.storyStage], i);
  },

  // 把已演完的剧情正文沉淀进叙事日志（持久，可回看）
  _archiveStory(stage) {
    const s = State.data;
    const bodyHtml = (stage.text || []).map(seg => this._renderSegment(seg)).join("");
    const id = (Engine._logSeq = (Engine._logSeq || 0) + 1);
    s.log.push({ id, t: `第${s.year}年${s.month}月`, kind: "story", body: `<div class="title">${stage.title}</div>${bodyHtml}` });
    if (s.log.length > 60) s.log.shift();
  },

  // 剧情演出：解析一段叙事单元（字符串=旁白；对象=对话/心理/强调/场景）
  _renderSegment(seg) {
    if (typeof seg === "string") return `<p class="seg-narr">${seg}</p>`;
    if (seg.scene) return `<div class="seg-scene">· ${seg.scene} ·</div>`;
    if (seg.aside) return `<p class="seg-aside">${seg.aside}</p>`;       // 心理独白
    if (seg.beat) return `<div class="seg-beat">${seg.beat || "……"}</div>`; // 停顿/留白
    if (seg.say) {
      const who = seg.say;
      const self = (who === State.data.name || who === "韩立");
      const av = this._speakerAvatar(who);
      const side = self ? "right" : "left";
      const tone = seg.tone ? `<span class="dlg-tone">${seg.tone}</span>` : "";
      const hl = seg.hl ? " hl" : "";
      return `<div class="dlg-row ${side}${hl}">
        <div class="dlg-portrait${av.img ? ' has-img' : ''}" style="--pc:${av.color}">${this._avatarInner(av)}</div>
        <div class="dlg-bubble">
          <div class="dlg-who"><span class="dlg-name" style="color:${av.color}">${who}</span>${tone}</div>
          <div class="dlg-text">${seg.text}</div>
        </div>
      </div>`;
    }
    if (seg.narr) return `<p class="seg-narr">${seg.narr}</p>`;
    return "";
  },

  // 说话人 → 头像图标与配色（左右对话演出用）
  _speakerAvatar(who) {
    const self = (who === State.data.name || who === "韩立");
    // 优先用立绘图片（仓库固定图或已缓存的实时生成图）
    if (typeof Art !== "undefined") {
      const id = self ? "hanli" : this._npcIdByName(who);
      const url = id ? Art.url(id) : null;
      if (url) return { img: url, color: self ? "var(--jade-bright)" : "var(--ink)" };
    }
    if (self) return { icon: "🧙", color: "var(--jade-bright)" };
    const map = {
      "墨大夫": { icon: "🧓", color: "var(--purple)" },
      "厉飞雨": { icon: "🧑", color: "var(--blue)" },
      "张铁":   { icon: "💪", color: "var(--gold)" },
      "墨彩环": { icon: "👧", color: "var(--purple)" },
      "小算盘": { icon: "🧮", color: "var(--gold)" },
      "贾天龙": { icon: "🐺", color: "var(--red)" },
      "金光上人": { icon: "🟡", color: "var(--gold-bright)" },
    };
    return map[who] || { icon: "🧑", color: "var(--ink)" };
  },
  // 说话人姓名 → NPC id（用于取立绘图）
  _npcIdByName(name) {
    if (!name) return null;
    // 剧情专属人物（不在大世界 NPC 名册中）
    const extra = { "三叔": "sanshu", "铁奴": "tienu", "张铁（铁奴）": "tienu", "墨彩环": "mocaihuan", "万小山": "wanxiaoshan" };
    if (extra[name]) return extra[name];
    if (typeof WORLD !== "undefined" && WORLD.npcs) {
      const n = WORLD.npcs.find(x => x.name === name);
      if (n) return n.id;
    }
    return null;
  },
  // 头像格子内容：有图用 img，否则用 emoji
  _avatarInner(av) {
    return av.img ? `<img src="${av.img}" alt="" loading="lazy" />` : av.icon;
  },
  clearStory() { this.el("choices").innerHTML = ""; },

  /* -------- 功法阁（配装：主修/辅修 + 技能槽）-------- */
  openTechniques() {
    const s = State.data;
    const L = (typeof Loadout !== "undefined") ? Loadout : null;
    if (!L) return;
    const SP = CombatAPI.SPELLS;

    // 功法分区：主修 / 辅修 / 已习未用 / 未习（传说）
    const learned = (s.learnedTechniques || []);
    const auxCap = L.auxCap(s), auxNow = (s.auxTechniques || []).length;
    const techRow = (id) => {
      const t = DATA.techniques[id];
      if (!t) return "";
      const isMain = s.technique === id;
      const isAux = (s.auxTechniques || []).includes(id);
      const tag = isMain ? `<span class="tech-cur">主修</span>` : isAux ? `<span class="tech-aux">辅修</span>` : "";
      let btns = "";
      if (!isMain) btns += `<button class="btn btn-mini" onclick="UI._loadoutMain('${id}')">设为主修</button>`;
      if (!isMain && !isAux) btns += `<button class="btn btn-mini" onclick="UI._loadoutAddAux('${id}')">设为辅修</button>`;
      if (isAux) btns += `<button class="btn btn-mini ghost" onclick="UI._loadoutRemoveAux('${id}')">取消辅修</button>`;
      return `<div class="tech-item ${isMain ? 'current' : ''}">
        <div class="tech-head"><span class="seal wx-${t.attr || 'mu'}">${sealChar(t.name)}</span><b>${t.name}</b>${tag}<span class="tech-grade">${gradeLabel(t.grade)}</span></div>
        <div class="tech-desc">${t.desc}</div>
        <div class="tech-skills">授技：${(t.grantSpells || []).map(sk => SP[sk] ? SP[sk].name : sk).join("、") || "—"}</div>
        <div class="tech-btns">${btns}</div>
      </div>`;
    };
    const lockedRows = Object.entries(DATA.techniques)
      .filter(([k, t]) => t.locked && !learned.includes(k))
      .map(([k, t]) => `<div class="tech-item locked">
        <div class="tech-head"><b>${t.name}</b><span class="tech-lock">未得 · ${t.acquireArc || '后续篇章'}</span></div>
        <div class="tech-desc">${t.desc}</div>
        <div class="tech-origin">来历：${t.origin}</div>
      </div>`).join("");

    // 技能槽（底牌不占槽）
    const cap = L.skillCap(s), now = L.equippedCount ? L.equippedCount(s) : (s.spells || []).length;
    const pool = L.knownPool(s);
    const skillChip = (sk) => {
      const sp = SP[sk]; if (!sp) return "";
      const equipped = L.isEquipped(s, sk);
      const aux = L.isAuxSkill(s, sk);
      const wx = Object.keys(sp.cost || {})[0] || "jin";
      const cost = Object.entries(sp.cost).map(([e, n]) => `${CombatAPI.ELEM_NAME[e]}${n}`).join(" ") || "无耗";
      return `<div class="skill-chip ${equipped ? 'on' : ''}" onclick="UI._loadoutToggleSkill('${sk}')">
        <div class="sk-top"><span class="seal sm wx-${wx}">${sealChar(sp.name)}</span><b>${sp.name}</b>${aux ? '<span class="sk-aux">辅</span>' : ''}${equipped ? '<span class="sk-on">✓出战</span>' : ''}</div>
        <div class="sk-meta"><span class="qcost">${cost}</span> ${spellEffectText(sp)}</div>
      </div>`;
    };

    this.openModal(`
      <h2>功法 · 配装</h2>
      <p style="color:var(--ink-dim);font-size:12px">功法是背包里的典籍，须在闭关时研习方能习得。主修全效，辅修打折（×${Math.round(Balance.auxiliaryMul()*100)}%）。技能槽随境界增多，自由组合。</p>

      <h3 class="panel-title">功法（主修 ×1，辅修 ${auxNow}/${auxCap}）</h3>
      <div class="tech-list">
        ${learned.map(techRow).join("")}
        ${lockedRows ? `<p style="color:var(--ink-dim);font-size:12px;margin:8px 0 4px">— 道听途说的传说功法（尚不可得）—</p>${lockedRows}` : ""}
      </div>

      <h3 class="panel-title">出战技能（${now}/${cap}）</h3>
      <div class="skill-grid">${pool.map(skillChip).join("")}</div>

      <div class="modal-actions"><button class="btn btn-ghost" onclick="UI.closeModal()">收起</button></div>
    `);
  },
  _loadoutMain(id) { const r = Loadout.setMain(State.data, id); if (!r.ok) return this.toast(r.reason, true); this.toast("已设为主修"); State.save(); this.openTechniques(); this.renderAll(); },
  _loadoutAddAux(id) { const r = Loadout.addAux(State.data, id); if (!r.ok) return this.toast(r.reason, true); this.toast("已设为辅修"); State.save(); this.openTechniques(); this.renderAll(); },
  _loadoutRemoveAux(id) { Loadout.removeAux(State.data, id); this.toast("已取消辅修"); State.save(); this.openTechniques(); this.renderAll(); },
  _loadoutToggleSkill(sk) {
    const s = State.data;
    if (Loadout.isEquipped(s, sk)) { Loadout.unequipSkill(s, sk); this.toast("已卸下"); }
    else { const r = Loadout.equipSkill(s, sk); if (!r.ok) return this.toast(r.reason, true); this.toast("已装备出战"); }
    State.save(); this.openTechniques(); this.renderAll();
  },

  // 弹窗内当前状态摘要条（闭关/服药时数值可见，治"体验割裂"）
  _statusStrip() {
    const s = State.data;
    const realm = State.realm();
    return `<div class="status-strip">
      <span>修为 <b>${s.cultivation}/${realm.culMax}</b></span>
      <span>灵力 <b>${s.spirit}/${realm.spMax}</b></span>
      <span>气血 <b>${s.hp}/${s.hpMax}</b></span>
      <span>心境 <b>${s.mood}</b></span>
      <span>心魔 <b class="${s.demon >= 35 ? 'warn' : ''}">${s.demon}</b></span>
    </div>`;
  },

  /* -------- 闭关时长选择（真实修仙：时间是资源也是代价）-------- */
  openSeclusion() {
    const s = State.data;
    const realm = State.realm();
    const root = State.root();
    const base = 14 + Math.floor(s.sense * 0.4);
    const moodFactor = 0.6 + (s.mood / s.moodMax) * 0.6;
    const demonPenalty = 1 - (s.demon / 200);
    const perMonth = Math.max(1, Math.round(base * root.cul * moodFactor * demonPenalty));
    const toFull = Math.max(0, realm.culMax - s.cultivation);
    const need = perMonth > 0 ? Math.ceil(toFull / perMonth) : 99;

    const opts = [
      { m: 1, label: "闭关一月", note: "浅尝即止" },
      { m: 6, label: "闭关半年", note: "稳步精进" },
      { m: 12, label: "闭关一年", note: "潜心苦修" },
      { m: 36, label: "闭关三年", note: "心无旁骛，岁月如梭" },
    ];
    const optHtml = opts.map(o =>
      `<button class="btn btn-secondary" style="text-align:left" onclick="UI.closeModal(); Engine.doCultivate(${o.m});">
        ${o.label}　<span style="color:var(--ink-dim);font-size:12px">预计修为+${perMonth * o.m}　${o.note}</span>
      </button>`
    ).join("");
    // 一键闭关至本层圆满（省去反复点击，但插曲/耗时照常结算）
    const toFullBtn = (toFull > 0 && need > 0 && need < 200)
      ? `<button class="btn btn-primary" onclick="UI.closeModal(); Engine.doCultivate(${need});">闭关至本层圆满　<span style="font-size:12px;opacity:.85">约 ${need} 月</span></button>`
      : "";

    // 闭关研习功法（持有未习的典籍时）
    const studyable = Engine.studyableTechniques ? Engine.studyableTechniques() : [];
    const studyHtml = studyable.length ? `
      <h3 class="panel-title" style="margin-top:10px">闭关研习功法</h3>
      <div class="study-list">
        ${studyable.map(id => {
          const t = DATA.techniques[id];
          return `<div class="study-item">
            <div><div class="si-name">${t.name} <span style="color:var(--gold);font-size:11px">${gradeLabel(t.grade)}</span></div>
            <div class="si-meta">${t.desc}</div></div>
            <button class="btn btn-mini" onclick="UI.closeModal(); Engine.studyTechnique('${id}');">研习（3月）</button>
          </div>`;
        }).join("")}
      </div>` : "";

    this.openModal(`
      <h2>闭关修炼</h2>
      ${this._statusStrip()}
      <p style="color:var(--ink-dim)">于修仙者而言，光阴最是宝贵，也最不值钱。闭得越久，修为越深，可寿元、心境亦在流逝。
      当前每月约可精进修为 ${perMonth}；距本层圆满约需 <b style="color:var(--gold)">${need}</b> 月。</p>
      <div class="modal-actions">
        ${toFullBtn}
        ${optHtml}
        <button class="btn btn-ghost" onclick="UI.closeModal()">再想想</button>
      </div>
      ${studyHtml}
    `);
  },

  /* -------- 突破弹窗 -------- */
  openBreakthrough() {
    const chk = Engine.canBreakthrough();
    const s = State.data;
    const realm = State.data && State.realm();
    if (!chk.ok) {
      this.openModal(`
        <h2>尝试突破</h2>
        <p>${chk.reason}</p>
        <div class="modal-actions"><button class="btn btn-ghost" onclick="UI.closeModal()">知道了</button></div>
      `);
      return;
    }
    const nextRealm = DATA.realms[s.realmIndex + 1];
    const isBig = Engine.isBigRealmBreakthrough();

    // 大境界·渡劫破关：展示秘仪准备清单 + 凶险提示
    if (isBig) {
      const rite = Engine._bigRealmRite() || {};
      const riteChk = Engine.checkRite();
      this.openModal(`
        <h2>大境界 · ${rite.name || nextRealm.name}</h2>
        <p style="color:var(--ink-dim)">${rite.intro || "大境界之关，须十足准备，并历一场凶险心魔劫。"}</p>
        <div class="prep-list">
          ${riteChk.items.map(p => `<div class="prep-row"><span>${p.label}</span><span class="${p.ok ? 'ok' : 'no'}">${p.ok ? '✓ 就绪' : '✗ 不足'}</span></div>`).join("")}
        </div>
        <p style="color:var(--red);font-size:12px;margin-top:8px">⚠ 渡劫凶险：心魔劫远胜寻常心战，败则跌境、重创、心魔暴涨。</p>
        <div class="modal-actions">
          <div class="modal-row">
            <button class="btn btn-secondary" onclick="UI.closeModal()">再候时机</button>
            <button class="btn btn-primary" onclick="UI.closeModal(); Engine.attemptBreakthrough();">引动心魔劫 · 破关</button>
          </div>
        </div>
      `);
      return;
    }

    // 小境界：心魔可控则水到渠成；心魔过盛则须先闯心战
    const rate = Engine.breakthroughRate();
    const pct = Math.round(rate * 100);
    const cls = rate >= 0.7 ? "high" : rate >= 0.4 ? "mid" : "low";
    const demonHigh = s.demon > Balance.demonTrialThreshold();

    // 成功率构成明细：准备的每一项都看得见（准备难=可经营的难）
    const parts = Engine.breakthroughRateParts ? Engine.breakthroughRateParts() : [];
    const partsHtml = parts.map(p => {
      const v = Math.round(p.v * 100);
      const col = v > 0 ? "var(--jade-bright)" : v < 0 ? "var(--red)" : "var(--ink-dim)";
      return `<div class="prep-row"><span>${p.label}</span><span style="color:${col}">${v > 0 ? "+" : ""}${v}%</span></div>`;
    }).join("");

    // 备丹冲关：突破前服丹调整状态（准备的最后一手）
    const PILLS = ["ningshen_dan", "qingyuan_dan", "lingyao_dan"];
    const pillBtns = PILLS.filter(id => State.count(id) > 0).map(id => {
      const it = DATA.items[id];
      return `<button class="btn btn-mini" onclick="Engine.useItem('${id}'); UI.openBreakthrough();">服「${it.name}」×${State.count(id)}　<span style="color:var(--ink-dim);font-size:11px">${effectText(it.effect || {})}</span></button>`;
    }).join("");
    const trialNote = demonHigh
      ? `<p style="color:var(--gold);font-size:12px;margin-top:6px">⚠ 心魔过盛（${Math.round(s.demon)}）：冲关须先闯一场「心战」降伏心魔，否则功亏一篑。</p>`
      : `<p style="color:var(--jade-bright);font-size:12px;margin-top:6px">心魔已伏，可顺势冲关，水到渠成。</p>`;

    this.openModal(`
      <h2>突破 · ${nextRealm.name}</h2>
      <p style="color:var(--ink-dim)">同一大境界内的层次进阶——准备愈充分，胜算愈大；强行冲关，反受其害。</p>
      <div class="prep-list">${partsHtml}</div>
      <div class="rate-display ${cls}">${pct}%</div>
      <div class="rate-label">${demonHigh ? '心战前·基准成功率' : '顺势冲关成功率'}</div>
      ${pillBtns ? `<div class="prep-list" style="margin-top:8px"><div class="prep-row" style="color:var(--gold);font-size:12px"><span>备丹冲关（服丹立时起效）</span></div><div class="modal-actions" style="margin-top:6px">${pillBtns}</div></div>` : ""}
      ${trialNote}
      <div class="modal-actions">
        <div class="modal-row">
          <button class="btn btn-secondary" onclick="UI.closeModal()">再候时机</button>
          <button class="btn btn-primary" onclick="UI.closeModal(); Engine.attemptBreakthrough();">${demonHigh ? '冲关 · 闯心战' : '顺势冲关'}</button>
        </div>
      </div>
    `);
  },

  /* -------- 小绿瓶弹窗 -------- */
  showBottleButton() { this.renderActions(); },
  openBottle() {
    this.renderBottleModal();
  },
  renderBottleModal() {
    const s = State.data;
    const plotsHtml = s.bottle.plots.map((p, i) => {
      if (!p.crop) {
        const seeds = [];
        if (State.count("lingcao")) seeds.push(`<button class="btn btn-mini" onclick="Engine.plantCrop(${i},'lingcao'); UI.renderBottleModal();">种灵草</button>`);
        if (State.count("duyao_cao")) seeds.push(`<button class="btn btn-mini" onclick="Engine.plantCrop(${i},'duyao_cao'); UI.renderBottleModal();">种毒草</button>`);
        return `<div class="plot"><div class="pinfo"><div class="pname">空地块</div><div class="pstat">可投入原料培育</div></div><div style="display:flex;gap:6px">${seeds.join("") || '<span class="pstat">无可种原料</span>'}</div></div>`;
      }
      const crop = DATA.bottle.crops[p.crop];
      const ready = p.growth >= 100;
      return `<div class="plot">
        <div class="pinfo"><div class="pname">${crop.name}</div><div class="pstat">成熟度 ${Math.round(p.growth)}%</div></div>
        ${ready
          ? `<button class="btn btn-mini" onclick="Engine.harvestCrop(${i}); UI.renderBottleModal();">收获</button>`
          : `<span class="pstat">培育中…</span>`}
      </div>`;
    }).join("");

    this.openModal(`
      <h2>神秘小绿瓶</h2>
      <p style="color:var(--ink-dim)">滴入神秘绿液，可催熟瓶中草木。灵草可成灵药（服食大补修为），毒草催熟则毒性剧增。此乃你逆天改命的本钱，切莫示人。</p>
      <div class="bottle-plots">${plotsHtml}</div>
      <div class="modal-actions">
        <button class="btn btn-primary" onclick="Engine.tendBottle(); UI.renderBottleModal();">滴绿液催熟（耗时）</button>
        <button class="btn btn-ghost" onclick="UI.closeModal()">盖上瓶塞</button>
      </div>
    `);
  },
  renderBottle() { /* 兼容入口：弹窗开启时刷新 */ if (!this.el("modal-overlay").hidden) this.renderBottleModal(); },

  /* -------- 奇遇弹窗 -------- */
  openFortune(f) {
    if (typeof Sfx !== "undefined") Sfx.play("chime");
    const s = State.data;
    const choices = f.choices.map((c, i) => {
      const disabled = c.cond && !c.cond(s);
      return `<button class="choice" ${disabled ? 'disabled' : `onclick="Engine.chooseFortune(${i})"`}>
        ${c.text}
        ${c.hint ? `<span class="c-hint">${c.hint}${disabled ? '（条件不足）' : ''}</span>` : ""}
      </button>`;
    }).join("");
    this.openModal(`
      <div class="fortune-tag">奇 遇</div>
      <h2>${f.title}</h2>
      <p>${f.text}</p>
      <div class="choices" style="margin-top:14px">${choices}</div>
    `);
  },

  /* -------- NPC 主动交互弹窗 -------- */
  openInteraction(built) {
    if (!built) return;
    const s = State.data;
    const choices = built.choices.map((c, i) => {
      const dis = c.cond && !c.cond(s);
      return `<button class="choice" ${dis ? 'disabled' : `onclick="Engine.chooseInteraction(${i})"`}>
        ${c.text}${c.hint ? `<span class="c-hint">${c.hint}${dis ? '（条件不足）' : ''}</span>` : ""}
      </button>`;
    }).join("");
    this.openModal(`
      <div class="fortune-tag" style="border-color:var(--blue);color:var(--blue)">有人来访</div>
      <h2>${built.title}</h2>
      <p>${built.text}</p>
      <div class="choices" style="margin-top:14px">${choices}</div>
    `);
  },

  /* -------- 活世界（LLM 叙述层）设置 -------- */
  openLLMSettings() {
    const c = (typeof LLM !== "undefined") ? LLM.config() : { key: "", model: "deepseek/deepseek-v4-flash", on: false };
    const on = (typeof LLM !== "undefined") && LLM.enabled();
    this.openModal(`
      <h2>活世界 · 叙述层</h2>
      <p style="color:var(--ink-dim);font-size:13px">接入大模型，让风云录、散修闲谈、奇遇、闭关见闻等"怎么说"的部分千变万化、有人情味。
      <b style="color:var(--gold)">数值、战斗、主线剧情不受影响</b>，断网或失败自动回退模板文字。</p>
      <p style="color:var(--ink-dim);font-size:12px">密钥只存本机浏览器，不上传、不入代码。推荐 deepseek/deepseek-v4-flash（便宜·中文好·人设稳）。</p>
      <div class="field" style="margin:10px 0">
        <label style="font-size:13px;color:var(--gold)">OpenRouter API Key</label>
        <input id="llm-key" type="password" placeholder="sk-or-v1-..." value="${c.key || ""}" style="width:100%;margin-top:6px" />
      </div>
      <div class="field" style="margin:10px 0">
        <label style="font-size:13px;color:var(--gold)">模型</label>
        <input id="llm-model" type="text" value="${c.model || "deepseek/deepseek-v4-flash"}" style="width:100%;margin-top:6px" />
      </div>
      <p id="llm-state-line" style="color:${on ? 'var(--jade-bright)' : 'var(--ink-dim)'};font-size:12px">当前状态：${on ? "已开启 ✦ 世界正在活起来" : "未开启"}</p>
      <hr style="border:none;border-top:1px solid var(--line);margin:14px 0" />
      <h3 style="color:var(--gold);font-size:14px;margin:0 0 4px">免输入·跨设备</h3>
      <p style="color:var(--ink-dim);font-size:12px">填好密钥并保存后，点下面生成一条「免输入链接」。在手机/电脑上各打开一次（或加到书签/桌面），以后开这条链接就自动导入并开启，<b style="color:var(--gold)">再也不用手填</b>。链接里的密钥只在你的浏览器地址里，不会上传、不入仓库。</p>
      <div class="modal-row">
        <button class="btn btn-secondary" onclick="UI._llmCopyLink()">生成并复制免输入链接</button>
      </div>
      <div id="llm-link-out" style="color:var(--ink-dim);font-size:11px;margin-top:6px;word-break:break-all"></div>
      <div id="llm-test-out" style="font-size:13px;margin:10px 0 4px;min-height:18px;color:var(--ink-dim)">填好密钥后点「保存并开启」</div>
      <div class="modal-actions">
        <div class="modal-row">
          <button class="btn btn-primary" onclick="UI._llmSave(true)">保存并开启</button>
          <button class="btn btn-secondary" onclick="UI._llmSave(false)">仅保存(关闭)</button>
        </div>
        <button class="btn btn-secondary" onclick="UI._llmTest()">测试一句</button>
        <button class="btn btn-ghost" onclick="UI.closeModal()">收起</button>
      </div>
    `);
  },
  // 生成"免输入链接"：把当前已保存的密钥拼进 URL hash（仅本机操作，不外发）
  _llmCopyLink() {
    const out = this.el("llm-link-out");
    const lc = (typeof LLM !== "undefined") ? LLM.config() : { key: "", model: "" };
    const lk = (this.el("llm-key") && this.el("llm-key").value) || lc.key || "";
    if (!lk) { out.textContent = "请先填入密钥再生成链接。"; return; }
    const base = location.origin + location.pathname;
    const parts = ["k=" + encodeURIComponent(lk)];
    const lm = (this.el("llm-model") && this.el("llm-model").value) || lc.model;
    if (lm) parts.push("m=" + encodeURIComponent(lm));
    const link = base + "#" + parts.join("&");
    const done = () => { out.innerHTML = `<span style="color:var(--jade-bright)">已复制！</span> 在另一台设备打开/收藏这条链接即可：<br>${link}`; };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(link).then(done).catch(() => { out.textContent = link; });
    } else { out.textContent = link; }
  },
  _llmSave(on) {
   try {
    const field = (this.el("llm-key").value || "").trim();
    const saved = (LLM.config().key || "");
    // 字段留空但本机已存过 key → 沿用旧 key（不要把好 key 覆盖成空）
    const keyVal = field || saved;
    if (on && !keyVal) { this._llmStatus("请先填入 OpenRouter Key（粘贴后再点开启）", true); return; }
    const ok = LLM.configure({ key: keyVal, model: this.el("llm-model").value, on });
    // 立刻回读，眼见为实
    const cfg = LLM.config();
    const live = LLM.enabled();
    if (ok === false) { this._llmStatus("✗ 保存失败：浏览器存储写不进（无痕模式/已满）", true); return; }
    if (on && !live) { this._llmStatus("已写入但未开启——密钥似乎为空或无效", true); return; }
    this._llmStatus(live
      ? `✦ 已开启　模型 ${cfg.model}　密钥…${(cfg.key||'').slice(-4)}`
      : "已保存（未开启）", false);
    const st = this.el("llm-state-line");
    if (st) { st.textContent = "当前状态：" + (live ? "已开启 ✦ 世界正在活起来" : "未开启"); st.style.color = live ? "var(--jade-bright)" : "var(--ink-dim)"; }
    this.renderAll();
   } catch (e) { this._llmStatus("✗ 出错：" + (e && e.message ? e.message : e), true); }
  },
  _llmStatus(msg, bad) {
    const out = this.el("llm-test-out");
    if (out) { out.textContent = msg; out.style.color = bad ? "var(--red)" : "var(--jade-bright)"; }
  },
  _llmTest() {
    LLM.configure({ key: this.el("llm-key").value, model: this.el("llm-model").value, on: true });
    const out = this.el("llm-test-out");
    out.textContent = "正在请求……";
    LLM.generate("用一句话写一句此刻这世道的市井传闻。", { maxTokens: 200 })
      .then(t => { out.textContent = t ? ("✦ " + t) : "未能获取（请检查密钥/网络）"; })
      .catch(() => { out.textContent = "请求失败（请检查密钥/网络）"; });
  },

  /* -------- 风云录（世间修士命途）-------- */
  openChronicle() {
    const s = State.data;
    const sum = (typeof NPCSIM !== "undefined") ? NPCSIM.summary(s) : { alive: [], dead: [], ascended: [] };
    const news = (s.worldNews || []).slice().reverse();
    const newsHtml = news.length
      ? news.map(n => `<div class="chron-item ${n.kind}"><span class="chron-t">${n.t}</span>${n.text}</div>`).join("")
      : `<div class="inv-empty">世间暂无大事传入你耳中。</div>`;
    const roster = (s.npcFates || []).map(f => {
      const st = f.status === "dead" ? '<span style="color:var(--red)">已殁</span>'
        : f.realm >= 14 ? '<span style="color:var(--gold)">已筑基</span>'
        : `${NPCSIM.realmName(f.realm)} · ${Math.floor(f.age)}岁`;
      return `<div class="roster-row ${f.status === 'dead' ? 'dead' : ''}"><b>${f.name}</b><span>${st}</span></div>`;
    }).join("");
    // 道途年表：你亲手挣来的每一步（投入有形化）
    const KIND_ICON = { breakthrough: "▲", bigitem: "◆", showdown: "⚔", medal: "★", deed: "·" };
    const ms = (s.milestones || []).slice().reverse();
    const msHtml = ms.length
      ? ms.map(m => `<div class="chron-item breakthrough"><span class="chron-t">${m.t}</span><b>${KIND_ICON[m.kind] || "·"} ${m.title}</b></div>`).join("")
      : `<div class="inv-empty">道途尚浅，来日方长。</div>`;
    // 前路：已知的未来=明牌的惦记（动漫党的欲望地图，只示意不剧透）
    const AHEAD = [
      { title: "眨眼剑法 · 大成", done: () => s.swordMastery },
      { title: "练气七层 · 本篇圆满", done: () => s.realmIndex >= 6 },
      { title: "升仙令 · 离门赴黄枫谷", done: () => s.flags.arc1_complete },
      { title: "黄枫谷 · 筑基之路", done: () => false, far: true },
      { title: "？？？ · 灵宠之缘", done: () => false, far: true },
      { title: "乱星海 · 金雷竹", done: () => false, far: true },
    ];
    const aheadHtml = AHEAD.map(a => {
      const ok = a.done();
      return `<div class="chron-item ${ok ? 'breakthrough' : ''}" style="${ok ? '' : 'opacity:.55'}">
        ${ok ? "✦ " : "○ "}<b>${a.title}</b>${ok ? '<span style="color:var(--jade-bright);font-size:11px;margin-left:6px">已达成</span>' : (a.far ? '<span style="color:var(--ink-faint);font-size:11px;margin-left:6px">前路遥遥</span>' : '')}
      </div>`;
    }).join("");
    // 风云榜：彩霞山一带的座次（石碑）——名声是挣来的，名字是事迹堆出来的
    const deadIds = { jinguang: s.flags.jinguang_dead, modafu: s.flags.modafu_dead };
    let board = (typeof WORLD !== "undefined" && WORLD.fameBoard ? WORLD.fameBoard : []).map(f => ({
      name: f.name, title: f.title, fame: f.fame, note: f.note, dead: !!deadIds[f.id],
    }));
    if ((s.fame || 0) > 0) board.push({ name: s.name, title: "七玄门 · 药师", fame: s.fame, note: "事迹渐传，名声渐起。", me: true });
    board.sort((a, b) => (b.fame - a.fame));
    const boardHtml = board.map((f, i) => `
      <div class="fame-row ${f.me ? 'me' : ''} ${f.dead ? 'dead' : ''}">
        <span class="fame-rank">${["甲","乙","丙","丁","戊","己","庚"][i] || i + 1}</span>
        <span class="fame-name">${f.name}${f.dead ? '<span class="fame-dead">殁</span>' : ''}</span>
        <span class="fame-title">${f.title}</span>
        <span class="fame-val">${f.fame}</span>
      </div>`).join("");
    const myFameNote = (s.fame || 0) > 0 ? "" : `<p style="color:var(--ink-faint);font-size:12px;margin:4px 0 0">你尚籍籍无名——伏诛异闻、赢得漂亮、惊世一战，名声自来。</p>`;

    this.openModal(`
      <h2>风云录 · 道途</h2>
      <h3 class="panel-title" style="margin-top:8px">风云榜（彩霞山座次）</h3>
      <div class="fame-stone">${boardHtml}</div>
      ${myFameNote}
      <h3 class="panel-title" style="margin-top:8px">道途年表（你挣来的每一步）</h3>
      <div class="chronicle">${msHtml}</div>
      <h3 class="panel-title">前路（已知的远方）</h3>
      <div class="chronicle">${aheadHtml}</div>
      <p style="color:var(--ink-dim);font-size:12px;margin-top:10px">你离开了，世界并不会停。世间修士各有命数——或精进，或求丹闯秘境，或寿尽身死。</p>
      <h3 class="panel-title">世间众生</h3>
      <div class="roster">${roster || '<div class="inv-empty">—</div>'}</div>
      <h3 class="panel-title">近来传闻</h3>
      <div class="chronicle">${newsHtml}</div>
      <div class="modal-actions"><button class="btn btn-ghost" onclick="UI.closeModal()">合上</button></div>
    `);
  },

  /* -------- 人物图鉴 -------- */
  openCodex() {
    const s = State.data;
    const met = s.metNpcs || [];
    // 只展示本篇相关人物（按是否已结识排序：已识在前）
    const arc = Chapters.active().id;
    const pool = WORLD.npcs.filter(n => {
      // 出现地点属于本篇，或为主线关键人物
      if (!n.where || !n.where.length) return met.includes(n.id);
      return true;
    });
    const known = pool.filter(n => met.includes(n.id));
    const unknown = pool.filter(n => !met.includes(n.id));
    const total = pool.length;

    const cardOf = (n) => {
      const rel = (typeof INTERACTIONS !== "undefined") ? INTERACTIONS.relationOf(s, n.id) : 0;
      const relTxt = rel >= 20 ? "交情深厚" : rel >= 8 ? "相熟" : rel <= -8 ? "心存芥蒂" : "相识";
      const relCls = rel >= 20 ? "rel-deep" : rel >= 8 ? "rel-warm" : rel <= -8 ? "rel-cold" : "";
      // 情报面纱：L0 传闻 / L1 已见招式（交手补全）/ L2 底细（买来的）
      let intelHtml = "";
      const info = (typeof WORLD !== "undefined" && WORLD.intel) ? WORLD.intel[n.id] : null;
      if (info) {
        const lv = (s.intel || {})[n.id] || 0;
        const seen = new Set();
        Object.entries(s.intelMoves || {}).forEach(([ename, arr]) => { if (ename.indexOf(n.name) >= 0) arr.forEach(m => seen.add(m)); });
        const movesHtml = (info.moves || []).map(m =>
          seen.has(m) ? `<span class="iv-move known">${m}</span>` : `<span class="iv-move">？？</span>`).join("");
        // 道基行属：交手中克制触发（打了就懂）或 L2 底细可见
        const GLYPH = { jin: "金", mu: "木", shui: "水", huo: "火", tu: "土" };
        let elemKnown = null;
        Object.entries(s.intelElems || {}).forEach(([ename, el]) => { if (ename.indexOf(n.name) >= 0) elemKnown = el; });
        if (!elemKnown && lv >= 2 && info.elem) elemKnown = info.elem;
        const elemHtml = elemKnown
          ? `<span class="elem-badge elem-${elemKnown}">${GLYPH[elemKnown]}</span> ${GLYPH[elemKnown]}行道基`
          : `<span style="color:var(--ink-faint)">？？（交手便知）</span>`;
        intelHtml = `<div class="codex-intel">
          <div class="iv-row"><span class="iv-tag">传闻</span>${info.l0}</div>
          <div class="iv-row"><span class="iv-tag">道基</span>${elemHtml}</div>
          <div class="iv-row"><span class="iv-tag">招路</span>${movesHtml || "—"}</div>
          <div class="iv-row"><span class="iv-tag">底细</span>${lv >= 2 ? `<span style="color:var(--gold-bright)">${info.l2}</span>` : `<span style="color:var(--ink-faint)">？？？（小算盘或有门路）</span>`}</div>
        </div>`;
      }
      return `<div class="codex-card tappable">
        <div class="codex-head"><b>${n.name}</b><span class="codex-role">${n.role}</span></div>
        <div class="codex-bio">${n.bio}</div>
        ${intelHtml}
        <div class="codex-rel ${relCls}">关系：${relTxt}</div>
      </div>`;
    };
    const lockedCard = `<div class="codex-card locked"><b>？？？</b><div class="codex-bio">尚未相识——行走江湖，自有相逢时。</div></div>`;

    this.openModal(`
      <h2>人物图鉴 <span class="codex-count">${known.length}/${total}</span></h2>
      <p style="color:var(--ink-dim);font-size:12px">行走江湖所遇之人，结识后录入此册。大道无情，有羁绊者，终有离散之时。</p>
      <div class="codex">
        ${known.map(cardOf).join("")}
        ${unknown.map(() => lockedCard).join("")}
      </div>
      <div class="modal-actions"><button class="btn btn-ghost" onclick="UI.closeModal()">合上</button></div>
    `);
  },

  /* -------- 云游（可视化大地图，点击图标前往）——只列当前大陆节点内的去处 -------- */
  openTravel() {
    const cur = State.data.location;
    const arc = Chapters.active().id;
    // 大陆层过滤：地区层云游只显示当前大陆节点的 locs（跨节点须走「远眺天下」旅途）。
    // 地理优先：身在该节点，节点内地点不受篇章 arc 过滤（人到了，地方就在那里）。
    const C = WORLD.continent;
    const curNode = C ? C.nodes.find(n => (n.locs || []).includes(cur)) : null;
    const inNode = (l) => !curNode || (curNode.locs || []).includes(l.id);
    const locs = WORLD.locations.filter(l =>
      !l.scene && l.map && inNode(l) && (curNode || !l.arc || l.arc === arc) && (!l.unlock || l.unlock(State.data)));

    // 连线（从当前所在地到各可去之处）便于看出空间关系
    const curLoc = WORLD.locations.find(l => l.id === cur);
    const lines = (curLoc && curLoc.map)
      ? locs.filter(l => l.id !== cur).map(l =>
          `<line x1="${curLoc.map.x}" y1="${curLoc.map.y}" x2="${l.map.x}" y2="${l.map.y}" class="map-line"/>`).join("")
      : "";

    const pins = locs.map(l => {
      const here = l.id === cur;
      const factor = Balance.travelTimeFactor(State.effectiveSpeed());
      const cost = Math.max(1, Math.round((l.travelCost || 2) * factor));
      return `<div class="map-pin ${here ? 'here' : ''}" style="left:${l.map.x}%;top:${l.map.y}%"
        ${here ? '' : `onclick="UI._travelPick('${l.id}')"`} title="${l.desc}">
        <span class="pin-dot"></span>
        <span class="pin-label">${l.name}${here ? ' ·在此' : `　<span class="pin-cost">${cost}月</span>`}</span>
      </div>`;
    }).join("");

    this.openModal(`
      <h2>云游何处</h2>
      <p style="color:var(--ink-dim);font-size:12px">七玄门内外，点击地图上的地点即可前往。遁速越高，赶路越省光阴。</p>
      <div class="speed-bar">
        <span class="speed-key">移动速度</span>
        <span class="speed-val">${State.effectiveSpeed()}</span>
        <span class="speed-breakdown">基础${State.data.speed}${State.realmSpeedBonus() ? `＋境界${State.realmSpeedBonus()}` : ''}${State.movementArtBonus() ? `＋身法${State.movementArtBonus()}` : ''}${State.flightTreasure().speedBonus ? `＋${State.flightTreasure().name}${State.flightTreasure().speedBonus}` : ''}</span>
        <span class="speed-mount">${State.flightTreasure().name}</span>
      </div>
      <div class="worldmap">
        <svg class="map-lines" viewBox="0 0 100 100" preserveAspectRatio="none">${lines}</svg>
        ${pins}
      </div>
      <div id="map-detail" class="map-detail">${curLoc ? `<b>${curLoc.name}</b>　${curLoc.desc}` : ''}</div>
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick="UI.openContinent()">远眺天下 ▲</button>
        <button class="btn btn-ghost" onclick="UI.closeModal()">不去了</button>
      </div>
    `);
  },
  _travelPick(locId) {
    const l = WORLD.locations.find(x => x.id === locId);
    if (!l) return;
    const factor = Balance.travelTimeFactor(State.effectiveSpeed());
    const cost = Math.max(1, Math.round((l.travelCost || 2) * factor));
    this.el("map-detail").innerHTML = `<b>${l.name}</b>　${l.desc}
      <div style="margin-top:8px"><button class="btn btn-primary btn-mini" onclick="UI.closeModal(); Engine.travelTo('${l.id}')">前往（${cost} 月）</button></div>`;
  },

  /* -------- 大陆层：天南舆图（world-architecture L0）——全图早见，远方=惦记 -------- */
  openContinent() {
    const C = WORLD.continent;
    if (!C) return;
    const s = State.data;
    // 当前所在大陆节点（按地区层归属反查）
    const curNode = C.nodes.find(n => (n.locs || []).includes(s.location)) || C.nodes[0];
    const visited = s.visitedNodes || ["caixia"];
    // 路线：两端皆到过=墨痕实线（走过的路，地图记得）；否则虚线
    const lines = C.routes.map(r => {
      const a = C.nodes.find(n => n.id === r.from), b = C.nodes.find(n => n.id === r.to);
      if (!a || !b) return "";
      const trod = visited.includes(a.id) && visited.includes(b.id);
      return `<line x1="${a.pos.x}" y1="${a.pos.y}" x2="${b.pos.x}" y2="${b.pos.y}" class="map-line${trod ? ' trod' : ''}"/>`;
    }).join("");
    const pins = C.nodes.map(n => {
      const here = n.id === curNode.id;
      const gateMsg = n.gate ? n.gate(s) : null;
      const cls = n.silhouette ? "silhouette" : gateMsg ? "gated" : "";
      return `<div class="map-pin cont ${here ? 'here' : ''} ${cls}" style="left:${n.pos.x}%;top:${n.pos.y}%"
        onclick="UI._contPick('${n.id}')">
        <span class="pin-dot"></span>
        <span class="pin-label">${n.name}${here ? ' ·在此' : ''}</span>
      </div>`;
    }).join("");
    const mapUrl = (typeof Art !== "undefined" && C.map) ? Art.url(C.map) : null;
    this.openModal(`
      <h2>天下 · ${C.name}</h2>
      <p style="color:var(--ink-dim);font-size:12px">天地之大，远超彩霞山一隅。看得见的远方，未必是去得了的远方——道阻且长，修为、盘缠、机缘，缺一不可。</p>
      <div class="worldmap continent${mapUrl ? ' inked' : ''}"${mapUrl ? ` style="background-image:url('${mapUrl}')"` : ''}>
        <div class="map-mist"></div>
        <div class="map-mist far"></div>
        <svg class="map-lines" viewBox="0 0 100 100" preserveAspectRatio="none">${lines}</svg>
        ${pins}
      </div>
      <div id="cont-detail" class="map-detail"><b>${curNode.name}</b>　${curNode.desc}</div>
      <div class="modal-actions">
        <button class="btn btn-ghost" onclick="UI.openTravel()">回到近处</button>
        <button class="btn btn-ghost" onclick="UI.closeModal()">收起</button>
      </div>
    `, "wide");
  },
  _contPick(nodeId) {
    const C = WORLD.continent;
    const n = C.nodes.find(x => x.id === nodeId);
    if (!n) return;
    const s = State.data;
    const gateMsg = n.gate ? n.gate(s) : null;
    let action = "";
    if (n.silhouette) action = `<div class="cont-gate">传说之地——此生若能至，方不负修行。</div>`;
    else if (gateMsg) action = `<div class="cont-gate">道途未通：${gateMsg}</div>`;
    else if ((n.locs || []).includes(s.location)) action = `<div class="cont-gate" style="color:var(--jade-bright)">你正在此地。</div>`;
    else action = `<div class="cont-gate">旅途约 ${n.months || 2} 月 · 险度${n.danger || "未知"}　
      <button class="btn btn-primary btn-mini" onclick="Engine.startJourney('${n.id}')">启程</button></div>`;
    this.el("cont-detail").innerHTML = `<b>${n.name}</b>　${n.desc}${action}`;
  },

  /* -------- 集镇采买 -------- */
  openMarket() {
    const s = State.data;
    const blackMarket = s.rippleWindow && s.rippleWindow.id === "cheap_pills";
    const shop = [
      { id: "lingcao", price: 3 }, { id: "duyao_cao", price: 6 },
      { id: "qingyuan_dan", price: blackMarket ? 3 : 8, sale: blackMarket }, { id: "huixue_dan", price: 6 }, { id: "ningshen_dan", price: 14 },
      { id: "huoshe_fu", price: 20 }, { id: "hanbing_fu", price: 20 },
    ];
    const html = shop.map(it => {
      const item = DATA.items[it.id];
      return `<div class="market-item">
        <span><span class="iname ${item.rarity==='rare'?'rare':item.rarity==='epic'?'epic':''}">${item.name}</span>
          ${it.sale ? '<span style="color:var(--red);font-size:11px">　黑市贱卖</span>' : ''}
          <span style="color:var(--ink-dim);font-size:12px">　${item.desc}</span></span>
        <button class="btn btn-mini" onclick="Engine.buy('${it.id}')"><span class="mprice">${it.price}两</span></button>
      </div>`;
    }).join("");
    this.openModal(`
      <h2>山下集镇 · 采买</h2>
      <p style="color:var(--ink-dim)">纹银：${State.data.silver} 两</p>
      ${blackMarket ? '<p style="color:var(--gold);font-size:12px">巷尾的药贩子朝你挤眼——丹房失窃的那批养元丹，正在黑市贱卖。过了这村没这店。</p>' : ''}
      ${html}
      <div class="modal-actions"><button class="btn btn-ghost" onclick="UI.closeModal()">离开</button></div>
    `);
  },

  /* -------- 太南小会（修仙者的集市）-------- */
  openFair() {
    const s = State.data;
    const goods = Engine.FAIR_GOODS.map(g => {
      const item = DATA.items[g.id];
      const owned = g.once && State.count(g.id) > 0;
      return `<div class="market-item">
        <span><span class="iname ${item.rarity === 'rare' ? 'rare' : item.rarity === 'epic' ? 'epic' : ''}">${item.name}</span>${g.n > 1 ? `×${g.n}` : ""}
          <span style="color:var(--gold);font-size:11px">　${g.note || ""}</span>
          <span style="color:var(--ink-dim);font-size:12px">　${item.desc}</span></span>
        ${owned ? `<span style="color:var(--ink-faint);font-size:12px">已购得</span>`
                : `<button class="btn btn-mini" onclick="Engine.fairBuy('${g.id}')"><span class="mprice">灵石${g.price}</span></button>`}
      </div>`;
    }).join("");
    const sells = [
      { id: "qingyuan_dan", label: "养元丹 ×1 → 灵石×1", has: State.count("qingyuan_dan") >= 1 },
      { id: "duyao_cao", label: "毒草 ×2 → 灵石×1", has: State.count("duyao_cao") >= 2 },
    ].map(x => `<div class="market-item">
      <span style="color:var(--ink-dim);font-size:13px">${x.label}</span>
      ${x.has ? `<button class="btn btn-mini" onclick="Engine.fairSell('${x.id}')">售出</button>`
              : `<span style="color:var(--ink-faint);font-size:12px">不足</span>`}
    </div>`).join("");
    this.openModal(`
      <h2>太南小会 · 赶集</h2>
      <p style="color:var(--ink-dim)">灵石：${State.count("lingshi")} 枚　纹银在这里没人收——修仙人只认灵石。</p>
      ${goods}
      <h3 class="panel-title" style="margin-top:10px">以物易石（摊主收购）</h3>
      ${sells}
      <div class="modal-actions"><button class="btn btn-ghost" onclick="UI.closeModal()">离开</button></div>
    `);
  },

  /* ===========================================================
   *  战斗界面
   * =========================================================== */
  _combatTarget: 0,
  openCombat(combat, meta) {
    this.el("combat-overlay").hidden = false;
    const titles = { encounter: "斗 法", showdown: "夺舍之夜 · 决战", breakthrough: "突破 · 心战", jinguang: "暗算金光上人" };
    this.el("combat-title").textContent = titles[meta.type] || "斗 法";
    // 战斗背景：心战用墨黑，其余用当前地点场景图（压暗虚化）
    const bg = this.el("combat-bg");
    if (bg) {
      const loc = State.location();
      const url = (meta.type !== "breakthrough" && loc && typeof Art !== "undefined") ? Art.locUrl(loc) : null;
      bg.style.backgroundImage = url ? `url("${url}")` : "";
      bg.classList.toggle("on", !!url);
      this.el("combat-overlay").classList.toggle("mind", meta.type === "breakthrough");
    }
    const endBtn = this.el("combat-endround");
    endBtn.onclick = () => Engine.combatEndRound();
    this._combatTarget = combat.enemies.findIndex(e => e.alive);
    this._combatLogLen = 0;
    if (typeof Sfx !== "undefined") Sfx.play("danger");
    this.renderCombat(combat, meta);
    this._flashCombatBanner(meta, combat);
  },

  // 敌人名 → 立绘（剧情人物用其立绘；心魔用业障之人的脸，无业障用韩立暗影）
  _artIdByName(name) {
    if (!name || typeof Art === "undefined") return null;
    if (/心魔|劫/.test(name)) {
      if (/墨大夫/.test(name)) return "modafu";
      if (/张铁/.test(name)) return "zhangtie";
      return "hanli";
    }
    if (/铁奴/.test(name)) return Art.has("tienu") ? "tienu" : "zhangtie";
    if (/张铁/.test(name)) return "zhangtie";
    const all = (typeof WORLD !== "undefined" && WORLD.npcs) ? WORLD.npcs : [];
    for (const n of all) { if (name.indexOf(n.name) >= 0 && Art.has(n.id)) return n.id; }
    if (/散修/.test(name) && Art.has("sanxiu")) return "sanxiu";
    if (/喽啰|野狼帮/.test(name) && Art.has("langhao")) return "langhao";
    return null;
  },
  // 无立绘敌人的字符玉牌
  _enemyGlyph(name) {
    if (/狼/.test(name)) return "狼";
    if (/贼/.test(name)) return "贼";
    if (/弟子/.test(name)) return "武";
    if (/蜈|虫/.test(name)) return "虫";
    return "敌";
  },
  // 开战时的醒目横幅（让"遭遇/决战/渡劫"有明确的起始感）
  _flashCombatBanner(meta, combat) {
    const el = this.el("combat-banner");
    if (!el) return;
    const enemyName = (combat.enemies[0] && combat.enemies[0].name) || "强敌";
    const banners = {
      encounter: { t: "遭 遇 敌 袭", s: enemyName + " 拦路，斗法一触即发", cls: "b-red" },
      showdown:  { t: "夺 舍 之 夜", s: "成败生死，皆在今夜", cls: "b-purple" },
      jinguang:  { t: "暗 算 金 光 上 人", s: "硬拼必败，唯毒与暗器可破", cls: "b-gold" },
      breakthrough: { t: meta.big ? "渡 劫 · 心 魔 劫" : "突 破 · 心 战", s: meta.big ? "脱胎换骨，九死一生" : "降伏心魔，方能更进一层", cls: "b-jade" },
    };
    const b = banners[meta.type] || banners.encounter;
    el.className = "combat-banner " + b.cls;
    el.innerHTML = `<div class="cb-title">${b.t}</div><div class="cb-sub">${b.s}</div>`;
    el.hidden = false;
    el.classList.remove("show"); void el.offsetWidth; el.classList.add("show");
    clearTimeout(this._bannerTimer);
    this._bannerTimer = setTimeout(() => { el.hidden = true; }, 1600);
  },
  closeCombat() { this.el("combat-overlay").hidden = true; },

  // 施法反馈：目标震动 + 招式名横幅一闪
  flashCombat(spellId) {
    const box = this.el("combat-enemies");
    if (box) {
      const t = box.querySelector(".combatant.target") || box.querySelector(".combatant");
      if (t) { t.classList.remove("shake"); void t.offsetWidth; t.classList.add("shake"); }
    }
    // 招式名大字横幅
    if (spellId && typeof CombatAPI !== "undefined") {
      const sp = CombatAPI.SPELLS[spellId];
      const el = this.el("combat-cast");
      if (sp && el) {
        const wx = Object.keys(sp.cost || {})[0] || "jin";
        el.innerHTML = `<span class="cc-name wx-${wx}">${sp.name}</span>`;
        el.hidden = false;
        el.classList.remove("show"); void el.offsetWidth; el.classList.add("show");
        clearTimeout(this._castTimer);
        this._castTimer = setTimeout(() => { el.hidden = true; }, 700);
      }
      if (typeof Sfx !== "undefined") Sfx.play(sp && sp.type === "heal" ? "heal" : sp && sp.type === "def" ? "shield" : "sword");
    }
  },

  // 弹出战斗飘字（消费引擎的 fx 队列）
  flushCombatFx(c) {
    if (!c || !c._fx || !c._fx.length) return;
    const fx = c._fx.slice();
    c._fx.length = 0;
    let delay = 0;
    for (const f of fx) {
      const anchor = f.ref === "player"
        ? this.el("combat-player")
        : f.ref === "side"
        ? (this.el("combat-player").querySelector(".side-unit") || this.el("combat-player"))
        : (this.el("combat-enemies").children[parseInt(f.ref.split(":")[1], 10)] || this.el("combat-enemies"));
      if (!anchor) continue;
      setTimeout(() => this._popFloat(anchor, f.kind, f.text), delay);
      delay += 180;
    }
  },
  _popFloat(anchor, kind, text) {
    const el = document.createElement("div");
    el.className = "float-fx fx-" + kind;
    el.textContent = text;
    anchor.style.position = "relative";
    anchor.appendChild(el);
    setTimeout(() => el.remove(), 1100);
  },

  // 玩家手动切换攻击目标
  pickTarget(i) {
    if (!Engine._combat) return;
    const e = Engine._combat.enemies[i];
    if (!e || !e.alive) return;
    this._combatTarget = i;
    this.renderCombat(Engine._combat, Engine._combatMeta);
  },
  // 当前有效目标（首个存活兜底）
  curTarget(c) {
    if (this._combatTarget != null && c.enemies[this._combatTarget] && c.enemies[this._combatTarget].alive) return this._combatTarget;
    return c.enemies.findIndex(e => e.alive);
  },

  // 神识料敌：根据意图类型给出"该如何应对"的提示（看穿意图=真决策）
  _intentHint(intent) {
    const dmg = intent.dmg || 0;
    if (intent.kind === "charge")
      return `「${intent.name}」正在<b style="color:var(--gold)">蓄力</b>——本回合它不出手！正是你叠毒、攒剑势、全力爆发的良机。`;
    if (intent.kind === "release")
      return `「${intent.name}」<b style="color:var(--red)">蓄力爆发（约${dmg}伤）</b>！速以眨眼剑法叠闪避，护体挡不住。`;
    if (intent.kind === "pierce")
      return `「${intent.name}」<b style="color:var(--blue)">破甲（约${dmg}伤）</b>——护体无效，唯眨眼剑法叠闪避可避。`;
    return `「${intent.name}」（约${dmg}伤）——寻常攻击，长春护体即可挡下。`;
  },

  renderCombat(c, meta) {
    const SP = CombatAPI.SPELLS;
    const EL = CombatAPI.ELEM_NAME;
    const target = this.curTarget(c);
    const adv = target >= 0 ? c.senseVs(c.enemies[target]) : { seeIntent: false };
    const multi = c.enemies.length > 1;
    const isBT = meta.type === 'breakthrough';

    // 敌方：立绘对峙 + 血条 + 意图
    const ELEM_GLYPH = { jin: "金", mu: "木", shui: "水", huo: "火", tu: "土" };
    const knownElems = (typeof State !== "undefined" && State.data.intelElems) || {};
    this.el("combat-enemies").innerHTML = c.enemies.map((e, i) => {
      const tags = [];
      // 道基行徽：情报门控——打过（揭示）或买过底细（L2）才看得见对方的根脚
      if (e.elem && (knownElems[e.name] || e._dossier)) {
        tags.push(`<span class="elem-badge elem-${e.elem}">${ELEM_GLYPH[e.elem]}</span>`);
      }
      if (e.immunePoison) tags.push("百毒不侵");
      if (e.soulOnly) tags.push("神魂之体");
      const statusTxt = e.status.poison ? `<span class="cstatus">☠ 中毒 ${e.status.poison.dmg}/回合·余${e.status.poison.turns}</span>` : "";
      const intentTxt = (i === target && adv.seeIntent && e.intent && e.alive)
        ? `<div class="cintent">⚡ 神识料敌：${this._intentHint(e.intent)}</div>` : "";
      const hpPct = Math.max(0, e.hp / e.hpMax * 100);
      const shieldPct = e.shield ? Math.min(100, e.shield / e.hpMax * 100) : 0;
      // 立绘 / 字符玉牌
      const aid = this._artIdByName(e.name);
      const demonized = isBT || /心魔/.test(e.name);
      const fig = aid
        ? `<div class="cfigure${demonized ? " demonized" : ""}"><img src="${Art.url(aid)}" alt="" /></div>`
        : `<div class="cfigure glyph"><span>${this._enemyGlyph(e.name)}</span></div>`;
      return `<div class="combatant enemy ${e.alive ? '' : 'dead'} ${i === target ? 'target' : ''}" ${e.alive && multi ? `onclick="UI.pickTarget(${i})"` : ''}>
        ${fig}
        <div class="cinfo">
          <div class="cname"><b>${e.name}</b><span class="ctag">${tags.join(' ')}</span></div>
          <div class="cbar">
            <div class="cbar-fill" style="width:${hpPct}%"></div>
            ${shieldPct ? `<div class="cbar-fill shield" style="width:${shieldPct}%"></div>` : ''}
          </div>
          <div class="cbar-num">气血 ${Math.max(0, Math.round(e.hp))}/${e.hpMax}${e.shield ? `　<span style="color:var(--blue)">护体${e.shield}</span>` : ''}</div>
          ${statusTxt}
        </div>
        ${intentTxt}
        ${i === target && e.alive ? '<div class="target-tag">◈ 锁定</div>' : ''}
      </div>`;
    }).join("");

    // 我方：韩立立绘 + 道心/气血
    const p = c.player;
    const hpPct = Math.max(0, p.hp / p.hpMax * 100);
    const shieldPct = p.shield ? Math.min(100, p.shield / p.hpMax * 100) : 0;
    const hurl = (typeof Art !== "undefined") ? Art.url("hanli") : null;
    // 侧位单位（尸傀/灵宠/同道）：主人身侧的窄卡
    const isAlly = c.side && c.side.kind === "ally";
    const sideHtml = c.side ? `<div class="combatant side-unit ${c.side.hp > 0 ? '' : 'dead'}">
      ${isAlly && c.side.art && typeof Art !== "undefined" && Art.url(c.side.art)
        ? `<div class="cfigure side-fig"><img src="${Art.url(c.side.art)}" alt="" /></div>` : ""}
      <div class="cinfo">
        <div class="cname"><b>${c.side.name}</b><span class="ctag">${c.side.hp > 0 ? (isAlly ? '同道' : '随行') : (isAlly ? '重伤退场' : '倒地')}</span></div>
        <div class="cbar"><div class="cbar-fill side" style="width:${Math.max(0, c.side.hp / c.side.hpMax * 100)}%"></div></div>
        <div class="cbar-num">${isAlly ? '气血' : '躯体'} ${Math.max(0, Math.round(c.side.hp))}/${c.side.hpMax}</div>
      </div>
    </div>` : "";
    this.el("combat-player").innerHTML = `<div class="combatant self">
      ${hurl ? `<div class="cfigure"><img src="${hurl}" alt="" /></div>` : ""}
      <div class="cinfo">
        <div class="cname"><b>${p.name}</b><span class="ctag">${isBT ? '道心之战' : `神识${p.sense}·遁速${p.speed}`}</span></div>
        <div class="cbar">
          <div class="cbar-fill self" style="width:${hpPct}%"></div>
          ${shieldPct ? `<div class="cbar-fill shield" style="width:${shieldPct}%"></div>` : ''}
        </div>
        <div class="cbar-num">${isBT ? '道心' : '气血'} ${Math.max(0, Math.round(p.hp))}/${p.hpMax}${p.shield ? `　<span style="color:var(--blue)">护体${p.shield}</span>` : ''}</div>
        ${p.status.poison ? `<span class="cstatus">☠ 中毒 ${p.status.poison.dmg}/回合</span>` : ''}
      </div>
    </div>` + sideHtml;

    // 五行灵气珠池：五色玉珠，充盈发光、空则黯淡
    this.el("combat-qi").innerHTML =
      CombatAPI.ELEMENTS.map(e =>
        `<div class="qi-orb ${e} ${c.qi[e] > 0 ? 'lit' : 'zero'}" title="${EL[e]}行灵气">
          <span class="qo-char">${EL[e]}</span><b class="qo-n">${c.qi[e]}</b>
        </div>`
      ).join("") +
      (p.momentum ? `<div class="qi-orb momentum lit" title="剑势：连击可引爆"><span class="qo-char">势</span><b class="qo-n">${p.momentum}</b></div>` : "");

    // 法术/招式 与 底牌 分区渲染（底牌=消耗性手段，独立体系，不与灵技混排）
    const spellBtn = (id, extraCls) => {
      const sp = SP[id];
      const wx = sp.elem || Object.keys(sp.cost || {})[0] || "jin";
      const costDots = Object.entries(sp.cost).map(([e, n]) =>
        e === "any"
          ? `<span class="cost-dot free" title="任意一系灵气">任${n}</span>`
          : `<span class="cost-dot wx-${e}" title="${EL[e]}行">${EL[e]}${n}</span>`).join("") || `<span class="cost-dot free">无耗</span>`;
      const afford = c.canAfford(id);
      const noPouch = sp.consume && !(p.pouch[sp.consume] > 0);
      const pouchTxt = sp.consume ? `<span class="spouch ${noPouch ? 'empty' : ''}">余 ×${p.pouch[sp.consume] || 0}</span>` : "";
      // 剑法大成：本体名号蜕变（提升感写在脸上）
      const dispName = (id === "zhayan" && p.swordMastery) ? "眨眼剑法·大成" : sp.name;
      const dispFx = (id === "zhayan" && p.swordMastery) ? spellEffectText(sp) + " 攒势×2" : spellEffectText(sp);
      return `<button class="spell-btn ${extraCls || ''} ${afford ? '' : 'off'}" ${afford ? '' : 'disabled'} onclick="Engine.combatCast('${id}', ${target})" title="${sp.desc || ''}">
        <span class="seal ${sp.consume ? 'cinnabar' : 'wx-' + wx}">${sealChar(sp.name)}</span>
        <span class="sp-body">
          <span class="sname">${dispName}</span>
          <span class="scost">${costDots} ${dispFx}${pouchTxt}</span>
        </span>
      </button>`;
    };
    const mains = p.spells.filter(id => SP[id] && !SP[id].consume);
    const trumps = p.spells.filter(id => SP[id] && SP[id].consume);
    this.el("combat-spells").innerHTML =
      mains.map(id => spellBtn(id)).join("") +
      (trumps.length ? `<div class="trump-row"><span class="trump-tag">底牌</span>${trumps.map(id => spellBtn(id, "trump")).join("")}</div>` : "");

    // 战斗日志
    const logs = c.log.slice(-9);
    this.el("combat-log").innerHTML = logs.map((l, i) => {
      const cls = /造成|毒发|中的|尽灭|胜/.test(l) ? "cl-hit" : /受到|气血耗尽|败|逆冲/.test(l) ? "cl-hurt" : i === logs.length - 1 ? "cl-new" : "";
      return `<div class="${cls}">${l}</div>`;
    }).join("");
    this.el("combat-log").scrollTop = this.el("combat-log").scrollHeight;
  },

  /* ===========================================================
   *  箱庭探索界面（走格子副本/秘境）
   * =========================================================== */
  openExplore(state) {
    if (!state) return;
    this.el("explore-overlay").hidden = false;
    this.el("explore-title").textContent = state.siteName;
    // 绑定方向键
    this.el("explore-overlay").querySelectorAll(".dpad-btn[data-dir]").forEach(btn => {
      btn.onclick = () => { const d = btn.dataset.dir; if (d) Engine.exploreMove(d); };
    });
    this.el("explore-leave").onclick = () => Engine.finishExplore(false);
    // 键盘支持（桌面）
    this._exploreKeyHandler = (e) => {
      const map = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
        w: "up", s: "down", a: "left", d: "right" };
      if (map[e.key]) { e.preventDefault(); Engine.exploreMove(map[e.key]); }
    };
    document.addEventListener("keydown", this._exploreKeyHandler);
    this.renderExplore(state);
  },
  closeExplore() {
    this.el("explore-overlay").hidden = true;
    if (this._exploreKeyHandler) { document.removeEventListener("keydown", this._exploreKeyHandler); this._exploreKeyHandler = null; }
  },

  renderExplore(state) {
    if (!state) return;
    const CO = Explore.CONTENT, TE = Explore.TERRAIN;
    const px = state.player.x, py = state.player.y;

    // 主网格
    const grid = this.el("explore-grid");
    grid.style.gridTemplateColumns = `repeat(${state.w}, 1fr)`;
    let cellsHtml = "";
    for (let y = 0; y < state.h; y++) {
      for (let x = 0; x < state.w; x++) {
        const c = Explore.cellAt(state, x, y);
        const isPlayer = x === px && y === py;
        const comp = state.companions.find(cp => cp.alive && cp.x === x && cp.y === y);
        let cls = "ex-cell " + (c.discovered ? "seen " : "fog ") + (TE[c.terrain].blocked ? "blocked " : "");
        let inner = "";
        if (c.discovered) {
          // 隐秘暗室未被神识察觉时不显形
          if (c.content && CO[c.content] && !c.hidden) inner = `<span class="ex-icon${CO[c.content].boss ? ' boss' : ''}">${CO[c.content].icon}</span>`;
          if (TE[c.terrain].blocked) inner = `<span class="ex-icon dim">${c.terrain === "water" ? "💧" : "⛰"}</span>`;
        } else if (state.farMark && state.farMark.x === x && state.farMark.y === y && c.content === "boss") {
          // 远惦记剪影：迷雾深处隐约可见兽踪（入图便有"去不去"的惦记）
          inner = `<span class="ex-icon far-mark">👹</span>`;
        }
        if (comp) inner = `<span class="ex-icon comp">🧍</span>`;
        if (isPlayer) { inner = `<span class="ex-icon you">🧙</span>`; cls += "player "; }
        // 相邻可走格高亮（可点击移动）
        const adj = (Math.abs(x - px) + Math.abs(y - py)) === 1;
        if (adj && Explore.canMove(state, x, y)) cls += "reach ";
        const clickAttr = (adj && Explore.canMove(state, x, y))
          ? `onclick="UI._exploreClickMove(${x},${y})"` : "";
        cellsHtml += `<div class="${cls}" ${clickAttr}>${inner}</div>`;
      }
    }
    grid.innerHTML = cellsHtml;

    // 小地图缩略（点击展开完整地图）
    const mini = this.el("explore-minimap");
    mini.style.gridTemplateColumns = `repeat(${state.w}, 1fr)`;
    mini.innerHTML = this._minimapCells(state);
    mini.onclick = () => this.openExploreMap(state);

    // 信息条
    const months = Explore.timeCostMonths(state);
    const remain = Explore.remainingResources(state);
    this.el("explore-info").innerHTML =
      `步数 ${state.steps}　耗时约 ${months} 月　余 ${remain} 处资源`;

    // 本次背包
    const bag = state.bag;
    const keys = Object.keys(bag).filter(k => bag[k] > 0);
    this.el("explore-bag").innerHTML =
      `<div class="exbag-title">采集所得</div>` +
      (keys.length
        ? keys.map(k => `<div class="exbag-item"><span>${DATA.items[k] ? DATA.items[k].name : k}</span><b>×${bag[k]}</b></div>`).join("")
        : `<div class="exbag-empty">尚无所获</div>`);

    // 日志
    const log = this.el("explore-log");
    log.innerHTML = state.log.slice(-5).map(l => `<div>${l}</div>`).join("");
    log.scrollTop = log.scrollHeight;
  },

  // 点击相邻格移动（换算成方向）
  _exploreClickMove(x, y) {
    const st = State.data.explore;
    if (!st) return;
    const dx = x - st.player.x, dy = y - st.player.y;
    if (dx === 1) Engine.exploreMove("right");
    else if (dx === -1) Engine.exploreMove("left");
    else if (dy === 1) Engine.exploreMove("down");
    else if (dy === -1) Engine.exploreMove("up");
  },

  // 采集时让该格闪一下（视觉反馈）
  flashExploreCell(x, y) {
    const grid = this.el("explore-grid");
    if (!grid) return;
    const st = State.data.explore;
    if (!st) return;
    const idx = y * st.w + x;
    const cell = grid.children[idx];
    if (cell) { cell.classList.remove("collected"); void cell.offsetWidth; cell.classList.add("collected"); }
  },

  // 生成小地图格子 HTML（已探明区域 + 你的红点 + 出口/资源等）
  _minimapCells(state) {
    const TE = Explore.TERRAIN, CO = Explore.CONTENT;
    const px = state.player.x, py = state.player.y;
    let html = "";
    for (let y = 0; y < state.h; y++) {
      for (let x = 0; x < state.w; x++) {
        const c = Explore.cellAt(state, x, y);
        const comp = state.companions.find(cp => cp.alive && cp.x === x && cp.y === y);
        let cls = "mini-cell ";
        if (x === px && y === py) cls += "m-you";
        else if (!c.discovered) cls += "m-fog";
        else if (comp) cls += "m-comp";
        else if (c.content === "exit") cls += "m-exit";
        else if (c.content === "entry") cls += "m-entry";
        else if (c.content && CO[c.content] && CO[c.content].loot) cls += "m-res";
        else if (c.content === "beast") cls += "m-beast";
        else if (TE[c.terrain].blocked) cls += "m-block";
        else cls += "m-floor";
        html += `<div class="${cls}"></div>`;
      }
    }
    return html;
  },

  // 点开完整地图：展示全部已探索区域、你的红点、同伴、出口与图例
  openExploreMap(state) {
    state = state || State.data.explore;
    if (!state) return;
    const remain = Explore.remainingResources(state);
    const discovered = state.cells.filter(c => c.discovered).length;
    const pct = Math.round(discovered / (state.w * state.h) * 100);
    this.openModal(`
      <h2>${state.siteName} · 全图</h2>
      <p style="color:var(--ink-dim);font-size:12px">已探明 ${pct}%　·　余 ${remain} 处资源未取　·　步数 ${state.steps}</p>
      <div class="fullmap" style="grid-template-columns:repeat(${state.w},1fr)">${this._minimapCells(state)}</div>
      <div class="map-legend">
        <span><i class="lg m-you"></i>你</span>
        <span><i class="lg m-comp"></i>同伴</span>
        <span><i class="lg m-res"></i>资源</span>
        <span><i class="lg m-beast"></i>凶兽</span>
        <span><i class="lg m-exit"></i>出口</span>
        <span><i class="lg m-entry"></i>入口</span>
        <span><i class="lg m-fog"></i>未探</span>
      </div>
      <div class="modal-actions"><button class="btn btn-ghost" onclick="UI.closeModal()">收起</button></div>
    `);
  },

  /* -------- 突破大典：黑场二字题 + 收益清单 + 藏拙抉择（"丹成"模板）-------- */
  breakthroughCeremony(realm, gains, wasBig) {
    let ov = this.el("ceremony-overlay");
    if (!ov) {
      ov = document.createElement("div");
      ov.id = "ceremony-overlay";
      ov.className = "ceremony-overlay";
      document.body.appendChild(ov);
    }
    const s = State.data;
    const hidden = s.realmIndex - (s.revealedRealm != null ? s.revealedRealm : s.realmIndex);
    ov.innerHTML = `
      <div class="cer-inner">
        <div class="cer-title">${wasBig ? "破 境" : "突 破"}</div>
        <div class="cer-realm">${realm.name}</div>
        <div class="cer-text">${wasBig
          ? "天地灵气如百川归海，灌入四肢百骸——旧日瓶颈訇然中开，你已非昨日之你。"
          : "灵力冲开窍穴，经脉间一阵久违的通透。你缓缓吐出一口浊气，眼底神光更盛。"}</div>
        <div class="cer-gains">${gains.map(g => `<div class="cer-gain">· ${g}</div>`).join("")}</div>
        <div class="cer-actions">
          <button class="btn btn-secondary" onclick="UI._ceremonyEnd(false)">不动声色（深藏不露）</button>
          <button class="btn btn-ghost" onclick="UI._ceremonyEnd(true)">渐露锋芒（示人以真）</button>
        </div>
        ${hidden > 0 || true ? `<div class="cer-note">藏拙：示人境界不变，他人小觑于你——关键一战亮出真修为，方有雷霆之势。</div>` : ""}
      </div>`;
    ov.classList.add("show");
  },
  _ceremonyEnd(reveal) {
    const s = State.data;
    if (reveal) {
      s.revealedRealm = s.realmIndex;
      this.toast(`你不再遮掩修为——如今示人：${State.realm().name}`);
    } else {
      if (s.revealedRealm == null) s.revealedRealm = Math.max(0, s.realmIndex - 1);
      const hid = s.realmIndex - s.revealedRealm;
      this.toast(`真人不露相（已深藏 ${hid} 层修为）`);
    }
    const ov = this.el("ceremony-overlay");
    if (ov) ov.classList.remove("show");
    State.save();
    this.renderAll();
  },

  /* -------- 系统菜单（手机端 ☰ 收纳全部系统入口）-------- */
  openSystemMenu() {
    const soundOn = (typeof Sfx !== "undefined") && Sfx.enabled();
    this.openModal(`
      <h2>系统</h2>
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick="UI.closeModal(); UI.openCodex()">人物图鉴</button>
        <button class="btn btn-secondary" onclick="UI.closeModal(); UI.openChronicle()">风云录</button>
        <button class="btn btn-secondary" onclick="UI.closeModal(); UI.openTechniques()">功法 · 配装</button>
        <button class="btn btn-secondary" onclick="UI.closeModal(); UI.openLLMSettings()">活世界（实时对谈）</button>
        <button class="btn btn-secondary" onclick="if(typeof Sfx!=='undefined'){Sfx.toggle();} UI.openSystemMenu();">音效：${soundOn ? "开" : "关"}（点击切换）</button>
        <button class="btn btn-secondary" onclick="UI.closeModal(); State.save() ? UI.toast('已存档') : UI.toast('存档失败', true)">存档</button>
        <button class="btn btn-ghost" onclick="UI.closeModal(); Main.toCreate()">回主菜单</button>
        <button class="btn btn-ghost" onclick="UI.closeModal()">返回</button>
      </div>
    `);
  },

  /* -------- 通用弹窗 / Toast -------- */
  openModal(html, variant) {
    const m = this.el("modal");
    m.innerHTML = html;
    m.className = "modal" + (variant ? " modal-" + variant : "");
    this.el("modal-overlay").hidden = false;
  },
  closeModal() { this.el("modal-overlay").hidden = true; },

  toast(msg, bad = false) {
    const t = this.el("toast");
    t.textContent = msg;
    t.className = "toast" + (bad ? " bad" : "");
    t.hidden = false;
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => { t.hidden = true; }, 2200);
  },
};

function rarityLabel(r) { return { common: "凡品", rare: "灵品", epic: "宝品" }[r] || "凡品"; }
function gradeLabel(g) { return { 1: "黄阶", 2: "玄阶", 3: "地阶", 4: "天阶" }[g] || "黄阶"; }
function typeLabel(t) { return { pill: "丹药", material: "材料", currency: "通货", skill: "功法" }[t] || "杂物"; }
// 印章字：法术/功法/物品名 → 单字方章（图标语言：道藏印章，详见 art-direction.md）
const SEAL_CHARS = {
  "长春吐纳": "吐", "长春护体": "护", "凝神静气": "凝", "眨眼剑法": "剑", "眨眼连击": "连",
  "喂毒一击": "毒", "暗器飞针": "针", "运功镇魂": "魂",
  "长春功": "春", "青元剑诀": "青", "大衍诀": "衍", "眨眼身法": "身",
};
function sealChar(name) {
  if (SEAL_CHARS[name]) return SEAL_CHARS[name];
  return (name || "?").replace(/[（(].*$/, "").slice(0, 1);
}
// 物品类型 → 印章字与五行色键
function itemSeal(it) {
  const map = { pill: ["丹", "huo"], material: ["草", "mu"], currency: ["石", "tu"], skill: ["籍", "shui"], consumable: ["器", "jin"], key: ["令", "jin"], treasure: ["宝", "jin"] };
  const m = map[it && it.type] || ["物", "tu"];
  return { ch: m[0], wx: m[1] };
}
function spellEffectText(sp) {
  if (sp.type === "atk") return "伤" + sp.dmg + (sp.pierce ? "·破甲" : "") + (sp.dodgeSelf ? " 闪避↑" : "");
  if (sp.type === "soul") return "镇魂(按功力·仅元神)";
  if (sp.type === "heal") return "回血" + sp.heal;
  if (sp.type === "def") return "护体" + sp.shield;
  if (sp.type === "debuff") return sp.poison ? `下毒${sp.poison.dmg}/回合` : "减益";
  if (sp.type === "buff") return "蓄力·下回合灵气+" + (sp.nextQiBonus || 0);
  return "";
}
function effectText(e) {
  const parts = [];
  if (e.cul) parts.push(`修为+${e.cul}`);
  if (e.sp) parts.push(`灵力+${e.sp}`);
  if (e.hp) parts.push(`气血+${e.hp}`);
  if (e.mood) parts.push(`心境+${e.mood}`);
  if (e.demon) parts.push(`心魔${e.demon > 0 ? '+' : ''}${e.demon}`);
  return parts.join("　");
}

window.UI = UI;
