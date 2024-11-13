import type { DataflowProcessorInformation } from '../../../../../processor';
import type { DataflowInformation } from '../../../../../info';
import { guard } from '../../../../../../util/assert';
import type { ProcessKnownFunctionCallResult } from '../known-call-handling';
import { processKnownFunctionCall } from '../known-call-handling';
import type { ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { RFunctionArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { EmptyArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { dataflowLogger } from '../../../../../logger';
import { RType } from '../../../../../../r-bridge/lang-4.x/ast/model/type';
import { EdgeType } from '../../../../../graph/edge';
import { makeAllMaybe, makeReferenceMaybe } from '../../../../../environments/environment';
import type { ForceArguments } from '../common';
import { BuiltIn } from '../../../../../environments/built-in';
import { markAsAssignment } from './built-in-assignment';
import { ReferenceType } from '../../../../../environments/identifier';
import type { InGraphIdentifierDefinition } from '../../../../../environments/identifier';
import { resolveByName } from '../../../../../environments/resolve-by-name';
import type { ContainerIndex, ContainerIndices } from '../../../../../graph/vertex';

interface TableAssignmentProcessorMarker {
	definitionRootNodes: NodeId[]
}

function tableAssignmentProcessor<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly RFunctionArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
	outInfo: TableAssignmentProcessorMarker
): DataflowInformation {
	outInfo.definitionRootNodes.push(rootId);
	return processKnownFunctionCall({ name, args, rootId, data }).information;
}

/**
 * Processes different types of access operations.
 * 
 * Example:
 * ```r
 * a[i]
 * a$foo
 * a[[i]]
 * a@foo
 * ```
 */
export function processAccess<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly RFunctionArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
	config: { treatIndicesAsString: boolean } & ForceArguments
): DataflowInformation {
	if(args.length < 2) {
		dataflowLogger.warn(`Access ${name.content} has less than 2 arguments, skipping`);
		return processKnownFunctionCall({ name, args, rootId, data, forceArgs: config.forceArgs }).information;
	}
	const head = args[0];
	guard(head !== EmptyArgument, () => `Access ${name.content} has no source, impossible!`);

	let fnCall: ProcessKnownFunctionCallResult;
	if(!config.treatIndicesAsString) {
		/* within an access operation which treats its fields, we redefine the table assignment ':=' as a trigger if this is to be treated as a definition */
		// do we have a local definition that needs to be recovered?
		const existing = data.environment.current.memory.get(':=');
		const outInfo = { definitionRootNodes: [] };
		data.environment.current.memory.set(':=', [{
			type:                ReferenceType.BuiltInFunction,
			definedAt:           BuiltIn,
			controlDependencies: undefined,
			processor:           (name, args, rootId, data) => tableAssignmentProcessor(name, args, rootId, data, outInfo),
			name:                ':=',
			nodeId:              BuiltIn
		}]);
		fnCall = processKnownFunctionCall({ name, args, rootId, data, forceArgs: config.forceArgs });
		/* recover the environment */
		if(existing !== undefined) {
			data.environment.current.memory.set(':=', existing);
		}
		if(head.value && outInfo.definitionRootNodes.length > 0) {
			markAsAssignment(fnCall.information,
				{ type: ReferenceType.Variable, name: head.value.lexeme ?? '', nodeId: head.value.info.id, definedAt: rootId, controlDependencies: [] },
				outInfo.definitionRootNodes,
				rootId
			);
		}
	} else {
		const newArgs = [...args];
		// if the argument is a symbol, we convert it to a string for this perspective
		for(let i = 1; i < newArgs.length; i++) {
			const arg = newArgs[i];
			if(arg !== EmptyArgument && arg.value?.type === RType.Symbol) {
				newArgs[i] = {
					...arg,
					value: {
						type:     RType.String,
						info:     arg.value.info,
						lexeme:   arg.value.lexeme,
						location: arg.value.location,
						content:  {
							quotes: 'none',
							str:    arg.value.lexeme
						}
					}
				};
			}
		}
		// a$foo a@foo
		let accessedArgument: ContainerIndex | undefined;
		let resolvedFirstParameterIndices: ContainerIndices;
		if(newArgs[0] !== EmptyArgument) {
			const accessArg = newArgs[1] === EmptyArgument ? 'all' : newArgs[1].lexeme;
			const resolvedFirstParameter = resolveByName(newArgs[0].lexeme ?? '', data.environment);
			resolvedFirstParameter?.forEach(param => {
				const definition = param as InGraphIdentifierDefinition;
				if(definition.indices) {
					resolvedFirstParameterIndices = definition.indices;
				}
			});
			accessedArgument = resolvedFirstParameterIndices?.find(index => index.lexeme === accessArg);
		}
		
		const indices = accessedArgument === undefined ? undefined : [accessedArgument];
		fnCall = processKnownFunctionCall({ name, args: newArgs, rootId, data, forceArgs: config.forceArgs }, indices);
		if(accessedArgument !== undefined) {
			fnCall.information.graph.addEdge(name.info.id, accessedArgument.nodeId, EdgeType.Reads);
		}
	}

	const info = fnCall.information;

	info.graph.addEdge(name.info.id, fnCall.processedArguments[0]?.entryPoint ?? head.info.id, EdgeType.Returns);

	/* access always reads all of its indices */
	for(const arg of fnCall.processedArguments) {
		if(arg !== undefined) {
			info.graph.addEdge(name.info.id, arg.entryPoint, EdgeType.Reads);
		}
		/* we include the read edges to the constant arguments as well so that they are included if necessary */
	}

	return {
		...info,
		/*
		 * Keep active nodes in case of assignments etc.
		 * We make them maybe as a kind of hack.
		 * This way when using
		 * ```ts
		 * a[[1]] <- 3
		 * a[[2]] <- 4
		 * a
		 * ```
		 * the read for a will use both accesses as potential definitions and not just the last one!
		 */
		unknownReferences: makeAllMaybe(info.unknownReferences, info.graph, info.environment, false),
		entryPoint:        rootId,
		/** it is, to be precise, the accessed element we want to map to maybe */
		in:                info.in.map(ref => {
			if(ref.nodeId === head.value?.info.id) {
				return makeReferenceMaybe(ref, info.graph, info.environment, false);
			} else {
				return ref;
			}
		})
	};
}
