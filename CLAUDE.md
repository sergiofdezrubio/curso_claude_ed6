# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Qué es

Resttek: plataforma de gestión de restaurantes. Monorepo con **npm workspaces** (`packages/*`): una API Node.js (`api`), tres apps Angular 21 (`web-admin`, `web-empleados`, `web-clientes`) y una librería Angular compartida (`web-shared`). La documentación del proyecto está en español; mantenla así. Detalle ampliado en [docs/](docs/) (arquitectura, modelo de datos, glosario).

## Comandos

Todo se lanza desde la raíz (Node 22+, `npm install` una sola vez):

```bash
npm run seed            # puebla SQLite (INSERT OR IGNORE, es idempotente)
npm run dev:api         # API en :3000 (tsx watch); health: GET /health
npm run dev:admin       # :4200
npm run dev:empleados   # :4201
npm run dev:clientes    # :4202
npm test                # vitest run, solo del paquete api
```

- Un solo test: `cd packages/api && npx vitest run src/services/order.service.test.ts` (o `-t "nombre del test"`). Modo watch: `npm run test:watch` dentro de `packages/api`.
- Los frontends no tienen tests ni lint configurados; `ng build` dentro de cada paquete compila.
- Los frontends hacen proxy de `/api` hacia `localhost:3000` (`proxy.conf.json`); acceder siempre por el puerto del frontend.
- Credenciales del seed: la contraseña de cada usuario es su propio email (p. ej. `admin@resttek.com`). Lista completa en [README.md](README.md).
- Los cambios en `web-shared` no se recargan en caliente: reinicia el `ng serve` del frontend.
- `scripts/seed-issues.sh` crea issues de GitHub desde `scripts/issues.json` (requiere `gh` y `jq`); no tiene que ver con los datos de la BD.

## Arquitectura de la API (`packages/api`)

Conviven **dos estilos** y hay que saber cuál aplica antes de tocar código:

1. **Hexagonal + DDD, solo el contexto `employee`** (`src/contexts/employee/{domain,application,infrastructure}`): casos de uso (`LoginUseCase`, `CreateEmployeeUseCase`, `RegisterClientUseCase`), puertos `IEmployeeRepository`/`IAuthService`, entidad `Employee` con constructor privado + `create()`, value objects `Email` (en `contexts/shared`) y `Role`. El cableado de dependencias está en `infrastructure/http/dependencies.ts`. `contexts/shared` no es un contexto de negocio: contiene `Email`, middlewares y `errorHandler`.
2. **Por capas, para `restaurant`, `dish`, `ingredient`, `order`**: `routes → controllers → services → repositories → models`, un fichero por dominio en cada carpeta. Aquí no hay entidades con comportamiento: los modelos son interfaces planas y la validación vive en los servicios y en funciones de normalización del modelo.

Puntos que requieren leer varios ficheros:

- **Path aliases** (`@config`, `@errors`, `@shared` → `contexts/shared`, `@employee` → `contexts/employee`, `@routes`, `@controllers`, `@services`, `@repositories`, `@models`, `@scripts`) definidos en `tsconfig.json` y resueltos en tests con `vite-tsconfig-paths`. Los imports TS llevan extensión `.js` (ESM, `module: nodenext`).
- `tsconfig` es muy estricto (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`).
- **BD**: SQLite vía `Database` en `src/config/database.ts` (wrapper con promesas). Las tablas se crean al iniciar el servidor (`initialize()` → migraciones iniciales) y se activa `PRAGMA foreign_keys = ON`, por lo que los fixtures de tests deben insertar primero la fila padre. Con `NODE_ENV=test` usa `:memory:`; si no, `packages/api/resttek.db`.
- **Auth**: JWT (8h) firmado en `BcryptAuthService` y verificado en `contexts/shared/.../middlewares.ts`; ambos leen `JWT_SECRET` con un valor por defecto de desarrollo. La autorización por rol se hace con `authorize()` en las rutas. Roles: admin, manager, camarero, cocinero, cliente.
- **Rutas** (`src/app.ts`): todo bajo `/api/v1`; `/public/restaurants[...]` es sin autenticación (lo usa web-clientes); las rutas de platos, ingredientes y empleados están anidadas bajo `/restaurants/:restaurantId/...`.
- **Tests**: unitarios con repositorios mock (`repositories/mocks`, `application/mocks`) y tests de repositorios SQLite; globals de vitest activados.

## Arquitectura de los frontends

- Angular 21: standalone components, signals, **zoneless**, guards/interceptors funcionales, lucide-angular para iconos. RxJS solo para HTTP.
- `web-admin` y `web-empleados`: features autocontenidas (`features/<x>/{models,pages,services,store}`) con lazy loading. Patrón **Store**: servicio `providedIn: 'root'` con signals privadas expuestas con `asReadonly()` y métodos async que envuelven HTTP con `firstValueFrom`.
- `web-clientes` es distinta: modelos y servicios centralizados en `core/`, componente raíz `App` (no `AppComponent`), y los componentes consumen los `Observable` con `.subscribe()`; solo `cart.store.ts` usa el patrón Store.
- `@resttek/web-shared` (entrada `src/index.ts`, sin build, se consume como TS) aporta login/registro, `AuthService`/`AuthStore`/`authGuard`, interceptores de auth y errores y el token `API_URL`. Las apps no tienen carpeta `shared/` propia: lo común va aquí y se exporta desde `index.ts`.
- `API_URL` se inyecta desde `environments/environment*.ts` de cada app.
- `web-empleados` filtra rutas por rol (cocinero → Cocina; camarero → Barra y Salón).

## Estado y avisos

- Parte de los frontends es esqueleto (p. ej. en `web-admin` varias features solo tienen su fichero de rutas). Comprueba el código real antes de asumir que algo existe.
- `docs/revisiones/` recoge discrepancias detectadas entre documentación y código; si cambias comportamiento documentado, actualiza el doc correspondiente en `docs/`.
- El directorio de trabajo no está bajo git.
