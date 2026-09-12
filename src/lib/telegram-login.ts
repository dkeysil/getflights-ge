// Client half of the staging-only Telegram Login Widget binding. The widget
// hands the browser a payload Telegram signed with the bot token; the Worker is
// the only place that signature is trusted, so nothing here inspects it.

export type TelegramLoginEnv = {
  VITE_TELEGRAM_LOGIN_ENABLED?: string;
  VITE_TELEGRAM_BOT_USERNAME?: string;
};

export type TelegramLoginConfig = {
  enabled: boolean;
  botUsername: string | null;
};

export type TelegramLoginUser = Record<string, string | number>;

export type TelegramBindResult = {
  // True when Telegram refused the confirmation message because the user has
  // never opened the bot chat. The subscription is already bound either way.
  needsStart: boolean;
  startUrl: string | null;
};

const botUsernamePattern = /^[A-Za-z0-9_]{5,32}$/;
const telegramHost = 't.me';

export function readTelegramLoginConfig(): TelegramLoginConfig {
  return telegramLoginConfig({
    VITE_TELEGRAM_LOGIN_ENABLED: import.meta.env.VITE_TELEGRAM_LOGIN_ENABLED,
    VITE_TELEGRAM_BOT_USERNAME: import.meta.env.VITE_TELEGRAM_BOT_USERNAME,
  });
}

// Both halves must be set for the widget to render: a production build sets
// neither, so the widget cannot appear there even if the alert flag is flipped.
export function telegramLoginConfig(env: TelegramLoginEnv = {}): TelegramLoginConfig {
  const botUsername = (env.VITE_TELEGRAM_BOT_USERNAME ?? '').trim().replace(/^@/, '');
  const usable = botUsernamePattern.test(botUsername);
  return {
    enabled: env.VITE_TELEGRAM_LOGIN_ENABLED === 'true' && usable,
    botUsername: usable ? botUsername : null,
  };
}

export function isTelegramBotLink(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && parsed.hostname === telegramHost;
  } catch {
    return false;
  }
}

export async function bindTelegramLogin(input: {
  token: string;
  user: TelegramLoginUser;
}): Promise<TelegramBindResult> {
  const response = await fetch('/api/alerts/telegram/login', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    credentials: 'omit',
    body: JSON.stringify({ token: input.token, user: input.user }),
  });

  if (!response.ok) {
    throw new Error(`Telegram login failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as { needsStart?: boolean; startUrl?: string };
  const startUrl = typeof payload?.startUrl === 'string' && isTelegramBotLink(payload.startUrl) ? payload.startUrl : null;

  return {
    needsStart: payload?.needsStart === true,
    startUrl: payload?.needsStart === true ? startUrl : null,
  };
}
