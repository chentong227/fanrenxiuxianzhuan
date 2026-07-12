/* ============================================================
 * 因果账本审计：node test/ledger.audit.js
 *
 * 宪法铁律 3「选择必闭环」的机器执法器（CONSTITUTION.md §一·铁律3 + audit-gate.md §D1）。
 *
 * 做什么：
 *   静态扫描 js/*.js，提取所有 writeLedger 的 id 集合 W（种因），
 *   与所有读账本的 id 集合 R（readLedger / settleLedger / s.ledger.X / NPC data `ledger:`）对比，
 *   报告 W − R = 「种了因、从不结果」的 id 列表（违反铁律3 的嫌疑账目）。
 *
 * 棘轮（ratchet）执法：
 *   - test/ledger.baseline.json 存在 → 任何「未结算且不在 baseline」的 id = 新债 → FAIL(exit 1)。
 *     （存量债被 baseline 豁免，新债一律挡在门外——只许还债、不许欠新债。）
 *   - baseline 缺失 → 引导模式：只报告、exit 0，并提示生成 baseline。
 *
 * 参数：
 *   --json     以 JSON 输出（供 ledger.audit.js 之外的工具消费）
 *   --write-baseline  把当前全部未结算 id 写进 baseline（带种因位置注释），用于首次铺底/接受存量。
 * ============================================================ */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const JS_DIR = path.join(ROOT, "js");
const BASELINE = path.join(__dirname, "ledger.baseline.json");

const argv = process.argv.slice(2);
const asJson = argv.includes("--json");
const writeBaseline = argv.includes("--write-baseline");

// 收集所有 js 源文件
const files = fs.readdirSync(JS_DIR).filter(f => f.endsWith(".js")).map(f => path.join(JS_DIR, f));

const writes = new Map();  // id -> [{file, line, label}]
const reads = new Set();   // id（任意读取形式）

// 正则：捕获引号内 id（支持 " ' ` 三种引号）
const Q = `["'\\\`]`;
const reWrite      = new RegExp(`writeLedger\\(\\s*${Q}([^"'\\\`]+)${Q}\\s*(?:,\\s*${Q}([^"'\\\`]*)${Q})?`, "g");
const reRead       = new RegExp(`(?:readLedger|settleLedger)\\(\\s*${Q}([^"'\\\`]+)${Q}`, "g");
const reMemberDot  = new RegExp(`\\.ledger\\.([A-Za-z_$][\\w$]*)`, "g");        // s.ledger.chen_remember
const reMemberIdx  = new RegExp(`\\.ledger\\[\\s*${Q}([^"'\\\`]+)${Q}\\s*\\]`, "g"); // s.ledger["x"]
const reNpcField   = new RegExp(`\\bledger\\s*:\\s*${Q}([^"'\\\`]+)${Q}`, "g");      // NPC 数据 ledger: "wan_hunt_together"（经 readLedger(A.ledger) 动态读取）

for (const file of files) {
  const code = fs.readFileSync(file, "utf8");
  const rel = "js/" + path.basename(file);
  const lineOf = (idx) => code.slice(0, idx).split("\n").length;

  let m;
  reWrite.lastIndex = 0;
  while ((m = reWrite.exec(code))) {
    const id = m[1];
    const label = m[2] || "";
    // 三分类启发式（种因点附近窗口 ±300 字符）：
    //   H 类·真钩子：label 含「日后/长线/跨场/待续/再算/显影/伏笔/埋下/引线/钥匙/随后/方知」等未来承诺词
    //     → 设计上承诺将来 readLedger 兑现，属合法开放债（宪法允许「有窗口的因」），不计入"待还"。
    //   B 类·成就记录：种因点伴 addMilestone 且非钩子 → 误占 ledger 命名空间的剧情/战斗流水账（成就型只记不结·铁律3 例外）。
    //   A 类·选择债：其余 → 玩家取舍写了 ledger 却无人读，「做啥都不重要」正主，须补兑现窗口。
    const win = code.slice(Math.max(0, m.index - 300), m.index + 300);
    const hasMilestone = /addMilestone/.test(win);
    // 显式真钩子白名单（label 未含承诺词但设计上确为跨篇伏笔，经人工核定）
    const HOOK_WHITELIST = new Set([
      "dayan_remembered", "hanyunzhi_flower", "qingwen_grudge", "sanxiu_escaped",
      "dayan_clue", "mojiao_oath",
    ]);
    // 显式成就记录白名单（机械兑现即得·ledger 纯记录·addMilestone 在更远处未被 ±300 窗口扫到）
    const DEED_WHITELIST = new Set([
      "sanzhuan_yizhuan", "starsea_jieguan", "zaibie_a1_after",
    ]);
    const isHook = HOOK_WHITELIST.has(id) ||
      /日后|长线|远线|跨场|待续|再算|显影|伏笔|埋下|引线|钥匙|随后|后续篇章|不死不休|断线|归账/.test(label);
    const cls = isHook ? "H" : ((hasMilestone || DEED_WHITELIST.has(id)) ? "B" : "A");
    if (!writes.has(id)) writes.set(id, []);
    writes.get(id).push({ file: rel, line: lineOf(m.index), label, cls });
  }
  for (const re of [reRead, reMemberDot, reMemberIdx, reNpcField]) {
    re.lastIndex = 0;
    while ((m = re.exec(code))) reads.add(m[1]);
  }
}

