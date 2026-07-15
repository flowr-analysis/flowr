import {
	LintingPrettyPrintContext,
	type LintingResult,
	LintingResultCertainty,
	type LintingRule,
	LintingRuleCertainty
} from '../linter-format';
import type { MergeableRecord } from '../../util/objects';
import { Q } from '../../search/flowr-search-builder';
import { SourceLocation } from '../../util/range';
import { LintingRuleTag } from '../linter-tags';
import { isVariableDefinitionVertex, VertexType } from '../../dataflow/graph/vertex';
import { DfEdge, EdgeType } from '../../dataflow/graph/edge';
import { RString } from '../../r-bridge/lang-4.x/ast/model/nodes/r-string';

const defaultCredentialNamePattern =
	'(?:password|passwd|pwd|secret|api[_.]?key|api[_.]?token|access[_.]?token|auth[_.]?token|bearer[_.]?token|private[_.]?key|credential)';

const defaultCredentialValuePattern =
	'^(?:AKIA|AIPA|ASIA|AROA)[A-Z0-9]{16}'   + // AWS access key IDs (exact 20-char format)
	'|^gh[psoar]_[A-Za-z0-9_]{10,}'          + // GitHub Classic/App/OAuth/Actions tokens
	'|^github_pat_[A-Za-z0-9_]{10,}'         + // GitHub fine-grained PATs
	'|^glpat-[A-Za-z0-9_-]{20}'              + // GitLab Personal Access Tokens (fixed length)
	'|^xox[baprs]-[0-9A-Za-z]{10,}'          + // Slack tokens (xoxb-, xoxp-, xoxa-, xoxr-, xoxs-)
	'|^sk_(?:live|test)_[A-Za-z0-9]{24}'     + // Stripe secret/test keys (length-anchored)
	'|^rk_live_[A-Za-z0-9]{24}'              + // Stripe restricted keys (length-anchored)
	'|^npm_[A-Za-z0-9]{36}'                  + // npm access tokens (fixed length)
	'|^shp(?:at|ss|pa|ca)_[A-Za-z0-9]{32}'   + // Shopify Admin/Shared/Private/Custom tokens
	'|^sk-ant-[A-Za-z0-9_-]{10,}'            + // Anthropic API keys
	'|^sk-proj-[A-Za-z0-9_-]{10,}'           + // OpenAI project API keys
	'|^SG\\.[A-Za-z0-9_-]{22}\\.'            + // SendGrid API keys (structured format)
	'|^-----BEGIN(?:\\s[A-Z]+)* PRIVATE KEY';  // PEM private keys (RSA, EC, DSA, OpenSSH, etc.)

export interface NoLeakedCredentialsResult extends LintingResult {
	readonly variableName: string
}

export interface NoLeakedCredentialsConfig extends MergeableRecord {
	/** Pattern matched (case-insensitively) against variable names to identify potential credential assignments */
	readonly credentialNamePattern:  string
	/** Pattern matched against string literal values to detect known credential formats (e.g., AWS access key IDs, GitHub tokens) */
	readonly credentialValuePattern: string
}

export interface NoLeakedCredentialsMetadata extends MergeableRecord {
	readonly totalChecked: number
}

export const NO_LEAKED_CREDENTIALS = {
	createSearch:        () => Q.all().filter(VertexType.VariableDefinition),
	processSearchResult: async(elements, config, data): Promise<{ results: NoLeakedCredentialsResult[], '.meta': NoLeakedCredentialsMetadata }> => {
		const namePattern  = new RegExp(config.credentialNamePattern, 'i');
		const valuePattern = new RegExp(config.credentialValuePattern);
		const normalize = await data.normalize();
		const dfg = (await data.dataflow()).graph;
		let totalChecked = 0;

		const results = elements.getElements().flatMap(element => {
			totalChecked++;
			const name   = element.node.lexeme ?? '';
			const vertex = dfg.getVertex(element.node.info.id);
			if(!isVariableDefinitionVertex(vertex)) {
				return [];
			}
			const nameMatches = namePattern.test(name);
			for(const [targetId, edge] of dfg.outgoingEdges(element.node.info.id) ?? []) {
				if(!DfEdge.includesType(edge, EdgeType.DefinedBy)) {
					continue;
				}
				const targetNode = normalize.idMap.get(targetId);
				if(targetNode && RString.is(targetNode) && (nameMatches || valuePattern.test(targetNode.content.str))) {
					return [{
						certainty:    LintingResultCertainty.Uncertain,
						involvedId:   element.node.info.id,
						variableName: name,
						loc:          SourceLocation.fromNode(element.node) ?? SourceLocation.invalid()
					}];
				}
			}
			return [];
		});

		return { results, '.meta': { totalChecked } };
	},
	prettyPrint: {
		[LintingPrettyPrintContext.Query]: (result: NoLeakedCredentialsResult) =>
			`Possible hardcoded credential in \`${result.variableName}\` at ${SourceLocation.format(result.loc)}`,
		[LintingPrettyPrintContext.Full]: (result: NoLeakedCredentialsResult) =>
			`Variable \`${result.variableName}\` at ${SourceLocation.format(result.loc)} appears to contain a hardcoded credential`
	},
	info: {
		name:          'No Leaked Credentials',
		description:   'Detects hardcoded credentials assigned to variables whose names suggest they hold passwords, tokens, or API keys, or whose values match known credential formats (AWS, GitHub, Slack, Stripe, SSH).',
		tags:          [LintingRuleTag.Security, LintingRuleTag.Experimental, LintingRuleTag.Smell],
		certainty:     LintingRuleCertainty.BestEffort,
		defaultConfig: {
			credentialNamePattern:  defaultCredentialNamePattern,
			credentialValuePattern: defaultCredentialValuePattern
		}
	}
} as const satisfies LintingRule<NoLeakedCredentialsResult, NoLeakedCredentialsMetadata, NoLeakedCredentialsConfig>;
