# Middelmaat 🥈

Een mobiel-first multiplayer party-webgame waarin 3 t/m 10 spelers via een
lobby-code samenkomen, elk hun eigen cartoon-personage ontwerpen, en samen 5
willekeurig gekozen minigames (uit 11) spelen. De clou van élke minigame: je
wilt **niet de beste of de slechtste** zijn — je wilt **zo gemiddeld mogelijk**
zijn. De extremen verliezen, het midden wint. _Middelmaat is goud._

Interface-taal: Nederlands. Stijl: speels, kleurrijk, cartoon. Geluid: alleen
geluidseffecten (via de WebAudio API, geen audiobestanden).

## Snel lokaal draaien

Vereist Node.js ≥ 18.

```bash
npm install
npm start
```

Open daarna **http://localhost:3000** op je telefoon én/of computer. Eén speler
maakt een lobby, de rest doet mee met de 6-tekens code. Vanaf 3 spelers kan de
host starten.

> Tip: open meerdere tabbladen/telefoons naar dezelfde URL om met meer mensen te
> spelen. De server moet bereikbaar zijn voor alle spelers (lokaal netwerk of
> een deploy, zie onder).

## Tests

```bash
npm test
```

Dekt o.a.:

- **`test/scoring.test.js`** — de scoreformule en tie-afhandeling, inclusief de
  exacte voorbeelden uit de spec (3→`[0,1,0]`, 5→`[0,1,2,1,0]`, enz.) en het
  `closest`-model van minigame 5.
- **`test/minigames.test.js`** — alle 11 minigames met een gesimuleerde 3- en
  10-speler-sessie (virtuele klok, geen echte timers/sockets).
- **`test/engine.test.js`** — volledig spelverloop, host-flow, disconnect →
  slechtste uitkomst, en de tiebreak.

## Online zetten

👉 **Volledige stap-voor-stap-gids: [DEPLOY.md](DEPLOY.md)** (Render én Railway,
in gewone taal uitgelegd).

