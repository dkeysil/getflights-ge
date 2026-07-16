import { describe, expect, it } from 'vitest';
import {
  HIKE_WITH_AXE_PROMOTION_DISMISSAL_KEY,
  getHikeWithAxePromotion,
  isHikeWithAxePromotionDismissed,
} from './hikeWithAxePromotion';

describe('Hike With Axe promotion', () => {
  it('targets only Russian and Ukrainian visitors with tagged home-page links', () => {
    expect(getHikeWithAxePromotion('en')).toBeNull();
    expect(getHikeWithAxePromotion('ka')).toBeNull();
    expect(getHikeWithAxePromotion('ru')).toMatchObject({
      message: 'Самые красивые пейзажи Грузии — в пешей прогулке с Топором каждые выходные.',
      cta: 'Смотреть походы',
      href: 'https://hikewithaxe.ge/?utm_source=getflights&utm_medium=banner&utm_campaign=hike_with_axe_cross_promo&utm_content=ru',
    });
    expect(getHikeWithAxePromotion('ua')).toMatchObject({
      message: 'Найкрасивіші краєвиди Грузії — у пішій прогулянці з Топором щовихідних.',
      cta: 'Дивитися походи',
      href: 'https://hikewithaxe.ge/?utm_source=getflights&utm_medium=banner&utm_campaign=hike_with_axe_cross_promo&utm_content=ua',
    });
  });

  it('keeps dismissal isolated and expires it after exactly 30 days', () => {
    const now = Date.parse('2026-07-10T12:00:00.000Z');
    expect(HIKE_WITH_AXE_PROMOTION_DISMISSAL_KEY).not.toBe('vs-about-dismissed');
    expect(isHikeWithAxePromotionDismissed(null, now)).toBe(false);
    expect(isHikeWithAxePromotionDismissed('invalid', now)).toBe(false);
    expect(isHikeWithAxePromotionDismissed(String(now + 1), now)).toBe(false);
    expect(isHikeWithAxePromotionDismissed(String(now - 30 * 24 * 60 * 60 * 1000 + 1), now)).toBe(true);
    expect(isHikeWithAxePromotionDismissed(String(now - 30 * 24 * 60 * 60 * 1000), now)).toBe(false);
  });
});
