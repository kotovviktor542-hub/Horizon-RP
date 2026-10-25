// Полная база данных игрового контента: Horizon — Пепел Рубежа

export const WORLD_CONFIG = {
  width: 4800,
  height: 4800,
  tileSize: 64,
  chunkSize: 512,
  spawnX: 2400,
  spawnY: 2420
};

export const RARITIES = {
  common:    { name: 'Обычный',     color: '#94a3b8', bg: 'rgba(148,163,184,0.16)' },
  uncommon:  { name: 'Необычный',   color: '#34d399', bg: 'rgba(52,211,153,0.16)' },
  rare:      { name: 'Редкий',      color: '#38bdf8', bg: 'rgba(56,189,248,0.18)' },
  epic:      { name: 'Эпический',   color: '#c084fc', bg: 'rgba(192,132,252,0.18)' },
  legendary: { name: 'Легендарный', color: '#fbbf24', bg: 'rgba(251,191,36,0.20)' },
  mythic:    { name: 'Мифический',  color: '#fb7185', bg: 'rgba(251,113,133,0.22)' }
};

export const BIOMES = {
  meadow: {
    id: 'meadow',
    name: 'Изумрудная Пустошь',
    subtitle: 'Уровень 1–3 · Безопасный лагерь и леса',
    minLevel: 1,
    groundBase: '#1d3324',
    groundAlt: '#243e2c',
    accent: '#4ade80',
    ambientParticle: 'firefly',
    enemies: ['slime', 'wolf', 'goblin']
  },
  ruins: {
    id: 'ruins',
    name: 'Багровые Руины',
    subtitle: 'Уровень 3–6 · Древний храм и ловушки',
    minLevel: 3,
    groundBase: '#33221f',
    groundAlt: '#3f2925',
    accent: '#f87171',
    ambientParticle: 'ember',
    enemies: ['skeleton', 'archer', 'knight']
  },
  mire: {
    id: 'mire',
    name: 'Ядовитые Топи',
    subtitle: 'Уровень 5–8 · Кислотные болота и споры',
    minLevel: 5,
    groundBase: '#182b29',
    groundAlt: '#1f3633',
    accent: '#a3e635',
    ambientParticle: 'spore',
    enemies: ['spitter', 'toad', 'stalker']
  },
  frost: {
    id: 'frost',
    name: 'Морозный Пик',
    subtitle: 'Уровень 7–10 · Вечная мерзлота и кристаллы',
    minLevel: 7,
    groundBase: '#1e2c3a',
    groundAlt: '#263849',
    accent: '#38bdf8',
    ambientParticle: 'snow',
    enemies: ['ice_wolf', 'frost_mage', 'golem']
  },
  rift: {
    id: 'rift',
    name: 'Разлом Горизонта',
    subtitle: 'Уровень 10+ · Обсидиановая цитадель Бездны',
    minLevel: 10,
    groundBase: '#1d1526',
    groundAlt: '#281b35',
    accent: '#c084fc',
    ambientParticle: 'void',
    enemies: ['cultist', 'demon', 'knight']
  }
};

export const CAMPFIRES = [
  { id: 'camp_haven', name: 'Лагерь Рубежа',      x: 2400, y: 2350, biome: 'meadow', unlockedByDefault: true },
  { id: 'camp_ruins', name: 'Врата Руин',         x: 3320, y: 2360, biome: 'ruins',  unlockedByDefault: false },
  { id: 'camp_mire',  name: 'Опушка Топей',       x: 1460, y: 1460, biome: 'mire',   unlockedByDefault: false },
  { id: 'camp_frost', name: 'Привал у Пика',      x: 3050, y: 1080, biome: 'frost',  unlockedByDefault: false },
  { id: 'camp_rift',  name: 'Край Разлома',       x: 3360, y: 3520, biome: 'rift',   unlockedByDefault: false }
];

export const NPCS = [
  {
    id: 'lyra',
    name: 'Хранительница Лира',
    role: 'Наставница Рубежа',
    x: 2305,
    y: 2300,
    color: '#38bdf8',
    action: 'quest_heal',
    greeting: 'Разлом на юго-востоке пожирает мир. Укрепляй дух, ищи тайные святилища и сокруши четырёх Стражей, чтобы закрыть Бездну! Я исцелила твои раны.'
  },
  {
    id: 'thorn',
    name: 'Кузнец Торн',
    role: 'Мастер оружия и ремесла',
    x: 2505,
    y: 2300,
    color: '#fb923c',
    action: 'open_craft',
    greeting: 'Приноси железную руду, мифрил и кристаллы Разлома! В моей кузне можно выковать мощное снаряжение и заточить оружие до +10.'
  },
  {
    id: 'raven',
    name: 'Следопыт Ворон',
    role: 'Охотник за головами и секретами',
    x: 2475,
    y: 2495,
    color: '#a78bfa',
    action: 'bounty_hint',
    greeting: 'В мире спрятаны 4 тайника: за треснувшей руной на северо-востоке Руин, на Острове Светлячков на юго-западе (прыгай по камням!), у Монолита на севере и в глубине Топей!'
  }
];

