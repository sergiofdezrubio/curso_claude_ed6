# Plan: <título corto de la funcionalidad o del bug>

- **Tipo:** feature | bug
- **Fecha:** <AAAA-MM-DD>
- **Estado:** pendiente
- **Tiempo total estimado:** <N> min (<M> tareas)

## 1. Contexto

<Por qué se hace este cambio. En un bug: qué ocurre y qué debería ocurrir. En una feature: qué necesita el usuario o la API.>

## 2. Objetivo

<Resultado esperado en una o dos frases, comprobable desde fuera (por ejemplo, el comportamiento de un endpoint).>

## 3. Alcance

**Incluye:**

- <qué entra en el plan>

**No incluye:**

- <qué se deja fuera a propósito>

## 4. Análisis del código actual

<Archivos y capas implicadas, con su ruta y lo relevante de cada uno. En un bug, la causa probable.>

| Capa | Archivo | Qué hay que hacer |
| ---- | ------- | ----------------- |
| <routes / controllers / services / repositories / models / middlewares / helpers> | `src/...` | <cambio previsto> |

## 5. Diseño de la solución

<Decisiones técnicas: cambios en la API (rutas, parámetros, cuerpos, códigos de estado), cambios en la BBDD (tablas, columnas), validaciones y mensajes de error en español. Alternativas descartadas y por qué.>

## 6. Lista de tareas

Cada tarea dura entre 5 y 10 minutos y tiene un resultado comprobable.

- [ ] **1. <título de la tarea>** (<N> min)
  - Archivo(s): `src/...`
  - Qué hacer: <acción concreta>
  - Hecho cuando: <resultado comprobable>
- [ ] **2. <título de la tarea>** (<N> min)
  - Archivo(s): `src/...`
  - Qué hacer: <acción concreta>
  - Hecho cuando: <resultado comprobable>

## 7. Verificación manual

<Peticiones concretas para probar el cambio, con el resultado esperado.>

| Petición | Resultado esperado |
| -------- | ------------------ |
| `curl -i ...` | <código de estado y cuerpo> |

## 8. Documentación a actualizar

- [ ] <`CLAUDE.md`, `docs/...` u otro; o `No aplica`>

## 9. Riesgos y dudas abiertas

- <riesgo, dependencia o pregunta pendiente; o `Ninguno`>
