import { LintingPrettyPrintContext, LintingResultCertainty, type LintingRule, LintingRuleCertainty } from '../../linter-format';
import type { MergeableRecord } from '../../../util/objects';
import { Q } from '../../../search/flowr-search-builder';
import { LintingRuleTag } from '../../linter-tags';
import { SourceLocation } from '../../../util/range';
import { type CmdCheckResult, packageInfo } from './cmd-check-util';
import { FileRole } from '../../../project/context/flowr-file';
import type { NamespaceFormat } from '../../../project/plugins/file-plugins/files/flowr-namespace-file';
import { type PackageEntry, type PackageFiles, packageFiles } from './package-files';

/** The `R CMD check` checks (by the title it logs them under) this rule ports. */
export type CompiledCodeKind =
	'compilation flags in Makevars' | 'use of PKG_*FLAGS in Makefiles' | 'use of SHLIB_OPENMP_*FLAGS in Makefiles'
	| 'for portable use of $(BLAS_LIBS) and $(LAPACK_LIBS)' | 'for GNU extensions in Makefiles' | 'include directives in Makefiles'
	| 'line endings in Makefiles' | 'line endings in C/C++/Fortran sources/headers' | 'line endings in shell scripts'
	| 'pragmas in C/C++ headers and code' | 'usage of KIND in Fortran files' | 'C++ specification' | 'compiled code'
	| 'whether package can be installed';

export interface CompiledCodeResult extends CmdCheckResult {
	/** the `R CMD check` check the finding belongs to */
	readonly kind: CompiledCodeKind
	/** the file the finding is in, relative to the package root */
	readonly file: string
}

export interface CompiledCodeConfig extends MergeableRecord {
	/** checks (by their `R CMD check` title) to skip */
	readonly skip:                   readonly CompiledCodeKind[]
	/** regular expressions (anchored by flowR, without the leading dash) for the compiler flags `R CMD check` calls non-portable */
	readonly nonPortableFlags:       readonly string[]
	/** flags (with the dash) that are fine even though they match {@link nonPortableFlags} */
	readonly allowedFlags:           readonly string[]
	/** the C++ standards `R` still honors; others requested through `CXX_STD` are unknown */
	readonly knownCxxStandards:      readonly string[]
	/** the C++ standards `R` ignores as obsolete */
	readonly obsoleteCxxStandards:   readonly string[]
	/** the functions compiled code must not call because they might terminate R, write to stdout, use system RNGs or `[v]sprintf` */
	readonly unportableCalls:        readonly string[]
	/** the objects (and C++ streams) compiled code must not use for the same reason */
	readonly unportableObjects:      readonly string[]
	/** the Fortran statements compiled code must not use (I/O, `stop`, system RNGs) */
	readonly unportableFortran:      readonly string[]
	/** also look for calls of the non-API entry points of R (default `true`) */
	readonly checkNonApi:            boolean
	/** further non-API entry points to flag besides the ones `R` lists */
	readonly extraNonApiEntryPoints: readonly string[]
	/** also look for the missing registration of native routines (default `true`) */
	readonly checkRegistration:      boolean
	/** the header (a file name, or a directory prefix ending in `/`) to the package that has to be in `LinkingTo` for it */
	readonly headerPackages:         Readonly<Record<string, string>>
	/** also flag Fortran type declarations like `real*8`, which are no standard Fortran (default `true`) */
	readonly flagStarKinds:          boolean
}

export interface CompiledCodeMetadata extends MergeableRecord {
	/** the files inspected */
	readonly consideredFiles: number
}

/** the warnings whose pragmas `R CMD check` calls non-portable */
const NonPortableWarnings = `
	abi-tag aggressive-loop-optimizations aliasing align-commons aligned-new alloc-size-larger-than alloc-zero alloca alloca-larger-than ampersand
	argument-mismatch array-temporaries assign-intercept attribute-alias bool-compare bool-operation builtin-declaration-mismatch c-binding-type
	c90-c99-compat c99-c11-compat cast-function-type catch-value character-truncation chkp class-memaccess clobbered compare-reals
	conditionally-supported conversion-extra coverage-mismatch designated-init discarded-array-qualifiers discarded-qualifiers do-subscript
	duplicated-branches duplicated-cond format-contains-nul format-overflow format-signedness format-truncation frame-address frame-larger-than
	free-nonheap-object function-elimination hsa if-not-aligned implicit-interface implicit-procedure inherited-variadic-ctor int-in-bool-context
	integer-division intrinsic-shadow intrinsics-std invalid-memory-model jump-misses-init larger-than line-truncation literal-suffix logical-op
	lto-type-mismatch maybe-uninitialized memset-elt-size misleading-indentation missing-attributes missing-parameter-type multiple-inheritance
	multistatement-macros namespaces noexcept non-template-friend nonnull-compare normalized old-style-declaration openmp-simd override-init
	override-init-side-effects packed-bitfield-compat packed-not-aligned placement-new pmf-conversions pointer-compare property-assign-default psabi
	real-q-constant realloc-lhs realloc-lhs-all restrict return-local-addr scalar-storage-order shadow-compatible-local shadow-local sized-deallocation
	sizeof-pointer-div stack-usage strict-null-sentinel stringop-overflow stringop-truncation subobject-linkage suggest-attribute suggest-final-methods
	suggest-final-types suggest-override surprising switch-unreachable sync-nand tabs target-lifetime templates terminate traditional
	traditional-conversion trampolines undefined-do-loop underflow unsafe-loop-optimizations unsuffixed-float-constants unused-but-set-parameter
	unused-but-set-variable unused-dummy-argument use-without-only useless-cast vector-operation-performance virtual-inheritance virtual-move-assign
	vla-larger-than zerotrip
`.split(/\s+/).filter(s => s !== '');

