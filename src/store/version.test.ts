import { afterEach, describe, expect, test, vi } from 'vitest';
import { checkVersion, useVersion } from './version';

afterEach(() => {
  vi.unstubAllGlobals();
});

// NUMI build: the update check against api.umami.is is disabled.
describe('checkVersion', () => {
  test('never contacts the update server or flags an update', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);

    await checkVersion();

    expect(fetch).not.toHaveBeenCalled();
    const state = useVersion.getState();
    expect(state.checked).toBe(false);
    expect(state.hasUpdate).toBe(false);
  });
});
