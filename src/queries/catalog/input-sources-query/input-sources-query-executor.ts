import type { BasicQueryData } from '../../base-query-format';
import type { InputSourcesQuery, InputSourcesQueryResult } from './input-sources-query-format';
import { log } from '../../../util/log';
import { SlicingCriterion } from '../../../slicing/criterion/parse';
import { RFunctionDefinition } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
import { RNode } from '../../../r-bridge/lang-4.x/ast/model/model';
import { Dataflow } from '../../../dataflow/graph/df-helper';
import type { InputClassifierFunctionIdentifier, InputSources } from './simple-input-classifier';
import { classifyInput } from './simple-input-classifier';
import { ReadFunctions } from '../dependencies-query/function-info/read-functions';
import type { ReadonlyFlowrAnalysisProvider } from '../../../project/flowr-analyzer';
import { runSearch } from '../../../search/flowr-search-executor';
import { Q, type FlowrSearchLike } from '../../../search/flowr-search-builder';
import type { Identifier } from '../../../dataflow/environments/identifier';

/**
 * Execute an input sources query
 */
export async function executeInputSourcesQuery({ analyzer }: BasicQueryData, queries: readonly InputSourcesQuery[]): Promise<InputSourcesQueryResult> {
	const start = Date.now();
	const results: Record<string, InputSources> = {};
	const nast = await analyzer.normalize();
	const df = await analyzer.dataflow();

	for(const query of queries) {
		const key = query.criterion;
		if(results[key]) {
			log.warn(`Duplicate key for input-sources query: ${key}, skipping...`);
		}
		const criterionId = SlicingCriterion.tryParse(key, nast.idMap) ?? key;
		const provenanceNode = nast.idMap.get(criterionId);

		const fdef = RFunctionDefinition.rootFunctionDefinition(provenanceNode, nast.idMap);
		const provenance = Dataflow.provenanceGraph(
			criterionId,
			df.graph,
			fdef ? RNode.collectAllIds(fdef) : undefined
		);

		results[key] = classifyInput(criterionId, provenance, {
			fullDfg:    df.graph,
			networkFns: await getInputSourcesFunctions(analyzer, query.config?.networkFns ?? Q.fromQuery({ type: 'linter', rules: ['network-functions'] })),
			randomFns:  await getInputSourcesFunctions(analyzer, query.config?.randomFns ?? Q.fromQuery({ type: 'linter', rules: ['seeded-randomness'] })),
			pureFns:    await getInputSourcesFunctions(analyzer, query.config?.pureFns ?? [
				'paste', 'paste0', 'parse', '+', '-', '*',
				'/', '^', '%%', '%/%', '&', '|', '!', '&&', '||',
				'<', '>', '<=', '>=', '==', '!=', ':',
				'abs', 'sign', 'sqrt', 'exp', 'log', 'log10', 'log2',
				'sin', 'cos', 'tan', 'asin', 'acos', 'atan',
				'length', 'nchar', 'dim', 'nrow', 'ncol',
				'c', 'list', 'data.frame',
				'ifelse', 'switch', 'factor', 'as.factor',
				'round', 'floor', 'ceiling', 'trunc',
				'substr', 'substring', 'strsplit',
				'min', 'max', 'range', 'sum', 'prod', 'mean', 'median', 'var', 'sd',
				'head', 'tail', 'seq', 'rep',
				'apply', 'lapply', 'sapply', 'vapply', 'tapply',
				'matrix', 'array',
				'rownames', 'colnames',
				'list.files', 'tolower', 'toupper', 'printf',
				'<-', '->', '=', '<<-', '->>', 'assign', 'get',
				'[', '[[', '$', 'length<-', 'dim<-', 'names<-', 'colnames<-', 'rownames<-',
				'as.character', 'as.numeric', 'as.logical',  'as.raw',  'as.list', 'as.data.frame', 'as.matrix', 'as.array',
				'identity', 'invisible', 'return', 'force', 'missing',
				'print', 'cat', 'message', 'warning', 'stop',
				'format', 'sprintf', 'formatC',
				'is.na', 'is.null', 'is.numeric', 'is.character',
				'which', 'match', 'order', 'sort', 'unique', 'duplicated', 'na.omit',
				'grep', 'grepl', 'sub', 'gsub', 'regexpr', 'gregexpr', 'regexec', 'regmatches',
				'as.integer', 'as.double', 'as.complex',
				'trimws', 'seq_len', 'seq_along', 'rep.int',
				'pmin', 'pmax', 'cumsum', 'cumprod', 'cummax', 'cummin', 'diff', 'signif',
				'table', 'prop.table', 'xtabs',
				'rbind', 'cbind', 't', 'crossprod', 'tcrossprod',
				'colSums', 'rowSums', 'colMeans', 'rowMeans',
				'solve', 'det', 'eigen',
				'is.factor', 'is.logical', 'is.vector', 'is.matrix', 'is.data.frame',
			]),
			readFileFns: await getInputSourcesFunctions(analyzer, query.config?.readFileFns ?? ReadFunctions.map(f => f.name)),
			systemFns:   await getInputSourcesFunctions(analyzer, query.config?.systemFns ?? ['system', 'system2', 'pipe', 'shell', 'shell.exec']),
			ffiFns:      await getInputSourcesFunctions(analyzer, query.config?.ffiFns ?? ['.C', '.Call', '.Fortran', '.External', 'dyn.load', 'sourceCpp', 'getNativeSymbolInfo']),
			langFns:     await getInputSourcesFunctions(analyzer, query.config?.langFns ?? [
				'substitute', 'quote', 'bquote', 'enquote',
				'enexpr', 'enexprs', 'enquo', 'enquos',
				'expression', 'call', 'as.call', 'as.expression',
				'as.name', 'as.symbol', 'alist', 'as.language', 'evalq',
				'expr', 'quo', 'enexpr', 'ensym', 'ensyms'
			]),
			optionsFns: await getInputSourcesFunctions(analyzer, query.config?.optionsFns ?? ['options', 'getOption', 'Sys.getenv'])
		});
	}

	return ({
		'.meta': {
			timing: Date.now() - start
		},
		results
	} as unknown) as InputSourcesQueryResult;
}

async function getInputSourcesFunctions(analyzer: ReadonlyFlowrAnalysisProvider, entry: readonly Identifier[] | FlowrSearchLike): Promise<readonly InputClassifierFunctionIdentifier[]> {
	if(Array.isArray(entry)) {
		return entry as InputClassifierFunctionIdentifier[];
	}
	const result = await runSearch(entry as FlowrSearchLike, analyzer);

	return result.getElements().map(entry => entry.node.info.id);
}
