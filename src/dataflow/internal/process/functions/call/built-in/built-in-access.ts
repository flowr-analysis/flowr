import type { DataflowProcessorInformation } from '../../../../../processor';
import type { DataflowInformation } from '../../../../../info';
import { processKnownFunctionCall, type ProcessKnownFunctionCallResult } from '../known-call-handling';
import type { ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type {
	PotentiallyEmptyRArgument
} from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { dataflowLogger } from '../../../../../logger';
import { RType } from '../../../../../../r-bridge/lang-4.x/ast/model/type';
import { EdgeType } from '../../../../../graph/edge';
import { markAsAssignment } from './built-in-assignment';
import { Identifier, ReferenceType } from '../../../../../environments/identifier';
import { RArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { makeAllMaybe, makeReferenceMaybe } from '../../../../../environments/reference-to-maybe';
import { BuiltInProcName } from '../../../../../environments/built-in-proc-name';
import { unpackArg } from '../argument/unpack-argument';
import { resolveSymbolToEnvir } from './built-in-envir-utils';
import { resolveNodeToStackEnv, stackEnvInheritsFields } from './built-in-stack-env';
import { Resolve } from '../../../../../environments/resolve-helper';
import { RString } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-string';
import { EmptyArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';

interface TableAssignmentProcessorMarker {
	definitionRootNodes: NodeId[]
}

function tableAssignmentProcessor<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
	outInfo: TableAssignmentProcessorMarker
): DataflowInformation {
	outInfo.definitionRootNodes.push(rootId);
	return processKnownFunctionCall({ name, args, rootId, data, origin: BuiltInProcName.TableAssignment }).information;
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
	args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
	config: { treatIndicesAsString: boolean, resolveField?: boolean }
): DataflowInformation {
	if(args.length < 1) {
		dataflowLogger.warn(`Access ${Identifier.getName(name.content)} has less than 1 argument, skipping`);
		return processKnownFunctionCall({ name, args, rootId, data, origin: 'default' }).information;
	}
	const head = args[0];

	let fnCall: ProcessKnownFunctionCallResult;
	if(RArgument.isEmpty(head)) {
		// in this case we may be within a pipe
		fnCall = processKnownFunctionCall({ name, args, rootId, data, origin: BuiltInProcName.Access });
	} else if(config.treatIndicesAsString) {
		fnCall = processStringBasedAccess<OtherInfo>(args, data, name, rootId);
	} else {
		/* within an access operation which treats its fields, we redefine the table assignment ':=' as a trigger if this is to be treated as a definition */
		// do we have a local definition that needs to be recovered?
		fnCall = processNumberBasedAccess<OtherInfo>(data, name, args, rootId, head);
	}

	const info = fnCall.information;

	if(head !== EmptyArgument) {
		info.graph.addEdge(name.info.id, fnCall.processedArguments[0]?.entryPoint ?? head.info.id, EdgeType.Returns);
	}

	/* access always reads all of its indices */
	for(const arg of fnCall.processedArguments) {
		if(arg) {
			info.graph.addEdge(name.info.id, arg.entryPoint, EdgeType.Reads);
		}
		/* we include the read edges to the constant arguments as well so that they are included if necessary */
	}

	if(config.resolveField
			&& head !== EmptyArgument && head.value !== undefined
			&& args.length >= 2 && args[1] !== EmptyArgument) {
		const stackEnvState = resolveNodeToStackEnv(head.value, data);
		const envState = stackEnvState
			?? (RSymbol.is(head.value) ? resolveSymbolToEnvir(head.value.content, head.value.info.id, data)?.envDef.envState : undefined);
		if(envState) {
			const fieldNode = unpackArg(args[1]);
			const fieldName = RString.is(fieldNode) ? fieldNode.content.str : (config.treatIndicesAsString ? fieldNode?.lexeme : undefined);
			const fieldDefs = fieldName
				? (stackEnvInheritsFields(head.value) ? Resolve.byNameAndType(fieldName, envState, ReferenceType.Unknown) : envState.current.memory.get(fieldName))
				: undefined;
			for(const fd of fieldDefs ?? []) {
				info.graph.addEdge(name.info.id, fd.nodeId, EdgeType.Reads);
				if(stackEnvState === undefined && fd.type === ReferenceType.Function) {
					info.graph.addEdge(name.info.id, fd.nodeId, EdgeType.Returns);
				}
			}
		}
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
		in:                RArgument.isEmpty(head) ? info.in : info.in.map(ref => {
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
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	head: RArgument<OtherInfo & ParentInformation>,
) {
	const existing = data.environment.current.memory.get(':=');
	const outInfo = { definitionRootNodes: [] };
	const tableAssignId = NodeId.toBuiltIn(':=-table');
	data.environment.current.writableMemory.set(':=', [{
		type:      ReferenceType.BuiltInFunction,
		definedAt: tableAssignId,
		cds:       undefined,
		processor: (name, args, rootId, data) => tableAssignmentProcessor(name, args, rootId, data, outInfo),
		name:      ':=',
		nodeId:    tableAssignId
	}]);

	const fnCall = processKnownFunctionCall({ name, args, rootId, data, origin: BuiltInProcName.Access });

	/* recover the environment */
	if(existing !== undefined) {
		data.environment.current.writableMemory.set(':=', existing);
	}
	if(head.value && outInfo.definitionRootNodes.length > 0) {
		markAsAssignment(fnCall.information, { type: ReferenceType.Variable, name: head.value.lexeme ?? '', nodeId: head.value.info.id, definedAt: rootId, cds: [] },
			outInfo.definitionRootNodes,
			rootId, data
		);
	}

	return fnCall;
}


/**
 * Converts symbol arguments to string arguments within the specified range.
 */
export function symbolArgumentsToStrings<OtherInfo>(args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[], firstIndexInclusive = 1, lastIndexInclusive = args.length - 1) {
	const newArgs = args.slice();
	// if the argument is a symbol, we convert it to a string for this perspective
	for(let i = firstIndexInclusive; i <= lastIndexInclusive; i++) {
		const arg = newArgs[i];
		if(arg !== EmptyArgument && RSymbol.is(arg.value)) {
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
	return newArgs;
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
	args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[],
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
	name: RSymbol<OtherInfo & ParentInformation>,
	rootId: NodeId
) {
	return processKnownFunctionCall({
		name,
		args:   symbolArgumentsToStrings(args),
		rootId,
		data,
		origin: BuiltInProcName.Access
	});
}
