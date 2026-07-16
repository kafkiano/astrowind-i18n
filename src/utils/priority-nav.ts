/**
 * Priority+ navigation pattern — collapses overflowing nav items into a "More" dropdown.
 * Uses ResizeObserver to react to container width changes and font load events.
 *
 * DOM contract (provided by Header.astro):
 *   - #aw-main-nav        — the <nav> container (ResizeObserver target)
 *   - #aw-nav-items       — the <ul> holding top-level nav items
 *   - #aw-nav-more        — the "More" <li> (dropdown, initially hidden)
 *   - #aw-nav-more-menu   — the "More" dropdown <ul>
 *   - [data-nav-item]     — direct children of #aw-nav-items
 *
 * Dropdown items overflowed into More are flattened:
 *   - Parent becomes link to first sub-item
 *   - Remaining sub-items listed as indented entries
 */
export function initPriorityNav(): void {
  const nav = document.getElementById('aw-main-nav')!;
  const itemList = document.getElementById('aw-nav-items')!;
  const moreItem = document.getElementById('aw-nav-more')!;
  const moreMenu = document.getElementById('aw-nav-more-menu')!;
  if (!nav || !moreItem || !itemList) return;

  const navItems = itemList.querySelectorAll<HTMLElement>(':scope > [data-nav-item]');
  if (navItems.length === 0) return;

  let isUpdating = false;

  function update() {
    if (isUpdating) return;
    isUpdating = true;
    requestAnimationFrame(() => {
      // Only run on desktop (mobile uses hamburger)
      if (window.innerWidth < 768) {
        moreItem.classList.add('hidden');
        moreMenu.innerHTML = '';
        navItems.forEach((item) => item.classList.remove('hidden'));
        isUpdating = false;
        return;
      }

      // Reset: clear More dropdown, unhide all nav items
      moreMenu.innerHTML = '';
      navItems.forEach((item) => item.classList.remove('hidden'));
      moreItem.classList.add('hidden');

      // Measure. Account for the More button width (reserve space for it).
      const moreWidth = moreItem.offsetWidth || 140; // fallback for hidden element
      const gapSize = 4; // matches the implicit flex gap
      const availableWidth = nav.clientWidth - moreWidth - gapSize;

      let totalWidth = 0;
      let overflow = false;

      navItems.forEach((item, index) => {
        totalWidth += item.offsetWidth + gapSize;
        if (totalWidth > availableWidth) {
          // Never move the last item — a solo entry in More looks worse
          // than slight overflow, and the hamburger takes over soon after
          if (index === navItems.length - 1) return;
          // Overflow: hide this item from main row, clone into More dropdown
          item.classList.add('hidden');
          const clone = item.cloneNode(true) as HTMLElement;
          clone.classList.remove('hidden');

          if (item.classList.contains('dropdown')) {
            // Extract sub-links BEFORE removing dropdown-menu
            const dropdownMenu = clone.querySelector<HTMLElement>(':scope > .dropdown-menu');
            const subLinks = dropdownMenu
              ? Array.from(dropdownMenu.querySelectorAll<HTMLAnchorElement>(':scope > li > a'))
              : [];
            const firstHref = subLinks[0]?.getAttribute('href') || '#';

            // Remove nested dropdown-menu
            dropdownMenu?.remove();

            // Replace dropdown button with a link to the first sub-item
            const btn = clone.querySelector<HTMLElement>(':scope > button');
            if (btn) {
              const a = document.createElement('a');
              a.href = firstHref;
              a.className = btn.className;
              a.textContent = btn.textContent?.replace(/\s*$/, '') || '';
              btn.replaceWith(a);
            }

            clone.classList.remove('dropdown');
            moreMenu.appendChild(clone);

            // Add remaining sub-items as indented entries
            subLinks.forEach((link, i) => {
              if (i === 0) return; // first already linked via parent
              const subLi = document.createElement('li');
              const subA = document.createElement('a');
              subA.href = link.getAttribute('href') || '#';
              subA.className =
                'md:hover:bg-neutral-100 hover:text-link dark:hover:text-white dark:hover:bg-neutral-700 py-2 px-5 pl-8 block whitespace-no-wrap';
              subA.textContent = link.textContent || '';
              subLi.appendChild(subA);
              moreMenu.appendChild(subLi);
            });
          } else {
            // Plain link: just append to More dropdown
            moreMenu.appendChild(clone);
          }
          overflow = true;
        }
      });

      if (overflow) {
        moreItem.classList.remove('hidden');
      }
      isUpdating = false;
    });
  }

  const ro = new ResizeObserver(() => update());
  ro.observe(nav);
  update();

  // Re-run on font load (affects text measurements)
  document.fonts?.ready.then(() => update());
}
