import { FlowrAnalyzerPlugin, PluginType } from '../flowr-analyzer-plugin';
import type { PathLike } from 'fs';

export abstract class FlowrAnalyzerFilePlugin extends FlowrAnalyzerPlugin {
	public readonly type = PluginType.File;
	protected files: PathLike[] = [];

	public addFiles(...files: readonly PathLike[]): void {
		this.files = this.files.concat(files);
	}
}