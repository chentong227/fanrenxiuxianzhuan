/* A2 承重墙·标度校准蒙特卡洛：node test/scale.bal.js
 *
 * 校准"尺子"本身（balance.js 几何标度 + 法宝驱动门槛），验证 D5 本期范围=只把尺子校准对：
 *   ① 好招÷敌血·轴内恒定——同阶里一招好术≈敌血固定百分比，每个大境界都一样（几何标度的全部意义）。
 *   ② 越阶胜率带——高两阶碾旧阶（裸招即可）；低两阶裸招打不动（须靠底牌咬），realmBand 拉出真实代差。
 *   ③ TTK 带——同阶对局回合数落在稳定带内（每个境界都"能打但要打"，不会 1 招秒、也不会磨不死）。
 *   ④ 元婴同阶致死率不趋零——治"元婴用眨眼只有 20"的根：几何标度下高阶招式占血比≈练气期，
 *      而旧线性标度会塌缩到近零（本测固化这条对比，防回退）。
 *   ⑤ 驱动门槛——练气号驱结丹本命法宝就该弱（×0.45）、达标本命才主战（×1.35）、消耗性底牌不吃折扣。
 *
 * 高阶敌我皆为"合成同档单位"（HP 与攻击同吃 realmBand，与玩家一把尺子）——本期不造高阶实战内容，
 * 只用尺子验标度不塌缩；高阶实战内容随后续篇章推进时自然吃这把尺子（见 AGENTS.md §四 A2 硬约束）。
 */
const B = require("../js/balance.js");
const { Combat, Fighter } = require("../js/combat.js");

let failures = 0;
function assert(c, m) { if (c) console.log("  \u2713 " + m); else { console.log("  \u2717 \u5931\u8d25: " + m); failures++; } }
const pct = (x) => (x * 100).toFixed(0) + "%";
const TIER = { 0: "\u7ec3\u6c14", 1: "\u7b51\u57fa", 2: "\u7ed3\u4e39", 3: "\u5143\u5a74", 4: "\u5316\u795e" };

/* ---- 合成同档单位（HP/攻击随 realmBand 同档放大；与玩家共用一把尺子）---- */
function bandHp(tier, base) { return Math.round(base * B.realmBand(tier)); }
function tierPlayer(tier) {
  // 主攻=火弹术(art,24)/金光砖(art,42)——法术吃几何 realmBand；佐以吐纳护体续航
  return new Fighter({
    name: "\u97e9\u7acb", hp: bandHp(tier, 100), mp: B.manaPool(tier, 6, 1, 0),
    sense: 6 + tier * 3, insight: 6, speed: 10 + tier * 2, move: 1, agility: 8,
    technique: "changchun", elem: "mu", grade: 1, realmTier: tier, qiLayer: 6,
    spells: ["tuna", "huti", "huodan", "jinguang_zhuan"],
  });
}
function tierEnemy(tier) {
  const m = B.realmBand(tier);
  return {
    name: "\u540c\u9636\u9053\u4fee", hp: bandHp(tier, 100), sense: 5 + tier * 3, speed: 10 + tier * 2,
    agility: 7, move: 1, mp: B.manaPool(tier, 6, 1, 0), realmTier: tier, elem: "tu",
    attacks: [
      { name: "\u6cd5\u51fb", dmg: Math.round(16 * m), kind: "normal", weight: 12, range: [1, 4], mp: 6 },
      { name: "\u84c4\u52bf", dmg: Math.round(20 * m), kind: "charge", weight: 5, range: [1, 4], mp: 10 },
    ],
  };
}
function duel(pTier, eTier) {
  const c = new Combat({ player: tierPlayer(pTier), enemies: [tierEnemy(eTier)], maxRounds: 40 });
  c.startRound();
  let g = 0, rounds = 0;
  while (c.status === "ongoing" && g++ < 80) {
    c._autoPlayerTurn();
    if (c.status !== "ongoing") break;
    c.endRound(); rounds++;
    if (c.status !== "ongoing") break;
    c.startRound();
  }
  return { win: c.status === "win", rounds };
}
function agg(pTier, eTier, N = 200) {
  let w = 0, rs = 0;
  for (let i = 0; i < N; i++) { const r = duel(pTier, eTier); if (r.win) { w++; rs += r.rounds; } }
  return { win: w / N, ttk: w ? rs / w : 0 };
}

console.log("\n=== A2 \u627f\u91cd\u5899\u00b7\u6807\u5ea6\u6821\u51c6\uff08\u51e0\u4f55 realmBand + \u9a71\u52a8\u95e8\u69db\uff09 ===");

