import type { RNode } from '../r-bridge/lang-4.x/ast/model/model';
import type { ParentInformation } from '../r-bridge/lang-4.x/ast/model/processing/decorate';
import { RType } from '../r-bridge/lang-4.x/ast/model/type';
import { Identifier } from '../dataflow/environments/identifier';
import type {
	AbstractValue,
	AnyAbstractDomain
} from '../abstract-interpretation/domains/abstract-domain';
import { VariableResolve } from '../config';
import { getFunctionArgument, getFunctionArguments } from '../abstract-interpretation/data-frame/mappers/arguments';
import type { DataflowGraph } from '../dataflow/graph/graph';
import type { ReadOnlyFlowrAnalyzerContext } from '../project/context/flowr-analyzer-context';
import type { PotentiallyEmptyRArgument } from '../r-bridge/lang-4.x/ast/model/nodes/r-function-call';

export type ResolvedTaint<Domain extends AnyAbstractDomain> =
	{ condition: TaintCondition<Domain>, argument: PotentiallyEmptyRArgument<ParentInformation> } | { taint: AbstractValue<Domain> } | undefined;

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
	const mapping = mapper.find(m => Identifier.matches(m.identifier, functionName));

	if(mapping?.condition) {
		const resolveInfo = { graph: dfg, idMap: dfg.idMap, full: true, resolve: VariableResolve.Alias, ctx: ctx };
		const args = getFunctionArguments(node, dfg);
		const arg = getFunctionArgument(args, { pos: mapping.condition.pos }, resolveInfo);
		if(arg) {
			return { condition: mapping.condition, argument: arg };
		} else {
			return undefined;
		}
	} else if(mapping?.taint) {
		return { taint: mapping.taint };
	} else {
		return undefined;
	}
}

export type TaintMapper<Domain extends AnyAbstractDomain> = TaintMapping<Domain>[];

export type TaintMapping<Domain extends AnyAbstractDomain> = {
	identifier: Identifier;
} & (
	| { taint: AbstractValue<Domain>; condition?: TaintCondition<Domain> }
	| { taint?: AbstractValue<Domain>; condition: TaintCondition<Domain> }
	);

export type TaintCondition<Domain extends AnyAbstractDomain = AnyAbstractDomain> = {
	pos:  number;
	cond: (inParam: AbstractValue<Domain>) => AbstractValue<Domain>;
};