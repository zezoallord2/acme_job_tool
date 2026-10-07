import * as React from 'react';
import { Link as TanStackLink } from '@tanstack/react-router';

/**
 * Drop-in replacement for `next/link`.
 *
 * The Acme Jobs components were written against `next/link`; this keeps their
 * call sites unchanged while routing through TanStack Router. It also preserves
 * the plain `<a>` behaviour for external and absolute URLs, which TanStack's
 * Link does not handle.
 */
export interface LinkProps
  extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  href: string;
  prefetch?: boolean;
  replace?: boolean;
  scroll?: boolean;
}

const EXTERNAL = /^https?:\/\//i;

export function Link({ href, prefetch: _prefetch, replace, scroll, children, ...rest }: LinkProps) {
  // External, protocol-relative, mailto, tel, and hash-only links stay plain.
  if (EXTERNAL.test(href) || /^(mailto:|tel:|javascript:|#|\/\/)/i.test(href)) {
    return (
      <a href={href} {...rest}>
        {children}
      </a>
    );
  }

  return (
    <TanStackLink
      to={href}
      replace={replace}
      resetScroll={scroll === false ? false : undefined}
      {...rest}
    >
      {children}
    </TanStackLink>
  );
}

export default Link;
