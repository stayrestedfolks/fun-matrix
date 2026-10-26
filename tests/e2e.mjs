// Browser walk-through of the whole tool with your installed Edge or Chrome: npm run e2e [-- --headed]
// Plays every path (full rounds, a tie and its coin, skip-ahead, decide later), checks the share link,
// the PNG, cookies, console errors and which hosts get contacted, and saves screenshots to a temp folder.
import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const out = process.env.FM_SHOTS || join(tmpdir(), "fun-matrix-e2e");
mkdirSync(out, { recursive: true });
const port = 8300 + Math.floor(Math.random() * 500);
const base = `http://localhost:${port}/`;
const exe = ["C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(existsSync);
if (!exe) { console.log("SKIP: no Edge or Chrome found"); process.exit(0); }

let failures = 0;
const ok = (cond, msg) => { console.log(`${cond ? "ok  " : "FAIL"} ${msg}`); if (!cond) failures++; };

const server = spawn(process.execPath, [join(root, "tools/serve.mjs"), String(port)], { stdio: "ignore" });
await new Promise((r) => setTimeout(r, 600));
const browser = await chromium.launch({ executablePath: exe, headless: !process.argv.includes("--headed") });

async function open(viewport, name) {
  const mobile = viewport.width < 600;
  const ctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, acceptDownloads: true, reducedMotion: "reduce" });
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: base.slice(0, -1) });
  const page = await ctx.newPage();
  const errors = [], hosts = new Set();
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("request", (r) => hosts.add(new URL(r.url()).host));
  const shot = async (n) => {
    await page.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 8000 }).catch(() => {});
    await page.screenshot({ path: join(out, `${name}-${n}.png`), fullPage: mobile });
  };
  return { ctx, page, errors, hosts, shot };
}

// Rates an item: x and y from 1 to 5.
async function rate(page, id, x, y) {
  await page.click(`.pip[data-id="${id}"][data-axis="x"][data-v="${x}"]`);
  await page.click(`.pip[data-id="${id}"][data-axis="y"][data-v="${y}"]`);
}

// Icons that came back as lettered discs instead of images.
const discs = (page) => page.evaluate(() => document.querySelectorAll(".letter").length);

