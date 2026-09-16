import { AlertCircle, ArrowRight, BellRing, CalendarRange, Check, ChevronDown, ExternalLink, Loader2 } from 'lucide-react';
import type { Messages } from '../lib/i18n';
import type { TelegramBindResult, TelegramLoginUser } from '../lib/telegram-login';
import { TelegramLoginButton } from './TelegramLoginButton';

// `invite` sits under a result the traveller can already book, so it stays a
// single collapsed line. `recovery` is what a dead-end day gets instead: the
// configuration is the point of the section, so it is open from the start.
export type TelegramAlertMode = 'invite' | 'recovery';

// The range is picked in the calendar below, so the panel only ever reports
// which half of the pick it is waiting for.
export type AlertRangeStep = 'start' | 'end';

type Props = {
  copy: Messages;
  mode: TelegramAlertMode;
  fromCityName: string;
  toCityName: string;
  routeLabel: string;
  rangeLabel: string;
  hasSelectedDate: boolean;
  open: boolean;
  onToggle: () => void;
  calendarId: string;
  rangeSelecting: boolean;
  rangeStep: AlertRangeStep;
  rangeStartLabel: string;
  onPickRange: () => void;
  onCancelRangePick: () => void;
  onResetRange: () => void;
  rangeComplete: boolean;
  rangeHasTickets: boolean;
  loginEnabled: boolean;
  botUsername: string | null;
  submitting: boolean;
  error: string | null;
  result: TelegramBindResult | null;
  onTelegramAuth: (user: TelegramLoginUser) => void;
};

const configId = 'telegram-alert-config';
const titleId = 'telegram-alert-title';

