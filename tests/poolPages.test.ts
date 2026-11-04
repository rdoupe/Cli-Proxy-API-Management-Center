import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import i18n from '../src/i18n/index';
import { availableActions } from '../src/features/pool/accountActions';
import { AccountRow } from '../src/features/pool/components/AccountRow';
import { BreakdownBars } from '../src/features/pool/components/BreakdownBars';
import { CapacityStrip } from '../src/features/pool/components/CapacityStrip';
import { LatencyChart } from '../src/features/pool/components/LatencyChart';
import { PolicyCard } from '../src/features/pool/components/PolicyCard';
import { RangePicker } from '../src/features/pool/components/RangePicker';
import { RequestsChart } from '../src/features/pool/components/RequestsChart';
import { formatBalance, formatLatency, rateTone, reasonLabel } from '../src/features/pool/format';
import { filterAccounts } from '../src/features/pool/logic';
import type { PoolAccount, PoolSeriesPoint } from '../src/types/pool';

const account = (overrides: Partial<PoolAccount>): PoolAccount => ({
  id: 'claude:ryan',
  provider: 'claude',
  label: 'ryan@example.com',
  kind: 'subscription',
  state: 'ready',
  reason: '',
  eligible: true,
  priority: 10,
  resetAt: null,
  lastSuccessAt: null,
  lastFailureAt: null,
  balance: null,
  fileName: 'ryan.json',
  authIndex: '7',
  managedIn: 'credentials',
  ...overrides,
});

const render = (element: React.ReactElement) =>
  renderToStaticMarkup(createElement(MemoryRouter, null, element));

describe('account actions', () => {
  test('offers only what the backend can do for that account', () => {
    expect(availableActions(account({}))).toEqual(['pause', 'check']);
    expect(availableActions(account({ state: 'paused' }))).toEqual(['resume']);
    expect(availableActions(account({ state: 'rate_limited' }))).toEqual(['pause', 'check', 'clear_limit']);
    expect(availableActions(account({ state: 'rate_limited', authIndex: null }))).toEqual(['pause', 'check']);
    expect(availableActions(account({ kind: 'api_key' }))).toEqual(['pause']);
    // Pool-only accounts with no credential handle cannot be paused, but the pool can reset them.
    expect(availableActions(account({ fileName: null, managedIn: 'pool' }))).toEqual([]);
    expect(
      availableActions(account({ fileName: null, authIndex: null, managedIn: 'pool', state: 'out_of_credits' }))
    ).toEqual(['clear_limit']);
    expect(availableActions(account({ state: 'unavailable' }))).toEqual(['pause', 'check', 'clear_limit']);
  });

  test('row shows reconnect for expired logins and a providers link for unmanaged keys', async () => {
    await i18n.changeLanguage('en');
    const expired = render(
      createElement(AccountRow, {
        account: account({ state: 'login_expired', reason: 'invalid_grant' }),
        nowMs: Date.now(),
        busy: false,
        disabled: false,
        onAction: () => undefined,
      })
    );
    expect(expired).toContain('Login expired');
    expect(expired).toContain('Login was revoked or expired');
    expect(expired).toContain('href="/oauth"');

    const key = render(
      createElement(AccountRow, {
        account: account({ kind: 'api_key', fileName: null, authIndex: null, managedIn: 'pool' }),
        nowMs: Date.now(),
        busy: false,
        disabled: false,
        onAction: () => undefined,
      })
    );
    expect(key).toContain('href="/ai-providers"');
    expect(key).not.toContain('>Pause<');
  });

  test('row shows a balance and a reset countdown only when known', async () => {
    await i18n.changeLanguage('en');
    const now = Date.parse('2026-11-04T10:00:00Z');
    const html = render(
      createElement(AccountRow, {
        account: account({
          kind: 'api_key',
          state: 'rate_limited',
          resetAt: '2026-11-04T13:00:00Z',
          balance: { amount: 7.4, currency: 'USD' },
        }),
        nowMs: now,
        busy: false,
        disabled: false,
        onAction: () => undefined,
      })
    );
    expect(html).toContain('$7.40');
    expect(html).toContain('in 3 hours');

    const bare = render(
      createElement(AccountRow, {
        account: account({}),
        nowMs: now,
        busy: false,
        disabled: false,
        onAction: () => undefined,
      })
    );
    expect(bare).not.toContain('Balance');
    expect(bare).not.toContain('Back ');
  });
});

