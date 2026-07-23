// Robust "always fills the screen" helper: sets --vh to 1% of the true
// visible viewport height (window.innerHeight), sidestepping inconsistent
// 100vh/100dvh behaviour across mobile browser chrome and embedded previews.
(function () {
  function setVH() {
    document.documentElement.style.setProperty('--vh', window.innerHeight * 0.01 + 'px');
  }
  setVH();
  window.addEventListener('resize', setVH);
  window.addEventListener('orientationchange', setVH);
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', setVH);
  }
})();
