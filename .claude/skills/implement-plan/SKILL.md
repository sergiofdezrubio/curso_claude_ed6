---
name: implement-plan
description: Implementa un plan de docs/plans (entero o por fases) siguiendo Gitflow, con una rama por plan o fase trabajada en su propio git worktree, un commit por tarea y tests que deben pasar antes de dar cada tarea por terminada. La sesión principal orquesta un subagente por tarea con el modelo indicado en el plan y, solo cuando las tareas son independientes, los lanza en paralelo, cada uno en su propio worktree. Al terminar y con los tests en verde, integra la rama en develop con merge --no-ff. Nunca toca main. Úsala cuando el usuario pida implementar, ejecutar o desarrollar un plan generado con plan-feature, o una fase concreta de él.
argument-hint: "[ruta o nombre del plan en docs/plans] [fase N]"
---

# Implementar un plan

Implementa un plan de `docs/plans/` (el que genera la skill `plan-feature`), entero o por fases, siguiendo Gitflow. El diagrama, las ramas y la nomenclatura están en [references/gitflow.md](references/gitflow.md): léelo antes de empezar.

Plan a implementar: $ARGUMENTS

## Planes por fases

Un plan largo puede traer, antes de la sección 1, una tabla **«Estado de las fases»** con las columnas `Fase | Título | Tareas | Depende de | Estado`. El estado de cada fila es `pendiente`, `en curso` o `completada`. Esa tabla, junto con las casillas `- [x]` de las tareas, es la única fuente de verdad de lo que ya está hecho: un agente de una iteración posterior solo tiene que leerla (en `develop`, donde se integra cada fase).

- Si el plan trae la tabla, cada ejecución implementa **una fase**: la que indique `$ARGUMENTS`, o la primera `pendiente` o `en curso` cuyas dependencias estén todas `completada`. Nunca se rehace una fase `completada` ni una tarea ya marcada `- [x]`.
- Si el plan no trae la tabla, se trata como una sola fase que abarca todas las tareas.

## Orquestación con subagentes

La sesión principal es la **orquestadora**: hace las Fases 0, 1, 2, 4 y 5 y reparte las tareas de la Fase 3 entre subagentes (herramienta `Agent`). Los subagentes no pueden lanzar otros subagentes.

**Un subagente por tarea, con el modelo del plan.** Cada tarea indica su modelo en su línea (`— modelo: haiku|sonnet|opus`). El modelo se fija al lanzar el subagente (parámetro `model` de `Agent`) y no cambia durante su ejecución, por eso una tarea equivale a un subagente.

- Usa el modelo de la tarea. Si falta, elígelo con este criterio y anótalo en el plan: `haiku` para cambios mecánicos o de configuración sin lógica; `sonnet` para cambios acotados con lógica y tests; `opus` para diseño transversal, seguridad crítica o concurrencia.
- Si un subagente no consigue terminar la tarea por complejidad, repítela con el siguiente modelo (`haiku` → `sonnet` → `opus`). Nunca bajes de modelo.
- Dos o tres tareas consecutivas, dependientes y del mismo modelo pueden ir en un solo subagente si la sobrecarga de lanzarlo no compensa. Se mantiene siempre un commit por tarea.

**Prompt del subagente.** Debe ser autocontenido, porque no ve esta conversación. Incluye: la ruta absoluta de su worktree y su rama; el número, el texto completo de la tarea y su «Hecho cuando»; las reglas que le afectan (español, arquitectura de `CLAUDE.md`, test primero si es de la API, verificación de la Fase 3, tocar solo los archivos de la tarea, commit con la skill `commit` sin pedir confirmación, no hacer `push`, no tocar `resttek.db` ni otras ramas); y qué debe devolver (hash del commit, ficheros tocados, resultado de tests y builds, y cualquier desviación del plan).

**Verificación por la orquestadora.** El informe de un subagente no es una garantía. Tras cada subagente comprueba en su worktree: `git log -1` (existe el commit de la tarea), `git show --stat HEAD` (solo toca los archivos esperados), `git status --short` (limpio) y `npm test`. Si algo falla, reintenta una vez con el mismo prompt más el error, luego con el modelo superior y, si sigue fallando, para y avisa al usuario.

**Secuencial por defecto; paralelo solo si tiene sentido.** Lanza una tanda paralela únicamente si se cumplen **todas** estas condiciones:

