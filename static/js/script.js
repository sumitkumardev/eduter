// ─────────────────────────────────────────────────────────────────────────────
// INFINITE SCROLL (articles + movies) with one shared #loading
// ─────────────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const colorThief = new ColorThief();
    let offsetArticles = 0;
    let offsetMovies = 0;

    const articlesContainer = document.getElementById('articles');
    const moviesContainer   = document.getElementById('movies');
    const loading           = document.getElementById('loading');

    // ── UTILITY: “Is this panel visible?” based on aria-hidden="false"
    function isAriaVisible(element) {
        return element.getAttribute('aria-hidden') === 'false';
    }

    // ── UTILITY: Decide black vs. white text for an [r,g,b] color
    function getContrastTextColor([r, g, b]) {
        const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
        return luminance > 186 ? 'black' : 'white';
    }

    // ── UTILITY: Slightly darken dominant color so text stands out
    function adjustForPremiumContrast([r, g, b]) {
        const boost = 0.9;
        return [
            Math.max(0, Math.round(r * boost)),
            Math.max(0, Math.round(g * boost)),
            Math.max(0, Math.round(b * boost))
        ];
    }

    // ── UTILITY: After <img> loads, grab its dominant palette & theme the container
    function applyColorTheme(imgEl, containerEl) {
        imgEl.addEventListener('load', () => {
            try {
                const palette = colorThief.getPalette(imgEl, 5);
                const majorityColor = palette[0];
                const adjustedColor = adjustForPremiumContrast(majorityColor);
                const textColor = getContrastTextColor(adjustedColor);

                containerEl.style.backgroundColor = `rgb(${adjustedColor.join(',')})`;
                containerEl.style.color = textColor;

                containerEl
                    .querySelectorAll('.contents, a, p, h2, strong')
                    .forEach(el => el.style.color = textColor);
            } catch (e) {
                console.warn("Color extraction failed:", e);
            }
        });
    }

    // ── LOAD ARTICLES ──────────────────────────────────────────────────────────
    async function loadArticles() {
        loading.style.display = 'block';
        const resp = await fetch(`/v1/newsfeed?offset=${offsetArticles}&limit=3`);
        const data = await resp.json();

        // If the API returns an empty array, show “No more articles.” and stop
        if (!data.length) {
            loading.innerText = "No more articles.";
            return;
        }

        data.forEach(article => {
            const divArt = document.createElement('div');
            divArt.className = 'article';

            let imgHTML = '';
            if (article.multimedia?.[0]?.url) {
                imgHTML = `
                    <div class="thumb">
                      <img crossorigin="anonymous"
                           src="${article.multimedia[0].url}"
                           alt="${article.title}">
                    </div>`;
            }

            divArt.innerHTML = `
              ${imgHTML}
              <div class="contents">
                <h2>
                  <a href="${article.url}" target="_blank">
                    ${article.title}
                  </a>
                </h2>
                <p class="article-summary">${article.abstract}</p>
                <div class="meta">
                  <p><strong>${article.byline}</strong></p>
                  <p class="sml">
                    ${new Date(article.created_date).toLocaleDateString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric'
                    })}
                  </p>
                </div>
              </div>`;

            // Append below the existing <h2> in #articles
            articlesContainer.appendChild(divArt);

            // Once the thumbnail loads, apply ColorThief theming
            const imgEl = divArt.querySelector('img');
            if (imgEl) {
                applyColorTheme(imgEl, divArt);
            }
        });

        offsetArticles += 3;
        loading.style.display = 'none';
    }

    // ── LOAD MOVIES ────────────────────────────────────────────────────────────
    async function loadMovies() {
        loading.style.display = 'block';
        const resp = await fetch(`/v1/moviesfeed?offset=${offsetMovies}&limit=3`);
        const data = await resp.json();

        // If empty, show “No more movies.” and stop
        if (!data.length) {
            loading.innerText = "No more movies.";
            return;
        }

        data.forEach(movie => {
            const divMv = document.createElement('div');
            divMv.className = 'article'; // re-use same CSS class for styling

            let imgHTML = '';
            if (movie.poster_path) {
                const imgUrl = `https://image.tmdb.org/t/p/w500${movie.poster_path}`;
                imgHTML = `
                    <div class="thumb">
                      <img crossorigin="anonymous"
                           src="${imgUrl}"
                           alt="${movie.name || movie.title}">
                    </div>`;
            }

            divMv.innerHTML = `
              ${imgHTML}
              <div class="contents">
                <h2>
                  <a href="https://www.themoviedb.org/${movie.media_type}/${movie.id}"
                     target="_blank">
                    ${movie.name || movie.title}
                  </a>
                </h2>
                <p class="article-summary">
                  ${movie.overview || 'No description available.'}
                </p>
                <div class="meta">
                  <p>
                    <strong>⭐ ${movie.vote_average} (${movie.vote_count} votes)</strong>
                  </p>
                  <p class="sml">
                    ${new Date(movie.first_air_date || movie.release_date || '').toLocaleDateString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric'
                    })}
                  </p>
                </div>
              </div>`;

            // Append below the existing <h2> in #movies
            moviesContainer.appendChild(divMv);

            // Once the poster loads, apply ColorThief theming
            const imgEl = divMv.querySelector('img');
            if (imgEl) {
                applyColorTheme(imgEl, divMv);
            }
        });

        offsetMovies += 3;
        loading.style.display = 'none';
    }

    // ── SCROLL HANDLER ─────────────────────────────────────────────────────────
    window.addEventListener('scroll', () => {
        const nearBottom = (window.innerHeight + window.scrollY) >= (document.body.offsetHeight - 100);

        // Only proceed if user is near bottom and #loading is currently hidden
        if (!nearBottom || loading.style.display !== 'none') {
            return;
        }

        // If “News” panel is visible, load more articles; else if “Movies” panel is visible, load more movies
        if (isAriaVisible(articlesContainer)) {
            loadArticles();
        } else if (isAriaVisible(moviesContainer)) {
            loadMovies();
        }
    });

    // ── INITIAL LOAD (when page first opens) ─────────────────────────────────
    if (isAriaVisible(articlesContainer)) {
        loadArticles();
    } else if (isAriaVisible(moviesContainer)) {
        loadMovies();
    }
});



