/* 周期三冒烟：情报面纱 / 涟漪链 / 风云榜 / 勋章 */
"use strict";
const path = require("path");
function load(f) { require(path.join(__dirname, "..", "js", f)); }
global.window = global;
load("balance.js"); load("data.js"); load("world.js"); load("loadout.js"); load("state.js");
load("combat.js"); load("npcsim.js"); load("chapters.js"); load("fortunes.js"); load("dialogue.js");
load("interactions.js"); load("story.js"); load("engine.js");

let pass = 0, fail = 0;
function ok(cond, msg) {
  if (cond) { pass++; console.log("  [OK]   " + msg); }
  else { fail++; console.log("  [FAIL] " + msg); }
}

// 静音 UI
global.UI = new Proxy({}, { get: () => () => {} });
global.Sfx = { play() {} };
global.localStorage = { _m: {}, getItem(k) { return this._m[k] || null; }, setItem(k, v) { this._m[k] = v; }, removeItem(k) { delete this._m[k]; } };

State.create("韩立", "si");
const s = State.data;

console.log("=== 情报面纱 ===");
ok(WORLD.intel && WORLD.intel.jinguang && WORLD.intel.jinguang.moves.length >= 3, "金光上人有招路情报");
ok(s.intel && typeof s.intel === "object", "存档含 intel 字段");
// 交手补全
const fakeCombat = {
  status: "win",
  player: { hp: 100, hpMax: 100, qiLayer: 3 },
  enemies: [{ name: "修仙杀手金光上人", qiLayer: 7, attacks: [{ name: "金符破空" }, { name: "剑符斩" }] }],
  stats: { "眨眼剑法": 30 },
};
Engine._recordIntelFromCombat(fakeCombat);
ok((s.intelMoves["修仙杀手金光上人"] || []).includes("金符破空"), "交手自动记招（L1）");
ok(s.intel.jinguang === 1, "交手后情报升至 L1");
// 买底细
State.give("lingshi", 2);
Engine.buyIntel("jinguang");
ok(s.intel.jinguang === 2, "买底细后 L2");
const dossierEnemy = Engine._applyDossier({ name: "修仙杀手金光上人" });
ok(dossierEnemy._dossier === true, "L2 情报令敌人带 _dossier 标记");
// 料敌必中
const c2 = new CombatAPI.Combat({ player: { name: "韩立", hp: 100, hpMax: 100, dmg: 10, sense: 5, qiLayer: 3 }, enemies: [{ name: "修仙杀手金光上人", hp: 50, hpMax: 50, dmg: 8, sense: 30, _dossier: true }] });
ok(c2.senseVs(c2.enemies[0]).seeIntent === true, "做过功课：神识弱仍可料敌（seeIntent）");

console.log("=== 涟漪链 ===");
s.ripple = null; s.rippleWindow = null; s.doneRipples = [];
// 强制启动一条链并推到窗口
s.ripple = { id: "hunter_lost", stage: 0, nextAbs: State.absMonth() };
Engine._tickRipples(1);
ok(s.ripple && s.ripple.stage === 1, "涟漪推进到确证阶段");
s.ripple.nextAbs = State.absMonth();
Engine._tickRipples(1);
ok(s.rippleWindow && s.rippleWindow.id === "herb_garden", "末段开出限时窗口");
ok(s.doneRipples.includes("hunter_lost"), "链入完成名单（不重复）");
// 窗口兑现
const herbBefore = State.count("lingcao");
Engine.doRippleWindow("herb_garden");
ok(State.count("lingcao") === herbBefore + 4, "无主药园：灵草+4 落袋");
ok(s.rippleWindow === null, "窗口兑现后关闭");
// 窗口过期
s.rippleWindow = { id: "cheap_pills", dueAbs: State.absMonth() - 1, note: "x" };
Engine._tickRipples(1);
ok(s.rippleWindow === null, "窗口到期自动消失");

console.log("=== 风云榜 / 名声 ===");
ok(WORLD.fameBoard.length >= 5, "榜上有名有姓的人物");
s.fame = 0; s.milestones = [];
Engine.addFame(25, "测试事迹");
ok(s.fame === 25, "名声累积");
Engine.addFame(10, "再立一功");   // 35 > 厉飞雨30 → 超越播报
ok(s.milestones.some(m => m.title.includes("厉飞雨")), "超越榜上人物：扬名时刻入年表");

console.log("=== 勋章 ===");
s.medals = {};
const winC = { status: "win", player: { hp: 98, hpMax: 100, qiLayer: 2 }, enemies: [{ name: "某强敌", qiLayer: 7 }], stats: { "淬毒": 60, "眨眼剑法": 20 } };
Engine._checkMedals(winC);
ok(s.medals.unscathed === 1, "全身而退判定");
ok(s.medals.poison_master === 1, "毒手药王判定（毒伤过半）");
ok(s.medals.giant_slayer === 1, "以下克上判定");
Engine._checkMedals(winC);
ok(s.medals.unscathed === 2, "重复达成计数不刷年表");

console.log(fail === 0 ? `\n========== 周期三冒烟：全部通过（${pass}） ==========` : `\n========== 失败 ${fail} 项 ==========`);
process.exit(fail ? 1 : 0);
