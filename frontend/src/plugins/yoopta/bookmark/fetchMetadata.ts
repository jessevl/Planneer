/**
 * @file fetchMetadata.ts
 * @description Utility to fetch link metadata for bookmark cards
 * 
 * Simplified approach that only uses favicon (no CORS issues).
 * We extract information from the URL itself since most sites block CORS.
 */
import type { LinkMetadata } from './types';

// ============================================================================
// FAVICON HELPERS
// ============================================================================

/**
 * Get favicon URL for a domain using Google's favicon service
 * This is reliable and doesn't have CORS issues
 */
export function getFaviconUrl(url: string): string {
  try {
    const domain = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
  } catch {
    return '';
  }
}

/**
 * Extract a readable site name from URL
 */
function getSiteNameFromUrl(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    // Remove www. prefix and get the main domain name
    const parts = hostname.replace(/^www\./, '').split('.');
    if (parts.length >= 2) {
      // Capitalize first letter
      const name = parts[0];
      return name.charAt(0).toUpperCase() + name.slice(1);
    }
    return hostname;
  } catch {
    return '';
  }
}

/**
 * Extract a readable title from URL path
 */
function getTitleFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.replace(/^www\./, '');
    
    // Try to get a title from the path
    const pathParts = parsed.pathname.split('/').filter(Boolean);
    if (pathParts.length > 0) {
      // Get the last meaningful path segment
      const lastPart = pathParts[pathParts.length - 1];
      // Clean up the path segment
      const cleaned = lastPart
        .replace(/[-_]/g, ' ')
        .replace(/\.[a-z]+$/i, '') // Remove file extension
        .trim();
      
      if (cleaned.length > 3) {
        // Capitalize words
        return cleaned
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
      }
    }
    
    // Fallback to site name
    return getSiteNameFromUrl(url);
  } catch {
    return url;
  }
}

// ============================================================================
// METADATA FETCHER
// ============================================================================

/**
 * Fetch link metadata for a URL
 * 
 * This is a simplified version that extracts info from the URL itself
 * and uses Google's favicon service. No CORS issues since we don't
 * actually fetch the remote page.
 */
export async function fetchLinkMetadata(url: string): Promise<LinkMetadata> {
  // Extract info from URL (no network request needed)
  const title = getTitleFromUrl(url);
  const siteName = getSiteNameFromUrl(url);
  const favicon = getFaviconUrl(url);
  
  // Return immediately - no async work needed since we're just parsing the URL
  return {
    url,
    title,
    siteName,
    favicon,
    // No description or image since we can't fetch without CORS issues
    description: undefined,
    image: undefined,
  };
}
