import type { ParentInformation } from '../r-bridge/lang-4.x/ast/model/processing/decorate';
import { Identifier } from '../dataflow/environments/identifier';
import type { AnyAbstractDomain } from '../abstract-interpretation/domains/abstract-domain';
import { AbstractDomain } from '../abstract-interpretation/domains/abstract-domain';
import { VariableResolve } from '../config';
import {
	getArgumentValue,
	getFunctionArgument,
	getVertexArguments
} from '../abstract-interpretation/data-frame/arguments';
import type { PotentiallyEmptyRArgument } from '../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { EmptyArgument } from '../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { ReadOnlyFlowrAnalyzerContext } from '../project/context/flowr-analyzer-context';
import type { DataflowGraph } from '../dataflow/graph/graph';
import { MatchArgs } from '../dataflow/graph/match-args';
import { DfgVertex, type DataflowGraphVertexFunctionCall } from '../dataflow/graph/vertex';
import { isUndefined } from '../util/assert';
import { taintLogger } from './logger';
import type {
	TaintCondition,
	TaintConditionDomain,
	TaintConditionMapping,
	TaintMapping,
	TaintParameterLocation,
	TaintRuleProvenance,
	TaintRuleRecord,
	TaintRuleRecorder
} from './taint-mapping';
import { TaintRole } from './taint-mapping';
import type { ResolveInfo } from '../dataflow/eval/resolve/alias-tracking';

export interface ResolvedTaint<Domain extends AnyAbstractDomain = AnyAbstractDomain> {
	readonly value:            Domain
	readonly role?:            TaintRole
	readonly category?:        string
	/** What the rule that decided the taint states about the provenance of the call */
	readonly record:           TaintRuleRecord
	/** Replaces what the provenance records about the call by default, see {@link TaintRuleProvenance.suppressDefault} */
	readonly suppressDefault?: TaintRuleRecorder
}

class RuleProvenance implements TaintRuleProvenance {
	public readonly notes: string[] = [];
	public recorder?:      TaintRuleRecorder;

	public note(info: string): void {
		this.notes.push(info);
	}

	public suppressDefault(recorder: TaintRuleRecorder): void {
		this.recorder = recorder;
	}
}

/**
 * Resolves all {@link TaintMapping}s that apply to a function call
 * into a single abstract value of the given abstract domain.
 * Each {@link TaintRole} is resolved and the resulting values are met together.
 * If no mappings match at all, the call maps to the domain's top element.
 * @param call       - The function call vertex whose taint is being resolved
 * @param mappings   - The mappings that apply to the call
 * @param domain     - The abstract domain the resulting abstract value belongs to
 * @param projectArg - Resolves the abstract value of an argument node within `domain` (e.g. the projection of a
 *                     product state onto the component of the analysis); may return `undefined` if no value is known
 * @param dfg        - The dataflow graph used to resolve the call's arguments
 * @param ctx        - The analyzer context used when resolving argument values
 * @returns The abstract value to store for the function call within the given domain
 */
export function resolveFnCallToTaint<Domain extends AnyAbstractDomain>(
	call: DataflowGraphVertexFunctionCall,
	mappings: TaintMapping<Domain>[],
	domain: Domain,
	projectArg: (id: NodeId) => Domain | undefined,
	dfg: DataflowGraph,
	ctx: ReadOnlyFlowrAnalyzerContext
): ResolvedTaint<Domain> {
	const args = dfg.idMap !== undefined ? getVertexArguments(call, dfg.idMap) : [];
	const unmapped: TaintRuleRecord = { notes: [], passthrough: false, inputs: args.flatMap(arg => arg === EmptyArgument || arg.value === undefined ? [] : [arg.value.info.id]) };
	if(mappings.length === 0) {
		return { value: domain.top(), record: unmapped };
	}
	const context = { domain, call, dfg, ctx, projectArg };
	const roleTaints = Object.values(TaintRole).flatMap(role => {
		const mapping = mappings.find(m => m.role === role);
		const provenance = new RuleProvenance();
		const inputs: NodeId[] = [];
		const taint = resolveMappingToTaint(mapping, { ...context, inputs }, provenance);
		return taint === undefined ? [] : [{ role, category: mapping?.category, taint, record: { notes: provenance.notes, passthrough: mapping?.recordProvenance === false, inputs }, suppressDefault: provenance.recorder }];
	});

	const value = AbstractDomain.meetAll(roleTaints.map(entry => entry.taint), domain.top());

	// for eval only: the mapping whose taint determined the resolved value, and whether it stems from a function category
	const winner = roleTaints.find(entry => entry.taint.equals(value));
	return { value, role: winner?.role, category: winner?.category, record: winner?.record ?? unmapped, suppressDefault: winner?.suppressDefault };
}

