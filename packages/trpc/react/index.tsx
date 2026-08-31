import { getBaseUrl } from '@documenso/lib/universal/get-base-url';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink, httpLink, isNonJsonSerializable, splitLink } from '@trpc/client';
import { createTRPCReact } from '@trpc/react-query';
import { useMemo, useState } from 'react';

import type { AppRouter } from '../server/router';
import { dataTransformer } from '../utils/data-transformer';

export { getQueryKey } from '@trpc/react-query';

/**
 * Queries that must NOT be invalidated by unrelated mutations. The header
 * inbox badge and the quota banner are cheap-looking but refetch a lot; they
 * self-refresh via staleness/polling, so invalidating them on every mutation
 * just re-triggers the refetch storm.
 */
const MUTATION_INVALIDATION_DENYLIST: string[][] = [
  ['document', 'inbox'],
  ['organisation', 'getQuotaFlags'],
];

export const trpc = createTRPCReact<AppRouter>({
  overrides: {
    useMutation: {
      async onSuccess(opts) {
        await opts.originalFn();

        if (opts.meta.doNotInvalidateQueryOnMutation) {
          return;
        }

        // Invalidate all queries besides ones that specify not to in the meta data,
        // minus the chatty denylist above.
        await opts.queryClient.invalidateQueries({
          predicate: (query) => {
            if (query?.meta?.doNotInvalidateQueryOnMutation) {
              return false;
            }

            if (Array.isArray(query.queryKey)) {
              const path = query.queryKey.slice(0, 2).map(String);

              if (MUTATION_INVALIDATION_DENYLIST.some((prefix) => prefix[0] === path[0] && prefix[1] === path[1])) {
                return false;
              }
            }

            return true;
          },
        });
      },
    },
  },
});

export interface TrpcProviderProps {
  children: React.ReactNode;
  headers?: Record<string, string>;
}

export function TrpcProvider({ children, headers }: TrpcProviderProps) {
  // Defaults matter: with React Query's stock `staleTime: 0` +
  // `refetchOnWindowFocus: true`, every mount and every alt-tab refetches the
  // whole dashboard (documents, folders, members, inbox, quota) — this was the
  // dominant source of perceived dashboard lag. 30s staleness keeps data fresh
  // without the refetch storm.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            refetchOnReconnect: 'always',
          },
        },
      }),
  );

  // May cause remounting issues.
  const trpcClient = useMemo(
    () =>
      trpc.createClient({
        links: [
          splitLink({
            condition: (op) => op.context.skipBatch === true || isNonJsonSerializable(op.input),
            true: httpLink({
              url: `${getBaseUrl()}/api/trpc`,
              headers,
              transformer: dataTransformer,
            }),
            false: httpBatchLink({
              url: `${getBaseUrl()}/api/trpc`,
              headers,
              transformer: dataTransformer,
            }),
          }),
        ],
      }),
    [headers],
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}
