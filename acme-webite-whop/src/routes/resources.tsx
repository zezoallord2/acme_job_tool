import { Outlet, createFileRoute } from '@tanstack/react-router';

/**
 * Layout for the /resources section.
 *
 * `resources.index.tsx` renders the article listing and `resources.$slug.tsx`
 * renders a single article. TanStack nests the dynamic route under this file, so
 * it must be a layout with an <Outlet /> — otherwise the listing would swallow
 * every article URL.
 */
export const Route = createFileRoute('/resources')({
  component: ResourcesLayout,
});

function ResourcesLayout() {
  return <Outlet />;
}
