// База данных игры Horizon: Выживание (Пиксель-арт 2D Action-Survival RPG)
// Все модели ссылаются на отдельные прозрачные PNG и спрайт-листы в assets/sprites/

export const WORLD_CONFIG = {
  width: 4800,
  height: 4800,
  tileSize: 32,
  spawnX: 2360,
  spawnY: 2440
};

export const RARITIES = {
  common:    { name: 'Обычный',     color: '#94a3b8' },
  uncommon:  { name: 'Необычный',   color: '#4ade80' },
  rare:      { name: 'Редкий',      color: '#38bdf8' },
  epic:      { name: 'Эпический',   color: '#c084fc' },
  legendary: { name: 'Легендарный', color: '#fbbf24' }
};

export const BIOMES = {
  forest: {
    id: 'forest',
    name: 'Зелёный Лес и Лагерь',
    subtitle: 'Уровень 1–3 · Лагерь выживших, ферма и чаща',
    tile: 'grass',
    groundBase: '#3a6636',
    groundAlt: '#2e542b',
    accent: '#67a34d',
    enemies: ['zombie', 'monster']
  },
  city: {
    id: 'city',
    name: 'Заброшенный Город',
    subtitle: 'Уровень 3–6 · Магазин, Больница, Полиция и Склады',
    tile: 'asphalt',
    groundBase: '#333945',
    groundAlt: '#2b303b',
    accent: '#60a5fa',
    enemies: ['zombie', 'infected_runner', 'bandit', 'bandit_gunner']
  },
  desert: {
    id: 'desert',
    name: 'Выжженная Пустошь и Завод',
    subtitle: 'Уровень 5–8 · Промзона Завода, Вышки и Бункер',
    tile: 'sand',
    groundBase: '#cfa26b',
    groundAlt: '#bd9058',
    accent: '#f59e0b',
    enemies: ['bandit', 'bandit_gunner', 'monster', 'soldier']
  },
  mountains: {
    id: 'mountains',
    name: 'Снежные Горы и Военная База',
    subtitle: 'Уровень 8+ · Северный Бункер и Укреплённая База',
    tile: 'snow',
    groundBase: '#cfdbe8',
    groundAlt: '#b8c8da',
    accent: '#38bdf8',
    enemies: ['soldier', 'sniper_guard', 'monster']
  }
};

export const CAMPFIRES = [
  { id: 'camp_forest',    name: 'Лагерь Выживших (Лес)', x: 2360, y: 2380, biome: 'forest',    unlockedByDefault: true },
  { id: 'camp_city',      name: 'Пост у Города',         x: 3320, y: 2380, biome: 'city',      unlockedByDefault: false },
  { id: 'camp_desert',    name: 'Костёр у Завода',       x: 1380, y: 3480, biome: 'desert',    unlockedByDefault: false },
  { id: 'camp_bunker',    name: 'Привал у Бункера',      x: 1360, y: 1280, biome: 'forest',    unlockedByDefault: false },
  { id: 'camp_mountains', name: 'Подступы к Базе',       x: 3420, y: 1120, biome: 'mountains', unlockedByDefault: false }
];

export const NPCS = [
  {
    id: 'trader',
    name: 'Торговец Марк',
    role: 'Магазин оружия и припасов',
    sprite: 'npc_trader',
    x: 2240,
    y: 2320,
    action: 'open_shop',
    greeting: 'Добро пожаловать в лавку! У меня всегда есть патроны, аптечки, гранаты, ключи от складов и надёжные стволы за звонкую монету.'
  },
  {
    id: 'quest',
    name: 'Сталкер Ворон',
    role: 'Квестовый проводник',
    sprite: 'npc_quest',
    x: 2450,
    y: 2340,
    action: 'quest_guide',
    greeting: 'Зона кишит зомби и мародёрами! Ищи серебряные ключи — ими открываются стальные двери Бункеров и Складов с редким оружием и рюкзаками.'
  },
  {
    id: 'medic',
    name: 'Доктор Елена',
    role: 'Полевой лекарь',
    sprite: 'npc_medic',
    x: 2290,
    y: 2490,
    action: 'heal_medic',
    greeting: 'Я обработала твои раны — здоровье полностью восстановлено! Не забывай брать в рейд аптечки и синие эликсиры.'
  },
  {
    id: 'farmer',
    name: 'Фермер Степан',
    role: 'Поставщик провизии',
    sprite: 'npc_farmer',
    x: 1960,
    y: 2560,
    action: 'farmer_food',
    greeting: 'Держи свежий кусок жареного мяса в дорогу! Если будешь сыт — раны затягиваются сами, а сил на бег и прыжки хватит с избытком.'
  }
];

