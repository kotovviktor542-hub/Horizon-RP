// База данных VEXMORA — БОЛЬШОЕ ОБНОВЛЕНИЕ ИГРЫ (2D Pixel-Art Action-Survival RPG)
// 16 типов врагов, 10 многофазных боссов, 24 вида оружия с перезарядкой и модификациями,
// спасение NPC и выживших, развитие Убежища (5 отсеков + напарники), дерево навыков и спецоперации.

export const GAME_TITLE = 'VEXMORA';

export const UPDATE_ANNOUNCEMENT = {
  version: '2.0',
  title: 'VEXMORA — БОЛЬШОЕ ОБНОВЛЕНИЕ ИГРЫ',
  lead: 'Добро пожаловать в масштабное расширение VEXMORA! Сохранён весь ваш прогресс, чёткий пиксель-арт стиль, отзывчивое мобильное управление и высокая производительность на Android.',
  sections: [
    {
      icon: '👾',
      heading: '1. 16 уникальных типов врагов',
      text: 'Бойцы ближнего боя, стрелки, снайперы с лазерным прицелом, быстрые преследователи, бронированные щитоносцы, гренадёры, огнемётчики, невидимые охотники, кислотные мутанты, боевые дроны, вражеские медики и мини-боссы охраны.'
    },
    {
      icon: '👹',
      heading: '2. 10 многофазных боссов с аренами',
      text: 'Механический Разрушитель, Король Мутантов, Бронированный Командир, Снайпер-Охотник, Гигантский Зверь, Безумный Учёный, Теневой Убийца, Огромный Боевой Робот, Генерал Армии и финальный босс АРХОНТ VEXMORA с предупреждениями об ударах и коллекцией трофеев.'
    },
    {
      icon: '🔫',
      heading: '3. Арсенал из 24 видов оружия + Модификации',
      text: 'Пистолеты, револьверы, ПП, дробовики, штурмовые и лазерные винтовки, снайперки, рельсотрон, пулемёты, миниган, арбалет, катана, гранатомёт, ракетница и Тесла-пушка с обоймами, перезарядкой, постепенным открытием и 5 боевыми модулями.'
    },
    {
      icon: '🆘',
      heading: '4. Спасение пленников и выживших',
      text: 'Отключайте сигнализацию и отпирайте клетки, лечите и защищайте раненых от волн врагов, сопровождайте выживших до базы и успевайте спасти заложников за отведённое время!'
    },
    {
      icon: '🏰',
      heading: '5. Развитие Убежища и Бойцы-напарники',
      text: 'Спасённые Медик, Торговец, Инженер, Механик и Бойцы развивают 5 отсеков базы, открывают модификацию стволов, тюнинг транспорта, склад ресурсов и ходят с вами в боевые рейды!'
    },
    {
      icon: '🎯',
      heading: '6. Спецоперации, Оборона Базы и Дерево Навыков',
      text: 'Зачистка баз, устранение командиров, охрана караванов, отражение атак на Убежище, секретные хранилища, дерево перков и коллекция всех 10 боссов.'
    }
  ]
};

export const WORLD_CONFIG = {
  width: 6400,
  height: 6400,
  tileSize: 32,
  spawnX: 3160,
  spawnY: 3240
};

export const RARITIES = {
  common:    { name: 'Обычный',     color: '#94a3b8', tier: 1 },
  uncommon:  { name: 'Необычный',   color: '#4ade80', tier: 2 },
  rare:      { name: 'Редкий',      color: '#38bdf8', tier: 3 },
  epic:      { name: 'Эпический',   color: '#c084fc', tier: 4 },
  legendary: { name: 'Легендарный', color: '#fbbf24', tier: 5 }
};

export const BIOMES = {
  forest: {
    id: 'forest',
    name: 'Зелёный Рубеж и Убежище',
    subtitle: 'Уровень 1–4 · Убежище VEXMORA, ферма, чаща и аванпосты',
    tile: 'grass',
    groundBase: '#3a6636',
    groundAlt: '#2e542b',
    accent: '#67a34d',
    enemies: ['zombie', 'bandit', 'infected_runner', 'monster', 'acid_spitter']
  },
  city: {
    id: 'city',
    name: 'Заброшенный Мегаполис',
    subtitle: 'Уровень 3–8 · Кварталы, Полиция, Больница и снайперы',
    tile: 'asphalt',
    groundBase: '#333945',
    groundAlt: '#2b303b',
    accent: '#60a5fa',
    enemies: ['zombie', 'infected_runner', 'bandit_gunner', 'sniper_guard', 'heavy_trooper', 'stealth_hunter', 'grenadier']
  },
  desert: {
    id: 'desert',
    name: 'Промзона и Песчаный Каньон',
    subtitle: 'Уровень 5–11 · Химзавод, Лаборатория, Ангар Роботов',
    tile: 'sand',
    groundBase: '#cfa26b',
    groundAlt: '#bd9058',
    accent: '#f59e0b',
    enemies: ['bandit_gunner', 'grenadier', 'pyro_trooper', 'monster', 'acid_spitter', 'combat_drone', 'enemy_medic']
  },
  mountains: {
    id: 'mountains',
    name: 'Северный Хребет и Цитадель VEXMORA',
    subtitle: 'Уровень 8–15+ · Военный Штаб, Ночной Сектор и Ядро VEXMORA',
    tile: 'snow',
    groundBase: '#cfdbe8',
    groundAlt: '#b8c8da',
    accent: '#38bdf8',
    enemies: ['soldier', 'sniper_guard', 'heavy_trooper', 'stealth_hunter', 'combat_drone', 'enemy_medic', 'pyro_trooper']
  }
};

export const CAMPFIRES = [
  { id: 'camp_forest',    name: 'Убежище VEXMORA (Главная База)', x: 3160, y: 3180, biome: 'forest',    unlockedByDefault: true },
  { id: 'camp_west',      name: 'Лесной Пост у Чащи',             x: 1580, y: 2180, biome: 'forest',    unlockedByDefault: false },
  { id: 'camp_city',      name: 'Баррикада Мегаполиса',           x: 4420, y: 3180, biome: 'city',      unlockedByDefault: false },
  { id: 'camp_city_north',name: 'Северный Квартал Города',        x: 5280, y: 2140, biome: 'city',      unlockedByDefault: false },
  { id: 'camp_desert',    name: 'Аванпост Промзоны',              x: 1860, y: 4680, biome: 'desert',    unlockedByDefault: false },
  { id: 'camp_canyon',    name: 'Лагерь Южного Каньона',          x: 3480, y: 5360, biome: 'desert',    unlockedByDefault: false },
  { id: 'camp_mountains', name: 'Штурмовой Лагерь Хребта',        x: 4460, y: 1280, biome: 'mountains', unlockedByDefault: false }
];

// Специалисты Главной Базы (Убежища VEXMORA)
export const NPCS = [
  {
    id: 'trader',
    name: 'Торговец Марк',
    role: 'Арсенал и снабжение',
    sprite: 'npc_trader',
    x: 3030,
    y: 3120,
    action: 'open_shop',
    unlockedByDefault: true,
    greeting: 'С возвращением на базу VEXMORA! По мере развития Торгового Отсека и побед над боссами я привожу всё более грозные стволы и боеприпасы.'
  },
  {
    id: 'quest',
    name: 'Командир Ворон',
    role: 'Штаб спецопераций',
    sprite: 'npc_quest',
    x: 3290,
    y: 3130,
    action: 'quest_guide',
    unlockedByDefault: true,
    greeting: 'Вражеская корпорация VEXMORA удерживает выживших в клетках по всей Зоне! Спасай людей, укрепляй Убежище и ликвидируй всех 10 командиров и боссов.'
  },
  {
    id: 'medic',
    name: 'Доктор Елена',
    role: 'Главврач Медблока',
    sprite: 'npc_medic',
    x: 3070,
    y: 3300,
    action: 'heal_medic',
    unlockedByDefault: true,
    greeting: 'Раны обработаны — здоровье полностью восстановлено! Улучшай Медблок Базы, чтобы получать полевую регенерацию и запас медикаментов.'
  },
  {
    id: 'farmer',
    name: 'Агроном Степан',
    role: 'Провизия и Склад',
    sprite: 'npc_farmer',
    x: 2780,
    y: 3340,
    action: 'farmer_food',
    unlockedByDefault: true,
    greeting: 'Держи горячий паёк в рейд! Чем больше людей мы спасём для Убежища, тем богаче станут запасы нашего Склада.'
  },
  {
    id: 'engineer',
    name: 'Инженер Кай',
    role: 'Модификации и апгрейд оружия',
    sprite: 'npc_engineer',
    x: 3340,
    y: 3280,
    action: 'open_engineer',
    unlockedByRescue: 'res_engineer',
    greeting: 'Спасибо за спасение из плена! Теперь мой Инженерный Цех открыт: я устанавливаю прицелы, увеличенные обоймы, бронебойные и крио-модули на твоё оружие!'
  },
  {
    id: 'mechanic',
    name: 'Механик Рокко',
    role: 'Гараж и бронетехника',
    sprite: 'npc_mechanic',
    x: 3440,
    y: 3190,
    action: 'open_garage',
    unlockedByRescue: 'res_mechanic',
    greeting: 'Гараж Убежища на ходу! Прокачивай двигатель и таранный бампер машин — теперь любая техника в твоих руках крушит врагов как танк!'
  },
  {
    id: 'fighter_ally',
    name: 'Сержант Шрам',
    role: 'Командир бойцов-напарников',
    sprite: 'npc_fighter',
    x: 3215,
    y: 3330,
    action: 'toggle_companion',
    unlockedByRescue: 'res_fighter_1',
    greeting: 'Отряд спасённых бойцов готов прикрывать тебя в бою! Скажи слово — и я пойду с тобой в рейд с штурмовой винтовкой.'
  }
];

