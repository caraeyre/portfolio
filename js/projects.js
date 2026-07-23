(function () {
  const stage = document.querySelector('[data-stage]');
  if (!stage) return;

  const panels = Array.from(document.querySelectorAll('[data-project]'));
  let activeIndex = Math.max(0, panels.findIndex((p) => p.classList.contains('is-active')));
  if (activeIndex < 0) activeIndex = 0;

  let transitioning = false;
  const TRANSITION_MS = 1100;

  // below this width every project is shown in full, stacked in normal document flow (see
  // projects.css) — the whole single-active-panel carousel and its navigation only apply
  // at and above it
  const isDesktop = () => window.matchMedia('(min-width: 900px)').matches;

  function syncTheme(panel) {
    const isLight = panel.classList.contains('project--light');
    document.querySelectorAll('.projects-page, .projects-frame, .projects-page__header').forEach((el) => {
      el.classList.toggle('theme-light', isLight);
      el.classList.toggle('theme-dark', !isLight);
    });
  }

  // project-to-project navigation loops in both directions: past the last project wraps
  // to the first, and back past the first wraps to the last. Desktop only.
  function goToProject(index) {
    if (!isDesktop()) return;
    const next = (index + panels.length) % panels.length;
    if (next === activeIndex || transitioning) return;
    panels[activeIndex].classList.remove('is-active');
    panels[activeIndex].setAttribute('aria-hidden', 'true');
    panels[next].classList.add('is-active');
    panels[next].removeAttribute('aria-hidden');
    activeIndex = next;
    syncTheme(panels[next]);
    transitioning = true;
    window.setTimeout(() => { transitioning = false; }, TRANSITION_MS);
  }

  // on mobile every panel is visible in the page's normal flow, so none of them should be
  // hidden from assistive tech. The header still follows whichever project is currently in
  // view, though — just driven by scroll position (via the observer below) instead of by
  // which panel is "active", since there is no single active panel once everything is
  // stacked.
  function syncForViewport() {
    if (isDesktop()) {
      panels.forEach((panel, i) => {
        if (i !== activeIndex) panel.setAttribute('aria-hidden', 'true');
        else panel.removeAttribute('aria-hidden');
      });
      syncTheme(panels[activeIndex]);
    } else {
      panels.forEach((panel) => panel.removeAttribute('aria-hidden'));
      syncTheme(panels[0]);
    }
  }

  syncForViewport();
  window.addEventListener('resize', syncForViewport);

  // below the carousel breakpoint, follow scroll position: the header/frame theme should
  // switch right as a new project's description reaches the top — not partway through its
  // images — since the description comes first in the mobile reading order. Watching each
  // .project__text with a rootMargin that shrinks the observer's "visible" zone down to
  // just the top of the stage means a text block only counts as intersecting once it's
  // actually reached that top strip, rather than whenever any part of it is on screen.
  // Desktop ignores this — its theme is driven by goToProject instead.
  const headerSyncObserver = new IntersectionObserver((entries) => {
    if (isDesktop()) return;
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const panel = entry.target.closest('.project');
      if (panel) syncTheme(panel);
    });
  }, { root: stage, rootMargin: '0px 0px -80% 0px', threshold: 0 });
  panels.forEach((panel) => {
    const text = panel.querySelector('.project__text');
    if (text) headerSyncObserver.observe(text);
  });

  // wheel: advance to the next/previous project within the same fixed box (desktop only —
  // goToProject no-ops below that width)
  let wheelLock = false;
  stage.addEventListener('wheel', (e) => {
    if (!isDesktop()) return;
    e.preventDefault();
    if (wheelLock || Math.abs(e.deltaY) < 4) return;
    wheelLock = true;
    goToProject(activeIndex + (e.deltaY > 0 ? 1 : -1));
    window.setTimeout(() => { wheelLock = false; }, TRANSITION_MS);
  }, { passive: false });

  // touch: swipe up/down to change project — desktop only (e.g. a touchscreen laptop). On
  // mobile every project is already stacked in the page's normal flow, so the visitor just
  // scrolls natively and none of this runs.
  let touchStartY = null;
  let touchScrollable = null;

  stage.addEventListener('touchstart', (e) => {
    if (!isDesktop()) return;
    touchStartY = e.touches[0].clientY;
    touchScrollable = null;
    let el = e.target;
    while (el && el !== stage) {
      if (el.scrollHeight > el.clientHeight + 1) { touchScrollable = el; break; }
      el = el.parentElement;
    }
  }, { passive: true });

  stage.addEventListener('touchend', (e) => {
    if (!isDesktop() || touchStartY === null) return;
    const dy = touchStartY - e.changedTouches[0].clientY;
    touchStartY = null;
    if (Math.abs(dy) < 40) return;
    if (touchScrollable) {
      const atTop = touchScrollable.scrollTop <= 0;
      const atBottom = touchScrollable.scrollTop + touchScrollable.clientHeight >= touchScrollable.scrollHeight - 1;
      if (dy > 0 && !atBottom) return;
      if (dy < 0 && !atTop) return;
    }
    goToProject(activeIndex + (dy > 0 ? 1 : -1));
  }, { passive: true });

  // keyboard: arrow up/down cycles projects (desktop only)
  window.addEventListener('keydown', (e) => {
    if (!isDesktop()) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); goToProject(activeIndex + 1); }
    if (e.key === 'ArrowUp') { e.preventDefault(); goToProject(activeIndex - 1); }
  });

  // keyboard: arrow left/right pages through the active project's own images, mirroring
  // its on-screen prev/next arrows (desktop only)
  window.addEventListener('keydown', (e) => {
    if (!isDesktop()) return;
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const activePanel = panels[activeIndex];
    const btn = activePanel.querySelector(e.key === 'ArrowRight' ? '[data-page-next]' : '[data-page-prev]');
    if (btn) { e.preventDefault(); btn.click(); }
  });

  // paginated image pages: the media box's bounds stay fixed — only the page inside
  // crossfades. Prev/next chevrons page through and loop; the prev chevron stays hidden
  // until the visitor has navigated at least once (so page 1 loads arrow-clean on entry,
  // but shows a back arrow once you've looped around to it again). Projects with only one
  // page (e.g. Grassroots Economics) hide both chevrons entirely. Works the same on mobile
  // and desktop; only the animation lock is desktop-only, since below the carousel
  // breakpoint a page swap is an instant display:none/flex toggle with no crossfade to
  // wait out (see projects.css).
  panels.forEach((panel) => {
    const pagesWrap = panel.querySelector('[data-pages]');
    const prevBtn = panel.querySelector('[data-page-prev]');
    const nextBtn = panel.querySelector('[data-page-next]');
    if (!pagesWrap || !prevBtn || !nextBtn) return;

    const pages = Array.from(pagesWrap.querySelectorAll('[data-page]'));
    if (pages.length < 2) { prevBtn.hidden = true; nextBtn.hidden = true; return; }

    let pageIndex = Math.max(0, pages.findIndex((p) => p.classList.contains('is-active')));
    let hasNavigated = false;
    let pageTransitioning = false;

    function renderPageNav() {
      prevBtn.hidden = !hasNavigated;
      nextBtn.hidden = false;
    }

    function goToPage(nextIndex) {
      if (pageTransitioning) return;
      const next = (nextIndex + pages.length) % pages.length;
      if (next === pageIndex) return;
      pages[pageIndex].classList.remove('is-active');
      pages[next].classList.add('is-active');
      pageIndex = next;
      hasNavigated = true;
      if (isDesktop()) {
        pageTransitioning = true;
        window.setTimeout(() => { pageTransitioning = false; }, TRANSITION_MS);
      }
      renderPageNav();
    }

    nextBtn.addEventListener('click', (e) => { e.stopPropagation(); goToPage(pageIndex + 1); });
    prevBtn.addEventListener('click', (e) => { e.stopPropagation(); goToPage(pageIndex - 1); });

    // touch: swipe left/right on the images themselves to page through them too, mirroring
    // the arrows — mainly for mobile, where there's no click-and-drag equivalent. Only
    // fires for a clearly horizontal gesture (dx bigger than dy), so it doesn't fight the
    // page's normal vertical scroll.
    let pageTouchStartX = null;
    let pageTouchStartY = null;
    pagesWrap.addEventListener('touchstart', (e) => {
      pageTouchStartX = e.touches[0].clientX;
      pageTouchStartY = e.touches[0].clientY;
    }, { passive: true });
    pagesWrap.addEventListener('touchend', (e) => {
      if (pageTouchStartX === null) return;
      const dx = pageTouchStartX - e.changedTouches[0].clientX;
      const dy = pageTouchStartY - e.changedTouches[0].clientY;
      pageTouchStartX = null;
      pageTouchStartY = null;
      if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return;
      goToPage(pageIndex + (dx > 0 ? 1 : -1));
    }, { passive: true });

    renderPageNav();
  });
})();
