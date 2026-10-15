/** R Markdown and Quarto as prose around R chunks, Jupyter as R scripts in the percent format (`# %%`), every line kept where flowR sees it */
import { Decoration, EditorView, ViewPlugin, WidgetType, keymap, type DecorationSet, type ViewUpdate } from '@codemirror/view';
import { Prec, type EditorState, type Extension, type Range } from '@codemirror/state';
import { StreamLanguage, type StreamParser, type StringStream } from '@codemirror/language';
import { r } from '@codemirror/legacy-modes/mode/r';
import { yaml } from '@codemirror/legacy-modes/mode/yaml';
import type { INotebookContent } from '@jupyterlab/nbformat';
import { globalChunkOptions, isExecutableCell, parseRMarkdownFile, RTagRegex } from '../../src/project/plugins/file-plugins/files/flowr-rmarkdown-file';
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
	readonly kind:  'code' | 'text' | 'meta'
	readonly head?: number
	readonly from:  number
	readonly to:    number
	readonly tail?: number
	readonly runs:  boolean
	readonly label: string
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
		cells.push({ kind: 'code', head: from - 1, from, to, tail: Fence.test(rows[to] ?? '') ? to + 1 : undefined, runs: isExecutableCell(block, defaults), label: block.options.get('label') ?? chunkName(block.header) });
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

/** runs a cell in the R session the cells share */
export type CellRunner = (code: string, title: string) => void;

const titleOf = (cell: Cell, cells: readonly Cell[]) => cell.label || `cell ${cells.filter(c => c.kind === 'code').indexOf(cell) + 1}`;

function runCell(state: EditorState, cell: Cell, cells: readonly Cell[], run: CellRunner): void {
	const code = cell.from > cell.to ? '' : state.sliceDoc(state.doc.line(cell.from).from, state.doc.line(cell.to).to);
	run(code, titleOf(cell, cells));
}

class RunButton extends WidgetType {
	constructor(readonly cell: Cell, readonly markdown: boolean, readonly run: CellRunner) {
		super();
	}
	eq(other: RunButton): boolean {
		return other.cell.from === this.cell.from && other.cell.to === this.cell.to && other.cell.label === this.cell.label && other.cell.runs === this.cell.runs;
	}
	toDOM(view: EditorView): HTMLElement {
		const tools = el('span', 'cm-cell-tools');
		const note = this.cell.runs ? this.cell.label : 'not run';
		if(note !== '') {
			tools.append(el('span', 'cm-cell-note', note));
		}
		const button = el('button', 'cm-cell-run', 'run');
		/* the Run button's own icon, badge and all: a cell always runs in the session that runs keep */
		const icon = document.querySelector('#runrgo .runicon')?.cloneNode(true);
		if(icon) {
			button.prepend(icon);
		}
		button.type = 'button';
		button.title = 'run this cell in the same R session as runs and the repl (shift+enter)';
		button.addEventListener('mousedown', event => event.preventDefault());
		button.addEventListener('click', () => {
			const cells = cellsOf(view.state, this.markdown);
			const now = cells.find(c => c.head === this.cell.head) ?? this.cell;
			runCell(view.state, now, cells, this.run);
		});
		tools.append(button);
		return tools;
	}
	ignoreEvent(): boolean {
		return true;
	}
}

function decorate(view: EditorView, markdown: boolean, run: CellRunner): DecorationSet {
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
		const note = cell.kind === 'meta' ? cell.label : cell.kind === 'text' ? 'markdown' : undefined;
		if(cell.head !== undefined) {
			at(cell.head, lineDeco(`${kind} cm-cell-head`, note));
			inCell.add(cell.head);
			if(cell.kind === 'code' && cell.head <= doc.lines) {
				found.push(Decoration.widget({ widget: new RunButton(cell, markdown, run), side: 1 }).range(doc.line(cell.head).to));
			}
		}
		for(let line = cell.from; line <= cell.to; line++) {
			at(line, lineDeco(`${kind}${line === cell.to && cell.tail === undefined ? ' cm-cell-end' : ''}`));
			inCell.add(line);
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
	return [
		ViewPlugin.fromClass(class {
			decorations: DecorationSet;
			constructor(view: EditorView) {
				this.decorations = decorate(view, markdown, run);
			}
			update(update: ViewUpdate) {
				if(update.docChanged) {
					this.decorations = decorate(update.view, markdown, run);
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
				runCell(view.state, cell, cells, run);
				return true;
			}
		}])),
		cellLook
	];
}

const cellLook = EditorView.theme({
	'.cm-cell': {
		backgroundColor: 'color-mix(in srgb, var(--accent) 5%, var(--bg))',
		boxShadow:       'inset 3px 0 0 color-mix(in srgb, var(--accent) 55%, transparent)'
	},
	'.cm-cell-text':                                  { backgroundColor: 'transparent', boxShadow: 'inset 3px 0 0 var(--border)' },
	'.cm-cell-meta':                                  { backgroundColor: 'var(--sunk)', boxShadow: 'inset 3px 0 0 var(--border)' },
	'.cm-cell-off':                                   { backgroundColor: 'transparent', boxShadow: 'inset 3px 0 0 var(--border)', opacity: '.6' },
	'.cm-cell-head':                                  { borderTop: '1px solid var(--border)', fontSize: '.85em' },
	'.cm-cell-tail':                                  { fontSize: '.85em' },
	'.cm-cell-end':                                   { borderBottom: '1px solid var(--border)' },
	'.cm-cell-tools':                                 { float: 'right', display: 'inline-flex', alignItems: 'center', gap: '.5rem', margin: '0 .5rem 0 .75rem' },
	'.cm-cell-note, .cm-cell-head[data-note]::after': {
		fontFamily:    'system-ui, sans-serif',
		fontSize:      '.7rem',
		color:         'var(--muted)',
		letterSpacing: '.04em',
		textTransform: 'uppercase'
	},
	'.cm-cell-head[data-note]::after': { content: 'attr(data-note)', float: 'right', marginRight: '.5rem' },
	'.cm-cell-run':                    {
		display:         'inline-flex',
		alignItems:      'center',
		gap:             '.3rem',
		padding:         '0 .5rem',
		cursor:          'pointer',
		lineHeight:      '1.4',
		fontFamily:      'system-ui, sans-serif',
		fontSize:        '.7rem',
		fontWeight:      '600',
		letterSpacing:   '.04em',
		textTransform:   'uppercase',
		color:           'var(--accent-fg)',
		backgroundColor: 'var(--accent)',
		border:          '0',
		borderRadius:    '1rem'
	},
	'.cm-cell-run .runicon':                       { width: '.65rem', height: '.65rem' },
	'.cm-cell-run:hover':                          { filter: 'brightness(1.1)' },
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