1. **Sin dependencias:** ninguna tarea usa lo que crea otra de la tanda (mira el orden, el «Qué hacer» y la sección de dependencias entre tareas del plan), y todas están pendientes.
2. **Ficheros disjuntos:** las listas «Archivo(s)» no se solapan, y ninguna toca ficheros compartidos que suelen provocar conflictos: `package.json`, `package-lock.json`, `config/database.ts`, `app.ts`, `index.ts` de `web-shared`, `angular.json` ni el propio plan.
3. **Ni dependencias ni migraciones:** ninguna es una tarea de dependencias (instalar, subir versiones, `npm audit fix`) ni de migración de la BD.
4. **Compensa:** hay al menos dos tareas, y cada una justifica la sobrecarga de un worktree con `npm install`. Con tareas de unos 5 minutos normalmente no compensa, salvo que sean de paquetes distintos.

El máximo es de tres subagentes simultáneos. Ante la duda, secuencial.

**Tarea secuencial.** El subagente trabaja directamente en el worktree de la fase, marca la tarea en el plan y hace el commit (código, tests y plan juntos). Después se lanza el siguiente.

**Tanda paralela:**

1. Para cada tarea, crea una sub-rama `<rama-de-fase>_t<N>` desde la rama de fase, con su worktree (`git worktree add -b <sub-rama> .claude/workTrees/<sub-rama con "/" sustituida por "-"> <rama-de-fase>`) y ejecuta `npm install` en él.
2. Lanza todos los subagentes en un solo mensaje, cada uno en su worktree. Los subagentes de una tanda **no tocan el plan** (ni casillas ni tabla de fases): lo hace la orquestadora.
3. Cuando terminan, verifica cada uno y luego intégralos en la rama de fase **de uno en uno** con `git merge --no-ff` (desde el worktree de la fase), ejecutando `npm test` tras cada merge. Si hay conflicto, haz `git merge --abort` y rehaz esa tarea en secuencia sobre la rama de fase. Estas sub-ramas son ramas de trabajo: integrarlas en la rama de fase no es tocar `develop`.
4. Marca en el plan las casillas de las tareas de la tanda (y la fila de la fase, si procede) y commitéalo con la skill `commit` (tipo `docs`, por ejemplo «docs: marca las tareas 13 y 15 del plan vulnerabilidades-owasp»).
5. Retira los worktrees de las tareas (`git worktree remove`), que ya están integrados y verificados. Deja las sub-ramas y avisa en el informe de que se pueden borrar.

## Reglas que no se negocian

- **Una rama por plan** (o por fase, si el plan trae la tabla de fases), con el nombre `<environment>/<tipo>_<nombre_funcionalidad>`, más el sufijo `_fase-<N>` cuando se implementa una fase (ver `references/gitflow.md`).
- **Todos los cambios se hacen en un git worktree dedicado**, nunca en el directorio de trabajo principal (ver Fase 1, paso 6). Cuando se paralelizan tareas (ver «Orquestación con subagentes»), **cada subagente trabaja en su propio worktree y su propia sub-rama**.
- **Un commit por cada tarea del plan**, creado con la skill `commit` (herramienta `Skill`, `skill: "commit"`) **sin pedir confirmación al usuario por cada commit**. No escribas el mensaje a mano ni uses `git commit` directamente. Lo crea el subagente que ejecuta la tarea. Las excepciones son los commits de merge (los de sub-ramas de tarea en la rama de fase y el de la Fase 5), que se crean con `git merge`.
- **Ninguna tarea ni el plan se dan por terminados sin verificación en verde.** Cada tarea con código de la API lleva sus tests (vitest) en el mismo commit, y `npm test` completo debe pasar antes de commitear. Las tareas de frontend se verifican con `ng build` del paquete afectado (los frontends no tienen tests configurados; no añadas un framework de tests si el plan no lo pide).
- **`main` es intocable y `develop` solo se modifica con el merge de la Fase 5.** `main` nunca se modifica desde esta skill (ni merge, ni rebase, ni cherry-pick, ni reset, ni commit, ni renombrarla, ni borrarla). En `develop` la única operación permitida es `git merge --no-ff` de la rama de trabajo, **una vez terminada la fase y con los tests en verde**, siguiendo exactamente la Fase 5. Nada de rebase, cherry-pick, reset, commits directos, renombrar o borrar `develop`, ni `push` hacia ella. Las ramas `release/*` y `prod/*` (hotfix) y su integración en `main` quedan fuera de esta skill.
- **Comprueba la rama y el worktree antes de cada commit.** Antes de crear cualquier commit ejecuta `git rev-parse --show-toplevel` y `git branch --show-current`; si no estás en el worktree y la rama de trabajo del plan (o de tu tarea), para y muévete a ellos (o avisa al usuario si no puedes hacerlo sin perder cambios). Los commits de tareas nunca se hacen en `main`, `develop` ni `release/*`.
- Nada de `git push`, `--force`, `--no-verify`, `--amend` ni borrar ramas o worktrees sin confirmación explícita del usuario. La única excepción son los worktrees temporales que crea la propia skill (el de `develop` de la Fase 5 y los de las tareas de una tanda paralela, una vez integradas).
- Todo lo que se escriba (documentación, mensajes de error, nombres de tests, mensajes de commit) va en español.
- Respeta la arquitectura de `CLAUDE.md` (dos estilos en la API: hexagonal en `contexts/employee` y por capas `routes → controllers → services → repositories → models` en el resto, con el SQL solo en `repositories`). No añadas dependencias que el plan no pida, ni ORM.
- No toques nunca la base de datos real (`packages/api/resttek.db`): los tests usan `NODE_ENV=test` (SQLite en memoria) y para probar a mano usa una BD temporal en el directorio scratchpad.

