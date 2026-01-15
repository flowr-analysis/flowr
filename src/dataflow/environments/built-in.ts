import type { DataflowProcessorInformation } from '../processor';
import type { DataflowInformation, ExitPoint, ExitPointType } from '../info';
import { processKnownFunctionCall } from '../internal/process/functions/call/known-call-handling';
import { processAccess } from '../internal/process/functions/call/built-in/built-in-access';
import { processIfThenElse } from '../internal/process/functions/call/built-in/built-in-if-then-else';
import {
	processAssignment,
	processAssignmentLike
} from '../internal/process/functions/call/built-in/built-in-assignment';
import { processSpecialBinOp } from '../internal/process/functions/call/built-in/built-in-special-bin-op';
import { processPipe } from '../internal/process/functions/call/built-in/built-in-pipe';
import { processForLoop } from '../internal/process/functions/call/built-in/built-in-for-loop';
import { processRepeatLoop } from '../internal/process/functions/call/built-in/built-in-repeat-loop';
import { processWhileLoop } from '../internal/process/functions/call/built-in/built-in-while-loop';
import { type Identifier, type IdentifierDefinition, type IdentifierReference, ReferenceType } from './identifier';
import { guard } from '../../util/assert';
import { processReplacementFunction } from '../internal/process/functions/call/built-in/built-in-replacement';
import { processQuote } from '../internal/process/functions/call/built-in/built-in-quote';
import { processFunctionDefinition } from '../internal/process/functions/call/built-in/built-in-function-definition';
import { processExpressionList } from '../internal/process/functions/call/built-in/built-in-expression-list';
import { processGet } from '../internal/process/functions/call/built-in/built-in-get';
import type { AstIdMap, ParentInformation, RNodeWithParent } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { EmptyArgument, type RFunctionArgument } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
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
import { resolveAsMinus, resolveAsPlus, resolveAsSeq, resolveAsVector } from '../eval/resolve/resolve';
import type { DataflowGraph } from '../graph/graph';
import type { VariableResolve } from '../../config';
import type {
	BuiltInConstantDefinition,
	BuiltInDefinition,
	BuiltInFunctionDefinition,
	BuiltInReplacementDefinition
} from './built-in-config';
import type { ReadOnlyFlowrAnalyzerContext } from '../../project/context/flowr-analyzer-context';
import { processStopIfNot } from '../internal/process/functions/call/built-in/built-in-stop-if-not';
import { processTryCatch } from '../internal/process/functions/call/built-in/built-in-try-catch';
import { processRegisterHook } from '../internal/process/functions/call/built-in/built-in-register-hook';

export type BuiltIn = `built-in:${string}`;

/**
 * Generate a built-in id for the given name
 */
export function builtInId<T extends string>(name: T): `built-in:${T}` {
	return `built-in:${name}`;
}

/**
 * Checks whether the given name is a built-in identifier
 */
export function isBuiltIn(name: NodeId | string): name is BuiltIn {
	return String(name).startsWith('built-in:');
}

const builtInPrefixLength = 'built-in:'.length;
/**
 * Drops the `built-in:` prefix from the given built-in name
 */
export function dropBuiltInPrefix<T extends string>(name: `built-in:${T}`): T {
	return name.slice(builtInPrefixLength) as T;
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
	config?:   ConfigOfBuiltInMappingName<keyof typeof BuiltInProcessorMapper> & { libFn?: boolean }
}

export interface BuiltInIdentifierConstant<T = unknown> extends IdentifierReference {
	type:      ReferenceType.BuiltInConstant
	definedAt: BuiltIn
	value:     T
}

export interface DefaultBuiltInProcessorConfiguration extends ForceArguments {
	readonly returnsNthArgument?:    number | 'last',
	readonly cfg?:                   ExitPointType,
	readonly readAllArguments?:      boolean,
	readonly hasUnknownSideEffects?: boolean | LinkTo<RegExp | string>,
	/** record mapping the actual function name called to the arguments that should be treated as function calls */
	readonly treatAsFnCall?:         Record<string, readonly string[]>,
	/**
	 * Name that should be used for the origin (useful when needing to differentiate between
	 * functions like 'return' that use the default builtin processor)
	 */
	readonly useAsProcessor?:        BuiltInProcName
}


export type BuiltInEvalHandler = (resolve: VariableResolve, a: RNodeWithParent, ctx: ReadOnlyFlowrAnalyzerContext, env?: REnvironmentInformation, graph?: DataflowGraph, map?: AstIdMap) => Value;

