import { ArgProp, FnSig, SemanticCallTag, type BuiltInFnInfo } from './built-in-props';
import { KeyedState } from './ambient-state-name';
import type { BrandedIdentifier } from './identifier';
import { uniqueArrayMerge } from '../../util/collections/arrays';
import type { AmbientKeys } from '../internal/process/functions/call/built-in/built-in-ambient-keys';

/** The parts of the global state other than the {@link KeyedState|keyed} ones a built-in may access, see {@link AmbientEffect}. */
export enum AmbientPart {
	/** the graphics devices, one of which is active */
	Device = 'device',
	/** the plot on the active device */
	Plot = 'plot',
	/** the color palette all devices share */
	Palette = 'palette',
	/** the ggplot `last_plot()` returns, which every ggplot that is built or added to becomes */
	LastPlot = 'last-plot',
	/** the diversions of the console output, the last of which is active */
	Sink = 'sink',
	/** the diversion of messages and warnings */
	MessageSink = 'message-sink',
	/** the state of the random number generator */
	Rng = 'rng',
	/** the kind of the random number generator */
	RngKind = 'rng-kind',
	WorkingDirectory = 'wd',
	/** the directories on disk, which every path to a file leads through */
	Directories = 'directories',
	/** the files on disk, which the arguments of the {@link AmbientEffect#sig|signature} name */
	Files = 'files',
	/** the root `here::here()` builds paths from */
	ProjectRoot = 'project-root',
	LibPaths = 'lib-paths',
	Umask = 'umask',
	/** the finalizers registered, which `gc()` runs */
	Finalizers = 'finalizers',
	/** the variable a text connection opened for writing binds */
	TextConnection = 'text-connection',
	/** the message of the last error, which `geterrmessage()` returns */
	ErrorMessage = 'error-message'
}

/** A part of the global state, see {@link AmbientEffect}. */
export type AmbientFamilyName = AmbientPart | KeyedState;

/** What a built-in does to a part of the global state, see {@link AmbientEffect}. */
export enum AmbientVerb {
	Reads = 'reads',
	/** replaces it */
	Writes = 'writes',
	/** changes it on top of what it was, so it reads it as well: drawing on the plot, drawing a random number */
	Adds = 'adds',
	/** starts it afresh: a new plot */
	Resets = 'resets',
	/** removes the named entries */
	Kills = 'kills',
	/** opens an instance, which becomes the active one */
	Opens = 'opens',
	/** closes the active instance, the one named, or every one */
	Closes = 'closes',
	/** makes another instance the active one */
	Switches = 'switches',
	/** builds an object that does the drawing once printed */
	Builds = 'builds'
}

/** What the arguments of a call decide an {@link AmbientEffect} on, which with unknown arguments may hold or not. */
export type AmbientCondition =
	/** the call has no arguments */
	| 'no-arguments'
	/** every argument is an unnamed string or `no.readonly`, which only queries entries: `par("mar")` */
	| 'query'
	/** the argument of this name is the literal `TRUE`, like `curve(f, add = TRUE)` */
	| { readonly flag: string }
	/** the argument for the formal `arg` (matched against the `formals`) is one of the strings `is`, `null` standing for a missing or `NULL` argument */
	| { readonly arg: BrandedIdentifier, readonly formals: readonly BrandedIdentifier[], readonly is: readonly (string | null)[] }
	/** the argument for the formal `arg` is a call of one of the functions `calls`, or a variable bound to one, like `cat(x, file = stderr())` */
	| { readonly arg: BrandedIdentifier, readonly formals: readonly BrandedIdentifier[], readonly calls: readonly BrandedIdentifier[] }
	/** an argument other than one for the leading formals, by position or by another name, like a kind for `set.seed(1, "Wichmann-Hill")` */
	| { readonly besides: readonly BrandedIdentifier[] };

/**
 * What a built-in does to the global state, one entry per part and verb: "`points` adds to the plot" or "`dev.off` closes the active device".
 * Everything a part is linked to follows from that, as the plot belongs to the active device, which a drawing opens on the fly.
 */
