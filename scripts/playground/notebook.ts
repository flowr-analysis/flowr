/** R Markdown and Quarto as prose around R chunks, Jupyter as R scripts in the percent format (`# %%`), R console transcripts as commands among their output, every line kept where flowR sees it */
import { Decoration, EditorView, ViewPlugin, WidgetType, keymap, type DecorationSet, type ViewUpdate } from '@codemirror/view';
import { Facet, Prec, StateEffect, StateField, type EditorState, type Extension, type Range } from '@codemirror/state';
import { StreamLanguage, type StreamParser, type StringStream } from '@codemirror/language';
import { r } from '@codemirror/legacy-modes/mode/r';
import { yaml } from '@codemirror/legacy-modes/mode/yaml';
import type { INotebookContent } from '@jupyterlab/nbformat';
import { cellOptionLines, globalChunkOptions, isExecutableCell, parseRMarkdownFile, RTagRegex } from '../../src/project/plugins/file-plugins/files/flowr-rmarkdown-file';
import { button, el } from '../page-lib/dom';
import { codeOfInput, isRSession, parseRSession, PromptWidth } from './r-session';

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

interface SessionState {
	input: boolean
	inner: unknown
}

const sessionTranscript: StreamParser<SessionState> = {
	name:       'r',
	startState: () => ({ input: false, inner: startOf(rParser) }),
	copyState:  state => ({ ...state, inner: copyOf(rParser, state.inner) }),
	token(stream, state) {
		if(stream.sol()) {
			const prompt = /^>(?: |$)/.test(stream.string) || state.input && /^\+(?: |$)/.test(stream.string);
			state.input = prompt;
			if(prompt) {
				stream.pos = Math.min(PromptWidth, stream.string.length);
				return 'meta';
			}
		}
		if(state.input) {
			return rParser.token(stream, state.inner);
		}
		stream.skipToEnd();
		return 'comment';
	},
	languageData: { commentTokens: { line: '#' } }
};

const markdownLanguage = StreamLanguage.define(markdownDocument);
const sessionLanguage = StreamLanguage.define(sessionTranscript);
const scriptLanguage = StreamLanguage.define(percentScript);