describe('filterAccounts', () => {
  const accounts = [
    account({ id: 'a', label: 'a@x' }),
    account({ id: 'b', label: 'b@x', state: 'paused' }),
    account({ id: 'c', label: 'c@x', state: 'unavailable', eligible: false }),
  ];
  test('attention excludes ready and paused, paused only paused, search matches label', () => {
    expect(filterAccounts(accounts, 'attention', '').map((entry) => entry.id)).toEqual(['c']);
    expect(filterAccounts(accounts, 'paused', '').map((entry) => entry.id)).toEqual(['b']);
    expect(filterAccounts(accounts, 'all', 'B@').map((entry) => entry.id)).toEqual(['b']);
  });
});

describe('capacity strip', () => {
  test('renders one cell per account with an accessible label and a legend', async () => {
    await i18n.changeLanguage('en');
    const html = render(
      createElement(CapacityStrip, {
        accounts: [account({}), account({ id: 'x', label: 'x@x', state: 'paused' })],
      })
    );
    expect(html.match(/<button/g)?.length).toBe(2);
    expect(html).toContain('ryan@example.com · Ready');
    expect(html).toContain('x@x · Paused');
    expect(html).toContain('1 of 2 ready');
  });
});

describe('policy card', () => {
  test('explains subscriptions-first with the fallback switch in words', async () => {
    await i18n.changeLanguage('en');
    const on = render(
      createElement(PolicyCard, { policy: { strategy: 'subscriptions_first', allowPaidFallback: true } })
    );
    expect(on).toContain('Subscriptions first, paid keys as backup');
    expect(on).toContain('a paid API key takes it');
    expect(on).toContain('whichever provider');
    const off = render(
      createElement(PolicyCard, { policy: { strategy: 'subscriptions_first', allowPaidFallback: false } })
    );
    expect(off).toContain('not used as backup for any provider');
  });

  test('without a pool policy it describes configured priorities and says where that comes from', async () => {
    await i18n.changeLanguage('en');
    const html = render(
      createElement(PolicyCard, {
        policy: null,
        settings: { strategy: 'fill-first', sessionAffinity: false, requestRetry: 1, maxRetryCredentials: 0 },
      })
    );
    expect(html).toContain('Strict priority order');
    expect(html).toContain('first account serves until it is limited');
    expect(html).toContain('no separate pool policy');
  });
});

describe('charts', () => {
  const series: PoolSeriesPoint[] = [
    { at: '2026-11-04T08:00:00Z', requests: 3, successes: 3, failures: 0, inputTokens: null, outputTokens: null, averageLatencyMs: 800 },
    { at: '2026-11-04T09:00:00Z', requests: 5, successes: 4, failures: 1, inputTokens: null, outputTokens: null, averageLatencyMs: null },
    { at: '2026-11-04T10:00:00Z', requests: 0, successes: 0, failures: 0, inputTokens: null, outputTokens: null, averageLatencyMs: 1200 },
  ];

  test('requests chart draws stacked segments, a legend and a table', async () => {
    await i18n.changeLanguage('en');
    const html = render(createElement(RequestsChart, { series, range: '24h' }));
    expect(html).toContain('8 attempts: 7 succeeded, 1 failed');
    expect(html.match(/data-series="failure"/g)?.length).toBe(1);
    expect(html.match(/data-series="success"/g)?.length).toBe(2);
    expect(html).toContain('<table');
    expect(html).toContain('80%');
  });

  test('latency chart leaves a gap for unreported buckets instead of a zero', async () => {
    await i18n.changeLanguage('en');
    const html = render(createElement(LatencyChart, { series, range: '24h' }));
    expect(html.match(/<path/g)?.length).toBe(2);
    expect(html).toContain('Average latency across 2 buckets');
    const none = render(
      createElement(LatencyChart, { series: series.map((p) => ({ ...p, averageLatencyMs: null })), range: '1h' })
    );
    expect(none).toContain('No latency reported');
  });

  test('empty series says so', async () => {
    await i18n.changeLanguage('en');
    expect(render(createElement(RequestsChart, { series: [], range: '7d' }))).toContain('No requests in this range');
  });

  test('breakdown bars sort by requests and show rate', async () => {
    await i18n.changeLanguage('en');
    const html = render(
      createElement(BreakdownBars, {
        title: 'By service',
        rows: [
          { id: 'codex', name: 'codex', requests: 2, successes: 2, failures: 0 },
          { id: 'claude', name: 'claude', requests: 10, successes: 9, failures: 1 },
        ],
      })
    );
    expect(html.indexOf('claude')).toBeLessThan(html.indexOf('codex'));
    expect(html).toContain('10 · 90%');
  });

  test('range picker is a radio group with one tab stop', () => {
    const html = render(createElement(RangePicker, { value: '7d', onChange: () => undefined }));
    expect(html).toContain('role="radiogroup"');
    expect(html.match(/tabindex="0"/g)?.length).toBe(1);
    expect(html).toContain('aria-checked="true"');
  });
});

