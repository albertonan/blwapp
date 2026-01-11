# BLW Care App – Documento de Diseño y Seguridad (v2.1 - Modular)

## 1. Objetivo de la aplicación

Crear una aplicación **web/PWA** (Progressive Web App) para acompañar a familias que practican **Baby-Led Weaning (BLW)**, centrada en:

- Registro diario de alimentos (diario dietético)
- Control de alergias
- Recomendaciones por edad basadas en evidencia
- Ideas de preparación **seguras**
- Recetas simples y filtrables
- Uso sencillo, visual y sin sobrecarga cognitiva

**Filosofía técnica:** "Client-Side Only" y **Modular**. Sin servidores. Sin cuentas. Los datos de alimentos se gestionan como recursos estáticos independientes para facilitar el mantenimiento y la colaboración.

⚠️ **Principio clave:** La app **NO sustituye** recomendaciones médicas ni pediátricas. Prioriza la seguridad antes que la variedad.

**Mensaje ético permanente (en la app):**
> “Cada bebé es único. Ante dudas, consulta con un profesional sanitario.”

---

## 2. Principios de seguridad (NO negociables)

### 2.1 Fuentes oficiales obligatorias

Toda recomendación se basará únicamente en:

- OMS (WHO)
- AEP (Asociación Española de Pediatría)
- NHS (UK)
- Solid Starts (como **apoyo visual**, no como autoridad única)

En secciones informativas y fichas se mostrará:
> “Información basada en guías pediátricas oficiales. Consulta siempre con tu pediatra.”

### 2.2 Cálculo de “Edad segura”

1. **Edad cronológica:** fecha de nacimiento real.
2. **Edad corregida (prematuros):** si <37 semanas, se usa la Fecha Probable de Parto (FPP) para el cálculo.

### 2.3 Límites estrictos de edad

- Ningún alimento se mostrará **antes de la edad segura**.
- No se permitirá marcar como “dado” un alimento **fuera de rango**.
- El calendario respetará la edad del bebé.

Ejemplos conservadores:

- Frutos secos → **solo** como polvo fino/harina (según pauta)
- Sal y azúcar → **bloqueados siempre**
- Miel → **bloqueada hasta 12 meses**

### 2.4 Texturas y cortes (clave BLW)

Cada alimento tendrá **solo**:

- Texturas seguras
- Cortes adaptados a la edad
- Advertencias claras y visibles (arcadas vs atragantamiento)

No se aceptan:

- tamaños ambiguos
- “depende del bebé” sin criterios claros
- imágenes sin contexto

### 2.5 Bloqueo por hitos motores

Checklist obligatorio antes de permitir registros:

- [ ] Se mantiene sentado.
- [ ] Sin reflejo de extrusión.
- [ ] Interés por comida.
- [ ] Coordinación mano-boca.

---

## 3. Arquitectura técnica (Modular & Offline)

### 3.1 Stack tecnológico

- **HTML5 / CSS3 / JS (Vanilla):** sin frameworks.
- **Fetch API:** carga asíncrona de los JSON de cada alimento.
- **Persistencia local:** `localStorage` (y/o `IndexedDB` si hiciera falta en el futuro).
- **PWA (Service Worker):** instalable y funcionando offline.

**Estrategia de cacheo:** como los archivos están separados, el Service Worker lee el índice principal al instalarse y pre-cachea los JSONs de alimentos para garantizar funcionamiento offline.

### 3.2 Gestión de datos: arquitectura de archivos distribuidos

En lugar de un único archivo monolítico, dividimos la información en dos capas:

1. **Índice maestro (`js/data.js`)**
   - Archivo ligero que se carga al inicio.
   - Contiene solo la información básica para listas y búsquedas (ID, nombre, categoría, icono, edad mínima, si es alérgeno) y la **ruta relativa** al JSON de detalle.
2. **Detalle del alimento (`data/foods/*.json`)**
   - Un JSON por alimento.
   - Contiene lo “pesado”: texturas, cortes por edad, advertencias, ideas de preparación y (si aplica) recetas sugeridas.

