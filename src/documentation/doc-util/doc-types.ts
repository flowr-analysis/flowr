import type { ModifierLike, NamedDeclaration, SourceFile, TypeChecker } from 'typescript';
import ts, { SyntaxKind } from 'typescript';
import { guard } from '../../util/assert';
import { RemoteFlowrFilePathBaseRef } from './doc-files';
import fs from 'fs';
import path from 'path';
import { escapeMarkdown } from '../../util/mermaid/mermaid';
import { codeBlock } from './doc-code';
import { details } from './doc-structure';
import { textWithTooltip } from '../../util/html-hover-over';
import { prefixLines } from './doc-general';

/**
 * Kinds of TypeScript type elements we can encounter.
 * Please note, that a `function` is also a `variable` here.
 */
export type TypeElementKind = 'interface' | 'type' | 'enum' | 'class' | 'variable';

/**
 * The full underlying information about a TypeScript type element found in source code.
 */
export interface TypeElementInSource {
	name:                 string;
	node:                 ts.Node;
	kind:                 TypeElementKind;
	extends:              string[];
	generics:             string[];
	filePath:             string;
	lineNumber:           number;
	comments?:            string[];
	readonly properties?: string[];
}

const options: ts.CompilerOptions = {
	target:                       ts.ScriptTarget.ESNext,
	skipLibCheck:                 true,
	skipDefaultLibCheck:          true,
	allowJs:                      true,
	strict:                       false,
	checkJs:                      false,
	strictNullChecks:             false,
	noUncheckedIndexedAccess:     false,
	noUncheckedSideEffectImports: false,
	noCheck:                      true,
	noEmit:                       true,
	noResolve:                    true,
	noUnusedLocals:               false,
	alwaysStrict:                 true,
	incremental:                  false,
	types:                        [],
	lib:                          [],
	noLib:                        true,
	moduleResolution:             ts.ModuleResolutionKind.Classic,
	allowUnreachableCode:         true,
	allowUnusedLabels:            true,
	disableSolutionSearching:     true,

} as const;

/**
 * Retrieve TypeScript source files from the given file names.
 */
export function getTypeScriptSourceFiles(fileNames: readonly string[]): { files: ts.SourceFile[], program: ts.Program } {
	try {
		const program = ts.createProgram(fileNames, options);
		return { program, files: fileNames.map(fileName => program.getSourceFile(fileName)).filter(file => !!file) };
	} catch(err) {
		console.error('Failed to get source files', err);
		return { files: [], program: undefined as unknown as ts.Program };
	}
}


const DropGenericsPattern = /<.*>/g;
/**
 * Drop generics from a TypeScript type name.
 * @example
 * ```ts
 * const typeName = 'MyType<T, U>';
 * const cleanName = dropGenericsFromTypeName(typeName);
 * console.log(cleanName); // 'MyType'
 * ```
 */
export function dropGenericsFromTypeName(type: string): string {
	let previous;
	do{
		previous = type;
		type = type.replace(DropGenericsPattern, '');
	} while(type !== previous);
	return type;
}

const PruneDocCommentPattern =  /^\/\*\*?|\*\/$|^\s*\*\s?|\s*\*$/gm;
const PrunedocLinkPattern = /\{@[a-zA-Z]+ ([^}]+\|)?(?<name>[^}]+)}/gm;
/**
 * Remove comment symbols from a TypeScript comment string.
 * This also takes care of special JSDoc tags like `{@link ...}` and `{@see ...}`.
 * @example
 * ```ts
 * const comment = '/**\n* This is a comment.\n* It has multiple lines.\n *\/'; // closing comment sadly escaped for ts doc
 * const cleaned = removeCommentSymbolsFromTypeScriptComment(comment);
 * console.log(cleaned);
 * ```
 * This will output:
 * ```md
 * This is a comment.
 * It has multiple lines.
 * ```
 */
export function removeCommentSymbolsFromTypeScriptComment(comment: string): string {
	return comment
	// remove '/** \n * \n */...
		.replace(PruneDocCommentPattern, '')
	// replace {@key foo|bar} with `bar` and {@key foo} with `foo`
		.replace(PrunedocLinkPattern, '<code>$<name></code>')
		.trim();
}

