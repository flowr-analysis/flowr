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
import type { ValidWikiDocumentTargetsNoSuffix } from '../../cli/wiki';
import type { PathLike } from 'fs';
import { FlowrGithubRef } from '../doc-util/doc-files';
import type { scripts } from '../../cli/common/scripts-info';
import type { ScriptOptions } from '../doc-util/doc-cli-option';
import { getReplCommand , getCliLongOptionOf } from '../doc-util/doc-cli-option';
import type { ReplCommandNames } from '../../cli/repl/commands/repl-commands';

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

type NamedPrototype = { prototype: { constructor: { name: string } } };
type ProtoKeys<T> = T extends { prototype: infer P } ? keyof P : never;
type StaticKeys<T> = T extends { prototype: infer P } ? Exclude<keyof T, keyof P> : never;

/**
 * Provides methods to generate links, code snippets, and documentation for code elements.
 * These wrap around a collection of useful helpers originating from the doc utils.
 * To create an instance, use {@link makeDocContextForTypes} (although if you are writing a wiki, you get such an instance).
 */
export interface GeneralDocContext {
	/**
	 * Generate a hyperlink to a code element in the wiki.
	 * If you want to reference the member of a class, use `ClassName::MemberName` as element name.
	 * For ease of use, you can also call {@link GeneralDocContext#linkM|linkM} to create a link to a member.
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
	 * Generate a hyperlink to a member of a class in the wiki.
	 * This is a convenience method around {@link GeneralDocContext#link|link}.
	 * @example
	 * ```ts
	 * linkM(MyClass, 'myMethod')
	 * ```
	 *
	 * Creates a (markdown) link to the `myMethod` member of the `MyClass` class in the code base.
	 * @see {@link GeneralWikiContext#link|link} - for the underlying impl.
	 */
	linkM<T extends NamedPrototype>(cls: T, element: ProtoKeys<T> | StaticKeys<T>, fmt?: LinkFormat & { hideClass?: boolean }, filter?: ElementFilter): string;

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

	/**
	 * Generates a wiki link to another wiki or general docs page.
	 * @example
	 * ```ts
	 * linkWikiPage('wiki/Setup')
	 * ```
	 * Creates a link to the `wiki/Setup` wiki page with the link text `Setup`.
	 * @param pageName - The name of the wiki page to link to.
	 * @param linkText - Optional text to display for the link. If not provided, the page name will be used.
	 */
	linkPage(pageName: ValidWikiDocumentTargetsNoSuffix, linkText?: string): string;

	/**
	 * Generates a link to a code file in the code base.
	 * @param path       - The path to the code file.
	 * @param lineNumber - An optional line number to link to within the file.
	 */
	linkCode(path: PathLike, lineNumber?: number): string;

	/**
	 * Generates the CLI long option for a given script and option name.
	 * @example
	 * ```ts
	 * cliOption('flowr', 'help')
	 * ```
	 * Returns `--help` with the accompanying docs.
	 * @param scriptName - The name of the script (e.g., 'flowr', 'analyze', etc.)
	 * @param optionName - The name of the option for which to generate the long option string.
	 * @param withAlias  - Whether to include the alias in the output. Default is `false`.
	 * @param quote      - Whether to wrap the option in backticks. Default is `true`.
	 * @see {@link ScriptOptions} - for the valid option names per script.
	 * @see {@link getCliLongOptionOf} - for the underlying impl.
	 */
	cliOption<
		ScriptName extends keyof typeof scripts | 'flowr',
		OptionName extends ScriptOptions<ScriptName>
	>(scriptName: ScriptName, optionName: OptionName, withAlias?: boolean, quote?: boolean): string

	/**
	 * Generates the REPL command string for a given command name.
	 * @example
	 * ```ts
	 * replCmd('help')
	 * ```
	 * Returns `:help` with the accompanying docs.
	 * @param commandName - The name of the REPL command.
	 * @param quote - Whether to wrap the command in backticks. Default is `true`.
	 * @param showStar - Whether to show a `[*]` suffix for starred commands. Default is `false`.
	 * @see {@link getReplCommand} - for the underlying impl.
	 */
	replCmd(commandName: ReplCommandNames, quote?: boolean, showStar?: boolean): string
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
export function makeDocContextForTypes(
	shell?: RShell,
	...rootFolders: string[]
): GeneralDocContext {
	if(rootFolders.length === 0) {
		rootFolders.push(path.resolve(__dirname, '../../../src'));
		rootFolders.push(path.resolve(__dirname, '../../../test/functionality'));
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
		linkM<T extends NamedPrototype>(cls: T, element: ProtoKeys<T> | StaticKeys<T>, fmt?: LinkFormat & { hideClass?: boolean }, filter?: ElementFilter): string {
			const className = cls.prototype.constructor.name;
			const sep = (fmt?.hideClass) ? ':::' : '::';
			const fullName = `${className}${sep}${String(element)}`;
			return this.link(fullName, fmt, filter);
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
		},
		linkPage(pageName: ValidWikiDocumentTargetsNoSuffix, linkText?: string): string {
			const text = linkText ?? pageName.split('/').pop() ?? pageName;
			const link = pageName.toLowerCase().replace(/ /g, '-');
			return `[${text}](${FlowrGithubRef}/${link})`;
		},
		linkCode(path: PathLike, lineNumber?: number): string {
			const lnk = lineNumber ? `${path.toString()}#L${lineNumber}` : path.toString();
			return `[${path.toString()}](${encodeURIComponent(lnk)})`;
		},
		cliOption<
			ScriptName extends keyof typeof scripts | 'flowr',
			OptionName extends ScriptOptions<ScriptName>
		>(scriptName: ScriptName, optionName: OptionName, withAlias = false, quote = true): string {
			return getCliLongOptionOf(scriptName, optionName, withAlias, quote);
		},
		replCmd(commandName: ReplCommandNames | string, quote = true, showStar = false): string {
			return getReplCommand(commandName, quote, showStar);
		}
	};
}