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
  };

  let lastPlay = {};
  let bgmEl = null;

  const Sfx = {
    enabled() { return !muted; },
    toggle() {
      muted = !muted;
      try { localStorage.setItem(KEY, muted ? "off" : "on"); } catch (e) {}
      if (muted && bgmEl) { bgmEl.pause(); }
      if (!muted && bgmEl) { bgmEl.play().catch(() => {}); }
      return !muted;
    },
    play(name) {
      if (muted || !RECIPES[name]) return;
      const now = Date.now();
      if (lastPlay[name] && now - lastPlay[name] < 70) return;   // 同音去抖
      lastPlay[name] = now;
      try { const c = ac(); if (c) RECIPES[name](c); } catch (e) {}
    },
    // BGM 接口：资源后补；文件缺失静默
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
  if (typeof module !== "undefined" && module.exports) module.exports = Sfx;
})(typeof window !== "undefined" ? window : globalThis);
