import type { DataflowProcessorInformation } from '../../../../../processor';
import type { DataflowInformation } from '../../../../../info';
import { initializeCleanDataflowInformation } from '../../../../../info';
import { processKnownFunctionCall } from '../known-call-handling';
import { expensiveTrace } from '../../../../../../util/log';
import { processAssignment } from './built-in-assignment';
import type { ForceArguments } from '../common';
import { processAllArguments } from '../common';
import { guard } from '../../../../../../util/assert';
import type { ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import { type RFunctionArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { dataflowLogger } from '../../../../../logger';
import type { ContainerIndices, ContainerIndicesCollection, ContainerLeafIndex, IndexIdentifier } from '../../../../../graph/vertex';
import { VertexType } from '../../../../../graph/vertex';
import { getReferenceOfArgument } from '../../../../../graph/graph';
import { EdgeType } from '../../../../../graph/edge';
import { graphToMermaidUrl } from '../../../../../../util/mermaid/dfg';
import { RType } from '../../../../../../r-bridge/lang-4.x/ast/model/type';
import { constructNestedAccess, getAccessOperands } from '../../../../../../util/containers';
import { getConfig } from '../../../../../../config';
import type { RArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import type { RNode } from '../../../../../../r-bridge/lang-4.x/ast/model/model';

export function processReplacementFunction<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	/** The last one has to be the value */
	args: readonly RFunctionArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
	config: { makeMaybe?: boolean, assignmentOperator?: '<-' | '<<-' } & ForceArguments
): DataflowInformation {
	if(args.length < 2) {
		dataflowLogger.warn(`Replacement ${name.content} has less than 2 arguments, skipping`);
		return processKnownFunctionCall({ name, args, rootId, data }).information;
	}

	/* we only get here if <-, <<-, ... or whatever is part of the replacement is not overwritten */
	expensiveTrace(dataflowLogger, () => `Replacement ${name.content} with ${JSON.stringify(args)}, processing`);

	let indices: ContainerIndicesCollection = undefined;
	if(getConfig().solver.pointerTracking) {
		indices = constructAccessedIndices<OtherInfo>(name.content, args);
	}

	/* we assign the first argument by the last for now and maybe mark as maybe!, we can keep the symbol as we now know we have an assignment */
	const res = processAssignment(
		name,
		[args[0], args[args.length - 1]],
		rootId,
		data,
		{
			superAssignment:   config.assignmentOperator === '<<-',
			makeMaybe:         indices !== undefined ? false : config.makeMaybe,
			indicesCollection: indices
		}
	);

	/* now, we soft-inject other arguments, so that calls like `x[y] <- 3` are linked correctly */
	const { callArgs } = processAllArguments({
		functionName:   initializeCleanDataflowInformation(rootId, data),
		args:           args.slice(1, -1),
		data,
		functionRootId: rootId,
		finalGraph:     res.graph,
		forceArgs:      config.forceArgs,
	});
	const fn = res.graph.getVertex(rootId, true);
	guard(fn?.tag === VertexType.FunctionCall && fn.args.length === 2,
		() => `Function ${rootId} not found in graph or not 2-arg fn-call (${JSON.stringify(fn)}) ${graphToMermaidUrl(res.graph)}`
	);
	fn.args = [fn.args[0], ...callArgs, fn.args[1]];

	/* a replacement reads all of its call args as well, at least as far as I am aware of */
	for(const arg of callArgs) {
		const ref = getReferenceOfArgument(arg);
		if(ref !== undefined) {
			res.graph.addEdge(rootId, ref, EdgeType.Reads);
		}
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
 * 
 * @param operation - Operation of replacement function e.g. '$\<-', '[\<-', '[[\<-' 
 * @param args - Arguments of the replacement function
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
	const isNameBasedAccess = operation === '$<-' && value.type === RType.Symbol;
	const isNumericalIndexBasedAccess = (operation === '[[<-' || operation === '[<-') && value.type === RType.Number;
	return isNameBasedAccess || isNumericalIndexBasedAccess;
}

function getIdentifierBuilder<OtherInfo>(
	operation: string,
): (arg: RArgument<OtherInfo & ParentInformation>) => IndexIdentifier  {
	if(operation === '$<-') {
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
