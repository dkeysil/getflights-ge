import type { Locale } from './i18n';

export const HIKE_WITH_AXE_PROMOTION_DISMISSAL_KEY = 'hike-with-axe-promotion-dismissed-at';
export const HIKE_WITH_AXE_PROMOTION_DISMISSAL_MS = 30 * 24 * 60 * 60 * 1000;

type PromotionLocale = Extract<Locale, 'ru' | 'ua'>;

export type HikeWithAxePromotion = {
  message: string;
  cta: string;
  dismissLabel: string;
  newTabLabel: string;
  href: string;
  locale: PromotionLocale;
};

const promotionCopy: Record<PromotionLocale, Omit<HikeWithAxePromotion, 'href' | 'locale'>> = {
  ru: {
    message: 'Самые красивые пейзажи Грузии — в пешей прогулке с Топором каждые выходные.',
    cta: 'Смотреть походы',
    dismissLabel: 'Закрыть предложение о прогулках с Топором',
    newTabLabel: 'Откроется в новой вкладке',
  },
  ua: {
    message: 'Найкрасивіші краєвиди Грузії — у пішій прогулянці з Топором щовихідних.',
    cta: 'Дивитися походи',
    dismissLabel: 'Закрити пропозицію прогулянок з Топором',
    newTabLabel: 'Відкриється в новій вкладці',
  },
};

const isPromotionLocale = (locale: Locale): locale is PromotionLocale => locale === 'ru' || locale === 'ua';

export function getHikeWithAxePromotion(locale: Locale): HikeWithAxePromotion | null {
  if (!isPromotionLocale(locale)) return null;

  return {
    ...promotionCopy[locale],
    locale,
    href: `https://hikewithaxe.ge/?utm_source=getflights&utm_medium=banner&utm_campaign=hike_with_axe_cross_promo&utm_content=${locale}`,
  };
}

export function isHikeWithAxePromotionDismissed(value: string | null, now = Date.now()) {
  const dismissedAt = Number(value);
  return (
    Number.isFinite(dismissedAt) &&
    dismissedAt > 0 &&
    dismissedAt <= now &&
    now - dismissedAt < HIKE_WITH_AXE_PROMOTION_DISMISSAL_MS
  );
}
