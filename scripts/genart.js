/* ============================================================
 * genart.js — 一次性生成第一章固定配图，存进仓库 assets/
 *
 * 用法（key 不写进代码，命令行临时传入；走代理）：
 *   $env:HTTPS_PROXY=""; node scripts/genart.js <OPENROUTER_KEY> [onlyId]
 *
 * 说明：
 *  - 通过 OpenRouter 的 gemini-2.5-flash-image 出图（国风水墨淡彩）。
 *  - 生成的 PNG 落地到 assets/<id>.png，提交进仓库（一劳永逸，玩家无需联网/不耗 key）。
 *  - 新人物/新场景的"实时生成 + localStorage 缓存"在 js/art.js，本脚本只管固定图。
 * ============================================================ */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const KEY = process.argv[2];
const ONLY = process.argv[3];
if (!KEY) { console.error("用法: node scripts/genart.js <OPENROUTER_KEY> [onlyId]"); process.exit(1); }

const MODEL = "google/gemini-2.5-flash-image";
const PROXY = process.env.GEN_PROXY || "http://127.0.0.1:7890";
const OUT = path.join(__dirname, "..", "assets");
const TMP = path.join(__dirname, "..", "test");
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

// 统一画风：忠于《凡人修仙传》动画剧版——3D 渲染电影质感、写实国风仙侠、
// 柔和暖调布光、半身像、神情含蓄克制。所有人物共享同一画风，保证整体协调、特征鲜明。
const STYLE_PORTRAIT = "《凡人修仙传》动画剧版同款画风，3D渲染电影级质感，写实国风仙侠人物半身像，精细面部与发丝，柔和影棚布光，气质沉静克制，竖构图，单人，纯白色背景#ffffff、人物与背景边界清晰分明、背景不含任何道具或纹理，无文字无水印无logo";
const STYLE_SCENE = "《凡人修仙传》动画剧版同款画风，3D渲染电影级场景，写实国风仙侠，光影氛围考究，意境悠远，横构图，画面铺满整个画幅、无黑边无边框无留白，无人物特写无文字无水印";
const STYLE_CG = "《凡人修仙传》动画剧版同款画风，3D渲染电影级剧情画面，写实国风仙侠，戏剧张力与光影氛围拉满，电影宽幅构图，画面铺满整个画幅、无黑边无边框无留白，无文字无水印无logo";
// 竖版（手机竖屏专用资产，文件名 <id>_p.png）：纵向构图顶天立地，杜绝竖屏 cover 放大糊化
const STYLE_SCENE_P = "《凡人修仙传》动画剧版同款画风，3D渲染电影级场景，写实国风仙侠，光影氛围考究，意境悠远，竖构图9:16纵向画幅、上下顶天立地铺满全图、无黑边无边框无留白，无人物特写无文字无水印";
const STYLE_CG_P = "《凡人修仙传》动画剧版同款画风，3D渲染电影级剧情画面，写实国风仙侠，戏剧张力与光影氛围拉满，竖构图9:16纵向画幅、主体居中、上下顶天立地铺满全图、无黑边无边框无留白，无文字无水印无logo";

