# Plan: Corregir las vulnerabilidades OWASP Top 10 de la API y de web-empleados

- **Tipo:** bug
- **Fecha:** 2026-10-21
- **Estado:** en curso
- **Tiempo total estimado:** 440 min (52 tareas)

## Estado de las fases

Este plan se ejecuta **por fases**, una por iteración, con la skill `implement-plan` (por ejemplo: «implementa la Fase 2 del plan vulnerabilidades-owasp»). Cada fase va en su propia rama `dev/fix_vulnerabilidades-owasp_fase-<N>` y se entrega con un pull request hacia `develop`. Una persona revisa y mergea el PR (con merge commit); hasta entonces, las fases que dependen de ella no pueden empezar.

Esta tabla y las casillas de las tareas son la fuente de verdad del progreso. Un agente nunca rehace una fase `completada` ni una tarea marcada `- [x]`, y solo empieza una fase cuyas dependencias estén `completada`. La primera tarea de una fase pasa su fila a `en curso`, y la última, a `completada`, en el mismo commit.

| Fase | Título | Tareas | Depende de | Estado |
| ---- | ------ | ------ | ---------- | ------ |
| 1 | Secreto JWT | 1-3 | — | completada |
| 2 | Pedidos | 4-12 | 1 | en curso |
| 3 | Aislamiento multi-tenant en platos e ingredientes | 13-17 | 1 | pendiente |
| 4 | Autenticación | 18-23 | 1 | pendiente |
| 5 | Integridad de datos | 24-28 | 2 | pendiente |
| 6 | Configuración y registro de eventos | 29-31 | 1 | pendiente |
| 7 | Revocación de sesiones | 32-34 | 1, 3 | pendiente |
| 8 | Dependencias | 35-38 | 7 | pendiente |
| 9 | Frontend | 39-49 | 2, 8 | pendiente |
| 10 | Documentación y cierre | 50-52 | 1-9 | pendiente |

Las fases 3, 4 y 6 son independientes entre sí, pero tocan los mismos ficheros (`middlewares.ts`, `app.ts`), así que se recomienda ir en orden numérico.

## 1. Contexto

Una auditoría de solo lectura del Top 10 de OWASP (2021) sobre `packages/api` y `packages/web-empleados` (más la parte de `packages/web-shared` que usa) ha encontrado 27 hallazgos: 17 en la API (`API-H1` a `API-H17`) y 10 en el frontend (`WE-H1` a `WE-H10`).

Los más graves son de control de acceso (A01):

- **Pedidos:** cualquier usuario autenticado, incluido un cliente autorregistrado, puede leer pedidos de cualquier restaurante y cambiar el estado de sus líneas. Las rutas de pedidos solo usan `authenticate`, sin `authorize()` ni comprobación de pertenencia.
- **Platos e ingredientes:** ningún middleware compara el `:restaurantId` de la URL con el `restaurantId` del JWT.
- **Secreto JWT:** el valor por defecto `super-secret-resttek-key` está activo porque `dotenv` nunca se importa. Con él se pueden forjar tokens de admin.
- **Frontend:** el filtrado por rol de web-empleados es solo cosmético. El `restaurantId` sale de un `localStorage` editable y el token se guarda sin comprobar su caducidad.

Además hay un DoS en la creación de pedidos (`quantity` sin límite), falta de rate limiting en el login, ausencia de logging de seguridad y dependencias con CVE.

## 2. Objetivo

Ningún usuario puede leer o modificar datos de un restaurante que no es el suyo, ni forjar tokens, ni tumbar la API con un pedido. Los hallazgos de severidad crítica, alta y media quedan corregidos y cubiertos por tests de vitest en la API. Los de severidad baja quedan corregidos o documentados, y la documentación refleja el nuevo comportamiento.

## 3. Alcance

**Incluye:**

- Los 17 hallazgos de la API y los 10 de web-empleados / web-shared.
- Tests de vitest para todo lo que cambie en la API.
- Actualización de `docs/` y de `CLAUDE.md` si cambia el comportamiento documentado.

**No incluye:**

- Migrar el JWT a cookie `HttpOnly` con protección CSRF (complejidad alta, toca las tres apps y CORS). Solo se documenta como mejora futura.
- Revocación de tokens con refresh tokens rotados. Se resuelve con `tokenVersion` (tarea 32 y siguientes).
- Flujo de verificación por email en el registro. Para `API-H7` se hace solo el hash ficticio en el login y el rate limit en el registro.
- Desplegar la CSP en un servidor real: no hay config de producción en el repo, así que solo se documenta y se prueba la compatibilidad (`WE-H7`).
- Cambios en `web-admin` y `web-clientes`, salvo comprobar que no se rompen con el cambio en `AuthStore` de `web-shared`.

## 4. Análisis del código actual

Los números de línea proceden de la auditoría y deben verificarse al empezar cada tarea.