// Все 8 видов оружия с референсного листа
export const WEAPONS = {
  knife: {
    id: 'knife',
    name: 'Боевой Нож',
    rarity: 'common',
    sprite: 'knife',
    icon: 'assets/sprites/weapons/knife.png',
    category: 'melee',
    ammoCost: 0,
    baseDamage: 16,
    cooldown: 0.20,
    range: 60,
    arc: 1.5,
    critBonus: 0.20,
    knockback: 100,
    price: 0,
    desc: 'Молниеносные удары вблизи без расхода патронов. +20% шанс крита.'
  },
  sword: {
    id: 'sword',
    name: 'Стальной Меч',
    rarity: 'uncommon',
    sprite: 'sword',
    icon: 'assets/sprites/weapons/sword.png',
    category: 'melee',
    ammoCost: 0,
    baseDamage: 28,
    cooldown: 0.34,
    range: 82,
    arc: 2.1,
    critBonus: 0.10,
    knockback: 190,
    price: 120,
    desc: 'Широкий рубящий удар по группе врагов. Не требует патронов.'
  },
  pistol: {
    id: 'pistol',
    name: 'Тактический Пистолет',
    rarity: 'common',
    sprite: 'pistol',
    icon: 'assets/sprites/weapons/pistol.png',
    category: 'gun',
    ammoCost: 1,
    baseDamage: 24,
    cooldown: 0.28,
    range: 360,
    projSpeed: 760,
    spread: 0.04,
    pellets: 1,
    critBonus: 0.12,
    knockback: 120,
    price: 90,
    desc: 'Точный и экономичный пистолет (1 патрон за выстрел).'
  },
  bow: {
    id: 'bow',
    name: 'Охотничий Лук',
    rarity: 'uncommon',
    sprite: 'bow',
    icon: 'assets/sprites/weapons/bow.png',
    category: 'bow',
    ammoCost: 0,
    baseDamage: 26,
    cooldown: 0.38,
    range: 370,
    projSpeed: 640,
    pellets: 1,
    pierce: 1,
    critBonus: 0.15,
    knockback: 135,
    price: 150,
    desc: 'Бесшумные пробивающие стрелы без траты огнестрельных патронов!'
  },
  shotgun: {
    id: 'shotgun',
    name: 'Боевой Дробовик',
    rarity: 'rare',
    sprite: 'shotgun',
    icon: 'assets/sprites/weapons/shotgun.png',
    category: 'gun',
    ammoCost: 2,
    baseDamage: 15, // × 5 дробин = 75 урона в упор!
    cooldown: 0.58,
    range: 255,
    projSpeed: 720,
    spread: 0.34,
    pellets: 5,
    critBonus: 0.08,
    knockback: 260,
    price: 240,
    desc: 'Выпускает веер из 5 картечин с мощнейшим отбрасыванием вблизи.'
  },
  rifle: {
    id: 'rifle',
    name: 'Штурмовой Автомат',
    rarity: 'rare',
    sprite: 'rifle',
    icon: 'assets/sprites/weapons/rifle.png',
    category: 'gun',
    ammoCost: 1,
    baseDamage: 22,
    cooldown: 0.13,
    range: 400,
    projSpeed: 840,
    spread: 0.08,
    pellets: 1,
    critBonus: 0.10,
    knockback: 95,
    price: 340,
    desc: 'Высокая скорострельность при удержании кнопки огня!'
  },
  sniper: {
    id: 'sniper',
    name: 'Снайперская Винтовка',
    rarity: 'epic',
    sprite: 'sniper',
    icon: 'assets/sprites/weapons/sniper.png',
    category: 'gun',
    ammoCost: 2,
    baseDamage: 88,
    cooldown: 0.78,
    range: 540,
    projSpeed: 1080,
    spread: 0.01,
    pellets: 1,
    pierce: 3,
    critBonus: 0.32,
    knockback: 280,
    price: 480,
    desc: 'Сокрушительный бронебойный выстрел сквозь нескольких врагов (+32% крит).'
  },
  magic_staff: {
    id: 'magic_staff',
    name: 'Посох Синего Эфира',
    rarity: 'legendary',
    sprite: 'magic_staff',
    icon: 'assets/sprites/weapons/magic_staff.png',
    category: 'magic',
    ammoCost: 0,
    baseDamage: 46,
    cooldown: 0.38,
    range: 410,
    projSpeed: 540,
    splashRadius: 74,
    critBonus: 0.18,
    knockback: 180,
    price: 650,
    desc: 'Стреляет самонаводящимися синими сферами магии со взрывом по площади!'
  }
};

