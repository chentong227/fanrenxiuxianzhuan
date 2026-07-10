/* ============================================================
 * fx.js —— 战斗特效引擎 v2（canvas 叠层，零依赖，分功法配方）
 *
 * 设计原则（docs/fx-design.md）：
 * 1. 招式即指纹：每个功法/法术一张特效配方，按动漫版气质调色——
 *    青元剑芒=青色剑气束；火蛇符=游走的活火蛇；金光砖=鎏金重击；
 *    长春功=木灵绿芒回环；定身符=金箓锁环……不是"换个颜色的同一团粒子"。
 * 2. 手机优先（iPhone 14PM 量级）：辉光用预渲染精灵图（offscreen 一次画好，
 *    drawImage 缩放复用——比每粒子径向渐变快一个量级）；粒子全场预算封顶；
 *    连续两帧 >34ms 自动降档（v111 顺序：先出粒减半，仍卡才把画布 DPR 降到 1.75——
 *    先减粒子是因为填充率第一笔省、且 DPR 降幅收窄到 1.75 可避免"特效比人物糊一层"；
 *    纯过程式辉光对分辨率不敏感，几乎无可见画质损失）；回稳即恢复 DPR=2；无活物时 RAF 即停。
 * 4. 身后/身前双层（v111）：单块 .fx-canvas 永远 z:26 盖在人物上＝光环/护体也"飘在表面"。
 *    拆成 .fx-canvas-back(z:1，画在人物之后)＋.fx-canvas-front(z:26)：护体光环/地面阵纹/
 *    吐纳绿芒进身后层"贴着身后"，命中火花/冲击/剑出袭/天雷留身前层——景深归位。
 * 3. 纯过程式：不吃美术资产、不进存档，纯演出层——逻辑帧无依赖。
 * 5. 柔光泛光（v112）：每帧把特效两层各自降采样到 1/4、再 1/8 的离屏小画布，
 *    用双线性放大叠回（globalCompositeOperation=lighter）——纯 drawImage 缩放近似高斯模糊，
 *    严守"禁 ctx.shadowBlur"红线。只作用于特效层（人物/背景是 DOM，不被它糊）；
 *    身后层的泛光会从人物身后柔柔漫出＝随特效色的"受光"光晕。持续卡顿（连两帧>34ms）
 *    即撤泛光（纯观感层最先降），不与粒子/DPR 抢手机预算，回稳即复原。
 * ============================================================ */