async function fullPath(viewport, name) {
  const { ctx, page, errors, hosts, shot } = await open(viewport, name);
  await page.goto(base);
  await page.waitForSelector(".welcome");
  // Warm the cache the way a returning visitor's browser might: the same icons fetched with and without CORS.
  await page.evaluate(async () => {
    const load = (n, cors) => new Promise((r) => { const i = new Image(); if (cors) i.crossOrigin = "anonymous"; i.onload = i.onerror = r; i.src = `https://render.worldofwarcraft.com/us/icons/56/${n}.jpg`; });
    await Promise.all(["ability_warstomp", "classicon_warrior", "ability_warrior_savageblow", "ability_warrior_innerrage"].map((n) => load(n, false)));
    await Promise.all(["ability_warrior_defensivestance", "racial_orc_berserkerstrength"].map((n) => load(n, true)));
  });
  await shot("1-welcome");
  await page.click("text=Start →");
  await page.waitForSelector(".faction-card");
  await page.click("[data-act=coin-faction]");
  await page.waitForSelector(".coin-result b");
  await shot("2-faction");
  await page.click("[data-act=faction][data-id=h]");
  await page.waitForSelector("#mx-race");
  ok((await page.locator(".item").count()) === 5, `${name}: five Horde races to rate`);
  await rate(page, "tau", 5, 5);
  await rate(page, "orc", 3, 3);
  await rate(page, "und", 2, 4);
  await page.click("[data-row=tro] .name");
  ok(await page.locator("#info h2", { hasText: "Troll" }).isVisible(), `${name}: clicking a name shows its facts`);
  ok((await page.locator("#mx-race .dot").count()) === 3, `${name}: three dots on the race matrix`);
  await shot("3-race");
  await page.locator("[data-act=see-pick]:visible").first().click();
  await page.waitForSelector(".dialog");
  ok(await page.locator(".dialog h2", { hasText: "Tauren" }).isVisible(), `${name}: Tauren suggested as top score`);
  await shot("4-suggest");
  await page.click("text=That's the one");
  await page.waitForSelector("#mx-class");
  ok((await page.locator(".item").count()) === 12, `${name}: a Tauren sees 12 specs`);
  await page.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 8000 }).catch(() => {});
  ok((await discs(page)) === 0, `${name}: every class and spec icon loads (no fallback discs)`);
  await rate(page, "war-prot", 5, 4);
  await rate(page, "sha-enh", 4, 5);
  await rate(page, "war-arms", 4, 3);
  await rate(page, "dru-fer", 3, 4);
  await page.click("[data-row=war-prot] .name");
  await shot("5-class");
  await page.locator("[data-act=see-pick]:visible").first().click();
  ok(await page.locator(".dialog .eyebrow", { hasText: "tie" }).isVisible(), `${name}: a 9-9 tie offers the coin`);
  await page.click("[data-act=tie-flip]");
  await page.waitForSelector("text=The coin has spoken");
  await shot("6-coin");
  // Whatever the coin says, keep Protection Warrior.
  const prot = page.locator(".dialog [data-act=confirm][data-id=war-prot]");
  await prot.click();
  await page.waitForSelector(".goal-options");
  await shot("7-goal");
  await page.click("[data-act=goal][data-id=both]");
  await page.waitForSelector("#mx-prof");
  const pairs = await page.locator(".item").evaluateAll((rows) => rows.map((r) => r.dataset.row));
  ok(pairs.includes("min-bs") && !pairs.includes("skin-lw") && !pairs.includes("tail-ench"), `${name}: a Warrior sees plate pairs, not leather or cloth (${pairs.join(" ")})`);
  await rate(page, "min-bs", 5, 4);
  await rate(page, "herb-alc", 3, 3);
  await shot("8-prof");
  await page.locator("[data-act=see-pick]:visible").first().click();
  await page.click("text=That's the one");
  await page.waitForSelector("#card");
  await page.waitForTimeout(300);
  ok(await page.locator("#card h1", { hasText: "Tauren" }).isVisible(), `${name}: result card names Tauren`);
  ok(await page.locator("#card h1", { hasText: "Protection Warrior" }).isVisible(), `${name}: result card names Protection Warrior`);
  const guards = await page.locator(".guard").count();
  ok(guards >= 1 && guards <= 4, `${name}: ${guards} safeguards (1–4)`);
  ok(await page.locator(".whirl", { hasText: "Legacy Points" }).isVisible(), `${name}: the Legacy Points reassurance closes it`);
  ok(await page.locator('a.ext[href$="/talent-calc/warrior"]').count() === 1, `${name}: Wowhead talent link points at Warrior`);
  ok((await page.locator(".mini svg .dot").count()) >= 5, `${name}: the three mini matrices are drawn`);
  await page.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 8000 }).catch(() => {});
  ok((await discs(page)) === 0, `${name}: every icon on the result loads (no fallback discs)`);
  await shot("9-result");

  // The share link, opened fresh, shows the same character.
  const link = page.url();
  await page.click("[data-act=copy]");
  const copied = await page.evaluate(() => navigator.clipboard.readText().catch(() => ""));
  ok(copied === link, `${name}: Copy share link copies the page link`);
  const second = await ctx.newPage();
  await second.goto(link);
  await second.waitForSelector("#card");
  ok(await second.locator("#card h1", { hasText: "Tauren Protection Warrior" }).isVisible(), `${name}: the shared link reopens the same result`);
  await second.close();

  // The PNG.
  const [download] = await Promise.all([page.waitForEvent("download"), page.click("[data-act=png]")]);
  const file = join(out, `${name}-card.png`);
  await download.saveAs(file);
  const png = readFileSync(file);
  const w = png.readUInt32BE(16), h = png.readUInt32BE(20);
  ok(w === 1600 && h === 900 && png.length > 100_000, `${name}: PNG is 1600×900 (${Math.round(png.length / 1024)} KB), saved as ${download.suggestedFilename()}`);

  ok((await ctx.cookies()).length === 0, `${name}: no cookies`);
  ok(await page.evaluate(() => localStorage.length === 0 && sessionStorage.length === 0), `${name}: nothing in browser storage`);
  const allowed = [`localhost:${port}`, "render.worldofwarcraft.com"];
  ok([...hosts].every((hst) => allowed.includes(hst)), `${name}: only talks to ${allowed.join(" and ")} (${[...hosts].join(", ")})`);
  ok(errors.length === 0, `${name}: no console errors${errors.length ? `: ${errors.join(" | ")}` : ""}`);
  await ctx.close();
}

