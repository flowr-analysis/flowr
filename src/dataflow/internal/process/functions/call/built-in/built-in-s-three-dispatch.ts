import type { DataflowProcessorInformation } from '../../../../../processor';
import { FunctionSemantics } from '../../../../../fn/function-semantics';
import { processDataflowFor } from '../../../../../processor';
import { DataflowInformation } from '../../../../../info';
import { processKnownFunctionCall } from '../known-call-handling';
import type { ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { PotentiallyEmptyRArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { dataflowLogger } from '../../../../../logger';
import { convertFnArguments, patchFunctionCall } from '../common';
import { NodeValue } from '../../../../../eval/resolve/node-value';
import { EdgeType } from '../../../../../graph/edge';
import { type BrandedIdentifier, Identifier, type IdentifierReference, ReferenceType } from '../../../../../environments/identifier';
import { RType } from '../../../../../../r-bridge/lang-4.x/ast/model/type';
import { SourceRange } from '../../../../../../util/range';
import { RArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { BuiltInProcName } from '../../../../../environments/built-in-proc-name';
import { ControlFlow } from '../../../../control-flow';
import { RNode } from '../../../../../../r-bridge/lang-4.x/ast/model/model';
import { RFunctionDefinition } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
import { DotsParameterName } from '../../../../../../util/arg-matching';


/** e.g. UseMethod(generic, object) */
interface S3DispatchConfig {
	/** absent for a next-method call (`callNextMethod(...)`, `NextMethod(...)`) */
	args?: {
		generic: BrandedIdentifier,
		object:  string
	},
	/** the call hands on to the next method of the dispatch running the function it is in (`NextMethod`): it continues along the class vector of that dispatch, so neither the generic nor the object it names changes what runs (only in a function called directly does it dispatch the generic it names) */
	next?:         boolean
	/** the call evaluates the formals of the function it is in to pick a method by their classes (`standardGeneric`) */
	readsFormals?: boolean
}

/** Process an S3 dispatch call like `UseMethod`. */
export function processS3Dispatch<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
	config: S3DispatchConfig
): DataflowInformation {
	if(config.readsFormals) {
		const info = processKnownFunctionCall({ name, args, rootId, data, origin: 'default' }).information;
		return { ...info, in: [...info.in, ...formalReads(rootId, data).filter(r => r.name !== DotsParameterName)] };
	}
	if(config.args === undefined) {
		const info = processKnownFunctionCall({ name, args, rootId, data, origin: BuiltInProcName.S3DispatchNext }).information;
		return args.length > 0 && !config.next ? info : { ...info, in: [...info.in, ...formalReads(rootId, data)] };
	}
	if(args.length === 0) {
		dataflowLogger.warn('empty s3, skipping');
		return processKnownFunctionCall({ name, args, rootId, data, origin: 'default' }).information;
	}

	const argMaps = FunctionSemantics.call.match.toSpec(convertFnArguments(args), {
		[config.args.generic]: 'generic',
		[config.args.object]:  'object',
		'...':                 '...'
	});
	const generic = RArgument.valueOf(RArgument.getWithId(args, argMaps.get('generic')?.[0]));
	if(!generic) {
		return processKnownFunctionCall({ name, args, rootId, data, origin: 'default' }).information;
	}
	const obj = RArgument.valueOf(RArgument.getWithId(args, argMaps.get('object')?.[0]));
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

	/* in `g <- "p"; f <- function(x) UseMethod(g)` the generic is the value of `g` where `f` is defined */
	const accessedIdentifiers = NodeValue.knownStringsOf(generic.info.id, data);
	if(accessedIdentifiers.length === 0 && RSymbol.is(generic)) {
		const bound = data.environment.current.lookupLexically(Identifier.getName(generic.content)) ?? [];
		accessedIdentifiers.push(...bound.flatMap(d => d.type === ReferenceType.BuiltInConstant || d.type === ReferenceType.BuiltInFunction ? [] : d.value ?? []).flatMap(value => NodeValue.knownStringsOf(value, data)));
	}
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

/** the next method receives the current values of the formals of the method it is called from */
function formalReads<OtherInfo>(rootId: NodeId, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): IdentifierReference[] {
	const idMap = data.completeAst.idMap;
	const enclosing = idMap.get(RNode.findEnclosing(rootId, idMap, RFunctionDefinition.is) ?? rootId);
	const formals = RFunctionDefinition.is(enclosing) ? enclosing.parameters : [];
	return formals.map(param => ({ nodeId: rootId, name: param.name.content, cds: data.cds, type: ReferenceType.Variable }));
}
