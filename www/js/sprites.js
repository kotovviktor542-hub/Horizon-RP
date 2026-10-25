// Высокопроизводительный 2D-рендерер с предрендером спрайтов в offscreen-атлас
// Оптимизирован для слабых телефонов Android (60 FPS, culling за пределами камеры, пул частиц)

import { BIOMES, CAMPFIRES, NPCS, WEAPONS, RESOURCES, CONSUMABLES } from './data.js';
import { getBiomeIdAt } from './world.js';

export function createRenderer(canvas, engine) {
  const ctx = canvas.getContext('2d', { alpha: false });
  const sprites = buildSpriteAtlas();
  const ambientMotes = Array.from({ length: 42 }, () => ({
    ox: Math.random() * 1400 - 700,
    oy: Math.random() * 900 - 450,
    phase: Math.random() * Math.PI * 2,
    speed: 0.4 + Math.random() * 0.8,
    size: 1.8 + Math.random() * 2.4
  }));

  let viewW = 960;
  let viewH = 540;
  let dpr = 1;

  function resize() {
    const q = engine.state.settings.quality;
    const rawDpr = window.devicePixelRatio || 1;
    dpr = q === 'low' ? 0.8 : q === 'high' ? Math.min(2, rawDpr) : Math.min(1.25, rawDpr);
    const cssW = window.innerWidth || 960;
    const cssH = window.innerHeight || 540;
    canvas.width = Math.max(320, Math.round(cssW * dpr));
    canvas.height = Math.max(240, Math.round(cssH * dpr));
    viewW = cssW;
    viewH = cssH;
  }

  function makeOffscreen(w, h, drawFn) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d');
    drawFn(g, w, h);
    return c;
  }

  function buildSpriteAtlas() {
    const atlas = {};

    // Дерево Пустоши
    atlas.tree = makeOffscreen(96, 112, (g) => {
      g.fillStyle = 'rgba(0,0,0,0.34)';
      g.beginPath(); g.ellipse(48, 94, 28, 12, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#5c3a21';
      g.fillRect(41, 62, 14, 32);
      const blobs = [[48, 44, 30, '#15803d'], [32, 52, 22, '#166534'], [64, 52, 22, '#166534'], [48, 32, 24, '#22c55e'], [42, 26, 14, '#4ade80']];
      for (const [bx, by, br, col] of blobs) {
        g.fillStyle = col;
        g.beginPath(); g.arc(bx, by, br, 0, Math.PI * 2); g.fill();
      }
    });

    // Морозная ель
    atlas.pine_tree = makeOffscreen(96, 116, (g) => {
      g.fillStyle = 'rgba(0,0,0,0.34)';
      g.beginPath(); g.ellipse(48, 98, 26, 11, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#473021';
      g.fillRect(42, 72, 12, 26);
      const tiers = [[48, 46, 34, 78, '#0f4c5c'], [48, 30, 28, 60, '#155e75'], [48, 14, 21, 42, '#0ea5e9']];
      for (const [tx, ty, hw, by, col] of tiers) {
        g.fillStyle = col;
        g.beginPath();
        g.moveTo(tx, ty);
        g.lineTo(tx - hw, by);
        g.lineTo(tx + hw, by);
        g.closePath();
        g.fill();
        g.fillStyle = 'rgba(224,242,254,0.7)';
        g.beginPath();
        g.moveTo(tx, ty);
        g.lineTo(tx - hw * 0.55, ty + (by - ty) * 0.45);
        g.lineTo(tx + hw * 0.55, ty + (by - ty) * 0.45);
        g.closePath();
        g.fill();
      }
    });

    // Куст алой травы
    atlas.herb = makeOffscreen(56, 56, (g) => {
      g.fillStyle = 'rgba(0,0,0,0.28)';
      g.beginPath(); g.ellipse(28, 42, 16, 7, 0, 0, Math.PI * 2); g.fill();
      const leaves = [-0.6, -0.2, 0.25, 0.65];
      for (const a of leaves) {
        g.save();
        g.translate(28, 40);
        g.rotate(a);
        g.fillStyle = '#16a34a';
        g.beginPath(); g.ellipse(0, -12, 5, 13, 0, 0, Math.PI * 2); g.fill();
        g.restore();
      }
      for (const [fx, fy] of [[22, 24], [33, 22], [28, 16]]) {
        g.fillStyle = '#ef4444';
        g.beginPath(); g.arc(fx, fy, 4.5, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#fca5a5';
        g.beginPath(); g.arc(fx - 1, fy - 1, 1.8, 0, Math.PI * 2); g.fill();
      }
    });

    // Рудные жилы
    const makeOre = (baseCol, crystalCol, glowCol) => makeOffscreen(68, 68, (g) => {
      g.fillStyle = 'rgba(0,0,0,0.36)';
      g.beginPath(); g.ellipse(34, 52, 24, 10, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = baseCol;
      g.beginPath();
      g.moveTo(12, 50); g.lineTo(18, 28); g.lineTo(35, 22); g.lineTo(52, 30); g.lineTo(56, 50);
      g.closePath(); g.fill();
      const shards = [[26, 18, 22, 38, 32, 38], [38, 14, 33, 36, 45, 36], [46, 24, 41, 42, 51, 42]];
      for (const [x1, y1, x2, y2, x3, y3] of shards) {
        g.fillStyle = crystalCol;
        g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.lineTo(x3, y3); g.closePath(); g.fill();
        g.strokeStyle = glowCol;
        g.lineWidth = 1.5;
        g.stroke();
      }
    });

    atlas.iron_vein = makeOre('#334155', '#94a3b8', '#e2e8f0');
    atlas.mithril_vein = makeOre('#1e3a5f', '#38bdf8', '#bae6fd');
    atlas.crystal_vein = makeOre('#3b0764', '#ec4899', '#fbcfe8');

    // Ящик
    atlas.crate = makeOffscreen(56, 56, (g) => {
      g.fillStyle = 'rgba(0,0,0,0.32)';
      g.beginPath(); g.ellipse(28, 45, 19, 8, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#92400e';
      g.fillRect(12, 16, 32, 28);
      g.strokeStyle = '#d97706';
      g.lineWidth = 3;
      g.strokeRect(13.5, 17.5, 29, 25);
      g.beginPath(); g.moveTo(13, 18); g.lineTo(43, 42); g.stroke();
    });

    // Препятствия: камни, колонны руин, ледяные шпили, обсидиан
    atlas.rock = makeOffscreen(64, 64, (g) => {
      g.fillStyle = 'rgba(0,0,0,0.34)';
      g.beginPath(); g.ellipse(32, 48, 23, 10, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#475569';
      g.beginPath(); g.moveTo(11, 46); g.lineTo(18, 24); g.lineTo(36, 18); g.lineTo(52, 29); g.lineTo(54, 46); g.closePath(); g.fill();
      g.fillStyle = '#64748b';
      g.beginPath(); g.moveTo(18, 24); g.lineTo(36, 18); g.lineTo(42, 32); g.lineTo(22, 34); g.closePath(); g.fill();
    });

    atlas.bush_statue = makeOffscreen(64, 76, (g) => {
      g.fillStyle = 'rgba(0,0,0,0.34)';
      g.beginPath(); g.ellipse(32, 62, 20, 9, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#64748b';
      g.fillRect(20, 22, 24, 40);
      g.fillStyle = '#94a3b8';
      g.fillRect(17, 16, 30, 8);
      g.fillStyle = '#4ade80';
      g.fillRect(28, 30, 8, 16);
    });

    const makePillar = (c1, c2, runeCol) => makeOffscreen(64, 88, (g) => {
      g.fillStyle = 'rgba(0,0,0,0.38)';
      g.beginPath(); g.ellipse(32, 74, 22, 10, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = c1;
      g.fillRect(18, 16, 28, 58);
      g.fillStyle = c2;
      g.fillRect(14, 12, 36, 9);
      g.fillRect(14, 66, 36, 9);
      g.fillStyle = runeCol;
      g.fillRect(29, 28, 6, 26);
    });

    atlas.ruin_pillar = makePillar('#573b36', '#7c534c', '#f87171');
    atlas.ice_pillar = makePillar('#0369a1', '#38bdf8', '#e0f2fe');
    atlas.obsidian_spire = makePillar('#2e1065', '#4c1d95', '#e879f9');
    atlas.twisted_root = makePillar('#365314', '#4d7c0f', '#a3e635');

    atlas.lantern = makeOffscreen(56, 76, (g) => {
      g.fillStyle = '#475569';
      g.fillRect(23, 32, 10, 34);
      g.fillStyle = '#fbbf24';
      g.beginPath(); g.arc(28, 26, 9, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#334155';
      g.lineWidth = 3;
      g.strokeRect(18, 16, 20, 20);
    });

    atlas.anvil = makeOffscreen(64, 56, (g) => {
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.beginPath(); g.ellipse(32, 44, 22, 8, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#334155';
      g.fillRect(20, 28, 24, 16);
      g.fillStyle = '#94a3b8';
      g.beginPath(); g.moveTo(10, 22); g.lineTo(54, 22); g.lineTo(44, 31); g.lineTo(18, 31); g.closePath(); g.fill();
    });

    atlas.monolith = makeOffscreen(88, 124, (g) => {
      g.fillStyle = 'rgba(0,0,0,0.42)';
      g.beginPath(); g.ellipse(44, 106, 30, 12, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#1e1b4b';
      g.beginPath(); g.moveTo(44, 8); g.lineTo(68, 36); g.lineTo(62, 104); g.lineTo(26, 104); g.lineTo(20, 36); g.closePath(); g.fill();
      g.strokeStyle = '#38bdf8';
      g.lineWidth = 2.5;
      g.stroke();
      g.fillStyle = '#fbbf24';
      g.beginPath(); g.arc(44, 52, 9, 0, Math.PI * 2); g.fill();
    });

    atlas.rune_wall = makeOffscreen(72, 84, (g) => {
      g.fillStyle = '#4c1d95';
      g.fillRect(10, 14, 52, 58);
      g.strokeStyle = '#e879f9';
      g.lineWidth = 3;
      g.strokeRect(12, 16, 48, 54);
      g.beginPath();
      g.moveTo(22, 24); g.lineTo(36, 44); g.lineTo(28, 62);
      g.moveTo(48, 22); g.lineTo(36, 44); g.lineTo(50, 60);
      g.stroke();
    });

    return atlas;
  }

  // ── Главная функция отрисовки кадра ──────────────────────────────────
  function render() {
    const st = engine.state;
    const world = engine.world;
    const p = st.player;

    ctx.save();
    ctx.scale(dpr, dpr);

    // Смещение камеры со встряской при ударах
    const shakeX = st.camera.shake > 0 ? (Math.random() - 0.5) * st.camera.shake : 0;
    const shakeY = st.camera.shake > 0 ? (Math.random() - 0.5) * st.camera.shake : 0;
    const camX = st.camera.x + shakeX;
    const camY = st.camera.y + shakeY;
    const left = camX - viewW * 0.5;
    const top = camY - viewH * 0.5;
    const right = left + viewW;
    const bottom = top + viewH;

    // 1. Земля и тайлы биомов
    drawTerrain(left, top, right, bottom, st.playTime);

    ctx.save();
    ctx.translate(-left, -top);

    // 2. Тропы, арены боссов, опасные лужи, шипы и каменные островки
    drawRoadsAndArenas(left, top, right, bottom);
    drawHazards(left, top, right, bottom, st.playTime);
    drawTelegraphsAndShockwaves();

    // 3. Сбор видимых объектов мира для Y-сортировки (глубина 2.5D)
    const renderList = [];
    const pad = 110;

    for (const obs of world.obstacles) {
      if (obs.x < left - pad || obs.x > right + pad || obs.y < top - pad || obs.y > bottom + pad) continue;
      renderList.push({ y: obs.y, kind: 'obs', ref: obs });
    }
    for (const nd of world.nodes) {
      if (nd.respawnTimer > 0 || nd.hp <= 0) continue;
      if (nd.x < left - pad || nd.x > right + pad || nd.y < top - pad || nd.y > bottom + pad) continue;
      renderList.push({ y: nd.y, kind: 'node', ref: nd });
    }
    for (const ch of world.chests) {
      if (ch.x < left - pad || ch.x > right + pad || ch.y < top - pad || ch.y > bottom + pad) continue;
      renderList.push({ y: ch.y, kind: 'chest', ref: ch });
    }
    for (const br of world.braziers) {
      if (br.x < left - pad || br.x > right + pad || br.y < top - pad || br.y > bottom + pad) continue;
      renderList.push({ y: br.y, kind: 'brazier', ref: br });
    }
    for (const camp of CAMPFIRES) {
      if (camp.x < left - pad || camp.x > right + pad || camp.y < top - pad || camp.y > bottom + pad) continue;
      renderList.push({ y: camp.y, kind: 'camp', ref: camp });
    }
    for (const npc of NPCS) {
      if (npc.x < left - pad || npc.x > right + pad || npc.y < top - pad || npc.y > bottom + pad) continue;
      renderList.push({ y: npc.y, kind: 'npc', ref: npc });
    }
    for (const lt of st.lootDrops) {
      if (lt.x < left - 50 || lt.x > right + 50 || lt.y < top - 50 || lt.y > bottom + 50) continue;
      renderList.push({ y: lt.y, kind: 'loot', ref: lt });
    }
    for (const en of st.enemies) {
      if (en.x < left - pad || en.x > right + pad || en.y < top - pad || en.y > bottom + pad) continue;
      renderList.push({ y: en.y, kind: 'enemy', ref: en });
    }
    if (st.activeBoss) {
      renderList.push({ y: st.activeBoss.y, kind: 'boss', ref: st.activeBoss });
    }
    renderList.push({ y: p.y, kind: 'player', ref: p });

    renderList.sort((a, b) => a.y - b.y);

    for (let i = 0; i < renderList.length; i++) {
      const item = renderList[i];
      switch (item.kind) {
        case 'obs': drawObstacle(item.ref); break;
        case 'node': drawNode(item.ref); break;
        case 'chest': drawChest(item.ref, st.playTime); break;
        case 'brazier': drawBrazier(item.ref, st.playTime); break;
        case 'camp': drawCampfire(item.ref, st.unlockedCampfires.includes(item.ref.id), st.playTime); break;
        case 'npc': drawNpc(item.ref, st.playTime); break;
        case 'loot': drawLoot(item.ref, st.playTime); break;
        case 'enemy': drawEnemy(item.ref, st.playTime); break;
        case 'boss': drawBoss(item.ref, st.playTime); break;
        case 'player': drawPlayer(item.ref, st.playTime); break;
      }
    }

    // 4. Снаряды, частицы и всплывающий урон
    drawProjectiles(st.projectiles);
    drawParticles(engine.particles);
    drawFloatingTexts(engine.floatingTexts);
    drawQuestCompass(p);

    ctx.restore();

    // 5. Атмосферные частицы биома и освещение смены дня/ночи
    if (st.settings.quality !== 'low') {
      drawAmbientBiomeMotes(st.currentBiome, st.playTime);
    }
    drawDayNightOverlay(st.dayTime, p.x - left, p.y - top);

    ctx.restore();
  }

  function drawTerrain(left, top, right, bottom) {
    const step = 96;
    const startX = Math.floor(left / step) * step;
    const startY = Math.floor(top / step) * step;

    for (let y = startY; y < bottom; y += step) {
      for (let x = startX; x < right; x += step) {
        const bId = getBiomeIdAt(x + 48, y + 48);
        const b = BIOMES[bId];
        const checker = ((Math.floor(x / step) + Math.floor(y / step)) & 1) === 0;
        ctx.fillStyle = checker ? b.groundBase : b.groundAlt;
        ctx.fillRect(x - left, y - top, step + 1, step + 1);

        // Декоративные травинки / трещины на тайле без аллокаций
        const hash = Math.abs(Math.sin(x * 12.9898 + y * 78.233)) * 43758.5453;
        const frac = hash - Math.floor(hash);
        if (frac > 0.55) {
          ctx.fillStyle = b.accent;
          ctx.globalAlpha = 0.12;
          const dx = x - left + (frac * 64);
          const dy = y - top + ((frac * 137) % 64);
          ctx.fillRect(dx, dy, 6, 6);
          ctx.globalAlpha = 1;
        }
      }
    }
  }

  function drawRoadsAndArenas(left, top, right, bottom) {
    const world = engine.world;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(120, 98, 72, 0.34)';
    ctx.lineWidth = 54;
    for (const r of world.roads) {
      ctx.beginPath();
      ctx.moveTo(r.x1, r.y1);
      ctx.lineTo(r.x2, r.y2);
      ctx.stroke();
    }

    // Каменная площадь Лагеря Рубежа
    if (2400 > left - 350 && 2400 < right + 350 && 2380 > top - 350 && 2380 < bottom + 350) {
      ctx.fillStyle = 'rgba(71, 85, 105, 0.36)';
      ctx.beginPath();
      ctx.arc(2400, 2380, 250, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
      ctx.lineWidth = 4;
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawHazards(left, top, right, bottom, time) {
    const world = engine.world;
    for (const h of world.hazards) {
      if (h.kind === 'water_moat') {
        if (h.x < left - 260 || h.x > right + 260 || h.y < top - 260 || h.y > bottom + 260) continue;
        // Водное кольцо вокруг Острова Светлячков
        ctx.save();
        ctx.beginPath();
        ctx.arc(h.x, h.y, h.outerRadius, 0, Math.PI * 2);
        ctx.arc(h.x, h.y, h.innerRadius, 0, Math.PI * 2, true);
        ctx.fillStyle = 'rgba(14, 116, 144, 0.78)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.restore();

        // Плиты для прыжков через воду
        for (const st of world.steppingStones) {
          ctx.fillStyle = '#64748b';
          ctx.beginPath();
          ctx.arc(st.x, st.y, st.radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#cbd5e1';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
        continue;
      }

      if (h.x < left - 60 || h.x > right + 60 || h.y < top - 60 || h.y > bottom + 60) continue;
      if (h.kind === 'acid') {
        const pulse = 1 + Math.sin(time * 3.5 + h.x) * 0.06;
        ctx.fillStyle = 'rgba(132, 204, 22, 0.46)';
        ctx.beginPath(); ctx.arc(h.x, h.y, h.radius * pulse, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#bef264';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else if (h.kind === 'lava') {
        const pulse = 1 + Math.sin(time * 4.2 + h.y) * 0.07;
        ctx.fillStyle = 'rgba(239, 68, 68, 0.58)';
        ctx.beginPath(); ctx.arc(h.x, h.y, h.radius * pulse, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(251, 191, 36, 0.55)';
        ctx.beginPath(); ctx.arc(h.x, h.y, h.radius * 0.55, 0, Math.PI * 2); ctx.fill();
      } else if (h.kind === 'spikes') {
        const cycle = (time + (h.phase || 0)) % 3.2;
        const active = cycle > 1.9 && cycle < 2.9;
        const warn = cycle > 1.3 && cycle <= 1.9;
        ctx.fillStyle = active ? 'rgba(239,68,68,0.45)' : warn ? 'rgba(251,191,36,0.35)' : 'rgba(30,41,59,0.55)';
        ctx.beginPath(); ctx.arc(h.x, h.y, h.radius, 0, Math.PI * 2); ctx.fill();
        if (active) {
          ctx.fillStyle = '#e2e8f0';
          for (const [ox, oy] of [[-10, -6], [10, -6], [0, 10], [0, -12]]) {
            ctx.beginPath();
            ctx.moveTo(h.x + ox, h.y + oy - 11);
            ctx.lineTo(h.x + ox - 5, h.y + oy + 4);
            ctx.lineTo(h.x + ox + 5, h.y + oy + 4);
            ctx.closePath();
            ctx.fill();
          }
        }
      }
    }
  }

  function drawTelegraphsAndShockwaves() {
    const st = engine.state;
    for (const tg of st.telegraphs) {
      const progress = 1 - tg.timer / tg.maxTimer;
      ctx.save();
      ctx.fillStyle = tg.color;
      ctx.globalAlpha = 0.16 + progress * 0.25;
      ctx.beginPath(); ctx.arc(tg.x, tg.y, tg.radius, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = tg.color;
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(tg.x, tg.y, tg.radius * progress, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }

    for (const sw of st.shockwaves) {
      const alpha = Math.max(0.12, 1 - sw.radius / sw.maxRadius);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = sw.color;
      ctx.lineWidth = sw.friendly ? 5 : 7;
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawObstacle(obs) {
    const sp = sprites[obs.kind] || sprites.rock;
    ctx.drawImage(sp, obs.x - sp.width * 0.5, obs.y - sp.height * 0.78);
  }

  function drawNode(nd) {
    const sp = sprites[nd.kind] || sprites.tree;
    ctx.save();
    if (nd.hitFlash > 0) {
      ctx.translate((Math.random() - 0.5) * 5, 0);
      ctx.filter = 'brightness(1.7)';
    }
    ctx.drawImage(sp, nd.x - sp.width * 0.5, nd.y - sp.height * 0.80);
    ctx.restore();

    if (nd.hp < nd.maxHp) {
      drawMiniBar(nd.x, nd.y - sp.height * 0.72, 38, nd.hp / nd.maxHp, '#38bdf8');
    }
  }

  function drawChest(ch, time) {
    ctx.save();
    const bob = !ch.opened && ch.kind === 'mythic' ? Math.sin(time * 4) * 3 : 0;
    ctx.fillStyle = 'rgba(0,0,0,0.36)';
    ctx.beginPath(); ctx.ellipse(ch.x, ch.y + 6, 20, 8, 0, 0, Math.PI * 2); ctx.fill();

    const bodyCol = ch.opened ? '#475569' : ch.kind === 'mythic' ? '#7e22ce' : ch.kind === 'gold' ? '#b45309' : '#78350f';
    const trimCol = ch.opened ? '#94a3b8' : ch.kind === 'mythic' ? '#fbbf24' : ch.kind === 'gold' ? '#fde047' : '#d97706';

    ctx.fillStyle = bodyCol;
    ctx.fillRect(ch.x - 16, ch.y - 16 + bob, 32, 22);
    ctx.strokeStyle = trimCol;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(ch.x - 16, ch.y - 16 + bob, 32, 22);

    if (!ch.opened) {
      ctx.fillStyle = trimCol;
      ctx.fillRect(ch.x - 4, ch.y - 8 + bob, 8, 7);
    }
    ctx.restore();
  }

  function drawBrazier(br, time) {
    ctx.fillStyle = '#334155';
    ctx.beginPath(); ctx.arc(br.x, br.y, 16, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = br.lit ? '#38bdf8' : '#64748b';
    ctx.lineWidth = 3;
    ctx.stroke();
    if (br.lit) {
      const flick = Math.sin(time * 12 + br.x) * 3;
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath(); ctx.arc(br.x, br.y - 6, 10 + flick * 0.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e0f2fe';
      ctx.beginPath(); ctx.arc(br.x, br.y - 8, 5, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawCampfire(camp, unlocked, time) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath(); ctx.ellipse(camp.x, camp.y + 6, 26, 11, 0, 0, Math.PI * 2); ctx.fill();

    // Поленья и камни
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(camp.x - 15, camp.y + 5); ctx.lineTo(camp.x + 15, camp.y - 5);
    ctx.moveTo(camp.x - 15, camp.y - 5); ctx.lineTo(camp.x + 15, camp.y + 5);
    ctx.stroke();

    if (unlocked) {
      const f = Math.sin(time * 11) * 3;
      ctx.fillStyle = 'rgba(251, 146, 60, 0.25)';
      ctx.beginPath(); ctx.arc(camp.x, camp.y - 4, 38 + f, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f97316';
      ctx.beginPath();
      ctx.moveTo(camp.x, camp.y - 28 - f);
      ctx.quadraticCurveTo(camp.x + 16, camp.y - 6, camp.x, camp.y + 4);
      ctx.quadraticCurveTo(camp.x - 16, camp.y - 6, camp.x, camp.y - 28 - f);
      ctx.fill();
      ctx.fillStyle = '#fde047';
      ctx.beginPath(); ctx.arc(camp.x, camp.y - 8, 7, 0, Math.PI * 2); ctx.fill();
    }

    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = unlocked ? '#fed7aa' : '#94a3b8';
    ctx.fillText(camp.name, camp.x, camp.y - 36);
    ctx.restore();
  }

  function drawNpc(npc, time) {
    const bob = Math.sin(time * 3 + npc.x) * 2;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(npc.x, npc.y + 8, 15, 7, 0, 0, Math.PI * 2); ctx.fill();

    // Плащ и фигура NPC
    ctx.fillStyle = npc.color;
    ctx.beginPath(); ctx.arc(npc.x, npc.y - 8 + bob, 13, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fde68a';
    ctx.beginPath(); ctx.arc(npc.x, npc.y - 22 + bob, 8.5, 0, Math.PI * 2); ctx.fill();

    // Значок над головой
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f8fafc';
    ctx.fillText(npc.name, npc.x, npc.y - 38 + bob);
    ctx.restore();
  }

  function drawLoot(lt, time) {
    const bob = Math.sin(time * 5 + lt.x) * 3.5;
    let color = '#fbbf24';
    let label = '💰';
    if (lt.type === 'resource' && RESOURCES[lt.itemId]) {
      color = RESOURCES[lt.itemId].color;
      label = RESOURCES[lt.itemId].icon;
    } else if (lt.type === 'consumable' && CONSUMABLES[lt.itemId]) {
      color = '#4ade80';
      label = CONSUMABLES[lt.itemId].icon;
    } else if (lt.type === 'relic') {
      color = '#c084fc';
      label = '💍';
    }

    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.32)';
    ctx.beginPath(); ctx.ellipse(lt.x, lt.y + 6, 10, 4.5, 0, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = color;
    ctx.globalAlpha = 0.32;
    ctx.beginPath(); ctx.arc(lt.x, lt.y - 4 + bob, 13, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;

    ctx.font = '16px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, lt.x, lt.y - 4 + bob);
    ctx.restore();
  }

  function drawEnemy(e, time) {
    const hop = e.behavior === 'melee_hop' ? Math.abs(Math.sin(time * 6 + e.x)) * 6 : Math.sin(time * 8 + e.x) * 2;
    const zOff = (e.z || 0) + hop;

    ctx.save();
    // Тень под врагом
    const shadowScale = Math.max(0.45, 1 - zOff / 120);
    ctx.fillStyle = 'rgba(0,0,0,0.38)';
    ctx.beginPath();
    ctx.ellipse(e.x, e.y + 8, e.radius * shadowScale, e.radius * 0.45 * shadowScale, 0, 0, Math.PI * 2);
    ctx.fill();

    const bodyY = e.y - zOff - 6;
    ctx.fillStyle = e.hitFlash > 0 ? '#ffffff' : e.color;
    ctx.beginPath();
    ctx.arc(e.x, bodyY, e.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.75)';
    ctx.lineWidth = 2.2;
    ctx.stroke();

    // Глаза врага
    const lookX = Math.sign(engine.state.player.x - e.x) * 3;
    ctx.fillStyle = e.eyeColor || '#fef08a';
    ctx.beginPath();
    ctx.arc(e.x - 5 + lookX, bodyY - 3, 3.2, 0, Math.PI * 2);
    ctx.arc(e.x + 5 + lookX, bodyY - 3, 3.2, 0, Math.PI * 2);
    ctx.fill();

    if (e.stunTimer > 0) {
      ctx.font = '12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('💫', e.x, bodyY - e.radius - 12);
    }

    if (e.hp < e.maxHp) {
      drawMiniBar(e.x, bodyY - e.radius - 9, 34, e.hp / e.maxHp, '#ef4444');
    }
    ctx.restore();
  }

  function drawBoss(b, time) {
    const zOff = (b.z || 0) + Math.sin(time * 4) * 3;
    ctx.save();

    // Аура босса на земле
    ctx.strokeStyle = b.phase === 2 ? '#fb7185' : b.accent;
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(b.x, b.y + 6, b.radius + 12 + Math.sin(time * 6) * 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.fillStyle = 'rgba(0,0,0,0.48)';
    ctx.beginPath();
    ctx.ellipse(b.x, b.y + 12, b.radius * 1.05, b.radius * 0.46, 0, 0, Math.PI * 2);
    ctx.fill();

    const by = b.y - zOff - 12;
    // Рога / Корона босса
    ctx.fillStyle = b.accent;
    ctx.beginPath();
    ctx.moveTo(b.x - b.radius * 0.7, by - b.radius * 0.5);
    ctx.lineTo(b.x - b.radius * 1.05, by - b.radius * 1.25);
    ctx.lineTo(b.x - b.radius * 0.25, by - b.radius * 0.85);
    ctx.moveTo(b.x + b.radius * 0.7, by - b.radius * 0.5);
    ctx.lineTo(b.x + b.radius * 1.05, by - b.radius * 1.25);
    ctx.lineTo(b.x + b.radius * 0.25, by - b.radius * 0.85);
    ctx.fill();

    ctx.fillStyle = b.hitFlash > 0 ? '#ffffff' : b.color;
    ctx.beginPath();
    ctx.arc(b.x, by, b.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = b.accent;
    ctx.stroke();

    // Светящиеся глаза босса
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(b.x - 11, by - 5, 5, 0, Math.PI * 2);
    ctx.arc(b.x + 11, by - 5, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function drawPlayer(p, time) {
    const w = WEAPONS[p.equippedWeapon] || WEAPONS.sword_iron;
    const zOff = p.z || 0;
    const moving = Math.hypot(p.vx, p.vy) > 18;
    const stride = moving ? Math.sin(p.walkCycle) * 5 : 0;
    const bob = moving ? Math.abs(Math.cos(p.walkCycle)) * 2.5 : Math.sin(time * 3.2) * 1.2;

    ctx.save();

    // Тень под ногами уменьшается в прыжке — даёт чёткое ощущение высоты!
    const shadowScale = Math.max(0.42, 1 - zOff / 115);
    ctx.fillStyle = 'rgba(0,0,0,0.42)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 9, 17 * shadowScale, 8 * shadowScale, 0, 0, Math.PI * 2);
    ctx.fill();

    const py = p.y - zOff - bob;

    // Аура Ярости / Щита Бастиона
    if (p.rageTimer > 0) {
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.65)';
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(p.x, py - 8, 25 + Math.sin(time * 10) * 2, 0, Math.PI * 2); ctx.stroke();
    }
    if (p.aegisTimer > 0) {
      ctx.fillStyle = 'rgba(192, 132, 252, 0.18)';
      ctx.strokeStyle = 'rgba(216, 180, 254, 0.78)';
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(p.x, py - 8, 28, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

      // 3 вращающихся эфирных клинка вокруг игрока
      for (let k = 0; k < 3; k++) {
        const ang = time * 4.5 + (k * Math.PI * 2) / 3;
        const bx = p.x + Math.cos(ang) * 72;
        const by = p.y + Math.sin(ang) * 72;
        ctx.save();
        ctx.translate(bx, by);
        ctx.rotate(ang + Math.PI * 0.5);
        ctx.fillStyle = '#e879f9';
        ctx.beginPath();
        ctx.moveTo(0, -13); ctx.lineTo(5, 4); ctx.lineTo(0, 11); ctx.lineTo(-5, 4);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }

    // Развевающийся плащ героя
    ctx.fillStyle = p.hitFlash > 0 ? '#ffffff' : '#be123c';
    ctx.beginPath();
    ctx.moveTo(p.x - 10, py - 14);
    ctx.lineTo(p.x + 10, py - 14);
    ctx.lineTo(p.x + 13 - p.facingX * 8, py + 7 - p.facingY * 4);
    ctx.lineTo(p.x - 13 - p.facingX * 8, py + 7 - p.facingY * 4);
    ctx.closePath();
    ctx.fill();

    // Шагающие ботинки
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(p.x - 6, py + 6 + stride, 4.5, 0, Math.PI * 2);
    ctx.arc(p.x + 6, py + 6 - stride, 4.5, 0, Math.PI * 2);
    ctx.fill();

    // Корпус брони
    const armorColors = {
      armor_tunic: '#3b82f6',
      armor_ranger: '#10b981',
      armor_crimson: '#dc2626',
      armor_frost: '#0ea5e9',
      armor_horizon: '#a855f7'
    };
    ctx.fillStyle = p.hitFlash > 0 ? '#ffffff' : (armorColors[p.equippedArmor] || '#3b82f6');
    ctx.beginPath();
    ctx.arc(p.x, py - 6, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Голова и капюшон/шлем
    ctx.fillStyle = p.hitFlash > 0 ? '#ffffff' : '#1e293b';
    ctx.beginPath();
    ctx.arc(p.x, py - 20, 9.5, 0, Math.PI * 2);
    ctx.fill();
    // Светящийся визор глаз странника
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(p.x - 3 + p.facingX * 3, py - 20 + p.facingY * 2, 2.1, 0, Math.PI * 2);
    ctx.arc(p.x + 3 + p.facingX * 3, py - 20 + p.facingY * 2, 2.1, 0, Math.PI * 2);
    ctx.fill();

    // Оружие в руке + дуга взмаха атаки
    if (p.swingTimer > 0) {
      const prog = 1 - p.swingTimer / p.swingDuration;
      if (p.swingStyle === 'whirlwind') {
        ctx.strokeStyle = '#f97316';
        ctx.lineWidth = 10;
        ctx.globalAlpha = 0.78 * (1 - prog * 0.5);
        ctx.beginPath();
        ctx.arc(p.x, py - 6, 62 + prog * 34, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      } else {
        const halfArc = (w.arc || 1.6) * 0.5;
        const dir = p.comboStep % 2 === 0 ? 1 : -1;
        const startA = p.swingAngle - halfArc * dir;
        const curA = startA + halfArc * 2 * prog * dir;

        if (w.style !== 'bow' && w.style !== 'staff') {
          ctx.save();
          ctx.strokeStyle = w.trailColor;
          ctx.lineWidth = w.style === 'hammer' ? 14 : 9;
          ctx.globalAlpha = 0.65 * (1 - prog * 0.4);
          ctx.beginPath();
          ctx.arc(p.x, py - 6, (w.range || 72) * 0.72, Math.min(startA, curA), Math.max(startA, curA));
          ctx.stroke();
          ctx.restore();
        }
        drawHeldWeapon(p.x, py - 6, curA, w);
      }
    } else {
      drawHeldWeapon(p.x, py - 6, p.facingAngle + 0.45, w);
    }

    ctx.restore();
  }

  function drawHeldWeapon(cx, cy, angle, w) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.fillStyle = w.color;
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.5;

    if (w.style === 'hammer') {
      ctx.fillStyle = '#78350f';
      ctx.fillRect(8, -2.5, 24, 5);
      ctx.fillStyle = w.color;
      ctx.fillRect(26, -10, 12, 20);
    } else if (w.style === 'bow') {
      ctx.strokeStyle = w.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(12, 0, 13, -1.1, 1.1);
      ctx.stroke();
    } else if (w.style === 'staff') {
      ctx.fillStyle = '#7c2d12';
      ctx.fillRect(6, -2, 24, 4);
      ctx.fillStyle = w.color;
      ctx.beginPath(); ctx.arc(32, 0, 5.5, 0, Math.PI * 2); ctx.fill();
    } else if (w.style === 'scythe') {
      ctx.fillStyle = '#4c1d95';
      ctx.fillRect(6, -2, 28, 4);
      ctx.fillStyle = w.color;
      ctx.beginPath();
      ctx.moveTo(32, -2); ctx.quadraticCurveTo(38, 16, 20, 20); ctx.lineTo(28, 2);
      ctx.closePath(); ctx.fill();
    } else {
      const len = w.style === 'daggers' ? 20 : 28;
      ctx.beginPath();
      ctx.moveTo(10, -3);
      ctx.lineTo(10 + len, 0);
      ctx.lineTo(10, 3);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawProjectiles(projectiles) {
    for (const pr of projectiles) {
      ctx.save();
      ctx.translate(pr.x, pr.y);
      const ang = Math.atan2(pr.vy, pr.vx);
      ctx.rotate(ang);

      if (pr.kind === 'arrow') {
        ctx.strokeStyle = pr.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-12, 0); ctx.lineTo(10, 0);
        ctx.stroke();
      } else if (pr.kind === 'crescent') {
        ctx.strokeStyle = pr.color;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(0, 0, pr.radius, -1.1, 1.1);
        ctx.stroke();
      } else {
        ctx.fillStyle = pr.color;
        ctx.beginPath();
        ctx.arc(0, 0, pr.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, pr.radius * 0.45, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawParticles(pool) {
    for (let i = 0; i < pool.length; i++) {
      const pt = pool[i];
      if (!pt.active) continue;
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y - pt.z, pt.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawFloatingTexts(texts) {
    ctx.save();
    ctx.textAlign = 'center';
    for (const ft of texts) {
      ctx.globalAlpha = Math.max(0, Math.min(1, ft.life / ft.maxLife * 1.3));
      ctx.font = `800 ${ft.size}px system-ui, sans-serif`;
      ctx.strokeStyle = 'rgba(9, 11, 18, 0.88)';
      ctx.lineWidth = 3.5;
      ctx.strokeText(ft.text, ft.x, ft.y);
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);
    }
    ctx.restore();
  }

  function drawQuestCompass(p) {
    const q = engine.getCurrentQuest();
    if (!q || !q.targetPos) return;
    const dx = q.targetPos.x - p.x;
    const dy = q.targetPos.y - p.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 140) return;

    const ang = Math.atan2(dy, dx);
    const rx = p.x + Math.cos(ang) * 52;
    const ry = p.y - 8 + Math.sin(ang) * 52;

    ctx.save();
    ctx.translate(rx, ry);
    ctx.rotate(ang);
    ctx.fillStyle = 'rgba(251, 191, 36, 0.88)';
    ctx.beginPath();
    ctx.moveTo(9, 0);
    ctx.lineTo(-6, -5.5);
    ctx.lineTo(-3, 0);
    ctx.lineTo(-6, 5.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawAmbientBiomeMotes(biomeId, time) {
    const colors = {
      meadow: '#fde047',
      ruins: '#fb923c',
      mire: '#bef264',
      frost: '#e0f2fe',
      rift: '#e879f9'
    };
    ctx.save();
    ctx.fillStyle = colors[biomeId] || '#fde047';
    ctx.globalAlpha = 0.52;
    for (const m of ambientMotes) {
      const sx = ((viewW * 0.5 + m.ox + Math.sin(time * m.speed + m.phase) * 36) % viewW + viewW) % viewW;
      const sy = ((viewH * 0.5 + m.oy + Math.cos(time * m.speed * 0.8 + m.phase) * 28) % viewH + viewH) % viewH;
      ctx.beginPath();
      ctx.arc(sx, sy, m.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawDayNightOverlay(dayTime, playerScreenX, playerScreenY) {
    // dayTime: 0.5 — яркий день, 0.0 / 1.0 — полночь
    const nightFactor = Math.max(0, Math.cos(dayTime * Math.PI * 2) * 0.5 + 0.35);
    if (nightFactor <= 0.04) return;

    ctx.save();
    const grad = ctx.createRadialGradient(
      playerScreenX, playerScreenY, 85,
      playerScreenX, playerScreenY, Math.max(viewW, viewH) * 0.72
    );
    grad.addColorStop(0, `rgba(10, 15, 32, ${nightFactor * 0.12})`);
    grad.addColorStop(1, `rgba(6, 10, 26, ${nightFactor * 0.56})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, viewW, viewH);
    ctx.restore();
  }

  function drawMiniBar(cx, cy, w, ratio, color) {
    const clamped = Math.max(0, Math.min(1, ratio));
    ctx.fillStyle = 'rgba(9, 11, 18, 0.82)';
    ctx.fillRect(cx - w * 0.5 - 1, cy - 1, w + 2, 6);
    ctx.fillStyle = color;
    ctx.fillRect(cx - w * 0.5, cy, w * clamped, 4);
  }

  return {
    resize,
    render
  };
}
