import { describe, expect, test } from 'bun:test';
import {
  accountsFromCredentials,
  attentionReasons,
  groupAccountsByProvider,
  isPoolEndpointMissing,
  normalizePoolExplain,
  normalizePoolOverview,
  normalizePoolStats,
  summarizeCapacity,
  successRate,
} from '../src/features/pool/logic';
import type { AuthFileItem } from '../src/types/authFile';

const NOW = Date.parse('2026-11-04T10:00:00Z');

describe('normalizePoolOverview', () => {
  test('keeps the contract shape and never invents numbers', () => {
    const overview = normalizePoolOverview({
      schemaVersion: 1,
      observedAt: '2026-11-04T09:59:00Z',
      accounts: [
        {
          id: 'claude:ryan',
          provider: 'claude',
          label: 'ryan@example.com',
          kind: 'subscription',
          state: 'rate_limited',
          reason: 'weekly limit',
          eligible: false,
          priority: 10,
          resetAt: '2026-11-06T00:00:00Z',
          lastSuccessAt: null,
          balance: null,
        },
        {
          id: 'openrouter:key',
          provider: 'openrouter',
          label: 'OpenRouter key',
          kind: 'api_key',
          state: 'ready',
          eligible: true,
          priority: 0,
          balance: { amount: 7.4, currency: 'USD' },
        },
      ],
      policy: { strategy: 'subscriptions_first', allowPaidFallback: true },
      stats: {
        available: true,
        from: '2026-11-03T10:00:00Z',
        to: '2026-11-04T10:00:00Z',
        requests: 120,
        successes: 118,
        failures: 2,
        failovers: 1,
        inputTokens: null,
        outputTokens: 5000,
        averageLatencyMs: null,
      },
    });
    expect(overview.source).toBe('pool');
    expect(overview.accounts).toHaveLength(2);
    expect(overview.accounts[0].state).toBe('rate_limited');
    expect(overview.accounts[0].resetAt).toBe('2026-11-06T00:00:00Z');
    expect(overview.accounts[1].balance).toEqual({ amount: 7.4, currency: 'USD' });
    // The pool id doubles as the credentials API's auth index.
    expect(overview.accounts[0].authIndex).toBe('claude:ryan');
    expect(overview.accounts[0].lastFailureAt).toBeNull();
    expect(overview.accounts[1].reason).toBe('');
    expect(overview.policy?.strategy).toBe('subscriptions_first');
    expect(overview.stats.inputTokens).toBeNull();
    expect(overview.stats.averageLatencyMs).toBeNull();
    expect(overview.stats.outputTokens).toBe(5000);
  });

  test('unknown states and malformed entries degrade to unknown, not ready', () => {
    const overview = normalizePoolOverview({
      schemaVersion: 1,
      accounts: [{ id: 'x', provider: 'claude', label: 'x', kind: 'weird', state: 'on-fire' }],
      stats: { available: false, reason: 'no_data' },
    });
    expect(overview.accounts[0].state).toBe('unknown');
    expect(overview.accounts[0].kind).toBe('subscription');
    expect(overview.accounts[0].eligible).toBe(false);
    expect(overview.policy).toBeNull();
    expect(overview.stats.available).toBe(false);
    expect(overview.stats.reason).toBe('no_data');
    expect(overview.stats.requests).toBe(0);
  });
});

