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
 *   {shot:"pushIn|pullOut|panLeft|panRight|tiltUp|tiltDown|trackLeft|trackRight|establish|shock|focusLeft|focusRight|reset"}
 *        §8 运镜分镜预设：一行展开为成套 cam 原语；可带 ms/scale/to/px 覆盖（见 SHOTS）。
 *   {actor:id, enter:"left|right", exit:true, emote:"…", name:"展示名"}
 *   {fx:"flash|shake|burst|lightning|ribbon|swordRing|trail|material",
 *        at:"left|right|center", from, to, elem, color, n, ...}
 *   {sfx:"name"}  {bgm:"track"}  {amb:"night|firefly|candle|wind|rain|market" | null}  {wait: ms | "click"}
 *        amb=环境床（夜虫/萤火/烛火/风/雨…）：演出/夜景里它领奏、BGM 自动退位；amb:null=收床。
 *   {beat:{kind:"window|choice", prompt, action, ms, onHit, onMiss, choices}}  ← 交互
 *   {guide:{tag, title, hint, focus, cta}}  ← 演出即引导：切章/切图落幕时顺势告诉玩家"下一步去干嘛"
 *        focus=落幕后高亮的行动 id（在地点屏脉冲一下，指明该点哪个按钮）。
 *
 * 节奏：演出 op（cam/actor/fx/sfx/bgm/amb）是"舞台指令"，自动连演不阻塞，直到撞上
 *   一句台词/场景，或显式 {wait} / 交互 beat 才停下等玩家。可随时跳过（Cutscene.clear()）。
 * ============================================================ */
