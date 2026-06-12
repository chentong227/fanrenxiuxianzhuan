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

  // 行动页"刚刚发生"反馈条：最近三条见闻（用户裁决：只显一行看不出做了什么——加大）
  renderRecentLog() {
    const box = this.el("recent-log");
    if (!box) return;
    const log = (State.data && State.data.log) || [];
    const side = this._sideStrip();
    if (!log.length && !side) { box.innerHTML = ""; box.style.display = "none"; return; }
    let html = side;
    if (log.length) {
      const strip = (e, cap) => {
        const tmp = document.createElement("div");
        tmp.innerHTML = e.body || "";
        let txt = (tmp.textContent || "").trim().replace(/\s+/g, " ");
        if (txt.length > cap) txt = txt.slice(0, cap) + "…";
        return txt;
      };
      const recent = log.slice(-3);
      html += recent.map((e, i) => {
        const isLast = i === recent.length - 1;
        return `<div class="rl-row ${isLast ? 'rl-latest' : ''}">
          <span class="rl-tag">${e.t}</span>
          <span class="rl-txt entry-${e.kind || 'event'}">${strip(e, isLast ? 120 : 76)}</span>
        </div>`;
      }).join("");
      html += `<div class="rl-more">完整见闻 ›</div>`;
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
    // 血色禁地日历锚：年级倒计时常驻——大帆里的每一月，都在为那一天攒
    const sx = State.data;
    if (sx && sx.flags && sx.flags.xueshi_due && !sx.flags.xueshi_opened) {
      const left = Math.max(0, sx.flags.xueshi_due - State.absMonth());
      const ready = sx.realmIndex >= 10;
      fate += `<div class="obj-task" style="border-left-color:var(--cinnabar)">
        <span class="obj-key" style="background:var(--cinnabar);color:#f3e4d8">血禁</span>
        <b>血色禁地 · 大比时节</b>
        <span class="obj-left">约余 ${left} 月</span>
        <span class="obj-hint">${ready ? "修为已够（练气十一层）——届时名额之争，看你的了" : "入选门槛：练气十一层（修炼/后篇是正路）"}</span>
      </div>`;
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

  // 地点 → BGM 轨（场景换乐：每处地方有自己的声音）
  _bgmForLocation(loc) {
    const s = State.data;
    if (s && s.journey) return "journey";
    if (!loc) return "daily";
    if (loc.id === "town" || loc.id === "jiayuan_city") return "town";
    if (loc.id === "tainan_fair") return "fair";
    if (loc.id === "miju") return "tense";
    return "daily";   // 药庐/洞府/演武厅/后山等
  },

  renderLocation() {
    const loc = State.location();
    if (!loc) return;
    const nm = this.el("loc-name"); if (nm) nm.textContent = loc.name;
    const ds = this.el("loc-desc-inline"); if (ds) ds.textContent = loc.desc;
    this.renderSceneStage(loc);
    this.renderLocals(loc);
    // 战斗/剧情演出中不抢轨（由各自的演出管理）
    const inStory = !!(this._story && !this.el("story-overlay").hidden);
    if (typeof Sfx !== "undefined" && Sfx.bgm && !State.data.combat && !inStory) {
      Sfx.bgm(this._bgmForLocation(loc));
    }
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
      explore: "深入探索", wujian: "闭关悟剑 ⚔", fair: "赶集（小会）", yaoyuan: "药园差事",
      liandan: "地火炼丹 🔥",
    };
    // 剧情过场地点（scene）：无日常行动，只随剧情推进
    // 各地行动由 world 数据决定，不再到处自动塞「打坐/突破」——突破/调息只在洞府(home)出现
    let acts = (loc.scene ? [] : loc.actions.slice());
    if (!loc.scene) {
      acts = acts.filter(a => a !== "bottle" || State.data.bottle.unlocked);
      // 剑意圆满：洞府出现「悟剑」（大件链攻坚入口）
      if (loc.home && (State.data.swordIntent || 0) >= 100 && !State.data.swordMastery) acts.unshift("wujian");
      // 血色主药在手：地火之屋炼筑基丹（筑基丹链的"造"环节）
      if (loc.home && loc.id === "huangfeng_gate" && State.data.flags.mojiao_resolved
        && State.count("xueshi_zhuyao") >= 4 && !State.data.flags.zhuji_lian_done) acts.unshift("liandan");
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
    // 法器装备（DATA.gear）：穿戴/卸下
    const gdef = DATA.gear && DATA.gear[itemId];
    if (gdef) {
      const equipped = State.data.gear && State.data.gear[gdef.slot] === itemId;
      const layer = (DATA.realms[State.data.realmIndex] || {}).layer || 1;
      const can = !gdef.minLayer || layer >= gdef.minLayer;
      if (equipped) {
        actions += `<button class="btn btn-secondary" onclick="Engine.unequipGear('${gdef.slot}'); UI.closeModal();">卸下</button>`;
        // 法宝出战位：战斗技法器可"收起不出战"——境界换代后，旧法宝不挤新手牌
        (gdef.grantSpells || []).forEach(sk => {
          const benched = (State.data.benchTreasures || []).includes(sk);
          const skName = (typeof CombatAPI !== "undefined" && CombatAPI.SPELLS[sk]) ? CombatAPI.SPELLS[sk].name : sk;
          actions += `<button class="btn btn-mini" onclick="Engine.toggleBenchTreasure('${sk}'); UI.closeModal();">${benched ? `「${skName}」重新出战` : `收起「${skName}」（不入战斗手牌）`}</button>`;
        });
      } else if (can) {
        actions += `<button class="btn btn-primary" onclick="Engine.equipGear('${itemId}'); UI.closeModal();">装备（${gdef.slot === "weapon" ? "武器" : gdef.slot === "armor" ? "护身" : "饰物"}）</button>`;
      } else {
        actions += `<span style="color:var(--ink-faint);font-size:12px;align-self:center">需练气${gdef.minLayer}层方可驱使</span>`;
      }
    }
    // 法器属性/特性明细（提升感写在脸上）
    let gearHtml = "";
    if (gdef) {
      const names = { hpMax: "气血上限", moodMax: "心境上限", sense: "神识", body: "体魄", speed: "遁速" };
      const bonusTxt = gdef.bonus ? Object.entries(gdef.bonus).map(([k, v]) => `${names[k] || k} +${v}`).join("　") : "";
      const spellsTxt = (gdef.grantSpells || []).map(id => {
        const sp = (typeof CombatAPI !== "undefined") ? CombatAPI.SPELLS[id] : null;
        return sp ? `「${sp.name}」` : id;
      }).join(" ");
      gearHtml = `<div style="background:rgba(0,0,0,.2);border-radius:8px;padding:8px 10px;margin:8px 0;font-size:13px">
        ${bonusTxt ? `<div style="color:var(--jade-bright)">属性：${bonusTxt}</div>` : ""}
        ${spellsTxt ? `<div style="color:var(--gold)">战斗技：${spellsTxt}</div>` : ""}
        ${(gdef.traits || []).map(t => `<div style="color:var(--ink-dim)">特性：${t.desc}</div>`).join("")}
        <div style="color:var(--ink-faint);font-size:11px;margin-top:4px">驱使门槛：练气${gdef.minLayer || 1}层 · 槽位：${gdef.slot === "weapon" ? "武器" : gdef.slot === "armor" ? "护身" : "饰物"}</div>
      </div>`;
    }
    this.openModal(`
      <h2>${item.name}</h2>
      ${isPill ? this._statusStrip() : ""}
      <p style="color:var(--ink-dim)">${rarityLabel(item.rarity)} · ${typeLabel(item.type)}　持有 ×${State.count(itemId)}</p>
      <p>${item.desc}</p>
      ${gearHtml}
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
    // 剧情配乐：节点可指定 bgm 轨（sorrow 离殇/tense 阴谋/triumph 扬眉……）
    if (stage.bgm && typeof Sfx !== "undefined" && Sfx.bgm) Sfx.bgm(stage.bgm);
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
      if (seg.say) { beats.push({ kind: "say", who: seg.say, text: seg.text, tone: seg.tone, emo: seg.emo }); return; }
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
      // 打字机轻嗒：每3字一声，标点不响（气口）
      if (typeof Sfx !== "undefined" && i % 3 === 0 && !/[，。！？…—、；：]/.test(full[i - 1] || "")) Sfx.play("type");
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
      // emo=表情变体；tone 含怒/喝/厉 → 立绘震动（对话演出：形象会动，代入感所在）
      this._storySetPortrait(b.showWho || (isNarr ? null : who), b.emo, b.tone);
    }

    const last = (st.idx === st.beats.length - 1);
    if (cue) cue.textContent = last ? "▽ 轻触，到此抉择" : "▽ 轻触继续";
    this.el("story-choices").innerHTML = "";
  },

  // 双人相对立绘：韩立固定在右，对话 NPC 在左；说话者高亮，另一人暗淡。
  // emo=表情变体（有图换图，无图回退基础版）；tone 驱动震动（怒/喝/厉/吼=重击感）
  _storySetPortrait(who, emo, tone) {
    const st = this._story;
    const lbox = this.el("story-portrait-left");
    const rbox = this.el("story-portrait-right");
    if (!lbox || !rbox) return;

    const self = who && (who === State.data.name || who === "韩立");

    // 右侧固定为韩立立绘（表情可随 emo 切换）
    const hanliEmo = self ? emo : null;
    const hKey = "hanli" + (hanliEmo || "");
    if (rbox.dataset.set !== hKey) {
      const hurl = (typeof Art !== "undefined") ? Art.url("hanli", hanliEmo) : null;
      if (hurl) {
        rbox.innerHTML = `<img src="${hurl}" alt="韩立" />`;
        rbox.dataset.set = hKey;
        if (hanliEmo) this._portraitPop(rbox);   // 换表情：小弹跳（看见变化）
      }
    }

    // 出场的对话 NPC（非旁白、非主角）→ 放左侧并记住（表情同理）
    if (who && !self) {
      const id = this._npcIdByName(who);
      const url = id && typeof Art !== "undefined" ? Art.url(id, emo) : null;
      const lKey = (who || "") + (emo || "");
      if (url && st && st.leftKey !== lKey) {
        lbox.innerHTML = `<img src="${url}" alt="${who}" />`;
        if (st) { st.leftNpc = who; st.leftKey = lKey; }
        if (emo) this._portraitPop(lbox);
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

    // 语气演出：怒喝类 → 说话者立绘震动 + 重音效（形象会动，话才有分量）
    const angry = tone && /怒|喝|厉|吼|狠|杀/.test(tone);
    const speaker = speakRight ? rbox : speakLeft ? lbox : null;
    if (speaker && angry) {
      speaker.classList.remove("quake"); void speaker.offsetWidth; speaker.classList.add("quake");
      if (typeof Sfx !== "undefined") Sfx.play("danger");
    } else if (speaker && who) {
      // 普通发言：极轻的呼吸顶起（说话者在"动"）
      speaker.classList.remove("speak-bump"); void speaker.offsetWidth; speaker.classList.add("speak-bump");
    }
  },

  // 换表情的小弹跳
  _portraitPop(box) {
    box.classList.remove("emo-pop"); void box.offsetWidth; box.classList.add("emo-pop");
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
    const extra = { "三叔": "sanshu", "铁奴": "tienu", "张铁（铁奴）": "tienu", "墨彩环": "mocaihuan", "万小山": "wanxiaoshan",
      "吴师叔": "wushishu", "陆云风": "luyunfeng", "叶师叔": "yeshishu", "马师伯": "mashibo", "陈巧倩": "chenqiaoqian" };
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

  /* -------- 万宝楼（黄枫谷坊市）：一层消耗品，二层筑基法器 -------- */
  openWanbao() {
    const s = State.data;
    const row = (g) => {
      const item = DATA.items[g.id];
      const owned = g.once && State.count(g.id) > 0;
      return `<div class="market-item">
        <span><span class="iname ${item.rarity === 'rare' ? 'rare' : item.rarity === 'epic' ? 'epic' : ''}">${item.name}</span>${g.n > 1 ? `×${g.n}` : ""}
          ${g.note ? `<span style="color:var(--gold);font-size:11px">　${g.note}</span>` : ""}
          <span style="color:var(--ink-dim);font-size:12px">　${item.desc}</span></span>
        ${owned ? `<span style="color:var(--ink-faint);font-size:12px">已购得</span>`
                : `<button class="btn btn-mini" onclick="Engine.wanbaoBuy('${g.id}')"><span class="mprice">灵石${g.price}</span></button>`}
      </div>`;
    };
    const floor1 = Engine.WANBAO_GOODS.filter(g => !g.floor2).map(row).join("");
    const floor2 = Engine.WANBAO_GOODS.filter(g => g.floor2).map(row).join("");
    // 收购行：千年灵草/灵药 + 妖材（sell 字段自动上架——皮骨牙丹都换得了灵石）
    const sellRows = [
      { id: "qiannian_lingcao", price: 22, hot: true },
      { id: "lingyao_dan", price: 2 },
    ];
    Object.entries(DATA.items).forEach(([id, it]) => {
      if (it.sell && State.count(id) > 0 && !sellRows.some(r => r.id === id)) {
        sellRows.push({ id, price: it.sell, hot: id === "yaodan_1" });
      }
    });
    const sells = sellRows.map(x => {
      const it = DATA.items[x.id];
      const has = State.count(x.id) >= 1;
      if (!has && !["qiannian_lingcao", "lingyao_dan"].includes(x.id)) return "";   // 妖材：无货不占行
      return `<div class="market-item">
      <span style="color:${x.hot ? 'var(--gold)' : 'var(--ink-dim)'};font-size:13px">${it.name} ×1 → 灵石×${x.price}${has ? `（存${State.count(x.id)}）` : ""}${x.hot ? "　掌柜见之眼开" : ""}</span>
      ${has ? `<button class="btn btn-mini" onclick="Engine.wanbaoSell('${x.id}')">售出</button>`
              : `<span style="color:var(--ink-faint);font-size:12px">无货</span>`}
    </div>`;
    }).join("");
    // 向之礼：在坊市闲坐的"老杂役"——他的指点分文不取
    const xiang = s.flags.xueshi_intel
      ? `<p style="color:var(--jade-bright);font-size:12px">向之礼的指点你记在心里：血色主药在禁地，名额看修为（练气十一层）与大比时节。</p>`
      : `<div class="market-item">
          <span><span class="iname">廊下晒太阳的向老头</span><span style="color:var(--ink-dim);font-size:12px">　他朝你招了招手，似乎有话要说。</span></span>
          <button class="btn btn-mini" onclick="Engine.xiangIntel()">上前听他闲谈</button>
        </div>`;
    this.openModal(`
      <h2>万宝楼 · 采买</h2>
      <p style="color:var(--ink-dim)">灵石：${State.count("lingshi")} 枚　纹银：${s.silver} 两（坊市只认灵石）</p>
      ${floor1}
      <h3 class="panel-title" style="margin-top:10px">二层 · 法器阁（练气十一层方可驱使）</h3>
      ${floor2}
      <h3 class="panel-title" style="margin-top:10px">以物易石（掌柜收购）</h3>
      ${sells}
      <h3 class="panel-title" style="margin-top:10px">坊市闲人</h3>
      ${xiang}
      <div class="modal-actions"><button class="btn btn-ghost" onclick="UI.closeModal()">离开</button></div>
    `);
  },

  /* ===========================================================
   *  战斗界面
   * =========================================================== */
  _combatTarget: 0,
  openCombat(combat, meta) {
    this._deadShown = {};        // 阵亡退场账本：每具尸体只渲染"咽气那一拍"（深拍后不再入场）
    this._combatLogLen = 0;
    this.el("combat-overlay").hidden = false;
    const titles = { encounter: "斗 法", showdown: "夺舍之夜 · 决战", breakthrough: "突破 · 心战", jinguang: "暗算金光上人", luyunfeng: "坊市归途 · 林中血" };
    this.el("combat-title").textContent = titles[meta.type] || "斗 法";
    // 战斗背景：心战用墨黑，其余用当前地点场景图（压暗虚化）。
    // 三层分级制（v88）：底名_far 远景层（无立物）+ 底名_mid 中景物件透明条带（人物身后
    // 独立视差）——两层齐备时人物真正"插在层间"；缺层回退单图，照旧可玩
    const bg = this.el("combat-bg");
    if (bg) {
      const loc = State.location();
      // 战斗背景：洞窟/场景继承优先（同轴一体——开战不换天地）> 专用战场底图 > 地点横版场景
      let url = null, midUrl = null;
      if (meta.type !== "breakthrough" && typeof Art !== "undefined") {
        if (meta.sceneBg && Art.has(meta.sceneBg)) {
          url = Art.sceneUrl(meta.sceneBg, { landscape: true });
        } else {
          // v90 对照实验结论：舞台盒构图单图（两翼收口环抱+中央开阔）优先——
          // "人被环境包住"的在场感远胜条带中景三层合成；far/mid 退为缺图回退
          const base = this._battleBaseFor(loc, meta);
          if (base && Art.has(base)) {
            url = Art.sceneUrl(base, { landscape: true });
          } else if (base && Art.has(base + "_far") && Art.has(base + "_mid")) {
            url = Art.sceneUrl(base + "_far", { landscape: true });
            midUrl = Art.sceneUrl(base + "_mid", { landscape: true });
          } else {
            url = this._battleBgFor(loc, meta);
          }
        }
      }
      bg.style.backgroundImage = url ? `url("${url}")` : "";
      bg.style.transform = "";
      bg.classList.toggle("on", !!url);
      const mid = this.el("combat-bgmid");
      if (mid) {
        mid.style.backgroundImage = midUrl ? `url("${midUrl}")` : "";
        mid.style.transform = "";
        mid.classList.toggle("on", !!midUrl);
      }
      // 前景遮挡层（v90）：贴底一线草石压在单位前——离镜头最近的一层。
      // 分场景配色（用户裁决：前景色必须与底图地面一致才像长在地里）；
      // 洞窟 pano/心战不挂（洞里没草）。环境色反光（bg-*）同 biome 派发
      const fg = this.el("combat-fg");
      const ov0 = this.el("combat-overlay");
      const bgName = (meta.sceneBg && Art.has && Art.has(meta.sceneBg)) ? meta.sceneBg
        : (meta.type !== "breakthrough" && typeof Art !== "undefined") ? this._battleBaseFor(loc, meta) : "";
      const biome = /^bt_/.test(bgName || "")
        ? (/night/.test(bgName) ? "night" : /road/.test(bgName) ? "road" : "forest") : null;
      ["bg-forest", "bg-road", "bg-night"].forEach(k => ov0.classList.remove(k));
      if (biome && meta.type !== "breakthrough") ov0.classList.add("bg-" + biome);
      if (fg) {
        // 前景遮挡暂停（v90 用户裁决：先不做前景，景深主体先行）——资产与管线保留，
        // 重启时把 fgUrl 换回 Art.sceneUrl("fg_" + biome)
        const fgUrl = null;
        fg.style.backgroundImage = "";
        fg.style.transform = "";
        fg.classList.toggle("on", !!fgUrl);
      }
      this.el("combat-overlay").classList.toggle("mind", meta.type === "breakthrough");
    }
    // 洞窟无缝开战：镜头一沉推近（探索拉远→战斗推近）——动的是镜头，不是场景
    const ovEl = this.el("combat-overlay");
    ovEl.classList.remove("seamless-in");
    if (meta.seamless) { void ovEl.offsetWidth; ovEl.classList.add("seamless-in"); }
    this.el("combat-endround").onclick = () => Engine.combatEndRound();
    const quickBtn = this.el("combat-quick");
    if (quickBtn) {
      quickBtn.hidden = !meta.canQuick;
      quickBtn.onclick = () => Engine.combatQuickResolve();
    }
    const fleeBtn = this.el("combat-flee");
    if (fleeBtn) fleeBtn.onclick = () => Engine.combatFlee();
    const logBtn = this.el("combat-logbtn");
    if (logBtn) logBtn.onclick = () => {
      const lg = this.el("combat-log");
      if (lg) { lg.hidden = !lg.hidden; if (!lg.hidden) lg.scrollTop = lg.scrollHeight; }
    };
    const lg0 = this.el("combat-log"); if (lg0) lg0.hidden = true;
    this._combatTarget = combat.enemies.findIndex(e => e.alive);
    this._combatLogLen = combat.log.length;
    if (typeof Sfx !== "undefined") {
      Sfx.play("danger");
      // BGM 换轨：激昂只留给配得上的仗——决战/妖王/越级=boss 压迫轨；
      // 心魔=阴冷轨；寻常斗法=低强度对峙轨（用户裁决：日常战斗不轰轰烈烈）
      if (Sfx.bgm) {
        const myLayer = (State.realm() || {}).layer || 1;
        const overTier = combat.enemies.some(e => e.alive && (e.qiLayer || 0) - myLayer >= 2);
        const bossFight = meta.type === "showdown" || meta.type === "jinguang"
          || meta.namedBeast || overTier;
        Sfx.bgm(bossFight ? "boss" : meta.type === "breakthrough" ? "tense" : "combat");
      }
    }
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
  // 敌名 → 战斗全身立绘（battlers/：妖兽/人形敌/剧情人物战斗姿态）
  _battlerByName(name) {
    if (!name || typeof Art === "undefined" || !Art.battlerUrl) return null;
    const MAP = [
      // 有名有姓的优先（专属战斗立绘）
      [/陆云风/, "bt_luyunfeng"],
      [/金光上人/, "bt_jinguang"],
      [/墨大夫/, "bt_modafu"],
      [/铁奴|张铁尸傀/, "bt_tienu"],
      [/万小山/, "bt_wanxiaoshan"],
      [/墨蛟/, "bt_mojiao"],
      [/封岳/, "bt_sanxiu"],           // 狙杀者暂用散修体（专属图后补）
      // 类型谱共用
      [/赤目狼王|血煞兽/, "bt_chimu"],
      [/虎/, "bt_baihu"],
      [/蜈蚣/, "bt_wugong"],
      [/狼/, "bt_wolf"],               // 灵狼/狼群（狼王规则在前已截获）
      [/山贼|贼|匪|流寇/, "bt_bandit"],
      [/弟子|武师|喽啰|打手|蛮修/, "bt_wuren"],
      [/散修|修士|枯修/, "bt_sanxiu"],
    ];
    for (const [re, id] of MAP) { if (re.test(name) && Art.hasBattler(id)) return id; }
    return null;
  },

  // 地点/战斗类型 → 战场底图基名（三层制：基名+_far/_mid 取层；单图回退用基名本身）
  _battleBaseFor(loc, meta) {
    if (meta && (meta.type === "showdown" || meta.type === "jinguang")) return "bt_night";
    const id = loc ? loc.id : "";
    if (/road|town|jiayuan|qingniu/.test(id) || (State.data && State.data.journey)) return "bt_road";
    if (/huangfeng|baiyao|fangshi|tainan/.test(id)) return "bt_valley";
    return "bt_forest";
  },
  // 地点/战斗类型 → 战场底图（下半幅开阔地面的横版图；缺图回退地点场景图）
  _battleBgFor(loc, meta) {
    if (typeof Art === "undefined") return null;
    const bt = this._battleBaseFor(loc, meta);
    const url = Art.sceneUrl(bt, { landscape: true });
    return url || Art.locUrl(loc, { landscape: true });
  },

  // 无立绘敌人的字符玉牌
  _enemyGlyph(name) {
    if (/狼/.test(name)) return "狼";
    if (/虎/.test(name)) return "虎";
    if (/蛟|蛇/.test(name)) return "蛟";
    if (/贼|寇/.test(name)) return "贼";
    if (/弟子/.test(name)) return "武";
    if (/蜈|虫/.test(name)) return "虫";
    if (/散修|修士/.test(name)) return "修";
    if (/心魔|劫/.test(name)) return "魔";
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
  closeCombat() {
    this.el("combat-overlay").hidden = true;
    this._armed = null;
    if (typeof Fx !== "undefined") Fx.clear();
    // 战罢归于地点轨（在哪打完，回哪的声音）
    if (typeof Sfx !== "undefined" && Sfx.bgm) Sfx.bgm(this._bgmForLocation(State.location()));
  },

  // 轴上锚点：data-uid 定位单位 sprite
  _axisAnchor(ref) {
    const box = this.el("axis-units");
    if (!box) return null;
    return box.querySelector(`[data-uid="${ref}"]`) || box;
  },

  // 施法反馈：施法者突进步 + 御使飞行 + 目标震动白闪 + 招式名横幅
  flashCombat(spellId, targetIndex) {
    const sp = (typeof CombatAPI !== "undefined") ? CombatAPI.SPELLS[spellId] : null;
    // 弹道锚定真实目标（BUG 修复：旧版锚 _combatTarget——目标死后弹道仍一直锁着尸体打）
    const c0 = Engine._combat;
    const ti = targetIndex != null ? targetIndex : (c0 ? this.curTarget(c0) : this._combatTarget);
    const tgt = this._axisAnchor(`enemy:${ti}`);
    const me = this._axisAnchor("player");
    // 出手身法：贴身技=大步前冲；远程=前倾发力（打击感的"人动了"）
    if (sp && me && sp.type === "atk") {
      const melee = sp.range && sp.range[1] <= 1;
      me.classList.remove("strike-melee", "strike-cast"); void me.offsetWidth;
      me.classList.add(melee ? "strike-melee" : "strike-cast");
      setTimeout(() => me.classList.remove("strike-melee", "strike-cast"), 500);
    }
    // 催刃出袭（主攻法宝伴身联动）：点子母刃的那一拍，绕身刃阵齐齐掠向目标再归位
    if (sp && sp.source === "treasure" && sp.type === "atk" && me && tgt) {
      const blades = me.querySelector(".au-blades");
      if (blades) {
        const dir = tgt.getBoundingClientRect().left >= me.getBoundingClientRect().left ? 1 : -1;
        blades.style.setProperty("--bdir", dir);
        blades.classList.remove("launch"); void blades.offsetWidth;
        blades.classList.add("launch");
        setTimeout(() => blades.classList.remove("launch"), 700);
      }
    }
    // 御使飞行：攻击类且非贴身武学——一道法器印划过战场 + fx 流光弹道
    if (sp && me && tgt && sp.type === "atk" && sp.range && sp.range[1] >= 2) {
      const field = this.el("axis-field");
      const fr = field.getBoundingClientRect();
      const a = me.getBoundingClientRect(), b = tgt.getBoundingClientRect();
      const fly = document.createElement("div");
      fly.className = `fly-seal wx-${sp.elem || "jin"}`;
      fly.textContent = sealChar(sp.name);
      fly.style.left = (a.left + a.width / 2 - fr.left) + "px";
      fly.style.top = (a.top + a.height * 0.4 - fr.top) + "px";
      field.appendChild(fly);
      requestAnimationFrame(() => {
        fly.style.left = (b.left + b.width / 2 - fr.left) + "px";
        fly.style.top = (b.top + b.height * 0.4 - fr.top) + "px";
        fly.classList.add("gone");
      });
      setTimeout(() => fly.remove(), 480);
      setTimeout(() => { if (tgt) { tgt.classList.remove("shake"); void tgt.offsetWidth; tgt.classList.add("shake"); } }, 320);
      // fx：分功法配方特效（每个法术一张脸——青芒/火蛇/冰棱/金砖各不相同）
      if (typeof Fx !== "undefined" && Fx.ensure(field)) {
        Fx.castSpell(spellId, me, tgt, sp);
      }
    } else if (tgt) {
      tgt.classList.remove("shake"); void tgt.offsetWidth; tgt.classList.add("shake");
      // 贴身武学/自身术：同走配方分发
      if (typeof Fx !== "undefined" && sp) {
        const field = this.el("axis-field");
        if (Fx.ensure(field)) Fx.castSpell(spellId, me, tgt, sp);
      }
    } else if (sp && me && typeof Fx !== "undefined") {
      const field = this.el("axis-field");
      if (Fx.ensure(field)) Fx.castSpell(spellId, me, null, sp);
    }
    // 法宝催动：脚下金环灵光（"物"的仪式感，配方特效之外的统一仪式）
    if (sp && sp.source === "treasure" && me && typeof Fx !== "undefined" && Fx._ctx) {
      const at = Fx.at(me, 0.86);
      if (at) Fx.ring(at.x, at.y, { c: "#e9cd86", vr: 3.2, life: 460 });
    }
    // 招式名大字横幅
    if (sp) {
      const el = this.el("combat-cast");
      if (el) {
        // 法宝催动：更大的字、灵光环爆——"催动法宝"得看着像回事
        const isTreasure = sp.source === "treasure";
        el.innerHTML = `<span class="cc-name wx-${sp.elem || "jin"}${isTreasure ? " cc-treasure" : ""}">${isTreasure ? "︻催动︼ " : ""}${sp.name}</span>`;
        el.hidden = false;
        el.classList.remove("show"); void el.offsetWidth; el.classList.add("show");
        clearTimeout(this._castTimer);
        this._castTimer = setTimeout(() => { el.hidden = true; }, isTreasure ? 950 : 700);
      }
      if (typeof Sfx !== "undefined") Sfx.play(sp.type === "heal" ? "heal" : sp.type === "def" ? "shield" : sp.source === "treasure" ? "bell" : "sword");
    }
  },

  // 弹出战斗飘字（消费引擎的 fx 队列，锚到轴上 sprite）+ 三时刻重演出
  flushCombatFx(c) {
    if (!c || !c._fx || !c._fx.length) return;
    const fx = c._fx.slice();
    c._fx.length = 0;
    let delay = 0;
    const fxReady = typeof Fx !== "undefined" && Fx.ensure(this.el("axis-field"));
    for (const f of fx) {
      // —— 全局重演出：趁虚时停金字 / 蓄势释放大字压屏（蓄势全开加白金屏闪+震屏）——
      if (f.ref === "global") {
        const g = this.el("fx-global");
        if (g) setTimeout(() => {
          g.hidden = false;
          g.className = "fx-global " + (f.kind === "ult" ? "fxg-ult" : "fxg-exploit");
          g.innerHTML = `<span class="fxg-text">${f.text || ""}</span>`;
          if (typeof Sfx !== "undefined") Sfx.play(f.kind === "ult" ? "bell" : "danger");
          if (f.kind === "ult" && fxReady) { Fx.flash("#ffe9ad", 220, .36); Fx.shake(10); }
          clearTimeout(this._fxgTimer);
          this._fxgTimer = setTimeout(() => { g.hidden = true; g.className = "fx-global"; }, f.kind === "ult" ? 1200 : 850);
        }, delay);
        delay += 320;
        continue;
      }
      const anchor = this._axisAnchor(f.ref);
      if (!anchor) continue;
      // —— 敌方/侧位出手特效（fxcast）：行属光带弹道 / 贴身爪弧——招式看得见来路 ——
      if (f.kind === "fxcast") {
        if (fxReady) {
          const fromA = f.from ? this._axisAnchor(f.from) : null;
          setTimeout(() => {
            const to = Fx.at(anchor);
            if (!to) return;
            if (f.melee) {
              Fx._slashArc(to, Math.random() * 1.4 - 0.7, f.elem ? undefined : "#f0e8e0");
              Fx.burst(to.x, to.y, f.elem || "none", 6, { power: 2.6 });
            } else if (fromA) {
              const from = Fx.at(fromA);
              if (from) Fx.ribbon(from, to, {
                elem: f.elem || "none", width: f.wave ? 4.6 : 4, flyMs: 240,
                wave: f.wave ? 20 : 0, waveN: 3,
                core: f.wave ? "#f5f8ff" : undefined, glowC: f.wave ? "#9fc3e8" : undefined,
              });
            }
          }, delay);
          delay += 120;
        }
        continue;
      }
      // —— 终结一击：慢放灰化+水墨溅散 ——
      if (f.kind === "slay") {
        setTimeout(() => {
          anchor.classList.add("slaying");
          const burst = document.createElement("div");
          burst.className = "ink-burst";
          for (let k = 0; k < 6; k++) burst.appendChild(document.createElement("i"));
          anchor.appendChild(burst);
          setTimeout(() => burst.remove(), 1300);
        }, delay);
        delay += 300;
        continue;
      }
      setTimeout(() => {
        this._popFloat(anchor, f.kind, f.text);
        if (f.kind === "hurt" || f.kind === "dmg" || f.kind === "crit" || f.kind === "pierce") {
          anchor.classList.remove("shake", "hitflash"); void anchor.offsetWidth;
          anchor.classList.add("shake", "hitflash");
          setTimeout(() => anchor.classList.remove("hitflash"), 360);
          // fx 爆点：受击位迸溅（暴击金芒更盛+轻震屏；带行属按行属调色；砸地带尘环）
          if (fxReady) {
            const at = Fx.at(anchor);
            if (at) {
              Fx.burst(at.x, at.y, f.elem || (f.kind === "crit" ? "jin" : f.kind === "hurt" ? "huo" : "none"), f.kind === "crit" ? 22 : 10);
              if (f.slam) Fx.ring(at.x, at.y + 26, { c: "#cbb89a", vr: 3.4, life: 300, lw: 2 });
              if (f.kind === "crit") {
                Fx.shake(6);
                if (f.defElem) Fx.material(at.x, at.y, f.defElem);   // 材质反应：克制命中的官设演出
              }
            }
          }
        }
      }, delay);
      delay += 200;
    }
  },
  _popFloat(anchor, kind, text) {
    const el = document.createElement("div");
    el.className = "float-fx fx-" + kind;
    el.textContent = text;
    // ⚠ 只给"无定位"的锚补 relative——axis-unit 是 absolute，硬写 relative 会把它
    // 打回文档流（v88 实锤的"被打一下就卡进地底"，reconcile 后内联残留永不自愈）
    if (getComputedStyle(anchor).position === "static") anchor.style.position = "relative";
    anchor.appendChild(el);
    setTimeout(() => el.remove(), 1100);
  },

  // 玩家手动切换攻击目标；择敌模式下=确认目标并施放（二次确认收口）
  pickTarget(i) {
    if (!Engine._combat) return;
    const e = Engine._combat.enemies[i];
    if (!e || !e.alive) return;
    this._combatTarget = i;
    if (this._armed && this._armed.kind === "enemy") {
      const id = this._armed.id;
      this._armed = null;
      Engine.combatCast(id, i);
      return;
    }
    this.renderCombat(Engine._combat, Engine._combatMeta);
  },
  /* —— 二次确认（群战）：点法术=上膛，再点目标/格子=施放 ——
   * 择敌：攻击/减益类且场上多敌——点敌方立绘确认（单敌不啰嗦，直接放）
   * 择地：阵旗类（非自身阵）永远点格落阵——阵随心落，不黏敌人站位 */
  armSpell(id) {
    const c = Engine._combat;
    if (!c || c.status !== "ongoing") return;
    const sp = CombatAPI.SPELLS[id];
    if (!sp) return;
    if (this._armed && this._armed.id === id) {   // 再点一次=收手
      this._armed = null;
      this.renderCombat(c, Engine._combatMeta);
      return;
    }
    if (sp.type === "zone" && !sp.selfZone) {
      this._armed = { id, kind: "cell", r: sp.range.slice() };
      if (typeof Sfx !== "undefined") Sfx.play("click");
      this.renderCombat(c, Engine._combatMeta);
      return;
    }
    const needsEnemy = (sp.type === "atk" || sp.type === "debuff") && sp.range && sp.range[1] > 0;
    if (needsEnemy && c.enemies.filter(e => e.alive).length > 1) {
      this._armed = { id, kind: "enemy" };
      if (typeof Sfx !== "undefined") Sfx.play("click");
      this.renderCombat(c, Engine._combatMeta);
      return;
    }
    this._armed = null;
    Engine.combatCast(id, this.curTarget(c));
  },
  castAtCell(i) {
    const a = this._armed;
    if (!a || a.kind !== "cell") return;
    this._armed = null;
    Engine.combatCastAt(a.id, i);
  },
  // 当前有效目标（首个存活兜底）
  curTarget(c) {
    if (this._combatTarget != null && c.enemies[this._combatTarget] && c.enemies[this._combatTarget].alive) return this._combatTarget;
    return c.enemies.findIndex(e => e.alive);
  },

  // 神识料敌：根据意图类型给出"该如何应对"的提示（看穿意图=真决策，三型攻防语言）
  _intentHint(intent) {
    const dmg = intent.dmg || 0;
    if (intent.kind === "approach")
      return `它够不着你，正在<b style="color:var(--gold)">逼近</b>——这回合是你白拿的先手：输出、布置、或拉开距离。`;
    if (intent.kind === "flee")
      return `它在<b style="color:var(--gold)">寻隙遁走</b>——再不拦下，战利品就长腿跑了！`;
    if (intent.kind === "guard")
      return `「${intent.name}」<b style="color:var(--blue)">凝罩固守</b>——本回合它不攻，正是叠毒蓄势的良机。`;
    if (intent.kind === "charge")
      return `「${intent.name}」正在<b style="color:var(--gold)">蓄力</b>（破绽毕露·受击+30%）——打断它，或抢输出！`;
    if (intent.targetCell != null)
      return `「${intent.name}」<b style="color:var(--red)">砸向第${intent.targetCell + 1}步（约${dmg}伤）</b>${intent.track ? "·会追身一格" : ""}——挪开脚步${intent.track ? "两步" : ""}，或举盾硬接；它扑空便是你的趁虚之机！`;
    if (intent.aim === "zone")
      return `「${intent.name}」将<b style="color:var(--red)">席卷第${(intent.zoneFrom || 0) + 1}~${(intent.zoneTo || 0) + 1}步（约${dmg}伤）</b>——拉出区间，或硬扛。`;
    if (intent.kind === "release")
      return `「${intent.name}」<b style="color:var(--red)">蓄力爆发（约${dmg}伤）</b>！护体挡不住全部——躲开或硬接。`;
    if (intent.kind === "pierce")
      return `「${intent.name}」<b style="color:var(--blue)">破甲锁定（约${dmg}伤）</b>——护体无效，靠身法与硬血。`;
    return `「${intent.name}」锁定而来（约${dmg}伤）——护体法术可挡（锁头打不空，盾是正解）。`;
  },

  /* 防撞排布：同高度层×同排分组，组内按屏幕 x 排序扫描，
   * 相邻间距 < 最小间距时把右侧单位顺势推开（追加到 --lx）——
   * 占格规则不动、只动演出位。⚠ 跨排不互推（v90 二改）：后排从前排身后
   * 探出半个身位是"纵深"本身（z 序+缩放+斜移已保证可读），推开反而拍扁排深 */
  _decrowd(unitsEl, c) {
    const track = unitsEl.getBoundingClientRect().width / (this._camZoom || 1);   // 还原 zoom 前的轨宽（--lx 是缩放前坐标系的值）
    if (!track) return;
    const MIN = Math.max(44, Math.min(64, track * 0.052));
    const items = [...unitsEl.querySelectorAll(".axis-unit")].map(el => {
      const m = el.className.match(/lane-(\d)/);
      el.style.removeProperty("--lx");   // 防累计（reconcile 后元素持久——必须从类基准重算）
      const baseLx = parseFloat(getComputedStyle(el).getPropertyValue("--lx")) || 0;
      return {
        el, lane: m ? +m[1] : 0,
        air: el.classList.contains("airborne"),
        x: (parseFloat(el.style.left) || 0) / 100 * track + baseLx,
        lx: baseLx,
      };
    });
    const keys = [...new Set(items.map(o => (o.air ? "a" : "g") + o.lane))];
    keys.forEach(k => {
      const g = items.filter(o => (o.air ? "a" : "g") + o.lane === k).sort((a, b) => a.x - b.x);
      for (let i = 1; i < g.length; i++) {
        const need = g[i - 1].x + MIN - g[i].x;
        if (need > 0) {
          g[i].x += need;
          g[i].lx += need;
          g[i].el.style.setProperty("--lx", g[i].lx.toFixed(1) + "px");
        }
      }
    });
  },

  // 单位 sprite（轴上立绘）：立绘/玉牌 + 脚下血条 + 头顶意图气泡 + 身侧悬浮法器
  _axisSprite(c, u, opts) {
    const isPlayer = u === c.player;
    const isSide = !!u.isSide;
    const i = opts.enemyIndex;
    const demonized = opts.isBT || /心魔/.test(u.name);
    // 单位图优先级：战斗全身立绘（battlers/）> 剧情半身像 > 字符玉牌
    // （reconcile 改造：产出 src/类/玉牌三件，img 元素由 _syncUnits 持久管理——不再重建）
    let figSrc = null, figCls = "", figGlyph = null;
    if (typeof Art !== "undefined" && Art.battlerUrl) {
      let bid = null;
      if (isPlayer) bid = Art.hasBattler("bt_hanli") ? "bt_hanli" : null;
      else if (isSide) bid = u.art && Art.hasBattler("bt_" + u.art) ? "bt_" + u.art : this._battlerByName(u.name);
      else bid = this._battlerByName(u.name);
      // 飞行姿态变体（v87）：凌空且 _fly 立绘已入库——换飞姿（双脚前后、衣袂后卷）
      if (bid && (u.alt || 0) === 1 && Art.hasBattler(bid + "_fly")) bid = bid + "_fly";
      if (bid) { figSrc = Art.battlerUrl(bid); figCls = " battler" + (demonized ? " demonized" : ""); }
    }
    if (!figSrc) {
      const aid = isPlayer ? "hanli" : (isSide ? (u.art || null) : this._artIdByName(u.name));
      if (aid && typeof Art !== "undefined" && Art.has && Art.has(aid)) {
        figSrc = Art.url(aid); figCls = demonized ? " demonized" : "";
      } else {
        figGlyph = `<div class="au-glyph"><span>${isPlayer ? "韩" : isSide ? "傀" : this._enemyGlyph(u.name)}</span></div>`;
      }
    }
    const hpPct = Math.max(0, u.hp / u.hpMax * 100);
    const shPct = u.shield ? Math.min(100, u.shield / u.hpMax * 100) : 0;
    const mpPct = isPlayer ? Math.max(0, u.mp / u.mpMax * 100) : 0;
    // 头顶：意图气泡（一个字，点按弹完整应对提示——信息分级）+ 状态标
    const badges = [];
    if (!isPlayer && !isSide && u.alive && u.intent) {
      const ic = u.intent.kind === "flee" ? "遁" : u.intent.kind === "guard" ? "守"
        : u.intent.kind === "approach" ? "近"
        : u.intent.kind === "charge" ? "蓄" : u.intent.kind === "release" ? "爆"
        : u.intent.targetCell != null ? "砸" : u.intent.aim === "zone" ? "扫"
        : u.intent.kind === "pierce" ? "破" : "击";
      badges.push(`<span class="au-intent ik-${u.intent.kind || 'atk'}" onclick="event.stopPropagation(); UI.showIntentDetail(${i})">${ic}</span>`);
    }
    if (u._charging) badges.push(`<span class="au-mark mk-charge">蓄势</span>`);
    if (u._whiffed) badges.push(`<span class="au-mark mk-whiff">趁虚！</span>`);
    else if (u.exposed) badges.push(`<span class="au-mark mk-expose">破绽</span>`);
    // 同道头顶简令章（A2 意图气泡 v0）：一眼看清她此刻领的是哪道令。
    // 客随（mastery≥2 的高境同道）：全自动、不受令——章显"帅"（她指挥你，不是你指挥她）
    if (isSide && u.alive !== false && u.hp > 0) {
      if (u.kind === "ally" && (u.mastery || 0) >= 2) {
        badges.push(`<span class="au-mark mk-stance mk-lead" title="她的境界远在你之上——接好她递的刀便是">帅</span>`);
      } else {
        const stCh = { follow: "随", attack: "攻", guard: "守", retreat: "撤" }[u.stance || "follow"];
        badges.push(`<span class="au-mark mk-stance" onclick="event.stopPropagation(); Engine.cycleSideStance()">${stCh}</span>`);
      }
    }
    if (u.status && u.status.poison) badges.push(`<span class="au-mark mk-poison">毒${u.status.poison.dmg}</span>`);
    if (u.status && u.status.dingshen > 0) badges.push(`<span class="au-mark mk-hold">定</span>`);
    // 身侧悬浮法器（觅长生式拥有感）：已装备的武器/护身法器化作灵光绕身
    let orbit = "";
    if (isPlayer && typeof State !== "undefined" && State.gearOf) {
      const orbs = [];
      const w = State.gearOf("weapon"), a = State.gearOf("armor");
      const wName = w && DATA.items[State.data.gear.weapon] ? DATA.items[State.data.gear.weapon].name : null;
      const aName = a && DATA.items[State.data.gear.armor] ? DATA.items[State.data.gear.armor].name : null;
      // 主攻法宝伴身（正典：金蚨子母刃一母八子绕身）——有主攻法宝技时以刃阵替代武器印
      const SPL = (typeof CombatAPI !== "undefined") ? CombatAPI.SPELLS : null;
      const hasMainTre = SPL && (u.spells || []).some(id =>
        SPL[id] && SPL[id].source === "treasure" && !SPL[id].quick && SPL[id].type === "atk");
      if (hasMainTre) {
        orbit = `<div class="au-blades">${'<i class="bld"></i>'.repeat(9)}</div>`;
      } else if (wName) {
        orbs.push(`<span class="orb orb-w" title="${wName}">${sealChar(wName)}</span>`);
      }
      if (aName) orbs.push(`<span class="orb orb-a" title="${aName}">${sealChar(aName)}</span>`);
      if (orbs.length) orbit += `<div class="au-orbit">${orbs.join("")}</div>`;
    }
    // 相对朝向：每个单位都面向"自己正在对付的人"——玩家盯锁定目标、同道盯最近敌人、
    // 敌人盯最近的我方；被绕背（_backTurned）的敌人保持旧朝向——背门是真的背对着你
    let flip = "";
    if (typeof Art !== "undefined" && Art.battlerFace) {
      const bid2 = (() => {
        let b = null;
        if (isPlayer) b = Art.hasBattler("bt_hanli") ? "bt_hanli" : null;
        else if (isSide) b = u.art && Art.hasBattler("bt_" + u.art) ? "bt_" + u.art : this._battlerByName(u.name);
        else b = this._battlerByName(u.name);
        if (b && (u.alt || 0) === 1 && Art.hasBattler(b + "_fly")) b = b + "_fly";   // 飞姿用飞姿的朝向元数据
        return b;
      })();
      // 素材朝向：战斗立绘有注册元数据；半身像回退按"右向"处理（与旧版敌方镜像观感一致）
      const face = bid2 ? Art.battlerFace(bid2) : "r";
      if (face !== "c") {
        let oppPos = null;
        if (isPlayer) {
          const te = (opts.target >= 0 && c.enemies[opts.target] && c.enemies[opts.target].alive)
            ? c.enemies[opts.target] : (c.enemies.find(e => e.alive) || { pos: c.W - 1 });
          oppPos = te.pos;
        } else if (isSide) {
          const te = c.enemies.find(e => e.alive) || { pos: c.W - 1 };
          oppPos = te.pos;
        } else {
          const foes = [c.player].concat(c.side && c.side.hp > 0 ? [c.side] : []);
          const near = foes.reduce((a, b) => Math.abs(b.pos - u.pos) < Math.abs(a.pos - u.pos) ? b : a);
          // 绕背的那一拍它还没回头——朝向反着给（它行动时才转身，与机制一致）
          oppPos = u._backTurned ? (u.pos + (near.pos > u.pos ? -1 : 1)) : near.pos;
        }
        if (oppPos !== u.pos) {
          const want = u.pos < oppPos ? "r" : "l";
          if (face !== want) flip = " flipped";
        }
      }
    }
    if (flip) figCls += " flipped-img";
    const cls = ["axis-unit",
      isPlayer ? "self" : isSide ? "side" : "enemy",
      u.alive === false || u.hp <= 0 ? "dead" : "",
      (!isPlayer && !isSide && i === opts.target) ? "target" : "",
      u._charging ? "charging" : "",
      (!isPlayer && (u.lane || 0) === 0 && u.pos % 2 === 1) ? "off-row" : "",   // 错落站位：战位排敌群奇数格退后半步
      (u.lane || 0) > 0 ? "lane-" + Math.min(u.lane, 3) : "",                   // 僚位排：真单位站出来的纵深（2.5 排制）
      (u.alt || 0) === 1 ? "airborne air-" + Math.min(u.airGrade || 1, 3) : "", // 凌空：高度=境界档（飞得比对手高=实力俯视）
      (!isPlayer && !isSide && u.alive && this._armed && this._armed.kind === "enemy") ? "targetable" : "",   // 择敌：点它即放
    ].filter(Boolean).join(" ");
    // 深排镜头视差（v90）：镜头平移时僚位排"跟着镜头滑一点"——前排刷刷过、
    // 后排缓缓过（演出偏移，规则站位不变；用上一帧 _cam，transition 平滑掉一帧延迟）
    const lanePar = (u.lane || 0) > 0 ? (c._cam || 0) * 0.04 * Math.min(u.lane, 3) : 0;
    return {
      uid: isPlayer ? "player" : isSide ? "side" : "enemy:" + i,
      cls,
      left: ((u.pos + 0.5 + lanePar) / c.W * 100).toFixed(2) + "%",
      clickIdx: (!isPlayer && !isSide && u.alive) ? i : null,
      badges: badges.join(""),
      extra: orbit,
      figSrc, figCls, figGlyph,
      hpPct, shPct, mpPct: isPlayer ? mpPct : null, isPlayer,
      hpNum: `${Math.max(0, Math.round(u.hp))}/${u.hpMax}${u.shield ? `<i class="au-shnum">+${u.shield}</i>` : ""}`,
      name: `${u.name}${(!isPlayer && !isSide && i === opts.target && u.alive) ? '<span class="au-lock">◈</span>' : ""}`,
    };
  },

  /* ===== 丝滑渲染（v88 reconcile）：单位 DOM 持久化、差量更新 =====
   * 旧版整层 innerHTML 重建=入场动画重播+朝向闪回+left/translate 过渡全失效（"全是刷新"）。
   * 现在：外壳类与位置变更交给 CSS transition（滑步/升空/换排/缩放全过渡）；
   * img 持久（src/类只在真变化时碰——转身只在真变向时播）；血条宽度过渡保留。 */
  _syncUnits(c, list) {
    const box = this.el("axis-units");
    if (!box) return;
    const seen = new Set();
    list.forEach(d => {
      seen.add(d.uid);
      let el = box.querySelector(`[data-uid="${CSS.escape(d.uid)}"]`);
      if (!el) {
        el = document.createElement("div");
        el.dataset.uid = d.uid;
        el.className = d.cls;
        el.style.left = d.left;
        el.innerHTML = `<div class="au-badges"></div><i class="air-pillar"></i><span class="au-extra"></span><span class="au-fig"></span>
          <div class="au-bars"><div class="au-hp"><i></i></div></div>
          <div class="au-hpnum"></div><div class="au-name"></div>`;
        box.appendChild(el);
        el._cls = d.cls; el._left = d.left;
      }
      if (el._cls !== d.cls) { el.className = d.cls; el._cls = d.cls; }
      if (el._left !== d.left) { el.style.left = d.left; el._left = d.left; }
      el.onclick = d.clickIdx != null ? () => UI.pickTarget(d.clickIdx) : null;
      // 徽章（每回合变，轻量重写——不含 img 无闪烁）
      const bd = el.querySelector(".au-badges");
      if (bd._h !== d.badges) { bd.innerHTML = d.badges; bd._h = d.badges; }
      // 伴身（装备战斗内不变，初建一次）
      const ex = el.querySelector(".au-extra");
      if (ex._h !== d.extra) { ex.innerHTML = d.extra || ""; ex._h = d.extra; }
      // 立绘：img 持久——src/类仅真变化时更新（飞姿切换/转身才动，杜绝重建闪烁）
      const figBox = el.querySelector(".au-fig");
      if (d.figSrc) {
        let img = figBox.querySelector("img.au-img");
        if (!img) { figBox.innerHTML = `<img class="au-img" alt="" />`; img = figBox.firstChild; }
        if (img._src !== d.figSrc) { img.src = d.figSrc; img._src = d.figSrc; }
        const icls = "au-img" + d.figCls;
        if (img._icls !== icls) { img.className = icls; img._icls = icls; }
      } else if (figBox._h !== d.figGlyph) { figBox.innerHTML = d.figGlyph || ""; figBox._h = d.figGlyph; }
      // 血条：结构签名变化才重建（盾条/灵条出现与否），否则只改宽度（width 过渡保留）
      const bars = el.querySelector(".au-bars");
      const sig = (d.shPct ? "s" : "") + (d.mpPct != null ? "m" : "");
      if (bars._sig !== sig) {
        bars.innerHTML = `<div class="au-hp"><i style="width:${d.hpPct}%"></i>${d.shPct ? `<i class="sh" style="width:${d.shPct}%"></i>` : ""}</div>`
          + (d.mpPct != null ? `<div class="au-mp"><i style="width:${d.mpPct}%"></i></div>` : "");
        bars._sig = sig;
      } else {
        const hpI = bars.querySelector(".au-hp i:not(.sh)");
        if (hpI) hpI.style.width = d.hpPct + "%";
        const shI = bars.querySelector(".au-hp i.sh");
        if (shI) shI.style.width = d.shPct + "%";
        const mpI = bars.querySelector(".au-mp i");
        if (mpI && d.mpPct != null) mpI.style.width = d.mpPct + "%";
      }
      const hn = el.querySelector(".au-hpnum");
      if (hn._h !== d.hpNum) { hn.innerHTML = d.hpNum; hn._h = d.hpNum; }
      const nm = el.querySelector(".au-name");
      if (nm._h !== d.name) { nm.innerHTML = d.name; nm._h = d.name; }
    });
    // 退场：不在名单里的（死透已演完/已遁走）移除
    [...box.children].forEach(el => { if (el.dataset.uid && !seen.has(el.dataset.uid)) el.remove(); });
    // 临时探针（?dbgpos=1）：单位几何快照——查"卡进地底"
    if (location.search.indexOf("dbgpos=1") >= 0) {
      [...box.querySelectorAll(".axis-unit")].forEach(el => {
        const r = el.getBoundingClientRect(), b = box.getBoundingClientRect();
        const cs = getComputedStyle(el);
        console.log(`[pos] ${el.dataset.uid} cls=${el.className} | inline=${el.style.cssText} | translate=${cs.translate} transform=${cs.transform} scale=${cs.scale} bottom=${cs.bottom} | rect=${Math.round(r.top - b.top)}~${Math.round(r.bottom - b.top)} boxH=${Math.round(b.height)}`);
      });
    }
  },

  /* 战斗结算卡：胜/遁/败 + 每个敌人的结局（伏诛/走脱）+ 复盘与战利——
   * 看清楚发生了什么再收功（防"莫名其妙就退出战斗"）。确认后才走 _finishCombat。 */
  showCombatOutro(c, meta, done) {
    const ov = this.el("combat-outro");
    if (!ov) { done(); return; }
    const win = c.status === "win";
    const fled = c.status === "fled";
    const allEscaped = win && c.enemies.length > 0 && c.enemies.every(e => e.escaped || e.hp <= 0) && c.enemies.some(e => e.escaped) && !c.enemies.some(e => e.hp <= 0);
    // 终结演出先播完（墨溅 1.2s），结算卡随后压上
    const delay = win ? 1050 : 450;
    setTimeout(() => {
      const res = this.el("co-result");
      res.textContent = win ? (allEscaped ? "逐" : "胜") : fled ? "遁" : "败";
      res.className = "co-result " + (win ? "co-win" : fled ? "co-flee" : "co-lose");
      // 敌人结局名单：死的是死、跑的是跑，一目了然
      this.el("co-foes").innerHTML = c.enemies.map(e => {
        const fate = e.hp <= 0 ? '<b class="cf-slain">伏诛</b>' : e.escaped ? '<b class="cf-fled">走脱</b>' : win ? '<b class="cf-fled">退散</b>' : '<b class="cf-stand">未竟</b>';
        return `<div class="co-foe">${e.name} · ${fate}</div>`;
      }).join("");
      // 复盘：关键手 / 消耗 / 余裕
      const lines = [];
      if (c.stats && Object.keys(c.stats).length) {
        const top = Object.entries(c.stats).sort((a, b) => b[1] - a[1])[0];
        if (top && top[1] > 0) lines.push(`关键手「${top[0]}」共建功 ${top[1]} 伤`);
        // 协同复盘（A2）：接住统帅递的刀几次，配合是看得见的
        if (c.stats["接应配合"]) lines.push(`接应点将 ×${c.stats["接应配合"]}——她递的刀，你都接住了`);
      }
      if (!win && c.deathCause) lines.push(`你倒在「${c.deathCause.by}」的「${c.deathCause.move}」之下`);
      const mpUsed = Math.max(0, Math.round((c.player.mpMax || 0) - c.player.mp));
      lines.push(`耗灵力 ${mpUsed}　气血余 ${Math.max(0, Math.round(c.player.hp))}/${c.player.hpMax}`);
      this.el("co-detail").innerHTML = lines.map(l => `<div>${l}</div>`).join("");
      // 战利预览（与 _finishCombat 发放同源）：败/遁无所得
      let lootTxt = "";
      if (win && meta.type === "encounter") {
        const parts = [];
        if (meta.reward) Object.entries(meta.reward).forEach(([k, v]) => parts.push(k === "silver" ? `纹银×${v}` : `${DATA.items[k] ? DATA.items[k].name : k}×${v}`));
        if (meta.namedLoot && !c.enemies.some(e => e.escaped)) Object.entries(meta.namedLoot).forEach(([k, v]) => parts.push(`${DATA.items[k] ? DATA.items[k].name : k}×${v}`));
        if (meta.namedBeast && c.enemies.some(e => e.escaped)) parts.push("（妖王走脱——异闻未了，专属战利与你无缘）");
        if (parts.length) lootTxt = "得：" + parts.join("、");
      } else if (fled) lootTxt = "全身而退——这一仗没输，只是没赢。";
      this.el("co-loot").textContent = lootTxt;
      this.el("co-confirm").onclick = () => { ov.hidden = true; done(); };
      ov.hidden = false;
      if (typeof Sfx !== "undefined") Sfx.play(win ? "success" : "danger");
    }, delay);
  },

  // 点意图气泡 → 弹出完整应对提示（3.5s 自隐——一眼信息与详查信息分级）
  showIntentDetail(i) {
    const c = Engine._combat;
    if (!c) return;
    const e = c.enemies[i];
    const el = this.el("combat-intent");
    if (!e || !e.intent || !el) return;
    el.hidden = false;
    el.innerHTML = `⚡ ${this._intentHint(e.intent)}`;
    clearTimeout(this._intentTimer);
    this._intentTimer = setTimeout(() => { el.hidden = true; }, 3500);
  },

  // 单行瞬时战报（v87 用户裁决：弹幕堆叠挡视野——同屏只留 1 条，新顶旧、速来速走；
  // 完整信息以加大的战录框为正源，点「录」随时回看）
  _floatLogs(c) {
    const box = this.el("combat-floats");
    if (!box) { this._combatLogLen = c.log.length; return; }
    const fresh = c.log.slice(this._combatLogLen);
    this._combatLogLen = c.log.length;
    const last = fresh.filter(l => !/^【第\d+回合】/.test(l)).pop();   // 只取最新一条有效战报
    if (last) {
      box.innerHTML = "";                                            // 新顶旧：永不堆叠
      const el = document.createElement("div");
      el.className = "log-float" + (/造成|毒发|胜|趁虚|落空|砸了个空/.test(last) ? " lf-hit" : /受到|败|砸在|耗尽/.test(last) ? " lf-hurt" : "");
      el.textContent = last;
      box.appendChild(el);
      clearTimeout(this._floatTimer);
      this._floatTimer = setTimeout(() => el.remove(), 3200);
    }
    // 完整战录框同步（展开时可见）
    const lg = this.el("combat-log");
    if (lg) {
      const logs = c.log.slice(-40);
      lg.innerHTML = logs.map(l => {
        const cls = /造成|毒发|中的|尽灭|胜|趁虚|落空/.test(l) ? "cl-hit" : /受到|气血耗尽|败|砸在/.test(l) ? "cl-hurt" : "";
        return `<div class="${cls}">${l}</div>`;
      }).join("");
      if (!lg.hidden) lg.scrollTop = lg.scrollHeight;
    }
  },

  renderCombat(c, meta) {
    const SP = CombatAPI.SPELLS;
    // 锁定目标已死：自动换到下一个活敌（弹道/脚圈/手牌射程全部跟着走）
    if (this._combatTarget != null && (!c.enemies[this._combatTarget] || !c.enemies[this._combatTarget].alive)) {
      this._combatTarget = null;
    }
    const target = this.curTarget(c);
    const adv = target >= 0 ? c.senseVs(c.enemies[target]) : { seeIntent: false };
    const isBT = meta.type === 'breakthrough';
    const p = c.player;

    // —— 回合数 ——
    const rd = this.el("combat-round");
    if (rd) rd.textContent = `第 ${c.round} 回合`;

    // —— 危险格标记：收集敌方 cell/zone 意图（方阵：罩全排的雾带更高更浓）——
    const dangerCells = new Set(), zoneCells = new Set(), zoneFrontCells = new Set();
    c.enemies.forEach(e => {
      if (!e.alive || !e.intent) return;
      if (e.intent.targetCell != null) dangerCells.add(e.intent.targetCell);
      if (e.intent.aim === "zone" && e.intent.zoneFrom != null) {
        const frontOnly = e.intent.depth === "front";
        for (let z = e.intent.zoneFrom; z <= e.intent.zoneTo; z++) {
          zoneCells.add(z);
          if (frontOnly) zoneFrontCells.add(z);
        }
      }
    });

    // —— 地面步位刻度：格是法术现象不是棋盘——
    //    平时=淡墨刻度点；可走=青色涟漪；锁格=红雾柱升起；范围=红雾带；阵法=地面阵纹
    const lane = this.el("axis-lane");
    const movable = new Set(c.status === "ongoing" ? c.movableCells(p) : []);
    const moveLeft = (c.moveCap ? c.moveCap(p) : p.move) - (c._pMoved || 0);
    // 择地模式（阵旗上膛）：射程内步位亮金圈点格落阵；上膛中走位点击让位给布阵
    const armedCellMode = this._armed && this._armed.kind === "cell";
    let laneHtml = "";
    for (let i = 0; i < c.W; i++) {
      const fz = (c.zones || []).find(z => i >= z.from && i <= z.to);
      const zCls = fz ? `zone-${fz.type}` : "";
      const canGo = !armedCellMode && movable.has(i) && moveLeft > 0;
      const castable = armedCellMode
        && Math.abs(i - p.pos) >= this._armed.r[0] && Math.abs(i - p.pos) <= this._armed.r[1];
      const cls = ["axis-cell", zCls,
        canGo ? "can-move" : "",
        castable ? "cast-cell" : "",
        dangerCells.has(i) ? "danger-cell" : "",
        zoneCells.has(i) ? "danger-zone" : "",
        zoneFrontCells.has(i) ? "zone-front" : "",   // "扫"战位排：矮雾带（僚位无虞）；不标=罩全排高雾带
        i === 0 ? "edge-home" : "", i === c.W - 1 ? "edge-far" : "",
      ].join(" ");
      // 同轴一体：洞窟没采完的热点原格还在——走到跟前花一个主行动照采（一边打一边贪）
      const hot = (c.hotspots || []).find(h => h.pos === i && !h.taken);
      const hotNear = hot && c.playerCanTake && c.playerCanTake(hot);
      laneHtml += `<div class="${cls}" ${castable ? `onclick="UI.castAtCell(${i})"` : canGo ? `onclick="Engine.combatMove(${i})"` : ""}>
        ${dangerCells.has(i) ? '<i class="mist-pillar"></i>' : ""}
        ${zoneCells.has(i) ? '<i class="mist-band"></i>' : ""}
        ${fz ? `<i class="zone-ring"></i>` : ""}
        ${castable ? '<i class="cast-mark"></i>' : ""}
        ${hot ? `<span class="cave-hot${hotNear ? " near" : ""}" ${hotNear ? `onclick="event.stopPropagation();Engine.combatTake('${hot.id}')"` : ""} title="${hot.name}（花一个主行动采下）">${this._hotIcon(hot.name)}<i>${hot.name}</i></span>` : ""}
        <i class="dot"></i>
      </div>`;
    }
    lane.innerHTML = laneHtml;

    // —— 单位层（v88 丝滑渲染）：DOM 持久+差量更新——移动滑步/升空浮起/转身/缩放全走 CSS 过渡。
    //    阵亡退场：尸体只渲染"咽气那一拍"（让墨溅+淡出播完），下一次重渲染即除名
    const unitsEl = this.el("axis-units");
    this._deadShown = this._deadShown || {};
    const unitList = [this._axisSprite(c, p, { isBT, target })];
    if (c.side) unitList.push(this._axisSprite(c, c.side, { isBT, target }));
    c.enemies.forEach((e, i) => {
      if (e.escaped) return;
      if (!e.alive) {
        if (this._deadShown[i]) return;   // 已演过死——不再入场
        this._deadShown[i] = true;
      }
      unitList.push(this._axisSprite(c, e, { isBT, target, enemyIndex: i }));
    });
    this._syncUnits(c, unitList);

    // —— 场景即战场：宽轴（W>11）拉镜头（死区跟随）——你在画面里走，镜头只在你贴近画框时才拉。
    //    镜头跟人不锁人：移动是"人滑过画面"，不是"世界从脚下滑走"。长卷背景以视差随镜头退行。 ——
    const laneEl2 = this.el("axis-lane");
    const bgEl2 = this.el("combat-bg");
    // —— 统一相机（v89——"全是同一个问题"的根治）：一组镜头数（zoom/lift/cam）
    //    同帧派发到所有层。镜头后拉时：世界（人+格+地台）整体缩、中景半缩、远景微缩
    //    ——近缩多远缩少=真透视；同曲线同时长=层间永不脱节 ——
    const fieldEl0 = this.el("axis-field");
    const air = (p.alt || 0) === 1, aGrade = Math.min(p.airGrade || 1, 3);
    const aliveN = c.units().length;
    // zoom：人数/排数退档 × 升空大幅后拉（airGrade 越高拉得越远——飞得高看得远）
    const zoom = Math.max(0.72, Math.min(1,
      1 - 0.035 * ((c.L || 2) - 2) - 0.02 * Math.max(0, aliveN - 3)
        - (air ? 0.05 + 0.045 * aGrade : 0)));
    const lift = air ? aGrade : 0;   // 天空抬升档：底图层下沉露天（中景沉得比远景多）
    this._camZoom = zoom;
    if (fieldEl0) {
      fieldEl0.style.setProperty("--lanes", c.L || 2);
      fieldEl0.classList.toggle("sky-view", air);
      const ovEl = this.el("combat-overlay");
      if (ovEl) {
        const fr = fieldEl0.getBoundingClientRect(), or2 = ovEl.getBoundingClientRect();
        if (fr.height > 0) ovEl.style.setProperty("--bg-cut", Math.max(0, Math.round(or2.bottom - fr.bottom)) + "px");
      }
    }
    // 层深缩放（v90 方向修正）：镜头后拉=所有层一起变小（近层缩多、远层缩少；
    // 远层下限 1.10 防黑边）。地面态=推近的镜头（背景偏大），升空=退回全图——
    // 之前是"人缩小、背景反而放大"，层间反向运动正是"浮在一张图上"的数学根源
    const zn = Math.max(0, Math.min(1, (zoom - 0.72) / 0.28));   // 1=贴地推近 0=高空全图
    const farScale = (1.10 + zn * 0.12).toFixed(3);
    const midScale = (1.00 + zn * 0.31).toFixed(3);
    // 镜头上摇阶梯（升空看天）：近层在画面里沉得多——前景>世界>中景>远景，同向不同速
    const worldY = lift ? ` translateY(${(lift * 3).toFixed(1)}%)` : "";
    const midY = lift ? ` translateY(${(lift * 2.2).toFixed(1)}%)` : "";
    const farY = lift ? ` translateY(${(lift * 1.0).toFixed(1)}%)` : "";
    const fgY = lift ? ` translateY(${(lift * 16).toFixed(1)}%)` : "";   // 前景大幅滑出：脚边的草最先离开镜头
    const fgEl = this.el("combat-fg");
    const ovSky = this.el("combat-overlay");
    if (ovSky) ovSky.classList.toggle("sky", air);   // 升空：前景淡出（贴地遮挡物不再挡视野）
    if (c.W > 11) {
      // 宽死区（v90）：玩家在画面中部大半区域随便走，镜头纹丝不动——"是韩立在动"；
      // 只有逼近画框边缘才缓缓追上（追，不绑）
      const V = air ? Math.min(c.W, 11 + 2 * aGrade) : 11, m = 2.4;
      const trackW = (c.W / V) * 100;
      let cam = (typeof c._cam === "number") ? c._cam : (p.pos + 0.5 - V / 2);
      if (p.pos + 0.5 < cam + m) cam = p.pos + 0.5 - m;
      if (p.pos + 0.5 > cam + V - m) cam = p.pos + 0.5 - (V - m);
      // 锁定目标"半出画才拉"（v90 放宽）：目标贴边不动镜——镜头活动越少越稳
      const te2 = (target >= 0 && c.enemies[target] && c.enemies[target].alive) ? c.enemies[target] : null;
      if (te2) {
        if (te2.pos + 0.5 > cam + V + 0.2) cam = te2.pos + 0.5 - (V - 0.6);
        if (te2.pos + 0.5 < cam - 0.2) cam = te2.pos + 0.5 - 0.6;
        if (p.pos + 0.5 < cam + 1.2) cam = p.pos + 0.5 - 1.2;
        if (p.pos + 0.5 > cam + V - 1.2) cam = p.pos + 0.5 - (V - 1.2);
      }
      // 接力运镜（A2 v0）：同道正缠斗的目标软性入画——优先级最低，绝不挤掉玩家与锁定目标
      const st2 = (c._sideTarget != null && c.enemies[c._sideTarget] && c.enemies[c._sideTarget].alive)
        ? c.enemies[c._sideTarget] : null;
      if (st2 && st2 !== te2) {
        if (st2.pos + 0.5 > cam + V - 0.5) cam = st2.pos + 0.5 - (V - 0.5);
        if (st2.pos + 0.5 < cam + 0.5) cam = st2.pos + 0.5 - 0.5;
        if (te2) {
          if (te2.pos + 0.5 > cam + V - 0.8) cam = te2.pos + 0.5 - (V - 0.8);
          if (te2.pos + 0.5 < cam + 0.8) cam = te2.pos + 0.5 - 0.8;
        }
        if (p.pos + 0.5 < cam + 1.2) cam = p.pos + 0.5 - 1.2;
        if (p.pos + 0.5 > cam + V - 1.2) cam = p.pos + 0.5 - (V - 1.2);
      }
      cam = Math.max(0, Math.min(c.W - V, cam));
      c._cam = cam;
      const shift = (cam / c.W) * 100;
      // 世界层：视差平移 + 镜头 zoom + 上摇沉降，同一个 transform（origin 贴地——脚位不漂）
      [laneEl2, unitsEl].forEach(el => {
        el.style.width = trackW + "%";
        el.style.transform = `translateX(-${shift.toFixed(2)}%)${worldY} scale(${zoom.toFixed(3)})`;
        el.classList.add("cam-track");
      });
      if (bgEl2) {
        const camT = (c.W - V) > 0 ? cam / (c.W - V) : 0;
        bgEl2.style.transform = `translateX(${(-camT * 9).toFixed(2)}%)${farY} scale(${farScale})`;
        const midEl = this.el("combat-bgmid");
        if (midEl && midEl.classList.contains("on")) {
          midEl.style.transform = `translateX(${(-camT * 17).toFixed(2)}%)${midY} scale(${midScale})`;
        }
        // 前景=最快视差层（近景动得快是景深的第一线索）：幅度大于世界层
        if (fgEl && fgEl.classList.contains("on")) {
          fgEl.style.transform = `translateX(${(-camT * 30).toFixed(2)}%)${fgY}`;
        }
      }
      // 锁定目标在镜头外：画框边缘点名（远闻其声的战斗版——它在那头，没丢）
      this._fightFarCue(te2 && te2.pos + 0.5 > cam + V ? `${te2.name} ▶`
        : te2 && te2.pos + 0.5 < cam ? `◀ ${te2.name}` : null,
        te2 && te2.pos + 0.5 < cam);
    } else {
      [laneEl2, unitsEl].forEach(el => {
        el.style.width = "";
        el.style.transform = `${worldY.trim()} ${zoom < 0.999 ? `scale(${zoom.toFixed(3)})` : ""}`.trim();
        el.classList.add("cam-track");   // 窄轴同样吃镜头过渡（升空后拉要丝滑）
      });
      // 窄轴同一族层深数学（方向一致：升空全员退小）
      if (bgEl2) bgEl2.style.transform = `${farY.trim()} scale(${farScale})`.trim();
      const midEl0 = this.el("combat-bgmid");
      if (midEl0 && midEl0.classList.contains("on")) {
        midEl0.style.transform = `${midY.trim()} scale(${midScale})`.trim();
      }
      if (fgEl && fgEl.classList.contains("on")) fgEl.style.transform = fgY.trim();
      this._fightFarCue(null);
    }

    // —— 防撞排布（v87 拥挤重设计）：同高度层单位按屏距扫描，间距不足时右侧者
    //    顺势让开（深排让得多）——规则站位不动，只挪演出排布；血条名牌随之岔开 ——
    this._decrowd(unitsEl, c);

    // —— 神识料敌提示条（上膛中优先显示择敌/择地指引）——
    const intentEl = this.el("combat-intent");
    if (intentEl) {
      const te = target >= 0 ? c.enemies[target] : null;
      if (this._armed) {
        const asp = CombatAPI.SPELLS[this._armed.id];
        intentEl.hidden = false;
        intentEl.innerHTML = this._armed.kind === "cell"
          ? `✦ 「${asp.name}」已上膛——<b style="color:var(--gold)">点亮金圈的步位落阵</b>；再点法术牌可收手。`
          : `✦ 「${asp.name}」已上膛——<b style="color:var(--gold)">点选要打的敌人</b>；再点法术牌可收手。`;
      } else if (te && te.alive && te.intent && adv.seeIntent) {
        intentEl.hidden = false;
        intentEl.innerHTML = `⚡ 神识料敌：${this._intentHint(te.intent)}`;
      } else if (te && te.alive && (dangerCells.size || zoneCells.size)) {
        intentEl.hidden = false;
        intentEl.innerHTML = `⚠ 杀气锁地：红光处即将遭袭——挪开脚步，或举盾硬接。`;
      } else { intentEl.hidden = true; intentEl.innerHTML = ""; }
    }

    // —— 灵力池 + 行动经济行 ——
    const mpPct = Math.max(0, p.mp / p.mpMax * 100);
    const acts = (c._pActsMax || 1) - (c._pActsUsed || 0);
    this.el("combat-mprow").innerHTML = `
      <div class="mp-pool" title="灵力：一切手段共用一池，整场不自动恢复">
        <span class="mp-label">灵力</span>
        <div class="mp-bar"><i style="width:${mpPct}%"></i></div>
        <span class="mp-num">${Math.round(p.mp)}/${p.mpMax}</span>
      </div>
      <div class="act-chips">
        <span class="act-chip ${acts > 0 ? '' : 'used'}" title="主行动">出手×${Math.max(0, acts)}</span>
        <span class="act-chip ${c._pQuickUsed ? 'used' : ''}" title="瞬发牌（符箓丹药）每回合一张">瞬发${c._pQuickUsed ? '已用' : '×1'}</span>
        <span class="act-chip ${moveLeft > 0 ? '' : 'used'}" title="移动力：点亮起的格子挪步">身法×${Math.max(0, moveLeft)}</span>
        ${p.momentum ? `<span class="act-chip momentum" title="剑势：连击可引爆">势×${p.momentum}</span>` : ""}
      </div>`;

    // —— 手牌（主行动 + 瞬发底牌分区）——
    const rangeTxt = sp => sp.range && sp.range[1] > 0
      ? (sp.range[0] === sp.range[1] ? (sp.range[0] === 1 ? "贴身" : `${sp.range[0]}格`) : `${sp.range[0]}~${sp.range[1]}格`)
      : "自身";
    const spellBtn = (id, extraCls, role) => {
      const sp = SP[id];
      const wx = sp.elem || (sp.school || "jin");
      const afford = c.canAfford(id);
      // 射程判定（二次确认配套）：阵旗看"有没有格可落"（恒真）；打击类看"够得着任一活敌"——
      // 锁定目标够不着但别的敌人够得着时，牌不再误灰（上膛后点谁打谁）
      const inR = (sp.type === "zone" && !sp.selfZone) ? true
        : (sp.range && sp.range[1] === 0) ? true
        : c.enemies.some((e2, i2) => e2.alive && c.castableAt(id, i2));
      const noPouch = sp.consume && !(p.pouch[sp.consume] > 0);
      const cdLeft = c.cooldownLeft ? c.cooldownLeft(id) : 0;
      const usable = afford && inR;
      const why = !afford
        ? (cdLeft > 0 ? `回气${cdLeft}` : noPouch ? "无存货" : (sp.mp || 0) > p.mp ? "灵力不足" : sp.quick && c._pQuickUsed ? "瞬发已用" : "行动已尽")
        : (!inR ? "射程外" : "");
      const pouchTxt = (sp.consume ? `<span class="spouch ${noPouch ? 'empty' : ''}">×${p.pouch[sp.consume] || 0}</span>` : "")
        + (why ? `<span class="spouch empty">${why}</span>` : "");
      const dispName = (id === "zhayan" && p.swordMastery) ? "眨眼剑法·大成" : sp.name;
      const dispFx = (id === "zhayan" && p.swordMastery) ? spellEffectText(sp) + " 攒势×2" : spellEffectText(sp);
      const armedCls = (this._armed && this._armed.id === id) ? "armed" : "";
      const roleTag = role === "main" ? `<span class="role-tag rt-main">主</span>`
        : role === "def" ? `<span class="role-tag rt-def">御</span>` : "";
      return `<button class="spell-btn ${extraCls || ''} ${armedCls} ${usable ? '' : 'off'}" ${usable ? '' : 'disabled'} onclick="UI.armSpell('${id}')" title="${sp.desc || ''}">
        ${roleTag}<span class="seal ${sp.consume ? 'cinnabar' : 'wx-' + wx}">${sealChar(sp.name)}</span>
        <span class="sp-body">
          <span class="sname">${dispName}<span class="srange">${rangeTxt(sp)}</span></span>
          <span class="scost"><span class="cost-dot mp-dot">${sp.mp ? `灵力${sp.mp}` : "零耗"}</span> ${dispFx}${pouchTxt}</span>
        </span>
      </button>`;
    };
    // —— 手牌四区制（combat-arsenal-design 四·五）：同一张双排同滑网格内分区，单屏不竖涨 ——
    //    法宝法器区：催动外物（source=treasure，练气法器→筑基上品→结丹法宝同区换代）
    //    法术区：功法法术+武学（主行动的主体）
    //    瞬发区：符箓/阵法/丹药（不占主行动的底牌）
    //    灵傀区：灵宠/傀儡/同道（侧位单位随身牌：血量+简令）
    let treasures = p.spells.filter(id => SP[id] && !SP[id].quick && SP[id].source === "treasure");
    const mains = p.spells.filter(id => SP[id] && !SP[id].quick && SP[id].source !== "treasure");
    const quicks = p.spells.filter(id => SP[id] && SP[id].quick);
    // 主攻/防御位（用户裁决）：法宝区有主次之分——主攻法宝（装备武器所授，余者首张攻击法宝
    // 兜底）排第一标"主"；护体类法宝标"御"；其余为次位。主攻法宝另有伴身演出（au-blades）
    const wGear = (typeof State !== "undefined" && State.gearOf) ? State.gearOf("weapon") : null;
    const mainTre = (wGear && wGear.grantSpells && wGear.grantSpells.find(id => treasures.includes(id)))
      || treasures.find(id => SP[id].type === "atk") || null;
    if (mainTre) treasures = [mainTre].concat(treasures.filter(id => id !== mainTre));
    const treRole = id => id === mainTre ? "main" : (SP[id].type !== "atk" ? "def" : "");
    this.el("combat-spells").innerHTML =
      `<div class="spell-grid">`
      + (treasures.length ? `<span class="zone-tag zt-treasure">法宝</span>${treasures.map(id => spellBtn(id, "treasure", treRole(id))).join("")}` : "")
      + `<span class="zone-tag">法术</span>${mains.map(id => spellBtn(id)).join("")}`
      + `</div>`;
    // 瞬发 + 助战：同一条窄排（瞬发牌横滑；助战卡点击换简令）。
    // 客随例外（用户裁决）：境界远高于你的同道（mastery≥2）全自动——她指挥你（点将），
    // 你指挥不了她；简令四档只对平辈/下属（尸傀/灵宠/低阶同道）生效
    const qrow = this.el("quick-row");
    if (qrow) {
      const petCard = (u) => {
        const down = u.hp <= 0;
        const lead = u.kind === "ally" && (u.mastery || 0) >= 2;
        const st = u.stance || "follow";
        const stCh = lead ? "帅" : ({ follow: "随", attack: "攻", guard: "守", retreat: "撤" }[st] || "随");
        const hpPct = Math.max(0, Math.round(u.hp / u.hpMax * 100));
        const mpPct = u.mpMax ? Math.max(0, Math.round((u.mp || 0) / u.mpMax * 100)) : 0;
        return `<button class="pet-card ${down ? 'down' : ''} ${lead ? 'lead' : ''}" ${down ? 'disabled' : ''}
          onclick="Engine.cycleSideStance()" title="${down ? u.name + ' 已离场' : lead ? '她的境界远在你之上——全程自主出手，每回合为你点将' : '点击换简令：随行→强攻→护主→后撤'}">
          <span class="seal">${u.name[0]}</span>
          <span class="pc-body"><span class="pc-name">${u.name}</span>
          <span class="pc-hp"><i style="width:${hpPct}%"></i></span>
          ${u.mpMax ? `<span class="pc-mp"><i style="width:${mpPct}%"></i></span>` : ""}</span>
          <span class="pc-st">${down ? "殁" : stCh}</span>
        </button>`;
      };
      qrow.innerHTML =
        (c.side ? `<span class="zone-tag zt-pet">助战</span>${petCard(c.side)}` : "")
        + (quicks.length ? `<span class="zone-tag zt-quick">瞬发</span>${quicks.map(id => spellBtn(id, "trump")).join("")}` : "");
    }

    // —— 遁走按钮：仅在阵脚亮出 ——
    const fleeBtn = this.el("combat-flee");
    if (fleeBtn) fleeBtn.hidden = !(c.status === "ongoing" && c.playerCanFlee && c.playerCanFlee());
    const quickBtn = this.el("combat-quick");
    if (quickBtn) quickBtn.hidden = !(meta.canQuick && c.round <= 1);
    // —— 升空/落地：有腾空之能才亮（空层 2.5D）——
    const flyBtn = this.el("combat-fly");
    if (flyBtn) {
      flyBtn.hidden = !(c.status === "ongoing" && p.canFly);
      flyBtn.textContent = (p.alt || 0) === 1 ? "落地" : "升空";
      flyBtn.disabled = !(c.playerCanFly && c.playerCanFly());
    }

    // —— 战报：弹幕飘过 + 战录框同步 ——
    this._floatLogs(c);
  },

  /* ===========================================================
   *  箱庭探索 v3 · L1 舆图 + L3 横版深窟（exploremap.js）
   * =========================================================== */
  openExmap() {
    const s = State.data;
    if (!s.exmap) return;
    this.el("exmap-overlay").hidden = false;
    if (typeof Sfx !== "undefined" && Sfx.bgm) Sfx.bgm("tense");
    this._exmapNoteQueue = [];
    this.renderExmap();
  },
  closeExmap() {
    this.el("exmap-overlay").hidden = true;
    this.el("exmap-notes").innerHTML = "";
  },

  // 见闻字幕：底部浮现一行（移动演出/警兆/场景描述）
  exmapNote(text, kind) {
    const box = this.el("exmap-notes");
    if (!box) return;
    const div = document.createElement("div");
    div.className = "exmap-note" + (kind ? " " + kind : "");
    div.textContent = text;
    box.appendChild(div);
    while (box.children.length > 3) box.removeChild(box.firstChild);
    setTimeout(() => { div.classList.add("fade"); setTimeout(() => div.remove(), 900); }, kind === "desc" ? 6800 : 4800);
  },

  renderExmap() {
    const s = State.data, x = s.exmap;
    if (!x) return;
    const f = ExploreMap.cur(x);
    const isCave = f.kind === "cave" || f.kind === "scene";
    this.el("exmap-field").style.display = isCave ? "none" : "";
    this.el("exmap-scene").hidden = !isCave;
    if (isCave) { this._renderExmapScene(x, f); return; }
    this._renderExmapField(x, f);
  },

  /* ---------- L1 舆图渲染 ---------- */
  _renderExmapField(x, f) {
    const map = ExploreMap.mapOf(f);
    // 背景：禁地全景横图，压暗作舆图底
    const bg = this.el("exmap-bg");
    const bgUrl = Art.sceneUrl(map.bg, { landscape: true });
    if (bgUrl && bg.dataset.cur !== bgUrl) { bg.style.backgroundImage = `url('${bgUrl}')`; bg.dataset.cur = bgUrl; }

    // 钟盘：第X日 + 血幕预警
    const ci = ExploreMap.clockInfo(x);
    const nextCurfew = (map.curfew || []).find(cf => ci.clock < cf.at);
    this.el("exmap-title").textContent = map.name;
    this.el("exmap-clock").innerHTML =
      `<span class="exclk-day">第 ${ci.day} 日</span>` +
      `<span class="exclk-ticks">${"●".repeat(Math.max(0, (map.ticksPerDay || 6) - ci.tick))}${"○".repeat(ci.tick)}</span>` +
      `<span class="exclk-left">血幕阖于 ${ci.left} 钟后</span>` +
      (nextCurfew ? `<span class="exclk-warn">血幕收缩：${nextCurfew.at - ci.clock} 钟后</span>` : "");

    // 节点与连线
    const opts = ExploreMap.options(x);
    const optMap = {};
    opts.forEach(o => { optMap[o.id] = o; });
    const pat = ExploreMap.patrolAt(x);

    // 连线（SVG，已见节点之间才画）
    const svg = this.el("exmap-edges");
    let lines = "";
    (map.edges || []).forEach(([a, b]) => {
      const na = map.nodes[a], nb = map.nodes[b];
      const seenA = f.visited[a], seenB = f.visited[b];
      if (!seenA && !seenB) return;
      const isOpt = (a === f.node && optMap[b]) || (b === f.node && optMap[a]);
      lines += `<line x1="${na.x}" y1="${na.y}" x2="${nb.x}" y2="${nb.y}" class="exedge${isOpt ? " reach" : ""}"/>`;
    });
    svg.innerHTML = lines;

    // 节点
    const box = this.el("exmap-nodes");
    let html = "";
    Object.entries(map.nodes).forEach(([id, n]) => {
      const seen = f.visited[id];
      const opt = optMap[id];
      // 可见性：去过 / 相邻可去（雾影）/ 情报标出（钟吾图、古阵）
      if (!seen && !opt && !(pat && (id === pat.node || id === pat.next) && f.intel.patrol_route)) return;
      const here = id === f.node;
      let cls = "exnode";
      if (here) cls += " here";
      if (opt && !opt.closed) cls += " reach";
      if (f.closed[id]) cls += " closed";
      if (f.cleared[id]) cls += " cleared";
      if (!seen || (seen === "seen" && !here)) cls += " ghost";   // 雾影：没去过/只在图上见过
      let riskMark = "";
      if (!f.closed[id] && pat && id === pat.node && f.intel.patrol_route) riskMark = `<span class="exrisk killer">杀</span>`;
      else if (!f.closed[id] && pat && id === pat.next && f.intel.patrol_route) riskMark = `<span class="exrisk shadow">影</span>`;
      else if (opt && opt.risk === "killer") riskMark = `<span class="exrisk killer">杀</span>`;
      else if (opt && opt.risk === "shadow") riskMark = `<span class="exrisk shadow">影</span>`;
      else if (!f.closed[id] && n.kind === "danger") riskMark = `<span class="exrisk lair">凶</span>`;
      else if (!f.closed[id] && n.kind === "enter" && n.boss) riskMark = `<span class="exrisk boss">渊</span>`;
      const cost = opt && !here ? `<span class="excost">${opt.cost}钟</span>` : "";
      const click = (opt && !f.closed[id] && !here) ? `onclick="Engine.exmapTravel('${id}')"` : "";
      html += `<div class="${cls}" style="left:${n.x}%;top:${n.y}%" ${click}>
        <span class="exicon">${n.icon || "·"}</span>
        <span class="exname">${n.name}</span>${cost}${riskMark}
      </div>`;
    });
    // 韩立棋子（CSS transition 沿位移走——移动演出）
    const cn = map.nodes[f.node];
    html += `<div class="expawn" style="left:${cn.x}%;top:${cn.y}%"><img src="${Art.url("hanli") || ""}" alt=""></div>`;
    // 封岳棋子（有情报才显形；无情报时只有风险标注）
    if (pat && f.intel.patrol_route && !f.closed[pat.node]) {
      const pn = map.nodes[pat.node];
      html += `<div class="expawn foe" style="left:${pn.x}%;top:${pn.y}%"><img src="${Art.url(pat.def.art) || ""}" alt=""></div>`;
    }
    box.innerHTML = html;

    // 行动条：按当前节点类型给动作（到达即所得）
    const node = map.nodes[f.node];
    const acts = [];
    if (node.loot && !f.cleared[f.node]) acts.push(`<button class="btn" onclick="Engine.exmapGather()">${node.kind === "danger" ? "搜刮（1钟）" : "采集（1钟）"}</button>`);
    if (node.kind === "lore" && !f.guzhenUsed) acts.push(`<button class="btn" onclick="Engine.exmapReadLore()">以神识读阵</button>`);
    if (node.kind === "enter") acts.push(`<button class="btn btn-warn" onclick="Engine.exmapEnterSub()">潜入洞窟</button>`);
    if (node.kind === "exit") acts.push(`<button class="btn btn-warn" onclick="Engine.finishExmap('leave')">离开禁地</button>`);
    acts.push(`<button class="btn btn-ghost" onclick="Engine.exmapStay(1)">${node.kind === "rest" ? "打坐调息（1钟）" : "驻守一钟"}</button>`);
    this.el("exmap-actions").innerHTML = acts.join("");
  },

  /* ---------- L3 轴式洞窟渲染：探索格=战斗格（同一条轴，镜头跟随） ---------- */
  // 朝向工具：素材 face vs 期望朝向（面向对手）→ 是否镜像
  _faceFlip(bid, selfPos, otherPos) {
    if (typeof Art === "undefined" || !Art.battlerFace || otherPos == null) return "";
    const face = Art.battlerFace(bid);
    if (face === "c") return "";
    const want = selfPos < otherPos ? "r" : "l";
    return face === want ? "" : " flipped";
  },

  _renderExmapScene(x, f) {
    const map = ExploreMap.mapOf(f);
    const bg = this.el("exmap-bg");
    const bgUrl = Art.sceneUrl(map.bg, { landscape: true });
    if (bgUrl && bg.dataset.cur !== bgUrl) { bg.style.backgroundImage = `url('${bgUrl}')`; bg.dataset.cur = bgUrl; }

    const W = map.W;
    const beast = (map.watchers || []).find(wt => wt.beast);
    const blown = map.exposeLimit ? (f.expose || 0) >= map.exposeLimit : false;

    // 入场氛围字幕（一次性队列）
    if (!f.introDone) {
      f.introDone = true;
      (map.intro || []).forEach((t, i) => setTimeout(() => this.exmapNote(t, "desc"), 400 + i * 2200));
    }

    // —— 拉镜头（死区跟随）：韩立在画面里走，镜头只在他贴近画框边缘时才拉 ——
    //    锁死居中=世界在动；死区跟随=人在走、镜头追人（横版卷轴的语感）
    const stage = this.el("exmap-scene-stage");
    const V = 12;                                    // 探索视口格数（开战推近到11——镜头一沉）
    const margin = 3.2;                              // 死区边距（格）：贴边才拉镜
    const trackW = (W / V) * 100;
    let cam = (typeof f._cam === "number") ? f._cam : (f.pos + 0.5 - V / 2);
    if (f.pos + 0.5 < cam + margin) cam = f.pos + 0.5 - margin;
    if (f.pos + 0.5 > cam + V - margin) cam = f.pos + 0.5 - (V - margin);
    cam = Math.max(0, Math.min(W - V, cam));
    f._cam = cam;
    const shift = (cam / W) * 100;                   // 占 track 自身宽度的百分比
    const camT = W > V ? cam / (W - V) : 0;          // 镜头行程 0~1（长卷背景视差用）

    // —— 持久骨架：pano/track/units 不重建——移动与拉镜才有过渡动画（"走出来"的关键）——
    let track = stage.querySelector(".cave-track");
    if (!track || stage.dataset.cave !== f.mapId) {
      stage.dataset.cave = f.mapId;
      stage.innerHTML = `
        <div class="cave-pano"></div>
        <div class="cave-track">
          <div class="axis-lane cave-lane"></div>
          <div class="axis-units"></div>
        </div>
        <div class="cave-far-glow" hidden><i></i><span></span></div>`;
      track = stage.querySelector(".cave-track");
    }
    // 长卷背景：跟着镜头走、但比脚下慢半拍（视差=纵深）——背景在退，才看得出人在前进
    const pano = stage.querySelector(".cave-pano");
    const panoId = (map.pano && Art.has(map.pano)) ? map.pano : map.bg;
    const panoUrl = Art.sceneUrl(panoId, { landscape: true });
    if (pano.dataset.cur !== panoUrl) { pano.style.backgroundImage = `url('${panoUrl}')`; pano.dataset.cur = panoUrl; }
    pano.style.left = `-${(camT * 50).toFixed(2)}%`;
    track.style.width = trackW + "%";
    track.style.transform = `translateX(-${shift.toFixed(2)}%)`;

    // 轴格：步位刻度 + 热点 + 已布置标记 + 可走点位（格子状态整排重排，不参与动画）
    let laneHtml = "";
    for (let i = 0; i < W; i++) {
      const hot = (map.hotspots || []).find(h => h.pos === i && !f.taken[h.id]);
      const prepEntry = Object.entries(f.preps || {}).find(([pid, c]) => c === i);
      const prepDef = prepEntry ? (map.preps || []).find(pp => pp.id === prepEntry[0]) : null;
      const isWatcher = (map.watchers || []).some(wt => wt.pos === i);
      const canGo = !isWatcher && i !== f.pos;
      const placing = this._cavePlacing;
      const canPlace = placing && !isWatcher && Math.abs(f.pos - i) <= 2 && !prepEntry;
      const cls = ["axis-cell", canGo && !placing ? "can-move" : "", canPlace ? "can-place" : "",
        prepDef && prepDef.zone ? `zone-${prepDef.zone}` : ""].join(" ");
      const click = canPlace ? `onclick="UI.cavePlaceAt(${i})"` : (canGo && !placing ? `onclick="Engine.exmapCaveMove(${i})"` : "");
      laneHtml += `<div class="${cls}" ${click}>
        ${prepDef ? `<i class="zone-ring"></i><span class="cave-prep-mark" title="${prepDef.name}">${prepDef.mine ? "伏" : "阵"}</span>` : ""}
        ${hot ? `<span class="cave-hot${Math.abs(f.pos - hot.pos) <= 1 ? " near" : ""}" ${Math.abs(f.pos - hot.pos) <= 1 ? `onclick="event.stopPropagation();Engine.exmapCaveTake('${hot.id}')"` : ""} title="${hot.name}（+${hot.expose}惊动）">${this._hotIcon(hot.name)}<i>${hot.name}</i></span>` : ""}
        <i class="dot"></i>
      </div>`;
    }
    track.querySelector(".axis-lane").innerHTML = laneHtml;

    // 单位增量更新：同一拨人只挪位置/转朝向——左右走是滑出来的（CSS 过渡），转身是即时的
    const unitsEl = track.querySelector(".axis-units");
    const udefs = [{ key: "hanli", art: "bt_hanli", fallback: "hanli", name: "韩立",
                     cls: "axis-unit self cave-u", pos: f.pos, facePos: beast ? beast.pos : W - 1 }];
    (map.watchers || []).forEach((wt, wi) => {
      // 朝向：缠斗双方互盯；被惊动后妖兽转头锁你——谁在看你，立绘说了算
      const other = wt.beast
        ? (blown ? { pos: f.pos } : (map.watchers.find(w2 => !w2.beast) || { pos: 0 }))
        : (map.watchers.find(w2 => w2.beast) || { pos: W - 1 });
      udefs.push({ key: "wt" + wi, art: wt.art, name: wt.name + (wt.beast ? "" : "（缠斗中）"),
                   cls: "axis-unit cave-u " + (wt.beast ? "enemy cave-beast" : "side") + " fighting",
                   pos: wt.pos, facePos: other.pos });
    });
    const ukeys = udefs.map(d => d.key).join(",");
    if (unitsEl.dataset.keys !== ukeys) {
      unitsEl.dataset.keys = ukeys;
      unitsEl.innerHTML = udefs.map(d => {
        const src = Art.battlerUrl(d.art) || (d.fallback ? Art.url(d.fallback) : null);
        if (!src) return "";
        return `<div class="${d.cls}" data-k="${d.key}">
          <img class="au-img battler" src="${src}" alt="">
          <div class="au-name">${d.name}</div>
        </div>`;
      }).join("");
    }
    udefs.forEach(d => {
      const uel = unitsEl.querySelector(`[data-k="${d.key}"]`);
      if (!uel) return;
      uel.style.left = ((d.pos + 0.5) / W * 100).toFixed(2) + "%";
      const img = uel.querySelector(".au-img");
      if (img) img.classList.toggle("flipped", !!this._faceFlip(d.art, d.pos, d.facePos));
    });

    // 远光：战团还在镜头外时，画框右缘垂一道微光与竖排小字——先见其光，后见其人
    const glow = stage.querySelector(".cave-far-glow");
    if (glow) {
      const outOfView = beast && (beast.pos + 0.5) > cam + V;
      glow.hidden = !outOfView;
      if (outOfView) glow.querySelector("span").textContent = blown ? "深处的目光，正向你压来" : "深处绫光明灭，斗法未歇";
    }

    // —— 底部面板：题字 + 惊动仪表 + 布置符牌 + 动手 ——
    const panel = this.el("exmap-scene-panel");
    const limit = map.exposeLimit || 100;
    const exp = Math.min(f.expose || 0, limit);
    const expDanger = exp / limit >= 0.7;
    const prepIcons = { kunzu: "困", juling: "聚", anfu: "符", tienu: "傀" };
    let html = `
      <div class="exsc-head">
        <div class="exsc-title-block">
          <div class="exsc-title">${map.name}</div>
          <div class="exsc-sub">走到跟前才能采，选好落点才能布——它没察觉你之前，每一步都是先机。</div>
        </div>
        <div class="exsc-expose${expDanger ? " danger" : ""}" title="贪与稳：每一次出手都可能惊动潭底">
          <span class="exsc-explabel">惊<br>动</span>
          <div class="exsc-expbar"><i style="width:${Math.round(exp / limit * 100)}%"></i></div>
          <span class="exsc-expnum">${exp}<i>/${limit}</i></span>
        </div>
      </div>`;
    html += `<div class="exsc-preps">`;
    (map.preps || []).forEach(p => {
      const placedCell = (f.preps || {})[p.id];
      const placed = placedCell != null;
      const have = p.item ? (typeof State !== "undefined" ? State.count(p.item) : 0)
        : (p.side ? ((State.data.sideUnit && State.data.sideUnit.status !== "broken") ? 1 : 0) : 1);
      const dis = placed || have < 1;
      const selecting = this._cavePlacing === p.id;
      html += `<button class="prep-card${placed ? " placed" : ""}${selecting ? " selecting" : ""}${dis && !placed ? " lack" : ""}"
        ${dis ? "disabled" : `onclick="UI.cavePlacePick('${p.id}')"`} title="${p.hint}">
        <span class="prep-seal">${prepIcons[p.id] || "阵"}</span>
        <span class="prep-body">
          <span class="prep-name">${p.name}${placed ? `<i class="prep-where">第${placedCell + 1}步</i>` : ""}</span>
          <span class="prep-eff">${selecting ? "点轴上的格子落位（自身两步内）" : (placed ? "已落位——开战即生效" : p.hint)}</span>
        </span>
        <span class="prep-tag">${placed ? "✓" : p.item ? `×${have}` : (p.side ? (have ? "随行" : "不在") : "")}</span>
      </button>`;
    });
    html += `</div>`;
    // —— 出手即开战：手牌常驻，射程是把真尺——第一招的伤害就是开战的那一下 ——
    const hand = (typeof Engine !== "undefined" && Engine.cavePlayerSpells) ? Engine.cavePlayerSpells() : [];
    const dist = beast ? Math.abs(f.pos - beast.pos) : null;
    if (hand.length) {
      html += `<div class="exsc-hand">
        <div class="exsc-hand-head">
          <span class="eh-title">出手即开战</span>
          <span class="eh-dist${blown ? " alert" : ""}">距墨蛟 ${dist} 格 · ${blown ? "它已有备" : "它未察觉——首击即先机"}</span>
        </div>
        <div class="exsc-hand-row">`;
      hand.forEach(hd => {
        const rTxt = hd.range[0] === hd.range[1] ? (hd.range[0] === 1 ? "贴身" : hd.range[0] + "格") : `${hd.range[0]}~${hd.range[1]}格`;
        html += `<button class="hand-card${hd.ok ? "" : " off"}${hd.source === "treasure" ? " treasure" : ""}"
          ${hd.ok ? `onclick="Engine.exmapCaveStrike('${hd.id}')"` : "disabled"}
          title="${hd.ok ? (blown ? "它有备而来——这一招打出去就是硬仗" : "趁它缠斗出手——这一招就是开战第一击") : (hd.why || "")}">
          <b>${hd.name}</b><i>${rTxt}</i>${hd.ok ? "" : `<u>${hd.why}</u>`}
        </button>`;
      });
      html += `</div></div>`;
    }
    html += `<div class="exsc-actions">
      ${this._cavePlacing ? `<button class="btn btn-ghost" onclick="UI.cavePlacePick(null)">收手不放</button>` : ""}
      <button class="btn btn-ghost cave-leave" onclick="Engine.exmapCaveLeave()">退出洞窟</button>
    </div>`;
    panel.innerHTML = html;
  },

  // 热点图标（探索轴/战斗轴共用——同轴一体，开打了东西也还在那）
  _hotIcon(name) { return /主药|老株/.test(name) ? "🌿" : /灵石/.test(name) ? "💎" : "🌱"; },

  // 战斗版远端点名：锁定目标在镜头外时，画框边缘亮出名字与方向
  _fightFarCue(text, leftSide) {
    const field = this.el("axis-field");
    if (!field) return;
    let cue = field.querySelector(".fight-far-cue");
    if (!text) { if (cue) cue.hidden = true; return; }
    if (!cue) {
      cue = document.createElement("div");
      cue.className = "fight-far-cue";
      field.appendChild(cue);
    }
    cue.hidden = false;
    cue.textContent = text;
    cue.classList.toggle("left", !!leftSide);
  },

  // 放置模式：选布置物 → 点格落位
  cavePlacePick(prepId) {
    this._cavePlacing = this._cavePlacing === prepId ? null : prepId;
    this.renderExmap();
  },
  cavePlaceAt(cell) {
    const pid = this._cavePlacing;
    this._cavePlacing = null;
    if (pid) Engine.exmapCavePlace(pid, cell);
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
    // 破关凯旋：钟磬贺礼（单次播放，奏毕自动归位地点轨）
    if (typeof Sfx !== "undefined" && Sfx.bgm) Sfx.bgm("triumph");
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
