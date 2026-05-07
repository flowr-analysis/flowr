import { FlowrAnalyzerBuilder } from '../project/flowr-analyzer-builder';
import { TaintAnalysis } from './builder/taint-analysis';

async function main() {
	const analyzer = await new FlowrAnalyzerBuilder()
		.setEngine('tree-sitter')
		.build();

	analyzer.addRequest(`
		x <- c(1 , 2 , 3 , 4 , 5)
		y <- c(2 , 3 , 4 , 5 , 6)
		x <- scale(x)
		y <- mean(y)
		x > y
`.trim());

	const result = await new TaintAnalysis(analyzer)
		.addPredefined('scale')
		.run();
	console.log(result);
}

void main();