/* ---- 断言①：好招÷敌血·轴内恒定 ---- */
console.log("\n[\u2460 \u597d\u62db\u00f7\u654c\u8840\u00b7\u8f74\u5185\u6052\u5b9a]");
const r0 = B.spellPower(42, "art", 1, 0) / (100 * B.realmBand(0));
let maxDev = 0;
for (const t of [0, 1, 2, 3, 4]) {
  const ratio = B.spellPower(42, "art", 1, t) / (100 * B.realmBand(t));
  const dev = Math.abs(ratio - r0) / r0;
  if (dev > maxDev) maxDev = dev;
  console.log(`  \u00b7 ${TIER[t]}(t${t})\uff1a\u4e00\u62db\u91d1\u5149\u7816 \u5360\u540c\u9636\u654c\u8840 ${pct(ratio)}`);
}
assert(maxDev <= 0.08, `\u597d\u62db\u5360\u654c\u8840\u767e\u5206\u6bd4\u8de8\u5168\u5883\u754c\u6052\u5b9a\uff08\u6700\u5927\u504f\u5dee ${pct(maxDev)}\uff0c\u671f\u671b\u22648%\uff09\u2014\u2014\u51e0\u4f55\u6807\u5ea6\u5bf9\u9f50`);

/* ---- 断言②：越阶胜率带 ---- */
console.log("\n[\u2461 \u8d8a\u9636\u80dc\u7387\u5e26]");
const up = [agg(2, 0), agg(3, 1)];
const down = [agg(0, 2), agg(1, 3)];
up.forEach((r, i) => console.log(`  \u00b7 \u9ad8\u4e24\u9636 vs \u65e7\u9636 #${i + 1}\uff1a\u80dc\u7387 ${pct(r.win)}`));
down.forEach((r, i) => console.log(`  \u00b7 \u4f4e\u4e24\u9636\u88f8\u62db vs \u9ad8\u9636 #${i + 1}\uff1a\u80dc\u7387 ${pct(r.win)}`));
assert(up.every(r => r.win >= 0.9), `\u9ad8\u4e24\u9636\u88f8\u62db\u78be\u65e7\u9636\uff08\u5747\u22650.9\uff09\u2014\u2014\u201c\u53d8\u5f3a\u53ef\u611f\u201d`);
assert(down.every(r => r.win <= 0.2), `\u4f4e\u4e24\u9636\u88f8\u62db\u6253\u4e0d\u52a8\u9ad8\u9636\uff08\u5747\u22640.2\uff09\u2014\u2014\u201c\u8d8a\u9636\u9760\u5e95\u724c\u54ac\u201d\uff0c\u88f8\u62db\u4e0d\u80fd\u8d62`);

/* ---- 断言③：TTK 带（同阶对局回合数稳定）---- */
console.log("\n[\u2462 TTK \u5e26\uff08\u540c\u9636\u5bf9\u5c40\uff09]");
let ttkOk = true;
for (const t of [0, 2, 3, 4]) {
  const r = agg(t, t);
  const within = r.ttk >= 3 && r.ttk <= 16;
  if (!within) ttkOk = false;
  console.log(`  \u00b7 ${TIER[t]}(t${t}) \u540c\u9636\uff1a\u80dc\u7387 ${pct(r.win)} / TTK ${r.ttk.toFixed(1)} \u56de\u5408`);
}
assert(ttkOk, "\u540c\u9636\u5bf9\u5c40 TTK \u8de8\u5883\u754c\u843d\u5728\u7a33\u5b9a\u5e26\uff08\u671f\u671b 3~16 \u56de\u5408\uff09\u2014\u2014\u4e0d\u79d2\u6740\u4e5f\u4e0d\u78e8\u4e0d\u6b7b");

