/* flag/ledger 同名异源门禁（防 v250 那类静默 bug 回归）：
 *   若某 id 同时满足 (a) 被 writeLedger("id") 写过 (b) 被 s.flags.id 读过 (c) 从未 setFlag("id")/flags.id=，
 *   则极可能是"以为写了 ledger 就设了 flag"的误用 → 该剧情分支永远走不到 → FAIL。
 * 跑：node test/flagledger.test.js */
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const jsFiles = fs.readdirSync(path.join(ROOT,"js")).filter(f=>f.endsWith(".js"));
let code = "";
for (const f of jsFiles) code += "\n" + fs.readFileSync(path.join(ROOT,"js",f),"utf8");

const Q = "[\"'`]";
function ids(re){ const s=new Set(); let m; re.lastIndex=0; while((m=re.exec(code))) s.add(m[1]); return s; }
const writtenLedger = ids(new RegExp(`writeLedger\\(\\s*${Q}([\\w]+)${Q}`,"g"));
const setFlags = ids(new RegExp(`setFlag\\(\\s*${Q}([\\w]+)${Q}`,"g"));
const assignFlags = ids(new RegExp(`\\bflags\\.([\\w]+)\\s*=(?!=)`,"g"));
const assignFlagsIdx = ids(new RegExp(`\\bflags\\[\\s*${Q}([\\w]+)${Q}\\s*\\]\\s*=(?!=)`,"g"));
const readFlags = ids(new RegExp(`\\bflags\\.([\\w]+)\\b`,"g"));

const everWritten = id => setFlags.has(id) || assignFlags.has(id) || assignFlagsIdx.has(id);

let pass=0, fail=0;
console.log("== flag/ledger 同名异源检测 ==");
const suspects = [...writtenLedger].filter(id => readFlags.has(id) && !everWritten(id)).sort();
suspects.forEach(id => {
  fail++;
  console.log(`  X "${id}": writeLedger 写了、剧情读 s.flags.${id}、却从未 setFlag → 该分支永走不到（补 setFlag 或改读 readLedger）`);
});
if (!suspects.length) { pass++; console.log("  ✓ 无同名异源误用：所有被当 flag 读的 ledger id 都另有 setFlag"); }

console.log(`\n结果：${fail ? fail+" 处可疑" : "通过"}`);
process.exit(fail ? 1 : 0);
