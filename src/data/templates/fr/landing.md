---
title: Démonstration d'une page d'accueil basée sur des modèles
hero:
  tagline: Basé sur Markdown
  title: Cette page entière est générée à partir d'un seul fichier Markdown
  subtitle: 'Modifiez le fichier Markdown pour changer tout ce que vous voyez ici. Ajoutez ou supprimez des sections : la page s''adaptera automatiquement.'
  image:
    src: ~/assets/images/hero-image.png
    alt: Image principale d'AstroWind
  actions:
    - text: Consulter sur GitHub
      href: https://github.com/arthelokyo/astrowind
      variant: primary
      icon: tabler:brand-github
    - text: En savoir plus
      href: '#features'
      icon: tabler:arrow-down
features:
  tagline: Comment ça marche ?
  title: Pages axées sur le contenu
  items:
    - title: Modifier dans le CMS
      description: Tout le contenu est regroupé dans un seul fichier Markdown. Modifiez-le via le CMS Sveltia — aucune modification du code n'est nécessaire. Ajoutez des sections, modifiez le texte, remplacez des images.
      icon: tabler:edit
    - title: Traduction automatique
      description: Le système d'internationalisation (i18n) traduit automatiquement tous les champs de frontmatter imbriqués via DeepL ou Gemini. Un seul fichier source pour toutes les langues.
      icon: tabler:language
    - title: Composition des widgets
      description: 'Choisissez les widgets qui s''affichent en ajoutant ou en supprimant des sections dans le frontmatter. Hero, Features, Témoignages, CTA : combinez-les à votre guise.'
      icon: tabler:puzzle
    - title: YAML imbriqué
      description: Frontmatter prend en charge les objets et les tableaux profondément imbriqués. Le système de traduction parcourt chaque valeur de chaîne de caractères — sans aucune limitation liée à la structure plate des champs.
      icon: tabler:json
    - title: Une succursale par client
      description: Chaque client dispose de sa propre branche. Personnalisez la configuration, l'identité visuelle et le contenu sans modifier le fonctionnement interne des widgets ni le thème de base.
      icon: tabler:git-branch
    - title: Aucune modification du code
      description: Les clients modifient uniquement le code Markdown et les images. Le modèle .astro lit les informations de tête (frontmatter) et les associe à des widgets. Pas de HTML, pas de JavaScript.
      icon: tabler:code-off
testimonials:
  - title: Architecture épurée
    testimonial: Séparer le contenu de la présentation est la bonne décision. Ce modèle facilite grandement la création et la maintenance des sites clients.
    name: Lead Developer
  - title: Compatible avec les CMS
    testimonial: Les clients peuvent modifier eux-mêmes leurs pages d'accueil sans avoir à écrire la moindre ligne de code. C'est exactement ce dont notre agence avait besoin.
    name: Agency Owner
  - title: La magie de la traduction
    testimonial: La traduction YAML imbriquée est géniale. Un seul fichier en anglais, et hop, on obtient d'un coup des versions parfaites en espagnol, en français et en allemand.
    name: Content Manager
  - title: Widgets flexibles
    testimonial: La possibilité d'ajouter ou de supprimer des sections entières en modifiant le frontmatter change la donne en matière de prototypage rapide.
    name: UX Designer
cta:
  title: Commencez dès aujourd'hui
  subtitle: Clonez le dépôt, créez un fichier templates/home.md, et c'est parti ! Le pipeline d'internationalisation (i18n) s'occupe du reste.
  actions:
    - text: Télécharger le modèle
      href: https://github.com/arthelokyo/astrowind
      variant: primary
      icon: tabler:download
    - text: Consultez la documentation
      href: '#features'
      icon: tabler:book
---


