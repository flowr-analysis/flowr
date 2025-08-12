import type { DatatypeQuery, DatatypeQueryResult } from './datatype-query-format';
import { log } from '../../../util/log';
import type { BasicQueryData } from '../../base-query-format';
import type { NormalizedAst, ParentInformation } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { SingleSlicingCriterion } from '../../../slicing/criterion/parse';
import { slicingCriterionToId } from '../../../slicing/criterion/parse';
import { inferDataTypesWithUnification } from '../../../typing/unification/infer';
import { inferDataTypes } from '../../../typing/subtyping/infer';
import type { UnresolvedDataType } from '../../../typing/subtyping/types';
import { loadTracedTypes, loadTurcotteTypes } from '../../../typing/adapter/load-type-signatures';
import fs from 'fs';
import { superBigJsonStringify } from '../../../util/json';

export async function executeDatatypeQuery({ dataflow, ast }: BasicQueryData, queries: readonly DatatypeQuery[]): Promise<DatatypeQueryResult> {
	const start = Date.now();

	const result: DatatypeQueryResult['inferredTypes'] = {};
	for(const query of queries) {
		const knownTypes = new Map<string, Set<UnresolvedDataType>>();
		if(query.useTurcotteTypes ?? true) {
			await loadTurcotteTypes(knownTypes);
		}
		if(query.useTracedTypes ?? true) {
			await loadTracedTypes(knownTypes);
		}

		const typedAst = query.useSubtyping ?? true
			? inferDataTypes(ast as NormalizedAst<ParentInformation & { typeVariable?: undefined }>, dataflow, knownTypes)
			: inferDataTypesWithUnification(ast as NormalizedAst<ParentInformation & { typeVariable?: undefined }>, dataflow);
		for(const criterion of query.criteria ?? typedAst.idMap.keys().map(id => `$${id}` as SingleSlicingCriterion)) {
			if(result[criterion] !== undefined) {
				log.warn('Duplicate criterion in datatype query:', criterion);
				continue;
			}
			
			const node = criterion !== undefined ? typedAst.idMap.get(slicingCriterionToId(criterion, typedAst.idMap)) : typedAst.ast;
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