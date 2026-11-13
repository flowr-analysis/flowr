import { AmbientSingleState } from '../built-in-kinds';
import { sig, Forced } from './shared-signatures';
import { fn, pkg, utils, Primitive, Overrides } from './define-helpers';
import { Identifier, PkgName } from '../identifier';
import { BuiltInProcName } from '../built-in-proc-name';
import { ArgProp, CallProp, SemanticCallTag } from '../built-in-props';
import { CopiesFiles, Downloads, InstallsPackages, RemovesPackages } from './shared-configs';
import { UnknownKey } from '../ambient-state-name';
import type { AnyBuiltInDefinition } from '../built-in-config';
import { Ambient } from '../ambient-effect';

const remotes = (...names: readonly string[]) => names.flatMap(f => [Identifier.from([f, PkgName.Remotes]), Identifier.from([f, PkgName.Devtools])]);

/** The built-in definitions of the utils package. */
export const UtilsDefinitions = [

	fn(utils('read.csv'), BuiltInProcName.DefaultReadAllArgs,
		{ tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: sig({ file: Forced.Resource, header: Forced.Flag, sep: Forced.Value, quote: Forced.Value, dec: Forced.Value, fill: Forced.Flag, 'comment.char': Forced.Value, '...': Forced.Value }) },
		Primitive),
	fn(utils('read.fwf'), BuiltInProcName.DefaultReadAllArgs, { tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: sig({ file: Forced.Resource, '...': Forced.Value }) }),
	fn(utils('download.packages'), BuiltInProcName.Default,
		{ libFn: true, tags: [SemanticCallTag.Network, SemanticCallTag.File, SemanticCallTag.Writes], sig: sig({ pkgs: Forced.Value, destdir: Forced.Resource, '...': Forced.Value }) }),
	/* it diverts the output of its code into the value it returns, or the file it names, with `split` into the output around it as well */
	fn(utils('capture.output'), BuiltInProcName.Default,
		{ scope: { state: AmbientSingleState.Sink, params: ['...', 'file', 'append', 'type', 'split'], code: '...' }, ambient: { ...Ambient.sink.adds, when: { flag: 'split' } }, tags: [SemanticCallTag.File, SemanticCallTag.Writes], sig: sig({ '...': Forced.Value, file: Forced.Resource | ArgProp.Optional, append: Forced.Flag, type: Forced.Flag, split: Forced.Flag }) }),
	fn(utils('file_test'), BuiltInProcName.DefaultReadAllArgs,
		{ tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: sig({ op: Forced.Flag, x: Forced.Resource, y: Forced.Resource }) }),
	fn(utils('write.table', 'write.csv', 'write.csv2'), BuiltInProcName.DefaultReadAllArgs,
		{ props: CallProp.Invisible, tags: [SemanticCallTag.File, SemanticCallTag.Writes], sig: sig({ x: Forced.Value, file: Forced.Resource | ArgProp.Optional, append: Forced.Flag }) }),
	fn(utils('read.table', 'read.delim', 'read.csv2', 'read.delim2'), BuiltInProcName.DefaultReadAllArgs,
		{ tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: sig({ file: Forced.Resource }) }),
	fn(utils('download.file'), BuiltInProcName.DefaultReadAllArgs,
		{ props: CallProp.Invisible, tags: Downloads, sig: sig({ url: Forced.Resource, destfile: Forced.Resource | ArgProp.Written }) }),
	fn(utils('data'), BuiltInProcName.DefineArgument,
		{ props: CallProp.Invisible | CallProp.Scope, superAssignment: true, sig: sig({ '...': 0, list: ArgProp.Value, package: 0, 'lib.loc': 0, verbose: 0, envir: 0, overwrite: 0 }) }),
	/* attach injects an environment's contents into the search path; detach reverses it (treated as unknown side effect) */
	fn(utils('globalVariables'), BuiltInProcName.Default,
		{ hasUnknownSideEffects: true, props: CallProp.Invisible, tags: [SemanticCallTag.Declares], sig: sig({ names: ArgProp.NoDefault, package: 0, add: 0 }) }),
	/* only listing the contents (`list = TRUE`) shows the result */
	fn(utils('unzip'), BuiltInProcName.Default,
		{ props: CallProp.Invisible, tags: CopiesFiles, sig: sig({ zipfile: Forced.Resource, files: ArgProp.Value, list: ArgProp.Flag, overwrite: ArgProp.Flag, junkpaths: ArgProp.Flag, exdir: Forced.Resource | ArgProp.Written, unzip: ArgProp.Value, setTimes: ArgProp.Flag }) }),
	fn(utils('untar'), BuiltInProcName.Default,
		{ props: CallProp.Invisible, tags: CopiesFiles, sig: sig({ tarfile: Forced.Resource, files: ArgProp.Value, list: ArgProp.Flag, exdir: Forced.Resource | ArgProp.Written, compressed: ArgProp.Flag, extras: ArgProp.Value, verbose: ArgProp.Flag, restore_times: ArgProp.Flag, support_old_tars: ArgProp.Flag, tar: ArgProp.Value }) }),
	fn(utils('zip'), BuiltInProcName.Default,
		{ props: CallProp.Invisible, tags: CopiesFiles, sig: sig({ zipfile: Forced.Resource | ArgProp.Written, files: Forced.Resource, flags: ArgProp.Flag, extras: ArgProp.Value, zip: ArgProp.Value }) }),
	fn(utils('tar'), BuiltInProcName.Default,
		{ props: CallProp.Invisible, tags: CopiesFiles, sig: sig({ tarfile: Forced.Resource | ArgProp.Written, files: ArgProp.Resource, compression: ArgProp.Flag, compression_level: ArgProp.Value, tar: ArgProp.Value, extra_flags: ArgProp.Value }) }),
	/* installers fetch the package and put it into the library (devtools re-exports the entire remotes install API), named by their first parameter */
	...([
		['pkgs', [...utils('install.packages'), ...pkg(PkgName.BiocManager, 'install'), ...remotes('install_cran')]],
		['package', remotes('install_version', 'install_dev')],
		['repo', remotes('install_github', 'install_gitlab', 'install_bitbucket', 'install_bioc')],
		['url', remotes('install_url', 'install_git', 'install_svn')],
		['path', remotes('install_local')],
		['packages', [...remotes('update_packages'), ...pkg(PkgName.Renv, 'install')]],
		['pkg', [...pkg(PkgName.Devtools, 'install'), ...pkg(PkgName.Pak, 'pak', 'pkg_install')]],
		['root', pkg(PkgName.Pak, 'local_install')],
		['lockfile', pkg(PkgName.Pak, 'lockfile_install')]
	] as const).map(([param, ids]) => fn(ids, BuiltInProcName.Default,
		{ libFn: true, ambient: InstallsPackages(param), props: CallProp.Invisible, tags: [SemanticCallTag.Network, SemanticCallTag.File, SemanticCallTag.Writes] })),
	fn([...utils('remove.packages'), ...pkg(PkgName.Pak, 'pkg_remove')], BuiltInProcName.Default,
		{ libFn: true, ambient: RemovesPackages('pkgs'), props: CallProp.Invisible, tags: [SemanticCallTag.File, SemanticCallTag.Writes] }),
	/* updating replaces any installed package that is out of date */
	fn(utils('update.packages'), BuiltInProcName.Default,
		{ libFn: true, ambient: [{ ...Ambient.installed.adds, member: { from: 'constant', keys: [UnknownKey] } }, Ambient.libPaths.reads, { ...Ambient.option.reads, member: { from: 'constant', keys: ['repos'] } }], props: CallProp.Invisible, tags: [SemanticCallTag.Network, SemanticCallTag.File, SemanticCallTag.Writes] }),
	fn(utils('old.packages', 'new.packages'), BuiltInProcName.Default,
		{ libFn: true, ambient: [Ambient.installed.reads, Ambient.libPaths.reads, { ...Ambient.option.reads, member: { from: 'constant', keys: ['repos'] } }], props: CallProp.Ambient, tags: [SemanticCallTag.Network, SemanticCallTag.ChecksPackage] }),
	fn(utils('write.table'), BuiltInProcName.DefaultReadAllArgs,
		{ props: CallProp.Invisible, tags: [SemanticCallTag.File, SemanticCallTag.Writes], sig: sig({ x: Forced.Value, file: Forced.Resource | ArgProp.Optional, append: Forced.Flag, quote: Forced.Flag, sep: Forced.Value }) },
		Overrides),
	fn(utils('download.file'), BuiltInProcName.DefaultReadAllArgs,
		{ props: CallProp.Invisible, tags: Downloads, sig: sig({ url: Forced.Resource, destfile: Forced.Resource | ArgProp.Written, method: Forced.Value, quiet: Forced.Flag, mode: Forced.Value, cacheOK: Forced.Flag, extra: Forced.Value, headers: Forced.Value, '...': Forced.Value }) },
		Overrides),
] as const satisfies AnyBuiltInDefinition[];
