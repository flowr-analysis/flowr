/**
 * The playground: a CodeMirror editor on the left, and on the right what flowR makes of it, all in
 * the browser. The wasm rides along inside this bundle, so the page fetches nothing.
 */
import { EditorView, basicSetup } from 'codemirror';
import { Decoration, hoverTooltip, ViewPlugin, type DecorationSet, type ViewUpdate } from '@codemirror/view';
import { StateEffect, StateField } from '@codemirror/state';
import { autocompletion, type Completion, type CompletionContext, type CompletionResult } from '@codemirror/autocomplete';
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
import type { LintQuickFix } from '../../src/linter/linter-format';
import { LintQuickFixes } from '../../src/linter/linter-fix';
import { DefaultBuiltinConfig, statedSignatureOf, statedSignatures } from '../../src/dataflow/environments/default-builtin-config';
import { FlowrAnalyzerPackageVersionsSigDbPlugin, SigDbPluginName } from '../../src/project/plugins/package-version-plugins/flowr-analyzer-package-versions-sigdb-plugin';
import { memorySourceOfPackages } from '../../src/project/sigdb/memory-source';
import { Identifier } from '../../src/dataflow/environments/identifier';
import { DefaultDependencyCategories } from '../../src/queries/catalog/dependencies-query/dependencies-query-format';
import { SliceDirection } from '../../src/util/slice-direction';
import { rankName } from '../../src/util/text/name-rank';
import { stripAnsi, voidFormatter } from '../../src/util/text/ansi';
import { replCompleter, replProcessAnswer } from '../../src/cli/repl/core';
import { getCommand } from '../../src/cli/repl/commands/repl-commands';
import { splitAtEscapeSensitive } from '../../src/util/text/args';
import type { ReplOutput } from '../../src/cli/repl/commands/repl-main';
import { packForUrl, toBase64, unpackFromUrl } from '../../src/util/text/url-encoding';
import type { PlaygroundMark as Mark } from '../../src/util/text/playground-link';
import { Playground, PlaygroundBox, PlaygroundMark } from '../../src/util/text/playground-link';
import { baseRPackages } from '../../src/util/r-base-packages';
import { DataflowMermaid } from '../../src/util/mermaid/dfg';
import { cfgToMermaid } from '../../src/util/mermaid/cfg';
import { normalizedAstToMermaid } from '../../src/util/mermaid/ast';
import treeSitterWasm from '../../node_modules/web-tree-sitter/tree-sitter.wasm';
import rWasm from '../../node_modules/@davisvaughan/tree-sitter-r/tree-sitter-r.wasm';

/* the script the page opens with, written into the page by the build so the documentation can link
   to the same one rather than to a copy of it */
const Sample = (document.getElementById('sample')?.textContent ?? '').trim();

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
/* what the link points at: whole lines and spans, resolved before they are handed over */
const setShown = StateEffect.define<{ ranges: readonly ShownRange[], fresh: boolean }>();

/** a place a link points at; every one of them is shown in the one colour a highlight has */
interface ShownRange { from: number, to: number, line: boolean }

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
				marks = Decoration.set(effect.value.map(l => Decoration.mark({ class: 'cm-lint' }).range(l.from, l.to)), true);
			}
		}
		return marks;
	},
	provide: field => EditorView.decorations.from(field)
});

