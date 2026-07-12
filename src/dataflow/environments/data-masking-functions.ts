import { Identifier, PkgName } from './identifier';

/**
 * Functions that data-mask their non-first argument: the symbols passed there name columns of the first
 * (data) argument, not variables in scope. The {@link DefaultBuiltinConfig} marks those arguments
 * {@link EdgeType.NonStandardEvaluation|NSE}; the pipe processor ({@link processPipe}) re-applies the same
 * treatment when the data is supplied through `%>%`/`|>` (then every explicit argument is a column).
 */
export const DataMaskingFunctions: readonly (readonly [string, PkgName])[] = [
	['subset', PkgName.Base],                    ['transform', PkgName.Base],
	['filter', PkgName.Dplyr],                   ['filter_out', PkgName.Janitor],
	['mutate', PkgName.Dplyr],                   ['transmute', PkgName.Dplyr],
	['summarise', PkgName.Dplyr],                ['summarize', PkgName.Dplyr],
	['arrange', PkgName.Dplyr],                  ['group_by', PkgName.Dplyr],
	['distinct', PkgName.Dplyr],                 ['count', PkgName.Dplyr],
	['tally', PkgName.Dplyr],                    ['reframe', PkgName.Dplyr],
	['slice', PkgName.Dplyr],                    ['slice_head', PkgName.Dplyr],
	['slice_tail', PkgName.Dplyr],               ['slice_min', PkgName.Dplyr],
	['slice_max', PkgName.Dplyr],                ['slice_sample', PkgName.Dplyr],
	['pull', PkgName.Dplyr],                     ['rename', PkgName.Dplyr],
	['relocate', PkgName.Dplyr],                 ['select', PkgName.Dplyr],
	['group_split', PkgName.Dplyr],              ['add_count', PkgName.Dplyr],
	['add_tally', PkgName.Dplyr],                ['nest_by', PkgName.Dplyr],
	['pivot_longer', PkgName.TidyR],             ['pivot_wider', PkgName.TidyR],
	['gather', PkgName.TidyR],                   ['spread', PkgName.TidyR],
	['separate', PkgName.TidyR],                 ['separate_rows', PkgName.TidyR],
	['separate_wider_delim', PkgName.TidyR],     ['separate_wider_regex', PkgName.TidyR],
	['separate_wider_position', PkgName.TidyR],  ['unite', PkgName.TidyR],
	['extract', PkgName.TidyR],                  ['nest', PkgName.TidyR],
	['unnest', PkgName.TidyR],                   ['unnest_longer', PkgName.TidyR],
	['unnest_wider', PkgName.TidyR],             ['hoist', PkgName.TidyR],
	['chop', PkgName.TidyR],                     ['unchop', PkgName.TidyR],
	['pack', PkgName.TidyR],                     ['unpack', PkgName.TidyR],
	['drop_na', PkgName.TidyR],                  ['fill', PkgName.TidyR],
	['replace_na', PkgName.TidyR],               ['complete', PkgName.TidyR],
	['expand', PkgName.TidyR],                   ['crossing', PkgName.TidyR],
	['nesting', PkgName.TidyR],                  ['expand_grid', PkgName.TidyR],
	['uncount', PkgName.TidyR]
];

/** The {@link DataMaskingFunctions} as {@link Identifier}s, for the built-in configuration. */
export const DataMaskingFunctionIdentifiers = DataMaskingFunctions.map(([name, pkg]) => Identifier.from([name, pkg]));

/** Names to treat as data-masking in the pipe: the {@link DataMaskingFunctions} plus `with`/`within` (own processor). */
export const DataMaskingFunctionNames: ReadonlySet<string> = new Set([...DataMaskingFunctions.map(([name]) => name), 'with', 'within']);
