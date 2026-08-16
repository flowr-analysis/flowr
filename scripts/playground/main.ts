/**
 * The playground: a CodeMirror editor on the left, and on the right what flowR makes of it, all in
 * the browser. The wasm rides along inside this bundle, so the page fetches nothing.
 */
import { EditorView, basicSetup } from 'codemirror';
import { Decoration, hoverTooltip, ViewPlugin, type DecorationSet, type ViewUpdate } from '@codemirror/view';
import { StateEffect, StateField } from '@codemirror/state';
import { autocompletion, type CompletionContext, type CompletionResult } from '@codemirror/autocomplete';
import { HighlightStyle, StreamLanguage, syntaxHighlighting } from '@codemirror/language';
import { highlightCode, tags } from '@lezer/highlight';
import { r } from '@codemirror/legacy-modes/mode/r';
import { json } from '@codemirror/legacy-modes/mode/javascript';
import { FlowrConfig } from '../../src/config';
import { TreeSitterExecutor } from '../../src/r-bridge/lang-4.x/tree-sitter/tree-sitter-executor';
import { FlowrAnalyzerBuilder } from '../../src/project/flowr-analyzer-builder';
import { stringifyValue } from '../../src/dataflow/eval/values/r-value';
import { LintingRules } from '../../src/linter/linter-rules';
import { LintingPrettyPrintContext } from '../../src/linter/linter-format';
import { DefaultBuiltinConfig } from '../../src/dataflow/environments/default-builtin-config';
import { Identifier } from '../../src/dataflow/environments/identifier';
import { CallProp } from '../../src/dataflow/environments/built-in-props';
import { SliceDirection } from '../../src/util/slice-direction';
import { DataflowMermaid } from '../../src/util/mermaid/dfg';
import { cfgToMermaid } from '../../src/util/mermaid/cfg';
import { normalizedAstToMermaid } from '../../src/util/mermaid/ast';
import treeSitterWasm from '../../node_modules/web-tree-sitter/tree-sitter.wasm';
import rWasm from '../../node_modules/@davisvaughan/tree-sitter-r/tree-sitter-r.wasm';

const Sample = [
	'library(dplyr)',
	'',
	'scale_to_max <- function(x) x / max(x)',
	'',
	'raw     <- data.frame(id = 1:6, value = c(3, 8, 7, 2, 9, 4))',
	'clean   <- filter(raw, value > 2)',
	'clean$scaled <- scale_to_max(clean$value)',
	'',
	'summary_stats <- summarise(clean, mean = mean(scaled))',
	'unused_total  <- sum(raw$value)',
	'',
	'write.csv(summary_stats, "summary.csv")',
	'plot(clean$scaled)',
	'points(clean$id)'
].join('\n');

const panel = document.getElementById('panel') as HTMLElement;

/** how long the last analysis took, next to what it found */
function showTook(text: string): void {
	const at = document.getElementById('took');
	if(at !== null) {
		at.textContent = text;
	}
}

/* what the linter found, and which lines a slice keeps: both replaced after every analysis */
const setLints = StateEffect.define<readonly { from: number, to: number, message: string }[]>();
const setSlice = StateEffect.define<readonly number[] | undefined>();
const setLinked = StateEffect.define<readonly number[] | undefined>();

/** the lines the panel row under the pointer stands for, lit up in the code */
const linkMarks = StateField.define<DecorationSet>({
	create: () => Decoration.none,
	update(marks, tr) {
		marks = marks.map(tr.changes);
		for(const effect of tr.effects) {
			if(effect.is(setLinked)) {
				const lines = (effect.value ?? []).filter(l => l >= 1 && l <= tr.state.doc.lines).sort((a, b) => a - b);
				marks = lines.length === 0 ? Decoration.none : Decoration.set(lines.map(l => {
					const doc = tr.state.doc.line(l);
					return Decoration.line({ class: 'cm-linked' }).range(doc.from);
				}), true);
			}
		}
		return marks;
	},
	provide: field => EditorView.decorations.from(field)
});

/** lights up the lines a panel row stands for, and the row itself, while the pointer rests on it */
function linkRow(cells: readonly HTMLElement[], lines: readonly (number | undefined)[]): readonly HTMLElement[] {
	const at = lines.filter((l): l is number => l !== undefined);
	if(at.length === 0) {
		return cells;
	}
	for(const cell of cells) {
		cell.classList.add('linked');
		cell.addEventListener('mouseenter', () => {
			for(const other of cells) {
				other.classList.add('hot');
			}
			editor.dispatch({ effects: setLinked.of(at) });
		});
		cell.addEventListener('mouseleave', () => {
			for(const other of cells) {
				other.classList.remove('hot');
			}
			editor.dispatch({ effects: setLinked.of(undefined) });
		});
	}
	return cells;
}

const lintMarks = StateField.define<DecorationSet>({
	create: () => Decoration.none,
	update(marks, tr) {
		marks = marks.map(tr.changes);
		for(const effect of tr.effects) {
			if(effect.is(setLints)) {
				marks = Decoration.set(effect.value.map(l => Decoration.mark({
					class:      'cm-lint',
					attributes: { title: l.message }
				}).range(l.from, l.to)), true);
			}
		}
		return marks;
	},
	provide: field => EditorView.decorations.from(field)
});

/** lines outside the current slice step back, so what is left reads as the answer */
const sliceMarks = StateField.define<DecorationSet>({
	create: () => Decoration.none,
	update(marks, tr) {
		marks = marks.map(tr.changes);
		for(const effect of tr.effects) {
			if(effect.is(setSlice)) {
				const kept = effect.value;
				marks = kept === undefined ? Decoration.none : Decoration.set(
					Array.from({ length: tr.state.doc.lines }, (_, i) => i + 1)
						.filter(line => !kept.includes(line) && tr.state.doc.line(line).text.trim().length > 0)
						.map(line => Decoration.line({ class: 'cm-outside' }).range(tr.state.doc.line(line).from)),
					true);
			}
		}
		return marks;
	},
	provide: field => EditorView.decorations.from(field)
});

