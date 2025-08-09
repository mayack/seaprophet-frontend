// Netlify edge function compatibility layer
// This file helps optimize the middleware for Netlify edge runtime

import type { Context } from "https://edge.netlify.com";

export default async function middleware(request: Request, context: Context) {
  // This is handled by Next.js middleware directly
  // This file exists to help Netlify understand our edge function requirements
  return;
}

export const config = { path: "/*" };
