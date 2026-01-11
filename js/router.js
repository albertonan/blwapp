(function (global) {
  function setActiveRoute(route) {
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
  }

  global.Router = {
    init() {
      document.addEventListener("click", (e) => {
        const btn = e.target.closest(".tab");
        if (!btn) return;
        setActiveRoute(btn.dataset.route);
      });
      setActiveRoute("calendar");
    },
    go(route) {
      setActiveRoute(route);
    }
  };
})(typeof window !== "undefined" ? window : self);
