/** The dependency overview of the playground, laid out like vscode-flowR's dependency view. */
import { RNode } from '../../src/r-bridge/lang-4.x/ast/model/model';
import type { AstIdMap, NormalizedAst, ParentInformation } from '../../src/r-bridge/lang-4.x/ast/model/processing/decorate';
import type { NodeId } from '../../src/r-bridge/lang-4.x/ast/model/processing/node-id';
import type { DependencyInfo } from '../../src/queries/catalog/dependencies-query/dependencies-query-format';
import { Unknown } from '../../src/queries/catalog/dependencies-query/dependencies-query-format';
import { Identifier } from '../../src/dataflow/environments/identifier';
import { RFunctionCall } from '../../src/r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { RArgument } from '../../src/r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { RSymbol } from '../../src/r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import { RBinaryOp } from '../../src/r-bridge/lang-4.x/ast/model/nodes/r-binary-op';
import { RPipe } from '../../src/r-bridge/lang-4.x/ast/model/nodes/r-pipe';
import { RExpressionList } from '../../src/r-bridge/lang-4.x/ast/model/nodes/r-expression-list';
import type { SourceRange } from '../../src/util/range';

export type IconName = 'library' | 'cloud-download' | 'file-code' | 'file-text' | 'filter' | 'search' | 'beaker' | 'graph'
	| 'new-file' | 'folder' | 'link' | 'circle-small-filled' | 'circle-slash' | 'chevron' | 'arrow-up' | 'arrow-down' | 'terminal' | 'trash';

export interface CategoryInfo {
	readonly name:             string
	readonly verb:             string
	readonly icon:             IconName
	/** the default of vscode-flowR's `vscodeFlowr.category.*` theme color, the same in light and dark */
	readonly color:            string
	readonly useReverseLinks?: boolean
}

/** in the order of an analysis: set up, load data, transform it, analyze, check, then communicate the results */
export const DependencyCategories: Readonly<Record<string, CategoryInfo>> = {
	library:    { name: 'Libraries', verb: 'loads the library', icon: 'library', color: '#4CAF50' },
	remote:     { name: 'Remote Installs', verb: 'installs', icon: 'cloud-download', color: '#26A69A' },
	source:     { name: 'Sourced Scripts', verb: 'sources the script', icon: 'file-code', color: '#9CCC65' },
	read:       { name: 'Imported Data', verb: 'imports the data', icon: 'file-text', color: '#0072B2' },
	transform:  { name: 'Data Transformations', verb: 'transforms the data', icon: 'filter', color: '#56B4E9' },
	statistics: { name: 'Statistical Tests', verb: 'performs statistical test', icon: 'search', color: '#7B3294' },
	test:       { name: 'Tests', verb: 'tests for', icon: 'beaker', color: '#CC79A7' },
	visualize:  { name: 'Visualizations', verb: 'visualizes the data', icon: 'graph', color: '#E69F00', useReverseLinks: true },
	write:      { name: 'Outputs', verb: 'produces the output', icon: 'new-file', color: '#D55E00' }
};

/** a category flowR may add later still shows, after the known ones and without a color of its own */
export function categoryInfo(kind: string): CategoryInfo {
	return DependencyCategories[kind] ?? { name: kind, verb: 'uses', icon: 'circle-small-filled', color: 'var(--muted)' };
}

/** the known categories first, in their order, then whatever else the query answered with */
export function orderedKinds(kinds: readonly string[]): string[] {
	const known = Object.keys(DependencyCategories);
	return [...known, ...kinds.filter(k => !known.includes(k))];
}

/** the category whose color a line shows: the one furthest along the analysis (the plot, not the library it uses) */
export function primaryCategory(categories: readonly string[]): string {
	const order = Object.keys(DependencyCategories);
	return categories.reduce((a, b) => order.indexOf(b) > order.indexOf(a) ? b : a);
}

