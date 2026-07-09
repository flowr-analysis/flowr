import { describe } from 'vitest';
import { assertLinter } from '../_helper/linter';
import { withTreeSitter } from '../_helper/shell';
import { PkgDatabase } from '../../../src/project/plugins/package-version-plugins/pkgdb';
import { LintingResultCertainty } from '../../../src/linter/linter-format';

//const ggplot2Callable = ['+', 'ggplot', 'aes', 'geom_point', 'geom_line', 'theme_bw', 'coord_cartesian', 'ggsave', 'fortify', 'scale_type'];
/*const namespaceInfo = setCallable(FlowrNamespaceFile.from(new FlowrInlineTextFile('NAMESPACE', `S3method(fortify,data.frame)
S3method(fortify,lm)
S3method(fortify,default)
S3method(fortify,map)
S3method(scale_type,Date)
S3method(scale_type,POSIXt)
S3method(scale_type,character)
S3method(scale_type,numeric)
S3method(scale_type,factor)
S3method(scale_type,default)
S3method(ggplot,default)
S3method(print,ggproto)
S3method(print,rel)
export("+")
export(ggplot)
export(aes)
export(geom_point)
export(geom_line)
export(theme_bw)
export(coord_cartesian)
export(ggsave)
export(fortify)
export(scale_type)
exportPattern("^[^\\\\.]\\\\.*$")
import(grid)
import(rlang)
importFrom(scales,alpha)
importFrom(stats,setNames)`)).content().current, ggplot2Callable);*/

const pkgDatabase = PkgDatabase.fromObject({
	format:  'flowr-pkgdb',
	schema:  4,
	scope:   'latest',
	content: { version: 1, date: '2026-05-23', hash: 'x', generated: 0, packages: 1, versions: 1 },
	strings: [],
	pkgs:    { ggplot2: ['3.5.1', ['ggplot', 'aes', 'geom_point']], random1: ['1.0.0', ['test1', 'test2']] }
});

describe('flowR linter', withTreeSitter(parser => {
	describe('unused import', () => {
		/*test('Several libraries, check env structure', async() => {
				const analyzer = await new FlowrAnalyzerBuilder()
					.setParser(parser)
					.build();
				analyzer.context().deps.addDependency(new Package({
					name:          'ggplot2',
					namespaceInfo: namespaceInfo
				}));
				analyzer.context().deps.addDependency(new Package({
					name:          'random1',
					namespaceInfo: setCallable(FlowrNamespaceFile.from(new FlowrInlineTextFile('NAMESPACE', 'export(test1)\nexport(test2)')).content().current, ['test1', 'test2'])
				}));
				analyzer.addRequest('library(ggplot2)\nlibrary(random1)\nggplot()');
				const df = await analyzer.dataflow();
				const result = await analyzer.query([{
		type:     'linter'
	}
]); console.log(result.linter.results["unused-import"])
			});*/
		assertLinter('a', parser, 'library(ggplot2)', 'unused-import', [
			{
				certainty: LintingResultCertainty.Uncertain,
				loc:       [1, 1, 1, 16],
			},
		], undefined, { pkgDb: pkgDatabase });
	});
}));