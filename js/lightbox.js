(function () {
  const overlay = document.createElement('div');
  overlay.className = 'lightbox';
  overlay.innerHTML =
    '<button class="lightbox__close" type="button" aria-label="Close">' +
    '<svg viewBox="0 0 16 16" fill="none"><path d="M1 1L15 15M15 1L1 15" stroke="currentColor" stroke-width="1.5"/></svg>' +
    '</button><img alt="">';
  document.body.appendChild(overlay);

  const img = overlay.querySelector('img');
  const closeBtn = overlay.querySelector('.lightbox__close');

  function open(src, alt) {
    img.src = src;
    img.alt = alt || '';
    overlay.classList.add('is-open');
    document.body.classList.add('lightbox-open');
  }

  function close() {
    overlay.classList.remove('is-open');
    document.body.classList.remove('lightbox-open');
  }

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || e.target === img) close();
  });
  closeBtn.addEventListener('click', close);
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });

  document.querySelectorAll('[data-lightbox] img').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      open(el.currentSrc || el.src, el.alt);
    });
  });
})();
