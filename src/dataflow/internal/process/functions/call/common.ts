import type { DataflowInformation } from '../../../../info';
import { happensInEveryBranch } from '../../../../info';
import type { DataflowProcessorInformation } from '../../../../processor';
import { processDataflowFor } from '../../../../processor';
import type { RNode } from '../../../../../r-bridge/lang-4.x/ast/model/model';
import type { ParentInformation } from '../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { RFunctionArgument } from '../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { EmptyArgument } from '../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { DataflowGraph, FunctionArgument } from '../../../../graph/graph';
import type { NodeId } from '../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { REnvironmentInformation } from '../../../../environments/environment';
import type { IdentifierReference, InGraphIdentifierDefinition } from '../../../../environments/identifier';
import { isReferenceType, ReferenceType } from '../../../../environments/identifier';
import { overwriteEnvironment } from '../../../../environments/overwrite';
import { resolveByName } from '../../../../environments/resolve-by-name';
import { RType } from '../../../../../r-bridge/lang-4.x/ast/model/type';
import type {
	ContainerIndicesCollection,
	DataflowGraphVertexAstLink,
	DataflowGraphVertexFunctionDefinition,
	FunctionOriginInformation
} from '../../../../graph/vertex';
import { isFunctionDefinitionVertex, VertexType } from '../../../../graph/vertex';
import type { RSymbol } from '../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import { EdgeType } from '../../../../graph/edge';

export interface ForceArguments {
	/** which of the arguments should be forced? this may be all, e.g., if the function itself is unknown on encounter */
	readonly forceArgs?: 'all' | readonly boolean[]
}

export interface ProcessAllArgumentInput<OtherInfo> extends ForceArguments {
	readonly functionName:   DataflowInformation
	readonly args:           readonly (RNode<OtherInfo & ParentInformation> | RFunctionArgument<OtherInfo & ParentInformation>)[]
	readonly data:           DataflowProcessorInformation<OtherInfo & ParentInformation>
	readonly finalGraph:     DataflowGraph
	readonly functionRootId: NodeId
	/* allows passing a data processor in-between each argument; cannot modify env currently */
	readonly patchData?:     (data: DataflowProcessorInformation<OtherInfo & ParentInformation>, i: number) => DataflowProcessorInformation<OtherInfo & ParentInformation>
	/** which arguments are to be marked as {@link EdgeType#NonStandardEvaluation|non-standard-evaluation}? */
	readonly markAsNSE?:     readonly number[]
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
	if(valueVertex.tag !== VertexType.Value) {
		if(valueVertex.tag === VertexType.FunctionDefinition) {
			for(const exit of valueVertex.exitPoints) {
				graph.addEdge(rootId, exit, EdgeType.Reads);
			}
		} else {
			for(const exit of value.exitPoints) {
				graph.addEdge(rootId, exit.nodeId, EdgeType.Reads);
			}
		}
	}
	const containedSubflowIn: readonly DataflowGraphVertexFunctionDefinition[] = [...graph.vertices(true)]
		.filter(([, info]) => isFunctionDefinitionVertex(info))
		.flatMap(([, info]) => (info as DataflowGraphVertexFunctionDefinition));

	// try to resolve them against the current environment
	for(const ref of [...value.in, ...containedSubflowIn.flatMap(n => n.subflow.in)]) {
		if(ref.name) {
			const resolved = ref.name ? resolveByName(ref.name, env, ref.type) ?? [] : [];
			for(const resolve of resolved) {
				graph.addEdge(ref.nodeId, resolve.nodeId, EdgeType.Reads);
			}
		}
	}
}


export function processAllArguments<OtherInfo>(
	{ functionName, args, data, finalGraph, functionRootId, forceArgs = [], patchData = d => d }: ProcessAllArgumentInput<OtherInfo>,
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
		data = patchData(data, i);
		if(arg === EmptyArgument) {
			callArgs.push(EmptyArgument);
			processedArguments.push(undefined);
			continue;
		}

		const processed = processDataflowFor(arg, { ...data, environment: argEnv });
		if(arg.type === RType.Argument && arg.value && (forceArgs === 'all' || forceArgs[i]) && arg.value.type !== RType.Number && arg.value.type !== RType.String && arg.value.type !== RType.Logical) {
			forceVertexArgumentValueReferences(functionRootId, processed, processed.graph, argEnv);
		}
		processedArguments.push(processed);

		finalEnv = overwriteEnvironment(finalEnv, processed.environment);
		finalGraph.mergeWith(processed.graph);

		// resolve reads within argument, we resolve before adding the `processed.environment` to avoid cyclic dependencies
		for(const ingoing of [...processed.in, ...processed.unknownReferences]) {
			// check if it is called directly
			const vtx = finalGraph.getVertex(ingoing.nodeId);

			const tryToResolve = ingoing.name ? resolveByName(ingoing.name, argEnv, vtx?.tag === VertexType.FunctionCall ? ReferenceType.Function : ReferenceType.Unknown) : undefined;
			if(tryToResolve === undefined) {
				remainingReadInArgs.push(ingoing);
			} else {
				/* maybe all targets are not definitely of the current scope and should be still kept */
				let assumeItMayHaveAHigherTarget = true;
				for(const resolved of tryToResolve) {
					if(happensInEveryBranch(resolved.controlDependencies) && !isReferenceType(resolved.type, ReferenceType.BuiltInFunction | ReferenceType.BuiltInConstant)) {
						assumeItMayHaveAHigherTarget = false;
					}
					// When only a single index is referenced, we don't need to reference the whole object
					const resolvedInGraphDef = resolved as InGraphIdentifierDefinition;
					const isContainer = checkForContainer(resolvedInGraphDef?.indicesCollection);
					if(isContainer !== false) {
						finalGraph.addEdge(ingoing.nodeId, resolved.nodeId, EdgeType.Reads);
					}
				}
				if(assumeItMayHaveAHigherTarget) {
					remainingReadInArgs.push(ingoing);
				}
			}
		}
		argEnv = overwriteEnvironment(argEnv, processed.environment);


		if(arg.type !== RType.Argument || !arg.name) {
			callArgs.push({ nodeId: processed.entryPoint, controlDependencies: undefined, type: ReferenceType.Argument });
		} else {
			callArgs.push({ nodeId: processed.entryPoint, name: arg.name.content, controlDependencies: undefined, type: ReferenceType.Argument });
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
		cds:         data.controlDependencies,
		args:        argumentProcessResult.map(arg => arg === undefined ? EmptyArgument : { nodeId: arg.entryPoint, controlDependencies: undefined, call: undefined, type: ReferenceType.Argument }),
		origin:      [origin],
		link
	}, !nextGraph.hasVertex(rootId) || nextGraph.isRoot(rootId), true);
	for(const arg of argumentProcessResult) {
		if(arg) {
			nextGraph.addEdge(rootId, arg.entryPoint, EdgeType.Argument);
		}
	}
}

/**
 * Check whether passed {@link indices} are containers or whether their sub-indices are containers.
 */
function checkForContainer(indices: ContainerIndicesCollection): boolean | undefined {
	return indices?.every((indices) => {
		const areSubIndicesContainers = indices.indices.every(index => 'subIndices' in index && checkForContainer(index.subIndices));
		return indices.isContainer || areSubIndicesContainers;
	});
}
