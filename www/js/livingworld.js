// VEXMORA — OPEN WORLD: живая природа.
// Животные, нейтральные NPC и случайные встречи — отдельный слой поверх
// существующего движка. Сознательно НЕ добавляет survival-механику: животное
// можно выследить и добыть, но они не «голод» и не ресурсная обязанность.
//
// Список животных вынесен в данные (ANIMALS в data.js) и живёт по тем же
// правилам, что враги: у каждого есть hp, скорость, поведение и добыча.

export const ANIMAL_BEHAVIOR = {
  graze: 'graze',      // мирные: пасутся, убегают от игрока и хищников
  herd: 'herd',        // стадные: держатся группой, разбегаются вместе
  predator: 'predator',// хищники: охотятся на мирных животных, нападают при защите
  skittish: 'skittish' // пугливые: замечают издалека и спасаются бегством
};

/**
 * Живой мир: животные и нейтральные NPC.
 * Методы вызываются движком из основного тика, своего таймера не заводят.
 */
export class LivingWorld {
  constructor(engine) {
    this.engine = engine;
    this.animals = [];
    this.travelers = [];        // нейтральные NPC (путники, охотники, торговцы)
    this.encounters = [];       // активные случайные встречи
    this.eventTimer = 26 + Math.random() * 20;
    this.npcTimer = 40 + Math.random() * 30;
    this.spawnTimer = 1.2;
    this.onEncounter = null;    // колбэк для HUD/озвучивания (задаёт движок)
    this.maxAnimals = 26;
    this.spawnedOnce = false;
  }

  reset() {
    this.animals.length = 0;
    this.travelers.length = 0;
    this.encounters.length = 0;
    this.spawnedOnce = false;
    this.eventTimer = 26 + Math.random() * 20;
    this.npcTimer = 40 + Math.random() * 30;
    this.spawnTimer = 0.6;
  }

  // ── Популяция животных вокруг героя ────────────────────────────────────
  // Животные не спавнятся за спиной игрока: они появляются в биомах, где
  // их «дом» — так лиса не возникает в пустыне, а козёл в болоте.
  update(dt) {
    const e = this.engine;
    const p = e.player;
    if (p.dead) return;

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 2.6;
      this._cullFar(p);
      if (this.animals.length < this.maxAnimals) this._spawnNear(p);
    }

    this._updateAnimals(dt, p);
    this._updateTravelers(dt, p);

    this.eventTimer -= dt;
    if (this.eventTimer <= 0) {
      this.eventTimer = 70 + Math.random() * 60;
      this._maybeRandomEncounter(p);
    }

