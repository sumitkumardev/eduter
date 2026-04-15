/* ============================================================
   script.js — CarouselManager + tabs + nav (v4)
   Dynamic-height slides, content truncation, responsive
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
    const colorThief = new ColorThief();

    // ── Utility helpers ─────────────────────────────────────

    // Content character limit — truncate raw text before rendering
    const CONTENT_CHAR_LIMIT = 350;

    function truncateText(text, limit) {
        if (!text || text.length <= limit) return text || '';
        // cut at last space before limit
        const trimmed = text.substring(0, limit);
        const lastSpace = trimmed.lastIndexOf(' ');
        return (lastSpace > 0 ? trimmed.substring(0, lastSpace) : trimmed) + '…';
    }

    // Proxy external images through wsrv.nl to add CORS headers
    function proxyUrl(url) {
        if (!url) return '';
        if (url.startsWith('/') || url.startsWith('data:')) return url;
        return `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=600&q=80`;
    }

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

    function applyFallbackTheme(container) {
        container.style.backgroundColor = '#1a1a2e';
        container.style.color = '#e0e0e0';
        container.querySelectorAll('.slide-content, a, p, h2, strong, button, .slide-meta').forEach(el => {
            el.style.color = '#e0e0e0';
        });
    }

    function applyColorTheme(img, container) {
        const apply = () => {
            try {
                const palette = colorThief.getPalette(img, 5);
                const majorityColor = palette[0];
                const adjustedColor = adjustForPremiumContrast(majorityColor);
                const textColor = getContrastTextColor(adjustedColor);
                container.style.backgroundColor = `rgb(${adjustedColor.join(',')})`;
                container.style.color = textColor;
                container.querySelectorAll('.slide-content, a, p, h2, strong, button, .slide-meta').forEach(el => {
                    el.style.color = textColor;
                });
            } catch (e) {
                console.warn('Color extraction failed, using fallback:', e);
                applyFallbackTheme(container);
            }
        };
        if (img.complete && img.naturalWidth > 0) apply();
        else {
            img.addEventListener('load', apply);
            img.addEventListener('error', () => applyFallbackTheme(container));
        }
    }

    function getRootDomain(url) {
        try { return new URL(url).hostname.replace(/^www\./, ''); }
        catch { return ''; }
    }

    // ── hideButtonsForShortParagraphs — only for given elements ──
    function hideButtonsForShortParagraphs(paragraphs) {
        paragraphs.forEach(paragraph => {
            const button = paragraph.nextElementSibling;
            if (!button) return;
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
            const lineHeight = parseFloat(getComputedStyle(paragraph).lineHeight) || 20;
            // get current clamp value (3 on mobile, up to 6 on desktop)
            const clampLines = parseInt(getComputedStyle(paragraph).webkitLineClamp) || 4;
            const clampHeight = lineHeight * clampLines;
            document.body.removeChild(clone);
            if (actualHeight <= clampHeight + 1) {
                button.style.display = 'none';
            }
        });
    }

    // ══════════════════════════════════════════════════════════
    //  CarouselManager — one instance per tab (news / movies)
    //  Supports dynamic-height slides with cumulative offsets
    // ══════════════════════════════════════════════════════════
    class CarouselManager {
        constructor({ container, track, loader, endpoint, dataKey, renderFn }) {
            this.container = container;
            this.track = track;
            this.loader = loader;
            this.endpoint = endpoint;
            this.dataKey = dataKey;
            this.renderFn = renderFn;

            this.slides = [];
            this.currentIndex = 0;
            this.offset = 0;
            this.batchSize = 3;
            this.prefetchThreshold = 2;
            this.isLoading = false;
            this.hasMore = true;
            this.initialised = false;

            // Touch state
            this.touchStartY = 0;
            this.touchDeltaY = 0;
            this.isSwiping = false;

            // Wheel debounce
            this._wheelLocked = false;

            this._bindEvents();
        }

        // ── Public API ──────────────────────────────────────
        async init() {
            if (this.initialised && this.slides.length > 0) {
                this._setSlideHeights();
                this.goToSlide(this.currentIndex, false);
                return;
            }
            this.initialised = true;
            await this._fetchBatch();
            this._setSlideHeights();
            if (this.slides.length > 0) this.goToSlide(0, false);
        }

        // Calculate cumulative Y offset for a given slide index
        _getSlideOffset(index) {
            const containerH = this.container.offsetHeight;
            return index * containerH;
        }

        _setSlideHeights() {
            const h = this.container.offsetHeight;
            this.slides.forEach(slide => {
                slide.style.height = `${h}px`;
            });
        }

        goToSlide(index, animate = true) {
            if (index < 0 || index >= this.slides.length) return;
            this.currentIndex = index;

            const translateY = -this._getSlideOffset(index);

            if (animate) {
                this.track.style.transition = 'transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
            } else {
                this.track.style.transition = 'none';
            }
            this.track.style.transform = `translateY(${translateY}px)`;

            this._checkPrefetch();
        }

        // ── Data fetching ───────────────────────────────────
        async _fetchBatch() {
            if (this.isLoading || !this.hasMore) return;
            this.isLoading = true;
            this.loader.style.display = 'block';
            this.loader.textContent = 'Loading...';

            try {
                const resp = await fetch(`${this.endpoint}?offset=${this.offset}&limit=${this.batchSize}`);
                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                const json = await resp.json();

                const items = json[this.dataKey] || [];
                this.hasMore = json.has_more ?? items.length === this.batchSize;

                items.forEach(item => {
                    const slide = this.renderFn(item);
                    this.track.appendChild(slide);
                    this.slides.push(slide);
                });

                this._setSlideHeights();
                this.offset += items.length;

                if (items.length === 0 && this.slides.length === 0) {
                    this.loader.textContent = 'Nothing to show.';
                } else {
                    this.loader.style.display = 'none';
                }
            } catch (e) {
                console.error('Fetch failed:', e);
                this.loader.textContent = 'Failed to load. Pull down to retry.';
            } finally {
                this.isLoading = false;
            }
        }

        async _checkPrefetch() {
            const remaining = this.slides.length - this.currentIndex - 1;
            if (remaining <= this.prefetchThreshold && this.hasMore && !this.isLoading) {
                await this._fetchBatch();
            }
        }

        // ── Event binding ───────────────────────────────────
        _bindEvents() {
            // Touch
            this.container.addEventListener('touchstart', e => this._onTouchStart(e), { passive: true });
            this.container.addEventListener('touchmove', e => this._onTouchMove(e), { passive: false });
            this.container.addEventListener('touchend', e => this._onTouchEnd(e), { passive: true });

            // Mouse wheel
            this.container.addEventListener('wheel', e => this._onWheel(e), { passive: false });

            // Keyboard
            this.container.setAttribute('tabindex', '0');
            this.container.addEventListener('keydown', e => this._onKeyDown(e));

            // Recalculate on resize
            window.addEventListener('resize', () => {
                this._setSlideHeights();
                this.goToSlide(this.currentIndex, false);
            });
        }

        // ── Touch handlers ──────────────────────────────────
        _onTouchStart(e) {
            this.touchStartY = e.touches[0].clientY;
            this.touchDeltaY = 0;
            this.isSwiping = true;
            this.track.style.transition = 'none';
        }

        _onTouchMove(e) {
            if (!this.isSwiping) return;
            e.preventDefault();
            this.touchDeltaY = e.touches[0].clientY - this.touchStartY;
            const base = -this._getSlideOffset(this.currentIndex);
            this.track.style.transform = `translateY(${base + this.touchDeltaY}px)`;
        }

        _onTouchEnd() {
            if (!this.isSwiping) return;
            this.isSwiping = false;
            const threshold = this.container.offsetHeight * 0.15;

            if (this.touchDeltaY < -threshold && this.currentIndex < this.slides.length - 1) {
                this.goToSlide(this.currentIndex + 1);
            } else if (this.touchDeltaY > threshold && this.currentIndex > 0) {
                this.goToSlide(this.currentIndex - 1);
            } else {
                this.goToSlide(this.currentIndex);
            }
        }

        // ── Wheel handler ───────────────────────────────────
        _onWheel(e) {
            e.preventDefault();
            if (this._wheelLocked) return;
            this._wheelLocked = true;

            if (e.deltaY > 30 && this.currentIndex < this.slides.length - 1) {
                this.goToSlide(this.currentIndex + 1);
            } else if (e.deltaY < -30 && this.currentIndex > 0) {
                this.goToSlide(this.currentIndex - 1);
            }

            setTimeout(() => { this._wheelLocked = false; }, 500);
        }

        // ── Keyboard handler ────────────────────────────────
        _onKeyDown(e) {
            if (e.key === 'ArrowDown' || e.key === ' ') {
                e.preventDefault();
                if (this.currentIndex < this.slides.length - 1) this.goToSlide(this.currentIndex + 1);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (this.currentIndex > 0) this.goToSlide(this.currentIndex - 1);
            }
        }
    }

    // ══════════════════════════════════════════════════════════
    //  Slide renderers
    // ══════════════════════════════════════════════════════════
    function renderArticleSlide(article) {
        const slide = document.createElement('div');
        slide.className = 'carousel-slide';

        let imgHTML = '';
        if (article.image_url) {
            const proxiedSrc = proxyUrl(article.image_url);
            imgHTML = `<div class="slide-image"><img crossorigin="anonymous" loading="lazy" src="${proxiedSrc}" alt="${article.title || ''}"></div>`;
        }

        const creator = article.creator
            ? article.creator
            : (article.source ? getRootDomain(article.source) : 'Unknown');

        const dateStr = article.published_at
            ? new Date(article.published_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
            : '';

        // Truncate content before rendering
        const contentText = truncateText(article.content || article.abstract || '', CONTENT_CHAR_LIMIT);

        slide.innerHTML = `
            ${imgHTML}
            <div class="slide-content">
                <h2><a href="${article.url || '#'}" target="_blank">${article.title || 'Untitled'}</a></h2>
                <div class="paragraph-container">
                    <p class="article-summary">${contentText}</p>
                    <button class="toggle-btn" onclick="toggleText(this)">More</button>
                </div>
                <div class="slide-meta">
                    <p><strong>${creator}</strong></p>
                    <p class="sml">${dateStr}</p>
                </div>
            </div>
        `;

        // Color theming
        const img = slide.querySelector('img');
        if (img) applyColorTheme(img, slide);

        // hideButtonsForShort — defer to next frame so layout is computed
        requestAnimationFrame(() => {
            const summaries = slide.querySelectorAll('.article-summary');
            hideButtonsForShortParagraphs(summaries);
        });

        return slide;
    }

    function renderMovieSlide(movie) {
        const slide = document.createElement('div');
        slide.className = 'carousel-slide';

        let imgHTML = '';
        if (movie.poster_path) {
            const imgUrl = proxyUrl(`https://image.tmdb.org/t/p/w500${movie.poster_path}`);
            imgHTML = `<div class="slide-image"><img crossorigin="anonymous" loading="lazy" src="${imgUrl}" alt="${movie.name || movie.title || ''}"></div>`;
        }

        const dateStr = (movie.first_air_date || movie.release_date)
            ? new Date(movie.first_air_date || movie.release_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
            : '';

        // Truncate overview
        const overviewText = truncateText(movie.overview || 'No description available.', CONTENT_CHAR_LIMIT);

        slide.innerHTML = `
            ${imgHTML}
            <div class="slide-content">
                <h2><a href="https://www.themoviedb.org/${movie.media_type || 'movie'}/${movie.id}" target="_blank">${movie.name || movie.title || 'Untitled'}</a></h2>
                <div class="paragraph-container">
                    <p class="article-summary">${overviewText}</p>
                    <button class="toggle-btn" onclick="toggleText(this)">More</button>
                </div>
                <div class="slide-meta">
                    <p><strong><img class="svg" src="/static/images/rating.svg" alt="rating"> ${movie.vote_average ?? ''} (${movie.vote_count ?? 0} votes)</strong></p>
                    <p class="sml">${dateStr}</p>
                </div>
            </div>
        `;

        const img = slide.querySelector('img:not(.svg)');
        if (img) applyColorTheme(img, slide);

        requestAnimationFrame(() => {
            const summaries = slide.querySelectorAll('.article-summary');
            hideButtonsForShortParagraphs(summaries);
        });

        return slide;
    }

    // ══════════════════════════════════════════════════════════
    //  Instantiate carousels
    // ══════════════════════════════════════════════════════════
    const newsCarousel = new CarouselManager({
        container: document.getElementById('carousel-news'),
        track: document.getElementById('track-news'),
        loader: document.getElementById('loader-news'),
        endpoint: '/v1/newsfeed',
        dataKey: 'articles',
        renderFn: renderArticleSlide,
    });

    const moviesCarousel = new CarouselManager({
        container: document.getElementById('carousel-movies'),
        track: document.getElementById('track-movies'),
        loader: document.getElementById('loader-movies'),
        endpoint: '/v1/moviesfeed',
        dataKey: 'movies',
        renderFn: renderMovieSlide,
    });

    // ══════════════════════════════════════════════════════════
    //  Tabs
    // ══════════════════════════════════════════════════════════
    const tabList = document.querySelector('.tabs-nav');
    const tabs = tabList.querySelectorAll('.tab-button');
    const panels = document.querySelectorAll('.tab-panel');
    const indicator = document.querySelector('.tabs-indicator');

    const carouselMap = {
        articles: newsCarousel,
        movies: moviesCarousel,
    };

    const setIndicatorPosition = tab => {
        indicator.style.transform = `translateX(${tab.offsetLeft}px)`;
        indicator.style.width = `${tab.offsetWidth}px`;
    };

    setIndicatorPosition(tabs[0]);

    tabs.forEach(tab => {
        tab.addEventListener('click', e => {
            const targetTab = e.target;
            const panelId = targetTab.getAttribute('aria-controls');
            const targetPanel = document.getElementById(panelId);

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

            // Init carousel (won't re-fetch if already loaded)
            const carousel = carouselMap[panelId];
            if (carousel) carousel.init();
        });
    });

    // ── Initial load for the visible panel ───────────────────
    const visiblePanelId = document.querySelector('.tab-panel[aria-hidden="false"]')?.id;
    if (visiblePanelId && carouselMap[visiblePanelId]) {
        carouselMap[visiblePanelId].init();
    }

    // ── Navigation toggle (moved inside DOMContentLoaded) ───
    const navlist = document.querySelector("#nav");
    const headMain = document.querySelector(".navi");
    const hiddenElems = document.querySelectorAll(".hidden");
    const spone = document.querySelector("#spone");
    const sptwo = document.querySelector("#sptwo");

    if (navlist) {
        navlist.addEventListener("click", () => {
            headMain.classList.toggle('activenv');
            spone.classList.toggle('togglespone');
            sptwo.classList.toggle('togglesptwo');
            hiddenElems.forEach(el => el.classList.toggle('active'));
        });
    }
});

// ══════════════════════════════════════════════════════════
//  Global functions (must be outside DOMContentLoaded)
// ══════════════════════════════════════════════════════════

// paragraph expand/collapse
function toggleText(btn) {
    const paragraph = btn.previousElementSibling;
    paragraph.classList.toggle("expanded");
    btn.textContent = paragraph.classList.contains("expanded") ? "Less" : "More";
}
