import type { DataflowProcessorInformation } from '../processor';
import type { DataflowInformation, ExitPoint, ExitPointType } from '../info';
import { processKnownFunctionCall } from '../internal/process/functions/call/known-call-handling';
import { processAccess } from '../internal/process/functions/call/built-in/built-in-access';
import { processIfThenElse } from '../internal/process/functions/call/built-in/built-in-if-then-else';
import { processAssignment } from '../internal/process/functions/call/built-in/built-in-assignment';
import { processSpecialBinOp } from '../internal/process/functions/call/built-in/built-in-special-bin-op';
import { processPipe } from '../internal/process/functions/call/built-in/built-in-pipe';
import { processForLoop } from '../internal/process/functions/call/built-in/built-in-for-loop';
import { processRepeatLoop } from '../internal/process/functions/call/built-in/built-in-repeat-loop';
import { processWhileLoop } from '../internal/process/functions/call/built-in/built-in-while-loop';
import type { Identifier, IdentifierDefinition, IdentifierReference } from './identifier';
import { ReferenceType } from './identifier';
import { guard } from '../../util/assert';
import { processReplacementFunction } from '../internal/process/functions/call/built-in/built-in-replacement';
import { processQuote } from '../internal/process/functions/call/built-in/built-in-quote';
import { processFunctionDefinition } from '../internal/process/functions/call/built-in/built-in-function-definition';
import { processExpressionList } from '../internal/process/functions/call/built-in/built-in-expression-list';
import { processGet } from '../internal/process/functions/call/built-in/built-in-get';
import type { AstIdMap, ParentInformation, RNodeWithParent } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { RFunctionArgument } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { EmptyArgument } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { RSymbol } from '../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { EdgeType } from '../graph/edge';
import { processLibrary } from '../internal/process/functions/call/built-in/built-in-library';
import { processSourceCall } from '../internal/process/functions/call/built-in/built-in-source';
import type { ForceArguments } from '../internal/process/functions/call/common';
import { processApply } from '../internal/process/functions/call/built-in/built-in-apply';
import type { LinkTo } from '../../queries/catalog/call-context-query/call-context-query-format';
import { processList } from '../internal/process/functions/call/built-in/built-in-list';
import { processVector } from '../internal/process/functions/call/built-in/built-in-vector';
import { processRm } from '../internal/process/functions/call/built-in/built-in-rm';
import { processEvalCall } from '../internal/process/functions/call/built-in/built-in-eval';
import { VertexType } from '../graph/vertex';
import { RType } from '../../r-bridge/lang-4.x/ast/model/type';
import { handleUnknownSideEffect } from '../graph/unknown-side-effect';
import type { REnvironmentInformation } from './environment';
import type { Value } from '../eval/values/r-value';
import { resolveAsVector, resolveAsSeq, resolveAsMinus, resolveAsPlus } from '../eval/resolve/resolve';
import type { DataflowGraph } from '../graph/graph';
import type { VariableResolve } from '../../config';

export type BuiltIn = `built-in:${string}`;

export function builtInId(name: string): BuiltIn {
	return `built-in:${name}`;
}
export function isBuiltIn(name: NodeId | string): name is BuiltIn {
	return String(name).startsWith('built-in:');
}

export type BuiltInIdentifierProcessor = <OtherInfo>(
	name:   RSymbol<OtherInfo & ParentInformation>,
	args:   readonly RFunctionArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data:   DataflowProcessorInformation<OtherInfo & ParentInformation>,
) => DataflowInformation

export type BuiltInIdentifierProcessorWithConfig<Config> = <OtherInfo>(
	name:   RSymbol<OtherInfo & ParentInformation>,
	args:   readonly RFunctionArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data:   DataflowProcessorInformation<OtherInfo & ParentInformation>,
	config: Config
) => DataflowInformation

export interface BuiltInIdentifierDefinition extends IdentifierReference {
	type:      ReferenceType.BuiltInFunction
	definedAt: BuiltIn
	processor: BuiltInIdentifierProcessor
	config?:   object
}

export interface BuiltInIdentifierConstant<T = unknown> extends IdentifierReference {
	type:      ReferenceType.BuiltInConstant
	definedAt: BuiltIn
	value:     T
}

export type UseAsProcessors = 'builtin:default' | 'builtin:return' | 'builtin:stop';

export interface DefaultBuiltInProcessorConfiguration extends ForceArguments {
	readonly returnsNthArgument?:    number | 'last',
	readonly cfg?:                   ExitPointType,
	readonly readAllArguments?:      boolean,
	readonly hasUnknownSideEffects?: boolean | LinkTo,
	/** record mapping the actual function name called to the arguments that should be treated as function calls */
	readonly treatAsFnCall?:         Record<string, readonly string[]>,
	/** Name that should be used for the origin (useful when needing to differentiate between
	 * functions like 'return' that use the default builtin processor)
	 */
	readonly useAsProcessor?:        UseAsProcessors
}


export type BuiltInEvalHandler = (resolve: VariableResolve, a: RNodeWithParent, env?: REnvironmentInformation, graph?: DataflowGraph, map?: AstIdMap) => Value;

