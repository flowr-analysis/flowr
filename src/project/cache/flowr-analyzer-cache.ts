import type { KnownParser } from '../../r-bridge/parser';
import { FlowrParseCache } from './flowr-parse-cache';
import { FlowrNormalizeCache } from './flowr-normalized-ast-cache';
import { FlowrDataflowCache } from './flowr-dataflow-cache';
import type { CacheInvalidationEvent, CacheInvalidationEventReceiver } from './flowr-cache';
import { CacheInvalidationEventType } from './flowr-cache';
import { FlowrControlflowCache } from './flowr-controlflow-cache';
import type { DEFAULT_DATAFLOW_PIPELINE, TREE_SITTER_DATAFLOW_PIPELINE } from '../../core/steps/pipeline/default-pipelines';

export interface FlowrAnalyzerCaches<Parser extends KnownParser> {
    parse:       FlowrParseCache<Parser>;
    normalize:   FlowrNormalizeCache<Parser>;
    dataflow:    FlowrDataflowCache<Parser>;
    controlflow: FlowrControlflowCache<Parser>;
}


/**
 * This provides the full analyzer caching layer
 */
export class FlowrAnalyzerCache<Parser extends KnownParser> implements CacheInvalidationEventReceiver, FlowrAnalyzerCaches<Parser> {
	public readonly parse:       FlowrParseCache<Parser>;
	public readonly normalize:   FlowrNormalizeCache<Parser>;
	public readonly dataflow:    FlowrDataflowCache<Parser>;
	public readonly controlflow: FlowrControlflowCache<Parser>;

	/** the currently running pipeline */
	private pipeline: typeof DEFAULT_DATAFLOW_PIPELINE | typeof TREE_SITTER_DATAFLOW_PIPELINE;

	protected constructor(parser: Parser) {
		this.parse = FlowrParseCache.create(parser);
		this.normalize = FlowrNormalizeCache.create(this.parse);
		this.dataflow = FlowrDataflowCache.create(this.normalize);
		this.controlflow = FlowrControlflowCache.create(this.dataflow);
	}

	public static create<Parser extends KnownParser>(parser: Parser): FlowrAnalyzerCache<Parser> {
		return new FlowrAnalyzerCache<Parser>(parser);
	}

	public receive(event: CacheInvalidationEvent) {
		this.parse.receive(event);
	}

	public reset() {
		this.receive({ type: CacheInvalidationEventType.Full });
	}
}