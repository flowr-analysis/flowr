import { FlowrCache } from './flowr-cache';
import type { KnownParser } from '../../r-bridge/parser';
import type { ObjectMap } from '../../util/collections/objectmap';
import type { CfgSimplificationPassName } from '../../control-flow/cfg-simplification';
import type { ControlFlowInformation } from '../../control-flow/control-flow-graph';
import type { FlowrDataflowCache } from './flowr-dataflow-cache';


interface ControlFlowCache {
    simplified: ObjectMap<CfgSimplificationPassName, ControlFlowInformation>,
    quick:      ControlFlowInformation
}

/**
 * Controlflow specific cache.
 */
export class FlowrControlflowCache<Parser extends KnownParser = KnownParser> extends FlowrCache<
    ControlFlowCache
> {

	protected constructor(dataflow: FlowrDataflowCache<Parser>) {
		super();
		dataflow.registerDependent(this);
	}

	public static create<Parser extends KnownParser = KnownParser>(dataflow: FlowrDataflowCache<Parser>): FlowrControlflowCache<Parser> {
		return new FlowrControlflowCache<Parser>(dataflow);
	}
	// TODO: updates
	/*
    		this.controlFlowInfos = {
			simplified: new ObjectMap<CfgSimplificationPassName, ControlFlowInformation>(),
			quick:      undefined as unknown as ControlFlowInformation
		};
     */
}