/* CodeMirror ships a light theme of its own; these are the page's own colours, so both modes match */
const look = EditorView.theme({
	'&':                                    { color: 'var(--fg)', backgroundColor: 'var(--bg)', height: '100%' },
	'.cm-content':                          { caretColor: 'var(--fg)' },
	'.cm-cursor, .cm-dropCursor':           { borderLeftColor: 'var(--fg)' },
	'.cm-gutters':                          { backgroundColor: 'var(--sunk)', color: 'var(--muted)', border: 'none', borderRight: '1px solid var(--border)' },
	'.cm-activeLine':                       { backgroundColor: 'color-mix(in srgb, var(--accent) 8%, transparent)' },
	'.cm-activeLineGutter':                 { backgroundColor: 'color-mix(in srgb, var(--accent) 14%, transparent)', color: 'var(--fg)' },
	'.cm-selectionBackground, ::selection': { backgroundColor: 'color-mix(in srgb, var(--accent) 25%, transparent)' },
	'&.cm-focused .cm-selectionBackground': { backgroundColor: 'color-mix(in srgb, var(--accent) 30%, transparent)' },
	'.cm-tooltip':                          { border: '1px solid var(--border)', backgroundColor: 'var(--panel)', color: 'var(--fg)' }
});

const highlight = HighlightStyle.define([
	{ tag: tags.keyword, color: '#b07d00' },
	{ tag: [tags.string, tags.special(tags.string)], color: '#0f766e' },
	/* the R mode calls `library`, `data.frame` and the rest standard names, which is what a call is here */
	{ tag: [tags.function(tags.variableName), tags.standard(tags.variableName), tags.labelName], color: 'var(--fg)', fontWeight: '600' },
	{ tag: [tags.number, tags.bool, tags.null, tags.atom], color: '#0072b2' },
	{ tag: tags.comment, color: 'var(--muted)', fontStyle: 'italic' },
	{ tag: [tags.operator, tags.punctuation, tags.bracket], color: 'var(--muted)' }
]);

const rLanguage = StreamLanguage.define(r);

