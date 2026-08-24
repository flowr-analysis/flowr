/**
 * Argument processing shared by the call processors.
 * Importing the `Resolve` helper here pulls the evaluator in before the built-in configuration is
 * initialized, so this file keeps the direct import.
 * @lintIgnore use-instead
 */
import { type DataflowInformation, happensInEveryBranch } from '../../../../info';
import { type DataflowProcessorInformation, processDataflowFor } from '../../../../processor';
import type { RNode } from '../../../../../r-bridge/lang-4.x/ast/model/model';
import { RConstant } from '../../../../../r-bridge/lang-4.x/ast/model/model';
import type { ParentInformation } from '../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { EmptyArgument, type PotentiallyEmptyRArgument } from '../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { DataflowGraph, FunctionArgument } from '../../../../graph/graph';
import type { NodeId } from '../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { REnvironmentInformation } from '../../../../environments/environment';
import {
	type IdentifierReference,
	isReferenceType,
	ReferenceType
} from '../../../../environments/identifier';
import { overwriteEnvironment } from '../../../../environments/overwrite';
import { resolveByName } from '../../../../environments/resolve-by-name';
import { processFunctionArgument } from '../process-argument';
import {
	type DataflowGraphVertexAstLink,
	type DataflowGraphVertexFunctionDefinition,
	type FunctionOriginInformation,
	VertexType
} from '../../../../graph/vertex';
import type { RSymbol } from '../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import { EdgeType } from '../../../../graph/edge';
import { RArgument } from '../../../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { FunctionCallVertex, ValueVertex, FunctionDefinitionVertex } from '../../../../graph/vertex';

export interface ProcessAllArgumentInput<OtherInfo> {
	/** which of the arguments the call evaluates, as {@link FnSig.forced} answers it for the signature */
	readonly forced?:        readonly boolean[]
	readonly functionName:   DataflowInformation
	readonly args:           readonly (RNode<OtherInfo & ParentInformation> | PotentiallyEmptyRArgument<OtherInfo & ParentInformation>)[]
	readonly data:           DataflowProcessorInformation<OtherInfo & ParentInformation>
	readonly finalGraph:     DataflowGraph
	readonly functionRootId: NodeId
	/* allows passing a data processor in-between each argument; cannot modify env currently */
	readonly patchData?:     (data: DataflowProcessorInformation<OtherInfo & ParentInformation>, i: number) => DataflowProcessorInformation<OtherInfo & ParentInformation>
	/** which arguments are to be marked as {@link EdgeType#NonStandardEvaluation|non-standard-evaluation}? */
	readonly markAsNSE?:     readonly number[]
	/** symbols that name data rather than code, so they must not resolve to a function of the same name */
	readonly nonFunction?:   ReadonlySet<NodeId>
}

export interface ProcessAllArgumentResult {
	readonly finalEnv:            REnvironmentInformation
	readonly callArgs:            FunctionArgument[]
	readonly remainingReadInArgs: IdentifierReference[]
	readonly processedArguments:  (DataflowInformation | undefined)[]
}

function forceVertexArgumentValueReferences(rootId: NodeId, value: DataflowInformation, graph: DataflowGraph, env: REnvironmentInformation): void {
	const valueVertex = graph.getVertex(value.entryPoint);
	if(!valueVertex) {
		return;
	}
	// link read if it is function definition directly and reference the exit point
	if(FunctionDefinitionVertex.is(valueVertex)) {
		for(const exit of valueVertex.exitPoints) {
			graph.addEdge(rootId, exit.nodeId, EdgeType.Reads);
		}
	} else if(!ValueVertex.is(valueVertex)) {
		for(const exit of value.exitPoints) {
			graph.addEdge(rootId, exit.nodeId, EdgeType.Reads);
		}
	}
	const containedSubflowIn = graph.verticesOfType(VertexType.FunctionDefinition)
		.flatMap(([, info]) => (info as DataflowGraphVertexFunctionDefinition).subflow.in);

	// try to resolve them against the current environment
	for(const l of [value.in, containedSubflowIn]) {
		for(const ref of l) {
			if(ref.name) {
				const refId = ref.nodeId;
				const resolved = resolveByName(ref.name, env, ref.type) ?? [];
				for(const resolve of resolved) {
					graph.addEdge(refId, resolve.nodeId, EdgeType.Reads);
				}
			}
		}
	}
}

/**
 * Converts function arguments into function argument references for a function call vertex.
 * Please be aware, that the ids here are those inferred from the AST, not from the dataflow graph!
 * This function also works after the arguments were unpacked, e.g., by {@link tryUnpackNoNameArg}.
 * @see convertFnArgument
 */
export function convertFnArguments<OtherInfo>(args: readonly (typeof EmptyArgument | RNode<OtherInfo & ParentInformation>)[]): FunctionArgument[] {
	return args.map(convertFnArgument);
}

/**
 * Transforms a function argument into a function argument reference for a function call vertex.
 * Please be aware, that the ids here are those inferred from the AST, not from the dataflow graph!
 */
export function convertFnArgument<OtherInfo>(this: void, arg: typeof EmptyArgument | RNode<OtherInfo & ParentInformation>): FunctionArgument {
	if(RArgument.isEmpty(arg)) {
		return EmptyArgument;
	} else if(!arg.name || !RArgument.is(arg)) {
		return { nodeId: arg.info.id, cds: undefined, type: ReferenceType.Argument };
	} else {
		return {
			nodeId:  arg.info.id,
			valueId: arg.value?.info.id,
			name:    arg.name.content,
			cds:     undefined,
			type:    ReferenceType.Argument
		};
	}
}

