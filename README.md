# Skolveckan — veckobrev ur InfoMentor

Får du också femton notiser i veckan från InfoMentor och läser ingen av dem?
Det här skickar ett mejl varje måndag med vad som faktiskt hänt och vad som
kommer: nyheter från skolan, kalendern, nya dokument, pedagogiska planeringar,
och överst det som kräver att du gör något, som samtycken.

**Allt körs på din egen dator.** Ingen tjänst, ingen server, inget konto hos
någon annan. Din inloggning lämnar aldrig maskinen.

## Vad du behöver

- En Mac eller PC
- Ett InfoMentor-konto som vårdnadshavare
- Femton minuter första gången

Steg för steg, skrivet för dig som aldrig öppnat en terminal:
**https://skolveckan.vercel.app**

## Snabbversion för dig som kodat förr

```bash
git clone https://github.com/Pochtli137/infomentor-digest
cd infomentor-digest
npm install

cp .env.exempel .env      # fyll i mejladress och app-lösenord
npm run logga-in          # öppnar webbläsare, du loggar in med BankID
npm test                  # hämtar och sparar forhandsvisning.html, skickar inget
npm start                 # skickar mejlet
```

Schemalägg `npm start` en gång i veckan med launchd, cron eller Task Scheduler.
Instruktioner finns på sajten ovan.

## Hur inloggningen fungerar

InfoMentor har inget publikt API. Klienten loggar in på samma sätt som deras egen
app: du signerar en gång med BankID i ett webbläsarfönster, och det som sparas
lokalt är en OAuth-token som förnyas automatiskt. Inget lösenord lagras, och
BankID-signeringen går aldrig genom den här koden.

Token hamnar i `~/.infomentor/config.json`. Sätt rättigheter 600 på den filen.
Den ger läsåtkomst till ditt barns skoluppgifter, så behandla den som ett lösenord.

## Vad som hämtas

| Innehåll | Endpoint |
|---|---|
| Nyheter | `/Communication/News/GetNewsList` |
| Notiser | `/NotificationApp/NotificationApp/appData` |
| Kalender | `/calendarv2/calendarv2/getentries` |
| Samtycken | `/Communication/Consents/GetCurrentList` |
| Dokument | `/Communication/Documents/GetDocumentsList` |
| Länkar | `/Communication/Links/GetLinksList` |
| Planeringar | `/uolv2/uolv2/appData` |
| Frånvaro och ledighet | `/attendance/attendance/appData` |

Endpointarna är kartlagda genom att avlyssna vad InfoMentors egen webb gör.
Ingenting skrivs tillbaka; klienten läser bara.

## Sammanfattningen

Har du Claude Code på datorn används den, och då behövs ingen extra nyckel.
Annars kan du lägga in en nyckel från Anthropic eller Google i `.env`.
Saknas allt sådant skickas brevet ändå, osammanfattat men läsbart.

## Två begränsningar du bör känna till

**Ett barn i taget.** InfoMentor lämnar bara ut det barn som är aktivt i
portalen. Har du flera barn står det i mejlet vilket det gäller, och du byter
barn i InfoMentor för att växla.

**Det här är inte ett officiellt API.** InfoMentor kan ändra sin webb när som
helst, och då slutar det fungera tills någon lagar det. Det är priset för att
plattformen inte erbjuder något sätt att komma åt sin egen information.

## Juridik och etik

Klienten läser bara uppgifter om ditt eget barn, med din egen inloggning, på din
egen dator. Det är samma information du ser när du loggar in manuellt.

Bygg inte om detta till en tjänst där andra föräldrar loggar in hos dig. Då tar
du emot andras inloggningar till uppgifter om andras barn, blir
personuppgiftsansvarig, och hamnar i en helt annan juridisk situation. Öppna
Skolplattformen, som gjorde motsvarande för Stockholms tidigare skolplattform,
polisanmäldes 2021 för dataintrång. Åtalet lades ner, men det tog år.

Dela koden, inte tjänsten.

## Licens

MIT. Ingen garanti, inget stöd, ingen koppling till InfoMentor.
