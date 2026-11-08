import { RString } from '../../../../r-bridge/lang-4.x/ast/model/nodes/r-string';
import { unescapeRString } from '../../../../dataflow/eval/values/string/string-constants';
import type { FileRole, FlowrFileProvider } from '../../../context/flowr-file';
import { FlowrTextFile, FlowrFile } from '../../../context/flowr-file';
import { unquoteArgument } from '../../../../abstract-interpretation/data-frame/resolve-args';
import type { RNode } from '../../../../r-bridge/lang-4.x/ast/model/model';
import type { FlowrAnalyzerContext } from '../../../context/flowr-analyzer-context';
import type {
	AstIdMap,
	NormalizedAst,
	ParentInformation
} from '../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { foldAst } from '../../../../r-bridge/lang-4.x/ast/model/processing/fold';
import { Identifier, type BrandedIdentifier, type BrandedNamespace } from '../../../../dataflow/environments/identifier';
import type { RFunctionCall } from '../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { RType } from '../../../../r-bridge/lang-4.x/ast/model/type';
import { RPrimitives } from '../../../../data/r-primitives.generated';
import {
	toUnnamedArgument
} from '../../../../dataflow/internal/process/functions/call/argument/make-argument';
import { SourceRange } from '../../../../util/range';
import { parseRRegexPattern } from '../../../../util/r-regex';
import { RArgument } from '../../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { uniqueArray } from '../../../../util/collections/arrays';

export interface NamespaceInfo {
	exportedSymbols:      BrandedIdentifier[];
	/**
	 * Names listed by `exportMethods()`: S4 methods the package registered for one of its classes, which is a
	 * different claim than an ordinary export (the package answers a generic, it does not define the function).
	 * As R's `loadNamespace`, this keeps only the non-primitive generics: a method on a primitive such as `+` or `[`
	 * binds nothing in the namespace, so `pkg::"+"` does not exist and the call stays with base.
	 */
	exportedS4Methods:    BrandedIdentifier[];
	/** Classes listed by `exportClasses()`: the S4 classes the package owns. Separated like {@link exportedS4Methods}. */
	exportedS4Classes:    BrandedIdentifier[];
	exportS3Generics:     Map<BrandedIdentifier, string[]>;
	/** For `S3method(generic, class, fun)`, the function registered as the method `generic.class` when it is not named so. */
	s3MethodFunctions?:   Map<string, string>;
	exportedPatterns:     string[];
	importedPackages:     Map<BrandedNamespace, BrandedIdentifier[] | 'all'>;
	loadsWithSideEffects: boolean;
	callable:             BrandedIdentifier[];
	/** Present only in complex parsed NAMESPACE files. Maps conditions to the parts they gate. */
	conditional?:         Map<RNode<ParentInformation>, NamespaceInfo>;
}

export interface NamespaceFormat {
	current:                         NamespaceInfo;
	[packageName: BrandedNamespace]: NamespaceInfo;
}

/**
 * Decorates a text file to expose its content as a {@link NamespaceFormat}.
 * Simple parsing is quicker but does not support `if`/other R constructs.
 */
export class FlowrNamespaceFile extends FlowrFile<NamespaceFormat> {
	private readonly wrapped: FlowrFileProvider;
	private readonly ctx:     FlowrAnalyzerContext | undefined;

	/** Prefer {@link FlowrNamespaceFile.from}, which avoids re-wrapping and handles roles. */
	constructor(file: FlowrFileProvider, ctx?: FlowrAnalyzerContext) {
		super(file.path(), file.roles);
		this.wrapped = file;
		this.ctx = ctx;
	}

	/** Creates a {@link FlowrNamespaceFile} from an already-parsed {@link NamespaceFormat}. */
	public static fromNamespaceFormat(fmt: NamespaceFormat, path: string, roles?: FileRole[]): FlowrNamespaceFile {
		const file = new FlowrNamespaceFile(new FlowrTextFile(path, roles));
		file.setContent(fmt);
		return file;
	}

	/**
	 * Loads and parses the content of the wrapped file in the {@link NamespaceFormat}.
	 * @see {@link parseNamespaceSimple} for details on the parsing logic.
	 * @see {@link parseNamespaceComplex} for a more complex parser.
	 */
	protected loadContent(): NamespaceFormat {
		return this.ctx ? parseNamespaceComplex(this.wrapped, this.ctx) : parseNamespaceSimple(this.wrapped);
	}

	public rawText(): string {
		return this.wrapped.rawText?.() ?? this.wrapped.content().toString();
	}