/** the entry points `R CMD check` reports as non-API (`tools:::nonAPI`) */
const NonApiEntryPoints = `
	chol_ chol2inv_ cg_ ch_ rg_ fft_factor fft_work Brent_fmin optif0 OBJECT NAMED SET_NAMED IS_S4_OBJECT SET_S4_OBJECT UNSET_S4_OBJECT R_data_class
	SET_TYPEOF ENVFLAGS SET_ENVFLAGS LEVELS SETLEVELS EXTPTR_PTR ENCLOS DATAPTR Rf_isValidString Rf_isFrame OutDec PRIMOFFSET RC_fopen R_CollectFromIndex
	R_CompiledFileName R_FileExists R_FreeStringBuffer R_FunTab R_GE_setVFontRoutines R_GetVarLocMISSING Rsleep R_MethodsNamespace R_NewHashedEnv
	R_OpenCompiledFile R_PV R_ParseContext R_ParseContextLast R_ParseContextLine R_ParseError R_ParseErrorMsg R_SrcfileSymbol R_SrcrefSymbol R_Visible
	R_cairoCdynload R_deferred_default_method R_execMethod R_findVarLocInFrame R_fopen R_gc_torture R_get_arith_function R_gzclose R_gzgets R_gzopen
	R_ignore_SIGPIPE R_isForkedChild R_isMethodsDispatchOn R_moduleCdynload R_primitive_generic R_primitive_methods R_print R_running_as_main_program
	R_setInternetRoutines R_setLapackRoutines R_setX11Routines R_set_prim_method R_set_quick_method_check R_set_standardGeneric_ptr R_strtod4
	R_subassign3_dflt R_taskCallbackRoutine Rconn_fgetc Rconn_printf Rdownload Rf_EncodeComplex Rf_EncodeElement Rf_EncodeEnvironment Rf_EncodeInteger
	Rf_EncodeReal0 Rf_EncodeLogical Rf_EncodeReal Rf_GPretty Rf_NewEnvironment Rf_PrintDefaults Rf_ReplIteration Rf_Seql Rf_begincontext
	Rf_callToplevelHandlers Rf_checkArityCall Rf_con_pushback Rf_copyMostAttribNoTs Rf_deparse1 Rf_deparse1line Rf_dpptr Rf_endcontext Rf_envlength
	Rf_formatComplex Rf_formatInteger Rf_formatLogical Rf_formatReal Rf_init_con Rf_isProtected Rf_mbrtowc Rf_mkFalse Rf_printNamedVector
	Rf_printRealVector Rf_printVector Rf_set_iconv Rf_sortVector Rf_strIsASCII Rf_strchr Rf_strrchr Rf_ucstomb Rf_utf8towcs Rf_wcstoutf8 Rg_PolledEvents
	Rg_set_col_ptrs Rf_wait_usec Ri18n_iswctype Ri18n_wcswidth Ri18n_wctype Ri18n_wcwidth Rsockclose Rsockconnect Rsocklisten Rsockopen Rsockread
	Rsockwrite Runzip UNIMPLEMENTED_TYPE baseRegisterIndex Rf_csduplicated Rf_currentTime dcar dcdr do_Rprof do_Rprofmem do_X11 do_contourLines do_edit
	do_getGraphicsEventEnv do_getSnapshot do_playSnapshot do_saveplot do_set_prim_method dtype dummy_fgetc dummy_ii dummy_vfprintf epslon_
	extR_HTTPDCreate extR_HTTPDStop fdhess getConnection getPRIMNAME known_to_be_latin1 locale2charset match5 matherr max_contour_segments Rf_mbcsToUcs2
	Rf_memtrace_report parseError pythag_ rs_ rwarnc_ tql2_ tqlrat_ tred1_ tred2_ utf8locale yylloc R_opendir R_readdir R_closedir ENSURE_NAMEDMAX
	IS_ASCII IS_UTF8 AllDevicesKilled R_CStackLimit R_CStackStart R_ClearerrConsole R_CleanTempDir R_Consolefile R_DefCallbacks R_DefParams R_DefParamsEx
	R_DirtyImage R_GUIType R_GlobalContext R_HistoryFile R_HistorySize R_Home R_HomeDir R_Interactive R_Outputfile R_PolledEvents R_ReplDLLdo1
	R_ReplDLLinit R_RestoreGlobalEnv R_RestoreGlobalEnvFromFile R_RestoreHistory R_RunExitFinalizers R_SaveGlobalEnv R_SaveGlobalEnvToFile R_SelectEx
	R_SetParams R_SetWin32 R_SignalHandlers R_SizeFromEnv R_NoEcho R_Suicide R_TempDir R_checkActivity R_checkActivityEx R_runHandlers R_setStartTime
	R_set_command_line_arguments R_setupHistory R_timeout_handler R_timeout_val R_wait_usec SaveAction RestoreAction Rf_CleanEd Rf_KillAllDevices
	Rf_endEmbeddedR Rf_initEmbeddedR Rf_initialize_R Rf_jump_to_toplevel Rf_mainloop editorcleanall fpu_setup freeRUser free_R_HOME getDLLVersion
	getRUser get_R_HOME getSelectedHandler initStdinHandler process_site_Renviron process_system_Renviron process_user_Renviron ptr_R_Busy
	ptr_R_ChooseFile ptr_R_CleanUp ptr_R_ClearerrConsole ptr_R_EditFile ptr_R_EditFiles ptr_R_FlushConsole ptr_R_ProcessEvents ptr_R_ReadConsole
	ptr_R_ResetConsole ptr_R_ShowFiles ptr_R_ShowMessage ptr_R_Suicide ptr_R_WriteConsole ptr_R_WriteConsoleEx ptr_R_addhistory ptr_R_loadhistory
	ptr_R_savehistory ptr_do_dataentry ptr_do_dataviewer ptr_do_selectlist readconsolecfg run_Rmainloop setup_Rmainloop R_NamespaceRegistry
	R_InBCInterpreter R_CurrentExpression R_CStackDir R_MB_CUR_MAX R_compact_intseq_class R_compact_realseq_class R_num_math_threads
	R_max_num_math_threads R_FalseValue R_LogicalNAValue R_TrueValue call_R Rf_setSVector Rf_asRbool Rf_asBool2 R_BadLongVector REFCNT ALTREP_LENGTH
	ALTVEC_DATAPTR ALTVEC_DATAPTR_RO ALTSTRING_ELT R_signal_protect_error R_signal_unprotect_error R_signal_reprotect_error Rf_allocVector3 R_typeToChar
	Rf_translateCharFP Rstrdup Rf_matchE R_popen R_system R_findVarLoc R_duplicate_attr Rf_substitute Rf_type2rstr R_MissingArgError R_MissingArgError_c
	R_makePartialMatchWarningCondition Rf_EncodeChar Rf_utf8clen R_strtod5 Rf_utf8toucs Rf_wtransChar Rf_mbcsValid Rf_utf8Valid SET_OBJECT SET_PRENV
	SET_PRVALUE SET_PRCODE R_PromiseExpr DDVAL INTERNAL SYMVALUE INTEGER0 LOGICAL0 RAW0 REAL0 COMPLEX0 RDEBUG SET_RDEBUG STRING_PTR Rf_findVar
	Rf_findVarInFrame Rf_findVarInFrame3 PRCODE PRENV PRVALUE XLENGTH_EX Rf_gsetVar R_lsInternal Rf_allocSExp BODY FORMALS CLOENV ATTRIB SET_ATTRIB
	R_asHashtable R_HashtabSEXP R_isHashtable R_mkhashtab R_gethash R_sethash R_remhash R_numhash R_typhash R_maphash R_maphashC R_clrhash R_Pretty
`.split(/\s+/).filter(s => s !== '');

