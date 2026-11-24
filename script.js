/* Recipe Shelf – MP3/MP4 mini project
   API: TheMealDB (free, no key) https://www.themealdb.com/api.php */
const API = "https://www.themealdb.com/api/json/v1/1";
const FAV_KEY = "recipeShelf.favorites";
const PREF_KEY = "recipeShelf.prefs";
const THEME_KEY = "recipeShelf.theme";
const PAGE_SIZE = 12;

/* ---------- State ---------- */
const state = {
  view: "discover",     // "discover" | "saved"
  query: "",
  category: "All",
  sort: "az",
  meals: [],            // normalized meals currently loaded from the API
  favorites: [],        // saved meals (persisted in localStorage)
  categories: [],
  shown: PAGE_SIZE,     // how many cards are visible ("Load more")
  requestId: 0          // guards against out-of-order responses
};

/* ---------- DOM references ---------- */
const $ = (sel) => document.querySelector(sel);
const searchForm = $("#searchForm");
const searchInput = $("#searchInput");
const chipsBox = $("#chips");
const sortSelect = $("#sortSelect");
const statusEl = $("#status");
const resultsEl = $("#results");
const messageEl = $("#message");
const savedCountEl = $("#savedCount");
const modal = $("#modal");
const modalBody = $("#modalBody");
const moreBtn = $("#moreBtn");
const clearSavedBtn = $("#clearSaved");
const toastEl = $("#toast");

/* ---------- Toast ---------- */
let toastTimer;
function toast(text) {
  toastEl.textContent = text;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2200);
}

/* ---------- Helpers ---------- */
function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  Object.entries(props).forEach(([k, v]) => {
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else node.setAttribute(k, v);
  });
  children.forEach((c) => c && node.append(c));
  return node;
}

const normalize = (m) => ({
  id: m.idMeal,
  name: m.strMeal,
  thumb: m.strMealThumb,
  category: m.strCategory || "",
  area: m.strArea || ""
});

async function getJSON(path) {
  const res = await fetch(`${API}/${path}`);
  if (!res.ok) throw new Error(`Server replied with status ${res.status}.`);
  return res.json();
}

/* ---------- Local Storage ---------- */
function loadStorage() {
  try {
    state.favorites = JSON.parse(localStorage.getItem(FAV_KEY)) || [];
    const prefs = JSON.parse(localStorage.getItem(PREF_KEY)) || {};
    state.query = prefs.query || "";
    state.category = prefs.category || "All";
    state.sort = prefs.sort || "az";
  } catch {
    state.favorites = [];
  }
}
const saveFavorites = () => localStorage.setItem(FAV_KEY, JSON.stringify(state.favorites));
const savePrefs = () =>
  localStorage.setItem(PREF_KEY, JSON.stringify({ query: state.query, category: state.category, sort: state.sort }));

const isSaved = (id) => state.favorites.some((f) => f.id === id);

function toggleFavorite(meal) {
  if (isSaved(meal.id)) {
    state.favorites = state.favorites.filter((f) => f.id !== meal.id);
    toast("Removed from saved");
  } else {
    state.favorites.push(meal);
    toast("Saved to your shelf");
  }
  saveFavorites();
  savedCountEl.textContent = state.favorites.length;
  render();
}

/* ---------- API calls (async/await) ---------- */
async function loadCategories() {
  try {
    const data = await getJSON("list.php?c=list");
    state.categories = data.meals.map((c) => c.strCategory);
  } catch {
    state.categories = [];   // chips just show "All" if this fails
  }
  renderChips();
}

async function loadMeals() {
  const myRequest = ++state.requestId;
  state.shown = PAGE_SIZE;
  showLoading();
  try {
    let meals;
    if (state.query) {
      // Search by name, then narrow by category on the client
      const data = await getJSON(`search.php?s=${encodeURIComponent(state.query)}`);
      meals = (data.meals || []).map(normalize);
    } else if (state.category !== "All") {
      const data = await getJSON(`filter.php?c=${encodeURIComponent(state.category)}`);
      meals = (data.meals || []).map((m) => ({ ...normalize(m), category: state.category }));
    } else {
      // The API has no "list all" endpoint, so "a" returns a broad default set
      const data = await getJSON("search.php?s=a");
      meals = (data.meals || []).map(normalize);
    }
    if (myRequest !== state.requestId) return;   // a newer request replaced this one
    state.meals = meals;
    render();
  } catch (err) {
    if (myRequest !== state.requestId) return;
    showError(err.message || "Something went wrong.");
  }
}