const DEFS = {
  // —— 主要人物立绘（剧版特征锚定，确保识别度）——
  hanli:    { kind: "portrait", prompt: "少年韩立，约十五岁，乌黑长发束成半扎发髻、余发垂肩，眉目清秀沉静，眼神坚毅内敛，身着橄榄黄绿色交领道袍、肩部有菱格暗纹，神情不动声色" },
  modafu:   { kind: "portrait", prompt: "墨大夫，一位清癯矍铄的银发老者，银白长发整齐梳向脑后，蓄花白山羊胡，面容清隽、神色沉静内敛，身着深褐色带金线团纹的医者长袍，手腕戴佛珠，气度不凡而暗藏深意" },
  lifeiyu:  { kind: "portrait", prompt: "少年厉飞雨，约十六岁，乌黑长发高束成顶髻、余发垂落肩背，剑眉星目、面容俊朗，神情沉静自信，身着青灰色交领道袍，身姿挺拔" },
  zhangtie: { kind: "portrait", prompt: "少年张铁，约十六岁，乌黑短发利落，浓眉、面容端正清朗，左脸颊有一道浅疤，神情憨厚温和、老实仗义，身着朴素的灰色粗布短打，体格结实" },
  // —— 次要/背景人物立绘 ——
  xiaosuanpan: { kind: "portrait", prompt: "门派管事弟子小算盘，约二十岁，精瘦机灵，眯缝眼、一脸精明算计的笑，束发，身着褐色短打弟子服，手里似拨着算盘" },
  jiatianlong: { kind: "portrait", prompt: "野狼帮帮主贾天龙，魁梧凶悍的壮年汉子，浓眉横肉、留络腮短须，眼神野心勃勃，身着深色劲装外披兽皮，气势粗豪" },
  jinguang:    { kind: "portrait", prompt: "金光上人，一个矮胖的中年和尚，光头、面圆，眉眼阴狠，身着土黄色僧袍、外罩袈裟，周身隐隐金光，神情倨傲" },
  nongfu:      { kind: "portrait", prompt: "采药老农，一位皮肤黝黑、布满皱纹的老山民，须发花白，头扎布巾，身着洗得发白的粗布衣，背着竹篓，神情质朴和善" },
  sanxiu:      { kind: "portrait", prompt: "云游散修，一个三十上下的漂泊修士，面色风霜、眼神桀骜，束发简陋，身着半旧的青灰色道袍，腰悬法器，神情眼高于顶" },
  langzhong:   { kind: "portrait", prompt: "走方郎中，一位精瘦的中年凡俗大夫，留短须，戴方巾，身着洗旧的灰蓝长衫，背着药箱，神情精明世故" },
  biaoshi:     { kind: "portrait", prompt: "镖局趟子手，一个结实剽悍的江湖汉子，短打劲装，腰挎单刀，面有风霜与刀疤，眼神警惕" },
  langhao:     { kind: "portrait", prompt: "野狼帮喽啰，一个凶相的壮年打手，乱发、横眉，身着杂乱的深色短打，手持狼牙棒，一脸蛮横" },
  // —— 新增立绘（剧情补全）——
  sanshu:   { kind: "portrait", prompt: "韩立的三叔，四十多岁的精明中年人，在仙门做杂事管事多年，圆脸微胖，蓄短须，笑容世故而不失亲切，身着体面的褐色绸面短褂，头戴方巾" },
  tienu:    { kind: "portrait", prompt: "被炼成傀儡的少年尸傀「铁奴」，肤色铁青毫无血色，双目空洞泛着浊白，乌黑短发散乱，左脸颊有一道浅疤，身着破败的灰色粗布短打，体格结实但姿态僵直，周身缠绕淡淡阴气，诡异悲凉" },
  // —— 场景 ——
  yaolu:    { kind: "scene", prompt: "古朴清幽的中药药庐内景，木质药柜林立、抽屉密布，铜药碾与丹炉，窗棂透入暖光，药香氤氲" },
  houshan:  { kind: "scene", prompt: "云雾缭绕的仙门后山，奇峰幽谷，灵草丛生，古木森森，溪涧幽深，深处隐有凶险气息" },
  town:     { kind: "scene", prompt: "山脚下被帮派阴影笼罩的凡俗古镇街景，青瓦土墙，市井街巷烟火气中透着压抑，街口立着插威风旗幡的帮派分舵，几条挎刀的彪悍汉子倚墙而立监视往来行人，商贩低头疾走，远处仙山隐现于云雾" },
  wuting:   { kind: "scene", prompt: "仙门演武厅内景，宽阔的木地演武场，两侧兵器架林立，梁柱庄严肃穆，天光斜入" },
  // —— 过场场景（开场剧情用）——
  qingniu:  { kind: "scene", prompt: "贫苦的北方小山村农家，低矮的土坯茅屋，柴门篱笆，几亩薄田，黄昏炊烟，清贫萧瑟" },
  // 考据修正：七玄门=凡俗武林帮派——赴考路是人间山道（土路骡马栈道），不是仙山天门
  road:     { kind: "scene", prompt: "通往武林门派的人间山道，黄土路与碎石阶在丘陵山林间蜿蜒，路边有歪斜的指路木牌与茶棚草棚，挑担赶考的少年与骡马商队点缀途中，远处山腰隐约可见一片青瓦寨墙（凡俗武馆山寨气象），晨光薄雾，朴实苍润，无仙气无宫殿" },
  // 考据修正：七玄门是凡人武林帮派（江湖门派），不是修仙门派——山门须是武林山寨气派而非仙家殿宇
  shanmen:  { kind: "scene", prompt: "凡俗武林大派的山门，彩霞山腰间一座厚重的石砌寨门与木质牌楼，匾书门派之名，寨墙绵延，门前石阶宽阔，刀枪旗帜林立，往来皆是短打劲装的江湖武人，远山如黛，烟火人间气，无仙气无云海" },
  miju:     { kind: "scene", prompt: "墨大夫秘不示人的密室内景，幽暗压抑，石壁森森，案上摆着诡异的丹炉与瓶罐，阴气弥漫，烛光摇曳" },
  // —— 关键剧情 CG（assets/cg_<id>.png）——
  cg_bottle:    { kind: "cg", file: "cg_bottle", prompt: "一只古朴的暗绿色小瓶静静悬在少年掌心上方，瓶身流转着神秘的幽绿灵光，映亮少年清秀而震惊的脸，背景是昏暗的陋室，深夜烛光，神秘机缘降临的瞬间" },
  cg_duoshe:    { kind: "cg", file: "cg_duoshe", prompt: "深夜药庐中的生死对决：清瘦少年持短刃隐于阴影蓄势待发，对面银发老者周身泛着阴冷光芒、面容狰狞似被夺舍，烛火摇曳将两道身影拉长，药柜林立的房间里杀机四伏，决战一触即发" },
  cg_jinguang:  { kind: "cg", file: "cg_jinguang", prompt: "山林夜战：一个矮胖和尚周身金光大盛如金钟罩体，怒目狰狞，无数细小的暗器飞针破空袭来钉向金光，少年的身影半隐于林间黑暗中，以暗算破金刚，紧张凌厉的战斗瞬间" },
  cg_departure: { kind: "cg", file: "cg_departure", prompt: "清晨薄雾中，一个背着行囊的少年道袍身影独自走在下山的古道上，回望一眼巍峨仙门，前方群山苍茫云海翻涌，离别与新程交织的苍凉意境，大远景构图" },

  // —— 离门远行章（考据：lore-departure.md，动漫7~9集）——
  mocaihuan: { kind: "portrait", prompt: "少女墨彩环，约十五六岁，乌黑长发梳成俏皮的双髻、缀着红色发绳，杏眼圆亮、古灵精怪，笑容狡黠又娇憨，身着鹅黄色绣花襦裙、外罩浅碧色比甲，凡俗富家小姐装束，手里把玩着一只小药丸，神情活泼灵动" },
  // （考据修正 2026-06-11：动漫线嘉元城无欧阳飞天之战——墨府之敌是五色门，在京城篇兑现。
  //   原 ouyangfeitian 立绘已废弃删除，引以为戒：先考据后生图。）

  // —— 黄枫谷篇 · 入谷四连人物 ——
  wushishu: { kind: "portrait", prompt: "黄枫谷修士吴师叔，四十岁上下的温和中年修士，面容敦厚，短须整洁，眉眼带着真诚的善意，身着黄枫谷制式的赭黄色道袍，腰悬木牌，气质如沐春风又略显文弱" },
  luyunfeng: { kind: "portrait", prompt: "黄枫谷内门弟子陆云风，二十五六岁的锦袍青年修士，面容俊俏却挂着倨傲冷笑，眼神阴鸷睥睨，锦缎滚边的华贵青袍，手摇折扇，世家子弟的骄横气" },
  yeshishu: { kind: "portrait", prompt: "黄枫谷长老叶师叔，六十岁上下的青袍老者，鹰目薄唇，颧骨高耸，神情深沉莫测、皮笑肉不笑，深青色长老道袍绣暗纹，负手而立，深谋老辣藏着算计" },
  mashibo: { kind: "portrait", prompt: "百药园管园马师伯，黑瘦干瘪的七旬老者，皮肤黝黑布满沟壑，山羊胡稀疏花白，眼神锐利挑剔却藏着温度，挽着袖口的粗布短褂沾着泥土药渍，腰别小药锄，刀子嘴豆腐心的老药农" },
  chenqiaoqian: { kind: "portrait", prompt: "黄枫谷女修陈巧倩，二十出头的清丽女子，乌黑长发松松挽起一支素银簪，眉目清冷疏离、眼神沉静坚韧，身着月白色滚青边的修士长裙，气质如寒潭秋水，清贵世家女的端方与倔强" },
  baiyao_yuan: { kind: "scene", prompt: "仙门药园全景，向阳山坡上一畦畦灵田顺山势铺开，灵草泛着微微莹光，田间竹制引泉水道蜿蜒，园角一间旧丹房与草棚，远处仙山云雾，晨光透亮，生机盎然的耕植药香气象，无人物特写" },
  jiayuan_city: { kind: "scene", prompt: "古代南方大城的繁华街市与一座朱门宅院，青石长街车马如流、商铺林立旗幡招展，街角望去一座高墙朱门的大宅（门庭略显冷落、匾上漆色微剥），南方水乡富庶气象，黄昏暖光，市井烟火气浓郁，无仙气" },
  wanxiaoshan: { kind: "portrait", prompt: "年轻散修万小山，二十出头，圆脸带憨厚笑容，眉眼弯弯亲切热忱，乌发束简单道髻，身着半旧的靛青色道袍，背着鼓鼓囊囊的行囊，腰挂几个杂物小袋，神情心善不谙世事" },
  tainan_fair: { kind: "scene", prompt: "深山幽谷中的修仙者隐秘集市，山谷两侧绵延着简易摊位与布幡，摊上法器灵药泛着微微灵光，往来修士身着各色道袍、有人御剑掠过谷顶，谷壁苍翠云雾缭绕，黄昏光线神秘悠远，仙凡交界的奇诡集会氛围" },
  huangfeng_gate: { kind: "scene", prompt: "巍峨仙门黄枫谷山门，太岳山脉云海之间，高耸的青石牌坊与盘山石阶，两侧枫林如火与苍松翠柏交错，仙鹤掠过云端，山门后隐见层叠殿宇与悬空栈道，朝霞圣洁光辉，真正的修仙宗门气象，宏大庄严" },

  // —— 天南·越国大舆图（大陆层底图）——
  // 地理考据（凡人手册/原文）：镜州在越国西北（贫困，彩霞山=镜州第二大山，原名落凤山，
  // 传说五色彩凤化山）；建州在北部（第二大州，多山丘陵，西部太岳山脉连绵数千里，黄枫谷在焉，
  // 北接元武国）；岚州在南部（第二富足产粮大州，嘉元城为岚州第一城，最南广贵城三面环山一面靠湖，
  // 西四十里太南山）；越京居中为京城；东侧临海（乱星海远在海外）。
  tiannan_map: { kind: "map", file: "tiannan_map", prompt: "中国古代水墨舆图风格的越国全境鸟瞰地图，宣纸米黄底色，写意山水画法：西北角群山连绵（其中一峰隐隐透出五色霞光），正北横亘一条雄浑绵长的大山脉（山势嵯峨连绵数千里），中部平原点缀城郭与阡陌，南部沃野千里河渠纵横（产粮富庶之地），最南端有湖泊与环山小城，东侧为蜿蜒海岸线与浩渺远海（海上墨色留白），山用披麻皴、水用留白法、城郭用简笔界画，淡彩晕染，古意盎然，俯瞰视角，绝对不含任何文字、地名、标记、印章、图例、罗盘", },
};