// Модификации оружия (устанавливаются у Инженера / во вкладке База и Арсенал)
export const WEAPON_MODS = {
  mod_scope: {
    id: 'mod_scope',
    name: 'Лазерный Коллиматор',
    icon: '🎯',
    costCoins: 140,
    costScrap: 4,
    desc: '+15% к шансу критического попадания и +18% к дальности стрельбы.'
  },
  mod_mag: {
    id: 'mod_mag',
    name: 'Сдвоенный Магазин',
    icon: '🔋',
    costCoins: 160,
    costScrap: 5,
    desc: '+50% к ёмкости магазина и ускорение перезарядки на 30%.'
  },
  mod_barrel: {
    id: 'mod_barrel',
    name: 'Бронебойный Ствол',
    icon: '💥',
    costCoins: 210,
    costScrap: 6,
    desc: '+22% к прямому урону и +1 к пробитию целей насквозь.'
  },
  mod_cryo: {
    id: 'mod_cryo',
    name: 'Крио-Импульс',
    icon: '❄️',
    costCoins: 240,
    costScrap: 7,
    desc: 'Замедляет поражённых врагов на 35% на 2.5 сек. и даёт +12% урона.'
  },
  mod_vamp: {
    id: 'mod_vamp',
    name: 'Вампирский Реактор',
    icon: '🩸',
    costCoins: 300,
    costScrap: 9,
    desc: 'Восстанавливает здоровье героя при попаданиях по врагам и боссам!'
  }
};

// 5 развиваемых отсеков Убежища VEXMORA
export const BASE_ROOMS = {
  medbay: {
    id: 'medbay',
    name: '🏥 Медблок Убежища',
    specialist: 'Доктор Елена',
    baseCostCoins: 110,
    baseCostWood: 3,
    baseCostScrap: 2,
    desc: 'Даёт пассивную регенерацию HP в мире (+1.2 HP/сек за уровень) и увеличивает эффективность аптечек на +10% за уровень.'
  },
  market: {
    id: 'market',
    name: '🏪 Торговый Отсек',
    specialist: 'Торговец Марк',
    baseCostCoins: 130,
    baseCostWood: 4,
    baseCostScrap: 3,
    desc: 'Постепенно открывает доступ к более мощным тирам оружия в магазине и даёт скидку 5% за уровень.'
  },
  workshop: {
    id: 'workshop',
    name: '🔧 Инженерный Цех',
    specialist: 'Инженер Кай',
    baseCostCoins: 150,
    baseCostWood: 3,
    baseCostScrap: 5,
    desc: 'Открывает установку боевых Модификаций оружия и добавляет +6% к урону всего арсенала за уровень.'
  },
  garage: {
    id: 'garage',
    name: '🚙 Гараж Механика',
    specialist: 'Механик Рокко',
    baseCostCoins: 140,
    baseCostWood: 3,
    baseCostScrap: 5,
    desc: 'Увеличивает скорость машин на +10%, защиту кузова и урон тарана на +25% за уровень. Паркует бронеджип у Базы!'
  },
  barracks: {
    id: 'barracks',
    name: '🛡️ Казарма и Склад',
    specialist: 'Сержант Шрам',
    baseCostCoins: 160,
    baseCostWood: 5,
    baseCostScrap: 4,
    desc: 'Расширяет максимум патронов (+35 за ур.), усиливает урон бойца-напарника (+25% за ур.) и укрепляет оборону Базы.'
  }
};

