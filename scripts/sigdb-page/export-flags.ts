/** the letters the names blob records per package exporting a name, see `encode` in `scripts/sigdb-index.ts` */
export enum ExportFlag {
	CanThrow = 't',
	S3Method = '3',
	NonDeterministic = 'n',
	CallsDeprecated = 'd',
	Recursive = 'r',
	CallsInternal = 'i',
	S3Owner = 'o',
	S4Owner = '4',
	S4Method = 'm',
	Value = 'c',
	HigherOrder = 'h',
	Deprecated = 'x',
	NoDoc = 'u',
	NoLocation = 'v',
	/** the database does not list the name for the package, flowR states a signature for it there */
	Stated = '?'
}

/** the flag each property of the database stands for */
export const PropFlags: Readonly<Record<string, ExportFlag>> = {
	'can-throw':         ExportFlag.CanThrow,
	's3-method':         ExportFlag.S3Method,
	'non-deterministic': ExportFlag.NonDeterministic,
	'calls-deprecated':  ExportFlag.CallsDeprecated,
	'recursive':         ExportFlag.Recursive,
	'calls-internal':    ExportFlag.CallsInternal,
	's3-owner':          ExportFlag.S3Owner,
	's4-owner':          ExportFlag.S4Owner,
	's4-method':         ExportFlag.S4Method,
	'value':             ExportFlag.Value,
	'higher-order':      ExportFlag.HigherOrder,
	'deprecated':        ExportFlag.Deprecated,
	'no-doc':            ExportFlag.NoDoc
};
