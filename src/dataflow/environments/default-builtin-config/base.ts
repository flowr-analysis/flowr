import { fn, constant, replacement, pkg, base, utils, stats, Primitive, Overrides, Deprecated } from './define';
import { ExitPointType } from '../../info';
import { KnownHooks } from '../../hooks';
import { Identifier, PkgName } from '../identifier';
import { BuiltInProcName } from '../built-in-proc-name';
import { BuiltInEvalName } from '../built-in-eval-name';
import { NseArguments } from '../../internal/process/functions/call/nse-kind';
import { Unquote } from '../../internal/process/functions/call/nse';
import { ArgProp, CallProp, type FnSig, SemanticCallTag } from '../built-in-props';
import { Top } from '../../eval/values/r-value';
import { AmbientStateAccessType } from '../../internal/process/functions/call/built-in/built-in-ambient-state';
import { AmbientStateName, KeyedState } from '../ambient-state-name';
import { SigXY, SigX, SigXDots, SigShape, SigXTable, SigDots, SigUnique, SigDotsDeparsed, sig, Forced } from './signatures';
import { StackEnvKind, StackEnvBuiltins, SetsAnyEnvVar, CopiesFiles, WithSig, ReadPrintingOptions, PrintDispatched, SetsEntryNamedBy, SetsEntry, LibrarySearchPath, DetachSearchPath, AttachSearchPath } from './shared';
import type { AnyBuiltInDefinition } from '../built-in-config';