export const SECRETS = [
  {
    id: 'secret_crypt',
    name: 'Забытый Склеп Руин',
    hint: 'Разбей треснувшую рунную стену на северо-востоке Багровых Руин',
    x: 4340,
    y: 1620,
    biome: 'ruins',
    rewardItems: [{ type: 'relic', id: 'relic_vampire' }, { type: 'gold', amount: 280 }],
    bonusHp: 10
  },
  {
    id: 'secret_island',
    name: 'Остров Светлячков',
    hint: 'Перепрыгни по каменным плитам через озеро на юго-западе Пустоши',
    x: 920,
    y: 3960,
    biome: 'meadow',
    rewardItems: [{ type: 'weapon', id: 'bow_storm' }, { type: 'gold', amount: 200 }],
    bonusHp: 20
  },
  {
    id: 'secret_monolith',
    name: 'Монолит Предтеч',
    hint: 'Зажги 3 древние жаровни вокруг Монолита на севере Морозного Пика',
    x: 2450,
    y: 560,
    biome: 'frost',
    braziers: [
      { id: 'br_1', x: 2330, y: 610 },
      { id: 'br_2', x: 2570, y: 610 },
      { id: 'br_3', x: 2450, y: 450 }
    ],
    rewardItems: [{ type: 'weapon', id: 'scythe_horizon' }, { type: 'gold', amount: 500 }],
    bonusHp: 25
  },
  {
    id: 'secret_alchemist',
    name: 'Тайник Алхимика',
    hint: 'Отыщи скрытую поляну на западе Ядовитых Топей',
    x: 520,
    y: 1660,
    biome: 'mire',
    rewardItems: [{ type: 'relic', id: 'relic_phoenix' }, { type: 'consumable', id: 'potion_greater', count: 4 }],
    bonusHp: 15
  }
];

export const RESOURCES = {
  wood:    { id: 'wood',    name: 'Древняя древесина', rarity: 'common',   icon: '🪵', color: '#d97706', desc: 'Прочное дерево для луков, рукоятей и костров.' },
  herb:    { id: 'herb',    name: 'Алая трава',        rarity: 'common',   icon: '🌿', color: '#ef4444', desc: 'Целебное растение для варки зелий.' },
  meat:    { id: 'meat',    name: 'Свежая дичь',       rarity: 'common',   icon: '🥩', color: '#f97316', desc: 'Питательное мясо для приготовления жаркого.' },
  iron:    { id: 'iron',    name: 'Железная руда',     rarity: 'uncommon', icon: '⛏️', color: '#94a3b8', desc: 'Основа для ковки клинков и заточки оружия.' },
  soul:    { id: 'soul',    name: 'Эссенция душ',      rarity: 'rare',     icon: '🔮', color: '#a855f7', desc: 'Магическая энергия поверженных врагов для прокачки умений.' },
  mithril: { id: 'mithril', name: 'Мифриловая руда',   rarity: 'rare',     icon: '💎', color: '#38bdf8', desc: 'Редкий металл из Топей и Морозного Пика.' },
  crystal: { id: 'crystal', name: 'Кристалл Разлома',  rarity: 'epic',     icon: '✨', color: '#ec4899', desc: 'Чистая мощь Бездны для легендарного снаряжения.' }
};

export const CONSUMABLES = {
  potion_hp: {
    id: 'potion_hp',
    name: 'Зелье исцеления',
    rarity: 'common',
    icon: '🧪',
    healPct: 0.45,
    satiety: 5,
    cooldown: 4.5,
    buyPrice: 35,
    desc: 'Мгновенно восстанавливает 45% макс. здоровья.'
  },
  ration_roast: {
    id: 'ration_roast',
    name: 'Жаркое странника',
    rarity: 'uncommon',
    icon: '🍖',
    healPct: 0.25,
    satiety: 65,
    regenBuff: 20,
    cooldown: 4.5,
    buyPrice: 45,
    desc: '+65 сытости, +25% HP и регенерация здоровья на 20 сек.'
  },
  elixir_power: {
    id: 'elixir_power',
    name: 'Эликсир Ярости',
    rarity: 'rare',
    icon: '⚡',
    healPct: 0.15,
    satiety: 15,
    rageBuff: 30,
    cooldown: 6.0,
    buyPrice: 90,
    desc: '+30% к урону и +20% к скорости бега на 30 сек.'
  },
  potion_greater: {
    id: 'potion_greater',
    name: 'Великий Эликсир',
    rarity: 'epic',
    icon: '🏺',
    healPct: 0.85,
    satiety: 45,
    regenBuff: 25,
    cooldown: 5.0,
    buyPrice: 130,
    desc: 'Восстанавливает 85% HP, +45 сытости и мощную регенерацию.'
  }
};