| Capa | Archivo | Qué hay que hacer |
| ---- | ------- | ----------------- |
| config | `packages/api/src/config/env.ts` (nuevo) | `import 'dotenv/config'`, secreto único con validación al arrancar (`API-H3`) |
| middlewares | `packages/api/src/contexts/shared/infrastructure/http/middlewares.ts` | Usar el secreto único, `algorithms: ['HS256']`, comprobar `tokenVersion`, añadir `requireSameRestaurant` (`API-H3/H11/H8/H2`) |
| employee / infra | `packages/api/src/contexts/employee/infrastructure/BcryptAuthService.ts` | Secreto único, `SALT_ROUNDS = 12`, `tokenVersion` en el payload |
| employee / application | `RegisterClientUseCase.ts`, `CreateEmployeeUseCase.ts`, `LoginUseCase.ts` | Value object `Password`, hash ficticio en el login (`API-H6/H7`) |
| shared / domain | `contexts/shared/domain/value-objects/Email.ts` | Normalizar a minúsculas (`API-H17`) |
| routes | `src/routes/order.routes.ts`, `dish.routes.ts`, `ingredient.routes.ts`, `contexts/employee/infrastructure/http/auth.routes.ts` | `authorize()` por rol, `requireSameRestaurant`, rate limiting |
| controllers | `src/controllers/order.controller.ts`, `dish.controller.ts`, `ingredient.controller.ts` | Pasar `req.user` a los servicios; `next(error)` en pedidos (`API-H15`) |
| services | `src/services/order.service.ts`, `dish.service.ts`, `ingredient.service.ts` | Pertenencia, transiciones por rol, validación de `items`/`quantity`/tipos, platos válidos (`API-H1/H4/H9/H10`) |
| repositories | `src/repositories/order.repository.ts`, `dish.repository.ts`, `ingredient.repository.ts` | `WHERE id = ? AND restaurant_id = ?`, transacciones (`API-H2/H12`) |
| config | `src/config/database.ts` | Helper `transaction()`, migraciones de `tokenVersion` y de `UNIQUE COLLATE NOCASE` |
| app | `src/app.ts`, `contexts/shared/.../errorHandler.ts` | CORS con lista blanca, `helmet`, logging con `pino` (`API-H14/H16`) |
| web-shared | `src/lib/auth/{auth.store,auth.service,auth.guard}.ts`, `src/lib/http/{auth.interceptor,error.interceptor}.ts`, `src/index.ts` | Decodificar el JWT (`exp`, rol, `restaurantId`), `sessionStorage`, `roleGuard`, `API_URL` en el interceptor, error 403 |
| web-empleados | `app.routes.ts`, `features/orders/{services,store,pages}`, `angular.json`, `index.html` | Guards por rol, no enviar `restaurantId`, `reset()` en logout, mensajes genéricos, `encodeURIComponent`, `fileReplacements`, CSP |
| dependencias | `package.json` raíz y de cada paquete | `npm audit fix`, `sqlite3@6`, `@angular/*` ≥ 21.2.25 |
| docs | `docs/arquitectura/*`, `docs/revisiones/*`, `CLAUDE.md` | Reflejar auth, multi-tenant y seguridad |

## 5. Diseño de la solución

### 5.1 Decisiones técnicas

- **Secreto JWT:**
  - `src/config/env.ts` es el único lugar que lee `JWT_SECRET`.
  - Fuera de `NODE_ENV=test` y `development`, la API no arranca si falta o tiene menos de 32 caracteres.
  - En `test` y `development` se usa un valor fijo de desarrollo.
- **Contexto de usuario:** el middleware `authenticate` deja en `req.user` los campos `id`, `role`, `restaurantId` y `tokenVersion`. Los servicios de pedidos reciben ese usuario y deciden:
  - El admin accede a todo.
  - El personal (manager, camarero, cocinero) solo a su `restaurantId`.
  - El cliente solo a sus propios pedidos (`order.clientId === user.id`).
- **Matriz de transiciones por rol** (propuesta, a confirmar en la tarea 6):
  - `cocinero`: `pendiente → preparando → listo`.
  - `camarero`: `listo → entregado`.
  - `manager` y `admin`: cualquiera.
  - Si los estados reales del modelo difieren, se adapta la matriz a los de `order.model.ts`.
- **`GET /orders/active`:** el `restaurantId` se toma del token. Si el cliente envía uno distinto, la API responde 403, salvo para el admin. El parámetro de la query pasa a ser opcional.
- **Multi-tenant en platos e ingredientes:** el middleware `requireSameRestaurant` compara `req.params.restaurantId` con `req.user.restaurantId` (admin exento). Los repositorios filtran además por `restaurant_id`, y un recurso de otro restaurante responde 404.
- **Transacciones:** `sqlite3` usa una sola conexión, así que otra petición podría intercalar sentencias dentro de una transacción abierta. El helper `transaction()` serializa las transacciones con una cola (mutex) dentro de `Database`.
- **Revocación:** columna `token_version INTEGER NOT NULL DEFAULT 0` en `employees`. `authenticate` la compara con la del token (una consulta indexada por petición) y se incrementa al cambiar el rol o el restaurante de un empleado o al borrarlo. El `JWT` pasa a incluir `tokenVersion`.
- **Frontend:**
  - `AuthStore` decodifica el payload del JWT (sin verificar la firma, que es cosa de la API) para obtener `exp`, `role` y `restaurantId`. El perfil de `localStorage` deja de usarse para autorizar.
  - El token pasa a `sessionStorage`.
  - `roleGuard(roles)` lee `data.roles` de la ruta.
  - El frontend es solo experiencia de usuario. La seguridad real está en la API.
- **Mensajes de error:** en español y genéricos (`Datos no válidos`, `No autorizado`, `Recurso no encontrado`). Los detalles internos solo se registran en el log.

### 5.2 Alternativas descartadas

