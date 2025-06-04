document.addEventListener('DOMContentLoaded', () => {
    const colorThief = new ColorThief();
    let offsetArticles = 0;
    let offsetMovies = 0;

    const articlesContainer = document.getElementById('articles');
    const moviesContainer = document.getElementById('movies');
    const loading = document.getElementById('loading');

    // Utility: Check luminance to decide white or black text
    function getContrastTextColor([r, g, b]) {
        const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
        return luminance > 186 ? 'black' : 'white';
    }

    function adjustForPremiumContrast([r, g, b]) {
        const boost = 0.9;
        return [
            Math.max(0, Math.round(r * boost)),
            Math.max(0, Math.round(g * boost)),
            Math.max(0, Math.round(b * boost)),
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

                container.querySelectorAll('.contents, a, p, h2, strong, button').forEach(el => {
                    el.style.color = textColor;
                });
            } catch (e) {
                console.warn('Color extraction failed:', e);
            }
        });
    }

    async function loadArticles() {
        loading.style.display = 'block';
        loading.innerText = 'Loading...';

        const response = await fetch(`/v1/newsfeed?offset=${offsetArticles}&limit=3`);
        const data = await response.json();

        if (data.length === 0) {
            loading.innerText = 'No more articles.';
            loading.style.display = 'block';
            return;
        }

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
          <h2><a href="${article.url}" target="_blank">${article.title}</a></h2>
          <div class="paragraph-container">
          <p class="article-summary">${article.abstract}</p>
          <button class="toggle-btn" onclick="toggleText(this)">More</button>
          </div>
          <div class="meta">
            <p><strong>${article.byline}</strong></p>
            <p class="sml">${new Date(article.created_date).toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
            })}</p>
          </div>
        </div>
      `;

            articlesContainer.appendChild(div);

            const img = div.querySelector('img');
            if (img) applyColorTheme(img, div);
        });

        hideButtonsForShortParagraphs();


        offsetArticles += 3;
        loading.style.display = 'none';
    }

    async function loadMovies() {
        loading.style.display = 'block';
        loading.innerText = 'Loading...';

        const response = await fetch(`/v1/moviesfeed?offset=${offsetMovies}&limit=3`);
        const data = await response.json();

        if (data.length === 0) {
            loading.innerText = 'No more movies.';
            loading.style.display = 'block';
            return;
        }

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
          <h2><a href="https://www.themoviedb.org/${movie.media_type || 'movie'}/${movie.id}" target="_blank">${movie.name || movie.title}</a></h2>
        <div class="paragraph-container">
          <p class="article-summary">${movie.overview || 'No description available.'}</p>
          <button class="toggle-btn" onclick="toggleText(this)">More</button>
          </div>
          <div class="meta">
            <p><strong><img class="svg" src="static/images/rating.svg" alt="rating"> ${movie.vote_average} (${movie.vote_count} votes)</strong></p>
            <p class="sml">${new Date(movie.first_air_date || movie.release_date || '').toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
            })}</p>
          </div>
        </div>
      `;

            moviesContainer.appendChild(div);

            const img = div.querySelector('img');
            if (img) applyColorTheme(img, div);
        });

        hideButtonsForShortParagraphs();


        offsetMovies += 3;
        loading.style.display = 'none';
    }

    // Check which panel is visible using aria-hidden attribute
    function isVisible(panel) {
        return panel.getAttribute('aria-hidden') === 'false';
    }

    // Reset offsets and clear container when switching tabs
    function resetAndLoad(panel) {
        loading.innerText = 'Loading...';
        loading.style.display = 'none';

        if (panel === articlesContainer) {
            offsetArticles = 0;
            articlesContainer.innerHTML = '<h2>Latest News</h2>';
            loadArticles();
        } else if (panel === moviesContainer) {
            offsetMovies = 0;
            moviesContainer.innerHTML = '<h2>Latest Movies</h2>';
            loadMovies();
        }
    }

    // Infinite scroll
    window.addEventListener('scroll', () => {
        const nearBottom = window.innerHeight + window.scrollY >= document.body.offsetHeight - 100;

        if (nearBottom && loading.style.display === 'none') {
            if (isVisible(articlesContainer)) {
                loadArticles();
            } else if (isVisible(moviesContainer)) {
                loadMovies();
            }
        }
    });

    // Tabs code
    const tabList = document.querySelector('.tabs-nav');
    const tabs = tabList.querySelectorAll('.tab-button');
    const panels = document.querySelectorAll('.tab-panel');
    const indicator = document.querySelector('.tabs-indicator');

    const setIndicatorPosition = tab => {
        indicator.style.transform = `translateX(${tab.offsetLeft}px)`;
        indicator.style.width = `${tab.offsetWidth}px`;
    };

    setIndicatorPosition(tabs[0]);

    tabs.forEach(tab => {
        tab.addEventListener('click', e => {
            const targetTab = e.target;
            const targetPanel = document.querySelector(`#${targetTab.getAttribute('aria-controls')}`);

            // Update tabs
            tabs.forEach(t => {
                t.setAttribute('aria-selected', 'false');
                t.classList.remove('active');
            });
            targetTab.setAttribute('aria-selected', 'true');
            targetTab.classList.add('active');

            // Update panels
            panels.forEach(panel => panel.setAttribute('aria-hidden', 'true'));
            targetPanel.setAttribute('aria-hidden', 'false');

            setIndicatorPosition(targetTab);

            // Reset loading text and hide loader
            loading.innerText = 'Loading...';
            loading.style.display = 'none';

            // Reset offsets and load content for the active panel
            resetAndLoad(targetPanel);
        });
    });

    // Initial load depending on which panel is visible
    if (isVisible(articlesContainer)) {
        resetAndLoad(articlesContainer);
    } else if (isVisible(moviesContainer)) {
        resetAndLoad(moviesContainer);
    }
});

