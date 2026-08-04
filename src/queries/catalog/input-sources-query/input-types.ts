/**
 * The classification lattice of the {@link InputSourcesQuery|input-sources} analysis, kept free of any imports so
 * that the configuration can name its members without pulling the analysis in.
 * @module
 */

/**
 * Lattice flattening until we have a taint engine :)
 * Please note that the classifier considers this basis with a set-lift,
 * joining differing lattice elements.
 *
 *```
 *                  [ Unknown ]
 *                       |
 *  [Param]  [File]  [Net]  [User], ...
 *     |         |      |      |
 *     |    [TempFile]  |      |
 *     +---------+------+------+- ...
 *                    |
 *            [ DerivedConstant ]
 *                    |
 *               [ Constant ]
 *```
 *
 */
export enum InputType {
	Parameter = 'param',
	File = 'file',
	/** Temporary file paths produced by tempfile()/tempdir() and equivalents; a sub-type of {@link File} */
	TempFile = 'tempfile',
	Network = 'net',
	Random = 'rand',
	/** Calls to system/system2 and similar */
	System = 'system',
	/** Calls to .C / Fortran interfaces (foreign function interfaces) */
	Ffi = 'ffi',
	/** Language objects (quote/substitute/etc.) */
	Lang = 'lang',
	/** Global options / option accessors (options, getOption) */
	Options = 'options',
	/** Interactive user input (file choosers, prompts, dialogs, menu selections) */
	User = 'user',
	Constant = 'const',
	/** Read from environment/call scope */
	Scope = 'scope',
	/** Pure calculations from constants that lead to a constant */
	DerivedConstant = 'dconst',
	Unknown = 'unknown',
}

export enum InputTraceType {
	/** Derived only from aliasing */
	Alias = 'alias',
	/** Derived from pure function chains */
	Pure = 'pure',
	/** Derived from known but not necessarily all pure function chains */
	Known = 'known',
	/** Not fully known origin */
	Unknown = 'unknown'
}
