import { button, el } from '../page-lib/dom';
import type { Entry } from './database';
import { ExportFlag } from './export-flags';
import { aboutOf, Flags, Kinds } from './about';

/** what a filter chip tests, the part before the colon in its `kind:key` id */
export enum FilterKind {
	/** selects what is listed rather than which names qualify */
	Only = 'only',
	Package = 'pkg',
	Flag = 'flag',
	Name = 'name',
	Kind = 'kind',
	Prop = 'prop',
	Arg = 'arg',
	Contract = 'contract',
	/** what a call does to the global state, `any` or by part, as the built-in configuration declares it */
	Ambient = 'ambient'
}

/** the boxes the chips are grouped in */
enum FilterGroup {
	Traits = 'traits',
	Prop = 'prop',
	Arg = 'arg',
	Ambient = 'ambient'
}

/** how the pressed chips combine */
export enum Mix {
	All = 'all',
	Any = 'any',
	None = 'none'
}

export interface Filter {
	readonly kind:  FilterKind;
	readonly key:   string;
	readonly label: string;
	readonly about: string;
}

/** what a role or property means, as {@link aboutOf} has it, and an example of it */
function withExample(word: string, example: string): string {
	return (aboutOf(word) ?? word) + (example === '' ? '' : ', ' + example);
}

const Filters: readonly Filter[] = [
	{ kind: FilterKind.Only, key: 'package', label: 'packages', about: 'list packages rather than the names they export' },
	{ kind: FilterKind.Package, key: 'archive', label: 'archived', about: 'names from a package CRAN no longer carries' },
	{ kind: FilterKind.Flag, key: ExportFlag.CanThrow, label: 'throw', about: Flags[ExportFlag.CanThrow].about ?? '' },
	{ kind: FilterKind.Flag, key: ExportFlag.NonDeterministic, label: 'non-det.', about: Flags[ExportFlag.NonDeterministic].about ?? '' },
	{ kind: FilterKind.Flag, key: ExportFlag.S3Method, label: 'S3', about: Flags[ExportFlag.S3Method].about ?? '' },
	{ kind: FilterKind.Flag, key: ExportFlag.Deprecated, label: 'depr.', about: Flags[ExportFlag.Deprecated].about ?? '' },
	{ kind: FilterKind.Flag, key: ExportFlag.CallsDeprecated, label: 'calls depr.', about: Flags[ExportFlag.CallsDeprecated].about ?? '' },
	{ kind: FilterKind.Flag, key: ExportFlag.Value, label: 'value', about: Flags[ExportFlag.Value].about ?? '' },
	{ kind: FilterKind.Flag, key: ExportFlag.NoLocation, label: 'no loc', about: Flags[ExportFlag.NoLocation].about ?? '' },
	{ kind: FilterKind.Contract, key: 'any', label: 'contract', about: 'flowR knows what a call has to fulfill to return normally, inferred from its R code or stated for a function written in C, as its marker says' },
	{ kind: FilterKind.Name, key: 'group', label: 'S4', about: 'S4 group member: a member of an S4 group generic (Math, Arith, Summary, ...), which a package usually exports because it answered the group for one of its classes' },
	{ kind: FilterKind.Kind, key: 'read', label: 'read', about: Kinds['read'].about },
	{ kind: FilterKind.Kind, key: 'write', label: 'write', about: Kinds['write'].about },
	{ kind: FilterKind.Kind, key: 'visualize', label: 'plot', about: Kinds['visualize'].about },
	{ kind: FilterKind.Kind, key: 'library', label: 'load', about: Kinds['library'].about },
	{ kind: FilterKind.Prop, key: 'pure', label: 'pure', about: withExample('pure', '') },
	{ kind: FilterKind.Prop, key: 'maybe pure', label: 'maybe pure', about: withExample('maybe pure', '') },
	{ kind: FilterKind.Prop, key: 'invisible', label: 'invisible', about: withExample('invisible', 'like invisible(x)') },
	{ kind: FilterKind.Prop, key: 'changes scope', label: 'changes scope', about: withExample('changes scope', 'like assign') },
	{ kind: FilterKind.Arg, key: 'alias', label: 'alias arg', about: withExample('alias', 'like x in identity(x)') },
	{ kind: FilterKind.Arg, key: 'forced', label: 'forced arg', about: withExample('forced', 'like x in force(x)') },
	{ kind: FilterKind.Arg, key: 'value', label: 'value arg', about: withExample('value', 'like x in sum(x)') },
	{ kind: FilterKind.Arg, key: 'written', label: 'written arg', about: withExample('written', 'like envir in assign') },
	{ kind: FilterKind.Arg, key: 'callee', label: 'callee arg', about: withExample('callee', 'like FUN in lapply') },
	{ kind: FilterKind.Arg, key: 'presence', label: 'presence arg', about: withExample('presence', 'like in missing()') }
];
const Groups: Readonly<Record<FilterGroup, readonly [title: string, about: string]>> = {
	[FilterGroup.Traits]:  ['traits', 'what the name is: a method, deprecated, a reader, a writer, ...'],
	[FilterGroup.Prop]:    ['function', 'what the call as a whole does or returns'],
	[FilterGroup.Arg]:     ['arguments', 'what the call does with its arguments'],
	[FilterGroup.Ambient]: ['ambient state', 'what the call does to the global state, like the graphics device, the options, or the random number generator']
};

