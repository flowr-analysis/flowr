import type { IdentifierString } from '../dataflow/environments/identifier';
import { Identifier } from '../dataflow/environments/identifier';
import { Dataflow } from '../dataflow/graph/df-helper';
import { DfgVertex, type DataflowGraphVertexArgument, type DataflowGraphVertexFunctionCall, type DataflowGraphVertexValue } from '../dataflow/graph/vertex';
import type { RLogicalValue } from '../r-bridge/lang-4.x/ast/model/nodes/r-logical';
import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { RNull, RNumberValue, RStringValue, RFalse, RTrue  } from '../r-bridge/lang-4.x/convert-values';
import { Record } from '../util/record';
import type { AbsintContext, AbstractSemantics } from './abstract-semantics';
import type { AnyAbstractDomain } from './domains/abstract-domain';
import type { StateDomain } from './domains/state-domain';

/**
 * The abstract semantics of the different types of R constants.
 * @template Domain - Type of the state abstract domain the semantics are defined for
 */
interface ConstantSemantics<Domain extends StateDomain> {
	/** The abstract semantics of string constants, such as `"id"` */
	readonly string?:  AbstractSemantics<Domain>['handleStringConstant'];
	/** The abstract semantics of numeric constants, such as `42` */
	readonly number?:  AbstractSemantics<Domain>['handleNumberConstant'];
	/** The abstract semantics of logical constants, i.e. `TRUE` and `FALSE` */
	readonly logical?: AbstractSemantics<Domain>['handleLogicalConstant'];
	/** The abstract semantics of the `NULL` constant */
	readonly null?:    AbstractSemantics<Domain>['handleNullConstant'];
	/** The abstract semantics of symbol constants, such as `NA` or `Inf` */
	readonly symbol?:  AbstractSemantics<Domain>['handleSymbolConstant'];
}

/**
 * A mapping from the (possibly namespaced) name of an R function to the semantics to apply for calls of that function.
 * The special key `other` defines the semantics to apply for all calls that are not matched by any of the other names.
 * @template Domain  - Type of the state abstract domain the semantics are defined for
 * @template Handler - The name of the {@link AbstractSemantics} handler the mapped semantics belong to
 */
type CallSemanticsMapping<Domain extends StateDomain, Handler extends keyof AbstractSemantics<Domain>> =
	Record<IdentifierString, AbstractSemantics<Domain>[Handler]> & { readonly other?: AbstractSemantics<Domain>[Handler] };

/**
 * The abstract semantics of concrete R functions, mapping the (possibly namespaced) name of a function to the semantics to apply for calls of that function.
 * The names of the functions are parsed as {@link Identifier}, so that names like `dplyr::filter`, `filter`, or `*::filter` can be used.
 * @template Domain - Type of the state abstract domain the semantics are defined for
 */
interface CallSemantics<Domain extends StateDomain> {
	/** The abstract semantics of normal function calls, such as `data.frame(id = 1:5)` */
	readonly functionCalls?:      CallSemanticsMapping<Domain, 'handleFunctionCall'>;
	/** The abstract semantics of replacement calls, such as `names(x) <- "id"` */
	readonly replacementCall?:    CallSemanticsMapping<Domain, 'handleReplacementCall'>;
	/** The abstract semantics of access calls, such as `x[1]` or `x$id` */
	readonly accessCalls?:        CallSemanticsMapping<Domain, 'handleAccessCall'>;
	/** The abstract semantics of conditions, refining the abstract state in the branches guarded by a call of the respective function */
	readonly conditionSemantics?: CallSemanticsMapping<Domain, 'handleConditionBranch'>;
}

/**
 * A declarative definition of the abstract semantics of an abstract domain,
 * mapping R constants and concrete R functions to the semantics to apply for them (see {@link ValueSemantics}).
 * @template Domain - Type of the state abstract domain the semantics are defined for
 */
export interface SemanticsDefinition<Domain extends StateDomain> extends CallSemantics<Domain> {
	/** The abstract semantics of the different types of R constants */
	readonly constants?: ConstantSemantics<Domain>;
}

