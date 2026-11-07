import { sig, Forced } from './signatures';
import { fn, pkg } from './define';
import { Identifier, PkgName } from '../identifier';
import { BuiltInProcName } from '../built-in-proc-name';
import { ArgProp, CallProp, SemanticCallTag } from '../built-in-props';
import { KeyedState } from '../ambient-state-name';
import { WithrDevices } from './shared';
import type { AnyBuiltInDefinition } from '../built-in-config';

/** The built-in definitions of withr and the other scoped changes of global state. */
export const WithrDefinitions = [
	/* withr and rlang change the options, the graphics or the generator state for the code they run, or for the rest of the calling function */
	fn(pkg(PkgName.Withr, 'with_options'), BuiltInProcName.Default,
		{ libFn: true, props: CallProp.Configures, scope: { state: 'options', params: ['new', 'code'], new: 'new', code: 'code' } }
	),
	fn(pkg(PkgName.Withr, 'local_options'), BuiltInProcName.Default,
		{
			libFn: true,
			props: CallProp.Configures | CallProp.Invisible,
			scope: { state: 'options', params: ['.new', '...', '.local_envir'], new: '.new' }
		}
	),
	fn(pkg(PkgName.Withr, 'with_par'), BuiltInProcName.Default,
		{ libFn: true, props: CallProp.Configures, scope: { state: 'graphics', params: ['new', 'code', 'no.readonly'], new: 'new', code: 'code' } }
	),
	fn(pkg(PkgName.Withr, 'local_par'), BuiltInProcName.Default,
		{
			libFn: true,
			props: CallProp.Configures | CallProp.Invisible,
			scope: { state: 'graphics', params: ['.new', '...', 'no.readonly', '.local_envir'], new: '.new' }
		}
	),
	/* scoped changes of the working directory, the environment variables and the locale; a value that names no entry (a time zone) changes an unknown one */
	fn(pkg(PkgName.Withr, 'with_dir'), BuiltInProcName.Default,
		{ libFn: true, props: CallProp.Configures, scope: { state: 'wd', params: ['new', 'code'], code: 'code' } }
	),
	fn(pkg(PkgName.Withr, 'local_dir'), BuiltInProcName.Default,
		{ libFn: true, props: CallProp.Configures | CallProp.Invisible, scope: { state: 'wd', params: ['new', '.local_envir'] } }
	),
	fn(pkg(PkgName.Withr, 'with_envvar'), BuiltInProcName.Default,
		{ libFn: true, props: CallProp.Configures, scope: { state: KeyedState.Env, params: ['new', 'code', 'action'], new: 'new', code: 'code' } }
	),
	fn(pkg(PkgName.Withr, 'local_envvar'), BuiltInProcName.Default,
		{
			libFn: true,
			props: CallProp.Configures | CallProp.Invisible,
			scope: { state: KeyedState.Env, params: ['.new', '...', 'action', '.local_envir'], new: '.new' }
		}
	),
	fn(pkg(PkgName.Withr, 'with_locale'), BuiltInProcName.Default,
		{ libFn: true, props: CallProp.Configures, scope: { state: KeyedState.Locale, params: ['new', 'code'], new: 'new', code: 'code' } }
	),
	fn(pkg(PkgName.Withr, 'local_locale'), BuiltInProcName.Default,
		{
			libFn: true,
			props: CallProp.Configures | CallProp.Invisible,
			scope: { state: KeyedState.Locale, params: ['.new', '...', '.local_envir'], new: '.new' }
		}
	),
	fn(pkg(PkgName.Withr, 'with_collate'), BuiltInProcName.Default,
		{ libFn: true, props: CallProp.Configures, scope: { state: KeyedState.Locale, params: ['new', 'code'], new: 'new', code: 'code' } }
	),
	fn(pkg(PkgName.Withr, 'local_collate'), BuiltInProcName.Default,
		{
			libFn: true,
			props: CallProp.Configures | CallProp.Invisible,
			scope: { state: KeyedState.Locale, params: ['new', '.local_envir'], new: 'new' }
		}
	),
	fn(pkg(PkgName.Withr, 'with_timezone'), BuiltInProcName.Default,
		{ libFn: true, props: CallProp.Configures, scope: { state: KeyedState.Env, params: ['tz', 'code'], new: 'tz', code: 'code' } }
	),
	fn(pkg(PkgName.Withr, 'local_timezone'), BuiltInProcName.Default,
		{ libFn: true, props: CallProp.Configures | CallProp.Invisible, scope: { state: KeyedState.Env, params: ['tz', '.local_envir'], new: 'tz' } }
	),
	fn(pkg(PkgName.Withr, 'with_language'), BuiltInProcName.Default,
		{ libFn: true, props: CallProp.Configures, scope: { state: KeyedState.Env, params: ['lang', 'code'], new: 'lang', code: 'code' } }
	),
	fn(pkg(PkgName.Withr, 'local_language'), BuiltInProcName.Default,
		{
			libFn: true,
			props: CallProp.Configures | CallProp.Invisible,
			scope: { state: KeyedState.Env, params: ['lang', '.local_envir'], new: 'lang' }
		}
	),
	fn(Identifier.fromAll(PkgName.Withr, WithrDevices.map(d => `with_${d}`)), BuiltInProcName.Default,
		{ libFn: true, props: CallProp.Configures, scope: { state: 'device', params: ['new', 'code'], code: 'code' } }
	),
	fn(Identifier.fromAll(PkgName.Withr, WithrDevices.map(d => `local_${d}`)), BuiltInProcName.Default,
		{ libFn: true, props: CallProp.Configures | CallProp.Invisible, scope: { state: 'device', params: ['.new', '...', '.local_envir'] } }
	),
	fn(pkg(PkgName.Withr, 'with_seed'), BuiltInProcName.Default,
		{
			libFn: true,
			props: CallProp.Configures,
			tags:  [SemanticCallTag.Random],
			scope: { state: 'rng', params: ['seed', 'code', '.rng_kind', '.rng_normal_kind', '.rng_sample_kind'], code: 'code' }
		}
	),
	fn(pkg(PkgName.Withr, 'with_preserve_seed'), BuiltInProcName.Default,
		{ libFn: true, scope: { state: 'rng', params: ['code'], code: 'code', preserve: true } }
	),
	fn(pkg(PkgName.Withr, 'local_preserve_seed'), BuiltInProcName.Default,
		{ libFn: true, props: CallProp.Invisible, scope: { state: 'rng', params: ['.local_envir'], preserve: true } }
	),
	fn(pkg(PkgName.Withr, 'local_seed'), BuiltInProcName.Default,
		{
			libFn: true,
			props: CallProp.Configures | CallProp.Invisible,
			tags:  [SemanticCallTag.Random],
			scope: { state: 'rng', params: ['seed', '.local_envir', '.rng_kind', '.rng_normal_kind', '.rng_sample_kind'] }
		}
	),
	/* withr closes the connection it is handed when the scope it is called in ends */
	fn(pkg(PkgName.Withr, 'local_connection'), BuiltInProcName.DefaultReadAllArgs,
		{ libFn: true, tags: [SemanticCallTag.Closes], sig: sig({ con: Forced.Handle, '.local_envir': ArgProp.Forced | ArgProp.Written }) }
	),
	fn(pkg(PkgName.Withr, 'with_connection'), BuiltInProcName.DefaultReadAllArgs,
		{ libFn: true, props: CallProp.MayPure, tags: [SemanticCallTag.Closes], sig: sig({ con: Forced.Handle, code: Forced.Value }) }
	),
] as const satisfies AnyBuiltInDefinition[];
