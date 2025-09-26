import { FlowrAnalyzerFilePlugin } from './flowr-analyzer-file-plugin';
import { SemVer } from 'semver';
import type { PathLike } from 'fs';
import { log } from '../../../util/log';
import type { FlowrAnalyzerContext } from '../../context/flowr-analyzer-context';
import { FlowrDescriptionFile } from './flowr-description-file';
import type { FlowrFileProvider } from '../../context/flowr-file';
import { SpecialFileRole } from '../../context/flowr-file';

export const descriptionFileLog = log.getSubLogger({ name: 'flowr-analyzer-loading-order-description-file-plugin' });

export class FlowrAnalyzerDescriptionFilePlugin extends FlowrAnalyzerFilePlugin {
	public readonly name = 'flowr-analyzer-description-file-plugin';
	public readonly description = 'This plugin provides support for DESCRIPTION files and extracts their content into key-value(s) pairs.';
	public readonly version = new SemVer('0.1.0');

	public applies(file: PathLike): boolean {
		return /^(DESCRIPTION|DESCRIPTION\.txt)$/i.test(file.toString().split(/[/\\]/).pop() ?? '');
	}

	public process(_ctx: FlowrAnalyzerContext, file: FlowrFileProvider<string>): FlowrDescriptionFile {
		const f = FlowrDescriptionFile.from(file, SpecialFileRole.Description);
		// already load it here
		f.content();
		return f;
	}
}