- Cookie `HttpOnly`: es lo ideal contra el robo del token, pero queda fuera de alcance (ver Alcance).
- Refresh tokens rotados: más complejo que `tokenVersion` para este tamaño de proyecto.
- `zod` o `valibot` en toda la API: se prefiere validación local por servicio (`typeof`, `Number.isFinite`), que encaja con el estilo por capas actual. Se reevaluará si crece.

### 5.3 Asignación de modelo por tarea

| Modelo | Criterio | Tareas |
| ------ | -------- | ------ |
| **haiku** | Cambio mecánico o de configuración, de 1 a 3 líneas, sin lógica de negocio ni decisiones de seguridad | 2, 10, 14, 22, 29, 35, 38, 40, 44, 45, 46, 48, 51 |
| **sonnet** | Cambio acotado en una o dos capas, con lógica y tests, y con un patrón ya definido | 1, 3, 4, 5, 9, 11, 12, 13, 15, 16, 17, 18, 19, 20, 21, 23, 24, 25, 26, 30, 31, 36, 37, 39, 42, 43, 47, 49, 50, 52 |
| **opus** | Diseño transversal o crítico para la seguridad: modelo de permisos, concurrencia sobre la BD, esquema de sesión y revocación | 6, 7, 8, 27, 28, 32, 33, 34, 41 |

El resto de tareas indica su modelo en su línea. Criterios aplicados:

- Se reserva `opus` para lo que, si se hace mal, deja un hueco de seguridad que los tests no detectan fácilmente (autorización, aislamiento entre restaurantes, sesiones) o lo que tiene riesgo de concurrencia (transacciones sobre una conexión compartida).
- La corrección de las dependencias (`sqlite3@6`, Angular) es `sonnet` y no `haiku`, porque puede obligar a adaptar código si hay cambios incompatibles.

## 6. Lista de tareas

Cada tarea dura entre 5 y 10 minutos y tiene un resultado comprobable. Los comandos de test se lanzan con `cd packages/api && npx vitest run <fichero>`.

### Fase 1 — Secreto JWT (`API-H3`, `API-H11`)

- [x] **1. Crear el módulo de entorno** (10 min) — modelo: sonnet
  - Archivo(s): `packages/api/src/config/env.ts` (nuevo), `packages/api/tsconfig.json` (alias `@config` ya existe)
  - Qué hacer: importar `dotenv/config`, exportar `JWT_SECRET`. Si `NODE_ENV` no es `test` ni `development` y el secreto falta o tiene menos de 32 caracteres, lanzar un `Error` en español al cargar. En `test` y `development` usar un valor fijo de desarrollo.
  - Hecho cuando: `NODE_ENV=production npx tsx -e "import('./src/config/env.ts')"` falla con el mensaje, y con un secreto válido no.
- [x] **2. Usar el secreto único y endurecer JWT** (5 min) — modelo: haiku
  - Archivo(s): `contexts/shared/infrastructure/http/middlewares.ts`, `contexts/employee/infrastructure/BcryptAuthService.ts`
  - Qué hacer: sustituir `process.env.JWT_SECRET || '...'` por el import de `@config/env.js`. Añadir `{ algorithms: ['HS256'] }` en `jwt.verify` y `{ algorithm: 'HS256' }` en `sign`. Subir `SALT_ROUNDS` a 12.
  - Hecho cuando: `grep -rn "super-secret-resttek-key" packages/api/src` solo aparece en `config/env.ts`.
- [x] **3. Test del módulo de entorno** (8 min) — modelo: sonnet
  - Archivo(s): `packages/api/src/config/env.test.ts` (nuevo), `packages/api/vitest.config.ts`
  - Qué hacer: tests con `vi.resetModules()` que comprueban el fallo en producción sin secreto o con secreto corto y el éxito con uno válido. Fijar `NODE_ENV=test` en la config de vitest si no estuviera.
  - Hecho cuando: `npm test` pasa en verde.

### Fase 2 — Pedidos (`API-H4`, `API-H1`, `API-H15`)

- [x] **4. Validar `items` y `quantity`** (8 min) — modelo: sonnet
  - Archivo(s): `packages/api/src/services/order.service.ts`
  - Qué hacer: exigir que `items` sea un array de 1 a 30 elementos, que `quantity` cumpla `Number.isInteger` y esté entre 1 y 50, y que `dishId` sea un string no vacío. Lanzar el error de validación existente con mensajes en español.
  - Hecho cuando: crear un pedido con `quantity` 100000000, `"5"` o 0 devuelve 400 sin bloquear el proceso.
- [x] **5. Tests de la validación de pedidos** (7 min) — modelo: sonnet
  - Archivo(s): `packages/api/src/services/order.service.test.ts`
  - Qué hacer: casos para `items` vacío, `quantity` fuera de rango, string o decimal, demasiadas líneas y un pedido válido.
  - Hecho cuando: `npx vitest run src/services/order.service.test.ts` pasa.
- [x] **6. Diseñar el contexto de usuario y la matriz de permisos de pedidos** (10 min) — modelo: opus
  - Archivo(s): `contexts/shared/infrastructure/http/middlewares.ts`, `src/models/order.model.ts`
  - Qué hacer: tipar `AuthUser` (`id`, `role`, `restaurantId`) y definir en el modelo la matriz `rol → transiciones permitidas` según los estados reales de `order.model.ts`. Confirmar que `req.user` ya contiene `restaurantId`.
  - Hecho cuando: existe el tipo y la matriz exportados, y `tsc --noEmit` compila.
