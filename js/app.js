function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getFoodIndex() {
  if (!Array.isArray(window.FOOD_INDEX)) return [];
  return window.FOOD_INDEX;
}

function parseAgeRange(value) {
  if (value === "6-7") return { min: 6, maxExclusive: 8 };
  if (value === "7-8") return { min: 7, maxExclusive: 9 };
  if (value === "8-9") return { min: 8, maxExclusive: 10 };
  if (value === "9-12") return { min: 9, maxExclusive: 13 };
  return null;
}

let recipeIndexCache = null;

async function loadRecipeIndex() {
  if (recipeIndexCache) return recipeIndexCache;
  const resp = await fetch("./data/recipes/index.json", { cache: "no-cache" });
  if (!resp.ok) throw new Error("No se pudo cargar índice de recetas");
  const json = await resp.json();
  const recipes = Array.isArray(json.recipes) ? json.recipes : [];
  recipeIndexCache = recipes;
  return recipes;
}

function getReactiveAllergenIds() {
  if (!window.StorageApi?.allergens?.getAll) return new Set();
  const statuses = window.StorageApi.allergens.getAll();
  const reactive = Object.entries(statuses)
    .filter(([, v]) => v === "mild" || v === "severe")
    .map(([k]) => k);
  return new Set(reactive);
}

function recipeMatchesIngredient(recipe, query) {
  if (!query) return true;
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const list = Array.isArray(recipe.ingredientes) ? recipe.ingredientes : [];
  return (
    String(recipe.nombre || "").toLowerCase().includes(q) ||
    list.some((x) => String(x).toLowerCase().includes(q))
  );
}

function renderRecipeNote() {
  const note = document.getElementById("recipe-note");
  if (!note) return;
  const safeMonths = getProfileSafeAgeMonths();
  if (safeMonths === null) {
    note.textContent = "Para ver recetas, completa el perfil del bebé (ℹ️) para calcular la edad segura.";
    return;
  }
  note.textContent = `Edad segura actual: ${safeMonths} meses.`;
}

async function renderRecipeList() {
  const list = document.getElementById("recipe-list");
  if (!list) return;

  renderRecipeNote();

  const safeMonths = getProfileSafeAgeMonths();
  if (safeMonths === null) {
    list.innerHTML = "";
    return;
  }

  const qEl = document.getElementById("recipe-ingredient");
  const q = qEl ? qEl.value : "";

  const ageEl = document.getElementById("recipe-age-filter");
  const ageFilter = ageEl ? ageEl.value : "safe";
  const range = parseAgeRange(ageFilter);

  const excludeReactiveEl = document.getElementById("recipe-exclude-reactive");
  const excludeReactive = !!excludeReactiveEl?.checked;
  const reactiveAllergens = excludeReactive ? getReactiveAllergenIds() : new Set();

  let recipes = [];
  try {
    recipes = await loadRecipeIndex();
  } catch (e) {
    console.error(e);
    list.innerHTML = '<li class="muted">No se pudieron cargar las recetas (¿offline sin precache?).</li>';
    return;
  }

  const items = recipes.filter((r) => {
    const minAge = Number(r.edad_minima);
    if (Number.isFinite(minAge) && minAge > safeMonths) return false;

    if (range) {
      if (!Number.isFinite(minAge)) return false;
      if (!(minAge >= range.min && minAge < range.maxExclusive)) return false;
    }

    if (!recipeMatchesIngredient(r, q)) return false;

    if (excludeReactive) {
      const allergens = Array.isArray(r.alergenos) ? r.alergenos : [];
      if (allergens.some((a) => reactiveAllergens.has(a))) return false;
    }

    return true;
  });

  list.innerHTML = "";
  for (const recipe of items) {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "list-item";
    btn.dataset.recipeId = recipe.id;
    const allergens = Array.isArray(recipe.alergenos) ? recipe.alergenos : [];
    btn.innerHTML = `
      <span class="item-icon" aria-hidden="true">🍽️</span>
      <span>
        <div class="item-title">${escapeHtml(recipe.nombre || recipe.id)}</div>
        <div class="item-meta">desde ${escapeHtml(recipe.edad_minima)}m${allergens.length ? ` · alérgenos: ${escapeHtml(allergens.join(", "))}` : ""}</div>
      </span>
    `;
    li.appendChild(btn);
    list.appendChild(li);
  }
}

async function openRecipeModal(recipeId) {
  try {
    const recipes = await loadRecipeIndex();
    const item = recipes.find((r) => r.id === recipeId);
    if (!item) throw new Error("Receta no encontrada");

    const resp = await fetch(`./${item.path}`, { cache: "no-cache" });
    if (!resp.ok) throw new Error("No se pudo cargar receta");
    const detail = await resp.json();

    const ingredients = Array.isArray(detail.ingredientes) ? detail.ingredientes : [];
    const steps = Array.isArray(detail.preparacion) ? detail.preparacion : [];
    const serve = Array.isArray(detail.como_servir) ? detail.como_servir : [];
    const safety = Array.isArray(detail.notas_seguridad) ? detail.notas_seguridad : [];
    const allergens = Array.isArray(detail.alergenos) ? detail.alergenos : [];

    const bodyHtml = `
      <div class="kv">
        <div class="k">Edad mínima</div><div>Desde ${escapeHtml(detail.edad_minima)} meses</div>
        <div class="k">Alérgenos</div><div>${allergens.length ? escapeHtml(allergens.join(", ")) : "-"}</div>
      </div>

      ${ingredients.length ? `<h4 style="margin:14px 0 8px">Ingredientes</h4><ul>${ingredients
        .map((x) => `<li>${escapeHtml(x)}</li>`)
        .join("")}</ul>` : ""}

      ${steps.length ? `<h4 style="margin:14px 0 8px">Preparación</h4><ol>${steps
        .map((x) => `<li>${escapeHtml(x)}</li>`)
        .join("")}</ol>` : ""}

      ${detail.textura ? `<h4 style="margin:14px 0 8px">Textura</h4><p class="muted">${escapeHtml(detail.textura)}</p>` : ""}

      ${serve.length ? `<h4 style="margin:14px 0 8px">Cómo servir</h4><ul>${serve
        .map((x) => `<li>${escapeHtml(x)}</li>`)
        .join("")}</ul>` : ""}

      ${safety.length ? `<h4 style="margin:14px 0 8px">Notas de seguridad</h4><ul>${safety
        .map((x) => `<li>${escapeHtml(x)}</li>`)
        .join("")}</ul>` : ""}
    `;

    openModal(detail.nombre || "Receta", bodyHtml);
  } catch (e) {
    console.error(e);
    openModal("No se pudo cargar", '<p class="muted">No se pudo cargar la receta. Si estás offline, revisa que la app haya sido abierta al menos una vez con conexión para precachear.</p>');
  }
}