// Все 8 ключевых предметов с референса + ресурсы крафта
export const ITEMS = {
  medkit:   { id: 'medkit',   name: 'Аптечка',         icon: 'assets/sprites/items/medkit.png',   rarity: 'uncommon', price: 35, desc: 'Мгновенно восстанавливает 55% макс. здоровья.' },
  ammo:     { id: 'ammo',     name: 'Патроны (×18)',   icon: 'assets/sprites/items/ammo.png',     rarity: 'common',   price: 25, desc: 'Боеприпасы для пистолета, дробовика, автомата и снайперки.' },
  grenade:  { id: 'grenade',  name: 'Осколочная граната', icon: 'assets/sprites/items/grenade.png', rarity: 'rare',    price: 45, desc: 'Мощный взрыв по площади! Разносит толпы врагов и бочки.' },
  food:     { id: 'food',     name: 'Мясной паёк',     icon: 'assets/sprites/items/food.png',     rarity: 'common',   price: 20, desc: '+60 сытости, +20% HP и ускоренное восстановление сил.' },
  potion:   { id: 'potion',   name: 'Синее зелье магии', icon: 'assets/sprites/items/potion.png', rarity: 'rare',     price: 50, desc: 'Восстанавливает 35% HP, 100% стамины и даёт энергощит на 12 сек.' },
  key:      { id: 'key',      name: 'Серебряный Ключ', icon: 'assets/sprites/items/key.png',      rarity: 'epic',     price: 110, desc: 'Отпирает запертые Бункеры, Склады и секретные сейфы.' },
  coin:     { id: 'coin',     name: 'Золотая монета',  icon: 'assets/sprites/items/coin.png',     rarity: 'common',   price: 1,  desc: 'Основная валюта выживших для торговли и улучшений.' },
  backpack: { id: 'backpack', name: 'Походный рюкзак', icon: 'assets/sprites/items/backpack.png', rarity: 'epic',     price: 180, desc: 'Постоянно увеличивает вместимость боезапаса, +25 HP и +15% к добыче!' }
};

export const RESOURCES = {
  wood:  { id: 'wood',  name: 'Древесина',     emoji: '🪵', color: '#b37646' },
  stone: { id: 'stone', name: 'Камень и руда', emoji: '🪨', color: '#94a3b8' },
  scrap: { id: 'scrap', name: 'Металлолом',    emoji: '⚙️', color: '#60a5fa' },
  herb:  { id: 'herb',  name: 'Лесные ягоды',  emoji: '🌿', color: '#4ade80' }
};

export const RECIPES = [
  { id: 'rc_ammo',     resultId: 'ammo',     amount: 20, costCoins: 10, ingredients: { scrap: 2, stone: 1 }, desc: 'Собрать 20 патронов из металлолома и пороховой руды.' },
  { id: 'rc_medkit',   resultId: 'medkit',   amount: 2,  costCoins: 12, ingredients: { herb: 3 },            desc: 'Сделать 2 полевые аптечки из целебных трав.' },
  { id: 'rc_food',     resultId: 'food',     amount: 2,  costCoins: 8,  ingredients: { herb: 2, wood: 1 },   desc: 'Приготовить 2 питательных пайка на костре.' },
  { id: 'rc_grenade',  resultId: 'grenade',  amount: 2,  costCoins: 20, ingredients: { scrap: 3, stone: 2 }, desc: 'Собрать 2 осколочные гранаты.' },
  { id: 'rc_potion',   resultId: 'potion',   amount: 1,  costCoins: 25, ingredients: { herb: 2, scrap: 2 },  desc: 'Сварить синее магическое зелье энергощита.' },
  { id: 'rc_key',      resultId: 'key',      amount: 1,  costCoins: 60, ingredients: { scrap: 5, stone: 3 }, desc: 'Выточить отмычку-ключ для бункеров и складов.' },
  { id: 'rc_bow',      weaponId: 'bow',      amount: 1,  costCoins: 70, ingredients: { wood: 6, stone: 2 },  desc: 'Смастерить бесшумный Охотничий Лук.' },
  { id: 'rc_sword',    weaponId: 'sword',    amount: 1,  costCoins: 80, ingredients: { scrap: 5, wood: 3 },  desc: 'Выковать прочный Стальной Меч.' },
  { id: 'rc_shotgun',  weaponId: 'shotgun',  amount: 1,  costCoins: 150, ingredients: { scrap: 8, wood: 4 }, desc: 'Собрать мощный Боевой Дробовик.' },
  { id: 'rc_rifle',    weaponId: 'rifle',    amount: 1,  costCoins: 240, ingredients: { scrap: 12, stone: 6 }, desc: 'Собрать скорострельный Штурмовой Автомат.' },
  { id: 'rc_backpack', resultId: 'backpack', amount: 1,  costCoins: 130, ingredients: { wood: 4, herb: 4, scrap: 4 }, desc: 'Сшить усиленный Рюкзак (+боезапас и +25 HP).' }
];

