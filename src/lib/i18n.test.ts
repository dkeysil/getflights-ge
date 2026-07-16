import { describe, expect, it } from 'vitest';
import {
  formatDateCount,
  formatRelativeAge,
  getCityName,
  getOfficialFormLocale,
  messages,
  resolveLocale,
  withLocaleInUrl,
} from './i18n';

describe('localization helpers', () => {
  it('resolves locale from URL, storage, browser languages, then English', () => {
    expect(
      resolveLocale({
        pathname: '/ru/',
        search: '?lang=ua',
        storedLocale: 'en',
        navigatorLanguages: ['ka-GE'],
      }),
    ).toBe('ru');
    expect(
      resolveLocale({
        pathname: '/',
        search: '?lang=ru',
        storedLocale: 'ua',
        navigatorLanguages: ['en-US'],
      }),
    ).toBe('ru');
    expect(resolveLocale({ pathname: '/', search: '?lang=ua', storedLocale: null, navigatorLanguages: [] })).toBe('ua');
    expect(resolveLocale({ pathname: '/', search: '?lang=ka-GE', storedLocale: null, navigatorLanguages: [] })).toBe('ka');
    expect(
      resolveLocale({
        pathname: '/',
        search: '',
        storedLocale: 'ru',
        navigatorLanguages: ['uk-UA'],
      }),
    ).toBe('ru');
    expect(
      resolveLocale({
        pathname: '/',
        search: '',
        storedLocale: null,
        navigatorLanguages: ['uk-UA', 'en-US'],
      }),
    ).toBe('ua');
    expect(resolveLocale({ pathname: '/', search: '', storedLocale: null, navigatorLanguages: ['fr-FR'] })).toBe('en');
  });

  it('keeps Ukrainian booking on the English official form while Russian uses Russian', () => {
    expect(getOfficialFormLocale('en')).toBe('en');
    expect(getOfficialFormLocale('ru')).toBe('ru');
    expect(getOfficialFormLocale('ua')).toBe('en');
    expect(getOfficialFormLocale('ka')).toBe('en');
  });

  it('localizes city names by backend city id', () => {
    expect(getCityName('7', 'en')).toBe('Tbilisi (Natakhtari airport)');
    expect(getCityName('7', 'ru')).toBe('Тбилиси (Аэропорт Натахтари)');
    expect(getCityName('7', 'ua')).toBe('Тбілісі (Аеропорт Натахтарі)');
    expect(getCityName('7', 'ka')).toBe('თბილისი (ნატახტრის აეროპორტი)');
  });

  it('formats date counts by locale', () => {
    expect(formatDateCount(1, 'ru')).toBe('1 дата');
    expect(formatDateCount(2, 'ru')).toBe('2 даты');
    expect(formatDateCount(5, 'ru')).toBe('5 дат');
    expect(formatDateCount(1, 'ua')).toBe('1 дата');
    expect(formatDateCount(2, 'ua')).toBe('2 дати');
    expect(formatDateCount(5, 'ua')).toBe('5 дат');
    expect(formatDateCount(1, 'ka')).toBe('1 თარიღი');
    expect(formatDateCount(5, 'ka')).toBe('5 თარიღი');
  });

  it('formats cache freshness as a relative age', () => {
    const now = new Date('2026-07-01T10:00:00.000Z');

    expect(formatRelativeAge('2026-07-01T09:57:00.000Z', 'en', now)).toBe('3 minutes ago');
    expect(formatRelativeAge('2026-07-01T09:59:40.000Z', 'en', now)).toBe('now');
  });

  it('localizes the about banner booking call to action', () => {
    expect(messages.en.aboutBook).toBe('Book');
    expect(messages.ru.aboutBook).toBe('Кнопка «Забронировать»');
    expect(messages.ua.aboutBook).toBe('Кнопка «Забронювати»');
    expect(messages.ua.aboutSuffix).toContain('перенаправить вас');
    expect(messages.ka.aboutBook).toBe('ღილაკი „დაჯავშნა“');
  });

  it('keeps the brand subtitle focused on tickets without unofficial wording', () => {
    expect(messages.en.brandSub).toBe('Vanilla Sky tickets');
    expect(messages.ru.brandSub).toBe('Билеты Vanilla Sky');
    expect(messages.ua.brandSub).toBe('Квитки Vanilla Sky');
    expect(messages.ka.brandSub).toBe('Vanilla Sky-ის ბილეთები');
  });

  it('includes localized alert panel copy in every supported locale', () => {
    expect(messages.en.alertsHeading).toBe('Notify me about tickets');
    expect(messages.ru.alertsManage).toBe('Управлять уведомлениями');
    expect(messages.ua.alertsMonthShortcut).toBe('Цей місяць');
    expect(messages.ka.alertsCheckEmail).toContain('ელფოსტა');
  });

  it('uses scanning wording for Russian and Ukrainian schedule copy', () => {
    expect(messages.ru.aboutPrefix).toContain('мы сканируем живое расписание');
    expect(messages.ru.aboutPrefix).not.toContain('мы читаем живое расписание');
    expect(messages.ua.aboutPrefix).toContain('ми скануємо живий розклад');
    expect(messages.ua.aboutPrefix).not.toContain('ми читаємо живий розклад');
  });

  it('updates the locale path while preserving useful query parameters and hash fragments', () => {
    expect(withLocaleInUrl('https://example.com/flights?from=7#calendar', 'ua')).toBe(
      '/ua/flights?from=7#calendar',
    );
    expect(withLocaleInUrl('https://example.com/flights?lang=ru&from=7', 'en')).toBe(
      '/en/flights?from=7',
    );
    expect(withLocaleInUrl('https://example.com/ru/?lang=ru', 'ka')).toBe('/ka/');
  });

  it('preserves canonical trailing slashes on nested locale paths', () => {
    expect(withLocaleInUrl('https://example.com/en/flights/mestia-kutaisi/', 'ru')).toBe(
      '/ru/flights/mestia-kutaisi/',
    );
  });
});