/** how a file of this name reads in the editor */
export function languageOf(name: string): Extension {
	return isMarkdownDocument(name) ? markdownLanguage : isRSession(name, '') ? sessionLanguage : scriptLanguage;
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
	/** the lines start with a console prompt */
	readonly prompt?:  boolean
	/** recorded output of a console session */
	readonly output?:  boolean
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

/** a console transcript as one code cell per command with its continuations, and the output between them */
function sessionCells(text: string): Cell[] {
	return parseRSession(text).map(({ kind, lines, firstLine }) => ({
		kind:   kind === 'input' ? 'code' : 'meta',
		from:   firstLine,
		to:     firstLine + lines.length - 1,
		runs:   true,
		label:  '',
		prompt: kind === 'input',
		output: kind === 'output'
	}));
}

/** whether the file is a console transcript */
const SessionFile = Facet.define<boolean, boolean>({ combine: values => values.some(Boolean) });

const lineDeco = (classes: string, note?: string) => Decoration.line({ class: classes, attributes: note === undefined ? undefined : { 'data-note': note } });

function cellsOf(state: EditorState, markdown: boolean): Cell[] {
	const text = state.doc.toString();
	const rows = text.split(LineBreak);
	return state.facet(SessionFile) ? sessionCells(text) : markdown ? documentCells(text, rows) : scriptCells(rows);
}

/** runs a cell in the shared R session, its output going `into` the given element */
export type CellRunner = (code: string, title: string, into?: HTMLElement, fresh?: boolean) => Promise<number | undefined>;
type CellRuns = (view: EditorView, picked: readonly Cell[], cells: readonly Cell[], fresh?: boolean) => Promise<void>;
/** opens the page's menu under `anchor`; a string is a heading */
export type CellMenu = (anchor: HTMLElement, entries: readonly (string | { readonly label: string, readonly checked?: boolean, readonly run: () => void })[]) => void;

/** adds a cell of `kind` at the line end `at` */
function insertCell(view: EditorView, markdown: boolean, at: number, kind: 'code' | 'text'): void {
	const [text, cursor] = newCell(markdown, kind);
	view.dispatch({ changes: { from: at, insert: text }, selection: { anchor: at + cursor } });
	view.focus();
}

/** removes the cell whose head is the line `head`, with its marker or fences */
function removeCell(view: EditorView, markdown: boolean, head: number | undefined): void {
	const cell = cellsOf(view.state, markdown).find(c => c.head === head);
	if(cell === undefined) {
		return;
	}
	const doc = view.state.doc;
	const first = doc.line(cell.head ?? cell.from), last = doc.line(Math.min(doc.lines, cell.tail ?? cell.to));
	/* the line break before the cell goes with it, or the one after it for the first cell */
	view.dispatch({ changes: first.number > 1 ? { from: first.from - 1, to: last.to } : { from: first.from, to: Math.min(doc.length, last.to + 1) } });
	view.focus();
}

/** what a cell shows under the pointer: a button removing it */
function cellEdits(view: EditorView, markdown: boolean, head: number | undefined): HTMLElement {
	const edits = el('span', 'cm-cell-edit');
	const remove = button('cm-cell-remove', 'remove', 'remove this cell (ctrl+z brings it back)', () => removeCell(view, markdown, head));
	remove.addEventListener('mousedown', event => event.preventDefault());
	edits.append(remove);
	return edits;
}

/** a thin row between cells and at the end, which offers to add a cell there under the pointer */
class Inserter extends WidgetType {
	constructor(readonly at: number, readonly markdown: boolean) {
		super();
	}
	eq(other: Inserter): boolean {
		return other.at === this.at;
	}
	toDOM(view: EditorView): HTMLElement {
		const row = el('div', 'cm-cell-insert');
		const hit = el('div', 'cm-cell-insert-hit');
		for(const kind of ['code', 'text'] as const) {
			const add = button('cm-cell-add', `+ ${kind}`, `add a ${kind} cell here`, () => insertCell(view, this.markdown, this.at, kind));
			add.addEventListener('mousedown', event => event.preventDefault());
			hit.append(add);
		}
		row.append(hit);
		return row;
	}
	ignoreEvent(): boolean {
		return true;
	}
}

/** the inserters after every cell and at the end of the document */
function inserters(markdown: boolean): Extension {
	const build = (state: EditorState) => {
		const doc = state.doc;
		const ends = new Set([...cellsOf(state, markdown).map(c => doc.line(Math.min(doc.lines, c.tail ?? c.to)).to), doc.length]);
		return Decoration.set([...ends].map(at => Decoration.widget({ widget: new Inserter(at, markdown), block: true, side: 1 }).range(at)), true);
	};
	return StateField.define<DecorationSet>({
		create:  build,
		update:  (found, tr) => tr.docChanged ? build(tr.state) : found,
		provide: field => EditorView.decorations.from(field)
	});
}

/** the edit tools of a cell without a run button, a text cell of a notebook */
class EditTools extends WidgetType {
	constructor(readonly head: number, readonly markdown: boolean) {
		super();
	}
	eq(other: EditTools): boolean {
		return other.head === this.head;
	}
	toDOM(view: EditorView): HTMLElement {
		const tools = el('span', 'cm-cell-tools');
		tools.append(cellEdits(view, this.markdown, this.head));
		return tools;
	}
	ignoreEvent(): boolean {
		return true;
	}
}

/** the text a new cell below another one starts with, and where the cursor goes in it */
function newCell(markdown: boolean, kind: 'code' | 'text'): [text: string, cursor: number] {
	const text = markdown ? kind === 'code' ? '\n\n```{r}\n\n```' : '\n\n' : kind === 'code' ? '\n# %%\n' : '\n# %% [markdown]\n# ';
	return [text, markdown && kind === 'code' ? text.length - 4 : text.length];
}

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
				const lines = code.split('\n');
				out.push(...text, ...rows.slice((cell.head ?? cell.from) - 1, body - 1), ...cell.prompt ? lines.map((line, at) => `${at === 0 ? '>' : '+'} ${line}`) : lines, ...cell.tail === undefined ? [] : [rows[cell.tail - 1]]);
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
	return markdown || state.facet(SessionFile) ? kind === 'code' : kind !== 'text';
}