function getTextualCommentsFromTypeScript(node: ts.Node): string[] {
	const comments = ts.getJSDocCommentsAndTags(node);
	const out: string[] = [];
	for(const { comment } of comments) {
		if(typeof comment === 'string') {
			out.push(removeCommentSymbolsFromTypeScriptComment(comment));
		} else if(comment !== undefined) {
			for(const c of comment) {
				out.push(removeCommentSymbolsFromTypeScriptComment(c.getText(c.getSourceFile())));
			}
		}
	}
	return out;
}


/**
 *
 */
export function getStartLineOfTypeScriptNode(node: ts.Node, sourceFile: ts.SourceFile): number {
	const lineStart = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line;
	return lineStart + 1;
}

function formatNode(node: NamedDeclaration, sourceFile: SourceFile, typeChecker: TypeChecker): string {
	const name = node.name?.getText(sourceFile);
	let prefix = '', suffix = '';

	if('modifiers' in node && Array.isArray(node.modifiers)) {
		if(node.modifiers.some((modifier: ModifierLike) => modifier.kind === SyntaxKind.PrivateKeyword)) {
			prefix = '-';
		} else if(node.modifiers.some((modifier: ModifierLike) => modifier.kind === SyntaxKind.ProtectedKeyword)) {
			prefix = '#';
		} else if(node.modifiers.some((modifier: ModifierLike) => modifier.kind === SyntaxKind.PublicKeyword)) {
			prefix = '+';
		}
		if(node.modifiers.some((modifier: ModifierLike) => modifier.kind === SyntaxKind.AbstractKeyword)) {
			suffix = '*';
		} else if(node.modifiers.some((modifier: ModifierLike) => modifier.kind === SyntaxKind.StaticKeyword)) {
			suffix = '$';
		}
	}
	const type = getType(node, typeChecker);
	const typeAnnotation = type.includes('=>') ? type.replace(/\s+=>\s+/, ' ') : ': ' + type;

	return `${prefix}${escapeMarkdown(name + typeAnnotation)}${suffix}`;
}

function getType(node: ts.Node, typeChecker: ts.TypeChecker): string {
	const tryDirect = typeChecker.getTypeAtLocation(node);
	return tryDirect ? typeChecker.typeToString(tryDirect) : 'unknown';
}

const defaultSkip = ['Pick', 'Partial', 'Required', 'Readonly', 'Omit', 'DeepPartial', 'DeepReadonly', 'DeepWritable', 'StrictOmit'];


function followTypeReference(type: ts.TypeReferenceNode, sourceFile: ts.SourceFile): string[] {
	const node = type.typeName;
	if(ts.isQualifiedName(node)) {
		return [node.right.getText(sourceFile) ?? ''];
	}
	const args = type.typeArguments?.map(arg => arg.getText(sourceFile)) ?? [];
	const nodeLexeme = node.getText(sourceFile) ?? '';
	const baseLexeme = type.getText(sourceFile) ?? '';

	if(defaultSkip.map(s => nodeLexeme.startsWith(s))) {
		return [baseLexeme, ...args];
	}
	return [nodeLexeme, baseLexeme, ...args];
}

