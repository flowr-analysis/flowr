import { FlowrAnalyzerPlugin, PluginType } from '../flowr-analyzer-plugin';
import type { PathLike } from 'fs';
import type { FlowrFileProvider } from '../../context/flowr-file';
import { SemVer } from 'semver';
import type { FlowrAnalyzerContext } from '../../context/flowr-analyzer-context';

export abstract class FlowrAnalyzerFilePlugin extends FlowrAnalyzerPlugin<FlowrFileProvider<string>, FlowrFileProvider> {
	public readonly type = PluginType.FileLoad;

	public abstract applies(file: PathLike): boolean;

	public static override defaultPlugin(): FlowrAnalyzerFilePlugin {
		return new DefaultFlowrAnalyzerFilePlugin();
	}
}

class DefaultFlowrAnalyzerFilePlugin extends FlowrAnalyzerFilePlugin {
	public readonly name = 'default-file-plugin';
	public readonly description = 'This is the default file plugin that does nothing.';
	public readonly version = new SemVer('0.0.0');

	public applies(): boolean {
		return true;
	}

	public process(_context: FlowrAnalyzerContext, args: FlowrFileProvider<string>): FlowrFileProvider {
		return args;
	}
}