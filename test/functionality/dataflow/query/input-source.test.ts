import { assertQuery } from '../../_helper/query';
import { label } from '../../_helper/label';
import { withTreeSitter } from '../../_helper/shell';
import { describe } from 'vitest';
import type {
	InputSourcesQuery,
	InputSourcesQueryResult
} from '../../../../src/queries/catalog/input-sources-query/input-sources-query-format';
import { InputTraceType, InputType } from '../../../../src/queries/catalog/input-sources-query/simple-input-classifier';
import { SlicingCriterion } from '../../../../src/slicing/criterion/parse';

describe.sequential('Input Source Test', withTreeSitter(parser => {
	function testQuery(name: string, code: string, query: readonly InputSourcesQuery[], expectedOutput: InputSourcesQueryResult['results']) {
		assertQuery(label(name), parser, code, query, d => {
			const nast = d.normalize.idMap;
			for(const [key, value] of Object.entries(expectedOutput)) {
				expectedOutput[key] = value.map(v => ({
					...v,
					id: SlicingCriterion.tryParse(v.id, nast) ?? v.id
				}));
			}
			return {
				'input-sources': { results: expectedOutput }
			};
		});
	}

	// TODO: read, randomness, network, with control dependencies etc.

	testQuery('Eval-parse simple', "eval(parse(text='x'))", [{ type: 'input-sources', criterion: '1@eval' }], {
		'1@eval': [{
			id:    '1@parse',
			type:  InputType.DerivedConstant, trace: InputTraceType.Pure
		}]
	});
	testQuery('Eval-parse simple with indirect', "x <- 'x'\neval(parse(text=x))", [{ type: 'input-sources', criterion: '2@eval' }], {
		'2@eval': [{
			id:    '2@parse',
			type:  InputType.DerivedConstant, trace: InputTraceType.Pure
		}]
	});
	testQuery('Eval-parse simple but with variable', 'eval(parse(text=x))', [{ type: 'input-sources', criterion: '1@eval' }], {
		'1@eval': [{
			id:    '1@parse',
			type:  InputType.Unknown, trace: InputTraceType.Known
		}]
	});
	testQuery('Eval-parse to param', 'function(x) eval(parse(text=x))', [{ type: 'input-sources', criterion: '1@eval' }], {
		'1@eval': [{
			id:    '1@parse',
			type:  InputType.Parameter, trace: InputTraceType.Known
		}]
	});
	testQuery('Eval-parse to param with indirect', 'function(x) { y <- x\neval(parse(text=y))}', [{ type: 'input-sources', criterion: '2@eval' }], {
		'2@eval': [{
			id:    '2@parse',
			type:  InputType.Parameter, trace: InputTraceType.Known
		}]
	});
}));

