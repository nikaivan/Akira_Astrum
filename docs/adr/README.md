# Decisiones de arquitectura (ADR)

Formato breve: contexto, decisión, consecuencias. Estados: Propuesto, Aceptado, Sustituido.
Las desviaciones respecto a `PLAN.md` se registran aquí o en `docs/ai-log.md`, no en el plan.

| ADR | Decisión | Estado |
|---|---|---|
| [0001](0001-monolito-nextjs-supabase.md) | Monolito con Next.js y Supabase | Aceptado |
| [0002](0002-tdd-estricto-roles-humano-ia.md) | TDD estricto y reparto de roles humano-IA | Aceptado |
| [0003](0003-seguridad-en-profundidad-rls-y-servidor.md) | Seguridad en profundidad: servidor y RLS | Aceptado |
| [0004](0004-playwright-escritorio-y-movil.md) | Playwright con proyectos de escritorio y móvil | Aceptado |
| [0005](0005-versiones-fijadas-y-verificacion-de-dependencias.md) | Versiones fijas y verificación de dependencias | Aceptado |
| [0006](0006-publicacion-published-at-y-transiciones-estrictas.md) | `published_at` ligado al estado y transiciones estrictas | Aceptado |
| [0007](0007-dominio-astrologico-fuente-de-verdad-simetria-y-fechas-sin-zona-horaria.md) | Dominio astrológico: fuente de verdad, simetría y fechas sin zona horaria | Aceptado |
| [0008](0008-control-de-acceso-rol-en-profiles-y-storage-no-listable.md) | Control de acceso: rol en `profiles`, `is_admin` privado, privilegios mínimos y Storage no listable | Aceptado |
| [0009](0009-pruebas-de-integracion-proyecto-de-test-y-service-role-acotado.md) | Pruebas de integración contra un proyecto de test aparte, con guarda por ref y `service_role` acotado | Aceptado |
| [0010](0010-autorizacion-en-capas-proxy-requireadmin-y-rls.md) | Autorización en capas (proxy, `requireAdmin` y RLS) que falla cerrado | Aceptado |
| [0011](0011-login-y-sesion-mensaje-unico-limitador-en-memoria-y-cookies.md) | Login y sesión: mensaje único, limitador en memoria, cookies acotadas y e2e sobre el proyecto de test | Aceptado |
| [0012](0012-calculadora-publica-sin-persistencia-server-action-post-y-limite-en-memoria.md) | Calculadora pública sin persistencia: Server Action por POST, validación en servidor y límite en memoria | Aceptado |
| [0013](0013-markdown-publico-sanitizado-react-markdown-y-lista-blanca-explicita.md) | Markdown público sanitizado: react-markdown sin HTML crudo y lista blanca explícita | Aceptado |
| [0014](0014-lectura-publica-sin-cache-cliente-anonimo-y-404-unico.md) | Lectura pública sin caché: cliente anónimo sin cookies, `force-dynamic` y un único 404 | Aceptado |
| [0015](0015-mutaciones-del-panel-esquemas-estrictos-withadminaction-y-compensacion.md) | Mutaciones del panel: esquemas estrictos, `withAdminAction` en cada acción y compensación en lugar de transacción | Aceptado |
| [0016](0016-subida-de-la-portada-validacion-por-contenido-nombre-generado-y-compensacion.md) | Subida de la portada: validación por contenido, nombre generado, compensación, límite de subidas y política del bucket | Aceptado |
| [0017](0017-imagenes-en-el-contenido-accion-de-subida-propia-y-limpieza-acotada-de-huerfanas.md) | Imágenes dentro del contenido: acción de subida propia, limpieza acotada de huérfanas y sus límites | Aceptado |
| [0018](0018-identidad-visual-noche-y-marfil-tokens-por-superficie-y-adornos-propios.md) | Identidad visual «noche y marfil»: tokens por superficie, contraste comprobado por test y adornos propios | Aceptado |
| [0019](0019-csp-con-nonce-por-peticion-excepcion-de-estilos-en-atributos-y-cabeceras-estaticas.md) | CSP con nonce por petición, excepción de estilos en atributos y cabeceras estáticas | Aceptado |
