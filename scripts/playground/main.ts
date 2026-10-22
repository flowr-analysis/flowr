/**
 * The playground: a CodeMirror editor on the left, and on the right what flowR makes of it, all in
 * the browser. The wasm rides along inside this bundle, so the page fetches nothing.
 */
import { type SourceLocation, SourceRange } from '../../src/util/range';
import { queryWikiPage, SupportedQueries } from '../../src/queries/query';
import { FlowrWikiBaseRef } from '../../src/documentation/doc-util/doc-files';
import { EditorView, basicSetup } from 'codemirror';
import { closeHoverTooltips, Decoration, gutter, GutterMarker, hoverTooltip, keymap, ViewPlugin, type DecorationSet, type ViewUpdate } from '@codemirror/view';
import { Compartment, EditorState, Prec, RangeSet, StateEffect, StateField, type StateEffectType, type Transaction } from '@codemirror/state';
import { indentWithTab } from '@codemirror/commands';
import { autocompletion, type Completion, type CompletionContext, type CompletionResult } from '@codemirror/autocomplete';
import { HighlightStyle, StreamLanguage, syntaxHighlighting, syntaxTree } from '@codemirror/language';
import { highlightCode, tags } from '@lezer/highlight';
import { r } from '@codemirror/legacy-modes/mode/r';
import { json } from '@codemirror/legacy-modes/mode/javascript';
import { FlowrConfig } from '../../src/config';
import { TreeSitterExecutor } from '../../src/r-bridge/lang-4.x/tree-sitter/tree-sitter-executor';
import { FlowrAnalyzerBuilder } from '../../src/project/flowr-analyzer-builder';
import { stringifyValue } from '../../src/dataflow/eval/values/r-value';
import { LintingRules } from '../../src/linter/linter-rules';
import type { LintQuickFix } from '../../src/linter/linter-format';
import { LintQuickFixes } from '../../src/linter/linter-fix';
import { DefaultBuiltinConfig, statedSignatureOf, statedSignatures } from '../../src/dataflow/environments/default-builtin-config';
import { FlowrAnalyzerPackageVersionsSigDbPlugin, SigDbPluginName } from '../../src/project/plugins/package-version-plugins/flowr-analyzer-package-versions-sigdb-plugin';
import { memorySourceOfPackages } from '../../src/project/sigdb/memory-source';
import { Identifier } from '../../src/dataflow/environments/identifier';
import { SliceDirection } from '../../src/util/slice-direction';
import { rankName } from '../../src/util/text/name-rank';
import { stripAnsi, voidFormatter } from '../../src/util/text/ansi';
import { escapeRegex, compareByCodeUnit  } from '../../src/util/text/strings';
import { computeCompletions, replProcessAnswer } from '../../src/cli/repl/core';
import { getCommand } from '../../src/cli/repl/commands/repl-commands';
import { splitAtEscapeSensitive } from '../../src/util/text/args';
import type { ReplOutput } from '../../src/cli/repl/commands/repl-main';
import { packForUrl, toBase64, unpackFromUrl } from '../../src/util/text/url-encoding';
import type { PlaygroundMark as Mark } from '../../src/util/text/playground-link';
import { Playground, PlaygroundBox } from '../../src/util/text/playground-link';
import type { ProjectQueryResult } from '../../src/queries/catalog/project-query/project-query-format';
import { rAuthorInfoToReadable } from '../../src/util/r-author';
import { stringifyRLicense } from '../../src/util/r-license';
import { baseRPackages, isBaseRPackage } from '../../src/util/r-base-packages';
import { DataflowMermaid } from '../../src/util/mermaid/dfg';
import { cfgToMermaid } from '../../src/util/mermaid/cfg';
import { normalizedAstToMermaid } from '../../src/util/mermaid/ast';
import treeSitterWasm from '../../node_modules/web-tree-sitter/tree-sitter.wasm';
import rWasm from '../../node_modules/@davisvaughan/tree-sitter-r/tree-sitter-r.wasm';
import { blank, button, el } from '../page-lib/dom';
import { explain } from '../page-lib/lint-text';
import { evalInR, type RunInput, setupRunR } from './run-r';
import { FlowrInlineTextFile } from '../../src/project/context/flowr-file';
import { cellTitles, languageOf, NotebookRun, notebookAsScript, notebookCells, rewriteCells, writesR } from './notebook';
import { fileBanner, reconstructToCode } from '../../src/reconstruct/reconstruct';
import { keptAfterRemoval } from '../../src/slicing/static/removal-slice';
import { arraySum, uniqueArray  } from '../../src/util/collections/arrays';
import { cranPageUrl } from '../../src/util/r-package-urls';
import type { DataflowGraph } from '../../src/dataflow/graph/graph';
import { RNode } from '../../src/r-bridge/lang-4.x/ast/model/model';
import type { NodeId } from '../../src/r-bridge/lang-4.x/ast/model/processing/node-id';
import { allNodes, categoryInfo, dependencyTree, describeDependency, type DepNode, icon, noFindingsGroup, nodeIds, primaryCategory } from './dependency-view';

/* the script the page opens with, written into the page by the build so the documentation can link
   to the same one rather than to a copy of it */
const Sample = (document.getElementById('sample')?.textContent ?? '').trim();

const panel = document.getElementById('panel') as HTMLElement;

const textInto = (id: string) => (text: string): void => {
	const at = document.getElementById(id);
	if(at !== null) {
		at.textContent = text;
	}
};
/** how long the last analysis took, next to what it found */
const showTook = textInto('took');
/** what the tools bar says about the link, next to the button that copies it */
const showShared = textInto('sharenote');

const setJumpable = StateEffect.define<{ readonly from: number, readonly to: number } | undefined>();
const jumpableMark = marksFrom(setJumpable, at => at === undefined ? Decoration.none : Decoration.set([Decoration.mark({ class: 'cm-jumpable' }).range(at.from, at.to)]));
let jumpShown = false, jumpAsked = 0;
function showJumpable(at: { readonly from: number, readonly to: number } | undefined): void {
	if(at !== undefined || jumpShown) {
		jumpShown = at !== undefined;
		editor.dispatch({ effects: setJumpable.of(at) });
	}
}
const jumpHover = EditorView.domEventHandlers({
	mousemove(event, view) {
		const asked = ++jumpAsked;
		const pos = event.ctrlKey || event.metaKey ? view.posAtCoords({ x: event.clientX, y: event.clientY }) : null;
		if(pos === null) {
			showJumpable(undefined);
			return;
		}
		void jumpTarget(pos).then(target => asked === jumpAsked && showJumpable(target));
	},
	mouseleave: () => showJumpable(undefined)
});
window.addEventListener('keyup', event => (event.key === 'Control' || event.key === 'Meta') && (jumpAsked++, showJumpable(undefined)));

/* outside the R code of a notebook the cursor keeps its last slice */
let held: { readonly criterion?: string, readonly name?: string } = {};
const holdCursor = EditorView.updateListener.of(update => update.selectionSet && cursorTarget());

/* what the linter found, and which lines a slice keeps: both replaced after every analysis */
const setLints = StateEffect.define<readonly { from: number, to: number, message: string, rule?: string }[]>();
const setSlice = StateEffect.define<readonly number[] | undefined>();
/* pins live as ranges in the state of their file, so they move with every edit */
const togglePin = StateEffect.define<{ readonly from: number, readonly to: number }>();
const clearPins = StateEffect.define<null>();
const pinMark = Decoration.mark({ class: 'cm-pinned' });
const pins = StateField.define<DecorationSet>({
	create: () => Decoration.none,
	update(set, tr) {
		set = set.map(tr.changes);
		for(const effect of tr.effects) {
			if(effect.is(clearPins)) {
				set = Decoration.none;
			} else if(effect.is(togglePin)) {
				const { from, to } = effect.value;
				let held = false;
				set.between(from, to, (start, end) => {
					held ||= start <= from && end >= to;
				});
				set = held ? set.update({ filter: (start, end) => !(start <= from && end >= to) }) : set.update({ add: [pinMark.range(from, to)] });
			}
		}
		return set;
	},
	provide: field => EditorView.decorations.from(field)
});
const setLinked = StateEffect.define<readonly number[] | undefined>();
/* what the link points at: whole lines and spans, resolved before they are handed over */
const setShown = StateEffect.define<{ ranges: readonly ShownRange[], fresh: boolean }>();

/** a place a link points at; every one of them is shown in the one colour a highlight has */
interface ShownRange { from: number, to: number, line: boolean }

function marksFrom<T>(effect: StateEffectType<T>, draw: (value: T, tr: Transaction) => DecorationSet): StateField<DecorationSet> {
	return StateField.define<DecorationSet>({
		create: () => Decoration.none,
		update(marks, tr) {
			marks = marks.map(tr.changes);
			for(const change of tr.effects) {
				if(change.is(effect)) {
					marks = draw(change.value, tr);
				}
			}
			return marks;
		},
		provide: field => EditorView.decorations.from(field)
	});
}

const linkMarks = marksFrom(setLinked, (value, tr) => {
	const lines = (value ?? []).filter(l => l >= 1 && l <= tr.state.doc.lines).sort((a, b) => a - b);
	return lines.length === 0 ? Decoration.none : Decoration.set(lines.map(l => {
		const doc = tr.state.doc.line(l);
		return Decoration.line({ class: 'cm-linked' }).range(doc.from);
	}), true);
});

/** lights up the lines a panel row stands for, and the row itself, while the pointer rests on it */
function linkRow(row: HTMLElement, lines: readonly (number | undefined)[]): HTMLElement {
	const at = lines.filter((l): l is number => l !== undefined);
	if(at.length > 0) {
		row.classList.add('linked');
		row.addEventListener('mouseenter', () => (row.classList.add('hot'), editor.dispatch({ effects: setLinked.of(at) })));
		row.addEventListener('mouseleave', () => (row.classList.remove('hot'), editor.dispatch({ effects: setLinked.of(undefined) })));
	}
	return row;
}

const lintMarks = marksFrom(setLints, value =>
	Decoration.set(value.map(l => Decoration.mark({ class: 'cm-lint', attributes: { 'data-category': l.rule === undefined ? 'bug' : category(l.rule) } }).range(l.from, l.to)), true));

/** what a link points at, kept apart from every mark an analysis produces so nothing overwrites it */
const shownMarks = marksFrom(setShown, value => {
	const fresh = value.fresh ? ' fresh' : '';
	return Decoration.set(value.ranges.map(at => at.line
		? Decoration.line({ class: `cm-shown-line${fresh}` }).range(at.from)
		: Decoration.mark({ class: `cm-shown${fresh}` }).range(at.from, at.to)), true);
});

/** lines outside the current slice step back, so what is left reads as the answer */
const sliceMarks = marksFrom(setSlice, (kept, tr) => kept === undefined ? Decoration.none : Decoration.set(
	Array.from({ length: tr.state.doc.lines }, (_, i) => i + 1)
		.filter(line => !kept.includes(line) && tr.state.doc.line(line).text.trim().length > 0)
		.map(line => Decoration.line({ class: 'cm-outside' }).range(tr.state.doc.line(line).from)),
	true));

const setFlash = StateEffect.define<{ from: number, to: number, color: string } | undefined>();
const flashMarks = marksFrom(setFlash, value => value === undefined || value.to <= value.from ? Decoration.none
	: Decoration.set([Decoration.mark({ class: 'cm-dep-flash', attributes: { style: `--cat: ${value.color}` } }).range(value.from, value.to)]));

class CategoryBar extends GutterMarker {
	constructor(readonly kind: string, readonly joins: string) {
		super();
	}
	eq(other: CategoryBar): boolean {
		return other.kind === this.kind && other.joins === this.joins;
	}
	toDOM(): Node {
		const bar = el('div', `cm-dep-bar${this.joins}`);
		bar.style.setProperty('--cat', categoryInfo(this.kind).color);
		return bar;
	}
}
const setCategories = StateEffect.define<readonly { line: number, kind: string, joins: string }[]>();
const categoryBars = StateField.define<RangeSet<GutterMarker>>({
	create: () => RangeSet.empty,
	update(bars, tr) {
		bars = bars.map(tr.changes);
		for(const change of tr.effects) {
			if(change.is(setCategories)) {
				bars = RangeSet.of(change.value.filter(v => v.line <= tr.state.doc.lines)
					.map(v => new CategoryBar(v.kind, v.joins).range(tr.state.doc.line(v.line).from)), true);
			}
		}
		return bars;
	}
});
const barTip = el('div', 'cm-tooltip cm-valuetip bartip');
function showBarTip(view: EditorView, line: { from: number, to: number }, event: Event): boolean {
	const said = depsOver(line.from, line.to);
	const bar = (event.target as HTMLElement).closest('.cm-dep-bar');
	barTip.hidden = said.length === 0 || bar === null;
	if(!barTip.hidden && bar !== null) {
		const at = bar.getBoundingClientRect();
		barTip.replaceChildren(...said);
		Object.assign(barTip.style, { left: `${at.right + 6}px`, top: `${at.top}px` });
		document.body.append(barTip);
	}
	return false;
}
const categoryGutter = [categoryBars, Prec.high(gutter({
	class:            'cm-dep-gutter',
	markers:          view => view.state.field(categoryBars),
	domEventHandlers: { mouseover: showBarTip, mouseleave: () => (barTip.hidden = true, false) }
}))];

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
	{ tag: [tags.operator, tags.punctuation, tags.bracket], color: 'var(--muted)' },
	{ tag: tags.heading, color: 'var(--fg)', fontWeight: '700' },
	{ tag: tags.strong, fontWeight: '700' },
	{ tag: tags.emphasis, fontStyle: 'italic' },
	{ tag: tags.link, color: 'var(--accent)', textDecoration: 'underline' },
	{ tag: tags.monospace, color: '#0f766e', fontFamily: 'var(--mono)' },
	{ tag: tags.meta, color: 'var(--muted)' }
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

/** what the linter said about a span of the code, so the tooltip carries it next to everything else */
function lintsOver(from: number, to: number): readonly { rule: string, message: string }[] {
	return shownLints.filter(found => found.from < to && found.to > from);
}

/** a finding as the page writes it: the rule as its own chip, and what it said next to it */
function complaint(found: { rule: string, message: string }, cls: string): HTMLElement {
	const at = el('div', cls);
	const chip = tag(found.rule, 'rule');
	chip.dataset.category = category(found.rule);
	at.append(chip, document.createTextNode(found.message.replace(`${found.rule}: `, '')));
	return at;
}

/** whether the offset sits in a string or a comment, where a name is text and not the function it spells */
function spelledOut(state: EditorState, pos: number): boolean {
	return /string|comment/i.test(syntaxTree(state).resolveInner(pos, 1).name);
}

/**
 * What flowR can say about the name under the pointer: its value, its shape, or where it comes from.
 */
