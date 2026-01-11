# BLW Care App — Roadmap para agentes de IA (implementación por entregables)

Fecha: 2026-01-11

Este roadmap traduce el checklist funcional en “misiones” pequeñas para agentes de IA. Cada misión debe ser:

- Pequeña (1–2 archivos principales + tests/manual check).
- Aislada (sin re-trabajar módulos no relacionados).
- Verificable (criterios de aceptación claros).

Contexto del repo (estado actual): MVP con pestañas Alimentos/Diario, modal de detalle por JSON, botón SOS básico, Service Worker con precache de `FOOD_INDEX` + JSONs.

---

## Reglas para todos los agentes (guardrails)

- Mantener **Vanilla JS/HTML/CSS**, sin frameworks.
- No añadir “features extra” fuera del documento (sin gamificación, sin cuentas, sin nube).
- Priorizar **seguridad**: edad segura, bloqueos por edad, hitos motores, avisos de alérgenos.
- No romper el comportamiento offline existente.
- Ediciones mínimas; sin refactors masivos.

### Comando recomendado para correr en local (Windows)

- Opción A (Python Launcher): `py -m http.server 8080`
- Opción B (Python): `python -m http.server 8080`
- Opción C (Node): `npx http-server -p 8080`

---

## Cómo ejecutar este roadmap con agentes

Sugerencia de rutina por misión:

1. Leer la misión completa.
2. Revisar los archivos mencionados (sin tocar nada aún).
3. Implementar solo el alcance definido.
4. Validar con el checklist de “Done”.
5. Dejar el repo en estado usable.

---

## Fase 1 — Fundaciones (datos + utilidades)

### M01 — Estado único en storage (schema v1 + migración)

**Agente:** Storage/Data

**Objetivo:** Reemplazar el almacenamiento “historial plano” por un estado versionado con claves claras.

**Depende de:** nada.

**Archivos a tocar:**
- js/storage.js

**Alcance (in):**
- Definir un estado raíz con versión (ej. `blwcare.state.v1`).
- `getState()`/`setState(partial)`/`resetState()`.
- Sub-APIs: `diary.*`, `allergens.*`, `milestones.*`, `babyProfile.*`.
- Migración desde la key antigua si existe.

**Fuera de alcance (out):** UI completa para consumirlo (eso llega en misiones posteriores).

**Done cuando:**
- La app carga sin errores con estado vacío.
- El estado se crea con defaults al primer uso.
- No se pierde compatibilidad si existe la key antigua.

**Prompt sugerido al agente:**
- “Implementa un estado versionado en js/storage.js con getters/setters y migración desde el formato anterior. No cambies UI todavía.”

---

### M02 — Exportar / Importar backup humano (JSON)

**Agente:** Storage/Data + UI ligera

**Objetivo:** Permitir exportar e importar el estado completo (perfil + diario + alergias + hitos).

**Depende de:** M01.

**Archivos a tocar:**
- index.html (botones/inputs mínimos)
- js/app.js (handlers)
- js/storage.js (helpers de validación)

**Alcance (in):**
- Export: descargar `blwcare-backup.json`.
- Import: selector de archivo + validación básica + confirmación antes de sobrescribir.

**Done cuando:**
- Export descarga un JSON válido.
- Import restaura el estado y recarga UI sin romper.

**Prompt sugerido:**
- “Añade export/import a JSON con validación básica y confirmación. Mantén UI minimalista.”

---

### M03 — Cálculo de edad segura (cronológica/corregida)

**Agente:** Lógica de dominio

**Objetivo:** Implementar cálculo de edad segura según prematuridad.

**Depende de:** M01.

**Archivos a tocar:**
- js/app.js (o crear js/domain.js si prefieres, pero evita dispersar)
- js/storage.js (guardar perfil)

**Alcance (in):**
- Estructura `babyProfile`: fecha nacimiento, semanas gestación, FPP (si aplica).
- Función `getSafeAgeMonths()`.

**Done cuando:**
- Con datos de perfil, `safeAgeMonths` es estable y usable por filtros.

**Prompt sugerido:**
- “Implementa cálculo de edad segura en meses, guardándolo en babyProfile. No inventes reglas médicas extra.”

---

## Fase 2 — Navegación y pantallas base (5 tabs)

### M04 — Router con 5 pestañas + vistas vacías

**Agente:** UI/Router

**Objetivo:** Pasar de 2 pestañas a 5 y dejar placeholders para cada vista.

**Depende de:** nada.

**Archivos a tocar:**
- index.html
- js/router.js
- css/styles.css

**Alcance (in):**
- Rutas: `calendar`, `allergies`, `foods`, `recipes`, `info`.
- Mantener lo existente de Foods.

