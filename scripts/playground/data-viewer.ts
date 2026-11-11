import { button, el } from '../page-lib/dom';
import { arraySum } from '../../src/util/collections/arrays';

/** a table as the playground's `View()` hands it over */
export interface Viewed {
	readonly title:   string
	/** the rows of the whole table, of which {@link cells} may only hold the first */
	readonly rows:    number
	readonly names:   readonly string[]
	readonly classes: readonly string[]
	readonly cells:   readonly (readonly string[])[]
}

const Numeric = new Set(['numeric', 'integer', 'double', 'difftime']);
/** what R prints for a missing value */
const NA = 'NA';

/** keeps the rows whose cell is one of `values`, or within `[min, max]` for a number */
type Filter = { readonly kind: 'values', readonly values: ReadonlySet<string> } | { readonly kind: 'range', readonly min?: number, readonly max?: number, readonly na: boolean };

/** what a viewer shows, shared by the inline table and its popped out copy so either picks up where the other is */
interface ViewState {
	query:          string
	order:          { column: number, down: boolean } | undefined
	filters:        Map<number, Filter>
	/** the column whose summary is open */
	focus:          number | undefined
	/** the viewers showing this state, redrawn on every change */
	readonly shown: Set<() => void>
}

const isNumeric = (view: Viewed, column: number) => Numeric.has(view.classes[column]);

function keeps(filter: Filter, cell: string): boolean {
	if(filter.kind === 'values') {
		return filter.values.has(cell);
	} else if(cell === NA) {
		return filter.na;
	}
	const x = Number(cell);
	return (filter.min === undefined || x >= filter.min) && (filter.max === undefined || x <= filter.max);
}

/** the rows the state lets through, in the order it asks for */
function visibleRows(view: Viewed, state: ViewState): (readonly string[])[] {
	const query = state.query.trim().toLowerCase();
	const rows = view.cells.filter(row => [...state.filters].every(([column, filter]) => keeps(filter, row[column] ?? NA))
		&& (query === '' || row.some(cell => cell.toLowerCase().includes(query))));
	if(state.order !== undefined) {
		const { column, down } = state.order;
		const numeric = isNumeric(view, column);
		rows.sort((a, b) => {
			const x = a[column] ?? '', y = b[column] ?? '';
			/* NA goes last either way, as in RStudio */
			if(x === NA || y === NA) {
				return x === y ? 0 : x === NA ? 1 : -1;
			}
			const by = numeric ? Number(x) - Number(y) : x.localeCompare(y, undefined, { numeric: true });
			return down ? -by : by;
		});
	}
	return rows;
}

function quantile(sorted: readonly number[], p: number): number {
	const at = (sorted.length - 1) * p;
	const lo = Math.floor(at), hi = Math.ceil(at);
	return sorted[lo] + (sorted[hi] - sorted[lo]) * (at - lo);
}

const fmt = (x: number) => Number.isInteger(x) ? String(x) : x.toPrecision(4).replace(/\.?0+$/, '');

/** the values of the column among `rows`, with how often each occurs, most frequent first, NA last */
function counts(rows: readonly (readonly string[])[], column: number): [string, number][] {
	const found = new Map<string, number>();
	for(const row of rows) {
		const cell = row[column] ?? NA;
		found.set(cell, (found.get(cell) ?? 0) + 1);
	}
	return [...found].sort(([a, x], [b, y]) => a === NA ? 1 : b === NA ? -1 : y - x || a.localeCompare(b, undefined, { numeric: true }));
}