async function openRecipe(id) {
  modalBody.replaceChildren(el("p", { class: "m-loading", text: "Loading recipe…" }));
  if (!modal.open) modal.showModal();
  try {
    const data = await getJSON(`lookup.php?i=${id}`);
    const raw = data.meals && data.meals[0];
    if (!raw) throw new Error("Recipe not found.");
    renderRecipe(raw);
  } catch (err) {
    modalBody.replaceChildren(el("p", { class: "m-loading", text: `Could not load this recipe. ${err.message}` }));
  }
}

/* ---------- Rendering ---------- */
function visibleMeals() {
  let list = state.view === "saved" ? [...state.favorites] : [...state.meals];

  // Category filter (needed for text searches and for the Saved view)
  if (state.category !== "All" && (state.query || state.view === "saved")) {
    list = list.filter((m) => m.category === state.category);
  }
  // Saved view: text filter happens locally
  if (state.view === "saved" && state.query) {
    const q = state.query.toLowerCase();
    list = list.filter((m) => m.name.toLowerCase().includes(q));
  }
  list.sort((a, b) => a.name.localeCompare(b.name));
  if (state.sort === "za") list.reverse();
  return list;
}

function render() {
  const list = visibleMeals();
  resultsEl.replaceChildren();
  messageEl.hidden = true;
  messageEl.className = "message";
  moreBtn.hidden = true;
  clearSavedBtn.hidden = !(state.view === "saved" && state.favorites.length > 0);

  if (list.length === 0) {
    statusEl.textContent = "";
    showEmpty();
    return;
  }
  const label = state.view === "saved" ? "saved" : "found";
  const visible = list.slice(0, state.shown);
  statusEl.textContent = `Showing ${visible.length} of ${list.length} recipe${list.length === 1 ? "" : "s"} ${label}`;
  visible.forEach((meal) => resultsEl.append(buildCard(meal)));
  moreBtn.hidden = visible.length >= list.length;
}

function buildCard(meal) {
  const img = el("img", { class: "card-img", src: meal.thumb + "/preview", alt: meal.name, loading: "lazy" });
  img.addEventListener("click", () => openRecipe(meal.id));

  const meta = [meal.category, meal.area].filter(Boolean).join(", ");
  const viewBtn = el("button", { class: "btn-ghost", type: "button", text: "View recipe" });
  viewBtn.addEventListener("click", () => openRecipe(meal.id));

  const saved = isSaved(meal.id);
  const saveBtn = el("button", {
    class: "save" + (saved ? " is-saved" : ""),
    type: "button",
    "aria-pressed": String(saved),
    "aria-label": saved ? `Remove ${meal.name} from saved` : `Save ${meal.name}`,
    text: saved ? "★" : "☆"
  });
  saveBtn.addEventListener("click", () => toggleFavorite(meal));

  return el("article", { class: "card" }, img,
    el("div", { class: "card-body" },
      el("h3", { class: "card-title", text: meal.name }),
      meta ? el("p", { class: "card-meta", text: meta }) : null,
      el("div", { class: "card-actions" }, viewBtn, saveBtn)));
}

function renderChips() {
  chipsBox.replaceChildren();
  ["All", ...state.categories].forEach((name) => {
    const chip = el("button", { class: "chip", type: "button", "aria-pressed": String(name === state.category), text: name });
    chip.addEventListener("click", () => {
      state.category = name;
      savePrefs();
      renderChips();
      state.shown = PAGE_SIZE;
      state.view === "saved" ? render() : loadMeals();
    });
    chipsBox.append(chip);
  });
}

function renderRecipe(raw) {
  const ingredients = [];
  for (let i = 1; i <= 20; i++) {
    const name = (raw[`strIngredient${i}`] || "").trim();
    const amount = (raw[`strMeasure${i}`] || "").trim();
    if (name) ingredients.push(`${amount} ${name}`.trim());
  }
  const meal = normalize(raw);
  const saveBtn = el("button", { class: "btn", type: "button", text: isSaved(meal.id) ? "Remove from saved" : "Save recipe" });
  saveBtn.addEventListener("click", () => {
    toggleFavorite(meal);
    saveBtn.textContent = isSaved(meal.id) ? "Remove from saved" : "Save recipe";
  });
  const copyBtn = el("button", { class: "btn-ghost", type: "button", text: "Copy ingredients" });
  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(`${raw.strMeal}\n` + ingredients.map((i) => `- ${i}`).join("\n"));
      toast("Ingredients copied");
    } catch {
      toast("Copy is not available in this browser");
    }
  });
  const printBtn = el("button", { class: "btn-ghost", type: "button", text: "Print" });
  printBtn.addEventListener("click", () => window.print());
  const actions = el("div", { class: "m-actions" }, saveBtn, copyBtn, printBtn);
  if (raw.strYoutube) actions.append(el("a", { class: "btn", href: raw.strYoutube, target: "_blank", rel: "noopener", text: "Watch video" }));

  const list = el("ul", { class: "ings" });
  ingredients.forEach((text) => list.append(el("li", { text })));

  modalBody.replaceChildren(
    el("img", { class: "m-img", src: raw.strMealThumb, alt: raw.strMeal }),
    el("div", { class: "m-body" },
      el("h2", { id: "modalTitle", text: raw.strMeal }),
      el("p", { class: "card-meta", text: [raw.strCategory, raw.strArea].filter(Boolean).join(", ") }),
      el("h3", { text: "Ingredients" }), list,
      el("h3", { text: "Instructions" }), el("p", { class: "steps", text: raw.strInstructions }),
      actions));
}

