/* ============================================================
 * audio.js — 音频层：Web Audio 合成音效（零资源依赖）+ BGM 接口
 *
 * 审美基调（见 docs/art-direction.md）：玉磬、翻纸、剑鸣、古钟——
 * 一切音效克制、短促、低音量，是"气口"不是"轰炸"。
 *  - Sfx.play(name)：合成音效（静音开关持久化）
 *  - Sfx.playBgm(url) / stopBgm()：背景乐接口（资源后补，缺省静默）
 * ============================================================ */
(function (root) {
  const KEY = "frxxz_sound_v1";
  let ctx = null;
  let muted = false;
  try { muted = localStorage.getItem(KEY) === "off"; } catch (e) {}

  function ac() {
    if (!ctx) {
      const AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  // —— 合成原语 ——
  function tone(c, { freq = 440, type = "sine", dur = 0.3, gain = 0.07, decay = true, slideTo = null, delay = 0 }) {
    const o = c.createOscillator(), g = c.createGain();
    const t0 = c.currentTime + delay;
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(gain, t0);
    if (decay) g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
    o.connect(g); g.connect(c.destination);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }
  function noise(c, { dur = 0.15, gain = 0.05, band = null, low = null, delay = 0 }) {
    const t0 = c.currentTime + delay;
    const len = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource(); src.buffer = buf;
    let node = src;
    if (band) { const f = c.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = band; f.Q.value = 1.1; node.connect(f); node = f; }
    if (low) { const f = c.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = low; node.connect(f); node = f; }
    const g = c.createGain(); g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
    node.connect(g); g.connect(c.destination);
    src.start(t0);
  }

  // —— 音色配方 ——
  const RECIPES = {
    // 玉磬轻击：通用点击
    click(c) { tone(c, { freq: 1560, dur: 0.09, gain: 0.035 }); tone(c, { freq: 3120, dur: 0.05, gain: 0.012 }); },
    // 翻纸：剧情推进
    page(c) { noise(c, { dur: 0.1, gain: 0.028, band: 1500 }); },
    // 入戏磬：题字卡
    chime(c) { tone(c, { freq: 988, dur: 1.0, gain: 0.05 }); tone(c, { freq: 1481, dur: 0.8, gain: 0.022, delay: 0.02 }); },
    // 剑鸣：攻击
    sword(c) { tone(c, { freq: 760, slideTo: 2300, type: "sawtooth", dur: 0.12, gain: 0.03 }); noise(c, { dur: 0.1, gain: 0.022, band: 3400 }); },
    // 钝击：受创
    hit(c) { tone(c, { freq: 170, slideTo: 58, dur: 0.16, gain: 0.085 }); noise(c, { dur: 0.1, gain: 0.04, low: 320 }); },
    // 柔和回春：治疗
    heal(c) { tone(c, { freq: 523, dur: 0.36, gain: 0.034 }); tone(c, { freq: 784, dur: 0.42, gain: 0.026, delay: 0.07 }); },
    // 护体低鸣
    shield(c) { tone(c, { freq: 196, type: "triangle", dur: 0.28, gain: 0.05 }); tone(c, { freq: 294, type: "triangle", dur: 0.22, gain: 0.025, delay: 0.03 }); },
    // 战起低鼓
    danger(c) { tone(c, { freq: 62, dur: 0.4, gain: 0.1 }); noise(c, { dur: 0.3, gain: 0.05, low: 130 }); },
    // 古钟：突破成功
    bell(c) {
      tone(c, { freq: 392, dur: 2.2, gain: 0.085 });
      tone(c, { freq: 392 * 2.76, dur: 1.4, gain: 0.03, delay: 0.01 });
      tone(c, { freq: 392 * 4.07, dur: 0.9, gain: 0.016, delay: 0.02 });
    },
    // 得益三音
    success(c) { [523, 659, 784].forEach((f, i) => tone(c, { freq: f, dur: 0.22, gain: 0.04, delay: i * 0.085 })); },
    // 失利沉音
    fail(c) { tone(c, { freq: 220, slideTo: 104, dur: 0.5, gain: 0.06 }); },
    // 采得/拾取
    pick(c) { tone(c, { freq: 1175, dur: 0.1, gain: 0.035 }); tone(c, { freq: 1568, dur: 0.12, gain: 0.025, delay: 0.06 }); },
    // 打字机轻嗒（对话逐字，极轻——气口不是轰炸）
    type(c) { noise(c, { dur: 0.025, gain: 0.012, band: 2600 }); },
    // —— 远声（声纹梯度：离战团越近听得越真——音量刻意极低，是"远方"不是"耳边"）——
    // 远方妖吼：低频下滑长音 + 闷雷噪
    farRoar(c) {
      tone(c, { freq: 92, slideTo: 48, type: "sawtooth", dur: 1.1, gain: 0.022 });
      noise(c, { dur: 0.9, gain: 0.014, low: 190, delay: 0.08 });
    },
    // 天雷劈落：高频炸裂 + 低频滚雷尾（fx.js 闪电配套）
    thunder(c) {
      noise(c, { dur: 0.16, gain: 0.06, low: 2400 });
      tone(c, { freq: 1900, slideTo: 220, type: "sawtooth", dur: 0.22, gain: 0.03 });
      noise(c, { dur: 1.2, gain: 0.028, low: 140, delay: 0.1 });
      tone(c, { freq: 64, slideTo: 38, type: "sine", dur: 1.1, gain: 0.03, delay: 0.12 });
    },
    // 远方斗法：绫帛破空的细啸 + 法器轻鸣（隐约金石声）
    farClash(c) {
      tone(c, { freq: 1860, slideTo: 2600, dur: 0.34, gain: 0.008 });
      tone(c, { freq: 1244, dur: 0.5, gain: 0.011, delay: 0.22 });
      noise(c, { dur: 0.28, gain: 0.007, band: 3000, delay: 0.06 });
    },

    /* ===== 战斗音效全套（tactics T7：行属分系+战术事件——14PM 预算放开，
     * 每记都要"有形"：金石有锋、火有轰势、冰有脆裂、背袭有寒意） ===== */
    // 金：金石锐鸣——法器破空带金属泛音（金光砖/子母刃）
    castJin(c) {
      tone(c, { freq: 1320, slideTo: 2800, type: "sawtooth", dur: 0.14, gain: 0.034 });
      tone(c, { freq: 2640, dur: 0.18, gain: 0.018, delay: 0.03 });
      noise(c, { dur: 0.1, gain: 0.02, band: 4200, delay: 0.02 });
    },
    // 木：剑芒破空——嗖鸣上扬+叶簌尾（青元剑芒）
    castMu(c) {
      tone(c, { freq: 880, slideTo: 2400, type: "triangle", dur: 0.16, gain: 0.032 });
      noise(c, { dur: 0.14, gain: 0.022, band: 3000, delay: 0.02 });
      tone(c, { freq: 1760, dur: 0.1, gain: 0.012, delay: 0.08 });
    },
    // 水/冰：晶澈滑音+冰晶碎裂尾（寒冰符）
    castShui(c) {
      tone(c, { freq: 2200, slideTo: 980, type: "sine", dur: 0.22, gain: 0.028 });
      noise(c, { dur: 0.12, gain: 0.018, band: 5200, delay: 0.1 });
      tone(c, { freq: 3300, dur: 0.08, gain: 0.011, delay: 0.13 });
    },
    // 火：轰燃低吼+噼啪火星（火蛇符/火弹术）
    castHuo(c) {
      tone(c, { freq: 130, slideTo: 62, type: "sawtooth", dur: 0.3, gain: 0.05 });
      noise(c, { dur: 0.26, gain: 0.034, low: 900 });
      noise(c, { dur: 0.08, gain: 0.018, band: 2600, delay: 0.12 });
    },
    // 土：闷沉砸落——大地的分量（金光砖砸地/土系重击）
    castTu(c) {
      tone(c, { freq: 96, slideTo: 44, type: "triangle", dur: 0.26, gain: 0.06 });
      noise(c, { dur: 0.2, gain: 0.04, low: 260 });
    },
    // 贴身爪弧/拳风：短促破风+肉感收尾
    meleeWhoosh(c) {
      noise(c, { dur: 0.1, gain: 0.036, band: 1700 });
      tone(c, { freq: 420, slideTo: 180, dur: 0.08, gain: 0.022, delay: 0.04 });
    },
    // 背袭：逆刃寒光——高频咔+低闷心跳停顿（死角的寒意）
    backstab(c) {
      noise(c, { dur: 0.05, gain: 0.04, band: 5600 });
      tone(c, { freq: 2900, slideTo: 480, type: "sawtooth", dur: 0.1, gain: 0.03, delay: 0.02 });
      tone(c, { freq: 72, dur: 0.14, gain: 0.07, delay: 0.1 });
      tone(c, { freq: 60, dur: 0.2, gain: 0.05, delay: 0.3 });
    },
    // 重创（断尾/毁器）：骨裂咔嚓——三层短噪错拍+低锤定音
    maim(c) {
      noise(c, { dur: 0.05, gain: 0.05, band: 2400 });
      noise(c, { dur: 0.06, gain: 0.045, band: 1600, delay: 0.05 });
      noise(c, { dur: 0.08, gain: 0.04, band: 900, delay: 0.11 });
      tone(c, { freq: 88, slideTo: 40, dur: 0.3, gain: 0.08, delay: 0.13 });
    },
    // 暴击：重锤+金芒铃（在 hit 之上叠威）
    crit(c) {
      tone(c, { freq: 150, slideTo: 46, dur: 0.2, gain: 0.1 });
      noise(c, { dur: 0.14, gain: 0.05, low: 420 });
      tone(c, { freq: 2093, dur: 0.16, gain: 0.022, delay: 0.04 });
    },
    // 挥空/闪避：纯破风，无命中感（落空的失重）
    whiff(c) { noise(c, { dur: 0.16, gain: 0.026, band: 1300 }); },
    // 升空：风啸上扬+遁光轻鸣
    flyUp(c) {
      noise(c, { dur: 0.3, gain: 0.026, band: 2200 });
      tone(c, { freq: 520, slideTo: 1560, type: "sine", dur: 0.34, gain: 0.024 });
    },
    // 落地/击落：坠势+尘土闷震
    landDown(c) {
      tone(c, { freq: 980, slideTo: 140, type: "sine", dur: 0.18, gain: 0.022 });
      tone(c, { freq: 110, slideTo: 50, dur: 0.2, gain: 0.07, delay: 0.14 });
      noise(c, { dur: 0.18, gain: 0.04, low: 300, delay: 0.14 });
    },
    // 殒命：低沉一声+气息消散
    die(c) {
      tone(c, { freq: 196, slideTo: 70, dur: 0.5, gain: 0.05 });
      noise(c, { dur: 0.5, gain: 0.02, low: 600, delay: 0.1 });
    },
    // 应雷·群剑共鸣：神雷附剑施放——通电涌动(低频上涌+电滋) + 群剑齐应雷而吟(高频金属泛音叠)
    leiCharge(c) {
      tone(c, { freq: 80, slideTo: 340, type: "sawtooth", dur: 0.42, gain: 0.042 });   // 通电低涌
      noise(c, { dur: 0.34, gain: 0.03, band: 3600 });                                  // 电流滋滋
      tone(c, { freq: 1320, slideTo: 1980, type: "triangle", dur: 0.5, gain: 0.024, delay: 0.05 });  // 剑吟主
      tone(c, { freq: 1760, dur: 0.56, gain: 0.015, delay: 0.09 });                     // 剑吟泛音
      tone(c, { freq: 2640, dur: 0.4, gain: 0.009, delay: 0.13 });                      // 剑吟高泛
    },
    // 飞剑出袭破空：群剑掠空的锐啸——高频噪扫 + 下滑嗖鸣
    swordWhoosh(c) {
      noise(c, { dur: 0.18, gain: 0.03, band: 4200 });
      tone(c, { freq: 2400, slideTo: 620, type: "sawtooth", dur: 0.16, gain: 0.02 });
    },
    // 剑影分光术：群剑分影破空（青元剑诀七层·形A分影多段）——三道错拍掠空 + 群剑共鸣的细吟尾
    swordSplit(c) {
      [0, 0.07, 0.14].forEach((d, i) => {
        noise(c, { dur: 0.14, gain: 0.024 - i * 0.004, band: 4200 - i * 500, delay: d });
        tone(c, { freq: 2500 - i * 280, slideTo: 640 - i * 80, type: "sawtooth", dur: 0.15, gain: 0.018, delay: d });
      });
      tone(c, { freq: 1568, type: "triangle", dur: 0.4, gain: 0.012, delay: 0.1 });   // 群剑共鸣·细吟
      tone(c, { freq: 2352, dur: 0.3, gain: 0.007, delay: 0.16 });                     // 高泛音
    },
  };

  let lastPlay = {};
  let bgmEl = null;

  /* ============ 合成 BGM 引擎 v1（零资源，程序化生成）============
   * 气质：苍凉、孤寂、克制（夜读残卷）。三轨：
   *   daily  日常——宫调五声慢琶音 + 极低音持续（古琴独坐感）
   *   combat 战斗——低鼓律动 + 五声短音急奏
   *   tense  紧张——低频 drone + 半音摩擦长音（决战/心魔）
   * 实现：节拍调度器（lookahead 250ms），音量极低，可随 Sfx 总开关静音。 */
  const PENTA = [261.63, 293.66, 329.63, 392.0, 440.0];   // C宫五声：宫商角徵羽
  const BGM = {
    track: null, _timer: null, _master: null,
    _gain(c) {
      if (!this._master) { this._master = c.createGain(); this._master.gain.value = 1; this._master.connect(c.destination); }
      return this._master;
    },
    _note(c, freq, dur, gain, type = "sine", delay = 0) {
      const o = c.createOscillator(), g = c.createGain();
      const t0 = c.currentTime + delay;
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(gain, t0 + 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(this._gain(c));
      o.start(t0); o.stop(t0 + dur + 0.05);
    },
    start(track) {
      if (this.track === track) return;
      this.stop();
      this.track = track;
      if (muted) return;   // 静音时只记轨名，解除静音后恢复
      const c = ac(); if (!c) return;
      let beat = 0;
      const step = () => {
        if (muted || this.track !== track) return;
        const cc = ac(); if (!cc) return;
        if (track === "daily") {
          // 极低音持续（每8拍一沉）+ 五声慢琶音（散拍，似有似无）
          if (beat % 8 === 0) this._note(cc, 65.41, 3.2, 0.018, "triangle");
          if (Math.random() < 0.55) {
            const f = PENTA[Math.floor(Math.random() * PENTA.length)];
            this._note(cc, f, 1.9, 0.013, "sine", Math.random() * 0.4);
            if (Math.random() < 0.3) this._note(cc, f * 2, 1.2, 0.005, "sine", 0.12); // 泛音
          }
        } else if (track === "combat") {
          if (beat % 2 === 0) this._note(cc, 58, 0.22, 0.05, "sine");           // 鼓
          if (beat % 8 === 6) this._note(cc, 49, 0.3, 0.04, "sine");            // 重拍
          if (Math.random() < 0.5) {
            const f = PENTA[Math.floor(Math.random() * PENTA.length)] * (Math.random() < 0.3 ? 2 : 1);
            this._note(cc, f, 0.16, 0.012, "triangle");
          }
        } else if (track === "tense") {
          if (beat % 8 === 0) this._note(cc, 55, 4.2, 0.022, "sawtooth");
          if (beat % 8 === 4) this._note(cc, 58.27, 3.6, 0.014, "sawtooth");    // 半音摩擦
          if (beat % 16 === 12) this._note(cc, 220, 1.8, 0.008, "sine");
        }
        beat++;
      };
      step();
      this._timer = setInterval(step, track === "combat" ? 250 : 480);
    },
    stop() {
      if (this._timer) { clearInterval(this._timer); this._timer = null; }
      this.track = null;
    },
    resume() { const t = this.track; this.track = null; if (t) this.start(t); },
  };

  /* ============ BGM 文件轨（Lyria 生成，assets/audio/bgm_<track>.mp3）============
   * 九轨（参考动画配乐气质）：daily 药庐古琴 / town 市井琵琶 / journey 行旅笛弦 /
   * fair 集市筝铃 / combat 战鼓急弦 / boss 太鼓号角 / tense 阴冷悬疑 /
   * sorrow 二胡离殇 / triumph 钟磬凯旋（单次不循环）。
   * 文件缺失/加载失败 → 回退合成轨（FALLBACK 映射）。 */
  const BGM_FILES = ["daily", "town", "journey", "fair", "combat", "combat_wild", "combat_secret", "boss", "tense", "sorrow", "triumph"];
  const FALLBACK = { town: "daily", journey: "daily", fair: "daily", combat_wild: "combat", combat_secret: "combat", boss: "combat", sorrow: "tense", triumph: null };
  let curTrack = null;

  // 渐变某 <audio> 的音量到目标值（切轨 crossfade 用）：定步进，结束回调收尾
  function fadeVol(el, to, ms, onDone) {
    if (!el) { if (onDone) onDone(); return; }
    try { if (el._fadeTimer) { clearInterval(el._fadeTimer); el._fadeTimer = null; } } catch (e) {}
    const from = typeof el.volume === "number" ? el.volume : 0;
    const steps = Math.max(1, Math.round(ms / 40));
    let i = 0;
    el._fadeTimer = setInterval(() => {
      i++;
      const v = from + (to - from) * (i / steps);
      try { el.volume = Math.max(0, Math.min(1, v)); } catch (e) {}
      if (i >= steps) { clearInterval(el._fadeTimer); el._fadeTimer = null; if (onDone) onDone(); }
    }, 40);
  }

  // 文件 BGM 默认音量（源已 -20 LUFS 归一，故不必高；克制基调，降「吵闹」）
  const BGM_VOL = 0.26;

  // 循环交叉淡化：循环轨结尾 ~lxf 与开头交叉，消除 <audio>.loop 硬跳回开头的接缝突兀。
  // 自管循环（loop=false）：临近结尾时启同轨新实例淡入、旧实例淡出，无缝衔接。
  function clearLoop(el) { try { if (el && el._loopTimer) { clearInterval(el._loopTimer); el._loopTimer = null; } } catch (e) {} }
  function startLoopXfade(el, track, target, lxf) {
    clearLoop(el);
    const xfSec = lxf / 1000;
    el._loopTimer = setInterval(() => {
      try {
        if (bgmEl !== el) { clearLoop(el); return; }   // 已换轨/被接管：停表
        if (muted || el._handoff) return;               // 静音 / 本轮已交叉：不推进
        const dur = el.duration;
        if (!dur || !isFinite(dur) || dur <= xfSec * 2) return;
        if (el.currentTime >= dur - xfSec) {
          el._handoff = true;
          const nb = new window.Audio(el._src);
          nb._src = el._src; nb.onerror = el.onerror;
          bgmEl = nb;                                   // 新实例接管为当前轨
          setupLoopEl(nb, track, target, lxf);          // 链上下一轮（含兜底）
          nb.volume = 0; nb.play().catch(() => {});
          fadeVol(nb, target, lxf);                     // 新实例淡入
          fadeVol(el, 0, lxf, () => { try { el.pause(); } catch (e) {} });   // 旧实例淡出收声
          clearLoop(el);
        }
      } catch (e) { clearLoop(el); }
    }, 60);
  }
  // 给循环文件轨挂：loop=false（自管）+ onended 兜底（交叉没接上时硬重启不留静音）+ 循环监视
  function setupLoopEl(el, track, target, lxf) {
    el.loop = false;
    el._handoff = false;
    el.onended = () => {
      if (bgmEl !== el || el._handoff) return;
      try { el.currentTime = 0; el.volume = muted ? 0 : target; if (!muted) el.play().catch(() => {}); } catch (e) {}
      startLoopXfade(el, track, target, lxf);
    };
    startLoopXfade(el, track, target, lxf);
  }

  const Sfx = {
    enabled() { return !muted; },
    toggle() {
      muted = !muted;
      try { localStorage.setItem(KEY, muted ? "off" : "on"); } catch (e) {}
      if (muted && bgmEl) { bgmEl.pause(); }
      if (!muted && bgmEl) { bgmEl.play().catch(() => {}); }
      if (muted) { const t = BGM.track; BGM.stop(); BGM.track = t; }   // 记轨停声
      else if (bgmEl == null) BGM.resume();
      return !muted;
    },
    play(name) {
      if (muted || !RECIPES[name]) return;
      const now = Date.now();
      if (lastPlay[name] && now - lastPlay[name] < 70) return;   // 同音去抖
      lastPlay[name] = now;
      try { const c = ac(); if (c) RECIPES[name](c); } catch (e) {}
    },
    // 主入口：换 BGM 轨（文件优先，合成兜底；同轨幂等；切轨 ~600ms crossfade）
    bgm(track, opts = {}) {
      if (curTrack === track && !opts.force) return;
      curTrack = track;
      const xf = opts.fade != null ? opts.fade : 600;   // 交叉淡化时长（ms）
      if (BGM_FILES.includes(track)) {
        const url = `assets/audio/bgm_${track}.mp3`;
        try {
          BGM.stop();   // 合成轨让位（合成轨无淡出，直接停）
          const target = opts.vol != null ? opts.vol : BGM_VOL;
          const lxf = opts.loopFade != null ? opts.loopFade : 1100;   // 循环交叉时长（ms）
          const prev = bgmEl;   // 旧文件轨：淡出
          if (prev) { prev._handoff = true; clearLoop(prev); }        // 旧轨停循环监视，免淡出途中误重启
          const el = new window.Audio(url);
          el._src = url; el.volume = 0;
          el.onerror = () => {   // 文件缺失：回退合成
            if (bgmEl === el) bgmEl = null;
            const fb = FALLBACK[track] !== undefined ? FALLBACK[track] : track;
            if (fb) try { BGM.start(fb); } catch (e) {}
          };
          bgmEl = el;
          if (track === "triumph") {   // 凯旋单次不循环
            el.loop = false;
            el.onended = () => { if (bgmEl === el) { bgmEl = null; curTrack = null; } };
          } else {
            setupLoopEl(el, track, target, lxf);   // 循环交叉淡化（消接缝突兀）
          }
          if (muted) {   // 静音：记轨不出声，音量预置好，解除静音由 toggle 起播
            el.volume = target;
            if (prev && prev !== el) { try { prev.pause(); } catch (e) {} }
            return;
          }
          el.play().catch(() => {});
          fadeVol(el, target, xf);                                         // 新轨淡入
          if (prev && prev !== el) fadeVol(prev, 0, xf, () => { try { prev.pause(); } catch (e) {} });  // 旧轨淡出
          return;
        } catch (e) {}
      }
      // 非文件轨：淡出旧文件轨后转合成
      const prev = bgmEl;
      if (prev) { prev._handoff = true; clearLoop(prev); bgmEl = null; fadeVol(prev, 0, xf, () => { try { prev.pause(); } catch (e) {} }); }
      try { BGM.start(track); } catch (e) {}
    },
    bgmStop() { this.stopBgm(); try { BGM.stop(); } catch (e) {} curTrack = null; },
    // 旧接口（资源后补；文件缺失静默）
    playBgm(url, vol = 0.25) {
      try {
        if (bgmEl && bgmEl._src === url) return;
        this.stopBgm();
        const el = new window.Audio(url);
        el._src = url; el.loop = true; el.volume = vol;
        el.onerror = () => { if (bgmEl === el) bgmEl = null; };
        bgmEl = el;
        if (!muted) el.play().catch(() => {});
      } catch (e) {}
    },
    stopBgm() { if (bgmEl) { clearLoop(bgmEl); try { bgmEl.pause(); } catch (e) {} bgmEl = null; } },
  };

  // 通用点击音：按钮/选项等（委托监听，轻量）
  if (root.document) {
    const SEL = ".btn,.choice,.spell-btn,.inv-item,.local-npc,.scene-pin,.mtab,.dpad-btn,.skill-chip,.nw-act,.ex-cell.reach";
    root.document.addEventListener("click", (ev) => {
      if (muted || !ev.target || !ev.target.closest) return;
      const hit = ev.target.closest(SEL);
      if (hit && !hit.disabled) Sfx.play("click");
    }, true);
  }

  root.Sfx = Sfx;
  if (typeof module !== "undefined" && module.exports) module.exports = Sfx;
})(typeof window !== "undefined" ? window : globalThis);
