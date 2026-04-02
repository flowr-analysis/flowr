import type { FunctionInfo } from './function-info';

export const LibraryFunctions: FunctionInfo[] = [
	{ package: 'base',         name: 'library',           argIdx: 0,         argName: 'package', resolveValue: 'library' },
	{ package: 'base',         name: 'require',           argIdx: 0,         argName: 'package', resolveValue: 'library' },
	{ package: 'base',         name: 'loadNamespace',     argIdx: 0,         argName: 'package', resolveValue: true },
	{ package: 'base',         name: 'attachNamespace',   argIdx: 0,         argName: 'ns',      resolveValue: true },
	{ package: 'base',         name: 'attach',            argIdx: 0,         argName: 'what',    resolveValue: true },
	{ package: 'base',         name: 'use',               argIdx: 0,         argName: 'package', resolveValue: 'library' },
	{ package: 'groundhog',    name: 'groundhog.library', argIdx: 0,         argName: 'pkg',     resolveValue: true },
	{ package: 'pacman',       name: 'p_load',            argIdx: 'unnamed',                     resolveValue: 'library' },
	{ package: 'pacman',       name: 'p_load_gh',         argIdx: 'unnamed',                     resolveValue: 'library' },
	{ package: 'easypackages', name: 'from_import',       argIdx: 0,         argName: 'package', resolveValue: true },
	{ package: 'easypackages', name: 'libraries',         argIdx: 'unnamed',                     resolveValue: true },
	{ package: 'librarian',    name: 'shelf',             argIdx: 'unnamed',                     resolveValue: true },
	{ package: 'devtools',     name: 'load_all',          argIdx: 0,         argName: 'path',    resolveValue: true, defaultValue: '.' },
	{ package: 'devtools',     name: 'load_code',         argIdx: 0,         argName: 'path',    resolveValue: true, defaultValue: '.' },
	{ package: 'import',       name: 'from',              argIdx: 0,         argName: 'package', resolveValue: true }
] as const;