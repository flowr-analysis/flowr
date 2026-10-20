/** R Markdown and Quarto as prose around R chunks, Jupyter as R scripts in the percent format (`# %%`), every line kept where flowR sees it */
import { Decoration, EditorView, ViewPlugin, WidgetType, keymap, type DecorationSet, type ViewUpdate } from '@codemirror/view';
import { Facet, Prec, StateEffect, StateField, type EditorState, type Extension, type Range } from '@codemirror/state';
import { StreamLanguage, type StreamParser, type StringStream } from '@codemirror/language';
import { r } from '@codemirror/legacy-modes/mode/r';
import { yaml } from '@codemirror/legacy-modes/mode/yaml';
import type { INotebookContent } from '@jupyterlab/nbformat';
import { cellOptionLines, globalChunkOptions, isExecutableCell, parseRMarkdownFile, RTagRegex } from '../../src/project/plugins/file-plugins/files/flowr-rmarkdown-file';
import { el } from '../page-lib/dom';

export const isMarkdownDocument = (name: string): boolean => /\.(rmd|rmarkdown|qmd)$/i.test(name);

const CellMarker = /^#\s?%%/;
const MarkdownCellMarker = /^#\s?%%.*\[markdown\]/i;
const Fence = /^\s*(`{3,}|~{3,})/;
const LineBreak = /\r\n|\r|\n/;

function prose(stream: StringStream, opens: boolean): string | null {
	if(opens && stream.match(/^#{1,6}\s.*/)) {
		return 'heading';
	}
	if(stream.match(/^`[^`]*`/)) {
		return 'monospace';
	}
	if(stream.match(/^(\*\*|__)(?=\S)[^*_]*?\S\1/)) {
		return 'strong';
	}
	if(stream.match(/^([*_])(?=\S)[^*_]*?\S\1/)) {
		return 'emphasis';
	}
	if(stream.match(/^\[[^\]]*\]\([^)]*\)/)) {
		return 'link';
	}
	stream.next();
	stream.eatWhile(/[^`*_[]/);
	return null;
}

interface MarkdownState {
	zone:  'start' | 'frontmatter' | 'prose' | 'chunk' | 'foreign'
	fence: string
	inner: unknown
}

const rParser: StreamParser<unknown> = r;
const yamlParser: StreamParser<unknown> = yaml;
const startOf = (parser: StreamParser<unknown>) => parser.startState?.(2) ?? {};
const copyOf = (parser: StreamParser<unknown>, state: unknown) => parser.copyState?.(state) ?? state;

const markdownDocument: StreamParser<MarkdownState> = {
	name:       'rmarkdown',
	startState: () => ({ zone: 'start', fence: '', inner: undefined }),
	copyState:  state => ({ ...state, inner: state.zone === 'chunk' ? copyOf(rParser, state.inner) : state.zone === 'frontmatter' ? copyOf(yamlParser, state.inner) : state.inner }),
	token(stream, state) {
		if(stream.sol()) {
			const line = stream.string;
			if(state.zone === 'start') {
				state.zone = 'prose';
				if(/^---\s*$/.test(line)) {
					state.zone = 'frontmatter';
					state.inner = startOf(yamlParser);
					stream.skipToEnd();
					return 'meta';
				}
			}
			if(state.zone === 'frontmatter' && /^(---|\.\.\.)\s*$/.test(line)) {
				state.zone = 'prose';
				stream.skipToEnd();
				return 'meta';
			}
			const fence = Fence.exec(line)?.[1];
			if(fence !== undefined && state.zone === 'prose') {
				state.zone = RTagRegex.test(line) ? 'chunk' : 'foreign';
				state.fence = fence;
				state.inner = startOf(rParser);
				stream.skipToEnd();
				return 'meta';
			}
			if(fence !== undefined && (state.zone === 'chunk' || state.zone === 'foreign') && fence[0] === state.fence[0] && fence.length >= state.fence.length && line.trim() === fence) {
				state.zone = 'prose';
				stream.skipToEnd();
				return 'meta';
			}
		}
		switch(state.zone) {
			case 'frontmatter':
				return yamlParser.token(stream, state.inner);
			case 'chunk':
				return rParser.token(stream, state.inner);
			case 'foreign':
				stream.skipToEnd();
				return 'monospace';
			default:
				return prose(stream, stream.sol());
		}
	},
	languageData: { commentTokens: { line: '#' } }
};

interface ScriptState {
	text:  boolean
	/** right behind the `#` of a text cell, where its markdown line begins */
	opens: boolean
	inner: unknown
}

const percentScript: StreamParser<ScriptState> = {
	name:       'r',
	startState: () => ({ text: false, opens: false, inner: startOf(rParser) }),
	copyState:  state => ({ ...state, inner: copyOf(rParser, state.inner) }),
	token(stream, state) {
		if(stream.sol() && CellMarker.test(stream.string)) {
			state.text = MarkdownCellMarker.test(stream.string);
			stream.skipToEnd();
			return 'meta';
		}
		if(state.text) {
			if(stream.sol() && stream.match(/^#\s?/)) {
				state.opens = true;
				return 'meta';
			}
			const opens = state.opens;
			state.opens = false;
			return prose(stream, opens);
		}
		return rParser.token(stream, state.inner);
	},
	indent:       (state, textAfter, context) => rParser.indent?.(state.inner, textAfter, context) ?? null,
	languageData: { commentTokens: { line: '#' } }
};

const markdownLanguage = StreamLanguage.define(markdownDocument);
const scriptLanguage = StreamLanguage.define(percentScript);

/** how a file of this name reads in the editor */
export function languageOf(name: string): Extension {
	return isMarkdownDocument(name) ? markdownLanguage : scriptLanguage;
}

/** a run of lines, 1-based and inclusive */
interface Cell {
	readonly kind:     'code' | 'text' | 'meta'
	readonly head?:    number
	readonly from:     number
	readonly to:       number
	readonly tail?:    number
	readonly runs:     boolean
	readonly label:    string
	/** how many of the first lines are options (`#| label: fit`), not code */
	readonly options?: number
}

/** knitr names a chunk by the first, unnamed option of its header, as in `{r setup, include = FALSE}` */
const chunkName = (header: string) => /^\{r[\s,]+([^\s,=}]+)\s*(?:[,}]|$)/i.exec(header)?.[1] ?? '';

function documentCells(text: string, rows: readonly string[]): Cell[] {
	const cells: Cell[] = [];
	if(/^---\s*$/.test(rows[0] ?? '')) {
		const close = rows.findIndex((row, at) => at > 0 && /^(---|\.\.\.)\s*$/.test(row));
		if(close > 0) {
			cells.push({ kind: 'meta', head: 1, from: 2, to: close, tail: close + 1, runs: true, label: 'front matter' });
		}
	}
	const info = parseRMarkdownFile(text);
	const defaults = globalChunkOptions(info.options);
	for(const block of info.blocks) {
		if(block.header === '') {
			continue;
		}
		const from = block.startpos.line;
		const to = from + block.code.split(LineBreak).length - 2;
		cells.push({ kind: 'code', head: from - 1, from, to, tail: Fence.test(rows[to] ?? '') ? to + 1 : undefined, runs: isExecutableCell(block, defaults), label: block.options.get('label') ?? chunkName(block.header), options: cellOptionLines(block.code).length });
	}
	return cells;
}

function scriptCells(rows: readonly string[]): Cell[] {
	const heads = rows.flatMap((row, at) => CellMarker.test(row) ? [at + 1] : []);
	return heads.map((head, i) => ({
		kind:  MarkdownCellMarker.test(rows[head - 1]) ? 'text' : 'code',
		head,
		from:  head + 1,
		to:    (heads[i + 1] ?? rows.length + 1) - 1,
		runs:  true,
		label: ''
	}));
}

const lineDeco = (classes: string, note?: string) => Decoration.line({ class: classes, attributes: note === undefined ? undefined : { 'data-note': note } });

function cellsOf(state: EditorState, markdown: boolean): Cell[] {
	const text = state.doc.toString();
	const rows = text.split(LineBreak);
	return markdown ? documentCells(text, rows) : scriptCells(rows);
}

/** runs a cell in the shared R session, its output going `into` the given element */
export type CellRunner = (code: string, title: string, into?: HTMLElement, fresh?: boolean) => Promise<number | undefined>;
type CellRuns = (view: EditorView, picked: readonly Cell[], cells: readonly Cell[], fresh?: boolean) => Promise<void>;

/** runs the whole notebook cell by cell, `undefined` for a file without code cells */
export const NotebookRun = Facet.define<(view: EditorView, fresh: boolean) => Promise<void> | undefined>();

const codeIndex = (cell: Cell, cells: readonly Cell[]) => cells.filter(c => c.kind === 'code').indexOf(cell);
const titleOf = (cell: Cell, cells: readonly Cell[]) => `cell ${codeIndex(cell, cells) + 1}${cell.label ? ` · ${cell.label}` : ''}`;

const cellAt = (cells: readonly Cell[], line: number) => cells.find(c => line >= c.from && line <= c.to);

/** the name of the code cell holding a line */
export function cellTitles(state: EditorState, name: string): (line: number) => string | undefined {
	const cells = cellsOf(state, isMarkdownDocument(name));
	return line => {
		const cell = cellAt(cells, line);
		return cell?.kind === 'code' ? titleOf(cell, cells) : undefined;
	};
}

/**
 * The document with each code cell's code replaced by `codeOf`. A cell left with no code goes whole, together with
 * the text since the cell before it. A file without cells is one cell.
 */
export function rewriteCells(state: EditorState, name: string, codeOf: (from: number, to: number) => string): string {
	const rows = state.doc.toString().split(LineBreak);
	const cells = cellsOf(state, isMarkdownDocument(name));
	if(cells.length === 0) {
		return codeOf(1, rows.length);
	}
	const out: string[] = [];
	let text: string[] = [];
	for(let line = 1; line <= rows.length;) {
		const cell = cells.find(c => (c.head ?? c.from) === line);
		if(cell?.kind === 'code') {
			const body = cell.from + (cell.options ?? 0);
			const code = body > cell.to ? '' : codeOf(body, cell.to);
			if(code.trim() !== '') {
				out.push(...text, ...rows.slice((cell.head ?? cell.from) - 1, body - 1), ...code.split('\n'), ...cell.tail === undefined ? [] : [rows[cell.tail - 1]]);
			}
			text = [];
			line = (cell.tail ?? cell.to) + 1;
		} else if(cell?.kind === 'meta') {
			out.push(...text, ...rows.slice(line - 1, cell.tail ?? cell.to));
			text = [];
			line = (cell.tail ?? cell.to) + 1;
		} else {
			text.push(rows[line - 1]);
			line++;
		}
	}
	return [...out, ...text].join('\n');
}

/** whether a line is R code */
export function writesR(state: EditorState, name: string, line: number): boolean {
	const markdown = isMarkdownDocument(name);
	const kind = cellAt(cellsOf(state, markdown), line)?.kind;
	return markdown ? kind === 'code' : kind !== 'text';
}

const codeOf = (state: EditorState, cell: Cell) => cell.from > cell.to ? '' : state.sliceDoc(state.doc.line(cell.from).from, state.doc.line(cell.to).to);

class CellOutput extends WidgetType {
	constructor(readonly box: HTMLElement) {
		super();
	}
	eq(other: CellOutput): boolean {
		return other.box === this.box;
	}
	toDOM(): HTMLElement {
		return this.box;
	}
	ignoreEvent(): boolean {
		return true;
	}
}

const outputsChanged = StateEffect.define<null>();

function cellRunning(markdown: boolean, run: CellRunner): { readonly runs: CellRuns, readonly shown: Extension, readonly took: ReadonlyMap<number, number> } {
	const took = new Map<number, number>();
	const outputs = new Map<number, HTMLElement>();
	const outputOf = (view: EditorView, index: number): HTMLElement => {
		let box = outputs.get(index);
		if(box === undefined) {
			const shown = el('div', 'cm-cell-output');
			const close = el('button', 'cm-cell-output-x', 'x');
			close.type = 'button';
			close.title = 'close the output';
			close.addEventListener('click', () => (outputs.delete(index), view.dispatch({ effects: outputsChanged.of(null) })));
			shown.append(close, el('div', 'cm-cell-output-body'));
			outputs.set(index, box = shown);
			view.dispatch({ effects: outputsChanged.of(null) });
		}
		return box.lastElementChild as HTMLElement;
	};
	const runs: CellRuns = (view, picked, cells, fresh = false) => {
		return picked.filter(c => c.kind === 'code' && c.runs).reduce((before, cell, at) => before.then(async() => {
			const ran = await run(codeOf(view.state, cell), titleOf(cell, cells), outputOf(view, codeIndex(cell, cells)), fresh && at === 0);
			if(ran !== undefined) {
				took.set(codeIndex(cell, cells), ran);
				view.dispatch({ effects: outputsChanged.of(null) });
			}
		}), Promise.resolve());
	};
	const blocks = (state: EditorState): DecorationSet => {
		const code = cellsOf(state, markdown).filter(c => c.kind === 'code');
		return Decoration.set([...outputs].filter(([index]) => code[index] !== undefined).map(([index, box]) => {
			const cell = code[index];
			return Decoration.widget({ widget: new CellOutput(box), block: true, side: 1 }).range(state.doc.line(Math.min(cell.tail ?? cell.to, state.doc.lines)).to);
		}), true);
	};
	const shown = StateField.define<DecorationSet>({
		create:  blocks,
		update:  (deco, tr) => tr.docChanged || tr.effects.some(e => e.is(outputsChanged)) ? blocks(tr.state) : deco,
		provide: field => EditorView.decorations.from(field)
	});
	return { runs, shown, took };
}

const RunChoices: readonly (readonly [string, string, (cells: readonly Cell[], at: number) => readonly Cell[]])[] = [
	['Run this cell', 'Run', (cells, at) => [cells[at]]],
	['Run all cells above', 'Run above', (cells, at) => cells.slice(0, at)],
	['Run this cell and all below', 'Run below', (cells, at) => cells.slice(at)],
	['Run all cells', 'Run all', cells => cells]
];
/** index of the picked {@link RunChoices} entry */
let runChoice = 0;

class CellLabel extends WidgetType {
	constructor(readonly text: string) {
		super();
	}
	eq(other: CellLabel): boolean {
		return other.text === this.text;
	}
	toDOM(): HTMLElement {
		return el('span', 'cm-cell-label', this.text);
	}
}

class RunButton extends WidgetType {
	constructor(readonly cell: Cell, readonly note: string, readonly markdown: boolean, readonly runs: CellRuns, readonly took?: number) {
		super();
	}
	eq(other: RunButton): boolean {
		return other.cell.from === this.cell.from && other.cell.to === this.cell.to && other.note === this.note && other.cell.runs === this.cell.runs && other.took === this.took;
	}
	toDOM(view: EditorView): HTMLElement {
		const tools = el('span', 'cm-cell-tools');
		if(this.note !== '') {
			tools.append(el('span', 'cm-cell-note', this.note));
		}
		if(!this.cell.runs) {
			const skipped = el('span', 'cm-cell-skipped', 'skipped');
			skipped.title = 'the document says not to run this cell (eval: false)';
			tools.append(skipped);
		}
		if(this.took !== undefined) {
			const took = el('span', 'cm-cell-took', this.took < 1000 ? `${Math.round(this.took)} ms` : `${(this.took / 1000).toFixed(1)} s`);
			took.title = 'how long the cell took the last time it ran';
			tools.append(took);
		}
		const button = el('button', 'cm-cell-run');
		const label = el('span', 'label', RunChoices[runChoice][1]);
		button.append(label);
		/* the Run button's own icon, badge and all: a cell always runs in the session that runs keep */
		const icon = document.querySelector('#runrgo .runicon')?.cloneNode(true);
		if(icon) {
			button.prepend(icon);
		}
		button.type = 'button';
		button.title = 'run in the same R session as runs and the repl (shift+enter runs this cell)';
		button.addEventListener('mousedown', event => event.preventDefault());
		const current = () => {
			const cells = cellsOf(view.state, this.markdown);
			return { cells, at: Math.max(0, cells.findIndex(c => c.head === this.cell.head)) };
		};
		button.addEventListener('click', () => {
			const { cells, at } = current();
			void this.runs(view, RunChoices[runChoice][2](cells, at), cells);
		});
		const more = el('button', 'cm-cell-more');
		more.type = 'button';
		more.title = 'choose what the button runs';
		more.setAttribute('aria-haspopup', 'menu');
		more.setAttribute('aria-expanded', 'false');
		more.setAttribute('aria-label', more.title);
		const menu = el('div', 'cm-cell-menu');
		menu.setAttribute('role', 'menu');
		menu.hidden = true;
		menu.append(el('div', 'cm-cell-heading', 'Run with this button'));
		const close = (event?: Event) => {
			if(event === undefined || !split.contains(event.target as Node)) {
				menu.hidden = true;
				more.setAttribute('aria-expanded', 'false');
				document.removeEventListener('mousedown', close);
			}
		};
		for(const [at, [text, short]] of RunChoices.entries()) {
			const choice = el('button', 'cm-cell-choice', text);
			choice.type = 'button';
			choice.setAttribute('role', 'menuitemradio');
			choice.setAttribute('aria-checked', String(at === runChoice));
			choice.addEventListener('click', () => {
				close();
				runChoice = at;
				view.dom.querySelectorAll('.cm-cell-run .label').forEach(l => l.textContent = short);
			});
			menu.append(choice);
		}
		more.addEventListener('mousedown', event => event.preventDefault());
		more.addEventListener('click', () => {
			menu.querySelectorAll('.cm-cell-choice').forEach((c, at) => c.setAttribute('aria-checked', String(at === runChoice)));
			menu.hidden = !menu.hidden;
			more.setAttribute('aria-expanded', String(!menu.hidden));
			if(!menu.hidden) {
				document.addEventListener('mousedown', close);
			}
		});
		menu.addEventListener('keydown', event => {
			if(event.key === 'Escape') {
				close();
				more.focus();
			}
		});
		const split = el('span', 'cm-cell-split');
		split.append(button, more, menu);
		tools.append(split);
		return tools;
	}
	ignoreEvent(): boolean {
		return true;
	}
}

function decorate(view: EditorView, markdown: boolean, runs: CellRuns, took: ReadonlyMap<number, number>): DecorationSet {
	const doc = view.state.doc;
	const cells = cellsOf(view.state, markdown);
	const found: Range<Decoration>[] = [];
	const at = (line: number, deco: Decoration) => {
		if(line >= 1 && line <= doc.lines) {
			found.push(deco.range(doc.line(line).from));
		}
	};
	const inCell = new Set<number>();
	for(const cell of cells) {
		const kind = `cm-cell cm-cell-${cell.kind}${cell.runs ? '' : ' cm-cell-off'}`;
		const note = cell.kind === 'meta' ? cell.label : cell.kind === 'text' && markdown ? 'markdown' : undefined;
		if(cell.head !== undefined) {
			at(cell.head, lineDeco(`${kind} cm-cell-head`, note));
			if(!markdown && cell.head <= doc.lines) {
				const head = doc.line(cell.head);
				found.push(Decoration.replace({ widget: new CellLabel(cell.kind === 'text' ? 'markdown' : titleOf(cell, cells)) }).range(head.from, head.to));
			}
			inCell.add(cell.head);
			if(cell.kind === 'code' && cell.head <= doc.lines) {
				const note = markdown ? titleOf(cell, cells) : cell.label;
				found.push(Decoration.widget({ widget: new RunButton(cell, note, markdown, runs, took.get(codeIndex(cell, cells))), side: 1 }).range(doc.line(cell.head).to));
			}
		}
		for(let line = cell.from; line <= cell.to; line++) {
			at(line, lineDeco(`${kind}${line === cell.to && cell.tail === undefined ? ' cm-cell-end' : ''}`));
			inCell.add(line);
			const prefix = !markdown && cell.kind === 'text' && line <= doc.lines ? /^#\s?/.exec(doc.line(line).text)?.[0] : undefined;
			if(prefix !== undefined) {
				found.push(Decoration.replace({}).range(doc.line(line).from, doc.line(line).from + prefix.length));
			}
		}
		if(cell.tail !== undefined) {
			at(cell.tail, lineDeco(`${kind} cm-cell-tail cm-cell-end`));
			inCell.add(cell.tail);
		}
	}
	if(markdown) {
		for(let line = 1; line <= doc.lines; line++) {
			if(!inCell.has(line)) {
				at(line, lineDeco('cm-prose'));
			}
		}
	}
	return Decoration.set(found, true);
}

/** the cell decorations of a notebook, each code cell runnable with `run` */
export function notebookCells(name: string, run: CellRunner): Extension {
	const markdown = isMarkdownDocument(name);
	const { runs, shown, took } = cellRunning(markdown, run);
	return [
		shown,
		NotebookRun.of((view, fresh) => {
			const cells = cellsOf(view.state, markdown);
			return cells.some(c => c.kind === 'code') ? runs(view, cells, cells, fresh) : undefined;
		}),
		ViewPlugin.fromClass(class {
			decorations: DecorationSet;
			constructor(view: EditorView) {
				this.decorations = decorate(view, markdown, runs, took);
			}
			update(update: ViewUpdate) {
				if(update.docChanged || update.transactions.some(tr => tr.effects.some(e => e.is(outputsChanged)))) {
					this.decorations = decorate(update.view, markdown, runs, took);
				}
			}
		}, { decorations: plugin => plugin.decorations }),
		Prec.high(keymap.of([{
			key: 'Shift-Enter',
			run(view) {
				const line = view.state.doc.lineAt(view.state.selection.main.head).number;
				const cells = cellsOf(view.state, markdown);
				const cell = cells.find(c => c.kind === 'code' && (c.head ?? c.from) <= line && line <= (c.tail ?? c.to));
				if(cell === undefined) {
					return markdown || cells.length > 0;
				}
				void runs(view, [cell], cells);
				return true;
			}
		}])),
		cellLook
	];
}

const cellLook = EditorView.theme({
	/* see-through, or the selection drawn beneath the lines would vanish */
	'.cm-cell': {
		backgroundColor: 'color-mix(in srgb, var(--accent) 5%, transparent)',
		boxShadow:       'inset 3px 0 0 color-mix(in srgb, var(--accent) 55%, transparent)'
	},
	'.cm-cell-text': {
		backgroundColor: 'color-mix(in srgb, var(--panel) 70%, transparent)',
		boxShadow:       'inset 3px 0 0 color-mix(in srgb, var(--muted) 40%, transparent)',
		fontFamily:      'system-ui, -apple-system, "Segoe UI", sans-serif',
		lineHeight:      '1.65',
		/* indented, not padded: the selection would draw every line with the padding of one */
		textIndent:      '.5rem'
	},
	'.cm-cell-text.cm-cell-head': { fontFamily: 'inherit', opacity: '.55', lineHeight: '1.4' },
	'.cm-cell-text.cm-cell-end':  { paddingBottom: '.35rem' },
	'.cm-cell-meta':              { backgroundColor: 'color-mix(in srgb, var(--sunk) 85%, transparent)', boxShadow: 'inset 3px 0 0 var(--border)' },
	'.cm-cell-off':               { backgroundColor: 'transparent', boxShadow: 'inset 3px 0 0 var(--border)', opacity: '.6' },
	'.cm-cell-head':              { borderTop: '1px solid var(--border)', fontSize: '.85em' },
	'.cm-cell-tail':              { fontSize: '.85em' },
	'.cm-cell-end':               { borderBottom: '1px solid var(--border)' },
	'.cm-cell-tools':             { float: 'right', display: 'inline-flex', alignItems: 'center', gap: '.5rem', margin: '0 .5rem 0 .75rem', position: 'relative', top: '.35rem' },
	'.cm-cell-took':              { fontFamily: 'system-ui, sans-serif', fontSize: '.68rem', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' },
	'.cm-cell-skipped':           {
		fontFamily:   'system-ui, sans-serif', fontSize:     '.68rem', fontStyle:    'italic', color:        'var(--muted)',
		padding:      '0 .4rem', border:       '1px dashed var(--border)', borderRadius: '1rem'
	},
	'.cm-cell-note, .cm-cell-head[data-note]::after': {
		fontFamily:    'system-ui, sans-serif',
		fontSize:      '.7rem',
		color:         'var(--muted)',
		letterSpacing: '.04em',
		textTransform: 'uppercase'
	},
	'.cm-cell-head[data-note]::after': { content: 'attr(data-note)', float: 'right', marginRight: '.5rem' },
	'.cm-cell-label':                  { fontFamily: 'system-ui, sans-serif', fontSize: '.72rem', fontWeight: '600', letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--muted)' },
	'.cm-cell-split':                  { position: 'relative', display: 'inline-flex' },
	'.cm-cell-run, .cm-cell-more':     {
		display:       'inline-flex',
		alignItems:    'center',
		gap:           '.35rem',
		cursor:        'pointer',
		lineHeight:    '1.5',
		fontFamily:    'system-ui, sans-serif',
		fontSize:      '.7rem',
		fontWeight:    '650',
		letterSpacing: '.03em',
		color:         'var(--accent-fg)',
		background:    'var(--accent)',
		border:        '0'
	},
	'.cm-cell-run':          { padding: '.05rem .55rem .05rem .6rem', borderRadius: '1rem 0 0 1rem' },
	'.cm-cell-more':         { padding: '.05rem .4rem', borderRadius: '0 1rem 1rem 0', borderLeft: '1px solid color-mix(in srgb, var(--accent-fg) 35%, var(--accent))' },
	'.cm-cell-more::before': {
		content:    '""', width:      '.45rem', height:     '.45rem', background: 'currentColor',
		clipPath:   'polygon(10% 30%, 50% 72%, 90% 30%, 100% 42%, 50% 92%, 0% 42%)'
	},
	'.cm-cell-run .runicon':                   { width: '.65rem', height: '.65rem' },
	'.cm-cell-run:hover, .cm-cell-more:hover': { background: 'color-mix(in srgb, var(--accent) 88%, var(--fg))' },
	'.cm-cell-menu':                           {
		position:      'absolute', top:           'calc(100% + .15rem)', right:         '0', zIndex:        '20', minWidth:      '11rem', padding:       '.25rem',
		display:       'flex', flexDirection: 'column', fontFamily:    'system-ui, sans-serif', fontSize:      '.8rem',
		background:    'var(--panel)', color:         'var(--fg)', border:        '1px solid var(--border)', borderRadius:  '.4rem',
		boxShadow:     '0 .4rem 1.2rem rgb(0 0 0 / .25)'
	},
	'.cm-cell-menu[hidden]': { display: 'none' },
	'.cm-cell-heading':      { padding: '.4rem .6rem .15rem', fontSize: '.7rem', letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)' },
	'.cm-cell-choice':       {
		textAlign:    'left', padding:      '.3rem .6rem', border:       'none', borderRadius: '.3rem', background:   'none',
		color:        'var(--fg)', font:         'inherit', cursor:       'pointer', whiteSpace:   'nowrap'
	},
	'.cm-cell-choice::before':                              { content: '"\\2713"', display: 'inline-block', width: '1.2em', visibility: 'hidden' },
	'.cm-cell-choice[aria-checked="true"]::before':         { visibility: 'visible' },
	'.cm-cell-choice:hover, .cm-cell-choice:focus-visible': { background: 'var(--sunk)', color: 'var(--accent)', outline: 'none' },
	'.cm-cell-output':                                      {
		/* no margin: the editor measures a block by its box */
		position:       'relative', boxSizing:      'border-box', width:          '100%', padding:        '.4rem 1.8rem .4rem .8rem',
		borderLeft:     '3px solid color-mix(in srgb, var(--accent) 45%, transparent)', borderBottom:   '.4rem solid transparent',
		backgroundClip: 'padding-box', background:     'var(--panel)', fontSize:       '.82rem', maxHeight:      '32rem', overflow:       'auto'
	},
	'.cm-cell-output-body > div':   { whiteSpace: 'pre-wrap' },
	'.cm-cell-output-body > .note': { color: 'var(--muted)' },
	'.cm-cell-output-body > .meta': { fontFamily: 'system-ui, sans-serif', fontStyle: 'italic' },
	'.cm-cell-output-body > .bad':  { color: '#d55e00' },
	/* no wider than the output, or the code scrolls sideways */
	'.cm-cell-output-body canvas':  { display: 'block', margin: '.3rem 0' },
	'.cm-cell-output-x':            {
		position: 'absolute', top: '.2rem', right: '.3rem', border: 'none', background: 'none', color: 'var(--muted)', cursor: 'pointer', font: 'inherit', fontSize: '.75rem'
	},
	'.cm-cell-output-x:hover':                     { color: 'var(--accent)' },
	'.cm-prose, .cm-cell-text:not(.cm-cell-head)': { fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif' }
});

/** a Jupyter notebook as an R script in the percent format, text cells as comments */
export function notebookAsScript(json: string): string {
	const { cells } = JSON.parse(json) as Partial<INotebookContent>;
	if(!Array.isArray(cells)) {
		throw new Error('not a Jupyter notebook, it has no cells');
	}
	return cells.map(cell => {
		const source = (typeof cell.source === 'string' ? cell.source : cell.source.join('')).replace(/\n$/, '');
		if(cell.cell_type === 'code') {
			return `# %%\n${source}`;
		}
		const text = source.split(LineBreak).map(line => line === '' ? '#' : `# ${line}`).join('\n');
		return `# %% [${cell.cell_type === 'markdown' ? 'markdown' : 'raw'}]\n${text}`;
	}).join('\n\n') + '\n';
}