- [x] **7. Control de pertenencia en `OrderService`** (10 min) — modelo: opus
  - Archivo(s): `packages/api/src/services/order.service.ts`
  - Qué hacer: los métodos de lectura, creación y cambio de estado reciben `AuthUser`. El admin ve todo, el personal solo su `restaurantId` y el cliente solo sus pedidos. En `create`, el personal solo puede crear en su restaurante. Lanzar un error de dominio mapeado a 403 (o 404 para no revelar la existencia del pedido).
  - Hecho cuando: un usuario de otro restaurante no puede obtener ni modificar un pedido (cubierto en la tarea 11).
- [x] **8. Transiciones de estado por rol** (10 min) — modelo: opus
  - Archivo(s): `packages/api/src/services/order.service.ts`
  - Qué hacer: en `updateItemStatus`, validar la transición pedida contra la matriz de la tarea 6 y el rol del usuario. Rechazar con 403 las no permitidas y con 400 las no válidas.
  - Hecho cuando: un cocinero no puede marcar `entregado` y un camarero no puede marcar `preparando`.
- [ ] **9. Controlador de pedidos: usuario, errores y `restaurantId` del token** (10 min) — modelo: sonnet
  - Archivo(s): `packages/api/src/controllers/order.controller.ts`, `contexts/shared/.../errorHandler.ts`
  - Qué hacer: pasar `req.user` al servicio. En `/active` usar el `restaurantId` del token y responder 403 si la query trae otro distinto (salvo admin). Sustituir `res.status(...).json({ error: error.message })` por `next(error)` y añadir `OrderNotFoundError` a `NOT_FOUND_ERRORS` (`API-H15`).
  - Hecho cuando: un error de SQLite o un `TypeError` en pedidos responde 500 genérico, y un pedido inexistente, 404.
- [ ] **10. Roles en las rutas de pedidos** (5 min) — modelo: haiku
  - Archivo(s): `packages/api/src/routes/order.routes.ts`
  - Qué hacer: `authorize(['admin','manager','camarero','cocinero'])` en `GET /active` y en `PATCH /:orderId/items/:itemId/status`. Dejar `POST /` y `GET /:id` autenticados, con la pertenencia resuelta en el servicio.
  - Hecho cuando: un token de `cliente` recibe 403 en `/orders/active`.
- [ ] **11. Tests de autorización de pedidos** (10 min) — modelo: sonnet
  - Archivo(s): `packages/api/src/services/order.service.test.ts`, mocks en `repositories/mocks`
  - Qué hacer: casos de admin, personal de otro restaurante, cliente dueño y cliente ajeno para lectura, creación y cambio de estado.
  - Hecho cuando: los tests pasan y fallan si se quita la comprobación de pertenencia.
- [ ] **12. Tests de transiciones por rol** (8 min) — modelo: sonnet
  - Archivo(s): `packages/api/src/services/order.service.test.ts`
  - Qué hacer: tabla de casos `rol × transición` con el resultado esperado (permitida, 403 o 400).
  - Hecho cuando: pasan todos los casos de la matriz.

### Fase 3 — Aislamiento multi-tenant en platos e ingredientes (`API-H2`)

- [ ] **13. Middleware `requireSameRestaurant`** (10 min) — modelo: sonnet
  - Archivo(s): `contexts/shared/infrastructure/http/middlewares.ts` (más su test)
  - Qué hacer: deja pasar al admin y, para el resto, exige `req.params.restaurantId === req.user.restaurantId`; si no, 403 con mensaje en español.
  - Hecho cuando: tests del middleware con admin, mismo restaurante, otro restaurante y usuario sin restaurante.
- [ ] **14. Aplicar el middleware a las rutas anidadas** (5 min) — modelo: haiku
  - Archivo(s): `packages/api/src/routes/dish.routes.ts`, `packages/api/src/routes/ingredient.routes.ts`
  - Qué hacer: añadir `requireSameRestaurant` tras `authenticate` en todas las rutas bajo `/restaurants/:restaurantId/...`.
  - Hecho cuando: `gerente1` recibe 403 en `GET /restaurants/rest-2/ingredients`.
- [ ] **15. Filtrar platos por restaurante en repositorio y servicio** (10 min) — modelo: sonnet
  - Archivo(s): `packages/api/src/repositories/dish.repository.ts`, `packages/api/src/services/dish.service.ts`, `repositories/mocks`
  - Qué hacer: `findById`, `update` y `delete` reciben `restaurantId` y usan `WHERE id = ? AND restaurant_id = ?`. Un plato de otro restaurante responde 404. Actualizar mocks y controlador.
  - Hecho cuando: `DELETE /restaurants/rest-1/dishes/<id de rest-2>` devuelve 404 y el plato sigue existiendo.
- [ ] **16. Filtrar ingredientes por restaurante** (10 min) — modelo: sonnet
  - Archivo(s): `packages/api/src/repositories/ingredient.repository.ts`, `packages/api/src/services/ingredient.service.ts`, `repositories/mocks`
  - Qué hacer: mismo patrón que la tarea 15 para las operaciones por id de ingredientes.
  - Hecho cuando: un ingrediente de otro restaurante no se puede leer ni modificar por id.
- [ ] **17. Tests de aislamiento entre restaurantes** (10 min) — modelo: sonnet
  - Archivo(s): `repositories/dish.repository.test.ts`, `repositories/ingredient.repository.test.ts`, tests de servicios
  - Qué hacer: con SQLite en memoria, insertar primero los restaurantes padre y comprobar que las consultas por id con otro `restaurantId` no devuelven ni modifican nada.
  - Hecho cuando: los tests pasan.

