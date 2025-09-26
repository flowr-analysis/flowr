import type { EngineConfig, FlowrConfigOptions } from '../config';
import { amendConfig, cloneConfig, defaultConfigOptions } from '../config';
import type { DeepWritable } from 'ts-essentials';
import type { RParseRequest } from '../r-bridge/retriever';
import { requestFromInput } from '../r-bridge/retriever';
import { FlowrAnalyzer } from './flowr-analyzer';
import { retrieveEngineInstances } from '../engines';
import type { KnownParser } from '../r-bridge/parser';
import type { FlowrAnalyzerPlugin, PluginType } from './plugins/flowr-analyzer-plugin';
import type { NormalizeRequiredInput } from '../core/steps/all/core/10-normalize';
import { guard } from '../util/assert';
import { FlowrAnalyzerContext } from './context/flowr-analyzer-context';
import type { RAnalysisRequest } from './context/flowr-analyzer-files-context';


/**
 * Builder for the {@link FlowrAnalyzer}.
 */
export class FlowrAnalyzerBuilder {
	private flowrConfig: DeepWritable<FlowrConfigOptions> = cloneConfig(defaultConfigOptions);
	private parser?:     KnownParser;
	private request:     RAnalysisRequest[] | undefined;
	private input?:      Omit<NormalizeRequiredInput, 'request'>;
	private plugins:     Map<PluginType, FlowrAnalyzerPlugin[]> = new Map();


	/**
     * Create a new builder instance.
     * @param request - The code to analyze
     */
	constructor(request?: RAnalysisRequest | readonly RAnalysisRequest[]) {
		this.addRequest(request ?? []);
	}

	/**
     * Add one or multiple requests to analyze the builder.
     */
	public addRequest(request: RAnalysisRequest | readonly RAnalysisRequest[]): void {
		const r = Array.isArray(request) ? request : [request] as RParseRequest[];
		if(this.request) {
			this.request = this.request.concat(request);
		} else {
			this.request = r;
		}
	}

	/**
     * Add a request created from the given input.
     * This is a convenience method that uses {@link requestFromInput} internally.
     */
	public addRequestFromInput(input: Parameters<typeof requestFromInput>[0]) {
		this.addRequest(requestFromInput(input));
		return this;
	}

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
		(this.flowrConfig.defaultEngine as string) = engine;
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
     * Register one or multiple additional plugins.
     * @param plugin - One or multiple plugins to register.
     *
     * @see {@link FlowrAnalyzerBuilder#unregisterPlugin} to remove plugins.
     */
	public registerPlugin(...plugin: readonly FlowrAnalyzerPlugin[]): this {
		for(const p of plugin) {
			const g = this.plugins.get(p.type);
			if(g === undefined) {
				this.plugins.set(p.type, [p]);
			} else {
				g.push(p);
			}
		}
		return this;
	}

	/**
     * Remove one or multiple plugins.
     * @param plugin - One or multiple plugins.
     */
	public unregisterPlugin(...plugin: readonly FlowrAnalyzerPlugin[]): this {
		for(const p of plugin) {
			const g = this.plugins.get(p.type);
			if(g !== undefined) {
				this.plugins.set(p.type, g.filter(x => x !== p));
			}
		}
		return this;
	}

	/**
     * Create the {@link FlowrAnalyzer} instance using the given information.
     */
	public async build(): Promise<FlowrAnalyzer> {
		let parser: KnownParser;
		if(this.parser) {
			parser = this.parser;
		} else {
			const engines = await retrieveEngineInstances(this.flowrConfig, true);
			parser = engines.engines[engines.default] as KnownParser;
		}

		guard(this.request !== undefined, 'Currently we require at least one request to build an analyzer, please provide one using the constructor or the addRequest method');

		const context = new FlowrAnalyzerContext(this.plugins);
		context.addRequests(this.request);
		// we do it here to save time later if the analyzer is to be duplicated
		context.resolvePreAnalysis();

		return new FlowrAnalyzer(
			this.flowrConfig,
			parser,
			context,
			this.input ?? {}
		);
	}
}