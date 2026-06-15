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
// 高质量模型（战斗立绘/战斗场景等长期资产——质量优先，按条目 hq:true 启用，不滥用）
const MODEL_HQ = process.env.GEN_HQ_MODEL || "google/gemini-3-pro-image-preview";
// 代理：默认走本机 clash(7890)；无代理环境（CI/云机）显式传 GEN_PROXY="" 或 GEN_PROXY=none 直连
const PROXY = (process.env.GEN_PROXY != null) ? process.env.GEN_PROXY : "http://127.0.0.1:7890";
const USE_PROXY = PROXY && PROXY !== "none";
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
// 战斗立绘（对阵轴单位）：全身像、白底抠图、姿态有威胁感——立在战场上的"棋子"
const STYLE_BATTLER = "《凡人修仙传》动画剧版同款画风，3D渲染电影级质感，写实国风仙侠，单个完整全身像（从头到脚完整入画，脚部着地不裁切），姿态自然带战意，竖构图，纯白色背景#ffffff、主体与背景边界清晰分明、背景不含任何道具阴影或纹理，无文字无水印无logo";
// 战斗场景（对阵轴战场底图）：横版、下半幅是开阔可站人的地面、中远景纵深——"人站在地图里"
const STYLE_BATTLE_SCENE = "《凡人修仙传》动画剧版同款画风，3D渲染电影级场景，写实国风仙侠，横构图16:9，画面下半部为开阔平整的地面（空旷可供人物站立对峙，无遮挡物），中景与远景纵深分明、光影氛围考究，画面铺满整个画幅、无黑边无边框无留白，无人物无文字无水印";
// 中景物件层（三层分级制 v88：人物插在中景与地台之间——飞在树前不突兀的结构解）：
// 白底实物条带，抠透明后叠在远景之上、人物之后，独立视差速率
const STYLE_MIDLAYER = "《凡人修仙传》动画剧版同款画风，3D渲染电影级质感，写实国风仙侠，横构图：一组中景实物横向排布成条带（物件之间留大段空隙），每件物件都是完整上色的写实渲染（有材质纹理与光影，绝非剪影绝非黑影绝非轮廓），物件形体实心紧凑（无镂空无细密枝杈——枝叶类物件须团块密实），所有物件底缘整齐落在同一条水平基线上，纯白色背景#ffffff、物件与背景边界清晰分明、无地面无天空无投影，无人物无文字无水印";
// 长卷全景（横向卷轴底图）：超宽画幅、横向连续构图——镜头左右平移时背景跟着走（探索轴/战斗轴共用）
const STYLE_PANO = "《凡人修仙传》动画剧版同款画风，3D渲染电影级场景，写实国风仙侠，超宽全景横构图21:9宽幅、横向卷轴式连续构图（画面自左至右地貌连续渐变、无重复无拼接感），画面下半部为连续平整可行走的地面（无遮挡物），中景与远景纵深分明、光影氛围考究，画面铺满整个画幅、无黑边无边框无留白，无人物无文字无水印";

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

  // —— 天南·胥国大舆图（大陆层底图；动画即原著越国）——
  // 地理考据（凡人手册/原文）：镜州在胥国西北（贫困，彩霞山=镜州第二大山，原名落凤山，
  // 传说五色彩凤化山）；建州在北部（第二大州，多山丘陵，西部太岳山脉连绵数千里，黄枫谷在焉，
  // 北接元武国）；岚州在南部（第二富足产粮大州，嘉元城为岚州第一城，最南广贵城三面环山一面靠湖，
  // 西四十里太南山）；越京居中为京城；东侧临海（乱星海远在海外）。
  tiannan_map: { kind: "map", file: "tiannan_map", prompt: "中国古代水墨舆图风格的胥国全境鸟瞰地图，宣纸米黄底色，写意山水画法：西北角群山连绵（其中一峰隐隐透出五色霞光），正北横亘一条雄浑绵长的大山脉（山势嵯峨连绵数千里），中部平原点缀城郭与阡陌，南部沃野千里河渠纵横（产粮富庶之地），最南端有湖泊与环山小城，东侧为蜿蜒海岸线与浩渺远海（海上墨色留白），山用披麻皴、水用留白法、城郭用简笔界画，淡彩晕染，古意盎然，俯瞰视角，绝对不含任何文字、地名、标记、印章、图例、罗盘", },
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

