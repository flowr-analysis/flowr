import type { DataflowProcessorInformation } from '../../../../../processor';
import type { DataflowInformation } from '../../../../../info';
import { processKnownFunctionCall } from '../known-call-handling';
import type { AstIdMap, ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import {
	type RFunctionArgument,
	type RFunctionCall
} from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { dataflowLogger } from '../../../../../logger';
import { invertArgumentMap, pMatch } from '../../../../linker';
import { convertFnArguments } from '../common';
import { unpackArg } from '../argument/unpack-argument';
import type { RArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { getArgumentWithId } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { BuiltInProcName } from '../../../../../environments/built-in';
import { EdgeType } from '../../../../../graph/edge';
import { RType } from '../../../../../../r-bridge/lang-4.x/ast/model/type';
import { RoleInParent } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/role';
import type { RFunctionDefinition } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
import { isNotUndefined } from '../../../../../../util/assert';
import type { RParameter } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-parameter';
import { Identifier } from '../../../../../environments/identifier';
import { resolveIdToValue } from '../../../../../eval/resolve/alias-tracking';
import { isValue } from '../../../../../eval/values/r-value';
import { VertexType } from '../../../../../graph/vertex';
import { SourceRange } from '../../../../../../util/range';

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
	args: readonly RFunctionArgument<OtherInfo & ParentInformation>[],
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
	const argMaps = invertArgumentMap(pMatch(convertFnArguments(args), params));
	const genName = unpackArg(getArgumentWithId(args, argMaps.get('name')?.[0]));
	if(!genName) {
		return processKnownFunctionCall({ name, args, rootId, data, origin: 'default' }).information;
	}
	const n = resolveIdToValue(genName.info.id, { environment: data.environment, resolve: data.ctx.config.solver.variables, idMap: data.completeAst.idMap, full: true, ctx: data.ctx });
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

	let funArg = unpackArg(getArgumentWithId(args, argMaps.get('fun')?.[0]))?.info.id;
	const effectiveArgs = args.slice();
	if(!funArg) {
		const dispatchArg = unpackArg(getArgumentWithId(args, argMaps.get('dispatchArg')?.[0]));
		const newFun: [RArgument<OtherInfo & ParentInformation>, NodeId] = makeS7DispatchFDef(name, [dispatchArg?.lexeme ?? undefined], rootId, args.length, data.completeAst.idMap);
		// fake it 'function([dispatch_args],...) S7_dispatch()'
		effectiveArgs.push(newFun[0]);
		funArg = newFun[1];
	}
	const info = processKnownFunctionCall({ name, forceArgs: 'all', args: effectiveArgs, rootId, data, origin: BuiltInProcName.S7NewGeneric }).information;

	info.graph.addEdge(rootId, funArg, EdgeType.Returns);
	info.entryPoint = funArg;
	const fArg = info.graph.getVertex(funArg);
	if(fArg?.tag === VertexType.FunctionDefinition) {
		fArg.mode ??= ['s4', 's7'];
	}
	return info;
}

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
			nesting:   name.info.nesting,
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
			nesting:   name.info.nesting,
			role:      RoleInParent.FunctionCallName,
			fullRange: r,
			adToks:    undefined,
			file:      name.info.file,
			parent:    rootId,
			index:     0
		},
		location: r,
		content:  Identifier.make('S7_dispatch', 's7'),
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
			nesting:   name.info.nesting,
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
			nesting:   name.info.nesting,
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
					nesting:   name.info.nesting,
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
					nesting:   name.info.nesting,
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
	const argId = rootId + '-s7-new-generic-fun-arg';
	const argument: RArgument<ParentInformation> = {
		type:     RType.Argument,
		lexeme:   'fun',
		location: r,
		info:     {
			id:        argId,
			nesting:   name.info.nesting,
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