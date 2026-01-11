# BLW Care

Aplicación web progresiva (PWA) para familias que practican **Baby-Led Weaning** (alimentación complementaria autorregulada).

## Características

- **Diario de alimentación**: Calendario mensual para registrar los alimentos que prueba tu bebé
- **Control de alergias**: Seguimiento del estado de los 14 alérgenos principales
- **Base de datos de alimentos**: +50 alimentos con información nutricional, presentaciones seguras por edad y advertencias
- **Recetas**: 18 recetas adaptadas a BLW sin sal, azúcar ni miel
- **Botón SOS**: Guía rápida de emergencia para atragantamiento con maniobra de desobstrucción
- **Funciona offline**: Todos los datos se guardan localmente en tu dispositivo
- **Sin registro**: No requiere cuenta ni envía datos a ningún servidor

## Seguridad

La app implementa múltiples medidas de seguridad:

- **Hitos motores obligatorios**: No permite registrar alimentos hasta que el bebé cumpla los 4 hitos de desarrollo
- **Edad segura**: Calcula automáticamente la edad del bebé (con soporte para edad corregida en prematuros)
- **Filtrado por edad**: Oculta alimentos no recomendados según la edad del bebé
- **Advertencias de alérgenos**: Identifica y alerta sobre alimentos alergénicos
- **Fuentes verificadas**: Toda la información proviene de fuentes médicas oficiales

## Fuentes

- [OMS (WHO)](https://www.who.int/health-topics/complementary-feeding) - Recomendaciones de alimentación complementaria
- [AEP](https://www.aeped.es/comite-nutricion-y-lactancia-materna) - Asociación Española de Pediatría
- [NHS UK](https://www.nhs.uk/start-for-life/baby/weaning/) - Servicio Nacional de Salud británico
- [Solid Starts](https://solidstarts.com/) - Base de datos de alimentos BLW
- [AESAN](https://www.aesan.gob.es/) - Agencia Española de Seguridad Alimentaria

## Tecnología

- HTML5, CSS3, JavaScript (Vanilla)
- Progressive Web App (PWA) con Service Worker
- Almacenamiento local (localStorage)
- Sin dependencias externas ni frameworks

## Instalación

### Como PWA (recomendado)

1. Abre la app en tu navegador móvil
2. Pulsa "Añadir a pantalla de inicio" o "Instalar"
3. La app funcionará como una aplicación nativa

### Desarrollo local

```bash
# Clonar el repositorio
git clone https://github.com/tu-usuario/blwapp.git
cd blwapp

# Servir con cualquier servidor HTTP estático
npx serve
# o
python -m http.server 8080
```

## Imágenes offline (descargar en local)

Si has añadido imágenes remotas (por ejemplo, Unsplash) en `data/foods/*.json` y quieres que funcionen **offline**, puedes descargarlas al proyecto y actualizar los JSON para que apunten a rutas locales.

1) Ejecuta el script:

```bash
python scripts/localize_food_images.py
```

2) Resultado:
- Descarga imágenes a `assets/images/foods/<food_id>/...`
- Reescribe `imagen_alimento` y `presentaciones[].imagen` en los JSON para apuntar a rutas locales
- Genera `data/images/food-images.json` para que el Service Worker pueda precachear las imágenes

Opciones útiles:
- `--dry-run` (solo reporta, no descarga ni modifica)
- `--force` (re-descarga aunque ya exista)
- `--proxy weserv` (usa un proxy de imágenes si el host original da `503`/rate-limit)

## Estructura del proyecto

```
blwapp/
├── index.html          # Aplicación SPA
├── manifest.json       # Configuración PWA
├── sw.js              # Service Worker
├── css/
│   └── styles.css     # Estilos
├── js/
│   ├── app.js         # Lógica principal
│   ├── data.js        # Índice de alimentos
│   ├── router.js      # Navegación SPA
│   └── storage.js     # Persistencia localStorage
├── data/
│   ├── foods/         # JSONs de alimentos (51 archivos)
│   └── recipes/       # JSONs de recetas (18 archivos)
└── assets/
    ├── icons/         # Iconos PWA
    └── images/        # Imágenes de presentación
```

## Uso

1. **Configura el perfil del bebé** en la pestaña "Info" (fecha de nacimiento)
2. **Completa los hitos motores** en "Info / Seguridad"
3. **Registra alimentos** en el "Diario" pulsando en un día del calendario
4. **Consulta alimentos** en la pestaña "Alimentos" para ver presentaciones seguras
5. **Registra reacciones alérgicas** en la pestaña "Alergias"

## Aviso legal

Esta aplicación es **informativa** y **no sustituye al pediatra**. Ante cualquier duda sobre la alimentación de tu bebé, consulta con un profesional sanitario.

## Licencia

MIT

---

Desarrollada con ❤️ para familias BLW
