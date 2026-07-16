import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HikeWithAxePromotion } from './HikeWithAxePromotion';
import { HIKE_WITH_AXE_PROMOTION_DISMISSAL_KEY } from '../lib/hikeWithAxePromotion';

beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
    clear: () => values.clear(),
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('HikeWithAxePromotion', () => {
  it('renders the Ukrainian banner as a safe new-tab home-page link and records its click', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<HikeWithAxePromotion locale="ua" onClick={onClick} />);

    const link = screen.getByRole('link', { name: /Дивитися походи/i });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link).toHaveAttribute('href', expect.stringContaining('utm_content=ua'));

    await user.click(link);
    expect(onClick).toHaveBeenCalledWith({ locale: 'ua' });
  });

  it('does not render for English and hides independently for 30 days after dismissal', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<HikeWithAxePromotion locale="en" onClick={vi.fn()} />);
    expect(screen.queryByRole('link', { name: /поход|походи/i })).not.toBeInTheDocument();

    rerender(<HikeWithAxePromotion locale="ru" onClick={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /Закрыть предложение/i }));
    expect(localStorage.getItem(HIKE_WITH_AXE_PROMOTION_DISMISSAL_KEY)).toMatch(/^\d+$/);
    expect(screen.queryByRole('link', { name: 'Смотреть походы' })).not.toBeInTheDocument();
  });

  it('renders the localized Truso image without changing the promotion destination', () => {
    const { rerender } = render(<HikeWithAxePromotion locale="ru" onClick={vi.fn()} />);

    expect(screen.getByRole('img', { name: 'Долина Трусо и горы в Грузии' })).toHaveAttribute(
      'src',
      'https://hikewithaxe.ge/images/routes/truso-valley/hero.webp',
    );
    expect(screen.getByRole('link', { name: /Смотреть походы/i })).toHaveAttribute(
      'href',
      expect.stringContaining('utm_content=ru'),
    );

    rerender(<HikeWithAxePromotion locale="ua" onClick={vi.fn()} />);
    expect(screen.getByRole('img', { name: 'Долина Трусо та гори в Грузії' })).toHaveAttribute(
      'src',
      'https://hikewithaxe.ge/images/routes/truso-valley/hero.webp',
    );
  });
});
