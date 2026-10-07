import Image from '@/components/image';
import { Container, Section } from '@/components/ui/container';
import { SectionHeading } from '@/components/section-heading';
import { cn } from '@/lib/utils';

/**
 * ---------------------------------------------------------------------------
 * Product image gallery slots
 * ---------------------------------------------------------------------------
 * Acme Jobs product visuals are produced separately (workbook pages, module
 * sheets, desktop/mobile mockups). This component is the loading and layout
 * layer for them.
 *
 * To publish a screenshot:
 *   1. Drop the file into /public/product/ (keep text-heavy images uncropped).
 *   2. Add an entry to src/content/gallery.ts.
 *   3. Render <ProductGallery /> where you want it.
 *
 * Until entries exist the gallery renders nothing, so the site never shows an
 * empty frame or a broken image. Alt text is mandatory and must describe what is
 * actually visible in the image.
 */

export interface ProductImage {
  /** Path under /public, e.g. '/product/starter-guide-page-01.png' */
  src: string;
  /** Required. Describe the visible content for screen readers. */
  alt: string;
  /** Optional caption rendered under the image. */
  caption?: string;
  /** Optional high-resolution variant used on large displays. */
  src2x?: string;
  width?: number;
  height?: number;
  /** Set true for full-bleed, uncropped presentation (default). */
  contain?: boolean;
}

export interface ProductGalleryProps {
  images: ProductImage[];
  eyebrow?: string;
  title?: string;
  description?: string;
  className?: string;
}

export function ProductGallery({
  images,
  eyebrow = 'Inside the product',
  title = 'What the material looks like',
  description,
  className,
}: ProductGalleryProps) {
  if (!images.length) return null;

  return (
    <Section tone="alt" className={className} aria-labelledby="gallery-heading">
      <Container>
        <SectionHeading
          as="h2"
          id="gallery-heading"
          align="center"
          eyebrow={eyebrow}
          title={title}
          description={description}
        />
        <ul className="mt-12 grid gap-6 sm:grid-cols-2">
          {images.map((image) => (
            <li key={image.src}>
              <figure className="border-line shadow-soft overflow-hidden rounded-[--radius-card] border bg-white p-3">
                <div className="bg-canvas-alt overflow-hidden rounded-xl">
                  <Image
                    src={image.src}
                    alt={image.alt}
                    width={image.width ?? 1400}
                    height={image.height ?? 900}
                    // Desktop/tablet: uncropped so nothing is cut off.
                    className={cn(
                      'h-auto w-full',
                      image.contain === false ? 'object-cover' : 'object-contain'
                    )}
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 560px"
                    loading="lazy"
                  />
                </div>
                {image.caption ? (
                  <figcaption className="text-ink-muted px-1 pt-3 text-center text-sm">
                    {image.caption}
                  </figcaption>
                ) : null}
              </figure>
            </li>
          ))}
        </ul>
      </Container>
    </Section>
  );
}

export default ProductGallery;
