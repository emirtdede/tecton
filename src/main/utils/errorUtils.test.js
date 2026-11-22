const { toUserError, toUserErrorPayload, KIND_TO_KEY } = require('./errorUtils');
const logger = require('../logger');

describe('errorUtils', () => {
  let errorSpy;

  beforeEach(() => {
    // Real electron-log is required by errorUtils; spy on it instead of mocking
    // the module so the assertion covers the actual call path.
    errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it('toUserError logs the real error once and returns a translatable payload', () => {
    const payload = toUserError(new Error('SQLITE_CONSTRAINT: workers.tc_no'), 'db_error');

    expect(payload.messageKey).toBe('errors.db_error');
    // The user-facing message must not leak internal SQL details.
    expect(payload.message).not.toContain('SQLITE');
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it('toUserErrorPayload returns the same payload shape without logging', () => {
    const payload = toUserErrorPayload('invalid_input');

    expect(payload).toEqual({
      message: expect.any(String),
      messageKey: KIND_TO_KEY.invalid_input
    });
    // Used by module-load constants and routine validation rejections: logging
    // them wrote a fake stack trace into the user's log file.
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('toUserErrorPayload falls back to the generic key for an unknown kind', () => {
    const payload = toUserErrorPayload('not_a_real_kind');

    expect(payload.messageKey).toBe(KIND_TO_KEY.generic);
    expect(payload.message).toEqual(expect.any(String));
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
