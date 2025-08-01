import type { EngineConfig, FlowrConfigOptions } from '../config';
import { amendConfig, cloneConfig, defaultConfigOptions } from '../config';
import type { DeepWritable } from 'ts-essentials';
import type { RParseRequests } from '../r-bridge/retriever';
import { FlowrAnalyzer } from './flowr-analyzer';
import { retrieveEngineInstances } from '../engines';
import type { KnownParser } from '../r-bridge/parser';
import type { FlowrAnalyzerPlugin } from './plugins/flowr-analyzer-plugin';

export class FlowrAnalyzerBuilder {
	private flowrConfig:      DeepWritable<FlowrConfigOptions> = cloneConfig(defaultConfigOptions);
	private readonly request: RParseRequests;
	private plugins:          FlowrAnalyzerPlugin[];

	public amendConfig(func: (config: DeepWritable<FlowrConfigOptions>) => FlowrConfigOptions): this {
		this.flowrConfig = amendConfig(this.flowrConfig, func);
		return this;
	}

	public setEngine(engine: EngineConfig['type']) {
		this.flowrConfig.defaultEngine = engine;
		return this;
	}

	constructor(request: RParseRequests, plugins?: FlowrAnalyzerPlugin[]) {
		this.request = request;
		this.plugins = plugins ?? [];
	}

	public registerPlugin(...plugin: FlowrAnalyzerPlugin[]): this {
		this.plugins.push(...plugin);
		return this;
	}

	public unregisterPlugin(...plugin: FlowrAnalyzerPlugin[]): this {
		this.plugins = this.plugins.filter(p => !plugin.includes(p));
		return this;
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