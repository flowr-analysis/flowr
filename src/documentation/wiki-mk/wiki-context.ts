import type {
	FnElementInfo,
	PrintHierarchyArguments,
	TypeElementKind
} from '../doc-util/doc-types';
import { mermaidHide
	,
	visualizeMermaidClassDiagram
	, printCodeOfElement , printHierarchy , shortLinkFile , shortLink , getDocumentationForType , getTypesFromFolder } from '../doc-util/doc-types';
import path from 'path';
import { guard } from '../../util/assert';
import { autoGenHeader } from '../doc-util/doc-auto-gen';
import type { RShell } from '../../r-bridge/shell';

/**
 * Context available when generating documentation for a wiki in markdown format
 */
export interface ElementFilter {
	/** In case names collide, you can use this to further distinguish between them */
	readonly file?:  RegExp;
	/** In case names collide, you can use this to further distinguish between them, by specifying the kind you search for */
	readonly type?:  TypeElementKind;
	/** Whether to use fuzzy matching for the element name */
	readonly fuzzy?: boolean;
}

/**
 * Formatting options for links to code elements
 */
export interface LinkFormat {
	/**
	 * Whether to use md code font for the link text
	 */
	codeFont?:        boolean;
	/**
	 * Wrapper for the real name (if specified), e.g., to italicize or bold it
	 */
	realNameWrapper?: 'i' | 'b';
}

export type ElementId = string;

export type ElementIdOrRef = ElementId | { name: string } | (new () => unknown);

function getNameFromElementIdOrRef(element: ElementIdOrRef): string {
	if(typeof element === 'function') {
		return element.name;
	} else if(typeof element === 'object' && 'name' in element) {
		return element.name;
	} else {
		return element;
	}
}

/**
 * Provides methods to generate links, code snippets, and documentation for code elements.
 * These wrap around a collection of useful helpers originating from the doc utils.
 * To create an instance, use {@link makeContextForTypes} (although if you are writing a wiki, you get such an instance).
 */
export interface GeneralDocContext {
	/**
	 * Generate a hyperlink to a code element in the wiki
	 * @param element - The element to create a link for, the name can be qualified with `::` to specify the class.
	 *                  This causes the link to be usually printed as `ClassName::ElementName`. If you want to avoid showing
	 *                  the class name, use `:::` as separator. Please note that for elements with a sensible (`.name`),
	 *                  you can also pass the function/constructor reference directly (e.g., `link(MyClass)`).
	 * @param fmt     - Formatting options for the link (see {@link LinkFormat})
	 * @param filter  - An optional filter to further specify the element to link to, in case multiple elements with the same name exist.
	 * @example
	 * ```ts
	 * link(registerPluginMaker.name)
	 * ```
	 *
	 * Creates a (markdown) link to the `registerPluginMaker` function in the code base
	 * and, if available, attaches the TS documentation as tooltip.
	 * By using the `.name`, the link text will be `registerPluginMaker` but respect, e.g., renaming refactorings done in the code base.
	 * @see {@link linkFile}  - to create a link using the file path as name.
	 * @see {@link shortLink} - for the underlying impl.
	 * @see {@link dropGenericsFromTypeName} - to clean up type names for display.
	 */
	link(element: ElementIdOrRef, fmt?: LinkFormat, filter?: ElementFilter): string;

	/**
	 * Generate a hyperlink to a type/element definition in the code base which is displayed using the file path as name
	 * @param element - The element to create a link for, the name can be qualified with `::` to specify the class.
	 * @example
	 * ```ts
	 * linkFile(registerPluginMaker.name)
	 * ```
	 * Creates a (markdown) link to the `registerPluginMaker` function in the code base
	 * using the file path as link name.
	 * @see {@link GeneralWikiContext#link|link} - to create a link with a custom name/using the type name by default.
	 * @see {@link linkFile}  - for the underlying impl.
	 */
	linkFile(element: ElementIdOrRef): string;

	/**
	 * Returns the documentation for a code element as markdown string.
	 * If you want to, e.g., prefix all of these lines with indentation or `> ` for blockquotes,
	 * use {@link prefixLines}.
	 * @param element - The element to create documentation for, the name can be qualified with `::` to specify the class.
	 * @param filter  - An optional filter to further specify the element to get the documentation for, in case multiple elements with the same name exist.
	 * @example
	 * ```ts
	 * doc(exampleFn.name)
	 * ```
	 *
	 * Creates the documentation for the `exampleFn` function in the code base as markdown string.
	 * @see {@link getDocumentationForType} - for the underlying impl.
	 * @see {@link removeCommentSymbolsFromTypeScriptComment} - to clean up TS doc comments.
	 */
	doc(element: ElementIdOrRef, filter?: Omit<ElementFilter, 'file'>): string;

