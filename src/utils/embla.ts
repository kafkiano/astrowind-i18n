/**
 * Shared Embla Carousel utilities.
 *
 * Three slider widgets (FeatureSlider, Slider, HeroSlider) previously
 * each carried their own copy of the init / pagination / pause logic.
 * This module extracts the common behaviour so the per-widget scripts
 * only supply what is genuinely different (selectors, extra plugins,
 * alignment default, optional setup callback).
 */
import EmblaCarousel from 'embla-carousel';
import Autoplay from 'embla-carousel-autoplay';
import type { EmblaCarouselType, EmblaOptionsType, EmblaPluginType } from 'embla-carousel';
import type { AutoplayType } from 'embla-carousel-autoplay';

/* ─── Shared helpers ────────────────────────────────────────────────── */

const ACTIVE_ATTR = 'data-active';

/**
 * Build pagination dots inside `dotsSelector` and keep them in sync
 * with the carousel position.
 */
export function buildPagination(emblaApi: EmblaCarouselType, rootEl: HTMLElement, dotsSelector: string): void {
  const container = rootEl.querySelector<HTMLElement>(dotsSelector);
  if (!container) return;

  const snaps = emblaApi.scrollSnapList();
  container.innerHTML = '';

  for (let i = 0; i < snaps.length; i++) {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className =
      'w-3 h-3 rounded-full bg-slate-400 dark:bg-white/30 border-none cursor-pointer p-0 transition-colors data-[active]:bg-slate-700 dark:data-[active]:bg-white/90';
    dot.setAttribute('aria-label', `Go to slide ${i + 1}`);
    dot.addEventListener('click', () => emblaApi.scrollTo(i));
    container.appendChild(dot);
  }

  const dots = container.querySelectorAll('button');

  const update = (): void => {
    const selected = emblaApi.selectedScrollSnap();
    dots.forEach((dot, i) => {
      if (i === selected) {
        dot.setAttribute(ACTIVE_ATTR, '');
      } else {
        dot.removeAttribute(ACTIVE_ATTR);
      }
    });
  };

  emblaApi.on('select', update);
  emblaApi.on('reInit', update);
  update();
}

/**
 * Pause autoplay on touch / pointer interaction, then auto-resume
 * after 3 s of inactivity (unless the caller has manually paused).
 */
export function setupPauseOnInteraction(
  autoplayPlugin: AutoplayType,
  rootEl: HTMLElement,
  isUserPaused: () => boolean
): void {
  let resumeTimer: ReturnType<typeof setTimeout> | null = null;

  const scheduleResume = (): void => {
    if (resumeTimer) clearTimeout(resumeTimer);
    resumeTimer = setTimeout(() => {
      if (!autoplayPlugin.isPlaying() && !isUserPaused()) {
        autoplayPlugin.play();
      }
    }, 3000);
  };

  const stopAndClear = (): void => {
    autoplayPlugin.stop();
    if (resumeTimer) clearTimeout(resumeTimer);
  };

  rootEl.addEventListener('pointerdown', stopAndClear);
  rootEl.addEventListener('touchstart', stopAndClear, { passive: true });
  rootEl.addEventListener('pointerup', scheduleResume);
  rootEl.addEventListener('mouseleave', scheduleResume);
}

/* ─── Base slider config (fields the shared init reads directly) ──── */

export interface EmblaBaseConfig {
  hasAutoplay?: boolean;
  autoplayDelay?: number;
  autoplayDisableOnInteraction?: boolean;
  loop: boolean;
  hasPagination?: boolean;
  align?: 'start' | 'center' | 'end';
  slidesToScroll?: number | 'auto';
}

/* ─── Generic initialiser ───────────────────────────────────────────── */

export interface EmblaInitAdapter<T extends EmblaBaseConfig = EmblaBaseConfig> {
  /** Extract the serialised config object from the root element. */
  getConfig: (el: HTMLElement) => T;

  /** Build the Embla options (loop, align, etc.). */
  getOptions: (config: T) => EmblaOptionsType;

  /**
   * Return any extra plugins beyond Autoplay (e.g. Fade).
   * Called once per slider instance.
   */
  getExtraPlugins?: () => EmblaPluginType[];

