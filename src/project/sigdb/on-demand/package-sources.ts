import type Parser from 'web-tree-sitter';
import { FlowrInlineTextFile } from '../../context/flowr-file';
import { FlowrDescriptionFile } from '../../plugins/file-plugins/files/flowr-description-file';
import type { DecodedFunction, SigParameter } from '../decode';
import { MaxDefaultLength } from '../schema';
import type { BrandedIdentifier, BrandedNamespace } from '../../../dataflow/environments/identifier';
import { ArgProp } from '../../../dataflow/environments/built-in-props';
import { parseRRegexPattern } from '../../../util/r-regex';
import { uniqueArray } from '../../../util/collections/arrays';
import { TreeSitterType } from '../../../r-bridge/lang-4.x/tree-sitter/tree-sitter-types';

/**
 * What flowR recovers of a package from its sources: the exports its `NAMESPACE` states (an `exportPattern`
 * matched against the names the code defines) and the formals of every function its `R/` files define at the
 * top level. This is what an on-demand signature source serves for a package no database knows.
 */
export interface RecoveredPackage {
	readonly name:      BrandedNamespace;
	readonly version?:  string;
	/** where the sources came from, like `github:masurp/ggmirt` */
	readonly origin:    string;
	readonly exported:  readonly BrandedIdentifier[];
	readonly s4Classes: readonly string[];
	readonly functions: readonly DecodedFunction[];
}

/** The R files of a package source, the way `R CMD build` picks them: `R/*.R` (and `.r`, `.S`, `.s`, `.q`), not the platform subdirectories. */
export function isPackageCodeFile(path: string): boolean {
	return /^R\/[^/]+\.[RrSsq]$/.test(path);
}

/** the files of a package source the recovery reads */
export function isRecoveredFile(path: string): boolean {
	return path === 'DESCRIPTION' || path === 'NAMESPACE' || isPackageCodeFile(path);
}

const AssignLeft = new Set(['<-', '=', '<<-', ':=']);
const AssignRight = new Set(['->', '->>']);

/** the name a definition binds, without the quotes or backticks it may be written with */
function boundName(node: Parser.SyntaxNode): string | undefined {
	if(node.type === TreeSitterType.Identifier) {
		return node.text.startsWith('`') && node.text.endsWith('`') && node.text.length > 1 ? node.text.slice(1, -1) : node.text;
	} else if(node.type === TreeSitterType.String) {
		return node.childForFieldName('content')?.text ?? '';
	}
	return undefined;
}

function shortened(text: string): string {
	return text.length > MaxDefaultLength ? `${text.slice(0, MaxDefaultLength)}…` : text;
}

function signatureOf(definition: Parser.SyntaxNode): SigParameter[] {
	const parameters = definition.childForFieldName('parameters')?.namedChildren.filter(p => p.type === TreeSitterType.Parameter) ?? [];
	return parameters.flatMap(p => {
		const name = p.childForFieldName('name');
		if(name === null) {
			return [];
		}
		const value = p.childForFieldName('default');
		const param = name.type === TreeSitterType.Dots ? '...' : boundName(name) ?? name.text;
		return [value === null
			? { name: param, props: param === '...' ? 0 : ArgProp.NoDefault }
			: { name: param, props: 0, default: shortened(value.text) }];
	});
}

/** the expression within parentheses, `(function(x) x)` is a function as well */
function unwrapped(node: Parser.SyntaxNode): Parser.SyntaxNode {
	while(node.type === TreeSitterType.ParenthesizedExpression && node.namedChildren.length === 1) {
		node = node.namedChildren[0];
	}
	return node;
}

/** the name an assignment binds and the value it binds it to, `undefined` for another operator or a target that is no name (`x$a <- 1`) */
function assignment(node: Parser.SyntaxNode): { name: string, value: Parser.SyntaxNode } | undefined {
	if(node.type !== TreeSitterType.BinaryOperator) {
		return undefined;
	}
	const operator = node.childForFieldName('operator')?.type ?? '';
	const [target, value] = AssignLeft.has(operator) ? [node.childForFieldName('lhs'), node.childForFieldName('rhs')]
		: AssignRight.has(operator) ? [node.childForFieldName('rhs'), node.childForFieldName('lhs')] : [null, null];
	const name = target === null ? undefined : boundName(target);
	return name === undefined || value === null ? undefined : { name, value };
}

interface Definitions {
	readonly names:     string[];
	readonly functions: DecodedFunction[];
}

/** the string a call's first argument is, like the `"show"` of `setGeneric("show", ...)` */
function firstStringArgument(call: Parser.SyntaxNode): string | undefined {
	const first = call.childForFieldName('arguments')?.namedChildren.find(a => a.type === TreeSitterType.Argument);
	const value = first?.childForFieldName('value');
	return value?.type === TreeSitterType.String ? boundName(value) : undefined;
}

