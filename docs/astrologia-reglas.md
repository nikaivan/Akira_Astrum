# Reglas astrológicas de la calculadora de compatibilidad

> **Documento de especificación del dominio.** Lo redacta el humano (arquitecto); la IA no inventa ni modifica estas reglas. Los tests unitarios de `lib/astrology/` se escriben a partir de este documento.
> **Estado: BORRADOR generado con ayuda de IA** a partir de las 12 páginas de compatibilidad de euroresidentes.com (datos de pareja) y su página de fechas de signos. Los textos de la sección 5 son de redacción propia (no copiados). **Ivan debe revisar y validar todo lo marcado con ⚠️ antes de dárselo a la IA de desarrollo**, y calcular a mano los casos de la sección 7.

## 1. Convenciones generales

- **Sistema de referencia:** zodiaco tropical tradicional de 12 signos (sin Ofiuco). ⚠️ Confirmar.
- **Qué se calcula:** solo el **signo solar**, a partir de la fecha de nacimiento. No se usa hora ni lugar de nacimiento, ni ascendente ni otras posiciones.
- **Cúspides:** convención fija, la de la tabla de la sección 2 (tomada de euroresidentes.com). Cada fecha pertenece a un único signo. ⚠️ Otras fuentes difieren en ±1 día en algunos signos; tu criterio como docente manda.
- **Rango de fechas admitido:** desde 1900 hasta la fecha actual. ⚠️ Decidir el año mínimo.
- **Fecha 29 de febrero:** pertenece a **Piscis** (19/2–20/3).
- **Fuente de la compatibilidad:** la tabla de parejas de la sección 4.1 (12×12) es la **fuente de verdad**. La matriz por elementos (4.2) solo se usa para elegir el texto explicativo.

## 2. Tabla de signos

| Signo | Símbolo | Desde (día/mes) | Hasta (día/mes) | Elemento | Modalidad |
|---|---|---|---|---|---|
| Aries | ♈ | 21/3 | 20/4 | Fuego | Cardinal |
| Tauro | ♉ | 21/4 | 20/5 | Tierra | Fijo |
| Géminis | ♊ | 21/5 | 20/6 | Aire | Mutable |
| Cáncer | ♋ | 21/6 | 20/7 | Agua | Cardinal |
| Leo | ♌ | 21/7 | 21/8 | Fuego | Fijo |
| Virgo | ♍ | 22/8 | 22/9 | Tierra | Mutable |
| Libra | ♎ | 23/9 | 22/10 | Aire | Cardinal |
| Escorpio | ♏ | 23/10 | 22/11 | Agua | Fijo |
| Sagitario | ♐ | 23/11 | 21/12 | Fuego | Mutable |
| Capricornio | ♑ | 22/12 | 19/1 | Tierra | Cardinal |
| Acuario | ♒ | 20/1 | 18/2 | Aire | Fijo |
| Piscis | ♓ | 19/2 | 20/3 | Agua | Mutable |

Nota: Capricornio cruza el cambio de año (22/12 – 19/1). Con esta tabla, los 366 días del año (incluido el 29/2) pertenecen a exactamente un signo; esto está comprobado con un script (ver sección 8).

## 3. Niveles de compatibilidad

Conjunto cerrado de niveles que puede devolver la calculadora.

| Nivel (código) | Nombre mostrado | Descripción breve |
|---|---|---|
| alta | Alta | Afinidad natural: los signos suelen entenderse con facilidad. |
| media | Media | Mezcla de afinidades y diferencias: hay base común y aspectos que trabajar. |
| baja | Baja / Desafiante | Estilos muy distintos: requiere más diálogo y paciencia. |

## 4. Reglas de compatibilidad

### 4.1 Tabla de parejas (fuente de verdad)

Nivel para cada pareja (A = Alta, M = Media, B = Baja). Es simétrica por construcción (verificado: 0 asimetrías entre las 12 páginas de origen). Cada signo tiene exactamente 4 parejas Altas.