(function (root) {
  "use strict";

  // 自动连演（非阻塞）的舞台指令键；其余原语各自处理
  const PLAY_OPS = ["cam", "actor", "fx", "sfx", "bgm", "amb", "wait"];

  function selfName() {
    try { return (root.State && root.State.data && root.State.data.name) || "韩立"; }
    catch (e) { return "韩立"; }
  }
  const has = (o, k) => o && Object.prototype.hasOwnProperty.call(o, k);

  const Cutscene = {
    _timers: [],

    /* §8 运镜分镜预设库：电影化镜头一行调用（每条＝一串 cam 原语，复用 compile/_cam 差速视差）。
     * 作者写 {shot:"pushIn"} 即可，可加 {ms}/{scale}/{to}/{px} 覆盖。设计：守 ≤400ms? 否——运镜
     * 是"演出时长"非交互延迟，可长（≤1.6s）；但全部走 _dur 受"演出速度"设置缩放、随时可跳。 */
    SHOTS: {
      pushIn:    [{ cam: "zoom", scale: 1.14, ms: 1100 }],                 // 推近（情绪聚拢）
      pullOut:   [{ cam: "zoom", scale: 1.0,  ms: 1100 }],                 // 拉远（释怀/收束）
      panLeft:   [{ cam: "pan",  to: { x: 3 },  ms: 1200 }],               // 摇向左
      panRight:  [{ cam: "pan",  to: { x: -3 }, ms: 1200 }],               // 摇向右
      tiltUp:    [{ cam: "pan",  to: { y: 3 },  ms: 1200 }],               // 上摇（仰望天/高处）
      tiltDown:  [{ cam: "pan",  to: { y: -3 }, ms: 1200 }],               // 下摇
      trackLeft: [{ cam: "pan",  to: { x: 5 },  ms: 1800 }],               // 跟移·左（缓长）
      trackRight:[{ cam: "pan",  to: { x: -5 }, ms: 1800 }],               // 跟移·右（缓长）
      establish: [{ cam: "zoom", scale: 1.0, ms: 200 }, { cam: "zoom", scale: 1.10, ms: 1600 }], // 定场→缓推
      shock:     [{ cam: "zoom", scale: 1.18, ms: 240 }, { cam: "shake", px: 9 }],                // 惊变：猛推+震
      focusLeft: [{ cam: "focus", at: "left" }],                          // 聚左（另一侧压暗）
      focusRight:[{ cam: "focus", at: "right" }],                         // 聚右
      reset:     [{ cam: "pan", to: { x: 0, y: 0 }, ms: 700 }, { cam: "zoom", scale: 1.0, ms: 700 }], // 复位归零
    },

    /* 含演出原语？（决定是否需挂 FX 叠层、走演出调度） */
    hasStaging(stage) {
      const t = (stage && stage.text) || [];
      return t.some(s => s && typeof s === "object" &&
        (PLAY_OPS.some(k => has(s, k)) || (s.beat && typeof s.beat === "object")));
    },

    /* §9-6 名场面回廊：把一段"含演出"的剧情节点登记进可重温列表（纯函数，可无头测试）。
     * 仅收含演出原语且有稳定 id 的节点（纯文字对白不算名场面）；按 id 去重、最近重温/最新见到的置末；
     * 超 cap（默认 60）淘汰最旧。返回新列表（不就地改入参）。meta:{t,cg} 为可选标注。 */
    recordScene(list, stage, meta, cap) {
      const out = Array.isArray(list) ? list.slice() : [];
      if (!stage || !stage.id || !this.hasStaging(stage)) return out;
      const ent = { id: stage.id, title: stage.title || stage.id,
        t: (meta && meta.t) || "", cg: (meta && meta.cg) || stage.cg || "" };
      const i = out.findIndex(e => e && e.id === ent.id);
      if (i >= 0) out.splice(i, 1);
      out.push(ent);
      const max = cap || 60;
      while (out.length > max) out.shift();
      return out;
    },

    /* —— 编译：text[]（混排）→ 统一节拍序列（纯函数，可无头测试）—— */
    compile(stage) {
      const beats = [];
      const segs = (stage && stage.text) || [];
      for (const seg of segs) {
        if (typeof seg === "string") { beats.push({ kind: "narr", text: seg }); continue; }
        if (!seg || typeof seg !== "object") continue;

        // —— §8 运镜分镜预设：{shot:"pushIn|…"} 展开为一串 cam 原语（作者拖一个就用）——
        //    可带 ms/scale/to/px/at 覆盖（仅覆盖该预设本就含有的键，避免给 pan 塞 scale 之类）。
        if (has(seg, "shot")) {
          const arr = this.SHOTS[seg.shot];
          if (arr) for (const raw of arr) {
            const c = Object.assign({}, raw);
            for (const k of ["ms", "scale", "px", "to", "at"]) if (has(seg, k) && has(c, k)) c[k] = seg[k];
            beats.push({ kind: "op", op: "cam", cam: c.cam, to: c.to, at: c.at, ms: c.ms, scale: c.scale, px: c.px });
          }
          continue;
        }

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
        if (has(seg, "amb")) { beats.push({ kind: "op", op: "amb", amb: seg.amb, opts: seg.opts }); continue; }
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
          case "cam":   this._cam(beat, ctx); return beat.ms ? { auto: this._dur(beat.ms) } : null;
          case "actor": this._actor(beat, ctx); return null;
          case "fx":    this._fx(beat.spec, ctx); return null;
          case "sfx":   if (root.Sfx && root.Sfx.play) root.Sfx.play(beat.sfx); return null;
          case "bgm":   if (root.Sfx && root.Sfx.bgm) root.Sfx.bgm(beat.bgm); return null;
          case "amb":   if (root.Sfx && root.Sfx.ambient) { if (beat.amb) root.Sfx.ambient(beat.amb, beat.opts || {}); else if (root.Sfx.ambientStop) root.Sfx.ambientStop(); } return null;
          case "wait":  return (beat.wait === "click") ? null : { auto: this._dur(+beat.wait || 600) };
        }
      } catch (e) {}
      return null;
    },

    /* §9 演出速度：把"演出时长"按设置档缩放（>1 更慢、<1 更快；无 Settings 时 1×）。
     * 镜头 CSS 过渡 ms 与其 auto 续拍用同一缩放值＝视觉收尾与续拍同步，不脱节。 */
    _dur(ms) {
      const n = +ms || 0;
      const S = root.Settings;
      const sc = (S && S.speedScale) ? S.speedScale() : 1;
      return Math.max(0, Math.round(n * sc));
    },

    /* 镜头（沿用箱庭 L3"变换即镜头"：对背景层施 transform；震屏走 FX）。
     * 演出态多平面（B1 演出态差速视差）：中景背景 ctx.bg 全幅位移/推拉，远景气面
     * ctx.far 以更小幅度（FAR_K）同向同步——同一镜头里两平面"差速"，背景移动时远景
     * 在边缘露出＝纵深视差。无 far 层（旧 DOM / 无头测试）时退化为单层，零回归。*/
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
      const ms = beat.ms ? this._dur(beat.ms) : 900;
      this._applyCam(bg, st, 1, ms, 1);                                       // 中景：全幅（与旧版逐字等价）
      if (ctx && ctx.far) this._applyCam(ctx.far, st, this.FAR_K, ms, 1.08);  // 远景：减幅 + 基准放大 1.08
    },
    FAR_K: 0.42,   // 远景差速系数：位移/推拉幅度取背景的 ~42%，差出来的那截＝视差
    /* 对一层施"镜头变换"：位移取 camState×k，推拉幅度也按 k 收敛（远景动得更少）。
     * base=该层基准缩放（远景 1.08，使其略大、pan 时不露黑边且永远盖住背景边缘）。*/
    _applyCam(el, st, k, ms, base) {
      if (!el) return;
      const b = base || 1;
      const tx = (st.x * k).toFixed(3), ty = (st.y * k).toFixed(3);
      const sc = (b * (1 + (st.s - 1) * k)).toFixed(4);
      el.style.transition = `transform ${ms || 900}ms ease`;
      el.style.transform = `translate(${tx}%, ${ty}%) scale(${sc})`;
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
      const far = ctx && ctx.far;   // 远景面回零（清 inline transform，回落 CSS 基准 scale(1.08)）
      if (far) { far.style.transition = ""; far.style.transform = ""; }
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
        box.innerHTML = `<div class="pb"><img src="${url}" alt="${beat.name || id}" /></div>`;  // .pb＝idle 呼吸层（§9-2）
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
      // B2 常驻氛围粒：{fx:"ambient", preset:"ash|dust|spirit|beam", ...} / preset:"off" 收
      if (kind === "ambient") { if (FX.ambient) FX.ambient(spec.preset || "dust", spec); return; }
      // B3 hit-stop 顿帧：{fx:"hitStop", ms:80}（决定性一击专用；常配合先一记 {fx:"shake"}）
      if (kind === "hitStop" || kind === "hitstop") { if (FX.hitStop) FX.hitStop(spec.ms || 80); return; }
      // §9-3 手机触觉反馈：{fx:"haptic", pattern:"bell|heavy|breakthrough|hit|tap"}（名场面/古钟点用）
      if (kind === "haptic") { if (FX.haptic) FX.haptic(spec.pattern || "hit"); return; }
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
        // B3：决定性一击的顿帧——onHit:{hitStop:true|ms}（配合 fx/shake，画面"咔"地定住一瞬）
        if (c.hitStop && root.Fx && root.Fx.hitStop) root.Fx.hitStop(c.hitStop === true ? 80 : c.hitStop);
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
