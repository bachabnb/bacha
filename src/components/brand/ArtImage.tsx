import Image from 'next/image'
import { art, artSize, hasArt, type ArtId } from '@/lib/art'
import { cn } from '@/lib/cn'

/**
 * Renders a generated art asset.
 *
 * Intrinsic dimensions come from the manifest so the box is reserved before
 * the image arrives and nothing shifts. If the asset was never generated this
 * renders nothing at all rather than a broken frame — every layout that uses
 * it is built to survive its absence.
 */
export function ArtImage({
  id,
  alt,
  className,
  sizes = '(max-width: 768px) 80vw, 40vw',
  priority = false,
  fadeIn = true,
}: {
  id: ArtId
  /** Empty string marks it decorative; anything else is announced. */
  alt: string
  className?: string
  sizes?: string
  priority?: boolean
  fadeIn?: boolean
}) {
  if (!hasArt(id)) return null
  const { width, height } = artSize(id)

  return (
    <Image
      src={art(id)}
      alt={alt}
      width={width}
      height={height}
      sizes={sizes}
      priority={priority}
      loading={priority ? undefined : 'lazy'}
      aria-hidden={alt === '' ? true : undefined}
      className={cn('h-auto w-full select-none object-contain', fadeIn && 'art-fade', className)}
      draggable={false}
    />
  )
}