export interface AmbientEffect {
	readonly family:      AmbientFamilyName
	readonly access:      AmbientVerb
	/** the entries of a keyed family the call names, every one if absent, or for an instance family each instance instead of the active one */
	readonly member?:     AmbientKeys | 'every'
	/** the effect happens only if this holds */
	readonly when?:       AmbientCondition
	/** the effect happens only unless this holds */
	readonly unless?:     AmbientCondition
	/** for the files, the signature whose {@link ArgProp.Resource} arguments name them, absent if they do not name them exactly (like a glob) */
	readonly sig?:        FnSig
	/** for the files, a device numbers those of its pages with a `%d` in the name (`plot%03d.png`) */
	readonly numbered?:   boolean
	/** the call hands back the value of the one entry it reads (`getOption("digits")`), which value resolution takes from the calls that set it */
	readonly handsBack?:  true
	/** for the options, the argument `print(x)` dispatches on: a package method may read any option unless the value is plain */
	readonly dispatchOn?: number
}

/** The {@link AmbientEffect}s a configuration states, one or many. */
export type AmbientEffects = AmbientEffect | readonly AmbientEffect[];

/** Shorthands for the {@link AmbientEffect}s, one per part, so a configuration reads `Ambient.plot.adds`. */
function effectsOf(family: AmbientFamilyName) {
	return Object.fromEntries(Object.values(AmbientVerb).map(access => [access, { family, access }])) as { readonly [Verb in AmbientVerb]: { readonly family: typeof family, readonly access: Verb } };
}

/**
 * The {@link AmbientEffect}s by part and verb, see {@link AmbientEffect}.
 * @helper dataflow
 */
export const Ambient = {
	device:         effectsOf(AmbientPart.Device),
	plot:           effectsOf(AmbientPart.Plot),
	par:            effectsOf(KeyedState.Par),
	palette:        effectsOf(AmbientPart.Palette),
	lastPlot:       effectsOf(AmbientPart.LastPlot),
	sink:           effectsOf(AmbientPart.Sink),
	messageSink:    effectsOf(AmbientPart.MessageSink),
	option:         effectsOf(KeyedState.Option),
	env:            effectsOf(KeyedState.Env),
	locale:         effectsOf(KeyedState.Locale),
	searchPath:     effectsOf(KeyedState.SearchPath),
	rng:            effectsOf(AmbientPart.Rng),
	rngKind:        effectsOf(AmbientPart.RngKind),
	wd:             effectsOf(AmbientPart.WorkingDirectory),
	directories:    effectsOf(AmbientPart.Directories),
	files:          effectsOf(AmbientPart.Files),
	projectRoot:    effectsOf(AmbientPart.ProjectRoot),
	libPaths:       effectsOf(AmbientPart.LibPaths),
	umask:          effectsOf(AmbientPart.Umask),
	finalizers:     effectsOf(AmbientPart.Finalizers),
	textConnection: effectsOf(AmbientPart.TextConnection),
	errorMessage:   effectsOf(AmbientPart.ErrorMessage),
	/** The effects of `effects` in a flat list. */
	list(this: void, effects: AmbientEffects | undefined): readonly AmbientEffect[] {
		return effects === undefined ? [] : 'family' in effects ? [effects] : effects;
	}
} as const;

/** A call that reads or writes the files its arguments name accesses the {@link AmbientPart.Files|files on disk} as well. */
function withFileAccess(config: BuiltInFnInfo): BuiltInFnInfo {
	const { tags, ambient, sig } = config;
	if(!tags?.includes(SemanticCallTag.File)) {
		return config;
	}
	const writes = tags.includes(SemanticCallTag.Writes);
	const split = writes && tags.includes(SemanticCallTag.Reads) && sig !== undefined && FnSig.resources(sig, true) !== sig;
	/* reading first, so the files read are the ones written before, not the call's own */
	const verbs = [...split || !writes && tags.includes(SemanticCallTag.Reads) ? [AmbientVerb.Reads] : [], ...writes ? [AmbientVerb.Writes] : []];
	const stated = Ambient.list(ambient);
	const isDevice = (verb: AmbientVerb) => stated.some(a => a.family === AmbientPart.Device && a.access === verb);
	if(verbs.length === 0 || stated.some(a => a.family === AmbientPart.Files && verbs.includes(a.access)) || isDevice(AmbientVerb.Closes)) {
		return config;
	}
	const glob = tags.includes(SemanticCallTag.Glob);
	/* appending to a file (`cat(x, file = f, append = TRUE)`) keeps what was written to it before */
	const appends = writes && !verbs.includes(AmbientVerb.Reads) && sig?.some(([name]) => name === 'append') ? [AmbientVerb.Reads] : [];
	return { ...config, ambient: [...stated, ...appends.map(access => ({ family: AmbientPart.Files, access, when: { flag: 'append' }, sig: glob ? undefined : sig })), ...verbs.map(access => ({
		family:   AmbientPart.Files, access, numbered: isDevice(AmbientVerb.Opens),
		sig:      glob || sig === undefined ? undefined : split ? FnSig.resources(sig, access === AmbientVerb.Writes) : sig
	}))] };
}

