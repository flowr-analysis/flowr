import type { DataflowProcessorInformation } from '../../../../../processor';
import type { DataflowInformation } from '../../../../../info';
import { processKnownFunctionCall } from '../known-call-handling';
import type { AstIdMap, ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type {
	PotentiallyEmptyRArgument,
	RFunctionCall
} from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { resolveFunctionArgument } from './built-in-apply';
import type { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { dataflowLogger } from '../../../../../logger';
import { pMatch } from '../../../../linker';
import { convertFnArguments } from '../common';
import { unpackArg } from '../argument/unpack-argument';
import { RArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { EdgeType } from '../../../../../graph/edge';
import { RType } from '../../../../../../r-bridge/lang-4.x/ast/model/type';
import { RoleInParent } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/role';
import type { RFunctionDefinition } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
import { isNotUndefined } from '../../../../../../util/assert';
import type { RParameter } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-parameter';
import { Identifier } from '../../../../../environments/identifier';
import { NodeValue } from '../../../../../eval/resolve/node-value';
import { isValue } from '../../../../../eval/values/r-value';
import { VertexType, UseVertex, FunctionDefinitionVertex } from '../../../../../graph/vertex';
import { SourceRange } from '../../../../../../util/range';
import { BuiltInProcName } from '../../../../../environments/built-in-proc-name';
import { EmptyArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';

/** e.g. new_generic(name, dispatch_args, fun=NULL) */
interface S7GenericDispatchConfig {
	args: {
		name:        string,
		dispatchArg: string | undefined,
		fun:         string
	}
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
	const params = {
		[config.args.name]: 'name',
	};
	if(config.args.dispatchArg) {
		params[config.args.dispatchArg] = 'dispatchArg';
	}
	params[config.args.fun] = 'fun';
	params['...'] = '...';
	const argMaps = pMatch(convertFnArguments(args), params);
	const genName = unpackArg(RArgument.getWithId(args, argMaps.get('name')?.[0]));
	if(!genName) {
		return processKnownFunctionCall({ name, args, rootId, data, origin: 'default' }).information;
	}
	const n = NodeValue.of(genName.info.id, data);
	const accessedIdentifiers: string[] = [];
	if(n.type === 'set') {
		for(const elem of n.elements) {
			if(elem.type === 'string' && isValue(elem.value)) {
				accessedIdentifiers.push(elem.value.str);
			}
		}
	}
	if(accessedIdentifiers.length === 0) {
		dataflowLogger.warn('s7 new_generic non-resolvable skipping');
		return processKnownFunctionCall({ name, args, rootId, data, origin: 'default' }).information;
	}
	data = { ...data, currentS7name: accessedIdentifiers } as DataflowProcessorInformation<OtherInfo & ParentInformation>;

	let funArg = unpackArg(RArgument.getWithId(args, argMaps.get('fun')?.[0]))?.info.id;
	const effectiveArgs = args.slice();
	if(!funArg) {
		const dispatchArg = unpackArg(RArgument.getWithId(args, argMaps.get('dispatchArg')?.[0]));
		const newFun: [RArgument<OtherInfo & ParentInformation>, NodeId] = makeS7DispatchFDef(name, [dispatchArg?.lexeme ?? undefined], rootId, args.length, data.completeAst.idMap);
		// fake it 'function([dispatch_args],...) S7_dispatch()'
		effectiveArgs.push(newFun[0]);
		funArg = newFun[1];
	}
	const info = processKnownFunctionCall({ name, forceArgs: 'all', args: effectiveArgs, rootId, data, origin: BuiltInProcName.S7NewGeneric }).information;

	info.graph.addEdge(rootId, funArg, EdgeType.Returns);
	info.entryPoint = funArg;
	const fArg = info.graph.getVertex(funArg);
	if(FunctionDefinitionVertex.is(fArg)) {
		fArg.mode ??= ['s4', 's7'];
	}
	return info;
}

/**
 * Process a call that **returns a function**: S7/S4 constructor factories (`make_constructor`, `new_class`,
 * `setClass`) and generic function factories (`Negate`, `Vectorize`, `partial`, …). We model the result as a
 * synthetic function definition so the assigned symbol is recognized as a **function** rather than a plain
 * constant.
 */
export function processMakeConstructor<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
	config?: { readonly mode?: readonly ('s7' | 's3' | 's4')[], readonly wrapIndex?: number, readonly wrapName?: string }
): DataflowInformation {
	// synthesise `function(...) S7_dispatch()` and make the call return it
	const [funArg, funId]: [RArgument<OtherInfo & ParentInformation>, NodeId] = makeS7DispatchFDef(name, [], rootId, args.length, data.completeAst.idMap);
	const info = processKnownFunctionCall({ name, forceArgs: 'all', args: [...args, funArg], rootId, data, origin: BuiltInProcName.S7MakeConstructor }).information;
	info.graph.addEdge(rootId, funId, EdgeType.Returns);
	info.entryPoint = funId;
	const fArg = info.graph.getVertex(funId);
	if(FunctionDefinitionVertex.is(fArg) && config?.mode) {
		fArg.mode ??= config.mode.slice();   // copy: mode is mutated in place later, config.mode is shared
	}
	if(config?.wrapIndex !== undefined) {
		linkWrappedFunction(info, args, config.wrapIndex, config.wrapName, data);
	}
	return info;
}

/** Mark the wrapped function of an eager higher-order wrapper (`Negate`/`Vectorize`/`partial`) as called. */
function linkWrappedFunction<OtherInfo>(
	info: DataflowInformation,
	args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[],
	wrapIndex: number,
	wrapName: string | undefined,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>
): void {
	let wrapped: PotentiallyEmptyRArgument<OtherInfo & ParentInformation> | undefined = undefined;
	if(wrapName !== undefined) {
		wrapped = args.find(a => a !== EmptyArgument && a.name?.content === wrapName);
	}
	if(wrapped === undefined) {
		let pos = 0;
		for(const a of args) {
			if(RArgument.isEmpty(a) || a.name) {
				continue;
			}
			if(pos === wrapIndex) {
				wrapped = a;
				break;
			}
			pos++;
		}
	}
	if(wrapped === undefined || RArgument.isEmpty(wrapped) || !wrapped.value) {
		return;
	}
	const resolved = resolveFunctionArgument(wrapped.value, data, {});
	if(resolved === undefined || resolved.anonymous) {
		return;
	}
	const vertex = info.graph.getVertex(resolved.functionId);
	if(!UseVertex.is(vertex)) {
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
}

/**
 * Node-id suffix of the `fun = function(...) S7_dispatch()` argument flowR synthesizes for S7 calls that do not
 * carry one (`new_class`, `new_generic`, ...). It stands for no argument in the source, so consumers that reason
 * about how the *code* calls a function (e.g. matching a call against a package's signature history) must skip it.
 */
export const S7SyntheticFunArgSuffix = '-s7-new-generic-fun-arg';

// 'function([dispatch_args],...) S7_dispatch()'; returns the value id
function makeS7DispatchFDef<OtherInfo>(name: RSymbol<ParentInformation>, names: (string | undefined)[], rootId: NodeId, args: number, idMap: AstIdMap): [RArgument<OtherInfo & ParentInformation>, NodeId] {
	const argNameId = rootId + '-s7-new-generic-fun-arg-name';
	const r = name.location ?? SourceRange.invalid();
	const argName = {
		type:    RType.Symbol,
		lexeme:  'fun',
		content: 'fun',
		info:    {
			id:        argNameId,
			nest:      name.info.nest,
			role:      RoleInParent.ArgumentName,
			fullRange: r,
			adToks:    undefined,
			file:      name.info.file,
			parent:    rootId,
			index:     0
		},
		location: r,
	} satisfies RSymbol<ParentInformation, string>;
	idMap.set(argNameId, argName);
	const funcNameId = rootId + '-s7-new-generic-fun-name';
	const funcName = {
		type:   RType.Symbol,
		lexeme: 'S7_dispatch',
		info:   {
			id:        funcNameId,
			nest:      name.info.nest,
			role:      RoleInParent.FunctionCallName,
			fullRange: r,
			adToks:    undefined,
			file:      name.info.file,
			parent:    rootId,
			index:     0
		},
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
		info:         {
			id:        rootId + '-s7-new-generic-fun-body',
			nest:      name.info.nest,
			role:      RoleInParent.FunctionDefinitionBody,
			fullRange: r,
			adToks:    undefined,
			file:      name.info.file,
			parent:    rootId,
			index:     0
		}
	} satisfies RFunctionCall<ParentInformation>;
	const fdefId = rootId + '-s7-new-generic-fun-fdef';
	const argValue = {
		type: RType.FunctionDefinition,
		info: {
			file:      name.info.file,
			id:        fdefId,
			nest:      name.info.nest,
			role:      RoleInParent.ArgumentValue,
			parent:    rootId,
			index:     args + 1,
			adToks:    undefined,
			fullRange: r,
		},
		lexeme:     'function',
		location:   r,
		parameters: [...names.filter(isNotUndefined), '...'].map((n, i) => {
			const paramId = fdefId + `-param-${i}`;
			const paramNameId = paramId + '-name';
			const paramName = {
				type:    RType.Symbol,
				lexeme:  n,
				content: n,
				info:    {
					id:        paramNameId,
					nest:      name.info.nest,
					role:      RoleInParent.ParameterName,
					fullRange: r,
					adToks:    undefined,
					file:      name.info.file,
					index:     i,
					parent:    paramId
				},
				location: r,
			} satisfies RSymbol<ParentInformation, string>;
			const param = {
				type:         RType.Parameter,
				location:     r,
				lexeme:       n,
				name:         paramName,
				defaultValue: undefined,
				special:      n === '...',
				info:         {
					id:        paramId,
					nest:      name.info.nest,
					role:      RoleInParent.FunctionDefinitionParameter,
					parent:    fdefId,
					index:     i,
					adToks:    undefined,
					file:      name.info.file,
					fullRange: r,
				}
			} satisfies RParameter<ParentInformation>;
			idMap.set(paramNameId, paramName);
			idMap.set(paramId, param);
			return param;
		}),
		body: funcBody,
	} satisfies RFunctionDefinition<ParentInformation>;
	idMap.set(funcNameId, funcName);
	idMap.set(funcBody.info.id, funcBody);
	idMap.set(fdefId, argValue);
	const argId = rootId + S7SyntheticFunArgSuffix;
	const argument: RArgument<ParentInformation> = {
		type:     RType.Argument,
		lexeme:   'fun',
		location: r,
		info:     {
			id:        argId,
			nest:      name.info.nest,
			role:      RoleInParent.FunctionCallArgument,
			fullRange: r,
			adToks:    undefined,
			file:      name.info.file,
			parent:    rootId,
			index:     args + 1
		},
		name:  argName,
		value: argValue
	};
	idMap.set(argument.info.id, argument);
	return [argument as RArgument<OtherInfo & ParentInformation>, argValue.info.id];
}