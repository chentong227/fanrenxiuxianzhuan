/* ============================================================
 * ui.js — 渲染与界面交互
 * ============================================================ */

const UI = {
  el(id) { return document.getElementById(id); },
  // 是否手机视口（地图主界面化的布局分流以此为准）
  _isMobile() { return window.matchMedia && window.matchMedia("(max-width: 760px)").matches; },

  /* -------- 全量渲染 -------- */
  renderAll() {
    this.renderStats();
    this.renderInventory();
    this.renderTopbar();
    this.renderLocation();
    this.renderActions();
    this.renderObjective();
    this.renderRecentLog();
    if (this._mapZoom !== 5 && !this.el("worldmap-canvas").hidden) this._updateAvatarPin();
    const dock = this.el("action-dock");
    if (dock && dock.classList.contains("show")) this._renderDockActions();
    // 手机端·据点态：行动 sheet 是常态入口，剧情/战斗/秘境时收起
    if (this._isMobile() && this._mapZoom === 5) {
      const s = State.data;
      const busy = !!(s.combat || s.pendingEvent || s.exmap);
      if (dock && !busy && !dock.classList.contains("show")
          && document.getElementById("screen-game").classList.contains("active")) {
        this._showActionDock(true);
      } else if (dock && busy && dock.classList.contains("show")) {
        this._showActionDock(false);
      }
    }
  },

  // L3: 点击 ripple 光圈
  _rippleInited: false,
  initRipple() {
    if (this._rippleInited) return;
    this._rippleInited = true;
    document.addEventListener("click", e => {
      const btn = e.target.closest(".btn-action, .btn-secondary, .btn-primary, .choice, .scene-hotspot");
      if (!btn) return;
      const r = document.createElement("span");
      r.className = "ripple";
      const rect = btn.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      r.style.width = r.style.height = size + "px";
      r.style.left = (e.clientX - rect.left - size / 2) + "px";
      r.style.top = (e.clientY - rect.top - size / 2) + "px";
      btn.appendChild(r);
      setTimeout(() => r.remove(), 500);
    });
  },

  // L3: 行动过程叠层动画
  _playActionOverlay(type) {
    const stage = this.el("scene-stage");
    if (!stage) return;
    const ov = document.createElement("div");
    ov.className = "action-overlay " + type;
    stage.appendChild(ov);
    setTimeout(() => ov.remove(), 1000);
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
    const lv = u.enhLv || 0;
    const st = broken ? `<span style="color:var(--red)">损毁</span>`
      : `${u.hp}/${u.hpMax}${u.carry === false ? "（留守）" : "（随行）"}`;
    const lvTag = lv ? `<span class="ss-lv">Lv.${lv}</span>` : "";
    const btn = broken || u.hp < u.hpMax
      ? `<button class="btn btn-mini" onclick="event.stopPropagation();UI.openSideUnit()">修缮 ›</button>`
      : `<button class="btn btn-mini" onclick="event.stopPropagation();UI.openSideUnit()">驭物 ›</button>`;
    return `<div class="side-strip" onclick="event.stopPropagation();UI.openSideUnit()"><span class="ss-name">⚰ ${u.name}</span>${lvTag}<span class="ss-st">${st}</span>${btn}</div>`;
  },

  // 手机分页：切换显示哪一栏（stage=界面 / hero=韩立+储物）
  switchMobileTab(tab) {
    const layout = document.querySelector(".layout");
    const sg = document.getElementById("screen-game");
    document.querySelectorAll(".mtab").forEach(t =>
      t.classList.toggle("active", t.dataset.tab === tab));

    if (tab === "map") {
      // 舆图：进地图主界面（默认胥国 Z3）
      if (this._mapZoom === 5) {
        this._prevZoom = 5; this._mapZoom = 3; this._mapFocusNode = null;
        this._showWorldmap(true); this.renderWorldmap();
      }
      if (sg) sg.setAttribute("data-mtab", "map");
      if (layout) layout.setAttribute("data-mtab", "map");
      return;
    }

    // 行动 / 韩立：回到据点（Z5 场景），地图淡出
    if (this._mapZoom !== 5) {
      this._mapZoom = 5;
      this._showWorldmap(false, tab !== "act");  // 行动页弹出 dock，韩立页不弹
      this.renderLocation();
    } else if (tab === "act") {
      // 已在据点：确保行动 sheet 弹出
      this._showActionDock(true);
    } else {
      this._showActionDock(false);
    }

    if (layout) layout.setAttribute("data-mtab", tab);
    if (sg) sg.setAttribute("data-mtab", tab);
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
      const left = sx.flags.xueshi_due - State.absMonth();
      const ready = sx.realmIndex >= 10;
      // polish E：修为为凭不必等足月——练气十一层一到，名额会随时开（日历只是风声，不是门槛）
      const season = ready ? "修为为凭·不必等足月" : left > 0 ? `大比时节约余 ${left} 月` : "大比时节已至";
      fate += `<div class="obj-task" style="border-left-color:var(--cinnabar)">
        <span class="obj-key" style="background:var(--cinnabar);color:#f3e4d8">血禁</span>
        <b>血色禁地 · 大比时节</b>
        <span class="obj-left">${season}</span>
        <span class="obj-hint">${ready
          ? (left > 0
            ? "修为已够（练气十一层）——只等大比时节开锣。趁这几月去万宝楼坊市备货走一趟（顺道听廊下向之礼一席话）。"
            : "修为已够（练气十一层）、大比时节已至——先去万宝楼坊市备货走一趟（顺道听向之礼一席话），名额之会便在山门大殿见分晓。")
          : "入选两事：① 修为到练气十一层（修炼／长春功后篇是正路）　② 等大比时节开锣（见倒计时）。两事齐备大会才开——备货、听向之礼指点门道，都不白走。"}</span>
      </div>`;
    }
    // 七玄门·夺舍决战备战：张铁之死→决战前三选一（互斥，与 jindi_prep 同范式）
    if (sx && sx.flags && sx.flags.zhangtie_dead && !sx.flags.modafu_dead) {
      if (!sx.flags.showdown_ready) {
        fate += `<div class="obj-task urgent" style="border-left-color:var(--cinnabar)">
          <span class="obj-key" style="background:var(--cinnabar);color:#f3e4d8">备战</span>
          <b>夺舍决战 · 三选一</b>
          <span class="obj-hint">以毒为先、以武为先、或速战速决——<b>互斥</b>，选了即定今夜路数。留意眼前剧情抉择。</span>
        </div>`;
      } else {
        const path = sx.flags.showdown_prep_poison ? "以毒为先（毒草暗器）"
          : sx.flags.showdown_martial_focus ? "以武为先（眨眼剑法）"
          : sx.flags.showdown_prep_swift ? "速战速决（抢先机）" : "已备战";
        fate += `<div class="obj-task" style="border-left-color:var(--jade)">
          <span class="obj-key" style="background:var(--jade);color:#08140f">备战</span>
          <b>夺舍之夜将至</b>
          <span class="obj-prog">${path}</span>
          <span class="obj-hint">回「墨大夫药庐」了结此局——备得越足，胜算越大。</span>
        </div>`;
      }
    }
    // 禁地临行三月·互斥备战：待决或已选路径，天命栏明示（M3 经营可视化）
    if (sx && sx.flags && sx.flags.xueshi_opened && !sx.flags.jindi_entered) {
      if (!sx.flags.jindi_prep_done) {
        fate += `<div class="obj-task urgent" style="border-left-color:var(--cinnabar)">
          <span class="obj-key" style="background:var(--cinnabar);color:#f3e4d8">备战</span>
          <b>临行三月 · 血色禁地</b>
          <span class="obj-hint">血幕未开，尚余三月——闭关冲修为、坊市备底牌、丹房精炼，<b>三者只能择一</b>。留意眼前剧情抉择。</span>
        </div>`;
      } else {
        const path = sx.flags.jindi_prep_cultivate ? "闭关冲修为"
          : sx.flags.jindi_prep_stock ? "坊市囤底牌（符箓暗器）"
          : sx.flags.jindi_prep_alchemy ? "丹房精炼（药理+回元丹）" : "已备战";
        fate += `<div class="obj-task" style="border-left-color:var(--jade)">
          <span class="obj-key" style="background:var(--jade);color:#08140f">备战</span>
          <b>临行抉择已定</b>
          <span class="obj-prog">${path}</span>
          <span class="obj-hint">互斥窗口已关——另两条路禁地里须用更贵的代价补救。</span>
        </div>`;
      }
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
    // 异闻妖王：听闻→寻踪→相遇（明牌线索进度=逼近真相的代入感）
    const sb = State.data;
    if (sb && sb.beastRumor && typeof WORLD !== "undefined" && WORLD.enemies[sb.beastRumor]) {
      const r = WORLD.beastRumors ? WORLD.beastRumors.find(x => x.id === sb.beastRumor) : null;
      const total = (r && r.clues) ? r.clues.length : 0;
      const clueN = Math.min(sb.beastRumorClue || 0, total);
      const phase = clueN <= 0
        ? "风声初起——留意后山的动静"
        : clueN < total
          ? "踪迹渐明——深入后山探索，或可寻得"
          : "踪迹了然——深入后山深处，可与之一战";
      luck += `<div class="obj-task urgent" style="border-left-color:var(--cinnabar)">
        <span class="obj-key" style="background:var(--cinnabar);color:#f3e4d8">异闻</span>
        <b>${WORLD.enemies[sb.beastRumor].name}</b>
        ${total ? `<span class="obj-prog">线索 ${clueN}/${total}</span>` : ""}
        <span class="obj-hint">${phase}　伏诛有厚报</span>
      </div>`;
    }
    // 材料传闻：听闻→寻踪→探索采得（与异闻妖王同构的"风声→行动"链）
    if (sb && sb.materialRumor && typeof WORLD !== "undefined" && WORLD.materialRumors) {
      const mr = WORLD.materialRumors.find(x => x.id === sb.materialRumor);
      if (mr) {
        const total = (mr.clues) ? mr.clues.length : 0;
        const clueN = Math.min(sb.materialRumorClue || 0, total);
        const phase = clueN <= 0
          ? "风声初起——留意此物所在"
          : clueN < total
            ? "踪迹渐明——循线索前往探索"
            : "踪迹了然——前往对应探索点采得";
        const siteName = (DATA.exploreSites[mr.site] || {}).name || mr.site;
        luck += `<div class="obj-task" style="border-left-color:var(--jade)">
          <span class="obj-key" style="background:var(--jade);color:#08140f">传闻</span>
          <b>${mr.title}</b>
          ${total ? `<span class="obj-prog">线索 ${clueN}/${total}</span>` : ""}
          <span class="obj-hint">${phase}　指向「${siteName}」</span>
        </div>`;
      }
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
    // 主修功法层进度：明牌"还能升几层"——肝条范式（嗑瓜子轴），可去闭关「参研功法层」逐层精进
    const tli = sd ? State.mainTechLayerInfo(sd) : null;
    if (tli && tli.max > 1) {
      const stage = State.realmStage(sd);
      const can = (typeof Engine !== "undefined") ? Engine.canRefineLayer(sd.technique) : { ok: false };
      const atTop = tli.layer >= tli.max;
      const hint = atTop ? "已臻此版顶层" : (can.ok ? `可回洞府闭关「参研功法层」精进（约${can.months}月）` : (can.reason || "尚不可精进"));
      luck += `<div class="obj-task">
        <span class="obj-key" style="background:#2fae9b;color:#0c1a16">功法</span>
        <b>${tli.name}${stage ? ` · ${stage.name}` : ""}</b>
        <span class="obj-prog">${tli.layer}/${tli.max} 层</span>
        <span class="obj-hint">${hint}</span>
      </div>`;
    }
    // 涟漪窗口：限时机会（错过即逝——世界不等人）
    if (sd && sd.rippleWindow) {
      const rw = sd.rippleWindow;
      const left = Math.max(0, rw.dueAbs - State.absMonth());
      const whereTxt = rw.id === "herb_garden" ? "后山" : rw.id === "wolf_bounty" ? "集镇" : rw.id === "cheap_pills" ? "集镇采买" : rw.id === "lingcao_boom" ? "坊市" : rw.id === "wanbao_sale" ? "坊市·万宝楼" : rw.id === "jindi_gossip" ? "坊市茶棚" : "";
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
    // 手机端：把天命栏实际高度写成 CSS 变量——场景题字动态让位，不再被压边（审美审计 jank#10）
    requestAnimationFrame(() => {
      const sg = this.el("screen-game");
      if (sg) sg.style.setProperty("--obj-h", (html ? box.offsetHeight : 0) + "px");
    });
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

  // 战斗 → BGM 轨：危险/紧张度分级 × 场景调色。越级(≥2层)/妖王/决战 → boss 压迫轨；
  // 心魔 → tense 阴冷；其余「普通斗法」按场景换轨（与该场景环境乐配套，不同地方打架听感不同——不腻）。
  _combatBgm(meta, combat) {
    const myLayer = (State.realm() || {}).layer || 1;
    const overTier = combat.enemies.some(e => e.alive && (e.qiLayer || 0) - myLayer >= 2);
    if (meta.type === "showdown" || meta.type === "jinguang" || meta.namedBeast || overTier) return "boss";
    if (meta.type === "breakthrough") return "tense";
    const s = State.data;
    // 秘境/险境（探索非和平区）：诡谲凶险
    if (s && s.exmap && typeof ExploreMap !== "undefined") {
      try { if (!ExploreMap.mapOf(ExploreMap.cur(s.exmap)).peaceful) return "combat_secret"; } catch (e) {}
    }
    const loc = State.location();
    if (loc && loc.id === "miju") return "combat_secret";
    if (s && s.journey) return "combat_wild";   // 路上/云游遭遇：野外
    return "combat";   // 演武/据点/默认
  },

  renderLocation() {
    const loc = State.location();
    if (!loc) return;
    const nm = this.el("loc-name"); if (nm) nm.textContent = loc.name;
    const ds = this.el("loc-desc-inline");
    if (ds) {
      let desc = loc.desc;
      // 复访变迁：地点描述随剧情 flag 改写（风味取自据点风味库 ExploreMap.MAPS）
      if (loc.flavorRef && typeof ExploreMap !== "undefined") {
        const fmap = ExploreMap.MAPS[loc.flavorRef.map];
        const node = fmap && fmap.nodes[loc.flavorRef.node];
        const fl = node && ExploreMap.flavor(node, State.data.flags);
        if (fl && fl.desc) desc = fl.desc;
      }
      ds.textContent = desc;
    }
    this.renderSceneStage(loc);
    this.renderLocals(loc);
    // 战斗/剧情演出中不抢轨（由各自的演出管理）
    const inStory = !!(this._story && !this.el("story-overlay").hidden);
    if (typeof Sfx !== "undefined" && Sfx.bgm && !State.data.combat && !inStory) {
      Sfx.bgm(this._bgmForLocation(loc));
      // 地点级环境床（昼夜·天气骨架）：夜→夜虫 / 雨→檐滴，领奏并压低 BGM；无床则收束、照常奏乐
      const amb = (typeof Env !== "undefined") ? Env.ambientFor(loc) : null;
      if (amb && Sfx.ambient) Sfx.ambient(amb);
      else if (Sfx.ambientStop) Sfx.ambientStop();
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

    // 昼夜·天气骨架 + 2.5D 纵深（前景分层）：把时辰/天气/纵深写到舞台
    //  （驱动 CSS 染色 tint + 氛围粒子 + 远景气层/前景框层差速漂移）
    if (typeof Env !== "undefined") {
      const stg = this.el("scene-stage");
      if (stg) {
        Env.apply(stg, loc);
        // 喂底图给远景层（程序化前景框不依赖切图，远雾按地点 far 强度调浓淡）
        stg.style.setProperty("--scene-img", url ? `url("${url}")` : "none");
        const d = Env.depthFor ? Env.depthFor(loc) : null;
        stg.style.setProperty("--scene-far", (d && d.far != null) ? String(d.far) : "0.5");
      }
    }

    // 过场地点 / 待决剧情 / 战斗：不显示前往按钮（不能乱走）
    if (loc.scene || s.pendingEvent || s.combat) {
      pinsBox.innerHTML = ""; if (confirmBox) confirmBox.innerHTML = "";
      this._renderHotspots(loc);   // 清除残留热点（_renderHotspots 内部会判断 scene/combat 并清空）
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

    // L2: 场景热点（试点地点）
    this._renderHotspots(loc);
  },

  // L2: 在场景图上叠加可点击热点（独立层，不与 pins 混）
  //   两类：action 热点（点=执行行动，doAction）；look 地标（点=看一眼，零耗时氛围交互·世界会回应你）
  _renderHotspots(loc) {
    const s = State.data;
    const layer = this.el("scene-hotspots");
    if (!layer) return;
    if (loc.scene || s.pendingEvent || s.combat) { layer.innerHTML = ""; return; }
    let html = "";
    if (loc.hotspots) {
      html += loc.hotspots.filter(h => !h.cond || h.cond(s)).map(h =>
        `<button class="scene-hotspot" style="left:${h.x}%;top:${h.y}%" onclick="Engine.doAction('${h.action}')" title="${h.label}">
          <span class="sh-icon">${h.icon}</span><span class="sh-label">${h.label}</span>
        </button>`).join("");
    }
    // L2 场景可交互化：氛围地标（点场景里的物件——药柜/告示/梁燕/寒烟草…有反应，不耗月）
    if (loc.landmarks) {
      html += loc.landmarks.filter(h => !h.cond || h.cond(s)).map(h =>
        `<button class="scene-hotspot scene-look" style="left:${h.x}%;top:${h.y}%" onclick="Engine.lookLandmark('${h.id}')" title="${h.label}">
          <span class="sh-icon">${h.icon}</span><span class="sh-label">${h.label}</span>
        </button>`).join("");
    }
    layer.innerHTML = html;
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
      const met = (typeof Engine !== "undefined" && Engine.isNpcKnown)
        ? Engine.isNpcKnown(n.id) : (s.metNpcs || []).includes(n.id);
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
    // 据点人数驱动立绘缩放（手机端按人数自适应，挤而不溢、不压地名）
    box.style.setProperty("--ln-n", locals.length);
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
    const I = (typeof INTERACTIONS !== "undefined") ? INTERACTIONS : null;
    const rel = I ? I.relationOf(s, npcId) : 0;
    const onCd = I ? I.onCooldown(s, npcId) : false;
    const severed = rel <= -24;           // 割席：恩断义绝，不再以礼相待
    const hostile = rel <= -8;
    const relTxt = severed ? "恩断义绝" : rel >= 20 ? "交情深厚" : rel >= 8 ? "相熟" : hostile ? "心存芥蒂" : "相识";
    const heart = rel >= 8 ? "♥" : hostile ? "✖" : "·";
    const url = (typeof Art !== "undefined") ? Art.url(npcId) : null;
    const portrait = url ? `<img src="${url}" alt="${n.name}" />` : `<span class="nw-emoji">${(s.metNpcs||[]).includes(npcId) ? "🧑" : "❓"}</span>`;

    // cd:true 的动作受「月度拜会」节律约束（每人每月一次实质交往）；lock 为关系状态封禁。
    // 善意侧（左，绿）
    const good = [
      { k: "talk",  label: "交谈", icon: "💬" },
      { k: "ask",   label: "请教", icon: "📖" },
      { k: "spar",  label: "切磋", icon: "⚔", cd: true, lock: severed ? "已割席" : hostile ? "心存芥蒂" : "" },
      { k: "gift",  label: "赠礼", icon: "🎁", cd: true, lock: severed ? "已割席" : "" },
    ];
    // 敌对侧（右，红）
    const bad = [
      { k: "probe",  label: "探查", icon: "🔍", cd: true },
      { k: "threat", label: "威胁", icon: "💢", cd: true },
    ];
    const btn = (a, side) => {
      const why = a.lock || (a.cd && onCd ? "本月已叙" : "");
      const blocked = !!why;
      return `<button class="nw-act ${side}${blocked ? ' disabled' : ''}" onclick="${blocked ? `UI.toast('${why}')` : `UI.npcWheelAct('${npcId}','${a.k}')`}">
        <span class="nw-ic">${a.icon}</span><span class="nw-lb">${a.label}${why ? `<i class="nw-cd">${why}</i>` : ''}</span>
      </button>`;
    };
    this.openSheet(`
      <div class="npc-wheel">
        <div class="nw-side left">${good.map(a=>btn(a,"good")).join("")}</div>
        <div class="nw-center">
          <div class="nw-portrait">${portrait}</div>
          <div class="nw-name">${n.name}</div>
          <div class="nw-role">${n.role}</div>
          <div class="nw-rel ${rel>=8?'good':hostile?'bad':''}">${heart} ${relTxt}（${rel>=0?'+':''}${rel}）</div>
          <div class="nw-rel" style="color:var(--gold)">称你：${this.honorific()}</div>
          ${onCd ? `<div class="nw-rel" style="color:var(--ink-faint)">本月已叙——下月再访</div>` : ''}
        </div>
        <div class="nw-side right">${bad.map(a=>btn(a,"bad")).join("")}</div>
      </div>
      <div class="modal-actions"><button class="btn btn-ghost" onclick="UI.closeSheet()">离开</button></div>
    `);
  },

  // 轮盘动作分发
  npcWheelAct(npcId, kind) {
    const s = State.data;
    const I = (typeof INTERACTIONS !== "undefined") ? INTERACTIONS : null;
    const n = WORLD.npcById(npcId);
    const nm = n ? n.name : "";
    const rel = I ? I.relationOf(s, npcId) : 0;

    // 交谈/请教：纯内容路径，不计入拜会节律
    if (kind === "talk") {
      if (typeof LLM !== "undefined" && LLM.enabled()) { this.openLiveTalk(npcId); return; }
      this._openTopics(npcId); return;
    }
    if (kind === "ask") { this._openTopics(npcId); return; }

    // 切磋/赠礼/探查/威胁：每人每月一次实质交往（机制咬合：社交并入「回合=月份」）
    if (I && I.onCooldown(s, npcId)) { this.toast("本月已与其叙过，来日再访"); return; }

    if (kind === "gift") {
      if (rel <= -24) { this.toast(`「${nm}」已与你割席，不受你的礼`); return; }
      this._npcGift(npcId); return;
    }
    if (kind === "spar") {
      if (s.pendingEvent || s.combat) { this.toast("先处理眼前之事"); return; }
      if (rel <= -8) { this.toast(`「${nm}」对你心存芥蒂，不愿与你切磋`); return; }
      if (I) { I.markInteract(s, npcId); I.favor(s, npcId, I.favorGain(s, npcId, 4)); }
      s.body += 1; s.mood = clamp(s.mood + 3, 0, s.moodMax);
      // 与剑道链咬合：未大成前，切磋磨砺剑意（呼应演武厅 spar）
      let extra = "";
      if (!s.swordMastery && s.spells && s.spells.includes("zhayan")) {
        s.swordIntent = clamp((s.swordIntent || 0) + 2, 0, 100);
        extra = "，剑意亦有所进";
      }
      Engine.passTime(1);
      Engine.log(`你与「${nm}」切磋了一场，点到即止，体魄+1，交情见长${extra}。`, "good");
      Engine.flushNpcGifts();
      this.closeSheet(); Engine.checkLifespan(); State.save(); this.renderAll();
      return;
    }
    if (kind === "probe") {
      if (I) { I.markInteract(s, npcId); I.favor(s, npcId, -1); }
      Engine.log(`你暗中打量「${nm}」，揣摩其底细。${n?n.bio:''}`, "sys");
      this.closeSheet(); State.save(); this.renderAll();
      return;
    }
    if (kind === "threat") {
      if (I) { I.markInteract(s, npcId); I.favor(s, npcId, -8); }
      s.demon = clamp(s.demon + 3, 0, 100);
      // 威胁的实益：以势压人，逼出其底细（与情报面纱/料敌系统咬合）——代价是恶名与仇怨。
      const info = (typeof WORLD !== "undefined" && WORLD.intel) ? WORLD.intel[npcId] : null;
      let gained = "";
      if (info && info.l2) {
        s.intel = s.intel || {};
        if ((s.intel[npcId] || 0) < 2) { s.intel[npcId] = 2; gained = `　你以威势相逼，逼出了几分底细：${info.l2}（交手时你将料敌于先）`; }
      }
      const nowRel = I ? I.relationOf(s, npcId) : rel - 8;
      const sever = nowRel <= -24 ? `　${nm}自此与你恩断义绝，再不愿以礼相待。` : "";
      Engine.log(`你出言恐吓「${nm}」，对方面色一变，记恨在心。修仙人的恶名，就是这么攒下的。${gained}${sever}`, "bad");
      this.toast(gained ? "威逼之下，套出了底细" : "恶名又添一笔");
      this.closeSheet(); State.save(); this.renderAll();
      return;
    }
  },

  // 赠礼：从背包挑一件相赠，换交情
  _npcGift(npcId) {
    const s = State.data;
    const inv = Object.keys(s.inventory).filter(k => s.inventory[k] > 0 && !(DATA.items[k] && DATA.items[k].bound));
    if (!inv.length) { this.toast("储物袋空空，无礼可赠", true); return; }
    const n = WORLD.npcById(npcId);
    const rows = inv.map(k => {
      const it = DATA.items[k];
      return `<button class="choice" onclick="UI._giveGift('${npcId}','${k}')">${it?it.name:k} ×${s.inventory[k]}</button>`;
    }).join("");
    this.openSheet(`
      <h2>赠礼予${n?n.name:''}</h2>
      <p style="color:var(--ink-dim);font-size:13px">投其所好，礼下于人——交情自然渐厚。</p>
      <div class="choices" style="margin-top:12px">${rows}</div>
      <div class="modal-actions"><button class="btn btn-ghost" onclick="UI.openNpcWheel('${npcId}')">返回</button></div>
    `);
  },
  _giveGift(npcId, itemId) {
    const s = State.data;
    if (State.count(itemId) < 1) { this.toast("没有此物", true); return; }
    const I = (typeof INTERACTIONS !== "undefined") ? INTERACTIONS : null;
    if (I && I.onCooldown(s, npcId)) { this.toast("本月已与其叙过，来日再访"); return; }
    State.take(itemId, 1);
    const it = DATA.items[itemId];
    // 稀有度越高交情越多；交情越深，单礼增益递减（favorGain）——投其所好胜过堆砌。
    const base = it && it.rarity === "epic" ? 14 : it && it.rarity === "rare" ? 9 : 5;
    const gain = I ? I.favorGain(s, npcId, base) : base;
    if (I) { I.markInteract(s, npcId); I.favor(s, npcId, gain); }
    const n = WORLD.npcById(npcId);
    Engine.log(`你将「${it?it.name:itemId}」赠予${n?n.name:''}，对方欣然收下，交情+${gain}。`, "good");
    Engine.flushNpcGifts();
    this.closeSheet(); State.save(); this.renderAll();
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
    this.openSheet(`
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
    this.closeSheet();
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
    this.openSheet(`
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
    if (s.pendingEvent || s.combat) { this.closeSheet(); return; }
    Engine.passTime(1);
    if (typeof INTERACTIONS !== "undefined") INTERACTIONS.favor(s, npcId, 3);
    s.mood = clamp(s.mood + 3, 0, s.moodMax);
    const n = WORLD.npcById(npcId);
    Engine.log(`你与「${n ? n.name : npcId}」攀谈了一番，叙了些闲话，交情更近了几分。`, "event");
    this.closeSheet();
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
      cultivate: "闭关修炼", rest: "打坐调息", breakthrough: "尝试突破",
      bottle: (State.data.bottle && (State.data.bottle.plots || []).some(p => p.crop && p.growth >= 100)) ? "打理小瓶 ✦熟" : "打理小瓶",
      adventure: "外出历练", gather: "采药", spar: "切磋武艺", market: "采买", alchemy: "炼药", investigate: "暗中探查",
      explore: "深入探索", wujian: "闭关悟剑 ⚔", fair: "赶集（小会）", yaoyuan: "药园差事",
      liandan: "地火炼丹 🔥", board: "细读告示", rumor: "探听风声", hunt: "外海猎妖 🌊",
      xingyi: "坐堂行医", daigong: "百艺坊 · 补炼缺件 🔨", qingtuo: "坊市告示 · 请托 📜",
      lianfu: "闭关制符 ✎", xunluo: "随队巡逻 · 军功 ⚔", xiuzhen: "修补阵纹 ⚙",
    };
    // 剧情过场地点（scene）：无日常行动，只随剧情推进
    // 各地行动由 world 数据决定，不再到处自动塞「打坐/突破」——突破/调息只在洞府(home)出现
    let acts = (loc.scene ? [] : loc.actions.slice());
    if (!loc.scene) {
      acts = acts.filter(a => a !== "bottle" || State.data.bottle.unlocked);
      // polish-modao A1②：前线巡逻只在征军期挂牌（入京大军移驻京畿，营防巡逻自止）
      acts = acts.filter(a => a !== "xunluo" || (State.data.flags.modao_conscripted && !State.data.flags.modao_e3_rujing_done));
      // polish A2：坐堂行医（药庐蟰伏期专属月行动）——接下墨大夫身份者可重复坐堂
      if (loc.id === "yaolu" && State.data.flags.identity_practice_medicine && !State.data.flags.arc1_complete) acts.push("xingyi");
      // 剑意圆满：洞府出现「悟剑」（大件链攻坚入口）
      if (loc.home && (State.data.swordIntent || 0) >= 100 && !State.data.swordMastery) acts.unshift("wujian");
      // 血色主药在手：地火之屋炼筑基丹（筑基丹链的"造"环节）
      // polish-huangfeng B1④：解绑 mojiao_resolved——主药凑足四株即可开炉（散点采药线同样能活）
      if (loc.home && loc.id === "huangfeng_gate"
        && State.count("xueshi_zhuyao") >= 4 && !State.data.flags.zhuji_lian_done) acts.unshift("liandan");
      // polish-huangfeng C6：代工缺料未结案——再访百艺坊可补炼缺件
      if (loc.id === "yuanwu" && State.data.flags.daigong_partial && !State.data.flags.daigong_done) acts.unshift("daigong");
      // polish-modao B①（GPT P0-3·跨章 bug）：制符台入口——持制符笔+已参符谱者洞府可开炉
      // （lianfu 管线俱全但全库无一处注入=阵法 Build 生产回路断裂·build.bal 在测空气）
      if (loc.home && Engine.hasFuluTable && Engine.hasFuluTable()
        && (State.data.fuluPlans || []).length) acts.push("lianfu");
    }

    // 有热点时不再渲染常规行动按钮（热点替代了它们），但保留限时窗口按钮
    const hasHotspots = loc.hotspots && !loc.scene;
    if (hasHotspots) acts = [];
    const layout = document.querySelector(".layout");
    if (layout) layout.classList.toggle("has-hotspots", !!hasHotspots);

    // 闭关结算补报：被事件/战斗接管时压下的结算，空闲帧一次性报清
    if (Engine.flushRetreatSettle) Engine.flushRetreatSettle();

    // 续闭快捷：闭关被打断后，事件处理完直接一键接着闭（限时 3 月内有效，免去重开菜单）
    // ⚠ 判断用 loc.actions 原始表——hotspots 地点 acts 被清空，误判会把快捷提前抹掉
    let resumeBtn = "";
    const rr = Engine._retreatResume;
    if (rr && !loc.scene && !storyPending && !State.data.combat) {
      if (State.absMonth() > rr.until || !(loc.actions && loc.actions.includes("cultivate"))) {
        Engine._retreatResume = null;
      } else {
        resumeBtn = `<button class="btn btn-action btn-window" onclick="Engine._retreatResume=null;Engine.doCultivate(${rr.months})">继续闭关 <span class="win-left">余${rr.months}月</span></button>`;
      }
    }

    // 涟漪窗口：限时机会在对应地点浮现（过期即逝）
    let windowBtn = "";
    const rw = State.data.rippleWindow;
    if (rw && !loc.scene) {
      const left = rw.dueAbs - State.absMonth();
      if ((rw.id === "herb_garden" && loc.id === "houshan") || (rw.id === "wolf_bounty" && loc.id === "town")) {
        const lbl = rw.id === "herb_garden" ? "寻无主药园" : "应悬赏剿匪";
        windowBtn = `<button class="btn btn-action btn-window" onclick="Engine.doRippleWindow('${rw.id}')">${lbl} <span class="win-left">余${left}月</span></button>`;
      } else if (rw.id === "lingcao_boom" && loc.id === "fangshi") {
        windowBtn = `<button class="btn btn-action btn-window" onclick="Engine.doRippleWindow('lingcao_boom')">趁涨价出手灵草 <span class="win-left">余${left}月</span></button>`;
      } else if (rw.id === "wanbao_sale" && loc.id === "fangshi") {
        windowBtn = `<button class="btn btn-action btn-window" onclick="Engine.doRippleWindow('wanbao_sale')">二层法器·八折捡漏 <span class="win-left">余${left}月</span></button>`;
      } else if (rw.id === "jindi_gossip" && loc.id === "fangshi") {
        windowBtn = `<button class="btn btn-action btn-window" onclick="Engine.doRippleWindow('jindi_gossip')">钻研禁地旧闻（1月） <span class="win-left">余${left}月</span></button>`;
      }
    }

    // 演出即引导：落幕时指定的行动按钮脉冲高亮一次（指明"该点哪个"），消费即清
    const focus = this._pendingFocus; this._pendingFocus = null;
    box.innerHTML = (acts.length || windowBtn || resumeBtn)
      ? resumeBtn + windowBtn + acts.map(a => `<button class="btn btn-action${a === focus ? " btn-guide-focus" : ""}" data-action="${a}">${(loc.actionLabels && loc.actionLabels[a]) || labels[a] || a}</button>`).join("")
      : (loc.scene ? `<div class="act-hint">— 此地仅供过场，循剧情前行 —</div>`
      : (hasHotspots ? `<div class="act-hint">— 点场景中发光标记行事 —</div>` : ""));
    box.querySelectorAll("[data-action]").forEach(btn => {
      btn.addEventListener("click", () => Engine.doAction(btn.dataset.action));
    });
  },

  renderTopbar() {
    const s = State.data;
    const t = this.el("top-time");
    // D5 时间可感知（审美审计 jank#7）：月轮转有"一拍"——日期翻动微动效；跨年一声远钟。
    const abs = State.absMonth ? State.absMonth() : (s.year * 12 + s.month);
    if (t) {
      const txt = `第${s.year}年${s.month}月`;
      if (t.textContent !== txt) {
        t.textContent = txt;
        if (this._lastAbsMonth != null && abs !== this._lastAbsMonth) {
          t.classList.remove("time-tick"); void t.offsetWidth;
          t.classList.add("time-tick");
        }
      }
    }
    if (this._lastAbsMonth != null && abs > this._lastAbsMonth) {
      const prevYear = Math.floor((this._lastAbsMonth - 1) / 12);
      const curYear = Math.floor((abs - 1) / 12);
      // 跨年：一声远钟（岁月有重量——闭关数年也只敲一声，不轰炸）
      if (curYear > prevYear && typeof Sfx !== "undefined") Sfx.play("yearBell");
    }
    this._lastAbsMonth = abs;
    // 月历条
    this._renderMonthBar(s.month);
    // 季节染色
    this._updateSeason(s.month);
    // 修为进度（顶栏常驻·全 tab 可见）：核心循环「闭关→看修为涨→再闭关」不必切到状态页
    //   ——把 float-gain「+修为」锚到一条始终在场的进度条上（嗑瓜子即时反馈·时间=货币）。
    const realm = (typeof State.realm === "function") ? State.realm() : null;
    if (realm) {
      const rn = this.el("top-cul-realm");
      const stg = (typeof State.realmStage === "function") ? State.realmStage(s) : null;
      if (rn) rn.textContent = realm.name + (stg ? "·" + stg.name : "");
      const max = realm.culMax || 1;
      const fill = this.el("top-cul-fill");
      if (fill) fill.style.width = clamp((s.cultivation / max) * 100, 0, 100) + "%";
      const ct = this.el("top-cul-text");
      if (ct) ct.textContent = `${Math.round(s.cultivation)}/${max}`;
    }
    // 角色卡
    const hn = this.el("hero-name"); if (hn) hn.textContent = s.name;
    const ha = this.el("hero-age"); if (ha) ha.textContent = `${s.age} 岁`;
    const hl = this.el("hero-lifespan"); if (hl) hl.textContent = s.lifespan;
    // 韩立立绘（v213：跟随三级换装 Art.heroId()；id 变化才重绘）
    const hp = this.el("hero-portrait");
    if (hp && typeof Art !== "undefined") {
      const hid = Art.heroId ? Art.heroId() : "hanli";
      const url = Art.url(hid);
      if (url && hp.dataset.img !== hid) { hp.innerHTML = `<img src="${url}" alt="${s.name}" />`; hp.dataset.img = hid; }
    }
    // 随身灵圃：小绿瓶解锁后，顶栏「小瓶」常驻
    // polish A7③：瓶中有成→按钮亮角标（不开瓶也知道熟了）
    const bb = this.el("btn-bottle");
    if (bb) {
      bb.hidden = !(s.bottle && s.bottle.unlocked);
      const ripe = !!(s.bottle && (s.bottle.plots || []).some(p => p.crop && p.growth >= 100));
      bb.textContent = ripe ? "小瓶✦" : "小瓶";
      bb.classList.toggle("bottle-ripe", ripe);
    }
  },

  _seasonOf(month) {
    if (month <= 3) return "spring";
    if (month <= 6) return "summer";
    if (month <= 9) return "autumn";
    return "winter";
  },
  _renderMonthBar(month) {
    const bar = this.el("month-bar");
    if (!bar) return;
    if (!bar.children.length) {
      const seasons = ["spring","spring","spring","summer","summer","summer","autumn","autumn","autumn","winter","winter","winter"];
      bar.innerHTML = seasons.map((se, i) =>
        `<div class="month-cell ${se}" data-m="${i+1}"></div>`
      ).join("");
    }
    bar.querySelectorAll(".month-cell").forEach(c => {
      c.classList.toggle("active", +c.dataset.m === month);
    });
  },
  _updateSeason(month) {
    const stage = this.el("scene-stage");
    if (stage) stage.dataset.season = this._seasonOf(month);
  },

  renderStats() {
    const s = State.data;
    const realm = State.realm();
    const root = State.root();
    this.el("st-root").textContent = root.name;
    this.el("st-root").style.color = root.color;
    // 藏拙：真实境界 +（示人境界）；大境界内显示 初入/中坚/巅峰（由主修功法层派生）
    const hid = s.realmIndex - (s.revealedRealm != null ? s.revealedRealm : s.realmIndex);
    const stage = State.realmStage(s);
    const stageTxt = stage ? `·${stage.name}` : "";
    this.el("st-realm").textContent = hid > 0
      ? `${realm.name}${stageTxt}（示人：${DATA.realms[s.revealedRealm].name}）`
      : `${realm.name}${stageTxt}`;
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

  _prevBars: {},
  setBar(key, val, max) {
    const pct = clamp((val / max) * 100, 0, 100);
    const bar = this.el(`${key}-bar`);
    const txt = this.el(`${key}-text`);
    const prev = this._prevBars[key] || 0;
    const cur = Math.round(val);
    if (bar) bar.style.width = pct + "%";
    if (txt) txt.textContent = (key === "cul" || key === "sp") ? `${cur} / ${max}` : cur;
    // 数值跳动 + 浮动增益
    if (cur !== prev && bar) {
      const delta = cur - prev;
      txt.classList.remove("num-pop");
      void txt.offsetWidth;
      txt.classList.add("num-pop");
      if (delta > 0) this._floatGain(key, delta);
    }
    this._prevBars[key] = cur;
  },
  _floatGain(key, delta) {
    const labels = { cul: "修为", sp: "灵力", hp: "气血", mood: "心境", demon: "心魔" };
    // 心魔上涨是坏事——用警示色；其余增益用上扬绿。多条同刻增益纵向错开，避免叠成一团读不清。
    const bad = key === "demon";
    const el = document.createElement("div");
    el.className = "float-gain-toast" + (bad ? " fg-bad" : "");
    el.textContent = `${labels[key] || key} ${bad ? "" : "+"}${delta}`;
    // 本帧内的第 n 条：纵向下移 n×26px（同刻多项结算时逐条排开）
    const now = performance.now();
    if (!this._fgFrame || now - this._fgFrame > 200) { this._fgFrame = now; this._fgIdx = 0; }
    el.style.marginTop = (this._fgIdx * 26) + "px";
    this._fgIdx++;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1500);
  },

  // 背包分类（A4：道具/材料/丹药/法宝）——keepsake 唯一信物不入此处，归大件图鉴
  INV_CATS: [
    { key: "misc", label: "道具" },
    { key: "mat", label: "材料" },
    { key: "pill", label: "丹药" },
    { key: "art", label: "法宝" },
  ],
  _itemCat(item) {
    if (!item) return "misc";
    if (item.type === "material") return "mat";
    if (item.type === "treasure" || item.type === "gear") return "art";
    if (item.type === "pill" || /丹$|丹药|药$/.test(item.name || "")) return "pill";
    return "misc";   // 消耗(符/暗器/阵旗)、令牌、功法、典籍、灵石……
  },
  setInvCat(key) { this._invCat = key; this.renderInventory(); },
  _renderInvCats(counts) {
    const box = this.el("inv-cats");
    if (!box) return;
    box.innerHTML = this.INV_CATS.map(c =>
      `<button class="inv-cat${this._invCat === c.key ? " active" : ""}" onclick="UI.setInvCat('${c.key}')">${c.label}<span class="ic-n">${counts[c.key] || 0}</span></button>`
    ).join("");
  },

  renderInventory() {
    const inv = State.data.inventory;
    const box = this.el("inventory");
    // 剔除信物：keepsake 唯一信物归「大件图鉴·羁绊·信物」，不入普通背包
    const all = Object.keys(inv).filter(k => inv[k] > 0 && DATA.items[k] && !DATA.items[k].keepsake);
    // 分类计数
    const counts = {};
    this.INV_CATS.forEach(c => counts[c.key] = 0);
    all.forEach(k => { const c = this._itemCat(DATA.items[k]); if (counts[c] != null) counts[c]++; });
    // 默认落在第一个有物的分类
    if (!this._invCat) {
      const first = this.INV_CATS.find(c => counts[c.key] > 0);
      this._invCat = first ? first.key : this.INV_CATS[0].key;
    }
    this._renderInvCats(counts);
    if (!all.length) { box.innerHTML = `<div class="inv-empty">储物袋空空如也</div>`; return; }
    const keys = all.filter(k => this._itemCat(DATA.items[k]) === this._invCat);
    if (!keys.length) { box.innerHTML = `<div class="inv-empty">此类暂无</div>`; return; }
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
      const layer = State.gateLayer();
      const can = !gdef.minLayer || layer >= gdef.minLayer;
      if (equipped) {
        actions += `<button class="btn btn-secondary" onclick="Engine.unequipGear('${gdef.slot}'); UI.closeModal();">卸下</button>`;
        // 法宝出战位：战斗技法器可"收起不出战"——境界换代后，旧法宝不挤新手牌
        (gdef.grantSpells || []).forEach(sk => {
          const benched = (State.data.benchTreasures || []).includes(sk);
          const skName = (typeof CombatAPI !== "undefined" && CombatAPI.SPELLS[sk]) ? CombatAPI.SPELLS[sk].name : sk;
          actions += `<button class="btn btn-mini" onclick="Engine.toggleBenchTreasure('${sk}'); UI.closeModal();">${benched ? `「${skName}」重新出战` : `收起「${skName}」（不入战斗手牌）`}</button>`;
        });
      } else {
        const slotName = gdef.slot === "weapon" ? "武器" : gdef.slot === "armor" ? "护身" : "饰物";
        if (!can) {
          const mpMul = (typeof Balance !== "undefined") ? Balance.gearLayerMpMul(layer, gdef.minLayer) : 1;
          actions += `<button class="btn btn-primary" onclick="Engine.equipGear('${itemId}'); UI.closeModal();">越阶装备（${slotName}·灵力×${mpMul.toFixed(1)}）</button>`;
        } else {
          actions += `<button class="btn btn-primary" onclick="Engine.equipGear('${itemId}'); UI.closeModal();">装备（${slotName}）</button>`;
        }
      }
      actions += `<button class="btn btn-secondary" onclick="UI.closeModal(); UI.openTreasury();">法宝位一览</button>`;
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
        <div style="color:var(--ink-faint);font-size:11px;margin-top:4px">全效层：练气${gdef.minLayer || 1}层${!can ? `　<span style="color:var(--warn)">越阶催动·灵力×${((typeof Balance !== "undefined") ? Balance.gearLayerMpMul(layer, gdef.minLayer) : 1).toFixed(1)}</span>` : ""} · 槽位：${gdef.slot === "weapon" ? "武器" : gdef.slot === "armor" ? "护身" : "饰物"}</div>
      </div>`;
    }
    // 功法典籍：从背包直达「研习→配装」闭环（治“取得了典籍却不知如何学/用”）
    let techHtml = "";
    const techId = Object.keys(DATA.techniques).find(id => DATA.techniques[id].book === itemId);
    if (techId) {
      const tdef = DATA.techniques[techId];
      const L = (typeof Loadout !== "undefined") ? Loadout : null;
      const learned = L && L.isLearned(State.data, techId);
      const grant = (tdef.grantSpells || []).map(id => {
        const sp = (typeof CombatAPI !== "undefined") ? CombatAPI.SPELLS[id] : null;
        return sp ? `「${sp.name}」` : id;
      }).join(" ");
      techHtml = `<div style="background:rgba(0,0,0,.2);border-radius:8px;padding:8px 10px;margin:8px 0;font-size:13px">
        <div style="color:var(--gold)">功法典籍 · ${gradeLabel(tdef.grade)}　授技：${grant || "—"}</div>
        <div style="color:var(--ink-faint);font-size:11px;margin-top:4px">${learned ? "已习得——可在「功法 · 配装」设为主修/辅修、装配出战。" : "闭关静心研习方能习得（耗时三月）；习得后于「功法 · 配装」装配出战。"}</div>
      </div>`;
      if (learned) {
        actions += `<button class="btn btn-secondary" onclick="UI.closeModal(); UI.openTechniques();">前往配装</button>`;
      } else if (!tdef.locked) {
        actions += `<button class="btn btn-primary" onclick="UI.closeModal(); Engine.studyTechnique('${techId}');">闭关研习（3月）</button>`;
      }
    }
    this.openModal(`
      <h2>${item.name}</h2>
      ${this._statusStrip()}
      <p style="color:var(--ink-dim)">${rarityLabel(item.rarity)} · ${typeLabel(item.type)}　持有 ×${State.count(itemId)}</p>
      <p>${item.desc}</p>
      ${gearHtml}
      ${techHtml}
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
    // 去文字墙（审美审计 jank#4）：默认只展开最近 3 条，早前的折叠成一行「早前之事」——
    // 读档进来不再一次糊 30+ 行；点开可看全录（本会话内保持展开）。
    const KEEP = 3;
    const collapsed = !this._narrExpanded && s.log.length > KEEP + 2;
    const start = collapsed ? s.log.length - KEEP : 0;
    const foldRow = collapsed
      ? `<div class="entry-fold" onclick="UI._narrExpanded=true;UI.renderNarrative()">▸ 早前之事 ${s.log.length - KEEP} 条 · 展开</div>`
      : "";
    box.innerHTML = foldRow + s.log.slice(start).map((e, idx) => {
      const i = start + idx;
      return `
      <div class="entry ${e.kind}${i === last ? ' latest' : ''}">
        <div class="time-stamp"><span class="ek-icon">${icons[e.kind] || "·"}</span>${e.t}</div>
        <div class="body">${e.body}</div>
      </div>`;
    }).join("");
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
  renderStory(stage, opts) {
    opts = opts || {};
    // v316 polish C1：text/choices 可为函数——多数调用方已自行解析，但败北重试/直渲路径漏解析
    // 会在 Cutscene.compile 的 for...of 处抛错（"segs is not iterable"），连带把"短版再战卡"
    // （_storyShouldSkipIntro→直入抉择）整个炸掉=战败后重播全篇甚至不弹卡。入口统一兜底。
    if (stage && (typeof stage.text === "function" || typeof stage.choices === "function")) {
      const sd = (typeof State !== "undefined" && State.data) ? State.data : {};
      stage = Object.assign({}, stage, {
        text: typeof stage.text === "function" ? stage.text(sd) : stage.text,
        choices: typeof stage.choices === "function" ? stage.choices(sd) : stage.choices,
      });
    }
    const overlay = this.el("story-overlay");
    // 兜底：若剧情舞台 DOM 缺失，退回把整段剧情写入叙事日志并直接出选项，绝不卡住
    if (!overlay) { this._renderStoryFallback(stage); return; }
    // 将 stage.text 的混合段落解析成统一的"演出节拍"序列
    const beats = this._buildStoryBeats(stage);
    this._story = { stage, beats, idx: -1, replay: !!opts.replay };
    overlay.hidden = false;
    document.body.classList.add("story-on");
    // 剧情配乐：节点可指定 bgm 轨（sorrow 离殇/tense 阴谋/triumph 扬眉……）
    if (stage.bgm && typeof Sfx !== "undefined" && Sfx.bgm) Sfx.bgm(stage.bgm);
    // 重置双人立绘
    const lb = this.el("story-portrait-left"), rb = this.el("story-portrait-right");
    if (lb) { lb.innerHTML = ""; lb.className = "story-portrait left"; }
    if (rb) { rb.innerHTML = ""; rb.className = "story-portrait right"; rb.dataset.set = ""; }
    // 清空上一幕残留：对话文本/说话人/选项必须复位，否则旧选项会赖在屏底、仍可点击，
    // 造成"点了没剧情变化 / 切幕后旧内容残留在对话框"（题字卡演出期间也不该露出旧选项）。
    const spEl = this.el("story-speaker"); if (spEl) spEl.innerHTML = "";
    const txEl = this.el("story-text"); if (txEl) txEl.innerHTML = "";
    const chEl = this.el("story-choices");
    if (chEl) { chEl.innerHTML = ""; chEl.classList.remove("cut-beat-on"); }
    const dlgEl = this.el("story-dialog"); if (dlgEl) dlgEl.classList.remove("scene-beat");
    const cueEl0 = this.el("story-cue"); if (cueEl0) cueEl0.textContent = "";
    // 场景背景：优先该阶段声明的 CG，否则用当前地点的场景图
    this._storySetScene(stage);
    // 演出地基（cutscene.js）：清旧镜头/计时；含演出原语则挂 FX 叠层、关 kenBurns 改由镜头 op 驱动
    const bg = this.el("story-bg");
    const skip = this.el("story-skip");
    if (typeof Cutscene !== "undefined") {
      Cutscene.clear();
      Cutscene.resetCam(this._storyCtx());
      const staged = Cutscene.hasStaging(stage);
      if (bg) bg.classList.toggle("story-cam", staged);
      // 演出态点亮远景视差面（B1·演出态多平面）：镜头 op 时随 _cam 差速位移＝纵深
      const far = this.el("story-far");
      if (far) far.classList.toggle("on", staged && !!far.style.backgroundImage);
      if (staged && typeof Fx !== "undefined" && Fx.ensure) Fx.ensure(overlay);
    } else if (bg) { bg.classList.remove("story-cam"); }
    if (skip) skip.hidden = false;
    overlay.onclick = (e) => this._storyOverlayTap(e);
    // 败北重试 / 已看过：跳过题字与正文直达抉择（免重复演出之扰）。重温(replay)不走此径。
    if (!opts.replay && this._storyShouldSkipIntro(stage)) {
      if (typeof Engine !== "undefined" && Engine._retryStage) Engine._retryStage = false;
      this._storySkipToChoices(stage, !!State.data.flags["story_seen_" + stage.id]);
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
    const tsc = (typeof Settings !== "undefined" && Settings.speedScale) ? Settings.speedScale() : 1;
    this._titleTimer = setTimeout(begin, Math.round(1500 * tsc));
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
        return `<button class="choice${c.resolve && c.resolve !== "advance" ? ' choice-fight' : ''}" onclick="Engine.chooseStory(STORY[${State.data.storyStage}], ${i})">
          ${c.text}${c.hint ? `<span class="c-hint">${c.hint}${lack ? '（尚缺）' : ''}</span>` : ""}
        </button>`;
      }).join("");
    }
  },

  // 把 text[]（字符串/对象混排）拍平成节拍。演出原语（cam/actor/fx/sfx/wait/beat）的
  // 编译统一委托 cutscene.js（纯函数、可无头测试）；缺该模块则退回内置兼容解析（旧剧情卡）。
  _buildStoryBeats(stage) {
    const beats = (typeof Cutscene !== "undefined" && Cutscene.compile)
      ? Cutscene.compile(stage)
      : this._buildStoryBeatsFallback(stage);
    // 因果有报·沉浸呈现：onArrive 里 settleLedger 缓冲的「远雷」插到剧情流最前（金句先声夺人，不再埋日志）
    if (typeof Engine !== "undefined" && Engine._pendingEchoes && Engine._pendingEchoes.length) {
      const echoes = Engine._pendingEchoes;
      const echoBeats = [];
      // ≥3 条：加一句蒙太奇引语，让"投入越多回报越涌"读作刻意的往事回闪，而非堆砌
      if (echoes.length >= 3) echoBeats.push({ kind: "echo", text: "往事一幕幕涌上心头——你这一路的每一分用心，此刻都有了回响。" });
      echoes.forEach(e => echoBeats.push({ kind: "echo", text: `【因果有报】${e.echo}` }));
      Engine._pendingEchoes = [];
      return echoBeats.concat(beats);
    }
    return beats;
  },

  _buildStoryBeatsFallback(stage) {
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
    // 远景视差面与背景同图（程序化"推远"，无需切图；真·分层切图就位后可在其上叠 layers）
    const far = this.el("story-far");
    if (url) {
      bg.style.backgroundImage = `url("${url}")`; bg.classList.add("on");
      // far=同图·模糊压暗版：竖屏 contain 呈现时填满信箱边带（杜绝方图 _p 被 cover 裁半）；
      //   桌面横屏 story-bg 仍 cover 全盖、far 被遮＝零观感变化。
      if (far) { far.style.backgroundImage = `url("${url}")`; far.classList.add("on"); }
      // 竖屏画幅自适应（v295）：测真实图比——近 9:16 的竖图用 cover 全出血（裁切极小、更有沉浸感），
      //   方图/横图保持 contain 信箱式（不裁主体）。桌面横屏恒 cover，cg-fill 无害。
      bg.classList.remove("cg-fill");
      if (window.matchMedia && window.matchMedia("(orientation: portrait)").matches) {
        const probe = new Image();
        probe.onload = () => { if (probe.naturalWidth / probe.naturalHeight <= 0.62) bg.classList.add("cg-fill"); };
        probe.src = url;
      }
    } else {
      bg.style.backgroundImage = ""; bg.classList.remove("on");
      if (far) { far.style.backgroundImage = ""; far.classList.remove("on"); }
    }
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
    // §9 演出速度：逐字间隔按设置缩放（默认 26ms；慢×1.5 / 快×0.6 / 极快×0.35）
    const sc = (typeof Settings !== "undefined" && Settings.speedScale) ? Settings.speedScale() : 1;
    const tick = Math.max(6, Math.round(26 * sc));
    this._typeTimer = setInterval(() => {
      i += 1;
      span.textContent = full.slice(0, i);
      // 打字机轻嗒：每3字一声，标点不响（气口）；§7 按说话人立绘左右偏声相
      if (typeof Sfx !== "undefined" && i % 3 === 0 && !/[，。！？…—、；：]/.test(full[i - 1] || "")) Sfx.play("type", { pan: this._sayPan || 0 });
      if (i >= full.length) {
        clearInterval(this._typeTimer); this._typeTimer = null;
        if (st) st.typing = false;
      }
    }, tick);
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

  // 剧情是否跳过题字/正文（败北重试或已看过）
  _storyShouldSkipIntro(stage) {
    if (typeof Engine !== "undefined" && Engine._retryStage) return true;
    return !!(stage && stage.id && State.data.flags && State.data.flags["story_seen_" + stage.id]);
  },

  _storySkipToChoices(stage, seenBefore) {
    const st = this._story; if (!st) return;
    st.idx = st.beats.length;
    const stageName = this.el("story-stage-name");
    if (stageName) stageName.textContent = stage.title || "";
    const sp = this.el("story-speaker"), tx = this.el("story-text");
    if (sp) sp.innerHTML = "";
    const msg = seenBefore
      ? "（这一幕你已了然于胸——直入抉择。）"
      : "（你重整旗鼓，伤势已敷、底牌再备——这一次，结局会不同。）";
    if (tx) tx.innerHTML = `<span class="story-line narr">${msg}</span>`;
    this._storyShowChoices();
  },

  // 全屏点按推进：CG/立绘区轻触亦可续演（不限底部对话框）
  _storyOverlayTap(e) {
    if (!this._story || this._story.done || this._story.titling) return;
    const t = e.target;
    if (t.closest(".story-choices") || t.closest("#story-skip") || t.closest(".story-titlecard")) return;
    if (t.closest("#story-dialog")) return;
    this.storyAdvance();
  },

  // 逐句推进：每次轻触显示下一节拍；打字中则先补完；到末尾给出选项。
  // 演出原语（cam/actor/fx/sfx/bgm）是舞台指令，自动连演不阻塞；撞上台词/交互/wait 才停。
  storyAdvance() {
    const st = this._story; if (!st) return;
    if (st.titling) return;           // 题字卡期间由卡自己处理
    if (st.beatActive) return;        // 交互 beat 进行中：轻触无效（由 beat 自己结算）
    if (st.stageActive) { this._stageAdvance(); return; }  // 舞台模式：轻触交给 Stage 运行器
    if (st.typing) { this._typeFinish(); return; }
    if (st.done) return;              // 已到结尾：不再推进（选项已显示）
    this._storyPlayNext();
  },

  // 演出调度循环：连演舞台指令，遇台词/交互 beat/wait(click) 停下等玩家
  _storyPlayNext() {
    const st = this._story; if (!st) return;
    if (this._cutTimer) { clearTimeout(this._cutTimer); this._cutTimer = null; }
    st.idx++;
    while (st.idx < st.beats.length) {
      const b = st.beats[st.idx];
      if (b.kind === "op") {
        const r = (typeof Cutscene !== "undefined") ? Cutscene.run(b, this._storyCtx()) : null;
        if (b.op === "wait" && b.wait === "click") { this._storyCue("▽ 轻触继续"); return; }
        if (r && r.auto) { this._cutTimer = setTimeout(() => this._storyPlayNext(), r.auto); return; }
        st.idx++;
        continue;                     // 非阻塞舞台指令：立即连演下一拍
      }
      if (b.kind === "beat") {
        // §9-6 重温：交互 beat 是玩法而非名场面本身——回放里不要求反应，直接演"命中"那一手的
        //   特效/镜头/反应台词，把climax 的视觉重现出来，然后续演（auto-play，零输入）。
        if (st.replay) {
          const spec = (b.beat) || {};
          const c = spec.onHit || (spec.choices && spec.choices[0]) || {};
          if (typeof Cutscene !== "undefined" && Cutscene._react) Cutscene._react(c, this._storyCtx());
          if (c && c.line) st.beats.splice(st.idx + 1, 0, { kind: "narr", text: c.line });
          st.idx++; continue;
        }
        st.beatActive = true;
        if (typeof Cutscene !== "undefined" && Cutscene.runBeat) {
          Cutscene.runBeat(b, this._storyCtx(), (res) => {
            st.beatActive = false;
            // 结算反应台词：作为下一拍旁白插入，无缝接演
            if (res && res.line) st.beats.splice(st.idx + 1, 0, { kind: "narr", text: res.line });
            this._storyPlayNext();
          });
          return;
        }
        st.beatActive = false; st.idx++; continue;   // 无演出模块：跳过交互
      }
      if (b.kind === "guide") {       // 演出即引导：落幕指路卡，玩家确认后续演／落幕
        if (st.replay) { st.idx++; continue; }   // §9-6 重温：落幕指路是导航，回放里跳过（不脉冲地点按钮）
        st.beatActive = true;
        if (typeof Cutscene !== "undefined" && Cutscene.runGuide) {
          Cutscene.runGuide(b, this._storyCtx(), (res) => {
            st.beatActive = false;
            if (res && res.focus) this._pendingFocus = res.focus;   // 落幕后在地点屏脉冲高亮
            this._storyPlayNext();
          });
          return;
        }
        st.beatActive = false; st.idx++; continue;
      }
      if (b.kind === "drop") {        // D1-a 终止拍：演出落幕直接坠入战斗/箱庭，跳过「临战准备」选择屏
        if (st.replay) { st.idx++; continue; }   // §9-6 重温：只演到坠入前一拍、不结算（坠入是玩法不是名场面）
        this._storyDrop(b);
        return;
      }
      if (b.kind === "stage") {       // 箱庭舞台：进入横版轴模式
        if (st.replay) { st.idx++; continue; }   // 重温：跳过舞台（舞台是空间玩法，回放里不演）
        this._enterStage(b.stage);
        return;
      }
      this._renderTextBeat(b);        // 台词层：渲染并等轻触
      return;
    }
    this._storyShowChoices();
  },

  // D1-a 直接坠入：演出落幕直挂战斗/箱庭。未知目标 → fail-soft 退回旧选择屏（临战准备+抉择），零回归。
  // _dropped 幂等位：避免"跳过"或重复轻触误触发两次坠入。
  _storyDrop(b) {
    const st = this._story; if (!st || st._dropped) return;
    const stage = st.stage;
    // 可行性预检：未知 fight id / warp 目标不存在 → 不坠入，退回旧选择屏（绝不空白、不崩）
    let feasible = false;
    if (b.drop === "fight") feasible = !!(typeof Engine !== "undefined" && Engine.hasFight && Engine.hasFight(b.fight));
    else if (b.drop === "warp") feasible = !!(typeof Engine !== "undefined" && Engine.canWarp && Engine.canWarp(b.warp));
    if (!feasible) { this._storyShowChoices(); return; }   // 等价旧行为：临战准备 + 抉择按钮
    st._dropped = true;
    // 收束演出层（同 storyChoose：清计时、复位镜头、收环境床/氛围粒、退跳过键）
    if (this._titleTimer) { clearTimeout(this._titleTimer); this._titleTimer = null; }
    if (this._typeTimer) { clearInterval(this._typeTimer); this._typeTimer = null; }
    if (this._cutTimer) { clearTimeout(this._cutTimer); this._cutTimer = null; }
    if (typeof Cutscene !== "undefined") { Cutscene.clear(); Cutscene.resetCam(this._storyCtx()); }
    if (typeof Sfx !== "undefined" && Sfx.ambientStop) Sfx.ambientStop();
    if (typeof Fx !== "undefined" && Fx.ambient) Fx.ambient(null);
    const skip = this.el("story-skip"); if (skip) skip.hidden = true;
    const bg = this.el("story-bg"); if (bg) bg.classList.remove("story-cam");
    const far = this.el("story-far"); if (far) far.classList.remove("on");
    this._archiveStory(stage);        // 名场面入风云录「名场面回廊」（可重温），同 storyChoose
    const ovDrop = this.el("story-overlay"); if (ovDrop) { ovDrop.hidden = true; ovDrop.onclick = null; }
    document.body.classList.remove("story-on");
    this._story = null;
    // guard.hint：落幕坠入前顺势提示底牌（不阻塞、不拦截）
    if (b.guard && b.guard.hint && typeof Engine !== "undefined" && Engine.toast) Engine.toast(b.guard.hint);
    // 坠入（薄封装；理论上预检已过，仍兜底——极端失败重渲该卡走旧选择屏）
    let ok = false;
    try {
      if (b.drop === "fight") ok = Engine.startFight(b.fight);
      else if (b.drop === "warp") ok = Engine.gotoLocation(b.warp, { spot: b.spot, arrive: b.arrive });
    } catch (e) { ok = false; }
    if (!ok) { try { this.renderStory(stage); } catch (e) {} }
  },

  // —— 箱庭舞台（Stage Scene）：复用 L3 轴渲染管线，人物在横版背景上移动/对话/追逐/入战 ——
  // 进入舞台：隐藏 story overlay，显示 stage overlay，初始化 Stage 运行器
  _enterStage(config) {
    const st = this._story; if (!st) return;
    st.beatActive = true;
    st.stageActive = true;

    // 隐藏 story overlay，显示 stage overlay
    const storyOv = this.el("story-overlay");
    if (storyOv) storyOv.style.opacity = "0";
    const stageOv = this.el("stage-overlay");
    if (stageOv) { stageOv.hidden = false; stageOv.style.opacity = "1"; }

    // 初始化 Stage 运行器
    if (typeof Stage === "undefined") { this._exitStage(); return; }
    Stage.init(config);

    // 渲染背景
    const bgEl = this.el("stage-bg");
    if (bgEl && typeof Art !== "undefined") {
      const url = (Art.sceneUrl && Art.sceneUrl(config.bg, { landscape: true })) ||
                  (Art.cgUrl && Art.cgUrl(config.bg));
      if (url) bgEl.style.backgroundImage = `url('${url}')`;
    }

    // 设置 track 宽度
    const track = this.el("stage-track");
    const V = 12;
    const W = config.W || 15;
    if (track) track.style.width = ((W / V) * 100) + "%";

    // 初始渲染
    this._renderStageUnits();
    this._renderStageLane(false);

    // 启动脚本执行
    const ctx = {
      stageEl: stageOv,
      bgEl: bgEl,
      trackEl: track,
      laneEl: this.el("stage-lane"),
      unitsEl: this.el("stage-units"),
      bubbleEl: this.el("stage-bubble"),
      noteEl: this.el("stage-note"),
      choiceEl: this.el("stage-choice"),
      renderUnits: (s) => this._renderStageUnits(),
      renderLane: (s, fm) => this._renderStageLane(fm),
      renderBubble: (u, text, emo, tone, s) => this._renderStageBubble(u, text, emo, tone, s),
      dimExcept: (id, s) => this._dimStageExcept(id, s),
      undimAll: (s) => this._undimStageAll(s),
      onCgOut: () => this._exitStage(),
      onCombat: (fightId, snap) => this._stageToCombat(fightId, snap),
    };
    Stage.exec(ctx, () => this._exitStage());
  },

  // 退出舞台：回到 story overlay 续演
  _exitStage() {
    const st = this._story; if (!st) return;
    if (typeof Stage !== "undefined") Stage.destroy();

    // 清理 stage overlay
    const stageOv = this.el("stage-overlay");
    if (stageOv) { stageOv.hidden = true; stageOv.style.opacity = ""; }
    const bgEl = this.el("stage-bg"); if (bgEl) bgEl.style.backgroundImage = "";
    const bubbleEl = this.el("stage-bubble"); if (bubbleEl) { bubbleEl.innerHTML = ""; bubbleEl.classList.remove("on"); }
    const noteEl = this.el("stage-note"); if (noteEl) { noteEl.innerHTML = ""; noteEl.classList.remove("on"); }
    const choiceEl = this.el("stage-choice"); if (choiceEl) { choiceEl.innerHTML = ""; choiceEl.classList.remove("on"); }

    // 恢复 story overlay
    const storyOv = this.el("story-overlay");
    if (storyOv) storyOv.style.opacity = "";

    st.beatActive = false;
    st.stageActive = false;
    this._storyPlayNext();
  },

  // 从舞台坠入战斗
  _stageToCombat(fightId, snap) {
    const st = this._story; if (!st || st._dropped) return;
    st._dropped = true;
    if (typeof Stage !== "undefined") Stage.destroy();

    // 清理 stage overlay
    const stageOv = this.el("stage-overlay");
    if (stageOv) { stageOv.hidden = true; }
    const bgEl = this.el("stage-bg"); if (bgEl) bgEl.style.backgroundImage = "";
    const bubbleEl = this.el("stage-bubble"); if (bubbleEl) { bubbleEl.innerHTML = ""; bubbleEl.classList.remove("on"); }
    const noteEl = this.el("stage-note"); if (noteEl) { noteEl.innerHTML = ""; noteEl.classList.remove("on"); }
    const choiceEl = this.el("stage-choice"); if (choiceEl) { choiceEl.innerHTML = ""; choiceEl.classList.remove("on"); }

    // 收束 story overlay
    const storyOv = this.el("story-overlay");
    if (storyOv) storyOv.hidden = true;
    document.body.classList.remove("story-on");
    this._story = null;

    // 坠入战斗（可继承轴位置）
    if (snap && typeof Engine !== "undefined" && Engine.startFightFromStage) {
      try { Engine.startFightFromStage(fightId, snap); return; } catch (e) {}
    }
    if (typeof Engine !== "undefined" && Engine.startFight) {
      try { Engine.startFight(fightId); return; } catch (e) {}
    }
  },

  // 渲染舞台单位（复用 L3 轴单位渲染逻辑）
  _renderStageUnits() {
    if (typeof Stage === "undefined" || !Stage._state) return;
    const s = Stage._state;
    const unitsEl = this.el("stage-units");
    if (!unitsEl) return;
    const W = s.W;
    const udefs = Object.values(s.units).map(u => ({
      key: u.id, art: u.art, name: u.name, pos: u.pos, face: u.face,
      isHero: u.id === "hanli",
    }));
    // 韩立立绘跟随当前境界/换装（而非 stage 配置里硬编码的 bt_hanli）
    // 优先级：节点 heroSkin 场景强制 > 手动/境界默认（与旧 VN 模式一致）
    const st = this._story;
    const nodeSkin = st && st.stage && st.stage.heroSkin;
    const heroPt = (typeof Art !== "undefined" && Art.heroId)
      ? (nodeSkin || Art.heroId()) : "hanli";
    const heroBt = nodeSkin
      ? ("bt_" + nodeSkin)
      : ((typeof Art !== "undefined" && Art.heroBattlerId) ? Art.heroBattlerId() : "bt_hanli");
    const ukeys = udefs.map(d => d.key).join(",");
    if (unitsEl.dataset.keys !== ukeys) {
      unitsEl.dataset.keys = ukeys;
      unitsEl.innerHTML = udefs.map(d => {
        const artId = d.isHero ? heroBt : d.art;
        const fallbackId = d.isHero ? heroPt : d.art;
        const src = (typeof Art !== "undefined" && Art.battlerUrl) ? (Art.battlerUrl(artId) || Art.url(fallbackId)) : null;
        if (!src) return "";
        const cls = d.isHero ? "axis-unit self stage-u" : "axis-unit enemy stage-u";
        return `<div class="${cls}" data-k="${d.key}">
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
      if (img) {
        const flipped = d.face === "l";
        img.classList.toggle("flipped", flipped);
      }
    });
  },

  // 渲染轴格（可走点位 / 热点 / 布置标记）
  _renderStageLane(freeMove) {
    if (typeof Stage === "undefined" || !Stage._state) return;
    const s = Stage._state;
    const laneEl = this.el("stage-lane");
    if (!laneEl) return;
    const W = s.W;
    const hero = s.units["hanli"];
    const heroPos = hero ? hero.pos : 0;
    let html = "";
    for (let i = 0; i < W; i++) {
      const hot = s.hotspots.find(h => h.pos === i && !h.taken);
      const prepEntry = Object.entries(s.preps).find(([pid, c]) => c === i);
      const isUnit = Object.values(s.units).some(u => u.pos === i);
      const canGo = freeMove && !isUnit && i !== heroPos;
      const cls = ["axis-cell", canGo ? "can-move" : "", prepEntry ? "has-prep" : ""].join(" ").trim();
      const click = canGo ? `onclick="UI._stageCellClick(${i})"` : "";
      html += `<div class="${cls}" ${click}>
        ${prepEntry ? '<span class="cave-prep-mark">阵</span>' : ''}
        ${hot ? `<span class="cave-hot near">${this._hotIcon(hot.name)}<i>${hot.name}</i></span>` : ''}
        <i class="dot"></i>
      </div>`;
    }
    laneEl.innerHTML = html;
  },

  // 自由行走模式下玩家点击格子
  _stageCellClick(pos) {
    if (typeof Stage !== "undefined" && Stage._state && Stage._state.freeMove) {
      Stage.freeMoveClick(pos);
    }
  },

  // 渲染对话气泡
  _renderStageBubble(unit, text, emo, tone, s) {
    const bubbleEl = this.el("stage-bubble");
    if (!bubbleEl) return;
    const W = s.W;
    const V = 12;
    const cam = (typeof s._cam === "number") ? s._cam : 0;
    // 计算单位在视口中的水平百分比
    const xPct = ((unit.pos + 0.5 - cam) / V) * 100;
    // 气泡在单位上方
    const isLeft = xPct < 50;
    bubbleEl.innerHTML = `<div class="stage-bubble-box${isLeft ? ' left' : ' right'}" style="left: ${Math.max(10, Math.min(80, xPct))}%">
      <div class="stage-bubble-name">${unit.name}</div>
      <div class="stage-bubble-text">${text}</div>
      <div class="stage-bubble-tail"></div>
    </div>`;
    bubbleEl.classList.add("on");
    // 轻触继续提示
    const noteEl = this.el("stage-note");
    if (noteEl) { noteEl.innerHTML = '<div class="stage-cue">▽ 轻触继续</div>'; noteEl.classList.add("on"); }
  },

  // 暗淡非说话者
  _dimStageExcept(id, s) {
    const unitsEl = this.el("stage-units");
    if (!unitsEl) return;
    unitsEl.querySelectorAll(".axis-unit").forEach(el => {
      const k = el.dataset.k;
      el.classList.toggle("dim", k !== id);
    });
  },

  // 取消全部暗淡
  _undimStageAll(s) {
    const unitsEl = this.el("stage-units");
    if (!unitsEl) return;
    unitsEl.querySelectorAll(".axis-unit").forEach(el => el.classList.remove("dim"));
  },

  // 舞台轻触继续（由 storyAdvance 调用）
  _stageAdvance() {
    if (typeof Stage !== "undefined") Stage.advance();
  },

  // 渲染一条台词层节拍（narr/say/aside/scene）：打字机出字 + 立绘
  _renderTextBeat(b) {
    const st = this._story;
    const stageName = this.el("story-stage-name");
    if (stageName) stageName.textContent = st.stage.title || "";
    if (typeof Sfx !== "undefined") Sfx.play("page");

    // §7 声相：双人相对立绘——韩立(右)+0.45 / 对话 NPC(左)−0.45 / 旁白·心声·场景=居中
    const selfSpeak = b.who && (b.who === (State.data && State.data.name) || b.who === "韩立");
    this._sayPan = (b.kind === "say") ? (selfSpeak ? 0.45 : -0.45) : 0;

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
      const isEcho = (b.kind === "echo");
      speakerEl.innerHTML = (isNarr || isEcho) ? "" :
        `<span class="sp-name${isAside ? ' aside' : ''}">${who}${isAside ? "（心声）" : ""}</span>`;
      if (isEcho) {
        this._typeText(textEl, `<span class="story-line story-echo">${b.text}</span>`, true);
        if (typeof Sfx !== "undefined") Sfx.play("chime");
      } else {
        this._typeText(textEl, `<span class="story-line${isNarr ? ' narr' : ''}${isAside ? ' aside' : ''}">${b.text}</span>`);
      }
      // 立绘：旁白用当前地点/无；对话/心声用说话人立绘；showWho=立绘亮相（无对白）
      // emo=表情变体；tone 含怒/喝/厉 → 立绘震动（对话演出：形象会动，代入感所在）
      this._storySetPortrait(b.showWho || ((isNarr || isEcho) ? null : who), b.emo, b.tone);
    }

    const last = (st.idx >= st.beats.length - 1);
    if (cue) cue.textContent = last ? (st.replay ? "▽ 轻触，重温毕" : "▽ 轻触，到此抉择") : "▽ 轻触继续";
    this.el("story-choices").innerHTML = "";
  },

  // 演出 ctx：把舞台 DOM 元素与锚点解析交给 cutscene.js（本文件不碰特效像素）
  _storyCtx() {
    return {
      bg: this.el("story-bg"),
      far: this.el("story-far"),
      left: this.el("story-portrait-left"),
      right: this.el("story-portrait-right"),
      host: this.el("story-overlay"),
      fxHost: this.el("story-overlay"),
      beatHost: this.el("story-choices"),
      node: this._story && this._story.stage,   // v213：当前剧情节点（供 _actor 取 node.heroSkin 场景强制换装）
      anchor: (at) => this._storyAnchor(at),
    };
  },
  _storyAnchor(at) {
    if (at === "left") return this.el("story-portrait-left");
    if (at === "right") return this.el("story-portrait-right");
    return this.el("story-bg");       // center/缺省=场景中心
  },
  _storyCue(text) { const cue = this.el("story-cue"); if (cue) cue.textContent = text; },

  // 随时可跳：清演出计时/镜头，直达本幕抉择
  storySkip() {
    const st = this._story; if (!st || st.done) return;
    // 舞台模式：跳过舞台，回 story 续演
    if (st.stageActive) {
      if (typeof Stage !== "undefined") Stage.skip();
      this._exitStage();
      return;
    }
    if (this._titleTimer) { clearTimeout(this._titleTimer); this._titleTimer = null; }
    if (this._cutTimer) { clearTimeout(this._cutTimer); this._cutTimer = null; }
    if (this._typeTimer) { clearInterval(this._typeTimer); this._typeTimer = null; }
    if (typeof Cutscene !== "undefined") { Cutscene.clear(); Cutscene.resetCam(this._storyCtx()); }
    const card = this.el("story-titlecard"); if (card) card.classList.remove("show");
    st.titling = false; st.typing = false; st.beatActive = false;
    st.idx = st.beats.length;
    // D1-a：终止拍节点——跳过演出也直接坠入（不弹临战准备选择屏）；不可行/重温则 _storyDrop 内部退回旧路径
    const drop = !st.replay && !st._dropped && st.beats.find(x => x && x.kind === "drop");
    if (drop) { this._storyDrop(drop); return; }
    this._storyShowChoices();
  },

  // 双人相对立绘：韩立固定在右，对话 NPC 在左；说话者高亮，另一人暗淡。
  // emo=表情变体（有图换图，无图回退基础版）；tone 驱动震动（怒/喝/厉/吼=重击感）
  _storySetPortrait(who, emo, tone) {
    const st = this._story;
    const lbox = this.el("story-portrait-left");
    const rbox = this.el("story-portrait-right");
    if (!lbox || !rbox) return;

    const self = who && (who === State.data.name || who === "韩立");

    // 右侧固定为韩立立绘（v213：id 走三级换装 节点 heroSkin > 手动/境界默认；表情可随 emo 切换）
    const heroId = (typeof Art !== "undefined" && Art.heroId)
      ? ((st && st.stage && st.stage.heroSkin) || Art.heroId())
      : "hanli";
    const hanliEmo = self ? emo : null;
    const hKey = heroId + (hanliEmo || "");
    if (rbox.dataset.set !== hKey) {
      const hurl = (typeof Art !== "undefined") ? Art.url(heroId, hanliEmo) : null;
      if (hurl) {
        rbox.innerHTML = `<div class="pb"><img src="${hurl}" alt="韩立" /></div>`;
        rbox.dataset.set = hKey;
        if (hanliEmo) this._portraitPop(rbox);   // 换表情：小弹跳（看见变化）
      }
    }

    // 出场的对话 NPC（非旁白、非主角）→ 放左侧并记住（表情同理）
    if (who && !self) {
      let id = this._npcIdByName(who);
      if (id === "tienu" && typeof Art !== "undefined" && Art.quhunId) id = Art.quhunId();  // 曲魂→身外化身
      const url = id && typeof Art !== "undefined" ? Art.url(id, emo) : null;
      const lKey = (who || "") + (emo || "");
      if (url && st && st.leftKey !== lKey) {
        lbox.innerHTML = `<div class="pb"><img src="${url}" alt="${who}" /></div>`;
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
    if (stage && stage.id && !st.replay) State.setFlag("story_seen_" + stage.id);
    // 收束演出层：停计时、退跳过键、清交互 beat 残留
    if (this._cutTimer) { clearTimeout(this._cutTimer); this._cutTimer = null; }
    if (typeof Cutscene !== "undefined") Cutscene.clear();
    const skip = this.el("story-skip"); if (skip) skip.hidden = true;
    const cue = this.el("story-cue"); if (cue) cue.textContent = "";
    const box = this.el("story-choices");
    box.classList.remove("cut-beat-on");
    // §9-6 名场面回廊·重温落幕：不出剧情抉择（不结算、不推进指针），只给"再看/合上"
    if (st.replay) {
      box.innerHTML =
        `<div class="replay-end">名场面 · 重温毕</div>` +
        `<button class="choice" onclick="UI.replayScene('${stage.id}')">↻ 再看一次</button>` +
        `<button class="choice" onclick="UI.closeReplay()">合上回廊</button>`;
      return;
    }
    // 战斗类抉择前的「临战准备」一览——底牌随章节/境界演进（不再死盯练气期的毒草暗器）
    // ⚠ resolve:"advance" 是"纯推进"哨兵（非战斗派发），不得据此误判为战斗节点——
    //   否则闭关/叙事类节点会错挂「临战准备·硬拼九死一生」（v265 巡检实锤·闭关二十载）。
    const isFight = (stage.choices || []).some(c => c.resolve && c.resolve !== "advance");
    let prepHtml = "";
    if (isFight) {
      const items = this._fightPrepItems();        // [{id,name,n}...] 当前阶段的关键底牌
      const total = items.reduce((a, it) => a + it.n, 0);
      const kinds = items.filter(it => it.n > 0).length;
      const ready = kinds >= 2 && total >= 4;        // 至少两类底牌、合计≥4 = 充分
      const warn = total === 0;
      const hasPrep = (stage.choices || []).some(c => c.calm);
      const exForm = items.map(it => it.name).slice(0, 2).join("、") || "底牌";
      const warnNote = hasPrep ? `毫无底牌！可选「退去」备足${exForm}再战，不必硬拼` : `毫无底牌！硬拼九死一生，宜先备足${exForm}`;
      const itemsHtml = items.map(it => `<span class="fp-item">${it.name} ×${it.n}</span>`).join("");
      prepHtml = `<div class="fight-prep ${ready ? 'ok' : warn ? 'bad' : 'mid'}">
        <span class="fp-tag">临战准备</span>
        ${itemsHtml}
        <span class="fp-note">${ready ? '准备充分，可放手一搏' : warn ? warnNote : '底牌偏少，胜算有限，宜再备一些'}</span>
      </div>`;
    }
    box.innerHTML = prepHtml + (stage.choices || []).map((c, i) => {
      const lack = c.requireItem && !State.count(c.requireItem);
      return `<button class="choice${c.resolve && c.resolve !== "advance" && !c.calm ? ' choice-fight' : ''}" onclick="UI.storyChoose(${i})">
        ${c.text}${c.hint ? `<span class="c-hint">${c.hint}${lack ? '（尚缺）' : ''}</span>` : ""}
      </button>`;
    }).join("");
  },

  // 临战准备底牌清单：按章节/境界演进——练气数毒草暗器，筑基后符箓/瞬发/阵旗/法宝充能。
  //   只列"当前阶段玩家真能囤、战斗真能用"的消耗性底牌，避免"筑基修士还在数练气暗器"的错位。
  _fightPrepItems() {
    const s = State.data;
    const chap = s.activeChapter || "qixuan";
    const realm = s.realmIndex || 0;
    // 候选底牌（按出现顺序），取玩家拥有或本阶段相关的
    const cand = [];
    const push = (id) => { const it = DATA.items[id]; if (it) cand.push({ id, name: it.name, n: State.count(id) }); };
    if (chap === "qixuan" || realm < 2) {
      // 练气期：毒草 + 暗器
      push("duyao_cao"); push("anqi");
    } else if (chap === "huangfeng" || chap === "departure") {
      // 筑基前后：符箓 + 瞬发底牌（毒草暗器退居其次，仍计入若有）
      push("huoshe_fu"); push("hanbing_fu"); push("dingshen_fu"); push("huiyuan_dan");
    } else {
      // 魔道争锋 / 初入星海（筑基后期~结丹）：符箓 + 阵旗 + 瞬发 + 法宝充能
      push("huoshe_fu"); push("hanbing_fu"); push("dingshen_fu");
      push("zhenqi_juling"); push("zhenqi_kunzu"); push("jinguang_zhuan_charge"); push("huiyuan_dan");
    }
    // 兜底：若该阶段候选全无（数据缺），退回毒草暗器，至少有显示
    if (!cand.length) { push("duyao_cao"); push("anqi"); }
    // 只保留最多 4 项（界面不挤），优先有货的
    cand.sort((a, b) => (b.n > 0 ? 1 : 0) - (a.n > 0 ? 1 : 0));
    return cand.slice(0, 4);
  },

  // 选项点击：先把这段剧情沉淀到叙事日志（留痕），再关闭演出、推进
  storyChoose(i) {
    const st = this._story; if (!st) return;
    const stage = st.stage;
    if (this._titleTimer) { clearTimeout(this._titleTimer); this._titleTimer = null; }
    if (this._typeTimer) { clearInterval(this._typeTimer); this._typeTimer = null; }
    if (this._cutTimer) { clearTimeout(this._cutTimer); this._cutTimer = null; }
    // 收束演出：清计时、复位镜头、退跳过键（演出瞬态不入存档）
    if (typeof Cutscene !== "undefined") { Cutscene.clear(); Cutscene.resetCam(this._storyCtx()); }
    // 收束环境床：演出落幕即收夜色、恢复 BGM（地点级常驻留待昼夜系统接管）
    if (typeof Sfx !== "undefined" && Sfx.ambientStop) Sfx.ambientStop();
    // 收束氛围粒（B2）：演出落幕即停常驻发射器（beam 立撤、motes 自然淡出）
    if (typeof Fx !== "undefined" && Fx.ambient) Fx.ambient(null);
    const skip = this.el("story-skip"); if (skip) skip.hidden = true;
    const bg = this.el("story-bg"); if (bg) bg.classList.remove("story-cam");
    const far = this.el("story-far"); if (far) far.classList.remove("on");
    this._archiveStory(stage);
    const ovCh = this.el("story-overlay"); if (ovCh) { ovCh.hidden = true; ovCh.onclick = null; }
    document.body.classList.remove("story-on");
    this._story = null;
    Engine.chooseStory(STORY[State.data.storyStage], i);
  },

  // §9-6 名场面回廊：从风云录里点一段名场面 → 原汁原味重演那段演出（只观赏，不改剧情/不结算）。
  // 复用整套演出调度（renderStory 的 replay 路径）：镜头/立绘/特效/声/环境床/台词全数重播；
  // 交互 beat 自动演命中那一手、落幕指路跳过。重温落幕只给"再看一次/合上"。
  replayScene(id) {
    if (typeof STORY === "undefined") return;
    const stage = STORY.find(s => s && s.id === id);
    if (!stage) return;
    this.closeModal();
    // text/choices 可为函数（引擎 renderStoryStage 同款解析）——直接传原节点会让 compile 拿函数抛错
    // （v315 修：动态文案节点〔showdown/ye_finale/zaibie_open…〕此前在回廊重温会 crash）
    const sd = State.data;
    const resolved = (typeof stage.text === "function" || typeof stage.choices === "function")
      ? Object.assign({}, stage, {
          text: typeof stage.text === "function" ? stage.text(sd) : stage.text,
          choices: typeof stage.choices === "function" ? stage.choices(sd) : stage.choices,
        })
      : stage;
    this.renderStory(resolved, { replay: true });
  },

  // 重温落幕：拆演出层、收环境床/氛围粒、复位镜头，回落地点轨——绝不动剧情指针与存档。
  closeReplay() {
    if (this._titleTimer) { clearTimeout(this._titleTimer); this._titleTimer = null; }
    if (this._typeTimer) { clearInterval(this._typeTimer); this._typeTimer = null; }
    if (this._cutTimer) { clearTimeout(this._cutTimer); this._cutTimer = null; }
    if (typeof Cutscene !== "undefined") { Cutscene.clear(); Cutscene.resetCam(this._storyCtx()); }
    if (typeof Sfx !== "undefined" && Sfx.ambientStop) Sfx.ambientStop();
    if (typeof Fx !== "undefined" && Fx.ambient) Fx.ambient(null);
    const skip = this.el("story-skip"); if (skip) skip.hidden = true;
    const bg = this.el("story-bg"); if (bg) bg.classList.remove("story-cam");
    const far = this.el("story-far"); if (far) far.classList.remove("on");
    const ovRp = this.el("story-overlay"); if (ovRp) { ovRp.hidden = true; ovRp.onclick = null; }
    document.body.classList.remove("story-on");
    this._story = null;
    if (typeof Sfx !== "undefined" && Sfx.bgm) Sfx.bgm(this._bgmForLocation(State.location()));
  },

  // 把已演完的剧情正文沉淀进叙事日志（持久，可回看）
  _archiveStory(stage) {
    const s = State.data;
    const bodyHtml = (stage.text || []).map(seg => this._renderSegment(seg)).join("");
    const id = (Engine._logSeq = (Engine._logSeq || 0) + 1);
    const titleHtml = `<div class="title">${stage.title}</div>`;
    // 去重：同标题 story 条目折叠（重试战斗时同一 cutscene 不再堆叠）
    const prev = s.log.findIndex(e => e.kind === "story" && e.body && e.body.startsWith(titleHtml));
    if (prev >= 0) s.log.splice(prev, 1);
    s.log.push({ id, t: `第${s.year}年${s.month}月`, kind: "story", body: `${titleHtml}${bodyHtml}` });
    if (s.log.length > 60) s.log.shift();
    // §9-6 名场面回廊：含演出的节点同时登记进可重温列表（纯文字对白不收）
    if (typeof Cutscene !== "undefined" && Cutscene.recordScene)
      s.scenes = Cutscene.recordScene(s.scenes, stage, { t: `第${s.year}年${s.month}月` });
  },

  // 剧情演出：解析一段叙事单元（字符串=旁白；对象=对话/心理/强调/场景）
  _renderSegment(seg) {
    if (typeof seg === "string") return `<p class="seg-narr">${seg}</p>`;
    if (seg.scene) return `<div class="seg-scene">· ${seg.scene} ·</div>`;
    if (seg.aside) return `<p class="seg-aside">${seg.aside}</p>`;       // 心理独白
    if (typeof seg.beat === "string") return `<div class="seg-beat">${seg.beat || "……"}</div>`; // 停顿/留白
    if (seg.cam || seg.actor || seg.fx || seg.sfx || seg.bgm || seg.wait || seg.guide || seg.fight || seg.warp || (seg.beat && typeof seg.beat === "object")) return ""; // 演出原语/引导/坠入拍不入日志
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
      let id = self ? (Art.heroId ? Art.heroId() : "hanli") : this._npcIdByName(who);
      if (id === "tienu" && Art.quhunId) id = Art.quhunId();   // 曲魂→身外化身
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
    const extra = { "三叔": "sanshu", "铁奴": "tienu", "曲魂": "tienu", "张铁（铁奴）": "tienu", "墨彩环": "mocaihuan", "万小山": "wanxiaoshan",
      "吴师叔": "wushishu", "陆云风": "luyunfeng", "叶师叔": "yeshishu", "马师伯": "mashibo", "陈巧倩": "chenqiaoqian",
      "冯三娘": "feng_sanniang", "冯钰": "feng_sanniang", "汪凝": "wang_ning", "小紫灵": "wang_ning", "乌丑": "wuchou", "妙音门掌门": "miaoyin_zhangmen" };
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
      const wx = sp.elem || sp.school || "jin";
      const consumeName = sp.consume && DATA.items[sp.consume] ? DATA.items[sp.consume].name : null;
      const cost = (sp.mp ? `灵 ${sp.mp}` : "零耗") + (consumeName ? ` · 耗${consumeName}` : "");
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

  /* -------- 法宝阁（装备位一览：主攻/护身/饰物 三槽 + 伴身N + 悬浮）--------
   * 法宝三位制（v96）的一站式管理面板：原先只能在背包逐件穿戴、伴身件无处卸、
   * 悬浮位无处看——此处一眼看全各位所驭、所授战技、槽数上限，就地装/卸。
   * 复用现成 Engine.equipGear/unequipGear/unequipSideTreasure/toggleBenchTreasure，零新机制。 */
  openTreasury() {
    const s = State.data;
    const SP = (typeof CombatAPI !== "undefined") ? CombatAPI.SPELLS : {};
    const playerLayer = State.gateLayer();
    const NAMES = { hpMax: "气血上限", moodMax: "心境上限", sense: "神识", body: "体魄",
                    speed: "遁速", armor: "护体", regenBoost: "回灵", mpMax: "灵力上限" };
    const ownedOfSlot = (slot) => Object.keys(DATA.gear)
      .filter(id => DATA.gear[id].slot === slot && State.count(id) > 0);

    const gearCard = (id, equipped) => {
      const g = DATA.gear[id]; if (!g) return "";
      const item = DATA.items[id];
      const name = item ? item.name : id;
      const wx = { weapon: "jin", armor: "tu", accessory: "shui", side: "mu" }[g.slot] || "jin";
      const can = !g.minLayer || playerLayer >= g.minLayer;
      const bonusTxt = g.bonus ? Object.entries(g.bonus).map(([k, v]) => `${NAMES[k] || k}+${v}`).join("　") : "";
      const spellsTxt = (g.grantSpells || []).map(sk => SP[sk] ? SP[sk].name : sk).join("、");
      let btns = "";
      if (equipped) {
        if (g.slot === "side") btns += `<button class="btn btn-mini ghost" onclick="UI._treasuryUnequipSide('${id}')">收起</button>`;
        else btns += `<button class="btn btn-mini ghost" onclick="UI._treasuryUnequip('${g.slot}')">卸下</button>`;
        (g.grantSpells || []).forEach(sk => {
          const benched = (s.benchTreasures || []).includes(sk);
          const skName = SP[sk] ? SP[sk].name : sk;
          btns += `<button class="btn btn-mini" onclick="UI._treasuryBench('${sk}')">${benched ? `「${skName}」复出战` : `收起「${skName}」`}</button>`;
        });
      } else if (can) {
        btns += `<button class="btn btn-mini" onclick="UI._treasuryEquip('${id}')">装备</button>`;
      } else {
        const mpMul = (typeof Balance !== "undefined") ? Balance.gearLayerMpMul(playerLayer, g.minLayer) : 1;
        btns += `<button class="btn btn-mini" onclick="UI._treasuryEquip('${id}')">越阶装备（灵力×${mpMul.toFixed(1)}）</button>`;
      }
      return `<div class="tech-item ${equipped ? 'current' : ''}">
        <div class="tech-head"><span class="seal wx-${wx}">${sealChar(name)}</span><b>${name}</b>${equipped ? '<span class="tech-cur">已驭</span>' : ''}</div>
        ${bonusTxt ? `<div class="tech-skills">属性：${bonusTxt}</div>` : ""}
        ${spellsTxt ? `<div class="tech-skills" style="color:var(--gold)">战斗技：${spellsTxt}</div>` : ""}
        ${(g.traits || []).map(t => `<div class="tech-desc" style="color:var(--ink-dim)">特性：${t.desc}</div>`).join("")}
        <div class="tech-btns">${btns}</div>
      </div>`;
    };
    const emptyRow = (txt) => `<div class="tech-item"><div class="tech-desc" style="color:var(--ink-faint)">${txt}</div></div>`;

    // 三固定槽：主攻(weapon)/护身(armor)/饰物(accessory)
    const fixedSlot = (slot, label, sub, emptyHint) => {
      const equippedId = s.gear ? s.gear[slot] : null;
      const owned = ownedOfSlot(slot);
      let body = "";
      if (equippedId) body += gearCard(equippedId, true);
      owned.filter(id => id !== equippedId).forEach(id => { body += gearCard(id, false); });
      if (!equippedId && owned.length === 0) body += emptyRow(`此位空置${emptyHint ? `——${emptyHint}` : ""}`);
      return `<h3 class="panel-title">${label}<span style="color:var(--ink-faint);font-size:12px;font-weight:400">　${sub}</span></h3>${body}`;
    };

    // 伴身位（被动·零操作）：槽数=神识档
    const sideCap = State.sideTreasureSlots();
    const sideEquipped = (s.sideTreasures || []);
    const ownedSide = ownedOfSlot("side");
    let sideBody = "";
    sideEquipped.forEach(id => { sideBody += gearCard(id, true); });
    ownedSide.filter(id => !sideEquipped.includes(id)).forEach(id => { sideBody += gearCard(id, false); });
    if (sideEquipped.length === 0 && ownedSide.length === 0) sideBody += emptyRow("尚无伴身法宝");

    // 悬浮位（战斗内祭起·自动运转·抽灵力）：上限随神识（境界）增
    const tier = (typeof Chapters !== "undefined" && Chapters.realmTier) ? Chapters.realmTier() : 0;
    const floatCap = 1 + Math.max(0, tier - 1);
    const floatGear = Object.keys(DATA.gear).filter(id => State.count(id) > 0
      && (DATA.gear[id].grantSpells || []).some(sk => SP[sk] && SP[sk].type === "float"));
    let floatBody = "";
    floatGear.forEach(id => { floatBody += gearCard(id, s.gear && Object.values(s.gear).includes(id)); });
    if (floatGear.length === 0) floatBody += emptyRow("尚无可祭起的悬浮法宝——驭物类法宝得自后续篇章");

    this.openModal(`
      <h2>法宝 · 装备位</h2>
      <p style="color:var(--ink-dim);font-size:12px">法宝分位而驭：主攻、护身贴身随役，授你战斗手段；饰物温养己身；伴身法宝悬于周身、被动生效不必分神；悬浮法宝则于战中祭起、自行运转。神识越宏，能并驭的伴身/悬浮越多。</p>

      ${fixedSlot("weapon", "主攻位", "兵器·授战斗法宝技", "万宝楼二层有售")}
      ${fixedSlot("armor", "护身位", "御·护体法宝", "")}
      ${fixedSlot("accessory", "饰物位", "随身·被动温养", "")}

      <h3 class="panel-title">伴身位<span style="color:var(--ink-faint);font-size:12px;font-weight:400">　${sideEquipped.length}/${sideCap} · 被动·零操作（槽数随神识/大衍诀）</span></h3>
      ${sideBody}

      <h3 class="panel-title">悬浮位<span style="color:var(--ink-faint);font-size:12px;font-weight:400">　上限 ${floatCap} · 战斗内点卡祭起、可随时收回</span></h3>
      ${floatBody}

      <div class="modal-actions"><button class="btn btn-ghost" onclick="UI.closeModal()">收起</button></div>
    `);
  },
  _treasuryEquip(id) { Engine.equipGear(id); this.openTreasury(); },
  _treasuryUnequip(slot) { Engine.unequipGear(slot); this.openTreasury(); },
  _treasuryUnequipSide(id) { Engine.unequipSideTreasure(id); this.openTreasury(); },
  _treasuryBench(sk) { Engine.toggleBenchTreasure(sk); this.renderAll(); this.openTreasury(); },

  /* -------- 侧位·驭物（张铁尸傀强化；通用界面，灵宠/傀儡后续复用）-------- */
  openSideUnit() {
    const s = State.data;
    const u = s.sideUnit;
    if (!u) return;
    const spec = Engine.sideEnhSpec(u);
    const lv = u.enhLv || 0;
    const maxed = lv >= spec.maxLv;
    const broken = u.status === "broken";
    const per = u.persona || { aggr: 3, prot: 9, kite: 0 };
    const personaTxt = per.prot >= per.aggr ? "护主为先——挡在你身前，不抢攻、不惜残躯" : "悍勇当先——扑入敌阵撕咬厮杀";

    let enhBox;
    if (maxed) {
      enhBox = `<div class="side-enh maxed"><div class="se-row"><b>${spec.track} Lv.${lv}</b><span style="color:var(--gold)">已至极限</span></div>
        <div class="se-cost">${spec.capNote}</div></div>`;
    } else {
      const next = lv + 1;
      const cost = spec.cost(next), gain = spec.gain(next);
      const affordable = Object.keys(cost).every(k => State.count(k) >= cost[k]);
      const costTxt = Object.keys(cost).map(k => {
        const have = State.count(k), need = cost[k];
        return `<span class="${have >= need ? '' : 'lack'}">${(DATA.items[k] || {}).name || k} ${have}/${need}</span>`;
      }).join("　");
      const gtxt = `气血上限+${gain.hpMax || 0}、攻+${gain.atk || 0}${gain.guard ? `、御+${Math.round(gain.guard * 100)}%` : ""}`;
      const ready = affordable && !broken;
      enhBox = `<div class="side-enh">
        <div class="se-row"><b>${spec.track}</b><span style="color:var(--ink-dim)">Lv.${lv} → Lv.${next} （上限 ${spec.maxLv}）</span></div>
        <div class="se-gain">本次精进：${gtxt}</div>
        <div class="se-cost">耗 ${costTxt}　·　历时一月</div>
        <button class="btn ${ready ? 'btn-primary' : ''}" ${ready ? '' : 'disabled'} onclick="UI._sideEnhance()">${broken ? '须先修缮' : spec.track}</button>
      </div>`;
    }
    const stat = broken ? `<span style="color:var(--red)">损毁待修</span>` : `${u.hp}/${u.hpMax}`;
    const repairBtn = (broken || u.hp < u.hpMax) ? `<button class="btn btn-secondary" onclick="UI._sideRepair()">修缮（毒草×2 · 一月）</button>` : "";
    const carryBtn = `<button class="btn btn-ghost" onclick="UI._sideToggle()">${u.carry === false ? "令其随行出战" : "留守药庐"}</button>`;

    this.openModal(`
      <h2>⚰ ${u.name}</h2>
      <p style="color:var(--ink-dim);font-size:12px">曲魂幡所御——挚友之蜕，随你出战。逐月温养可固其躯、增其力（历练与遭遇战自动随行）。</p>
      <div class="status-strip">
        <span>气血 <b>${stat}</b></span>
        <span>攻 <b>${u.atk}</b></span>
        <span>御 <b>${Math.round((u.guard || 0.3) * 100)}%</b></span>
        <span>状态 <b>${u.carry === false ? "留守" : "随行"}</b></span>
      </div>
      <p style="color:var(--ink-faint);font-size:12px;margin:6px 0">招式：${u.atkName || "挥击"}　·　性情：${personaTxt}</p>
      ${enhBox}
      <div class="modal-actions">${repairBtn}${carryBtn}<button class="btn btn-ghost" onclick="UI.closeModal()">收起</button></div>
    `);
  },
  _reopenSideUnit() {
    const s = State.data;
    if (s.sideUnit && !s.combat && !s.pendingEvent) this.openSideUnit();
    else this.closeModal();
  },
  _sideEnhance() { Engine.enhanceSideUnit(); this._reopenSideUnit(); },
  _sideRepair() { Engine.repairSide(); this._reopenSideUnit(); },
  _sideToggle() { Engine.toggleSide(); this._reopenSideUnit(); },

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
    // 与 Engine.cultivate 同构的主干估算（洞府/阵法等乘区从简——预估值允许略保守）
    const estRealmMul = Balance.culGainMul(s.realmIndex) * (s.activeChapter === "qixuan" ? 1 : 1.5)
      * (s.flags.dongfu_type === "lingquan" ? 1.15 : 1);
    const perMonth = Math.max(1, Math.round(base * root.cul * moodFactor * demonPenalty * estRealmMul));
    const toFull = Math.max(0, realm.culMax - s.cultivation);

    // M6·兼修方向（Build 三路时间互斥的闭关切口）：纯粹吐纳 / 兼修剑意 / 兼修药理 / 兼修制符——
    // 兼修=主修吐纳×0.85 + 副轴按月入账（副轴积累慢于专职行动，但闭关期不再"颗粒无收"）
    const focus = this._seclusionFocus || null;
    const focusMul = focus ? 0.85 : 1;
    const focusOpts = [{ id: null, label: "纯粹吐纳", note: "修为全额" }];
    if (s.spells && s.spells.includes("zhayan") && !s.swordMastery) {
      focusOpts.push({ id: "sword", label: "兼修剑意", note: "修为×0.85 · 剑意+1/月" });
    }
    focusOpts.push({ id: "alchemy", label: "兼修药理", note: "修为×0.85 · 药理+1/3月" });
    if ((s.skills && s.skills.fulu > 0) || (s.fuluPlans || []).length) {
      focusOpts.push({ id: "fulu", label: "兼修制符", note: "修为×0.85 · 制符+1/3月" });
    }
    const focusHtml = focusOpts.length > 1 ? `
      <h3 class="panel-title" style="margin-top:4px">闭关方向 <span style="color:var(--ink-faint);font-size:11px;letter-spacing:0">同一程闭关只能推一条轴</span></h3>
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px">
        ${focusOpts.map(f => `<button class="btn btn-mini ${focus === f.id ? "btn-primary" : "btn-ghost"}"
          onclick="UI._seclusionFocus=${f.id ? `'${f.id}'` : "null"}; UI.openSeclusion();">${f.label}<span style="font-size:10px;opacity:.75">　${f.note}</span></button>`).join("")}
      </div>` : "";
    const focusArg = focus ? `'${focus}'` : "null";
    const need = perMonth > 0 ? Math.ceil(toFull / Math.max(1, Math.round(perMonth * focusMul))) : 99;
    const opts = [
      { m: 1, label: "闭关一月", note: "浅尝即止" },
      { m: 6, label: "闭关半年", note: "稳步精进" },
      { m: 12, label: "闭关一年", note: "潜心苦修" },
      { m: 36, label: "闭关三年", note: "心无旁骛，岁月如梭" },
    ];
    const optHtml = opts.map(o =>
      `<button class="btn btn-secondary" style="text-align:left" onclick="UI.closeSheet(); Engine.doCultivate(${o.m}, ${focusArg});">
        ${o.label}　<span style="color:var(--ink-dim);font-size:12px">预计修为+${Math.round(perMonth * o.m * focusMul)}　${o.note}</span>
      </button>`
    ).join("");
    // 一键闭关至本层圆满（省去反复点击，但插曲/耗时照常结算）
    const toFullBtn = (toFull > 0 && need > 0 && need < 200)
      ? `<button class="btn btn-primary" onclick="UI.closeSheet(); Engine.doCultivate(${need}, ${focusArg});">闭关至本层圆满　<span style="font-size:12px;opacity:.85">约 ${need} 月</span></button>`
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
            <button class="btn btn-mini" onclick="UI.closeSheet(); Engine.studyTechnique('${id}');">研习（3月）</button>
          </div>`;
        }).join("")}
      </div>` : "";

    // 参研功法层（升层肝条）：主修功法可推进下一层时显示——逐层解锁新战技（technique-tiers §5.2）
    const ref = Engine.refinableMain ? Engine.refinableMain() : null;
    const refineHtml = ref ? `
      <h3 class="panel-title" style="margin-top:10px">参研功法层</h3>
      <div class="study-list">
        <div class="study-item">
          <div><div class="si-name">${ref.name} · 第 ${ref.cur} → ${ref.next} 层 <span style="color:var(--gold);font-size:11px">上限 ${ref.max} 层</span></div>
          <div class="si-meta">闭关参研、将功法推进一层；达标层数解锁新战技，同系法术威力随层渐涨。耗修为 ${ref.cultCost}。</div></div>
          <button class="btn btn-mini" onclick="UI.closeSheet(); Engine.refineLayer('${ref.techId}');">参研（${ref.months}月）</button>
        </div>
      </div>` : "";

    this.openSheet(`
      <h2>闭关修炼</h2>
      ${this._statusStrip()}
      <p style="color:var(--ink-dim)">于修仙者而言，光阴最是宝贵，也最不值钱。闭得越久，修为越深，可寿元、心境亦在流逝。
      当前每月约可精进修为 ${Math.round(perMonth * focusMul)}；距本层圆满约需 <b style="color:var(--gold)">${need}</b> 月。
      <span style="color:var(--ink-faint);font-size:12px">静室之中自会张弛有度——心浮气躁时停功调息几月再续（额外耗时，结算时如实报账）。</span></p>
      ${focusHtml}
      <div class="modal-actions">
        ${toFullBtn}
        ${optHtml}
        <button class="btn btn-ghost" onclick="UI.closeSheet()">再想想</button>
      </div>
      ${refineHtml}
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
      // polish-huangfeng B1②：余丹加持可见（准备的每一项都看得见）
      let extraNote = "";
      if (rite.extra) {
        const have = State.count(rite.extra.id);
        const nm = (DATA.items[rite.extra.id] || {}).name || rite.extra.id;
        const use = Math.min(rite.extra.max || 3, Math.max(0, have - 1));
        extraNote = have > 1
          ? `<div class="prep-row"><span>余丹加持（每关叠服至多 ${rite.extra.max || 3} 颗）</span><span class="ok">「${nm}」余 ${have - 1}，此关将叠服 ${use}——瓶颈更薄、道心更厚、成色更足</span></div>`
          : `<div class="prep-row"><span>余丹加持</span><span style="color:var(--ink-dim)">仅此一颗——若有余丹叠服，此关可更稳（地火之屋的那一炉，颗颗都算数）</span></div>`;
      }
      this.openModal(`
        <h2>大境界 · ${rite.name || nextRealm.name}</h2>
        <p style="color:var(--ink-dim)">${rite.intro || "大境界之关，须十足准备，并历一场凶险心魔劫。"}</p>
        <div class="prep-list">
          ${riteChk.items.map(p => `<div class="prep-row"><span>${p.label}</span><span class="${p.ok ? 'ok' : 'no'}">${p.ok ? '✓ 就绪' : '✗ 不足'}</span></div>`).join("")}
          ${extraNote}
        </div>
        <p style="color:var(--red);font-size:12px;margin-top:8px">⚠ 渡劫凶险：心魔劫远胜寻常心战，败则重创、心魔暴涨——但根基与大半修为可保（屡败弥坚，余丹留得住再冲之资）。</p>
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
    const pity = s.btPity || 0;
    const threshold = Balance.demonTrialThreshold() + Math.floor(pity / 3) * 15;
    const demonHigh = s.demon > threshold;

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

  /* -------- 小绿瓶弹窗（随身灵圃 v2：随身唤出 + 多灵草谱） -------- */
  showBottleButton() { this.renderTopbar(); this.renderActions(); },
  openBottle() {
    const s = State.data;
    if (s.combat) { this.toast("激战正酣，无暇打理小瓶"); return; }
    if (s.exmap) { this.toast("秘境之中，且先脱身再说"); return; }
    if (s.pendingEvent) { this.toast("眼下有要事待决，无心摆弄小瓶"); return; }
    if (!(s.bottle && s.bottle.unlocked)) return;
    this.renderBottleModal();
  },
  renderBottleModal() {
    const s = State.data;
    const realmIdx = s.realmIndex || 0;
    const plotsHtml = s.bottle.plots.map((p, i) => {
      if (!p.crop) {
        const seeds = [];
        let lockedNote = "";
        Object.keys(DATA.bottle.crops).forEach(cid => {
          const c = DATA.bottle.crops[cid];
          if (!State.count(c.seed)) return;
          if (c.gateFlag && !(s.flags && s.flags[c.gateFlag])) return;   // 里程碑解锁的专属谱（如丹道·自炼凝神丹）
          if (realmIdx < (c.minRealmIdx || 0)) {
            lockedNote = `<div class="pstat">境界既高，更多灵草谱自现</div>`;
            return;
          }
          seeds.push(`<button class="btn btn-mini" title="${c.use || ""}" onclick="Engine.plantCrop(${i},'${cid}'); UI.renderBottleModal();">种：${c.name}</button>`);
        });
        return `<div class="plot"><div class="pinfo"><div class="pname">空地块</div><div class="pstat">可投入原料培育</div></div><div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end">${seeds.join("") || '<span class="pstat">无可种原料</span>'}${lockedNote}</div></div>`;
      }
      const crop = DATA.bottle.crops[p.crop];
      const ready = p.growth >= 100;
      // polish A7④：成品是丹药→「收下即服」一键连招（收获+嗑药少跨一个背包界面）
      const isPill = ((DATA.items[crop.matureItem] || {}).type === "pill");
      return `<div class="plot">
        <div class="pinfo"><div class="pname">${crop.name}</div><div class="pstat">成熟度 ${Math.round(p.growth)}%${crop.use ? ` · ${crop.use}` : ""}</div></div>
        ${ready
          ? `<span style="display:flex;gap:6px">${isPill ? `<button class="btn btn-mini btn-primary" onclick="Engine.harvestCrop(${i},true); UI.renderBottleModal();">收下即服</button>` : ""}<button class="btn btn-mini" onclick="Engine.harvestCrop(${i}); UI.renderBottleModal();">收入囊中</button></span>`
          : `<span class="pstat" style="white-space:nowrap">培育中…</span>`}
      </div>`;
    }).join("");

    // polish Q2：账面可见——把嗑药线的账常驻算在瓶口（灵药丹 cul60 vs 闭关月均，玩家一眼见高下）
    let ledgerLine = "";
    {
      const perMonth = Math.round((14 + (s.sense || 0) * 0.4) * ((DATA.spiritRoots.find(r => r.id === s.rootId) || {}).mod || 0.9));
      const pending = s.bottle.plots.reduce((acc, p) => {
        if (!p.crop) return acc;
        const eff = (DATA.items[(DATA.bottle.crops[p.crop] || {}).matureItem] || {}).effect;
        return acc + ((eff && eff.cul) || 0) * ((DATA.bottle.crops[p.crop] || {}).yield || 1);
      }, 0);
      if (pending > 0) {
        ledgerLine = `<div class="pstat" style="margin:2px 0 6px;color:var(--gold)">瓶中之物若成：预计修为 +${pending}（顶你闭关 ${Math.max(1, Math.round(pending / Math.max(1, perMonth)))} 个月）——闭关时亦会自动半速滴灌。</div>`;
      } else if (State.count("lingcao") > 0) {
        ledgerLine = `<div class="pstat" style="margin:2px 0 6px;color:var(--gold)">囊中灵草 ×${State.count("lingcao")}——种下催熟成灵药丹，一丹抵闭关数月：这条路快过闭死关。</div>`;
      }
    }
    this.openModal(`
      <h2>神秘小绿瓶 · 随身灵圃</h2>
      <p style="color:var(--ink-dim)">随身可唤，何处皆可打理。滴入神秘绿液催熟瓶中草木——同一株灵草，循不同谱法可育出灵药、凝神丹乃至千年灵草；境界既高，更有灵石难求之物自现。此乃你逆天改命的本钱，切莫示人。</p>
      ${ledgerLine}
      <div class="bottle-plots">${plotsHtml}</div>
      <div class="modal-actions">
        <button class="btn btn-primary" onclick="Engine.tendBottle(); UI.renderBottleModal();">滴绿液催熟（耗时）</button>
        <button class="btn btn-ghost" onclick="UI.closeModal()">盖上瓶塞</button>
      </div>
    `);
  },
  renderBottle() { /* 兼容入口：弹窗开启时刷新 */ if (!this.el("modal-overlay").hidden) this.renderBottleModal(); },

  /* -------- 制符台弹窗（符箓自制 v2：有方案 + 符纸 + 灵力即成） -------- */
  openFuluCraft() {
    const s = State.data;
    if (!Engine.hasFuluTable()) { this.toast("尚无制符笔，开不得制符台"); return; }
    const realm = State.realm();
    const spMax = realm ? realm.spMax : 0;
    const fulu = (s.skills && s.skills.fulu) || 0;
    const paper = State.count("fu_zhi");
    const rate = Math.round(Math.min(0.97, 0.6 + fulu * 0.02 + (s.insight || 0) * 0.01) * 100);
    const plans = (s.fuluPlans || []).filter(id => DATA.fuluPlans[id]);
    const rows = plans.map(id => {
      const plan = DATA.fuluPlans[id];
      const paperN = plan.paperN || 1;
      const can = paper >= paperN && s.spirit >= plan.spirit;
      const item = DATA.items[plan.result];
      return `<div class="plot">
        <div class="pinfo"><div class="pname">${plan.name}</div>
          <div class="pstat">产「${item.name}」 · 耗 符纸×${paperN} + 灵力 ${plan.spirit}</div>
          <div class="pstat" style="color:var(--ink-dim)">${plan.blurb}</div></div>
        <button class="btn btn-mini${can ? " btn-primary" : ""}" ${can ? "" : "disabled"} onclick="Engine.makeFulu('${id}')">运笔成符</button>
      </div>`;
    }).join("");

    this.openModal(`
      <h2>制符台 ✎</h2>
      <p style="color:var(--ink-dim)">有方案、有符纸、有灵力，便可运笔成符——制符术越精，成符愈稳、偶得双张。符纸于太南小会购置。</p>
      <div class="pstat" style="margin:4px 0 8px">符纸 ×${paper} · 灵力 ${Math.round(s.spirit)}/${spMax} · 制符术 ${fulu}（约 ${rate}% 成）</div>
      <div class="bottle-plots">${rows || '<div class="plot"><span class="pstat">尚未参透任何符箓方案——可于太南小会购符谱，或寻故人相授。</span></div>'}</div>
      <div class="modal-actions">
        <button class="btn btn-ghost" onclick="UI.closeModal()">收笔</button>
      </div>
    `);
  },

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
    // P3：旅途每月行动面板走底部 sheet——上半屏地图与头像移动保持可见（旅途"走"被看见）。
    // 奇遇/旅途事件仍走全屏 modal（有叙事重量）。
    if (f.journeyPanel) {
      this.openSheet(`
        <div class="fortune-tag" style="border-color:var(--jade);color:var(--jade)">旅 途</div>
        <h2>${f.title}</h2>
        <p style="color:var(--ink-dim);font-size:13px">${f.text}</p>
        <div class="choices" style="margin-top:10px">${choices}</div>
      `, { lock: true });
      return;
    }
    this.openModal(`
      <div class="fortune-tag">奇 遇</div>
      <h2>${f.title}</h2>
      <p>${f.text}</p>
      <div class="choices" style="margin-top:14px">${choices}</div>
    `);
  },

  // P3：旅途走段的"移动一拍"——先确保地图可见并让头像沿路线滑行，稍候再弹行动面板。
  _journeyReveal(openPanel) {
    const s = State.data;
    const canvas = this.el("worldmap-canvas");
    if (!s || !s.journey || !canvas) { openPanel(); return; }
    if (canvas.hidden) this._enterJourneyMap();
    else this.renderWorldmap();   // 重投影：头像 left/top 变化吃 CSS 过渡=滑行
    clearTimeout(this._journeyRevealT);
    this._journeyRevealT = setTimeout(openPanel, 950);
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

  // 交互结算页：选择的后果就地看清（黑箱结算是体验大忌——结果只进日志=「点了没反应」）
  showInteractionResult(title, r) {
    const tone = r.kind === "bad" ? "var(--red)" : r.kind === "good" ? "var(--jade-bright)" : "var(--ink)";
    this.openModal(`
      <div class="fortune-tag" style="border-color:var(--blue);color:var(--blue)">${title} · 事毕</div>
      <p style="color:${tone};line-height:1.8;margin-top:10px">${r.text}</p>
      <div class="modal-actions"><button class="btn btn-primary" onclick="UI.closeModal()">知道了</button></div>
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

  /* -------- 道途名帖（M6·分享卡）：canvas 手绘水墨名帖——境界/年岁/名望/此生几桩，长按即存、发予道友 -------- */
  openShareCard() {
    const s = State.data;
    if (!s) return;
    const realm = (State.realm && State.realm()) ? State.realm().name : "凡夫";
    const W = 750, H = 1000;
    const cv = document.createElement("canvas");
    cv.width = W; cv.height = H;
    const g = cv.getContext("2d");
    const FONT = '"Kaiti SC","STKaiti","KaiTi","Noto Serif SC",serif';

    // 宣纸底：米色渐变 + 四角暗角
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#efe5cd"); bg.addColorStop(0.55, "#e9dcbe"); bg.addColorStop(1, "#e0d0ac");
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    const vg = g.createRadialGradient(W / 2, H / 2, H * 0.32, W / 2, H / 2, H * 0.75);
    vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(60,40,16,0.18)");
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
    // 双重边框：外墨内金
    g.strokeStyle = "rgba(58,42,20,.75)"; g.lineWidth = 5; g.strokeRect(26, 26, W - 52, H - 52);
    g.strokeStyle = "rgba(150,110,42,.6)"; g.lineWidth = 1.5; g.strokeRect(40, 40, W - 80, H - 80);

    // 题头
    g.fillStyle = "rgba(90,66,30,.85)"; g.font = `26px ${FONT}`; g.textAlign = "center";
    g.fillText("凡 人 修 仙 传 · 人 界 篇", W / 2, 96);
    g.fillStyle = "#3a2a14"; g.font = `bold 64px ${FONT}`;
    g.fillText("道 途 名 帖", W / 2, 178);
    g.strokeStyle = "rgba(150,110,42,.5)"; g.lineWidth = 1;
    g.beginPath(); g.moveTo(140, 206); g.lineTo(W - 140, 206); g.stroke();

    // 道号 + 境界
    g.fillStyle = "#2c1f0e"; g.font = `bold 56px ${FONT}`;
    g.fillText(s.name || "韩立", W / 2, 292);
    g.fillStyle = "#8a5a18"; g.font = `bold 38px ${FONT}`;
    g.fillText(realm, W / 2, 348);
    const fame = s.fame || 0;
    const fameTxt = fame >= 30 ? "威名赫赫" : fame >= 12 ? "薄有名声" : fame > 0 ? "籍籍之间" : "默默无名";
    g.fillStyle = "rgba(90,66,30,.8)"; g.font = `26px ${FONT}`;
    g.fillText(`${s.age || 13} 岁 · 修行 ${s.year || 1} 载 · ${fameTxt}`, W / 2, 396);

    // 此生几桩（按分量取前 6，时序排）
    const KIND_RANK = { breakthrough: 5, bigitem: 4, showdown: 4, medal: 3, story: 2, deed: 1, minor: 0 };
    const KIND_ICON = { breakthrough: "▲", bigitem: "◆", showdown: "⚔", medal: "★" };
    const ms = (s.milestones || []).slice();
    const top = ms.map((m, i) => ({ m, i }))
      .sort((a, b) => ((KIND_RANK[b.m.kind] || 0) - (KIND_RANK[a.m.kind] || 0)) || (b.i - a.i))
      .slice(0, 6).sort((a, b) => a.i - b.i).map(x => x.m);
    g.fillStyle = "rgba(90,66,30,.7)"; g.font = `24px ${FONT}`;
    g.fillText("—— 此 生 几 桩 ——", W / 2, 468);
    g.textAlign = "left";
    let y = 522;
    if (top.length) {
      for (const m of top) {
        let t = `${KIND_ICON[m.kind] || "·"} ${m.title}`;
        if (t.length > 22) t = t.slice(0, 22) + "…";
        g.fillStyle = "#3a2a14"; g.font = `27px ${FONT}`;
        g.fillText(t, 110, y);
        g.fillStyle = "rgba(120,95,55,.7)"; g.font = `18px ${FONT}`;
        g.fillText(m.t || "", 110, y + 26);
        y += 66;
      }
    } else {
      g.fillStyle = "rgba(90,66,30,.6)"; g.font = `26px ${FONT}`; g.textAlign = "center";
      g.fillText("道途尚浅，来日方长。", W / 2, 540);
      g.textAlign = "left";
    }

    // 落款 + 朱印
    g.textAlign = "center";
    g.fillStyle = "rgba(90,66,30,.75)"; g.font = `24px ${FONT}`;
    g.fillText(`第 ${s.year || 1} 年 ${s.month || 1} 月 谨记`, W / 2, H - 96);
    const sx = W - 168, sy = H - 208, sw = 96;
    g.fillStyle = "rgba(172,44,32,.88)";
    g.fillRect(sx, sy, sw, sw);
    g.fillStyle = "#f3e4d0"; g.font = `bold 40px ${FONT}`;
    const nm = (s.name || "韩立");
    g.fillText(nm[0] || "韩", sx + sw / 2, sy + 44);
    g.fillText(nm[1] || "立", sx + sw / 2, sy + 84);

    const url = cv.toDataURL("image/png");
    this.openModal(`
      <h2>道途名帖</h2>
      <p style="color:var(--ink-dim);font-size:12px">长按图片保存，发予道友——你走过的道，值得被看见。</p>
      <img src="${url}" alt="道途名帖" style="width:100%;border-radius:8px;border:1px solid var(--border)">
      <div class="modal-actions">
        <a class="btn btn-secondary" href="${url}" download="daotu-mingtie.png">保存图片</a>
        <button class="btn btn-ghost" onclick="UI.closeModal()">收起</button>
      </div>
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
    // 道途年表：你亲手挣来的每一步（投入有形化）
    const KIND_ICON = { breakthrough: "▲", bigitem: "◆", showdown: "⚔", medal: "★", deed: "·" };
    const ms = (s.milestones || []).slice().reverse();
    const msHtml = ms.length
      ? ms.map(m => `<div class="chron-item breakthrough"><span class="chron-t">${m.t}</span><b>${KIND_ICON[m.kind] || "·"} ${m.title}</b></div>`).join("")
      : `<div class="inv-empty">道途尚浅，来日方长。</div>`;
    // 前路：已知的未来=明牌的惦记（动漫党的欲望地图，只示意不剧透）
    // 前路·已知的远方（明牌惦记）：达成线随境界/篇章推进点亮，远处目标始终保留 ≥2 个未达成的"望山"
    // ——杜绝"已结丹却仍显黄枫谷筑基之路·前路遥遥"的过时惦记（三层惦记不空·上层须随进度刷新）。
    const ri = s.realmIndex || 0;
    const f = s.flags || {};
    const AHEAD = [
      { title: "眨眼剑法 · 大成", done: () => s.swordMastery },
      { title: "练气七层 · 七玄门圆满", done: () => ri >= 6 },
      { title: "升仙令 · 离门赴黄枫谷", done: () => f.arc1_complete },
      { title: "三段筑基 · 凝就道基", done: () => ri >= 13 },
      { title: "《青元剑诀》· 剑修主修", done: () => !!(s.techLayers && s.techLayers.qingyuan_sword) },
      { title: "魔道争锋 · 京城血夜", done: () => f.arc3_complete, far: !(f.modao_invasion || f.yanjia_summoned) },
      { title: "再别天南 · 重渡星海", done: () => f.arc4_complete, far: !f.arc3_complete },
      { title: "初入星海 · 金丹大成", done: () => f.arc5_complete || ri >= 17, far: !(f.jiedan_complete || f.starsea_entered || f.arc4_complete) },
      { title: "青竹蜂云剑 · 大庚剑阵", done: () => false, far: true },
      { title: "元婴之路 · 问鼎天南", done: () => false, far: true },
    ];
    const aheadDone = AHEAD.map(a => !!a.done());
    // 单调性守卫：这些是大致按时序的里程碑——达成了后程，必然走过前程。
    // 反向回填：任一后项已达成，则其之前各项一并视作已达成（杜绝"再别天南✦ 却 魔道争锋○"的乱序）。
    for (let i = aheadDone.length - 2; i >= 0; i--) {
      if (aheadDone[i + 1]) aheadDone[i] = true;
    }
    const aheadHtml = AHEAD.map((a, i) => {
      const ok = aheadDone[i];
      return `<div class="chron-item ${ok ? 'breakthrough' : ''}" style="${ok ? '' : 'opacity:.55'}">
        ${ok ? "✦ " : "○ "}<b>${a.title}</b>${ok ? '<span style="color:var(--jade-bright);font-size:11px;margin-left:6px">已达成</span>' : (a.far ? '<span style="color:var(--ink-faint);font-size:11px;margin-left:6px">前路遥遥</span>' : '')}
      </div>`;
    }).join("");
    // 风云榜：彩霞山一带的座次（石碑）——名声是挣来的，名字是事迹堆出来的
    // 自身头衔随境界/篇章刷新（杜绝"金丹大成仍挂七玄门·药师"的过时名牌·上层惦记须随进度刷新）
    const meTier = (State.realm && State.realm()) ? State.realm().tier : "qi";
    const meTitle = s.flags.arc1_complete
      ? (meTier === "core" ? "金丹散修 · 江湖称尊" : meTier === "foundation" ? "筑基散修 · 游历天南" : "游方散修 · 离了彩霞山")
      : (s.flags.is_modafu ? "七玄门 · 药师" : "七玄门 · 记名弟子");
    // 离了彩霞山后，这方石碑只是"当年旧座次"——明牌这块榜的时效，不冒充当下天下名次
    const boardStale = !!s.flags.arc1_complete;
    const deadIds = { jinguang: s.flags.jinguang_dead, modafu: s.flags.modafu_dead };
    let board = (typeof WORLD !== "undefined" && WORLD.fameBoard ? WORLD.fameBoard : []).map(f => ({
      name: f.name, title: f.title, fame: f.fame, note: f.note, dead: !!deadIds[f.id],
    }));
    // 夺名赛道：世间散修（npcFates）也在座次上——他们的名头按境界折算（名实一致），
    // 且个个可下战书（当众比斗·胜则扬名）。剧情人物不入赛道（命运忠于动漫）。
    if (!boardStale && (s.npcFates || []).length && typeof Engine !== "undefined" && Engine.fameOfNpc) {
      s.npcFates.forEach(f => {
        if (f.status !== "alive") return;
        board.push({
          name: f.name, title: `${NPCSIM.realmName(f.realm)} · 散修`, fame: Engine.fameOfNpc(f),
          duelId: f.id, won: !!s.flags[`duel_won_${f.id}`],
        });
      });
    }
    if ((s.fame || 0) > 0) board.push({ name: s.name, title: meTitle, fame: s.fame, note: "事迹渐传，名声渐起。", me: true });
    board.sort((a, b) => (b.fame - a.fame));
    const boardHtml = board.map((f, i) => `
      <div class="fame-row ${f.me ? 'me' : ''} ${f.dead ? 'dead' : ''}">
        <span class="fame-rank">${["甲","乙","丙","丁","戊","己","庚","辛","壬","癸"][i] || i + 1}</span>
        <span class="fame-name">${f.name}${f.dead ? '<span class="fame-dead">殁</span>' : ''}${f.won ? '<span class="fame-dead" style="color:var(--jade)">胜</span>' : ''}</span>
        <span class="fame-title">${f.title}</span>
        <span class="fame-val">${f.fame}</span>
        ${f.duelId && !boardStale ? `<button class="btn btn-mini fame-duel-btn" onclick="UI.closeModal();Engine.startFameDuel('${f.duelId}')">战</button>` : ""}
      </div>`).join("");
    const myFameNote = (s.fame || 0) > 0 ? "" : `<p style="color:var(--ink-faint);font-size:12px;margin:4px 0 0">你尚籍籍无名——伏诛异闻、赢得漂亮、惊世一战，名声自来。</p>`;
    const duelNote = boardStale ? "" : `<p style="color:var(--ink-faint);font-size:12px;margin:4px 0 0">带「战」字的散修可下战书——当众比斗，胜则扬名、座次攀高；但当众赢下的比斗做不得假，示人境界随之抬升（藏拙者慎）。</p>`;
    // §9-6 名场面回廊：已演完的"含演出"剧情可在此原样重温（最近见到的在前）
    const scenes = (s.scenes || []).slice().reverse();
    const scenesHtml = scenes.length
      ? scenes.map(sc => `<button class="scene-row tappable" onclick="UI.replayScene('${sc.id}')">
          <span class="scene-play">▶</span>
          <span class="scene-name">${sc.title || sc.id}</span>
          <span class="chron-t">${sc.t || ""}</span>
        </button>`).join("")
      : `<div class="inv-empty">尚无名场面——经历一段有演出的剧情后，便可在此重温。</div>`;

    this.openModal(`
      <h2>风云录 · 道途</h2>
      <h3 class="panel-title" style="margin-top:8px">风云榜（彩霞山座次${boardStale ? " · 旧档" : ""}）</h3>
      <div class="fame-stone">${boardHtml}</div>
      ${boardStale ? `<p style="color:var(--ink-faint);font-size:12px;margin:4px 0 0">这方石碑刻的是当年彩霞山一带的座次——你早已远行，天下之大，另有排场。</p>` : ""}
      ${myFameNote}
      ${duelNote}
      ${(() => { const te = (typeof Engine !== "undefined" && Engine.temperamentEcho) ? Engine.temperamentEcho() : null; return te ? `<h3 class="panel-title" style="margin-top:8px">心性 · 你是谁</h3><div class="temperament-echo temperament-${te.tone}">${te.text}</div>` : ""; })()}
      <h3 class="panel-title" style="margin-top:8px">名场面回廊（重温关键演出）</h3>
      <div class="scene-gallery">${scenesHtml}</div>
      <h3 class="panel-title" style="margin-top:8px">道途年表（你挣来的每一步）
        <button class="btn btn-mini btn-ghost" style="float:right;margin-top:-4px" onclick="UI.openShareCard()">道途名帖 📜</button></h3>
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
      const ks = (s.keepsakes || []).filter(k => k.from === n.id);
      const ksHtml = ks.length
        ? `<div class="codex-keepsake">信物：${ks.map(k => (DATA.items[k.id] ? DATA.items[k.id].name : k.id)).join("、")}<span class="ks-from">（${n.name}所赠）</span></div>`
        : "";
      return `<div class="codex-card tappable">
        <div class="codex-head"><b>${n.name}</b><span class="codex-role">${n.role}</span></div>
        <div class="codex-bio">${n.bio}</div>
        ${intelHtml}
        ${ksHtml}
        <div class="codex-rel ${relCls}">关系：${relTxt}</div>
      </div>`;
    };
    const lockedCard = `<div class="codex-card locked"><b>？？？</b><div class="codex-bio">尚未相识——行走江湖，自有相逢时。</div></div>`;

    this.openModal(`
      ${this._compTabs("npc")}
      <h2>人物图鉴 <span class="codex-count">${known.length}/${total}</span></h2>
      <p style="color:var(--ink-dim);font-size:12px">行走江湖所遇之人，结识后录入此册。大道无情，有羁绊者，终有离散之时。</p>
      <div class="codex">
        ${known.map(cardOf).join("")}
        ${unknown.map(() => lockedCard).join("")}
      </div>
      <div class="modal-actions"><button class="btn btn-ghost" onclick="UI.closeModal()">合上</button></div>
    `);
  },

  // 图鉴页签：人物 | 大件 | 传闻 | 异闻录（复用同一套图鉴 UI 的独立栏位）
  _compTabs(active) {
    const t = (id, label, fn) => `<button class="comp-tab ${active === id ? 'on' : ''}" onclick="UI.${fn}()">${label}</button>`;
    return `<div class="comp-tabs">${t("npc", "人物图鉴", "openCodex")}${t("big", "大件图鉴", "openBigitems")}${t("rumor", "传闻图鉴", "openRumors")}${t("yiwen", "异闻录", "openYiwen")}</div>`;
  },

  /* -------- 传闻图鉴（异闻妖王 + 风闻线报：一册收拢"听来的传闻"，明牌惦记·循声而往）-------- */
  openRumors() {
    const s = State.data;
    const beasts = (typeof WORLD !== "undefined" && WORLD.beastRumors) ? WORLD.beastRumors : [];
    const slain = s.slainBeasts || [];
    const activeId = s.beastRumor || null;
    const clueN = s.beastRumorClue || 0;

    // —— 异闻妖王：听闻 → 寻踪 → 伏诛 ——
    const beastCard = (r) => {
      const isSlain = slain.includes(r.id);
      const isActive = activeId === r.id;
      if (!isSlain && !isActive) {
        return `<div class="bi-card bi-unheard"><div class="bi-head"><b>？？？</b><span class="bi-badge">未闻</span></div>
          <div class="bi-blurb">后山尚有未起的风声——静待山民口耳相传。</div></div>`;
      }
      const total = (r.clues || []).length;
      const shown = isSlain ? total : Math.min(clueN, total);
      const cls = isSlain ? "bi-got" : "bi-track";
      const badge = isSlain ? "已伏诛" : "追猎中";
      const clues = (r.clues || []).map((c, i) =>
        `<div style="font-size:12px;line-height:1.6;margin-top:4px;color:${i < shown ? 'var(--ink)' : 'var(--ink-faint)'}">${i < shown ? "· " + c : "· ？？？——线索未明，深入后山方能寻得。"}</div>`).join("");
      const prog = total ? `<div class="bi-prog"><div class="bi-prog-bar"><i style="width:${Math.round(shown / total * 100)}%"></i></div><span>线索 ${shown}/${total}</span></div>` : "";
      const foot = isSlain
        ? `<div class="bi-note">此妖已伏诛——稀材入囊，风声散尽。</div>`
        : `<div class="bi-guide"><span class="bi-guide-key">寻踪</span>深入后山探索，线索了然后入深处与之一战。</div>`;
      return `<div class="bi-card ${cls}"><div class="bi-head"><b>${r.title}</b><span class="bi-badge">${badge}</span></div>
        <div class="bi-blurb">${r.rumor}</div>${prog}${clues}${foot}</div>`;
    };

    // —— 风闻线报：复用既有「风云录」worldNews（剧情传闻/线报，如皇宫决战「第五血侍·救刘靖」线报）——
    const newsRumors = (s.worldNews || []).filter(n => n.kind === "rumor").slice().reverse();
    const newsHtml = newsRumors.length
      ? newsRumors.map(n => `<div class="chron-item rumor"><span class="chron-t">${n.t}</span>${n.text}</div>`).join("")
      : `<div class="inv-empty">尚无风闻入耳——行走江湖，自有听闻时。</div>`;

    // —— 前路风闻：已知的远方传闻（明牌惦记·只示意不剧透）——
    const ahead = (typeof WORLD !== "undefined" && WORLD.rumorAhead) ? WORLD.rumorAhead : [];
    const aheadHtml = ahead.map(a =>
      `<div class="bi-card bi-far"><div class="bi-head"><b>${a.title}</b><span class="bi-badge">前路</span></div><div class="bi-blurb">${a.hint}</div></div>`).join("");

    const slainCount = beasts.filter(r => slain.includes(r.id)).length;
    this.openModal(`
      ${this._compTabs("rumor")}
      <h2>传闻图鉴 <span class="codex-count">异闻 ${slainCount}/${beasts.length}</span></h2>
      <p style="color:var(--ink-dim);font-size:12px">行走江湖，听来的传闻自成一册：山野异闻、市井风声、京华线报——明牌惦记，循声而往。</p>
      <h3 class="panel-title">异闻妖王（听闻 → 寻踪 → 伏诛）</h3>
      <div class="bi-list">${beasts.map(beastCard).join("")}</div>
      <h3 class="panel-title" style="margin-top:12px">风闻线报（风云录所记之传闻）</h3>
      <div class="chronicle">${newsHtml}</div>
      ${ahead.length ? `<h3 class="panel-title" style="margin-top:12px">前路风闻（已知的远方）</h3><div class="bi-list">${aheadHtml}</div>` : ""}
      <div class="modal-actions"><button class="btn btn-ghost" onclick="UI.closeModal()">合上</button></div>
    `);
  },

  /* -------- 大件图鉴（第一公民系统总表：明牌惦记 + 如何开启·获取）-------- */
  openBigitems() {
    const s = State.data;
    const cats = (typeof WORLD !== "undefined" && WORLD.bigitemCats) ? WORLD.bigitemCats : [];
    const all = (typeof WORLD !== "undefined" && WORLD.bigitems) ? WORLD.bigitems : [];
    const META = { got: { cls: "bi-got", badge: "已得" }, track: { cls: "bi-track", badge: "在途" }, unheard: { cls: "bi-unheard", badge: "未闻" } };
    const reachable = all.filter(b => !b.far);
    const gotCount = reachable.filter(b => { try { return b.stat(s).state === "got"; } catch (e) { return false; } }).length;
    const cardOf = (b) => {
      let st; try { st = b.stat(s) || {}; } catch (e) { st = {}; }
      if (!st.state) st.state = "unheard";
      const meta = META[st.state] || META.unheard;
      const badge = b.far ? "前路" : meta.badge;
      const prog = st.prog
        ? `<div class="bi-prog"><div class="bi-prog-bar"><i style="width:${Math.min(100, Math.round((st.prog.cur / Math.max(1, st.prog.max)) * 100))}%"></i></div><span>${st.prog.cur}/${st.prog.max}</span></div>`
        : "";
      const note = st.note ? `<div class="bi-note">${st.note}</div>` : "";
      return `<div class="bi-card ${meta.cls}${b.far ? ' bi-far' : ''}">
        <div class="bi-head"><b>${b.name}</b><span class="bi-badge">${badge}</span></div>
        <div class="bi-blurb">${b.blurb}</div>
        ${prog}${note}
        <div class="bi-guide"><span class="bi-guide-key">引导</span>${b.guide}</div>
      </div>`;
    };
    const sections = cats.map(c => {
      const items = all.filter(b => b.cat === c.id);
      if (!items.length) return "";
      return `<h3 class="panel-title">${c.name}</h3><div class="bi-list">${items.map(cardOf).join("")}</div>`;
    }).join("");
    this.openModal(`
      ${this._compTabs("big")}
      <h2>大件图鉴 <span class="codex-count">${gotCount}/${reachable.length}</span></h2>
      <p style="color:var(--ink-dim);font-size:12px">大件＝节点非奖品：每一件都开一条轴、通向下一件。明牌惦记，照「引导」一步步挣来——不漏任何一件。</p>
      <div class="bigitems">${sections}</div>
      <div class="modal-actions"><button class="btn btn-ghost" onclick="UI.closeModal()">合上</button></div>
    `);
  },

  /* -------- 异闻录（图鉴形式：触发留痕·未触发给引导。恒在原则——所有怪/材/情报客观存在）-------- */
  openYiwen() {
    const s = State.data;
    const all = (typeof WORLD !== "undefined" && WORLD.yiwen) ? WORLD.yiwen : [];
    const TYPE = { beast: "妖王异闻", material: "特殊材料", intel: "重要情报" };
    const DONE_BADGE = { beast: "已伏诛", material: "已得", intel: "已了" };
    const FXNUM = { "指路": "①", "识弱": "②", "召援": "③", "悬赏": "④", "备战": "⑤", "避坑": "⑥", "借物": "⑦" };
    const STATE_CLS = { done: "bi-got", active: "bi-track", unseen: "bi-unheard" };
    const stOf = (e) => (typeof Engine !== "undefined" && Engine._yiwenState) ? Engine._yiwenState(e, s) : "unseen";
    const recorded = all.filter(e => stOf(e) !== "unseen").length;

    const fxRow = (e) => {
      const fx = (e.effects || []).map(x => `<span style="display:inline-block;font-size:11px;padding:1px 7px;margin:3px 5px 0 0;border:1px solid var(--gold-dim,#a7842f);border-radius:9px;color:var(--gold-bright,#d8b24a)">${FXNUM[x] || ""}${x}</span>`).join("");
      return fx ? `<div style="margin-top:4px">${fx}</div>` : "";
    };
    const clueBar = (e) => {
      if (!e.link || e.link.kind !== "beastRumor") return "";
      const r = (WORLD.beastRumors || []).find(x => x.id === e.link.id);
      if (!r || !r.clues || !r.clues.length) return "";
      const cur = (s.beastRumor === e.link.id) ? Math.min(s.beastRumorClue || 0, r.clues.length) : 0;
      return `<div class="bi-prog"><div class="bi-prog-bar"><i style="width:${Math.round(cur / r.clues.length * 100)}%"></i></div><span>线索 ${cur}/${r.clues.length}</span></div>`;
    };
    const cardOf = (e) => {
      const stt = stOf(e);
      if (stt === "unseen") {
        return `<div class="bi-card bi-unheard">
          <div class="bi-head"><b>？？？ · ${TYPE[e.type] || "异闻"}</b><span class="bi-badge">未闻</span></div>
          <div class="bi-blurb" style="color:var(--ink-faint)">尚无风声入耳——但它客观存在于此世，或在某次探索里与你不期而遇。</div>
          <div class="bi-guide"><span class="bi-guide-key">引导</span>${e.guide}</div>
        </div>`;
      }
      const badge = stt === "done" ? (DONE_BADGE[e.type] || "已录") : "风声在耳";
      return `<div class="bi-card ${STATE_CLS[stt]}">
        <div class="bi-head"><b>${e.title}</b><span class="bi-badge">${badge}</span></div>
        <div class="bi-blurb">${e.exist}</div>
        ${clueBar(e)}${fxRow(e)}
        <div class="bi-guide"><span class="bi-guide-key">引导</span>${e.guide}</div>
      </div>`;
    };
    const order = ["beast", "material", "intel"];
    const sections = order.map(ty => {
      const items = all.filter(e => e.type === ty);
      if (!items.length) return "";
      return `<h3 class="panel-title">${TYPE[ty]}</h3><div class="bi-list">${items.map(cardOf).join("")}</div>`;
    }).join("");
    this.openModal(`
      ${this._compTabs("yiwen")}
      <h2>异闻录 <span class="codex-count">已录 ${recorded}/${all.length}</span></h2>
      <p style="color:var(--ink-dim);font-size:12px">江湖风声、妖王威名、稀材所在——皆客观恒在。听闻则入录知其弱、得其引；未闻者亦在那里等你撞见。异闻只予「预知与助力」，从非门槛。</p>
      <div class="bigitems">${sections}</div>
      <div class="modal-actions"><button class="btn btn-ghost" onclick="UI.closeModal()">合上</button></div>
    `);
  },

  /* ============================================================
   * 地图主界面（P1：全屏可缩放地图——替代弹窗式地图）
   * 缩放级别 Z1~Z5 对应五级舆图数据：
   *   Z1=人界全图 Z2=大区 Z3=胥国 Z4=地区地点 Z5=据点场景（=scene-stage）
   * 默认 Z5（在据点内看场景），点「舆图」切到 Z3（胥国全景）。
   * ============================================================ */
  _mapZoom: 5,          // 当前缩放级别（UI 状态，不存档）
  _mapFocusNode: null,  // Z4 时聚焦的大陆节点 id

  toggleWorldmap() {
    if (this._mapZoom === 5) {
      // 从场景切到地图：默认 Z3（胥国全景）
      this._prevZoom = 5;
      this._mapZoom = 3;
      this._mapFocusNode = null;
      this._showWorldmap(true);
      this.renderWorldmap();
    } else {
      // 从地图切回场景（Z5）：不显示 dock（用常规 layout 行动按钮）
      this._prevZoom = this._mapZoom;
      this._mapZoom = 5;
      this._showWorldmap(false, true);  // skipDock=true：退出地图模式时不弹 dock
      this.renderLocation();
    }
  },

  // Z4↔Z5 交叉淡入淡出：show=true 显示地图，show=false 显示场景
  // skipDock=true 时不在显示场景后弹出 action-dock（用于 toggleWorldmap 退出地图模式）
  _showWorldmap(show, skipDock) {
    const canvas = this.el("worldmap-canvas");
    const stage = this.el("scene-stage");
    if (!canvas || !stage) return;
    if (show) {
 // 显示地图：canvas 淡入，stage 淡出
 clearTimeout(this._mapFadeTimer);   // 取消上一次"淡出后隐藏"的待执行计时——否则快速来回切会把刚显示的地图又隐藏（黑屏 bug）
 canvas.hidden = false;
 requestAnimationFrame(() => canvas.classList.remove("fade-out"));
 stage.classList.add("fade-out");
 this._showActionDock(false);
 // P4 桌面：进地图默认收起侧栏，让地图占满视野（☰ 可再展开）
 if (!this._isMobile()) {
   const rail = document.querySelector(".side-rail");
   const stg = document.querySelector(".stage-col");
   if (rail) rail.classList.add("collapsed");
   if (stg) stg.classList.add("collapsed");
 }
 const hudBtn = this.el("hud-toggle");
 if (hudBtn) hudBtn.hidden = false;
    } else {
 // 显示场景：stage 淡入，canvas 淡出
 stage.classList.remove("fade-out");
 canvas.classList.add("fade-out");
 if (!skipDock) this._showActionDock(true);
 else this._showActionDock(false);
 // 延迟隐藏 canvas（等淡出动画完成）
 clearTimeout(this._mapFadeTimer);
 this._mapFadeTimer = setTimeout(() => { canvas.hidden = true; }, 500);
 const hudBtn2 = this.el("hud-toggle");
 if (hudBtn2) hudBtn2.hidden = true;
 // 恢复地点 BGM + 环境音
 const loc = State.location();
 if (loc && typeof Sfx !== "undefined" && Sfx.bgm && !State.data.combat) {
   Sfx.bgm(this._bgmForLocation(loc));
   const amb = (typeof Env !== "undefined") ? Env.ambientFor(loc) : null;
   if (amb && Sfx.ambient) Sfx.ambient(amb);
   else if (Sfx.ambientStop) Sfx.ambientStop();
 }
    }
  },

  // 行动 dock 显示/隐藏（P2：Z5 时滑出）
  _showActionDock(show) {
    const dock = this.el("action-dock");
    if (!dock) return;
    if (show) {
 clearTimeout(this._dockHideTimer);   // 取消上一次"隐藏"待执行计时——否则地图↔据点快速切换会把刚弹出的 sheet 又隐藏（show 类在但 hidden 属性回 true）
 dock.hidden = false;
 requestAnimationFrame(() => dock.classList.add("show"));
 document.body.classList.add("dock-active");
 this._renderDockActions();
    } else {
 dock.classList.remove("show");
 dock.classList.remove("expanded");
 document.body.classList.remove("dock-active");
 clearTimeout(this._dockHideTimer);
 this._dockHideTimer = setTimeout(() => { dock.hidden = true; }, 400);
    }
  },

  // 抓手点按：半展开(peek) ↔ 全展开 之间切换（手机端底部 sheet 行为）
  _toggleDockExpand() {
    const dock = this.el("action-dock");
    if (!dock) return;
    dock.classList.toggle("expanded");
  },

  // 将行动按钮也渲染到 dock 中（复用 renderActions 逻辑）
  _renderDockActions() {
    const loc = State.location();
    const dockBox = this.el("dock-actions");
    if (!dockBox || !loc) return;
    const s = State.data;

    // —— 头部：地点名 + 天命一行 ——
    const locName = this.el("dock-loc");
    if (locName) locName.textContent = loc.name || "";
    const objEl = this.el("dock-obj");
    if (objEl) {
      const obj = Engine.currentObjective ? Engine.currentObjective() : null;
      objEl.textContent = obj ? `天命 · ${obj.title}` : "";
    }

    const labels = {
      cultivate: "闭关修炼", rest: "打坐调息", breakthrough: "尝试突破",
      bottle: (State.data.bottle && (State.data.bottle.plots || []).some(p => p.crop && p.growth >= 100)) ? "打理小瓶 ✦熟" : "打理小瓶",
      adventure: "外出历练", gather: "采药", spar: "切磋武艺", market: "采买", alchemy: "炼药", investigate: "暗中探查",
      explore: "深入探索", wujian: "闭关悟剑 ⚔", fair: "赶集（小会）", yaoyuan: "药园差事",
      liandan: "地火炼丹 🔥", board: "细读告示", rumor: "探听风声", hunt: "外海猎妖 🌊",
      xingyi: "坐堂行医", daigong: "百艺坊 · 补炼缺件 🔨", qingtuo: "坊市告示 · 请托 📜",
      lianfu: "闭关制符 ✎", xunluo: "随队巡逻 · 军功 ⚔", xiuzhen: "修补阵纹 ⚙",
    };
    let acts = (loc.scene ? [] : loc.actions.slice());
    if (!loc.scene) {
      acts = acts.filter(a => a !== "bottle" || s.bottle.unlocked);
      // polish-modao A1②：前线巡逻只在征军期挂牌（双路径都要过滤——v83 教训）
      acts = acts.filter(a => a !== "xunluo" || (s.flags.modao_conscripted && !s.flags.modao_e3_rujing_done));
      if (loc.id === "yaolu" && s.flags.identity_practice_medicine && !s.flags.arc1_complete) acts.push("xingyi");
      if (loc.home && (s.swordIntent || 0) >= 100 && !s.swordMastery) acts.unshift("wujian");
      if (loc.home && loc.id === "huangfeng_gate"
        && State.count("xueshi_zhuyao") >= 4 && !s.flags.zhuji_lian_done) acts.unshift("liandan");
      // polish-huangfeng C6：代工缺料未结案——再访百艺坊可补炼缺件
      if (loc.id === "yuanwu" && s.flags.daigong_partial && !s.flags.daigong_done) acts.unshift("daigong");
      // polish-modao B①（GPT P0-3·跨章 bug）：制符台入口——双路径都要注入（v83 媒体查询同型教训）
      if (loc.home && Engine.hasFuluTable && Engine.hasFuluTable()
        && (s.fuluPlans || []).length) acts.push("lianfu");
    }
    // 注：地图主界面化后，行动 sheet 始终列出据点行动（即使该地点也有场景热点）——
    // sheet 是主入口，场景热点退为可选的氛围交互（不再清空 dock 行动）。
    // 闭关结算补报 + 续闭快捷（手机端 dock 与 renderActions 双路径都要有，否则"改了等于没改"）
    if (Engine.flushRetreatSettle) Engine.flushRetreatSettle();
    let resumeBtn = "";
    const rr = Engine._retreatResume;
    if (rr && !loc.scene && !s.pendingEvent && !s.combat) {
      if (State.absMonth() > rr.until || !(loc.actions && loc.actions.includes("cultivate"))) {
        Engine._retreatResume = null;
      } else {
        resumeBtn = `<button class="btn btn-action btn-window" onclick="Engine._retreatResume=null;Engine.doCultivate(${rr.months})">继续闭关 <span class="win-left">余${rr.months}月</span></button>`;
      }
    }
    // 涟漪窗口
    let windowBtn = "";
    const rw = s.rippleWindow;
    if (rw && !loc.scene) {
      const left = rw.dueAbs - State.absMonth();
      if ((rw.id === "herb_garden" && loc.id === "houshan") || (rw.id === "wolf_bounty" && loc.id === "town")) {
        const lbl = rw.id === "herb_garden" ? "寻无主药园" : "应悬赏剿匪";
        windowBtn = `<button class="btn btn-action btn-window" onclick="Engine.doRippleWindow('${rw.id}')">${lbl} <span class="win-left">余${left}月</span></button>`;
      } else if (rw.id === "lingcao_boom" && loc.id === "fangshi") {
        windowBtn = `<button class="btn btn-action btn-window" onclick="Engine.doRippleWindow('lingcao_boom')">趁涨价出手灵草 <span class="win-left">余${left}月</span></button>`;
      } else if (rw.id === "wanbao_sale" && loc.id === "fangshi") {
        windowBtn = `<button class="btn btn-action btn-window" onclick="Engine.doRippleWindow('wanbao_sale')">二层法器·八折捡漏 <span class="win-left">余${left}月</span></button>`;
      } else if (rw.id === "jindi_gossip" && loc.id === "fangshi") {
        windowBtn = `<button class="btn btn-action btn-window" onclick="Engine.doRippleWindow('jindi_gossip')">钻研禁地旧闻（1月） <span class="win-left">余${left}月</span></button>`;
      }
    }
    const focus = this._pendingFocus; this._pendingFocus = null;
    dockBox.innerHTML = (acts.length || windowBtn || resumeBtn)
      ? resumeBtn + windowBtn + acts.map(a => `<button class="btn btn-action${a === focus ? " btn-guide-focus" : ""}" data-action="${a}">${(loc.actionLabels && loc.actionLabels[a]) || labels[a] || a}</button>`).join("")
      : (loc.scene ? `<div class="act-hint">— 此地仅供过场，循剧情前行 —</div>`
      : (loc.hotspots ? `<div class="act-hint">— 点场景中发光标记行事 —</div>` : ""));
    dockBox.querySelectorAll("[data-action]").forEach(btn => {
      btn.addEventListener("click", () => Engine.doAction(btn.dataset.action));
    });

    // —— 见闻 pane：最近见闻 + 在场人物 ——
    this._renderDockNews(loc);
  },

  // 行动 sheet 内的"见闻"段：最近若干条见闻 + 在场可交谈人物（点开全部见闻=切见闻页）
  _renderDockNews(loc) {
    const box = this.el("dock-news");
    if (!box) return;
    loc = loc || State.location();
    const s = State.data;
    const log = (s && s.log) || [];
    const strip = (e, cap) => {
      const tmp = document.createElement("div");
      tmp.innerHTML = e.body || "";
      let txt = (tmp.textContent || "").trim().replace(/\s+/g, " ");
      if (txt.length > cap) txt = txt.slice(0, cap) + "…";
      return txt;
    };
    let html = "";
    // 在场人物（可点交谈）
    const locals = (loc && !loc.scene && !s.pendingEvent && WORLD.localsAt) ? WORLD.localsAt(loc.id, s) : [];
    if (locals.length) {
      html += `<div class="dn-npcs">` + locals.map(n => {
        const met = (s.metNpcs || []).includes(n.id);
        return `<button class="dn-npc" onclick="UI.talkLocal('${n.id}')">${met ? n.name : "陌生人"}<i>${n.role}</i></button>`;
      }).join("") + `</div>`;
    }
    if (log.length) {
      const recent = log.slice(-6).reverse();
      html += recent.map(e =>
        `<div class="dn-row"><span class="dn-tag">${e.t}</span><span class="dn-txt entry-${e.kind || 'event'}">${strip(e, 110)}</span></div>`
      ).join("");
      html += `<button class="dn-more" onclick="UI.openLogSheet()">查看完整见闻 ›</button>`;
    } else if (!locals.length) {
      html += `<div class="act-hint">— 此地暂无见闻 —</div>`;
    }
    box.innerHTML = html;
  },

  // 行动 sheet 内切「行动 / 见闻」段
  _dockTab(tab) {
    const dock = this.el("action-dock");
    if (!dock) return;
    dock.querySelectorAll(".dock-tab").forEach(t => t.classList.toggle("active", t.dataset.dtab === tab));
    const act = this.el("dock-actions"), news = this.el("dock-news");
    if (act) act.hidden = (tab !== "act");
    if (news) news.hidden = (tab !== "news");
  },

  // 完整见闻浮层（从行动 sheet 的「见闻」段点开）
  // 按年月分组（审美审计 jank#11）：同月见闻归到一条月份分隔线下，长卷有了"日历的骨架"
  openLogSheet() {
    const s = State.data;
    const log = (s && s.log) || [];
    let lastT = null;
    const rows = log.slice().reverse().map(e => {
      const divider = e.t !== lastT
        ? `<div class="ls-month"><span>${e.t}</span></div>`
        : "";
      lastT = e.t;
      return `${divider}<div class="ls-row"><div class="ls-body entry-${e.kind || 'event'}">${e.body || ""}</div></div>`;
    }).join("") || `<div class="act-hint">— 暂无见闻 —</div>`;
    this.openSheet(`<h2>见闻 · 全录</h2><div class="log-sheet">${rows}</div>`);
  },

  _mapZoomIn() {
    if (this._mapZoom >= 5) return;
    this._mapZoom++;
    if (this._mapZoom === 5) {
      // Z4→Z5：地图淡出，场景淡入（不弹 dock，用常规 layout 行动按钮）
      this._prevZoom = 4;
      this._showWorldmap(false, true);
      // 确保场景内容刷新
      this.renderLocation();
    } else {
      this.renderWorldmap();
    }
  },

  _mapZoomOut() {
    if (this._mapZoom <= 1) return;
    const wasZ5 = this._mapZoom === 5;
    this._mapZoom--;
    if (wasZ5) {
      // Z5→Z4：场景淡出，地图淡入
      this._prevZoom = 5;
      this._showWorldmap(true);
      this.renderWorldmap();
    } else {
      this.renderWorldmap();
    }
  },

  renderWorldmap() {
    const z = this._mapZoom;
    const svg = this.el("worldmap-svg");
    const pinsBox = this.el("worldmap-pins");
    const labelsBox = this.el("worldmap-labels");
    const hint = this.el("worldmap-hint");
    if (!svg || !pinsBox) return;
    const s = State.data;
    if (!s) return;                       // 创建界面/未开局：地图无可渲染（防 null 崩溃）
    const C = WORLD.continent;
    if (!C) return;

    // 底图（按缩放级别）：Z3/Z4 同为胥国图——连续缩放不换图；跨级（Z1/Z2/Z3）才换图（交叉淡入）
    const bgMap = { 1: "renjie_map", 2: "tiannan_atlas", 3: C.map, 4: C.map };
    const bgUrl = bgMap[z] && typeof Art !== "undefined" ? Art.url(bgMap[z]) : null;
    this._setWmBg(bgUrl);

    // viewBox 恒定 0~100：缩放靠 .wm-world 的 transform（保证 pin/label 与底图同步、连续）
    svg.setAttribute("viewBox", "0 0 100 100");

    let svgContent = "", pinsHtml = "", labelsHtml = "", hintText = "";
    // 缩放变换参数：k=放大倍率，(fx,fy)=聚焦点（0~100）。默认全图（k=1，居中）。
    let k = 1, fx = 50, fy = 50;

    if (z === 1) {
      hintText = "人界全图 · 点区块下钻";
      const L = WORLD.atlas && WORLD.atlas.levels.renjjie;
      if (L) {
        const pathSet = this._atlasPinSet(L);
        svgContent = L.nodes.map(n => {
          const d = this._atlasPath(n, pathSet);
          const st = this._atlasNodeState(n, s, this._atlasPathSet());
          return `<path class="region-block ${st}" d="${d}" onclick="UI._wmPickAtlas('renjjie','${n.id}')"/>`;
        }).join("");
        labelsHtml = L.nodes.map(n => {
          const lab = n.label || n.pos;
          const st = this._atlasNodeState(n, s, this._atlasPathSet());
          return `<div class="wm-label ${st === 'here' ? 'sel' : ''}" data-mx="${lab.x}" data-my="${lab.y}" onclick="UI._wmPickAtlas('renjjie','${n.id}')">${n.name}</div>`;
        }).join("");
      }
    } else if (z === 2) {
      hintText = "天南 · 点区块下钻";
      const L = WORLD.atlas && WORLD.atlas.levels.tiannan;
      if (L) {
        const pathSet = this._atlasPinSet(L);
        svgContent = L.nodes.map(n => {
          const d = this._atlasPath(n, pathSet);
          const st = this._atlasNodeState(n, s, this._atlasPathSet());
          return `<path class="region-block ${st}" d="${d}" onclick="UI._wmPickAtlas('tiannan','${n.id}')"/>`;
        }).join("");
        labelsHtml = L.nodes.map(n => {
          const lab = n.label || n.pos;
          const st = this._atlasNodeState(n, s, this._atlasPathSet());
          return `<div class="wm-label ${st === 'here' ? 'sel' : ''}" data-mx="${lab.x}" data-my="${lab.y}" onclick="UI._wmPickAtlas('tiannan','${n.id}')">${n.name}</div>`;
        }).join("");
      }
    } else if (z === 3 || z === 4) {
      // Z3=胥国全景，Z4=聚焦某据点的地区——同一张图，靠 transform 连续放大
      const curNode = C.nodes.find(n => (n.locs || []).includes(s.location)) || C.nodes[0];
      const visited = s.visitedNodes || ["caixia"];
      const epoch = WORLD.atlas.factionEpoch(s);
      // 天命指引（playtest 2026-07-12：「舆图看不出该干什么」）——主线有去处时，目标据点 pin 亮金圈+「天命」标
      const _objNow = Engine.currentObjective ? Engine.currentObjective() : null;
      const fateLocId = _objNow && _objNow.loc && _objNow.loc !== s.location ? _objNow.loc : null;
      const fateNode = fateLocId ? C.nodes.find(n => (n.locs || []).includes(fateLocId)) : null;

      // 路线（vector-effect 非缩放描边——放大时线不变粗）
      // polish-modao A3：n.hidden(s)=战时限定节点（魔道前线）——章外不上图，连线同隐
      const _wmHid = (n) => !!(n && n.hidden && n.hidden(s));
      svgContent = C.routes.map(r => {
        const a = C.nodes.find(n => n.id === r.from), b = C.nodes.find(n => n.id === r.to);
        if (!a || !b || _wmHid(a) || _wmHid(b)) return "";
        const trod = visited.includes(a.id) && visited.includes(b.id);
        return `<line class="wm-route${trod ? ' trod' : ''}" x1="${a.pos.x}" y1="${a.pos.y}" x2="${b.pos.x}" y2="${b.pos.y}" vector-effect="non-scaling-stroke"/>`;
      }).join("");

      // 据点 pins
      pinsHtml = C.nodes.map(n => {
        if (_wmHid(n)) return "";
        const here = n.id === curNode.id;
        const gateMsg = n.gate ? n.gate(s) : null;
        const cls = n.silhouette ? "silhouette" : gateMsg ? "gated" : "";
        const nm = WORLD.atlas.epochPick(n.nameByEpoch, epoch) || n.name;
        const ruin = WORLD.atlas.epochPick(n.ruinByEpoch, epoch);
        const label = ruin ? `${nm}（旧址）` : nm;
        // 副信息行（舆图显示更多）：当前=在此；远观=??；未通=锁；可达=凶险+行程月数
        const isFate = !!(fateNode && fateNode.id === n.id && !here);
        let meta = "";
        if (here) meta = `<span class="wm-pin-meta here">在此</span>`;
        else if (n.silhouette) meta = `<span class="wm-pin-meta lock">远观之地</span>`;
        else if (gateMsg) meta = `<span class="wm-pin-meta lock">道途未通</span>`;
        else {
          const months = Math.max(1, n.months || 2);
          const danger = n.danger || "";
          const dCls = danger === "高" ? "d-hi" : danger === "中" ? "d-mid" : "d-lo";
          meta = `<span class="wm-pin-meta">${danger ? `<i class="wm-danger ${dCls}">${danger}险</i>` : ""}约${months}月</span>`;
        }
        if (isFate) meta = `<span class="wm-pin-meta fate">★ 天命所指</span>` + meta;
        return `<div class="wm-pin ${here ? 'here' : ''} ${isFate ? 'fate' : ''} ${cls}" role="button" aria-label="${label}" data-mx="${n.pos.x}" data-my="${n.pos.y}" onclick="UI._wmPickNode('${n.id}')" title="${n.desc}">
          <span class="wm-pin-dot"></span>
          <span class="wm-pin-label">${label}</span>
          ${meta}
        </div>`;
      }).join("");

      // 州名题字
      labelsHtml = (C.prefectures || []).map(p => {
        const L2 = p.label || { x: 50, y: 50 };
        return `<div class="wm-label" data-mx="${L2.x}" data-my="${L2.y}">${p.name}</div>`;
      }).join("");

      if (z === 3) {
        hintText = C.id === "xinghai" ? "乱星海 · 星罗诸岛 · 点海岛查看" : "胥国 · 十三州 · 点据点查看";
      } else {
        // Z4：聚焦当前据点，放大显示其下地点（地点 pin 在据点 pos 周围成簇——同图放大）
        const focusId = this._mapFocusNode;
        const node = C.nodes.find(n => n.id === focusId) || curNode;
        fx = node.pos.x; fy = node.pos.y; k = 2.4;
        hintText = `${node.name} · 点地点前往`;
        const locs = WORLD.locations.filter(l =>
          !l.scene && l.map && (node.locs || []).includes(l.id) && (!l.unlock || l.unlock(s)));
        const cur = s.location;
        // 地点簇：以据点 pos 为心，把地点的 map 坐标压缩到 ±spread 的小范围内（同图近景）
        const spread = 7;   // 簇半径（0~100 坐标），约对应屏上一片区域
        const locPos = l => ({
          x: node.pos.x + (l.map.x - 50) / 50 * spread,
          y: node.pos.y + (l.map.y - 50) / 50 * spread,
        });
        const locPins = locs.map(l => {
          const here = l.id === cur;
          const p = locPos(l);
          const factor = Balance.travelTimeFactor(State.effectiveSpeed());
          const cost = Math.max(1, Math.round((l.travelCost || 2) * factor));
          const isFateLoc = !!(fateLocId && fateLocId === l.id && !here);
          return `<div class="wm-pin loc ${here ? 'here' : ''} ${isFateLoc ? 'fate' : ''}" data-mx="${p.x}" data-my="${p.y}" onclick="UI._wmPickLoc('${l.id}')" title="${l.desc}">
            <span class="wm-pin-dot"></span>
            <span class="wm-pin-label">${isFateLoc ? '★ ' : ''}${l.name}${here ? ' ·在此' : ` ${cost}月`}</span>
          </div>`;
        }).join("");
        // Z4 连线（据点心 → 各地点）
        const curLoc = WORLD.locations.find(l => l.id === cur);
        const centerP = curLoc && (node.locs || []).includes(cur) ? locPos(curLoc) : node.pos;
        svgContent = locs.map(l => {
          const p = locPos(l);
          return `<line class="wm-route trod" x1="${centerP.x}" y1="${centerP.y}" x2="${p.x}" y2="${p.y}" vector-effect="non-scaling-stroke"/>`;
        }).join("");
        // Z4 只显当前据点名（其余 pin 淡出，避免与地点簇打架）
        pinsHtml = `<div class="wm-pin here node-anchor" data-mx="${node.pos.x}" data-my="${node.pos.y}">
          <span class="wm-pin-label node">${node.name}</span></div>` + locPins;
        labelsHtml = "";
      }
    }

    svg.innerHTML = svgContent;
    pinsBox.innerHTML = pinsHtml;
    labelsBox.innerHTML = labelsHtml;
    if (hint) hint.textContent = hintText;

    // P3：旅途中自动聚焦当前路线（头像在动、镜头跟着走）
    if (s.journey && (z === 3 || z === 4)) {
      const j = s.journey;
      const fromNode = C.nodes.find(n => n.id === j.from);
      const toNode = C.nodes.find(n => n.id === j.to);
      if (fromNode && toNode) {
        fx = (fromNode.pos.x + toNode.pos.x) / 2;
        const midY = (fromNode.pos.y + toNode.pos.y) / 2;
        const span = Math.max(
          Math.abs(toNode.pos.x - fromNode.pos.x),
          Math.abs(toNode.pos.y - fromNode.pos.y),
          10
        );
        // 旅途面板占据下半屏 ⇒ 路线须整条落进上方可见带（约屏高 0~40%）：
        // 缩放让路线纵向投影 ≤32% 屏高，焦点下移让路线中点投影到 22% 屏高处。
        k = Math.max(1.15, Math.min(2.2, 32 / span));
        fy = midY + 28 / k;
        // 当前行进路线高亮（journey 墨金流动虚线，与走过的 trod 区分）——svg 已赋 innerHTML，直接追加
        svg.insertAdjacentHTML("beforeend",
          `<line class="wm-route journey" x1="${fromNode.pos.x}" y1="${fromNode.pos.y}" x2="${toNode.pos.x}" y2="${toNode.pos.y}" vector-effect="non-scaling-stroke"/>`);
        if (hint) hint.textContent = `旅途 ${j.leg}/${j.total} 月 · 赴${j.toName}`;
      }
    }

    // 应用连续缩放变换（只缩底图/SVG）；pin/文字按投影坐标定位（原生分辨率，不糊）
    this._applyWmZoom(k, fx, fy);
    this._projectWmMarkers();

    // 更新 avatar pin
    this._updateAvatarPin();
  },

  // 连续缩放：只对 .wm-world（底图+SVG 路线）做 translate+scale。pin/文字/头像在层外，
  // 用 _projectWmMarkers 按同一投影换算屏幕坐标——文字图标始终原生分辨率渲染（放大不糊）。
  _applyWmZoom(k, fx, fy) {
    const world = this.el("wm-world");
    if (!world) return;
    this._wmK = k; this._wmFx = fx; this._wmFy = fy;
    const tx = -k * (fx - 50);
    const ty = -k * (fy - 50);
    world.style.transform = `translate(${tx}%, ${ty}%) scale(${k})`;
  },

  // 投影：把每个 marker 的地图坐标(data-mx/my, 0~100)按当前缩放换算成屏幕百分比。
  //   屏幕% = 50 + (m - 焦点) × k。marker 在缩放层外，故文字/图标按原生像素渲染（清晰）。
  _projectWmMarkers() {
    const k = this._wmK || 1, fx = this._wmFx != null ? this._wmFx : 50, fy = this._wmFy != null ? this._wmFy : 50;
    const proj = (el) => {
      const mx = parseFloat(el.dataset.mx), my = parseFloat(el.dataset.my);
      if (isNaN(mx) || isNaN(my)) return;
      el.style.left = (50 + (mx - fx) * k) + "%";
      el.style.top = (50 + (my - fy) * k) + "%";
    };
    const pinsBox = this.el("worldmap-pins"), labelsBox = this.el("worldmap-labels");
    if (pinsBox) pinsBox.querySelectorAll(".wm-pin").forEach(proj);
    if (labelsBox) labelsBox.querySelectorAll(".wm-label").forEach(proj);
    const av = this.el("avatar-pin"); if (av && !av.hidden) proj(av);
  },

  // 底图交叉淡入（跨级换图：人界/天南/胥国/场景之间）。同图不换=直接返回。
  _setWmBg(url) {
    const bg = this.el("worldmap-bg"), bg2 = this.el("worldmap-bg2");
    if (!bg) return;
    const cur = bg.dataset.url || "";
    if (cur === (url || "")) return;
    if (url) {
      if (cur) {
        // 已有底图 → 用 bg2 淡入新图，再交换（crossfade）
        bg2.style.backgroundImage = `url("${url}")`;
        bg2.style.opacity = "0.55";
        clearTimeout(this._bgSwapT);
        this._bgSwapT = setTimeout(() => {
          bg.style.backgroundImage = `url("${url}")`;
          bg.dataset.url = url;
          bg2.style.opacity = "0";
        }, 480);
      } else {
        bg.style.backgroundImage = `url("${url}")`;
        bg.dataset.url = url;
      }
    } else {
      bg.style.backgroundImage = ""; bg.dataset.url = "";
    }
  },

  // 旅途抵达后：从地图切到场景（Z5），回到据点·行动态
  _journeyArriveTransition() {
    this._returnToLocale();
  },

  // 旅途开始：切到地图主界面（Z3），头像将沿路线插值移动（P3 旅途可视化）
  _enterJourneyMap() {
    this._prevZoom = this._mapZoom;
    this._mapZoom = 3;
    this._mapFocusNode = null;
    this._showWorldmap(true);
    this.renderWorldmap();
    document.querySelectorAll(".mtab").forEach(t => t.classList.toggle("active", t.dataset.tab === "map"));
    const sg = document.getElementById("screen-game"); if (sg) sg.setAttribute("data-mtab", "map");
  },

  // P4：切换 HUD 侧栏折叠/展开（地图模式下）
  _toggleHudPanels() {
    const rail = document.querySelector(".side-rail");
    const stage = document.querySelector(".stage-col");
    if (!rail && !stage) return;
    const anyCollapsed = (rail && rail.classList.contains("collapsed")) ||
                         (stage && stage.classList.contains("collapsed"));
    if (anyCollapsed) {
      if (rail) rail.classList.remove("collapsed");
      if (stage) stage.classList.remove("collapsed");
    } else {
      if (rail) rail.classList.add("collapsed");
      if (stage) stage.classList.add("collapsed");
    }
  },

  // 地图上点据点节点（Z3）
  _wmPickNode(nodeId) {
    const C = WORLD.continent;
    const n = C.nodes.find(x => x.id === nodeId);
    if (!n) return;
    const s = State.data;
    if (n.silhouette) { this.toast("传说之地——尚不可至"); return; }
    const gateMsg = n.gate ? n.gate(s) : null;
    if (gateMsg) { this.toast(`道途未通：${gateMsg}`, true); return; }
    if ((n.locs || []).includes(s.location)) {
      // 已在此处 → 缩放到 Z4 看地点
      this._mapFocusNode = n.id;
      this._mapZoom = 4;
      this.renderWorldmap();
      return;
    }
    // 弹出确认窗口
    const months = Math.max(1, n.months || 2);
    const danger = n.danger || "未知";
    const epoch = WORLD.atlas.factionEpoch(s);
    const nm = WORLD.atlas.epochPick(n.nameByEpoch, epoch) || n.name;
    const desc = WORLD.atlas.epochPick(n.descByEpoch, epoch) || n.desc;
    this.openSheet(`
      <h2>启程 · ${nm}</h2>
      <p style="color:var(--ink-dim);font-size:13px">${desc}</p>
      <div class="prep-list">
        <div class="prep-item"><span>行程</span><b>约 ${months} 月</b></div>
        <div class="prep-item"><span>凶险</span><b>${danger}</b></div>
      </div>
      <div class="choices">
        <button class="choice" onclick="UI._confirmJourney('${n.id}')">收拾行囊，启程出发<span class="c-hint">旅途月月有奇遇</span></button>
        <button class="choice" onclick="UI.closeSheet()">再想想<span class="c-hint">留在此处</span></button>
      </div>
    `);
  },

  _confirmJourney(nodeId) {
    const C = WORLD.continent;
    const n = C.nodes.find(x => x.id === nodeId);
    if (!n) return;
    this.closeSheet();
    this.toast(`启程：${n.name}`);
    Engine.startJourney(n.id);
  },

  // 地图上点地点（Z4）
  _wmPickLoc(locId) {
    const l = WORLD.locations.find(x => x.id === locId);
    if (!l) return;
    if (l.id === State.data.location) { this.toast("已在此处"); return; }
    const factor = Balance.travelTimeFactor(State.effectiveSpeed());
    const cost = Math.max(1, Math.round((l.travelCost || 2) * factor));
    this.openSheet(`
      <h2>前往 · ${l.name}</h2>
      <p style="color:var(--ink-dim);font-size:13px">${l.desc}</p>
      <div class="prep-list">
        <div class="prep-item"><span>行程</span><b>约 ${cost} 月</b></div>
      </div>
      <div class="choices">
        <button class="choice" onclick="UI._confirmTravel('${l.id}')">动身前往<span class="c-hint">耗时 ${cost} 月</span></button>
        <button class="choice" onclick="UI.closeSheet()">再想想<span class="c-hint">留在此处</span></button>
      </div>
    `);
  },

  _confirmTravel(locId) {
    this.closeSheet();
    Engine.travelTo(locId);
    // 到达后回到「据点·行动」态（不只是切 zoom——还要同步 tab/data-mtab/dock，否则停在旧版残留 UI）
    this._returnToLocale();
  },

  // 统一收口：从地图/旅途回到据点态——切 Z5、地图淡出、底栏=行动、弹行动 sheet。
  _returnToLocale() {
    this._mapZoom = 5;
    this._showWorldmap(false, true);   // skipDock：由下面按平台决定是否弹
    this.renderLocation();
    document.querySelectorAll(".mtab").forEach(t => t.classList.toggle("active", t.dataset.tab === "act"));
    const sg = document.getElementById("screen-game"); if (sg) sg.setAttribute("data-mtab", "act");
    const layout = document.querySelector(".layout"); if (layout) layout.setAttribute("data-mtab", "act");
    const s = State.data;
    if (!s.combat && !s.pendingEvent && !s.exmap) this._showActionDock(true);
    this.renderAll();
  },

  // Z1/Z2 点区块
  _wmPickAtlas(levelId, nodeId) {
    const L = WORLD.atlas && WORLD.atlas.levels[levelId];
    const n = L && L.nodes.find(x => x.id === nodeId);
    if (!n) return;
    const st = this._atlasNodeState(n, State.data, this._atlasPathSet());
    if (st === "locked") { this.toast(n.silhouette ? "远观之地——尚不可至" : "道途未通——暂不可往"); return; }
    if (n.to === "yueguo") {
      // 进入胥国 → Z3
      this._mapZoom = 3;
      this.renderWorldmap();
      return;
    }
    // 其他层级：下钻
    if (n.to) this._wmGoto(n.to);
  },
  _wmGoto(levelId) {
    if (levelId === "yueguo") { this._mapZoom = 3; this.renderWorldmap(); return; }
    const L = WORLD.atlas && WORLD.atlas.levels[levelId];
    if (!L) { this._mapZoom = 3; this.renderWorldmap(); return; }
    this._mapZoom = (L.kind === "world") ? 1 : 2;
    this.renderWorldmap();
  },

  // 更新 avatar pin 位置
  _updateAvatarPin() {
    const pin = this.el("avatar-pin");
    if (!pin) return;
    const s = State.data;
    const C = WORLD.continent;
    if (!C) { pin.hidden = true; return; }

    let ax, ay;
    if (s.journey) {
      // 旅途中：沿路线插值（Z3 坐标系）
      const j = s.journey;
      const fromNode = C.nodes.find(n => n.id === j.from);
      const toNode = C.nodes.find(n => n.id === j.to);
      if (fromNode && toNode) {
        const progress = j.total > 0 ? j.leg / j.total : 0;
        ax = fromNode.pos.x + (toNode.pos.x - fromNode.pos.x) * progress;
        ay = fromNode.pos.y + (toNode.pos.y - fromNode.pos.y) * progress;
      } else if (toNode) {
        ax = toNode.pos.x; ay = toNode.pos.y;
      }
    } else if (this._mapZoom === 4) {
      // Z4：地点簇坐标系（以聚焦据点 pos 为心，地点压缩到 ±spread）——与 renderWorldmap 一致
      const node = C.nodes.find(n => n.id === this._mapFocusNode) ||
                   C.nodes.find(n => (n.locs || []).includes(s.location)) || C.nodes[0];
      const curLoc = WORLD.locations.find(l => l.id === s.location);
      const spread = 7;
      if (curLoc && curLoc.map && (node.locs || []).includes(s.location)) {
        ax = node.pos.x + (curLoc.map.x - 50) / 50 * spread;
        ay = node.pos.y + (curLoc.map.y - 50) / 50 * spread;
      } else { ax = node.pos.x; ay = node.pos.y; }
    } else {
      // Z3 及以下：用据点 pos 坐标系
      const curNode = C.nodes.find(n => (n.locs || []).includes(s.location));
      if (curNode) { ax = curNode.pos.x; ay = curNode.pos.y; }
    }

    if (ax != null && ay != null) {
      pin.hidden = false;
      pin.classList.toggle("traveling", !!s.journey);
      // 韩立头像（地图上"人在走"——比纯光圈更有代入感；id 随境界换装）
      const port = this.el("avatar-pin-portrait");
      if (port && typeof Art !== "undefined") {
        const hid = Art.heroId ? Art.heroId() : "hanli";
        const url = Art.url(hid);
        if (url && port.dataset.img !== hid) { port.style.backgroundImage = `url("${url}")`; port.dataset.img = hid; }
      }
      // 投影坐标：存 data-mx/my，由 _projectWmMarkers 统一换算屏幕位置（与 pin 同一套，缩放一致）
      pin.dataset.mx = ax; pin.dataset.my = ay;
      const k = this._wmK || 1, fx = this._wmFx != null ? this._wmFx : 50, fy = this._wmFy != null ? this._wmFy : 50;
      pin.style.left = (50 + (ax - fx) * k) + "%";
      pin.style.top = (50 + (ay - fy) * k) + "%";
    } else {
      pin.hidden = true;
      pin.classList.remove("traveling");
    }
    // 旅途状态浮标
    const js = this.el("journey-status");
    if (js) {
      if (s.journey) {
        js.hidden = false;
        js.textContent = `旅途：${s.journey.toName} ${s.journey.leg}/${s.journey.total}月`;
      } else {
        js.hidden = true;
      }
    }
  },

  /* -------- 云游（已归入世界地图 Z4 视图）-------- */
  openTravel() {
    // 旧弹窗已废弃——重定向到世界地图 Z4（当前据点地区图）
    const s = State.data;
    const C = WORLD.continent;
    const curNode = C ? C.nodes.find(n => (n.locs || []).includes(s.location)) : null;
    this._mapFocusNode = curNode ? curNode.id : null;
    this._prevZoom = this._mapZoom;
    this._mapZoom = 4;
    this._showWorldmap(true);
    this.renderWorldmap();
  },
  _travelPick(locId) {
    const l = WORLD.locations.find(x => x.id === locId);
    if (!l) return;
    const factor = Balance.travelTimeFactor(State.effectiveSpeed());
    const cost = Math.max(1, Math.round((l.travelCost || 2) * factor));
    this.el("map-detail").innerHTML = `<b>${l.name}</b>　${l.desc}
      <div style="margin-top:8px"><button class="btn btn-primary btn-mini" onclick="UI.closeModal(); Engine.travelTo('${l.id}')">前往（${cost} 月）</button></div>`;
  },

  /* -------- 大陆层（已归入世界地图 Z3 视图）-------- */
  openContinent() {
    // 旧弹窗已废弃——重定向到世界地图 Z3（胥国全景）
    this._prevZoom = this._mapZoom;
    this._mapZoom = 3;
    this._mapFocusNode = null;
    this._showWorldmap(true);
    this.renderWorldmap();
    return;
    // —— 以下旧弹窗代码保留但不再执行 ——
    const C = WORLD.continent;
    if (!C) return;
    const s = State.data;
    // 当前所在大陆节点（按地区层归属反查）
    const curNode = C.nodes.find(n => (n.locs || []).includes(s.location)) || C.nodes[0];
    const visited = s.visitedNodes || ["caixia"];
    // 路线：两端皆到过=墨痕实线（走过的路，地图记得）；否则虚线
    // polish-modao A3：n.hidden(s)=战时限定节点（魔道前线）——章外不上图，连线同隐
    const _ctHid = (n) => !!(n && n.hidden && n.hidden(s));
    const lines = C.routes.map(r => {
      const a = C.nodes.find(n => n.id === r.from), b = C.nodes.find(n => n.id === r.to);
      if (!a || !b || _ctHid(a) || _ctHid(b)) return "";
      const trod = visited.includes(a.id) && visited.includes(b.id);
      return `<line x1="${a.pos.x}" y1="${a.pos.y}" x2="${b.pos.x}" y2="${b.pos.y}" class="map-line${trod ? ' trod' : ''}"/>`;
    }).join("");
    const on = !!this._factionsOn;
    const epoch = WORLD.atlas.factionEpoch(s);
    // L3 州块（v147）：选中一州→其城·宗 pin 强调、余者退淡，详情列本州城宗
    const prefList = C.prefectures || [];
    const selPref = this._selPref || null;
    const sel = prefList.find(p => p.id === selPref) || null;
    const inPref = new Set(sel ? (sel.nodes || []) : []);
    const pins = C.nodes.map(n => {
      if (_ctHid(n)) return "";
      const here = n.id === curNode.id;
      const gateMsg = n.gate ? n.gate(s) : null;
      const cls = n.silhouette ? "silhouette" : gateMsg ? "gated" : "";
      const fac = WORLD.atlas.factionAt(n, epoch);
      const facCls = fac ? ` faction-${fac}` : "";
      const ruin = WORLD.atlas.epochPick(n.ruinByEpoch, epoch) ? " ruin" : "";
      const nm = WORLD.atlas.epochPick(n.nameByEpoch, epoch) || n.name;
      const prefCls = sel ? (inPref.has(n.id) ? " inpref" : " offpref") : "";
      return `<div class="map-pin cont ${here ? 'here' : ''} ${cls}${facCls}${ruin}${prefCls}" style="left:${n.pos.x}%;top:${n.pos.y}%"
        onclick="UI._contPick('${n.id}')">
        <span class="pin-dot"></span>
        <span class="pin-label">${nm}${here ? ' ·在此' : ''}</span>
      </div>`;
    }).join("");
    // L3 起＝点线链接（用户裁决·v149）：去掉州界框线（pref-block 多边形不再渲染），
    //   只留「点」（据点 pin）+「线」（routes 墨痕）+ 州名题字作方位标注，可点筛选本州城·宗。
    const prefLabels = prefList.map(p => {
      const L = p.label || { x: 50, y: 50 };
      return `<div class="pref-label${p.id === selPref ? ' sel' : ''}" style="left:${L.x}%;top:${L.y}%"
        onclick="UI._prefPick('${p.id}')">${p.name}</div>`;
    }).join("");
    const mapUrl = (typeof Art !== "undefined" && C.map) ? Art.url(C.map) : null;
    const facIds = this._factionsInView(C.nodes, epoch);
    const legend = on ? this._factionLegend(facIds, epoch, "宗门级势力——七派各据，黄枫谷之外余派远观；魔道入侵后灵兽山/天阙堡叛归魔道、黄枫谷南迁留旧址。") : "";
    let detailHtml;
    if (sel) {
      const members = (sel.nodes || []).map(id => {
        const nn = C.nodes.find(x => x.id === id);
        if (!nn) return "";
        const nm2 = WORLD.atlas.epochPick(nn.nameByEpoch, epoch) || nn.name;
        return `<button class="pref-city" onclick="UI._contPick('${id}')">${nm2}</button>`;
      }).join("");
      detailHtml = `<b>${sel.name}</b>　${sel.desc}<div class="pref-cities">本州城·宗：${members || "—"}</div>`;
    } else {
      const curNm = WORLD.atlas.epochPick(curNode.nameByEpoch, epoch) || curNode.name;
      const curDesc = WORLD.atlas.epochPick(curNode.descByEpoch, epoch) || curNode.desc;
      detailHtml = `<b>${curNm}</b>　${curDesc}`;
    }
    this._atlasReopen = () => this.openContinent();
    this.openModal(`
      ${this._atlasCrumbs("yueguo")}
      <h2 class="atlas-title">${C.name} · 十三州</h2>
      <p style="color:var(--ink-dim);font-size:12px">点州名看一州城·宗，点据点可启程——看得见的远方，未必去得了：修为、盘缠、机缘，缺一不可。</p>
      <div class="worldmap continent${mapUrl ? ' inked' : ''}${on ? ' show-factions' : ''}"${mapUrl ? ` style="background-image:url('${mapUrl}')"` : ''}>
        <div class="map-mist"></div>
        <div class="map-mist far"></div>
        <svg class="map-lines" viewBox="0 0 100 100" preserveAspectRatio="none">${lines}</svg>
        ${prefLabels}
        ${pins}
      </div>
      ${legend}
      <div id="cont-detail" class="map-detail">${detailHtml}</div>
      <div class="modal-actions">
        ${this._factionToggleBtn()}
        <button class="btn btn-ghost" onclick="UI.closeModal()">收起</button>
      </div>
    `, "wide");
  },
  // 点州名：切换选中（再点取消）→ 就地重绘（仅在详情列本州城·宗，不染地图、不高亮钉）
  _prefPick(id) {
    this._selPref = (this._selPref === id) ? null : id;
    this.openContinent();
  },
  _contPick(nodeId) {
    const C = WORLD.continent;
    const n = C.nodes.find(x => x.id === nodeId);
    if (!n) return;
    const s = State.data;
    const epoch = WORLD.atlas.factionEpoch(s);
    const nm = WORLD.atlas.epochPick(n.nameByEpoch, epoch) || n.name;
    const desc = WORLD.atlas.epochPick(n.descByEpoch, epoch) || n.desc;
    const gateMsg = n.gate ? n.gate(s) : null;
    let action = "";
    if (n.silhouette) action = `<div class="cont-gate">传说之地——此生若能至，方不负修行。</div>`;
    else if (gateMsg) action = `<div class="cont-gate">道途未通：${gateMsg}</div>`;
    else if ((n.locs || []).includes(s.location)) action = `<div class="cont-gate" style="color:var(--jade-bright)">你正在此地。${n.localMap ? `　<button class="btn btn-secondary btn-mini" onclick="UI.openTravel()">入内 · 云游 ▸</button>` : ""}</div>`;
    else action = `<div class="cont-gate">旅途约 ${n.months || 2} 月 · 险度${n.danger || "未知"}　
      <button class="btn btn-primary btn-mini" onclick="Engine.startJourney('${n.id}')">启程</button></div>`;
    this.el("cont-detail").innerHTML = `<b>${nm}</b>　${desc}${action}`;
  },

  /* ============================================================
   * 舆图（分层大地图）——常驻入口，逐级下钻/上卷：人界 ▸ 大区 ▸ 国别/联盟 ▸ 据点
   * 上层（人界/大区）由 openAtlas 通用渲染；胥国(国别)叶层 = openContinent（水墨舆图）。
   * 不传 levelId = 从当前所在的国别层打开（先看到「我在哪」，再决定「去哪」）。
   * ============================================================ */
  openAtlas(levelId) {
    // 旧弹窗已废弃——重定向到世界地图
    levelId = levelId || this._atlasCurrentLevel();
    if (levelId === "yueguo") return this.openContinent();
    const L = WORLD.atlas && WORLD.atlas.levels[levelId];
    if (!L) return this.openContinent();
    // 确定缩放级别：world=Z1, region=Z2
    this._prevZoom = this._mapZoom;
    this._mapZoom = (L.kind === "world") ? 1 : 2;
    this._showWorldmap(true);
    this.renderWorldmap();
    return;
    // —— 以下旧弹窗代码保留但不再执行 ——
    const s = State.data;
    const on = !!this._factionsOn;
    const epoch = WORLD.atlas.factionEpoch(s);
    const pathSet = this._atlasPathSet();
    // 相邻大域切片（v144）：共享边界的顶点集——交界处/边框点钉死(锐角对齐)，其余海岸柔化成曲线，
    // 保证相邻块严丝合缝、无重叠无空隙地拼满全图。
    const pinSet = this._atlasPinSet(L);
    // 区块：沿真实轮廓描的多边形 + 解锁三态 + 势力标签（按纪元投影）
    const rendered = L.nodes.map(n => {
      const st = this._atlasNodeState(n, s, pathSet);
      const d = this._atlasPath(n, pinSet);
      const drill = (st !== "locked" && n.to) ? `UI._atlasGoto('${n.to}')` : "";
      const facId = WORLD.atlas.factionAt(n, epoch);
      const fac = facId ? ` faction-${facId}` : "";
      return { st, d, block: `<path class="region-block ${st}${fac}" d="${d}"
        onclick="UI._atlasPick('${levelId}','${n.id}')" ondblclick="${drill}"></path>` };
    });
    const blocks = rendered.map(r => r.block).join("");
    // 未解锁区域并集（v145）：压成暗色剪影、只透出轮廓，其上裁一层缓缓漂浮的云罩（动效）。
    // 已解锁/在此块不在此集——保持明亮、无云。全解锁后云罩自然散尽，天朗气清。
    const lockedClip = rendered.filter(r => r.st === "locked").map(r => `<path d="${r.d}"/>`).join("");
    const defs = lockedClip
      ? `<defs><clipPath id="atlasLockedClip" clipPathUnits="userSpaceOnUse">${lockedClip}</clipPath></defs>`
      : "";
    const shroud = lockedClip ? this._atlasCloudShroud() : "";
    const labels = L.nodes.map(n => {
      const st = this._atlasNodeState(n, s, pathSet);
      const lab = n.label || n.pos;
      const tag = st === "here" ? '<span class="here-tag"> ·在此</span>' : "";
      return `<div class="block-label ${st}" style="left:${lab.x}%;top:${lab.y}%"
        onclick="UI._atlasPick('${levelId}','${n.id}')">${n.name}${tag}</div>`;
    }).join("");
    const cur = L.nodes.find(n => this._atlasNodeState(n, s, pathSet) === "here") || L.nodes[0];
    const curSt = this._atlasNodeState(cur, s, pathSet);
    const curTag = curSt === "here" ? " ·在此" : "";
    const mapUrl = (typeof Art !== "undefined" && L.map) ? Art.url(L.map) : null;
    // 图例：L1 人界用「该纪元存在的大势力」概览（不留虚影）；L2 用「视野内实际出现的势力」。
    const facIds = L.kind === "world" ? WORLD.atlas.factionsAtEpoch(epoch) : this._factionsInView(L.nodes, epoch);
    const legend = on ? this._factionLegend(facIds, epoch, L.factionOverview) : "";
    this._atlasReopen = () => this.openAtlas(levelId);
    this.openModal(`
      ${this._atlasCrumbs(levelId)}
      <h2 class="atlas-title">${L.name}</h2>
      <p style="color:var(--ink-dim);font-size:12px">${L.blurb}</p>
      <div class="worldmap continent atlas-${L.kind}${mapUrl ? ' atlas-painted' : ''}${on ? ' show-factions' : ''}"${mapUrl ? ` style="background-image:url('${mapUrl}')"` : ''}>
        <div class="map-mist"></div>
        <div class="map-mist far"></div>
        <svg class="region-blocks" viewBox="0 0 100 100" preserveAspectRatio="none">${defs}${blocks}${shroud}</svg>
        ${labels}
      </div>
      ${legend}
      <div id="cont-detail" class="map-detail"><b>${cur.name}${curTag}</b>　${cur.desc}${this._atlasNodeAction(cur, curSt)}</div>
      <div class="modal-actions">
        ${this._factionToggleBtn()}
        <button class="btn btn-ghost" onclick="UI.closeModal()">收起</button>
      </div>
    `, "wide");
  },
  _atlasPick(levelId, nodeId) {
    const L = WORLD.atlas && WORLD.atlas.levels[levelId];
    const n = L && L.nodes.find(x => x.id === nodeId);
    if (!n) return;
    const st = this._atlasNodeState(n, State.data, this._atlasPathSet());
    const tag = st === "here" ? " ·在此" : "";
    this.el("cont-detail").innerHTML = `<b>${n.name}${tag}</b>　${n.desc}${this._atlasNodeAction(n, st)}`;
  },
  _atlasNodeAction(n, state) {
    if (state !== "locked" && n.to)
      return `<div class="cont-gate"><button class="btn btn-primary btn-mini" onclick="UI._atlasGoto('${n.to}')">进入${n.name} ▸</button></div>`;
    if (state === "locked")
      return `<div class="cont-gate">${n.silhouette ? "远观之地——尚不可至" : "道途未通——暂不可往"}，且记在心头。</div>`;
    return "";
  },
  /* 区块轮廓（v144）：把节点画成「云水间的一块陆域」——据 id 生成确定性有机岛形，平滑成曲线海岸线，
     去掉 v143 等大六边形的叠压感。有 n.poly（显式描的点串）则用之，否则自动生成。SVG 坐标 0-100 同 viewBox。 */
  _atlasPath(n, pinSet) {
    if (n.poly) {
      return n.poly.trim().split(/\s*;\s*/).map(ring => {
        const tok = ring.trim().split(/\s+/);
        const pts = tok.map(p => p.split(",").map(Number));
        return pinSet
          ? this._smoothOrganicPath(pts, tok.map(p => pinSet.has(p)))
          : this._smoothClosedPath(pts);
      }).join("");
    }
    return this._smoothClosedPath(this._atlasIslandPoints(n));
  },
  /* 未解锁区域的漂浮云罩（v145）：两层分形噪声雾（feTurbulence）——柔边、不规则、半透的薄云气，
     缓缓反向漂移，只裁进「未解锁块并集」内显形。暗罩压低、轮廓透出，已解锁块无云、明亮。 */
  _atlasCloudShroud() {
    // 一层雾：分形噪声 → 经 feColorMatrix 取阈值，生成破碎的白色云絮（RGB 恒为冷白，A=噪声过阈）。
    const filt = (id, freq, aMul, aOff) =>
      `<filter id="${id}" x="-25%" y="-25%" width="150%" height="150%" color-interpolation-filters="sRGB">` +
      `<feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="3" seed="${id.length * 7}" stitchTiles="stitch" result="n"/>` +
      `<feColorMatrix in="n" type="matrix" values="0 0 0 0 0.84  0 0 0 0 0.88  0 0 0 0 0.95  0 0 0 ${aMul} ${aOff}"/>` +
      `</filter>`;
    const layer = (cls, id) =>
      `<g class="fog-drift ${cls}"><rect x="-45" y="-45" width="190" height="190" filter="url(#${id})"/></g>`;
    return `<g class="cloud-shroud" clip-path="url(#atlasLockedClip)">` +
      `<defs>${filt("atlasFogA", "0.016 0.023", 1.05, -0.5)}${filt("atlasFogB", "0.010 0.015", 0.8, -0.55)}</defs>` +
      layer("a", "atlasFogA") + layer("b", "atlasFogB") + `</g>`;
  },
  /* 相邻大域切片的「钉点」集：被 ≥3 块共用的交界点、或落在图框边上的点——这些必须钉死成锐角，
     才能让相邻块在交界处精确对齐；其余（仅两块共用的）海岸点柔化。返回 "x,y" 字符串集合。 */
  _atlasPinSet(L) {
    const cnt = new Map();
    for (const n of L.nodes) {
      if (!n.poly) continue;
      n.poly.trim().split(/\s*;\s*/).forEach(ring =>
        new Set(ring.trim().split(/\s+/)).forEach(p => cnt.set(p, (cnt.get(p) || 0) + 1))
      );
    }
    const pin = new Set();
    for (const [p, c] of cnt) {
      const xy = p.split(",").map(Number);
      if (c >= 3 || xy[0] === 0 || xy[0] === 100 || xy[1] === 0 || xy[1] === 100) pin.add(p);
    }
    return pin;
  },
  /* 共享边界平滑：过各边中点的二次贝塞尔。钉点处走直线穿过顶点(锐角)，其余顶点圆弧柔化。
     所有几何只由「边中点 + 顶点」决定——相邻块共用同一条边时两侧算出的曲线逐字节相同，故无缝。 */
  _smoothPinnedPath(pts, pinned) {
    const n = pts.length;
    if (n < 2) return this._smoothClosedPath(pts);
    const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const f = v => v.toFixed(2);
    const start = mid(pts[n - 1], pts[0]);
    let d = `M${f(start[0])},${f(start[1])}`;
    for (let i = 0; i < n; i++) {
      const cur = pts[i], next = pts[(i + 1) % n];
      const mOut = mid(cur, next);
      d += pinned[i]
        ? `L${f(cur[0])},${f(cur[1])}L${f(mOut[0])},${f(mOut[1])}`
        : `Q${f(cur[0])},${f(cur[1])} ${f(mOut[0])},${f(mOut[1])}`;
    }
    return d + "Z";
  },
  /* 有机边界（v145）：把僵硬的直线 Voronoi 边换成自然蜿蜒的国界/海岸线。每条「非图框」边按两端点
     插入确定性「中点位移」抖动点，再交给 _smoothPinnedPath 柔化。几何只由两端点决定——相邻块共用
     同一条边时两侧逐字节相同，故仍无缝；贴外框的边保持笔直，外轮廓不乱。 */
  _smoothOrganicPath(pts, pinned) {
    const n = pts.length;
    if (n < 2) return this._smoothClosedPath(pts);
    const frameEdge = (a, b) =>
      (a[0] === 0 && b[0] === 0) || (a[0] === 100 && b[0] === 100) ||
      (a[1] === 0 && b[1] === 0) || (a[1] === 100 && b[1] === 100);
    const dense = [], corner = [];
    for (let i = 0; i < n; i++) {
      const a = pts[i], b = pts[(i + 1) % n];
      dense.push(a); corner.push(!!pinned[i]);
      if (!frameEdge(a, b)) {
        for (const m of this._organicEdgePoints(a, b)) { dense.push(m); corner.push(false); }
      }
    }
    return this._smoothPinnedPath(dense, corner);
  },
  /* 一条边的确定性抖动点（中点位移 / fractal）：沿边轴做一维高度场位移（恒沿同一法向，不会自交），
     按「排序后的两端点」定种 + 计算法向，故 a→b 与 b→a 得到同一批点（仅顺序相反），保证相邻块共线。 */
  _organicEdgePoints(a, b) {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 3) return [];
    let p = a, q = b, rev = false;
    if (a[0] > b[0] || (a[0] === b[0] && a[1] > b[1])) { p = b; q = a; rev = true; }
    const rng = this._rng(`${p[0]},${p[1]}|${q[0]},${q[1]}`);
    const nx = -(q[1] - p[1]) / len, ny = (q[0] - p[0]) / len;   // 单位法向
    const amp = Math.min(len * 0.14, 2.6);
    const out = [];
    const recur = (p0, p1, a0, depth) => {
      if (depth === 0) return;
      const off = (rng() * 2 - 1) * a0;
      const m = [(p0[0] + p1[0]) / 2 + nx * off, (p0[1] + p1[1]) / 2 + ny * off];
      recur(p0, m, a0 * 0.5, depth - 1);
      out.push(m);
      recur(m, p1, a0 * 0.5, depth - 1);
    };
    recur(p, q, amp, 3);
    return rev ? out.reverse() : out;
  },
  _atlasIslandPoints(n) {
    const cx = n.pos.x, cy = n.pos.y, base = n.r || 5.8;
    const rng = this._rng(n.id), N = 11, pts = [];
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      const j = 0.76 + rng() * 0.42;            // 0.76~1.18 起伏，海岸自然
      pts.push([cx + Math.cos(a) * base * 1.12 * j, cy + Math.sin(a) * base * j]);
    }
    return pts;
  },
  // 闭合 Catmull-Rom → 三次贝塞尔，柔化成海岸曲线
  _smoothClosedPath(pts) {
    const n = pts.length;
    let d = `M${pts[0][0].toFixed(2)},${pts[0][1].toFixed(2)}`;
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
      const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
      const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += `C${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)}`;
    }
    return d + "Z";
  },
  // 确定性小随机（mulberry32，按节点 id 取种）——每次形状一致，存档/刷新不抖动
  _rng(id) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619); }
    let a = h >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  },
  /* 当前所在层到根的层 id 集合（用于判定区块「在此」）。 */
  _atlasPathSet() {
    const set = new Set();
    let cur = this._atlasLevel(this._atlasCurrentLevel());
    let guard = 0;
    while (cur && guard++ < 8) { set.add(cur.id); cur = cur.parent ? this._atlasLevel(cur.parent) : null; }
    return set;
  },
  /* 区块三态：here(当前·在此) / lit(已点亮·可下钻) / locked(暗雾·远观)。 */
  _atlasNodeState(n, s, pathSet) {
    if (n.to && pathSet && pathSet.has(n.to)) return "here";
    const lit = n.unlock ? !!n.unlock(s) : !!n.reach;
    return lit ? "lit" : "locked";
  },
  // 跳到某一层（叶层胥国 = 水墨舆图；上层 = 通用渲染）
  _atlasGoto(id) { if (id === "yueguo") { this._selPref = null; return this.openContinent(); } return this.openAtlas(id); },
  // 单层的元信息（统一处理 atlas 上层 与 胥国叶层）
  _atlasLevel(id) {
    if (id === "yueguo") {
      const C = WORLD.continent;
      return { id: "yueguo", crumb: (C && C.name) || "胥国", parent: (C && C.parent) || "tiannan" };
    }
    const L = WORLD.atlas && WORLD.atlas.levels[id];
    return L ? { id, crumb: L.crumb || L.name, parent: L.parent || null } : null;
  },
  // 当前所在的国别层（目前只实装胥国；将来按节点反查所属国）
  _atlasCurrentLevel() {
    const C = WORLD.continent;
    return (C && C.atlasId) || "yueguo";
  },
  // 面包屑（支持5级：人界 ▸ 天南 ▸ 胥国 ▸ 州 ▸ 城，§9）——沿 parent 链通用回溯到根，除当前层外皆可点击上卷。
  // 当前数据深度=3（人界/天南/胥国）；州·城层将于 v146/v147 接入，面包屑机制已就绪、无需再改。
  _atlasCrumbs(levelId) {
    const path = [];
    let cur = this._atlasLevel(levelId);
    let guard = 0;
    while (cur && guard++ < 8) {
      path.unshift(cur);
      cur = cur.parent ? this._atlasLevel(cur.parent) : null;
    }
    return `<div class="atlas-crumbs">${path.map((c, i) => {
      const last = i === path.length - 1;
      return last
        ? `<span class="crumb active">${c.crumb}</span>`
        : `<button class="crumb" onclick="UI._atlasGoto('${c.id}')">${c.crumb}</button><span class="crumb-sep">▸</span>`;
    }).join("")}</div>`;
  },

  /* -------- 势力叠加层（v146 §9）：贯穿 L1/L2/L3 的「势力」toggle，层级越深粒度越细 -------- */
  // 切换势力图层：翻转开关并就地重绘当前舆图层（_atlasReopen 由 openAtlas/openContinent 设定）。
  toggleFactions() {
    this._factionsOn = !this._factionsOn;
    if (!this.el("worldmap-canvas").hidden) { this.renderWorldmap(); return; }
    if (this._atlasReopen) this._atlasReopen();
  },
  // 当前剧情纪元名（图例顶部标注；红线：魔道/慕兰篇默认停在纪元0）。
  _factionEpochName(epoch) {
    return ["七玄门篇", "魔道入侵篇", "四分天下·天道盟立", "慕兰大举入侵·天南联盟"][epoch] || "七玄门篇";
  },
  // 「势力」开关按钮（开=高亮）。
  _factionToggleBtn() {
    const on = !!this._factionsOn;
    return `<button class="btn btn-mini fac-toggle${on ? ' on' : ''}" onclick="UI.toggleFactions()">${on ? '势力 ·开' : '势力'}</button>`;
  },
  // 视野内某纪元实际出现的势力（按 canon 顺序去重）——L2/L3 图例用。
  _factionsInView(nodes, epoch) {
    const order = ["qipai", "zhengdao", "modao", "jiuguo", "tiandao", "mulan"];
    const present = new Set();
    for (const n of nodes) {
      const f = WORLD.atlas.factionAt(n, epoch);
      if (f) present.add(f);
    }
    return order.filter(id => present.has(id));
  },
  // 势力图例：纪元标注 + 色块清单 + 一句概览（L1=人界概述/L2=国级主导/L3=宗门级）。
  _factionLegend(facIds, epoch, overview) {
    const F = (WORLD.atlas && WORLD.atlas.factions) || {};
    const items = (facIds || []).map(id => {
      const f = F[id] || {};
      return `<span class="fac-item"><i class="fac-swatch faction-${id}"></i>${f.short || f.name || id}</span>`;
    }).join("");
    return `<div class="faction-legend">
      <div class="fac-epoch">势力图层 · ${this._factionEpochName(epoch)}</div>
      <div class="fac-items">${items}</div>
      ${overview ? `<div class="fac-note">${overview}</div>` : ""}
    </div>`;
  },

  /* -------- 集镇采买 -------- */
  openMarket() {
    const s = State.data;
    const blackMarket = s.rippleWindow && s.rippleWindow.id === "cheap_pills";
    const shop = [
      { id: "lingcao", price: 3 }, { id: "duyao_cao", price: 6 }, { id: "anqi", price: 3 },
      { id: "qingyuan_dan", price: blackMarket ? 3 : 8, sale: blackMarket }, { id: "huixue_dan", price: 6 }, { id: "ningshen_dan", price: 14 },
      { id: "huoshe_fu", price: 12 }, { id: "hanbing_fu", price: 12 },
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
    // polish A6：皮货行收购（wanbaoSell 同构·八折）——妖材战利在本章即可变现
    const sellables = Object.keys(s.inventory || {}).filter(id => {
      const it = DATA.items[id];
      return it && it.sell && State.count(id) > 0;
    });
    const sellHtml = sellables.length ? `
      <h3 style="margin:14px 0 6px;font-size:14px;color:var(--ink-dim)">皮货行 · 收购（凡人行市·八折）</h3>
      ${sellables.map(id => {
        const it = DATA.items[id];
        return `<div class="market-item">
          <span><span class="iname">${it.name}</span><span style="color:var(--ink-dim);font-size:12px">　×${State.count(id)}</span></span>
          <button class="btn btn-mini" onclick="Engine.marketSell('${id}')"><span class="mprice">售 ${Math.max(1, Math.round(it.sell * 0.8))}两</span></button>
        </div>`;
      }).join("")}` : "";
    this.openSheet(`
      <h2>山下集镇 · 采买</h2>
      <p style="color:var(--ink-dim)">纹银：${State.data.silver} 两</p>
      ${blackMarket ? '<p style="color:var(--gold);font-size:12px">巷尾的药贩子朝你挤眼——丹房失窃的那批养元丹，正在黑市贱卖。过了这村没这店。</p>' : ''}
      ${html}
      ${sellHtml}
      <div class="modal-actions"><button class="btn btn-ghost" onclick="UI.closeSheet()">离开</button></div>
    `);
  },

  /* -------- 太南小会（修仙者的集市）-------- */
  openFair() {
    const s = State.data;
    const goods = Engine.FAIR_GOODS.map(g => {
      // 符箓方案（购谱解锁，非入袋）：名取方案名，已购则置灰
      if (g.plan) {
        const plan = DATA.fuluPlans[g.plan];
        const owned = (s.fuluPlans || []).includes(g.plan);
        return `<div class="market-item">
          <span><span class="iname rare">${plan.name}</span>
            <span style="color:var(--gold);font-size:11px">　${g.note || ""}</span>
            <span style="color:var(--ink-dim);font-size:12px">　${plan.blurb}</span></span>
          ${owned ? `<span style="color:var(--ink-faint);font-size:12px">已购得</span>`
                  : `<button class="btn btn-mini" onclick="Engine.fairBuy('${g.id}')"><span class="mprice">灵石${g.price}</span></button>`}
        </div>`;
      }
      const buyId = g.buy || g.id;
      const item = DATA.items[buyId];
      const owned = g.once && State.count(buyId) > 0;
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
    this.openSheet(`
      <h2>太南小会 · 赶集</h2>
      <p style="color:var(--ink-dim)">灵石：${State.count("lingshi")} 枚　纹银在这里没人收——修仙人只认灵石。</p>
      ${goods}
      <h3 class="panel-title" style="margin-top:10px">以物易石（摊主收购）</h3>
      ${sells}
      <div class="modal-actions"><button class="btn btn-ghost" onclick="UI.closeSheet()">离开</button></div>
    `);
  },

  /* -------- 万宝楼（黄枫谷坊市）：一层消耗品，二层筑基法器 -------- */
  openWanbao() {
    const s = State.data;
    // polish A4·涟漪②：让利窗内二层法器标八折价（与 Engine.wanbaoBuy 计价同源）
    const onSale = !!(s.rippleWindow && s.rippleWindow.id === "wanbao_sale");
    const row = (g) => {
      const item = DATA.items[g.id];
      const owned = g.once && State.count(g.id) > 0;
      const sale = onSale && g.floor2;
      const price = sale ? Math.max(1, Math.round(g.price * 0.8)) : g.price;
      return `<div class="market-item">
        <span><span class="iname ${item.rarity === 'rare' ? 'rare' : item.rarity === 'epic' ? 'epic' : ''}">${item.name}</span>${g.n > 1 ? `×${g.n}` : ""}
          ${g.note ? `<span style="color:var(--gold);font-size:11px">　${g.note}</span>` : ""}
          ${sale ? `<span style="color:var(--cinnabar);font-size:11px">　让利八折·限时</span>` : ""}
          <span style="color:var(--ink-dim);font-size:12px">　${item.desc}</span></span>
        ${owned ? `<span style="color:var(--ink-faint);font-size:12px">已购得</span>`
                : `<button class="btn btn-mini" onclick="Engine.wanbaoBuy('${g.id}')"><span class="mprice">${sale ? `<s style="opacity:.6">灵石${g.price}</s> ` : ""}灵石${price}</span></button>`}
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
    // 向之礼：在坊市廊下晒太阳的"老杂役"——他的指点分文不取
    const xiangUrl = (typeof Art !== "undefined") ? Art.url("xiangzhili") : null;
    const xiangFace = xiangUrl
      ? `<img src="${xiangUrl}" alt="向之礼" style="width:34px;height:34px;border-radius:50%;object-fit:cover;object-position:top;vertical-align:middle;margin-right:6px;border:1px solid var(--line)" />`
      : "";
    const xiang = s.flags.xueshi_intel
      ? `<div class="market-item"><span>${xiangFace}<span style="color:var(--jade-bright);font-size:12px">向之礼的指点你记在心里：血色主药在禁地，名额看修为（练气十一层）与大比时节。</span></span></div>`
      : `<div class="market-item">
          <span>${xiangFace}<span class="iname">廊下晒太阳的向老头</span><span style="color:var(--ink-dim);font-size:12px">　他朝你招了招手，似乎有话要说。</span></span>
          <button class="btn btn-mini" onclick="Engine.xiangIntel()">上前听他闲谈</button>
        </div>`;
    this.openSheet(`
      <h2>万宝楼 · 采买</h2>
      <p style="color:var(--ink-dim)">灵石：${State.count("lingshi")} 枚　纹银：${s.silver} 两（坊市只认灵石）</p>
      ${floor1}
      <h3 class="panel-title" style="margin-top:10px">二层 · 法器阁（练气十一层方可驱使）</h3>
      ${floor2}
      <h3 class="panel-title" style="margin-top:10px">以物易石（掌柜收购）</h3>
      ${sells}
      <h3 class="panel-title" style="margin-top:10px">坊市闲人</h3>
      ${xiang}
      <div class="modal-actions"><button class="btn btn-ghost" onclick="UI.closeSheet()">离开</button></div>
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
    // 海战（S5）：怒涛之上无立锥之地——全员踏浪凌空（sea-field=单位浮沉呼吸+错相荡摆）
    {
      const fieldSea = this.el("axis-field");
      if (fieldSea) fieldSea.classList.toggle("sea-field", !!(Engine._combat && Engine._combat.sea));
    }
    // 战场天象（S5 用户提案：三层分层+氛围粒的战场化——海战闪电浪风雷鸣/森林鸟鸣光束…）
    this._startBattleAmbience(meta);
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
    // 观阵：拉远看全战场（保大战场，解决手机端看不全）——纯取景切换，不耗回合
    this._surveyMode = false;
    const surveyBtn = this.el("combat-survey");
    if (surveyBtn) {
      surveyBtn.classList.remove("on");
      surveyBtn.onclick = () => this.toggleSurvey();
      // 只有"宽到一屏看不全"的战场才需要观阵（W>13），窄场藏起来
      surveyBtn.hidden = !(combat.W > 13);
    }
    const logBtn = this.el("combat-logbtn");
    if (logBtn) logBtn.onclick = () => {
      const lg = this.el("combat-log");
      if (lg) { lg.hidden = !lg.hidden; if (!lg.hidden) lg.scrollTop = lg.scrollHeight; }
    };
    const lg0 = this.el("combat-log"); if (lg0) lg0.hidden = true;
    this._combatTarget = this._nearestEnemyIdx(combat);   // 默认锁最近活敌（宽场不默认打远处那个）
    this._combatLogLen = combat.log.length;
    if (typeof Sfx !== "undefined") {
      Sfx.play("danger");
      // BGM 换轨：危险/紧张度分级 × 场景调色（详见 _combatBgm）——
      // 决战/妖王/越级=boss 压迫轨；心魔=tense；普通斗法按场景换轨（秘境/野外/默认）
      if (Sfx.bgm) Sfx.bgm(this._combatBgm(meta, combat));
    }
    // 冷启动预热（v106）：建好特效画布并上传辉光纹理 + 预解码本局战斗立绘——
    // 把"第一次施法"才触发的 GPU 纹理上传/立绘解码提前到开战瞬间，根治开局卡顿。
    if (typeof Fx !== "undefined" && Fx.warm) Fx.warm(this.el("axis-field"));
    this._warmCombatArt(combat, meta);
    this.renderCombat(combat, meta);
    this._flashCombatBanner(meta, combat);
    this._combatBriefing(combat, meta);
    // 开场扫场（B3）：多战线团战横扫各战区一遍再落回韩立（_frontSweep 自带多战线/宽轴守卫）
    this._frontSweep(combat);
  },

  // 首战战法提示 + 灵力→法力池说明（零教学≠零提示：挂在修仙常识上）
  _combatBriefing(combat, meta) {
    const s = State.data;
    if (!combat || !s) return;
    const pct = s.spiritMax > 0 ? Math.round((s.spirit / s.spiritMax) * 100) : 100;
    const mp = combat.player && combat.player.mpMax != null ? combat.player.mpMax : null;
    if (!s.flags.combat_briefed) {
      State.setFlag("combat_briefed");
      combat._log("【战法】术法够不着时，先点脚下格子「走」贴近，再点法术出牌；牌上标「射程外」= 还差几步。点「结束回合」让敌方行动。");
    }
    if (mp != null && pct < 55) {
      combat._log(`【战前】灵力充盈 ${pct}% → 本战法力约 ${mp}。灵力偏低，术法连用要省着点。`);
    } else if (mp != null && !s.flags.combat_mp_noted) {
      s.flags.combat_mp_noted = true;
      combat._log(`【战前】灵力 ${pct}% → 本战法力 ${mp}（斗法耗的是法力池，与气血分开）。`);
    }
    State.save();
  },

  // 敌人名 → 立绘（剧情人物用其立绘；心魔用业障之人的脸，无业障用韩立暗影）
  _artIdByName(name) {
    if (!name || typeof Art === "undefined") return null;
    if (/心魔|劫/.test(name)) {
      if (/墨大夫/.test(name)) return "modafu";
      if (/张铁/.test(name)) return "zhangtie";
      return "hanli";
    }
    if (/曲魂|铁奴/.test(name)) return Art.has("tienu") ? "tienu" : "zhangtie";
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
      [/曲魂|铁奴|张铁尸傀/, "bt_tienu"],
      [/万小山/, "bt_wanxiaoshan"],
      [/余子童/, "bt_yuzitong"],       // 元神残魂：半透明青白魂体专属立绘（剪影仍作兜底）
      [/墨蛟/, "bt_mojiao"],
      [/封岳/, "bt_fengyue"],          // 狙杀者专属战姿（v301 生图批兑现，散修占位退役）
      // 增量G·京城暗流：血茧铁罗（化茧形态）须在「铁罗」之前——"血茧铁罗"含"铁罗"，否则会误命中一阶段立绘
      [/血茧铁罗|血茧|化茧/, "bt_tieluo_mao"],
      [/铁罗/, "bt_tieluo"],
      [/王蝉/, "bt_zhanwangchan"],     // 鬼灵门少主（2026-07-09 考据勘误后专属战姿）
      [/温天仁/, "bt_wentianren"],     // 六道极圣之徒（正典：麻衣高冠赤足·眉宇金芒）
      [/王管事/, "bt_wuse"],
      // 增量H·皇宫决战：黑煞教低阶血侍 mook（须在「铁罗」之后——"血侍铁罗"含"铁罗"已先命中一阶段 boss 立绘）
      [/血侍/, "bt_xueshi"],
      // 初入星海篇·镇妖大典/外星海/逆星盟（专属战斗立绘）
      [/婴鲤兽/, "bt_yingli"],
      [/外星海妖兽|外海妖兽|海妖/, "bt_waihai"],
      [/逆星盟古长老|古长老/, "bt_guzhanglao"],
      // 再别天南篇（polish-zaibie C5·Fable P1-8）：字牌裸奔四敌落通用底——
      //   夺舍者=散修底（真身 bt_duoshezhe 生图批立案）；童老/鬼老=黑袍血镰魔修底（王蝉一方阴修最贴）
      [/夺舍者|御灵宗/, "bt_sanxiu"],
      [/童老|鬼老/, "bt_moxiu"],
      [/鬼灵门/, "bt_moxiu"],          // polish-zaibie A3：矿洞追兵换皮鬼灵门（执事/修士）——王蝉一方阴修同底

      // 类型谱共用
      [/赤目狼王|血煞兽/, "bt_chimu"],
      [/虎/, "bt_baihu"],
      // 金背妖螂：铁背蜈蚣王占位（甲壳巨虫形近·bt_jinbei 生图批立案后替换专属映射）
      [/金背妖螂|妖螂/, "bt_wugong"],
      [/蜈蚣/, "bt_wugong"],
      [/狼(?!帮)/, "bt_wolf"],         // 灵狼/狼群（狼王规则在前已截获）；"野狼帮"含"狼"故排除→下行专属人形
      [/野狼帮|喽啰/, "bt_yelang"],     // 野狼帮打手：兽皮坎肩+狼牙棒专属人形立绘
      [/山贼|贼|匪|流寇/, "bt_bandit"],
      [/弟子|武师|打手|蛮修/, "bt_wuren"],
      [/散修|修士|枯修|老怪/, "bt_sanxiu"],
    ];
    for (const [re, id] of MAP) { if (re.test(name) && Art.hasBattler(id)) return id; }
    return null;
  },

  // D2：无专属立绘的元神/残魂 → 借现成人形轮廓做「黑色剪影」占位。
  // 剪影靠 .au-shade 的 mask-image（取人形 alpha）+ 暗色底，不动 .au-img/滤镜（守红线）。
  _ghostShade(u) {
    if (!u || typeof Art === "undefined" || !Art.battlerUrl || !Art.hasBattler) return null;
    const ghost = u.nature === "ghost" || /元神|残魂|幽魂|魂魄|怨灵|阴影/.test(u.name || "");
    if (!ghost) return null;
    const shapeId = ["bt_sanxiu", "bt_wuren", "bt_hanli"].find(id => Art.hasBattler(id));
    if (!shapeId) return null;
    const url = Art.battlerUrl(shapeId);
    if (!url) return null;
    return `<div class="au-shade" style="-webkit-mask-image:url('${url}');mask-image:url('${url}')"></div>`;
  },

  // 冷启动预热（v106）：开战即把本局会用到的战斗立绘提前 decode——
  // 否则"第一次施法"那拍才解码立绘=主线程卡顿。纯预解码、无视觉副作用。
  _warmCombatArt(combat, meta) {
    if (!combat || typeof Image === "undefined" || typeof Art === "undefined" || !Art.battlerUrl) return;
    const ids = new Set();
    const add = id => { if (id && Art.hasBattler(id)) ids.add(id); };
    const heroBt = Art.heroBattlerId ? Art.heroBattlerId() : "bt_hanli";  // 玩家随当前换装
    add(heroBt); add(heroBt + "_fly"); add("bt_hanli"); add("bt_hanli_fly"); // 当前造型（含飞姿）+ 基础回退
    (combat.enemies || []).forEach(e => {
      if (!e) return;
      add(e.art && Art.hasBattler("bt_" + e.art) ? "bt_" + e.art : this._battlerByName(e.name));
      if (this._ghostShade(e)) ["bt_sanxiu", "bt_wuren", "bt_hanli"].some(id => Art.hasBattler(id) && (add(id), true)); // D2 剪影形状
    });
    (combat.sides || (combat.side ? [combat.side] : [])).forEach(u => {
      if (!u) return;
      add(u.art && Art.hasBattler("bt_" + u.art) ? "bt_" + u.art : this._battlerByName(u.name));
    });
    ids.forEach(id => {
      const url = Art.battlerUrl(id);
      if (!url) return;
      const img = new Image();
      img.src = url;
      if (img.decode) img.decode().catch(() => {});
    });
  },

  // 地点/战斗类型 → 战场底图基名（三层制：基名+_far/_mid 取层；单图回退用基名本身）
  _battleBaseFor(loc, meta) {
    if (meta && (meta.type === "showdown" || meta.type === "jinguang")) return "bt_night";
    // 乱星海·海战（S5）：怒涛之上无立锥之地——外海系战斗一律走星海底图（战位带=浪面上空）
    if (meta && ["wentianren_demo", "xh_haiwang", "xh_lingyuling", "ss_waihai"].indexOf(meta.type) >= 0) return "bt_xinghai";
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
    const outro = this.el("combat-outro"); if (outro) outro.hidden = true;
    // §9-5 危局氛围收束：撤边缘脉动 + 停心跳低鼓（战斗一关即清，绝不漏到地图）
    const ov = this.el("combat-overlay"); if (ov) ov.classList.remove("peril", "brink");
    this._perilLevel = 0;
    if (typeof Sfx !== "undefined" && Sfx.peril) Sfx.peril(0);
    this._armed = null;
    this._stopBattleAmbience();   // 战场天象收束（S5：风暴远雷/林间鸟鸣定时器一并清）
    if (typeof Fx !== "undefined") Fx.clear();
    // 战罢归于地点轨（在哪打完，回哪的声音）
    if (typeof Sfx !== "undefined" && Sfx.bgm) Sfx.bgm(this._bgmForLocation(State.location()));
  },

  /* ===== 战场天象（S5·2026-07-10 用户提案）：据点氛围的战场化 =====
   * 复用 Fx.ambient 氛围粒 + 屏幕级原语 + Sfx——按战场底图配"天地在动"：
   * 乱星海=浪沫横飞+远雷天光+雷鸣；森林=天光光束+林间鸟鸣；山谷=灵气微光；官道=扬尘；皇宫=烬火。
   * 定时器入 _battleAmbTimers，closeCombat 一并清（绝不漏到地图）。 */
  _battleAmbTimers: null,
  _startBattleAmbience(meta) {
    this._stopBattleAmbience();
    if (!meta || meta.type === "breakthrough") return;   // 心象空间无天象
    const field = this.el("axis-field");
    if (!field || typeof Fx === "undefined" || !Fx.ensure(field)) return;
    const base = this._battleBaseFor(State.location(), meta);
    const timers = this._battleAmbTimers = [];
    // 随机循环定时器（每次间隔在 [lo,hi] 内重掷——天象不打拍子）；句柄对象入 timers 统一清
    const loop = (lo, hi, fn) => {
      const h = { id: 0 };
      const tick = () => { fn(); h.id = setTimeout(tick, lo + Math.random() * (hi - lo)); };
      h.id = setTimeout(tick, 600 + Math.random() * lo);
      timers.push(h);
    };
    if (base === "bt_xinghai") {
      // 风暴海战：浪沫横飞（常驻）+ 远雷天光 + 雷鸣 + 风声环境床——大决战的天地都在响
      // （S5 性能收口：cap 30→22 / interval 95→130——用户实测"卡了"，氛围粒是常驻开销第一刀）
      Fx.ambient("storm", { interval: 130, cap: 22 });
      // v308：风声床（duck:false=不压战斗 BGM——风是垫底的景，鼓是主角）
      if (typeof Sfx !== "undefined" && Sfx.ambient) Sfx.ambient("wind", { vol: 0.3, duck: false });
      loop(4200, 9000, () => {
        if (!Fx._ctx) return;
        if (Math.random() < 0.5) {
          // 远处天光一闪（海天线后的闷雷——只见其光）
          Fx.flash("#c8d6ee", 150, .13);
          if (typeof Sfx !== "undefined") Sfx.play("thunderFar");
        } else {
          // 一道远雷真劈下来（quiet：不震屏、弱闪、远雷声）
          Fx.lightning(Fx._w * (0.12 + Math.random() * 0.76), Fx._h * (0.3 + Math.random() * 0.2),
            { quiet: true, small: true, life: 380, bolt: ["96,128,186", "150,178,224", "225,238,255"] });
        }
      });
    } else if (base === "bt_forest") {
      Fx.ambient("beam", { alpha: 0.08 });   // 林间天光光束缓扫
      loop(8000, 17000, () => { if (typeof Sfx !== "undefined") Sfx.play("bird"); });
    } else if (base === "bt_valley") {
      Fx.ambient("spirit", { interval: 300 });   // 灵秀山谷·灵气微光上浮
    } else if (base === "bt_road") {
      Fx.ambient("dust", { interval: 320 });     // 官道扬尘
    } else if (base === "huanggong" || base === "bt_night") {
      Fx.ambient("ash", { interval: 340 });      // 夜战/宫阙·烬屑浮沉
    }
    // S9 风雷翅·翼上风雷（通用挂件特效层）：御翅单位翼间周期窜雷（右雷）+拂风（左风）
    const c0 = Engine._combat;
    const hasWings = c0 && ((c0.player && c0.player.wings) || (c0.sides || []).some(sd => sd.wings) || (c0.enemies || []).some(e => e.wings));
    if (hasWings) {
      loop(1300, 2800, () => {
        if (!Fx._ctx || !Engine._combat) return;
        const box = this.el("axis-units");
        if (!box) return;
        Engine._combat.units().forEach(u => {
          if (!u.wings) return;
          const uid = u === Engine._combat.player ? "player"
            : (u.isSide ? ((Engine._combat.sides.indexOf(u) > 0 ? "side:" + Engine._combat.sides.indexOf(u) : "side"))
              : "enemy:" + Engine._combat.enemies.indexOf(u));
          const anchor = box.querySelector(`[data-uid="${CSS.escape(uid)}"]`);
          if (!anchor) return;
          const at = Fx.at(anchor, 0.4);
          if (!at) return;
          // 右翼·金雷窜弧（1~2 道小电蛇沿翼面跳）
          for (let k = 0; k < 1 + (Math.random() < 0.4 ? 1 : 0); k++) {
            const x0 = at.x + 16 + Math.random() * 30, y0 = at.y - 14 + Math.random() * 26;
            Fx.arc(x0, y0, x0 + 12 + Math.random() * 22, y0 + (Math.random() - 0.5) * 22, { c: "255,214,90", w: 1.6, life: 220 });
          }
          // 左翼·青风拂羽（两三粒风streak 掠出）
          for (let k = 0; k < 3; k++) {
            Fx.mote(at.x - 20 - Math.random() * 26, at.y - 10 + Math.random() * 24,
              { vx: -(1.2 + Math.random() * 1.6), vy: (Math.random() - 0.5) * 0.6, wob: 3, life: 500 + Math.random() * 400, size: 1.6 + Math.random() * 1.2, c: k % 2 ? "#9fe0cf" : "#cdeee2" });
          }
        });
        Fx._run();
      });
    }
  },
  _stopBattleAmbience() {
    (this._battleAmbTimers || []).forEach(h => clearTimeout(h && h.id != null ? h.id : h));
    if (this._battleAmbTimers && typeof Sfx !== "undefined" && Sfx.ambientStop) Sfx.ambientStop();   // 风声等战场声床一并收
    this._battleAmbTimers = null;
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
    // 出手身法·三拍（S1）：预备后撤→突进→收势。方向朝目标（--atk 注入，翻面立绘也冲对方向）
    if (sp && me && sp.type === "atk") {
      const melee = sp.range && sp.range[1] <= 1;
      me.style.setProperty("--atk", this._relDir(me, tgt));
      me.classList.remove("strike-melee", "strike-cast"); void me.offsetWidth;
      me.classList.add(melee ? "strike-melee" : "strike-cast");
      setTimeout(() => me.classList.remove("strike-melee", "strike-cast"), 600);
      // S3 姿态替换：出手瞬间换 _atk/_cast 变体立绘（已入库的角色才换），收势换回
      this._poseSwap(me, melee ? "_atk" : "_cast");
    }
    // 催动绕身法宝阵列出袭（通用闭环协议）：青竹剑阵/子母刃等绕身阵列攻击时，飞行体各自汇聚
    // 射向目标 → 拖尾暴涨 → 命中 → 回归。取代额外配方光效（真实剑/刃出动，不再叠独立光块）
    // ⚠ 横扫型(sp.aoe，辟邪神雷·劈)不走法宝出袭——它是"金雷自人而发"，区别于法宝飞袭，单独走 shenleiSweep
    const useOrbit = !!(sp && sp.source === "treasure" && sp.type === "atk" && !sp.aoe && me && tgt
      && this._launchOrbit(me, tgt, sp));
    if (useOrbit) {
      if (typeof Sfx !== "undefined") Sfx.play("swordWhoosh");   // 群剑出袭·破空锐啸
      // 命中那拍（出袭飞达目标≈40%×0.92s≈0.37s）目标方向化击退
      const leiOn = c0 && c0.player && (c0.player._leiEnchant || 0) > 0;
      setTimeout(() => {
        this._hitKnock(tgt, me, leiOn ? { amp: 17 } : undefined);
        // 神雷附剑·带雷剑阵命中（S5 灵动感）：落点小金雷炸落 + 电弧窜体三小闪——附剑打谁谁带电
        if (leiOn && typeof Fx !== "undefined" && Fx._ctx && tgt) {
          const at = Fx.at(tgt, 0.5);
          if (at) {
            Fx.lightning(at.x, at.y, { gold: true, small: true, life: 240 });
            for (let k = 0; k < 3; k++) {
              setTimeout(() => {
                if (!Fx._ctx) return;
                const a0 = Math.random() * Math.PI * 2, r0 = 14 + Math.random() * 18;
                Fx.arc(at.x + Math.cos(a0) * r0, at.y + Math.sin(a0) * r0 * 0.7,
                  at.x + Math.cos(a0 + 1.2) * r0, at.y + Math.sin(a0 + 1.2) * r0 * 0.7,
                  { c: "255,214,90", w: 1.8, life: 200 });
              }, 90 + k * 140);
            }
          }
        }
      }, 370);
    }
    // 辟邪神雷·劈·横扫（problem 5）：金雷自人物身畔轰发→左右贯场雷幕→所及诸敌天降金雷劈落
    const useSweep = !!(sp && sp.aoe && sp.type === "atk" && me && typeof Fx !== "undefined");
    if (useSweep) {
      const field = this.el("axis-field");
      const box = this.el("axis-units");
      const foes = box ? [...box.querySelectorAll('[data-uid^="enemy:"]')] : [];
      if (Fx.ensure(field)) Fx.shenleiSweep(me, foes.length ? foes : (tgt ? [tgt] : []));
      // 横扫命中：所及诸敌依次方向化击退（S2 三拍制——预兆 520ms 后爆发拍逐敌雷落，与 fx 同步）
      foes.forEach((f, i) => setTimeout(() => this._hitKnock(f, me, { amp: 18 }), 660 + i * 90));
    }
    // 御使飞行：攻击类且非贴身武学——一道法器印划过战场 + fx 流光弹道（出袭法宝/横扫已自有演出，跳过）
    if (!useOrbit && !useSweep && sp && me && tgt && sp.type === "atk" && sp.range && sp.range[1] >= 2) {
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
      setTimeout(() => this._hitKnock(tgt, me), 320);
      // fx：分功法配方特效（每个法术一张脸——青芒/火蛇/冰棱/金砖各不相同）
      if (typeof Fx !== "undefined" && Fx.ensure(field)) {
        Fx.castSpell(spellId, me, tgt, sp);
      }
    } else if (!useOrbit && !useSweep && tgt) {
      this._hitKnock(tgt, me);
      // 贴身武学/自身术：同走配方分发
      if (typeof Fx !== "undefined" && sp) {
        const field = this.el("axis-field");
        if (Fx.ensure(field)) Fx.castSpell(spellId, me, tgt, sp);
      }
    } else if (!useOrbit && !useSweep && sp && me && typeof Fx !== "undefined") {
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
      // 出手音（T7 行属分系）：金石有锋、火有轰势、冰有澈、木有破空——招式听得出是什么
      if (typeof Sfx !== "undefined") {
        const castSnd = { jin: "castJin", mu: "castMu", shui: "castShui", huo: "castHuo", tu: "castTu" };
        Sfx.play(spellId === "qingyuan_jianying" ? "swordSplit"   // 剑影分光术·群剑分影破空（专属）
          : sp.type === "heal" ? "heal" : sp.type === "def" ? "shield"
          : sp.source === "martial" ? "meleeWhoosh"
          : castSnd[sp.elem] || (sp.source === "treasure" ? "castJin" : "sword"));
        if (sp.source === "treasure") Sfx.play("bell");   // 法宝催动叠一记钟鸣（仪式感）
      }
    }
  },

  /* —— S1 动作手感小件 —— */
  // 相对方位：a 看向 b 在屏幕上的方向（1=右，-1=左）；缺参回退 1
  _relDir(a, b) {
    try {
      if (a && b) {
        const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
        return (rb.left + rb.width / 2) >= (ra.left + ra.width / 2) ? 1 : -1;
      }
    } catch (e) {}
    return 1;
  },
  // S3 姿态替换：出手/施法瞬间换姿态变体立绘（bt_xxx → bt_xxx_atk/_cast），收势换回。
  // 变体未入库=静默跳过；只改 img.src 不动 img._src——下一次 reconcile 自愈，无残留。
  _poseSwap(anchor, suffix, ms = 560) {
    if (!anchor || typeof Art === "undefined" || !Art.battlerUrl) return;
    const img = anchor.querySelector("img.au-img");
    if (!img || !img.src) return;
    const m = img.src.match(/\/(bt_[a-z0-9_]+)\.png/i);
    if (!m) return;
    const base = m[1].replace(/_fly$/, "").replace(/_(atk|cast)$/, "");
    const url = Art.hasBattler(base + suffix) ? Art.battlerUrl(base + suffix) : null;
    if (!url) return;
    // ⚠ 原姿只记一次（v307 实锤"劈完不变回"：连发时第二次 swap 把姿态图当原姿记下，
    // 恢复时"变回"的还是施法图——永久卡在施法姿。_poseBack 未清=尚在姿态中，不覆写）
    if (img._poseBack == null) img._poseBack = img.src;
    img.src = url;
    clearTimeout(img._poseT);
    img._poseT = setTimeout(() => {
      if (img.isConnected && img._poseBack != null) img.src = img._poseBack;
      img._poseBack = null;
    }, ms);
  },

  // 受击反作用：背向攻击者的方向化击退+倾斜+回弹（CSS hitKnock 吃 --kb/--kbAmp）。
  // ⚠ 只设 CSS 变量不写定位内联（v88 reconcile 红线：不给 axis-unit 写会赖着不走的样式）
  _hitKnock(anchor, fromEl, opts = {}) {
    if (!anchor) return;
    // 方向：从攻击者指向受击者（被打飞离攻击者）；无来源时按敌我兜底（敌向右弹、我向左弹）
    const dir = fromEl ? this._relDir(fromEl, anchor)
      : (anchor.dataset && /^enemy/.test(anchor.dataset.uid || "") ? 1 : -1);
    anchor.style.setProperty("--kb", dir);
    anchor.style.setProperty("--kbAmp", (opts.amp || 13) + "px");
    anchor.classList.remove("shake"); void anchor.offsetWidth;
    anchor.classList.add("shake");
  },

  // 催动绕身法宝阵列出袭（通用协议）：为每个阵列(.au-swords/.au-blades…)的飞行体注入
  // --strike-x/y（自身中心→目标命中点位移）+ --strike-r（剑尖朝目标角度），派发 launch 触发
  // 各飞行体自己的 *Strike 闭环动画。返回是否触发（无阵列→false，让调用方回退到配方光效）。
  _launchOrbit(me, tgt, sp) {
    if (!me || !tgt) return false;
    const orbits = me.querySelectorAll(".au-swords, .au-blades");
    if (!orbits.length) return false;
    const tr = tgt.getBoundingClientRect();
    const tgtX = tr.left + tr.width / 2;
    const tgtY = tr.top + tr.height * 0.46;   // 命中点≈躯干中心
    const spanX = tr.width * 0.42, spanY = tr.height * 0.34;   // 穿透点撒布范围（敌身各处）
    orbits.forEach(orbit => {
      const or = orbit.getBoundingClientRect();
      orbit.querySelectorAll(".sw, .bld").forEach((f, i) => {
        // 用 offset 布局位置（不含浮游 transform 抖动）求飞行体静止中心
        const fx = or.left + f.offsetLeft + f.offsetWidth / 2;
        const fy = or.top + f.offsetTop + f.offsetHeight / 2;
        // 乱舞劈砍：每把剑各自的穿透点=敌身中心 + 随机撒布（不再汇聚同一点）
        const px = tgtX + (Math.random() * 2 - 1) * spanX;
        const py = tgtY + (Math.random() * 2 - 1) * spanY;
        const dx = px - fx, dy = py - fy;
        f.style.setProperty("--strike-x", dx.toFixed(1) + "px");
        f.style.setProperty("--strike-y", dy.toFixed(1) + "px");
        // 剑尖朝穿透点：剑形剑尖朝下(=屏幕 +90°)，转到 atan2 方向需 -90°
        f.style.setProperty("--strike-r", (Math.atan2(dy, dx) * 180 / Math.PI - 90).toFixed(1) + "deg");
        // 错相·乱舞不齐射（40~300ms 随机错开）；backwards 填充令延迟期间保持朝敌姿态
        const delay = Math.round(40 + Math.random() * 260);
        f.style.setProperty("--strike-delay", delay + "ms");
        // ±兜弧方向交替=左右各划弧、交叉乱舞（幅度略随机）
        const bow = (i % 2 ? 1 : -1) * (0.38 + Math.random() * 0.26);
        f.style.setProperty("--bow", bow.toFixed(3));
      });
      orbit.classList.remove("launch"); void orbit.offsetWidth;
      orbit.classList.add("launch");
      // 持续 = 动画 920ms + 最大错相 300ms 留余
      setTimeout(() => orbit.classList.remove("launch"), 1300);
    });
    return true;
  },

  /* boss 亮相拍（v312·用户实锤"场景/战斗没张力"）：开战即压暗全场→镜头推向 boss→
   * 压屏题字+钟鸣→缓缓收回己方。所有 boss 战可复用（startXxxFight 开场调一下即可）。 */
  bossIntro(opts = {}) {
    const c = Engine._combat;
    const field = this.el("axis-field");
    if (!c || !field || typeof Fx === "undefined" || !Fx.ensure(field)) return;
    Fx.dimField(2800, .42);
    setTimeout(() => { try { this._camPeek(c, "enemy:0"); } catch (e) {} }, 150);
    const g = this.el("fx-global");
    if (g && opts.title) setTimeout(() => {
      g.hidden = false; g.className = "fx-global fxg-ult";
      g.innerHTML = `<span class="fxg-text">${opts.title}</span>`;
      if (typeof Sfx !== "undefined") Sfx.play("bell");
      clearTimeout(this._fxgTimer);
      this._fxgTimer = setTimeout(() => { g.hidden = true; g.className = "fx-global"; }, 1600);
    }, 400);
    setTimeout(() => { try { this._camPeek(c, "player"); } catch (e) {} }, 2500);
  },

  /* 六极真魔功·祭魔仪式（S4·2026-07-10 用户拍板方向：黑雾漫场+乌云压顶+电闪雷鸣）——
   * 机制已由引擎钩子落位（六魔已在轴上），此处纯演出：天色骤暗→魔雾常驻漫场→诡紫天雷→
   * 六魔自魔雾中一尊一尊显形（每落一尊：雾爆+暗紫环+钟鸣+微顿帧）→雷鸣长尾收拍。 */
  liumoRitual(c) {
    const field = this.el("axis-field");
    if (!field || typeof Fx === "undefined" || !Fx.ensure(field)) return;
    // ① 天色骤暗 + 黑雾漫场（moqi 常驻整个魔功阶段——战斗结束 Fx.clear 自收）
    Fx.dimField(5600, .5);
    Fx.ambient("moqi", { cap: 18, interval: 160 });   // S5 性能收口：魔雾大颗粒贵，18 团足够漫场
    if (typeof Sfx !== "undefined") Sfx.play("thunderFar");
    // ② 乌云紫雷：两道诡紫天雷先后劈落（魔功天象——与韩立金雷色板对仗）
    const PURPLE = ["120,60,180", "170,110,220", "240,225,255"];
    setTimeout(() => { if (Fx._ctx) Fx.lightning(Fx._w * (0.30 + Math.random() * 0.15), Fx._h * 0.5, { bolt: PURPLE, life: 480 }); }, 420);
    setTimeout(() => { if (Fx._ctx) Fx.lightning(Fx._w * (0.60 + Math.random() * 0.18), Fx._h * 0.46, { bolt: PURPLE, life: 480 }); }, 800);
    // ③ 六魔逐尊显形：先蒙纱（mo-veil），再一尊一尊自魔雾中落位（mo-descend）
    const demons = [];
    c.enemies.forEach((e, i) => { if (e._mo && e.alive) demons.push(i); });
    demons.forEach(ei => {
      const a = this._axisAnchor(`enemy:${ei}`);
      const f = a && a.querySelector(".au-fig");
      if (f) f.classList.add("mo-veil");
    });
    demons.forEach((ei, k) => setTimeout(() => {
      const anchor = this._axisAnchor(`enemy:${ei}`);
      if (!anchor) return;
      const fig = anchor.querySelector(".au-fig");
      if (fig) {
        fig.classList.remove("mo-veil", "mo-descend"); void anchor.offsetWidth;
        fig.classList.add("mo-descend");
        setTimeout(() => fig.classList.remove("mo-descend"), 1000);
      }
      if (Fx._ctx) {
        const at = Fx.at(anchor, 0.6);
        if (at) {
          Fx.ring(at.x, at.y, { c: "#9a7fd4", vr: 4.2, life: 400, lw: 2.6 });
          Fx.burst(at.x, at.y, "none", 12, { power: 3.4 });
        }
      }
      if (typeof Sfx !== "undefined") Sfx.play("bell");
      Fx.hitStop(60);
    }, 1200 + k * 300));
    // ④ 收拍：雷鸣长尾 + 镜头轻推（天魔降世，压迫感落定）
    setTimeout(() => {
      if (typeof Sfx !== "undefined") Sfx.play("thunder");
      this._camPunch();
    }, 1200 + demons.length * 300 + 260);
  },

  // 应雷仪式：神雷附剑施放、剑阵转金那一刻——剑阵应雷齐震 + 金雷光环暴胀涌现 + 金雷环从人物炸开
  // + 应雷之声（群剑共鸣剑吟）。由 engine.combatShenlei 在 renderCombat 之后调用（此刻剑阵 DOM 已切 .lei 态）。
  leiRitual() {
    const me = this._axisAnchor("player");
    if (!me) return;
    const swords = me.querySelector(".au-swords.lei");
    if (swords) {
      swords.classList.remove("lei-cast"); void swords.offsetWidth;
      swords.classList.add("lei-cast");
      setTimeout(() => swords.classList.remove("lei-cast"), 720);
    }
    // 金雷环从人物炸开（双环：金外+白芯）=“应雷成环”的能量波（castSpell 的金雷劈自身是引子，此为剑阵应雷的回响）
    const field = this.el("axis-field");
    if (typeof Fx !== "undefined" && Fx.ensure(field)) {
      const at = Fx.at(me, 0.5);
      if (at) {
        Fx.ring(at.x, at.y, { c: "#ffd970", vr: 5.6, life: 480, lw: 3.8 });
        setTimeout(() => Fx.ring(at.x, at.y, { c: "#fff", vr: 3.6, life: 360, lw: 2 }), 80);
      }
    }
    if (typeof Sfx !== "undefined") Sfx.play("leiCharge");   // 应雷之声：群剑共鸣剑吟 + 通电涌动
  },

  // 弹出战斗飘字（消费引擎的 fx 队列，锚到轴上 sprite）+ 三时刻重演出
  flushCombatFx(c) {
    if (!c || !c._fx || !c._fx.length) return;
    const fx = c._fx.slice();
    c._fx.length = 0;
    let delay = 0;
    const fxReady = typeof Fx !== "undefined" && Fx.ensure(this.el("axis-field"));
    // 行动者切镜（T6）：镜头守在“韩立的视角/战线”，不追远摊——能不动就不动（反晕镜）。
    //   只有韩立本人、或离他足够近（同一摊交火）的行动者才递镜；远处战线靠画框徽标提示、
    //   玩家点一下才巡过去。这样镜头不再在 30 格上左右乱甩、看不清“谁打谁”。
    let lastPeek = null;
    let lastActor = null;   // S1：最近行动者——受击方向化击退的"来向"依据
    for (const f of fx) {
      // 行动者切镜（B1 镜头导演·teamfight-camera-design §3.B）：
      //   turn 拍＝该行动者的回合；fxcast 的 from 作兜底。仅当其在韩立视角带内才跟。
      const actor = f.kind === "turn" ? f.ref : ((f.kind === "fxcast" && f.from) ? f.from : null);
      if (actor) lastActor = actor;
      let peeked = false;
      if (actor && actor !== lastPeek && this._peekWorthy(c, actor)) {
        lastPeek = actor;
        const at = delay;
        setTimeout(() => this._camPeek(c, actor), at);   // 切镜先拖给行动者（含其随后逐格走位）
        peeked = true;
      }
      // turn 拍只为切镜、不出飘字：真切了镜才给行进+驻留（turnHold），远摊没切镜只给极短节拍（turnBeat）
      if (f.kind === "turn") { if (c.W > 13) delay += peeked ? this.DIRECTOR.turnHold : this.DIRECTOR.turnBeat; continue; }
      // —— 全局重演出：趁虚时停金字 / 蓄势释放大字压屏（蓄势全开加白金屏闪+震屏）——
      if (f.ref === "global") {
        const g = this.el("fx-global");
        if (g) setTimeout(() => {
          g.hidden = false;
          g.className = "fx-global " + (f.kind === "ult" ? "fxg-ult" : "fxg-exploit");
          g.innerHTML = `<span class="fxg-text">${f.text || ""}</span>`;
          if (typeof Sfx !== "undefined") Sfx.play(f.kind === "ult" ? "bell" : "danger");
          if (f.kind === "ult" && fxReady) { Fx.flash("#ffe9ad", 220, .36); Fx.shake(10); this._camPunch(); }   // 大招：屏闪+震屏+轻推近（燃点 B4）
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
            // 敌方/侧位出手也有声（T7）：行属分系——听声辨招
            if (typeof Sfx !== "undefined") {
              const castSnd = { jin: "castJin", mu: "castMu", shui: "castShui", huo: "castHuo", tu: "castTu" };
              Sfx.play(f.melee ? "meleeWhoosh" : castSnd[f.elem] || "sword");
            }
            // S1：敌/侧出手也有三拍身法——预备后撤→朝目标突进→收势（同规则铁律：敌我一个规则）
            if (fromA) {
              fromA.style.setProperty("--atk", this._relDir(fromA, anchor));
              fromA.classList.remove("strike-melee", "strike-cast"); void fromA.offsetWidth;
              fromA.classList.add(f.melee ? "strike-melee" : "strike-cast");
              setTimeout(() => fromA.classList.remove("strike-melee", "strike-cast"), 600);
              this._poseSwap(fromA, f.melee ? "_atk" : "_cast");   // S3：敌/侧姿态变体（已入库才换）
            }
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
          if (typeof Sfx !== "undefined") Sfx.play("die");
          this._camPunch();   // 终结一击：镜头轻推近（燃点 B4），叠在水墨慢放之上
          if (fxReady && Fx.hitStop) Fx.hitStop(115);   // S1：终结顿帧——这一下"咔"地定住
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
      const lastActorAt = lastActor;   // 捕获"这一拍"的行动者（延时闭包里 lastActor 会继续漂）
      setTimeout(() => {
        this._popFloat(anchor, f.kind, f.text);
        // 受击/事件音（T7）：背袭寒刃、重创骨裂、暴击重锤、升降风啸——每一记都有"形"
        if (typeof Sfx !== "undefined") {
          const t = f.text || "";
          if (/背袭/.test(t)) Sfx.play("backstab");
          else if (/重创/.test(t)) Sfx.play("maim");
          else if (f.kind === "crit") Sfx.play("crit");
          else if (f.kind === "hurt" || f.kind === "dmg") Sfx.play("hit");
          else if (f.kind === "pierce") Sfx.play("sword");
          else if (f.kind === "soul") Sfx.play("shield");
          else if (f.kind === "miss") {
            if (/击落|落地/.test(t)) Sfx.play("landDown");
            else if (/腾空/.test(t)) Sfx.play("flyUp");
            else if (/闪避|扑空|挥空|拉出/.test(t)) Sfx.play("whiff");
          }
        }
        if (f.kind === "hurt" || f.kind === "dmg" || f.kind === "crit" || f.kind === "pierce") {
          // S1：方向化击退（背向最近行动者）+ 白闪；暴击退得更远 + 顿帧（抖到一半被冻=打击感翻倍）
          const fromA = lastActorAt ? this._axisAnchor(lastActorAt) : null;
          this._hitKnock(anchor, fromA, { amp: f.kind === "crit" ? 22 : 13 });
          anchor.classList.add("hitflash");
          setTimeout(() => anchor.classList.remove("hitflash"), 360);
          if (f.kind === "crit" && fxReady && Fx.hitStop) Fx.hitStop(85);
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
    // 演出散场：镜头缓缓回到你身上（下一回合是你的）
    if (lastPeek) setTimeout(() => this._camPeek(c, "player"), delay + 900);
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
  // 当前有效目标（默认锁“离韩立最近的活敌”兜底——宽场三战线下，绝不默认去打老远那个）
  curTarget(c) {
    if (this._combatTarget != null && c.enemies[this._combatTarget] && c.enemies[this._combatTarget].alive) return this._combatTarget;
    return this._nearestEnemyIdx(c);
  },
  // 离韩立最近的活敌索引（同距取先手序在前者）；无活敌返回 -1
  _nearestEnemyIdx(c) {
    if (!c || !c.enemies) return -1;
    const px = (c.player && typeof c.player.pos === "number") ? c.player.pos : 0;
    let best = -1, bestD = Infinity;
    c.enemies.forEach((e, i) => {
      if (!e || !e.alive) return;
      const d = Math.abs((typeof e.pos === "number" ? e.pos : px) - px);
      if (d < bestD) { bestD = d; best = i; }
    });
    return best;
  },

  // 战斗 idle 提示：是否有攻击法术够得着任一活敌（engine.combatEndRound 消费）
  _anySpellInRange(c) {
    if (!c || !c.player) return null;
    const p = c.player;
    const SP = (typeof CombatAPI !== "undefined" && CombatAPI.SPELLS) || {};
    const atkSpells = (p.spells || []).filter(id => {
      const sp = SP[id];
      return sp && !sp.quick && sp.type !== "float" && sp.type !== "buff" && sp.type !== "defend" && sp.type !== "move";
    });
    if (!atkSpells.length) return "only_defend";
    for (const id of atkSpells) {
      const sp = SP[id];
      const inR = (sp.range && sp.range[1] === 0) ? true
        : c.enemies.some((e2, i2) => e2.alive && c.castableAt(id, i2));
      if (inR) return true;
    }
    return false;
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

  /* 对脸列阵（v176）：交火的敌我两阵营单位若在屏上贴到一处（格距≈1、身宽相叠成一坨），
   * 顺着各自所属侧把彼此推开到一个"对峙空当"——只动演出位(--lx)，占格/射程/移动/平衡一律不碰。
   * 与 _decrowd 互补：decrowd 只在同排同阵营内防撞；此处专治敌我"对脸"的重叠（跨排也算，
   * 因为本作 1v1 对峙读作左右对脸而非前后纵深）。每个敌人只对它屏距最近的我方解一次，避免连环推挤；
   * 韩立是镜头锚点，他涉入对峙时只推敌人、不挪韩立。 */
  _faceoff(unitsEl, c) {
    if (!c._fronts || !c._fronts.length) return;   // 仅声明式战区（团战框架）内生效——常规 1vN 战斗排布零回归
    const track = unitsEl.getBoundingClientRect().width / (this._camZoom || 1);
    if (!track) return;
    const GAP = Math.max(54, Math.min(82, track * 0.066));   // 对脸最小间距（略宽于身宽，留出对峙空当）
    const items = [...unitsEl.querySelectorAll(".axis-unit")]
      .filter(el => !el.classList.contains("dead"))
      .map(el => {
        const lx = parseFloat(getComputedStyle(el).getPropertyValue("--lx")) || 0;   // 已含 decrowd 追加量
        return {
          el,
          foe: el.classList.contains("enemy"),
          self: el.classList.contains("self"),
          x: (parseFloat(el.style.left) || 0) / 100 * track + lx,
          lx,
        };
      });
    const allies = items.filter(o => !o.foe);
    const foes = items.filter(o => o.foe);
    if (!allies.length || !foes.length) return;
    const shove = (o, dx) => { o.lx += dx; o.x += dx; o.el.style.setProperty("--lx", o.lx.toFixed(1) + "px"); };
    foes.forEach(f => {
      let best = null;
      allies.forEach(a => {
        const ad = Math.abs(f.x - a.x);
        if (!best || ad < best.ad) best = { a, ad, d: f.x - a.x };
      });
      if (!best) return;
      const need = GAP - best.ad;
      if (need <= 0) return;
      const dir = best.d >= 0 ? 1 : -1;   // 敌在我右→敌右推、我左退
      if (best.a.self) shove(f, dir * need);                       // 韩立锚点不动，全量推敌
      else { shove(best.a, -dir * (need / 2)); shove(f, dir * (need / 2)); }
    });
  },

  // 相对朝向：单位是否需要水平镜像（面向"自己正在对付的人"）——玩家盯锁定目标、同道盯最近敌人、
  //   敌人盯最近的我方；被绕背（_backTurned）的敌人保持旧朝向。立绘与身侧剑阵/绕身法宝共用此判定，
  //   保证剑阵随韩立转身一起翻面（修：青竹蜂云剑曾始终朝右、不跟攻击方向）。
  _faceFlipped(c, u, opts, isPlayer, isSide) {
    if (typeof Art === "undefined" || !Art.battlerFace) return false;
    const bid2 = (() => {
      let b = null;
      if (isPlayer) b = Art.heroBattlerId ? Art.heroBattlerId() : (Art.hasBattler("bt_hanli") ? "bt_hanli" : null);
      else if (isSide) b = u.art && Art.hasBattler("bt_" + u.art) ? "bt_" + u.art : this._battlerByName(u.name);
      else b = this._battlerByName(u.name);
      if (b && (u.alt || 0) === 1 && Art.hasBattler(b + "_fly")) b = b + "_fly";
      return b;
    })();
    const face = bid2 ? Art.battlerFace(bid2) : "r";
    if (face === "c") return false;
    let oppPos = null;
    if (isPlayer) {
      const te = (opts.target >= 0 && c.enemies[opts.target] && c.enemies[opts.target].alive)
        ? c.enemies[opts.target]
        : (c.enemies[this._nearestEnemyIdx(c)] || { pos: c.W - 1 });
      oppPos = te.pos;
    } else if (isSide) {
      const te = c.enemies.find(e => e.alive) || { pos: c.W - 1 };
      oppPos = te.pos;
    } else {
      const foes = [c.player].concat(c.side && c.side.hp > 0 ? [c.side] : []);
      const near = foes.reduce((a, b) => Math.abs(b.pos - u.pos) < Math.abs(a.pos - u.pos) ? b : a);
      oppPos = u._backTurned ? (u.pos + (near.pos > u.pos ? -1 : 1)) : near.pos;
    }
    if (oppPos === u.pos) return false;
    const want = u.pos < oppPos ? "r" : "l";
    return face !== want;
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
    // S5 粒子化身（虫群等）：不贴立绘——透明占位撑几何（血条/名牌/锚点仍在），
    // "身体"由 Fx.swarmAttach 的持续粒子群绘制（_syncSwarms 管理生命周期）。
    // 兜底：关动效/无特效环境退回立绘（否则虫群隐身）
    if (u.swarmFx && typeof Fx !== "undefined" && Fx.swarmAttach && !Fx._reduced()) {
      figGlyph = '<div class="au-swarmbox"></div>';
    } else if (typeof Art !== "undefined" && Art.battlerUrl) {
      let bid = null;
      if (isPlayer) bid = Art.heroBattlerId ? Art.heroBattlerId() : (Art.hasBattler("bt_hanli") ? "bt_hanli" : null);
      else if (isSide) bid = u.art && Art.hasBattler("bt_" + u.art) ? "bt_" + u.art : this._battlerByName(u.name);
      // 敌人也优先读 art 字段（皇宫三血侍非克隆：各实例带 art:"xueshi_a/b/c"），无则按名回退（bt_xueshi 通用）
      else bid = u.art && Art.hasBattler("bt_" + u.art) ? "bt_" + u.art : this._battlerByName(u.name);
      // 飞行姿态变体（v87）：凌空且 _fly 立绘已入库——换飞姿（双脚前后、衣袂后卷）
      if (bid && (u.alt || 0) === 1 && Art.hasBattler(bid + "_fly")) bid = bid + "_fly";
      if (bid) { figSrc = Art.battlerUrl(bid); figCls = " battler" + (demonized ? " demonized" : ""); }
    }
    if (!figSrc && !figGlyph) {
      const aid = isPlayer ? (Art.heroId ? Art.heroId() : "hanli") : (isSide ? (u.art || null) : this._artIdByName(u.name));
      if (aid && typeof Art !== "undefined" && Art.has && Art.has(aid)) {
        figSrc = Art.url(aid); figCls = demonized ? " demonized" : "";
      } else {
        // D2：无专属立绘的元神/残魂——人形黑色剪影占位（遮罩做在独立 .au-shade 层，不碰 .au-img 滤镜红线）
        figGlyph = (!isPlayer && !isSide && this._ghostShade(u))
          || `<div class="au-glyph"><span>${isPlayer ? "韩" : isSide ? "傀" : this._enemyGlyph(u.name)}</span></div>`;
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
        const stCh = { follow: "随", attack: "攻", guard: "守", ultimate: "憋", retreat: "撤" }[u.stance || "follow"];
        badges.push(`<span class="au-mark mk-stance" onclick="event.stopPropagation(); Engine.cycleSideStance(${opts.sideIndex || 0})">${stCh}</span>`);
      }
    }
    if (u.status && u.status.poison) badges.push(`<span class="au-mark mk-poison">毒${u.status.poison.dmg}</span>`);
    if (u.status && u.status.dingshen > 0) badges.push(`<span class="au-mark mk-hold">定</span>`);
    // 朝向（立绘 + 身侧剑阵/绕身法宝共用此判定，剑阵随转身一起翻面）
    const faceFlipped = this._faceFlipped(c, u, opts, isPlayer, isSide);
    const fl = faceFlipped ? " flipped" : "";
    // 身侧悬浮法器（觅长生式拥有感）：已装备的武器/护身法器化作灵光绕身
    let orbit = "";
    // S9 身后挂件（通用·风雷翅首例）：特殊道具生图挂身后 z-1，CSS 翻涌动轴 + _startWingFx 窜雷
    if (u.wings && typeof Art !== "undefined" && Art.hasBattler && Art.hasBattler(u.wings)) {
      orbit += `<div class="au-wings"><img src="${Art.battlerUrl(u.wings)}" alt="" /></div>`;
    }
    if (isPlayer && typeof State !== "undefined" && State.gearOf) {
      const orbs = [];
      const w = State.gearOf("weapon"), a = State.gearOf("armor");
      const wName = w && DATA.items[State.data.gear.weapon] ? DATA.items[State.data.gear.weapon].name : null;
      const aName = a && DATA.items[State.data.gear.armor] ? DATA.items[State.data.gear.armor].name : null;
      // 主攻法宝伴身：青竹蜂云剑=12 把剑持续绕身（swordOrbit），神雷附剑时缠金雷（lei）；
      // 子母刃=一母八子青芒小刃；皆"持续"绕身，催动时整阵掠向目标
      const SPL = (typeof CombatAPI !== "undefined") ? CombatAPI.SPELLS : null;
      const swordTre = SPL && (u.spells || []).find(id => SPL[id] && SPL[id].swordOrbit);
      const hasMainTre = SPL && (u.spells || []).some(id =>
        SPL[id] && SPL[id].source === "treasure" && !SPL[id].quick && SPL[id].type === "atk");
      if (swordTre) {
        // 青竹蜂云剑·剑阵（12 把，持续绕身）：常态=剑身缠普通蓝色小电流；
        // 神雷附剑生效（_leiEnchant>0）→升级为金色大电流+周身金雷光环
        const lei = (u._leiEnchant || 0) > 0;
        // 神雷附剑态额外渲染：lei-aura(周身金雷光环) + 6 道 lei-bolt(周身环境雷弧，此起彼伏窜现·量多为辅)
        //   + 2 道 lei-orbit(R4：金/蓝电弧沿椭圆轨绕身旋掠=周身环绕，参考图1)。
        // ⚠ lei-orbit 必须追加在 lei-bolt 之后——否则会顶掉 lei-bolt:nth-child(12..17) 的定位选择器。
        const leiExtra = lei
          ? '<i class="lei-aura"></i>' + '<i class="lei-bolt"></i>'.repeat(6) + '<i class="lei-orbit"></i><i class="lei-orbit lo2"></i>'
          : '';
        orbit += `<div class="au-swords ${lei ? "lei" : "arc"}${fl}">${'<i class="sw"><b></b></i>'.repeat(10)}${leiExtra}</div>`;   // ⚠ += 不可写 =（v312 实锤：赋值会把先拼进去的 au-wings 顶掉）
      } else if (hasMainTre) {
        orbit += `<div class="au-blades${fl}">${'<i class="bld"></i>'.repeat(9)}</div>`;
      } else if (wName) {
        orbs.push(`<span class="orb orb-w" title="${wName}">${sealChar(wName)}</span>`);
      }
      if (aName) orbs.push(`<span class="orb orb-a" title="${aName}">${sealChar(aName)}</span>`);
      if (orbs.length) orbit += `<div class="au-orbit">${orbs.join("")}</div>`;
    }
    // 悬浮法宝绕身（三位制·祭出位 v96/v98）：祭起的法宝化作宝光绕身浮转、自行运转
    // （敌我同规则——任何单位 floats 都现身；如意花篮等"驭物类"在此可见）
    if (u.floats && u.floats.length) {
      const SPF = (typeof CombatAPI !== "undefined") ? CombatAPI.SPELLS : null;
      const toks = u.floats.slice(0, 4).map((id, k) => {
        const sp = SPF && SPF[id];
        const wx = sp ? (sp.elem || "jin") : "jin";
        const title = `${sp ? sp.name : id}（祭起·绕身运转）`;
        // 如意花篮=竹篾小篮+彩花泉涌；其余驭物宝器=无字灵光宝珠（绝不再用印文"如"字凑数）
        if (id === "ruyi_hualan") {
          return `<i class="fl-orb fl-basket fl-${k}" title="${title}"><b class="bk"></b><b class="pet p1"></b><b class="pet p2"></b><b class="pet p3"></b></i>`;
        }
        return `<i class="fl-orb fl-gem fl-${k} wx-${wx}" title="${title}"></i>`;
      }).join("");
      orbit += `<div class="au-floats">${toks}</div>`;
    }
    // 相对朝向（已在上方用 _faceFlipped 统一判定：立绘与身侧剑阵共用，转身一起翻面）
    if (faceFlipped) figCls += " flipped-img";
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
      uid: isPlayer ? "player" : isSide ? ((opts.sideIndex || 0) > 0 ? "side:" + opts.sideIndex : "side") : "enemy:" + i,
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
  // problem 1：附剑 arc↔lei 切态时不重建剑阵 DOM——只要剑阵仍在、.sw 数一致、且剑阵以外的
  // 兄弟节点(au-orbit/au-floats)不变，就原地 toggle arc/lei 类 + 增删金雷子节点，10 把 .sw 一律保活
  // （swHover 不断帧、不“竖一下”重生）。结构性变化（剑阵首现/消失/换法宝/floats 变）才回退整块重建。
  _reconcileSwords(ex, html) {
    if (ex._h === html) return;
    const cur = ex.querySelector(".au-swords");
    if (cur && ex._h != null) {
      const tmp = document.createElement("span");
      tmp.innerHTML = html || "";
      const nxt = tmp.querySelector(".au-swords");
      if (nxt && cur.querySelectorAll(".sw").length === nxt.querySelectorAll(".sw").length) {
        // 比“剑阵以外”的兄弟节点是否一致（抽走 au-swords 后比 innerHTML）
        const sibSig = node => { const cl = node.cloneNode(true); const s = cl.querySelector(".au-swords"); if (s) s.remove(); return cl.innerHTML; };
        if (sibSig(ex) === sibSig(tmp)) {
          const willLei = nxt.classList.contains("lei");
          if (cur.classList.contains("lei") !== willLei) {
            cur.classList.toggle("lei", willLei);
            cur.classList.toggle("arc", !willLei);
            cur.querySelectorAll(".lei-aura, .lei-bolt, .lei-orbit").forEach(n => n.remove());
            if (willLei) nxt.querySelectorAll(".lei-aura, .lei-bolt, .lei-orbit").forEach(n => cur.appendChild(n.cloneNode(true)));
          }
          // 朝向翻面：剑阵保活（不重建·不“竖一下”），仅原地切 flipped 类——剑阵随韩立转身一起翻
          cur.classList.toggle("flipped", nxt.classList.contains("flipped"));
          ex._h = html;
          return;
        }
      }
    }
    ex.innerHTML = html || "";
    ex._h = html;
  },

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
      if (el._left !== d.left) {
        // 雷遁瞬移（v98）：玩家这一步不是"滑"过去，是穿亚空间"换地方出现"——关掉 left 过渡瞬切
        if (this._blinkSnap && d.uid === "player") {
          const prev = el.style.transition;
          el.style.transition = "none"; el.style.left = d.left; void el.offsetWidth; el.style.transition = prev;
        } else { el.style.left = d.left; }
        el._left = d.left;
      }
      el.onclick = d.clickIdx != null ? () => UI.pickTarget(d.clickIdx) : null;
      // 徽章（每回合变，轻量重写——不含 img 无闪烁）
      const bd = el.querySelector(".au-badges");
      if (bd._h !== d.badges) { bd.innerHTML = d.badges; bd._h = d.badges; }
      // 伴身（装备战斗内不变，初建一次）
      const ex = el.querySelector(".au-extra");
      this._reconcileSwords(ex, d.extra);   // problem 1：arc↔lei 不重建剑阵(防“竖一下”)，仅结构变才重建
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
    this._blinkSnap = false;   // 瞬移帧只管这一拍
    // 退场：不在名单里的（死透已演完/已遁走）移除
    [...box.children].forEach(el => { if (el.dataset.uid && !seen.has(el.dataset.uid)) el.remove(); });
    // 雷遁出现帧（v98）：瞬移落定后，落点炸出亚空间金光破口
    if (this._blinkOut) {
      this._blinkOut = false;
      const pl = box.querySelector('[data-uid="player"]');
      if (pl && typeof Fx !== "undefined" && Fx.ensure(this.el("axis-field")) && Fx.RECIPES.leidun_out) {
        const at = Fx.at(pl);
        if (at) {
          // R5/R6：落点穿出金色空间洞（portalEmerge）+ 金雷放射炸开（leiLandBurst）。
          // 不再画"消失点→落点"的连线残迹（用户：光效太丑）——改"进一个洞、从另一个洞穿出"。
          Fx.RECIPES.leidun_out(Fx, at);
        }
      }
      this._blinkFrom = null;
    }
    // 临时探针（?dbgpos=1）：单位几何快照——查"卡进地底"
    if (location.search.indexOf("dbgpos=1") >= 0) {
      [...box.querySelectorAll(".axis-unit")].forEach(el => {
        const r = el.getBoundingClientRect(), b = box.getBoundingClientRect();
        const cs = getComputedStyle(el);
        console.log(`[pos] ${el.dataset.uid} cls=${el.className} | inline=${el.style.cssText} | translate=${cs.translate} transform=${cs.transform} scale=${cs.scale} bottom=${cs.bottom} | rect=${Math.round(r.top - b.top)}~${Math.round(r.bottom - b.top)} boxH=${Math.round(b.height)}`);
      });
    }
  },

  /* S5 粒子化身生命周期：swarmFx 单位（噬金虫群等）——在场即挂粒子群（绑定锚点跟走位/镜头），
   * 亡/失即打散（scatter=群粒四溅，本体就是粒子、散了就是死了）。方案可复用：任何"活的群体"
   * （魔雾缠身/鸦群/蜂云）都走 swarmFx + Fx.swarmAttach 的 cols/参数换皮。 */
  _syncSwarms(c) {
    if (typeof Fx === "undefined" || !Fx.swarmAttach || Fx._reduced()) return;   // 关动效=立绘兜底，不挂粒子群
    const box = this.el("axis-units");
    if (!box || !Fx.ensure(this.el("axis-field"))) return;
    const want = [];
    (c.sides || []).forEach((s, i) => {
      if (s.swarmFx && s.hp > 0) {
        const uid = i > 0 ? "side:" + i : "side";
        want.push({ id: "swarm:" + (s.id || uid), uid });
      }
    });
    want.forEach(w => Fx.swarmAttach(w.id, () => box.querySelector(`[data-uid="${CSS.escape(w.uid)}"]`)));
    (Fx._swarms || []).slice().forEach(sw => {
      if (String(sw.id).indexOf("swarm:") === 0 && !want.some(w => w.id === sw.id)) {
        Fx.swarmDetach(sw.id, { scatter: true });
      }
    });
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
      try {
        const res = this.el("co-result");
        if (res) { res.textContent = win ? (allEscaped ? "逐" : "胜") : fled ? "遁" : "败"; res.className = "co-result " + (win ? "co-win" : fled ? "co-flee" : "co-lose"); }
        // 敌人结局名单：死的是死、跑的是跑，一目了然
        // 演武/比斗点到即止：没人死——"伏诛/走脱"换成"认负/收势"（措辞跟规则走）
        const friendly = meta.type === "spar" || meta.type === "fame_duel";
        const foes = this.el("co-foes");
        if (foes) foes.innerHTML = c.enemies.map(e => {
          const fate = friendly
            ? (win ? '<b class="cf-fled">认负</b>' : '<b class="cf-stand">收势</b>')
            : (e.hp <= 0 ? '<b class="cf-slain">伏诛</b>' : e.escaped ? '<b class="cf-fled">走脱</b>' : win ? '<b class="cf-fled">退散</b>' : '<b class="cf-stand">未竟</b>');
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
        const detail = this.el("co-detail");
        if (detail) detail.innerHTML = lines.map(l => `<div>${l}</div>`).join("");
        // 战利预览（与 _finishCombat 发放同源）：败/遁无所得
        let lootTxt = "";
        if (win && meta.type === "encounter") {
          const parts = [];
          if (meta.reward) Object.entries(meta.reward).forEach(([k, v]) => parts.push(k === "silver" ? `纹银×${v}` : `${DATA.items[k] ? DATA.items[k].name : k}×${v}`));
          if (meta.namedLoot && !c.enemies.some(e => e.escaped)) Object.entries(meta.namedLoot).forEach(([k, v]) => parts.push(`${DATA.items[k] ? DATA.items[k].name : k}×${v}`));
          if (meta.namedBeast && c.enemies.some(e => e.escaped)) parts.push("（妖王走脱——异闻未了，专属战利与你无缘）");
          if (parts.length) lootTxt = "得：" + parts.join("、");
        } else if (fled) lootTxt = "全身而退——这一仗没输，只是没赢。";
        const loot = this.el("co-loot");
        if (loot) loot.textContent = lootTxt;
        const confirm = this.el("co-confirm");
        if (confirm) {
          confirm.onclick = () => { ov.hidden = true; done(); };
        } else {
          // 确认按钮不存在——直接结算，绝不卡住 overlay
          ov.hidden = true;
          done();
          return;
        }
        ov.hidden = false;
        if (typeof Sfx !== "undefined") Sfx.play(win ? "success" : "danger");
      } catch (e) {
        // 渲染异常——强制结算，绝不残留 overlay
        ov.hidden = true;
        done();
      }
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

  // 观阵：拉远看全战场 ↔ 跟随态（纯取景切换，不耗回合、不改战斗状态）。保大战场，解决手机端看不全。
  toggleSurvey() {
    this._surveyMode = !this._surveyMode;
    const btn = this.el("combat-survey");
    if (btn) btn.classList.toggle("on", this._surveyMode);
    if (typeof Sfx !== "undefined") Sfx.play("click");
    const c = (typeof Engine !== "undefined") ? Engine._combat : null;
    if (c) this.renderCombat(c, Engine._combatMeta);
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

    // —— §9-5 危局氛围：玩家血线告危→屏幕边缘暗红脉动（濒死更急更浓）+ 心跳低鼓 ——
    //    ≤28% 危局、≤12% 濒死；战毕/转危为安即收。视觉脉动尊重 reduced-motion（CSS 内静态化）。
    {
      const ov = this.el("combat-overlay");
      const frac = (p && p.hpMax) ? p.hp / p.hpMax : 1;
      const lvl = c.status === "ongoing" ? (frac <= 0.12 ? 2 : frac <= 0.28 ? 1 : 0) : 0;
      if (ov) { ov.classList.toggle("peril", lvl >= 1); ov.classList.toggle("brink", lvl >= 2); }
      if (lvl !== this._perilLevel) { this._perilLevel = lvl; if (typeof Sfx !== "undefined" && Sfx.peril) Sfx.peril(lvl); }
    }

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
        c.escapePos != null && i === c.escapePos ? "escape-cell" : "",
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
    (c.sides || (c.side ? [c.side] : [])).forEach((s, si) => {
      unitList.push(this._axisSprite(c, s, { isBT, target, sideIndex: si }));
    });
    c.enemies.forEach((e, i) => {
      if (e.escaped) return;
      if (!e.alive) {
        if (this._deadShown[i]) return;   // 已演过死——不再入场
        this._deadShown[i] = true;
      }
      unitList.push(this._axisSprite(c, e, { isBT, target, enemyIndex: i }));
    });
    this._syncUnits(c, unitList);
    this._syncSwarms(c);   // S5 粒子化身：虫群等 swarmFx 单位的粒子群挂载/打散

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
    // zoom：人数/排数退档 × 升空大幅后拉（airGrade 越高拉得越远——飞得高看得远）。
    // v95 人数退档收敛（0.02→0.015）：人物已按"大战场小人物"缩了一档，镜头不再叠缩
    const zoom = Math.max(0.72, Math.min(1,
      1 - 0.035 * ((c.L || 2) - 2) - 0.015 * Math.max(0, aliveN - 3)
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
    if (c.W > 13) {
      // 观阵态（全景）：V=全战场、cam=0、zoom=容纳缩放——一屏看全大战场（不缩战场本身）。
      const survey = !!this._surveyMode;
      // 宽死区（v90）：玩家在画面中部大半区域随便走，镜头纹丝不动——"是韩立在动"；
      // 只有逼近画框边缘才缓缓追上（追，不绑）。
      // v95 大战场小人物：基线视野 11→13 格——同屏更多天地，人物自然更小
      const V = survey ? c.W : (air ? Math.min(c.W, 13 + 2 * aGrade) : 13), m = 2.4;
      const trackW = (c.W / V) * 100;
      // 观阵：容纳缩放——视野从 13 格扩到 W 格，等比缩到 13/W（下限 0.5 防人物过小），cam 归零从最左铺满
      let zoomEff = zoom;
      if (survey) {
        zoomEff = Math.max(0.5, Math.min(zoom, 13 / c.W));
        const camS = 0;
        c._cam = camS;
        const shiftS = (camS / c.W) * 100;
        [laneEl2, unitsEl].forEach(el => {
          el.style.width = trackW + "%";
          el.style.transform = `translateX(-${shiftS.toFixed(2)}%)${worldY} scale(${zoomEff.toFixed(3)})`;
          el.classList.add("cam-track");
        });
        this._camParts = { V, worldY, farY, midY, farScale, midScale, zoom: zoomEff };
        if (bgEl2) {
          bgEl2.style.transform = `translateX(0%)${farY} scale(${farScale})`;
          const midEl = this.el("combat-bgmid");
          if (midEl && midEl.classList.contains("on")) midEl.style.transform = `translateX(0%)${midY} scale(${midScale})`;
        }
        if (this._fightFarCue) this._fightFarCue(null);   // 全景态全员入画，无需"出画点名"
        // 观阵态短路：跳过跟随相机逻辑（下面那段只在非观阵时跑）
      } else {
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
      // 镜头参数快照（T6 行动者切镜用：fx 分拍演出时 _camPeek 沿用本帧的 zoom/沉降/视差系数）
      this._camParts = { V, worldY, farY, midY, farScale, midScale, zoom };
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
      // 多战线（fronts≥2）：用可点击的战区摘要徽标巡场（B5）取代单一锁定目标 cue；
      //   单战线沿用旧远端点名（锁定目标出画时画框边缘亮名+血量）。
      if (c._fronts && c._fronts.length >= 2) {
        this._fightFarCue(null);
      } else {
        const cueHp = te2 ? Math.max(0, Math.round(te2.hp / te2.hpMax * 100)) : 0;
        this._fightFarCue(te2 && te2.pos + 0.5 > cam + V ? `${te2.name} ${cueHp}% ▶`
          : te2 && te2.pos + 0.5 < cam ? `◀ ${te2.name} ${cueHp}%` : null,
          te2 && te2.pos + 0.5 < cam);
      }
      this._frontCues(c, cam, V);
      }
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
      const fcWrap = this.el("axis-field") && this.el("axis-field").querySelector(".front-cues");
      if (fcWrap) fcWrap.remove();
    }

    // —— 防撞排布（v87 拥挤重设计）：同高度层单位按屏距扫描，间距不足时右侧者
    //    顺势让开（深排让得多）——规则站位不动，只挪演出排布；血条名牌随之岔开 ——
    this._decrowd(unitsEl, c);
    // —— 对脸列阵（v176）：再把交火的敌我两阵营从相叠里掰开成"对脸"对峙（演出位，不碰占格/平衡）——
    this._faceoff(unitsEl, c);

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

    // —— 真颠倒五行阵·手动相位选择（fieldManual：每回合玩家选一个未用过的相位激活）——
    const fcWrap = this.el("combat-fieldcycle");
    if (fcWrap) {
      if (c.fieldManual && c.fieldCycle && c.fieldCycle.length && c.status === "ongoing") {
        const used = c._fieldUsed || [];
        const applied = !!c._fieldPhaseApplied;
        const phaseBtn = (ph, i) => {
          const isUsed = used.includes(i);
          const canPick = !isUsed && !applied;
          const cls = ["fc-phase", isUsed ? "used" : "", applied && !isUsed ? "dim" : ""].join(" ").trim();
          const tag = isUsed ? "已用" : ph.player && ph.player.shield ? "护" : ph.player && ph.player.dodge ? "闪" : ph.player && ph.player.mp ? "回" : "攻";
          return `<button class="${cls}" ${canPick ? `onclick="Engine.combatFieldPhase(${i})"` : "disabled"} title="${ph.log || ""}">
            <i class="fc-seal">${ph.name.charAt(0)}</i><span class="fc-name">${ph.name}</span><i class="fc-tag">${tag}</i></button>`;
        };
        fcWrap.innerHTML = `<span class="zone-tag zt-field">阵法</span>${c.fieldCycle.map(phaseBtn).join("")}`;
        fcWrap.hidden = false;
      } else {
        fcWrap.hidden = true;
        fcWrap.innerHTML = "";
      }
    }

    // —— 灵力池 + 行动经济行 ——
    const mpPct = Math.max(0, p.mp / p.mpMax * 100);
    const acts = (c._pActsMax || 1) - (c._pActsUsed || 0);
    // 特色资源章（v96：神雷等 build 独立数值——打一道少一道，取舍即战术）
    const chargeChips = p.charges ? Object.values(p.charges).map(ch =>
      `<span class="act-chip charge ${ch.cur <= 0 ? 'used' : ''}" title="${ch.name}：战斗内不回充——用一道少一道">⚡${ch.name.slice(0, 2)}×${ch.cur}</span>`).join("") : "";
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
        ${chargeChips}
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
      const eMp = p.spellMp ? p.spellMp(id, sp) : (sp.mp || 0);
      const why = !afford
        ? (cdLeft > 0 ? `回气${cdLeft}` : noPouch ? "无存货" : eMp > p.mp ? "灵力不足" : sp.quick && c._pQuickUsed ? "瞬发已用" : "行动已尽")
        : (!inR ? "射程外" : "");
      const pouchTxt = (sp.consume ? `<span class="spouch ${noPouch ? 'empty' : ''}">×${p.pouch[sp.consume] || 0}</span>` : "")
        + (why ? `<span class="spouch empty">${why}</span>` : "");
      const dispName = (id === "zhayan" && p.swordMastery) ? "眨眼剑法·大成" : sp.name;
      const dispFx = (id === "zhayan" && p.swordMastery) ? spellEffectText(sp) + " 攒势×2" : spellEffectText(sp);
      const armedCls = (this._armed && this._armed.id === id) ? "armed" : "";
      // 悬浮法宝（三位制·祭出位）：点卡=祭起/收回；祭起中金边呼吸+随时可收
      if (sp.type === "float") {
        const up = (p.floats || []).includes(id);
        const can = up || (afford && (p.floats || []).length < (c.floatSlots ? c.floatSlots(p) : 1));
        return `<button class="spell-btn ${extraCls || ''} ${up ? 'floating' : ''} ${can ? '' : 'off'}" ${can ? '' : 'disabled'}
          onclick="Engine.combatFloat('${id}')" title="${sp.desc || ''}">
          <span class="role-tag rt-float">${up ? "祭" : "悬"}</span><span class="seal wx-${wx}">${sealChar(sp.name)}</span>
          <span class="sp-body">
            <span class="sname">${sp.name}<span class="srange">${up ? "运转中" : "悬浮"}</span></span>
            <span class="scost"><span class="cost-dot mp-dot">${up ? `燃灵${sp.float.upkeep}/回` : `灵力${eMp}`}</span> ${up ? "点击收回" : "祭起绕身"}</span>
          </span>
        </button>`;
      }
      const roleTag = role === "main" ? `<span class="role-tag rt-main">主</span>`
        : role === "def" ? `<span class="role-tag rt-def">御</span>` : "";
      return `<button class="spell-btn ${extraCls || ''} ${armedCls} ${usable ? '' : 'off'}" ${usable ? '' : 'disabled'} onclick="UI.armSpell('${id}')" title="${sp.desc || ''}">
        ${roleTag}<span class="seal ${sp.consume ? 'cinnabar' : 'wx-' + wx}">${sealChar(sp.name)}</span>
        <span class="sp-body">
          <span class="sname">${dispName}<span class="srange">${rangeTxt(sp)}</span></span>
          <span class="scost"><span class="cost-dot mp-dot">${eMp > 0 ? `灵力${eMp}` : "零耗"}</span> ${dispFx}${pouchTxt}</span>
        </span>
      </button>`;
    };
    // —— 手牌排版（用户裁决 L1-L5）：法宝=左详细(主攻/主防) + 右图标(特效型/悬浮，两排)；
    //    法术锁死 8 格、4×2 对齐；瞬发/助战各自独立窄行；回合结束与手牌同屏（combat-console 紧凑）。
    //    装备型(只加属性的伴身法宝)不入手牌——在洞府装备界面吃属性(L3)，故此处不再渲染 side-seal。
    // 神雷类特色资源技（chargeCost.id==="shenlei"）不入法宝/法术/瞬发栏——统一走辟邪神雷单卡三选；
    // 噬金虫四用法（chargeCost.id==="shijinchong"）则照常入法宝栏（主攻/图标卡），共享池由 canAfford 自动哑火。
    const treasures = p.spells.filter(id => SP[id] && !SP[id].quick && SP[id].source === "treasure" && !(SP[id].chargeCost && SP[id].chargeCost.id !== "shijinchong"));
    const mains = p.spells.filter(id => SP[id] && !SP[id].quick && SP[id].source !== "treasure");
    const quicks = p.spells.filter(id => SP[id] && SP[id].quick && !SP[id].chargeCost);
    // 主攻法宝=兵器(gear weapon)所授攻击法宝，余者首张攻击法宝兜底；主防法宝=首张护体法宝。
    // 此二者占左侧详细卡(靠左、写全)；其余法宝(子母刃等特效型/悬浮祭出位)一律走右侧图标两排(L1/L2)。
    const wGear = (typeof State !== "undefined" && State.gearOf) ? State.gearOf("weapon") : null;
    const mainTre = (wGear && wGear.grantSpells && wGear.grantSpells.find(id => treasures.includes(id)))
      || treasures.find(id => SP[id].type === "atk") || null;
    const mainDef = treasures.find(id => SP[id].type === "def") || null;
    const leftTre = [mainTre, mainDef].filter(Boolean);
    const iconTre = treasures.filter(id => !leftTre.includes(id));   // 子母刃/花篮等 → 右侧图标卡
    // 法术锁死 8（v103 用户裁决；Balance.skillSlots 同步为 8）：4×2 对齐格，超出去洞府编排
    const mains8 = mains.filter(id => !SP[id].chargeCost).slice(0, 8);
    const mainsAll = mains.filter(id => !SP[id].chargeCost);
    // 辟邪神雷三选（v98 用户裁决：条状叠在本命法宝卡【正上方】，不占格——
    // 点击→选择→生效：打/附/遁。神雷=本命法宝（青竹蜂云剑）所蕴的手段，故贴本命卡头）
    let shenleiStrip = "";
    const slCh = p.charges && p.charges.shenlei;
    if (slCh) {
      const can = m => {
        const sp2 = SP[m];
        if (!sp2) return false;
        if (sp2.blinkMove && !p.blink) return false;   // 雷遁需御「风雷翅」——未解锁则置灰（problem 5）
        return slCh.cur >= sp2.chargeCost.n && (sp2.mp || 0) <= p.mp
          && (sp2.quick ? !c._pQuickUsed : c._pActsUsed < c._pActsMax);
      };
      const opt = (m, ch, tip) => `<i class="sl-opt ${can(m) ? "" : "off"}" onclick="event.stopPropagation();${can(m) ? `Engine.combatShenlei('${m}')` : ""}" title="${tip}">${ch}</i>`;
      const dunTip = p.blink
        ? "雷遁：耗雷1灵5（瞬发）——穿亚空间瞬移，本回合移动无视挡线+4步"
        : "雷遁：需御「风雷翅」方可穿空遁走（乱星海篇机缘，尚未解锁）";
      shenleiStrip = `<div class="shenlei-strip ${slCh.cur <= 0 ? "off" : ""}" title="辟邪神雷：${slCh.cur}/${slCh.max} 道——打一道少一道（青竹蜂云剑所蕴）">
        <span class="sl-name">辟邪神雷 <b>⚡×${slCh.cur}</b></span>
        ${opt("shenlei_pi", "劈", "辟邪神雷·劈：耗雷1灵6——金雷自身畔轰发、左右十格横扫（克邪魔×1.8）")}
        ${opt("shenlei_fujian", "附", "神雷附剑：耗雷3灵4——青竹云剑绕身缠金雷，三回合主攻法宝带雷+8克邪")}
        ${opt("leidun", "遁", dunTip)}
      </div>`;
    }
    // 法宝图标卡（右侧·特效型/悬浮，L2）：攻防点击上膛、悬浮点击祭起/收回——只露印章+短名+角色章。
    const treIcon = (id) => {
      const sp = SP[id];
      const wx = sp.elem || sp.school || "jin";
      if (sp.type === "float") {
        const up = (p.floats || []).includes(id);
        const slots = c.floatSlots ? c.floatSlots(p) : 1;
        const can = up || (c.canAfford(id) && (p.floats || []).length < slots);
        return `<button class="tre-icon ${up ? "floating" : ""} ${can ? "" : "off"}" ${can ? "" : "disabled"} onclick="event.stopPropagation();Engine.combatFloat('${id}')" title="${sp.name}：${sp.desc || spellEffectText(sp)}${sp.mp ? "（灵力" + sp.mp + "）" : ""}">
          <i class="seal wx-${wx}">${sealChar(sp.name)}</i><span class="ti-name">${sp.name}</span><i class="ti-tag float">${up ? "运" : "悬"}</i></button>`;
      }
      const afford = c.canAfford(id);
      const inR = c.enemies.some((e2, i2) => e2.alive && c.castableAt(id, i2));
      const usable = afford && inR;
      const armedCls = (this._armed && this._armed.id === id) ? "armed" : "";
      const why = !afford
        ? ((c.cooldownLeft && c.cooldownLeft(id) > 0) ? "回气" + c.cooldownLeft(id) : ((sp.mp || 0) > p.mp ? "灵力不足" : "行动已尽"))
        : (!inR ? "射程外" : "");
      return `<button class="tre-icon ${armedCls} ${usable ? "" : "off"}" ${usable ? "" : "disabled"} onclick="UI.armSpell('${id}')" title="${sp.name}：${spellEffectText(sp)}（${rangeTxt(sp)}${sp.mp ? "·灵力" + sp.mp : ""}）${why ? "——" + why : ""}">
        <i class="seal wx-${wx}">${sealChar(sp.name)}</i><span class="ti-name">${sp.name}</span><i class="ti-tag ${sp.type === "def" ? "def" : "atk"}">${sp.type === "def" ? "御" : "攻"}</i></button>`;
    };
    // 本命法宝列（左·详细，L1）：主攻卡（神雷条贴头顶）+ 主防卡，竖向堆叠靠左；无主攻则退化
    const mainCell = mainTre
      ? (shenleiStrip
          ? `<div class="treasure-main">${shenleiStrip}${spellBtn(mainTre, "treasure compact", "main")}</div>`
          : spellBtn(mainTre, "treasure", "main"))
      : (shenleiStrip ? `<div class="treasure-main">${shenleiStrip}</div>` : "");
    const defCell = mainDef ? spellBtn(mainDef, "treasure", "def") : "";
    const hasArsenal = mainTre || mainDef || shenleiStrip || iconTre.length;
    // 法宝（左详细 + 右图标两排）/ 法术（锁死 8、4×2 对齐）分排（L1/L2/L4）
    this.el("combat-spells").innerHTML =
      (hasArsenal
        ? `<div class="arsenal"><div class="arsenal-main"><span class="zone-tag zt-treasure">法宝</span><div class="tre-col">${mainCell}${defCell}</div></div>`
          + (iconTre.length ? `<div class="arsenal-side">${iconTre.map(treIcon).join("")}</div>` : "")
          + `</div>`
        : "")
      + `<div class="spell-grid spell8"><span class="zone-tag">法术</span>${mains8.map(id => spellBtn(id)).join("")}`
      + (mainsAll.length > 8 ? `<span class="zone-overflow" title="出战法术上限 8——洞府中重新编排">+${mainsAll.length - 8} 未出战</span>` : "")
      + `</div>`;
    // 瞬发 + 助战：同一条窄排（瞬发牌横滑；助战卡点击换简令）。
    // 客随例外（用户裁决）：境界远高于你的同道（mastery≥2）全自动——她指挥你（点将），
    // 你指挥不了她；简令四档只对平辈/下属（尸傀/灵宠/低阶同道）生效
    const qrow = this.el("quick-row");
    if (qrow) {
      const petCard = (u, idx, stackN) => {
        const down = u.hp <= 0;
        const lead = u.kind === "ally" && (u.mastery || 0) >= 2;
        const st = u.stance || "follow";
        const stCh = lead ? "帅" : ({ follow: "随", attack: "攻", guard: "守", ultimate: "憋", retreat: "撤" }[st] || "随");
        const hpPct = Math.max(0, Math.round(u.hp / u.hpMax * 100));
        const mpPct = u.mpMax ? Math.max(0, Math.round((u.mp || 0) / u.mpMax * 100)) : 0;
        // 灵虫/灵宠形态钩（用户裁决：点形态章切换化枪/附体/分身——u.forms 定义后生效，
        // 血玉蜘蛛起为单形态，乱星海噬金虫开多形态）
        const formCh = (u.forms && u.forms.length > 1)
          ? `<span class="pc-form" onclick="event.stopPropagation(); Engine.cycleSideForm(${idx})" title="切换形态">${u.form || u.forms[0]}</span>` : "";
        return `<button class="pet-card ${down ? 'down' : ''} ${lead ? 'lead' : ''}" ${down ? 'disabled' : ''}
          onclick="Engine.cycleSideStance(${idx})" title="${down ? u.name + ' 已离场' : lead ? '她的境界远在你之上——全程自主出手，每回合为你点将' : '点击换简令：随行→强攻→护主→憋大招→后撤'}">
          <span class="seal">${u.name[0]}${stackN > 1 ? `<i class="pc-stack">×${stackN}</i>` : ""}</span>
          <span class="pc-body"><span class="pc-name">${u.name}</span>
          <span class="pc-hp"><i style="width:${hpPct}%"></i></span>
          ${u.mpMax ? `<span class="pc-mp"><i style="width:${mpPct}%"></i></span>` : ""}</span>
          ${formCh}<span class="pc-st">${down ? "殁" : stCh}</span>
        </button>`;
      };
      // T4 多侧位+堆叠（用户裁决：傀儡×2×3）：同 id 同类聚合为一张卡带数量章，
      // 简令对整组下达（点卡=组令）；具名同道（南宫婉/万小山）各自一张
      const sidesAll = c.sides || (c.side ? [c.side] : []);
      const groups = [];
      sidesAll.forEach((u, i) => {
        const key = u.id || ("u" + i);
        const g = groups.find(x => x.key === key && u.kind !== "ally");
        if (g) g.n++;
        else groups.push({ key, u, idx: i, n: 1 });
      });
      // 助战=独立一栏（用户裁决）；瞬发自成一行
      const petRow = this.el("pet-row");
      if (petRow) {
        petRow.innerHTML = groups.length
          ? `<span class="zone-tag zt-pet">助战</span>${groups.map(g => petCard(g.u, g.idx, g.n)).join("")}` : "";
        petRow.hidden = !groups.length;
      }
      qrow.innerHTML =
        (quicks.length ? `<span class="zone-tag zt-quick">瞬发</span>${quicks.map(id => spellBtn(id, "trump")).join("")}` : "")
        // 回退：无独立助战栏的旧 DOM（preview 等）仍并入瞬发行
        + (!petRow && groups.length ? `<span class="zone-tag zt-pet">助战</span>${groups.map(g => petCard(g.u, g.idx, g.n)).join("")}` : "");
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
    // 据点和平·市声鼎沸（town）；险境（血色禁地等）·弦绷紧（tense）
    // playtest 2026-07-12 用户反馈：后山采药听悬疑弦=太激昂——图级 bgm 字段可覆盖（后山=journey 行旅笛弦）
    const map = ExploreMap.mapOf(ExploreMap.cur(s.exmap));
    if (typeof Sfx !== "undefined" && Sfx.bgm) Sfx.bgm(map.bgm || (map.peaceful ? "town" : "tense"));
    this._exmapNoteQueue = [];
    // B3 箱庭演出层（2026-07-11 用户提案）：据点级天象搬进箱庭——雾/尘/雪/雨氛围粒 + 声床 + 间歇远声
    this._startExmapAmbience(ExploreMap.MAPS[s.exmap.stack[0].mapId]);
    this.renderExmap();
  },
  closeExmap() {
    this.el("exmap-overlay").hidden = true;
    this.el("exmap-notes").innerHTML = "";
    this._stopExmapAmbience();
  },

  /* ===== 箱庭天象（B3·2026-07-11 用户提案"箱庭也要据点级演出"）=====
   * 与战场天象（_startBattleAmbience）同族：前景雾=DOM 雾层（大片重模糊雾团 CSS 慢漂——
   * 不发光、成片、有厚度；⚠ 光斑粒子画雾=光球，用户实锤"太蠢"，已废）；
   * 雪/雨/尘=Fx.ambient 小颗粒（够小不糊成球）；声床=Sfx.ambient + 间歇远声 loop。
   * 配置声明在 ExploreMap.MAPS[id].ambience（fog{tint,opacity} / fx / amb / loops）；
   * 定时器入 _exmapAmbTimers，closeExmap 一并收（绝不漏到主界面）。 */
  _exmapAmbTimers: null,
  _startExmapAmbience(map) {
    this._stopExmapAmbience();
    if (!map || !map.ambience) return;
    const host = this.el("exmap-field");
    if (!host) return;
    const A = map.ambience;
    const reduced = (typeof Fx !== "undefined" && Fx._reduced) ? !!Fx._reduced() : false;
    // 前景雾（DOM 层，z:4 飘在节点 pin 之前）——关动效时不挂
    if (A.fog && !reduced) this._exmapFogOn(host, A.fog);
    // 小颗粒天气（雪/雨/尘——不含雾）走氛围粒画布
    if (A.fx && typeof Fx !== "undefined" && Fx.ensure(host)) Fx.ambient(A.fx, A.fxOpts || {});
    if (A.amb && typeof Sfx !== "undefined" && Sfx.ambient) {
      Sfx.ambient(A.amb, { vol: A.ambVol != null ? A.ambVol : 0.22, duck: false });
    }
    const timers = this._exmapAmbTimers = [];
    (A.loops || []).forEach(L => {
      const h = { id: 0 };
      const tick = () => {
        if (typeof Sfx !== "undefined") Sfx.play(L.sfx);
        h.id = setTimeout(tick, L.lo + Math.random() * (L.hi - L.lo));
      };
      h.id = setTimeout(tick, 2000 + Math.random() * L.lo);
      timers.push(h);
    });
  },
  _stopExmapAmbience() {
    (this._exmapAmbTimers || []).forEach(h => clearTimeout(h && h.id != null ? h.id : h));
    if (this._exmapAmbTimers) {
      if (typeof Fx !== "undefined") Fx.ambient("off");
      if (typeof Sfx !== "undefined" && Sfx.ambientStop) Sfx.ambientStop();
    }
    this._exmapAmbTimers = null;
    this._exmapFogOff();
  },
  // 前景雾 DOM 层：三条大雾带（上岚/中霭/贴地霾）重模糊慢漂——tint 注入每图雾色
  _exmapFogOn(host, cfg) {
    this._exmapFogOff();
    const el = document.createElement("div");
    el.className = "exmap-fog";
    el.style.setProperty("--fog-c", cfg.tint || "172,179,188");
    if (cfg.opacity != null) el.style.setProperty("--fog-o", cfg.opacity);
    el.innerHTML = "<i></i><i></i><i></i>";
    host.appendChild(el);
    this._exmapFogEl = el;
  },
  _exmapFogOff() {
    if (this._exmapFogEl) { try { this._exmapFogEl.remove(); } catch (e) {} this._exmapFogEl = null; }
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
    // B3 天象随层起收：入洞收野外天象（洞里没有风雪）；回野外自愈重起
    if (isCave && this._exmapAmbTimers) this._stopExmapAmbience();
    if (!isCave && !this._exmapAmbTimers) this._startExmapAmbience(ExploreMap.MAPS[x.stack[0].mapId]);
    if (isCave) { this._renderExmapScene(x, f); return; }
    const map = ExploreMap.mapOf(f);
    if (map && map.peaceful) { this._renderStrongholdField(x, f); return; }  // 据点：和平节点图（不动血色路径）
    if (map && map.fog) { this._renderFogField(x, f); return; }              // 后山：野外战争迷雾（与血色禁地隔离）
    this._renderExmapField(x, f);
  },

  /* ---------- 后山·野外战争迷雾舆图渲染（fog:true：四态可见性 + 远距感知梯度） ----------
   * 与血色禁地 _renderExmapField 完全隔离，零回归。无灾厄钟；钟盘位换感知梯度副标。
   * 四态：unknown 覆雾不画 / glimpsed 窥见（雾影问号）/ rumored 风闻（标出·知其所在）/ visited 已至全显。 */
  _renderFogField(x, f) {
    const map = ExploreMap.mapOf(f);
    const bg = this.el("exmap-bg");
    const bgUrl = Art.sceneUrl(map.bg, { landscape: true });
    if (bgUrl && bg.dataset.cur !== bgUrl) { bg.style.backgroundImage = `url('${bgUrl}')`; bg.dataset.cur = bgUrl; }

    this.el("exmap-title").textContent = map.name;
    // 钟盘位：后山无灾厄钟——换成远距感知梯度（最强危险源的方位强弱，一行预告）
    const sf = ExploreMap.senseField(x);
    this.el("exmap-clock").innerHTML = sf
      ? `<span class="exclk-sense${sf.level >= 3 ? " strong" : ""}">${"⚠".repeat(Math.min(3, sf.level))} 腥气·${sf.dir}</span>`
      : `<span class="exclk-peace">${map.subtitle || "雾锁千山"}</span>`;

    const opts = ExploreMap.options(x);
    const optMap = {};
    opts.forEach(o => { optMap[o.id] = o; });
    const st = id => ExploreMap.fogState(x, id);

    // 连线：两端都不在雾中（fogState !== unknown）才画
    const svg = this.el("exmap-edges");
    let lines = "";
    (map.edges || []).forEach(([a, b]) => {
      if (st(a) === "unknown" || st(b) === "unknown") return;
      const na = map.nodes[a], nb = map.nodes[b];
      const isOpt = (a === f.node && optMap[b]) || (b === f.node && optMap[a]);
      lines += `<line x1="${na.x}" y1="${na.y}" x2="${nb.x}" y2="${nb.y}" class="exedge${isOpt ? " reach" : ""}"/>`;
    });
    svg.innerHTML = lines;

    // 节点（按四态渲染）
    const box = this.el("exmap-nodes");
    let html = "";
    Object.entries(map.nodes).forEach(([id, n]) => {
      const state = st(id);
      if (state === "unknown") return;                  // 覆雾：不画
      const here = id === f.node;
      const opt = optMap[id];
      let cls = "exnode";
      if (here) cls += " here";
      if (opt && !here) cls += " reach";
      if (f.cleared[id]) cls += " cleared";
      if (state === "glimpsed" && !here) cls += " ghost";    // 窥见：雾影
      if (state === "rumored" && !here) cls += " rumored";   // 风闻：标出
      let mark = "";
      if (state === "rumored" && !f.hunted[id]) mark = `<span class="exrisk sense">闻</span>`;
      else if (n.kind === "danger" && !f.hunted[id]) mark = `<span class="exrisk lair">凶</span>`;
      const cost = (opt && !here) ? `<span class="excost">${opt.cost}钟</span>` : "";
      const click = (opt && !here) ? `onclick="Engine.exmapTravel('${id}')"` : "";
      const nm = (state === "glimpsed" && !here) ? "？" : n.name;   // 窥见只见轮廓，未识其名
      html += `<div class="${cls}" style="left:${n.x}%;top:${n.y}%" ${click}>
        <span class="exicon">${n.icon || "·"}</span>
        <span class="exname">${nm}</span>${cost}${mark}
      </div>`;
    });
    const cn = map.nodes[f.node];
    html += `<div class="expawn" style="left:${cn.x}%;top:${cn.y}%"><img src="${Art.url("hanli") || ""}" alt=""></div>`;
    box.innerHTML = html;

    // 行动条：按当前节点给动作（先猎杀方可搜刮；歇脚回灵；林口离山）
    const node = map.nodes[f.node];
    const acts = [];
    if (node.kind === "danger" && !f.hunted[f.node]) {
      // 猎杀对象名：节点自带（阴冥·灰蜮母巢等）优先；后山沿用异闻妖王
      const beast = node.huntName
        || ((State.data.beastRumor && WORLD.enemies[State.data.beastRumor]) ? WORLD.enemies[State.data.beastRumor].name : "盘踞的凶兽");
      acts.push(`<button class="btn btn-warn" onclick="Engine.exmapHunt()">猎杀「${beast}」</button>`);
    } else if (node.loot && !f.cleared[f.node]) {
      acts.push(`<button class="btn" onclick="Engine.exmapGather()">${node.kind === "danger" ? "搜刮（1钟）" : "采集（1钟）"}</button>`);
    }
    if (node.kind === "rest") acts.push(`<button class="btn" onclick="Engine.exmapStay(1)">${map.jueling ? "生火裹伤·养气（1钟）" : "打坐调息（1钟）"}</button>`);
    if (node.kind === "exit") acts.push(`<button class="btn btn-warn" onclick="Engine.finishExmap('leave')">${map.exitLabel || "离开后山"}</button>`);
    if (node.kind !== "rest" && node.kind !== "exit") acts.push(`<button class="btn btn-ghost" onclick="Engine.exmapStay(1)">驻足观察（1钟）</button>`);
    // playtest 2026-07-12：深处不必一格格点回去——任意节点一键归程（BFS 脚程照付·阴冥"唯一出口=栈道"例外）
    if (node.kind !== "exit" && map.fog && !map.jueling) acts.push(`<button class="btn btn-ghost" onclick="Engine.exmapReturnHome()">循原路${map.id === "houshan_l1" ? "下山" : "退出"}（归程脚程照算）</button>`);
    this.el("exmap-actions").innerHTML = acts.join("");
  },

  /* ---------- 据点节点图渲染（和平：地标全亮·无钟无巡逻·复访变迁） ----------
   * 与血色禁地 _renderExmapField 完全隔离，零回归风险。 */
  _renderStrongholdField(x, f) {
    const map = ExploreMap.mapOf(f);
    const bg = this.el("exmap-bg");
    const bgUrl = Art.sceneUrl(map.bg, { landscape: true });
    if (bgUrl && bg.dataset.cur !== bgUrl) { bg.style.backgroundImage = `url('${bgUrl}')`; bg.dataset.cur = bgUrl; }

    this.el("exmap-title").textContent = map.name;
    // 钟盘位：据点无灾厄钟，换成一行风物副标（"信步城中·随时离城"）
    this.el("exmap-clock").innerHTML = `<span class="exclk-peace">${map.subtitle || "信步城中"}</span>`;

    const opts = ExploreMap.options(x);
    const optMap = {};
    opts.forEach(o => { optMap[o.id] = o; });

    // 连线：据点已知，全画；当前可去的高亮
    const svg = this.el("exmap-edges");
    let lines = "";
    (map.edges || []).forEach(([a, b]) => {
      const na = map.nodes[a], nb = map.nodes[b];
      const isOpt = (a === f.node && optMap[b]) || (b === f.node && optMap[a]);
      lines += `<line x1="${na.x}" y1="${na.y}" x2="${nb.x}" y2="${nb.y}" class="exedge${isOpt ? " reach" : ""}"/>`;
    });
    svg.innerHTML = lines;

    // 地标：城里地方都认得，全部显形（无雾影）
    const box = this.el("exmap-nodes");
    let html = "";
    Object.entries(map.nodes).forEach(([id, n]) => {
      const here = id === f.node;
      const opt = optMap[id];
      let cls = "exnode peace";
      if (here) cls += " here";
      if (opt && !here) cls += " reach";
      const click = (opt && !here) ? `onclick="Engine.strongholdTravel('${id}')"` : "";
      html += `<div class="${cls}" style="left:${n.x}%;top:${n.y}%" ${click}>
        <span class="exicon">${n.icon || "·"}</span>
        <span class="exname">${n.name}</span>
      </div>`;
    });
    const cn = map.nodes[f.node];
    html += `<div class="expawn" style="left:${cn.x}%;top:${cn.y}%"><img src="${Art.url("hanli") || ""}" alt=""></div>`;
    box.innerHTML = html;

    // 行动条：当前地标的一段交互 + 离城
    const node = map.nodes[f.node];
    const acts = [];
    if (node.act === "rest" || node.act === "market" || node.act === "cultivate") {
      acts.push(`<button class="btn" onclick="Engine.strongholdDo('${node.act}')">${node.actLabel || "进去看看"}</button>`);
    } else if (node.act === "board" || node.act === "rumor") {
      acts.push(`<button class="btn" onclick="Engine.strongholdRead('${f.node}')">${node.actLabel || "细看"}</button>`);
    }
    acts.push(`<button class="btn btn-ghost" onclick="Engine.finishStronghold()">离开此地</button>`);
    this.el("exmap-actions").innerHTML = acts.join("");
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
      else if (!f.closed[id] && n.kind === "danger" && !(f.hunted && f.hunted[id])) riskMark = `<span class="exrisk lair">凶</span>`;
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
    // D2 巡场猎杀（节点级 huntEnemy·血煞兽）：先猎杀方可搜刮——不猎也能原路走开（可绕开）
    const huntPending = node.kind === "danger" && node.huntEnemy && !(f.hunted && f.hunted[f.node]);
    if (huntPending) {
      acts.push(`<button class="btn btn-warn" onclick="Engine.exmapHunt()">猎杀「${node.huntName || "凶兽"}」</button>`);
    } else if (node.loot && !f.cleared[f.node]) acts.push(`<button class="btn" onclick="Engine.exmapGather()">${node.kind === "danger" ? "搜刮（1钟）" : "采集（1钟）"}</button>`);
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
    const heroBt = (typeof Art !== "undefined" && Art.heroBattlerId) ? Art.heroBattlerId() : "bt_hanli";
    const heroPt = (typeof Art !== "undefined" && Art.heroId) ? Art.heroId() : "hanli";
    const udefs = [{ key: "hanli:" + heroBt, art: heroBt, fallback: heroPt, name: "韩立",
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
  _hotIcon(name) { return /阵旗/.test(name) ? "旗" : /主药|老株/.test(name) ? "🌿" : /灵石/.test(name) ? "💎" : "🌱"; },

  // 镜头导演参数（teamfight-camera-design §7 手感微调）：把所有"节拍/距离/时长"常数集中一处，
  //   一处即可统调演出节奏（用户原话"切镜要丝滑、不晕镜、衔接自然"）。改这里调全局手感。
  DIRECTOR: {
    view: 13,            // 宽轴基线视野（格）——与 renderCombat 死区 V 同源（文档值，跟随处仍内联）
    deadZone: 2.4,       // 死区半幅（格）：玩家在此区内随便走、镜头不动（文档值）
    panSlowCells: 5,     // 切镜跨度 > 此格数 → 放慢过渡（大跨度丝滑）
    panSlowDur: "1.7s",  // 大跨度切镜时长
    turnHold: 460,       // B1：真切了镜的那一拍——给镜头行进+落定驻留（ms·宽轴），看清“谁打谁”再走下一拍
    turnBeat: 90,        // B1：没切镜的远摊回合——只给极短节拍掠过，不拖镜、不空等（反“拖来拖去”）
    dashFollowLag: 360,  // B2：驰援疾遁落点跟拍延时（ms）
    sweepLead: 360,      // B3：开场横幅先亮的起手延时（ms）
    sweepStep: 1200,     // B3：每条战线停留（ms）
    sweepHoldLast: 1100, // B3：落回韩立停留（ms）
    punchMs: 620,        // B4 燃点推近：终结一击/大招/驰援落点的轻推近时长（ms）
  },

  // 燃点推近（teamfight-camera-design B4）：终结一击/大招/驰援落点——镜头极轻一推再松，
  //   给"这一下"分量感。纯叠加在 axis-field 视口上（transform 不动 _cam/不扰死区跟随、不改布局），
  //   动画自复位。信条"能不动就不动"：只在燃点用、时长短、幅度小（≈5%），绝不晕镜。
  _camPunch() {
    const field = this.el("axis-field");
    if (!field || this._sweeping) return;   // 开场扫场进行中不抢镜
    field.classList.remove("cam-punch");
    void field.offsetWidth;   // 重排：让动画可连续重触发
    field.classList.add("cam-punch");
    clearTimeout(this._punchTimer);
    this._punchTimer = setTimeout(() => field.classList.remove("cam-punch"), this.DIRECTOR.punchMs);
  },

  // 战斗版远端点名：锁定目标在镜头外时，画框边缘亮出名字与方向
  /* ===== 行动者切镜（tactics T6）：回合制的天然优势——谁行动，镜头看谁 =====
   * fx 分拍演出时把镜头平移到行动者（只动 translateX，zoom/沉降/视差沿用当帧快照）；
   * 行动者已在画面中带（±2.5 格余量）则纹丝不动——镜头能不动就不动（晕镜的反义词）。
   * 大跨度（>5 格）自动放慢过渡（1.7s）——"切镜要丝滑，不要又晕又看不清"（用户原话） */
  // 解析切镜引用 → 单位（player / side[:i] / enemy:i）
  _refUnit(c, ref) {
    if (!c) return null;
    return ref === "player" ? c.player
      : /^side/.test(ref || "") ? (c.sides ? c.sides[+(ref.split(":")[1] || 0)] : c.side)
      : /^enemy:/.test(ref || "") ? c.enemies[+ref.split(":")[1]] : null;
  },
  // 该行动者值不值得递镜（B1 反晕镜）：窄场永远跟（老逻辑无碍）；宽场只跟“韩立视角带内”的——
  //   韩立本人必跟；其余单位只有离韩立够近（同一摊交火，半个视野内）才跟。远摊不追，交由画框徽标提示。
  _peekWorthy(c, ref) {
    if (!c || c.W <= 13) return true;
    if (ref === "player") return true;
    const u = this._refUnit(c, ref);
    if (!u || typeof u.pos !== "number" || (u.hp != null && u.hp <= 0)) return false;
    const px = (c.player && typeof c.player.pos === "number") ? c.player.pos : 0;
    const V = (this._camParts && this._camParts.V) ? this._camParts.V : this.DIRECTOR.view;
    return Math.abs(u.pos - px) <= (V / 2 - 1.5);
  },
  _camPeek(c, ref) {
    if (!c || c.W <= 13 || !this._camParts || typeof c._cam !== "number") return;
    const u = this._refUnit(c, ref);
    if (!u || (u.hp != null && u.hp <= 0 && ref !== "player")) return;
    const P = this._camParts, V = P.V;
    const cur = c._cam;
    // 已在画面中带：不动镜
    if (u.pos + 0.5 >= cur + 2.5 && u.pos + 0.5 <= cur + V - 2.5) return;
    let cam = Math.max(0, Math.min(c.W - V, u.pos + 0.5 - V / 2));
    if (Math.abs(cam - cur) < 0.6) return;
    c._cam = cam;
    const slow = Math.abs(cam - cur) > this.DIRECTOR.panSlowCells;
    const shift = (cam / c.W) * 100;
    const camT = (c.W - V) > 0 ? cam / (c.W - V) : 0;
    [this.el("axis-lane"), this.el("axis-units")].forEach(el => {
      if (!el) return;
      el.style.transitionDuration = slow ? this.DIRECTOR.panSlowDur : "";
      el.style.transform = `translateX(-${shift.toFixed(2)}%)${P.worldY} scale(${P.zoom.toFixed(3)})`;
    });
    const bg = this.el("combat-bg");
    if (bg) {
      bg.style.transitionDuration = slow ? this.DIRECTOR.panSlowDur : "";
      bg.style.transform = `translateX(${(-camT * 9).toFixed(2)}%)${P.farY} scale(${P.farScale})`;
    }
    const mid = this.el("combat-bgmid");
    if (mid && mid.classList.contains("on")) {
      mid.style.transitionDuration = slow ? this.DIRECTOR.panSlowDur : "";
      mid.style.transform = `translateX(${(-camT * 17).toFixed(2)}%)${P.midY} scale(${P.midScale})`;
    }
    // 限速恢复（下一次 renderCombat 的统一时长接管）
    if (slow) setTimeout(() => {
      [this.el("axis-lane"), this.el("axis-units"), this.el("combat-bg"), this.el("combat-bgmid")]
        .forEach(el => { if (el) el.style.transitionDuration = ""; });
    }, 1750);
  },

  // 按格切镜（B2 跟拍长镜头用）：镜头平移到指定格——同 _camPeek 的死区/限速数学，
  //   但锁定的是"某一格"而非某单位（驰援疾遁分两拍：先停起点 from、再跟落点 to）。
  _camPeekCell(c, cell) {
    if (!c || c.W <= 13 || !this._camParts || typeof c._cam !== "number" || typeof cell !== "number") return;
    const P = this._camParts, V = P.V, cur = c._cam;
    if (cell + 0.5 >= cur + 2.5 && cell + 0.5 <= cur + V - 2.5) return;   // 已在画面中带：不动镜
    const cam = Math.max(0, Math.min(c.W - V, cell + 0.5 - V / 2));
    if (Math.abs(cam - cur) < 0.6) return;
    c._cam = cam;
    const slow = Math.abs(cam - cur) > this.DIRECTOR.panSlowCells;
    const shift = (cam / c.W) * 100;
    const camT = (c.W - V) > 0 ? cam / (c.W - V) : 0;
    [this.el("axis-lane"), this.el("axis-units")].forEach(el => {
      if (!el) return;
      el.style.transitionDuration = slow ? this.DIRECTOR.panSlowDur : "";
      el.style.transform = `translateX(-${shift.toFixed(2)}%)${P.worldY} scale(${P.zoom.toFixed(3)})`;
    });
    const bg = this.el("combat-bg");
    if (bg) { bg.style.transitionDuration = slow ? this.DIRECTOR.panSlowDur : ""; bg.style.transform = `translateX(${(-camT * 9).toFixed(2)}%)${P.farY} scale(${P.farScale})`; }
    const mid = this.el("combat-bgmid");
    if (mid && mid.classList.contains("on")) { mid.style.transitionDuration = slow ? this.DIRECTOR.panSlowDur : ""; mid.style.transform = `translateX(${(-camT * 17).toFixed(2)}%)${P.midY} scale(${P.midScale})`; }
    if (slow) setTimeout(() => {
      [this.el("axis-lane"), this.el("axis-units"), this.el("combat-bg"), this.el("combat-bgmid")]
        .forEach(el => { if (el) el.style.transitionDuration = ""; });
    }, 1750);
  },

  // 开场扫场（teamfight-camera-design B3）：多战线团战开战时镜头横扫各战区——
  //   首尾战线各亮一拍（飘出战线名），再落回韩立。让玩家开局即"看清三摊架在哪"。
  //   纯演出：只动镜头 _cam，玩家一交互即由 renderCombat 死区接管，绝不夺操作。
  _frontSweep(c) {
    if (!c || c.W <= 13 || !this._camParts || typeof c._cam !== "number") return;
    if (!c._sweepOnOpen || !c._fronts || c._fronts.length < 2) return;
    const P = this._camParts, V = P.V;
    const layers = () => [this.el("axis-lane"), this.el("axis-units")];
    // 按位置排序的战线锚点：最左→最右→韩立收束
    const sorted = c._fronts.slice().sort((a, b) => a.at - b.at);
    const seq = [sorted[0], sorted[sorted.length - 1], { at: c.player.pos, name: null }];
    const panTo = (cell, dur) => {
      const cam = Math.max(0, Math.min(c.W - V, cell + 0.5 - V / 2));
      c._cam = cam;
      const shift = (cam / c.W) * 100;
      const camT = (c.W - V) > 0 ? cam / (c.W - V) : 0;
      layers().forEach(el => { if (el) { el.style.transitionDuration = dur + "s"; el.style.transform = `translateX(-${shift.toFixed(2)}%)${P.worldY} scale(${P.zoom.toFixed(3)})`; } });
      const bg = this.el("combat-bg"); if (bg) { bg.style.transitionDuration = dur + "s"; bg.style.transform = `translateX(${(-camT * 9).toFixed(2)}%)${P.farY} scale(${P.farScale})`; }
      const mid = this.el("combat-bgmid"); if (mid && mid.classList.contains("on")) { mid.style.transitionDuration = dur + "s"; mid.style.transform = `translateX(${(-camT * 17).toFixed(2)}%)${P.midY} scale(${P.midScale})`; }
    };
    this._sweeping = true;
    let t = this.DIRECTOR.sweepLead;   // 起手稍候：让开场横幅先亮
    seq.forEach((f, i) => {
      const last = i === seq.length - 1;
      setTimeout(() => {
        panTo(f.at, last ? 1.0 : 1.1);
        if (!last && f.name) this._fightFarCue(f.name + (f.at <= c.W / 2 ? " ◀" : " ▶"), f.at <= c.W / 2);
        else this._fightFarCue(null);
      }, t);
      t += last ? this.DIRECTOR.sweepHoldLast : this.DIRECTOR.sweepStep;
    });
    // 收尾：交回 renderCombat 的统一时长接管
    setTimeout(() => {
      this._sweeping = false;
      [this.el("axis-lane"), this.el("axis-units"), this.el("combat-bg"), this.el("combat-bgmid")]
        .forEach(el => { if (el) el.style.transitionDuration = ""; });
    }, t + 120);
  },

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

  // 多战线摘要徽标（teamfight-camera-design B5）：镜头外的各战区在画框边缘列名+血量/状态，
  //   点击即把镜头巡过去（_camPeek，纯演出·不耗回合·不夺操作）。无 fronts/单战线则清空。
  _frontCues(c, cam, V) {
    const field = this.el("axis-field");
    if (!field) return;
    let wrap = field.querySelector(".front-cues");
    if (!c._fronts || c._fronts.length < 2 || typeof cam !== "number") {
      if (wrap) wrap.remove();
      return;
    }
    if (!wrap) { wrap = document.createElement("div"); wrap.className = "front-cues"; field.appendChild(wrap); }
    const left = [], right = [];
    c._fronts.forEach((f, idx) => {
      const focus = f.at + 0.5;
      const offL = focus < cam + 0.5, offR = focus > cam + V - 0.5;
      if (!offL && !offR) return;
      const ally = f.allyKey === "player" ? c.player
        : (c.sides ? c.sides[+(f.allyKey.split(":")[1] || 0)] : null);
      const live = f.enemyIdxs.filter(ei => c.enemies[ei] && c.enemies[ei].alive).length;
      const cleared = live === 0;
      const down = ally && ally.hp != null && ally.hp <= 0;
      const hp = ally && ally.hpMax ? Math.max(0, Math.round(ally.hp / ally.hpMax * 100)) : 0;
      const nm = f.name || (ally ? ally.name : "战线");
      const side = offL ? "left" : "right";
      const body = cleared ? `${nm} 已清` : down ? `${nm} 告急` : `${nm} ${hp}%`;
      const txt = side === "left" ? "◀ " + body : body + " ▶";
      const cls = ["front-cue", (!cleared && !down && hp <= 35) || down ? "danger" : "", cleared ? "cleared" : ""].join(" ");
      (side === "left" ? left : right).push(
        `<button class="${cls}" onclick="UI.peekFront(${idx})">${txt}</button>`);
    });
    wrap.innerHTML = (left.length ? `<div class="fc-col left">${left.join("")}</div>` : "")
      + (right.length ? `<div class="fc-col right">${right.join("")}</div>` : "");
  },
  // 点徽标巡场：镜头巡到该战区我方锚点（我方已倒则看本区尚存之敌）——纯切镜，不耗回合
  peekFront(idx) {
    const c = Engine && Engine._combat;
    if (!c || !c._fronts || !c._fronts[idx]) return;
    const f = c._fronts[idx];
    const ally = f.allyKey === "player" ? c.player
      : (c.sides ? c.sides[+(f.allyKey.split(":")[1] || 0)] : null);
    if (ally && ally.hp > 0) { this._camPeek(c, f.allyKey); return; }
    const le = f.enemyIdxs.find(ei => c.enemies[ei] && c.enemies[ei].alive);
    if (le != null) this._camPeek(c, "enemy:" + le);
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
        <button class="cer-share" onclick="UI.breakthroughShareCard('${realm.name}', ${wasBig ? "true" : "false"})">留影 · 破境帖 📜</button>
        ${hidden > 0 ? `<div class="cer-note">藏拙：示人境界不变，他人小觑于你——关键一战亮出真修为，方有雷霆之势。</div>` : ""}
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

  /* -------- 破境帖（L4 传播素材·分享卡二号）：突破是最强截图时刻——canvas 水墨帖，长按即存 --------
   * 与道途名帖同一画风族（宣纸底/墨金字/朱印），构图更"炸"：巨字境界名+雷金描边。 */
  breakthroughShareCard(realmName, wasBig) {
    const s = State.data;
    if (!s) return;
    const W = 750, H = 1000;
    const cv = document.createElement("canvas");
    cv.width = W; cv.height = H;
    const g = cv.getContext("2d");
    const FONT = '"Kaiti SC","STKaiti","KaiTi","Noto Serif SC",serif';
    // 玄墨底（与名帖米色相区分：破境=夜空惊雷的黑金）
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#1a150d"); bg.addColorStop(0.5, "#14100a"); bg.addColorStop(1, "#0c0906");
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    const glow = g.createRadialGradient(W / 2, H * 0.42, 40, W / 2, H * 0.42, H * 0.55);
    glow.addColorStop(0, "rgba(212,175,106,.22)"); glow.addColorStop(1, "rgba(212,175,106,0)");
    g.fillStyle = glow; g.fillRect(0, 0, W, H);
    g.strokeStyle = "rgba(201,169,106,.55)"; g.lineWidth = 3; g.strokeRect(26, 26, W - 52, H - 52);
    g.strokeStyle = "rgba(201,169,106,.25)"; g.lineWidth = 1; g.strokeRect(40, 40, W - 80, H - 80);
    // 题头
    g.textAlign = "center";
    g.fillStyle = "rgba(201,169,106,.75)"; g.font = `26px ${FONT}`;
    g.fillText("凡 人 修 仙 传 · 人 界 篇", W / 2, 104);
    g.fillStyle = "#e8d9b8"; g.font = `bold 58px ${FONT}`;
    g.fillText(wasBig ? "破 境" : "突 破", W / 2, 196);
    // 巨字境界名（金芒描边）
    g.font = `bold 120px ${FONT}`;
    g.shadowColor = "rgba(240,200,120,.55)"; g.shadowBlur = 34;
    g.fillStyle = "#f0dfae";
    g.fillText(realmName, W / 2, H * 0.46);
    g.shadowBlur = 0;
    // 铭句
    g.fillStyle = "rgba(220,200,160,.85)"; g.font = `28px ${FONT}`;
    g.fillText(wasBig ? "旧日瓶颈，訇然中开" : "灵力冲开窍穴，眼底神光更盛", W / 2, H * 0.56);
    // 落款
    g.fillStyle = "rgba(201,169,106,.8)"; g.font = `30px ${FONT}`;
    g.fillText(`${s.name || "韩立"} · ${s.age || "?"} 岁`, W / 2, H - 208);
    g.fillStyle = "rgba(160,135,90,.75)"; g.font = `24px ${FONT}`;
    g.fillText(`第 ${s.year || 1} 年 ${s.month || 1} 月`, W / 2, H - 164);
    // 朱印
    const sx = W - 168, sy = H - 150, sw = 88;
    g.fillStyle = "rgba(172,44,32,.9)"; g.fillRect(sx, sy, sw, sw);
    g.fillStyle = "#f3e4d0"; g.font = `bold 36px ${FONT}`;
    const nm = (s.name || "韩立");
    g.fillText(nm[0] || "韩", sx + sw / 2, sy + 40);
    g.fillText(nm[1] || "立", sx + sw / 2, sy + 76);
    const url = cv.toDataURL("image/png");
    this.openModal(`
      <h2>破境帖 · 留影</h2>
      <p style="color:var(--ink-dim);font-size:12px">长按图片保存——这一步，值得被记住。</p>
      <img src="${url}" alt="破境帖" style="width:100%;border-radius:8px;border:1px solid var(--border)">
      <div class="modal-actions">
        <a class="btn btn-secondary" href="${url}" download="pojing-tie.png">保存图片</a>
        <button class="btn btn-ghost" onclick="UI.closeModal()">回到大典</button>
      </div>
    `);
  },

  /* -------- 突破受挫：与大典同一演出语言（失败也要被"看见"——账目+保底进度，败有所得）-------- */
  breakthroughSetback(r) {
    let ov = this.el("ceremony-overlay");
    if (!ov) {
      ov = document.createElement("div");
      ov.id = "ceremony-overlay";
      ov.className = "ceremony-overlay";
      document.body.appendChild(ov);
    }
    const rows = [
      `· 修为 -${r.loss}`,
      `· 气血 -${r.dmg}`,
      `· 心魔 +${r.demonGain}（滋长）`,
      ...(r.pity ? [`· 屡败弥坚：连败 ${r.pity} 次，下次冲关成功率 +${r.pity * 2}%`] : []),
    ];
    ov.innerHTML = `
      <div class="cer-inner cer-fail">
        <div class="cer-title">受 挫</div>
        <div class="cer-realm" style="color:var(--red)">${r.big ? "渡劫失利" : "冲关失利"}</div>
        <div class="cer-text">${r.big
          ? "劫云散去，你僵坐原地，口鼻溢血——这一步，终究还是差了半口气。但你还活着，活着就还有下一次。"
          : "灵力行至关窍处轰然溃散，你闷哼一声跌坐在地。道途千折，摔的每一跤都作数。"}</div>
        <div class="cer-gains">${rows.map(g => `<div class="cer-gain">${g}</div>`).join("")}</div>
        <div class="cer-actions">
          <button class="btn btn-secondary" onclick="UI._setbackEnd()">拂袖起身，从头再来</button>
        </div>
        <div class="cer-note">失败在攒成功：修满火候、调息压心魔、灵力充盈时再冲，把成功率经营上去。</div>
      </div>`;
    ov.classList.add("show");
  },
  _setbackEnd() {
    const ov = this.el("ceremony-overlay");
    if (ov) ov.classList.remove("show");
    this.renderAll();
  },

  /* -------- 系统菜单（手机端 ☰ 收纳全部系统入口）-------- */
  openSystemMenu() {
    const soundOn = (typeof Sfx !== "undefined") && Sfx.enabled();
    this.openModal(`
      <h2>系统</h2>
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick="UI.closeModal(); UI.openCodex()">人物图鉴</button>
        <button class="btn btn-secondary" onclick="UI.closeModal(); UI.openBigitems()">大件图鉴</button>
        <button class="btn btn-secondary" onclick="UI.closeModal(); UI.openRumors()">传闻图鉴</button>
        <button class="btn btn-secondary" onclick="UI.closeModal(); UI.openChronicle()">风云录</button>
        <button class="btn btn-secondary" onclick="UI.closeModal(); UI.openTechniques()">功法 · 配装</button>
        <button class="btn btn-secondary" onclick="UI.closeModal(); UI.openTreasury()">法宝 · 装备位</button>
        <button class="btn btn-secondary" onclick="UI.closeModal(); UI.openLLMSettings()">活世界（实时对谈）</button>
        <button class="btn btn-secondary" onclick="UI.closeModal(); UI.openExpSettings()">体验设置（演出·动效·震动）</button>
        <button class="btn btn-secondary" onclick="if(typeof Sfx!=='undefined'){Sfx.toggle();} UI.openSystemMenu();">音效：${soundOn ? "开" : "关"}（点击切换）</button>
        <button class="btn btn-secondary" onclick="UI.closeModal(); State.save() ? UI.toast('已存档') : UI.toast('存档失败', true)">存档</button>
        <button class="btn btn-ghost" onclick="UI.closeModal(); Main.toCreate()">回主菜单</button>
        <button class="btn btn-ghost" onclick="UI.closeModal()">返回</button>
      </div>
    `);
  },

  /* -------- §9 体验设置（演出速度 / 动效强度 / 震动）-------- */
  openExpSettings() {
    if (typeof Settings === "undefined") { this.openSystemMenu(); return; }
    const seg = (label, val, cur, call) =>
      `<button class="set-opt${val === cur ? " on" : ""}" onclick="${call}">${label}</button>`;
    const spd = Settings.speed();
    const mot = Settings.motion();
    const hap = Settings.haptics();
    const hapSupported = Settings.hapticsSupported();
    const sysReduced = Settings.prefersReduced();
    this.openModal(`
      <h2>体验设置</h2>
      <div class="settings">
        <div class="set-row">
          <div class="set-label">演出速度<span class="set-hint">台词逐字 / 镜头 / 停顿的快慢</span></div>
          <div class="set-opts">
            ${[0,1,2,3].map(i => seg(Settings.speedLabel(i), i, spd, `Settings.setSpeed(${i}); UI.openExpSettings()`)).join("")}
          </div>
        </div>
        <div class="set-row">
          <div class="set-label">动效强度<span class="set-hint">震屏 / 顿帧 / 常驻氛围粒${sysReduced ? "　·　系统已开启“减少动效”" : ""}</span></div>
          <div class="set-opts">
            ${seg("满", "full", mot, "Settings.setMotion('full'); UI.openExpSettings()")}
            ${seg("简", "lite", mot, "Settings.setMotion('lite'); UI.openExpSettings()")}
            ${seg("关", "off", mot, "Settings.setMotion('off'); UI.openExpSettings()")}
          </div>
        </div>
        <div class="set-row">
          <div class="set-label">震动反馈<span class="set-hint">${hapSupported ? "重击 / 突破 / 古钟 的手机轻震" : "本设备不支持振动"}</span></div>
          <div class="set-opts">
            ${seg("开", true, hapSupported ? hap : null, "Settings.setHaptics(true); UI.openExpSettings()")}
            ${seg("关", false, hapSupported ? hap : null, "Settings.setHaptics(false); UI.openExpSettings()")}
          </div>
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn btn-ghost" onclick="UI.closeModal(); UI.openSystemMenu()">返回系统</button>
        <button class="btn btn-secondary" onclick="UI.closeModal()">完成</button>
      </div>
    `);
  },

  /* -------- 韩立 · 立绘换装窗口（v213 三级换装·手动层）-------- */
  openHanliSkin() {
    if (typeof Art === "undefined" || !Art.heroSkinsUnlocked) return;
    const skins = Art.heroSkinsUnlocked();
    const cur = (State.data && State.data.heroSkin) || null;   // 手动选定（null=跟随境界）
    const showing = Art.heroId();                              // 当前实际显示的 id
    const card = (id, name, picHtml) => {
      const selected = (cur ? id === cur : id === "__auto__");
      const cls = "skin-card" + (selected ? " selected" : "") + (id === "__auto__" ? " skin-auto" : "");
      const badge = (id !== "__auto__" && id === showing) ? `<span class="skin-cur">显示中</span>` : "";
      const arg = (id === "__auto__") ? "" : id;
      return `<div class="${cls}" onclick="UI._pickHanliSkin('${arg}')">
        <div class="skin-pic">${picHtml}${badge}</div>
        <div class="skin-name">${name}</div>
      </div>`;
    };
    const autoCard = card("__auto__", "跟随境界", "⚜️");
    const cards = skins.map(s => {
      const url = Art.url(s.id);
      const pic = url ? `<img src="${url}" alt="${s.name}" />` : "🧙";
      return card(s.id, s.name, pic);
    }).join("");
    this.openModal(`
      <h2>韩立 · 立绘换装</h2>
      <p style="color:var(--ink-dim);font-size:12px">随修为境界自动更替造型，亦可在此手动选定。剧情关键场景会临时强制对应造型，不影响此处选择。</p>
      <div class="skin-grid">${autoCard}${cards}</div>
      <div class="modal-actions"><button class="btn btn-ghost" onclick="UI.closeModal()">返回</button></div>
    `, "skin");
  },
  _pickHanliSkin(id) {
    if (!State.data) return;
    State.data.heroSkin = id || null;   // 空串=恢复跟随境界
    if (typeof State.save === "function") State.save();
    this.renderTopbar();
    this.openHanliSkin();               // 重开刷新选中态
    if (typeof Art !== "undefined") this.toast(id ? ("已换上 · " + Art.skinName(id)) : "已恢复 · 跟随境界");
  },

  /* -------- 通用弹窗 / Toast -------- */
  openModal(html, variant) {
    const m = this.el("modal");
    m.innerHTML = html;
    m.className = "modal" + (variant ? " modal-" + variant : "");
    const ov = this.el("modal-overlay");
    if (ov.hidden && typeof Sfx !== "undefined") Sfx.play("open");   // 绢帛轻展（重复渲染不重响）
    ov.hidden = false;
  },
  closeModal() {
    this._selPref = null;
    const ov = this.el("modal-overlay");
    if (!ov.hidden && typeof Sfx !== "undefined") Sfx.play("close");
    ov.hidden = true;
  },

  /* -------- 底部 sheet（L1b：轻量面板，不遮挡场景/地图） -------- */
  openSheet(html, opts) {
    const s = this.el("bottom-sheet");
    const locked = !!(opts && opts.lock);   // 锁定 sheet（旅途面板等须做出选择的）：无 ×、点遮罩不关
    s.innerHTML = (locked ? "" : `<span class="sheet-close" onclick="UI.closeSheet()">×</span>`) + html;
    const ov = this.el("sheet-overlay");
    if (ov.hidden && typeof Sfx !== "undefined") Sfx.play("open");   // 绢帛轻展（sheet 内重绘不重响）
    ov.dataset.lock = locked ? "1" : "";
    ov.classList.toggle("sheet-lock", locked);
    ov.hidden = false;
  },
  closeSheet(force) {
    const ov = this.el("sheet-overlay");
    if (!force && ov.dataset.lock === "1") return;
    if (!ov.hidden && typeof Sfx !== "undefined") Sfx.play("close");
    ov.dataset.lock = "";
    ov.classList.remove("sheet-lock");
    ov.hidden = true;
  },

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
function typeLabel(t) { return { pill: "丹药", material: "材料", currency: "通货", skill: "功法", book: "典籍", treasure: "法宝", gear: "法器", consumable: "符器", key: "令物" }[t] || "杂物"; }
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
