/* §9-6 名场面回廊 · 无头测试：Cutscene.recordScene 纯函数（名场面判定/去重/排序/限容/纯净）
 * 跑：node test/replay.test.js  —— 只测纯逻辑，不依赖 DOM/State。 */
const CS = require("../js/cutscene.js");

let pass = 0, fail = 0;
function assert(cond, msg) {
  if (cond) { pass++; console.log(`  ✓ ${msg}`); }
  else { fail++; console.log(`  ✗ 失: ${msg}`); }
}

const cinematic = (id, title) => ({ id, title: title || id, text: [
  "一段旁白", { cam: "pan", to: { x: -3 }, ms: 1100 }, { say: "墨大夫", text: "黑小子" },
] });
const textOnly = (id) => ({ id, title: id, text: [
  "纯旁白一", { say: "张铁", text: "顿顿白面馍" }, { aside: "心声" },
] });

console.log("== 1. 名场面判定：含演出才收，纯文字对白不收 ==");
{
  assert(CS.hasStaging(cinematic("a")) === true, "含 cam→hasStaging=true（算名场面）");
  assert(CS.hasStaging(textOnly("b")) === false, "纯对白→hasStaging=false");
  assert(CS.hasStaging({ id: "c", text: [{ beat: { kind: "window", prompt: "！" } }] }) === true, "交互 beat→也算演出");
  assert(CS.hasStaging({ id: "d", text: [{ fx: "lightning", at: "center" }] }) === true, "纯特效→也算演出");

  const base = [];
  assert(CS.recordScene(base, textOnly("b")).length === 0, "纯对白节点不入回廊");
  assert(CS.recordScene(base, { title: "无id", text: [{ cam: "pan" }] }).length === 0, "无稳定 id 不入回廊");
  assert(CS.recordScene(base, null).length === 0, "空 stage 安全返回");
}

console.log("== 2. 记录条目结构 + meta 标注 ==");
{
  const out = CS.recordScene([], cinematic("touxin", "投 信"), { t: "第3年5月" });
  assert(out.length === 1, "含演出节点入列");
  const e = out[0];
  assert(e.id === "touxin" && e.title === "投 信", "条目带 id/title");
  assert(e.t === "第3年5月", "meta.t 透传");
  const cg = CS.recordScene([], { id: "x", title: "X", cg: "duandan", text: [{ cam: "zoom" }] })[0];
  assert(cg.cg === "duandan", "cg 缺省回落 stage.cg");
}

console.log("== 3. 去重 + 最近置末 ==");
{
  let l = [];
  l = CS.recordScene(l, cinematic("A"));
  l = CS.recordScene(l, cinematic("B"));
  l = CS.recordScene(l, cinematic("A"));               // 再看 A
  assert(l.length === 2, "同 id 去重，不重复占位");
  assert(l.map(e => e.id).join(",") === "B,A", "重温过的置末（B,A）");
}

console.log("== 4. 限容：超 cap 淘汰最旧 ==");
{
  let l = [];
  l = CS.recordScene(l, cinematic("A"), null, 2);
  l = CS.recordScene(l, cinematic("B"), null, 2);
  l = CS.recordScene(l, cinematic("C"), null, 2);      // 触顶，A 出列
  assert(l.length === 2 && l.map(e => e.id).join(",") === "B,C", "cap=2 时保留最近两条（B,C）");
}

console.log("== 5. 纯函数：不就地改入参 ==");
{
  const src = [{ id: "Z", title: "Z", t: "", cg: "" }];
  const out = CS.recordScene(src, cinematic("Y"));
  assert(src.length === 1 && out.length === 2, "原列表不被修改（返回新列表）");
  assert(out !== src, "返回的是新数组引用");
}

console.log(`\n========== 名场面回廊：${fail === 0 ? "全通 ✓" : fail + " 项败 ✗"}（${pass} 项）==========`);
process.exit(fail === 0 ? 0 : 1);
