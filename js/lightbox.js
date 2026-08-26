(function () {
  const overlay = document.createElement('div');
  overlay.className = 'lightbox';
  overlay.innerHTML =
    '<button class="lightbox__close" type="button" aria-label="Close">' +
    '<svg viewBox="0 0 16 16" fill="none"><path d="M1 1L15 15M15 1L1 15" stroke="currentColor" stroke-width="1.5"/></svg>' +
    '</button><img alt="" hidden><video muted loop playsinline controls hidden></video>';
  document.body.appendChild(overlay);

  const img = overlay.querySelector('img');
  const video = overlay.querySelector('video');
  const closeBtn = overlay.querySelector('.lightbox__close');

  function openImage(src, alt) {
    video.pause();
    video.removeAttribute('src');
    video.hidden = true;
    img.src = src;
    img.alt = alt || '';
    img.hidden = false;
    overlay.classList.add('is-open');
    document.body.classList.add('lightbox-open');
  }

  function openVideo(src) {
    img.hidden = true;
    img.removeAttribute('src');
    video.src = src;
    video.hidden = false;
    video.play().catch(() => {});
    overlay.classList.add('is-open');
    document.body.classList.add('lightbox-open');
  }

  function close() {
    overlay.classList.remove('is-open');
    document.body.classList.remove('lightbox-open');
    video.pause();
  }

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || e.target === img || e.target === video) close();
  });
  closeBtn.addEventListener('click', close);
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });

  function openFor(el) {
    const src = el.currentSrc || el.src || el.dataset.src;
    if (!src) return;
    if (el.tagName === 'VIDEO') openVideo(src);
    else openImage(src, el.alt);
  }

  // media that hasn't loaded yet (see js/bits.js and js/projects.js — both ship images
  // as data-src until scrolled near) is set to visibility:hidden, which correctly takes
  // it out of hit-testing — so a click meant for a still-loading image falls through to
  // its container instead of doing nothing silently. A single click listener per
  // container (not per image — a container can hold several, e.g. a project__page-row)
  // resolves which one was actually meant: e.target directly if the click landed on a
  // loaded, visible image, otherwise whichever sibling's own box contains the click
  // point, falling back to its data-src so the right image opens at full size even
  // before its thumbnail has loaded.
  const containers = new Set();
  document.querySelectorAll('[data-lightbox] img, [data-lightbox] video').forEach((el) => {
    containers.add(el.parentElement);
  });

  containers.forEach((container) => {
    container.addEventListener('click', (e) => {
      if (e.target.tagName === 'IMG' || e.target.tagName === 'VIDEO') {
        e.stopPropagation();
        openFor(e.target);
        return;
      }
      const candidates = Array.from(container.querySelectorAll('img, video'));
      const hit = candidates.find((el) => {
        const r = el.getBoundingClientRect();
        return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      });
      if (hit) {
        e.stopPropagation();
        openFor(hit);
      }
    });
  });
})();