## Flujo de trabajo

### Fase 0. Elegir y leer el plan

1. Si `$ARGUMENTS` está vacío, lista `docs/plans/` y pregunta con `AskUserQuestion` cuál implementar. Si es un nombre parcial, resuélvelo contra `docs/plans/`; si hay varias coincidencias, pregunta.
2. Lee el plan completo, **desde `develop`** (la rama que contiene lo ya integrado). Si trae la tabla «Estado de las fases», elige la fase a implementar según la sección «Planes por fases», comprueba que sus dependencias están `completada` y que las casillas de las tareas coinciden con la tabla (si no coinciden, para y avisa). Si el estado del plan no es `pendiente` ni `en curso`, o la fase elegida ya está `completada`, dilo y no hagas nada. Si el plan no trae la tabla y ya tiene tareas marcadas, muestra qué falta y confirma con el usuario si se retoma.
3. Si el plan tiene dudas abiertas en la sección "Riesgos y dudas abiertas" que bloqueen la implementación de la fase, pregúntalas ahora con `AskUserQuestion`.
4. Deduce de la cabecera y del nombre del fichero: el tipo (`feature` → `feat`, `bug` → `fix`) y el nombre (el slug sin fecha ni tipo).

### Fase 1. Preparar Gitflow

Comprueba el estado con `git branch -a`, `git status --short`, `git log --oneline -1` y `git remote -v`. Si el proyecto no cumple Gitflow, móntalo antes de tocar código.

1. **Repositorio con al menos un commit.** Si `git log` falla porque no hay ningún commit, para y avisa al usuario: sin un commit inicial no se pueden crear ramas ni worktrees. Propón crear un `.gitignore` (como mínimo `node_modules/`, `dist/`, `.angular/`, `*.db`, `.env`, `.DS_Store` y `.claude/workTrees/`) y un commit inicial, y no lo hagas sin su confirmación.
2. **Árbol de trabajo limpio.** Si hay cambios sin commitear que no pertenecen al plan, pregunta al usuario qué hacer (commitearlos con `commit` en su propia rama, o dejarlos fuera con `git stash`). No los arrastres a la rama del plan.
3. **Rama `main`.** Si no existe pero existe `master`, **no la renombres** (sería modificar la rama base). Pregunta con `AskUserQuestion` entre: (a) crear `main` como rama nueva apuntando al mismo commit (`git branch main master`), dejando `master` intacta, o (b) usar `master` como rama de producción en lugar de `main` en todo el flujo. Si no hay ninguna de las dos, avisa al usuario y no sigas.
4. **Rama `develop`.** Si no existe, créala como rama nueva desde `main` (`git branch develop main`): crear una rama no modifica la de origen. Si hay remoto, ofrece publicarla, pero no hagas `push` sin confirmación.
5. **Decidir las ramas del plan** a partir de `develop` (`main` solo en un hotfix urgente, que queda fuera de esta skill). El `<environment>` es `dev`, y **nunca** el nombre de la propia rama permanente: Git no permite `develop` y `develop/x` a la vez.
   - **Caso normal (un solo implementador):** una rama `dev/fix_vulnerabilidades-owasp` (plan entero) o `dev/fix_vulnerabilidades-owasp_fase-2` (una fase).
   - **Tareas en paralelo:** las sub-ramas de tarea (`<rama-de-fase>_t<N>`) solo se crean cuando se lanza una tanda paralela (ver «Orquestación con subagentes») y salen de la rama de fase.
   - La rama de una fase sale **siempre del `develop` actual**, que ya contiene las fases anteriores integradas. Si una dependencia de la fase no está integrada en `develop`, para y avisa.