function collectHierarchyInformation(sourceFiles: readonly ts.SourceFile[], options: GetTypesWithProgramOption): TypeElementInSource[] {
	const hierarchyList: TypeElementInSource[] = [];
	const typeChecker = options.program.getTypeChecker();
	const visit = (node: ts.Node | undefined, sourceFile: ts.SourceFile) => {
		if(!node) {
			return;
		}

		if(ts.isInterfaceDeclaration(node)) {
			const interfaceName = node.name?.getText(sourceFile) ?? '';
			const baseTypes = node.heritageClauses?.flatMap(clause =>
				clause.types
					.map(type => type.getText(sourceFile) ?? '')
					.map(dropGenericsFromTypeName)
			) ?? [];
			const generics = node.typeParameters?.map(param => param.getText(sourceFile) ?? '') ?? [];

			hierarchyList.push({
				name:       dropGenericsFromTypeName(interfaceName),
				node,
				kind:       'interface',
				extends:    baseTypes,
				generics,
				comments:   getTextualCommentsFromTypeScript(node),
				filePath:   sourceFile.fileName,
				lineNumber: getStartLineOfTypeScriptNode(node, sourceFile),
				properties: node.members.map(member => formatNode(member, sourceFile, typeChecker)),
			});
		} else if(ts.isTypeAliasDeclaration(node)) {
			const typeName = node.name?.getText(sourceFile) ?? '';
			let baseTypes: string[] = [];
			if(ts.isIntersectionTypeNode(node.type) || ts.isUnionTypeNode(node.type)) {
				baseTypes = node.type.types
					.filter(typeNode => ts.isTypeReferenceNode(typeNode))
					.flatMap(typeName => followTypeReference(typeName, sourceFile))
					.map(dropGenericsFromTypeName);
			} else if(ts.isTypeReferenceNode(node.type)) {
				baseTypes = followTypeReference(node.type, sourceFile).map(dropGenericsFromTypeName);
			}

			const generics = node.typeParameters?.map(param => param.getText(sourceFile) ?? '') ?? [];

			hierarchyList.push({
				name:       dropGenericsFromTypeName(typeName),
				node,
				kind:       'type',
				extends:    baseTypes,
				comments:   getTextualCommentsFromTypeScript(node),
				generics,
				filePath:   sourceFile.fileName,
				lineNumber: getStartLineOfTypeScriptNode(node, sourceFile),
			});
		} else if(ts.isEnumDeclaration(node)) {
			const enumName = node.name?.getText(sourceFile) ?? '';
			hierarchyList.push({
				name:       dropGenericsFromTypeName(enumName),
				node,
				kind:       'enum',
				extends:    [],
				comments:   getTextualCommentsFromTypeScript(node),
				generics:   [],
				filePath:   sourceFile.fileName,
				lineNumber: getStartLineOfTypeScriptNode(node, sourceFile),
				properties: node.members.map(member => formatNode(member, sourceFile, typeChecker))
			});
		} else if(ts.isEnumMember(node)) {
			const typeName = node.parent.name?.getText(sourceFile) ?? '';
			const enumName = dropGenericsFromTypeName(typeName);
			hierarchyList.push({
				name:       dropGenericsFromTypeName(node.name.getText(sourceFile)),
				node,
				kind:       'enum',
				extends:    [enumName],
				comments:   getTextualCommentsFromTypeScript(node),
				generics:   [],
				filePath:   sourceFile.fileName,
				lineNumber: getStartLineOfTypeScriptNode(node, sourceFile),
			});
		} else if(ts.isClassDeclaration(node)) {
			const className = node.name?.getText(sourceFile) ?? '';
			const baseTypes = node.heritageClauses?.flatMap(clause =>
				clause.types
					.map(type => type.getText(sourceFile) ?? '')
					.map(dropGenericsFromTypeName)
			) ?? [];
			const generics = node.typeParameters?.map(param => param.getText(sourceFile) ?? '') ?? [];

			hierarchyList.push({
				name:       dropGenericsFromTypeName(className),
				node,
				kind:       'class',
				extends:    baseTypes,
				comments:   getTextualCommentsFromTypeScript(node),
				generics,
				filePath:   sourceFile.fileName,
				lineNumber: getStartLineOfTypeScriptNode(node, sourceFile),
				properties: node.members
					.filter(member => member.name !== undefined)
					.map(member => formatNode(member, sourceFile, typeChecker)),
			});
		} else if(
			ts.isVariableDeclaration(node) || ts.isExportDeclaration(node) || ts.isExportAssignment(node) || ts.isDeclarationStatement(node)
		) {
			const name = node.name?.getText(sourceFile) ?? '';
			const comments = getTextualCommentsFromTypeScript(node);
			hierarchyList.push({
				name:       dropGenericsFromTypeName(name),
				node,
				kind:       'variable',
				extends:    [],
				comments,
				generics:   [],
				filePath:   sourceFile.fileName,
				lineNumber: getStartLineOfTypeScriptNode(node, sourceFile),
			});
		} else if(
			ts.isPropertyAssignment(node) || ts.isPropertyDeclaration(node) || ts.isPropertySignature(node)
			|| ts.isMethodDeclaration(node) || ts.isMethodSignature(node) || ts.isFunctionDeclaration(node) || ts.isGetAccessorDeclaration(node) || ts.isSetAccessorDeclaration(node)
		) {
			const name = node.name?.getText(sourceFile) ?? '';

			// get the name of the object/enclosing type
			let parent = node.parent;
			while(typeof parent === 'object' && parent !== undefined && !('name' in parent)) {
				parent = parent.parent;
			}
			if(typeof parent === 'object' && 'name' in parent) {
				const comments = getTextualCommentsFromTypeScript(node);
				hierarchyList.push({
					name:       dropGenericsFromTypeName(name),
					node,
					kind:       'variable',
					extends:    [parent.name?.getText(sourceFile) ?? ''],
					comments,
					generics:   [],
					filePath:   sourceFile.fileName,
					lineNumber: getStartLineOfTypeScriptNode(node, sourceFile),
				});
			}
		}

		ts.forEachChild(node, child => visit(child, sourceFile));
	};

	for(const sf of sourceFiles) {
		visit(sf, sf);
	}

	return hierarchyList;
}

