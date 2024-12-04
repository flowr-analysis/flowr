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
import type { ContainerIndex, ContainerIndicesCollection, ContainerParentIndex } from '../../../../../graph/vertex';
import type { RArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { RoleInParent } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/role';

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
		fnCall = processNumberBasedAccess<OtherInfo>(data, name, args, rootId, config, head);
	} else {
		fnCall = processStringBasedAccess<OtherInfo>(args, data, name, rootId, config);
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

/**
 * Processes different types of number-based access operations.
 * 
 * Example:
 * ```r
 * a[i]
 * a[[i]]
 * ```
 */
function processNumberBasedAccess<OtherInfo>(
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
	name: RSymbol<OtherInfo & ParentInformation, string>,
	args: readonly RFunctionArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	config: { treatIndicesAsString: boolean; } & ForceArguments,
	head: RArgument<OtherInfo & ParentInformation>,
) {
	const existing = data.environment.current.memory.get(':=');
	const outInfo = { definitionRootNodes: [] };
	data.environment.current.memory.set(':=', [{
		type:                ReferenceType.BuiltInFunction,
		definedAt:           BuiltIn,
		controlDependencies: undefined,
		processor:           (name, args, rootId, data) => tableAssignmentProcessor(name, args, rootId, data, outInfo),
		name:                ':=',
		nodeId:              BuiltIn,
	}]);

	const fnCall = processKnownFunctionCall({ name, args, rootId, data, forceArgs: config.forceArgs });
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
	return fnCall;
}

/**
 * Processes different types of string-based access operations.
 * 
 * Example:
 * ```r
 * a$foo
 * a@foo
 * ```
 */
function processStringBasedAccess<OtherInfo>(
	args: readonly RFunctionArgument<OtherInfo & ParentInformation>[],
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
	name: RSymbol<OtherInfo & ParentInformation, string>,
	rootId: NodeId,
	config: { treatIndicesAsString: boolean; } & ForceArguments,
) {
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

	// console.log('processing string based access of', name, newArgs);
	// element of list of list
	// accessed: type: RArgument, value: RAccess
	// access: type: RArgument, value: RString
	// list of list:
	// accessed: type: RArgument, value: RSymbol
	// access: type: RArgument, value: RString
	// element of list:
	// accessed: type: RArgument, value: RSymbol
	// access: type: RArgument, value: RString

	// if value is not symbol but access, resolve access first

	const nonEmptyArgs = newArgs.filter(arg => arg !== EmptyArgument);
	const accessedArg = nonEmptyArgs.find(arg => arg.info.role === RoleInParent.Accessed); // or just nonEmptyArgs[0] or newArgs[0]
	const accessArg = nonEmptyArgs.find(arg => arg.info.role === RoleInParent.IndexAccess); // or just nonEmptyArgs[1] or newArgs[1]
	let accessedIndicesCollection: ContainerIndicesCollection;
	if(accessArg !== undefined && accessedArg != undefined) {
		console.log('accessed', accessedArg);
		console.log('access', accessArg);
		const resolvedAccessedArg = resolveByName(accessedArg.lexeme ?? '', data.environment);
		const indicesCollection = resolvedAccessedArg?.flatMap(param => (param as InGraphIdentifierDefinition)?.indicesCollection ?? []);
		for(const indices of indicesCollection ?? []) {
			const filteredIndices = indices.indices.filter(index => index.lexeme === accessArg.lexeme);
			if(filteredIndices.length == 0) {
				continue;
			}
			accessedIndicesCollection ??= [];
			accessedIndicesCollection.push({
				indices:       filteredIndices,
				isSingleIndex: indices.isSingleIndex
			});
		}
		console.log('---------');
		console.log('resolving', resolvedAccessedArg);
		console.log('collection');
		for(const element of indicesCollection ?? []) {
			console.log(element);
		}
		console.log('accessed');
		for(const element of accessedIndicesCollection ?? []) {
			console.log(element);
		}
		console.log('---------');
	}

	const fnCall = processKnownFunctionCall({ name, args: newArgs, rootId, data, forceArgs: config.forceArgs }, accessedIndicesCollection);
	const accessedIndices = accessedIndicesCollection?.flatMap(indices => indices.indices);
	referenceIndices(accessedIndices, fnCall, name.info.id);
	return fnCall;
}

/**
 * Creates reads edges to accessed indices and sub-indices of node
 */
function referenceIndices(
	accessedIndices: ContainerIndex[] | undefined,
	fnCall: ProcessKnownFunctionCallResult,
	parentNodeId: NodeId,
) {
	for(const accessedIndex of accessedIndices ?? []) {
		fnCall.information.graph.addEdge(parentNodeId, accessedIndex.nodeId, EdgeType.Reads);
		const accessedSubIndices = (accessedIndex as ContainerParentIndex)?.subIndices ?? [];
		referenceIndices(accessedSubIndices, fnCall, accessedIndex.nodeId);
	}
}
