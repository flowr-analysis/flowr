import type { NodeId, ParentInformation, RFunctionArgument, RSymbol } from '../../r-bridge'
import { EmptyArgument } from '../../r-bridge'
import type { DataflowProcessorInformation } from '../processor'
import type { DataflowInformation } from '../info'
import { processKnownFunctionCall } from '../internal/process/functions/call/known-call-handling'
import { EdgeType } from '../graph'
import { processSourceCall } from '../internal/process/functions/call/built-in/built-in-source'
import { processAccess } from '../internal/process/functions/call/built-in/built-in-access'
import { processIfThenElse } from '../internal/process/functions/call/built-in/built-in-if-then-else'
import { processAssignment } from '../internal/process/functions/call/built-in/built-in-assignment'
import { processSpecialBinOp } from '../internal/process/functions/call/built-in/built-in-logical-bin-op'
import { processPipe } from '../internal/process/functions/call/built-in/built-in-pipe'
import { processForLoop } from '../internal/process/functions/call/built-in/built-in-for-loop'
import { processRepeatLoop } from '../internal/process/functions/call/built-in/built-in-for-repeat'
import { processWhileLoop } from '../internal/process/functions/call/built-in/built-in-for-while'
import type { Identifier, IdentifierDefinition, IdentifierReference } from './identifier'

export const BuiltIn = 'built-in'

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
	kind:      'built-in-function'
	definedAt: typeof BuiltIn
	processor: BuiltInIdentifierProcessor
}

export interface BuiltInIdentifierConstant<T = unknown> extends IdentifierReference {
	kind:      'built-in-value'
	definedAt: typeof BuiltIn
	value:     T
}

function defaultBuiltInFunctionProcessor<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly RFunctionArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
	config: { returnsNthArgument?: number | 'last' }
): DataflowInformation {
	const res = processKnownFunctionCall(name, args, rootId, data).information
	if(config.returnsNthArgument !== undefined) {
		const arg = config.returnsNthArgument === 'last' ? args[args.length - 1] : args[config.returnsNthArgument]
		if(arg !== EmptyArgument) {
			res.graph.addEdge(rootId, arg.info.id, EdgeType.Returns, 'always', true)
		}
	}
	return res
}

function simpleBuiltInFunction<Config, Proc extends BuiltInIdentifierProcessorWithConfig<Config>>(
	processor: Proc,
	config: Config,
	...names: Identifier[]
): [Identifier, BuiltInIdentifierDefinition[]][] {
	return names.map(name => [name, [{
		kind:      'built-in-function',
		used:      'always',
		definedAt: BuiltIn,
		processor: (name, args, rootId, data) => processor(name, args, rootId, data, config),
		name,
		nodeId:    BuiltIn
	}]])
}

function builtInFunctions(...names: Identifier[]): [Identifier, BuiltInIdentifierDefinition[]][] {
	return simpleBuiltInFunction(defaultBuiltInFunctionProcessor, {}, ...names)
}

function simpleBuiltInConstant<T>(name: Identifier, value: T): [Identifier, BuiltInIdentifierConstant<T>[]] {
	return [name, [{
		kind:      'built-in-value',
		used:      'always',
		definedAt: BuiltIn,
		value,
		name,
		nodeId:    BuiltIn
	}]]
}

export const BuiltInMemory = new Map<Identifier, IdentifierDefinition[]>([
	simpleBuiltInConstant('NULL', null),
	simpleBuiltInConstant('NA', null),
	simpleBuiltInConstant('TRUE', true), simpleBuiltInConstant('T', true),
	simpleBuiltInConstant('FALSE', false), simpleBuiltInConstant('F', false),
	// maybe map to a control flow function?
	simpleBuiltInConstant('break', 'break'), simpleBuiltInConstant('next', 'next'),
	...builtInFunctions('~', '+', '-', '*', '/', '^', '!', '?', '**', '==', '!=', '>', '<', '>=', '<=', '%%', '%/%', '%*%', ':'),
	...simpleBuiltInFunction(defaultBuiltInFunctionProcessor, {}, 'cat' /* returns null */),
	...simpleBuiltInFunction(defaultBuiltInFunctionProcessor, { returnsNthArgument: 1 }, 'return', 'print', '('),
	...simpleBuiltInFunction(defaultBuiltInFunctionProcessor, { returnsNthArgument: 'last' as const }, '{'),
	...simpleBuiltInFunction(processSourceCall, {}, 'source'),
	...simpleBuiltInFunction(processAccess, { treatIndicesAsString: false }, '[', '[['),
	...simpleBuiltInFunction(processAccess, { treatIndicesAsString: true }, '$', '@'),
	...simpleBuiltInFunction(processIfThenElse, {}, 'if'),
	...simpleBuiltInFunction(processAssignment, {}, '<-', ':=', '=', 'assign', 'delayedAssign'),
	...simpleBuiltInFunction(processAssignment, { superAssignment: true }, '<<-'),
	...simpleBuiltInFunction(processAssignment, { swapSourceAndTarget: true }, '->'),
	...simpleBuiltInFunction(processAssignment, { superAssignment: true, swapSourceAndTarget: true }, '->>'),
	...simpleBuiltInFunction(processSpecialBinOp, { lazy: true }, '&&', '||', '&', '|'),
	...simpleBuiltInFunction(processPipe, {}, '|>'),
	...simpleBuiltInFunction(processForLoop, {}, 'for'),
	...simpleBuiltInFunction(processRepeatLoop, {}, 'repeat'),
	...simpleBuiltInFunction(processWhileLoop, {}, 'while')
])

