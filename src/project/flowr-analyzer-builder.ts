import type { FlowrConfigOptions } from '../config';
import { amendConfig, cloneConfig, defaultConfigOptions } from '../config';
import type { DeepWritable } from 'ts-essentials';
import type { RParseRequests } from '../r-bridge/retriever';
import { FlowrAnalyzer } from './flowr-analyzer';
import { retrieveEngineInstances } from '../engines';
import type { KnownParser } from '../r-bridge/parser';
import type { AnyFlowrAnalyzerPlugin } from './plugins/flowr-analyzer-plugin';

export class FlowrAnalyzerBuilder {
	private flowrConfig:      DeepWritable<FlowrConfigOptions> = cloneConfig(defaultConfigOptions);
	private readonly request: RParseRequests;
	private plugins:          AnyFlowrAnalyzerPlugin[];

	public amendConfig(func: (config: DeepWritable<FlowrConfigOptions>) => FlowrConfigOptions) : this {
		this.flowrConfig = amendConfig(this.flowrConfig, func);
		return this;
	}

	public setEngine(engine : 'tree-sitter' | 'r-shell') {
		this.flowrConfig.defaultEngine = engine;
		return this;
	}

	constructor(request: RParseRequests, plugins?: AnyFlowrAnalyzerPlugin[]) {
		this.request = request;
		this.plugins = plugins ? plugins : [];
	}

	public registerPlugin(plugin: AnyFlowrAnalyzerPlugin | AnyFlowrAnalyzerPlugin[]): void {
		if(Array.isArray(plugin)){
			this.plugins.push(...plugin);
		} else {
			this.plugins.push(plugin);
		}
	}

	public unregisterPlugin(plugin: AnyFlowrAnalyzerPlugin | AnyFlowrAnalyzerPlugin[]): void {
		if(Array.isArray(plugin)){
			this.plugins = this.plugins.filter(p => !plugin.includes(p));
		} else {
			this.plugins = this.plugins.filter(p => p !== plugin);
		}
	}

	public async build(): Promise<FlowrAnalyzer> {
		const engines = await retrieveEngineInstances(this.flowrConfig);
		const parser = engines.engines[engines.default] as KnownParser;

		return new FlowrAnalyzer(
			this.flowrConfig,
			parser,
			this.request
		);
	}
}