import type { FunctionInfo } from './function-info';

export const OtherPathFunctions: FunctionInfo[] = [
	{ package: 'base', name: 'setwd',         argIdx: 0, argName: 'dir',   resolveValue: true },
	{ package: 'base', name: 'basename',      argIdx: 0, argName: 'path',  resolveValue: true },
	{ package: 'base', name: 'dirname',       argIdx: 0, argName: 'path',  resolveValue: true },
	{ package: 'base', name: 'normalizePath', argIdx: 0, argName: 'path',  resolveValue: true },
	{ package: 'base', name: 'file.info',     argIdx: 'unnamed',           resolveValue: true },
	{ package: 'base', name: 'file.mode',     argIdx: 'unnamed',           resolveValue: true },
	{ package: 'base', name: 'file.mtime',    argIdx: 'unnamed',           resolveValue: true },
	{ package: 'base', name: 'file.size',     argIdx: 'unnamed',           resolveValue: true },
	{ package: 'base', name: 'file.create',   argIdx: 'unnamed',           resolveValue: true },
	{ package: 'base', name: 'file.exists',   argIdx: 'unnamed',           resolveValue: true },
	{ package: 'base', name: 'file.remove',   argIdx: 'unnamed',           resolveValue: true },
	{ package: 'base', name: 'file.rename',   argIdx: 0, argName: 'from',  resolveValue: true },
	{ package: 'base', name: 'file.append',   argIdx: 0, argName: 'file1', resolveValue: true },
	{ package: 'base', name: 'file.copy',     argIdx: 0, argName: 'from',  resolveValue: true },
	{ package: 'base', name: 'file.symlink',  argIdx: 0, argName: 'from',  resolveValue: true },
	{ package: 'base', name: 'file.link',     argIdx: 0, argName: 'from',  resolveValue: true },
	{ package: 'base', name: 'Sys.junction',  argIdx: 0, argName: 'from',  resolveValue: true },
	{ package: 'base', name: 'dir.exists',    argIdx: 0, argName: 'path',  resolveValue: true },
	{ package: 'base', name: 'list.files',    argIdx: 0, argName: 'path',  resolveValue: true, defaultValue: '.' },
	{ package: 'base', name: 'list.dirs',     argIdx: 0, argName: 'path',  resolveValue: true, defaultValue: '.' },
	{ package: 'base', name: 'dir',           argIdx: 0, argName: 'path',  resolveValue: true, defaultValue: '.' }
];
