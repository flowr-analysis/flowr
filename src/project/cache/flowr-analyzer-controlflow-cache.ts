import { ObjectMap } from '../../util/collections/objectmap';
import type { CfgSimplificationPassName } from '../../control-flow/cfg-simplification';
import { simplifyControlFlowInformation } from '../../control-flow/cfg-simplification';
import { CfgKind } from '../cfg-kind';
import type { ControlFlowInformation } from '../../control-flow/control-flow-graph';
import { guard } from '../../util/assert';
import { extractCfg, extractCfgQuick } from '../../control-flow/extract-cfg';
import type { NormalizedAst } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { DataflowInformation } from '../../dataflow/info';
import type { FlowrAnalyzerContext } from '../context/flowr-analyzer-context';

type ControlFlowCache = ObjectMap<[passes: readonly CfgSimplificationPassName[], kind: CfgKind], ControlFlowInformation>;

interface CfgInfo {
	ctx:      FlowrAnalyzerContext,
	cfgQuick: ControlFlowInformation | undefined
	dfg:      () => Promise<DataflowInformation>,
	ast:      () => Promise<NormalizedAst>,
}

export class FlowrAnalyzerControlFlowCache {
	private readonly cache: ControlFlowCache = new ObjectMap<[readonly CfgSimplificationPassName[], CfgKind], ControlFlowInformation>();

	public peek(kind: CfgKind, simplifications: readonly CfgSimplificationPassName[] | undefined): ControlFlowInformation | undefined  {
		return this.cache.get([simplifications ?? [], kind]);
	}

	public async get(
		force: boolean | undefined,
		kind: CfgKind,
		cfgCacheInfo: CfgInfo,
		simplifications?: readonly CfgSimplificationPassName[]
	): Promise<ControlFlowInformation> {
		guard(kind === CfgKind.Quick ? simplifications === undefined : true, 'Cannot apply simplifications to quick CFG');
		simplifications ??= [];
		const orderedSimplifications = this.normalizeSimplificationOrder(simplifications);

		const cached = force ?
			{ cfg: undefined, missingSimplifications: orderedSimplifications }
			: this.tryGetCachedCfg(orderedSimplifications, kind);
		let cfg = cached.cfg;

		if(!cfg) {
			cfg = await this.createAndCacheBaseCfg(kind, cfgCacheInfo);
		}

		if(cached.missingSimplifications.length > 0) {
			const cfgPassInfo = { dfg: (await cfgCacheInfo.dfg()).graph, ctx: cfgCacheInfo.ctx, ast: await cfgCacheInfo.ast() };
			cfg = simplifyControlFlowInformation(cfg, cfgPassInfo, cached.missingSimplifications);
		}

		this.cache.set([orderedSimplifications, kind], cfg);
		return cfg;
	}

	/**
	 * Create and cache the base CFG without simplifications.
	 */
	private async createAndCacheBaseCfg(kind: CfgKind, { cfgQuick, dfg, ctx, ast }: CfgInfo): Promise<ControlFlowInformation> {
		let result: ControlFlowInformation;
		switch(kind) {
			case CfgKind.WithDataflow:
				result = extractCfg(await ast(), ctx, (await dfg()).graph);
				break;
			case CfgKind.NoDataflow:
				result = extractCfg(await ast(), ctx);
				break;
			case CfgKind.NoFunctionDefs:
				result = extractCfg(await ast(), ctx, undefined, undefined, true);
				break;
			case CfgKind.Quick:
				result = cfgQuick ?? extractCfgQuick(await ast());
				break;
		}
		this.cache.set([[], kind], result);
		return result;
	}

	/**
	 * Try to get a cached CFG with some of the requested simplifications already applied.
	 * Matches the longest prefix of simplifications available.
	 * @returns The cached CFG and the missing simplifications to be applied, or `undefined` if no cached CFG is available.
	 */
	private tryGetCachedCfg(simplifications: readonly CfgSimplificationPassName[], kind: CfgKind): { cfg: ControlFlowInformation | undefined, missingSimplifications: readonly CfgSimplificationPassName[] } {
		for(let prefixLen = simplifications.length; prefixLen >= 0; prefixLen--) {
			const prefix = simplifications.slice(0, prefixLen);
			const cached = this.cache.get([prefix, kind]);
			if(cached !== undefined) {
				return {
					cfg:                    cached,
					missingSimplifications: simplifications.slice(prefixLen)
				};
			}
		}
		return { cfg: undefined, missingSimplifications: simplifications };
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