/** A call starting a process hands it every environment variable, a call loading a package looks for it in the library paths, a call printing adds to the diverted output. */
function withImplicitAccess(config: BuiltInFnInfo): BuiltInFnInfo {
	const { tags, ambient } = config;
	/* what always goes to the message sink, like `message`, does not print to the output sink */
	const printsToMessages = Ambient.list(ambient).some(e => e.family === Ambient.messageSink.adds.family && e.when === undefined && e.unless === undefined);
	const implied = [
		...tags?.includes(SemanticCallTag.Process) ? [Ambient.env.reads] : [],
		...tags?.includes(SemanticCallTag.LoadsPackage) ? [Ambient.libPaths.reads] : [],
		...tags?.includes(SemanticCallTag.Prints) && !printsToMessages ? [Ambient.sink.adds] : []
	];
	return implied.length === 0 ? config : { ...config, ambient: [...Ambient.list(ambient), ...implied] };
}

/** The configuration with the {@link AmbientEffect}s its tags imply added to the ones it states. */
export function withImpliedAmbient<Config extends BuiltInFnInfo | undefined>(config: Config): Config {
	return config === undefined ? config : withImplicitAccess(withFileAccess(config)) as Config;
}

/** Whether the configuration declares an {@link AmbientEffect} or a scoped change of the state, which makes the function one touching {@link CallProp.Ambient|ambient state} on a page. */
export function declaresAmbient(config: BuiltInFnInfo | undefined): boolean {
	return config !== undefined && (Ambient.list(config.ambient).length > 0 || config.scope !== undefined);
}

/** How a page, the wiki, and the code documentation speak of a part of the global state or of an access. */
export interface AmbientWords {
	/** a short name, `graphics device` */
	readonly label:       string
	/** one sentence on what it is */
	readonly description: string
}

/** The words for a part, see {@link AmbientWords}. */
export interface AmbientFamilyWords extends AmbientWords {
	/** the noun an access names it by, `plot` in "adds to plot" */
	readonly noun:   string
	/** the part it belongs to, under which a summary lists it: the plot is one of the graphics device */
	readonly of?:    AmbientFamilyName
	/** a verb this part reads better with, "draws from" for the random number generator */
	readonly verbs?: Readonly<Partial<Record<AmbientVerb, string>>>
}