const codeOf = (state: EditorState, cell: Cell) => {
	const code = cell.from > cell.to ? '' : state.sliceDoc(state.doc.line(cell.from).from, state.doc.line(cell.to).to);
	return cell.prompt ? code.split(LineBreak).map(codeOfInput).join('\n') : code;
};

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
			shown.append(button('cm-cell-output-x', 'x', 'close the output', () => (outputs.delete(index), view.dispatch({ effects: outputsChanged.of(null) }))), el('div', 'cm-cell-output-body'));
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
	constructor(readonly cell: Cell, readonly note: string, readonly markdown: boolean, readonly editable: boolean, readonly runs: CellRuns, readonly menu: CellMenu, readonly took?: number) {
		super();
	}
	eq(other: RunButton): boolean {
		return other.cell.from === this.cell.from && other.cell.to === this.cell.to && other.note === this.note && other.cell.runs === this.cell.runs && other.took === this.took;
	}
	toDOM(view: EditorView): HTMLElement {
		const tools = el('span', 'cm-cell-tools');
		if(this.editable) {
			tools.append(cellEdits(view, this.markdown, this.cell.head));
		}
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
		const current = () => {
			const cells = cellsOf(view.state, this.markdown);
			return { cells, at: Math.max(0, cells.findIndex(c => (c.head ?? c.from) === (this.cell.head ?? this.cell.from))) };
		};
		const run = button('cm-cell-run', '', 'run in the same R session as runs and the repl (shift+enter runs this cell)', () => {
			const { cells, at } = current();
			void this.runs(view, RunChoices[runChoice][2](cells, at), cells);
		});
		/* the Run button's own icon, badge and all: a cell always runs in the session that runs keep */
		const icon = document.querySelector('#runrgo .runicon')?.cloneNode(true);
		run.append(...icon ? [icon] : [], el('span', 'label', RunChoices[runChoice][1]));
		const more = button('cm-cell-more', '', 'choose what the button runs', () => this.menu(more, ['Run with this button', ...RunChoices.map(([text, short], at) => ({
			label:   text,
			checked: at === runChoice,
			run:     () => {
				runChoice = at;
				view.dom.querySelectorAll('.cm-cell-run .label').forEach(l => l.textContent = short);
			}
		}))]));
		more.setAttribute('aria-haspopup', 'menu');
		more.setAttribute('aria-expanded', 'false');
		more.setAttribute('aria-label', more.title);
		for(const keep of [run, more]) {
			keep.addEventListener('mousedown', event => event.preventDefault());
		}
		const split = el('span', 'cm-cell-split');
		split.append(run, more);
		tools.append(split);
		return tools;
	}
	ignoreEvent(): boolean {
		return true;
	}
}