/**
 * Processes all arguments for a function call, updating the given final graph and environment.
 */
export function processAllArguments<OtherInfo>(
	{ functionName, args, data, finalGraph, functionRootId, forced = [], patchData, nonFunction }: ProcessAllArgumentInput<OtherInfo>,
): ProcessAllArgumentResult {
	let finalEnv = functionName.environment;
	// arg env contains the environments with other args defined
	let argEnv = functionName.environment;
	const callArgs: FunctionArgument[] = [];
	const processedArguments: (DataflowInformation | undefined)[] = [];
	const remainingReadInArgs = [];
	let i = -1;
	for(const arg of args) {
		i++;
		data = { ...data, environment: argEnv };
		data = patchData?.(data, i) ?? data;
		if(RArgument.isEmpty(arg)) {
			callArgs.push(EmptyArgument);
			processedArguments.push(undefined);
			continue;
		}

		let processed: DataflowInformation;
		if(i === 0 && data.precomputedFirstArg?.rootId === functionRootId) {
			processed = data.precomputedFirstArg.info;
		} else {
			processed = RArgument.is(arg) ? processFunctionArgument(arg, data) : processDataflowFor(arg, data);
		}
		if(RArgument.isWithValue(arg) && forced[i] && !RConstant.is(arg.value)) {
			forceVertexArgumentValueReferences(functionRootId, processed, processed.graph, data.environment);
		}
		processedArguments.push(processed);

		finalEnv = overwriteEnvironment(finalEnv, processed.environment);
		finalGraph.mergeWith(processed.graph);

		// resolve reads within argument, we resolve before adding the `processed.environment` to avoid cyclic dependencies
		for(const l of [processed.in, processed.unknownReferences]) {
			for(const original of l) {
				// check if it is called directly
				const inId = original.nodeId;
				/* a data argument holds a value, so a function of that name is not what it reads; the narrowed
				   type stays on the reference as it bubbles through the enclosing calls */
				const ingoing = nonFunction?.has(inId) ? { ...original, type: ReferenceType.NonFunction } : original;
				const refType = FunctionCallVertex.is(finalGraph.getVertex(inId)) ? ReferenceType.Function
					: ingoing.type === ReferenceType.NonFunction ? ReferenceType.NonFunction : ReferenceType.Unknown;

				const tryToResolve = ingoing.name ? resolveByName(ingoing.name, data.environment, refType) : undefined;
				if(tryToResolve === undefined) {
					remainingReadInArgs.push(ingoing);
				} else {
					/* maybe all targets are not definitely of the current scope and should be still kept */
					let assumeItMayHaveAHigherTarget = true;
					for(const resolved of tryToResolve) {
						if(isReferenceType(resolved.type, ReferenceType.BuiltInFunction | ReferenceType.BuiltInConstant)) {
							continue;
						} else if(happensInEveryBranch(resolved.cds)) {
							assumeItMayHaveAHigherTarget = false;
						}
						finalGraph.addEdge(inId, resolved.nodeId, EdgeType.Reads);
					}
					if(assumeItMayHaveAHigherTarget) {
						remainingReadInArgs.push(ingoing);
					}
				}
			}
		}
		argEnv = overwriteEnvironment(argEnv, processed.environment);

		if(!RArgument.is(arg) || !arg.name) {
			callArgs.push({ nodeId: processed.entryPoint, cds: undefined, type: ReferenceType.Argument });
		} else {
			callArgs.push({ nodeId: processed.entryPoint, valueId: arg.value?.info.id, name: arg.name.content, cds: undefined, type: ReferenceType.Argument });
		}

		finalGraph.addEdge(functionRootId, processed.entryPoint, EdgeType.Argument);
	}
	return { finalEnv, callArgs, remainingReadInArgs, processedArguments };
}

export interface PatchFunctionCallInput<OtherInfo> {
	readonly nextGraph:             DataflowGraph
	readonly rootId:                NodeId
	readonly name:                  RSymbol<OtherInfo & ParentInformation>
	readonly data:                  DataflowProcessorInformation<OtherInfo & ParentInformation>
	readonly argumentProcessResult: readonly (Pick<DataflowInformation, 'entryPoint'> | undefined)[]
	readonly origin:                FunctionOriginInformation
	readonly link?:                 DataflowGraphVertexAstLink
}

/**
 * Patches a function call vertex into the given dataflow graph.
 * This is mostly useful for built-in processors that have custom argument processing.
 * Otherwise, rely on {@link processKnownFunctionCall} instead.
 */
export function patchFunctionCall<OtherInfo>(
	{ nextGraph, rootId, name, data, argumentProcessResult, origin, link }: PatchFunctionCallInput<OtherInfo>
): void {
	nextGraph.addVertex({
		tag:         VertexType.FunctionCall,
		id:          rootId,
		name:        name.content,
		environment: data.environment,
		/* will be overwritten accordingly */
		onlyBuiltin: false,
		cds:         data.cds,
		args:        argumentProcessResult.map(arg => arg === undefined ? EmptyArgument : { nodeId: arg.entryPoint, cds: undefined, call: undefined, type: ReferenceType.Argument }),
		origin:      [origin],
		link
	}, data.ctx.env.makeCleanEnv(), !nextGraph.hasVertex(rootId) || nextGraph.isRoot(rootId), true);
	for(const arg of argumentProcessResult) {
		if(arg) {
			nextGraph.addEdge(rootId, arg.entryPoint, EdgeType.Argument);
		}
	}
}
