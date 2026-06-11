/* 遭遇战数值锚点蒙特卡洛：node test/encounter.bal.js
 *
 * 强度物理学（docs/power-design.md）的胜率验收表：
 *  - 同层敌人：胜率 55%~85%（能赢但要打）
 *  - 低 2+ 层的旧区敌人：胜率 ≥90%（变强可感，碾旧区是爽）
 *  - 异闻妖王 vs 同期玩家：40%~75%（挑战内容，准备与操作分胜负）
 * 玩家模拟：常规配置（无底牌）+ 简单战术（血低吐纳、灵气够则攻击、敌蓄力时全力压制）。
 */
const { Combat, Fighter, SPELLS } = require("../js/combat.js");
const Balance = require("../js/balance.js");

// 复刻 WORLD.enemies 数据（避免引 DOM 依赖链；与 world.js 同步维护）
const ENEMIES = {
  wild_wolf: { name: "灵狼", hp: 38, sense: 3, agility: 6, tactics: "feral",
    attacks: [{ name: "扑咬", dmg: 8, kind: "normal", weight: 14 }, { name: "弓背低嚎", dmg: 11, kind: "charge", weight: 6 }] },
  outer_disciple: { name: "外门弟子", hp: 60, sense: 6, agility: 5,
    attacks: [{ name: "拳脚", dmg: 11, kind: "normal", weight: 14 }, { name: "锁喉擒拿", dmg: 8, kind: "pierce", weight: 6 }] },
  rogue_cultivator: { name: "散修", hp: 88, sense: 9, agility: 8, tactics: "cunning", qiLayer: 3,
    attacks: [{ name: "法器袭", dmg: 16, kind: "normal", weight: 12 }, { name: "法器贯刺", dmg: 12, kind: "pierce", weight: 8 }, { name: "聚灵蓄势", dmg: 18, kind: "charge", weight: 5 }] },
  beast_baihu: { name: "白额吊睛虎", hp: 140, sense: 7, agility: 12, tactics: "feral",
    attacks: [{ name: "裂风虎爪", dmg: 18, kind: "normal", weight: 12 }, { name: "虎啸震林", dmg: 15, kind: "pierce", weight: 6 }, { name: "血怒扑杀", dmg: 22, kind: "charge", weight: 7 }] },
};

let failures = 0;
function assert(c, m) { if (c) console.log("  \u2713 " + m); else { console.log("  \u2717 \u5931\u8d25: " + m); failures++; } }

// 按练气层数构造"常规玩家"（属性随层数粗略成长，对齐 engine 成长节奏）
function makePlayer(layer) {
  return new Fighter({
    name: "韩立", hp: 100 + (layer - 1) * 15, sense: 5 + layer * 2, insight: 6,
    agility: Math.round((10 + layer) * 0.6), profile: "hanli_si", technique: "changchun",
    grade: 1, realmTier: 0, qiLayer: layer,
    spells: ["tuna", "huti", "ningshen", "zhayan", "zhayan_lian"],
    pouch: {},
  });
}

function autopilot(c) {
  let g = 0;
  while (c.status === "ongoing" && g++ < 80) {
    let i = 0;
    while (c.status === "ongoing" && i++ < 16) {
      const t = c.enemies.findIndex(e => e.alive); if (t < 0) break;
      const aff = c.affordableSpells();
      if (!aff.length) break;
      const enemy = c.enemies[t];
      let pick = null;
      // 血低回血
      if (c.player.hp < c.player.hpMax * 0.35 && aff.includes("tuna")) pick = "tuna";
      // 敌蓄力：趁虚全力输出
      else if (enemy._charging && (aff.includes("zhayan_lian") || aff.includes("zhayan")))
        pick = (c.player.momentum >= 2 && aff.includes("zhayan_lian")) ? "zhayan_lian" : "zhayan";
      // 敌将爆发且自己无盾：护体
      else if (enemy.intent && enemy.intent.kind === "release" && c.player.shield <= 0 && aff.includes("huti")) pick = "huti";
      else pick = aff.find(id => SPELLS[id].type === "atk");
      if (!pick) break;
      if (!c.cast(pick, t).ok) break;
    }
    if (c.status === "ongoing") { c.endRound(); if (c.status === "ongoing") c.startRound(); }
  }
  return c.status;
}

function winRate(layer, enemyId, N = 300) {
  let w = 0;
  for (let i = 0; i < N; i++) {
    const c = new Combat({ player: makePlayer(layer), enemies: [Object.assign({}, ENEMIES[enemyId])], maxRounds: 20 });
    c.startRound();
    if (autopilot(c) === "win") w++;
  }
  return w / N;
}

console.log("\n=== 遭遇战数值锚点（胜率梯度） ===");
const r1wolf = winRate(1, "wild_wolf");
assert(r1wolf >= 0.5 && r1wolf <= 0.9, `练气一层 vs 灵狼：能赢但要打（${(r1wolf * 100).toFixed(0)}%，期望50~90）`);
const r4wolf = winRate(4, "wild_wolf");
assert(r4wolf >= 0.9, `练气四层 vs 灵狼：碾旧区（${(r4wolf * 100).toFixed(0)}%，期望≥90）——变强可感`);
const r3rogue = winRate(3, "rogue_cultivator");
assert(r3rogue >= 0.4 && r3rogue <= 0.85, `练气三层 vs 散修：势均力敌（${(r3rogue * 100).toFixed(0)}%，期望40~85）`);
const r6rogue = winRate(6, "rogue_cultivator");
assert(r6rogue >= 0.85, `练气六层 vs 散修：明显优势（${(r6rogue * 100).toFixed(0)}%，期望≥85）`);
const r4tiger = winRate(4, "beast_baihu");
assert(r4tiger >= 0.3 && r4tiger <= 0.8, `练气四层 vs 白额虎王：挑战内容（${(r4tiger * 100).toFixed(0)}%，期望30~80）`);
const r7tiger = winRate(7, "beast_baihu");
assert(r7tiger >= 0.75, `练气七层 vs 白额虎王：境界压回去（${(r7tiger * 100).toFixed(0)}%，期望≥75）`);
// 单调性：同一敌人，层数越高胜率不降
assert(r4wolf >= r1wolf - 0.03 && r6rogue >= r3rogue - 0.03 && r7tiger >= r4tiger - 0.03,
  "胜率随境界单调不降（境界乘区成立）");

console.log(`\n========== 遭遇战锚点：${failures === 0 ? "全部通过 \u2713" : failures + " 项失败 \u2717"} ==========\n`);
process.exit(failures === 0 ? 0 : 1);
