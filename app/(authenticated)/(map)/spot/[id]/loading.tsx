// No route-level loader: the map is the persistent backdrop and the spot box
// renders its own Suspense fallbacks. A full-screen spinner here would flash
// over the map on direct load.
export default function Loading(): null {
  return null
}
