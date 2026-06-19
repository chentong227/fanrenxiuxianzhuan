/* §9 体验设置 · 无头测试：Settings（演出速度 / 动效强度 / 震动委托）
 * 跑：node test/settings.test.js —— 纯逻辑，stub localStorage/window/document/Fx */

// —— stub 运行环境（settings.js 全程 typeof 守卫，按需注入）——
const store = {};
let reduceMq = false;          // 模拟系统 prefers-reduced-motion
let vibrateSupported = true;   // 模拟 navigator.vibrate 能力
global.localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: k => { delete store[k]; },
};
global.window = {
  matchMedia: q => ({ matches: /reduce/.test(q) ? reduceMq : false }),
};
const bodyClasses = new Set();
global.document = {
  body: {
    classList: {
      toggle: (c, on) => { if (on) bodyClasses.add(c); else bodyClasses.delete(c); },
    },
  },
};
let hapStore = true;
global.Fx = {
  hapticsOn: () => hapStore,
  setHaptics: on => { hapStore = !!on; },
};

const S = require("../js/settings.js");

let pass = 0, fail = 0;
function assert(cond, msg) {
  if (cond) { pass++; console.log(`  ✓ ${msg}`); }
  else { fail++; console.log(`  ✗ 失: ${msg}`); }
}

console.log("== 1. 演出速度：默认/缓存/钳制/系数/标签 ==");
{
  assert(S.speed() === 1, "默认档=正常(1)");
  assert(S.speedScale() === 1, "正常档系数=1×");
  assert(S.speedLabel(0) === "慢" && S.speedLabel(3) === "极快", "档位标签");
  S.setSpeed(3);
  assert(S.speed() === 3 && store.set_story_speed === "3", "setSpeed(3) 落盘");
  assert(S.speedScale() === 0.35, "极快档系数=0.35×（更快=更短时长）");
  S.setSpeed(99); assert(S.speed() === 1, "越界档→回落正常(1)");
  S.setSpeed(0); assert(S.speed() === 0 && S.speedScale() === 1.5, "慢档系数=1.5×");
  S.setSpeed(1);
}

console.log("== 2. 动效强度：默认/钳制/落盘/body class ==");
{
  assert(S.motion() === "full", "默认=满(full)");
  S.setMotion("off");
  assert(S.motion() === "off" && store.set_motion === "off", "setMotion(off) 落盘");
  assert(bodyClasses.has("motion-off") && !bodyClasses.has("motion-lite"), "off→body.motion-off");
  S.setMotion("lite");
  assert(bodyClasses.has("motion-lite") && !bodyClasses.has("motion-off"), "lite→body.motion-lite（互斥）");
  S.setMotion("zzz"); assert(S.motion() === "full", "未知值→回落满(full)");
  assert(!bodyClasses.has("motion-off") && !bodyClasses.has("motion-lite"), "full→无 motion-* class");
}

console.log("== 3. reduceMotion / liteMotion：用户档 与 系统偏好 并联 ==");
{
  S.setMotion("full"); reduceMq = false;
  assert(S.reduceMotion() === false && S.liteMotion() === false, "满+系统不减→都 false");
  S.setMotion("lite");
  assert(S.liteMotion() === true && S.reduceMotion() === false, "简→lite=true、reduce=false");
  S.setMotion("off");
  assert(S.reduceMotion() === true, "关→reduce=true");
  S.setMotion("full"); reduceMq = true;
  assert(S.reduceMotion() === true, "满 但系统开启减少动效→reduce=true（无障碍优先）");
  reduceMq = false; S.setMotion("full");
}

console.log("== 4. 震动：委托 Fx（单一真相源）+ 能力探测 ==");
{
  vibrateSupported = true; global.navigator = { vibrate: () => {} };
  assert(S.hapticsSupported() === true, "navigator.vibrate 存在→支持");
  S.setHaptics(false); assert(S.haptics() === false && hapStore === false, "setHaptics(false) 透传 Fx");
  S.setHaptics(true); assert(S.haptics() === true && hapStore === true, "setHaptics(true) 透传 Fx");
  delete global.navigator;
  assert(S.hapticsSupported() === false, "无 navigator.vibrate→不支持");
}

console.log(`\n结果：${pass} 通过，${fail} 失败`);
if (fail) process.exit(1);