describe('accountsFromCredentials', () => {
  const files: AuthFileItem[] = [
    { name: 'ryan.json', type: 'claude', email: 'ryan@example.com', priority: 10 },
    { name: 'paused.json', type: 'claude', email: 'paused@example.com', disabled: true },
    { name: 'broken.json', type: 'codex', email: 'b@example.com', unavailable: true },
    {
      name: 'limited.json',
      type: 'claude',
      email: 'limited@example.com',
      cooldownSnapshot: {
        receivedAtMs: NOW - 1000,
        records: [
          {
            scope: 'credential',
            reason: 'quota',
            retryAt: '2026-11-04T12:00:00Z',
            remainingSeconds: 7200,
          },
        ],
      },
    },
    {
      name: 'expired.json',
      type: 'codex',
      email: 'e@example.com',
      cooldownSnapshot: {
        receivedAtMs: NOW - 1000,
        records: [
          {
            scope: 'credential',
            reason: 'invalid_grant',
            retryAt: '2026-11-05T12:00:00Z',
            remainingSeconds: 93600,
          },
        ],
      },
    },
    {
      name: 'nocredit.json',
      type: 'claude',
      email: 'n@example.com',
      cooldownSnapshot: {
        receivedAtMs: NOW - 1000,
        records: [
          {
            scope: 'credential',
            reason: 'payment_required',
            retryAt: '2026-11-04T11:00:00Z',
            remainingSeconds: 3600,
          },
        ],
      },
    },
    { name: 'warn.json', type: 'claude', email: 'w@example.com', statusMessage: 'token refresh failed' },
    { name: 'key.json', type: 'claude', account_type: 'api_key', account: 'sk-secret' },
    { name: 'openrouter', type: 'openai-compatibility', account_type: 'api_key', runtimeOnly: true },
  ];

  test('maps credential fields onto pool states without guessing', () => {
    const accounts = accountsFromCredentials(files, NOW);
    const byName = Object.fromEntries(accounts.map((account) => [account.fileName, account]));
    expect(byName['ryan.json'].state).toBe('ready');
    expect(byName['ryan.json'].eligible).toBe(true);
    expect(byName['ryan.json'].priority).toBe(10);
    expect(byName['ryan.json'].kind).toBe('subscription');
    expect(byName['paused.json'].state).toBe('paused');
    expect(byName['broken.json'].state).toBe('unavailable');
    expect(byName['limited.json'].state).toBe('rate_limited');
    expect(byName['limited.json'].resetAt).toBe('2026-11-04T12:00:00Z');
    expect(byName['expired.json'].state).toBe('login_expired');
    expect(byName['nocredit.json'].state).toBe('out_of_credits');
    expect(byName['warn.json'].state).toBe('unknown');
    expect(byName['warn.json'].reason).toBe('token refresh failed');
    expect(byName['key.json'].kind).toBe('api_key');
    // The API key itself must never become a label.
    expect(byName['key.json'].label).not.toContain('sk-secret');
    expect(accounts.every((account) => account.balance === null)).toBe(true);
    // Config-side keys cannot be paused through the credentials API.
    const runtime = accounts.find((account) => account.label === 'openrouter');
    expect(runtime?.fileName).toBeNull();
    expect(runtime?.managedIn).toBe('providers');
  });

  test('ignores cooldowns that already expired', () => {
    const accounts = accountsFromCredentials(
      [
        {
          name: 'old.json',
          type: 'claude',
          cooldownSnapshot: {
            receivedAtMs: NOW - 10_000,
            records: [
              { scope: 'credential', reason: 'quota', retryAt: '2026-11-04T09:00:00Z', remainingSeconds: 1 },
            ],
          },
        },
      ],
      NOW
    );
    expect(accounts[0].state).toBe('ready');
  });
});

describe('summaries', () => {
  const accounts = accountsFromCredentials(
    [
      { name: 'a.json', type: 'claude', email: 'a@x' },
      { name: 'b.json', type: 'claude', email: 'b@x', disabled: true },
      { name: 'c.json', type: 'codex', email: 'c@x', unavailable: true },
    ],
    NOW
  );

  test('capacity counts only eligible accounts as ready', () => {
    const capacity = summarizeCapacity(accounts);
    expect(capacity).toEqual({ total: 3, ready: 1, paused: 1, offByPolicy: 0, attention: 1 });
  });

  test('a model-only limit keeps an eligible account in the ready count', () => {
    const limited = { ...accounts[0], state: 'rate_limited' as const, eligible: true };
    expect(summarizeCapacity([limited]).ready).toBe(1);
    expect(attentionReasons([limited])).toEqual([]);
    const blocked = { ...limited, eligible: false };
    expect(attentionReasons([blocked]).map((entry) => entry.state)).toEqual(['rate_limited']);
  });

  test('attention lists everything that is neither ready nor paused by hand', () => {
    const reasons = attentionReasons(accounts);
    expect(reasons.map((entry) => entry.account.fileName)).toEqual(['c.json']);
  });

  test('groups by provider with ready accounts first inside a group', () => {
    const groups = groupAccountsByProvider(accounts);
    expect(groups.map((group) => group.provider)).toEqual(['claude', 'codex']);
    expect(groups[0].accounts.map((account) => account.fileName)).toEqual(['a.json', 'b.json']);
  });

  test('success rate is null without requests', () => {
    expect(successRate({ requests: 0, successes: 0 })).toBeNull();
    expect(successRate({ requests: 4, successes: 3 })).toBe(75);
  });
});

