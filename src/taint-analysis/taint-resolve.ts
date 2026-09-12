import type { ParentInformation } from '../r-bridge/lang-4.x/ast/model/processing/decorate';
import { Identifier } from '../dataflow/environments/identifier';
import type { AnyAbstractDomain } from '../abstract-interpretation/domains/abstract-domain';
import { AbstractDomain } from '../abstract-interpretation/domains/abstract-domain';
import { VariableResolve } from '../config';
import {
	getArgumentValue,
	getFunctionArgument,
	getFunctionArguments
} from '../abstract-interpretation/data-frame/mappers/arguments';
import type { RNamedFunctionCall } from '../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { EmptyArgument } from '../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { ReadOnlyFlowrAnalyzerContext } from '../project/context/flowr-analyzer-context';
import type { DataflowGraph } from '../dataflow/graph/graph';
import { isNotUndefined, isUndefined } from '../util/assert';
import { taintLogger } from './logger';
import type { TaintConditionDomain, TaintConditionMapping, TaintMapping } from './taint-mapping';
import { TaintRole } from './taint-mapping';

/**
 * Resolves all {@link TaintMapping}s that apply to a function call
 * into a single abstract value of the given abstract domain.
 * Each {@link TaintRole} is resolved and the resulting values are met together.
 * If no mappings match at all, the call maps to the domain's top element.
 * @param node       - The function call whose taint is being resolved
 * @param mappings   - The mappings that apply to the call
 * @param domain     - The abstract domain the resulting abstract value belongs to
 * @param projectArg - Resolves the abstract value of an argument node within `domain` (e.g. the projection of a
 *                     product state onto the component of the analysis); may return `undefined` if no value is known
 * @param dfg        - The dataflow graph used to resolve the call's arguments
 * @param ctx        - The analyzer context used when resolving argument values
 * @returns The abstract value to store for the function call within the given domain
 */
export function resolveFnCallToTaint<Domain extends AnyAbstractDomain>(
	node: RNamedFunctionCall<ParentInformation>,
	mappings: TaintMapping<Domain>[],
	domain: Domain,
	projectArg: (id: NodeId) => Domain | undefined,
	dfg: DataflowGraph,
	ctx: ReadOnlyFlowrAnalyzerContext
): { value: Domain, role?: TaintRole } {
	if(mappings.length === 0) {
		return { value: domain.top() };
	}
	const context = { domain, node, dfg, ctx, projectArg };
	const roleTaints = Object.values(TaintRole)
		.map(role => ({ role, taint: resolveMappingToTaint(mappings.find(m => m.role === role), context) }))
		.filter((entry): entry is { role: TaintRole, taint: Domain } => isNotUndefined(entry.taint));

	const value = AbstractDomain.meetAll(roleTaints.map(entry => entry.taint), domain.top());

	// for eval only
	const role = roleTaints.find(entry => entry.taint.equals(value))?.role;
	return { value, role };
}

type ResolveContext<Domain extends AnyAbstractDomain> = {
	node:       RNamedFunctionCall<ParentInformation>,
	domain:     Domain,
	dfg:        DataflowGraph,
	ctx:        ReadOnlyFlowrAnalyzerContext,
	projectArg: (id: NodeId) => Domain | undefined
};

function resolveMappingToTaint<Domain extends AnyAbstractDomain>(
	mapping: TaintMapping<Domain> | undefined,
	context: ResolveContext<Domain>
): Domain | undefined {
	if(!mapping) {
		return undefined;
	}
	if('taint' in mapping) {
		return context.domain.create(mapping.taint);
	}
	const resultingTaint = resolveTaintCondition(mapping, context);
	return resultingTaint === undefined ? undefined : context.domain.create(resultingTaint);
}

function resolveTaintCondition<Domain extends AnyAbstractDomain>(
	mapping: TaintConditionMapping<Domain>,
	{ node, dfg, ctx, domain, projectArg }: ResolveContext<Domain>
) {
	const allArgs = getFunctionArguments(node, dfg);

	const resolveInfo = { graph: dfg, idMap: dfg.idMap, full: true, resolve: VariableResolve.Alias, ctx: ctx };
	const valArgs = mapping.condition.argValues
		? mapping.condition.argValues.map(location => getArgumentValue(allArgs, location, resolveInfo))
		: [];

	const taintArgs = mapping.condition.argTaints ? mapping.condition.argTaints.map(location => {
		const arg = getFunctionArgument(allArgs, location, resolveInfo);
		if(isNotUndefined(arg)) {
			taintLogger.warn(`Could not determine function argument for function call to ${Identifier.getName(node.functionName.content)}: Requested taint at position ${location.pos} with name ${location.name}`);
		}
		return arg;
	}) : [];

	const incomingTaints = taintArgs
		.map(arg => (arg === EmptyArgument || !arg?.value?.info) ? domain.top() : projectArg(arg.value.info.id))
		.map((value) => isUndefined(value) ? domain.top() : value);

	return mapping.condition.conditionFn(valArgs, incomingTaints as unknown as TaintConditionDomain<Domain>[]);
}

