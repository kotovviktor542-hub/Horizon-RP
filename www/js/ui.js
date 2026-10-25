// Управление всем пользовательским интерфейсом: Главное меню, HUD, Инвентарь, Прокачка,
// Ремесло, Умения, Задания/Достижения, Карта мира с туманом войны, Настройки и Диалоги.

import {
  BIOMES, CAMPFIRES, SECRETS, RARITIES, RESOURCES, CONSUMABLES,
  WEAPONS, ARMORS, RELICS, SKILLS, RECIPES, BOSSES, QUESTS, ACHIEVEMENTS
} from './data.js';
import { getBiomeIdAt } from './world.js';
import { sound } from './audio.js';

export function createUI(engine, renderer, onStartGame) {
  let activeModalTab = null; // null | 'hero' | 'inventory' | 'craft' | 'skills' | 'quests' | 'map' | 'settings'
  let inMainMenu = true;
  let hudTick = 0;

  const els = {
    mainMenu: document.getElementById('main-menu'),
    btnContinue: document.getElementById('btn-continue'),
    continueSub: document.getElementById('continue-sub'),
    btnNewGame: document.getElementById('btn-new-game'),
    btnMenuSettings: document.getElementById('btn-menu-settings'),
    btnMenuHelp: document.getElementById('btn-menu-help'),
    helpOverlay: document.getElementById('help-overlay'),
    btnCloseHelp: document.getElementById('btn-close-help'),
    confirmOverlay: document.getElementById('confirm-overlay'),
    btnConfirmYes: document.getElementById('btn-confirm-yes'),
    btnConfirmNo: document.getElementById('btn-confirm-no'),

    hud: document.getElementById('hud'),
    hpFill: document.getElementById('hp-fill'),
    hpText: document.getElementById('hp-text'),
    stamFill: document.getElementById('stam-fill'),
    satFill: document.getElementById('sat-fill'),
    xpFill: document.getElementById('xp-fill'),
    lvlBadge: document.getElementById('lvl-badge'),
    goldText: document.getElementById('gold-text'),
    biomeText: document.getElementById('biome-text'),
    timeText: document.getElementById('time-text'),
    heroAlertDot: document.getElementById('hero-alert-dot'),

    questBox: document.getElementById('quest-tracker'),
    questTitle: document.getElementById('quest-title'),
    questGoals: document.getElementById('quest-goals'),

    bossHud: document.getElementById('boss-hud'),
    bossName: document.getElementById('boss-name'),
    bossFill: document.getElementById('boss-fill'),

    minimap: document.getElementById('minimap-canvas'),
    toastContainer: document.getElementById('toast-container'),

    btnAttackIcon: document.getElementById('btn-attack-icon'),
    btnPotionIcon: document.getElementById('btn-potion-icon'),
    btnPotionCount: document.getElementById('btn-potion-count'),
    btnPotionCd: document.getElementById('btn-potion-cd'),
    btnInteract: document.getElementById('btn-interact'),
    btnInteractLabel: document.getElementById('btn-interact-label'),

    skillBtns: {
      whirlwind: document.getElementById('btn-skill-1'),
      thunder_slam: document.getElementById('btn-skill-2'),
      aegis_pulse: document.getElementById('btn-skill-3')
    },
    skillCds: {
      whirlwind: document.getElementById('cd-skill-1'),
      thunder_slam: document.getElementById('cd-skill-2'),
      aegis_pulse: document.getElementById('cd-skill-3')
    },

    modal: document.getElementById('game-modal'),
    modalBody: document.getElementById('modal-body'),
    modalTabs: document.querySelectorAll('[data-tab]'),
    btnCloseModal: document.getElementById('btn-close-modal'),

    npcOverlay: document.getElementById('npc-overlay'),
    npcName: document.getElementById('npc-name'),
    npcRole: document.getElementById('npc-role'),
    npcText: document.getElementById('npc-text'),
    npcActions: document.getElementById('npc-actions'),

    deathOverlay: document.getElementById('death-overlay'),
    btnRespawn: document.getElementById('btn-respawn'),

    victoryOverlay: document.getElementById('victory-overlay'),
    btnContinueAfterWin: document.getElementById('btn-continue-win')
  };

  const mmCtx = els.minimap ? els.minimap.getContext('2d') : null;

  // ── Главное Меню ─────────────────────────────────────────────────────
  function refreshMainMenu() {
    const preview = engine.getSavedPreview();
    if (preview) {
      els.btnContinue.classList.remove('hidden');
      const mins = Math.floor(preview.playTime / 60);
      els.continueSub.textContent = `Ур. ${preview.level} · ${preview.biomeName} · 💰 ${preview.gold} · ${mins} мин`;
    } else {
      els.btnContinue.classList.add('hidden');
    }
  }

  function showMainMenu() {
    inMainMenu = true;
    engine.state.paused = true;
    activeModalTab = null;
    els.modal.classList.add('hidden');
    els.hud.classList.add('hidden');
    els.mainMenu.classList.remove('hidden');
    refreshMainMenu();
  }

  function enterWorld(loadSaved) {
    sound.init();
    sound.play('ui');
    if (loadSaved) {
      engine.loadGame();
    } else {
      engine.resetNewGame();
    }
    renderer.resize();
    inMainMenu = false;
    engine.state.paused = false;
    els.mainMenu.classList.add('hidden');
    els.confirmOverlay.classList.add('hidden');
    els.hud.classList.remove('hidden');
    updateHud(true);
    if (onStartGame) onStartGame();
  }

  els.btnContinue?.addEventListener('click', () => enterWorld(true));
  els.btnNewGame?.addEventListener('click', () => {
    sound.init();
    sound.play('ui');
    if (engine.hasSavedGame()) {
      els.confirmOverlay.classList.remove('hidden');
    } else {
      enterWorld(false);
    }
  });
  els.btnConfirmYes?.addEventListener('click', () => enterWorld(false));
  els.btnConfirmNo?.addEventListener('click', () => {
    sound.play('ui');
    els.confirmOverlay.classList.add('hidden');
  });

  els.btnMenuSettings?.addEventListener('click', () => {
    sound.init();
    sound.play('ui');
    openTab('settings');
  });
  els.btnMenuHelp?.addEventListener('click', () => {
    sound.init();
    sound.play('ui');
    els.helpOverlay.classList.remove('hidden');
  });
  els.btnCloseHelp?.addEventListener('click', () => {
    sound.play('ui');
    els.helpOverlay.classList.add('hidden');
  });

  // Верхние кнопки HUD
  document.getElementById('btn-open-hero')?.addEventListener('click', () => openTab('hero'));
  document.getElementById('btn-open-bag')?.addEventListener('click', () => openTab('inventory'));
  document.getElementById('btn-open-craft')?.addEventListener('click', () => openTab('craft'));
  document.getElementById('btn-open-map')?.addEventListener('click', () => openTab('map'));
  document.getElementById('btn-open-pause')?.addEventListener('click', () => openTab('settings'));
  els.minimap?.addEventListener('click', () => openTab('map'));
  els.questBox?.addEventListener('click', () => openTab('quests'));

  els.btnCloseModal?.addEventListener('click', () => closeModal());
  els.modalTabs.forEach((btn) => {
    btn.addEventListener('click', () => {
      sound.play('ui');
      openTab(btn.dataset.tab);
    });
  });

  els.btnRespawn?.addEventListener('click', () => {
    engine.respawnPlayer();
    els.deathOverlay.classList.add('hidden');
    updateHud(true);
  });

  els.btnContinueAfterWin?.addEventListener('click', () => {
    sound.play('ui');
    els.victoryOverlay.classList.add('hidden');
    engine.state.paused = false;
  });

  // ── Открытие/закрытие вкладок модального окна ────────────────────────
  function openTab(tabName) {
    activeModalTab = tabName;
    engine.state.paused = true;
    els.modal.classList.remove('hidden');
    els.modalTabs.forEach((b) => b.classList.toggle('active', b.dataset.tab === tabName));
    renderModalContent();
  }

  function closeModal() {
    sound.play('ui');
    activeModalTab = null;
    els.modal.classList.add('hidden');
    if (!inMainMenu && els.npcOverlay.classList.contains('hidden')) {
      engine.state.paused = false;
    }
  }

  function isModalOpen() {
    return inMainMenu || activeModalTab !== null ||
      !els.npcOverlay.classList.contains('hidden') ||
      !els.helpOverlay.classList.contains('hidden') ||
      engine.state.gameOver;
  }

  function handleEscape() {
    if (!els.helpOverlay.classList.contains('hidden')) {
      els.helpOverlay.classList.add('hidden');
      return;
    }
    if (!els.npcOverlay.classList.contains('hidden')) {
      els.npcOverlay.classList.add('hidden');
      engine.state.paused = false;
      return;
    }
    if (activeModalTab !== null) {
      closeModal();
      return;
    }
    if (!inMainMenu) {
      openTab('settings');
    }
  }

  // ── Диалог с NPC и контекстное действие ──────────────────────────────
  function handleInteract() {
    const res = engine.interact();
    if (!res) return;
    if (res.action === 'npc_talk' && res.npc) {
      showNpcDialog(res.npc);
    }
    updateHud(true);
  }

  function showNpcDialog(npc) {
    engine.state.paused = true;
    els.npcName.textContent = npc.name;
    els.npcRole.textContent = npc.role;
    els.npcText.textContent = npc.greeting;
    els.npcActions.innerHTML = '';

    if (npc.action === 'open_craft') {
      const b1 = makeBtn('🔨 Открыть Ремесло', 'btn-primary', () => {
        els.npcOverlay.classList.add('hidden');
        openTab('craft');
      });
      const b2 = makeBtn('⚔️ Заточка оружия', 'btn-secondary', () => {
        els.npcOverlay.classList.add('hidden');
        openTab('inventory');
      });
      els.npcActions.append(b1, b2);
    } else if (npc.action === 'bounty_hint') {
      const b1 = makeBtn('📜 Задания и Секреты', 'btn-primary', () => {
        els.npcOverlay.classList.add('hidden');
        openTab('quests');
      });
      els.npcActions.append(b1);
    } else {
      const b1 = makeBtn('⭐ Прокачка героя', 'btn-primary', () => {
        els.npcOverlay.classList.add('hidden');
        openTab('hero');
      });
      els.npcActions.append(b1);
    }

    const closeBtn = makeBtn('Продолжить путь', 'btn-ghost', () => {
      sound.play('ui');
      els.npcOverlay.classList.add('hidden');
      engine.state.paused = false;
    });
    els.npcActions.appendChild(closeBtn);
    els.npcOverlay.classList.remove('hidden');
  }

  function makeBtn(label, cls, onClick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `ui-btn ${cls}`;
    b.textContent = label;
    b.addEventListener('click', onClick);
    return b;
  }

  // ── Рендер содержимого вкладок ───────────────────────────────────────
  function renderModalContent() {
    const st = engine.state;
    const p = st.player;
    const cs = engine.getComputedStats();
    const container = els.modalBody;
    container.innerHTML = '';

    if (activeModalTab === 'hero') {
      const w = WEAPONS[p.equippedWeapon];
      const a = ARMORS[p.equippedArmor];
      const upg = st.weaponUpgrades[w.id] || 0;

      const wrap = document.createElement('div');
      wrap.className = 'tab-grid two-col';
      wrap.innerHTML = `
        <div class="card-panel">
          <div class="panel-header">
            <h3>Герой Уровня ${p.level}</h3>
            <span class="gold-pill">💰 ${p.gold} зол.</span>
          </div>
          <div class="xp-line">Опыт: ${p.xp} / ${p.xpNext} XP</div>
          <div class="stats-table">
            <div><span>⚔️ Сила атаки</span><strong>${cs.weaponDamage}</strong></div>
            <div><span>❤️ Макс. здоровье</span><strong>${cs.maxHp}</strong></div>
            <div><span>🛡️ Защита</span><strong>${cs.defense}</strong></div>
            <div><span>🎯 Шанс крита</span><strong>${Math.round(cs.critChance * 100)}%</strong></div>
            <div><span>👟 Скорость бега</span><strong>${cs.moveSpeed}</strong></div>
            <div><span>✨ Сила умений</span><strong>${Math.round(cs.skillMult * 100)}%</strong></div>
            <div><span>⏱️ Сокращение КД</span><strong>${Math.round(cs.cdrMult * 100)}%</strong></div>
            <div><span>🩸 Вампиризм</span><strong>${Math.round(cs.lifesteal * 100)}%</strong></div>
          </div>
          <div class="equip-summary">
            <div class="eq-chip"><span>Оружие:</span> <b>${w.icon} ${w.name} ${upg > 0 ? '+' + upg : ''}</b></div>
            <div class="eq-chip"><span>Броня:</span> <b>${a.icon} ${a.name}</b></div>
            <div class="eq-chip"><span>Реликвия 1:</span> <b>${p.equippedRelics[0] ? RELICS[p.equippedRelics[0]].icon + ' ' + RELICS[p.equippedRelics[0]].name : 'Пусто'}</b></div>
            <div class="eq-chip"><span>Реликвия 2:</span> <b>${p.equippedRelics[1] ? RELICS[p.equippedRelics[1]].icon + ' ' + RELICS[p.equippedRelics[1]].name : 'Пусто'}</b></div>
          </div>
        </div>
        <div class="card-panel">
          <div class="panel-header">
            <h3>Характеристики</h3>
            <span class="badge-pts ${p.statPoints > 0 ? 'pulse' : ''}">Очков: ${p.statPoints}</span>
          </div>
          <div id="attr-list" class="attr-list"></div>
        </div>
      `;
      container.appendChild(wrap);

      const attrList = wrap.querySelector('#attr-list');
      const attrs = [
        { key: 'power', name: '⚔️ Сила', val: p.attributes.power, desc: '+9% к урону любого оружия' },
        { key: 'vitality', name: '❤️ Живучесть', val: p.attributes.vitality, desc: '+22 к здоровью и +2 к защите' },
        { key: 'agility', name: '💨 Ловкость', val: p.attributes.agility, desc: '+скорость, +10 стамины и +2.5% крита' },
        { key: 'arcane', name: '🔮 Мастерство Эфира', val: p.attributes.arcane, desc: '+12% урона способностей и -3.5% перезарядки' }
      ];
      for (const at of attrs) {
        const row = document.createElement('div');
        row.className = 'attr-row';
        row.innerHTML = `
          <div>
            <div class="attr-title">${at.name} <span class="attr-rank">[${at.val}]</span></div>
            <div class="attr-desc">${at.desc}</div>
          </div>
        `;
        const btn = makeBtn(p.statPoints > 0 ? '+ Улучшить' : 'Нет очков', p.statPoints > 0 ? 'btn-primary' : 'btn-disabled', () => {
          if (engine.allocateStat(at.key)) renderModalContent();
        });
        btn.disabled = p.statPoints <= 0;
        row.appendChild(btn);
        attrList.appendChild(row);
      }
      return;
    }

    if (activeModalTab === 'inventory') {
      const wrap = document.createElement('div');
      wrap.className = 'inv-sections';

      // 1. Оружие и Заточка
      const wSec = document.createElement('div');
      wSec.className = 'card-panel';
      wSec.innerHTML = `<div class="panel-header"><h3>⚔️ Оружие и Заточка</h3><span class="gold-pill">💰 ${p.gold}</span></div><div class="item-list" id="inv-weapons"></div>`;
      const wList = wSec.querySelector('#inv-weapons');

      for (const wId of st.inventory.weapons) {
        const w = WEAPONS[wId];
        const upg = st.weaponUpgrades[wId] || 0;
        const equipped = p.equippedWeapon === wId;
        const goldCost = 45 + upg * 45;
        const resKey = upg < 4 ? 'iron' : upg < 7 ? 'mithril' : 'crystal';
        const resCost = 2 + Math.floor(upg / 2);
        const haveRes = st.inventory.resources[resKey] || 0;
        const canUpgrade = upg < 10 && p.gold >= goldCost && haveRes >= resCost;

        const card = document.createElement('div');
        card.className = `item-card ${equipped ? 'equipped-card' : ''}`;
        card.style.borderColor = RARITIES[w.rarity].color;
        card.innerHTML = `
          <div class="item-head">
            <span class="item-icon">${w.icon}</span>
            <div class="item-meta">
              <strong style="color:${RARITIES[w.rarity].color}">${w.name} ${upg > 0 ? '+' + upg : ''}</strong>
              <small>База: ${Math.round(w.baseDamage + upg * 5.5)} ур. · ${w.desc}</small>
            </div>
          </div>
          <div class="item-actions"></div>
        `;
        const act = card.querySelector('.item-actions');
        const eqBtn = makeBtn(equipped ? '✓ В руках' : 'Взять', equipped ? 'btn-disabled' : 'btn-secondary', () => {
          engine.equipItem('weapon', wId);
          renderModalContent();
        });
        eqBtn.disabled = equipped;
        act.appendChild(eqBtn);

        if (upg < 10) {
          const upBtn = makeBtn(
            `Заточить +${upg + 1} (${goldCost}💰, ${haveRes}/${resCost}${RESOURCES[resKey].icon})`,
            canUpgrade ? 'btn-primary' : 'btn-disabled',
            () => {
              if (engine.upgradeWeapon(wId)) renderModalContent();
            }
          );
          upBtn.disabled = !canUpgrade;
          act.appendChild(upBtn);
        } else {
          act.appendChild(makeBtn('МАКС +10', 'btn-disabled', () => {}));
        }
        wList.appendChild(card);
      }

      // 2. Броня и Реликвии
      const arSec = document.createElement('div');
      arSec.className = 'card-panel';
      arSec.innerHTML = `<div class="panel-header"><h3>🛡️ Броня и Реликвии</h3></div><div class="item-list" id="inv-armors"></div>`;
      const arList = arSec.querySelector('#inv-armors');

      for (const aId of st.inventory.armors) {
        const a = ARMORS[aId];
        const eq = p.equippedArmor === aId;
        const card = document.createElement('div');
        card.className = `item-card ${eq ? 'equipped-card' : ''}`;
        card.style.borderColor = RARITIES[a.rarity].color;
        card.innerHTML = `
          <div class="item-head">
            <span class="item-icon">${a.icon}</span>
            <div class="item-meta">
              <strong style="color:${RARITIES[a.rarity].color}">${a.name}</strong>
              <small>+${a.hpBonus} HP · +${a.defense} защиты · ${a.desc}</small>
            </div>
          </div>
          <div class="item-actions"></div>
        `;
        const b = makeBtn(eq ? '✓ Надето' : 'Надеть', eq ? 'btn-disabled' : 'btn-secondary', () => {
          engine.equipItem('armor', aId);
          renderModalContent();
        });
        b.disabled = eq;
        card.querySelector('.item-actions').appendChild(b);
        arList.appendChild(card);
      }

      for (const rId of st.inventory.relics) {
        const r = RELICS[rId];
        const inSlot0 = p.equippedRelics[0] === rId;
        const inSlot1 = p.equippedRelics[1] === rId;
        const card = document.createElement('div');
        card.className = `item-card ${(inSlot0 || inSlot1) ? 'equipped-card' : ''}`;
        card.style.borderColor = RARITIES[r.rarity].color;
        card.innerHTML = `
          <div class="item-head">
            <span class="item-icon">${r.icon}</span>
            <div class="item-meta">
              <strong style="color:${RARITIES[r.rarity].color}">${r.name}</strong>
              <small>${r.desc}</small>
            </div>
          </div>
          <div class="item-actions"></div>
        `;
        const acts = card.querySelector('.item-actions');
        const b1 = makeBtn(inSlot0 ? '✓ Слот 1' : 'В слот 1', inSlot0 ? 'btn-disabled' : 'btn-secondary', () => {
          engine.equipItem('relic', rId, 0);
          renderModalContent();
        });
        const b2 = makeBtn(inSlot1 ? '✓ Слот 2' : 'В слот 2', inSlot1 ? 'btn-disabled' : 'btn-secondary', () => {
          engine.equipItem('relic', rId, 1);
          renderModalContent();
        });
        b1.disabled = inSlot0;
        b2.disabled = inSlot1;
        acts.append(b1, b2);
        arList.appendChild(card);
      }

      // 3. Зелья, Еда и Ресурсы
      const bagSec = document.createElement('div');
      bagSec.className = 'card-panel';
      bagSec.innerHTML = `
        <div class="panel-header"><h3>🧪 Припасы и Ресурсы</h3></div>
        <div class="item-list" id="inv-cons"></div>
        <h4 class="sub-heading">Собранные материалы</h4>
        <div class="res-grid" id="inv-res"></div>
      `;
      const consList = bagSec.querySelector('#inv-cons');
      for (const c of Object.values(CONSUMABLES)) {
        const cnt = st.inventory.consumables[c.id] || 0;
        const isQuick = p.quickConsumable === c.id;
        const card = document.createElement('div');
        card.className = `item-card ${isQuick ? 'equipped-card' : ''}`;
        card.innerHTML = `
          <div class="item-head">
            <span class="item-icon">${c.icon}</span>
            <div class="item-meta">
              <strong>${c.name} <span class="count-tag">×${cnt}</span></strong>
              <small>${c.desc}</small>
            </div>
          </div>
          <div class="item-actions"></div>
        `;
        const acts = card.querySelector('.item-actions');
        const useB = makeBtn('Выпить', cnt > 0 ? 'btn-primary' : 'btn-disabled', () => {
          if (engine.useQuickConsumable(c.id)) renderModalContent();
        });
        useB.disabled = cnt <= 0;
        const qB = makeBtn(isQuick ? '✓ На кнопке' : 'На кнопку HUD', isQuick ? 'btn-disabled' : 'btn-secondary', () => {
          engine.equipItem('consumable', c.id);
          renderModalContent();
        });
        qB.disabled = isQuick;
        acts.append(useB, qB);
        consList.appendChild(card);
      }

      const resGrid = bagSec.querySelector('#inv-res');
      for (const res of Object.values(RESOURCES)) {
        const cnt = st.inventory.resources[res.id] || 0;
        const pill = document.createElement('div');
        pill.className = 'res-pill';
        pill.innerHTML = `<span>${res.icon} ${res.name}</span><strong>${cnt}</strong>`;
        resGrid.appendChild(pill);
      }

      wrap.append(wSec, arSec, bagSec);
      container.appendChild(wrap);
      return;
    }

    if (activeModalTab === 'craft') {
      const wrap = document.createElement('div');
      wrap.className = 'card-panel';
      wrap.innerHTML = `
        <div class="panel-header">
          <h3>🔨 Кузница и Алхимия</h3>
          <span class="gold-pill">💰 ${p.gold} зол.</span>
        </div>
        <div class="res-bar-mini" id="craft-res-bar"></div>
        <div class="item-list" id="recipe-list"></div>
      `;
      const resBar = wrap.querySelector('#craft-res-bar');
      for (const r of Object.values(RESOURCES)) {
        const sp = document.createElement('span');
        sp.textContent = `${r.icon} ${st.inventory.resources[r.id] || 0}`;
        resBar.appendChild(sp);
      }

      const rList = wrap.querySelector('#recipe-list');
      for (const rec of RECIPES) {
        let def = null;
        if (rec.resultType === 'consumable') def = CONSUMABLES[rec.resultId];
        else if (rec.resultType === 'weapon') def = WEAPONS[rec.resultId];
        else if (rec.resultType === 'armor') def = ARMORS[rec.resultId];
        else if (rec.resultType === 'relic') def = RELICS[rec.resultId];
        if (!def) continue;

        const alreadyOwned =
          (rec.resultType === 'weapon' && st.inventory.weapons.includes(rec.resultId)) ||
          (rec.resultType === 'armor' && st.inventory.armors.includes(rec.resultId)) ||
          (rec.resultType === 'relic' && st.inventory.relics.includes(rec.resultId));

        let canAfford = p.gold >= rec.costGold && !alreadyOwned;
        const ingParts = [`<span class="${p.gold >= rec.costGold ? 'ok' : 'lack'}">💰 ${rec.costGold}</span>`];
        for (const [ingId, need] of Object.entries(rec.ingredients)) {
          const have = st.inventory.resources[ingId] || 0;
          if (have < need) canAfford = false;
          ingParts.push(`<span class="${have >= need ? 'ok' : 'lack'}">${RESOURCES[ingId].icon} ${have}/${need}</span>`);
        }

        const card = document.createElement('div');
        card.className = 'item-card';
        card.style.borderColor = RARITIES[def.rarity]?.color || '#475569';
        card.innerHTML = `
          <div class="item-head">
            <span class="item-icon">${def.icon}</span>
            <div class="item-meta">
              <strong style="color:${RARITIES[def.rarity]?.color || '#fff'}">${def.name}${rec.resultCount > 1 ? ' ×' + rec.resultCount : ''}</strong>
              <small>${rec.desc}</small>
              <div class="ing-line">${ingParts.join(' · ')}</div>
            </div>
          </div>
          <div class="item-actions"></div>
        `;
        const b = makeBtn(
          alreadyOwned ? '✓ Создано' : 'Создать',
          canAfford ? 'btn-primary' : 'btn-disabled',
          () => {
            if (engine.craftRecipe(rec.id)) renderModalContent();
          }
        );
        b.disabled = !canAfford;
        card.querySelector('.item-actions').appendChild(b);
        rList.appendChild(card);
      }

      container.appendChild(wrap);
      return;
    }

    if (activeModalTab === 'skills') {
      const wrap = document.createElement('div');
      wrap.className = 'card-panel';
      wrap.innerHTML = `
        <div class="panel-header">
          <h3>⚡ Боевые Способности</h3>
          <span class="badge-pts">Очков умений: ${p.skillPoints} · 🔮 Эссенций: ${st.inventory.resources.soul || 0}</span>
        </div>
        <div class="item-list" id="skills-list"></div>
      `;
      const sList = wrap.querySelector('#skills-list');
      for (const sk of Object.values(SKILLS)) {
        const rank = st.skillRanks[sk.id] || 0;
        const soulCost = rank === 0 ? 1 : rank * 2;
        const canUp = rank < 5 && (p.skillPoints > 0 || (st.inventory.resources.soul || 0) >= soulCost);
        const card = document.createElement('div');
        card.className = 'item-card';
        card.style.borderColor = sk.color;
        card.innerHTML = `
          <div class="item-head">
            <span class="item-icon">${sk.icon}</span>
            <div class="item-meta">
              <strong style="color:${sk.color}">[${sk.keyLabel}] ${sk.name} — Ранг ${rank}/5</strong>
              <small>${sk.desc}</small>
              <small>Перезарядка: ${(sk.baseCooldown * (1 - cs.cdrMult)).toFixed(1)} сек · Выносливость: ${sk.staminaCost}</small>
            </div>
          </div>
          <div class="item-actions"></div>
        `;
        let btnText = 'МАКС 5/5';
        if (rank < 5) {
          btnText = p.skillPoints > 0 ? (rank === 0 ? 'Изучить (1 очко)' : 'Усилить (1 очко)') : `Усилить (${soulCost} 🔮)`;
        }
        const b = makeBtn(btnText, canUp ? 'btn-primary' : 'btn-disabled', () => {
          if (engine.upgradeSkill(sk.id)) renderModalContent();
        });
        b.disabled = !canUp;
        card.querySelector('.item-actions').appendChild(b);
        sList.appendChild(card);
      }
      container.appendChild(wrap);
      return;
    }

    if (activeModalTab === 'quests') {
      const wrap = document.createElement('div');
      wrap.className = 'tab-grid two-col';

      const qCol = document.createElement('div');
      qCol.className = 'card-panel';
      const curQ = engine.getCurrentQuest();
      const qStatus = engine.getQuestStatus(curQ);
      const bBiome = BIOMES[st.bounty.biome]?.name || 'Пустошь';

      qCol.innerHTML = `
        <div class="panel-header"><h3>📜 Сюжет и Контракты</h3></div>
        ${qStatus ? `
          <div class="quest-feature">
            <div class="qf-title">${qStatus.quest.title}</div>
            <p>${qStatus.quest.desc}</p>
            <ul>
              ${qStatus.goals.map(g => `<li class="${g.done ? 'done' : ''}">${g.done ? '✅' : '▫️'} ${g.label}: <b>${g.current}/${g.target}</b></li>`).join('')}
            </ul>
            <div class="qf-reward">Награда: +${qStatus.quest.rewards.gold} 💰 · +${qStatus.quest.rewards.xp} XP</div>
          </div>
        ` : `<div class="quest-feature"><b>🏆 Все сюжетные главы пройдены!</b><p>Вы сокрушили Азариэля! Исследуйте секреты и выполняйте контракты Охотника.</p></div>`}

        <div class="quest-feature bounty-box">
          <div class="qf-title">🎯 Контракт Охотника #${st.bounty.level}</div>
          <p>Локация: <b>${bBiome}</b> — уничтожено ${st.bounty.kills}/${st.bounty.target} врагов</p>
          <div class="qf-reward">Награда: +${st.bounty.rewardGold} 💰 · +${st.bounty.rewardXp} XP</div>
        </div>

        <h4 class="sub-heading">🗝️ Секретные локации (${st.discoveredSecrets.length} / ${SECRETS.length})</h4>
        <div class="secrets-list">
          ${SECRETS.map(s => {
            const found = st.discoveredSecrets.includes(s.id);
            return `<div class="secret-row ${found ? 'found' : ''}">
              <strong>${found ? '✅ ' + s.name : '❓ Неизвестный тайник'}</strong>
              <small>${found ? `Открыто (+${s.bonusHp} макс. HP)` : s.hint}</small>
            </div>`;
          }).join('')}
        </div>
      `;

      const aCol = document.createElement('div');
      aCol.className = 'card-panel';
      aCol.innerHTML = `
        <div class="panel-header">
          <h3>🏆 Достижения</h3>
          <span class="badge-pts">${st.unlockedAchievements.length} / ${ACHIEVEMENTS.length}</span>
        </div>
        <div class="item-list">
          ${ACHIEVEMENTS.map(a => {
            const unlocked = st.unlockedAchievements.includes(a.id);
            return `<div class="ach-row ${unlocked ? 'unlocked' : ''}">
              <span class="ach-icon">${a.icon}</span>
              <div>
                <strong>${a.name} ${unlocked ? '✅' : ''}</strong>
                <small>${a.desc} (Награда: ${a.goldReward} 💰)</small>
              </div>
            </div>`;
          }).join('')}
        </div>
      `;

      wrap.append(qCol, aCol);
      container.appendChild(wrap);
      return;
    }

    if (activeModalTab === 'map') {
      const wrap = document.createElement('div');
      wrap.className = 'tab-grid two-col';
      wrap.innerHTML = `
        <div class="card-panel map-panel">
          <div class="panel-header"><h3>🗺️ Карта Рубежа</h3></div>
          <canvas id="worldmap-canvas" width="340" height="340"></canvas>
          <div class="map-legend">
            <span>🔵 Вы</span>
            <span>🔥 Костёр</span>
            <span>💀 Босс</span>
            <span>🟡 Цель квеста</span>
          </div>
        </div>
        <div class="card-panel">
          <div class="panel-header"><h3>🧭 Быстрое перемещение</h3></div>
          <p class="muted-note">Зажигайте путевые костры в новых землях, чтобы мгновенно перемещаться между ними.</p>
          <div id="ft-list" class="item-list"></div>
        </div>
      `;
      container.appendChild(wrap);

      const wmCanvas = wrap.querySelector('#worldmap-canvas');
      drawWorldMapCanvas(wmCanvas.getContext('2d'), 340, 340);

      const ftList = wrap.querySelector('#ft-list');
      for (const camp of CAMPFIRES) {
        const unlocked = st.unlockedCampfires.includes(camp.id);
        const row = document.createElement('div');
        row.className = 'item-card';
        row.innerHTML = `
          <div class="item-head">
            <span class="item-icon">${unlocked ? '🔥' : '🔒'}</span>
            <div class="item-meta">
              <strong>${camp.name}</strong>
              <small>${BIOMES[camp.biome].name}</small>
            </div>
          </div>
          <div class="item-actions"></div>
        `;
        const b = makeBtn(unlocked ? 'Телепорт' : 'Не открыт', unlocked ? 'btn-primary' : 'btn-disabled', () => {
          if (engine.fastTravel(camp.id)) {
            closeModal();
            updateHud(true);
          }
        });
        b.disabled = !unlocked;
        row.querySelector('.item-actions').appendChild(b);
        ftList.appendChild(row);
      }
      return;
    }

    if (activeModalTab === 'settings') {
      const s = st.settings;
      const wrap = document.createElement('div');
      wrap.className = 'card-panel settings-panel';
      wrap.innerHTML = `
        <div class="panel-header"><h3>⚙️ Настройки и Система</h3></div>

        <div class="setting-row">
          <label>Качество графики (Оптимизация Android)</label>
          <div class="seg-group" id="qual-group">
            <button type="button" data-q="low" class="seg-btn ${s.quality === 'low' ? 'active' : ''}">Низкое (Слабые тел.)</button>
            <button type="button" data-q="medium" class="seg-btn ${s.quality === 'medium' ? 'active' : ''}">Среднее</button>
            <button type="button" data-q="high" class="seg-btn ${s.quality === 'high' ? 'active' : ''}">Высокое</button>
          </div>
        </div>

        <div class="setting-row">
          <label>Громкость эффектов: <b id="sfx-val">${Math.round(s.sfxVolume * 100)}%</b></label>
          <input type="range" id="sfx-slider" min="0" max="100" value="${Math.round(s.sfxVolume * 100)}">
        </div>

        <div class="setting-row">
          <label>Громкость музыки: <b id="mus-val">${Math.round(s.musicVolume * 100)}%</b></label>
          <input type="range" id="mus-slider" min="0" max="100" value="${Math.round(s.musicVolume * 100)}">
        </div>

        <div class="setting-row inline-toggle">
          <span>Без звука (Mute)</span>
          <button type="button" id="btn-mute-toggle" class="ui-btn ${s.muted ? 'btn-primary' : 'btn-secondary'}">${s.muted ? 'Включено' : 'Выключено'}</button>
        </div>

        <div class="setting-row inline-toggle">
          <span>Тряска камеры при ударах</span>
          <button type="button" id="btn-shake-toggle" class="ui-btn ${s.screenShake ? 'btn-primary' : 'btn-secondary'}">${s.screenShake ? 'Включена' : 'Выключена'}</button>
        </div>

        <div class="setting-row inline-toggle">
          <span>Виртуальный джойстик</span>
          <button type="button" id="btn-joy-toggle" class="ui-btn btn-secondary">${s.joystickMode === 'dynamic' ? 'Плавающий' : 'Фиксированный'}</button>
        </div>

        <div class="settings-footer" id="settings-actions"></div>
      `;
      container.appendChild(wrap);

      wrap.querySelectorAll('[data-q]').forEach((btn) => {
        btn.addEventListener('click', () => {
          s.quality = btn.dataset.q;
          renderer.resize();
          engine.saveGame();
          sound.play('ui');
          renderModalContent();
        });
      });

      const sfxSlider = wrap.querySelector('#sfx-slider');
      sfxSlider.addEventListener('input', () => {
        s.sfxVolume = Number(sfxSlider.value) / 100;
        wrap.querySelector('#sfx-val').textContent = `${sfxSlider.value}%`;
        sound.setSettings(s);
        engine.saveGame();
      });

      const musSlider = wrap.querySelector('#mus-slider');
      musSlider.addEventListener('input', () => {
        s.musicVolume = Number(musSlider.value) / 100;
        wrap.querySelector('#mus-val').textContent = `${musSlider.value}%`;
        sound.setSettings(s);
        engine.saveGame();
      });

      wrap.querySelector('#btn-mute-toggle').addEventListener('click', () => {
        s.muted = !s.muted;
        sound.setSettings(s);
        engine.saveGame();
        renderModalContent();
      });

      wrap.querySelector('#btn-shake-toggle').addEventListener('click', () => {
        s.screenShake = !s.screenShake;
        engine.saveGame();
        sound.play('ui');
        renderModalContent();
      });

      wrap.querySelector('#btn-joy-toggle').addEventListener('click', () => {
        s.joystickMode = s.joystickMode === 'dynamic' ? 'fixed' : 'dynamic';
        engine.saveGame();
        sound.play('ui');
        renderModalContent();
      });

      const footer = wrap.querySelector('#settings-actions');
      if (!inMainMenu) {
        footer.appendChild(makeBtn('💾 Сохранить игру', 'btn-primary', () => {
          engine.saveGame();
          engine.pushToast('Прогресс сохранён', 'Данные записаны в память устройства', '#4ade80', '💾');
          closeModal();
        }));
        footer.appendChild(makeBtn('🏠 Главное меню', 'btn-secondary', () => {
          engine.saveGame();
          showMainMenu();
        }));
      } else {
        footer.appendChild(makeBtn('Готово', 'btn-primary', () => closeModal()));
      }
    }
  }

  function drawWorldMapCanvas(g, w, h) {
    const st = engine.state;
    const scale = w / engine.world.width;
    const cellPx = w / engine.FOG_GRID;

    g.fillStyle = '#090d16';
    g.fillRect(0, 0, w, h);

    // Отрисовка открытых ячеек биомов
    for (let gy = 0; gy < engine.FOG_GRID; gy++) {
      for (let gx = 0; gx < engine.FOG_GRID; gx++) {
        const revealed = st.fog[gy * engine.FOG_GRID + gx] === 1;
        const wx = (gx + 0.5) * (engine.world.width / engine.FOG_GRID);
        const wy = (gy + 0.5) * (engine.world.height / engine.FOG_GRID);
        const b = BIOMES[getBiomeIdAt(wx, wy)];
        g.fillStyle = revealed ? b.groundAlt : '#0c1220';
        g.fillRect(gx * cellPx, gy * cellPx, cellPx + 0.6, cellPx + 0.6);
        if (revealed) {
          g.fillStyle = b.accent;
          g.globalAlpha = 0.14;
          g.fillRect(gx * cellPx, gy * cellPx, cellPx + 0.6, cellPx + 0.6);
          g.globalAlpha = 1;
        }
      }
    }

    // Костры
    for (const c of CAMPFIRES) {
      const unlocked = st.unlockedCampfires.includes(c.id);
      g.fillStyle = unlocked ? '#fb923c' : '#64748b';
      g.beginPath(); g.arc(c.x * scale, c.y * scale, 5, 0, Math.PI * 2); g.fill();
    }

    // Боссы
    for (const b of Object.values(BOSSES)) {
      const dead = st.defeatedBosses.includes(b.id);
      g.fillStyle = dead ? '#4ade80' : '#ef4444';
      g.beginPath(); g.arc(b.x * scale, b.y * scale, 6, 0, Math.PI * 2); g.fill();
    }

    // Текущая цель квеста
    const q = engine.getCurrentQuest();
    if (q && q.targetPos) {
      g.strokeStyle = '#fbbf24';
      g.lineWidth = 2;
      g.beginPath(); g.arc(q.targetPos.x * scale, q.targetPos.y * scale, 8, 0, Math.PI * 2); g.stroke();
    }

    // Игрок
    g.fillStyle = '#38bdf8';
    g.strokeStyle = '#ffffff';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(st.player.x * scale, st.player.y * scale, 5.5, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  }

  // ── Экономичное обновление HUD в игровом цикле ───────────────────────
  function updateHud(force = false) {
    if (inMainMenu) return;
    hudTick++;
    if (!force && hudTick % 4 !== 0) return;

    const st = engine.state;
    const p = st.player;

    if (st.gameOver) {
      els.deathOverlay.classList.remove('hidden');
      return;
    }
    if (st.victoryShown && els.victoryOverlay.dataset.seen !== '1') {
      els.victoryOverlay.dataset.seen = '1';
      engine.state.paused = true;
      els.victoryOverlay.classList.remove('hidden');
    }

    const hpPct = Math.max(0, Math.min(100, (p.hp / p.maxHp) * 100));
    const stPct = Math.max(0, Math.min(100, (p.stamina / p.maxStamina) * 100));
    const satPct = Math.max(0, Math.min(100, p.satiety));
    const xpPct = Math.max(0, Math.min(100, (p.xp / p.xpNext) * 100));

    els.hpFill.style.width = `${hpPct.toFixed(1)}%`;
    els.hpText.textContent = `${Math.ceil(p.hp)} / ${p.maxHp}`;
    els.stamFill.style.width = `${stPct.toFixed(1)}%`;
    els.satFill.style.width = `${satPct.toFixed(1)}%`;
    els.xpFill.style.width = `${xpPct.toFixed(1)}%`;
    els.lvlBadge.textContent = `${p.level}`;
    els.goldText.textContent = `${p.gold}`;
    els.biomeText.textContent = BIOMES[st.currentBiome]?.name || 'Рубеж';
    els.timeText.textContent = engine.isNightTime() ? '🌙 Ночь (+30% XP)' : '☀️ День';

    const hasPts = p.statPoints > 0 || p.skillPoints > 0;
    els.heroAlertDot?.classList.toggle('hidden', !hasPts);

    // Иконки оружия и быстрого зелья
    const w = WEAPONS[p.equippedWeapon] || WEAPONS.sword_iron;
    if (els.btnAttackIcon) els.btnAttackIcon.textContent = w.icon;

    const cons = CONSUMABLES[p.quickConsumable] || CONSUMABLES.potion_hp;
    const consCnt = st.inventory.consumables[cons.id] || 0;
    if (els.btnPotionIcon) els.btnPotionIcon.textContent = cons.icon;
    if (els.btnPotionCount) els.btnPotionCount.textContent = `×${consCnt}`;
    if (els.btnPotionCd) {
      els.btnPotionCd.textContent = p.consumableCooldown > 0.1 ? p.consumableCooldown.toFixed(1) : '';
    }

    // Кулдауны 3 способностей
    for (const skId of ['whirlwind', 'thunder_slam', 'aegis_pulse']) {
      const rank = st.skillRanks[skId] || 0;
      const cd = st.skillCooldowns[skId] || 0;
      const btn = els.skillBtns[skId];
      const cdEl = els.skillCds[skId];
      if (!btn || !cdEl) continue;
      btn.classList.toggle('locked', rank <= 0);
      if (rank <= 0) {
        cdEl.textContent = `Ур.${SKILLS[skId].unlockLevel}`;
      } else if (cd > 0.05) {
        cdEl.textContent = cd.toFixed(1);
      } else {
        cdEl.textContent = '';
      }
    }

    // Контекстная кнопка взаимодействия
    if (st.nearbyInteractable) {
      els.btnInteract.classList.remove('hidden');
      els.btnInteractLabel.textContent = st.nearbyInteractable.label;
    } else {
      els.btnInteract.classList.add('hidden');
    }

    // Полоса здоровья активного босса
    if (st.activeBoss && st.activeBoss.hp > 0) {
      els.bossHud.classList.remove('hidden');
      els.bossName.textContent = `${st.activeBoss.name} (${Math.ceil(st.activeBoss.hp)} / ${st.activeBoss.maxHp})`;
      els.bossFill.style.width = `${Math.max(0, (st.activeBoss.hp / st.activeBoss.maxHp) * 100).toFixed(1)}%`;
    } else {
      els.bossHud.classList.add('hidden');
    }

    // Трекер текущего задания
    const curQ = engine.getCurrentQuest();
    if (curQ) {
      const qSt = engine.getQuestStatus(curQ);
      const distM = curQ.targetPos ? Math.round(Math.hypot(curQ.targetPos.x - p.x, curQ.targetPos.y - p.y) / 14) : 0;
      els.questTitle.textContent = `📜 ${curQ.title}${distM > 8 ? ` (${distM} м)` : ''}`;
      els.questGoals.innerHTML = qSt.goals
        .map(g => `<div>${g.done ? '✅' : '•'} ${g.label}: <b>${g.current}/${g.target}</b></div>`)
        .join('');
    } else {
      els.questTitle.textContent = `🎯 Контракт #${st.bounty.level} (${BIOMES[st.bounty.biome]?.name})`;
      els.questGoals.innerHTML = `<div>• Враги: <b>${st.bounty.kills}/${st.bounty.target}</b></div>`;
    }

    // Всплывающие тосты
    renderToasts();

    // Мини-карта (обновляется раз в 12 кадров для экономии батареи)
    if (force || hudTick % 12 === 0) {
      drawMinimap();
    }
  }

  let lastToastSignature = '';
  function renderToasts() {
    const sig = engine.toasts.map(t => t.id).join(',');
    if (sig === lastToastSignature) return;
    lastToastSignature = sig;
    els.toastContainer.innerHTML = '';
    for (const t of engine.toasts) {
      const div = document.createElement('div');
      div.className = 'toast-card';
      div.style.borderLeftColor = t.color;
      div.innerHTML = `<span class="toast-ic">${t.icon}</span><div><strong>${t.title}</strong>${t.subtitle ? `<small>${t.subtitle}</small>` : ''}</div>`;
      els.toastContainer.appendChild(div);
    }
  }

  function drawMinimap() {
    if (!mmCtx) return;
    const st = engine.state;
    const p = st.player;
    const w = 104;
    const h = 104;
    const span = 1200; // радиус обзора мини-карты

    mmCtx.fillStyle = '#090d18';
    mmCtx.fillRect(0, 0, w, h);

    const toMm = (wx, wy) => [
      w * 0.5 + ((wx - p.x) / (span * 2)) * w,
      h * 0.5 + ((wy - p.y) / (span * 2)) * h
    ];

    // Ресурсы и сундуки поблизости
    for (const ch of engine.world.chests) {
      if (ch.opened) continue;
      const [mx, my] = toMm(ch.x, ch.y);
      if (mx < 2 || mx > w - 2 || my < 2 || my > h - 2) continue;
      mmCtx.fillStyle = '#fbbf24';
      mmCtx.fillRect(mx - 2, my - 2, 4, 4);
    }

    for (const c of CAMPFIRES) {
      const [mx, my] = toMm(c.x, c.y);
      if (mx < 2 || mx > w - 2 || my < 2 || my > h - 2) continue;
      mmCtx.fillStyle = '#fb923c';
      mmCtx.beginPath(); mmCtx.arc(mx, my, 3.5, 0, Math.PI * 2); mmCtx.fill();
    }

    // Враги
    mmCtx.fillStyle = '#f87171';
    for (const e of st.enemies) {
      const [mx, my] = toMm(e.x, e.y);
      if (mx < 2 || mx > w - 2 || my < 2 || my > h - 2) continue;
      mmCtx.fillRect(mx - 1.5, my - 1.5, 3, 3);
    }

    if (st.activeBoss) {
      const [bx, by] = toMm(st.activeBoss.x, st.activeBoss.y);
      mmCtx.fillStyle = '#c084fc';
      mmCtx.beginPath(); mmCtx.arc(bx, by, 4.5, 0, Math.PI * 2); mmCtx.fill();
    }

    // Герой в центре мини-карты
    mmCtx.fillStyle = '#38bdf8';
    mmCtx.beginPath(); mmCtx.arc(w * 0.5, h * 0.5, 3.5, 0, Math.PI * 2); mmCtx.fill();
  }

  return {
    showMainMenu,
    refreshMainMenu,
    openTab,
    closeModal,
    isModalOpen,
    onEscape: handleEscape,
    onInteract: handleInteract,
    updateHud
  };
}
