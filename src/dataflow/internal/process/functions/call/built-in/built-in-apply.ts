import type { DataflowProcessorInformation } from '../../../../../processor';
import { FnSig } from '../../../../../environments/built-in-props';
import type { DataflowInformation } from '../../../../../info';
import { processKnownFunctionCall } from '../known-call-handling';
import {
	EmptyArgument,
	type PotentiallyEmptyRArgument
} from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { MergeableRecord } from '../../../../../../util/objects';
import { dataflowLogger } from '../../../../../logger';
import { VertexType, FunctionDefinitionVertex } from '../../../../../graph/vertex';
import type { FunctionArgument } from '../../../../../graph/graph';
import { EdgeType } from '../../../../../graph/edge';
import { handleUnknownSideEffect } from '../../../../../graph/unknown-side-effect';
import {
	type Identifier,
	ReferenceType
} from '../../../../../environments/identifier';
import { UnnamedFunctionCallPrefix } from '../unnamed-call-handling';
import { ClosureRefs } from '../../../../linker';
import { NodeValue } from '../../../../../eval/resolve/node-value';
import { RString } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-string';
import { BuiltInProcName } from '../../../../../environments/built-in-proc-name';
import type { RNode } from '../../../../../../r-bridge/lang-4.x/ast/model/model';
import { RArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { RFunctionDefinition } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';

/** the function reference extracted from an argument passed to a higher-order call */
export interface ResolvedFunctionArgument {
	readonly functionId:   NodeId
	readonly functionName: Identifier
	readonly anonymous:    boolean
	readonly asString:     boolean
}

/** Resolve the function an argument stands for: a string literal, a symbol, or an inline definition; `undefined` if none. */
export function resolveFunctionArgument<OtherInfo>(
	val:  RNode<OtherInfo & ParentInformation>,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
	opts: { readonly unquoteFunction?: boolean, readonly resolveValue?: boolean }
): ResolvedFunctionArgument | undefined {
	if(opts.unquoteFunction && RString.is(val)) {
		return { functionId: val.info.id, functionName: val.content.str, anonymous: false, asString: true };
	}
	if(RFunctionDefinition.is(val)) {
		return { functionId: val.info.id, functionName: `${UnnamedFunctionCallPrefix}${val.info.id}`, anonymous: true, asString: false };
	}
	if(!RSymbol.is(val)) {
		return undefined;
	}
	const functionName = opts.resolveValue
		? NodeValue.singleStringOf(val.info.id, data)
		: val.content;
	return functionName === undefined ? undefined : { functionId: val.info.id, functionName, anonymous: false, asString: false };
}

export interface BuiltInApplyConfiguration extends MergeableRecord {
	/** the 0-based index of the argument which is the actual function passed, defaults to 1 */
	readonly indexOfFunction?:        number
	/** does the argument have a name that it can be given by as well? */
	readonly nameOfFunctionArgument?: string
	/** Should we unquote the function if it is given as a string? */
	readonly unquoteFunction?:        boolean
	/** Should the function be resolved in the global environment? */
	readonly resolveInEnvironment?:   'global' | 'local'
	/** Should the value of the function be resolved? */
	readonly resolveValue?:           boolean
	/** the call reaches beyond what we can see even when the callee resolves, like `rlang::exec` */
	readonly hasUnknownSideEffects?:  boolean
}

/**
 * Process an apply call like `vapply` or `mapply`.
 */
export function processApply<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
	config: BuiltInApplyConfiguration
): DataflowInformation {
	const { indexOfFunction = 1, nameOfFunctionArgument, unquoteFunction, resolveInEnvironment, resolveValue, hasUnknownSideEffects } = config;
	/* the length is one-based and the argument mapping zero-based, so the function sits at `indexOfFunction` */
	const resFn = processKnownFunctionCall({
		name, args, rootId, data, sig: FnSig.only(indexOfFunction, nameOfFunctionArgument ?? 'FUN'), origin: BuiltInProcName.Apply
	});
	let information = resFn.information;
	if(hasUnknownSideEffects) {
		handleUnknownSideEffect(information.graph, information.environment, rootId);
	}
	const processedArguments = resFn.processedArguments;

	let index = indexOfFunction;
	/* search, if one of the arguments actually contains the argument name if given in the config */
	if(nameOfFunctionArgument !== undefined) {
		const mayFn = args.findIndex(arg => arg !== EmptyArgument && arg.name?.content === nameOfFunctionArgument);
		if(mayFn >= 0) {
			index = mayFn;
		}
	}
	// shift the index to point to the index'd unnamed argument
	let posArgsFound = 0;
	for(let i = 0; i < args.length; i++) {
		const arg = args[i];
		if(arg !== EmptyArgument && arg.name) {
			// do nothing
		} else if(posArgsFound === index) {
			index = i;
			break;
		} else {
			posArgsFound++;
		}
	}

	/* validate, that we indeed have so many arguments to fill this one :D */
	if(index >= args.length) {
		dataflowLogger.warn(`Function argument at index ${index} not found, skipping`);
		return information;
	}

	const arg = args[index];

	if(RArgument.isEmpty(arg) || !arg.value || (!unquoteFunction && !RSymbol.is(arg.value) && !RFunctionDefinition.is(arg.value))) {
		dataflowLogger.warn(`Expected symbol as argument at index ${index}, but got ${JSON.stringify(arg)} instead.`);
		handleUnknownSideEffect(information.graph, information.environment, rootId);
		return information;
	}

	const val = arg.value;
	const resolvedFn = resolveFunctionArgument(val, data, { unquoteFunction, resolveValue });
	if(resolvedFn === undefined) {
		dataflowLogger.warn(`Expected symbol or string as function argument at index ${index}, but got ${JSON.stringify(val)} instead.`);
		// the called function is dynamic and unresolvable: reached-but-unknown rather than dropped
		handleUnknownSideEffect(information.graph, information.environment, rootId);
		return information;
	}
	const { functionName, anonymous, asString } = resolvedFn;
	let functionId: NodeId = resolvedFn.functionId;
	if(asString) {
		information.in = [...information.in, { type: ReferenceType.Function, name: functionName, cds: data.cds, nodeId: functionId }];
	}

	const allOtherArguments: FunctionArgument[] = processedArguments.map((arg, i) => {
		const counterpart = args[i];
		if(arg && counterpart !== EmptyArgument) {
			return {
				name:    counterpart.name?.content,
				valueId: counterpart.value?.info.id,
				cds:     data.cds,
				type:    ReferenceType.Argument,
				nodeId:  arg.entryPoint
			};
		} else {
			return EmptyArgument;
		}
	}).filter((_, i) => i !== index);

	if(anonymous) {
		const rootFnId = functionId;
		functionId = 'anon-' + rootFnId;
		information.graph.addVertex({
			tag:         VertexType.FunctionCall,
			id:          functionId,
			environment: data.environment,
			name:        functionName,
			/* can never be a direct built-in-call */
			onlyBuiltin: false,
			cds:         data.cds,
			args:        allOtherArguments, // same reference
			origin:      [BuiltInProcName.Function]
		}, data.ctx.env.cleanEnv);
		information.graph.addEdge(rootId, rootFnId, EdgeType.Calls | EdgeType.Reads);
		information.graph.addEdge(rootId, functionId, EdgeType.Calls | EdgeType.Argument);
		information = {
			...information,
			in: [
				...information.in,
				{ type: ReferenceType.Function, name: functionName, cds: data.cds, nodeId: functionId }
			]
		};
		const dfVert = information.graph.getVertex(rootId);
		if(dfVert && FunctionDefinitionVertex.is(dfVert)) {
			ClosureRefs.resolveOpenIngoing(information.graph, rootId, dfVert, data.environment);
		}
	} else {
		/* identify it as a full-blown function call :) */
		information.graph.updateToFunctionCall({
			tag:         VertexType.FunctionCall,
			id:          functionId,
			name:        functionName,
			args:        allOtherArguments,
			environment: resolveInEnvironment === 'global' ? undefined : data.environment,
			onlyBuiltin: resolveInEnvironment === 'global',
			cds:         data.cds,
			origin:      [BuiltInProcName.Function]
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
