import type {
  DefaultError,
  QueryClient,
  QueryKey,
  UseQueryOptions,
  UseQueryResult,
} from '@tanstack/react-query';

/**
 * Compatibility overload for legacy dashboard pages that predate strict query
 * response typing. New diagnostics/live pages use explicit generic response
 * types and therefore keep their strict typed overloads.
 */
declare module '@tanstack/react-query' {
  function useQuery(
    options: UseQueryOptions<any, DefaultError, any, QueryKey>,
    queryClient?: QueryClient,
  ): UseQueryResult<any, DefaultError>;
}
