document.addEventListener('DOMContentLoaded', () => {
    const colorThief = new ColorThief();
    let offset = 0;
    const articlesContainer = document.getElementById('articles');
    const loading = document.getElementById('loading');

    // Utility: Check luminance to decide white or black text
    function getContrastTextColor([r, g, b]) {
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b);
        return luminance > 186 ? 'black' : 'white'; // Rule of thumb
    }


    function adjustForPremiumContrast([r, g, b]) {
        const boost = 0.9;
        return [
            Math.max(0, Math.round(r * boost)),
            Math.max(0, Math.round(g * boost)),
            Math.max(0, Math.round(b * boost))
        ];
    }

    async function loadArticles() {
        loading.style.display = 'block';
        const response = await fetch(`/v1/newsfeed?offset=${offset}&limit=3`);
        const data = await response.json();

        data.forEach(article => {
            const divArt = document.createElement('div');
            divArt.className = 'article';

            let imgHTML = '';
            if (article.multimedia?.[0]?.url) {
                imgHTML = `<div class="thumb"><img crossorigin="anonymous" src="${article.multimedia[0].url}" alt="${article.title}"></div>`;
            }

            divArt.innerHTML = `
          ${imgHTML}
          <div class="contents">
            <h2><a href="${article.url}">${article.title}</a></h2>
            <p class="article-summary">${article.abstract}</p>
          <div class="meta"><p><strong>${article.byline}</strong></p>
            <p class="sml">${new Date(article.created_date).toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
            })}</p></div>

          </div>
        `;

            articlesContainer.appendChild(divArt);

            const img = divArt.querySelector('img');
            if (img) {
                img.addEventListener('load', () => {
                    try {
                        const palette = colorThief.getPalette(img, 5); // Get top 5 colors
                        const majorityColor = palette[0]; // Most dominant one
                        const adjustedColor = adjustForPremiumContrast(majorityColor);
                        const textColor = getContrastTextColor(adjustedColor);

                        divArt.style.backgroundColor = `rgb(${adjustedColor.join(',')})`;
                        divArt.style.color = textColor;

                        // Apply text color inside contents
                        divArt.querySelectorAll('.contents, a, p, h2, strong').forEach(el => {
                            el.style.color = textColor;
                        });
                    } catch (e) {
                        console.warn("Color extraction failed:", e);
                    }
                });
            }
        });

        if (data.length === 0) loading.innerText = "No more articles.";
        else loading.style.display = 'none';
        offset += 3;
    }

    // Infinite scroll
    window.addEventListener('scroll', () => {
        const nearBottom = window.innerHeight + window.scrollY >= document.body.offsetHeight - 100;
        if (nearBottom && loading.style.display === 'none') {
            loadArticles();
        }
    });

    loadArticles();
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