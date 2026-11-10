import { aboutWord } from './query';
import { ExportFlag, PropFlags } from './export-flags';

/**
 * What every word the page shows means, the one table hovers and filter chips read: the roles and properties as the built-in
 * configuration words them, and the semantic tags and database properties as their documentation in the code does
 * (see `wordDocsForPage` in `scripts/sigdb-index.ts`).
 */
const Docs: Readonly<Record<string, string>> = JSON.parse(document.getElementById('docs')?.textContent ?? '{}') as Record<string, string>;

/** what a role, property, tag, or database property means, `undefined` for a word nothing explains */
export function aboutOf(word: string): string | undefined {
	return aboutWord(word) ?? Docs[word] ?? Docs[word.replaceAll(' ', '-')];
}

/** the database property a flag stands for */
const PropOfFlag: ReadonlyMap<string, string> = new Map(Object.entries(PropFlags).map(([prop, flag]) => [flag, prop]));

interface FlagInfo {
	readonly name:   string;
	readonly short?: string;
	readonly about?: string;
	/** about the database entry, not the function */
	readonly meta?:  boolean;
}

/** how a flag reads on the page and what it means, from the database property it stands for unless it is the page's own */
export const Flags: Readonly<Record<ExportFlag, FlagInfo>> = Object.fromEntries(Object.entries({
	[ExportFlag.CanThrow]:         { name: 'can throw' },
	[ExportFlag.S3Method]:         { name: 'S3 method', short: 's3' },
	[ExportFlag.NonDeterministic]: { name: 'non-deterministic', short: 'nondet' },
	[ExportFlag.CallsDeprecated]:  { name: 'calls something deprecated', short: 'calls depr' },
	[ExportFlag.Recursive]:        { name: 'recursive', short: 'rec' },
	[ExportFlag.CallsInternal]:    { name: 'calls internals', short: 'internal' },
	[ExportFlag.S3Owner]:          { name: 'owns an S3 class', short: 's3 class' },
	[ExportFlag.S4Owner]:          { name: 'owns an S4 class', short: 's4 class' },
	[ExportFlag.S4Method]:         { name: 'S4 method', short: 's4' },
	[ExportFlag.HigherOrder]:      { name: 'higher order', short: 'hof' },
	[ExportFlag.Deprecated]:       { name: 'deprecated', short: 'depr' },
	[ExportFlag.Value]:            { name: 'value', meta: true },
	[ExportFlag.NoLocation]:       { name:  'no loc', meta:  true, about: 'no location: the database records no file and line for it in this package. Usually a constant, a dataset '
		+ 'or a class object, sometimes a function nothing wrote down, like an S4 generic setGeneric builds' },
	[ExportFlag.NoDoc]:  { name: 'no docs', meta: true },
	[ExportFlag.Stated]: { name: '', meta: true }
} satisfies Record<ExportFlag, FlagInfo>).map(([flag, info]: [string, FlagInfo]) => [flag, { ...info, about: info.about ?? Docs[PropOfFlag.get(flag) ?? ''] }])) as Record<ExportFlag, FlagInfo>;

/** what the flag of the given name means, by its name or short form */
export function aboutFlagNamed(name: string): string | undefined {
	return Object.values(Flags).find(flag => flag.name === name || flag.short === name)?.about;
}

/** what flowR's dependency query takes a name for, as a chip reads and what it means */
export const Kinds: Readonly<Record<string, { readonly label: string, readonly about: string }>> = {
	library:    { label: 'can load a package', about: 'attaches a package, like library or require' },
	source:     { label: 'can source a file', about: 'runs the R code of another file, like source' },
	read:       { label: 'can read a file', about: 'reads data from somewhere outside the program, like read.csv' },
	write:      { label: 'can write a file', about: 'writes data out of the program, like write.csv' },
	visualize:  { label: 'can draw a plot', about: 'draws something, like plot or ggsave' },
	test:       { label: 'a test', about: 'a test expectation or test runner, like testthat::expect_equal' },
	remote:     { label: 'can use the network', about: 'reaches the network, like download.file' },
	statistics: { label: 'statistics', about: 'a statistical function flowR\'s dependency query knows' },
	builtin:    { label: 'flowR', about: 'flowR knows the name itself: its built-in configuration says what a call does, which the signature shows' }
};

/** where a package comes from, as the tag of an owner row reads */
export const Origins: Readonly<Record<'base' | 'cran', { readonly label: string, readonly about: string }>> = {
	base: { label: 'base R', about: 'ships with R, so every R session has it' },
	cran: { label: 'CRAN', about: 'a package installed from a repository, CRAN or another one the database names' }
};
