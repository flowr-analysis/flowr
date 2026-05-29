import type { FunctionInfo } from './function-info';

// these lists are originally based on https://github.com/duncantl/CodeDepends/blob/7fd96dfee16b252e5f642c77a7ababf48e9326f8/R/codeTypes.R
export const SourceFunctions: FunctionInfo[] = [
	{ package: 'base',     name: 'source',      argIdx: 0, argName: 'file', resolveValue: true },
	{ package: 'base',     name: 'sys.source',  argIdx: 0, argName: 'file', resolveValue: true },
	{ package: 'devtools', name: 'source_url',  argIdx: 0, argName: 'url',  resolveValue: true },
	{ package: 'devtools', name: 'source_gist', argIdx: 0, argName: 'id',   resolveValue: true }
] as const;