export const WEAPONS = {
  sword_iron: {
    id: 'sword_iron',
    name: 'Клинок Странника',
    rarity: 'common',
    icon: '⚔️',
    style: 'sword',
    baseDamage: 18,
    cooldown: 0.34,
    range: 74,
    arc: 1.85,
    critBonus: 0.05,
    knockback: 180,
    color: '#e2e8f0',
    trailColor: '#38bdf8',
    desc: 'Надёжный полуторный меч. Быстрая серия из 3 широких ударов.'
  },
  daggers_shadow: {
    id: 'daggers_shadow',
    name: 'Парные Кинжалы Тени',
    rarity: 'uncommon',
    icon: '🗡️',
    style: 'daggers',
    baseDamage: 14,
    cooldown: 0.20,
    range: 62,
    arc: 1.45,
    critBonus: 0.22,
    knockback: 95,
    color: '#a78bfa',
    trailColor: '#c084fc',
    desc: 'Молниеносные выпады с повышенным на 22% шансом крита.'
  },
  bow_storm: {
    id: 'bow_storm',
    name: 'Лук Штормового Ветра',
    rarity: 'rare',
    icon: '🏹',
    style: 'bow',
    baseDamage: 22,
    cooldown: 0.36,
    range: 340,
    projectileSpeed: 640,
    critBonus: 0.14,
    knockback: 130,
    color: '#38bdf8',
    trailColor: '#7dd3fc',
    desc: 'Стреляет пробивающими стрелами ветра. Каждый 3-й выстрел — веер из 3 стрел!'
  },
  hammer_titan: {
    id: 'hammer_titan',
    name: 'Боевой Молот Титана',
    rarity: 'rare',
    icon: '🔨',
    style: 'hammer',
    baseDamage: 36,
    cooldown: 0.56,
    range: 88,
    arc: 2.5,
    critBonus: 0.08,
    knockback: 320,
    color: '#fb923c',
    trailColor: '#f97316',
    desc: 'Сокрушительные удары по площади, отбрасывающие и оглушающие врагов.'
  },
  staff_starfire: {
    id: 'staff_starfire',
    name: 'Посох Звёздного Пламени',
    rarity: 'epic',
    icon: '🪄',
    style: 'staff',
    baseDamage: 30,
    cooldown: 0.40,
    range: 360,
    projectileSpeed: 520,
    critBonus: 0.15,
    knockback: 160,
    color: '#f472b6',
    trailColor: '#fb7185',
    desc: 'Выпускает самонаводящиеся сферы звёздного огня с взрывным уроном!'
  },
  scythe_horizon: {
    id: 'scythe_horizon',
    name: 'Коса Горизонта',
    rarity: 'legendary',
    icon: '🌙',
    style: 'scythe',
    baseDamage: 44,
    cooldown: 0.38,
    range: 96,
    arc: 2.75,
    critBonus: 0.18,
    lifesteal: 0.08,
    knockback: 230,
    color: '#fbbf24',
    trailColor: '#c084fc',
    desc: 'Легендарное оружие Предтеч. Запускает серп эфира и похищает 8% здоровья.'
  }
};

export const ARMORS = {
  armor_tunic: {
    id: 'armor_tunic',
    name: 'Походная куртка',
    rarity: 'common',
    icon: '🥋',
    hpBonus: 20,
    defense: 3,
    speedBonus: 0.03,
    desc: 'Лёгкая кожаная защита странника Рубежа.'
  },
  armor_ranger: {
    id: 'armor_ranger',
    name: 'Кольчуга Следопыта',
    rarity: 'uncommon',
    icon: '🛡️',
    hpBonus: 55,
    defense: 8,
    speedBonus: 0.06,
    desc: 'Укреплённая кольчуга, не сковывающая движений.'
  },
  armor_crimson: {
    id: 'armor_crimson',
    name: 'Латы Багрового Ордена',
    rarity: 'rare',
    icon: '⚜️',
    hpBonus: 105,
    defense: 15,
    speedBonus: 0.04,
    desc: 'Древний доспех храмовников, закалённый в пепле.'
  },
  armor_frost: {
    id: 'armor_frost',
    name: 'Мифриловый Панцирь Пика',
    rarity: 'epic',
    icon: '❄️',
    hpBonus: 165,
    defense: 24,
    speedBonus: 0.08,
    desc: 'Сияющая мифриловая броня, отражающая тяжелейшие удары.'
  },
  armor_horizon: {
    id: 'armor_horizon',
    name: 'Доспех Владыки Горизонта',
    rarity: 'legendary',
    icon: '👑',
    hpBonus: 250,
    defense: 35,
    speedBonus: 0.12,
    desc: 'Абсолютная защита из кристаллов Разлома и звёздной стали.'
  }
};

