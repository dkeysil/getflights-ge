import { useEffect, useRef } from 'react';
import type { TelegramLoginUser } from '../lib/telegram-login';

// The official widget script from telegram.org. It replaces the element it is
// appended to with Telegram's own button, and calls `data-onauth` with the
// signed payload once the user confirms.
const widgetSrc = 'https://telegram.org/js/telegram-widget.js?22';

type Props = {
  botUsername: string;
  label: string;
  onAuth: (user: TelegramLoginUser) => void;
};

export function TelegramLoginButton({ botUsername, label, onAuth }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  // The widget calls a global by name, so the latest handler is read through a
  // ref rather than re-mounting the script on every render.
  const onAuthRef = useRef(onAuth);
  onAuthRef.current = onAuth;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const callbackName = `onTelegramAuth_${Math.random().toString(36).slice(2)}`;
    const globals = window as unknown as Record<string, unknown>;
    globals[callbackName] = (user: TelegramLoginUser) => onAuthRef.current(user);

    const script = document.createElement('script');
    script.async = true;
    script.src = widgetSrc;
    script.setAttribute('data-telegram-login', botUsername);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-userpic', 'false');
    script.setAttribute('data-radius', '10');
    // Asks for permission to message the user up front, which is what usually
    // saves the flow from the "press Start first" fallback.
    script.setAttribute('data-request-access', 'write');
    script.setAttribute('data-onauth', `${callbackName}(user)`);
    mount.appendChild(script);

    return () => {
      delete globals[callbackName];
      mount.replaceChildren();
    };
  }, [botUsername]);

  return (
    <div className="alert-cta alert-cta-login" data-telegram-cta="login">
      <span className="alert-cta-label">{label}</span>
      <div className="alert-login-mount" ref={mountRef} />
    </div>
  );
}
