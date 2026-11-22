import { describe, expect, it } from 'vitest';
import { parsePublicApiOrigin } from './runtime';

describe('public backend origin', () => {
  it('accepts an HTTPS origin with an optional trailing slash', () => {
    expect(parsePublicApiOrigin('https://api.example.com/')).toBe('https://api.example.com');
    expect(parsePublicApiOrigin('https://api.example.com')).toBe('https://api.example.com');
  });

  it('does not connect without configuration or with an unsafe URL', () => {
    for (const value of [undefined, '', '/api', 'http://127.0.0.1:5080',
      'https://user:password@api.example.com', 'https://api.example.com/path',
      'https://api.example.com/?token=secret', 'https://api.example.com/#fragment']) {
      expect(parsePublicApiOrigin(value)).toBeNull();
    }
  });
});
