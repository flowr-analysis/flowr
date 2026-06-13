import { createNormalizePipeline } from '../../core/steps/pipeline/default-pipelines';
import {
	type ParentInformation,
	type RNodeWithParent
} from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { normalizedAstToMermaid } from '../../util/mermaid/ast';
import { printAsMs } from '../../util/text/time';
import type { KnownParser } from '../../r-bridge/parser';
import { FlowrWikiBaseRef } from './doc-files';
import { contextFromInput } from '../../project/context/flowr-analyzer-context';
import type { RProject } from '../../r-bridge/lang-4.x/ast/model/nodes/r-project';

/**
 * Visualizes the normalized AST using mermaid syntax.
 * This is mainly intended for documentation purposes.
 */
export function printNormalizedAst(ast: RProject<ParentInformation> | RNodeWithParent, prefix = 'flowchart TD\n') {
	return `
\`\`\`mermaid
${normalizedAstToMermaid(ast, { prefix })}
\`\`\`
	`;
}

export interface PrintNormalizedAstOptions {
	readonly showCode?: boolean;
	readonly prefix?:   string;
}

/**
 * Generates and prints the normalized AST for the given code, along with optional metadata and the original code.
 * This is intended for documentation purposes.
 */
export async function printNormalizedAstForCode(parser: KnownParser, code: string, { showCode = true, prefix = 'flowchart TD\n' }: PrintNormalizedAstOptions = {}) {
	const now = performance.now();
	const result = await createNormalizePipeline(parser, {
		context: contextFromInput(code)
	}).allRemainingSteps();
	const duration = performance.now() - now;

	const metaInfo = `The analysis required _${printAsMs(duration)}_ (including parsing with the [${parser.name}](${FlowrWikiBaseRef}/Engines) engine) within the generation environment.`;

	return '\n\n' +  printNormalizedAst(result.normalize.ast, prefix) + (showCode ? `
<details>

<summary style="color:gray">R Code of the Normalized AST</summary>

${metaInfo}

\`\`\`r
${code}
\`\`\`

<details>

<summary style="color:gray">Mermaid Code</summary>

\`\`\`
${normalizedAstToMermaid(result.normalize.ast, { prefix })}
\`\`\`

</details>

</details>

` : '\n(' + metaInfo + ')\n\n')
	;
}
