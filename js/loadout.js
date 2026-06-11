/* ============================================================
 * loadout.js — 功法 / 技能 配装系统
 *
 * 真实修仙的"自由组合"：
 *  - 功法是背包里的「典籍」道具，须在闭关时静心研习方能习得。
 *  - 习得后可设为「主修」(×1) 或「辅修」(随境界增多)。主修全效，辅修打折。
 *  - 各功法授予若干「技能(法术)」；连同凡人武学，组成你的技能池。
 *  - 出战技能受「技能槽」上限约束（随境界放宽）——格子有限，方有取舍。
 *  - 强度随境界成长（见 balance.spellPower）。
 *
 * 状态字段（state.js）：
 *   technique            主修功法 id（沿用旧字段）
 *   auxTechniques[]      辅修功法 id
 *   learnedTechniques[]  已习得功法 id
 *   knownSkills[]        已掌握技能(法术) id 池
 *   spells[]             已「装备」出战的技能（战斗实际可用，受槽位上限约束）
 *
 * 纯逻辑、可无头测试。
 * ============================================================ */

(function (root) {

  const Balance = (typeof require !== "undefined") ? require("./balance.js") : root.Balance;

  const Loadout = {
    // 凡人武学（与功法无关，习得后恒在技能池中）
    INNATE_MARTIAL: ["zhayan", "zhayan_lian", "weidu", "feizhen"],
    // 底牌（消耗性手段）：独立体系，不占技能槽。
    // 符箓/符宝也是底牌（combat-arsenal-design.md 轴3）：有实物即可用，无需研习。
    TRUMPS: ["weidu", "feizhen", "huoshe_fu", "hanbing_fu", "jinguang_zhuan"],
    // 符箓类底牌：背包里有符即自动入战（买来就能用——符是修仙界的通货）
    TALISMANS: { huoshe_fu: "huoshe_fu", hanbing_fu: "hanbing_fu", jinguang_zhuan: "jinguang_zhuan_charge" },

    isTrump(skillId) { return this.TRUMPS.includes(skillId); },

    // —— 槽位上限（随境界） ——
    skillCap(s) {
      const tier = (typeof Chapters !== "undefined") ? Chapters.realmTier() : (s._realmTier || 0);
      return Balance.skillSlots(tier);
    },
    // 占槽的出战技能数（底牌不计）
    equippedCount(s) {
      return (s.spells || []).filter(id => !this.isTrump(id)).length;
    },
    auxCap(s) {
      const tier = (typeof Chapters !== "undefined") ? Chapters.realmTier() : (s._realmTier || 0);
      return Balance.secondaryTechniqueSlots(tier);
    },

    // —— 功法：习得 / 主修 / 辅修 ——
    isLearned(s, techId) { return (s.learnedTechniques || []).includes(techId); },

    // 研习一卷功法典籍（闭关时调用）。返回 { ok, reason }
    learnTechnique(s, techId) {
      const def = (typeof DATA !== "undefined") ? DATA.techniques[techId] : null;
      if (!def) return { ok: false, reason: "无此功法" };
      if (def.locked) return { ok: false, reason: "此功法机缘未到，暂不可习" };
      if (this.isLearned(s, techId)) return { ok: false, reason: "已习得此功法" };
      if (!s.learnedTechniques) s.learnedTechniques = [];
      s.learnedTechniques.push(techId);
      // 习得即把所授技能纳入技能池
      (def.grantSpells || []).forEach(sk => this.addKnownSkill(s, sk));
      return { ok: true };
    },

    setMain(s, techId) {
      if (!this.isLearned(s, techId)) return { ok: false, reason: "尚未习得此功法" };
      // 旧主修转入辅修池（若有空位）；新主修从辅修中移除
      const old = s.technique;
      s.auxTechniques = (s.auxTechniques || []).filter(t => t !== techId);
      if (old && old !== techId && this.auxCap(s) > (s.auxTechniques || []).length) {
        s.auxTechniques.push(old);
      }
      s.technique = techId;
      this._resyncKnown(s);
      return { ok: true };
    },

    addAux(s, techId) {
      if (!this.isLearned(s, techId)) return { ok: false, reason: "尚未习得此功法" };
      if (techId === s.technique) return { ok: false, reason: "主修不可同时为辅修" };
      if (!s.auxTechniques) s.auxTechniques = [];
      if (s.auxTechniques.includes(techId)) return { ok: false, reason: "已是辅修" };
      if (s.auxTechniques.length >= this.auxCap(s)) return { ok: false, reason: "辅修槽位已满（随境界增多）" };
      s.auxTechniques.push(techId);
      this._resyncKnown(s);
      return { ok: true };
    },

    removeAux(s, techId) {
      s.auxTechniques = (s.auxTechniques || []).filter(t => t !== techId);
      this._resyncKnown(s);
      return { ok: true };
    },

    // 当前生效的功法（主修 + 辅修）
    activeTechniques(s) {
      const out = [];
      if (s.technique) out.push(s.technique);
      (s.auxTechniques || []).forEach(t => out.push(t));
      return out;
    },

    // 某技能是否来自辅修功法（用于战斗打折）
    isAuxSkill(s, skillId) {
      if (this.INNATE_MARTIAL.includes(skillId)) return false;
      const mainDef = (typeof DATA !== "undefined") ? DATA.techniques[s.technique] : null;
      if (mainDef && (mainDef.grantSpells || []).includes(skillId)) return false; // 主修授予=全效
      // 来自辅修功法
      return (s.auxTechniques || []).some(t => {
        const d = DATA.techniques[t];
        return d && (d.grantSpells || []).includes(skillId);
      });
    },

    // 辅修技能 id 集合（供战斗折算）
    auxSkillSet(s) {
      const set = [];
      (s.spells || []).forEach(sk => { if (this.isAuxSkill(s, sk)) set.push(sk); });
      return set;
    },

    // —— 技能：习得池 / 装备 ——
    addKnownSkill(s, skillId) {
      if (!s.knownSkills) s.knownSkills = [];
      if (!s.knownSkills.includes(skillId)) s.knownSkills.push(skillId);
    },

    // 技能池：已习得功法所授 + 凡人武学（限已掌握的）+ 剧情特授
    knownPool(s) {
      const pool = new Set(s.knownSkills || []);
      this.activeTechniques(s).forEach(t => {
        const d = (typeof DATA !== "undefined") ? DATA.techniques[t] : null;
        if (d) (d.grantSpells || []).forEach(sk => pool.add(sk));
      });
      return [...pool];
    },

    isEquipped(s, skillId) { return (s.spells || []).includes(skillId); },

    equipSkill(s, skillId) {
      if (!this.knownPool(s).includes(skillId)) return { ok: false, reason: "尚未掌握此技能" };
      if (this.isEquipped(s, skillId)) return { ok: false, reason: "已装备" };
      // 底牌不占技能槽（独立体系）
      if (!this.isTrump(skillId) && this.equippedCount(s) >= this.skillCap(s)) return { ok: false, reason: "技能槽已满（随境界增多）" };
      if (!s.spells) s.spells = [];
      s.spells.push(skillId);
      return { ok: true };
    },

    unequipSkill(s, skillId) {
      s.spells = (s.spells || []).filter(x => x !== skillId);
      return { ok: true };
    },

    // 主修/辅修变更后，把失去来源、又未单独掌握的技能从出战栏剔除（保持自洽）
    _resyncKnown(s) {
      const pool = this.knownPool(s);
      s.spells = (s.spells || []).filter(sk => pool.includes(sk));
    },

    // 老存档迁移：把旧 spells 当作"已掌握且已装备"，主修沿用 technique
    migrate(s) {
      if (!s.learnedTechniques) s.learnedTechniques = [s.technique].filter(Boolean);
      if (!s.auxTechniques) s.auxTechniques = [];
      if (!s.knownSkills) s.knownSkills = (s.spells || []).slice();
      // 确保主修所授技能在已掌握池
      const md = (typeof DATA !== "undefined") ? DATA.techniques[s.technique] : null;
      if (md) (md.grantSpells || []).forEach(sk => this.addKnownSkill(s, sk));
    },
  };

  root.Loadout = Loadout;
  if (typeof module !== "undefined" && module.exports) module.exports = Loadout;

})(typeof window !== "undefined" ? window : globalThis);
