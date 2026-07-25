import type { BasicQueryData } from '../../base-query-format';
import { DefaultInputClassifierConfig, type InputSourcesQuery, type InputSourcesQueryResult } from './input-sources-query-format';
import { log } from '../../../util/log';
import { SlicingCriterion } from '../../../slicing/criterion/parse';
import { RFunctionDefinition } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
import { RNode } from '../../../r-bridge/lang-4.x/ast/model/model';
import { Dataflow } from '../../../dataflow/graph/df-helper';
import type { InputClassifierConfig, InputClassifierFunctionIdentifiers, InputSources } from './simple-input-classifier';
import { classifyInput } from './simple-input-classifier';
import type { ReadonlyFlowrAnalysisProvider } from '../../../project/flowr-analyzer';
import { runSearch } from '../../../search/flowr-search-executor';
import type { FlowrSearchLike } from '../../../search/flowr-search-builder';
import { Record } from '../../../util/record';
import { Identifier } from '../../../dataflow/environments/identifier';
import { AttachedBasePackages } from '../../../util/r-base-packages';
import type { REnvironmentInformation } from '../../../dataflow/environments/environment';
import { REnvironment } from '../../../dataflow/environments/environment';

/**
 * Execute an input sources query
 */
export async function executeInputSourcesQuery({ analyzer }: BasicQueryData, queries: readonly InputSourcesQuery[]): Promise<InputSourcesQueryResult> {
	const start = Date.now();
	const results: Record<string, InputSources> = {};
	const nast = await analyzer.normalize();
	const df = await analyzer.dataflow();
	// flowR's defaults, extended by whatever the (possibly project-kind specialized) configuration adds
	const defaultConfig = addAll(
		await resolveSearches(analyzer, DefaultInputClassifierConfig),
		await resolveSearches(analyzer, analyzer.inspectContext().config.inputSources ?? {})
	);
	const packages = attachedPackages(analyzer, df.environment);

	for(const query of queries) {
		const criteria: readonly SlicingCriterion[] = Array.isArray(query.criterion)
			? (query.criterion as readonly SlicingCriterion[])
			: [(query.criterion as SlicingCriterion)];
		const config = { ...defaultConfig, ...(await resolveSearches(analyzer, query.config ?? {})) };

		for(const criterion of criteria) {
			if(results[criterion]) {
				log.warn(`Duplicate key for input-sources query: ${criterion}, skipping...`);
				continue;
			}
			const criterionId = SlicingCriterion.tryParse(criterion, nast.idMap) ?? criterion;
			const provenanceNode = nast.idMap.get(criterionId);
			const fdef = RFunctionDefinition.rootFunctionDefinition(provenanceNode, nast.idMap);
			const provenance = Dataflow.provenanceGraph(
				criterionId,
				df.graph,
				fdef ? RNode.collectAllIds(fdef) : undefined
			);
			results[criterion] = classifyInput(criterionId, provenance, config, df.graph, packages);
		}
	}

	return {
		'.meta': {
			timing: Date.now() - start
		},
		results
	};
}

/**
 * The packages whose exports are usable without a namespace: those R has on its search path at the end of the
 * program, the ones the project declares, and the base packages R attaches on startup.
 */
function attachedPackages(analyzer: ReadonlyFlowrAnalysisProvider, environment: REnvironmentInformation): ReadonlySet<string> {
	return new Set([
		...REnvironment.attachedPackages(environment.current),
		...analyzer.inspectContext().deps.getDependencies().map(d => d.name),
		...AttachedBasePackages
	]);
}

/** every entry of `extra` appended to the matching list of `base`, so configured entries extend the defaults instead of replacing them */
function addAll(base: InputClassifierConfig<InputClassifierFunctionIdentifiers>, extra: InputClassifierConfig<InputClassifierFunctionIdentifiers>): InputClassifierConfig<InputClassifierFunctionIdentifiers> {
	const result = { ...base };
	for(const [key, value] of Record.entries(extra)) {
		if(value !== undefined) {
			result[key] = [...(base[key] ?? []), ...value] as never;
		}
	}
	return result;
}

async function resolveSearches(analyzer: ReadonlyFlowrAnalysisProvider, config: InputClassifierConfig): Promise<InputClassifierConfig<InputClassifierFunctionIdentifiers>> {
	const result: InputClassifierConfig<InputClassifierFunctionIdentifiers> = {};
	if(config.linkedObjects !== undefined) {
		result.linkedObjects = config.linkedObjects;
	}
	if(config.linkedEntryPoints !== undefined) {
		result.linkedEntryPoints = config.linkedEntryPoints;
	}

	for(const [key, value] of Record.entries(config)) {
		if(key === 'linkedObjects' || key === 'linkedEntryPoints') {
			continue;
		} else if(value === undefined || Array.isArray(value)) {
			// entries may be written as `pkg::fn` strings in the configuration, which only mean the namespaced function once parsed
			result[key] = (value as InputClassifierFunctionIdentifiers | undefined)?.map(e => typeof e === 'string' ? Identifier.parse(e) : e);
		} else {
			const searchResult = await runSearch(value as FlowrSearchLike, analyzer);
			result[key] = searchResult.getElements().map(element => element.node.info.id);
		}
	}
	return result;
}
