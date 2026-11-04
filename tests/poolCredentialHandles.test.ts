import { describe, expect, test } from 'bun:test';
import { attachCredentialHandles } from '../src/features/pool/credentialHandles';
import { normalizePoolOverview } from '../src/features/pool/logic';
import type { AuthFileItem } from '../src/types/authFile';

const accounts = () =>
  normalizePoolOverview({
    accounts: [
      {
        id: 'claude-index',
        provider: 'claude',
        label: 'shared@example.com',
        kind: 'subscription',
        state: 'ready',
        eligible: true,
      },
    ],
  }).accounts;

describe('pool credential action handles', () => {
  test('uses the exact account index despite an earlier shared email', () => {
    const files: AuthFileItem[] = [
      { name: 'codex.json', type: 'codex', email: 'shared@example.com', authIndex: 'codex-index' },
      {
        name: 'claude.json',
        type: 'claude',
        email: 'shared@example.com',
        authIndex: 'claude-index',
      },
    ];
    const [account] = attachCredentialHandles(accounts(), files);
    expect(account.fileName).toBe('claude.json');
    expect(account.authIndex).toBe('claude-index');
  });

  test('never attaches a file by display name or email without an exact index', () => {
    const [account] = attachCredentialHandles(accounts(), [
      {
        name: 'claude-index',
        type: 'claude',
        email: 'shared@example.com',
        authIndex: 'other-index',
      },
    ]);
    expect(account.fileName).toBeNull();
    expect(account.authIndex).toBe('claude-index');
  });

  test('does not attach runtime-only credentials', () => {
    const [account] = attachCredentialHandles(accounts(), [
      { name: 'virtual.json', type: 'claude', authIndex: 'claude-index', runtimeOnly: true },
    ]);
    expect(account.fileName).toBeNull();
  });
});