| | Aries | Tauro | Géminis | Cáncer | Leo | Virgo | Libra | Escorpio | Sagitario | Capricornio | Acuario | Piscis |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **Aries** | M | M | A | B | A | B | M | B | A | B | A | M |
| **Tauro** | M | M | M | A | B | A | M | M | B | A | B | A |
| **Géminis** | A | M | M | M | A | B | A | B | M | B | A | B |
| **Cáncer** | B | A | M | M | M | A | B | A | B | M | B | A |
| **Leo** | A | B | A | M | M | M | A | B | A | B | M | M |
| **Virgo** | B | A | B | A | M | M | M | A | B | A | M | M |
| **Libra** | M | M | A | B | A | M | M | M | A | B | A | M |
| **Escorpio** | B | M | B | A | B | A | M | M | M | A | B | A |
| **Sagitario** | A | B | M | B | A | B | A | M | M | M | A | B |
| **Capricornio** | B | A | B | M | B | A | B | A | M | M | M | A |
| **Acuario** | A | B | A | B | M | M | A | B | A | M | M | B |
| **Piscis** | M | A | B | A | M | M | M | A | B | A | B | M |

Recuento de parejas distintas (78 = 12 mismo signo + 66 de signos distintos): Alta 24, Media 33, Baja 21.

Observaciones sobre los datos (⚠️ revisa si coinciden con tu criterio):
- Mismo signo → siempre **Media** (12 de 12).
- Signos opuestos (Aries-Libra, Tauro-Escorpio, Géminis-Sagitario, Cáncer-Capricornio, Leo-Acuario, Virgo-Piscis) → siempre **Media** (6 de 6).
- Los signos del mismo elemento son siempre **Alta** entre sí cuando son signos distintos (12 parejas).
- La fuente califica por pareja, no solo por elemento: p. ej. Aries-Géminis y Aries-Acuario son Alta (fuego-aire), pero Aries-Cáncer es Baja (fuego-agua).
- La fuente contiene erratas en sus páginas (la de Libra se refiere a Libra como «signo de fuego»; un encabezado de Escorpio dice «Capricornio»). Se ha usado solo el contenido de las listas de parejas, que es coherente entre páginas.

### 4.2 Matriz por elementos (orientativa, solo para textos)

Relación entre elementos de los dos signos; **no determina el nivel**.

| Relación | Combinaciones de elementos |
|---|---|
| Mismo elemento | fuego-fuego, tierra-tierra, aire-aire, agua-agua |
| Complementarios | fuego-aire, tierra-agua |
| En tensión | fuego-agua, tierra-aire |
| Ritmos distintos | fuego-tierra, aire-agua |

### 4.3 Excepciones por pareja concreta

No se aplican: la tabla 4.1 ya es por pareja.

### 4.4 Orden de aplicación (precedencia)

1. **Nivel:** se lee directamente de la tabla 4.1 (A, B).
2. **Tipo de texto** (para la sección 5), en este orden: mismo signo → signos opuestos → relación de elementos de 4.2.

**Propiedades obligatorias** (se convertirán en tests):
- **Simetría:** el resultado para (A, B) es siempre igual que para (B, A).
- **Completitud:** las 144 combinaciones devuelven un nivel válido de la sección 3.
- **Determinismo:** la misma entrada produce siempre la misma salida.
- **Cobertura de fechas:** cualquier fecha válida devuelve exactamente un signo.

## 5. Textos explicativos

Un texto por tipo de combinación, con marcadores `{signoA}`, `{signoB}`, `{elementoA}`, `{elementoB}`. El nivel se muestra aparte, así que los textos son neutros respecto al nivel. (Redacción propia, ⚠️ revisa el tono.)

| Tipo de combinación | Texto |
|---|---|
| Mismo elemento | {signoA} y {signoB} comparten el elemento {elementoA}, así que suelen compartir ritmo, intereses y una forma parecida de vivir las emociones y las decisiones. Esa sintonía facilita el entendimiento, y cada uno puede aportar su propio matiz. |
| Elementos complementarios | {elementoA} y {elementoB} se estimulan y se equilibran entre sí: lo que uno aporta suele alimentar al otro. Entre {signoA} y {signoB} puede haber mucha chispa y complicidad si se cuida la comunicación. |
| Elementos en tensión | {signoA} ({elementoA}) y {signoB} ({elementoB}) tienen maneras bastante distintas de sentir y de actuar. Esa diferencia puede ser enriquecedora si hay curiosidad y paciencia por ambas partes. |
| Ritmos distintos | {elementoA} y {elementoB} no se oponen, pero tampoco avanzan al mismo paso. {signoA} y {signoB} pueden complementarse si respetan los tiempos y las prioridades del otro. |
| Mismo signo | Dos personas de {signoA} se reconocen muy bien: comparten virtudes y también los mismos puntos ciegos. Pueden entenderse sin palabras, aunque a veces les convenga mirar las cosas desde otra perspectiva. |
| Signos opuestos | {signoA} y {signoB} están en lados contrarios del zodiaco y se atraen precisamente por lo que al otro le falta. Pueden aprender mucho entre sí si convierten las diferencias en equilibrio y no en pulso. |

