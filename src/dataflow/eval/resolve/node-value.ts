import { Resolve } from '../../environments/resolve-helper';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { ParentInformation, RNodeWithParent } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { DataflowProcessorInformation } from '../../processor';
import type { DataflowGraph } from '../../graph/graph';
import type { ReadOnlyFlowrAnalyzerContext } from '../../../project/context/flowr-analyzer-context';
import type { ResolveInfo, ResolveResult } from './alias-tracking';
import { soleValue, valueSetGuard } from '../values/general';
import { collectStrings } from '../values/string/string-constants';
import { isValue, type Value, type ValueSet } from '../values/r-value';

/** The node to resolve, given either by id or directly. */
type Target = NodeId | RNodeWithParent | undefined;



function infoOf<OtherInfo>(this: void, data: DataflowProcessorInformation<OtherInfo & ParentInformation>, overrides?: Partial<ResolveInfo>): ResolveInfo {
	return {
		environment: data.environment,
		idMap:       data.completeAst.idMap,
		resolve:     data.ctx.config.solver.variables,
		ctx:         data.ctx,
		...overrides
	};
}

function graphInfoOf(this: void, graph: DataflowGraph, ctx: ReadOnlyFlowrAnalyzerContext, overrides?: Partial<ResolveInfo>): ResolveInfo {
	return { graph, resolve: ctx.config.solver.variables, ctx, ...overrides };
}

/**
 * The value(s) a node may hold, resolved against the state the current processor sees.
 * Use {@link NodeValue.inGraph} to resolve against a finished {@link DataflowGraph} instead.
 * Every entry point accepts overrides for the cases that deviate (e.g. another environment).
 *
 * This is constant propagation over the dataflow graph, not abstract interpretation: it follows definitions to
 * constants and gives up wherever a value is not statically pinned down, with no fixpoint and no widening.
 * Anything needing an abstract state lives in `src/abstract-interpretation/`.
 * @example
 * ```ts
 * NodeValue.of(id, data);                    // during processing
 * NodeValue.inGraph(id, graph, ctx);         // on a finished graph
 * NodeValue.sole(NodeValue.setOf(id, data)); // the single value, if there is exactly one
 * ```
 */
export const NodeValue = {
	name: 'NodeValue',
	/** The resolve info the processor's state stands for, for repeated resolutions. */
	infoOf,
	/** The value(s) the node may hold. */
	of<OtherInfo>(this: void, id: Target, data: DataflowProcessorInformation<OtherInfo & ParentInformation>, overrides?: Partial<ResolveInfo>): ResolveResult {
		return Resolve.toValue(id, infoOf(data, overrides));
	},
	/** The value set the node may hold, `undefined` if it resolves to top or bottom. */
	setOf<OtherInfo>(this: void, id: Target, data: DataflowProcessorInformation<OtherInfo & ParentInformation>, overrides?: Partial<ResolveInfo>): ValueSet<Value[]> | undefined {
		return valueSetGuard(Resolve.toValue(id, infoOf(data, overrides)));
	},
	/** The strings the node may hold, `undefined` if it does not resolve to strings. */
	stringsOf<OtherInfo>(this: void, id: Target, data: DataflowProcessorInformation<OtherInfo & ParentInformation>, overrides?: Partial<ResolveInfo>): string[] | undefined {
		const resolved = valueSetGuard(Resolve.toValue(id, infoOf(data, overrides)));
		return resolved ? collectStrings(resolved.elements) : undefined;
	},
	/** The strings the node may hold, dropping every value that is not one (in contrast to {@link NodeValue.stringsOf}, which gives up on them). */
	knownStringsOf<OtherInfo>(this: void, id: Target, data: DataflowProcessorInformation<OtherInfo & ParentInformation>, overrides?: Partial<ResolveInfo>): string[] {
		const resolved = valueSetGuard(Resolve.toValue(id, infoOf(data, overrides)));
		const strings: string[] = [];
		for(const element of resolved?.elements ?? []) {
			if(element.type === 'string' && isValue(element.value)) {
				strings.push(element.value.str);
			}
		}
		return strings;
	},
	/** The single string the node resolves to, `undefined` if it is not exactly one. */
	singleStringOf<OtherInfo>(this: void, id: Target, data: DataflowProcessorInformation<OtherInfo & ParentInformation>, overrides?: Partial<ResolveInfo>): string | undefined {
		return Resolve.toSingleString(id, infoOf(data, overrides));
	},
	/** The one value a set holds, `undefined` unless it holds exactly one, optionally of the given kind. */
	sole: soleValue,
	/** The one value the node resolves to, `undefined` unless it is exactly one, optionally of the given kind. */
	soleOf<OtherInfo, T extends Value['type']>(this: void, id: Target, data: DataflowProcessorInformation<OtherInfo & ParentInformation>, type?: T, overrides?: Partial<ResolveInfo>): Extract<Value, { type: T }> | undefined {
		return soleValue(valueSetGuard(Resolve.toValue(id, infoOf(data, overrides))), type as T);
	},
	/** The same questions, asked of a finished dataflow graph instead of a running processor. */
	inGraph: {
		/** The value set the node may hold, `undefined` if it resolves to top or bottom. */
		setOf(this: void, id: Target, graph: DataflowGraph, ctx: ReadOnlyFlowrAnalyzerContext, overrides?: Partial<ResolveInfo>): ValueSet<Value[]> | undefined {
			return valueSetGuard(Resolve.toValue(id, graphInfoOf(graph, ctx, overrides)));
		},
		/** The single string the node resolves to, `undefined` if it is not exactly one. */
		singleStringOf(this: void, id: Target, graph: DataflowGraph, ctx: ReadOnlyFlowrAnalyzerContext, overrides?: Partial<ResolveInfo>): string | undefined {
			return Resolve.toSingleString(id, graphInfoOf(graph, ctx, overrides));
		},
		/** The one value the node resolves to, `undefined` unless it is exactly one, optionally of the given kind. */
		soleOf<T extends Value['type']>(this: void, id: Target, graph: DataflowGraph, ctx: ReadOnlyFlowrAnalyzerContext, type?: T, overrides?: Partial<ResolveInfo>): Extract<Value, { type: T }> | undefined {
			return soleValue(valueSetGuard(Resolve.toValue(id, graphInfoOf(graph, ctx, overrides))), type as T);
		}
	}
} as const;