/* ============ 竖版场景/CG（手机竖屏专用，文件 <id>_p.png）============
 * 同一地点的纵向重构图：竖屏 cover 不再放大糊化。 */
const P_SCENES = {
  yaolu:    "古朴清幽的中药药庐内景，纵深视角望向窗棂，木质药柜高耸密布直抵屋顶，铜药碾与丹炉错落，暖光自高窗斜入，药香氤氲",
  houshan:  "云雾缭绕的仙门后山，纵向幽谷，奇峰自下而上层叠入云，灵草丛生，古木参天，溪涧自深谷垂落",
  town:     "山脚下凡俗古镇的纵深街景，青瓦土墙窄巷向远处延伸，帮派旗幡高挂，挎刀汉子倚墙，远处仙山高耸入云",
  wuting:   "仙门演武厅纵深内景，高大梁柱向上延伸，兵器架立于两侧，天光自高窗倾泻而下照亮演武场",
  qingniu:  "贫苦北方小山村，纵向构图：脚下土路通向低矮土坯茅屋，柴门篱笆，远处薄田与黄昏炊烟升上高空",
  road:     "通往武林门派的人间山道纵向构图：黄土路与碎石阶自脚下蜿蜒上山，路边指路木牌与茶棚，挑担少年与骡马商队，山腰隐约青瓦寨墙（凡俗武馆山寨），晨光薄雾，朴实无仙气",
  shanmen:  "凡俗武林大派山门，纵向构图：宽阔石阶自下而上通往厚重石砌寨门与木牌楼，刀枪旗帜林立，远山如黛",
  miju:     "幽暗密室纵深内景，石壁高耸压抑，烛光自案上丹炉摇曳而上，阴气如雾升腾",
  jiayuan_city: "古代南方大城纵深街景，青石长街向远处城楼延伸，商铺旗幡层层叠叠，街尽头一座朱门大宅，黄昏暖光，市井烟火",
  tainan_fair:  "深山幽谷修仙集市纵向构图，摊位布幡沿谷底向远处延伸，御剑修士自头顶谷隙掠过，两侧谷壁苍翠高耸入云，灵光点点",
  huangfeng_gate: "巍峨仙门黄枫谷山门纵向构图：盘山石阶自脚下直上云端，高耸青石牌坊矗立，两侧枫林如火，仙鹤掠过头顶云海，殿宇悬于高处",
};
const P_CGS = {
  bottle:    "一只古朴的暗绿色小瓶静静悬在少年掌心上方，瓶身流转神秘幽绿灵光，映亮少年清秀震惊的脸，竖构图自上而下：瓶、手、少年面庞，背景昏暗陋室烛光",
  duoshe:    "深夜药庐生死对决竖构图：上方银发老者周身阴冷光芒面容狰狞，下方清瘦少年持短刃隐于阴影蓄势待发，烛火摇曳，药柜高耸，杀机四伏",
  jinguang:  "山林夜战竖构图：上方矮胖和尚金光大盛如金钟罩体怒目狰狞，无数暗器飞针自下方破空而上钉向金光，少年身影半隐于下方林间黑暗",
  departure: "清晨薄雾竖构图：背行囊的少年道袍身影立于下方古道，仰望上方巍峨仙门与翻涌云海，群山苍茫纵向延伸，离别与新程交织",
};
Object.entries(P_SCENES).forEach(([id, prompt]) => {
  DEFS[id + "_p"] = { kind: "scene_p", file: id + "_p", prompt };
});
Object.entries(P_CGS).forEach(([id, prompt]) => {
  DEFS["cg_" + id + "_p"] = { kind: "cg_p", file: "cg_" + id + "_p", prompt };
});

