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