/** the definitions a top-level expression makes, looking into blocks and branches (`if(getRversion() >= "4.0") f <- ...`) but not into functions */
function collect(node: Parser.SyntaxNode, file: string, into: Definitions, exportedFrom: (name: string) => boolean): void {
	switch(node.type) {
		case TreeSitterType.BinaryOperator: {
			const assigned = assignment(node);
			if(assigned === undefined) {
				return;
			}
			into.names.push(assigned.name);
			/* `f <- g <- function(x) x` defines both */
			collect(assigned.value, file, into, exportedFrom);
			let value = unwrapped(assigned.value);
			for(let inner = assignment(value); inner !== undefined; inner = assignment(value)) {
				value = unwrapped(inner.value);
			}
			if(value.type === TreeSitterType.FunctionDefinition) {
				into.functions.push({ name: assigned.name, file, line: node.startPosition.row + 1, exported: exportedFrom(assigned.name), props: [], signature: signatureOf(value), callees: [] });
			}
			return;
		}
		case TreeSitterType.Call: {
			const callee = node.childForFieldName('function')?.text;
			if(callee === 'setGeneric' || callee === 'methods::setGeneric') {
				const name = firstStringArgument(node);
				const definition = node.childForFieldName('arguments')?.namedChildren
					.map(a => a.childForFieldName('value')).find(v => v?.type === TreeSitterType.FunctionDefinition);
				if(name !== undefined) {
					into.names.push(name);
					if(definition) {
						into.functions.push({ name, file, line: node.startPosition.row + 1, exported: exportedFrom(name), props: ['generic'], signature: signatureOf(definition), callees: [] });
					}
				}
			}
			return;
		}
		case TreeSitterType.BracedExpression:
		case TreeSitterType.Program:
			for(const child of node.namedChildren) {
				collect(child, file, into, exportedFrom);
			}
			return;
		case TreeSitterType.IfStatement:
			for(const field of ['consequence', 'alternative']) {
				const branch = node.childForFieldName(field);
				if(branch) {
					collect(branch, file, into, exportedFrom);
				}
			}
			return;
		default:
			return;
	}
}

/** what a `NAMESPACE` exports: names (`export`), patterns (`exportPattern`), and classes (`exportClasses`) */
interface NamespaceDirectives {
	readonly exports:  string[];
	readonly patterns: string[];
	readonly classes:  string[];
}

/** the directives of a `NAMESPACE`, read as the R code it is, so a directive spanning lines or a conditional one counts as well */
function namespaceDirectives(root: Parser.SyntaxNode): NamespaceDirectives {
	const found: NamespaceDirectives = { exports: [], patterns: [], classes: [] };
	const visit = (node: Parser.SyntaxNode): void => {
		if(node.type === TreeSitterType.Call) {
			const args = node.childForFieldName('arguments')?.namedChildren.filter(a => a.type === TreeSitterType.Argument && a.childForFieldName('name') === null)
				.flatMap(a => {
					const value = a.childForFieldName('value');
					return value === null ? [] : [boundName(value)].filter(v => v !== undefined);
				}) ?? [];
			const directive = node.childForFieldName('function')?.text;
			const into = directive === 'export' ? found.exports : directive === 'exportPattern' ? found.patterns
				: directive === 'exportClasses' || directive === 'exportClass' ? found.classes : undefined;
			into?.push(...args);
		} else {
			node.namedChildren.forEach(visit);
		}
	};
	visit(root);
	return found;
}

/**
 * Recovers a package from the files of its source (`DESCRIPTION`, `NAMESPACE`, `R/*.R`, paths relative to its
 * root), parsing the code with `parse`. `undefined` if the files are no R package (no `DESCRIPTION` naming one).
 * Without a `NAMESPACE`, as old packages have, every name not starting with a dot is exported, as R does.
 */
export function recoverPackage(files: ReadonlyMap<string, string>, parse: (code: string) => Parser.Tree, origin: string): RecoveredPackage | undefined {
	const descriptionText = files.get('DESCRIPTION');
	if(descriptionText === undefined) {
		return undefined;
	}
	const description = new FlowrDescriptionFile(new FlowrInlineTextFile('DESCRIPTION', descriptionText));
	const name = description.packageName();
	if(name === undefined || !/^[A-Za-z][A-Za-z0-9.]*$/.test(name)) {
		return undefined;
	}
	const namespaceText = files.get('NAMESPACE');
	const namespace = namespaceText === undefined ? undefined : namespaceDirectives(parse(namespaceText).rootNode);
	const stated = new Set(namespace?.exports ?? []);
	const patterns = namespace?.patterns.map(parseRRegexPattern) ?? [];
	const exportedFrom = namespace === undefined ? (n: string) => !n.startsWith('.') : (n: string) => stated.has(n) || patterns.some(p => p.test(n));
	const definitions: Definitions = { names: [], functions: [] };
	/* the collation order decides which of two definitions of one name wins, alphabetical by default */
	const collate = description.collate()?.map(f => `R/${f}`);
	const code = [...files.keys()].filter(isPackageCodeFile).sort();
	const ordered = collate === undefined ? code : uniqueArray([...collate.filter(f => files.has(f)), ...code]);
	for(const file of ordered) {
		collect(parse(files.get(file) ?? '').rootNode, file, definitions, exportedFrom);
	}
	const latest = new Map(definitions.functions.map(f => [f.name, f]));
	const exported = uniqueArray([...stated, ...definitions.names.filter(exportedFrom)]);
	return {
		name,
		version:   versionField(descriptionText) ?? description.version()?.str,
		origin,
		exported,
		s4Classes: namespace?.classes ?? [],
		functions: [...latest.values()]
	};
}

