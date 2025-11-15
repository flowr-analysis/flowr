import { FlowrAnalyzerFilePlugin } from './flowr-analyzer-file-plugin';
import { SemVer } from 'semver';
import type { PathLike } from 'fs';
import { log } from '../../../util/log';
import type { FlowrAnalyzerContext } from '../../context/flowr-analyzer-context';
import { FlowrDescriptionFile } from './flowr-description-file';
import { type FlowrFileProvider , FileRole } from '../../context/flowr-file';

export const descriptionFileLog = log.getSubLogger({ name: 'flowr-analyzer-loading-order-description-file-plugin' });

const DescriptionFilePattern = /^(DESCRIPTION|DESCRIPTION\.txt)$/i;

/**
 * This plugin provides support for R `DESCRIPTION` files.
 */
export class FlowrAnalyzerDescriptionFilePlugin extends FlowrAnalyzerFilePlugin {
	public readonly name = 'flowr-analyzer-description-file-plugin';
	public readonly description = 'This plugin provides support for DESCRIPTION files and extracts their content into key-value(s) pairs.';
	public readonly version = new SemVer('0.1.0');
	private readonly pattern: RegExp;

	/**
	 * Creates a new instance of the DESCRIPTION file plugin.
	 * @param filePattern - The pattern to identify DESCRIPTION files, see {@link DescriptionFilePattern} for the default pattern.
	 */
	constructor(filePattern: RegExp = DescriptionFilePattern) {
		super();
		this.pattern = filePattern;
	}

	public applies(file: PathLike): boolean {
		// TODO: use platformBasename for all others as well!!
		return this.pattern.test(file.toString().split(/[/\\]/).pop() ?? '');
	}

	public process(_ctx: FlowrAnalyzerContext, file: FlowrFileProvider): FlowrDescriptionFile {
		return FlowrDescriptionFile.from(file, FileRole.Description);
	}
}