// ─────────────────────────────────────────────────────────────────────────────
// TAB SWITCHING LOGIC (exactly as your existing snippet)
// ─────────────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
    const tabList   = document.querySelector(".tabs-nav");
    const tabs      = tabList.querySelectorAll(".tab-button");
    const panels    = document.querySelectorAll(".tab-panel");
    const indicator = document.querySelector(".tabs-indicator");

    const setIndicatorPosition = (tab) => {
        indicator.style.transform = `translateX(${tab.offsetLeft}px)`;
        indicator.style.width = `${tab.offsetWidth}px`;
    };

    // Set initial indicator under the first (News) tab
    setIndicatorPosition(tabs[0]);

    tabs.forEach((tab) => {
        tab.addEventListener("click", (e) => {
            const targetTab   = e.target;
            const targetPanel = document.querySelector(
                `#${targetTab.getAttribute("aria-controls")}`
            );

            // Deselect all tabs
            tabs.forEach((t) => {
                t.setAttribute("aria-selected", "false");
                t.classList.remove("active");
            });
            // Select the clicked tab
            targetTab.setAttribute("aria-selected", "true");
            targetTab.classList.add("active");

            // Hide all panels
            panels.forEach((panel) => {
                panel.setAttribute("aria-hidden", "true");
            });
            // Show the one the user clicked
            targetPanel.setAttribute("aria-hidden", "false");

            // Move the indicator under the active tab
            setIndicatorPosition(targetTab);

            // (Optional) If you want to clear out old content on tab switch,
            // uncomment the lines below:
            //
            // if (targetPanel === document.getElementById('articles')) {
            //   articlesContainer.innerHTML = '<h2>Latest News</h2>';
            //   offsetArticles = 0;
            //   loadArticles();
            // } else {
            //   moviesContainer.innerHTML = '<h2>Latest Movies</h2>';
            //   offsetMovies = 0;
            //   loadMovies();
            // }
        });
    });

    // Keyboard navigation for left/right arrows
    tabList.addEventListener("keydown", (e) => {
        const targetTab   = e.target;
        const previousTab = targetTab.previousElementSibling;
        const nextTab     = targetTab.nextElementSibling;

        if (e.key === "ArrowLeft" && previousTab) {
            previousTab.click();
            previousTab.focus();
        }
        if (e.key === "ArrowRight" && nextTab) {
            nextTab.click();
            nextTab.focus();
        }
    });
});



// ─────────────────────────────────────────────────────────────────────────────
// NAV TOGGLE LOGIC (your existing snippet, unchanged)
// ─────────────────────────────────────────────────────────────────────────────
const navlist     = document.querySelector("#nav");
const headMain    = document.querySelector(".navi");
const hiddenElems = document.querySelectorAll(".hidden");

navlist.addEventListener("click", () => {
    headMain.classList.toggle('activenv');
    hiddenElems.forEach(el => el.classList.toggle('active'));
});