	/** See {@link isExportedInNamespaceFormat}, which this answers for the file's own content. */
	public isExported(name: BrandedIdentifier, pkg: BrandedNamespace = 'current'): boolean | RNode<ParentInformation>[] {
		const fmt = this.content();
		return isExportedInNamespaceFormat(fmt, name, pkg);
	}

	/**
	 * Lifts a file to a {@link FlowrNamespaceFile}, reusing it if already one and assigning roles.
	 * @param file - The file to lift or return if already a namespace file
	 * @param ctx  - An optional analyzer context to use for complex parsing
	 * @param role - An optional role to assign to the file
	 */
	public static from(file: FlowrFileProvider | FlowrNamespaceFile, ctx?: FlowrAnalyzerContext, role?: FileRole): FlowrNamespaceFile {
		if(role) {
			file.assignRole(role);
		}
		return file instanceof FlowrNamespaceFile ? file : new FlowrNamespaceFile(file, ctx);
	}
}

/**
 * Either returns whether the given symbol/function is exported from the given package
 * or the list of (`and`) conditions under which it is exported.
 * @param fmt  - The namespace format to check in
 * @param name - The name of the symbol/function to check
 * @param pkg  - The package to check in
 */
export function isExportedInNamespaceFormat(this: void, fmt: NamespaceFormat, name: BrandedIdentifier, pkg: BrandedNamespace = 'current'): boolean | RNode<ParentInformation>[] {
	const nsInfo: NamespaceInfo | undefined = pkg === 'current' ? fmt.current : fmt[pkg];
	return nsInfo ? isExportedInInfo(name, nsInfo) : false;
}

/**
 * The package an explicit `importFrom(pkg, name)` takes `name` from. A package exporting such a name defines nothing
 * of it but re-exports that package's function (`dplyr::%>%` is `magrittr::%>%`), which stays its own export all the same.
 */
export function importOrigin(this: void, name: BrandedIdentifier, nsInfo: NamespaceInfo): BrandedNamespace | undefined {
	for(const [pkg, names] of nsInfo.importedPackages) {
		if(names !== 'all' && names.includes(name)) {
			return pkg;
		}
	}
	return undefined;
}

/** As {@link isExportedInNamespaceFormat}, but for one already picked {@link NamespaceInfo}. */
export function isExportedInInfo(this: void, name: BrandedIdentifier, nsInfo: NamespaceInfo): boolean | RNode<ParentInformation>[] {
	if(nsInfo.exportedSymbols.includes(name) || nsInfo.exportedS4Methods.includes(name) || nsInfo.exportedS4Classes.includes(name)) {
		return true;
	}
	if(name.includes('.')) {
		for(const [k, m] of nsInfo.exportS3Generics.entries()) {
			if(m.some(method => `${k}.${method}` === name)) {
				return true;
			}
		}
	}
	for(const pattern of nsInfo.exportedPatterns) {
		const regex = parseRRegexPattern(unescapeRString(pattern) ?? pattern);
		if(regex.test(name)) {
			return true;
		}
	}
	if(nsInfo.conditional) {
		for(const [cond, info] of nsInfo.conditional) {
			const res = isExportedInInfo(name, info);
			if(res === true) {
				return [cond];
			} else if(Array.isArray(res)) {
				return [cond, ...res];
			}
		}
	}
	return false;
}

