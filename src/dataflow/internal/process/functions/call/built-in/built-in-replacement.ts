import type { DataflowProcessorInformation } from '../../../../../processor';
import { type DataflowInformation, initializeCleanDataflowInformation } from '../../../../../info';
import { processKnownFunctionCall } from '../known-call-handling';
import { expensiveTrace } from '../../../../../../util/log';
import { type ForceArguments, patchFunctionCall, processAllArguments } from '../common';
import type { ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import {
	EmptyArgument,
	type RFunctionArgument
} from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { dataflowLogger } from '../../../../../logger';
import { type DataflowGraphVertexInfo ,
	type ContainerIndices,
	type ContainerIndicesCollection,
	type ContainerLeafIndex,
	type IndexIdentifier,
	VertexType
} from '../../../../../graph/vertex';
import { getReferenceOfArgument } from '../../../../../graph/graph';
import { EdgeType } from '../../../../../graph/edge';
import { RType } from '../../../../../../r-bridge/lang-4.x/ast/model/type';
import { constructNestedAccess, getAccessOperands } from '../../../../../../util/containers';
import type { RArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import type { RNode } from '../../../../../../r-bridge/lang-4.x/ast/model/model';
import { unpackArg, unpackNonameArg } from '../argument/unpack-argument';
import { symbolArgumentsToStrings } from './built-in-access';
import { BuiltInProcessorMapper, BuiltInProcName } from '../../../../../environments/built-in';
import { ReferenceType } from '../../../../../environments/identifier';
import { handleReplacementOperator } from '../../../../../graph/unknown-replacement';
import type { DeepWritable } from 'ts-essentials';


/**
 * Process a replacement function call like `<-`, `[[<-`, `$<-`, etc.
 * These are automatically created when doing assignments like `x[y] <- value` or in general `fun(x) <- value` will call `fun<- (x, value)`.
 */
export function processReplacementFunction<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	/** The last one has to be the value */
	args: readonly RFunctionArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
	config: { makeMaybe?: boolean, assignmentOperator?: '<-' | '<<-', readIndices?: boolean, activeIndices?: ContainerIndicesCollection, assignRootId?: NodeId } & ForceArguments
): DataflowInformation {
	if(args.length < 2) {
		dataflowLogger.warn(`Replacement ${name.content} has less than 2 arguments, skipping`);
		return processKnownFunctionCall({ name, args, rootId, data, origin: 'default' }).information;
	}

	/* we only get here if <-, <<-, ... or whatever is part of the replacement is not overwritten */
	expensiveTrace(dataflowLogger, () => `Replacement ${name.content} with ${JSON.stringify(args)}, processing`);

	let indices: ContainerIndicesCollection = config.activeIndices;
	if(data.ctx.config.solver.pointerTracking) {
		indices ??= constructAccessedIndices<OtherInfo>(name.content, args);
	}

	/* we assign the first argument by the last for now and maybe mark as maybe!, we can keep the symbol as we now know we have an assignment */
	let res = BuiltInProcessorMapper[BuiltInProcName.Assignment](
		name,
		[args[0], args.at(-1) as RFunctionArgument<OtherInfo & ParentInformation>],
		rootId,
		data,
		{
			superAssignment:   config.assignmentOperator === '<<-',
			makeMaybe:         indices === undefined ? config.makeMaybe : false,
			indicesCollection: indices,
			canBeReplacement:  true
		}
	);

	const createdVert = res.graph.getVertex(rootId);
	if(createdVert?.tag === VertexType.FunctionCall) {
		createdVert.origin = [BuiltInProcName.Replacement];
	}
	const targetVert = res.graph.getVertex(unpackArg(args[0])?.info.id as NodeId);
	if(targetVert?.tag === VertexType.VariableDefinition) {
		(targetVert as DeepWritable<DataflowGraphVertexInfo>).par = true;
	}

	const convertedArgs = config.readIndices ? args.slice(1, -1) : symbolArgumentsToStrings(args.slice(1, -1), 0);

	/* now, we soft-inject other arguments, so that calls like `x[y] <- 3` are linked correctly */
	const { callArgs } = processAllArguments({
		functionName:   initializeCleanDataflowInformation(rootId, data),
		args:           convertedArgs,
		data,
		functionRootId: rootId,
		finalGraph:     res.graph,
		forceArgs:      config.forceArgs,
	});

	patchFunctionCall({
		nextGraph: res.graph,
		data,
		rootId,
		name,
		argumentProcessResult:
			args.map(a => a === EmptyArgument ? undefined : { entryPoint: unpackNonameArg(a)?.info.id as NodeId }),
		origin: BuiltInProcName.Replacement,
		link:   config.assignRootId ? { origin: [config.assignRootId] } : undefined
	});

	const firstArg = unpackNonameArg(args[0]);

	handleReplacementOperator({
		operator: name.content,
		target:   firstArg?.lexeme,
		env:      res.environment,
		id:       rootId
	});

	if(firstArg) {
		res.graph.addEdge(
			firstArg.info.id,
			rootId,
			EdgeType.DefinedBy | EdgeType.Reads
		);
	}

	/* a replacement reads all of its call args as well, at least as far as I am aware of */
	for(const arg of callArgs) {
		const ref = getReferenceOfArgument(arg);
		if(ref !== undefined) {
			res.graph.addEdge(rootId, ref, EdgeType.Reads);
		}
	}


	const fa = unpackNonameArg(args[0]);
	if(!data.ctx.config.solver.pointerTracking && fa) {
		res = {
			...res,
			in: [...res.in, { name: fa.lexeme, type: ReferenceType.Variable, nodeId: fa.info.id, cds: data.cds }]
		};
	}

	return res;
}

/**
 * Constructs accessed indices of replacement function recursively.
 *
 * Example:
 * ```r
 * a$b <- 1
 * # results in index with lexeme b as identifier
 *
 * a[[1]]$b
 * # results in index with index 1 as identifier with a sub-index with lexeme b as identifier
 * ```
 * @param operation - Operation of replacement function e.g. '$\<-', '[\<-', '[[\<-'
 * @param args      - Arguments of the replacement function
 * @returns Accessed indices construct
 */
function constructAccessedIndices<OtherInfo>(
	operation: string,
	args: readonly RFunctionArgument<OtherInfo & ParentInformation>[]
): ContainerIndicesCollection {
	const { accessedArg, accessArg } = getAccessOperands(args);

	if(accessedArg === undefined || accessArg?.value === undefined || !isSupportedOperation(operation, accessArg.value)) {
		return undefined;
	}

	const constructIdentifier = getIdentifierBuilder(operation);

	const leafIndex: ContainerLeafIndex = {
		identifier: constructIdentifier(accessArg),
		nodeId:     accessedArg.info.parent ?? ''
	};
	const accessIndices: ContainerIndices = {
		indices:     [leafIndex],
		isContainer: false
	};

	// Check for nested access
	let indicesCollection: ContainerIndicesCollection = undefined;
	if(accessedArg.value?.type === RType.Access) {
		indicesCollection = constructNestedAccess(accessedArg.value, accessIndices, constructIdentifier);
	} else {
		// use access node as reference to get complete line in slice
		indicesCollection = [accessIndices];
	}

	return indicesCollection;
}

function isSupportedOperation<OtherInfo>(operation: string, value: RNode<OtherInfo & ParentInformation>) {
	const isNameBasedAccess = (operation === '$<-' || operation === '@<-') && value.type === RType.Symbol;
	const isNumericalIndexBasedAccess = (operation === '[[<-' || operation === '[<-') && value.type === RType.Number;
	return isNameBasedAccess || isNumericalIndexBasedAccess;
}

function getIdentifierBuilder<OtherInfo>(
	operation: string,
): (arg: RArgument<OtherInfo & ParentInformation>) => IndexIdentifier  {
	if(operation === '$<-' || operation == '@<-') {
		return (arg) => {
			return {
				index:  undefined,
				lexeme: arg.lexeme,
			};
		};
	}

	// [[<- and [<-
	return (arg) => {
		return {
			index: Number(arg.lexeme),
		};
	};
}