**Done cuando:**
- Cambiar de pestaña muestra/oculta la sección correcta.
- No se rompe el modal de Foods ni el SOS.

**Prompt sugerido:**
- “Actualiza navegación a 5 tabs con vistas vacías. Mantén la UI simple; sin features extra.”

---

### M05 — Perfil del bebé (UI mínima) + persistencia

**Agente:** UI + Storage

**Objetivo:** Pantalla simple para introducir/editar perfil del bebé.

**Depende de:** M01, M03.

**Archivos a tocar:**
- index.html (form)
- js/app.js (render/handlers)
- js/storage.js

**Alcance (in):**
- Form en pestaña Info o en un bloque dedicado.
- Validaciones mínimas (fecha obligatoria; semanas si prematuro).

**Done cuando:**
- Se puede guardar y leer el perfil.
- La app puede mostrar `safeAgeMonths` en algún sitio (texto simple).

**Prompt sugerido:**
- “Crea UI mínima para editar babyProfile y muestra la edad segura calculada.”

---

## Fase 3 — Seguridad operacional (bloqueos)

### M06 — Checklist hitos motores + gating para registro

**Agente:** Seguridad/UX

**Objetivo:** Añadir checklist y bloquear el registro si no está completo.

**Depende de:** M01, M04.

**Archivos a tocar:**
- index.html (vista o sección)
- js/app.js
- js/storage.js

**Alcance (in):**
- 4 checks: sentado, sin extrusión, interés por comida, mano-boca.
- Antes de abrir/guardar formulario de calendario: si falta alguno, bloquear con explicación.

**Done cuando:**
- No se puede registrar diario sin checklist completo.

**Prompt sugerido:**
- “Implementa checklist y bloquea el registro del calendario hasta completarlo.”

---

### M07 — Bloqueo por edad (mostrar y registrar)

**Agente:** Seguridad/Alimentos

**Objetivo:** Aplicar edad segura a listado/búsqueda y a registro.

**Depende de:** M03.

**Archivos a tocar:**
- js/app.js

**Alcance (in):**
- Foods: ocultar los que `edad_minima > safeAgeMonths`.
- Registro (cuando exista): impedir guardar si fuera de rango.

**Done cuando:**
- No aparece ni se puede registrar alimento fuera de rango.

**Prompt sugerido:**
- “Aplica filtro estricto por edad segura en Foods y valida en guardado de diario.”

---

## Fase 4 — Calendario (diario dietético real)

### M08 — Vista mensual de calendario

**Agente:** Calendar UI

**Objetivo:** Implementar grid mensual + navegación de mes.

**Depende de:** M01, M04.

**Archivos a tocar:**
- index.html
- js/app.js
- css/styles.css

**Alcance (in):**
- Grid mensual.
- Iconos por día basados en entradas guardadas.

**Done cuando:**
- Se ve el mes actual y se puede ir mes anterior/siguiente.

**Prompt sugerido:**
- “Implementa calendario mensual en la pestaña Calendar, leyendo del storage.”

---

### M09 — Formulario por día + CRUD de entradas

**Agente:** Calendar + Storage

**Objetivo:** Añadir/editar/borrar entradas del día con los campos del documento.

**Depende de:** M06, M07, M08.

**Archivos a tocar:**
- js/app.js
- js/storage.js

**Alcance (in):**
- Campos: alimento (solo seguros), cantidad, forma, reacción, observaciones.
- Aviso si alérgeno.
- CRUD completo.

**Done cuando:**
- Se guardan entradas y el calendario refleja iconos.

**Prompt sugerido:**
- “Implementa modal/vista de día con CRUD completo y validaciones de seguridad.”

---

## Fase 5 — Alergias

### M10 — Pestaña Alergias + persistencia

**Agente:** Allergies

**Objetivo:** Implementar estados de alérgenos y avisos.

**Depende de:** M01, M04.

**Archivos a tocar:**
- index.html
- js/app.js
- js/storage.js

**Alcance (in):**
- Lista base de alérgenos.
- Estados: no introducido / sin reacción / leve / grave.
- Mensajes de seguridad.

**Done cuando:**
- Los estados se guardan y se reflejan en UI.

**Prompt sugerido:**
- “Crea UI de alérgenos con 4 estados y persistencia local.”

---

### M11 — Integración Alergias ↔ Calendario

**Agente:** Integración

**Objetivo:** Al registrar un alérgeno, mostrar recordatorio y acceso a su estado.

**Depende de:** M09, M10.

**Archivos a tocar:**
- js/app.js

**Done cuando:**
- Registrar alimento alérgeno muestra aviso y acceso rápido a Alergias.

