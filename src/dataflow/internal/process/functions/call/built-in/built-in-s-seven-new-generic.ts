import type { DataflowProcessorInformation } from '../../../../../processor';
import type { DataflowInformation } from '../../../../../info';
import { processKnownFunctionCall } from '../known-call-handling';
import type { AstIdMap, ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { PotentiallyEmptyRArgument, RFunctionCall } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { resolveFunctionArgument } from './built-in-apply';
import type { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { dataflowLogger } from '../../../../../logger';
import { convertFnArguments } from '../common';
import { RArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { EdgeType } from '../../../../../graph/edge';
import { RType } from '../../../../../../r-bridge/lang-4.x/ast/model/type';
import { RoleInParent } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/role';
import type { RFunctionDefinition } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
import { isNotUndefined } from '../../../../../../util/assert';
import type { RParameter } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-parameter';
import { Identifier, ReferenceType } from '../../../../../environments/identifier';
import { Resolve } from '../../../../../environments/resolve-helper';
import { NodeValue } from '../../../../../eval/resolve/node-value';
import { VertexType, DfgVertex } from '../../../../../graph/vertex';
import { SourceRange } from '../../../../../../util/range';
import { BuiltInProcName } from '../../../../../environments/built-in-proc-name';
import type { ClassDeclarationConfig } from '../../../../../fn/class-declaration';
import { linkS4Declaration, linkS4Generic } from './built-in-s-four';
import { argForImpl } from '../../../../../fn/class-declaration';
import { FunctionSemantics } from '../../../../../fn/function-semantics';


/** e.g. new_generic(name, dispatch_args, fun=NULL) */
interface S7GenericDispatchConfig {
	args: {
		name:        string,
		dispatchArg: string | undefined,
		fun:         string
	},
	/** the call binds the generic under the name it is given, as `setGeneric` does (S7 hands its generic back instead) */
	binds?: boolean
}

/**
 * Process an S7 new generic dispatch call like `new_generic` or `setGeneric`.
 */
export function processS7NewGeneric<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
	config: S7GenericDispatchConfig
): DataflowInformation {
	if(args.length < 1) {
		dataflowLogger.warn('empty s7 new_generic, skipping');
		return processKnownFunctionCall({ name, args, rootId, data, origin: 'default' }).information;
	}
	const { dispatchArg } = config.args;
	const argMaps = FunctionSemantics.call.match.toSpec(convertFnArguments(args), {
		[config.args.name]: 'name',
		...dispatchArg ? { [dispatchArg]: 'dispatchArg' } : {},
		[config.args.fun]:  'fun',
		'...':              '...'
	});
	const argNamed = (formal: 'name' | 'dispatchArg' | 'fun') => RArgument.valueOf(RArgument.getWithId(args, argMaps.get(formal)?.[0]));
	const genName = argNamed('name');
	if(!genName) {
		return processKnownFunctionCall({ name, args, rootId, data, origin: 'default' }).information;
	}
	const accessedIdentifiers = NodeValue.knownStringsOf(genName.info.id, data);
	if(accessedIdentifiers.length === 0) {
		dataflowLogger.warn('s7 new_generic non-resolvable skipping');
		return processKnownFunctionCall({ name, args, rootId, data, origin: 'default' }).information;
	}
	data = { ...data, currentS7name: accessedIdentifiers } as DataflowProcessorInformation<OtherInfo & ParentInformation>;

	let funArg = argNamed('fun')?.info.id;
	const effectiveArgs = args.slice();
	if(!funArg) {
		const [fun, funId] = makeS7DispatchFDef<OtherInfo>(name, [argNamed('dispatchArg')?.lexeme], rootId, args.length, data.completeAst.idMap);
		effectiveArgs.push(fun);
		funArg = funId;
	}
	const info = processKnownFunctionCall({ name, sig: FunctionSemantics.call.signature.every, args: effectiveArgs, rootId, data, origin: BuiltInProcName.S7NewGeneric }).information;

	info.graph.addEdge(rootId, funArg, EdgeType.Returns);
	info.entryPoint = funArg;
	const fArg = info.graph.getVertex(funArg);
	if(DfgVertex.isFunctionDefinition(fArg)) {
		fArg.mode ??= ['s4', 's7'];
	}
	if(config.binds) {
		linkS4Generic(info, rootId, accessedIdentifiers, data);
	}
	return info;
}

/**
 * Process a call that **returns a function**: S7/S4 constructor factories (`make_constructor`, `new_class`,
 * `setClass`) and generic function factories (`Negate`, `Vectorize`, `partial`, ...). We model the result as a
 * synthetic function definition so the assigned symbol is recognized as a **function** rather than a plain
 * constant.
 */
export function processMakeConstructor<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
	config?: {
		readonly mode?:      readonly ('s7' | 's3' | 's4')[],
		readonly wrapIndex?: number,
		readonly wrapName?:  string,
		/** what the call declares about a class, see {@link classDeclarationOfImpl} */
		readonly classDecl?: ClassDeclarationConfig
	}
): DataflowInformation {
	// synthesise `function(...) S7_dispatch()` and make the call return it
	const [funArg, funId] = makeS7DispatchFDef<OtherInfo>(name, [], rootId, args.length, data.completeAst.idMap);
	const info = processKnownFunctionCall({ name, sig: FunctionSemantics.call.signature.every, args: [...args, funArg], rootId, data, origin: BuiltInProcName.S7MakeConstructor }).information;
	info.graph.addEdge(rootId, funId, EdgeType.Returns);
	info.entryPoint = funId;
	const fArg = info.graph.getVertex(funId);
	if(DfgVertex.isFunctionDefinition(fArg) && config?.mode) {
		/* a copy, as the mode is mutated in place later and config.mode is shared */
		fArg.mode ??= config.mode.slice();
	}
	if(config?.wrapIndex !== undefined) {
		linkWrappedFunction(info, args, rootId, config.wrapIndex, config.wrapName, data);
	}
	attachClassDeclaration(info, rootId, args, config?.classDecl);
	linkS4Declaration(info, rootId, data);
	return info;
}

/** Records on the call vertex what a class-declaring call states, see {@link DataflowGraphVertexFunctionCall.classDecl}. */
export function attachClassDeclaration<OtherInfo>(
	info:   DataflowInformation,
	rootId: NodeId,
	args:   readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[],
	config: ClassDeclarationConfig | undefined
): void {
	const vertex = info.graph.getVertex(rootId);
	if(config !== undefined && DfgVertex.isFunctionCall(vertex)) {
		vertex.classDecl = FunctionSemantics.classes.of(config, args);
	}
}

function linkWrappedFunction<OtherInfo>(
	info: DataflowInformation,
	args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	wrapIndex: number,
	wrapName: string | undefined,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>
): void {
	const wrapped = argForImpl(args, { name: wrapName, idx: wrapIndex });
	const resolved = wrapped === undefined ? undefined : resolveFunctionArgument(wrapped, data, {});
	if(resolved === undefined) {
		return;
	}
	const body = rootId + '-s7-new-generic-fun-body';
	/* the wrapper runs what it wraps, so a call of it does what the wrapped function does */
	const targets = resolved.anonymous ? [resolved.functionId] : (Resolve.byNameAndType(resolved.functionName, data.environment, ReferenceType.Function) ?? [])
		.flatMap(d => d.type === ReferenceType.BuiltInFunction ? [d.nodeId] : (d as { value?: NodeId[] }).value ?? []);
	for(const target of targets) {
		info.graph.addEdge(body, target, EdgeType.Calls);
	}
	if(resolved.anonymous || !DfgVertex.isUse(info.graph.getVertex(resolved.functionId))) {
		return;
	}
	info.graph.updateToFunctionCall({
		tag:         VertexType.FunctionCall,
		id:          resolved.functionId,
		name:        resolved.functionName,
		args:        [],
		environment: data.environment,
		onlyBuiltin: false,
		cds:         data.cds,
		origin:      [BuiltInProcName.Function]
	});
	info.graph.addEdge(body, resolved.functionId, EdgeType.Reads | EdgeType.Calls);
}

/**
 * Node-id suffix of the `fun = function(...) S7_dispatch()` argument flowR synthesizes for S7 calls that do not
 * carry one (`new_class`, `new_generic`, ...). It stands for no argument in the source, so consumers that reason
 * about how the *code* calls a function (e.g. matching a call against a package's signature history) must skip it.
 */
export const S7SyntheticFunArgSuffix = '-s7-new-generic-fun-arg';

/** Synthesizes the argument `fun = function([dispatch_args], ...) S7_dispatch()`, returning it and the id of its value. */
function makeS7DispatchFDef<OtherInfo>(name: RSymbol<ParentInformation>, names: (string | undefined)[], rootId: NodeId, args: number, idMap: AstIdMap): [RArgument<OtherInfo & ParentInformation>, NodeId] {
	const r = name.location ?? SourceRange.invalid();
	const info = (id: NodeId, role: RoleInParent, parent: NodeId, index = 0) => (
		{ id, nest: name.info.nest, role, fullRange: r, adToks: undefined, file: name.info.file, parent, index }
	);
	const symbol = (id: NodeId, lexeme: string, role: RoleInParent, parent: NodeId, index = 0) => (
		{ type: RType.Symbol, lexeme, content: lexeme, info: info(id, role, parent, index), location: r }
	) satisfies RSymbol<ParentInformation, string>;
	const argName = symbol(rootId + '-s7-new-generic-fun-arg-name', 'fun', RoleInParent.ArgumentName, rootId);
	idMap.set(argName.info.id, argName);
	const funcName = {
		type:     RType.Symbol,
		lexeme:   'S7_dispatch',
		info:     info(rootId + '-s7-new-generic-fun-name', RoleInParent.FunctionCallName, rootId),
		location: r,
		content:  Identifier.make('S7_dispatch', 'S7'),
	} satisfies RSymbol<ParentInformation>;
	const funcBody = {
		type:         RType.FunctionCall,
		location:     r,
		lexeme:       'S7_dispatch',
		named:        true,
		functionName: funcName,
		arguments:    [],
		info:         info(rootId + '-s7-new-generic-fun-body', RoleInParent.FunctionDefinitionBody, rootId)
	} satisfies RFunctionCall<ParentInformation>;
	const fdefId = rootId + '-s7-new-generic-fun-fdef';
	const argValue = {
		type:       RType.FunctionDefinition,
		info:       info(fdefId, RoleInParent.ArgumentValue, rootId, args + 1),
		lexeme:     'function',
		location:   r,
		parameters: [...names.filter(isNotUndefined), '...'].map((n, i) => {
			const paramId = fdefId + `-param-${i}`;
			const paramName = symbol(paramId + '-name', n, RoleInParent.ParameterName, paramId, i);
			const param = {
				type:         RType.Parameter,
				location:     r,
				lexeme:       n,
				name:         paramName,
				defaultValue: undefined,
				special:      n === '...',
				info:         info(paramId, RoleInParent.FunctionDefinitionParameter, fdefId, i)
			} satisfies RParameter<ParentInformation>;
			idMap.set(paramName.info.id, paramName);
			idMap.set(paramId, param);
			return param;
		}),
		body: funcBody,
	} satisfies RFunctionDefinition<ParentInformation>;
	idMap.set(funcName.info.id, funcName);
	idMap.set(funcBody.info.id, funcBody);
	idMap.set(fdefId, argValue);
	const argument: RArgument<ParentInformation> = {
		type:     RType.Argument,
		lexeme:   'fun',
		location: r,
		info:     info(rootId + S7SyntheticFunArgSuffix, RoleInParent.FunctionCallArgument, rootId, args + 1),
		name:     argName,
		value:    argValue
	};
	idMap.set(argument.info.id, argument);
	return [argument as RArgument<OtherInfo & ParentInformation>, argValue.info.id];
}
