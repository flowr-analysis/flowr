import { ObjectMap } from '../../util/collections/objectmap';
import type { CfgSimplificationPassName } from '../../control-flow/cfg-simplification';
import { simplifyControlFlowInformation } from '../../control-flow/cfg-simplification';
import type { ControlFlowInformation } from '../../control-flow/control-flow-graph';
import { extractCfg } from '../../control-flow/control-flow-graph';
import type { NormalizedAst } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { DataflowInformation } from '../../dataflow/info';
import type { FlowrAnalyzerContext } from '../context/flowr-analyzer-context';

type ControlFlowCache = ObjectMap<[passes: readonly CfgSimplificationPassName[]], ControlFlowInformation>;

interface CfgInfo {
	ctx: FlowrAnalyzerContext,
	dfg: () => Promise<DataflowInformation>,
	ast: () => Promise<NormalizedAst>,
}

/**
 * Caches the control flow graph of a request.
 *
 * The control flow graph is a view on the dataflow graph (see {@link ControlFlowGraph}), so what is
 * cached here is not the analysis but the simplification passes applied on top of it: the projection itself
 * is lazy and costs nothing until something walks it.
 */
export class FlowrAnalyzerControlFlowCache {
	private readonly cache: ControlFlowCache = new ObjectMap<[readonly CfgSimplificationPassName[]], ControlFlowInformation>();

	public peek(simplifications: readonly CfgSimplificationPassName[] | undefined): ControlFlowInformation | undefined  {
		return this.cache.get([simplifications ?? []]);
	}

	public async get(
		force: boolean | undefined,
		cfgCacheInfo: CfgInfo,
		simplifications?: readonly CfgSimplificationPassName[]
	): Promise<ControlFlowInformation> {
		simplifications ??= [];
		const orderedSimplifications = this.normalizeSimplificationOrder(simplifications);

		const known = force ? undefined : this.cache.get([orderedSimplifications]);
		if(known !== undefined) {
			return known;
		}
		/* passes like `analyze-dead-code` change the graph in place, so they start from a view of their own rather than one cached for fewer passes */
		let cfg = extractCfg(await cfgCacheInfo.dfg());
		if(orderedSimplifications.length > 0) {
			const cfgPassInfo = { dfg: (await cfgCacheInfo.dfg()).graph, ctx: cfgCacheInfo.ctx, ast: await cfgCacheInfo.ast() };
			cfg = simplifyControlFlowInformation(cfg, cfgPassInfo, orderedSimplifications);
		}

		this.cache.set([orderedSimplifications], cfg);
		return cfg;
	}

	/**
	 * Normalize the order of simplification passes.
	 * Is currently an identity function, but may be extended in the future to enforce a specific order using heuristics.
	 * @param simplifications - the requested simplification passes.
	 */
	private normalizeSimplificationOrder(simplifications: readonly CfgSimplificationPassName[]): readonly CfgSimplificationPassName[] {
		return simplifications;
	}
}
