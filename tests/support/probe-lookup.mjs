import assert from 'node:assert/strict';

export const scenarios = {
  'Enable disk spooling on ParcelQuill 2.4 without using the latest schema': {
    fixture: 'find-docs/pinned',
    prompt: 'Our collector is pinned to ParcelQuill 2.4. What JSON configuration enables a disk spool '
      + 'with a maximum of 512 KiB? Return just the configuration object. '
      + 'The collector SDK and its documentation are internal; use local resources only.',
  },
};

export function checkRelease(records) {
  assert.ok(records.some((r) => r.page === '/parcelquill/collector/v2.4/spooling'),
    'No successful retrieval of the 2.4 spooling page');
}

export function checkConfig(text) {
  const trimmed = text.trim();
  const json = trimmed.match(/^```(?:json)?\s*\n([\s\S]*?)\n```$/i)?.[1] ?? trimmed;
  assert.deepEqual(JSON.parse(json), { journal: { medium: 'volume', limitKiB: 512 } });
}
