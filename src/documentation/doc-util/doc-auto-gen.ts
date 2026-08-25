import { flowrVersion } from '../../util/version';
import { flowrSourceFileUrl } from './doc-files';

export interface AutoGenHeaderArguments {
	readonly rVersion?:           string;
	readonly currentDateAndTime?: string;
	readonly filename:            string;
	readonly purpose:             string;
}

/**
 *
 */
export function autoGenHeader(
	{ rVersion, filename, purpose, currentDateAndTime = new Date().toISOString().replace('T', ', ').replace(/\.\d+Z$/, ' UTC') }: AutoGenHeaderArguments
) {
	/* what the page is about only shows on hover: the line above every page should be short */
	return `_<span title="an overview of flowR's ${purpose}">Generated</span> from`
		+ ` '${fileNameForGenHeader(filename)}' on ${currentDateAndTime} (v${flowrVersion().format()}${rVersion ? ', R v' + rVersion : ''}),`
		+ ' please do not edit directly._';
}


/**
 *
 */
export function fileNameForGenHeader(filename: string): string {
	const shortenFilename = filename.replace(/^.*src\//, 'src/');
	/* the line above every page stays short: only the file name shows, the path waits in the tooltip */
	return `[${shortenFilename.split('/').pop() ?? shortenFilename}](${flowrSourceFileUrl(shortenFilename)} "${shortenFilename}")`;
}
