import type { FunctionInfo } from './function-info';

/**
 * A loader of the `library` category, together with whether it attaches the package it names.
 * @see {@link LibraryFunctions}
 */
export interface LibraryFunctionInfo extends FunctionInfo {
	/**
	 * Whether the call makes the package's exports reachable by their bare name, which is what tells a package
	 * that is loaded and used apart from one that is loaded and never touched. `false` for a loader that only
	 * readies a namespace to reach as `pkg::fn`, and for one whose argument is not a package at all.
	 */
	attaches: boolean
}

export const LibraryFunctions: LibraryFunctionInfo[] = [
	{ package: 'base',         name: 'library',           argIdx: 0,         argName: 'package', resolveValue: 'library', attaches: true },
	{ package: 'base',         name: 'require',           argIdx: 0,         argName: 'package', resolveValue: 'library', attaches: true },
	/* a namespace is loaded, not attached: whoever calls these reaches the package as `pkg::fn` */
	{ package: 'base',         name: 'loadNamespace',     argIdx: 0,         argName: 'package', resolveValue: true,      attaches: false },
	{ package: 'base',         name: 'requireNamespace',  argIdx: 0,         argName: 'package', resolveValue: true,      attaches: false },
	{ package: 'base',         name: 'attachNamespace',   argIdx: 0,         argName: 'ns',      resolveValue: true,      attaches: true },
	/* what is attached here is a list or a data frame, never a package */
	{ package: 'base',         name: 'attach',            argIdx: 0,         argName: 'what',    resolveValue: true,      attaches: false },
	{ package: 'base',         name: 'use',               argIdx: 0,         argName: 'package', resolveValue: 'library', attaches: true },
	{ package: 'groundhog',    name: 'groundhog.library', argIdx: 0,         argName: 'pkg',     resolveValue: true,      attaches: true },
	{ package: 'pacman',       name: 'p_load',            argIdx: 'unnamed',                     resolveValue: 'library', attaches: true },
	{ package: 'pacman',       name: 'p_load_gh',         argIdx: 'unnamed',                     resolveValue: 'library', attaches: true },
	{ package: 'pacman',       name: 'p_load_current_gh', argIdx: 'unnamed',                     resolveValue: 'library', attaches: true },
	{ package: 'xfun',         name: 'pkg_attach',        argIdx: 'unnamed',                     resolveValue: true,      attaches: true },
	{ package: 'xfun',         name: 'pkg_attach2',       argIdx: 'unnamed',                     resolveValue: true,      attaches: true },
	{ package: 'needs',        name: 'needs',             argIdx: 'unnamed',                     resolveValue: 'library', attaches: true },
	{ package: 'modules',      name: 'import',            argIdx: 0,         argName: 'from',    resolveValue: 'library', attaches: true },
	{ package: 'easypackages', name: 'from_import',       argIdx: 0,         argName: 'package', resolveValue: true,      attaches: true },
	{ package: 'easypackages', name: 'libraries',         argIdx: 'unnamed',                     resolveValue: true,      attaches: true },
	{ package: 'librarian',    name: 'shelf',             argIdx: 'unnamed',                     resolveValue: true,      attaches: true },
	{ package: 'devtools',     name: 'load_all',          argIdx: 0,         argName: 'path',    resolveValue: true,      defaultValue: '.', attaches: true },
	/* the code of a package is loaded into its namespace, and nothing is put on the search path */
	{ package: 'pkgload',      name: 'load_code',         argIdx: 0,         argName: 'path',    resolveValue: true,      defaultValue: '.', attaches: false },
	{ package: 'import',       name: 'from',              argIdx: 0,         argName: 'package', resolveValue: true,      attaches: true },
	/* a hook that runs when the package is loaded by someone else, which loads nothing itself */
	{ package: 'rlang',        name: 'on_package_load',   argIdx: 0,         argName: 'pkg',     resolveValue: true,      attaches: false }
] as const;