// 未结算 = 种了因（在 W）但从未被读（不在 R）
const unsettled = [...writes.keys()].filter(id => !reads.has(id)).sort();
const settled   = [...writes.keys()].filter(id => reads.has(id)).sort();

// --write-baseline：把当前未结算写进 baseline 存量豁免表
if (writeBaseline) {
  const obj = {
    _note: "因果账本存量豁免表。此处每个 id 都是『已知未结算』的存量债，新增 writeLedger 不得落入此表之外的未结算状态。还债后请从本表删除对应 id。",
    _generated: new Date().toISOString().slice(0, 10),
    grandfathered: {},
  };
  for (const id of unsettled) {
    const loc = writes.get(id)[0];
    obj.grandfathered[id] = { where: `${loc.file}:${loc.line}`, label: loc.label, status: "TODO-补兑现或降级flavor" };
  }
  fs.writeFileSync(BASELINE, JSON.stringify(obj, null, 2) + "\n", "utf8");
  console.log(`已写入存量豁免表 ${path.relative(ROOT, BASELINE)}（${unsettled.length} 条）。请逐条把 status 改为还债计划，还债后删除该行。`);
  process.exit(0);
}

// 读取 baseline（若存在）
let baseline = null;
if (fs.existsSync(BASELINE)) {
  try { baseline = JSON.parse(fs.readFileSync(BASELINE, "utf8")); } catch (e) { baseline = null; }
}
const grandfathered = baseline && baseline.grandfathered ? new Set(Object.keys(baseline.grandfathered)) : null;

// 新债 = 未结算 且 不在豁免表。门禁只对 A 类（选择债）FAIL——B 成就记录/H 真钩子是合法的「只记不结」（铁律3 例外），
//   它们入 baseline 即可，新增 B/H 不阻断（否则每记一笔战报/埋一个钩子都要改 baseline，门禁会变噪音）。
const clsOfId = (id) => (writes.has(id) ? (writes.get(id)[0].cls || "A") : "A");
const newDebt = grandfathered ? unsettled.filter(id => !grandfathered.has(id) && clsOfId(id) === "A") : [];
const newRecords = grandfathered ? unsettled.filter(id => !grandfathered.has(id) && clsOfId(id) !== "A") : [];
// 已还清债 = 在豁免表但现在已结算（提示可从 baseline 删除）
const repaid = grandfathered ? [...grandfathered].filter(id => reads.has(id) || !writes.has(id)).sort() : [];

if (asJson) {
  const clsMap = {};
  for (const id of unsettled) clsMap[id] = writes.get(id)[0].cls || "A";
  console.log(JSON.stringify({
    writeCount: writes.size, readHit: settled.length, unsettledCount: unsettled.length,
    settled, unsettled, classes: clsMap, newDebt, repaid,
  }, null, 2));
  process.exit(grandfathered ? (newDebt.length ? 1 : 0) : 0);
}

