import type { FunctionInfo } from './function-info';

const DplyrVerbs = ['mutate', 'transmute', 'filter', 'select', 'rename', 'relocate', 'arrange', 'summarise', 'summarize', 'group_by',
	'ungroup', 'distinct', 'count', 'tally', 'add_count', 'add_tally', 'slice', 'slice_head', 'slice_tail', 'slice_min', 'slice_max',
	'slice_sample', 'rename_with', 'reframe'];
/** the scoped variants (`mutate_at`, `filter_if`, ...) of the verbs that have them */
const DplyrScoped = ['mutate', 'transmute', 'filter', 'select', 'rename', 'arrange', 'summarise', 'summarize', 'group_by', 'distinct']
	.flatMap(verb => ['all', 'at', 'if'].map(scope => `${verb}_${scope}`));
const DplyrJoins = ['left_join', 'right_join', 'inner_join', 'full_join', 'semi_join', 'anti_join', 'nest_join', 'cross_join',
	'bind_rows', 'bind_cols'];

const Tidyr = ['pivot_longer', 'pivot_wider', 'gather', 'spread', 'separate', 'separate_rows', 'separate_wider_delim', 'separate_wider_position',
	'separate_wider_regex', 'separate_longer_delim', 'separate_longer_position', 'unite', 'drop_na', 'fill', 'replace_na', 'complete', 'expand',
	'nest', 'unnest', 'unnest_longer', 'unnest_wider', 'hoist', 'chop', 'unchop', 'uncount'];

const DataTable = ['setDT', 'as.data.table', 'setorder', 'setorderv', 'setnames', 'setcolorder', 'melt', 'dcast', 'rbindlist'];

/**
 * The calls that reshape, filter, join or aggregate data. Every entry names its package, so `filter` only
 * counts when it resolves to dplyr and never for the time-series `stats::filter`.
 */
export const TransformFunctions: readonly FunctionInfo[] = [
	...[...DplyrVerbs, ...DplyrScoped, ...DplyrJoins].map(name => ({ package: 'dplyr', name })),
	...Tidyr.map(name => ({ package: 'tidyr', name })),
	...['subset', 'transform', 'within', 'merge', 'rbind', 'cbind'].map(name => ({ package: 'base', name })),
	...['aggregate', 'reshape', 'na.omit'].map(name => ({ package: 'stats', name })),
	...[...DataTable, 'merge.data.table'].map(name => ({ package: 'data.table', name })),
	...['add_column', 'add_row'].map(name => ({ package: 'tibble', name }))
];
