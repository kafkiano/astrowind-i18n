---
title: Démonstration d&#x27;une page d&#x27;accueil basée sur des modèles
hero:
  tagline: Basé sur Markdown
  title: Cette page entière est générée à partir d&#x27;un seul fichier Markdown
  subtitle: 'Modifiez le fichier Markdown pour changer tout ce que vous voyez ici. Ajoutez ou supprimez des sections : la page s&#x27;adaptera automatiquement.'
  image:
    src: ~/assets/images/hero-image.png
    alt: Image principale d&#x27;AstroWind
  actions:
    - text: Consulter sur GitHub
      href: https://github.com/arthelokyo/astrowind
      variant: primary
      icon: tabler:brand-github
    - text: En savoir plus
      href: '#fonctionnalités'
      icon: tabler:arrow-down
features:
  tagline: Comment ça marche ?
  title: Pages axées sur le contenu
  items:
    - title: Modifier dans le CMS
      description: Tout le contenu est regroupé dans un seul fichier Markdown. Modifiez-le via le CMS Sveltia — aucune modification du code n&#x27;est nécessaire. Ajoutez des sections, modifiez le texte, remplacez des images.
      icon: tabler:edit
    - title: Traduction automatique
      description: Le système d&#x27;internationalisation (i18n) traduit automatiquement tous les champs de frontmatter imbriqués via DeepL ou Gemini. Un seul fichier source pour toutes les langues.
      icon: tabler:language
    - title: Composition des widgets
      description: 'Choisissez les widgets qui s&#x27;affichent en ajoutant ou en supprimant des sections dans le frontmatter. Hero, Features, Témoignages, CTA : combinez-les à votre guise.'
      icon: tabler:puzzle
    - title: YAML imbriqué
      description: Frontmatter prend en charge les objets et les tableaux profondément imbriqués. Le système de traduction parcourt chaque chaîne de caractères — sans aucune limitation liée à la structure plate des champs.
      icon: tabler:json
    - title: Une succursale par client
      description: Chaque client dispose de sa propre branche. Personnalisez la configuration, l&#x27;identité visuelle et le contenu sans modifier le fonctionnement interne des widgets ni le thème de base.
      icon: tabler:git-branch
    - title: Aucune modification du code
      description: Les clients modifient uniquement le code Markdown et les images. Le modèle .astro lit les informations de tête (frontmatter) et les associe à des widgets. Pas de HTML, pas de JavaScript.
      icon: tabler:code-off
---

Témoignages :
  - titre : Architecture épurée
    témoignage : Séparer le contenu de la présentation est la bonne décision. Ce modèle facilite grandement la création et la maintenance des sites de nos clients.
    nom : Développeur principal
  - titre : Compatible avec les CMS
    témoignage : Les clients peuvent modifier leurs propres pages d’accueil sans toucher à une seule ligne de code. C’est exactement ce dont notre agence avait besoin.
    nom : Dirigeant d’agence
  - titre : La magie de la traduction
    témoignage : La traduction YAML imbriquée est géniale. Un seul fichier en anglais, et nous obtenons instantanément des versions parfaites en espagnol, en français et en allemand.
    nom : Responsable de contenu
  - titre : Widgets flexibles
    témoignage : La possibilité d’ajouter ou de supprimer des sections entières en modifiant le frontmatter change la donne pour le prototypage rapide.
    nom : Concepteur UX

cta :
  titre : Commencez à créer dès aujourd’hui
  sous-titre : Clonez le dépôt, créez un fichier templates/home.md, et c’est parti. Le pipeline i18n s’occupe du reste.
  actions :
    - text: Obtenir le modèle
      href: https://github.com/arthelokyo/astrowind
      variant: primary
      icon: tabler:download
    - text: Lire la documentation
      href: &#x27;#features&#x27;
      icon: tabler:book
