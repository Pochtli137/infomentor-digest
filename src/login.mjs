/**
 * Inloggning som fångar OAuth-koden via CDP i stället för request-interception.
 *
 * Servern svarar på LoginOAuth2 med en 302 till InfomentorNotification://oauth2Callback?code=...
 * Chrome kan inte öppna det schemat och avbryter navigeringen (ERR_ABORTED), vilket gör att
 * både page.url() och request-interception missar koden. CDP:s Network-domän ser däremot
 * redirecten innan den kastas.
 */
import puppeteer from 'puppeteer';
import { getAccount } from './auth.mjs';
import { saveConfig, getConfigPath } from './config.mjs';

const browser = await puppeteer.launch({
  headless: false, defaultViewport: { width: 1280, height: 900 }, args: ['--no-sandbox'],
});
const page = await browser.newPage();
await page.goto('https://infomentor.se/swedish/production/mentor/', { waitUntil: 'networkidle2', timeout: 30000 });

console.log('Logga in med BankID. Väntar på hub...');
const sidor = new Set([page]);
browser.on('targetcreated', async (t) => { if (t.type() === 'page') { const p = await t.page(); if (p) sidor.add(p); } });

const deadline = Date.now() + 10 * 60 * 1000;
let hub = null;
while (Date.now() < deadline && !hub) {
  for (const p of sidor) {
    try {
      if (p.isClosed()) continue;
      const u = p.url();
      if (u.includes('hub.infomentor.se') && !u.includes('/authentication/') && !u.includes('/login')) { hub = p; break; }
    } catch {}
  }
  if (!hub) await new Promise((r) => setTimeout(r, 1000));
}
if (!hub) { console.error('Timeout.'); await browser.close(); process.exit(1); }
console.log('Inloggad.');
await new Promise((r) => setTimeout(r, 3000));

// CDP-lyssnare: fånga varje URL som bär en OAuth-kod, oavsett schema.
const cdp = await hub.createCDPSession();
await cdp.send('Network.enable');
let kod = '';
const fånga = (u) => { if (!kod && u && u.includes('code=')) { const m = u.match(/[?&]code=([^&]+)/); if (m) kod = decodeURIComponent(m[1]); } };
cdp.on('Network.requestWillBeSent', (e) => { fånga(e.request?.url); fånga(e.redirectResponse?.headers?.Location || e.redirectResponse?.headers?.location); });
cdp.on('Network.responseReceived', (e) => fånga(e.response?.headers?.Location || e.response?.headers?.location));

console.log('Begär auktorisering...');
const d = await hub.evaluate(async () => {
  const res = await fetch('/account/pair/GetAuthenticationData', { method: 'POST', credentials: 'include' });
  return res.json();
});

const authorizeUrl = d.authenticationUrl
  .replace('{DeviceIdentifier}', 'infomentor-mcp-' + Date.now())
  .replace('{DeviceFriendlyName}', 'InfoMentor-MCP')
  .replace('{DeviceType}', 'Android')
  + '&scope=IM2-API-NOTIFICATION'
  + '&redirect_uri=' + encodeURIComponent('InfomentorNotification://oauth2Callback')
  + '&client_id=notificationapp&response_type=code';

try { await hub.goto(authorizeUrl, { waitUntil: 'domcontentloaded', timeout: 15000 }); }
catch { /* ERR_ABORTED är väntat: redirecten går till ett schema Chrome inte kan öppna */ }
await new Promise((r) => setTimeout(r, 2500));
fånga(hub.url());

if (!kod) { console.error('Ingen auktoriseringskod fångad.'); await browser.close(); process.exit(1); }
console.log('Kod fångad.');

const tokenRes = await fetch(d.tokenUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    code: kod, client_id: 'notificationapp', client_secret: 'NONE',
    redirect_uri: 'InfomentorNotification://oauth2Callback', grant_type: 'authorization_code',
  }),
});
const tokens = await tokenRes.json();
if (!tokens.access_token || !tokens.refresh_token) {
  console.error('Token-utbyte misslyckades:', JSON.stringify(tokens).slice(0, 200));
  await browser.close(); process.exit(1);
}

const konto = await getAccount(tokens.access_token);
const children = (konto?.pupils || []).map((p) => ({ name: (p.firstName + ' ' + p.lastName).trim(), switchId: p.userRoleId }));
saveConfig({ refresh_token: tokens.refresh_token, children });

console.log('\nKlart. Config:', getConfigPath());
console.log('Konto:', konto?.name || 'okänt');
console.log('Barn:', children.map((c) => c.name).join(', ') || 'inga');
await browser.close();
