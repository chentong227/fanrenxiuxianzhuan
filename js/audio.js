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

  /* ===== SFX 母链（v312·用户实锤"还是 8bit 的声音"根治）=====
   * 裸振荡器直连 destination = 蜂鸣器质感的元凶。全部合成音改走母线：
   *   软饱和(tanh waveshaper·去塑料感) → 压缩(黏合瞬态) → 干声 + 短混响湿声(空气感)。
   * 加上 tone() 的随机失谐/双振荡器加厚（见下），合成音听感从"哔"变"器物"。 */
  let _bus = null;
  function makeImpulse(c, dur, decay) {
    const rate = c.sampleRate, len = Math.max(1, Math.floor(rate * dur));
    const buf = c.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }
  // v344 音效分轨：设置里的音效档位乘在母线入口增益上（BGM/环境床不经此链，互不影响）
  function sfxMul() {
    return (root.Settings && root.Settings.sfxVolMul) ? root.Settings.sfxVolMul() : 1;
  }
  function bus(c) {
    if (_bus && _bus.c === c) { _bus.input.gain.value = sfxMul(); return _bus.input; }
    const input = c.createGain(); input.gain.value = sfxMul();
    const shaper = c.createWaveShaper();
    const N = 256, curve = new Float32Array(N);
    for (let i = 0; i < N; i++) { const x = (i / (N - 1)) * 2 - 1; curve[i] = Math.tanh(1.7 * x); }
    shaper.curve = curve; shaper.oversample = "2x";
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -20; comp.knee.value = 22; comp.ratio.value = 4;
    comp.attack.value = 0.004; comp.release.value = 0.16;
    const dry = c.createGain(); dry.gain.value = 0.9;
    const conv = c.createConvolver(); conv.buffer = makeImpulse(c, 1.2, 2.8);
    const wet = c.createGain(); wet.gain.value = 0.17;
    input.connect(shaper); shaper.connect(comp);
    comp.connect(dry); dry.connect(c.destination);
    comp.connect(conv); conv.connect(wet); wet.connect(c.destination);
    _bus = { c, input };
    return input;
  }

  // §7 空间音/声相：合成 SFX 的最终落点——pan≠0 时经 StereoPanner 偏左右，否则直连母线。
  //   _sfxPan 由 play(name,{pan}) 在同步执行配方期间临时置位（配方内建节点都会读到）。
  let _sfxPan = 0;
  function panOut(c, g) {
    if (_sfxPan && c.createStereoPanner) {
      const p = c.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, _sfxPan));
      g.connect(p); p.connect(bus(c));
    } else {
      g.connect(bus(c));
    }
  }

  // —— 合成原语（v312：随机失谐+双振荡器加厚——同一记不再一模一样，"器物"不"蜂鸣"）——
  function tone(c, { freq = 440, type = "sine", dur = 0.3, gain = 0.07, decay = true, slideTo = null, delay = 0 }) {
    const t0 = c.currentTime + delay;
    const jitter = 1 + (Math.random() - 0.5) * 0.05;   // ±2.5% 随机失谐（每记微异）
    const f0 = freq * jitter;
    const g = c.createGain();
    g.gain.setValueAtTime(gain, t0);
    if (decay) g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
    const mk = (fMul, gMul, detune) => {
      const o = c.createOscillator(), og = c.createGain();
      o.type = type; o.frequency.setValueAtTime(f0 * fMul, t0);
      if (detune && o.detune) o.detune.value = detune;
      if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo * jitter * fMul), t0 + dur);
      og.gain.value = gMul;
      o.connect(og); og.connect(g);
      o.start(t0); o.stop(t0 + dur + 0.02);
    };
    mk(1, 1, 0);
    if (type !== "sine") mk(1, 0.35, 9);   // 锯齿/三角加一路 +9 音分失谐副振——合唱式加厚
    panOut(c, g);
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
    node.connect(g); panOut(c, g);
    src.start(t0);
  }

  // —— 音色配方 ——
  const RECIPES = {
    // 玉磬轻击：通用点击
    click(c) { tone(c, { freq: 1560, dur: 0.09, gain: 0.035 }); tone(c, { freq: 3120, dur: 0.05, gain: 0.012 }); },
    // —— 交互分音（审美审计 §3.2：确认/取消/开合各有其声，不共用一记 click）——
    // 确认：暖玉双音上行（比 click 沉半分、多一分"落定"）
    confirm(c) { tone(c, { freq: 988, dur: 0.1, gain: 0.038 }); tone(c, { freq: 1319, dur: 0.14, gain: 0.03, delay: 0.05 }); },
    // 取消/收起：低玉单音下行（轻、短、不抢戏）
    cancel(c) { tone(c, { freq: 740, slideTo: 590, dur: 0.09, gain: 0.026 }); },
    // 面板开：绢帛轻展（弹窗/sheet 滑出）
    open(c) { noise(c, { dur: 0.09, gain: 0.016, band: 2200 }); tone(c, { freq: 1175, dur: 0.07, gain: 0.014, delay: 0.02 }); },
    // 面板合：绢帛收拢（更低更短）
    close(c) { noise(c, { dur: 0.07, gain: 0.013, band: 1400 }); },
    // 翻纸：剧情推进
    page(c) { noise(c, { dur: 0.1, gain: 0.028, band: 1500 }); },
    // 入戏磬：题字卡
    chime(c) { tone(c, { freq: 988, dur: 1.0, gain: 0.05 }); tone(c, { freq: 1481, dur: 0.8, gain: 0.022, delay: 0.02 }); },
    // 剑鸣：攻击（v308 加厚）
    sword(c) {
      tone(c, { freq: 760, slideTo: 2300, type: "sawtooth", dur: 0.14, gain: 0.055 });
      noise(c, { dur: 0.12, gain: 0.04, band: 3400 });
      tone(c, { freq: 190, slideTo: 85, dur: 0.1, gain: 0.022, delay: 0.02 });
    },
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
    // 岁末远钟（D5 时间可感知）：跨年那一拍——比突破钟远、轻、低（是山寺的钟，不是耳边的钟）
    yearBell(c) {
      tone(c, { freq: 196, dur: 2.6, gain: 0.028 });
      tone(c, { freq: 196 * 2.76, dur: 1.5, gain: 0.011, delay: 0.02 });
      noise(c, { dur: 0.5, gain: 0.006, low: 400, delay: 0.05 });
    },
    // 得益三音
    success(c) { [523, 659, 784].forEach((f, i) => tone(c, { freq: f, dur: 0.22, gain: 0.04, delay: i * 0.085 })); },
    // 失利沉音
    fail(c) { tone(c, { freq: 220, slideTo: 104, dur: 0.5, gain: 0.06 }); },
    // 采得/拾取
    pick(c) { tone(c, { freq: 1175, dur: 0.1, gain: 0.035 }); tone(c, { freq: 1568, dur: 0.12, gain: 0.025, delay: 0.06 }); },
    // 打字机轻嗒（对话逐字，极轻——气口不是轰炸）
    type(c) { noise(c, { dur: 0.025, gain: 0.012, band: 2600 }); },
    // 林间鸟鸣（S5 战场天象·森林战）：两声清亮短啭，极轻——远处的，不在耳边
    bird(c) {
      tone(c, { freq: 2900, slideTo: 2300, dur: 0.07, gain: 0.012 });
      tone(c, { freq: 3300, slideTo: 2600, dur: 0.09, gain: 0.01, delay: 0.14 });
      tone(c, { freq: 2500, slideTo: 3100, dur: 0.06, gain: 0.008, delay: 0.26 });
    },
    // —— 箱庭走格·脚步声五材质（B3 箱庭演出层）：每记=两步错落（左右脚），
    //    低频落地 thump + 材质摩擦噪——克制短促，是"脚下有地"不是"打击乐"。
    //    材质由地图/节点 step 字段派发（草/碎石/石板/泥沼/雪）。
    stepGrass(c) {   // 草地：软踏 + 草叶窸窣
      [0, 0.3].forEach(d => {
        tone(c, { freq: 130, slideTo: 70, dur: 0.07, gain: 0.02, delay: d });
        noise(c, { dur: 0.09, gain: 0.014, band: 2100, delay: d + 0.01 });
      });
    },
    stepGravel(c) {  // 碎石：颗粒的嘎吱两声
      [0, 0.29].forEach(d => {
        tone(c, { freq: 150, slideTo: 85, dur: 0.06, gain: 0.02, delay: d });
        noise(c, { dur: 0.07, gain: 0.02, band: 950, delay: d });
        noise(c, { dur: 0.04, gain: 0.011, band: 1900, delay: d + 0.03 });
      });
    },
    stepStone(c) {   // 石板：硬质叩响（短、清）
      [0, 0.28].forEach(d => {
        tone(c, { freq: 330, slideTo: 170, dur: 0.045, gain: 0.022, delay: d });
        noise(c, { dur: 0.035, gain: 0.01, band: 3200, delay: d });
      });
    },
    stepMud(c) {     // 泥沼：湿黏的噗叽（低、拖）
      [0, 0.34].forEach(d => {
        tone(c, { freq: 110, slideTo: 55, dur: 0.11, gain: 0.02, delay: d });
        noise(c, { dur: 0.13, gain: 0.017, low: 520, delay: d + 0.02 });
      });
    },
    stepSnow(c) {    // 雪地：闷实的咯吱（软、糯）
      [0, 0.31].forEach(d => {
        tone(c, { freq: 140, slideTo: 78, dur: 0.08, gain: 0.017, delay: d });
        noise(c, { dur: 0.1, gain: 0.015, low: 780, delay: d + 0.01 });
      });
    },
    // 棋子落枰（红尘劫·棋友坐化——一子落定的脆响，木与玉的短击）
    goClick(c) {
      noise(c, { dur: 0.03, gain: 0.05, band: 3400 });
      tone(c, { freq: 1720, slideTo: 1180, dur: 0.09, gain: 0.045, delay: 0.004 });
      tone(c, { freq: 430, dur: 0.14, gain: 0.02, delay: 0.01 });
    },
    // —— 远声（声纹梯度：离战团越近听得越真——音量刻意极低，是"远方"不是"耳边"）——
    // 远方妖吼：低频下滑长音 + 闷雷噪
    farRoar(c) {
      tone(c, { freq: 92, slideTo: 48, type: "sawtooth", dur: 1.1, gain: 0.022 });
      noise(c, { dur: 0.9, gain: 0.014, low: 190, delay: 0.08 });
    },
    // 远雷先声（S2 神雷预兆拍）：低频滚雷自远处压来——"要来了"的酝酿（v308 加厚）
    thunderFar(c) {
      noise(c, { dur: 1.6, gain: 0.04, low: 120 });
      tone(c, { freq: 54, slideTo: 30, type: "sine", dur: 1.6, gain: 0.042, delay: 0.05 });
      noise(c, { dur: 0.9, gain: 0.022, low: 200, delay: 0.5 });
      noise(c, { dur: 1.4, gain: 0.014, low: 80, delay: 0.9 });
    },
    // 天雷劈落 v2（v308 用户实锤"雷不是雷声，像8bit子弹"）：
    // 撕裂炸头（宽带大电平）→ 中低频轰体 → 双段错相滚雷长尾（山海间的回响）——是雷，不是哔
    thunder(c) {
      noise(c, { dur: 0.07, gain: 0.15, band: 5600 });                                    // 撕空炸裂头
      noise(c, { dur: 0.32, gain: 0.19, low: 3000 });                                     // 主爆宽带
      tone(c, { freq: 1400, slideTo: 85, type: "sawtooth", dur: 0.5, gain: 0.06 });       // 电弧下坠
      noise(c, { dur: 0.85, gain: 0.1, low: 480, delay: 0.06 });                          // 中低轰体
      noise(c, { dur: 1.7, gain: 0.055, low: 150, delay: 0.28 });                         // 滚雷一段
      noise(c, { dur: 2.4, gain: 0.032, low: 85, delay: 0.75 });                          // 滚雷二段（更远）
      tone(c, { freq: 50, slideTo: 28, type: "sine", dur: 2.2, gain: 0.06, delay: 0.14 });// 次声沉底
    },
    // 远方斗法：绫帛破空的细啸 + 法器轻鸣（隐约金石声）
    farClash(c) {
      tone(c, { freq: 1860, slideTo: 2600, dur: 0.34, gain: 0.008 });
      tone(c, { freq: 1244, dur: 0.5, gain: 0.011, delay: 0.22 });
      noise(c, { dur: 0.28, gain: 0.007, band: 3000, delay: 0.06 });
    },

    /* ===== 战斗音效全套（tactics T7：行属分系+战术事件——14PM 预算放开，
     * 每记都要"有形"：金石有锋、火有轰势、冰有脆裂、背袭有寒意） ===== */
    // 金：金石锐鸣——法器破空带金属泛音（金光砖/子母刃）（v308 出手音全系加厚：用户实锤"太柔"）
    castJin(c) {
      noise(c, { dur: 0.05, gain: 0.05, band: 6000 });                                    // 出鞘炸头
      tone(c, { freq: 1320, slideTo: 2800, type: "sawtooth", dur: 0.16, gain: 0.062 });
      tone(c, { freq: 2640, dur: 0.22, gain: 0.032, delay: 0.03 });
      noise(c, { dur: 0.12, gain: 0.038, band: 4200, delay: 0.02 });
      tone(c, { freq: 220, slideTo: 90, dur: 0.14, gain: 0.03, delay: 0.02 });            // 低频压底=分量
    },
    // 木：剑芒破空——嗖鸣上扬+叶簌尾（青元剑芒）
    castMu(c) {
      noise(c, { dur: 0.05, gain: 0.04, band: 4600 });
      tone(c, { freq: 880, slideTo: 2400, type: "triangle", dur: 0.18, gain: 0.058 });
      noise(c, { dur: 0.16, gain: 0.04, band: 3000, delay: 0.02 });
      tone(c, { freq: 1760, dur: 0.12, gain: 0.022, delay: 0.08 });
      tone(c, { freq: 180, slideTo: 80, dur: 0.12, gain: 0.026, delay: 0.02 });
    },
    // 水/冰：晶澈滑音+冰晶碎裂尾（寒冰符）
    castShui(c) {
      tone(c, { freq: 2200, slideTo: 980, type: "sine", dur: 0.24, gain: 0.052 });
      noise(c, { dur: 0.14, gain: 0.034, band: 5200, delay: 0.1 });
      tone(c, { freq: 3300, dur: 0.1, gain: 0.02, delay: 0.13 });
      tone(c, { freq: 160, slideTo: 70, dur: 0.14, gain: 0.024, delay: 0.03 });
    },
    // 火：轰燃低吼+噼啪火星（火蛇符/火弹术）
    castHuo(c) {
      noise(c, { dur: 0.06, gain: 0.05, band: 2200 });
      tone(c, { freq: 130, slideTo: 62, type: "sawtooth", dur: 0.34, gain: 0.09 });
      noise(c, { dur: 0.3, gain: 0.06, low: 900 });
      noise(c, { dur: 0.1, gain: 0.032, band: 2600, delay: 0.12 });
    },
    // 土：闷沉砸落——大地的分量（金光砖砸地/土系重击）
    castTu(c) {
      tone(c, { freq: 96, slideTo: 44, type: "triangle", dur: 0.3, gain: 0.11 });
      noise(c, { dur: 0.24, gain: 0.07, low: 260 });
      noise(c, { dur: 0.05, gain: 0.04, band: 1200 });
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
    // 应雷·群剑共鸣：神雷附剑施放——通电涌动(低频上涌+电滋) + 群剑齐应雷而吟（v308 加厚）
    leiCharge(c) {
      tone(c, { freq: 80, slideTo: 340, type: "sawtooth", dur: 0.46, gain: 0.075 });   // 通电低涌
      noise(c, { dur: 0.4, gain: 0.055, band: 3600 });                                  // 电流滋滋
      noise(c, { dur: 0.22, gain: 0.032, band: 5400, delay: 0.1 });                     // 高频电爆裂
      tone(c, { freq: 1320, slideTo: 1980, type: "triangle", dur: 0.55, gain: 0.042, delay: 0.05 });  // 剑吟主
      tone(c, { freq: 1760, dur: 0.6, gain: 0.026, delay: 0.09 });                      // 剑吟泛音
      tone(c, { freq: 2640, dur: 0.44, gain: 0.015, delay: 0.13 });                     // 剑吟高泛
    },
    // 飞剑出袭破空：群剑掠空的锐啸——高频噪扫 + 下滑嗖鸣（v308 加厚）
    swordWhoosh(c) {
      noise(c, { dur: 0.22, gain: 0.055, band: 4200 });
      tone(c, { freq: 2400, slideTo: 620, type: "sawtooth", dur: 0.18, gain: 0.04 });
      tone(c, { freq: 200, slideTo: 90, dur: 0.12, gain: 0.024, delay: 0.02 });
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
    // 通用施法（无属性倾向）：剧情演出里 { sfx:"cast" } 的落点——灵光引诀的中性一记
    // （story.js 多处早已写 "cast"，此前无此配方=静默漏音；以 castMu 为底的柔化变体补上）
    cast(c) {
      noise(c, { dur: 0.05, gain: 0.032, band: 4200 });
      tone(c, { freq: 760, slideTo: 1900, type: "triangle", dur: 0.2, gain: 0.05 });
      tone(c, { freq: 190, slideTo: 95, dur: 0.13, gain: 0.022, delay: 0.02 });
    },
    // 落水/浪涌：入水闷响+水花散溅+余波荡开（story.js 落海/海妖节点早已写 "splash"，此前无配方=静默漏音）
    splash(c) {
      tone(c, { freq: 180, slideTo: 60, dur: 0.18, gain: 0.055 });                 // 入水闷头
      noise(c, { dur: 0.3, gain: 0.05, band: 2400, delay: 0.02 });                 // 水花主体
      noise(c, { dur: 0.4, gain: 0.024, band: 1100, delay: 0.14 });                // 余波荡开
      tone(c, { freq: 520, slideTo: 240, type: "triangle", dur: 0.22, gain: 0.016, delay: 0.06 });
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
  const BGM_FILES = ["daily", "town", "journey", "fair", "combat", "combat_wild", "combat_secret", "boss", "tense", "sorrow", "triumph"];
  const FALLBACK = { town: "daily", journey: "daily", fair: "daily", combat_wild: "combat", combat_secret: "combat", boss: "combat", sorrow: "tense", triumph: null };
  const KNOWN_TRACKS = BGM_FILES;   // C3 切轨校验：合法轨名白名单
  let curTrack = null;

  // （fadeVol 唯一实现见下文「环境床状态」段——此处旧副本已删：同名函数声明后者覆盖前者，
  //   留两份只会埋"改了不生效"的坑。）

  // 文件 BGM 默认音量（源已 -20 LUFS 归一，故不必高；克制基调，降「吵闹」）
  const BGM_VOL = 0.26;

  // 元素当前应有的播放音量：真实目标 _vol × 让位系数（bgmDucked 时 −16dB）。
  // 循环换实例/硬重启/解锁重播等一切"重新起播"的路径都必须经此取值，
  // 否则会在夜景/演出里把被压低的 BGM 弹回全音量（v324 根治"BGM 重叠/忽然变响"）。
  function effVol(target) { return bgmDucked ? target * DUCK_K : target; }

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
          nb._vol = target;                             // 承接真实目标音量（duck/unduck 据此，循环换实例后不丢）
          bgmEl = nb;                                   // 新实例接管为当前轨
          setupLoopEl(nb, track, target, lxf);          // 链上下一轮（含兜底）
          nb.volume = 0; nb.play().catch(() => {});
          // v324：淡入目标吃让位系数——夜景/演出里 BGM 被压低时，循环换实例不得弹回全音量
          fadeVol(nb, effVol(target), lxf);             // 新实例淡入
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
      try { el.currentTime = 0; el.volume = muted ? 0 : effVol(target); if (!muted) el.play().catch(() => {}); } catch (e) {}
      startLoopXfade(el, track, target, lxf);
    };
    startLoopXfade(el, track, target, lxf);
  }

  /* ============ 环境床文件清单（文件优先名单）============
   * 这些 id 走文件 assets/audio/amb_<id>.mp3；不在名单的 id 一律走程序合成（AMB 引擎）。
   * 六床统一基调：以"舒缓暖音垫"为底（夜床定下的安静基调）+ 各自极淡的场景细节——
   *   night 远处稀虫/夜风、firefly 微光+稀虫、candle 暖底+极淡不刺耳火光、wind 低缓夜风、
   *   rain 檐雨嘶+稀落檐滴、market 远处人语+稀疏远钟。细节层为纯噪声/带噪短事件（随机间隔、
   *   无固定音高串联），结构上不可能出旋律或节拍（覆盖设计稿 §10 R2 的"纯音效"定位）。
   * 任一文件缺失/加载失败时，回退本引擎对应 id 的程序合成（不静默）。 */
  const AMB_FILES = ["night", "firefly", "candle", "wind", "rain", "market"];

  /* ============ 环境床状态 + BGM 让位（duck）+ 换轨交叉淡化（C2）============
   * 环境床/演出领奏时把当前 BGM（文件轨 + 合成轨）压到极低；换轨 600ms 交叉淡化（不再硬切）；
   * 关键 SFX（古钟/天雷）触发时音乐瞬时 −6dB 让路。出演出/收床即恢复。 */
  let ambEl = null;
  let curAmb = null;
  let bgmDucked = false;
  let perilLevel = 0, perilTimer = 0;   // §9-5 危局氛围：心跳低鼓档位(0 收 /1 危局 /2 濒死)与其循环计时器
  const XFADE_MS = 600;       // 换轨交叉淡化时长（audio-design §2.4：硬切→600ms 软接）
  const DUCK_K = 0.16;        // 环境床/演出领奏时 BGM 让位系数（约 −16dB）
  const SFX_DUCK_K = 0.5;     // 关键 SFX（古钟/天雷）瞬时让路：−6dB
  const DUCK_SFX = { bell: 1, thunder: 1 };   // 触发瞬时 ducking 的关键音效
  const HAPTIC_SFX = { bell: "bell", thunder: "heavy" };   // §9-3：关键音效同步手机轻震（古钟=两记/天雷=重震）

  // 文件轨音量缓变（Audio 元素无 GainNode，用定时器 tween volume）；同元素重入自动接管旧 tween。
  // 用于：换轨交叉淡化、duck/unduck 平滑、关键 SFX 瞬时让路。
  function fadeVol(el, to, ms, done) {
    if (!el) { if (done) done(); return; }
    try { clearInterval(el._fade); } catch (e) {}
    to = Math.max(0, Math.min(1, to));
    const from = (typeof el.volume === "number") ? el.volume : to;
    const dur = Math.max(1, ms | 0);
    const clock = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
    const t0 = clock();
    el._fade = setInterval(() => {
      const k = Math.min(1, (clock() - t0) / dur);
      try { el.volume = from + (to - from) * k; } catch (e) {}
      if (k >= 1) { try { clearInterval(el._fade); } catch (e) {} el._fade = 0; if (done) done(); }
    }, 40);
  }

  function duckBgm() {
    if (bgmDucked) return; bgmDucked = true;
    if (bgmEl) { const base = (bgmEl._vol != null ? bgmEl._vol : bgmEl.volume); fadeVol(bgmEl, base * DUCK_K, 240); }
    try { if (BGM._master) BGM._master.gain.setTargetAtTime(DUCK_K, ac().currentTime, 0.4); } catch (e) {}
  }
  function unduckBgm() {
    if (!bgmDucked) return; bgmDucked = false;
    if (bgmEl) { const base = (bgmEl._vol != null ? bgmEl._vol : bgmEl.volume); fadeVol(bgmEl, base, 320); }
    try { if (BGM._master) BGM._master.gain.setTargetAtTime(1, ac().currentTime, 0.4); } catch (e) {}
  }

  // 关键 SFX 让路（C2 ducking）：古钟/天雷触发时音乐瞬时 −6dB（~80ms 落、~ms 缓回），听感更清。
  // 已被环境床压低(bgmDucked)时不再叠（音乐本就很轻），避免越压越低/抖动。
  function keySfxDuck(ms = 520) {
    if (muted || bgmDucked) return;
    if (bgmEl) {
      const base = (bgmEl._vol != null ? bgmEl._vol : bgmEl.volume);
      fadeVol(bgmEl, base * SFX_DUCK_K, 80, () => fadeVol(bgmEl, base, ms));
    }
    try {
      const c = ac(), m = BGM._master;
      if (c && m) {
        m.gain.cancelScheduledValues(c.currentTime);
        m.gain.setTargetAtTime(SFX_DUCK_K, c.currentTime, 0.025);
        m.gain.setTargetAtTime(1, c.currentTime + 0.12, Math.max(0.05, ms / 3000));
      }
    } catch (e) {}
  }

  // §9-5 危局氛围（音）：极低频双跳心鼓(lub-dub)，叠在 BGM 之上的加法层——
  // 刻意不动全局 duck（那是环境床/演出领奏的状态），免与之打架；静音时空转不发声。
  function heartbeat(strong) {
    const c = ac(); if (!c) return;
    const g = strong ? 0.10 : 0.07;
    tone(c, { freq: 60, slideTo: 36, type: "sine", dur: 0.16, gain: g });
    tone(c, { freq: 50, slideTo: 32, type: "sine", dur: 0.20, gain: g * 0.62, delay: 0.16 });
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
    play(name, opts) {
      if (muted || !RECIPES[name]) return;
      if (sfxMul() <= 0) return;   // v344：音效档位设「关」——合成器直接不起振
      const now = Date.now();
      if (lastPlay[name] && now - lastPlay[name] < 70) return;   // 同音去抖
      lastPlay[name] = now;
      // §7 声相：opts.pan∈[-1,1]（左负右正）；配方同步建节点，置位→执行→复位即可。
      const pan = (opts && typeof opts.pan === "number") ? Math.max(-1, Math.min(1, opts.pan)) : 0;
      try { const c = ac(); if (c) { _sfxPan = pan; try { RECIPES[name](c); } finally { _sfxPan = 0; } } } catch (e) { _sfxPan = 0; }
      if (DUCK_SFX[name]) keySfxDuck();   // C2：古钟/天雷等关键 SFX 触发→音乐瞬时让路
      if (HAPTIC_SFX[name] && root.Fx && root.Fx.haptic) root.Fx.haptic(HAPTIC_SFX[name]);   // §9-3：关键 SFX 同步手机轻震
    },
    // 当前轨名（null=未起乐）；切轨校验/调试用
    curBgm() { return curTrack; },
    // v321：乐音档位切换即时生效——正在播的文件轨淡到新目标音量（Settings.setBgmVol 调）
    bgmVolRefresh() {
      if (!bgmEl) return;
      const volMul = (root.Settings && root.Settings.bgmVolMul) ? root.Settings.bgmVolMul() : 1;
      const base = Math.min(1, BGM_VOL * volMul);
      bgmEl._vol = base;
      if (!muted && !bgmDucked) fadeVol(bgmEl, base, 260);
    },
    // 合法轨名白名单（副本，外部勿改）；切轨点可据此校验
    tracks() { return KNOWN_TRACKS.slice(); },
    isTrack(name) { return KNOWN_TRACKS.includes(name); },
    // 主入口：换 BGM 轨（文件优先，合成兜底；同轨幂等；切轨 ~600ms crossfade）
    bgm(track, opts = {}) {
      // C3 切轨校验：未知轨名一律拒绝并告警，不扰动当前播放（防 typo 把正在放的乐切没了）
      if (!KNOWN_TRACKS.includes(track)) {
        if (track != null && typeof console !== "undefined" && console.warn) console.warn("[audio] 未知 BGM 轨：" + track + "（已忽略）");
        return;
      }
      if (curTrack === track && !opts.force) return;
      curTrack = track;
      const xf = opts.fade != null ? opts.fade : 600;   // 交叉淡化时长（ms）
      if (BGM_FILES.includes(track)) {
        const url = `assets/audio/bgm_${track}.mp3`;
        try {
          BGM.stop();   // 合成轨让位（合成轨无淡出，直接停）
          // v321：乐音三档（体验设置）——乘在默认音量上；演出显式 opts.vol 也吃档（用户嫌吵能真管住）
          const volMul = (root.Settings && root.Settings.bgmVolMul) ? root.Settings.bgmVolMul() : 1;
          const target = Math.min(1, (opts.vol != null ? opts.vol : BGM_VOL) * volMul);
          const lxf = opts.loopFade != null ? opts.loopFade : 1100;   // 循环交叉时长（ms）
          const prev = bgmEl;   // 旧文件轨：淡出
          if (prev) { prev._handoff = true; clearLoop(prev); }        // 旧轨停循环监视，免淡出途中误重启
          const el = new window.Audio(url);
          el._src = url; el.volume = 0;
          el._vol = target;   // 记真实目标音量：duck/unduck/keySfxDuck 据此压低与恢复（否则 unduck 读到的是已压低值→BGM 永远闷着不回升·夜景后音乐卡在 16% 的 bug）
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
            el.volume = effVol(target);
            if (prev && prev !== el) { try { prev.pause(); } catch (e) {} }
            return;
          }
          el.play().catch(() => {});
          // v324：淡入目标吃让位系数——环境床领奏（夜景/演出）期间换轨，新轨仍保持退位音量，
          // 否则新轨直冲全音量、旧轨还在淡出＝「两首 BGM 叠着响、夜里音乐忽然变大」的病根之一
          fadeVol(el, effVol(target), xf);                                 // 新轨淡入
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
    /* §9-5 危局氛围：玩家血线告危→起心跳低鼓，离开/战毕即收。
     * level：0 收 / 1 危局(~1s 一跳) / 2 濒死(~0.64s 更急更重)。同档幂等（不重起循环），
     * 静音时仍空转但不出声；不触全局 duck（加法层，避免与环境床让位状态互踩）。 */
    peril(level) {
      level = level | 0;
      if (level === perilLevel) return;
      perilLevel = level;
      try { if (perilTimer) clearInterval(perilTimer); } catch (e) {}
      perilTimer = 0;
      if (level <= 0) return;
      const beat = () => { if (!muted) try { heartbeat(perilLevel >= 2); } catch (e) {} };
      beat();
      try { if (typeof setInterval === "function") perilTimer = setInterval(beat, level >= 2 ? 640 : 1000); } catch (e) {}
    },
    perilState() { return perilLevel; },
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
    stopBgm() { if (bgmEl) { clearLoop(bgmEl); try { bgmEl.pause(); } catch (e) {} bgmEl = null; } },
  };

  // v308 自动播放解锁（用户实锤"战斗没 BGM"）：demo/直链场景 BGM 在用户首次手势前起播会被
  // 浏览器拦下（play() 被拒后不再自动重试）——首次真实手势时补一脚：恢复 AudioContext +
  // 把"已选轨但没在响"的 BGM/环境床重新拉起。一次性监听，成功即卸。
  if (root.document) {
    const kick = () => {
      try {
        if (ctx && ctx.state === "suspended") ctx.resume();
        if (!muted) {
          if (bgmEl && bgmEl.paused && !bgmEl._hiddenPause) bgmEl.play().catch(() => {});
          else if (!bgmEl && curTrack) { const t = curTrack; curTrack = null; Sfx.bgm(t); }
          if (ambEl && ambEl.paused && !ambEl._hiddenPause) ambEl.play().catch(() => {});
        }
      } catch (e) {}
      root.document.removeEventListener("pointerdown", kick, true);
      root.document.removeEventListener("keydown", kick, true);
    };
    root.document.addEventListener("pointerdown", kick, true);
    root.document.addEventListener("keydown", kick, true);

    // v332 切后台静声：桌面浏览器切标签页/最小化后 <audio> 与 WebAudio 照常出声——
    // 玩家去干别的事音乐还在响（真实游玩体验槽点）。隐藏即暂停文件轨+合成母线归零，
    // 回来自动恢复（尊重静音与环境床让位状态）；手机浏览器本就自动暂停，此处幂等无害。
    root.document.addEventListener("visibilitychange", () => {
      try {
        const hidden = root.document.visibilityState === "hidden";
        if (hidden) {
          if (bgmEl && !bgmEl.paused) { bgmEl._hiddenPause = true; bgmEl.pause(); }
          if (ambEl && !ambEl.paused) { ambEl._hiddenPause = true; ambEl.pause(); }
          if (BGM._master) BGM._master.gain.value = 0;
          if (AMB._master) AMB._master.gain.value = 0;
        } else {
          if (!muted) {
            if (bgmEl && bgmEl._hiddenPause) { bgmEl._hiddenPause = false; bgmEl.play().catch(() => {}); }
            if (ambEl && ambEl._hiddenPause) { ambEl._hiddenPause = false; ambEl.play().catch(() => {}); }
          }
          if (BGM._master) BGM._master.gain.value = bgmDucked ? DUCK_K : 1;
          if (AMB._master) AMB._master.gain.value = 1;
        }
      } catch (e) {}
    });
  }

  // 通用点击音：按钮/选项等（委托监听，轻量）
  // 交互分音（审美审计 §3.2）：确认类=confirm 暖玉双音 / 取消收起类=cancel 低玉下行 / 其余=click 玉磬
  if (root.document) {
    const SEL = ".btn,.choice,.spell-btn,.inv-item,.local-npc,.scene-pin,.mtab,.dpad-btn,.skill-chip,.nw-act,.ex-cell.reach,.sheet-close";
    root.document.addEventListener("click", (ev) => {
      if (muted || !ev.target || !ev.target.closest) return;
      const hit = ev.target.closest(SEL);
      if (!hit || hit.disabled) return;
      if (hit.classList.contains("btn-primary")) Sfx.play("confirm");
      else if (hit.classList.contains("btn-ghost") || hit.classList.contains("sheet-close")) Sfx.play("cancel");
      else Sfx.play("click");
    }, true);
  }

  root.Sfx = Sfx;
  // 调试/离线试听钩子：仅当显式置 root.__FRXXZ_AUDIO_DEBUG__ 时暴露内部引擎（生产默认不挂，无副作用）。
  // 配合 AMB._dest 可把环境床改接 MediaStreamDestination 录样，做"无旋律"质量核验。
  try { if (root.__FRXXZ_AUDIO_DEBUG__) { Sfx._amb = AMB; Sfx._bgm = BGM; } } catch (e) {}
  if (typeof module !== "undefined" && module.exports) module.exports = Sfx;
})(typeof window !== "undefined" ? window : globalThis);
