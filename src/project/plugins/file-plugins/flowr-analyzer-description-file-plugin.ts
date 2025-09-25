import { FlowrAnalyzerFilePlugin } from './flowr-analyzer-file-plugin';
import { SemVer } from 'semver';
import type { FlowrAnalysisInput } from '../../flowr-analyzer';
import type { FlowrConfigOptions } from '../../../config';
import type { FlowrAnalyzerPlugin } from '../flowr-analyzer-plugin';
import { parseDCF } from '../../../util/files';
import { log } from '../../../util/log';

const analyzerDescriptionLog = log.getSubLogger({ name: 'flowr-analyzer-description-log' });

export class FlowrAnalyzerDescriptionFilePlugin extends FlowrAnalyzerFilePlugin {
	public readonly name = 'flowr-analyzer-description-file-plugin';
	public readonly description = 'This plugin does...';
	public readonly version = new SemVer('0.1.0');
	public readonly dependencies: FlowrAnalyzerPlugin[] = [];
	public information:           Map<string, string[]> = new Map<string, string[]>();

	public processor(_analyzer: FlowrAnalysisInput, _pluginConfig: FlowrConfigOptions): void {
		if(this.files.length === 0) {
			analyzerDescriptionLog.error(Error('No DESCRIPTION file found.'));
			return;
		}
		if(this.files.length > 1) {
			analyzerDescriptionLog.error(Error('Found more than one DESCRIPTION file.'));
			return;
		}
		this.information = parseDCF(this.files[0]);
	}
}