### Fase 4 — Autenticación (`API-H5`, `API-H6`, `API-H7`, `API-H17`)

- [ ] **18. Rate limiting en login y registro** (8 min) — modelo: sonnet
  - Archivo(s): `packages/api/package.json`, `contexts/employee/infrastructure/http/auth.routes.ts`
  - Qué hacer: instalar `express-rate-limit`. Login: 5 intentos cada 15 minutos por IP; registro: 10 por hora. Mensaje en español y cabeceras estándar. Desactivable en `NODE_ENV=test`.
  - Hecho cuando: el sexto login fallido seguido devuelve 429.
- [ ] **19. Value object `Password`** (8 min) — modelo: sonnet
  - Archivo(s): `contexts/employee/domain/value-objects/Password.ts` (nuevo, junto a `Role`) y su test
  - Qué hacer: validar que sea string y que su longitud en bytes esté entre 10 y 72, con errores de dominio en español.
  - Hecho cuando: tests con vacío, `undefined`, 9 caracteres, 73 bytes y válida.
- [ ] **20. Usar `Password` en los casos de uso** (10 min) — modelo: sonnet
  - Archivo(s): `RegisterClientUseCase.ts`, `CreateEmployeeUseCase.ts` y sus tests
  - Qué hacer: validar la contraseña antes de hashear. Un `password` ausente debe dar 400, no 500.
  - Hecho cuando: registrar con `password: ""` devuelve 400.
- [ ] **21. Login sin diferencia de tiempos** (8 min) — modelo: sonnet
  - Archivo(s): `contexts/employee/application/LoginUseCase.ts` y su test
  - Qué hacer: si el email no existe, ejecutar igualmente `compare` contra un hash ficticio precalculado y devolver el mismo error genérico.
  - Hecho cuando: el test confirma que se llama a `compare` en ambos caminos.
- [ ] **22. Normalizar el email** (5 min) — modelo: haiku
  - Archivo(s): `contexts/shared/domain/value-objects/Email.ts`
  - Qué hacer: aplicar `trim().toLowerCase()` antes de validar y guardar.
  - Hecho cuando: `Email.create('Admin@Resttek.com').value` devuelve `admin@resttek.com`.
- [ ] **23. Migración `UNIQUE COLLATE NOCASE` en emails** (10 min) — modelo: sonnet
  - Archivo(s): `packages/api/src/config/database.ts` (migraciones iniciales)
  - Qué hacer: índice único `COLLATE NOCASE` sobre `employees.email` y paso previo que pase a minúsculas los emails existentes (`UPDATE employees SET email = lower(email)`). Comprobar que no hay duplicados antes de crear el índice.
  - Hecho cuando: `npm run seed` sigue funcionando y registrar `ADMIN@resttek.com` devuelve 409.

### Fase 5 — Integridad de datos (`API-H9`, `API-H10`, `API-H12`)

- [ ] **24. Validar los platos de un pedido** (10 min) — modelo: sonnet
  - Archivo(s): `packages/api/src/services/order.service.ts`, `repositories/dish.repository.ts`, mocks
  - Qué hacer: cargar los platos pedidos con `restaurant_id = ?` y `available = 1`. Rechazar con 400 si falta alguno.
  - Hecho cuando: un pedido con un plato de otro restaurante o no disponible devuelve 400 y no crea nada.
- [ ] **25. Validación de tipos en platos** (8 min) — modelo: sonnet
  - Archivo(s): `packages/api/src/services/dish.service.ts`, `src/models/dish.model.ts`
  - Qué hacer: `typeof === 'number' && Number.isFinite` para `price`; `typeof === 'string'` para `name`; `typeof === 'boolean'` para `available`. Errores 400 en español.
  - Hecho cuando: `price: "abc"` y `name: 123` devuelven 400, no 201 ni 500.
- [ ] **26. Validación de tipos en ingredientes** (8 min) — modelo: sonnet
  - Archivo(s): `packages/api/src/services/ingredient.service.ts`
  - Qué hacer: mismo criterio para `currentStock` y cantidades.
  - Hecho cuando: valores no numéricos o `NaN` devuelven 400, con test.
- [ ] **27. Helper `transaction()` en `Database`** (10 min) — modelo: opus
  - Archivo(s): `packages/api/src/config/database.ts` y su test
  - Qué hacer: `transaction(fn)` con `BEGIN`/`COMMIT`/`ROLLBACK` y una cola que serialice las transacciones concurrentes sobre la conexión única. Los accesos fuera de transacción no deben quedar bloqueados indefinidamente.
  - Hecho cuando: test con dos transacciones concurrentes y un fallo a mitad que deja la BD intacta.
- [ ] **28. Usar `transaction()` en pedidos y platos** (10 min) — modelo: opus
  - Archivo(s): `packages/api/src/repositories/order.repository.ts`, `packages/api/src/repositories/dish.repository.ts`
  - Qué hacer: envolver la creación del pedido con sus líneas y el borrado y reinserción de `dish_ingredients` en una transacción.
  - Hecho cuando: un fallo de FK en la segunda línea no deja el pedido guardado, con test.

### Fase 6 — Configuración y registro de eventos (`API-H14`, `API-H16`)

