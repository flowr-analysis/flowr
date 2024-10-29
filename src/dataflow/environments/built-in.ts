import type { DataflowProcessorInformation } from '../processor';
import type { ExitPointType , DataflowInformation  } from '../info';
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
import type { ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { RFunctionArgument } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { RSymbol } from '../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { EdgeType } from '../graph/edge';
import { processLibrary } from '../internal/process/functions/call/built-in/built-in-library';
import { processSourceCall } from '../internal/process/functions/call/built-in/built-in-source';
import type { ForceArguments } from '../internal/process/functions/call/common';
import { processApply } from '../internal/process/functions/call/built-in/built-in-apply';
import { registerBuiltInDefinitions } from './built-in-config';
import { DefaultBuiltinConfig } from './default-builtin-config';
import type { LinkTo } from '../../queries/catalog/call-context-query/call-context-query-format';




export const BuiltIn = 'built-in';

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
	definedAt: typeof BuiltIn
	processor: BuiltInIdentifierProcessor
}

export interface BuiltInIdentifierConstant<T = unknown> extends IdentifierReference {
	type:      ReferenceType.BuiltInConstant
	definedAt: typeof BuiltIn
	value:     T
}

export interface DefaultBuiltInProcessorConfiguration extends ForceArguments {
	readonly returnsNthArgument?:    number | 'last',
	readonly cfg?:                   ExitPointType,
	readonly readAllArguments?:      boolean,
	readonly hasUnknownSideEffects?: boolean | LinkTo<RegExp | string>
}

function defaultBuiltInProcessor<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly RFunctionArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
	config: DefaultBuiltInProcessorConfiguration
): DataflowInformation {
	const { information: res, processedArguments } = processKnownFunctionCall({ name, args, rootId, data, forceArgs: config.forceArgs });
	if(config.returnsNthArgument !== undefined) {
		const arg = config.returnsNthArgument === 'last' ? processedArguments[args.length - 1] : processedArguments[config.returnsNthArgument];
		if(arg !== undefined) {
			res.graph.addEdge(rootId, arg.entryPoint, EdgeType.Returns);
		}
	}
	if(config.readAllArguments) {
		for(const arg of processedArguments) {
			if(arg) {
				res.graph.addEdge(rootId, arg.entryPoint, EdgeType.Reads);
			}
		}
	}

	if(config.hasUnknownSideEffects) {
		if(typeof config.hasUnknownSideEffects !== 'boolean') {
			res.graph.markIdForUnknownSideEffects(rootId, config.hasUnknownSideEffects);
		} else {
			res.graph.markIdForUnknownSideEffects(rootId);
		}
	}

	if(config.cfg !== undefined) {
		res.exitPoints = [...res.exitPoints, { type: config.cfg, nodeId: rootId, controlDependencies: data.controlDependencies }];
	}

	return res;
}

export function registerBuiltInFunctions<Config, Proc extends BuiltInIdentifierProcessorWithConfig<Config>>(
	both:      boolean,
	names:     readonly Identifier[],
	processor: Proc,
	config:    Config
): void {
	for(const name of names) {
		guard(processor !== undefined, `Processor for ${name} is undefined, maybe you have an import loop? You may run 'npm run detect-circular-deps' - although by far not all are bad`);
		const d: IdentifierDefinition[] = [{
			type:                ReferenceType.BuiltInFunction,
			definedAt:           BuiltIn,
			controlDependencies: undefined,
			processor:           (name, args, rootId, data) => processor(name, args, rootId, data, config),
			name,
			nodeId:              BuiltIn
		}];
		BuiltInMemory.set(name, d);
		if(both) {
			EmptyBuiltInMemory.set(name, d);
		}
	}
}

export const BuiltInProcessorMapper = {
	'builtin:default':             defaultBuiltInProcessor,
	'builtin:apply':               processApply,
	'builtin:expression-list':     processExpressionList,
	'builtin:source':              processSourceCall,
	'builtin:access':              processAccess,
	'builtin:if-then-else':        processIfThenElse,
	'builtin:get':                 processGet,
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
} as const satisfies Record<`builtin:${string}`, BuiltInIdentifierProcessorWithConfig<never>>;

export type BuiltInMappingName = keyof typeof BuiltInProcessorMapper;
export type ConfigOfBuiltInMappingName<N extends BuiltInMappingName> = Parameters<typeof BuiltInProcessorMapper[N]>[4];

export const BuiltInMemory = new Map<Identifier, IdentifierDefinition[]>();
export const EmptyBuiltInMemory = new Map<Identifier, IdentifierDefinition[]>();

registerBuiltInDefinitions(DefaultBuiltinConfig);
