import { FlowrAnalyzerPlugin, PluginType } from '../flowr-analyzer-plugin';
import type { PathLike } from 'fs';
import type { FlowrFileProvider } from '../../context/flowr-analyzer-files-context';

export abstract class FlowrAnalyzerFilePlugin<In = FlowrFileProvider, Out = In> extends FlowrAnalyzerPlugin<In, Out> {
	public readonly type = PluginType.FileLoad;
    public abstract applies(file: PathLike): boolean;
}