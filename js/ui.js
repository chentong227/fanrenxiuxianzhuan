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
  },

  // 手机分页：切换显示哪一栏（narrative=修行 / stats=状态 / actions=储物）
  switchMobileTab(tab) {
    const layout = document.querySelector(".layout");
    if (!layout) return;
    layout.setAttribute("data-mtab", tab);
    document.querySelectorAll(".mtab").forEach(t =>
      t.classList.toggle("active", t.dataset.tab === tab));
  },

  // 当前际遇指引 + 进行中任务（开放世界的"目标"提示）
  renderObjective() {
    const box = this.el("objective-bar");
    if (!box) return;
    const obj = Engine.currentObjective ? Engine.currentObjective() : null;
    const tasks = Engine.activeTasks ? Engine.activeTasks() : [];
    let html = "";
    if (obj) {
      html += `<div class="obj-main"><span class="obj-key">际遇</span>
        <b>${obj.title}</b><span class="obj-hint">${obj.hint}</span></div>`;
    }
    if (tasks.length) {
      html += tasks.map(t => {
        const urgent = t.left <= 2;
        return `<div class="obj-task ${urgent ? 'urgent' : ''}">
          <span class="obj-key">任务</span><b>${t.title}</b>
          <span class="obj-prog">${t.progress}</span>
          <span class="obj-left">限 ${t.left} 月</span>
        </div>`;
      }).join("");
    }
    box.innerHTML = html;
    box.style.display = html ? "" : "none";
  },

  renderLocation() {
    const loc = State.location();
    if (!loc) return;
    this.el("loc-name").textContent = loc.name;
    this.el("loc-desc").textContent = loc.desc;
    this.renderLocals(loc);
    this.renderLocMap(loc);
  },

  // 内嵌大地图：所在面板里直接展示可去之处，点击图标即前往（取代「云游他处」弹窗）
  renderLocMap(loc) {
    const box = this.el("loc-map");
    if (!box) return;
    const s = State.data;
    // 过场地点 / 待决剧情 / 战斗中：不显示地图（不可乱走）
    if (loc.scene || s.pendingEvent || s.combat) { box.innerHTML = ""; box.style.display = "none"; return; }
    const arc = Chapters.active().id;
    const cur = s.location;
    const locs = WORLD.locations.filter(l =>
      !l.scene && l.map && (!l.arc || l.arc === arc) && (!l.unlock || l.unlock(s)));
    if (locs.length <= 1) { box.innerHTML = ""; box.style.display = "none"; return; }
    box.style.display = "";

    const curLoc = WORLD.locations.find(l => l.id === cur);
    const lines = (curLoc && curLoc.map)
      ? locs.filter(l => l.id !== cur).map(l =>
          `<line x1="${curLoc.map.x}" y1="${curLoc.map.y}" x2="${l.map.x}" y2="${l.map.y}" class="map-line"/>`).join("")
      : "";
    const factor = Balance.travelTimeFactor(State.effectiveSpeed());
    const sel = this._mapSel;
    const pins = locs.map(l => {
      const here = l.id === cur;
      const cost = Math.max(1, Math.round((l.travelCost || 2) * factor));
      const home = l.home ? " home" : "";
      const seld = (sel === l.id) ? " selected" : "";
      return `<div class="map-pin${here ? ' here' : ''}${home}${seld}" style="left:${l.map.x}%;top:${l.map.y}%"
        ${here ? '' : `onclick="UI.selectMapPin('${l.id}')"`} title="${l.desc}">
        <span class="pin-dot"></span>
        <span class="pin-label">${l.name}${here ? '' : `<span class="pin-cost">${cost}月</span>`}</span>
      </div>`;
    }).join("");
    // 选中某地 → 显示确认前往条
    let confirmBar = "";
    if (sel && sel !== cur) {
      const l = WORLD.locations.find(x => x.id === sel);
      if (l) {
        const cost = Math.max(1, Math.round((l.travelCost || 2) * factor));
        confirmBar = `<div class="map-confirm">
          <div class="mc-info"><b>${l.name}</b><span>${l.desc}</span></div>
          <button class="btn btn-primary btn-mini" onclick="UI.confirmTravel()">前往（${cost} 月）</button>
        </div>`;
      }
    }
    box.innerHTML = `
      <div class="loc-map-head"><span class="map-tag">舆图</span>
        <span class="map-speed">遁速 ${State.effectiveSpeed()}　点选地点 → 确认前往</span></div>
      <div class="worldmap inline">
        <svg class="map-lines" viewBox="0 0 100 100" preserveAspectRatio="none">${lines}</svg>
        ${pins}
      </div>
      ${confirmBar}`;
  },
  // 点选地图图标：先选中（高亮 + 出确认条），不直接前往
  selectMapPin(locId) {
    this._mapSel = (this._mapSel === locId) ? null : locId;
    const loc = State.location();
    if (loc) this.renderLocMap(loc);
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
    box.innerHTML = `<div class="locals-title">在场人物</div>` + locals.map(n => {
      const met = (s.metNpcs || []).includes(n.id);
      const line = (n.lines && n.lines.length) ? n.lines[0] : "";
      return `<div class="local-npc" onclick="UI.talkLocal('${n.id}')">
        <div class="local-avatar">${met ? "🧑" : "❓"}</div>
        <div class="local-info">
          <div class="local-name">${n.name}<span class="lr">${n.role}</span></div>
          <div class="local-line">${line}</div>
        </div>
        <div class="local-talk">💬</div>
      </div>`;
    }).join("");
  },

  // 与在场人物交谈：结识 / 听其一言 / 增进交情
  talkLocal(npcId) {
    const s = State.data;
    const n = WORLD.npcById(npcId);
    if (!n) return;
    const wasNew = Engine.meetNpc(npcId);
    const line = (n.lines && n.lines.length) ? n.lines[Math.floor(Math.random() * n.lines.length)] : "";
    const rel = (typeof INTERACTIONS !== "undefined") ? INTERACTIONS.relationOf(s, npcId) : 0;
    const relTxt = rel >= 20 ? "交情深厚" : rel >= 8 ? "相熟" : rel <= -8 ? "心存芥蒂" : wasNew ? "萍水相逢" : "相识";
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
        <button class="btn btn-ghost" onclick="UI.closeModal()">告辞</button>
      </div>
    `);
    if (wasNew) { State.save(); this.renderAll(); }
  },

  // 攀谈：花点时间增进交情（轻量正反馈，主线人物也能慢慢拉近）
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
    const zone = document.querySelector(".act-zone");
    if (!loc) { box.innerHTML = ""; return; }

    // 有待决剧情时，日常行动暂时灰掉（引导玩家先做剧情选择）
    const storyPending = !!State.data.pendingEvent;
    if (zone) zone.classList.toggle("story-pending", storyPending);

    const labels = {
      cultivate: "闭关修炼", rest: "打坐调息", breakthrough: "尝试突破", bottle: "打理小瓶",
      adventure: "外出历练", gather: "采药", spar: "切磋武艺", market: "采买", alchemy: "炼药", investigate: "暗中探查",
      explore: "深入探索",
    };
    // 剧情过场地点（scene）：无日常行动，只随剧情推进
    // 各地行动由 world 数据决定，不再到处自动塞「打坐/突破」——突破/调息只在洞府(home)出现
    let acts = (loc.scene ? [] : loc.actions.slice());
    if (!loc.scene) {
      acts = acts.filter(a => a !== "bottle" || State.data.bottle.unlocked);
    }

    box.innerHTML = acts.length
      ? acts.map(a => `<button class="btn btn-action" data-action="${a}">${labels[a] || a}</button>`).join("")
      : (loc.scene ? `<div class="act-hint">— 此地仅供过场，循剧情前行 —</div>` : "");
    box.querySelectorAll("[data-action]").forEach(btn => {
      btn.addEventListener("click", () => Engine.doAction(btn.dataset.action));
    });
  },

  renderTopbar() {
    const s = State.data;
    this.el("top-name").textContent = s.name;
    this.el("top-realm").textContent = State.realm().name;
    this.el("top-age").textContent = `${s.age} 岁`;
    this.el("top-lifespan").textContent = `寿元 ${s.lifespan}`;
  },

  renderStats() {
    const s = State.data;
    const realm = State.realm();
    const root = State.root();
    this.el("st-root").textContent = root.name;
    this.el("st-root").style.color = root.color;
    this.el("st-realm").textContent = realm.name;
    this.el("st-sense").textContent = s.sense;
    this.el("st-speed").textContent = s.speed;
    this.el("st-insight").textContent = s.insight;
    this.el("st-body").textContent = s.body;
    this.el("st-stones").textContent = s.stones;
    this.el("st-time").textContent = `第 ${s.year} 年 ${s.month} 月`;

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
      return `<div class="inv-item" onclick="UI.showItem('${k}')">
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
    this.openModal(`
      <h2>${item.name}</h2>
      <p style="color:var(--ink-dim)">${rarityLabel(item.rarity)} · ${typeLabel(item.type)}　持有 ×${State.count(itemId)}</p>
      <p>${item.desc}</p>
      ${item.effect && Object.keys(item.effect).length ? `<p style="color:var(--jade-bright)">${effectText(item.effect)}</p>` : ""}
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
    const s = State.data;
    const icons = { good: "✦", bad: "⚠", event: "·", sys: "…" };
    const last = s.log.length - 1;
    box.innerHTML = s.log.map((e, i) => `
      <div class="entry ${e.kind}${i === last ? ' latest' : ''}">
        <div class="time-stamp"><span class="ek-icon">${icons[e.kind] || "·"}</span>${e.t}</div>
        <div class="body">${e.body}</div>
      </div>`).join("");
    box.scrollTop = box.scrollHeight;
  },

  /* -------- 剧情卡渲染（带选项）-------- */
  renderStory(stage) {
    const box = this.el("narrative");
    const bodyHtml = (stage.text || []).map(seg => this._renderSegment(seg)).join("");
    box.innerHTML += `
      <div class="entry story" id="story-card">
        <div class="title">${stage.title}</div>
        <div class="body">${bodyHtml}</div>
      </div>`;
    box.scrollTop = box.scrollHeight;

    const choicesBox = this.el("choices");
    // 战斗类抉择（resolve 进战斗）：在选项前显示「临战准备」一览，避免"没头没尾"
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
    choicesBox.innerHTML = prepHtml + (stage.choices || []).map((c, i) => {
      const lack = c.requireItem && !State.count(c.requireItem);
      return `<button class="choice${c.resolve ? ' choice-fight' : ''}" onclick="Engine.chooseStory(STORY[${State.data.storyStage}], ${i})">
        ${c.text}
        ${c.hint ? `<span class="c-hint">${c.hint}${lack ? '（尚缺）' : ''}</span>` : ""}
      </button>`;
    }).join("");
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
        <div class="dlg-portrait" style="--pc:${av.color}">${av.icon}</div>
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
        <div class="tech-head"><b>${t.name}</b>${tag}<span class="tech-grade">${gradeLabel(t.grade)}</span></div>
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

    // 技能槽
    const cap = L.skillCap(s), now = (s.spells || []).length;
    const pool = L.knownPool(s);
    const skillChip = (sk) => {
      const sp = SP[sk]; if (!sp) return "";
      const equipped = L.isEquipped(s, sk);
      const aux = L.isAuxSkill(s, sk);
      const cost = Object.entries(sp.cost).map(([e, n]) => `${CombatAPI.ELEM_NAME[e]}${n}`).join(" ") || "无耗";
      return `<div class="skill-chip ${equipped ? 'on' : ''}" onclick="UI._loadoutToggleSkill('${sk}')">
        <div class="sk-top"><b>${sp.name}</b>${aux ? '<span class="sk-aux">辅</span>' : ''}${equipped ? '<span class="sk-on">✓出战</span>' : ''}</div>
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

    // 准备清单（体现"靠万全准备突破"）
    const prep = [
      { label: "修为圆满", ok: s.cultivation >= realm.culMax * 0.9 },
      { label: "灵力充盈", ok: s.spirit >= realm.spMax * 0.8 },
      { label: "心境平和", ok: s.mood >= s.moodMax * 0.6 },
      { label: `心魔可控（≤${Balance.demonTrialThreshold()}）`, ok: !demonHigh },
    ];
    const trialNote = demonHigh
      ? `<p style="color:var(--gold);font-size:12px;margin-top:6px">⚠ 心魔过盛（${Math.round(s.demon)}）：冲关须先闯一场「心战」降伏心魔，否则功亏一篑。</p>`
      : `<p style="color:var(--jade-bright);font-size:12px;margin-top:6px">心魔已伏，可顺势冲关，水到渠成。</p>`;

    this.openModal(`
      <h2>突破 · ${nextRealm.name}</h2>
      <p style="color:var(--ink-dim)">同一大境界内的层次进阶——准备愈充分，胜算愈大；强行冲关，反受其害。</p>
      <div class="prep-list">
        ${prep.map(p => `<div class="prep-row"><span>${p.label}</span><span class="${p.ok ? 'ok' : 'no'}">${p.ok ? '✓ 就绪' : '✗ 不足'}</span></div>`).join("")}
      </div>
      <div class="rate-display ${cls}">${pct}%</div>
      <div class="rate-label">${demonHigh ? '心战前·基准成功率' : '顺势冲关成功率'}</div>
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
    this.openModal(`
      <h2>风云录</h2>
      <p style="color:var(--ink-dim);font-size:12px">你离开了，世界并不会停。世间修士各有命数——或精进，或求丹闯秘境，或寿尽身死。</p>
      <h3 class="panel-title" style="margin-top:8px">世间众生</h3>
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
      return `<div class="codex-card tappable">
        <div class="codex-head"><b>${n.name}</b><span class="codex-role">${n.role}</span></div>
        <div class="codex-bio">${n.bio}</div>
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

  /* -------- 云游（可视化大地图，点击图标前往）-------- */
  openTravel() {
    const cur = State.data.location;
    const arc = Chapters.active().id;
    const locs = WORLD.locations.filter(l =>
      !l.scene && l.map && (!l.arc || l.arc === arc) && (!l.unlock || l.unlock(State.data)));

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
      <div class="modal-actions"><button class="btn btn-ghost" onclick="UI.closeModal()">不去了</button></div>
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

  /* -------- 集镇采买 -------- */
  openMarket() {
    const shop = [
      { id: "lingcao", price: 3 }, { id: "duyao_cao", price: 6 },
      { id: "qingyuan_dan", price: 8 }, { id: "huixue_dan", price: 6 }, { id: "ningshen_dan", price: 14 },
    ];
    const html = shop.map(it => {
      const item = DATA.items[it.id];
      return `<div class="market-item">
        <span><span class="iname ${item.rarity==='rare'?'rare':item.rarity==='epic'?'epic':''}">${item.name}</span>
          <span style="color:var(--ink-dim);font-size:12px">　${item.desc}</span></span>
        <button class="btn btn-mini" onclick="Engine.buy('${it.id}')"><span class="mprice">${it.price}两</span></button>
      </div>`;
    }).join("");
    this.openModal(`
      <h2>山下集镇 · 采买</h2>
      <p style="color:var(--ink-dim)">纹银：${State.data.silver} 两</p>
      ${html}
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
    const endBtn = this.el("combat-endround");
    endBtn.onclick = () => Engine.combatEndRound();
    this._combatTarget = combat.enemies.findIndex(e => e.alive);
    this._combatLogLen = 0;
    this.renderCombat(combat, meta);
    this._flashCombatBanner(meta, combat);
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

  // 施法时的轻微震动反馈
  flashCombat() {
    const box = this.el("combat-enemies");
    if (!box) return;
    const t = box.querySelector(".combatant.target") || box.querySelector(".combatant");
    if (t) { t.classList.remove("shake"); void t.offsetWidth; t.classList.add("shake"); }
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

    this.el("combat-enemies").innerHTML = c.enemies.map((e, i) => {
      const tags = [];
      if (e.immunePoison) tags.push("百毒不侵");
      if (e.soulOnly) tags.push("神魂之体");
      const statusTxt = e.status.poison ? `<span class="cstatus">中毒 ${e.status.poison.dmg}/回合·余${e.status.poison.turns}</span>` : "";
      const intentTxt = (i === target && adv.seeIntent && e.intent && e.alive)
        ? `<div class="cintent">⚡ 神识料敌：${this._intentHint(e.intent)}</div>` : "";
      const hpPct = Math.max(0, e.hp / e.hpMax * 100);
      const shieldPct = e.shield ? Math.min(100, e.shield / e.hpMax * 100) : 0;
      return `<div class="combatant enemy ${e.alive ? '' : 'dead'} ${i === target ? 'target' : ''}" ${e.alive && multi ? `onclick="UI.pickTarget(${i})"` : ''}>
        <div class="cname"><b>${e.name}</b><span class="ctag">${tags.join(' ')}</span></div>
        <div class="cbar">
          <div class="cbar-fill" style="width:${hpPct}%"></div>
          ${shieldPct ? `<div class="cbar-fill shield" style="width:${shieldPct}%"></div>` : ''}
        </div>
        <div class="cbar-num">气血 ${Math.max(0, Math.round(e.hp))}/${e.hpMax}${e.shield ? `　<span style="color:var(--blue)">护体${e.shield}</span>` : ''}</div>
        ${statusTxt}
        ${intentTxt}
        ${i === target && e.alive ? '<div class="target-tag">◈ 锁定</div>' : ''}
      </div>`;
    }).join("");

    // 玩家
    const p = c.player;
    const isBT = meta.type === 'breakthrough';
    const hpPct = Math.max(0, p.hp / p.hpMax * 100);
    const shieldPct = p.shield ? Math.min(100, p.shield / p.hpMax * 100) : 0;
    this.el("combat-player").innerHTML = `<div class="combatant self">
      <div class="cname"><b>${p.name}</b><span class="ctag">${isBT ? '道心' : `神识${p.sense}·遁速${p.speed}`}</span></div>
      <div class="cbar">
        <div class="cbar-fill self" style="width:${hpPct}%"></div>
        ${shieldPct ? `<div class="cbar-fill shield" style="width:${shieldPct}%"></div>` : ''}
      </div>
      <div class="cbar-num">${isBT ? '道心' : '气血'} ${Math.max(0, Math.round(p.hp))}/${p.hpMax}${p.shield ? `　<span style="color:var(--blue)">护体${p.shield}</span>` : ''}</div>
      ${p.status.poison ? `<span class="cstatus">中毒 ${p.status.poison.dmg}/回合</span>` : ''}
    </div>`;

    // 灵气池
    this.el("combat-qi").innerHTML =
      `<span class="qi-label">五行灵气</span>` +
      CombatAPI.ELEMENTS.map(e =>
        `<div class="qi-chip ${e} ${c.qi[e] > 0 ? '' : 'zero'}">${EL[e]}<b>${c.qi[e]}</b></div>`
      ).join("") +
      (p.momentum ? `<div class="qi-chip momentum">剑势<b>${p.momentum}</b></div>` : "");

    // 法术 / 招式
    this.el("combat-spells").innerHTML = p.spells.map(id => {
      const sp = SP[id];
      const cost = Object.entries(sp.cost).map(([e, n]) => `${EL[e]}${n}`).join(" ") || "无耗";
      const afford = c.canAfford(id);
      const noPouch = sp.consume && !(p.pouch[sp.consume] > 0);
      const pouchTxt = sp.consume ? `<span class="spouch ${noPouch ? 'empty' : ''}">底牌×${p.pouch[sp.consume] || 0}</span>` : "";
      return `<button class="spell-btn ${afford ? '' : 'off'}" ${afford ? '' : 'disabled'} onclick="Engine.combatCast('${id}', ${target})" title="${sp.desc || ''}">
        <span class="sname">${sp.name}</span>
        <span class="scost"><span class="qcost">${cost}</span> ${spellEffectText(sp)}${pouchTxt}</span>
      </button>`;
    }).join("");

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
          if (c.content && CO[c.content]) inner = `<span class="ex-icon">${CO[c.content].icon}</span>`;
          if (TE[c.terrain].blocked) inner = `<span class="ex-icon dim">${c.terrain === "water" ? "💧" : "⛰"}</span>`;
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

  /* -------- 通用弹窗 / Toast -------- */
  openModal(html) {
    this.el("modal").innerHTML = html;
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
