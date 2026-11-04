# Guía de diseño: Akira Astrum (blog de astrología)

Documento breve para orientar el diseño de la interfaz. La prioridad del proyecto es la arquitectura, los tests y la seguridad. El pulido visual se hizo en un bloque propio, «noche y marfil» ([ADR 0018](adr/0018-identidad-visual-noche-y-marfil-tokens-por-superficie-y-adornos-propios.md)); este documento recoge la identidad vigente.

## 1. Tono y público

- Blog de astrología con contenido divulgativo, escrito por el admin.
- Público general, con interés curioso o de iniciación.
- Tono: sereno, cercano y legible. Místico y elegante en la estética, no en la usabilidad: las superficies oscuras solo se usan con el contraste comprobado y el movimiento nunca distrae ni es obligatorio (ver §7).

## 2. Paleta y superficies

Dos superficies con **los mismos nombres de token** (variables CSS en `app/globals.css`):

- **Marfil** (por defecto): lectura, tarjetas, formularios y todo el panel de administración.
- **Noche** (`data-surface="night"`): cabecera, pie, héroe de la portada, bandas de título, la caja de llamada a la calculadora de las entradas y el marcador de portada. Redefine los tokens, de modo que botones, campos, enlaces y foco se adaptan solos.

| Token | Marfil | Noche | Notas |
|---|---|---|---|
| Fondo | `#FBF8F3` | `#0B1026` | Azul noche profundo |
| Texto | `#14142B` | `#F4EFE6` | Contraste alto (≥ 7:1) |
| Tarjeta | `#FFFEFB` | `#141C40` | |
| Texto secundario | `#55556B` | `#B7B5C8` | ≥ 4,5:1 sobre fondo y tarjeta |
| Primario | `#2E2E7A` (texto blanco) | `#D9B877` (texto `#0B1026`) | Índigo en marfil; botón dorado en noche |
| Dorado | `#8A6410` | `#D9B877` | En marfil **solo decorativo o texto grande** (5,1:1); en noche también como texto |
| Error | `#B42318` | `#FF9B8F` | Siempre con icono y texto |
| Borde de campos | `#8E8878` | `#9A8250` | ≥ 3:1 |
| Anillo de foco | `#2E2E7A` | `#D9B877` | ≥ 3:1 |

- **Estados:** rojo, verde y ámbar con icono y texto; nunca transmitir información solo por color.
- Los contrastes se comprueban con herramienta, no a ojo: `tests/unit/design/palette.test.ts` aplica la fórmula de WCAG 2 a estos pares leyendo `globals.css`, y los e2e de axe lo vigilan en cada página.
- Una superficie nueva usa `data-surface="night"` y los tokens, nunca colores sueltos; sus pares se añaden al test de contraste. El panel de administración no usa la noche.

## 3. Tipografía

- Títulos: **Cormorant Garamond** con pesos 300 a 600 y cursiva. Titulares grandes y ligeros (300), jerarquía clara y `text-balance`; las citas, en cursiva.
- Cuerpo: **Inter**, muy legible, de 16 px o más y con interlineado de 1,85 en las entradas.
- Cargar las fuentes con `next/font`, para que se sirvan desde el propio dominio y no obliguen a abrir la CSP a terceros.
- No aplicar `text-transform` a texto existente (los nombres accesibles no cambian) y no usar glifos de fuente como adornos: no todas las fuentes los incluyen.

## 4. Componentes

- **shadcn/ui** (botones, formularios, diálogos) con los tokens adaptados a las dos superficies; no se rediseñan sus componentes por dentro.
- **Componentes propios de la web pública:** `SiteHeader` y `SiteFooter` (noche), `HomeHero` y `PageBanner` (sobre `NightBand`, la banda con constelaciones), `PostCard`, `CoverPlaceholder` y los adornos de `components/ornaments.tsx` (estrella, filete con estrella y constelaciones). Los estilos compartidos viven en `components/ui/surface-styles.ts` (`panelClass` y los anchos de contenedor).
- **Adornos:** SVG y CSS propios, siempre `aria-hidden`, sin recursos externos.
- Iconografía: los símbolos zodiacales en Unicode o SVG propio, siempre con texto alternativo o etiqueta accesible (por ejemplo, "Aries"), nunca como único contenido.

## 5. Pantallas (wireframes en texto)

**Portada**
```
[Cabecera noche: ✦ Akira Astrum · Blog · Compatibilidad]
[Héroe noche con constelaciones: titular grande · presentación · botón dorado «Calcular compatibilidad»]
[Marfil: «Últimas entradas» con adorno]
[Entrada destacada: portada (o constelación) · título · categoría · fecha · tiempo de lectura]
[Cuadrícula de entradas recientes: igual que la destacada, 1/2/3 columnas]
[Pie noche: aviso de uso, enlace a la intranet]
```

