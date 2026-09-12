import { AlertCircle, ArrowRight, BellRing, CalendarRange, ChevronDown, ExternalLink, Loader2, Send } from 'lucide-react';
import type { FormEvent } from 'react';
import type { Messages } from '../lib/i18n';

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
  onPickRange: () => void;
  onCancelRangePick: () => void;
  onResetRange: () => void;
  rangeHasTickets: boolean;
  canSubmit: boolean;
  submitting: boolean;
  error: string | null;
  linkUrl: string | null;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
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
  onPickRange,
  onCancelRangePick,
  onResetRange,
  rangeHasTickets,
  canSubmit,
  submitting,
  error,
  linkUrl,
  onSubmit,
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
          <form onSubmit={onSubmit}>
            <div
              className={rangeSelecting ? 'alert-range-picker picking' : 'alert-range-picker'}
              role="group"
              aria-label={copy.alertsRangeLegend}
            >
              <div className="alert-range-current">
                <span className="alert-range-legend">{copy.alertsRangeLegend}</span>
                <strong className="alert-range-value">
                  <CalendarRange aria-hidden="true" size={14} />
                  {rangeLabel}
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
                <button className="alert-chip" type="button" onClick={onResetRange}>
                  {copy.alertsRangeReset}
                </button>
              </div>
              {/* The pick happens in the calendar below, so the step has to be
                  announced here rather than left to the visual highlight. */}
              <p className="alert-range-hint" role="status">
                {rangeSelecting
                  ? rangeStep === 'start'
                    ? copy.alertsRangeStartHint
                    : copy.alertsRangeEndHint
                  : copy.alertsRangeCalendarHint}
              </p>
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

            {linkUrl ? (
              <div className="notice alert-link" role="status" aria-live="polite">
                <a href={linkUrl} target="_blank" rel="noopener noreferrer">
                  {copy.alertsTelegramOpenManually}
                  <ExternalLink aria-hidden="true" size={14} />
                </a>
                <span className="sub">{copy.alertsTelegramHint}</span>
              </div>
            ) : null}

            <button className="alert-submit" type="submit" disabled={submitting || !canSubmit}>
              {submitting ? <Loader2 className="spin" size={16} /> : <Send size={16} />}
              {submitting ? copy.alertsTelegramOpening : copy.alertsTelegramCta}
            </button>
          </form>
        ) : null}
      </div>
    </section>
  );
}
