import { sig, Forced } from './shared-signatures';
import { fn, pkg, base, readsFile } from './define-helpers';
import { PkgName } from '../identifier';
import { BuiltInProcName } from '../built-in-proc-name';
import { ArgProp, CallProp, SemanticCallTag } from '../built-in-props';
import { KeyedState } from '../ambient-state-name';
import { CopiesFiles, Downloads, LoaderSearchPath, ImportSearchPath, SetsEntry } from './shared-configs';
import type { AnyBuiltInDefinition } from '../built-in-config';

/** The built-in definitions of package management, project tooling, documents, and foreign languages. */
export const ToolingDefinitions = [
	fn(pkg(PkgName.Sourcetools, 'read', 'read_lines', 'read_bytes', 'read_lines_bytes', 'tokenize_file'), BuiltInProcName.DefaultReadAllArgs, readsFile('path')),
	fn(pkg(PkgName.Xfun, 'url_filename', 'url_accessible', 'url_destination'), BuiltInProcName.Default,
		{ libFn: true, tags: [SemanticCallTag.Network], sig: sig({ x: Forced.Resource, '...': Forced.Value }) }),
	fn(pkg(PkgName.Xfun, 'download_file'), BuiltInProcName.Default,
		{ libFn: true, tags: Downloads, sig: sig({ url: Forced.Resource, output: Forced.Resource | ArgProp.Written, '...': Forced.Value }) }),
	fn(pkg(PkgName.Devtools, 'source_url', 'source_gist'), BuiltInProcName.Default,
		{ props: CallProp.Invisible, libFn: true, hasUnknownSideEffects: true, tags: [SemanticCallTag.Network, SemanticCallTag.Reads], sig: sig({ url: Forced.Resource, '...': Forced.Value }) }),
	fn(pkg(PkgName.Remotes, 'github_pull'), BuiltInProcName.Default, { libFn: true, tags: [SemanticCallTag.Network, SemanticCallTag.Reads], sig: sig({ pull: Forced.Resource }) }),
	fn(pkg(PkgName.UseThis, 'create_from_github', 'use_git_remote', 'use_github_action', 'use_github_file', 'use_tidy_thanks'), BuiltInProcName.Default,
		{ props: CallProp.Invisible, libFn: true, hasUnknownSideEffects: true, tags: [SemanticCallTag.Network, SemanticCallTag.Reads], sig: sig({ repo_spec: Forced.Resource, '...': Forced.Value }) }),
	fn(pkg(PkgName.RstudioApi, 'viewer', 'getDelegatedAzureToken'), BuiltInProcName.Default,
		{ libFn: true, tags: [SemanticCallTag.Network], sig: sig({ url: Forced.Resource, '...': Forced.Value }) }),
	fn(pkg(PkgName.RsConnect, 'addServer'), BuiltInProcName.Default,
		{ libFn: true, props: CallProp.Configures | CallProp.Invisible, tags: [SemanticCallTag.Network], sig: sig({ url: Forced.Resource, name: Forced.Value, '...': Forced.Value }) }),
	fn([...pkg(PkgName.PkgLoad, 'load_all'), ...pkg(PkgName.Devtools, 'load_all')], BuiltInProcName.Default,
		{ hasUnknownSideEffects: true, props: CallProp.Scope | CallProp.Invisible, sig: sig({ path: Forced.Value }) }),
	/* a callback runs after every later top-level call, or when the hook fires, and may change any state */
	/* where packages are found decides which version a later `library` attaches */
	/* Python code may do anything, and `source_python` binds what it defines in R */
	fn(pkg(PkgName.Reticulate, 'source_python', 'py_run_file'), BuiltInProcName.Default,
		{ libFn: true, readAllArguments: true, hasUnknownSideEffects: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: sig({ file: Forced.Resource, '...': Forced.Value }) }),
	fn(pkg(PkgName.Reticulate, 'py_run_string'), BuiltInProcName.Default, { libFn: true, hasUnknownSideEffects: true, sig: sig({ code: Forced.Value, '...': Forced.Value }) }),
	/* restoring or loading a project changes the library and the search path, a snapshot writes the lockfile */
	fn(pkg(PkgName.Renv, 'restore', 'init', 'activate', 'rebuild', 'load', 'install', 'update'), BuiltInProcName.Default,
		{ libFn: true, hasUnknownSideEffects: true, props: CallProp.Configures, sig: sig({ project: Forced.Value, '...': Forced.Value }) }),
	fn(pkg(PkgName.Renv, 'snapshot'), BuiltInProcName.DefaultReadAllArgs,
		{ libFn: true, props: CallProp.Invisible, tags: [SemanticCallTag.File, SemanticCallTag.Writes], sig: sig({ project: Forced.Value, '...': Forced.Value, library: Forced.Value, lockfile: Forced.Resource }) }),
	/* loaders taking several packages at once, each attached as by `library` */
	/* a preference puts the preferred function on top of the search path */
	fn(pkg(PkgName.Conflicted, 'conflict_prefer', 'conflicts_prefer'), BuiltInProcName.Prefer,
		{ libFn: true, ambient: SetsEntry(KeyedState.SearchPath, '.conflicts'), props: CallProp.Invisible | CallProp.Configures, tags: [SemanticCallTag.AttachesPackage], sig: sig({ '...': ArgProp.NoDefault }) }),
	fn(pkg(PkgName.Conflicted, 'conflict_prefer_all', 'conflict_prefer_matching'), BuiltInProcName.Default,
		{ libFn: true, hasUnknownSideEffects: true, props: CallProp.Invisible | CallProp.Configures, sig: sig({ '...': Forced.Value }) }),
	fn(pkg(PkgName.Needs, 'needs', 'prioritize'), BuiltInProcName.Library,
		{ libFn: true, packagesInDots: true, namesInDots: true, ambient: LoaderSearchPath(true), props: CallProp.Invisible | CallProp.Scope, tags: [SemanticCallTag.LoadsPackage, SemanticCallTag.AttachesPackage] }),
	fn(pkg(PkgName.Groundhog, 'groundhog.library'), BuiltInProcName.Library,
		{ libFn: true, formals: ['pkg', 'date'], ambient: LoaderSearchPath(true), props: CallProp.Invisible | CallProp.Scope, tags: [SemanticCallTag.LoadsPackage, SemanticCallTag.AttachesPackage] }),
	fn(pkg(PkgName.Pacman, 'p_load'), BuiltInProcName.Library,
		{ packagesInDots: true, evaluatedIn: 'char', ambient: LoaderSearchPath(true), props: CallProp.Invisible | CallProp.Scope, tags: [SemanticCallTag.LoadsPackage, SemanticCallTag.AttachesPackage] }),
	fn(pkg(PkgName.Librarian, 'shelf'), BuiltInProcName.Library,
		{ packagesInDots: true, stripRepo: true, ambient: LoaderSearchPath(true), props: CallProp.Invisible | CallProp.Scope, tags: [SemanticCallTag.LoadsPackage, SemanticCallTag.AttachesPackage] }),
	fn(pkg(PkgName.Xfun, 'pkg_attach', 'pkg_attach2'), BuiltInProcName.Library,
		{ packagesInDots: true, characterOnly: true, ambient: LoaderSearchPath(false), props: CallProp.Invisible | CallProp.Scope, tags: [SemanticCallTag.LoadsPackage, SemanticCallTag.AttachesPackage] }),
	fn(pkg(PkgName.EasyPackages, 'libraries'), BuiltInProcName.Library,
		{ packagesInDots: true, characterOnly: true, ambient: LoaderSearchPath(false), props: CallProp.Scope, tags: [SemanticCallTag.LoadsPackage, SemanticCallTag.AttachesPackage] }),
	/* `import::from` attaches what it imports as `imports`, or the name `.into` gives, and `.into = ""` imports into the calling frame */
	fn(pkg(PkgName.Import, 'from'), BuiltInProcName.Library,
		{ fromImports: true, ambient: ImportSearchPath, props: CallProp.Scope | CallProp.Invisible, tags: [SemanticCallTag.LoadsPackage, SemanticCallTag.AttachesPackage] }),
	fn([...pkg(PkgName.Box, 'use'), ...base('use')], BuiltInProcName.Library,
		{ boxUse: true, props: CallProp.Scope | CallProp.Invisible, tags: [SemanticCallTag.LoadsPackage, SemanticCallTag.AttachesPackage], sig: sig({ package: ArgProp.NoDefault, 'include.only': ArgProp.NoDefault }) }),
	fn(pkg(PkgName.Cli, 'cli_text', 'cli_alert', 'cli_alert_info', 'cli_alert_success', 'cli_alert_warning', 'cli_alert_danger', 'cli_h1', 'cli_h2', 'cli_h3', 'cli_li', 'cli_bullets',
		'cli_inform', 'cli_warn', 'cli_verbatim'), BuiltInProcName.StringTemplate, { markup: true, props: CallProp.MayPure | CallProp.Invisible }),
	fn(pkg(PkgName.Cli, 'format_inline'), BuiltInProcName.StringTemplate, { markup: true, props: CallProp.MayPure }),
	fn(pkg(PkgName.Compiler, 'cmpfun'), BuiltInProcName.Default, { sig: sig({ f: ArgProp.Alias }) }),
	fn(pkg(PkgName.Compiler, 'compile'), BuiltInProcName.Default, { sig: sig({ e: ArgProp.Alias }) }),
	fn(pkg(PkgName.Compiler, 'loadcmp'), BuiltInProcName.Default, { props: CallProp.Invisible, hasUnknownSideEffects: true, sig: sig({ file: ArgProp.NoDefault, envir: 0, chdir: 0 }) }),
	/* they read the files of some arguments and write those of others ({@link ArgProp.Written}), an archive's contents land in a directory */
	/* rendering a document reads it, writes what it renders to (named after the input unless given), and, but for purl, runs its code */
	fn(pkg(PkgName.Knitr, 'knit', 'knit_child'), BuiltInProcName.Default,
		{ libFn: true, readAllArguments: true, hasUnknownSideEffects: true, tags: CopiesFiles, sig: sig({ input: Forced.Resource, output: Forced.Resource | ArgProp.Written, '...': ArgProp.Flag }) }),
	fn(pkg(PkgName.Knitr, 'purl'), BuiltInProcName.DefaultReadAllArgs,
		{ libFn: true, tags: CopiesFiles, sig: sig({ input: Forced.Resource, output: Forced.Resource | ArgProp.Written, '...': ArgProp.Flag }) }),
	fn(pkg(PkgName.Knitr, 'read_chunk'), BuiltInProcName.DefaultReadAllArgs,
		{ libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: sig({ path: Forced.Resource, '...': ArgProp.Flag }) }),
	fn(pkg(PkgName.Rmarkdown, 'render'), BuiltInProcName.Default,
		{ libFn: true, readAllArguments: true, hasUnknownSideEffects: true, tags: CopiesFiles, sig: sig({ input: Forced.Resource, output_format: ArgProp.Flag, output_file: Forced.Resource | ArgProp.Written, '...': ArgProp.Flag }) }),
	fn(pkg(PkgName.Quarto, 'quarto_render'), BuiltInProcName.Default,
		{ libFn: true, readAllArguments: true, hasUnknownSideEffects: true, tags: CopiesFiles, sig: sig({ input: Forced.Resource, output_format: ArgProp.Flag, output_file: Forced.Resource | ArgProp.Written, '...': ArgProp.Flag }) }),
	fn(pkg(PkgName.Rcpp, 'sourceCpp'), BuiltInProcName.Default,
		{ libFn: true, props: CallProp.Ffi | CallProp.Invisible, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: sig({ file: Forced.Resource | ArgProp.Optional }) }),
	/* the pipeline runs `_targets.R` and stores every target as a file, which `tar_read` and `tar_load` (defining the target in the caller) get back */
	fn(pkg(PkgName.Targets, 'tar_make', 'tar_make_future', 'tar_make_clustermq', 'tar_destroy', 'tar_delete', 'tar_invalidate', 'tar_prune', 'tar_watch'), BuiltInProcName.Default,
		{ libFn: true, props: CallProp.Invisible, hasUnknownSideEffects: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads, SemanticCallTag.Writes, SemanticCallTag.Glob] }),
	fn(pkg(PkgName.Targets, 'tar_read', 'tar_read_raw', 'tar_meta', 'tar_progress', 'tar_objects', 'tar_manifest'), BuiltInProcName.Default,
		{ libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads, SemanticCallTag.Glob] }),
	fn(pkg(PkgName.Targets, 'tar_load', 'tar_load_raw', 'tar_load_everything'), BuiltInProcName.Default,
		{ libFn: true, props: CallProp.Invisible, hasUnknownSideEffects: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads, SemanticCallTag.Glob] }),
	fn([...pkg(PkgName.RstudioApi, 'showPrompt', 'askForPassword', 'selectDirectory', 'selectFile', 'showQuestion'), ...pkg(PkgName.SvDialogs, 'dlgInput', 'dlgOpen', 'dlgList',
		'dlgSave', 'dlgDir'), ...pkg(PkgName.Tcltk, 'tk_choose.files', 'tk_choose.dir'), ...pkg(PkgName.Shiny, 'parseQueryString', 'getQueryString', 'getUrlHash', 'restoreInput'),
	...pkg(PkgName.ShinyFiles, 'parseFilePaths', 'parseDirPath', 'parseSavePath'),
	/* what comes out of a cohort depends on the filters the user set, and on the gui that sets them */ ...pkg(PkgName.CohortBuilder, 'get_data', 'sum_up', 'attrition', 'get_state',
		'code', 'stat'), ...pkg(PkgName.ShinyCohortBuilder, 'cb_server', 'cb_ui', 'cb_chat_ui', 'gui', 'demo_app')], BuiltInProcName.Default,
	{ libFn: true, tags: [SemanticCallTag.User], sig: sig({ '...': ArgProp.Forced }) }),
] as const satisfies AnyBuiltInDefinition[];
