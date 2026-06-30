/* 高潮越阶战·一致感锚点蒙特卡洛：node test/climax.bal.js
 *
 * 立项依据：docs/playtest-fullrun-2026-06-30.md「全篇章高潮越阶战·一致感审计」。
 * 守的三条律（写新内容/改战斗数值后必跑绿）：
 *  1. 一致感：剧情许诺"凶险/越阶恶战"的战斗，数值上必须真凶险——不能末血 90%+ 毫发无伤。
 *  2. 越阶生存公理（pacing-design §五）：同阶碾压；越阶恶战赢不轻松、且一定见血。
 *  3. 爽文契约：输在准备、不输得莫名其妙——fail-forward（败有所得，非死锁）。
 *
 * ★ 方法（与 encounter.bal.js 的纸面副本不同·零漂移）：
 *   通过 test/_loadgame.js 在 node 下用 window/document 垫片**加载真实游戏引擎**
 *   （data/world/state/combat/story/chapters/engine 全真），再读**真实存档**、调**真实战斗装配**
 *   （Engine.startXxxFight——含真同道/真阵法/真站位/真 loadout），autoResolve 蒙特卡洛。
 *   ——量的就是玩家在那个剧情节点的真实战斗体验，不是重постро的近似。
 *
 * ⚠ 口径：AI autoResolve≈高水位手操（走位/抓趁虚/抢秒），末血是乐观估计；真人无视预警更低。
 *   胜率含同道佐助＝真实玩家口径（非剥离的本体下限）。
 */
const fs = require("fs");
const path = require("path");
const G = require("./_loadgame.js");
const { State, Engine } = G;

let failures = 0;
function assert(c, m) { if (c) console.log("  \u2713 " + m); else { console.log("  \u2717 \u5931\u8d25: " + m); failures++; } }
const pct = (x) => (x * 100).toFixed(0) + "%";

function loadSave(file) {
  const raw = fs.readFileSync(path.join(__dirname, "..", "playtest", file), "utf8");
  global.localStorage.setItem("frxxz_save_v1", raw);
  if (!State.load()) throw new Error("存档读取失败: " + file);
}

// 跑一场真实战斗 N 次（setup 负责装配并把战斗挂到 Engine._combat）
// addTrumps：可选，给玩家补"备战底牌"——验证越阶/恶战的底牌路径（爽文契约·输在准备）
function montecarlo(save, setup, N, addTrumps) {
  N = N || 120;
  loadSave(save);                       // 每场重置到存档初态（loadout/inventory/flags 真实）
  const baseFlags = JSON.stringify(State.data.flags);
  const baseInv = JSON.stringify(State.data.inventory || {});
  const baseSpells = JSON.stringify(State.data.spells || []);
  let wins = 0, hpSum = 0, rounds = 0, lose = 0;
  for (let i = 0; i < N; i++) {
    State.data.flags = JSON.parse(baseFlags);
    State.data.inventory = JSON.parse(baseInv);
    State.data.spells = JSON.parse(baseSpells);
    if (addTrumps) {
      const inv = State.data.inventory;
      ["huoshe_fu", "hanbing_fu", "dingshen_fu", "anqi", "duyao_cao", "huixue_dan", "huiyuan_dan"].forEach(k => inv[k] = (inv[k] || 0) + 3);
      ["weidu", "feizhen", "huoshe_fu", "hanbing_fu", "dingshen_fu"].forEach(sp => { if (!State.data.spells.includes(sp)) State.data.spells.push(sp); });
    }
    State.data.pendingEvent = null; State.data.combat = false; State.data.exmap = null;
    State.data.hp = State.data.hpMax;
    setup();
    const c = Engine._combat;
    if (!c) throw new Error("战斗未装配");
    const st = c.autoResolve(40);
    if (st === "win") { wins++; hpSum += Math.max(0, c.player.hp / c.player.hpMax); }
    else lose++;
    rounds += c.round;
  }
  return { win: wins / N, endHp: wins ? hpSum / wins : 0, rounds: rounds / N, lose: lose / N };
}

