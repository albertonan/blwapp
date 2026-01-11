(function (global) {
  const STORAGE_KEY = "blwcare_active_tab";
  const VALID_ROUTES = ["calendar", "allergies", "foods", "recipes", "info"];

  function setActiveRoute(route, updateHash = true) {
    // Validar que la ruta sea válida
    if (!VALID_ROUTES.includes(route)) {
      route = "calendar";
    }

    const viewCalendar = document.getElementById("view-calendar");
    const viewAllergies = document.getElementById("view-allergies");
    const viewFoods = document.getElementById("view-foods");
    const viewRecipes = document.getElementById("view-recipes");
    const viewInfo = document.getElementById("view-info");

    const tabs = Array.from(document.querySelectorAll(".tab"));
    tabs.forEach(t => t.classList.toggle("is-active", t.dataset.route === route));

    viewCalendar.classList.toggle("is-active", route === "calendar");
    viewAllergies.classList.toggle("is-active", route === "allergies");
    viewFoods.classList.toggle("is-active", route === "foods");
    viewRecipes.classList.toggle("is-active", route === "recipes");
    viewInfo.classList.toggle("is-active", route === "info");

    // Persistir en localStorage
    try {
      localStorage.setItem(STORAGE_KEY, route);
    } catch (e) {
      // localStorage no disponible
    }

    // Actualizar hash en la URL
    if (updateHash) {
      history.replaceState(null, "", "#" + route);
    }
  }

  function getInitialRoute() {
    // Prioridad: 1) Hash de URL, 2) localStorage, 3) default "calendar"
    const hashRoute = window.location.hash.slice(1);
    if (VALID_ROUTES.includes(hashRoute)) {
      return hashRoute;
    }

    try {
      const savedRoute = localStorage.getItem(STORAGE_KEY);
      if (VALID_ROUTES.includes(savedRoute)) {
        return savedRoute;
      }
    } catch (e) {
      // localStorage no disponible
    }

    return "calendar";
  }

  global.Router = {
    init() {
      document.addEventListener("click", (e) => {
        const btn = e.target.closest(".tab");
        if (!btn) return;
        setActiveRoute(btn.dataset.route);
      });

      // Escuchar cambios en el hash (navegación adelante/atrás)
      window.addEventListener("hashchange", () => {
        const route = window.location.hash.slice(1);
        if (VALID_ROUTES.includes(route)) {
          setActiveRoute(route, false);
        }
      });

      // Iniciar con la ruta guardada o del hash
      const initialRoute = getInitialRoute();
      setActiveRoute(initialRoute);
    },
    go(route) {
      setActiveRoute(route);
    }
  };
})(typeof window !== "undefined" ? window : self);
