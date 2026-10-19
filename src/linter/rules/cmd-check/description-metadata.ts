import { uniqueArray } from '../../../util/collections/arrays';
import { escapeRegex } from '../../../util/text/strings';
import fs from 'fs';
import path from 'path';
import { LintingResultCertainty, type LintingRule, LintingRuleCertainty } from '../../linter-format';
import type { MergeableRecord } from '../../../util/objects';
import { Q } from '../../../search/flowr-search-builder';
import { LintingRuleTag } from '../../linter-tags';
import type { SourceLocation } from '../../../util/range';
import { AuthorRole, parseRAuthorString } from '../../../util/r-author';
import type { ReadOnlyFlowrAnalyzerContext } from '../../../project/context/flowr-analyzer-context';
import { AttachedBasePackageSet, isBaseRPackage } from '../../../util/r-base-packages';
import { rootDescriptionFile } from './package-files';
import { MessageAtLocation } from './file-checks';
import { RPath } from '../../../util/files';
import { type CmdCheckResult, DependencyFields, type DependencyField } from './cmd-check-util';

/** The sub-check of `R CMD check` a finding stems from. */
export type DescriptionMetadataKind =
	'missing-field' | 'non-ascii-tag' | 'non-ascii-value' | 'unknown-encoding' | 'non-portable-encoding'
	| 'bad-package-name' | 'bad-version' | 'bad-maintainer' | 'bad-dependency' | 'bad-vignette-builder'
	| 'title-period' | 'description-sentence' | 'duplicate-dependency' | 'self-dependency' | 'linking-to-without-src'
	| 'many-depends' | 'many-imports' | 'license' | 'bad-authors-at-r' | 'no-maintainer' | 'no-author'
	| 'title-case' | 'title-is-name' | 'title-starts-with-name' | 'description-start' | 'description-initial';

export interface DescriptionMetadataResult extends CmdCheckResult {
	/** the sub-check that found the problem */
	readonly kind:   DescriptionMetadataKind
	/** the DESCRIPTION field the finding is about, if there is one */
	readonly field?: string
}

export interface DescriptionMetadataConfig extends MergeableRecord {
	/** also run the style checks `R CMD check --as-cran` adds for the Title, Description, and Authors\@R fields (default `true`) */
	readonly cranIncoming: boolean
	/** how many non-default packages `Depends` may list before it is reported, as `R CMD check` does after five (default `5`) */
	readonly maxDepends:   number
	/** how many non-base packages `Imports` may list before it is reported, `0` for no limit as `R CMD check` does by default (default `0`) */
	readonly maxImports:   number
}

export interface DescriptionMetadataMetadata extends MergeableRecord {
	/** whether the project has a DESCRIPTION file that was inspected */
	readonly hasDescription: boolean
}

interface Field {
	readonly name:  string
	readonly value: string
	readonly start: number
	readonly end:   number
}

