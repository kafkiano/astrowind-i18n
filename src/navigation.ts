import { getPermalink, getBlogPermalink, getAsset, getPagePermalink } from './utils/permalinks';
import { DEFAULT_LOCALE } from './utils/locales';

export const getHeaderData = (locale: string = DEFAULT_LOCALE) => ({
  links: [
    {
      text: 'Homes',
      links: [
        {
          text: 'SaaS',
          href: getPermalink('/homes/saas', 'page', locale),
        },
        {
          text: 'Startup',
          href: getPermalink('/homes/startup', 'page', locale),
        },
        {
          text: 'Mobile App',
          href: getPermalink('/homes/mobile-app', 'page', locale),
        },
        {
          text: 'Personal',
          href: getPermalink('/homes/personal', 'page', locale),
        },
      ],
    },
    {
      text: 'Pages',
      links: [
        {
          text: 'Features (Anchor Link)',
          href: getPermalink('#features', 'page', locale),
        },
        {
          text: 'Services',
          href: getPermalink('/services', 'page', locale),
        },
        {
          text: 'Pricing',
          href: getPermalink('/pricing', 'page', locale),
        },
        {
          text: 'About us',
          href: getPermalink('/about', 'page', locale),
        },
        {
          text: 'Contact',
          href: getPermalink('/contact', 'page', locale),
        },
        {
          text: 'Terms',
          href: getPagePermalink('terms', locale),
        },
        {
          text: 'Privacy policy',
          href: getPagePermalink('privacy', locale),
        },
        {
          text: 'Markdown Page',
          href: getPagePermalink('markdown', locale),
        },
      ],
    },
    {
      text: 'Landing',
      links: [
        {
          text: 'Lead Generation',
          href: getPermalink('/landing/lead-generation', 'page', locale),
        },
        {
          text: 'Long-form Sales',
          href: getPermalink('/landing/sales', 'page', locale),
        },
        {
          text: 'Click-Through',
          href: getPermalink('/landing/click-through', 'page', locale),
        },
        {
          text: 'Product Details (or Services)',
          href: getPermalink('/landing/product', 'page', locale),
        },
        {
          text: 'Coming Soon or Pre-Launch',
          href: getPermalink('/landing/pre-launch', 'page', locale),
        },
        {
          text: 'Subscription',
          href: getPermalink('/landing/subscription', 'page', locale),
        },
      ],
    },
    {
      text: 'Blog',
      links: [
        {
          text: 'Blog List',
          href: getBlogPermalink(locale),
        },
        {
          text: 'Article',
          href: getPermalink('get-started-website-with-astro-tailwind-css', 'post', locale),
        },
        {
          text: 'Article (with MDX)',
          href: getPermalink('markdown-elements-demo-post', 'post', locale),
        },
        {
          text: 'Category Page',
          href: getPermalink('tutorials', 'category', locale),
        },
        {
          text: 'Tag Page',
          href: getPermalink('astro', 'tag', locale),
        },
      ],
    },
  ],
  actions: [{ text: 'Download', href: 'https://github.com/arthelokyo/astrowind', target: '_blank' }],
});

export const getFooterData = (locale: string = DEFAULT_LOCALE) => ({
  links: [
    {
      title: 'Product',
      links: [
        { text: 'Features', href: '#' },
        { text: 'Security', href: '#' },
        { text: 'Team', href: '#' },
        { text: 'Enterprise', href: '#' },
        { text: 'Customer stories', href: '#' },
        { text: 'Pricing', href: '#' },
        { text: 'Resources', href: '#' },
      ],
    },
    {
      title: 'Platform',
      links: [
        { text: 'Developer API', href: '#' },
        { text: 'Partners', href: '#' },
        { text: 'Atom', href: '#' },
        { text: 'Electron', href: '#' },
        { text: 'AstroWind Desktop', href: '#' },
      ],
    },
    {
      title: 'Support',
      links: [
        { text: 'Docs', href: '#' },
        { text: 'Community Forum', href: '#' },
        { text: 'Professional Services', href: '#' },
        { text: 'Skills', href: '#' },
        { text: 'Status', href: '#' },
      ],
    },
    {
      title: 'Company',
      links: [
        { text: 'About', href: '#' },
        { text: 'Blog', href: '#' },
        { text: 'Careers', href: '#' },
        { text: 'Press', href: '#' },
        { text: 'Inclusion', href: '#' },
        { text: 'Social Impact', href: '#' },
        { text: 'Shop', href: '#' },
      ],
    },
  ],
  secondaryLinks: [
    { text: 'Terms', href: getPagePermalink('terms', locale) },
    { text: 'Privacy Policy', href: getPagePermalink('privacy', locale) },
  ],
  socialLinks: [
    { ariaLabel: 'X', icon: 'tabler:brand-x', href: '#' },
    { ariaLabel: 'Instagram', icon: 'tabler:brand-instagram', href: '#' },
    { ariaLabel: 'Facebook', icon: 'tabler:brand-facebook', href: '#' },
    { ariaLabel: 'RSS', icon: 'tabler:rss', href: getAsset('/rss.xml') },
    { ariaLabel: 'Github', icon: 'tabler:brand-github', href: 'https://github.com/arthelokyo/astrowind' },
  ],
  /* @wc-ignore */
  footNote: `
    Made by <a class="text-blue-600 underline dark:text-muted" href="https://github.com/arthelokyo"> Arthelokyo</a> · All rights reserved.
  `,
});

// Keep backward compatibility for now (optional)
export const headerData = getHeaderData(DEFAULT_LOCALE);
export const footerData = getFooterData(DEFAULT_LOCALE);
