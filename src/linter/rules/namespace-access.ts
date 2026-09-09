import { Identifier } from '../../dataflow/environments/identifier';
import { RSymbol } from '../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import { RType } from '../../r-bridge/lang-4.x/ast/model/type';
import { Q } from '../../search/flowr-search-builder';
import type { MergeableRecord } from '../../util/objects';
import { SourceLocation } from '../../util/range';
import { type LintingResult, type LintingRule, LintingResultCertainty, LintingPrettyPrintContext, LintingRuleCertainty } from '../linter-format';
import { LintingRuleTag } from '../linter-tags';

/** kind of mismatch between the `::`/`:::` written and what the package actually exports */
export type NamespaceAccessKind =
	/** `pkg:::name`, but `name` is exported by `pkg` - `::` already reaches it */
	| 'unnecessary-internal'
	/** `pkg::name`, but `name` is not exported by `pkg` - this throws in R at runtime */
	| 'not-exported';

export interface NamespaceAccessResult extends LintingResult {
	readonly pkg:  string
	readonly name: string
	readonly kind: NamespaceAccessKind
}

export type NamespaceAccessConfig = MergeableRecord;

export interface NamespaceAccessMetadata extends MergeableRecord {
	/** accesses left alone because the database gave no definite exported/not-exported answer */
	unresolved: number
}

/**
 * Cross-checks every `pkg::name`/`pkg:::name` against the signature database's exported bit.
 * An absent entry (unknown package, unresolved version, uncatalogued name) is never read as "not exported" -
 * it only counts toward `.meta.unresolved`. Only a definite record triggers a report:
 *  - `pkg:::name` when the record says it IS exported (`::` would already reach it).
 *  - `pkg::name` when the record says it is NOT exported (fails at runtime in R).
 */
export const NAMESPACE_ACCESS = {
	createSearch:        (_config: NamespaceAccessConfig) => Q.all().filter(RType.Symbol),
	processSearchResult: (elements, _config, data) => {
		const db = data.inspectContext().deps.signatures();
		const results: NamespaceAccessResult[] = [];
		let unresolved = 0;
		if(db.available()) {
			for(const element of elements.getElements()) {
				const node = element.node;
				if(!RSymbol.is(node)) {
					continue;
				}
				const [name, pkg, internal] = Identifier.toArray(node.content);
				if(pkg === undefined) {
					continue;
				}
				// rawFunctionOf skips the exported check - that's exactly what we're cross-checking here
				const raw = db.rawFunctionOf(node.content);
				if(raw === undefined) {
					unresolved++;
					continue;
				}
				const kind: NamespaceAccessKind | undefined = internal === true
					? (raw.exported ? 'unnecessary-internal' : undefined)
					: (raw.exported ? undefined : 'not-exported');
				if(kind === undefined) {
					continue;
				}
				const loc = SourceLocation.fromNode(node);
				if(loc === undefined) {
					continue;
				}
				results.push({
					certainty:  LintingResultCertainty.Certain,
					involvedId: node.info.id,
					loc,
					pkg,
					name,
					kind
				});
			}
		}
		return { results, '.meta': { unresolved } };
	},
	prettyPrint: {
		[LintingPrettyPrintContext.Query]: result =>
			`\`${result.pkg}${result.kind === 'unnecessary-internal' ? ':::' : '::'}${result.name}\` at ${SourceLocation.format(result.loc)}`,
		[LintingPrettyPrintContext.Full]: result => {
			const where = SourceLocation.format(result.loc);
			return result.kind === 'unnecessary-internal'
				? `\`${result.pkg}:::${result.name}\` at ${where} is unnecessary - \`${result.name}\` is exported by \`${result.pkg}\`, so \`${result.pkg}::${result.name}\` already works`
				: `\`${result.pkg}::${result.name}\` at ${where} fails at runtime - \`${result.name}\` is not exported by \`${result.pkg}\` (use \`${result.pkg}:::${result.name}\` if this is intentional)`;
		}
	},
	info: {
		name:          'Namespace Access Validity',
		certainty:     LintingRuleCertainty.BestEffort,
		description:   'Flags `pkg:::name` where `name` is actually exported by `pkg` (so `::` would do), and `pkg::name` where the signature database knows `name` is not exported (which fails at runtime in R). Stays silent whenever the database has no definite answer for the name.',
		tags:          [LintingRuleTag.Bug],
		defaultConfig: () => ({})
	}
} as const satisfies LintingRule<NamespaceAccessResult, NamespaceAccessMetadata, NamespaceAccessConfig>;
