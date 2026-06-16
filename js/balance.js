/* ============================================================
 * balance.js — 全局平衡公式（贯穿整个游戏的"尺子"）
 * 见 docs/attributes-and-balance.md
 *
 * 纯函数集合，无 DOM / 无状态，战斗与大世界共用，便于无头测试与后续章节复用。
 * ============================================================ */

(function (root) {
  const Balance = {
    /* ---- 境界功力基数：每个境界一个台阶（练气分层递增，筑基起跳）---- */
    // tierBase：大境界基数；练气层内线性补足
    realmPower(tier, layer) {
      const tierBase = { qi: 0, foundation: 100, core: 400, nascent: 1200 }[tier] || 0;
      const layerStep = { qi: 6, foundation: 30, core: 100, nascent: 300 }[tier] || 6;
      return tierBase + layer * layerStep;
    },

    /* ---- 功力：实力总刻度 ---- */
    gongli({ tier, layer, culRatio = 0, sense = 0, body = 0 }) {
      return this.realmPower(tier, layer)
        + culRatio * ({ qi: 6, foundation: 30, core: 100, nascent: 300 }[tier] || 6)
        + sense * 1.2
        + body * 0.6;
    },

    /* ---- 神识优势：玩家 vs 对手 ---- */
    senseAdvantage(playerSense, enemySense) {
      const diff = playerSense - enemySense;
      return {
        diff,
        seeIntent: diff >= 3,                              // 看穿对方下回合意图(底牌)
        hitBonus: clamp(diff * 0.02, -0.2, 0.2),           // 命中加成
        critBonus: clamp(diff * 0.015, -0.15, 0.2),        // 暴击加成
      };
    },

    /* ---- 镇魂伤害：对元神(soulOnly)之敌，靠功力而非招式 ---- */
    soulSuppressDamage(gongli, enemyGongli) {
      // 功力越高于对方，镇压越狠；低于对方则收效甚微
      const ratio = gongli / Math.max(1, enemyGongli);
      return Math.max(2, Math.round(8 * ratio));
    },

    /* ---- 遁速 → 大世界赶路耗时系数 ---- */
    travelTimeFactor(playerSpeed, baseSpeed = 10) {
      return clamp(baseSpeed / Math.max(1, playerSpeed), 0.4, 1.5);
    },

    /* ---- 遁速 → 先手：谁先动 / 是否抢额外行动 ---- */
    initiative(playerSpeed, enemySpeed, rng = Math.random) {
      const diff = playerSpeed - enemySpeed;
      const playerFirst = diff >= 0 || rng() < 0.5 + diff * 0.02;
      const extraAction = diff > 8 && rng() < clamp((diff - 8) * 0.03, 0, 0.35);
      return { playerFirst, extraAction };
    },

    /* ---- 悟性 → 突破削瓶颈加成 / 顿悟概率 ---- */
    insightBonus(insight) {
      return {
        bottleneckMul: 1 + clamp(insight * 0.02, 0, 0.6),  // 削瓶颈伤害倍率
        epiphanyChance: clamp(insight * 0.015, 0, 0.3),    // 每回合顿悟(额外灵气/暴击)概率
      };
    },

    /* ---- 难度档：敌人威胁比（敌有效输出 / 玩家可承受）---- */
    threatTier(name) {
      return { common: 0.6, strong: 0.9, boss: 1.3 }[name] || 0.6;
    },

    /* ---- 灵气回合结转上限：只有高阶修士才囤得住灵气 ----
     * 练气(tier0)几乎"用不完即散"，仅能存一两点接续连招；
     * 境界越高，越能蓄养灵气、酝酿大招。
     */
    qiCarryCap(realmTier) {
      return ({ 0: 2, 1: 4, 2: 7, 3: 11, 4: 16 })[realmTier || 0] != null
        ? ({ 0: 2, 1: 4, 2: 7, 3: 11, 4: 16 })[realmTier]
        : 2 + (realmTier || 0) * 3;
    },

    /* ---- 法力池深度（对阵轴 v2 战斗资源）----
     * 用户裁决（2026-06-11）：灵力上限严格随 功法×境界×突破水准×特殊境遇——
     *  - 境界：大境界基数跳档（练气→筑基灵海化是质变）+ 层内线性成长
     *  - 功法：主修品阶决定聚灵效率（黄1.0/玄1.1/地1.2/天1.3——换功法=池立涨的体感）
     *  - 突破水准 & 特殊境遇：poolBonus 永久累计（突破道心余裕/天材地宝/灵泉境遇），
     *    绝对值直加、不吃功法折扣（天赐不论出身）。
     */
    manaPool(tier, layer, grade, poolBonus) {
      const T = [
        { b: 40, per: 6 },     // 练气：40+6/层（十三层≈118）
        { b: 130, per: 12 },   // 筑基：灵海（跳档质变）
        { b: 360, per: 24 },   // 结丹：金丹吐纳
        { b: 800, per: 45 },   // 元婴
        { b: 1600, per: 80 },  // 化神
      ][tier || 0] || { b: 40 + (tier || 0) * 360, per: 50 };
      const gradeMul = 1 + Math.max(0, (grade || 1) - 1) * 0.1;
      return Math.round((T.b + (layer || 1) * T.per) * gradeMul + (poolBonus || 0));
    },

    /* ---- 小境界突破：心魔低于此阈值则可水到渠成；高于则须先闯「心战」 ---- */
    demonTrialThreshold() { return 35; },

    /* ---- 功法/技能 槽位（随境界增长，越高阶越能自由组合）----
     * 主修恒为 1 个；辅修槽与技能(法术)槽随大境界序放宽。
     */
    secondaryTechniqueSlots(realmTier) {
      return ({ 0: 1, 1: 2, 2: 3, 3: 4, 4: 5 })[realmTier] != null
        ? ({ 0: 1, 1: 2, 2: 3, 3: 4, 4: 5 })[realmTier]
        : 1 + (realmTier || 0);
    },
    // 出战法术槽（v103 用户裁决：**锁死 8**——单屏 4×2 整齐对齐，取舍即构筑）。
    // 底牌(毒/暗器/符丹)不占槽；法宝法器不占槽（法宝走主/御/伴身三类制）。
    skillSlots() { return 8; },
    // 伴身法宝槽（v96 三类法宝制）：槽数=神识档——境界递增+大衍诀+1
    // （"神识=多法宝并用上限"的字面落地：练气1/筑基2/结丹3/元婴4，大衍诀再+1）
    sideTreasureSlots(realmTier, hasDayan) {
      return Math.max(1, 1 + (realmTier || 0)) + (hasDayan ? 1 : 0);
    },
    // 辅修功法所授技能的强度折扣（主修全效，辅修打折）
    auxiliaryMul() { return 0.7; },

    /* ---- 招式有效强度：来源(武学/法术) × 功法品阶 × 境界 ---- */
    // source: "martial"|"art"；grade: 主修功法品阶(1黄~4天)；realmTier: 大境界序(0练气,1筑基,...)
    sourceMul(source) { return source === "martial" ? 0.8 : 1.0; },
    gradeMul(grade) { return ({ 0: 0.85, 1: 1.0, 2: 1.15, 3: 1.35, 4: 1.6 })[grade || 1] || 1.0; },
    /* ---- 大境界几何标度 realmBand（A2 承重墙·读时计算）----
     * 法术/法器威力随大境界**几何**成长，与法力池/血量同档，而非线性逐档+定值。
     * 线性标度会让高境界手段被基数淹没（"元婴用眨眼只有 20"的根）；几何标度让
     * "招式÷敌血"轴内恒定、跨阶靠底牌咬。候选起步值（待 scale.bal.js 蒙特卡洛校准）：
     *   练气1.0 / 筑基2.4 / 结丹5.5 / 元婴12 / 化神26。
     * realmBand(0)=1.0 → 练气期逐字节零扰动（既有测试全绿的硬约束）。
     * 超出表（化神以上）按 ×2.2/档 外推，保持几何不塌。
     */
    realmBand(realmTier) {
      const band = [1.0, 2.4, 5.5, 12, 26];
      const t = realmTier || 0;
      return band[t] != null ? band[t] : band[band.length - 1] * Math.pow(2.2, t - (band.length - 1));
    },
    realmScale(source, realmTier) {
      // 武学几乎不随大境界成长（贴身肉搏的下限，终被法术/法宝拉开）；
      // 法术与法器统一吃几何 realmBand（标度对齐——法宝额外的强弱由 driveMul/本命决定，不再靠更陡的标度）。
      if (source === "martial") return 1 + (realmTier || 0) * 0.05;
      return this.realmBand(realmTier);
    },
    /* ---- 法宝驱动门槛 driveRealm + 本命系数 natal（A2 承重墙·读时计算）----
     * 法宝威力=注入法力，须境界够格方能"驱"得动（"古宝唯元婴可驱"的考据落地）：
     *  - realmTier < driveRealm：越阶强驱，打折（候选 ×0.45）——练气号驱结丹本命法宝就该弱。
     *  - realmTier ≥ driveRealm 且 natal：达标本命法宝，吃本命系数（候选 ×1.35，体感"主战"）。
     *  - 无 driveRealm（寻常法器·练气即可驭）或达标非本命：×1.0，逐字节零扰动。
     *  - isConsumable（chargeCost 消耗性底牌·特区四通道）：**不吃驱动门槛折扣**——底牌走乘性穿透。
     * 候选起步值待 scale.bal.js 校准。
     */
    driveMul(realmTier, driveRealm, isNatal, isConsumable) {
      const dr = driveRealm || 0;
      const rt = realmTier || 0;
      if (rt < dr) return isConsumable ? 1.0 : 0.45;  // 消耗性底牌豁免门槛折扣
      return isNatal ? 1.35 : 1.0;                     // 达标本命=主战；寻常达标=无修正
    },
    // 功法层数轴：同一门功法逐层精进的"温和"乘子（入门 1.0 → 满层 1.3）。
    // 平缓单调，保证同境界同品阶巅峰>初入，但峰值刻意低于"高一大境界"的跨度（realmScale 一档≥0.35），不喧宾夺主。
    layerMul(layer, maxLayers) {
      if (!maxLayers || maxLayers <= 1) return 1;
      const t = clamp(((layer || 1) - 1) / (maxLayers - 1), 0, 1);
      return 1 + 0.3 * t;
    },
    spellPower(base, source, grade, realmTier, layerMul) {
      let mul = this.sourceMul(source) * this.realmScale(source, realmTier);
      // 品阶加成只作用于功法法术；法器威力看的是法器本身与注入法力，不吃功法品阶
      if (source !== "martial" && source !== "treasure") mul *= this.gradeMul(grade);
      // 功法层进度乘子（仅功法法术；武学/法器不吃）；默认 1 不影响既有四参调用
      if (layerMul && layerMul !== 1 && source !== "martial" && source !== "treasure") mul *= layerMul;
      return Math.max(1, Math.round(base * mul));
    },
  };

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  root.Balance = Balance;
  if (typeof module !== "undefined" && module.exports) module.exports = Balance;
})(typeof window !== "undefined" ? window : globalThis);
