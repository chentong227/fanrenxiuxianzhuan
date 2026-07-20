/* ============================================================
 * achievements.js · 成就图鉴（v344·体验打磨批）
 * 长线钩子：把玩家已经做到/将要做到的事变成看得见的收集。
 *   · 纯读现有存档字段判定（零新 schema——unlocked 记在 s.flags.ach_<id>，时刻记 s.achLog）。
 *   · State.save() 时惰性检查（条件全是 O(1) 字段比对，开销可忽略）。
 *   · 解锁：toast + 玉磬 + 入年表（deed）。图鉴页从系统菜单进（UI.openAchievements）。
 * 纯逻辑可无头测试（UI/Sfx 全 typeof 守卫）。
 * ============================================================ */
(function (root) {
  "use strict";

  const LIST = [
    // —— 修行之路 ——
    { id: "first_step",  icon: "🌱", name: "引气入体",   desc: "踏出修行第一步——突破练气二层。",
      cond: (s) => s.realmIndex >= 1 },
    { id: "qi_peak",     icon: "🌿", name: "练气圆满",   desc: "练气一途走到头——修至练气十三层。",
      cond: (s) => s.realmIndex >= 12 },
    { id: "foundation",  icon: "⛰", name: "筑基问道",   desc: "服丹破关，凝练道基——迈入筑基期。",
      cond: (s, R) => R(s) === "foundation" || R(s) === "core" },
    { id: "core",        icon: "💠", name: "金丹大道",   desc: "三转重元，结丹功成——迈入结丹期。",
      cond: (s, R) => R(s) === "core" },
    { id: "centenarian", icon: "🕯", name: "百岁修士",   desc: "寿过百岁——凡人早已换了三代人。",
      cond: (s) => (s.age || 0) >= 100 },

    // —— 恩怨情仇 ——
    { id: "modafu",      icon: "🗡", name: "反客为主",   desc: "夺舍之夜，反杀墨大夫——凡人的算计胜过修士的傲慢。",
      cond: (s) => !!s.flags.modafu_dead },
    { id: "jinguang",    icon: "⚡", name: "暗算杀手",   desc: "以毒与暗器，算计了修仙杀手金光上人。",
      cond: (s) => !!s.flags.jinguang_dead || !!s.flags.arc1_complete },
    { id: "mofu",        icon: "🏮", name: "血债血偿",   desc: "诛五色门主，为墨彩环了结墨府半生血债。",
      cond: (s) => !!s.flags.mofu_avenged },
    { id: "hunter",      icon: "🏹", name: "猎人猎物",   desc: "血色禁地里，反杀了狙杀者封岳。",
      cond: (s) => !!s.flags.fengyue_dead },

    // —— 江湖行走 ——
    { id: "beast_1",     icon: "🐺", name: "初猎凶兽",   desc: "第一头异闻凶兽伏诛于你手。",
      cond: (s) => (s.slainBeasts || []).length >= 1 },
    { id: "beast_5",     icon: "🐯", name: "妖王克星",   desc: "五头异闻凶兽伏诛——山野闻你之名而颤。",
      cond: (s) => (s.slainBeasts || []).length >= 5 },
    { id: "famous",      icon: "📜", name: "威名赫赫",   desc: "名望至三十——江湖上有你的传说。",
      cond: (s) => (s.fame || 0) >= 30 },
    { id: "pierce_veil", icon: "👁", name: "窥破敛息",   desc: "以过人神识，看穿了深藏不露之人的真实修为。",
      cond: (s) => !!s.flags.ach_pierced_veil },
    { id: "ghost_gate",  icon: "🌫", name: "鬼门关前",   desc: "濒死之际被无名好心人救起——命是捡回来的。",
      cond: (s) => !!(s.flags.last_deathrescue && s.flags.last_deathrescue > 0) },

    // —— 百艺经营 ——
    { id: "bottle",      icon: "🍶", name: "掌中天地",   desc: "解开神秘小瓶的秘密——凡人最大的底牌。",
      cond: (s) => !!(s.bottle && s.bottle.unlocked) },
    { id: "dan_60",      icon: "🔥", name: "丹道小成",   desc: "药理修至六十——一炉稳得双丹的火候。",
      cond: (s) => ((s.skills || {}).alchemy || 0) >= 60 },
    { id: "sword_heart", icon: "⚔", name: "剑心通明",   desc: "剑意圆满、闭关悟剑——武学一道登堂入室。",
      cond: (s) => !!s.swordMastery },
    { id: "rich",        icon: "🪙", name: "富甲一方",   desc: "身家纹银逾五百两——凡俗的钱，修仙的底气。",
      cond: (s) => (s.silver || 0) >= 500 },

    // —— 篇章足迹 ——
    { id: "arc_qixuan",  icon: "🚪", name: "七玄门·终", desc: "夺升仙令离门远行——凡人修仙的序章落幕。",
      cond: (s) => (s.unlockedChapters || []).length >= 2 },
    { id: "arc_far",     icon: "🗺", name: "天南万里",   desc: "足迹踏过四个篇章——离青牛镇已隔了半个人界。",
      cond: (s) => (s.unlockedChapters || []).length >= 4 },
  ];

  function realmTier(s) {
    const r = (root.DATA && DATA.realms[s.realmIndex]) || null;
    return r ? r.tier : "qi";
  }

  const ACH = {
    LIST,
    // 惰性检查：State.save 时调——新达成的立即报喜（幂等，flag 防重）
    check(s) {
      if (!s || !s.flags) return;
      const hits = [];
      LIST.forEach(a => {
        const key = "ach_ok_" + a.id;
        if (s.flags[key]) return;
        let ok = false;
        try { ok = !!a.cond(s, realmTier); } catch (e) {}
        if (!ok) return;
        s.flags[key] = true;
        (s.achLog = s.achLog || []).push({ id: a.id, t: `${s.year || 1}年${s.month || 1}月` });
        hits.push(a);
      });
      if (hits.length) {
        // 每枚都入年表；报喜逐条（v345：toast 已带排队——老档补判连中数枚不再只见最后一枚）
        hits.forEach(a => {
          (s.milestones = s.milestones || []).push({ t: `第${s.year || 1}年${s.month || 1}月 · ${s.age || "?"}岁`, title: `成就：${a.name}`, kind: "deed" });
          if (typeof root.UI !== "undefined" && root.UI.toast) root.UI.toast(`成就达成 ${a.icon}「${a.name}」`, false, 3200);
        });
        if (typeof root.Sfx !== "undefined" && root.Sfx.play) root.Sfx.play("chime");
      }
    },
    unlockedCount(s) {
      if (!s || !s.flags) return 0;
      return LIST.filter(a => s.flags["ach_ok_" + a.id]).length;
    },
  };

  if (typeof module !== "undefined" && module.exports) module.exports = ACH;
  root.ACH = ACH;
})(typeof globalThis !== "undefined" ? globalThis : this);