/** what a link points at, kept apart from every mark an analysis produces so nothing overwrites it */
const shownMarks = StateField.define<DecorationSet>({
	create: () => Decoration.none,
	update(marks, tr) {
		marks = marks.map(tr.changes);
		for(const effect of tr.effects) {
			if(effect.is(setShown)) {
				/* the mark says so once as the page opens, which is when nobody knows yet where to look */
				const fresh = effect.value.fresh ? ' fresh' : '';
				marks = Decoration.set(effect.value.ranges.map(at => at.line
					? Decoration.line({ class: `cm-shown-line${fresh}` }).range(at.from)
					: Decoration.mark({ class: `cm-shown${fresh}` }).range(at.from, at.to)), true);
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

/** what the linter said about a span of the code, so the tooltip carries it next to everything else */
function lintsOver(from: number, to: number): readonly { rule: string, message: string }[] {
	return shownLints.filter(found => found.from < to && found.to > from);
}

/** a finding as the page writes it: the rule as its own chip, and what it said next to it */
function complaint(found: { rule: string, message: string }, cls: string): HTMLElement {
	const at = document.createElement('div');
	at.className = cls;
	const chip = tag(found.rule, 'rule');
	chip.dataset.category = category(found.rule);
	at.append(chip, document.createTextNode(found.message.replace(`${found.rule}: `, '')));
	return at;
}

/** what flowR can say about the name under the pointer: its value, its shape, or where it comes from */
const valueTips = hoverTooltip(async(view, pos) => {
	const line = view.state.doc.lineAt(pos);
	const found = targetAt(line.text, line.number, pos - line.from);
	if(found === undefined) {
		return null;
	}
	/* a package name stands for no value flowR could resolve, so what it knows about it is the package */
	if(namesPackage(line.text, found)) {
		const info = packageInfo(found.name);
		showPointed(found.name, packageFacts(info).join(' · '));
		showPackage(info);
		return {
			pos:    line.from + found.from,
			end:    line.from + found.to,
			above:  true,
			create: () => ({ dom: packageTip(info, lintsOver(line.from + found.from, line.from + found.to)) })
		};
	}
	const criterion = found.criterion;
	const about = await describe(criterion);
	const said = about.said;
	const known = about.local ? undefined : signatureOf(found.name, ownerOf(found.name, about.pkg));
	const complaints = lintsOver(line.from + found.from, line.from + found.to);
	showPointed(found.name, said, known);
	showSignature(found.name, known);
	return said === undefined && known === undefined && complaints.length === 0 ? null : {
		pos:    line.from + found.from,
		end:    line.from + found.to,
		above:  true,
		create: () => ({ dom: tip(known, said, complaints) })
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
const stated = statedSignatures();
function builtinSignature(name: string, pkg?: string): Signature | undefined {
	const own = statedSignatureOf(stated, name, pkg);
	return own === undefined ? undefined
		: { call: `${own.pkg}::${name}${own.params === undefined ? '' : `(${own.params})`}`, props: own.props.join(' '), where: '' };
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

/** the name at the version it was read at, which heads both the card and the hover */
function packageHead(info: PackageInfo): string {
	return info.version === undefined ? info.name : `${info.name} ${info.version}`;
}

/** the hover card of a package: its version, what came with it, and what the linter said here */
function packageTip(info: PackageInfo, complaints: readonly { rule: string, message: string }[]): HTMLElement {
	const dom = document.createElement('div');
	dom.className = 'cm-valuetip';
	const head = document.createElement('div');
	head.className = 'tcall';
	head.textContent = packageHead(info);
	dom.append(head);
	const about = document.createElement('div');
	about.className = 'tabout';
	about.textContent = packageFacts(info).join(' · ');
	dom.append(about);
	for(const found of complaints) {
		dom.append(complaint(found, 'tlint'));
	}
	return dom;
}

/** the package under the pointer, in the box a function shows its signature in */
function showPackage(info: PackageInfo): void {
	const at = document.getElementById('signature');
	if(at === null) {
		return;
	}
	at.replaceChildren();
	at.hidden = false;
	const head = document.createElement('h3');
	head.textContent = 'Package';
	const call = document.createElement('div');
	call.className = 'scall';
	call.textContent = packageHead(info);
	const about = document.createElement('div');
	about.className = 'sabout';
	for(const fact of packageFacts(info)) {
		about.append(tag(fact, 'prop'));
	}
	about.append(link('look it up in the signature database', `../sigdb/?q=${encodeURIComponent(info.name)}`, 'at'));
	at.append(head, call, about);
}

/** the hover card: what the database knows about the name, then what flowR made of this script */
function tip(known: ReturnType<typeof signatureOf>, said: string | undefined, complaints: readonly { rule: string, message: string }[] = []): HTMLElement {
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
	for(const found of complaints) {
		dom.append(complaint(found, 'tlint'));
	}
	return dom;
}

/** whether this is a page one points at, or one one taps */
const pointing = !matchMedia('(hover: none)').matches;
if(!pointing) {
	const at = document.querySelector('#pinfo .pvalue');
	if(at !== null) {
		at.textContent = 'tap a name for what flowR knows about it';
	}
}

/** what the pointer is on, kept in the panel next to everything else */
function showPointed(name: string, said: string | undefined, known?: ReturnType<typeof signatureOf>): void {
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
	/* a name flowR cannot put a value on is still a name it knows something about: what it calls, and
	   from where. Only when there is neither is there nothing to say. */
	value.textContent = said ?? (known === undefined ? 'nothing known about it'
		: [known.call, known.props.split(' ').filter(p => p.length > 0).map(p => p.replace(/-/g, ' ')).join(' · '), known.where]
			.filter(text => text.length > 0).join(' · '));
	at.append(label, value);
}

/** the names flowR knows without any package, offered alongside whatever the script defines */
const builtInNames = [...new Set(DefaultBuiltinConfig.flatMap(d => d.names.map(id => String(Identifier.getName(id)))))]
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

/** what a package carries in the baked table, past the version and release date it starts with */
const exportsFrom = (entry: readonly string[] = []): readonly string[] => entry.slice(2);

/** the packages whose names a `library()` call may ask for */
const packageNames = Object.keys(bakedPackages).sort((a, b) => a.localeCompare(b));

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

function complete(context: CompletionContext): CompletionResult | null {
	const qualified = Qualified.exec(context.matchBefore(/[A-Za-z.][\w.]*:{2,3}[\w._]*/)?.text ?? '');
	if(qualified !== null) {
		const [, pkg, colons, written] = qualified;
		const exported = bakedPackages[pkg] === undefined ? undefined : exportsFrom(bakedPackages[pkg]);
		return exported === undefined ? null : {
			from:    context.pos - written.length,
			options: ranked(exported.map(label => offer(label, written, { pkg, type: 'function', detail: `${pkg}${colons}`, siblings: exportsOf(pkg) })))
		};
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
	const defined = [...new Set([...context.state.doc.toString().matchAll(/([A-Za-z.][\w._]*)\s*(?:<-|=(?!=))/g)].map(m => m[1]))];
	return {
		from:    word.from,
		options: ranked([
			...defined.map(label => offer(label, needle, { type: 'variable', detail: 'in this script' })),
			/* what the script attached is nearer than what flowR knows without it */
			...[...attached].flatMap(pkg => exportsFrom(bakedPackages[pkg]).map(label => offer(label, needle, { pkg, type: 'function', detail: pkg }))),
			...builtInNames.map(label => offer(label, needle, { type: 'function', detail: 'flowR built-in' }))
		])
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
	/* the configuration travels as the keys it changed, `a.b.c=<json>` joined by `;`, which is short
	   enough to read in the address bar and to paste into a bug report */
	const changed = params.get('k')?.split(';').filter(line => line.length > 0);
	/* everything about the view is one field, `<code width>,<repl height>,<flags>`, because four of them
	   would be four `&`-separated names for what is really one thing: how the page was left looking */
	const [split = '', repl = '', flags = ''] = (params.get('v') ?? '').split(',');
	/* the unit is the same every time, so a link carries the bare number and gets it back here; links
	   written before that spelled the unit out and still read as they did */
	const sized = (value: string, unit: string) => value.length === 0 ? undefined : /^[\d.]+$/.test(value) ? value + unit : value;
	const code = read('c');
	return {
		code,
		cut,
		config:     changed === undefined ? undefined : JSON.stringify(FlowrConfig.applyPaths(changed), null, 2),
		/* `>` is how the landing page writes the forward direction, so a link reads the same on both */
		direction:  flags.includes('>') ? SliceDirection.Forward : undefined,
		split:      sized(split, '%'),
		repl:       sized(repl, 'px'),
		/* what the link points at, as `12`, `12-15`, `12@sum`, `12:5`, `lint:<rule>[@<line>]`, or a box */
		marks:      PlaygroundMark.expand((params.get('h') ?? '').split(',').filter(mark => mark.length > 0)),
		/* the rest of the script steps back for whoever opens the link, just as it did for whoever sent it */
		dim:        flags.includes('d'),
		/* the repl and the whole of a slice are as much a part of how the page was left as the panes are */
		replOpen:   flags.includes('r'),
		wholeSlice: flags.includes('a'),
		/* what was asked of the repl, so a link opens on the answer it was sent for */
		said:       (read('q') ?? '').split('\n').filter(line => line.trim().startsWith(':')).slice(0, 8),
		/* an example opens on what it is about, with the boxes it is not about folded away */
		folded:     (params.get('f') ?? '').split(',')
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
let shownDeps: readonly { kind: string, line?: number, from: number, to: number }[] = [];

/** what the tools bar says about the link, next to the button that copies it */
function showShared(text: string): void {
	const at = document.getElementById('sharenote');
	if(at !== null) {
		at.textContent = text;
	}
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
	const configured = config.state.doc.toString();
	/* the configuration travels only when it is not the one the page opens with */
	const settings = configured.trim() === Defaults.trim() ? undefined : FlowrConfig.parse(configured);
	const changed = settings === undefined ? [] : FlowrConfig.changedPaths(settings);
	if(changed.length > 0) {
		fields.push(['k', changed.join(';')]);
	}
	const dragged = (property: string, unit: string) => document.documentElement.style.getPropertyValue(property).replace(unit, '');
	const flags = (direction === SliceDirection.Forward ? '>' : '')
		+ (dimOutside ? 'd' : '')
		+ ((document.getElementById('repl') as HTMLDetailsElement | null)?.open ? 'r' : '')
		+ (wholeSlice ? 'a' : '');
	const view = [dragged('--split', '%'), dragged('--repl-height', 'px'), flags];
	/* a trailing empty field says nothing and would leave the link ending in a comma, which is where a
	   chat client stops reading it */
	while(view.length > 0 && view[view.length - 1].length === 0) {
		view.pop();
	}
	if(view.length > 0) {
		fields.push(['v', view.join(',')]);
	}
	const shortened = PlaygroundMark.compress(marks);
	if(shortened.length > 0) {
		fields.push(['h', shortened.join(',')]);
	}
	if(folded.length > 0) {
		fields.push(['f', folded.join(',')]);
	}
	if(replSaid.length > 0) {
		fields.push(['q', packForUrl(replSaid.join('\n'))]);
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
		basicSetup, StreamLanguage.define(json), look, syntaxHighlighting(highlight), configTips,
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
	doc:        shared.code ?? Sample,
	extensions: [
		basicSetup, rLanguage, look, syntaxHighlighting(highlight), callMarks,
		lintMarks, sliceMarks, linkMarks, shownMarks, valueTips, autocompletion({ override: [complete] }),
		EditorView.updateListener.of(update => {
			if(update.docChanged) {
				schedule();
				remember();
			} else if(update.selectionSet) {
				schedule(400);
			}
		})
	],
	parent: document.getElementById('editor') as HTMLElement
});

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
	let marked = ranges.length > 0;
	const fresh = unseenMarks;
	editor.dispatch({ effects: setShown.of({ ranges, fresh }) });
	for(const row of document.querySelectorAll<HTMLElement>('[data-mark]')) {
		const mark = row.dataset.mark ?? '';
		/* `lint:<rule>` stands for every finding of that rule, so it lights the rows of each of them */
		const wanted = marks.some(m => m === mark || mark.startsWith(`${m}@`));
		/* a highlight one cannot see is no highlight, so what it points at is unfolded first */
		if(wanted && row.hidden && row.dataset.kindGroup !== undefined) {
			toggleKind(row.dataset.kindGroup, true);
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
			const clear = document.getElementById('clearmarks');
			if(clear !== null) {
				clear.hidden = true;
			}
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
	const clear = document.getElementById('clearmarks');
	if(clear !== null) {
		/* what it clears is what is lit, not what the link asks for: a mark the page cannot place (its code was
		   edited away, its row is not in the current answer) lights nothing, and nothing is what it clears */
		clear.hidden = !marked;
	}
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
	if(!PlaygroundMark.isValid(mark)) {
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

function section(title: string, box: PlaygroundBox, aside?: string, end?: Node): HTMLElement {
	const head = document.createElement('h3');
	foldable(head, box);
	head.append(title);
	if(aside !== undefined) {
		const said = document.createElement('span');
		said.className = 'aside';
		said.textContent = aside;
		head.append(said);
	}
	if(end !== undefined) {
		head.append(end);
	}
	const body = document.createElement('div');
	body.className = 'sbody';
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
	const link = document.createElement('a');
	link.className = 'suggest';
	link.href = IssueTemplate;
	link.target = '_blank';
	link.rel = 'noopener';
	/* the script travels with the report, so it is read again where the link is followed, not before */
	link.addEventListener('mousedown', () => link.href = issueUrl());
	link.append(document.createTextNode('suggest'), tag(' a new rule', 'wide'));
	link.title = 'suggest a new linting rule, with this script attached to the report';
	return link;
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

/** how many dependencies of one category the panel shows before the rest are folded away */
const DepsPerKind = 3;
/** the categories unfolded by hand, kept so a re-analysis does not fold them up again */
const expandedKinds = new Set<string>();

/** the row that stands for the dependencies of a category the panel folded away */
function expander(kind: string, rest: number, open: boolean): HTMLElement {
	const more = document.createElement('button');
	more.type = 'button';
	more.className = 'more';
	more.dataset.expand = kind;
	more.textContent = open ? `show fewer ${kind} dependencies` : `${rest} more ${kind} ${rest === 1 ? 'dependency' : 'dependencies'}`;
	more.addEventListener('click', () => toggleKind(kind));
	return more;
}

/** unfolds (or folds up again) what a category holds beyond the first {@link DepsPerKind} rows */
function toggleKind(kind: string, open = !expandedKinds.has(kind)): void {
	if(open) {
		expandedKinds.add(kind);
	} else {
		expandedKinds.delete(kind);
	}
	for(const row of document.querySelectorAll<HTMLElement>(`.deps .rest[data-kind-group="${kind}"]`)) {
		row.hidden = !open;
	}
	const more = document.querySelector<HTMLElement>(`.deps .more[data-expand="${kind}"]`);
	if(more !== null) {
		const rest = document.querySelectorAll(`.deps .rest[data-kind-group="${kind}"]`).length;
		more.textContent = open ? `show fewer ${kind} dependencies` : `${rest} more ${kind} ${rest === 1 ? 'dependency' : 'dependencies'}`;
	}
}

function nothing(text: string): HTMLElement {
	const el = document.createElement('p');
	el.className = 'empty';
	el.textContent = text;
	return el;
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
async function analyzer() {
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
	built.addRequest({ request: 'text', content: editor.state.doc.toString() });
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
/** one dependency as the panel shows it, with whatever else was drawn onto it hanging below */
interface DepRow {
	kind:      string,
	/** R echoes this one at the top level, nothing in the code asks it to */
	implicit?: boolean,
	call?:     string,
	value?:    string,
	line?:     number,
	from?:     readonly number[],
	id?:       string | number,
	onto:      readonly (string | number)[],
	parts:     DepRow[]
}
interface Finding { loc?: number[], quickFix?: LintQuickFix[] }

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

/** the button on the lint heading, which carries out every fix the findings below offer */
function fixButton(fixes: readonly LintQuickFix[], label: string, title: string): HTMLElement {
	const button = document.createElement('button');
	button.className = 'fix';
	button.type = 'button';
	button.textContent = label;
	button.title = title;
	/* the row itself links to the finding, so the click must not travel up to it */
	button.addEventListener('click', event => {
		event.stopPropagation();
		applyFixes(fixes);
	});
	return button;
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
			said: [shape, resolved.length > 0 ? resolved.join(', ') : undefined, from.length > 0 ? `(line ${from.join(', ')})` : undefined]
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
	return `https://mermaid.live/edit#base64:${toBase64(new TextEncoder().encode(state))}`;
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
	/* the same pair the landing page offers: what this value is built from, or what depends on it */
	const ways = document.createElement('span');
	ways.className = 'ways';
	ways.setAttribute('role', 'group');
	ways.setAttribute('aria-label', 'which way to slice');
	for(const [value, label, hint] of [
		[SliceDirection.Backward, 'origin', 'what this value is built from'],
		[SliceDirection.Forward, 'impact', 'what depends on this value']
	] as const) {
		const button = document.createElement('button');
		button.type = 'button';
		button.className = 'way';
		button.textContent = label;
		button.title = hint;
		button.setAttribute('aria-pressed', String(value === direction));
		button.addEventListener('click', () => {
			if(direction !== value) {
				direction = value;
				remember();
				void run();
			}
		});
		ways.append(button);
	}
	head.append(ways);
	const dimmer = document.createElement('label');
	dimmer.className = 'toggle';
	const box = document.createElement('input');
	box.type = 'checkbox';
	box.checked = dimOutside;
	box.addEventListener('change', () => {
		dimOutside = box.checked;
		editor.dispatch({ effects: setSlice.of(dimOutside && lastKept.length > 0 ? lastKept : undefined) });
		remember();
	});
	dimmer.append(box, document.createTextNode('dim'), tag(' the rest', 'wide'));
	head.append(dimmer);
	foldable(head, PlaygroundBox.Slice);
	/* the slice is built here, where the answer is, and put in below what the panel says about the script */
	const sliceBlock = document.createDocumentFragment();
	const sliceBody = document.createElement('div');
	sliceBody.className = 'sbody';
	sliceBody.dataset.foldBody = PlaygroundBox.Slice;
	sliceBlock.append(head, sliceBody);
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
	slice.dataset.mark = PlaygroundBox.Slice;
	slice.append(shown);
	/* the panel is not where someone reads a whole script: what is left of the window decides how much of
	   one it shows, and the rest waits behind the button */
	const length = code?.split('\n').length ?? 0;
	const more = document.createElement('button');
	more.type = 'button';
	more.className = 'unfold';
	more.hidden = true;
	more.textContent = `show all ${length} lines`;
	more.addEventListener('click', () => {
		wholeSlice = true;
		slice.classList.remove('folded');
		more.hidden = true;
		remember();
	});
	slice.append(more);
	requestAnimationFrame(() => {
		const room = panel.getBoundingClientRect().bottom - slice.getBoundingClientRect().top - 2.5 * 16;
		const perLine = shown.getBoundingClientRect().height / Math.max(1, length);
		const fits = Math.max(FoldedSliceLines, Math.floor(room / Math.max(perLine, 12)));
		slice.style.setProperty('--fold-lines', String(fits));
		slice.classList.toggle('folded', length > fits && !wholeSlice);
		more.hidden = length <= fits || wholeSlice;
	});
	sliceBody.append(slice);

	/* whatever the dependencies query answers with, so a new category shows up here without a second list */
	const kinds = Object.keys(DefaultDependencyCategories);
	const deps: DepRow[] = kinds.flatMap(kind => (answers.dependencies?.[kind] ?? []).map(entry => {
		const at = idMap?.get(entry.nodeId as never)?.location;
		const call = entry.functionName === undefined ? undefined : String(Identifier.getName(entry.functionName));
		const value = entry.value === undefined || entry.value === 'unknown' ? undefined : entry.value;
		return { kind, call, value, implicit: entry.implicit, line: at?.[0], from: at, id: entry.nodeId, onto: entry.linkedIds ?? [], parts: [] };
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
	/* where each package is asked for, so hovering its name says what this script does with it */
	attachedLines.clear();
	qualifiedLines.clear();
	for(const d of deps) {
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
	shownDeps = deps.flatMap(d => {
		const [startLine, startCol, endLine, endCol] = d.from ?? [];
		if(startLine === undefined || startLine !== endLine || startCol === undefined || endCol === undefined
			|| startLine < 1 || startLine > editor.state.doc.lines) {
			return [];
		}
		const at = editor.state.doc.line(startLine);
		return [{ kind: d.kind, line: startLine, from: at.from + startCol - 1, to: Math.min(at.to, at.from + endCol) }];
	});
	const depBody = section(`Dependencies: ${deps.length}`, PlaygroundBox.Deps, '(click to slice)');
	const shownDep = (d: DepRow, part: boolean, repeat = false): HTMLElement => {
		const what = document.createElement('span');
		what.className = 'what';
		if(d.value !== undefined) {
			/* an implicit echo says the same `stdout` as a `print()` call, and it is worth telling the two apart */
			if(d.implicit) {
				const echo = document.createElement('span');
				echo.className = 'echo';
				echo.title = 'auto-printed: this result reaches stdout on its own';
				echo.append(d.value);
				what.append(echo);
			} else {
				what.append(d.value);
			}
		}
		if(d.call !== undefined) {
			what.append(tag(`${d.call}()`, d.value === undefined ? 'call only' : 'call'));
		}
		/* a category says its name once: every further row of it lines up under that one word */
		const kind = part ? tag('draws onto', 'kind part') : repeat ? tag('', 'kind ditto') : tag(d.kind, 'kind');
		const line = row(kind, what, tag(d.line ? `L${d.line}` : '', 'at'));
		/* alt-click highlights this one dependency, the way it does a finding */
		line.dataset.mark = d.line === undefined ? `dep:${d.kind}` : `dep:${d.kind}@${d.line}`;
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
	if(deps.length > 0) {
		const rows = document.createElement('div');
		rows.className = 'deps';
		rows.dataset.mark = PlaygroundBox.Deps;
		/* the query answers by category, so the rows are already in that order: this only cuts each of them
		   down to what one can take in at a glance, and keeps the rest a click away */
		for(const kind of new Set(top.map(d => d.kind))) {
			const ofKind = top.filter(d => d.kind === kind);
			const open = expandedKinds.has(kind);
			ofKind.forEach((d, at) => {
				const line = shownDep(d, false, at > 0);
				line.dataset.kindGroup = kind;
				if(at >= DepsPerKind) {
					line.classList.add('rest');
					line.hidden = !open;
				}
				rows.append(line, ...d.parts.map(p => shownDep(p, true)));
			});
			if(ofKind.length > DepsPerKind) {
				rows.append(expander(kind, ofKind.length - DepsPerKind, open));
			}
		}
		depBody.append(rows);
	} else {
		depBody.append(nothing('nothing outside this script'));
	}

	const found = Object.entries(answers.linter?.results ?? {}).flatMap(([rule, per]) =>
		(per?.results ?? []).map(f => ({
			rule, line: f.loc?.[0], loc: f.loc, quickFix: f.quickFix ?? [], message: explain(rule, f, per?.['.meta'])
		})));
	const marked = found.flatMap(f => {
		const [startLine, startCol, endLine, endCol] = f.loc ?? [];
		if(startLine === undefined || startLine !== endLine || startCol === undefined || endCol === undefined) {
			return [];
		}
		if(startLine < 1 || startLine > editor.state.doc.lines) {
			return [];   // a rule that points outside this file, e.g. at the project around it
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
	const acts = document.createElement('span');
	acts.className = 'acts';
	if(fixable.length > 0) {
		acts.append(fixButton(fixable, `fix ${fixable.length}`,
			[...new Set(fixable.map(fix => fix.description))].join('\n')));
	}
	acts.append(suggestRule());
	const lintBody = section(`Lints: ${found.length}`, PlaygroundBox.Lints, undefined, acts);
	if(found.length === 0) {
		lintBody.append(nothing('no findings'));
		panel.append(sliceBlock);
		showFolds();
		showMarks();
		return took;
	}
	const lints = document.createElement('div');
	lints.className = 'lints';
	lints.dataset.mark = PlaygroundBox.Lints;
	for(const f of found) {
		const said = document.createElement('span');
		said.className = 'says';
		said.textContent = f.message;
		const chip = document.createElement('span');
		chip.className = 'rule';
		chip.dataset.category = category(f.rule);
		chip.append(tag(f.rule, 'rulename'));
		/* a narrow panel cuts the name short, so the whole of it waits under the pointer */
		chip.title = f.rule;
		if(f.quickFix.length > 0) {
			/* the name gives way to the offer under the pointer, which is where the fix is carried out */
			chip.classList.add('fixable');
			/* the fix says what it will do to the script, which is what one wants to know before clicking */
			chip.title = `${f.rule}: ${f.quickFix.map(fix => fix.description).join('; ')}`;
			chip.append(tag('fix', 'offer'));
			chip.addEventListener('click', event => {
				/* the row itself links to the finding, so the click must not travel up to it */
				event.stopPropagation();
				applyFixes(f.quickFix);
			});
		}
		/* one element per finding, so the hover lights the whole row; the columns still line up
		   because the row borrows the surrounding grid */
		const line = document.createElement('div');
		line.className = 'lint';
		/* alt-click makes a link out of this one finding, which is how a new rule gets shown off */
		line.dataset.mark = f.line === undefined ? `lint:${f.rule}` : `lint:${f.rule}@${f.line}`;
		line.title = 'alt-click to highlight this finding in the link';
		line.append(chip, said, tag(f.line ? `L${f.line}` : '', 'at'));
		lints.append(...linkRow([line], [f.line]));
	}
	lintBody.append(lints);
	panel.append(sliceBlock);
	showFolds();
	showMarks();
	return took;
}

/** how much of a slice the panel shows before it is folded away */
const FoldedSliceLines = 3;

/** whether the panel shows the whole slice, rather than as much of it as the window has room for */
let wholeSlice = shared.wholeSlice;

/* whether the lines outside the slice step back in the editor, what the last slice kept, and which way it runs */
let dimOutside = shared.dim, lastKept: readonly number[] = [];
let direction: SliceDirection = shared.direction ?? SliceDirection.Backward;
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

document.getElementById('clearmarks')?.addEventListener('click', () => {
	marks.length = 0;
	showMarks();
	remember();
	showShared('the highlights are cleared');
});

document.querySelector('[data-sample]')?.addEventListener('click', () => {
	editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: Sample } });
	config.dispatch({ changes: { from: 0, to: config.state.doc.length, insert: Defaults } });
	/* an example is the script together with everything a link says about it, so what was folded away,
	   highlighted, or sliced the other way comes back as well. The pane sizes and the repl stay as they
	   are: those are how one works, not what one is looking at */
	marks.length = 0;
	folded = [];
	direction = SliceDirection.Backward;
	dimOutside = false;
	wholeSlice = false;
	editor.dispatch({ effects: setSlice.of(undefined) });
	showMarks();
	showFolds();
	remember();
	showShared('the example is back');
});

/* the cursor is written here rather than in {@link remember}, so the address bar does not churn on every click */
document.getElementById('share')?.addEventListener('click', () => {
	const fields = shareFields();
	const head = editor.state.selection.main.head;
	const line = editor.state.doc.lineAt(head);
	if(line.number > 1 || head > line.from) {
		fields.push(['p', `${line.number}:${head - line.from + 1}`]);
	}
	const hash = Playground.hash(fields);
	const link = location.href.replace(/#.*$/, '') + (hash.length > 0 ? `#${hash}` : '');
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
});
editor.dom.addEventListener('click', event => {
	if(event.ctrlKey || event.metaKey) {
		void jumpToDefinition();
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

function say(text: string, how?: 'said' | 'bad'): void {
	if(replOut === null || text.length === 0) {
		return;
	}
	const line = document.createElement('div');
	if(how !== undefined) {
		line.className = how;
	}
	for(const [at, part] of text.split(Url).entries()) {
		if(at % 2 === 0) {
			line.append(part);
			continue;
		}
		const link = document.createElement('a');
		link.href = part;
		link.target = '_blank';
		link.rel = 'noopener';
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

replIn?.addEventListener('keydown', event => {
	if(event.key === 'Tab') {
		/* flowR's own completer, so the page offers exactly what the repl does */
		event.preventDefault();
		const [options, prefix] = replCompleter(replIn.value, settings ?? FlowrConfig.default());
		if(options.length === 1) {
			replIn.value = replIn.value.slice(0, replIn.value.length - prefix.length) + options[0];
		} else if(options.length > 1) {
			say(options.join('  '));
		}
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
	/* only the commands travel: bare R is not evaluated here, and a link is not a place for a program */
	if(line.trimStart().startsWith(':')) {
		replSaid = [...replSaid.filter(other => other !== line), line].slice(-MaxSharedCommands);
		remember();
	}
	void analyzer()
		/* no R session in a browser, so `allowRSessionAccess` is off and bare R stays unevaluated */
		.then(built => replProcessAnswer(built, replSink, line, false))
		.catch((e: unknown) => say(String(e), 'bad'));
}
say('flowR\'s repl, over whatever the editor holds. :help lists what it knows, tab completes.');
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
		const done = () => {
			handle.releasePointerCapture(start.pointerId);
			handle.removeEventListener('pointermove', drag);
			handle.removeEventListener('pointerup', done);
			remember();
		};
		handle.addEventListener('pointermove', drag);
		handle.addEventListener('pointerup', done);
	});
}

const between = (low: number, value: number, high: number): number => Math.min(Math.max(low, value), high);

const replBody = () => document.getElementById('repl')?.querySelector('.body')?.getBoundingClientRect().height ?? 224;
draggable(document.getElementById('divider'), '--split', () => 0, at => {
	const split = document.querySelector('.split')?.getBoundingClientRect();
	const wanted = split === undefined ? 50 : (at.clientX - split.left) / split.width * 100;
	return `${between(15, wanted, 85).toFixed(1)}%`;
});
draggable(document.getElementById('replgrip'), '--repl-height', replBody, (at, from, begun) =>
	`${Math.round(between(6 * 16, begun + (from.clientY - at.clientY), window.innerHeight * 0.8))}px`);

/* a link that was shared with a layout opens with it */
for(const [property, value] of [['--split', shared.split], ['--repl-height', shared.repl]] as const) {
	if(value !== undefined && /^[\d.]+(%|px)$/.test(value)) {
		document.documentElement.style.setProperty(property, value);
	}
}
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