async function skipPath() {
  const { ctx, page, errors, shot } = await open({ width: 1536, height: 768 }, "skip");
  await page.goto(base);
  await page.click("[data-act=skip][data-id=start]");
  await shot("1-picker");
  await page.click("[data-act=pick-direct][data-id='race:hum']");
  await page.waitForSelector("#mx-class");
  ok((await page.locator(".item").count()) === 21, "skip: a Human sees 21 specs (7 classes)");
  await page.click("[data-act=skip][data-id=class]");
  await page.click("[data-act=pick-direct][data-id='class:pal-holy']");
  await page.click("[data-act=goal][data-id=later]");
  await page.waitForSelector("#card");
  await page.waitForTimeout(300);
  ok((await page.locator(".mini.empty").count()) === 3, "skip: three 'picked straight away / deciding later' panels");
  ok(await page.locator(".guard h3", { hasText: "Professions can wait" }).isVisible(), "skip: professions tips when deciding later");
  await shot("2-result");
  await page.click(".fineprint [data-act=sources]");
  const sourceLinks = await page.locator(".dialog .sources a").count();
  ok(sourceLinks >= 50, `skip: the Sources dialog lists ${sourceLinks} sources`);
  await shot("3-sources");
  await page.keyboard.press("Escape");
  ok(await page.locator("#overlay").isHidden(), "skip: Escape closes the dialog");
  // Back and forward keep working.
  await page.goBack();
  ok(await page.locator(".goal-options").isVisible(), "skip: the Back button returns to the professions question");
  ok(errors.length === 0, `skip: no console errors${errors.length ? `: ${errors.join(" | ")}` : ""}`);
  await ctx.close();
}

async function brokenLinks() {
  const { ctx, page, errors } = await open({ width: 1280, height: 800 }, "broken");
  for (const hash of ["#rp=zzz&s=result", "#f=a&rp=tau&cp=war-prot&s=result", "#f=h&rp=tau&cp=pal-prot&g=both&s=result", "#%E0%A4%A", "#r=tau.99&rp=tau&f=h&s=class"]) {
    await page.goto(base + hash);
    await page.waitForSelector("#app .topbar");
    ok(!(await page.locator("#card").count()), `broken link ${hash} doesn't fake a result`);
  }
  ok(errors.length === 0, `broken: no console errors${errors.length ? `: ${errors.join(" | ")}` : ""}`);
  await ctx.close();
}

try {
  await fullPath({ width: 1920, height: 960 }, "desktop");
  await fullPath({ width: 390, height: 844 }, "phone");
  await skipPath();
  await brokenLinks();
} catch (e) {
  failures++;
  console.log("FAIL", e.message);
} finally {
  await browser.close();
  server.kill();
}
console.log(`\n${failures ? `${failures} FAILED` : "All checks passed"}. Screenshots: ${out}`);
process.exitCode = failures ? 1 : 0;