// 3 активные способности героя
export const SKILLS = {
  slash_wave: {
    id: 'slash_wave',
    keyLabel: '1',
    name: 'Круговой Удар',
    icon: '⚔️',
    color: '#f97316',
    baseCooldown: 6.0,
    staminaCost: 20,
    baseDamageMult: 2.0,
    radius: 108,
    unlockLevel: 1,
    desc: 'Мощный круговой удар вокруг героя, отбрасывающий всех врагов и разбивающий ящики.'
  },
  magic_nova: {
    id: 'magic_nova',
    keyLabel: '2',
    name: 'Импульс Магии',
    icon: '🌀',
    color: '#2998ff',
    baseCooldown: 9.0,
    staminaCost: 24,
    baseDamageMult: 2.6,
    radius: 145,
    unlockLevel: 2,
    desc: 'Взрыв синей магии вокруг героя: наносит высокий урон и оглушает врагов на 1.8 сек.'
  },
  adrenaline: {
    id: 'adrenaline',
    keyLabel: '3',
    name: 'Спецзаряд Выжившего',
    icon: '⚡',
    color: '#22c55e',
    baseCooldown: 13.0,
    staminaCost: 20,
    duration: 8.0,
    unlockLevel: 3,
    desc: 'Восстанавливает 25% HP, включает энергощит (-40% урона) и ускоряет стрельбу и бег!'
  }
};

export const ENEMIES = {
  zombie: {
    id: 'zombie', name: 'Зомби', sprite: 'zombie',
    hp: 55, damage: 11, speed: 108, radius: 14, xp: 18, coins: [5, 11],
    behavior: 'melee',
    drops: [{ id: 'food', chance: 0.14 }, { id: 'medkit', chance: 0.10 }, { res: 'scrap', chance: 0.25 }]
  },
  infected_runner: {
    id: 'infected_runner', name: 'Бешеный зомби', sprite: 'zombie',
    hp: 75, damage: 15, speed: 162, radius: 14, xp: 26, coins: [8, 15],
    behavior: 'dasher',
    drops: [{ id: 'medkit', chance: 0.16 }, { id: 'ammo', chance: 0.22 }]
  },
  bandit: {
    id: 'bandit', name: 'Бандит-мародёр', sprite: 'bandit',
    hp: 95, damage: 18, speed: 136, radius: 15, xp: 34, coins: [12, 22],
    behavior: 'melee',
    drops: [{ id: 'ammo', chance: 0.42 }, { id: 'food', chance: 0.22 }, { res: 'scrap', chance: 0.35 }]
  },
  bandit_gunner: {
    id: 'bandit_gunner', name: 'Бандит со стволом', sprite: 'bandit',
    hp: 105, damage: 19, speed: 122, radius: 15, xp: 42, coins: [15, 28],
    behavior: 'shooter', attackRange: 285, projSpeed: 420,
    drops: [{ id: 'ammo', chance: 0.55 }, { id: 'grenade', chance: 0.18 }, { id: 'key', chance: 0.06 }]
  },
  monster: {
    id: 'monster', name: 'Мутант-зверь', sprite: 'monster',
    hp: 135, damage: 24, speed: 168, radius: 17, xp: 48, coins: [14, 26],
    behavior: 'pouncer',
    drops: [{ id: 'food', chance: 0.55 }, { id: 'potion', chance: 0.14 }]
  },
  soldier: {
    id: 'soldier', name: 'Боец спецотряда', sprite: 'soldier',
    hp: 175, damage: 27, speed: 128, radius: 15, xp: 66, coins: [24, 42],
    behavior: 'burst_shooter', attackRange: 320, projSpeed: 480,
    drops: [{ id: 'ammo', chance: 0.65 }, { id: 'grenade', chance: 0.28 }, { id: 'medkit', chance: 0.22 }, { id: 'key', chance: 0.10 }]
  },
  sniper_guard: {
    id: 'sniper_guard', name: 'Элитный стрелок', sprite: 'soldier',
    hp: 210, damage: 36, speed: 118, radius: 15, xp: 82, coins: [30, 52],
    behavior: 'shooter', attackRange: 380, projSpeed: 560,
    drops: [{ id: 'ammo', chance: 0.70 }, { id: 'key', chance: 0.15 }, { id: 'potion', chance: 0.20 }]
  }
};