function parseNamespaceComplex(file: FlowrFileProvider, ctx: FlowrAnalyzerContext): NamespaceFormat {
	const analyzer = ctx.analyzer;
	if(!analyzer) {
		return parseNamespaceSimple(file);
	}
	const c = file.content().toString();
	let nast: NormalizedAst;
	try {
		nast = analyzer.normalizeStandalone(c);
	} catch{
		return parseNamespaceSimple(file);
	}
	const f = nast.ast.files[0];
	if(!f?.root) {
		return parseNamespaceSimple(file);
	}
	const nothing = getEmptyNamespaceFormat;
	return foldAst(f.root, {
		foldAccess:   nothing,
		foldBinaryOp: nothing,
		foldUnaryOp:  nothing,
		foldString:   nothing,
		foldLogical:  nothing,
		foldNumber:   nothing,
		foldPipe:     nothing,
		loop:         {
			foldBreak: nothing,
			foldNext:  nothing,
			foldWhile: (loop, _condition, body) =>
				handleConditionCall(nast.idMap, loop.condition, body, undefined),
			foldFor:    (_loop, _var, _vector, body) => body,
			foldRepeat: (_loop, body) => body,
		},
		foldExprList: (_expr, _g, children) => {
			return children.reduce<NamespaceFormat>((acc, child) => {
				return mergeNamespaceFormat(acc, child);
			}, getEmptyNamespaceFormat());
		},
		foldIfThenElse: (ifNode, _cond, thenBranch, elseBranch) =>
			handleConditionCall(nast.idMap, ifNode.condition, thenBranch, elseBranch),
		foldSymbol: nothing,
		other:      {
			foldComment:       nothing,
			foldLineDirective: nothing
		},
		functions: {
			foldFunctionDefinition: nothing,
			foldArgument:           (_arg, _name, value) => value ?? getEmptyNamespaceFormat(),
			foldParameter:          (_param, _name, defaultValue, _down) => defaultValue ?? getEmptyNamespaceFormat(),
			foldFunctionCall:       (call, expr) => {
				if(!call.named) {
					return expr ?? getEmptyNamespaceFormat();
				}
				const name = Identifier.getName(call.functionName.content);
				const g = expr ?? getEmptyNamespaceFormat();
				return applyDirective(g, name, call.arguments.flatMap(a => {
					const value = RArgument.isEmpty(a) ? undefined : a.name === undefined ? a.lexeme : a.value?.lexeme;
					return value === undefined || RArgument.isEmpty(a) ? [] : [{ name: a.name === undefined ? undefined : Identifier.getName(a.name.content), value }];
				}));
			}
		}
	});
}

/** All exported names of a namespace that can be referenced (functions, symbols, patterns, and S3 methods as `generic.class`). */
export function getExportedNames(info: NamespaceInfo): BrandedIdentifier[] {
	const s3: BrandedIdentifier[] = [];
	for(const [g, methods] of info.exportS3Generics) {
		for(const m of methods) {
			s3.push(`${g}.${m}`);
		}
	}
	return uniqueArray([...info.exportedSymbols, ...info.exportedS4Methods,
		...info.exportedS4Classes, ...info.exportedPatterns, ...s3]);
}

/** The names a package makes callable: the explicitly configured {@link NamespaceInfo#callable} subset, or all exports (see {@link getExportedNames}) by default. */
export function getCallables(info: NamespaceInfo): BrandedIdentifier[] {
	return info.callable.length > 0 ? info.callable : getExportedNames(info);
}

/** Sets the given list of strings as callable functions */
export function setCallable(info: NamespaceInfo, func: BrandedIdentifier[]): NamespaceInfo {
	const all = new Set(getExportedNames(info));
	for(const f of func) {
		if(all.has(f)) {
			info.callable.push(f);
		}
	}
	return info;
}

function handleConditionCall(idMap: AstIdMap, cond: RNode<ParentInformation>, thenBranch: NamespaceFormat, elseBranch: NamespaceFormat | undefined): NamespaceFormat {
	const g = getEmptyNamespaceFormat();
	const condMap = g.current.conditional ?? new Map<RNode<ParentInformation>, NamespaceInfo>();
	condMap.set(cond, thenBranch.current);
	if(elseBranch) {
		condMap.set(wrapRNodeInNotCall(cond, idMap), elseBranch.current);
	}
	g.current.conditional = condMap;
	return g;
}

function wrapRNodeInNotCall(node: RNode<ParentInformation>, idMap: AstIdMap): RFunctionCall<ParentInformation> {
	return {
		type:         RType.FunctionCall,
		info:         node.info,
		named:        true,
		functionName: {
			type:     RType.Symbol,
			info:     node.info,
			lexeme:   'not',
			content:  Identifier.make('not'),
			location: node.location ?? SourceRange.invalid(),
		},
		location:  node.location ?? SourceRange.invalid(),
		lexeme:    'not',
		arguments: [toUnnamedArgument(node, idMap)]
	};
}
/** The array stored for `key` in a `string[]`-valued map, creating and registering an empty one if there is none yet. */
function arrayAt<K, V = string>(map: Map<K, V[]>, key: NoInfer<K>): V[] {
	const arr = map.get(key) ?? [];
	map.set(key, arr);
	return arr;
}

/** As {@link arrayAt}, but for an import map: a package imported wholesale (`'all'`) also gets a fresh array to add to. */
function importArrayAt(map: Map<BrandedNamespace, BrandedIdentifier[] | 'all'>, key: BrandedNamespace): BrandedIdentifier[] {
	const arr = map.get(key);
	if(arr && arr !== 'all') {
		return arr;
	}
	const fresh: BrandedIdentifier[] = [];
	map.set(key, fresh);
	return fresh;
}

