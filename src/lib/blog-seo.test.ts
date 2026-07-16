import { describe, expect, it } from 'vitest';
import {
  blogSeoIndexPageForLocale,
  blogSeoIndexPageUrl,
  blogSeoPostUrl,
  blogSeoPostUrlForLocale,
  blogSeoPosts,
  blogSeoPostsForLocale,
  getBlogSeoIndexPageByPath,
  getBlogSeoPostByPath,
} from './blog-seo';

describe('blog SEO posts', () => {
  it('defines a localized pre-booking article cluster per supported locale', () => {
    expect(blogSeoPosts).toHaveLength(16);
    expect(blogSeoPostsForLocale('en')).toHaveLength(4);
    expect(blogSeoPostsForLocale('ru')).toHaveLength(4);
    expect(blogSeoPostsForLocale('ua')).toHaveLength(4);
    expect(blogSeoPostsForLocale('ka')).toHaveLength(4);

    expect(blogSeoPostsForLocale('en').map((post) => post.slug)).toEqual([
      'blog/vanilla-sky-georgia-flights-guide',
      'blog/how-to-buy-vanilla-sky-tickets',
      'blog/natakhtari-airport-guide',
      'blog/vanilla-sky-baggage-weather-cancellations',
    ]);
  });

  it('resolves the Russian Vanilla Sky guide with attribution and route links', () => {
    const post = getBlogSeoPostByPath('/ru/blog/vanilla-sky-georgia-flights-guide/');

    expect(post).toMatchObject({
      locale: 'ru',
      slug: 'blog/vanilla-sky-georgia-flights-guide',
      source: {
        label: expect.stringContaining('Николай Левшиц'),
        href: 'https://t.me/nlevshitstelegram',
      },
      image: {
        src: '/vanilla-sky-georgia-flight-preview.png',
        alt: expect.stringContaining('самолет'),
      },
    });
    expect(post?.h1).toContain('Vanilla Sky');
    expect(post?.sections.length).toBeGreaterThanOrEqual(5);
    expect(post?.routeLinks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ href: '/ru/flights/tbilisi-mestia/' }),
        expect.objectContaining({ href: '/ru/flights/tbilisi-batumi/' }),
      ]),
    );
  });

  it('resolves original booking help articles without third-party attribution', () => {
    const post = getBlogSeoPostByPath('/en/blog/how-to-buy-vanilla-sky-tickets/');
    const text = post?.sections.flatMap((section) => section.body).join(' ') ?? '';

    expect(post).toMatchObject({
      locale: 'en',
      slug: 'blog/how-to-buy-vanilla-sky-tickets',
      h1: expect.stringContaining('How to buy Vanilla Sky tickets'),
    });
    expect(post?.source).toBeUndefined();
    expect(post?.sections.length).toBeGreaterThanOrEqual(4);
    expect(text).toContain('official Vanilla Sky');
    expect(text).toContain('ticket.vanillasky.ge');
    expect(text).toContain('vanillasky.ge');
  });

  it('answers airport-name confusion from Natakhtari and Novo Alexeyevka searches', () => {
    const post = getBlogSeoPostByPath('/en/blog/natakhtari-airport-guide/');
    const text = [post?.title, post?.h1, post?.intro, ...(post?.sections.flatMap((section) => [section.heading, ...section.body]) ?? [])].join(' ');

    expect(text).toContain('Natakhtari airport');
    expect(text).toContain('Novo Alexeyevka');
    expect(text).toContain('Tbilisi International Airport');
  });

  it('provides localized blog index pages that link to every article', () => {
    const index = getBlogSeoIndexPageByPath('/ru/blog/');

    expect(index).toMatchObject({
      locale: 'ru',
      path: '/ru/blog/',
      title: expect.stringContaining('Vanilla Sky'),
      h1: expect.stringContaining('Vanilla Sky'),
    });
    expect(blogSeoIndexPageUrl(blogSeoIndexPageForLocale('ru'))).toBe('https://getflights.ge/ru/blog/');
    expect(index?.posts.map((post) => post.path)).toEqual([
      '/ru/blog/vanilla-sky-georgia-flights-guide/',
      '/ru/blog/how-to-buy-vanilla-sky-tickets/',
      '/ru/blog/natakhtari-airport-guide/',
      '/ru/blog/vanilla-sky-baggage-weather-cancellations/',
    ]);
  });

  it('provides metadata and canonical URLs for every localized blog post', () => {
    for (const post of blogSeoPosts) {
      expect(blogSeoPostUrl(post)).toBe(`https://getflights.ge/${post.locale}/${post.slug}/`);
      expect(blogSeoPostUrlForLocale(post, 'ka')).toBe(`https://getflights.ge/ka/${post.slug}/`);
      expect(post.title.length).toBeGreaterThan(20);
      expect(post.description.length).toBeGreaterThan(80);
      expect(post.h1.length).toBeGreaterThan(20);
      expect(post.intro.length).toBeGreaterThan(100);
      expect(post.cta.length).toBeGreaterThan(10);
      expect(post.image.caption.length).toBeGreaterThan(30);
      expect(post.routeLinks.length).toBeGreaterThanOrEqual(4);
    }
  });

  it('adds publish and update dates to every localized blog post', () => {
    for (const post of blogSeoPosts) {
      expect(post.publishedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(post.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(post.updatedAt >= post.publishedAt).toBe(true);
    }
  });
});
