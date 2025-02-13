/**
 * Next.js extends native `fetch` with revalidation options.
 *
 * This module provides some reusable utility functions to set revalidation
 * options for `fetch`, for example when it needs to be passed to a
 * third-party API.
 */

import { ONE_DAY_IN_SECONDS } from './helpers.time'

export const REVALIDATION_TAGS = {
  GRAPHQL: 'graphql',
} as const
// Casting to string so TypeScript doesn't complain on "includes" checks
export const validRevalidationTags: Array<string> = Object.values(REVALIDATION_TAGS)

function fetchWithNextOptions({
  next,
  cache,
}: {
  next?: NextFetchRequestConfig
  cache?: RequestInit['cache']
}) {
  return (info: RequestInfo) => fetch(info, { next, cache })
}

const fetchRevalidatePerDay_TEMP_TESTING = fetchWithNextOptions({
  next: { revalidate: ONE_DAY_IN_SECONDS },
})
// [Charis 2024-12-28]
// Temporarily disabling revalidation as a hotfix for Vercel NFT problem
const fetchRevalidatePerDay = fetch

export { fetchWithNextOptions, fetchRevalidatePerDay, fetchRevalidatePerDay_TEMP_TESTING }
