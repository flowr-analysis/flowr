import type { FlowrConfigOptions } from '../config';
import { amendConfig, cloneConfig, defaultConfigOptions } from '../config';
import type { DeepWritable } from 'ts-essentials';
import type { RParseRequests } from '../r-bridge/retriever';
import { FlowrAnalyzer } from './flowr-analyzer';

export class FlowrAnalyzerBuilder {
	private flowrConfig: FlowrConfigOptions = cloneConfig(defaultConfigOptions);
	private request:     RParseRequests;

	public amendConfig(func: (config: DeepWritable<FlowrConfigOptions>) => FlowrConfigOptions) : FlowrAnalyzerBuilder {
		amendConfig(this.flowrConfig, func);
		return this;
	}

	constructor(request: RParseRequests) {
		this.request = request;
	}

	public build(): FlowrAnalyzer {
		return new FlowrAnalyzer(
			this.flowrConfig,
			this.request
		);
	}
}