/* simplified codicons, drawn on the same 16 by 16 grid */
const Paths: Readonly<Record<IconName, string>> = {
	'library':             'M3 2.5v11M6 2.5v11M9.2 3l3.3 10.5',
	'cloud-download':      'M4.5 11.5H4a3 3 0 0 1-.3-6A4 4 0 0 1 11.4 4.6a3 3 0 0 1 .6 6.9h-.5M8 7.5v6m-2-2 2 2 2-2',
	'file-code':           'M3.5 1.5h6l3 3v10h-9zM9.5 1.5v3h3M7 8 5.5 9.5 7 11M9 8l1.5 1.5L9 11',
	'file-text':           'M3.5 1.5h6l3 3v10h-9zM9.5 1.5v3h3M5.5 7.5h5M5.5 9.5h5M5.5 11.5h3',
	'filter':              'M2 3h12L9.5 8.5V13l-3 1.5v-6z',
	'search':              'M6.5 2.5a4 4 0 1 1 0 8 4 4 0 0 1 0-8zM9.5 9.5l4 4',
	'beaker':              'M6 1.5v5L2.6 13a1 1 0 0 0 .9 1.5h9a1 1 0 0 0 .9-1.5L10 6.5v-5M5 1.5h6M4.2 10.5h7.6',
	'graph':               'M2 2v12h12M4.5 11l3-4 2.5 2 4-5',
	'new-file':            'M3.5 1.5h6l3 3v10h-9zM9.5 1.5v3h3M8 7v5M5.5 9.5h5',
	'folder':              'M1.5 3.5H6L7.5 5h7v8.5h-13z',
	'link':                'M6.5 9.5l3-3M7 4.5 8.5 3A2.5 2.5 0 0 1 12 6.5L10.5 8M9 11.5 7.5 13A2.5 2.5 0 0 1 4 9.5L5.5 8',
	'circle-small-filled': 'M8 5a3 3 0 1 1 0 6 3 3 0 0 1 0-6z',
	'circle-slash':        'M8 2a6 6 0 1 1 0 12A6 6 0 0 1 8 2zM3.8 12.2l8.4-8.4',
	'chevron':             'M6 4l4 4-4 4',
	'arrow-up':            'M8 13.5v-11M3.5 7 8 2.5 12.5 7',
	'arrow-down':          'M8 2.5v11M3.5 9 8 13.5 12.5 9',
	'terminal':            'M1.5 2.5h13v11h-13zM4 6l2 2-2 2M7.5 10.5h4',
	'trash':               'M2.5 4h11M6 4V2.5h4V4M4 4l.8 9.5h6.4L12 4M6.8 6.5v5M9.2 6.5v5'
};

/** the icon as inline svg in `currentColor`, which is what the category color is set on */
export function icon(name: IconName, cls = 'dicon'): HTMLElement {
	const at = document.createElement('span');
	at.className = cls;
	at.setAttribute('aria-hidden', 'true');
	const filled = name === 'circle-small-filled';
	at.innerHTML = `<svg viewBox="0 0 16 16" width="16" height="16" fill="${filled ? 'currentColor' : 'none'}" stroke="${filled ? 'none' : 'currentColor'}"`
		+ ` stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="${Paths[name]}"/></svg>`;
	return at;
}

/** one entry of the view: a category, a group of uses of the same thing, a use, or what a use links to */
export interface DepNode {
	key:                string
	readonly kind:      string
	readonly label:     string
	description?:       string
	tooltip?:           string
	icon?:              IconName
	/** whether the icon carries the category color, rather than the plain foreground */
	colored:            boolean
	readonly root:      boolean
	readonly children:  DepNode[]
	readonly id?:       NodeId
	/** where a click takes the editor: the whole call, in the file it was written in */
	readonly target?:   { readonly file?: string, readonly span: SourceRange }
	readonly implicit?: boolean
}

