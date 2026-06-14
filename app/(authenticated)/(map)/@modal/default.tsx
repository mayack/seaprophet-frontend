import React from 'react'

// Default render for the @modal parallel slot: nothing. The slot only shows
// content when the (.)spot/[id] intercepting route matches a soft navigation.
// On the index route and on hard loads/reloads of /spot/[id] this keeps the
// slot empty so the standalone page in `children` renders normally.
export default function ModalDefault(): React.JSX.Element | null {
  return null
}