describe('format', () => {
  test('never invents a value', () => {
    expect(formatBalance(null)).toBeNull();
    expect(formatBalance({ amount: null, currency: 'USD' })).toBeNull();
    expect(formatLatency(null, 'n/a')).toBe('n/a');
    expect(formatLatency(850)).toBe('850 ms');
    expect(formatLatency(2500)).toBe('2.50 s');
    expect(rateTone(null)).toBe('muted');
    expect(rateTone(99)).toBe('good');
    expect(rateTone(95)).toBe('warning');
    expect(rateTone(50)).toBe('critical');
  });

  test('reason codes translate, free text passes through', async () => {
    await i18n.changeLanguage('en');
    expect(reasonLabel(i18n.t.bind(i18n), 'payment_required')).toBe('Payment required');
    expect(reasonLabel(i18n.t.bind(i18n), 'weekly limit reached')).toBe('weekly limit reached');
  });
});

describe('navigation and routes', () => {
  const layout = readFileSync('src/components/layout/MainLayout.tsx', 'utf8');
  const routes = readFileSync('src/router/MainRoutes.tsx', 'utf8');

  test('sidebar has the three plain groups and no leftover vague ones', () => {
    expect(layout).toContain("labelKey: 'nav_groups.pool'");
    expect(layout).toContain("labelKey: 'nav_groups.setup'");
    expect(layout).toContain("labelKey: 'nav_groups.diagnostics'");
    for (const old of ['operate', 'gateway', 'observe', 'control']) {
      expect(layout).not.toContain(`nav_groups.${old}`);
    }
    for (const path of ['/', '/accounts', '/usage', '/routing', '/oauth', '/ai-providers', '/auth-files', '/config', '/quota', '/logs', '/system']) {
      expect(layout).toContain(`path: '${path}'`);
    }
  });

  test('old entry points still resolve', () => {
    expect(routes).toContain(`{ path: '/dashboard', element: <Navigate to="/" replace /> }`);
    expect(routes).toContain(`{ path: '/accounts', element: <AccountsPage /> }`);
    expect(routes).toContain(`{ path: '/usage', element: <UsagePage /> }`);
    for (const path of ['/quota', '/logs', '/config', '/system', '/auth-files', '/oauth', '/ai-providers', '/routing']) {
      expect(routes).toContain(`path: '${path}'`);
    }
  });

  test('every locale labels the new navigation', async () => {
    for (const lang of ['en', 'zh-CN', 'zh-TW', 'ru', 'vi', 'ko', 'tr']) {
      await i18n.changeLanguage(lang);
      for (const key of ['nav.overview', 'nav.accounts', 'nav.usage', 'nav_groups.pool', 'pool.state.ready']) {
        expect(i18n.t(key)).not.toBe(key);
      }
    }
  });
});
