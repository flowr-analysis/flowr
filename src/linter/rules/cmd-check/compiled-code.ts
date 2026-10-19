import { LintingPrettyPrintContext, LintingResultCertainty, type LintingRule, LintingRuleCertainty } from '../../linter-format';
import type { MergeableRecord } from '../../../util/objects';
import { Q } from '../../../search/flowr-search-builder';
import { LintingRuleTag } from '../../linter-tags';
import { SourceLocation } from '../../../util/range';
import { packageInfo } from './cmd-check-util';
import { type FileResult, fileFindings, firstLine } from './file-checks';
import { FileRole } from '../../../project/context/flowr-file';
import { type PackageFiles, packageFiles } from './package-files';

/** The `R CMD check` checks (by the title it logs them under) this rule ports. */
export type CompiledCodeKind =
	'compilation flags in Makevars' | 'use of PKG_*FLAGS in Makefiles' | 'use of SHLIB_OPENMP_*FLAGS in Makefiles'
	| 'for portable use of $(BLAS_LIBS) and $(LAPACK_LIBS)' | 'for GNU extensions in Makefiles' | 'include directives in Makefiles'
	| 'line endings in Makefiles' | 'line endings in C/C++/Fortran sources/headers' | 'line endings in shell scripts'
	| 'pragmas in C/C++ headers and code' | 'usage of KIND in Fortran files' | 'C++ specification' | 'compiled code'
	| 'whether package can be installed';

export type CompiledCodeResult = FileResult<CompiledCodeKind>;

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
	abi-tag aggressive-loop-optimizations aliasing align-commons aligned-new alloc-size-larger-than alloc-zero alloca alloca-larger-than ampersand argument-mismatch array-temporaries assign-intercept attribute-alias bool-compare bool-operation builtin-declaration-mismatch c-binding-type c90-c99-compat c99-c11-compat
	cast-function-type catch-value character-truncation chkp class-memaccess clobbered compare-reals conditionally-supported conversion-extra coverage-mismatch designated-init discarded-array-qualifiers discarded-qualifiers do-subscript duplicated-branches duplicated-cond format-contains-nul format-overflow format-signedness
	format-truncation frame-address frame-larger-than free-nonheap-object function-elimination hsa if-not-aligned implicit-interface implicit-procedure inherited-variadic-ctor int-in-bool-context integer-division intrinsic-shadow intrinsics-std invalid-memory-model jump-misses-init larger-than line-truncation literal-suffix
	logical-op lto-type-mismatch maybe-uninitialized memset-elt-size misleading-indentation missing-attributes missing-parameter-type multiple-inheritance multistatement-macros namespaces noexcept non-template-friend nonnull-compare normalized old-style-declaration openmp-simd override-init override-init-side-effects
	packed-bitfield-compat packed-not-aligned placement-new pmf-conversions pointer-compare property-assign-default psabi real-q-constant realloc-lhs realloc-lhs-all restrict return-local-addr scalar-storage-order shadow-compatible-local shadow-local sized-deallocation sizeof-pointer-div stack-usage strict-null-sentinel
	stringop-overflow stringop-truncation subobject-linkage suggest-attribute suggest-final-methods suggest-final-types suggest-override surprising switch-unreachable sync-nand tabs target-lifetime templates terminate traditional traditional-conversion trampolines undefined-do-loop underflow unsafe-loop-optimizations
	unsuffixed-float-constants unused-but-set-parameter unused-but-set-variable unused-dummy-argument use-without-only useless-cast vector-operation-performance virtual-inheritance virtual-move-assign vla-larger-than zerotrip