function defaultBuiltInProcessor<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly RFunctionArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
	{ returnsNthArgument, useAsProcessor, forceArgs, readAllArguments, cfg, hasUnknownSideEffects, treatAsFnCall }: DefaultBuiltInProcessorConfiguration
): DataflowInformation {
	const activeProcessor = useAsProcessor ?? 'builtin:default';
	const { information: res, processedArguments } = processKnownFunctionCall({ name, args, rootId, data, forceArgs, origin: activeProcessor });
	if(returnsNthArgument !== undefined) {
		const arg = returnsNthArgument === 'last' ? processedArguments[args.length - 1] : processedArguments[returnsNthArgument];
		if(arg !== undefined) {
			res.graph.addEdge(rootId, arg.entryPoint, EdgeType.Returns);
		}
	}
	if(readAllArguments) {
		for(const arg of processedArguments) {
			if(arg) {
				res.graph.addEdge(rootId, arg.entryPoint, EdgeType.Reads);
			}
		}
	}
	if(hasUnknownSideEffects) {
		if(typeof hasUnknownSideEffects !== 'boolean') {
			handleUnknownSideEffect(res.graph, res.environment, rootId, hasUnknownSideEffects);
		} else {
			handleUnknownSideEffect(res.graph, res.environment, rootId);
		}
	}

	const fnCallNames = treatAsFnCall?.[name.content];
	if(fnCallNames) {
		for(const arg of args) {
			if(arg !== EmptyArgument && arg.value && fnCallNames.includes(arg.name?.content as string)) {
				const rhs = arg.value;
				let fnName: string | undefined;
				let fnId: NodeId | undefined;
				if(rhs.type === RType.String) {
					fnName = rhs.content.str;
					fnId = rhs.info.id;
				} else if(rhs.type === RType.Symbol) {
					fnName = rhs.content;
					fnId = rhs.info.id;
				} else {
					continue;
				}
				res.graph.updateToFunctionCall({
					tag:         VertexType.FunctionCall,
					id:          fnId,
					name:        fnName,
					args:        [],
					environment: data.environment,
					onlyBuiltin: false,
					cds:         data.controlDependencies,
					origin:      [activeProcessor]
				});
			}
		}
	}

	if(cfg !== undefined) {
		(res.exitPoints as ExitPoint[]).push({ type: cfg, nodeId: rootId, controlDependencies: data.controlDependencies });
	}

	return res;
}

export function registerBuiltInFunctions<Config extends object, Proc extends BuiltInIdentifierProcessorWithConfig<Config>>(
	both:      boolean,
	names:     readonly Identifier[],
	processor: Proc,
	config:    Config,
	builtIns:  BuiltIns
): void {
	for(const name of names) {
		guard(processor !== undefined, `Processor for ${name} is undefined, maybe you have an import loop? You may run 'npm run detect-circular-deps' - although by far not all are bad`);
		const id = builtInId(name);
		const d: IdentifierDefinition[] = [{
			type:                ReferenceType.BuiltInFunction,
			definedAt:           id,
			controlDependencies: undefined,
			processor:           (name, args, rootId, data) => processor(name, args, rootId, data, config),
			config,
			name,
			nodeId:              id
		}];
		builtIns.set(name, d, both);
	}
}

export const BuiltInProcessorMapper = {
	'builtin:default':             defaultBuiltInProcessor,
	'builtin:eval':                processEvalCall,
	'builtin:apply':               processApply,
	'builtin:expression-list':     processExpressionList,
	'builtin:source':              processSourceCall,
	'builtin:access':              processAccess,
	'builtin:if-then-else':        processIfThenElse,
	'builtin:get':                 processGet,
	'builtin:rm':                  processRm,
	'builtin:library':             processLibrary,
	'builtin:assignment':          processAssignment,
	'builtin:special-bin-op':      processSpecialBinOp,
	'builtin:pipe':                processPipe,
	'builtin:function-definition': processFunctionDefinition,
	'builtin:quote':               processQuote,
	'builtin:for-loop':            processForLoop,
	'builtin:repeat-loop':         processRepeatLoop,
	'builtin:while-loop':          processWhileLoop,
	'builtin:replacement':         processReplacementFunction,
	'builtin:list':                processList,
	'builtin:vector':              processVector,
} as const satisfies Record<`builtin:${string}`, BuiltInIdentifierProcessorWithConfig<never>>;

export const BuiltInEvalHandlerMapper = {
	'built-in:c': resolveAsVector,
	'built-in::': resolveAsSeq,
	'built-in:+': resolveAsPlus,
	'built-in:-': resolveAsMinus
} as const satisfies Record<string, BuiltInEvalHandler>;

export type BuiltInMappingName = keyof typeof BuiltInProcessorMapper;
export type ConfigOfBuiltInMappingName<N extends BuiltInMappingName> = Parameters<typeof BuiltInProcessorMapper[N]>[4];

export type BuiltInMemory = Map<Identifier, IdentifierDefinition[]>

export class BuiltIns {
	/**
     * The built-in {@link REnvironmentInformation|environment} is the root of all environments.
     *
     * For its default content (when not overwritten by a flowR config),
     * see the {@link DefaultBuiltinConfig}.
     */
	builtInMemory:      BuiltInMemory = new Map<Identifier, IdentifierDefinition[]>();
	/**
     * The twin of the {@link builtInMemory} but with less built ins defined for
     * cases in which we want some commonly overwritten variables to remain open.
     * If you do not know if you need the empty environment, you do not need the empty environment (right now).
     *
     * @see {@link builtInMemory}
     */
	emptyBuiltInMemory: BuiltInMemory = new Map<Identifier, IdentifierDefinition[]>();

	set(identifier: Identifier, definition: IdentifierDefinition[], includeInEmptyMemory: boolean | undefined): void {
		this.builtInMemory.set(identifier, definition);
		if(includeInEmptyMemory) {
			this.emptyBuiltInMemory.set(identifier, definition);
		}
	}
}