- [ ] **29. CORS con lista blanca, `helmet` y sin `X-Powered-By`** (5 min) — modelo: haiku
  - Archivo(s): `packages/api/src/app.ts`, `packages/api/package.json`, `config/env.ts`
  - Qué hacer: leer `CORS_ORIGINS` (lista separada por comas, por defecto `http://localhost:4200,4201,4202`). Añadir `helmet()` y `app.disable('x-powered-by')`.
  - Hecho cuando: la respuesta no lleva `X-Powered-By` y un `Origin` no permitido no recibe `Access-Control-Allow-Origin`.
- [ ] **30. Logger `pino` y registro de errores 500** (10 min) — modelo: sonnet
  - Archivo(s): `packages/api/src/config/logger.ts` (nuevo), `contexts/shared/.../errorHandler.ts`
  - Qué hacer: logger estructurado que en `test` queda en silencio. El `errorHandler` registra los errores inesperados antes de responder 500. Nunca registrar contraseñas ni tokens.
  - Hecho cuando: un error forzado deja una línea de log con el stack y la respuesta sigue siendo genérica.
- [ ] **31. Eventos de auditoría** (10 min) — modelo: sonnet
  - Archivo(s): `LoginUseCase.ts` (o su controlador), `middlewares.ts`, `CreateEmployeeUseCase.ts`
  - Qué hacer: registrar login correcto y fallido (sin la contraseña), 401 y 403 con ruta y usuario, y creación de empleados.
  - Hecho cuando: un login fallido y un 403 generan líneas con `event` y `userId`/`email` pero sin datos secretos.

### Fase 7 — Revocación de sesiones (`API-H8`)

- [ ] **32. Columna `token_version` y modelo** (10 min) — modelo: opus
  - Archivo(s): `packages/api/src/config/database.ts`, `contexts/employee/domain/Employee.ts`, `SqliteEmployeeRepository.ts`, `IEmployeeRepository.ts`
  - Qué hacer: migración idempotente (`ALTER TABLE ... ADD COLUMN`, que debe tolerar BD ya migradas), propiedad `tokenVersion` en la entidad y método de repositorio `getTokenVersion(id)` / `bumpTokenVersion(id)`.
  - Hecho cuando: el servidor arranca con una BD existente y con una nueva.
- [ ] **33. Incluir y comprobar `tokenVersion` en el JWT** (10 min) — modelo: opus
  - Archivo(s): `BcryptAuthService.ts`, `middlewares.ts`
  - Qué hacer: firmar `tokenVersion` en el payload; `authenticate` consulta la versión actual y responde 401 si no coincide o si el empleado ya no existe. Los clientes también están en `employees`, así que aplica a todos.
  - Hecho cuando: tras subir `token_version` a mano, el token antiguo devuelve 401.
- [ ] **34. Invalidar tokens al cambiar o borrar empleados, y tests** (10 min) — modelo: opus
  - Archivo(s): casos de uso o servicios que modifiquen rol, restaurante o borrado de empleados (verificar cuáles existen), y sus tests
  - Qué hacer: llamar a `bumpTokenVersion` en esos puntos. Si hoy no existe ninguno, dejar el helper listo y un test de `authenticate`, y anotarlo en la sección 9.
  - Hecho cuando: los tests de `authenticate` con versión coincidente y no coincidente pasan.

### Fase 8 — Dependencias (`API-H13`, `WE-H6`)

- [ ] **35. `npm audit fix` compatible** (5 min) — modelo: haiku
  - Archivo(s): `package.json` y `package-lock.json` de la raíz
  - Qué hacer: ejecutar `npm audit fix` (sin `--force`) y guardar el resultado de `npm audit --omit=dev` antes y después.
  - Hecho cuando: `npm test` sigue en verde y bajan las vulnerabilidades de producción.
- [ ] **36. Subir `sqlite3` a 6.x** (10 min) — modelo: sonnet
  - Archivo(s): `packages/api/package.json`, `src/config/database.ts` si hace falta
  - Qué hacer: actualizar, reinstalar, ejecutar `npm run seed` y `npm test`. Si hay cambios incompatibles que obligan a más de 10 minutos, revertir y anotarlo como pendiente.
  - Hecho cuando: seed y tests pasan, o queda documentado por qué se pospone.
- [ ] **37. Subir `@angular/*` a ≥ 21.2.25** (10 min) — modelo: sonnet
  - Archivo(s): `packages/web-empleados/package.json`, `web-admin`, `web-clientes`, `web-shared` y el lock
  - Qué hacer: alinear todas las versiones de `@angular/*` y de `@angular/build`/`cli` a la última 21.x.
  - Hecho cuando: `npm ls @angular/core` muestra una única versión ≥ 21.2.25.
- [ ] **38. Compilar las tres apps** (8 min) — modelo: haiku
  - Archivo(s): ninguno (verificación)
  - Qué hacer: `ng build` en `web-empleados`, `web-admin` y `web-clientes`.
  - Hecho cuando: los tres builds terminan sin errores.

### Fase 9 — Frontend (`WE-H1` … `WE-H10`)

- [ ] **39. `roleGuard` en web-shared** (10 min) — modelo: sonnet
  - Archivo(s): `packages/web-shared/src/lib/auth/role.guard.ts` (nuevo), `src/index.ts`
  - Qué hacer: guard funcional que lee `route.data['roles']` y el rol del `AuthStore`. Si no coincide, redirige a la ruta por defecto del rol. Exportarlo desde `index.ts`.
  - Hecho cuando: compila y se importa desde `@resttek/web-shared`.