/**
 * The type of the function applying the semantics of a {@link CallSemantics} entry.
 * @template Semantics - Type of the call semantics entry to get the applier function type for
 */
type CallSemanticsApplier<Semantics> = Semantics extends Record<IdentifierString, infer Applier> ? Applier : undefined;

/**
 * The internal representation of the {@link CallSemantics} of a {@link SemanticsDefinition} with all function names parsed to {@link Identifier}.
 * @template Domain - Type of the state abstract domain the semantics are defined for
 */
type CallSemanticsDefinition<Domain extends StateDomain> = {
	readonly [Key in keyof CallSemantics<Domain>]: ReadonlyMap<string, CallSemanticsEntry<Domain, Key>[]>;
};

/**
 * The entry of a {@link CallSemanticsDefinition} mapping a function name to the semantics to apply for calls of that function.
 * @template Domain - Type of the state abstract domain the semantics are defined for
 * @template Key    - The type of the call semantics entry to get the applier function type for
 */
interface CallSemanticsEntry<Domain extends StateDomain, Key extends keyof CallSemantics<Domain> = keyof CallSemantics<Domain>> {
	readonly identifier: Identifier | 'other';
	readonly applier:    CallSemanticsApplier<CallSemantics<Domain>[Key]>;
}

/**
 * The abstract semantics of an abstract domain defined by a declarative {@link SemanticsDefinition},
 * dispatching each visited constant and function call to the semantics defined for it.
 *
 * Function calls are dispatched by their qualified name, so that the semantics of a function are only applied
 * if the called function actually originates from the expected namespace.
 * Besides the defined semantics, this provides default semantics for assignments by assigning the abstract value of the source to the assignment target.
 * @template Domain - Type of the state abstract domain the semantics are defined for
 */
export class ValueSemantics<Domain extends StateDomain<AnyAbstractDomain>> implements AbstractSemantics<Domain> {
	/** The abstract semantics of the different types of R constants */
	private readonly constantSemantics?: ConstantSemantics<Domain>;

	/** The abstract semantics of the supported concrete R functions with all function names parsed to identifiers */
	private readonly callSemantics: CallSemanticsDefinition<Domain>;

	/**
	 * Creates the abstract semantics defined by the given semantics definition.
	 * @param semantics - The declarative definition of the abstract semantics to apply
	 */
	constructor({ constants, ...callSemantics }: SemanticsDefinition<Domain>) {
		this.constantSemantics = constants;
		this.callSemantics = Record.mapPartialProps(callSemantics, semantics => {
			const map = new Map<string, CallSemanticsEntry<Domain>[]>();

			for(const [key, applier] of Record.entries(semantics)) {
				const identifier = Identifier.parse(key);
				const name = Identifier.getName(identifier);
				const entries = map.get(name) ?? [];
				entries.push({ identifier, applier });
				map.set(name, entries);
			}
			return map;
		});
	}

	/** Applies the defined abstract semantics of string constants (see {@link ConstantSemantics}) */
	public handleStringConstant(state: Domain, vertex: DataflowGraphVertexValue, ctx: AbsintContext<Domain>, value: RStringValue): void {
		this.constantSemantics?.string?.(state, vertex, ctx, value);
	}

	/** Applies the defined abstract semantics of numeric constants (see {@link ConstantSemantics}) */
	public handleNumberConstant(state: Domain, vertex: DataflowGraphVertexValue, ctx: AbsintContext<Domain>, value: RNumberValue): void {
		this.constantSemantics?.number?.(state, vertex, ctx, value);
	}

	/** Applies the defined abstract semantics of logical constants (see {@link ConstantSemantics}) */
	public handleLogicalConstant(state: Domain, vertex: DataflowGraphVertexValue, ctx: AbsintContext<Domain>, value: RLogicalValue): void {
		this.constantSemantics?.logical?.(state, vertex, ctx, value);
	}

	/** Applies the defined abstract semantics of the `NULL` constant (see {@link ConstantSemantics}) */
	public handleNullConstant(state: Domain, vertex: DataflowGraphVertexValue, ctx: AbsintContext<Domain>, value: typeof RNull): void {
		this.constantSemantics?.null?.(state, vertex, ctx, value);
	}

