/* 一次性校验：克制/符箓/侧位的实战价值（不入测试套）*/
const { Combat, Fighter, SPELLS } = require("../js/combat.js");

const KIT = ["tuna", "huti", "ningshen", "zhayan", "zhayan_lian", "weidu", "feizhen", "huodan"];
function mkJinguang() {
  return {
    name: "金光上人", hp: 140, sense: 14, speed: 13, agility: 10, move: 1, mp: 72,
    tactics: "guarded", qiLayer: 7, elem: "jin",
    guardMove: { name: "金钟罩·重聚", shield: 16 },
    attacks: [
      { name: "金符破空", dmg: 22, kind: "normal", weight: 12, elem: "jin", mp: 6 },
      { name: "剑符斩", dmg: 26, pierce: true, kind: "pierce", weight: 7, elem: "jin", mp: 8 },
      { name: "金刚伏魔", dmg: 30, kind: "charge", weight: 5, elem: "jin", mp: 10, aim: "cell", range: [1, 3] },
    ],
  };
}
function mkPlayer(extra) {
  // 紧备置：毒1、无暗器、练气五层——逼出符箓/尸傀的真实增量（属性对齐 encounter 公式）
  return new Fighter(Object.assign({
    name: "韩立", hp: 160, mp: 80, sense: 10, insight: 6, gongli: 30, speed: 11, move: 1,
    agility: 6, qiLayer: 5, elem: "mu", technique: "changchun", spells: KIT.slice(),
    pouch: { duyao_cao: 1, anqi: 0 },
  }, extra));
}
function autopilot(c) {
  let guard = 0;
  while (c.status === "ongoing" && guard++ < 60) {
    c._autoPlayerTurn();
    if (c.status !== "ongoing") break;
    c.endRound();
    if (c.status !== "ongoing") break;
    c.startRound();
  }
  return c.status;
}
function rate(mk) {
  let w = 0; const N = 400;
  for (let i = 0; i < N; i++) {
    const c = mk();
    c.enemies[0].shield = 40; c.enemies[0]._fixedShield = true;
    c.startRound();
    if (autopilot(c) === "win") w++;
  }
  return Math.round(w / N * 100);
}

const base = rate(() => new Combat({ player: mkPlayer(), enemies: [new Fighter(mkJinguang())], maxRounds: 18 }));
const fu = rate(() => new Combat({ player: mkPlayer({ pouch: { duyao_cao: 1, anqi: 0, huoshe_fu: 2 }, spells: KIT.concat(["huoshe_fu"]) }), enemies: [new Fighter(mkJinguang())], maxRounds: 18 }));
const side = rate(() => new Combat({ player: mkPlayer(), enemies: [new Fighter(mkJinguang())], maxRounds: 18,
  side: { id: "zt", name: "铁奴", hp: 70, hpMax: 70, atk: 12, atkName: "尸傀挥击", nature: "corpse", guard: 0.3 } }));
const all = rate(() => new Combat({ player: mkPlayer({ pouch: { duyao_cao: 1, anqi: 0, huoshe_fu: 2 }, spells: KIT.concat(["huoshe_fu"]) }), enemies: [new Fighter(mkJinguang())], maxRounds: 18,
  side: { id: "zt", name: "铁奴", hp: 70, hpMax: 70, atk: 12, atkName: "尸傀挥击", nature: "corpse", guard: 0.3 } }));

console.log(`金光上人战（练气五层·紧备置：毒1、无暗器）：
  裸装（无符无尸傀）        胜率 ${base}%
  +火蛇符×2（做功课买符）   胜率 ${fu}%
  +尸傀随行（曲魂幡）       胜率 ${side}%
  +符+尸傀（全备置）        胜率 ${all}%`);

/* 防回归断言：备置梯度必须真实存在（克制/侧位的实战价值可测量） */
let failures = 0;
function assert(cond, msg) {
  if (cond) console.log("  ✓ " + msg);
  else { console.log("  ✗ 失败: " + msg); failures++; }
}
assert(base >= 40 && base <= 88, `紧备置基线在险胜区间 40~88%（实际 ${base}%）——五五开的死战`);
assert(fu >= base + 8, `火蛇符带来可感知的提升 ≥8pt（${base}% → ${fu}%）`);
assert(side >= base + 10, `尸傀随行带来显著提升 ≥10pt（${base}% → ${side}%）`);
assert(all >= fu && all >= side, `全备置不弱于任何单项（${all}%）`);
console.log(failures === 0 ? "\n克制梯度：全部通过 ✓" : `\n克制梯度：${failures} 项失败 ✗`);
process.exit(failures === 0 ? 0 : 1);
