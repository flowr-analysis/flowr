import type { FileRole, FlowrFileProvider } from '../../../context/flowr-file';
import { FlowrFile } from '../../../context/flowr-file';
import { unquoteArgument } from '../../../../abstract-interpretation/data-frame/resolve-args';
import { removeRQuotes } from '../../../../r-bridge/retriever';
import type { RNode } from '../../../../r-bridge/lang-4.x/ast/model/model';
import type { FlowrAnalyzerContext } from '../../../context/flowr-analyzer-context';
import type {
	AstIdMap,
	NormalizedAst,
	ParentInformation
} from '../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { foldAst } from '../../../../r-bridge/lang-4.x/ast/model/processing/fold';
import { Identifier } from '../../../../dataflow/environments/identifier';
import { isNotUndefined } from '../../../../util/assert';
import type { RFunctionArgument, RFunctionCall } from '../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { EmptyArgument } from '../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { RType } from '../../../../r-bridge/lang-4.x/ast/model/type';
import {
	toUnnamedArgument
} from '../../../../dataflow/internal/process/functions/call/argument/make-argument';
import { invalidRange } from '../../../../util/range';

export interface NamespaceInfo {
	exportedSymbols:      string[];
	exportedFunctions:    string[];
	exportS3Generics:     Map<string, string[]>;
	exportedPatterns:     string[];
	importedPackages:     Map<string, string[] | 'all'>;
	loadsWithSideEffects: boolean;
	/**
	 * This will only be present in complex parsed NAMESPACE files and tell you
	 * about which parts are only active with given conditions!
	 */
	conditional?:         Map<RNode, NamespaceInfo>;
}

export interface NamespaceFormat {
	current:               NamespaceInfo;
	[packageName: string]: NamespaceInfo;
}

// TODO: add export etc. from others, support at least R version resolve usw.

/**
 * This decorates a text file and provides access to its content in the {@link NamespaceFormat}.
 * Namespace files can be parsed in a simple mode which is much quicker, but does not support `if`/other R-constructs!
 */
export class FlowrNamespaceFile extends FlowrFile<NamespaceFormat> {
	private readonly wrapped: FlowrFileProvider;
	private readonly ctx:     FlowrAnalyzerContext | undefined;

	/**
	 * Prefer the static {@link FlowrNamespaceFile.from} method to create instances of this class as it will not re-create if already a namespace file
	 * and handle role assignments.
	 */
	constructor(file: FlowrFileProvider, ctx?: FlowrAnalyzerContext) {
		super(file.path(), file.roles);
		this.wrapped = file;
		this.ctx = ctx;
	}

	/**
	 * Loads and parses the content of the wrapped file in the {@link NamespaceFormat}.
	 * @see {@link parseNamespaceSimple} for details on the parsing logic.
	 * @see {@link parseNamespaceComplex} for a more complex parser.
	 */
	protected loadContent(): NamespaceFormat {
		return this.ctx ? parseNamespaceComplex(this.wrapped, this.ctx) : parseNamespaceSimple(this.wrapped);
	}

	/**
	 * Namespace file lifter, this does not re-create if already a namespace file
	 * and handles role assignments.
	 * @param file - The file to lift or return if already a namespace file
	 * @param ctx - An optional analyzer context to use for complex parsing
	 * @param role - An optional role to assign to the file
	 */
	public static from(file: FlowrFileProvider | FlowrNamespaceFile, ctx?: FlowrAnalyzerContext, role?: FileRole): FlowrNamespaceFile {
		if(role) {
			file.assignRole(role);
		}
		return file instanceof FlowrNamespaceFile ? file : new FlowrNamespaceFile(file, ctx);
	}
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
	if(!f || !f.root) {
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
				switch(name) {
					case 'export':
						return handleExportCall(g, call.arguments);
					case 'exportPattern':
						return handleExportPatternCall(g, call.arguments);
					case 'S3method':
						return handleS3MethodCall(g, call.arguments);
					case 'import':
						return handleImportCall(g, call.arguments);
					case 'importFrom':
						return handleImportFromCall(g, call.arguments);
					case 'useDynLib':
						return handleUseDynLibCall(g, call.arguments);
					case 'exportClasses':
					case 'exportMethods':
						return handleExportClassesCall(g, call.arguments);
				}
				return g;
			}
		}
	});
}

