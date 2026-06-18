---
title: Página en Markdown
showIn: header
order: 1
group: Recursos
---

### ¿Qué es Markdown?

Markdown es un lenguaje de marcado ligero que puedes utilizar para dar formato a documentos de texto sin formato.  
Escribe documentos para tus proyectos de GitHub, edita el archivo _README_ de tu perfil de GitHub, etc. Aquí encontrarás todo lo que necesitas.

Vamos a profundizar en ello. ⤵️

#### Índice

1. [Párrafo](#párrafo)
2. [Encabezados](#encabezados)
3. [Énfasis](#énfasis)
4. [Cita destacada](#blockquote)
5. [Imágenes](#images)
6. [Enlaces](#links)
7. [Código](#code)
8. [Listas](#lists)
   - [Lista ordenada](#orderedlist)
   - [Lista sin ordenar](#unorderedlist)
   - [Lista mixta](#mixedlist)
9. [Tabla](#table)
10. [Lista de tareas](#tasklist)
11. [Nota al pie](#footnote)
12. [Ir a la sección](#sectionjump)
13. [Línea horizontal](#horizontalline)
14. [HTML](#html)

---

## Párrafo

Al escribir texto normal, básicamente estás escribiendo un párrafo.

```
Este es un párrafo.
```

Este es un párrafo.

---

## Encabezados

Hay 6 variantes de encabezados. El número de símbolos «#», seguidos de texto, indica la importancia del encabezado.

```
# Encabezado 1
## Encabezado 2
### Encabezado 3
#### Encabezado 4
##### Encabezado 5
###### Encabezado 6
```

# Encabezado 1

## Encabezado 2

### Encabezado 3

#### Encabezado 4

##### Título 5

###### Título 6

---

## Énfasis

Modificar el texto es muy sencillo y práctico. Puedes poner el texto en negrita, cursiva o tachado.

```
Usando dos asteriscos **este texto aparece en negrita**.
Dos guiones bajos __también funcionan__.
Ahora pongámoslo *en cursiva*.
Lo has adivinado, _un guión bajo también es suficiente_.
¿Podemos combinar **_ambas cosas_?** Por supuesto.
¿Y si quiero ~~tacharlo~~?
```

Usando dos asteriscos **este texto está en negrita**.  
Dos guiones bajos **también funcionan**.  
Ahora pongámoslo _en cursiva_.  
Lo has adivinado, _un guión bajo también basta_.  
¿Podemos combinar **_ambas cosas_?** Por supuesto.  
¿Y si quiero ~~tachar~~?

---

## Cita destacada

¿Quieres resaltar la importancia del texto? No digas más.

```
> Esto es una cita destacada.
> ¿Quieres escribir en una nueva línea con espacio entre líneas?
>
> > ¿Y anidada? No hay ningún problema.
> >
> > > P. D.: puedes **dar estilo** a tu texto _como quieras_.
```

> Esto es una cita en bloque.
> ¿Quieres escribir en una nueva línea con espacio entre líneas?
>
> > ¿Y anidada? No hay ningún problema.
> >
> > > P. D.: puedes **dar estilo** a tu texto _como quieras_. :

---

## Imágenes

La mejor forma es simplemente arrastrar y soltar la imagen directamente desde tu ordenador. También puedes crear una referencia a la imagen y asignarla de esa manera.  
Aquí tienes la sintaxis.

```
![texto si la imagen no se carga](ruta-automática-al-archivo-al-subir-la-imagen "Texto que se muestra al pasar el cursor")

[logotipo]: ruta-automática-al-archivo-al-subir-la-imagen "Pasa el cursor por aquí"
![texto de error][logotipo]
```

![texto si la imagen no se carga](https://user-images.githubusercontent.com/46372998/212541682-9907aaea-5198-45a9-8961-2acc8a98a0db.png 'Texto que se muestra al pasar el cursor')

[logotipo]: https://user-images.githubusercontent.com/46372998/212541682-9907aaea-5198-45a9-8961-2acc8a98a0db.png 'Pasa el cursor por aquí'

![texto de error][logotipo]

---

## Enlaces

Al igual que las imágenes, los enlaces también se pueden insertar directamente o creando una referencia. Puedes crear tanto enlaces en línea como de bloque.

```
[guía rápida de Markdown]: https://github.com/im-luka/markdown-cheatsheet
[documentación]: https://github.com/adam-p/markdown-here

[¿Te gusta lo que has visto hasta ahora? Sígueme en GitHub](https://github.com/im-luka)
[Mi hoja de referencia de Markdown: márcala con una estrella si te gusta][markdown-cheatsheet]
Encuentra documentación muy útil [aquí][docs]
```

[markdown-cheatsheet]: https://github.com/im-luka/markdown-cheatsheet
[docs]: https://github.com/adam-p/markdown-here

[¿Te está gustando hasta ahora? Sígueme en GitHub](https://github.com/im-luka)  
[Mi hoja de referencia de Markdown: márcala con una estrella si te gusta][markdown-cheatsheet]  
Encuentra documentación estupenda [aquí][docs]

---

## Código

Puedes crear fragmentos de código tanto en línea como en bloques completos. También puedes definir el lenguaje de programación que estás utilizando en tu fragmento. Todo ello utilizando comillas invertidas.

````
    He creado el archivo `.env` en la raíz.
    ¿Comillas invertidas dentro de comillas invertidas? `` `No hay problema.` ``

    ```
    {
 learning: "Markdown",
 showing: "fragmento de código en bloque"
    }
    ```

 ```js
    const x = "Fragmento de código en bloque en JS";
    console.log(x);
    ```
````

He creado el archivo `.env` en el directorio raíz.
¿Comillas invertidas dentro de comillas invertidas? `` `No hay problema.` ``

```
{
  learning: "Markdown",
  showing: "fragmento de código en bloque"
}
```

```js
const x = 'Fragmento de código en bloque en JS';
console.log(x);
```

---

## Listas

Al igual que en HTML, Markdown permite crear listas tanto numeradas como sin numerar.

### Lista ordenada

```
1. HTML
2. CSS
3. JavaScript
4. React
7. Ahora soy desarrollador front-end 👨🏼‍🎨
```

1. HTML
2. CSS
3. JavaScript
4. React
5. Ahora soy desarrollador front-end 👨🏼‍🎨

### Lista sin ordenar

```
- Node.js
+ Express
* Nest.js
- Aprendiendo back-end ⌛️
```

- Node.js

* Express

- Nest.js

* Aprendiendo back-end ⌛️

### Lista mixta

También puedes mezclar ambas listas y crear sublistas.  
**PD:** Intenta no crear listas con más de dos niveles de profundidad. Es la mejor práctica.

```
1. Aprender los conceptos básicos
   1. HTML
   2. CSS
   7. JavaScript
2. Aprender un framework
   - React
 - Router
 - Redux
   * Vue
   + Svelte
```

1. Aprende los conceptos básicos
   1. HTML
   2. CSS
   3. JavaScript
2. Aprende un framework
   - React
 - Router
 - Redux
   * Vue
   - Svelte

---

## Tabla

Una forma estupenda de mostrar datos bien organizados. Utiliza el símbolo «|» para separar columnas y el símbolo «:» para alinear el contenido de las filas.

```
| Alineación a la izquierda (por defecto) | Alineación centrada | Alineación a la derecha |
| :------------------- | :----------: | ----------: |
| React.js | Node.js | MySQL |
| Next.js | Express | MongoDB     |
| Vue.js | Nest.js | Redis |
```

| Alineación a la izquierda (predeterminada) | Alineación centrada | Alineación a la derecha |
| :------------------- | :----------: | ----------: |
| React.js |   Node.js    | MySQL |
| Next.js |   Express    |     MongoDB |
| Vue.js |   Nest.js    | Redis |

---

## Lista de tareas

Llevar un registro de las tareas que se han completado y de las que quedan por hacer.

```
- [x] Aprender Markdown
- [ ] Aprender desarrollo front-end
- [ ] Aprender desarrollo full-stack
```

- [x] Aprender Markdown
- [ ] Aprender desarrollo front-end
- [ ] Aprender desarrollo full-stack

---

## Nota al pie

¿Quieres añadir algo al final del archivo? ¡Utiliza una nota al pie!

```
#### Estoy trabajando en un nuevo proyecto. [^1]
[^1]: La pila tecnológica es: React, TypeScript, Tailwind CSS

El proyecto trata sobre música y películas.

##### Espero que te guste. [^ver]
[^ver]: Cargando... ⌛️
```

#### Estoy trabajando en un nuevo proyecto. [^1]

[^1]: La pila tecnológica es: React, TypeScript, Tailwind CSS

El proyecto trata sobre música y películas.

##### Espero que os guste. [^ver]

[^ver]: Cargando... ⌛️

---

## Ir a la sección

Astro (y la mayoría de los analizadores de Markdown) genera automáticamente identificadores para tus encabezados. Normalmente no es necesario crear etiquetas `<a name="...">` manualmente.

---

## Línea horizontal

Puedes utilizar asteriscos, guiones o guiones bajos (\*, -, \_) para crear una línea horizontal.  
La única regla es que debes incluir al menos tres caracteres del símbolo.

```
Primera línea horizontal

***

Segunda

-----

Tercera

_________
```

Primera línea horizontal

---

Segunda

---

Tercera

---

---

## HTML

También puedes utilizar código HTML sin formato en tu archivo Markdown. La mayoría de las veces funcionará bien, pero en ocasiones puedes encontrar algunas diferencias a las que no estás acostumbrado al trabajar con HTML estándar. El uso de CSS no funcionará.

```
<h1>Este es un encabezado</h1>
<p>Párrafo...</p>

<hr />

<img src="ruta-generada-automáticamente-al-subir-la-imagen" width="200">
<a href="https://github.com/im-luka">Sígueme en GitHub</a>

<br />
<br />

<p>¿Un truco rápido para <strong><em>centrar la imagen</em></strong>?</p>
<p align="center"><img src="ruta-generada-automáticamente-al-subir-la-imagen" /></p>

<details>
  <summary>¿Otro truco rápido? 🎭</summary>

  → Fácil
  → Y sencillo
</details>
```

<h1>Este es un título</h1>
<p>Párrafo...</p>

<hr />

<img src="https://user-images.githubusercontent.com/46372998/212544874-d0654588-82f7-44f2-bbfa-2bf85fd73854.png" width="200">
<a href="https://github.com/im-luka">Sígueme en GitHub</a>

<br />
<br />

<p>Truco rápido para <strong><em>centrar una imagen</em></strong>?</p>
<p align="center"><img src="https://user-images.githubusercontent.com/46372998/212544874-d0654588-82f7-44f2-bbfa-2bf85fd73854.png" width="200" /></p>

<details>
  <summary>¿Otro truco rápido más? 🎭</summary>
  
  → Fácil  
  → Y sencillo
</details>

---

## Diagramas Mermaid

### Mapa mental

```mermaid
mindmap
  root((Test Intelligence Hub))
    Adquisición de datos
 Integración de API
 Automatización del navegador
 Fuentes RSS
      Programación y orquestación
    Procesamiento de datos
 Almacenamiento de datos estructurados
 Procesamiento de datos no estructurados
 Integración de LLM
 Emparejamiento y puntuación
    Interfaz de usuario
 Panel de control y visualización
 Gestión de alertas
 Configuración y ajustes
    Infraestructura
 Supervisión y registro
      Gestión de errores
 Escalabilidad
 Eficiencia de costes
```

### Diagrama de flujo

```mermaid
flowchart LR
    A[Fuentes de datos] --> B[Capa de ingestión]
    B --> C[Capa de procesamiento]
    C --> D[Capa de almacenamiento]
    D --> E[Interfaz de usuario]
    D --> F[Interfaz LLM]
    G[Capa de supervisión] -.-> B
    G -.-> C
    G -.-> D
```

---

##### Sección con algún ID
