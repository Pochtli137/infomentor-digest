#!/usr/bin/env node
/**
 * Veckobrev ur InfoMentor.
 *   node src/index.mjs            hämtar, sammanfattar och mejlar
 *   node src/index.mjs --test     gör allt utom att skicka, sparar forhandsvisning.html
 */
import 'dotenv/config';
import { writeFileSync } from 'fs';
import { hamtaVecka } from './hamta.mjs';
import { sammanfatta } from './sammanfatta.mjs';
import { bygg, skicka } from './mejla.mjs';
import { configExists } from './config.mjs';

const test = process.argv.includes('--test');

if (!configExists()) {
  console.error('Ingen inloggning hittad. Kör först:  npm run logga-in');
  process.exit(1);
}

try {
  console.log('Hämtar från InfoMentor...');
  const v = await hamtaVecka();
  console.log(`${v.barn}: ${v.nyheter.length} nyheter, ${v.kalender.length} kalenderposter, ` +
              `${v.dokument.length} dokument, ${v.samtycken.length} samtycken`);

  console.log('Sammanfattar...');
  const html = bygg(await sammanfatta(v), v);
  writeFileSync('forhandsvisning.html', html);
  console.log('Sparad: forhandsvisning.html');

  if (test) { console.log('\nTestläge — inget mail skickades.'); process.exit(0); }
  await skicka(html, v.barn);
  console.log('Klart.');
} catch (e) {
  if (String(e.message).includes('SESSION_UTGANGEN')) {
    console.error('\nInloggningen har gått ut. Kör:  npm run logga-in');
  } else {
    console.error('\nFel:', e.message);
  }
  process.exit(1);
}
