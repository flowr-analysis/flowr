import type { EngineConfig, FlowrConfigOptions } from '../config';
import { amendConfig, cloneConfig, defaultConfigOptions } from '../config';
import type { DeepWritable } from 'ts-essentials';
import type { RParseRequests } from '../r-bridge/retriever';
import { FlowrAnalyzer } from './flowr-analyzer';
import { retrieveEngineInstances } from '../engines';
import type { KnownParser } from '../r-bridge/parser';
import type { FlowrAnalyzerPlugin } from './plugins/flowr-analyzer-plugin';
import type { NormalizeRequiredInput } from '../core/steps/all/core/10-normalize';

/**
 * Builder for the {@link FlowrAnalyzer}.
 */
export class FlowrAnalyzerBuilder {
	private flowrConfig:      DeepWritable<FlowrConfigOptions> = cloneConfig(defaultConfigOptions);
	private parser?:          KnownParser;
	private readonly request: RParseRequests;
	private input?:           Omit<NormalizeRequiredInput, 'request'>;
	private plugins:          FlowrAnalyzerPlugin[];

	/**
     * Apply an amendment to the configuration the builder currently holds.
     * Per default, the {@link defaultConfigOptions} are used.
     * @param func - Receives the current configuration of the builder and allows for amendment.
     */
	// eslint-disable-next-line @typescript-eslint/no-invalid-void-type
	public amendConfig(func: (config: DeepWritable<FlowrConfigOptions>) => FlowrConfigOptions | void): this {
		this.flowrConfig = amendConfig(this.flowrConfig, func);
		return this;
	}

	/**
     * Overwrite the configuration used by the resulting analyzer.
     * @param config - The new configuration.
     */
	public setConfig(config: FlowrConfigOptions) {
		this.flowrConfig = config;
		return this;
	}

	/**
     * Set the parser instance used by the analyzer.
     * @param parser - The parser.
     */
	public setParser(parser: KnownParser) {
		this.parser = parser;
		return this;
	}

	/**
     * Set the engine and hence the parser that will be used by the analyzer.
     * @param engine - The engine to use.
     */
	public setEngine(engine: EngineConfig['type']) {
		this.flowrConfig.defaultEngine = engine;
		return this;
	}

	/**
     * Additional parameters for the analyses.
     * @param input - The input.
     */
	public setInput(input: Omit<NormalizeRequiredInput, 'request'>) {
		this.input = input;
		return this;
	}

	/**
     * Create a new builder instance.
     * @param request - The code to analyze.
     * @param plugins - The plugins to register.
     */
	constructor(request: RParseRequests, plugins?: FlowrAnalyzerPlugin[]) {
		this.request = request;
		this.plugins = plugins ?? [];
	}

	/**
     * Register one or multiple additional plugins.
     * @param plugin - One or multiple plugins.
     */
	public registerPlugin(...plugin: FlowrAnalyzerPlugin[]): this {
		this.plugins.push(...plugin);
		return this;
	}

	/**
     * Remove one or multiple plugins.
     * @param plugin - One or multiple plugins.
     */
	public unregisterPlugin(...plugin: FlowrAnalyzerPlugin[]): this {
		this.plugins = this.plugins.filter(p => !plugin.includes(p));
		return this;
	}

	/**
     * Create the {@link FlowrAnalyzer} instance using the given information.
     */
	public async build(): Promise<FlowrAnalyzer<KnownParser>> {
		let parser: KnownParser;
		if(this.parser) {
			parser = this.parser;
		} else {
			const engines = await retrieveEngineInstances(this.flowrConfig);
			parser = this.parser ?? engines.engines[engines.default] as KnownParser;
		}

		return new FlowrAnalyzer(
			this.flowrConfig,
			parser,
			this.request,
			this.input ?? {}
		);
	}
}