/* ============ 人物表情集（同一人物特征锚定+表情替换）============ */
const EMO_DEFS = {
  hanli_cold:   "少年韩立，约十五岁，乌黑长发束成半扎发髻、余发垂肩，眉目清秀，身着橄榄黄绿色交领道袍肩部菱格暗纹——眼神冰冷如霜，杀意内敛，嘴角紧抿，侧目而视的冷峻神情",
  hanli_smile:  "少年韩立，约十五岁，乌黑长发束成半扎发髻、余发垂肩，眉目清秀，身着橄榄黄绿色交领道袍肩部菱格暗纹——难得露出一点真心的浅笑，眉目舒展，温和少年气",
  mocaihuan_sad:    "少女墨彩环，约十五六岁，乌黑双髻缀红色发绳，杏眼圆亮，鹅黄色绣花襦裙外罩浅碧色比甲——眼眶通红噙着泪水，瘪着嘴强忍不哭，委屈巴巴的神情",
  mocaihuan_scheme: "少女墨彩环，约十五六岁，乌黑双髻缀红色发绳，杏眼圆亮，鹅黄色绣花襦裙外罩浅碧色比甲——眯眼坏笑，一手叉腰一手指着前方，狡黠得逞的得意神情",
  lifeiyu_laugh: "少年厉飞雨，约十六岁，乌黑长发高束顶髻余发垂肩，剑眉星目面容俊朗，青灰色交领道袍——仰头爽朗大笑，意气风发，豪迈洒脱",
  modafu_sinister: "墨大夫，清癯矍铄的银发老者，银白长发梳向脑后，花白山羊胡，深褐色带金线团纹医者长袍，手腕佛珠——面容阴沉狞笑，浑浊眼中精光毕露，藏不住的森然恶意",
  wanxiaoshan_panic: "年轻散修万小山，二十出头圆脸，乌发简单道髻，半旧靛青色道袍背着鼓囊行囊——满脸惊慌失措，冷汗涔涔，张嘴欲喊的紧张神情",
};
Object.entries(EMO_DEFS).forEach(([id, prompt]) => {
  DEFS[id] = { kind: "portrait", file: id, prompt };
});

