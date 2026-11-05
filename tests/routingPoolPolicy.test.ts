import { describe, expect, test } from 'bun:test';
import { buildRoutingBoard } from '../src/services/api/routing';
import { draftFromBoard, resolveRoute } from '../src/features/routing/logic';
import type { AuthFileItem } from '../src/types/authFile';

const RAW = {
  'api-keys': {
    claude: [{ name: 'claude-key', priority: 10, keys: [{ 'api-key': 'sk-aaaaaaaaaaaa' }] }],
  },
};
const FILES: AuthFileItem[] = [
  { name: 'sub.json', type: 'claude', email: 'sub@example.test', priority: 0 } as AuthFileItem,
  {
    name: 'keyfile.json',
    type: 'claude',
    account_type: 'api_key',
    priority: 0,
  } as unknown as AuthFileItem,
];
const CATALOG = { channels: {}, credentials: {} };

const memberStates = (policy: Parameters<typeof resolveRoute>[5]) => {
  const board = buildRoutingBoard(RAW, FILES);
  const preview = resolveRoute(board, draftFromBoard(board), CATALOG, null, 0, policy);
  const states: Record<string, string> = {};
  preview.tiers.forEach((tier) =>
    tier.members.forEach((member) => {
      states[member.key] = member.state;
    })
  );
  return { preview, states };
};

describe('routing board under the pool policy', () => {
  test('members know whether they are subscriptions or API keys', () => {
    const board = buildRoutingBoard(RAW, FILES);
    const kinds = Object.fromEntries(board.members.map((m) => [m.key, m.accountKind]));
    expect(kinds).toEqual({
      'key:claude:0:0': 'api_key',
      'cred:sub.json': 'subscription',
      'cred:keyfile.json': 'api_key',
    });
  });

  test('without a policy the configured priority order stands', () => {
    const { preview, states } = memberStates(null);
    expect(states['key:claude:0:0']).toBe('serving');
    expect(preview.tiers[0].state).toBe('active');
  });

  test('paid fallback off: API keys take nothing, and the tier falls through to subscriptions', () => {
    const { preview, states } = memberStates({ strategy: 'existing', allowPaidFallback: false });
    expect(states['key:claude:0:0']).toBe('policy_off');
    expect(states['cred:keyfile.json']).toBe('policy_off');
    expect(states['cred:sub.json']).toBe('serving');
    expect(preview.tiers[0].state).toBe('skipped');
    expect(preview.tiers[1].state).toBe('active');
  });

  test('subscriptions first: a higher-priority API key is a backup while a subscription can serve', () => {
    const { preview, states } = memberStates({
      strategy: 'subscriptions_first',
      allowPaidFallback: true,
    });
    expect(states['key:claude:0:0']).toBe('policy_backup');
    expect(states['cred:keyfile.json']).toBe('policy_backup');
    expect(states['cred:sub.json']).toBe('serving');
    expect(preview.tiers[0].state).toBe('standby');
    expect(preview.tiers[1].state).toBe('active');
    expect(preview.tiers[1].members.find((m) => m.key === 'cred:sub.json')?.share).toBe(100);
  });

  test('subscriptions first with no able subscription lets the API key serve', () => {
    const board = buildRoutingBoard(RAW, [{ ...FILES[0], disabled: true }, FILES[1]]);
    const preview = resolveRoute(
      board,
      draftFromBoard(board),
      CATALOG,
      null,
      0,
      { strategy: 'subscriptions_first', allowPaidFallback: true }
    );
    expect(preview.tiers[0].members[0].state).toBe('serving');
    expect(preview.tiers[0].state).toBe('active');
  });
});
