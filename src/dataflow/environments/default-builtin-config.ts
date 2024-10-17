import type { BuiltInDefinitions } from './built-in-config';
import { ExitPointType } from '../info';

/**
 * Contains the built-in definitions recognized by flowR
 */
export const DefaultBuiltinConfig: BuiltInDefinitions = [
	{ type: 'constant', names: ['NULL', 'NA'],  value: null,  assumePrimitive: true },
	{ type: 'constant', names: ['TRUE', 'T'],   value: true,  assumePrimitive: true },
	{ type: 'constant', names: ['FALSE', 'F'],  value: false, assumePrimitive: true },
	{
		type:  'function',
		names: [
			'~', '+', '-', '*', '/', '^', '!', '?', '**', '==', '!=', '>', '<', '>=', '<=', '%%', '%/%', '%*%', '%in%', ':', 'list', 'c',
			'rep', 'seq', 'seq_len', 'seq_along', 'seq.int', 'gsub', 'which', 'class', 'dimnames', 'min', 'max',
			'intersect', 'subset', 'match', 'sqrt', 'abs', 'round', 'floor', 'ceiling', 'signif', 'trunc', 'log', 'log10', 'log2', 'sum', 'mean',
			'unique', 'paste', 'paste0', 'read.csv', 'stop', 'is.null', 'plot', 'numeric', 'as.character', 'as.integer', 'as.logical', 'as.numeric', 'as.matrix',
			'rbind', 'nrow', 'ncol', 'tryCatch', 'expression', 'factor',
			'missing', 'as.data.frame', 'data.frame', 'na.omit', 'rownames', 'names', 'order', 'length', 'any', 'dim', 'matrix', 'cbind', 'nchar', 't'
		],
		processor:       'builtin:default',
		config:          { readAllArguments: true },
		assumePrimitive: false
	},
	{ type: 'function', names: ['options'],                                    processor: 'builtin:default',             config: { hasUnknownSideEffects: true, forceArgs: 'all' },                            assumePrimitive: false },
	{ type: 'function', names: ['mapply', 'Mapply'],                           processor: 'builtin:apply',               config: { indexOfFunction: 0, nameOfFunctionArgument: 'FUN' },                        assumePrimitive: false },
	{ type: 'function', names: ['lapply', 'sapply', 'vapply'],                 processor: 'builtin:apply',               config: { indexOfFunction: 1, nameOfFunctionArgument: 'FUN' },                        assumePrimitive: false },
	{ type: 'function', names: ['Lapply', 'Sapply', 'Vapply'],                 processor: 'builtin:apply',               config: { indexOfFunction: 1, nameOfFunctionArgument: 'FUN' },                        assumePrimitive: false }, /* functool wrappers */
	{ type: 'function', names: ['apply', 'tapply', 'Tapply'],                  processor: 'builtin:apply',               config: { indexOfFunction: 2, nameOfFunctionArgument: 'FUN' },                        assumePrimitive: false },
	{ type: 'function', names: ['print'],                                      processor: 'builtin:default',             config: { returnsNthArgument: 0, forceArgs: 'all' },                                  assumePrimitive: false },
	{ type: 'function', names: ['('],                                          processor: 'builtin:default',             config: { returnsNthArgument: 0 },                                                    assumePrimitive: true  },
	{ type: 'function', names: ['load', 'load_all', 'setwd', 'set.seed'],      processor: 'builtin:default',             config: { hasUnknownSideEffects: true, forceArgs: [true] },                           assumePrimitive: false },
	{ type: 'function', names: ['eval', 'body', 'formals', 'environment'],     processor: 'builtin:default',             config: { hasUnknownSideEffects: true, forceArgs: [true] },                           assumePrimitive: false },
	{ type: 'function', names: ['cat'],                                        processor: 'builtin:default',             config: { forceArgs: 'all' },                                                         assumePrimitive: false },
	{ type: 'function', names: ['switch'],                                     processor: 'builtin:default',             config: { forceArgs: [true] },                                                        assumePrimitive: false },
	{ type: 'function', names: ['return'],                                     processor: 'builtin:default',             config: { returnsNthArgument: 0, cfg: ExitPointType.Return },                         assumePrimitive: false },
	{ type: 'function', names: ['break'],                                      processor: 'builtin:default',             config: { cfg: ExitPointType.Break },                                                 assumePrimitive: false },
	{ type: 'function', names: ['next'],                                       processor: 'builtin:default',             config: { cfg: ExitPointType.Next },                                                  assumePrimitive: false },
	{ type: 'function', names: ['{'],                                          processor: 'builtin:expression-list',     config: {},                                                                           assumePrimitive: true  },
	{ type: 'function', names: ['source'],                                     processor: 'builtin:source',              config: { includeFunctionCall: true, forceFollow: false },                            assumePrimitive: false },
	{ type: 'function', names: ['[', '[['],                                    processor: 'builtin:access',              config: { treatIndicesAsString: false },                                              assumePrimitive: true  },
	{ type: 'function', names: ['$', '@'],                                     processor: 'builtin:access',              config: { treatIndicesAsString: true },                                               assumePrimitive: true  },
	{ type: 'function', names: ['if', 'ifelse'],                               processor: 'builtin:if-then-else',        config: {},                                                                           assumePrimitive: true  },
	{ type: 'function', names: ['get'],                                        processor: 'builtin:get',                 config: {},                                                                           assumePrimitive: false },
	{ type: 'function', names: ['library', 'require'],                         processor: 'builtin:library',             config: {},                                                                           assumePrimitive: false },
	{ type: 'function', names: ['<-', '='],                                    processor: 'builtin:assignment',          config: { canBeReplacement: true },                                                   assumePrimitive: true  },
	{ type: 'function', names: [':=', 'assign'],                               processor: 'builtin:assignment',          config: {},                                                                           assumePrimitive: true  },
	{ type: 'function', names: ['delayedAssign'],                              processor: 'builtin:assignment',          config: { quoteSource: true },                                                        assumePrimitive: true  },
	{ type: 'function', names: ['<<-'],                                        processor: 'builtin:assignment',          config: { superAssignment: true, canBeReplacement: true },                            assumePrimitive: true  },
	{ type: 'function', names: ['->'],                                         processor: 'builtin:assignment',          config: { swapSourceAndTarget: true, canBeReplacement: true },                        assumePrimitive: true  },
	{ type: 'function', names: ['->>'],                                        processor: 'builtin:assignment',          config: { superAssignment: true, swapSourceAndTarget: true, canBeReplacement: true }, assumePrimitive: true  },
	{ type: 'function', names: ['&&', '&'],                                    processor: 'builtin:special-bin-op',      config: { lazy: true, evalRhsWhen: true },                                            assumePrimitive: true  },
	{ type: 'function', names: ['||', '|'],                                    processor: 'builtin:special-bin-op',      config: { lazy: true, evalRhsWhen: false },                                           assumePrimitive: true  },
	{ type: 'function', names: ['|>', '%>%'],                                  processor: 'builtin:pipe',                config: {},                                                                           assumePrimitive: true  },
	{ type: 'function', names: ['function', '\\'],                             processor: 'builtin:function-definition', config: {},                                                                           assumePrimitive: true  },
	{ type: 'function', names: ['quote', 'substitute', 'bquote'],              processor: 'builtin:quote',               config: { quoteArgumentsWithIndex: 0 },                                               assumePrimitive: true  },
	{ type: 'function', names: ['for'],                                        processor: 'builtin:for-loop',            config: {},                                                                           assumePrimitive: true  },
	{ type: 'function', names: ['repeat'],                                     processor: 'builtin:repeat-loop',         config: {},                                                                           assumePrimitive: true  },
	{ type: 'function', names: ['while'],                                      processor: 'builtin:while-loop',          config: {},                                                                           assumePrimitive: true  },
	{ type: 'function', names: ['do.call'],                                    processor: 'builtin:apply',               config: { indexOfFunction: 0, unquoteFunction: true },                                assumePrimitive: true  },
	{
		type:  'function',
		names: [
			'on.exit', 'sys.on.exit', 'par', 'setnames', 'setNames', 'setkey', 'setkeyv', 'setindex', 'setindexv', 'setattr', 'sink',
			/* library and require is handled above */
			'requireNamespace', 'loadNamespace', 'attachNamespace', 'asNamespace',
			/* downloader and installer functions (R, devtools, BiocManager) */
			'library.dynam', 'install.packages','install', 'install_github', 'install_gitlab', 'install_bitbucket', 'install_url', 'install_git', 'install_svn', 'install_local', 'install_version', 'update_packages',
			/* weird env attachments */
			'attach', 'detach', 'unname', 'rm', 'remove'
		],
		processor:       'builtin:default',
		config:          { hasUnknownSideEffects: true },
		assumePrimitive: false
	},
	/* they are all mapped to `<-` but we separate super assignments */
	{
		type:     'replacement',
		suffixes: ['<-', '<<-'],
		names:    ['[', '[[', '$', '@', 'names', 'dimnames', 'attributes', 'attr', 'class', 'levels', 'rownames', 'colnames', 'body', 'environment', 'formals']
	}
];
