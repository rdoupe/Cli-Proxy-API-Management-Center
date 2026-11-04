import type { AuthFileItem } from '@/types/authFile';
import type { PoolAccount } from '@/types/pool';

/** Mutation handles require the pool's exact auth index; display labels are not identities. */
export const attachCredentialHandles = (
  accounts: PoolAccount[],
  files: AuthFileItem[]
): PoolAccount[] =>
  accounts.map((account) => {
    if (account.fileName) return account;
    const match = files.find((file) => {
      if (file.runtimeOnly === true || file.runtimeOnly === 'true') return false;
      const index =
        file.authIndex === null || file.authIndex === undefined ? '' : String(file.authIndex);
      return index !== '' && index === account.id;
    });
    if (!match) return account;
    const authIndex =
      match.authIndex === null || match.authIndex === undefined ? null : String(match.authIndex);
    return {
      ...account,
      fileName: String(match.name ?? '') || null,
      authIndex: authIndex ?? account.authIndex,
    };
  });
