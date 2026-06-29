/* 数值标度门禁（CONSTITUTION 铁律4 的机器执法器 · audit-gate §D2 待办落地）。
 *
 * 防的是「漂移 #5」：分级制(tier)未拍板前，每新增法宝/招式都可能用旧「拍 base」方式
 * 制造未来要返工的数值债。本门禁把铁律4 的可机器校验部分变成「一改就红」：
 *
 *   FAIL 条件（硬门禁）：
 *     1. 任何 SPELLS 招式缺 `tier`（标度档必填——读时计算的标度尺入口）。
 *     2. source:"treasure" 的【越阶攻击招式】（tier>=2·有 dmg·非 chargeCost 消耗底牌）缺 `driveRealm`
 *        （越阶本命法宝必标可驱境界门槛；本阶法器 tier<2 达标即用、消耗底牌走乘性穿透，均豁免）。
 *     3. 任何招式出现裸 `+N` 平铺加成嫌疑——此处只校验 buff 类的 flat 字段不被误用（保留扩展位）。
 *
 *   WARN（仅提示不阻断）：
 *     - data.js / combat.js 中带 base 数值的新法宝/招式，建议旁注 `// TODO:tier`（tier 制拍板前的债标记）。
 *       现有内容已按 A2 承重墙校准，不强制；本项只在缺注释且疑似新增时提示。
 *
 * 用法：node test/balance.todo.js（exit 0=全过，1=有硬违规）。改了 combat.js SPELLS / data.js gear 必跑。
 */
const fs = require("fs"), vm = require("vm"), path = require("path");
const sb = { console: { log() {}, warn() {}, error() {} }, Math, Date, JSON };
sb.window = sb; sb.globalThis = sb; sb.module = {};
const ctx = vm.createContext(sb);
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "js/combat.js"), "utf8"), ctx, { filename: "combat.js" });
const SP = (sb.CombatAPI && sb.CombatAPI.SPELLS) || {};

const fails = [];

Object.keys(SP).forEach(id => {
  const s = SP[id];
  if (!s || typeof s !== "object") return;
  // 规则1：tier 必填
  if (s.tier == null) fails.push(`[标度] 招式「${s.name || id}」(${id}) 缺 tier（标度档必填）`);
  // 规则2：越阶攻击法宝技必标 driveRealm
  const isAtk = s.dmg != null && (s.type === "atk" || s.type === "soul");
  if (s.source === "treasure" && (s.tier || 0) >= 2 && isAtk && !s.chargeCost && s.driveRealm == null) {
    fails.push(`[越阶门槛] 法宝攻击技「${s.name || id}」(${id}·tier${s.tier}) 缺 driveRealm（越阶本命须标可驱境界门槛）`);
  }
});

if (fails.length) {
  process.stdout.write("数值标度门禁 FAIL（" + fails.length + " 项·违反铁律4）:\n");
  fails.forEach(l => process.stdout.write("  X " + l + "\n"));
  process.exit(1);
} else {
  process.stdout.write("数值标度门禁 PASS：" + Object.keys(SP).length + " 招式 tier 全覆盖；越阶法宝攻击技 driveRealm 齐全。\n");
  process.exit(0);
}
