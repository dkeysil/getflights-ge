import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react';
import {
  AlertCircle,
  ArrowRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Info,
  Loader2,
  Minus,
  Plane,
  Plus,
  RefreshCw,
  X,
} from 'lucide-react';
import { HikeWithAxePromotion } from './components/HikeWithAxePromotion';
import {
  buildMonthCalendar,
  CITIES,
  getRouteAvailability,
  routeKey,
  shiftMonth,
} from './lib/availability';
import { trackBookingHandoffStarted, trackHikeWithAxeBannerClicked } from './lib/analytics';
import {
  loadAvailabilitySnapshot,
  getOfficialPurchaseRequest,
  searchFlights,
  type AvailabilitySnapshot,
  type FlightOption,
} from './lib/backend';
import {
  formatDateCount,
  formatRelativeAge,
  formatSelectedDate,
  formatShortDate,
  getCityName,
  getOfficialFormLocale,
  localeOptions,
  messages,
  persistLocale,
  readInitialLocale,
  toIntlLocale,
  weekdayLabels,
  withLocaleInUrl,
  type Locale,
} from './lib/i18n';
import {
  defaultAlertRange,
  loadManagedAlerts,
  readAlertsEnabled,
  requestManageLink,
  subscribeToRouteAlerts,
  unsubscribeManagedAlert,
} from './lib/alerts';
import {
  blogSeoPostsForLocale,
  getBlogSeoIndexPageByPath,
  getBlogSeoPostByPath,
  type BlogSeoIndexPage,
  type BlogSeoPost,
} from './lib/blog-seo';
import { getRouteSeoPageByPath, type RouteSeoPage } from './lib/route-seo';
import {
  buildBlogIndexStructuredData,
  buildBlogPostStructuredData,
  buildHomeStructuredData,
  buildRouteStructuredData,
  serializeStructuredData,
} from './lib/structured-data';

type PassengerKey = 'adult' | 'child' | 'infant';

const passengerKeys: PassengerKey[] = ['adult', 'child', 'infant'];

type RouteCard = {
  from: { id: string; name: string };
  to: { id: string; name: string };
  dateCount: number;
  firstDate: string | null;
};

type ManageRoute = {
  token: string | null;
};

type ManagedSubscription = {
  id: string;
  fromId?: string;
  toId?: string;
  dateFrom: string;
  dateTo: string;
  status?: string;
  matchingDates?: string[];
  lastAlertSentOn?: string | null;
};

// Preferred default route on load: Tbilisi (Natakhtari airport, id 7) → Batumi (id 4).
// Falls back to the first route with dates if this one has none.
const DEFAULT_ROUTE = { fromId: '7', toId: '4' };