6. **Crear el worktree** (uno por rama) con la rama nueva, sin tocar el directorio de trabajo principal:
   - Ubicación: `.claude/workTrees/<rama con "/" sustituida por "-">`, en la raíz del repositorio. Ejemplo: `git worktree add -b dev/fix_vulnerabilidades-owasp_fase-2 .claude/workTrees/dev-fix_vulnerabilidades-owasp_fase-2 develop`.
   - Para que Git no vea los worktrees como ficheros sin seguimiento, comprueba que `.claude/workTrees/` está ignorada y, si no, añádela a `.git/info/exclude` (no modifica ninguna rama).
   - Si la rama ya existe, no uses `-b`: `git worktree add <ruta> <rama>`. Si el worktree ya existe (`git worktree list`), reutilízalo en lugar de crearlo de nuevo.
   - A cada subagente pásale en su prompt la ruta absoluta de su worktree y su rama.
   - Un worktree nuevo no tiene `node_modules`: ejecuta `npm install` **en la raíz del worktree** (el monorepo usa npm workspaces) antes de lanzar los tests.
   - Desde este momento, **todos los comandos** (editar, tests, `git`, commits) se ejecutan dentro del worktree (usa rutas absolutas hacia él).
7. Confirma al usuario los nombres de las ramas y las rutas de los worktrees antes de crearlos.

### Fase 2. Comprobar la suite de tests

La API tiene una suite vitest ya configurada (`npm test` desde la raíz lanza `vitest run` del paquete `api`, con globals activados, alias de rutas resueltos con `vite-tsconfig-paths` y `supertest` disponible). No hay que crearla.

1. Dentro del worktree, ejecuta `npm test` **antes de tocar nada** y comprueba que pasa. Si falla antes de empezar, informa al usuario y pregunta cómo proceder.
2. Para una tarea de la API que lo necesite, usa estas convenciones:
   - Los tests viven junto al código (`*.test.ts` al lado del fichero probado).
   - Los de servicios y casos de uso usan repositorios mock (`repositories/mocks`, `application/mocks`); los de repositorios usan SQLite en memoria (`NODE_ENV=test`) e insertan primero la fila padre por las claves foráneas.
   - Los de rutas y controladores usan `supertest` contra `app` (export por defecto de `src/app.ts`), sin abrir el puerto.
   - Los imports TypeScript llevan extensión `.js` y se usan los alias de `tsconfig.json`.
3. Si un frontend se ve afectado, comprueba que `ng build` compila en ese paquete antes de empezar (puede tardar; lanza solo los paquetes afectados).

### Fase 3. Implementar las tareas, una a una

Recorre las tareas de la fase elegida **en el orden del plan**, repartiéndolas entre subagentes según «Orquestación con subagentes» (una a una por defecto, o en tandas paralelas cuando se cumplan las condiciones). Salta las ya marcadas `- [x]`. En el commit de la primera tarea de la fase (o en el commit `docs` de la primera tanda), pasa su fila de la tabla «Estado de las fases» a `en curso`.

Estos son los pasos de cada tarea. Los sigue el subagente que la ejecuta:

1. **Anuncia** la tarea (número, título, archivos) y marca mentalmente su "Hecho cuando".
2. **Si la tarea es de la API, escribe primero el test** que demuestre el "Hecho cuando" (rojo). Cubre el caso feliz, los errores (400, 401, 403, 404, 409, según corresponda) y los bordes que el plan menciona. Ejecútalo y comprueba que falla por el motivo esperado. Si la tarea es de frontend, define cómo comprobarás el "Hecho cuando" (`ng build` y la revisión del código; sin framework de tests).
3. **Implementa** el cambio, tocando solo los archivos que indica la tarea y respetando el estilo del código vecino (comentarios, nombres, ESM con imports `.js` en la API, standalone components, signals y patrón Store en los frontends).
4. **Ejecuta la verificación completa**: `npm test` (todo el paquete `api`, no solo el test nuevo) y, si tocaste un frontend o `web-shared`, `ng build` de cada frontend afectado. Si falla:
   - Arregla el código (o el test, si el test estaba mal) y repite.
   - Si tras varios intentos sigue fallando, para y cuéntaselo al usuario con la salida del error. No comentes, borres ni marques como `skip` tests para que pasen.
