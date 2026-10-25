// UI-менеджер Horizon: Выживание
// Все иконки оружия и предметов берутся из отдельных прозрачных пиксель-арт PNG

import {
  RARITIES, BIOMES, CAMPFIRES, WEAPONS, ITEMS, RESOURCES, RECIPES,
  SKILLS, BOSSES, SECRETS, QUESTS, ACHIEVEMENTS
} from './data.js';
import { getBiomeIdAt, dist2 } from './world.js';

export class UIManager {
  constructor(engine, renderer) {
    this.engine = engine;
    this.renderer = renderer;
    this.activeTab = 'inventory';
    this.hudTick = 0;
    this.fpsValue = 60;

    this.els = {
      titleScreen: document.getElementById('title-screen'),
      btnContinue: document.getElementById('btn-continue-game'),
      btnNewGame: document.getElementById('btn-new-game'),
      hud: document.getElementById('hud'),
      hudLevel: document.getElementById('hud-level'),
      hudBiome: document.getElementById('hud-biome'),
      hudFps: document.getElementById('hud-fps'),
      barHp: document.getElementById('bar-hp'),
      txtHp: document.getElementById('txt-hp'),
      barStamina: document.getElementById('bar-stamina'),
      barHunger: document.getElementById('bar-hunger'),
      barXp: document.getElementById('bar-xp'),
      hudCoins: document.getElementById('hud-coins'),
      hudAmmo: document.getElementById('hud-ammo'),
      hudKeys: document.getElementById('hud-keys'),
      hudWeaponImg: document.getElementById('hud-weapon-img'),
      hudWeaponName: document.getElementById('hud-weapon-name'),
      hudMedkits: document.getElementById('hud-medkits'),
      hudGrenades: document.getElementById('hud-grenades'),
      hudDaytime: document.getElementById('hud-daytime'),
      questTracker: document.getElementById('quest-tracker'),
      questTitle: document.getElementById('quest-tracker-title'),
      questGoal: document.getElementById('quest-tracker-goal'),
      bossBanner: document.getElementById('boss-banner'),
      bossName: document.getElementById('boss-banner-name'),
      bossBarFill: document.getElementById('boss-bar-fill'),
      toastStack: document.getElementById('toast-stack'),
      comboBadge: document.getElementById('combo-badge'),
      btnInteract: document.getElementById('btn-interact'),
      badgeHero: document.getElementById('badge-hero'),
      cdSkill1: document.getElementById('cd-skill-1'),
      cdSkill2: document.getElementById('cd-skill-2'),
      cdSkill3: document.getElementById('cd-skill-3'),
      modalPanel: document.getElementById('modal-panel'),
      modalBody: document.getElementById('modal-body'),
      btnCloseModal: document.getElementById('btn-close-modal'),
      dialogModal: document.getElementById('dialog-modal'),
      dialogName: document.getElementById('dialog-npc-name'),
      dialogText: document.getElementById('dialog-npc-text'),
      dialogActions: document.getElementById('dialog-actions'),
      deathModal: document.getElementById('death-modal'),
      btnRespawn: document.getElementById('btn-respawn')
    };

    this.bindEvents();
    this.refreshTitleScreen();
  }

  refreshTitleScreen() {
    if (this.engine.hasSave()) {
      this.els.btnContinue.classList.remove('hidden');
    } else {
      this.els.btnContinue.classList.add('hidden');
    }
  }

