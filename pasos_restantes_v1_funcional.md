# BLW Care App — Pasos restantes para una versión funcional ("con todo")

Fecha: 2026-01-11

Este documento lista los pasos que faltan (desde el estado actual del repo) para llegar a una versión funcional alineada con [project_info.md](project_info.md).

## 0) Definición de “funcional con todo” (criterio de listo)

La app se considera “funcional con todo” cuando cumple, al menos:

- 5 pestañas: 📅 Calendario, ⚠️ Alergias, 🥦 Alimentos, 🍽️ Recetas, ℹ️ Info/Seguridad.
- Registro diario real (no placeholder): alta/edición/borrado, vista mensual con iconos, detalle por día.
- Checklist de hitos motores obligatorio antes de permitir registros.
- Bloqueo estricto por edad: no se muestra ni se puede registrar fuera de rango.
- Alergias: estados por alérgeno + avisos al registrar.
- Alimentos: selector por edad + ficha detallada (edad segura, beneficios, formas seguras, qué NO, advertencias).
- Recetas: listado + filtros (ingredientes incluidos, sin alérgenos seleccionados, edad).
- Info/Seguridad: contenido fijo con fuentes/limitaciones, reglas y arcadas vs atragantamiento.
- PWA offline: SW cachea shell + JSONs (ya) y el uso offline es consistente.
- Exportación/Importación de datos (backup humano) a JSON.

---

## 1) Base técnica y estructura (rápido)

1. Añadir `manifest.json` (PWA) y enlazarlo desde `index.html`.
   - Nombre, short_name, start_url, display=standalone, theme_color, icons.
2. Completar iconos PWA en `assets/` (192/512) y referenciarlos en `manifest.json`.
3. Revisar `sw.js` para incluir en precache `manifest.json` e iconos PWA.
4. Añadir una guía de arranque local en un `README.md` (o ampliar `project_info.md`):
   - Opción A: `python -m http.server 8080`.
   - Opción B (PowerShell): `npx http-server`.

Resultado esperado: app instalable como PWA y reproducible en local.

---

## 2) Modelo de datos local (localStorage) y migración

Estado actual: existe `StorageApi.getHistory()/setHistory()` con una única key.

1. Definir un “schema v1” (JSON) en `js/storage.js`:
   - `babyProfile`: fecha nacimiento, semanas gestación, FPP (si aplica), etc.
   - `milestones`: checklist hitos motores (booleanos + fecha).
   - `allergens`: mapa por alérgeno (estado + notas + fecha).
   - `diary`: entradas por fecha con IDs de alimentos y campos del formulario.
   - `settings`: idioma/tema (si aplica), etc.
2. Añadir migración simple por versión:
   - Si no existe, inicializa defaults.
   - Si existe formato antiguo (`history.v1`), migrar o mantener compatibilidad.
3. Añadir helpers:
   - `getState()`, `setState(partial)`, `reset()`.
   - CRUD para diario y alergias.

Resultado esperado: datos consistentes, evolutivos y fáciles de exportar/importar.

---

## 3) Perfil del bebé y cálculo de “edad segura”

1. Crear pantalla/flujo mínimo para introducir datos del bebé:
   - Fecha de nacimiento.
   - Si prematuro (<37 semanas): semanas gestación y/o FPP.
2. Implementar cálculo:
   - Edad cronológica (meses).
   - Edad corregida para prematuros (basado en FPP) según el documento.
3. Definir “edad segura” que usará toda la app:
   - `safeAgeMonths = correctedAgeMonths (si aplica) else chronologicalAgeMonths`.
4. Guardar/leer del storage y usarlo como “fuente de verdad”.

Resultado esperado: toda la UI se basa en la edad segura.

---

## 4) Bloqueos de seguridad (NO negociables)

### 4.1 Bloqueo por hitos motores

1. Implementar pestaña (o sección) de checklist de hitos motores.
2. Antes de permitir crear/editar registros en Calendario:
   - Si falta algún hito, bloquear con explicación.