**Ventajas:**

- **Modularidad:** corregir un alimento no rompe el resto.
- **Rendimiento:** carga inicial rápida, detalle bajo demanda.

### 3.3 Estructura de archivos

```text
/
├── index.html       (SPA Container)
├── sw.js            (Service Worker - Lógica de cacheo de JSONs)
├── css/
│   └── styles.css
├── js/
│   ├── app.js       (Lógica principal)
│   ├── router.js    (Navegación)
│   ├── storage.js   (Gestión de localStorage)
│   └── data.js      (ÍNDICE MAESTRO: Lista de alimentos y rutas)
├── data/
│   └── foods/       (CARPETA DE DATOS MODULARES)
│       ├── aguacate.json
│       ├── platano.json
│       ├── huevo.json
│       └── ... (un archivo por alimento)
└── assets/
    └── images/      (SVGs y fotos)
```

---

## 4. Navegación por pestañas (Tabs)

Tabs principales (fijas abajo en móvil):

1. 📅 Calendario
2. ⚠️ Alergias
3. 🥦 Alimentos
4. 🍽️ Recetas
5. ℹ️ Info / Seguridad

Botón SOS siempre visible.

---

## 5. Pestaña 1: Calendario (vista principal)

### Objetivo

Registrar **qué se ha ofrecido**, **cómo**, **cuánto** y **reacción**.

### Vista calendario

- Vista mensual.
- Cada día muestra iconos:
  - 🥦 alimento
  - ⚠️ reacción
  - ❤️ le gustó

### Al tocar un día → formulario seguro

Campos:

- Alimento (seleccionable solo de lista segura)
- Cantidad: Exploración / Probó / Comió poco / Comió bien
- Forma: Entero blando / Bastones / Chafado
- Reacción: Le gustó / Neutral / No le gustó
- Observaciones (texto libre)

Si el alimento es alérgeno:
> “Introduce este alimento SOLO si el bebé está sano y durante el día.”

---

## 6. Pestaña 2: Checklist de alergias

Lista base de alérgenos comunes:

- Huevo
- Leche
- Pescado
- Marisco
- Trigo / gluten
- Soja
- Sésamo
- Frutos secos (polvo)

Para cada alérgeno:

- No introducido
- Introducido sin reacción
- Reacción leve
- Reacción grave (⚠️)

Si se marca reacción:
> “Consulta con tu pediatra antes de volver a ofrecerlo.”

---

## 7. Pestaña 3: Alimentos (por edad)

### Vista principal

Selector de edad:

- 6–7 meses
- 7–8 meses
- 8–9 meses
- 9–12 meses

### Lista de alimentos permitidos

Cada alimento muestra:

- Icono
- Nombre
- Nivel de dificultad
- Riesgo de atragantamiento (si aplica)

### Al hacer clic en un alimento → ficha detallada

Contenido mínimo de la ficha:

1. **Edad segura**
2. **Beneficios nutricionales** (breve)
3. **Formas seguras** (cortes con texto + icono/imagen)
4. **Qué NO hacer** (prohibidos claros)
5. **Advertencia**: “Las arcadas son normales, el atragantamiento NO.”

---

## 8. Pestaña 4: Recetas

### Características

- Recetas muy simples
- Máx. 3–5 ingredientes
- Sin sal, azúcar, miel

### Filtros

- Ingredientes incluidos
- Sin alérgenos seleccionados
- Edad del bebé

### Ficha de receta

- Ingredientes
- Preparación paso a paso
- Textura final esperada
- Cómo servir según edad

---

## 9. Pestaña 5: Info / Seguridad

Incluye:

- Recordatorio de fuentes y límites de la app (no sustituye pediatra)
- Reglas de edad, texturas y prohibidos
- Explicación arcadas vs atragantamiento

---

## 10. Funcionalidad: Botón SOS

Botón de emergencia visible siempre. Modal con:

