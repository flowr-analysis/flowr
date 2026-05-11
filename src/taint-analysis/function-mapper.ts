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

export type ResolvedTaint<Domain extends AnyAbstractDomain> = { condition: TaintCond<Domain>, argument: PotentiallyEmptyRArgument<ParentInformation> } | { taint: AbstractValue<Domain> } | undefined;

/**
 *
 */
export function mapFnCallToTaint<Domain extends AnyAbstractDomain>(
	node: RNode<ParentInformation>,
	mapper: FnTaintMapper<Domain>,
	dfg: DataflowGraph,
	ctx: ReadOnlyFlowrAnalyzerContext
): ResolvedTaint<Domain> {
	if(node.type !== RType.FunctionCall || !node.named) {
		return;
	}

	const functionName = Identifier.getName(node.functionName.content);
	const taint = mapper[functionName]?.taint;

	if(isTaintCond(taint)) {
		const resolveInfo = { graph: dfg, idMap: dfg.idMap, full: true, resolve: VariableResolve.Alias, ctx: ctx };
		const args = getFunctionArguments(node, dfg);
		const arg = getFunctionArgument(args, { pos: taint.pos }, resolveInfo);
		if(arg) {
			return { condition: taint, argument: arg };
		} else {
			return undefined;
		}
	} else if(taint) {
		return { taint: taint };
	} else {
		return undefined;
	}
}

export interface FnTaintMapperInfo<Domain extends AnyAbstractDomain> {
	readonly taint: TaintOrTaintCond<Domain>;
}

export type TaintOrTaintCond<Domain extends AnyAbstractDomain> =  TaintCond<Domain> | AbstractValue<Domain>;

export type FnTaintMapper<Domain extends AnyAbstractDomain> = Record<string, FnTaintMapperInfo<Domain>>;

export type TaintCond<Domain extends AnyAbstractDomain = AnyAbstractDomain> = {
	pos:  number;
	cond: (inParam: AbstractValue<Domain>) => AbstractValue<Domain>;
};

/**
 *
 */
export function isTaintCond(value: unknown): value is TaintCond {
	if(typeof value !== 'object' || value === null) {
		return false;
	}
	return ['pos', 'cond' ].every(property => property in value);
}