// 24 УНИКАЛЬНЫХ ВИДА ОРУЖИЯ (открываются постепенно по tier 1..5, боссам, спасению и базе!)
export const WEAPONS = {
  // ── Холодное оружие и Лук/Арбалет (6) ───────────────────────────────
  knife: {
    id: 'knife', name: 'Боевой Нож', rarity: 'common', tier: 1,
    sprite: 'knife', icon: 'assets/sprites/weapons/knife.png',
    category: 'melee', classLabel: 'Холодное оружие',
    ammoCost: 0, magSize: 0, reloadTime: 0,
    baseDamage: 18, cooldown: 0.20, range: 62, arc: 1.5, critBonus: 0.20, knockback: 105, price: 0,
    desc: 'Стартовый тактический клинок: быстрые удары без патронов и перезарядки.'
  },
  sword: {
    id: 'sword', name: 'Вибро-Меч Сталкера', rarity: 'uncommon', tier: 1,
    sprite: 'sword', icon: 'assets/sprites/weapons/sword.png',
    category: 'melee', classLabel: 'Холодное оружие',
    ammoCost: 0, magSize: 0, reloadTime: 0,
    baseDamage: 32, cooldown: 0.33, range: 84, arc: 2.1, critBonus: 0.12, knockback: 195, price: 130,
    desc: 'Широкий рубящий удар по группе противников. Не расходует боезапас.'
  },
  katana: {
    id: 'katana', name: 'Плазменная Катана «Тень»', rarity: 'epic', tier: 4,
    sprite: 'katana', icon: 'assets/sprites/weapons/katana.png',
    category: 'melee', classLabel: 'Холодное оружие',
    ammoCost: 0, magSize: 0, reloadTime: 0,
    baseDamage: 62, cooldown: 0.24, range: 94, arc: 2.3, critBonus: 0.30, knockback: 220, price: 620,
    desc: 'Молниеносный энергоклинок Теневого Убийцы с огромным шансом крита (+30%).'
  },
  bow: {
    id: 'bow', name: 'Композитный Лук', rarity: 'uncommon', tier: 1,
    sprite: 'bow', icon: 'assets/sprites/weapons/bow.png',
    category: 'bow', classLabel: 'Лук и арбалет',
    ammoCost: 0, magSize: 0, reloadTime: 0,
    baseDamage: 28, cooldown: 0.36, range: 375, projSpeed: 660, pierce: 1, critBonus: 0.16, knockback: 135, price: 150,
    desc: 'Бесшумные оперенные стрелы, пробивающие двух врагов без расхода патронов.'
  },
  crossbow: {
    id: 'crossbow', name: 'Осадный Арбалет «Болт»', rarity: 'rare', tier: 2,
    sprite: 'crossbow', icon: 'assets/sprites/weapons/crossbow.png',
    category: 'bow', classLabel: 'Лук и арбалет',
    ammoCost: 0, magSize: 6, reloadTime: 1.15,
    baseDamage: 54, cooldown: 0.44, range: 430, projSpeed: 820, pierce: 2, critBonus: 0.24, knockback: 210, price: 310,
    desc: 'Бронебойные стальные болты без траты патронов. Пробивает до 3 целей подряд!'
  },

  // ── Пистолеты и Револьверы (3) ──────────────────────────────────────
  pistol: {
    id: 'pistol', name: 'Тактический Пистолет', rarity: 'common', tier: 1,
    sprite: 'pistol', icon: 'assets/sprites/weapons/pistol.png',
    category: 'gun', classLabel: 'Пистолеты',
    ammoCost: 1, magSize: 12, reloadTime: 1.0,
    baseDamage: 24, cooldown: 0.26, range: 365, projSpeed: 760, spread: 0.04, pellets: 1, critBonus: 0.12, knockback: 115, price: 85,
    desc: 'Надёжный стартовый пистолет с быстрой сменой обоймы на 12 патронов.'
  },
  revolver: {
    id: 'revolver', name: 'Револьвер «Магнум .44»', rarity: 'uncommon', tier: 1,
    sprite: 'revolver', icon: 'assets/sprites/weapons/revolver.png',
    category: 'gun', classLabel: 'Револьверы',
    ammoCost: 1, magSize: 6, reloadTime: 1.25,
    baseDamage: 48, cooldown: 0.42, range: 400, projSpeed: 880, spread: 0.02, pellets: 1, pierce: 1, critBonus: 0.25, knockback: 220, price: 195,
    desc: 'Шестизарядный тяжёлый револьвер: мощнейший останавливающий удар и +25% крита.'
  },
  autopistol: {
    id: 'autopistol', name: 'Авто-пистолет «Шершень»', rarity: 'rare', tier: 2,
    sprite: 'autopistol', icon: 'assets/sprites/weapons/autopistol.png',
    category: 'gun', classLabel: 'Пистолеты',
    ammoCost: 1, magSize: 20, reloadTime: 1.05,
    baseDamage: 21, cooldown: 0.13, range: 345, projSpeed: 780, spread: 0.09, pellets: 1, critBonus: 0.10, knockback: 85, price: 250,
    desc: 'Скорострельный автоматический пистолет спецназа на 20 патронов.'
  },

  // ── Пистолеты-пулемёты (3) ──────────────────────────────────────────
  smg_compact: {
    id: 'smg_compact', name: 'ПП «Вектор-9»', rarity: 'uncommon', tier: 2,
    sprite: 'smg_compact', icon: 'assets/sprites/weapons/smg_compact.png',
    category: 'gun', classLabel: 'Пистолеты-пулемёты',
    ammoCost: 1, magSize: 28, reloadTime: 1.15,
    baseDamage: 19, cooldown: 0.10, range: 340, projSpeed: 800, spread: 0.10, pellets: 1, critBonus: 0.10, knockback: 75, price: 240,
    desc: 'Бешеный темп огня на ближней и средней дистанции (обойма 28).'
  },
  smg_storm: {
    id: 'smg_storm', name: 'Штурмовой ПП «Вихрь»', rarity: 'rare', tier: 3,
    sprite: 'smg_storm', icon: 'assets/sprites/weapons/smg_storm.png',
    category: 'gun', classLabel: 'Пистолеты-пулемёты',
    ammoCost: 1, magSize: 36, reloadTime: 1.2,
    baseDamage: 25, cooldown: 0.10, range: 365, projSpeed: 830, spread: 0.08, pellets: 1, critBonus: 0.14, knockback: 90, price: 370,
    desc: 'Улучшенный ПП с барабаном на 36 патронов и высокой кучностью.'
  },
  smg_plasma: {
    id: 'smg_plasma', name: 'Плазменный ПП «Неон»', rarity: 'epic', tier: 4,
    sprite: 'smg_plasma', icon: 'assets/sprites/weapons/smg_plasma.png',
    category: 'gun', classLabel: 'Пистолеты-пулемёты',
    ammoCost: 1, magSize: 34, reloadTime: 1.1,
    baseDamage: 33, cooldown: 0.10, range: 380, projSpeed: 880, spread: 0.06, pellets: 1, critBonus: 0.18, knockback: 105, projColor: '#c084fc', price: 560,
    desc: 'Выпускает перегретые сгустки плазмы, прожигающие броню щитоносцев!'
  },

  // ── Дробовики (2) ───────────────────────────────────────────────────
  shotgun: {
    id: 'shotgun', name: 'Помповый Дробовик', rarity: 'rare', tier: 2,
    sprite: 'shotgun', icon: 'assets/sprites/weapons/shotgun.png',
    category: 'gun', classLabel: 'Дробовики',
    ammoCost: 2, magSize: 8, reloadTime: 1.45,
    baseDamage: 16, cooldown: 0.56, range: 260, projSpeed: 730, spread: 0.34, pellets: 5, critBonus: 0.09, knockback: 260, price: 280,
    desc: 'Веер из 5 крупных картечин: сносит группы зомби и мутантов в упор.'
  },
  auto_shotgun: {
    id: 'auto_shotgun', name: 'Авто-дробовик «Цербер»', rarity: 'epic', tier: 4,
    sprite: 'auto_shotgun', icon: 'assets/sprites/weapons/auto_shotgun.png',
    category: 'gun', classLabel: 'Дробовики',
    ammoCost: 2, magSize: 12, reloadTime: 1.5,
    baseDamage: 19, cooldown: 0.30, range: 275, projSpeed: 760, spread: 0.30, pellets: 6, critBonus: 0.12, knockback: 280, price: 590,
    desc: 'Барабанный штурмовой дробовик: 6 дробин каждые 0.3 секунды!'
  },

  // ── Штурмовые винтовки (3) ──────────────────────────────────────────
  rifle: {
    id: 'rifle', name: 'Автомат «Калаш-М»', rarity: 'rare', tier: 2,
    sprite: 'rifle', icon: 'assets/sprites/weapons/rifle.png',
    category: 'gun', classLabel: 'Штурмовые винтовки',
    ammoCost: 1, magSize: 30, reloadTime: 1.35,
    baseDamage: 26, cooldown: 0.13, range: 415, projSpeed: 860, spread: 0.07, pellets: 1, critBonus: 0.12, knockback: 110, price: 340,
    desc: 'Классическая штурмовая винтовка с отличным балансом урона и точности.'
  },
  burst_rifle: {
    id: 'burst_rifle', name: 'Карабин «Сокол-3»', rarity: 'rare', tier: 3,
    sprite: 'burst_rifle', icon: 'assets/sprites/weapons/burst_rifle.png',
    category: 'gun', classLabel: 'Штурмовые винтовки',
    ammoCost: 2, magSize: 24, reloadTime: 1.25,
    baseDamage: 24, cooldown: 0.32, range: 455, projSpeed: 930, spread: 0.05, pellets: 3, critBonus: 0.16, knockback: 135, price: 430,
    desc: 'Выпускает кучный залп из 3 экспансивных пуль одним нажатием!'
  },
  laser_rifle: {
    id: 'laser_rifle', name: 'Лазерная Винтовка «Луч-7»', rarity: 'epic', tier: 4,
    sprite: 'laser_rifle', icon: 'assets/sprites/weapons/laser_rifle.png',
    category: 'gun', classLabel: 'Штурмовые винтовки',
    ammoCost: 1, magSize: 28, reloadTime: 1.15,
    baseDamage: 38, cooldown: 0.14, range: 480, projSpeed: 1120, spread: 0.015, pellets: 1, pierce: 1, critBonus: 0.20, knockback: 120, projColor: '#22d3ee', price: 660,
    desc: 'Высокоточный фотонный луч почти без разброса, прошивающий врагов.'
  },

  // ── Снайперские винтовки (2) ────────────────────────────────────────
  sniper: {
    id: 'sniper', name: 'Снайперка «Коршун»', rarity: 'epic', tier: 3,
    sprite: 'sniper', icon: 'assets/sprites/weapons/sniper.png',
    category: 'gun', classLabel: 'Снайперские винтовки',
    ammoCost: 2, magSize: 6, reloadTime: 1.55,
    baseDamage: 96, cooldown: 0.72, range: 560, projSpeed: 1150, spread: 0.008, pellets: 1, pierce: 3, critBonus: 0.34, knockback: 290, price: 520,
    desc: 'Крупнокалиберная винтовка: пробивает 4 врагов насквозь (+34% крит).'
  },
  railgun: {
    id: 'railgun', name: 'Рельсотрон «Горизонт»', rarity: 'legendary', tier: 5,
    sprite: 'railgun', icon: 'assets/sprites/weapons/railgun.png',
    category: 'gun', classLabel: 'Снайперские винтовки',
    ammoCost: 3, magSize: 5, reloadTime: 1.6,
    baseDamage: 155, cooldown: 0.80, range: 620, projSpeed: 1380, spread: 0, pellets: 1, pierce: 6, critBonus: 0.42, knockback: 340, projColor: '#38bdf8', price: 980,
    desc: 'Электромагнитный гиперзвуковой снаряд, прошивающий всю линию врагов!'
  },

  // ── Пулемёты (2) ────────────────────────────────────────────────────
  lmg: {
    id: 'lmg', name: 'Пулемёт «Бастион»', rarity: 'epic', tier: 3,
    sprite: 'lmg', icon: 'assets/sprites/weapons/lmg.png',
    category: 'gun', classLabel: 'Пулемёты',
    ammoCost: 1, magSize: 50, reloadTime: 1.85,
    baseDamage: 29, cooldown: 0.11, range: 430, projSpeed: 880, spread: 0.09, pellets: 1, critBonus: 0.11, knockback: 145, price: 540,
    desc: 'Тяжёлый ручной пулемёт с коробкой на 50 патронов для сдерживания орд.'
  },
  minigun: {
    id: 'minigun', name: 'Миниган «Шквал»', rarity: 'legendary', tier: 5,
    sprite: 'minigun', icon: 'assets/sprites/weapons/minigun.png',
    category: 'gun', classLabel: 'Пулемёты',
    ammoCost: 1, magSize: 80, reloadTime: 2.1,
    baseDamage: 26, cooldown: 0.065, range: 410, projSpeed: 920, spread: 0.13, pellets: 1, critBonus: 0.14, knockback: 120, price: 950,
    desc: 'Шестиствольный ураган свинца: 15 выстрелов в секунду и лента на 80 патронов!'
  },

  // ── Взрывчатка и Специальные устройства (4) ─────────────────────────
  grenade_launcher: {
    id: 'grenade_launcher', name: 'Гранатомёт «Гром-6»', rarity: 'epic', tier: 3,
    sprite: 'grenade_launcher', icon: 'assets/sprites/weapons/grenade_launcher.png',
    category: 'explosive', classLabel: 'Взрывчатка',
    ammoCost: 2, magSize: 6, reloadTime: 1.65,
    baseDamage: 78, cooldown: 0.58, range: 390, projSpeed: 580, splashRadius: 96, critBonus: 0.15, knockback: 260, price: 610,
    desc: 'Барабанный гранатомёт: каждый выстрел взрывается огненной волной по площади!'
  },
  rocket_launcher: {
    id: 'rocket_launcher', name: 'Ракетница «Титан»', rarity: 'legendary', tier: 5,
    sprite: 'rocket_launcher', icon: 'assets/sprites/weapons/rocket_launcher.png',
    category: 'explosive', classLabel: 'Взрывчатка',
    ammoCost: 3, magSize: 3, reloadTime: 1.9,
    baseDamage: 140, cooldown: 0.85, range: 470, projSpeed: 640, splashRadius: 132, critBonus: 0.20, knockback: 340, price: 920,
    desc: 'Тяжёлый противотанковый ракетомёт с колоссальным радиусом взрыва!'
  },
  tesla_cannon: {
    id: 'tesla_cannon', name: 'Тесла-Излучатель «Разряд»', rarity: 'legendary', tier: 4,
    sprite: 'tesla_cannon', icon: 'assets/sprites/weapons/tesla_cannon.png',
    category: 'tesla', classLabel: 'Спецустройства',
    ammoCost: 1, magSize: 20, reloadTime: 1.4,
    baseDamage: 56, cooldown: 0.30, range: 350, chainCount: 4, critBonus: 0.22, knockback: 140, price: 820,
    desc: 'Бьёт дугой молнии, мгновенно перескакивающей сразу по 4 ближайшим врагам!'
  },
  magic_staff: {
    id: 'magic_staff', name: 'Эфирный Излучатель VEXMORA', rarity: 'legendary', tier: 5,
    sprite: 'magic_staff', icon: 'assets/sprites/weapons/magic_staff.png',
    category: 'magic', classLabel: 'Спецустройства',
    ammoCost: 0, magSize: 0, reloadTime: 0,
    baseDamage: 64, cooldown: 0.34, range: 430, projSpeed: 560, splashRadius: 82, critBonus: 0.22, knockback: 190, price: 1050,
    desc: 'Секретный прототип VEXMORA: самонаводящиеся сферы эфира без расхода патронов!'
  }
};