const groupOf = (kind: FilterKind): FilterGroup => kind === FilterKind.Prop ? FilterGroup.Prop : kind === FilterKind.Arg ? FilterGroup.Arg : kind === FilterKind.Ambient ? FilterGroup.Ambient : FilterGroup.Traits;

/** a chip for any access to the global state, and one per part of it `families` names, `[key, label, description]` each */
export function ambientFilters(families: readonly (readonly [key: string, label: string, description: string])[]): Filter[] {
	return [
		{ kind: FilterKind.Ambient, key: 'any', label: 'any', about: 'reads or changes state outside its arguments, like options, the working directory, or the graphics device' },
		...families.map(([key, label, description]) => ({ kind: FilterKind.Ambient, key, label, about: 'accesses the ' + label + ': ' + description }))
	];
}
const idOf = (kind: FilterKind, key: string): string => kind + ':' + key;

/** the kind and key of a chip `id` */
export function filterOf(id: string): readonly [kind: FilterKind, key: string] {
	const [kind, key] = id.split(':');
	return [kind as FilterKind, key];
}

/** the filter chips, `what:key` each, in boxes that open on a click, and how the pressed ones combine */
export class FilterBar {
	readonly active = new Set<string>();
	how = Mix.All;
	private readonly chips = new Map<string, HTMLButtonElement>();
	private readonly boxes: ReadonlyMap<FilterGroup, HTMLElement>;

	constructor(parent: HTMLElement, private readonly picks: readonly HTMLButtonElement[], changed: () => void, extra: readonly Filter[] = []) {
		this.boxes = new Map((Object.entries(Groups) as [FilterGroup, readonly [string, string]][]).map(([group, [title, about]]) => {
			const box = el('span', 'group');
			box.append(button('groupbtn', title, about, () => FilterBar.setOpen(box, box.dataset.open !== 'true')));
			parent.append(box);
			return [group, box] as const;
		}));
		for(const { kind, key, label, about } of [...Filters, ...extra]) {
			const id = idOf(kind, key);
			const chip = button(undefined, label, about + '. Click to filter by it, click again to drop it', () => {
				this.press(id, !this.active.has(id));
				changed();
			});
			chip.setAttribute('aria-pressed', 'false');
			chip.hidden = true;
			this.chips.set(id, chip);
			this.boxes.get(groupOf(kind))?.append(chip);
		}
		for(const pick of picks) {
			pick.addEventListener('click', () => {
				this.setHow(pick.dataset.mix as Mix | undefined ?? Mix.All);
				changed();
			});
		}
	}

	private static setOpen(box: HTMLElement, open: boolean): void {
		box.dataset.open = String(open);
		box.firstElementChild?.setAttribute('aria-expanded', String(open));
		for(const chip of [...box.children].slice(1)) {
			(chip as HTMLElement).hidden = !open;
		}
	}

	press(id: string, on: boolean): void {
		void (on ? this.active.add(id) : this.active.delete(id));
		this.chips.get(id)?.setAttribute('aria-pressed', String(on));
	}

	clear(): void {
		for(const id of this.active) {
			this.press(id, false);
		}
	}

	setHow(mix: Mix): void {
		this.how = mix;
		this.picks.forEach(pick => pick.setAttribute('aria-pressed', String(pick.dataset.mix === mix)));
	}

	/** presses the chips `ids` names and opens their boxes, as an address asks */
	restore(ids: readonly string[], how: string | null): void {
		for(const id of ids.filter(id => this.chips.has(id))) {
			this.press(id, true);
			const box = this.boxes.get(groupOf(filterOf(id)[0]));
			if(box) {
				FilterBar.setOpen(box, true);
			}
		}
		if(this.picks.some(pick => pick.dataset.mix === how)) {
			this.setHow(how as Mix);
		}
	}

	has(kind: FilterKind, key: string): boolean {
		return this.active.has(idOf(kind, key));
	}

	passes(entry: Entry): boolean {
		if(this.active.size === 0) {
			return true;
		}
		const matched = [...this.active].filter(id => entry.holds(id)).length;
		return this.how === Mix.Any ? matched > 0 : this.how === Mix.None ? matched === 0 : matched === this.active.size;
	}

	/** disables the chips that would leave nothing of `entries` */
	offer(entries: readonly Entry[]): void {
		for(const [id, chip] of this.chips) {
			chip.disabled = !this.active.has(id) && !(filterOf(id)[0] === FilterKind.Only || this.how === Mix.None || entries.some(entry => entry.holds(id)));
		}
	}
}