function handleConditionCall(idMap: AstIdMap, cond: RNode<ParentInformation>, thenBranch: NamespaceFormat, elseBranch: NamespaceFormat | undefined): NamespaceFormat {
	const g = getEmptyNamespaceFormat();
	const condMap = g.current.conditional ?? new Map<RNode, NamespaceInfo>();
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
			location: node.location ?? invalidRange(),
		},
		location:  node.location ?? invalidRange(),
		lexeme:    'not',
		arguments: [toUnnamedArgument(node, idMap)]
	};
}
function handleExportCall(g: NamespaceFormat, args: readonly RFunctionArgument<ParentInformation>[]): NamespaceFormat {
	g.current.exportedSymbols.push(...args.filter(a => a !== EmptyArgument).map(a => a.lexeme ? removeRQuotes(a.lexeme) : undefined).filter(isNotUndefined));
	return g;
}
function handleExportPatternCall(g: NamespaceFormat, args: readonly RFunctionArgument<ParentInformation>[]): NamespaceFormat {
	g.current.exportedPatterns.push(...args.filter(a => a !== EmptyArgument).map(a => a.lexeme ? unquoteArgument(a.lexeme) : undefined).filter(isNotUndefined));
	return g;
}
function handleS3MethodCall(g: NamespaceFormat, args: readonly RFunctionArgument<ParentInformation>[]): NamespaceFormat {
	if(args.length !== 2) {
		return g;
	}
	const pkgArg = args[0];
	const funcArg = args[1];
	if(pkgArg === EmptyArgument || funcArg === EmptyArgument || !pkgArg.lexeme || !funcArg.lexeme) {
		return g;
	}
	const pkg = removeRQuotes(pkgArg.lexeme);
	const func = removeRQuotes(funcArg.lexeme);
	let arr = g.current.exportS3Generics.get(pkg);
	if(!arr) {
		arr = [];
		g.current.exportS3Generics.set(pkg, arr);
	}
	arr.push(func);
	return g;
}
function handleImportCall(g: NamespaceFormat, args: readonly RFunctionArgument<ParentInformation>[]): NamespaceFormat {
	if(args.length !== 1) {
		return g;
	}
	const pkgArg = args[0];
	if(pkgArg === EmptyArgument || !pkgArg.lexeme) {
		return g;
	}
	const pkg = removeRQuotes(pkgArg.lexeme);
	g.current.importedPackages?.set(pkg, 'all');
	return g;
}

function handleImportFromCall(g: NamespaceFormat, args: readonly RFunctionArgument<ParentInformation>[]): NamespaceFormat {
	if(args.length < 2) {
		return g;
	}
	const pkgArg = args[0];
	if(pkgArg === EmptyArgument || !pkgArg.lexeme) {
		return g;
	}
	const pkg = removeRQuotes(pkgArg.lexeme);
	let arr = g.current.importedPackages?.get(pkg);
	if(!arr || arr === 'all') {
		arr = [];
		g.current.importedPackages?.set(pkg, arr);
	}
	for(let i = 1; i < args.length; i++) {
		const symArg = args[i];
		if(symArg === EmptyArgument || !symArg.lexeme) {
			continue;
		}
		const sym = removeRQuotes(symArg.lexeme);
		arr.push(sym);
	}
	return g;
}
function handleUseDynLibCall(g: NamespaceFormat, args: readonly RFunctionArgument<ParentInformation>[]): NamespaceFormat {
	if(args.length < 1) {
		return g;
	}
	const pkgArg = args[0];
	if(pkgArg === EmptyArgument || !pkgArg.lexeme) {
		return g;
	}
	const pkg = removeRQuotes(pkgArg.lexeme);
	if(!g[pkg]) {
		g[pkg] = {
			exportedSymbols:      [],
			exportedFunctions:    [],
			exportS3Generics:     new Map<string, string[]>(),
			exportedPatterns:     [],
			importedPackages:     new Map<string, string[] | 'all'>(),
			loadsWithSideEffects: false,
		};
	}
	g[pkg].loadsWithSideEffects = true;
	return g;
}
function handleExportClassesCall(g: NamespaceFormat, args: readonly RFunctionArgument<ParentInformation>[]): NamespaceFormat {
	if(args.length !== 1) {
		return g;
	}
	const classArg = args[0];
	if(classArg === EmptyArgument || !classArg.lexeme) {
		return g;
	}
	const className = removeRQuotes(classArg.lexeme);
	g.current.exportedFunctions.push(className);
	return g;
}
const cleanLineCommentRegex = /^#.*$/gm;

