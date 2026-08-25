const bitsItems = document.querySelectorAll('.bits-item');

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

bitsItems.forEach((item) => observer.observe(item));

// media loading: the canvas is split into quarters by vertical position (--y). The
// first quarter ships with real src on every img/video (see bits-and-bobs.html);
// quarters 2-4 ship as data-src. Reaching a quarter loads the two after it, so
// continuing to scroll down never catches up to a still-loading (and briefly
// empty-looking) section.
function itemQuarter(item) {
  const y = parseFloat(getComputedStyle(item).getPropertyValue('--y'));
  return Math.min(4, Math.floor(y / 25) + 1);
}

const loadedQuarters = new Set([1]);
function loadQuarter(q) {
  if (q < 1 || q > 4 || loadedQuarters.has(q)) return;
  loadedQuarters.add(q);
  bitsItems.forEach((item) => {
    if (itemQuarter(item) !== q) return;
    item.querySelectorAll('[data-src]').forEach((el) => {
      el.src = el.dataset.src;
      delete el.dataset.src;
      if (el.tagName === 'VIDEO') el.load();
    });
  });
}

const quarterLoadObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    const q = itemQuarter(entry.target);
    loadQuarter(q + 1);
    loadQuarter(q + 2);
  });
}, { rootMargin: '800px 0px' });
bitsItems.forEach((item) => quarterLoadObserver.observe(item));

const topBtn = document.querySelector('[data-scroll-top]');
if (topBtn) {
  topBtn.addEventListener('click', () => {
    // covers every case: standards-mode scrolls <html>, quirks-mode scrolls <body>, and
    // window.scrollTo covers whichever the browser reports as the real scrolling element
    window.scrollTo({ top: 0, behavior: 'smooth' });
    document.documentElement.scrollTo({ top: 0, behavior: 'smooth' });
    document.body.scrollTo({ top: 0, behavior: 'smooth' });
  });
}
