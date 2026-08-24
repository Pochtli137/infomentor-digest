/** Skickar veckobrevet med Gmail eller valfri SMTP-server. */
import nodemailer from 'nodemailer';

export function bygg(html, { barn, flerBarn, allaBarn }) {
  const nu = new Date();
  const v = vecka(nu);
  const fot = flerBarn
    ? `<p class="not">InfoMentor lämnar bara ut det barn som är aktivt i portalen, just nu ${barn}.
       Byt barn där för att få med ${allaBarn.filter((n) => !lika(n, barn)).join(', ')}.</p>`
    : '';
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:620px;margin:0 auto;
      padding:22px;color:#24272B;line-height:1.6}
    h1{font-size:23px;border-bottom:3px solid #E8730F;padding-bottom:9px;margin:0}
    h3{color:#B85A08;margin:26px 0 6px;font-size:17px}
    ul{padding-left:20px} li{margin-bottom:6px}
    .datum{color:#6E7681;margin:6px 0 0;font-size:14px}
    .not{margin-top:26px;font-size:13px;color:#8A9099}
    .fot{margin-top:34px;padding-top:16px;border-top:1px solid #E5E2DD;color:#9AA0A8;font-size:12px}
  </style></head><body>
  <h1>Skolveckan — ${barn}</h1>
  <p class="datum">Vecka ${v} · ${nu.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
  ${html}
  ${fot}
  <div class="fot">Hämtat ur InfoMentor · <a href="https://github.com/Pochtli137/infomentor-digest">infomentor-digest</a></div>
  </body></html>`;
}

const lika = (a, b) => norm(a) === norm(b);
const norm = (n) => (n || '').toLowerCase().replace(/[^a-zåäöé]+/g, '').split('').sort().join('');

export function vecka(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  return Math.ceil(((t - new Date(Date.UTC(t.getUTCFullYear(), 0, 1))) / 864e5 + 1) / 7);
}

export async function skicka(html, barn) {
  const { MAIL_ANVANDARE, MAIL_LOSENORD, MAIL_TILL, SMTP_VARD, SMTP_PORT } = process.env;
  if (!MAIL_ANVANDARE || !MAIL_LOSENORD || !MAIL_TILL) {
    throw new Error('Saknar MAIL_ANVANDARE, MAIL_LOSENORD eller MAIL_TILL i .env');
  }
  const transport = SMTP_VARD
    ? nodemailer.createTransport({ host: SMTP_VARD, port: Number(SMTP_PORT || 587), secure: Number(SMTP_PORT) === 465,
        auth: { user: MAIL_ANVANDARE, pass: MAIL_LOSENORD } })
    : nodemailer.createTransport({ service: 'gmail', auth: { user: MAIL_ANVANDARE, pass: MAIL_LOSENORD } });

  await transport.sendMail({
    from: `"Skolveckan" <${MAIL_ANVANDARE}>`,
    to: MAIL_TILL,
    subject: `Skolveckan v${vecka(new Date())} — ${barn}`,
    html,
  });
  console.log('Mail skickat till', MAIL_TILL);
}