### 4.2 Bloqueos por edad (mostrar y registrar)

1. En listas y buscador:
   - No mostrar alimentos con `edad_minima > safeAgeMonths`.
2. En ficha de alimento:
   - Mostrar “Edad segura: X meses” y estado (permitido/bloqueado).
3. En formulario de registro:
   - No permitir guardar si el alimento está fuera de rango.

### 4.3 Prohibidos globales

1. Añadir una lista “bloqueados siempre” (sal, azúcar) y “bloqueados hasta 12m” (miel).
2. Decidir cómo se representan:
   - Como “alimentos” no listados (solo info), o como items con bloqueo duro.

Resultado esperado: imposible saltarse reglas por UI.

---

## 5) Navegación: implementar las 5 pestañas

Estado actual: solo 2 tabs (`foods`, `diary`).

1. Actualizar `index.html`:
   - Añadir secciones para `calendar`, `allergies`, `foods`, `recipes`, `info`.
2. Actualizar `js/router.js` para soportar 5 rutas y activar vista.
3. Ajustar CSS si es necesario (grid de tabs 5 columnas o diseño equivalente).

Resultado esperado: navegación completa y estable.

---

## 6) Pestaña 📅 Calendario (funcional real)

### 6.1 Vista mensual

1. Implementar un calendario mensual (grid 7xN) con selector de mes.
2. Por día, mostrar iconos según entradas guardadas:
   - 🥦 alimento
   - ⚠️ reacción
   - ❤️ le gustó

### 6.2 Registro seguro por día

1. Al tocar un día:
   - Abrir modal o vista de detalle del día.
2. Formulario con campos del documento:
   - Alimento (solo lista segura)
   - Cantidad: Exploración / Probó / Comió poco / Comió bien
   - Forma: Entero blando / Bastones / Chafado
   - Reacción: Le gustó / Neutral / No le gustó
   - Observaciones
3. Si el alimento es alérgeno:
   - Mostrar aviso: “SOLO si está sano y durante el día”.
4. CRUD completo:
   - Añadir, editar y borrar entradas.

Resultado esperado: diario dietético usable, con persistencia.

---

## 7) Pestaña ⚠️ Alergias

1. Crear lista base de alérgenos:
   - Huevo, leche, pescado, marisco, trigo/gluten, soja, sésamo, frutos secos (polvo).
2. Para cada alérgeno:
   - Estado: No introducido / Introducido sin reacción / Reacción leve / Reacción grave.
3. Si se marca reacción:
   - Mostrar aviso: “Consulta con tu pediatra antes de volver a ofrecerlo.”
4. Integración con Calendario:
   - Si se registra un alimento con `es_alergeno=true`, enlazar con el alérgeno correspondiente (mínimo: recordatorio + acceso rápido).

Resultado esperado: control básico de alérgenos y avisos consistentes.

---

## 8) Pestaña 🥦 Alimentos (por edad)

Estado actual: lista + búsqueda + detalle JSON.

1. Añadir selector de edad en UI (6–7, 7–8, 8–9, 9–12) y/o “según edad segura”.
2. Filtrar lista por rango de edad y/o resaltar permitidos vs no (sin mostrar bloqueados si el documento exige ocultarlos).
3. Completar ficha detallada para cumplir “mínimo de ficha”:
   - Edad segura
   - Beneficios nutricionales (breve)
   - Formas seguras (presentaciones)
   - Qué NO hacer (prohibido)
   - Advertencia fija: “Las arcadas son normales, el atragantamiento NO.”
4. Normalizar el esquema de JSON de alimentos:
   - Asegurar campos consistentes (incluyendo advertencias, dificultad, etc.).

Resultado esperado: módulo de alimentos completo y consistente.

---

## 9) Pestaña 🍽️ Recetas