export function App() {
  const alertsEnabled = readAlertsEnabled();
  const [locale, setLocale] = useState<Locale>(() => readInitialLocale());
  const [manageRoute] = useState<ManageRoute | null>(() => readInitialManageRoute(alertsEnabled));
  const [initialSeoPage] = useState(() => readInitialSeoPage());
  const [initialBlogPost] = useState(() => readInitialBlogPost());
  const [initialBlogIndexPage] = useState(() => readInitialBlogIndexPage());
  const [initialAlertSelection] = useState(() => readInitialAlertSelection(alertsEnabled));
  const [fromId, setFromId] = useState(() =>
    initialAlertSelection.fromId ??
      (initialSeoPage?.kind === 'route' ? initialSeoPage.route.fromId : DEFAULT_ROUTE.fromId),
  );
  const [toId, setToId] = useState(() =>
    initialAlertSelection.toId ??
      (initialSeoPage?.kind === 'route' ? initialSeoPage.route.toId : DEFAULT_ROUTE.toId),
  );
  const [snapshot, setSnapshot] = useState<AvailabilitySnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), monthIndex: now.getMonth() };
  });
  const [passengers, setPassengers] = useState<Record<PassengerKey, number>>({
    adult: 1,
    child: 0,
    infant: 0,
  });
  const [searching, setSearching] = useState(false);
  const [openingFor, setOpeningFor] = useState<string | null>(null);
  const [flights, setFlights] = useState<FlightOption[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [alertDateFrom, setAlertDateFrom] = useState(() => initialAlertSelection.dateFrom);
  const [alertDateTo, setAlertDateTo] = useState(() => initialAlertSelection.dateTo);
  const [alertEmail, setAlertEmail] = useState('');
  const [alertSubmitting, setAlertSubmitting] = useState(false);
  const [alertSubmitted, setAlertSubmitted] = useState(false);
  const [alertError, setAlertError] = useState<string | null>(null);
  const [showAbout, setShowAbout] = useState(
    () => typeof localStorage === 'undefined' || localStorage.getItem('vs-about-dismissed') !== '1',
  );
  const [routesOpen, setRoutesOpen] = useState(false);
  const [managedSubscriptions, setManagedSubscriptions] = useState<ManagedSubscription[]>([]);
  const [manageLoading, setManageLoading] = useState(() => Boolean(manageRoute?.token));
  const [manageError, setManageError] = useState<string | null>(null);
  const [manageLinkEmail, setManageLinkEmail] = useState('');
  const [manageLinkSubmitting, setManageLinkSubmitting] = useState(false);
  const [manageLinkSent, setManageLinkSent] = useState(false);
  const [unsubscribingId, setUnsubscribingId] = useState<string | null>(null);
  const copy = messages[locale];
  const officialLocale = getOfficialFormLocale(locale);
  const seoPage = useMemo(
    () => (initialSeoPage ? getRouteSeoPageByPath(`/${locale}/${initialSeoPage.slug}/`) : null),
    [initialSeoPage, locale],
  );
  const blogPost = useMemo(
    () => (initialBlogPost ? getBlogSeoPostByPath(`/${locale}/${initialBlogPost.slug}/`) : null),
    [initialBlogPost, locale],
  );
  const blogIndexPage = useMemo(
    () => (initialBlogIndexPage ? getBlogSeoIndexPageByPath(`/${locale}/blog/`) : null),
    [initialBlogIndexPage, locale],
  );
  const preferredRoute = seoPage?.kind === 'route'
    ? { fromId: seoPage.route.fromId, toId: seoPage.route.toId }
    : DEFAULT_ROUTE;
  const showManagePage = Boolean(alertsEnabled && manageRoute);

  useEffect(() => {
    if (showManagePage) return;
    void refreshAvailability();
  }, [showManagePage]);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = blogPost?.title ?? blogIndexPage?.title ?? seoPage?.title ?? copy.metaTitle;
    persistLocale(locale);
  }, [blogIndexPage?.title, blogPost?.title, copy.metaTitle, locale, seoPage?.title]);

  useEffect(() => {
    const structuredData = blogPost
      ? buildBlogPostStructuredData(blogPost)
      : blogIndexPage
        ? buildBlogIndexStructuredData(blogIndexPage)
        : seoPage
          ? buildRouteStructuredData(seoPage)
          : buildHomeStructuredData(locale);
    const existingScript = document.getElementById('getflights-json-ld') as HTMLScriptElement | null;
    const script = existingScript ?? document.createElement('script');
    script.id = 'getflights-json-ld';
    script.type = 'application/ld+json';
    script.textContent = serializeStructuredData(structuredData);

    if (!existingScript) {
      document.head.append(script);
    }
  }, [blogIndexPage, blogPost, locale, seoPage]);

  useEffect(() => {
    setAlertSubmitted(false);
    setAlertError(null);
  }, [fromId, toId, alertDateFrom, alertDateTo]);

  useEffect(() => {
    if (!showManagePage || !manageRoute?.token) return;

    let active = true;
    setManageLoading(true);
    setManageError(null);

    loadManagedAlerts(manageRoute.token)
      .then((result) => {
        if (!active) return;
        setManagedSubscriptions(Array.isArray(result?.subscriptions) ? result.subscriptions : []);
      })
      .catch(() => {
        if (!active) return;
        setManageError(copy.alertsManageLoadError);
      })
      .finally(() => {
        if (active) setManageLoading(false);
      });

    return () => {
      active = false;
    };
  }, [copy.alertsManageLoadError, manageRoute?.token, showManagePage]);

  const selectedRoute = getRouteAvailability(fromId, toId, snapshot?.availability ?? {});
  const calendar = useMemo(
    () => buildMonthCalendar(month.year, month.monthIndex, selectedRoute.outbound, locale),
    [locale, month.monthIndex, month.year, selectedRoute.outbound],
  );
  const selectedRouteHasDates = selectedRoute.outbound.length > 0;
  const alertRangeHasTickets = hasDatesInRange(selectedRoute.outbound, alertDateFrom, alertDateTo);
  const alertRouteValid = snapshot ? hasRoute(snapshot, fromId, toId) : false;
  const routeCards = useMemo(() => buildRouteCards(snapshot), [snapshot]);
  const fromCity = CITIES.find((city) => city.id === fromId);
  const toCity = CITIES.find((city) => city.id === toId);
  const fromCityName = fromCity ? getCityName(fromCity.id, locale, fromCity.name) : undefined;
  const toCityName = toCity ? getCityName(toCity.id, locale, toCity.name) : undefined;
  const showHomepageSeoNavigation = !blogPost && !blogIndexPage && !seoPage;

  // Load the real flight(s) for the chosen route + day as soon as a day is selected.
  useEffect(() => {
    if (!selectedDate) {
      setFlights([]);
      return;
    }

    const controller = new AbortController();
    let active = true;
    setSearching(true);
    setSearchError(null);
    setFlights([]); // clear so the per-day loader shows on every date/passenger change

    searchFlights(
      { tripType: 'one-way', fromId, toId, outboundDate: selectedDate, passengers },
      controller.signal,
    )
      .then((result) => {
        if (!active) return;
        setFlights(result.flights);
        if (result.flights.length === 0) {
          setSearchError(copy.noFlightsOnDay);
        }
      })
      .catch(() => {
        if (!active || controller.signal.aborted) return;
        setFlights([]);
        setSearchError(copy.couldNotReach);
      })
      .finally(() => {
        if (active) setSearching(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [copy.couldNotReach, copy.noFlightsOnDay, fromId, passengers, selectedDate, toId]);

  async function refreshAvailability(options: { refresh?: boolean } = {}) {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setSearchError(null);

    try {
      const nextSnapshot = await loadAvailabilitySnapshot(controller.signal, undefined, {
        ...options,
      });
      const preferred = getRouteAvailability(preferredRoute.fromId, preferredRoute.toId, nextSnapshot.availability);
      const defaultRoute = preferred.outbound.length
        ? { fromId: preferredRoute.fromId, toId: preferredRoute.toId, dates: preferred }
        : null;
      const currentRoute = hasRoute(nextSnapshot, fromId, toId)
        ? {
            fromId,
            toId,
            dates: getRouteAvailability(fromId, toId, nextSnapshot.availability),
          }
        : null;
      const firstAvailableRoute =
        currentRoute ?? defaultRoute ?? findFirstRouteWithDates(nextSnapshot) ?? findFirstRoute(nextSnapshot);
      setSnapshot(nextSnapshot);

      if (firstAvailableRoute) {
        setFromId(firstAvailableRoute.fromId);
        setToId(firstAvailableRoute.toId);
        const nextSelectedDate = selectedDate && firstAvailableRoute.dates.outbound.includes(selectedDate)
          ? selectedDate
          : firstAvailableRoute.dates.outbound[0] ?? null;
        setSelectedDate(nextSelectedDate);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : copy.couldNotLoad);
    } finally {
      setLoading(false);
    }

    return () => controller.abort();
  }

  function chooseRoute(nextFromId: string, nextToId: string) {
    const dates = getRouteAvailability(nextFromId, nextToId, snapshot?.availability ?? {});
    setFromId(nextFromId);
    setToId(nextToId);

    const firstDate = dates.outbound[0] ?? null;
    setSelectedDate(firstDate);
    if (firstDate) setMonth(monthFromIso(firstDate));
  }

  async function subscribeForAlert(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAlertError(null);

    if (!snapshot || !hasRoute(snapshot, fromId, toId)) {
      setAlertSubmitted(false);
      return;
    }

    if (!alertEmail.trim() || !isValidEmail(alertEmail)) {
      setAlertSubmitted(false);
      setAlertError(copy.alertsValidationEmail);
      return;
    }

    if (!isValidAlertRange(alertDateFrom, alertDateTo)) {
      setAlertSubmitted(false);
      setAlertError(copy.alertsValidationRange);
      return;
    }

    setAlertSubmitting(true);

    try {
      await subscribeToRouteAlerts({
        email: alertEmail.trim(),
        fromId,
        toId,
        dateFrom: alertDateFrom,
        dateTo: alertDateTo,
        locale,
      });
      setAlertSubmitted(true);
      setAlertEmail('');
    } catch {
      setAlertSubmitted(false);
      setAlertError(copy.alertsBackendError);
    } finally {
      setAlertSubmitting(false);
    }
  }

  function updatePassenger(key: PassengerKey, delta: number) {
    setPassengers((current) => {
      const next = Math.max(key === 'adult' ? 1 : 0, current[key] + delta);
      const total =
        next +
        Object.entries(current)
          .filter(([entryKey]) => entryKey !== key)
          .reduce((sum, [, value]) => sum + Number(value), 0);

      if (total > 4) return current;
      return { ...current, [key]: next };
    });
  }

  async function bookOnVanillaSky(flight: FlightOption, flightKey: string) {
    if (!selectedDate) return;

    const popupName = `vanilla-sky-book-${Date.now()}`;
    const popup = window.open('about:blank', popupName);
    setOpeningFor(flightKey);
    setSearchError(null);

    try {
      const request = await getOfficialPurchaseRequest({
        tripType: 'one-way',
        fromId,
        toId,
        outboundDate: selectedDate,
        officialLocale,
        passengers,
      });
      trackBookingHandoffStarted({
        locale,
        officialLocale,
        fromId,
        fromName: fromCityName ?? flight.fromName,
        toId,
        toName: toCityName ?? flight.toName,
        outboundDate: selectedDate,
        departureTime: flight.time,
        priceGel: flight.priceGel,
        priceUsd: flight.priceUsd,
        passengers,
      });
      submitPostForm(request.action, request.fields, popupName);
    } catch {
      popup?.close();
      setSearchError(copy.couldNotOpen);
    } finally {
      setOpeningFor(null);
    }
  }

  function dismissAbout() {
    setShowAbout(false);
    try {
      localStorage.setItem('vs-about-dismissed', '1');
    } catch {
      // ignore storage failures (private mode etc.)
    }
  }

  function changeLocale(nextLocale: Locale) {
    setLocale(nextLocale);
    persistLocale(nextLocale);

    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', withLocaleInUrl(window.location.href, nextLocale));
    }
  }

  async function sendManageLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isValidEmail(manageLinkEmail.trim())) {
      setManageError(copy.alertsValidationEmail);
      setManageLinkSent(false);
      return;
    }

    setManageError(null);
    setManageLinkSubmitting(true);

    try {
      await requestManageLink({ email: manageLinkEmail.trim(), locale });
    } catch {
      // Generic success avoids leaking which emails have subscriptions.
    } finally {
      setManageLinkSubmitting(false);
      setManageLinkSent(true);
      setManageLinkEmail('');
    }
  }

  async function unsubscribeManagedSubscription(id: string) {
    if (!manageRoute?.token) return;

    setUnsubscribingId(id);
    setManageError(null);

    try {
      await unsubscribeManagedAlert({ id, token: manageRoute.token });
      setManagedSubscriptions((current) =>
        current.map((subscription) =>
          subscription.id === id ? { ...subscription, status: 'unsubscribed' } : subscription,
        ),
      );
    } catch {
      setManageError(copy.alertsManageUnsubscribeError);
    } finally {
      setUnsubscribingId(null);
    }
  }

  const updatedLabel = snapshot ? formatRelativeAge(snapshot.loadedAt, locale) : null;

  if (showManagePage && manageRoute) {
    return (
      <main className="app-shell">
        <header className="topbar">
          <a className="brand" href={`/${locale}/`}>
            <span className="bird">
              <Plane size={18} />
            </span>
            <span className="brand-text">
              <span className="brand-name">GetFlights.ge</span>
              <span className="brand-sub">{copy.brandSub}</span>
            </span>
          </a>
        </header>

        <section className="pane">
          <div className="pane-main">
            <section className="day-detail">
              <div className="dd-head">
                <div>
                  <h1>{copy.alertsManageHeading}</h1>
                  <p>{manageRoute.token ? copy.alertsManageIntro : copy.alertsManageRequestIntro}</p>
                </div>
              </div>

              {manageError ? (
                <div className="notice error" role="alert">
                  <AlertCircle size={18} />
                  {manageError}
                </div>
              ) : null}

              {manageRoute.token ? (
                manageLoading ? (
                  <div className="loading-row" role="status">
                    <Loader2 className="spin" size={16} />
                    {copy.alertsManageLoading}
                  </div>
                ) : managedSubscriptions.length === 0 ? (
                  <div className="empty-state" role="status" aria-live="polite">
                    {copy.alertsManageEmpty}
                  </div>
                ) : (
                  <div className="ticket-list">
                    {managedSubscriptions.map((subscription) => {
                      const unsubscribed = subscription.status === 'unsubscribed';

                      return (
                        <article className="ticket" key={subscription.id}>
                          <div className="leg">
                            <div className="arc">
                              <span className="cities">
                                <span className="city">{formatManagedRouteLabel(subscription, locale)}</span>
                              </span>
                              <span className="sub">
                                {subscription.dateFrom} - {subscription.dateTo}
                              </span>
                              <span className="sub">{copy.alertsManageStatus(subscription.status ?? 'active')}</span>
                              {subscription.matchingDates?.length ? (
                                <span className="sub">
                                  {copy.alertsManageMatchingDates(subscription.matchingDates.length)}
                                </span>
                              ) : null}
                              {subscription.lastAlertSentOn ? (
                                <span className="sub">
                                  {copy.alertsManageLastAlert(subscription.lastAlertSentOn)}
                                </span>
                              ) : null}
                            </div>
                          </div>
                          <button
                            className="book"
                            type="button"
                            disabled={unsubscribed || unsubscribingId === subscription.id}
                            onClick={() => void unsubscribeManagedSubscription(subscription.id)}
                          >
                            {unsubscribingId === subscription.id ? (
                              <Loader2 className="spin" size={16} />
                            ) : (
                              <X size={16} />
                            )}
                            {unsubscribed ? copy.alertsManageUnsubscribed : copy.alertsManageUnsubscribe}
                          </button>
                        </article>
                      );
                    })}
                  </div>
                )
              ) : (
                <form onSubmit={(event) => void sendManageLink(event)}>
                  <label className="pax-stepper">
                    <span>{copy.alertsEmailLabel}</span>
                    <input
                      type="email"
                      value={manageLinkEmail}
                      onChange={(event) => {
                        setManageLinkEmail(event.target.value);
                        setManageLinkSent(false);
                        setManageError(null);
                      }}
                    />
                  </label>
                  {manageLinkSent ? (
                    <div className="notice" role="alert" aria-live="polite">
                      {copy.alertsManageLinkSent}
                    </div>
                  ) : null}
                  <button className="book" type="submit" disabled={manageLinkSubmitting}>
                    {manageLinkSubmitting ? <Loader2 className="spin" size={16} /> : <Info size={16} />}
                    {copy.alertsManageRequest}
                  </button>
                </form>
              )}
            </section>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      {showAbout ? (
        <div className="about-banner">
          <Info className="about-ic" size={16} />
          <p>
            {copy.aboutPrefix} <strong>{copy.aboutBook}</strong> {copy.aboutSuffix}
          </p>
          <button className="about-close" type="button" onClick={dismissAbout} aria-label={copy.dismiss}>
            <X size={16} />
          </button>
        </div>
      ) : null}

      <header className="topbar">
        <a className="brand" href={`/${locale}/`}>
          <span className="bird">
            <Plane size={18} />
          </span>
          <span className="brand-text">
            <span className="brand-name">GetFlights.ge</span>
            <span className="brand-sub">{copy.brandSub}</span>
          </span>
        </a>
        <div className="topbar-right">
          <span className="live">
            <span className="pulse" />
            {loading ? copy.checkingFlights : copy.live}
            {!loading && updatedLabel ? (
              <span className="when">
                {' · '}
                {copy.updated} {updatedLabel}
              </span>
            ) : null}
          </span>
          <div className="language-switcher" aria-label={copy.language}>
            {localeOptions.map((option) => (
              <button
                className={option.locale === locale ? 'language-option on' : 'language-option'}
                type="button"
                key={option.locale}
                aria-label={option.name}
                aria-pressed={option.locale === locale}
                onClick={() => changeLocale(option.locale)}
              >
                <span className="language-flag" aria-hidden="true">
                  {option.flag}
                </span>
                <span className="language-code">{option.label}</span>
              </button>
            ))}
          </div>
          <button
            className="icon-button"
            type="button"
            title={copy.refreshAvailability}
            aria-label={copy.refreshAvailability}
            disabled={loading}
            onClick={() => void refreshAvailability({ refresh: true })}
          >
            {loading ? <Loader2 className="spin" size={16} /> : <RefreshCw size={16} />}
          </button>
        </div>
      </header>

      <HikeWithAxePromotion locale={locale} onClick={trackHikeWithAxeBannerClicked} />

      <p className="subbar">{copy.subbar}</p>

      {blogIndexPage ? <BlogSeoIndex page={blogIndexPage} /> : null}
      {blogPost ? <BlogSeoArticle post={blogPost} /> : null}
      {seoPage ? <RouteSeoPanel page={seoPage} /> : null}

      {error ? (
        <div className="notice error page-notice">
          <AlertCircle size={18} />
          {error}
        </div>
      ) : null}

      <section className="pane">
        <aside className="routes-rail" aria-label={copy.routesAria}>
          <button
            className="rail-toggle"
            type="button"
            aria-expanded={routesOpen}
            aria-label={`${copy.route}: ${fromCityName ?? ''} to ${toCityName ?? ''}`}
            onClick={() => setRoutesOpen((open) => !open)}
          >
            <span className="rt-text">
              <span className="rt-label">{copy.route}</span>
              <span className="rt-current">
                {fromCityName}
                <ArrowRight size={13} />
                {toCityName}
              </span>
            </span>
            <ChevronDown className="rt-chev" size={18} />
          </button>

          <div className="rail-title">{copy.flyingNow}</div>

          <div className="rail-list" data-open={routesOpen}>
            {loading && !snapshot ? (
              <RailSkeleton />
            ) : (
              routeCards.map((route, index) => {
                const active = route.from.id === fromId && route.to.id === toId;
                return (
                  <button
                    key={`${route.from.id}:${route.to.id}`}
                    type="button"
                    className={active ? 'route-item on' : 'route-item'}
                    aria-label={routeCardAriaLabel(route, locale)}
                    aria-pressed={active}
                    onClick={() => {
                      chooseRoute(route.from.id, route.to.id);
                      setRoutesOpen(false);
                    }}
                    style={{ '--entry-index': index } as CSSProperties}
                  >
                    <span className="pair">
                      <span className="city">{getCityName(route.from.id, locale, route.from.name)}</span>
                      <span className="city to">
                        <ArrowRight className="a" size={13} />
                        {getCityName(route.to.id, locale, route.to.name)}
                      </span>
                    </span>
                    <span className="next">
                      {route.firstDate
                        ? `${copy.next} ${formatShortDate(route.firstDate, locale)} · ${formatDateCount(route.dateCount, locale)}`
                        : copy.noDatesAvailable}
                    </span>
                  </button>
                );
              })
            )}
            {!loading && routeCards.length === 0 ? (
              <p className="rail-empty">{copy.noRoutes}</p>
            ) : null}
          </div>
        </aside>

        <div className="pane-main">
          <section className="calendar-panel">
            <div className="cal-head">
              <span className="mlabel">
                {calendar.monthLabel}
                {fromCity && toCity ? (
                  <span className="mroute">
                    {' · '}
                    {fromCityName}
                    <ArrowRight size={13} />
                    {toCityName}
                  </span>
                ) : null}
              </span>
              <span className="navbtns">
                <button
                  type="button"
                  aria-label={copy.previousMonth}
                  onClick={() => setMonth(shiftMonth(month.year, month.monthIndex, -1))}
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  type="button"
                  aria-label={copy.nextMonth}
                  onClick={() => setMonth(shiftMonth(month.year, month.monthIndex, 1))}
                >
                  <ChevronRight size={16} />
                </button>
              </span>
            </div>

            {loading && !snapshot ? (
              <CalendarSkeleton locale={locale} />
            ) : (
              <div className="grid">
                {weekdayLabels[locale].map((day) => (
                  <div className="wd" key={day}>
                    {day}
                  </div>
                ))}
                {calendar.weeks.flat().map((day) => (
                  <button
                    className={[
                      'day',
                      day.inCurrentMonth ? '' : 'out',
                      day.isToday ? 'today' : '',
                      day.isAvailable ? 'avail' : '',
                      selectedDate === day.iso ? 'sel' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    disabled={!day.isAvailable}
                    key={day.iso}
                    type="button"
                    aria-label={dateButtonAriaLabel(day.iso, locale, fromCityName, toCityName, day.isAvailable)}
                    aria-pressed={selectedDate === day.iso}
                    aria-current={day.isToday ? 'date' : undefined}
                    onClick={() => {
                      setSelectedDate(day.iso);
                      if (!day.inCurrentMonth) setMonth(monthFromIso(day.iso));
                    }}
                  >
                    {day.dayOfMonth}
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="day-detail">
            <div className="dd-head">
              <div className="dd-date">
                {selectedDate
                  ? formatSelectedDate(selectedDate, locale)
                  : selectedRouteHasDates
                    ? copy.pickAvailableDay
                    : copy.noDatesAvailable}
              </div>
              <div className="passengers">
                {passengerKeys.map((key) => (
                  <div className="pax-stepper" key={key}>
                    <span>{copy.passengers[key]}</span>
                    <div className="stepper">
                      <button
                        type="button"
                        aria-label={copy.fewerPassengers[key]}
                        onClick={() => updatePassenger(key, -1)}
                      >
                        <Minus size={14} />
                      </button>
                      <strong>{passengers[key]}</strong>
                      <button
                        type="button"
                        aria-label={copy.morePassengers[key]}
                        onClick={() => updatePassenger(key, 1)}
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {searchError ? (
              <div className="notice error">
                <AlertCircle size={18} />
                {searchError}
              </div>
            ) : null}

            {alertsEnabled ? (
              <section className="notice" aria-labelledby="alerts-heading">
                <div className="dd-head">
                  <div>
                    <h2 id="alerts-heading">{copy.alertsHeading}</h2>
                    <p>{alertRangeHasTickets ? copy.alertsAlreadyAvailable : copy.alertsIntro}</p>
                  </div>
                  <a href={`/${locale}/alerts/manage/`}>{copy.alertsManage}</a>
                </div>
                <form onSubmit={(event) => void subscribeForAlert(event)}>
                  <div className="passengers">
                    <label className="pax-stepper">
                      <span>{copy.alertsDateFromLabel}</span>
                      <input type="date" value={alertDateFrom} onChange={(event) => setAlertDateFrom(event.target.value)} />
                    </label>
                    <label className="pax-stepper">
                      <span>{copy.alertsDateToLabel}</span>
                      <input type="date" value={alertDateTo} onChange={(event) => setAlertDateTo(event.target.value)} />
                    </label>
                    <div className="pax-stepper">
                      <span>{copy.alertsMonthShortcutLabel}</span>
                      <button
                        type="button"
                        onClick={() => {
                          const currentMonthRange = monthRange(month.year, month.monthIndex);
                          setAlertDateFrom(currentMonthRange.dateFrom);
                          setAlertDateTo(currentMonthRange.dateTo);
                          setAlertSubmitted(false);
                          setAlertError(null);
                        }}
                      >
                        {copy.alertsMonthShortcut}
                      </button>
                    </div>
                  </div>
                  <label className="pax-stepper">
                    <span>{copy.alertsEmailLabel}</span>
                    <input
                      type="email"
                      value={alertEmail}
                      onChange={(event) => {
                        setAlertEmail(event.target.value);
                        setAlertSubmitted(false);
                      }}
                    />
                  </label>
                  {alertError ? (
                    <div className="notice error" role="alert">
                      <AlertCircle size={18} />
                      {alertError}
                    </div>
                  ) : null}
                  {alertSubmitted ? (
                    <div className="notice" role="alert" aria-live="polite">
                      {copy.alertsCheckEmail}
                    </div>
                  ) : null}
                  <button className="book" type="submit" disabled={alertSubmitting || !alertRouteValid}>
                    {alertSubmitting ? <Loader2 className="spin" size={16} /> : <Info size={16} />}
                    {copy.alertsSubscribe}
                  </button>
                </form>
              </section>
            ) : null}

            {searching && flights.length === 0 ? (
              <div className="loading-row" role="status">
                <Loader2 className="spin" size={16} />
                {copy.checkingFare}
              </div>
            ) : null}

            <div className="ticket-list">
              {flights.map((flight) => {
                const key = `${flight.checkboxName}:${flight.time}`;
                const opening = openingFor === key;
                return (
                  <article className="ticket" key={key}>
                    <div className="leg">
                      <div className="time">{flight.time || '—'}</div>
                      <div className="arc">
                        <span className="cities">
                          <span className="city">{fromCityName || flight.fromName}</span>
                          <ArrowRight size={13} />
                          <span className="city">{toCityName || flight.toName}</span>
                        </span>
                        <span className="sub">
                          {selectedDate ? formatShortDate(selectedDate, locale) : flight.dateLabel}
                        </span>
                      </div>
                    </div>
                    <div className="price">
                      <div className="gel">{flight.priceGel ? formatPrice(flight.priceGel) : '—'}</div>
                      {flight.priceUsd ? <div className="usd">≈ {formatPrice(flight.priceUsd)}</div> : null}
                    </div>
                    <button
	                      className="book"
	                      type="button"
	                      disabled={opening}
	                      aria-label={bookFlightAriaLabel(locale, fromCityName, toCityName, selectedDate)}
	                      onClick={() => void bookOnVanillaSky(flight, key)}
	                    >
                      {opening ? <Loader2 className="spin" size={16} /> : <ExternalLink size={16} />}
                      {copy.bookOnVanillaSky}
                    </button>
                  </article>
                );
              })}

              {!searching && flights.length === 0 && !searchError ? (
                <div className="empty-state">
                  {selectedDate
                    ? copy.noFlightsListed
                    : selectedRouteHasDates
                      ? copy.pickHighlightedDay
                      : copy.noDatesAvailable}
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </section>

      {showHomepageSeoNavigation ? <SeoNavigation locale={locale} /> : null}
    </main>
  );
}

function RouteSeoPanel({ page }: { page: RouteSeoPage }) {
  return (
    <section className="seo-panel" aria-labelledby="route-seo-heading">
      <div className="seo-panel-inner">
        <div className="seo-copy">
          <h1 id="route-seo-heading">{page.h1}</h1>
          <p>{page.intro}</p>
          {page.kind === 'route' ? (
            <div className="seo-route-summary">
              <span className="seo-route-pair">
                {page.route.publicFrom}
                <ArrowRight size={13} />
                {page.route.publicTo}
              </span>
              <span>{page.route.officialFrom} - {page.route.officialTo}</span>
            </div>
          ) : null}
          <p className="seo-cta">{page.cta}</p>
        </div>
        <div className="seo-faqs">
          {page.faqs.map((faq) => (
            <article className="seo-faq" key={faq.question}>
              <h2>{faq.question}</h2>
              <p>{faq.answer}</p>
            </article>
          ))}
          <nav className="seo-related-links" aria-label={relatedLinksHeading(page.locale)}>
            <h2>{relatedLinksHeading(page.locale)}</h2>
            <ul>
              {page.relatedLinks.map((link) => (
                <li key={link.href}>
                  <a href={link.href}>{link.label}</a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </section>
  );
}

function BlogSeoIndex({ page }: { page: BlogSeoIndexPage }) {
  return (
    <section className="blog-index" aria-labelledby="blog-index-heading">
      <div className="blog-index-inner">
        <header className="blog-index-head">
          <h1 id="blog-index-heading">{page.h1}</h1>
          <p>{page.intro}</p>
        </header>
        <div className="blog-index-list">
          {page.posts.map((post) => (
            <article className="blog-index-item" key={post.path}>
              <h2>
                <a href={post.path}>{post.h1}</a>
              </h2>
              <p>{post.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function BlogSeoArticle({ post }: { post: BlogSeoPost }) {
  const sourceLabel = {
    en: 'Source',
    ru: 'Источник',
    ua: 'Джерело',
    ka: 'წყარო',
  }[post.locale];
  const updatedLabel = {
    en: 'Last updated',
    ru: 'Обновлено',
    ua: 'Оновлено',
    ka: 'განახლდა',
  }[post.locale];

  return (
    <article className="blog-article" aria-labelledby="blog-article-heading">
      <div className="blog-article-inner">
        <header className="blog-article-head">
          <h1 id="blog-article-heading">{post.h1}</h1>
          <p>{post.intro}</p>
          {post.source ? (
            <p className="blog-source">
              <span>{sourceLabel}: </span>
              <a href={post.source.href} target="_blank" rel="noopener noreferrer">
                {post.source.label}
	              </a>
	            </p>
	          ) : null}
	          <p className="blog-updated">
	            {updatedLabel}: {formatBlogDate(post.updatedAt, post.locale)}
	          </p>
	          <figure className="blog-figure">
            <img src={post.image.src} alt={post.image.alt} />
            <figcaption>{post.image.caption}</figcaption>
          </figure>
        </header>

        <div className="blog-article-body">
          {post.sections.map((section) => (
            <section className="blog-section" key={section.heading}>
              <h2>{section.heading}</h2>
              {section.body.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </section>
          ))}
        </div>

        <nav className="blog-route-links" aria-label={post.cta}>
          <h2>{post.cta}</h2>
          <ul>
            {post.routeLinks.map((link) => (
              <li key={link.href}>
                <a href={link.href}>{link.label}</a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </article>
  );
}

function SeoNavigation({ locale }: { locale: Locale }) {
  const copy = seoNavigationCopy[locale];
  const guidePosts = blogSeoPostsForLocale(locale);
  const guideLinks = [
    {
      label: copy.bookingGuide,
      href: `/${locale}/blog/how-to-buy-vanilla-sky-tickets/`,
    },
    {
      label: copy.natakhtariGuide,
      href: `/${locale}/blog/natakhtari-airport-guide/`,
    },
    {
      label: copy.baggageGuide,
      href: `/${locale}/blog/vanilla-sky-baggage-weather-cancellations/`,
    },
  ];
  const routeLinks = [
    {
      label: copy.tbilisiBatumi,
      href: `/${locale}/flights/tbilisi-batumi/`,
    },
    {
      label: copy.tbilisiMestia,
      href: `/${locale}/flights/tbilisi-mestia/`,
    },
    {
      label: copy.tbilisiAmbrolauri,
      href: `/${locale}/flights/tbilisi-ambrolauri/`,
    },
    {
      label: copy.kutaisiMestia,
      href: `/${locale}/flights/kutaisi-mestia/`,
    },
  ];

  return (
    <section className="seo-nav" aria-labelledby="seo-nav-heading">
      <div className="seo-nav-inner">
        <div className="seo-nav-head">
          <h1 id="seo-nav-heading">{copy.heading}</h1>
          <p>{copy.intro}</p>
        </div>
        <nav className="seo-nav-group" aria-label={copy.routesLabel}>
          <h2>{copy.routesLabel}</h2>
          <ul>
            {routeLinks.map((link) => (
              <li key={link.href}>
                <a href={link.href}>{link.label}</a>
              </li>
            ))}
          </ul>
        </nav>
        <nav className="seo-nav-group" aria-label={copy.guidesLabel}>
          <h2>{copy.guidesLabel}</h2>
          <ul>
            <li>
              <a href={`/${locale}/blog/`}>{copy.allGuides}</a>
            </li>
            {guideLinks.map((link) => (
              <li key={link.href}>
                <a href={link.href}>{link.label}</a>
              </li>
            ))}
            {guidePosts[0] ? (
              <li>
                <a href={guidePosts[0].path}>{guidePosts[0].h1}</a>
              </li>
            ) : null}
          </ul>
        </nav>
      </div>
    </section>
  );
}

function relatedLinksHeading(locale: Locale) {
  if (locale === 'ru') return 'Полезные ссылки';
  if (locale === 'ua') return 'Корисні посилання';
  if (locale === 'ka') return 'სასარგებლო ბმულები';
  return 'Helpful links';
}

const seoNavigationCopy: Record<Locale, {
  heading: string;
  intro: string;
  routesLabel: string;
  guidesLabel: string;
  allGuides: string;
  bookingGuide: string;
  natakhtariGuide: string;
  baggageGuide: string;
  tbilisiBatumi: string;
  tbilisiMestia: string;
  tbilisiAmbrolauri: string;
  kutaisiMestia: string;
}> = {
  en: {
    heading: 'Popular Vanilla Sky flight searches',
    intro: 'Find domestic flight tickets in Georgia by route, then read the practical guides before continuing to the official Vanilla Sky booking site.',
    routesLabel: 'Popular routes',
    guidesLabel: 'Booking guides',
    allGuides: 'All Vanilla Sky ticket guides',
    bookingGuide: 'Vanilla Sky booking guide',
    natakhtariGuide: 'Natakhtari airport guide',
    baggageGuide: 'Baggage and weather cancellation guide',
    tbilisiBatumi: 'Tbilisi to Batumi flight tickets',
    tbilisiMestia: 'Tbilisi to Mestia flight tickets',
    tbilisiAmbrolauri: 'Tbilisi to Ambrolauri flight tickets',
    kutaisiMestia: 'Kutaisi to Mestia flight tickets',
  },
  ru: {
    heading: 'Популярные поиски рейсов Vanilla Sky',
    intro: 'Находите внутренние авиабилеты по Грузии по маршрутам, затем читайте практические гиды перед переходом к официальной покупке Vanilla Sky.',
    routesLabel: 'Популярные маршруты',
    guidesLabel: 'Гиды по покупке',
    allGuides: 'Все гиды по билетам Vanilla Sky',
    bookingGuide: 'Гид по покупке билетов Vanilla Sky',
    natakhtariGuide: 'Гид по аэропорту Натахтари',
    baggageGuide: 'Гид по багажу и погодным отменам',
    tbilisiBatumi: 'Авиабилеты Тбилиси - Батуми',
    tbilisiMestia: 'Авиабилеты Тбилиси - Местиа',
    tbilisiAmbrolauri: 'Авиабилеты Тбилиси - Амбролаури',
    kutaisiMestia: 'Авиабилеты Кутаиси - Местиа',
  },
  ua: {
    heading: 'Популярні пошуки рейсів Vanilla Sky',
    intro: 'Знаходьте внутрішні авіаквитки Грузією за маршрутами, потім читайте практичні гайди перед переходом до офіційної купівлі на Vanilla Sky.',
    routesLabel: 'Популярні маршрути',
    guidesLabel: 'Гайди з купівлі',
    allGuides: 'Усі гайди по квитках Vanilla Sky',
    bookingGuide: 'Гайд з купівлі квитків Vanilla Sky',
    natakhtariGuide: 'Гайд по аеропорту Натахтарі',
    baggageGuide: 'Гайд по багажу і погодних скасуваннях',
    tbilisiBatumi: 'Авіаквитки Тбілісі - Батумі',
    tbilisiMestia: 'Авіаквитки Тбілісі - Местія',
    tbilisiAmbrolauri: 'Авіаквитки Тбілісі - Амбролаурі',
    kutaisiMestia: 'Авіаквитки Кутаїсі - Местія',
  },
  ka: {
    heading: 'Vanilla Sky-ის პოპულარული ფრენების ძიება',
    intro: 'იპოვეთ საქართველოს შიდა ავიაბილეთები მარშრუტით, შემდეგ წაიკითხეთ პრაქტიკული გზამკვლევები Vanilla Sky-ის ოფიციალურ შეძენაზე გადასვლამდე.',
    routesLabel: 'პოპულარული მარშრუტები',
    guidesLabel: 'დაჯავშნის გზამკვლევები',
    allGuides: 'ყველა Vanilla Sky-ის ბილეთის გზამკვლევი',
    bookingGuide: 'Vanilla Sky-ის ბილეთის ყიდვის გზამკვლევი',
    natakhtariGuide: 'ნატახტრის აეროპორტის გზამკვლევი',
    baggageGuide: 'ბარგისა და ამინდით გაუქმების გზამკვლევი',
    tbilisiBatumi: 'თბილისი - ბათუმი ავიაბილეთები',
    tbilisiMestia: 'თბილისი - მესტია ავიაბილეთები',
    tbilisiAmbrolauri: 'თბილისი - ამბროლაური ავიაბილეთები',
    kutaisiMestia: 'ქუთაისი - მესტია ავიაბილეთები',
  },
};

function RailSkeleton() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, index) => (
        <div className="route-item skeleton" key={index} />
      ))}
    </>
  );
}

function CalendarSkeleton({ locale }: { locale: Locale }) {
  return (
    <div className="grid" aria-hidden="true">
      {weekdayLabels[locale].map((day) => (
        <div className="wd" key={day}>
          {day}
        </div>
      ))}
      {Array.from({ length: 42 }).map((_, index) => (
        <div className="day skeleton" key={index} />
      ))}
    </div>
  );
}

function readInitialSeoPage() {
  if (typeof window === 'undefined') return null;
  return getRouteSeoPageByPath(window.location.pathname);
}

function readInitialBlogPost() {
  if (typeof window === 'undefined') return null;
  return getBlogSeoPostByPath(window.location.pathname);
}

function readInitialBlogIndexPage() {
  if (typeof window === 'undefined') return null;
  return getBlogSeoIndexPageByPath(window.location.pathname);
}

function readInitialManageRoute(alertsEnabled: boolean): ManageRoute | null {
  if (typeof window === 'undefined' || !alertsEnabled) return null;

  const match = window.location.pathname.match(/^\/(en|ru|ua|ka)\/alerts\/manage\/?$/);
  if (!match) return null;

  const params = new URLSearchParams(window.location.search);
  return {
    token: params.get('token'),
  };
}

function readInitialAlertSelection(alertsEnabled: boolean): {
  fromId: string | null;
  toId: string | null;
  dateFrom: string;
  dateTo: string;
} {
  const fallback = defaultAlertRange(new Date());

  if (typeof window === 'undefined' || !alertsEnabled) {
    return { ...fallback, fromId: null, toId: null };
  }

  const params = new URLSearchParams(window.location.search);
  const dateFrom = params.get('dateFrom');
  const dateTo = params.get('dateTo');

  const hasValidRange = isValidAlertRange(dateFrom, dateTo);

  return {
    fromId: params.get('from'),
    toId: params.get('to'),
    dateFrom: hasValidRange && dateFrom ? dateFrom : fallback.dateFrom,
    dateTo: hasValidRange && dateTo ? dateTo : fallback.dateTo,
  };
}

function buildRouteCards(snapshot: AvailabilitySnapshot | null): RouteCard[] {
  if (!snapshot) return [];

  return snapshot.routeCatalog
    .flatMap((route) =>
      route.destinations.map((destination) => {
        const dates = getRouteAvailability(route.from.id, destination.id, snapshot.availability).outbound;
        return {
          from: route.from,
          to: destination,
          dateCount: dates.length,
          firstDate: dates[0] ?? null,
        };
      }),
    )
    .sort((left, right) => right.dateCount - left.dateCount || left.from.name.localeCompare(right.from.name));
}

function findFirstRouteWithDates(snapshot: AvailabilitySnapshot) {
  for (const route of snapshot.routeCatalog) {
    for (const destination of route.destinations) {
      const dates = snapshot.availability[routeKey(route.from.id, destination.id)];
      if (dates?.outbound.length) {
        return { fromId: route.from.id, toId: destination.id, dates };
      }
    }
  }

  return null;
}

function findFirstRoute(snapshot: AvailabilitySnapshot) {
  const firstRoute = snapshot.routeCatalog.find((route) => route.destinations.length > 0);
  const firstDestination = firstRoute?.destinations[0];
  if (!firstRoute || !firstDestination) return null;

  return {
    fromId: firstRoute.from.id,
    toId: firstDestination.id,
    dates: getRouteAvailability(firstRoute.from.id, firstDestination.id, snapshot.availability),
  };
}

function hasRoute(snapshot: AvailabilitySnapshot, fromId: string, toId: string) {
  return snapshot.routeCatalog.some(
    (route) => route.from.id === fromId && route.destinations.some((destination) => destination.id === toId),
  );
}

function hasDatesInRange(outboundDates: string[], dateFrom: string, dateTo: string) {
  if (!isValidAlertRange(dateFrom, dateTo)) return false;
  return outboundDates.some((date) => date >= dateFrom && date <= dateTo);
}

function monthFromIso(iso: string) {
  const [year, month] = iso.split('-').map(Number);
  return { year, monthIndex: month - 1 };
}

function monthRange(year: number, monthIndex: number) {
  return {
    dateFrom: `${year}-${padMonth(monthIndex + 1)}-01`,
    dateTo: `${year}-${padMonth(monthIndex + 1)}-${padMonth(new Date(year, monthIndex + 1, 0).getDate())}`,
  };
}

function formatManagedRouteLabel(subscription: ManagedSubscription, locale: Locale) {
  const from = subscription.fromId ? getCityName(subscription.fromId, locale) : undefined;
  const to = subscription.toId ? getCityName(subscription.toId, locale) : undefined;

  return `${from ?? '—'} -> ${to ?? '—'}`;
}

function routeCardAriaLabel(route: RouteCard, locale: Locale) {
  const from = getCityName(route.from.id, locale, route.from.name);
  const to = getCityName(route.to.id, locale, route.to.name);
  if (route.dateCount === 0) {
    return `Select route ${from} to ${to}. No dates available.`;
  }

  const nextFlight = route.firstDate ? ` Next flight ${formatShortDate(route.firstDate, locale)}.` : '';
  return `Select route ${from} to ${to}. ${formatDateCount(route.dateCount, locale)} available dates.${nextFlight}`;
}

function dateButtonAriaLabel(
  iso: string,
  locale: Locale,
  fromCityName: string | undefined,
  toCityName: string | undefined,
  isAvailable: boolean,
) {
  const label = formatSelectedDate(iso, locale);
  const route = fromCityName && toCityName ? ` for ${fromCityName} to ${toCityName}` : '';
  return isAvailable ? `Choose available date ${label}${route}` : `Unavailable date ${label}${route}`;
}

function bookFlightAriaLabel(
  locale: Locale,
  fromCityName: string | undefined,
  toCityName: string | undefined,
  selectedDate: string | null,
) {
  const route = fromCityName && toCityName ? `${fromCityName} to ${toCityName}` : 'selected route';
  const date = selectedDate ? formatSelectedDate(selectedDate, locale) : 'selected date';
  return `Book ${route} on ${date} with Vanilla Sky`;
}

function formatBlogDate(iso: string, locale: Locale) {
  const [year, month, day] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat(toIntlLocale(locale), { year: 'numeric', month: 'long', day: 'numeric' }).format(
    new Date(year, month - 1, day),
  );
}

// Backend returns prices like "50GEL" / "16USD"; show the lari symbol and a tidy USD.
function formatPrice(raw: string) {
  return raw
    .replace(/\s*GEL/i, ' ₾')
    .replace(/\s*USD/i, ' $')
    .trim();
}

function isValidAlertRange(dateFrom: string | null, dateTo: string | null) {
  return Boolean(dateFrom && dateTo && /^\d{4}-\d{2}-\d{2}$/.test(dateFrom) && /^\d{4}-\d{2}-\d{2}$/.test(dateTo) && dateFrom <= dateTo);
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function padMonth(value: number) {
  return String(value).padStart(2, '0');
}

function submitPostForm(action: string, fields: Record<string, string>, target: string) {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = action;
  form.target = target;
  form.style.display = 'none';

  for (const [name, value] of Object.entries(fields)) {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    form.append(input);
  }

  document.body.append(form);
  form.submit();
  form.remove();
}
