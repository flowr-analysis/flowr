import { prettyPrint, LintingResultCertainty, type LintingRule, LintingRuleCertainty } from '../../linter-format';
import type { MergeableRecord } from '../../../util/objects';
import { Q } from '../../../search/flowr-search-builder';
import { LintingRuleTag } from '../../linter-tags';
import { SourceLocation } from '../../../util/range';
import { RFunctionCall } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { RArgument } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { RSymbol } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import { RString } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-string';
import { RBinaryOp } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-binary-op';
import { uniqueArrayMerge } from '../../../util/collections/arrays';
import { Identifier } from '../../../dataflow/environments/identifier';
import { baseRExportOwner, isBaseRPackage } from '../../../util/r-base-packages';
import type { ReadonlyFlowrAnalysisProvider } from '../../../project/flowr-analyzer';
import type { ReadOnlyFlowrAnalyzerContext } from '../../../project/context/flowr-analyzer-context';
import { type RdMacroUse, type RdNode, type RdScan, parseRdMacros, scanRd } from '../../../project/plugins/file-plugins/files/flowr-rd-file';
import type { packageInfo } from './cmd-check-util';
import { DependencyFields, projectNodes } from './cmd-check-util';
import type { PackageFiles } from './package-files';
import { rdExamples } from './package-code';
import { type FileResult, fileFindings, onPackageFiles } from './file-checks';

/** what is wrong with an Rd page or the manual, named after the part of `R CMD check` that finds it */
export type RdFilesKind = 'rd-syntax' | 'rd-unknown-macro' | 'rd-structure' | 'rd-empty-section' | 'rd-encoding' | 'rd-markup' | 'rd-lost-braces'
	| 'rd-duplicate-name' | 'rd-duplicate-alias' | 'rd-missing-alias' | 'rd-package-alias' | 'rd-name-case' | 'rd-missing-link' | 'rd-undeclared-package'
	| 'rd-line-width' | 'rd-missing-description' | 'rd-undocumented-argument' | 'rd-boilerplate' | 'rd-missing-value' | 'rd-keyword' | 'rd-s3-method-name'
	| 'rd-bibentry' | 'rd-example-syntax' | 'rd-example-abbreviation' | 'rd-example-quit' | 'rd-example-setwd' | 'rd-example-file';

export type RdFilesResult = FileResult<RdFilesKind>;

export interface RdFilesConfig extends MergeableRecord {
	/** report what the Rd parser of R reports: syntax errors, unknown macros, and unexpected sections */
	readonly parse:            boolean
	/** drop parser diagnostics below this `checkRd` level, the messages of `prepare_Rd` are always kept */
	readonly minLevel:         number
	/** report duplicate names and aliases, names that differ only by case, and pages without any alias */
	readonly metadata:         boolean
	/** report links to topics no page or package provides */
	readonly crossReferences:  boolean
	/** also report links whose target flowR cannot decide */
	readonly uncertainLinks:   boolean
	/** report lines in `\usage` and `\examples` wider than {@link RdFilesConfig#usageWidth} and {@link RdFilesConfig#examplesWidth} */
	readonly lineWidths:       boolean
	/** the widest line a `\usage` section may have */
	readonly usageWidth:       number
	/** the widest line an `\examples` section may have */
	readonly examplesWidth:    number
	/** report missing descriptions and values, argument items without text, and generated boilerplate */
	readonly contents:         boolean
	/** report functions documented without a `\value` section */
	readonly requireValue:     boolean
	/** report keywords that are neither standard nor in {@link RdFilesConfig#keywords} */
	readonly standardKeywords: boolean
	/** the keywords besides the standard ones a page may use */
	readonly keywords:         readonly string[]
	/** report S3 methods a `\usage` calls by their full name instead of with `\method` */
	readonly docStyle:         boolean
	/** report bibentries a page cites but does not show */
	readonly bibentries:       boolean
	/** parse the examples and report their syntax errors, undefined calls, `T` and `F`, `q()`, and the files they write */
	readonly examples:         boolean
	/** Rd macro files to load besides those of the package */
	readonly extraMacros:      readonly string[]
}

export interface RdFilesMetadata extends MergeableRecord {
	readonly checkedFiles: number
}

/** A map from each of the space-separated names of the keys to the value. */
const table = <V>(spec: Readonly<Record<string, V>>): ReadonlyMap<string, V> => new Map(Object.entries(spec).flatMap(([names, v]) => names.split(' ').map(n => [n, v] as const)));
const words = (names: string): ReadonlySet<string> => new Set(names.split(' '));

/** the standard keywords of R (`KEYWORDS.db`) */
const StandardKeywords = ('algebra aplot arith array attribute Basics category character chron classes classif cluster color complex connection data database datagen '
	+ 'datasets debugging design device distribution documentation dplot dynamic environment error file Graphics graphs hplot htest interface internal IO iplot iteration '
	+ 'list loess logic manip MASS math Mathematics methods misc models multivariate NA neural nonlinear nonparametric optimize package print programming Programming '
	+ 'regression robust smooth spatial Statistics survey survival symbolmath sysdata tree ts univar utilities').split(' ');
