---
title: Markdown-Seite
showIn: header
order: 1
group: Ressourcen
---

### Was ist Markdown?

Markdown ist eine schlanke Auszeichnungssprache, mit der du reine Textdokumente formatieren kannst.  
Erstelle Dokumente für deine GitHub-Projekte, bearbeite dein GitHub-Profil, die _README_-Datei usw. Hier findest du alles dazu.

Lassen Sie uns loslegen. ⤵️

#### Inhaltsverzeichnis

1. [Absatz](#paragraph)
2. [Überschriften](#headings)
3. [Hervorhebung](#emphasis)
4. [Blockzitat](#blockquote)
5. [Bilder](#images)
6. [Links](#links)
7. [Code](#code)
8. [Listen](#lists)
   - [Nummerierte Liste](#orderedlist)
   - [Ungeordnete Liste](#unorderedlist)
   - [Gemischte Liste](#mixedlist)
9. [Tabelle](#table)
10. [Aufgabenliste](#tasklist)
11. [Fußnote](#footnote)
12. [Zum Abschnitt springen](#sectionjump)
13. [Horizontale Linie](#horizontalline)
14. [HTML](#html)

---

## Absatz

Wenn du normalen Text schreibst, verfasst du im Grunde einen Absatz.

```
Dies ist ein Absatz.
```

Dies ist ein Absatz.

---

## Überschriften

Es gibt 6 Überschriftenvarianten. Die Anzahl der „#“-Symbole, gefolgt von Text, gibt die Wichtigkeit der Überschrift an.

```
# Überschrift 1
## Überschrift 2
### Überschrift 3
#### Überschrift 4
##### Überschrift 5
###### Überschrift 6
```

# Überschrift 1

## Überschrift 2

### Überschrift 3

#### Überschrift 4

##### Überschrift 5

###### Überschrift 6

---

## Hervorhebung

Das Formatieren von Text ist ganz einfach. Du kannst deinen Text fett, kursiv oder durchgestrichen darstellen.

```
Mit zwei Sternchen **ist dieser Text fett**.
Zwei Unterstriche __funktionieren ebenfalls__.
Machen wir ihn jetzt *kursiv*.
Du hast es erraten: _ein Unterstrich reicht auch_.
Können wir **_beides_** kombinieren? Auf jeden Fall.
Was ist, wenn ich ~~durchstreichen~~ möchte?
```

Mit zwei Sternchen **ist dieser Text fett**.  
Zwei Unterstriche **funktionieren ebenfalls**.  
Machen wir ihn jetzt _kursiv_.  
Du hast es erraten: _Ein Unterstrich reicht auch_.  
Können wir **_beides_ kombinieren?** Auf jeden Fall.  
Was ist, wenn ich ~~durchstreichen~~ möchte?

---

## Blockzitat

Möchtest du die Wichtigkeit des Textes hervorheben? Mehr musst du nicht sagen.

```
> Dies ist ein Blockzitat.
> Möchtest du in einer neuen Zeile mit Abstand dazwischen schreiben?
>
> > Und verschachtelt? Kein Problem.
> >
> > > PS: Du kannst deinen Text **gestalten**, _wie du willst_.
```

> Dies ist ein Blockzitat.
> Möchtest du in einer neuen Zeile mit Abstand dazwischen schreiben?
>
> > Und verschachtelt? Überhaupt kein Problem.
> >
> > > PS: Du kannst deinen Text **nach Belieben** gestalten. :

---

## Bilder

Am besten ziehst du das Bild einfach per Drag & Drop direkt von deinem Computer hierher. Du kannst auch einen Verweis auf das Bild erstellen und es auf diese Weise zuweisen.  
Hier ist die Syntax.

```
![Text, falls das Bild nicht geladen werden kann](automatisch-generierter-Pfad-zur-Datei-beim-Hochladen-des-Bildes "Text, der beim Darüberfahren mit der Maus angezeigt wird")

[Logo]: automatisch-generierter-Pfad-zur-Datei-beim-Hochladen-des-Bildes "Fahre mit der Maus darüber"
![Fehlertext][Logo]
```

![Text, falls das Bild nicht geladen werden kann](https://user-images.githubusercontent.com/46372998/212541682-9907aaea-5198-45a9-8961-2acc8a98a0db.png 'Text, der beim Darüberfahren mit der Maus angezeigt wird')

[Logo]: https://user-images.githubusercontent.com/46372998/212541682-9907aaea-5198-45a9-8961-2acc8a98a0db.png 'Mit der Maus darüberfahren'

![Fehlertext][Logo]

---

## Links

Ähnlich wie Bilder können auch Links direkt oder durch Erstellen eines Verweises eingefügt werden. Sie können sowohl Inline- als auch Block-Links erstellen.

```
[Markdown-Spickzettel]: https://github.com/im-luka/markdown-cheatsheet
[Dokumentation]: https://github.com/adam-p/markdown-here

[Gefällt es dir bisher? Folge mir auf GitHub](https://github.com/im-luka)
[Mein Markdown-Spickzettel – mit einem Stern markieren, wenn er dir gefällt][markdown-cheatsheet]
Tolle Dokumentationen findest du [hier][docs]
```

[markdown-cheatsheet]: https://github.com/im-luka/markdown-cheatsheet
[docs]: https://github.com/adam-p/markdown-here

[Gefällt es dir bisher? Folge mir auf GitHub](https://github.com/im-luka)  
[Mein Markdown-Spickzettel – mit einem Stern markieren, wenn er dir gefällt][markdown-cheatsheet]  
Hier findest du tolle Dokumentationen [hier][docs]

---

## Code

Du kannst sowohl Inline- als auch vollständige Block-Code-Schnipsel erstellen. Du kannst in deinem Schnipsel auch die verwendete Programmiersprache angeben. All dies geschieht mithilfe von Backticks.

````
    Ich habe im Stammverzeichnis eine `.env`-Datei erstellt.
    Backticks innerhalb von Backticks? `` `Kein Problem.` ``

 ```
    {
 learning: "Markdown",
 showing: "Block-Code-Schnipsel"
    }
    ```

 ```js
    const x = "Block-Code-Schnipsel in JS";
    console.log(x);
    ```
````

Ich habe die Datei `.env` im Stammverzeichnis angelegt.
Backticks innerhalb von Backticks? `` `Kein Problem.` ``

```
{
  learning: "Markdown",
  showing: "Block-Code-Schnipsel"
}
```

```js
const x = 'Block-Code-Schnipsel in JS';
console.log(x);
```

---

## Listen

Genau wie in HTML ermöglicht Markdown das Erstellen sowohl von nummerierten als auch von unnummerierten Listen.

### Nummerierte Liste

```
1. HTML
2. CSS
3. JavaScript
4. React
7. Ich bin jetzt Frontend-Entwickler 👨🏼‍🎨
```

1. HTML
2. CSS
3. JavaScript
4. React
5. Ich bin jetzt Frontend-Entwickler 👨🏼‍🎨

### Ungeordnete Liste

```
- Node.js
+ Express
* Nest.js
- Backend lernen ⌛️
```

- Node.js

* Express

- Nest.js

* Backend lernen ⌛️

### Gemischte Liste

Du kannst auch beide Listen mischen und Unterlisten erstellen.  
**PS.** Versuche, keine Listen mit mehr als zwei Ebenen zu erstellen. Das ist die bewährte Vorgehensweise.

```
1. Grundlagen lernen
   1. HTML
   2. CSS
   7. JavaScript
2. Ein Framework lernen
   - React
 - Router
 - Redux
   * Vue
   + Svelte
```

1. Grundlagen lernen
   1. HTML
   2. CSS
   3. JavaScript
2. Ein Framework lernen
   - React
 - Router
 - Redux
   * Vue
   - Svelte

---

## Tabelle

Eine hervorragende Möglichkeit, Daten übersichtlich darzustellen. Verwenden Sie das Symbol „|“ zum Trennen der Spalten und das Symbol „:“ zum Ausrichten des Zeileninhalts.

```
| Linksbündig (Standard) | Zentriert | Rechtsbündig |
| :------------------- | :----------: | ----------: |
| React.js | Node.js | MySQL |
| Next.js | Express | MongoDB     |
| Vue.js | Nest.js | Redis |
```

| Linksbündig (Standard) | Zentriert | Rechtsbündig |
| :------------------- | :----------: | ----------: |
| React.js |   Node.js    | MySQL |
| Next.js |   Express    |     MongoDB |
| Vue.js |   Nest.js    | Redis |

---

## Aufgabenliste

Den Überblick über erledigte und noch zu erledigende Aufgaben behalten.

```
- [x] Markdown lernen
- [ ] Frontend-Entwicklung lernen
- [ ] Full-Stack-Entwicklung lernen
```

- [x] Markdown lernen
- [ ] Frontend-Entwicklung lernen
- [ ] Full-Stack-Entwicklung lernen

---

## Fußnote

Möchtest du am Ende der Datei etwas beschreiben? Verwende eine Fußnote!

```
#### Ich arbeite an einem neuen Projekt. [^1]
[^1]: Der Stack besteht aus: React, TypeScript, Tailwind CSS

Das Projekt dreht sich um Musik und Filme.

##### Ich hoffe, es gefällt euch. [^siehe]
[^siehe]: Wird geladen... ⌛️
```

#### Ich arbeite an einem neuen Projekt. [^1]

[^1]: Der Stack besteht aus: React, TypeScript, Tailwind CSS

Das Projekt dreht sich um Musik und Filme.

##### Ich hoffe, es gefällt euch. [^siehe]

[^siehe]: Wird geladen... ⌛️

---

## Zum Abschnitt springen

Astro (und die meisten Markdown-Parser) generieren automatisch IDs für deine Überschriften. Du musst in der Regel keine manuellen `<a name="...">`-Tags erstellen.

---

## Horizontale Linie

Du kannst Sternchen, Bindestriche oder Unterstriche (\*, -, \_) verwenden, um eine horizontale Linie zu erstellen.  
Die einzige Regel ist, dass du mindestens drei Zeichen des Symbols verwenden musst.

```
Erste horizontale Linie

***

Zweite

-----

Dritte

_________
```

Erste horizontale Linie

---

Zweite

---

Dritte

---

---

## HTML

Sie können in Ihrer Markdown-Datei auch reines HTML verwenden. Meistens funktioniert das gut, aber manchmal können Unterschiede auftreten, die Sie von der Arbeit mit Standard-HTML nicht gewohnt sind. Die Verwendung von CSS funktioniert nicht.

```
<h1>Dies ist eine Überschrift</h1>
<p>Absatz...</p>

<hr />

<img src="automatisch-generierter-Pfad-zur-Datei-beim-Hochladen-des-Bildes" width="200">
<a href="https://github.com/im-luka">Folge mir auf GitHub</a>

<br />
<br />

<p>Schneller Hack für <strong><em>die Zentrierung von Bildern</em></strong>?</p>
<p align="center"><img src="automatisch-generierter-Pfad-zur-Datei-beim-Hochladen-des-Bildes" /></p>

<details>
  <summary>Noch ein schneller Hack? 🎭</summary>

  → Einfach
  → Und unkompliziert
</details>
```

<h1>Das ist eine Überschrift</h1>
<p>Absatz...</p>

<hr />

<img src="https://user-images.githubusercontent.com/46372998/212544874-d0654588-82f7-44f2-bbfa-2bf85fd73854.png" width="200">
<a href="https://github.com/im-luka">Folge mir auf GitHub</a>

<br />
<br />

<p>Schneller Hack für <strong><em>Bildzentrierung</em></strong>?</p>
<p align="center"><img src="https://user-images.githubusercontent.com/46372998/212544874-d0654588-82f7-44f2-bbfa-2bf85fd73854.png" width="200" /></p>

<details>
  <summary>Noch ein schneller Trick? 🎭</summary>
 
 → Einfach  
  → Und unkompliziert
</details>

---

## Mermaid-Diagramme

### Mindmap

```mermaid
mindmap
  root((Test Intelligence Hub))
    Datenerfassung
 API-Integration
 Browser-Automatisierung
 RSS-Feeds
 Planung & Orchestrierung
    Datenverarbeitung
 Speicherung strukturierter Daten
 Verarbeitung unstrukturierter Daten
 LLM-Integration
 Abgleich & Bewertung
    Benutzeroberfläche
 Dashboard & Visualisierung
 Alarmmanagement
 Konfiguration & Einstellungen
    Infrastruktur
 Überwachung & Protokollierung
 Fehlerbehandlung
 Skalierbarkeit
 Kosteneffizienz
```

### Flussdiagramm

```mermaid
flowchart LR
    A[Datenquellen] --> B[Erfassungsschicht]
    B --> C[Verarbeitungsschicht]
    C --> D[Speicherschicht]
    D --> E[Benutzeroberfläche]
    D --> F[LLM-Schnittstelle]
    G[Überwachungsebene] -.-> B
    G -.-> C
    G -.-> D
```

---

##### Abschnitt mit einer ID
