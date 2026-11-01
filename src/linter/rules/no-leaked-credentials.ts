import { prettyPrint, type LintingResult, LintingResultCertainty, type LintingRule, LintingRuleCertainty } from '../linter-format';
import type { MergeableRecord } from '../../util/objects';
import { Q } from '../../search/flowr-search-builder';
import { SourceLocation } from '../../util/range';
import { LintingRuleTag } from '../linter-tags';
import { DfgVertex, VertexType } from '../../dataflow/graph/vertex';
import { EdgeType } from '../../dataflow/graph/edge';
import type { DataflowGraph } from '../../dataflow/graph/graph';
import { RNode } from '../../r-bridge/lang-4.x/ast/model/model';
import { RAccess } from '../../r-bridge/lang-4.x/ast/model/nodes/r-access';
import { RArgument } from '../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { RFunctionCall, EmptyArgument } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { RFunctionDefinition } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
import type { AstIdMap, ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { Identifier } from '../../dataflow/environments/identifier';
import { RString } from '../../r-bridge/lang-4.x/ast/model/nodes/r-string';
import { Dataflow } from '../../dataflow/graph/df-helper';

const defaultCredentialNamePattern =
	'(?:passw(?:or)?d|authorization|passphrase|(?:^|[_.])pass(?:$|[_.])|pwd|secret|api[_.]?key|access[_.]?key|(?:^|[_.])token$|api[_.]?token|access[_.]?token|auth[_.]?token|bearer[_.]?token|private[_.]?key|credential|(?:^|[_.])pat$)';

const defaultCredentialCallPattern = '(?:auth|login|signin|credential|password|secret|token|key_?set)';

const defaultCredentialValuePattern =
	'(?:(?<![A-Za-z0-9_])|(?<=\\\\[nrt]))(?:' +
	'(?:AKIA|AIPA|ASIA|AROA)[A-Z0-9]{16}'          + // AWS access key IDs (exact 20-char format)
	'|gh[psoar]_[A-Za-z0-9_]{10,}'                 + // GitHub Classic/App/OAuth/Actions tokens
	'|github_pat_[A-Za-z0-9_]{10,}'                + // GitHub fine-grained PATs
	'|glpat-[A-Za-z0-9_-]{20}'                     + // GitLab Personal Access Tokens (fixed length)
	'|xox[baprs]-[0-9A-Za-z]{10,}'                 + // Slack tokens (xoxb-, xoxp-, xoxa-, xoxr-, xoxs-)
	'|sk_(?:live|test)_[A-Za-z0-9]{24}'            + // Stripe secret/test keys (length-anchored)
	'|rk_live_[A-Za-z0-9]{24}'                     + // Stripe restricted keys (length-anchored)
	'|npm_[A-Za-z0-9]{36}'                         + // npm access tokens (fixed length)
	'|shp(?:at|ss|pa|ca)_[A-Za-z0-9]{32}'          + // Shopify Admin/Shared/Private/Custom tokens
	'|sk-ant-[A-Za-z0-9_-]{10,}'                   + // Anthropic API keys
	'|sk-(?:proj-)?[A-Za-z0-9_-]{20,}'             + // OpenAI API keys
	'|SG\\.[A-Za-z0-9_-]{22}\\.'                   + // SendGrid API keys (structured format)
	'|AIza[0-9A-Za-z_-]{35}'                       + // Google API keys
	'|hf_[A-Za-z0-9]{30,}'                         + // Hugging Face tokens
	'|eyJ[A-Za-z0-9_-]{10,}\\.eyJ[A-Za-z0-9_-]{10,}\\.' + // JSON web tokens
	'|[a-z][a-z0-9+.-]*://[^/\\s:@]+:[^/\\s@]+@'      + // URLs with an embedded user and password
	'|-----BEGIN(?:\\s[A-Z]+)* PRIVATE KEY'            + // PEM private keys (RSA, EC, DSA, OpenSSH, etc.)
	')';

/** what a credential-like name holds without leaking anything: a placeholder, or a path or link to look the secret up */
const NoCredentialValue = /^(?:<[^>]*>|\{\{.*\}\}|\$\{.*\}|your[_ -].*|x+|\*+|\.{3}|changeme|placeholder|dummy|(?:~|\.{0,2})\/.*|[a-z]+:\/\/[^@]*|(?:bearer|basic|token)\s*)$/i;

/** what a function asking for a credential is handed instead: a prompt, not the secret */
const PromptValue = /\s|[:?]$/;

/** names that only describe a credential: the label, prompt, or pattern of a password, the variable or file holding a key */
const NoCredentialName = /[_.](?:label|prompt|pattern|regex|env|var|file|path|dir|url|name|field|col|msg|message|text|title|hint|length|policy)$/i;

/** how many assignments a literal is followed through to the name or argument it ends up in */
const MaxCredentialHops = 3;

export interface NoLeakedCredentialsResult extends LintingResult {
	readonly variableName: string
}

export interface NoLeakedCredentialsConfig extends MergeableRecord {
	/** Pattern matched (case-insensitively) against variable names to identify potential credential assignments */
	readonly credentialNamePattern:  string
	/** Pattern matched against string literal values to detect known credential formats (e.g., AWS access key IDs, GitHub tokens) */
	readonly credentialValuePattern: string
	/** Pattern matched (case-insensitively) against function names whose unnamed arguments are credentials, like `httr::authenticate` */
	readonly credentialCallPattern:  string
}

export interface NoLeakedCredentialsMetadata extends MergeableRecord {
	/** the number of string literals checked */
	readonly totalChecked: number
}

interface CredentialContext {
	readonly name:      string
	readonly anchor:    RNode<ParentInformation>
	/** the literal is the last unnamed argument, where `authenticate` and the like take the secret */
	readonly handedTo?: boolean
}

/** the name of a defined variable, with the fields of an access it is written through (`cfg$password`) */
function definedName(node: RNode<ParentInformation>, idMap: AstIdMap): string {
	let name = node.lexeme ?? '';
	for(const parent of RNode.iterateParents(node, idMap)) {
		if(!RAccess.is(parent)) {
			break;
		}
		for(const arg of parent.access) {
			if(arg !== EmptyArgument && arg.value !== undefined) {
				name += '$' + (RString.is(arg.value) ? arg.value.content.str : arg.value.lexeme ?? '');
			}
		}
	}
	return name;
}

class CredentialContexts {
	constructor(private readonly dfg: DataflowGraph, private readonly idMap: AstIdMap, private readonly callPattern: RegExp, private readonly namePattern: RegExp, private readonly pure: ReadonlySet<string>) {}

	/** the variables, arguments, or credential-taking functions a literal ends up in, followed through up to {@link MaxCredentialHops} uses */
	public of(node: RNode<ParentInformation>, hops = 0, seen = new Set<NodeId>()): CredentialContext[] {
		const found: CredentialContext[] = [];
		let child = node;
		for(const current of [node, ...RNode.iterateParents(node, this.idMap)]) {
			if(RFunctionDefinition.is(current)) {
				break;
			}
			const fn = RFunctionCall.calledName(current) ?? '';
			const name = Identifier.getName(fn);
			/* only a value built from its arguments carries a literal on to where it is assigned, `assign` assigns its own */
			const opaque = RFunctionCall.is(current) && RArgument.is(child) && !this.pure.has(Identifier.getNamespace(fn) === undefined ? name : Identifier.toString(fn));
			for(const def of Dataflow.sourcesOf(this.dfg, current.info.id, EdgeType.DefinedBy)) {
				const defNode = this.idMap.get(def);
				if(defNode !== undefined && DfgVertex.isVariableDefinition(this.dfg.getVertex(def)) && !seen.has(def) && (!opaque || RNode.iterateParents(defNode, this.idMap).some(p => p === current))) {
					seen.add(def);
					found.push({ name: definedName(defNode, this.idMap), anchor: defNode }, ...this.usesOf(def, hops, seen));
				}
			}
			if(RArgument.isNamed(current) && current !== node) {
				found.push({ name: current.name.lexeme, anchor: current.name });
				return found;
			} else if(RFunctionCall.is(current) && child === current.arguments.findLast(a => a !== EmptyArgument && a.name === undefined) && this.callPattern.test(name)
				/* a secret handed by name (`key_set_with_value(service, password = ...)`) leaves the unnamed ones to say what it is for */
				&& !current.arguments.some(a => a !== EmptyArgument && a.name !== undefined && this.namePattern.test(a.name.lexeme))) {
				found.push({ name, anchor: current, handedTo: true });
			}
			if(opaque) {
				return found;
			}
			child = current;
		}
		return found;
	}

	private usesOf(def: NodeId, hops: number, seen: Set<NodeId>): CredentialContext[] {
		return hops >= MaxCredentialHops ? [] : Dataflow.sourcesOf(this.dfg, def, EdgeType.Reads).flatMap(r => {
			const reader = this.idMap.get(r);
			return reader === undefined ? [] : this.of(reader, hops + 1, seen);
		});
	}
}

export const NO_LEAKED_CREDENTIALS = {
	createSearch:        () => Q.all().filter(VertexType.Value),
	processSearchResult: async(elements, config, data): Promise<{ results: NoLeakedCredentialsResult[], '.meta': NoLeakedCredentialsMetadata }> => {
		const namePattern  = new RegExp(config.credentialNamePattern, 'i');
		const valuePattern = new RegExp(config.credentialValuePattern);
		const normalize = await data.normalize();
		const dfg = (await data.dataflow()).graph;
		const contexts = new CredentialContexts(dfg, normalize.idMap, new RegExp(config.credentialCallPattern, 'i'), namePattern,
			new Set(data.inspectContext().env.builtInIndex.pure.flatMap(p => [Identifier.getName(p), Identifier.toString(p)])));
		let totalChecked = 0;
		const results = new Map<NodeId, NoLeakedCredentialsResult>();
		for(const element of elements.getElements()) {
			const node = element.node;
			if(!RString.is(node)) {
				continue;
			}
			totalChecked++;
			if(DfgVertex.isVariableDefinition(dfg.getVertex(node.info.id))) {
				continue;
			}
			const value = node.content.str;
			const named = contexts.of(node);
			/* a credential-like name only leaks a real value, a credential-like value leaks under any name */
			const leaking = valuePattern.test(value) ? named[0] ?? { name: '', anchor: node }
				: value === '' || NoCredentialValue.test(value) ? undefined
					: named.find(c => c.handedTo ? !PromptValue.test(value) : namePattern.test(c.name) && !NoCredentialName.test(c.name));
			if(leaking !== undefined && !results.has(leaking.anchor.info.id)) {
				results.set(leaking.anchor.info.id, {
					certainty:    LintingResultCertainty.Uncertain,
					involvedId:   leaking.anchor.info.id,
					variableName: leaking.name,
					loc:          SourceLocation.fromNode(leaking.anchor) ?? SourceLocation.invalid()
				});
			}
		}
		return { results: [...results.values()], '.meta': { totalChecked } };
	},
	prettyPrint: prettyPrint(
		(result: NoLeakedCredentialsResult) =>
			`Possible hardcoded credential in \`${result.variableName}\` at ${SourceLocation.format(result.loc)}`,
		(result: NoLeakedCredentialsResult) =>
			`Variable \`${result.variableName}\` at ${SourceLocation.format(result.loc)} appears to contain a hardcoded credential`
	),
	info: {
		name:          'No Leaked Credentials',
		description:   'Finds hardcoded credentials assigned to variables or passed as arguments whose names suggest they hold passwords, tokens, or API keys, handed to authentication functions, or whose values match known credential formats (AWS, GitHub, Slack, Stripe, Google, JWT, SSH, URLs with passwords).',
		tags:          [LintingRuleTag.Security, LintingRuleTag.Experimental, LintingRuleTag.Smell],
		certainty:     LintingRuleCertainty.BestEffort,
		defaultConfig: () => ({
			credentialNamePattern:  defaultCredentialNamePattern,
			credentialValuePattern: defaultCredentialValuePattern,
			credentialCallPattern:  defaultCredentialCallPattern
		})
	}
} as const satisfies LintingRule<NoLeakedCredentialsResult, NoLeakedCredentialsMetadata, NoLeakedCredentialsConfig>;
