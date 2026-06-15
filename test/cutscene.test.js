/* 演出推进器 cutscene.js · 无头测试（compile 纯函数 + run/runBeat fail-soft）
 * 跑：node test/cutscene.test.js  —— 不依赖 DOM/FX/audio，缺依赖须静默不抛。 */
const CS = require("../js/cutscene.js");

let pass = 0, fail = 0;
function assert(cond, msg) {
  if (cond) { pass++; console.log(`  ✓ ${msg}`); }
  else { fail++; console.log(`  ✗ 失: ${msg}`); }
}
const kinds = (stage) => CS.compile(stage).map(b => b.kind + (b.op ? ":" + b.op : ""));

console.log("== 1. 旧剧情卡向后兼容（零回归）==");
{
  const stage = { text: [
    "一段旁白",
    { scene: "门前" },
    { aside: "心声" },
    { say: "墨彩环", emo: "scheme", tone: "低声", text: "黑小子" },
    { narr: "明叙" },
    { show: "mocaihuan", text: "" },
    { beat: "……" },           // 字符串 beat=停顿留白（旧用法，story.js 173/230/301）
  ] };
  const b = CS.compile(stage);
  assert(b[0].kind === "narr" && b[0].text === "一段旁白", "字符串→旁白");
  assert(b[1].kind === "scene" && b[1].text === "门前", "scene→场景");
  assert(b[2].kind === "aside" && b[2].text === "心声", "aside→心声");
  assert(b[3].kind === "say" && b[3].who === "墨彩环" && b[3].emo === "scheme" && b[3].tone === "低声", "say→对白（带 emo/tone）");
  assert(b[4].kind === "narr" && b[4].text === "明叙", "narr→旁白");
  assert(b[5].kind === "narr" && b[5].showWho === "mocaihuan", "show→立绘亮相");
  assert(b[6].kind === "narr" && b[6].text === "……", "字符串 beat→停顿旁白（兼容）");
  assert(!b.some(x => x.kind === "op" || x.kind === "beat"), "旧卡不产生 op/交互 beat");
  assert(CS.hasStaging(stage) === false, "旧卡 hasStaging=false");
}

console.log("== 2. 演出原语编译（cam/actor/fx/sfx/bgm/wait）==");
{
  const stage = { text: [
    { cam: "pan", to: { x: -3, y: 1 }, ms: 1100 },
    { cam: "zoom", scale: 1.08, ms: 900 },
    { cam: "shake", px: 8 },
    { actor: "mocaihuan", enter: "left", emote: "scheme", name: "墨彩环" },
    { fx: "burst", at: "center", elem: "jin", n: 14 },
    { sfx: "danger" },
    { bgm: "tense" },
    { wait: 600 },
    { wait: "click" },
  ] };
  assert(JSON.stringify(kinds(stage)) ===
    JSON.stringify(["op:cam", "op:cam", "op:cam", "op:actor", "op:fx", "op:sfx", "op:bgm", "op:wait", "op:wait"]),
    "九原语全部识别为 op");
  const b = CS.compile(stage);
  assert(b[0].to.x === -3 && b[0].ms === 1100, "cam pan 载参");
  assert(b[1].scale === 1.08, "cam zoom 载 scale");
  assert(b[3].actor === "mocaihuan" && b[3].emote === "scheme", "actor 载 id/emote");
  assert(b[4].op === "fx" && b[4].spec.fx === "burst" && b[4].spec.elem === "jin", "fx 原样带 spec");
  assert(b[5].sfx === "danger" && b[6].bgm === "tense", "sfx/bgm 载名");
  assert(b[7].wait === 600 && b[8].wait === "click", "wait 区分定时/待点");
  assert(CS.hasStaging(stage) === true, "含原语 hasStaging=true");
}

console.log("== 3. 交互 beat（对象=交互；字符串=停顿，二者不混淆）==");
{
  const stage = { text: [
    { beat: { kind: "window", action: "出手", ms: 2200, onHit: { line: "中" }, onMiss: { line: "空" } } },
    { beat: "停顿" },
  ] };
  const b = CS.compile(stage);
  assert(b[0].kind === "beat" && b[0].beat.kind === "window", "对象 beat→交互节拍");
  assert(b[1].kind === "narr" && b[1].text === "停顿", "字符串 beat→停顿旁白");
  assert(CS.hasStaging(stage) === true, "含交互 beat hasStaging=true");
}