/** The words for every part of the global state, the one source the wiki, the signature browser, and these docs share. */
export const AmbientFamilyInfo: Readonly<Record<AmbientFamilyName, AmbientFamilyWords>> = {
	[AmbientPart.Device]:           { label: 'graphics device', noun: 'device', description: 'The graphics devices R draws on, one of which is active: opening one makes it the active one, closing it returns to another, and closing a device writes its file.' },
	[AmbientPart.Plot]:             { label: 'plot', noun: 'plot', of: AmbientPart.Device, description: 'What is drawn on the active device: a new plot replaces it, an addon like points draws on top of it, and drawing opens a device if none is open.' },
	[KeyedState.Par]:               { label: 'graphics parameters', noun: 'graphics parameters', of: AmbientPart.Device, description: 'The parameters par sets for the active device, each by its name, which every later base graphics plot on that device picks up.' },
	[AmbientPart.Palette]:          { label: 'palette', noun: 'palette', description: 'The color palette all devices share, which a numeric color indexes into.' },
	[AmbientPart.LastPlot]:         { label: 'last ggplot', noun: 'last ggplot', description: 'The ggplot last built or added to, which last_plot() returns and ggsave saves by default.' },
	[AmbientPart.Sink]:             { label: 'output sink', noun: 'sink', verbs: { [AmbientVerb.Adds]: 'prints to the active' }, description: 'Where the console output goes: sink(file) diverts it on top of a stack, sink() ends the last diversion, which finishes what it wrote.' },
	[AmbientPart.MessageSink]:      { label: 'message sink', noun: 'message sink', verbs: { [AmbientVerb.Adds]: 'signals to the active' }, description: 'Where messages and warnings go: sink(con, type = "message") diverts them, sink(type = "message") returns them to the console.' },
	[KeyedState.Option]:            { label: 'options', noun: 'options', description: 'The options options() sets by name, like digits or scipen, which printing and many functions read.' },
	[KeyedState.Env]:               { label: 'environment variables', noun: 'environment variables', description: 'The environment variables of the R process by name, like TZ or LANG, which R and every child process read.' },
	[KeyedState.Locale]:            { label: 'locale', noun: 'locale', description: 'The locale categories like LC_COLLATE, which sorting, formatting, and messages follow.' },
	[KeyedState.SearchPath]:        { label: 'search path', noun: 'search path', description: 'The packages and environments attached, in which R looks up a name the code does not define.' },
	[AmbientPart.Rng]:              { label: 'random numbers', noun: 'random number generator', verbs: { [AmbientVerb.Adds]: 'draws from', [AmbientVerb.Writes]: 'seeds' }, description: 'The state of the random number generator, which set.seed sets and every draw advances.' },
	[AmbientPart.RngKind]:          { label: 'random number kind', noun: 'generator kind', of: AmbientPart.Rng, description: 'Which random number generator R uses, which RNGkind sets and set.seed keeps unless it is given one.' },
	[AmbientPart.WorkingDirectory]: { label: 'working directory', noun: 'working directory', description: 'The directory relative paths start from, which setwd changes.' },
	[AmbientPart.Directories]:      { label: 'directories', noun: 'directories', description: 'The directories on disk, which dir.create, unlink, and file.rename change and every path to a file leads through.' },
	[AmbientPart.Files]:            { label: 'files', noun: 'files', description: 'The files on disk, which a call reads or writes by the paths its arguments name.' },
	[AmbientPart.ProjectRoot]:      { label: 'project root', noun: 'project root', description: 'The root here::here() builds its paths from, which here::i_am names.' },
	[AmbientPart.LibPaths]:         { label: 'library paths', noun: 'library paths', description: 'Where packages are installed and loaded from, which .libPaths(new) changes.' },
	[AmbientPart.Umask]:            { label: 'file creation mask', noun: 'file creation mask', description: 'The permissions every new file lacks, which Sys.umask sets.' },
	[AmbientPart.Finalizers]:       { label: 'finalizers', noun: 'finalizers', description: 'The functions reg.finalizer registers to run once their object is released, which gc() may run.' },
	[AmbientPart.TextConnection]:   { label: 'text connection', noun: 'text connection', description: 'The variable a text connection opened for writing binds, which every write to the connection changes.' },
	[AmbientPart.ErrorMessage]:     { label: 'last error message', noun: 'last error message', description: 'The message of the last error, which an error sets and geterrmessage() returns, so code going on after try or tryCatch caught one may read it.' }
};

/** The words for every access verb, see {@link AmbientFamilyInfo}. */
export const AmbientVerbInfo: Readonly<Record<AmbientVerb, AmbientWords>> = {
	[AmbientVerb.Reads]:    { label: 'reads', description: 'The call depends on the state, so it links to the calls that set it before.' },
	[AmbientVerb.Writes]:   { label: 'writes', description: 'The call replaces the state, so later reads link to it instead of what came before.' },
	[AmbientVerb.Adds]:     { label: 'adds to', description: 'The call changes the state on top of what it was, so it reads it and later reads see both.' },
	[AmbientVerb.Resets]:   { label: 'starts a new', description: 'The call starts the state anew, so later reads no longer see what came before.' },
	[AmbientVerb.Kills]:    { label: 'removes', description: 'The call removes entries, so later reads of them see nothing set.' },
	[AmbientVerb.Opens]:    { label: 'opens', description: 'The call opens an instance that becomes the active one, the others keep their state until they are active again.' },
	[AmbientVerb.Closes]:   { label: 'closes', description: 'The call ends an instance, which links it to the call that opened it and to everything done with it in between.' },
	[AmbientVerb.Switches]: { label: 'switches', description: 'The call makes another open instance the active one.' },
	[AmbientVerb.Builds]:   { label: 'builds an object drawing', description: 'The call builds an object that only draws once it is printed, like a ggplot.' }
};

