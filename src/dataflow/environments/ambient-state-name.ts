import type { Identifier } from './identifier';

/**
 * The states made of named entries: setting one entry replaces its pseudo variable `#<state>:<key>`, adds to the accumulating
 * `all` of the state, and an entry we cannot name adds to `#<state>:*` instead (`options(op)`, `Sys.setenv(...)`).
 */
export enum KeyedState {
	/** the options `options(digits = 3)` sets */
	Option = 'option',
	/** the environment variables `Sys.setenv(LANG = "C")` sets */
	Env = 'env',
	/** the locale categories `Sys.setlocale("LC_COLLATE", "C")` sets, and the language */
	Locale = 'locale',
	/** the graphics parameters `par(mfrow = c(1, 2))` sets, on top of the whole graphics state */
	Par = 'par',
	/** the entries of the search path (`library(dplyr)` adds `dplyr`, `detach(package:dplyr)` removes it) */
	SearchPath = 'search-path'
}

/** The pseudo variable all writes to a {@link KeyedState} add to. */
const AllOfKeyedState: Readonly<Record<KeyedState, string>> = {
	[KeyedState.Option]:     '#options',
	[KeyedState.Env]:        '#env',
	[KeyedState.Locale]:     '#locale',
	[KeyedState.Par]:        '#graphics',
	[KeyedState.SearchPath]: '#search-path'
};

/** What R puts before the name of an entry that is no part of its key: `search()` lists `package:dplyr` for the entry `dplyr`. */
const EntryPrefix: Readonly<Partial<Record<KeyedState, string>>> = {
	[KeyedState.SearchPath]: 'package:'
};

/** The key standing for any entry of a {@link KeyedState} we cannot name. */
export const UnknownKey = '*';

/**
 * Graphics parameters, options and other global state, tracked as global pseudo variables (`#...`) so readers link to the calls that set them.
 * Accumulating states only grow: `par(mar = ...)` keeps an earlier `par(mfrow = ...)`.
 * The pseudo variables a function may leave changed are what `Dataflow.sideEffects.ambientWrites` reports.
 */
export const AmbientStateName = {
	/** the graphics state (`par`, `layout`, ...) of the active device, which a new device starts afresh */
	graphics:             '#graphics',
	/** the graphics states of the other open devices, the active one returns to one of them once it closes */
	otherDevices:         '#graphics:other',
	/** the call that opened the active device, and those of the other open devices */
	device:               '#device',
	otherDevicesOpenedBy: '#device:other',
	/** within a function, the call of its body that opened the active device, which only that body knows */
	deviceOpenedHere:     '#device:here',
	/** the color palette, which, other than the graphics parameters, all devices share */
	palette:              '#palette',
	/** the files on disk, which every call writing a file adds to and every call reading a file we cannot name reads */
	files:                '#files',
	/** written by a call writing a file we cannot name, which every call reading a file reads */
	anyFile:              '#file:*',
	/** the working directory `setwd` changes, which every call accessing a file reads to resolve a relative path */
	workingDirectory:     '#wd',
	/** whether console output is diverted into a file or connection, as `sink(file)` does and `sink()` undoes */
	sink:                 '#sink',
	/** the file creation mask `Sys.umask` sets */
	umask:                '#umask',
	/** the state of the random number generator, which `set.seed` sets and every draw advances */
	rng:                  '#rng',
	/** the kind of generator, which `set.seed` keeps unless it is given one */
	rngKind:              '#rng:kind',
	/** the global variable R keeps that state in, so assigning it sets {@link AmbientStateName.rng} as well */
	rngVariable:          '.Random.seed',
	/** every option write, for readers that may read any option (`getOption(k)` with an unknown `k`, library functions) */
	allOptions:           '#options',
	/** written by an `options(...)` call whose keys we cannot name, like the common `options(op)` restore */
	unknownOption:        '#option:*',
	/** written along with the option `warn` when it may turn warnings into errors (`warn >= 2`) */
	warnsAsErrors:        '#warn-error',
	/** the finalizers registered (`reg.finalizer`) and the removals that may release their objects, which `gc()` may run */
	finalizers:           '#finalizers',
	/** marks `name` as bound to a text connection opened for writing, whose writes change it */
	textConnection(this: void, name: string): string {
		return `#text-connection:${name}`;
	},
	/** the file named `stem` (`data` for `out/data.csv`), so a read of a named file only sees writes that may hit it */
	file(this: void, stem: string): string {
		return `#file:${stem}`;
	},
	/** the pseudo variable holding the option `key`; setting the option replaces it */
	option(this: void, key: string): string {
		return AmbientStateName.keyed(KeyedState.Option, key);
	},
	/** the pseudo variable of the entry `key` of a state, like `#env:PATH`; setting the entry replaces it */
	keyed(this: void, state: KeyedState, key: string): string {
		const prefix = EntryPrefix[state];
		return `#${state}:${prefix !== undefined && key.startsWith(prefix) ? key.slice(prefix.length) : key}`;
	},
	/** the pseudo variable every write to the state adds to, like `#env` */
	allOf(this: void, state: KeyedState): string {
		return AllOfKeyedState[state];
	},
	/** the entry of a state a pseudo variable stands for (`#env:PATH` is `PATH` of `env`), `undefined` for any other */
	entryOf(this: void, name: string): { readonly state: KeyedState, readonly key: string } | undefined {
		for(const state of Object.values(KeyedState)) {
			if(name.startsWith(`#${state}:`)) {
				return { state, key: name.slice(state.length + 2) };
			}
		}
		return undefined;
	},
	/** whether `name` is one of these pseudo variables */
	is(this: void, name: Identifier | undefined): name is string {
		return typeof name === 'string' && name.startsWith('#');
	}
} as const;

/** The pseudo variables that only grow, because every write to their state adds to them. */
export const KeyedAccumulators: readonly string[] = Object.values(KeyedState).flatMap(state => [AmbientStateName.allOf(state), AmbientStateName.keyed(state, UnknownKey)]);