export const ITEMS = {
  medkit:   { id: 'medkit',   name: 'Аптечка',            icon: 'assets/sprites/items/medkit.png',   rarity: 'uncommon', price: 35,  desc: 'Мгновенно восстанавливает 55% макс. здоровья (+бонус Медблока).' },
  ammo:     { id: 'ammo',     name: 'Боекомплект (×24)',  icon: 'assets/sprites/items/ammo.png',     rarity: 'common',   price: 25,  desc: 'Пополняет запас патронов для всего стрелкового оружия и гранатомётов.' },
  grenade:  { id: 'grenade',  name: 'Осколочная граната', icon: 'assets/sprites/items/grenade.png',  rarity: 'rare',     price: 45,  desc: 'Мощный бросок по площади! Разносит укрытия, бочки и отряды врагов.' },
  food:     { id: 'food',     name: 'Армейский паёк',     icon: 'assets/sprites/items/food.png',     rarity: 'common',   price: 20,  desc: '+65 сытости, +22% HP и ускоренное восстановление выносливости.' },
  potion:   { id: 'potion',   name: 'Энерго-Стимулятор',  icon: 'assets/sprites/items/potion.png',   rarity: 'rare',     price: 55,  desc: '+35% HP, 100% стамины и силовой энергощит (-42% урона) на 12 сек.' },
  key:      { id: 'key',      name: 'Ключ-карта Доступа', icon: 'assets/sprites/items/key.png',      rarity: 'epic',     price: 105, desc: 'Отпирает клетки пленников, секретные Бункеры и закрытые Спецсклады.' },
  coin:     { id: 'coin',     name: 'Кредитная Монета',   icon: 'assets/sprites/items/coin.png',     rarity: 'common',   price: 1,   desc: 'Единая валюта выживших для торговли, развития Базы и модификаций.' },
  backpack: { id: 'backpack', name: 'Тактический Рюкзак', icon: 'assets/sprites/items/backpack.png', rarity: 'epic',     price: 180, desc: 'Навсегда расширяет боезапас (+70 патронов), +25 HP и +15% к трофеям!' }
};

export const RESOURCES = {
  wood:  { id: 'wood',  name: 'Стройматериалы', emoji: '🪵', color: '#b37646' },
  stone: { id: 'stone', name: 'Руда и порох',   emoji: '🪨', color: '#94a3b8' },
  scrap: { id: 'scrap', name: 'Техно-детали',   emoji: '⚙️', color: '#60a5fa' },
  herb:  { id: 'herb',  name: 'Био-экстракт',   emoji: '🌿', color: '#4ade80' }
};

export const RECIPES = [
  { id: 'rc_ammo',     resultId: 'ammo',     amount: 28, costCoins: 10, ingredients: { scrap: 2, stone: 1 }, desc: 'Собрать 28 патронов из техно-деталей и пороха.' },
  { id: 'rc_medkit',   resultId: 'medkit',   amount: 2,  costCoins: 12, ingredients: { herb: 3 },            desc: 'Синтезировать 2 полевые аптечки.' },
  { id: 'rc_food',     resultId: 'food',     amount: 2,  costCoins: 8,  ingredients: { herb: 2, wood: 1 },   desc: 'Приготовить 2 питательных армейских пайка.' },
  { id: 'rc_grenade',  resultId: 'grenade',  amount: 2,  costCoins: 20, ingredients: { scrap: 3, stone: 2 }, desc: 'Собрать 2 осколочные гранаты.' },
  { id: 'rc_potion',   resultId: 'potion',   amount: 1,  costCoins: 25, ingredients: { herb: 2, scrap: 2 },  desc: 'Создать Энерго-Стимулятор силового щита.' },
  { id: 'rc_key',      resultId: 'key',      amount: 1,  costCoins: 55, ingredients: { scrap: 4, stone: 3 }, desc: 'Собрать универсальную Ключ-карту для клеток и бункеров.' },
  { id: 'rc_revolver', weaponId: 'revolver', amount: 1,  costCoins: 95, ingredients: { scrap: 5, stone: 2 }, desc: 'Выковать тяжёлый Револьвер «Магнум .44».' },
  { id: 'rc_crossbow', weaponId: 'crossbow', amount: 1,  costCoins: 140, ingredients: { wood: 7, scrap: 4 }, desc: 'Собрать бронебойный Осадный Арбалет «Болт».' },
  { id: 'rc_smg',      weaponId: 'smg_compact', amount: 1, costCoins: 150, ingredients: { scrap: 7, stone: 3 }, desc: 'Собрать скорострельный ПП «Вектор-9».' },
  { id: 'rc_shotgun',  weaponId: 'shotgun',  amount: 1,  costCoins: 170, ingredients: { scrap: 8, wood: 4 }, desc: 'Собрать Помповый Дробовик.' },
  { id: 'rc_rifle',    weaponId: 'rifle',    amount: 1,  costCoins: 230, ingredients: { scrap: 11, stone: 5 }, desc: 'Собрать Автомат «Калаш-М».' },
  { id: 'rc_gl',       weaponId: 'grenade_launcher', amount: 1, costCoins: 380, ingredients: { scrap: 15, stone: 10 }, desc: 'Собрать барабанный Гранатомёт «Гром-6».' },
  { id: 'rc_backpack', resultId: 'backpack', amount: 1,  costCoins: 130, ingredients: { wood: 4, herb: 4, scrap: 4 }, desc: 'Сшить Тактический Рюкзак (+патроны и +25 HP).' }
];

// 3 активные боевые способности
export const SKILLS = {
  slash_wave: {
    id: 'slash_wave', keyLabel: '1', name: 'Ударная Волна', icon: '⚔️', color: '#f97316',
    baseCooldown: 6.0, staminaCost: 20, baseDamageMult: 2.1, radius: 112, unlockLevel: 1,
    desc: 'Мощный круговой импульс вокруг героя: отбрасывает врагов, сбивает броню и ломает ящики.'
  },
  magic_nova: {
    id: 'magic_nova', keyLabel: '2', name: 'ЭМИ-Шторм', icon: '🌀', color: '#2998ff',
    baseCooldown: 9.0, staminaCost: 24, baseDamageMult: 2.7, radius: 150, unlockLevel: 2,
    desc: 'Электромагнитный взрыв: наносит высокий урон, снимает маскировку охотников и оглушает врагов на 2 сек.'
  },
  adrenaline: {
    id: 'adrenaline', keyLabel: '3', name: 'Форсаж Выжившего', icon: '⚡', color: '#22c55e',
    baseCooldown: 13.0, staminaCost: 20, duration: 8.5, unlockLevel: 3,
    desc: 'Мгновенно перезаряжает оружие, лечит 25% HP, включает энергощит и ускоряет стрельбу!'
  }
};

