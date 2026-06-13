/* 静默跑测试文件，只打失败行（绕过 PowerShell 控制台编码乱码） */
const file = process.argv[2];
const logs = [];
const orig = console.log;
console.log = (...a) => { logs.push(a.join(" ")); };
const origExit = process.exit;
process.exit = () => {};
try { require("../" + file); } catch (e) { logs.push("THROW " + e.message); }
console.log = orig;
process.exit = origExit;
const bad = logs.filter(l => (l.includes("失败") && !l.includes("✓")) || l.includes("THROW"));
console.log(file + ": " + (bad.length ? "FAIL\n" + bad.join("\n") : "PASS (" + logs.length + " lines)"));
process.exit(bad.length ? 1 : 0);
