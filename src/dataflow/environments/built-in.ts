import type { DataflowProcessorInformation } from '../processor'
import { ExitPointType } from '../info'
import type { DataflowInformation  } from '../info'
import { processKnownFunctionCall } from '../internal/process/functions/call/known-call-handling'
import { processAccess } from '../internal/process/functions/call/built-in/built-in-access'
import { processIfThenElse } from '../internal/process/functions/call/built-in/built-in-if-then-else'
import { processAssignment } from '../internal/process/functions/call/built-in/built-in-assignment'
import { processSpecialBinOp } from '../internal/process/functions/call/built-in/built-in-special-bin-op'
import { processPipe } from '../internal/process/functions/call/built-in/built-in-pipe'
import { processForLoop } from '../internal/process/functions/call/built-in/built-in-for-loop'
import { processRepeatLoop } from '../internal/process/functions/call/built-in/built-in-repeat-loop'
import { processWhileLoop } from '../internal/process/functions/call/built-in/built-in-while-loop'
import type { Identifier, IdentifierDefinition, IdentifierReference } from './identifier'
import { guard } from '../../util/assert'
import { processReplacementFunction } from '../internal/process/functions/call/built-in/built-in-replacement'
import { processQuote } from '../internal/process/functions/call/built-in/built-in-quote'
import { processFunctionDefinition } from '../internal/process/functions/call/built-in/built-in-function-definition'
import { processExpressionList } from '../internal/process/functions/call/built-in/built-in-expression-list'
import { processGet } from '../internal/process/functions/call/built-in/built-in-get'
import type { ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate'
import type { RFunctionArgument } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-call'
import type { RSymbol } from '../../r-bridge/lang-4.x/ast/model/nodes/r-symbol'
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id'
import { EdgeType } from '../graph/edge'
import { processLibrary } from '../internal/process/functions/call/built-in/built-in-library'
import { processSourceCall } from '../internal/process/functions/call/built-in/built-in-source'
import type { ForceArguments } from '../internal/process/functions/call/common'
import { processApply } from '../internal/process/functions/call/built-in/built-in-apply'

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

function defaultBuiltInProcessor<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly RFunctionArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
	config: { returnsNthArgument?: number | 'last', cfg?: ExitPointType, readAllArguments?: boolean, hasUnknownSideEffects?: boolean } & ForceArguments
): DataflowInformation {
	const { information: res, processedArguments } = processKnownFunctionCall({ name, args, rootId, data, forceArgs: config.forceArgs })
	if(config.returnsNthArgument !== undefined) {
		const arg = config.returnsNthArgument === 'last' ? processedArguments[args.length - 1] : processedArguments[config.returnsNthArgument]
		if(arg !== undefined) {
			res.graph.addEdge(rootId, arg.entryPoint, { type: EdgeType.Returns })
		}
	}
	if(config.readAllArguments) {
		for(const arg of processedArguments) {
			if(arg) {
				res.graph.addEdge(rootId, arg.entryPoint, { type: EdgeType.Reads })
			}
		}
	}

	if(config.hasUnknownSideEffects) {
		res.graph.markIdForUnknownSideEffects(rootId)
	}

	if(config.cfg !== undefined) {
		res.exitPoints = [...res.exitPoints, { type: config.cfg, nodeId: rootId, controlDependencies: data.controlDependencies }]
	}
	return res
}

export function registerBuiltInFunctions<Config, Proc extends BuiltInIdentifierProcessorWithConfig<Config>>(
	both:      boolean,
	names:     readonly Identifier[],
	processor: Proc,
	config:    Config
): void {
	for(const name of names) {
		guard(processor !== undefined, `Processor for ${name} is undefined, maybe you have an import loop? You may run 'npm run detect-circular-deps' - although by far not all are bad`)
		guard(!BuiltInMemory.has(name), `Built-in ${name} already defined`)
		const d: IdentifierDefinition[] = [{
			kind:                'built-in-function',
			definedAt:           BuiltIn,
			controlDependencies: undefined,
			processor:           (name, args, rootId, data) => processor(name, args, rootId, data, config),
			name,
			nodeId:              BuiltIn
		}]
		BuiltInMemory.set(name, d)
		if(both) {
			EmptyBuiltInMemory.set(name, d)
		}
	}
}

