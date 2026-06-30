/* 无头加载真实游戏引擎（window/document 垫片）——给 climax.bal.js 等用真实数据/真实战斗装配。
 * 暴露 global: DATA/Balance/WORLD/State/Combat/Engine/Chapters 等（与浏览器同源，零纸面副本）。 */
const path = require("path");

// —— 最小 window/document 垫片：游戏脚本挂全局对象用，无需真 DOM ——
const noop = () => {};
const stubEl = () => new Proxy({}, { get: (t, k) => (k in t ? t[k] : (typeof k === "string" && /^(add|remove|set|append|query|get|create|insert|focus|blur|click|scroll)/.test(k) ? noop : undefined)), set: (t, k, v) => { t[k] = v; return true; } });
global.window = global;
global.document = {
  getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
  createElement: stubEl, body: stubEl(), addEventListener: noop, documentElement: stubEl(),
};
global.localStorage = { _d: {}, getItem(k){ return this._d[k] ?? null; }, setItem(k, v){ this._d[k] = String(v); }, removeItem(k){ delete this._d[k]; } };
global.location = { search: "", href: "", hash: "" };
global.requestAnimationFrame = noop; global.cancelAnimationFrame = noop;
global.navigator = { userAgent: "node" };
global.fetch = undefined;

// —— UI/特效/音频/美术 全 no-op 垫片（战斗逻辑不依赖它们的返回值）——
const allNoop = new Proxy({}, { get: () => () => {}, has: () => true });
global.UI = allNoop;
global.Sfx = allNoop;
global.Fx = new Proxy({}, { get: (t, k) => (k === "ambient" || k === "ensure" ? () => false : () => {}) });
global.Art = new Proxy({}, { get: (t, k) => (k === "has" || k === "hasBattler" ? () => false : (k === "url" || k === "battlerUrl" ? () => null : () => {})) });
global.Cutscene = allNoop;
global.Audio = allNoop;
global.LLM = allNoop;

const root = path.join(__dirname, "..", "js");
// 模块序（同 index.html）：data → balance → world → state → combat → ... → engine
const order = [
  "data.js", "balance.js", "world.js", "state.js", "loadout.js", "combat.js",
  "explore.js", "exploremap.js", "story.js", "chapters.js", "engine.js",
];
for (const f of order) {
  try { require(path.join(root, f)); } catch (e) { /* UI/art/audio 等非战斗模块缺失无碍 */ }
}

module.exports = {
  DATA: global.DATA, Balance: global.Balance, WORLD: global.WORLD,
  State: global.State, Combat: global.CombatAPI ? global.CombatAPI.Combat : global.Combat,
  CombatAPI: global.CombatAPI, Engine: global.Engine, Chapters: global.Chapters,
};
