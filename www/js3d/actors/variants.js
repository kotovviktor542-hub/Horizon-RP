// VEXMORA 3D — вариативность врагов и NPC.
// Ремарк: до этого 40+ видов врагов делились на 7 силуэтов, и внутри силуэта
// модели были почти идентичны (зомби = тролль = гоблин). Здесь считается
// «сборка» конкретного вида: набор деталей, надетых на общий скелет.
// Наборы деталей детерминированы по id, поэтому модель врага не «дрожит»
// между перезагрузками, а разные враги одного класса выглядят по-разному.

// Простейший детерминированный хеш (FNV-1a), чтобы по id получить числа.
export function hashId(id = '') {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0);
}

export function rnd01(id, salt = 0) {
  const h = hashId(`${id}#${salt}`);
  // перемешиваем биты, чтобы соседние salt не давали похожих чисел
  const x = Math.imul(h ^ (h >>> 15), 2246822519);
  return ((x ^ (x >>> 13)) >>> 0) / 4294967296;
}

const has = (id, re) => re.test(id);

/**
 * Детали, которые нужно надеть на гуманоидный скелет.
 * @param {object} def — описание врага (id, isBoss)
 * @returns {object} флаги деталей
 */
export function humanoidVariation(def = {}) {
  const id = (def.id || '').toLowerCase();
  return {
    id,
    // Родственные семейства
    undead: has(id, /zombie|skeleton|crypt|revenant|bone|litch|plague|tomb/),
    armored: has(id, /soldier|trooper|sniper|gunner|grenadier|medic|warden|punisher|heavy|guard|knight|commander|sentry/),
    raider: has(id, /bandit|duelist|archer|hunter|assassin|killer|marauder|thief/),
    arcane: has(id, /mage|warlock|cultist|shaman|druid|necro|abyss/),
    mutant: has(id, /mutant|infected|runner|spitter|bearer|troll|giant|ogre|brute/),
    // Детали
    helmet: has(id, /soldier|trooper|sniper|gunner|grenadier|medic|knight|guard|warden|punisher|heavy|commander|sentinel/),
    hood: has(id, /mage|warlock|cultist|shaman|druid|necro|assassin|killer|shadow|wraith|archer|hunter/),
    cloak: has(id, /commander|cultist|warlock|shadow|assassin|hunter|knight|warden|chieftain/),
    pauldrons: has(id, /heavy|commander|knight|warden|punisher|guard|brute|ogre|troll/),
    backpack: has(id, /medic|grenadier|sniper|scout|engineer|bandit|hunter|pyro/),
    bandolier: has(id, /gunner|grenadier|sniper|bandit|raider|pyro/),
    mask: has(id, /pyro|plague|acid|spitter|grenadier|sniper/),
    // Случайные, но стабильные признаки
    hair: !has(id, /skeleton|crypt|knight|heavy|warden|drone|robot/) && rnd01(id, 1) > 0.45,
    beard: !has(id, /skeleton|crypt/) && rnd01(id, 2) > 0.72,
    scar: rnd01(id, 3) > 0.7,
    // «Толщина» тела: тяжеловесы шире, бегуны — жилистые
    bulk: has(id, /heavy|brute|ogre|troll|giant|warden/) ? 1.28
      : has(id, /runner|assassin|killer|archer|scout|skeleton/) ? 0.86
        : 1.0,
    // Комплекция по росту
    height: has(id, /troll|giant|ogre|brute|warden/) ? 1.22
      : has(id, /goblin|imp|runner|scout|hunter/) ? 0.9 : 1.0
  };
}

/**
 * Детали для дронов, чтобы «боевой», «снайперский» и «медицинский» дроны
 * отличались не только цветом.
 */
export function droneVariation(def = {}) {
  const id = (def.id || '').toLowerCase();
  return {
    heavy: has(id, /heavy|punisher|warden|bomber/),
    recon: has(id, /scout|sniper|recon|spy/),
    support: has(id, /medic|support|repair|supply/),
    weapon: has(id, /combat/) || !has(id, /scout|sniper|medic/)
  };
}

/**
 * Палитра для мутантов/животных врагов: тёмные подпалины, светлое брюхо —
 * чтобы стая не выглядела клонами.
 */
export function variantTint(baseColor, id, spread = 0.14) {
  const k = 1 + (rnd01(id, 7) - 0.5) * spread * 2;
  const r = Math.min(1, Math.max(0, ((baseColor >> 16) & 255) / 255 * k));
  const g = Math.min(1, Math.max(0, ((baseColor >> 8) & 255) / 255 * k));
  const b = Math.min(1, Math.max(0, (baseColor & 255) / 255 * k));
  // Небольшой сдвиг в тёплый/холодный оттенок
  const warm = (rnd01(id, 8) - 0.5) * 0.12;
  return ((Math.round(Math.min(1, Math.max(0, r + warm)) * 255) << 16) |
    (Math.round(g * 255) << 8) |
    Math.round(Math.min(1, Math.max(0, b - warm)) * 255));
}
