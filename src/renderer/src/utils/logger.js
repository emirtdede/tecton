/**
 * Renderer-side logger.
 *
 * Production builds should not spam the DevTools console with internal error
 * objects (they can leak stack traces and internal state). In development the
 * details stay visible; in production only a short, user-safe message is logged.
 */
const isDev = import.meta.env.DEV;

export const logError = (context, error) => {
  if (isDev) {
    // eslint-disable-next-line no-console
    console.error(context, error);
    return;
  }
  const message = error && error.message ? error.message : String(error);
  // eslint-disable-next-line no-console
  console.error(context, message);
};
