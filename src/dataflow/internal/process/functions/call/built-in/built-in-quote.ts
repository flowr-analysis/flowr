import { RArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import type { DataflowProcessorInformation } from '../../../../../processor';
import type { FnSig } from '../../../../../environments/built-in-props';
import { FunctionSemantics } from '../../../../../fn/function-semantics';
import type { DataflowInformation } from '../../../../../info';
import { markArgumentsAsNonStandardEvaluation, processKnownFunctionCall } from '../known-call-handling';
import type { ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { PotentiallyEmptyRArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { VertexType, DfgVertex } from '../../../../../graph/vertex';
import { dataflowLogger } from '../../../../../logger';
import { Dataflow } from '../../../../../graph/df-helper';
import type { IdentifierReference } from '../../../../../environments/identifier';
import { EdgeType } from '../../../../../graph/edge';
import { BuiltInProcName } from '../../../../../environments/built-in-proc-name';
import { FunctionArgument } from '../../../../../graph/graph';
import { Unquote } from '../nse';
import { linkInputs } from '../../../../linker';
import { REnvironment } from '../../../../../environments/environment';

interface QuoteConfig {
	quoteArgumentsWithIndex: number
	envArgIndex?:            number
	/** which unquote escape the function supports, {@link Unquote.None} if unset */
	unquote?:                Unquote
	readonly sig?:           FnSig
}

/** Process a call to `quote` or similar nse/substitution functions. */
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
		name, args, rootId, data, origin: BuiltInProcName.Quote, sig: config.sig,
		patchData(data: DataflowProcessorInformation<OtherInfo & ParentInformation>, index: number): DataflowProcessorInformation<OtherInfo & ParentInformation> {
			if(index === config.quoteArgumentsWithIndex) {
				lastEnv = data.environment;
				return { ...data, environment: cleanEnvOf(data.environment) };
			} else {
				return { ...data, environment: lastEnv };
			}
		}
	});

	const others = processedArguments.filter((p, i) => p !== undefined && i !== config.quoteArgumentsWithIndex) as DataflowInformation[];
	const inRefs: IdentifierReference[] = [fnRef, ...others.flatMap(p => p.in)];
	const quotedArg = args[config.quoteArgumentsWithIndex];
	const evaluated = FunctionSemantics.call.nse.unquoted(RArgument.valueOf(quotedArg), config.unquote ?? Unquote.None);
	const quotedProcessed = processedArguments[config.quoteArgumentsWithIndex];
	if(quotedProcessed) {
		markArgumentsAsNonStandardEvaluation(information.graph, rootId, processedArguments, [config.quoteArgumentsWithIndex], { evaluated });
		if(evaluated) {
			/* the argument was processed in a clean env, so the escaped reads need linking by hand */
			const escaped = [...quotedProcessed.in, ...quotedProcessed.unknownReferences].filter(r => evaluated.has(r.nodeId));
			linkInputs(escaped, lastEnv, inRefs, information.graph, false);
		}
	}

	const envProcessed = config.envArgIndex === undefined ? undefined : processedArguments[config.envArgIndex];
	if(envProcessed && quotedProcessed) {
		applyEnvListReplacement(information, envProcessed, quotedProcessed);
	}

	return {
		...information,
		environment:       startEnv,
		in:                inRefs,
		out:               others.flatMap(p => p.out),
		unknownReferences: others.flatMap(p => p.unknownReferences)
	};
}

/** The uses within `expr`, by name, to match a `substitute` env list against. */
function usesByName(expr: DataflowInformation): ReadonlyMap<string, NodeId[]> {
	const useMap = new Map<string, NodeId[]>();
	for(const vType of [VertexType.Use, VertexType.FunctionCall]) {
		for(const [useId] of expr.graph.verticesOfType(vType)) {
			const rn = NodeId.recoverName(useId, expr.graph.idMap);
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
			if(!DfgVertex.isFunctionCall(vtx)) {
				return;
			}
			if(!vtx.origin.includes(BuiltInProcName.List)) {
				return true;
			}
			useMap ??= usesByName(expr);
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
