import { FlowrAnalyzerPackageVersionsPlugin } from './flowr-analyzer-package-versions-plugin';
import { FlowrAnalyzerDescriptionFilePlugin } from '../file-plugins/flowr-analyzer-description-file-plugin';
import type { FlowrAnalyzerPlugin } from '../flowr-analyzer-plugin';
import { SemVer } from 'semver';
import type { FlowrAnalyzer } from '../../flowr-analyzer';
import type { FlowrConfigOptions } from '../../../config';

export class FlowrAnalyzerPackageVersionsDescriptionFilePlugin extends FlowrAnalyzerPackageVersionsPlugin {
	public readonly name = 'flowr-analyzer-package-version-description-file-plugin';
	public readonly description = 'This plugin does...';
	public readonly version = new SemVer('0.1.0');

	dependencies: FlowrAnalyzerPlugin[] = [new FlowrAnalyzerDescriptionFilePlugin()];

	processor(analyzer: FlowrAnalyzer, pluginConfig: FlowrConfigOptions): Promise<void> {
		console.log(analyzer);
		console.log(pluginConfig);
		return Promise.resolve(undefined);
	}
}