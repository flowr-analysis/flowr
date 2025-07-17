import { FlowrAnalyzerFilePlugin } from './flowr-analyzer-file-plugin';
import { SemVer } from 'semver';
import type { FlowrAnalyzer } from '../../flowr-analyzer';
import type { FlowrConfigOptions } from '../../../config';
import type { Package } from '../package-version-plugins/package';
import type { FlowrAnalyzerPlugin } from '../flowr-analyzer-plugin';

export class FlowrAnalyzerDescriptionFilePlugin extends FlowrAnalyzerFilePlugin{
	public readonly name = 'flowr-analyzer-description-file-plugin';
	public readonly description = 'This plugin does...';
	public readonly version = new SemVer('0.1.0');

	private content: Map<string, string> = new Map<string, string>();

	packages:     Package[] = [];
	dependencies: FlowrAnalyzerPlugin[] = [];

	public async processor(analyzer: FlowrAnalyzer, pluginConfig: FlowrConfigOptions): Promise<void> {
		await fetch('');
		this.content.set('','');
	}
}