import type { Identifier, BrandedIdentifier } from './identifier';

/** The states made of named entries: setting one entry replaces its pseudo variable `#<state>:<key>`, adds to the accumulating `all` of the state, and an entry we cannot name adds to `#<state>:*` instead (`options(op)`, `Sys.setenv(...)`). */
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
const AllOfKeyedState: Readonly<Record<KeyedState, AmbientStateName>> = {
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

/** The name of a global pseudo variable tracking a part of the global state, see the helper of the same name. */
export type AmbientStateName = `#${string}` & BrandedIdentifier;

/** Graphics parameters, options and other global state, tracked as global pseudo variables (`#...`) so readers link to the calls that set them. */
export const AmbientStateName = {
	/** the graphics state (`par`, `layout`, ...) of the active device, which a new device starts afresh */
	graphics:             '#graphics',
	/** the graphics states of the other open devices, the active one returns to one of them once it closes */
	otherDevices:         '#graphics:other',
	/** the calls that opened the active device, set it up, and drew on it (a plot or `par` opens a device if none is open), and those of the other open devices, which closing a device links to */
	device:               '#device',
	otherDevicesOpenedBy: '#device:other',
	/** the call that explicitly opened the active device (`png("a.png")`), and those of the other open devices, which names the file its close writes */
	deviceOpener:         '#device:opener',
	otherDeviceOpeners:   '#device:opener:other',
	/** within a function, the call of its body that opened the active device, which only that body knows */
	deviceOpenedHere:     '#device:here',
	/** the calls drawing the plot on the active device: a new plot (`plot`) replaces it, an addon (`points`) reads and adds to it */
	plot:                 '#plot',
	otherPlots:           '#plot:other',
	/** the plot ggplot2's `last_plot()` returns, which building a ggplot (`ggplot`, `+`) replaces and `ggsave` reads; it belongs to no device */
	lastPlot:             '#last-plot',
	/** what is drawn on the active device, which every plot adds to; only written if `semantics.ambient.drawingWritesDevice` is set */
	canvas:               '#canvas',
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
	/** the project root `here::here()` builds its paths from, found from the working directory unless `here::i_am` names it */
	projectRoot:          '#project-root',
	/** where packages are installed and loaded from, which `.libPaths(new)` changes and every package load reads */
	libPaths:             '#lib-paths',
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
	textConnection(this: void, name: BrandedIdentifier): AmbientStateName {
		return `#text-connection:${name}` as const;
	},
	/** the file named `stem` (`data` for `out/data.csv`), so a read of a named file only sees writes that may hit it */
	file(this: void, stem: string): AmbientStateName {
		return `#file:${stem}` as const;
	},
	/** the pseudo variable holding the option `key`; setting the option replaces it */
	option(this: void, key: BrandedIdentifier): AmbientStateName {
		return AmbientStateName.keyed(KeyedState.Option, key);
	},
	/** the pseudo variable of the entry `key` of a state, like `#env:PATH`; setting the entry replaces it */
	keyed(this: void, state: KeyedState, key: BrandedIdentifier): AmbientStateName {
		const prefix = EntryPrefix[state];
		return `#${state}:${prefix !== undefined && key.startsWith(prefix) ? key.slice(prefix.length) : key}` as const;
	},
	/** the pseudo variable every write to the state adds to, like `#env` */
	allOf(this: void, state: KeyedState): AmbientStateName {
		return AllOfKeyedState[state];
	},
	/** whether `name` is one of these pseudo variables */
	is(this: void, name: Identifier | undefined): name is AmbientStateName {
		return typeof name === 'string' && name.startsWith('#');
	}
} as const;

/**
 * A state of which several instances exist at once, one of them active, like the graphics devices:
 * opening an instance makes it the active one, switching makes another one active, closing it returns to another.
 */
export interface AmbientFamily {
	/** each state an instance has of its own, with the pseudo variable holding it for the other open instances */
	readonly states:     readonly (readonly [active: AmbientStateName, others: AmbientStateName])[]
	/** the state of {@link AmbientFamily#states} holding the calls that opened the active instance and used it */
	readonly used:       AmbientStateName
	/** the state of {@link AmbientFamily#states} only an explicit opening writes, which tells it apart from a use that opened the instance on the fly */
	readonly opened:     AmbientStateName
	/** the state of {@link AmbientFamily#states} a switch to another instance reads */
	readonly switched:   AmbientStateName
	/** within a function, the call of its body that opened the active instance */
	readonly openedHere: AmbientStateName
}

/** The graphics devices, each with its graphics parameters, the calls opening and using it, its current plot, and its explicit opening. */
export const GraphicsDevices: AmbientFamily = {
	states: [
		[AmbientStateName.graphics, AmbientStateName.otherDevices],
		[AmbientStateName.device, AmbientStateName.otherDevicesOpenedBy],
		[AmbientStateName.plot, AmbientStateName.otherPlots],
		[AmbientStateName.deviceOpener, AmbientStateName.otherDeviceOpeners]
	],
	used:       AmbientStateName.device,
	opened:     AmbientStateName.deviceOpener,
	switched:   AmbientStateName.graphics,
	openedHere: AmbientStateName.deviceOpenedHere
};

/** The pseudo variables that only grow, because every write to their state adds to them. */
export const KeyedAccumulators: readonly AmbientStateName[] = Object.values(KeyedState).flatMap(state => [AmbientStateName.allOf(state), AmbientStateName.keyed(state, UnknownKey)]);