Requisitos de los textos:
- Sin afirmaciones sobre salud, dinero, decisiones vitales ni predicciones concretas.
- Tono respetuoso y orientativo; nunca categórico.
- Longitud máxima: 400 caracteres por texto.

## 6. Aviso de uso

Texto visible junto al resultado y reproducido en el README:

> Esta herramienta se basa en convenciones de la tradición astrológica. No tiene base científica y se ofrece con fines informativos y de entretenimiento. No se guarda ningún dato personal.

## 7. Casos de prueba de referencia

⚠️ Calcúlalos tú a mano con la sección 2 y 4.1 antes de usarlos como tests; aquí están precalculados y verificados con script.

**Signo solar por fecha**

| Fecha de nacimiento | Signo esperado |
|---|---|
| 20/03 (cualquier año válido; 29/02 solo en bisiesto) | Piscis |
| 21/03 (cualquier año válido; 29/02 solo en bisiesto) | Aries |
| 20/04 (cualquier año válido; 29/02 solo en bisiesto) | Aries |
| 21/04 (cualquier año válido; 29/02 solo en bisiesto) | Tauro |
| 21/08 (cualquier año válido; 29/02 solo en bisiesto) | Leo |
| 22/08 (cualquier año válido; 29/02 solo en bisiesto) | Virgo |
| 29/02 (cualquier año válido; 29/02 solo en bisiesto) | Piscis |
| 31/12 (cualquier año válido; 29/02 solo en bisiesto) | Capricornio |
| 01/01 (cualquier año válido; 29/02 solo en bisiesto) | Capricornio |
| 19/01 (cualquier año válido; 29/02 solo en bisiesto) | Capricornio |
| 20/01 (cualquier año válido; 29/02 solo en bisiesto) | Acuario |
| 21/12 (cualquier año válido; 29/02 solo en bisiesto) | Sagitario |
| 22/12 (cualquier año válido; 29/02 solo en bisiesto) | Capricornio |

**Compatibilidad por pareja**

| Signo A | Signo B | Nivel esperado |
|---|---|---|
| Aries | Leo | Alta |
| Aries | Aries | Media |
| Aries | Libra | Media |
| Aries | Cáncer | Baja |
| Tauro | Virgo | Alta |
| Tauro | Leo | Baja |
| Géminis | Libra | Alta |
| Cáncer | Escorpio | Alta |
| Libra | Cáncer | Baja |
| Libra | Escorpio | Media |
| Virgo | Acuario | Media |
| Piscis | Capricornio | Alta |
| Leo | Escorpio | Baja |
| Escorpio | Cáncer | Alta |

**Entradas inválidas (deben rechazarse)**

| Entrada | Motivo |
|---|---|
| 30 de febrero | Fecha inexistente |
| 31 de abril | Fecha inexistente |
| 29 de febrero de un año no bisiesto (p. ej. 2023) | Fecha inexistente |
| Una fecha posterior a hoy | Fuera de rango |
| 31/12/1899 | Anterior al mínimo admitido (1900) |
| (vacío) | Campo obligatorio |
| Texto no fecha (p. ej. «abc») | Formato inválido |

## 8. Lista de comprobación antes de dárselo a la IA

- [x] La tabla de signos cubre todos los días del año, incluido el 29 de febrero, sin huecos ni solapes (verificado con script).
- [x] Todos los niveles usados en las reglas existen en la sección 3.
- [x] La tabla de parejas está completa (144 combinaciones) y es simétrica (verificado con script).
- [x] No hay reglas adicionales ni excepciones que se contradigan.
- [x] Hay un texto para cada tipo de combinación que pueda producirse.
- [x] ⚠️ Los casos de prueba de la sección 7 se han calculado a mano.
- [x] ⚠️ Ivan ha revisado la convención de cúspides, el año mínimo y la coincidencia de la tabla con su criterio astrológico.
- [x] El aviso de uso está redactado.
