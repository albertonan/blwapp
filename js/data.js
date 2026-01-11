/* Índice maestro de alimentos (ligero): usado para listar/buscar y para resolver rutas a JSONs de detalle.
   Nota: se define en el scope global (window/self) para poder ser consumido también por el Service Worker vía importScripts().
   
   Fuentes oficiales consultadas:
   - OMS/WHO: https://www.who.int/health-topics/complementary-feeding
   - AEP (Asociación Española de Pediatría): https://www.aeped.es/comite-nutricion-y-lactancia-materna/nutricion-infantil/documentos/recomendaciones-sobre-alimentacion
   - NHS UK: https://www.nhs.uk/start-for-life/weaning/
   - Solid Starts: https://solidstarts.com/foods/ (apoyo visual)
*/
(function (global) {
  global.FOOD_INDEX = [
    // ═══════════════════════════════════════════════════════════════
    // FRUTAS
    // ═══════════════════════════════════════════════════════════════
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
      id: "platano",
      nombre: "Plátano",
      grupo: "fruta",
      edad_minima: 6,
      es_alergeno: false,
      icono: "🍌",
      path: "data/foods/platano.json"
    },
    {
      id: "manzana",
      nombre: "Manzana",
      grupo: "fruta",
      edad_minima: 6,
      es_alergeno: false,
      icono: "🍎",
      path: "data/foods/manzana.json"
    },
    {
      id: "pera",
      nombre: "Pera",
      grupo: "fruta",
      edad_minima: 6,
      es_alergeno: false,
      icono: "🍐",
      path: "data/foods/pera.json"
    },
    {
      id: "melocoton",
      nombre: "Melocotón",
      grupo: "fruta",
      edad_minima: 6,
      es_alergeno: false,
      icono: "🍑",
      path: "data/foods/melocoton.json"
    },
    {
      id: "ciruela",
      nombre: "Ciruela",
      grupo: "fruta",
      edad_minima: 6,
      es_alergeno: false,
      icono: "🟣",
      path: "data/foods/ciruela.json"
    },
    {
      id: "mango",
      nombre: "Mango",
      grupo: "fruta",
      edad_minima: 6,
      es_alergeno: false,
      icono: "🥭",
      path: "data/foods/mango.json"
    },
    {
      id: "sandia",
      nombre: "Sandía",
      grupo: "fruta",
      edad_minima: 6,
      es_alergeno: false,
      icono: "🍉",
      path: "data/foods/sandia.json"
    },
    {
      id: "melon",
      nombre: "Melón",
      grupo: "fruta",
      edad_minima: 6,
      es_alergeno: false,
      icono: "🍈",
      path: "data/foods/melon.json"
    },
    {
      id: "fresas",
      nombre: "Fresas",
      grupo: "fruta",
      edad_minima: 6,
      es_alergeno: false,
      icono: "🍓",
      path: "data/foods/fresas.json"
    },
    {
      id: "arandanos",
      nombre: "Arándanos",
      grupo: "fruta",
      edad_minima: 6,
      es_alergeno: false,
      icono: "🫐",
      path: "data/foods/arandanos.json"
    },
    {
      id: "kiwi",
      nombre: "Kiwi",
      grupo: "fruta",
      edad_minima: 8,
      es_alergeno: false,
      icono: "🥝",
      path: "data/foods/kiwi.json"
    },
    {
      id: "naranja",
      nombre: "Naranja",
      grupo: "fruta",
      edad_minima: 6,
      es_alergeno: false,
      icono: "🍊",
      path: "data/foods/naranja.json"
    },
    // ═══════════════════════════════════════════════════════════════
    // VERDURAS Y HORTALIZAS
    // ═══════════════════════════════════════════════════════════════
    {
      id: "zanahoria",
      nombre: "Zanahoria",
      grupo: "verdura",
      edad_minima: 6,
      es_alergeno: false,
      icono: "🥕",
      path: "data/foods/zanahoria.json"
    },
    {
      id: "brocoli",
      nombre: "Brócoli",
      grupo: "verdura",
      edad_minima: 6,
      es_alergeno: false,
      icono: "🥦",
      path: "data/foods/brocoli.json"
    },
    {
      id: "calabacin",
      nombre: "Calabacín",
      grupo: "verdura",
      edad_minima: 6,
      es_alergeno: false,
      icono: "🥒",
      path: "data/foods/calabacin.json"
    },
    {
      id: "calabaza",
      nombre: "Calabaza",
      grupo: "verdura",
      edad_minima: 6,
      es_alergeno: false,
      icono: "🎃",
      path: "data/foods/calabaza.json"
    },
    {
      id: "patata",
      nombre: "Patata",
      grupo: "verdura",
      edad_minima: 6,
      es_alergeno: false,
      icono: "🥔",
      path: "data/foods/patata.json"
    },
    {
      id: "boniato",
      nombre: "Boniato / Batata",
      grupo: "verdura",
      edad_minima: 6,
      es_alergeno: false,
      icono: "🍠",
      path: "data/foods/boniato.json"
    },
    {
      id: "judias_verdes",
      nombre: "Judías verdes",
      grupo: "verdura",
      edad_minima: 6,
      es_alergeno: false,
      icono: "🫛",
      path: "data/foods/judias_verdes.json"
    },
    {
      id: "guisantes",
      nombre: "Guisantes",
      grupo: "verdura",
      edad_minima: 6,
      es_alergeno: false,
      icono: "🟢",
      path: "data/foods/guisantes.json"
    },
    {
      id: "coliflor",
      nombre: "Coliflor",
      grupo: "verdura",
      edad_minima: 6,
      es_alergeno: false,
      icono: "🤍",
      path: "data/foods/coliflor.json"
    },
    {
      id: "espinacas",
      nombre: "Espinacas",
      grupo: "verdura",
      edad_minima: 9,
      es_alergeno: false,
      icono: "🥬",
      path: "data/foods/espinacas.json"
    },
    {
      id: "acelgas",
      nombre: "Acelgas",
      grupo: "verdura",
      edad_minima: 12,
      es_alergeno: false,
      icono: "🥬",
      path: "data/foods/acelgas.json"
    },
    {
      id: "tomate",
      nombre: "Tomate",
      grupo: "verdura",
      edad_minima: 6,
      es_alergeno: false,
      icono: "🍅",
      path: "data/foods/tomate.json"
    },
    {
      id: "pepino",
      nombre: "Pepino",
      grupo: "verdura",
      edad_minima: 9,
      es_alergeno: false,
      icono: "🥒",
      path: "data/foods/pepino.json"
    },
    // ═══════════════════════════════════════════════════════════════
    // PROTEÍNAS
    // ═══════════════════════════════════════════════════════════════
    {
      id: "huevo",
      nombre: "Huevo",
      grupo: "proteina",
      edad_minima: 6,
      es_alergeno: true,
      icono: "🥚",
      path: "data/foods/huevo.json"
    },
    {
      id: "pollo",
      nombre: "Pollo",
      grupo: "proteina",
      edad_minima: 6,
      es_alergeno: false,
      icono: "🍗",
      path: "data/foods/pollo.json"
    },
    {
      id: "pavo",
      nombre: "Pavo",
      grupo: "proteina",
      edad_minima: 6,
      es_alergeno: false,
      icono: "🦃",
      path: "data/foods/pavo.json"
    },
    {
      id: "ternera",
      nombre: "Ternera",
      grupo: "proteina",
      edad_minima: 6,
      es_alergeno: false,
      icono: "🥩",
      path: "data/foods/ternera.json"
    },
    {
      id: "cerdo",
      nombre: "Cerdo",
      grupo: "proteina",
      edad_minima: 6,
      es_alergeno: false,
      icono: "🐷",
      path: "data/foods/cerdo.json"
    },
    {
      id: "cordero",
      nombre: "Cordero",
      grupo: "proteina",
      edad_minima: 6,
      es_alergeno: false,
      icono: "🐑",
      path: "data/foods/cordero.json"
    },
    {
      id: "salmon",
      nombre: "Salmón",
      grupo: "pescado",
      edad_minima: 6,
      es_alergeno: true,
      icono: "🐟",
      path: "data/foods/salmon.json"
    },
    {
      id: "merluza",
      nombre: "Merluza",
      grupo: "pescado",
      edad_minima: 6,
      es_alergeno: true,
      icono: "🐟",
      path: "data/foods/merluza.json"
    },
    {
      id: "lenguado",
      nombre: "Lenguado",
      grupo: "pescado",
      edad_minima: 6,
      es_alergeno: true,
      icono: "🐟",
      path: "data/foods/lenguado.json"
    },
    {
      id: "atun_fresco",
      nombre: "Atún fresco",
      grupo: "pescado",
      edad_minima: 10,
      es_alergeno: true,
      icono: "🐟",
      path: "data/foods/atun_fresco.json"
    },
    {
      id: "lentejas",
      nombre: "Lentejas",
      grupo: "legumbre",
      edad_minima: 6,
      es_alergeno: false,
      icono: "🫘",
      path: "data/foods/lentejas.json"
    },
    {
      id: "garbanzos",
      nombre: "Garbanzos",
      grupo: "legumbre",
      edad_minima: 6,
      es_alergeno: false,
      icono: "🫘",
      path: "data/foods/garbanzos.json"
    },
    {
      id: "alubias",
      nombre: "Alubias / Judías blancas",
      grupo: "legumbre",
      edad_minima: 6,
      es_alergeno: false,
      icono: "🫘",
      path: "data/foods/alubias.json"
    },
    {
      id: "tofu",
      nombre: "Tofu",
      grupo: "proteina",
      edad_minima: 6,
      es_alergeno: true,
      icono: "🧈",
      path: "data/foods/tofu.json"
    },
    // ═══════════════════════════════════════════════════════════════
    // LÁCTEOS
    // ═══════════════════════════════════════════════════════════════
    {
      id: "yogur",
      nombre: "Yogur natural",
      grupo: "lacteo",
      edad_minima: 6,
      es_alergeno: true,
      icono: "🥣",
      path: "data/foods/yogur.json"
    },
    {
      id: "queso_fresco",
      nombre: "Queso fresco",
      grupo: "lacteo",
      edad_minima: 6,
      es_alergeno: true,
      icono: "🧀",
      path: "data/foods/queso_fresco.json"
    },
    {
      id: "queso_tierno",
      nombre: "Queso tierno",
      grupo: "lacteo",
      edad_minima: 9,
      es_alergeno: true,
      icono: "🧀",
      path: "data/foods/queso_tierno.json"
    },
    // ═══════════════════════════════════════════════════════════════
    // CEREALES Y CARBOHIDRATOS
    // ═══════════════════════════════════════════════════════════════
    {
      id: "arroz",
      nombre: "Arroz",
      grupo: "cereal",
      edad_minima: 6,
      es_alergeno: false,
      icono: "🍚",
      path: "data/foods/arroz.json"
    },
    {
      id: "avena",
      nombre: "Avena",
      grupo: "cereal",
      edad_minima: 6,
      es_alergeno: true,
      icono: "🌾",
      path: "data/foods/avena.json"
    },
    {
      id: "pasta",
      nombre: "Pasta",
      grupo: "cereal",
      edad_minima: 6,
      es_alergeno: true,
      icono: "🍝",
      path: "data/foods/pasta.json"
    },
    {
      id: "pan",
      nombre: "Pan",
      grupo: "cereal",
      edad_minima: 6,
      es_alergeno: true,
      icono: "🍞",
      path: "data/foods/pan.json"
    },
    {
      id: "quinoa",
      nombre: "Quinoa",
      grupo: "cereal",
      edad_minima: 6,
      es_alergeno: false,
      icono: "🌾",
      path: "data/foods/quinoa.json"
    },
    // ═══════════════════════════════════════════════════════════════
    // FRUTOS SECOS (solo en polvo/harina hasta 3-4 años)
    // ═══════════════════════════════════════════════════════════════
    {
      id: "almendra_polvo",
      nombre: "Almendra (polvo/harina)",
      grupo: "fruto_seco",
      edad_minima: 6,
      es_alergeno: true,
      icono: "🥜",
      path: "data/foods/almendra_polvo.json"
    },
    {
      id: "cacahuete_polvo",
      nombre: "Cacahuete (polvo/mantequilla)",
      grupo: "fruto_seco",
      edad_minima: 6,
      es_alergeno: true,
      icono: "🥜",
      path: "data/foods/cacahuete_polvo.json"
    },
    // ═══════════════════════════════════════════════════════════════
    // OTROS
    // ═══════════════════════════════════════════════════════════════
    {
      id: "aceite_oliva",
      nombre: "Aceite de oliva virgen extra",
      grupo: "grasa",
      edad_minima: 6,
      es_alergeno: false,
      icono: "🫒",
      path: "data/foods/aceite_oliva.json"
    }
  ];
})(typeof self !== "undefined" ? self : window);