function renderFoodAgeNote() {
  const note = document.getElementById("food-age-note");
  if (!note) return;

  const safeMonths = getProfileSafeAgeMonths();
  if (safeMonths === null) {
    note.textContent = "Para ver alimentos, completa el perfil del bebé (ℹ️) para calcular la edad segura.";
    return;
  }
  note.textContent = `Edad segura actual: ${safeMonths} meses.`;
}

function renderFoodList(filterText) {
  const list = document.getElementById("food-list");
  const q = (filterText || "").trim().toLowerCase();

  const safeMonths = getProfileSafeAgeMonths();
  const ageFilterEl = document.getElementById("food-age-filter");
  const ageFilter = ageFilterEl ? ageFilterEl.value : "safe";
  const range = parseAgeRange(ageFilter);

  renderFoodAgeNote();

  if (safeMonths === null) {
    list.innerHTML = "";
    return;
  }

  const items = getFoodIndex().filter((f) => {
    // Filtro estricto por edad segura
    if (Number(f.edad_minima) > safeMonths) return false;

    // Selector por edad (opcional). Si es "safe", no filtra por rango.
    if (range) {
      const min = Number(f.edad_minima);
      if (!Number.isFinite(min)) return false;
      if (!(min >= range.min && min < range.maxExclusive)) return false;
    }

    if (!q) return true;
    return (
      f.nombre.toLowerCase().includes(q) ||
      f.id.toLowerCase().includes(q) ||
      String(f.grupo || "").toLowerCase().includes(q)
    );
  });

  list.innerHTML = "";
  for (const food of items) {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "list-item";
    btn.dataset.foodId = food.id;

    btn.innerHTML = `
      <span class="item-icon" aria-hidden="true">${escapeHtml(food.icono || "🍽️")}</span>
      <span>
        <div class="item-title">${escapeHtml(food.nombre)}</div>
        <div class="item-meta">${escapeHtml(food.grupo || "")} · desde ${escapeHtml(food.edad_minima)}m${food.es_alergeno ? " · alérgeno" : ""}</div>
      </span>
    `;

    li.appendChild(btn);
    list.appendChild(li);
  }
}

function closeModal() {
  const root = document.getElementById("modal-root");
  const lastFocus = root && root.dataset && root.dataset.returnFocusId ? root.dataset.returnFocusId : "";
  root.innerHTML = "";
  root.removeAttribute("data-return-focus-id");
  if (lastFocus) {
    const el = document.getElementById(lastFocus);
    if (el && typeof el.focus === "function") el.focus();
  }
}

function openModal(title, bodyHtml) {
  const root = document.getElementById("modal-root");
  const active = document.activeElement;
  if (active && active.id) {
    root.dataset.returnFocusId = active.id;
  } else {
    root.removeAttribute("data-return-focus-id");
  }

  root.innerHTML = `
    <div class="modal-backdrop" data-close="true"></div>
    <div class="modal" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
      <div class="modal-header">
        <h3 class="modal-title">${escapeHtml(title)}</h3>
        <button class="modal-close" type="button" data-close="true">Cerrar</button>
      </div>
      <div class="modal-body">${bodyHtml}</div>
    </div>
  `;

  root.querySelectorAll('[data-close="true"]').forEach((el) => {
    el.addEventListener("click", closeModal);
  });

  // Focus management
  const modal = root.querySelector(".modal");
  const closeBtn = root.querySelector(".modal-close");
  if (closeBtn && typeof closeBtn.focus === "function") {
    closeBtn.focus();
  } else if (modal && typeof modal.focus === "function") {
    modal.setAttribute("tabindex", "-1");
    modal.focus();
  }

  // Basic focus trap
  function getFocusable() {
    if (!modal) return [];
    return Array.from(
      modal.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    ).filter((el) => el.offsetParent !== null);
  }

  if (modal) {
    modal.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeModal();
        return;
      }
      if (e.key !== "Tab") return;
      const focusable = getFocusable();
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    });
  }
}