- [ ] **40. Aplicar el guard en web-empleados** (5 min) — modelo: haiku
  - Archivo(s): `packages/web-empleados/src/app/app.routes.ts`
  - Qué hacer: `data.roles` en `cocina` (cocinero, manager, admin), `barra` y `salon` (camarero, manager, admin). Que la ruta `''` redirija con `defaultRoute()` en lugar de a `cocina` fijo.
  - Hecho cuando: un camarero que escribe `/cocina` en la URL es redirigido.
- [ ] **41. `AuthStore`: claims del JWT, caducidad y `sessionStorage`** (10 min) — modelo: opus
  - Archivo(s): `packages/web-shared/src/lib/auth/auth.store.ts`, `auth.service.ts`
  - Qué hacer: decodificar el payload con `atob` tolerante a errores. `isAuthenticated` comprueba `exp`. `role` y `restaurantId` salen de los claims. Guardar el token en `sessionStorage`. Si el token está caducado o corrupto, limpiar la sesión. Revisar que `web-admin` y `web-clientes` usan solo la API pública del store.
  - Hecho cuando: un token caducado en el almacenamiento hace que el guard redirija al login, y un `auth_user` corrupto no rompe el arranque.
- [ ] **42. Guard y logout coherentes con la nueva sesión** (8 min) — modelo: sonnet
  - Archivo(s): `auth.guard.ts`, `auth.service.ts`, `error.interceptor.ts`
  - Qué hacer: el guard usa la comprobación de `exp`. Un 401 de la API cierra sesión y redirige. Migrar sesiones antiguas de `localStorage` (borrar `auth_token` y `auth_user` heredados).
  - Hecho cuando: un 401 devuelto por la API lleva al login y no quedan restos en `localStorage`.
- [ ] **43. Dejar de enviar `restaurantId` desde el perfil local** (10 min) — modelo: sonnet
  - Archivo(s): `features/orders/pages/{cocina,barra,salon}/*.component.ts`, `features/orders/services/order.service.ts`
  - Qué hacer: leer `restaurantId` del store (claims) y, dado que la API ya lo toma del token (tarea 9), no enviarlo en la query. Mantener el mensaje «Sin restaurante asignado». Depende de las tareas 9 y 41.
  - Hecho cuando: las tres pantallas cargan pedidos sin `?restaurantId=` y editar `localStorage` no cambia el resultado.
- [ ] **44. `OrderStore.reset()` al cerrar sesión** (5 min) — modelo: haiku
  - Archivo(s): `features/orders/store/order.store.ts`, `core/layout/shell.component.ts`
  - Qué hacer: método `reset()` y llamarlo antes de `logout()`.
  - Hecho cuando: tras cerrar sesión y entrar con otro usuario no se ven pedidos del anterior.
- [ ] **45. Bearer solo hacia `API_URL`** (5 min) — modelo: haiku
  - Archivo(s): `packages/web-shared/src/lib/http/auth.interceptor.ts`
  - Qué hacer: inyectar `API_URL` y no añadir la cabecera si `!req.url.startsWith(apiUrl)`.
  - Hecho cuando: una petición a una URL absoluta externa sale sin `Authorization`.
- [ ] **46. `fileReplacements` de producción** (5 min) — modelo: haiku
  - Archivo(s): `packages/web-empleados/angular.json`, `features/orders/services/order.service.ts`
  - Qué hacer: añadir `fileReplacements` a la configuración `production`. Usar el token `API_URL` en `order.service.ts` en lugar de importar `environment`.
  - Hecho cuando: `ng build --configuration production` usa `environment.production.ts`.
- [ ] **47. Errores genéricos en español y manejo del 403** (8 min) — modelo: sonnet
  - Archivo(s): `packages/web-shared/src/lib/http/error.interceptor.ts`, `features/orders/store/order.store.ts`, `*.component.html`
  - Qué hacer: función que mapee el código de estado a un mensaje genérico (403: «No tienes permiso para esta acción»). El store deja de mostrar `err.message`.
  - Hecho cuando: un 500 muestra «Ha ocurrido un error, inténtalo de nuevo» sin URL ni parámetros.
- [ ] **48. `encodeURIComponent` en las URLs de pedidos** (5 min) — modelo: haiku
  - Archivo(s): `packages/web-empleados/src/app/features/orders/services/order.service.ts`
  - Qué hacer: codificar `orderId` e `itemId` en la ruta del PATCH.
  - Hecho cuando: un id con `/` o `..` se envía codificado.
- [ ] **49. Documentar y probar la CSP** (10 min) — modelo: sonnet
  - Archivo(s): `docs/arquitectura/arquitectura-frontend.md` (sección de seguridad)
  - Qué hacer: documentar la política propuesta (`default-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'`, más `X-Content-Type-Options` y `Referrer-Policy`). Probarla en local con un servidor estático delante del build de producción y anotar si hace falta relajar `style-src` por los estilos de componentes.
  - Hecho cuando: el doc recoge la política probada y el resultado de la prueba.

### Fase 10 — Documentación y cierre

- [ ] **50. Documentar auth y multi-tenant en la API** (10 min) — modelo: sonnet
  - Archivo(s): `docs/arquitectura/arquitectura-api.md`, `docs/dominio/modelo-datos.md`
  - Qué hacer: secreto y entorno (`JWT_SECRET`, `CORS_ORIGINS`), roles por ruta de pedidos, matriz de transiciones, `requireSameRestaurant`, `token_version`, rate limiting y logging.
  - Hecho cuando: los docs describen el comportamiento real tras los cambios.
