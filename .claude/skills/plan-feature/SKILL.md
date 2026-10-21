---
name: plan-feature
description: Planifica cómo implementar una nueva funcionalidad o corregir un bug y genera un plan detallado en docs/plans con tareas de 5-10 minutos. Úsala cuando el usuario pida planificar una feature o un bug antes de programarlo.
argument-hint: "<descripción de la funcionalidad o del bug>"
---

# Planificar una funcionalidad o un bug

Genera un plan detallado en `docs/plans/` para la funcionalidad o el bug descrito por el usuario. **No implementes nada**: esta skill solo planifica.

Petición del usuario: $ARGUMENTS

## Pasos

1. **Entiende la petición.** Si `$ARGUMENTS` está vacío o es ambiguo (no queda claro el objetivo, el alcance o, en un bug, cómo reproducirlo), pregunta al usuario con `AskUserQuestion` antes de seguir. No preguntes lo que puedas resolver leyendo el código.
2. **Decide el tipo:** `feature` (nueva funcionalidad) o `bug` (corrección de un error).
3. **Explora el código** antes de planificar:
   - Lee `CLAUDE.md` y los documentos de `docs/` relevantes (por ejemplo `docs/api/api-pagination.md` si se toca un GET).
   - Localiza los archivos afectados en cada capa (`routes` → `controllers` → `services` → `repositories` → `models`, más `middlewares` y `helpers`) y respeta las dependencias hacia abajo y la regla de que el SQL solo vive en `repositories/`.
   - En un bug, identifica la causa probable leyendo el código; si puedes reproducirlo de forma segura, hazlo.
4. **Lee la plantilla** `assets/plantilla-plan.md` (junto a este `SKILL.md`) y úsala como estructura del plan. Mantén todas sus secciones y su orden; si una sección no aplica, escribe `No aplica` en lugar de borrarla.
5. **Redacta la lista de tareas** siguiendo las reglas de más abajo.
6. **Guarda el plan** en `docs/plans/<AAAA-MM-DD>-<tipo>-<slug>.md`:
   - `<slug>` en minúsculas, sin tildes, con guiones y de pocas palabras (por ejemplo `2026-10-15-feature-votar-vendehumo.md`).
   - Crea la carpeta `docs/plans/` si no existe.
   - Si ya existe un plan con ese nombre, no lo sobrescribas: pregunta al usuario o añade un sufijo numérico.
7. **Resume al usuario** en pocas líneas: ruta del plan, número de tareas, tiempo total estimado y las dudas o riesgos abiertos. Ofrece empezar a implementarlo, pero no lo hagas sin que lo pida.
8. **Avisa por Slack** de que el plan está listo para revisar, siguiendo la sección "Notificación por Slack" de más abajo.

## Notificación por Slack

Cuando el plan esté guardado, envía un mensaje al canal `planes-ed8` con el servidor MCP `slack` (configurado en `.mcp.json`):

1. Carga las herramientas del servidor `slack` con `ToolSearch` si no están disponibles (por ejemplo, `select:mcp__slack__slack_list_channels,mcp__slack__slack_post_message`).
2. Obtén el `channel_id` del canal `planes-ed8` con `slack_list_channels` (la herramienta de publicar necesita el id, no el nombre).
3. Publica con `slack_post_message` un mensaje breve en español, por ejemplo: `📝 El plan <ruta del plan> (<tipo>: <título>) ya está listo para revisar. Tareas: <n>, tiempo estimado: <total> min.`
4. Si el servidor `slack` no está disponible, faltan las variables `SLACK_BOT_TOKEN`/`SLACK_TEAM_ID`, no se encuentra el canal o el envío falla, **no interrumpas la skill**: dilo claramente en el resumen al usuario e indica que el aviso no se ha enviado. No inventes que se envió.

## Reglas de las tareas

- Cada tarea debe poder hacerse en **5-10 minutos**. Si estimas más, divídela; si es menos de 5, agrúpala con otra cercana.
- Cada tarea tiene una sola intención y un resultado comprobable (qué se debe poder ver o ejecutar al terminarla).
- Indica en cada tarea el archivo o archivos concretos que toca y la capa a la que pertenecen.
- Usa casillas de Markdown (`- [ ]`), numeradas y en el orden en que deben ejecutarse, de abajo hacia arriba en las capas cuando se cree código nuevo (modelo/repositorio → servicio → controller → ruta).
- Incluye una estimación en minutos por tarea (`5 min`, `10 min`, ...) y suma el total en la cabecera del plan.
- Como el proyecto no tiene tests ni linter, las tareas de verificación son manuales (por ejemplo, peticiones con `curl` a los endpoints y sus códigos de estado esperados).
- Si el cambio altera el comportamiento descrito en `CLAUDE.md` o en `docs/`, añade una tarea para actualizar esa documentación.

## Restricciones

- Toda la documentación, el plan y los mensajes de error de la API se escriben en español.
- No modifiques código fuente ni hagas commits: el único archivo que se crea es el plan.
- No inventes archivos, funciones ni endpoints: basa el plan en lo que has leído en el repositorio.
