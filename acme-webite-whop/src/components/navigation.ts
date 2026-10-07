/**
 * Minimal `usePathname` equivalent for the TanStack build.
 *
 * The header reads the current route to decide whether it overlays a dark hero.
 * TanStack Router exposes this per-route, but the header is rendered in the root
 * shell, so it subscribes to the router state directly.
 */
import { useRouterState } from '@tanstack/react-router';

export function usePathname(): string {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  return pathname;
}

export default usePathname;
