import { execSync } from 'child_process';
import { flowrVersion } from '../../util/version';
import { flowrSourceFileUrl } from './doc-files';

export interface AutoGenHeaderArguments {
	readonly rVersion?:           string;
	readonly currentDateAndTime?: string;
	readonly filename:            string;
	readonly purpose:             string;
}

function stamp(iso: string): string {
	return iso.replace('T', ', ').replace(/\.\d+Z$/, ' UTC');
}

/**
 * When the pages were generated, taken from the repository so that rebuilding alone does not restamp every
 * page: the wiki is committed, and a wall-clock stamp made each rebuild a diff of all 75 of them.
 */
let generatedAt: string | undefined;
function lastCommitted(): string {
	generatedAt ??= (() => {
		try {
			return stamp(new Date(execSync('git log -1 --format=%cI', { encoding: 'utf8' }).trim()).toISOString());
		} catch{
			return stamp(new Date().toISOString());
		}
	})();
	return generatedAt;
}

/**
 * The header every generated wiki page opens with: what generated it, from which file, and when.
 * @param args - what to name in the header, see {@link AutoGenHeaderArguments}
 */
export function autoGenHeader(
	{ rVersion, filename, purpose, currentDateAndTime = lastCommitted() }: AutoGenHeaderArguments
) {
	/* what the page is about only shows on hover: the line above every page should be short */
	return `_<span title="an overview of flowR's ${purpose}">Generated</span> from`
		+ ` '${fileNameForGenHeader(filename)}' on ${currentDateAndTime} (v${flowrVersion().format()}${rVersion ? ', R v' + rVersion : ''}),`
		+ ' do not edit directly._';
}


/**
 * The source path as the generated header spells it, shortened to start at `src/`.
 * @param filename - the path to shorten
 */
export function fileNameForGenHeader(filename: string): string {
	const shortenFilename = filename.replace(/^.*src\//, 'src/');
	/* the line above every page stays short: only the file name shows, the path waits in the tooltip */
	return `[${shortenFilename.split('/').pop() ?? shortenFilename}](${flowrSourceFileUrl(shortenFilename)} "${shortenFilename}")`;
}
