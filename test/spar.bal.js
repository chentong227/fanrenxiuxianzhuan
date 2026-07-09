/* 登门切磋·演武对手平衡蒙特卡洛：node test/spar.bal.js
 *
 * 切磋对手=按练气层数生成的"公平同道"（engine._makeSparFoe 同一套公式——改那边必同步这里）。
 * 胜率锚点（演武定位=社交爽点+交情内容，非关卡墙；人类对手残血会"认输"（canFlee）计入胜，
 * 故同层胜率天然偏高——锚的是别塌方（对手弱到无感）也别立墙（同层被打服过半）：
 *  - 同层对手：胜率 65%~97%（能赢、偶尔翻车才有较技感）
 *  - 高 2 层的前辈：胜率 ≤70%（挨打长学问是正常结局之一）
 *  - 低 2 层的后进：胜率 ≥85%（境界差就是境界差）
 * 玩家模拟：引擎内置 AI（_autoPlayerTurn），无底牌纯本体（真人手操+底牌只会更高）。
 */
const { Combat, Fighter } = require("../js/combat.js");

let failures = 0;
function assert(c, m) { if (c) console.log("  \u2713 " + m); else { console.log("  \u2717 \u5931\u8d25: " + m); failures++; } }

// 与 test/encounter.bal.js makePlayer 同一把尺
function makePlayer(layer) {
  const spells = ["tuna", "huti", "ningshen", "zhayan"];
  if (layer >= 3) spells.push("zhayan_lian");
  if (layer >= 8) spells.push("huodan");
  return new Fighter({
    name: "韩立", hp: 100 + (layer - 1) * 15, mp: 40 + layer * 6,
    sense: 5 + layer * 2, insight: 6, speed: 10 + Math.floor(layer / 3), move: 1,
    agility: Math.round((10 + layer) * 0.6), technique: "changchun", elem: "mu",
    grade: 1, realmTier: 0, qiLayer: layer,
    spells, pouch: {},
  });
}

// 复刻 engine._makeSparFoe 数值公式（elem 固定取 tu 做代表——五行差异靠克制系数，量级一致）
function makeSparFoe(L, elem) {
  elem = elem || "tu";
  return {
    name: "演武同道", hp: 95 + (L - 1) * 12, mp: 40 + L * 6,
    sense: 4 + L * 2, speed: 10 + Math.floor(L / 3), agility: Math.round((9 + L) * 0.6),
    move: 1, qiLayer: L, elem, armor: elem === "tu" ? 2 : L >= 5 ? 1 : 0,
    tactics: L >= 5 ? "cunning" : undefined, nature: "human",
    attacks: [
      { name: "演武甲式", dmg: 14 + L * 2, kind: "normal", weight: 12, elem, mp: 5 + Math.floor(L / 2), range: [1, 3] },
      { name: "演武乙式", dmg: 10 + Math.round(L * 1.8), kind: "pierce", weight: 8, mp: 6, range: [1, 1] },
      { name: "演武丙式", dmg: 17 + Math.round(L * 2.8), kind: "charge", weight: 5, mp: 9 + Math.floor(L / 2), range: [1, 4] },
    ],
  };
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

function winRate(pl, fl, elem, N = 300) {
  let w = 0;
  for (let i = 0; i < N; i++) {
    const c = new Combat({ player: makePlayer(pl), enemies: [makeSparFoe(fl, elem)], maxRounds: 18, W: 11, lanes: 2, enemyPos: 5 });
    c.startRound();
    if (autopilot(c) === "win") w++;
  }
  return w / N;
}
const pct = (x) => (x * 100).toFixed(0) + "%";

console.log("\n========== 登门切磋·演武平衡（AI 无底牌下限） ==========\n");

for (const L of [2, 4, 7]) {
  const same = winRate(L, L);
  console.log(`  练气${L}层 vs 同层演武同道：胜率 ${pct(same)}`);
  assert(same >= 0.65 && same <= 0.97, `同层演武胜率在 65%~97%（实 ${pct(same)}）`);
}

{
  const up = winRate(3, 5);
  console.log(`  练气3层 vs 练气5层前辈：胜率 ${pct(up)}`);
  assert(up <= 0.7, `高2层前辈胜率压得住（≤70%，实 ${pct(up)}）——挨打长学问是正常结局之一`);
}
{
  const down = winRate(6, 4);
  console.log(`  练气6层 vs 练气4层后进：胜率 ${pct(down)}`);
  assert(down >= 0.8, `低2层后进当稳赢（≥80%，实 ${pct(down)}）——境界差就是境界差`);
}
// 木克土红利：韩立木行打土行对手应占克制便宜（对照组：打火行吃生克反噬）
{
  const vsTu = winRate(4, 4, "tu");
  const vsHuo = winRate(4, 4, "huo");
  console.log(`  同层对土行 ${pct(vsTu)} / 对火行 ${pct(vsHuo)}（木克土应占便宜）`);
  assert(vsTu >= vsHuo - 0.08, `五行克制方向正确（对土 ${pct(vsTu)} ≳ 对火 ${pct(vsHuo)}）`);
}

console.log(failures ? `\n========== ${failures} 项未过 ==========\n` : "\n========== 演武平衡：全部通过 ✓ ==========\n");
process.exit(failures ? 1 : 0);
