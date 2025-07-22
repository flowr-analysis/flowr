import { FlowrAnalyzerPackageVersionsPlugin } from './flowr-analyzer-package-versions-plugin';
import { FlowrAnalyzerDescriptionFilePlugin } from '../file-plugins/flowr-analyzer-description-file-plugin';
import type { FlowrAnalyzerPlugin } from '../flowr-analyzer-plugin';
import { SemVer } from 'semver';
import type { FlowrAnalyzer } from '../../flowr-analyzer';
import type { FlowrConfigOptions } from '../../../config';
import type { PackageType } from './package';
import { Package } from './package';

export class FlowrAnalyzerPackageVersionsDescriptionFilePlugin extends FlowrAnalyzerPackageVersionsPlugin {
	public readonly name = 'flowr-analyzer-package-version-description-file-plugin';
	public readonly description = 'This plugin does...';
	public readonly version = new SemVer('0.1.0');

	dependencies:    FlowrAnalyzerPlugin[] = [new FlowrAnalyzerDescriptionFilePlugin()];
	descriptionFile: Map<string, string[]> = new Map<string, string[]>();

	async processor(analyzer: FlowrAnalyzer, pluginConfig: FlowrConfigOptions): Promise<void> {
		const plugin = this.dependencies[0] as FlowrAnalyzerDescriptionFilePlugin;
		await plugin.processor(analyzer, pluginConfig);
		this.descriptionFile = plugin.information;

		this.retrieveVersionsFromField('Depends', 'r');
		this.retrieveVersionsFromField('Imports', 'package');

		return Promise.resolve(undefined);
	}

	private retrieveVersionsFromField(field: string, type?: PackageType) : void{
		for(const entry of this.descriptionFile?.get(field) || []) {
			const match = RegExp(/^([a-zA-Z0-9.]+)(?:\s*\(([><=~!]+)\s*([\d.]+)\))?$/).exec(entry);

			if(match) {
				const name = match[1];
				const operator = match[2];
				const version = match[3];

				const range = Package.parsePackageVersionRange(operator, version);

				this.packages.push(new Package(name, range, type));
			}
		}
	}
}