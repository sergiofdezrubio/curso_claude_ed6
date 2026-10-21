# Gitflow del proyecto

## Diagrama

```mermaid
gitGraph
    commit id: "estado inicial" tag: "v1.0.0"
    branch develop
    checkout develop
    commit id: "integración"
    branch "dev/feat_nombre"
    checkout "dev/feat_nombre"
    commit id: "paso 1 del plan"
    commit id: "paso 2 del plan"
    checkout develop
    merge "dev/feat_nombre" id: "merge --no-ff"
    branch "release/chore_v1.1.0"
    checkout "release/chore_v1.1.0"
    commit id: "versión y ajustes finales"
    checkout main
    merge "release/chore_v1.1.0" tag: "v1.1.0"
    checkout develop
    merge "release/chore_v1.1.0"
    checkout main
    branch "prod/fix_error-critico"
    checkout "prod/fix_error-critico"
    commit id: "corrección urgente"
    checkout main
    merge "prod/fix_error-critico" tag: "v1.1.1"
    checkout develop
    merge "prod/fix_error-critico"
```

(En un proyecto donde la rama de producción se llama `master`, léase `master` donde pone `main`.)

## Ramas

| Rama | Vida | Sale de | Vuelve a | Para qué |
| ---- | ---- | ------- | -------- | -------- |
| `main` (o `master`) | permanente | — | — | Código en producción. Cada merge en ella lleva una etiqueta de versión (`vX.Y.Z`). |
| `develop` | permanente | `main` | — | Integración. Contiene lo último terminado para la próxima versión. |
| `dev/<tipo>_<nombre>` | temporal | `develop` | `develop` | Trabajo normal: funcionalidades, refactors, bugs no urgentes, documentación, tests. |
| `release/<tipo>_<nombre>` | temporal | `develop` | `main` y `develop` | Preparación de una versión (por ejemplo `release/chore_v1.1.0`): solo ajustes finales y número de versión. |
| `prod/<tipo>_<nombre>` | temporal | `main` | `main` y `develop` | Hotfix: corrección urgente de un error en producción. |

## Nomenclatura de ramas de trabajo

```
<environment>/<tipo>_<nombre_funcionalidad>
```

- `<environment>`: el entorno sobre el que se trabaja: `dev` (sale de `develop`, lo habitual), `prod` (hotfix, sale de `main`) o `release`.
  - **No puede coincidir con el nombre de una rama permanente.** Git guarda las ramas como ficheros y carpetas: si existe `develop`, no puede existir `develop/feat_x` (ni `main` y `main/fix_x`). Por eso las ramas permanentes se llaman `develop` y `main` y los prefijos son `dev` y `prod`.
- `<tipo>`: el tipo de Conventional Commits que mejor describe el cambio: `feat`, `fix`, `refactor`, `docs`, `test`, `perf`, `build`, `ci`, `chore`.
- `<nombre_funcionalidad>`: el slug del plan sin fecha ni tipo, en minúsculas, sin tildes y con guiones (`asociar-vendehumo-usuario`).

Ejemplos: `dev/feat_asociar-vendehumo-usuario`, `dev/test_configurar-tests`, `prod/fix_token-expirado`.

El plan `docs/plans/2026-10-15-feature-asociar-vendehumo-usuario.md` da la rama `dev/feat_asociar-vendehumo-usuario` (el tipo `feature` del plan se traduce a `feat`, y `bug` a `fix`).

## Worktrees

Cada rama de trabajo se desarrolla en su propio `git worktree`, dentro de `.claude/workTrees/<rama con "/" sustituida por "-">` (carpeta ignorada por Git). Así el directorio principal no cambia de rama y varias ramas pueden avanzar a la vez.

- Un worktree por rama: Git no permite tener la misma rama en dos worktrees.
- Si la skill lanza tareas en paralelo, cada tarea de la tanda tiene una sub-rama y un worktree propios, con el sufijo `_t<N>`: `<rama-de-fase>_t<N>` (por ejemplo `dev/fix_vulnerabilidades-owasp_fase-3_t13`). Salen de la rama de fase y se integran en ella con `--no-ff` antes de continuar; los worktrees de tarea se retiran al integrarlas.
- Si el plan se implementa por fases, cada fase tiene su propia rama con el sufijo `_fase-<N>`: `dev/fix_<nombre>_fase-<N>` (y sus sub-ramas de tarea, `dev/fix_<nombre>_fase-<N>_t<M>`). Cada fase sale del `develop` actual y se integra en él antes de empezar la siguiente.
- Comandos útiles: `git worktree add -b <rama> <ruta> develop`, `git worktree list`, `git worktree remove <ruta>`.

## Reglas

1. Nunca se commitea directamente en `main` ni en `develop`; solo se llega a ellas con merge.
2. **`main` está protegida para la skill `implement-plan`**: nunca la modifica de ninguna forma. **`develop` solo se modifica con `git merge --no-ff` de una rama `dev/...` terminada** (Fase 5 de la skill): el merge se prueba antes de confirmarlo (`--no-commit`, `npm test` y `ng build` sobre el resultado) y se aborta si hay conflictos o fallos. Nada de rebase, reset, cherry-pick ni commits directos en `develop`. Los `release` y `hotfix`, el merge en `main` y las etiquetas de versión los hace una persona, fuera de la skill.
3. Los merges, tanto los de la skill como los de una persona, se hacen con `--no-ff` para conservar la historia de la rama.
4. Una rama temporal se borra después de integrarse, no antes.
5. Un `release` o `hotfix` se integra en `main` **y** en `develop`, y se etiqueta en `main`, también fuera de esta skill.
