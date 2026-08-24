#!/usr/bin/env node
/**
 * MCP-server för InfoMentor: hämtar veckans skolinformation.
 *
 * Verktygen är avsiktligt få. Ett för inloggning, ett för att hämta veckan,
 * och ett för att se status. Resten sköter modellen genom att formulera brevet.
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const HAR = dirname(fileURLToPath(import.meta.url));
const server = new Server({ name: 'infomentor', version: '1.0.0' }, { capabilities: { tools: {} } });

const VERKTYG = [
  {
    name: 'infomentor_logga_in',
    description:
      'Startar inloggning mot InfoMentor. Öppnar ett webbläsarfönster där föräldern loggar in ' +
      'med BankID eller kommunens inloggning. Behöver bara göras en gång; därefter förnyas ' +
      'åtkomsten automatiskt. Använd när inget annat verktyg fungerar eller när åtkomsten gått ut.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'infomentor_veckan',
    description:
      'Hämtar allt som publicerats i InfoMentor: nyheter från skolan, kalenderhändelser, ' +
      'samtycken som väntar på svar, publicerade dokument och länkar, pedagogiska planeringar ' +
      'och ledighetsansökningar. Använd detta för att skriva ett veckobrev till vårdnadshavare.',
    inputSchema: {
      type: 'object',
      properties: {
        dagar_bakat: { type: 'number', description: 'Hur många dagar bakåt nyheter räknas. Standard 7.' },
        dagar_framat: { type: 'number', description: 'Hur långt fram kalendern läses. Standard 14.' },
      },
    },
  },
  {
    name: 'infomentor_status',
    description: 'Visar om inloggningen finns och vilka barn kontot ser.',
    inputSchema: { type: 'object', properties: {} },
  },
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: VERKTYG }));

const svar = (text) => ({ content: [{ type: 'text', text }] });

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: arg = {} } = req.params;
  try {
    if (name === 'infomentor_logga_in') {
      const kod = await new Promise((res) => {
        const p = spawn(process.execPath, [join(HAR, 'login.mjs')], { stdio: 'inherit' });
        p.on('close', res);
        p.on('error', () => res(1));
      });
      return svar(kod === 0
        ? 'Inloggningen lyckades. Åtkomsten är sparad på den här datorn och förnyas automatiskt.'
        : 'Inloggningen slutfördes inte. Prova igen och se till att fönstret får stå öppet tills det stängs av sig självt.');
    }

    const { configExists, loadConfig } = await import(join(HAR, 'config.mjs'));
    if (!configExists()) {
      return svar('Ingen inloggning hittad. Be mig logga in på InfoMentor först.');
    }

    if (name === 'infomentor_status') {
      const c = loadConfig();
      return svar(`Inloggad. Konto ser ${c.children.length} barn: ${c.children.map((b) => b.name).join(', ')}.\n` +
        'InfoMentor lämnar bara ut det barn som är aktivt i portalen.');
    }

    if (name === 'infomentor_veckan') {
      const { hamtaVecka } = await import(join(HAR, 'hamta.mjs'));
      const v = await hamtaVecka({
        dagarBakat: arg.dagar_bakat ?? 7,
        dagarFramat: arg.dagar_framat ?? 14,
      });
      return svar(JSON.stringify(v, null, 2));
    }

    return svar(`Okänt verktyg: ${name}`);
  } catch (e) {
    const m = String(e.message || e);
    if (m.includes('SESSION_UTGANGEN')) {
      return svar('Åtkomsten har gått ut. Be mig logga in på InfoMentor igen.');
    }
    return svar(`Något gick fel: ${m}`);
  }
});

await server.connect(new StdioServerTransport());