const STYLES = {
  portrait: STYLE_PORTRAIT,
  scene: STYLE_SCENE, scene_p: STYLE_SCENE_P,
  cg: STYLE_CG, cg_p: STYLE_CG_P,
  map: STYLE_SCENE,
};
// kind → 输出子目录（assets 分类重构 2026-06-11）
const SUBDIR = {
  portrait: "portraits",
  scene: "scenes", scene_p: "scenes",
  cg: "cg", cg_p: "cg",
  map: "maps",
};

function genOne(id, def) {
  const style = STYLES[def.kind] || STYLE_SCENE;
  const body = JSON.stringify({
    model: MODEL,
    modalities: ["image", "text"],
    messages: [{ role: "user", content: `${style}。画面内容：${def.prompt}。` }],
  });
  const bodyFile = path.join(TMP, "_genart.body.json");
  const respFile = path.join(TMP, "_genart.resp.json");
  fs.writeFileSync(bodyFile, body);
  // 用 curl.exe 走代理（本机已验证可直出图）
  execFileSync("curl.exe", [
    "-s", "-x", PROXY, "-X", "POST", "https://openrouter.ai/api/v1/chat/completions",
    "-H", "Authorization: Bearer " + KEY,
    "-H", "Content-Type: application/json",
    "-H", "X-Title: FanrenXiuxian",
    "--data", "@" + bodyFile,
    "-o", respFile,
  ], { stdio: "ignore" });
  const j = JSON.parse(fs.readFileSync(respFile, "utf8"));
  if (j.error) throw new Error(JSON.stringify(j.error));
  const m = j.choices && j.choices[0] && j.choices[0].message;
  const url = m && m.images && m.images[0] && m.images[0].image_url && m.images[0].image_url.url;
  if (!url) throw new Error("无图片返回: " + JSON.stringify(j).slice(0, 200));
  const b64 = url.split(",")[1];
  const dir = path.join(OUT, SUBDIR[def.kind] || "");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const outFile = path.join(dir, (def.file || id) + ".png");
  fs.writeFileSync(outFile, Buffer.from(b64, "base64"));
  try { fs.unlinkSync(bodyFile); fs.unlinkSync(respFile); } catch (e) {}
  return outFile;
}

// 生成后自动后处理：立绘抠透明底；场景/CG 裁影院黑边（竖版同样强裁左右黑条）
function postProcess(file, def) {
  try {
    if (def.kind === "portrait") {
      execFileSync("node", [path.join(__dirname, "cutout.js"), file, file], { stdio: "inherit" });
    } else if (def.kind !== "map") {
      execFileSync("node", [path.join(__dirname, "cropbars.js"), "--force", file], { stdio: "inherit" });
    }
  } catch (e) { console.log("  后处理失败（图已保存，可手动处理）:", e.message); }
}

(async () => {
  const ids = ONLY ? [ONLY] : Object.keys(DEFS);
  for (const id of ids) {
    if (!DEFS[id]) { console.log("跳过未知 id:", id); continue; }
    process.stdout.write(`生成 ${id} ... `);
    try { const f = genOne(id, DEFS[id]); console.log("✓"); postProcess(f, DEFS[id]); }
    catch (e) { console.log("✗", e.message); }
  }
  console.log("完成。");
})();
