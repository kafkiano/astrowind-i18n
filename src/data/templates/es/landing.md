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
      href: https://github.com/arthelokyo/astrowind
      variant: primary
      icon: tabler:brand-github
    - text: Más información
      href: '#características'
      icon: tabler:arrow-down
features:
  tagline: Cómo funciona
  title: Páginas centradas en el contenido
  items:
    - title: Editar en el CMS
      description: 'Todo el contenido se encuentra en un único archivo Markdown. Edítalo a través del CMS de Sveltia: no es necesario modificar el código. Añade secciones, cambia el texto o sustituye imágenes.'
      icon: tabler:edit
    - title: Traducido automáticamente
      description: El sistema i18n traduce automáticamente todos los campos anidados de la información preliminar mediante DeepL o Gemini. Un solo archivo fuente para todas las configuraciones regionales.
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
---

testimonios:
  - título: Arquitectura limpia
    testimonio: Separar el contenido de la presentación es la decisión acertada. Este patrón hace que la creación y el mantenimiento de los sitios web de los clientes sean muy sencillos.
    nombre: Desarrollador jefe
  - título: Compatible con CMS
    testimonio: Los clientes pueden editar sus propias páginas de destino sin tocar ni una línea de código. Justo lo que nuestra agencia necesitaba.
    nombre: Propietario de la agencia
  - título: La magia de la traducción
    testimonio: La traducción YAML anidada es brillante. Un solo archivo en inglés y, de repente, tenemos versiones perfectas en español, francés y alemán.
    nombre: Gestor de contenidos
  - título: Widgets flexibles
    testimonio: Poder añadir o eliminar secciones completas editando el frontmatter supone un gran avance para la creación rápida de prototipos.
    nombre: Diseñador de UX

cta:
  título: Empieza a crear hoy mismo
  subtítulo: Clona el repositorio, crea un archivo templates/home.md y ya estás listo. El proceso de internacionalización (i18n) se encarga del resto.
  acciones:
    - texto: Obtener la plantilla
      href: https://github.com/arthelokyo/astrowind
      variante: principal
      icono: tabler:download
    - texto: Leer la documentación
      href: &#x27;#features&#x27;
      icono: tabler:book