// ── 人读报告 ──
console.log("\n========== 因果账本审计（铁律3·选择必闭环） ==========\n");
console.log(`种因 writeLedger 唯一 id：${writes.size}`);
console.log(`其中已被读取/结算（闭环）：${settled.length}`);
console.log(`其中从未被读取（只记不结）：${unsettled.length}`);
const ratio = writes.size ? (settled.length / writes.size * 100).toFixed(0) : "—";
console.log(`闭环率：${ratio}%\n`);

if (settled.length) {
  console.log("── 已闭环（种因→有读/有结算，符合铁律3）──");
  for (const id of settled) console.log(`  ✓ ${id}`);
  console.log("");
}

if (unsettled.length) {
  const clsOf = (id) => (writes.get(id)[0].cls || "A");
  const aDebt = unsettled.filter(id => clsOf(id) === "A");
  const bDebt = unsettled.filter(id => clsOf(id) === "B");
  const hHook = unsettled.filter(id => clsOf(id) === "H");
  // 选择债闭环率：真正衡量「做啥都不重要」病灶的指标——只看 A 类（B 成就/H 钩子不算"待还选择债"）
  const choiceTotal = settled.length + aDebt.length;
  const choiceRatio = choiceTotal ? (settled.length / choiceTotal * 100).toFixed(0) : "—";
  console.log("── 只记不结（种了因、全仓从未读取）──");
  console.log(`   分类：A 选择债 ${aDebt.length}（铁律3 正主·须补兑现）｜B 成就记录 ${bDebt.length}（误占 ledger 命名空间·应降级 addMilestone）｜H 真钩子 ${hHook.length}（合法开放债·等内容兑现）`);
  console.log(`   ★选择债闭环率（衡量「选择有重量」）：${settled.length}/${choiceTotal} = ${choiceRatio}%\n`);
  console.log("  【A 类·选择债】玩家取舍写了 ledger 却无人读——「做啥都不重要」正主，优先补 settleLedger：");
  for (const id of aDebt) {
    const loc = writes.get(id)[0];
    const flag = grandfathered && grandfathered.has(id) ? "·存量豁免" : (grandfathered ? "·★新债" : "");
    console.log(`    ✗ ${id}  [${loc.file}:${loc.line}]${flag}`);
    if (loc.label) console.log(`          「${loc.label.slice(0, 36)}${loc.label.length > 36 ? "…" : ""}」`);
  }
  console.log("\n  【H 类·真钩子】label 含未来承诺词（日后/长线/跨场/再算…）——设计上等 readLedger 兑现，合法留账：");
  for (const id of hHook) console.log(`    ⟡ ${id}`);
  console.log("\n  【B 类·成就记录】伴 addMilestone 的剧情/战斗流水账——里程碑已记，ledger 属冗余（宜降级，详见 docs/drift-audit §B类降级）：");
  for (const id of bDebt) console.log(`    · ${id}`);
  console.log("");
}

if (repaid.length) {
  console.log("── 已还清（豁免表中但现已闭环，可从 baseline 删除）──");
  for (const id of repaid) console.log(`  ↑ ${id}`);
  console.log("");
}

if (!grandfathered) {
  console.log("【引导模式】尚无 test/ledger.baseline.json 存量豁免表。");
  console.log("  这是首次审计，上面的「只记不结」清单 = 接下来要『编织』的施工图。");
  console.log("  铺底命令：node test/ledger.audit.js --write-baseline");
  console.log("  铺底后，新增任何未闭环 writeLedger 都会被本门禁拦下（只许还债、不许欠新债）。\n");
  process.exit(0);
}

if (newRecords.length) {
  console.log(`【提示】新增 ${newRecords.length} 条 B 成就记录/H 钩子（不阻断，但建议入 baseline 或评估）：${newRecords.join(", ")}\n`);
}

if (newDebt.length) {
  console.log(`========== FAIL：发现 ${newDebt.length} 条新 A 类选择债（未闭环且不在豁免表） ==========`);
  console.log("违反宪法铁律3：玩家选择种因必须声明兑现窗口。要么补 readLedger/settleLedger 兑现节点，");
  console.log("要么降级为纯 flavor（不写 ledger，只给当场文字），要么明确入存量表（不推荐）。\n");
  process.exit(1);
}

console.log("========== PASS：无新增未闭环选择债 ==========");
console.log(`（存量债 ${grandfathered.size} 条仍在 baseline 中待还，见 test/ledger.baseline.json）\n`);
process.exit(0);
