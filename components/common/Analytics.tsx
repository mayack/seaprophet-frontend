import Script from 'next/script'

/**
 * Google Analytics 4 (gtag.js).
 *
 * The app has no shared root layout — `(public)` and `(authenticated)` each
 * render their own `<html>` — so this component is mounted in both to give
 * every route the same tag.
 *
 * `afterInteractive` (next/script's default) loads the tag once hydration is
 * out of the way, which is what Google's own snippet's `async` amounts to.
 * Client-side route changes are covered by GA4's enhanced measurement, which
 * derives page_view events from History API navigations.
 */

const GA_MEASUREMENT_ID = 'G-Y1XT1RBQHR'

export function Analytics(): React.JSX.Element {
  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_MEASUREMENT_ID}');
        `}
      </Script>
    </>
  )
}
