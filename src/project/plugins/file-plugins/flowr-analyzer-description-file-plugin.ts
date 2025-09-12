import { FlowrAnalyzerFilePlugin } from './flowr-analyzer-file-plugin';
import { SemVer } from 'semver';
import type { FlowrAnalysisInput } from '../../flowr-analyzer';
import type { FlowrConfigOptions } from '../../../config';
import type { FlowrAnalyzerPlugin } from '../flowr-analyzer-plugin';
import { parseDCF } from '../../../util/files';

export class FlowrAnalyzerDescriptionFilePlugin extends FlowrAnalyzerFilePlugin {
	public readonly name = 'flowr-analyzer-description-file-plugin';
	public readonly description = 'This plugin does...';
	public readonly version = new SemVer('0.1.0');
	public readonly dependencies: FlowrAnalyzerPlugin[] = [];
	public information:           Map<string, string[]> = new Map<string, string[]>();

	public async processor(_analyzer: FlowrAnalysisInput, _pluginConfig: FlowrConfigOptions): Promise<void> {
		if(this.files.length === 0) {
			throw new Error('FlowrAnalyzerDescriptionFilePlugin: No DESCRIPTION file found.');
		}
		if(this.files.length > 1){
			throw new Error('FlowrAnalyzerDescriptionFilePlugin: Found more than one DESCRIPTION file.');
		}
		this.information = parseDCF(this.files[0]);

		return Promise.resolve();
	}
}