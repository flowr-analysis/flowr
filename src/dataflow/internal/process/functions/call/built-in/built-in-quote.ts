import type { DataflowProcessorInformation } from '../../../../../processor';
import type { DataflowInformation } from '../../../../../info';
import { markArgumentsAsNonStandardEvaluation, processKnownFunctionCall } from '../known-call-handling';
import type { ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { PotentiallyEmptyRArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { EmptyArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { recoverName } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { VertexType } from '../../../../../graph/vertex';
import { dataflowLogger } from '../../../../../logger';
import { Dataflow } from '../../../../../graph/df-helper';
import type { IdentifierReference } from '../../../../../environments/identifier';
import { EdgeType } from '../../../../../graph/edge';
import type { ForceArguments } from '../common';
import { BuiltInProcName } from '../../../../../environments/built-in-proc-name';
import { FunctionArgument } from '../../../../../graph/graph';
import { Nse, Unquote } from '../nse';
import { linkInputs } from '../../../../linker';

interface QuoteConfig extends ForceArguments {
	quoteArgumentsWithIndex: number
	envArgIndex?:            number
	/** which unquote escape the function supports, {@link Unquote.None} if unset */
	unquote?:                Unquote
}


/**
 * Process a call to `quote` or similar nse/substitution functions.
 */
export function processQuote<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
	config: QuoteConfig
): DataflowInformation {
	const startEnv = data.environment;
	let lastEnv = startEnv;
	const { information, processedArguments, fnRef } = processKnownFunctionCall({
		name, args, rootId, data, forceArgs: config.forceArgs, origin: BuiltInProcName.Quote,
		patchData(data: DataflowProcessorInformation<OtherInfo & ParentInformation>, index: number): DataflowProcessorInformation<OtherInfo & ParentInformation> {
			if(index === config.quoteArgumentsWithIndex) {
				lastEnv = data.environment;
				return { ...data, environment: data.ctx.env.makeCleanEnv() };
			} else {
				return { ...data, environment: lastEnv };
			}
		}
	});

	const inRefs: IdentifierReference[] = [fnRef];
	const outRefs: IdentifierReference[] = [];
	const unknownRefs: IdentifierReference[] = [];

	const quotedArg = args[config.quoteArgumentsWithIndex];
	const evaluated = Nse.unquoted(quotedArg === EmptyArgument ? undefined : quotedArg?.value, config.unquote ?? Unquote.None);

	for(let i = 0; i < args.length; i++) {
		const processedArg = processedArguments[i];
		if(processedArg && i !== config.quoteArgumentsWithIndex) {
			inRefs.push(...processedArg.in);
			outRefs.push(...processedArg.out);
			unknownRefs.push(...processedArg.unknownReferences);
		}
	}

	const quotedProcessed = processedArguments[config.quoteArgumentsWithIndex];
	if(quotedProcessed) {
		markArgumentsAsNonStandardEvaluation(information.graph, rootId, processedArguments, [config.quoteArgumentsWithIndex], { evaluated });
		if(evaluated) {
			/* the argument was processed in a clean env, so the escaped reads need linking by hand */
			const escaped = [...quotedProcessed.in, ...quotedProcessed.unknownReferences].filter(r => evaluated.has(r.nodeId));
			linkInputs(escaped, lastEnv, inRefs, information.graph, false);
		}
	}

	if(config.envArgIndex !== undefined) {
		const envProcessed = processedArguments[config.envArgIndex];
		const exprProcessed = processedArguments[config.quoteArgumentsWithIndex];
		if(envProcessed && exprProcessed) {
			applyEnvListReplacement(information, envProcessed, exprProcessed);
		}
	}

	return {
		...information,
		environment:       startEnv,
		in:                inRefs,
		out:               outRefs,
		unknownReferences: unknownRefs
	};
}

/** The uses within `expr`, by name, to match a `substitute` env list against. */
function usesByName(expr: DataflowInformation): ReadonlyMap<string, NodeId[]> {
	const useMap = new Map<string, NodeId[]>();
	for(const vType of [VertexType.Use, VertexType.FunctionCall]) {
		for(const [useId] of expr.graph.verticesOfType(vType)) {
			const rn = recoverName(useId, expr.graph.idMap);
			if(rn) {
				const arr = useMap.get(rn);
				if(arr) {
					arr.push(useId);
				} else {
					useMap.set(rn, [useId]);
				}
			}
		}
	}
	return useMap;
}

/** `substitute(expr, list(a = 1))` replaces the listed names within `expr`. */
function applyEnvListReplacement(information: DataflowInformation, env: DataflowInformation, expr: DataflowInformation): void {
	let useMap: ReadonlyMap<string, NodeId[]> | undefined = undefined;
	try {
		/* traverse the env processed DFG to find list calls (prefix-aware handling) */
		Dataflow.visitDfg(env.graph, env.entryPoint, (vtx) => {
			if(vtx.tag !== VertexType.FunctionCall) {
				return;
			}
			if(!vtx.origin.includes(BuiltInProcName.List)) {
				return true;
			}
			useMap ??= usesByName(expr);
			if(useMap.size === 0) {
				return true;
			}

			for(const field of vtx.args.filter(FunctionArgument.isNamed)) {
				for(const useId of useMap.get(field.name) ?? []) {
					information.graph.addEdge(useId, field.nodeId, EdgeType.Reads);
				}
			}
			return true;
		});
	} catch(e) {
		dataflowLogger.warn('Failed to apply substitute-style env list replacement in quote-like call', { error: e });
	}
}