	/**
	 * Returns the code snippet for a code element as markdown string.
	 * @param element - The element to create a code snippet for, the name can be qualified with `::` to specify the class.
	 * @param fmt     - Formatting options for the code snippet (see {@link FnElementInfo})
	 * @param filter  - An optional filter to further specify the element to get the code for, in case multiple elements with the same name exist.
	 * @example
	 * ```ts
	 * code(exampleFn.name, { dropLinesStart: 1, dropLinesEnd: 2  })
	 * ```
	 *
	 * Creates a code snippet for the `exampleFn` function in the code base,
	 * dropping the first and last two lines of the function definition.
	 * If, for example, the function looks like this:
	 *
	 * ```ts
	 * function exampleFn(a: number, b: number): number {
	 *    // This is an example
	 *     const result = a + b;
	 *     return result;
	 * }
	 * ```
	 *
	 * The resulting code snippet will be (auto-gobbled by default):
	 *
	 * ```ts
	 * // This is an example
	 * const result = a + b;
	 * ```
	 * @see {@link printCodeOfElement} - for the underlying impl.
	 */
	code(element: ElementIdOrRef, fmt?: Omit<FnElementInfo, 'info' | 'program'>, filter?: ElementFilter): string;

	/**
	 * Returns the hierarchy (e.g., class inheritance) for a code element as markdown string,
	 * including their documentation and snippets.
	 * @param element - The element to create a hierarchy for, the name can be qualified with `::` to specify the class.
	 * @param fmt     - Formatting options for the hierarchy (see {@link PrintHierarchyArguments})
	 * @param filter  - An optional filter to further specify the element to get the hierarchy for, in case multiple elements with the same name exist.
	 * @example
	 * ```ts
	 * hierarchy(MyClass.name, { maxDepth: 2 })
	 * ```
	 *
	 * Creates the hierarchy for the `MyClass` class in the code base,
	 * including up to two levels of inheritance.
	 * @see {@link printHierarchy} - for the underlying impl.
	 */
	hierarchy(element: ElementIdOrRef, fmt?: Omit<PrintHierarchyArguments, 'info' | 'program' | 'root'>, filter?: ElementFilter): string;
	/**
	 * Generates an auto-generation header for the wiki page.
	 * @param filename - The name of the file being generated. Probably use `module.filename`.
	 * @param purpose - The purpose of the file, e.g., 'wiki context for types'.
	 */
	header(filename: string, purpose: string): Promise<string>;

	/**
	 * Generates a mermaid diagram for the given code element, returned as markdown string.
	 * @param element - The element to create a mermaid diagram for, the name can be qualified with `::` to specify the class.
	 * @param inlineTypes - Optional list of type names to inline in the mermaid diagram (instead of linking them out).
	 */
	mermaid(element: ElementIdOrRef, inlineTypes?: string[]): string;
	// TODO: add repl functions getReplCommand etc.
	// TODO: add constants for where what is (like FlowrWikiBaseRef)
}

/**
 * Creates a wiki context for generating documentation for code elements.
 * This context provides methods to create links, code snippets, and documentation for code elements.
 * @param shell       - An optional RShell instance to retrieve the R version for the auto-generation header.
 * @param rootFolders - The root folder(s) of the code base to analyze. Defaults to flower's `src/` **and** `test/` folder.
 * @example
 * ```ts
 * const ctx = makeContextForTypes();
 * const linkToFn = ctx.link('myFunction');
 * const fnDoc = ctx.doc('myFunction');
 * ```
 */
export function makeContextForTypes(
	shell?: RShell,
	...rootFolders: string[]
): GeneralDocContext {
	if(rootFolders.length === 0) {
		rootFolders.push(path.resolve(__dirname, '../../../src'));
		rootFolders.push(path.resolve(__dirname, '../../../test'));
	}
	const { info, program } = getTypesFromFolder({ rootFolder: rootFolders, typeNameForMermaid: undefined });
	return {
		doc(element: ElementIdOrRef, filter?: Omit<ElementFilter, 'file'>): string {
			return getDocumentationForType(getNameFromElementIdOrRef(element), info, '', filter);
		},
		link(element: ElementIdOrRef, fmt?: LinkFormat, filter?: ElementFilter): string {
			guard(filter === undefined, 'ElementFilter is not yet supported for link');
			return shortLink(getNameFromElementIdOrRef(element), info, fmt?.codeFont, fmt?.realNameWrapper);
		},
		linkFile(element: ElementIdOrRef): string {
			return shortLinkFile(getNameFromElementIdOrRef(element), info);
		},
		hierarchy(element: ElementIdOrRef, fmt?: Omit<PrintHierarchyArguments, 'info' | 'program' | 'root'>, filter?: ElementFilter): string {
			guard(filter === undefined, 'ElementFilter is not yet supported for hierarchy');
			return printHierarchy({
				program, info,
				root: getNameFromElementIdOrRef(element),
				...fmt
			});
		},
		code(element: ElementIdOrRef, fmt?: Omit<FnElementInfo, 'info' | 'program'>, filter?: ElementFilter): string {
			guard(filter === undefined, 'ElementFilter is not yet supported for code');
			return printCodeOfElement({
				program, info,
				...fmt,
			}, getNameFromElementIdOrRef(element));
		},
		async header(filename: string, purpose: string): Promise<string> {
			const rVersion = (await shell?.usedRVersion())?.format();
			return autoGenHeader({ filename, purpose, rVersion });
		},
		mermaid(element: ElementIdOrRef, inlineTypes: string[] = mermaidHide): string {
			return visualizeMermaidClassDiagram(info, {
				typeNameForMermaid: getNameFromElementIdOrRef(element),
				inlineTypes
			}) as string;
		}
	};
}