  /** CSS selector for the "previous" button. Defaults to `[data-embla-prev]`. */
  prevSelector?: string;
  /** CSS selector for the "next" button. Defaults to `[data-embla-next]`. */
  nextSelector?: string;

  /**
   * Optional per-instance setup after Embla is created.
   * Use for things like wiring a pause/play button that only
   * HeroSlider needs.
   */
  onInit?: (emblaApi: EmblaCarouselType, rootEl: HTMLElement, config: T, autoplayPlugin: AutoplayType | null) => void;
}

/**
 * Boilerplate shared by every Embla-based slider widget:
 *
 * 1. querySelectorAll (skip already-initialised)
 * 2. Parse config, find viewport
 * 3. Build plugins (Autoplay + extras)
 * 4. Create EmblaCarousel
 * 5. Start autoplay, wire pause-on-interaction
 * 6. Wire prev / next buttons
 * 7. Build pagination dots
 * 8. Mark initialised, re-run on astro:page-load
 */
export function initEmblaSliders<T extends EmblaBaseConfig>(
  containerSelector: string,
  viewportSelector: string,
  initializedClass: string,
  dotsSelector: string,
  adapter: EmblaInitAdapter<T>
): void {
  document.querySelectorAll<HTMLElement>(`${containerSelector}:not(.${initializedClass})`).forEach((el) => {
    const config = adapter.getConfig(el);
    const viewport = el.querySelector<HTMLElement>(viewportSelector);
    if (!viewport) return;

    // ── Plugins ──────────────────────────────────────────────────
    const plugins: EmblaPluginType[] = adapter.getExtraPlugins?.() ?? [];
    let autoplayPlugin: AutoplayType | null = null;

    if (config.hasAutoplay) {
      autoplayPlugin = Autoplay({
        delay: config.autoplayDelay ?? 5000,
        stopOnLastSnap: !config.loop,
        stopOnInteraction: false,
        playOnInit: false,
      });
      plugins.push(autoplayPlugin);
    }

    // ── Create carousel ──────────────────────────────────────────
    const emblaApi = EmblaCarousel(
      viewport,
      {
        ...adapter.getOptions(config),
        slidesToScroll: config.slidesToScroll ?? 1,
        direction: document.documentElement.dir === 'rtl' ? 'rtl' : 'ltr',
      },
      plugins
    );

    // ── Autoplay ─────────────────────────────────────────────────
    const userPaused = false;
    if (autoplayPlugin && emblaApi.slideNodes().length > 1) {
      autoplayPlugin.play();
    }

    if (autoplayPlugin && config.autoplayDisableOnInteraction && emblaApi.slideNodes().length > 1) {
      setupPauseOnInteraction(autoplayPlugin, el, () => userPaused);
    }

    // ── Widget-specific wiring (pause button, etc.) ──────────────
    adapter.onInit?.(emblaApi, el, config, autoplayPlugin);

    // ── Navigation arrows ────────────────────────────────────────
    const prevBtn = el.querySelector<HTMLElement>(adapter.prevSelector ?? '[data-embla-prev]');
    const nextBtn = el.querySelector<HTMLElement>(adapter.nextSelector ?? '[data-embla-next]');
    if (prevBtn) prevBtn.addEventListener('click', () => emblaApi.scrollPrev());
    if (nextBtn) nextBtn.addEventListener('click', () => emblaApi.scrollNext());

    // ── Pagination dots ──────────────────────────────────────────
    if (config.hasPagination) {
      buildPagination(emblaApi, el, dotsSelector);
    }

    el.classList.add(initializedClass);
  });
}

/**
 * Convenience wrapper: call `initEmblaSliders` now and on every
 * subsequent Astro page transition.
 */
export function registerEmblaSliders<T extends EmblaBaseConfig>(
  containerSelector: string,
  viewportSelector: string,
  initializedClass: string,
  dotsSelector: string,
  adapter: EmblaInitAdapter<T>
): void {
  initEmblaSliders(containerSelector, viewportSelector, initializedClass, dotsSelector, adapter);
  document.addEventListener('astro:page-load', () =>
    initEmblaSliders(containerSelector, viewportSelector, initializedClass, dotsSelector, adapter)
  );
}