function getEmptyNamespaceFormat(): NamespaceFormat {
	return {
		current: {
			exportedSymbols:      [] as string[],
			exportedFunctions:    [] as string[],
			exportS3Generics:     new Map<string, string[]>(),
			exportedPatterns:     [] as string[],
			importedPackages:     new Map<string, string[] | 'all'>(),
			loadsWithSideEffects: false,
		},
	};
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
	const mergedConditional = new Map<RNode, NamespaceInfo>();
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

	return {
		exportedSymbols:   [...target.exportedSymbols, ...source.exportedSymbols],
		exportedFunctions: [...target.exportedFunctions, ...source.exportedFunctions],
		exportS3Generics:  new Map<string, string[]>([
			...target.exportS3Generics,
			...source.exportS3Generics,
		]),
		exportedPatterns: [...target.exportedPatterns, ...source.exportedPatterns],
		importedPackages: new Map<string, string[] | 'all'>([
			...target.importedPackages,
			...source.importedPackages,
		]),
		loadsWithSideEffects: target.loadsWithSideEffects || source.loadsWithSideEffects,
		conditional:          mergedConditional
	};
}

/**
 * Parses the given NAMESPACE file
 */
function parseNamespaceSimple(file: FlowrFileProvider): NamespaceFormat {
	const result = getEmptyNamespaceFormat();
	const fileContent = file.content().toString().replaceAll(cleanLineCommentRegex, '').trim()
		.split(/\r?\n/).filter(Boolean);

	for(const line of fileContent) {
		const match = line.trim().match(/^(\w+)\(([^)]*)\)$/);
		if(!match) {
			continue;
		}
		const [, type, args] = match;

		switch(type) {
			case 'exportClasses':
			case 'exportMethods':
				result.current.exportedFunctions.push(removeRQuotes(args));
				break;
			case 'S3method':
			{
				const parts = args.split(',').map(s => removeRQuotes(s.trim()));
				if(parts.length !== 2) {
					continue;
				}
				const [pkg, func] = parts;
				let arr = result.current.exportS3Generics.get(pkg);
				if(!arr) {
					arr = [];
					result.current.exportS3Generics.set(pkg, arr);
				}
				arr.push(func);
				break;
			}
			case 'export':
				result.current.exportedSymbols.push(removeRQuotes(args));
				break;
			case 'useDynLib':
			{
				const parts = args.split(',').map(s => s.trim());
				if(parts.length !== 2) {
					continue;
				}
				const [pkg] = parts;
				if(!result[pkg]) {
					result[pkg] = {
						exportedSymbols:      [],
						exportedFunctions:    [],
						exportS3Generics:     new Map<string, string[]>(),
						exportedPatterns:     [],
						importedPackages:     new Map<string, string[] | 'all'>(),
						loadsWithSideEffects: false,
					};
				}
				result[pkg].loadsWithSideEffects = true;
				break;
			}
			case 'import': {
				const pkg = args.trim();
				result.current.importedPackages?.set(pkg, 'all');
				break;
			}
			case 'importFrom': {
				const parts = args.split(',').map(s => s.trim());
				if(parts.length < 2) {
					continue;
				}
				const [pkg, ...symbols] = parts;
				let arr = result.current.importedPackages?.get(pkg);
				if(!arr || arr === 'all') {
					arr = [];
					result.current.importedPackages?.set(pkg, arr);
				}
				arr.push(...symbols);
				break;
			}
			case 'exportPattern': {
				result.current.exportedPatterns?.push(unquoteArgument(args.trim()));
				break;
			}
		}
	}

	return result;
}