/** the summary of a column over the rows the other filters let through, with the controls to filter it */
function columnPanel(view: Viewed, state: ViewState, column: number, change: () => void): HTMLElement {
	const panel = el('div', 'dv-panel');
	const others: ViewState = { ...state, filters: new Map([...state.filters].filter(([c]) => c !== column)), query: '' };
	const rows = visibleRows(view, others);
	const filter = state.filters.get(column);
	const close = button('dv-x', '×', 'close the summary', () => {
		state.focus = undefined;
		change();
	});
	panel.append(el('div', 'dv-panel-head', `${view.names[column] || 'row names'}`), close);
	const nas = rows.filter(row => (row[column] ?? NA) === NA).length;
	if(isNumeric(view, column)) {
		const values = rows.map(row => row[column]).filter(cell => cell !== undefined && cell !== NA).map(Number).filter(x => !Number.isNaN(x)).sort((a, b) => a - b);
		const facts: [string, string][] = values.length === 0 ? [['values', 'none']] : [
			['min', fmt(values[0])], ['1st qu.', fmt(quantile(values, .25))], ['median', fmt(quantile(values, .5))],
			['mean', fmt(arraySum(values) / values.length)], ['3rd qu.', fmt(quantile(values, .75))], ['max', fmt(values[values.length - 1])],
			['NA', String(nas)]
		];
		const list = el('dl', 'dv-facts');
		for(const [name, value] of facts) {
			list.append(el('dt', undefined, name), el('dd', undefined, value));
		}
		panel.append(list);
		if(values.length > 1) {
			panel.append(histogram(values));
		}
		const range = filter?.kind === 'range' ? filter : undefined;
		const bound = (label: string, value: number | undefined, set: (x: number | undefined) => void) => {
			const input = el('input');
			input.type = 'number';
			input.placeholder = label;
			input.value = value === undefined ? '' : String(value);
			input.addEventListener('change', () => {
				set(input.value.trim() === '' ? undefined : Number(input.value));
			});
			return input;
		};
		const apply = (next: { min?: number, max?: number, na: boolean }) => {
			if(next.min === undefined && next.max === undefined && next.na) {
				state.filters.delete(column);
			} else {
				state.filters.set(column, { kind: 'range', ...next });
			}
			change();
		};
		const now = { min: range?.min, max: range?.max, na: range?.na ?? true };
		const na = el('input');
		na.type = 'checkbox';
		na.checked = now.na;
		na.addEventListener('change', () => apply({ ...now, na: na.checked }));
		const naLabel = el('label', 'dv-check');
		naLabel.append(na, ` NA (${nas})`);
		const controls = el('div', 'dv-range');
		controls.append('keep ', bound('min', now.min, min => apply({ ...now, min })), ' to ', bound('max', now.max, max => apply({ ...now, max })), naLabel);
		panel.append(controls);
	} else {
		const found = counts(rows, column);
		const chosen = filter?.kind === 'values' ? filter.values : undefined;
		const set = (values: ReadonlySet<string> | undefined) => {
			if(values === undefined || found.every(([value]) => values.has(value))) {
				state.filters.delete(column);
			} else {
				state.filters.set(column, { kind: 'values', values });
			}
			change();
		};
		const actions = el('div', 'dv-actions');
		actions.append(
			button('dv-link', 'all', 'keep every value', () => set(undefined)),
			button('dv-link', 'none', 'keep no value, then tick the ones to keep', () => set(new Set())),
			...nas > 0 ? [button('dv-link', 'only NA', 'keep the rows missing a value', () => set(new Set([NA])))] : []
		);
		panel.append(el('div', 'dv-note', `${found.length} distinct value${found.length === 1 ? '' : 's'} in ${rows.length} row${rows.length === 1 ? '' : 's'}`), actions);
		const list = el('div', 'dv-values');
		const most = found[0]?.[1] ?? 1;
		for(const [value, count] of found.slice(0, 200)) {
			const label = el('label', 'dv-value');
			const box = el('input');
			box.type = 'checkbox';
			box.checked = chosen === undefined || chosen.has(value);
			box.addEventListener('change', () => {
				const next = new Set(chosen ?? found.map(([v]) => v));
				if(box.checked) {
					next.add(value);
				} else {
					next.delete(value);
				}
				set(next);
			});
			const bar = el('span', 'dv-bar');
			bar.style.width = `${Math.max(2, 100 * count / most)}%`;
			label.append(box, el('span', value === NA ? 'dv-name na' : 'dv-name', value === '' ? '(empty)' : value), el('span', 'dv-count', String(count)), bar);
			list.append(label);
		}
		panel.append(list);
		if(found.length > 200) {
			panel.append(el('div', 'dv-note', `and ${found.length - 200} more, search to find one`));
		}
	}
	return panel;
}

/** a small histogram of `values`, which are sorted */
function histogram(values: readonly number[]): HTMLElement {
	const bins = Math.min(20, Math.max(5, Math.round(Math.sqrt(values.length))));
	const [lo, hi] = [values[0], values[values.length - 1]];
	const counts = new Array<number>(bins).fill(0);
	for(const x of values) {
		counts[hi === lo ? 0 : Math.min(bins - 1, Math.floor((x - lo) / (hi - lo) * bins))]++;
	}
	const most = Math.max(...counts);
	const box = el('div', 'dv-hist');
	box.title = `${fmt(lo)} to ${fmt(hi)}`;
	for(const count of counts) {
		const bar = el('span');
		bar.style.height = `${100 * count / most}%`;
		bar.title = String(count);
		box.append(bar);
	}
	return box;
}

/** what a filter keeps, as a chip reads */
function describe(view: Viewed, column: number, filter: Filter): string {
	const name = view.names[column] || 'row names';
	if(filter.kind === 'values') {
		const values = [...filter.values].map(v => v === '' ? '(empty)' : v);
		return values.length === 0 ? `${name}: nothing` : `${name}: ${values.slice(0, 4).join(', ')}${values.length > 4 ? `, +${values.length - 4}` : ''}`;
	}
	const bounds = filter.min !== undefined && filter.max !== undefined ? `${fmt(filter.min)} to ${fmt(filter.max)}`
		: filter.min !== undefined ? `≥ ${fmt(filter.min)}` : filter.max !== undefined ? `≤ ${fmt(filter.max)}` : 'any';
	return `${name}: ${bounds}${filter.na ? ', NA' : ', no NA'}`;
}