/* ============ 战斗资产（对阵轴 MVP：妖兽/敌人全身立绘 + 战场底图）============
 * 全部 hq:true（长期资产质量优先）；ref 字段=参考图编辑（角色一致性变体——
 * 同一底模换形态/配色，免重抽，nano banana 系看家本领）。 */
const BATTLE_DEFS = {
  // —— 妖兽全身立绘（battlers/）——
  bt_wolf:   { kind: "battler", hq: true, prompt: "一头凶悍的灵狼妖兽，体型如小牛犊，铁灰色粗硬鬃毛，双目泛着幽绿凶光，獠牙外露低伏欲扑的姿态，爪锋锐利，周身隐隐有淡淡妖气" },
  bt_chimu:  { kind: "battler", hq: true, ref: "battlers/bt_wolf.png",
               prompt: "同一画风的狼形妖兽变体：赤目狼王——比灵狼更高大威猛的狼王，双目赤红如血，深炭黑色鬃毛间透出暗红色火纹，獠牙更长，姿态更具压迫感，周身缭绕淡淡赤色火煞之气" },
  bt_baihu:  { kind: "battler", hq: true, prompt: "一头白额吊睛猛虎妖兽，体型雄壮如牛，白色额纹醒目，金黄虎纹皮毛油亮，双目金芒慑人，巨爪按地、虎躯低伏蓄势欲扑，周身金色妖煞之气隐现，兽王威仪" },
  bt_wugong: { kind: "battler", hq: true, prompt: "一只铁背蜈蚣王妖兽，丈余长的巨型蜈蚣昂起前半身，铁灰色金属光泽的厚重甲壳层层叠叠，百足如林，一对毒牙泛着幽蓝寒光，触须高扬，姿态狰狞慑人" },
  // —— 人形敌全身立绘 ——
  bt_bandit:  { kind: "battler", hq: true, prompt: "凡俗山贼，三十多岁的精悍匪徒，乱发束巾，满脸横肉短须，身着打补丁的深褐色短打、缠布绑腿，双手握一柄环首砍刀斜指，咧嘴狞笑，匪气十足" },
  bt_wuren:   { kind: "battler", hq: true, prompt: "凡俗武林弟子，二十出头的精壮青年武人，短打劲装束腰、袖口扎紧，马步沉稳、双拳抱式蓄劲，眼神剽悍专注，江湖武人的利落杀气" },
  bt_sanxiu:  { kind: "battler", hq: true, prompt: "落魄散修，三十多岁面色风霜的修士，半旧青灰道袍下摆磨损，束发简陋，单手掐诀、另一手悬着一枚泛土黄色灵光的小石剑法器，眼神警惕桀骜，野路子修士的狠劲" },
  bt_yelang:  { kind: "battler", hq: true, prompt: "野狼帮打手喽啰，横行乡里的凡俗壮年匪徒，乱发束布巾、满脸横肉留短须、眼神蛮横凶悍，身披一件粗硬兽皮坎肩、内着杂乱的深褐色短打缠布绑腿，双手抡起一根钉满铁刺的狰狞狼牙棒作劈砸姿态，山贼帮派打手的粗野凶蛮杀气" },
  // —— 剧情人物战斗立绘（ref=各自半身像：锁脸出全身战斗姿态——参考图编辑保一致性）——
  bt_hanli:   { kind: "battler", hq: true, ref: "portraits/hanli.png",
                prompt: "同一人物的完整全身像：少年韩立全身战斗姿态，侧身而立、一手扬起两指并剑准备御使法器，另一手收于腰侧扣着符纸，眼神冷静专注，橄榄黄绿色交领道袍下摆随气劲微扬，腰悬储物袋，沉稳蓄势" },
  // —— 飞行姿态变体（ref=站姿战斗立绘锁角色一致性）——用户裁决：姿态与站立几乎相同、
  //    不跳不跃不浮夸，只靠"脚尖垂下微错开+衣发轻飘"读出凌空（修仙御风的从容） ——
  // （南宫婉飞姿已弃：v2 与站姿无异+抠图白圈——裙装角色飞姿复用站姿即可，省一张图）
  bt_hanli_fly: { kind: "battler", hq: true, ref: "battlers/bt_hanli.png",
                prompt: "同一人物同一服饰同一姿态的细微变体：少年韩立凌空静悬，身姿与平地站立几乎完全相同——上身保持原样的戒备姿态（一手两指并剑、一手收于腰侧），双脚离地自然下垂、足尖绷直向下，两脚一前一后轻轻交叠靠拢（前脚略低、后脚略抬贴近前脚踝，凌空挺立的利落感），道袍下摆与腰带向后轻轻飘起一角，发梢微扬，从容驭气、克制飘逸，无跳跃无大动作" },
  bt_luyunfeng: { kind: "battler", hq: true, ref: "portraits/luyunfeng.png",
                prompt: "同一人物的完整全身像：陆云风全身战斗姿态，锦缎滚边青袍倨傲而立，单手负后、另一手两指掐剑诀，一柄青芒小剑悬浮于身前，神情阴鸷睥睨，世家子弟的骄横杀意" },
  bt_jinguang: { kind: "battler", hq: true, ref: "portraits/jinguang.png",
                prompt: "同一人物的完整全身像：金光上人全身战斗姿态，矮胖身躯罩在淡金色半透明光罩中，土黄僧袍鼓荡，双掌合十怒目狰狞，周身金光流转，杀手和尚的凶悍" },
  bt_modafu:  { kind: "battler", hq: true, ref: "portraits/modafu.png",
                prompt: "同一人物的完整全身像：墨大夫全身战斗姿态，深褐色金线团纹医袍老者侧身而立，枯瘦的手五指箕张、指间泛着青黑毒气，另一手拢于袖中，眼神阴狠狞笑，佛珠缠腕，毒师的森然" },
  bt_tienu:   { kind: "battler", hq: true, ref: "portraits/tienu.png",
                prompt: "同一人物的完整全身像：尸傀铁奴全身战斗姿态，铁青肤色的少年尸傀僵直前倾站立，双臂垂坠指节泛黑，双目空洞浊白，破败灰色短打，周身淡淡阴气缠绕，悲凉诡异" },
  bt_wanxiaoshan: { kind: "battler", hq: true, ref: "portraits/wanxiaoshan.png",
                prompt: "同一人物的完整全身像：万小山全身战斗姿态，圆脸憨厚的年轻散修紧张地双手搓出一团小火球，半旧靛青色道袍，鼓囊行囊仍背在背上，神情认真又微微发慌，可爱的同道" },
  // 余子童元神：受损残魂出窍夺舍——通体半透明、泛幽冷青白光的修士虚影（魂体非血肉），守红线⑤纯白底好抠
  bt_yuzitong: { kind: "battler", hq: true, guard: true,
                prompt: "结丹修士余子童的元神虚影（受损残魂出窍夺舍）：一道通体半透明、泛着幽冷青白色魂光的清癯中年修士虚影全身像，面容枯槁阴鸷、双目空洞冷光怨毒，残破的深色道袍无风自动，魂体边缘缕缕散逸如青烟、周身缠绕受损残魂的幽光裂纹，双手前伸如攫取之状，凄厉森然，整体呈幽灵般的半透明发光质感而非实体血肉" },
  // —— 战斗场景底图（scenes/bt_*.png）——竞技场构图 v2（踩地感的根：地面是"近景台面"不是远眺）：
  //    底部三分之一必须是延伸到画外的平整近地（纹理为脚边尺度：碎石草茎清晰可辨），
  //    低机位平视微俯、地面横向开阔无遮挡（站位带），中景立物收两翼，远景给层次——人物将直接站在这块地上
  // 舞台盒构图（v90 对照实验，仿觅长生）：两翼近景收口环抱+中央完全开阔+下2/5地面延伸画外+
  // 全图统一色调——"人被环境包住"而不是"人贴在一条中景带前"
  bt_forest: { kind: "bgscene", hq: true, file: "bt_forest", prompt: "游戏横版战斗场景：青幽山谷竹林斗法场，低机位平视，画面底部五分之二是平整开阔的暖色苔土斗法空地（脚边尺度：青苔碎石草茎纹理清晰，横向延伸到画外，中央完全无遮挡），左侧近景一丛翠竹与青灰巨岩自画框边缘探入收口，右侧近景苍翠树石与一角青瓦楼阁自画框边缘收口（两翼如舞台侧幕环抱中央空地，近景物色深而实），远景中央是雾化的青绿山谷与一座古塔剪影渐次隐没于天光薄雾，全图统一青绿主调清幽灵秀，全部景物以成年人身高为比例锚，无人物无生物" },
  bt_road:   { kind: "bgscene", hq: true, file: "bt_road", prompt: "游戏横版战斗场景：荒郊官道遭遇战之地，低机位平视，画面底部五分之二是平整开阔的黄土路面斗法空地（脚边尺度：车辙碎石枯草纹理清晰，横向延伸到画外，中央完全无遮挡），左侧近景一截歪斜的残旧木路牌与枯树自画框边缘探入收口，右侧近景风化断碑与乱石堆自画框边缘收口（两翼如舞台侧幕环抱中央空地，近景物色深而实），远景中央丘陵起伏雾霭弥漫黄昏冷光渐次隐没，全图统一黄昏土黄主调萧索肃杀，全部景物以成年人身高为比例锚，无人物无生物" },
  bt_valley: { kind: "bgscene", hq: true, file: "bt_valley", prompt: "游戏横版战斗场景：灵秀山谷对峙之地，低机位平视，画面底部五分之二是平整开阔的青草坡地斗法场（脚边尺度：草茎裸岩野花纹理清晰，横向延伸到画外，中央完全无遮挡），左侧近景苍翠山壁与枫木自画框边缘探入收口，右侧近景青灰巨岩与灌木自画框边缘收口（两翼如舞台侧幕环抱中央空地，近景物色深而实），远景中央云雾峰峦天光清亮渐次隐没，全图统一青翠主调灵秀开阔，全部景物以成年人身高为比例锚，无人物无生物" },
  bt_night:  { kind: "bgscene", hq: true, file: "bt_night", prompt: "游戏横版战斗场景：月夜伏杀之地，低机位平视，画面底部五分之二是平整开阔的银辉草地斗法场（脚边尺度：月光浸染的草茎黑石纹理清晰，横向延伸到画外，中央完全无遮挡），左侧近景如墨林影枝桠自画框边缘探入收口，右侧近景嶙峋黑岩自画框边缘收口（两翼如舞台侧幕环抱中央空地，近景物色深而实），远景中央冷月高悬薄云掠过林海如墨渐次隐没，全图统一冷蓝月夜主调阴冷杀机，全部景物以成年人身高为比例锚，无人物无生物" },
  // —— 三层分级制（depth-design v88：远景层+中景物件层+近景地台）——觅长生式"人在层间"：
  //    远景=无立物的空旷地面与天际；中景=白底实物条带（抠透明，人物身后独立视差）——
  //    人飞到树前不突兀：树真的在更远的层上、以不同速度退行
  bt_road_far: { kind: "bgscene", hq: true, file: "bt_road_far", prompt: "游戏横版战斗场景远景层：低机位平视微俯的荒郊黄土旷野，画面底部三分之一是延伸到画外的平整黄土地面（车辙碎石枯草纹理清晰、横向完全空旷），地面上没有任何立物没有路牌没有大石（纯空旷地面），远景丘陵起伏雾霭弥漫黄昏冷光，无人物无生物，荒野的萧索底色" },
  bt_road_mid: { kind: "midlayer", hq: true, file: "bt_road_mid", prompt: "荒郊官道中景物件条带：左侧一截一人高的歪斜残旧木路牌（指路牌斜插、木牌斑驳），中部偏右一丛膝高乱石堆与几束枯草，再右侧一座半人高的风化断碑与一个矮树桩（全部实心团块物件，无镂空枝杈），物件之间留出大段空隙（人物将从空隙间与物件前方走过），全部物件以成年人身高为比例锚" },
  // 前景遮挡条带（v90 用户点名：最前面加草石加强景深）——压在全部单位之前的失焦近景；
  // 横向可平铺（两端渐稀），中央大段留空不挡战场视野；分场景配色与底图地面一致
  fg_combat: { kind: "midlayer", hq: true, file: "fg_combat", prompt: "近景草石前景条带：左端一丛茂密的野草叶片向右上方舒展、根部簇拥两块圆润顽石，右端一矮丛芒草与一块青苔卧石，中央大段完全空白（只在最底边缘零星几株小草尖），全部物件贴着画面下边缘生长（草叶石块的剪影感、色彩沉实），物件横向疏密有致、两端渐稀便于平铺拼接，以成年人膝盖以下高度为比例锚" },
  fg_forest: { kind: "midlayer", hq: true, file: "fg_forest", prompt: "近景草石前景条带：左端一丛浓绿茂盛的苔草叶片舒展、根部一块青苔卵石，右端几束浓绿野草与一块灰绿色苔石，中央大段完全空白（只在最底边缘零星两三株浓绿小草尖），全部物件贴着画面下边缘生长，色彩为饱满的深绿与苔绿（山谷草地配色），物件横向疏密有致、两端渐稀便于平铺拼接，以成年人膝盖以下高度为比例锚" },
  fg_road:   { kind: "midlayer", hq: true, file: "fg_road", prompt: "近景枯草石前景条带：左端一丛干枯的土黄色茅草与一块风化粗石，右端几束枯黄芒草与半埋的碎石，中央大段完全空白（只在最底边缘零星两三株枯草尖），全部物件贴着画面下边缘生长，色彩为干燥的土黄与枯褐（荒郊黄土配色），物件横向疏密有致、两端渐稀便于平铺拼接，以成年人膝盖以下高度为比例锚" },
  fg_night:  { kind: "midlayer", hq: true, file: "fg_night", prompt: "近景夜草石前景条带：左端一丛冷蓝色调的暗色草叶剪影与一块月光描边的黑石，右端几束银辉浸染的暗草与一块嶙峋小黑岩，中央大段完全空白（只在最底边缘零星两三株暗草尖），全部物件贴着画面下边缘生长，色彩为冷蓝月夜剪影调（月夜草地配色），物件横向疏密有致、两端渐稀便于平铺拼接，以成年人膝盖以下高度为比例锚" },

  /* —— 血色禁地批（huangfeng-design 第三幕：会议人物+禁地场景+墨蛟）—— */
  nangongwan: { kind: "portrait", hq: true, prompt: "少女南宫婉，约十八九岁，掩月宗天之骄女，乌黑如瀑的长发松挽垂落，眉目清艳绝伦、眼神清冷矜贵中藏锋芒，肤白胜雪，身着月白广袖修士长裙、银线绣月纹，姿容明艳不可方物又拒人千里" },
  lihuayuan: { kind: "portrait", hq: true, prompt: "李化元，黄枫谷首席大长老，须发皆白的清癯老者，白发高束玉冠，长髯垂胸，目光深邃温和而不怒自威，身着月白镶青边的大长老道袍、袖口绣云纹，仙风道骨，结丹大修士的渊渟岳峙" },
  fengyue: { kind: "portrait", hq: true, prompt: "修士封岳，三十岁上下的阴鸷精瘦男修，眉骨高耸眼窝深陷，眼神如毒蛇般冷静狠戾，墨绿色紧身劲装外罩暗纹皮甲，腕缚皮护手，腰间挂着数枚淬黑短刺，狙杀者的阴冷压迫感" },
  zhongwu: { kind: "portrait", prompt: "修士钟吾，四十岁圆滑的胖商修，圆脸细眼总挂着生意人的笑，灰褐道袍外罩缀玉算盘的褡裢，手里捻着一卷地图，精明市侩但守信" },
  hanyunzhi: { kind: "portrait", prompt: "女修菡云芝，二十五六岁的御灵宗女修，温婉沉静，乌发简髻插一支木簪，鹅黄道袍外罩浅褐披帛，怀抱一只药篓，眉眼间有挥之不去的轻愁" },
  bt_mojiao: { kind: "battler", hq: true, prompt: "一头墨蛟妖兽，三四丈长的漆黑蛟龙幼体，蛇形长躯覆满乌黑鳞甲、鳞片泛着冷光，头生双角初成，血红竖瞳，利齿森然，身躯盘起昂首欲扑，周身缠绕浓重的黑色妖雾，凶戾慑人" },
  bt_nangongwan: { kind: "battler", hq: true, ref: "portraits/nangongwan.png", guard: true,
                prompt: "同一人物的完整全身像：南宫婉全身战斗姿态，白衣广袖凌波而立，足尖轻点、裙裾如月华铺展，一手扬袖间一条泛着幽幽月华青辉的淡青色绫带绕身飞舞（绫带为淡青蓝色发光，不是白色），另一手两指竖于唇前掐诀，眉目清艳冷冽，掩月宗天骄居高临下的从容杀意" },
  bt_dujiao: { kind: "battler", hq: true, prompt: "一头独角青鳞妖兽，体型如巨狮的一级妖兽，通体覆盖青色鳞甲，额生一根螺旋独角泛着幽光，四肢粗壮利爪扣地，獠牙外露低吼，肌肉贲张作扑击姿态，周身腾起淡青色妖气，凶悍威猛" },
  xueshi_jindi: { kind: "scene", hq: true, prompt: "血色禁地秘境，赤红色雾气弥漫的诡异山谷，嶙峋赤岩与暗红色藤蔓交错，谷底散落泛着血色微光的奇花异草，远处一汪暗红水潭隐有巨影盘踞，天空被血色屏障笼罩，瑰丽而凶险的上古禁地氛围" },
  // —— 长卷全景（scenes/pano_*.png：探索轴/战斗轴的横移长背景——镜头拉动时背景跟着走）——
  pano_dongku: { kind: "pano", hq: true, file: "pano_dongku", prompt: "血色禁地深潭洞窟的超宽全景横剖长卷：幽深巨大的水蚀洞窟自左向右绵延——左端是狭窄洞口岩道、散落着断口平滑的兽骨，中段沿岸渐次开阔、暗红色潭水铺展、岩壁血藤垂落点缀着泛血色微光的灵草与岩缝晶石，右端深处潭心最阔、黑雾隐隐巨影盘踞，岩顶倒悬钟乳石、暗红水光在岩壁上流转如倒悬之河，下沿是连续平整的潭岸岩台，阴森瑰丽的妖窟氛围" },
  pano_xueshi: { kind: "pano", hq: true, file: "pano_xueshi", prompt: "血色禁地野外的超宽全景：单一连续镜头拍摄的一片完整谷地（绝对不是多联画、无任何竖向分割线或画框，地平线与天空自左至右完全连贯），赤红雾气笼罩——左侧嶙峋赤岩隘口，中部开阔赤色草甸与泛血光的奇花药圃、暗红藤蔓缠绕枯木，右侧血雾渐浓隐约可见水潭轮廓，天空被血色屏障封顶，下沿是连续平整的赤土地面，瑰丽凶险的上古禁地氛围" },
  dihuo_wu: { kind: "scene", prompt: "仙门地火之屋内景，开凿于山岩内的炼丹石室，中央一座青铜丹炉架在地火裂隙之上、炉下赤红地火翻腾，四壁刻满导火纹路微微发亮，架上摆着玉瓶药匣，热浪与丹香蒸腾，幽暗中一片炉火通明" },
  cg_mojiao: { kind: "cg", hq: true, file: "cg_mojiao", prompt: "血色禁地深处的生死并肩之战：赤红雾气弥漫的水潭边，漆黑蛟龙妖兽自潭中暴起、黑雾翻涌血瞳凶戾，潭岸上白衣女修与青衫少年背靠背而立——女修广袖扬起月华流转，少年扬手掷出金色符宝，符光划破血雾，二人衣袂翻飞，殊死合击的电影级瞬间" },
};
Object.assign(DEFS, BATTLE_DEFS);

