import { amendConfig, cloneConfig, defaultConfigOptions, type EngineConfig, type FlowrConfigOptions } from '../config';
import type { DeepWritable } from 'ts-essentials';
import { fileProtocol, isParseRequest, requestFromInput, type RParseRequest } from '../r-bridge/retriever';
import { FlowrAnalyzer } from './flowr-analyzer';
import { retrieveEngineInstances } from '../engines';
import type { KnownParser } from '../r-bridge/parser';
import type { FlowrAnalyzerPlugin, PluginType } from './plugins/flowr-analyzer-plugin';
import type { NormalizeRequiredInput } from '../core/steps/all/core/10-normalize';
import { guard } from '../util/assert';
import type { RAnalysisRequest } from './context/flowr-analyzer-files-context';
import { isFilePath } from '../util/files';
import { FlowrAnalyzerContext } from './context/flowr-analyzer-context';
import { FlowrAnalyzerCache } from './cache/flowr-analyzer-cache';
import type { FlowrFileProvider } from './context/flowr-file';

/**
 * Builder for the {@link FlowrAnalyzer}, use it to configure all analysis aspects before creating the analyzer instance
 * with {@link FlowrAnalyzerBuilder#build|`.build()`} or {@link FlowrAnalyzerBuilder#buildSync|`.buildSync()`}.
 *
 * You can add new files and folders to analyze using the constructor or the {@link FlowrAnalyzerBuilder#add|`.add()`} method.
 * @example Let's create an analyzer for a single R script file:
 *
 * ```ts
 * const analyzer = new FlowrAnalyzerBuilder()
 *                      .add('file:///path/to/script.R')
 *                      .setParser(new TreeSitterExecutor())
 *                      .buildSync();
 * ```
 *
 * If you now want to get the dataflow information for the file, you can do this:
 *
 * ```ts
 * const dfInfo = await analyzer.dataflow();
 * console.log(dfInfo);
 * ```
 */
export class FlowrAnalyzerBuilder {
	private flowrConfig: DeepWritable<FlowrConfigOptions> = cloneConfig(defaultConfigOptions);
	private parser?:     KnownParser;
	private requests:    RAnalysisRequest[] | undefined;
	private files:       FlowrFileProvider[] | undefined;
	private input?:      Omit<NormalizeRequiredInput, 'context'>;
	private plugins:     Map<PluginType, FlowrAnalyzerPlugin[]> = new Map();


	/**
	 * Create a new builder instance.
	 * @param request - The code to analyze
	 */
	constructor(request?: RAnalysisRequest | readonly RAnalysisRequest[]) {
		this.addRequest(request ?? []);
	}

	/**
	 * Add one or multiple requests / files to analyze.
	 * This is a convenience method that uses {@link addRequest} and {@link addRequestFromInput} internally.
	 * @param request - One or multiple requests or a file path (with the `file://` protocol). If you just enter a string, it will be interpreted as R code.
	 */
	public add(request: FlowrFileProvider | RAnalysisRequest | readonly RAnalysisRequest[] | `${typeof fileProtocol}${string}` | string): this {
		if(Array.isArray(request) || isParseRequest(request)) {
			this.addRequest(request);
		} else if(typeof request === 'string') {
			const trimmed = request.substring(fileProtocol.length);
			if(request.startsWith(fileProtocol) && !isFilePath(trimmed)) {
				this.addRequest({ request: 'project', content: trimmed });
			} else {
				this.addRequestFromInput(request);
			}
		} else {
			this.addRequest(request);
		}
		return this;
	}

	/**
	 * Add one or multiple requests to analyze the builder.
	 */
	public addRequest(request: RAnalysisRequest | readonly RAnalysisRequest[] | FlowrFileProvider | FlowrFileProvider[]): this {
		const r = Array.isArray(request) ? request : [request] as RParseRequest[];
		if(r.every(r => isParseRequest(r))) {
			if(this.requests) {
				this.requests = this.requests.concat(r);
			} else {
				this.requests = r;
			}
		} else {
			const f = r;
			if(this.files) {
				this.files = this.files.concat(f);
			} else {
				this.files = f;
			}
		}
		return this;
	}

	/**
	 * Add a request created from the given input.
	 * This is a convenience method that uses {@link requestFromInput} internally.
	 */
	public addRequestFromInput(input: Parameters<typeof requestFromInput>[0]): this {
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
	public setConfig(config: FlowrConfigOptions): this {
		this.flowrConfig = config;
		return this;
	}

	/**
	 * Set the parser instance used by the analyzer.
	 * This is an alternative to {@link FlowrAnalyzerBuilder#setEngine} if you already have a parser instance.
	 * Please be aware, that if you want to parallelize multiple analyzers, there should be separate parser instances.
	 */
	public setParser(parser: KnownParser): this {
		this.parser = parser;
		return this;
	}

	/**
	 * Set the engine and hence the parser that will be used by the analyzer.
	 * This is an alternative to {@link FlowrAnalyzerBuilder#setParser} if you do not have a parser instance at hand.
	 */
	public setEngine(engine: EngineConfig['type']): this {
		(this.flowrConfig.defaultEngine as string) = engine;
		return this;
	}

	/**
	 * Additional parameters for the analyses.
	 * @param input - The input.
	 */
	public setInput(input: Omit<NormalizeRequiredInput, 'context'>): this {
		this.input = input;
		return this;
	}

	/**
	 * Register one or multiple additional plugins.
	 * @see {@link FlowrAnalyzerBuilder#unregisterPlugins} to remove plugins.
	 */
	public registerPlugins(...plugin: readonly FlowrAnalyzerPlugin[]): this {
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
	 */
	public unregisterPlugins(...plugin: readonly FlowrAnalyzerPlugin[]): this {
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
	 * Please note that the only reason this is `async` is that if no parser is set,
	 * we need to retrieve the default engine instance which is an async operation.
	 * If you set the parser using {@link FlowrAnalyzerBuilder#setParser},
	 */
	public async build(): Promise<FlowrAnalyzer> {
		if(!this.parser) {
			const engines = await retrieveEngineInstances(this.flowrConfig, true);
			this.parser = engines.engines[engines.default] as KnownParser;
		}
		return this.buildSync();
	}

	/**
	 * Synchronous version of {@link FlowrAnalyzerBuilder#build}, please only use this if you have set the parser using
	 * {@link FlowrAnalyzerBuilder#setParser} before, otherwise an error will be thrown.
	 */
	public buildSync(): FlowrAnalyzer {
		guard(this.parser !== undefined, 'No parser set, please use the setParser or setEngine method to set a parser before building the analyzer');

		const context = new FlowrAnalyzerContext(this.flowrConfig, this.plugins);
		const cache = FlowrAnalyzerCache.create({
			parser: this.parser,
			context,
			...(this.input ?? {})
		});

		const analyzer = new FlowrAnalyzer(
			this.parser,
			context,
			cache
		);

		if(this.files) {
			analyzer.addFile(...this.files);
		}
		analyzer.addRequest(this.requests ?? []);

		// we do it here to save time later if the analyzer is to be duplicated
		context.resolvePreAnalysis();

		return analyzer;
	}
}