type ResolveContext<Domain extends AnyAbstractDomain> = {
	call:       DataflowGraphVertexFunctionCall,
	domain:     Domain,
	dfg:        DataflowGraph,
	ctx:        ReadOnlyFlowrAnalyzerContext,
	projectArg: (id: NodeId) => Domain | undefined,
	inputs:     NodeId[]
};

function resolveMappingToTaint<Domain extends AnyAbstractDomain>(
	mapping: TaintMapping<Domain> | undefined,
	context: ResolveContext<Domain>,
	provenance: TaintRuleProvenance
): Domain | undefined {
	if(!mapping) {
		return undefined;
	}
	if('taint' in mapping) {
		return context.domain.create(mapping.taint);
	}
	const resultingTaint = resolveTaintCondition(mapping, context, provenance);
	return resultingTaint === undefined ? undefined : context.domain.create(resultingTaint);
}

function resolveTaintCondition<Domain extends AnyAbstractDomain>(
	mapping: TaintConditionMapping<Domain>,
	{ call, dfg, ctx, domain, projectArg, inputs }: ResolveContext<Domain>,
	provenance: TaintRuleProvenance
) {
	const allArgs = dfg.idMap !== undefined ? getVertexArguments(call, dfg.idMap) : [];

	const resolveInfo: ResolveInfo = { graph: dfg, idMap: dfg.idMap, full: true, resolve: VariableResolve.Alias, ctx: ctx };
	const valArgs = mapping.condition.argValues
		? mapping.condition.argValues.map(location => getArgumentValue(allArgs, location, resolveInfo))
		: [];

	const { argSignature, argDefinition, allArgs: everyArg } = mapping.condition;
	const taintIds: (NodeId | undefined)[] = argSignature !== undefined
		? taintIdsFromSignature(dfg, call.id, argSignature)
		: taintIdsFromDef(allArgs, resolveInfo, call.name, argDefinition);
	if(everyArg) {
		taintIds.push(...allArgs.map(arg => arg === EmptyArgument ? undefined : arg.value?.info.id));
	}

	const argumentValueIds = (mapping.condition.argValues ?? []).map(location => {
		const arg = getFunctionArgument(allArgs, location, resolveInfo);
		return arg === undefined || arg === EmptyArgument ? undefined : arg.value?.info.id;
	});
	inputs.push(...[...taintIds, ...argumentValueIds].filter(id => !isUndefined(id)));

	const incomingTaints = taintIds
		.map(id => isUndefined(id) ? domain.top() : projectArg(id))
		.map((value) => isUndefined(value) ? domain.top() : value);

	return mapping.condition.conditionFn(valArgs, incomingTaints as unknown as TaintConditionDomain<Domain>[], provenance);
}

function taintIdsFromSignature(dfg: DataflowGraph, id: NodeId, argTaintSig: NonNullable<TaintCondition['argSignature']>): NodeId[] {
	const vertex = dfg.getVertex(id);
	return DfgVertex.isFunctionCall(vertex) ? MatchArgs.findWithProps(vertex.args, argTaintSig.sig, argTaintSig.props) : [];
}

function taintIdsFromDef(allArgs: readonly PotentiallyEmptyRArgument<ParentInformation>[], resolveInfo: ResolveInfo, name: Identifier, argTaints: TaintParameterLocation[] | undefined) {
	return (argTaints ?? []).map(location => {
		const arg = getFunctionArgument(allArgs, location, resolveInfo);
		if(isUndefined(arg)) {
			taintLogger.warn(`Could not determine function argument for function call to ${Identifier.getName(name)}: Requested taint at position ${location.pos} with name ${location.name}`);
			return undefined;
		}
		return arg === EmptyArgument || !arg.value?.info ? undefined : arg.value.info.id;
	});
}
