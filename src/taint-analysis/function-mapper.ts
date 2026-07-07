import type { RNode } from '../r-bridge/lang-4.x/ast/model/model';
import type { ParentInformation } from '../r-bridge/lang-4.x/ast/model/processing/decorate';
import { RType } from '../r-bridge/lang-4.x/ast/model/type';
import { Identifier } from '../dataflow/environments/identifier';
import type { AbstractValue, AnyAbstractDomain } from '../abstract-interpretation/domains/abstract-domain';
import { VariableResolve } from '../config';
import type { FunctionParameterLocation } from '../abstract-interpretation/data-frame/mappers/arguments';
import {
	getArgumentValue,
	getFunctionArgument,
	getFunctionArguments
} from '../abstract-interpretation/data-frame/mappers/arguments';
import type { DataflowGraph } from '../dataflow/graph/graph';
import type { ReadOnlyFlowrAnalyzerContext } from '../project/context/flowr-analyzer-context';
import type { PotentiallyEmptyRArgument } from '../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { EmptyArgument } from '../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import { log } from '../util/log';
import { Top } from '../abstract-interpretation/domains/lattice';

/**
 * Determine the resulting taint of a function call
 * @param node   - The function call
 * @param mapper - Function mapper containing relations between function names and their tainting behaviour
 * @param dfg    - Data flow graph
 * @param ctx    - The analysis context
 */
export function mapFnCallToTaint<Domain extends AnyAbstractDomain>(
	node: RNode<ParentInformation>,
	mapper: TaintMapper<Domain>,
	dfg: DataflowGraph,
	ctx: ReadOnlyFlowrAnalyzerContext
): ResolvedTaint<Domain> {
	if(node.type !== RType.FunctionCall || !node.named) {
		return;
	}

	const functionName = node.functionName.content;
	const mapping = mapper.find(m => {
		if(Identifier.is(m.identifier)) {
			return Identifier.matches(m.identifier, functionName);
		} else {
			return m.identifier.find(s => Identifier.matches(s, functionName));
		}
	});

	if(mapping?.taint) {
		return { taint: mapping.taint };
	} else if(mapping?.condition) {
		const resolveInfo = { graph: dfg, idMap: dfg.idMap, full: true, resolve: VariableResolve.Alias, ctx: ctx };
		const allArgs = getFunctionArguments(node, dfg);

		const valArgs = mapping.condition.argValues
			? mapping.condition.argValues.map(location => getArgumentValue(allArgs, location, resolveInfo))
			: [];

		const taintArgs = mapping.condition.argTaints ? mapping.condition.argTaints.map(location => {
			const arg = getFunctionArgument(allArgs, location, resolveInfo);
			if(!arg) {
				log.warn(`Could not determine function argument for requested taint at position ${location.pos} with name ${location.name}`);
			}
			return arg;
		}) : [];

		return {
			valArgs,
			taintArgs,
			condition: mapping.condition.condition,
		};
	}
}

/**
 * Resolves a {@link ResolvedTaint} into the concrete abstract value of the given (value) abstract domain.
 *
 * This contains the shared logic used by both the single-analysis {@link TaintInferenceVisitor} and the
 * composite (product) taint visitor: a resolved taint is either a fixed taint, a conditional taint that
 * combines the (projected) taints of its argument nodes, or absent (which maps to the Top element).
 * @param taint      - The resolved taint to map into an abstract value (e.g. obtained via {@link mapFnCallToTaint})
 * @param domain     - The (value) abstract domain the resulting abstract value belongs to
 * @param projectArg - Resolves the abstract value of an argument node within `domain` (e.g. the projection of a
 *                     product state onto the component of the analysis); may return `undefined` if no value is known
 * @returns The abstract value to store for the function call within the given domain
 */
export function resolveTaint<Domain extends AnyAbstractDomain>(
	taint: ResolvedTaint<Domain>,
	domain: Domain,
	projectArg: (id: NodeId) => Domain | undefined
): Domain {
	if(!taint) {
		return domain.top() as Domain;
	} else if('taint' in taint) {
		return domain.create(taint.taint);
	}

	const incomingTaints = taint.taintArgs
		.map(arg => (arg === EmptyArgument || !arg?.value?.info) ? domain.create(Top) : projectArg(arg.value.info.id))
		.filter((value): value is Domain => value !== undefined)
		.map(value => value.value as AbstractValue<Domain>);

	const resultingTaint = taint.condition(taint.valArgs, incomingTaints);

	if(!resultingTaint) {
		log.warn('Argument is undefined');
	}

	return domain.create(resultingTaint ?? Top);
}

export type ResolvedTaint<Domain extends AnyAbstractDomain> =
	{
		condition: TaintConditionFunction<Domain>,
		valArgs:   unknown[],
		taintArgs: (PotentiallyEmptyRArgument<ParentInformation> | undefined)[]
	}
	| { taint: AbstractValue<Domain> }
	| undefined;


export type TaintMapper<Domain extends AnyAbstractDomain> = TaintMapping<Domain>[];

export type TaintMapping<Domain extends AnyAbstractDomain> = {
	role?:      'from' | 'through' | 'to';
	identifier: Identifier | Identifier[];
} & (
	| { taint: AbstractValue<Domain>; condition?: TaintCondition<Domain> }
	| { taint?: AbstractValue<Domain>; condition: TaintCondition<Domain> }
);

export type TaintCondition<Domain extends AnyAbstractDomain = AnyAbstractDomain> = {
	argValues?: FunctionParameterLocation<unknown>[],
	argTaints?: TaintParameterLocation[],
	condition:  TaintConditionFunction<Domain>
};

export type TaintConditionFunction<Domain extends AnyAbstractDomain> =
	( args: unknown[], taints: AbstractValue<Domain>[]) => AbstractValue<Domain>;


export interface TaintParameterLocation {
	pos:   number,
	name?: string
}
