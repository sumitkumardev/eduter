document.addEventListener('DOMContentLoaded', () => {
    const colorThief = new ColorThief();
    let offsetArticles = 0;
    let offsetMovies = 0;

    const articlesContainer = document.getElementById('articles');
    const moviesContainer = document.getElementById('movies');
    const loading = document.getElementById('loading');

    function isAriaVisible(element) {
        return element.getAttribute('aria-hidden') === 'false';
    }

    function getContrastTextColor([r, g, b]) {
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b);
        return luminance > 186 ? 'black' : 'white';
    }

    function adjustForPremiumContrast([r, g, b]) {
        const boost = 0.9;
        return [
            Math.max(0, Math.round(r * boost)),
            Math.max(0, Math.round(g * boost)),
            Math.max(0, Math.round(b * boost))
        ];
    }

    function applyColorTheme(img, container) {
        img.addEventListener('load', () => {
            try {
                const palette = colorThief.getPalette(img, 5);
                const majorityColor = palette[0];
                const adjustedColor = adjustForPremiumContrast(majorityColor);
                const textColor = getContrastTextColor(adjustedColor);

                container.style.backgroundColor = `rgb(${adjustedColor.join(',')})`;
                container.style.color = textColor;

                container.querySelectorAll('.contents, a, p, h2, strong').forEach(el => {
                    el.style.color = textColor;
                });
            } catch (e) {
                console.warn("Color extraction failed:", e);
            }
        });
    }

    async function loadArticles() {
        const response = await fetch(`/v1/newsfeed?offset=${offsetArticles}&limit=3`);
        const data = await response.json();

        data.forEach(article => {
            const div = document.createElement('div');
            div.className = 'article';

            let imgHTML = '';
            if (article.multimedia?.[0]?.url) {
                imgHTML = `<div class="thumb"><img crossorigin="anonymous" src="${article.multimedia[0].url}" alt="${article.title}"></div>`;
            }

            div.innerHTML = `
                ${imgHTML}
                <div class="contents">
                    <h2><a href="${article.url}">${article.title}</a></h2>
                    <p class="article-summary">${article.abstract}</p>
                    <div class="meta">
                        <p><strong>${article.byline}</strong></p>
                        <p class="sml">${new Date(article.created_date).toLocaleDateString('en-GB', {
                day: '2-digit', month: 'short', year: 'numeric'
            })}</p>
                    </div>
                </div>
            `;
            articlesContainer.appendChild(div);

            const img = div.querySelector('img');
            if (img) applyColorTheme(img, div);
        });

        offsetArticles += 3;
    }

    async function loadMovies() {
        const response = await fetch(`/v1/moviesfeed?offset=${offsetMovies}&limit=3`);
        const data = await response.json();

        data.forEach(movie => {
            const div = document.createElement('div');
            div.className = 'article';

            let imgHTML = '';
            if (movie.poster_path) {
                const imgUrl = `https://image.tmdb.org/t/p/w500${movie.poster_path}`;
                imgHTML = `<div class="thumb"><img crossorigin="anonymous" src="${imgUrl}" alt="${movie.name || movie.title}"></div>`;
            }

            div.innerHTML = `
                ${imgHTML}
                <div class="contents">
                    <h2><a href="https://www.themoviedb.org/${movie.media_type}/${movie.id}" target="_blank">${movie.name || movie.title}</a></h2>
                    <p class="article-summary">${movie.overview || 'No description available.'}</p>
                    <div class="meta">
                        <p><strong>⭐ ${movie.vote_average} (${movie.vote_count} votes)</strong></p>
                        <p class="sml">${new Date(movie.first_air_date || movie.release_date || '').toLocaleDateString('en-GB', {
                day: '2-digit', month: 'short', year: 'numeric'
            })}</p>
                    </div>
                </div>
            `;
            moviesContainer.appendChild(div);

            const img = div.querySelector('img');
            if (img) applyColorTheme(img, div);
        });

        offsetMovies += 3;
    }

    window.addEventListener('scroll', () => {
        const nearBottom = window.innerHeight + window.scrollY >= document.body.offsetHeight - 100;
        console.log("Scroll Event - near bottom?", nearBottom);

        if (nearBottom && loading.style.display === 'none') {
            loading.style.display = 'block';

            if (isAriaVisible(articlesContainer)) {
                console.log(">> Fetching Articles");
                loadArticles().finally(() => loading.style.display = 'none');
            } else if (isAriaVisible(moviesContainer)) {
                console.log(">> Fetching Movies");
                loadMovies().finally(() => loading.style.display = 'none');
            }
        }
    });


    // Initial load based on visible tab
    if (isAriaVisible(articlesContainer)) {
        loadArticles();
    } else if (isAriaVisible(moviesContainer)) {
        loadMovies();
    }
});



// for tabs
document.addEventListener("DOMContentLoaded", () => {
    const tabList = document.querySelector(".tabs-nav");
    const tabs = tabList.querySelectorAll(".tab-button");
    const panels = document.querySelectorAll(".tab-panel");
    const indicator = document.querySelector(".tabs-indicator");

    const setIndicatorPosition = (tab) => {
        indicator.style.transform = `translateX(${tab.offsetLeft}px)`;
        indicator.style.width = `${tab.offsetWidth}px`;
    };

    // Set initial indicator position
    setIndicatorPosition(tabs[0]);

    tabs.forEach((tab) => {
        tab.addEventListener("click", (e) => {
            const targetTab = e.target;
            const targetPanel = document.querySelector(
                `#${targetTab.getAttribute("aria-controls")}`
            );

            // Update tabs
            tabs.forEach((tab) => {
                tab.setAttribute("aria-selected", false);
                tab.classList.remove("active");
            });
            targetTab.setAttribute("aria-selected", true);
            targetTab.classList.add("active");

            // Update panels
            panels.forEach((panel) => {
                panel.setAttribute("aria-hidden", true);
            });
            targetPanel.setAttribute("aria-hidden", false);

            // Move indicator
            setIndicatorPosition(targetTab);
        });
    });

    // Keyboard navigation
    tabList.addEventListener("keydown", (e) => {
        const targetTab = e.target;
        const previousTab = targetTab.previousElementSibling;
        const nextTab = targetTab.nextElementSibling;

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

// building nav
const navlist = document.querySelector("#nav");
const headMain = document.querySelector(".navi");
const hiddenElements = document.querySelectorAll(".hidden");

navlist.addEventListener("click", () => {
    headMain.classList.toggle('activenv');

    hiddenElements.forEach(element => {
        element.classList.toggle('active');
    });
});