/** the `Version` field as written, for one semver cannot read (`1.2-3`) */
function versionField(description: string): string | undefined {
	return /^Version:\s*(\S+)/m.exec(description)?.[1];
}

/** the most names, functions, and parameters a recovered package may state, so a crafted one cannot bloat the analysis */
export const RecoveredLimits = { names: 20_000, parameters: 256, nameLength: 256 } as const;

/** whether the code unit is a control character (below space, or DEL) */
const isControl = (code: number) => code < 0x20 || code === 0x7f;

function hasControlChar(text: string): boolean {
	for(let i = 0; i < text.length; i++) {
		if(isControl(text.charCodeAt(i))) {
			return true;
		}
	}
	return false;
}

function withoutControlChars(text: string): string {
	return Array.from(text, c => isControl(c.charCodeAt(0)) ? ' ' : c).join('');
}

/** a name R may bind: not empty, not too long, no control characters, and nothing that names an object prototype */
function isBindableName(name: unknown): name is string {
	return typeof name === 'string' && name.length > 0 && name.length <= RecoveredLimits.nameLength && !hasControlChar(name) && name !== '__proto__';
}

function sanitizedParameter(p: unknown): SigParameter | undefined {
	const param = p as Partial<SigParameter> | undefined;
	if(typeof param !== 'object' || param === null || !isBindableName(param.name)) {
		return undefined;
	}
	/* whether a parameter has a default is all the sources say, every other bit is flowR's to state, never a package's */
	const props = typeof param.props === 'number' ? param.props & ArgProp.NoDefault : 0;
	const value = typeof param.default === 'string' ? shortened(withoutControlChars(param.default)) : undefined;
	return value === undefined ? { name: param.name, props } : { name: param.name, props, default: value };
}

function sanitizedFunction(f: unknown): DecodedFunction | undefined {
	const fn = f as Partial<DecodedFunction> | undefined;
	if(typeof fn !== 'object' || fn === null || !isBindableName(fn.name) || !Array.isArray(fn.signature)) {
		return undefined;
	}
	return {
		name:      fn.name,
		file:      typeof fn.file === 'string' && isPackageCodeFile(fn.file) ? fn.file : undefined,
		line:      Number.isInteger(fn.line) && (fn.line as number) > 0 ? fn.line as number : 0,
		exported:  fn.exported === true,
		props:     Array.isArray(fn.props) && fn.props.includes('generic') ? ['generic'] : [],
		signature: fn.signature.slice(0, RecoveredLimits.parameters).map(sanitizedParameter).filter(p => p !== undefined),
		callees:   []
	};
}

/**
 * What of a recovered package (fresh from its sources, or read back from the cache, both of which an attacker
 * may have shaped) flowR is willing to use: package and bindable names only, a version that is one, bounded
 * sizes, and no properties beyond the ones the recovery itself states. Names in `shielded` are dropped from the
 * exports: a package nobody vetted must not take over a call flowR knows to be security relevant, like `system`,
 * which would hide that call from every analysis looking for it. `undefined` for something that is no package.
 */
export function sanitizeRecovered(value: unknown, shielded: ReadonlySet<BrandedIdentifier> = new Set()): RecoveredPackage | undefined {
	const pkg = value as Partial<RecoveredPackage> | undefined;
	if(typeof pkg !== 'object' || pkg === null || typeof pkg.name !== 'string' || !/^[A-Za-z][A-Za-z0-9.]*$/.test(pkg.name)
		|| !Array.isArray(pkg.exported) || !Array.isArray(pkg.functions) || !Array.isArray(pkg.s4Classes)) {
		return undefined;
	}
	const exported = uniqueArray(pkg.exported.filter(isBindableName).filter(n => !shielded.has(n))).slice(0, RecoveredLimits.names);
	const isExported = new Set<BrandedIdentifier>(exported);
	return {
		name:      pkg.name,
		version:   typeof pkg.version === 'string' && /^[0-9][0-9.-]{0,40}$/.test(pkg.version) ? pkg.version : undefined,
		origin:    typeof pkg.origin === 'string' && !hasControlChar(pkg.origin) ? pkg.origin.slice(0, 200) : 'unknown',
		exported,
		s4Classes: uniqueArray(pkg.s4Classes.filter(isBindableName)).slice(0, RecoveredLimits.names),
		functions: pkg.functions.slice(0, RecoveredLimits.names).map(sanitizedFunction).filter(f => f !== undefined)
			.map(f => ({ ...f, exported: f.exported && isExported.has(f.name) }))
	};
}
