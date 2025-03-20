import type { DataflowProcessorInformation } from '../../../../../processor';
import type { DataflowInformation } from '../../../../../info';
import { processKnownFunctionCall } from '../known-call-handling';
import type { RFunctionArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { EmptyArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { MergeableRecord } from '../../../../../../util/objects';
import { dataflowLogger } from '../../../../../logger';
import { RType } from '../../../../../../r-bridge/lang-4.x/ast/model/type';
import { VertexType } from '../../../../../graph/vertex';
import type { FunctionArgument } from '../../../../../graph/graph';
import { EdgeType } from '../../../../../graph/edge';
import { ReferenceType } from '../../../../../environments/identifier';
import { resolveValueOfVariable } from '../../../../../environments/resolve-by-name';
import { UnnamedFunctionCallPrefix } from '../unnamed-call-handling';

export interface BuiltInApplyConfiguration extends MergeableRecord {
	/** the 0-based index of the argument which is the actual function passed, defaults to 1 */
	readonly indexOfFunction?:        number
	/** does the argument have a name that it can be given by as well? */
	readonly nameOfFunctionArgument?: string
	/** Should we unquote the function if it is given as a string? */
	readonly unquoteFunction?:        boolean
	/** Should the function be resolved in the global environment? */
	readonly resolveInEnvironment:    'global' | 'local'
	/** Should the value of the function be resolved? */
	readonly resolveValue?:           boolean
}

export function processApply<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly RFunctionArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
	{ indexOfFunction = 1, nameOfFunctionArgument, unquoteFunction, resolveInEnvironment, resolveValue }: BuiltInApplyConfiguration
): DataflowInformation {
	/* as the length is one-based and the argument filter mapping is zero-based, we do not have to subtract 1 */
	const forceArgsMask = new Array(indexOfFunction).fill(false);
	forceArgsMask.push(true);
	const resFn = processKnownFunctionCall({
		name, args, rootId, data, forceArgs: forceArgsMask
	});
	let information = resFn.information;
	const processedArguments = resFn.processedArguments;

	let index = indexOfFunction;
	/* search, if one of the arguments actually contains the argument name if given in the config */
	if(nameOfFunctionArgument !== undefined) {
		const mayFn = args.findIndex(arg => arg !== EmptyArgument && arg.name && arg.name.content === nameOfFunctionArgument);
		if(mayFn >= 0) {
			index = mayFn;
		}
	}


	/* validate, that we indeed have so many arguments to fill this one :D */
	if(index >= args.length) {
		dataflowLogger.warn(`Function argument at index ${index} not found, skipping`);
		return information;
	}

	const arg = args[index];

	if(arg === EmptyArgument || !arg.value || (!unquoteFunction && arg.value.type !== RType.Symbol && arg.value.type !== RType.FunctionDefinition)) {
		dataflowLogger.warn(`Expected symbol as argument at index ${index}, but got ${JSON.stringify(arg)} instead.`);
		return information;
	}

	let functionId: NodeId | undefined = undefined;
	let functionName: string | undefined = undefined;
	let anonymous: boolean = false;

	const val = arg.value;
	if(unquoteFunction && val.type === RType.String) {
		functionId = val.info.id;
		functionName = val.content.str;
		information = {
			...information,
			in: [...information.in, { type: ReferenceType.Function, name: functionName, controlDependencies: data.controlDependencies, nodeId: functionId }]
		};
	} else if(val.type === RType.Symbol) {
		functionId = val.info.id;
		if(resolveValue) {
			const resolved = resolveValueOfVariable(val.content, data.environment);
			if(resolved?.length === 1 && typeof resolved[0] === 'string') {
				functionName = resolved[0];
			}
		} else {
			functionName = val.content;
		}
	} else if(val.type === RType.FunctionDefinition) {
		anonymous = true;
		functionId = val.info.id;
		functionName = `${UnnamedFunctionCallPrefix}${functionId}`;
	}

	if(functionName === undefined || functionId === undefined) {
		dataflowLogger.warn(`Expected symbol or string as function argument at index ${index}, but got ${JSON.stringify(val)} instead.`);
		return information;
	}

	const allOtherArguments: FunctionArgument[] = processedArguments.filter((_, i) => i !== index).map((arg, i) => {
		const counterpart = args[i];
		if(arg && counterpart !== EmptyArgument && counterpart.name) {
			return {
				name:                counterpart.name.content,
				controlDependencies: data.controlDependencies,
				type:                ReferenceType.Argument,
				nodeId:              arg.entryPoint
			};
		} else {
			return EmptyArgument;
		}
	});

	if(anonymous) {
		const rootId = functionId;
		functionId = 'anon-' + rootId;
		information.graph.addVertex({
			tag:         VertexType.FunctionCall,
			id:          functionId,
			environment: data.environment,
			name:        functionName,
			/* can never be a direct built-in-call */
			onlyBuiltin: false,
			cds:         data.controlDependencies,
			args:        allOtherArguments // same reference
		});
		information.graph.addEdge(functionId, rootId, EdgeType.Calls | EdgeType.Reads);
		information = {
			...information,
			in:         [...information.in, { type: ReferenceType.Function, name: functionName, controlDependencies: data.controlDependencies, nodeId: functionId }],
			entryPoint: functionId
		};
	} else {
		/* identify it as a full-blown function call :) */
		information.graph.updateToFunctionCall({
			tag:         VertexType.FunctionCall,
			id:          functionId,
			name:        functionName,
			args:        allOtherArguments,
			environment: resolveInEnvironment === 'global' ? undefined : data.environment,
			onlyBuiltin: resolveInEnvironment === 'global',
			cds:         data.controlDependencies
		});
	}


	for(const arg of processedArguments) {
		if(arg) {
			information.graph.addEdge(functionId, arg.entryPoint, EdgeType.Argument);
		}
	}

	if(resolveInEnvironment === 'global') {
		// remove from open ingoing references
		return {
			...information,
			in:                information.in.filter(ref => ref.nodeId !== functionId),
			unknownReferences: information.unknownReferences.filter(ref => ref.nodeId !== functionId)
		};
	} else {
		return information;
	}
}
