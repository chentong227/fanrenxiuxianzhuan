/* ============================================================
 * settings.js · §9 体验设置（P2·第三梯队）
 * 把分散的体验开关收进一处，持久化到 localStorage，并向 Fx/Cutscene/UI 暴露读取口。
 *   · 演出速度 storySpeed：0 慢 / 1 正常 / 2 快 / 3 极快 —— 返回"时长系数"乘到打字/镜头/wait 上。
 *   · 动效强度 motion：full 满 / lite 简（减重特效）/ off 关（与系统 reduced-motion 同效）。
 *   · 震动开关 haptics：委托 Fx（仍以 fx_haptics 持久化，避免双写）。
 * 纯逻辑可无头测试（localStorage/Fx/document 全部 typeof 守卫，缺失即安全降级）。
 * ============================================================ */
(function (root) {
  "use strict";

  const SPEED_SCALE = [1.5, 1, 0.6, 0.35];   // 档位→时长系数（>1 更慢、<1 更快）
  const SPEED_LABEL = ["慢", "正常", "快", "极快"];
  const MOTION_VALS = ["full", "lite", "off"];

  const Settings = {
    _speed: null,    // 0..3
    _motion: null,   // "full" | "lite" | "off"

    _ls(k) {
      try { return (typeof localStorage !== "undefined") ? localStorage.getItem(k) : null; }
      catch (e) { return null; }
    },
    _set(k, v) {
      try { if (typeof localStorage !== "undefined") localStorage.setItem(k, v); } catch (e) {}
    },

    /* —— 演出速度 —— */
    speed() {
      if (this._speed === null) {
        const v = parseInt(this._ls("set_story_speed"), 10);
        this._speed = (v >= 0 && v <= 3) ? v : 1;
      }
      return this._speed;
    },
    setSpeed(i) {
      i = i | 0;
      this._speed = (i >= 0 && i <= 3) ? i : 1;
      this._set("set_story_speed", String(this._speed));
      return this._speed;
    },
    speedScale() { return SPEED_SCALE[this.speed()]; },
    speedLabel(i) { return SPEED_LABEL[(i == null ? this.speed() : i)] || "正常"; },

    /* —— 动效强度 —— */
    motion() {
      if (this._motion === null) {
        const v = this._ls("set_motion");
        this._motion = (MOTION_VALS.indexOf(v) >= 0) ? v : "full";
      }
      return this._motion;
    },
    setMotion(m) {
      this._motion = (MOTION_VALS.indexOf(m) >= 0) ? m : "full";
      this._set("set_motion", this._motion);
      this.applyMotionClass();
      return this._motion;
    },
    /* 系统"减少动效"偏好（无障碍） */
    prefersReduced() {
      return typeof window !== "undefined" && window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    },
    /* 是否"关动效"：用户显式关 或 系统偏好减少动效 —— 与既有 reduced-motion 守卫等价 */
    reduceMotion() { return this.motion() === "off" || this.prefersReduced(); },
    /* 是否"简动效"：留可读过渡、砍重特效（顿帧/常驻氛围粒减半）；关动效已含简 */
    liteMotion() { return this.motion() === "lite"; },

    /* —— 乐音音量（v321·用户反馈"BGM 太大，字幕的声音都被遮住"）——
     * 三档乘子作用在 audio.js 的 BGM_VOL 上；音效(SFX)不受影响=对白/字幕声相对更清。 */
    _bgmVol: null,
    bgmVol() {
      if (this._bgmVol === null) {
        const v = this._ls("set_bgm_vol");
        this._bgmVol = (["low", "mid", "high"].indexOf(v) >= 0) ? v : "mid";
      }
      return this._bgmVol;
    },
    setBgmVol(v) {
      this._bgmVol = (["low", "mid", "high"].indexOf(v) >= 0) ? v : "mid";
      this._set("set_bgm_vol", this._bgmVol);
      // 即时生效：正在播的轨淡到新音量
      if (typeof root.Sfx !== "undefined" && root.Sfx.bgmVolRefresh) root.Sfx.bgmVolRefresh();
      return this._bgmVol;
    },
    bgmVolMul() { return { low: 0.45, mid: 1, high: 1.7 }[this.bgmVol()] || 1; },
    bgmVolLabel(v) { return { low: "轻", mid: "适中", high: "响" }[v || this.bgmVol()]; },

    /* —— 音效音量（v344·分轨三件）：乘子作用在 Sfx.play 的合成器增益上，BGM 不受影响 —— */
    _sfxVol: null,
    sfxVol() {
      if (this._sfxVol === null) {
        const v = this._ls("set_sfx_vol");
        this._sfxVol = (["off", "low", "mid", "high"].indexOf(v) >= 0) ? v : "mid";
      }
      return this._sfxVol;
    },
    setSfxVol(v) {
      this._sfxVol = (["off", "low", "mid", "high"].indexOf(v) >= 0) ? v : "mid";
      this._set("set_sfx_vol", this._sfxVol);
      return this._sfxVol;
    },
    sfxVolMul() { return { off: 0, low: 0.45, mid: 1, high: 1.6 }[this.sfxVol()] || 1; },
    sfxVolLabel(v) { return { off: "关", low: "轻", mid: "适中", high: "响" }[v || this.sfxVol()]; },

    /* —— 字号（v344·中年道友之友）：三档缩放挂在 html 根字号上，全 UI 等比放大 —— */
    _fontScale: null,
    fontScale() {
      if (this._fontScale === null) {
        const v = this._ls("set_font_scale");
        this._fontScale = (["std", "big", "huge"].indexOf(v) >= 0) ? v : "std";
      }
      return this._fontScale;
    },
    setFontScale(v) {
      this._fontScale = (["std", "big", "huge"].indexOf(v) >= 0) ? v : "std";
      this._set("set_font_scale", this._fontScale);
      this.applyFontScale();
      return this._fontScale;
    },
    fontScaleLabel(v) { return { std: "标准", big: "大", huge: "特大" }[v || this.fontScale()]; },
    applyFontScale() {
      if (typeof document === "undefined" || !document.documentElement) return;
      const mul = { std: 1, big: 1.12, huge: 1.24 }[this.fontScale()] || 1;
      document.documentElement.style.setProperty("--font-scale", String(mul));
      document.body && document.body.classList.toggle("font-scaled", mul !== 1);
    },

    /* —— 震动（委托 Fx，单一真相源 fx_haptics）—— */
    haptics() {
      return (typeof root.Fx !== "undefined" && root.Fx.hapticsOn) ? root.Fx.hapticsOn() : true;
    },
    setHaptics(on) {
      if (typeof root.Fx !== "undefined" && root.Fx.setHaptics) root.Fx.setHaptics(on);
      return this.haptics();
    },
    hapticsSupported() {
      return typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
    },

    /* body 上挂动效档 class（CSS 据此把 idle 动画静态化，与 @media reduced-motion 并列）。*/
    applyMotionClass() {
      if (typeof document === "undefined" || !document.body) return;
      const m = this.motion();
      document.body.classList.toggle("motion-off", m === "off");
      document.body.classList.toggle("motion-lite", m === "lite");
    },
  };

  if (typeof module !== "undefined" && module.exports) module.exports = Settings;
  if (typeof window !== "undefined") window.Settings = Settings;
  root.Settings = Settings;
})(typeof globalThis !== "undefined" ? globalThis : this);
