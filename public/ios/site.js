const year = document.getElementById('y');
if (year) year.textContent = String(new Date().getFullYear());

const header = document.querySelector('.siteHeader');
if (header) {
  let compact = false;

  const onScroll = () => {
    const y = window.scrollY;
    const next = compact ? y > 4 : y > 24;
    if (next === compact) return;
    compact = next;
    header.toggleAttribute('data-compact', next);
  };

  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
}

const motionOk = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

document.querySelectorAll('[data-scroller]').forEach((root) => {
  const track = root.querySelector('[data-track]');
  if (!track) return;

  root.querySelectorAll('[data-scroll]').forEach((button) => {
    button.addEventListener('click', () => {
      const card = track.querySelector('li');
      const styles = getComputedStyle(track);
      const gap = Number.parseFloat(styles.columnGap || styles.gap) || 0;
      const amount = (card?.clientWidth ?? 320) + gap;
      const direction = Number(button.getAttribute('data-scroll'));
      track.scrollBy({
        left: amount * direction,
        behavior: motionOk ? 'smooth' : 'auto',
      });
    });
  });

  const dots = root.querySelector('[data-dots]');
  if (dots) {
    const marks = [...dots.children];
    const syncDots = () => {
      const width = track.clientWidth;
      if (!width) return;
      const index = Math.min(
        marks.length - 1,
        Math.max(0, Math.round(track.scrollLeft / width)),
      );
      marks.forEach((mark, i) => {
        mark.toggleAttribute('data-current', i === index);
      });
    };
    track.addEventListener('scroll', syncDots, { passive: true });
    syncDots();
  }
});
