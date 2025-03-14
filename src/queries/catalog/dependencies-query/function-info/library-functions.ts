import type { FunctionInfo } from './function-info';

export const LibraryFunctions: FunctionInfo[] = [
	// base
	{ package: 'base',         name: 'library',           argIdx: 0,         argName: 'package', resolveValue: 'library' },
	{ package: 'base',         name: 'require',           argIdx: 0,         argName: 'package', resolveValue: 'library' },
	{ package: 'base',         name: 'loadNamespace',     argIdx: 0,         argName: 'package', resolveValue: true },
	{ package: 'base',         name: 'attachNamespace',   argIdx: 0,         argName: 'ns',      resolveValue: true },
	{ package: 'base',         name: 'attach',            argIdx: 0,         argName: 'what',    resolveValue: true },
	{ package: 'base',         name: 'groundhog.library', argIdx: 0,         argName: 'pkg',     resolveValue: true },
	// pacman
	{ package: 'pacman',       name: 'p_load',            argIdx: 'unnamed',                     resolveValue: 'library' }, 
	{ package: 'pacman',       name: 'p_load_gh',         argIdx: 'unnamed',                     resolveValue: 'library' }, 
	// easypackages
	{ package: 'easypackages', name: 'from_import',       argIdx: 0,         argName: 'package', resolveValue: true }, 
	{ package: 'easypackages', name: 'libraries',         argIdx: 'unnamed',                     resolveValue: true }, 
	// librarian
	{ package: 'librarian',    name: 'shelf',             argIdx: 'unnamed',                     resolveValue: true },
	// devtools
	{ package: 'devtools',     name: 'load_all',          argIdx: 0,         argName: 'path',    resolveValue: true }
] as const;