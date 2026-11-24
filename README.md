https://hossainlijon.github.io/Mini-Project-3-4/
# Recipe Shelf
CSE-2340 MP3–MP4 mini project: an API-driven recipe finder (HTML, CSS, JavaScript).

- API: TheMealDB (free, no key) – https://www.themealdb.com/api.php
- Run: open `index.html` in a browser (internet required).

## Requirement map
| Requirement | Where |
|---|---|
| DOM manipulation, search/filter/select | `render()`, `buildCard()`, category chips, sort, recipe modal |
| Events and array methods | `addEventListener` throughout; `map`, `filter`, `find`/`some`, `forEach`, `sort` |
| fetch + async/await, loading/error/empty | `getJSON()`, `loadMeals()`, `showLoading()`, `showError()`, `showEmpty()` |
| Local Storage | Saved recipes + last search/category/sort survive refresh |

## Extra features
- Light/dark theme toggle (remembered in Local Storage)
- "Surprise me" random recipe (`random.php`)
- "Load more" pagination (12 cards at a time)
- Toast notifications, copy ingredients, print recipe
- `/` keyboard shortcut to focus search, offline/online notice
- "Clear all saved" in the Saved tab
