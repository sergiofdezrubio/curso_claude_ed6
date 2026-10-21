---
description: Crea un commit siguiendo la especificación Conventional Commits
argument-hint: [pista opcional sobre el tipo o el alcance]
allowed-tools: Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git add:*), Bash(git commit:*)
---

Crea un commit de los cambios actuales siguiendo la especificación [Conventional Commits 1.0.0](https://www.conventionalcommits.org/es/v1.0.0/).

## Contexto

- Estado del repositorio: !`git status --short`
- Cambios en el área de preparación (staged): !`git diff --cached`
- Cambios sin preparar: !`git diff`
- Últimos commits (para respetar el estilo): !`git log --oneline -10 2>/dev/null || echo "(todavía no hay commits)"`

Pista del usuario (opcional): $ARGUMENTS

## Formato

```
<tipo>[ámbito opcional][!]: <descripción>

[cuerpo opcional]

[pie(s) opcional(es)]
```

### Tipos permitidos

- `feat`: nueva funcionalidad.
- `fix`: corrección de un error.
- `docs`: solo documentación.
- `style`: formato que no afecta al significado del código (espacios, comas, etc.).
- `refactor`: cambio de código que no corrige un error ni añade funcionalidad.
- `perf`: mejora de rendimiento.
- `test`: añadir o corregir tests.
- `build`: cambios en el sistema de build o en dependencias (`package.json`, etc.).
- `ci`: cambios en la configuración de integración continua.
- `chore`: tareas de mantenimiento que no tocan `src` ni tests.
- `revert`: revierte un commit anterior.

### Reglas

1. El **ámbito** es opcional y va entre paréntesis; en este proyecto suele ser la capa o el módulo (`routes`, `controllers`, `services`, `repositories`, `models`, `middlewares`, `helpers`, `auth`, `vendehumos`).
2. La **descripción** va en español, en imperativo y en minúsculas, sin punto final y con un máximo de 72 caracteres en la primera línea.
3. El **cuerpo** (si hace falta) explica el *qué* y el *porqué*, no el *cómo*. Se separa de la descripción con una línea en blanco y se escribe en español.
4. Un **cambio incompatible** se marca con `!` tras el tipo/ámbito (`feat(auth)!: ...`) y/o con un pie `BREAKING CHANGE: <explicación>`.
5. Los **pies** usan el formato `Clave: valor` (por ejemplo `Refs: #12`, `Closes: #34`).

## Pasos

1. Si no hay cambios (ni preparados ni sin preparar), avisa al usuario y no hagas nada más.
2. Analiza los cambios y decide el tipo y el ámbito. Si los cambios mezclan varias intenciones independientes, propón dividirlos en varios commits y prepara cada uno por separado.
3. Si no hay nada preparado, añade con `git add` solo los archivos relevantes, nombrándolos explícitamente. No uses `git add -A` ni `git add .`, y no incluyas archivos con secretos (`.env`, bases de datos `.db`, etc.).
4. Redacta el mensaje siguiendo el formato anterior y muestraselo usando la tool `AskUserQuestion` para preguntar al usuario si el mensaje es correcto. Repite hasta que el usuario esté de acuerdo con el mensaje.
5. Crea el commit con `git commit -m` (usa un `-m` por cada párrafo o pie).
6. Termina el mensaje con la línea de atribución indicada en las instrucciones de la sesión, si la hay.
7. Muestra el resultado con `git log -1 --stat` y resume en una línea qué se ha commiteado.

## Restricciones

- No hagas `git push`.
- No uses `--amend`, `--no-verify` ni modifiques la configuración de git.
- Si un hook de pre-commit falla, informa del error en lugar de saltártelo.
