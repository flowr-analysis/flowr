import { fn, pkg, Primitive, Overrides, Deprecated } from './define';
import { Identifier, PkgName } from '../identifier';
import { BuiltInProcName } from '../built-in-proc-name';
import { NseArguments } from '../../internal/process/functions/call/nse-kind';
import { Unquote } from '../../internal/process/functions/call/nse';
import { ArgProp, CallProp, SemanticCallTag } from '../built-in-props';
import { AmbientStateAccessType } from '../../internal/process/functions/call/built-in/built-in-ambient-state';
import { SigDataDots, sig, Forced } from './signatures';
import { TidyEvalPackages } from './shared';
import type { AnyBuiltInDefinition } from '../built-in-config';

/** The built-in definitions of the tidyverse and related data-manipulation packages. */
export const TidyverseDefinitions = [
	/* slice_sample draws rows at random; registered after the block above, so this definition is the one that sticks */
	fn(pkg(PkgName.Dplyr, 'slice_sample'), BuiltInProcName.Default,
		{
			markArgsAsMasked: NseArguments.AllButFirst,
			ambient:          { type: AmbientStateAccessType.DrawRng },
			tags:             [SemanticCallTag.Random, SemanticCallTag.Transforms]
		},
		Overrides
	),
	fn(pkg(PkgName.Dplyr, 'copy_to'), BuiltInProcName.Default,
		{
			libFn: true,
			tags:  [SemanticCallTag.Database, SemanticCallTag.Writes],
			sig:   sig({ dest: Forced.Handle, df: Forced.Value, name: Forced.Resource, '...': Forced.Value })
		}
	),
	fn(pkg(PkgName.Rlang, 'with_options'), BuiltInProcName.Default,
		{ libFn: true, props: CallProp.Configures, scope: { state: 'options', params: ['.expr', '...'], code: '.expr' } }
	),
	fn(pkg(PkgName.Rlang, 'local_options'), BuiltInProcName.Default,
		{ libFn: true, props: CallProp.Configures | CallProp.Invisible, scope: { state: 'options', params: ['...', '.frame'] } }
	),
	fn(pkg(PkgName.Functools, 'Lapply', 'Sapply', 'Vapply'), BuiltInProcName.Apply,
		{ indexOfFunction: 1, nameOfFunctionArgument: 'FUN', unquoteFunction: true, props: CallProp.MayPure }
	),
	fn(pkg(PkgName.Dplyr, 'if_else'), BuiltInProcName.IfThenElse,
		{ args: { cond: 'condition', yes: 'true', no: 'false' }, props: CallProp.Pure }, Primitive
	),
	fn(pkg(PkgName.Magrittr, '%<>%'), BuiltInProcName.Pipe,
		{ pipePlaceholderName: '.', assignLhs: true, returnLhs: false, rhsMightBeSymbol: true, props: CallProp.Invisible | CallProp.Scope },
		Primitive
	),
	fn(pkg(PkgName.Magrittr, '%T>%'), BuiltInProcName.Pipe,
		{ pipePlaceholderName: '.', assignLhs: false, returnLhs: true, rhsMightBeSymbol: true, sig: sig({ lhs: ArgProp.Alias, rhs: ArgProp.Value }) },
		Primitive
	),
	fn(pkg(PkgName.Purrr, 'map', 'map_lgl', 'map_int', 'map_dbl', 'map_chr'), BuiltInProcName.PurrrFormula,
		{ props: CallProp.MayPure, args: { '.x': { index: 0, name: '.x' } }, '.f': { index: 1, name: '.f' }, ignore: ['.progress'] }
	),
	fn(pkg(PkgName.Purrr, 'pmap', 'pmap_lgl', 'pmap_int', 'pmap_dbl', 'pmap_chr'), BuiltInProcName.PurrrFormula,
		{ props: CallProp.MayPure, args: { '.l': { index: 0, name: '.l' } }, '.f': { index: 1, name: '.f' }, ignore: ['.progress'] }
	),
	fn(pkg(PkgName.Purrr, 'map2', 'map2_lgl', 'map2_int', 'map2_dbl', 'map2_chr'), BuiltInProcName.PurrrFormula,
		{
			props:  CallProp.MayPure,
			args:   { '.x': { index: 0, name: '.x' }, '.y': { index: 1, name: '.y' } },
			'.f':   { index: 2, name: '.f' },
			ignore: ['.progress']
		}
	),
	fn(pkg(PkgName.Purrr, 'modify', 'imodify', 'imap', 'imap_lgl', 'imap_int', 'imap_dbl', 'imap_chr', 'imap_vec', 'lmap'), BuiltInProcName.PurrrFormula,
		{ props: CallProp.MayPure, args: { '.x': { index: 0, name: '.x' } }, '.f': { index: 1, name: '.f' }, ignore: [] }
	),
	fn(pkg(PkgName.Purrr, 'modify2'), BuiltInProcName.PurrrFormula,
		{
			props:  CallProp.MayPure,
			args:   { '.x': { index: 0, name: '.x' }, '.y': { index: 1, name: '.y' } },
			'.f':   { index: 2, name: '.f' },
			ignore: []
		}
	),
	fn(pkg(PkgName.Purrr, 'map_at', 'modify_at'), BuiltInProcName.PurrrFormula,
		{
			props:  CallProp.MayPure,
			args:   { '.x': { index: 0, name: '.x' }, '.at': { index: 1, name: '.at' } },
			'.f':   { index: 2, name: '.f' },
			ignore: ['.progress']
		}
	),
	fn(pkg(PkgName.Purrr, 'lmap_at'), BuiltInProcName.PurrrFormula,
		{
			props:  CallProp.MayPure,
			args:   { '.x': { index: 0, name: '.x' }, '.at': { index: 1, name: '.at' } },
			'.f':   { index: 2, name: '.f' },
			ignore: []
		}
	),
	fn(pkg(PkgName.Purrr, 'map_if', 'modify_if', 'lmap_if'), BuiltInProcName.PurrrFormula,
		{
			props:  CallProp.MayPure,
			args:   { '.x': { index: 0, name: '.x' }, '.p': { index: 1, name: '.p' } },
			'.f':   { index: 2, name: '.f' },
			ignore: ['.else']
		}
	),
	fn(pkg(PkgName.Purrr, 'walk'), BuiltInProcName.PurrrFormula,
		{
			props:     CallProp.MayPure | CallProp.Invisible,
			args:      { '.x': { index: 0, name: '.x' } },
			'.f':      { index: 1, name: '.f' },
			ignore:    ['.progress'],
			returnArg: '.x'
		}
	),
	fn(pkg(PkgName.Purrr, 'iwalk'), BuiltInProcName.PurrrFormula,
		{
			props:     CallProp.MayPure | CallProp.Invisible,
			args:      { '.x': { index: 0, name: '.x' } },
			'.f':      { index: 1, name: '.f' },
			ignore:    [],
			returnArg: '.x'
		}
	),
	fn(pkg(PkgName.Purrr, 'pwalk'), BuiltInProcName.PurrrFormula,
		{
			props:     CallProp.MayPure | CallProp.Invisible,
			args:      { '.l': { index: 0, name: '.l' } },
			'.f':      { index: 1, name: '.f' },
			ignore:    ['.progress'],
			returnArg: '.l'
		}
	),
	fn(pkg(PkgName.Purrr, 'walk2'), BuiltInProcName.PurrrFormula,
		{
			props:     CallProp.MayPure | CallProp.Invisible,
			args:      { '.x': { index: 0, name: '.x' }, '.y': { index: 1, name: '.y' } },
			'.f':      { index: 2, name: '.f' },
			ignore:    ['.progress'],
			returnArg: '.x'
		}
	),
	fn(pkg(PkgName.Purrr, 'map_vec'), BuiltInProcName.PurrrFormula,
		{ props: CallProp.MayPure, args: { '.x': { index: 0, name: '.x' } }, '.f': { index: 1, name: '.f' }, ignore: ['.progress', '.ptype'] }
	),
	fn(pkg(PkgName.Purrr, 'pmap_vec'), BuiltInProcName.PurrrFormula,
		{ props: CallProp.MayPure, args: { '.l': { index: 0, name: '.l' } }, '.f': { index: 1, name: '.f' }, ignore: ['.progress', '.ptype'] }
	),
	fn(pkg(PkgName.Purrr, 'map_depth', 'modify_depth'), BuiltInProcName.PurrrFormula,
		{
			props:  CallProp.MayPure,
			args:   { '.x': { index: 0, name: '.x' }, '.depth': { index: 2, name: '.depth' } },
			'.f':   { index: 2, name: '.f' },
			ignore: ['.ragged', '.is_node']
		}
	),
	fn(pkg(PkgName.Purrr, 'map2_vec'), BuiltInProcName.PurrrFormula,
		{
			props:  CallProp.MayPure,
			args:   { '.x': { index: 0, name: '.x' }, '.y': { index: 1, name: '.y' } },
			'.f':   { index: 2, name: '.f' },
			ignore: ['.progress', '.ptype']
		}
	),
	fn(pkg(PkgName.Dplyr, 'across'), BuiltInProcName.PurrrFormula,
		{ props: CallProp.MayPure, args: { '.x': { index: 0, name: '.cols' } }, '.f': { index: 1, name: '.fns' }, ignore: ['.names', '.unpack'] }
	),
	fn(pkg(PkgName.Dplyr, 'rename_with'), BuiltInProcName.PurrrFormula,
		{
			props:  CallProp.MayPure,
			tags:   [SemanticCallTag.Transforms],
			args:   { '.x': { index: 0, name: '.data' } },
			'.f':   { index: 1, name: '.fn' },
			ignore: ['.cols']
		}
	),
	/* the rlang functions that capture unevaluated, the rest take a value */
	fn([...Identifier.fromAllIn(TidyEvalPackages, ['quo', 'quos', 'expr']), ...pkg(PkgName.Rlang, 'exprs')], BuiltInProcName.Quote,
		{ quoteArgumentsWithIndex: 0, unquote: Unquote.Rlang, keepEnvironment: true, libFn: true, props: CallProp.Lang }, Primitive
	),
	fn(pkg(PkgName.Rlang, 'exec'), BuiltInProcName.Apply,
		{
			indexOfFunction:        0,
			nameOfFunctionArgument: '.fn',
			unquoteFunction:        true,
			hasUnknownSideEffects:  true,
			libFn:                  true,
			props:                  CallProp.MayPure,
			sig:                    sig({ '.fn': ArgProp.Callee, '...': ArgProp.Value })
		}
	),
	fn(pkg(PkgName.Purrr, 'invoke', 'invoke_map'), BuiltInProcName.Apply,
		{
			indexOfFunction:        0,
			nameOfFunctionArgument: '.f',
			unquoteFunction:        true,
			hasUnknownSideEffects:  true,
			libFn:                  true,
			props:                  CallProp.MayPure,
			tags:                   [SemanticCallTag.Deprecated],
			sig:                    sig({ '.f': ArgProp.Callee, '...': ArgProp.Value })
		}
	),
	fn([...pkg(PkgName.Glue, 'glue', 'glue_safe', 'glue_collapse'), ...pkg(PkgName.Stringr, 'str_glue')], BuiltInProcName.StringTemplate,
		{ props: CallProp.MayPure }
	),
	fn(pkg(PkgName.Stringr, 'str_interp'), BuiltInProcName.StringTemplate, { open: '${', props: CallProp.MayPure }),
	fn(pkg(PkgName.Wrapr, 'sinterp', 'si'), BuiltInProcName.StringTemplate, { open: '.(', close: ')', props: CallProp.MayPure }),
	fn(pkg(PkgName.Stringmagic, 'string_magic', '.string_magic', 'sma'), BuiltInProcName.StringTemplate, { props: CallProp.MayPure }),
	fn(pkg(PkgName.Purrr, 'partial'), BuiltInProcName.S7MakeConstructor, { wrapIndex: 0, wrapName: '.f' }, Primitive),
	fn(pkg(PkgName.Plyr, 'ddply'), BuiltInProcName.Apply,
		{ unquoteFunction: true, indexOfFunction: 2, nameOfFunctionArgument: '.fun', libFn: true, tags: [SemanticCallTag.Transforms] }
	),
	fn(pkg(PkgName.Rlang, 'on_load'), BuiltInProcName.Default,
		{
			libFn: true,
			props: CallProp.Invisible | CallProp.Scope | CallProp.MayPure,
			sig:   sig({ expr: ArgProp.Forced, env: ArgProp.Value, ns: ArgProp.Value })
		}
	),
	fn(pkg(PkgName.Rlang, 'on_package_load'), BuiltInProcName.Default,
		{
			libFn: true,
			props: CallProp.Invisible | CallProp.Scope | CallProp.MayPure,
			sig:   sig({ pkg: ArgProp.Value, expr: ArgProp.Forced, env: ArgProp.Value })
		}
	),
	fn(pkg(PkgName.Rlang, 'run_on_load'), BuiltInProcName.Default,
		{ libFn: true, props: CallProp.Invisible | CallProp.Scope | CallProp.MayPure, sig: sig({ ns: ArgProp.Value }) }
	),
	/* the tidy-eval sinks (`!!`, `{{`) are no calls flowR sees, so the text is checked where it turns into code */
	fn(pkg(PkgName.Rlang, 'parse_expr', 'parse_exprs'), BuiltInProcName.Default,
		{ libFn: true, props: CallProp.Lang, sig: sig({ x: Forced.Value | ArgProp.Injectable }) }
	),
	fn(pkg(PkgName.Rlang, 'eval_tidy'), BuiltInProcName.Default,
		{
			libFn: true,
			props: CallProp.Lang,
			tags:  [SemanticCallTag.Eval],
			sig:   sig({ expr: Forced.Value | ArgProp.Injectable, data: Forced.Value, env: Forced.Value })
		}
	),
	fn(pkg(PkgName.Rlang, 'eval_bare'), BuiltInProcName.Default,
		{ libFn: true, props: CallProp.Lang, tags: [SemanticCallTag.Eval], sig: sig({ expr: Forced.Value | ArgProp.Injectable, env: Forced.Value }) }
	),
	fn([
		...Identifier.fromAllIn(TidyEvalPackages, ['enexpr', 'enexprs', 'enquo', 'enquos', 'ensym', 'ensyms', 'sym', 'syms', 'quo_name', 'as_label']),
		...pkg(PkgName.Rlang,
			'inject', 'enquo0', 'enquos0', 'new_formula', 'f_rhs', 'f_lhs', 'fn_body', 'fn_fmls', 'fn_fmls_names', 'call2', 'as_name', 'as_string'
		)
	], BuiltInProcName.Default, { libFn: true, props: CallProp.Lang, sig: sig({ '...': ArgProp.Forced }) }),
	fn(pkg(PkgName.Glue, 'glue_sql', 'glue_data_sql'), BuiltInProcName.Default,
		{ libFn: true, sig: sig({ '...': Forced.Value | ArgProp.Injectable, '.con': ArgProp.Handle, '.envir': ArgProp.Value, '.na': ArgProp.Value }) }
	),
	fn([...pkg(PkgName.Dplyr, 'sql'), ...pkg(PkgName.DbPlyr, 'sql')], BuiltInProcName.Default,
		{ libFn: true, tags: [SemanticCallTag.Database], sig: sig({ '...': Forced.Value | ArgProp.Injectable }) }
	),

	/* the tidyverse verbs, under the names R declares them with. They keep the data mask the group above
	   gives them; what this adds is which argument is the data and what the further ones are called */
	fn(pkg(PkgName.Dplyr, 'mutate', 'select', 'rename'), BuiltInProcName.Default,
		{ markArgsAsMasked: NseArguments.AllButFirst, props: CallProp.Pure, tags: [SemanticCallTag.Transforms], sig: SigDataDots }, Overrides
	),
	/* `transmute` is one of them and deprecated on top of it */
	fn(pkg(PkgName.Dplyr, 'transmute'), BuiltInProcName.Default,
		{ markArgsAsMasked: NseArguments.AllButFirst, props: CallProp.Pure, tags: [SemanticCallTag.Transforms], sig: SigDataDots }, Overrides
	),
	fn(pkg(PkgName.Dplyr, 'filter', 'slice'), BuiltInProcName.Default,
		{
			markArgsAsMasked: NseArguments.AllButFirst,
			props:            CallProp.Pure,
			tags:             [SemanticCallTag.Transforms],
			sig:              [...SigDataDots, ['.by', ArgProp.Value], ['.preserve', ArgProp.Flag]]
		},
		Overrides
	),
	fn(pkg(PkgName.Dplyr, 'summarise', 'summarize'), BuiltInProcName.Default,
		{
			markArgsAsMasked: NseArguments.AllButFirst,
			props:            CallProp.Pure,
			tags:             [SemanticCallTag.Transforms],
			sig:              [...SigDataDots, ['.by', ArgProp.Value], ['.groups', ArgProp.Flag]]
		},
		Overrides
	),
	fn(pkg(PkgName.Dplyr, 'arrange'), BuiltInProcName.Default,
		{
			markArgsAsMasked: NseArguments.AllButFirst,
			props:            CallProp.Pure,
			tags:             [SemanticCallTag.Transforms],
			sig:              [...SigDataDots, ['.by_group', ArgProp.Flag]]
		},
		Overrides
	),
	fn(pkg(PkgName.Dplyr, 'group_by'), BuiltInProcName.Default,
		{
			markArgsAsMasked: NseArguments.AllButFirst,
			props:            CallProp.Pure,
			tags:             [SemanticCallTag.Transforms],
			sig:              [...SigDataDots, ['.add', ArgProp.Flag], ['.drop', ArgProp.Flag]]
		},
		Overrides
	),
	fn(pkg(PkgName.Dplyr, 'distinct'), BuiltInProcName.Default,
		{
			markArgsAsMasked: NseArguments.AllButFirst,
			props:            CallProp.Pure,
			tags:             [SemanticCallTag.Transforms],
			sig:              [...SigDataDots, ['.keep_all', ArgProp.Flag]]
		},
		Overrides
	),
	fn(pkg(PkgName.Dplyr, 'relocate'), BuiltInProcName.Default,
		{
			markArgsAsMasked: NseArguments.AllButFirst,
			props:            CallProp.Pure,
			tags:             [SemanticCallTag.Transforms],
			sig:              [...SigDataDots, ['.before', ArgProp.Value], ['.after', ArgProp.Value]]
		},
		Overrides
	),
	fn(pkg(PkgName.Dplyr, 'count'), BuiltInProcName.Default,
		{
			markArgsAsMasked: NseArguments.AllButFirst,
			props:            CallProp.Pure,
			tags:             [SemanticCallTag.Transforms],
			sig:              sig({ x: ArgProp.Value, '...': ArgProp.Value, wt: ArgProp.Value, sort: ArgProp.Flag, name: ArgProp.Value })
		},
		Overrides
	),
	fn(pkg(PkgName.Dplyr, 'pull'), BuiltInProcName.Default,
		{
			markArgsAsMasked: NseArguments.AllButFirst,
			props:            CallProp.Pure,
			tags:             [SemanticCallTag.Transforms],
			sig:              sig({ '.data': ArgProp.Value, var: ArgProp.Value, name: ArgProp.Value, '...': ArgProp.Value })
		},
		Overrides
	),
	fn(pkg(PkgName.TidyR, 'nest'), BuiltInProcName.Default,
		{ markArgsAsMasked: NseArguments.AllButFirst, props: CallProp.Pure, tags: [SemanticCallTag.Transforms], sig: SigDataDots }, Overrides
	),
	/* `drop_na` names its first argument `data`, not `.data`, so it gets a line of its own */
	fn(pkg(PkgName.TidyR, 'drop_na'), BuiltInProcName.Default,
		{
			markArgsAsMasked: NseArguments.AllButFirst,
			props:            CallProp.Pure,
			tags:             [SemanticCallTag.Transforms],
			sig:              sig({ data: ArgProp.Value, '...': ArgProp.Value })
		},
		Overrides
	),
	fn(pkg(PkgName.TidyR, 'pivot_longer'), BuiltInProcName.Default,
		{
			markArgsAsMasked: NseArguments.AllButFirst,
			props:            CallProp.Pure,
			tags:             [SemanticCallTag.Transforms],
			sig:              sig({ data: ArgProp.Value, cols: ArgProp.Value, '...': ArgProp.Value, names_to: ArgProp.Value, values_to: ArgProp.Value })
		},
		Overrides
	),
	fn(pkg(PkgName.TidyR, 'pivot_wider'), BuiltInProcName.Default,
		{
			markArgsAsMasked: NseArguments.AllButFirst,
			props:            CallProp.Pure,
			tags:             [SemanticCallTag.Transforms],
			sig:              sig({ data: ArgProp.Value, '...': ArgProp.Value, names_from: ArgProp.Value, values_from: ArgProp.Value })
		},
		Overrides
	),
	fn(pkg(PkgName.TidyR, 'separate'), BuiltInProcName.Default,
		{
			markArgsAsMasked: NseArguments.AllButFirst,
			props:            CallProp.Pure,
			tags:             [SemanticCallTag.Transforms],
			sig:              sig({
				data:    ArgProp.Value,
				col:     ArgProp.Value,
				into:    ArgProp.Value,
				sep:     ArgProp.Value,
				remove:  ArgProp.Flag,
				convert: ArgProp.Flag
			})
		},
		Overrides
	),
	fn(pkg(PkgName.TidyR, 'unite'), BuiltInProcName.Default,
		{
			markArgsAsMasked: NseArguments.AllButFirst,
			props:            CallProp.Pure,
			tags:             [SemanticCallTag.Transforms],
			sig:              sig({ data: ArgProp.Value, col: ArgProp.Value, '...': ArgProp.Value, sep: ArgProp.Value, remove: ArgProp.Flag })
		},
		Overrides
	),
	fn(pkg(PkgName.Dplyr,
		'id', 'progress_estimated', 'add_rownames', 'tbl_df', 'src_local', 'summarise_each', 'summarize_', 'summarise_', 'slice_', 'select_vars_',
		'select_', 'rename_vars_', 'rename_', 'transmute_', 'tally_', 'mutate_', 'group_indices_', 'group_by_', 'funs_', 'filter_', 'do_',
		'distinct_', 'count_', 'arrange_', 'add_tally_', 'add_count_', 'funs', 'combine', 'changes', 'location', 'eval_tbls2', 'eval_tbls',
		'compare_tbls2', 'compare_tbls', 'bench_tbls', 'current_vars', 'select_var', 'rename_vars', 'select_vars', 'failwith', 'all_equal'
	), BuiltInProcName.DefaultReadAllArgs, Deprecated),
	fn([Identifier.make('fct_explicit_na', PkgName.Forecats)], BuiltInProcName.DefaultReadAllArgs, Deprecated),
	/* deprecated, but still data-masking: restating the mask keeps the column names out of the variable resolution */
	fn([...pkg(PkgName.Dplyr, 'with_groups'), ...pkg(PkgName.TidyR, 'spread', 'separate_rows', 'gather', 'extract')], BuiltInProcName.Default,
		{ markArgsAsMasked: NseArguments.AllButFirst, props: CallProp.Pure, tags: [SemanticCallTag.Transforms] }, Overrides
	),
	fn(pkg(PkgName.Plyr, 'liply', 'isplit2'), BuiltInProcName.DefaultReadAllArgs, Deprecated),
	fn(pkg(PkgName.Purrr,
		'reduce_right', 'map_raw', 'update_list', 'when', 'rdunif', 'rbernoulli', 'splice', 'rerun', 'prepend', 'at_depth', 'cross', 'list_along'
	), BuiltInProcName.DefaultReadAllArgs, Deprecated),
	fn(pkg(PkgName.Tibble, 'is.tibble', 'trunc_mat', 'frame_data', 'as.tibble', 'as_data_frame', 'lst_', 'data_frame_', 'tibble_', 'data_frame'), BuiltInProcName.DefaultReadAllArgs,
		Deprecated
	),
	fn(pkg(PkgName.TidyR,
		'unnest_', 'unite_', 'spread_', 'separate_', 'separate_rows_', 'nest_', 'gather_', 'fill_', 'extract_', 'nesting_', 'crossing_', 'expand_',
		'drop_na_', 'complete_', 'extract_numeric'
	), BuiltInProcName.DefaultReadAllArgs, Deprecated),
	/* superseded or experimental in their lifecycle, which is no deprecation */
	fn([
		...pkg(PkgName.Dplyr, 'top_n', 'sample_n', 'recode', 'group_nest', 'do', 'all_vars', 'vars'),
		...pkg(PkgName.Purrr, 'transpose', 'as_vector', 'map_dfr', 'flatten'),
		...pkg(PkgName.Tibble, 'repair_names', 'set_tidy_names', 'tidy_names'),
		...pkg(PkgName.TidyR, 'nest_legacy')
	], BuiltInProcName.DefaultReadAllArgs, {}),
	fn(pkg(PkgName.Purrr, 'rbernoulli', 'rdunif'), BuiltInProcName.DefaultReadAllArgs,
		{ ambient: { type: AmbientStateAccessType.DrawRng }, tags: [SemanticCallTag.Random, SemanticCallTag.Deprecated] }, Overrides
	),
] as const satisfies AnyBuiltInDefinition[];
