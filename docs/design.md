# Guía de diseño: Akira Astrum (blog de astrología)

Documento breve para orientar el diseño de la interfaz. La prioridad del proyecto es la arquitectura, los tests y la seguridad: primero funcionalidad con estilo mínimo, y pulido visual al final si queda tiempo (máximo medio día).

## 1. Tono y público

- Blog de astrología con contenido divulgativo, escrito por el admin.
- Público general, con interés curioso o de iniciación.
- Tono: sereno, cercano y legible. Místico en la estética, no en la usabilidad: nada de texto ilegible sobre fondos oscuros ni animaciones que distraigan.

## 2. Paleta (valores orientativos)

| Uso | Color | Notas |
|---|---|---|
| Fondo | crema `#FAF7F2` | Tema claro por defecto; el modo oscuro solo si sobra tiempo |
| Texto | azul noche muy oscuro `#1B1B2F` | Contraste alto sobre el fondo |
| Primario | índigo `#3B3B98` | Enlaces, botones, elementos interactivos |
| Acento | dorado `#B8860B` | **Solo decorativo o en textos grandes**: sobre crema no alcanza el contraste mínimo para texto pequeño |
| Estados | rojo/verde con icono y texto | Nunca transmitir información solo por color |

Los contrastes se comprueban con herramienta (y con los tests de accesibilidad automatizados), no solo a ojo.

## 3. Tipografía

- Títulos: una fuente serif con carácter (por ejemplo, Cormorant Garamond o Playfair Display).
- Cuerpo: una sans-serif muy legible (por ejemplo, Inter).
- Cargar las fuentes con `next/font`, para que se sirvan desde el propio dominio y no obliguen a abrir la CSP a terceros.
- Cuerpo de texto de 16 px o más, con interlineado generoso en las entradas.

## 4. Componentes

- Usar **shadcn/ui** tal cual (botones, formularios, tarjetas, diálogos, tablas). No diseñar componentes propios salvo los imprescindibles.
- Iconografía: los símbolos zodiacales en Unicode o SVG propio, siempre con texto alternativo o etiqueta accesible (por ejemplo, "Aries"), nunca como único contenido.

## 5. Pantallas (wireframes en texto)

**Portada**
```
[Cabecera: logo Akira Astrum · Blog · Categorías · Compatibilidad]
[Entrada destacada: imagen · título · extracto]
[Cuadrícula de entradas recientes: imagen · título · categoría · fecha · tiempo de lectura]
[Pie: aviso de uso, enlace a la intranet]
```

**Entrada**
```
[Imagen de portada]
[Título · categoría · fecha]
[Contenido en Markdown, ancho de lectura cómodo (≈ 70 caracteres)]
[Entradas relacionadas / enlace a la calculadora]
```

**Categoría**: título de la categoría y listado de sus entradas.

**Calculadora de compatibilidad**
```
[Título y explicación breve]
[Fecha de nacimiento 1] [Fecha de nacimiento 2]   (campos de fecha nativos)
[Botón: Calcular]
[Resultado: signo A + signo B · elemento de cada uno · nivel de compatibilidad (texto + icono) · explicación]
[Aviso visible: "Basado en convenciones de la tradición astrológica; no tiene base científica. Con fines informativos y de entretenimiento. No se guarda ningún dato."]
```

**Login** (intranet): correo, contraseña, botón y mensaje de error genérico.

**Panel de administración**: listado de entradas con estado (borrador/publicado), filtros y acciones (editar, publicar/despublicar, eliminar con confirmación).

**Editor de entrada**
```
[Título · slug (autogenerado, editable)]
[Categorías]
[Imagen de portada: subir · texto alternativo (obligatorio)]
[Editor Markdown con vista previa · botón para insertar imagen (con texto alternativo obligatorio)]
[Guardar borrador · Publicar]
```

## 6. Responsive

- Diseño **móvil primero**: una columna en móvil, cuadrícula en pantallas mayores. Es obligatorio también en la intranet, incluido el editor de entradas.
- Sin desplazamiento horizontal. Objetivos táctiles de al menos 44 px.
- Tablas del panel: en móvil se transforman en tarjetas o en listas apiladas, no en tablas con scroll lateral.
- Editor Markdown: en móvil, editor y vista previa en pestañas; en escritorio, a doble columna.
- Imágenes responsivas con `next/image` (tamaños adaptados y carga diferida).
- Comprobar en Playwright, con proyectos de escritorio y de móvil emulado, las pantallas críticas (portada, entrada, calculadora, login, panel y editor).

## 6 bis. Uso como aplicación web (PWA)

- Instalable desde el navegador: nombre, nombre corto, iconos (incluido uno enmascarable), color de tema y modo de pantalla `standalone` definidos en el manifiesto.
- En modo aplicación no hay botón de volver ni barra de direcciones: la navegación propia debe ser siempre visible y permitir volver, sobre todo en el editor y en las entradas.
- Respetar las zonas seguras de pantalla (muescas y barras del sistema) con `viewport-fit=cover` y márgenes adecuados.
- Estilos específicos para `display-mode: standalone` solo cuando hagan falta.
- Sin conexión: una página sencilla que lo explica, nunca contenido de la intranet guardado en caché.
- Documentar en el README cómo instalarla en Android, iOS y escritorio.

## 7. Accesibilidad

- Contraste suficiente en texto e interfaces.
- Todos los formularios con etiquetas asociadas y mensajes de error legibles por lectores de pantalla.
- Navegación completa con teclado y foco visible.
- Estructura de encabezados coherente (un solo `h1` por página).
- Texto alternativo obligatorio al subir imágenes desde el editor.
- Pruebas automatizadas de accesibilidad en Playwright (por ejemplo, con `@axe-core/playwright`) sobre las pantallas principales.

## 8. Orden de trabajo sugerido

1. Layout base, tipografía y paleta como variables (tokens) en Tailwind.
2. Pantallas públicas con los componentes por defecto.
3. Panel y editor de la intranet.
4. Pulido visual solo al final, sin tocar la lógica ni los tests.