/** the ids of this entry, or of all entries below this group or category */
export function nodeIds(node: DepNode): NodeId[] {
	/* a plot links the calls that add to it, which belong to it as much as it does itself */
	return [...node.id === undefined ? [] : [node.id], ...node.children.flatMap(nodeIds)];
}

/** the entries of the view, depth first */
export function allNodes(roots: readonly DepNode[]): DepNode[] {
	return roots.flatMap(r => [r, ...allNodes(r.children)]);
}

/** how the view gets at what it cannot know on its own */
export interface ViewContext {
	readonly ast:       NormalizedAst
	/** the file a node belongs to, `undefined` for the one the editor shows */
	readonly fileOf:    (node: RNode<ParentInformation> | undefined) => string | undefined
	/** the version of a package the page knows */
	readonly versionOf: (pkg: string) => string | undefined
	/** the code a range spans in the file the editor shows */
	readonly textAt:    (range: SourceRange) => string | undefined
}

const Combinators = new Set(['+', '%>%', '|>']);

function assignedName(ids: AstIdMap, id: NodeId): string | undefined {
	let node: RNode<ParentInformation> | undefined = ids.get(id);
	/* flowR may point at the called name instead of the call */
	const callParent = node?.info.parent === undefined ? undefined : ids.get(node.info.parent);
	if(RFunctionCall.isNamed(callParent) && callParent.functionName === node) {
		node = callParent;
	}
	while(node?.info.parent !== undefined) {
		const parent = ids.get(node.info.parent);
		if(RArgument.is(parent) || RPipe.is(parent) || (RBinaryOp.is(parent) && Combinators.has(parent.operator)) || (RExpressionList.is(parent) && parent.grouping)) {
			node = parent;
			continue;
		}
		if(!RBinaryOp.is(parent)) {
			return undefined;
		}
		const [value, target] = parent.operator === '->' || parent.operator === '->>' ? [parent.lhs, parent.rhs] : [parent.rhs, parent.lhs];
		return value === node && ['<-', '<<-', '=', '->', '->>'].includes(parent.operator) && RSymbol.is(target) ? Identifier.getName(target.content) : undefined;
	}
	return undefined;
}

function assignedTo(ast: NormalizedAst, info: DependencyInfo): string | undefined {
	return info.assignedTo ?? (info.nodeId !== undefined ? assignedName(ast.idMap, info.nodeId) : undefined);
}

function describePlots(visualize: readonly DependencyInfo[], ast: NormalizedAst): Map<DependencyInfo, string> {
	const result = new Map<DependencyInfo, string>();
	for(const p of visualize.filter(v => v.nodeId !== undefined && !v.linkedIds?.length)) {
		const name = p.title !== undefined ? `"${p.title}"` : assignedTo(ast, p);
		const file = p.savedTo;
		if(name || file) {
			result.set(p, [name, file && `→ ${file.split(/[\\/]/).at(-1)}`].filter(Boolean).join(' '));
		}
	}
	return result;
}

/** a function name as R writes it: `purrr::map`, not `map,purrr,false` */
export function renderFunctionName(fn: Identifier | undefined): string {
	try {
		return Identifier.toString(fn) ?? String(fn);
	} catch{
		return Array.isArray(fn) ? String(fn[0]) : String(fn);
	}
}

function packageOf(e: DependencyInfo): string | undefined {
	try {
		return Identifier.getNamespace(e.functionName);
	} catch{
		return undefined;
	}
}

function shortenPath(path: string, max = 32): { label: string, folder?: string } {
	const at = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
	const name = at >= 0 && at < path.length - 1 ? path.slice(at + 1) : path;
	const folder = at > 0 && at < path.length - 1 ? path.slice(0, at) : undefined;
	if(name.length <= max) {
		return { label: name, folder };
	}
	const tail = Math.ceil((max - 1) / 2);
	return { label: `${name.slice(0, max - 1 - tail)}…${name.slice(-tail)}`, folder };
}