export function TelegramAlertPanel({
  copy,
  mode,
  fromCityName,
  toCityName,
  routeLabel,
  rangeLabel,
  hasSelectedDate,
  open,
  onToggle,
  calendarId,
  rangeSelecting,
  rangeStep,
  rangeStartLabel,
  onPickRange,
  onCancelRangePick,
  onResetRange,
  rangeComplete,
  rangeHasTickets,
  loginEnabled,
  botUsername,
  submitting,
  error,
  result,
  onTelegramAuth,
}: Props) {
  const recovery = mode === 'recovery';

  return (
    <section
      className={recovery ? 'alert-panel recovery' : 'alert-panel'}
      aria-label={copy.alertsRouteAria(routeLabel)}
    >
      <div className="alert-head">
        <span className="alert-ic" aria-hidden="true">
          <BellRing size={17} />
        </span>
        <div className="alert-intro">
          <h3 className="alert-title" id={titleId}>
            {recovery
              ? hasSelectedDate
                ? copy.alertsRecoveryTitle
                : copy.alertsRouteRecoveryTitle
              : copy.alertsInviteTitle}
          </h3>
          <p className="alert-body">
            {recovery ? copy.alertsRecoveryBody(routeLabel) : copy.alertsInviteBody(routeLabel)}
          </p>
          <p className="alert-context">
            <span className="alert-route">
              <span className="city">{fromCityName}</span>
              <ArrowRight aria-hidden="true" size={13} />
              <span className="city">{toCityName}</span>
            </span>
            {rangeLabel ? <span className="alert-range">{copy.alertsWatchingRange(rangeLabel)}</span> : null}
          </p>
        </div>
        {recovery ? null : (
          <button
            className="alert-toggle"
            type="button"
            aria-expanded={open}
            aria-controls={configId}
            onClick={onToggle}
          >
            {open ? copy.alertsCloseSetup : copy.alertsOpenSetup}
            <ChevronDown className="alert-chev" aria-hidden="true" size={15} />
          </button>
        )}
      </div>

      <div className="alert-config" id={configId}>
        {open ? (
          <>
            {/* The completed window and the single action that acts on it live
                in one block: there is no second Telegram entry point below. */}
            <div
              className={[
                'alert-range-picker',
                rangeSelecting ? 'picking' : '',
                rangeComplete && !rangeSelecting ? 'complete' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              role="group"
              aria-label={copy.alertsRangeLegend}
            >
              <div className="alert-range-current">
                <span className="alert-range-legend">{copy.alertsRangeLegend}</span>
                <strong className="alert-range-value">
                  <CalendarRange aria-hidden="true" size={14} />
                  {rangeLabel || copy.alertsRangeEmpty}
                </strong>
              </div>
              <div className="alert-range-actions">
                <button
                  className="alert-chip"
                  type="button"
                  aria-controls={calendarId}
                  aria-pressed={rangeSelecting}
                  onClick={rangeSelecting ? onCancelRangePick : onPickRange}
                >
                  {rangeSelecting ? copy.alertsRangeCancel : copy.alertsRangePick}
                </button>
                <button
                  className="alert-chip"
                  type="button"
                  disabled={!rangeLabel && !rangeSelecting}
                  onClick={onResetRange}
                >
                  {copy.alertsRangeReset}
                </button>
              </div>
              {/* The pick happens in the calendar above, so the step has to be
                  announced here rather than left to the visual highlight. */}
              <p className="alert-range-hint" role="status">
                {rangeSelecting
                  ? rangeStep === 'start'
                    ? copy.alertsRangeStartHint
                    : copy.alertsRangeEndHint(rangeStartLabel)
                  : copy.alertsRangeCalendarHint}
              </p>

              <TelegramAction
                copy={copy}
                rangeLabel={rangeLabel}
                rangeSelecting={rangeSelecting}
                rangeComplete={rangeComplete}
                loginEnabled={loginEnabled}
                botUsername={botUsername}
                submitting={submitting}
                result={result}
                onTelegramAuth={onTelegramAuth}
              />
            </div>

            {rangeHasTickets ? <p className="alert-available">{copy.alertsAlreadyAvailable}</p> : null}

            <ul className="alert-notes">
              <li>{copy.alertsNoteConfirm}</li>
              <li>{copy.alertsNoteTrigger(routeLabel)}</li>
              <li>{copy.alertsNoteStop}</li>
            </ul>

            {error ? (
              <div className="notice error" role="alert">
                <AlertCircle size={18} />
                {error}
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </section>
  );
}

// Exactly one Telegram action exists at a time: the sign-in widget while the
// binding is still to be made, and — only if Telegram refused the confirmation
// message — the new-chat fallback that replaces it.
function TelegramAction({
  copy,
  rangeLabel,
  rangeSelecting,
  rangeComplete,
  loginEnabled,
  botUsername,
  submitting,
  result,
  onTelegramAuth,
}: Pick<
  Props,
  'copy' | 'rangeLabel' | 'rangeSelecting' | 'rangeComplete' | 'loginEnabled' | 'botUsername' | 'submitting' | 'result' | 'onTelegramAuth'
>) {
  if (result) {
    if (!result.needsStart || !result.startUrl) {
      return (
        <p className="alert-result done" role="status">
          <Check aria-hidden="true" size={15} />
          {copy.alertsTelegramBound(rangeLabel)}
        </p>
      );
    }

    return (
      <div className="alert-result needs-start" role="status">
        <span>{copy.alertsTelegramNeedsStart}</span>
        <a
          className="alert-cta alert-cta-start"
          data-telegram-cta="start-fallback"
          href={result.startUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          {copy.alertsTelegramOpenBot}
          <ExternalLink aria-hidden="true" size={14} />
        </a>
      </div>
    );
  }

  if (rangeSelecting || !rangeComplete) {
    return <p className="alert-cta-note">{copy.alertsRangeIncomplete}</p>;
  }

  if (!loginEnabled || !botUsername) {
    return <p className="alert-cta-note">{copy.alertsTelegramUnavailable}</p>;
  }

  return (
    <>
      <TelegramLoginButton botUsername={botUsername} label={copy.alertsTelegramCta} onAuth={onTelegramAuth} />
      {submitting ? (
        <p className="alert-cta-note" role="status">
          <Loader2 className="spin" size={14} />
          {copy.alertsTelegramOpening}
        </p>
      ) : null}
    </>
  );
}
