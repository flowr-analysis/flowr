import type { RShell } from '../../r-bridge/shell';
import { printDfGraphForCode } from './doc-dfg';
import { codeBlock } from './doc-code';
import { printAsMs } from '../../util/text/time';
import type { FlowrSearchLike } from '../../search/flowr-search-builder';
import { flowrSearchToCode, flowrSearchToMermaid } from '../../search/flowr-search-printer';
import { recoverContent } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { FlowrAnalyzerBuilder } from '../../project/flowr-analyzer-builder';
import { SourceRange } from '../../util/range';

export interface ShowSearchOptions {
	readonly showCode?:       boolean;
	readonly collapseResult?: boolean;
}

/**
 * Visualizes a search and its results in markdown format.
 */
export async function showSearch(shell: RShell, code: string, search: FlowrSearchLike, { collapseResult = true }: ShowSearchOptions = {}): Promise<string> {
	const now = performance.now();
	const analyzer = await new FlowrAnalyzerBuilder()
		.setParser(shell)
		.build();
	analyzer.addRequest(code);
	const result = await analyzer.runSearch(search);
	const duration = performance.now() - now;

	const metaInfo = `
The search required _${printAsMs(duration)}_ (including parsing and normalization and the query) within the generation environment.
	`.trim();

	const dataflow = await analyzer.dataflow();

	return `

${codeBlock('ts', flowrSearchToCode(search))}

<details style="color:gray"> <summary>Search Visualization</summary>

${codeBlock('mermaid', flowrSearchToMermaid(search))}

In the code:

${codeBlock('r', code)}

<details style="color:gray"> <summary>JSON Representation</summary>

${codeBlock('json', JSON.stringify(search, null, 2))}

</details>

</details>


${collapseResult ? ' <details> <summary style="color:gray">Show Results</summary>' : ''}

The query returns the following vetices (all references to \`x\` in the code):
${
	result.getElements().map(({ node }) => `<b>${node.info.id} ('${recoverContent(node.info.id, dataflow.graph)}')</b> at L${SourceRange.format(node.location)}`).join(', ')
}

${metaInfo}

The returned results are highlighted thick and blue within the dataflow graph:

${await printDfGraphForCode(shell, code, { showCode: false, switchCodeAndGraph: false, mark: new Set(result.getElements().map(({ node }) => node.info.id )) } )}


${collapseResult ? '</details>' : ''}

	`;
}