export const RELICS = {
  relic_boots: {
    id: 'relic_boots',
    name: 'Сапоги Ветра',
    rarity: 'uncommon',
    icon: '🥾',
    stats: { speedPct: 0.14, staminaRegen: 8 },
    desc: '+14% к скорости передвижения и ускоренное восстановление выносливости.'
  },
  relic_fang: {
    id: 'relic_fang',
    name: 'Амулет Волчьей Ярости',
    rarity: 'uncommon',
    icon: '🐺',
    stats: { critChance: 0.10, atkPct: 0.08 },
    desc: '+10% шанс крита и +8% к силе атаки.'
  },
  relic_magnet: {
    id: 'relic_magnet',
    name: 'Кольцо Искателя',
    rarity: 'rare',
    icon: '💍',
    stats: { magnetBonus: 90, goldPct: 0.25 },
    desc: 'Притягивает добычу издалека и увеличивает находимое золото на 25%.'
  },
  relic_vampire: {
    id: 'relic_vampire',
    name: 'Клык Древнего Вампира',
    rarity: 'epic',
    icon: '🩸',
    stats: { lifesteal: 0.07, atkPct: 0.10 },
    desc: 'Восстанавливает 7% от нанесённого урона и даёт +10% к атаке.'
  },
  relic_storm: {
    id: 'relic_storm',
    name: 'Сердце Бури',
    rarity: 'rare',
    icon: '🌩️',
    stats: { cdrPct: 0.20, skillPct: 0.18 },
    desc: 'Ускоряет перезарядку способностей на 20% и усиливает их урон на 18%.'
  },
  relic_carapace: {
    id: 'relic_carapace',
    name: 'Панцирь Королевы Роя',
    rarity: 'epic',
    icon: '🪲',
    stats: { maxHp: 90, defense: 10 },
    desc: 'Трофей Ксиллы: +90 к здоровью и +10 к защите.'
  },
  relic_phoenix: {
    id: 'relic_phoenix',
    name: 'Перо Феникса',
    rarity: 'legendary',
    icon: '🔥',
    stats: { phoenixRevive: true, hpRegen: 2.5 },
    desc: 'Воскрешает при смертельном ударе (раз в 90 сек) и регенерирует 2.5 HP/сек.'
  },
  relic_frostheart: {
    id: 'relic_frostheart',
    name: 'Ядро Вечного Льда',
    rarity: 'legendary',
    icon: '💠',
    stats: { atkPct: 0.18, skillPct: 0.22, maxHp: 75 },
    desc: 'Трофей Валькора: +18% урона оружием, +22% силы умений и +75 HP.'
  }
};

export const SKILLS = {
  whirlwind: {
    id: 'whirlwind',
    slot: 1,
    keyLabel: '1',
    name: 'Вихрь Пламени',
    icon: '🔥',
    color: '#f97316',
    baseCooldown: 6.5,
    staminaCost: 22,
    baseDamageMult: 1.9,
    radius: 112,
    unlockLevel: 1,
    desc: 'Круговой удар огненным клинком вокруг героя, отбрасывающий и поджигающий врагов.'
  },
  thunder_slam: {
    id: 'thunder_slam',
    slot: 2,
    keyLabel: '2',
    name: 'Громовой Прыжок',
    icon: '⚡',
    color: '#38bdf8',
    baseCooldown: 9.0,
    staminaCost: 28,
    baseDamageMult: 2.5,
    radius: 135,
    unlockLevel: 2,
    desc: 'Мощный прыжок вверх с сокрушительным приземлением молнии, оглушающим врагов на 1.8 сек.'
  },
  aegis_pulse: {
    id: 'aegis_pulse',
    slot: 3,
    keyLabel: '3',
    name: 'Эфирный Бастион',
    icon: '🛡️',
    color: '#c084fc',
    baseCooldown: 14.0,
    staminaCost: 25,
    baseDamageMult: 0.85,
    duration: 8.0,
    unlockLevel: 3,
    desc: 'Исцеляет 22% HP, снижает входящий урон на 40% и призывает 3 вращающихся эфирных клинка.'
  }
};