**Entrada**
```
[Cabecera noche]
[Título grande y ligero · categoría · fecha]
[Imagen de portada con marco y sombra suave]
[Contenido en Markdown, ancho de lectura cómodo (≈ 70 caracteres); cita en cursiva con filete dorado; separador de filete dorado]
[Caja noche: enlace a la calculadora]
[Pie noche]
```

**Categoría** y **Blog**: banda de título noche y listado de sus entradas sobre marfil.

**Calculadora de compatibilidad**
```
[Banda de título noche: título y explicación breve]
[Panel marfil: Fecha de nacimiento 1 · Fecha de nacimiento 2 (campos de fecha nativos) · Botón: Calcular]
[Resultado: signo A + signo B · elemento de cada uno · nivel de compatibilidad (texto + icono) · explicación]
[Aviso visible: "Basado en convenciones de la tradición astrológica; no tiene base científica. Con fines informativos y de entretenimiento. No se guarda ningún dato."]
```

**Login** (intranet)
```
[Cabecera noche con la marca y el menú Blog · Compatibilidad: se puede volver sin los botones del navegador]
[Banda de título noche: «Acceso a la intranet»]
[Panel marfil: correo, contraseña, botón y mensaje de error genérico]
[Pie noche, sin el enlace «Intranet» (apuntaría a sí mismo)]
```

**404 y error**: cabecera noche, banda con el mensaje, y un enlace de vuelta a la portada o el botón de reintentar.

**Panel de administración** (siempre marfil): listado de entradas con estado (borrador/publicado), filtros y acciones (editar, publicar/despublicar, eliminar con confirmación).

**Editor de entrada**
```
[Título · slug (autogenerado, editable)]
[Categorías]
[Imagen de portada: subir · texto alternativo (obligatorio)]
[Insertar imagen en el contenido: archivo · texto alternativo (obligatorio) · botón «Insertar imagen»]
[Editor Markdown con vista previa]
[Guardar borrador · Publicar]
```

## 6. Responsive

- Diseño **móvil primero**: una columna en móvil, cuadrícula en pantallas mayores. Es obligatorio también en la intranet, incluido el editor de entradas.
- Sin desplazamiento horizontal, también a 320 px: la cabecera pasa a dos líneas si no cabe. Objetivos táctiles de al menos 44 px.
- Tablas del panel: en móvil se transforman en tarjetas o en listas apiladas, no en tablas con scroll lateral.
- Editor Markdown: en móvil, editor y vista previa en pestañas; en escritorio, a doble columna.
- Imágenes responsivas con `next/image` (tamaños adaptados y carga diferida).
- Comprobar en Playwright, con proyectos de escritorio y de móvil emulado, las pantallas críticas (portada, entrada, calculadora, login, panel y editor).

## 6 bis. Uso como aplicación web (PWA)

- Instalable desde el navegador: nombre, nombre corto, iconos (incluido uno enmascarable), color de tema y modo de pantalla `standalone` definidos en el manifiesto. Color de tema: noche `#0B1026`; color de fondo: marfil `#FBF8F3`.
- En modo aplicación no hay botón de volver ni barra de direcciones: la navegación propia debe ser siempre visible y permitir volver, sobre todo en el acceso, el editor y las entradas.
- Respetar las zonas seguras de pantalla (muescas y barras del sistema) con `viewport-fit=cover` y márgenes adecuados.
- Estilos específicos para `display-mode: standalone` solo cuando hagan falta.
- Sin conexión: una página sencilla que lo explica, nunca contenido de la intranet guardado en caché.
- Documentar en el README cómo instalarla en Android, iOS y escritorio.

## 7. Accesibilidad

- Contraste suficiente en texto e interfaces, comprobado por test (ver §2).
- Todos los formularios con etiquetas asociadas y mensajes de error legibles por lectores de pantalla.
- Navegación completa con teclado y foco visible, también sobre las superficies noche (anillo dorado).
- Estructura de encabezados coherente (un solo `h1` por página).
- Texto alternativo obligatorio al subir imágenes desde el editor.
- Movimiento: las elevaciones y transiciones solo con `motion-safe`, y una regla global bajo `prefers-reduced-motion: reduce` las desactiva.
- Los adornos son decorativos y están ocultos a los lectores de pantalla.
- Pruebas automatizadas de accesibilidad en Playwright (por ejemplo, con `@axe-core/playwright`) sobre las pantallas principales.

## 8. Orden de trabajo (hecho)

1. Layout base, tipografía y paleta como variables (tokens) en Tailwind. ✔
2. Pantallas públicas con los componentes por defecto. ✔
3. Panel y editor de la intranet. ✔
4. Pulido visual «noche y marfil» sin tocar la lógica ni los tests de seguridad ([ADR 0018](adr/0018-identidad-visual-noche-y-marfil-tokens-por-superficie-y-adornos-propios.md)). ✔