// Дерево перков (3 ветки × 3 узла)
export const SKILL_TREE = [
  { id: 'perk_hollow_point', branch: 'Штурм',     name: 'Экспансивный калибр', icon: '🔫', maxRank: 3, desc: '+8% к урону всего огнестрельного и взрывного оружия за ранг.' },
  { id: 'perk_fast_hands',   branch: 'Штурм',     name: 'Ловкая перезарядка',  icon: '🔄', maxRank: 3, desc: '-15% ко времени перезарядки и +10% к темпу атаки за ранг.' },
  { id: 'perk_exec_crit',    branch: 'Штурм',     name: 'Точка уязвимости',    icon: '🎯', maxRank: 3, desc: '+5% к шансу крита и +15% урона по боссам и мини-боссам за ранг.' },
  { id: 'perk_kevlar',       branch: 'Защита',    name: 'Кевларовые пластины', icon: '🛡️', maxRank: 3, desc: '-8% получаемого урона и +30 к макс. здоровью за ранг.' },
  { id: 'perk_field_medic',  branch: 'Защита',    name: 'Полевая хирургия',    icon: '❤️', maxRank: 3, desc: '+15% к лечению аптечками и +25% к здоровью сопровождаемых NPC.' },
  { id: 'perk_second_wind',  branch: 'Защита',    name: 'Адреналиновый рывок', icon: '💨', maxRank: 3, desc: '-12% перезарядки Рывка и +15 к максимуму выносливости за ранг.' },
  { id: 'perk_scavenger',    branch: 'Выживание', name: 'Мародёр Зоны',        icon: '🎒', maxRank: 3, desc: '+15% находимых монет, патронов и техно-деталей за ранг.' },
  { id: 'perk_keymaster',    branch: 'Выживание', name: 'Дешифратор VEXMORA',  icon: '🗝️', maxRank: 3, desc: 'Шанс 15% за ранг не потратить Ключ-карту при открытии клетки или бункера!' },
  { id: 'perk_commander',    branch: 'Выживание', name: 'Тактика Отряда',      icon: '🤝', maxRank: 3, desc: '+25% к урону и скорострельности спасённого бойца-напарника за ранг.' }
];

// ── 16 УНИКАЛЬНЫХ ТИПОВ ПРОТИВНИКОВ ────────────────────────────────────
export const ENEMIES = {
  // 1. Обычный ближний бой
  zombie: {
    id: 'zombie', name: 'Зомби-шатун', sprite: 'zombie', role: 'Ближний бой',
    hp: 58, damage: 11, speed: 108, radius: 14, xp: 18, coins: [5, 11],
    behavior: 'melee',
    drops: [{ id: 'food', chance: 0.14 }, { id: 'medkit', chance: 0.10 }, { res: 'scrap', chance: 0.25 }]
  },
  // 2. Быстрый бандит ближнего боя
  bandit: {
    id: 'bandit', name: 'Мародёр с клинком', sprite: 'bandit', role: 'Ближний бой',
    hp: 92, damage: 17, speed: 142, radius: 15, xp: 30, coins: [10, 20],
    behavior: 'melee',
    drops: [{ id: 'ammo', chance: 0.40 }, { id: 'food', chance: 0.20 }, { res: 'scrap', chance: 0.35 }]
  },
  // 3. Быстрый преследователь с рывком
  infected_runner: {
    id: 'infected_runner', name: 'Бешеный бегун', sprite: 'runner', role: 'Быстрый преследователь',
    hp: 78, damage: 16, speed: 174, radius: 14, xp: 28, coins: [8, 16],
    behavior: 'dasher',
    drops: [{ id: 'medkit', chance: 0.16 }, { id: 'ammo', chance: 0.25 }]
  },
  // 4. Прыгающий мутант
  monster: {
    id: 'monster', name: 'Мутант-гончая', sprite: 'monster', role: 'Прыгающий хищник',
    hp: 132, damage: 23, speed: 168, radius: 17, xp: 45, coins: [14, 26],
    behavior: 'pouncer',
    drops: [{ id: 'food', chance: 0.50 }, { res: 'herb', chance: 0.40 }]
  },
  // 5. Наёмник-стрелок
  bandit_gunner: {
    id: 'bandit_gunner', name: 'Наёмник-стрелок', sprite: 'gunner', role: 'Стрелок',
    hp: 108, damage: 18, speed: 122, radius: 15, xp: 40, coins: [15, 28],
    behavior: 'shooter', attackRange: 290, projSpeed: 430,
    drops: [{ id: 'ammo', chance: 0.55 }, { id: 'grenade', chance: 0.16 }]
  },
  // 6. Штурмовик с очередями
  soldier: {
    id: 'soldier', name: 'Штурмовик VEXMORA', sprite: 'soldier', role: 'Очереди из автомата',
    hp: 175, damage: 25, speed: 128, radius: 15, xp: 64, coins: [22, 40],
    behavior: 'burst_shooter', attackRange: 325, projSpeed: 490,
    drops: [{ id: 'ammo', chance: 0.65 }, { id: 'grenade', chance: 0.25 }, { id: 'medkit', chance: 0.20 }]
  },
  // 7. Снайпер с лазерным прицелом
  sniper_guard: {
    id: 'sniper_guard', name: 'Снайпер-разведчик', sprite: 'sniper_enemy', role: 'Снайпер с лазером',
    hp: 145, damage: 42, speed: 114, radius: 15, xp: 76, coins: [26, 48],
    behavior: 'sniper', attackRange: 440, projSpeed: 760,
    drops: [{ id: 'ammo', chance: 0.70 }, { id: 'key', chance: 0.12 }]
  },
  // 8. Бронированный щитоносец
  heavy_trooper: {
    id: 'heavy_trooper', name: 'Бронированный Щитоносец', sprite: 'heavy_armor', role: 'Тяжёлая броня (-35% урона)',
    hp: 310, damage: 28, speed: 92, radius: 17, armorMult: 0.65, xp: 88, coins: [30, 54],
    behavior: 'shield_march', attackRange: 230, projSpeed: 420,
    drops: [{ id: 'ammo', chance: 0.65 }, { res: 'scrap', chance: 0.65 }, { id: 'potion', chance: 0.20 }]
  },
  // 9. Гренадёр
  grenadier: {
    id: 'grenadier', name: 'Подрывник-гренадёр', sprite: 'grenadier', role: 'Метатель гранат',
    hp: 155, damage: 34, speed: 116, radius: 15, xp: 72, coins: [24, 44],
    behavior: 'grenadier', attackRange: 310,
    drops: [{ id: 'grenade', chance: 0.55 }, { id: 'ammo', chance: 0.45 }, { res: 'stone', chance: 0.45 }]
  },
  // 10. Огнемётчик (взрывается при гибели)
  pyro_trooper: {
    id: 'pyro_trooper', name: 'Огнемётчик Химвойск', sprite: 'pyro', role: 'Пламя + взрыв баллона',
    hp: 165, damage: 22, speed: 124, radius: 15, explodeOnDeath: true, xp: 74, coins: [24, 45],
    behavior: 'pyro', attackRange: 175, projSpeed: 340,
    drops: [{ id: 'grenade', chance: 0.35 }, { res: 'scrap', chance: 0.50 }]
  },
  // 11. Невидимый охотник
  stealth_hunter: {
    id: 'stealth_hunter', name: 'Невидимый Охотник', sprite: 'stealth_hunter', role: 'Оптический камуфляж',
    hp: 140, damage: 32, speed: 178, radius: 14, stealth: true, xp: 82, coins: [28, 50],
    behavior: 'stealth_stalker',
    drops: [{ id: 'potion', chance: 0.28 }, { id: 'key', chance: 0.14 }, { res: 'scrap', chance: 0.45 }]
  },
  // 12. Кислотный мутант
  acid_spitter: {
    id: 'acid_spitter', name: 'Кислотный Мутант', sprite: 'spitter', role: 'Кислотный плевок',
    hp: 138, damage: 21, speed: 118, radius: 16, xp: 54, coins: [16, 30],
    behavior: 'acid_shooter', attackRange: 300, projSpeed: 400,
    drops: [{ res: 'herb', chance: 0.65 }, { id: 'potion', chance: 0.18 }]
  },
  // 13. Боевой Дрон-Скаут
  combat_drone: {
    id: 'combat_drone', name: 'Боевой Дрон-Скаут', sprite: 'drone', role: 'Летающий дрон',
    hp: 115, damage: 20, speed: 182, radius: 13, flying: true, xp: 62, coins: [20, 38],
    behavior: 'drone_strafe', attackRange: 300, projSpeed: 520,
    drops: [{ res: 'scrap', chance: 0.75 }, { id: 'ammo', chance: 0.45 }]
  },
  // 14. Полевой Техник-Медик врага
  enemy_medic: {
    id: 'enemy_medic', name: 'Полевой Медик Врага', sprite: 'medic_enemy', role: 'Лечит отряд врагов',
    hp: 135, damage: 18, speed: 126, radius: 15, xp: 68, coins: [22, 42],
    behavior: 'healer_support', attackRange: 270, projSpeed: 450,
    drops: [{ id: 'medkit', chance: 0.55 }, { id: 'potion', chance: 0.25 }]
  },
  // 15. Мини-босс: Надзиратель Камер
  mini_warden: {
    id: 'mini_warden', name: 'Надзиратель Камер', sprite: 'miniboss_warden', role: 'Мини-босс охраны',
    isMiniBoss: true, hp: 520, damage: 34, speed: 126, radius: 20, armorMult: 0.82, xp: 180, coins: [75, 115],
    behavior: 'miniboss_warden', attackRange: 250, projSpeed: 460,
    drops: [{ id: 'key', chance: 1.0 }, { id: 'medkit', chance: 0.80 }, { res: 'scrap', chance: 1.0 }]
  },
  // 16. Мини-босс: Кибер-Каратель
  mini_punisher: {
    id: 'mini_punisher', name: 'Кибер-Каратель', sprite: 'miniboss_punisher', role: 'Мини-босс спецхрана',
    isMiniBoss: true, hp: 680, damage: 38, speed: 120, radius: 21, armorMult: 0.78, xp: 240, coins: [95, 145],
    behavior: 'miniboss_punisher', attackRange: 320, projSpeed: 520,
    drops: [{ id: 'key', chance: 0.85 }, { id: 'ammo', chance: 1.0 }, { id: 'grenade', chance: 0.85 }]
  }
};

