---
title: Demo zur vorlagengesteuerten Landingpage
hero:
  tagline: Markdown-basiert
  title: Diese gesamte Seite wird von einer einzigen Markdown-Datei gesteuert
  subtitle: Bearbeiten Sie die Markdown-Datei, um alle hier angezeigten Inhalte zu ändern. Fügen Sie Abschnitte hinzu oder entfernen Sie sie – die Seite passt sich automatisch an.
  image:
    src: ~/assets/images/hero-image.png
    alt: AstroWind-Titelbild
  actions:
    - text: Auf GitHub anzeigen
      href: https://github.com/arthelokyo/astrowind
      variant: primary
      icon: tabler:brand-github
    - text: Mehr erfahren
      href: '#Funktionen'
      icon: tabler:arrow-down
features:
  tagline: So funktioniert es
  title: Inhaltsorientierte Seiten
  items:
    - title: Im CMS bearbeiten
      description: Der gesamte Inhalt befindet sich in einer einzigen Markdown-Datei. Bearbeiten Sie diese über das Sveltia CMS – es sind keine Änderungen am Code erforderlich. Fügen Sie Abschnitte hinzu, ändern Sie den Text und tauschen Sie Bilder aus.
      icon: tabler:edit
    - title: Automatisch übersetzt
      description: Das i18n-System übersetzt alle verschachtelten Frontmatter-Felder automatisch über DeepL oder Gemini. Eine Quelldatei, alle Sprachversionen.
      icon: tabler:language
    - title: Widget-Zusammensetzung
      description: Legen Sie fest, welche Widgets angezeigt werden sollen, indem Sie im Frontmatter Abschnitte hinzufügen oder entfernen. Hero, Features, Kundenstimmen, CTA – kombinieren Sie sie ganz nach Belieben.
      icon: tabler:puzzle
    - title: Verschachteltes YAML
      description: Frontmatter unterstützt tief verschachtelte Objekte und Arrays. Das Übersetzungssystem durchläuft jeden String-Wert – ohne Einschränkungen durch „Flat-Field“-Strukturen.
      icon: tabler:json
    - title: Eine Filiale pro Kunde
      description: Jeder Kunde erhält einen eigenen Zweig. Passen Sie Konfiguration, Branding und Inhalte an, ohne in die Interna der Widgets oder das Basisthema einzugreifen.
      icon: tabler:git-branch
    - title: Keine Codeänderungen
      description: Kunden bearbeiten ausschließlich Markdown-Inhalte und Bilder. Die .astro-Vorlage liest die Frontmatter-Daten aus und ordnet sie den Widgets zu. Kein HTML, kein JavaScript.
      icon: tabler:code-off
---

Kundenstimmen:
  - Titel: Clean Architecture
    Kundenstimme: Die Trennung von Inhalt und Darstellung ist der richtige Weg. Dank dieses Musters lassen sich Kundenwebsites kinderleicht erstellen und pflegen.
    Name: Leitender Entwickler
  - Titel: CMS-freundlich
    Kundenmeinung: Kunden können ihre eigenen Landingpages bearbeiten, ohne auch nur eine Zeile Code anzurühren. Genau das, was unsere Agentur gebraucht hat.
    Name: Agenturinhaber
  - Titel: Übersetzungszauber
    Kundenmeinung: Die verschachtelte YAML-Übersetzung ist genial. Eine einzige englische Datei, und schon haben wir perfekte spanische, französische und deutsche Versionen.
    name: Content-Manager
  - title: Flexible Widgets
    Zitat: Die Möglichkeit, durch Bearbeiten des Frontmatter ganze Abschnitte hinzuzufügen oder zu entfernen, ist ein echter Game-Changer für das schnelle Prototyping.
    name: UX-Designer

cta:
  title: Beginnen Sie noch heute mit der Entwicklung
  subtitle: Klonen Sie das Repo, erstellen Sie eine Datei „templates/home.md“, und schon kann es losgehen. Die i18n-Pipeline kümmert sich um den Rest.
  actions:
    - text: Vorlage herunterladen
      href: https://github.com/arthelokyo/astrowind
      variant: primary
      icon: tabler:download
    - text: Dokumentation lesen
      href: &#x27;#features&#x27;
      icon: tabler:book
