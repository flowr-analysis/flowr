import type { DataflowProcessorInformation } from '../../../../../processor';
import type { DataflowInformation } from '../../../../../info';
import { processKnownFunctionCall } from '../known-call-handling';
import { guard } from '../../../../../../util/assert';
import { unpackNonameArg } from '../argument/unpack-argument';
import type { RFunctionArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import { RNode } from '../../../../../../r-bridge/lang-4.x/ast/model/model';
import type { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { dataflowLogger } from '../../../../../logger';
import { RType } from '../../../../../../r-bridge/lang-4.x/ast/model/type';
import { VertexType } from '../../../../../graph/vertex';
import { EdgeType } from '../../../../../graph/edge';
import { Identifier, ReferenceType } from '../../../../../environments/identifier';
import { toUnnamedArgument } from '../argument/make-argument';
import { processAssignment, type AssignmentConfiguration } from './built-in-assignment';
import type { BrandedIdentifier } from '../../../../../environments/identifier';
import { BuiltInProcName } from '../../../../../environments/built-in-proc-name';
import { log } from '../../../../../../util/log';

/**
 * Configuration options for the basic R pipe
 */
interface PipeConfiguration {
	pipePlaceholderName: BrandedIdentifier;
	/**
	 * this is for a pipe like `%<>%` which assigns its lhs
	 */
	assignLhs:           boolean;
	/**
	 * Whether to return the lhs (e.g., with the TPipe)
	 */
	returnLhs:           boolean;
	/**
	 * If so, also allow a symbol instead of a function as rhs, if it is the case, this automatically converts the symbol on the rhs to a function call
	 */
	rhsMightBeSymbol?:   boolean;
}


/**
 * Support for R's pipe functions like `|>` or magrittr's `%>%`
 */
export function processPipe<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly RFunctionArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
	{ pipePlaceholderName, assignLhs, returnLhs, rhsMightBeSymbol = false }: PipeConfiguration
): DataflowInformation {
	const fCallInfo = processKnownFunctionCall({ name, args, rootId, data, origin: BuiltInProcName.Pipe });
	const processedArguments = fCallInfo.processedArguments;
	let information = fCallInfo.information;
	if(args.length !== 2) {
		dataflowLogger.warn(`Pipe ${Identifier.toString(name.content)} has something else than 2 arguments, skipping`);
		return information;
	}

	const [lhs, rhs] = args.map(e => unpackNonameArg(e));

	guard(lhs !== undefined && rhs !== undefined, () => `lhs and rhs must be present, but ${JSON.stringify(lhs)} and ${JSON.stringify(rhs)} were found instead.`);


	// If this is an assigning pipe (e.g., %<>%), perform the assignment writeback using the built-in
	// assignment processor: target <- source where target is the original lhs and source is the rhs call
	if(assignLhs) {
		// create unnamed args for target and source
		const targetArg = toUnnamedArgument(lhs, data.completeAst.idMap);
		const sourceArg = toUnnamedArgument(rhs, data.completeAst.idMap);
		// construct a synthetic symbol for the assignment operator '<-'
		const assignSym = {
			type:     RType.Symbol,
			info:     name.info,
			content:  Identifier.make('<-', 'base'),
			lexeme:   '<-',
			location: name.location
		} as RSymbol<OtherInfo & ParentInformation>;

		information = processAssignment(assignSym, [targetArg, sourceArg], rootId, data, {} as AssignmentConfiguration);
	}

	let treatedAsFunctionCall = false;
	if(rhs.type === RType.Symbol && rhsMightBeSymbol) {
		// convert a plain symbol on the RHS into a function-call vertex so we can treat it like `df %>% head`
		const maybeVertex = information.graph.getVertex(rhs.info.id);
		if(maybeVertex && maybeVertex.tag === VertexType.Use) {
			information.graph.updateToFunctionCall({
				tag:         VertexType.FunctionCall,
				id:          rhs.info.id,
				name:        rhs.content,
				args:        [],
				environment: data.environment,
				onlyBuiltin: false,
				cds:         data.cds,
				origin:      [BuiltInProcName.Function]
			});
			treatedAsFunctionCall = true;
		}
	}

	if(treatedAsFunctionCall || rhs.type === RType.FunctionCall) {
		const functionCallNode = information.graph.getVertex(rhs.info.id);
		guard(functionCallNode?.tag === VertexType.FunctionCall, () => `Expected function call node with id ${rhs.info.id} to be a function call node, but got ${functionCallNode?.tag} instead.`);

		// make the lhs an argument node (or link it to placeholders within the rhs call):
		const argId = lhs.info.id;

		// find all symbol occurrences inside the rhs function call AST that match the placeholder name
		const occurrenceIds: NodeId[] = [];
		RNode.visitAst<OtherInfo & ParentInformation>(rhs, (node) => {
			if(node.type === RType.Symbol && node.content === pipePlaceholderName) {
				occurrenceIds.push(node.info.id);
			}
			return false;
		});

		if(occurrenceIds.length > 0) {
			if(occurrenceIds.length !== 1) {
				log.warn(`Expected exactly one occurrence of the pipe placeholder '${Identifier.toString(pipePlaceholderName)}' in the rhs of the pipe, but found ${occurrenceIds.length}. Linking all occurrences to the lhs.`);
			}
			for(const occId of occurrenceIds) {
				information.graph.addEdge(occId, argId, EdgeType.Reads);
			}
		} else {
			dataflowLogger.trace(`Linking pipe arg ${argId} as first argument of ${rhs.info.id}`);
			functionCallNode.args.unshift({
				name:   undefined,
				nodeId: argId,
				cds:    data.cds,
				type:   ReferenceType.Function
			});
			information.graph.addEdge(functionCallNode.id, argId, EdgeType.Argument | EdgeType.Reads);
		}

	} else {
		dataflowLogger.warn(`Expected rhs of pipe to be a function call, but got ${rhs.type} instead.`);
	}

	const firstArgument = processedArguments[0];

	// If requested, return the lhs value (tee/TPipe semantics): add a Returns edge to the lhs entry
	if(firstArgument && returnLhs) {
		information.graph.addEdge(rootId, firstArgument.entryPoint, EdgeType.Returns);
	} else {
		const secondArgument = processedArguments[1];
		if(secondArgument && !returnLhs) {
			information.graph.addEdge(rootId, secondArgument.entryPoint, EdgeType.Returns);
		}
	}

	const uniqueIn = information.in.slice();
	for(const ing of (firstArgument?.in ?? [])) {
		if(!uniqueIn.some(e => e.nodeId === ing.nodeId)) {
			uniqueIn.push(ing);
		}
	}
	const uniqueOut = information.out.slice();
	for(const outg of (firstArgument?.out ?? [])) {
		if(!uniqueOut.some(e => e.nodeId === outg.nodeId)) {
			uniqueOut.push(outg);
		}
	}
	const uniqueUnknownReferences = information.unknownReferences.slice();
	for(const unknown of (firstArgument?.unknownReferences ?? [])) {
		if(!uniqueUnknownReferences.some(e => e.nodeId === unknown.nodeId)) {
			uniqueUnknownReferences.push(unknown);
		}
	}


	return {
		...information,
		in:                uniqueIn,
		out:               uniqueOut,
		unknownReferences: uniqueUnknownReferences,
		entryPoint:        rootId
	};
}
