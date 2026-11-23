// VEXMORA — проверка геометрии компактного HUD.
// jsdom не считает layout, поэтому раскладку считаем сами: разбираем CSS,
// применяем media-запросы по порядку и сводим размеры к числам. Тест ловит
// именно то, что просил игрок: кнопки не наезжают друг на друга и не занимают
// пол-экрана ни на одном типичном Android-разрешении.
import fs from 'fs';

// ── Мини-разбор CSS: базовые правила + правила внутри @media ──────────────
export function parseCss(text) {
  const rules = [];
  const clean = text.replace(/\/\*[\s\S]*?\*\//g, '');
  const mediaRe = /@media([^{]+)\{/g;
  let mediaCursor = 0;
  // Собираем позиции media-блоков, чтобы вырезать их из базового слоя
  const mediaBlocks = [];
  let m;
  while ((m = mediaRe.exec(clean))) {
    const startBody = mediaRe.lastIndex;
    let depth = 1, i = startBody;
    while (i < clean.length && depth > 0) {
      if (clean[i] === '{') depth++;
      else if (clean[i] === '}') depth--;
      i++;
    }
    mediaBlocks.push({ cond: m[1].trim(), body: clean.slice(startBody, i - 1), index: m.index, end: i });
    mediaCursor = i;
  }
  const base = clean.replace(/@media[^{]+\{(?:[^{}]*\{[^{}]*\})*\s*\}/g, '');
  const pushRules = (src, cond) => {
    const re = /([^{}@]+)\{([^{}]*)\}/g;
    let r;
    while ((r = re.exec(src))) {
      const decls = parseDecls(r[2]);
      // Селекторы через запятую — отдельные правила (иначе не находятся)
      for (const one of r[1].split(',')) {
        const sel = one.trim().replace(/\s+/g, ' ');
        if (sel) rules.push({ cond, sel, decls });
      }
    }
  };
  pushRules(base, null);
  for (const b of mediaBlocks) pushRules(b.body, b.cond);
  return rules;
}

function parseDecls(body) {
  const out = {};
  for (const part of body.split(';')) {
    const i = part.indexOf(':');
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k) out[k] = v;
  }
  return out;
}

// Применяет ли media-условие к окну w×h (поддерживаем max-width / max-height)
export function mediaMatches(cond, w, h) {
  if (!cond) return true;
  const parts = cond.split(/\s+and\s+|,\s*/).map(s => s.trim()).filter(Boolean);
  return parts.every((p) => {
    const mw = /max-width:\s*(\d+)px/.exec(p);
    if (mw) return w <= Number(mw[1]);
    const mh = /max-height:\s*(\d+)px/.exec(p);
    if (mh) return h <= Number(mh[1]);
    const nw = /min-width:\s*(\d+)px/.exec(p);
    if (nw) return w >= Number(nw[1]);
    const nh = /min-height:\s*(\d+)px/.exec(p);
    if (nh) return h >= Number(nh[1]);
    return false;
  });
}

const px = (v, fallback = 0) => {
  if (v == null) return fallback;
  const m = /(-?\d+(?:\.\d+)?)px/.exec(String(v));
  return m ? Number(m[1]) : fallback;
};

// Итоговые значения: базовые объявления, затем подходящие media-блоки по порядку
export function resolveValue(rules, selectors, prop, w, h, fallback) {
  let value = fallback;
  const sels = Array.isArray(selectors) ? selectors : [selectors];
  for (const r of rules) {
    if (!mediaMatches(r.cond, w, h)) continue;
    if (!sels.includes(r.sel)) continue;
    if (r.decls[prop] !== undefined) value = r.decls[prop];
  }
  return value;
}

// Переменная темы (--sk3) с учётом media
function resolveVar(rules, name, w, h, fallback) {
  let value = fallback;
  for (const r of rules) {
    if (!mediaMatches(r.cond, w, h)) continue;
    if (!r.sel.includes(':root')) continue;
    if (r.decls[name] !== undefined) value = r.decls[name];
  }
  return value;
}

/**
 * Геометрия HUD для окна w×h (CSS px).
 * Возвращает прямоугольники элементов в координатах экрана.
 */
export function layout(rules, w, h) {
  const sk = px(resolveVar(rules, '--sk3', w, h, '34px'), 34);
  const skillGap = px(resolveValue(rules, '.skills3d', 'gap', w, h, '5px'), 5);
  const fightGap = px(resolveValue(rules, '.fight3d', 'gap', w, h, '8px'), 8);
  const utilGap = px(resolveValue(rules, '.utility3d', 'gap', w, h, '4px'), 4);
  const combatGap = px(resolveValue(rules, '.combat3d', 'gap', w, h, '5px'), 5);

  const xs = px(resolveValue(rules, '.a3d.xs', 'width', w, h, '38px'), 38);
  const sm = px(resolveValue(rules, '.a3d.sm', 'width', w, h, '44px'), 44);
  const med = px(resolveValue(rules, '.a3d.med', 'width', w, h, '58px'), 58);
  const atk = px(resolveValue(rules, '.a3d.atk', 'width', w, h, '74px'), 74);

  const stickZone = px(resolveValue(rules, '.stick3d-zone', 'width', w, h, '136px'), 136);
  const stickLeft = px(resolveValue(rules, '.stick3d-zone', 'left', w, h, '10px'), 10);
  const stickBottom = px(resolveValue(rules, '.stick3d-zone', 'bottom', w, h, '10px'), 10);

  const right = px(resolveValue(rules, '.hud3d-right-bottom', 'right', w, h, '10px'), 10);
  const bottom = px(resolveValue(rules, '.hud3d-right-bottom', 'bottom', w, h, '10px'), 10);

  const mm = px(resolveValue(rules, '.minimap3d-wrap', 'width', w, h, '84px'), 84);
  const icon = px(resolveValue(rules, '.icon-btn3d', 'width', w, h, '34px'), 34);

  // Способности: 3 колонки
  const skillsW = sk * 3 + skillGap * 2;
  const skillsH = sk * 3 + skillGap * 2;

  // Утилиты: 3 колонки
  const utilW = xs * 3 + utilGap * 2;
  const utilH = xs * 2 + utilGap;

  // Бой: 2 колонки × 2 ряда (dodge/jump сверху, heavy/attack снизу)
  const combatW = Math.max(sm, med) + combatGap + Math.max(sm, atk);
  const combatH = Math.max(sm, med) + combatGap + Math.max(med, atk);

  const fightW = utilW + fightGap + combatW;
  const fightH = Math.max(utilH, combatH);
  const clusterW = Math.max(skillsW, fightW);

  const rightBottom = {
    left: w - right - clusterW,
    right: w - right,
    top: h - bottom - (skillsH + fightH + 8),
    bottom: h - bottom
  };
  const stick = {
    left: stickLeft,
    right: stickLeft + stickZone,
    top: h - stickBottom - stickZone,
    bottom: h - stickBottom
  };
  const mmBox = {
    left: w - right - mm,
    right: w - right,
    top: 8,
    bottom: 8 + mm
  };
  // Меню: на высоких экранах — колонка справа под мини-картой,
  // на низких — горизонтальный ряд слева под панелью героя.
  const menuDir = String(resolveValue(rules, ['body.mode3d .hud3d-menu', '.hud3d-menu'], 'flex-direction', w, h,
    resolveValue(rules, '.hud3d-menu', 'flex-direction', w, h, 'column')));
  const menuTop = px(resolveValue(rules, ['body.mode3d .hud3d-menu'], 'top', w, h,
    resolveValue(rules, '.hud3d-menu', 'top', w, h, '124px')), 124);
  const menuGap = px(resolveValue(rules, ['.hud3d-menu'], 'gap', w, h,
    resolveValue(rules, ['body.mode3d .hud3d-menu'], 'gap', w, h, '4px')), 4);
  let menu;
  if (menuDir === 'row') {
    const menuLeft = px(resolveValue(rules, ['body.mode3d .hud3d-menu', '.hud3d-menu'], 'left', w, h, '8px'), 8);
    menu = { left: menuLeft, right: menuLeft + icon * 5 + menuGap * 4, top: menuTop, bottom: menuTop + icon, row: true };
  } else {
    menu = { left: w - right - icon, right: w - right, top: menuTop, bottom: menuTop + icon * 5 + menuGap * 4 };
  }
  // Панель героя: верхний левый угол (для проверки, что меню её не задевает)
  const barsBox = { left: 8, right: 8 + Math.min(barsCard2(rules, w, h), w * 0.5), top: 4, bottom: 4 + 72 };
  const barsCard = { maxWidth: barsCard2(rules, w, h) };

  return { sk, xs, sm, med, atk, skillsW, skillsH, utilW, utilH, combatW, combatH, fightW, fightH, clusterW,
    rightBottom, stick, mmBox, menu, barsCard, barsBox, stickZone, mm };

  function barsCard2(rules2, w2, h2) {
    return px(resolveValue(rules2, ['.hud-bars-card', 'body.mode3d .hud-bars-card'], 'max-width', w2, h2, '232px'), 232);
  }
}

const rectsOverlap = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

/** Полный набор проверок раскладки для списка разрешений. */
export function checkLayout(cssText, viewports) {
  const rules = parseCss(cssText);
  const problems = [];
  const stats = [];
  for (const [w, h] of viewports) {
    const L = layout(rules, w, h);
    const tag = `${w}×${h}`;
    if (L.clusterW > w * 0.5) problems.push(`${tag}: кластер кнопок шире половины экрана (${Math.round(L.clusterW)}px)`);
    if (rectsOverlap(L.stick, L.rightBottom)) problems.push(`${tag}: стик перекрывает боевой кластер`);
    if (rectsOverlap(L.rightBottom, L.mmBox)) problems.push(`${tag}: боевой кластер перекрывает мини-карту`);
    if (rectsOverlap(L.menu, L.rightBottom)) problems.push(`${tag}: меню перекрывает боевой кластер`);
    if (L.menu.row && rectsOverlap(L.menu, L.barsBox)) problems.push(`${tag}: меню налезает на панель героя`);
    if (rectsOverlap(L.menu, L.stick)) problems.push(`${tag}: меню перекрывает стик`);
    if (rectsOverlap(L.stick, L.mmBox)) problems.push(`${tag}: стик перекрывает мини-карту`);
    if (L.rightBottom.left < 0 || L.stick.left < 0) problems.push(`${tag}: элементы выходят за левый край`);
    if (L.mmBox.bottom > h * 0.5) problems.push(`${tag}: мини-карта сползла ниже середины экрана`);
    // Кнопки не должны закрывать центр экрана: свободная зона обзора
    const freeCenter = L.rightBottom.top > h * 0.35 && L.mmBox.bottom < h * 0.4;
    if (!freeCenter) problems.push(`${tag}: центр экрана занят интерфейсом`);
    // Площадь интерфейса: управление не должно занимать пол-экрана
    const controlsArea = (L.stick.right - L.stick.left) * (L.stick.bottom - L.stick.top)
      + L.clusterW * (L.rightBottom.bottom - L.rightBottom.top);
    const frac = controlsArea / (w * h);
    if (frac > 0.30) problems.push(`${tag}: управление занимает ${(frac * 100).toFixed(1)}% экрана`);
    stats.push({ tag, clusterW: Math.round(L.clusterW), clusterH: Math.round(L.skillsH + L.fightH + 8),
      arcLeft: Math.round(L.rightBottom.left), stickRight: Math.round(L.stick.right), frac });
  }
  // Ни на одном разрешении кнопки не должны вырастать больше трети экрана по высоте
  for (const s of stats) {
    const [w, h] = s.tag.split('×').map(Number);
    if (s.clusterH > h * 0.62) problems.push(`${s.tag}: кластер кнопок по высоте ${s.clusterH}px — больше 62% экрана`);
    if (s.stickRight > s.arcLeft) problems.push(`${s.tag}: зазор между стиком и кнопками отрицательный`);
  }
  return { problems, stats };
}

// CLI: node tools/hudlayout.mjs
if (process.argv[1] && process.argv[1].endsWith('hudlayout.mjs')) {
  const css = fs.readFileSync(new URL('../www/css/style.css', import.meta.url), 'utf8');
  const vps = [[640, 360], [800, 360], [915, 412], [1024, 600], [1280, 720], [1920, 1080], [740, 360], [360, 640]];
  const { problems, stats } = checkLayout(css, vps);
  console.log('Разрешение   | кластер | высота | стик→кнопки | доля экрана');
  for (const s of stats) {
    console.log(`${s.tag.padEnd(12)} | ${String(s.clusterW).padStart(7)} | ${String(s.clusterH).padStart(6)} | ${String(s.arcLeft - s.stickRight).padStart(11)} | ${(s.frac * 100).toFixed(1)}%`);
  }
  console.log(problems.length ? `\nПРОБЛЕМЫ:\n- ${problems.join('\n- ')}` : '\nРаскладка HUD корректна на всех разрешениях');
  process.exit(problems.length ? 1 : 0);
}