const STYLES = {
  portrait: STYLE_PORTRAIT,
  scene: STYLE_SCENE, scene_p: STYLE_SCENE_P,
  cg: STYLE_CG, cg_p: STYLE_CG_P,
  map: STYLE_SCENE,
  battler: STYLE_BATTLER,
  bgscene: STYLE_BATTLE_SCENE,
  midlayer: STYLE_MIDLAYER,
  pano: STYLE_PANO,
};
// kind → 输出子目录（assets 分类重构 2026-06-11）
const SUBDIR = {
  portrait: "portraits",
  scene: "scenes", scene_p: "scenes",
  cg: "cg", cg_p: "cg",
  map: "maps",
  battler: "battlers",
  bgscene: "scenes",
  midlayer: "scenes",
  pano: "scenes",
};

function genOne(id, def, opts = {}) {
  const style = STYLES[def.kind] || STYLE_SCENE;
  // 参考图编辑（角色一致性变体）：把底图喂进去，prompt 只描述"变什么"
  const content = [];
  if (def.ref && !opts.noRef) {
    const refFile = path.join(OUT, def.ref);
    if (fs.existsSync(refFile)) {
      const refB64 = fs.readFileSync(refFile).toString("base64");
      content.push({ type: "image_url", image_url: { url: `data:image/png;base64,${refB64}` } });
      content.push({ type: "text", text: `以参考图中的形象为底（保持同一画风、同一体态结构与渲染质感），生成变体：${def.prompt}。${style}。` });
    }
  }
  if (!content.length) content.push({ type: "text", text: `${style}。画面内容：${def.prompt}。` });
  const model = (def.hq && !opts.fallback) ? MODEL_HQ : MODEL;
  const body = JSON.stringify({
    model,
    modalities: ["image", "text"],
    messages: [{ role: "user", content }],
  });
  const bodyFile = path.join(TMP, "_genart.body.json");
  const respFile = path.join(TMP, "_genart.resp.json");
  fs.writeFileSync(bodyFile, body);
  // 用 curl.exe 出图（本机走代理；无代理环境 GEN_PROXY="" 直连）
  execFileSync("curl.exe", [
    "-s",
    ...(USE_PROXY ? ["-x", PROXY] : []),
    "-X", "POST", "https://openrouter.ai/api/v1/chat/completions",
    "-H", "Authorization: Bearer " + KEY,
    "-H", "Content-Type: application/json",
    "-H", "X-Title: FanrenXiuxian",
    "--data", "@" + bodyFile,
    "-o", respFile,
    "--max-time", "180",
  ], { stdio: "ignore" });
  const j = JSON.parse(fs.readFileSync(respFile, "utf8"));
  if (j.error) {
    // 高质量模型不可用（id 变动/限流）→ 自动降级 flash-image 重试一次
    if (def.hq && !opts.fallback) {
      console.log(`  [${id}] HQ 模型失败，降级 flash 重试: ` + JSON.stringify(j.error).slice(0, 120));
      return genOne(id, def, Object.assign({}, opts, { fallback: true }));
    }
    throw new Error(JSON.stringify(j.error));
  }
  const m = j.choices && j.choices[0] && j.choices[0].message;
  const url = m && m.images && m.images[0] && m.images[0].image_url && m.images[0].image_url.url;
  if (!url) {
    if (def.hq && !opts.fallback) {
      console.log(`  [${id}] HQ 无图返回，降级 flash 重试`);
      return genOne(id, def, Object.assign({}, opts, { fallback: true }));
    }
    throw new Error("无图片返回: " + JSON.stringify(j).slice(0, 200));
  }
  const b64 = url.split(",")[1];
  const dir = path.join(OUT, SUBDIR[def.kind] || "");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const outFile = path.join(dir, (def.file || id) + ".png");
  fs.writeFileSync(outFile, Buffer.from(b64, "base64"));
  try { fs.unlinkSync(bodyFile); fs.unlinkSync(respFile); } catch (e) {}
  return outFile;
}

// 生成后自动后处理：立绘/战斗立绘抠透明底；场景/CG 裁影院黑边（竖版同样强裁左右黑条）。
// 上游偶发回 JPEG 字节（扩展名仍 .png）——先转真 PNG 再抠（jpg2png.ps1，.NET 自带解码）
function ensurePng(file) {
  const buf = fs.readFileSync(file);
  if (buf.readUInt32BE(0) === 0x89504e47) return;
  console.log("  非 PNG 字节，自动转码…");
  execFileSync("powershell", ["-ExecutionPolicy", "Bypass", "-File", path.join(__dirname, "jpg2png.ps1"), "-Path", file], { stdio: "inherit" });
}
function postProcess(file, def) {
  try {
    if (def.kind === "portrait" || def.kind === "battler" || def.kind === "midlayer") {
      ensurePng(file);
      const cutArgs = [path.join(__dirname, "cutout.js"), file, file];
      if (def.guard) cutArgs.push("--guard");   // 白衣/浅色主体：中央保护区防洪泛误吞
      execFileSync("node", cutArgs, { stdio: "inherit" });
    } else if (def.kind !== "map") {
      ensurePng(file);
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
