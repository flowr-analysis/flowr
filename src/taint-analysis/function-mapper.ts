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
import { guard } from '../util/assert';

export type ResolvedTaint<Domain extends AnyAbstractDomain> =
	{
		condition: TaintConditionFunction<Domain>,
		valArgs:   unknown[], // TODO Support for other types apart from booleans
		taintArgs: PotentiallyEmptyRArgument<ParentInformation>[]
	}
	| { taint: AbstractValue<Domain> }
	| undefined;

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

	const functionName = Identifier.getName(node.functionName.content);
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
			guard(arg, `Could not determine function argument for requested taint at position ${location.pos} with name ${location.name}`);
			return arg;
		}) : [];

		return {
			valArgs,
			taintArgs,
			condition: mapping.condition.condition,
		};
	}
}

export type TaintMapper<Domain extends AnyAbstractDomain> = TaintMapping<Domain>[];

export type TaintMapping<Domain extends AnyAbstractDomain> = {
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
