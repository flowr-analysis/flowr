import { uniqueArray } from '../../../util/collections/arrays';
import { type LintingRule, LintingRuleCertainty, type LintQuickFix } from '../../linter-format';
import type { MergeableRecord } from '../../../util/objects';
import { Q } from '../../../search/flowr-search-builder';
import { FlowrFilterCombinator } from '../../../search/flowr-search-filters';
import { RType } from '../../../r-bridge/lang-4.x/ast/model/type';
import { LintingRuleTag } from '../../linter-tags';
import { SourceLocation } from '../../../util/range';
import type { ParentInformation } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { RString } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-string';
import { RSymbol } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import { Identifier } from '../../../dataflow/environments/identifier';
import { at, type CmdCheckResult, packageInfo, printer } from './cmd-check-util';
import { packageFiles } from './package-files';

export interface NonAsciiCodeResult extends CmdCheckResult {
	/** whether a string literal, a symbol (identifier, function or parameter name), or a line of the NAMESPACE file holds the characters */
	readonly kind:       'string' | 'symbol' | 'namespace'
	/** the distinct non-ASCII characters the token contains */
	readonly characters: readonly string[]
}

export interface NonAsciiCodeConfig extends MergeableRecord {
	/** report string literals holding non-ASCII characters (default `true`, as `R CMD check` does) */
	readonly checkStrings: boolean
	/** report symbols holding non-ASCII characters (default `true`, as `R CMD check` does) */
	readonly checkSymbols: boolean
}

export interface NonAsciiCodeMetadata extends MergeableRecord {
	/** string literals and symbols inspected */
	readonly consideredTokens: number
}

/** the distinct characters of `text` outside the ASCII range, by code point */
function nonAsciiCharacters(text: string): string[] {
	return uniqueArray([...text].filter(c => (c.codePointAt(0) ?? 0) > 0x7f));
}

/** `\uXXXX` for code points up to U+FFFF, `\U{XXXXX}` above */
function escape(char: string): string {
	const cp = char.codePointAt(0) ?? 0;
	return cp > 0xffff ? `\\U{${cp.toString(16)}}` : `\\u${cp.toString(16).padStart(4, '0')}`;
}

/** the quick fix escaping the non-ASCII characters of a string literal, keeping its quotes (raw strings cannot escape) */
function quickFixFor(node: RString<ParentInformation>): LintQuickFix[] | undefined {
	const { str, quotes, flag } = node.content;
	const loc = SourceLocation.fromNode(node);
	if(flag === 'raw' || quotes === 'none' || loc === undefined) {
		return undefined;
	}
	const body = [...str].map(c => (c.codePointAt(0) ?? 0) > 0x7f ? escape(c) : c).join('');
	const replacement = `${quotes}${body}${quotes}`;
	return [{ type: 'replace', description: 'Escape the non-ASCII characters', replacement, loc }];
}

/**
 * Port of the `R CMD check` note "Found the following file with non-ASCII characters", from the check
 * "checking code files for non-ASCII characters". Portable packages must use only ASCII in their R code outside
 * of comments. Unlike the check, which only names the file, each offending string literal and symbol is reported
 * with its characters. Comments and roxygen documentation are ignored, and so is code outside the R folder.
 * The NAMESPACE file is inspected line by line, outside of comments, as `R CMD check` does.
 */
export const NON_ASCII_CODE = {
	createSearch:        () => Q.all().filter(FlowrFilterCombinator.or(RType.String, RType.Symbol)),
	processSearchResult: (elements, config, data) => {
		const pkg = packageInfo(data.inspectContext());
		let considered = 0;
		const results: NonAsciiCodeResult[] = [];
		for(const { node } of elements.getElements()) {
			if(!pkg.isPackageCode(node.info.file) || !(RString.is(node) ? config.checkStrings : config.checkSymbols)) {
				continue;
			}
			considered++;
			const loc = SourceLocation.fromNode(node);
			if(loc === undefined) {
				continue;
			}
			if(RString.is(node)) {
				const characters = nonAsciiCharacters(node.content.str);
				if(characters.length > 0) {
					results.push({
						...at(node),
						kind:     'string',
						characters,
						message:  `Non-ASCII characters in string literal (${characters.join(', ')}), use \\uxxxx escapes instead`,
						quickFix: quickFixFor(node)
					});
				}
			} else if(RSymbol.is(node)) {
				const characters = nonAsciiCharacters(Identifier.getName(node.content));
				if(characters.length > 0) {
					results.push({
						...at(node),
						kind:    'symbol',
						characters,
						message: `Non-ASCII characters in symbol name (${characters.join(', ')}), use ASCII only`
					});
				}
			}
		}
		const ctx = data.inspectContext();
		const files = packageFiles(ctx, pkg.name);
		const namespace = files?.read('NAMESPACE');
		if(files !== undefined && namespace !== undefined) {
			for(const [i, line] of namespace.split(/\r?\n/).entries()) {
				const characters = nonAsciiCharacters(line.replace(/#.*$/, ''));
				if(characters.length > 0) {
					results.push({
						...at(files.locate('NAMESPACE', i + 1)),
						kind:    'namespace',
						characters,
						message: `Non-ASCII characters in the NAMESPACE file (${characters.join(', ')}), use ASCII only`
					});
				}
			}
		}
		return { results, '.meta': { consideredTokens: considered } };
	},
	prettyPrint: printer<NonAsciiCodeResult>(r => `non-ASCII ${r.kind} ${JSON.stringify(r.characters)}`),
	info:        {
		name:          'Non-ASCII Code',
		tags:          [LintingRuleTag.CmdCheck, LintingRuleTag.QuickFix],
		certainty:     LintingRuleCertainty.BestEffort,
		description:   'Finds non-ASCII characters in R code and the NAMESPACE outside of comments. Offers `\\u` escapes for strings as a quick fix.',
		defaultConfig: () => ({
			checkStrings: true,
			checkSymbols: true
		})
	}
} as const satisfies LintingRule<NonAsciiCodeResult, NonAsciiCodeMetadata, NonAsciiCodeConfig>;