/** the URL schemes registered with IANA that Rd pages commonly use */
const UrlSchemes = words('http https ftp ftps sftp mailto file git ssh svn rsync irc news nntp telnet tel sms data urn doi javascript ldap gopher imap geo magnet xmpp sip webcal ws wss about');
/** R's system macros (`share/Rd/macros/system.Rd`) */
const SystemMacros = 'CRANpkg PR sspace packageTitle packageDescription packageAuthor packageMaintainer packageDESCRIPTION packageIndices doi LaTeX proglang I manual bibcitep bibcitet bibshow bibinfo';
/** the argument modes of the Rd and system macros, see {@link scanRd} */
const Macros: ReadonlyMap<string, string> = new Map(Object.entries({
	t:   'title concept description arguments value details note author references seealso format source link linkS4class linkS4methods file env pkg var command option emph strong bold cite acronym abbr dfn sQuote dQuote itemize enumerate describe CRANpkg PR packageTitle packageDescription packageAuthor packageMaintainer packageDESCRIPTION packageIndices doi proglang I bibcitep bibcitet bibshow',
	v:   'name alias keyword encoding docType Rdversion RdOpts preformatted verb samp kbd email url out dontrun',
	r:   'usage examples code special Sexpr donttest dontshow testonly dontdiff',
	tt:  'section subsection enc if tabular manual',
	'':  'cr tab dots ldots R sspace LaTeX',
	vt:  'href',
	vv:  'method S3method S4method newcommand renewcommand',
	vV:  'eqn deqn figure',
	ttt: 'ifelse bibinfo'
}).flatMap(([modes, names]) => names.split(' ').map(n => [n, modes] as const)));
const ItemModes = table({ 'arguments value describe': 'tt', 'itemize enumerate': '' });

/** the sections `prepare_Rd` knows, and the macros that may stand next to them */
const SectionNames = words('title name alias concept keyword encoding description usage arguments format details value section note author source references seealso examples');
const ExtraSections = words('docType Rdversion RdOpts newcommand renewcommand Sexpr');
const UniqueSections = 'description usage arguments format details value references source seealso examples author encoding'.split(' ');
const DocTypes = words('data package methods class import');
const IfFormats = words('latex example text html TRUE FALSE');
const PlainContent = 'describe enumerate itemize bold cite command dfn emph kbd Sexpr special strong var verb abbr acronym env file option pkg samp sQuote dQuote';
const ExampleWrappers = 'dontrun donttest dontdiff dontshow testonly';
const LinkMacros = 'link linkS4class linkS4methods';
const LinkSuffix: Readonly<Record<string, string>> = { linkS4class: '-class', linkS4methods: '-methods' };
const NameRules = [
	{ test: /[!|@]/, level: 5, text: '\\name should not contain !, | or @' },
	{ test: /[^\x20-\x7e]/, level: -1, text: '\\name should only contain printable ASCII characters' }
] as const;
const EmailPattern = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)*$/;
const Always = Number.POSITIVE_INFINITY;

type RdText = Extract<RdNode, { type: 'text' }>;
type RdGroup = Extract<RdNode, { type: 'group' }>;
/** a finding inside a page, with the `checkRd` level: below the configured minimum it is dropped, `prepare_Rd` messages are always kept */
type Diag = { readonly line: number, readonly level: number, readonly kind: RdFilesKind, readonly text: string };
type RdLink = { readonly line: number, readonly topic: string, readonly pkg: string | undefined, readonly shown: string };
type PageSettings = { readonly defEnc: boolean, readonly macros: ReadonlyMap<string, number>, readonly lenient: boolean };
type Handler = (m: RdMacroUse, tag: string) => void;

const arg = (m: RdMacroUse, i: number): readonly RdNode[] => m.args[i] ?? [];
const isMacro = (n: RdNode): n is RdMacroUse => n.type === 'macro';
const sectionsOf = (nodes: readonly RdNode[], name: string) => nodes.filter((n): n is RdMacroUse => isMacro(n) && n.name === name);
/** the raw text of the text nodes, macros skipped */
const plain = (nodes: readonly RdNode[]): string => nodes.map(n => n.type === 'text' ? n.text : n.type === 'group' ? plain(n.children) : '').join('');
/** the source form of a node list, as `.Rd_deparse` gives it */
const deparse = (nodes: readonly RdNode[]): string => nodes.map(n => n.type === 'text' ? n.text : n.type === 'group' ? `{${deparse(n.children)}}` : `\\${n.name}${n.args.map(a => `{${deparse(a)}}`).join('')}`).join('');
/** whether the nodes hold no text at all, as `prepare_Rd` decides what an empty section is */
const isBlank = (nodes: readonly RdNode[]): boolean => nodes.every(n => n.type === 'text' ? !/\S/.test(n.text) : n.type === 'group' ? isBlank(n.children) : Macros.has(n.name) && n.args.every(isBlank));
const unescape = (s: string) => s.replace(/\\([\\%{}])/g, '$1');

/** The checks of `tools::checkRd` and the structure checks of `prepare_Rd`, run on one scanned page. */
class RdChecker {
	public readonly diags: Diag[] = [];
	public readonly links: RdLink[] = [];
	private hasText = false;
	private inEnc2 = false;
	private defEnc:        boolean;

	constructor(private readonly scan: RdScan, private readonly settings: PageSettings) {
		this.defEnc = settings.defEnc;
	}

	private warn(at: number, level: number, kind: RdFilesKind, text: string): void {
		this.diags.push({ line: this.scan.lineOf(at), level, kind, text });
	}

	private known(name: string): boolean {
		return this.settings.macros.has(name) || this.settings.lenient;
	}

	private readonly contentOf: Handler = (m, tag) => m.args.forEach(a => this.content(a, m.name, tag));
	private readonly withText = (h: Handler): Handler => (m, tag) => {
		h(m, tag);
		this.hasText = true;
	};
	private readonly inline = this.withText(this.contentOf);

