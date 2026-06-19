/* ============================================================
 * audio.js — 音频层：Web Audio 合成音效（零资源依赖）+ BGM 接口
 *
 * 审美基调（见 docs/art-direction.md）：玉磬、翻纸、剑鸣、古钟——
 * 一切音效克制、短促、低音量，是"气口"不是"轰炸"。
 *  - Sfx.play(name)：合成音效（静音开关持久化）
 *  - Sfx.ambient(id)/ambientStop()：地点/演出环境床（夜虫/萤火/烛火/风/雨，文件优先+程序合成兜底）
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

  /* ============ 环境床 AMB（地点/演出环境声，零资源程序合成）============
   * 与 BGM 独立、可并存：BGM 是"曲"，环境床是"景"（夜虫/萤火/烛火/夜风/檐雨/市集远喧）。
   * 设计准则（docs/audio-design.md）：极低音量垫底、是"夜色"不是"配乐"；演出/夜景里它领奏、
   * BGM 自动退到极低（duckBgm），出演出即恢复——正是"夜里不一直放音乐"那股安静劲儿。
   * 持续床=loop 噪声 buffer 经滤波（风/火/雨嘶），间歇事件=调度器叠短音（虫鸣/噼啪/水滴）。
   * 全程纯噪声/带噪短脉冲，结构上无固定音高串联＝不可能出旋律或节拍，可无限循环、极低动态。
   * 文件优先 assets/audio/amb_<id>.<ext>（见 AMB_FILES）；无真实录音的 id 直接走本引擎。 */
  const AMB = {
    id: null, _timer: null, _master: null, _nodes: [], _dest: null,
    _gain(c) {
      if (!this._master) { this._master = c.createGain(); this._master.gain.value = 1; this._master.connect(this._dest || c.destination); }
      return this._master;
    },
    // 持续噪声床（loop）：经滤波 + 可选缓慢起伏（让风/火"活"起来）
    _bed(c, { band = null, low = null, hp = null, gain = 0.02, lfo = 0 }) {
      const len = Math.floor(c.sampleRate * 2);
      const buf = c.createBuffer(1, len, c.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const src = c.createBufferSource(); src.buffer = buf; src.loop = true;
      let node = src;
      if (hp)   { const f = c.createBiquadFilter(); f.type = "highpass"; f.frequency.value = hp;   node.connect(f); node = f; }
      if (band) { const f = c.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = band; f.Q.value = 0.7; node.connect(f); node = f; }
      if (low)  { const f = c.createBiquadFilter(); f.type = "lowpass";  f.frequency.value = low;  node.connect(f); node = f; }
      const g = c.createGain(); g.gain.value = gain;
      node.connect(g); g.connect(this._gain(c));
      src.start(); this._nodes.push(src, g);
      if (lfo) {
        const osc = c.createOscillator(), og = c.createGain();
        osc.type = "sine"; osc.frequency.value = lfo; og.gain.value = gain * 0.6;
        osc.connect(og); og.connect(g.gain); osc.start(); this._nodes.push(osc, og);
      }
      return g;
    },
    // 间歇事件用短音/短噪（接 master，受 duck/静音统辖）
    _tone(c, { freq = 440, type = "sine", dur = 0.2, gain = 0.01, slideTo = null, delay = 0 }) {
      const o = c.createOscillator(), g = c.createGain();
      const t0 = c.currentTime + delay;
      o.type = type; o.frequency.setValueAtTime(freq, t0);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(gain, t0 + Math.min(0.03, dur * 0.3));
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(this._gain(c));
      o.start(t0); o.stop(t0 + dur + 0.03);
    },
    _pip(c, { band = 4200, dur = 0.03, gain = 0.008, delay = 0 }) {
      const t0 = c.currentTime + delay;
      const len = Math.max(1, Math.floor(c.sampleRate * dur));
      const buf = c.createBuffer(1, len, c.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = c.createBufferSource(); src.buffer = buf;
      const f = c.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = band; f.Q.value = 6;
      const g = c.createGain(); g.gain.setValueAtTime(gain, t0); g.gain.exponentialRampToValueAtTime(0.0005, t0 + dur);
      src.connect(f); f.connect(g); g.connect(this._gain(c));
      src.start(t0);
    },
    _cricket(c, soft) {   // 虫鸣：一串细颤（band 噪短脉冲列）
      const base = 4100 + Math.random() * 1100;
      const reps = 3 + Math.floor(Math.random() * 4);
      const gap = 0.05 + Math.random() * 0.03;
      const g = soft ? 0.005 : 0.0085;
      const lead = Math.random() * 0.25;
      for (let k = 0; k < reps; k++) this._pip(c, { band: base, dur: 0.028, gain: g, delay: lead + k * gap });
    },
    _frog(c)    { this._tone(c, { freq: 150, slideTo: 96, type: "sawtooth", dur: 0.18, gain: 0.008, delay: Math.random() * 0.3 }); },
    _crackle(c) {   // 烛火噼啪
      const n = 1 + Math.floor(Math.random() * 2);
      for (let k = 0; k < n; k++) this._pip(c, { band: 1500 + Math.random() * 1400, dur: 0.025, gain: 0.01, delay: Math.random() * 0.4 + k * 0.06 });
    },
    _shimmer(c) { this._tone(c, { freq: 2300 + Math.random() * 900, type: "sine", dur: 0.5, gain: 0.0035, delay: Math.random() * 0.3 }); },
    _drip(c)    { this._tone(c, { freq: 2100 + Math.random() * 500, slideTo: 900, type: "sine", dur: 0.07, gain: 0.009, delay: Math.random() * 0.4 }); },
    _farBell(c) { this._tone(c, { freq: 760 + Math.random() * 240, type: "sine", dur: 0.5, gain: 0.004, delay: Math.random() * 0.3 }); },

    start(id) {
      if (this.id === id) return;
      this.stop();
      this.id = id;
      if (muted) return;            // 静音时只记 id，解除后 resume
      const c = ac(); if (!c) return;
      // 持续床
      if (id === "night" || id === "firefly") {
        this._bed(c, { low: 380, gain: 0.011, lfo: 0.06 });
        this._bed(c, { band: 4800, gain: 0.0045, lfo: 0.05 });   // 远处虫鸣垫底（层层叠叠的背景沙沙）
      }
      else if (id === "wind")   this._bed(c, { low: 620, gain: 0.02, lfo: 0.09 });
      else if (id === "candle") this._bed(c, { low: 900, gain: 0.006 });
      else if (id === "rain")   { this._bed(c, { band: 3800, gain: 0.024 }); this._bed(c, { low: 1100, gain: 0.01, lfo: 0.07 }); }
      else if (id === "market") this._bed(c, { band: 560, gain: 0.012, lfo: 0.12 });
      // 间歇事件调度
      const tick = () => {
        if (muted || this.id !== id) return;
        const cc = ac(); if (!cc) return;
        if (id === "night")        { this._cricket(cc, false); if (Math.random() < 0.5) this._cricket(cc, Math.random() < 0.5); if (Math.random() < 0.12) this._frog(cc); }
        else if (id === "firefly") { if (Math.random() < 0.6)  this._cricket(cc, true);  if (Math.random() < 0.4)  this._shimmer(cc); }
        else if (id === "candle")  { if (Math.random() < 0.55) this._crackle(cc); }
        else if (id === "rain")    { if (Math.random() < 0.45) this._drip(cc); }
        else if (id === "market")  { if (Math.random() < 0.22) this._farBell(cc); }
      };
      // 自调度 + 去网格抖动：间隔随机 360..880ms，避免固定节奏听感（更像自然此起彼伏）
      const loop = () => {
        tick();
        if (this.id === id && !muted) this._timer = setTimeout(loop, 360 + Math.random() * 520);
      };
      loop();
    },
    stop() {
      if (this._timer) { clearTimeout(this._timer); this._timer = null; }
      this._nodes.forEach(n => { try { if (n.stop) n.stop(); } catch (e) {} try { if (n.disconnect) n.disconnect(); } catch (e) {} });
      this._nodes = [];
      this.id = null;
    },
    resume() { const i = this.id; this.id = null; if (i) this.start(i); },
  };

  /* ============ BGM 文件轨（Lyria 生成，assets/audio/bgm_<track>.mp3）============
   * 九轨（参考动画配乐气质）：daily 药庐古琴 / town 市井琵琶 / journey 行旅笛弦 /
   * fair 集市筝铃 / combat 战鼓急弦 / boss 太鼓号角 / tense 阴冷悬疑 /
   * sorrow 二胡离殇 / triumph 钟磬凯旋（单次不循环）。
   * 文件缺失/加载失败 → 回退合成轨（FALLBACK 映射）。 */
  const BGM_FILES = ["daily", "town", "journey", "fair", "combat", "boss", "tense", "sorrow", "triumph"];
  const FALLBACK = { town: "daily", journey: "daily", fair: "daily", boss: "combat", sorrow: "tense", triumph: null };
  let curTrack = null;

  /* ============ 真实环境录音清单（文件优先名单）============
   * 仅这些 id 走文件 assets/audio/amb_<id>.mp3；其余环境床一律走程序合成（AMB 引擎）。
   * 现况为空：google/lyria-3-clip 本质是生乐模型，即便提示"无旋律/无节拍/field-recording"
   * 仍混入旋律线与节拍（实测见 docs/audio-design.md §七），不是"景"是"曲"——故环境床全部
   * 走合成兜底（纯噪声床+短噪事件，无旋律无节拍、可无限循环）。后续若接入真实 field-recording
   * 资源，把对应 id 加进来即恢复"文件优先"。 */
  const AMB_FILES = [];

  /* ============ 环境床状态 + BGM 让位（duck）============
   * 环境床领奏时把当前 BGM（文件轨 + 合成轨）压到极低，出演出/收床即恢复。 */
  let ambEl = null;
  let curAmb = null;
  let bgmDucked = false, bgmBaseVol = null;
  function duckBgm() {
    if (bgmDucked) return; bgmDucked = true;
    if (bgmEl) { bgmBaseVol = bgmEl.volume; try { bgmEl.volume = Math.max(0, bgmEl.volume * 0.16); } catch (e) {} }
    try { if (BGM._master) BGM._master.gain.setTargetAtTime(0.16, ac().currentTime, 0.4); } catch (e) {}
  }
  function unduckBgm() {
    if (!bgmDucked) return; bgmDucked = false;
    if (bgmEl && bgmBaseVol != null) { try { bgmEl.volume = bgmBaseVol; } catch (e) {} }
    bgmBaseVol = null;
    try { if (BGM._master) BGM._master.gain.setTargetAtTime(1, ac().currentTime, 0.4); } catch (e) {}
  }

  const Sfx = {
    enabled() { return !muted; },
    toggle() {
      muted = !muted;
      try { localStorage.setItem(KEY, muted ? "off" : "on"); } catch (e) {}
      if (muted && bgmEl) { bgmEl.pause(); }
      if (!muted && bgmEl) { bgmEl.play().catch(() => {}); }
      if (muted && ambEl) { ambEl.pause(); }
      if (!muted && ambEl) { ambEl.play().catch(() => {}); }
      if (muted) {
        const t = BGM.track; BGM.stop(); BGM.track = t;                  // 记轨停声
        const a = AMB.id; try { AMB.stop(); } catch (e) {} AMB.id = a;   // 记环境床停声
      } else {
        if (bgmEl == null) BGM.resume();
        if (ambEl == null && AMB.id) AMB.resume();
      }
      return !muted;
    },
    play(name) {
      if (muted || !RECIPES[name]) return;
      const now = Date.now();
      if (lastPlay[name] && now - lastPlay[name] < 70) return;   // 同音去抖
      lastPlay[name] = now;
      try { const c = ac(); if (c) RECIPES[name](c); } catch (e) {}
    },
    // 主入口：换 BGM 轨（文件优先，合成兜底；同轨幂等）
    bgm(track, opts = {}) {
      if (curTrack === track && !opts.force) return;
      curTrack = track;
      if (BGM_FILES.includes(track)) {
        const url = `assets/audio/bgm_${track}.mp3`;
        try {
          this.stopBgm();
          BGM.stop();   // 合成轨让位
          const el = new window.Audio(url);
          el._src = url; el.loop = track !== "triumph"; el.volume = opts.vol != null ? opts.vol : 0.3;
          el.onerror = () => {   // 文件缺失：回退合成
            if (bgmEl === el) bgmEl = null;
            const fb = FALLBACK[track] !== undefined ? FALLBACK[track] : track;
            if (fb) try { BGM.start(fb); } catch (e) {}
          };
          if (track === "triumph") el.onended = () => { if (bgmEl === el) { bgmEl = null; curTrack = null; } };
          bgmEl = el;
          // 床领奏时换轨：新轨续压，免得地点级环境床下 BGM 又被顶到原音量
          if (bgmDucked) { bgmBaseVol = el.volume; try { el.volume = Math.max(0, el.volume * 0.16); } catch (e) {} }
          if (!muted) el.play().catch(() => {});
          return;
        } catch (e) {}
      }
      // 非文件轨：直接合成
      try { BGM.start(track); } catch (e) {}
    },
    bgmStop() { this.stopBgm(); try { BGM.stop(); } catch (e) {} curTrack = null; },
    /* 环境床：地点/演出环境声（与 BGM 独立并存；文件优先 + 程序合成兜底）。
     * id: "night"|"firefly"|"candle"|"wind"|"rain"|"market"；传 null/false=收床。
     * opts: {vol, duck:false 关 BGM 让位, force 强制重起}。同 id 幂等。*/
    ambient(id, opts = {}) {
      if (curAmb === id && !opts.force) return;
      if (!id) { this.ambientStop(); return; }
      curAmb = id;
      this._ambStopFile();
      try { AMB.stop(); } catch (e) {}
      if (AMB_FILES.includes(id)) {   // 有真实录音→文件优先，缺失/失败回退合成
        try {
          const url = `assets/audio/amb_${id}.mp3`;
          const el = new window.Audio(url);
          el._src = url; el.loop = true; el.volume = opts.vol != null ? opts.vol : 0.4;
          el.onerror = () => {
            if (ambEl === el) { ambEl = null; if (curAmb === id) { try { AMB.start(id); } catch (e) {} } }
          };
          ambEl = el;
          if (!muted) el.play().catch(() => {});
        } catch (e) { try { AMB.start(id); } catch (e2) {} }
      } else {                        // 无真实录音→直接程序合成（默认全部，无旋律无节拍）
        try { AMB.start(id); } catch (e) {}
      }
      // 环境床领奏：压低 BGM（演出/夜景"不一直放音乐"）
      if (opts.duck !== false) duckBgm(); else unduckBgm();
    },
    ambientStop() {
      this._ambStopFile();
      try { AMB.stop(); } catch (e) {}
      curAmb = null;
      unduckBgm();
    },
    _ambStopFile() { if (ambEl) { try { ambEl.pause(); } catch (e) {} ambEl = null; } },
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
    stopBgm() { if (bgmEl) { try { bgmEl.pause(); } catch (e) {} bgmEl = null; } },
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
  // 调试/离线试听钩子：仅当显式置 root.__FRXXZ_AUDIO_DEBUG__ 时暴露内部引擎（生产默认不挂，无副作用）。
  // 配合 AMB._dest 可把环境床改接 MediaStreamDestination 录样，做"无旋律"质量核验。
  try { if (root.__FRXXZ_AUDIO_DEBUG__) { Sfx._amb = AMB; Sfx._bgm = BGM; } } catch (e) {}
  if (typeof module !== "undefined" && module.exports) module.exports = Sfx;
})(typeof window !== "undefined" ? window : globalThis);