export const RECIPES = [
  // Расходники
  {
    id: 'craft_potion_hp',
    category: 'consumable',
    resultType: 'consumable',
    resultId: 'potion_hp',
    resultCount: 2,
    costGold: 10,
    ingredients: { herb: 2 },
    desc: 'Сварить 2 целебных зелья из алой травы.'
  },
  {
    id: 'craft_roast',
    category: 'consumable',
    resultType: 'consumable',
    resultId: 'ration_roast',
    resultCount: 2,
    costGold: 10,
    ingredients: { meat: 2, wood: 1 },
    desc: 'Приготовить 2 сытных жарких с регенерацией.'
  },
  {
    id: 'craft_elixir_power',
    category: 'consumable',
    resultType: 'consumable',
    resultId: 'elixir_power',
    resultCount: 1,
    costGold: 25,
    ingredients: { herb: 2, soul: 2 },
    desc: 'Алхимический эликсир боевой ярости.'
  },
  {
    id: 'craft_potion_greater',
    category: 'consumable',
    resultType: 'consumable',
    resultId: 'potion_greater',
    resultCount: 2,
    costGold: 40,
    ingredients: { herb: 3, meat: 1, soul: 2 },
    desc: 'Мощнейшее восстановление здоровья и тонуса.'
  },
  // Оружие
  {
    id: 'craft_daggers',
    category: 'weapon',
    resultType: 'weapon',
    resultId: 'daggers_shadow',
    costGold: 80,
    ingredients: { iron: 4, wood: 3 },
    desc: 'Выковать быстрые парные кинжалы с высоким критом.'
  },
  {
    id: 'craft_bow',
    category: 'weapon',
    resultType: 'weapon',
    resultId: 'bow_storm',
    costGold: 140,
    ingredients: { wood: 7, iron: 4, soul: 3 },
    desc: 'Создать дальнобойный Лук Штормового Ветра.'
  },
  {
    id: 'craft_hammer',
    category: 'weapon',
    resultType: 'weapon',
    resultId: 'hammer_titan',
    costGold: 190,
    ingredients: { iron: 8, mithril: 3, wood: 4 },
    desc: 'Выковать тяжёлый Боевой Молот Титана.'
  },
  {
    id: 'craft_staff',
    category: 'weapon',
    resultType: 'weapon',
    resultId: 'staff_starfire',
    costGold: 320,
    ingredients: { mithril: 6, soul: 8, crystal: 2 },
    desc: 'Сотворить магический Посох Звёздного Пламени.'
  },
  // Броня и реликвии
  {
    id: 'craft_armor_ranger',
    category: 'armor',
    resultType: 'armor',
    resultId: 'armor_ranger',
    costGold: 95,
    ingredients: { iron: 5, wood: 3 },
    desc: 'Собрать прочную Кольчугу Следопыта.'
  },
  {
    id: 'craft_armor_crimson',
    category: 'armor',
    resultType: 'armor',
    resultId: 'armor_crimson',
    costGold: 210,
    ingredients: { iron: 8, mithril: 4, soul: 4 },
    desc: 'Выковать Латы Багрового Ордена.'
  },
  {
    id: 'craft_armor_frost',
    category: 'armor',
    resultType: 'armor',
    resultId: 'armor_frost',
    costGold: 360,
    ingredients: { mithril: 9, crystal: 3, soul: 6 },
    desc: 'Выковать Мифриловый Панцирь Пика.'
  },
  {
    id: 'craft_armor_horizon',
    category: 'armor',
    resultType: 'armor',
    resultId: 'armor_horizon',
    costGold: 600,
    ingredients: { crystal: 8, mithril: 8, soul: 12 },
    desc: 'Выковать легендарный Доспех Владыки Горизонта.'
  },
  {
    id: 'craft_relic_boots',
    category: 'relic',
    resultType: 'relic',
    resultId: 'relic_boots',
    costGold: 90,
    ingredients: { wood: 3, herb: 3, soul: 2 },
    desc: 'Зачаровать Сапоги Ветра для быстрой ходьбы.'
  },
  {
    id: 'craft_relic_magnet',
    category: 'relic',
    resultType: 'relic',
    resultId: 'relic_magnet',
    costGold: 150,
    ingredients: { iron: 5, mithril: 2, soul: 3 },
    desc: 'Выковать Кольцо Искателя сокровищ.'
  },
  {
    id: 'craft_relic_storm',
    category: 'relic',
    resultType: 'relic',
    resultId: 'relic_storm',
    costGold: 220,
    ingredients: { mithril: 4, crystal: 2, soul: 6 },
    desc: 'Сконцентрировать энергию в Сердце Бури.'
  }
];