/** The built-in definitions of the base package. */
export const BaseDefinitions = [
	constant(base('NULL'), null, Primitive),
	/* an `NA` is a value R has and flowR has no way to hold, which is not the same as having none: `is.null(NA)` is FALSE */
	constant(base('NA', 'NA_integer_', 'NA_real_', 'NA_complex_', 'NA_character_'), Top, Primitive),
	constant(base('NaN'), NaN, Primitive),
	/* an environment is no more `NULL` than an `NA` is; which one it stands for is what the stack-env handling answers */
	constant(base('.GlobalEnv', '.BaseNamespaceEnv', '.BaseEnv'), Top, Primitive),
	constant(base('TRUE', 'T'), true, Primitive),
	constant(base('FALSE', 'F'), false, Primitive),
	constant(base('Inf'), Infinity, Primitive),
	constant(base('-Inf'), -Infinity, Primitive),
	constant(base('pi'), Math.PI, Primitive),
	constant(base('LETTERS'), Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i)), Primitive),
	constant(base('letters'), Array.from({ length: 26 }, (_, i) => String.fromCharCode(97 + i)), Primitive),
	constant(base('month.abb'), ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], Primitive),
	constant(base('month.name'), ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
		Primitive
	),
	fn(base('t'), BuiltInProcName.DefaultReadAllArgs, { props: CallProp.Pure, tags: [SemanticCallTag.Transforms], sig: SigXDots }, Primitive),
	/* an {@link BuiltInEvalName} marks what the value solver folds; a test checks the names against the handler tables */
	/* the result follows from how large the argument is, not from what is in it, so it is bounded (`Narrows`) */
	fn(base(
		'length', 'lengths', 'nrow', 'ncol', 'NROW', 'NCOL', 'dim', 'is.null', 'is.factor', 'is.vector', 'is.matrix', 'is.data.frame', 'is.numeric',
		'is.character', 'is.logical', 'is.function', 'is.list', 'is.double', 'is.integer', 'is.complex', 'is.raw', 'is.single', 'is.ordered'
	), BuiltInProcName.DefaultReadAllArgs, { props: CallProp.Pure, tags: [SemanticCallTag.Narrows], sig: SigShape }, Primitive),
	/* the names and the class are read off the argument, so whatever it carries can show up in the result */
	fn(base('dimnames', 'names', 'rownames', 'colnames', 'class'), BuiltInProcName.DefaultReadAllArgs,
		{ props: CallProp.Pure, sig: SigShape }, Primitive
	),
	fn(base('structure'), BuiltInProcName.DefaultReadAllArgs, { props: CallProp.Pure, sig: sig({ '.Data': Forced.Value, '...': Forced.Value }) }),
	fn(base('nchar'), BuiltInProcName.DefaultReadAllArgs,
		{ props: CallProp.Pure, tags: [SemanticCallTag.Narrows], sig: SigShape }, { assumePrimitive: true, evalHandler: BuiltInEvalName.StringFn }
	),
	fn(base('missing'), BuiltInProcName.DefaultReadAllArgs, { props: CallProp.Pure, sig: sig({ x: ArgProp.Presence }) }, Primitive),
	/* they fold everything they are handed into one result */
	fn(base('sum', 'prod', 'min', 'max', 'range', 'pmin', 'pmax', 'order', 'any'), BuiltInProcName.DefaultReadAllArgs,
		{ props: CallProp.Pure, sig: SigDots }, Primitive
	),
	fn(base('data.frame', 'table'), BuiltInProcName.DefaultReadAllArgs, { props: CallProp.Pure, sig: SigDotsDeparsed }, Primitive),
	fn(base('cbind', 'rbind'), BuiltInProcName.DefaultReadAllArgs,
		{ props: CallProp.Pure, tags: [SemanticCallTag.Transforms], sig: SigDotsDeparsed }, Primitive
	),
	/* the separator sits behind the `...`, so R (and the {@link FnSig}) only ever matches it by its full name */
	fn(base('paste', 'paste0'), BuiltInProcName.DefaultReadAllArgs,
		{ props: CallProp.Pure, sig: sig({ '...': Forced.Value, sep: Forced.Value }) },
		{ assumePrimitive: true, evalHandler: BuiltInEvalName.StringFn }
	),
	fn(base('file.path'), BuiltInProcName.DefaultReadAllArgs,
		{ props: CallProp.Pure, sig: sig({ '...': Forced.Value, fsep: Forced.Value }) },
		{ assumePrimitive: true, evalHandler: BuiltInEvalName.StringFn }
	),
	/* `x` carries the data, whatever follows only tunes the result */
	fn([
		...Identifier.fromAll(PkgName.Base, [
			/* `mean` reduces a vector, so unlike its neighbors below the value solver cannot fold it */
			'mean',
			/* running summaries & reordering */
			'cumsum', 'cumprod', 'cummax', 'cummin', 'diff', 'sort', 'rev', 'unique', 'duplicated',
			/* coercion */
			'as.character', 'as.matrix', 'as.data.frame', 'as.factor', 'as.raw', 'as.list', 'as.array', 'factor', 'as.ordered'
		]),
		...utils('head', 'tail'),
		...stats('var', 'sd', 'median', 'quantile'),
	], BuiltInProcName.DefaultReadAllArgs,
	{ props: CallProp.Pure, sig: SigXDots },
	Primitive
	),
	/* a number or a logical carries none of the text it was converted from */
	fn(base('as.integer', 'as.logical', 'as.numeric', 'as.double', 'as.complex', 'as.single'), BuiltInProcName.DefaultReadAllArgs,
		{ props: CallProp.Pure, tags: [SemanticCallTag.Narrows], sig: SigXDots }, Primitive
	),
	/* they read the values but answer only with a logical, so nothing those values carry reaches the result */
	fn(base('is.na', 'nzchar', 'is.finite', 'is.infinite', 'is.nan'), BuiltInProcName.DefaultReadAllArgs,
		{ props: CallProp.Pure, tags: [SemanticCallTag.Narrows], sig: SigX }, Primitive
	),
	/* the numeric functions the value solver folds; each one is an entry of `NumericFns`, which states its parameters */
	fn(base(
		'sqrt', 'abs', 'floor', 'ceiling', 'trunc', 'sign', 'exp', 'expm1', 'log2', 'log10', 'log1p', 'sin', 'cos', 'tan', 'asin', 'acos', 'atan',
		'sinh', 'cosh', 'tanh', 'asinh', 'acosh', 'atanh'
	), BuiltInProcName.DefaultReadAllArgs, { props: CallProp.Pure, sig: SigX }, { assumePrimitive: true, evalHandler: BuiltInEvalName.Numeric }),
	fn(base('round', 'signif'), BuiltInProcName.DefaultReadAllArgs,
		{ props: CallProp.Pure, sig: sig({ x: Forced.Value, digits: Forced.Value }) },
		{ assumePrimitive: true, evalHandler: BuiltInEvalName.Numeric }
	),
	fn(base('log'), BuiltInProcName.DefaultReadAllArgs,
		{ props: CallProp.Pure, sig: sig({ x: Forced.Value, base: Forced.Value }) }, { assumePrimitive: true, evalHandler: BuiltInEvalName.Numeric }
	),
	fn(base('tolower', 'toupper', 'trimws'), BuiltInProcName.DefaultReadAllArgs,
		{ props: CallProp.Pure, sig: SigX }, { assumePrimitive: true, evalHandler: BuiltInEvalName.StringFn }
	),
	fn(base('basename', 'dirname'), BuiltInProcName.DefaultReadAllArgs,
		{ props: CallProp.Pure, sig: sig({ path: Forced.Value }) }, { assumePrimitive: true, evalHandler: BuiltInEvalName.StringFn }
	),
	fn(base('Re', 'Im', 'Mod', 'Arg', 'Conj'), BuiltInProcName.DefaultReadAllArgs,
		{ props: CallProp.Pure, sig: sig({ z: Forced.Value }) }, Primitive
	),
	/* the vector constructors take the length of the result, not its contents */
	fn(base('numeric', 'character', 'logical', 'integer', 'double', 'raw', 'single'), BuiltInProcName.DefaultReadAllArgs,
		{ props: CallProp.Pure, sig: sig({ length: Forced.Value }) }, Primitive
	),
	fn(base('vector'), BuiltInProcName.DefaultReadAllArgs,
		{ props: CallProp.Pure, sig: sig({ mode: Forced.Flag, length: Forced.Value }) }, Primitive
	),
	fn(base('mat.or.vec'), BuiltInProcName.DefaultReadAllArgs, { props: CallProp.Pure, sig: sig({ nr: Forced.Value, nc: Forced.Value }) }, Primitive),
	fn(base('as.vector'), BuiltInProcName.DefaultReadAllArgs, { props: CallProp.Pure, sig: sig({ x: Forced.Value, mode: Forced.Flag }) }, Primitive),
	fn(base('rep_len'), BuiltInProcName.DefaultReadAllArgs,
		{ props: CallProp.Pure, sig: sig({ x: Forced.Value, 'length.out': Forced.Value }) }, Primitive
	),
	/* two data arguments, under the names R gives them */
	fn(base('xor', 'crossprod', 'tcrossprod', 'intersect', 'union', 'setdiff'), BuiltInProcName.DefaultReadAllArgs,
		{ props: CallProp.Pure, sig: SigXY }, Primitive
	),
	/* they answer with a position or a logical, never with what they matched */
	fn(base('match', 'pmatch', 'charmatch'), BuiltInProcName.DefaultReadAllArgs,
		{ props: CallProp.Pure, tags: [SemanticCallTag.Narrows], sig: SigXTable }, Primitive
	),
	fn(base('is.element'), BuiltInProcName.DefaultReadAllArgs,
		{ props: CallProp.Pure, tags: [SemanticCallTag.Narrows], sig: sig({ el: Forced.Value, set: Forced.Value }) }, Primitive
	),
	/* the result is one of the `choices`, so what flows in is bounded by that argument */
	fn(base('match.arg'), BuiltInProcName.DefaultReadAllArgs,
		{ props: CallProp.Pure, tags: [SemanticCallTag.Narrows], sig: sig({ arg: Forced.Value, choices: ArgProp.Forced | ArgProp.Bounds }) },
		Primitive
	),
	fn(base('atan2'), BuiltInProcName.DefaultReadAllArgs,
		{ props: CallProp.Pure, sig: sig({ y: Forced.Value, x: Forced.Value }) }, { assumePrimitive: true, evalHandler: BuiltInEvalName.Numeric }
	),
	fn(base('bitwAnd', 'bitwOr', 'bitwXor'), BuiltInProcName.DefaultReadAllArgs,
		{ props: CallProp.Pure, sig: sig({ a: Forced.Value, b: Forced.Value }) }, { assumePrimitive: true, evalHandler: BuiltInEvalName.Numeric }
	),
	fn(base('bitwShiftL', 'bitwShiftR'), BuiltInProcName.DefaultReadAllArgs,
		{ props: CallProp.Pure, sig: sig({ a: Forced.Value, n: Forced.Value }) }, { assumePrimitive: true, evalHandler: BuiltInEvalName.Numeric }
	),
	fn(base('bitwNot'), BuiltInProcName.DefaultReadAllArgs,
		{ props: CallProp.Pure, sig: sig({ a: Forced.Value }) }, { assumePrimitive: true, evalHandler: BuiltInEvalName.Numeric }
	),
	fn(base('grepl'), BuiltInProcName.DefaultReadAllArgs,
		{ props: CallProp.Pure, tags: [SemanticCallTag.Narrows], sig: sig({ pattern: Forced.Value, x: Forced.Value }) }, Primitive
	),
	fn(base('startsWith'), BuiltInProcName.DefaultReadAllArgs,
		{ props: CallProp.Pure, tags: [SemanticCallTag.Narrows], sig: sig({ x: Forced.Value, prefix: Forced.Value }) }, Primitive
	),
	fn(base('endsWith'), BuiltInProcName.DefaultReadAllArgs,
		{ props: CallProp.Pure, tags: [SemanticCallTag.Narrows], sig: sig({ x: Forced.Value, suffix: Forced.Value }) }, Primitive
	),
	/* the rest of the pure computations, where no single shape fits */
	fn([
		...Identifier.fromAll(PkgName.Base, [
			'rep', 'rep.int', 'seq.int', 'append', 'complex',
			'matrix', 'array', 'prop.table', 'colSums', 'rowSums', 'colMeans', 'rowMeans',
			'solve', 'det', 'eigen', 'aperm',
			/* string */
			'grep', 'sub', 'gsub', 'substr', 'substring', 'strsplit', 'strrep', 'chartr', 'strtoi', 'shQuote',
			'regexpr', 'gregexpr', 'regexec', 'format', 'formatC',
			/* regmatches yields a substring of its subject, so what flows in flows out */
			'regmatches'
		]),
		...stats('cor', 'cov', 'xtabs'),
	], BuiltInProcName.DefaultReadAllArgs,
	{ props: CallProp.Pure },
	Primitive
	),

	/* indices and index sequences: bounded by the shape of what they are handed, never by its contents */
	fn(base('which', 'which.max', 'which.min', 'seq_len', 'seq_along'), BuiltInProcName.DefaultReadAllArgs,
		{ props: CallProp.Pure, tags: [SemanticCallTag.Narrows] }, Primitive
	),
	/* `seq` dispatches, so `...` really is all it declares; the named formals belong to `seq.default`/`seq.int` */
	fn(base('seq'), BuiltInProcName.DefaultReadAllArgs, { props: CallProp.Pure, sig: sig({ '...': Forced.Value }) }, Primitive),
	fn(base('scan'), BuiltInProcName.DefaultReadAllArgs,
		{ tags: [SemanticCallTag.File, SemanticCallTag.Reads, SemanticCallTag.User], sig: sig({ file: Forced.Resource | ArgProp.Optional }) }
	),
	/* the package functions that read or write a file, each naming the argument that holds the path; the
	   dependency query reads its `read` and `write` categories back from here rather than listing them again */
	fn(base('read.dcf'), BuiltInProcName.DefaultReadAllArgs,
		{ tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: sig({ file: Forced.Resource, '...': Forced.Value }) }
	),
	/* reading an environment file sets the variables it lists, which we do not know */
	fn(base('readRenviron'), BuiltInProcName.Default,
		{
			readAllArguments:      true,
			hasUnknownSideEffects: true,
			props:                 CallProp.Invisible | CallProp.Configures,
			ambient:               SetsAnyEnvVar,
			tags:                  [SemanticCallTag.File, SemanticCallTag.Reads],
			sig:                   sig({ path: Forced.Resource, '...': Forced.Value })
		}
	),
	fn(base('dump'), BuiltInProcName.Get,
		{
			returnsValue: false,
			props:        CallProp.Invisible,
			tags:         [SemanticCallTag.File, SemanticCallTag.Writes],
			sig:          sig({ list: Forced.Value, file: Forced.Resource, '...': Forced.Value })
		}
	),
	/* the connections and the calls that move data through them, so anything reaching them inherits it */
	fn(base('file', 'gzfile', 'bzfile', 'xzfile', 'unz', 'fifo'), BuiltInProcName.DefaultReadAllArgs,
		{
			tags: [SemanticCallTag.Opens, SemanticCallTag.File, SemanticCallTag.Reads, SemanticCallTag.Writes],
			sig:  sig({ description: Forced.Resource })
		}
	),
	fn(base('url'), BuiltInProcName.DefaultReadAllArgs,
		{ tags: [SemanticCallTag.Opens, SemanticCallTag.Network, SemanticCallTag.Reads], sig: sig({ description: Forced.Resource }) }
	),
	fn(base('socketConnection', 'serverSocket'), BuiltInProcName.DefaultReadAllArgs,
		{ tags: [SemanticCallTag.Opens, SemanticCallTag.Network, SemanticCallTag.Reads], sig: sig({ host: Forced.Resource }) }
	),
	fn(base('rawConnection'), BuiltInProcName.DefaultReadAllArgs, { tags: [SemanticCallTag.Opens], sig: sig({ object: Forced.Value }) }),
	fn(base('stdout', 'stderr', 'stdin'), BuiltInProcName.Default, { tags: [SemanticCallTag.Console] }),
	fn(base('textConnection'), BuiltInProcName.DefaultReadAllArgs,
		{ ambient: { type: AmbientStateAccessType.OpenTextConnection }, tags: [SemanticCallTag.Opens], sig: sig({ object: Forced.Value }) }
	),
	/* the calls ending what an opener started, each stating the argument holding the handle */
	/* opening a connection decides where it reads and whether a write appends, which later uses of it depend on */
	fn(base('open', 'open.connection', 'seek'), BuiltInProcName.DefaultReadAllArgs,
		{
			props: CallProp.Invisible,
			tags:  [SemanticCallTag.File, SemanticCallTag.Writes],
			sig:   sig({ con: Forced.Resource | ArgProp.Handle, '...': Forced.Value })
		}
	),
	fn(base('close'), BuiltInProcName.DefaultReadAllArgs,
		{
			props:   CallProp.Invisible | CallProp.Generic,
			ambient: { type: AmbientStateAccessType.WriteFiles },
			tags:    [SemanticCallTag.Closes],
			sig:     sig({ con: Forced.Handle, '...': Forced.Value })
		}
	),
	fn(base('close.connection'), BuiltInProcName.DefaultReadAllArgs,
		{
			props:   CallProp.Invisible,
			ambient: { type: AmbientStateAccessType.WriteFiles },
			tags:    [SemanticCallTag.Closes],
			sig:     sig({ con: Forced.Handle, type: Forced.Flag, '...': Forced.Value })
		}
	),
	fn(base('flush'), BuiltInProcName.DefaultReadAllArgs,
		{ props: CallProp.Invisible | CallProp.Generic, ambient: { type: AmbientStateAccessType.WriteFiles }, sig: sig({ con: Forced.Handle }) }
	),
	fn(base('closeAllConnections'), BuiltInProcName.DefaultReadAllArgs, { props: CallProp.Invisible, tags: [SemanticCallTag.Closes] }),
	fn(base('readLines', 'readBin', 'readChar'), BuiltInProcName.DefaultReadAllArgs,
		{ tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: sig({ con: Forced.Resource }) }
	),
	fn(base('readRDS', 'dget'), BuiltInProcName.DefaultReadAllArgs,
		{ tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: sig({ file: Forced.Resource }) }
	),
	fn(base('writeLines'), BuiltInProcName.DefaultReadAllArgs,
		{
			props: CallProp.Invisible,
			tags:  [SemanticCallTag.File, SemanticCallTag.Writes, SemanticCallTag.Prints],
			sig:   sig({ text: Forced.Value, con: Forced.Resource | ArgProp.Optional })
		}
	),
	fn(base('writeBin', 'writeChar'), BuiltInProcName.DefaultReadAllArgs,
		{ props: CallProp.Invisible, tags: [SemanticCallTag.File, SemanticCallTag.Writes], sig: sig({ object: Forced.Value, con: Forced.Resource }) }
	),
	fn(base('saveRDS'), BuiltInProcName.DefaultReadAllArgs,
		{
			props: CallProp.Invisible,
			tags:  [SemanticCallTag.File, SemanticCallTag.Writes],
			sig:   sig({ object: Forced.Value, file: Forced.Resource | ArgProp.Optional })
		}
	),
	fn(base('save'), BuiltInProcName.DefaultReadAllArgs,
		{
			namesIn: ['...', 'list'],
			props:   CallProp.Invisible,
			tags:    [SemanticCallTag.File, SemanticCallTag.Writes],
			sig:     sig({ '...': Forced.Value, list: Forced.Value, file: Forced.Resource })
		}
	),
	fn(base('save.image'), BuiltInProcName.EnvContents,
		{ props: CallProp.Invisible, tags: [SemanticCallTag.File, SemanticCallTag.Writes], sig: sig({ file: Forced.Resource }) }
	),
	fn(base('dir.exists'), BuiltInProcName.DefaultReadAllArgs,
		{ tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: sig({ path: Forced.Resource }) }
	),
	fn(base('file.access'), BuiltInProcName.DefaultReadAllArgs,
		{ tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: sig({ names: Forced.Resource, mode: Forced.Flag }) }
	),
	fn([...base('normalizePath'), ...pkg(PkgName.Fs, 'path_abs', 'path_real')], BuiltInProcName.DefaultReadAllArgs,
		{
			ambient: { type: AmbientStateAccessType.GetWorkingDirectory },
			props:   CallProp.Ambient,
			sig:     sig({ path: Forced.Value, winslash: Forced.Flag, mustWork: Forced.Flag })
		}
	),
	fn(base('dput'), BuiltInProcName.DefaultReadAllArgs,
		{
			props: CallProp.Invisible,
			tags:  [SemanticCallTag.File, SemanticCallTag.Writes, SemanticCallTag.Prints],
			sig:   sig({ x: Forced.Value, file: Forced.Resource | ArgProp.Optional })
		}
	),
	fn(base('write'), BuiltInProcName.DefaultReadAllArgs,
		{
			props: CallProp.Invisible,
			tags:  [SemanticCallTag.File, SemanticCallTag.Writes, SemanticCallTag.Prints],
			sig:   sig({ x: Forced.Value, file: Forced.Resource })
		}
	),
	fn(base('write.dcf'), BuiltInProcName.DefaultReadAllArgs,
		{
			props: CallProp.Invisible,
			tags:  [SemanticCallTag.File, SemanticCallTag.Writes],
			sig:   sig({ x: Forced.Value, file: Forced.Resource | ArgProp.Optional })
		}
	),
	fn(base('jitter'), BuiltInProcName.DefaultReadAllArgs,
		{
			ambient: { type: AmbientStateAccessType.DrawRng },
			tags:    [SemanticCallTag.Random],
			sig:     sig({ x: ArgProp.NoDefault, factor: 0, amount: 0 })
		},
		Primitive
	),
	fn([
		...base('sample', 'sample.int'),
		...stats(
			'runif', 'rnorm', 'rbinom', 'rpois', 'rexp', 'rgamma', 'rbeta', 'rcauchy', 'rchisq', 'rgeom', 'rhyper', 'rlnorm', 'rlogis', 'rmultinom',
			'rnbinom', 'rsignrank', 'rt', 'rf', 'rweibull', 'rwilcox', 'arima.sim', 'simulate', 'kmeans'
		)
	], BuiltInProcName.DefaultReadAllArgs, { ambient: { type: AmbientStateAccessType.DrawRng }, tags: [SemanticCallTag.Random] }),
	fn(base('expression'), BuiltInProcName.Default, { props: CallProp.Lang, sig: sig({ '...': ArgProp.Nse }) }, Primitive),
	fn(base('reg.finalizer'), BuiltInProcName.Default,
		{ ambient: { type: AmbientStateAccessType.RegisterFinalizer }, sig: sig({ e: ArgProp.Forced, f: ArgProp.Forced, onexit: Forced.Flag }) }
	),
	fn(base('gc'), BuiltInProcName.Default,
		{ ambient: { type: AmbientStateAccessType.RunFinalizers }, sig: sig({ verbose: Forced.Flag, reset: Forced.Flag, full: Forced.Flag }) }
	),
	fn(base('rm'), BuiltInProcName.Rm,
		{ props: CallProp.Invisible | CallProp.Scope, sig: sig({ '...': 0, list: 0, pos: 0, envir: 0, inherits: 0 }) }, Primitive
	),
	/* they read the state they set, so both bits apply */
	fn(base('options'), BuiltInProcName.Default,
		{
			ambient: { type: AmbientStateAccessType.SetOptions },
			props:   CallProp.Invisible | CallProp.Ambient | CallProp.Configures,
			sig:     sig({ '...': ArgProp.Forced })
		}
	),
	/* `Sys.putenv` is defunct in current R, older scripts still use it */
	fn(base('Sys.setenv', 'Sys.putenv'), BuiltInProcName.Default,
		{
			ambient: { type: AmbientStateAccessType.SetKeyed, state: KeyedState.Env, keys: { from: 'argument-names' } },
			props:   CallProp.Invisible | CallProp.Configures,
			sig:     sig({ '...': ArgProp.Forced })
		}
	),
	fn(base('Sys.unsetenv'), BuiltInProcName.Default,
		{
			ambient: SetsEntryNamedBy(KeyedState.Env, ['x'], 'x'),
			props:   CallProp.Invisible | CallProp.Configures,
			sig:     sig({ '...': ArgProp.Forced })
		}
	),
	fn(base('Sys.setlocale'), BuiltInProcName.Default,
		{
			ambient:               SetsEntryNamedBy(KeyedState.Locale, ['category', 'locale'], 'category', { fallback: 'LC_ALL' }),
			hasUnknownSideEffects: true,
			props:                 CallProp.Invisible | CallProp.Configures,
			sig:                   sig({ '...': ArgProp.Forced })
		}
	),
	/* the language is the environment variable `LANGUAGE`, which the translations of messages follow */
	fn(base('Sys.setLanguage'), BuiltInProcName.Default,
		{
			ambient:               [SetsEntry(KeyedState.Locale, 'LANGUAGE'), SetsEntry(KeyedState.Env, 'LANGUAGE')],
			hasUnknownSideEffects: true,
			props:                 CallProp.Invisible | CallProp.Configures,
			sig:                   sig({ '...': ArgProp.Forced })
		}
	),
	fn([...base('mapply'), ...pkg(PkgName.Functools, 'Mapply')], BuiltInProcName.Apply,
		{
			indexOfFunction:        0,
			nameOfFunctionArgument: 'FUN',
			unquoteFunction:        true,
			props:                  CallProp.MayPure,
			sig:                    sig({ FUN: ArgProp.Callee, '...': ArgProp.Value })
		}
	),
	fn(base('lapply', 'sapply', 'vapply'), BuiltInProcName.Apply,
		{
			indexOfFunction:        1,
			nameOfFunctionArgument: 'FUN',
			unquoteFunction:        true,
			props:                  CallProp.MayPure,
			sig:                    sig({ X: ArgProp.Value, FUN: ArgProp.Callee, '...': ArgProp.Value })
		}
	),
	/* `vapply` takes the shape of the result before its `...`, so naming it keeps the positions honest */
	fn(base('vapply'), BuiltInProcName.Apply,
		{
			indexOfFunction:        1,
			nameOfFunctionArgument: 'FUN',
			unquoteFunction:        true,
			props:                  CallProp.MayPure,
			sig:                    sig({ X: ArgProp.Value, FUN: ArgProp.Callee, 'FUN.VALUE': ArgProp.Shape, '...': ArgProp.Value })
		},
		Overrides
	),
	fn([...base('apply', 'tapply'), ...pkg(PkgName.Functools, 'Tapply')], BuiltInProcName.Apply,
		{
			indexOfFunction:        2,
			nameOfFunctionArgument: 'FUN',
			unquoteFunction:        true,
			props:                  CallProp.MayPure,
			tags:                   [SemanticCallTag.Transforms],
			sig:                    sig({ X: ArgProp.NoDefault, '...': 0 })
		}
	),
	fn(base('Map'), BuiltInProcName.Apply,
		{
			indexOfFunction:        0,
			nameOfFunctionArgument: 'f',
			unquoteFunction:        true,
			props:                  CallProp.MayPure,
			sig:                    sig({ f: ArgProp.Callee, '...': ArgProp.Value })
		}
	),
	fn(base('outer'), BuiltInProcName.Apply,
		{
			indexOfFunction:        2,
			nameOfFunctionArgument: 'FUN',
			unquoteFunction:        true,
			props:                  CallProp.MayPure,
			sig:                    sig({ X: ArgProp.Value, Y: ArgProp.Value, FUN: ArgProp.Callee, '...': ArgProp.Value })
		}
	),
	fn(base('Filter'), BuiltInProcName.Apply,
		{
			indexOfFunction:        0,
			nameOfFunctionArgument: 'f',
			unquoteFunction:        true,
			props:                  CallProp.MayPure,
			sig:                    sig({ f: ArgProp.Callee, x: ArgProp.Value })
		}
	),
	fn(base('Find', 'Position'), BuiltInProcName.Apply,
		{
			indexOfFunction:        0,
			nameOfFunctionArgument: 'f',
			unquoteFunction:        true,
			props:                  CallProp.MayPure,
			sig:                    sig({ f: ArgProp.Callee, x: ArgProp.Value, right: ArgProp.Flag, nomatch: ArgProp.Value })
		}
	),
	fn(base('replicate'), BuiltInProcName.Default,
		{ props: CallProp.MayPure, sig: sig({ n: Forced.Value, expr: ArgProp.Value, simplify: ArgProp.Flag }) }
	),
	fn(base('Reduce'), BuiltInProcName.Apply,
		{ indexOfFunction: 0, nameOfFunctionArgument: 'f', unquoteFunction: true, props: CallProp.MayPure, sig: sig({ f: ArgProp.Callee }) }
	),
	fn(base('rapply'), BuiltInProcName.Apply,
		{
			indexOfFunction:        1,
			nameOfFunctionArgument: 'f',
			unquoteFunction:        true,
			props:                  CallProp.MayPure,
			sig:                    sig({ object: ArgProp.NoDefault, f: ArgProp.NoDefault, classes: 0, deflt: 0, how: 0, '...': 0 })
		}
	),
	fn(base('print'), BuiltInProcName.Default,
		{
			keepArgumentOut:       true,
			hasUnknownSideEffects: { type: 'link-to-last-call', callName: /^sink$/ },
			ambient:               PrintDispatched,
			props:                 CallProp.Invisible | CallProp.Generic,
			tags:                  [SemanticCallTag.Prints],
			sig:                   sig({ x: ArgProp.Alias | ArgProp.Forced, '...': Forced.Value })
		}
	),
	fn([...base('message', 'warning'), ...pkg(PkgName.Rlang, 'warn'), ...pkg(PkgName.Msgr, 'info')], BuiltInProcName.Default,
		{
			keepArgumentOut:       true,
			hasUnknownSideEffects: { type: 'link-to-last-call', callName: /^sink$/ },
			props:                 CallProp.Invisible,
			tags:                  [SemanticCallTag.Prints],
			sig:                   sig({ '...': ArgProp.Alias | ArgProp.Forced })
		}
	),
	fn(base('invisible'), BuiltInProcName.Default,
		{ keepArgumentOut: true, props: CallProp.Pure | CallProp.Invisible, sig: sig({ x: ArgProp.Alias | ArgProp.Forced }) }, Primitive
	),
	fn(base('force', 'identity'), BuiltInProcName.Default,
		{ keepArgumentOut: true, props: CallProp.Pure, sig: sig({ x: ArgProp.Alias | ArgProp.Forced }) }
	),
	fn(base('I'), BuiltInProcName.Default, { keepArgumentOut: true, props: CallProp.Pure, sig: sig({ x: Forced.Value }) }),
	fn(base('suppressWarnings', 'suppressMessages', 'suppressPackageStartupMessages'), BuiltInProcName.Default,
		{ keepArgumentOut: true, sig: sig({ expr: ArgProp.Alias | ArgProp.Forced, classes: ArgProp.Value }) }
	),
	/* it changes into a directory that has to exist, so it reads the files as well */
	fn(base('setwd'), BuiltInProcName.Default,
		{
			ambient: { type: AmbientStateAccessType.SetWorkingDirectory },
			props:   CallProp.Invisible | CallProp.Ambient | CallProp.Configures,
			tags:    [SemanticCallTag.File, SemanticCallTag.Reads],
			sig:     sig({ dir: ArgProp.Value | Forced.Resource })
		}
	),
	/* `Sys.umask()` only reports the mask, a mode sets it and hands back the old one invisibly */
	fn(base('Sys.umask'), BuiltInProcName.Default,
		{
			ambient: { type: AmbientStateAccessType.SetState, state: AmbientStateName.umask, queryWithoutArguments: true },
			props:   CallProp.Invisible | CallProp.Configures,
			sig:     sig({ mode: Forced.Value })
		}
	),
	fn(base('set.seed'), BuiltInProcName.Default,
		{
			ambient: { type: AmbientStateAccessType.SetRng },
			props:   CallProp.Invisible | CallProp.Configures,
			tags:    [SemanticCallTag.Random],
			sig:     sig({ seed: Forced.Value, kind: Forced.Value, 'normal.kind': Forced.Value, 'sample.kind': Forced.Value })
		}
	),
	fn(base('RNGversion'), BuiltInProcName.Default,
		{
			ambient: { type: AmbientStateAccessType.SetRng, kindFrom: 0 },
			props:   CallProp.Invisible | CallProp.Configures,
			tags:    [SemanticCallTag.Random],
			sig:     sig({ vstr: Forced.Value })
		}
	),
	fn(base('RNGkind'), BuiltInProcName.Default,
		{
			ambient: { type: AmbientStateAccessType.SetRng, kindFrom: 0 },
			props:   CallProp.Configures,
			tags:    [SemanticCallTag.Random],
			sig:     sig({ kind: Forced.Value, 'normal.kind': Forced.Value, 'sample.kind': Forced.Value })
		}
	),
	fn(base('body', 'formals'), BuiltInProcName.Default,
		{ hasUnknownSideEffects: true, props: CallProp.Lang, sig: sig({ fun: Forced.Value }) }, Primitive
	),
	fn(base('.libPaths'), BuiltInProcName.Default,
		{
			props:   CallProp.Configures,
			ambient: { type: AmbientStateAccessType.SetState, state: AmbientStateName.libPaths, queryWithoutArguments: true },
			sig:     sig({ new: Forced.Value, 'include.site': Forced.Flag })
		}
	),
	fn(base('addTaskCallback'), BuiltInProcName.Default,
		{
			hasUnknownSideEffects: true,
			props:                 CallProp.Configures,
			sig:                   sig({ f: ArgProp.Forced | ArgProp.Callee, data: Forced.Value, name: Forced.Value })
		}
	),
	fn(base('setHook'), BuiltInProcName.Default,
		{
			hasUnknownSideEffects: true,
			props:                 CallProp.Configures,
			sig:                   sig({ hookName: Forced.Value, value: ArgProp.Forced | ArgProp.Callee, action: Forced.Flag })
		}
	),
	fn(base('trace'), BuiltInProcName.Default,
		{
			hasUnknownSideEffects: true,
			tags:                  [SemanticCallTag.Eval],
			sig:                   sig({
				what:      ArgProp.Value,
				tracer:    ArgProp.Value | ArgProp.Injectable,
				exit:      ArgProp.Value | ArgProp.Injectable,
				at:        ArgProp.Value,
				print:     ArgProp.Flag,
				signature: ArgProp.Value,
				where:     ArgProp.Value,
				edit:      ArgProp.Flag
			})
		}
	),
	/* `environment()` without an argument is the frame the call sits in, which is how `as.list(environment())` gets at every argument */
	fn(base('environment'), BuiltInProcName.Default,
		{ hasUnknownSideEffects: true, readsFrame: true, frame: ArgProp.Value, tags: [SemanticCallTag.Frames], sig: sig({ fun: Forced.Handle }) },
		Primitive
	),
	fn(base('.Call', '.External', '.C', '.Fortran', '.External2', '.Call.graphics', '.External.graphics'), BuiltInProcName.Default,
		{
			hasUnknownSideEffects: true,
			sig:                   sig({ '.NAME': Forced.Value }),
			markArgsAsMasked:      NseArguments.First,
			treatAsFnCall:         {
				'.Call':              ['.NAME'],
				'.External':          ['.NAME'],
				'.C':                 ['.NAME'],
				'.Fortran':           ['.NAME'],
				/* the entry points R's graphics engine and internal code call foreign routines through */
				'.External2':         ['.NAME'],
				'.Call.graphics':     ['.NAME'],
				'.External.graphics': ['.NAME']
			},
			props: CallProp.Ffi
		},
		Primitive
	),
	fn(base('eval'), BuiltInProcName.Eval,
		{
			includeFunctionCall: true,
			supportFunctionCall: false,
			keepEnvironment:     true,
			tags:                [SemanticCallTag.Eval],
			sig:                 sig({ expr: Forced.Value | ArgProp.Injectable, envir: Forced.Value, enclos: Forced.Value })
		},
		Primitive
	),
	fn(base('cat'), BuiltInProcName.Default,
		{
			hasUnknownSideEffects: { type: 'link-to-last-call', callName: /^sink$/ },
			ambient:               ReadPrintingOptions,
			props:                 CallProp.Invisible,
			tags:                  [SemanticCallTag.File, SemanticCallTag.Writes, SemanticCallTag.Prints],
			sig:                   sig({ '...': Forced.Value, file: Forced.Resource | ArgProp.Optional })
		}
	),
	fn(base('switch'), BuiltInProcName.Default,
		{ alternativeArgsFrom: 1, useAsProcessor: BuiltInProcName.Switch, props: CallProp.Pure, sig: sig({ EXPR: Forced.Value }) }
	),
	fn([
		...base('stop'),
		...pkg(PkgName.Rlang, 'abort'), ...pkg(PkgName.Cli, 'cli_abort'),
		...pkg(PkgName.RmethodsS3, 'throw'), ...pkg(PkgName.Roo, 'throw'), /* R.oo re-exports R.methodsS3::throw */
		...pkg(PkgName.Purrr, 'stop_bad_type', 'stop_bad_element_type', 'stop_bad_element_length')
	], BuiltInProcName.Default,
	{ useAsProcessor: BuiltInProcName.Stop, cfg: ExitPointType.Error, props: CallProp.Throws, sig: sig({ '...': ArgProp.Forced }) }
	),
	/* the block is evaluated whatever happens, the handlers only when something does, and an error keeps the value from coming back */
	fn(base('try'), BuiltInProcName.Try, { block: 'expr', handlers: {}, sig: sig({ expr: Forced.Value }) }, Primitive),
	fn([...base('tryCatch'), ...pkg(PkgName.TryCatchLog, 'tryCatchLog')], BuiltInProcName.Try,
		{
			block:    'expr',
			handlers: { error: 'error', finally: 'finally' },
			sig:      sig({ expr: Forced.Value, '...': ArgProp.Callee, finally: ArgProp.Nse })
		},
		Primitive
	),
	fn(base('withCallingHandlers'), BuiltInProcName.Try,
		{ block: 'expr', aborts: false, handlers: {}, sig: sig({ expr: Forced.Value, '...': ArgProp.Callee }) }, Primitive
	),
	fn(base('invokeRestart'), BuiltInProcName.Default, { sig: sig({ r: Forced.Value, '...': Forced.Value }) }, Primitive),
	fn([...base('stopifnot'), ...pkg(PkgName.AssertThat, 'assert_that')], BuiltInProcName.StopIfNot,
		{ props: CallProp.Invisible | CallProp.Throws, sig: sig({ '...': 0, exprs: ArgProp.NoDefault, exprObject: ArgProp.NoDefault, local: 0 }) }
	),
	/* it hands back what it evaluated invisibly, so a top-level `source()` prints nothing of its own */
	fn(base('source'), BuiltInProcName.Source,
		{
			includeFunctionCall: true,
			forceFollow:         false,
			props:               CallProp.Invisible,
			tags:                [SemanticCallTag.File, SemanticCallTag.Reads, SemanticCallTag.Eval],
			sig:                 sig({
				file:         Forced.Resource | ArgProp.Injectable,
				local:        Forced.Flag,
				echo:         Forced.Flag,
				'print.eval': ArgProp.Flag,
				exprs:        ArgProp.Value | ArgProp.Injectable
			})
		}
	),
	fn(base('sys.source'), BuiltInProcName.Source,
		{
			includeFunctionCall: true,
			envIn:               'envir',
			props:               CallProp.Invisible,
			tags:                [SemanticCallTag.File, SemanticCallTag.Reads, SemanticCallTag.Eval],
			sig:                 sig({ file: Forced.Resource | ArgProp.Injectable, envir: ArgProp.Forced | ArgProp.Written })
		}
	),
	fn([...base('ifelse'), ...pkg(PkgName.DataTable, 'fifelse'), ...pkg(PkgName.Functools, 'IfElse')], BuiltInProcName.IfThenElse,
		{
			args:  { cond: 'test', yes: 'yes', no: 'no' },
			props: CallProp.Pure,
			sig:   sig({ test: ArgProp.NoDefault, yes: ArgProp.NoDefault, no: ArgProp.NoDefault })
		},
		Primitive
	),
	fn(base('get'), BuiltInProcName.Get,
		{
			props: CallProp.Pure,
			tags:  [SemanticCallTag.Eval],
			sig:   sig({ x: Forced.Value | ArgProp.Injectable, pos: ArgProp.Flag, envir: Forced.Value, mode: Forced.Flag, inherits: Forced.Flag })
		},
		{ evalHandler: BuiltInEvalName.Get }
	),
	fn(base('get0'), BuiltInProcName.Get,
		{
			props: CallProp.Pure,
			tags:  [SemanticCallTag.Eval],
			sig:   sig({
				x:          Forced.Value | ArgProp.Injectable,
				envir:      Forced.Value,
				mode:       Forced.Flag,
				inherits:   Forced.Flag,
				ifnotfound: Forced.Value
			})
		},
		{ evalHandler: BuiltInEvalName.Get }
	),
	fn(base('ls', 'objects'), BuiltInProcName.EnvContents,
		{
			props: CallProp.NonDet,
			sig:   sig({
				name:        Forced.Value,
				pos:         ArgProp.Flag,
				envir:       Forced.Value,
				'all.names': ArgProp.Flag,
				pattern:     ArgProp.Value,
				sorted:      ArgProp.Flag
			})
		}
	),
	fn(base('list2env'), BuiltInProcName.ListToEnv, { props: CallProp.Scope, sig: sig({ x: Forced.Value, envir: ArgProp.Written }) }),
	fn(base('mget'), BuiltInProcName.Get,
		{
			props: CallProp.Pure,
			tags:  [SemanticCallTag.Eval],
			sig:   sig({
				x:          Forced.Value | ArgProp.Injectable,
				envir:      Forced.Value,
				mode:       Forced.Flag,
				ifnotfound: Forced.Value,
				inherits:   Forced.Flag
			})
		}
	),
	fn(base('exists'), BuiltInProcName.Get,
		{
			returnsValue: false,
			props:        CallProp.Pure,
			tags:         [SemanticCallTag.Eval],
			sig:          sig({
				x:        Forced.Value | ArgProp.Injectable,
				where:    ArgProp.Flag,
				envir:    Forced.Value,
				frame:    ArgProp.Flag,
				mode:     Forced.Flag,
				inherits: Forced.Flag
			})
		}
	),
	fn(base('match.fun'), BuiltInProcName.Get,
		{
			props: CallProp.Pure,
			tags:  [SemanticCallTag.Eval],
			sig:   sig({ FUN: Forced.Value | ArgProp.Injectable | ArgProp.Alias, descend: ArgProp.Flag })
		},
		{ evalHandler: BuiltInEvalName.Get }
	),
	/* what a call does to a package is stated by its tags: loading the namespace, attaching it, answering whether it is there */
	fn(base('library'), BuiltInProcName.Library,
		{
			ambient: LibrarySearchPath,
			props:   CallProp.Invisible | CallProp.Scope,
			tags:    [SemanticCallTag.LoadsPackage, SemanticCallTag.AttachesPackage],
			sig:     sig({ package: ArgProp.NoDefault, '...': 0 })
		}
	),
	/* `require` attaches like `library`, but answers FALSE instead of failing when the package is missing */
	fn(base('require'), BuiltInProcName.Library,
		{
			ambient: LibrarySearchPath,
			props:   CallProp.Invisible | CallProp.Scope,
			tags:    [SemanticCallTag.LoadsPackage, SemanticCallTag.AttachesPackage, SemanticCallTag.ChecksPackage],
			sig:     sig({ package: ArgProp.NoDefault, '...': 0 })
		}
	),
	fn(base('attachNamespace'), BuiltInProcName.Library,
		{
			ambient:       SetsEntryNamedBy(KeyedState.SearchPath, ['ns', 'pos', 'depends', 'exclude', 'include.only'], 'ns'),
			characterOnly: true,
			props:         CallProp.Invisible | CallProp.Scope,
			tags:          [SemanticCallTag.LoadsPackage, SemanticCallTag.AttachesPackage],
			sig:           sig({ ns: ArgProp.NoDefault, pos: 0, depends: 0, exclude: ArgProp.NoDefault, 'include.only': ArgProp.NoDefault })
		}
	),
	fn(base('requireNamespace'), BuiltInProcName.Library,
		{
			namespaceOnly: true,
			characterOnly: true,
			props:         CallProp.Invisible | CallProp.Scope,
			tags:          [SemanticCallTag.LoadsPackage, SemanticCallTag.ChecksPackage],
			sig:           sig({ package: ArgProp.NoDefault, '...': 0 })
		}
	),
	/* other than `requireNamespace`, it hands back the namespace visibly */
	fn(base('loadNamespace'), BuiltInProcName.Library,
		{
			namespaceOnly: true,
			characterOnly: true,
			props:         CallProp.Scope,
			tags:          [SemanticCallTag.LoadsPackage],
			sig:           sig({ package: ArgProp.NoDefault, '...': 0 })
		}
	),
	/* they only look whether a package is installed, nothing is loaded */
	fn([...base('find.package'), ...utils('installed.packages', 'packageVersion', 'packageDescription')], BuiltInProcName.Default,
		{ props: CallProp.Ambient, tags: [SemanticCallTag.ChecksPackage], sig: sig({ '...': ArgProp.Forced }) }
	),
	fn(base('assign'), BuiltInProcName.Assignment,
		{
			targetVariable:  true,
			mayHaveMoreArgs: true,
			environmentArg:  'envir',
			props:           CallProp.Scope | CallProp.Invisible,
			sig:             sig({ x: ArgProp.Value, value: ArgProp.Value, pos: ArgProp.Flag, envir: ArgProp.Written, inherits: ArgProp.Flag })
		},
		Primitive
	),
	fn(base('makeActiveBinding'), BuiltInProcName.Assignment,
		{
			targetVariable:  true,
			mayHaveMoreArgs: true,
			callsSource:     true,
			environmentArg:  'env',
			props:           CallProp.Scope | CallProp.Invisible,
			sig:             sig({ sym: ArgProp.Value, fun: ArgProp.Callee, env: ArgProp.Written })
		},
		Primitive
	),
	fn(base('delayedAssign'), BuiltInProcName.Assignment,
		{
			keepEnvironment: true,
			quoteSource:     true,
			targetVariable:  true,
			mayHaveMoreArgs: true,
			environmentArg:  'assign.env',
			props:           CallProp.Invisible | CallProp.Scope,
			sig:             sig({
				x:            ArgProp.NoDefault,
				value:        ArgProp.NoDefault | ArgProp.Nse,
				'eval.env':   Forced.Value,
				'assign.env': ArgProp.Forced | ArgProp.Written
			})
		},
		Primitive
	),
	fn(base('quote'), BuiltInProcName.Quote,
		{ quoteArgumentsWithIndex: 0, keepEnvironment: true, props: CallProp.Lang, sig: sig({ expr: ArgProp.Nse }) }, Primitive
	),
	/* `bquote` evaluates the operand of `.()` */
	fn(base('bquote'), BuiltInProcName.Quote,
		{ quoteArgumentsWithIndex: 0, unquote: Unquote.Bquote, keepEnvironment: true, props: CallProp.Lang, sig: sig({ expr: ArgProp.Nse }) },
		Primitive
	),
	fn(base('substitute'), BuiltInProcName.Quote,
		{
			quoteArgumentsWithIndex: 0,
			envArgIndex:             1,
			keepEnvironment:         true,
			props:                   CallProp.Lang,
			sig:                     sig({ expr: ArgProp.Nse, env: ArgProp.Value })
		},
		Primitive
	),
	/* `local(expr)` evaluates `expr` in a frame of its own and hands its value back */
	fn(base('local'), BuiltInProcName.Local,
		{ args: { env: 'envir', expr: 'expr' }, sig: sig({ expr: ArgProp.Alias | ArgProp.Forced, envir: ArgProp.Written }) }
	),
	fn(base('with'), BuiltInProcName.With, { sig: WithSig }),
	fn(base('within'), BuiltInProcName.With, { tags: [SemanticCallTag.Transforms], sig: WithSig }),
	fn([...base('new.env'), ...pkg(PkgName.Rlang, 'new_environment')], BuiltInProcName.NewEnv,
		{ sig: sig({ hash: 0, parent: 0, size: 0 }) }, Primitive
	),
	/* env-returning builtins pointing into the current search-path stack (`e <- globalenv(); e$x`) */
	fn(Object.entries(StackEnvBuiltins)
		.filter(([n, kind]) => !n.startsWith('.') && (kind === StackEnvKind.Global || kind === StackEnvKind.Base || kind === StackEnvKind.Empty))
		.map(
			([n]) => Identifier.from([n, PkgName.Base])
		), BuiltInProcName.StackEnv, {}, Primitive),
	fn(base('parent.env', 'environmentName', 'as.environment', 'pos.to.env'), BuiltInProcName.Default, {}, Primitive),
	fn(base('parent.frame', 'topenv'), BuiltInProcName.Default, { tags: [SemanticCallTag.Frames] }, Primitive),
	/* `sys.frame(sys.nframe())` is the own frame written the long way round, and its values are there to be read */
	fn(base('sys.frame', 'sys.frames'), BuiltInProcName.Default, { frame: ArgProp.Value, tags: [SemanticCallTag.Frames] }, Primitive),
	fn(base('load'), BuiltInProcName.Load,
		{ props: CallProp.Invisible | CallProp.Scope, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: sig({ file: ArgProp.Resource }) }
	),
	fn(base('attach'), BuiltInProcName.Attach,
		{
			ambient: AttachSearchPath,
			props:   CallProp.Invisible | CallProp.Scope,
			sig:     sig({ what: ArgProp.NoDefault, pos: 0, name: 0, 'warn.conflicts': 0 })
		}
	),
	fn(base('unloadNamespace'), BuiltInProcName.Detach,
		{
			ambient: SetsEntryNamedBy(KeyedState.SearchPath, ['ns'], 'ns'),
			props:   CallProp.Invisible | CallProp.Configures,
			tags:    [SemanticCallTag.DetachesPackage],
			sig:     sig({ ns: 0 })
		}
	),
	fn(base('detach'), BuiltInProcName.Detach,
		{
			ambient: DetachSearchPath,
			props:   CallProp.Invisible | CallProp.Configures,
			tags:    [SemanticCallTag.DetachesPackage],
			sig:     sig({ name: 0, pos: 0, unload: ArgProp.Flag, 'character.only': ArgProp.Flag, force: ArgProp.Flag })
		}
	),
	fn(base('do.call'), BuiltInProcName.Apply,
		{
			indexOfFunction: 0,
			unquoteFunction: true,
			isTheCall:       true,
			props:           CallProp.MayPure,
			tags:            [SemanticCallTag.Eval],
			sig:             sig({ what: ArgProp.Forced | ArgProp.Callee | ArgProp.Injectable, args: Forced.Value })
		},
		Primitive
	),
	fn(base('UseMethod'), BuiltInProcName.S3Dispatch,
		{
			args:  { generic: 'generic', object: 'object' },
			props: CallProp.Generic,
			sig:   sig({ generic: ArgProp.NoDefault, object: ArgProp.NoDefault })
		},
		Primitive
	),
	fn(base('NextMethod'), BuiltInProcName.S3Dispatch,
		{
			args:             { generic: 'generic', object: 'object' },
			inferFromClosure: true,
			props:            CallProp.Generic,
			sig:              sig({ generic: 0, object: 0, '...': 0 })
		},
		Primitive
	),
	fn(base('Negate'), BuiltInProcName.S7MakeConstructor, { wrapIndex: 0, props: CallProp.Pure, sig: sig({ f: ArgProp.Callee }) }, Primitive),
	fn(base('Vectorize'), BuiltInProcName.S7MakeConstructor, { wrapIndex: 0, props: CallProp.Pure, sig: sig({ FUN: ArgProp.Callee }) }, Primitive),
	fn(base('.Primitive', '.Internal'), BuiltInProcName.Apply,
		{ indexOfFunction: 0, unquoteFunction: true, resolveInEnvironment: 'global' }, Primitive
	),
	fn(base('list'), BuiltInProcName.List, { props: CallProp.Pure, sig: sig({ '...': ArgProp.Value }) }, Primitive),
	fn(base('Recall'), BuiltInProcName.Recall, { libFn: true, sig: sig({ '...': 0 }) }),
	fn(base('sys.function'), BuiltInProcName.Recall,
		{ libFn: true, unknownOnNonZeroArg: true, props: CallProp.Lang, frame: ArgProp.Nse, tags: [SemanticCallTag.Frames], sig: sig({ which: 0 }) }
	),
	fn(base('c'), BuiltInProcName.Vector,
		{ props: CallProp.Pure, sig: sig({ '...': ArgProp.Value }) }, { assumePrimitive: true, evalHandler: BuiltInEvalName.Vector }
	),
	fn(base('sys.on.exit', 'asNamespace', 'unname'), BuiltInProcName.Default, { hasUnknownSideEffects: true }),
	/* they create, move, or delete files */
	fn([...base('dir.create'), ...pkg(PkgName.Fs, 'dir_create')], BuiltInProcName.DefaultReadAllArgs,
		{ props: CallProp.Invisible, tags: [SemanticCallTag.File, SemanticCallTag.Writes], sig: sig({ path: Forced.Resource, '...': ArgProp.Flag }) }
	),
	fn(base('unlink'), BuiltInProcName.DefaultReadAllArgs,
		{
			props: CallProp.Invisible,
			tags:  [SemanticCallTag.File, SemanticCallTag.Writes],
			sig:   sig({ x: Forced.Resource, recursive: ArgProp.Flag, force: ArgProp.Flag, expand: ArgProp.Flag })
		}
	),
	fn(base('Sys.chmod'), BuiltInProcName.DefaultReadAllArgs,
		{
			props: CallProp.Invisible,
			tags:  [SemanticCallTag.File, SemanticCallTag.Writes],
			sig:   sig({ paths: Forced.Resource, mode: ArgProp.Flag, use_umask: ArgProp.Flag })
		}
	),
	fn([...base('file.create'), ...pkg(PkgName.Fs, 'file_create', 'file_touch')], BuiltInProcName.DefaultReadAllArgs,
		{ tags: [SemanticCallTag.File, SemanticCallTag.Writes], sig: sig({ '...': Forced.Resource, showWarnings: ArgProp.Flag }) }
	),
	fn([...base('file.remove', 'Sys.junction'), ...pkg(PkgName.Fs, 'file_delete', 'dir_delete', 'link_delete')], BuiltInProcName.Default,
		{ hasUnknownSideEffects: true, tags: [SemanticCallTag.File, SemanticCallTag.Writes] }
	),
	fn(base('file.copy', 'file.link', 'file.symlink'), BuiltInProcName.Default,
		{
			tags: CopiesFiles,
			sig:  sig({
				from:        Forced.Resource,
				to:          Forced.Resource | ArgProp.Written,
				overwrite:   ArgProp.Flag,
				recursive:   ArgProp.Flag,
				'copy.mode': ArgProp.Flag,
				'copy.date': ArgProp.Flag
			})
		}
	),
	/* a moved file is gone from where it was */
	fn(base('file.rename'), BuiltInProcName.Default,
		{ hasUnknownSideEffects: true, tags: CopiesFiles, sig: sig({ from: Forced.Resource, to: Forced.Resource | ArgProp.Written }) }
	),
	fn(base('file.append'), BuiltInProcName.Default,
		{ tags: CopiesFiles, sig: sig({ file1: Forced.Resource | ArgProp.Written, file2: Forced.Resource }) }
	),
	/* `sink` diverts the output, `par`/`tpar` set (or query) the parameters of the current device */
	fn(base('sink'), BuiltInProcName.Default,
		{
			ambient: { type: AmbientStateAccessType.SetState, state: AmbientStateName.sink },
			props:   CallProp.Invisible,
			tags:    [SemanticCallTag.File, SemanticCallTag.Writes],
			sig:     sig({ file: ArgProp.Resource })
		}
	),
	fn(base('on.exit'), BuiltInProcName.RegisterHook,
		{
			props: CallProp.Invisible,
			hook:  KnownHooks.OnFnExit,
			args:  { expr: { idx: 0, name: 'expr' }, add: { idx: 1, name: 'add', default: false }, after: { idx: 2, name: 'after', default: true } },
			sig:   sig({ expr: ArgProp.Nse, add: 0, after: 0 })
		},
		Primitive
	),
	/* `parse(text=)` turns text into an expression, with `file=` it reads that file */
	fn(base('parse', 'str2lang', 'str2expression'), BuiltInProcName.Default, { props: CallProp.Pure, sig: sig({ '...': ArgProp.Forced }) }),
	/* they answer with whatever is on disk when they run */
	fn([...base('list.files', 'dir', 'list.dirs'), ...pkg(PkgName.Fs, 'dir_ls')], BuiltInProcName.Default,
		{ tags: [SemanticCallTag.File, SemanticCallTag.Reads, SemanticCallTag.Glob], sig: sig({ path: Forced.Resource }) }
	),
	fn(base('Sys.glob'), BuiltInProcName.Default,
		{ tags: [SemanticCallTag.File, SemanticCallTag.Reads, SemanticCallTag.Glob], sig: sig({ paths: Forced.Resource }) }
	),
	/* language objects */
	fn(base('enquote', 'call', 'as.call', 'as.expression', 'as.name', 'as.symbol', 'args', 'deparse', 'deparse1'), BuiltInProcName.Default,
		{ props: CallProp.Lang, sig: sig({ '...': ArgProp.Forced }) }
	),
	/* they hand back the call they sit in, so the function around them reads its arguments as written, unevaluated */
	fn(base('match.call', 'sys.call', 'sys.calls'), BuiltInProcName.Default,
		{ props: CallProp.Lang | CallProp.NonDet, frame: ArgProp.Nse, sig: sig({ '...': ArgProp.Forced }) }
	),
	/* `nargs()` counts what the call supplied, so it sees no argument, only whether there was one */
	fn(base('nargs', 'sys.nframe'), BuiltInProcName.Default,
		{ props: CallProp.Lang | CallProp.NonDet, frame: ArgProp.Presence, sig: sig({ '...': ArgProp.Forced }) }
	),
	/* `alist` keeps its arguments unevaluated, `evalq` evaluates its first one in another frame */
	fn(base('alist'), BuiltInProcName.Default, { props: CallProp.Lang, sig: sig({ '...': ArgProp.Nse }) }),
	fn(base('evalq'), BuiltInProcName.Default,
		{
			ambient: { type: AmbientStateAccessType.EvaluateQuoted },
			props:   CallProp.Lang,
			tags:    [SemanticCallTag.Eval],
			sig:     sig({ expr: ArgProp.Nse | ArgProp.Injectable, envir: Forced.Value })
		}
	),
	fn(base('eval.parent'), BuiltInProcName.Eval,
		{
			includeFunctionCall: true,
			supportFunctionCall: false,
			keepEnvironment:     false,
			parameterNames:      ['expr', 'n'],
			parentFrame:         true,
			props:               CallProp.Lang,
			tags:                [SemanticCallTag.Eval],
			sig:                 sig({ expr: Forced.Value | ArgProp.Injectable, n: Forced.Value })
		}
	),
	/* native code */
	fn(base('dyn.load'), BuiltInProcName.Default, { props: CallProp.Ffi | CallProp.Invisible, sig: sig({ '...': ArgProp.Forced }) }),
	fn(base('getNativeSymbolInfo'), BuiltInProcName.Default, { props: CallProp.Ffi, sig: sig({ '...': ArgProp.Forced }) }),
	/* ambient state: options, environment variables, the clock, the session itself */
	fn(base('Sys.getenv'), BuiltInProcName.Default,
		{
			props:   CallProp.Ambient,
			ambient: { type: AmbientStateAccessType.ReadKeyed, state: KeyedState.Env, keys: { from: 'parameter', signature: ['x', 'unset', 'names', 'allowEmpty'], names: ['x'] } },
			sig:     sig({ '...': ArgProp.Forced })
		}
	),
	fn(base('Sys.info', 'Sys.getpid', 'getRversion', 'R.Version', 'Sys.time', 'Sys.Date', 'Sys.timezone', 'date', 'proc.time', 'interactive'), BuiltInProcName.Default,
		{ props: CallProp.Ambient, sig: sig({ '...': ArgProp.Forced }) }
	),
	fn(base('getwd'), BuiltInProcName.Default,
		{ ambient: { type: AmbientStateAccessType.GetWorkingDirectory }, props: CallProp.Ambient, sig: sig({ '...': ArgProp.Forced }) }
	),
	fn([...base('search', 'searchpaths'), ...utils('find', 'apropos')], BuiltInProcName.Default,
		{
			ambient: { type: AmbientStateAccessType.ReadState, state: AmbientStateName.allOf(KeyedState.SearchPath) },
			props:   CallProp.Ambient,
			sig:     sig({ '...': ArgProp.Forced })
		}
	),
	fn(base('getOption'), BuiltInProcName.Default,
		{ ambient: { type: AmbientStateAccessType.GetOption }, props: CallProp.Ambient, sig: sig({ '...': ArgProp.Forced }) }
	),
	fn(base('commandArgs'), BuiltInProcName.Default,
		{ props: CallProp.Ambient, tags: [SemanticCallTag.CommandLine], sig: sig({ '...': ArgProp.Forced }) }
	),
	/* system commands */
	fn(base('system'), BuiltInProcName.Default,
		{
			tags: [SemanticCallTag.Process],
			sig:  sig({
				command:                  Forced.Value | ArgProp.Injectable,
				intern:                   Forced.Flag,
				'ignore.stdout':          Forced.Flag,
				'ignore.stderr':          Forced.Flag,
				wait:                     Forced.Flag,
				input:                    Forced.Value,
				'show.output.on.console': ArgProp.Flag,
				minimized:                ArgProp.Flag,
				invisible:                ArgProp.Flag,
				timeout:                  Forced.Value
			})
		}
	),
	fn(base('system2'), BuiltInProcName.Default,
		{
			tags: [SemanticCallTag.Process],
			sig:  sig({
				command:   Forced.Value | ArgProp.Injectable,
				args:      Forced.Value | ArgProp.Injectable,
				stdout:    Forced.Value,
				stderr:    Forced.Value,
				stdin:     ArgProp.Value,
				input:     Forced.Value,
				env:       Forced.Value | ArgProp.Injectable,
				wait:      Forced.Flag,
				minimized: ArgProp.Flag,
				invisible: ArgProp.Flag,
				timeout:   Forced.Value
			})
		}
	),
	fn(base('shell'), BuiltInProcName.Default,
		{
			tags: [SemanticCallTag.Process],
			sig:  sig({
				cmd:       Forced.Value | ArgProp.Injectable,
				shell:     Forced.Value,
				flag:      Forced.Value,
				intern:    Forced.Flag,
				wait:      Forced.Flag,
				translate: Forced.Flag,
				mustWork:  ArgProp.Flag,
				'...':     Forced.Value
			})
		}
	),
	fn(base('shell.exec'), BuiltInProcName.Default,
		{ props: CallProp.Invisible, tags: [SemanticCallTag.Process], sig: sig({ file: Forced.Resource | ArgProp.Injectable }) }
	),
	fn(base('pipe'), BuiltInProcName.Default,
		{
			tags: [SemanticCallTag.Opens, SemanticCallTag.Process],
			sig:  sig({ description: Forced.Resource | ArgProp.Injectable, open: Forced.Flag, encoding: Forced.Value })
		}
	),
	/* whatever the user types, picks, or sends along with a request */
	fn([
		...base('readline', 'file.choose'),
		...utils('askYesNo', 'choose.files', 'choose.dir', 'menu', 'select.list', 'winDialogString', 'winDialog')
	], BuiltInProcName.Default, { tags: [SemanticCallTag.User], sig: sig({ '...': ArgProp.Forced }) }),
	/* they only make up a path, they do not go near the file system, so `File` would be wrong here */
	fn(base('tempfile', 'tempdir'), BuiltInProcName.Default, { tags: [SemanticCallTag.TempFile], sig: sig({ '...': ArgProp.Forced }) }),
	/* they are all mapped to `<-` but we separate super assignments */
	replacement(['[', '[[', ...base('names', 'dimnames', 'attributes', 'attr', 'class', 'levels', 'rownames', 'colnames', 'environment', 'length', 'dim')], ['<-', '<<-'],
		{ readIndices: true, props: CallProp.Scope }
	),
	replacement(base('body', 'formals'), ['<-', '<<-'],
		{ readIndices: true, props: CallProp.Scope | CallProp.Lang, sig: sig({ fun: ArgProp.Value, value: ArgProp.Value | ArgProp.Injectable }) }
	),
	/* the string and shape functions R declares formals for, restated one by one: the group above gives them
	   what they do, this gives them the arguments they do it with (the names are R's own) */
	fn(base('sprintf'), BuiltInProcName.DefaultReadAllArgs,
		{ props: CallProp.Pure, sig: sig({ fmt: Forced.Value, '...': Forced.Value }) },
		{ assumePrimitive: true, evalHandler: BuiltInEvalName.StringFn }
	),
	fn(base('format'), BuiltInProcName.DefaultReadAllArgs,
		{ ambient: PrintDispatched, props: CallProp.Pure, sig: SigXDots }, { overrides: true, assumePrimitive: true }
	),
	fn(base('grep'), BuiltInProcName.DefaultReadAllArgs,
		{
			props: CallProp.Pure,
			sig:   sig({
				pattern:       Forced.Value,
				x:             Forced.Value,
				'ignore.case': Forced.Flag,
				perl:          Forced.Flag,
				value:         Forced.Flag,
				fixed:         Forced.Flag,
				useBytes:      Forced.Flag,
				invert:        Forced.Flag
			})
		},
		{ overrides: true, assumePrimitive: true }
	),
	fn(base('sub', 'gsub'), BuiltInProcName.DefaultReadAllArgs,
		{
			props: CallProp.Pure,
			tags:  [SemanticCallTag.Edits],
			sig:   sig({
				pattern:       Forced.Value,
				replacement:   Forced.Value,
				x:             Forced.Value,
				'ignore.case': Forced.Flag,
				perl:          Forced.Flag,
				fixed:         Forced.Flag,
				useBytes:      Forced.Flag
			})
		},
		{ overrides: true, assumePrimitive: true }
	),
	fn(base('substr'), BuiltInProcName.DefaultReadAllArgs,
		{ props: CallProp.Pure, tags: [SemanticCallTag.Edits], sig: sig({ x: Forced.Value, start: Forced.Value, stop: Forced.Value }) },
		{ overrides: true, assumePrimitive: true }
	),
	fn(base('substring'), BuiltInProcName.DefaultReadAllArgs,
		{ props: CallProp.Pure, tags: [SemanticCallTag.Edits], sig: sig({ text: Forced.Value, first: Forced.Value, last: Forced.Value }) },
		{ overrides: true, assumePrimitive: true }
	),
	fn(base('strsplit'), BuiltInProcName.DefaultReadAllArgs,
		{
			props: CallProp.Pure,
			tags:  [SemanticCallTag.Edits],
			sig:   sig({ x: Forced.Value, split: Forced.Value, fixed: Forced.Flag, perl: Forced.Flag, useBytes: Forced.Flag })
		},
		{ overrides: true, assumePrimitive: true }
	),
	fn(base('trimws'), BuiltInProcName.DefaultReadAllArgs,
		{ props: CallProp.Pure, tags: [SemanticCallTag.Edits], sig: sig({ x: Forced.Value, which: Forced.Flag, whitespace: Forced.Value }) },
		{ overrides: true, assumePrimitive: true, evalHandler: BuiltInEvalName.StringFn }
	),
	fn(base('chartr', 'regmatches'), BuiltInProcName.DefaultReadAllArgs,
		{ props: CallProp.Pure, tags: [SemanticCallTag.Edits] }, { overrides: true, assumePrimitive: true }
	),
	fn(base('strtoi'), BuiltInProcName.DefaultReadAllArgs,
		{ props: CallProp.Pure, sig: sig({ x: Forced.Value, base: Forced.Value }) }, { overrides: true, assumePrimitive: true }
	),
	fn(base('matrix'), BuiltInProcName.DefaultReadAllArgs,
		{ props: CallProp.Pure, sig: sig({ data: Forced.Value, nrow: Forced.Value, ncol: Forced.Value, byrow: Forced.Flag, dimnames: Forced.Value }) },
		{ overrides: true, assumePrimitive: true }
	),
	fn(base('subset', 'transform'), BuiltInProcName.Default,
		{
			markArgsAsMasked: NseArguments.AllButFirst,
			props:            CallProp.Pure,
			tags:             [SemanticCallTag.Transforms],
			sig:              sig({ x: ArgProp.Value, '...': ArgProp.Value })
		},
		Overrides
	),

	/* these share the `f(x, ...)` shape above, but R puts one more formal before the `...`: leaving it out
	   would shift every position after it, so each names its own */
	fn(base('sort'), BuiltInProcName.DefaultReadAllArgs,
		{ props: CallProp.Pure, tags: [SemanticCallTag.Transforms], sig: sig({ x: Forced.Value, decreasing: Forced.Flag, '...': Forced.Value }) },
		{ overrides: true, assumePrimitive: true }
	),
	fn(base('unique'), BuiltInProcName.DefaultReadAllArgs,
		{ props: CallProp.Pure, tags: [SemanticCallTag.Transforms], sig: SigUnique }, { overrides: true, assumePrimitive: true }
	),
	fn(base('duplicated'), BuiltInProcName.DefaultReadAllArgs, { props: CallProp.Pure, sig: SigUnique }, { overrides: true, assumePrimitive: true }),
	fn(base('as.data.frame'), BuiltInProcName.DefaultReadAllArgs,
		{ props: CallProp.Pure, sig: sig({ x: Forced.Value, 'row.names': Forced.Value, optional: Forced.Flag, '...': Forced.Value }) },
		{ overrides: true, assumePrimitive: true }
	),
	/* the ones the earlier list left short where a reader would notice */
	fn(base('nchar'), BuiltInProcName.DefaultReadAllArgs,
		{
			props: CallProp.Pure,
			tags:  [SemanticCallTag.Narrows],
			sig:   sig({ x: ArgProp.Forced | ArgProp.Shape, type: Forced.Value, allowNA: Forced.Flag, keepNA: Forced.Flag })
		},
		{ overrides: true, assumePrimitive: true, evalHandler: BuiltInEvalName.StringFn }
	),
	fn(base('grepl'), BuiltInProcName.DefaultReadAllArgs,
		{
			props: CallProp.Pure,
			tags:  [SemanticCallTag.Narrows],
			sig:   sig({
				pattern:       Forced.Value,
				x:             Forced.Value,
				'ignore.case': Forced.Flag,
				perl:          Forced.Flag,
				fixed:         Forced.Flag,
				useBytes:      Forced.Flag
			})
		},
		{ overrides: true, assumePrimitive: true }
	),
	fn(base('match'), BuiltInProcName.DefaultReadAllArgs,
		{
			props: CallProp.Pure,
			tags:  [SemanticCallTag.Narrows],
			sig:   sig({ x: Forced.Value, table: Forced.Value, nomatch: Forced.Value, incomparables: Forced.Value })
		},
		{ overrides: true, assumePrimitive: true }
	),
	fn(base('lengths'), BuiltInProcName.DefaultReadAllArgs,
		{ props: CallProp.Pure, tags: [SemanticCallTag.Narrows], sig: sig({ x: ArgProp.Forced | ArgProp.Shape, 'use.names': Forced.Flag }) },
		{ overrides: true, assumePrimitive: true }
	),
	fn(base('readLines'), BuiltInProcName.DefaultReadAllArgs,
		{
			tags: [SemanticCallTag.File, SemanticCallTag.Reads],
			sig:  sig({
				con:      Forced.Resource | ArgProp.Optional,
				n:        Forced.Value,
				ok:       Forced.Flag,
				warn:     Forced.Flag,
				encoding: Forced.Value,
				skipNul:  Forced.Flag
			})
		},
		Overrides
	),
	fn(base('writeLines'), BuiltInProcName.DefaultReadAllArgs,
		{
			props: CallProp.Invisible,
			tags:  [SemanticCallTag.File, SemanticCallTag.Writes, SemanticCallTag.Prints],
			sig:   sig({ text: Forced.Value, con: Forced.Resource | ArgProp.Optional, sep: Forced.Value, useBytes: Forced.Flag })
		},
		Overrides
	),
	/* deprecated and defunct functions of base R */
	fn(base(
		'plclust', 'La.eigen', 'tetragamma', 'pentagamma', 'package.description', 'gammaCody', 'manglePackageName', '.readRDS', '.saveRDS',
		'mem.limits', 'trySilent', 'traceOn', 'traceOff', 'print.coefmat', 'anovalist.lm', 'lm.fit.null', 'lm.wfit.null', 'glm.fit.null', 'tkcmd',
		'tkfile.tail', 'tkfile.dir', 'tkopen', 'tkclose', 'tkputs', 'tkread', 'Rd_parse', 'CRAN.packages', 'zip.file.extract', 'real', 'as.real',
		'is.real', '.find.package', '.path.package'
	), BuiltInProcName.DefaultReadAllArgs, Deprecated),
] as const satisfies AnyBuiltInDefinition[];