	/** Applies the defined abstract semantics of symbol constants (see {@link ConstantSemantics}) */
	public handleSymbolConstant(state: Domain, vertex: DataflowGraphVertexValue, ctx: AbsintContext<Domain>, value: Identifier): void {
		this.constantSemantics?.symbol?.(state, vertex, ctx, value);
	}

	/** Applies the abstract semantics defined for the called function, if the called function is supported (see {@link CallSemantics}) */
	public handleFunctionCall(state: Domain, vertex: DataflowGraphVertexFunctionCall, ctx: AbsintContext<Domain>): void {
		const applySemantics = this.getSemantics('functionCalls', vertex, ctx);
		applySemantics?.(state, vertex, ctx);
	}

	/** Applies the abstract semantics defined for the called replacement function, if the replacement function is supported (see {@link CallSemantics}) */
	public handleReplacementCall(state: Domain, vertex: DataflowGraphVertexFunctionCall, ctx: AbsintContext<Domain>, target: NodeId, source: NodeId): void {
		const applySemantics = this.getSemantics('replacementCall', vertex, ctx);
		applySemantics?.(state, vertex, ctx, target, source);
	}

	/** Applies the abstract semantics defined for the called access function, if the access function is supported (see {@link CallSemantics}) */
	public handleAccessCall(state: Domain, vertex: DataflowGraphVertexFunctionCall, ctx: AbsintContext<Domain>, target: NodeId): void {
		const applySemantics = this.getSemantics('accessCalls', vertex, ctx);
		applySemantics?.(state, vertex, ctx, target);
	}

	/** Assigns the abstract value inferred for the assigned source expression to the target of the assignment */
	public handleAssignmentCall(state: Domain, vertex: DataflowGraphVertexFunctionCall, ctx: AbsintContext<Domain>, target: NodeId, source: NodeId): void {
		const value = ctx.getAbstractValue(source);

		if(value !== undefined) {
			state.set(target, value);
		} else {
			state.remove(target);
		}
	}

	/** Applies the abstract semantics defined for the function call guarding a branch, if the called function is supported (see {@link CallSemantics}) */
	public handleConditionBranch(state: Domain, vertex: DataflowGraphVertexArgument, ctx: AbsintContext<Domain>, branch: typeof RTrue | typeof RFalse): void {
		if(DfgVertex.isFunctionCall(vertex)) {
			const applySemantics = this.getSemantics('conditionSemantics', vertex, ctx);
			applySemantics?.(state, vertex, ctx, branch);
		} else {
			const applySemantics = this.getDefaultSemantics('conditionSemantics');
			applySemantics?.(state, vertex, ctx, branch);
		}
	}

	/**
	 * Gets the semantics applier function defined for a function call, by matching the qualified name of the called function against the defined function names.
	 * @param type   - The type of the call semantics to get the applier function for
	 * @param vertex - The dataflow graph vertex of the function call
	 * @param ctx    - The context of the abstract interpretation analysis
	 * @returns      The applier function of the defined semantics, or `undefined` if the called function is not supported
	 */
	protected getSemantics<Key extends keyof CallSemantics<Domain>>(type: Key, vertex: DataflowGraphVertexFunctionCall, ctx: AbsintContext<Domain>): CallSemanticsApplier<CallSemantics<Domain>[Key]> | undefined {
		const name = Dataflow.qualify(vertex.id, ctx.dfg, false) ?? vertex.name;
		const candidates = this.callSemantics[type]?.get(Identifier.getName(name)) ?? [];
		const semantics = candidates.find(({ identifier }) => Identifier.matches(name, identifier));

		return semantics?.applier ?? this.getDefaultSemantics(type);
	}

	private getDefaultSemantics<Key extends keyof CallSemantics<Domain>>(type: Key): CallSemanticsApplier<CallSemantics<Domain>[Key]> | undefined {
		return this.callSemantics[type]?.get('other')?.find(({ identifier }) => identifier === 'other')?.applier;
	}
}