(function () {
  "use strict";

  /* 五行→[核心色, 辉光色] */
  const ELEM_COLOR = {
    huo: ["#ffd9a8", "#ff6a26"], shui: ["#dff0ff", "#4d9bea"], jin: ["#fff6cf", "#e8c04a"],
    mu: ["#dcffe2", "#46c573"], tu: ["#f3e3bc", "#c29748"], lei: ["#f2f8ff", "#86b4ff"],
    // jinlei=辟邪神雷（金色天雷，用户裁决：金色的雷，很帅）
    jinlei: ["#fff3c4", "#ffb01e"],
    none: ["#f3e9d2", "#c8a861"],
  };
  const col = e => ELEM_COLOR[e] || ELEM_COLOR.none;
  const TAU = Math.PI * 2;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = arr => arr[(Math.random() * arr.length) | 0];
  const hexRgb = (h) => {
    const m = /^#?([0-9a-f]{6})$/i.exec(h || "");
    if (!m) return [244, 227, 176];
    const n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };

  /* 辉光精灵图：白色软光斑，按色叠染（globalCompositeOperation lighter 下直接乘色） */
  function makeGlowSprite() {
    const s = document.createElement("canvas");
    s.width = s.height = 64;
    const g = s.getContext("2d");
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.35, "rgba(255,255,255,.55)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    return s;
  }

  const Fx = {
    // _cv/_ctx 恒指"身前层"(z:26)——沿用旧字段名，所有既有 if(!this._ctx) 守卫不动；
    // _cvBack/_ctxBack 是 v111 新增的"身后层"(z:1，画在人物之后)。
    _cv: null, _ctx: null, _cvBack: null, _ctxBack: null, _host: null, _glow: null,
    _parts: [], _bolts: [], _strokes: [], _swords: [], _arcs: [], _raf: 0,
    _budget: 420,           // 粒子全场封顶（手机红线）
    _degraded: 1,           // 降档系数：帧难看时减半出粒
    _dprCap: 2,             // 画布分辨率上限：帧难看时降到 1.75（v111 收窄降幅，回稳复原 2）
    _slowFrames: 0,
    // —— B2 常驻/idle 氛围粒子（§B2）——
    _amb: null,             // 当前氛围配置 {preset, interval, cap, color, alpha, speed} | null=停
    _ambAcc: 0,             // 出粒节拍累加器（按 interval 节流）
    _ambFlag: false,        // _push 期间置位：把该粒子标记为氛围粒（_amb）以便单独计数/收束
    _ambCap: (typeof window !== "undefined" && window.matchMedia &&
      window.matchMedia("(hover: none), (pointer: coarse)").matches) ? 30 : 80,  // 常驻粒上限：手机≤30 / 桌面≤80
    _emitLayer: "front",    // 当前发射层：front=身前(命中/弹道/天雷)，back=身后(光环/护体/地纹)
    _bloom: 1,              // v112 柔光泛光总开关；持续卡顿(连两帧>34ms)置 0，回稳复原
    // v114 设备能力上限：触摸/手机端默认关泛光。实测每帧降采样(_bloomPass 满屏 4 次 drawImage/层×2 层)
    // 是手机每帧主开销——DPR=1 的 VM 上就占帧时 +307%，手机 DPR=2 像素翻番更甚。桌面保持开。
    // 降档回稳时只复原到此上限（见 _run），手机永不把泛光开回来，杜绝临界设备反复开关频闪。
    _bloomCap: (typeof window !== "undefined" && window.matchMedia &&
      window.matchMedia("(hover: none), (pointer: coarse)").matches) ? 0 : 1,
    _bxa: null, _bxb: null, // v112 离屏降采样缓冲（1/4、1/8 尺寸）——双线性放大近似高斯
    // —— B3 hit-stop 顿帧（§B3）——
    _frozenUntil: 0,        // <now 之前都按 dt=0 渲染（画面凝住）；玩家决定性一击专用
    _hsTimer: 0,            // 解冻定时器（撤 .fx-hitstop class）
    // —— §9-3 手机触觉反馈（navigator.vibrate）——
    _haptics: null,         // null=未读；true/false=开关（localStorage 持久，体验设置可翻）
    _HAPTIC: { tap: 10, hit: 16, heavy: [18, 28, 40], breakthrough: [24, 40, 24, 40, 60], bell: [12, 70, 12] },


    /* ---------- 装配 ---------- */
    ensure(host) {
      if (!host) return null;
      this._bloom = this._bloomCap;   // v114：每次进战按设备能力定泛光初值（手机=0，桌面=1）
      if (this._cv && this._host === host && this._cv.isConnected) { this._fit(); return this._ctx; }
      if (this._cvBack && this._cvBack.parentNode) this._cvBack.parentNode.removeChild(this._cvBack);
      if (this._cv && this._cv.parentNode) this._cv.parentNode.removeChild(this._cv);
      this._host = host;
      // 身后层先建（z:1，画在人物之后）——光环/护体/地纹贴着身后，不再浮于表面
      const cb = document.createElement("canvas");
      cb.className = "fx-canvas fx-canvas-back";
      host.appendChild(cb);
      this._cvBack = cb;
      this._ctxBack = cb.getContext("2d");
      // 身前层后建（z:26）——命中火花/冲击/剑出袭/天雷，沿用旧 .fx-canvas 层级
      const cf = document.createElement("canvas");
      cf.className = "fx-canvas fx-canvas-front";
      host.appendChild(cf);
      this._cv = cf;
      this._ctx = cf.getContext("2d");
      if (!this._glow) this._glow = makeGlowSprite();
      this._fit();
      return this._ctx;
    },
    _fit() {
      const r = this._host.getBoundingClientRect();
      const dpr = Math.min(this._dprCap || 2, window.devicePixelRatio || 1);
      this._dpr = dpr;
      const w = Math.round(r.width * dpr), h = Math.round(r.height * dpr);
      for (const cv of [this._cvBack, this._cv]) {
        if (cv && (cv.width !== w || cv.height !== h)) { cv.width = w; cv.height = h; }
      }
      this._w = r.width; this._h = r.height; this._rect = r;
    },
    at(anchor, ry = 0.42) {
      if (!anchor || !this._rect) return null;
      const a = anchor.getBoundingClientRect();
      return { x: a.left + a.width / 2 - this._rect.left, y: a.top + a.height * ry - this._rect.top };
    },

    /* 冷启动预热（开局第一次施法卡 0.x 秒的根治）：开战瞬间就建好画布、
     * 生成辉光精灵图，并空跑一次 drawImage 把它上传成 GPU 纹理，再 clearRect 抹掉——
     * 把"首次施法才触发的纹理上传"提前到开战，玩家无感。零视觉、零存档、无 RAF。 */
    warm(host) {
      try {
        this.ensure(host);
        if (!this._glow) this._glow = makeGlowSprite();
        // v111：两层画布各预热一次——各自是独立 2D 上下文，纹理上传互不共享
        for (const cv of [this._cvBack, this._cv]) {
          if (!cv) continue;
          const ctx = cv.getContext("2d");
          if (!cv.width || !cv.height) { cv.width = 32; cv.height = 32; }
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          ctx.globalAlpha = 0.01;                    // 近乎不可见——即便抢在 clear 前刷出也无感
          ctx.drawImage(this._glow, 0, 0, 32, 32);   // 强制辉光精灵上传为 GPU 纹理
          ctx.restore();
          ctx.clearRect(0, 0, cv.width, cv.height);
        }
      } catch (e) {}
    },

    /* ---------- 发射器原语（全部走预算闸） ---------- */
    _push(p) {
      if (this._parts.length >= this._budget) return;
      p._layer = this._emitLayer;   // v111：粒子继承当前发射层（身后/身前）
      if (this._ambFlag) p._amb = true;   // B2：氛围粒标记（独立计数/收束）
      this._parts.push(p);
    },
    /* 发射层切换（v111 身后/身前双层）：在回调内发射的实体打 layer 标记——
     * 护体光环/地面阵纹/吐纳绿芒走"身后层"(z:1，画在人物之后，不再浮于表面)，
     * 命中/弹道/天雷默认"身前层"(z:26)。用 prev 还原以支持嵌套（如 huti→tuna）。 */
    _emit(layer, fn) {
      const prev = this._emitLayer;
      this._emitLayer = layer;
      try { fn(); } finally { this._emitLayer = prev; }
    },
    /* 软光粒子 */
    mote(x, y, o = {}) {
      this._push({
        x, y, vx: o.vx || 0, vy: o.vy || 0, g: o.g || 0, drag: o.drag || 0,
        life: o.life || 500, t: o.delay ? -o.delay : 0,
        size: o.size || 3, c: o.c || "#fff", glow: true,
        wob: o.wob || 0, wobT: rnd(0, TAU),
      });
    },
    /* 线状火花（速度方向拉长） */
    spark(x, y, o = {}) {
      this._push({
        x, y, vx: o.vx || 0, vy: o.vy || 0, g: o.g != null ? o.g : .12, drag: o.drag || 0,
        life: o.life || 420, t: o.delay ? -o.delay : 0,
        size: o.size || 1.6, c: o.c || "#fff", streak: true,
      });
    },
    /* 几何碎片（瓷裂/冰裂——动漫里剑气碰撞的脆响质感） */
    shard(x, y, o = {}) {
      this._push({
        x, y, vx: o.vx || 0, vy: o.vy || 0, g: o.g != null ? o.g : .18, drag: .01,
        life: o.life || 560, t: 0, size: o.size || 4, c: o.c || "#fff",
        poly: true, rot: rnd(0, TAU), vr: rnd(-0.2, 0.2),
      });
    },
    /* 扩散环 */
    ring(x, y, o = {}) {
      this._push({ ringFx: true, x, y, r: o.r || 6, vr: o.vr || 3, life: o.life || 460, t: 0, c: o.c || "#e9cd86", lw: o.lw || 2.4 });
    },
    /* 全屏色闪 */
    flash(color, dur = 150, alpha = 0.5) {
      this._push({ rect: true, c: color, a: alpha, life: dur, t: 0 });
      this._run();
    },
    /* §9 动效强度统一判定：优先取 Settings（含用户"关动效"），回退系统 reduced-motion。*/
    _reduced() {
      const S = (typeof window !== "undefined") && window.Settings;
      if (S && S.reduceMotion) return S.reduceMotion();
      return typeof window !== "undefined" && window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    },
    _lite() {
      const S = (typeof window !== "undefined") && window.Settings;
      return !!(S && S.liteMotion && S.liteMotion());
    },
    /* 震屏 */
    shake(px = 8) {
      if (!this._host) return;
      if (this._reduced()) return;            // §9 关动效：不震屏（无障碍/晕动）
      this._host.style.setProperty("--fx-shake", px + "px");
      this._host.classList.remove("fx-shaking"); void this._host.offsetWidth;
      this._host.classList.add("fx-shaking");
      setTimeout(() => this._host.classList.remove("fx-shaking"), 420);
    },
    /* hit-stop 顿帧（B3）：全帧冻结 ms（粒子 dt=0 凝住 + 宿主子层 CSS 动画暂停），
       只给"玩家决定性一击"用——配合先一记 shake，画面会在抖到一半时被定住＝打击感翻倍。
       红线：默认 80ms，硬封顶 120（设计 ≤90，留点冗余）；reduced-motion 直接跳过。 */
    hitStop(ms = 80) {
      ms = Math.max(0, Math.min(120, ms | 0));
      if (!ms) return;
      if (this._reduced() || this._lite()) { this.haptic("heavy"); return; }  // §9 关/简动效：不冻帧（仍留一记触觉）
      const now = (typeof performance !== "undefined") ? performance.now() : Date.now();
      this._frozenUntil = Math.max(this._frozenUntil, now + ms);
      const h = this._host;
      if (h && h.classList) {
        h.classList.add("fx-hitstop");
        clearTimeout(this._hsTimer);
        this._hsTimer = setTimeout(() => h.classList.remove("fx-hitstop"), ms);
      }
      this.haptic("heavy");   // §9-3：决定性一击同步一记重震＝顿帧 + 物理反馈
      this._run();   // 维持 RAF：哪怕只有立绘在动，也要把这几帧"冻"住
    },

    /* §9-3 手机触觉反馈：突破/暴击/重击/古钟 轻震（零资源、移动端代入感；配合 hit-stop=真物理打击感）。
       能力缺失（桌面/不支持 vibrate）/ 关闭 / reduced-motion → 静默跳过。
       pattern：预设名（tap/hit/heavy/breakthrough/bell）或自定义 ms / [ms,…]。 */
    hapticsOn() {
      if (this._haptics === null) {
        this._haptics = true;
        try { if (typeof window !== "undefined" && window.localStorage && window.localStorage.getItem("fx_haptics") === "off") this._haptics = false; } catch (e) {}
      }
      return this._haptics;
    },
    setHaptics(on) {
      this._haptics = !!on;
      try { if (typeof window !== "undefined" && window.localStorage) window.localStorage.setItem("fx_haptics", on ? "on" : "off"); } catch (e) {}
    },
    haptic(pattern = "hit") {
      if (!this.hapticsOn()) return;
      if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
      if (typeof window !== "undefined" && window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const p = (typeof pattern === "string") ? this._HAPTIC[pattern] : pattern;
      if (p == null) return;
      try { navigator.vibrate(p); } catch (e) {}
    },

    /* ---------- B2 常驻/idle 氛围粒子（叠在静图上，复用粒子池 + _budget/_degraded） ----------
     * 预设：ash(灰烬·暖)/dust(微尘·中性)/spirit(灵气微光·青)/beam(光束缓扫暗场)。
     * 全部走"身后层"(z:1，在人物之后)，极淡、慢、微幅——氛围而非视觉中心。
     * Fx.ambient(preset[,opts]) 起；Fx.ambient(null|"off") 收（beam 立撤、motes 自然淡出）。
     * 守红线：常驻粒桌面≤80/手机≤30（_ambCap），帧难看时随 _degraded 自动减半。 */
    ambient(preset, o = {}) {
      if (preset && preset !== "off" && preset !== "none" && this._reduced()) preset = "off";  // §9 关动效：不起常驻氛围粒
      if (!preset || preset === "off" || preset === "none") {
        this._amb = null;
        for (const p of this._parts) {
          if (!p._amb) continue;
          if (p.beam) p.life = -1;                                  // 下帧过滤掉
          else if (p.life - p.t > 700) p.life = p.t + rnd(300, 700); // 缩余命，自然散
        }
        return;
      }
      this._amb = Object.assign({ preset }, o);
      this._ambAcc = 0;
      this._run();
    },
    _ambEmit(fn) { this._ambFlag = true; this._emit("back", fn); this._ambFlag = false; },
    _ambSpawn(preset, W, H) {
      if (preset === "ash") {
        this.mote(rnd(0, W), rnd(-0.05 * H, H * 0.55), {
          vx: rnd(-0.06, 0.06), vy: rnd(0.05, 0.16), wob: rnd(6, 12),
          size: rnd(1.5, 2.6), c: pick(["#d8a566", "#caa46a", "#e0b070"]), life: rnd(4200, 7200),
        });
      } else if (preset === "spirit") {
        this.mote(rnd(0, W), rnd(H * 0.45, H), {
          vx: rnd(-0.05, 0.05), vy: rnd(-0.32, -0.12), wob: rnd(8, 14),
          size: rnd(1.8, 3.0), c: pick(["#7fe5d2", "#bff3e8", "#9af0e0"]), life: rnd(3600, 6200),
        });
      } else if (preset === "storm") {
        // 风暴海战（S5 战场天象）：浪沫水线横飞——上半疏（风痕）、下半密（浪面溅沫），
        // 高横速短命=风在吼；lighter 混合下取冷白蓝
        const top = Math.random() < 0.35;
        this.mote(rnd(-0.12 * W, W * 0.55), top ? rnd(0, H * 0.5) : rnd(H * 0.58, H * 0.95), {
          vx: rnd(2.4, 4.6), vy: rnd(-0.25, 0.35), wob: 2,
          size: top ? rnd(1.2, 2) : rnd(1.6, 2.9), c: pick(["#cfe0ec", "#b6cadb", "#e8f2f9"]), life: rnd(650, 1300),
        });
      } else if (preset === "moqi") {
        // 六极真魔功·黑雾漫场（S4）：大团灰紫魔雾贴着地面横向流卷——天魔降世的"场"
        // （lighter 混合下深色不显，取带微光的灰紫；大颗慢移=雾而非尘）
        const dir = Math.random() < 0.72 ? 1 : -1;   // 主流向一致、偶有回卷
        this.mote(dir > 0 ? rnd(-0.15 * W, W * 0.3) : rnd(W * 0.7, W * 1.15), rnd(H * 0.42, H * 0.96), {
          vx: rnd(0.18, 0.5) * dir, vy: rnd(-0.06, 0.02), wob: rnd(10, 18),
          size: rnd(9, 20), c: pick(["#6b5f78", "#584e66", "#7a7088", "#4e4460"]), life: rnd(3800, 6800),
        });
      } else { // dust（默认）
        this.mote(rnd(0, W), rnd(0, H), {
          vx: rnd(-0.09, 0.09), vy: rnd(-0.03, 0.02), wob: rnd(5, 9),
          size: rnd(1.1, 2.0), c: pick(["#c4ccd6", "#b7bfc9", "#d3d8df"]), life: rnd(5000, 8200),
        });
      }
    },
    _ambientTick(dt) {
      const A = this._amb; if (!A) return;
      const W = this._w, H = this._h; if (!W || !H) return;
      if (A.preset === "beam") {
        let beam = null;
        for (const p of this._parts) if (p._amb && p.beam) { beam = p; break; }
        if (!beam) {
          this._ambEmit(() => this._push({
            beam: true, x: -0.2 * W, bw: Math.max(48, W * 0.11),
            rgb: hexRgb(A.color || "#f4e3b0"), baseA: (A.alpha != null ? A.alpha : 0.10),
            t: 0, life: 1e12,
          }));
          for (const p of this._parts) if (p._amb && p.beam) { beam = p; break; }
        }
        if (beam) {
          beam.bw = Math.max(48, W * 0.11);
          beam.x += (A.speed || (W / 13000)) * dt;                  // 全宽约 13s 扫一遍
          if (beam.x > W + beam.bw) beam.x = -beam.bw;
        }
        return;
      }
      const cap = Math.max(4, Math.round((A.cap || this._ambCap) * this._degraded));
      let n = 0; for (const p of this._parts) if (p._amb) n++;
      const interval = A.interval || 240;
      this._ambAcc += dt;
      let guard = 0;
      while (n < cap && this._ambAcc >= interval && guard++ < 8) {
        this._ambAcc -= interval;
        this._ambEmit(() => this._ambSpawn(A.preset, W, H));
        n++;
      }
      if (this._ambAcc > interval * 4) this._ambAcc = interval;     // 切后台久了别一次性爆发
    },

    /* ---------- 高阶效果（配方的积木） ---------- */

    /* 连续光带（描边路径，draw-on 动画）：能量的"绸"——头部推进、尾部熄灭。
     * curve=抛物高度，wave/waveN=蛇形，width=带宽。比散点连珠更像动漫的法术光带 */
    ribbon(from, to, o = {}) {
      if (!from || !to) return;
      const [core, glow] = o.core ? [o.core, o.glowC || o.core] : col(o.elem);
      const dx = to.x - from.x, dy = to.y - from.y;
      const dist = Math.hypot(dx, dy) || 1;
      const nx = -dy / dist, ny = dx / dist;
      const n = Math.max(24, Math.round(dist / 6));
      const pts = [];
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const arc = o.curve ? Math.sin(t * Math.PI) * -o.curve : 0;
        const sn = o.wave ? Math.sin(t * Math.PI * (o.waveN || 3)) * o.wave * (1 - t * 0.45) : 0;
        pts.push([from.x + dx * t + nx * sn, from.y + dy * t + arc + ny * sn]);
      }
      if (this._strokes.length >= 24) return;   // 光带也有预算（极端连发兜底）
      this._strokes.push({
        pts, t: 0, flyMs: o.flyMs || 300, tail: o.tail || 0.42, hold: o.hold || 140,
        w: o.width || 5, core, glowC: glow, taper: o.taper !== false,
      });
      this._run();
    },
    /* 飞剑环阵（青竹蜂云剑：n 柄飞剑绕身旋舞，椭圆轨道带透视）——
     * 神雷附剑的主体：剑随气旋、雷缠剑身。剑形真画（细长剑刃+护手），非光块 */
    swordRing(cx, cy, o = {}) {
      this._swords.push({
        cx, cy, r: o.r || 52, n: o.n || 12, t: 0, life: o.life || 1500,
        spin: o.spin || 0.05, intro: o.intro || 260, outro: o.outro || 340,
        len: o.len || 17, blade: o.blade || "#bdf7cf", core: o.core || "#ffffff",
        lei: o.lei || false,   // 雷缠：剑身偶现金弧
      });
      this._run();
    },
    /* 短促电弧（两点之间的金蛇）——剑阵雷缠/瞬移破口的零件 */
    arc(x0, y0, x1, y1, o = {}) {
      const pts = [[x0, y0]]; const n = 7;
      const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len, ny = dx / len;
      for (let i = 1; i < n; i++) { const t = i / n; const s = rnd(-0.5, 0.5) * 10; pts.push([x0 + dx * t + nx * s, y0 + dy * t + ny * s]); }
      pts.push([x1, y1]);
      this._arcs.push({ pts, t: 0, life: o.life || 160, w: o.w || 1.8, c: o.c || "255,214,90" });
    },
    _drawSword(ctx, x, y, ang, len, blade, core, alpha) {
      ctx.save();
      ctx.translate(x, y); ctx.rotate(ang);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = blade;
      ctx.beginPath();
      ctx.moveTo(len, 0); ctx.lineTo(-len * 0.22, 2.4);
      ctx.lineTo(-len * 0.42, 0); ctx.lineTo(-len * 0.22, -2.4);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = core; ctx.globalAlpha = alpha * 0.95; ctx.lineWidth = 0.9;
      ctx.beginPath(); ctx.moveTo(len * 0.92, 0); ctx.lineTo(-len * 0.28, 0); ctx.stroke();
      ctx.strokeStyle = blade; ctx.globalAlpha = alpha; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(-len * 0.24, -3.6); ctx.lineTo(-len * 0.24, 3.6); ctx.stroke();
      ctx.restore();
    },
    /* 弹道：连续光带 + 头部火花（默认实现换 ribbon，散点拖尾作余烬） */
    trail(from, to, o = {}) {
      if (!from || !to) return;
      this.ribbon(from, to, o);
      const [core] = col(o.elem);
      const dx = to.x - from.x, dy = to.y - from.y;
      const flyMs = o.flyMs || 300;
      // 余烬：沿途稀疏洒几粒（密度远低于旧版——光带才是主体）
      for (let i = 0; i < 6 * this._degraded; i++) {
        const t = rnd(0.1, 0.95);
        const arc = o.curve ? Math.sin(t * Math.PI) * -o.curve : 0;
        this.mote(from.x + dx * t, from.y + dy * t + arc, {
          vy: rnd(-.5, .3), life: 380, delay: t * flyMs + rnd(0, 60), size: rnd(2, 3.4), c: core,
        });
      }
      this._run();
    },
    /* 命中爆点 */
    burst(x, y, elem, n = 16, o = {}) {
      const [core, glow] = col(elem);
      const N = Math.round(n * this._degraded);
      for (let i = 0; i < N; i++) {
        const a = rnd(0, TAU), sp = rnd(1.2, o.power || 4.2);
        this.spark(x, y, { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1.1, c: Math.random() < .45 ? core : glow, life: rnd(320, 620) });
      }
      this._run();
    },
    /* 材质反应（动漫官设：克制命中的"物理化学反应"）——按受击方行属演 */
    material(x, y, defElem) {
      const N = this._degraded;
      if (defElem === "shui") {
        // 白雾蒸腾（剑气遇水系灵术如热刀切黄油——慕兰之战官方设定）
        for (let i = 0; i < 9 * N; i++) {
          this.mote(x + rnd(-22, 22), y + rnd(-8, 10), { vy: rnd(-1.1, -0.5), wob: 6, life: 1000, size: rnd(4.5, 7), c: "#eef6ff", delay: rnd(0, 220) });
        }
      } else if (defElem === "jin" || defElem === "tu") {
        // 瓷器碎裂般的脆响质感
        for (let i = 0; i < 9 * N; i++) {
          this.shard(x, y, { vx: rnd(-4, 4), vy: rnd(-4.5, -1), c: i % 3 ? "#f4ead2" : "#fff", size: rnd(2.5, 5.5) });
        }
      } else if (defElem === "mu") {
        for (let i = 0; i < 8 * N; i++) {
          this.shard(x, y, { vx: rnd(-3, 3), vy: rnd(-3.5, -1), c: i % 2 ? "#9fe3ae" : "#dcffe2", size: rnd(2, 4.5), life: 700 });
        }
      } else if (defElem === "huo") {
        // 火气被压熄：余烬四溅+一缕白烟
        this.burst(x, y, "huo", 10, { power: 3.4 });
        for (let i = 0; i < 4 * N; i++) {
          this.mote(x + rnd(-10, 10), y + rnd(-6, 4), { vy: -0.8, wob: 5, life: 900, size: 5, c: "#e8e8e2", delay: 120 + rnd(0, 160) });
        }
      } else {
        this.burst(x, y, defElem || "none", 8, { power: 3 });
      }
      this._run();
    },

    /* 天雷劈落（opts.gold=金色辟邪神雷；opts.bolt 自定三层描边色 [外晕,中,芯]） */
    lightning(x, y, opts = {}) {
      if (!this._ctx) return;
      const make = (x0, y0, x1, y1, spread) => {
        const pts = [[x0, y0]];
        const n = 14;
        for (let i = 1; i < n; i++) {
          const t = i / n;
          pts.push([x0 + (x1 - x0) * t + rnd(-0.5, 0.5) * spread * (1 - t * 0.4), y0 + (y1 - y0) * t]);
        }
        pts.push([x1, y1]);
        return pts;
      };
      const gold = opts.gold;
      // 金雷从天幕最高处落下（"天降"感）——蓝雷沿用原起点
      const main = make(x + rnd(-30, 30), gold ? -this._h * 0.9 : -20, x, y, gold ? 80 : 64);
      const branches = [];
      for (let b = 0; b < 2 + Math.floor(Math.random() * 2); b++) {
        const k = 3 + Math.floor(Math.random() * (main.length - 6));
        const [bx, by] = main[k];
        branches.push(make(bx, by, bx + rnd(-60, 60), by + rnd(60, 140), 40));
      }
      this._bolts.push({
        pts: main, branches, life: opts.life || (opts.small ? 280 : 460), t: 0, w: opts.small ? 2.2 : 3.4,
        bolt: opts.bolt || (gold ? ["255,176,30", "255,214,90", "255,248,210"] : ["122,168,255", "170,205,255", "244,250,255"]),
      });
      // quiet（S5 战场天象·远雷）：天边的雷不进战局——不震屏、弱天光、远雷声、不迸粒
      if (opts.quiet) {
        this.flash("#c9d7ee", 130, .16);
        if (typeof Sfx !== "undefined") Sfx.play("thunderFar");
        this._run();
        return;
      }
      this.burst(x, y, gold ? "jinlei" : "lei", opts.small ? 14 : 26, { power: 5 });
      this.flash(gold ? "#ffe9ad" : "#d6e8ff", opts.small ? 110 : 190, opts.small ? .4 : .8);
      this.shake(opts.small ? 5 : 11);
      if (typeof Sfx !== "undefined") Sfx.play("thunder");
      this._run();
    },

    /* 横向金雷折线（神雷·劈横扫的"雷幕"零件）：自人物向左右各拉一道贯场金雷 */
    _horizBolt(x0, y0, x1, y1, o = {}) {
      if (!this._ctx) return;
      const n = 18, pts = [[x0, y0]];
      for (let i = 1; i < n; i++) {
        const t = i / n;
        const jag = rnd(-1, 1) * 24 * Math.sin(t * Math.PI);   // 中段抖动大、两头收
        pts.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t + jag]);
      }
      pts.push([x1, y1]);
      const branches = [];
      for (let b = 0; b < 3; b++) {
        const k = 3 + Math.floor(Math.random() * (n - 5));
        const [bx, by] = pts[k];
        branches.push([[bx, by], [bx + rnd(-40, 40), by + rnd(36, 90)]]);
      }
      this._bolts.push({
        pts, branches, life: o.life || 420, t: 0, w: o.w || 3,
        bolt: o.bolt || ["255,176,30", "255,214,90", "255,248,210"],
      });
    },

    /* ═══ S2 三拍特效·屏幕级组件（预兆→爆发→余韵的可复用件）═══ */
    /* 预兆·战场压暗（DOM overlay 渐入渐出）：大招前天光骤暗——全屏幕为这一击让路 */
    dimField(ms = 1800, depth = 0.4) {
      const h = this._host;
      if (!h || this._reduced()) return;
      let d = h.querySelector(":scope > .fx-dim");
      if (!d) {
        d = document.createElement("i");
        d.className = "fx-dim";
        h.appendChild(d);
        void d.offsetWidth;   // 先入 DOM 再改 opacity，让 transition 生效
      }
      d.style.opacity = depth;
      clearTimeout(d._t);
      d._t = setTimeout(() => { d.style.opacity = 0; setTimeout(() => d.remove(), 800); }, ms);
    },
    /* 预兆·金云汇聚：天幕顶部金色云团脉动 + 施法者身上金尘引雷上冲 */
    goldGather(from, ms = 500) {
      if (!this._ctx) return;
      const W = this._w;
      for (let i = 0; i < 10 * this._degraded; i++) {
        this.mote(rnd(W * 0.18, W * 0.82), rnd(4, 34), {
          vx: rnd(-0.5, 0.5), vy: rnd(0.1, 0.4), wob: 9, life: ms + 500,
          size: rnd(9, 16), c: i % 3 ? "#ffdf8a" : "#fff3c4", delay: rnd(0, ms * 0.5),
        });
      }
      for (let i = 0; i < 12 * this._degraded; i++) {
        this.spark(from.x + rnd(-14, 14), from.y - rnd(0, 10),
          { vy: rnd(-6.5, -3.5), c: i % 2 ? "#ffe39a" : "#fff7d6", life: ms, delay: rnd(0, ms * 0.4) });
      }
      this._run();
    },
    /* 余韵·焦痕 decal（DOM 地面残留渐隐——世界记住这一击）。红线：同屏 ≤6 */
    scorch(x, y, ms = 6000) {
      const h = this._host;
      if (!h) return;
      const marks = h.querySelectorAll(":scope > .fx-scorch");
      if (marks.length >= 6) marks[0].remove();
      const d = document.createElement("i");
      d.className = "fx-scorch";
      d.style.left = (x - 34) + "px";
      d.style.top = (y - 6) + "px";
      h.appendChild(d);
      requestAnimationFrame(() => d.classList.add("on"));
      setTimeout(() => { d.classList.remove("on"); setTimeout(() => d.remove(), 1300); }, ms);
    },

    /* 辟邪神雷·劈·横扫（S2 完全体·三拍标杆模板）：
     *  预兆(0~520ms) 天光骤暗+金云汇聚+远雷压来 → 爆发 白闪+聚雷+贯场雷幕+逐敌金雷（首雷顿帧）
     *  → 余韵 焦痕残留+金烬上飘+残雷爬体+雷声长尾。
     * fromAnchor=施法者；toAnchors=横扫所及诸敌锚点数组 */
    shenleiSweep(fromAnchor, toAnchors) {
      if (!this._ctx) return;
      const from = this.at(fromAnchor, 0.5);
      if (!from) return;
      const tos = (toAnchors || []).map(a => this.at(a, 0.5)).filter(Boolean);
      const feet = (toAnchors || []).map(a => this.at(a, 0.94)).filter(Boolean);
      // ═══ 预兆拍：天光骤暗 + 金云自天幕汇聚 + 低频远雷先声（"要来了"）═══
      this.dimField(2200, .42);
      this.goldGather(from, 500);
      if (typeof Sfx !== "undefined") Sfx.play("thunderFar");
      this._run();
      setTimeout(() => {
        if (!this._ctx) return;
        // ═══ 爆发拍 ═══
        // ⓪ 全屏白闪（爆发只有一帧的巅峰）
        this.flash("#fff7dd", 80, .6);
        // ① 起手·人物聚雷：上冲金光柱 + 脚下金环（雷"自人而发"的发力点）
        this.ring(from.x, from.y + 10, { c: "#ffd970", vr: 5.2, life: 440, lw: 3.6 });
        this.ring(from.x, from.y + 10, { c: "#fff", vr: 3.0, life: 320, lw: 1.8 });
        for (let i = 0; i < 16 * this._degraded; i++) this.spark(from.x + rnd(-10, 10), from.y, { vy: rnd(-8.5, -3), c: i % 2 ? "#ffe39a" : "#fff7d6", life: 320 });
        this.burst(from.x, from.y, "jinlei", 22, { power: 5.2 });
        this.shake(10);
        // ② 横扫雷幕：自人物向左右各拉一道贯场金雷（"左右十格"的具象）
        const allX = [from.x, ...tos.map(t => t.x)];
        const sweepY = tos.length ? tos.reduce((s, t) => s + t.y, 0) / tos.length : from.y;
        this._horizBolt(from.x, from.y, Math.max(...allX) + 60, sweepY, { life: 460, w: 3.2 });
        this._horizBolt(from.x, from.y, Math.min(...allX) - 60, sweepY, { life: 460, w: 3.2 });
        // ③ 逐敌雷击（错相 90ms）：金雷劈落 + 冲击环 + 迸散；首雷顿帧——那一下"咔"地定住。
        //    S5 灵动感：雷不是各劈各的——前一个落雷向下一个目标"窜"出连锁金弧（雷在敌群间跳），
        //    落点地面再窜两截贴地雷（电走地脉）
        tos.forEach((t, i) => setTimeout(() => {
          if (!this._ctx) return;
          this.lightning(t.x, t.y, { gold: true, life: 520 });
          if (i === 0) this.hitStop(110);
          if (i > 0) {   // 连锁：自前一个雷点跳向本目标（略上挑的弧=电蛇腾跃）
            const pv = tos[i - 1];
            this.arc(pv.x, pv.y - 12, t.x, t.y - 12, { c: "255,214,90", w: 2.4, life: 300 });
            setTimeout(() => this._ctx && this.arc(pv.x, pv.y - 4, t.x, t.y - 8, { c: "255,240,190", w: 1.4, life: 220 }), 70);
          }
          const gy = (feet[i] || t).y;   // 贴地窜雷：落点左右各一截短折雷贴地爬开
          this._horizBolt(t.x, gy, t.x - rnd(34, 52), gy + rnd(-3, 3), { life: 260, w: 1.8 });
          this._horizBolt(t.x, gy, t.x + rnd(34, 52), gy + rnd(-3, 3), { life: 260, w: 1.8 });
          this.ring(t.x, t.y + 8, { c: "#ffd970", vr: 4.8, life: 340, lw: 3 });
          this.ring(t.x, t.y + 8, { c: "#fff", vr: 2.8, life: 260, lw: 1.6 });
          this.burst(t.x, t.y, "jinlei", 24, { power: 5.6 });
          // ═══ 余韵拍：焦痕残留 + 金烬上飘 + 残雷爬体（它真的发生过）═══
          const ft = feet[i];
          if (ft) this.scorch(ft.x, ft.y);
          for (let k = 0; k < 3; k++) {
            setTimeout(() => this._ctx && this.lightning(t.x + rnd(-16, 16), t.y + rnd(-8, 6), { gold: true, small: true, life: 150 }), 300 + k * 220);
          }
          for (let k = 0; k < 8 * this._degraded; k++) {
            this.mote(t.x + rnd(-22, 22), t.y + rnd(-4, 10), {
              vy: rnd(-1.2, -0.5), wob: 6, life: rnd(900, 1600),
              size: rnd(2.5, 4), c: k % 2 ? "#ffd97a" : "#fff3c4", delay: 220 + rnd(0, 520),
            });
          }
          this._run();
        }, 140 + i * 90));
        if (typeof Sfx !== "undefined") Sfx.play("thunder");
        this._run();
      }, 520);
    },

    /* 放射状金雷（落地炸开的零件）：自中心向 ang 方向射出一道之字闪电 */
    _radialBolt(cx, cy, ang, len, o = {}) {
      if (!this._ctx) return;
      const n = 7, pts = [[cx, cy]];
      const dx = Math.cos(ang), dy = Math.sin(ang);
      const nx = -dy, ny = dx;
      for (let i = 1; i < n; i++) {
        const t = i / n, jag = rnd(-1, 1) * 9 * (1 - t * 0.3);
        pts.push([cx + dx * len * t + nx * jag, cy + dy * len * t + ny * jag]);
      }
      pts.push([cx + dx * len, cy + dy * len]);
      this._bolts.push({
        pts, branches: [], life: o.life || 340, t: 0, w: o.w || 2.2,
        bolt: o.bolt || ["255,176,30", "255,214,90", "255,248,210"],
      });
    },

    /* 雷遁·传送门·吞入（R5 消失帧）：原地撕开金色空间洞→周身金芒向心汇拢被吸入→
     * 大环向内收缩湮灭。配合落点 portalEmerge=“进一个洞、从另一个洞穿出”（参考图1金色环洞）。 */
    portalSwallow(at) {
      if (!this._ctx || !at) return;
      const cx = at.x, cy = at.y - 6;
      // 空间洞张开：金白双环先涨，再加一道大环向内收=被空间吞没
      this.ring(cx, cy, { r: 8, vr: 7.0, life: 230, lw: 3.2, c: "#ffd970" });
      this.ring(cx, cy, { r: 6, vr: 5.2, life: 210, lw: 1.8, c: "#fff7d6" });
      this._push({ ringFx: true, x: cx, y: cy, r: 46, vr: -4.4, life: 300, t: 0, c: "#ffe39a", lw: 3 });
      // 洞口电蛇：绕口一圈短金弧（亚空间裂口）
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU, r = 30;
        this.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.7,
          cx + Math.cos(a + 0.7) * r, cy + Math.sin(a + 0.7) * r * 0.7, { c: "255,214,90", w: 1.6, life: 240 });
      }
      // 被吸入：周身金芒向心汇拢
      for (let i = 0; i < 14 * this._degraded; i++) {
        const a = rnd(0, TAU), r = rnd(28, 52);
        const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r * 0.8;
        this.mote(px, py, { vx: (cx - px) * 0.05, vy: (cy - py) * 0.05, life: 300, size: rnd(2, 3.6), c: i % 3 ? "#ffe39a" : "#fff", delay: rnd(0, 60) });
      }
      // 竖直金光柱（破空遁入的瞬间）
      for (let i = 0; i < 8 * this._degraded; i++) this.spark(cx + rnd(-5, 5), cy + 6, { vy: rnd(-7, -3), c: "#ffe39a", life: 240 });
      this.flash("#fff2c8", 90, .32);
      this.shake(6);
      this._run();
    },

    /* 雷遁·传送门·穿出（R5 出现帧）：落点金色空间洞乍现→炸开（金白环爆张+洞口电蛇）。 */
    portalEmerge(at) {
      if (!this._ctx || !at) return;
      const cx = at.x, cy = at.y - 6;
      this.ring(cx, cy, { r: 10, vr: 8.5, life: 300, lw: 3.6, c: "#ffd970" });
      this.ring(cx, cy, { r: 6, vr: 6.0, life: 240, lw: 2, c: "#fff" });
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU, r = 26;
        this.arc(cx, cy, cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.7, { c: "255,214,90", w: 1.7, life: 220 });
      }
      this.flash("#fff2c8", 70, .26);
      this._run();
    },

    /* 雷遁·落地炸开（R6，参考图2 风雷翅展开+金雷放射）：落点为心，金雷向四周放射状炸开
     * （偏水平更长=风雷翅左右展开）+左右两道大横弧（翅展意象）+金爆+双冲击环+闪+震。 */
    leiLandBurst(at) {
      if (!this._ctx || !at) return;
      const cx = at.x, cy = at.y - 6;
      // ① 放射金雷：自落点向四周射出 N 道之字金雷（偏水平的更长=翅展）
      const N = this._degraded < 1 ? 8 : 11;
      for (let i = 0; i < N; i++) {
        const a = (i / N) * TAU + rnd(-0.12, 0.12);
        const len = Math.abs(Math.cos(a)) > 0.5 ? rnd(70, 110) : rnd(40, 70);
        this._radialBolt(cx, cy, a, len, { w: 2.4, life: 360 });
      }
      // ② 风雷翅意象：左右两道大横弧扫出
      this.arc(cx, cy, cx - 96, cy - rnd(6, 22), { c: "255,214,90", w: 2.6, life: 320 });
      this.arc(cx, cy, cx + 96, cy - rnd(6, 22), { c: "255,214,90", w: 2.6, life: 320 });
      // ③ 金爆 + 冲击环 + 闪 + 震
      this.burst(cx, cy, "jinlei", 28, { power: 6 });
      this.ring(cx, cy + 6, { c: "#ffd970", vr: 6.2, life: 360, lw: 3.4 });
      this.ring(cx, cy + 6, { c: "#fff", vr: 3.6, life: 280, lw: 1.8 });
      this.flash("#ffe39a", 150, .46);
      this.shake(11);
      if (typeof Sfx !== "undefined") Sfx.play("thunder");
      this._run();
    },

    /* ============================================================
     * 分功法配方（FX_MAP）——动漫调研对照表见 docs/fx-design.md
     * 每条：cast(from, to) —— from/to 为画布坐标（to 可为 null=自身术）
     * ============================================================ */
    RECIPES: {
      /* 青元剑诀·剑芒：青色剑气束破空，命中迸瓷裂碎片（动漫：丈许青芒、脆响） */
      qingyuan_jianmang(F, from, to) {
        if (!to) return;
        F._blade(from, to, "#a8f0e0", "#2fae9b");
        setTimeout(() => {
          for (let i = 0; i < 10 * F._degraded; i++) {
            const a = rnd(-1.2, 1.2);
            F.shard(to.x, to.y, { vx: Math.cos(a) * rnd(2, 5), vy: Math.sin(a) * rnd(2, 5) - 2, c: i % 3 ? "#bff3e8" : "#fff", size: rnd(2.5, 5) });
          }
          F.flash("#bdf2e6", 90, .22);
        }, 200);
        F._run();
      },
      /* 青元剑诀·剑盾：青色剑环护体 */
      qingyuan_jiandun(F, from) {
        F._emit("back", () => {   // 剑盾护体：青环＋绕身青芒走身后层（贴着人物身后＝护体halo）
          F.ring(from.x, from.y - 8, { c: "#7fe5d2", vr: 2.2, life: 620, lw: 3 });
          F.ring(from.x, from.y - 8, { c: "#bff3e8", vr: 1.4, life: 760, lw: 1.6 });
          for (let i = 0; i < 12 * F._degraded; i++) {
            const a = (i / 12) * TAU;
            F.mote(from.x + Math.cos(a) * 30, from.y - 8 + Math.sin(a) * 38, { vy: -.5, life: 700, size: 2.6, c: "#a8f0e0", delay: i * 28 });
          }
          F._run();
        });
      },
      /* 青元剑诀·剑影分光（七层）：一道青芒分作三影，错落扑敌，每影各自迸碎（动漫：分光化影） */
      qingyuan_jianying(F, from, to) {
        if (!to) return;
        const offs = [-22, 0, 22];
        offs.forEach((dy, i) => {
          setTimeout(() => {
            F._blade({ x: from.x, y: from.y + dy }, { x: to.x, y: to.y + dy * 0.4 }, "#bff3e8", "#2fae9b");
            for (let k = 0; k < 6 * F._degraded; k++) {
              const a = rnd(-1.2, 1.2);
              F.shard(to.x, to.y + dy * 0.4, { vx: Math.cos(a) * rnd(2, 5), vy: Math.sin(a) * rnd(2, 5) - 2, c: k % 2 ? "#bff3e8" : "#fff", size: rnd(2, 4.5) });
            }
            if (i === offs.length - 1) F.flash("#bdf2e6", 110, .26);
          }, i * 130);
        });
        F._run();
      },
      /* 巨剑术（青元剑诀直授·大杀招·v149 用户裁决·重特效演出）：聚周身青芒凝铸丈余巨剑→
       * 自高天倾斩而下→落点重震破甲裂阵。无 shadowBlur；粒子吃 _degraded；剑体＝加宽光带摞白芯。 */
      jujian_shu(F, from, to) {
        const p = to || from;
        // ① 聚芒：施法者周身青芒上旋汇聚（蓄力的仪式感）
        F.flash("#bdf2e6", 90, .16);
        for (let i = 0; i < 12 * F._degraded; i++) {
          const a = (i / 12) * TAU;
          F.mote(from.x + Math.cos(a) * 26, from.y - 8 + Math.sin(a) * 30,
            { vx: -Math.cos(a) * 1.4, vy: -Math.sin(a) * 1.0 - 0.6, life: 240, size: 3, c: i % 3 ? "#a8f0e0" : "#fff", delay: i * 10 });
        }
        // ② 自天倾斩：丈余巨剑自高天落于目标——加宽青芒光带摞白芯成剑体，剑脊一线白芒
        const top = { x: p.x + 14, y: p.y - 168 };
        setTimeout(() => {
          F.ribbon(top, { x: p.x, y: p.y }, { core: "#7fe5d2", glowC: "#2fae9b", width: 17, flyMs: 150, tail: 0.95, hold: 150 });
          F.ribbon(top, { x: p.x, y: p.y }, { core: "#ffffff", glowC: "#bff3e8", width: 6, flyMs: 150, tail: 0.85, hold: 130 });
          F.ribbon({ x: top.x - 4, y: top.y }, { x: p.x - 3, y: p.y }, { core: "#eafff8", glowC: "#7fe5d2", width: 2.4, flyMs: 150, tail: 0.7, hold: 110 });
        }, 170);
        // ③ 倾斩落地：重震＋破甲冲击环×2＋裂地横弧＋青芒迸碎
        setTimeout(() => {
          F.shake(15);
          F.ring(p.x, p.y + 8, { c: "#bff3e8", vr: 5.8, life: 360, lw: 4 });
          setTimeout(() => F.ring(p.x, p.y + 8, { c: "#fff", vr: 3.6, life: 300, lw: 2 }), 70);
          F.burst(p.x, p.y, "mu", 30, { power: 6.4 });
          F.material(p.x, p.y, "mu");
          F.flash("#d6fff2", 200, .42);
          F._slashArc({ x: p.x, y: p.y + 6 }, 0, "#bff3e8");   // 裂地横弧（破甲裂阵）
          for (let i = 0; i < 10 * F._degraded; i++) {
            const a = rnd(-2.4, -0.7);
            F.shard(p.x, p.y, { vx: Math.cos(a) * rnd(3, 7), vy: Math.sin(a) * rnd(3, 7), c: i % 2 ? "#bff3e8" : "#fff", size: rnd(3, 6) });
          }
        }, 340);
        F._run();
      },
      /* ============================================================
       * 辟邪神雷三连（v98 用户点名"做最好看的金色雷"）——金芯白炽，雷者天威
       * 金色雷：辟邪神雷克鬼魅邪魔（青竹蜂云剑·七十二雷）
       * ============================================================ */
      /* 劈（S2 三拍完全体）：预兆 压暗+金云+远雷 → 爆发 白闪+粗金雷柱+顿帧 → 余韵 焦痕+金烬+残雷爬体 */
      shenlei_pi(F, from, to) {
        if (!to) return;
        // ═ 预兆拍：天光骤暗 + 金云汇聚 + 远雷先声
        F.dimField(1900, .4);
        F.goldGather(from, 460);
        if (typeof Sfx !== "undefined") Sfx.play("thunderFar");
        setTimeout(() => {
          // ═ 爆发拍：全屏白闪 + 主雷自天幕最高处劈落（gold=金色三层描边+起点拉到画顶）+ 顿帧
          F.flash("#fff7dd", 80, .6);
          F.lightning(to.x, to.y, { gold: true, life: 600 });
          F.hitStop(110);
          setTimeout(() => F.lightning(to.x + rnd(-16, 16), to.y, { gold: true, small: true, life: 320 }), 90);
          // 命中：金色冲击环×2+金雷迸散+金闪+重震
          F.ring(to.x, to.y + 8, { c: "#ffd970", vr: 5.4, life: 380, lw: 3.6 });
          setTimeout(() => F.ring(to.x, to.y + 8, { c: "#fff", vr: 3.4, life: 300, lw: 1.8 }), 70);
          F.burst(to.x, to.y, "jinlei", 32, { power: 6.2 });
          F.flash("#ffe39a", 200, .5);
          F.shake(13);
          // ═ 余韵拍：焦痕残留 + 残雷爬体 + 金烬上飘（它真的发生过）
          F.scorch(to.x, to.y + 26);
          for (let i = 0; i < 4; i++) {
            setTimeout(() => F.lightning(to.x + rnd(-18, 18), to.y + rnd(-10, 6), { gold: true, small: true, life: 170 }), 180 + i * 130);
          }
          for (let i = 0; i < 8 * F._degraded; i++) {
            F.mote(to.x + rnd(-20, 20), to.y + rnd(-4, 10), {
              vy: rnd(-1.2, -0.5), wob: 6, life: rnd(900, 1500),
              size: rnd(2.5, 4), c: i % 2 ? "#ffd97a" : "#fff3c4", delay: 240 + rnd(0, 500),
            });
          }
        }, 480);
        F._run();
      },
      /* 附剑：金雷自天落于身→七十二青竹云剑应雷而出、剑身缠金电（buff 的仪式感）。
       * 剑环本体已由 DOM 剑阵（ui.js .au-swords.lei + leiRitual 应雷仪式）接管——此处只放"引子"特效 */
      shenlei_fujian(F, from) {
        // ① 一道金雷劈在自身（唤剑的引子）
        F.lightning(from.x, from.y - 6, { gold: true, small: true, life: 280 });
        F.flash("#ffe39a", 110, .3);
        // ② 应雷迸放：金环 + 一圈青芒（剑身成环交给 DOM 剑阵——不再画 canvas 临时剑环以免与之重叠）
        setTimeout(() => {
          F.ring(from.x, from.y - 6, { c: "#ffd970", vr: 2.6, life: 560, lw: 2.4 });
          // 剑出时一圈青芒迸放
          for (let i = 0; i < 12 * F._degraded; i++) {
            const a = (i / 12) * TAU;
            F.mote(from.x + Math.cos(a) * 18, from.y - 6 + Math.sin(a) * 12, { vx: Math.cos(a) * 1.6, vy: Math.sin(a) * 1.0, life: 480, size: 3, c: i % 3 ? "#bdf7cf" : "#fff3c4", delay: i * 18 });
          }
        }, 220);
        F._run();
      },
      /* 雷遁·消失帧（R5）：瞬移不是快、是"换了个空间"——原地撕开金色空间洞、人被吸入
       * （portalSwallow）。出现帧由 UI 在落点再放一次 leidun_out=从另一个洞穿出（两段式·长距离）。 */
      leidun(F, from) {
        F.portalSwallow(from);
      },
      /* 雷遁·出现帧（R5+R6）：落点金色空间洞穿出（portalEmerge）+ 金雷放射状落地炸开
       * （leiLandBurst，参考图2 风雷翅+金雷放射）。 */
      leidun_out(F, from) {
        F.portalEmerge(from);
        F.leiLandBurst(from);
      },
      /* 眨眼剑法：两道交叉钢色快斩（武学：快、白、利） */
      zhayan(F, from, to) {
        const p = to || from;
        F._slashArc(p, -0.5, "#f4f4f0");
        setTimeout(() => F._slashArc(p, 0.62, "#e8e8e0"), 90);
        F.burst(p.x, p.y, "jin", 7, { power: 3 });
      },
      zhayan_lian(F, from, to) {
        const p = to || from;
        F._slashArc(p, -0.45, "#f4f4f0");
        setTimeout(() => F._slashArc(p, 0.5, "#eef0e8"), 80);
        setTimeout(() => F._slashArc(p, -1.1, "#fff"), 170);
        F.burst(p.x, p.y, "jin", 10, { power: 3.4 });
      },
      /* 火弹术：火球曳焰抛射→爆燃（橙焰+余烬） */
      huodan(F, from, to) {
        if (!to) return;
        F.trail(from, to, { elem: "huo", curve: 30, size: 4.4, flyMs: 300, gap: 11 });
        setTimeout(() => {
          F.burst(to.x, to.y, "huo", 22, { power: 4.6 });
          F.ring(to.x, to.y, { c: "#ff8a3c", vr: 4, life: 320, lw: 3 });
          F.flash("#ff9a4d", 100, .16);
        }, 300);
      },
      /* 火蛇符：活火蛇游走扑咬（蛇形弹道是它的"脸"——动漫：符化火蛇） */
      huoshe_fu(F, from, to) {
        if (!to) return;
        F.trail(from, to, { elem: "huo", wave: 26, waveN: 4, size: 4.2, flyMs: 430, fade: 330, gap: 9 });
        setTimeout(() => {
          F.burst(to.x, to.y, "huo", 16, { power: 4 });
          // 咬合：火蛇头形闭口的一圈
          F.ring(to.x, to.y, { c: "#ff7a30", vr: 2.6, life: 260, lw: 2.6 });
        }, 430);
      },
      /* 寒冰符：冰棱攒射+霜雾沉降（蓝白结晶） */
      hanbing_fu(F, from, to) {
        if (!to) return;
        for (let i = 0; i < 3; i++) {
          setTimeout(() => F.trail(from, to, { elem: "shui", curve: 8 - i * 8, size: 3, flyMs: 240, gap: 16 }), i * 70);
        }
        setTimeout(() => {
          for (let i = 0; i < 12 * F._degraded; i++) {
            F.shard(to.x, to.y, { vx: rnd(-3, 3), vy: rnd(-4.5, 0), c: i % 2 ? "#dff4ff" : "#9fd0f0", size: rnd(2.5, 5.5), life: 700 });
          }
          for (let i = 0; i < 8 * F._degraded; i++) {
            F.mote(to.x + rnd(-26, 26), to.y + rnd(-6, 14), { vy: .35, life: 900, size: 5, c: "#cfe9fa", delay: rnd(0, 160) });
          }
        }, 380);
      },
      /* 金光砖（法宝）：鎏金重击——金光一闪、千钧坠地（动漫：金光砖当头砸落） */
      jinguang_zhuan(F, from, to) {
        if (!to) return;
        F.flash("#ffe9ad", 90, .3);
        F.trail({ x: to.x + rnd(-20, 20), y: -14 }, to, { elem: "jin", size: 5.4, flyMs: 200, gap: 9 });
        setTimeout(() => {
          F.burst(to.x, to.y, "jin", 26, { power: 5.4 });
          F.ring(to.x, to.y, { c: "#ffd970", vr: 4.6, life: 380, lw: 3.4 });
          F.shake(9);
          F.flash("#ffe9ad", 130, .34);
        }, 210);
      },
      jinguang_zhuan_charge(F, from, to) { F.RECIPES.jinguang_zhuan(F, from, to); },
      /* 定身符：金箓飞贴→锁环定身（控制感：环收紧而非爆开） */
      dingshen_fu(F, from, to) {
        if (!to) return;
        F.trail(from, to, { elem: "jin", size: 3, flyMs: 240, gap: 16 });
        setTimeout(() => {
          F._push({ ringFx: true, x: to.x, y: to.y - 6, r: 46, vr: -2.6, life: 520, t: 0, c: "#ffd970", lw: 3 });
          F._push({ ringFx: true, x: to.x, y: to.y - 6, r: 34, vr: -1.8, life: 520, t: 0, c: "#fff1c0", lw: 1.6 });
          F.flash("#ffe9ad", 80, .14);
        }, 250);
        F._run();
      },
      /* 金蚨子母刃（正典：一母八子·青绿冷光小刃）：八道青芒错相分袭——
       * 左右两弧各四道弧线刃光先后掠出，母刃殿后一道粗芒压阵；中的青光迸裂 */
      zimu_ren(F, from, to) {
        if (!to) return;
        for (let i = 0; i < 8; i++) {
          const side = i % 2 ? 1 : -1;
          const off = { x: from.x + side * rnd(6, 18), y: from.y + rnd(-26, 10) };
          setTimeout(() => F.trail(off, { x: to.x + rnd(-8, 8), y: to.y + rnd(-10, 8) },
            { core: "#8df0b2", elem: "mu", size: 2.3, flyMs: 170, gap: 14, fade: 130, curve: side * rnd(14, 34) }), i * 45);
        }
        // 母刃压阵：最后一道粗芒直取要害
        setTimeout(() => F.trail({ x: from.x + 10, y: from.y - 6 }, to,
          { core: "#c8ffd9", elem: "mu", size: 3.6, flyMs: 150, gap: 10, fade: 150 }), 8 * 45 + 30);
        setTimeout(() => {
          F.burst(to.x, to.y, "mu", 16, { power: 3.6 });
          for (let i = 0; i < 10 * F._degraded; i++) {
            F.shard(to.x, to.y, { vx: rnd(-3.4, 3.4), vy: rnd(-4, .5), c: i % 2 ? "#bdf7cf" : "#6fdf9a", size: rnd(2, 4.5), life: 620 });
          }
          F.flash("#bdf7cf", 70, .12);
        }, 8 * 45 + 170);
      },
      /* 暗器飞针：三线银光疾射（细、快、冷） */
      feizhen(F, from, to) {
        if (!to) return;
        for (let i = -1; i <= 1; i++) {
          const off = { x: from.x, y: from.y + i * 7 };
          setTimeout(() => F.trail(off, { x: to.x, y: to.y + i * 5 }, { elem: "none", size: 1.8, flyMs: 150, gap: 22, fade: 150 }), (i + 1) * 40);
        }
        setTimeout(() => F.burst(to.x, to.y, "none", 6, { power: 2.6 }), 240);
      },
      /* 喂毒一击：青紫毒雾洇开 */
      weidu(F, from, to) {
        const p = to || from;
        for (let i = 0; i < 12 * F._degraded; i++) {
          F.mote(p.x + rnd(-14, 14), p.y + rnd(-10, 10), { vy: -.4, life: 800, size: rnd(4, 7), c: i % 2 ? "#9fe07a" : "#7a5fa8", delay: rnd(0, 200) });
        }
        F._run();
      },
      /* 乌龙夺（墨蛟双角炼成·四爪短法宝）：四道墨绿蛟爪扇形分袭连抓→爪痕迸裂＋青紫毒雾洇开（"四爪带毒"的脸） */
      wulong_zhua(F, from, to) {
        if (!to) return;
        for (let i = 0; i < 4; i++) {
          const spread = (i - 1.5) * 12;   // 四爪扇形错落分袭
          setTimeout(() => F.trail(
            { x: from.x + rnd(-6, 10), y: from.y + rnd(-18, 8) },
            { x: to.x + spread, y: to.y + rnd(-10, 8) },
            { core: "#86e6a0", elem: "shui", size: 2.6, flyMs: 150, gap: 12, fade: 130, curve: (i % 2 ? 1 : -1) * rnd(10, 22) }
          ), i * 60);
        }
        setTimeout(() => {
          F.burst(to.x, to.y, "shui", 14, { power: 3.2 });
          // 四道爪痕迸裂的墨绿碎芒
          for (let i = 0; i < 10 * F._degraded; i++) {
            F.shard(to.x, to.y, { vx: rnd(-3.2, 3.2), vy: rnd(-3.6, .6), c: i % 2 ? "#bdeecf" : "#5fae8f", size: rnd(2, 4.2), life: 560 });
          }
          // 爪尖之毒：青紫毒雾洇开（与喂毒同色谱）
          for (let i = 0; i < 10 * F._degraded; i++) {
            F.mote(to.x + rnd(-14, 14), to.y + rnd(-10, 10), { vy: -.4, life: 760, size: rnd(4, 7), c: i % 2 ? "#9fe07a" : "#7a5fa8", delay: rnd(0, 220) });
          }
        }, 4 * 60 + 120);
        F._run();
      },
      /* 长春吐纳/护体：木灵绿芒自下而上回环（生生不息） */
      tuna(F, from) {
        F._emit("back", () => {   // 长春吐纳：木灵绿芒自下而上回环＝身后层（绕身而非贴脸）
          for (let i = 0; i < 14 * F._degraded; i++) {
            const a = rnd(0, TAU);
            F.mote(from.x + Math.cos(a) * rnd(12, 30), from.y + 26, {
              vy: rnd(-1.4, -0.8), wob: 8, life: 900, size: rnd(2.6, 4.2),
              c: i % 3 ? "#9fe3ae" : "#dcffe2", delay: i * 40,
            });
          }
          F._run();
        });
      },
      huti(F, from) {
        F._emit("back", () => {   // 护体：绿环＋吐纳绿芒全在身后层（tuna 内层 _emit 会以 prev 还原）
          F.ring(from.x, from.y - 6, { c: "#7fd99a", vr: 2, life: 600, lw: 2.6 });
          F.RECIPES.tuna(F, from);
        });
      },
      ningshen(F, from) {
        F._emit("back", () => {   // 凝神：灵光向身体内收＝身后层（聚气于身后，不糊脸）
          for (let i = 0; i < 10 * F._degraded; i++) {
            const a = (i / 10) * TAU;
            F.mote(from.x + Math.cos(a) * 40, from.y - 6 + Math.sin(a) * 40, {
              vx: -Math.cos(a) * 1.1, vy: -Math.sin(a) * 1.1, life: 620, size: 3, c: "#cfe3ff", delay: i * 30,
            });
          }
          F._run();
        });
      },
      /* 阵旗：地面灵纹环亮起（铺设感） */
      zhenqi_kunzu(F, from, to) {
        F._emit("back", () => {   // 阵旗地纹：灵纹环在脚下地面＝身后层（铺在地、压在人物身后）
          const p = to || from;
          F.ring(p.x, p.y + 18, { c: "#d9a8ff", vr: 3.2, life: 540, lw: 2.6 });
          F.ring(p.x, p.y + 18, { c: "#a8c8ff", vr: 2.1, life: 700, lw: 1.4 });
          F._run();
        });
      },
      zhenqi_juling(F, from, to) {
        F._emit("back", () => {   // 聚灵地纹：地面绿环＋上浮灵气＝身后层
          const p = to || from;
          F.ring(p.x, p.y + 18, { c: "#9fe3ae", vr: 2.6, life: 620, lw: 2.4 });
          for (let i = 0; i < 8 * F._degraded; i++) {
            F.mote(p.x + rnd(-30, 30), p.y + 16, { vy: -1, life: 800, size: 3, c: "#dcffe2", delay: i * 60 });
          }
          F._run();
        });
      },
      /* 回血/回灵丹药：暖光上浮 */
      huixue_dan(F, from) {
        F._emit("back", () => {   // 丹药暖光上浮＝身后层（自体疗愈光晕，绕身后升腾）
          for (let i = 0; i < 8 * F._degraded; i++) F.mote(from.x + rnd(-12, 12), from.y + rnd(-4, 10), { vy: -1, life: 700, size: 3.4, c: "#ffd9a8", delay: i * 50 });
          F._run();
        });
      },
      huiyuan_dan(F, from) {
        F._emit("back", () => {   // 回灵丹冷光上浮＝身后层
          for (let i = 0; i < 8 * F._degraded; i++) F.mote(from.x + rnd(-12, 12), from.y + rnd(-4, 10), { vy: -1, life: 700, size: 3.4, c: "#a8c8ff", delay: i * 50 });
          F._run();
        });
      },
    },

    /* 配方分发：spellId 优先精确命中；否则按 elem/type 走通用弹道 */
    castSpell(spellId, fromAnchor, toAnchor, sp) {
      if (!this._ctx) return;
      const from = this.at(fromAnchor), to = toAnchor ? this.at(toAnchor) : null;
      if (!from) return;
      const r = this.RECIPES[spellId];
      if (r) { r(this, from, to); return; }
      if (!sp) return;
      if (sp.type === "atk" && to) {
        if (sp.elem === "lei") { this.lightning(to.x, to.y); return; }
        this.trail(from, to, { elem: sp.elem, curve: 24, flyMs: 300 });
        setTimeout(() => this.burst(to.x, to.y, sp.elem, 14), 300);
      } else if (sp.type === "heal" || sp.type === "buff") {
        this.RECIPES.tuna(this, from);
      }
    },

    /* 剑芒束：连续光刃（青元剑诀质感底）——快、直、白炽刃头 */
    _blade(from, to, core, glow) {
      this.ribbon(from, to, { core, glowC: glow, width: 6.5, flyMs: 170, tail: 0.9, hold: 130 });
      this.ribbon(from, { x: to.x, y: to.y - 3 }, { core: "#ffffff", glowC: core, width: 2, flyMs: 170, tail: 0.7, hold: 110 });
    },
    /* 近身斩弧：以命中点为心的短弧光 */
    _slashArc(p, tilt, color) {
      const R = 34;
      for (let i = 0; i <= 14; i++) {
        const t = i / 14;
        const a = tilt + (t - 0.5) * 1.9;
        this.mote(p.x + Math.cos(a) * R, p.y - 6 + Math.sin(a) * R, {
          life: 190, delay: t * 70, size: 4.6 * (1 - Math.abs(t - 0.5)), c: color,
        });
      }
      this._run();
    },

    /* ---------- 主循环 ---------- */
    _run() {
      this._frame(0);   // 立即出第一帧（低帧环境也先见到光）
      if (this._raf) return;
      let last = performance.now();
      const step = (now) => {
        let dt = Math.min(40, now - last); last = now;
        // B3 hit-stop：冻结窗口内强制 dt=0（粒子不推进、不老化＝画面凝住）；last 照常走，解冻即顺滑续帧
        if (this._frozenUntil && now < this._frozenUntil) dt = 0;
        // 性能降档：连续两帧超 34ms → 出粒减半（手机兜底）；回稳则恢复
        // 降档顺序（手机预算）：v112 持续卡顿（连两帧>34ms）先撤泛光（最便宜的纯观感层）并同步减
        // 粒子（v111 填充率第一笔省）→ 仍持续卡顿才把 DPR 降到 1.75（避免特效层比人物"糊一层"）；
        // 任一帧回稳即恢复泛光+出粒并复原 DPR=2。门槛用"连两帧"而非单帧——临界设备(33/35ms 抖动)
        // 每遇一个快帧即清零计数，泛光保持常亮不频闪；只有真·持续慢(每帧都>34)才稳定撤掉。
        if (dt > 34) {
          if (++this._slowFrames >= 2) { this._degraded = 0.5; this._bloom = 0; }
          if (this._slowFrames >= 5) this._dprCap = 1.75;
        } else if (this._slowFrames) {
          this._slowFrames = 0; this._bloom = this._bloomCap; this._degraded = Math.min(1, this._degraded + 0.1); this._dprCap = 2;
        }
        if (!this._frame(dt)) { this._raf = 0; return; }
        this._raf = requestAnimationFrame(step);
      };
      this._raf = requestAnimationFrame(step);
    },
    _frame(dt) {
      const ctxF = this._ctx, ctxB = this._ctxBack;
      // 无任何实体且未开氛围发射器 → 收循环（开了 _amb 则保活并续粒）
      if (!ctxF || (!this._amb && !this._parts.length && !this._bolts.length && !this._strokes.length && !this._swords.length && !this._arcs.length)) {
        if (ctxF && this._cv) ctxF.clearRect(0, 0, this._cv.width, this._cv.height);
        if (ctxB && this._cvBack) ctxB.clearRect(0, 0, this._cvBack.width, this._cvBack.height);
        return false;
      }
      this._fit();
      if (this._amb && dt > 0) this._ambientTick(dt);   // B2：续发常驻氛围粒（在 _fit 后，本帧即绘）；hit-stop 冻结帧(dt=0)不出粒
      const dpr = this._dpr, glow = this._glow;
      // v111：两层各自重置坐标系并清屏（lighter 混合）；按实体 _layer 路由到身后/身前
      for (const c of [ctxB, ctxF]) {
        if (!c) continue;
        c.setTransform(dpr, 0, 0, dpr, 0, 0);
        c.clearRect(0, 0, this._w, this._h);
        c.globalCompositeOperation = "lighter";
      }
      // 身后层(z:1)画在人物之后；无标记/标记 front 的实体走身前层(z:26)
      const pick = e => (e && e._layer === "back" && ctxB) ? ctxB : ctxF;

      // 连续光带（draw-on：头部推进、尾部熄灭、到点后短驻再散）
      this._strokes = this._strokes.filter(s => (s.t += dt) < s.flyMs + s.hold + 240);
      for (const s of this._strokes) {
        const ctx = pick(s);
        const n = s.pts.length - 1;
        const prog = Math.min(1, s.t / s.flyMs);
        const head = Math.max(1, Math.round(prog * n));
        const tailLen = Math.max(2, Math.round(s.tail * n));
        const post = Math.max(0, s.t - s.flyMs);
        let alpha = post > s.hold ? Math.max(0, 1 - (post - s.hold) / 240) : 1;
        let tail0 = head - tailLen;
        if (post > 0) tail0 = Math.max(tail0, Math.round(n - tailLen * (1 - post / (s.hold + 240))));
        tail0 = Math.max(0, tail0);
        if (head <= tail0 || alpha <= 0) continue;
        ctx.lineCap = "round"; ctx.lineJoin = "round";
        const path = () => {
          ctx.beginPath();
          ctx.moveTo(s.pts[tail0][0], s.pts[tail0][1]);
          for (let i = tail0 + 1; i <= head; i++) ctx.lineTo(s.pts[i][0], s.pts[i][1]);
        };
        path(); ctx.strokeStyle = s.glowC; ctx.globalAlpha = .3 * alpha; ctx.lineWidth = s.w * 2.8; ctx.stroke();
        path(); ctx.strokeStyle = s.core; ctx.globalAlpha = .9 * alpha; ctx.lineWidth = s.w; ctx.stroke();
        // 白炽头部
        const hp = s.pts[head];
        ctx.fillStyle = "#fff"; ctx.globalAlpha = .95 * alpha;
        ctx.beginPath(); ctx.arc(hp[0], hp[1], s.w * 0.9, 0, TAU); ctx.fill();
        if (glow) { const gs = s.w * 5; ctx.globalAlpha = .5 * alpha; ctx.drawImage(glow, hp[0] - gs / 2, hp[1] - gs / 2, gs, gs); }
        ctx.globalAlpha = 1;
      }

      // 飞剑环阵（青竹云剑绕身：椭圆透视轨道+剑身缠金雷）
      this._swords = this._swords.filter(s => (s.t += dt) < s.life);
      for (const s of this._swords) {
        const ctx = pick(s);
        const introK = Math.min(1, s.t / s.intro);
        const outK = s.t > s.life - s.outro ? Math.max(0, (s.life - s.t) / s.outro) : 1;
        const alpha = introK * outK;
        const rr = s.r * (0.4 + 0.6 * introK);          // 剑阵自内向外张开
        const base = s.t * s.spin;
        const pos = [];
        for (let i = 0; i < s.n; i++) {
          const a = base + (i / s.n) * TAU;
          const x = s.cx + Math.cos(a) * rr;
          const y = s.cy + Math.sin(a) * rr * 0.5;       // 0.5=斜侧椭圆（透视绕身）
          const depth = 0.55 + 0.45 * ((1 - Math.cos(a)) / 2);   // problem 3：左前(亮)右后(暗)——纵深锚定水平方向
          this._drawSword(ctx, x, y, a + Math.PI / 2, s.len, s.blade, s.core, alpha * depth);
          pos.push([x, y]);
        }
        // 剑身缠金雷：偶发相邻剑间金弧
        if (s.lei && Math.random() < 0.5 * (dt / 16)) {
          const i = Math.floor(Math.random() * s.n);
          const p0 = pos[i], p1 = pos[(i + 1) % s.n];
          this.arc(p0[0], p0[1], p1[0], p1[1]);
        }
      }
      // 短金弧
      this._arcs = this._arcs.filter(a => (a.t += dt) < a.life);
      for (const a of this._arcs) {
        const ctx = pick(a);
        const k = 1 - a.t / a.life;
        ctx.lineCap = "round"; ctx.lineJoin = "round";
        ctx.strokeStyle = `rgba(${a.c},${(.9 * k).toFixed(3)})`; ctx.lineWidth = a.w;
        ctx.beginPath(); ctx.moveTo(a.pts[0][0], a.pts[0][1]);
        for (let i = 1; i < a.pts.length; i++) ctx.lineTo(a.pts[i][0], a.pts[i][1]);
        ctx.stroke();
      }

      // 闪电折线
      this._bolts = this._bolts.filter(b => (b.t += dt) < b.life);
      for (const b of this._bolts) {
        const ctx = pick(b);
        const k = 1 - b.t / b.life;
        const flick = (Math.sin(b.t * 0.09) + 1.6) / 2.6;
        const draw = (pts, w) => {
          ctx.beginPath();
          ctx.moveTo(pts[0][0], pts[0][1]);
          for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
          ctx.lineWidth = w; ctx.stroke();
        };
        ctx.lineCap = "round"; ctx.lineJoin = "round";
        const bc = b.bolt || ["122,168,255", "170,205,255", "244,250,255"];
        ctx.strokeStyle = `rgba(${bc[0]},${(.28 * k * flick).toFixed(3)})`; draw(b.pts, b.w * 6);
        ctx.strokeStyle = `rgba(${bc[1]},${(.5 * k * flick).toFixed(3)})`; draw(b.pts, b.w * 2.4);
        ctx.strokeStyle = `rgba(${bc[2]},${(.95 * k * flick).toFixed(3)})`; draw(b.pts, b.w);
        for (const br of b.branches) {
          ctx.strokeStyle = `rgba(${bc[1]},${(.55 * k * flick).toFixed(3)})`; draw(br, b.w * 0.6);
        }
      }

      // 粒子
      this._parts = this._parts.filter(p => (p.t += dt) < p.life);
      for (const p of this._parts) {
        const ctx = pick(p);
        if (p.t < 0) continue;
        if (p.beam) {
          // B2 光束：软竖向渐变带缓扫，屏缘淡入淡出（lighter 加亮＝暗场里的一束光）
          const bx = p.x, bw = p.bw, W2 = this._w, H2 = this._h;
          const ef = Math.max(0, Math.min(1, Math.min((bx + bw) / (bw * 2), (W2 - bx + bw) / (bw * 2))));
          const a = p.baseA * ef;
          if (a > 0.004) {
            const [r, g0, b0] = p.rgb;
            const grd = ctx.createLinearGradient(bx - bw, 0, bx + bw, 0);
            grd.addColorStop(0, `rgba(${r},${g0},${b0},0)`);
            grd.addColorStop(0.5, `rgba(${r},${g0},${b0},${a.toFixed(3)})`);
            grd.addColorStop(1, `rgba(${r},${g0},${b0},0)`);
            ctx.globalAlpha = 1; ctx.fillStyle = grd;
            ctx.fillRect(bx - bw, 0, bw * 2, H2);
          }
          continue;
        }
        const k = 1 - p.t / p.life;
        if (p.rect) {
          // 全屏调色闪光：始终走身前层（盖全画面，不能只染背景）
          ctxF.globalCompositeOperation = "source-over";
          ctxF.globalAlpha = (p.a != null ? p.a : .5) * k;
          ctxF.fillStyle = p.c;
          ctxF.fillRect(0, 0, this._w, this._h);
          ctxF.globalAlpha = 1;
          ctxF.globalCompositeOperation = "lighter";
          continue;
        }
        if (p.ringFx) {
          p.r = Math.max(2, p.r + p.vr * (dt / 16));
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, TAU);
          ctx.strokeStyle = p.c;
          ctx.globalAlpha = .85 * k;
          ctx.lineWidth = p.lw * k + .5;
          ctx.stroke();
          ctx.globalAlpha = 1;
          continue;
        }
        const f = dt / 16;
        p.x += (p.vx || 0) * f; p.y += (p.vy || 0) * f;
        if (p.g) p.vy += p.g * f;
        if (p.drag) { p.vx *= (1 - p.drag * f); p.vy *= (1 - p.drag * f); }
        if (p.wob) { p.wobT += 0.08 * f; p.x += Math.sin(p.wobT) * p.wob * 0.06; }
        ctx.globalAlpha = Math.max(0, Math.min(1, k * 1.1));
        if (p.streak) {
          ctx.strokeStyle = p.c;
          ctx.lineWidth = p.size * k + .4;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - (p.vx || 0) * 2.6, p.y - (p.vy || 0) * 2.6);
          ctx.stroke();
        } else if (p.poly) {
          p.rot += p.vr * f;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillStyle = p.c;
          ctx.beginPath();
          ctx.moveTo(p.size * k, 0);
          ctx.lineTo(0, -p.size * k * 0.5);
          ctx.lineTo(-p.size * k * 0.8, 0);
          ctx.lineTo(0, p.size * k * 0.6);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        } else if (p.glow && glow) {
          const s = p.size * (0.7 + 0.5 * k) * 2.2;
          // 染色：先画色块圆芯，再叠白光斑（lighter 混成软辉光）
          ctx.fillStyle = p.c;
          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.max(.4, p.size * k * 0.62), 0, TAU);
          ctx.fill();
          ctx.globalAlpha *= 0.5;
          ctx.drawImage(glow, p.x - s / 2, p.y - s / 2, s, s);
        } else {
          ctx.fillStyle = p.c;
          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.max(.4, p.size * k), 0, TAU);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
      this._bloomPass();
      return true;
    },

    /* 柔光泛光（v112）：离屏降采样＋双线性放大叠回，近似高斯泛光（严守禁 shadowBlur 红线）。
     * 只对特效两层做——人物/背景是 DOM，不被它糊；身后层泛光从人物身后柔柔漫出＝随特效色的受光晕。
     * 卡顿任一帧 _bloom 置 0 即整体跳过（最先被舍弃的纯观感层），回稳复原。 */
    _bloomPass() {
      if (!this._bloom) return;
      for (const cv of [this._cvBack, this._cv]) {
        if (!cv || !cv.width || !cv.height) continue;
        const w = cv.width, h = cv.height;
        const sw = Math.max(1, w >> 2), sh = Math.max(1, h >> 2);     // 1/4 尺寸
        const sw2 = Math.max(1, sw >> 1), sh2 = Math.max(1, sh >> 1); // 1/8 尺寸（更宽的晕）
        let a = this._bxa, b = this._bxb;
        if (!a) a = this._bxa = document.createElement("canvas");
        if (!b) b = this._bxb = document.createElement("canvas");
        if (a.width !== sw || a.height !== sh) { a.width = sw; a.height = sh; }
        if (b.width !== sw2 || b.height !== sh2) { b.width = sw2; b.height = sh2; }
        const actx = a.getContext("2d"), bctx = b.getContext("2d");
        actx.imageSmoothingEnabled = true; bctx.imageSmoothingEnabled = true;
        // 降采样：全层→a(1/4)→b(1/8)，drawImage 缩小即盒式预滤波
        actx.globalCompositeOperation = "copy"; actx.globalAlpha = 1;
        actx.drawImage(cv, 0, 0, sw, sh);
        bctx.globalCompositeOperation = "copy"; bctx.globalAlpha = 1;
        bctx.drawImage(a, 0, 0, sw2, sh2);
        // 放大叠回本层（lighter 加亮＝泛光）：b 宽晕打底、a 紧芯晕收口
        const ctx = (cv === this._cv) ? this._ctx : this._ctxBack;
        ctx.setTransform(1, 0, 0, 1, 0, 0);   // 用画布像素坐标，避开 dpr 变换
        ctx.imageSmoothingEnabled = true;
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = 0.34; ctx.drawImage(b, 0, 0, w, h);
        ctx.globalAlpha = 0.30; ctx.drawImage(a, 0, 0, w, h);
        ctx.globalAlpha = 1;
      }
    },

    clear() {
      this._amb = null; this._ambAcc = 0; this._ambFlag = false;   // B2：收氛围发射器
      this._frozenUntil = 0; clearTimeout(this._hsTimer);          // B3：解冻 hit-stop
      if (this._host && this._host.classList) this._host.classList.remove("fx-hitstop");
      this._parts.length = 0; this._bolts.length = 0; this._strokes.length = 0;
      this._swords.length = 0; this._arcs.length = 0;
      if (this._ctx && this._cv) this._ctx.clearRect(0, 0, this._cv.width, this._cv.height);
      if (this._ctxBack && this._cvBack) this._ctxBack.clearRect(0, 0, this._cvBack.width, this._cvBack.height);
    },
  };

  window.Fx = Fx;
})();