const NoDataFlow = new Set(['library', 'remote', 'source']);
const ConsoleStreams: ReadonlySet<string> = new Set(['stdout', 'stderr']);

/** builds the view from one answer of the dependencies query */
export function dependencyTree(answer: Readonly<Record<string, readonly DependencyInfo[] | unknown>>, ctx: ViewContext): { roots: DepNode[], empty: DepNode[] } {
	const kinds = orderedKinds(Object.keys(answer).filter(k => !k.startsWith('.') && Array.isArray(answer[k])));
	const plots = describePlots((answer.visualize ?? []) as DependencyInfo[], ctx.ast);
	const ids = ctx.ast.idMap;
	const locOf = (id: NodeId | undefined) => id === undefined ? undefined : ids.get(id)?.location;
	const byLocation = (a: DependencyInfo, b: DependencyInfo): number => {
		const la = locOf(a.nodeId), lb = locOf(b.nodeId);
		return la && lb ? la[0] - lb[0] || la[1] - lb[1] : la ? -1 : lb ? 1 : 0;
	};
	const guardedName = (e: DependencyInfo): string => {
		const plot = plots.get(e);
		if(plot) {
			return `${Identifier.getName(e.functionName)} ${plot}`;
		}
		const value = e.value as string | Identifier | undefined;
		if(value !== undefined && value !== Unknown) {
			return typeof value === 'string' ? value : renderFunctionName(value);
		}
		const named = Identifier.getName(e.functionName);
		return e.lexemeOfArgument ? `${named}: ${e.lexemeOfArgument}` : named;
	};
	const usageName = (e: DependencyInfo): string => {
		const node = e.nodeId === undefined ? undefined : ids.get(e.nodeId);
		const fn = Identifier.getName(e.functionName);
		return (fn === '::' || fn === ':::') && RSymbol.is(node) ? renderFunctionName(node.content) : renderFunctionName(e.functionName);
	};
	const displayLabel = (e: DependencyInfo, name: string): string =>
		plots.has(e) || typeof e.value !== 'string' || e.value === Unknown ? name : shortenPath(name).label;
	const withDataFlow = (kind: string, e: DependencyInfo, label: string): string => {
		if(NoDataFlow.has(kind) || plots.has(e)) {
			return label;
		}
		const input = (e.inputVariables ?? []).join(', ');
		const output = assignedTo(ctx.ast, e);
		if(typeof e.value === 'string' && e.value !== Unknown) {
			return `${input ? `${input} → ` : ''}${label}${output ? ` → ${output}` : ''}`;
		}
		const call = input ? `${label}(${input})` : label;
		return output ? `${call} → ${output}` : call;
	};

	const entry = (kind: string, all: readonly DependencyInfo[], info: DependencyInfo, label: string, link = false): DepNode => {
		const cat = categoryInfo(kind);
		const verb = link ? 'is linked to' : cat.verb;
		const fn = renderFunctionName(info.functionName);
		const node = info.nodeId === undefined ? undefined : ids.get(info.nodeId);
		const loc = node?.location;
		const file = ctx.fileOf(node);
		const version = kind === 'library' && typeof info.value === 'string' ? ctx.versionOf(info.value) : undefined;
		const known = info.value !== undefined && info.value !== Unknown;
		const folder = known && typeof info.value === 'string' ? shortenPath(info.value).folder : undefined;
		const pkg = known ? undefined : packageOf(info);
		const linked = info.linkedIds?.length ? `, linked to ${info.linkedIds.length} id${info.linkedIds.length === 1 ? '' : 's'}` : '';
		const span = RNode.span(node) ?? loc;
		let children: DepNode[] = [];
		if(!link && cat.useReverseLinks) {
			const dependents = all.filter(i => i !== info && i.linkedIds && info.nodeId !== undefined && i.linkedIds.includes(info.nodeId));
			children = grouped(kind, dependents, all);
		} else if(!link && info.linkedIds) {
			children = [...info.linkedIds].sort((a, b) => {
				const la = locOf(a), lb = locOf(b);
				return la && lb ? la[0] - lb[0] || la[1] - lb[1] : 0;
			}).map(i => {
				const at = locOf(i);
				const tok = at && ctx.fileOf(ids.get(i)) === undefined ? ctx.textAt(at) : ids.get(i)?.lexeme;
				return tok
					? { ...entry(kind, all, { nodeId: i, functionName: tok }, tok, true), icon: 'link' as const, colored: false }
					: { key: `${String(i)}`, kind, label: `Linked to unknown location ${String(i)}`, colored: false, root: false, children: [], description: '0 items' };
			});
		}
		return {
			key:         `${label}${String(info.nodeId)}${JSON.stringify(loc)}${fn}${linked}`,
			kind,
			label,
			description: `${folder ? `${folder}/ · ` : ''}${known ? `by "${fn}" ` : pkg ? `from ${pkg} ` : ''}in ${file ? `${file} ` : ''}${loc ? `(L. ${loc[0]}${linked})` : 'unknown location'}${version ? ` · v${version}` : ''}`,
			tooltip:     `${verb} "${String(info.value ?? Unknown)}" with the "${fn}" function in ${loc ? `line ${loc[0]}` : 'an unknown location'}${version ? ` (signature database: v${version})` : ''}`,
			icon:        'circle-small-filled',
			colored:     true,
			root:        false,
			children,
			id:          info.nodeId,
			target:      span ? { file, span } : undefined,
			implicit:    info.implicit
		};
	};

	/* a call holds the uses inside the function it calls, as `report(x)` holds the `cat()` in it */
	const viaNested = (group: readonly DependencyInfo[], make: (e: DependencyInfo) => DepNode): DepNode[] => {
		const inner = new Set(group.map(e => e.via).filter(v => v !== undefined));
		const nest = (e: DependencyInfo, seen: ReadonlySet<DependencyInfo>): DepNode => {
			const made = make(e);
			const below = group.filter(i => !seen.has(i) && e.via !== undefined && i.nodeId === e.via).map(i => nest(i, new Set([...seen, i])));
			return below.length === 0 ? made : { ...made, children: [...made.children, ...below] };
		};
		const roots = group.filter(e => e.nodeId === undefined || !inner.has(e.nodeId));
		return (roots.length > 0 ? roots : group).map(e => nest(e, new Set([e])));
	};

	/* what reaches the console is told apart by the code that prints it, `print(x)` or a name echoed on its own */
	const printed = (e: DependencyInfo): string => {
		const node = e.nodeId === undefined ? undefined : ids.get(e.nodeId);
		const span = RNode.span(node) ?? node?.location;
		const text = (span && ctx.fileOf(node) === undefined ? ctx.textAt(span) : undefined) ?? node?.lexeme ?? renderFunctionName(e.functionName);
		const line = text.split('\n')[0].trim();
		return line.length > 40 ? `${line.slice(0, 39)}…` : line;
	};
	const toConsole = (group: readonly DependencyInfo[], kind: string, all: readonly DependencyInfo[], stream: string): DepNode => {
		const children = viaNested(group, e => {
			const file = ctx.fileOf(e.nodeId === undefined ? undefined : ids.get(e.nodeId));
			return { ...entry(kind, all, e, printed(e)), description: `${e.implicit ? 'auto-printed ' : ''}in ${file ? `${file} ` : ''}(L. ${locOf(e.nodeId)?.[0] ?? '?'})` };
		});
		return {
			key:         `console:${stream}${children.map(c => c.key).join('-')}`,
			kind,
			label:       stream === 'stderr' ? 'Console (stderr)' : 'Console output',
			description: `${allNodes(children).length} item${allNodes(children).length === 1 ? '' : 's'}`,
			tooltip:     `what the script prints to ${stream}`,
			icon:        'terminal' as const,
			colored:     true,
			root:        false,
			children
		};
	};

	const grouped = (kind: string, shown: readonly DependencyInfo[], all: readonly DependencyInfo[]): DepNode[] => {
		const groups = new Map<string, DependencyInfo[]>();
		for(const e of shown.filter(i => i.nodeId !== undefined).sort(byLocation)) {
			const name = guardedName(e);
			const list = groups.get(name) ?? [];
			list.push(e);
			groups.set(name, list);
		}
		return [...groups.entries()].map(([name, group]) => {
			if(kind === 'write' && ConsoleStreams.has(name)) {
				return toConsole(group, kind, all, name);
			}
			if(group.length === 1) {
				return entry(kind, all, group[0], withDataFlow(kind, group[0], displayLabel(group[0], name)));
			}
			const byValue = group[0].value !== undefined && group[0].value !== Unknown && !plots.has(group[0]);
			const children = viaNested(group, e => entry(kind, all, e, withDataFlow(kind, e, byValue ? usageName(e) : guardedName(e))));
			return {
				key:         `${name}${children.map(c => c.key).join('-')}`,
				kind,
				label:       displayLabel(group[0], name),
				description: `${allNodes(children).length} items`,
				tooltip:     name,
				icon:        'folder' as const,
				colored:     true,
				root:        false,
				children
			};
		});
	};

	const roots = kinds.map((kind): DepNode => {
		const cat = categoryInfo(kind);
		const all = (answer[kind] ?? []) as DependencyInfo[];
		const children = grouped(kind, cat.useReverseLinks ? all.filter(i => !i.linkedIds) : all, all);
		return {
			key:         `cat:${kind}`,
			kind,
			label:       cat.name,
			description: `${children.length} item${children.length === 1 ? '' : 's'}`,
			tooltip:     cat.name,
			icon:        cat.icon,
			colored:     children.length > 0,
			root:        true,
			children
		};
	});
	const seen = new Set<string>();
	for(const root of roots) {
		uniqueKeys(root, '', seen);
	}
	return { roots: roots.filter(r => r.children.length > 0), empty: roots.filter(r => r.children.length === 0) };
}

