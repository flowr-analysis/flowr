import { Ambient, type AmbientCondition, type AmbientEffect, type AmbientEffects, type AmbientFamilySummary, conditionWords, summaryOfEffects, withImpliedAmbient } from './ambient-effect';
import { type BrandedIdentifier, Identifier } from './identifier';
import type { BuiltInFnInfo } from './built-in-props';
import { decide, type ConditionDecision, type DecidedAgainst } from '../internal/process/functions/call/built-in/built-in-ambient-state';
import { keysOf } from '../internal/process/functions/call/built-in/built-in-ambient-keys';
import { Ternary, TernaryLogic } from '../../util/logic';
import { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { type PotentiallyEmptyRArgument, RFunctionCall } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { ResolveInfo } from '../eval/resolve/alias-tracking';
import { DfgVertex } from '../graph/vertex';
import { EdgeType } from '../graph/edge';
import { Dataflow } from '../graph/df-helper';
import { uniqueArray } from '../../util/collections/arrays';
import { isNotUndefined } from '../../util/assert';
import { type CallSite, CallSites } from '../fn/call-sites';

/** An {@link AmbientEffect} of one call, with what its arguments decide of it, see {@link AmbientContract.narrow}. */
export interface CallAmbientEffect {
	/** the effect without the conditions the arguments decide to hold, so what stays is what they leave open */
	readonly effect:    AmbientEffect
	/** {@link Ternary.Always} if the call has the effect, {@link Ternary.Maybe} if the arguments leave that open */
	readonly happens:   Ternary.Always | Ternary.Maybe
	/** the entries the arguments name, where the effect names entries by them (`library(dplyr)` names `dplyr`), see {@link AmbientEffect#member} */
	readonly keys?:     readonly BrandedIdentifier[]
	/** the argument nodes the conditions were decided on */
	readonly decidedBy: readonly NodeId[]
}

/** The {@link AmbientEffect}s of one call, narrowed to what its arguments say, see {@link AmbientContract.narrow}. */
export interface NarrowedAmbient {
	readonly effects:  readonly CallAmbientEffect[]
	/** the effects the arguments rule out, with the argument nodes that rule them out */
	readonly ruledOut: readonly { readonly effect: AmbientEffect, readonly decidedBy: readonly NodeId[] }[]
	/** the {@link NarrowedAmbient#effects} in the words of {@link AmbientFamilySummary}, the conditions left open still in them */
	readonly summary:  readonly AmbientFamilySummary[]
}

/** The ambient contract of a call for one definition it may call, see {@link AmbientContract.ofCall}. */
export interface CallAmbientContract extends NarrowedAmbient {
	/** the call of the built-in */
	readonly call:       NodeId
	/** the definition called, `maps::map` rather than `purrr::map` */
	readonly definition: Identifier
	/** the built-in id the call links to for {@link CallAmbientContract#definition} */
	readonly target:     NodeId
	/** the calls of functions the program defines that {@link CallAmbientContract#call} is reached through, outermost first, empty if it is the call asked for; the effects are those of {@link CallAmbientContract#call} whenever it runs */
	readonly through:    readonly NodeId[]
}

function narrowEffect<OtherInfo>(effect: AmbientEffect, args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[], against: DecidedAgainst<OtherInfo> | undefined): { readonly happens: Ternary, readonly effect: AmbientEffect, readonly decidedBy: readonly NodeId[] } {
	const when: ConditionDecision = effect.when === undefined ? { holds: Ternary.Always, decidedBy: [] } : decide(effect.when, args, against);
	const unless: ConditionDecision = effect.unless === undefined ? { holds: Ternary.Never, decidedBy: [] } : decide(effect.unless, args, against);
	const happens = TernaryLogic.and(when.holds, TernaryLogic.negate(unless.holds));
	const { when: holdsIf, unless: holdsUnless, ...rest } = effect;
	const narrowed: AmbientEffect = {
		...rest,
		...holdsIf !== undefined && when.holds !== Ternary.Always ? { when: holdsIf } : {},
		...holdsUnless !== undefined && unless.holds !== Ternary.Never ? { unless: holdsUnless } : {}
	};
	return { happens, effect: narrowed, decidedBy: uniqueArray([...when.decidedBy, ...unless.decidedBy]) };
}

/**
 * The ambient contracts of functions: what a call does to the global state, with the conditions of {@link AmbientEffect#when} and
 * {@link AmbientEffect#unless} as data to evaluate rather than words to parse, and narrowed to what the arguments of one call decide.
 * `map(add = TRUE)` of `maps` adds to the plot and starts none, `map(...)` in a function forwarding its arguments may do either.
 * @helper dataflow
 * @example
 * ```ts
 * const info = await Resolve.infoOf(analyzer);
 * for(const contract of AmbientContract.ofCall(id, info)) {
 *     console.log(contract.definition, contract.summary);
 * }
 * ```
 */
export const AmbientContract = {
	name: 'AmbientContract',
	/** The words for a condition, `add is TRUE`, as {@link AmbientFamilySummary} shows it. */
	words(this: void, condition: AmbientCondition): string {
		return conditionWords(condition);
	},
	/**
	 * Whether the condition holds for the arguments `args` of a call, with the argument nodes deciding it.
	 * Without `against`, only what is written decides (`add = TRUE`); with it, the values the analysis resolves do (`add = a` with `a <- TRUE`).
	 * A forwarded `...` may give any argument, so it leaves what it could give open.
	 */
	decide<OtherInfo>(this: void, condition: AmbientCondition, args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[], against?: DecidedAgainst<OtherInfo>): ConditionDecision {
		return decide(condition, args, against);
	},
	/** The effects of a configuration, with those its tags imply, as {@link AmbientContract.narrow} takes them. */
	effectsOf(this: void, config: BuiltInFnInfo | undefined): readonly AmbientEffect[] {
		return Ambient.list(withImpliedAmbient(config)?.ambient);
	},
	/**
	 * The `effects` narrowed to the arguments `args` of a call: an effect they rule out is gone, a condition they decide to hold is dropped,
	 * and with `against` the entries the arguments name are resolved.
	 */
	narrow<OtherInfo>(this: void, effects: AmbientEffects | undefined, args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[], against?: DecidedAgainst<OtherInfo>): NarrowedAmbient {
		return AmbientContract.narrowAcross(effects, [args], against);
	},
	/**
	 * The `effects` narrowed to each of the argument lists `lists` a call stands for (see {@link CallSites.contexts}) and joined:
	 * an effect happens surely only if it does for every list, it is ruled out only if every list rules it out,
	 * and a condition is dropped only if every list decides it.
	 */
	narrowAcross<OtherInfo>(this: void, effects: AmbientEffects | undefined, lists: readonly (readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[])[], against?: DecidedAgainst<OtherInfo>): NarrowedAmbient {
		const kept: CallAmbientEffect[] = [];
		const ruledOut: { effect: AmbientEffect, decidedBy: readonly NodeId[] }[] = [];
		for(const effect of Ambient.list(effects)) {
			const each = lists.map(args => narrowEffect(effect, args, against));
			const happens = each.map(e => e.happens).reduce((a, b) => a === b ? a : Ternary.Maybe);
			const decidedBy = uniqueArray(each.flatMap(e => e.decidedBy));
			if(happens === Ternary.Never) {
				ruledOut.push({ effect, decidedBy });
				continue;
			}
			const { when, unless, ...rest } = effect;
			const narrowed: AmbientEffect = {
				...rest,
				...when !== undefined && each.some(e => e.effect.when !== undefined) ? { when } : {},
				...unless !== undefined && each.some(e => e.effect.unless !== undefined) ? { unless } : {}
			};
			const member = effect.member;
			const keys = against === undefined || member === undefined || member === 'every' ? undefined
				: uniqueArray(lists.flatMap((args, i) => each[i].happens === Ternary.Never ? [] : keysOf(member, args, against)));
			kept.push({ effect: narrowed, happens, decidedBy, ...keys === undefined ? {} : { keys } });
		}
		return { effects: kept, ruledOut, summary: summaryOfEffects(kept.map(e => e.effect)) };
	},
	/**
	 * The ambient contracts of the call `call` of a finished analysis, one per built-in definition the call may reach,
	 * as `map(...)` may call `maps::map` as well as `purrr::map`, which do different things to the global state.
	 * A definition flowR states no effects for has no contract.
	 * The contracts are interprocedural: a call of a function the program defines has the contracts of the calls its body makes,
	 * narrowed to what the call gives (`g <- function(...) maps::map(...)` and `g(add = TRUE)` adds to the plot),
	 * and a call handing on parameters (`maps::map(...)` within `g`) is narrowed to what the known calls of its function give, see {@link CallSites.contexts}.
	 * The `sites` are the calls the body of `call` is reached through, innermost first.
	 */
	ofCall(this: void, call: NodeId, info: ResolveInfo, sites: readonly CallSite[] = []): readonly CallAmbientContract[] {
		const graph = info.graph;
		const vertex = graph?.getVertex(call);
		const node = info.idMap?.get(call);
		if(graph === undefined || !DfgVertex.isFunctionCall(vertex) || !RFunctionCall.is(node)) {
			return [];
		}
		const index = info.ctx.env.builtInIndex;
		const targets = Dataflow.targetsOf(graph, call, EdgeType.Calls).filter(NodeId.isBuiltIn);
		const lists = targets.length === 0 ? [] : CallSites.contexts(node.arguments, graph, sites);
		/* a target naming no package may be the definition of any package, so each one has its contract */
		const own = targets.flatMap(target => {
			const pkgFn = NodeId.toPkgFn(target);
			const named = pkgFn === undefined ? vertex.name : Identifier.make(pkgFn[1], pkgFn[0]);
			const entries = Identifier.getNamespace(named) === undefined ? index.definitionsOf(Identifier.getName(named)) : [index.get(named)].filter(isNotUndefined);
			return entries.flatMap(entry => {
				const effects = AmbientContract.effectsOf({ props: entry.props, tags: entry.tags, sig: entry.sig, ambient: entry.ambient });
				return effects.length === 0 ? [] : [{ call, through: [], definition: entry.name, target, ...AmbientContract.narrowAcross(effects, lists, info) }];
			});
		});
		const inner = CallSites.callees(call, graph).filter(definition => !sites.some(s => s.definition === definition)).flatMap(definition => {
			const site: CallSite = { call: node, definition };
			return CallSites.callsWithin(definition, graph).flatMap(id => AmbientContract.ofCall(id, info, [site, ...sites]).map(c => ({ ...c, through: [call, ...c.through] })));
		});
		return [...own, ...inner];
	}
} as const;
