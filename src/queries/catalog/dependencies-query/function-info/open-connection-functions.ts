import type { FunctionInfo } from './function-info';

export const OpenConnectionFunctions: FunctionInfo[] = [
	{ package: 'base',         name: 'textConnection',    argIdx: 0,          argName: 'package', resolveValue: true },
	{ package: 'base',         name: 'open',              argIdx: 0,          argName: 'package', resolveValue: true },
	{ package: 'base',         name: 'file',              argIdx: 0,          argName: 'package', resolveValue: true },
	{ package: 'base',         name: 'url',              argIdx: 0,          argName: 'package', resolveValue: true },
	{ package: 'base',         name: 'gzfile',              argIdx: 0,          argName: 'package', resolveValue: true },
	{ package: 'base',         name: 'bzfile',              argIdx: 0,          argName: 'package', resolveValue: true },
	{ package: 'base',         name: 'xzfile',              argIdx: 0,          argName: 'package', resolveValue: true },
	{ package: 'base',         name: 'file',              argIdx: 0,          argName: 'package', resolveValue: true },
	{ package: 'base',         name: 'unz',              argIdx: 0,          argName: 'package', resolveValue: true },
] as const;