/** the fields `R CMD check` requires to be ASCII */
const AsciiFields: ReadonlySet<string> = new Set(['Package', 'Version', 'Priority', 'Depends', 'Imports', 'LinkingTo', 'Suggests', 'Enhances', 'License', 'License_is_FOSS', 'License_restricts_use', 'OS_type', 'Archs', 'MD5sum', 'NeedsCompilation', 'Encoding']);
const PortableEncodings: ReadonlySet<string> = new Set(['latin1', 'latin2', 'UTF-8']);
const PackageName = String.raw`\p{L}[\p{L}\p{N}.]*[\p{L}\p{N}]`;
const PackageNameRegex = new RegExp(`^(R|${PackageName})$`, 'u');
const VersionRegex = /^(\d+[.-])+\d+$/;
const DependencyRegex = new RegExp(String.raw`^\s*(R|${PackageName})(\s*\(([^) ]+)\s+([^) ]+)\))?\s*$`, 'u');
const DependencyOperators: ReadonlySet<string> = new Set(['<=', '>=', '<', '>', '==', '!=']);
const MaintainerRegex = /^\s*(.*<(".+"|([A-Za-z0-9!#$%*/?|^{}`~&'+=_-]+\.)*[A-Za-z0-9!#$%*/?|^{}`~&'+=_-]+)@([A-Za-z0-9-]+\.)*[A-Za-z0-9-]+>|ORPHANED)\s*$/;
const LicenseTemplates: ReadonlySet<string> = new Set(['MIT License', 'MIT', 'BSD 2-clause License', 'BSD_2_clause', 'BSD 3-clause License', 'BSD_3_clause']);
const DeprecatedLicense = /(^Modified BSD License$|^BSD$|^CC BY.* [23][.]0)/;
const CanonicalLicense = new RegExp(String.raw`^(((GPL-2|GPL-3|LGPL-2|LGPL-2.1|LGPL-3|AGPL-3|Artistic-1.0|Artistic-2.0|CECILL-2.1)|(FreeBSD License|MIT License|BSD 2-clause License|BSD 3-clause License|Creative Commons Attribution 4.0 International License|Creative Commons Attribution-ShareAlike 4.0 International License|Creative Commons Attribution-NonCommercial 4.0 International License|Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License|Creative Commons Attribution-NonCommercial-NoDerivs 4.0 International License|CC0|zlib License|FreeBSD|MIT|BSD_2_clause|BSD_3_clause|CC BY 4.0|CC BY-SA 4.0|CC BY-NC 4.0|CC BY-NC-SA 4.0|CC BY-NC-ND 4.0|Zlib)|(Apache License|Artistic License|Boost Software License|CeCILL|Common Public License|Eclipse Public License|European Union Public License|GNU Affero General Public License|GNU General Public License|GNU Lesser General Public License|GNU Library General Public License|Lucent Public License|Mozilla Public License|AGPL|BSL|CPL|CeCILL|EPL|EUPL|GPL|LGPL|MPL)\s*(\((\s*(<|<=|>|>=|==|!=)\s*((\d+[.-])*\d+)\s*,)*\s*(<|<=|>|>=|==|!=)\s*((\d+[.-])*\d+)\s*\))*|(GNU General Public License\s+([Vv]ersion\s+)?2|GNU General Public License\s+([Vv]ersion\s+)?3|GNU Library General Public License\s+([Vv]ersion\s+)?2|GNU Lesser General Public License\s+([Vv]ersion\s+)?2.1|GNU Lesser General Public License\s+([Vv]ersion\s+)?3|GNU Affero General Public License\s+([Vv]ersion\s+)?3|Apache License\s+([Vv]ersion\s+)?1.1|Apache License\s+([Vv]ersion\s+)?2.0|Artistic License\s+([Vv]ersion\s+)?1.0|Artistic License\s+([Vv]ersion\s+)?2.0|CeCILL\s+([Vv]ersion\s+)?2|CeCILL\s+([Vv]ersion\s+)?2.1|Mozilla Public License\s+([Vv]ersion\s+)?1.0|Mozilla Public License\s+([Vv]ersion\s+)?1.1|Mozilla Public License\s+([Vv]ersion\s+)?2.0|Common Public License\s+([Vv]ersion\s+)?1.0|Eclipse Public License\s+([Vv]ersion\s+)?1.0|Lucent Public License\s+([Vv]ersion\s+)?1.02|European Union Public License\s+([Vv]ersion\s+)?1.1|European Union Public License\s+([Vv]ersion\s+)?1.2|Boost Software License\s+([Vv]ersion\s+)?1.0)|(GPL-2|GPL-3|LGPL-2|LGPL-2.1|LGPL-3|AGPL-3|CeCILL-2|CeCILL-2.1|MPL-1.0|MPL-1.1|MPL-2.0|CPL-1.0|EPL-1.0|EUPL-1.1|EUPL-1.2|BSL-1.0))(\s*\+\s*file LICEN[CS]E)?|file LICEN[CS]E|Unlimited)$`);
/** license specifications that are no canonical component but which `R CMD check` is able to standardize */
const StandardizableLicenses: ReadonlySet<string> = new Set([
	'The Artistic License, Version 2.0', 'Artistic 2.0', 'Boost Software License', 'Boost Software License 1.0', 'BSL 1.0', 'CeCILL-2.0',
	'GNU Public License', 'Gnu GPL', 'GNU GPL', 'GNU General Public License 2.0.', 'GPL 2.0', 'GPL version 2.0', 'GPL2.0', 'GPL Version 2',
	'GNU GPL Version 2', 'GNU GPL version 2', 'GNU GPL version 2.', 'GPL (version 2)', 'GPL 2', 'GPL 2.', 'GPL version 2', 'GPL version 2 (June, 1991)',
	'GPL version 2.', 'GPL2', 'GPL V2', 'GPL, version 2', 'GPL Version 3', 'GPL version 3', 'GNU General Public Licence (GPLv3)', 'GPL 3', 'GPL v3',
	'GNU GPL v2.0 or greater', 'GPL 2.0 or higher', 'GPL 2.0 or newer', 'GPL version 2.0 or later', 'GPL version 2.0 or newer',
	'GNU GPL (version 2 or later)', 'GNU GPL (version 2 or later); see the file COPYING for details', 'GNU GPL version 2 or newer',
	'GNU General Public License version 2 or newer', 'GPL version 2 or later', 'GPL ( version 2 or later)', 'GPL (Version 2 or above)',
	'GPL (Version 2 or later)', 'GPL (version 2 or higher)', 'GPL (version 2 or later)', 'GPL (version 2 or later, see the included file GPL)',
	'GPL (version 2 or newer)', 'GPL 2 or later', 'GPL 2 or newer', 'GPL version 2 or any later version', 'GPL Version 2 or later',
	'GPL Version 2 or later.', 'GPL Version 2 or newer', 'GPL Version 2 or newer.', 'GPL version 2 (June, 1991) or later', 'GPL version 2 (or newer)',
	'GPL version 2 or later.', 'GPL version 2 or newer', 'GPL version 2 or newer (see README).', 'GPL version 2 or newer.',
	'GPL version 2, or, at your option, any newer version.', 'GPL Version 2 (or later)', 'GPL version 2 (or later)', 'GPL version 2 or higher',
	'GPL2 or later', 'GPL>=2', 'GNU General Public License (version 2 or later)', 'GPL (version 3 or later)', 'GPL >=3', 'GPL or LGPL by your choice',
	'GPL, BSD', 'use under GPL2, or see file LICENCE', 'GNU LGPL (same as wxWidgets).', 'LGPL2', 'LGPL2.0', 'LGPL version 2.1', 'LGPL-v3',
	'LGPL >= 2.0', 'LGPL Version 2 or later.', 'LGPL version 2 or newer', 'LGPL (version 2 or later)', 'LGPL version 2 or later',
	'LGPL version 2.1 or later', 'LGPL >=3', 'Unlimited use and distribution.'
]);

/** the DCF fields of the raw DESCRIPTION text, remembering the lines they span */
function readFields(text: string): Map<string, Field> {
	const fields = new Map<string, Field>();
	const lines = (text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text).split(/\r?\n/);
	let cur: { name: string, parts: string[], start: number } | undefined;
	const flush = (end: number) => {
		if(cur) {
			fields.set(cur.name, { name: cur.name, value: cur.parts.join('\n').trim(), start: cur.start, end });
		}
	};
	let last = 0;
	lines.forEach((line, i) => {
		const m = /^([^\s:][^:]*):(.*)$/.exec(line);
		if(m && !/^\s/.test(line)) {
			flush(last);
			cur = { name: m[1].trim(), parts: [m[2].trim()], start: i + 1 };
			last = i + 1;
		} else if(cur && /^\s/.test(line) && line.trim() !== '') {
			cur.parts.push(line.trim());
			last = i + 1;
		}
	});
	flush(last);
	return fields;
}

/** whether the parentheses outside of string literals balance */
function balancedParentheses(code: string): boolean {
	const bare = code.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/gs, '');
	return [...bare].reduce((d, c) => c === '(' ? d + 1 : c === ')' ? d - 1 : d, 0) === 0;
}

const hasNonAscii = (s: string) => [...s].some(c => c.charCodeAt(0) > 127);
const flat = (s: string) => s.replace(/[\n\t]/g, ' ');
const quote = (s: string) => `'${s}'`;

/** the comma-separated entries of a dependency-like field as `strsplit` + `trimws` give them */
function entriesOf(value: string): string[] {
	const parts = value.split(',').map(s => s.trim());
	if(parts.length > 0 && parts[parts.length - 1] === '') {
		parts.pop();
	}
	return parts;
}

/** the package names a dependency-like field lists, malformed entries and `R` left out */
function packagesOf(value: string): string[] {
	return entriesOf(value).flatMap(e => {
		const m = DependencyRegex.exec(e);
		return m && m[1] !== 'R' ? [m[1]] : [];
	});
}

/** `tools::toTitleCase`: the words `R CMD check` wants capitalized in a title */
export function toTitleCase(text: string): string {
	const alone = new Set(['2D', '3D', 'AIC', 'BayesX', 'GoF', 'HTML', 'LaTeX', 'MonetDB', 'OpenBUGS', 'TeX', 'U.S.', 'U.S.A.', 'WinBUGS', 'aka', 'et', 'al.', 'ggplot2', 'i.e.', 'jar', 'jars', 'ncdf', 'netCDF', 'rgl', 'rpart', 'xls', 'xlsx',
		'all', 'above', 'after', 'along', 'also', 'among', 'any', 'both', 'can', 'few', 'it', 'less', 'log', 'many', 'may', 'more', 'over', 'some', 'their', 'then', 'this', 'under', 'until', 'using', 'von', 'when', 'where', 'which', 'will', 'without', 'yet', 'you', 'your']);
	const lpat = /^(a|an|and|are|as|at|be|but|by|en|for|if|in|is|nor|not|of|on|or|per|so|the|to|v[.]?|via|vs[.]?|from|into|than|that|with)$/i;
	const xx: string[] = [];
	let word = '';
	for(const c of text) {
		if(' -/"()\n\t,'.includes(c)) {
			if(word) {
				xx.push(word);
				word = '';
			}
			xx.push(c);
		} else {
			word += c;
		}
	}
	if(word) {
		xx.push(word);
	}
	const l = xx.map((x, i) => i > 0 && lpat.test(x));
	xx.forEach((x, i) => {
		if(/[-:]$/.test(x) && i + 2 < xx.length && xx[i + 1] === ' ' && /^['\p{L}\p{N}]/u.test(xx[i + 2]) && !(x === '-' && lpat.test(xx[i + 2]))) {
			l[i + 2] = false;
		}
		if(x === '"' && i + 1 < xx.length) {
			l[i + 1] = false;
		}
	});
	return xx.map((x, i) => {
		if(l[i]) {
			return x.toLowerCase();
		}
		if(alone.has(x) || /^'.*'$/.test(x) || /^\p{L}.*\p{Lu}/u.test(x) || [...x].length === 1) {
			return x;
		}
		return x.length >= 3 && (x[0] === '\'' || x[0] === '"') ? x[0] + x[1].toUpperCase() + x.slice(2).toLowerCase() : x[0].toUpperCase() + x.slice(1).toLowerCase();
	}).join('');
}

/** the title in title case, leaving single-quoted parts alone like `R CMD check` does */
function titleCased(title: string): string {
	let cased = toTitleCase(title);
	for(const m of title.matchAll(/(^|(?<=[ \t!-/:-@[-`{-~]))'[^']*'($|(?=[ \t!-/:-@[-`{-~]))/g)) {
		cased = cased.slice(0, m.index) + m[0] + cased.slice(m.index + m[0].length);
	}
	return cased;
}

/** whether there is a `src` folder, `undefined` if flowR has no way to know */
function hasSrcFolder(ctx: ReadOnlyFlowrAnalyzerContext, dir: string): boolean | undefined {
	const src = path.join(dir, 'src') + path.sep;
	if(ctx.files.getAllFiles().some(f => path.normalize(f.path()).startsWith(src))) {
		return true;
	}
	return fs.existsSync(dir) ? fs.existsSync(path.join(dir, 'src')) : undefined;
}

/** Port of the DESCRIPTION checks of `R CMD check` (meta-information, dependency fields, license, Authors\@R, and the `--as-cran` style checks), located at the field's lines. */
export const DESCRIPTION_METADATA = {
	createSearch:        () => Q.from([]),
	processSearchResult: (_elements, config, data) => {
		const ctx = data.inspectContext();
		const file = rootDescriptionFile(ctx);
		if(file === undefined) {
			return { results: [], '.meta': { hasDescription: false } };
		}
		const descPath = file.path();
		const text = file.rawText?.() ?? file.content().toString();
		const fields = readFields(text);
		const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
		const results: DescriptionMetadataResult[] = [];
		const add = (kind: DescriptionMetadataKind, message: string, field?: string) => {
			const f = field === undefined ? undefined : fields.get(field);
			const loc: SourceLocation = f ? [f.start, 1, f.end, Math.max(1, lines[f.end - 1]?.length ?? 1), descPath] : [1, 1, 1, 1, descPath];
			results.push({ certainty: LintingResultCertainty.Certain, involvedId: undefined, loc, kind, field, message });
		};
		const val = (name: string) => fields.get(name)?.value;
		const packageName = val('Package');
		const isBase = val('Priority') === 'base';

		/* checking DESCRIPTION meta-information: required fields */
		const hasAuthorsAtR = (val('Authors@R') ?? '') !== '';
		const required = ['Package', 'Version', 'License', 'Description', 'Title', ...hasAuthorsAtR ? [] : ['Author', 'Maintainer']];
		for(const name of required) {
			if((val(name) ?? '') === '') {
				add('missing-field', `Required field missing or empty: ${quote(name)}`);
			}
		}

		/* encoding and non-ASCII values */
		for(const f of fields.values()) {
			if(hasNonAscii(f.name)) {
				add('non-ascii-tag', `Fields with non-ASCII tags: ${quote(f.name)}. All field tags must be ASCII.`, f.name);
			}
			if(AsciiFields.has(f.name) && hasNonAscii(f.value)) {
				add('non-ascii-value', `Fields with non-ASCII values: ${quote(f.name)}. These fields must have ASCII values.`, f.name);
			}
		}
		const encoding = val('Encoding');
		if(encoding === undefined) {
			for(const f of fields.values()) {
				if(hasNonAscii(f.value)) {
					add('unknown-encoding', `Unknown encoding with non-ASCII data in field ${quote(f.name)}`, f.name);
				}
			}
		} else if(!PortableEncodings.has(encoding)) {
			add('non-portable-encoding', `Encoding ${quote(encoding)} is not portable`, 'Encoding');
		}

		/* package name, version, maintainer */
		if(packageName !== undefined && packageName !== '') {
			if(!PackageNameRegex.test(packageName)) {
				add('bad-package-name', 'Malformed package name', 'Package');
			} else if(!isBase && isBaseRPackage(packageName)) {
				add('bad-package-name', 'Invalid package name. This is the name of a base package.', 'Package');
			}
		}
		const version = val('Version');
		if(version !== undefined && version !== '' && !isBase && !VersionRegex.test(version)) {
			add('bad-version', 'Malformed package version.', 'Version');
		}
		const maintainer = val('Maintainer');
		if(maintainer !== undefined && !MaintainerRegex.test(maintainer)) {
			add('bad-maintainer', 'Malformed maintainer field.', 'Maintainer');
		}

		/* dependency fields */
		const declared = new Map<DependencyField, string[]>();
		for(const field of DependencyFields) {
			const value = val(field);
			if(value === undefined) {
				continue;
			}
			declared.set(field, packagesOf(value));
			for(const entry of entriesOf(value)) {
				const m = DependencyRegex.exec(entry);
				if(!m) {
					add('bad-dependency', `Malformed ${field} field. Offending entry: ${quote(entry)}. Entries must be names of packages optionally followed by '<=' or '>=', white space, and a valid version number in parentheses.`, field);
				} else if(m[2] !== undefined) {
					if(!DependencyOperators.has(m[3])) {
						add('bad-dependency', `Malformed ${field} field. Entry with infeasible comparison operator: ${quote(entry)}. Only operators '<=' and '>=' are possible.`, field);
					} else if(m[1] === 'R' ? !/^(r\d+|(\d+[.-])+\d+)$/.test(m[4]) : !VersionRegex.test(m[4])) {
						add('bad-dependency', `Malformed ${field} field. Entry with infeasible version number: ${quote(entry)}. Version numbers must be sequences of at least two non-negative integers, separated by single '.' or '-'.`, field);
					}
				}
			}
		}
		const builder = val('VignetteBuilder');
		if(builder !== undefined) {
			const parts = entriesOf(builder);
			if(parts.length < 1 || !parts.every(p => /^[\p{L}\p{N}.]*$/u.test(p))) {
				add('bad-vignette-builder', 'Invalid VignetteBuilder field. This field must contain one or more packages (and no version requirement).', 'VignetteBuilder');
			}
		}

		/* checking Title and Description endings */
		const title = val('Title');
		if(title !== undefined && title.endsWith('.') && !/\s[.][.][.]|et\s+al[.]/.test(title)) {
			add('title-period', 'Malformed Title field: should not end in a period.', 'Title');
		}
		const description = val('Description');
		if(description !== undefined && !/[.!?]['")]?$/.test(description)) {
			add('description-sentence', 'Malformed Description field: should contain one or more complete sentences.', 'Description');
		}

		/* .check_package_description2 and dependency hygiene */
		const seen = new Set<string>();
		const duplicated = new Set<string>();
		for(const field of ['Depends', 'Imports', 'Suggests', 'Enhances'] as const) {
			for(const p of new Set(declared.get(field))) {
				(seen.has(p) ? duplicated : seen).add(p);
			}
		}
		for(const p of duplicated) {
			const where = ['Depends', 'Imports', 'Suggests', 'Enhances'].filter(f => declared.get(f as DependencyField)?.includes(p));
			add('duplicate-dependency', `Package ${quote(p)} listed in more than one of Depends, Imports, Suggests, Enhances. A package should be listed in only one of these fields.`, where[where.length - 1]);
		}
		if(packageName !== undefined) {
			for(const [field, pkgs] of declared) {
				if(pkgs.includes(packageName)) {
					add('self-dependency', `Package ${quote(packageName)} depends on itself in the ${field} field`, field);
				}
			}
		}
		if((declared.get('LinkingTo')?.length ?? 0) > 0 && hasSrcFolder(ctx, path.dirname(descPath)) === false) {
			add('linking-to-without-src', "'LinkingTo' field is unused: package has no 'src' directory", 'LinkingTo');
		}
		const manyDepends = uniqueArray(declared.get('Depends') ?? []).filter(p => !AttachedBasePackageSet.has(p));
		if(manyDepends.length > config.maxDepends) {
			add('many-depends', `Depends: includes the non-default packages: ${manyDepends.map(quote).join(', ')}. Adding so many packages to the search path is excessive and importing selectively is preferable.`, 'Depends');
		}
		const manyImports = uniqueArray(declared.get('Imports') ?? []).filter(p => !isBaseRPackage(p));
		if(config.maxImports > 0 && manyImports.length > config.maxImports) {
			add('many-imports', `Imports includes ${manyImports.length} non-default packages. Importing from so many packages makes the package vulnerable to any of them becoming unavailable. Move as many as possible to Suggests and use conditionally.`, 'Imports');
		}

		/* .check_package_license */
		const license = val('License');
		if(license !== undefined && license !== '') {
			const components = license.replace(/\s*\+\s*/g, ' + ').split('|').map(c => c.trim());
			const nonCanonical = components.filter(c => !CanonicalLicense.test(c));
			if(nonCanonical.some(c => !StandardizableLicenses.has(c))) {
				add('license', `Non-standard license specification: ${quote(license)}. Standardizable: no`, 'License');
			}
			const dir = path.dirname(descPath);
			const pointers = components.flatMap(c => [...c.matchAll(/file\s+(LICEN[CS]E)/g)].map(m => m[1]));
			const known = new Set(ctx.files.getAllFiles().map(f => RPath.normalize(f.path())));
			const badPointers = pointers.filter(p => !known.has(RPath.join(dir, p)) && ctx.files.exists(path.join(dir, p), false) === undefined);
			if(badPointers.length > 0) {
				add('license', `Invalid license file pointers: ${badPointers.join(' ')}`, 'License');
			}
			const deprecated = components.filter(c => DeprecatedLicense.test(c));
			if(deprecated.length > 0) {
				add('license', `Deprecated license: ${deprecated.join(' ')}`, 'License');
			}
			const templates = components.filter(c => LicenseTemplates.has(c));
			if(templates.length > 0) {
				add('license', `License components which are templates and need '+ file LICENSE': ${templates.join(', ')}`, 'License');
			}
		}

		/* Authors@R */
		const authorsAtR = val('Authors@R');
		if(authorsAtR !== undefined && authorsAtR !== '' && (val('Author') === undefined || val('Maintainer') === undefined)) {
			const balanced = balancedParentheses(authorsAtR);
			const authors = parseRAuthorString(authorsAtR);
			if(!balanced || !authorsAtR.includes('(')) {
				add('bad-authors-at-r', `Malformed Authors@R field: ${authorsAtR}`, 'Authors@R');
			} else if(authors.length > 0 || /^(c|person)\s*\(/.test(authorsAtR)) {
				const named = authors.filter(a => a.name.length > 0);
				if(!named.some(a => a.roles.length > 0)) {
					add('bad-authors-at-r', 'Authors@R field gives no person with name and roles.', 'Authors@R');
				} else {
					const maintainers = authors.filter(a => a.roles.includes(AuthorRole.Creator));
					if(maintainers.length > 1) {
						add('no-maintainer', 'Authors@R field gives more than one person with maintainer role.', 'Authors@R');
					}
					if(!maintainers.some(a => a.name.length > 0 && a.email)) {
						add('no-maintainer', 'Authors@R field gives no person with maintainer role, valid email address and non-empty name.', 'Authors@R');
					}
					if(config.cranIncoming && !named.some(a => a.roles.includes(AuthorRole.Author))) {
						add('no-author', 'Authors@R field gives no person with name and author role', 'Authors@R');
					}
				}
			}
		}

		/* CRAN incoming style checks */
		if(config.cranIncoming) {
			if(title !== undefined && packageName !== undefined) {
				const flatTitle = flat(title);
				if(flatTitle.toLowerCase() === packageName.toLowerCase()) {
					add('title-is-name', 'The Title field is just the package name: provide a real title.', 'Title');
				} else {
					const escaped = escapeRegex(packageName);
					if(new RegExp(`^${escaped}[ :]`, 'i').test(flatTitle) || /^(A|The) package\b/i.test(flatTitle)) {
						add('title-starts-with-name', 'The Title field starts with the package name.', 'Title');
					}
					const lang = val('Language');
					if(lang === undefined || lang === 'en' || lang.startsWith('en-')) {
						const cased = titleCased(flatTitle);
						if(cased !== flatTitle) {
							add('title-case', `The Title field should be in title case. Current version is: ${quote(flatTitle)} In title case that is: ${quote(cased)}`, 'Title');
						}
					}
				}
			}
			if(description !== undefined && packageName !== undefined) {
				const flatDescription = flat(description);
				const escaped = escapeRegex(packageName);
				const badStart = new RegExp(`^['"]?${escaped}`, 'i').test(flatDescription) || /^(The|This|A|In this|In the) package|^Functions for/.test(flatDescription);
				if(badStart) {
					add('description-start', "The Description field should not start with the package name, 'This package' or similar.", 'Description');
				} else if(!/^['"]?\p{Lu}/u.test(flatDescription)) {
					add('description-initial', 'The Description field should start with a capital letter.', 'Description');
				}
			}
		}
		return { results, '.meta': { hasDescription: true } };
	},
	prettyPrint: MessageAtLocation,
	info:        {
		name:          'Description Metadata',
		tags:          [LintingRuleTag.CmdCheck],
		certainty:     LintingRuleCertainty.BestEffort,
		description:   'Checks the DESCRIPTION: required fields, package name, version, maintainer, dependency fields, license, Authors@R, encoding, and the Title and Description style CRAN asks for.',
		defaultConfig: () => ({
			cranIncoming: true,
			maxDepends:   5,
			maxImports:   0
		})
	}
} as const satisfies LintingRule<DescriptionMetadataResult, DescriptionMetadataMetadata, DescriptionMetadataConfig>;
