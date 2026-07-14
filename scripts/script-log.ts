/**
 * Shared logging for the build-time scripts. `info` respects npm's `--silent` (`npm_config_loglevel` of
 * `silent`/`error`/`warn`), so `npm run flowr --silent` no longer prints the bundle-build chatter; warnings
 * and errors always go to stderr.
 */

/** whether npm was invoked with `--silent`/`-s` (or a loglevel that suppresses info output) */
export const quiet = /^(silent|error|warn)$/.test(process.env.npm_config_loglevel ?? '');

/** log an informational line, unless npm is running quietly */
export function info(message: string): void {
	if(!quiet) {
		console.log(message);
	}
}
