import { FlowrAnalyzerFilePlugin } from './flowr-analyzer-file-plugin';
import { SemVer } from 'semver';
import type  { FlowrAnalyzer } from '../../flowr-analyzer';
import type { FlowrConfigOptions } from '../../../config';
import type  { FlowrAnalyzerPlugin } from '../flowr-analyzer-plugin';
import { readLineByLine } from '../../../util/files';
import type { PathLike } from 'fs';
import * as console from 'node:console';

export class FlowrAnalyzerDescriptionFilePlugin extends FlowrAnalyzerFilePlugin {
	public readonly name = 'flowr-analyzer-description-file-plugin';
	public readonly description = 'This plugin does...';
	public readonly version = new SemVer('0.1.0');
	public readonly dependencies: FlowrAnalyzerPlugin[] = [];
	public readonly information:  Map<string, string[]> = new Map<string, string[]>();

	public async processor(analyzer: FlowrAnalyzer, pluginConfig: FlowrConfigOptions): Promise<void> {
		for(const file of this.files) {
			const parsedDescriptionFile = await this.parseDescription(file);
			for(const [key, values] of parsedDescriptionFile) {
				this.information.set(key, values);
			}
		}

		console.log(analyzer);
		console.log(pluginConfig);
	}

	private async parseDescription(file: PathLike): Promise<Map<string, string[]>> {
		const result = new Map<string, string[]>();
		let currentKey = '';
		let currentValue = '';

		await readLineByLine(file.toString(), async(lineBuf) => {
			const line = lineBuf.toString();

			if(/^\s/.test(line)) {
				currentValue += '\n' + line.trim();
			} else {
				if(currentKey) {
					const values = currentValue
						? currentValue.split(/[\n,]+/).map(s => s.trim().replace(/'/g, '')).filter(s => s.length > 0)
						: [];
					result.set(currentKey, values);
				}

				const [key, ...rest] = line.split(':');
				currentKey = key.trim();
				currentValue = rest.join(':').trim();
			}
		});
        
		if(currentKey) {
			const values = currentValue
				? currentValue.split(/[\n,]+/).map(s => s.trim().replace(/'/g, '')).filter(s => s.length > 0)
				: [];
			result.set(currentKey, values);
		}

		return result;
	}
}