5. **Marca la tarea** como hecha (`- [x]`) en el plan. Si es la última tarea de la fase, pasa también la fila de la fase a `completada` en la tabla. En una tanda paralela, este paso lo hace la orquestadora (ver «Orquestación con subagentes»).
6. **Commit** con la skill `commit`: un commit por tarea que incluya el código, sus tests y el plan actualizado. Pásale como pista el tipo y el ámbito (por ejemplo, "fix(services): tarea 4 de la fase 2 del plan vulnerabilidades-owasp"). **No pidas confirmación del mensaje ni del commit**: indica a la skill `commit` que lo cree directamente, sin preguntar al usuario, y sigue con la tarea siguiente. Las comprobaciones de seguridad (rama correcta, tests en verde) siguen siendo obligatorias.
7. Comprueba con `git status --short` que el árbol queda limpio y pasa a la siguiente tarea.

Casos particulares:

- **Tarea de solo documentación** (por ejemplo, actualizar `docs/` o `CLAUDE.md`): no exige test nuevo, pero `npm test` completo debe seguir pasando antes de commitear. Tipo de commit `docs`.
- **Tarea de dependencias** (por ejemplo, `npm audit fix`, subir una versión): ejecuta `npm test` y `ng build` de los frontends afectados; si el cambio exige adaptar código y supera los 10 minutos del plan, revierte, anótalo en la sección de riesgos del plan y avisa al usuario.
- **Tarea de verificación manual**: conviértela en tests automáticos con `supertest` que reproduzcan cada fila de la tabla "Verificación manual" del plan relativa a la API (misma petición, mismo código de estado y cuerpo esperados). Las filas de frontend se comprueban con `ng build` y revisando el código, y se anotan como verificación manual pendiente de la persona que revise. Si es seguro, ejecuta además alguna petición `curl` real contra la API arrancada con una BD temporal en el scratchpad, nunca contra `resttek.db`.
- **Si el código real contradice el plan** (un archivo o función que no existe, un supuesto falso): para, explica la discrepancia y pregunta al usuario si se ajusta el plan. Si se ajusta, actualiza el plan en el mismo commit de la tarea.

### Fase 4. Cerrar la fase (o el plan)

Una fase (o el plan entero, si no tiene fases) solo está terminada cuando se cumple **todo** lo siguiente:

- [ ] Todas sus tareas están marcadas `- [x]` y cada una tiene su commit.
- [ ] Las filas de "Verificación manual" de la API que corresponden a la fase están cubiertas por tests automáticos que pasan.
- [ ] `npm test` completo pasa (muestra el resumen: tests totales, pasados, fallidos) y los frontends afectados compilan con `ng build`.
- [ ] Los puntos de "Documentación a actualizar" que corresponden a la fase están hechos y marcados.
- [ ] La fila de la fase en «Estado de las fases» está en `completada`.
- [ ] Si todas las fases del plan están `completada` (o el plan no tiene fases), el estado de la cabecera es `completado`; si solo lo están algunas, es `en curso`.

Cuando se cumpla, actualiza esos estados en el plan y commitéalo con la skill `commit` (tipo `docs`) si no lo hiciste ya en la última tarea. Si la lista no se cumple, no lo declares terminado: di qué falta y **no hagas el merge de la Fase 5**.

Esta lista la comprueba la orquestadora: los subagentes no cierran fases.

### Fase 5. Integrar en `develop`

Esta fase es la única en la que se modifica `develop`, y solo con `git merge --no-ff` de la rama de trabajo ya terminada. **Nunca se toca `main`.**

1. Muestra al usuario el resumen: rama(s), ruta(s) del/los worktree(s), lista de commits (`git log --oneline develop..HEAD`, ejecutado dentro del worktree) y resultado de la verificación.
2. **Condiciones previas** (si falta alguna, no integres): la Fase 4 está cumplida, el árbol del worktree está limpio, `npm test` pasa en la rama y `develop` no ha avanzado de forma que pueda haber conflictos sin revisar (`git log --oneline HEAD..develop`; si ha avanzado, informa al usuario de qué entra y, si hay solapes, no sigas sin su visto bueno).
3. **Dónde se hace el merge.** Un merge necesita `develop` desprendida en un worktree. Mira `git worktree list`:
   - Si `develop` está extraída en el directorio principal o en otro worktree, haz el merge allí solo si su árbol está limpio; si no lo está, para y pregunta.
   - Si no está extraída en ninguno, crea un worktree temporal (`git worktree add .claude/workTrees/develop develop`) y retíralo al terminar (`git worktree remove`; es el único worktree que esta skill borra sin preguntar).