// ── 10 УНИКАЛЬНЫХ МНОГОФАЗНЫХ БОССОВ VEXMORA ───────────────────────────
export const BOSSES = {
  boss_mutant_king: {
    id: 'boss_mutant_king', order: 1,
    name: 'Король Мутантов «Морг»',
    title: 'Владыка Заражённой Чащи',
    sprite: 'boss_mutant_king',
    biome: 'forest', x: 1120, y: 2220, arenaRadius: 340,
    hp: 1350, damage: 28, speed: 130, radius: 28, xp: 360, coins: 260,
    rewardWeapon: 'shotgun',
    rewardItems: [{ id: 'key', count: 1 }, { id: 'ammo', count: 36 }],
    unlocksZone: 'Восточный Блокпост Города',
    desc: 'Прыгает с кислотными ударными кольцами и призывает стаю мутантов-гончих.'
  },
  boss_commander: {
    id: 'boss_commander', order: 2,
    name: 'Бронированный Командир «Бастион»',
    title: 'Начальник Гарнизона Мегаполиса',
    sprite: 'boss_commander',
    biome: 'city', x: 4860, y: 3220, arenaRadius: 350,
    hp: 1950, damage: 34, speed: 124, radius: 29, xp: 520, coins: 360,
    rewardWeapon: 'burst_rifle',
    rewardItems: [{ id: 'key', count: 1 }, { id: 'grenade', count: 3 }],
    unlocksZone: 'Промзона Химзавода',
    desc: 'Прикрывается силовым щитом, бросает кассетные гранаты и вызывает штурмовиков.'
  },
  boss_destroyer: {
    id: 'boss_destroyer', order: 3,
    name: 'Механический Разрушитель «Кron-X»',
    title: 'Осадная Машина Завода',
    sprite: 'boss_destroyer',
    biome: 'desert', x: 1160, y: 4920, arenaRadius: 360,
    hp: 2550, damage: 38, speed: 136, radius: 30, xp: 680, coins: 460,
    rewardWeapon: 'smg_storm',
    rewardItems: [{ id: 'backpack', count: 1 }, { id: 'ammo', count: 48 }],
    unlocksZone: 'Высотные Руины Снайпера',
    desc: 'Идёт на таран циркулярной пилой по линии предупреждения и накрывает арену миномётом.'
  },
  boss_sniper: {
    id: 'boss_sniper', order: 4,
    name: 'Снайпер-Охотник «Фантом»',
    title: 'Призрак Высотных Руин',
    sprite: 'boss_sniper',
    biome: 'city', x: 5620, y: 1920, arenaRadius: 370,
    hp: 2900, damage: 52, speed: 148, radius: 27, xp: 820, coins: 560,
    rewardWeapon: 'sniper',
    rewardItems: [{ id: 'key', count: 1 }, { id: 'potion', count: 2 }],
    unlocksZone: 'Южный Каньон Пустыни',
    desc: 'Наводит смертоносный лазерный луч, уходит в дымовую завесу и минирует подходы.'
  },
  boss_giant_beast: {
    id: 'boss_giant_beast', order: 5,
    name: 'Гигантский Зверь «Рагнарок»',
    title: 'Альфа-Хищник Песчаного Каньона',
    sprite: 'boss_giant_beast',
    biome: 'desert', x: 3560, y: 5680, arenaRadius: 370,
    hp: 3600, damage: 46, speed: 158, radius: 31, xp: 980, coins: 680,
    rewardWeapon: 'lmg',
    rewardItems: [{ id: 'backpack', count: 1 }, { id: 'food', count: 4 }],
    unlocksZone: 'Секретная Химлаборатория',
    desc: 'Совершает серию из трёх сокрушительных прыжков и сотрясает землю огненными волнами.'
  },
  boss_mad_scientist: {
    id: 'boss_mad_scientist', order: 6,
    name: 'Безумный Учёный Доктор Векс',
    title: 'Создатель Био-Мутагена',
    sprite: 'boss_mad_scientist',
    biome: 'desert', x: 2260, y: 5720, arenaRadius: 360,
    hp: 4100, damage: 48, speed: 134, radius: 28, xp: 1150, coins: 800,
    rewardWeapon: 'tesla_cannon',
    rewardItems: [{ id: 'key', count: 2 }, { id: 'potion', count: 3 }],
    unlocksZone: 'Ночной Квартал Теней',
    desc: 'Мечет колбы с кислотой и плазмой, включает энергокупол и выпускает боевых дронов.'
  },
  boss_shadow_assassin: {
    id: 'boss_shadow_assassin', order: 7,
    name: 'Теневой Убийца «Куро»',
    title: 'Клинок Ночного Сектора',
    sprite: 'boss_shadow_assassin',
    biome: 'mountains', x: 2320, y: 1120, arenaRadius: 360,
    hp: 4600, damage: 56, speed: 175, radius: 27, xp: 1350, coins: 950,
    rewardWeapon: 'katana',
    rewardItems: [{ id: 'potion', count: 3 }, { id: 'grenade', count: 4 }],
    unlocksZone: 'Техно-Ангар Боевых Роботов',
    desc: 'Исчезает в тени, мгновенно телепортируется за спину и мечет веера энергоклинков.'
  },
  boss_war_robot: {
    id: 'boss_war_robot', order: 8,
    name: 'Огромный Боевой Робот «ТИТАН-МК9»',
    title: 'Страж Техно-Ангара',
    sprite: 'boss_war_robot',
    biome: 'city', x: 5680, y: 4620, arenaRadius: 380,
    hp: 5500, damage: 58, speed: 128, radius: 33, xp: 1650, coins: 1200,
    rewardWeapon: 'laser_rifle',
    rewardItems: [{ id: 'backpack', count: 1 }, { id: 'ammo', count: 80 }],
    unlocksZone: 'Северный Штаб Армии',
    desc: 'Поливает арену сдвоенными пулемётами и накрывает зоны ракетными залпами!'
  },
  boss_general: {
    id: 'boss_general', order: 9,
    name: 'Генерал Вражеской Армии «Крайус»',
    title: 'Верховный Командующий Севера',
    sprite: 'boss_general',
    biome: 'mountains', x: 4320, y: 860, arenaRadius: 380,
    hp: 6600, damage: 64, speed: 144, radius: 31, xp: 2050, coins: 1550,
    rewardWeapon: 'minigun',
    rewardItems: [{ id: 'key', count: 2 }, { id: 'medkit', count: 4 }],
    unlocksZone: 'Цитадель Ядра VEXMORA',
    desc: 'Вызывает ковровую артподготовку по квадратам и командует элитной гвардией.'
  },
  boss_vexmora: {
    id: 'boss_vexmora', order: 10,
    name: 'АРХОНТ VEXMORA (Финальный Босс)',
    title: 'Сверхразум Проекта VEXMORA',
    sprite: 'boss_vexmora',
    biome: 'mountains', x: 5660, y: 760, arenaRadius: 410,
    hp: 8500, damage: 72, speed: 154, radius: 34, xp: 3500, coins: 3000,
    rewardWeapon: 'railgun',
    rewardItems: [{ id: 'backpack', count: 1 }, { id: 'potion', count: 5 }],
    unlocksZone: 'Полное освобождение Зоны VEXMORA',
    desc: '3 фазы боя: орбитальные удары, перекрёстные лучи, порталы подкреплений и сверхновая Эфира!'
  }
};

