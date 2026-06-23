/* ============================================================
 * stage.js — 箱庭舞台运行器（Stage Runtime）
 *
 * 设计（docs/stage-scene-design.md）：
 *  - 复用 L3 轴渲染管线（ui.js _renderExmapScene 同款 CSS/DOM 结构）
 *  - 在 cutscene 编译出的 beats 中，kind:"stage" 由本模块接管执行
 *  - 脚本原语：move/say/narr/fx/sfx/bgm/amb/wait/chase/flee/spawn/despawn/
 *    place/take/freeMove/choice/cgOut/combat
 *  - 非阻塞原语（move/fx/sfx/bgm/amb/cam/shot/wait(ms)）自动连演；
 *    阻塞原语（say/narr/choice/wait("click")/freeMove/chase/flee）等玩家或计时
 *  - cgOut → 退出舞台回 story overlay；combat → 坠入战斗（可继承轴位置）
 *
 * 依赖：Cutscene（计时器/特效/声效）、Art（立绘/背景）、Sfx（音效）、Fx（特效）
 * ============================================================ */
(function (root) {
  "use strict";

  const has = (o, k) => o && Object.prototype.hasOwnProperty.call(o, k);

  // 非阻塞原语（自动连演）
  const AUTO_OPS = ["move", "fx", "sfx", "bgm", "amb", "cam", "shot", "spawn", "despawn", "place", "take"];

  const Stage = {
    _state: null,
    _scriptIdx: 0,
    _timer: null,
    _onDone: null,
    _ctx: null,

    /* 初始化舞台状态 */
    init(config) {
      const units = {};
      (config.units || []).forEach(u => {
        units[u.id] = { id: u.id, art: u.art, pos: u.pos, name: u.name || u.id, face: u.face || "r", flipped: false };
      });
      this._state = {
        bg: config.bg || null,
        pano: config.pano || config.bg || null,
        W: config.W || 15,
        units,
        hotspots: (config.hotspots || []).map(h => Object.assign({ taken: false }, h)),
        preps: config.preps ? Object.assign({}, config.preps) : {},
        cam: { x: 0, s: 1 },
        script: config.script || [],
        freeMove: false,
      };
      this._scriptIdx = 0;
      this._onDone = null;
      this._freeMoveResolve = null;
    },

    /* 获取当前状态快照（供 combat 继承用） */
    snapshot() {
      if (!this._state) return null;
      const s = this._state;
      const units = Object.values(s.units).map(u => ({ id: u.id, art: u.art, pos: u.pos, name: u.name, face: u.face }));
      return { W: s.W, units, hotspots: s.hotspots.filter(h => !h.taken), preps: Object.assign({}, s.preps) };
    },

    /* 执行脚本序列 */
    exec(ctx, onDone) {
      this._ctx = ctx;
      this._onDone = onDone;
      this._scriptIdx = 0;
      this._next();
    },

    /* 推进到下一条脚本原语 */
    _next() {
      if (this._timer) { clearTimeout(this._timer); this._timer = null; }
      const s = this._state;
      if (!s) return;
      while (this._scriptIdx < s.script.length) {
        const cmd = s.script[this._scriptIdx];
        this._scriptIdx++;
        const result = this._execCmd(cmd);
        if (result === "block") return;       // 阻塞：等玩家/计时
        if (result && result.auto) {
          this._timer = setTimeout(() => this._next(), result.auto);
          return;
        }
        // 非阻塞：立即续下一条
      }
      // 脚本执行完毕 → 通知 onDone
      if (this._onDone) { const fn = this._onDone; this._onDone = null; fn(); }
    },

    /* 执行单条原语，返回 "block" / {auto:ms} / null(继续) */
    _execCmd(cmd) {
      if (!cmd || typeof cmd !== "object") return null;
      const s = this._state;

      // —— 非阻塞舞台指令 ——
      if (has(cmd, "move")) return this._move(cmd.move, cmd.to, cmd.ms);
      if (has(cmd, "spawn")) return this._spawn(cmd);
      if (has(cmd, "despawn")) return this._despawn(cmd.despawn);
      if (has(cmd, "fx")) return this._fx(cmd);
      if (has(cmd, "sfx")) { if (root.Sfx && root.Sfx.play) root.Sfx.play(cmd.sfx); return null; }
      if (has(cmd, "bgm")) { if (root.Sfx && root.Sfx.bgm) root.Sfx.bgm(cmd.bgm); return null; }
      if (has(cmd, "amb")) { if (root.Sfx && root.Sfx.ambient) { if (cmd.amb) root.Sfx.ambient(cmd.amb, cmd.opts || {}); else if (root.Sfx.ambientStop) root.Sfx.ambientStop(); } return null; }
      if (has(cmd, "cam")) return this._cam(cmd);
      if (has(cmd, "shot")) return this._shot(cmd);
      if (has(cmd, "wait")) return (cmd.wait === "click") ? "block" : { auto: this._dur(cmd.wait || 600) };
      if (has(cmd, "place")) return this._place(cmd);
      if (has(cmd, "take")) return this._take(cmd);

      // —— 阻塞原语 ——
      if (has(cmd, "say")) { this._say(cmd.say, cmd.text, cmd.emo, cmd.tone); return "block"; }
      if (has(cmd, "narr")) { this._narr(cmd.narr); return "block"; }
      if (has(cmd, "choice")) { this._choice(cmd.choice); return "block"; }
      if (has(cmd, "freeMove")) { this._freeMove(cmd); return "block"; }
      if (has(cmd, "chase")) { this._chase(cmd); return "block"; }
      if (has(cmd, "flee")) { this._flee(cmd); return "block"; }

      // —— 终止拍 ——
      if (has(cmd, "cgOut")) { this._cgOut(); return "block"; }
      if (has(cmd, "combat")) { this._combat(cmd.combat, cmd.inheritPos); return "block"; }

      return null;
    },

    _dur(ms) {
      const n = +ms || 0;
      const S = root.Settings;
      const sc = (S && S.speedScale) ? S.speedScale() : 1;
      return Math.max(0, Math.round(n * sc));
    },

    /* —— 单位移动 —— */
    _move(id, to, ms) {
      const u = this._state.units[id];
      if (!u) return null;
      u.pos = Math.max(0, Math.min(this._state.W - 1, to));
      // 朝向：移动方向决定面朝
      const target = this._state.units[id];
      if (to > u.pos) target.face = "r";
      else if (to < u.pos) target.face = "l";
      this._renderUnits();
      const dur = this._dur(ms || 1000);
      return { auto: dur };
    },

    /* —— 单位登场 —— */
    _spawn(cmd) {
      const id = cmd.spawn;
      if (this._state.units[id]) return null;
      this._state.units[id] = {
        id, art: cmd.art, pos: cmd.pos || 0,
        name: cmd.name || id, face: cmd.face || "l", flipped: false,
      };
      this._renderUnits();
      return null;
    },

    /* —— 单位退场 —— */
    _despawn(id) {
      delete this._state.units[id];
      this._renderUnits();
      return null;
    },

    /* —— 布置 —— */
    _place(cmd) {
      const u = this._state.units[cmd.place];
      if (u && cmd.at != null) {
        this._state.preps[cmd.prep || ("prep_" + cmd.at)] = cmd.at;
        this._renderLane();
      }
      return null;
    },

    /* —— 拾取 —— */
    _take(cmd) {
      const h = this._state.hotspots.find(h => h.id === cmd.take);
      if (h) h.taken = true;
      this._renderLane();
      return null;
    },

    /* —— 特效 —— */
    _fx(cmd) {
      if (!root.Fx || !this._ctx) return null;
      const host = this._ctx.stageEl;
      if (host) root.Fx.ensure(host);
      const kind = cmd.fx;
      const pos = cmd.at != null ? cmd.at : (cmd.atPos != null ? cmd.atPos : 0);
      // 把轴格位转为像素坐标
      const px = this._posToPx(pos);
      const py = this._ctx.stageEl ? this._ctx.stageEl.clientHeight * 0.5 : 200;
      const elem = cmd.elem || "none";
      if (kind === "flash") { root.Fx.flash(cmd.color || "#fff", cmd.ms || 160, cmd.alpha != null ? cmd.alpha : 0.5); return null; }
      if (kind === "shake") { root.Fx.shake(cmd.px || 8); return null; }
      if (kind === "burst" && px) { root.Fx.burst(px.x, px.y, elem, cmd.n || 16, cmd); return null; }
      if (kind === "lightning" && px) { root.Fx.lightning(px.x, px.y, cmd); return null; }
      return null;
    },

    /* —— 镜头 —— */
    _cam(cmd) {
      // 复用 cutscene 的 cam 逻辑，但作用在 stage 背景上
      const bg = this._ctx && this._ctx.bgEl;
      if (!bg) return null;
      const cam = cmd.cam || "hold";
      if (cam === "shake") { if (root.Fx && this._ctx.stageEl) { root.Fx.ensure(this._ctx.stageEl); root.Fx.shake(cmd.px || 8); } return null; }
      if (cam === "hold") return null;
      const st = this._camState || (this._camState = { x: 0, y: 0, s: 1 });
      if (cam === "pan" && cmd.to) { st.x = +cmd.to.x || 0; st.y = +cmd.to.y || 0; }
      if (cam === "zoom") { st.s = cmd.scale != null ? +cmd.scale : 1.12; }
      const ms = cmd.ms ? this._dur(cmd.ms) : 900;
      bg.style.transition = `transform ${ms}ms ease`;
      bg.style.transform = `translate(${(st.x).toFixed(3)}%, ${(st.y).toFixed(3)}%) scale(${st.s.toFixed(4)})`;
      return { auto: ms };
    },

    _shot(cmd) {
      const shots = (root.Cutscene && root.Cutscene.SHOTS) || {};
      const arr = shots[cmd.shot];
      if (!arr) return null;
      let lastAuto = 0;
      for (const raw of arr) {
        const c = Object.assign({}, raw);
        for (const k of ["ms", "scale", "px", "to", "at"]) if (has(cmd, k) && has(c, k)) c[k] = cmd[k];
        const r = this._cam(c);
        if (r && r.auto) lastAuto = Math.max(lastAuto, r.auto);
      }
      return lastAuto ? { auto: lastAuto } : null;
    },

    /* —— 对话气泡（阻塞）—— */
    _say(id, text, emo, tone) {
      const u = this._state.units[id];
      if (!u || !this._ctx) return;
      // 渲染气泡到 stage overlay
      this._renderBubble(u, text, emo, tone);
      // 暗淡非说话者
      this._dimExcept(id);
    },

    /* —— 旁白字幕（阻塞）—— */
    _narr(text) {
      if (this._ctx && this._ctx.noteEl) {
        this._ctx.noteEl.innerHTML = `<div class="stage-narr">${text}</div>`;
        this._ctx.noteEl.classList.add("on");
      }
    },

    /* —— 抉择（阻塞）—— */
    _choice(spec) {
      if (!this._ctx || !this._ctx.choiceEl) return;
      const el = this._ctx.choiceEl;
      el.innerHTML = `<div class="stage-choice-prompt">${spec.prompt || ""}</div>` +
        (spec.choices || []).map((c, i) => `<button class="choice stage-choice" data-i="${i}">${c.text || c}</button>`).join("");
      el.classList.add("on");
      el.querySelectorAll(".stage-choice").forEach(btn => {
        btn.onclick = () => {
          const i = +btn.dataset.i;
          const c = (spec.choices || [])[i] || {};
          el.innerHTML = ""; el.classList.remove("on");
          if (c.effect && typeof c.effect === "function") c.effect(this._state);
          this._next();
        };
      });
    },

    /* —— 自由行走（阻塞，等玩家走到触发区）—— */
    _freeMove(cmd) {
      this._state.freeMove = true;
      this._freeMoveTrigger = cmd.trigger;
      if (this._ctx && this._ctx.noteEl) {
        this._ctx.noteEl.innerHTML = `<div class="stage-hint">${cmd.hint || "点击格子移动"}</div>`;
        this._ctx.noteEl.classList.add("on");
      }
      // 渲染可走格子
      this._renderLane(true);
    },

    /* 玩家在自由行走模式下点击了格子 */
    freeMoveClick(pos) {
      if (!this._state || !this._state.freeMove) return;
      const hero = this._state.units["hanli"];
      if (!hero) return;
      hero.pos = pos;
      if (pos > hero.pos) hero.face = "r"; else hero.face = "l";
      this._renderUnits();
      this._renderLane(true);
      // 检查触发区
      const trig = this._freeMoveTrigger;
      if (!trig) return;
      if (trig.pos != null) {
        const r = trig.radius || 1;
        if (Math.abs(hero.pos - trig.pos) <= r) { this._endFreeMove(); return; }
      }
      if (trig.npc) {
        const target = this._state.units[trig.npc];
        if (target) {
          const r = trig.radius || 2;
          if (Math.abs(hero.pos - target.pos) <= r) { this._endFreeMove(); return; }
        }
      }
    },

    _endFreeMove() {
      this._state.freeMove = false;
      this._freeMoveTrigger = null;
      if (this._ctx && this._ctx.noteEl) { this._ctx.noteEl.classList.remove("on"); this._ctx.noteEl.innerHTML = ""; }
      this._renderLane(false);
      this._next();
    },

    /* —— 追逐（阻塞）—— */
    _chase(cmd) {
      const chaser = this._state.units[cmd.chase];
      const target = this._state.units[cmd.target];
      if (!chaser || !target) { this._next(); return; }
      const speed = cmd.speed || 1.5;
      const onCatch = cmd.onCatch;
      const tick = 800;
      const step = () => {
        if (!this._state) return;
        const diff = target.pos - chaser.pos;
        if (Math.abs(diff) <= 1) {
          // 追上
          if (onCatch) {
            if (onCatch.combat) { this._combat(onCatch.combat, onCatch.inheritPos); return; }
            if (onCatch.say) { this._say(onCatch.say, onCatch.text || "", onCatch.emo, onCatch.tone); this._afterClick(() => this._next()); return; }
            if (onCatch.fx) { this._fx(onCatch); }
          }
          this._next();
          return;
        }
        chaser.pos += (diff > 0 ? 1 : -1) * Math.max(1, Math.round(speed));
        chaser.face = diff > 0 ? "r" : "l";
        this._renderUnits();
        this._timer = setTimeout(step, tick);
      };
      step();
    },

    /* —— 逃跑（阻塞）—— */
    _flee(cmd) {
      const runner = this._state.units[cmd.flee];
      const pursuer = this._state.units[cmd.from];
      if (!runner) { this._next(); return; }
      const toPos = cmd.to;
      const ms = cmd.ms || 3000;
      const tick = 600;
      const runnerSpeed = Math.max(1, Math.round(Math.abs(toPos - runner.pos) / (ms / tick)));
      const onCaught = cmd.onCaught;
      const onEscape = cmd.onEscape;
      const step = () => {
        if (!this._state) return;
        // 逃跑者移动
        const rDiff = toPos - runner.pos;
        if (Math.abs(rDiff) <= 1) {
          // 成功逃跑
          if (onEscape) {
            if (onEscape.say) { this._say(onEscape.say, onEscape.text || "", onEscape.emo, onEscape.tone); this._afterClick(() => this._next()); return; }
          }
          this._next();
          return;
        }
        runner.pos += (rDiff > 0 ? 1 : -1) * runnerSpeed;
        runner.face = rDiff > 0 ? "r" : "l";
        // 追击者移动（略快）
        if (pursuer) {
          const pDiff = runner.pos - pursuer.pos;
          if (Math.abs(pDiff) <= 1) {
            // 被追上
            if (onCaught) {
              if (onCaught.combat) { this._combat(onCaught.combat, onCaught.inheritPos); return; }
              if (onCaught.say) { this._say(onCaught.say, onCaught.text || "", onCaught.emo, onCaught.tone); this._afterClick(() => this._next()); return; }
            }
            this._next();
            return;
          }
          pursuer.pos += (pDiff > 0 ? 1 : -1) * (runnerSpeed + 1);
          pursuer.face = pDiff > 0 ? "r" : "l";
        }
        this._renderUnits();
        this._timer = setTimeout(step, tick);
      };
      step();
    },

    /* —— 退出舞台（cgOut）—— */
    _cgOut() {
      if (this._ctx && this._ctx.onCgOut) this._ctx.onCgOut();
    },

    /* —— 坠入战斗 —— */
    _combat(fightId, inheritPos) {
      const snap = inheritPos ? this.snapshot() : null;
      if (this._ctx && this._ctx.onCombat) this._ctx.onCombat(fightId, snap);
    },

    /* —— 渲染辅助（由 ui.js 调用）—— */

    // 格位→像素坐标
    _posToPx(pos) {
      if (!this._ctx || !this._ctx.stageEl) return null;
      const el = this._ctx.stageEl;
      const w = el.clientWidth;
      const h = el.clientHeight;
      const W = this._state.W;
      const V = 12; // 视口格数
      const cam = (typeof this._state._cam === "number") ? this._state._cam : 0;
      const x = ((pos + 0.5 - cam) / V) * w;
      const y = h * 0.55;
      return { x, y };
    },

    _renderUnits() { if (this._ctx && this._ctx.renderUnits) this._ctx.renderUnits(this._state); },
    _renderLane(freeMove) { if (this._ctx && this._ctx.renderLane) this._ctx.renderLane(this._state, freeMove); },
    _renderBubble(unit, text, emo, tone) { if (this._ctx && this._ctx.renderBubble) this._ctx.renderBubble(unit, text, emo, tone, this._state); },
    _dimExcept(id) { if (this._ctx && this._ctx.dimExcept) this._ctx.dimExcept(id, this._state); },

    _afterClick(fn) {
      // 在 say 阻塞后，等玩家轻触继续
      this._pendingClick = fn;
    },

    /* 玩家轻触继续（由 ui.js 调用） */
    advance() {
      if (this._pendingClick) {
        const fn = this._pendingClick;
        this._pendingClick = null;
        // 清除气泡
        if (this._ctx && this._ctx.bubbleEl) { this._ctx.bubbleEl.innerHTML = ""; this._ctx.bubbleEl.classList.remove("on"); }
        if (this._ctx && this._ctx.noteEl) { this._ctx.noteEl.classList.remove("on"); }
        // 取消暗淡
        if (this._ctx && this._ctx.undimAll) this._ctx.undimAll(this._state);
        fn();
        return;
      }
      // 自由行走模式下轻触不做特殊处理（靠格子点击）
    },

    /* 跳过整个舞台 */
    skip() {
      if (this._timer) { clearTimeout(this._timer); this._timer = null; }
      this._pendingClick = null;
      this._state = null;
      this._scriptIdx = 0;
    },

    /* 清理 */
    destroy() {
      if (this._timer) { clearTimeout(this._timer); this._timer = null; }
      this._state = null;
      this._scriptIdx = 0;
      this._onDone = null;
      this._ctx = null;
      this._pendingClick = null;
      this._freeMoveTrigger = null;
      this._camState = null;
    },
  };

  root.Stage = Stage;
  if (typeof module !== "undefined" && module.exports) module.exports = Stage;

})(typeof window !== "undefined" ? window : globalThis);