function defaultBuiltInProcessor<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly RFunctionArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
	{ returnsNthArgument, useAsProcessor, forceArgs, readAllArguments, cfg, hasUnknownSideEffects, treatAsFnCall }: DefaultBuiltInProcessorConfiguration
): DataflowInformation {
	const activeProcessor = useAsProcessor ?? BuiltInProcName.Default;
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
		if(typeof hasUnknownSideEffects === 'boolean') {
			handleUnknownSideEffect(res.graph, res.environment, rootId);
		} else {
			handleUnknownSideEffect(res.graph, res.environment, rootId, hasUnknownSideEffects);
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
					cds:         data.cds,
					origin:      [activeProcessor]
				});
			}
		}
	}

	if(cfg !== undefined) {
		(res.exitPoints as ExitPoint[]).push({ type: cfg, nodeId: rootId, cds: data.cds });
	}

	return res;
}

/**
 * This contains all names of built-in function handlers and origins
 */
export enum BuiltInProcName {
	/** for subsetting operations, see {@link processAccess} */
	Access              = 'builtin:access',
	/** for the `*apply` family, see {@link processApply} */
	Apply               = 'builtin:apply',
	/** for assignments like `<-` and `=`, see {@link processAssignment} */
	Assignment          = 'builtin:assignment',
	/** for assignment like functions that may do additional work, see {@link processAssignmentLike} */
	AssignmentLike      = 'builtin:assignment-like',
	/** for `break` calls */
	Break               = 'builtin:break',
	/** the default built-in processor, see {@link defaultBuiltInProcessor} */
	Default             = 'builtin:default',
	/** for `eval` calls, see {@link processEvalCall} */
	Eval                = 'builtin:eval',
	/** for expression lists, see {@link processExpressionList} */
	ExpressionList      = 'builtin:expression-list',
	/** for `for` loops, see {@link processForLoop} */
	ForLoop             = 'builtin:for-loop',
	/** We resolved a function call, similar to {@link BuiltInProcName#Default} */
	Function            = 'function',
	/** for function definitions, see {@link processFunctionDefinition} */
	FunctionDefinition  = 'builtin:function-definition',
	/** for `get` calls, see {@link processGet} */
	Get                 = 'builtin:get',
	/** for `if-then-else` constructs, see {@link processIfThenElse} */
	IfThenElse          = 'builtin:if-then-else',
	/** for `library` and `require` calls, see {@link processLibrary} */
	Library             = 'builtin:library',
	/** for `list` calls, see {@link processList} */
	List                = 'builtin:list',
	/** for the pipe operators, see {@link processPipe} */
	Pipe                = 'builtin:pipe',
	/** for `quote`, and other substituting calls, see {@link processQuote} */
	Quote               = 'builtin:quote',
	/** for `on.exìt` and other hooks, see {@link processRegisterHook} */
	RegisterHook        = 'builtin:register-hook',
	/** for `repeat` loops, see {@link processRepeatLoop} */
	RepeatLoop          = 'builtin:repeat-loop',
	/** for replacement functions like `names<-`, see {@link processReplacementFunction} */
	Replacement         = 'builtin:replacement',
	/** for `return` calls */
	Return              = 'builtin:return',
	/** for `rm` calls, see {@link processRm} */
	Rm                  = 'builtin:rm',
	/** for `source` calls, see {@link processSourceCall} */
	Source              = 'builtin:source',
	/** for special binary operators like `%x%`, see {@link processSpecialBinOp} */
	SpecialBinOp        = 'builtin:special-bin-op',
	/** for `stop` calls */
	Stop                = 'builtin:stop',
	/** for `stopifnot` calls, see {@link processStopIfNot} */
	StopIfNot           = 'builtin:stopifnot',
	/** support for `:=` in subsetting assignments, see {@link processAccess} */
	TableAssignment     = 'table:assign',
	/** for `try` calls, see {@link processTryCatch} */
	Try                 = 'builtin:try',
	/** for unnamed directly-linked function calls */
	Unnamed             = 'unnamed',
	/** for vector construction calls, see {@link processVector} */
	Vector              = 'builtin:vector',
	/** for `while` loops, see {@link processWhileLoop} */
	WhileLoop           = 'builtin:while-loop',
}


export const BuiltInProcessorMapper = {
	[BuiltInProcName.Access]:             processAccess,
	[BuiltInProcName.Apply]:              processApply,
	[BuiltInProcName.Assignment]:         processAssignment,
	[BuiltInProcName.AssignmentLike]:     processAssignmentLike,
	[BuiltInProcName.Default]:            defaultBuiltInProcessor,
	[BuiltInProcName.Eval]:               processEvalCall,
	[BuiltInProcName.ExpressionList]:     processExpressionList,
	[BuiltInProcName.ForLoop]:            processForLoop,
	[BuiltInProcName.FunctionDefinition]: processFunctionDefinition,
	[BuiltInProcName.Get]:                processGet,
	[BuiltInProcName.IfThenElse]:         processIfThenElse,
	[BuiltInProcName.Library]:            processLibrary,
	[BuiltInProcName.List]:               processList,
	[BuiltInProcName.Pipe]:               processPipe,
	[BuiltInProcName.Quote]:              processQuote,
	[BuiltInProcName.RegisterHook]:       processRegisterHook,
	[BuiltInProcName.RepeatLoop]:         processRepeatLoop,
	[BuiltInProcName.Replacement]:        processReplacementFunction,
	[BuiltInProcName.Rm]:                 processRm,
	[BuiltInProcName.Source]:             processSourceCall,
	[BuiltInProcName.SpecialBinOp]:       processSpecialBinOp,
	[BuiltInProcName.StopIfNot]:          processStopIfNot,
	[BuiltInProcName.Try]:                processTryCatch,
	[BuiltInProcName.Vector]:             processVector,
	[BuiltInProcName.WhileLoop]:          processWhileLoop,
} as const satisfies Record<`builtin:${string}`, BuiltInIdentifierProcessorWithConfig<never>>;