// navigation
const navlist = document.querySelector("#nav");
const headMain = document.querySelector(".navi");
const hiddenElems = document.querySelectorAll(".hidden");
const spone = document.querySelector("#spone");
const sptwo = document.querySelector("#sptwo");

navlist.addEventListener("click", () => {
    headMain.classList.toggle('activenv');
    spone.classList.toggle('togglespone');
    sptwo.classList.toggle('togglesptwo');
    hiddenElems.forEach(el => el.classList.toggle('active'));
});

// paragraph limit to 4 and click function
// function toggleText(btn) {
//   const paragraph = btn.previousElementSibling;
//   paragraph.classList.toggle("expanded");
//   btn.textContent = paragraph.classList.contains("expanded") ? "Read less" : "Read more";
// }

// new 
function toggleText(btn) {
    const paragraph = btn.previousElementSibling;
    paragraph.classList.toggle("expanded");
    btn.textContent = paragraph.classList.contains("expanded") ? "Less" : "More";
}

function hideButtonsForShortParagraphs() {
    const paragraphs = document.querySelectorAll('.article-summary');
    paragraphs.forEach(paragraph => {
        const button = paragraph.nextElementSibling;

        // Clone and measure full height without clamp
        const clone = paragraph.cloneNode(true);
        clone.style.webkitLineClamp = 'unset';
        clone.style.display = 'block';
        clone.style.position = 'absolute';
        clone.style.visibility = 'hidden';
        clone.style.height = 'auto';
        clone.style.maxHeight = 'none';
        clone.style.overflow = 'visible';
        document.body.appendChild(clone);

        const actualHeight = clone.offsetHeight;
        const lineHeight = parseFloat(getComputedStyle(paragraph).lineHeight);
        const clampHeight = lineHeight * 4;

        // Remove the clone
        document.body.removeChild(clone);

        if (actualHeight <= clampHeight + 1) {
            button.style.display = 'none'; // Hide button if <= 4 lines
        }
    });
}
