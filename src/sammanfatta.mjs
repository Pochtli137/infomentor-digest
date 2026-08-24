/**
 * Sammanfattar veckan med en språkmodell.
 *
 * Ordning: Claude Code på maskinen (ingen extra nyckel, går på befintligt
 * abonnemang), annars Anthropic API, annars Gemini. Finns ingen av dem skickas
 * en osammanfattad men fullt läsbar version.
 */
import { spawn } from 'child_process';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const SYSTEM =
  'Du är en textsammanfattare i en mailpipeline. Använd aldrig verktyg och redigera aldrig filer. ' +
  'Svara enbart med den efterfrågade HTML-texten, utan inledning, kommentarer eller kodstaket.';

function viaClaude(prompt) {
  return new Promise((resolve, reject) => {
    const bin = process.env.CLAUDE_BIN || `${process.env.HOME}/.local/bin/claude`;
    const p = spawn(bin, [
      '-p',
      '--disallowed-tools', 'Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep', 'WebFetch', 'WebSearch', 'Task',
      '--append-system-prompt', SYSTEM,
    ], { stdio: ['pipe', 'pipe', 'pipe'], cwd: mkdtempSync(join(tmpdir(), 'imdigest-')) });
    let ut = '', fel = '';
    const t = setTimeout(() => { p.kill(); reject(new Error('claude timeout')); }, 180000);
    p.stdout.on('data', (d) => (ut += d));
    p.stderr.on('data', (d) => (fel += d));
    p.on('error', (e) => { clearTimeout(t); reject(e); });
    p.on('close', (k) => { clearTimeout(t); (k === 0 && ut.trim()) ? resolve(ut) : reject(new Error(fel.slice(0, 120))); });
    p.stdin.write(prompt); p.stdin.end();
  });
}

async function viaAnthropic(prompt) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5',
      max_tokens: 2000,
      system: SYSTEM,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  const j = await r.json();
  if (!j.content?.[0]?.text) throw new Error(JSON.stringify(j).slice(0, 160));
  return j.content[0].text;
}

async function viaGemini(prompt) {
  const m = process.env.GEMINI_MODEL || 'gemini-flash-latest';
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${process.env.GEMINI_API_KEY}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: SYSTEM + '\n\n' + prompt }] }] }) });
  const j = await r.json();
  const t = j?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!t) throw new Error(JSON.stringify(j).slice(0, 160));
  return t;
}

function bygg(v) {
  const d = [];
  const p = (rubrik, rader) => rader.length && d.push(`## ${rubrik}\n${rader.join('\n')}`);
  p('Samtycken som väntar på svar', v.samtycken.map((s) => `- ${s}`));
  p('Nyheter', v.nyheter.map((n) => `**${n.titel}** (${n.av}, ${n.datum})\n${n.text}`));
  p('Kalender', v.kalender.map((k) => `- ${k.datum} ${k.titel}${k.text ? ' — ' + k.text : ''}`));
  p('Pedagogiska planeringar', v.planeringar.map((x) => `- ${x.titel}${x.amnen ? ' (' + x.amnen + ')' : ''}`));
  p('Publicerade dokument', v.dokument.map((x) => `- ${x.titel}${x.text ? ' — ' + x.text : ''}`));
  p('Publicerade länkar', v.lankar.map((x) => `- ${x.titel} (${x.url})`));
  return d.join('\n\n---\n\n');
}

export function utanModell(v) {
  const bit = (rubrik, rader) =>
    rader.length ? `<h3>${rubrik}</h3><ul>${rader.map((r) => `<li>${r}</li>`).join('')}</ul>` : '';
  return [
    v.samtycken.length ? `<p><b>Kräver ditt svar:</b> ${v.samtycken.join(', ')}</p>` : '',
    bit('Nyheter', v.nyheter.map((n) => `<b>${n.titel}</b> — ${n.av}, ${n.datum}<br>${n.text}`)),
    bit('Kalender', v.kalender.map((k) => `${k.datum} ${k.titel}`)),
    bit('Planeringar', v.planeringar.map((x) => x.titel)),
    bit('Dokument', v.dokument.map((x) => x.titel)),
  ].filter(Boolean).join('\n');
}

export async function sammanfatta(v) {
  const rad = bygg(v);
  if (!rad.trim()) return '<p>Ingenting nytt den här veckan.</p>';

  const prompt = `Nedan är rådata från skolplattformen InfoMentor för ${v.barn}, hämtat den senaste veckan.

Skriv ett kort veckobrev till vårdnadshavare, på svenska, i HTML utan kodstaket.
Använd <h3> för rubriker, <p> och <ul><li> för innehåll.

Ordning och regler:
1. Börja med sådant som kräver att föräldern gör något (samtycken, ledighet, anmälningar, deadlines).
2. Därefter vad som hänt och vad som kommer, med datum.
3. Utelämna rubriker där det inte finns något att säga. Hitta aldrig på.
4. Var konkret: tider, platser, namn, belopp. Inga floskler.

RÅDATA:
${rad}`;

  const forsok = [
    ['Claude Code', () => viaClaude(prompt), true],
    ['Anthropic API', () => viaAnthropic(prompt), !!process.env.ANTHROPIC_API_KEY],
    ['Gemini', () => viaGemini(prompt), !!process.env.GEMINI_API_KEY],
  ];
  for (const [namn, kor, tillganglig] of forsok) {
    if (!tillganglig) continue;
    try {
      const t = await kor();
      return t.replace(/^```html\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
    } catch (e) {
      console.warn(`${namn} gick inte: ${String(e.message).slice(0, 90)}`);
    }
  }
  console.warn('Ingen språkmodell tillgänglig — skickar osammanfattad version.');
  return utanModell(v);
}
