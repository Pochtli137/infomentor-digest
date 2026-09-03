# infomentor-digest, Skolveckan

Veckobrev varje måndag ur InfoMentor: nyheter, kalender, dokument, planeringar, samtycken.
Allt körs lokalt på användarens dator. Har ett Claude Desktop-tillägg (`.mcpb`) och en publik
installationssajt på https://skolveckan.vercel.app (`webb/`, statisk, ingen build).

## Köra
```
npm run logga-in    # BankID i webbläsare, token till ~/.infomentor/config.json
npm test            # skriver forhandsvisning.html, skickar inget
npm start           # skickar
```
Schemaläggs med launchd, cron eller Task Scheduler. Node ESM, nodemailer, dotenv, puppeteer
bara för login.

## Regler
- **Bygg aldrig om detta till en tjänst där andra föräldrar loggar in.** Personuppgiftsansvar.
  Öppna Skolplattformen polisanmäldes 2021. Dela koden, aldrig tjänsten.
- Token i `~/.infomentor/config.json` (chmod 600) ger läsåtkomst till barnets skoldata.
  Behandla som lösenord.
- **Ett barn i taget.** InfoMentor lämnar bara ut aktivt barn. Barnbytet fungerar inte, se
  `school-digest/CLAUDE.md`.
- Inofficiellt API, kartlagt genom att avlyssna deras webb. Kan sluta fungera när som helst.

## Fällor
- `mcpb/server/` duplicerar `src/`. Ändringar måste speglas manuellt.
- Auth-kedjan finns i tre kopior: här, `mcpb/server/` och `infomentor-mcp`. Refresh-token
  roterar vid varje användning, två samtidiga klienter slår ut varandra.
- Repo `Pochtli137/infomentor-digest`, MIT. Systerrepo `infomentor-mcp` under annan org.