console.log("\n=== 高潮越阶战·一致感锚点（真引擎·真存档·真战斗装配·含同道佐助） ===\n");

// —— 黄枫谷·墨蛟（越阶高潮·南宫婉同道·剧情=数值范本）——
// 锚点选 win-rate 恶战带（最稳健的"凶险"信号）：本体 loadout 下 30~85%＝赢不轻松、也非死局。
const mj = montecarlo("save-huangfeng-jindi.json", () => {
  Engine._nextFightType = "mojiao";
  Engine._sideOverride = Engine._nangongwanAlly ? Engine._nangongwanAlly() : null;
  Engine.startEncounterFight("mojiao");
});
console.log(`  · 墨蛟（练气11·南宫婉并肩）：胜率 ${pct(mj.win)} / 末血 ${pct(mj.endHp)} / ${mj.rounds.toFixed(1)}回合`);
assert(mj.win >= 0.30 && mj.win <= 0.85, `墨蛟胜率落在越阶恶战带 30~85%（${pct(mj.win)}）——赢不轻松、也非死局（一致感·防 boss 滑向无牙或死局）`);

// —— 黄枫谷·封岳（狙杀者·越阶·底牌路径）：本体难胜，备底牌则可期（爽文契约·输在准备）——
const fyBare = montecarlo("save-huangfeng-jindi.json", () => {
  Engine._nextFightType = "fengyue"; Engine.startEncounterFight("fengyue");
});
const fyTrump = montecarlo("save-huangfeng-jindi.json", () => {
  Engine._nextFightType = "fengyue"; Engine.startEncounterFight("fengyue");
}, 120, true);
console.log(`  · 封岳（练气11·狙杀者）：本体 ${pct(fyBare.win)} → 备底牌 ${pct(fyTrump.win)}/末血${pct(fyTrump.endHp)}`);
assert(fyBare.win <= 0.55, `封岳·本体不轻取（≤55%·${pct(fyBare.win)}）——越阶靠底牌咬`);
assert(fyTrump.win - fyBare.win >= 0.10, `封岳·底牌路径成立：备底牌胜率显著回升（+${Math.round((fyTrump.win - fyBare.win) * 100)}pt）——输在准备、备则可期`);

// —— 黄枫谷·陆云风（同阶恶战·死局你不躲·底牌路径）——
const lyTrump = montecarlo("save-huangfeng-jindi.json", () => {
  Engine.startLuyunfengFight();
}, 120, true);
console.log(`  · 陆云风（同阶恶战·备底牌）：胜率 ${pct(lyTrump.win)} / 末血 ${pct(lyTrump.endHp)} / ${lyTrump.rounds.toFixed(1)}回合`);
assert(lyTrump.win >= 0.60, `陆云风·备底牌可胜（≥60%·${pct(lyTrump.win)}）——同阶恶战·准备到位则赢`);
assert(lyTrump.endHp <= 0.85, `陆云风·赢也有损耗：末血≤85%（${pct(lyTrump.endHp)}）——同阶恶战非无伤`);

// —— 初入星海·斩婴鲤兽（越阶高潮·v269 加蓄力杀招后·三人围杀）——
const yl = montecarlo("save-starsea-kuixing.json", () => {
  Engine.startStarseaYingliFight();
});
console.log(`  · 婴鲤兽（金丹大成·三人围杀·v269 蓄力杀招）：胜率 ${pct(yl.win)} / 末血 ${pct(yl.endHp)} / ${yl.rounds.toFixed(1)}回合`);
assert(yl.win >= 0.80, `婴鲤兽·三人阵高胜率（≥80%·${pct(yl.win)}）——越阶靠准备/同道，赢得漂亮`);
assert(yl.endHp <= 0.90, `婴鲤兽·蓄力杀招见牙：末血≤90%（${pct(yl.endHp)}）——v269 一致感修不被回滚（防再次滑成毫发无伤）`);

console.log(`\n========== 高潮战一致感锚点：${failures === 0 ? "全部通过 \u2713" : failures + " 项失败 \u2717"} ==========\n`);
process.exit(failures === 0 ? 0 : 1);