function renderFoodModal(foodDetail) {
  const presentaciones = Array.isArray(foodDetail.presentaciones) ? foodDetail.presentaciones : [];
  const prohibido = Array.isArray(foodDetail.prohibido) ? foodDetail.prohibido : [];
  const recetas = Array.isArray(foodDetail.recetas_sugeridas) ? foodDetail.recetas_sugeridas : [];

  const edadMin = foodDetail.edad_minima ?? foodDetail.edad_segura_meses ?? "-";

  const presHtml = presentaciones
    .map((p) => {
      const img = p.imagen
        ? `<div><img src="${escapeHtml(p.imagen)}" alt="" style="max-width:100%;height:auto;border:1px solid var(--border);border-radius:12px" /></div>`
        : "";

      return `
        <div class="card">
          <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start">
            <div>
              <div style="font-weight:700">${escapeHtml(p.titulo || "Presentación")}</div>
              <div class="muted" style="font-size:12px">Desde ${escapeHtml(p.edad_meses)} meses · ${p.seguro ? "seguro" : "precaución"}</div>
            </div>
          </div>
          <p style="margin:10px 0 0">${escapeHtml(p.descripcion || "")}</p>
          ${img}
        </div>
      `;
    })
    .join("");

  const bodyHtml = `
    <div class="kv">
      <div class="k">Edad segura</div><div>Desde ${escapeHtml(edadMin)} meses</div>
      <div class="k">Riesgo</div><div>${escapeHtml(foodDetail.nivel_riesgo || "-")}</div>
      <div class="k">Nutrición</div><div>${escapeHtml(foodDetail.info_nutricional || "-")}</div>
    </div>

    ${presHtml ? `<h4 style="margin:14px 0 8px">Presentaciones</h4>${presHtml}` : ""}

    ${prohibido.length ? `<h4 style="margin:14px 0 8px">Evitar</h4><ul>${prohibido.map(x => `<li>${escapeHtml(x)}</li>`).join("")}</ul>` : ""}

    ${recetas.length ? `<h4 style="margin:14px 0 8px">Ideas</h4><ul>${recetas.map(x => `<li>${escapeHtml(x)}</li>`).join("")}</ul>` : ""}

    <div class="card" style="margin-top:12px">
      <b>Advertencia:</b> Las arcadas son normales, el atragantamiento NO.
    </div>
  `;

  openModal(foodDetail.nombre || "Detalle", bodyHtml);
}

async function loadFoodDetail(foodId) {
  const foodIndexItem = getFoodIndex().find((f) => f.id === foodId);
  if (!foodIndexItem) {
    console.error("Alimento no encontrado");
    return;
  }

  try {
    const response = await fetch(foodIndexItem.path, { cache: "no-cache" });
    if (!response.ok) throw new Error("Error cargando el archivo");

    const foodDetail = await response.json();
    renderFoodModal(foodDetail);
  } catch (error) {
    console.error("Error cargando alimento:", error);
    openModal(
      "No se pudo cargar",
      `<p class="muted">No se pudo cargar el detalle de <b>${escapeHtml(foodIndexItem.nombre)}</b>. Si estás offline, revisa que la app haya sido abierta al menos una vez con conexión para precachear.</p>`
    );
  }
}

function openSosModal() {
  const bodyHtml = `
    <div class="alert alert-danger" style="margin-top:0">
      <span class="alert-icon">🚨</span>
      <div>
        <strong>¿Tu bebé se está atragantando?</strong><br>
        Si no puede toser, llorar ni respirar, <strong>actúa AHORA</strong>.
      </div>
    </div>

    <div class="card" style="margin-bottom:12px">
      <h4 style="margin:0 0 12px;font-size:1rem">🔄 ¿Arcada o Atragantamiento?</h4>
      
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div style="padding:12px;background:var(--success-light);border-radius:var(--radius);border:1px solid var(--success)">
          <strong style="color:var(--success)">✅ ARCADA (Normal)</strong>
          <ul style="margin:8px 0 0;padding-left:16px;font-size:0.8125rem">
            <li>Ruidosa, tose</li>
            <li>Cara roja</li>
            <li>Ojos llorosos</li>
            <li>Respira bien</li>
          </ul>
          <p style="margin:8px 0 0;font-size:0.75rem;color:var(--success)"><strong>NO intervenir</strong></p>
        </div>
        
        <div style="padding:12px;background:var(--danger-light);border-radius:var(--radius);border:1px solid var(--danger)">
          <strong style="color:var(--danger)">🚨 ATRAGANTAMIENTO</strong>
          <ul style="margin:8px 0 0;padding-left:16px;font-size:0.8125rem">
            <li>Silencioso</li>
            <li>Cara azul/pálida</li>
            <li>No puede toser</li>
            <li>No respira</li>
          </ul>
          <p style="margin:8px 0 0;font-size:0.75rem;color:var(--danger)"><strong>ACTUAR YA</strong></p>
        </div>
      </div>
    </div>

    <div class="card" style="margin-bottom:12px;background:var(--warning-light);border:1px solid var(--warning)">
      <h4 style="margin:0 0 12px;font-size:1rem;color:#92400e">🆘 MANIOBRA DE DESOBSTRUCCIÓN (&lt;1 año)</h4>
      
      <div style="font-size:0.875rem">
        <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:12px;padding:12px;background:var(--bg-card);border-radius:var(--radius)">
          <div style="font-size:1.5rem;flex-shrink:0">1️⃣</div>
          <div>
            <strong>5 GOLPES EN LA ESPALDA</strong><br>
            <span style="font-size:0.8125rem">Tumba al bebé boca abajo sobre tu antebrazo, cabeza más baja que el cuerpo. Da 5 golpes secos entre los omóplatos con el talón de tu mano.</span>
          </div>
        </div>
        
        <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:12px;padding:12px;background:var(--bg-card);border-radius:var(--radius)">
          <div style="font-size:1.5rem;flex-shrink:0">2️⃣</div>
          <div>
            <strong>5 COMPRESIONES TORÁCICAS</strong><br>
            <span style="font-size:0.8125rem">Gira al bebé boca arriba. Con 2 dedos en el centro del pecho (entre los pezones), haz 5 compresiones rápidas hacia abajo.</span>
          </div>
        </div>
        
        <div style="display:flex;align-items:flex-start;gap:12px;padding:12px;background:var(--bg-card);border-radius:var(--radius)">
          <div style="font-size:1.5rem;flex-shrink:0">🔄</div>
          <div>
            <strong>REPITE</strong><br>
            <span style="font-size:0.8125rem">Alterna 5 golpes + 5 compresiones hasta que expulse el objeto o llegue ayuda. Si pierde el conocimiento, inicia RCP.</span>
          </div>
        </div>
      </div>
      
      <p style="margin:12px 0 0;font-size:0.75rem;color:#92400e">
        <strong>⚠️ NUNCA introduzcas los dedos en la boca a ciegas.</strong><br>
        Fuente: <a href="https://www.redcross.org.uk/first-aid/learn-first-aid/choking-child" target="_blank" rel="noopener" style="color:#92400e">Cruz Roja</a>
      </p>
    </div>

    <div class="card" style="margin-bottom:0">
      <h4 style="margin:0 0 8px;font-size:1rem">📞 Números de emergencia</h4>
      <div style="display:flex;flex-direction:column;gap:8px">
        <a class="call" href="tel:112" style="margin:0">🇪🇺 Europa: 112</a>
        <a class="call" href="tel:911" style="margin:0;background:#1e40af">🇺🇸 USA/México: 911</a>
        <a class="call" href="tel:999" style="margin:0;background:#059669">🇬🇧 UK: 999</a>
      </div>
    </div>

    <p class="muted" style="margin:12px 0 0;font-size:0.75rem;text-align:center">
      Este panel es informativo y no sustituye formación certificada en primeros auxilios.
    </p>
  `;

  openModal("🆘 EMERGENCIA - Atragantamiento", bodyHtml);
}

