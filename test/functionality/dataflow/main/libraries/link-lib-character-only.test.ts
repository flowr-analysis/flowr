import { describe } from 'vitest';
import { assertDataflow, withTreeSitter } from '../../../_helper/shell';
import { Package } from '../../../../../src/project/plugins/package-version-plugins/package';
import { EdgeType } from '../../../../../src/dataflow/graph/edge';
import { FlowrNamespaceFile, setCallable } from '../../../../../src/project/plugins/file-plugins/files/flowr-namespace-file';
import { FlowrInlineTextFile } from '../../../../../src/project/context/flowr-file';
import { emptyGraph } from '../../../../../src/dataflow/graph/dataflowgraph-builder';
import { NodeId } from '../../../../../src/r-bridge/lang-4.x/ast/model/processing/node-id';
import { label } from '../../../_helper/label';

const ggplot2Callable = ['+', 'ggplot', 'aes', 'geom_point', 'geom_line', 'theme_bw', 'coord_cartesian', 'ggsave', 'fortify', 'scale_type'];
const namespaceInfo = setCallable(FlowrNamespaceFile.from(new FlowrInlineTextFile('NAMESPACE', `S3method(fortify,data.frame)
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
importFrom(stats,setNames)`)).content().current, ggplot2Callable);

describe('Link libraries with character.only', withTreeSitter(ts => {
	assertDataflow(label('Link with variable'), ts, 'x <- "ggplot2"\nlibrary(x, character.only = TRUE)\nggplot()\nggplot()',
		emptyGraph()
		//reads character.only
			.addEdge('2@library', '2@character.only', EdgeType.Argument)
			.addEdge('2@character.only', '2@TRUE', EdgeType.Reads)
		//ggplot links to library
			.addEdge('3@ggplot', NodeId.toBuiltIn('ggplot'), EdgeType.Reads | EdgeType.Calls)
			.addEdge('4@ggplot', NodeId.toBuiltIn('ggplot'), EdgeType.Reads | EdgeType.Calls)
			.addEdge(NodeId.toBuiltIn('ggplot'), '2@library', EdgeType.Reads | EdgeType.Calls),
		{
			modifyAnalyzer: a => {
				a.context().deps.addDependency(new Package({
					name:          'ggplot2',
					namespaceInfo: namespaceInfo
				}));
			},
			expectIsSubgraph:      true,
			resolveIdsAsCriterion: true
		}
	);
	/*assertDataflow(label('Link usually'), ts, 'library(ggplot2, character.only = FALSE)\nggplot()\nggplot()',
		emptyGraph()
		//reads character.only
			.addEdge('1@library', '1@character.only', EdgeType.Argument)
			.addEdge('1@character.only', '1@FALSE', EdgeType.Reads)
		//correctly links
			.addEdge('2@ggplot', NodeId.toBuiltIn('ggplot'), EdgeType.Reads | EdgeType.Calls)
			.addEdge('3@ggplot', NodeId.toBuiltIn('ggplot'), EdgeType.Reads | EdgeType.Calls)
			.addEdge(NodeId.toBuiltIn('ggplot'), '1@library', EdgeType.Reads | EdgeType.Calls),
		{
			modifyAnalyzer: a => {
				a.context().deps.addDependency(new Package({
					name:          'ggplot2',
					namespaceInfo: namespaceInfo
				}));
			},
			expectIsSubgraph:      true,
			resolveIdsAsCriterion: true
		}
	);
	assertDataflow(label('link with string value'), ts, 'library("ggplot2", character.only = TRUE)\nggplot()\nggplot()',
		emptyGraph()
		//reads character.only
			.addEdge('1@library', '1@character.only', EdgeType.Argument)
			.addEdge('1@character.only', '1@TRUE', EdgeType.Reads)
		//correctly links
			.addEdge('2@ggplot', NodeId.toBuiltIn('ggplot'), EdgeType.Reads | EdgeType.Calls)
			.addEdge('3@ggplot', NodeId.toBuiltIn('ggplot'), EdgeType.Reads | EdgeType.Calls)
			.addEdge(NodeId.toBuiltIn('ggplot'), '1@library', EdgeType.Reads | EdgeType.Calls),
		{
			modifyAnalyzer: a => {
				a.context().deps.addDependency(new Package({
					name:          'ggplot2',
					namespaceInfo: namespaceInfo
				}));
			},
			expectIsSubgraph:      true,
			resolveIdsAsCriterion: true
		}
	);*/
}));