import { sig, Forced } from './shared-signatures';
import { fn, pkg } from './define-helpers';
import { PkgName } from '../identifier';
import { BuiltInProcName } from '../built-in-proc-name';
import { ArgProp, CallProp } from '../built-in-props';
import { CopiesFiles } from './shared-configs';
import type { AnyBuiltInDefinition } from '../built-in-config';

/** The built-in definitions of other packages. */
export const MiscDefinitions = [
	fn(pkg(PkgName.Rutils, 'gstring'), BuiltInProcName.StringTemplate, { open: '${', props: CallProp.MayPure }),
	fn(pkg(PkgName.Whisker, 'whisker.render'), BuiltInProcName.StringTemplate, { open: '{{', close: '}}', props: CallProp.MayPure }),
	fn(pkg(PkgName.Brew, 'brew'), BuiltInProcName.StringTemplate, { open: '<%=', close: '%>', props: CallProp.MayPure }),
	fn(pkg(PkgName.Rprintf, 'rprintf'), BuiltInProcName.StringTemplate, { open: '$', close: '', props: CallProp.MayPure }),
	/* `destname` defaults to the name with the extension added or dropped */
	fn(pkg(PkgName.Rutils, 'gzip', 'gunzip', 'bzip2', 'bunzip2', 'compressFile', 'decompressFile'), BuiltInProcName.Default,
		{ props: CallProp.Invisible, libFn: true, tags: CopiesFiles, sig: sig({ filename: Forced.Resource, destname: Forced.Resource | ArgProp.Written, '...': ArgProp.Value }) }),
] as const satisfies AnyBuiltInDefinition[];