/** One access of a built-in to a part, as {@link ambientSummaryOf} lists it. */
export interface AmbientAccessSummary {
	readonly part:    AmbientFamilyName
	readonly access:  AmbientVerb
	/** the access as a page shows it, `adds to plot` */
	readonly label:   string
	/** the entries it is about where the configuration knows them (option keys, environment variable names), else how the arguments name them, empty for all of the part or the active instance */
	readonly members: readonly string[]
	/** when the access happens, all of them have to hold, empty if it always does */
	readonly when:    readonly string[]
}

/** The accesses of a built-in to one part of the global state and the parts belonging to it, see {@link ambientSummaryOf}. */
export interface AmbientFamilySummary {
	readonly family:   AmbientFamilyName
	readonly label:    string
	readonly accesses: readonly AmbientAccessSummary[]
}

function memberWords(effect: AmbientEffect): readonly string[] {
	const member = effect.member;
	if(member === undefined) {
		return effect.family === AmbientPart.Files && effect.sig !== undefined ? effect.sig.filter(([, p]) => (p & ArgProp.Resource) !== 0).map(([n]) => `named by ${n}`) : [];
	} else if(member === 'every') {
		return ['every open one'];
	}
	switch(member.from) {
		case 'constant':       return member.keys;
		case 'argument-names': return ['the names of the arguments'];
		case 'unnamed':        return ['the unnamed arguments'];
		case 'parameter':      return [`named by ${member.names.join(' or ')}${member.fallback === undefined ? '' : `, else ${member.fallback}`}`];
	}
}

function conditionWords(condition: AmbientCondition): string {
	if(condition === 'no-arguments') {
		return 'it has no arguments';
	} else if(condition === 'query') {
		return 'it only queries';
	} else if('flag' in condition) {
		return `${condition.flag} is TRUE`;
	} else if('calls' in condition) {
		return `${condition.arg} is a call of ${condition.calls.join(' or ')}`;
	} else if('arg' in condition) {
		return `${condition.arg} is ${condition.is.map(v => v === null ? 'missing' : `"${v}"`).join(' or ')}`;
	}
	return `it has arguments besides ${condition.besides.join(', ') || 'none'}`;
}

/**
 * The {@link AmbientEffect}s of a built-in, including those its tags imply, grouped by the part they access (a part of the active device under the device)
 * and by verb, with the entries each access names: `graphics device: opens device, reads plot, adds to plot`.
 */
export function ambientSummaryOf(config: BuiltInFnInfo | undefined): readonly AmbientFamilySummary[] {
	type Access = { -readonly [K in keyof AmbientAccessSummary]: AmbientAccessSummary[K] };
	const families = new Map<AmbientFamilyName, Map<string, Access>>();
	for(const effect of Ambient.list(withImpliedAmbient(config)?.ambient)) {
		const words = AmbientFamilyInfo[effect.family];
		const family = words.of ?? effect.family;
		const accesses = families.get(family) ?? new Map<string, Access>();
		families.set(family, accesses);
		const when = [...effect.when === undefined ? [] : [`if ${conditionWords(effect.when)}`], ...effect.unless === undefined ? [] : [`unless ${conditionWords(effect.unless)}`]];
		const key = `${effect.family} ${effect.access} ${when.join()}`;
		const known = accesses.get(key) ?? { part: effect.family, access: effect.access, label: `${words.verbs?.[effect.access] ?? AmbientVerbInfo[effect.access].label} ${words.noun}`, members: [], when };
		accesses.set(key, known);
		known.members = uniqueArrayMerge(known.members, memberWords(effect));
	}
	return [...families].map(([family, accesses]) => ({ family, label: AmbientFamilyInfo[family].label, accesses: [...accesses.values()] }));
}