/* ---- 断言④：元婴同阶致死率不趋零（vs 旧线性标度的塌缩对比）---- */
console.log("\n[\u2463 \u5143\u5a74\u540c\u9636\u81f4\u6b7b\u7387\u4e0d\u8d8b\u96f6]");
const oldLinear = (base, t) => base * (1 + t * 0.35);     // \u65e7\u7ebf\u6027 realmScale(art)
const baseMove = 12;                                       // \u201c\u7728\u773c\u201d\u7c7b\u8f7b\u62db\u57fa\u6570
const newQi = B.spellPower(baseMove, "art", 1, 0) / (100 * B.realmBand(0));
const newYj = B.spellPower(baseMove, "art", 1, 3) / (100 * B.realmBand(3));
const oldYj = oldLinear(baseMove, 3) / (100 * B.realmBand(3));
console.log(`  \u00b7 \u7ec3\u6c14\u7728\u773c\u5360\u8840 ${pct(newQi)}\uff1b\u5143\u5a74\u7728\u773c\u5360\u8840\uff1a\u65b0\u51e0\u4f55 ${pct(newYj)} / \u65e7\u7ebf\u6027 ${pct(oldYj)}\uff08\u5854\u7f29\uff09`);
assert(newYj >= newQi * 0.8, `\u5143\u5a74\u540c\u9636\u8f7b\u62db\u5360\u8840 \u4e0e\u7ec3\u6c14\u671f\u6301\u5e73\uff08\u65b0 ${pct(newYj)} \u2265 0.8\u00d7 ${pct(newQi)}\uff09\u2014\u2014\u4e0d\u8d8b\u96f6`);
assert(newYj >= oldYj * 3, `\u65b0\u51e0\u4f55\u6807\u5ea6\u4fee\u590d\u65e7\u7ebf\u6027\u5854\u7f29\uff08\u5143\u5a74\u7728\u773c ${pct(newYj)} \u2265 3\u00d7\u65e7 ${pct(oldYj)}\uff09\u2014\u2014\u6cbb\u201c\u5143\u5a74\u7728\u773c\u53ea\u670920\u201d\u7684\u6839`);

/* ---- 断言⑤：法宝驱动门槛 driveRealm + 本命 natal + 消耗底牌豁免 ---- */
console.log("\n[\u2464 \u9a71\u52a8\u95e8\u69db driveRealm + \u672c\u547d natal]");
const drUnderNatal = B.driveMul(0, 2, true, false);   // \u7ec3\u6c14\u9a71\u7ed3\u4e39\u672c\u547d\u6cd5\u5b9d
const drMetNatal = B.driveMul(2, 2, true, false);     // \u7ed3\u4e39\u8fbe\u6807\u672c\u547d
const drConsumable = B.driveMul(0, 2, false, true);   // \u7ec3\u6c14\u9a71\u6d88\u8017\u6027\u5e95\u724c
const drOrdinary = B.driveMul(0, 0, false, false);    // \u5bfb\u5e38\u6cd5\u5668\uff08\u65e0\u95e8\u69db\uff09
console.log(`  \u00b7 \u7ec3\u6c14\u9a71\u7ed3\u4e39\u672c\u547d ${drUnderNatal} / \u7ed3\u4e39\u8fbe\u6807\u672c\u547d ${drMetNatal} / \u6d88\u8017\u5e95\u724c ${drConsumable} / \u5bfb\u5e38\u6cd5\u5668 ${drOrdinary}`);
assert(drUnderNatal <= 0.5, `\u8d8a\u9636\u5f3a\u9a71\u672c\u547d\u6cd5\u5b9d\u6253\u6298\uff08\u00d7${drUnderNatal} \u2264 0.5\uff09\u2014\u2014\u53e4\u5b9d\u552f\u9ad8\u5883\u53ef\u9a71`);
assert(drMetNatal >= 1.3, `\u8fbe\u6807\u672c\u547d\u6cd5\u5b9d\u4e3b\u6218\u52a0\u6210\uff08\u00d7${drMetNatal} \u2265 1.3\uff09`);
assert(drMetNatal / drUnderNatal >= 2.5, `\u8fbe\u6807\u00f7\u8d8a\u9636 \u4ee3\u5dee\u663e\u8457\uff08${(drMetNatal / drUnderNatal).toFixed(2)}x \u2265 2.5\uff09`);
assert(drConsumable >= 0.99, `\u6d88\u8017\u6027\u5e95\u724c\uff08chargeCost\uff09\u4e0d\u5403\u95e8\u69db\u6298\u6263\uff08\u00d7${drConsumable}\uff09\u2014\u2014\u7279\u533a\u5e95\u724c\u8d70\u4e58\u6027\u7a7f\u900f`);
assert(drOrdinary === 1, `\u5bfb\u5e38\u6cd5\u5668\uff08\u65e0 driveRealm\uff09\u9010\u5b57\u8282\u96f6\u6270\u52a8\uff08\u00d7${drOrdinary}\uff09`);

console.log(`\n========== A2 \u6807\u5ea6\u6821\u51c6\uff1a${failures === 0 ? "\u5168\u90e8\u901a\u8fc7 \u2713" : failures + " \u9879\u5931\u8d25 \u2717"} ==========\n`);
process.exit(failures === 0 ? 0 : 1);
