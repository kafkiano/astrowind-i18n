/**
 * Balanced masonry layout for browsers without native CSS Grid masonry support.
 *
 * Unlike source-order CSS Grid packing, this script distributes items into the
 * visually shortest column first, which produces a much tighter masonry layout
 * when images have different aspect ratios. Wide items can span multiple columns.
 *
 * Native support (Firefox / future Chrome) uses `grid-template-rows: masonry`
 * and source order. When native support is detected, this script skips the
 * column-balancing algorithm and lets CSS handle the layout.
 *
 * Inspired by: https://css-tricks.com/making-a-masonry-layout-that-works-today/
 */
(function () {
  'use strict';

  if (window.__masonryPolyfillInitialized) return;
  window.__masonryPolyfillInitialized = true;

  function isMasonrySupported(container) {
    return getComputedStyle(container).gridTemplateRows === 'masonry';
  }

  function waitForMedia(container) {
    const images = Array.from(container.querySelectorAll('img'));
    const videos = Array.from(container.querySelectorAll('video'));

    const imagePromises = images.map((img) => {
      if (img.complete) return Promise.resolve();
      return new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });
    });

    const videoPromises = videos.map((video) => {
      if (video.readyState >= 1) return Promise.resolve();
      return new Promise((resolve, reject) => {
        video.onloadedmetadata = resolve;
        video.onerror = reject;
      });
    });

    return Promise.all([...imagePromises, ...videoPromises]).catch(() => {});
  }

  function getColumnCount(container) {
    const styles = getComputedStyle(container);
    const template = styles.gridTemplateColumns;
    if (!template) return 1;
    return template.trim().split(/\s+/).length;
  }

  function layout(container) {
    if (isMasonrySupported(container)) return;

    const items = Array.from(container.children);
    const colGap = parseFloat(getComputedStyle(container).columnGap) || 0;
    const columnCount = getColumnCount(container);

    // Reset dynamic placement so we can measure natural heights.
    items.forEach((item) => {
      item.style.gridRow = '';
      item.style.gridColumn = '';
      item.style.order = '';
    });

    // Balanced masonry: order doesn't matter for this variant, so we sort items
    // by descending height (largest first) before placing them. This reduces the
    // large gaps that appear when a very tall item is followed by many short items.
    const measured = items.map((item) => {
      const rawSpan = parseInt(item.dataset.colSpan || '1', 10);
      const span = Math.min(Math.max(rawSpan || 1, 1), columnCount);
      if (span > 1) {
        item.style.gridColumn = `span ${span}`;
      }
      // Force reflow so getBoundingClientRect includes the assigned column span.
      void container.offsetHeight;
      const rect = item.getBoundingClientRect();
      return {
        item,
        span,
        height: rect.height,
      };
    });

    measured.sort((a, b) => b.height - a.height);

    const columnHeights = new Array(columnCount).fill(0);

    measured.forEach(({ item, span, height }) => {
      // For items spanning multiple columns, find the contiguous run of columns
      // with the minimum combined starting height.
      let bestStart = 0;
      let bestHeight = Infinity;
      for (let i = 0; i <= columnCount - span; i++) {
        const maxStartHeight = Math.max(...columnHeights.slice(i, i + span));
        if (maxStartHeight < bestHeight) {
          bestHeight = maxStartHeight;
          bestStart = i;
        }
      }

      // CSS Grid is 1-indexed for column lines.
      item.style.gridColumn = `${bestStart + 1} / span ${span}`;

      // Use the column gap as the visual row gap. The CSS-Tricks trick treats
      // each row as 1px tall, so we span the item's height plus the gap.
      const rowSpan = Math.max(Math.round(height + colGap), 1);
      item.style.gridRow = `span ${rowSpan}`;

      // Advance the affected columns.
      const newHeight = bestHeight + height + colGap;
      for (let i = bestStart; i < bestStart + span; i++) {
        columnHeights[i] = newHeight;
      }
    });
  }

  function initContainer(container) {
    if (container.dataset.masonryInitialized) return;
    container.dataset.masonryInitialized = 'true';

    // Only the balanced mode needs the polyfill. Native masonry-capable browsers
    // already pack correctly via CSS.
    if (isMasonrySupported(container)) return;

    container.style.gridAutoRows = '0px';
    container.style.setProperty('row-gap', '1px', 'important');

    waitForMedia(container).then(() => {
      layout(container);

      const resizeObserver = new ResizeObserver(() => {
        window.cancelAnimationFrame(container.__masonryRaf);
        container.__masonryRaf = window.requestAnimationFrame(() => layout(container));
      });
      resizeObserver.observe(container);
    });
  }

  function init() {
    document.querySelectorAll('[data-masonry="balanced"]').forEach(initContainer);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  document.addEventListener('astro:page-load', init);
})();