/* ---------- Loading, error and empty states ---------- */
function showLoading() {
  messageEl.hidden = true;
  statusEl.textContent = "Loading recipes…";
  resultsEl.replaceChildren(...Array.from({ length: 8 }, () => el("div", { class: "skeleton" })));
}

function showError(text) {
  resultsEl.replaceChildren();
  statusEl.textContent = "";
  const retry = el("button", { class: "btn", type: "button", text: "Try again" });
  retry.addEventListener("click", loadMeals);
  messageEl.className = "message is-error";
  messageEl.replaceChildren(el("h3", { text: "Couldn't load recipes" }),
    el("p", { text: `${text} Check your internet connection and try again.` }), retry);
  messageEl.hidden = false;
}

function showEmpty() {
  const inSaved = state.view === "saved";
  const clear = el("button", { class: "btn", type: "button", text: inSaved ? "Browse recipes" : "Clear filters" });
  clear.addEventListener("click", () => {
    state.query = ""; state.category = "All"; searchInput.value = "";
    setView("discover");
  });
  messageEl.replaceChildren(
    el("h3", { text: inSaved ? "Nothing saved yet" : "No recipes match" }),
    el("p", { text: inSaved ? "Tap the star on any recipe to keep it here." : "Try a different word or pick another category." }),
    clear);
  messageEl.hidden = false;
}

/* ---------- Events ---------- */
function setView(view) {
  state.view = view;
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("is-active", t.dataset.view === view));
  savePrefs();
  renderChips();
  state.shown = PAGE_SIZE;
  view === "saved" ? render() : loadMeals();
}

document.querySelectorAll(".tab").forEach((t) => t.addEventListener("click", () => setView(t.dataset.view)));

searchForm.addEventListener("submit", (e) => {
  e.preventDefault();
  runSearch();
});

let debounce;
searchInput.addEventListener("input", () => {
  clearTimeout(debounce);
  debounce = setTimeout(runSearch, 450);      // search while typing, but not on every key
});

function runSearch() {
  state.query = searchInput.value.trim();
  savePrefs();
  state.shown = PAGE_SIZE;
  state.view === "saved" ? render() : loadMeals();
}

sortSelect.addEventListener("change", () => {
  state.sort = sortSelect.value;
  savePrefs();
  state.shown = PAGE_SIZE;
  render();
});

modal.addEventListener("click", (e) => { if (e.target === modal) modal.close(); });  // click backdrop
$("#modalClose").addEventListener("click", () => modal.close());

moreBtn.addEventListener("click", () => {
  state.shown += PAGE_SIZE;
  render();
});

clearSavedBtn.addEventListener("click", () => {
  if (!confirm("Remove all saved recipes?")) return;
  state.favorites = [];
  saveFavorites();
  savedCountEl.textContent = 0;
  render();
  toast("Saved list cleared");
});

$("#randomBtn").addEventListener("click", async () => {
  try {
    const data = await getJSON("random.php");
    openRecipe(data.meals[0].idMeal);
  } catch (err) {
    toast("Could not fetch a random recipe");
  }
});

/* Theme toggle (saved in localStorage) */
$("#themeBtn").addEventListener("click", () => {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem(THEME_KEY, JSON.stringify(next)); } catch {}
});

/* Keyboard shortcut: "/" jumps to search */
document.addEventListener("keydown", (e) => {
  const typing = ["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement.tagName);
  if (e.key === "/" && !typing && !modal.open) {
    e.preventDefault();
    searchInput.focus();
  }
});

/* Network status */
window.addEventListener("offline", () => toast("You are offline"));
window.addEventListener("online", () => { toast("Back online"); if (state.view === "discover") loadMeals(); });

/* ---------- Start ---------- */
loadStorage();
searchInput.value = state.query;
sortSelect.value = state.sort;
savedCountEl.textContent = state.favorites.length;
renderChips();
loadCategories();
loadMeals();