// ── 10 МИССИЙ СПАСЕНИЯ NPC И ВЫЖИВШИХ ──────────────────────────────────
// Типы: 'cage' (клетка + сигнализация + охрана), 'defend' (защита от волн),
// 'escort' (сопровождение до Убежища/лагеря), 'timed' (спасение на время!)
export const RESCUE_MISSIONS = [
  {
    id: 'res_engineer',
    name: 'Инженер Кай',
    role: 'Открывает Инженерный Цех и Модификации',
    type: 'cage',
    sprite: 'npc_engineer',
    x: 3780, y: 2920,
    hasAlarm: true,
    requiresKey: false, // первую клетку рядом со стартом можно вскрыть после зачистки охраны/сигнализации
    rewardCoins: 140, rewardXp: 150, rewardWeapon: 'revolver',
    desc: 'Отключи терминал сигнализации, перебей охрану и освободи Инженера Кая из клетки!'
  },
  {
    id: 'res_mechanic',
    name: 'Механик Рокко',
    role: 'Открывает Гараж и тюнинг машин',
    type: 'defend',
    sprite: 'npc_mechanic',
    x: 2440, y: 3920,
    waves: 2,
    rewardCoins: 170, rewardXp: 180, rewardItem: 'key',
    desc: 'Перевяжи раненого Механика Рокко на дороге и защити его от 2 волн мародёров!'
  },
  {
    id: 'res_fighter_1',
    name: 'Сержант Шрам',
    role: 'Боец-напарник для совместных рейдов',
    type: 'cage',
    sprite: 'npc_fighter',
    x: 4580, y: 2560,
    hasAlarm: true,
    requiresKey: true,
    rewardCoins: 200, rewardXp: 220, rewardWeapon: 'smg_compact',
    desc: 'Обезвредь сигнализацию тюремного блока в Городе и открой камеру Сержанта Ключ-картой!'
  },
  {
    id: 'res_escort_caravan',
    name: 'Караванщик Глеб',
    role: 'Пополняет Склад Ресурсов Базы',
    type: 'escort',
    sprite: 'npc_prisoner',
    x: 3680, y: 3680,
    destX: 3160, destY: 3240,
    rewardCoins: 230, rewardXp: 250, rewardItem: 'backpack',
    desc: 'Сопроводи выжившего караванщика Глеба живым до ворот Убежища VEXMORA!'
  },
  {
    id: 'res_timed_sapper',
    name: 'Сапёр Макс',
    role: 'Поставляет взрывчатку и гранаты',
    type: 'timed',
    timeLimit: 45,
    sprite: 'npc_fighter',
    x: 1960, y: 4420,
    rewardCoins: 260, rewardXp: 280, rewardWeapon: 'grenade_launcher',
    desc: 'Успей за 45 секунд уничтожить подрывников у Завода и разминировать клетку Сапёра!'
  },
  {
    id: 'res_defend_doctor',
    name: 'Полевой Хирург Артур',
    role: 'Усиливает Медблок Убежища',
    type: 'defend',
    sprite: 'npc_medic',
    x: 5120, y: 3560,
    waves: 2,
    rewardCoins: 250, rewardXp: 280, rewardItem: 'potion',
    desc: 'Защити раненого хирурга от натиска заражённых и стрелков в Городе!'
  },
  {
    id: 'res_cage_scout',
    name: 'Разведчица Ника',
    role: 'Раскрывает секретные хранилища',
    type: 'cage',
    sprite: 'npc_quest',
    x: 1680, y: 1620,
    hasAlarm: true,
    requiresKey: true,
    rewardCoins: 280, rewardXp: 320, rewardWeapon: 'crossbow',
    desc: 'Отключи сигнализацию лесного бункера и освободи Разведчицу из камеры Надзирателя!'
  },
  {
    id: 'res_escort_scientist',
    name: 'Физик Даниил',
    role: 'Ускоряет разработку энерго-оружия',
    type: 'escort',
    sprite: 'npc_engineer',
    x: 2420, y: 4860,
    destX: 1860, destY: 4680,
    rewardCoins: 320, rewardXp: 360, rewardWeapon: 'smg_plasma',
    desc: 'Прикрой учёного-перебежчика на пути до безопасного Аванпоста Промзоны!'
  },
  {
    id: 'res_timed_pilot',
    name: 'Пилот Вера',
    role: 'Координатор воздушной разведки',
    type: 'timed',
    timeLimit: 50,
    sprite: 'npc_fighter',
    x: 4920, y: 1580,
    rewardCoins: 380, rewardXp: 420, rewardWeapon: 'auto_shotgun',
    desc: 'Прорвись к сбитому вертолёту за 50 секунд и спаси Пилота Веру от спецназа!'
  },
  {
    id: 'res_cage_veteran',
    name: 'Ветеран «Титан»',
    role: 'Элитный инструктор Казармы',
    type: 'cage',
    sprite: 'npc_fighter',
    x: 3780, y: 1180,
    hasAlarm: true,
    requiresKey: true,
    rewardCoins: 450, rewardXp: 500, rewardWeapon: 'rocket_launcher',
    desc: 'Штурмуй северный изолятор в Горах, отключи тревогу и освободи Ветерана!'
  }
];

// Секретные комнаты, бункеры и скрытые хранилища
export const SECRETS = [
  {
    id: 'sec_bunker_west',
    name: 'Секретный Бункер «Альфа-7»',
    hint: 'Открой гермодверь Бункера на северо-западе Леса Ключ-картой',
    x: 1380, y: 1380, requiresKey: true,
    rewardWeapon: 'rifle',
    rewardMod: 'mod_scope',
    rewardItems: [{ id: 'backpack', count: 1 }, { id: 'ammo', count: 48 }],
    coins: 240
  },
  {
    id: 'sec_warehouse_city',
    name: 'Оружейная Спецсклада Полиции',
    hint: 'Вскрой запертый Склад в Мегаполисе Ключ-картой',
    x: 4980, y: 2420, requiresKey: true,
    rewardWeapon: 'autopistol',
    rewardMod: 'mod_mag',
    rewardItems: [{ id: 'ammo', count: 60 }, { id: 'grenade', count: 4 }],
    coins: 260
  },
  {
    id: 'sec_bunker_desert',
    name: 'Подземное Хранилище Лаборатории',
    hint: 'Найди занесённый песком Бункер на юге Пустыни (нужна Ключ-карта)',
    x: 2820, y: 5860, requiresKey: true,
    rewardWeapon: 'smg_plasma',
    rewardMod: 'mod_cryo',
    rewardItems: [{ id: 'potion', count: 3 }, { id: 'backpack', count: 1 }],
    coins: 380
  },
  {
    id: 'sec_island_stash',
    name: 'Тайник Острова Контрабандистов',
    hint: 'Перепрыгни по каменным плитам через реку на юго-востоке Леса!',
    x: 4080, y: 4860, requiresKey: false,
    rewardWeapon: 'magic_staff',
    rewardMod: 'mod_vamp',
    rewardItems: [{ id: 'key', count: 2 }, { id: 'grenade', count: 3 }],
    coins: 420
  },
  {
    id: 'sec_mountain_vault',
    name: 'Секретный Арсенал Цитадели',
    hint: 'Вскрой бронированный бункер в Снежных Горах Ключ-картой',
    x: 5180, y: 980, requiresKey: true,
    rewardWeapon: 'rocket_launcher',
    rewardMod: 'mod_barrel',
    rewardItems: [{ id: 'ammo', count: 90 }, { id: 'medkit', count: 4 }],
    coins: 550
  }
];

// Шаблоны повторяемых динамических заданий и событий
export const MISSION_TEMPLATES = [
  { type: 'clear_outpost',   icon: '🏴', title: 'Зачистка вражеской базы',      desc: 'Уничтожь гарнизон противника в указанном секторе.' },
  { type: 'hunt_commander',  icon: '💀', title: 'Уничтожение командира',        desc: 'Выследи и ликвидируй элитного мини-босса с охраной.' },
  { type: 'free_captive',    icon: '🗝️', title: 'Срочное освобождение пленных', desc: 'Перебей конвой и освободи захваченного выжившего.' },
  { type: 'escort_survivor', icon: '🛡️', title: 'Охрана каравана выживших',     desc: 'Защити группу снабжения от налёта рейдеров.' },
  { type: 'weapon_cache',    icon: '📦', title: 'Поиск редкого вооружения',     desc: 'Пробейся через охрану Кибер-Карателя и забери спецконтейнер.' },
  { type: 'base_defense',    icon: '🚨', title: 'Отражение штурма Убежища',     desc: 'Вражеский отряд атакует Убежище VEXMORA — защити периметр Базы!' }
];

