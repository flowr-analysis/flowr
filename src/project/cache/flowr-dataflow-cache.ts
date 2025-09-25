import { FlowrCache } from './flowr-cache';
import type { KnownParser } from '../../r-bridge/parser';
import type { DataflowInformation } from '../../dataflow/info';
import type { FlowrNormalizeCache } from './flowr-normalized-ast-cache';

/**
 * Dataflow specific cache.
 */
export class FlowrDataflowCache<Parser extends KnownParser = KnownParser> extends FlowrCache<
    DataflowInformation
> {

	protected constructor(normalizer: FlowrNormalizeCache<Parser>) {
		super();
		normalizer.registerDependent(this);
	}

	public static create<Parser extends KnownParser = KnownParser>(normalizer: FlowrNormalizeCache<Parser>): FlowrDataflowCache<Parser> {
		return new FlowrDataflowCache<Parser>(normalizer);
	}
}