/** one viewer of `state`, inline in the output or popped out into a dialog */
function viewer(view: Viewed, state: ViewState, popped: boolean): HTMLElement {
	const box = el('div', popped ? 'view dv popped' : 'view dv');
	const bar = el('div', 'dv-bar-top');
	const search = el('input', 'dv-search');
	search.type = 'search';
	search.placeholder = 'search all columns';
	search.value = state.query;
	const count = el('span', 'note meta dv-count-all');
	const chips = el('span', 'dv-chips');
	const pop = popped ? button('dv-pop', 'close', 'back to the output', () => box.closest<HTMLDialogElement>('dialog')?.close())
		: button('dv-pop', '⤢ pop out', 'open the table large, to search, sort, summarize, and filter it', () => popOut(view, state));
	bar.append(search, chips, count, pop);
	const scroll = el('div', 'view-scroll');
	const table = el('table');
	const head = el('tr');
	const body = el('tbody');
	const thead = el('thead');
	thead.append(head);
	table.append(thead, body);
	scroll.append(table);
	const side = el('div', 'dv-side');
	const main = el('div', 'dv-main');
	main.append(scroll, side);
	box.append(el('div', 'note meta', `View: ${view.title}, ${view.rows} row${view.rows === 1 ? '' : 's'} and ${view.names.length} column${view.names.length === 1 ? '' : 's'}${view.cells.length < view.rows ? `, the first ${view.cells.length} shown` : ''}`), bar, main);
	const change = () => state.shown.forEach(draw => draw());
	search.addEventListener('input', () => {
		state.query = search.value;
		change();
	});
	view.names.forEach((name, column) => {
		const th = el('th');
		const sum = button('dv-sum', 'Σ', `summarize ${name || 'the row names'} and filter by it`, event => {
			event.stopPropagation();
			state.focus = state.focus === column ? undefined : column;
			change();
		});
		th.append(el('span', undefined, name), sum, el('span', 'cls', view.classes[column] ?? ''));
		th.title = 'click to sort';
		th.addEventListener('click', () => {
			state.order = state.order?.column === column ? (state.order.down ? undefined : { column, down: true }) : { column, down: false };
			change();
		});
		head.append(th);
	});
	/* a viewer that was on the page and left it (a closed dialog, cleared output) stops following the state */
	let placed = false;
	const draw = () => {
		placed ||= box.isConnected;
		if(placed && !box.isConnected) {
			state.shown.delete(draw);
			return;
		}
		if(document.activeElement !== search) {
			search.value = state.query;
		}
		[...head.children].forEach((th, column) => {
			th.toggleAttribute('aria-sort', state.order?.column === column);
			if(state.order?.column === column) {
				th.setAttribute('aria-sort', state.order.down ? 'descending' : 'ascending');
			}
			th.classList.toggle('filtered', state.filters.has(column));
			th.classList.toggle('focused', state.focus === column);
		});
		const rows = visibleRows(view, state);
		count.textContent = rows.length === view.cells.length ? `${rows.length} rows` : `${rows.length} of ${view.cells.length} rows`;
		chips.replaceChildren(...[...state.filters].map(([column, filter]) => {
			const chip = button('dv-chip', `${describe(view, column, filter)} ×`, 'remove this filter', () => {
				state.filters.delete(column);
				change();
			});
			return chip;
		}));
		body.replaceChildren(...rows.map(row => {
			const tr = el('tr');
			tr.append(...row.map((cell, at) => el('td', [cell === NA ? 'na' : '', isNumeric(view, at) ? 'num' : ''].filter(Boolean).join(' ') || undefined, cell)));
			return tr;
		}));
		side.replaceChildren(...state.focus === undefined ? [] : [columnPanel(view, state, state.focus, change)]);
		box.classList.toggle('with-side', state.focus !== undefined);
	};
	state.shown.add(draw);
	draw();
	return box;
}

/** the table as a dialog filling most of the page, sharing what the inline one searches, sorts, and filters */
function popOut(view: Viewed, state: ViewState): void {
	let dialog = document.getElementById('dataview') as HTMLDialogElement | null;
	if(dialog === null) {
		dialog = Object.assign(document.createElement('dialog'), { id: 'dataview' });
		dialog.addEventListener('click', event => {
			if(event.target === dialog) {
				dialog?.close();
			}
		});
		document.body.append(dialog);
	}
	dialog.replaceChildren(viewer(view, state, true));
	dialog.showModal();
	dialog.querySelector<HTMLInputElement>('.dv-search')?.focus();
}

/**
 * A table of a `View()` to scroll through, as RStudio's data viewer offers it: a click on a column head sorts by it,
 * its Σ shows a summary of the column (the quartiles and a histogram of a number, how often each value occurs
 * otherwise) where ticking values or bounds filters the rows, and a search finds rows by any of their cells.
 * It pops out into a dialog filling the page, which shares the search, order, and filters with the inline table.
 */
export function dataViewer(view: Viewed): HTMLElement {
	return viewer(view, { query: '', order: undefined, filters: new Map(), focus: undefined, shown: new Set() }, false);
}