4. **Merge con prueba previa.** Dentro del worktree de `develop`:
   1. Comprueba con `git rev-parse --show-toplevel` y `git branch --show-current` que estás en `develop` y que `main` no es la rama actual.
   2. `git merge --no-ff --no-commit <rama-de-trabajo>`.
   3. Si hay conflictos, ejecuta `git merge --abort`, deja `develop` como estaba y explica al usuario qué ficheros chocan. No los resuelvas por tu cuenta.
   4. Si no hay conflictos, ejecuta `npm test` (y `ng build` de los frontends afectados) **sobre el resultado del merge**. Si algo falla, `git merge --abort` y avisa al usuario con la salida.
   5. Si todo pasa, confirma el merge con `git commit -m "chore(merge): integra <rama-de-trabajo> en develop"` (mensaje en español, estilo Conventional Commits). Este es el único commit en `develop` que esta skill crea.
5. Comprueba con `git log --oneline -3 develop` que el merge está en `develop` y que `main` no ha cambiado (`git rev-parse main` igual que antes).
6. Solo se integra la rama de la fase: las sub-ramas de tarea ya se integraron en ella durante la Fase 3.
7. **No borres** la rama de trabajo ni su worktree (`git worktree remove`) sin confirmación expresa: déjalos para que la persona que revise pueda inspeccionarlos. Indica en el informe cómo retirarlos (`git worktree remove <ruta>` y `git branch -d <rama>`).
8. Si hay remoto, ofrece con `AskUserQuestion` publicar `develop` (`git push origin develop`) y la rama de trabajo. No hagas `push` sin confirmación y nunca `push --force`. No hay pull requests en este flujo.
9. El paso a producción (rama `release/...`, merge en `main` y etiqueta de versión) lo hace siempre una persona, fuera de esta skill; menciónalo como siguiente paso solo cuando todas las fases del plan estén `completada`.
10. Si el usuario te pide integrar en `main` (o hacer un release o hotfix), explícale que esta skill no lo permite.

### Aviso por Slack

Cuando la fase (o el plan) esté terminada (Fase 4 cumplida) e integrada en `develop` (Fase 5), avisa al equipo en el canal `planes-ed8` con el servidor MCP `slack` (configurado en `.mcp.json`):

1. Carga las herramientas del servidor `slack` con `ToolSearch` si no están disponibles (por ejemplo, `select:mcp__slack__slack_list_channels,mcp__slack__slack_post_message`).
2. Obtén el `channel_id` del canal `planes-ed8` con `slack_list_channels` (la herramienta de publicar necesita el id, no el nombre).
3. Publica con `slack_post_message` un mensaje breve en español, por ejemplo: `✅ Fase <N> del plan <nombre del plan> implementada e integrada en develop. Rama: <rama>, commits: <n>, tests: <pasados>/<totales>. Fases completadas: <x>/<total>.` Para un plan sin fases, omite la fase.
4. Si la fase **no** se ha terminado o no se integró (tests fallando, tarea bloqueada, conflictos), no envíes este aviso.
5. Si el servidor `slack` no está disponible, faltan las variables `SLACK_BOT_TOKEN`/`SLACK_TEAM_ID`, no se encuentra el canal o el envío falla, **no interrumpas la skill**: dilo claramente en el informe final e indica que el aviso no se ha enviado. No inventes que se envió.

### Informe final

Termina con un resumen breve para el usuario: plan y fase implementados, rama(s) y worktree(s) usados (ruta absoluta de cada uno), subagentes lanzados (tarea, modelo, si fue en tanda paralela y si hizo falta reintentar o subir de modelo), sub-ramas que se pueden borrar, número de tareas completadas y de commits, resultado de los tests y de los builds, si se integró en `develop` (hash del commit de merge) o por qué no, si se publicó algo, si se avisó por Slack (o por qué no), las fases que quedan `pendiente` (con su orden recomendado) y cualquier duda o desviación del plan.
