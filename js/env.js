/* ============================================================
 * env.js — 昼夜·天气骨架（地点级氛围：时辰 + 天气 → 染色 / 环境床 / 粒子）
 *
 * 设计（docs/staging-experience-design.md §9-1）：让整张地图"活"，不止演出那几幕。
 *  一次投入驱动三件事：① 场景染色 tint（墨黑烛金里的冷暖偏移）
 *                      ② 地点级环境床（昼:市声 / 夜:虫鸣萤火 / 雨:檐滴）
 *                      ③ 可选氛围粒子（雨丝/落叶/飞雪/雾）。
 *
 *  时辰来源：游戏无"日内时钟"（只按 year/month 推月）——故
 *    · 时辰 = 地点配置（loc.env.phase，缺省"昼"）；
 *    · 天气 = 按 month 推季（冬→雪 / 夏→雨 / 余→晴），地点可覆盖；户外地点才随季。
 *  解析优先级：演出/调试覆盖 > 地点 env 配置 > 季节默认。
 *
 *  纯函数（resolve/phaseFor/weatherFor/ambientFor）无 DOM，可无头测试 test/env.test.js；
 *  apply() 触 DOM（仅浏览器），缺依赖即静默——未打 env 的地点零回归（昼·晴·无床）。
 * ============================================================ */
(function (root) {
  "use strict";

  const has = (o, k) => o && Object.prototype.hasOwnProperty.call(o, k);

  const Env = {
    // 时辰（晨/昼/暮/夜）与天气（晴/雨/雪/雾）——值即 data-phase/data-weather，CSS 据此染色/落粒子
    PHASES: ["dawn", "day", "dusk", "night"],
    WEATHERS: ["clear", "rain", "snow", "fog"],
    PHASE_CN: { dawn: "晨", day: "昼", dusk: "暮", night: "夜" },
    WEATHER_CN: { clear: "晴", rain: "雨", snow: "雪", fog: "雾" },

    // 演出/调试覆盖（null=按地点解析）。set/clear 由演出或调试驱动。
    _override: { phase: null, weather: null },

    set(phase, weather) {
      if (phase !== undefined) this._override.phase = phase || null;
      if (weather !== undefined) this._override.weather = weather || null;
    },
    clear() { this._override = { phase: null, weather: null }; },

    // 当前绝对月（用于推季）——缺 State 时回退 1 月（冬，确保可无头测试时显式传 month 覆盖）
    _month(now) {
      if (now && typeof now.month === "number") return now.month;
      try {
        const s = root.State && root.State.data;
        if (s && typeof s.month === "number") return s.month;
      } catch (e) {}
      return 1;
    },

    // 按月推季：冬(12/1/2)→雪，夏(6/7)→雨，余→晴
    seasonalWeather(now) {
      const m = this._month(now);
      if (m === 12 || m === 1 || m === 2) return "snow";
      if (m === 6 || m === 7) return "rain";
      return "clear";
    },

    // 地点 → 时辰（地点 env.phase 优先；缺省"昼"）
    phaseFor(loc) {
      const e = loc && loc.env;
      if (e && this.PHASES.includes(e.phase)) return e.phase;
      return "day";
    },

    // 地点 → 天气（地点 env.weather 优先；户外地点(env.outdoor)随季；余"晴"）
    weatherFor(loc, now) {
      const e = loc && loc.env;
      if (e && this.WEATHERS.includes(e.weather)) return e.weather;
      if (e && e.outdoor) return this.seasonalWeather(now);
      return "clear";
    },

    // 当前生效（演出/调试覆盖 > 地点）
    resolve(loc, now) {
      const o = this._override || {};
      return {
        phase: (o.phase && this.PHASES.includes(o.phase)) ? o.phase : this.phaseFor(loc),
        weather: (o.weather && this.WEATHERS.includes(o.weather)) ? o.weather : this.weatherFor(loc, now),
      };
    },

    // 地点 → 环境床 id（夜→夜虫 / 雨→檐滴 …）。返回 null=不放床、照常 BGM。
    //   地点 env.amb 显式覆盖（含显式 null=诡谧静默，如密室）；否则按天气、再按时辰推。
    ambientFor(loc, now) {
      const e = loc && loc.env;
      if (e && has(e, "amb")) return e.amb || null;   // 显式（含 null）优先
      const { phase, weather } = this.resolve(loc, now);
      if (weather === "rain") return "rain";
      if (phase === "night" || phase === "dusk") return "night";
      return null;
    },

    /* 施加到地图舞台：写 data-phase/data-weather（驱动 CSS 染色+粒子），并确保两层 overlay 存在。
     * stageEl=#scene-stage。仅浏览器调用；缺 DOM 即静默。 */
    apply(stageEl, loc, now) {
      if (!stageEl || !stageEl.dataset) return null;
      const r = this.resolve(loc, now);
      this._ensureLayer(stageEl, "scene-tint");
      this._ensureLayer(stageEl, "scene-weather");
      stageEl.dataset.phase = r.phase;
      stageEl.dataset.weather = r.weather;
      return r;
    },
    _ensureLayer(stageEl, cls) {
      try {
        if (stageEl.querySelector("." + cls)) return;
        const doc = stageEl.ownerDocument;
        if (!doc) return;
        const veil = stageEl.querySelector(".scene-veil");
        const el = doc.createElement("div");
        el.className = cls;
        // 压在背景/暗角之上、题字/图钉之下（z-index 由 CSS 定）；插到暗角后保 DOM 有序
        if (veil && veil.nextSibling) stageEl.insertBefore(el, veil.nextSibling);
        else stageEl.appendChild(el);
      } catch (e) {}
    },
  };

  root.Env = Env;
  if (typeof module !== "undefined" && module.exports) module.exports = Env;

})(typeof window !== "undefined" ? window : globalThis);