Kort samengevat: de repo bevat een [`render.yaml`](render.yaml), dus op
[Render](https://render.com) is het **New + → Blueprint → repo kiezen → Apply**.
Na ~1–2 min krijg je een publieke `…onrender.com`-link om met iedereen te delen.
De server serveert de WebSockets én de frontend op één poort
(`process.env.PORT`), dus er is verder niets te configureren.

## Architectuur

```
server/
  index.js          Express + Socket.io, serveert frontend + sockets op één poort
  lobby.js          Rooms, spelers, 6-tekens codes, host-logica
  game.js           GameEngine: rondebeheer, fase-transities, podium, tiebreak
  scoring.js        De middelmaat-scoring (symmetric + closest), hele punten
  minigames/        Eén bestand per minigame (11) + gedeelde helpers + registry
public/
  index.html        Eén lichte SPA (plain HTML/CSS/JS, geen build-stap)
  css/style.css
  js/
    sound.js        Geluidseffecten via WebAudio
    character.js    Cartoon-personages als schaalbare SVG
    net.js          Socket.io-wrapper + reconnect-token (alleen in geheugen)
    minigames.js    Client-renderers voor alle 11 minigames
    app.js          Schermrouting, character-creator, lobby, fase-overgangen
test/               Unit- en integratietests
render.yaml         Render Blueprint
```

**De server is de single source of truth.** Clients sturen alleen acties; de
server berekent álle uitkomsten en scores (anti-cheat by design). Late en
dubbele input wordt server-side genegeerd en alle waarden worden gevalideerd.
Game-state staat volledig in-memory; een lobby leeft zolang het spel duurt.

## Het scoringssysteem (het hart)

Elke minigame levert per speler één uitkomstwaarde (een getal). Daarna:

```
sorteer spelers op uitkomstwaarde
score(positie i, N spelers) = min(i, N-1-i)     // afstand tot de dichtstbijzijnde rand
```

Beide extremen krijgen 0, het midden de meeste punten:

| N  | scores                |
|----|-----------------------|
| 3  | `[0, 1, 0]`           |
| 4  | `[0, 1, 1, 0]`        |
| 5  | `[0, 1, 2, 1, 0]`     |
| 6  | `[0, 1, 2, 2, 1, 0]`  |
| 7  | `[0,1,2,3,2,1,0]`     |

- **Alleen hele punten.** Bij een gelijke uitkomst krijgen die spelers allemaal
  het HOOGSTE punt van hun gezamenlijke posities (gul, deterministisch, geen
  tiebreak op tijd).
- **Niet ingeleverd** (of disconnect, of host rondt vroegtijdig af) → 0 punten,
  en die speler telt NIET als extreem; alleen wie inlevert wordt onderling
  gescoord.
- De **host kan een ronde altijd vroegtijdig afronden** ("Ronde nu afronden").
- **Minigame 5 (Het Gemiddelde Getal)** gebruikt het `closest`-model: de
  uitkomst is de afstand tot het groepsgemiddelde; de dichtstbijzijnde wint de
  meeste punten, de versten krijgen 0.
- **Disconnect midden in een ronde** → automatisch de slechtst mogelijke
  uitkomst (telt als extreem → 0 punten); het spel gaat door. Bij reconnect doe
  je weer mee vanaf de volgende ronde.
- **Gelijke eindstand** → een extra tiebreak-minigame tussen alleen de gelijk
  geëindigde koplopers. Omdat de middelmaat-scoring een 2-persoonsduel niet kan
  beslissen (beide extremen = 0), kiest de tiebreak deterministisch precies één
  winnaar: dichtst bij het gemiddelde van de koplopers, dan de laagste uitkomst.
- Bij **< 3 actieve spelers** door disconnects wordt het spel netjes afgebroken.

## De 11 minigames

| # | Naam | Type | Uitkomst |
|---|------|------|----------|
| 1 | De Berenrace | realtime | tijd tot je je verstopt |
| 2 | Het Doolhof Dilemma | realtime | tijd tot de uitgang |
| 3 | De Ballon | geheim (30s) | aantal pompslagen (1–20) |
| 4 | Verdeel & Heers | geheim (30s) | totaal ontvangen strafpunten |
| 5 | Het Gemiddelde Getal | geheim (30s) | afstand tot groepsgemiddelde (`closest`) |
| 6 | Schermstaren | realtime | tijd tot je loslaat (geen klok) |
| 7 | De Tikkampioen | realtime | aantal tikken in 5s (server-geteld) |
| 8 | De Pizzapunt | geheim (30s) | geclaimde stukken (0–12) |
| 9 | De Blinde Schutter | geheim (30s) | afgelegde afstand (projectiel-fysica) |
| 10 | Cirkeltrek | geheim (30s) | oppervlakte van je cirkel (server-shoelace) |
| 11 | De Lift | geheim (30s) | gekozen verdieping (1–20) |

Geheime-invoer-games hebben een vaste rondetijd van 30s; wie niet inlevert telt
niet mee die ronde. Realtime-games hebben een veiligheidsnet-timer. Vóór elke
ronde draait een **rad** dat live een van de resterende minigames kiest.

De **character-creator** maakt een volledig figuur (man/vrouw, instelbare lengte
en postuur via schuifbalken, huidskleur, haarstijl/-kleur, kleding incl. rok/jurk).
Eén apparaat kan per lobby maar één keer joinen.

## Wat is af / aannames

**Af:** alle gevraagde onderdelen — lobby + character-creator, 5-uit-10-selectie
zonder herhaling, het volledige scoringssysteem met ties/disconnect/tiebreak,
alle 11 minigames (intro → spel → onthulling), tussenstand, eindpodium met
winnaar én verliezer, host-controls + wachtschermen, geluidseffecten,
mute-knop, reconnect, Nederlandse copy, en de tests. Lokaal draaien en de
Render-deploy zijn geverifieerd; het complete 3-speler-spelverloop is in de
browser end-to-end getest tot en met het podium.

**Aannames / keuzes:**

- Frontend is bewust plain HTML/CSS/JS zonder build-stap (minste setup, snelst
  deploybaar) — alles wordt door de server geserveerd op één poort.
- Bij een **2-persoons tiebreak** kan "het meest gemiddeld" niet objectief
  beslissen; daarom de deterministische regel hierboven (i.p.v. eindeloos
  herspelen).
- De host die disconnect → de hostrol gaat automatisch naar de eerstvolgende
  verbonden speler.
- Mid-game joinen kan: je komt in de wachtrij en doet mee vanaf het volgende
  spel.
- Geluid start pas na de eerste tik (mobiele autoplay-restrictie).
