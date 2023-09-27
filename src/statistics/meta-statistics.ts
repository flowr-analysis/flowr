/**
 * Statistics on skipped files, the time required, and more.
 *
 * @see extractUsageStatistics
 * @see initialMetaStatistics
 */
export interface MetaStatistics {
  /**
   * the number of requests that were parsed successfully
   */
  successfulParsed: number
  /**
   * the processing time for each request
   */
  processingTimeMs: number[]
  /**
   * skipped requests
   */
  skipped: string[]
  /**
   * number of lines with each individual line length consumed for each request
   */
  lines: number[][]
}

/**
 * Returns an initial {@link MetaStatistics} object, using neutral defaults (like the empty list).
 */
export function initialMetaStatistics(): MetaStatistics {
  return {
    successfulParsed: 0,
    processingTimeMs: [],
    skipped:          [],
    lines:            []
  }
}