export const BuiltInEvalHandlerMapper = {
	'built-in:c': resolveAsVector,
	'built-in::': resolveAsSeq,
	'built-in:+': resolveAsPlus,
	'built-in:-': resolveAsMinus
} as const satisfies Record<string, BuiltInEvalHandler>;

export type ConfigOfBuiltInMappingName<N extends keyof typeof BuiltInProcessorMapper> = Parameters<typeof BuiltInProcessorMapper[N]>[4];

export type BuiltInMemory = Map<Identifier, IdentifierDefinition[]>

export class BuiltIns {
	/**
	 * Register a built-in constant (like `NULL` or `TRUE`) to the given {@link BuiltIns}
	 */
	registerBuiltInConstant<T>({ names, value, assumePrimitive }: BuiltInConstantDefinition<T>): void {
		for(const name of names) {
			const id = builtInId(name);
			const d: IdentifierDefinition[] = [{
				type:      ReferenceType.BuiltInConstant,
				definedAt: id,
				cds:       undefined,
				value,
				name,
				nodeId:    id
			}];
			this.set(name, d, assumePrimitive);
		}
	}

	/**
	 * Register a built-in function (like `print` or `c`) to the given {@link BuiltIns}
	 */
	registerBuiltInFunctions<BuiltInProcessor extends keyof typeof BuiltInProcessorMapper>({ names, processor, config, assumePrimitive }: BuiltInFunctionDefinition<BuiltInProcessor> ): void {
		guard(processor !== undefined, () => `Processor for ${JSON.stringify(names)} is undefined, maybe you have an import loop? You may run 'npm run detect-circular-deps' - although by far not all are bad`);
		const mappedProcessor = BuiltInProcessorMapper[processor];
		guard(mappedProcessor !== undefined, () => `Processor for ${processor} is undefined! Please pass a valid builtin name ${JSON.stringify(Object.keys(BuiltInProcessorMapper))}!`);
		for(const name of names) {
			const id = builtInId(name);
			const d: IdentifierDefinition[] = [{
				type:      ReferenceType.BuiltInFunction,
				definedAt: id,
				cds:       undefined,
				/* eslint-disable-next-line @typescript-eslint/no-explicit-any,@typescript-eslint/no-unsafe-argument */
				processor: (name, args, rootId, data) => mappedProcessor(name, args, rootId, data, config as any),
				config,
				name,
				nodeId:    id
			}];
			this.set(name, d, assumePrimitive);
		}
	}

	/**
	 * Registers all combinations of replacements
	 */
	registerReplacementFunctions({ names, suffixes, assumePrimitive, config }: BuiltInReplacementDefinition): void {
		const replacer = BuiltInProcessorMapper['builtin:replacement'];
		guard(replacer !== undefined, () => 'Processor for builtin:replacement is undefined!');
		for(const assignment of names) {
			for(const suffix of suffixes) {
				const effectiveName = `${assignment}${suffix}`;
				const id = builtInId(effectiveName);
				const d: IdentifierDefinition[] = [{
					type:      ReferenceType.BuiltInFunction,
					definedAt: id,
					processor: (name, args, rootId, data) => replacer(name, args, rootId, data, { makeMaybe: true, assignmentOperator: suffix, readIndices: config.readIndices }),
					config:    {
						...config,
						assignmentOperator: suffix,
						makeMaybe:          true
					},
					name:   effectiveName,
					cds:    undefined,
					nodeId: id
				}];
				this.set(effectiveName, d, assumePrimitive);
			}
		}
	}

	/**
	 * Register a single {@link BuiltInDefinition} to the given memories in {@link BuiltIns}
	 */
	registerBuiltInDefinition(definition: BuiltInDefinition) {
		switch(definition.type) {
			case 'constant':
				return this.registerBuiltInConstant(definition);
			case 'function':
				return this.registerBuiltInFunctions(definition);
			case 'replacement':
				return this.registerReplacementFunctions(definition);
		}
	}

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