interface MermaidCompact {
	nodeLines: string[]
	edgeLines: string[]
}


function getTypePathForTypeScript({ filePath }: Pick<TypeElementInSource, 'filePath' >) {
	return filePath.replace(/^.*\/src\//, 'src/').replace(/^.*\/test\//, 'test/');
}

/**
 * Return the link to the type in the source code.
 * If you create a wiki, please refer to the functions provided by the {@link GeneralWikiContext}.
 */
export function getTypePathLink(elem: Pick<TypeElementInSource, 'filePath' | 'lineNumber' >, prefix = RemoteFlowrFilePathBaseRef): string {
	const fromSource = getTypePathForTypeScript(elem);
	return `${prefix}/${fromSource}#L${elem.lineNumber}`;
}

function generateMermaidClassDiagram(hierarchyList: readonly TypeElementInSource[], rootName: string, options: { inlineTypes?: readonly string[] }, visited: Set<string> = new Set()): MermaidCompact {
	const collect: MermaidCompact = { nodeLines: [], edgeLines: [] };
	if(visited.has(rootName)) {
		return collect;
	} // Prevent circular references
	visited.add(rootName);

	const node = hierarchyList.find(h => h.name === rootName);
	if(!node) {
		return collect;
	}

	const genericPart = node.generics.length > 0 ? `~${node.generics.join(', ')}~` : '';

	collect.nodeLines.push(`class ${node.name}${genericPart}{`);
	collect.nodeLines.push(`    <<${node.kind}>>`);
	if(node.kind === 'type') {
		collect.nodeLines.push(`style ${node.name} opacity:.35,fill:#FAFAFA`);
	}
	const writtenProperties = new Set<string>();
	if(node.properties) {
		for(const property of node.properties) {
			collect.nodeLines.push(`    ${property}`);
			writtenProperties.add(property);
		}
	}
	collect.nodeLines.push('}');
	collect.nodeLines.push(`click ${node.name} href "${getTypePathLink(node)}" "${escapeMarkdown(node.comments?.join('; ').replace(/\n/g,' ') ?? '' )}"`);
	const inline = [...options.inlineTypes ?? [], ...defaultSkip];
	if(node.extends.length > 0) {
		for(const baseType of node.extends) {
			if(inline.includes(baseType)) {
				const info = hierarchyList.find(h => h.name === baseType);
				for(const property of info?.properties ?? []) {
					if(!writtenProperties.has(property)) {
						collect.nodeLines.push(`    ${node.name} : ${property} [from ${baseType}]`);
						writtenProperties.add(property);
					}
				}
			} else {
				if(node.kind === 'type' || hierarchyList.find(h => h.name === baseType)?.kind === 'type') {
					collect.edgeLines.push(`${dropGenericsFromTypeName(baseType)} .. ${node.name}`);
				} else {
					collect.edgeLines.push(`${dropGenericsFromTypeName(baseType)} <|-- ${node.name}`);
				}
				const { nodeLines, edgeLines } = generateMermaidClassDiagram(hierarchyList, baseType, options, visited);
				collect.nodeLines.push(...nodeLines);
				collect.edgeLines.push(...edgeLines);
			}
		}
	}
	return collect;
}

/**
 * Visualize the type hierarchy as a mermaid class diagram.
 */
export function visualizeMermaidClassDiagram(hierarchyList: readonly TypeElementInSource[], options: { typeNameForMermaid?: string, inlineTypes?: readonly string[] }): string | undefined {
	if(!options.typeNameForMermaid) {
		return undefined;
	}
	const { nodeLines, edgeLines } = generateMermaidClassDiagram(hierarchyList, options.typeNameForMermaid, options);
	return nodeLines.length === 0 && edgeLines.length === 0 ? '' : `
classDiagram
direction RL
${nodeLines.join('\n')}
${edgeLines.join('\n')}
`;
}

function getTypesFromFileAsMermaid(fileNames: string[], options: GetTypesAsMermaidOption): TypeReport {
	const { files, program } = getTypeScriptSourceFiles(fileNames);
	guard(files.length > 0, () => `No source files found for ${JSON.stringify(fileNames)}`);
	const withProgram = { ...options, program };
	const hierarchyList = collectHierarchyInformation(files, withProgram);
	return {
		mermaid: visualizeMermaidClassDiagram(hierarchyList, withProgram),
		info:    hierarchyList,
		program
	};
}

export interface GetTypesAsMermaidOption {
	readonly rootFolder?:         string | string[];
	readonly files?:              readonly string[];
	/** if you request a type name, we will generate a mermaid diagram for that type */
	readonly typeNameForMermaid?: string;
	readonly inlineTypes?:        readonly string[]
}

interface GetTypesWithProgramOption extends GetTypesAsMermaidOption {
	readonly program: ts.Program;
}

export interface TypeReport {
	/** if you request a type name this will include the mermaid diagram for the type */
	mermaid: string | undefined,
	info:    TypeElementInSource[],
	program: ts.Program
}

export function getTypesFromFolder(options: GetTypesAsMermaidOption & { typeNameForMermaid: string }): (TypeReport & { mermaid: string })
export function getTypesFromFolder(options: GetTypesAsMermaidOption & { typeNameForMermaid?: undefined }): (TypeReport & { mermaid: undefined })
export function getTypesFromFolder(options: GetTypesAsMermaidOption): TypeReport
/**
 * Inspect typescript source code for types and return a report.
 */
export function getTypesFromFolder(options: GetTypesAsMermaidOption): TypeReport {
	guard(options.rootFolder !== undefined || options.files !== undefined, 'Either rootFolder or files must be provided');
	let files = [...options.files ?? []];
	if(options.rootFolder) {
		const folders = Array.isArray(options.rootFolder) ? options.rootFolder : [options.rootFolder];
		for(const folder of folders) {
			files = files.concat(
				fs.readdirSync(folder, { recursive: true })
					.filter(f => {
						const p = f.toString();
						return p.endsWith('.ts')
							&& !p.endsWith('.test.ts')
							&& !p.endsWith('-app.ts')
							&& !p.endsWith('.d.ts');
					}
					)
					.map(f => path.join(folder, f.toString()))
			);
		}
	}
	return getTypesFromFileAsMermaid(files, options);
}


function implSnippet(node: TypeElementInSource | undefined, program: ts.Program, showName = true, nesting = 0, open = false, showImplSnippet = true): string {
	guard(node !== undefined, 'Node must be defined => invalid change of type name?');
	const indent = ' '.repeat(nesting * 2);
	const bold = node.kind === 'interface' || node.kind === 'enum' ? '**' : '';
	const sep = node.comments ? '  \n' : '\n';

	let text = node.comments?.join('\n') ?? '';
	if(text.trim() !== '') {
		text = '  ' + text;
	}
	if(showImplSnippet) {
		const code = node.node.getFullText(program.getSourceFile(node.node.getSourceFile().fileName));
		text += `\n<details${open ? ' open' : ''}><summary style="color:gray">Defined at <a href="${getTypePathLink(node)}">${getTypePathLink(node, '.')}</a></summary>\n\n${codeBlock('ts', code)}\n\n</details>\n`;
	} else {
		text += `\n<br/><i>(Defined at <a href="${getTypePathLink(node)}">${getTypePathLink(node, '.')}</a>)</i>\n`;
	}
	const init = showName ? `* ${bold}[${node.name}](${getTypePathLink(node)})${bold} ${sep}${indent}` : '';
	return ` ${indent}${showName ? init : ''} ${text.replaceAll('\t','    ').split(/\n/g).join(`\n${indent}   `)}`;
}

export interface PrintHierarchyArguments {
	readonly program:              ts.Program
	readonly info:                 TypeElementInSource[]
	readonly root:                 string
	readonly collapseFromNesting?: number
	readonly initialNesting?:      number
	readonly maxDepth?:            number
	readonly openTop?:             boolean
	readonly showImplSnippet?:     boolean
}

export const mermaidHide = ['Leaf', 'Location', 'Namespace', 'Base', 'WithChildren', 'Partial', 'RAccessBase'];

/**
 * Print the hierarchy of types starting from the given root.
 * If you create a wiki, please refer to the functions provided by the {@link GeneralWikiContext}.
 */
export function printHierarchy({ program, info, root, collapseFromNesting = 1, initialNesting = 0, maxDepth = 20, openTop, showImplSnippet = true }: PrintHierarchyArguments): string {
	if(initialNesting > maxDepth) {
		return '';
	}
	const node = info.find(e => e.name === root);
	if(!node) {
		return '';
	}

	const thisLine = implSnippet(node, program, true, initialNesting, initialNesting === 0 && openTop, showImplSnippet);
	const result = [];

	for(const baseType of node.extends) {
		if(mermaidHide.includes(baseType)) {
			continue;
		}
		const res = printHierarchy({ program, info: info, root: baseType, collapseFromNesting, initialNesting: initialNesting + 1, maxDepth, showImplSnippet });
		result.push(res);
	}

	const out = result.join('\n');
	if(initialNesting === collapseFromNesting - 1) {
		return thisLine + (out ? details(`View more (${node.extends.join(', ')})`, out, { prefixInit: ' '.repeat(2 * (collapseFromNesting + 1)) }) : '');
	} else {
		return thisLine + (out ? '\n' + out : '');
	}
}

/**
 * Options to print code of an element
 */
export interface FnElementInfo {
	/** The type information collected from the source code */
	info:             TypeElementInSource[],
	/** The TypeScript program used to extract the info */
	program:          ts.Program,
	/** Number of lines to drop from the start of the code block */
	dropLinesStart?:  number,
	/** Number of lines to drop from the end of the code block */
	dropLinesEnd?:    number,
	/** Whether to not automatically gobble leading spaces */
	doNotAutoGobble?: boolean,
	/** Whether to hide the "Defined at ..." line */
	hideDefinedAt?:   boolean
}

/**
 * Print an element from the info as code block.
 * If you create a wiki, please refer to the functions provided by the {@link GeneralWikiContext}.
 *
 * This is great to show examples that are directly taken from the source code.
 */
export function printCodeOfElement({ program, info, dropLinesEnd = 0, dropLinesStart = 0, doNotAutoGobble, hideDefinedAt }: FnElementInfo, name: string): string {
	const node = info.find(e => e.name === name);
	if(!node) {
		console.error(`Could not find node ${name} when resolving function!`);
		return '';
	}
	let code = node.node.getFullText(program.getSourceFile(node.node.getSourceFile().fileName)).trim();
	if(dropLinesStart > 0 || dropLinesEnd > 0) {
		const lines = code.split(/\n/g);
		if(dropLinesStart + dropLinesEnd >= lines.length) {
			return '';
		}
		code = lines.slice(dropLinesStart, lines.length - dropLinesEnd).join('\n');
	}
	if(!doNotAutoGobble) {
		// gobble leading spaces
		const lines = code.replaceAll('\t', '    ').split(/\n/g);
		let gobble = Number.POSITIVE_INFINITY;
		for(const line of lines) {
			const match = line.match(/^(\s*)\S+/);
			if(match) {
				gobble = Math.min(gobble, match[1].length);
			}
		}
		if(gobble !== Number.POSITIVE_INFINITY && gobble > 0) {
			code = lines.map(line => line.startsWith(' '.repeat(gobble)) ? line.slice(gobble) : line).join('\n');
		}
	}
	if(hideDefinedAt) {
		return codeBlock('ts', code);
	} else {
		return `${codeBlock('ts', code)}\n<i>Defined at <a href="${getTypePathLink(node)}">${getTypePathLink(node, '.')}</a></i>\n`;
	}
}

function fuzzyCompare(a: string, b: string): boolean {
	const aStr = a.toLowerCase().replace(/[^a-z0-9]/g, '-').trim();
	const bStr = b.toLowerCase().replace(/[^a-z0-9]/g, '-').trim();
	return aStr === bStr || aStr.includes(bStr) || bStr.includes(aStr);
}

function retrieveNode(name: string, hierarchy: readonly TypeElementInSource[], fuzzy = false, type: TypeElementKind | undefined = undefined): [string | undefined, string, TypeElementInSource]| undefined {
	let container: string | undefined = undefined;
	if(name.includes('::')) {
		[container, name] = name.split(/:::?/);
	}
	let node = hierarchy.filter(e =>  fuzzy ? fuzzyCompare(e.name, name) : e.name === name);
	if(node.length === 0) {
		return undefined;
	} else if(container) {
		node = node.filter(n => fuzzy ? n.extends.some(n => fuzzyCompare(n, container)) : n.extends.includes(container));
		if(node.length === 0) {
			return undefined;
		}
	}
	if(type) {
		node = node.filter(n => n.kind === type);
		if(node.length === 0) {
			return undefined;
		}
	}
	return [container, name, node[0]];
}

/**
 * Create a short link to a type in the documentation.
 * If you create a wiki, please refer to the functions provided by the {@link GeneralDocContext}.
 * @param name      - The name of the type, e.g. `MyType`, may include a container, e.g.,`MyContainer::MyType` (this works with function nestings too)
 *                    Use `:::` if you want to access a scoped function, but the name should be displayed without the scope
 * @param hierarchy - The hierarchy of types to search in
 * @param codeStyle - Whether to use code style for the link
 * @param realNameWrapper - How to highlight the function in name in the `x::y` format?
 */
export function shortLink(name: string, hierarchy: readonly TypeElementInSource[], codeStyle = true, realNameWrapper = 'b'): string {
	const res = retrieveNode(name, hierarchy);
	if(!res) {
		console.error(`Could not find node ${name} when resolving short link!`);
		return '';
	}
	const [, mainName, node] = res;
	let pkg = res[0];
	if(name.includes(':::')) {
		pkg = undefined;
	}
	const comments = node.comments?.join('\n').replace(/\\?\n|```[a-zA-Z]*|\s\s*/g, ' ').replace(/<\/?code>|`/g, '').replace(/<\/?p\/?>/g, ' ').replace(/"/g, '\'') ?? '';
	return `<a href="${getTypePathLink(node)}">${codeStyle ? '<code>' : ''}${
		(node.comments?.length ?? 0) > 0 ?
			textWithTooltip(pkg ? `${pkg}::<${realNameWrapper}>${mainName}</${realNameWrapper}>` : mainName, comments.length > 400 ? comments.slice(0, 400) + '...' : comments) :
			pkg ? `${pkg}::<${realNameWrapper}>${mainName}</${realNameWrapper}>` : mainName
	}${codeStyle ? '</code>' : ''}</a>`;
}


/**
 * Create a short link to a type in the documentation.
 * If you create a wiki, please refer to the functions provided by the {@link GeneralWikiContext}.
 * @param name      - The name of the type, e.g. `MyType`, may include a container, e.g.,`MyContainer::MyType` (this works with function nestings too)
 *                    Use `:::` if you want to access a scoped function, but the name should be displayed without the scope
 * @param hierarchy - The hierarchy of types to search in
 */
export function shortLinkFile(name: string, hierarchy: readonly TypeElementInSource[]): string {
	const res = retrieveNode(name, hierarchy);
	if(!res) {
		console.error(`Could not find node ${name} when resolving short link!`);
		return '';
	}
	const [,, node] = res;
	return `<a href="${getTypePathLink(node)}">${getTypePathForTypeScript(node)}</a>`;
}

export interface GetDocumentationForTypeFilters {
    fuzzy?: boolean;
    type?:  TypeElementKind;
}


/**
 * Retrieve documentation comments for a type.
 * If you create a wiki, please refer to the functions provided by the {@link GeneralWikiContext}.
 * @param name      - The name of the type, e.g. `MyType`, may include a container, e.g.,`MyContainer::MyType` (this works with function nestings too)
 *                    Use `:::` if you want to access a scoped function, but the name should be displayed without the scope
 * @param hierarchy - The hierarchy of types to search in
 * @param prefix    - A prefix to add to each line of the documentation
 * @param filter    - Optional filters for retrieving the documentation
 */
export function getDocumentationForType(name: string, hierarchy: TypeElementInSource[], prefix = '', filter?: GetDocumentationForTypeFilters): string {
	const res = retrieveNode(name, hierarchy, filter?.fuzzy, filter?.type);
	if(!res) {
		return '';
	}
	const [, , node] = res;
	return prefixLines(node.comments?.join('\n') ?? '', prefix);
}