  bindEvents() {
    document.querySelectorAll('[data-open-tab]').forEach((btn) => {
      btn.addEventListener('click', () => this.openModal(btn.dataset.openTab));
    });

    document.getElementById('btn-open-map')?.addEventListener('click', () => this.openModal('map'));
    this.els.questTracker?.addEventListener('click', () => this.openModal('quests'));

    document.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.engine.sound.play('ui');
        this.openModal(btn.dataset.tab);
      });
    });

    this.els.btnCloseModal?.addEventListener('click', () => this.closeModal());
    this.els.modalPanel?.addEventListener('click', (e) => {
      if (e.target === this.els.modalPanel) this.closeModal();
    });

    this.els.btnRespawn?.addEventListener('click', () => {
      this.engine.respawnPlayer();
      this.els.deathModal.classList.add('hidden');
    });
  }

  startGame(loadSaved) {
    this.engine.sound.unlock();
    if (loadSaved) {
      const ok = this.engine.loadGame();
      if (!ok) this.engine.resetState();
    } else {
      this.engine.resetState();
      this.engine.saveGame(true);
    }
    this.engine.sound.enabled = this.engine.settings.sound;
    this.renderer.resize(this.engine.settings.quality);

    this.els.titleScreen.classList.add('hidden');
    this.els.hud.classList.remove('hidden');
    this.engine.paused = false;
    this.updateHud(true);
  }

  openModal(tab) {
    this.activeTab = tab;
    this.engine.paused = true;
    this.els.modalPanel.classList.remove('hidden');
    document.querySelectorAll('.tab-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.tab === tab);
    });
    this.renderModalTab();
  }

  closeModal() {
    this.els.modalPanel.classList.add('hidden');
    this.els.dialogModal.classList.add('hidden');
    this.engine.paused = false;
  }

  handleInteractionResult(res) {
    if (!res) return;
    if (res.type === 'open_shop') {
      this.openModal('shop');
      return;
    }
    if (res.type === 'npc') {
      const npc = res.target;
      this.engine.paused = true;
      this.els.dialogName.textContent = `${npc.name} · ${npc.role}`;
      this.els.dialogText.textContent = npc.greeting;
      this.els.dialogActions.innerHTML = '';

      const addBtn = (label, cls, fn) => {
        const b = document.createElement('button');
        b.className = `action-btn ${cls}`;
        b.textContent = label;
        b.addEventListener('click', fn);
        this.els.dialogActions.appendChild(b);
      };

      if (npc.action === 'open_shop') {
        addBtn('🏪 Открыть Магазин SHOP', 'gold', () => {
          this.els.dialogModal.classList.add('hidden');
          this.openModal('shop');
        });
        addBtn('🛠️ Ремесло и Арсенал', '', () => {
          this.els.dialogModal.classList.add('hidden');
          this.openModal('craft');
        });
      } else if (npc.action === 'quest_guide') {
        addBtn('📜 Открыть Квесты и Бункеры', 'gold', () => {
          this.els.dialogModal.classList.add('hidden');
          this.openModal('quests');
        });
        addBtn('🗺️ Карта мира', '', () => {
          this.els.dialogModal.classList.add('hidden');
          this.openModal('map');
        });
      } else if (npc.action === 'heal_medic') {
        addBtn('💊 Купить медикаменты', 'green', () => {
          this.els.dialogModal.classList.add('hidden');
          this.openModal('shop');
        });
      } else if (npc.action === 'farmer_food') {
        addBtn('🍖 Съесть мясной паёк', 'green', () => {
          this.engine.useConsumable('food');
          this.closeModal();
        });
      }

      addBtn('Закрыть', '', () => this.closeModal());
      this.els.dialogModal.classList.remove('hidden');
    }
  }

  updateHud(force = false) {
    this.hudTick++;
    if (!force && this.hudTick % 3 !== 0) return;

    const eng = this.engine;
    const p = eng.player;

    if (p.dead) {
      this.els.deathModal.classList.remove('hidden');
    } else if (!this.els.deathModal.classList.contains('hidden')) {
      this.els.deathModal.classList.add('hidden');
    }

    const biomeId = getBiomeIdAt(p.x, p.y);
    const wDef = WEAPONS[eng.inventory.equippedWeapon] || WEAPONS.knife;
    const upg = eng.weaponUpgrades[wDef.id] || 0;

    this.els.hudLevel.textContent = `Ур. ${p.level}`;
    this.els.hudBiome.textContent = BIOMES[biomeId].name;

    this.els.barHp.style.width = `${Math.max(0, (p.hp / p.maxHp) * 100).toFixed(1)}%`;
    this.els.txtHp.textContent = `${Math.ceil(p.hp)}/${p.maxHp}`;
    this.els.barStamina.style.width = `${Math.max(0, (p.stamina / p.maxStamina) * 100).toFixed(1)}%`;
    this.els.barHunger.style.width = `${Math.max(0, (p.hunger / p.maxHunger) * 100).toFixed(1)}%`;
    this.els.barXp.style.width = `${Math.min(100, (p.xp / p.xpNext) * 100).toFixed(1)}%`;

    this.els.hudCoins.textContent = eng.inventory.coins;
    this.els.hudAmmo.textContent = `${eng.inventory.ammo}/${eng.getMaxAmmo()}`;
    this.els.hudKeys.textContent = eng.inventory.consumables.key || 0;
    this.els.hudWeaponImg.src = wDef.icon;
    this.els.hudWeaponName.textContent = upg > 0 ? `${wDef.name.split(' ').pop()} +${upg}` : wDef.name.split(' ').pop();

    this.els.hudMedkits.textContent = eng.inventory.consumables.medkit || 0;
    this.els.hudGrenades.textContent = eng.inventory.consumables.grenade || 0;

    const isNight = eng.isNightTime();
    this.els.hudDaytime.textContent = `${isNight ? '🌙 Ночь' : '☀️ День'} ${eng.dayCount}`;

    if (eng.settings.showFps) {
      this.els.hudFps.classList.remove('hidden');
      this.els.hudFps.textContent = `${Math.round(this.fpsValue)} FPS`;
    } else {
      this.els.hudFps.classList.add('hidden');
    }

    this.els.badgeHero.classList.toggle('hidden', p.statPoints + p.skillPoints <= 0);

    // Кулдауны навыков
    const s1 = eng.skills.slash_wave;
    const s2 = eng.skills.magic_nova;
    const s3 = eng.skills.adrenaline;
    this.els.cdSkill1.textContent = s1.level <= 0 ? '🔒' : s1.cd > 0 ? Math.ceil(s1.cd) : '';
    this.els.cdSkill2.textContent = s2.level <= 0 ? '🔒' : s2.cd > 0 ? Math.ceil(s2.cd) : '';
    this.els.cdSkill3.textContent = s3.level <= 0 ? '🔒' : s3.cd > 0 ? Math.ceil(s3.cd) : '';

    // Трекер квестов
    const q = eng.getActiveQuest();
    if (q) {
      this.els.questTitle.textContent = `📜 ${q.title}`;
      const parts = q.goals.map((g, i) => {
        const cur = eng.questProgress[`${q.id}_${i}`] || 0;
        return `${g.label}: ${cur}/${g.target}`;
      });
      this.els.questGoal.textContent = parts.join(' · ');
    } else {
      this.els.questTitle.textContent = '🏆 Все сюжетные миссии выполнены!';
      this.els.questGoal.textContent = 'Открывай бункеры и ставь рекорды выживания';
    }

    // Босс рядом
    let nearBoss = null;
    for (const b of eng.bossEntities) {
      if (dist2(p.x, p.y, b.x, b.y) < 500 * 500) { nearBoss = b; break; }
    }
    if (nearBoss) {
      this.els.bossBanner.classList.remove('hidden');
      this.els.bossName.textContent = `☠️ ${nearBoss.name} (${Math.ceil(nearBoss.hp)} / ${nearBoss.maxHp})`;
      this.els.bossBarFill.style.width = `${Math.max(0, (nearBoss.hp / nearBoss.maxHp) * 100).toFixed(1)}%`;
    } else {
      this.els.bossBanner.classList.add('hidden');
    }

    // Кнопка взаимодействия
    const inter = eng.getNearbyInteractable();
    if (inter) {
      this.els.btnInteract.classList.remove('hidden');
      this.els.btnInteract.textContent = inter.label;
    } else {
      this.els.btnInteract.classList.add('hidden');
    }

    // Комбо
    if (p.comboCount >= 3) {
      this.els.comboBadge.classList.remove('hidden');
      this.els.comboBadge.textContent = `🔥 КОМБО ×${p.comboCount}`;
    } else {
      this.els.comboBadge.classList.add('hidden');
    }

    this.els.toastStack.innerHTML = eng.toasts
      .map(t => `<div class="toast-item" style="color:${t.color}">${t.text}</div>`)
      .join('');
  }

  // ── Отрисовка вкладок меню ───────────────────────────────────────────
  renderModalTab() {
    const body = this.els.modalBody;
    switch (this.activeTab) {
      case 'inventory':    this.renderInventoryTab(body); break;
      case 'hero':         this.renderHeroTab(body); break;
      case 'shop':         this.renderShopTab(body); break;
      case 'craft':        this.renderCraftTab(body); break;
      case 'quests':       this.renderQuestsTab(body); break;
      case 'map':          this.renderMapTab(body); break;
      case 'achievements': this.renderAchievementsTab(body); break;
      case 'settings':     this.renderSettingsTab(body); break;
    }
  }

  renderResourceStrip() {
    const eng = this.engine;
    const inv = eng.inventory;
    return `
      <div class="res-pills">
        <span class="res-pill"><img src="assets/sprites/items/coin.png" class="px-icon" alt="" /> Монеты: ${inv.coins}</span>
        <span class="res-pill"><img src="assets/sprites/items/ammo.png" class="px-icon" alt="" /> Патроны: ${inv.ammo}/${eng.getMaxAmmo()}</span>
        <span class="res-pill"><img src="assets/sprites/items/key.png" class="px-icon" alt="" /> Ключи: ${inv.consumables.key || 0}</span>
        <span class="res-pill"><img src="assets/sprites/items/backpack.png" class="px-icon" alt="" /> Рюкзак: ур. ${inv.backpackLevel || 0}/4</span>
        ${Object.values(RESOURCES).map(r => `<span class="res-pill">${r.emoji} ${r.name}: ${inv.resources[r.id] || 0}</span>`).join('')}
      </div>
    `;
  }

  renderInventoryTab(body) {
    const eng = this.engine;
    const inv = eng.inventory;

    const weaponsHtml = inv.weapons.map((wId) => {
      const w = WEAPONS[wId];
      const upg = eng.weaponUpgrades[wId] || 0;
      const eq = inv.equippedWeapon === wId;
      const dmg = eng.getWeaponDamage(wId);
      const rar = RARITIES[w.rarity];
      const costCoins = 45 + upg * 40;
      const costScrap = 1 + Math.floor(upg / 2);

      return `
        <div class="item-card ${eq ? 'equipped' : ''}">
          <div class="card-head">
            <div class="card-title-wrap">
              <img src="${w.icon}" class="card-px-icon" alt="${w.name}" />
              <div>
                <div class="card-title" style="color:${rar.color}">${w.name} ${upg > 0 ? `+${upg}` : ''}</div>
                <small style="color:#94a3b8">${rar.name} · ${w.ammoCost > 0 ? `${w.ammoCost} патр./выстр.` : 'Без патронов'}</small>
              </div>
            </div>
          </div>
          <div class="card-desc">
            Урон: <b>${dmg}${w.pellets > 1 ? ` ×${w.pellets}` : ''}</b> · Дальность: ${w.range}<br/>
            ${w.desc}
          </div>
          <div class="card-actions">
            <button class="action-btn ${eq ? '' : 'green'}" data-equip="${wId}" ${eq ? 'disabled' : ''}>
              ${eq ? '✓ В руках' : 'Взять в руки'}
            </button>
            <button class="action-btn gold" data-upgrade="${wId}" ${upg >= 10 ? 'disabled' : ''}>
              ${upg >= 10 ? 'МАКС' : `Улучш. (${costCoins}🪙 ${costScrap}⚙️)`}
            </button>
          </div>
        </div>
      `;
    }).join('');

    const usableIds = ['medkit', 'grenade', 'food', 'potion'];
    const itemsHtml = usableIds.map((cId) => {
      const c = ITEMS[cId];
      const cnt = inv.consumables[cId] || 0;
      return `
        <div class="item-card">
          <div class="card-head">
            <div class="card-title-wrap">
              <img src="${c.icon}" class="card-px-icon" alt="${c.name}" />
              <div>
                <div class="card-title">${c.name}</div>
                <small style="color:#fde68a">В наличии: ×${cnt}</small>
              </div>
            </div>
          </div>
          <div class="card-desc">${c.desc}</div>
          <div class="card-actions">
            <button class="action-btn green" data-use="${cId}" ${cnt <= 0 ? 'disabled' : ''}>
              ${cId === 'grenade' ? 'Бросить гранату' : 'Использовать'}
            </button>
          </div>
        </div>
      `;
    }).join('');

    body.innerHTML = `
      ${this.renderResourceStrip()}
      <div class="section-title">🔫 Арсенал героя (${inv.weapons.length} из ${Object.keys(WEAPONS).length} видов оружия)</div>
      <div class="grid-cards">${weaponsHtml}</div>
      <div class="section-title">🎒 Снаряжение и припасы</div>
      <div class="grid-cards">${itemsHtml}</div>
    `;

    body.querySelectorAll('[data-equip]').forEach(b => b.addEventListener('click', () => {
      eng.equipWeapon(b.dataset.equip);
      this.renderModalTab();
    }));
    body.querySelectorAll('[data-upgrade]').forEach(b => b.addEventListener('click', () => {
      eng.upgradeWeapon(b.dataset.upgrade);
      this.renderModalTab();
    }));
    body.querySelectorAll('[data-use]').forEach(b => b.addEventListener('click', () => {
      const id = b.dataset.use;
      if (id === 'grenade') {
        this.closeModal();
        eng.throwGrenade();
      } else if (eng.useConsumable(id)) {
        this.renderModalTab();
      }
    }));
  }

  renderHeroTab(body) {
    const eng = this.engine;
    const p = eng.player;

    const statDefs = [
      { key: 'power',    name: '💪 Боевая мощь', desc: '+11% к урону всего оружия и навыков за уровень' },
      { key: 'vitality', name: '🛡️ Выживаемость', desc: '+22 к макс. здоровью и ускорение регенерации' },
      { key: 'agility',  name: '⚡ Ловкость',     desc: '+7 к скорости бега, +8 к стамине и темпу стрельбы' },
      { key: 'luck',     name: '🍀 Удача сталкера', desc: '+3% к шансу крита и +4% к сбору монет и патронов' }
    ];

    body.innerHTML = `
      <div class="res-pills">
        <span class="res-pill">⭐ Уровень: ${p.level} (${p.xp}/${p.xpNext} XP)</span>
        <span class="res-pill" style="color:#fde047">Очки характеристик: ${p.statPoints}</span>
        <span class="res-pill" style="color:#38bdf8">Очки навыков: ${p.skillPoints}</span>
      </div>

      <div class="section-title">Характеристики выжившего</div>
      <div class="grid-cards">
        ${statDefs.map(st => `
          <div class="item-card">
            <div class="card-head">
              <span class="card-title">${st.name}</span>
              <b style="color:#4ade80;font-size:15px">${p.stats[st.key]}</b>
            </div>
            <div class="card-desc">${st.desc}</div>
            <div class="card-actions">
              <button class="action-btn gold" data-stat="${st.key}" ${p.statPoints <= 0 ? 'disabled' : ''}>
                + Повысить (1 очко)
              </button>
            </div>
          </div>
        `).join('')}
      </div>

      <div class="section-title">Активные боевые способности</div>
      <div class="grid-cards">
        ${Object.values(SKILLS).map(sk => {
          const st = eng.skills[sk.id];
          const canUpg = p.skillPoints > 0 && p.level >= sk.unlockLevel && st.level < 5;
          return `
            <div class="item-card">
              <div class="card-head">
                <span class="card-title" style="color:${sk.color}">${sk.icon} ${sk.name}</span>
                <small>Ур. ${st.level}/5</small>
              </div>
              <div class="card-desc">${sk.desc}<br/>Открывается на уровне: <b>${sk.unlockLevel}</b></div>
              <div class="card-actions">
                <button class="action-btn gold" data-skill="${sk.id}" ${canUpg ? '' : 'disabled'}>
                  ${st.level === 0 ? 'Изучить навык' : st.level >= 5 ? 'МАКС' : 'Усилить навык'}
                </button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    body.querySelectorAll('[data-stat]').forEach(b => b.addEventListener('click', () => {
      eng.allocateStat(b.dataset.stat);
      this.renderModalTab();
    }));
    body.querySelectorAll('[data-skill]').forEach(b => b.addEventListener('click', () => {
      eng.upgradeSkill(b.dataset.skill);
      this.renderModalTab();
    }));
  }

  renderShopTab(body) {
    const eng = this.engine;
    const inv = eng.inventory;
    const shopItemIds = ['ammo', 'medkit', 'grenade', 'food', 'potion', 'key', 'backpack'];
    const shopWeaponIds = ['sword', 'bow', 'shotgun', 'rifle', 'sniper', 'magic_staff'];

    const itemsCards = shopItemIds.map((id) => {
      const it = ITEMS[id];
      const canBuy = inv.coins >= it.price && !(id === 'backpack' && inv.backpackLevel >= 4);
      return `
        <div class="item-card">
          <div class="card-head">
            <div class="card-title-wrap">
              <img src="${it.icon}" class="card-px-icon" alt="${it.name}" />
              <div>
                <div class="card-title">${it.name}</div>
                <small style="color:#fbbf24">Цена: ${it.price} 🪙</small>
              </div>
            </div>
          </div>
          <div class="card-desc">${it.desc}</div>
          <div class="card-actions">
            <button class="action-btn gold" data-buy-item="${id}" ${canBuy ? '' : 'disabled'}>
              ${id === 'backpack' && inv.backpackLevel >= 4 ? 'МАКС ур. 4' : `Купить (${it.price}🪙)`}
            </button>
          </div>
        </div>
      `;
    }).join('');

    const weaponCards = shopWeaponIds.map((id) => {
      const w = WEAPONS[id];
      const owned = inv.weapons.includes(id);
      const canBuy = !owned && inv.coins >= w.price;
      const rar = RARITIES[w.rarity];
      return `
        <div class="item-card ${owned ? 'equipped' : ''}">
          <div class="card-head">
            <div class="card-title-wrap">
              <img src="${w.icon}" class="card-px-icon" alt="${w.name}" />
              <div>
                <div class="card-title" style="color:${rar.color}">${w.name}</div>
                <small style="color:#fbbf24">${owned ? 'Куплено' : `Цена: ${w.price} 🪙`}</small>
              </div>
            </div>
          </div>
          <div class="card-desc">Базовый урон: <b>${w.baseDamage}${w.pellets > 1 ? ` ×${w.pellets}` : ''}</b> · ${w.desc}</div>
          <div class="card-actions">
            <button class="action-btn ${owned ? '' : 'gold'}" data-buy-wpn="${id}" ${canBuy ? '' : 'disabled'}>
              ${owned ? '✓ Уже в арсенале' : `Купить (${w.price}🪙)`}
            </button>
          </div>
        </div>
      `;
    }).join('');

    body.innerHTML = `
      ${this.renderResourceStrip()}
      <div class="section-title">🏪 Магазин припасов и снаряжения (SHOP)</div>
      <div class="grid-cards">${itemsCards}</div>
      <div class="section-title">🔫 Продажа оружия</div>
      <div class="grid-cards">${weaponCards}</div>
    `;

    body.querySelectorAll('[data-buy-item]').forEach(b => b.addEventListener('click', () => {
      eng.buyShopItem('item', b.dataset.buyItem);
      this.renderModalTab();
    }));
    body.querySelectorAll('[data-buy-wpn]').forEach(b => b.addEventListener('click', () => {
      eng.buyShopItem('weapon', b.dataset.buyWpn);
      this.renderModalTab();
    }));
  }

  renderCraftTab(body) {
    const eng = this.engine;
    const inv = eng.inventory;

    const cards = RECIPES.map((rc) => {
      const isWpn = !!rc.weaponId;
      const def = isWpn ? WEAPONS[rc.weaponId] : ITEMS[rc.resultId];
      const alreadyOwned = isWpn && inv.weapons.includes(rc.weaponId);

      let canCraft = !alreadyOwned && inv.coins >= rc.costCoins;
      const ingParts = Object.entries(rc.ingredients).map(([rId, need]) => {
        const have = inv.resources[rId] || 0;
        if (have < need) canCraft = false;
        const r = RESOURCES[rId];
        return `<span style="color:${have >= need ? '#4ade80' : '#f87171'}">${r.emoji} ${have}/${need}</span>`;
      });

      return `
        <div class="item-card">
          <div class="card-head">
            <div class="card-title-wrap">
              <img src="${def.icon}" class="card-px-icon" alt="${def.name}" />
              <div>
                <div class="card-title">${def.name} ${!isWpn && rc.amount > 1 ? `×${rc.amount}` : ''}</div>
                <small style="color:#fbbf24">${rc.costCoins}🪙</small>
              </div>
            </div>
          </div>
          <div class="card-desc">${rc.desc}</div>
          <div class="card-desc">Ресурсы: ${ingParts.join(' · ')}</div>
          <div class="card-actions">
            <button class="action-btn gold" data-craft="${rc.id}" ${canCraft ? '' : 'disabled'}>
              ${alreadyOwned ? '✓ Уже создано' : 'Собрать'}
            </button>
          </div>
        </div>
      `;
    }).join('');

    body.innerHTML = `
      ${this.renderResourceStrip()}
      <div class="section-title">🛠️ Полевой верстак: патроны, гранаты, ключи и оружие</div>
      <div class="grid-cards">${cards}</div>
    `;

    body.querySelectorAll('[data-craft]').forEach(b => b.addEventListener('click', () => {
      eng.craftRecipe(b.dataset.craft);
      this.renderModalTab();
    }));
  }

  renderQuestsTab(body) {
    const eng = this.engine;
    const activeQ = eng.getActiveQuest();

    const questsHtml = QUESTS.map((q, idx) => {
      const done = idx < eng.questIndex;
      const isCurrent = idx === eng.questIndex;
      return `
        <div class="item-card ${isCurrent ? 'equipped' : ''}">
          <div class="card-head">
            <span class="card-title">${done ? '✅' : isCurrent ? '📍' : '🔒'} ${q.title}</span>
            <small style="color:#fbbf24">+${q.rewards.coins}🪙 · +${q.rewards.xp} XP</small>
          </div>
          <div class="card-desc">${q.desc}</div>
          ${isCurrent ? `<div class="card-desc" style="color:#fde68a">${q.goals.map((g, gi) => `${g.label}: ${eng.questProgress[`${q.id}_${gi}`] || 0}/${g.target}`).join('<br/>')}</div>` : ''}
        </div>
      `;
    }).join('');

    const secretsHtml = SECRETS.map((s) => {
      const found = eng.discoveredSecrets.includes(s.id);
      return `
        <div class="item-card ${found ? 'equipped' : ''}">
          <div class="card-head">
            <span class="card-title">${found ? '🗝️ Открыто:' : '🔒 Секрет:'} ${s.name}</span>
            <small style="color:#c084fc">${WEAPONS[s.rewardWeapon].name}</small>
          </div>
          <div class="card-desc">${found ? `Локация вскрыта! Получено +${s.coins}🪙 и редкий арсенал.` : s.hint}</div>
        </div>
      `;
    }).join('');

    body.innerHTML = `
      <div class="section-title">📜 Сюжетная кампания (${Math.min(eng.questIndex, QUESTS.length)}/${QUESTS.length})</div>
      ${activeQ ? `<p class="card-desc" style="margin-bottom:10px;color:#fde68a">Жёлтая стрелка вокруг героя показывает направление и дистанцию до текущей цели.</p>` : ''}
      <div class="grid-cards">${questsHtml}</div>
      <div class="section-title">🗝️ Секретные Бункеры и Спецсклады (${eng.discoveredSecrets.length}/${SECRETS.length})</div>
      <div class="grid-cards">${secretsHtml}</div>
    `;
  }

  renderMapTab(body) {
    const eng = this.engine;
    const campsHtml = CAMPFIRES.map((c) => {
      const unlocked = eng.unlockedCamps.includes(c.id);
      return `
        <div class="item-card ${unlocked ? 'equipped' : ''}">
          <div class="card-head">
            <span class="card-title">${unlocked ? '🔥' : '🔒'} ${c.name}</span>
            <small>${BIOMES[c.biome].name}</small>
          </div>
          <div class="card-actions">
            <button class="action-btn ${unlocked ? 'green' : ''}" data-travel="${c.id}" ${unlocked ? '' : 'disabled'}>
              ${unlocked ? '🧭 Переместиться' : 'Ещё не открыт'}
            </button>
          </div>
        </div>
      `;
    }).join('');

    body.innerHTML = `
      <div class="world-map-box">
        <canvas id="full-map-canvas" width="260" height="260"></canvas>
        <div class="card-desc">🔵 Вы · 🟠 Костры · 🔴 Боссы · ⬜ Здания · 🟡 Цель квеста</div>
      </div>
      <div class="section-title" style="margin-top:12px">🔥 Быстрое перемещение по лагерям</div>
      <div class="grid-cards">${campsHtml}</div>
    `;

    const cv = document.getElementById('full-map-canvas');
    if (cv) {
      const prev = this.renderer.minimapCanvas;
      const prevCtx = this.renderer.mmCtx;
      this.renderer.minimapCanvas = cv;
      this.renderer.mmCtx = cv.getContext('2d');
      this.renderer.renderMinimap(eng);
      this.renderer.minimapCanvas = prev;
      this.renderer.mmCtx = prevCtx;
    }

    body.querySelectorAll('[data-travel]').forEach(b => b.addEventListener('click', () => {
      if (eng.fastTravel(b.dataset.travel)) this.closeModal();
    }));
  }

  renderAchievementsTab(body) {
    const eng = this.engine;
    body.innerHTML = `
      <div class="res-pills">
        <span class="res-pill">💀 Убито врагов: ${eng.stats.totalKills}</span>
        <span class="res-pill">💥 Взрывов: ${eng.stats.explosionsTriggered || 0}</span>
        <span class="res-pill">🗝️ Секретов: ${eng.discoveredSecrets.length}/${SECRETS.length}</span>
        <span class="res-pill">☠️ Боссов: ${eng.defeatedBosses.length}/${Object.keys(BOSSES).length}</span>
      </div>
      <div class="section-title">🏅 Достижения (${eng.unlockedAchievements.length}/${ACHIEVEMENTS.length})</div>
      <div class="grid-cards">
        ${ACHIEVEMENTS.map(a => {
          const ok = eng.unlockedAchievements.includes(a.id);
          return `
            <div class="item-card ${ok ? 'equipped' : ''}">
              <div class="card-head">
                <span class="card-title">${ok ? a.icon : '🔒'} ${a.name}</span>
                <small style="color:#fbbf24">+${a.reward}🪙</small>
              </div>
              <div class="card-desc">${a.desc}</div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  renderSettingsTab(body) {
    const eng = this.engine;
    const s = eng.settings;

    body.innerHTML = `
      <div class="section-title">⚙️ Настройки и Оптимизация под Android</div>
      <div class="grid-cards">
        <div class="item-card">
          <div class="card-title">📱 Качество рендера</div>
          <div class="card-desc">Режим «Низкое» фиксирует DPR 1.0 и лимит частиц для бюджетных телефонов.</div>
          <div class="card-actions">
            <button class="action-btn ${s.quality === 'low' ? 'gold' : ''}" data-q="low">Низкое</button>
            <button class="action-btn ${s.quality === 'medium' ? 'gold' : ''}" data-q="medium">Среднее</button>
            <button class="action-btn ${s.quality === 'high' ? 'gold' : ''}" data-q="high">Высокое</button>
          </div>
        </div>

        <div class="item-card">
          <div class="card-title">🔊 Звук и прицеливание</div>
          <div class="card-desc">Звуки выстрелов/взрывов и умная помощь прицеливания.</div>
          <div class="card-actions">
            <button class="action-btn ${s.sound ? 'green' : ''}" id="btn-toggle-sound">
              ${s.sound ? '🔊 Звук: ВКЛ' : '🔇 Звук: ВЫКЛ'}
            </button>
            <button class="action-btn ${s.autoAim ? 'green' : ''}" id="btn-toggle-aim">
              ${s.autoAim ? '🎯 Автоприцел: ВКЛ' : '🎯 Автоприцел: ВЫКЛ'}
            </button>
          </div>
        </div>

        <div class="item-card">
          <div class="card-title">📊 Счётчик FPS</div>
          <div class="card-desc">Показать частоту кадров на верхней панели.</div>
          <div class="card-actions">
            <button class="action-btn ${s.showFps ? 'green' : ''}" id="btn-toggle-fps">
              ${s.showFps ? 'FPS: Показан' : 'FPS: Скрыт'}
            </button>
          </div>
        </div>

        <div class="item-card">
          <div class="card-title">💾 Сохранение прогресса</div>
          <div class="card-desc">Прогресс автоматически сохраняется каждые 20 секунд и при важных событиях.</div>
          <div class="card-actions">
            <button class="action-btn gold" id="btn-save-now">💾 Сохранить сейчас</button>
            <button class="action-btn" id="btn-exit-title">🏠 На главный экран</button>
          </div>
        </div>
      </div>
    `;

    body.querySelectorAll('[data-q]').forEach(b => b.addEventListener('click', () => {
      s.quality = b.dataset.q;
      this.renderer.resize(s.quality);
      eng.saveGame(true);
      this.renderModalTab();
    }));

    document.getElementById('btn-toggle-sound')?.addEventListener('click', () => {
      s.sound = !s.sound;
      eng.sound.enabled = s.sound;
      eng.saveGame(true);
      this.renderModalTab();
    });

    document.getElementById('btn-toggle-aim')?.addEventListener('click', () => {
      s.autoAim = !s.autoAim;
      eng.saveGame(true);
      this.renderModalTab();
    });

    document.getElementById('btn-toggle-fps')?.addEventListener('click', () => {
      s.showFps = !s.showFps;
      eng.saveGame(true);
      this.renderModalTab();
    });

    document.getElementById('btn-save-now')?.addEventListener('click', () => {
      eng.saveGame(false);
      this.closeModal();
    });

    document.getElementById('btn-exit-title')?.addEventListener('click', () => {
      eng.saveGame(true);
      this.closeModal();
      this.els.hud.classList.add('hidden');
      this.els.titleScreen.classList.remove('hidden');
      this.refreshTitleScreen();
    });
  }
}