- [ ] **51. Actualizar revisiones, frontend y `CLAUDE.md`** (10 min) — modelo: haiku
  - Archivo(s): `docs/arquitectura/arquitectura-frontend.md`, `docs/revisiones/inconsistencias-backend.md`, `docs/revisiones/inconsistencias-frontend.md`, `CLAUDE.md`
  - Qué hacer: corregir donde se describe el filtrado por rol como protección, anotar la mejora futura (cookie `HttpOnly`) y las limitaciones pendientes, y añadir a `CLAUDE.md` el módulo `config/env.ts` y la regla de autorización por pertenencia.
  - Hecho cuando: no hay afirmaciones contradictorias con el código.
- [ ] **52. Verificación final** (10 min) — modelo: sonnet
  - Archivo(s): ninguno
  - Qué hacer: `npm test`, `ng build` de las tres apps y la tabla de la sección 7 con `npm run seed`, `npm run dev:api` y `curl`.
  - Hecho cuando: todo en verde y la tabla da los resultados esperados.

## 7. Verificación manual

Con la API en `:3000` tras `npm run seed`. Obtener los tokens con `POST /api/v1/auth/login` (la contraseña del seed es el email, y para el seed hay que usarla con la política nueva, así que puede requerir regenerar el seed; ver sección 9).

| Petición | Resultado esperado |
| -------- | ------------------ |
| `curl -i -H "Authorization: Bearer <token forjado con super-secret-resttek-key>" localhost:3000/api/v1/orders/active` | 401 |
| `NODE_ENV=production` sin `JWT_SECRET` y `npm run dev:api` | La API no arranca y explica por qué |
| `GET /orders/active` con token de `cliente` | 403 |
| `GET /orders/active?restaurantId=rest-2` con token de camarero de rest-1 | 403 |
| `PATCH /orders/:id/items/:itemId/status {"status":"entregado"}` con token de cocinero | 403 |
| `POST /orders` con `quantity: 100000000` | 400, la API sigue respondiendo en `/health` |
| `POST /restaurants/rest-2/dishes` con token de `manager` de rest-1 | 403 |
| `DELETE /restaurants/rest-1/dishes/<id de rest-2>` con token de manager de rest-1 | 404 y el plato sigue existiendo |
| Seis `POST /auth/login` fallidos seguidos | El sexto devuelve 429 |
| `POST /auth/register` con `password: ""` | 400 |
| Registrar `ADMIN@resttek.com` cuando existe `admin@resttek.com` | 409 |
| Subir `token_version` de un empleado y repetir una petición con su token antiguo | 401 |
| `curl -i localhost:3000/health` | Sin cabecera `X-Powered-By` |
| En web-empleados, un camarero abre `/cocina` | Redirigido a su ruta por defecto |
| En web-empleados, editar `auth_user.restaurantId` en DevTools y recargar | No cambia los pedidos visibles |
| En web-empleados, token caducado en `sessionStorage` y navegar | Redirige al login |
| `npm audit --omit=dev` | Sin vulnerabilidades críticas |

## 8. Documentación a actualizar

- [ ] `docs/arquitectura/arquitectura-api.md` (tarea 50)
- [ ] `docs/dominio/modelo-datos.md` (columna `token_version`, índice único del email; tarea 50)
- [ ] `docs/arquitectura/arquitectura-frontend.md` (sesión, guards, CSP; tareas 49 y 51)
- [ ] `docs/revisiones/inconsistencias-backend.md` e `inconsistencias-frontend.md` (tarea 51)
- [ ] `CLAUDE.md` (tarea 51)

## 9. Riesgos y dudas abiertas

- **Contraseñas del seed:** el seed usa el propio email como contraseña (`admin@resttek.com`, 16 caracteres, pasa el mínimo de 10), pero hay que comprobar que todos los emails del seed la superan. El seed inserta con `INSERT OR IGNORE` y puede saltarse el value object, así que no debería romperse. Verificarlo en la tarea 20.
- **Estados de pedido:** la matriz de transiciones se ha propuesto sin leer `order.model.ts` con detalle. La tarea 6 la ajusta a los estados reales.
- **Cambio de contrato de `/orders/active`:** pasa a tomar el `restaurantId` del token. Si `web-clientes` u otro consumidor lo usa con la query, hay que revisarlo (la auditoría no cubrió `web-clientes`).
- **Endpoints de edición de empleados:** puede que hoy no exista ninguno que cambie rol o restaurante o que borre empleados. Si es así, la tarea 34 se limita al helper y a los tests.
- **`sqlite3@6`:** cambio mayor. Si falla, se pospone y se documenta (tarea 36).
- **Sesiones antiguas:** al pasar de `localStorage` a `sessionStorage`, los usuarios tendrán que volver a iniciar sesión una vez.
- **Rate limiting tras proxy:** por IP solo es fiable si se configura `trust proxy`, y `proxy-addr` tiene un CVE. No se activa `trust proxy` en este plan.
- **Cookie `HttpOnly` y CSP de producción:** fuera de alcance; el token en `sessionStorage` sigue siendo legible por cualquier XSS.
- **Dependencias entre tareas:**
  - 6 → 7, 8, 9, 11.
  - 9 → 43.
  - 22 → 23.
  - 27 → 28.
  - 32 → 33 → 34.
  - 37 → 38.
  - 39 → 40.
  - 41 → 42, 43.
