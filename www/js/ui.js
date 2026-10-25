// UI-менеджер VEXMORA — БОЛЬШОЕ ОБНОВЛЕНИЕ ИГРЫ (2.0)
// Все иконки оружия и предметов берутся из отдельных прозрачных пиксель-арт PNG

import {
  RARITIES, BIOMES, CAMPFIRES, WEAPONS, WEAPON_MODS, BASE_ROOMS, ITEMS, RESOURCES, RECIPES,
  SKILLS, SKILL_TREE, BOSSES, SECRETS, QUESTS, ACHIEVEMENTS, RESCUE_MISSIONS, MISSION_TEMPLATES,
  UPDATE_ANNOUNCEMENT
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
      hudRescued: document.getElementById('hud-rescued'),
      hudMag: document.getElementById('hud-mag'),
      badgeBase: document.getElementById('badge-base'),
      badgeRescue: document.getElementById('badge-rescue'),
      updateModal: document.getElementById('update-modal'),
      updateTitle: document.getElementById('update-title'),
      updateLead: document.getElementById('update-lead'),
      updateSections: document.getElementById('update-sections'),
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
    this.renderAnnouncement();
    // Первый показ объявления VEXMORA 2.0 на главном экране
    try {
      if (!localStorage.getItem('vexmora_update_2_seen')) this.showAnnouncement();
    } catch { this.showAnnouncement(); }
  }

  renderAnnouncement() {
    if (!this.els.updateTitle) return;
    this.els.updateTitle.textContent = UPDATE_ANNOUNCEMENT.title;
    this.els.updateLead.textContent = UPDATE_ANNOUNCEMENT.lead;
    this.els.updateSections.innerHTML = UPDATE_ANNOUNCEMENT.sections.map(sec => `
      <div class="update-section"><b>${sec.icon} ${sec.heading}</b><p>${sec.text}</p></div>
    `).join('');
  }

  showAnnouncement() {
    this.els.updateModal?.classList.remove('hidden');
  }

  hideAnnouncement() {
    this.els.updateModal?.classList.add('hidden');
    try { localStorage.setItem('vexmora_update_2_seen', '1'); } catch {}
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

    document.getElementById('btn-show-update')?.addEventListener('click', () => this.showAnnouncement());
    document.getElementById('btn-close-update')?.addEventListener('click', () => this.hideAnnouncement());
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
    if (res.type === 'open_base') {
      this.openModal('base');
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
        addBtn('🎯 Взять спецоперацию', 'green', () => {
          const c = this.engine.generateContract();
          this.closeModal();
          if (c) this.updateHud(true);
        });
        addBtn('🗺️ Карта мира', '', () => {
          this.els.dialogModal.classList.add('hidden');
          this.openModal('map');
        });
      } else if (npc.action === 'open_engineer') {
        addBtn('🔧 Инженерия и Модификации оружия', 'gold', () => {
          this.els.dialogModal.classList.add('hidden');
          this.openModal('base');
        });
      } else if (npc.action === 'open_garage') {
        addBtn('🚙 Гараж и усиление транспорта', 'gold', () => {
          this.els.dialogModal.classList.add('hidden');
          this.openModal('base');
        });
      } else if (npc.action === 'toggle_companion') {
        addBtn(this.engine.companionActive ? '🤝 Отправить напарника на Базу' : '🤝 Взять Сержанта Шрама в рейд!', 'green', () => {
          this.engine.toggleCompanion();
          this.closeModal();
        });
        addBtn('🛡️ Казарма и Склад Базы', 'gold', () => {
          this.els.dialogModal.classList.add('hidden');
          this.openModal('base');
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
    if (this.els.hudRescued) this.els.hudRescued.textContent = `${eng.rescuedIds.length}/10`;
    if (this.els.hudMag) {
      this.els.hudMag.textContent = eng.isReloading() ? '🔄' : (WEAPONS[wDef.id]?.magSize ? `${eng.getMag(wDef.id)}/${eng.getMagSize(wDef.id)}` : '∞');
    }
    if (this.els.badgeRescue) {
      const activeRescue = (eng.rescueSites || []).some(s2 => ['guarding', 'defending', 'timed_active', 'ready_claim', 'escorting'].includes(s2.state));
      this.els.badgeRescue.classList.toggle('hidden', !activeRescue);
    }
    if (this.els.badgeBase) {
      this.els.badgeBase.classList.toggle('hidden', !(eng.unlockedMods.length > 0));
    }
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

    // Трекер: спецоперация важнее сюжетного квеста
    if (eng.activeContract) {
      const c = eng.activeContract;
      this.els.questTitle.textContent = `${c.icon} СПЕЦОПЕРАЦИЯ: ${c.title}`;
      this.els.questGoal.textContent = c.target > 0 ? `Прогресс: ${c.progress}/${c.target} · Награда ${c.rewardCoins}🪙` : `${c.desc} · Награда ${c.rewardCoins}🪙`;
    } else if (eng.manualObjective) {
      this.els.questTitle.textContent = `📍 ${eng.manualObjective.label}`;
      this.els.questGoal.textContent = 'Следуй за жёлтой стрелкой по краю экрана';
    }
    const q = eng.getActiveQuest();
    if (eng.activeContract || eng.manualObjective) {
      // трекер уже заполнен выше
    } else if (q) {
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
      this.els.bossName.textContent = `☠️ ${nearBoss.name} · Фаза ${nearBoss.phase}${nearBoss.shieldTimer > 0 ? ' · 🛡️ ЩИТ' : ''} (${Math.ceil(nearBoss.hp)} / ${nearBoss.maxHp})`;
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
      case 'base':         this.renderBaseTab(body); break;
      case 'craft':        this.renderCraftTab(body); break;
      case 'quests':       this.renderQuestsTab(body); break;
      case 'rescue':       this.renderRescueTab(body); break;
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
        <span class="res-pill">🆘 Спасено: ${eng.rescuedIds.length}/10</span>
        <span class="res-pill">🏰 База: ${Object.values(eng.baseLevels).reduce((a, b) => a + b, 0)} ур.</span>
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
      const mods = (eng.weaponMods[wId] || []).map(m => WEAPON_MODS[m]?.name).filter(Boolean);
      const magInfo = w.magSize ? `Магазин: ${eng.getMag(wId)}/${eng.getMagSize(wId)} · Перезарядка ${eng.getReloadTime(wId).toFixed(1)}с` : 'Без магазина и перезарядки';

      return `
        <div class="item-card ${eq ? 'equipped' : ''}">
          <div class="card-head">
            <div class="card-title-wrap">
              <img src="${w.icon}" class="card-px-icon" alt="${w.name}" />
              <div>
                <div class="card-title" style="color:${rar.color}">${w.name} ${upg > 0 ? `+${upg}` : ''}</div>
                <small style="color:#94a3b8">${rar.name} · ${w.classLabel} · Тир ${w.tier}</small>
              </div>
            </div>
          </div>
          <div class="card-desc">
            Урон: <b>${dmg}${w.pellets > 1 ? ` ×${w.pellets}` : ''}</b> · Дальность: ${eng.getWeaponRange(wId)} · Темп: ${w.cooldown}с<br/>
            ${magInfo}<br/>
            ${w.desc}
          </div>
          ${mods.length ? `<div class="mod-chips">${mods.map(m => `<span class="mod-chip">🔧 ${m}</span>`).join('')}</div>` : ''}
          <div class="card-actions">
            <button class="action-btn ${eq ? '' : 'green'}" data-equip="${wId}" ${eq ? 'disabled' : ''}>
              ${eq ? '✓ В руках' : 'Взять в руки'}
            </button>
            ${eq && w.magSize ? `<button class="action-btn" data-reload="1">🔄 Перезарядка</button>` : ''}
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
      <div class="section-title">🔫 Арсенал VEXMORA (${inv.weapons.length} из ${Object.keys(WEAPONS).length} видов оружия) · Модификации — во вкладке 🏰 База</div>
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
    body.querySelectorAll('[data-reload]').forEach(b => b.addEventListener('click', () => {
      eng.reloadWeapon();
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

    // Дерево навыков VEXMORA (3 ветки x 3 перка)
    const treeHtml = SKILL_TREE.map(perk => {
      const rank = eng.getPerkRank(perk.id);
      const maxed = rank >= perk.maxRank;
      return `
        <div class="item-card">
          <div class="card-head">
            <span class="card-title">${perk.icon} ${perk.name}</span>
            <small style="color:#c084fc">${perk.branch} · ${rank}/${perk.maxRank}</small>
          </div>
          <div class="card-desc">${perk.desc}</div>
          <div class="card-actions">
            <button class="action-btn gold" data-perk="${perk.id}" ${maxed || p.skillPoints <= 0 ? 'disabled' : ''}>
              ${maxed ? 'МАКС РАНГ' : `Изучить ранг ${rank + 1} (1 очко)`}
            </button>
          </div>
        </div>`;
    }).join('');
    body.insertAdjacentHTML('beforeend', `
      <div class="section-title">🌟 Дерево навыков выжившего (очки навыков: ${p.skillPoints})</div>
      <div class="grid-cards">${treeHtml}</div>
    `);

    body.querySelectorAll('[data-perk]').forEach(b => b.addEventListener('click', () => {
      eng.buyPerk(b.dataset.perk);
      this.renderModalTab();
    }));
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
    const shopWeaponIds = Object.values(WEAPONS).sort((a, b) => (a.tier - b.tier) || (a.price - b.price)).map(w => w.id);

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
      const unlock = eng.getWeaponUnlockStatus(id);
      const price = eng.getShopPrice('weapon', w);
      const canBuy = !owned && unlock.unlocked && inv.coins >= price;
      const rar = RARITIES[w.rarity];
      return `
        <div class="item-card ${owned ? 'equipped' : ''}">
          <div class="card-head">
            <div class="card-title-wrap">
              <img src="${w.icon}" class="card-px-icon" alt="${w.name}" />
              <div>
                <div class="card-title" style="color:${rar.color}">${w.name}</div>
                <small style="color:#fbbf24">${owned ? 'В арсенале' : `Тир ${w.tier} · Цена: ${price} 🪙`}</small>
              </div>
            </div>
          </div>
          <div class="card-desc">${w.classLabel} · Базовый урон: <b>${w.baseDamage}${w.pellets > 1 ? ` ×${w.pellets}` : ''}</b>${w.magSize ? ` · Магазин ${w.magSize}` : ''}<br/>${w.desc}</div>
          <div class="card-desc ${unlock.unlocked ? 'ok-note' : 'lock-note'}">${owned ? '✓ Открыто' : unlock.unlocked ? '✅ Доступно к покупке' : `🔒 ${unlock.reason}`}</div>
          <div class="card-actions">
            <button class="action-btn ${owned ? '' : 'gold'}" data-buy-wpn="${id}" ${canBuy ? '' : 'disabled'}>
              ${owned ? '✓ Уже в арсенале' : !unlock.unlocked ? '🔒 Закрыто' : `Купить (${price}🪙)`}
            </button>
          </div>
        </div>
      `;
    }).join('');

    body.innerHTML = `
      ${this.renderResourceStrip()}
      <div class="section-title">🏪 Магазин припасов и снаряжения (SHOP)</div>
      <div class="grid-cards">${itemsCards}</div>
      <div class="section-title">🔫 Весь арсенал VEXMORA — 24 вида оружия (открывается за уровни, боссов и Торговый Отсек)</div>
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

  renderBaseTab(body) {
    const eng = this.engine;
    const inv = eng.inventory;

    const roomsHtml = Object.values(BASE_ROOMS || {}).length ? Object.values(BASE_ROOMS).map(room => {
      // BASE_ROOMS импортирован как объект отсеков
      return room;
    }) : [];
    // Собираем карточки отсеков через движок (цены и блокировки специалистов)
    const { BASE_ROOMS: roomsDef } = { BASE_ROOMS };
    const roomsCards = Object.values(roomsDef).map(room => {
      const lvl = eng.baseLevels[room.id] || 0;
      const cost = eng.getBaseRoomCost(room.id);
      const lock = eng.getBaseSpecialistLock(room.id);
      const canUp = !lock && lvl < 5 && inv.coins >= cost.coins && (inv.resources.wood || 0) >= cost.wood && (inv.resources.scrap || 0) >= cost.scrap;
      return `
        <div class="item-card ${lvl > 0 ? 'equipped' : ''}">
          <div class="card-head">
            <span class="card-title">${room.name}</span>
            <small style="color:#4ade80">Ур. ${lvl}/5</small>
          </div>
          <div class="card-desc">Специалист: <b>${room.specialist}</b><br/>${room.desc}</div>
          <div class="card-desc">${lock ? `<span class="lock-note">🔒 ${lock}</span>` : lvl >= 5 ? '<span class="ok-note">✅ Максимальный уровень</span>' : `Улучшение: ${cost.coins}🪙 · ${cost.wood}🪵 · ${cost.scrap}⚙️ (есть: ${inv.resources.wood || 0}🪵 ${inv.resources.scrap || 0}⚙️)`}</div>
          <div class="card-actions">
            <button class="action-btn gold" data-base-upgrade="${room.id}" ${canUp ? '' : 'disabled'}>${lvl >= 5 ? 'МАКС' : lock ? '🔒 Нужен специалист' : `Улучшить до ${lvl + 1}`}</button>
          </div>
        </div>`;
    }).join('');

    // Специалисты Убежища
    const specHtml = `
      <div class="grid-cards">
        <div class="item-card equipped"><div class="card-title">💊 Доктор Елена — Медблок (ур. ${eng.baseLevels.medbay})</div><div class="card-desc">Лечит на Базе бесплатно, Медблок даёт регенерацию и усиливает аптечки. Полное лечение также в Больницах мира.</div></div>
        <div class="item-card equipped"><div class="card-title">🏪 Торговец Марк — Торговый Отсек (ур. ${eng.baseLevels.market})</div><div class="card-desc">Продаёт весь арсенал. Отсек даёт скидку 5% за уровень выше 1-го и помогает открывать тиры оружия.</div><div class="card-actions"><button class="action-btn gold" data-goto-tab="shop">Открыть магазин</button></div></div>
        <div class="item-card ${eng.rescuedIds.includes('res_engineer') ? 'equipped' : ''}"><div class="card-title">🔧 Инженер Кай ${eng.rescuedIds.includes('res_engineer') ? '— на Базе' : '— 🔒 в плену (клетка на востоке Леса)'}</div><div class="card-desc">Устанавливает боевые Модификации на оружие ниже. Нужен Инженерный Цех 1+ уровня.</div></div>
        <div class="item-card ${eng.rescuedIds.includes('res_mechanic') ? 'equipped' : ''}"><div class="card-title">🚙 Механик Рокко ${eng.rescuedIds.includes('res_mechanic') ? '— на Базе' : '— 🔒 ранен на дороге (миссия защиты)'}</div><div class="card-desc">Гараж ускоряет машины, усиливает таран и ставит Бронеджип у ворот Базы.</div></div>
        <div class="item-card ${eng.rescuedIds.includes('res_fighter_1') ? 'equipped' : ''}"><div class="card-title">🤝 Сержант Шрам и Бойцы ${eng.rescuedIds.includes('res_fighter_1') ? '— готовы к рейдам' : '— 🔒 в клетке в Городе'}</div><div class="card-desc">Напарник: <b>${eng.companionActive ? 'В рейде с тобой' : 'На Базе'}</b>${eng.companion ? ` · HP напарника ${Math.ceil(eng.companion.hp)}/${eng.companion.maxHp}` : ''}</div><div class="card-actions"><button class="action-btn green" data-toggle-companion="1" ${eng.rescuedIds.includes('res_fighter_1') ? '' : 'disabled'}>${eng.companionActive ? 'Отправить напарника на Базу' : 'Взять напарника в рейд'}</button></div></div>
      </div>`;

    // Модификации текущего и всего оружия
    const workshopLvl = eng.baseLevels.workshop || 0;
    const modCards = Object.values(WEAPON_MODS).map(mod => {
      const equippedId = inv.equippedWeapon;
      const installed = eng.hasMod(equippedId, mod.id);
      const freeOwned = eng.unlockedMods.includes(mod.id);
      const canInstall = workshopLvl >= 1 && !installed && (freeOwned || (inv.coins >= mod.costCoins && (inv.resources.scrap || 0) >= mod.costScrap));
      return `
        <div class="item-card ${installed ? 'equipped' : ''}">
          <div class="card-head"><span class="card-title">${mod.icon} ${mod.name}</span><small style="color:#c084fc">${freeOwned ? '🎁 Есть на складе (бесплатно)' : `${mod.costCoins}🪙 · ${mod.costScrap}⚙️`}</small></div>
          <div class="card-desc">${mod.desc}</div>
          <div class="card-desc">Цель: <b>${WEAPONS[equippedId].name}</b> (оружие в руках)</div>
          <div class="card-actions">
            ${installed
              ? `<button class="action-btn" data-unmod="${mod.id}">Снять модуль</button>`
              : `<button class="action-btn gold" data-install-mod="${mod.id}" ${canInstall ? '' : 'disabled'}>${workshopLvl < 1 ? '🔒 Нужен Цех 1 ур.' : freeOwned ? 'Установить бесплатно' : 'Установить модуль'}</button>`}
          </div>
        </div>`;
    }).join('');

    body.innerHTML = `
      ${this.renderResourceStrip()}
      <div class="section-title">🏰 Убежище VEXMORA — развитие отсеков (макс. 5 ур.)</div>
      <div class="grid-cards">${roomsCards}</div>
      <div class="section-title">👥 Специалисты и отряд Базы</div>
      ${specHtml}
      <div class="section-title">🔧 Инженерный Цех: Модификации оружия в руках (Цех ур. ${workshopLvl})</div>
      <p class="card-desc" style="margin-bottom:9px">Выбери оружие во вкладке 🎒 Арсенал кнопкой «Взять в руки», затем установи сюда модули. Модули из секретных бункеров и спецконтейнеров лежат на складе и ставятся бесплатно!</p>
      <div class="grid-cards">${modCards}</div>
      <div class="section-title">🚙 Гараж и склад ресурсов</div>
      <p class="card-desc">Скорость транспорта: <b>+${(eng.baseLevels.garage || 0) * 10}%</b> · Урон тарана: <b>+${(eng.baseLevels.garage || 0) * 25}%</b> · Макс. патронов со Складом: <b>${eng.getMaxAmmo()}</b>. Ресурсы для строительства добывай из деревьев, кустов, ящиков и бочек атакой/выстрелами.</p>
    `;

    body.querySelectorAll('[data-base-upgrade]').forEach(b => b.addEventListener('click', () => { eng.upgradeBaseRoom(b.dataset.baseUpgrade); this.renderModalTab(); }));
    body.querySelectorAll('[data-install-mod]').forEach(b => b.addEventListener('click', () => { eng.installMod(inv.equippedWeapon, b.dataset.installMod); this.renderModalTab(); }));
    body.querySelectorAll('[data-unmod]').forEach(b => b.addEventListener('click', () => { eng.uninstallMod(inv.equippedWeapon, b.dataset.unmod); this.renderModalTab(); }));
    body.querySelectorAll('[data-toggle-companion]').forEach(b => b.addEventListener('click', () => { eng.toggleCompanion(); this.renderModalTab(); }));
    body.querySelectorAll('[data-goto-tab]').forEach(b => b.addEventListener('click', () => this.openModal(b.dataset.gotoTab)));
  }

  renderRescueTab(body) {
    const eng = this.engine;
    const typeLabel = { cage: '🗝️ Клетка + сигнализация', defend: '🛡️ Защита от волн', escort: '🚶 Сопровождение до Убежища', timed: '⏱️ Спасение на время' };
    const cards = RESCUE_MISSIONS.map(def => {
      const site = eng.getRescueSite(def.id);
      const done = eng.rescuedIds.includes(def.id);
      const state = site ? site.state : 'idle';
      let status = 'Не начато — подойди к точке на карте';
      if (done) status = '✅ Спасён и живёт в Убежище';
      else if (state === 'guarding') status = `⚔️ Зачисти охрану клетки (осталось: ${eng.rescueGuardsAlive(site)})${def.hasAlarm && !site.alarmDisabled ? ' · 🚨 Отключи терминал!' : ''}`;
      else if (state === 'defending') status = `🌊 Идёт защита: волна ${site.wave}/${def.waves || 2} · HP выжившего ${Math.max(0, Math.ceil(site.npcHp))}`;
      else if (state === 'escort_ready') status = '🛡️ Ожидает сопровождения — подойди и нажми действие у выжившего';
      else if (state === 'escorting') status = '🚶 Сопровождение идёт — защищай от засад!';
      else if (state === 'timed_active') status = `⏱️ Осталось ${Math.max(0, Math.ceil(site.timer))} сек.! Охрана: ${eng.rescueGuardsAlive(site)}`;
      else if (state === 'ready_claim') status = '🎉 Готов к спасению — подойди к выжившей/клетке!';
      else if (state === 'failed') status = `❌ Не удалось — повтор через ${Math.max(0, Math.ceil(site.failTimer))} сек.`;
      const reward = [def.rewardWeapon ? WEAPONS[def.rewardWeapon]?.name : null, def.rewardItem ? ITEMS[def.rewardItem]?.name : null].filter(Boolean).join(' · ');
      return `
        <div class="item-card ${done ? 'equipped' : ''}">
          <div class="card-head"><span class="card-title">${done ? '✅' : '🆘'} ${def.name}</span><small style="color:#fbbf24">+${def.rewardCoins}🪙 · +${def.rewardXp} XP</small></div>
          <div class="card-desc"><b>${typeLabel[def.type] || def.type}</b> · ${def.role}${def.timeLimit ? ` · Лимит: ${def.timeLimit} сек.` : ''}${def.requiresKey ? ' · Нужна Ключ-карта' : ''}</div>
          <div class="card-desc">${def.desc}</div>
          <div class="card-desc ${done ? 'ok-note' : ''}">${status}${reward ? `<br/>Награда: ${reward}` : ''}</div>
          <div class="card-actions">
            <button class="action-btn gold" data-set-objective="${def.x},${def.y},🆘 ${def.name}" ${done ? 'disabled' : ''}>${done ? 'Спасён' : '📍 Отметить цель на карте'}</button>
          </div>
        </div>`;
    }).join('');

    body.innerHTML = `
      ${this.renderResourceStrip()}
      <div class="section-title">🆘 Спасение пленников и выживших (${eng.rescuedIds.length}/${RESCUE_MISSIONS.length})</div>
      <p class="card-desc" style="margin-bottom:10px">Отключай терминалы сигнализации справа от клеток, уничтожай охрану и мини-боссов, отпирай камеры Ключ-картой, защищай раненых от волн и сопровождая выживших в Убежище. Спасённые специалисты открывают Инженерию, Гараж, Казарму и бойца-напарника!</p>
      <div class="grid-cards">${cards}</div>
    `;
    this.bindObjectiveButtons(body);
  }

  bindObjectiveButtons(body) {
    body.querySelectorAll('[data-set-objective]').forEach(b => b.addEventListener('click', () => {
      const [x, y, label] = b.dataset.setObjective.split(',');
      this.engine.setObjective(Number(x), Number(y), label);
      this.closeModal();
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
          <div class="card-desc">${found ? `Локация вскрыта! Получено +${s.coins}🪙 и редкий арсенал.` : s.hint}${s.rewardMod ? `<br/>Модуль внутри: <b style="color:#c084fc">${WEAPON_MODS[s.rewardMod]?.name || ''}</b>` : ''}</div>
        </div>
      `;
    }).join('');

    const contractsHtml = `
      <div class="item-card ${eng.activeContract ? 'equipped' : ''}">
        <div class="card-head"><span class="card-title">${eng.activeContract ? `${eng.activeContract.icon} Идёт операция: ${eng.activeContract.title}` : '🎯 Нет активной спецоперации'}</span><small style="color:#fbbf24">Выполнено операций: ${eng.stats.contractsDone || 0}</small></div>
        <div class="card-desc">${eng.activeContract ? `${eng.activeContract.desc}<br/>Прогресс: ${eng.activeContract.progress}/${eng.activeContract.target || 'цель'} · Награда: ${eng.activeContract.rewardCoins}🪙 + ${eng.activeContract.rewardXp} XP. Следуй за жёлтой/красной меткой!` : 'Боевые задания с меняющимися врагами: зачистка баз, охота на командиров, освобождение пленных, охрана караванов, поиск редкого оружия и оборона Убежища.'}</div>
        <div class="card-actions">
          <button class="action-btn green" id="btn-gen-contract" ${eng.activeContract ? 'disabled' : ''}>${eng.activeContract ? 'Операция уже идёт' : '🎯 Взять случайную спецоперацию'}</button>
        </div>
      </div>
      ${MISSION_TEMPLATES.map(t => `<div class="item-card"><div class="card-title">${t.icon} ${t.title}</div><div class="card-desc">${t.desc}</div></div>`).join('')}
    `;

    const bossesHtml = Object.values(BOSSES).map(b => {
      const dead = eng.defeatedBosses.includes(b.id);
      return `
        <div class="item-card ${dead ? 'equipped' : ''}">
          <div class="card-head"><span class="card-title">${dead ? '🏆' : '👹'} #${b.order} ${b.name}</span><small style="color:#fda4af">${b.title}</small></div>
          <div class="card-desc">${b.desc}<br/>Арена: ${BIOMES[b.biome]?.name || b.biome} · HP ${b.hp} · Награда: <b style="color:#fbbf24">${WEAPONS[b.rewardWeapon]?.name}</b> + ${b.coins}🪙</div>
          <div class="card-desc ${dead ? 'ok-note' : 'boss-phase-note'}">${dead ? `✅ Побеждён! Открыто: ${b.unlocksZone}` : `❌ Ещё жив · Открывает: ${b.unlocksZone}`}</div>
          <div class="card-actions"><button class="action-btn gold" data-set-objective="${b.x},${b.y},👹 ${b.name}" ${dead ? 'disabled' : ''}>${dead ? 'Трофей в коллекции' : '📍 Отметить арену босса'}</button></div>
        </div>`;
    }).join('');

    body.innerHTML = `
      <div class="section-title">📜 Сюжетная кампания VEXMORA (${Math.min(eng.questIndex, QUESTS.length)}/${QUESTS.length})</div>
      ${activeQ ? `<p class="card-desc" style="margin-bottom:10px;color:#fde68a">Жёлтая стрелка вокруг героя показывает направление и дистанцию до текущей цели.</p>` : ''}
      <div class="grid-cards">${questsHtml}</div>
      <div class="section-title">🎯 Спецоперации и события (повторяемые)</div>
      <div class="grid-cards">${contractsHtml}</div>
      <div class="section-title">👹 Коллекция боссов VEXMORA (${eng.defeatedBosses.length}/${Object.keys(BOSSES).length})</div>
      <div class="grid-cards">${bossesHtml}</div>
      <div class="section-title">🗝️ Секретные Бункеры и Спецсклады (${eng.discoveredSecrets.length}/${SECRETS.length})</div>
      <div class="grid-cards">${secretsHtml}</div>
    `;

    document.getElementById('btn-gen-contract')?.addEventListener('click', () => {
      eng.generateContract();
      this.renderModalTab();
    });
    this.bindObjectiveButtons(body);
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
      <div class="section-title">🆘 Точки спасения и боссы (метка цели без телепорта)</div>
      <div class="grid-cards">
        ${RESCUE_MISSIONS.filter(d => !eng.rescuedIds.includes(d.id)).map(d => `<div class="item-card"><div class="card-title">🆘 ${d.name}</div><div class="card-desc">${d.desc}</div><div class="card-actions"><button class="action-btn gold" data-set-objective="${d.x},${d.y},🆘 ${d.name}">📍 Отметить цель</button></div></div>`).join('')}
      </div>
    `;
    this.bindObjectiveButtons(body);

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
        <span class="res-pill">🆘 Спасено людей: ${eng.rescuedIds.length}/10</span>
        <span class="res-pill">🎯 Спецопераций: ${eng.stats.contractsDone || 0}</span>
        <span class="res-pill">🔧 Модификаций: ${eng.stats.modsInstalled || 0}</span>
        <span class="res-pill">🏰 Улучшений Базы: ${eng.stats.baseUpgrades || 0}</span>
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
