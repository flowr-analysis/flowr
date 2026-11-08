import { sig, Forced } from './signatures';
import { fn, pkg } from './define';
import { PkgName } from '../identifier';
import { BuiltInProcName } from '../built-in-proc-name';
import { ArgProp, CallProp, SemanticCallTag } from '../built-in-props';
import type { AnyBuiltInDefinition } from '../built-in-config';

/** The built-in definitions of parallel and asynchronous execution and processes. */
export const ParallelDefinitions = [
	fn(pkg(PkgName.Future, 'future'), BuiltInProcName.Default,
		{
			props: CallProp.Concurrent,
			sig:   sig({
				expr:       ArgProp.Nse,
				envir:      ArgProp.Written,
				substitute: ArgProp.Flag,
				globals:    ArgProp.Value,
				packages:   ArgProp.Value,
				lazy:       ArgProp.Flag,
				seed:       ArgProp.Value
			})
		}
	),
	fn(pkg(PkgName.Future, 'futureCall'), BuiltInProcName.Apply,
		{
			indexOfFunction:        0,
			nameOfFunctionArgument: 'FUN',
			unquoteFunction:        true,
			props:                  CallProp.MayPure | CallProp.Concurrent,
			sig:                    sig({ FUN: ArgProp.Callee, args: ArgProp.Value, globals: ArgProp.Value, seed: ArgProp.Value })
		}
	),
	fn(pkg(PkgName.Future, 'value', 'resolved', 'nbrOfWorkers'), BuiltInProcName.Default,
		{ props: CallProp.Concurrent, sig: sig({ future: ArgProp.Handle, '...': ArgProp.Value }) }
	),
	fn(pkg(PkgName.Future, 'plan'), BuiltInProcName.Default,
		{ props: CallProp.Invisible | CallProp.Configures | CallProp.Concurrent, sig: sig({ strategy: ArgProp.Callee, '...': ArgProp.Value }) }
	),
	fn(pkg(PkgName.FutureApply,
		'future_lapply', 'future_sapply', 'future_vapply', 'future_apply', 'future_eapply', 'future_tapply', 'future_replicate'
	), BuiltInProcName.Apply,
	{
		indexOfFunction:        1,
		nameOfFunctionArgument: 'FUN',
		unquoteFunction:        true,
		props:                  CallProp.MayPure | CallProp.Concurrent,
		sig:                    sig({ X: ArgProp.Value, FUN: ArgProp.Callee, '...': ArgProp.Value, 'future.seed': ArgProp.Value })
	}
	),
	fn(pkg(PkgName.FutureApply, 'future_mapply', 'future_Map'), BuiltInProcName.Apply,
		{
			indexOfFunction:        0,
			nameOfFunctionArgument: 'FUN',
			unquoteFunction:        true,
			props:                  CallProp.MayPure | CallProp.Concurrent,
			sig:                    sig({ FUN: ArgProp.Callee, '...': ArgProp.Value, MoreArgs: ArgProp.Value, 'future.seed': ArgProp.Value })
		}
	),
	fn(pkg(PkgName.Furrr,
		'future_map', 'future_map_chr', 'future_map_dbl', 'future_map_int', 'future_map_lgl', 'future_map_dfr', 'future_map_dfc', 'future_imap',
		'future_modify'
	), BuiltInProcName.Apply,
	{
		indexOfFunction:        1,
		nameOfFunctionArgument: '.f',
		unquoteFunction:        true,
		props:                  CallProp.MayPure | CallProp.Concurrent,
		sig:                    sig({ '.x': ArgProp.Value, '.f': ArgProp.Callee, '...': ArgProp.Value, '.options': ArgProp.Value, '.progress': ArgProp.Flag })
	}
	),
	fn(pkg(PkgName.Furrr, 'future_walk'), BuiltInProcName.Apply,
		{
			indexOfFunction:        1,
			nameOfFunctionArgument: '.f',
			unquoteFunction:        true,
			props:                  CallProp.MayPure | CallProp.Concurrent | CallProp.Invisible,
			sig:                    sig({ '.x': ArgProp.Value, '.f': ArgProp.Callee, '...': ArgProp.Value, '.options': ArgProp.Value, '.progress': ArgProp.Flag })
		}
	),
	fn(pkg(PkgName.Furrr, 'future_map2', 'future_pmap'), BuiltInProcName.Apply,
		{
			indexOfFunction:        1,
			nameOfFunctionArgument: '.f',
			unquoteFunction:        true,
			props:                  CallProp.MayPure | CallProp.Concurrent,
			sig:                    sig({ '.x': ArgProp.Value, '.f': ArgProp.Callee, '...': ArgProp.Value, '.options': ArgProp.Value })
		}
	),
	fn(pkg(PkgName.Furrr, 'future_pwalk'), BuiltInProcName.Apply,
		{
			indexOfFunction:        1,
			nameOfFunctionArgument: '.f',
			unquoteFunction:        true,
			props:                  CallProp.MayPure | CallProp.Concurrent | CallProp.Invisible,
			sig:                    sig({ '.x': ArgProp.Value, '.f': ArgProp.Callee, '...': ArgProp.Value, '.options': ArgProp.Value })
		}
	),
	fn(pkg(PkgName.Promises, 'future_promise'), BuiltInProcName.Default,
		{ props: CallProp.Concurrent, sig: sig({ expr: ArgProp.Nse, substitute: ArgProp.Flag, globals: ArgProp.Value }) }
	),
	fn([...pkg(PkgName.Foreach, '%dopar%'), ...pkg(PkgName.DoFuture, '%dofuture%')], BuiltInProcName.Default,
		{ props: CallProp.MayPure | CallProp.Concurrent, sig: sig({ obj: ArgProp.Value, ex: ArgProp.Nse }) }
	),
	fn([
		...pkg(PkgName.DoParallel, 'registerDoParallel'),
		...pkg(PkgName.DoMc, 'registerDoMC'),
		...pkg(PkgName.DoSnow, 'registerDoSNOW'),
		...pkg(PkgName.DoFuture, 'registerDoFuture')
	], BuiltInProcName.Default,
	{ props: CallProp.Invisible | CallProp.Configures | CallProp.Concurrent, sig: sig({ cl: ArgProp.Handle, cores: ArgProp.Value }) }
	),
	fn(pkg(PkgName.Mirai, 'mirai'), BuiltInProcName.Default,
		{
			props: CallProp.Concurrent | CallProp.Invisible,
			sig:   sig({ '.expr': ArgProp.Nse, '...': ArgProp.Value, '.args': ArgProp.Value, '.timeout': ArgProp.Value, '.compute': ArgProp.Value })
		}
	),
	fn(pkg(PkgName.Mirai, 'mirai_map'), BuiltInProcName.Apply,
		{
			indexOfFunction:        1,
			nameOfFunctionArgument: '.f',
			unquoteFunction:        true,
			props:                  CallProp.MayPure | CallProp.Concurrent | CallProp.Invisible,
			sig:                    sig({ '.x': ArgProp.Value, '.f': ArgProp.Callee, '...': ArgProp.Value })
		}
	),
	fn(pkg(PkgName.Mirai, 'daemons'), BuiltInProcName.Default,
		{
			props: CallProp.Invisible | CallProp.Configures | CallProp.Concurrent,
			tags:  [SemanticCallTag.Process],
			sig:   sig({ n: ArgProp.Value, url: ArgProp.Resource, '...': ArgProp.Value })
		}
	),
	fn(pkg(PkgName.Callr, 'r_bg', 'rcmd_bg'), BuiltInProcName.Apply,
		{
			indexOfFunction:        0,
			nameOfFunctionArgument: 'func',
			unquoteFunction:        true,
			props:                  CallProp.Concurrent,
			tags:                   [SemanticCallTag.Process, SemanticCallTag.Opens],
			sig:                    sig({ func: ArgProp.Callee, args: ArgProp.Value, '...': ArgProp.Value })
		}
	),
	fn(pkg(PkgName.RcppParallel, 'setThreadOptions'), BuiltInProcName.Default,
		{ props: CallProp.Invisible | CallProp.Configures | CallProp.Concurrent, sig: sig({ numThreads: ArgProp.Value, stackSize: ArgProp.Value }) }
	),
	fn(pkg(PkgName.Processx, 'run', 'process'), BuiltInProcName.Default,
		{ libFn: true, tags: [SemanticCallTag.Process], sig: sig({ command: Forced.Value | ArgProp.Injectable, args: Forced.Value }) }
	),
	fn(pkg(PkgName.Sys, 'exec_wait', 'exec_internal', 'exec_background'), BuiltInProcName.Default,
		{
			libFn: true,
			tags:  [SemanticCallTag.Process],
			sig:   sig({ cmd: Forced.Value | ArgProp.Injectable, args: Forced.Value | ArgProp.Injectable })
		}
	),
] as const satisfies AnyBuiltInDefinition[];