export const BOSSES = {
  boss_city: {
    id: 'boss_city',
    name: 'Титан-01 (Мутант Мегаполиса)',
    title: 'Хозяин Заброшенного Города',
    biome: 'city',
    x: 4060,
    y: 2380,
    arenaRadius: 340,
    hp: 1250,
    damage: 30,
    speed: 126,
    radius: 28,
    xp: 380,
    coins: 280,
    rewardWeapon: 'shotgun',
    rewardItems: [{ id: 'key', count: 1 }, { id: 'ammo', count: 36 }],
    desc: 'Сотрясает асфальт ударными волнами (перепрыгивай!) и призывает заражённых.'
  },
  boss_factory: {
    id: 'boss_factory',
    name: 'Разрушитель «Молот»',
    title: 'Главарь Завода в Пустоши',
    biome: 'desert',
    x: 920,
    y: 3920,
    arenaRadius: 350,
    hp: 2100,
    damage: 38,
    speed: 138,
    radius: 29,
    xp: 640,
    coins: 450,
    rewardWeapon: 'rifle',
    rewardItems: [{ id: 'key', count: 1 }, { id: 'grenade', count: 4 }],
    desc: 'Мечет кассеты гранат по площадям и идёт на таран.'
  },
  boss_bunker: {
    id: 'boss_bunker',
    name: 'Объект «Кровожад»',
    title: 'Страж Северного Бункера',
    biome: 'forest',
    x: 860,
    y: 860,
    arenaRadius: 350,
    hp: 3100,
    damage: 46,
    speed: 152,
    radius: 30,
    xp: 920,
    coins: 650,
    rewardWeapon: 'sniper',
    rewardItems: [{ id: 'backpack', count: 1 }, { id: 'potion', count: 3 }],
    desc: 'Совершает гигантские прыжки сверху и выпускает залпы шипов.'
  },
  boss_base: {
    id: 'boss_base',
    name: 'Проект «ГОРИЗОНТ»',
    title: 'Колосс Военной Базы в Горах',
    biome: 'mountains',
    x: 4080,
    y: 780,
    arenaRadius: 380,
    hp: 4600,
    damage: 58,
    speed: 150,
    radius: 32,
    xp: 1600,
    coins: 1400,
    rewardWeapon: 'magic_staff',
    rewardItems: [{ id: 'backpack', count: 1 }, { id: 'key', count: 2 }],
    desc: 'Финальный босс Военной Базы: артобстрел взрывами, огненные рывки и ударные кольца!'
  }
};

