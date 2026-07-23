(function () {
  const stage = document.querySelector('[data-stage]');
  if (!stage) return;

  const panels = Array.from(document.querySelectorAll('[data-project]'));
  let activeIndex = Math.max(0, panels.findIndex((p) => p.classList.contains('is-active')));
  if (activeIndex < 0) activeIndex = 0;

  let transitioning = false;
  const TRANSITION_MS = 1100;

  function syncTheme(panel) {
    const isLight = panel.classList.contains('project--light');
    document.querySelectorAll('.projects-page, .projects-frame, .projects-page__header').forEach((el) => {
      el.classList.toggle('theme-light', isLight);
      el.classList.toggle('theme-dark', !isLight);
    });
  }

  // project-to-project navigation loops in both directions: past the last project wraps
  // to the first, and back past the first wraps to the last
  function goToProject(index) {
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

  panels.forEach((panel, i) => {
    if (i !== activeIndex) panel.setAttribute('aria-hidden', 'true');
  });
  syncTheme(panels[activeIndex]);

  // wheel: advance to the next/previous project within the same fixed box
  let wheelLock = false;
  stage.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (wheelLock || Math.abs(e.deltaY) < 4) return;
    wheelLock = true;
    goToProject(activeIndex + (e.deltaY > 0 ? 1 : -1));
    window.setTimeout(() => { wheelLock = false; }, TRANSITION_MS);
  }, { passive: false });

  // touch: swipe up/down to change project (mobile has no wheel)
  let touchStartY = null;
  stage.addEventListener('touchstart', (e) => {
    touchStartY = e.touches[0].clientY;
  }, { passive: true });

  stage.addEventListener('touchend', (e) => {
    if (touchStartY === null) return;
    const dy = touchStartY - e.changedTouches[0].clientY;
    touchStartY = null;
    if (Math.abs(dy) < 40) return;
    goToProject(activeIndex + (dy > 0 ? 1 : -1));
  }, { passive: true });

  // keyboard: arrow up/down cycles projects
  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); goToProject(activeIndex + 1); }
    if (e.key === 'ArrowUp') { e.preventDefault(); goToProject(activeIndex - 1); }
  });

  // keyboard: arrow left/right pages through the active project's own images,
  // mirroring its on-screen prev/next arrows
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const activePanel = panels[activeIndex];
    const btn = activePanel.querySelector(e.key === 'ArrowRight' ? '[data-page-next]' : '[data-page-prev]');
    if (btn) { e.preventDefault(); btn.click(); }
  });

  // paginated image pages: the media box's bounds stay fixed — only the page inside
  // crossfades. Prev/next chevrons page through and loop; the prev chevron stays hidden
  // until the visitor has navigated at least once (so page 1 loads arrow-clean on entry,
  // but shows a back arrow once you've looped around to it again). Projects with only one
  // page (e.g. Grassroots Economics) hide both chevrons entirely.
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
      pageTransitioning = true;
      window.setTimeout(() => { pageTransitioning = false; }, TRANSITION_MS);
      renderPageNav();
    }

    nextBtn.addEventListener('click', (e) => { e.stopPropagation(); goToPage(pageIndex + 1); });
    prevBtn.addEventListener('click', (e) => { e.stopPropagation(); goToPage(pageIndex - 1); });

    renderPageNav();
  });
})();