/** Registers `pkg` (creating it if new) as loading with side effects, as `useDynLib()` directives do. */
function markSideEffectLoader(fmt: NamespaceFormat, pkg: BrandedNamespace): void {
	(fmt[pkg] ??= emptyNamespaceInfo()).loadsWithSideEffects = true;
}

/** The positional arguments of a NAMESPACE directive as written, quotes included. */
type DirectiveArguments = readonly string[];

/** an argument of a NAMESPACE directive as written, quotes included, and its name if it is given by one */
interface DirectiveArgument {
	readonly name?: BrandedIdentifier
	readonly value: string
}

function importFrom(g: NamespaceFormat, [pkg, ...symbols]: DirectiveArguments): void {
	if(pkg !== undefined && symbols.length > 0) {
		importArrayAt(g.current.importedPackages, RString.unquote(pkg)).push(...symbols.map(RString.unquote));
	}
}

/** What each NAMESPACE directive adds, shared by the AST-based and the plain-text parser so that both read a NAMESPACE alike. */
const NamespaceDirectives = new Map<BrandedIdentifier, (g: NamespaceFormat, args: DirectiveArguments) => void>(Object.entries({
	export:        (g, args) => g.current.exportedSymbols.push(...args.map(RString.unquote)),
	exportPattern: (g, args) => g.current.exportedPatterns.push(...args.map(a => unquoteArgument(a))),
	exportClasses: (g, args) => g.current.exportedS4Classes.push(...args.map(RString.unquote)),
	/* as for R, a method on a primitive generic binds nothing in the namespace */
	exportMethods: (g, args) => g.current.exportedS4Methods.push(...args.map(RString.unquote).filter(n => !RPrimitives.has(n))),
	/* `S3method(generic, class)` and `S3method(generic, class, method)` both register the class */
	S3method:      (g, args) => {
		if(args.length !== 2 && args.length !== 3) {
			return;
		}
		const [generic, cls, fun] = args.map(RString.unquote);
		arrayAt(g.current.exportS3Generics, generic).push(cls);
		if(fun !== undefined) {
			(g.current.s3MethodFunctions ??= new Map()).set(`${generic}.${cls}`, fun);
		}
	},
	import: (g, args) => {
		for(const pkg of args) {
			g.current.importedPackages.set(RString.unquote(pkg), 'all');
		}
	},
	importFrom,
	importClassesFrom: importFrom,
	importMethodsFrom: importFrom,
	useDynLib:         (g, [pkg]) => {
		if(pkg !== undefined) {
			markSideEffectLoader(g, RString.unquote(pkg));
		}
	}
}));

/** As R's `parseNamespaceFile`, these options are read by name, every other argument by its position. */
const DirectiveOptions: ReadonlyMap<BrandedIdentifier, ReadonlySet<BrandedIdentifier>> = new Map([
	['import', new Set(['except'])],
	['useDynLib', new Set(['.registration', '.fixes'])]
]);

/** Applies the directive `name` (if it is one) with its `args` to `g`. */
function applyDirective(g: NamespaceFormat, name: BrandedIdentifier, args: readonly DirectiveArgument[]): NamespaceFormat {
	const options = DirectiveOptions.get(name);
	NamespaceDirectives.get(name)?.(g, args.filter(a => a.name === undefined || !options?.has(a.name)).map(a => a.value));
	return g;
}

const cleanLineCommentRegex = /^#.*$/gm;

/** A namespace that neither exports nor imports anything yet. */
function emptyNamespaceInfo(): NamespaceInfo {
	return {
		exportedSymbols:      [] as BrandedIdentifier[],
		exportedS4Methods:    [] as BrandedIdentifier[],
		exportedS4Classes:    [] as BrandedIdentifier[],
		exportS3Generics:     new Map<BrandedIdentifier, string[]>(),
		exportedPatterns:     [] as string[],
		importedPackages:     new Map<BrandedNamespace, BrandedIdentifier[] | 'all'>(),
		callable:             [] as BrandedIdentifier[],
		loadsWithSideEffects: false,
	};
}

function getEmptyNamespaceFormat(): NamespaceFormat {
	return { current: emptyNamespaceInfo() };
}
function mergeNamespaceFormat(target: NamespaceFormat, source: NamespaceFormat): NamespaceFormat {
	return {
		current: mergeNamespaceInfo(target.current, source.current),
		...Object.fromEntries(
			new Set<string>([...Object.keys(target), ...Object.keys(source)].filter(k => k !== 'current')).values()
				.map(pkg => {
					const targetPkg = target[pkg] || getEmptyNamespaceFormat().current;
					const sourcePkg = source[pkg] || getEmptyNamespaceFormat().current;
					return [pkg, mergeNamespaceInfo(targetPkg, sourcePkg)];
				}))
	};
}

