import type { SemVer } from 'semver';
import type { FlowrAnalysisInput } from '../flowr-analyzer';
import type { FlowrConfigOptions } from '../../config';
import type { PathLike } from 'fs';
import type { AsyncOrSync } from 'ts-essentials';

export type PluginType = 'package-versions' | 'loading-order' | 'scoping' | 'file';

export interface FlowrAnalyzerPluginInterface {
	readonly name:        string;
	readonly description: string;
	readonly version:     SemVer;
	readonly type:        PluginType;
	dependencies:         FlowrAnalyzerPlugin[];

	processor(analyzer: FlowrAnalysisInput, pluginConfig: FlowrConfigOptions): AsyncOrSync<void>;
}

export abstract class FlowrAnalyzerPlugin implements FlowrAnalyzerPluginInterface {
	public abstract readonly name:        string;
	public abstract readonly description: string;
	public abstract readonly version:     SemVer;
	public abstract readonly type:        PluginType;
	public abstract dependencies:         FlowrAnalyzerPlugin[];
	public rootPath: PathLike | undefined;

	public setRootPath(rootPath: PathLike | undefined): void {
		this.rootPath = rootPath;
	}

	public abstract processor(analyzer: FlowrAnalysisInput, pluginConfig: FlowrConfigOptions): AsyncOrSync<void>;
}