export const ENEMIES = {
  slime: {
    id: 'slime', name: 'Лесной слизень', biome: 'meadow',
    hp: 46, damage: 8, speed: 108, radius: 16, xp: 16, gold: [4, 9],
    behavior: 'melee_hop', color: '#4ade80', eyeColor: '#052e16',
    drops: [{ type: 'resource', id: 'herb', chance: 0.38 }, { type: 'resource', id: 'soul', chance: 0.18 }]
  },
  wolf: {
    id: 'wolf', name: 'Дикий волк', biome: 'meadow',
    hp: 65, damage: 12, speed: 165, radius: 18, xp: 24, gold: [6, 13],
    behavior: 'dasher', color: '#94a3b8', eyeColor: '#facc15',
    drops: [{ type: 'resource', id: 'meat', chance: 0.55 }, { type: 'relic', id: 'relic_fang', chance: 0.04 }]
  },
  goblin: {
    id: 'goblin', name: 'Гоблин-налётчик', biome: 'meadow',
    hp: 78, damage: 14, speed: 140, radius: 17, xp: 28, gold: [9, 18],
    behavior: 'melee', color: '#84cc16', eyeColor: '#ef4444',
    drops: [{ type: 'resource', id: 'iron', chance: 0.30 }, { type: 'consumable', id: 'potion_hp', chance: 0.14 }]
  },
  skeleton: {
    id: 'skeleton', name: 'Проклятый скелет', biome: 'ruins',
    hp: 115, damage: 19, speed: 132, radius: 18, xp: 40, gold: [12, 24],
    behavior: 'melee', color: '#e2e8f0', eyeColor: '#f87171',
    drops: [{ type: 'resource', id: 'iron', chance: 0.36 }, { type: 'resource', id: 'soul', chance: 0.34 }]
  },
  archer: {
    id: 'archer', name: 'Багровый стрелок', biome: 'ruins',
    hp: 95, damage: 21, speed: 122, radius: 17, xp: 45, gold: [14, 26],
    behavior: 'ranged', projColor: '#fb7185', projSpeed: 360, attackRange: 290, color: '#dc2626', eyeColor: '#fef08a',
    drops: [{ type: 'resource', id: 'wood', chance: 0.40 }, { type: 'resource', id: 'soul', chance: 0.32 }]
  },
  knight: {
    id: 'knight', name: 'Падший рыцарь', biome: 'ruins',
    hp: 195, damage: 28, speed: 112, radius: 22, xp: 68, gold: [22, 38],
    behavior: 'heavy', color: '#7f1d1d', eyeColor: '#fb923c',
    drops: [{ type: 'resource', id: 'iron', chance: 0.50 }, { type: 'resource', id: 'mithril', chance: 0.22 }]
  },
  spitter: {
    id: 'spitter', name: 'Болотный плевун', biome: 'mire',
    hp: 155, damage: 25, speed: 118, radius: 19, xp: 58, gold: [18, 34],
    behavior: 'ranged_acid', projColor: '#a3e635', projSpeed: 330, attackRange: 280, color: '#65a30d', eyeColor: '#fde047',
    drops: [{ type: 'resource', id: 'herb', chance: 0.48 }, { type: 'resource', id: 'mithril', chance: 0.28 }]
  },
  toad: {
    id: 'toad', name: 'Ядовитая жаба', biome: 'mire',
    hp: 210, damage: 30, speed: 126, radius: 23, xp: 66, gold: [20, 36],
    behavior: 'jumper', color: '#15803d', eyeColor: '#bef264',
    drops: [{ type: 'resource', id: 'meat', chance: 0.50 }, { type: 'resource', id: 'soul', chance: 0.42 }]
  },
  stalker: {
    id: 'stalker', name: 'Теневой ловчий', biome: 'mire',
    hp: 170, damage: 33, speed: 175, radius: 18, xp: 74, gold: [24, 42],
    behavior: 'blinker', color: '#4c1d95', eyeColor: '#34d399',
    drops: [{ type: 'resource', id: 'mithril', chance: 0.35 }, { type: 'resource', id: 'soul', chance: 0.48 }]
  },
  ice_wolf: {
    id: 'ice_wolf', name: 'Морозный лютоволк', biome: 'frost',
    hp: 230, damage: 35, speed: 182, radius: 20, xp: 85, gold: [28, 48],
    behavior: 'dasher', color: '#7dd3fc', eyeColor: '#0284c7',
    drops: [{ type: 'resource', id: 'meat', chance: 0.52 }, { type: 'resource', id: 'mithril', chance: 0.38 }]
  },
  frost_mage: {
    id: 'frost_mage', name: 'Ледяной жрец', biome: 'frost',
    hp: 205, damage: 38, speed: 124, radius: 19, xp: 94, gold: [32, 54],
    behavior: 'ranged_spread', projColor: '#38bdf8', projSpeed: 370, attackRange: 310, color: '#0369a1', eyeColor: '#e0f2fe',
    drops: [{ type: 'resource', id: 'mithril', chance: 0.42 }, { type: 'resource', id: 'crystal', chance: 0.24 }]
  },
  golem: {
    id: 'golem', name: 'Кристальный голем', biome: 'frost',
    hp: 360, damage: 46, speed: 98, radius: 26, xp: 125, gold: [40, 68],
    behavior: 'heavy_slam', color: '#0ea5e9', eyeColor: '#f0f9ff',
    drops: [{ type: 'resource', id: 'mithril', chance: 0.65 }, { type: 'resource', id: 'crystal', chance: 0.35 }]
  },
  cultist: {
    id: 'cultist', name: 'Адепт Разлома', biome: 'rift',
    hp: 290, damage: 45, speed: 138, radius: 19, xp: 130, gold: [42, 72],
    behavior: 'ranged_spread', projColor: '#e879f9', projSpeed: 400, attackRange: 320, color: '#7e22ce', eyeColor: '#f472b6',
    drops: [{ type: 'resource', id: 'soul', chance: 0.65 }, { type: 'resource', id: 'crystal', chance: 0.42 }]
  },
  demon: {
    id: 'demon', name: 'Демон Бездны', biome: 'rift',
    hp: 430, damage: 56, speed: 162, radius: 25, xp: 165, gold: [55, 92],
    behavior: 'dasher', color: '#be123c', eyeColor: '#fde047',
    drops: [{ type: 'resource', id: 'crystal', chance: 0.55 }, { type: 'consumable', id: 'potion_greater', chance: 0.22 }]
  }
};