function mergeNamespaceInfo(target: NamespaceInfo, source: NamespaceInfo): NamespaceInfo {
	const mergedConditional = new Map<RNode<ParentInformation>, NamespaceInfo>();
	if(target.conditional) {
		for(const [key, value] of target.conditional) {
			mergedConditional.set(key, value);
		}
	}
	if(source.conditional) {
		for(const [key, value] of source.conditional) {
			if(mergedConditional.has(key)) {
				const existing = mergedConditional.get(key) as NamespaceInfo;
				mergedConditional.set(key, mergeNamespaceInfo(existing, value));
			} else {
				mergedConditional.set(key, value);
			}
		}
	}

	const mergedS3Generics = new Map<BrandedIdentifier, string[]>();
	for(const [key, value] of target.exportS3Generics) {
		mergedS3Generics.set(key, [...value]);
	}
	for(const [key, value] of source.exportS3Generics) {
		const existing = mergedS3Generics.get(key);
		if(existing) {
			existing.push(...value);
		} else {
			mergedS3Generics.set(key, [...value]);
		}
	}
	const mergedImportedPackages = new Map<BrandedNamespace, BrandedIdentifier[] | 'all'>();
	for(const [key, value] of target.importedPackages) {
		mergedImportedPackages.set(key, value);
	}
	for(const [key, value] of source.importedPackages) {
		const existing = mergedImportedPackages.get(key);
		if(existing === 'all' || value === 'all') {
			mergedImportedPackages.set(key, 'all');
		} else if(existing) {
			mergedImportedPackages.set(key, [...existing, ...value]);
		} else {
			mergedImportedPackages.set(key, value);
		}
	}

	const s3MethodFunctions = target.s3MethodFunctions || source.s3MethodFunctions
		? new Map([...target.s3MethodFunctions ?? [], ...source.s3MethodFunctions ?? []]) : undefined;
	return {
		...(s3MethodFunctions ? { s3MethodFunctions } : {}),
		...(mergedConditional.size > 0 ? { conditional: mergedConditional } : {}),
		callable:             [...target.callable, ...source.callable],
		exportedSymbols:      [...target.exportedSymbols, ...source.exportedSymbols],
		exportedS4Methods:    [...target.exportedS4Methods, ...source.exportedS4Methods],
		exportedS4Classes:    [...target.exportedS4Classes, ...source.exportedS4Classes],
		exportS3Generics:     mergedS3Generics,
		exportedPatterns:     [...target.exportedPatterns, ...source.exportedPatterns],
		importedPackages:     mergedImportedPackages,
		loadsWithSideEffects: target.loadsWithSideEffects || source.loadsWithSideEffects
	};
}

/** an argument given by name (`except = c(x)`) */
const namedArgument = /^([\w.]+)\s*=(?!=)\s*(.*)$/s;

/**
 * Split a NAMESPACE directive's argument list (`a, "b", except = c(x)`) into its
 * arguments as written. Only top-level commas separate, so an argument that is itself a call stays in one piece.
 */
function splitNamespaceArgs(args: string): DirectiveArgument[] {
	const names: DirectiveArgument[] = [];
	let depth = 0;
	let start = 0;
	let quote: string | undefined;
	for(let i = 0; i <= args.length; i++) {
		const c = args[i];
		if(quote !== undefined) {
			if(c === '\\') {
				i++;
			} else if(c === quote) {
				quote = undefined;
			}
		} else if(c === '"' || c === '\'' || c === '`') {
			quote = c;
		} else if(c === '(' || c === '[') {
			depth++;
		} else if(c === ')' || c === ']') {
			depth--;
		} else if(i === args.length || (c === ',' && depth === 0)) {
			const part = args.slice(start, i).trim();
			start = i + 1;
			const named = namedArgument.exec(part);
			if(part.length > 0) {
				names.push(named === null ? { value: part } : { name: named[1], value: named[2] });
			}
		}
	}
	return names;
}

/**
 * Parses the given NAMESPACE file
 */
function parseNamespaceSimple(file: FlowrFileProvider): NamespaceFormat {
	const result = getEmptyNamespaceFormat();
	const fileContent = file.content().toString().replaceAll(cleanLineCommentRegex, '').trim()
		.split(/\r?\n/).filter(Boolean);

	for(const line of fileContent) {
		const match = line.trim().match(/^(\w+)\((.*)\)$/);
		if(!match) {
			continue;
		}
		const [, type, args] = match;
		applyDirective(result, type, splitNamespaceArgs(args));
	}

	return result;
}