/** keys identify an entry across re-analyses, so what is unfolded stays unfolded */
function uniqueKeys(node: DepNode, parent: string, seen: Set<string>): void {
	let key = parent + node.key;
	for(let n = 1; seen.has(key); n++) {
		key = `${parent}${node.key}-${n}`;
	}
	seen.add(key);
	node.key = key;
	for(const child of node.children) {
		uniqueKeys(child, key, seen);
	}
}

/** the collapsed group of categories without findings */
export function noFindingsGroup(empty: readonly DepNode[]): DepNode {
	return {
		key:         'no-findings',
		kind:        '',
		label:       'No findings',
		description: `${empty.length} empty ${empty.length === 1 ? 'category' : 'categories'}`,
		tooltip:     `Nothing found in this file: ${empty.map(e => e.label).join(', ')}`,
		icon:        'circle-slash',
		colored:     false,
		root:        true,
		children:    [...empty]
	};
}

/** what a line's indicator says: the category, what the line does, and why it counts */
export function describeDependency(kind: string, info: DependencyInfo): { readonly name: string, readonly why: string } {
	const cat = categoryInfo(kind);
	const fn = renderFunctionName(info.functionName);
	const value = info.value && info.value !== Unknown ? ` ${String(info.value)}` : '';
	const namespaceAccess = (info.functionName as unknown) === '::' || (info.functionName as unknown) === ':::';
	const why = namespaceAccess ? `${info.value ?? 'pkg'}${String(info.functionName)}… loads the package without library()`
		: ConsoleStreams.has(String(info.value)) ? `${fn} prints to the console${info.value === 'stderr' ? ' (stderr)' : ''}`
			: `${fn} ${cat.verb}${value}`;
	return { name: cat.name, why };
}
