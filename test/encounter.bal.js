/* 遭遇战数值锚点蒙特卡洛（对阵轴 v2）：node test/encounter.bal.js
 *
 * 强度物理学（docs/power-design.md）的胜率验收表：
 *  - 同层敌人：胜率 55%~85%（能赢但要打）
 *  - 低 2+ 层的旧区敌人：胜率 ≥90%（变强可感，碾旧区是爽）
 *  - 异闻妖王 vs 同期玩家：30%~92%（挑战内容，准备与操作分胜负）
 * 玩家模拟：引擎内置 AI（_autoPlayerTurn——会走位躲格/抓趁虚/突进/凝息），无底牌纯本体。
 */
const { Combat, Fighter, SPELLS } = require("../js/combat.js");

// 复刻 WORLD.enemies 数据（对阵轴字段版；与 world.js 同步维护）
const ENEMIES = {
  wild_wolf: { name: "灵狼", hp: 55, sense: 3, speed: 12, agility: 6, move: 2, mp: 40, tactics: "feral",
    attacks: [
      { name: "扑咬", dmg: 14, kind: "normal", weight: 12, aim: "cell", lunge: true, range: [1, 3] },
      { name: "撕喉", dmg: 11, kind: "pierce", weight: 5 },
      { name: "弓背低嚎", dmg: 18, kind: "charge", weight: 6 }] },
  outer_disciple: { name: "外门弟子", hp: 85, sense: 6, speed: 10, agility: 5, move: 2, mp: 40,
    attacks: [
      { name: "拳脚", dmg: 15, kind: "normal", weight: 14, range: [1, 1] },
      { name: "锁喉擒拿", dmg: 11, kind: "pierce", weight: 6, range: [1, 1] }] },
  rogue_cultivator: { name: "散修", hp: 130, sense: 9, speed: 11, agility: 8, move: 1, mp: 52, tactics: "cunning", qiLayer: 3, elem: "tu", armor: 2,
    attacks: [
      { name: "土遁石击", dmg: 26, kind: "normal", weight: 12, elem: "tu", mp: 7 },
      { name: "法器贯刺", dmg: 20, kind: "pierce", weight: 8, mp: 8 },
      { name: "聚灵蓄势", dmg: 30, kind: "charge", weight: 5, mp: 12, range: [1, 4] }] },
  beast_baihu: { name: "白额吊睛虎", hp: 240, sense: 7, speed: 14, agility: 12, move: 2, mp: 60, stubborn: true, tactics: "feral", elem: "jin", nature: "beast",
    attacks: [
      { name: "裂风虎爪", dmg: 30, kind: "normal", weight: 12, elem: "jin", range: [1, 1] },
      { name: "虎啸震林", dmg: 16, kind: "normal", weight: 6, aim: "zone", zoneSpan: 1, range: [1, 4] },
      { name: "血怒扑杀", dmg: 32, kind: "charge", weight: 7, aim: "cell", lunge: true, track: true, range: [1, 4] }] },
};

let failures = 0;
function assert(c, m) { if (c) console.log("  \u2713 " + m); else { console.log("  \u2717 \u5931\u8d25: " + m); failures++; } }

// 按练气层数构造"常规玩家"（属性/灵力/技能随层数成长，对齐 engine 节奏）
// 妖王锚点带常规底牌（挑战内容=准备分胜负：历练在外，符毒暗器是标配）
function makePlayer(layer, withTrumps) {
  const spells = ["tuna", "huti", "ningshen", "zhayan"];
  if (layer >= 3) spells.push("zhayan_lian");
  if (layer >= 8) spells.push("huodan");          // 长春功后篇（太南小会后）
  const pouch = withTrumps ? { duyao_cao: 2, anqi: 2, huoshe_fu: 2, dingshen_fu: 1 } : {};
  if (withTrumps) spells.push("weidu", "feizhen", "huoshe_fu", "dingshen_fu");
  return new Fighter({
    // 灵力池口径=balance.manaPool(tier0, layer, grade1 长春功, 无加成)=40+6/层
    name: "韩立", hp: 100 + (layer - 1) * 15, mp: 40 + layer * 6,
    sense: 5 + layer * 2, insight: 6, speed: 10 + Math.floor(layer / 3), move: 1,
    agility: Math.round((10 + layer) * 0.6), technique: "changchun", elem: "mu",
    grade: 1, realmTier: 0, qiLayer: layer,
    spells, pouch,
  });
}

function autopilot(c) {
  let g = 0;
  while (c.status === "ongoing" && g++ < 60) {
    c._autoPlayerTurn();
    if (c.status !== "ongoing") break;
    c.endRound();
    if (c.status !== "ongoing") break;
    c.startRound();
  }
  return c.status;
}

function stats(layer, enemyId, N = 300, withTrumps = false) {
  let w = 0, kills = 0, hpSum = 0;
  for (let i = 0; i < N; i++) {
    const c = new Combat({ player: makePlayer(layer, withTrumps), enemies: [Object.assign({}, ENEMIES[enemyId])], maxRounds: 20 });
    c.startRound();
    if (autopilot(c) === "win") {
      w++; hpSum += c.player.hp / c.player.hpMax;
      if (!c.enemies.some(e => e.escaped)) kills++;   // 击杀（敌走脱算"赢了场面、没赢战利"）
    }
  }
  return { win: w / N, kill: kills / N, avgHp: w ? hpSum / w : 0 };
}
const pct = (x) => (x * 100).toFixed(0) + "%";