console.log("== 4. isBlocking：舞台指令不阻塞，台词/交互/待点阻塞 ==");
{
  assert(CS.isBlocking({ kind: "op", op: "cam" }) === false, "cam 不阻塞");
  assert(CS.isBlocking({ kind: "op", op: "fx" }) === false, "fx 不阻塞");
  assert(CS.isBlocking({ kind: "op", op: "wait", wait: 600 }) === false, "wait(定时) 不阻塞");
  assert(CS.isBlocking({ kind: "op", op: "wait", wait: "click" }) === true, "wait(待点) 阻塞");
  assert(CS.isBlocking({ kind: "narr", text: "x" }) === true, "台词阻塞");
  assert(CS.isBlocking({ kind: "beat", beat: {} }) === true, "交互 beat 阻塞");
  assert(CS.isBlocking({ kind: "guide", guide: {} }) === true, "引导 beat 阻塞（等确认）");
}

console.log("== 4b. 演出即引导 guide：编译为引导节拍 + runGuide 落幕指路 ==");
{
  const stage = { text: [
    "抵达",
    { guide: { tag: "初来乍到", title: "下一步", hint: "调息度月", focus: "rest", cta: "我记下了" } },
  ] };
  const b = CS.compile(stage);
  assert(b[1].kind === "guide", "对象 guide→引导节拍");
  assert(b[1].guide.focus === "rest" && b[1].guide.title === "下一步", "guide 载 focus/title/hint");
  // guide 不算"舞台特效"，独有 guide 时不强制挂 FX 镜头层
  assert(CS.hasStaging({ text: [{ guide: { title: "x" } }] }) === false, "仅 guide hasStaging=false（不挂特效层）");
  // runGuide 无 host：同步 done({focus}) 不抛
  let got = null;
  CS.runGuide({ guide: { focus: "rest" } }, {}, (res) => { got = res; });
  assert(got && got.focus === "rest", "runGuide 无 host→同步 done({focus})");
}

console.log("== 5. 边界：空/异常输入不抛 ==");
{
  assert(CS.compile(undefined).length === 0, "compile(undefined)=空");
  assert(CS.compile({}).length === 0, "compile({})=空");
  assert(CS.compile({ text: ["x", null, 42, { unknown: 1 }] }).length === 1, "脏段落被滤（仅留合法）");
  assert(CS.hasStaging(undefined) === false, "hasStaging(undefined)=false");
}

console.log("== 6. run/runBeat 无 DOM/FX/audio 时 fail-soft ==");
{
  // 非 op 直接放过
  assert(CS.run({ kind: "narr" }, {}) === null, "run 非 op→null");
  // 缺 Sfx/Fx 全局：静默不抛
  assert(CS.run({ kind: "op", op: "sfx", sfx: "danger" }, {}) === null, "sfx 缺依赖→null 不抛");
  assert(CS.run({ kind: "op", op: "bgm", bgm: "tense" }, {}) === null, "bgm 缺依赖→null 不抛");
  assert(CS.run({ kind: "op", op: "fx", spec: { fx: "burst", at: "center" } }, {}) === null, "fx 缺 FX→null 不抛");
  assert(CS.run({ kind: "op", op: "cam", cam: "hold" }, {}) === null, "cam hold→null");
  // wait 定时 → 交回调度器
  const r = CS.run({ kind: "op", op: "wait", wait: 800 }, {});
  assert(r && r.auto === 800, "wait(定时)→{auto:ms}");
  // cam 有 ms 但无 bg：不抛，仍交回 auto
  const r2 = CS.run({ kind: "op", op: "cam", cam: "pan", to: { x: 1, y: 0 }, ms: 500 }, {});
  assert(r2 && r2.auto === 500, "cam(有 ms)→{auto:ms}（无 bg 也不抛）");
  // runBeat 无 beatHost：同步回调 done({hit:false})
  let got = null;
  CS.runBeat({ beat: { kind: "window" } }, {}, (res) => { got = res; });
  assert(got && got.hit === false, "runBeat 无 host→同步 done({hit:false})");
  // resetCam / clear 无 ctx 不抛
  CS.resetCam(); CS.clear();
  assert(true, "resetCam()/clear() 无参不抛");
}

console.log(`\n========== 演出推进器：${fail === 0 ? "全通 ✓" : fail + " 项败 ✗"}（${pass} 项）==========`);
process.exit(fail ? 1 : 0);
