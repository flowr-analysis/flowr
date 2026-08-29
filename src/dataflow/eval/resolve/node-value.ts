import { Resolve } from '../../environments/resolve-helper';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { ParentInformation, RNodeWithParent } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { DataflowProcessorInformation } from '../../processor';
import type { ResolveInfo, ResolveResult } from './alias-tracking';
import { soleValue, valueSetGuard } from '../values/general';
import { collectStrings } from '../values/string/string-constants';
import { isValue, type Value, type ValueSet } from '../values/r-value';

/** The node to resolve, given either by id or directly. */
type Target = NodeId | RNodeWithParent | undefined;

/** What to resolve against: the state a processor is in, or a {@link ResolveInfo} (see {@link Resolve.info}). */
type Against<OtherInfo> = DataflowProcessorInformation<OtherInfo & ParentInformation> | ResolveInfo;

function infoOf<OtherInfo>(this: void, against: Against<OtherInfo>, overrides?: Partial<ResolveInfo>): ResolveInfo {
	return 'completeAst' in against ? {
		environment: against.environment,
		idMap:       against.completeAst.idMap,
		resolve:     against.ctx.config.solver.variables,
		ctx:         against.ctx,
		...overrides
	} : { ...against, ...overrides };
}

/**
 * The value(s) a node may hold. Every entry point resolves against either the state the current processor sees
 * or a {@link ResolveInfo}, so a finished analysis asks the same questions in the same words, and takes
 * overrides for the cases that deviate (e.g. another environment).
 *
 * This is constant propagation over the dataflow graph, not abstract interpretation: it follows definitions to
 * constants and gives up wherever a value is not statically pinned down, with no fixpoint and no widening.
 * Anything needing an abstract state lives in `src/abstract-interpretation/`.
 * @example
 * ```ts
 * NodeValue.of(id, data);                          // during processing
 * NodeValue.setOf(id, await Resolve.infoOf(analyzer)); // on a finished analysis
 * NodeValue.sole(NodeValue.setOf(id, data));       // the single value, if there is exactly one
 * ```
 */
export const NodeValue = {
	name: 'NodeValue',
	/** The value(s) the node may hold. */
	of<OtherInfo>(this: void, id: Target, against: Against<OtherInfo>, overrides?: Partial<ResolveInfo>): ResolveResult {
		return Resolve.toValue(id, infoOf(against, overrides));
	},
	/** The value set the node may hold, `undefined` if it resolves to top or bottom. */
	setOf<OtherInfo>(this: void, id: Target, against: Against<OtherInfo>, overrides?: Partial<ResolveInfo>): ValueSet<Value[]> | undefined {
		return valueSetGuard(Resolve.toValue(id, infoOf(against, overrides)));
	},
	/** The strings the node may hold, `undefined` if it does not resolve to strings. */
	stringsOf<OtherInfo>(this: void, id: Target, against: Against<OtherInfo>, overrides?: Partial<ResolveInfo>): string[] | undefined {
		const resolved = valueSetGuard(Resolve.toValue(id, infoOf(against, overrides)));
		return resolved ? collectStrings(resolved.elements) : undefined;
	},
	/** The strings the node may hold, dropping every value that is not one (in contrast to {@link NodeValue.stringsOf}, which gives up on them). */
	knownStringsOf<OtherInfo>(this: void, id: Target, against: Against<OtherInfo>, overrides?: Partial<ResolveInfo>): string[] {
		const resolved = valueSetGuard(Resolve.toValue(id, infoOf(against, overrides)));
		const strings: string[] = [];
		for(const element of resolved?.elements ?? []) {
			if(element.type === 'string' && isValue(element.value)) {
				strings.push(element.value.str);
			}
		}
		return strings;
	},
	/** The single string the node resolves to, `undefined` if it is not exactly one. */
	singleStringOf<OtherInfo>(this: void, id: Target, against: Against<OtherInfo>, overrides?: Partial<ResolveInfo>): string | undefined {
		return Resolve.toSingleString(id, infoOf(against, overrides));
	},
	/** The one value a set holds, `undefined` unless it holds exactly one, optionally of the given kind. */
	sole: soleValue,
	/** The one value the node resolves to, `undefined` unless it is exactly one, optionally of the given kind. */
	soleOf<OtherInfo, T extends Value['type']>(this: void, id: Target, against: Against<OtherInfo>, type?: T, overrides?: Partial<ResolveInfo>): Extract<Value, { type: T }> | undefined {
		return soleValue(valueSetGuard(Resolve.toValue(id, infoOf(against, overrides))), type as T);
	},
} as const;