`.split(/\s+/).filter(s => s !== '');

/** the entry points `R CMD check` reports as non-API (`tools:::nonAPI`) */
const NonApiEntryPoints = `
	chol_ chol2inv_ cg_ ch_ rg_ fft_factor fft_work Brent_fmin optif0 OBJECT NAMED SET_NAMED IS_S4_OBJECT SET_S4_OBJECT UNSET_S4_OBJECT R_data_class SET_TYPEOF ENVFLAGS SET_ENVFLAGS LEVELS SETLEVELS EXTPTR_PTR ENCLOS DATAPTR Rf_isValidString Rf_isFrame OutDec PRIMOFFSET RC_fopen R_CollectFromIndex R_CompiledFileName R_FileExists
	R_FreeStringBuffer R_FunTab R_GE_setVFontRoutines R_GetVarLocMISSING Rsleep R_MethodsNamespace R_NewHashedEnv R_OpenCompiledFile R_PV R_ParseContext R_ParseContextLast R_ParseContextLine R_ParseError R_ParseErrorMsg R_SrcfileSymbol R_SrcrefSymbol R_Visible R_cairoCdynload R_deferred_default_method R_execMethod
	R_findVarLocInFrame R_fopen R_gc_torture R_get_arith_function R_gzclose R_gzgets R_gzopen R_ignore_SIGPIPE R_isForkedChild R_isMethodsDispatchOn R_moduleCdynload R_primitive_generic R_primitive_methods R_print R_running_as_main_program R_setInternetRoutines R_setLapackRoutines R_setX11Routines R_set_prim_method
	R_set_quick_method_check R_set_standardGeneric_ptr R_strtod4 R_subassign3_dflt R_taskCallbackRoutine Rconn_fgetc Rconn_printf Rdownload Rf_EncodeComplex Rf_EncodeElement Rf_EncodeEnvironment Rf_EncodeInteger Rf_EncodeReal0 Rf_EncodeLogical Rf_EncodeReal Rf_GPretty Rf_NewEnvironment Rf_PrintDefaults Rf_ReplIteration Rf_Seql
	Rf_begincontext Rf_callToplevelHandlers Rf_checkArityCall Rf_con_pushback Rf_copyMostAttribNoTs Rf_deparse1 Rf_deparse1line Rf_dpptr Rf_endcontext Rf_envlength Rf_formatComplex Rf_formatInteger Rf_formatLogical Rf_formatReal Rf_init_con Rf_isProtected Rf_mbrtowc Rf_mkFalse Rf_printNamedVector Rf_printRealVector Rf_printVector
	Rf_set_iconv Rf_sortVector Rf_strIsASCII Rf_strchr Rf_strrchr Rf_ucstomb Rf_utf8towcs Rf_wcstoutf8 Rg_PolledEvents Rg_set_col_ptrs Rf_wait_usec Ri18n_iswctype Ri18n_wcswidth Ri18n_wctype Ri18n_wcwidth Rsockclose Rsockconnect Rsocklisten Rsockopen Rsockread Rsockwrite Runzip UNIMPLEMENTED_TYPE baseRegisterIndex Rf_csduplicated
	Rf_currentTime dcar dcdr do_Rprof do_Rprofmem do_X11 do_contourLines do_edit do_getGraphicsEventEnv do_getSnapshot do_playSnapshot do_saveplot do_set_prim_method dtype dummy_fgetc dummy_ii dummy_vfprintf epslon_ extR_HTTPDCreate extR_HTTPDStop fdhess getConnection getPRIMNAME known_to_be_latin1 locale2charset match5 matherr
	max_contour_segments Rf_mbcsToUcs2 Rf_memtrace_report parseError pythag_ rs_ rwarnc_ tql2_ tqlrat_ tred1_ tred2_ utf8locale yylloc R_opendir R_readdir R_closedir ENSURE_NAMEDMAX IS_ASCII IS_UTF8 AllDevicesKilled R_CStackLimit R_CStackStart R_ClearerrConsole R_CleanTempDir R_Consolefile R_DefCallbacks R_DefParams R_DefParamsEx
	R_DirtyImage R_GUIType R_GlobalContext R_HistoryFile R_HistorySize R_Home R_HomeDir R_Interactive R_Outputfile R_PolledEvents R_ReplDLLdo1 R_ReplDLLinit R_RestoreGlobalEnv R_RestoreGlobalEnvFromFile R_RestoreHistory R_RunExitFinalizers R_SaveGlobalEnv R_SaveGlobalEnvToFile R_SelectEx R_SetParams R_SetWin32 R_SignalHandlers
	R_SizeFromEnv R_NoEcho R_Suicide R_TempDir R_checkActivity R_checkActivityEx R_runHandlers R_setStartTime R_set_command_line_arguments R_setupHistory R_timeout_handler R_timeout_val R_wait_usec SaveAction RestoreAction Rf_CleanEd Rf_KillAllDevices Rf_endEmbeddedR Rf_initEmbeddedR Rf_initialize_R Rf_jump_to_toplevel Rf_mainloop
	editorcleanall fpu_setup freeRUser free_R_HOME getDLLVersion getRUser get_R_HOME getSelectedHandler initStdinHandler process_site_Renviron process_system_Renviron process_user_Renviron ptr_R_Busy ptr_R_ChooseFile ptr_R_CleanUp ptr_R_ClearerrConsole ptr_R_EditFile ptr_R_EditFiles ptr_R_FlushConsole ptr_R_ProcessEvents
	ptr_R_ReadConsole ptr_R_ResetConsole ptr_R_ShowFiles ptr_R_ShowMessage ptr_R_Suicide ptr_R_WriteConsole ptr_R_WriteConsoleEx ptr_R_addhistory ptr_R_loadhistory ptr_R_savehistory ptr_do_dataentry ptr_do_dataviewer ptr_do_selectlist readconsolecfg run_Rmainloop setup_Rmainloop R_NamespaceRegistry R_InBCInterpreter
	R_CurrentExpression R_CStackDir R_MB_CUR_MAX R_compact_intseq_class R_compact_realseq_class R_num_math_threads R_max_num_math_threads R_FalseValue R_LogicalNAValue R_TrueValue call_R Rf_setSVector Rf_asRbool Rf_asBool2 R_BadLongVector REFCNT ALTREP_LENGTH ALTVEC_DATAPTR ALTVEC_DATAPTR_RO ALTSTRING_ELT R_signal_protect_error
	R_signal_unprotect_error R_signal_reprotect_error Rf_allocVector3 R_typeToChar Rf_translateCharFP Rstrdup Rf_matchE R_popen R_system R_findVarLoc R_duplicate_attr Rf_substitute Rf_type2rstr R_MissingArgError R_MissingArgError_c R_makePartialMatchWarningCondition Rf_EncodeChar Rf_utf8clen R_strtod5 Rf_utf8toucs Rf_wtransChar
	Rf_mbcsValid Rf_utf8Valid SET_OBJECT SET_PRENV SET_PRVALUE SET_PRCODE R_PromiseExpr DDVAL INTERNAL SYMVALUE INTEGER0 LOGICAL0 RAW0 REAL0 COMPLEX0 RDEBUG SET_RDEBUG STRING_PTR Rf_findVar Rf_findVarInFrame Rf_findVarInFrame3 PRCODE PRENV PRVALUE XLENGTH_EX Rf_gsetVar R_lsInternal Rf_allocSExp BODY FORMALS CLOENV ATTRIB
	SET_ATTRIB R_asHashtable R_HashtabSEXP R_isHashtable R_mkhashtab R_gethash R_sethash R_remhash R_numhash R_typhash R_maphash R_maphashC R_clrhash R_Pretty
