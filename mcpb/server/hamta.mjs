/**
 * Hämtar en veckas material ur InfoMentor.
 *
 * Endpoints kartlagda genom att avlyssna hub-vyernas egna XHR-anrop. Alla är POST.
 * Nyheter, notiser och kalender är de uppenbara; samtycken, dokument, länkar,
 * planeringar och frånvaro är sådant notiserna bara pekar på.
 */
import { loadConfig, updateRefreshToken } from './config.mjs';
import { authenticate } from './auth.mjs';
import { getNews, getNotifications, getCalendarEntries } from './api.mjs';

const HUB = 'https://hub.infomentor.se';

const rensa = (html) =>
  (html || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ').trim();

const ymd = (d) => d.toISOString().slice(0, 10);

async function hub(cookies, path) {
  const r = await fetch(HUB + path, {
    method: 'POST',
    headers: { Cookie: cookies, Accept: 'application/json', 'Content-Type': 'application/json; charset=utf-8' },
  });
  try { return JSON.parse(await r.text()); } catch { return null; }
}

export async function hamtaVecka({ dagarBakat = 7, dagarFramat = 14 } = {}) {
  const cfg = loadConfig();
  const session = await authenticate(cfg.refresh_token);
  if (!session) throw new Error('SESSION_UTGANGEN');
  updateRefreshToken(session.tokens.refresh_token);
  const c = session.cookies;

  const nu = new Date();
  const fran = new Date(nu - dagarBakat * 864e5);
  const till = new Date(nu.getTime() + dagarFramat * 864e5);

  const [nyheter, notiser, kalender, samtycken, dokument, lankar, planeringar, franvaro] =
    await Promise.all([
      getNews(c), getNotifications(c), getCalendarEntries(c, ymd(fran), ymd(till)),
      hub(c, '/Communication/Consents/GetCurrentList'),
      hub(c, '/Communication/Documents/GetDocumentsList'),
      hub(c, '/Communication/Links/GetLinksList'),
      hub(c, '/uolv2/uolv2/appData'),
      hub(c, '/attendance/attendance/appData'),
    ]);

  // InfoMentor lämnar bara ut det barn som är aktivt i portalen.
  let aktivtBarn = cfg.children?.[0]?.name || 'okänt';
  try {
    const html = await (await fetch(HUB + '/', { headers: { Cookie: c } })).text();
    aktivtBarn = html.match(/selectedPupilName: '([^']+)'/)?.[1] || aktivtBarn;
  } catch {}

  const farska = (nyheter || []).filter((n) => {
    const d = new Date(n.publishedDateString);
    return isNaN(d) ? true : d >= fran;
  });

  return {
    barn: aktivtBarn,
    flerBarn: (cfg.children || []).length > 1,
    allaBarn: (cfg.children || []).map((b) => b.name),
    nyheter: farska.map((n) => ({
      titel: n.title,
      av: (n.publishedBy || '').replace(/\s+/g, ' ').trim(),
      datum: (n.publishedDateString || '').slice(0, 10),
      text: rensa(n.content),
      lank: `${HUB}/#/communication/news/${n.id}`,
    })),
    notiser: (notiser || []).map((n) => ({ typ: n.type, titel: n.title, datum: (n.dateSent || '').slice(0, 10) })),
    kalender: (kalender || []).map((k) => ({
      datum: (k.startDate || '').slice(0, 10), titel: k.title, text: rensa(k.description),
    })),
    samtycken: (samtycken?.items || []).map((x) => x.title || x.name || 'Samtyckesbegäran'),
    dokument: (dokument?.items || []).map((d) => ({ titel: d.title, text: rensa(d.description) })),
    lankar: (lankar?.items || []).map((l) => ({ titel: l.name, url: l.url })),
    planeringar: (planeringar?.uols || []).map((u) => ({
      titel: u.title, amnen: (u.subjects || []).map((f) => f.name || f).join(', '),
    })),
    ledighet: (franvaro?.leaveRequests || []).length,
  };
}