	/** what a macro in text does: `early` before the macros the package defines, `late` after them */
	private readonly blocks = {
		early: table<Handler>({
			[PlainContent]:                   this.contentOf,
			'code preformatted':              m => this.code(arg(m, 0), m.name),
			[LinkMacros]:                     m => this.link(m),
			email:                            this.withText(m => [unescape(plain(arg(m, 0))).trim()].filter(a => a !== '' && !EmailPattern.test(a)).forEach(a => this.warn(m.at, 7, 'rd-markup', `Invalid email address: ${a}`))),
			url:                              this.withText(m => this.url(m)),
			'cr newcommand renewcommand out': () => undefined
		}),
		known: words('dots ldots R'),
		late:  table<Handler>({
			'method S3method S4method': m => this.warn(m.at, 7, 'rd-markup', `Tag \\${m.name} not valid outside a code block`),
			enc:                        (m, tag) => {
				this.content(arg(m, 0), 'enc', tag);
				const saved = this.defEnc;
				[this.defEnc, this.inEnc2] = [false, true];
				this.content(arg(m, 1), 'enc', tag);
				[this.defEnc, this.inEnc2] = [saved, false];
			},
			'eqn deqn figure': (m, tag) => {
				this.contentOf(m, tag);
				const options = plain(arg(m, 1));
				if(options.startsWith('options: ') && /(height|width) *= *['"]?[0-9]+%/.test(options)) {
					this.warn(m.at, -1, 'rd-markup', 'height/width attributes should be in pixels');
				}
			},
			tabular:     m => this.tabular(m),
			subsection:  this.withText(m => this.section(m, false)),
			'if ifelse': (m, tag) => {
				const formats = plain(arg(m, 0)).split(',').map(s => s.trim()).filter(f => f !== '' && !IfFormats.has(f));
				if(formats.length > 0) {
					this.warn(m.at, 7, 'rd-markup', `Unrecognized format: ${formats.join(' ')}`);
				}
				m.args.slice(1).forEach(a => this.content(a, m.name, tag));
			},
			href: (m, tag) => {
				this.url(m);
				this.content(arg(m, 1), m.name, tag);
			}
		}),
		fallback: (m: RdMacroUse) => this.warn(m.at, 7, 'rd-markup', `Tag \\${m.name} not recognized`)
	};

	/** what a macro in a code block does, the tag being the code block */
	private readonly codes = {
		early: table<Handler>({ 'var special': (m, tag) => this.code(arg(m, 0), tag) }),
		known: words('dots R newcommand renewcommand Sexpr'),
		late:  table<Handler>({
			ldots:                      this.withText(m => this.warn(m.at, -3, 'rd-markup', 'Tag \\ldots is invalid in a code block')),
			[LinkMacros]:               m => this.link(m),
			'method S3method S4method': (m, tag) => tag === 'usage' ? m.args.forEach(a => this.content(a, m.name, tag)) : this.warn(m.at, 7, 'rd-markup', `Tag \\${m.name} is only valid in \\usage`),
			[ExampleWrappers]:          (m, tag) => tag === 'examples' ? this.code(arg(m, 0), tag) : this.warn(m.at, 7, 'rd-markup', `Tag \\${m.name} is only valid in \\examples`)
		}),
		fallback: this.withText((m, tag) => this.warn(m.at, 7, 'rd-markup', `Tag \\${m.name} is invalid in a \\${tag} block`))
	};

	private dispatch(m: RdMacroUse, tag: string, { early, known, late, fallback }: RdChecker['blocks' | 'codes'], inline: Handler): void {
		(early.get(m.name) ?? (known.has(m.name) || this.known(m.name) ? inline : late.get(m.name)) ?? fallback)(m, tag);
	}

	public sections(nodes: readonly RdNode[]): { readonly name?: string, readonly nameAt: number, readonly docType: string } {
		nodes.filter(n => n.type === 'text' && /\S/.test(n.text)).forEach(n => this.warn(n.at, Always, 'rd-structure', 'All text must be in a section'));
		const macros = nodes.filter(isMacro);
		const named = (name: string) => macros.filter(m => m.name === name);
		const structure = (m: RdMacroUse | undefined, text: string) => m && this.warn(m.at, Always, 'rd-structure', text);
		structure(named('Rdversion')[1], 'Only one \\Rdversion declaration is allowed');
		macros.filter(m => !SectionNames.has(m.name) && !ExtraSections.has(m.name) && !this.known(m.name)).forEach(m => structure(m, `unexpected macro '\\${m.name}'`));
		structure(named('docType')[1], 'Multiple \\docType sections are not supported');
		const docTypes = named('docType').map(d => [d, plain(arg(d, 0)).trim()] as const);
		docTypes.filter(([, t]) => !DocTypes.has(t)).forEach(([d, t]) => structure(d, `docType '${t}' is unrecognized`));
		const docType = docTypes[0]?.[1] ?? '';
		const dropped = new Set(UniqueSections.flatMap(tag => named(tag).slice(1)));
		dropped.forEach(m => structure(m, `Only one \\${m.name} section is allowed: the first will be used`));
		this.defEnc ||= named('encoding').length > 0;
		const [names, titles] = [named('name'), named('title')];
		if(names.length !== 1 || titles.length !== 1) {
			this.warn(0, Always, 'rd-structure', 'Sections \\title, and \\name must exist and be unique in Rd files');
			return { nameAt: 0, docType };
		}
		const [nameMacro, nameNodes] = [names[0], arg(names[0], 0)];
		const name = unescape(plain(nameNodes)).trim();
		if(name === '' || name.includes('\\') || nameNodes.some(n => n.type !== 'text')) {
			structure(nameMacro, '\\name must only contain simple text');
			return { nameAt: nameMacro.at, docType };
		}
		NameRules.filter(r => r.test.test(name)).forEach(r => this.warn(nameMacro.at, r.level, 'rd-markup', r.text));
		macros.filter(m => SectionNames.has(m.name) && !dropped.has(m)).forEach(m => this.section(m, true));
		return { name, nameAt: nameMacro.at, docType };
	}

	private section(m: RdMacroUse, top: boolean): void {
		const titled = m.name === 'section' || m.name === 'subsection';
		const [title, content] = titled ? [arg(m, 0), arg(m, 1)] : [[], arg(m, 0)];
		const tagTitle = titled ? `'${plain(title).trim()}'` : `\\${m.name}`;
		if(top && isBlank(content)) {
			this.warn(m.at, Always, 'rd-empty-section', `Dropping empty section ${tagTitle}`);
			return;
		}
		this.content(title, m.name, m.name);
		this.hasText = false;
		if(m.name === 'usage' || m.name === 'examples') {
			this.code(content, m.name);
		} else {
			this.content(content, m.name, m.name);
		}
		if(!this.hasText) {
			this.warn(m.at, 3, 'rd-empty-section', `Empty section ${tagTitle}`);
		}
		const rd = deparse(titled ? title : content);
		if((titled || m.name === 'title') && /[^.]\.\s*$/.test(rd) && !/(etc|et\s+al)\.\s*$/.test(rd)) {
			this.warn(m.at, -5, 'rd-markup', `\\${m.name}${titled ? ' name' : ''} should not end in a period`);
		}
	}

	private text(n: RdText): void {
		if(!/\S/.test(n.text)) {
			return;
		}
		this.hasText = true;
		if((this.inEnc2 || !this.defEnc) && /\P{ASCII}/u.test(n.text)) {
			this.warn(n.at, -1, 'rd-encoding', `Non-ASCII contents ${this.inEnc2 ? 'in second part of \\enc' : 'without declared encoding'}: '${n.text.trim()}'`);
		}
		const specials = n.mode === 't' ? [...n.text.matchAll(/(?:^|[^\\])(\\[#$&_^~])/g)].map(m => m[1]) : [];
		if(specials.length > 0) {
			this.warn(n.at, -1, 'rd-markup', `Escaped LaTeX specials: ${specials.join(' ')}`);
		}
	}

	/** walks text; `cell` takes the macros of a table row first, and makes even blank groups lost braces */
	private content(nodes: readonly RdNode[], blocktag: string, sectionTag: string, cell?: (m: RdMacroUse) => boolean): void {
		nodes.forEach((n, i) => {
			if(n.type === 'text') {
				this.text(n);
			} else if(n.type === 'group') {
				if(cell !== undefined || !isBlank(n.children)) {
					this.lostBraces(n, nodes.slice(0, i), blocktag, sectionTag);
				}
				this.content(n.children, blocktag, sectionTag);
			} else if(cell?.(n)) {
				return;
			} else if(n.name === 'item') {
				if(ItemModes.get(blocktag) === 'tt' && arg(n, 0).every(l => l.type === 'text' && !/\S/.test(l.text))) {
					this.warn(n.at, 5, 'rd-markup', `\\item in \\${blocktag} must have non-empty label`);
				}
				n.args.forEach(a => this.content(a, 'item', sectionTag));
			} else {
				this.dispatch(n, sectionTag, this.blocks, this.inline);
			}
		});
	}

	private lostBraces(group: RdGroup, pre: readonly RdNode[], blocktag: string, sectionTag: string): void {
		const tagOf = (n: RdNode) => n.type === 'text' ? (/^\s*$/.test(n.text) ? 'BLANK' : 'TEXT') : n.type === 'group' ? 'LIST' : `\\${n.name}`;
		const pretags = pre.map(tagOf);
		const pretag = pretags.filter(t => t !== 'BLANK').pop();
		if(pretag === undefined) {
			return;
		}
		const [preblock, last, tags] = [pre[pre.length - 1], pretags[pretags.length - 1], group.children.map(tagOf)];
		const separated = last === 'BLANK' || (last === 'TEXT' && preblock.type === 'text' && !/([A-Za-z0-9]|\\[!-/:-@[-`{-~]|[\])])$/.test(preblock.text));
		const ignore = (tags.length === 1 && tags[0].startsWith('\\') && separated) || ((blocktag === 'itemize' || blocktag === 'enumerate') && pretag === '\\item')
			|| pretag === '\\tab' || ((sectionTag === 'source' || sectionTag === 'references') && (separated || pretag === '\\cr'));
		if(!ignore) {
			this.warn(group.at, -1, 'rd-lost-braces', `Lost braces${separated && tags.length === 1 && tags[0] === 'TEXT' ? '; missing escapes or markup?' : ''}`);
		}
	}

	private link(m: RdMacroUse): void {
		this.content(arg(m, 0), m.name, m.name);
		const text = plain(arg(m, 0)).trim();
		const option = m.option?.trim() ?? '';
		const colon = option.indexOf(':');
		const [topic, pkg] = option === '' ? [text + (LinkSuffix[m.name] ?? ''), undefined]
			: option.startsWith('=') ? [option.slice(1), undefined]
				: colon >= 0 ? [option.slice(colon + 1), option.slice(0, colon)] : [text, option];
		this.links.push({ line: this.scan.lineOf(m.at), topic, pkg, shown: option === '' ? `\\${m.name}{${text}}` : `\\${m.name}[${option}]{${text}}` });
	}

	private url(m: RdMacroUse): void {
		const url = unescape(plain(arg(m, 0))).replace(/\s+/g, '');
		const scheme = /^([A-Za-z][A-Za-z0-9+.-]*):/.exec(url)?.[1].toLowerCase();
		if(scheme !== undefined && (!UrlSchemes.has(scheme) || (scheme === 'mailto' && !EmailPattern.test(url.slice('mailto:'.length))))) {
			this.warn(m.at, 7, 'rd-markup', `Invalid URL: ${url}`);
		}
	}

	private code(nodes: readonly RdNode[], blocktag: string): void {
		for(const n of nodes) {
			if(n.type === 'text') {
				this.text(n);
			} else if(n.type === 'group') {
				this.code(n.children, blocktag);
			} else {
				this.dispatch(n, blocktag, this.codes, this.withText(() => undefined));
			}
		}
	}

	private tabular(table: RdMacroUse): void {
		this.hasText = true;
		const format = arg(table, 0);
		const content = [...arg(table, 1)];
		const spec = plain(format).trim();
		if(format.length !== 1 || format[0].type !== 'text') {
			this.warn(table.at, 7, 'rd-markup', '\\tabular format must be simple text');
		}
		if(!/^[lcr]*$/.test(spec)) {
			this.warn(table.at, 7, 'rd-markup', `Unrecognized \\tabular format: ${spec}`);
		}
		const lastCr = content.map(n => isMacro(n) && n.name === 'cr').lastIndexOf(true);
		if(lastCr >= 0 && isBlank(content.slice(lastCr + 1))) {
			content.splice(lastCr, 1);
		}
		const len = spec.length;
		let [col, row] = [1, 1];
		const check = () => col !== len && this.warn(table.at, col > len ? 7 : -2, 'rd-markup', `Only ${len} ${len === 1 ? 'column' : 'columns'} allowed in this table (row ${row} has ${col})`);
		this.content(content, 'tabular', 'tabular', n => {
			if(n.name === 'cr') {
				check();
				[row, col] = [row + 1, 1];
			}
			col += n.name === 'tab' ? 1 : 0;
			return n.name === 'cr' || n.name === 'tab';
		});
		check();
	}
}

/** what the package-wide checks need to know about a page */
type Page = { readonly file: string, readonly base: string, readonly name: string | undefined, readonly nameLine: number, readonly aliases: readonly string[], readonly docType: string,
	readonly keywords: readonly { readonly keyword: string, readonly line: number }[], readonly links: readonly RdLink[], readonly scan: RdScan, readonly src: string, readonly diags: readonly Diag[] };

/** Scans and checks one Rd page. */
function checkPage(file: string, src: string, settings: PageSettings): Page {
	const macros = new Map([...settings.macros, ...[...parseRdMacros(src)].map(([n, m]) => [n, m.params] as const)]);
	const scan = scanRd(src, {
		lenient: settings.lenient,
		specOf:  (name, parent) => name === 'item' ? ItemModes.get(parent ?? '') : Macros.get(name) ?? (macros.has(name) ? 't'.repeat(macros.get(name) ?? 0) : undefined)
	});
	const checker = new RdChecker(scan, { ...settings, macros });
	const diags: Diag[] = scan.problems.map(p => ({ line: scan.lineOf(p.at), level: Always, kind: p.kind === 'syntax' ? 'rd-syntax' : 'rd-unknown-macro', text: p.text }));
	const info: ReturnType<RdChecker['sections']> = diags.some(d => d.kind === 'rd-syntax') ? { nameAt: 0, docType: '' } : checker.sections(scan.nodes);
	diags.push(...checker.diags);
	const aliases = sectionsOf(scan.nodes, 'alias').map(a => unescape(plain(arg(a, 0))).trim()).filter(a => a !== '');
	const keywords = sectionsOf(scan.nodes, 'keyword').map(k => ({ keyword: plain(arg(k, 0)).trim(), line: scan.lineOf(k.at) }));
	return { file, src, scan, diags, aliases, keywords, base: file.slice(file.lastIndexOf('/') + 1), name: info.name, nameLine: scan.lineOf(info.nameAt), docType: info.docType, links: checker.links };
}

type Finding = readonly [kind: RdFilesKind, line: number, message: string];
type Env = { readonly config: RdFilesConfig, readonly data: ReadonlyFlowrAnalysisProvider, readonly methods: ReadonlySet<string> };

const section = (p: Page, name: string): RdMacroUse | undefined => sectionsOf(p.scan.nodes, name)[0];
const items = (m: RdMacroUse | undefined) => sectionsOf(m?.args[0] ?? [], 'item');
const hasKeyword = (p: Page, keywords: readonly string[]) => p.keywords.some(k => keywords.includes(k.keyword));
const BoilerplateKeywords = ['~kwd1', '~kwd2', '~~ other possible keyword(s) ~~'];

/** the unedited content `prompt()` and `package.skeleton()` generate, by section: a test on the deparsed body and its node count */
const Boilerplate: readonly (readonly [section: string, test: (rd: string, size: number) => boolean])[] = [
	['title', rd => rd.trim().startsWith('A Capitalized Title')],
	['details', (rd, n) => rd.includes('If necessary, more details than the description above') || (n <= 11 && rd.includes('~~ An overview of how to use the package'))],
	['references', rd => rd.replace(/\s+/g, ' ').includes('Literature or other references for background information')],
	['seealso', (rd, n) => n <= 5 && rd.includes('Optional links to other man pages')],
	['examples', rd => rd.includes('Optional simple examples of the most important functions')]
];

/** `checking Rd contents`: missing descriptions and values, argument items without text, and generated boilerplate */
function contents(p: Page, { config }: Env): Finding[] {
	const found: Finding[] = [];
	const add = (kind: RdFilesKind, line: number, text: string) => found.push([kind, line, text]);
	const internal = hasKeyword(p, ['internal']);
	const line = (m: RdMacroUse) => p.scan.lineOf(m.at);
	if(p.docType !== 'package' && isBlank(section(p, 'description')?.args[0] ?? [])) {
		add('rd-missing-description', 1, `Rd files without \\description: '${p.base}'`);
	}
	const args = items(section(p, 'arguments')).filter(i => i.args.length === 2);
	for(const item of internal ? [] : args.filter(i => isBlank(i.args[1]) && !isBlank(i.args[0]))) {
		plain(item.args[0]).split(',').map(s => s.trim()).filter(a => a !== '').forEach(a => add('rd-undocumented-argument', line(item), `Argument items with no description in Rd file '${p.base}': '${a}'`));
	}
	const boilerplate = (l: number, what: string) => add('rd-boilerplate', l, `Auto-generated content requiring editing in Rd file '${p.base}': ${what}`);
	for(const [name, test] of Boilerplate) {
		const m = section(p, name);
		if(m !== undefined && test(deparse(arg(m, 0)), arg(m, 0).length)) {
			boilerplate(line(m), `\\${name}`);
		}
	}
	for(const item of args) {
		const label = plain(item.args[0]).trim();
		if(deparse(item.args[1]).trim() === `~~Describe \\code{${label}} here~~`) {
			boilerplate(line(item), `\\arguments: ${label}`);
		}
	}
	p.keywords.filter(k => BoilerplateKeywords.includes(k.keyword)).forEach(k => boilerplate(k.line, `\\keyword: ${k.keyword}`));
	const usage = section(p, 'usage');
	if(config.requireValue && !internal && p.docType === '' && !hasKeyword(p, ['aplot', 'hplot', 'device', 'dynamic']) && usage !== undefined
		&& !isBlank(arg(usage, 0)) && section(p, 'value') === undefined && !deparse(arg(usage, 0)).includes('\\special')) {
		add('rd-missing-value', line(usage), `Rd files without \\value: '${p.base}'`);
	}
	return found;
}

/** `checking Rd line widths`: the code lines as the PDF manual sets them */
function lineWidths(p: Page, { config }: Env): Finding[] {
	return ([['usage', config.usageWidth], ['examples', config.examplesWidth]] as const).flatMap(([tag, limit]) => {
		const span = section(p, tag)?.spans[0];
		const lines = span === undefined ? [] : p.scan.text.slice(...span).split('\n');
		return lines.map((l, i) => [p.scan.lineOf(span?.[0] ?? 0) + i, unescape(l).replace(/\\l?dots/g, '...').trimEnd()] as const).filter(([, t]) => t.length > limit)
			.map(([line, t]): Finding => ['rd-line-width', line, `Rd file '${p.base}': \\${tag} lines wider than ${limit} characters (${t.length}): ${t.length > 140 ? `${t.slice(0, 140)}... [TRUNCATED]` : t.trim()}`]);
	});
}

/** the `\bibcitep`/`\bibcitet` keys a page cites but never shows with `\bibshow` */
function bibentries(p: Page): Finding[] {
	const events: { name: string, keys: string[], line: number }[] = [];
	const visit = (nodes: readonly RdNode[]): void => nodes.forEach(n => {
		if(n.type === 'group') {
			visit(n.children);
		} else if(isMacro(n)) {
			if(n.name.startsWith('bibci') || n.name === 'bibshow') {
				events.push({ name: n.name, keys: plain(arg(n, 0)).split(',').map(k => k.trim()).filter(k => k !== ''), line: p.scan.lineOf(n.at) });
			}
			n.args.forEach(visit);
		}
	});
	visit(p.scan.nodes);
	let [cited, cache, shown, first] = [[] as string[], [] as string[], [] as string[], 0];
	for(const e of events) {
		if(e.name !== 'bibshow') {
			[cited, cache, first] = [uniqueArrayMerge(cited, e.keys), uniqueArrayMerge(cache, e.keys), first || e.line];
		} else if(e.keys.length === 0) {
			cited = [];
		} else {
			shown = uniqueArrayMerge(shown, e.keys.includes('*') ? [...e.keys.filter(k => k !== '*'), ...cache] : e.keys);
		}
	}
	const missing = cited.filter(k => !shown.includes(k));
	return missing.length > 0 ? [['rd-bibentry', first, `Bibentries cited but not shown in Rd file '${p.base}': ${missing.map(k => `'${k}'`).join(', ')}`]] : [];
}

/** the S3 methods a `\usage` calls by their full name rather than with `\method` */
function s3Names(p: Page, { methods }: Env): Finding[] {
	const found: Finding[] = [];
	const visit = (nodes: readonly RdNode[]): void => nodes.forEach(n => {
		const call = n.type === 'text' ? /^\s*([A-Za-z.][A-Za-z0-9._]*)\s*\(/.exec(n.text)?.[1] : undefined;
		if(call !== undefined && methods.has(call)) {
			found.push(['rd-s3-method-name', p.scan.lineOf(n.at), `S3 methods shown with full name in Rd file '${p.base}': '${call}'`]);
		}
		visit(n.type === 'group' ? n.children : isMacro(n) && ExampleWrappers.includes(n.name) ? arg(n, 0) : []);
	});
	visit(section(p, 'usage')?.args[0] ?? []);
	return found;
}

/** a tree-sitter error node, searched without recursion deeper than the tree */
function firstErrorRow(root: { isError: boolean, isMissing: boolean, children: readonly unknown[], startPosition: { row: number } }): number | undefined {
	const stack = [root];
	for(let node = stack.pop(); node !== undefined; node = stack.pop()) {
		if(node.isError || node.isMissing) {
			return node.startPosition.row;
		}
		stack.push(...(node.children as typeof root[]).slice().reverse());
	}
	return undefined;
}

/** the file argument of the functions that write one: its name and its position among the unnamed arguments */
const FileWriters: ReadonlyMap<string, readonly [string, number]> = new Map(([
	['file', 1, 'write.csv write.csv2 write.table saveRDS write dput dump'], ['file', -1, 'save cat'], ['file', 0, 'save.image sink pdf postscript'], ['filename', 0, 'png jpeg bmp tiff svg cairo_pdf'],
	['con', 1, 'writeLines'], ['', 0, 'file.create'], ['path', 0, 'dir.create'], ['destfile', 1, 'download.file'], ['path', 1, 'write_rds']
] as const).flatMap(([name, at, fns]) => fns.split(' ').map(fn => [fn, [name, at] as const] as const)));
const HarmlessPaths = words(' /dev/null nul');

/** `checking examples`: what running the `\examples` of a page would complain about or leave behind */
function examples(p: Page, { data }: Env): Finding[] {
	const ex = rdExamples(p.src);
	if(ex === undefined || !/\S/.test(ex.code) || p.diags.some(d => d.kind === 'rd-syntax')) {
		return [];
	}
	const at = (row: number) => ex.lineOffset + row;
	const tree = data.parseStandalone(ex.code);
	const errorRow = tree.rootNode.hasError ? firstErrorRow(tree.rootNode) : undefined;
	if(errorRow !== undefined) {
		return [['rd-example-syntax', at(errorRow), `Running examples in '${p.file}' failed: the example code does not parse (unexpected code at line ${at(errorRow)})`]];
	}
	const ast = data.normalizeStandalone(ex.code);
	const nodes = projectNodes(ast);
	const found: Finding[] = [];
	const lineOf = (n: { info: { id: unknown } }) => at((SourceLocation.fromNode(n as never)?.[0] ?? 1) - 1);
	const assigned = (node: typeof nodes[number]) => {
		const parent = node.info.parent === undefined ? undefined : ast.idMap.get(node.info.parent);
		return (RArgument.is(parent) && parent.name === node) || (RBinaryOp.is(parent) && parent.lhs === node && ['<-', '=', '<<-'].includes(parent.operator));
	};
	let [setwds, restores] = [0, false];
	for(const node of nodes) {
		const symbol = RSymbol.is(node) ? Identifier.getName(node.content) : undefined;
		if((symbol === 'T' || symbol === 'F') && !assigned(node)) {
			found.push(['rd-example-abbreviation', lineOf(node), `Examples use '${symbol}' instead of '${symbol === 'T' ? 'TRUE' : 'FALSE'}'`]);
		}
		if(!RFunctionCall.isNamed(node)) {
			continue;
		}
		const name = Identifier.getName(node.functionName.content);
		if(name === 'q' || name === 'quit') {
			found.push(['rd-example-quit', lineOf(node), `Examples call ${name}(), which ends the R session`]);
		}
		setwds += name === 'setwd' ? 1 : 0;
		restores ||= ['on.exit', 'with_dir', 'withr::with_dir'].includes(name);
		const [argName, position] = FileWriters.get(name) ?? ['', -1];
		const args = node.arguments.filter(RArgument.isNotEmpty);
		const value = ((argName === '' ? undefined : args.find(a => a.name?.content === argName)) ?? args.filter(a => a.name === undefined)[position])?.value;
		if(RString.is(value) && !HarmlessPaths.has(value.content.str)) {
			found.push(['rd-example-file', lineOf(node), `Examples write to '${value.content.str}', which is not below tempdir(); the file is left behind`]);
		}
	}
	if(setwds === 1 && !restores) {
		const call = nodes.find(n => RFunctionCall.isNamed(n, 'setwd'));
		found.push(['rd-example-setwd', call === undefined ? at(0) : lineOf(call), 'Examples change the working directory with setwd() and never restore it']);
	}
	return found;
}

/** the checks run on each page, in order, with the configuration that enables them */
const PageChecks: readonly (readonly [(c: RdFilesConfig) => boolean, (p: Page, e: Env) => Finding[]])[] = [
	[c => c.parse, (p, { config }) => p.diags.filter(d => d.level >= config.minLevel).map(d => [d.kind, d.line, `${p.base}:${d.line}: ${d.text}`])],
	[c => c.parse && c.bibentries, bibentries],
	[c => c.lineWidths, lineWidths],
	[c => c.contents, contents],
	[c => c.standardKeywords, (p, { config }) => p.keywords.filter(k => k.keyword !== '' && !config.keywords.includes(k.keyword) && !BoilerplateKeywords.slice(0, 2).includes(k.keyword))
		.map(k => ['rd-keyword', k.line, `Rd file '${p.base}': keyword '${k.keyword}' is not one of the standard keywords`])],
	[c => c.docStyle, s3Names],
	[c => c.examples, examples]
];

type Add = ReturnType<typeof fileFindings<RdFilesKind>>['add'];

/** the pages grouped by `key`, only the groups of more than one */
function shared<T>(items: readonly T[], key: (t: T) => string): [string, T[]][] {
	const m = new Map<string, T[]>();
	items.forEach(i => m.set(key(i), [...m.get(key(i)) ?? [], i]));
	return [...m].filter(([, g]) => g.length > 1);
}

/** `checking Rd metadata`: names and aliases that more than one page uses, and the package aliases */
function checkMetadata(pages: readonly Page[], pkg: string | undefined, add: Add): void {
	const named = pages.filter(p => p.name !== undefined);
	for(const [name, ps] of shared(named, p => p.name ?? '')) {
		ps.slice(1).forEach(p => add('rd-duplicate-name', p.file, `Rd files with duplicated name '${name}': ${ps.map(x => x.base).join(', ')}`, p.nameLine));
	}
	for(const [alias, ps] of shared(pages.flatMap(p => p.aliases.map(a => [a, p] as const)), ([a]) => a)) {
		ps.slice(1).forEach(([, p]) => add('rd-duplicate-alias', p.file, `Rd files with duplicated alias '${alias}': ${ps.map(([, x]) => x.base).join(', ')}`, 1));
	}
	named.filter(p => p.aliases.length === 0).forEach(p => add('rd-missing-alias', p.file, `Rd files without \\alias: '${p.base}'`, 1));
	const own = `${pkg}-package`;
	const all = pages.flatMap(p => p.aliases.filter(a => a.endsWith('-package')).map(a => [a, p] as const));
	const hasOwn = all.some(([a]) => a === own);
	all.filter(([a]) => !(hasOwn && a.toLowerCase() === own.toLowerCase())).forEach(([a, p]) => add('rd-package-alias', p.file, `Invalid package aliases in Rd file '${p.base}': '${a}'`, 1));
	for(const [lower, ps] of shared(named, p => p.name?.toLowerCase() ?? '')) {
		if(new Set(ps.map(p => p.name)).size > 1) {
			ps.forEach(p => add('rd-name-case', p.file, `Rd files whose name differs only by case ('${lower}'): ${ps.map(x => `'${x.name}'`).join(', ')}`, p.nameLine));
		}
	}
}

/** `checking Rd cross-references`: where each link of the pages points */
function checkCrossReferences(pages: readonly Page[], ctx: ReadOnlyFlowrAnalyzerContext, info: ReturnType<typeof packageInfo>, uncertain: boolean, add: Add): void {
	const own = new Set(pages.flatMap(p => p.aliases));
	const linked = new Set([...info.declared.get('Depends') ?? [], ...info.declared.get('Imports') ?? []]);
	const declared = new Set(DependencyFields.flatMap(f => info.declared.get(f) ?? []));
	const sigdb = ctx.deps.hasSignatureDatabase();
	const reported = new Set<string>();
	for(const page of pages) {
		for(const { pkg, topic, line, shown } of page.links) {
			const checkable = uncertain && /^[A-Za-z.][A-Za-z0-9._]*$/.test(topic);
			const exporters = ctx.deps.packagesExporting(topic);
			let missing = false;
			if(pkg === undefined) {
				missing = checkable && sigdb && !own.has(topic) && baseRExportOwner(topic) === undefined && !exporters.some(p => linked.has(p));
			} else if(pkg !== info.name && !isBaseRPackage(pkg) && !declared.has(pkg)) {
				if(!reported.has(pkg)) {
					reported.add(pkg);
					add('rd-undeclared-package', page.file, `Undeclared package '${pkg}' in Rd xrefs`, line);
				}
			} else if(pkg !== info.name && checkable) {
				const owner = baseRExportOwner(topic);
				missing = isBaseRPackage(pkg) ? owner !== undefined && owner !== pkg
					: sigdb && ctx.deps.signatureSources().some(s => s.has(pkg)) && exporters.length > 0 && !exporters.includes(pkg);
			}
			if(missing) {
				add('rd-missing-link', page.file, `Missing link(s) in Rd file '${page.base}': '${shown}'`, line, LintingResultCertainty.Uncertain);
			}
		}
	}
}

/** the Rd macros of the package: R's system macros, those of `man/macros`, and the configured ones */
function packageMacros(files: PackageFiles, extra: readonly string[]): Map<string, number> {
	const defined = files.entries.filter(e => !e.isDirectory && /^man\/macros\/[^/]+\.[Rr]d$/.test(e.relative))
		.flatMap(e => [...parseRdMacros(files.read(e.relative) ?? '')].map(([n, m]) => [n, m.params] as const));
	return new Map([...SystemMacros.split(' ').map(m => [m, 0] as const), ...defined, ...extra.map(m => [m.replace(/^\\/, ''), 0] as const)]);
}

/** Port of the Rd checks of `R CMD check`, run on the `man/*.Rd` sources. */
export const RD_FILES = {
	createSearch:        () => Q.from([]),
	processSearchResult: onPackageFiles({ checkedFiles: 0 }, (files, info, config, data) => {
		const { results, add } = fileFindings<RdFilesKind>(files);
		const description = info.description?.content();
		const has = (field: string) => (description?.get(field)?.length ?? 0) > 0;
		const settings: PageSettings = { defEnc: has('Encoding'), macros: packageMacros(files, config.extraMacros), lenient: has('RdMacros') || config.extraMacros.length > 0 };
		const pages = files.entries.filter(e => !e.isDirectory && /^man\/([^/]+\/)?[^/]+\.[Rr]d$/.test(e.relative) && !e.relative.startsWith('man/macros/'))
			.flatMap(e => [files.read(e.relative)].filter(src => src !== undefined).map(src => checkPage(e.relative, src, settings)));
		const methods = new Set([...info.namespace?.exportS3Generics ?? []].flatMap(([generic, classes]) => classes.map(c => `${generic}.${c}`)));
		const env: Env = { config, data, methods };
		for(const page of pages) {
			PageChecks.filter(([on]) => on(config)).forEach(([, run]) => run(page, env).forEach(([kind, line, message]) => add(kind, page.file, message, line)));
		}
		const news = files.read('inst/NEWS.Rd');
		if(config.parse && news !== undefined) {
			checkPage('inst/NEWS.Rd', news, { ...settings, defEnc: true }).diags.filter(d => (d.kind === 'rd-syntax' || d.kind === 'rd-unknown-macro') && d.level >= config.minLevel)
				.forEach(d => add(d.kind, 'inst/NEWS.Rd', `NEWS.Rd:${d.line}: ${d.text}`, d.line));
		}
		if(config.metadata) {
			checkMetadata(pages, info.name, add);
		}
		if(config.crossReferences) {
			checkCrossReferences(pages, data.inspectContext(), info, config.uncertainLinks, add);
		}
		return { results, '.meta': { checkedFiles: pages.length } };
	}),
	prettyPrint: prettyPrint(
		result => `${result.kind} in ${result.file} at ${SourceLocation.format(result.loc)}`,
		result => `${result.message} (at ${SourceLocation.format(result.loc)})`
	),
	info: {
		name:          'Rd Files',
		tags:          [LintingRuleTag.CmdCheck, LintingRuleTag.Robustness],
		certainty:     LintingRuleCertainty.BestEffort,
		description:   'Finds problems in the Rd files: syntax, unknown macros, required and duplicated sections, metadata, cross-references, line widths, contents, and the example code.',
		defaultConfig: () => ({ parse: true, minLevel: -1, metadata: true, crossReferences: true, uncertainLinks: true, lineWidths: true, usageWidth: 90, examplesWidth: 100, contents: true, requireValue: false, standardKeywords: false, keywords: StandardKeywords, docStyle: true, bibentries: true, examples: true, extraMacros: [] })
	}
} as const satisfies LintingRule<RdFilesResult, RdFilesMetadata, RdFilesConfig>;
