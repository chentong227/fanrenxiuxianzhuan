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

    // 2.5D 前景框预设库（纯 CSS·近景遮挡，docs/depth-presets.md）——值即 data-fg，CSS 据此画框。
    //   接入＝地点 env.depth.fg 选一个 + far(0..1) 调远雾；不在表内＝不画框（仅远景气层，data-fg 留空）。
    FG_PRESETS: ["cave", "interior", "hall", "market", "forest", "mountain", "water", "mist"],
    FG_PRESET_CN: { cave: "洞窟", interior: "室内/洞府", hall: "殿堂", market: "坊市", forest: "林", mountain: "山野", water: "水景", mist: "纯雾" },
    isFgPreset(fg) { return typeof fg === "string" && this.FG_PRESETS.includes(fg); },

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

    // 地点 → 2.5D 纵深配置（前景分层，docs/staging-experience-design.md §3 B1 / §10 R1）。
    //   返回 {fg, far[, layers]} 或 null（不配置＝单层背景，零回归）。
    //   · fg   = 前景框预设（见 FG_PRESETS：cave/interior/hall/market/forest/mountain/water/mist）——近景遮挡，不被天气/时辰染。
    //   · far  = 远景雾强度 0..1（默认 0.5），驱动 CSS 远景气层（空气透视）。
    //   · layers = 预留：[{src, depth}] 真分层切图就位后逐层差速位移（资产未齐时走程序化前景/远雾兜底）。
    depthFor(loc) {
      const e = loc && loc.env;
      if (e && e.depth && typeof e.depth === "object") return e.depth;
      return null;
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
      // 2.5D 纵深骨架（§10 R1）：配了 depth 的地点开前景分层，data-fg 驱动前景框层；
      //   未配置＝单层背景，data-depth/fg 清空，CSS 不开远雾/前景框（零回归）。
      const d = this.depthFor(loc);
      stageEl.dataset.depth = d ? "on" : "";
      // fg 仅认预设库内的值（防错配）：未知/缺省＝不画前景框（仍开远景气层，data-fg 留空）
      stageEl.dataset.fg = (d && this.isFgPreset(d.fg)) ? d.fg : "";
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