`.split(/\s+/).filter(s => s !== '');
const Prefixes = 'CPP|C|CXX|CXX98|CXX11|CXX14|CXX17|CXX20|CXX23|F|FC|OBJC|OBJCXX';
const MakeFile = /^src\/(?:.*\/)?(?:Makevars|Makevars\.in|Makefile|Makefile\.in)$|(?:^|\/)Makefile$/;
const MakevarsFile = /^src\/Makevars(?:\.in)?$/;
const FlagFile = /^src\/(?:Makevars(?:\.in|\.win|\.ucrt)?|Makefile(?:\.win|\.ucrt)?)$/;
const CFamily = /^src\/.*\.(?:c|cc|cpp|cxx|C|h|hh|hpp|hxx)$/;
const CSource = /^src\/.*\.(?:c|cc|cpp|cxx|C)$/;
const FortranSrc = /^src\/[^/]*\.(?:f|f90|f95)$/;
const KindDeclaration = /[(].*(kind|KIND) *= *[1-9].*[)]/;
const GnuExtension = /(?:[+]=|:=|[$][(](?:wildcard|shell|eval|call|patsubst)|^ifeq|^ifneq|^ifdef|^ifndef|^endifi|[.]NOTPARALLEL)/;
const FortranComment = /^(?:[cC]| *!)/;
const Include = /^\s*#\s*include\s*[<"]([^>"]+)[>"]/;
const UsesR = /^\s*#\s*include\s*[<"](?:R\w*\.h|(?:R_ext\/|Rcpp|cpp11)[^>"]*)[>"]|\bRcpp\b|\bcpp11\b/m;
const Declarators: ReadonlySet<string> = new Set(['return', 'else', 'case', 'throw', 'sizeof', 'do', 'goto', 'co_return', 'co_yield', 'new', 'delete', 'and', 'or', 'not']);
const Lead = String.raw`^\s*(?:\d+\s+)?(?:if\s*\(.*\)\s*)?`;
const FortranStatements = Object.entries({
	print:         `${Lead}print\\b`, write:         `${Lead}write\\s*\\(`, read:          `${Lead}read\\s*[(*]`, open:          `${Lead}open\\s*\\(`, close:         `${Lead}close\\s*\\(`, rewind:        `${Lead}rewind\\b`, stop:          `${Lead}stop\\b`,
	exit:          String.raw`\bcall\s+exit\s*\(`, rand:          String.raw`\bcall\s+rand\b|(?<![\w%])rand\s*\(`, random_number: String.raw`\bcall\s+random_number\b`,
	random_seed:   String.raw`\bcall\s+random_seed\b`, random_init:   String.raw`\bcall\s+random_init\b`
}).map(([name, pattern]) => [name, new RegExp(pattern, 'i')] as const);
const Categories: readonly (readonly [RegExp, string])[] = [
	[/^(abort|exit|_exit|_Exit|stop)$/, 'might terminate R'],
	[/^(rand|random|rand_r|srand|srandom|srandom_r|srand48|random_number|random_seed|random_init)$/, 'uses the system RNG'],
	[/^v?sprintf$/, 'uses [v]sprintf'],
	[/^(read|write|print|open|close|rewind)$/, 'uses Fortran I/O']
];

type Add = (kind: CompiledCodeKind, file: string, line: number, message: string, uncertain?: boolean) => void;
type Hits = boolean | readonly (readonly string[])[];

/** A per-line scan: the lines of the files matching `files` (after `prep`, if `gate` allows) that `line` hits are reported with `message`. */
interface Rule {
	readonly kind:       CompiledCodeKind
	readonly files:      RegExp
	readonly line:       RegExp | ((line: string, file: string) => Hits)
	readonly message:    string | ((file: string, line: string, hit: readonly string[]) => string | undefined)
	readonly when?:      boolean
	readonly prep?:      (text: string) => string
	readonly gate?:      (text: string) => boolean
	readonly logical?:   boolean
	readonly once?:      boolean
	readonly uncertain?: boolean
}

function logicalLines(text: string): { text: string, line: number }[] {
	const raw = text.split(/\r?\n/);
	const result: ReturnType<typeof logicalLines> = [];
	for(let i = 0; i < raw.length; i++) {
		const line = i + 1;
		let t = raw[i];
		while(t.endsWith('\\') && i + 1 < raw.length) {
			t = t.slice(0, -1) + ' ' + raw[++i];
		}
		result.push({ text: t.replace(/#.*/, ''), line });
	}
	return result;
}

const CSyntax = /\/\/(?:\\\n|[^\n])*|\/\*[\s\S]*?(?:\*\/|$)|(?<=R)"([^()\\\s]{0,16})\([\s\S]*?(?:\)\1"|$)|"(?:\\[\s\S]|[^"\\\n])*"?|(?<!\w)'(?:\\[\s\S]|[^'\\\n])*'?/g;
const blank = (s: string) => s.replace(/[^\n]/g, ' ');

/** blanks the comments (and optionally the string and character literals) of C/C++ code, keeping every line break */
function stripC(text: string, strings: boolean): string {
	return text.replace(CSyntax, m => m.startsWith('/') || strings ? blank(m) : m);
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const alt = (names: readonly string[]) => names.length === 0 ? '(?!)' : `(?:${names.map(escapeRegex).join('|')})`;
const category = (symbol: string) => Categories.find(([p]) => p.test(symbol))?.[1] ?? 'writes to stdout/stderr instead of to the console';

function scan(files: PackageFiles, rules: readonly Rule[], add: Add): void {
	for(const r of rules.filter(r => r.when !== false)) {
		const re = r.line;
		const test = typeof re === 'function' ? re : (l: string): Hits => {
			const m = re.exec(l);
			return m ? [m] : false;
		};
		for(const e of files.entries.filter(e => !e.isDirectory && r.files.test(e.relative))) {
			const raw = files.read(e.relative) ?? '';
			const text = r.prep?.(raw) ?? raw;
			const lines = r.gate && !r.gate(text) ? [] : r.logical ? logicalLines(text) : text.split(/\r?\n/).map((t, i) => ({ text: t, line: i + 1 }));
			lines.some(({ text: l, line }) => {
				const hits = test(l, e.relative);
				const found = (hits === true ? [[]] : hits || []).map(h => typeof r.message === 'string' ? r.message : r.message(e.relative, l, h)).filter(m => m !== undefined);
				found.forEach(m => add(r.kind, e.relative, line, m, r.uncertain));
				return r.once && found.length > 0;
			});
		}
	}
}

const LineEndings = [
	{ kind: 'line endings in shell scripts', files: /^(?:configure|configure\.in|configure\.ac|cleanup)$/, what: 'a shell script', unix: 'Non-Windows OSes', eol: undefined },
	{ kind: 'line endings in C/C++/Fortran sources/headers', files: /^(?:src\/(?![Ww]in)|inst\/include\/).*\.(?:[cfh]|cc|cpp|hpp)$/, what: 'a source/header', unix: 'Some Unix compilers', eol: 'nonEmpty' },
	{ kind: 'line endings in Makefiles', files: MakeFile, what: 'a Makefile', unix: 'Some Unix \'make\' programs', eol: 'always' }
] as const;

function checkLineEndings(files: PackageFiles, add: Add): void {
	for(const { kind, files: pattern, what, unix, eol } of LineEndings) {
		for(const e of files.entries.filter(e => !e.isDirectory && pattern.test(e.relative))) {
			const content = files.read(e.relative) ?? '';
			const cr = content.indexOf('\r');
			if(cr !== -1) {
				add(kind, e.relative, content.slice(0, cr).split('\n').length, `Found ${what} with CR or CRLF line endings. ${unix} require LF line endings.`);
			} else if(eol && !content.endsWith('\n') && (content !== '' || eol === 'always')) {
				add(kind, e.relative, content.split('\n').length, `Found ${what} not terminated with a newline. ${unix} may mishandle such files.`);
			}
		}
	}
}

/** the variables of the Makevars, with the variables defined in the file expanded (unknown ones are empty, like `R` evaluates the file) */
function checkMakevars(files: PackageFiles, isBad: (flag: string) => boolean, add: Add): void {
	const main = ['src/Makevars.in', 'src/Makevars'].find(f => files.read(f) !== undefined);
	const vars = new Map<string, { value: string, line: number }>();
	for(const { text, line } of logicalLines(files.read(main ?? '') ?? '')) {
		const m = /^\s*(?:(?:override|export)\s+)?([A-Za-z_][\w.]*)\s*(\+=|:?:?=|\?=)\s*(.*?)\s*$/.exec(text);
		const old = m ? vars.get(m[1])?.value : undefined;
		if(m) {
			vars.set(m[1], { line, value: m[2] === '+=' ? `${old ?? ''} ${m[3]}`.trim() : m[2] === '?=' ? old ?? m[3] : m[3] });
		}
	}
	const expand = (value: string, depth = 0): string => depth > 8 ? value : value.replace(/\$[({]([\w.]+)[)}]|\$(\w)/g, (_, a: string | undefined, b: string | undefined) => expand(vars.get(a ?? b ?? '')?.value ?? '', depth + 1));
	for(const [name, { value, line }] of vars) {
		const m = new RegExp(`^(PKG_)?(?:${Prefixes})FLAGS$`).exec(name);
		const expanded = m ? expand(value) : '';
		const flags = expanded.split(/\s+/).filter(f => isBad(f) && !(/^PKG_FC?FLAGS$/.test(name) && f.startsWith('-std=f')));
		const message = m?.[1] ? flags.length > 0 && `Non-portable flags in variable '${name}': ${flags.join(' ')}`
			: m && expanded !== '-o /dev/null' && `Variables overriding user/site settings: ${name}: ${expanded}`;
		if(message) {
			add('compilation flags in Makevars', main ?? '', line, message);
		}
	}
}

function checkOpenMp(files: PackageFiles, have: Readonly<Record<string, boolean>>, add: Add): void {
	const languages = [['C', have.c, 'C'], ['CXX', have.cxx, 'C++'], ['F', have.f || have.f9x, 'Fortran'], ['FC', true, '']] as const;
	const cOrCxx = have.cxx ? 'CXXFLAGS' : 'CFLAGS';
	for(const { relative: file } of files.entries.filter(e => !e.isDirectory && FlagFile.test(e.relative))) {
		const all = logicalLines(files.read(file) ?? '').filter(l => l.text !== '');
		const libs = all.filter(l => /^[ \t]*PKG_LIBS/.test(l.text));
		const find = (p: RegExp, from = all) => from.find(l => p.test(l.text));
		const inLibs = (macro: string) => libs.find(l => l.text.includes(`SHLIB_OPENMP_${macro}`));
		const note = (line: number | undefined, msg: string) => add('use of SHLIB_OPENMP_*FLAGS in Makefiles', file, line ?? 1, msg);
		const useFc = all.some(l => l.text.startsWith('USE_FC_TO_LINK'));
		const used: string[] = [];
		for(const [f, present, lang] of languages) {
			const flags = `${f}FLAGS`;
			const hit = find(new RegExp(`^[ \\t]*PKG_${flags}.*SHLIB_OPENMP_${f === 'FC' ? '(F|FC)FLAGS' : flags}`));
			if(!hit) {
				const wrong = find(new RegExp(`^[ \\t]*PKG_${flags}.*SHLIB_OPENMP_`));
				if(wrong) {
					note(wrong.line, `incorrect macro SHLIB_OPENMP_${wrong.text.replace(/.*SHLIB_OPENMP_([A-Z]*).*/, '$1')} included in PKG_${flags}`);
				}
				continue;
			}
			used.push(flags);
			const defunct = f === 'FC' && all.some(l => l.text.includes('SHLIB_OPENMP_FCFLAGS'));
			const macro = f === 'FC' && !defunct ? 'FFLAGS' : flags;
			const fortran = f === 'F' || f === 'FC';
			if(defunct) {
				note(hit.line, 'SHLIB_OPENMP_FCFLAGS is defunct (used in PKG_FCFLAGS)');
			}
			if(!present) {
				note(hit.line, `SHLIB_OPENMP_${macro} is included in PKG_${flags} without any ${lang} files`);
			} else if(!inLibs(fortran ? cOrCxx : flags) && !useFc) {
				note(hit.line, `SHLIB_OPENMP_${macro} is included in PKG_${flags} ` + (libs.some(l => l.text.includes('SHLIB_OPENMP_')) ? fortran ? `but not SHLIB_OPENMP_${cOrCxx} in PKG_LIBS` : 'but not in PKG_LIBS' : 'but no OPENMP macro in PKG_LIBS'));
			}
		}
		let count = 0;
		for(const f of ['C', 'CXX', 'F', 'FC']) {
			const flags = `${f}FLAGS`;
			const at = inLibs(flags)?.line;
			if(at === undefined) {
				continue;
			}
			count++;
			if((f === 'F' || f === 'FC') && !useFc || f === (have.cxx ? 'C' : 'CXX')) {
				note(at, `SHLIB_OPENMP_${flags} is included in PKG_LIBS but linking is by ${have.cxx ? 'C++' : 'C'}`);
			} else if(!used.includes(flags) && !(f === (have.cxx ? 'CXX' : 'C') && (used.includes('FFLAGS') || used.includes('FCFLAGS'))) && !(useFc && f === 'F' && used.join() === 'FCFLAGS')) {
				note(at, `SHLIB_OPENMP_${flags} is included in PKG_LIBS but not in PKG_${flags}`);
			}
		}
		if(count > 1) {
			note(libs[0]?.line, 'it is not portable to include multiple SHLIB_OPENMP_* macros in PKG_LIBS');
		}
		const cpp = find(/^[ \t]*PKG_CPPFLAGS.*SHLIB_OPENMP_/);
		if(cpp) {
			note(cpp.line, 'it is not portable to include SHLIB_OPENMP_* macros in PKG_CPPFLAGS; PKG_CPPFLAGS is used for both C and C++ code');
		}
	}
}

/** the problems of the `SystemRequirements` C++ standard */
function cxxRequirements(sysReq: string, config: CompiledCodeConfig): string[] {
	const items = sysReq.split(',');
	const found = [...config.knownCxxStandards, ...config.obsoleteCxxStandards].find(s => items.some(it => new RegExp(`(^| )C[+][+]${s}([ ,;]|$)`).test(it)));
	return found !== undefined ? config.obsoleteCxxStandards.includes(found) ? [`SystemRequirements specified C++${found}: support has been removed`] : []
		: items.flatMap(it => /^\s*C[+][+]([^,;]*)/.exec(it)?.slice(1).map(s => `SystemRequirements: invalid C++ specification 'C++${s.replace(/ *$/, '')}'`) ?? []);
}

/** The line-based checks as data, for the files of a package. */
function rulesFor(files: PackageFiles, config: CompiledCodeConfig, sysReq: string, linkingTo: readonly string[], anyFile: (p: RegExp) => boolean, have: Readonly<Record<string, boolean>>, isBad: (flag: string) => boolean): Rule[] {
	const seen = new Set<string>();
	const fresh = (key: string, message: string) => seen.has(key) ? undefined : (seen.add(key), message);
	const known = new Set(files.entries.filter(e => !e.isDirectory).map(e => e.relative));
	const verdict = (std: string) => config.obsoleteCxxStandards.includes(std) ? 'Obsolete' : config.knownCxxStandards.includes(std) ? undefined : 'Unknown';
	const callRe = new RegExp(`(?<![\\w.]|->)(${alt(config.unportableCalls)})\\s*\\(`, 'g');
	const objectRule = (names: readonly string[], symbol: (n: string) => string, gate?: (t: string) => boolean): Rule => {
		const re = new RegExp(`(?<![\\w.:]|->)(${alt(names)})\\b`, 'g');
		return { ...Code, gate, line: codeLine(l => [...l.matchAll(re)].map(m => [symbol(m[1])])), message: (file, _, [s]) => report(file, s, s.startsWith('std::') ? 'C++' : 'C') };
	};
	const report = (file: string, symbol: string, lang: string) => fresh(`${file}:${symbol}`, `Found '${symbol}', possibly from '${symbol}' (${lang}): compiled code should not call entry points which ${category(symbol)}`);
	const codeLine = (f: (line: string) => string[][]) => (l: string): Hits => /^\s*#\s*(?:include|pragma)\b/.test(l) ? false : f(l);
	const nonApi = new Map([...NonApiEntryPoints, ...config.extraNonApiEntryPoints].map(n => [n.replace(/^Rf_/, ''), n]));
	const nonApiRe = new RegExp(`(?<![\\w.]|->)(?:Rf_)?(${alt([...nonApi.keys()])})\\b`, 'g');
	const Code = { kind: 'compiled code', files: CFamily, prep: (t: string) => stripC(t, true), uncertain: true } as const;
	const Make = (kind: CompiledCodeKind, files: RegExp) => ({ kind, files, once: true }) as const;
	const blas = (lib: string, after: string): Rule => {
		const use = new RegExp(`\\$[{(]?${lib}`), followed = new RegExp(`\\$[{(]?${lib}.*\\$[{(]?${after}`);
		return { kind:    'for portable use of $(BLAS_LIBS) and $(LAPACK_LIBS)', files:   /^src\/(?:Makevars(?:\.in)?|Makefile(?:\.win|\.ucrt)?)$/, logical: true, when:    !anyFile(FortranSrc),
			line:    l => /^[ \t]*PKG_LIBS/.test(l) && use.test(l) && !followed.test(l), message: file => `Apparently using $(${lib}) without following $(${after}) in '${file}'` };
	};
	const pragma = (pattern: RegExp, message: string, gate?: Rule['gate']): Rule => ({ kind: 'pragmas in C/C++ headers and code', files: /^(?:src|inst\/include)\/.*\.(?:c|cc|cpp|h|hh|hpp)$/, once: true, line: pattern, message, gate });
	const important = /^\s*#pragma (?:GCC|clang) diagnostic ignored[^-]*[-]W(?:uninitialized|float-equal|array-bound|format)/;
	const kindFile = { kind: 'usage of KIND in Fortran files', files: FortranSrc } as const;
	const needs = { C: have.c, CXX: have.cxx, F: have.f || have.f9x, FC: have.f9x, CPP: have.c || have.cxx };
	return [
		{ ...Make('compilation flags in Makevars', MakevarsFile), when:    anyFile(/^src\/Makevars\.in$/) && anyFile(/^src\/Makevars$/), files:   /^src\/Makevars$/, line:    /^/,
			message: 'Package has both \'src/Makevars.in\' and \'src/Makevars\'. Installation with --no-configure\' is unlikely to work. If you intended \'src/Makevars\' to be used on Windows, rename it to \'src/Makevars.win\' otherwise remove it. If \'configure\' created \'src/Makevars\', you need a \'cleanup\' script.' },
		{ kind:  'compilation flags in Makevars', files: MakevarsFile, line:  l => {
			const m = new RegExp(`.*[.o]: +PKG_(${Prefixes})FLAGS *=`).exec(l);
			const flags = m ? l.slice(m[0].length).split(/\s+/).filter(isBad) : [];
			return flags.length > 0 && [flags];
		}, message: (file, _, flags) => `Non-portable flags in file '${file}': ${flags.join(' ')}` },
		{ ...Make('for GNU extensions in Makefiles', MakeFile), when:    !/GNU [Mm]ake/.test(sysReq.replace(/\s+/g, ' ')), line:    l => !/^ *#/.test(l) && !/[$][(].+:=.+[)]/.test(l) && GnuExtension.test(l),
			message: 'Found a file containing GNU extensions. Portable Makefiles do not use GNU extensions such as +=, :=, $(shell), $(wildcard), ifeq ... endif, .NOTPARALLEL' },
		blas('LAPACK_LIBS', 'BLAS_LIBS'), blas('BLAS_LIBS', 'FLIBS'),
		...Object.entries(needs).map(([f, present]): Rule => ({ ...Make('use of PKG_*FLAGS in Makefiles', FlagFile), when:    !present, line:    new RegExp(`^[ \\t]*PKG_${f}FLAGS`),
			message: file => `PKG_${f}FLAGS set in '${file}' without any corresponding files` })),
		{ ...Make('include directives in Makefiles', /(?:^|\/)(?:Makefile(?:\.in|\.win|\.ucrt)?|makefile|GNUmakefile)$/), line:    /^include .*R_HOME/,
			message: 'Found a Makefile with an include directive with a pathname using R_HOME. R_HOME may contain spaces, which Makefile directives cannot portably quote; use the make \'-f\' option to include files in directories specified using R_HOME instead' },
		pragma(important, 'File which contains pragma(s) suppressing important diagnostics'),
		pragma(new RegExp(`^\\s*#pragma (?:GCC|clang) diagnostic[^-]*[-]W(?:${NonPortableWarnings.join('|')})`), 'File which contains non-portable pragma(s)', t => /^\s*#pragma (GCC|clang) diagnostic ignored/m.test(t)),
		pragma(/^\s*#pragma (?:GCC|clang) diagnostic ignored/, 'File which contains pragma(s) suppressing diagnostics', t => !new RegExp(important.source, 'm').test(t)),
		{ ...kindFile, line: l => !FortranComment.test(l) && KindDeclaration.test(l), message: (_, l) => `Found file with non-portable usage of KIND: ${l.trim()}` },
		{ ...kindFile, when:    config.flagStarKinds, line:    l => !FortranComment.test(l) && !KindDeclaration.test(l) && /\b(?:real|integer|complex|logical)\s*\*\s*\d+/i.test(l.replace(/!.*/, '')),
			message: (_, l) => `Found file with non-portable type declaration (use KIND parameters instead of a byte count): ${l.trim()}` },
		{ kind: 'C++ specification', files: /^src\/Makevars(?:\.in|\.win|\.ucrt)?$/, logical: true, line: /^\s*CXX_STD\s*(?:\+|:)?=\s*CXX(\d+)\s*$/, message: (file, _, [, std]) => verdict(std) && `${verdict(std)} C++${std} standard request will be ignored (CXX_STD in ${file})` },
		{ ...Code, line: codeLine(l => [...l.matchAll(callRe)].filter(m => {
			const pre = l.slice(0, m.index), word = /(\w+)\s*\**\s*$/.exec(pre)?.[1];
			return !(/\w::$/.test(pre) && !/\bstd::$/.test(pre) || word !== undefined && !Declarators.has(word));
		}).map(m => [m[1]])), message: (file, _, [s]) => report(file, s, /\.(c|h)$/.test(file) ? 'C' : 'C++') },
		objectRule(config.unportableObjects, n => n),
		objectRule(config.unportableObjects.filter(o => o.startsWith('std::')).map(o => o.slice(5)), n => `std::${n}`, t => /using\s+namespace\s+std\b/.test(t)),
		{ ...Code, when:    config.checkNonApi, gate:    t => UsesR.test(t), line:    l => /^\s*#\s*(?:include|pragma|define)\b/.test(l) ? false : [...l.matchAll(nonApiRe)].map(m => [nonApi.get(m[1]) ?? m[1]]),
			message: (file, _, [n]) => fresh(`${file}:nonapi:${n}`, `Found non-API call to R: '${n}'. Compiled code should not call non-API entry points in R. This entry point may be removed soon`) },
		{ kind:      'compiled code', files:     FortranSrc, uncertain: true, line:      (raw, file) => /\.f(?:90|95)$/.test(file) || !/^[cC*!]/.test(raw)
			? FortranStatements.filter(([n, p]) => config.unportableFortran.includes(n) && p.test(raw.replace(/!.*/, ''))).map(([n]) => [n]) : false,
		message: (file, _, [s]) => report(file, s, 'Fortran') },
		{ kind:    'whether package can be installed', files:   /^(?:src|inst\/include)\/.*\.(?:c|cc|cpp|cxx|C|h|hh|hpp|hxx)$/, prep:    t => stripC(t, false), line:    Include, message: (file, _, [, inc]) => {
			const dir = file.slice(0, file.lastIndexOf('/'));
			const pkg = [`${dir}/${inc}`, `src/${inc}`, `inst/include/${inc}`].some(k => known.has(k)) ? undefined
				: Object.entries(config.headerPackages).find(([h]) => h.endsWith('/') ? inc.startsWith(h) : inc === h)?.[1];
			return pkg === undefined || linkingTo.includes(pkg) ? undefined : fresh(`${file}:${pkg}`, `The code includes '${inc}' but the DESCRIPTION does not list '${pkg}' in LinkingTo, so the header is not found when installing`);
		} }
	];
}

/** Port of the static `R CMD check` checks on compiled code and build files (Rust compilation and the binary part of the compiled code check are not ported). */
export const COMPILED_CODE = {
	createSearch:        () => Q.from([]),
	processSearchResult: (_elements, config, data) => {
		const ctx = data.inspectContext();
		const pkg = packageInfo(ctx);
		const files = packageFiles(ctx, pkg.name);
		if(files === undefined) {
			return { results: [], '.meta': { consideredFiles: 0 } };
		}
		const found = fileFindings<CompiledCodeKind>(files, config.skip);
		const add: Add = (kind, file, line, message, uncertain) => found.add(kind, file, message, line, uncertain ? LintingResultCertainty.Uncertain : undefined);
		const sysReq = pkg.description?.content().get('SystemRequirements')?.join(' ') ?? '';
		const anyFile = (p: RegExp) => files.entries.some(e => !e.isDirectory && p.test(e.relative));
		const have = { c: anyFile(/^src\/.*\.c$/), cxx: anyFile(/^src\/.*\.(cc|cpp)$/), f: anyFile(/^src\/.*\.f$/), f9x: anyFile(/^src\/.*\.f9[05]$/) };
		const bad = new RegExp(`^-(${config.nonPortableFlags.join('|')})$`);
		const isBad = (flag: string) => bad.test(flag) && !config.allowedFlags.includes(flag);
		checkLineEndings(files, add);
		checkMakevars(files, isBad, add);
		checkOpenMp(files, have, add);
		scan(files, rulesFor(files, config, sysReq, pkg.declared.get('LinkingTo') ?? [], anyFile, have, isBad), add);
		const at = firstLine(files, 'DESCRIPTION', /^SystemRequirements:/) ?? 1;
		cxxRequirements(sysReq, config).forEach(m => add('C++ specification', 'DESCRIPTION', at, m));
		const sources = files.entries.filter(e => !e.isDirectory && CSource.test(e.relative));
		const rText = sources.map(e => stripC(files.read(e.relative) ?? '', true)).filter(t => UsesR.test(t));
		(config.checkRegistration && rText.length > 0 ? ['R_registerRoutines', 'R_useDynamicSymbols'] : []).filter(symbol => !rText.some(t => new RegExp(`\\b${symbol}\\b`).test(t)))
			.forEach(symbol => add('compiled code', sources[0].relative, 1, `Found no call to: '${symbol}'. It is good practice to register native routines and to disable symbol search`, true));
		const namespace = ctx.files.getFilesByRole(FileRole.Namespace)[0]?.content();
		const compiled = files.entries.find(e => !e.isDirectory && /^src\/.*\.(c|cc|cpp|cxx|C|f|f90|f95|m|mm)$/.test(e.relative));
		const dynLib = Object.entries(namespace ?? {}).some(([name, info]) => name !== 'current' && info.loadsWithSideEffects);
		const installProblem = namespace === undefined ? undefined
			: compiled && !dynLib ? `The package has compiled code ('${compiled.relative}') but its NAMESPACE has no useDynLib directive, so the shared object is never loaded`
				: dynLib && !compiled && files.onDisk && !files.entries.some(e => e.isDirectory && e.relative === 'src') ? 'The NAMESPACE has a useDynLib directive but the package has no src directory, so loading the package fails' : undefined;
		if(installProblem) {
			add('whether package can be installed', 'NAMESPACE', 1, installProblem);
		}
		return { results: found.results, '.meta': { consideredFiles: files.entries.filter(e => !e.isDirectory).length } };
	},
	prettyPrint: {
		[LintingPrettyPrintContext.Query]: result => `${result.message} at ${SourceLocation.format(result.loc)}`,
		[LintingPrettyPrintContext.Full]:  result => `checking ${result.kind}: ${result.message} (at ${SourceLocation.format(result.loc)})`
	},
	info: {
		name:          'Compiled Code',
		tags:          [LintingRuleTag.CmdCheck],
		certainty:     LintingRuleCertainty.BestEffort,
		description:   'Finds problems in `src/` and the build files: non-portable Makevars flags, BLAS/LAPACK and OpenMP flag use, GNU make extensions, pragmas, line endings, Fortran KIND, the C++ standard, calls to non-API or non-portable entry points, and `useDynLib` against `src/`.',
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