/** the same colours the editor uses, for code the panel shows rather than edits */
function paint(code: string, into: HTMLElement): void {
	let at = 0;
	const put = (text: string, classes: string): void => {
		const span = document.createElement('span');
		if(classes.length > 0) {
			span.className = classes;
		}
		span.textContent = text;
		into.append(span);
	};
	highlightCode(code, rLanguage.parser.parse(code), highlight, (text, classes) => {
		/* the mode hands out whole unstyled runs, and a call name inside one is marked like in the editor */
		let cursor = 0;
		for(const found of text.matchAll(/[A-Za-z.][\w._]*/g)) {
			const start = found.index;
			if(start === undefined || Keywords.has(found[0]) || !/^\s*\(/.test(code.slice(at + start + found[0].length))) {
				continue;
			}
			if(start > cursor) {
				put(text.slice(cursor, start), classes);
			}
			put(found[0], [classes, 'cm-call'].filter(c => c.length > 0).join(' '));
			cursor = start + found[0].length;
		}
		if(cursor < text.length) {
			put(text.slice(cursor), classes);
		}
		at += text.length;
	}, () => {
		into.append('\n');
		at += 1;
	});
}

/** a call whose name the R mode does not know, so `scale_to_max(...)` reads like `filter(...)` */
const Keywords = new Set(['function', 'if', 'else', 'for', 'while', 'repeat', 'return', 'break', 'next', 'in']);
const callMarks = ViewPlugin.fromClass(class {
	decorations: DecorationSet;
	constructor(view: EditorView) {
		this.decorations = this.find(view);
	}
	update(update: ViewUpdate) {
		if(update.docChanged || update.viewportChanged) {
			this.decorations = this.find(update.view);
		}
	}
	find(view: EditorView): DecorationSet {
		const marks = [];
		for(const { from, to } of view.visibleRanges) {
			const text = view.state.doc.sliceString(from, to);
			for(const found of text.matchAll(/[A-Za-z.][\w._]*(?=\s*\()/g)) {
				if(found.index !== undefined && !Keywords.has(found[0])) {
					marks.push(Decoration.mark({ class: 'cm-call' }).range(from + found.index, from + found.index + found[0].length));
				}
			}
		}
		return Decoration.set(marks, true);
	}
}, { decorations: v => v.decorations });

/** the name around an offset in a line, which is what every question here is asked about */
function nameAt(text: string, at: number): { name: string, from: number, to: number } | undefined {
	const isName = (c: string | undefined): boolean => c !== undefined && /[\w._]/.test(c);
	let i = at;
	if(!isName(text[i]) && isName(text[i - 1])) {
		i--;
	}
	if(!isName(text[i])) {
		return undefined;
	}
	let from = i, to = i;
	while(from > 0 && isName(text[from - 1])) {
		from--;
	}
	while(to + 1 < text.length && isName(text[to + 1])) {
		to++;
	}
	const name = text.slice(from, to + 1);
	return /^[A-Za-z.]/.test(name) ? { name, from, to: to + 1 } : undefined;
}

/**
 * What one spot in the text asks about. `scaled` in `clean$scaled` is a field, and on its own it means
 * nothing: the access is the thing, so the criterion moves to the `$` and covers `clean$scaled`.
 */
function targetAt(text: string, number: number, at: number): { criterion: string, name: string, from: number, to: number } | undefined {
	const found = nameAt(text, at);
	if(found === undefined) {
		return undefined;
	}
	let start = found.from, operator: number | undefined;
	while(start > 1 && (text[start - 1] === '$' || text[start - 1] === '@')) {
		const before = nameAt(text, start - 2);
		if(before === undefined || before.to !== start - 1) {
			break;
		}
		operator = start - 1;
		start = before.from;
	}
	return operator === undefined
		? { criterion: `${number}@${found.name}`, name: found.name, from: found.from, to: found.to }
		: { criterion: `${number}:${operator + 1}`, name: text.slice(start, found.to), from: start, to: found.to };
}

/** what flowR can say about the name under the pointer: its value, its shape, or where it comes from */
const valueTips = hoverTooltip(async(view, pos) => {
	const line = view.state.doc.lineAt(pos);
	const found = targetAt(line.text, line.number, pos - line.from);
	if(found === undefined) {
		return null;
	}
	const criterion = found.criterion;
	const about = await describe(criterion);
	const said = about.said;
	const known = about.local ? undefined : signatureOf(found.name, ownerOf(found.name, about.pkg));
	showPointed(found.name, said);
	showSignature(found.name, known);
	return said === undefined && known === undefined ? null : {
		pos:    line.from + found.from,
		end:    line.from + found.to,
		above:  true,
		create: () => ({ dom: tip(known, said) })
	};
});

/**
 * The packages flowR carries a definition for, per name. Without the signature database this page
 * cannot see what `library(dplyr)` really exports, but flowR's own definitions know that `filter`
 * is dplyr's once dplyr is attached.
 */
const definedIn = new Map<string, string[]>();
for(const definition of DefaultBuiltinConfig) {
	for(const id of definition.names) {
		const namespace = Identifier.getNamespace(id);
		if(namespace !== undefined) {
			const name = String(Identifier.getName(id));
			definedIn.set(name, [...definedIn.get(name) ?? [], String(namespace)]);
		}
	}
}

/** flowR's own definitions, for the primitives (`sum`, `max`, `c`) the database cannot describe */
const builtins = new Map<string, Signature>();
for(const definition of DefaultBuiltinConfig) {
	const config = (definition as { config?: { props?: number, sig?: [string, number][] } }).config;
	for(const id of definition.names) {
		const name = String(Identifier.getName(id));
		if(builtins.has(name)) {
			continue;
		}
		const namespace = Identifier.getNamespace(id);
		const params = (config?.sig ?? []).map(([param]) => param).join(', ');
		builtins.set(name, {
			call:  `${namespace === undefined ? 'base' : String(namespace)}::${name}(${params})`,
			props: propsOf(config?.props ?? 0),
			where: ''
		});
	}
}

/** the properties flowR states for a call, as words rather than as a bit mask */
function propsOf(props: number): string {
	const names: [number, string][] = [
		[CallProp.Pure, 'pure'], [CallProp.Throws, 'can throw'], [CallProp.Invisible, 'invisible'],
		[CallProp.Generic, 'generic'], [CallProp.Method, 's3 method'], [CallProp.Scope, 'changes scope'],
		[CallProp.NonDet, 'non deterministic'], [CallProp.Random, 'random'], [CallProp.Ambient, 'ambient state'],
		[CallProp.File, 'file system'], [CallProp.Reads, 'reads'], [CallProp.Writes, 'writes'],
		[CallProp.Network, 'network'], [CallProp.Prints, 'prints']
	];
	return names.filter(([bit]) => (props & bit) !== 0).map(([, word]) => word).join(' ');
}

/** the packages the script attaches, which is what decides who owns a name */
let attached = new Set<string>();

/** the package a call belongs to here: an attached one that defines the name wins over base R */
function ownerOf(name: string, resolved: string | undefined): string | undefined {
	return resolved ?? (definedIn.get(name) ?? []).find(pkg => attached.has(pkg));
}

/**
 * What the signature database says about a base R function: its parameters, what flowR noticed about
 * it, and where it is defined. Parsed from the block the build put into the page, on first use.
 */
let signatures: Map<string, string[]> | undefined;
interface Signature { call: string, props: string, where: string, source?: string, docs?: string }
function signatureOf(name: string, pkg?: string): Signature | undefined {
	if(signatures === undefined) {
		signatures = new Map();
		for(const row of (document.getElementById('sigs')?.textContent ?? '').split('\n')) {
			const cells = row.split('\t');
			if(cells.length === 7 && !signatures.has(cells[0])) {
				signatures.set(cells[0], cells);
			}
		}
	}
	const found = signatures.get(name);
	if(found === undefined || (pkg !== undefined && pkg !== found[1])) {
		/* a primitive has no source to point at, but flowR still states what it does */
		const own = builtins.get(name);
		if(found === undefined && own !== undefined && (pkg === undefined || own.call.startsWith(`${pkg}::`))) {
			return own;
		}
		/* the call belongs to a package this page does not carry: name it and point at the database */
		return pkg === undefined ? undefined : { call: `${pkg}::${name}`, props: '', where: '' };
	}
	return {
		call:   `${found[1]}::${found[0]}(${found[2]})`,
		props:  found[3],
		where:  found[4],
		source: found[5].length > 0 ? found[5] : undefined,
		docs:   found[6].length > 0 ? found[6] : undefined
	};
}

/** a plain outward link, in the same shape as the little labels around it */
function link(text: string, href: string, cls: string): HTMLElement {
	const at = document.createElement('a');
	at.className = cls;
	at.textContent = text;
	at.href = href;
	at.target = '_blank';
	at.rel = 'noopener';
	return at;
}

/** what flowR's signature database says about the name, kept below the findings */
function showSignature(name: string, known: ReturnType<typeof signatureOf>): void {
	const at = document.getElementById('signature');
	if(at === null) {
		return;
	}
	at.replaceChildren();
	at.hidden = known === undefined;
	if(known === undefined) {
		return;
	}
	const head = document.createElement('h3');
	head.textContent = 'Signature';
	const call = document.createElement('div');
	call.className = 'scall';
	call.textContent = known.call;
	const about = document.createElement('div');
	about.className = 'sabout';
	for(const prop of known.props.split(' ').filter(p => p.length > 0)) {
		about.append(tag(prop.replace(/-/g, ' '), 'prop'));
	}
	if(known.where.length > 0) {
		about.append(known.source === undefined ? tag(known.where, 'at') : link(known.where, known.source, 'at'));
	}
	if(known.docs !== undefined) {
		about.append(link('documentation', known.docs, 'at'));
	}
	if(known.props.length === 0 && known.where.length === 0) {
		about.append(link('look it up in the signature database', `../sigdb/?q=${encodeURIComponent(name)}`, 'at'));
	}
	at.append(head, call, about);
}

/** the hover card: what the database knows about the name, then what flowR made of this script */
function tip(known: ReturnType<typeof signatureOf>, said: string | undefined): HTMLElement {
	const dom = document.createElement('div');
	dom.className = 'cm-valuetip';
	const line = (text: string, cls: string): void => {
		const at = document.createElement('div');
		at.className = cls;
		at.textContent = text;
		dom.append(at);
	};
	if(known !== undefined) {
		line(known.call, 'tcall');
		const about = [known.props.split(' ').filter(p => p.length > 0).map(p => p.replace(/-/g, ' ')).join(' · '), known.where]
			.filter(text => text.length > 0).join(' · ');
		if(about.length > 0) {
			line(about, 'tabout');
		}
	}
	if(said !== undefined) {
		line(said, 'tsaid');
	}
	return dom;
}

/** what the pointer is on, kept in the panel next to everything else */
function showPointed(name: string, said: string | undefined): void {
	const at = document.getElementById('pinfo');
	if(at === null) {
		return;
	}
	at.replaceChildren();
	const label = document.createElement('a');
	label.className = 'pname';
	label.textContent = name;
	label.href = `../sigdb/?q=${encodeURIComponent(name.split('$').pop() ?? name)}`;
	label.target = '_blank';
	label.rel = 'noopener';
	label.title = 'look this name up in the signature database';
	const value = document.createElement('span');
	value.className = 'pvalue';
	value.textContent = said ?? 'nothing known about it';
	at.append(label, value);
}

/** the names flowR knows without any package, offered alongside whatever the script defines */
const builtInNames = [...new Set(DefaultBuiltinConfig.flatMap(d => d.names.map(id => String(Identifier.getName(id)))))]
	.filter(n => /^[A-Za-z.][\w._]*$/.test(n));

function complete(context: CompletionContext): CompletionResult | null {
	const word = context.matchBefore(/[\w._]+/);
	if(word === null || (word.from === word.to && !context.explicit)) {
		return null;
	}
	const defined = [...new Set([...context.state.doc.toString().matchAll(/([A-Za-z.][\w._]*)\s*(?:<-|=(?!=))/g)].map(m => m[1]))];
	return {
		from:    word.from,
		options: [
			...defined.map(label => ({ label, type: 'variable', detail: 'in this script' })),
			...builtInNames.map(label => ({ label, type: 'function', detail: 'flowR built-in' }))
		]
	};
}

/**
 * Every key of the configuration document with the path it sits at, so the pointer can ask the schema
 * what a key means. A small scanner rather than a parse: it also works while the text is broken.
 */
function keyPaths(text: string): { from: number, to: number, path: string[] }[] {
	const found: { from: number, to: number, path: string[] }[] = [];
	const stack: string[] = [];
	let current: string | undefined;
	for(let at = 0; at < text.length; at++) {
		const char = text[at];
		if(char === '"') {
			const start = at++;
			while(at < text.length && text[at] !== '"') {
				at += text[at] === '\\' ? 2 : 1;
			}
			const name = text.slice(start + 1, at);
			const after = /^\s*:/.test(text.slice(at + 1));
			if(after) {
				current = name;
				found.push({ from: start, to: at + 1, path: [...stack, name] });
			}
		} else if(char === '{' || char === '[') {
			stack.push(current ?? '');
			current = undefined;
		} else if(char === '}' || char === ']') {
			stack.pop();
		}
	}
	return found.map(entry => ({ ...entry, path: entry.path.filter(part => part.length > 0) }));
}

/** what the schema says about every configuration key, written into the page by the build */
let cfgDocs: Record<string, { t?: string, d?: string, v?: string[] }> | undefined;
function configDocs(): Record<string, { t?: string, d?: string, v?: string[] }> {
	cfgDocs ??= JSON.parse(document.getElementById('cfgdocs')?.textContent || '{}') as Record<string, { t?: string, d?: string, v?: string[] }>;
	return cfgDocs;
}

/** what the schema says about the configuration key under the pointer */
const configTips = hoverTooltip((view, pos) => {
	const text = view.state.doc.toString();
	const key = keyPaths(text).find(entry => pos >= entry.from && pos <= entry.to);
	if(key === undefined) {
		return null;
	}
	/* Joi's browser build refuses `describe()`, so the build wrote the schema's answers into the page */
	const info = configDocs()[key.path.join('.')];
	if(info === undefined) {
		return null;
	}
	const said = [info.d, info.v && info.v.length > 0 ? `one of ${info.v.map(v => JSON.stringify(v)).join(', ')}` : undefined]
		.filter(Boolean).join(' · ');
	if(said.length === 0 && info.t === undefined) {
		return null;
	}
	return {
		pos:    key.from,
		end:    key.to,
		above:  true,
		create: () => {
			const dom = document.createElement('div');
			dom.className = 'cm-valuetip';
			const head = document.createElement('div');
			head.className = 'tcall';
			head.textContent = `${key.path.join('.')}${info.t === undefined ? '' : `: ${info.t}`}`;
			dom.append(head);
			if(said.length > 0) {
				const rest = document.createElement('div');
				rest.className = 'tabout';
				rest.textContent = said;
				dom.append(rest);
			}
			return { dom };
		}
	};
});

/* the configuration flowR runs with, as JSON: invalid text keeps the last one that worked */
let settings: ReturnType<typeof FlowrConfig.parse>;
const note = document.getElementById('confignote');

function readSettings(): void {
	const text = config.state.doc.toString();
	const parsed = FlowrConfig.parse(text);
	if(parsed === undefined) {
		if(note !== null) {
			note.textContent = 'not a valid flowR configuration, keeping the last one';
			note.classList.add('bad');
		}
		return;
	}
	if(note !== null) {
		note.textContent = text === Defaults ? '' : 'edited';
		note.classList.remove('bad');
	}
	settings = parsed;
	void run();
}

const Defaults = JSON.stringify(FlowrConfig.default(), null, 2);
const config = new EditorView({
	doc:        Defaults,
	extensions: [
		basicSetup, StreamLanguage.define(json), look, syntaxHighlighting(highlight), configTips,
		EditorView.updateListener.of(update => {
			if(update.docChanged) {
				clearTimeout(configTimer);
				configTimer = window.setTimeout(readSettings, 600);
			}
		})
	],
	parent: document.getElementById('config') as HTMLElement
});
let configTimer = 0;

document.getElementById('configreset')?.addEventListener('click', () => {
	config.dispatch({ changes: { from: 0, to: config.state.doc.length, insert: Defaults } });
});

for(const tab of document.querySelectorAll('.tab')) {
	tab.addEventListener('click', () => {
		for(const other of document.querySelectorAll('.tab')) {
			const wanted = other === tab;
			other.setAttribute('aria-selected', String(wanted));
			const pane = document.getElementById(other.getAttribute('data-tab') ?? '');
			if(pane !== null) {
				pane.hidden = !wanted;
			}
			if(other.getAttribute('data-tab') === 'config') {
				/* the link and the reset only make sense next to the configuration */
				for(const id of ['confighelp', 'configreset']) {
					const at = document.getElementById(id);
					if(at !== null) {
						at.hidden = !wanted;
					}
				}
			}
		}
	});
}

const editor = new EditorView({
	doc:        Sample,
	extensions: [
		basicSetup, rLanguage, look, syntaxHighlighting(highlight), callMarks,
		lintMarks, sliceMarks, linkMarks, valueTips, autocompletion({ override: [complete] }),
		EditorView.updateListener.of(update => {
			if(update.docChanged) {
				schedule();
			} else if(update.selectionSet) {
				schedule(400);
			}
		})
	],
	parent: document.getElementById('editor') as HTMLElement
});

document.getElementById('theme')?.addEventListener('click', () => {
	const dark = matchMedia('(prefers-color-scheme: dark)').matches;
	const next = (document.documentElement.dataset.theme || (dark ? 'dark' : 'light')) === 'dark' ? 'light' : 'dark';
	document.documentElement.dataset.theme = next;
	try {
		localStorage.setItem('flowr-theme', next);
	} catch{ /* private mode forgets the choice */ }
});

/** the name under the cursor, as the criterion flowR slices for; the first name on the line otherwise */
function cursorCriterion(): string | undefined {
	const at = editor.state.selection.main.head;
	const line = editor.state.doc.lineAt(at);
	const found = targetAt(line.text, line.number, at - line.from);
	if(found !== undefined) {
		return found.criterion;
	}
	const first = /[A-Za-z.][\w._]*/.exec(line.text);
	return first ? `${line.number}@${first[0]}` : undefined;
}

/** what the cursor is on, as a reader would write it: `clean$scaled` rather than `13:11` */
function cursorName(): string | undefined {
	const at = editor.state.selection.main.head;
	const line = editor.state.doc.lineAt(at);
	const found = targetAt(line.text, line.number, at - line.from);
	return found === undefined ? undefined : `${line.number}@${found.name}`;
}

function section(title: string): void {
	const head = document.createElement('h3');
	head.textContent = title;
	panel.append(head);
}

function row(...cells: (string | Node)[]): HTMLElement {
	const line = document.createElement('div');
	line.className = 'row';
	line.append(...cells);
	return line;
}

function tag(text: string, cls = 'kind'): HTMLElement {
	const el = document.createElement('span');
	el.className = cls;
	el.textContent = text;
	return el;
}

function nothing(text: string): HTMLElement {
	const el = document.createElement('p');
	el.className = 'empty';
	el.textContent = text;
	return el;
}

let ready: Promise<void> | undefined;
async function analyzer() {
	ready ??= TreeSitterExecutor.initTreeSitter(undefined, rWasm, treeSitterWasm);
	await ready;
	const builder = new FlowrAnalyzerBuilder().setParser(new TreeSitterExecutor());
	if(settings !== undefined) {
		builder.setConfig(settings);
	}
	const built = await builder.build();
	built.addRequest({ request: 'text', content: editor.state.doc.toString() });
	return built;
}

interface Dependency { value?: string, nodeId?: string | number, functionName?: string, linkedIds?: readonly (string | number)[] }
/** one dependency as the panel shows it, with whatever else was drawn onto it hanging below */
interface DepRow {
	kind:   string,
	call?:  string,
	value?: string,
	line?:  number,
	from?:  readonly number[],
	id?:    string | number,
	onto:   readonly (string | number)[],
	parts:  DepRow[]
}
interface Finding { loc?: number[] }

/** the first tag of a rule that says what kind of problem it is, which is what colours the chip */
function category(rule: string): string {
	const tags = (LintingRules as unknown as Record<string, { info?: { tags?: string[] } }>)[rule]?.info?.tags ?? [];
	return ['bug', 'security', 'reproducibility', 'robustness', 'deprecated', 'style', 'smell'].find(t => tags.includes(t)) ?? 'other';
}

/** the finding in the linter's own words, the same text the REPL and the extension show */
function explain(rule: string, finding: unknown, meta: unknown): string {
	const rules = LintingRules as unknown as Record<string, { prettyPrint: Record<string, (r: never, m: never) => string> }>;
	const print = rules[rule]?.prettyPrint;
	if(print === undefined) {
		return rule;
	}
	const say = print[LintingPrettyPrintContext.Full] ?? print[LintingPrettyPrintContext.Query];
	return say(finding as never, meta as never).replace(/\s+at \d+\.\d+(-\d+)?/g, '').trim();
}

/** a data frame shape as a sentence: `6 rows, 2 columns (id, value)` beats the raw intervals */
function shapeOf(domain: unknown): string | undefined {
	const d = domain as { colnames?: { must?: Set<string>, may?: Set<string>, isFinite?: () => boolean }, cols?: Bounds, rows?: Bounds };
	if(d?.cols === undefined || d.rows === undefined) {
		return undefined;
	}
	const count = (b: Bounds, what: string): string | undefined => {
		const { lower, upper } = b;
		if(typeof lower !== 'number' || typeof upper !== 'number') {
			return undefined;
		}
		if(lower === upper) {
			return `${lower} ${lower === 1 ? what : what + 's'}`;
		}
		return Number.isFinite(upper) ? `${lower} to ${upper} ${what}s` : lower > 0 ? `${lower}+ ${what}s` : undefined;
	};
	const named = [...d.colnames?.must ?? []];
	const more = (d.colnames?.may?.size ?? 0) > 0 || d.colnames?.isFinite?.() === false;
	const columns = named.length > 0 ? `${named.join(', ')}${more ? ', …' : ''}` : undefined;
	const size = [count(d.rows, 'row'), count(d.cols, 'column')].filter(Boolean).join(', ');
	const said = [size, columns === undefined ? undefined : `(${columns})`].filter(Boolean).join(' ');
	return said.length > 0 ? `data frame: ${said}` : undefined;
}
interface Bounds { lower?: number, upper?: number }

/** the value, the data frame shape, or where it comes from; asked once per name and remembered */
interface Known { said?: string, pkg?: string, local: boolean }
const described = new Map<string, Known>();
async function describe(criterion: string): Promise<Known> {
	const remembered = described.get(criterion);
	if(remembered !== undefined) {
		return remembered;
	}
	let answer: Known = { local: false };
	try {
		const built = await analyzer();
		const answers = await built.query([
			{ type: 'resolve-value', criteria: [criterion] },
			{ type: 'absint', inference: 'df-shape', criteria: [criterion] },
			{ type: 'origin', criterion }
		] as never) as unknown as {
			origin?:          { results?: Record<string, { id: string | number, proc?: string }[] | undefined> },
			'resolve-value'?: { results?: Record<string, { values?: Parameters<typeof stringifyValue>[0][] }> },
			absint?:          { result?: Map<string, unknown> }
		};
		const resolved = Object.values(answers['resolve-value']?.results ?? {})
			.flatMap(found => (found.values ?? []).map(v => stringifyValue(v).replace(/^\[(.*), \1\]$/, '$1').replace(/(\d)L\b/g, '$1')))
			.filter(v => v.length > 0 && !/^(top|⊤|⊥)$/.test(v));
		const shape = answers.absint?.result instanceof Map
			? [...answers.absint.result.values()].map(d => shapeOf(d)).find(d => d !== undefined)
			: undefined;
		/* a value is the most useful answer, but every name has an origin, so that is the fallback */
		const origins = answers.origin?.results?.[criterion] ?? [];
		const from = [...new Set(await originLines(criterion, origins))];
		/* `filter` is dplyr's once dplyr is attached, and flowR says so: `built-in:dplyr:filter` */
		const attached = origins.map(o => /^built-in:([^:]+):/.exec(o.proc ?? '')?.[1]).find(p => p !== undefined);
		answer = {
			said: [shape, resolved.length > 0 ? resolved.join(', ') : undefined, from.length > 0 ? `from line ${from.join(', ')}` : undefined]
				.filter(Boolean).join(' · ') || undefined,
			pkg:   attached,
			local: origins.length > 0 && origins.every(o => o.proc === undefined)
		};
	} catch{ /* a name flowR cannot place */ }
	described.set(criterion, answer);
	return answer;
}

/** the lines an origin answer points at */
async function originLines(criterion: string, origins: { id: string | number }[] | undefined): Promise<number[]> {
	if(origins === undefined || origins.length === 0) {
		return [];
	}
	const idMap = (await analyzer()).normalize().then(n => n.idMap);
	const map = await idMap;
	return origins.map(o => map?.get(o.id as never)?.location?.[0]).filter((l): l is number => typeof l === 'number');
}

/** jumps to where the name under the cursor was defined */
async function jumpToDefinition(): Promise<void> {
	const criterion = cursorCriterion();
	if(criterion === undefined) {
		return;
	}
	const built = await analyzer();
	const answers = await built.query([{ type: 'origin', criterion }] as never) as unknown as
		{ origin?: { results?: Record<string, { id: string | number }[] | undefined> } };
	const lines = await originLines(criterion, answers.origin?.results?.[criterion]);
	const target = lines.find(l => l !== Number(/^\d+/.exec(criterion)?.[0]));
	if(target === undefined) {
		showTook(`no definition found for ${criterion}`);
		return;
	}
	const line = editor.state.doc.line(target);
	editor.dispatch({ selection: { anchor: line.from }, scrollIntoView: true });
	editor.focus();
}

/**
 * The graphs flowR builds on the way to its answers, handed to mermaid.live rather than drawn here:
 * the playground stays small, and the live editor can do more with them than a canvas ever would.
 */
const Views: Record<string, () => Promise<string>> = {
	dataflow: async() => DataflowMermaid.raw((await (await analyzer()).dataflow()).graph, false, undefined, true),
	cfg:      async() => {
		const built = await analyzer();
		return cfgToMermaid(await built.controlflow(), await built.normalize(), { simplify: true });
	},
	call: async() => {
		const built = await analyzer();
		const answer = await built.query([{ type: 'call-graph' }] as never) as unknown as { 'call-graph'?: { graph?: unknown } };
		return DataflowMermaid.raw(answer['call-graph']?.graph as never, false, undefined, true);
	},
	ast: async() => normalizedAstToMermaid((await (await analyzer()).normalize()).ast)
};

/** mermaid.live reads its state from the fragment, and `btoa` wants bytes rather than characters */
function liveUrl(code: string): string {
	const state = JSON.stringify({ code, mermaid: { autoSync: true } });
	const bytes = new TextEncoder().encode(state);
	let binary = '';
	for(const byte of bytes) {
		binary += String.fromCharCode(byte);
	}
	return `https://mermaid.live/edit#base64:${btoa(binary)}`;
}

for(const button of document.querySelectorAll('[data-view]')) {
	button.addEventListener('click', () => {
		const which = button.getAttribute('data-view') ?? '';
		/* the tab has to open on the click itself, or the browser takes it for a popup */
		const tab = window.open('', '_blank');
		showTook(`building the ${button.textContent ?? which}…`);
		void Views[which]?.().then(code => {
			const url = liveUrl(code);
			if(tab === null) {
				location.href = url;
			} else {
				tab.location.href = url;
			}
			showTook(`opened the ${button.textContent ?? which} in mermaid.live`);
		}, error => {
			tab?.close();
			showTook(`that did not work: ${String(error)}`);
		});
	});
}

/** everything the panel shows, from one analysis of the current text */
async function analyze(): Promise<number> {
	const started = performance.now();
	const criterion = cursorCriterion();
	const asked = cursorName();
	const built = await analyzer();
	const normalized = await built.normalize();
	const idMap = normalized.idMap;
	const answers = await built.query([
		{ type: 'dependencies' },
		{ type: 'linter' },
		...(criterion ? [{ type: 'static-slice', criteria: [criterion], includeCallees: true, direction }] : [])
	] as never) as unknown as {
		dependencies?:   Record<string, readonly Dependency[]>,
		linter?:         { results?: Record<string, { results?: Finding[], '.meta'?: object }> },
		'static-slice'?: { results?: Record<string, { reconstruct?: { code?: string }, slice?: { result?: Iterable<string | number> } }> }
	};
	const took = performance.now() - started;

	panel.replaceChildren();

	const sliced = Object.values(answers['static-slice']?.results ?? {})[0];
	const code = sliced?.reconstruct?.code;
	const keptLines = [...new Set([...(sliced?.slice?.result ?? [])]
		.map(id => idMap?.get(id as never)?.location?.[0])
		.filter((l): l is number => typeof l === 'number'))];
	lastKept = keptLines;
	editor.dispatch({ effects: setSlice.of(dimOutside && keptLines.length > 0 ? keptLines : undefined) });

	const head = document.createElement('h3');
	head.textContent = asked === undefined ? 'Program slice' : `Program slice · ${asked}`;
	const way = document.createElement('select');
	way.className = 'way';
	way.title = 'origin: what this value is built from. impact: what depends on it';
	for(const [value, label] of [[SliceDirection.Backward, 'origin (backward)'], [SliceDirection.Forward, 'impact (forward)']] as const) {
		const option = document.createElement('option');
		option.value = value;
		option.textContent = label;
		option.selected = value === direction;
		way.append(option);
	}
	way.addEventListener('change', () => {
		direction = way.value as SliceDirection;
		void run();
	});
	head.append(way);
	const dimmer = document.createElement('label');
	dimmer.className = 'toggle';
	const box = document.createElement('input');
	box.type = 'checkbox';
	box.checked = dimOutside;
	box.addEventListener('change', () => {
		dimOutside = box.checked;
		editor.dispatch({ effects: setSlice.of(dimOutside && lastKept.length > 0 ? lastKept : undefined) });
	});
	dimmer.append(box, document.createTextNode('dim the rest'));
	head.append(dimmer);
	panel.append(head);
	if(code !== undefined) {
		const copy = document.createElement('button');
		copy.type = 'button';
		copy.className = 'copy';
		copy.textContent = 'copy';
		copy.addEventListener('click', () => {
			void navigator.clipboard?.writeText(code).then(() => {
				copy.textContent = 'copied';
				setTimeout(() => copy.textContent = 'copy', 1200);
			});
		});
		head.append(copy);
	}
	const slice = document.createElement('div');
	slice.className = 'card';
	const shown = document.createElement('pre');
	if(code === undefined) {
		shown.textContent = 'put the cursor on a name to slice for it';
	} else {
		paint(code, shown);
	}
	slice.append(shown);
	/* a long slice is folded, because the panel is not where someone reads a whole script */
	if((code?.split('\n').length ?? 0) > 20) {
		slice.classList.add('folded');
		const more = document.createElement('button');
		more.type = 'button';
		more.className = 'unfold';
		more.textContent = 'show the whole slice';
		more.addEventListener('click', () => {
			slice.classList.remove('folded');
			more.remove();
		});
		slice.append(more);
	}
	panel.append(slice);

	const kinds = ['library', 'source', 'read', 'write', 'visualize'] as const;
	const deps: DepRow[] = kinds.flatMap(kind => (answers.dependencies?.[kind] ?? []).map(entry => {
		const at = idMap?.get(entry.nodeId as never)?.location;
		const call = entry.functionName === undefined ? undefined : String(Identifier.getName(entry.functionName));
		const value = entry.value === undefined || entry.value === 'unknown' ? undefined : entry.value;
		return { kind, call, value, line: at?.[0], from: at, id: entry.nodeId, onto: entry.linkedIds ?? [], parts: [] };
	}));
	/* `points()` draws onto the `plot()` above it, and the query says so: such an entry belongs to that
	   plot rather than next to it */
	const byId = new Map(deps.map(d => [String(d.id), d]));
	const top = deps.filter(d => {
		const onto = d.onto.map(id => byId.get(String(id))).find(other => other !== undefined && other !== d);
		onto?.parts.push(d);
		return onto === undefined;
	});
	attached = new Set(deps.filter(d => d.kind === 'library' && d.value !== undefined).map(d => d.value as string));
	section(`Dependencies: ${deps.length}`);
	const shownDep = (d: DepRow, part: boolean): HTMLElement => {
		const what = document.createElement('span');
		what.className = 'what';
		if(d.value !== undefined) {
			what.append(d.value);
		}
		if(d.call !== undefined) {
			what.append(tag(`${d.call}()`, d.value === undefined ? 'call only' : 'call'));
		}
		const kind = tag(part ? 'draws onto' : d.kind, part ? 'kind part' : 'kind');
		const line = row(kind, what, tag(d.line ? `L${d.line}` : '', 'at'));
		if(part) {
			line.classList.add('part');
		}
		linkRow([line], [d.line, ...(part ? [] : d.parts.map(p => p.line))]);
		if(d.from !== undefined) {
			line.title = 'slice for this';
			line.addEventListener('click', () => {
				const at = d.from?.[0] ?? 0;
				if(at < 1 || at > editor.state.doc.lines) {
					return;   // a dependency of another file in the project
				}
				const doc = editor.state.doc.line(at);
				editor.dispatch({ selection: { anchor: doc.from + ((d.from?.[1] as number) - 1) }, scrollIntoView: true });
				void run();
			});
		}
		return line;
	};
	panel.append(...(deps.length > 0
		? top.flatMap(d => [shownDep(d, false), ...d.parts.map(p => shownDep(p, true))])
		: [nothing('nothing outside this script')]));

	const found = Object.entries(answers.linter?.results ?? {}).flatMap(([rule, per]) =>
		(per?.results ?? []).map(f => ({ rule, line: f.loc?.[0], loc: f.loc, message: explain(rule, f, per?.['.meta']) })));
	editor.dispatch({ effects: setLints.of(found.flatMap(f => {
		const [startLine, startCol, endLine, endCol] = f.loc ?? [];
		if(startLine === undefined || startLine !== endLine || startCol === undefined || endCol === undefined) {
			return [];
		}
		if(startLine < 1 || startLine > editor.state.doc.lines) {
			return [];   // a rule that points outside this file, e.g. at the project around it
		}
		const line = editor.state.doc.line(startLine);
		return [{ from: line.from + startCol - 1, to: Math.min(line.to, line.from + endCol), message: `${f.rule}: ${f.message}` }];
	})) });
	section(`Lints: ${found.length}`);
	if(found.length === 0) {
		panel.append(nothing('no findings'));
		return took;
	}
	const lints = document.createElement('div');
	lints.className = 'lints';
	for(const f of found) {
		const said = document.createElement('span');
		said.className = 'says';
		said.textContent = f.message;
		const chip = tag(f.rule, 'rule');
		chip.dataset.category = category(f.rule);
		/* one element per finding, so the hover lights the whole row; the columns still line up
		   because the row borrows the surrounding grid */
		const line = document.createElement('div');
		line.className = 'lint';
		line.append(chip, said, tag(f.line ? `L${f.line}` : '', 'at'));
		lints.append(...linkRow([line], [f.line]));
	}
	panel.append(lints);
	return took;
}

/* whether the lines outside the slice step back in the editor, what the last slice kept, and which way it runs */
let dimOutside = false, lastKept: readonly number[] = [];
let direction: SliceDirection = SliceDirection.Backward;
let working = false, again = false;
async function run(): Promise<void> {
	if(working) {
		again = true;
		return;
	}
	working = true;
	described.clear();
	showTook('analyzing…');
	try {
		const took = await analyze();
		showTook(`analyzed in ${Math.round(took)} ms`);
	} catch(e) {
		showTook(`that did not work: ${String(e)}`);
	} finally {
		working = false;
		if(again) {
			again = false;
			void run();
		}
	}
}

/* typing re-runs the analysis on its own, once the typing pauses */
let timer = 0;
function schedule(delay = 700): void {
	clearTimeout(timer);
	timer = window.setTimeout(() => void run(), delay);
}

document.querySelector('[data-sample]')?.addEventListener('click', () => {
	editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: Sample } });
});
editor.dom.addEventListener('click', event => {
	if(event.ctrlKey || event.metaKey) {
		void jumpToDefinition();
	}
});

/* the cursor starts on the call in the last line: slicing for `library` says nothing worth reading */
const last = editor.state.doc.line(editor.state.doc.lines);
const first = /[A-Za-z.][\w._]*/.exec(last.text);
if(first?.index !== undefined) {
	editor.dispatch({ selection: { anchor: last.from + first.index } });
}

void run();