1. Diferencia **Arcada** (ruidosa/roja) vs **Atragantamiento** (silencioso/azul).
2. Diagrama de maniobra de desobstrucción.
3. Llamada al 112/911.

---

## 11. Lógica de consumo de datos (Arquitectura modular)

### 11.1 Índice maestro (`js/data.js`)

Este archivo alimenta el buscador y la lista de categorías.

```javascript
// js/data.js
const FOOD_INDEX = [
  {
    id: "aguacate",
    nombre: "Aguacate",
    grupo: "fruta",
    edad_minima: 6,
    es_alergeno: false,
    icono: "🥑",
    path: "data/foods/aguacate.json"
  },
  {
    id: "huevo",

```
    nombre: "Huevo",
    grupo: "proteina",
    edad_minima: 6,
    es_alergeno: true,
    icono: "🥚",
    path: "data/foods/huevo.json"
  }
  // ... más alimentos
];
```

### 11.2 Detalle (`data/foods/*.json`)

Se carga mediante `fetch()` solo cuando el usuario abre el alimento.

```json
{
  "id": "aguacate",
  "nombre": "Aguacate",
  "info_nutricional": "Grasas saludables monoinsaturadas...",
  "nivel_riesgo": "bajo",
  "presentaciones": [
    {
      "edad_meses": 6,
      "titulo": "Bastón grande (Dedo)",
      "descripcion": "Corte vertical grueso. Debe deshacerse al apretar.",
      "seguro": true,
      "imagen": "assets/images/aguacate_baston.svg"
    }
  ],
  "prohibido": [
    "Trozos duros (si no está maduro)",
    "Bolitas pequeñas"
  ],
  "recetas_sugeridas": ["Guacamole sin sal", "Untado en pan"]
}
```

### 11.3 Ejemplo de carga (`js/app.js`)

```javascript
async function loadFoodDetail(foodId) {
  const foodIndexItem = FOOD_INDEX.find(f => f.id === foodId);
  if (!foodIndexItem) return console.error("Alimento no encontrado");

  try {
    const response = await fetch(foodIndexItem.path);
    if (!response.ok) throw new Error("Error cargando el archivo");

    const foodDetail = await response.json();
    renderFoodModal(foodDetail);
  } catch (error) {
    console.error("Error cargando alimento:", error);
  }
}
```

---

## 12. Persistencia local (Calendario y Alergias)

- **Persistencia:** `localStorage` para guardar historial y estados.
- **Relación:** el historial guarda IDs (ej: `comidas: [{id: "aguacate", fecha: "..."}]`). Para mostrar nombres/detalles, la app consulta `FOOD_INDEX`.

---

## 13. Accesibilidad y UX

- Tipografía grande
- Contraste alto
- Iconos claros
- Nada de colores “de alerta” sin motivo
- Modo oscuro opcional

---

## 14. Datos y privacidad

- Sin cuentas
- Sin nube
- Sin tracking
- Todo local
- Exportación opcional a JSON (y/o PDF en el futuro)

---

## 15. Backup

- Sistema “Human Backup”: exportar/importar JSON del historial.
- Los JSON de alimentos son públicos (parte de la app); los datos del bebé son privados (localStorage).

---

## 16. Cosas que explícitamente NO haré

- Recomendaciones médicas
- Consejos sin fuente
- “Trucos” virales
- Rankings de bebés
- Gamificación peligrosa

---

## 17. Evolución futura (no incluida ahora)

- Modo varios hijos
- Exportar para pediatra
- Idiomas
- Sincronización opcional

---

## 18. Hoja de ruta inmediata (Actualizada)

1. Crear la estructura de carpetas `data/foods/`.
2. Crear `js/data.js` con los primeros alimentos apuntando a sus rutas.
3. Crear los `.json` correspondientes dentro de `data/foods/`.
4. Implementar `loadFoodDetail` en `app.js` usando `fetch`.
5. Configurar el Service Worker para que intercepte estas rutas y permita uso offline.