/* registers all combinations of replacements */
export function registerReplacementFunctions(
	standardConfig: {makeMaybe?: boolean},
	assignments: readonly ('<-' | '<<-')[],
	...prefixes: readonly Identifier[]
): void {
	for(const assignment of assignments) {
		for(const prefix of prefixes) {
			const effectiveName = `${prefix}${assignment}`
			guard(!BuiltInMemory.has(effectiveName), `Built-in ${effectiveName} already defined`)
			const d: IdentifierDefinition[] = [{
				kind:                'built-in-function',
				definedAt:           BuiltIn,
				processor:           (name, args, rootId, data) => processReplacementFunction(name, args, rootId, data, { ...standardConfig, assignmentOperator: assignment }),
				name:                effectiveName,
				controlDependencies: undefined,
				nodeId:              BuiltIn
			}]
			BuiltInMemory.set(effectiveName, d)
			EmptyBuiltInMemory.set(effectiveName, d)
		}
	}
}


function registerSimpleFunctions(...names: readonly Identifier[]): void {
	registerBuiltInFunctions(false, names, defaultBuiltInProcessor, { readAllArguments: true })
}

function registerBuiltInConstant<T>(both: boolean, name: Identifier, value: T): void {
	guard(!BuiltInMemory.has(name), `Built-in ${name} already defined`)
	const d: IdentifierDefinition[] = [{
		kind:                'built-in-value',
		definedAt:           BuiltIn,
		controlDependencies: undefined,
		value,
		name,
		nodeId:              BuiltIn
	}]
	BuiltInMemory.set(name, d)
	if(both) {
		EmptyBuiltInMemory.set(name, d)
	}
}

export const BuiltInMemory = new Map<Identifier, IdentifierDefinition[]>()
export const EmptyBuiltInMemory = new Map<Identifier, IdentifierDefinition[]>()

