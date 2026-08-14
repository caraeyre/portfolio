(function () {
  const stage = document.querySelector('[data-stage]');
  if (!stage) return;

  const panels = Array.from(document.querySelectorAll('[data-project]'));
  let activeIndex = Math.max(0, panels.findIndex((p) => p.classList.contains('is-active')));
  if (activeIndex < 0) activeIndex = 0;

  let transitioning = false;
  const TRANSITION_MS = 1100;
  const AUTO_ADVANCE_MS = 8000;

  // each project's own image-page auto-advance (see panels.forEach below) only actually
  // runs while that project is the one on screen — registered here so goToProject can
  // reach into a specific panel's pagination closure without every panel needing to know
  // about any other.
  const pageControllers = new Map();

  // every project past the first one ships its images/videos as data-src instead of src
  // (see projects.html) — loading all 8 projects' media up front was ~70MB on a fresh
  // visit and made the page take well over a minute to finish loading. loadPanel swaps a
  // panel's media over to real src, once, the first time it's actually needed; every
  // already-loaded panel is a no-op on repeat calls since there's nothing left to swap.
  const loadedPanels = new WeakSet();
  function loadPanel(panel) {
    if (!panel || loadedPanels.has(panel)) return;
    loadedPanels.add(panel);
    panel.querySelectorAll('[data-src]').forEach((el) => {
      el.src = el.dataset.src;
      delete el.dataset.src;
      if (el.tagName === 'VIDEO') el.load();
    });
  }

  // desktop: panels are stacked via absolute positioning (see projects.css), so they all
  // geometrically occupy the same box regardless of which is active — there's no scroll
  // position to watch. Instead, load a panel the moment it becomes active, plus its two
  // immediate neighbours (whichever direction the visitor goes next), so continuing to
  // wheel/swipe through never shows a blank flash while the next project's media fetches.
  function preloadAround(index) {
    loadPanel(panels[index]);
    loadPanel(panels[(index + 1) % panels.length]);
    loadPanel(panels[(index - 1 + panels.length) % panels.length]);
  }

  // mobile: every panel sits in the page's normal flow, so a generous-rootMargin
  // IntersectionObserver can watch real scroll position instead — each panel's media
  // loads once it's within about a screen's height of coming into view, well before the
  // visitor actually reaches it.
  const panelLoadObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) loadPanel(entry.target);
    });
  }, { rootMargin: '800px 0px' });
  panels.forEach((panel) => panelLoadObserver.observe(panel));

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
    pageControllers.get(panels[activeIndex])?.onLeave();
    panels[next].classList.add('is-active');
    panels[next].removeAttribute('aria-hidden');
    pageControllers.get(panels[next])?.onEnter();
    activeIndex = next;
    preloadAround(next);
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
  if (isDesktop()) preloadAround(activeIndex);

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
    let autoAdvanceTimer = null;

    function renderPageNav() {
      prevBtn.hidden = !hasNavigated;
      nextBtn.hidden = false;
    }

    // slideshow: each page waits 8s for the visitor to page through manually before
    // advancing on its own. Any navigation — auto or manual — restarts the countdown, so
    // a visitor who's actively clicking/swiping never gets interrupted mid-look. Pages
    // holding a video are exempt — a visitor watching one shouldn't get bumped along
    // mid-clip, and the video's own gated start/stop (see wireGatedVideo below) already
    // resets it fresh every time its page is (re-)entered regardless.
    function scheduleAutoAdvance() {
      window.clearTimeout(autoAdvanceTimer);
      if (pages[pageIndex].querySelector('video')) return;
      autoAdvanceTimer = window.setTimeout(() => goToPage(pageIndex + 1), AUTO_ADVANCE_MS);
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
      scheduleAutoAdvance();
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

    // desktop: this project's own auto-advance should only run while it's actually the one
    // on screen — starting it for every project at load time (regardless of whether
    // they're the visible one) is exactly what made background projects drift away from
    // page 1 before the visitor ever got to them. goToProject calls onEnter/onLeave as the
    // visitor switches projects; only the initially-active project needs it started here.
    // Mobile has no equivalent "which project is active" concept (every project sits in
    // the page's normal flow at once), so there every project's auto-advance just runs
    // from the start, unaffected by this.
    pageControllers.set(panel, {
      onEnter: scheduleAutoAdvance,
      onLeave() {
        window.clearTimeout(autoAdvanceTimer);
        if (pageIndex !== 0) {
          pages[pageIndex].classList.remove('is-active');
          pages[0].classList.add('is-active');
          pageIndex = 0;
          hasNavigated = false;
          renderPageNav();
        }
      },
    });
    if (!isDesktop() || panel.classList.contains('is-active')) scheduleAutoAdvance();

    // mobile: there's no goToProject switch to hang the "reset to page 1" behaviour off
    // (see above — it no-ops below the carousel breakpoint), so watch the panel itself
    // and call the same onLeave reset once it's scrolled fully out of view. That way
    // scrolling back up to a project later always finds it back on page 1, matching
    // desktop's behaviour when re-entering a project.
    const panelResetObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (isDesktop() || entry.isIntersecting) return;
        pageControllers.get(panel)?.onLeave();
      });
    }, { threshold: 0 });
    panelResetObserver.observe(panel);
  });

  // any row of one or more videos that should only play while its own page is actually on
  // screen: relay:true chains multiple clips (Mandala hands off to Spiral logic and back);
  // relay:false just loops a single clip. Leaving the page (however that happens — the
  // arrows, a swipe, the auto-advance timer, or switching to a different project entirely)
  // stops every clip in the row and rewinds it, so coming back always starts fresh.
  function wireGatedVideo(row, { relay }) {
    const clips = Array.from(row.querySelectorAll('video'));
    if (!clips.length) return;
    const panel = row.closest('[data-project]');
    const page = row.closest('[data-page]');

    function stopClips() {
      clips.forEach((clip) => {
        clip.pause();
        clip.currentTime = 0;
      });
    }

    function startClips() {
      if (clips.every((clip) => clip.paused)) clips[0].play().catch(() => {});
    }

    if (relay && clips.length > 1) {
      clips.forEach((clip, i) => {
        clip.addEventListener('ended', () => {
          clip.currentTime = 0;
          clips[(i + 1) % clips.length].play().catch(() => {});
        });
      });
    } else {
      clips.forEach((clip) => { clip.loop = true; });
    }

    // desktop: page/project activation is a class toggle (an opacity crossfade, not an
    // actual change in on-screen position), so a MutationObserver on those two classes
    // catches every way the row's page can become the visible one — or stop being it —
    // regardless of which navigation path triggered the change.
    function syncDesktopVisibility() {
      if (!isDesktop()) return;
      const visible = panel.classList.contains('is-active') && page.classList.contains('is-active');
      if (visible) startClips(); else stopClips();
    }
    new MutationObserver(syncDesktopVisibility).observe(panel, { attributes: true, attributeFilter: ['class'] });
    new MutationObserver(syncDesktopVisibility).observe(page, { attributes: true, attributeFilter: ['class'] });

    // mobile: every project/page sits in normal document flow, so "active" alone doesn't
    // mean on-screen — an IntersectionObserver catches the visitor actually scrolling this
    // row into (or out of) view.
    const io = new IntersectionObserver((entries) => {
      if (isDesktop()) return;
      entries.forEach((entry) => {
        if (entry.isIntersecting) startClips(); else stopClips();
      });
    }, { threshold: 0.5 });
    io.observe(row);

    window.addEventListener('resize', syncDesktopVisibility);
    syncDesktopVisibility();

    // mobile Safari (and some other mobile browsers) block a video's very first
    // programmatic play() unless it happens inside a direct user gesture — but the
    // triggers above (an observer callback, a resize) never count as one. Priming every
    // clip with a play()-then-immediate-pause() on the visitor's first tap/click anywhere
    // satisfies that gesture requirement up front, so the real, gated play() calls later —
    // gesture or not — are allowed through.
    function unlock() {
      clips.forEach((clip) => {
        clip.play().then(() => clip.pause()).catch(() => {});
      });
      document.removeEventListener('touchstart', unlock);
      document.removeEventListener('click', unlock);
    }
    document.addEventListener('touchstart', unlock, { once: true, passive: true });
    document.addEventListener('click', unlock, { once: true });
  }

  // a row of multiple clips that relay back and forth (not currently used by any page, but
  // kept wired up — TRC's old video slide used this before it was removed).
  document.querySelectorAll('.project__page-row--videos').forEach((row) => wireGatedVideo(row, { relay: true }));
  // PCP's and Arkology's video+image rows: one looping clip apiece.
  document.querySelectorAll('.project__page-row--gated-video').forEach((row) => wireGatedVideo(row, { relay: false }));
})();