**Prompt sugerido:**
- “Integra el registro del diario con el estado de Alergias sin añadir complejidad extra.”

---

## Fase 6 — Alimentos (completar ficha y filtros por edad)

### M12 — Selector de edad + ficha mínima completa

**Agente:** Foods

**Objetivo:** Cumplir requisitos de la pestaña Alimentos.

**Depende de:** M03, M04.

**Archivos a tocar:**
- index.html
- js/app.js

**Alcance (in):**
- Selector 6–7 / 7–8 / 8–9 / 9–12 o “según edad segura”.
- En la ficha: edad segura + advertencia fija arcadas/atragantamiento.

**Done cuando:**
- La vista de Foods puede filtrarse por edad.
- La ficha cumple el contenido mínimo.

**Prompt sugerido:**
- “Añade selector por edad y completa la ficha con los campos mínimos, sin tocar el SW.”

---

## Fase 7 — Recetas

### M13 — Modelo de datos de recetas + listado

**Agente:** Recipes/Data

**Objetivo:** Introducir recetas simples en un formato modular.

**Depende de:** M04.

**Archivos a tocar:**
- data/recipes/ (nuevo)
- js/recipes.js (nuevo) o integrar en js/app.js (mantener simple)
- sw.js (precache)

**Done cuando:**
- Hay al menos 3 recetas de ejemplo cargables offline.

**Prompt sugerido:**
- “Crea estructura modular de recetas (índice + jsons) y muestra un listado básico.”

---

### M14 — Filtros de recetas + ficha

**Agente:** Recipes/UI

**Objetivo:** Implementar filtros y detalle de receta.

**Depende de:** M13, M10.

**Done cuando:**
- Filtra por ingredientes, alérgenos (según Alergias) y edad.

**Prompt sugerido:**
- “Implementa filtros de recetas conectados con Alergias y edad segura; añade ficha.”

---

## Fase 8 — Info / Seguridad + SOS

### M15 — Pestaña Info/Seguridad (contenido completo)

**Agente:** Contenido/UX

**Objetivo:** Volcar el contenido mínimo exigido (fuentes, límites, reglas).

**Depende de:** M04.

**Archivos a tocar:**
- index.html
- js/app.js (si hay render dinámico)

**Done cuando:**
- La pestaña incluye fuentes y límites, y reglas clave (sin claims médicos nuevos).

**Prompt sugerido:**
- “Añade contenido estático de Info/Seguridad basado en project_info.md, sin inventar recomendaciones.”

---

### M16 — SOS modal “según spec” + accesibilidad

**Agente:** Seguridad/Accesibilidad

**Objetivo:** Completar SOS con diagrama/guía y mejorar accesibilidad del modal.

**Depende de:** nada.

**Archivos a tocar:**
- js/app.js
- css/styles.css
- assets/images/ (si se añade diagrama)
- sw.js (si se añade asset)

**Done cuando:**
- SOS incluye arcada vs atragantamiento + guía visual + llamada.
- Modal gestiona foco de forma básica y cierra con Escape.

**Prompt sugerido:**
- “Completa SOS y mejora accesibilidad del modal sin añadir pantallas nuevas.”

---

## Fase 9 — PWA / Offline (cerrar el círculo)

### M17 — Manifest + icons + SW precache

**Agente:** PWA/Offline

**Objetivo:** Hacer la instalación PWA real y asegurar precache.

**Depende de:** M04 (recomendado), M13 si hay recetas.

**Archivos a tocar:**
- manifest.json (nuevo)
- index.html
- sw.js
- assets/ (iconos)

**Done cuando:**
- Lighthouse/DevTools permite “Install app”.
- Offline: tras 1 visita online, se pueden abrir fichas sin red.

**Prompt sugerido:**
- “Añade manifest e iconos, y actualiza sw.js para precachearlos. No cambies lógica de negocio.”

---

## Fase 10 — QA final (manual)

### M18 — Checklist final y limpieza

**Agente:** QA

**Objetivo:** Pasar checklist funcional y arreglar solo bugs introducidos.

**Depende de:** todas las misiones anteriores.

**Done cuando:**
- No se puede registrar sin hitos.
- No aparecen alimentos fuera de edad.
- Alergias y recetas filtran correctamente.
- Export/Import restaura todo.
- Offline funciona después de una visita online.

**Prompt sugerido:**
- “Revisa manualmente flujos principales, corrige bugs del último conjunto de cambios, sin refactors grandes.”

---

## Apéndice — Definición de entregable por PR

Para cada misión, el PR (o entrega) debe incluir:

- Qué cambió (1–3 bullets).
- Cómo probar (pasos manuales concretos).
- Archivos tocados.
- Riesgos/limitaciones conocidas.
