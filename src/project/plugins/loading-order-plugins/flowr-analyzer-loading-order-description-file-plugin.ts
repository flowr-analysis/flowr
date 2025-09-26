import { FlowrAnalyzerDescriptionFilePlugin } from '../file-plugins/flowr-analyzer-description-file-plugin';
import type { FlowrAnalyzerPlugin } from '../flowr-analyzer-plugin';
import { SemVer } from 'semver';
import type { FlowrAnalysisProvider } from '../../flowr-analyzer';
import type { FlowrConfigOptions } from '../../../config';
import { FlowrAnalyzerLoadingOrderPlugin } from './flowr-analyzer-loading-order-plugin';

export class FlowrAnalyzerLoadingOrderDescriptionFilePlugin extends FlowrAnalyzerLoadingOrderPlugin {
	public readonly name = 'flowr-analyzer-package-version-description-file-plugin';
	public readonly description = 'This plugin does...';
	public readonly version = new SemVer('0.1.0');

	dependencies:    FlowrAnalyzerPlugin[] = [new FlowrAnalyzerDescriptionFilePlugin()];
	descriptionFile: Map<string, string[]> = new Map<string, string[]>();

	processor(analyzer: FlowrAnalysisProvider, pluginConfig: FlowrConfigOptions): void {
		const plugin = this.dependencies[0] as FlowrAnalyzerDescriptionFilePlugin;
		plugin.processor(analyzer, pluginConfig);
		this.descriptionFile = plugin.information;

		this.loadingOrder = this.descriptionFile?.get('Collate')?.slice() ?? [];
	}
}