// Главная сюжетная линия VEXMORA
export const QUESTS = [
  {
    id: 'q_start',
    title: 'Пробуждение в Зоне VEXMORA',
    desc: 'Уничтожь 6 врагов вокруг Убежища и собери припасы из 4 ящиков, бочек или деревьев.',
    targetPos: { x: 3480, y: 3320 },
    goals: [
      { kind: 'kills', target: 6, label: 'Врагов уничтожено' },
      { kind: 'gather', target: 4, label: 'Добыто ящиков / ресурсов' }
    ],
    rewards: { xp: 110, coins: 100, items: [{ id: 'ammo', count: 36 }, { id: 'key', count: 1 }] }
  },
  {
    id: 'q_rescue_first',
    title: 'Спасение Инженера Базы',
    desc: 'Найди тюремную клетку на востоке Леса, отключи сигнализацию и спаси Инженера Кая (или любого выжившего)!',
    targetPos: { x: 3780, y: 2920 },
    goals: [
      { kind: 'rescue', target: 1, label: 'Спасено выживших' }
    ],
    rewards: { xp: 200, coins: 160, items: [{ id: 'medkit', count: 2 }, { id: 'key', count: 1 }] }
  },
  {
    id: 'q_upgrade_base',
    title: 'Укрепление Убежища VEXMORA',
    desc: 'Открой вкладку «🏰 База» и улучши любой отсек Убежища для усиления героя.',
    targetPos: { x: 3160, y: 3180 },
    goals: [
      { kind: 'base_upgrade', target: 1, label: 'Улучшено отсеков Базы' }
    ],
    rewards: { xp: 220, coins: 180, items: [{ id: 'ammo', count: 48 }, { id: 'grenade', count: 3 }] }
  },
  {
    id: 'q_boss_1',
    title: 'Король Заражённой Чащи',
    desc: 'Отправляйся на запад Леса и сокруши первого босса — Короля Мутантов «Морга»!',
    targetPos: { x: 1120, y: 2220 },
    goals: [
      { kind: 'boss', bossId: 'boss_mutant_king', target: 1, label: 'Король Мутантов повержен' }
    ],
    rewards: { xp: 420, coins: 300, items: [{ id: 'key', count: 1 }, { id: 'potion', count: 2 }] }
  },
  {
    id: 'q_boss_2',
    title: 'Прорыв Блокады Мегаполиса',
    desc: 'Войди в Заброшенный Мегаполис на востоке, спаси ещё выживших и победи Бронированного Командира!',
    targetPos: { x: 4860, y: 3220 },
    goals: [
      { kind: 'rescue_total', target: 3, label: 'Всего спасено людей' },
      { kind: 'boss', bossId: 'boss_commander', target: 1, label: 'Бронированный Командир повержен' }
    ],
    rewards: { xp: 600, coins: 420, items: [{ id: 'backpack', count: 1 }, { id: 'ammo', count: 60 }] }
  },
  {
    id: 'q_boss_3_4',
    title: 'Охота на Машины и Призраков',
    desc: 'Уничтожь Механического Разрушителя на Заводе и Снайпера-Охотника в северных руинах Города.',
    targetPos: { x: 1160, y: 4920 },
    goals: [
      { kind: 'boss', bossId: 'boss_destroyer', target: 1, label: 'Механический Разрушитель' },
      { kind: 'boss', bossId: 'boss_sniper', target: 1, label: 'Снайпер-Охотник' }
    ],
    rewards: { xp: 950, coins: 680, items: [{ id: 'key', count: 2 }, { id: 'grenade', count: 4 }] }
  },
  {
    id: 'q_boss_5_6',
    title: 'Тайны Южного Каньона',
    desc: 'Победи Гигантского Зверя и Безумного Учёного Доктора Векса на юге Пустыни.',
    targetPos: { x: 3560, y: 5680 },
    goals: [
      { kind: 'boss', bossId: 'boss_giant_beast', target: 1, label: 'Гигантский Зверь' },
      { kind: 'boss', bossId: 'boss_mad_scientist', target: 1, label: 'Безумный Учёный' }
    ],
    rewards: { xp: 1400, coins: 950, items: [{ id: 'potion', count: 3 }, { id: 'ammo', count: 90 }] }
  },
  {
    id: 'q_boss_7_8_9',
    title: 'Железный Кулак Империи',
    desc: 'Сокруши Теневого Убийцу, Огромного Боевого Робота и Генерала Вражеской Армии!',
    targetPos: { x: 5680, y: 4620 },
    goals: [
      { kind: 'boss', bossId: 'boss_shadow_assassin', target: 1, label: 'Теневой Убийца' },
      { kind: 'boss', bossId: 'boss_war_robot', target: 1, label: 'Огромный Боевой Робот' },
      { kind: 'boss', bossId: 'boss_general', target: 1, label: 'Генерал Вражеской Армии' }
    ],
    rewards: { xp: 2400, coins: 1800, items: [{ id: 'key', count: 2 }, { id: 'medkit', count: 5 }] }
  },
  {
    id: 'q_final_vexmora',
    title: 'ФИНАЛ: Падение Ядра VEXMORA',
    desc: 'Штурмуй северную Цитадель Хребта и уничтожь финального босса — АРХОНТА VEXMORA!',
    targetPos: { x: 5660, y: 760 },
    goals: [
      { kind: 'boss', bossId: 'boss_vexmora', target: 1, label: 'АРХОНТ VEXMORA уничтожен' }
    ],
    rewards: { xp: 5000, coins: 3500, items: [{ id: 'potion', count: 5 }] }
  }
];

export const ACHIEVEMENTS = [
  { id: 'ach_kill_1',      name: 'Первый Контакт',      icon: '🔫', desc: 'Уничтожить первого врага.',                   reward: 40,   check: (s) => s.stats.totalKills >= 1 },
  { id: 'ach_kill_75',     name: 'Чистильщик Сектора',  icon: '💀', desc: 'Уничтожить 75 противников.',                  reward: 180,  check: (s) => s.stats.totalKills >= 75 },
  { id: 'ach_kill_250',    name: 'Гроза Легиона',       icon: '🔥', desc: 'Уничтожить 250 противников.',                 reward: 450,  check: (s) => s.stats.totalKills >= 250 },
  { id: 'ach_rescue_1',    name: 'Спаситель',           icon: '🆘', desc: 'Спасти первого выжившего или пленника.',      reward: 100,  check: (s) => s.rescuedIds.length >= 1 },
  { id: 'ach_rescue_5',    name: 'Надежда Выживших',    icon: '🤝', desc: 'Спасти 5 выживших для Убежища.',              reward: 300,  check: (s) => s.rescuedIds.length >= 5 },
  { id: 'ach_rescue_all',  name: 'Герой Людей',         icon: '🌟', desc: 'Спасти всех 10 пленников и выживших!',        reward: 800,  check: (s) => s.rescuedIds.length >= 10 },
  { id: 'ach_base_5',      name: 'Архитектор Базы',     icon: '🏰', desc: 'Прокачать отсеки Убежища суммарно 5 раз.',    reward: 250,  check: (s) => Object.values(s.baseLevels).reduce((a, b) => a + b, 0) >= 10 },
  { id: 'ach_mod_1',       name: 'Оружейный Тюнинг',    icon: '🔧', desc: 'Установить боевую модификацию на оружие.',    reward: 150,  check: (s) => Object.keys(s.weaponMods).length >= 1 },
  { id: 'ach_arsenal_10',  name: 'Коллекционер Стволов',icon: '🎒', desc: 'Собрать 10 видов оружия в арсенале.',         reward: 320,  check: (s) => s.inventory.weapons.length >= 10 },
  { id: 'ach_arsenal_20',  name: 'Мастер Арсенала',     icon: '👑', desc: 'Собрать 20 видов оружия VEXMORA!',            reward: 900,  check: (s) => s.inventory.weapons.length >= 20 },
  { id: 'ach_grenadier',   name: 'Взрывотехник',        icon: '💣', desc: 'Устроить 5 взрывов гранат, ракет или бочек.', reward: 120,  check: (s) => (s.stats.explosionsTriggered || 0) >= 5 },
  { id: 'ach_driver',      name: 'Бронеход',            icon: '🚗', desc: 'Сесть за руль транспорта в рейде.',           reward: 100,  check: (s) => (s.stats.droveVehicle || 0) >= 1 },
  { id: 'ach_contracts_3', name: 'Оперативник',         icon: '🎯', desc: 'Выполнить 3 спецоперации или обороны Базы.',  reward: 260,  check: (s) => (s.stats.contractsDone || 0) >= 3 },
  { id: 'ach_secret_all',  name: 'Взломщик VEXMORA',    icon: '🗝️', desc: 'Вскрыть все 5 секретных бункеров и складов!', reward: 650,  check: (s) => s.discoveredSecrets.length >= 5 },
  { id: 'ach_boss_1',      name: 'Убийца Чудовищ',      icon: '🦠', desc: 'Победить Короля Мутантов.',                   reward: 220,  check: (s) => s.defeatedBosses.includes('boss_mutant_king') },
  { id: 'ach_boss_5',      name: 'Сокрушитель Титанов', icon: '⚔️', desc: 'Победить 5 уникальных боссов VEXMORA.',       reward: 650,  check: (s) => s.defeatedBosses.length >= 5 },
  { id: 'ach_boss_10',     name: 'ЛЕГЕНДА VEXMORA',     icon: '🏆', desc: 'Победить всех 10 боссов и Архонта VEXMORA!',  reward: 2000, check: (s) => s.defeatedBosses.length >= 10 }
];
