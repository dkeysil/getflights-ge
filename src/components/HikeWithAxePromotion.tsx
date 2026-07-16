import { ExternalLink, X } from 'lucide-react';
import { useState } from 'react';
import type { Locale } from '../lib/i18n';
import {
  getHikeWithAxePromotion,
  HIKE_WITH_AXE_PROMOTION_DISMISSAL_KEY,
  isHikeWithAxePromotionDismissed,
} from '../lib/hikeWithAxePromotion';

type Props = {
  locale: Locale;
  onClick: (input: { locale: 'ru' | 'ua' }) => void;
};

const readDismissal = () => {
  try {
    return isHikeWithAxePromotionDismissed(localStorage.getItem(HIKE_WITH_AXE_PROMOTION_DISMISSAL_KEY));
  } catch {
    return false;
  }
};

export function HikeWithAxePromotion({ locale, onClick }: Props) {
  const promotion = getHikeWithAxePromotion(locale);
  const [dismissed, setDismissed] = useState(readDismissal);

  if (!promotion || dismissed) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(HIKE_WITH_AXE_PROMOTION_DISMISSAL_KEY, String(Date.now()));
    } catch {
      // The in-memory state still hides the banner for this rendered session.
    }
    setDismissed(true);
  };

  return (
    <aside className="hike-with-axe-promotion" aria-label={promotion.cta}>
      <div className="hike-with-axe-promotion__content">
        <p>{promotion.message}</p>
        <a href={promotion.href} target="_blank" rel="noopener noreferrer" onClick={() => onClick({ locale: promotion.locale })}>
          {promotion.cta}
          <ExternalLink aria-hidden="true" size={15} />
          <span className="sr-only">{promotion.newTabLabel}</span>
        </a>
      </div>
      <div className="hike-with-axe-promotion__image">
        <img
          src="https://hikewithaxe.ge/images/routes/truso-valley/hero.webp"
          alt={promotion.locale === 'ru' ? 'Долина Трусо и горы в Грузии' : 'Долина Трусо та гори в Грузії'}
        />
      </div>
      <button className="hike-with-axe-promotion-close" type="button" onClick={dismiss} aria-label={promotion.dismissLabel}>
        <X aria-hidden="true" size={16} />
      </button>
    </aside>
  );
}