export const BOSSES = {
  morgrath: {
    id: 'morgrath',
    name: 'Морграт, Страж Пепла',
    title: 'Владыка Багровых Руин',
    biome: 'ruins',
    x: 4150,
    y: 2350,
    arenaRadius: 340,
    hp: 1350,
    damage: 34,
    speed: 132,
    radius: 34,
    xp: 420,
    gold: 320,
    color: '#ef4444',
    accent: '#fbbf24',
    rewardWeapon: 'hammer_titan',
    rewardResource: { iron: 8, soul: 6, mithril: 3 },
    desc: 'Древний рыцарь-колосс. Совершает огненные рывки и пускает взрывные кольца по земле (перепрыгивай их!).'
  },
  xylla: {
    id: 'xylla',
    name: 'Ксилла, Королева Роя',
    title: 'Хозяйка Ядовитых Топей',
    biome: 'mire',
    x: 820,
    y: 820,
    arenaRadius: 350,
    hp: 2250,
    damage: 42,
    speed: 145,
    radius: 36,
    xp: 680,
    gold: 480,
    color: '#84cc16',
    accent: '#c084fc',
    rewardRelic: 'relic_carapace',
    rewardResource: { mithril: 7, soul: 10, herb: 8 },
    desc: 'Гигантская хищница Топей. Плюётся веером кислоты, прыгает сверху и призывает рой миньонов.'
  },
  valkor: {
    id: 'valkor',
    name: 'Валькор, Ледяной Колосс',
    title: 'Титан Морозного Пика',
    biome: 'frost',
    x: 3960,
    y: 720,
    arenaRadius: 360,
    hp: 3400,
    damage: 54,
    speed: 136,
    radius: 38,
    xp: 980,
    gold: 700,
    color: '#38bdf8',
    accent: '#e0f2fe',
    rewardRelic: 'relic_frostheart',
    rewardResource: { crystal: 5, mithril: 10, soul: 14 },
    desc: 'Повелитель бури. Обрушивает град сосулек по зонам и выпускает ледяные спирали.'
  },
  azariel: {
    id: 'azariel',
    name: 'Азариэль, Владыка Разлома',
    title: 'Архонт Расколотого Горизонта',
    biome: 'rift',
    x: 4120,
    y: 4120,
    arenaRadius: 390,
    hp: 5200,
    damage: 68,
    speed: 158,
    radius: 40,
    xp: 1800,
    gold: 1500,
    color: '#c084fc',
    accent: '#fb7185',
    rewardArmor: 'armor_horizon',
    rewardResource: { crystal: 12, soul: 25 },
    desc: 'Финальный босс Бездны: телепортация, метеоритный шторм, двойные кольца энергии и вихрь пустоты!'
  }
};

export const QUESTS = [
  {
    id: 'q_awakening',
    title: 'Первые шаги на Рубеже',
    desc: 'Одолей 5 монстров в Изумрудной Пустоши и добудь 3 ед. ресурсов (трава, дерево или руда).',
    type: 'intro',
    goals: [
      { kind: 'kills', target: 5, label: 'Побеждено врагов' },
      { kind: 'gather', target: 3, label: 'Добыто ресурсов' }
    ],
    targetPos: { x: 2100, y: 2650 },
    rewards: { xp: 90, gold: 80, items: [{ type: 'consumable', id: 'potion_hp', count: 3 }] }
  },
  {
    id: 'q_forge',
    title: 'Огни Кузницы',
    desc: 'Создай любой предмет в разделе «Ремесло» или улучши оружие у Кузнеца Торна.',
    type: 'craft',
    goals: [
      { kind: 'craft_or_upgrade', target: 1, label: 'Создано или улучшено снаряжение' }
    ],
    targetPos: { x: 2505, y: 2300 },
    rewards: { xp: 130, gold: 120, items: [{ type: 'resource', id: 'iron', count: 4 }] }
  },
  {
    id: 'q_ruins_scout',
    title: 'Тени Багровых Руин',
    desc: 'Отправляйся на восток в Багровые Руины, зажги костёр «Врата Руин» и уничтожь 8 врагов руин.',
    type: 'explore',
    goals: [
      { kind: 'campfire', campId: 'camp_ruins', target: 1, label: 'Костёр «Врата Руин» открыт' },
      { kind: 'biome_kills', biome: 'ruins', target: 8, label: 'Нежить в Руинах уничтожена' }
    ],
    targetPos: { x: 3320, y: 2360 },
    rewards: { xp: 240, gold: 190, items: [{ type: 'armor', id: 'armor_ranger' }] }
  },
  {
    id: 'q_boss_morgrath',
    title: 'Страж Пепла',
    desc: 'Проникни в сердце Багровых Руин на востоке и сокруши босса Морграта!',
    type: 'boss',
    goals: [
      { kind: 'boss', bossId: 'morgrath', target: 1, label: 'Морграт повержен' }
    ],
    targetPos: { x: 4150, y: 2350 },
    rewards: { xp: 450, gold: 350, items: [{ type: 'consumable', id: 'elixir_power', count: 2 }] }
  },
  {
    id: 'q_boss_xylla',
    title: 'Сердце Ядовитых Топей',
    desc: 'Исследуй северо-западные Ядовитые Топи и одолей Королеву Роя Ксиллу.',
    type: 'boss',
    goals: [
      { kind: 'boss', bossId: 'xylla', target: 1, label: 'Королева Ксилла повержена' }
    ],
    targetPos: { x: 820, y: 820 },
    rewards: { xp: 750, gold: 520, items: [{ type: 'armor', id: 'armor_crimson' }] }
  },
  {
    id: 'q_boss_valkor',
    title: 'Ярость Морозного Пика',
    desc: 'Поднимись на северо-восток к Морозному Пику и победи Ледяного Колосса Валькора.',
    type: 'boss',
    goals: [
      { kind: 'boss', bossId: 'valkor', target: 1, label: 'Колосс Валькор повержен' }
    ],
    targetPos: { x: 3960, y: 720 },
    rewards: { xp: 1100, gold: 780, items: [{ type: 'weapon', id: 'staff_starfire' }] }
  },
  {
    id: 'q_boss_azariel',
    title: 'Расколотый Горизонт',
    desc: 'Войди в Разлом Горизонта на юго-востоке и сокруши финального босса Азариэля!',
    type: 'boss',
    goals: [
      { kind: 'boss', bossId: 'azariel', target: 1, label: 'Владыка Азариэль повержен' }
    ],
    targetPos: { x: 4120, y: 4120 },
    rewards: { xp: 2200, gold: 2000, items: [{ type: 'consumable', id: 'potion_greater', count: 5 }] }
  }
];

