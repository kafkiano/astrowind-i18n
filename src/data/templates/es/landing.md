---
title: Demostración de una página de destino basada en plantillas
hero:
  tagline: Basado en Markdown
  title: Toda esta página se genera a partir de un único archivo Markdown
  subtitle: Edita el archivo Markdown para cambiar todo lo que ves aquí. Añade o elimina secciones y la página se adaptará automáticamente.
  image:
    src: ~/assets/images/hero-image.png
    alt: Imagen destacada de AstroWind
  actions:
    - text: Ver en GitHub
      href: https://github.com/kafkiano/astrowind-i18n
      variant: primary
      icon: tabler:brand-github
    - text: Más información
      href: '#features'
      icon: tabler:arrow-down
features:
  tagline: Cómo funciona
  title: Páginas centradas en el contenido
  items:
    - title: Editar en el CMS
      description: 'Todo el contenido se encuentra en un único archivo Markdown. Edítalo a través del CMS de Sveltia: no es necesario modificar el código. Añade secciones, cambia el texto o sustituye imágenes.'
      icon: tabler:edit
    - title: Traducido automáticamente
      description: El sistema i18n traduce automáticamente todos los campos de frontmatter anidados mediante DeepL o Gemini. Un único archivo fuente para todas las configuraciones regionales.
      icon: tabler:language
    - title: Composición de widgets
      description: 'Elige qué widgets aparecen añadiendo o eliminando secciones en el frontmatter. Hero, Destacados, Testimonios, CTA: combínalos como quieras.'
      icon: tabler:puzzle
    - title: YAML anidado
      description: Frontmatter admite objetos y matrices profundamente anidados. El sistema de traducción recorre cada valor de cadena, sin limitaciones de campos planos.
      icon: tabler:json
    - title: Una sucursal por cliente
      description: Cada cliente dispone de su propia rama. Personaliza la configuración, la imagen de marca y el contenido sin modificar el funcionamiento interno de los widgets ni el tema base.
      icon: tabler:git-branch
    - title: Sin cambios en el código
      description: Los clientes solo editan el código Markdown y las imágenes. La plantilla .astro lee el frontmatter y lo asigna a los widgets. Sin HTML, sin JavaScript.
      icon: tabler:code-off
testimonials:
  - title: Arquitectura limpia
    testimonial: Separar el contenido de la presentación es la decisión acertada. Este patrón hace que la creación y el mantenimiento de los sitios web de los clientes resulten muy sencillos.
    name: Lead Developer
  - title: Compatible con CMS
    testimonial: Los clientes pueden editar sus propias páginas de destino sin tener que tocar ni una sola línea de código. Justo lo que necesitaba nuestra agencia.
    name: Agency Owner
  - title: La magia de la traducción
    testimonial: La traducción anidada en YAML es genial. Con un solo archivo en inglés, de repente tenemos versiones perfectas en español, francés y alemán.
    name: Content Manager
  - title: Widgets flexibles
    testimonial: La posibilidad de añadir o eliminar secciones completas mediante la edición del frontmatter supone un gran avance para la creación rápida de prototipos.
    name: UX Designer
cta:
  title: Empieza a construir hoy mismo
  subtitle: Clona el repositorio, crea un archivo templates/home.md y ya estás listo. El proceso de internacionalización (i18n) se encarga del resto.
  actions:
    - text: Descarga la plantilla
      href: https://github.com/kafkiano/astrowind-i18n
      variant: primary
      icon: tabler:download
    - text: Lee la documentación
      href: '#features'
      icon: tabler:book
---