registerBuiltInConstant(true, 'NULL',  null)
registerBuiltInConstant(true, 'NA',    null)
registerBuiltInConstant(true, 'TRUE',  true)
registerBuiltInConstant(true, 'T',     true)
registerBuiltInConstant(true, 'FALSE', false)
registerBuiltInConstant(true, 'F',     false)
registerSimpleFunctions(
	'~', '+', '-', '*', '/', '^', '!', '?', '**', '==', '!=', '>', '<', '>=', '<=', '%%', '%/%', '%*%', '%in%', ':', 'list', 'c',
	'rep', 'seq', 'seq_len', 'seq_along', 'seq.int', 'gsub', 'which', 'class', 'dimnames', 'min', 'max',
	'intersect', 'subset', 'match', 'sqrt', 'abs', 'round', 'floor', 'ceiling', 'signif', 'trunc', 'log', 'log10', 'log2', 'sum', 'mean',
	'unique', 'paste', 'paste0', 'read.csv', 'stop', 'is.null', 'plot', 'numeric', 'as.character', 'as.integer', 'as.logical', 'as.numeric', 'as.matrix',
	'do.call', 'rbind', 'nrow', 'ncol', 'tryCatch', 'expression', 'factor',
	'missing', 'as.data.frame', 'data.frame', 'na.omit', 'rownames', 'names', 'order', 'length', 'any', 'dim', 'matrix', 'cbind', 'nchar', 't'
)
registerBuiltInFunctions(true,  ['lapply', 'sapply', 'vapply', 'mapply'],          processApply,              { indexOfFunction: 1, nameOfFunctionArgument: 'FUN' }                        )
/* functool wrappers */
registerBuiltInFunctions(true,  ['Lapply', 'Sapply', 'Vapply', 'Mapply'],          processApply,              { indexOfFunction: 1, nameOfFunctionArgument: 'FUN' }                        )
registerBuiltInFunctions(true,  ['apply', 'tapply', 'Tapply'],                     processApply,              { indexOfFunction: 2, nameOfFunctionArgument: 'FUN' }                        )
registerBuiltInFunctions(true,  ['print'],                                         defaultBuiltInProcessor,   { returnsNthArgument: 0, forceArgs: 'all' as const }                         )
registerBuiltInFunctions(true,  ['('],                                             defaultBuiltInProcessor,   { returnsNthArgument: 0 }                                                    )
registerBuiltInFunctions(true,  ['load', 'load_all', 'setwd', 'set.seed'],         defaultBuiltInProcessor,   { hasUnknownSideEffects: true, forceArgs: [true] }                           )
registerBuiltInFunctions(false, ['cat'],                                           defaultBuiltInProcessor,   { forceArgs: 'all' as const }                                                ) /* returns null */
registerBuiltInFunctions(false, ['switch'],                                        defaultBuiltInProcessor,   {}                                                                           ) /* returns null */
registerBuiltInFunctions(true,  ['return'],                                        defaultBuiltInProcessor,   { returnsNthArgument: 0, cfg: ExitPointType.Return }                         )
registerBuiltInFunctions(true,  ['break'],                                         defaultBuiltInProcessor,   { cfg: ExitPointType.Break }                                                 )
registerBuiltInFunctions(true,  ['next'],                                          defaultBuiltInProcessor,   { cfg: ExitPointType.Next }                                                  )
registerBuiltInFunctions(true,  ['{'],                                             processExpressionList,     {}                                                                           )
registerBuiltInFunctions(true,  ['source'],                                        processSourceCall,         { includeFunctionCall: true, forceFollow: false }                            )
registerBuiltInFunctions(true,  ['[', '[['],                                       processAccess,             { treatIndicesAsString: false }                                              )
registerBuiltInFunctions(true,  ['$', '@'],                                        processAccess,             { treatIndicesAsString: true }                                               )
registerBuiltInFunctions(true,  ['if', 'ifelse'],                                  processIfThenElse,         {}                                                                           )
registerBuiltInFunctions(true,  ['get'],                                           processGet,                {}                                                                           )
registerBuiltInFunctions(false, ['library', 'require'],                            processLibrary,            {}                                                                           )
registerBuiltInFunctions(true,  ['<-', '='],                                       processAssignment,         { canBeReplacement: true }                                                   )
registerBuiltInFunctions(true,  [':=', 'assign'],                                  processAssignment,         {}                                                                           )
registerBuiltInFunctions(true,  ['delayedAssign'],                                 processAssignment,         { quoteSource: true }                                                        )
registerBuiltInFunctions(true,  ['<<-'],                                           processAssignment,         { superAssignment: true, canBeReplacement: true }                            )
registerBuiltInFunctions(true,  ['->'],                                            processAssignment,         { swapSourceAndTarget: true, canBeReplacement: true }                        )
registerBuiltInFunctions(true,  ['->>'],                                           processAssignment,         { superAssignment: true, swapSourceAndTarget: true, canBeReplacement: true } )
registerBuiltInFunctions(true,  ['&&', '&'],                                       processSpecialBinOp,       { lazy: true, evalRhsWhen: true }                                            )
registerBuiltInFunctions(true,  ['||', '|'],                                       processSpecialBinOp,       { lazy: true, evalRhsWhen: false }                                           )
registerBuiltInFunctions(true,  ['|>', '%>%'],                                     processPipe,               {}                                                                           )
registerBuiltInFunctions(true,  ['function', '\\'],                                processFunctionDefinition, {}                                                                           )
registerBuiltInFunctions(true,  ['quote', 'substitute', 'bquote'],                 processQuote,              { quoteArgumentsWithIndex: 0 }                                               )
registerBuiltInFunctions(true,  ['for'],                                           processForLoop,            {}                                                                           )
registerBuiltInFunctions(true,  ['repeat'],                                        processRepeatLoop,         {}                                                                           )
registerBuiltInFunctions(true,  ['while'],                                         processWhileLoop,          {}                                                                           )
registerBuiltInFunctions(true,  ['options'],                                       defaultBuiltInProcessor,   { hasUnknownSideEffects: true, forceArgs: 'all' as const }                   )
registerBuiltInFunctions(true,  ['on.exit', 'sys.on.exit'],                        defaultBuiltInProcessor,   { hasUnknownSideEffects: true }                                              )
/* library and require is handled above */
registerBuiltInFunctions(true,  ['requireNamespace', 'loadNamespace', 'attachNamespace', 'asNamespace'], defaultBuiltInProcessor, { hasUnknownSideEffects: true }                          )
/* downloader and installer functions (R, devtools, BiocManager) */
registerBuiltInFunctions(true,  ['library.dynam', 'install.packages','install', 'install_github', 'install_gitlab', 'install_bitbucket', 'install_url', 'install_git', 'install_svn', 'install_local', 'install_version', 'update_packages'], defaultBuiltInProcessor, { hasUnknownSideEffects: true }                               )
/* weird env attachments */
registerBuiltInFunctions(true,  ['attach'],                                        defaultBuiltInProcessor,   { hasUnknownSideEffects: true }                                              )

/* they are all mapped to `<-` but we separate super assignments */
registerReplacementFunctions({ makeMaybe: true },  ['<-', '<<-'], '[', '[[', '$', '@', 'names', 'dimnames', 'attributes', 'attr', 'class', 'levels', 'rownames', 'colnames')
