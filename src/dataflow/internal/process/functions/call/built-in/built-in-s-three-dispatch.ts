import type { DataflowProcessorInformation } from '../../../../../processor';
import { FunctionSemantics } from '../../../../../fn/function-semantics';
import { processDataflowFor } from '../../../../../processor';
import { DataflowInformation } from '../../../../../info';
import { processKnownFunctionCall } from '../known-call-handling';
import type { ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { PotentiallyEmptyRArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { dataflowLogger } from '../../../../../logger';
import { convertFnArguments, patchFunctionCall } from '../common';
import { unpackArg } from '../argument/unpack-argument';
import { NodeValue } from '../../../../../eval/resolve/node-value';
import { EdgeType } from '../../../../../graph/edge';
import { ReferenceType } from '../../../../../environments/identifier';
import { RType } from '../../../../../../r-bridge/lang-4.x/ast/model/type';
import { SourceRange } from '../../../../../../util/range';
import { RArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { BuiltInProcName } from '../../../../../environments/built-in-proc-name';
import { ControlFlow } from '../../../../control-flow';
import { RNode } from '../../../../../../r-bridge/lang-4.x/ast/model/model';
import { RFunctionDefinition } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';


/** e.g. UseMethod(generic, object) */
interface S3DispatchConfig {
	args: {
		generic: string,
		object:  string
	},
	/** For NextMethod/if `generic` is not given, try to infer from the closure? */
	inferFromClosure?: boolean
}

/** Process an S3 dispatch call like `UseMethod`. */
export function processS3Dispatch<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
	config: S3DispatchConfig
): DataflowInformation {
	if(args.length === 0 && !config.inferFromClosure) {
		dataflowLogger.warn('empty s3, skipping');
		return processKnownFunctionCall({ name, args, rootId, data, origin: 'default' }).information;
	}

	const argMaps = FunctionSemantics.call.match.toSpec(convertFnArguments(args), {
		[config.args.generic]: 'generic',
		[config.args.object]:  'object',
		'...':                 '...'
	});
	const generic = unpackArg(RArgument.getWithId(args, argMaps.get('generic')?.[0]));
	if(!generic && !config.inferFromClosure) {
		return processKnownFunctionCall({ name, args, rootId, data, origin: 'default' }).information;
	}
	const obj = unpackArg(RArgument.getWithId(args, argMaps.get('object')?.[0]));
	const dfObj = obj ? processDataflowFor(obj, data) : DataflowInformation.initialize(rootId, data);
	const fnRef = { nodeId: rootId, name: name.content, cds: data.cds, type: ReferenceType.Function };

	if(ControlFlow.alwaysExits(dfObj, data.cds)) {
		patchFunctionCall({
			nextGraph:             dfObj.graph,
			rootId,
			name,
			data,
			argumentProcessResult: [dfObj],
			origin:                BuiltInProcName.S3Dispatch
		});
		return dfObj;
	}

	if(!generic) {
		patchFunctionCall({
			nextGraph:             dfObj.graph,
			rootId,
			name,
			data,
			argumentProcessResult: [dfObj],
			origin:                BuiltInProcName.S3DispatchNext
		});
		/* the next method receives the current values of the formals of the method it is called from */
		const idMap = data.completeAst.idMap;
		const enclosing = idMap.get(RNode.findEnclosing(rootId, idMap, RFunctionDefinition.is) ?? rootId);
		const formals = RFunctionDefinition.is(enclosing) ? enclosing.parameters : [];
		const formalReads = formals.map(param => ({ nodeId: rootId, name: param.name.content, cds: data.cds, type: ReferenceType.Variable }));
		return {
			hooks:             dfObj.hooks,
			environment:       dfObj.environment,
			exitPoints:        dfObj.exitPoints,
			graph:             dfObj.graph,
			entryPoint:        rootId,
			cfgEntry:          ControlFlow.inSequence(dfObj.graph, [dfObj], rootId),
			cfgExit:           rootId,
			in:                [...dfObj.in, ...dfObj.unknownReferences, fnRef, ...formalReads],
			out:               dfObj.out,
			unknownReferences: []
		};
	}

	const accessedIdentifiers = NodeValue.knownStringsOf(generic.info.id, data);
	if(accessedIdentifiers.length === 0) {
		dataflowLogger.warn('s3 dispatch with non-resolvable generic, skipping');
		return processKnownFunctionCall({ name, args, rootId, data, origin: 'default' }).information;
	}
	const dfGeneric = processDataflowFor(generic, data);
	const symbol: RSymbol<OtherInfo & ParentInformation> = {
		type:     RType.Symbol,
		info:     generic.info,
		content:  accessedIdentifiers[0],
		lexeme:   accessedIdentifiers[0],
		location: generic.location ?? SourceRange.invalid()
	};

	patchFunctionCall({
		nextGraph:             dfGeneric.graph,
		rootId:                generic.info.id,
		name:                  symbol,
		data,
		argumentProcessResult: [], // arguments will be attached by the accompanying enveloping function definition
		origin:                BuiltInProcName.S3Dispatch
	});

	patchFunctionCall({
		nextGraph:             dfGeneric.graph,
		rootId,
		name,
		data,
		argumentProcessResult: [dfGeneric, dfObj],
		origin:                BuiltInProcName.Function
	});
	/* the method runs only as the dispatch does */
	dfGeneric.graph.addEdge(generic.info.id, rootId, EdgeType.Reads);

	const graph = dfObj.graph.mergeWith(dfGeneric.graph);
	const methodPrefixes = accessedIdentifiers.map(id => ({ nodeId: generic.info.id, name: id, cds: data.cds, type: ReferenceType.S3MethodPrefix }));
	return {
		hooks:             dfGeneric.hooks.concat(dfObj.hooks),
		environment:       dfGeneric.environment,
		exitPoints:        dfObj.exitPoints.concat(dfGeneric.exitPoints),
		graph,
		entryPoint:        rootId,
		cfgEntry:          ControlFlow.inSequence(graph, [dfGeneric, dfObj], rootId),
		cfgExit:           rootId,
		in:                [...dfObj.in, ...dfGeneric.in, ...dfObj.unknownReferences, ...dfGeneric.unknownReferences, fnRef, ...methodPrefixes],
		out:               dfGeneric.out.concat(dfObj.out),
		unknownReferences: []
	};
}
