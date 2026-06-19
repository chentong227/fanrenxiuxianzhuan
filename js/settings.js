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
