import type { DatatypeQuery, DatatypeQueryResult } from './datatype-query-format';
import { log } from '../../../util/log';
import type { BasicQueryData } from '../../base-query-format';
import type { NormalizedAst, ParentInformation } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { SlicingCriterion } from '../../../slicing/criterion/parse';
import { SlicingCriterion as SlicingCriterionHelper } from '../../../slicing/criterion/parse';
import { inferDataTypesWithUnification } from '../../../typing/unification/infer';
import { inferDataTypes } from '../../../typing/subtyping/infer';
import type { KnownTypes } from '../../../typing/adapter/known-types';
import { loadTracedTypes, loadTurcotteTypes } from '../../../typing/adapter/load-type-signatures';
import fs from 'fs';
import { superBigJsonStringify } from '../../../util/json';

/**
 * Infers the data types of the requested nodes, see {@link inferDataTypes} and {@link inferDataTypesWithUnification}.
 */
export async function executeDatatypeQuery({ analyzer }: BasicQueryData, queries: readonly DatatypeQuery[]): Promise<DatatypeQueryResult> {
	const start = Date.now();

	const ast = await analyzer.normalize();
	const dataflow = await analyzer.dataflow();
	const ctx = analyzer.inspectContext();

	const result: DatatypeQueryResult['inferredTypes'] = {};
	for(const query of queries) {
		const knownTypes: KnownTypes = new Map();
		if(query.useTurcotteTypes ?? true) {
			await loadTurcotteTypes(knownTypes);
		}
		if(query.useTracedTypes ?? true) {
			await loadTracedTypes(knownTypes);
		}

		const typedAst = query.useSubtyping ?? true
			? inferDataTypes(ast as NormalizedAst<ParentInformation & { typeVariable?: undefined }>, dataflow, ctx, knownTypes)
			: inferDataTypesWithUnification(ast as NormalizedAst<ParentInformation & { typeVariable?: undefined }>, dataflow, ctx);
		for(const criterion of query.criteria ?? typedAst.idMap.keys().map(id => `$${id}` as SlicingCriterion)) {
			if(result[criterion] !== undefined) {
				log.warn('Duplicate criterion in datatype query:', criterion);
				continue;
			}

			const id = SlicingCriterionHelper.tryParse(criterion, typedAst.idMap);
			const node = id !== undefined ? typedAst.idMap.get(id) : undefined;
			if(node === undefined) {
				log.warn('Criterion not found in normalized AST:', criterion);
				continue;
			}

			result[criterion] = node.info.inferredType;
		}
	}

	const output = {
		'.meta':       { timing: Date.now() - start },
		inferredTypes: result
	};

	for(const filePath of queries.map(query => query.outputFile).filter(filePath => filePath !== undefined)) {
		if(fs.existsSync(filePath)) {
			const stream = fs.createWriteStream(filePath, { flags: 'w' });
			superBigJsonStringify(output, '', str => stream.write(str));
			await new Promise<void>((resolve, reject) => {
				stream.end();
				stream.on('error', reject);
				stream.on('finish', resolve);
			});
		} else {
			log.warn('Output file does not exist:', filePath);
		}
	}

	return output;
}
