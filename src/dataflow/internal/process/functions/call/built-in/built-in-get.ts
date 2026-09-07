import type { DataflowProcessorInformation } from '../../../../../processor';
import type { DataflowInformation } from '../../../../../info';
import { processKnownFunctionCall } from '../known-call-handling';
import { unpackArg, unpackNonameArg } from '../argument/unpack-argument';
import { wrapArgumentsUnnamed } from '../argument/make-argument';
import type { ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { PotentiallyEmptyRArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { dataflowLogger } from '../../../../../logger';
import { removeRQuotes } from '../../../../../../r-bridge/retriever';
import { RType } from '../../../../../../r-bridge/lang-4.x/ast/model/type';
import { EdgeType } from '../../../../../graph/edge';
import { DfgVertex } from '../../../../../graph/vertex';
import { Identifier, ReferenceType } from '../../../../../environments/identifier';
import { BuiltInProcName } from '../../../../../environments/built-in-proc-name';
import { effectiveArgs, resolveConstantString, resolveEnvirArg } from './built-in-envir-utils';
import { SourceRange } from '../../../../../../util/range';
import { RString } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-string';
import { EmptyArgument, RFunctionCall } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { RArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { Resolve } from '../../../../../environments/resolve-helper';
import type { RNode } from '../../../../../../r-bridge/lang-4.x/ast/model/model';
import { isNotUndefined } from '../../../../../../util/assert';

/**
 * The names an expression in name position denotes: the one it folds to, or every element of a `c(...)` of such,
 * which is what `mget` is handed. Empty when a part does not fold, since reading fewer names than the call may
 * would let a definition it needs fall out of a slice.
 */
function namesDenotedBy<OtherInfo>(
	node: RNode<OtherInfo & ParentInformation>,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>
): string[] {
	const folded = resolveConstantString(node, data);
	if(folded !== undefined) {
		return [folded];
	}
	if(RFunctionCall.isNamed(node) && Identifier.getName(node.functionName.content) === 'c'
		&& Resolve.isBuiltIn(node.functionName.content, data.environment, ReferenceType.Function)) {
		const parts = node.arguments.map(arg => RArgument.isEmpty(arg) ? undefined : unpackArg(arg))
			.map(value => value !== undefined ? resolveConstantString(value, data) : undefined);
		return parts.every(isNotUndefined) ? parts : [];
	}
	return [];
}

/**
 * Processes a built-in 'get' function call.
 *
 * When an `envir` argument is present and resolves to a variable with a tracked environment
 * state (set up by `new.env()` + `assign(..., envir=...)`), the lookup is performed inside
 * that environment so that the correct definition is found and the returned {@link DataflowInformation}
 * contains the right read edges.
 */
export function processGet<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
	config: {
		/** whether the call hands back what the name is bound to; `exists` only asks whether it is bound */
		returnsValue?: boolean
	} = {}
): DataflowInformation {
	/* a piped `x` (`x |> get()`) patches in after dispatch; use effectiveArgs so this sees it in time */
	const effArgs = effectiveArgs(args, rootId, data);
	const usedPipedArg = effArgs !== args;

	/* use the custom environment for resolution when envir points to a tracked env */
	const resolution = resolveEnvirArg(effArgs, data);

	/* the first arg must name the variable(s) to retrieve */
	const firstArg = effArgs.length >= 1 ? effArgs[0] : undefined;
	const retrieve = firstArg !== undefined && firstArg !== EmptyArgument
		? unpackNonameArg(firstArg)
		: undefined;

	const targets: RSymbol<OtherInfo & ParentInformation>[] = [];
	/* set when the names had to be computed, so the expression that produced them still has to be evaluated */
	let nameExpression: PotentiallyEmptyRArgument<OtherInfo & ParentInformation> | undefined = undefined;
	if(retrieve !== undefined && RString.is(retrieve)) {
		const synthId = `${rootId}-get-name`;
		const synthSymbol: RSymbol<OtherInfo & ParentInformation> = {
			type:     RType.Symbol,
			info:     { ...retrieve.info, id: synthId },
			content:  removeRQuotes(retrieve.lexeme),
			lexeme:   retrieve.lexeme,
			location: retrieve.location
		};
		data.completeAst.idMap.set(synthId, synthSymbol);
		targets.push(synthSymbol);
	} else if(retrieve !== undefined) {
		for(const [i, resolvedName] of namesDenotedBy(retrieve, data).entries()) {
			const synthId = `${rootId}-get-name${i > 0 ? '-' + String(i) : ''}`;
			const synthSymbol: RSymbol<OtherInfo & ParentInformation> = {
				type:     RType.Symbol,
				info:     { ...retrieve.info, id: synthId },
				content:  resolvedName,
				lexeme:   resolvedName,
				location: retrieve.location ?? name.location ?? SourceRange.invalid()
			};
			data.completeAst.idMap.set(synthId, synthSymbol);
			targets.push(synthSymbol);
		}
		/* a piped name is already linked by processPipe, so don't forward it for processing again */
		if(targets.length > 0 && !usedPipedArg) {
			nameExpression = firstArg;
		}
	}

	if(targets.length === 0) {
		dataflowLogger.warn(`symbol access with ${Identifier.toString(name.content)} has no resolvable name argument, skipping`);
		// dynamic, unresolvable name: reached-but-unknown rather than dropped
		return processKnownFunctionCall({ name, args, rootId, data, origin: 'default', hasUnknownSideEffect: true }).information;
	}

	/* piped args need no slicing; otherwise the resolved name replaced args[0], so real args start at 1 */
	const remainingArgs = usedPipedArg ? args : args.slice(1);

	/* resolve in the custom environment if one was found, else the global one.
	 * Pass remaining original args (e.g. envir=e) so they appear as Use vertices in the graph. */
	const { information, processedArguments } = processKnownFunctionCall({
		name,
		args: [
			...wrapArgumentsUnnamed(targets, data.completeAst.idMap),
			...(nameExpression !== undefined ? [nameExpression] : []),
			...remainingArgs
		],
		rootId,
		data:   resolution ? resolution.envirData : data,
		origin: BuiltInProcName.Get
	});

	const named = processedArguments.slice(0, targets.length);
	const returns = config.returnsValue === false ? EdgeType.Reads : EdgeType.Returns | EdgeType.Reads;
	for(const target of named) {
		if(target) {
			information.graph.addEdge(rootId, target.entryPoint, returns);
			/* mark the fallback so an unresolved name still reports a constant origin (see constantFallback) */
			const targetVtx = information.graph.getVertex(target.entryPoint);
			if(DfgVertex.isUse(targetVtx)) {
				targetVtx.constantFallback = true;
			}
		}
	}

	/* the expression that produced the name is evaluated, so it and everything it needs stay reachable */
	const nameExpressionProcessed = nameExpression !== undefined ? processedArguments[targets.length] : undefined;
	if(nameExpressionProcessed) {
		information.graph.addEdge(rootId, nameExpressionProcessed.entryPoint, EdgeType.Reads);
	}

	if(resolution) {
		information.graph.addEdge(rootId, resolution.envirNodeId, EdgeType.Reads);
	}

	const isolatedTarget = resolution?.envirData.environment.current.builtInEnv === true;
	const readsToDrop = isolatedTarget
		? new Set(named.filter(isNotUndefined).map(t => t.entryPoint))
		: undefined;

	/* restore the caller's (global) environment so we don't leak envState upward */
	return {
		...information,
		in:          readsToDrop ? information.in.filter(({ nodeId }) => !readsToDrop.has(nodeId)) : information.in,
		environment: data.environment
	};
}