export const ACHIEVEMENTS = [
  { id: 'ach_first_blood', name: 'Первая кровь',       icon: '⚔️', desc: 'Победить первого врага.',                 goldReward: 40,  check: (s) => s.stats.totalKills >= 1 },
  { id: 'ach_slayer_50',   name: 'Охотник Рубежа',     icon: '💀', desc: 'Уничтожить 50 врагов.',                   goldReward: 150, check: (s) => s.stats.totalKills >= 50 },
  { id: 'ach_slayer_150',  name: 'Гроза Чудовищ',      icon: '🔥', desc: 'Уничтожить 150 врагов.',                  goldReward: 350, check: (s) => s.stats.totalKills >= 150 },
  { id: 'ach_gatherer',    name: 'Добытчик',           icon: '⛏️', desc: 'Собрать 25 ресурсов мира.',                goldReward: 100, check: (s) => s.stats.totalGathered >= 25 },
  { id: 'ach_crafter',     name: 'Мастер Ремесла',     icon: '🔨', desc: 'Создать 5 предметов в ремесле.',          goldReward: 120, check: (s) => s.stats.totalCrafted >= 5 },
  { id: 'ach_upgrader_5',  name: 'Острое Лезвие',      icon: '✨', desc: 'Заточить любое оружие до +5.',            goldReward: 250, check: (s) => Object.values(s.weaponUpgrades).some(v => v >= 5) },
  { id: 'ach_level_5',     name: 'Закалённый в боях',  icon: '⭐', desc: 'Достичь 5-го уровня персонажа.',          goldReward: 150, check: (s) => s.player.level >= 5 },
  { id: 'ach_level_10',    name: 'Герой Горизонта',    icon: '🌟', desc: 'Достичь 10-го уровня персонажа.',         goldReward: 400, check: (s) => s.player.level >= 10 },
  { id: 'ach_secret_1',    name: 'Искатель Тайн',      icon: '🗝️', desc: 'Найти первую секретную локацию.',         goldReward: 180, check: (s) => s.discoveredSecrets.length >= 1 },
  { id: 'ach_secret_all',  name: 'Хранитель Секретов', icon: '👑', desc: 'Открыть все 4 секретные локации мира!',   goldReward: 600, check: (s) => s.discoveredSecrets.length >= 4 },
  { id: 'ach_camps_all',   name: 'Первопроходец',      icon: '🏕️', desc: 'Разжечь все 5 путевых костров.',          goldReward: 300, check: (s) => s.unlockedCampfires.length >= 5 },
  { id: 'ach_morgrath',    name: 'Пепел к пеплу',      icon: '🛡️', desc: 'Победить босса Морграта.',                goldReward: 250, check: (s) => s.defeatedBosses.includes('morgrath') },
  { id: 'ach_xylla',       name: 'Погибель Роя',       icon: '🪲', desc: 'Победить Королеву Ксиллу.',               goldReward: 350, check: (s) => s.defeatedBosses.includes('xylla') },
  { id: 'ach_valkor',      name: 'Расколотый Лёд',     icon: '❄️', desc: 'Победить Ледяного Колосса Валькора.',     goldReward: 450, check: (s) => s.defeatedBosses.includes('valkor') },
  { id: 'ach_azariel',     name: 'Спаситель Горизонта',icon: '🌌', desc: 'Сокрушить Владыку Разлома Азариэля!',     goldReward: 1000, check: (s) => s.defeatedBosses.includes('azariel') },
  { id: 'ach_rich',        name: 'Золотой Запас',      icon: '💰', desc: 'Накопить 1500 золота одновременно.',      goldReward: 200, check: (s) => s.player.gold >= 1500 }
];
