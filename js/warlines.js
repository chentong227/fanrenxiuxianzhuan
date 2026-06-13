/* =====================================================================
 * warlines.js —— 战斗台词库（tactics T2：台词活化）
 * 原则：说话因为"发生了事"，不是因为"轮到她了"。
 * - 人格分库（南宫婉=掩月宗天骄，清冷矜贵藏锋芒；万小山按考据极简——
 *   原著韩立参战前他已被打死，几乎没有战斗台词，只有慌张与惨呼）；
 * - 每情境多句随机 + 已用账本（一场战斗不重复；句尽则沉默，绝不复读）；
 * - LLM 增强档（后续）：配 ?llmkey 时以库句为风格锚实时生成，断网回落库表。
 * ===================================================================== */
(function (root) {
  "use strict";

  const LINES = {
    /* —— 南宫婉：清冷、矜贵、不多话；夸人不直夸，指令裹在身段里 —— */
    nangongwan: {
      open: [
        "退后半步，别踩我的剑路。",
        "凝神。它比你想的快。",
        "既是同道，便莫要互相拖累。",
      ],
      kill: [
        "聒噪。",
        "不过如此。",
        "下一个。",
      ],
      hurt: [
        "……有点意思。",
        "好凶的爪子——但还不够。",
      ],
      heavyHurt: [
        "（她袖口已染血，声线却不见波澜）小伤，不碍事。",
      ],
      playerHurt: [
        "稳住气血——死在这种地方很难看。",
        "别逞强，丹药不是摆设。",
      ],
      playerDown: [
        "韩道友？！——撑住！",
      ],
      assist: [
        "既然送到我面前——便一并料理了。",
        "顺手而已，不必谢。",
      ],
      backstabPraise: [
        "好刁的一手。……学得倒快。",
        "从死角进刀——你这人，比看上去狠得多。",
      ],
      fly: [
        "借天一步。",
      ],
      lowMp: [
        "灵力将尽……得收着用了。",
      ],
      win: [
        "收拾一下，赶路要紧。",
        "（她拂了拂袖口的尘土，眸光已落向远处）走吧。",
      ],
      /* —— 客随统帅指令（T2.5）：每道指令都是一句"裹着身段的命令" —— */
      cmd_focus: [
        "这只交给你收口——接好了！",
        "我把局递到这一步，剩下的一刀，你来。",
      ],
      cmd_spread: [
        "它的眼里只有我——去，取它后心。",
        "我缠住正面。你绕过去，从死角进。",
      ],
      cmd_hold: [
        "稳住，别抢——让它这一击落空，空门在那之后。",
        "收住手。它势头正满，等它旧力一尽……",
      ],
      cmd_regroup: [
        "到我身后来。",
        "退到我侧翼——你的血气乱了。",
      ],
    },

    /* —— 万小山（考据：原著韩立参战前已被打死——战斗台词=慌张与惨呼，无战术） —— */
    wanxiaoshan: {
      open: ["韩、韩道友……这阵仗是不是太大了点……"],
      hurt: ["哎哟！！"],
      heavyHurt: ["不行了不行了——我这把骨头要交代在这了！"],
      win: ["赢、赢了？我们赢了！！"],
    },

    /* —— 通用敌：人修（狠话库，按需触发，量少而精） —— */
    enemy_cultivator: {
      open: ["识相的，把储物袋留下——贫道还能给你留个全尸。"],
      exposed: ["破绽！就是现在——"],
      lowHp: ["不可能……我可是筑基在望之人！"],
      flee: ["留得青山在——告辞！"],
    },

    /* —— 通用敌：妖兽（兽吼拟声，渲染气氛） —— */
    enemy_beast: {
      open: ["（喉间滚出一串低沉的咆哮，獠牙间涎水拉出银丝）"],
      enraged: ["（瞳孔骤缩成针，周身兽毛根根倒竖——它动了真怒！）"],
    },
  };

  const WarLines = {
    /* 取一句未用过的（usedSet=战斗实例的账本 Set）；句尽返回 null=沉默 */
    pick(persona, key, usedSet) {
      const lib = LINES[persona];
      if (!lib || !lib[key] || !lib[key].length) return null;
      const pool = lib[key].filter(s => !usedSet || !usedSet.has(persona + ":" + key + ":" + s));
      if (!pool.length) return null;
      const line = pool[Math.floor(Math.random() * pool.length)];
      if (usedSet) usedSet.add(persona + ":" + key + ":" + line);
      return line;
    },
    has(persona) { return !!LINES[persona]; },
    _LINES: LINES,
  };

  root.WarLines = WarLines;
  if (typeof module !== "undefined" && module.exports) module.exports = WarLines;
})(typeof window !== "undefined" ? window : globalThis);