1. Definir formato de recetas (recomendado: `data/recipes/*.json` + índice `js/recipes.js` o incluir recetas en cada alimento con agregación).
2. Implementar listado de recetas:
   - Recetas simples (3–5 ingredientes), sin sal/azúcar/miel.
3. Implementar filtros:
   - Ingredientes incluidos
   - Sin alérgenos seleccionados (conecta con estado de Alergias)
   - Edad del bebé
4. Implementar ficha de receta:
   - Ingredientes
   - Preparación paso a paso
   - Textura final esperada
   - Cómo servir según edad

Resultado esperado: recetas navegables y filtrables.

---

## 10) Pestaña ℹ️ Info / Seguridad

1. Crear contenido estático en la pestaña:
   - Fuentes (OMS, AEP, NHS, Solid Starts como apoyo visual)
   - Límite ético (“no sustituye pediatra”)
   - Reglas de edad, texturas, prohibidos
   - Arcadas vs atragantamiento (resumen)
2. Mantener el mensaje ético permanente visible en la app (header o info).

Resultado esperado: sección informativa completa y coherente.

---

## 11) Botón SOS (ajustar a spec)

Estado actual: modal básico + enlace tel.

1. Completar el modal SOS para cubrir:
   - Diferencia Arcada vs Atragantamiento.
   - Diagrama/guía de maniobra de desobstrucción (contenido visual).
   - Llamada 112/911.
2. Confirmar accesibilidad:
   - `aria-label`, foco en modal, cierre con Escape.

Resultado esperado: SOS útil y siempre accesible.

---

## 12) Offline / PWA (consolidación)

1. Validar que el SW:
   - precachea todos los JSON de alimentos y recursos necesarios.
   - actualiza cache por versión (ya elimina caches anteriores).
2. Definir estrategia de actualización:
   - Cambiar `CACHE_NAME` cuando cambien recursos.
   - Considerar mensaje “hay una actualización” (opcional si se mantiene simple).
3. Probar offline real:
   - Abrir una vez online → luego modo avión → abrir fichas.

Resultado esperado: uso offline consistente.

---

## 13) Exportación / Importación (backup humano)

1. Implementar “Exportar a JSON” (descarga de archivo):
   - Exporta el estado completo del storage (perfil + diario + alergias + hitos).
2. Implementar “Importar JSON” (file input):
   - Validación básica del schema.
   - Confirmación antes de sobrescribir.

Resultado esperado: respaldo/restauración sin servidor.

---

## 14) Calidad mínima (UX/Accesibilidad)

1. Accesibilidad básica:
   - labels reales, `aria-*` donde aplique.
   - navegación por teclado en tabs y modales.
2. Mensajes de error comprensibles (sin tecnicismos) en carga offline.
3. Evitar sobrecarga cognitiva:
   - formularios cortos, textos claros.

---

## 15) Orden recomendado de implementación (para avanzar sin bloquearse)

1. Perfil del bebé + edad segura + schema storage.
2. Checklist hitos motores + bloqueo en registro.
3. Calendario mensual + formulario + CRUD.
4. Alergias + integración con registro.
5. Alimentos por edad (selector/rangos) + ficha “mínima” completa.
6. Recetas + filtros.
7. Info/Seguridad.
8. Exportar/Importar.
9. PWA manifest + pulido SW + pruebas offline.

---

## 16) Comprobaciones finales (checklist)

- [ ] No se puede registrar nada si faltan hitos motores.
- [ ] No se listan alimentos fuera de edad segura.
- [ ] No se puede guardar un alimento fuera de rango.
- [ ] Alergias muestra estados y lanza avisos en alérgenos.
- [ ] Calendario muestra iconos correctos por día.
- [ ] Recetas filtran por edad y alérgenos.
- [ ] Info/Seguridad muestra fuentes y límites.
- [ ] SOS visible y funcional.
- [ ] Offline: tras 1 visita online, fichas funcionan sin red.
- [ ] Export/Import restaura todo.
