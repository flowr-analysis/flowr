import { FlowrAnalyzerPatternFilePlugin } from './flowr-analyzer-file-plugin';
import { SemVer } from 'semver';
import { log } from '../../../util/log';
import type { FlowrAnalyzerContext } from '../../context/flowr-analyzer-context';
import { FlowrDescriptionFile } from './files/flowr-description-file';
import { type FlowrFileProvider, FileRole } from '../../context/flowr-file';

export const descriptionFileLog = log.getSubLogger({ name: 'flowr-analyzer-loading-order-description-file-plugin' });

const DescriptionFilePattern = /^DESCRIPTION(\.(txt|in))?$/i;

/** Access to the `DESCRIPTION` file of the analyzed project. */
export const DescriptionFile = {
	name: 'DescriptionFile',
	/** The project's only `DESCRIPTION` file, `undefined` if there is none; `missing` states what cannot be done then. */
	single(this: void, ctx: FlowrAnalyzerContext, missing: string) {
		const descFiles = ctx.files.getFilesByRole(FileRole.Description);
		if(descFiles.length === 0) {
			descriptionFileLog.debug(missing);
			return undefined;
		} else if(descFiles.length > 1) {
			descriptionFileLog.warn(`Found ${descFiles.length} description files, expected exactly one.`);
		}
		return descFiles[0];
	}
} as const;

/**
 * This plugin provides support for R `DESCRIPTION` files.
 */
export class FlowrAnalyzerDescriptionFilePlugin extends FlowrAnalyzerPatternFilePlugin {
	public readonly name = 'flowr-analyzer-description-file-plugin';
	public readonly description = 'Reads DESCRIPTION files into key-value pairs.';
	public readonly version = new SemVer('0.1.0');

	/**
	 * Creates a new instance of the DESCRIPTION file plugin.
	 * @param filePattern - The pattern to identify DESCRIPTION files, see {@link DescriptionFilePattern} for the default pattern.
	 */
	constructor(filePattern: RegExp = DescriptionFilePattern) {
		super(filePattern);
	}

	public process(_ctx: FlowrAnalyzerContext, file: FlowrFileProvider): FlowrDescriptionFile {
		return FlowrDescriptionFile.from(file, FileRole.Description);
	}
}