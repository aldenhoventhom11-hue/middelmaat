# Middelmaat online zetten — stap voor stap

Je hebt de code al op GitHub staan:
**https://github.com/aldenhoventhom11-hue/middelmaat**

Nu maken we daar een echte, openbare website van die iedereen op zijn telefoon
kan openen. We gebruiken **Render** — dat is gratis, en het kan rechtstreeks je
GitHub-repo "draaien" als server. Je hoeft niets te installeren en geen
creditcard in te vullen.

Reken op **±10 minuten** de eerste keer.

---

## Stap 1 — Account maken bij Render

1. Ga naar **https://render.com**.
2. Klik rechtsboven op **Get Started** (of **Sign Up**).
3. Kies **Sign in with GitHub** (de knop met het GitHub-logo). Dat is het
   makkelijkst — dan is je GitHub meteen gekoppeld.
4. Log in met je GitHub-account (`aldenhoventhom11-hue`) en klik op
   **Authorize Render** als dat gevraagd wordt.

Je komt nu in het **Dashboard** van Render terecht.

---

## Stap 2 — Render toegang geven tot je repo

De eerste keer moet je Render even toestemming geven om je repo's te zien.

1. Klik in het dashboard op **New +** (rechtsboven) → **Blueprint**.
2. Render vraagt of het je GitHub-repo's mag bekijken. Klik op
   **Configure account** / **Install** bij GitHub.
3. Kies **Only select repositories** en selecteer **`middelmaat`** (of kies
   "All repositories", mag ook). Klik **Install / Save**.

> "Blueprint" betekent: Render leest het bestand `render.yaml` dat al in de repo
> zit, en weet daardoor zélf precies hoe het de server moet opzetten. Jij hoeft
> dus niks technisch in te vullen.

---

## Stap 3 — De website laten bouwen

1. Terug in Render zie je nu een lijst met je repo's. Kies **`middelmaat`** en
   klik **Connect**.
2. Render leest `render.yaml` en laat één service zien met de naam
   **middelmaat** (een "Web Service", gratis plan). Dat klopt.
3. Klik onderaan op **Apply** (soms heet de knop **Create** of
   **Create New Resources**).
4. Nu begint Render te bouwen. Je ziet een logvenster met tekst voorbij scrollen
   (`npm install`, daarna `npm start`). Dit duurt **1 à 3 minuten**.
5. Wacht tot je bovenaan een groen bolletje met **Live** ziet staan.

---

## Stap 4 — Je link vinden en testen

1. Bovenaan de service-pagina staat je webadres, iets als:
   **`https://middelmaat.onrender.com`** (of met een paar tekens erachter).
2. Klik erop, of kopieer hem. **Dit is de link die je met de vriendengroep
   deelt.**
3. Open de link op je telefoon. Maak een lobby, en laat iemand anders met de
   6-letter-code meedoen op zíjn telefoon. Klaar! 🎉

> **Belangrijk over de gratis versie:** als er ~15 minuten niemand speelt, valt
> de server "in slaap". De éérste persoon die daarna de link opent, moet
> ongeveer **50 seconden** wachten tot het laadt (je ziet even een wit/ladend
> scherm). Daarna is alles weer snel. Dat is normaal bij gratis hosting — even
> geduld bij de allereerste opener, daarna werkt het vlot voor iedereen.

---

## Later iets aanpassen aan het spel?

Dat gaat vanzelf. In `render.yaml` staat `autoDeploy: true`, dus:

- Elke keer dat er een nieuwe versie naar GitHub gaat (een "push"), bouwt Render
  binnen 1–2 minuten automatisch de nieuwe versie en zet 'm live.
- Je hoeft dus nooit meer iets in Render zelf te doen — alleen de code op GitHub
  bijwerken.

---

## Als er iets misgaat

- **De bouw mislukt (rode "Failed"):** klik op het laatste deploy-logje en kijk
  naar de laatste regels. Meestal is het een typfout in de code. Stuur de
  laatste regels door, dan los ik het op.
- **De pagina laadt heel lang:** waarschijnlijk sliep de server (zie de
  opmerking bij Stap 4). Even wachten.
- **"Cannot GET /" of een leeg scherm:** ververs de pagina één keer hard (op de
  telefoon: tabblad sluiten en opnieuw openen).
- **Spelers zien elkaar niet:** zorg dat iedereen dezelfde `onrender.com`-link
  gebruikt (niet `localhost`), en dezelfde lobby-code intypt.

---

## Alternatief: Railway (ook gratis te proberen)

Werkt vrijwel hetzelfde:

1. Ga naar **https://railway.app** → **Login with GitHub**.
2. **New Project** → **Deploy from GitHub repo** → kies `middelmaat`.
3. Railway draait automatisch `npm start`. Ga daarna naar
   **Settings → Networking → Generate Domain** voor een publieke link.

Render is voor dit spel de makkelijkste keuze, dus begin daar tenzij je een
reden hebt om Railway te willen.
