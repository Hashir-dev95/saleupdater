import { createLocalizer, message, type Message, type MessageParams, type TranslationKey } from './index';

type ErrorKey = Extract<TranslationKey, `errors.${string}`>;
export class AppError extends Error {
  readonly localizedMessage: Message;
  constructor(key: ErrorKey, params?: MessageParams) {
    const localizedMessage = message(key, params);
    super(createLocalizer('en').resolve(localizedMessage));
    this.name = 'AppError';
    this.localizedMessage = localizedMessage;
  }
}

// Only our typed errors are user-facing. Never translate/display arbitrary backend or native strings.
export function errorMessage(error: unknown): Message {
  return error instanceof AppError ? error.localizedMessage : message('errors.generic');
}
