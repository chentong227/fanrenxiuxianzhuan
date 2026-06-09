/* ============================================================
 * quests.js — 任务系统 与 时间线（预定事件）
 *
 * 两类机制：
 *  1) 时间线事件 events：在未来某月必定发生（如"墨大夫出门五月，归来日张铁身死"）。
 *  2) 限期任务 tasks：给定期限内达成条件则成功(赏)，到期未成则失败(罚/强制事件，甚至强制战斗)。
 *
 * 状态里只存 { id, dueAbs }（可序列化）；逻辑挂在此注册表（含函数）。
 * 时间以"绝对月"计：absMonth = year*12 + month。
 * ============================================================ */

const QUESTS = {
  /* ---------- 限期任务 ---------- */
  tasks: {
    // 墨大夫按层给银，限期验功（达成→赏银；逾期→失欢心）
    // 设计：以四灵根之资，单凭《长春功》苦修，约半年余可满练气一层、再图突破。
    //       故目标定为练气二层、宽限两年——不靠小绿瓶也能从容达成（小绿瓶是后来暗修四层的本钱，不在此列）。
    modafu_deadline: {
      title: "墨大夫的期许",
      desc: "墨大夫初授《长春功》，盼你早日修至练气二层验功。届时按例重赏，莫要懈怠。",
      progress: (s) => `练气${s.realmIndex + 1}层 / 需练气二层`,
      cond: (s) => s.realmIndex >= 1,                 // 练气二层（凡修可达）
      onSuccess(s) {
        s.silver += 30;
        Engine.log("【任务达成·墨大夫的期许】你如期修至练气二层，墨大夫捋须微笑，依约赏你纹银三十两。", "good");
        Engine.toast("任务达成：墨大夫的期许（+30两）");
      },
      onFail(s) {
        s.mood = Math.max(0, s.mood - 8);
        Engine.log("【任务失败·墨大夫的期许】两载已过，你修为竟还不及练气二层。墨大夫微微摇头，眼里掠过一丝难辨的情绪。", "bad");
        Engine.toast("任务超期：未能如期修至练气二层", true);
      },
    },

    // 野狼帮挑衅：限期内修为未成，则喽啰夜袭药庐（强制战斗），并继续施压
    wolf_raid: {
      title: "山雨欲来",
      desc: "野狼帮气焰嚣张，时有喽啰袭扰。趁早修炼精进（练气六层），方有底气应对将来的大祸。",
      progress: (s) => `练气${s.realmIndex + 1}层 / 需练气六层`,
      cond: (s) => s.realmIndex >= 6,
      onFail(s) {
        Engine.log("【任务·山雨欲来】你迟迟未能精进，野狼帮喽啰摸进药庐寻衅——被迫迎战！", "bad");
        Engine.toast("野狼帮夜袭！", true);
        // 强制战斗（到期触发的强制事件）
        Engine.startEncounterFight("wolf_gang_thug");
        // 未达标则继续施压：再给一段期限
        Engine.assignTask("wolf_raid", 5);
      },
    },
  },

  /* ---------- 时间线预定事件 ---------- */
  events: {
    // 墨大夫派张铁外出，约定数月；归期之日，张铁身死的真相浮现
    zhangtie_death: {
      onFire(s) {
        State.setFlag("zhangtie_fated");
        Engine.log("【时间线】张铁外出已逾归期，却音讯全无……一种不祥的预感涌上你心头。", "bad");
      },
    },
  },

  /* ---------- 对谈线索目录（规范化）----------
   * 红线：线索内容、指向地点、兑现产出全部固定，与"谁会知道"一一对应。
   * LLM 只能从某 NPC「确实知道」的线索里挑一条说出口（给 leadId），
   * 绝不会出现"采药老农聊药草却指向密室"这类驴唇不对马嘴。
   *
   * 字段：
   *   id        唯一标识
   *   source    哪些 NPC 知道（npc id 数组）
   *   where     线索指向的真实地点 id（玩家前往即兑现）
   *   title     线索一句话（际遇栏与对谈里显示）
   *   cond(s)   可选：满足才会进入该 NPC 的可透露池（如解锁条件）
   *   payoff    兑现：{ chance, give:{item:n}, log }
   */
  leads: [
    {
      id: "houshan_herb",
      source: ["nongfu"], where: "houshan",
      title: "后山深处崖缝里藏着稀罕灵草",
      payoff: { chance: 0.8, give: { lingcao: 2, duyao_cao: 1 }, log: "你循着老农的指点，在后山崖缝间果然寻见几株灵草。" },
    },
    {
      id: "houshan_centipede",
      source: ["nongfu", "sanxiu"], where: "houshan",
      title: "后山西崖有铁背蜈蚣，蜈壳是上好药引",
      payoff: { chance: 0.7, give: { duyao_cao: 2 }, log: "你在后山西崖寻得铁背蜈蚣的踪迹，取了壳作药引。" },
    },
    {
      id: "town_blackmarket",
      source: ["biaoshi", "sanxiu"], where: "town",
      title: "集镇暗巷有黑市掮客，丹药器物皆可换",
      payoff: { chance: 0.75, give: { lingshi: 1 }, log: "你按所闻寻到集镇暗巷的黑市，淘换得一枚灵石。" },
    },
    {
      id: "town_cheap_herb",
      source: ["langzhong"], where: "town",
      title: "集镇药铺新到一批便宜药材",
      payoff: { chance: 0.85, give: { lingcao: 2 }, log: "你赶到集镇药铺，趁着新货采买了两株灵草。" },
    },
    {
      id: "wuting_skill",
      source: ["lifeiyu", "xiaosuanpan"], where: "wuting",
      title: "演武厅有同门愿指点身法拳脚",
      payoff: { chance: 0.9, body: 1, log: "你到演武厅寻人切磋，几番拆招下来体魄略有精进（体魄+1）。" },
    },
    {
      id: "miju_secret",
      source: ["xiaosuanpan", "sanxiu"], where: "miju",
      title: "墨大夫密室阴气森森，似藏隐秘",
      cond: (s) => s.flags && s.flags.qi_layer_4,   // 修为起疑后这条才会被人提起
      payoff: { chance: 1, demon: 4, log: "你借所闻潜近密室周遭探查，所见种种令你心头发寒（心魔+4）。" },
    },
  ],
};

window.QUESTS = QUESTS;