describe('normalizePoolStats', () => {
  test('reads series and breakdowns, leaving unknown tokens null', () => {
    const stats = normalizePoolStats(
      {
        available: true,
        from: '2026-11-03T10:00:00Z',
        to: '2026-11-04T10:00:00Z',
        totals: { requests: 10, successes: 9, failures: 1, failovers: 0 },
        series: [
          { at: '2026-11-03T10:00:00Z', requests: 4, successes: 4, failures: 0, averageLatencyMs: 900 },
          { at: '2026-11-03T11:00:00Z', requests: 6, successes: 5, failures: 1 },
        ],
        byProvider: [{ name: 'claude', requests: 10, successes: 9, failures: 1 }],
        byModel: [],
        byAccount: [{ id: 'a', label: 'ryan', requests: 10, successes: 9, failures: 1 }],
      },
      '24h'
    );
    expect(stats.available).toBe(true);
    expect(stats.range).toBe('24h');
    expect(stats.totals.inputTokens).toBeNull();
    expect(stats.series[1].averageLatencyMs).toBeNull();
    expect(stats.series[0].inputTokens).toBeNull();
    expect(stats.byAccount[0]).toEqual({ id: 'a', name: 'ryan', requests: 10, successes: 9, failures: 1 });
    expect(stats.byProvider[0].id).toBe('claude');
  });

  test('reads persistence and the earliest observed instant', () => {
    const stats = normalizePoolStats(
      { available: true, persistence: 'memory', observedSince: '2026-11-01T08:00:00Z', totals: {} },
      '7d'
    );
    expect(stats.persistence).toBe('memory');
    expect(stats.observedSince).toBe('2026-11-01T08:00:00Z');
    expect(normalizePoolStats({ available: true, persistence: 'weird' }, '1h').persistence).toBeNull();
  });

  test('unavailable stats carry the backend reason and no numbers', () => {
    const stats = normalizePoolStats({ available: false, reason: 'request log disabled' }, '1h');
    expect(stats.available).toBe(false);
    expect(stats.reason).toBe('request log disabled');
    expect(stats.series).toEqual([]);
    expect(stats.totals.requests).toBe(0);
  });
});

describe('normalizePoolExplain', () => {
  test('reports ties when the strategy rotates between equals', () => {
    const explain = normalizePoolExplain({
      model: 'm',
      selectedAccountId: null,
      tiedAccountIds: ['a', 'b'],
      candidates: [{ id: 'a', label: 'A', eligible: true }, { id: 'b', label: 'B', eligible: true }],
    });
    expect(explain.selectedAccountId).toBeNull();
    expect(explain.tiedAccountIds).toEqual(['a', 'b']);
  });

  test('keeps candidates in backend order', () => {
    const explain = normalizePoolExplain({
      model: 'claude-fable-5-1',
      policy: { strategy: 'subscriptions_first', allowPaidFallback: false },
      selectedAccountId: 'b',
      candidates: [
        { id: 'a', label: 'A', eligible: false, reason: 'rate limited' },
        { id: 'b', label: 'B', eligible: true },
      ],
      reason: 'first eligible subscription',
    });
    expect(explain.selectedAccountId).toBe('b');
    expect(explain.candidates.map((candidate) => candidate.id)).toEqual(['a', 'b']);
    expect(explain.candidates[1].reason).toBe('');
  });
});

describe('isPoolEndpointMissing', () => {
  test('treats 404 and 501 as an older backend, other errors as failures', () => {
    expect(isPoolEndpointMissing(Object.assign(new Error('x'), { status: 404 }))).toBe(true);
    expect(isPoolEndpointMissing(Object.assign(new Error('x'), { status: 501 }))).toBe(true);
    expect(isPoolEndpointMissing(Object.assign(new Error('x'), { status: 500 }))).toBe(false);
    expect(isPoolEndpointMissing(new Error('network'))).toBe(false);
  });
});