function decorate(view: EditorView, markdown: boolean, editable: boolean, runs: CellRuns, menu: CellMenu, took: ReadonlyMap<number, number>): DecorationSet {
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
		const kind = `cm-cell cm-cell-${cell.kind}${cell.runs ? '' : ' cm-cell-off'}${cell.output ? ' cm-session-out' : ''}`;
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
				found.push(Decoration.widget({ widget: new RunButton(cell, note, markdown, editable, runs, menu, took.get(codeIndex(cell, cells))), side: 1 }).range(doc.line(cell.head).to));
			} else if(editable && cell.kind === 'text' && cell.head <= doc.lines) {
				found.push(Decoration.widget({ widget: new EditTools(cell.head, markdown), side: 1 }).range(doc.line(cell.head).to));
			}
		}
		if(cell.prompt && cell.from <= doc.lines) {
			found.push(Decoration.widget({ widget: new RunButton(cell, '', markdown, editable, runs, menu, took.get(codeIndex(cell, cells))), side: 1 }).range(doc.line(cell.from).to));
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
export function notebookCells(name: string, run: CellRunner, menu: CellMenu): Extension {
	const markdown = isMarkdownDocument(name);
	/* cells are added and removed in a notebook, a script keeps its `# %%` marks as the author wrote them */
	const editable = markdown || /\.ipynb\.r$/i.test(name);
	const { runs, shown, took } = cellRunning(markdown, run);
	return [
		shown,
		SessionFile.of(isRSession(name, '')),
		editable ? inserters(markdown) : [],
		NotebookRun.of((view, fresh) => {
			const cells = cellsOf(view.state, markdown);
			return cells.some(c => c.kind === 'code') ? runs(view, cells, cells, fresh) : undefined;
		}),
		ViewPlugin.fromClass(class {
			decorations: DecorationSet;
			constructor(view: EditorView) {
				this.decorations = decorate(view, markdown, editable, runs, menu, took);
			}
			update(update: ViewUpdate) {
				if(update.docChanged || update.transactions.some(tr => tr.effects.some(e => e.is(outputsChanged)))) {
					this.decorations = decorate(update.view, markdown, editable, runs, menu, took);
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
	'.cm-cell-text.cm-cell-head':                                    { fontFamily: 'inherit', opacity: '.55', lineHeight: '1.4' },
	'.cm-cell-text.cm-cell-end':                                     { paddingBottom: '.35rem' },
	'.cm-cell-meta':                                                 { backgroundColor: 'color-mix(in srgb, var(--sunk) 85%, transparent)', boxShadow: 'inset 3px 0 0 var(--border)' },
	'.cm-session-out':                                               { backgroundColor: 'transparent', boxShadow: 'inset 3px 0 0 transparent', color: 'var(--muted)', fontStyle: 'italic' },
	'.cm-cell-off':                                                  { backgroundColor: 'transparent', boxShadow: 'inset 3px 0 0 var(--border)', opacity: '.6' },
	'.cm-cell-head':                                                 { borderTop: '1px solid var(--border)', fontSize: '.85em' },
	'.cm-cell-tail':                                                 { fontSize: '.85em' },
	'.cm-cell-end':                                                  { borderBottom: '1px solid var(--border)' },
	'.cm-cell-tools':                                                { float: 'right', display: 'inline-flex', alignItems: 'center', gap: '.5rem', margin: '0 .5rem 0 .75rem', position: 'relative', top: '.35rem' },
	/* the edit tools only show under the pointer, or while one of them has the focus */
	'.cm-cell-edit':                                                 { display: 'inline-flex', gap: '.25rem', visibility: 'hidden' },
	'.cm-cell-head:hover .cm-cell-edit, .cm-cell-edit:focus-within': { visibility: 'visible' },
	/* the row takes no room, so the text never moves: a thin band across the boundary offers to add a cell, fading in as in VS Code */
	'.cm-cell-insert':                                               { position: 'relative', height: '0', zIndex: '1' },
	'.cm-cell-insert-hit':                                           { position: 'absolute', left: '0', right: '0', top: '-.3rem', height: '.6rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '.4rem' },
	'.cm-cell-insert-hit::before':                                   {
		content:    '""', position:   'absolute', left:       '0', right:      '0', top:        '50%', borderTop:  '1px solid var(--accent)',
		opacity:    '0', transition: 'opacity .18s ease-out'
	},
	'.cm-cell-insert-hit .cm-cell-add':                                                      { position: 'relative', opacity: '0', transform: 'scale(.6)', transition: 'opacity .18s ease-out, transform .18s cubic-bezier(.2, .8, .3, 1.2)' },
	'.cm-cell-insert-hit:hover::before, .cm-cell-insert-hit:focus-within::before':           { opacity: '.5' },
	'.cm-cell-insert-hit:hover .cm-cell-add, .cm-cell-insert-hit:focus-within .cm-cell-add': { opacity: '1', transform: 'scale(1)' },
	'@media (prefers-reduced-motion: reduce)':                                               { '.cm-cell-insert-hit .cm-cell-add, .cm-cell-insert-hit::before': { transition: 'none' } },
	'.cm-cell-add, .cm-cell-remove':                                                         {
		fontFamily:   'system-ui, sans-serif', fontSize:     '.68rem', lineHeight:   '1.5', cursor:       'pointer', color:        'var(--muted)',
		background:   'var(--panel)', border:       '1px solid var(--border)', borderRadius: '1rem', padding:      '0 .45rem'
	},
	'.cm-cell-add:hover':    { color: 'var(--accent)', borderColor: 'var(--accent)' },
	'.cm-cell-remove:hover': { color: '#d55e00', borderColor: '#d55e00' },
	'.cm-cell-took':         { fontFamily: 'system-ui, sans-serif', fontSize: '.68rem', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' },
	'.cm-cell-skipped':      {
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
	'.cm-cell-output':                         {
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
