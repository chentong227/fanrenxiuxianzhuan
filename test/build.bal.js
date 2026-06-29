/* Build 路线平衡校验（build-balance-design.md §4.3 落地·诚实版）。
 *
 * ⚠ 现状声明（drift-audit #2·2026-06-30 用户拍板「非对称三路」·已闭环）：
 *   三路**刻意不对称**（守一致感）——剑道=直接战力乘区(layerMul)、丹道=底牌制造路(炼丹/采药·不直接进战斗)、
 *   阵法=控场/洞府乘区(符箓阵旗·洞府聚灵阵)。深耕回报靠**里程碑独占能力**（见 Engine._SKILL_MILESTONES /
 *   test/skillmilestone.test.js），非伤害公式。故「三路纯 build 胜率差≤10%」对称断言**刻意不补**（非缺陷）。
 *
 * 本门禁只对**已实装的剑道 layerMul 战力线**做真实不变量断言（铁律4 标度尺的一部分）：
 *   断言1 单调：层数越高 layerMul 不降（同门功法逐层精进）。
 *   断言2 峰值受控：满层乘子 ≤ 1.35（巅峰>初入，但低于「高一大境界」realmScale 一档≥1.4·不喧宾夺主）。
 *   断言3 起点归一：入门层(layer1) layerMul == 1（练气期逐字节零扰动·A2 承重墙）。
 *   断言4 单层无效：maxLayers<=1 时不放大（防除零/单层功法误乘）。
 *
 * 用法：node test/build.bal.js（exit 0=全过）。改了 balance.js layerMul / 三路战力线必跑。
 */
const fs = require("fs"), vm = require("vm"), path = require("path");
const sb = { console: { log() {}, warn() {}, error() {} }, Math, Date, JSON };
sb.window = sb; sb.globalThis = sb; sb.module = {};
const ctx = vm.createContext(sb);
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "js/balance.js"), "utf8"), ctx, { filename: "balance.js" });
const B = sb.Balance;

const fails = [];
function assert(cond, msg) { if (!cond) fails.push(msg); }

// 断言1：单调（青元剑诀 9 层为例）
const MAX = 9;
let prev = -1;
for (let L = 1; L <= MAX; L++) {
  const m = B.layerMul(L, MAX);
  assert(m >= prev, `单调性破：layer${L} 乘子 ${m.toFixed(3)} < 前一层 ${prev.toFixed(3)}`);
  prev = m;
}
// 断言2：峰值受控
const peak = B.layerMul(MAX, MAX);
assert(peak <= 1.35 + 1e-9, `峰值越界：满层乘子 ${peak.toFixed(3)} > 1.35（会喧宾夺主盖过大境界跨度）`);
assert(peak > 1.0, `峰值无效：满层乘子 ${peak.toFixed(3)} 未高于入门（巅峰应>初入）`);
// 断言3：起点归一
const base = B.layerMul(1, MAX);
assert(Math.abs(base - 1) < 1e-9, `起点未归一：入门层乘子 ${base.toFixed(3)} != 1（破 A2 练气期零扰动）`);
// 断言4：单层功法不放大
assert(B.layerMul(1, 1) === 1, `单层功法被误乘：maxLayers=1 应返回 1`);
assert(B.layerMul(5, 0) === 1, `缺 maxLayers 应回退 1`);

if (fails.length) {
  process.stdout.write("Build 平衡门禁 FAIL（" + fails.length + " 项）:\n");
  fails.forEach(l => process.stdout.write("  X " + l + "\n"));
  process.exit(1);
} else {
  process.stdout.write("Build 平衡门禁 PASS：剑道 layerMul 单调/峰值受控(≤1.35)/起点归一/单层无效——已实装战力线健康。\n");
  process.stdout.write("  注：丹/阵战力线未实装（drift-audit #2·待拍板方向）；三路胜率对称断言前置缺失，未伪造。\n");
  process.exit(0);
}
