import { getImageProps } from 'next/image'
import thumbMinimalLight from '@/app/thumbnail-minimal-light.webp'
import thumbMinimalDark from '@/app/thumbnail-minimal-dark.webp'
import thumbSatelliteLight from '@/app/thumbnail-satellite-light.webp'
import thumbSatelliteDark from '@/app/thumbnail-satellite-dark.webp'

/**
 * Warms the browser cache for the settings dialog's map-style thumbnails so
 * they render instantly when settings opens (they otherwise only start
 * loading on dialog mount). `getImageProps` with the SAME static imports the
 * dialog uses (see SettingsForm) yields identical optimized URLs, so the
 * preload hits the exact cache entries. React hoists <link> into <head>;
 * fetchPriority=low keeps them from competing with map tiles on first paint.
 */
export function PreloadMapStyleThumbs(): React.JSX.Element {
  const thumbs = [
    thumbMinimalLight,
    thumbMinimalDark,
    thumbSatelliteLight,
    thumbSatelliteDark,
  ]
  return (
    <>
      {thumbs.map((src) => {
        const { props } = getImageProps({ src, alt: '' })
        return (
          <link
            key={props.src}
            rel="preload"
            as="image"
            href={props.src}
            imageSrcSet={props.srcSet}
            fetchPriority="low"
          />
        )
      })}
    </>
  )
}
