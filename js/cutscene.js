/* ============================================================
 * cutscene.js — 演出推进器（周期七·阶段1 演出地基）
 *
 * 设计（docs/cutscene-design.md）：
 *  - 不另起炉灶：特效委托 FX、声委托 audio(Sfx)、立绘委托 Art、镜头沿用箱庭 L3 的
 *    "变换即镜头"做法（对背景层施 transform）。本文件只调度，不画一个像素。
 *  - 向后兼容旧剧情卡：字符串=旁白；{scene}/{aside}/{say}/{show}/{narr}/{beat:"…"}
 *    一仍其旧。新增演出原语全部可选、缺省 fail-soft——旧 text:[] 零回归。
 *  - compile() 是纯函数（无 DOM，可无头测试 test/cutscene.test.js）；
 *    run()/runBeat() 触 DOM/FX/audio，仅浏览器，缺依赖即静默。
 *
 * 演出原语（text:[] 里与旧段落混排）：
 *   {cam:"pan|zoom|focus|shake|hold", to:{x,y}, at:"left|right|center", ms, scale, px}
 *   {actor:id, enter:"left|right", exit:true, emote:"…", name:"展示名"}
 *   {fx:"flash|shake|burst|lightning|ribbon|swordRing|trail|material",
 *        at:"left|right|center", from, to, elem, color, n, ...}
 *   {sfx:"name"}  {bgm:"track"}  {wait: ms | "click"}
 *   {beat:{kind:"window|choice", prompt, action, ms, onHit, onMiss, choices}}  ← 交互
 *   {guide:{tag, title, hint, focus, cta}}  ← 演出即引导：切章/切图落幕时顺势告诉玩家"下一步去干嘛"
 *        focus=落幕后高亮的行动 id（在地点屏脉冲一下，指明该点哪个按钮）。
 *
 * 节奏：演出 op（cam/actor/fx/sfx/bgm）是"舞台指令"，自动连演不阻塞，直到撞上
 *   一句台词/场景，或显式 {wait} / 交互 beat 才停下等玩家。可随时跳过（Cutscene.clear()）。
 * ============================================================ */