function parseDateInput(value) {
  if (!value) return null;
  // Interpret YYYY-MM-DD as UTC midnight to avoid timezone shifts.
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function monthsBetweenUtc(startDate, endDate) {
  if (!(startDate instanceof Date) || !(endDate instanceof Date)) return 0;
  const y1 = startDate.getUTCFullYear();
  const m1 = startDate.getUTCMonth();
  const d1 = startDate.getUTCDate();
  const y2 = endDate.getUTCFullYear();
  const m2 = endDate.getUTCMonth();
  const d2 = endDate.getUTCDate();

  let months = (y2 - y1) * 12 + (m2 - m1);
  if (d2 < d1) months -= 1;
  return Math.max(0, months);
}

function getSafeAgeMonths(profile) {
  if (!profile || typeof profile !== "object") return null;

  const birth = parseDateInput(profile.birthDate);
  if (!birth) return null;

  const gestationWeeks = Number(profile.gestationWeeks);
  const isPreterm = Number.isFinite(gestationWeeks) && gestationWeeks > 0 && gestationWeeks < 37;

  const due = parseDateInput(profile.dueDate);
  const baseDate = isPreterm && due ? due : birth;

  const now = new Date();
  const nowUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return monthsBetweenUtc(baseDate, nowUtc);
}

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function dateToYmdUtc(d) {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

function getProfileSafeAgeMonths() {
  const profile = window.StorageApi?.babyProfile?.get ? window.StorageApi.babyProfile.get() : null;
  const safeMonths = getSafeAgeMonths(profile);
  return safeMonths;
}

function getAllowedFoodsBySafeAge() {
  const safeMonths = getProfileSafeAgeMonths();
  if (safeMonths === null) return [];
  return getFoodIndex().filter((f) => Number(f.edad_minima) <= safeMonths);
}

const ALLERGENS = [
  { id: "huevo", label: "Huevo" },
  { id: "leche", label: "Leche" },
  { id: "pescado", label: "Pescado" },
  { id: "marisco", label: "Marisco" },
  { id: "gluten", label: "Trigo / gluten" },
  { id: "soja", label: "Soja" },
  { id: "sesamo", label: "Sésamo" },
  { id: "frutos_secos", label: "Frutos secos (polvo)" }
];

function allergenIdForFood(foodId) {
  // Mapeo mínimo según los alimentos actuales.
  if (foodId === "huevo") return "huevo";
  if (foodId === "yogur") return "leche";
  return null;
}

function labelForAllergenState(state) {
  switch (state) {
    case "not_introduced":
      return "No introducido";
    case "ok":
      return "Introducido sin reacción";
    case "mild":
      return "Reacción leve";
    case "severe":
      return "Reacción grave";
    default:
      return "No introducido";
  }
}

function renderAllergiesView() {
  const root = document.getElementById("allergens-list");
  const warning = document.getElementById("allergens-warning");
  if (!root || !window.StorageApi?.allergens) return;

  const statuses = window.StorageApi.allergens.getAll();
  root.innerHTML = ALLERGENS.map((a) => {
    const value = statuses[a.id] || "not_introduced";
    return `
      <div class="allergen-row">
        <div>
          <div class="allergen-name">${escapeHtml(a.label)}</div>
          <div class="muted" style="font-size:12px">Estado: ${escapeHtml(labelForAllergenState(value))}</div>
        </div>
        <select class="input" data-allergen="${escapeHtml(a.id)}" aria-label="Estado de ${escapeHtml(a.label)}">
          <option value="not_introduced">No introducido</option>
          <option value="ok">Introducido sin reacción</option>
          <option value="mild">Reacción leve</option>
          <option value="severe">Reacción grave</option>
        </select>
      </div>
    `;
  }).join("");

  root.querySelectorAll("select[data-allergen]").forEach((sel) => {
    const id = sel.getAttribute("data-allergen");
    const current = statuses[id] || "not_introduced";
    sel.value = current;
    sel.addEventListener("change", () => {
      window.StorageApi.allergens.setStatus(id, sel.value);
      renderAllergiesView();
    });
  });

  const hasReaction = Object.values(statuses).some((v) => v === "mild" || v === "severe");
  if (warning) {
    warning.textContent = hasReaction ? "Si se marca reacción, consulta con tu pediatra antes de volver a ofrecerlo." : "";
  }
}

function getDiaryEntries() {
  const entries = window.StorageApi?.diary?.getEntries ? window.StorageApi.diary.getEntries() : [];
  return Array.isArray(entries) ? entries : [];
}

function getEntriesForDate(dateStr) {
  return getDiaryEntries().filter((e) => e && typeof e === "object" && e.date === dateStr);
}

function getDayIcons(dateStr) {
  const entries = getEntriesForDate(dateStr);
  if (!entries.length) return "";

  let hasFood = false;
  let hasWarn = false;
  let hasLove = false;
  for (const e of entries) {
    hasFood = true;
    if (e.reaction === "disliked") hasWarn = true;
    if (e.reaction === "liked") hasLove = true;
  }

  return `${hasFood ? "🥦" : ""}${hasWarn ? " ⚠️" : ""}${hasLove ? " ❤️" : ""}`.trim();
}

function formatMonthLabel(year, monthIndex) {
  try {
    const d = new Date(Date.UTC(year, monthIndex, 1));
    return new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" }).format(d);
  } catch {
    return `${year}-${pad2(monthIndex + 1)}`;
  }
}

function ensureCalendarAllowedOrExplain() {
  if (!window.StorageApi?.milestones?.isComplete) return { ok: false, reason: "storage" };
  if (!window.StorageApi.milestones.isComplete()) {
    openMilestonesBlockedModal();
    return { ok: false, reason: "milestones" };
  }
  const safeMonths = getProfileSafeAgeMonths();
  if (safeMonths === null) {
    openModal(
      "Falta perfil",
      '<p class="muted">Para calcular la edad segura, completa el perfil del bebé en la pestaña ℹ️.</p>'
    );
    return { ok: false, reason: "profile" };
  }
  return { ok: true, safeMonths };
}

function makeId() {
  try {
    if (crypto && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  } catch {
    // ignore
  }
  return `id_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function renderDayModal(dateStr, editingId) {
  const allowedFoods = getAllowedFoodsBySafeAge();
  const entries = getEntriesForDate(dateStr);

  const editing = editingId ? entries.find((e) => e && e.id === editingId) : null;

  const optionsFoods = allowedFoods
    .slice()
    .sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), "es"))
    .map((f) => `<option value="${escapeHtml(f.id)}">${escapeHtml(f.nombre)}</option>`)
    .join("");

  const listHtml = entries.length
    ? entries
        .slice()
        .sort((a, b) => String(a.createdAt || "").localeCompare(String(b.createdAt || "")))
        .map((e) => {
          const food = getFoodIndex().find((f) => f.id === e.foodId);
          const foodName = food ? food.nombre : e.foodId;
          const meta = [
            e.quantity ? `Cantidad: ${escapeHtml(e.quantity)}` : null,
            e.form ? `Forma: ${escapeHtml(e.form)}` : null,
            e.reaction
              ? `Reacción: ${escapeHtml(
                  e.reaction === "liked" ? "Le gustó" : e.reaction === "neutral" ? "Neutral" : "No le gustó"
                )}`
              : null
          ]
            .filter(Boolean)
            .join(" · ");
          return `
            <div class="card" style="margin:10px 0 0">
              <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start">
                <div>
                  <div style="font-weight:700">${escapeHtml(foodName || "Alimento")}</div>
                  <div class="muted" style="font-size:12px">${escapeHtml(meta || "")}</div>
                </div>
                <div style="display:flex;gap:8px;flex-wrap:wrap">
                  <button class="btn" type="button" data-edit-entry="${escapeHtml(e.id)}">Editar</button>
                  <button class="btn" type="button" data-delete-entry="${escapeHtml(e.id)}">Borrar</button>
                </div>
              </div>
              ${e.notes ? `<p class="muted" style="margin:10px 0 0">${escapeHtml(e.notes)}</p>` : ""}
            </div>
          `;
        })
        .join("")
    : '<p class="muted">No hay registros para este día.</p>';

  const bodyHtml = `
    <div class="muted" style="font-size:13px">${escapeHtml(dateStr)} · ${escapeHtml(getDayIcons(dateStr) || "")}</div>

    <div class="card" style="margin:10px 0 0">
      <h4 style="margin:0 0 10px">${editing ? "Editar entrada" : "Añadir entrada"}</h4>

      <input id="day-entry-id" type="hidden" value="${escapeHtml(editing?.id || "")}" />

      <label class="label" for="day-food">Alimento</label>
      <select id="day-food" class="input">
        <option value="">Selecciona…</option>
        ${optionsFoods}
      </select>
      <p id="day-allergen-note" class="muted" style="margin:8px 0 0"></p>

      <div style="height:10px"></div>
      <label class="label" for="day-quantity">Cantidad</label>
      <select id="day-quantity" class="input">
        <option value="exploration">Exploración</option>
        <option value="tasted">Probó</option>
        <option value="ate_little">Comió poco</option>
        <option value="ate_well">Comió bien</option>
      </select>

      <div style="height:10px"></div>
      <label class="label" for="day-form">Forma</label>
      <select id="day-form" class="input">
        <option value="soft_whole">Entero blando</option>
        <option value="sticks">Bastones</option>
        <option value="mashed">Chafado</option>
      </select>

      <div style="height:10px"></div>
      <label class="label" for="day-reaction">Reacción</label>
      <select id="day-reaction" class="input">
        <option value="liked">Le gustó</option>
        <option value="neutral">Neutral</option>
        <option value="disliked">No le gustó</option>
      </select>

      <div style="height:10px"></div>
      <label class="label" for="day-notes">Observaciones</label>
      <textarea id="day-notes" class="input" rows="3" placeholder="Notas…"></textarea>

      <div style="height:12px"></div>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <button id="day-save" class="btn" type="button">Guardar</button>
        ${editing ? '<button id="day-cancel-edit" class="btn" type="button">Cancelar edición</button>' : ""}
      </div>
    </div>

    <h4 style="margin:14px 0 8px">Entradas</h4>
    ${listHtml}
  `;

  openModal("Día", bodyHtml);

  const root = document.getElementById("modal-root");
  const modal = root?.querySelector(".modal");
  if (!modal) return;

  const foodEl = modal.querySelector("#day-food");
  const quantityEl = modal.querySelector("#day-quantity");
  const formEl = modal.querySelector("#day-form");
  const reactionEl = modal.querySelector("#day-reaction");
  const notesEl = modal.querySelector("#day-notes");
  const idEl = modal.querySelector("#day-entry-id");
  const allergenEl = modal.querySelector("#day-allergen-note");

  function updateAllergenNote() {
    if (!allergenEl || !foodEl) return;
    const foodId = foodEl.value;
    const food = getFoodIndex().find((f) => f.id === foodId);
    if (food && food.es_alergeno) {
      const allergenId = allergenIdForFood(foodId);
      const state = allergenId && window.StorageApi?.allergens?.getStatus ? window.StorageApi.allergens.getStatus(allergenId) : "not_introduced";
      const stateLabel = labelForAllergenState(state);
      const extra = allergenId
        ? `<div class="muted" style="font-size:12px;margin-top:6px">Estado actual (${escapeHtml(allergenId)}): ${escapeHtml(stateLabel)}</div>`
        : "";
      allergenEl.innerHTML =
        '⚠️ <b>Alérgeno:</b> introdúcelo solo si el bebé está sano y durante el día. <button id="go-allergies" class="btn" type="button" style="padding:6px 10px">Ver Alergias</button>' +
        extra;
      const goBtn = modal.querySelector("#go-allergies");
      if (goBtn) {
        goBtn.addEventListener("click", () => {
          if (window.Router && typeof window.Router.go === "function") {
            window.Router.go("allergies");
            closeModal();
          }
        });
      }
    } else {
      allergenEl.textContent = "";
    }
  }

  if (editing) {
    if (foodEl) foodEl.value = editing.foodId || "";
    if (quantityEl) quantityEl.value = editing.quantity || "exploration";
    if (formEl) formEl.value = editing.form || "soft_whole";
    if (reactionEl) reactionEl.value = editing.reaction || "neutral";
    if (notesEl) notesEl.value = editing.notes || "";
  }

  if (foodEl) foodEl.addEventListener("change", updateAllergenNote);
  updateAllergenNote();

  const saveBtn = modal.querySelector("#day-save");
  if (saveBtn) {
    saveBtn.addEventListener("click", () => {
      const ok = ensureCalendarAllowedOrExplain();
      if (!ok.ok) return;

      const foodId = (foodEl?.value || "").trim();
      if (!foodId) {
        openModal("Falta dato", '<p class="muted">Selecciona un alimento.</p>');
        return;
      }

      const food = getFoodIndex().find((f) => f.id === foodId);
      const minAge = food ? Number(food.edad_minima) : null;
      if (food && Number.isFinite(minAge) && minAge > ok.safeMonths) {
        openModal("Fuera de rango", '<p class="muted">Este alimento está fuera de la edad segura.</p>');
        return;
      }

      const entryId = (idEl?.value || "").trim() || makeId();
      const entry = {
        id: entryId,
        date: dateStr,
        foodId,
        quantity: quantityEl?.value || "exploration",
        form: formEl?.value || "soft_whole",
        reaction: reactionEl?.value || "neutral",
        notes: String(notesEl?.value || "").trim(),
        createdAt: editing?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      window.StorageApi.diary.upsertEntry(entry);
      renderCalendarMonth();
      renderDayModal(dateStr);
    });
  }

  const cancelBtn = modal.querySelector("#day-cancel-edit");
  if (cancelBtn) {
    cancelBtn.addEventListener("click", () => {
      renderDayModal(dateStr);
    });
  }

  modal.querySelectorAll("[data-edit-entry]").forEach((btn) => {
    btn.addEventListener("click", () => {
      renderDayModal(dateStr, btn.getAttribute("data-edit-entry"));
    });
  });

  modal.querySelectorAll("[data-delete-entry]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-delete-entry");
      if (!id) return;
      const okDel = confirm("¿Borrar esta entrada?");
      if (!okDel) return;
      window.StorageApi.diary.deleteEntry(id);
      renderCalendarMonth();
      renderDayModal(dateStr);
    });
  });
}

let calendarMonthState = null;

function renderCalendarMonth() {
  const grid = document.getElementById("cal-grid");
  const label = document.getElementById("cal-month-label");
  if (!grid || !label) return;

  if (!calendarMonthState) {
    const now = new Date();
    calendarMonthState = { year: now.getFullYear(), monthIndex: now.getMonth() };
  }

  const { year, monthIndex } = calendarMonthState;
  label.textContent = formatMonthLabel(year, monthIndex);

  const first = new Date(Date.UTC(year, monthIndex, 1));
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const firstDow = first.getUTCDay(); // 0=Sun
  const offset = (firstDow + 6) % 7; // Monday-first

  grid.innerHTML = "";

  for (let i = 0; i < offset; i++) {
    const empty = document.createElement("div");
    empty.className = "calendar-day is-empty";
    grid.appendChild(empty);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(Date.UTC(year, monthIndex, day));
    const dateStr = dateToYmdUtc(d);
    const icons = getDayIcons(dateStr);

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "calendar-day";
    btn.dataset.date = dateStr;
    btn.innerHTML = `
      <div class="calendar-daynum">${day}</div>
      <div class="calendar-icons" aria-label="Estado del día">${escapeHtml(icons)}</div>
    `;
    grid.appendChild(btn);
  }

  grid.querySelectorAll("button.calendar-day").forEach((btn) => {
    btn.addEventListener("click", () => {
      const dateStr = btn.dataset.date;
      if (!dateStr) return;
      const ok = ensureCalendarAllowedOrExplain();
      if (!ok.ok) return;
      renderDayModal(dateStr);
    });
  });
}

function renderBabyProfileInfo() {
  const out = document.getElementById("baby-safe-age");
  if (!out) return;

  const profile = window.StorageApi?.babyProfile?.get ? window.StorageApi.babyProfile.get() : null;
  const safeMonths = getSafeAgeMonths(profile);

  if (safeMonths === null) {
    out.textContent = "Edad segura: completa la fecha de nacimiento.";
    return;
  }

  out.textContent = `Edad segura (meses): ${safeMonths}`;
}

function initInfoView() {
  // Inicializar checkboxes de hitos motores
  initMilestonesCheckboxes();
  
  const form = document.getElementById("baby-profile-form");
  if (form && window.StorageApi?.babyProfile?.get) {
    const profile = window.StorageApi.babyProfile.get();

    const birthEl = document.getElementById("baby-birthdate");
    const weeksEl = document.getElementById("baby-gestation-weeks");
    const dueEl = document.getElementById("baby-duedate");
    if (birthEl) birthEl.value = profile.birthDate || "";
    if (weeksEl) weeksEl.value = profile.gestationWeeks ?? "";
    if (dueEl) dueEl.value = profile.dueDate || "";

    renderBabyProfileInfo();

    form.addEventListener("submit", (e) => {
      e.preventDefault();

      const birthDate = (birthEl?.value || "").trim();
      const gestationWeeksRaw = (weeksEl?.value || "").trim();
      const dueDate = (dueEl?.value || "").trim();

      if (!birthDate) {
        openModal("Falta dato", "<p class=\"muted\">La fecha de nacimiento es obligatoria.</p>");
        return;
      }

      const gestationWeeks = gestationWeeksRaw ? Number(gestationWeeksRaw) : null;
      const isPreterm = Number.isFinite(gestationWeeks) && gestationWeeks > 0 && gestationWeeks < 37;
      if (isPreterm && !dueDate) {
        openModal("Falta dato", "<p class=\"muted\">Si es prematuro (&lt;37 semanas), añade la Fecha Probable de Parto (FPP).</p>");
        return;
      }

      const nextProfile = {
        birthDate,
        gestationWeeks: gestationWeeks ?? null,
        dueDate: dueDate || null
      };

      const safeMonths = getSafeAgeMonths(nextProfile);
      if (safeMonths !== null) {
        nextProfile.safeAgeMonths = safeMonths;
        nextProfile.safeAgeCalculatedAt = new Date().toISOString();
      }

      window.StorageApi.babyProfile.set(nextProfile);
      renderBabyProfileInfo();
      const search = document.getElementById("food-search");
      renderFoodList(search ? search.value : "");
      openModal("Guardado", "<p class=\"muted\">Perfil actualizado.</p>");
    });
  }

  const exportBtn = document.getElementById("backup-export");
  if (exportBtn && window.StorageApi?.exportState) {
    exportBtn.addEventListener("click", () => {
      const state = window.StorageApi.exportState();
      downloadJson("blwcare-backup.json", state);
    });
  }

  const importBtn = document.getElementById("backup-import");
  const fileEl = document.getElementById("backup-file");
  if (importBtn && fileEl && window.StorageApi?.importState) {
    importBtn.addEventListener("click", async () => {
      const file = fileEl.files && fileEl.files[0];
      if (!file) {
        openModal("Selecciona un archivo", "<p class=\"muted\">Elige un archivo JSON de backup.</p>");
        return;
      }

      const ok = confirm("Importar sobrescribirá todos los datos locales. ¿Continuar?");
      if (!ok) return;

      try {
        const text = await file.text();
        const json = JSON.parse(text);
        window.StorageApi.importState(json);
        location.reload();
      } catch (e) {
        console.error(e);
        openModal("Importación fallida", "<p class=\"muted\">El archivo no es un backup válido.</p>");
      }
    });
  }
}

function renderMilestonesStatus() {
  const warningCard = document.getElementById("milestones-warning");
  const statusText = document.getElementById("milestones-status");
  const infoStatus = document.getElementById("milestones-info-status");
  
  if (!window.StorageApi?.milestones) return;
  
  const isComplete = window.StorageApi.milestones.isComplete();
  
  // Mostrar/ocultar advertencia en calendario
  if (warningCard) {
    warningCard.style.display = isComplete ? "none" : "block";
  }
  
  // Texto de estado en calendario
  if (statusText) {
    statusText.textContent = isComplete
      ? "Hitos completos. Puedes registrar alimentos."
      : "";
  }
  
  // Texto de estado en info/seguridad
  if (infoStatus) {
    infoStatus.textContent = isComplete
      ? "✓ Todos los hitos están completos. Ya puedes registrar alimentos en el Diario."
      : "✗ Completa todos los hitos para poder registrar alimentos.";
    infoStatus.style.color = isComplete ? "var(--success)" : "var(--danger)";
    infoStatus.style.fontWeight = "600";
  }
}

function openMilestonesBlockedModal() {
  const m = window.StorageApi?.milestones?.getAll ? window.StorageApi.milestones.getAll() : null;
  const missing = [];
  if (!m?.seated) missing.push("Se mantiene sentado");
  if (!m?.noExtrusion) missing.push("Sin reflejo de extrusión");
  if (!m?.interestInFood) missing.push("Interés por comida");
  if (!m?.handToMouth) missing.push("Coordinación mano-boca");

  openModal(
    "Registro bloqueado",
    `<p class="muted">Antes de registrar, completa los hitos motores en la pestaña <b>Info</b>:</p><ul>${missing
      .map((x) => `<li>${escapeHtml(x)}</li>`)
      .join("")}</ul>`
  );
}

function initMilestonesCheckboxes() {
  if (!window.StorageApi?.milestones) return;

  const seatedEl = document.getElementById("ms-seated");
  const noExtrusionEl = document.getElementById("ms-no-extrusion");
  const interestEl = document.getElementById("ms-interest");
  const handEl = document.getElementById("ms-hand");

  const m = window.StorageApi.milestones.getAll();
  if (seatedEl) seatedEl.checked = !!m.seated;
  if (noExtrusionEl) noExtrusionEl.checked = !!m.noExtrusion;
  if (interestEl) interestEl.checked = !!m.interestInFood;
  if (handEl) handEl.checked = !!m.handToMouth;

  function persist() {
    window.StorageApi.milestones.set({
      seated: !!seatedEl?.checked,
      noExtrusion: !!noExtrusionEl?.checked,
      interestInFood: !!interestEl?.checked,
      handToMouth: !!handEl?.checked
    });
    renderMilestonesStatus();
  }

  [seatedEl, noExtrusionEl, interestEl, handEl].filter(Boolean).forEach((el) => {
    el.addEventListener("change", persist);
  });

  renderMilestonesStatus();
}

function initCalendarView() {
  if (!window.StorageApi?.milestones) return;

  const registerBtn = document.getElementById("calendar-register");
  const goToMilestonesLink = document.getElementById("go-to-milestones");

  // Link para ir a la sección de hitos en Info
  if (goToMilestonesLink) {
    goToMilestonesLink.addEventListener("click", (e) => {
      e.preventDefault();
      // Cambiar a la pestaña de info
      if (window.Router && typeof window.Router.go === "function") {
        window.Router.go("info");
      }
      // Scroll al elemento de hitos después de un pequeño delay
      setTimeout(() => {
        const milestonesSection = document.getElementById("milestones-section");
        if (milestonesSection) {
          milestonesSection.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 100);
    });
  }

  renderMilestonesStatus();

  if (registerBtn) {
    registerBtn.addEventListener("click", () => {
      if (!window.StorageApi.milestones.isComplete()) {
        openMilestonesBlockedModal();
        return;
      }
      const ok = ensureCalendarAllowedOrExplain();
      if (!ok.ok) return;
      const now = new Date();
      const nowUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      renderDayModal(dateToYmdUtc(nowUtc));
    });
  }

  const prevBtn = document.getElementById("cal-prev");
  const nextBtn = document.getElementById("cal-next");
  if (prevBtn) {
    prevBtn.addEventListener("click", () => {
      if (!calendarMonthState) {
        renderCalendarMonth();
        return;
      }
      let { year, monthIndex } = calendarMonthState;
      monthIndex -= 1;
      if (monthIndex < 0) {
        monthIndex = 11;
        year -= 1;
      }
      calendarMonthState = { year, monthIndex };
      renderCalendarMonth();
    });
  }
  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      if (!calendarMonthState) {
        renderCalendarMonth();
        return;
      }
      let { year, monthIndex } = calendarMonthState;
      monthIndex += 1;
      if (monthIndex > 11) {
        monthIndex = 0;
        year += 1;
      }
      calendarMonthState = { year, monthIndex };
      renderCalendarMonth();
    });
  }

  renderCalendarMonth();
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", async () => {
    try {
      await navigator.serviceWorker.register("./sw.js", { scope: "./" });
    } catch (e) {
      console.warn("Service Worker no registrado:", e);
    }
  });
}

function main() {
  if (window.Router && typeof window.Router.init === "function") {
    window.Router.init();
  }

  if (window.StorageApi && typeof window.StorageApi.getState === "function") {
    window.StorageApi.getState();
  }

  renderFoodList("");

  document.getElementById("food-search").addEventListener("input", (e) => {
    renderFoodList(e.target.value);
  });

  const foodAgeFilter = document.getElementById("food-age-filter");
  if (foodAgeFilter) {
    foodAgeFilter.addEventListener("change", () => {
      const search = document.getElementById("food-search");
      renderFoodList(search ? search.value : "");
    });
  }

  // Recetas
  const recipeQ = document.getElementById("recipe-ingredient");
  if (recipeQ) {
    recipeQ.addEventListener("input", () => {
      renderRecipeList();
    });
  }
  const recipeAge = document.getElementById("recipe-age-filter");
  if (recipeAge) {
    recipeAge.addEventListener("change", () => {
      renderRecipeList();
    });
  }
  const recipeExclude = document.getElementById("recipe-exclude-reactive");
  if (recipeExclude) {
    recipeExclude.addEventListener("change", () => {
      renderRecipeList();
    });
  }
  const recipeList = document.getElementById("recipe-list");
  if (recipeList) {
    recipeList.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-recipe-id]");
      if (!btn) return;
      openRecipeModal(btn.dataset.recipeId);
    });
  }

  document.getElementById("food-list").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-food-id]");
    if (!btn) return;
    loadFoodDetail(btn.dataset.foodId);
  });

  document.getElementById("sos-button").addEventListener("click", openSosModal);

  initCalendarView();
  initInfoView();
  renderAllergiesView();
  renderRecipeList();

  registerServiceWorker();
}

document.addEventListener("DOMContentLoaded", main);
