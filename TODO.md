# Skolveckan, att göra

## Läge 2026-10-22

**Gjort:** `webb/index.html` omgjord på grenen `plattform-och-ai`: först InfoMentor eller Schoolity,
sedan Claude eller ChatGPT, fyra vägar, valet speglas i URL:en (`#schoolity-chatgpt`).
Terminalvägen flyttad till en rad längst ner. **Deployad till skolveckan.vercel.app 2026-10-22 på
Kims order, före testerna.** Tre av fyra vägar ligger alltså live otestade.
`.env.exempel` omdöpt till `.env.example` (env-spärren släpper bara igenom det namnet).

**Varför vägarna ser ut som de gör** (Anthropics och OpenAIs hjälpsidor, lästa 2026-10-22):
- Nya schemalagda uppgifter i Claude körs i molnet sedan 2026-10-06. Ett .mcpb-tillägg nås bara
  när Claude Desktop är öppen. Live-sidan säger inte det.
- Claudes Gmail-koppling ber om godkännande före varje mejl, så "mejla mig" i en obevakad
  uppgift stannar. Live-sidans steg 4 lovar ett mejl som inte går iväg av sig självt.
- ChatGPT når inte lokala MCP-servrar. Agent mode och Atlas är nedlagda. Kvar är Work med
  molnwebbläsare, som minns inloggningar och kan schemaläggas.
- Claude i Chrome kan schemalägga sparade genvägar, kräver att Chrome är öppen.

**Nästa:**
1. Kim testar de tre otestade vägarna, två körningar med en vecka emellan (håller inloggningen?):
   Schoolity + Claude i Chrome, InfoMentor + ChatGPT Work, Schoolity + ChatGPT Work.
2. Vägar som inte klarar testet tas bort från sidan direkt.

**Overifierat:**
- Att ChatGPT Work och dess molnwebbläsare finns i Sverige (EES).
- Att BankID (QR) och Google-inloggning går igenom ChatGPT:s molnwebbläsare.
- Hur länge InfoMentor och Schoolity behåller en webbsession.
- UI-texterna i ChatGPT-stegen (Work, Scheduled, notisinställningen) och genvägsflödet i
  Claude i Chrome är tagna ur hjälpsidorna, inte sedda i appen.
- Att ChatGPT skapar en schemalagd uppgift av "Gör det här varje måndag klockan sju."