const valueTips = hoverTooltip(async(view, pos) => {
	/* an open menu is what the pointer is on, whatever lies under it */
	if(!menu.hidden) {
		return null;
	}
	const line = view.state.doc.lineAt(pos);
	const found = targetAt(line.text, line.number, pos - line.from);
	/* a finding shows wherever its squiggle is, in a string as much as on a name */
	const lintOnly = () => {
		const over = shownLints.filter(l => l.from <= pos && pos <= l.to);
		return over.length === 0 ? null : { pos: Math.min(...over.map(l => l.from)), end: Math.max(...over.map(l => l.to)), above: false, create: () => ({ dom: tip(undefined, undefined, over) }) };
	};
	if(found === undefined) {
		return lintOnly();
	}
	const [from, to] = [line.from + found.from, line.from + found.to];
	/* what the call does as a dependency heads the card, whatever else flowR knows about the name */
	const card = (dom: HTMLElement) => ({ pos: from, end: to, above: false, create: () => (dom.prepend(...depsOver(from, to)), { dom }) });
	/* a package name stands for no value flowR could resolve, so what it knows about it is the package */
	if(namesPackage(line.text, found)) {
		const info = packageInfo(found.name);
		return card(packageTip(info, lintsOver(from, to)));
	}
	/* a name is asked about only where it is one: `read.csv` in `"read.csv"` or behind a `#` is text. The
	   package branch above runs first, as `library("dplyr")` writes the package it loads as a string */
	if(spelledOut(view.state, pos)) {
		return lintOnly();
	}
	const about = await describe(scoped(found.criterion));
	const said = about.said;
	const known = about.local ? undefined : signatureOf(found.name, ownerOf(found.name, about.pkg));
	const complaints = lintsOver(from, to);
	return said === undefined && known === undefined && complaints.length === 0 && depsOver(from, to).length === 0 ? null : card(tip(known, said, complaints));
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
const stated = statedSignatures();
function builtinSignature(name: string, pkg?: string): Signature | undefined {
	const own = statedSignatureOf(stated, name, pkg);
	return own === undefined ? undefined
		: { call: `${own.pkg}::${name}${own.params === undefined ? '' : `(${own.params})`}`, props: own.props.map(p => p.replace(/ /g, '-')).join(' '), where: '' };
}

/** the packages the script attaches, which is what decides who owns a name */
let attached = new Set<string>();

/** the lines that attach a package, and the lines that reach into one with `::`, per package */
const attachedLines = new Map<string, number[]>();
const qualifiedLines = new Map<string, number[]>();
/** the version a project pins a package to, when the analysis derived one from the files around it */
const versionAsked = new Map<string, string>();

/** the package a call belongs to here: an attached one that defines the name wins over base R */
function ownerOf(name: string, resolved: string | undefined): string | undefined {
	return resolved
		?? (definedIn.get(name) ?? []).find(pkg => attached.has(pkg))
		?? [...attached].find(pkg => exportsFrom(bakedPackages[pkg]).includes(name));
}

/**
 * What the signature database says about a base R function: its parameters, what flowR noticed about
 * it, and where it is defined. Parsed from the block the build put into the page, on first use.
 */
let signatures: Map<string, string[]> | undefined;
interface Signature { call: string, props: string, where: string, source?: string, docs?: string, name?: string }
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
		const own = builtinSignature(name, pkg);
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
	const at = blank(el('a', cls, text));
	at.href = href;
	return at;
}

/** what the page knows about a package: what the build baked in, and what this script does with it */
interface PackageInfo {
	name:        string,
	/** whether the build carries this package at all; without that there is no version to show */
	known:       boolean,
	version?:    string,
	released?:   string,
	exports:     number,
	baseR:       boolean,
	attachedAt:  readonly number[],
	qualifiedAt: readonly number[],
	constraint?: string
}

/** whether the name at this spot names a package: the argument of `library()`, or the left of `::` */
function namesPackage(text: string, found: { from: number, to: number }): boolean {
	return /^\s*:{2,3}/.test(text.slice(found.to)) || Loading.test(text.slice(0, found.from));
}

/** the version the build read a package at, together with what this script asks of it */
function packageInfo(name: string): PackageInfo {
	const entry = bakedPackages[name];
	const [version = '', released = ''] = entry ?? [];
	return {
		name,
		known:       entry !== undefined,
		version:     version.length > 0 ? version : undefined,
		released:    released.length > 0 ? released : undefined,
		exports:     exportsFrom(entry).length,
		baseR:       BaseRPackages.has(name),
		attachedAt:  attachedLines.get(name) ?? [],
		qualifiedAt: qualifiedLines.get(name) ?? [],
		constraint:  versionAsked.get(name)
	};
}

/** `attached on line 3`, and `attached on lines 3, 7` when the script asks for it more than once */
function onLines(what: string, at: readonly number[]): string | undefined {
	return at.length === 0 ? undefined : `${what}${at.length === 1 ? '' : 's'} ${at.join(', ')}`;
}

/** everything the page can say about a package, as the parts a card is written from */
function packageFacts(info: PackageInfo): string[] {
	return [
		info.known ? info.baseR ? 'ships with R' : 'from CRAN' : 'no version info for it in this build',
		info.released === undefined ? undefined : `released ${info.released}`,
		info.exports > 0 ? `${info.exports} export${info.exports === 1 ? '' : 's'}` : undefined,
		info.constraint === undefined ? undefined : `this project asks for ${info.constraint}`,
		onLines('attached on line', info.attachedAt),
		onLines('reached into with :: on line', info.qualifiedAt)
	].filter((fact): fact is string => fact !== undefined);
}

/** the hover card of a package: its version, what came with it, and what the linter said here */
function packageTip(info: PackageInfo, complaints: readonly { rule: string, message: string }[]): HTMLElement {
	const head = info.version === undefined ? info.name : `${info.name} ${info.version}`;
	return tip({ call: head, props: '', where: packageFacts(info).join(' · '), name: info.name }, undefined, complaints);
}

/** the hover card: what the database knows about the name, then what flowR made of this script */
function tip(known: Signature | undefined, said: string | undefined, complaints: readonly { rule: string, message: string }[] = []): HTMLElement {
	const dom = el('div', 'cm-valuetip');
	const line = (text: string, cls: string): void => dom.append(el('div', cls, text));
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
	for(const found of complaints) {
		dom.append(complaint(found, 'tlint'));
	}
	if(known !== undefined) {
		const row = el('div', 'tlinks');
		for(const [text, href] of [
			['source', known.source], ['documentation', known.docs],
			['in the signature database', `../sigdb/?q=${encodeURIComponent(known.name ?? known.call.split('(')[0].split('::').pop() ?? known.call)}`]
		] as const) {
			if(href !== undefined) {
				row.append(link(text, href, 'tlink'));
			}
		}
		dom.append(row);
	}
	return dom;
}

/** the names flowR knows without any package, offered alongside whatever the script defines */
const builtInNames = uniqueArray(DefaultBuiltinConfig.flatMap(d => d.names.map(id => String(Identifier.getName(id)))))
	.filter(n => /^[A-Za-z.][\w._]*$/.test(n));

/** the exports of every package this page carries, `package -> names`, written in by the build */
const bakedPackages: Readonly<Record<string, readonly string[]>> = (() => {
	const baked = document.getElementById('pkgs')?.textContent?.trim();
	try {
		return baked ? JSON.parse(baked) as Record<string, string[]> : {};
	} catch{
		return {};   /* built without a database */
	}
})();

function showStats(steps: Readonly<Record<string, number>>, graph: DataflowGraph): void {
	const vertices = [...graph.vertices(true)];
	const edges = arraySum(vertices.map(([id]) => graph.edgesFrom(id).size));
	const plugins = (settings ?? FlowrConfig.default()).defaultPlugins.length;
	const at = document.getElementById('stats');
	if(at !== null) {
		at.textContent = [...Object.entries(steps).map(([step, ms]) => `${step} ${Math.round(ms)} ms`),
			`${plugins} plugins`, `${vertices.length} vertices, ${edges} edges`].join(' · ');
		at.title = 'how long parsing, normalizing, the dataflow analysis, and the linter took, how many plugins the analysis runs, and how big the dataflow graph is';
	}
}

/** what a package carries in the baked table, past the version and release date it starts with */
const exportsFrom = (entry: readonly string[] = []): readonly string[] => entry.slice(2);

/** the packages whose names a `library()` call may ask for */
const packageNames = Object.keys(bakedPackages).sort(compareByCodeUnit);

/** a package's exports as a set, so telling `print.foo` from `print` costs nothing per keystroke */
const exportSets = new Map<string, ReadonlySet<string>>();
function exportsOf(pkg: string): ReadonlySet<string> {
	let known = exportSets.get(pkg);
	if(known === undefined) {
		known = new Set(exportsFrom(bakedPackages[pkg]));
		exportSets.set(pkg, known);
	}
	return known;
}

/** `dplyr::` asks about one package, and then nothing but that package's exports belongs in the list */
const Qualified = /^([A-Za-z.][\w.]*)(:{2,3})([\w._]*)$/;
/** the argument of a call that names a package rather than a value, where only package names belong */
const Loading = /\b(?:library|require|loadNamespace|requireNamespace|attachNamespace|load_all)\(\s*["']?([\w.]*)$/;
/** the base R packages the page carries, which the ranker puts ahead of what CRAN adds */
const BaseRPackages = new Set(baseRPackages());

/** one name to offer, weighed by the {@link rankName} the signature browser ranks its hits with */
function offer(label: string, needle: string, where: { pkg?: string, type: string, detail: string, siblings?: ReadonlySet<string> }): Completion & { boost: number } {
	const dot = label.indexOf('.');
	/* `print.foo` is a method of `print` when the generic is a name of its own, as the database decides it */
	const generic = dot > 0 ? label.slice(0, dot) : undefined;
	const points = rankName({
		name:     label,
		needle,
		known:    knownNames.has(label),
		baseR:    where.pkg !== undefined && BaseRPackages.has(where.pkg),
		base:     where.pkg === 'base',
		s3:       generic !== undefined && (knownNames.has(generic) || (where.siblings?.has(generic) ?? false)),
		variable: where.type === 'variable'
	});
	return { label, type: where.type, detail: where.detail, boost: points };
}

/** the names flowR has a definition for, which is what tells a function people call from a lone symbol */
const knownNames = new Set(builtInNames);

/**
 * CodeMirror takes `boost` as a number between -99 and 99, while the ranker answers on a far wider scale
 * with the odd outlier (an exact hit is worth a thousand). Their order is what matters, so the list is
 * sorted by points and spread evenly across the range rather than scaled, which no outlier can flatten.
 */
function ranked(options: readonly (Completion & { boost: number })[]): Completion[] {
	const sorted = [...options].sort((a, b) => b.boost - a.boost);
	/* the same name may reach the list from more than one source (a package the script attached and
	   flowR's own built-ins both carry `ggplot`); the nearest source ranks first, so the rest go */
	const seen = new Set<string>();
	const unique = sorted.filter(option => {
		const first = !seen.has(option.label);
		seen.add(option.label);
		return first;
	});
	const last = Math.max(1, unique.length - 1);
	return unique.map((option, at) => ({ ...option, boost: Math.round(99 - at / last * 198) }));
}

/** `frame$col` and `frame[["col"`, with what is written of the column so far */
const ColumnAccess = /([A-Za-z.][\w.]*)(\$|\[\[\s*["'])([\w. ]*)$/;

/** the columns flowR knows the data frame named at `line`:`col` of the open file to have, the file analyzed as `code` */
let columnsAsked: { code: string, at: string, columns: Promise<string[]> } | undefined;
function columnsAt(code: string, line: number, col: number): Promise<string[]> {
	const at = `${line}:${col}`;
	if(columnsAsked?.code !== code || columnsAsked.at !== at) {
		const columns = (async() => {
			const answers = await (await analyzer(undefined, code)).query([{ type: 'absint', inference: 'df-shape', criteria: [at] }] as never) as unknown as { absint?: { result?: Map<string, unknown> } };
			const shapes = answers.absint?.result instanceof Map ? [...answers.absint.result.values()] : [];
			return uniqueArray(shapes.flatMap(shape => {
				const names = (shape as { colnames?: { must?: Set<string>, may?: Set<string> } }).colnames;
				return [...names?.must ?? [], ...names?.may ?? []];
			}));
		})().catch(() => []);
		columnsAsked = { code, at, columns };
	}
	return columnsAsked.columns;
}

/** the columns to offer after `frame$` or `frame[["`, which the analysis of the script without the access knows */
async function completeColumn(context: CompletionContext, access: { from: number, text: string }): Promise<CompletionResult | null> {
	const [, frame, how, written] = ColumnAccess.exec(access.text) ?? [];
	const nameEnd = access.from + frame.length;
	const doc = context.state.doc;
	const line = doc.lineAt(access.from);
	const columns = await columnsAt(doc.sliceString(0, nameEnd) + doc.sliceString(context.pos), line.number, access.from - line.from + 1);
	const quoted = how !== '$';
	return columns.length === 0 ? null : {
		from:    context.pos - written.length,
		options: columns.map(name => ({
			label:  name,
			apply:  quoted || /^[A-Za-z.][\w.]*$/.test(name) ? name : `\`${name}\``,
			type:   'property',
			detail: `column of ${frame}`
		}))
	};
}

/** the call whose parentheses hold `pos`, by its name, if any */
function callAround(text: string, pos: number): string | undefined {
	let depth = 0;
	for(let at = pos - 1; at >= Math.max(0, pos - 2000); at--) {
		const char = text[at];
		if(char === ')' || char === ']' || char === '}') {
			depth++;
		} else if(char === '(' || char === '[' || char === '{') {
			if(depth === 0) {
				return char === '(' ? /([A-Za-z.][\w.]*(?::{2,3}[A-Za-z.][\w.]*)?)\s*$/.exec(text.slice(Math.max(0, at - 200), at))?.[1] : undefined;
			}
			depth--;
		}
	}
	return undefined;
}

/** the parameters of the function `called`, as far as the page knows its signature */
function parametersOf(called: string): string[] {
	const [pkg, name] = called.includes('::') ? called.split(/:{2,3}/) : [undefined, called];
	const call = signatureOf(name, ownerOf(name, pkg))?.call ?? '';
	const params = call.slice(call.indexOf('(') + 1, call.lastIndexOf(')'));
	return call.includes('(') ? [...params.matchAll(/(?:^|,\s*)([A-Za-z.][\w.]*)(?=\s*(?:=|,|$))/g)].map(m => m[1]).filter(p => p !== '...') : [];
}

function complete(context: CompletionContext): CompletionResult | null | Promise<CompletionResult | null> {
	/* a comment is prose, so nothing there completes */
	if(!writesR(context.state, files[active].name, context.state.doc.lineAt(context.pos).number)
		|| /comment/i.test(syntaxTree(context.state).resolveInner(context.pos, -1).name)) {
		return null;
	}
	const qualified = Qualified.exec(context.matchBefore(/[A-Za-z.][\w.]*:{2,3}[\w._]*/)?.text ?? '');
	if(qualified !== null) {
		const [, pkg, colons, written] = qualified;
		const exported = bakedPackages[pkg] === undefined ? undefined : exportsFrom(bakedPackages[pkg]);
		return exported === undefined ? null : {
			from:    context.pos - written.length,
			options: ranked(exported.map(label => offer(label, written, { pkg, type: 'function', detail: `${pkg}${colons}`, siblings: exportsOf(pkg) })))
		};
	}
	const access = context.matchBefore(ColumnAccess);
	if(access !== null) {
		return completeColumn(context, access);
	}
	const loading = Loading.exec(context.matchBefore(Loading)?.text ?? '');
	if(loading !== null) {
		/* a call that loads a package takes a package and nothing else */
		return {
			from:    context.pos - loading[1].length,
			options: ranked(packageNames.map(label => offer(label, loading[1], { pkg: label, type: 'namespace', detail: 'package' })))
		};
	}
	const word = context.matchBefore(/[\w._]+/);
	if(word === null || (word.from === word.to && !context.explicit)) {
		return null;
	}
	/* only what R would find at this position: what the script binds, what it attached, and the rest of
	   the search path. A package name is not bound to anything, so it belongs in `library()` alone */
	const needle = word.text;
	const text = context.state.doc.toString();
	const defined = uniqueArray([...text.matchAll(/([A-Za-z.][\w._]*)\s*(?:<-|=(?!=))/g)].map(m => m[1]));
	/* right after `(` or `,` of a call, the parameters of what it calls come first */
	const called = /[(,]\s*$/.test(text.slice(Math.max(0, word.from - 200), word.from)) ? callAround(text, word.from) : undefined;
	const named = called === undefined ? [] : parametersOf(called).filter(p => p.startsWith(needle)).map(p => ({ label: p, apply: `${p} = `, type: 'property', detail: `argument of ${called}`, boost: 99 }));
	return {
		from:    word.from,
		options: [...named, ...ranked([
			...defined.map(label => offer(label, needle, { type: 'variable', detail: 'in this script' })),
			/* what the script attached is nearer than what flowR knows without it */
			...[...attached].flatMap(pkg => exportsFrom(bakedPackages[pkg]).map(label => offer(label, needle, { pkg, type: 'function', detail: pkg }))),
			...builtInNames.map(label => offer(label, needle, { type: 'function', detail: 'flowR built-in' }))
		])]
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
			const dom = el('div', 'cm-valuetip');
			dom.append(el('div', 'tcall', `${key.path.join('.')}${info.t === undefined ? '' : `: ${info.t}`}`), ...said.length > 0 ? [el('div', 'tabout', said)] : []);
			return { dom };
		}
	};
});

/**
 * A short script and a changed configuration live in the page's own url, so a link is the example: paste it
 * to someone and they open what you were looking at. Only what stays within {@link MaxShared} is kept, since
 * a link nobody can send is worse than none, and a configuration left at its defaults is not written at all.
 */
const MaxShared = 4000;
const shared = (() => {
	const params = new URLSearchParams(location.hash.replace(/^#/, ''));
	/* a chat client stops a link at what looks like the end of a sentence, and what arrives then no longer
	   reads back as what was sent: the page opens on its own sample and says why */
	let cut = false;
	const read = (key: string) => {
		const found = params.get(key);
		if(found === null) {
			return undefined;
		}
		const back = unpackFromUrl(found);
		cut ||= back === undefined;
		return back;
	};
	const changed = Playground.unpackConfig(params.get('k'));
	/* everything about the view is one field, `<code width>,<repl height>,<flags>`, because four of them
	   would be four `&`-separated names for what is really one thing: how the page was left looking */
	const [split = '', repl = '', flags = ''] = (params.get('v') ?? '').split(',');
	const view = Playground.readView(flags);
	/* the unit is the same every time, so a link carries the bare number and gets it back here; links
	   written before that spelled the unit out and still read as they did */
	const sized = (value: string, unit: string) => value.length === 0 ? undefined : /^[\d.]+$/.test(value) ? value + unit : value;
	const code = read('c');
	const others = (() => {
		try {
			return JSON.parse(read('o') ?? '[]') as [string, string][];
		} catch{
			return [];
		}
	})();
	return {
		code,
		name:       params.get('n') ?? Playground.MainFile,
		others,
		position:   /^\d+$/.test(params.get('p') ?? '') ? Math.min(Number(params.get('p')), others.length) : others.length,
		cut,
		/* the release of flowR a link insists on, see {@link copyLink} */
		release:    params.get('r') ?? undefined,
		config:     changed.length === 0 ? undefined : JSON.stringify(FlowrConfig.applyPaths(changed), null, 2),
		/* `>` is how the landing page writes the forward direction, so a link reads the same on both */
		direction:  view.forward ? SliceDirection.Forward : view.removal ? 'removal' as const : undefined,
		split:      sized(split, '%'),
		repl:       sized(repl, 'px'),
		/* what the link points at, as `12`, `12-15`, `12@sum`, `12:5`, `lint:<rule>[@<line>]`, or a box */
		marks:      Playground.Mark.expand((params.get('h') ?? '').split(',').filter(mark => mark.length > 0)),
		/* a page opened without a link steps back what the slice leaves out; a link keeps the view it was sent with */
		dim:        params.size === 0 || view.dim,
		/* the repl and the whole of a slice are as much a part of how the page was left as the panes are */
		replOpen:   view.replOpen,
		wholeSlice: view.wholeSlice,
		/* a slice across files keeps them apart, unless asked to splice what `source()` pulls in at the call */
		inline:     view.inline,
		pins:       (params.get('P') ?? '').split(',').map(pin => /^(\d+):(\d+)-(\d+)$/.exec(pin)).filter(m => m !== null)
			.map(([, file, from, to]) => ({ file: Number(file), from: Number(from), to: Number(to) })),
		/* what was asked of the repl, so a link opens on the answer it was sent for */
		said:   (read('q') ?? '').split('\n').filter(line => line.trim().startsWith(':')).slice(0, 8),
		/* an example opens on what it is about, with the boxes it is not about folded away */
		folded: (params.get('f') ?? '').split(',')
			.filter((box): box is PlaygroundBox => (Object.values(PlaygroundBox) as string[]).includes(box)),
		/* the line the cursor sat on rides along, so a link opens on the criterion it was shared for */
		cursor: (() => {
			const [line, column] = (params.get('p') ?? '').split(':').map(Number);
			return Number.isInteger(line) && line > 0
				? { line, column: Number.isInteger(column) && column > 0 ? column : 1 }
				: undefined;
		})()
	};
})();

/**
 * What the link points at, as the marks it carries. Alt-click adds what it is pointed at and takes it back
 * out, and every one of them is written the way flowR names a place: `12`, `12@sum`, `12:5`, or
 * `lint:<rule>[@<line>]` for what a linting rule reported. They name lines rather than follow them, so an
 * edit above a mark moves what it stands for.
 */
const marks: Mark[] = shared.marks;

/** what the last analysis found, kept so a `lint:` or `dep:` mark can say which code it stands for */
let shownLints: readonly { rule: string, message: string, line?: number, from: number, to: number }[] = [];
interface ShownDep { readonly kind: string, readonly line?: number, readonly from: number, readonly to: number, readonly said?: { readonly name: string, readonly why: string } }
let shownDeps: readonly ShownDep[] = [];

function depsOver(from: number, to: number): Node[] {
	return shownDeps.filter(d => d.said !== undefined && d.from < to && from < d.to).map(d => depMessage(d.kind, d.said as NonNullable<ShownDep['said']>));
}

let shareTimer = 0;

/**
 * Everything a link carries about the page as it stands right now. Built from the live state rather than read
 * back out of the address bar, which {@link remember} only catches up with after a pause, so a mark set a
 * moment ago is already in here.
 */
function shareFields(): [string, string][] {
	const fields: [string, string][] = [];
	const written = editor.state.doc.toString();
	/* the sample is what the page opens with anyway, so a link to it carries nothing */
	if(written !== Sample) {
		fields.push(['c', packForUrl(written)]);
	}
	if(files[active].name !== Playground.MainFile) {
		fields.push(['n', files[active].name]);
	}
	if(files.length > 1) {
		fields.push(['o', packForUrl(JSON.stringify(projectFiles().filter((_, at) => at !== active)))]);
		if(active < files.length - 1) {
			fields.push(['p', String(active)]);
		}
	}
	const configured = config.state.doc.toString();
	/* the configuration travels only when it is not the one the page opens with */
	const settings = configured.trim() === Defaults.trim() ? undefined : FlowrConfig.parse(configured);
	const changed = settings === undefined ? [] : FlowrConfig.changedPaths(settings);
	if(changed.length > 0) {
		fields.push(['k', Playground.packConfig(changed)]);
	}
	const pinnedAt = files.flatMap((file, at) => {
		const found: string[] = [];
		stateOf(at).field(pins, false)?.between(0, Number.MAX_SAFE_INTEGER, (from, to) => void found.push(`${at}:${from}-${to}`));
		return found;
	});
	if(pinnedAt.length > 0) {
		fields.push(['P', pinnedAt.join(',')]);
	}
	const dragged = (property: string, unit: string) => document.documentElement.style.getPropertyValue(property).replace(unit, '');
	const flags = Playground.viewFlags({
		forward:  direction === SliceDirection.Forward,
		removal:  direction === 'removal',
		dim:      dimOutside,
		replOpen: (document.getElementById('repl') as HTMLDetailsElement | null)?.open,
		wholeSlice,
		inline:   inlineFiles
	});
	const view = [dragged('--split', '%'), dragged('--repl-height', 'px'), flags];
	/* a trailing empty field says nothing and would leave the link ending in a comma, which is where a
	   chat client stops reading it */
	while(view.length > 0 && view[view.length - 1].length === 0) {
		view.pop();
	}
	if(view.length > 0) {
		fields.push(['v', view.join(',')]);
	}
	const here = scoped('');
	const shortened = Playground.Mark.compress(marks.map(mark => here.length > 0 && mark.endsWith(here) ? mark.slice(0, -here.length) as Mark : mark));
	if(shortened.length > 0) {
		fields.push(['h', shortened.join(',')]);
	}
	if(folded.length > 0) {
		fields.push(['f', folded.join(',')]);
	}
	if(replSaid.length > 0) {
		fields.push(['q', packForUrl(replSaid.join('\n'))]);
	}
	if(shared.release !== undefined) {
		fields.push(['r', shared.release]);
	}
	return fields;
}

/** writes the current script and configuration into the url, replacing rather than growing the history */
function remember(): void {
	clearTimeout(shareTimer);
	shareTimer = window.setTimeout(() => {
		const hash = Playground.hash(shareFields());
		const fits = hash.length <= MaxShared;
		try {
			history.replaceState(null, '', fits ? `#${hash}` : location.pathname + location.search);
			showShared(fits ? '' : 'too long for a link, the script stays on this page only');
		} catch{
			/* opened over file://, where some browsers refuse to rewrite the address */
			showShared('this browser keeps the address bar as it is, so the link does not follow along');
		}
	}, 800);
}

let settings: ReturnType<typeof FlowrConfig.parse>;

/** what is wrong with the configuration, at the key it is about or where JSON stopped reading */
interface ConfigProblem {
	readonly from:    number
	readonly to:      number
	readonly message: string
}

/** browsers say where JSON stopped reading as a position, as a line and column, or both */
function jsonStop(text: string, message: string): number {
	const position = /position (\d+)/.exec(message);
	const lineColumn = /line (\d+) column (\d+)/.exec(message);
	if(position !== null) {
		return Number(position[1]);
	} else if(lineColumn !== null) {
		return arraySum(text.split('\n').slice(0, Number(lineColumn[1]) - 1).map(line => line.length + 1)) + Number(lineColumn[2]) - 1;
	}
	return text.length;
}

function configProblems(text: string): ConfigProblem[] {
	const near = (at: number, message: string): ConfigProblem => {
		const from = Math.max(0, Math.min(at, text.length - 1));
		return { from, to: Math.min(from + 1, text.length), message };
	};
	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch(e) {
		const message = (e as Error).message;
		return [near(jsonStop(text, message), message.replace(/^JSON\.parse: /, '').replace(/ (in JSON )?at (position|line) .*$/, ''))];
	}
	const keys = keyPaths(text);
	const problems = (FlowrConfig.Schema.validate(parsed, { abortEarly: false }).error?.details ?? []).map(detail => {
		const path = detail.path.filter(part => typeof part === 'string');
		for(let length = path.length; length > 0; length--) {
			const key = keys.find(k => k.path.join('.') === path.slice(0, length).join('.'));
			if(key !== undefined) {
				return { from: key.from, to: key.to, message: detail.message };
			}
		}
		return near(0, detail.message);
	}).filter((problem, at, all) => all.findIndex(other => other.from === problem.from) === at);
	return problems.length > 0 || FlowrConfig.parse(text) !== undefined ? problems : [near(0, 'flowR cannot read this configuration')];
}

const configNote = document.getElementById('confignote') as HTMLElement;
const configReset = document.getElementById('configreset') as HTMLElement;
const configIssues = document.getElementById('configproblems') as HTMLElement;

function showConfigState(text: string, problems: readonly ConfigProblem[]): void {
	configReset.hidden = text === Defaults;
	configNote.classList.toggle('bad', problems.length > 0);
	configNote.textContent = problems.length > 0
		? `${problems.length === 1 ? 'one problem' : `${problems.length} problems`}, flowR keeps analyzing with the last valid configuration`
		: text === Defaults ? 'flowR\'s defaults, with the lax parser' : 'edited, flowR analyzes with this';
	configIssues.replaceChildren(...problems.map(problem => {
		const row = button(undefined, ` ${problem.message}`, 'jump to it', () => {
			config.dispatch({ selection: { anchor: problem.from, head: problem.to }, scrollIntoView: true });
			config.focus();
		});
		row.prepend(el('span', 'where', `line ${config.state.doc.lineAt(problem.from).number}`));
		return row;
	}));
	configIssues.hidden = problems.length === 0;
	config.dispatch({ effects: setLints.of(problems) });
}

function readSettings(): void {
	const text = config.state.doc.toString();
	const problems = configProblems(text);
	showConfigState(text, problems);
	const parsed = problems.length === 0 ? FlowrConfig.parse(text) : undefined;
	if(parsed !== undefined) {
		settings = parsed;
		void run();
	}
}

/**
 * What the page analyzes with: flowR's own defaults, but with the lax tree-sitter parser, because a
 * script one is still typing is a script with a syntax error in it more often than not.
 */
const Defaults = JSON.stringify({
	...FlowrConfig.default(),
	engines: [{ type: 'tree-sitter', lax: true }]
}, null, 2);
settings = FlowrConfig.parse(shared.config ?? Defaults);
const config = new EditorView({
	doc:        shared.config ?? Defaults,
	extensions: [
		basicSetup, StreamLanguage.define(json), look, syntaxHighlighting(highlight), configTips, lintMarks,
		EditorView.updateListener.of(update => {
			if(update.docChanged) {
				clearTimeout(configTimer);
				configTimer = window.setTimeout(readSettings, 600);
				remember();
			}
		})
	],
	parent: document.getElementById('config') as HTMLElement
});
let configTimer = 0;
showConfigState(config.state.doc.toString(), configProblems(config.state.doc.toString()));

configReset.addEventListener('click', () => {
	config.dispatch({ changes: { from: 0, to: config.state.doc.length, insert: Defaults } });
});

const configTab = document.getElementById('configtab') as HTMLElement;
let onConfig = false;
const configClose = el('span', 'x', 'x');
configClose.title = 'close the configuration';
configClose.addEventListener('click', event => (event.stopPropagation(), configTab.hidden = true, showTab(false)));
configTab.append(configClose);
function showTab(config: boolean): void {
	onConfig = config;
	configTab.hidden &&= !config;
	configTab.setAttribute('aria-selected', String(config));
	for(const id of ['editor', 'config', 'configbar']) {
		document.getElementById(id)?.toggleAttribute('hidden', config === (id === 'editor'));
	}
	showFiles();
}
configTab.addEventListener('click', () => showTab(true));

/** which way the playground slices; `removal` is what can go together with the criteria */
type Way = SliceDirection | 'removal';
let direction: Way = shared.direction ?? SliceDirection.Backward;
let intersect = false, negative = false, showWide = false;

function pinnedCriteria(): string[] {
	return files.flatMap((file, at) => {
		const state = stateOf(at);
		const found: string[] = [];
		state.field(pins, false)?.between(0, state.doc.length, from => {
			const line = state.doc.lineAt(from);
			const target = targetAt(line.text, line.number, from - line.from);
			if(target !== undefined) {
				found.push(scoped(target.criterion, file.name));
			}
		});
		return found;
	});
}

function unpinAll(): void {
	files.forEach((file, at) => at === active || (file.state = file.state.update({ effects: clearPins.of(null) }).state));
	editor.dispatch({ effects: clearPins.of(null) });
}

/** the editor steps back what is not in the slice, or the slice itself for a negative one */
function dim(): void {
	const lines = editor.state.doc.lines;
	const bright = negative ? Array.from({ length: lines }, (_, i) => i + 1).filter(l => !lastKept.includes(l)) : lastKept;
	editor.dispatch({ effects: setSlice.of(dimOutside && lastKept.length > 0 ? bright : undefined) });
}

/** a slice asked for explicitly: it dims, and shows the slice whole */
function askSlice(way: Way): void {
	direction = way;
	dimOutside = showWide = true;
	remember();
}

function pinCursor(): void {
	const head = editor.state.selection.main.head;
	const line = editor.state.doc.lineAt(head);
	const target = targetAt(line.text, line.number, head - line.from);
	if(target !== undefined) {
		editor.dispatch({ effects: togglePin.of({ from: line.from + target.from, to: line.from + target.to }) });
		/* a pin marks where it is, the panel keeps the slice */
		remember();
		void run();
	}
}

const SliceActions: readonly { readonly label: string, readonly key: string, readonly run: () => void }[] = [
	{ label: 'Slice: what this is built from', key: 'Alt-s', run: () => (askSlice(SliceDirection.Backward), void run()) },
	{ label: 'Slice: what this influences', key: 'Alt-f', run: () => (askSlice(SliceDirection.Forward), void run()) },
	{ label: 'Removal slice: what can go with this', key: 'Alt-r', run: () => (askSlice('removal'), void run()) },
	{ label: 'Pin or unpin this position', key: 'Alt-p', run: pinCursor },
	{ label: 'Clear the slice', key:   'Alt-c', run:   () => {
		unpinAll();
		negative = dimOutside = false;
		remember();
		void run();
	} }
];
const sliceKeys = Prec.high(keymap.of(SliceActions.map(action => ({ key: action.key, run: () => (action.run(), true) }))));
function sliceMenu(): MenuEntry[] {
	const toggle = (flip: () => void) => () => (flip(), remember(), void run());
	return [
		'flowR', ...SliceActions.map(a => ({ label: `${a.label}  (${a.key.replace('Alt-', 'alt+')})`, run: a.run })), '',
		{ label: 'Intersect the pinned positions', checked: intersect, run: toggle(() => intersect = !intersect) },
		{ label: 'Negative slice: step back the slice', checked: negative, run: toggle(() => negative = !negative) }
	];
}

const editorExtensions = [
	basicSetup, look, syntaxHighlighting(highlight), callMarks,
	lintMarks, sliceMarks, linkMarks, shownMarks, flashMarks, categoryGutter, valueTips, sliceKeys, autocompletion({ override: [complete] }),
	keymap.of([indentWithTab]), holdCursor, pins,
	/* ctrl+click jumps to a definition, as in vscode-flowR, rather than adding another cursor */
	EditorView.clickAddsSelectionRange.of(() => false), jumpableMark, jumpHover,
	EditorView.updateListener.of(update => {
		if(update.docChanged) {
			schedule();
			remember();
		} else if(update.selectionSet) {
			schedule(400);
		}
	})
];

const fileKind = new Compartment();
const kindOf = (name: string) => [languageOf(name), notebookCells(name, runCell, openMenu)];
const fileState = (name: string, text: string) => EditorState.create({ doc: text, extensions: [editorExtensions, fileKind.of(kindOf(name))] });
/** one editor state per file, the editor holds the live one at {@link active} */
const files = [...shared.others.slice(0, shared.position), [shared.name, shared.code ?? Sample], ...shared.others.slice(shared.position)].map(([name, text]) => ({ name, state: fileState(name, text) }));
let active = shared.position;
for(const { file, from, to } of shared.pins) {
	const state = files[file]?.state;
	if(state !== undefined && to <= state.doc.length && from < to) {
		files[file].state = state.update({ effects: togglePin.of({ from, to }) }).state;
	}
}
const editor = new EditorView({ state: files[active].state, parent: document.getElementById('editor') as HTMLElement });
const menuPoint = el('span', 'menupoint');
document.body.append(menuPoint);
editor.contentDOM.addEventListener('contextmenu', event => {
	event.preventDefault();
	const at = editor.posAtCoords({ x: event.clientX, y: event.clientY });
	editor.dispatch({ effects: closeHoverTooltips, ...at === null ? {} : { selection: { anchor: at } } });
	Object.assign(menuPoint.style, { left: `${event.clientX}px`, top: `${event.clientY}px` });
	openMenu(menuPoint, sliceMenu());
});
editor.contentDOM.addEventListener('mousedown', () => focusedKey === undefined || void focusRelated(undefined));
const stateOf = (at: number): EditorState => at === active ? editor.state : files[at].state;
const textOf = (at: number): string => stateOf(at).doc.toString();
const projectFiles = () => files.map((f, at) => [f.name, textOf(at)] as const);

/** how far down each file was scrolled when it was left, so going back to it does not start at its top */
const scrolledTo = new Map<string, number>();
function openFile(at: number | string, change?: () => void): void {
	files[active].state = editor.state;
	scrolledTo.set(files[active].name, editor.scrollDOM.scrollTop);
	change?.();
	active = Math.min(Math.max(0, typeof at === 'string' ? files.findIndex(f => f.name === at) : at), files.length - 1);
	editor.setState(files[active].state);
	editor.scrollDOM.scrollTop = scrolledTo.get(files[active].name) ?? 0;
	held = {};
	showFiles();
	remember();
	schedule(0);
}

function putFile(name: string, text: string): void {
	const known = files.findIndex(f => f.name === name);
	files.splice(known < 0 ? files.length : known, 1, { name, state: fileState(name, text) });
}

function scoped(criterion: string, name = files[active].name): string {
	return files.length < 2 ? criterion : `${criterion}(^${escapeRegex(name)}$)`;
}

marks.splice(0, marks.length, ...marks.map(mark => /^\d/.test(mark) ? scoped(mark) as Mark : mark));

function elsewhere(node: { info: { file?: string } } | undefined): string | undefined {
	const file = node?.info.file;
	return file === files[active].name ? undefined : file;
}

const Analyzed = /\.(r|rmd|rmarkdown|qmd|ipynb)$/i;
const Wanted = (name: string) => (Analyzed.test(name) || /\.zip$|(^|\/)(DESCRIPTION|LICEN[CS]E(\.md|\.txt)?)$/i.test(name)) && !/(^|\/)(__MACOSX|\.)/.test(name);

async function entryFiles(entry: FileSystemEntry): Promise<[string, Blob][]> {
	if(entry.isFile) {
		return [[entry.fullPath.replace(/^\//, ''), await new Promise<File>((resolve, reject) => (entry as FileSystemFileEntry).file(resolve, reject))]];
	}
	const reader = (entry as FileSystemDirectoryEntry).createReader();
	const found: [string, Blob][] = [];
	for(let batch: FileSystemEntry[]; (batch = await new Promise((resolve, reject) => reader.readEntries(resolve, reject))).length > 0;) {
		found.push(...(await Promise.all(batch.map(entryFiles))).flat());
	}
	return found;
}

async function unzip(blob: Blob): Promise<[string, Blob][]> {
	const bytes = new Uint8Array(await blob.arrayBuffer());
	const view = new DataView(bytes.buffer);
	let end = bytes.length - 22;
	while(end > 0 && view.getUint32(end, true) !== 0x06054b50) {
		end--;
	}
	const found: [string, Blob][] = [];
	for(let at = view.getUint32(end + 16, true), left = end > 0 ? view.getUint16(end + 10, true) : 0; left > 0; left--) {
		const method = view.getUint16(at + 10, true), size = view.getUint32(at + 20, true), length = view.getUint16(at + 28, true);
		const name = new TextDecoder().decode(bytes.subarray(at + 46, at + 46 + length));
		const local = view.getUint32(at + 42, true);
		const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
		const data = new Blob([bytes.subarray(start, start + size)]);
		if(Wanted(name) && (method === 0 || method === 8)) {
			found.push([name, method === 0 ? data : await new Response(data.stream().pipeThrough(new DecompressionStream('deflate-raw'))).blob()]);
		}
		at += 46 + length + view.getUint16(at + 30, true) + view.getUint16(at + 32, true);
	}
	return found;
}

function asProjectFile(name: string, text: string): [string, string] {
	return /\.ipynb$/i.test(name) ? [`${name}.R`, notebookAsScript(text)] : [name, text];
}
async function readable(found: readonly [string, Blob][], failed: string[]): Promise<[string, string][]> {
	const read: [string, string][] = [];
	for(const [name, blob] of found.filter(([name]) => Wanted(name))) {
		try {
			const clean = name.replace(Leading, '');
			if(nameProblem(clean) !== undefined) {
				failed.push(name);
			} else if(/\.zip$/i.test(clean)) {
				read.push(...await readable(await unzip(blob), failed));
			} else {
				read.push(asProjectFile(clean, await blob.text()));
			}
		} catch{
			failed.push(name);
		}
	}
	return read;
}
/** adds what `found` holds to the project, in place of the untouched example and of files of the same name */
function load(found: Promise<[string, Blob][]> | [string, Blob][]): void {
	const failed: string[] = [];
	void Promise.resolve(found).then(f => readable(f, failed)).then(read => {
		if(read.length > 0) {
			const pristine = files.length === 1 && files[0].name === Playground.MainFile && textOf(0) === Sample;
			openFile(read[0][0], () => {
				if(pristine) {
					files.length = 0;
				}
				for(const [name, text] of read) {
					putFile(name, text);
				}
			});
			showTab(false);
		}
		if(failed.length > 0) {
			showTook(`could not open ${failed.join(', ')}`);
		} else if(read.length === 0) {
			showTook('nothing to open: flowR reads R scripts, R Markdown, Quarto, Jupyter notebooks, and zips of them');
		}
	}).catch((e: unknown) => showTook(`could not open that: ${String(e)}`));
}

function nameProblem(name: string, except?: number): string | undefined {
	if(name.length === 0 || name.endsWith('/')) {
		return 'a file needs a name';
	}
	if(name.startsWith('/') || /(^|\/)\.\.?(\/|$)/.test(name)) {
		return `${name} would lie outside the project, name it relative to it instead`;
	}
	return files.some((f, at) => at !== except && f.name === name) ? `there already is a ${name}` : undefined;
}

const Leading = /^(\.?\/)+/;

function nameAccepted(name: string, except?: number): boolean {
	const problem = nameProblem(name, except);
	if(problem !== undefined) {
		alert(problem);
	}
	return problem === undefined;
}

function picker(folder: boolean): HTMLInputElement {
	const input = Object.assign(document.createElement('input'), { type: 'file', multiple: true, webkitdirectory: folder, accept: '.R,.r,.Rmd,.Rmarkdown,.qmd,.ipynb,.zip' });
	input.addEventListener('change', () => {
		load([...input.files ?? []].map(f => [f.webkitRelativePath || f.name, f]));
		input.value = '';
	});
	return input;
}
const pickers = [picker(false), picker(true)];

const fileBar = document.getElementById('files') as HTMLElement;
const tree = document.getElementById('tree') as HTMLElement;
const treeHead = tree.firstElementChild as HTMLElement;
const treeToggle = document.getElementById('treetoggle') as HTMLElement;
treeToggle.addEventListener('click', () => (treeToggle.setAttribute('aria-expanded', String(tree.toggleAttribute('hidden') === false)), showFiles()));
/** the files open as tabs, which the tree opens and a tab's x closes again, without removing the file */
let openTabs: string[] = [];
function showFiles(): void {
	openTabs = uniqueArray([...openTabs.filter(name => files.some(f => f.name === name)), files[active].name]);
	fileBar.replaceChildren(...openTabs.map(name => {
		const at = files.findIndex(f => f.name === name);
		const open = !onConfig && at === active;
		const tab = button('tab file', name.split('/').at(-1) ?? name, open ? `${name}, right-click for more` : `open ${name}`, () => open || (openFile(at), showTab(false)));
		tab.setAttribute('role', 'tab');
		tab.setAttribute('aria-selected', String(open));
		tab.addEventListener('contextmenu', event => (event.preventDefault(), openMenu(tab, fileMenu(at))));
		/* renaming is what one does to an open file, so it waits on the tab under the pointer */
		const pen = el('span', 'pen', '\u270E');
		pen.title = `rename ${name}`;
		pen.addEventListener('click', event => (event.stopPropagation(), renameFile(at)));
		tab.append(pen);
		if(openTabs.length > 1) {
			const x = el('span', 'x', 'x');
			x.title = `close ${name}, the file stays in the project`;
			x.addEventListener('click', event => {
				event.stopPropagation();
				const was = openTabs.indexOf(name);
				openTabs = openTabs.filter(n => n !== name);
				if(at === active) {
					openFile(openTabs[Math.min(was, openTabs.length - 1)]);
				} else {
					showFiles();
				}
			});
			tab.append(x);
		}
		return tab;
	}));
	fileBar.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
	treeToggle.title = `${tree.hidden ? 'show' : 'hide'} the ${files.length === 1 ? 'file' : `${files.length} files`} of the project`;
	const shown = new Set<string>();
	const rows = files.map((file, at) => ({ file, at, folders: file.name.split('/') }))
		.sort((a, b) => a.file.name.localeCompare(b.file.name))
		.flatMap(({ file, at, folders }) => {
			const name = folders.pop() ?? file.name;
			const heads = folders.map((folder, depth) => [folders.slice(0, depth + 1).join('/'), folder, depth] as const)
				.filter(([path]) => !shown.has(path) && shown.add(path))
				.filter(([path]) => !foldedFolders.has(path.split('/').slice(0, -1).join('/')))
				.map(([path, folder, depth]) => {
					const row = treeRow('folder', folder, depth, false, [['+', `a new file in ${path}/`, () => newFile(`${path}/`)]]);
					row.classList.toggle('folded', foldedFolders.has(path));
					row.addEventListener('click', () => (foldedFolders.has(path) ? foldedFolders.delete(path) : foldedFolders.add(path), showFiles()));
					return row;
				});
			if(folders.some((_, depth) => foldedFolders.has(folders.slice(0, depth + 1).join('/')))) {
				return heads;
			}
			const row = treeRow('file', name, folders.length, !onConfig && at === active, [
				['\u270E', `rename ${file.name}`, () => renameFile(at)],
				...files.length > 1 ? [['\u00D7', `remove ${file.name} from the project`, () => removeFile(at)] as const] : []
			]);
			row.title = file.name;
			row.addEventListener('click', () => (openFile(at), showTab(false)));
			row.addEventListener('contextmenu', event => (event.preventDefault(), openMenu(row, fileMenu(at))));
			return [...heads, row];
		});
	const settingsRow = treeRow('file settings', 'flowR configuration', 0, onConfig);
	settingsRow.addEventListener('click', () => showTab(true));
	const examples = Examples.map(example => {
		const row = treeRow('file example', example.label, 0);
		row.title = `${example.title}, in place of all files`;
		row.addEventListener('click', () => {
			const project = example.files.map(([name, text]) => asProjectFile(name, text));
			if(pristineExample() || confirm(`replace all files with the ${example.label} example?`)) {
				showExample(project, `the ${example.label} example is open`);
				tree.hidden = true;
				treeToggle.setAttribute('aria-expanded', 'false');
				showFiles();
			}
		});
		return row;
	});
	tree.replaceChildren(treeHead, ...rows, settingsRow, el('div', 'treehead examples', 'Examples'), ...examples);
}

const foldedFolders = new Set<string>();

/** whether the files are one of the examples as it opened, which nobody minds losing */
function pristineExample(): boolean {
	return Examples.some(example => example.files.length === files.length
		&& example.files.map(([name, text]) => asProjectFile(name, text)).every(([name, text]) => files.some((f, at) => f.name === name && textOf(at) === text)))
		|| (files.length === 1 && textOf(0) === Sample);
}

function treeRow(kind: string, text: string, depth: number, open = false, actions: readonly (readonly [string, string, () => void])[] = []): HTMLElement {
	const row = el('div', kind);
	row.setAttribute('role', 'button');
	row.tabIndex = 0;
	row.style.paddingLeft = `${.6 + depth * .8}rem`;
	row.toggleAttribute('aria-current', open);
	row.addEventListener('keydown', event => event.key === 'Enter' && row.click());
	row.append(el('span', 'tname', text));
	for(const [label, title, act] of actions) {
		row.append(button('tact', label, title, event => (event.stopPropagation(), act())));
	}
	return row;
}

function removeFile(at: number): void {
	if(files.length > 1 && (textOf(at).trim() === '' || confirm(`remove ${files[at].name}?`))) {
		openFile(at < active ? active - 1 : active, () => files.splice(at, 1));
	}
}

function renameFile(at: number): void {
	const name = prompt('rename to', files[at].name)?.trim().replace(Leading, '');
	if(name === undefined || name === files[at].name || !nameAccepted(name, at)) {
		return;
	}
	openFile(active, () => {
		files[at].name = name;
		files[at].state = files[at].state.update({ effects: fileKind.reconfigure(kindOf(name)) }).state;
	});
}

function newFile(folder = ''): void {
	let at = files.length + 1;
	while(files.some(f => f.name === `${folder}script${at}.R`)) {
		at++;
	}
	const name = prompt('name of the new file, folders separated by /', `${folder}script${at}.R`)?.trim().replace(Leading, '');
	const known = files.findIndex(f => f.name === name);
	if(name === undefined || !nameAccepted(name, known) || (known >= 0 && !confirm(`replace ${name} with an empty file?`))) {
		return;
	}
	openFile(name, () => putFile(name, ''));
	showTab(false);
}

const Examples = JSON.parse(document.getElementById('examples')?.textContent ?? '[]') as readonly { label: string, title: string, files: [string, string][] }[];

function fileMenu(at: number): readonly MenuEntry[] {
	return [
		files[at].name,
		{ label: 'Rename...', run: () => renameFile(at) },
		...files.length > 1 ? [{ label: 'Remove', run: () => removeFile(at) }] : [],
		'', { label: 'New file next to it...', run: () => newFile(files[at].name.replace(/[^/]*$/, '')) }
	];
}

/** a string is a heading, `''` a separator */
type MenuEntry = { readonly label: string, readonly title?: string, readonly checked?: boolean, readonly run: () => void } | string;
const menu = document.getElementById('menu') as HTMLElement;
let menuAnchor: HTMLElement | undefined;
function closeMenu(): void {
	menu.hidden = true;
	menuAnchor?.setAttribute('aria-expanded', 'false');
	menuAnchor = undefined;
}
function openMenu(anchor: HTMLElement, entries: readonly MenuEntry[]): void {
	if(menuAnchor === anchor && !menu.hidden) {
		closeMenu();
		return;
	}
	closeMenu();
	menu.replaceChildren(...entries.map(entry => {
		if(typeof entry === 'string') {
			return entry === '' ? document.createElement('hr') : el('div', 'heading', entry);
		}
		const item = button(undefined, entry.label, entry.title ?? '', () => (closeMenu(), entry.run()));
		item.setAttribute('role', entry.checked === undefined ? 'menuitem' : 'menuitemradio');
		if(entry.checked !== undefined) {
			item.setAttribute('aria-checked', String(entry.checked));
		}
		return item;
	}));
	menuAnchor = anchor;
	anchor.setAttribute('aria-expanded', 'true');
	menu.hidden = false;
	const at = anchor.getBoundingClientRect();
	menu.style.setProperty('--top', `${at.bottom}px`);
	menu.style.setProperty('--left', `${Math.min(at.left, document.documentElement.clientWidth - menu.offsetWidth)}px`);
	menu.querySelector('button')?.focus();
}
document.addEventListener('click', event => {
	const target = event.target as Node;
	if(!menu.hidden && !menu.contains(target) && menuAnchor?.contains(target) !== true) {
		closeMenu();
	}
});
menu.addEventListener('keydown', event => {
	const items = [...menu.querySelectorAll('button')];
	const at = items.indexOf(document.activeElement as HTMLButtonElement);
	if(event.key === 'Escape' || event.key === 'Tab') {
		event.preventDefault();
		const anchor = menuAnchor;
		closeMenu();
		anchor?.focus();
	} else if(event.key === 'ArrowDown' || event.key === 'ArrowUp') {
		event.preventDefault();
		items[(at + (event.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length]?.focus();
	}
});
window.addEventListener('resize', closeMenu);

const addButton = document.getElementById('addfile') as HTMLElement;
addButton.addEventListener('click', () => openMenu(addButton, [
	{ label: 'New file...', title: 'folders separated by /, as in R/clean.R', run: () => newFile() },
	{ label: 'Upload files...', title: 'R scripts, R Markdown, Quarto, Jupyter notebooks, or a zip of them', run: () => pickers[0].click() },
	{ label: 'Upload folder...', title: 'every R script and notebook below a folder', run: () => pickers[1].click() }
]));
showFiles();

const pane = fileBar.closest('.pane') as HTMLElement;
const carriesFiles = (event: DragEvent) => event.dataTransfer?.types.includes('Files') === true;
pane.addEventListener('dragover', event => {
	if(carriesFiles(event)) {
		event.preventDefault();
		pane.classList.add('dropping');
	}
});
pane.addEventListener('dragleave', () => pane.classList.remove('dropping'));
/* captured, so a dropped file joins the project rather than being pasted into the editor */
pane.addEventListener('drop', event => {
	pane.classList.remove('dropping');
	if(carriesFiles(event)) {
		event.preventDefault();
		event.stopPropagation();
		const entries = [...event.dataTransfer?.items ?? []].map(item => item.webkitGetAsEntry()).filter(entry => entry !== null);
		load(Promise.all(entries.map(entryFiles)).then(found => found.flat()));
	}
}, true);
/** the packages R code loads, outside of base R, as flowR's dependencies query finds them */
async function packagesOf(code?: string): Promise<readonly string[]> {
	const answer = await (await analyzer(code)).query([{ type: 'dependencies' }] as never) as unknown as { dependencies?: { library?: readonly Dependency[] } };
	const found = (answer.dependencies?.library ?? []).map(d => d.value).filter((v): v is string => v !== undefined && v !== 'unknown');
	return uniqueArray(found).filter(p => !BaseRPackages.has(p));
}
async function toRun(): Promise<RunInput> {
	const name = files[active].name;
	const code = Analyzed.test(name) && !/\.r$/i.test(name)
		? (await analyzer()).context().files.resolveRequest({ request: 'file', content: name }).r.content
		: textOf(active);
	return { code, files: projectFiles(), fresh: runFresh };
}
const RunFreshKey = 'flowr-playground-run-fresh';
/** whether the run button starts R over like `Rscript` or continues the session the cells share */
let runFresh = (() => {
	try {
		return localStorage.getItem(RunFreshKey) !== 'false';
	} catch{
		return true;
	}
})();
const runMode = document.getElementById('runmode') as HTMLElement;
function setRunFresh(fresh: boolean): void {
	runFresh = fresh;
	runMode.title = fresh ? 'a run starts R in a fresh session, like Rscript' : 'a run uses the same R session as earlier runs, cells, and the repl';
	document.getElementById('runrgo')?.classList.toggle('same', !fresh);
	try {
		localStorage.setItem(RunFreshKey, String(fresh));
	} catch{
		/* private windows refuse storage, the choice then lasts for this page only */
	}
}
setRunFresh(runFresh);
runMode.addEventListener('click', () => openMenu(runMode, [
	'Run the open file',
	{ label: 'in a fresh session', title: 'like Rscript: no variables, attached packages, or options from earlier runs, cells, or the repl', checked: runFresh, run: () => setRunFresh(true) },
	{ label: 'in the same session', title: 'what earlier runs, cells, and the repl left behind stays', checked: !runFresh, run: () => setRunFresh(false) }
]));
const runner = setupRunR(toRun, packagesOf, () => editor.state.facet(NotebookRun)[0]?.(editor, runFresh));
/** cells share one R session, next to the project files as they are now */
function runCell(code: string, title: string, into?: HTMLElement, fresh = false): Promise<number | undefined> {
	return runner(() => Promise.resolve({ code, files: projectFiles(), fresh }), title, into);
}

/** the code one mark stands for: a whole line, one name on it, or what a linting rule reported */
function markRanges(mark: Mark): readonly ShownRange[] {
	const doc = editor.state.doc;
	if((Object.values(PlaygroundBox) as string[]).includes(mark)) {
		return [];   /* a box of the page, which stands for itself rather than for a place in the script */
	}
	if(mark.startsWith('lint:') || mark.startsWith('dep:')) {
		const found = mark.startsWith('lint:') ? shownLints : shownDeps;
		const [what, only] = mark.slice(mark.indexOf(':') + 1).split('@');
		return found
			.filter(one => ('rule' in one ? one.rule : one.kind) === what && (only === undefined || String(one.line) === only))
			.map(one => ({
				from: one.from, to: one.to, line: false,
			}));
	}
	const file = /\((.+)\)$/.exec(mark);
	try {
		if(file !== null && !new RegExp(file[1]).test(files[active].name)) {
			return [];
		}
	} catch{
		return [];
	}
	mark = (file === null ? mark : mark.slice(0, file.index)) as Mark;
	/* a name may carry an `@` itself, as `object@slot` does, so only the first one separates */
	const cut = mark.indexOf('@');
	const [lineText, columnText] = (cut < 0 ? mark : mark.slice(0, cut)).split(':');
	const name = cut < 0 ? undefined : mark.slice(cut + 1);
	const number = Number(lineText);
	if(!Number.isInteger(number) || number < 1 || number > doc.lines) {
		return [];
	}
	const line = doc.line(number);
	if(columnText !== undefined) {
		const column = Number(columnText);
		const found = Number.isInteger(column) && column > 0 ? targetAt(line.text, number, column - 1) : undefined;
		return found === undefined ? [] : [{ from: line.from + found.from, to: line.from + found.to, line: false }];
	}
	if(name === undefined) {
		return [{ from: line.from, to: line.to, line: true }];
	}
	const at = Playground.nameIndexIn(line.text, name);
	return at === undefined ? [] : [{ from: line.from + at, to: line.from + at + name.length, line: false }];
}

/** what touches or overlaps is one mark, so a name and the line it sits on do not draw a seam */
function mergedRanges(ranges: readonly ShownRange[]): ShownRange[] {
	const sorted = [...ranges].sort((a, b) => Number(b.line) - Number(a.line) || a.from - b.from || a.to - b.to);
	const merged: ShownRange[] = [];
	for(const range of sorted) {
		const last = merged[merged.length - 1];
		if(last !== undefined && last.line === range.line && !range.line && range.from <= last.to) {
			last.to = Math.max(last.to, range.to);
		} else {
			merged.push({ ...range });
		}
	}
	return merged;
}

/** whether the marks a link arrived with have been shown once; they pulse only that first time */
let unseenMarks = true;
/** how long the fade itself takes, after which what faded is taken out of the page and the link */
const FadeTakes = 1500;
/** how long a highlight stays before it fades out */
const MarksLinger = 6000;
let fadeTimer = 0;

/** puts every mark the link carries back on the code, and on the rows and boxes that stand for one */
function showMarks(): void {
	const ranges = mergedRanges(marks.flatMap(markRanges));
	const clear = document.getElementById('clearmarks');
	let marked = ranges.length > 0;
	const fresh = unseenMarks;
	editor.dispatch({ effects: setShown.of({ ranges, fresh }) });
	for(const row of document.querySelectorAll<HTMLElement>('[data-mark]')) {
		const mark = row.dataset.mark ?? '';
		/* `lint:<rule>` stands for every finding of that rule, so it lights the rows of each of them */
		const wanted = marks.some(m => m === mark || mark.startsWith(`${m}@`));
		/* a highlight one cannot see is no highlight, so what it points at is unfolded first */
		if(wanted) {
			revealRow(row);
		}
		row.classList.toggle('shown', wanted);
		row.classList.toggle('fresh', wanted && fresh);
		marked ||= wanted;
	}
	/* a highlight is there to be noticed, not to stay: it fades, and the link keeps it all the same */
	clearTimeout(fadeTimer);
	editor.dom.classList.remove('faded');
	panel.classList.remove('faded');
	if(marked) {
		fadeTimer = window.setTimeout(() => {
			editor.dom.classList.add('faded');
			panel.classList.add('faded');
			clear?.toggleAttribute('hidden', true);
			/* once it has faded there is nothing left to point at, so the link stops saying that there is */
			window.setTimeout(clearMarks, FadeTakes);
		}, MarksLinger);
	}
	if(marked && fresh) {
		unseenMarks = false;
		/* the animation runs twice and is then in the way of every later mark, so it is taken back off */
		setTimeout(showMarks, 2400);
	}
	/* a link that points at the repl is a link about the repl, so it opens on it */
	const drawer = document.getElementById('repl') as HTMLDetailsElement | null;
	if(drawer !== null && marks.includes(PlaygroundBox.Repl)) {
		drawer.open = true;
	}
	/* what it clears is what is lit, not what the link asks for: a mark the page cannot place (its code was
	   edited away, its row is not in the current answer) lights nothing, and nothing is what it clears */
	clear?.toggleAttribute('hidden', !marked);
}

/** takes every highlight out of the page and out of the link */
function clearMarks(): void {
	if(marks.length === 0) {
		return;
	}
	marks.length = 0;
	showMarks();
	remember();
}

/**
 * Alt-click points the link at what it hit, and points it away again when it hits the same thing twice.
 * It does not pile mark upon mark: holding shift as well is what adds one to those already there.
 */
function toggleMark(mark: string | undefined, add = false): void {
	mark = mark !== undefined && /^\d+[:@]?[^(]*$/.test(mark) ? scoped(mark) : mark;
	if(!Playground.Mark.isValid(mark)) {
		return;
	}
	const had = marks.includes(mark);
	const next = had ? marks.filter(other => other !== mark) : add ? [...marks, mark] : [mark];
	marks.length = 0;
	marks.push(...next);
	showMarks();
	remember();
	showShared(had ? `${mark} is no longer highlighted` : `${mark} is highlighted, the link carries it`);
}

/** what an alt-click in the code points at: the name under it, or the line it sits on */
function markUnderPointer(event: MouseEvent): string | undefined {
	const at = editor.posAtCoords({ x: event.clientX, y: event.clientY });
	if(at === null) {
		return undefined;
	}
	const line = editor.state.doc.lineAt(at);
	return targetAt(line.text, line.number, at - line.from)?.criterion ?? String(line.number);
}

/** the name under the cursor, as the criterion flowR slices for; the first name on the line otherwise */
function cursorTarget(): { readonly criterion?: string, readonly name?: string } {
	const at = editor.state.selection.main.head;
	const line = editor.state.doc.lineAt(at);
	if(!writesR(editor.state, files[active].name, line.number)) {
		return held;
	}
	const found = targetAt(line.text, line.number, at - line.from);
	const first = /[A-Za-z.][\w._]*/.exec(line.text);
	return held = {
		criterion: found !== undefined ? scoped(found.criterion) : first ? scoped(`${line.number}@${first[0]}`) : undefined,
		name:      found === undefined ? undefined : `${line.number}@${found.name}`
	};
}
const cursorCriterion = () => cursorTarget().criterion;
const cursorName = () => cursorTarget().name;

function section(title: string, box: PlaygroundBox, aside?: string, ...end: Node[]): HTMLElement {
	const head = el('h3', undefined, title);
	foldable(head, box);
	if(aside !== undefined) {
		head.append(el('span', 'aside', aside));
	}
	head.append(...end);
	const body = el('div', 'sbody');
	body.dataset.foldBody = box;
	panel.append(head, body);
	return body;
}

/** makes a heading fold the block under it, by pointer and by keyboard alike */
function foldable(head: HTMLElement, box: PlaygroundBox): void {
	head.dataset.fold = box;
	head.tabIndex = 0;
	head.setAttribute('role', 'button');
	/* the controls in a heading do their own thing, and folding the block is not it */
	const own = (event: Event) => (event.target as HTMLElement | null)?.closest('button, a, label, input') === null;
	head.addEventListener('click', event => {
		if(own(event)) {
			toggleFold(box);
		}
	});
	head.addEventListener('keydown', event => {
		if((event.key === 'Enter' || event.key === ' ') && own(event)) {
			event.preventDefault();
			toggleFold(box);
		}
	});
}

/** the boxes that are folded away, which a link carries so an example opens on what it is about */
let folded: PlaygroundBox[] = shared.folded;

/** folds a box away, or brings it back, and writes it into the link either way */
function toggleFold(box: PlaygroundBox): void {
	folded = folded.includes(box) ? folded.filter(other => other !== box) : [...folded, box];
	showFolds();
	remember();
}

/** what is folded and what is not, over whatever the panel holds right now */
function showFolds(): void {
	for(const head of document.querySelectorAll<HTMLElement>('#panel [data-fold]')) {
		const away = folded.includes(head.dataset.fold as PlaygroundBox);
		head.classList.toggle('folded', away);
		head.setAttribute('aria-expanded', String(!away));
		/* a folded box that holds something says so, or one folds a box and stops hearing from it */
		const body = document.querySelector<HTMLElement>(`#panel [data-fold-body="${head.dataset.fold}"]`);
		const holds = (body?.querySelectorAll('[data-mark], .card').length ?? 0) > 0;
		head.classList.toggle('holds', away && holds);
		head.title = away
			? `click to show this again${holds ? ', there is something under it' : ''}`
			: 'click to fold this away';
	}
	for(const body of document.querySelectorAll<HTMLElement>('#panel [data-fold-body]')) {
		body.hidden = folded.includes(body.dataset.foldBody as PlaygroundBox);
	}
}

/** the issue form, carrying the script as a link when it is short enough to travel in one */
const IssueTemplate = 'https://github.com/flowr-analysis/flowr/issues/new?template=linting-rule.yaml';
function issueUrl(): string {
	/* the paths, addresses, and secrets a script carries are nobody's business but the author's */
	const link = Playground.reportLink(editor.state.doc.toString(), { marks, at: cursorCriterion() });
	return link === undefined ? IssueTemplate
		: `${IssueTemplate}&description=${encodeURIComponent(`The script this is about, in the playground:\n\n${link}\n\n`)}`;
}

/* the linter is only as good as its rules, so the heading offers a way to ask for another one */
function suggestRule(): HTMLElement {
	const link = blank(el('a', 'suggest'));
	link.href = IssueTemplate;
	/* the script travels with the report, so it is read again where the link is followed, not before */
	link.addEventListener('mousedown', () => link.href = issueUrl());
	link.append(document.createTextNode('suggest'), tag(' a new rule', 'wide'));
	link.title = 'suggest a new linting rule, with this script attached to the report';
	return link;
}

function tag(text: string, cls = 'kind'): HTMLElement {
	return el('span', cls, text);
}

/** how many entries a category may hold for the view to unfold it on its own, as vscode-flowR's auto reveal does */
const AutoReveal = 5;
/** the entries unfolded or folded by hand, kept so a re-analysis does not undo it */
const unfoldedDeps = new Map<string, boolean>();
/** the entries the view shows, and the one last clicked, whose unrelated entries step back */
let shownTree: readonly DepNode[] = [];
let focusedKey: string | undefined;
let related: { readonly code: string, readonly key: string, readonly ids: ReadonlySet<string> } | undefined;
let focusRequest = 0;
let flashTimer = 0;

function isOpen(node: DepNode): boolean {
	return unfoldedDeps.get(node.key) ?? ((node.root && node.key !== 'no-findings' && node.children.length <= AutoReveal) || node.children.length === 1);
}

function setOpen(holder: HTMLElement, open: boolean, remember = true): void {
	holder.classList.toggle('open', open);
	holder.querySelector(':scope > .drow')?.setAttribute('aria-expanded', String(open));
	if(remember && holder.dataset.key !== undefined) {
		unfoldedDeps.set(holder.dataset.key, open);
	}
}

/** a highlight one cannot see is no highlight, so the entries around a marked row unfold */
function revealRow(row: HTMLElement): void {
	for(let at = row.parentElement?.closest<HTMLElement>('.dnode'); at; at = at.parentElement?.closest<HTMLElement>('.dnode')) {
		if(at.querySelector(':scope > .drow') !== row && !at.classList.contains('open')) {
			setOpen(at, true);
		}
	}
}

function linesOf(node: DepNode): number[] {
	return allNodes([node]).flatMap(n => n.target && n.target.file === undefined && n.id !== undefined ? [n.target.span[0]] : []);
}

function revealDependency(node: DepNode): void {
	const target = node.target;
	if(target === undefined) {
		return;
	}
	if(target.file !== undefined) {
		openFile(target.file);
	}
	const { from, to } = spanRange(target.span) ?? {};
	if(from === undefined || to === undefined) {
		return;
	}
	/* the head goes to the start, so the slice is for the call rather than for its closing parenthesis */
	editor.dispatch({ selection: { anchor: to, head: from }, scrollIntoView: true, effects: setFlash.of({ from, to, color: categoryInfo(node.kind).color }) });
	clearTimeout(flashTimer);
	flashTimer = window.setTimeout(() => editor.dispatch({ effects: setFlash.of(undefined) }), 2000);
	void run();
}

/** a `[startLine, startCol, endLine, endCol]` span as offsets into the open file, none when it lies outside */
function spanRange([startLine, startCol, endLine, endCol]: readonly number[]): { readonly from: number, readonly to: number } | undefined {
	const doc = editor.state.doc;
	if(startLine < 1 || startLine > doc.lines) {
		return undefined;
	}
	const from = doc.line(startLine).from + startCol - 1;
	const last = doc.line(Math.min(Math.max(endLine, startLine), doc.lines));
	return { from, to: Math.max(from, Math.min(last.to, last.from + endCol)) };
}

function familyOf(key: string, roots: readonly DepNode[]): DepNode[] | undefined {
	for(const root of roots) {
		if(root.key === key) {
			return allNodes([root]);
		}
		const below = familyOf(key, root.children);
		if(below !== undefined) {
			return [root, ...below];
		}
	}
	return undefined;
}

const DepsAside = '(click to go there)';
function paintRelated(): void {
	const family = focusedKey === undefined ? undefined : familyOf(focusedKey, shownTree);
	const keep = new Set(family?.map(n => n.key));
	const ids = related?.key === focusedKey ? related?.ids : undefined;
	const byKey = new Map(allNodes(shownTree).map(n => [n.key, n]));
	const aside = panel.querySelector<HTMLElement>(`[data-fold="${PlaygroundBox.Deps}"] .aside`);
	const focused = ids === undefined || focusedKey === undefined ? undefined : byKey.get(focusedKey)?.label;
	if(aside !== null) {
		aside.textContent = focused === undefined ? DepsAside : `(filtered for ${focused})`;
		aside.title = focused === undefined ? '' : 'the rest does not take part in it; click it again or into the code to show all';
		aside.classList.toggle('focusing', focused !== undefined);
	}
	for(const holder of panel.querySelectorAll<HTMLElement>('.deps .dnode')) {
		const node = byKey.get(holder.dataset.key ?? '');
		const row = holder.querySelector<HTMLElement>(':scope > .drow');
		if(node === undefined || row === null) {
			continue;
		}
		row.classList.toggle('selected', node.key === focusedKey);
		const own = nodeIds(node);
		const unrelated = ids !== undefined && own.length > 0 && !keep.has(node.key) && !own.some(id => ids.has(String(id)));
		row.classList.toggle('unrelated', unrelated);
		if(unrelated && node.children.length > 0 && holder.classList.contains('open')) {
			setOpen(holder, false, false);
			focusFolded.add(holder);
		} else if(!unrelated && focusFolded.delete(holder)) {
			setOpen(holder, true, false);
		}
	}
}
const focusFolded = new Set<HTMLElement>();

async function focusRelated(node: DepNode | undefined): Promise<void> {
	const request = ++focusRequest;
	focusedKey = node?.key;
	const code = JSON.stringify(projectFiles());
	if(node === undefined || (related?.key === node.key && related.code === code)) {
		paintRelated();
		return;
	}
	related = undefined;
	paintRelated();
	const ids = nodeIds(node);
	if(ids.length === 0) {
		return;
	}
	try {
		const built = await analyzer();
		const answer = await built.query([SliceDirection.Backward, SliceDirection.Forward].map(direction => ({
			type: 'static-slice', criteria: ids.map(id => `$${String(id)}`), direction, noReconstruction: true
		})) as never) as unknown as { 'static-slice'?: { results?: Record<string, { slice?: { result?: Iterable<NodeId> } }> } };
		if(request !== focusRequest) {
			return;
		}
		const sliced = Object.values(answer['static-slice']?.results ?? {}).flatMap(r => [...r.slice?.result ?? []]);
		related = { code, key: node.key, ids: new Set([...ids, ...sliced].map(String)) };
	} catch{ /* what cannot be sliced grays nothing out */ }
	paintRelated();
}

function depMessage(kind: string, said: { readonly name: string, readonly why: string }): Node {
	const at = el('span', 'cm-dep-says');
	const square = el('span', 'cm-dep-square', '\u25A0');
	square.style.color = categoryInfo(kind).color;
	at.append(square, ' ', el('strong', undefined, said.name), ' (flowR): ', said.why);
	return at;
}

function depEntry(node: DepNode, depth: number): HTMLElement {
	const holder = el('div', 'dnode');
	holder.dataset.key = node.key;
	const line = el('div', 'drow');
	line.setAttribute('role', 'treeitem');
	line.setAttribute('aria-level', String(depth + 1));
	line.tabIndex = 0;
	line.style.setProperty('--depth', String(depth));
	if(node.colored) {
		line.style.setProperty('--cat', categoryInfo(node.kind).color);
	}
	line.classList.toggle('grayed', node.root && (node.children.length === 0 || node.key === 'no-findings'));
	const twistie = node.children.length > 0 ? icon('chevron', 'twistie') : el('span', 'twistie');
	const label = el('span', node.implicit ? 'dlabel echo' : 'dlabel', node.label);
	if(node.implicit) {
		label.title = 'auto-printed: this result reaches stdout on its own';
	}
	line.append(twistie);
	if(node.icon !== undefined) {
		line.append(icon(node.icon, node.colored ? 'dicon colored' : 'dicon'));
	}
	line.append(label, el('span', 'ddesc', node.description ?? ''));
	if(node.target !== undefined && node.id !== undefined) {
		const actions = el('span', 'dactions');
		for(const [way, name, hint] of [
			[SliceDirection.Backward, 'arrow-up', 'show relevant code for the dependency (backward slice)'],
			[SliceDirection.Forward, 'arrow-down', 'show the influence of the dependency (forward slice)'],
			['removal', 'trash', 'show the code that can go with the dependency (removal slice)']
		] as const) {
			const action = button('daction', '', hint, event => (event.stopPropagation(), askSlice(way), revealDependency(node)));
			action.setAttribute('aria-label', hint);
			action.append(icon(name));
			actions.append(action);
		}
		line.append(actions);
	}
	line.title = node.tooltip ?? node.label;
	const at = node.target?.file === undefined && node.id !== undefined ? node.target?.span[0] : undefined;
	if(node.kind !== '') {
		line.dataset.mark = node.root ? `dep:${node.kind}` : at === undefined ? `dep:${node.kind}` : `dep:${node.kind}@${at}`;
	}
	linkRow(line, linesOf(node));
	const toggle = () => setOpen(holder, !holder.classList.contains('open'));
	twistie.addEventListener('click', event => {
		event.stopPropagation();
		toggle();
	});
	const activate = () => {
		if(node.target !== undefined) {
			revealDependency(node);
		} else if(node.children.length > 0) {
			toggle();
		}
		void focusRelated(focusedKey === node.key && node.target === undefined ? undefined : node);
	};
	line.addEventListener('click', activate);
	line.addEventListener('keydown', event => {
		if(event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			activate();
		} else if((event.key === 'ArrowRight' || event.key === 'ArrowLeft') && node.children.length > 0) {
			event.preventDefault();
			setOpen(holder, event.key === 'ArrowRight');
		}
	});
	holder.append(line);
	if(node.children.length > 0) {
		setOpen(holder, isOpen(node), false);
		const below = el('div', 'dchildren');
		below.setAttribute('role', 'group');
		below.append(...node.children.map(child => depEntry(child, depth + 1)));
		holder.append(below);
	}
	return holder;
}

/**
 * The signature database of this page: a browser opens no file, so the build writes the exports of every
 * package the playground may attach into it, and they are handed to the resolver as a source of their own.
 * That is what makes `library(dplyr)` bring dplyr's names into scope here as it does on a machine with the
 * database, down to `filter` being dplyr's rather than the one in `stats`.
 */
function packageSource(): FlowrAnalyzerPackageVersionsSigDbPlugin | undefined {
	return packageNames.length === 0 ? undefined
		: new FlowrAnalyzerPackageVersionsSigDbPlugin(memorySourceOfPackages(bakedPackages));
}
const packages = packageSource();

let ready: Promise<void> | undefined;
async function analyzer(code?: string, open?: string) {
	ready ??= TreeSitterExecutor.initTreeSitter(undefined, rWasm, treeSitterWasm);
	await ready;
	const builder = new FlowrAnalyzerBuilder().setParser(new TreeSitterExecutor());
	if(packages !== undefined) {
		/* the shipped resolver would look for database files, which a browser has none of */
		builder.unregisterPlugins(SigDbPluginName).registerPlugins(packages);
	}
	if(settings !== undefined) {
		builder.setConfig(settings);
	}
	const built = await builder.build();
	if(code !== undefined) {
		built.addRequest({ request: 'text', content: code });
	} else {
		/* `open` stands in for the open file, as it is about to be rather than as it is */
		built.addFile(...projectFiles().map(([name, text]) => new FlowrInlineTextFile(name, open !== undefined && name === files[active].name ? open : text)));
		built.addRequest(...files.filter(f => Analyzed.test(f.name)).map(f => ({ request: 'file' as const, content: f.name })));
	}
	return built;
}

interface Dependency {
	value?:              string,
	nodeId?:             string | number,
	functionName?:       string,
	linkedIds?:          readonly (string | number)[],
	implicit?:           boolean,
	/* semver ranges, which only a project with a DESCRIPTION or a lockfile around it ever carries */
	derivedRange?:       { format?: () => string },
	versionConstraints?: readonly { format?: () => string }[]
}

/** the version a project pins a package to, as the analysis derived it from the files around the script */
function versionRange(entry: Dependency): string | undefined {
	return [entry.derivedRange, ...entry.versionConstraints ?? []]
		.map(range => typeof range?.format === 'function' ? range.format() : undefined)
		.find((said): said is string => said !== undefined && said.length > 0);
}
interface Finding { loc?: SourceLocation, quickFix?: LintQuickFix[], involvedId?: string | number | (string | number)[] }

/* the finding whose details are open, which a new analysis opens again */
let openedLint: string | undefined;

/** the categories whose findings are errors, those of any other one warnings */
const ErrorCategories: ReadonlySet<string> = new Set(['bug', 'security']);
const isError = (rule: string): boolean => ErrorCategories.has(category(rule));

/** the first tag of a rule that says what kind of problem it is, which is what colours the chip */
function category(rule: string): string {
	const tags = (LintingRules as unknown as Record<string, { info?: { tags?: string[] } }>)[rule]?.info?.tags ?? [];
	/* a rule states what it is about first, so the colour follows its order rather than one made up here:
	   a network call is about reproducibility and only then about security, and it should not read as a leak */
	const known = ['security', 'bug', 'reproducibility', 'robustness', 'deprecated', 'performance',
		'style', 'smell', 'readability', 'usability', 'documentation'];
	return tags.find(t => known.includes(t)) ?? 'other';
}

/**
 * Carry the given quick fixes out on the script, which {@link LintQuickFixes.apply} does the same way every other
 * consumer of flowR gets them done. The edit is a document change like any other, so the analysis reruns on its own.
 */
function applyFixes(fixes: readonly LintQuickFix[]): void {
	const code = editor.state.doc.toString();
	const fixed = LintQuickFixes.apply(code, fixes);
	if(fixed !== code) {
		editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: fixed } });
	}
}

function ruleDetails(rule: string, fixes: readonly LintQuickFix[]): HTMLElement {
	const more = el('div', 'lintmore');
	const about = (LintingRules as unknown as Record<string, { info?: { description?: string } }>)[rule]?.info?.description;
	more.append(el('p', 'about', about ?? 'flowR has no description of this rule'));
	if(fixes.length === 0) {
		return more;
	}
	const code = editor.state.doc.toString();
	const before = code.split('\n'), after = LintQuickFixes.apply(code, fixes).split('\n');
	let head = 0;
	while(head < before.length && head < after.length && before[head] === after[head]) {
		head++;
	}
	let tail = 0;
	while(tail < before.length - head && tail < after.length - head && before[before.length - 1 - tail] === after[after.length - 1 - tail]) {
		tail++;
	}
	const diff = el('pre', 'diff');
	const show = (lines: readonly string[], sign: string) => {
		for(const text of lines.slice(0, 6)) {
			const row = el('span', sign === '-' ? 'del' : 'ins', `${sign} ${text}`);
			diff.append(row, '\n');
		}
		if(lines.length > 6) {
			diff.append(el('span', 'more', `  … ${lines.length - 6} more`), '\n');
		}
	};
	show(before.slice(head, before.length - tail), '-');
	show(after.slice(head, after.length - tail), '+');
	more.append(diff, fixButton(fixes, uniqueArray(fixes.map(fix => fix.description)).join('; ') || 'apply the fix', `line ${head + 1}: carry the fix out (ctrl+z takes it back)`));
	return more;
}

/** carries fixes out; the row itself links to the finding, so the click must not travel up to it */
function fixButton(fixes: readonly LintQuickFix[], label: string, title: string): HTMLElement {
	return button('fix', label, title, event => (event.stopPropagation(), applyFixes(fixes)));
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
		/* a call is its own origin, which says nothing the line does not */
		const from = uniqueArray((await originLines(origins)).filter(o => o.file !== undefined || o.line !== Number.parseInt(criterion)).map(o => o.file === undefined ? String(o.line) : `${o.file}:${o.line}`));
		/* `filter` is dplyr's once dplyr is attached, and flowR says so: `built-in:dplyr:filter` */
		const attached = origins.map(o => /^built-in:([^:]+):/.exec(o.proc ?? '')?.[1]).find(p => p !== undefined);
		answer = {
			said: [shape, resolved.length > 0 ? `value ${resolved.join(' or ')}` : undefined, from.length > 0 ? `defined in line ${from.join(', ')}` : undefined]
				.filter(Boolean).join(' · ') || undefined,
			pkg:   attached,
			local: origins.length > 0 && origins.every(o => o.proc === undefined)
		};
	} catch{ /* a name flowR cannot place */ }
	described.set(criterion, answer);
	return answer;
}

async function originLines(origins: { id: string | number }[] | undefined): Promise<{ line: number, file?: string }[]> {
	if(origins === undefined || origins.length === 0) {
		return [];
	}
	const map = (await (await analyzer()).normalize()).idMap;
	return origins.flatMap(o => {
		const node = map.get(o.id as never);
		const line = SourceRange.getStartLine(node?.location);
		return line === undefined ? [] : [{ line, file: elsewhere(node) }];
	});
}

function reveal(file: string | undefined, line: number | undefined): void {
	if(file !== undefined && files.some(f => f.name === file)) {
		openFile(file);
	}
	if(line !== undefined && (file === undefined || files[active].name === file)) {
		editor.dispatch({ selection: { anchor: editor.state.doc.line(Math.min(line, editor.state.doc.lines)).from }, scrollIntoView: true });
		editor.focus();
	}
}

function fileAt(pos: number): { readonly name: string, readonly from: number, readonly to: number } | undefined {
	const line = editor.state.doc.lineAt(pos);
	const literal = [...line.text.matchAll(/(["'])([^"'\n]+)\1/g)].find(m => (m.index ?? 0) <= pos - line.from && pos - line.from <= (m.index ?? 0) + m[0].length);
	const name = literal === undefined ? undefined : files.find(f => f.name === literal[2] || f.name.endsWith(`/${literal[2]}`))?.name;
	return name === undefined || literal === undefined ? undefined : { name, from: line.from + (literal.index ?? 0), to: line.from + (literal.index ?? 0) + literal[0].length };
}

/** where what a criterion names is defined, other than where it stands itself; asked once per analysis */
const definitions = new Map<string, Promise<{ readonly line: number, readonly file?: string } | undefined>>();
function definitionOf(criterion: string): Promise<{ readonly line: number, readonly file?: string } | undefined> {
	let found = definitions.get(criterion);
	if(found === undefined) {
		definitions.set(criterion, found = (async() => {
			const answers = await (await analyzer()).query([{ type: 'origin', criterion }] as never) as unknown as
				{ origin?: { results?: Record<string, { id: string | number }[] | undefined> } };
			const lines = await originLines(answers.origin?.results?.[criterion]);
			return lines.find(l => l.file !== undefined || l.line !== Number(/^\d+/.exec(criterion)?.[0]));
		})().catch(() => undefined));
	}
	return found;
}

async function jumpTarget(pos: number): Promise<{ readonly from: number, readonly to: number, go(): void } | undefined> {
	const file = fileAt(pos);
	if(file !== undefined) {
		return { ...file, go: () => openFile(file.name) };
	}
	const line = editor.state.doc.lineAt(pos);
	const found = targetAt(line.text, line.number, pos - line.from);
	if(found === undefined) {
		return undefined;
	}
	const at = { from: line.from + found.from, to: line.from + found.to };
	const away = (url: string | undefined) => url === undefined ? undefined : { ...at, go: () => void window.open(url, '_blank', 'noopener') };
	/* the order vscode-flowR goes in: a package opens its CRAN page, a project name its definition, else its implementation */
	if(namesPackage(line.text, found)) {
		return isBaseRPackage(found.name) ? undefined : away(cranPageUrl(found.name));
	}
	const target = await definitionOf(scoped(found.criterion));
	if(target !== undefined) {
		return { ...at, go: () => reveal(target.file, target.line) };
	}
	const about = await describe(scoped(found.criterion));
	const known = about.local ? undefined : signatureOf(found.name, ownerOf(found.name, about.pkg));
	return away(known?.source ?? known?.docs);
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
	return `https://mermaid.live/edit#base64:${toBase64(new TextEncoder().encode(state))}`;
}

/** opens a graph flowR builds in mermaid.live; the tab opens on the click, else the browser takes it for a popup */
function openView(which: keyof typeof Views, label: string): void {
	const tab = window.open('', '_blank');
	showTook(`building the ${label}…`);
	void Views[which]().then(code => {
		if(tab === null) {
			location.href = liveUrl(code);
		} else {
			tab.location.href = liveUrl(code);
		}
		showTook(`opened the ${label} in mermaid.live`);
	}, error => {
		tab?.close();
		showTook(`that did not work: ${String(error)}`);
	});
}
const graphEntries = (): MenuEntry[] => ['Open in mermaid.live', ...([
	['dataflow', 'dataflow graph'], ['cfg', 'control flow graph'], ['call', 'call graph'], ['ast', 'normalized AST']
] as const).map(([which, label]) => ({ label, run: () => openView(which, label) }))];
const graphsButton = document.getElementById('graphs') as HTMLElement;
graphsButton.addEventListener('click', () => openMenu(graphsButton, graphEntries()));
const moreButton = document.getElementById('more') as HTMLElement;
moreButton.addEventListener('click', () => openMenu(moreButton, [
	{ label: 'Reset example', run: () => document.querySelector<HTMLElement>('[data-sample]')?.click() },
	{ label: 'Copy link', run: () => copyLink() }, '', ...graphEntries()
]));

/** what flowR rebuilds of a slice: one text, or one per file of the project */
type Rebuilt = string | readonly { readonly path: string, readonly code: string }[];
const rebuiltText = (code: Rebuilt): string => typeof code === 'string' ? code : code.map(f => `${fileBanner(f.path)}\n${f.code}`).join('\n\n');

/** The bar over a slice and the lines under it, shared by the panel and the wide window. */
function sliceParts(kept: readonly number[], asked: string | undefined, wide: boolean, code?: Rebuilt): HTMLElement[] {
	let lines = code === undefined ? sliceLines(kept, wholeSlice) : el('div', 'slines rebuilt');
	for(const part of code === undefined ? [] : typeof code === 'string' ? [{ path: undefined, code }] : code) {
		const text = el('pre', 'scode');
		paint(part.code, text);
		lines.append(...part.path === undefined ? [] : [el('div', 'scell', part.path)], text);
	}
	const view = ways('how to show the slice', code === undefined
		? ([[false, 'slice', 'only the lines the slice keeps'], [true, 'in context', 'the whole script, with the rest stepped back']] as const).map(([inContext, label, hint]) => [label, hint, () => {
			if(wholeSlice !== inContext) {
				wholeSlice = inContext;
				remember();
				const next = sliceLines(kept, wholeSlice);
				lines.replaceWith(next);
				lines = next;
				view.querySelectorAll('.way').forEach(b => b.setAttribute('aria-pressed', String(b.textContent === label)));
			}
		}, inContext === wholeSlice] as const)
		: wide ? [] : [['inline source()', 'splice the files source() pulls in at the call, or keep each file apart', () => (inlineFiles = !inlineFiles, remember(), schedule(0)), inlineFiles] as const]);
	const bar = el('div', 'sbar');
	const copy = iconButton('swiden', 'copy the lines of the slice', 'M5.5 5.5h8v8h-8zM10.5 5.5v-3h-8v8h3', () => {
		void navigator.clipboard?.writeText(code === undefined ? kept.map(n => editor.state.doc.line(n).text).join('\n') : rebuiltText(code)).then(() => showTook('copied the slice'));
	});
	const widen = wide
		? iconButton('swiden', 'back to the panel (esc)', 'M4 4l8 8M12 4l-8 8', () => widen.closest('dialog')?.close())
		: iconButton('swiden', 'read the slice in a wide window', 'M9.5 2.5h4v4M13.5 2.5 9 7M6.5 13.5h-4v-4M2.5 13.5 7 9', () => showWideSlice(kept, asked, code));
	const adopt = button('sadopt', 'use as program', 'rewrite the program to what the slice keeps of it (ctrl+z takes it back)',
		() => (widen.closest('dialog')?.close(), void adoptSlice(typeof code === 'string' ? code : undefined)));
	bar.append(tag(code === undefined ? `${kept.length} of ${codeLines.length} lines of code` : `across ${files.filter(f => Analyzed.test(f.name)).length} files`, 'kept'), view, adopt, copy, widen);
	/* the panel folds a long slice to the lines the room holds, at least a few, the wide window shows all */
	const length = code === undefined ? kept.length : rebuiltText(code).split('\n').length;
	if(!wide && length > FoldedSliceLines) {
		lines.classList.add('folded');
		const unfold = () => (lines.classList.remove('folded'), lines.style.removeProperty('max-height'), more.remove());
		const more = button('sunfold', `show all ${length} lines`, '', unfold);
		requestAnimationFrame(() => {
			const line = parseFloat(getComputedStyle(lines).lineHeight) || 20;
			const room = panel.getBoundingClientRect().bottom - lines.getBoundingClientRect().top - more.getBoundingClientRect().height - line;
			const fits = Math.max(FoldedSliceLines, Math.floor(room / line));
			if(lines.scrollHeight <= fits * line) {
				unfold();
			} else {
				lines.style.maxHeight = `${fits * line}px`;
			}
		});
		return [bar, lines, more];
	}
	return [bar, lines];
}

function sliceTitle(asked: string | undefined): string {
	const pinned = pinnedCriteria().length;
	return `${direction === 'removal' ? 'Removal slice' : 'Program slice'}${pinned > 0 ? ` · ${pinned} pinned` : asked === undefined ? '' : ` · ${asked}`}`;
}

function iconButton(cls: string, title: string, path: string, onClick: () => void): HTMLButtonElement {
	const icon = button(cls, '', title, onClick);
	icon.setAttribute('aria-label', title);
	icon.innerHTML = `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="${path}"/></svg>`;
	return icon;
}

/** a row of buttons of which the pressed one is the current choice */
function ways(label: string, options: readonly (readonly [string, string, () => void, boolean])[]): HTMLElement {
	const group = el('span', 'ways');
	group.setAttribute('role', 'group');
	group.setAttribute('aria-label', label);
	for(const [text, hint, pick, pressed] of options) {
		const way = button('way', text, hint, pick);
		way.setAttribute('aria-pressed', String(pressed));
		group.append(way);
	}
	return group;
}

/** the fewest lines of a slice the panel shows when it folds the rest away */
const FoldedSliceLines = 3;

function showWideSlice(kept: readonly number[], asked: string | undefined, code?: Rebuilt): void {
	let dialog = document.getElementById('slicewide') as HTMLDialogElement | null;
	if(dialog === null) {
		dialog = Object.assign(document.createElement('dialog'), { id: 'slicewide' });
		dialog.addEventListener('click', event => {
			if(event.target === dialog) {
				dialog?.close();
			}
		});
		document.body.append(dialog);
	}
	const card = el('div', 'card slice-view slice-wide');
	card.append(...sliceParts(kept, asked, true, code));
	dialog.replaceChildren(el('h3', undefined, sliceTitle(asked)), card);
	dialog.showModal();
}

const CellStart = /^# %%/;

/** The slice as the lines it keeps under their original numbers, what it leaves out folded into a gap or stepped back. */
function sliceLines(kept: readonly number[], inContext: boolean): HTMLElement {
	const doc = editor.state.doc;
	const keep = new Set(kept);
	const list = el('div', inContext ? 'slines context' : 'slines');
	const cellOf = cellTitles(editor.state, files[active].name);
	let cellShown: string | undefined;
	let skipped = 0;
	const gap = () => {
		if(skipped > 0 && list.childElementCount > 0) {
			list.append(el('div', 'sgap', `${skipped} line${skipped === 1 ? '' : 's'} not in the slice`));
		}
		skipped = 0;
	};
	for(let n = 1; n <= doc.lines; n++) {
		const text = doc.line(n).text;
		if(CellStart.test(text)) {
			continue;
		}
		if(!inContext && !keep.has(n)) {
			skipped++;
			continue;
		}
		gap();
		const cell = cellOf(n);
		if(cell !== undefined && cell !== cellShown) {
			cellShown = cell;
			list.append(el('div', 'scell', cell));
		}
		const row = el('div', keep.has(n) ? 'sline' : 'sline out');
		const number = button('sno', String(n), `go to line ${n}`, () => (list.closest('dialog')?.close(), reveal(undefined, n)));
		const line = el('code', 'stext');
		paint(text, line);
		row.append(number, line);
		list.append(row);
	}
	return list;
}

function showProject(project: ProjectQueryResult): void {
	const needs = project.dependencies;
	const facts = [
		['package', project.name && `${project.name}${project.version ? ` ${project.version}` : ''}`],
		['kind', project.kind],
		['authors', project.authors?.map(rAuthorInfoToReadable).join(', ')],
		['license', project.licenses?.map(stringifyRLicense).join(', ')],
		['R', needs?.rVersion ?? project.rVersion],
		['needs', needs && needs.runtime + needs.suggests > 0 ? `packages: ${needs.imports} imported, ${needs.depends} attached, ${needs.suggests} suggested` : undefined]
	] as const;
	const list = el('div', 'facts');
	for(const [name, value] of facts) {
		if(value) {
			list.append(el('span', 'fname', name), el('span', 'fvalue', value));
		}
	}
	section('Project', PlaygroundBox.Project, 'from the DESCRIPTION').append(list);
}

/** what the last slice was taken for, which is what replacing the program with it slices again */
let lastCriteria: readonly string[] = [];

const sameFile = (path: string | undefined, name: string): boolean => path === name || path?.endsWith(`/${name}`) === true;

/** What the slice keeps of each file, unless `inlined` splices in the files `source()` pulls in. Each code cell gets the reconstruction within it. */
async function slicedFiles(inlined: string | undefined): Promise<ReadonlyMap<string, string>> {
	if(inlined !== undefined && inlineFiles) {
		return new Map([[files[active].name, inlined]]);
	}
	const built = await analyzer();
	const ast = await built.normalize();
	const answer = await built.query([{
		type: 'static-slice', criteria: lastCriteria, includeCallees: true, noReconstruction: true,
		...direction === 'removal' ? { removal: true } : { direction }
	}] as never) as unknown as { 'static-slice'?: { results?: Record<string, { slice?: { result?: Iterable<NodeId> } }> } };
	const result = new Set(Object.values(answer['static-slice']?.results ?? {})[0]?.slice?.result ?? []);
	const kept = direction === 'removal' ? keptAfterRemoval(ast, result) : result;
	return new Map(files.filter(file => Analyzed.test(file.name)).map(file => {
		const index = ast.ast.files.findIndex(f => sameFile(f.filePath, file.name));
		return [file.name, rewriteCells(stateOf(files.indexOf(file)), file.name, (from, to) => {
			const nodes = new Set([...kept].filter(id => {
				const node = ast.idMap.get(id);
				const line = SourceRange.getStartLine(node?.location);
				return sameFile(node?.info.file, file.name) && line !== undefined && line >= from && line <= to;
			}));
			return nodes.size === 0 || index < 0 ? '' : String(reconstructToCode(ast, { nodes, reconstructFiles: [index] }).code);
		})];
	}));
}

/** Replaces the program with the slice, keeping files like DESCRIPTION; the editor's history can take it back. */
async function adoptSlice(inlined?: string): Promise<void> {
	const sliced = await slicedFiles(inlined);
	for(const [at, file] of files.entries()) {
		const code = Analyzed.test(file.name) ? sliced.get(file.name) ?? '' : undefined;
		if(code === undefined) {
			continue;
		}
		if(at === active) {
			editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: code } });
		} else {
			file.state = file.state.update({ changes: { from: 0, to: file.state.doc.length, insert: code } }).state;
		}
	}
	showTook('the program is now the slice');
	schedule();
	remember();
}

function slicesFor(criteria: readonly string[]): object[] {
	const query = (of: readonly string[]) => ({
		type: 'static-slice', criteria: of, includeCallees: true, inlineSources: files.length > 1 && inlineFiles && 'banner', perFile: files.length > 1 && !inlineFiles,
		...direction === 'removal' ? { removal: true } : { direction }
	});
	return criteria.length === 0 ? [] : intersect && criteria.length > 1 ? criteria.map(c => query([c])) : [query(criteria)];
}

/** everything the panel shows, from one analysis of the current text */
async function analyze(): Promise<number> {
	const started = performance.now();
	const criterion = cursorCriterion();
	const asked = cursorName();
	const built = await analyzer();
	const step = async<T>(run: () => Promise<T>): Promise<[T, number]> => {
		const at = performance.now();
		return [await run(), performance.now() - at];
	};
	const [, parsed] = await step(() => built.parse());
	const [normalized, normalizing] = await step(() => built.normalize());
	const [info, dataflow] = await step(() => built.dataflow());
	const idMap = normalized.idMap;
	const answers = await built.query([
		{ type: 'dependencies' },
		{ type: 'linter' },
		...files.some(f => /(^|\/)DESCRIPTION$/.test(f.name)) ? [{ type: 'project' }] : [],
		...slicesFor(lastCriteria = pinnedCriteria().length > 0 ? pinnedCriteria() : criterion === undefined ? [] : [criterion])
	] as never) as unknown as {
		dependencies?:   Record<string, readonly Dependency[]>,
		project?:        ProjectQueryResult,
		linter?:         { results?: Record<string, { results?: Finding[], '.meta'?: object }>, '.meta'?: { timing?: number } },
		'static-slice'?: { results?: Record<string, { reconstruct?: { code?: string | readonly string[], files?: readonly { path?: string, code: string }[] }, slice?: { result?: Iterable<string | number> } }> }
	};
	const took = performance.now() - started;
	showStats({ parse: parsed, normalize: normalizing, dataflow, lint: answers.linter?.['.meta']?.timing ?? 0 }, info.graph);

	panel.replaceChildren();
	panel.classList.add('fresh');
	requestAnimationFrame(() => requestAnimationFrame(() => panel.classList.remove('fresh')));
	if(answers.project !== undefined) {
		showProject(answers.project);
	}

	const sliced = Object.values(answers['static-slice']?.results ?? {});
	const parts = sliced[0]?.reconstruct?.files?.filter(f => f.code.trim() !== '').map(f => ({ path: f.path ?? 'unknown', code: f.code }));
	const reconstructed = sliced[0]?.reconstruct?.code;
	const code: Rebuilt | undefined = parts ?? (typeof reconstructed === 'object' ? reconstructed.join('\n') : reconstructed);
	const linesOf = (result: Iterable<string | number> = []) => uniqueArray([...result]
		.map(id => idMap?.get(id as never)).filter(node => elsewhere(node) === undefined).map(node => SourceRange.getStartLine(node?.location))
		.filter((l): l is number => typeof l === 'number'));
	const sliceLinesOf = sliced.map(r => linesOf(r.slice?.result)).reduce<number[] | undefined>((a, b) => a?.filter(l => b.includes(l)) ?? b, undefined) ?? [];
	/* a removal slice keeps what is left once its lines are gone, which is the program one goes on with */
	const doc = editor.state.doc;
	/* the lines that hold code, which a slice keeps a share of: not the prose, fences, and blank lines of a notebook */
	codeLines = linesOf([...idMap?.entries() ?? []].filter(([, node]) => node.info.parent !== undefined).map(([id]) => id));
	const keptLines = direction !== 'removal' || sliced.length === 0 ? sliceLinesOf : codeLines.filter(l => !sliceLinesOf.includes(l));
	lastKept = keptLines;
	dim();

	const dimmer = el('label', 'toggle switch');
	const box = document.createElement('input');
	box.type = 'checkbox';
	box.checked = dimOutside;
	box.addEventListener('change', () => {
		dimOutside = box.checked;
		dim();
		remember();
	});
	dimmer.append(box, document.createTextNode('dim'), tag(' the rest', 'wide'));
	/* the same pair the landing page offers: what this value is built from, or what depends on it */
	const sliceBody = section(sliceTitle(asked), PlaygroundBox.Slice, undefined, ways('which way to slice', ([
		[SliceDirection.Backward, 'origin', 'what this value is built from'],
		[SliceDirection.Forward, 'impact', 'what depends on this value'],
		['removal', 'removal', 'what can go together with this value, the rest keeps working']
	] as const).map(([value, label, hint]) => [label, hint, () => direction === value || (direction = value, remember(), void run()), value === direction] as const)), dimmer);
	/* the slice is built here, where the answer is, and moved below what the panel says about the script */
	const sliceBlock = [sliceBody.previousElementSibling as HTMLElement, sliceBody];
	const slice = el('div', 'card slice-view');
	slice.dataset.mark = PlaygroundBox.Slice;
	if(code === undefined || (direction === 'removal' && sliceLinesOf.length === 0)) {
		slice.append(el('p', 'hint', code === undefined ? 'put the cursor on a name to slice for it' : 'nothing can go with it: the rest of the script needs all of it'));
	} else {
		const rebuilt = keptLines.length === 0 || files.length > 1 ? code : undefined;
		slice.append(...sliceParts(keptLines, asked, false, rebuilt));
		if(showWide) {
			showWideSlice(keptLines, asked, rebuilt);
		}
	}
	showWide = false;
	sliceBody.append(slice);

	/* whatever the dependencies query answers with, so a new category shows up here without a second list */
	const answered = Object.entries(answers.dependencies ?? {}).filter((e): e is [string, readonly Dependency[]] => Array.isArray(e[1]));
	const flat = answered.flatMap(([kind, list]) => list.map(entry => {
		const node = idMap?.get(entry.nodeId as never);
		const value = entry.value === undefined || entry.value === 'unknown' ? undefined : entry.value;
		const call = entry.functionName === undefined ? undefined : String(Identifier.getName(entry.functionName));
		const file = elsewhere(node);
		return { kind, entry, node, value, call, file, line: file === undefined ? SourceRange.getStartLine(node?.location) : undefined };
	}));
	attached = new Set(flat.filter(d => d.kind === 'library' && d.value !== undefined).map(d => d.value as string));
	/* where each package is asked for, so hovering its name says what this script does with it */
	attachedLines.clear();
	qualifiedLines.clear();
	for(const d of flat) {
		if(d.kind !== 'library' || d.value === undefined || d.line === undefined) {
			continue;
		}
		const where = d.call === '::' || d.call === ':::' ? qualifiedLines : attachedLines;
		const lines = where.get(d.value) ?? [];
		if(!lines.includes(d.line)) {
			lines.push(d.line);
		}
		where.set(d.value, lines);
	}
	versionAsked.clear();
	for(const entry of answers.dependencies?.library ?? []) {
		const asked = entry.value === undefined ? undefined : versionRange(entry);
		if(asked !== undefined) {
			versionAsked.set(entry.value as string, asked);
		}
	}
	shownDeps = flat.flatMap((d): ShownDep[] => {
		const span = RNode.span(d.node) ?? d.node?.location;
		const at = d.file === undefined && span !== undefined ? spanRange(span) : undefined;
		return at === undefined || span === undefined ? [] : [{ kind: d.kind, line: span[0], ...at, said: describeDependency(d.kind, d.entry as never) }];
	});
	const kinds = new Map(uniqueArray(shownDeps.map(d => d.line as number)).map(line => [line, primaryCategory(shownDeps.filter(d => d.line === line).map(d => d.kind))] as const));
	editor.dispatch({ effects: setCategories.of([...kinds].map(([line, kind]) => ({ line, kind, joins: `${kinds.get(line - 1) === kind ? ' up' : ''}${kinds.get(line + 1) === kind ? ' down' : ''}` }))) });

	const tree = dependencyTree((answers.dependencies ?? {}) as never, {
		ast:       normalized,
		fileOf:    elsewhere,
		versionOf: pkg => bakedPackages[pkg]?.[0] || undefined,
		textAt:    span => {
			const at = spanRange(span);
			return at && doc.sliceString(at.from, at.to);
		}
	});
	shownTree = [...tree.roots, ...tree.empty.length > 0 ? [noFindingsGroup(tree.empty)] : []];
	const depBody = section('Overview', PlaygroundBox.Deps, DepsAside);
	const rows = el('div', 'deps');
	rows.setAttribute('role', 'tree');
	rows.dataset.mark = PlaygroundBox.Deps;
	rows.append(...shownTree.map(node => depEntry(node, 0)));
	depBody.append(rows);
	if(focusedKey !== undefined) {
		void focusRelated(allNodes(shownTree).find(node => node.key === focusedKey));
	}

	const found = Object.entries(answers.linter?.results ?? {}).flatMap(([rule, per]) =>
		(per?.results ?? []).map(f => {
			/* the linter names the file of a finding, which may be another one of the project than the one shown */
			const named = f.loc?.[4];
			const file = named === undefined ? elsewhere(idMap?.get([f.involvedId ?? []].flat()[0] as never)) : named === files[active].name ? undefined : named;
			/* a finding about the project as a whole points at no line, which the linter writes as a negative one */
			const at = (f.loc?.[0] ?? 0) > 0 ? f.loc?.[0] : undefined;
			const loc = file === undefined && at !== undefined ? f.loc : undefined;
			return { rule, file, at, line: loc?.[0], loc, quickFix: f.quickFix ?? [], message: explain(rule, f, per?.['.meta']) };
		})).sort((a, b) => Number(isError(b.rule)) - Number(isError(a.rule)));
	const marked = found.flatMap(f => {
		const [startLine, startCol, endLine, endCol] = f.loc ?? [];
		/* a rule may point outside this file, e.g. at the project around it */
		if(startLine === undefined || startLine !== endLine || startCol === undefined || endCol === undefined || startLine < 1 || startLine > editor.state.doc.lines) {
			return [];
		}
		const line = editor.state.doc.line(startLine);
		return [{
			rule:    f.rule, line:    startLine,
			from:    line.from + startCol - 1, to:      Math.min(line.to, line.from + endCol),
			message: `${f.rule}: ${f.message}`
		}];
	});
	editor.dispatch({ effects: setLints.of(marked) });
	shownLints = marked;
	const fixable = found.flatMap(f => f.quickFix);
	const acts = el('span', 'acts');
	acts.append(...fixable.length > 0 ? [fixButton(fixable, `fix ${fixable.length}`, uniqueArray(fixable.map(fix => fix.description)).join('\n'))] : [], suggestRule());
	const errors = found.filter(f => isError(f.rule)).length;
	const lintBody = section(`Lints: ${found.length}`, PlaygroundBox.Lints,
		found.length === 0 ? undefined : [errors > 0 ? `${errors} error${errors === 1 ? '' : 's'}` : '', found.length > errors ? `${found.length - errors} warning${found.length - errors === 1 ? '' : 's'}` : ''].filter(Boolean).join(' · '), acts);
	const lints = el('div', 'lints');
	lints.dataset.mark = PlaygroundBox.Lints;
	for(const f of found) {
		const said = el('span', 'says', f.message);
		const chip = el('span', 'rule');
		chip.dataset.category = category(f.rule);
		chip.append(tag(f.rule, 'rulename'));
		if(f.quickFix.length > 0) {
			chip.classList.add('fixable');
			chip.append(tag('fix', 'offer'));
		}
		/* a narrow panel cuts the name short, so the whole of it waits under the pointer */
		chip.title = f.quickFix.length > 0 ? `${f.rule}: ${uniqueArray(f.quickFix.map(fix => fix.description)).join('; ')}` : f.rule;
		if(f.quickFix.length > 0) {
			chip.addEventListener('click', event => (event.stopPropagation(), applyFixes(f.quickFix)));
		}
		/* one element per finding, so the hover lights the whole row; the columns still line up
		   because the row borrows the surrounding grid */
		const line = el('div', 'lint');
		line.dataset.category = chip.dataset.category;
		/* alt-click makes a link out of this one finding, which is how a new rule gets shown off */
		line.dataset.mark = f.line === undefined ? `lint:${f.rule}` : `lint:${f.rule}@${f.line}`;
		line.title = 'a click goes there, alt-click highlights this finding in the link';
		line.append(chip, said, tag(f.file === undefined ? f.line ? `L${f.line}` : 'project' : `${f.file}${f.at ? `:${f.at}` : ''}`, 'at'));
		/* one rule may report several findings on a line (two undefined names in one call), so the column and message tell them apart */
		const lintKey = `${f.rule}@${f.file ?? ''}:${f.at ?? ''}:${f.loc?.[1] ?? ''}:${f.message}`;
		line.addEventListener('click', event => {
			if(event.altKey || (event.target as HTMLElement).closest('.lintmore') !== null) {
				return;
			}
			openedLint = openedLint === lintKey ? undefined : lintKey;
			lints.querySelectorAll('.lintmore').forEach(more => more.remove());
			if(openedLint === lintKey) {
				line.append(ruleDetails(f.rule, f.quickFix));
			}
			reveal(f.file, f.at);
		});
		if(openedLint === lintKey) {
			line.append(ruleDetails(f.rule, f.quickFix));
		}
		lints.append(linkRow(line, [f.line]));
	}
	lintBody.append(found.length === 0 ? el('p', 'empty', 'no findings') : lints);
	panel.append(...sliceBlock);
	showFolds();
	showMarks();
	return took;
}

let wholeSlice = shared.wholeSlice;
let inlineFiles = shared.inline;

/* whether the lines outside the slice step back in the editor, what the last slice kept, and which way it runs */
let dimOutside = shared.dim, lastKept: readonly number[] = [], codeLines: readonly number[] = [];
let working = false, again = false;
async function run(): Promise<void> {
	if(working) {
		again = true;
		return;
	}
	working = true;
	described.clear();
	definitions.clear();
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

document.getElementById('clearmarks')?.addEventListener('click', () => (clearMarks(), showShared('the highlights are cleared')));

function showExample(project: readonly [string, string][], note: string): void {
	openTabs = project.map(([name]) => name).filter(name => Analyzed.test(name));
	openFile(Playground.MainFile, () => (scrolledTo.clear(), files.splice(0, files.length, ...project.map(([name, text]) => ({ name, state: fileState(name, text) })))));
	showTab(false);
	config.dispatch({ changes: { from: 0, to: config.state.doc.length, insert: Defaults } });
	/* an example is the script together with everything a link says about it, so what was folded away,
	   highlighted, or sliced the other way comes back as well. The pane sizes and the repl stay as they
	   are: those are how one works, not what one is looking at */
	marks.length = 0;
	folded = [];
	/* what earlier runs left in R and printed belongs to the code they ran, not to this one */
	for(const id of ['runrclear', 'runrclose']) {
		document.getElementById(id)?.click();
	}
	negative = false;
	direction = SliceDirection.Backward;
	dimOutside = false;
	wholeSlice = false;
	editor.dispatch({ effects: setSlice.of(undefined) });
	showMarks();
	showFolds();
	remember();
	showShared(note);
}
/* the site keeps the playgrounds of the last releases (see `keep-playground-versions.ts`), which open with the same script */
const siteRoot = location.pathname.replace(/v\/[^/]+\/?$/, '');
const versionTag = document.getElementById('version');
const release = versionTag?.dataset.release?.replace(/^v/, '');
void fetch(`${siteRoot}v/index.json`).then(r => r.ok ? r.json() as Promise<string[]> : [], () => []).then((versions: readonly string[]) => {
	const go = (to: string) => () => location.assign(`${to}${location.search}${location.hash}`);
	/* a link that insists on a release opens it, or the kept one of the same minor release */
	const asked = shared.release;
	if(asked !== undefined && asked !== release) {
		const minor = (v: string) => v.split('.').slice(0, 2).join('.');
		const kept = versions.includes(asked) ? asked : versions.find(v => minor(v) === minor(asked));
		if(kept === undefined || kept === release) {
			showShared(`the link asks for flowR ${asked}, which this site no longer keeps`);
		} else {
			go(`${siteRoot}v/${kept}/`)();
		}
	}
	const pick = iconButton('versions', 'open the playground of an earlier release', 'M4 6l4 4 4-4', () => openMenu(pick, [
		'Playground of', { label: 'the current release', run: go(siteRoot) },
		...versions.length === 0 ? ['no earlier release kept on this site'] : versions.map(v => ({ label: `flowR ${v}`, run: go(`${siteRoot}v/${v}/`) })),
		...release === undefined ? [] : ['', { label: `Copy a link to flowR ${release}`, title: 'the link opens this release of flowR, also once newer ones are out', run: () => copyLink(release) }]
	]));
	pick.setAttribute('aria-haspopup', 'menu');
	versionTag?.after(pick);
});

document.querySelector('[data-sample]')?.addEventListener('click', () => showExample([[Playground.MainFile, Sample]], 'the example is back'));
/* a reset turns its arrow once around; the class goes again so the next click turns it again */
for(const button of document.querySelectorAll<HTMLElement>('.spins')) {
	button.addEventListener('click', () => {
		button.classList.remove('spinning');
		void button.offsetWidth;
		button.classList.add('spinning');
	});
	button.addEventListener('animationend', () => button.classList.remove('spinning'));
}

/**
 * Copies the link that brings this playground back, which the button and `ctrl+s` both ask for.
 * The cursor is written here rather than in {@link remember}, so the address bar does not churn on every click.
 */
function copyLink(pinned?: string): void {
	const fields = [...shareFields().filter(([key]) => key !== 'r'), ...pinned === undefined ? [] : [['r', pinned] as [string, string]]];
	const head = editor.state.selection.main.head;
	const line = editor.state.doc.lineAt(head);
	if(line.number > 1 || head > line.from) {
		fields.push(['p', `${line.number}:${head - line.from + 1}`]);
	}
	const hash = Playground.hash(fields);
	/* the link of a release goes to the site's playground, which sends it on to wherever that release is kept */
	const link = (pinned === undefined ? location.href.replace(/#.*$/, '') : location.origin + siteRoot) + (hash.length > 0 ? `#${hash}` : '');
	void navigator.clipboard?.writeText(link).then(
		() => showShared('link copied'),
		() => {
			try {
				history.replaceState(null, '', link);
				showShared('could not copy, the link is in the address bar');
			} catch{
				showShared('could not copy, and this browser will not put the link in the address bar');
			}
		}
	);
}

document.getElementById('share')?.addEventListener('click', () => copyLink());

/* there is nothing to save here, so `ctrl+s` keeps the script the only way this page can: as a link */
document.addEventListener('keydown', event => {
	if((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 's') {
		event.preventDefault();
		copyLink();
	}
});
editor.dom.addEventListener('click', event => {
	if(event.ctrlKey || event.metaKey) {
		void jumpTarget(editor.state.selection.main.head).then(target => target === undefined ? showTook('no definition found here') : target.go());
	} else if(event.altKey) {
		event.preventDefault();
		toggleMark(markUnderPointer(event), event.shiftKey);
	}
});
/* alt-m marks what the cursor is on, which is what alt-click does to what the pointer is on */
editor.dom.addEventListener('keydown', event => {
	if(event.altKey && (event.key === 'm' || event.key === 'M')) {
		event.preventDefault();
		const at = editor.state.selection.main.head;
		const line = editor.state.doc.lineAt(at);
		toggleMark(targetAt(line.text, line.number, at - line.from)?.criterion ?? String(line.number), event.shiftKey);
	}
});

/* alt-click marks a row rather than doing what a plain click on it does, so it runs before the row does */
document.addEventListener('click', event => {
	const row = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-mark]');
	if(event.altKey && row !== null && row !== undefined) {
		event.preventDefault();
		event.stopPropagation();
		toggleMark(row.dataset.mark, event.shiftKey);
	}
}, true);

if(shared.config !== undefined) {
	readSettings();   /* a configuration from the link is what the first analysis has to run with */
}

/**
 * flowR's own repl over the script in the editor: the page hands {@link replProcessAnswer} a place to write
 * to and lets it dispatch, so every command the repl carries is here and none of them is written twice.
 * What needs a machine (an R session, files, the scripts) says so itself when asked.
 */
const replOut = document.getElementById('replout');
const replIn = document.getElementById('replin') as HTMLInputElement | null;

/** commands like `:dataflow*` answer with a url, and a url one cannot click is a url one has to select */
const Url = /(https?:\/\/\S+)/g;

function say(text: string, how?: string): void {
	if(replOut === null || text.length === 0) {
		return;
	}
	const line = el('div', how);
	for(const [at, part] of text.split(Url).entries()) {
		if(at % 2 === 0) {
			line.append(part);
			continue;
		}
		const link = blank(el('a'));
		link.href = part;
		/* the whole base64 of a graph is unreadable and endless, so the link says where it goes */
		link.textContent = part.length > 60 ? `${part.slice(0, part.indexOf('#') + 1) || part.slice(0, 40)}…` : part;
		link.title = part;
		line.append(link);
	}
	replOut.append(line);
	replOut.scrollTop = replOut.scrollHeight;
}

/**
 * A command that shells out to one of flowR's scripts (`:benchmark`, `:slicer`, ...) needs a machine to run
 * it on, which a page is not. They are refused before the repl gets to try, statement by statement, the same
 * way {@link replProcessAnswer} splits them.
 */
function refusedScript(line: string): string | undefined {
	for(const statement of splitAtEscapeSensitive(line, false, /^;\s*:/)) {
		const name = /^\s*:(\S+)/.exec(statement)?.[1];
		if(name !== undefined && getCommand(name)?.script === true) {
			return `:${name} runs one of flowR's own scripts, which this page has no machine for`;
		}
	}
	return undefined;
}

const replSink: ReplOutput = {
	formatter: voidFormatter,
	/* a command may colour its own output whatever the formatter says, and `[0m` is not a colour here */
	stdout:    text => say(stripAnsi(text)),
	stderr:    text => say(stripAnsi(text), 'bad')
};

const replHistory: string[] = [];
let replAt = 0;

/** how many repl commands a link carries, so a showcase stays a showcase and not a program */
const MaxSharedCommands = 8;

/** the commands typed into the repl, which a link carries so a showcase opens on what it showed */
let replSaid: string[] = shared.said;

/**
 * What the line typed so far can go on with, as a list above it that follows the typing: flowR's own completer
 * decides, so the page offers exactly what the terminal repl does, and says what each command is for.
 */
const replHints = document.getElementById('replhints');
let hints: { insert: string, label: string, says: string, docs?: string }[] = [];
let hintsFrom = '';
/** the hint the arrow keys moved to, none until they move */
let hinted = -1;

function showHints(): void {
	if(replIn === null || replHints === null) {
		return;
	}
	const line = replIn.value;
	const [options, fragment, labels] = line.trim().length === 0 ? [[], ''] : computeCompletions(line, settings ?? FlowrConfig.default());
	hintsFrom = fragment;
	/* an alias is a second name for a command already listed, so it joins that row rather than taking its own */
	const commandOf = (insert: string) => getCommand(/^:(\S+) $/.exec(insert)?.[1] ?? '');
	hints = options.filter(option => option.trim() !== fragment && !commandOf(option)?.aliases.includes(option.trim().slice(1))).map(insert => {
		const shown = insert.trim();
		const labelled = stripAnsi(labels?.get(insert) ?? '').slice(shown.length).trim();
		const command = commandOf(insert);
		const aliases = command?.aliases.map(alias => `:${alias}`).join(', ');
		const query = (SupportedQueries as Record<string, { title: string, syntax?: string } | undefined>)[shown.replace(/^@/, '')];
		if(query !== undefined) {
			return { insert, label: shown, says: [query.title, query.syntax].filter(Boolean).join(': '), docs: `${FlowrWikiBaseRef}/${encodeURIComponent(queryWikiPage(query.title).replaceAll(' ', '-'))}` };
		}
		return { insert, label: shown, says: labelled || [command?.description, aliases && `(${aliases})`].filter(Boolean).join(' ') };
	});
	hinted = Math.min(hinted, hints.length - 1);
	replHints.replaceChildren(...hints.map((hint, at) => {
		const item = el('li');
		item.setAttribute('role', 'option');
		item.setAttribute('aria-selected', String(at === hinted));
		item.append(el('b', undefined, hint.label));
		if(hint.says) {
			item.append(el('span', undefined, hint.says));
		}
		if(hint.docs !== undefined) {
			const docs = link('docs', hint.docs, 'hintdocs');
			docs.addEventListener('mousedown', event => event.stopPropagation());
			item.append(docs);
		}
		item.addEventListener('mousedown', event => {
			event.preventDefault();
			takeHint(at);
		});
		return item;
	}));
	replHints.hidden = hints.length === 0;
	replIn.setAttribute('aria-expanded', String(hints.length > 0));
	replHints.children[hinted]?.scrollIntoView({ block: 'nearest' });
}

function takeHint(at: number): void {
	const hint = hints[at];
	if(replIn === null || hint === undefined) {
		return;
	}
	replIn.value = replIn.value.slice(0, replIn.value.length - hintsFrom.length) + hint.insert;
	hinted = -1;
	showHints();
}

function hideHints(): void {
	hints = [];
	hinted = -1;
	replHints?.toggleAttribute('hidden', true);
	replIn?.setAttribute('aria-expanded', 'false');
}

replIn?.addEventListener('input', () => {
	hinted = -1;
	showHints();
});
replIn?.addEventListener('blur', hideHints);

replIn?.addEventListener('keydown', event => {
	const open = hints.length > 0;
	if(event.key === 'Tab') {
		event.preventDefault();
		if(!open) {
			showHints();
		}
		/* one option, or one picked with the arrows, goes in; otherwise the list is the answer */
		if(hints.length === 1 || hinted >= 0) {
			takeHint(Math.max(hinted, 0));
		}
		return;
	} else if(open && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
		event.preventDefault();
		hinted = (hinted + (event.key === 'ArrowUp' ? hints.length - 1 : 1) + (hinted < 0 && event.key === 'ArrowUp' ? 1 : 0)) % hints.length;
		showHints();
		return;
	} else if(open && event.key === 'Escape') {
		event.preventDefault();
		hideHints();
		return;
	} else if(open && event.key === 'Enter' && hinted >= 0) {
		event.preventDefault();
		takeHint(hinted);
		return;
	} else if(event.key === 'ArrowUp' || event.key === 'ArrowDown') {
		event.preventDefault();
		replAt = Math.min(Math.max(0, replAt + (event.key === 'ArrowUp' ? -1 : 1)), replHistory.length);
		replIn.value = replHistory[replAt] ?? '';
		return;
	} else if(event.key !== 'Enter') {
		return;
	}
	const line = replIn.value;
	if(line.trim().length === 0) {
		return;
	}
	replIn.value = '';
	hideHints();
	replHistory.push(line);
	replAt = replHistory.length;
	runRepl(line);
});

/** runs one repl line and, if it is a command, keeps it for the link */
function runRepl(line: string): void {
	say(`R> ${line}`, 'said');
	const refused = refusedScript(line);
	if(refused !== undefined) {
		say(refused, 'bad');
		return;
	}
	/* bare R runs for real, in the R session the run button shares, so a run's leftovers can be inspected */
	if(!line.trimStart().startsWith(':')) {
		if(replOut !== null) {
			void evalInR(line, packagesOf, say, replOut);
		}
		return;
	}
	/* only the commands travel, a link is not a place for a program */
	replSaid = [...replSaid.filter(other => other !== line), line].slice(-MaxSharedCommands);
	remember();
	void analyzer()
		.then(built => replProcessAnswer(built, replSink, line, false))
		.catch((e: unknown) => say(String(e), 'bad'));
}
say('flowR\'s repl, over whatever the editor holds. :help lists what it knows, tab completes.');
say('Plain R runs in your browser with webR, in the active session, so after a run its variables are here.', 'note');
/* a link that carried commands opens on their answers, which is what it was sent for */
if(replSaid.length > 0) {
	(document.getElementById('repl') as HTMLDetailsElement | null)?.setAttribute('open', '');
	for(const line of replSaid) {
		replHistory.push(line);
		runRepl(line);
	}
	replAt = replHistory.length;
}

/**
 * The two things one drags: how wide the code pane is and how much room the repl gets. Both are written
 * into the page as a custom property, and from there into the link, so a shared example opens laid out the
 * way it was left.
 */
function draggable(handle: HTMLElement | null, property: string, begin: () => number, measure: (event: PointerEvent, from: PointerEvent, begun: number) => string): void {
	handle?.addEventListener('pointerdown', start => {
		start.preventDefault();
		handle.setPointerCapture(start.pointerId);
		/* what it measured before the drag: reading it again on every move would compound the delta */
		const begun = begin();
		const drag = (at: PointerEvent) => document.documentElement.style.setProperty(property, measure(at, start, begun));
		/* a release, a touch the browser took over for scrolling, and a handle that folded away under the
		   pointer all end the capture, and so the drag */
		const done = () => {
			handle.removeEventListener('pointermove', drag);
			handle.removeEventListener('lostpointercapture', done);
			remember();
		};
		handle.addEventListener('pointermove', drag);
		handle.addEventListener('lostpointercapture', done);
	});
}

const between = (low: number, value: number, high: number): number => Math.min(Math.max(low, value), high);

const rem = () => parseFloat(getComputedStyle(document.documentElement).fontSize);
const replBody = () => document.getElementById('repl')?.querySelector('.body')?.getBoundingClientRect().height ?? 224;

/* a pane is at least as wide as the grid lets the panel get; dragged past half of that, it folds away */
const splitBox = document.querySelector<HTMLElement>('.split');
const fold = (split: string): void => {
	const at = parseFloat(split);
	if(splitBox === null) {
		return;
	} else if(at <= 0 || at >= 100) {
		splitBox.dataset.fold = at <= 0 ? 'code' : 'panel';
	} else {
		delete splitBox.dataset.fold;
	}
};
/* where the bar was before it folded, which a click on the folded bar goes back to */
let unfolded = '';
draggable(document.getElementById('divider'), '--split', () => 0, at => {
	const box = splitBox?.getBoundingClientRect();
	if(box === undefined) {
		return '50%';
	}
	const x = at.clientX - box.left, least = 14 * rem();
	const split = x < least / 2 ? '0%' : box.width - x < least / 2 ? '100%'
		: `${(between(least, x, box.width - least) / box.width * 100).toFixed(1)}%`;
	if(splitBox?.dataset.fold === undefined) {
		unfolded = document.documentElement.style.getPropertyValue('--split');
	}
	fold(split);
	return split;
});
/* a click on the folded bar, rather than a drag off it, brings the pane back to where it was */
let foldedOnPress: string | undefined;
document.getElementById('divider')?.addEventListener('pointerdown', () => {
	foldedOnPress = splitBox?.dataset.fold;
});
document.getElementById('divider')?.addEventListener('click', () => {
	if(foldedOnPress !== undefined && splitBox?.dataset.fold === foldedOnPress) {
		document.documentElement.style.setProperty('--split', unfolded);
		fold(unfolded || '50');
		remember();
	}
});

draggable(document.getElementById('treegrip'), '--tree-width', () => tree.getBoundingClientRect().width,
	(at, from, begun) => `${Math.round(between(7 * rem(), begun + at.clientX - from.clientX, 30 * rem()))}px`);

/* the repl folds the same way: dragged down past half its least height, it closes and keeps the height it had */
draggable(document.getElementById('replgrip'), '--repl-height', replBody, (at, from, begun) => {
	const least = 6 * rem(), height = begun + (from.clientY - at.clientY);
	if(height < least / 2) {
		(document.getElementById('repl') as HTMLDetailsElement | null)?.removeAttribute('open');
		return `${Math.round(begun)}px`;
	}
	return `${Math.round(between(least, height, window.innerHeight * 0.8))}px`;
});

/* the R output grows downwards, into the analysis below it, while the bars under that stay put; dragged to
   within a few lines of them, the analysis folds away entirely rather than leaving a clipped sliver */
draggable(document.getElementById('runrgrip'), '--runr-height', () => document.getElementById('runr')?.getBoundingClientRect().height ?? 0, (at, from, begun) => {
	const right = document.querySelector<HTMLElement>('.right');
	const bars = [...right?.children ?? []].filter(child => child.id !== 'runr' && child.id !== 'panel')
		.reduce((sum, child) => sum + child.getBoundingClientRect().height, 0);
	const room = Math.min((right?.getBoundingClientRect().height ?? window.innerHeight) - bars, window.innerHeight * .9);
	const height = between(5 * rem(), begun + (at.clientY - from.clientY), room);
	const folded = height > room - 3 * rem();
	right?.classList.toggle('folded', folded);
	return `${Math.round(folded ? room : height)}px`;
});

/* a link that was shared with a layout opens with it */
for(const [property, value] of [['--split', shared.split], ['--repl-height', shared.repl]] as const) {
	if(value !== undefined && /^[\d.]+(%|px)$/.test(value)) {
		document.documentElement.style.setProperty(property, value);
	}
}
fold(document.documentElement.style.getPropertyValue('--split') || '50');
/* opening it is what someone does to type into it */
document.getElementById('repl')?.addEventListener('toggle', () => {
	if((document.getElementById('repl') as HTMLDetailsElement | null)?.open) {
		replIn?.focus();
	}
	remember();
});
if(shared.replOpen) {
	(document.getElementById('repl') as HTMLDetailsElement | null)?.setAttribute('open', '');
}

/* a link that carried a cursor opens on it; otherwise the cursor starts on the call in the last line,
   because slicing for `library` says nothing worth reading */
const start = (() => {
	if(shared.cursor !== undefined) {
		const line = editor.state.doc.line(Math.min(shared.cursor.line, editor.state.doc.lines));
		return Math.min(line.from + shared.cursor.column - 1, line.to);
	}
	const last = editor.state.doc.line(editor.state.doc.lines);
	const first = /[A-Za-z.][\w._]*/.exec(last.text);
	return first?.index === undefined ? undefined : last.from + first.index;
})();
if(start !== undefined) {
	editor.dispatch({ selection: { anchor: start }, scrollIntoView: true });
}
if(marks.length > 0) {
	showMarks();
}
if(shared.cut) {
	showShared('this link was cut short, so what it carried could not be read back');
}

void run();