// Секретные бункеры и закрытые склады
export const SECRETS = [
  {
    id: 'sec_bunker_west',
    name: 'Бункер «Альфа-7»',
    hint: 'Открой гермодверь Бункера на северо-западе Леса с помощью Серебряного Ключа',
    x: 1120,
    y: 1240,
    requiresKey: true,
    rewardWeapon: 'rifle',
    rewardItems: [{ id: 'backpack', count: 1 }, { id: 'ammo', count: 40 }, { id: 'medkit', count: 3 }],
    coins: 220
  },
  {
    id: 'sec_warehouse_city',
    name: 'Спецсклад Полиции',
    hint: 'Открой запертый Склад в Заброшенном Городе Серебряным Ключом',
    x: 3820,
    y: 1780,
    requiresKey: true,
    rewardWeapon: 'shotgun',
    rewardItems: [{ id: 'ammo', count: 50 }, { id: 'grenade', count: 4 }],
    coins: 200
  },
  {
    id: 'sec_bunker_desert',
    name: 'Подземный Бункер Пустыни',
    hint: 'Найди занесённый песком Бункер на юге Пустыни (нужен Ключ)',
    x: 2150,
    y: 4280,
    requiresKey: true,
    rewardWeapon: 'sniper',
    rewardItems: [{ id: 'potion', count: 3 }, { id: 'backpack', count: 1 }],
    coins: 320
  },
  {
    id: 'sec_island_stash',
    name: 'Остров Контрабандистов',
    hint: 'Перепрыгни по плитам через реку на юго-востоке Леса без ключа!',
    x: 3120,
    y: 3820,
    requiresKey: false,
    rewardWeapon: 'magic_staff',
    rewardItems: [{ id: 'key', count: 1 }, { id: 'grenade', count: 3 }],
    coins: 300
  }
];

export const QUESTS = [
  {
    id: 'q_start',
    title: 'Выживший на Рубеже',
    desc: 'Уничтожь 5 врагов в окрестностях Леса и разбей/собери 4 объекта ресурсов (ящики, бочки, кусты или деревья).',
    targetPos: { x: 2620, y: 2560 },
    goals: [
      { kind: 'kills', target: 5, label: 'Уничтожено врагов' },
      { kind: 'gather', target: 4, label: 'Собрано ресурсов и ящиков' }
    ],
    rewards: { xp: 100, coins: 90, items: [{ id: 'ammo', count: 30 }, { id: 'key', count: 1 }] }
  },
  {
    id: 'q_city_raid',
    title: 'Рейд в Заброшенный Город',
    desc: 'Отправляйся на восток в Город, зажги «Пост у Города» и зачисть 8 зомби или бандитов.',
    targetPos: { x: 3320, y: 2380 },
    goals: [
      { kind: 'campfire', campId: 'camp_city', target: 1, label: 'Костёр «Пост у Города» зажжён' },
      { kind: 'biome_kills', biome: 'city', target: 8, label: 'Врагов в Городе устранено' }
    ],
    rewards: { xp: 220, coins: 160, items: [{ id: 'grenade', count: 3 }, { id: 'medkit', count: 2 }] }
  },
  {
    id: 'q_bunker_unlock',
    title: 'Тайна Запертого Склада',
    desc: 'Используй Серебряный Ключ, чтобы отпереть любой Бункер или закрытый Склад в мире!',
    targetPos: { x: 3820, y: 1780 },
    goals: [
      { kind: 'secret', target: 1, label: 'Открыто бункеров / складов' }
    ],
    rewards: { xp: 280, coins: 220, items: [{ id: 'backpack', count: 1 }] }
  },
  {
    id: 'q_boss_city',
    title: 'Угроза Мегаполиса',
    desc: 'Найди арену на востоке Города и победи босса Титан-01!',
    targetPos: { x: 4060, y: 2380 },
    goals: [
      { kind: 'boss', bossId: 'boss_city', target: 1, label: 'Босс Титан-01 повержен' }
    ],
    rewards: { xp: 450, coins: 320, items: [{ id: 'ammo', count: 50 }, { id: 'potion', count: 2 }] }
  },
  {
    id: 'q_boss_factory',
    title: 'Штурм Завода в Пустоши',
    desc: 'Отправляйся на юго-запад к Заводу в Пустыне и сокруши главаря «Молот».',
    targetPos: { x: 920, y: 3920 },
    goals: [
      { kind: 'boss', bossId: 'boss_factory', target: 1, label: 'Босс «Молот» повержен' }
    ],
    rewards: { xp: 700, coins: 480, items: [{ id: 'key', count: 1 }, { id: 'grenade', count: 4 }] }
  },
  {
    id: 'q_boss_bunker',
    title: 'Охота на «Кровожада»',
    desc: 'Исследуй северо-западную чащу у секретного сектора и победи мутанта «Кровожад».',
    targetPos: { x: 860, y: 860 },
    goals: [
      { kind: 'boss', bossId: 'boss_bunker', target: 1, label: 'Босс «Кровожад» повержен' }
    ],
    rewards: { xp: 1000, coins: 700, items: [{ id: 'medkit', count: 4 }, { id: 'ammo', count: 80 }] }
  },
  {
    id: 'q_boss_base',
    title: 'Штурм Военной Базы',
    desc: 'Прорвись в Снежные Горы на северо-востоке и уничтожь финального босса Проект «ГОРИЗОНТ»!',
    targetPos: { x: 4080, y: 780 },
    goals: [
      { kind: 'boss', bossId: 'boss_base', target: 1, label: 'Проект «ГОРИЗОНТ» уничтожен' }
    ],
    rewards: { xp: 2000, coins: 1800, items: [{ id: 'potion', count: 5 }] }
  }
];

