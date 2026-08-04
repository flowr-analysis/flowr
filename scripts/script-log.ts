/** whether npm was invoked with `--silent`/`-s` (or a loglevel that suppresses info output) */
export const quiet = /^(silent|error|warn)$/.test(process.env.npm_config_loglevel ?? '');

/** log an informational line, unless npm is running quietly */
export function info(message: string): void {
	if(!quiet) {
		console.log(message);
	}
}