    this.npcTimer -= dt;
    if (this.npcTimer <= 0) {
      this.npcTimer = 90 + Math.random() * 80;
      this._maybeSpawnTraveler(p);
    }
  }

  _cullFar(p) {
    for (let i = this.animals.length - 1; i >= 0; i--) {
      const a = this.animals[i];
      if (Math.hypot(a.x - p.x, a.y - p.y) > 1100) this.animals.splice(i, 1);
    }
  }

  _spawnNear(p) {
    const e = this.engine;
    const defs = e.animalDefs || [];
    if (!defs.length) return;
    for (let attempt = 0; attempt < 12; attempt++) {
      // Животные появляются в зоне видимости, но не «из-под ног»:
      // 320–620 world-единиц = 32–62 м от героя.
      const ang = Math.random() * Math.PI * 2;
      const dist = 320 + Math.random() * 300;
      const x = p.x + Math.cos(ang) * dist;
      const y = p.y + Math.sin(ang) * dist;
      if (x < 200 || y < 200 || x > e.world.width - 200 || y > e.world.height - 200) continue;
      const terr = e.terrainAt(x, y);
      if (terr.water) continue;
      const candidates = defs.filter(d => !d.biomes || d.biomes.includes(terr.biome));
      if (!candidates.length) continue;
      const def = candidates[Math.floor(Math.random() * candidates.length)];
      const herd = def.herd ? 2 + Math.floor(Math.random() * 3) : 1;
      for (let k = 0; k < herd; k++) {
        const ax = x + (Math.random() - 0.5) * 90;
        const ay = y + (Math.random() - 0.5) * 90;
        if (e.terrainAt(ax, ay).water) continue;
        this.animals.push({
          id: `an_${Math.random().toString(36).slice(2, 8)}`,
          defId: def.id,
          kind: def.id,
          name: def.name,
          behavior: def.behavior || ANIMAL_BEHAVIOR.graze,
          x: ax, y: ay,
          homeX: ax, homeY: ay,
          vx: 0, vy: 0,
          facing: Math.random() * Math.PI * 2,
          hp: def.hp, maxHp: def.hp,
          radius: def.radius || 11,
          speed: def.speed || 70,
          fleeSpeed: def.fleeSpeed || (def.speed || 70) * 1.9,
          animTime: Math.random() * 10,
          state: 'idle',
          stateTimer: 1 + Math.random() * 3,
          alert: 0,
          hitFlash: 0,
          dead: false,
          loot: def.loot || null,
          xp: def.xp || 2
        });
      }
      return;
    }
  }

  _updateAnimals(dt, p) {
    const e = this.engine;
    const px = p.x, py = p.y;
    for (let i = this.animals.length - 1; i >= 0; i--) {
      const a = this.animals[i];
      a.animTime += dt * (a.state === 'flee' ? 9 : 4);
      if (a.hitFlash > 0) a.hitFlash = Math.max(0, a.hitFlash - dt);

      const dP = Math.hypot(px - a.x, py - a.y);

      // Хищники замечают героя и бросаются, только если он близко и ранен,
      // либо если хищник сам «охотится» на мирную живность рядом.
      if (a.behavior === ANIMAL_BEHAVIOR.predator) {
        if (dP < 260 && (p.hp < p.maxHp * 0.5 || a.alert > 0)) {
          a.alert = 1;
          a.state = 'chase';
        } else if (dP < 150 && a.alert <= 0) {
          a.state = 'chase';
          a.alert = 1;
        }
      } else if (dP < (a.behavior === ANIMAL_BEHAVIOR.skittish ? 330 : 220)) {
        a.state = 'flee';
      }

      if (a.state === 'flee') {
        const dx = a.x - px, dy = a.y - py;
        const d = Math.hypot(dx, dy) || 1;
        a.vx = (dx / d) * a.fleeSpeed;
        a.vy = (dy / d) * a.fleeSpeed;
      } else if (a.state === 'chase') {
        const dx = px - a.x, dy = py - a.y;
        const d = Math.hypot(dx, dy) || 1;
        a.vx = (dx / d) * a.speed * 1.25;
        a.vy = (dy / d) * a.speed * 1.25;
        // Укус хищника
        a.attackCd = Math.max(0, (a.attackCd || 0) - dt);
        if (d < a.radius + p.radius + 8 && a.attackCd <= 0) {
          a.attackCd = 1.6;
          e.damagePlayer(Math.round(4 + (a.defId.includes('wolf') ? 6 : 2)));
          this.onEncounter?.('animal_hit', a);
        }
        if (d > 600) { a.state = 'idle'; a.alert = 0; }
      } else {
        // Спокойное поведение: пасётся у дома, иногда переходит на новое место
        a.stateTimer -= dt;
        if (a.stateTimer <= 0) {
          a.stateTimer = 2 + Math.random() * 4;
          a.state = Math.random() < 0.35 ? 'walk' : 'idle';
          if (a.state === 'walk') {
            const ang = Math.random() * Math.PI * 2;
            a.tx = a.homeX + Math.cos(ang) * (40 + Math.random() * 120);
            a.ty = a.homeY + Math.sin(ang) * (40 + Math.random() * 120);
          }
        }
        if (a.state === 'walk' && a.tx !== undefined) {
          const dx = a.tx - a.x, dy = a.ty - a.y;
          const d = Math.hypot(dx, dy) || 1;
          if (d < 8) { a.state = 'idle'; a.vx = 0; a.vy = 0; }
          else { a.vx = (dx / d) * a.speed * 0.42; a.vy = (dy / d) * a.speed * 0.42; }
        } else {
          a.vx *= 0.85; a.vy *= 0.85;
        }
      }

      a.x += a.vx * dt;
      a.y += a.vy * dt;
      if (Math.abs(a.vx) + Math.abs(a.vy) > 1) a.facing = Math.atan2(a.vy, a.vx);

      // Животные не входят в воду и в стены: мягкий разворот
      const terr = e.terrainAt(a.x, a.y);
      if (terr.water) { a.x -= a.vx * dt * 1.2; a.y -= a.vy * dt * 1.2; a.vx *= -0.4; a.vy *= -0.4; }
    }
  }

  // ── Нейтральные NPC ────────────────────────────────────────────────────
  // Путники бродят по дорогам и иногда могут поделиться припасами.
  _maybeSpawnTraveler(p) {
    if (this.travelers.length >= 3) return;
    const e = this.engine;
    const kinds = e.travelerDefs || [];
    if (!kinds.length) return;
    const ang = Math.random() * Math.PI * 2;
    const dist = 500 + Math.random() * 500;
    const x = p.x + Math.cos(ang) * dist;
    const y = p.y + Math.sin(ang) * dist;
    if (x < 300 || y < 300 || x > e.world.width - 300 || y > e.world.height - 300) return;
    if (e.terrainAt(x, y).water) return;
    const def = kinds[Math.floor(Math.random() * kinds.length)];
    this.travelers.push({
      id: `tv_${Math.random().toString(36).slice(2, 8)}`,
      defId: def.id,
      name: def.name,
      greeting: def.greeting,
      x, y,
      vx: 0, vy: 0,
      facing: Math.random() * Math.PI * 2,
      radius: 13,
      speed: 55,
      hp: 120,
      state: 'wander',
      stateTimer: 2,
      animTime: 0,
      talked: false,
      gift: def.gift || null,
      timer: 180
    });
  }

  _updateTravelers(dt, p) {
    for (let i = this.travelers.length - 1; i >= 0; i--) {
      const t = this.travelers[i];
      t.animTime += dt * 5;
      t.timer -= dt;
      const dP = Math.hypot(p.x - t.x, p.y - t.y);
      // Путник уходит, если игрок далеко и время истекло
      if ((dP > 1400 && t.timer < 120) || t.timer <= 0) { this.travelers.splice(i, 1); continue; }
      // При приближении героя путник останавливается и ждёт (можно поговорить)
      if (dP < 150) {
        t.state = 'wait';
        t.vx = 0; t.vy = 0;
        t.facing = Math.atan2(p.y - t.y, p.x - t.x);
        continue;
      }
      t.stateTimer -= dt;
      if (t.stateTimer <= 0) {
        t.stateTimer = 3 + Math.random() * 4;
        const ang = Math.random() * Math.PI * 2;
        t.tx = t.x + Math.cos(ang) * 220;
        t.ty = t.y + Math.sin(ang) * 220;
      }
      if (t.tx !== undefined) {
        const dx = t.tx - t.x, dy = t.ty - t.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d > 10) {
          t.vx = (dx / d) * t.speed;
          t.vy = (dy / d) * t.speed;
          t.facing = Math.atan2(t.vy, t.vx);
        } else { t.vx = 0; t.vy = 0; }
      }
      const nx = t.x + t.vx * dt, ny = t.y + t.vy * dt;
      if (!this.engine.terrainAt(nx, ny).water) { t.x = nx; t.y = ny; }
      else { t.tx = undefined; }
    }
  }

  // ── Случайные встречи ──────────────────────────────────────────────────
  // События в разных частях карты: караван под атакой, засада, бродячий
  // торговец, стая хищников. Никакой обязаловки — игрок может пройти мимо.
  _maybeRandomEncounter(p) {
    const e = this.engine;
    const roll = Math.random();
    const ang = Math.random() * Math.PI * 2;
    const dist = 420 + Math.random() * 260;
    const x = Math.max(220, Math.min(e.world.width - 220, p.x + Math.cos(ang) * dist));
    const y = Math.max(220, Math.min(e.world.height - 220, p.y + Math.sin(ang) * dist));
    if (e.terrainAt(x, y).water) return;

    let kind = null;
    let label = '';
    if (roll < 0.3) {
      kind = 'ambush';
      label = '⚔️ Засада! Мародёры вышли из укрытий';
      for (let i = 0; i < 3; i++) {
        e.spawnEnemyAt(x + (Math.random() - 0.5) * 120, y + (Math.random() - 0.5) * 120, 'bandit', true);
      }
    } else if (roll < 0.55) {
      kind = 'beasts';
      label = '🐺 Стая хищников вышла на охоту';
      for (let i = 0; i < 2; i++) {
        e.spawnEnemyAt(x + (Math.random() - 0.5) * 100, y + (Math.random() - 0.5) * 100, 'wolf_mutant', true);
      }
    } else if (roll < 0.78) {
      kind = 'caravan';
      label = '🐴 Караван под охраной: можно поторговать';
      this.travelers.push({
        id: `tv_caravan_${Math.random().toString(36).slice(2, 7)}`,
        defId: 'caravan',
        name: 'Караванщик Юсуф',
        greeting: 'Дороги нынче злые. Держи — немного припасов за то, что не стрелял.',
        x, y, vx: 0, vy: 0, facing: 0, radius: 14, speed: 40, hp: 160,
        state: 'wait', stateTimer: 3, animTime: 0, talked: false,
        gift: 'medkit', timer: 240
      });
    } else {
      kind = 'treasure';
      label = '💎 Блики в земле: кто-то обронил тайник';
      e.world.chests.push({
        x, y, opened: false, cursed: Math.random() < 0.25,
        loot: { coins: 60 + Math.floor(Math.random() * 80), xp: 30 }
      });
    }
    this.encounters.push({ kind, label, x, y, life: 26 });
    if (kind) e.pushToast(label, kind === 'ambush' || kind === 'beasts' ? '#f87171' : '#fbbf24');
    this.onEncounter?.(kind, { x, y, label });
  }

  // ── Взаимодействие ─────────────────────────────────────────────────────
  // Животное можно добыть в ближнем бою: урон проходит через движок.
  damageAnimal(a, dmg) {
    a.hp -= dmg;
    a.hitFlash = 0.15;
    a.state = 'flee';
    if (a.behavior === ANIMAL_BEHAVIOR.predator) { a.state = 'chase'; a.alert = 1; }
    if (a.hp <= 0) {
      a.dead = true;
      const idx = this.animals.indexOf(a);
      if (idx !== -1) this.animals.splice(idx, 1);
      this.engine.gainXp(a.xp || 2);
      if (a.loot) this.engine.dropLootAt?.(a.x, a.y, a.loot);
      this.engine.spawnSpriteEffect?.('hit', a.x, a.y, 0.8, 16);
      return true;
    }
    return false;
  }

  // Ближайший нейтральный NPC в радиусе взаимодействия
  interactableNear(x, y) {
    for (const t of this.travelers) {
      const dx = t.x - x, dy = t.y - y;
      if (dx * dx + dy * dy < 95 * 95) return t;
    }
    return null;
  }

  talkTo(t) {
    if (!t || t.talked) return null;
    t.talked = true;
    const e = this.engine;
    if (t.gift === 'medkit') e.inventory?.medkits !== undefined && (e.inventory.medkits += 1);
    if (t.gift === 'medkit') e.pushToast(`🎁 ${t.name} дарит аптечку`, '#4ade80');
    else e.pushToast(`💬 ${t.name}: ${t.greeting || 'Береги себя, странник.'}`, '#93c5fd');
    return t;
  }

  dispose() {
    this.animals.length = 0;
    this.travelers.length = 0;
    this.encounters.length = 0;
  }
}