export const ACHIEVEMENTS = [
  { id: 'ach_kill_1',     name: 'Первый выстрел',      icon: '🔫', desc: 'Уничтожить первого врага.',                reward: 40,  check: (s) => s.stats.totalKills >= 1 },
  { id: 'ach_kill_50',    name: 'Зачистка сектора',    icon: '💀', desc: 'Уничтожить 50 врагов.',                    reward: 150, check: (s) => s.stats.totalKills >= 50 },
  { id: 'ach_kill_150',   name: 'Легенда Выживших',    icon: '🔥', desc: 'Уничтожить 150 врагов.',                   reward: 350, check: (s) => s.stats.totalKills >= 150 },
  { id: 'ach_grenadier',  name: 'Подрывник',           icon: '💣', desc: 'Использовать гранату или взорвать бочку.', reward: 80,  check: (s) => s.stats.explosionsTriggered >= 1 },
  { id: 'ach_driver',     name: 'На колёсах',          icon: '🚗', desc: 'Сесть за руль транспорта в мире.',         reward: 90,  check: (s) => s.stats.droveVehicle >= 1 },
  { id: 'ach_crafter',    name: 'Полевой Инженер',     icon: '🛠️', desc: 'Создать 5 предметов в ремесле.',          reward: 120, check: (s) => s.stats.totalCrafted >= 5 },
  { id: 'ach_upgrade_5',  name: 'Оружейный Мастер',    icon: '⚙️', desc: 'Улучшить любое оружие до +5.',             reward: 250, check: (s) => Object.values(s.weaponUpgrades).some(v => v >= 5) },
  { id: 'ach_arsenal',    name: 'Полный Арсенал',      icon: '🎒', desc: 'Собрать 6 разных видов оружия.',           reward: 300, check: (s) => s.inventory.weapons.length >= 6 },
  { id: 'ach_bunker_1',   name: 'Взломщик Бункеров',   icon: '🗝️', desc: 'Открыть первый запертый бункер или склад.', reward: 160, check: (s) => s.discoveredSecrets.length >= 1 },
  { id: 'ach_bunker_all', name: 'Охотник за Тайнами',  icon: '👑', desc: 'Открыть все 4 секретные локации!',         reward: 600, check: (s) => s.discoveredSecrets.length >= 4 },
  { id: 'ach_lvl_5',      name: 'Опытный Сталкер',     icon: '⭐', desc: 'Достичь 5-го уровня персонажа.',           reward: 150, check: (s) => s.player.level >= 5 },
  { id: 'ach_lvl_10',     name: 'Ветеран Зоны',        icon: '🌟', desc: 'Достичь 10-го уровня персонажа.',          reward: 400, check: (s) => s.player.level >= 10 },
  { id: 'ach_boss_1',     name: 'Охотник на Гигантов', icon: '🛡️', desc: 'Победить Титана-01 в Городе.',            reward: 250, check: (s) => s.defeatedBosses.includes('boss_city') },
  { id: 'ach_boss_2',     name: 'Хозяин Промзоны',     icon: '🏭', desc: 'Победить главаря Завода «Молот».',         reward: 350, check: (s) => s.defeatedBosses.includes('boss_factory') },
  { id: 'ach_boss_3',     name: 'Укротитель Зверя',    icon: '🐺', desc: 'Победить «Кровожада» у Бункера.',          reward: 450, check: (s) => s.defeatedBosses.includes('boss_bunker') },
  { id: 'ach_boss_4',     name: 'Герой Горизонта',     icon: '🎖️', desc: 'Уничтожить Проект «ГОРИЗОНТ» на Базе!',   reward: 1000, check: (s) => s.defeatedBosses.includes('boss_base') }
];