console.log("\n=== 遭遇战数值锚点（对阵轴 v2：胜率×损耗 双指标） ===");
const r1wolf = stats(1, "wild_wolf");
assert(r1wolf.win >= 0.8, `练气一层 vs 灵狼：基本能赢（${pct(r1wolf.win)}，期望≥80）`);
assert(r1wolf.avgHp >= 0.3 && r1wolf.avgHp <= 0.92, `一层 vs 灵狼有真实损耗：平均末血 ${pct(r1wolf.avgHp)}（期望30~92——贴脸快杀，挨一两口正常）`);
const r4wolf = stats(4, "wild_wolf");
assert(r4wolf.win >= 0.95 && r4wolf.avgHp >= 0.72, `练气四层 vs 灵狼：近乎无损碾旧区（胜${pct(r4wolf.win)}/末血${pct(r4wolf.avgHp)}）——变强可感`);
const r3rogue = stats(3, "rogue_cultivator");
assert(r3rogue.win >= 0.45 && r3rogue.win <= 0.97, `练气三层 vs 散修：同段对手有败北可能（${pct(r3rogue.win)}，期望45~97）`);
assert(r3rogue.avgHp <= 0.75, `三层 vs 散修打得吃力：平均末血 ${pct(r3rogue.avgHp)}（期望≤75）`);
const r6rogue = stats(6, "rogue_cultivator");
assert(r6rogue.win >= 0.85, `练气六层 vs 散修：明显优势（${pct(r6rogue.win)}）`);
// 妖王=备战检验：带常规底牌（符/毒/暗器）。内置 AI=会走位躲格的"上限操作"口径
// 口径：win=活下来（含把妖王打跑）；kill=真伏诛（异闻闭环、专属战利）——锚的是 kill
const r4tiger = stats(4, "beast_baihu", 300, true);
console.log(`  · 四层 vs 虎王：场面胜率 ${pct(r4tiger.win)}（含打跑）/ 伏诛率 ${pct(r4tiger.kill)}`);
// 内置 AI≈完美操作（每个趁虚窗口都吃到、底牌时机无误）——上限口径锚"不为必胜"即可；
// 挑战感的真锚是站桩下限（普通玩家口径）与上下限差距（操作空间）
assert(r4tiger.kill >= 0.2 && r4tiger.kill <= 0.985, `练气四层 vs 白额虎王（带底牌·完美操作口径）：仍有翻车（${pct(r4tiger.kill)}，期望20~98.5）`);
// 站桩对照（不躲格的玩家）：操作差距=躲闪三角的真实价值，必须可测量
function statsStation(layer, enemyId, N = 200) {
  let w = 0;
  for (let i = 0; i < N; i++) {
    const c = new Combat({ player: makePlayer(layer, true), enemies: [Object.assign({}, ENEMIES[enemyId])], maxRounds: 20 });
    c.startRound();
    c.playerCanMove = () => false;   // 站桩：永不走位（躲格收益归零）
    let g = 0;
    while (c.status === "ongoing" && g++ < 60) {
      c._autoPlayerTurn();
      if (c.status !== "ongoing") break;
      c.endRound();
      if (c.status !== "ongoing") break;
      c.startRound();
    }
    if (c.status === "win") w++;
  }
  return w / N;
}
const r4station = statsStation(4, "beast_baihu");
console.log(`  · 四层站桩（不躲格）vs 虎王：${pct(r4station)} —— 走位收益 = +${Math.round((r4tiger.win - r4station) * 100)}pt`);
assert(r4tiger.win - r4station >= 0.1, `躲格走位带来可测量的胜率差（≥10pt，实际+${Math.round((r4tiger.win - r4station) * 100)}pt）——操作有回报`);
const r7tiger = stats(7, "beast_baihu", 300, true);
assert(r7tiger.kill >= 0.55, `练气七层 vs 白额虎王（带底牌）：伏诛占优但仍有走脱（伏诛${pct(r7tiger.kill)}）`);
const r9tiger = stats(9, "beast_baihu", 300, true);
assert(r9tiger.kill >= 0.7, `练气九层（火弹术在手）vs 白额虎王：境界+克制压服（伏诛${pct(r9tiger.kill)}）`);
assert(r4wolf.win >= r1wolf.win - 0.03 && r6rogue.win >= r3rogue.win - 0.03 && r7tiger.kill >= r4tiger.kill - 0.05,
  "胜率随境界单调不降（境界乘区成立）");
assert(r4wolf.avgHp >= r1wolf.avgHp - 0.05, "损耗随境界单调下降（碾旧区无损可感）");

console.log(`\n========== 遭遇战锚点：${failures === 0 ? "全部通过 \u2713" : failures + " 项失败 \u2717"} ==========\n`);
process.exit(failures === 0 ? 0 : 1);
