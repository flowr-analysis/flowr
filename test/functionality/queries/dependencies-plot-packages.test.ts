import { assert, describe, test } from 'vitest';
import { FlowrAnalyzerBuilder } from '../../../src/project/flowr-analyzer-builder';
import { withTreeSitter } from '../_helper/shell';
import { label } from '../_helper/label';
import type { DependencyInfo } from '../../../src/queries/catalog/dependencies-query/dependencies-query-format';

describe('Dependencies Query: plots of further packages', withTreeSitter(parser => {
	async function visualized(code: string): Promise<readonly DependencyInfo[]> {
		const analyzer = await new FlowrAnalyzerBuilder().setParser(parser).build();
		analyzer.addRequest(code);
		return (await analyzer.query([{ type: 'dependencies' }])).dependencies.visualize;
	}
	const fn = (d: DependencyInfo) => Array.isArray(d.functionName) ? d.functionName[0] : d.functionName;

	for(const [pkg, creator] of [
		['ggmirt', 'tracePlot(fit)'],
		['ggmirt', 'itemInfoPlot(fit, facet = TRUE)'],
		['ggmirt', 'itempersonMap(fit)'],
		['ggmirt', 'summaryPlot(fit)'],
		['GGally', 'ggpairs(iris)'],
		['ggstatsplot', 'ggbetweenstats(iris, Species, Sepal.Length)'],
		['ggpubr', 'ggviolin(df, "x", "y")'],
		['sjPlot', 'plot_frq(df$x)'],
		['EnhancedVolcano', 'EnhancedVolcano(res, lab = rownames(res), x = "log2FoldChange", y = "pvalue")'],
		['qgraph', 'qgraph(cor(df))'],
		['semPlot', 'semPaths(fit)'],
		['psych', 'pairs.panels(df)'],
		['mirt', 'itemplot(fit, 1)']
	] as const) {
		const name = creator.slice(0, creator.indexOf('('));
		test(label(`${pkg}::${name} creates a plot`, ['function-calls'], ['other']), async() => {
			for(const code of [`library(${pkg})\n${creator}`, `${pkg}::${creator}`]) {
				const found = (await visualized(code)).filter(d => fn(d) === name);
				assert.lengthOf(found, 1, code);
			}
		});
	}
	test(label('a ggmirt plot takes the ggplot2 addons after it', ['function-calls'], ['other']), async() => {
		const found = await visualized('library(ggmirt)\nlibrary(ggplot2)\ntracePlot(fit) + theme_minimal()');
		assert.sameMembers(found.map(fn), ['tracePlot', 'theme_minimal']);
	});
	test(label('functions of those packages that draw nothing are no plots', ['function-calls'], ['other']), async() => {
		assert.deepStrictEqual(await visualized('library(ggmirt)\nd <- sim_irt(100, 10)\nlibrary(mirt)\nfit <- mirt(d, 1)'), []);
	});
}));