(function (root) {
  "use strict";

  // 自动连演（非阻塞）的舞台指令键；其余原语各自处理
  const PLAY_OPS = ["cam", "actor", "fx", "sfx", "bgm", "wait"];

  function selfName() {
    try { return (root.State && root.State.data && root.State.data.name) || "韩立"; }
    catch (e) { return "韩立"; }
  }
  const has = (o, k) => o && Object.prototype.hasOwnProperty.call(o, k);

  const Cutscene = {
    _timers: [],

    /* 含演出原语？（决定是否需挂 FX 叠层、走演出调度） */
    hasStaging(stage) {
      const t = (stage && stage.text) || [];
      return t.some(s => s && typeof s === "object" &&
        (PLAY_OPS.some(k => has(s, k)) || (s.beat && typeof s.beat === "object")));
    },

    /* —— 编译：text[]（混排）→ 统一节拍序列（纯函数，可无头测试）—— */
    compile(stage) {
      const beats = [];
      const segs = (stage && stage.text) || [];
      for (const seg of segs) {
        if (typeof seg === "string") { beats.push({ kind: "narr", text: seg }); continue; }
        if (!seg || typeof seg !== "object") continue;

        // —— 演出原语（舞台指令）——
        if (has(seg, "cam")) {
          beats.push({ kind: "op", op: "cam", cam: seg.cam, to: seg.to, at: seg.at, ms: seg.ms, scale: seg.scale, px: seg.px });
          continue;
        }
        if (has(seg, "actor")) {
          beats.push({ kind: "op", op: "actor", actor: seg.actor, enter: seg.enter, exit: seg.exit, emote: seg.emote, name: seg.name });
          continue;
        }
        if (has(seg, "fx"))  { beats.push({ kind: "op", op: "fx", spec: seg }); continue; }
        if (has(seg, "sfx")) { beats.push({ kind: "op", op: "sfx", sfx: seg.sfx }); continue; }
        if (has(seg, "bgm")) { beats.push({ kind: "op", op: "bgm", bgm: seg.bgm }); continue; }
        if (has(seg, "wait")) { beats.push({ kind: "op", op: "wait", wait: seg.wait }); continue; }

        // —— 演出即引导（落幕指路；阻塞，等玩家确认）——
        if (seg.guide && typeof seg.guide === "object") { beats.push({ kind: "guide", guide: seg.guide }); continue; }

        // —— 交互 beat（对象形式；阻塞，等玩家操作）——
        if (seg.beat && typeof seg.beat === "object") { beats.push({ kind: "beat", beat: seg.beat }); continue; }

        // —— 旧剧情卡（向后兼容，逐字打字台词层）——
        if (seg.scene) { beats.push({ kind: "scene", text: seg.scene }); continue; }
        if (seg.aside) { beats.push({ kind: "aside", who: selfName(), text: seg.aside }); continue; }
        if (seg.beat)  { beats.push({ kind: "narr", text: seg.beat || "……" }); continue; }   // 字符串 beat=停顿留白
        if (seg.show)  { beats.push({ kind: "narr", text: seg.text || "", showWho: seg.show }); continue; }
        if (seg.say)   { beats.push({ kind: "say", who: seg.say, text: seg.text, tone: seg.tone, emo: seg.emo }); continue; }
        if (seg.narr)  { beats.push({ kind: "narr", text: seg.narr }); continue; }
      }
      return beats;
    },

    /* 是否阻塞型节拍（需等玩家轻触/操作）：台词层与交互 beat 阻塞；舞台指令不阻塞 */
    isBlocking(beat) {
      if (!beat) return true;
      if (beat.kind === "op") return beat.op === "wait" && beat.wait === "click";
      return true;   // narr/say/aside/scene/beat 都等玩家
    },

    /* —— 运行期：执行一条演出 op（浏览器，fail-soft）——
     * ctx: { bg, left, right, host, fxHost, anchor(at) }
     * 返回 {auto: ms} 表示该 op 自走计时后再续；否则立即续下一拍。 */
    run(beat, ctx) {
      try {
        if (!beat || beat.kind !== "op") return null;
        switch (beat.op) {
          case "cam":   this._cam(beat, ctx); return beat.ms ? { auto: beat.ms } : null;
          case "actor": this._actor(beat, ctx); return null;
          case "fx":    this._fx(beat.spec, ctx); return null;
          case "sfx":   if (root.Sfx && root.Sfx.play) root.Sfx.play(beat.sfx); return null;
          case "bgm":   if (root.Sfx && root.Sfx.bgm) root.Sfx.bgm(beat.bgm); return null;
          case "wait":  return (beat.wait === "click") ? null : { auto: +beat.wait || 600 };
        }
      } catch (e) {}
      return null;
    },

    /* 镜头（沿用箱庭 L3"变换即镜头"：对背景层施 transform；震屏走 FX）*/
    _cam(beat, ctx) {
      const bg = ctx && ctx.bg;
      const cam = beat.cam || "hold";
      if (cam === "shake") { if (root.Fx && ctx && ctx.fxHost) { root.Fx.ensure(ctx.fxHost); root.Fx.shake(beat.px || 8); } return; }
      if (cam === "focus") { this._focus(beat.at, ctx); return; }
      if (cam === "hold") return;
      if (!bg) return;
      const st = this._camState || (this._camState = { x: 0, y: 0, s: 1 });
      if (cam === "pan" && beat.to) { st.x = +beat.to.x || 0; st.y = +beat.to.y || 0; }
      if (cam === "zoom") { st.s = beat.scale != null ? +beat.scale : 1.12; }
      bg.style.transition = `transform ${beat.ms || 900}ms ease`;
      bg.style.transform = `translate(${st.x}%, ${st.y}%) scale(${st.s})`;
    },
    _focus(at, ctx) {
      if (!ctx) return;
      const L = ctx.left, R = ctx.right;
      const lOn = L && L.querySelector("img"), rOn = R && R.querySelector("img");
      if (L) L.classList.toggle("dim", !!lOn && at === "right");
      if (R) R.classList.toggle("dim", !!rOn && at === "left");
    },
    resetCam(ctx) {
      this._camState = { x: 0, y: 0, s: 1 };
      const bg = ctx && ctx.bg;
      if (bg) { bg.style.transition = ""; bg.style.transform = ""; }
    },

    /* 立绘进退场（委托 Art 取图；放进既有左右立绘位）*/
    _actor(beat, ctx) {
      if (!ctx) return;
      const id = beat.actor;
      const self = id === "hanli" || beat.enter === "right";
      const box = self ? ctx.right : ctx.left;
      if (!box) return;
      if (beat.exit) {
        box.classList.remove("on");
        box.classList.add("portrait-out");
        const b = box;
        this._after(360, () => { b.innerHTML = ""; b.classList.remove("portrait-out"); b.dataset.set = ""; });
        return;
      }
      const url = (root.Art && root.Art.url) ? root.Art.url(id, beat.emote) : null;
      if (url) {
        box.innerHTML = `<img src="${url}" alt="${beat.name || id}" />`;
        box.dataset.set = id + (beat.emote || "");
        box.classList.add("on");
        box.classList.remove("dim");
        box.classList.remove("portrait-in"); void box.offsetWidth; box.classList.add("portrait-in");
      } else if (beat.emote) {
        box.classList.remove("emo-pop"); void box.offsetWidth; box.classList.add("emo-pop");
      }
    },

    /* 特效（全部委托 FX；按锚点取场上坐标）*/
    _fx(spec, ctx) {
      const FX = root.Fx;
      if (!FX || !spec) return;
      if (ctx && ctx.fxHost) FX.ensure(ctx.fxHost);
      const kind = spec.fx;
      const A = (at) => (ctx && ctx.anchor) ? ctx.anchor(at) : null;
      const elem = spec.elem || "none";
      if (kind === "flash") { FX.flash(spec.color || "#fff", spec.ms || 160, spec.alpha != null ? spec.alpha : 0.5); return; }
      if (kind === "shake") { FX.shake(spec.px || 8); return; }
      const p = A(spec.at || "center");
      if (kind === "burst")     { if (p) FX.burst(p.x, p.y, elem, spec.n || 16, spec); return; }
      if (kind === "lightning") { if (p) FX.lightning(p.x, p.y, spec); return; }
      if (kind === "material")  { if (p) FX.material(p.x, p.y, elem); return; }
      if (kind === "swordRing") { if (p) FX.swordRing(p.x, p.y, spec); return; }
      if (kind === "ribbon" || kind === "trail") {
        const f = A(spec.from || "right"), t = A(spec.to || "left");
        if (f && t) FX[kind](f, t, spec);
        return;
      }
    },

    /* —— 交互 beat（把"操作"嵌进演出）——
     * done(result): result.hit=是否命中；result.line=可选反应台词；result.idx=choice 序。
     * window: 一个限时动作按钮，窗内点=命中(onHit)，超时=放空(onMiss)。
     * choice: 限信息抉择，点选返回 idx。*/
    runBeat(beat, ctx, done) {
      const spec = (beat && beat.beat) || {};
      const host = ctx && ctx.beatHost;
      if (!host) { if (done) done({ hit: false }); return; }
      const finish = (res) => { this.clear(); host.innerHTML = ""; host.classList.remove("cut-beat-on"); if (done) done(res || {}); };
      host.classList.add("cut-beat-on");

      if (spec.kind === "choice") {
        host.innerHTML = `<div class="cut-prompt">${spec.prompt || ""}</div>` +
          (spec.choices || []).map((c, i) =>
            `<button class="choice cut-choice" data-i="${i}">${c.text || c}</button>`).join("");
        host.querySelectorAll(".cut-choice").forEach(btn => {
          btn.onclick = () => {
            const i = +btn.dataset.i;
            const c = (spec.choices || [])[i] || {};
            this._react(c, ctx);
            finish({ idx: i, line: c.line });
          };
        });
        return;
      }

      // 默认：window（伺机出手）
      const ms = spec.ms || 2200;
      host.innerHTML =
        `<div class="cut-prompt">${spec.prompt || ""}</div>` +
        `<button class="choice cut-strike">${spec.action || "出手"}<span class="cut-gauge"><i></i></span></button>`;
      const gauge = host.querySelector(".cut-gauge i");
      if (gauge) { gauge.style.transition = `width ${ms}ms linear`; void gauge.offsetWidth; gauge.style.width = "0%"; }
      const btn = host.querySelector(".cut-strike");
      if (btn) btn.onclick = () => { const c = spec.onHit || {}; this._react(c, ctx); finish({ hit: true, line: c.line }); };
      this._after(ms, () => { const c = spec.onMiss || {}; this._react(c, ctx); finish({ hit: false, line: c.line }); });
    },

    /* —— 演出即引导：落幕指路卡（切章/切图时顺势告诉玩家"下一步去干嘛"）——
     * 渲染进 beatHost；玩家确认后 done({focus}) 交回 ui，由地点屏脉冲高亮该行动按钮。
     * 内容由剧情卡作者就地写好（单一来源；不与天命栏重复，二者一显眼一常驻、互补）。*/
    runGuide(beat, ctx, done) {
      const g = (beat && beat.guide) || {};
      const host = ctx && ctx.beatHost;
      if (!host) { if (done) done({ focus: g.focus }); return; }
      host.classList.add("cut-beat-on");
      host.innerHTML =
        `<div class="cut-guide">` +
          `<div class="cg-tag">${g.tag || "接下来"}</div>` +
          (g.title ? `<div class="cg-title">${g.title}</div>` : "") +
          (g.hint ? `<div class="cg-hint">${g.hint}</div>` : "") +
          `<button class="choice cut-guide-go">${g.cta || "我知道了"}</button>` +
        `</div>`;
      const btn = host.querySelector(".cut-guide-go");
      if (btn) btn.onclick = () => {
        host.innerHTML = ""; host.classList.remove("cut-beat-on");
        if (done) done({ focus: g.focus });
      };
    },
    // beat 结算时的即时反馈（特效/声）——台词反应由 done(line) 交回 ui 接演
    _react(c, ctx) {
      if (!c) return;
      try {
        if (c.fx && root.Fx) this._fx(typeof c.fx === "string" ? { fx: c.fx, at: "left" } : c.fx, ctx);
        if (c.sfx && root.Sfx && root.Sfx.play) root.Sfx.play(c.sfx);
        if (c.cam) this._cam({ cam: c.cam, px: c.px, at: c.at, ms: c.ms, to: c.to, scale: c.scale }, ctx);
      } catch (e) {}
    },

    /* 计时器登记（统一可清，支持随时跳过/关闭）*/
    _after(ms, fn) {
      const id = root.setTimeout(() => {
        this._timers = this._timers.filter(t => t !== id);
        fn();
      }, ms);
      this._timers.push(id);
      return id;
    },
    clear() {
      this._timers.forEach(id => { try { root.clearTimeout(id); } catch (e) {} });
      this._timers = [];
    },
  };

  root.Cutscene = Cutscene;
  if (typeof module !== "undefined" && module.exports) module.exports = Cutscene;

})(typeof window !== "undefined" ? window : globalThis);
