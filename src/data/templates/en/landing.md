---
title: Template-Driven Landing Demo

hero:
  tagline: Markdown-Powered
  title: This entire page is driven by a single markdown file
  subtitle: Edit the markdown file to change everything you see here. Add or remove sections and the page adapts automatically.
  image:
    src: ~/assets/images/hero-image.png
    alt: AstroWind hero image
  actions:
    - text: View on GitHub
      href: https://github.com/arthelokyo/astrowind
      variant: primary
      icon: tabler:brand-github
    - text: Learn more
      href: '#features'
      icon: tabler:arrow-down

features:
  tagline: How it works
  title: Content-driven pages
  items:
    - title: Edit in CMS
      description: All content lives in a single markdown file. Edit it via Sveltia CMS — no code changes needed. Add sections, change text, swap images.
      icon: tabler:edit
    - title: Auto-translated
      description: The i18n system translates all nested frontmatter fields automatically via DeepL or Gemini. One source file, every locale.
      icon: tabler:language
    - title: Widget composition
      description: Choose which widgets appear by adding or removing sections in the frontmatter. Hero, Features, Testimonials, CTA — mix and match.
      icon: tabler:puzzle
    - title: Nested YAML
      description: Frontmatter supports deeply nested objects and arrays. The translation system traverses every string value — no flat-field limitations.
      icon: tabler:json
    - title: Branch-per-client
      description: Each client gets their own branch. Customize config, branding, and content without touching widget internals or the base theme.
      icon: tabler:git-branch
    - title: Zero code changes
      description: Clients edit markdown and images only. The .astro template reads frontmatter and maps it to widgets. No HTML, no JavaScript.
      icon: tabler:code-off
---

testimonials:
  - title: Clean architecture
    testimonial: Separating content from presentation is the right call. This pattern makes client sites trivial to build and maintain.
    name: Lead Developer
  - title: CMS-friendly
    testimonial: Clients can edit their own landing pages without touching a line of code. Exactly what our agency needed.
    name: Agency Owner
  - title: Translation magic
    testimonial: The nested YAML translation is brilliant. One English file, and suddenly we have perfect Spanish, French, and German versions.
    name: Content Manager
  - title: Flexible widgets
    testimonial: Being able to add or remove entire sections by editing frontmatter is a game-changer for rapid prototyping.
    name: UX Designer

cta:
  title: Start building today
  subtitle: Clone the repo, create a templates/home.md, and you are off. The i18n pipeline handles the rest.
  actions:
    - text: Get the template
      href: https://github.com/arthelokyo/astrowind
      variant: primary
      icon: tabler:download
    - text: Read the docs
      href: '#features'
      icon: tabler:book
