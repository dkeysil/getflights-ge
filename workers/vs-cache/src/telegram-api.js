// The Bot API host is a module constant on purpose: it must never be
// influenced by env or by anything that arrives in a webhook payload.
const telegramApiOrigin = 'https://api.telegram.org';
const permanentChatErrorPattern = /chat not found|bot was blocked|user is deactivated|bot was kicked|chat_id is empty/i;

export class TelegramUnavailableError extends Error {
  constructor(message = 'Telegram bot token is not configured.') {
    super(message);
    this.name = 'TelegramUnavailableError';
  }
}

export class TelegramApiError extends Error {
  constructor(message, { status, errorCode, retryAfterSeconds } = {}) {
    super(message);
    this.name = 'TelegramApiError';
    this.status = status ?? null;
    this.errorCode = errorCode ?? null;
    this.retryAfterSeconds = retryAfterSeconds ?? null;
  }
}

export function createTelegramClient({ botToken, fetchImpl } = {}) {
  if (typeof botToken !== 'string' || !botToken) {
    throw new TelegramUnavailableError();
  }

  const doFetch = fetchImpl ?? globalThis.fetch;
  const redact = (value) => String(value ?? '').replaceAll(botToken, '***');

  async function call(method, payload) {
    let response;
    try {
      response = await doFetch(`${telegramApiOrigin}/bot${botToken}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      // The request URL carries the bot token, so transport errors are redacted.
      throw new TelegramApiError(redact(error instanceof Error ? error.message : error));
    }

    const body = await response.json().catch(() => null);
    if (!response.ok || body?.ok !== true) {
      throw new TelegramApiError(redact(body?.description ?? `Telegram ${method} failed.`), {
        status: response.status,
        errorCode: body?.error_code ?? null,
        retryAfterSeconds: body?.parameters?.retry_after ?? null,
      });
    }

    return body.result;
  }

  return {
    async sendMessage({ chatId, text }) {
      return call('sendMessage', {
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      });
    },
  };
}

// A chat that blocked the bot or no longer exists will never accept a message,
// so the subscription is retired instead of retried every 10 minutes.
export function isPermanentTelegramChatError(error) {
  if (!(error instanceof TelegramApiError)) return false;
  if (error.errorCode === 403) return true;
  return error.errorCode === 400 && permanentChatErrorPattern.test(error.message);
}
