// The result card as a 1600×900 PNG (16:9: fits Discord, YouTube comments and the video), drawn on a canvas
// in the browser. Icons come from Blizzard's icon service, which allows cross-origin use; any that fail
// become lettered discs. Nothing is uploaded anywhere.
import { layout, placeDots, textWidth, ICON_BASE } from "./matrix.js";

const W = 1600, H = 900;
const C = { ember: "#e2742b", emberDeep: "#a94a12", ink: "#2a1a0e", inkSoft: "#5b4330", parchment: "#efe0bf", parchmentHi: "#f7ecd3",
  edge: "#c9ab78", woodDark: "#2b1a10", wood: "#4a2e1a", cream: "#f6e9cc", horde: "#8e2a1c", alliance: "#24467d" };
const DISPLAY = "Cinzel, Georgia, serif", BODY = '"Alegreya Sans", "Segoe UI", sans-serif';

function loadImage(name) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = `${ICON_BASE}${name}.jpg?fm=1`;   // its own cache entry, always fetched with CORS
  });
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function drawIcon(ctx, img, x, y, size, letter, { round = false } = {}) {
  ctx.save();
  if (round) { ctx.beginPath(); ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2); }
  else roundRect(ctx, x, y, size, size, size * 0.16);
  ctx.clip();
  if (img) ctx.drawImage(img, x, y, size, size);
  else {
    ctx.fillStyle = C.wood; ctx.fillRect(x, y, size, size);
    ctx.fillStyle = C.ember; ctx.font = `900 ${size * 0.5}px ${DISPLAY}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText((letter || "?")[0].toUpperCase(), x + size / 2, y + size / 2 + 2);
  }
  ctx.restore();
}

function frameIcon(ctx, x, y, size, color = "rgba(246,233,204,0.35)") {
  ctx.save();
  roundRect(ctx, x - 3, y - 3, size + 6, size + 6, size * 0.2);
  ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.stroke();
  ctx.restore();
}

function wood(ctx) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#3b2415"); g.addColorStop(1, C.woodDark);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.save();
  for (let x = 0; x < W; x += 11) { ctx.fillStyle = `rgba(0,0,0,${0.04 + ((x * 7) % 5) / 100})`; ctx.fillRect(x, 0, 1, H); }
  for (let x = 140; x < W; x += 140) { ctx.fillStyle = "rgba(0,0,0,0.18)"; ctx.fillRect(x, 0, 2, H); }
  const glow = ctx.createRadialGradient(W / 2, 0, 0, W / 2, 0, W * 0.6);
  glow.addColorStop(0, "rgba(226,116,43,0.12)"); glow.addColorStop(1, "rgba(226,116,43,0)");
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
  const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, W * 0.75);
  vig.addColorStop(0, "rgba(0,0,0,0)"); vig.addColorStop(1, "rgba(0,0,0,0.5)");
  ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H);
  ctx.restore();
  // Frame and rivets.
  roundRect(ctx, 16, 16, W - 32, H - 32, 16);
  ctx.strokeStyle = "rgba(255,220,170,0.16)"; ctx.lineWidth = 2; ctx.stroke();
  for (const [x, y] of [[30, 30], [W - 30, 30], [30, H - 30], [W - 30, H - 30]]) {
    ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fillStyle = "#6d6a66"; ctx.fill();
    ctx.beginPath(); ctx.arc(x - 1, y - 1, 2, 0, Math.PI * 2); ctx.fillStyle = "#b9b4ad"; ctx.fill();
  }
}

function banner(ctx, x, y, w, h, color, img) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + h * 0.82); ctx.lineTo(x + w / 2, y + h); ctx.lineTo(x, y + h * 0.82); ctx.closePath();
  ctx.fillStyle = color; ctx.shadowColor = "rgba(0,0,0,0.5)"; ctx.shadowBlur = 12; ctx.shadowOffsetY = 4; ctx.fill();
  ctx.restore();
  const s = w * 0.68;
  drawIcon(ctx, img, x + (w - s) / 2, y + w * 0.16, s, "", { round: true });
}

function fitText(ctx, text, maxW, size, weight, family) {
  let s = size;
  do { ctx.font = `${weight} ${s}px ${family}`; s -= 2; } while (ctx.measureText(text).width > maxW && s > 12);
}

function mini(ctx, m, x, y, w, h, icons) {
  // Parchment panel with its title.
  ctx.save();
  roundRect(ctx, x, y, w, h, 12);
  ctx.fillStyle = C.parchment; ctx.shadowColor = "rgba(0,0,0,0.45)"; ctx.shadowBlur = 18; ctx.shadowOffsetY = 6; ctx.fill();
  ctx.restore();
  const shade = ctx.createRadialGradient(x + w / 2, y + h / 2, h * 0.3, x + w / 2, y + h / 2, w * 0.75);
  shade.addColorStop(0, "rgba(255,250,235,0.35)"); shade.addColorStop(1, "rgba(120,80,30,0.22)");
  roundRect(ctx, x, y, w, h, 12); ctx.fillStyle = shade; ctx.fill();
  ctx.strokeStyle = C.edge; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = C.inkSoft; ctx.font = `900 20px ${DISPLAY}`; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
  ctx.fillText(m.title.toUpperCase(), x + w / 2, y + 34);
  const px = x + 14, py = y + 48, pw = w - 28, ph = h - 60;
  if (!m.items.length) {
    ctx.fillStyle = C.inkSoft; ctx.font = `italic 400 24px ${BODY}`;
    ctx.fillText(m.note || "Picked straight away", x + w / 2, y + h / 2 + 10);
    return;
  }
  const g = layout(pw, ph, { compact: true, font: 17 });
  const P = { x: px + g.plot.x, y: py + g.plot.y, w: g.plot.w, h: g.plot.h };
  ctx.save();
  ctx.translate(px, py);
  ctx.fillStyle = "rgba(255,250,235,0.4)"; roundRect(ctx, g.plot.x, g.plot.y, g.plot.w, g.plot.h, 6); ctx.fill();
  ctx.fillStyle = "rgba(226,116,43,0.12)"; ctx.fillRect(g.midX, g.plot.y, g.plot.w / 2, g.plot.h / 2);
  ctx.strokeStyle = "rgba(91,67,48,0.16)"; ctx.lineWidth = 1;
  for (let i = 1; i < 5; i++) {
    const gx = g.plot.x + (g.plot.w / 5) * i, gy = g.plot.y + (g.plot.h / 5) * i;
    ctx.beginPath(); ctx.moveTo(gx, g.plot.y); ctx.lineTo(gx, g.plot.y + g.plot.h); ctx.moveTo(g.plot.x, gy); ctx.lineTo(g.plot.x + g.plot.w, gy); ctx.stroke();
  }
  ctx.setLineDash([2, 6]); ctx.lineCap = "round"; ctx.strokeStyle = "rgba(91,67,48,0.55)"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(g.midX, g.plot.y); ctx.lineTo(g.midX, g.plot.y + g.plot.h); ctx.moveTo(g.plot.x, g.midY); ctx.lineTo(g.plot.x + g.plot.w, g.midY); ctx.stroke();
  ctx.setLineDash([]);
  roundRect(ctx, g.plot.x, g.plot.y, g.plot.w, g.plot.h, 6); ctx.strokeStyle = C.edge; ctx.lineWidth = 2; ctx.stroke();
  // Quadrant names, fitted to their quarter.
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  const qx = { l: g.plot.x + g.plot.w / 4, r: g.plot.x + (g.plot.w * 3) / 4 }, qy = { t: g.plot.y + g.plot.h / 4, b: g.plot.y + (g.plot.h * 3) / 4 };
  for (const [k, qxx, qyy] of [["tl", qx.l, qy.t], ["tr", qx.r, qy.t], ["bl", qx.l, qy.b], ["br", qx.r, qy.b]]) {
    const label = m.quadrants[k].toUpperCase();
    const size = Math.min(g.font * 1.2, (g.plot.w / 2 - 10) / (label.length * 0.8));
    if (size < 8) continue;
    ctx.font = `900 ${size}px ${DISPLAY}`;
    ctx.fillStyle = k === "tr" ? "rgba(169,74,18,0.6)" : "rgba(91,67,48,0.38)";
    ctx.fillText(label, qxx, qyy);
  }
  // Axis ends (and names when they fit).
  const f = g.font, by = g.plot.y + g.plot.h + f * 1.3;
  ctx.textBaseline = "alphabetic";
  ctx.font = `700 ${f}px ${BODY}`; ctx.fillStyle = C.inkSoft; ctx.textAlign = "left"; ctx.fillText(m.axes.x.lo, g.plot.x, by);
  ctx.fillStyle = C.emberDeep; ctx.textAlign = "right"; ctx.fillText(m.axes.x.hi, g.plot.x + g.plot.w, by);
  const xName = `${m.axes.x.name.toUpperCase()} →`;
  if (textWidth(m.axes.x.lo, f) + textWidth(m.axes.x.hi, f) + textWidth(xName, f * 0.9, "caps") + 24 <= g.plot.w) {
    ctx.font = `700 ${f * 0.9}px ${DISPLAY}`; ctx.fillStyle = C.inkSoft; ctx.textAlign = "center"; ctx.fillText(xName, g.midX, by);
  }
  ctx.save();
  ctx.translate(f * 1.1, g.plot.y + g.plot.h); ctx.rotate(-Math.PI / 2);
  ctx.font = `700 ${f}px ${BODY}`; ctx.fillStyle = C.inkSoft; ctx.textAlign = "left"; ctx.fillText(m.axes.y.lo, 0, 0);
  ctx.fillStyle = C.emberDeep; ctx.textAlign = "right"; ctx.fillText(m.axes.y.hi, g.plot.h, 0);
  ctx.restore();
  // Dots, the pick last and ringed in ember.
  const placed = placeDots(m.items, g).sort((a, b) => (a.item.id === m.chosenId) - (b.item.id === m.chosenId));
  for (const p of placed) {
    const chosen = p.item.id === m.chosenId;
    const r = g.r;
    if (chosen) { ctx.beginPath(); ctx.arc(p.x, p.y, r + 7, 0, Math.PI * 2); ctx.strokeStyle = "rgba(226,116,43,0.55)"; ctx.lineWidth = 3; ctx.stroke(); }
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fillStyle = C.woodDark; ctx.fill();
    drawIcon(ctx, icons.get(p.item.icon), p.x - r + 2.5, p.y - r + 2.5, (r - 2.5) * 2, p.item.label, { round: true });
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.strokeStyle = chosen ? C.ember : C.parchmentHi; ctx.lineWidth = chosen ? 4 : 2.5; ctx.stroke();
    const br = Math.max(8, r * 0.46), bx = p.x + r * 0.82, byy = p.y - r * 0.78;
    ctx.beginPath(); ctx.arc(bx, byy, br, 0, Math.PI * 2); ctx.fillStyle = chosen ? C.ember : C.wood; ctx.fill(); ctx.strokeStyle = C.parchmentHi; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = C.cream; ctx.font = `900 ${br * 1.05}px ${DISPLAY}`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(String(p.item.score), bx, byy + 1);
    if (chosen) {
      const ly = p.labelBelow ? p.y + r + f * 1.05 : p.y - r - f * 0.6;
      ctx.font = `700 ${f}px ${BODY}`; ctx.textBaseline = "alphabetic"; ctx.lineJoin = "round";
      ctx.strokeStyle = C.parchmentHi; ctx.lineWidth = 4; ctx.strokeText(p.item.short || p.item.label, p.x, ly);
      ctx.fillStyle = C.ink; ctx.fillText(p.item.short || p.item.label, p.x, ly);
    }
  }
  ctx.restore();
}

export async function drawCard(card) {
  await Promise.all(["900 64px Cinzel", "700 20px Cinzel", '400 20px "Alegreya Sans"', '700 20px "Alegreya Sans"', 'italic 400 20px "Alegreya Sans"'].map((f) => document.fonts.load(f)));
  const names = new Set([card.factionIcon, card.raceIcon, card.specIcon, ...card.profIcons, ...card.minis.flatMap((m) => m.items.map((i) => i.icon))]);
  const icons = new Map(await Promise.all([...names].map(async (n) => [n, await loadImage(n)])));

  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");
  wood(ctx);

  // Header.
  ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";
  ctx.font = `900 34px ${DISPLAY}`; ctx.fillStyle = C.cream; ctx.fillText("THE FUN", 56, 78);
  const wFun = ctx.measureText("THE FUN ").width;
  ctx.fillStyle = C.ember; ctx.fillText("MATRIX", 56 + wFun, 78);
  const wAll = wFun + ctx.measureText("MATRIX").width;
  ctx.font = `400 22px ${BODY}`; ctx.fillStyle = "rgba(246,233,204,0.8)"; ctx.fillText("by Stay Rested", 56 + wAll + 14, 78);
  ctx.textAlign = "right"; ctx.font = `700 15px ${DISPLAY}`; ctx.fillStyle = C.ember;
  ctx.fillText("MY WOW FOREVER CHARACTER", W - 56, 76);

  // Banner and the name.
  banner(ctx, 56, 116, 92, 128, card.factionId === "a" ? C.alliance : C.horde, icons.get(card.factionIcon));
  ctx.textAlign = "left";
  fitText(ctx, card.race, 760, 66, 900, DISPLAY); ctx.fillStyle = C.cream; ctx.fillText(card.race, 176, 172);
  fitText(ctx, card.spec, 760, 56, 900, DISPLAY); ctx.fillStyle = C.ember; ctx.fillText(card.spec, 176, 236);
  ctx.font = `400 26px ${BODY}`; ctx.fillStyle = "rgba(246,233,204,0.9)"; ctx.fillText(`${card.profs} · ${card.faction}`, 176, 282);

  // The three picks as big icons.
  const tiles = [["RACE", [card.raceIcon], card.race], ["CLASS & SPEC", [card.specIcon], card.spec], ["PROFESSIONS", card.profIcons, card.profs]];
  tiles.forEach(([k, list, label], i) => {
    const tx = 980 + i * 196, ty = 104, tw = 180, th = 196;
    roundRect(ctx, tx, ty, tw, th, 12); ctx.fillStyle = "rgba(0,0,0,0.24)"; ctx.fill(); ctx.strokeStyle = "rgba(246,233,204,0.18)"; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.textAlign = "center"; ctx.font = `700 13px ${DISPLAY}`; ctx.fillStyle = C.ember; ctx.fillText(k, tx + tw / 2, ty + 28);
    const size = list.length > 1 ? 60 : 76, gap = 8;
    const total = list.length * size + (list.length - 1) * gap;
    list.forEach((n, j) => { const ix = tx + (tw - total) / 2 + j * (size + gap), iy = ty + 44 + (76 - size) / 2; drawIcon(ctx, icons.get(n), ix, iy, size, label); frameIcon(ctx, ix, iy, size); });
    ctx.fillStyle = C.cream;
    const words = label.split(" ");
    const lines = []; let line = "";
    ctx.font = `700 18px ${BODY}`;
    for (const w of words) { const t = line ? `${line} ${w}` : w; if (ctx.measureText(t).width > tw - 16 && line) { lines.push(line); line = w; } else line = t; }
    lines.push(line);
    lines.slice(0, 2).forEach((l, j) => ctx.fillText(l, tx + tw / 2, ty + 150 + j * 22));
  });

  // The three matrices.
  card.minis.forEach((m, i) => mini(ctx, m, 56 + i * 504, 334, 480, 470, icons));

  // Footer.
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left"; ctx.font = `700 20px ${BODY}`; ctx.fillStyle = C.cream;
  ctx.fillText(`Make your own: ${card.site}`, 56, 852);
  ctx.textAlign = "right"; ctx.font = `400 17px ${BODY}`; ctx.fillStyle = "rgba(246,233,204,0.7)";
  ctx.fillText("youtube.com/@StayRestedFolks · Free fan tool, not affiliated with Blizzard Entertainment", W - 56, 852);
  return canvas;
}

export async function exportPng(card) {
  const canvas = await drawCard(card);
  const blob = await new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png"));
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = card.file;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return blob;
}
