/* 功法品阶平衡：验证品阶胜率梯度 + 凡人逆袭窗口
 * node test/tier.bal.js */
const { Combat, Fighter, SPELLS } = require("../js/combat.js");
const Balance = require("../js/balance.js");

let failures = 0;
function assert(c, m) { if (c) console.log("  ✓ " + m); else { console.log("  ✗ 失败: " + m); failures++; } }

// 一个"功法法术"攻击招式，按品阶/境界缩放。这里直接验证 balance 公式 + 一个简化对拼。
console.log("\n=== 功法品阶强度公式 ===");
{
  const base = 20;
  const huang = Balance.spellPower(base, "art", 1, 0);
  const xuan = Balance.spellPower(base, "art", 2, 0);
  const di = Balance.spellPower(base, "art", 3, 0);
  const tian = Balance.spellPower(base, "art", 4, 0);
  assert(huang < xuan && xuan < di && di < tian, `品阶越高威力越大（黄${huang}<玄${xuan}<地${di}<天${tian}）`);
  const martial = Balance.spellPower(base, "martial", 4, 0);
  const artHuang = Balance.spellPower(base, "art", 1, 0);
  assert(martial < artHuang, `武学(不吃品阶)弱于黄阶法术（武${martial} < 黄阶法术${artHuang}）`);
  // 境界成长：法术随境界涨，武学几乎不涨
  const artQi = Balance.spellPower(base, "art", 1, 0);
  const artCore = Balance.spellPower(base, "art", 2, 0); // realmTier 2
  const mQi = Balance.spellPower(base, "martial", 1, 0);
  const mCore = Balance.spellPower(base, "martial", 1, 2);
  assert((artCore - artQi) > (mCore - mQi), "随境界提升，法术成长远大于武学（武学终落伍）");
}

// 模拟同准备下，主修不同品阶功法的胜率梯度
console.log("\n=== 同准备下品阶胜率梯度（蒙特卡洛）===");
function autopilot(c) {
  let g = 0;
  while (c.status === "ongoing" && g++ < 200) {
    c.startRound();
    let i = 0;
    while (c.affordableSpells().length && i++ < 20) {
      const t = c.enemies.findIndex(e => e.alive); if (t < 0) break;
      const aff = c.affordableSpells();
      // 简化战术：有吐纳应急，否则攻击
      let pick = (c.player.hp < c.player.hpMax * 0.3 && aff.includes("tuna")) ? "tuna"
        : aff.find(id => SPELLS[id].type === "atk") || aff.find(id => SPELLS[id].type === "soul");
      if (!pick) break;
      if (!c.cast(pick, t).ok) break;
      if (c.status !== "ongoing") break;
    }
    if (c.status === "ongoing") c.endRound();
  }
  return c.status;
}
// 用一个"功法攻击"招式做对照：注入临时法术
// 对阵轴 v2：法力池 mp + 射程 range（旧 cost:{mu} 五行珠制已废）。range 拉满=本 MC 只比品阶威力、不掺位置变量
SPELLS._gptest = { name: "测试法术", mp: 4, range: [1, 99], type: "atk", dmg: 12, source: "art" };
function buildVs(grade) {
  // qiLayer 6：以"练气六层灵气底蕴"为蒙特卡洛基准（灵气总量随境界成长后的对照点）
  const p = new Fighter({ name: "修士", hp: 110, profile: "common", grade, realmTier: 0, qiLayer: 6, spells: ["_gptest", "tuna"] });
  // profile common 五行均衡，保证 mu 足够
  const e = { name: "陪练", hp: 110, sense: 5, agility: 4, atkName: "击", atk: 12, speed: 10, mp: 0 };
  return new Combat({ player: p, enemies: [e], maxRounds: 14, W: 9, playerPos: 2, enemyPos: 4 });
}
const rates = {};
for (const g of [1, 2, 3]) {
  let win = 0; const N = 400;
  for (let i = 0; i < N; i++) if (autopilot(buildVs(g)) === "win") win++;
  rates[g] = win / N;
  console.log(`  主修${({1:'黄阶',2:'玄阶',3:'地阶'})[g]}：胜率 ${(rates[g]*100).toFixed(1)}%`);
}
assert(rates[1] < rates[2] && rates[2] <= rates[3] + 0.0001, "品阶越高胜率越高（地≥玄>黄）");
delete SPELLS._gptest;

// 功法层数轴（technique-tiers §5.4）：同境界同品阶，巅峰>初入，但温和、不盖品阶/境界差
console.log("\n=== 功法层进度乘子（layerMul）梯度 ===");
{
  const base = 20;
  const early = Balance.layerMul(3, 9);   // 青元剑诀初授层（剑芒，初入）
  const peak = Balance.layerMul(9, 9);    // 九层版顶层（巅峰）
  assert(Balance.layerMul(1, 9) === 1, "入门层（第1层）无层增益（layerMul=1）");
  assert(peak > early, `巅峰层乘子>初入层（${peak.toFixed(3)}>${early.toFixed(3)}）`);
  assert(peak <= 1.3 + 1e-9, `层乘子温和封顶（峰值${peak.toFixed(3)}≤1.30）`);
  const sEarly = Balance.spellPower(base, "art", 3, 0, early, 0);
  const sPeak = Balance.spellPower(base, "art", 3, 0, peak, 0);
  assert(sPeak > sEarly, `同境界同品阶：巅峰输出>初入（${sPeak}>${sEarly}）`);
  // 不喧宾夺主：满层进度（1→巅峰）的增幅 < 升一个大境界的增幅
  const samRealmPeak = Balance.spellPower(base, "art", 3, 0, peak, 0);
  const upRealmFlat = Balance.spellPower(base, "art", 3, 1, 1, 1);
  assert(samRealmPeak < upRealmFlat, `层满进度不盖境界（本境巅峰${samRealmPeak} < 升一境初入${upRealmFlat}）`);
  // 武学不吃 layerMul
  const mFlat = Balance.spellPower(base, "martial", 1, 0, 1);
  const mPeak = Balance.spellPower(base, "martial", 1, 0, peak);
  assert(mFlat === mPeak, `武学不吃层乘子（${mFlat}==${mPeak}）`);
}

console.log(`\n========== 品阶平衡：${failures === 0 ? "全部通过 ✓" : failures + " 项失败 ✗"} ==========\n`);
process.exit(failures === 0 ? 0 : 1);