const MakevarsFiles = ['src/Makevars.in', 'src/Makevars'] as const;
const FlagFiles = ['src/Makevars', 'src/Makevars.in', 'src/Makevars.win', 'src/Makevars.ucrt', 'src/Makefile', 'src/Makefile.win', 'src/Makefile.ucrt'] as const;
const BlasFiles = ['src/Makevars', 'src/Makevars.in', 'src/Makefile', 'src/Makefile.win', 'src/Makefile.ucrt'] as const;
const FlagPrefixes = ['CPP', 'C', 'CXX', 'CXX98', 'CXX11', 'CXX14', 'CXX17', 'CXX20', 'CXX23', 'F', 'FC', 'OBJC', 'OBJCXX'] as const;
const PrefixAlternatives = FlagPrefixes.join('|');
const CSourcePattern = /\.(c|cc|cpp|cxx|C)$/;
const CFamilyPattern = /\.(c|cc|cpp|cxx|C|h|hh|hpp|hxx)$/;
const FortranPattern = /\.(f|f90|f95)$/;
const RHeaderPattern = /^(R\w*\.h|R_ext\/.*|Rcpp.*|cpp11.*)$/;
const DeclarationKeywords: ReadonlySet<string> = new Set(['return', 'else', 'case', 'throw', 'sizeof', 'do', 'goto', 'co_return', 'co_yield', 'new', 'delete', 'and', 'or', 'not']);
const FortranStatements: ReadonlyMap<string, RegExp> = new Map([
	['print', /^\s*(?:\d+\s+)?(?:if\s*\(.*\)\s*)?print\b/i],
	['write', /^\s*(?:\d+\s+)?(?:if\s*\(.*\)\s*)?write\s*\(/i],
	['read', /^\s*(?:\d+\s+)?(?:if\s*\(.*\)\s*)?read\s*[(*]/i],
	['open', /^\s*(?:\d+\s+)?(?:if\s*\(.*\)\s*)?open\s*\(/i],
	['close', /^\s*(?:\d+\s+)?(?:if\s*\(.*\)\s*)?close\s*\(/i],
	['rewind', /^\s*(?:\d+\s+)?(?:if\s*\(.*\)\s*)?rewind\b/i],
	['stop', /^\s*(?:\d+\s+)?(?:if\s*\(.*\)\s*)?stop\b/i],
	['exit', /\bcall\s+exit\s*\(/i],
	['rand', /\bcall\s+rand\b|(?<![\w%])rand\s*\(/i],
	['random_number', /\bcall\s+random_number\b/i],
	['random_seed', /\bcall\s+random_seed\b/i],
	['random_init', /\bcall\s+random_init\b/i]
]);
const TerminatingCalls: ReadonlySet<string> = new Set(['abort', 'exit', '_exit', '_Exit', 'stop']);
const RngCalls: ReadonlySet<string> = new Set(['rand', 'random', 'rand_r', 'srand', 'srandom', 'srandom_r', 'srand48', 'random_number', 'random_seed', 'random_init']);

interface Line {
	readonly text: string
	/** the 1-based line the logical line starts at */
	readonly line: number
}

/** the lines of a file with `\` continuations joined and comments removed, like `R CMD check` prepares Makefiles */
function logicalLines(text: string): Line[] {
	const raw = text.split(/\r?\n/);
	const result: Line[] = [];
	for(let i = 0; i < raw.length; i++) {
		const start = i + 1;
		let t = raw[i];
		while(t.endsWith('\\') && i + 1 < raw.length) {
			t = t.slice(0, -1) + ' ' + raw[++i];
		}
		result.push({ text: t.replace(/#.*/, ''), line: start });
	}
	return result;
}

function lineOf(text: string, index: number): number {
	let line = 1;
	for(let i = text.indexOf('\n'); i !== -1 && i < index; i = text.indexOf('\n', i + 1)) {
		line++;
	}
	return line;
}

function basename(relative: string): string {
	return relative.slice(relative.lastIndexOf('/') + 1);
}

/** blanks the comments (and optionally the string and character literals) of C/C++ code, keeping every line break */
function stripC(text: string, strings: boolean): string {
	let out = '';
	const n = text.length;
	const blank = (s: string) => s.replace(/[^\n]/g, ' ');
	for(let i = 0; i < n;) {
		const c = text[i];
		const d = text[i + 1];
		if(c === '/' && d === '/') {
			let j = i;
			while(j < n && text[j] !== '\n') {
				j += text[j] === '\\' && text[j + 1] === '\n' ? 2 : 1;
			}
			out += blank(text.slice(i, j));
			i = j;
		} else if(c === '/' && d === '*') {
			const end = text.indexOf('*/', i + 2);
			const j = end === -1 ? n : end + 2;
			out += blank(text.slice(i, j));
			i = j;
		} else if(c === '"' || c === '\'' && !/\w/.test(text[i - 1] ?? '')) {
			let j = i + 1;
			const raw = c === '"' && text[i - 1] === 'R' ? /^([^()\\\s]{0,16})\(/.exec(text.slice(i + 1, i + 20)) : null;
			if(raw) {
				const end = text.indexOf(`)${raw[1]}"`, i);
				j = end === -1 ? n : end + raw[1].length + 2;
			} else {
				while(j < n && text[j] !== c && text[j] !== '\n') {
					j += text[j] === '\\' ? 2 : 1;
				}
				j = Math.min(n, j + 1);
			}
			const lit = text.slice(i, j);
			out += strings ? blank(lit.slice(0, 1)) + blank(lit.slice(1, -1)) + blank(lit.slice(-1)) : lit;
			i = j;
		} else {
			out += c;
			i++;
		}
	}
	return out;
}

/** the entries below `dir` (or all entries, when `recursive`) whose file name matches */
function filesIn(files: PackageFiles, dir: string, pattern: RegExp, recursive = true): PackageEntry[] {
	return files.entries.filter(e => !e.isDirectory && e.relative.startsWith(dir + '/')
		&& (recursive || !e.relative.slice(dir.length + 1).includes('/')) && pattern.test(e.relative));
}

class Findings {
	public readonly results: CompiledCodeResult[] = [];
	constructor(private readonly files: PackageFiles, private readonly skip: ReadonlySet<string>) {}

	public add(kind: CompiledCodeKind, file: string, line: number, message: string, certainty = LintingResultCertainty.Certain): void {
		if(!this.skip.has(kind)) {
			this.results.push({ certainty, kind, file, message, involvedId: undefined, loc: this.files.locate(file, line) });
		}
	}
}

function checkLineEndings(files: PackageFiles, out: Findings): void {
	const text = (e: string) => files.read(e) ?? '';
	const crAndEnd = (kind: CompiledCodeKind, relative: string, what: string, unix: string, requireEol: boolean) => {
		const content = text(relative);
		const cr = content.indexOf('\r');
		if(cr !== -1) {
			out.add(kind, relative, lineOf(content, cr), `Found ${what} with CR or CRLF line endings. ${unix} require LF line endings.`);
		} else if(requireEol && !content.endsWith('\n') && (content !== '' || what === 'a Makefile')) {
			out.add(kind, relative, content.split('\n').length, `Found ${what} not terminated with a newline. ${unix} may mishandle such files.`);
		}
	};
	for(const e of files.entries) {
		if(e.isDirectory) {
			continue;
		}
		const name = basename(e.relative);
		if(/^(configure|configure\.in|configure\.ac|cleanup)$/.test(e.relative)) {
			crAndEnd('line endings in shell scripts', e.relative, 'a shell script', 'Non-Windows OSes', false);
		} else if((e.relative.startsWith('src/') && !/^src\/[Ww]in/.test(e.relative) || e.relative.startsWith('inst/include/')) && /\.([cfh]|cc|cpp|hpp)$/.test(e.relative)) {
			crAndEnd('line endings in C/C++/Fortran sources/headers', e.relative, 'a source/header', 'Some Unix compilers', true);
		}
		if(e.relative.startsWith('src/') && /^(Makevars|Makevars\.in|Makefile|Makefile\.in)$/.test(name) || name === 'Makefile') {
			crAndEnd('line endings in Makefiles', e.relative, 'a Makefile', 'Some Unix \'make\' programs', true);
		}
	}
}

/** the flag tokens of a Makevars value, with the variables defined in the file expanded (unknown ones are empty, like `R` evaluates the file) */
function expand(value: string, vars: ReadonlyMap<string, string>, depth = 0): string {
	return depth > 8 ? value : value.replace(/\$[({]([\w.]+)[)}]|\$(\w)/g, (_, a: string | undefined, b: string | undefined) => {
		const name = a ?? b ?? '';
		return expand(vars.get(name) ?? '', vars, depth + 1);
	});
}

function checkMakevarsFlags(files: PackageFiles, out: Findings, config: CompiledCodeConfig): void {
	const present = MakevarsFiles.filter(f => files.read(f) !== undefined);
	if(present.length === 0) {
		return;
	}
	const bad = new RegExp(`^-(${config.nonPortableFlags.join('|')})$`);
	const isBad = (flag: string) => bad.test(flag) && !config.allowedFlags.includes(flag);
	const main = present[0];
	const vars = new Map<string, string>();
	const lines = new Map<string, number>();
	const user = new Set<string>();
	for(const { text, line } of logicalLines(files.read(main) ?? '')) {
		const m = /^\s*(?:(?:override|export)\s+)?([A-Za-z_][\w.]*)\s*(\+=|:?:?=|\?=)\s*(.*?)\s*$/.exec(text);
		if(!m) {
			continue;
		}
		const [, name, op, value] = m;
		const old = vars.get(name);
		vars.set(name, op === '+=' ? `${old ?? ''} ${value}`.trim() : op === '?=' ? old ?? value : value);
		lines.set(name, line);
		if(new RegExp(`^(${PrefixAlternatives})FLAGS$`).test(name)) {
			user.add(name);
		}
	}
	for(const [name, value] of vars) {
		if(new RegExp(`^PKG_(${PrefixAlternatives})FLAGS$`).test(name)) {
			let flags = expand(value, vars).split(/\s+/).filter(f => isBad(f));
			if(name === 'PKG_FFLAGS' || name === 'PKG_FCFLAGS') {
				flags = flags.filter(f => !f.startsWith('-std=f'));
			}
			if(flags.length > 0) {
				out.add('compilation flags in Makevars', main, lines.get(name) ?? 1, `Non-portable flags in variable '${name}': ${flags.join(' ')}`);
			}
		}
	}
	for(const name of user) {
		const value = expand(vars.get(name) ?? '', vars);
		if(value !== '-o /dev/null') {
			out.add('compilation flags in Makevars', main, lines.get(name) ?? 1, `Variables overriding user/site settings: ${name}: ${value}`);
		}
	}
	const target = new RegExp(`.*[.o]: +PKG_(${PrefixAlternatives})FLAGS *=`);
	for(const f of present) {
		(files.read(f) ?? '').split(/\r?\n/).forEach((l, i) => {
			const m = target.exec(l);
			const flags = m ? l.slice(m[0].length).split(/\s+/).filter(x => isBad(x)) : [];
			if(flags.length > 0) {
				out.add('compilation flags in Makevars', f, i + 1, `Non-portable flags in file '${f}': ${flags.join(' ')}`);
			}
		});
	}
	if(present.length > 1) {
		out.add('compilation flags in Makevars', 'src/Makevars', 1, 'Package has both \'src/Makevars.in\' and \'src/Makevars\'. Installation with --no-configure\' is unlikely to work. If you intended \'src/Makevars\' to be used on Windows, rename it to \'src/Makevars.win\' otherwise remove it. If \'configure\' created \'src/Makevars\', you need a \'cleanup\' script.');
	}
}

function makefilesOf(files: PackageFiles): PackageEntry[] {
	return files.entries.filter(e => !e.isDirectory && (e.relative.startsWith('src/') && /^(Makevars|Makevars\.in|Makefile|Makefile\.in)$/.test(basename(e.relative)) || basename(e.relative) === 'Makefile'));
}

function checkGnuExtensions(files: PackageFiles, out: Findings, systemRequirements: string): void {
	if(/GNU [Mm]ake/.test(systemRequirements.replace(/\s+/g, ' '))) {
		return;
	}
	for(const e of makefilesOf(files)) {
		const lines = (files.read(e.relative) ?? '').split(/\r?\n/);
		const idx = lines.findIndex(l => !/^ *#/.test(l) && !/[$][(].+:=.+[)]/.test(l)
			&& /([+]=|:=|[$][(]wildcard|[$][(]shell|[$][(]eval|[$][(]call|[$][(]patsubst|^ifeq|^ifneq|^ifdef|^ifndef|^endifi|[.]NOTPARALLEL)/.test(l));
		if(idx !== -1) {
			out.add('for GNU extensions in Makefiles', e.relative, idx + 1, 'Found a file containing GNU extensions. Portable Makefiles do not use GNU extensions such as +=, :=, $(shell), $(wildcard), ifeq ... endif, .NOTPARALLEL');
		}
	}
}

function checkBlasLapack(files: PackageFiles, out: Findings): void {
	const haveF = filesIn(files, 'src', /\.(f|f90|f95)$/, false).length > 0;
	if(haveF) {
		return;
	}
	for(const f of BlasFiles) {
		for(const { text, line } of logicalLines(files.read(f) ?? '')) {
			if(!/^[ \t]*PKG_LIBS/.test(text)) {
				continue;
			}
			if(/\$[{(]?LAPACK_LIBS/.test(text) && !/\$[{(]?LAPACK_LIBS.*\$[{(]?BLAS_LIBS/.test(text)) {
				out.add('for portable use of $(BLAS_LIBS) and $(LAPACK_LIBS)', f, line, `Apparently using $(LAPACK_LIBS) without following $(BLAS_LIBS) in '${f}'`);
			}
			if(/\$[{(]?BLAS_LIBS/.test(text) && !/\$[{(]?BLAS_LIBS.*\$[{(]?FLIBS/.test(text)) {
				out.add('for portable use of $(BLAS_LIBS) and $(LAPACK_LIBS)', f, line, `Apparently using $(BLAS_LIBS) without following $(FLIBS) in '${f}'`);
			}
		}
	}
}

interface SourceKinds {
	readonly c:   boolean
	readonly cxx: boolean
	readonly f:   boolean
	readonly f9x: boolean
}

function sourceKinds(files: PackageFiles): SourceKinds {
	const any = (p: RegExp) => filesIn(files, 'src', p).length > 0;
	return { c: any(/\.c$/), cxx: any(/\.(cc|cpp)$/), f: any(/\.f$/), f9x: any(/\.f9[05]$/) };
}

function checkPkgFlags(files: PackageFiles, out: Findings): void {
	const have = sourceKinds(files);
	const needs: Readonly<Record<string, boolean>> = { C: have.c, CXX: have.cxx, F: have.f || have.f9x, FC: have.f9x, CPP: have.c || have.cxx };
	for(const m of FlagFiles) {
		if(files.read(m) === undefined) {
			continue;
		}
		const lines = (files.read(m) ?? '').split(/\r?\n/);
		for(const [f, present] of Object.entries(needs)) {
			const idx = lines.findIndex(l => new RegExp(`^[ \\t]*PKG_${f}FLAGS`).test(l));
			if(idx !== -1 && !present) {
				out.add('use of PKG_*FLAGS in Makefiles', m, idx + 1, `PKG_${f}FLAGS set in '${m}' without any corresponding files`);
			}
		}
	}
}

function checkOpenMp(files: PackageFiles, out: Findings): void {
	const have = sourceKinds(files);
	for(const m of FlagFiles) {
		const content = files.read(m);
		if(content === undefined) {
			continue;
		}
		const all = logicalLines(content).filter(l => l.text !== '');
		const lines = all.map(l => l.text);
		const libs = all.filter(l => /^[ \t]*PKG_LIBS/.test(l.text));
		const lineOfMatch = (p: RegExp, from = all) => from.find(l => p.test(l.text))?.line ?? 1;
		const anyInLibs = libs.some(l => l.text.includes('SHLIB_OPENMP_'));
		const useFc = lines.some(l => l.startsWith('USE_FC_TO_LINK'));
		const note = (line: number, msg: string) => out.add('use of SHLIB_OPENMP_*FLAGS in Makefiles', m, line, msg);
		const used: string[] = [];
		for(const f of ['C', 'CXX', 'F', 'FC']) {
			const flags = `${f}FLAGS`;
			const pat = new RegExp(`^[ \\t]*PKG_${flags}.*SHLIB_OPENMP_${f === 'FC' ? '(F|FC)FLAGS' : flags}`);
			if(lines.some(l => pat.test(l))) {
				used.push(flags);
				const at = lineOfMatch(pat);
				let fOrFc = 'F';
				if(f === 'FC' && lines.some(l => l.includes('SHLIB_OPENMP_FCFLAGS'))) {
					fOrFc = 'FC';
					note(at, 'SHLIB_OPENMP_FCFLAGS is defunct (used in PKG_FCFLAGS)');
				}
				const missing = f === 'C' ? !have.c : f === 'F' ? !(have.f || have.f9x) : f === 'CXX' ? !have.cxx : false;
				if(missing) {
					note(at, `SHLIB_OPENMP_${flags} is included in PKG_${flags} without any ${f === 'C' ? 'C' : f === 'F' ? 'Fortran' : 'C++'} files`);
					continue;
				}
				const cOrCxx = have.cxx ? 'CXXFLAGS' : 'CFLAGS';
				const target = f === 'F' || f === 'FC' ? cOrCxx : flags;
				if(!libs.some(l => l.text.includes(`SHLIB_OPENMP_${target}`)) && !useFc) {
					note(at, anyInLibs
						? f === 'F' ? `SHLIB_OPENMP_FFLAGS is included in PKG_FFLAGS but not SHLIB_OPENMP_${cOrCxx} in PKG_LIBS`
							: f === 'FC' ? `SHLIB_OPENMP_${fOrFc}FLAGS is included in PKG_FCFLAGS but not SHLIB_OPENMP_${cOrCxx} in PKG_LIBS`
								: `SHLIB_OPENMP_${flags} is included in PKG_${flags} but not in PKG_LIBS`
						: `SHLIB_OPENMP_${flags} is included in PKG_${flags} but no OPENMP macro in PKG_LIBS`);
				}
			} else {
				const pat2 = new RegExp(`^[ \\t]*PKG_${flags}.*SHLIB_OPENMP_`);
				const hit = all.find(l => pat2.test(l.text));
				if(hit) {
					note(hit.line, `incorrect macro SHLIB_OPENMP_${hit.text.replace(/.*SHLIB_OPENMP_([A-Z]*).*/, '$1')} included in PKG_${flags}`);
				}
			}
		}
		let cnt = 0;
		for(const f of ['C', 'CXX', 'F', 'FC']) {
			const flags = `${f}FLAGS`;
			const res = libs.some(l => l.text.includes(`SHLIB_OPENMP_${flags}`));
			const at = lineOfMatch(new RegExp(`SHLIB_OPENMP_${flags}`), libs);
			cnt += res ? 1 : 0;
			const linkedBy = have.cxx ? 'C++' : 'C';
			if(res && (f === 'F' || f === 'FC') && !useFc || res && (!have.cxx && f === 'CXX' || have.cxx && f === 'C')) {
				note(at, `SHLIB_OPENMP_${flags} is included in PKG_LIBS but linking is by ${linkedBy}`);
				continue;
			}
			if(used.includes(flags) || (!have.cxx && f === 'C' || have.cxx && f === 'CXX') && (used.includes('FFLAGS') || used.includes('FCFLAGS'))
				|| useFc && f === 'F' && used.length === 1 && used[0] === 'FCFLAGS') {
				continue;
			}
			if(res) {
				note(at, `SHLIB_OPENMP_${flags} is included in PKG_LIBS but not in PKG_${flags}`);
			}
		}
		if(cnt > 1) {
			note(libs[0]?.line ?? 1, 'it is not portable to include multiple SHLIB_OPENMP_* macros in PKG_LIBS');
		}
		const cpp = /^[ \t]*PKG_CPPFLAGS.*SHLIB_OPENMP_/;
		if(lines.some(l => cpp.test(l))) {
			note(lineOfMatch(cpp), 'it is not portable to include SHLIB_OPENMP_* macros in PKG_CPPFLAGS; PKG_CPPFLAGS is used for both C and C++ code');
		}
	}
}

function checkIncludeDirectives(files: PackageFiles, out: Findings): void {
	for(const e of files.entries) {
		if(e.isDirectory || !/^(Makefile|Makefile\.in|Makefile\.win|Makefile\.ucrt|makefile|GNUmakefile)$/.test(basename(e.relative))) {
			continue;
		}
		const idx = (files.read(e.relative) ?? '').split(/\r?\n/).findIndex(l => /^include .*R_HOME/.test(l));
		if(idx !== -1) {
			out.add('include directives in Makefiles', e.relative, idx + 1, 'Found a Makefile with an include directive with a pathname using R_HOME. R_HOME may contain spaces, which Makefile directives cannot portably quote; use the make \'-f\' option to include files in directories specified using R_HOME instead');
		}
	}
}

function checkPragmas(files: PackageFiles, out: Findings): void {
	const important = /^\s*#pragma (GCC|clang) diagnostic ignored[^-]*[-]W(uninitialized|float-equal|array-bound|format)/;
	const nonPortable = new RegExp(`^\\s*#pragma (GCC|clang) diagnostic[^-]*[-]W(${NonPortableWarnings.join('|')})`);
	const ignored = /^\s*#pragma (GCC|clang) diagnostic ignored/;
	const candidates = [...filesIn(files, 'src', /\.(c|cc|cpp|h|hh|hpp)$/), ...filesIn(files, 'inst/include', /\.(c|cc|cpp|h|hh|hpp)$/)];
	for(const e of candidates) {
		const lines = (files.read(e.relative) ?? '').split(/\r?\n/);
		const first = (p: RegExp) => lines.findIndex(l => p.test(l)) + 1;
		const found = first(ignored);
		if(found === 0) {
			continue;
		}
		const warn = first(important);
		const port = first(nonPortable);
		if(warn > 0) {
			out.add('pragmas in C/C++ headers and code', e.relative, warn, 'File which contains pragma(s) suppressing important diagnostics');
		}
		if(port > 0) {
			out.add('pragmas in C/C++ headers and code', e.relative, port, 'File which contains non-portable pragma(s)');
		}
		if(warn === 0) {
			out.add('pragmas in C/C++ headers and code', e.relative, found, 'File which contains pragma(s) suppressing diagnostics');
		}
	}
}

function checkFortranKind(files: PackageFiles, out: Findings, config: CompiledCodeConfig): void {
	for(const e of filesIn(files, 'src', FortranPattern, false)) {
		(files.read(e.relative) ?? '').split(/\r?\n/).forEach((l, i) => {
			if(/^([cC]| *!)/.test(l)) {
				return;
			}
			if(/[(].*(kind|KIND) *= *[1-9].*[)]/.test(l)) {
				out.add('usage of KIND in Fortran files', e.relative, i + 1, `Found file with non-portable usage of KIND: ${l.trim()}`);
			} else if(config.flagStarKinds && /\b(real|integer|complex|logical)\s*\*\s*\d+/i.test(l.replace(/!.*/, ''))) {
				out.add('usage of KIND in Fortran files', e.relative, i + 1, `Found file with non-portable type declaration (use KIND parameters instead of a byte count): ${l.trim()}`);
			}
		});
	}
}

function checkCxxSpecification(files: PackageFiles, out: Findings, config: CompiledCodeConfig, description: ReadonlyMap<string, readonly string[]> | undefined): void {
	const verdict = (std: string): string | undefined => config.obsoleteCxxStandards.includes(std) ? `Obsolete C++${std} standard request will be ignored`
		: config.knownCxxStandards.includes(std) ? undefined : `Unknown C++${std} standard request will be ignored`;
	for(const f of [...MakevarsFiles, 'src/Makevars.win', 'src/Makevars.ucrt']) {
		for(const { text, line } of logicalLines(files.read(f) ?? '')) {
			const m = /^\s*CXX_STD\s*(?:\+|:)?=\s*CXX(\d+)\s*$/.exec(text);
			const msg = m ? verdict(m[1]) : undefined;
			if(msg) {
				out.add('C++ specification', f, line, `${msg} (CXX_STD in ${f})`);
			}
		}
	}
	const sys = description?.get('SystemRequirements');
	if(!sys) {
		return;
	}
	const raw = files.read('DESCRIPTION') ?? '';
	const at = Math.max(1, lineOf(raw, Math.max(0, raw.search(/^SystemRequirements:/m))));
	const items = sys.join(' ').split(',');
	const standards = config.knownCxxStandards.concat(config.obsoleteCxxStandards);
	const found = standards.find(s => items.some(it => new RegExp(`(^| )C[+][+]${s}([ ,;]|$)`).test(it)));
	if(found !== undefined) {
		if(config.obsoleteCxxStandards.includes(found)) {
			out.add('C++ specification', 'DESCRIPTION', at, `SystemRequirements specified C++${found}: support has been removed`);
		}
		return;
	}
	for(const it of items) {
		const m = /^\s*C[+][+]([^,;]*)/.exec(it);
		if(m) {
			out.add('C++ specification', 'DESCRIPTION', at, `SystemRequirements: invalid C++ specification 'C++${m[1].replace(/ *$/, '')}'`);
		}
	}
}

function callCategory(name: string): string {
	if(TerminatingCalls.has(name)) {
		return 'might terminate R';
	} else if(RngCalls.has(name)) {
		return 'uses the system RNG';
	} else if(name === 'sprintf' || name === 'vsprintf') {
		return 'uses [v]sprintf';
	} else if(['read', 'write', 'print', 'open', 'close', 'rewind'].includes(name)) {
		return 'uses Fortran I/O';
	}
	return 'writes to stdout/stderr instead of to the console';
}

function checkCompiledCode(files: PackageFiles, out: Findings, config: CompiledCodeConfig): void {
	const seen = new Set<string>();
	const report = (file: string, line: number, symbol: string, language: string) => {
		const key = `${file}:${symbol}`;
		if(!seen.has(key)) {
			seen.add(key);
			out.add('compiled code', file, line, `Found '${symbol}', possibly from '${symbol}' (${language}): compiled code should not call entry points which ${callCategory(symbol)}`, LintingResultCertainty.Uncertain);
		}
	};
	const calls = config.unportableCalls.length === 0 ? undefined : new RegExp(`(?<![\\w.]|->)(${config.unportableCalls.map(escapeRegex).join('|')})\\s*\\(`, 'g');
	const nonApi = config.checkNonApi ? new Map([...NonApiEntryPoints, ...config.extraNonApiEntryPoints].map(n => [n.replace(/^Rf_/, ''), n])) : undefined;
	const nonApiPattern = nonApi && nonApi.size > 0 ? new RegExp(`(?<![\\w.]|->)(?:Rf_)?(${[...nonApi.keys()].map(escapeRegex).join('|')})\\b`, 'g') : undefined;
	let registration: { c: boolean, routines: boolean, dynamic: boolean } = { c: false, routines: false, dynamic: false };
	for(const e of filesIn(files, 'src', CFamilyPattern)) {
		const stripped = stripC(files.read(e.relative) ?? '', true);
		const lines = stripped.split('\n');
		const usesR = lines.some(l => {
			const m = /^\s*#\s*include\s*[<"]([^>"]+)[>"]/.exec(l);
			return m !== null && RHeaderPattern.test(m[1]);
		}) || /\bRcpp\b|\bcpp11\b/.test(stripped);
		const lit = stripC(files.read(e.relative) ?? '', false).split('\n');
		const usingStd = /using\s+namespace\s+std\b/.test(stripped);
		const objects = config.unportableObjects.map(o => [o, o] as const);
		if(usingStd) {
			for(const o of config.unportableObjects.filter(o => o.startsWith('std::'))) {
				objects.push([o.slice(5), o]);
			}
		}
		lines.forEach((l, i) => {
			if(/^\s*#\s*(include|pragma)\b/.test(l)) {
				return;
			}
			for(const m of calls ? l.matchAll(calls) : []) {
				const pre = l.slice(0, m.index);
				const word = /(\w+)\s*\**\s*$/.exec(pre)?.[1];
				if(/\w::$/.test(pre) && !/\bstd::$/.test(pre) || word !== undefined && !DeclarationKeywords.has(word)) {
					continue;
				}
				report(e.relative, i + 1, m[1], /\.(c|h)$/.test(e.relative) ? 'C' : 'C++');
			}
			for(const [token, symbol] of objects) {
				if(new RegExp(`(?<![\\w.:]|->)${escapeRegex(token)}\\b`).test(l)) {
					report(e.relative, i + 1, symbol, symbol.startsWith('std::') ? 'C++' : 'C');
				}
			}
			if(nonApiPattern && usesR && !/^\s*#\s*define\b/.test(lit[i] ?? '')) {
				for(const m of l.matchAll(nonApiPattern)) {
					const name = nonApi?.get(m[1]) ?? m[1];
					const key = `${e.relative}:nonapi:${name}`;
					if(!seen.has(key)) {
						seen.add(key);
						out.add('compiled code', e.relative, i + 1, `Found non-API call to R: '${name}'. Compiled code should not call non-API entry points in R. This entry point may be removed soon`, LintingResultCertainty.Uncertain);
					}
				}
			}
		});
		if(CSourcePattern.test(e.relative) && usesR) {
			registration = {
				c:        true,
				routines: registration.routines || /\bR_registerRoutines\b/.test(stripped),
				dynamic:  registration.dynamic || /\bR_useDynamicSymbols\b/.test(stripped)
			};
		}
	}
	for(const e of filesIn(files, 'src', FortranPattern, false)) {
		const fixed = !/\.f(90|95)$/.test(e.relative);
		(files.read(e.relative) ?? '').split(/\r?\n/).forEach((raw, i) => {
			if(fixed && /^[cC*!]/.test(raw)) {
				return;
			}
			const l = raw.replace(/!.*/, '');
			for(const [name, pattern] of FortranStatements) {
				if(config.unportableFortran.includes(name) && pattern.test(l)) {
					report(e.relative, i + 1, name, 'Fortran');
				}
			}
		});
	}
	if(config.checkRegistration && registration.c) {
		const first = filesIn(files, 'src', CSourcePattern)[0].relative;
		for(const [missing, symbol] of [[!registration.routines, 'R_registerRoutines'], [!registration.dynamic, 'R_useDynamicSymbols']] as const) {
			if(missing) {
				out.add('compiled code', first, 1, `Found no call to: '${symbol}'. It is good practice to register native routines and to disable symbol search`, LintingResultCertainty.Uncertain);
			}
		}
	}
}

function escapeRegex(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function checkInstallable(files: PackageFiles, out: Findings, namespace: NamespaceFormat | undefined, linkingTo: readonly string[], config: CompiledCodeConfig): void {
	const compiled = filesIn(files, 'src', /\.(c|cc|cpp|cxx|C|f|f90|f95|m|mm)$/);
	if(namespace !== undefined) {
		const dynLib = Object.entries(namespace).some(([name, info]) => name !== 'current' && info.loadsWithSideEffects);
		if(compiled.length > 0 && !dynLib) {
			out.add('whether package can be installed', 'NAMESPACE', 1, `The package has compiled code ('${compiled[0].relative}') but its NAMESPACE has no useDynLib directive, so the shared object is never loaded`);
		} else if(dynLib && compiled.length === 0 && files.onDisk && !files.entries.some(e => e.isDirectory && e.relative === 'src')) {
			out.add('whether package can be installed', 'NAMESPACE', 1, 'The NAMESPACE has a useDynLib directive but the package has no src directory, so loading the package fails');
		}
	}
	const known = new Set(files.entries.filter(e => !e.isDirectory).map(e => e.relative));
	const seen = new Set<string>();
	for(const e of [...filesIn(files, 'src', CFamilyPattern), ...filesIn(files, 'inst/include', CFamilyPattern)]) {
		stripC(files.read(e.relative) ?? '', false).split('\n').forEach((l, i) => {
			const inc = /^\s*#\s*include\s*[<"]([^>"]+)[>"]/.exec(l)?.[1];
			if(inc === undefined) {
				return;
			}
			const dir = e.relative.slice(0, e.relative.lastIndexOf('/'));
			if(known.has(`${dir}/${inc}`) || known.has(`src/${inc}`) || known.has(`inst/include/${inc}`)) {
				return;
			}
			const pkg = Object.entries(config.headerPackages).find(([h]) => h.endsWith('/') ? inc.startsWith(h) : inc === h)?.[1];
			if(pkg !== undefined && !linkingTo.includes(pkg) && !seen.has(`${e.relative}:${pkg}`)) {
				seen.add(`${e.relative}:${pkg}`);
				out.add('whether package can be installed', e.relative, i + 1, `The code includes '${inc}' but the DESCRIPTION does not list '${pkg}' in LinkingTo, so the header is not found when installing`);
			}
		});
	}
}

/**
 * Ports the static checks `R CMD check` makes on the compiled code of a package and its build files, e.g. the checks
 * for compilation flags in Makevars, `PKG_*FLAGS` and `SHLIB_OPENMP_*FLAGS` in Makefiles, pragmas and Fortran `KIND`s.
 * The Rust compilation check only inspects the install log and is not ported. The binary part of the compiled code
 * check inspects the shared object, so flowR approximates it on the sources.
 */
export const COMPILED_CODE = {
	createSearch:        () => Q.from([]),
	processSearchResult: (_elements, config, data) => {
		const ctx = data.inspectContext();
		const pkg = packageInfo(ctx);
		const files = packageFiles(ctx, pkg.name);
		if(files === undefined) {
			return { results: [], '.meta': { consideredFiles: 0 } };
		}
		const out = new Findings(files, new Set(config.skip));
		const dcf = pkg.description?.content();
		const sysReq = dcf?.get('SystemRequirements')?.join(' ') ?? '';
		checkLineEndings(files, out);
		checkMakevarsFlags(files, out, config);
		checkGnuExtensions(files, out, sysReq);
		checkBlasLapack(files, out);
		checkPkgFlags(files, out);
		checkOpenMp(files, out);
		checkIncludeDirectives(files, out);
		checkPragmas(files, out);
		checkFortranKind(files, out, config);
		checkCxxSpecification(files, out, config, dcf);
		checkCompiledCode(files, out, config);
		checkInstallable(files, out, ctx.files.getFilesByRole(FileRole.Namespace)[0]?.content(), pkg.declared.get('LinkingTo') ?? [], config);
		return { results: out.results, '.meta': { consideredFiles: files.entries.filter(e => !e.isDirectory).length } };
	},
	prettyPrint: {
		[LintingPrettyPrintContext.Query]: result => `${result.message} at ${SourceLocation.format(result.loc)}`,
		[LintingPrettyPrintContext.Full]:  result => `checking ${result.kind}: ${result.message} (at ${SourceLocation.format(result.loc)})`
	},
	info: {
		name:          'Compiled Code',
		tags:          [LintingRuleTag.CmdCheck],
		certainty:     LintingRuleCertainty.BestEffort,
		description:   'Port of the static checks `R CMD check` makes on `src/` and the build files: `checking compilation flags in Makevars`, `use of PKG_*FLAGS in Makefiles`, `use of SHLIB_OPENMP_*FLAGS in Makefiles`, `for portable use of $(BLAS_LIBS) and $(LAPACK_LIBS)`, `for GNU extensions in Makefiles`, `include directives in Makefiles`, `line endings in Makefiles`, `line endings in C/C++/Fortran sources/headers`, `line endings in shell scripts`, `pragmas in C/C++ headers and code`, `usage of KIND in Fortran files`, `C++ specification`, and the install-time `useDynLib`/`LinkingTo` consistency. R evaluates the Makevars with `make`, flowR expands the variables of the file itself. The binary check `compiled code` (entry points that terminate R, write to stdout, use system RNGs, non-API calls, unregistered routines) is approximated on the sources, so such findings are uncertain. Beyond R it also flags `real*8`-style declarations. The `Rust compilation` check only inspects the install log and is not ported.',
		defaultConfig: () => ({
			skip:                   [],
			nonPortableFlags:       ['O.*', 'W', 'w', 'W[^l].*', 'ansi', 'pedantic', 'traditional', 'f.*', 'm.*', 'std.*', 'isystem', 'x', 'pipe', 'cpp', 'g', 'q'],
			allowedFlags:           [],
			knownCxxStandards:      ['26', '23', '20', '17', '14', '11', '98'],
			obsoleteCxxStandards:   ['98', '11', '14'],
			unportableCalls:        ['abort', 'exit', '_exit', '_Exit', 'printf', 'puts', 'putchar', 'sprintf', 'vprintf', 'vsprintf', 'rand', 'random', 'rand_r', 'srand', 'srandom', 'srandom_r', 'srand48'],
			unportableObjects:      ['stderr', 'stdout', 'std::cout', 'std::cerr'],
			unportableFortran:      ['print', 'write', 'read', 'open', 'close', 'rewind', 'stop', 'exit', 'rand', 'random_number', 'random_seed', 'random_init'],
			checkNonApi:            true,
			extraNonApiEntryPoints: [],
			checkRegistration:      true,
			headerPackages:         {
				'Rcpp.h':          'Rcpp', 'Rcpp/':           'Rcpp', 'RcppArmadillo.h': 'RcppArmadillo', 'armadillo':       'RcppArmadillo', 'RcppEigen.h':     'RcppEigen',
				'Eigen/':          'RcppEigen', 'cpp11.hpp':       'cpp11', 'cpp11/':          'cpp11', 'boost/':          'BH', 'RcppParallel.h':  'RcppParallel', 'RcppThread.hpp':  'RcppThread'
			},
			flagStarKinds: true
		})
	}
} as const satisfies LintingRule<CompiledCodeResult, CompiledCodeMetadata, CompiledCodeConfig>;
