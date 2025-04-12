import { assert, describe, test } from 'vitest';
import { createNormalizePipeline } from '../../../src/core/steps/pipeline/default-pipelines';
import { requestFromInput } from '../../../src/r-bridge/retriever';
import { cfg2quads, extractCFG } from '../../../src/control-flow/cfg';
import { defaultQuadIdGenerator } from '../../../src/util/quads';
import { withTreeSitter } from '../_helper/shell';

describe('Control Flow Graph', withTreeSitter(parser => {
	test('Example Quad Export', async() => {
		const domain = 'https://uni-ulm.de/r-ast/';
		const context = 'test';

		const result = await createNormalizePipeline(parser, {
			request: requestFromInput('if(TRUE) 1')
		}).allRemainingSteps();
		const cfg = extractCFG(result.normalize);

		const content = cfg2quads(cfg, { context, domain, getId: defaultQuadIdGenerator() });

		assert.strictEqual(content, `<${domain}${context}/0> <${domain}rootIds> "3"^^<http://www.w3.org/2001/XMLSchema#integer> <${context}> .
<${domain}${context}/0> <${domain}rootIds> "3-exit" <${context}> .
<${domain}${context}/0> <${domain}rootIds> "0"^^<http://www.w3.org/2001/XMLSchema#integer> <${context}> .
<${domain}${context}/0> <${domain}rootIds> "1"^^<http://www.w3.org/2001/XMLSchema#integer> <${context}> .
<${domain}${context}/0> <${domain}vertices> <${domain}${context}/1> <${context}> .
<${domain}${context}/1> <${domain}next> <${domain}${context}/2> <${context}> .
<${domain}${context}/1> <${domain}id> "3"^^<http://www.w3.org/2001/XMLSchema#integer> <${context}> .
<${domain}${context}/1> <${domain}name> "RIfThenElse" <${context}> .
<${domain}${context}/0> <${domain}vertices> <${domain}${context}/2> <${context}> .
<${domain}${context}/2> <${domain}next> <${domain}${context}/3> <${context}> .
<${domain}${context}/2> <${domain}id> "3-exit" <${context}> .
<${domain}${context}/2> <${domain}name> "if-exit" <${context}> .
<${domain}${context}/0> <${domain}vertices> <${domain}${context}/3> <${context}> .
<${domain}${context}/3> <${domain}next> <${domain}${context}/4> <${context}> .
<${domain}${context}/3> <${domain}id> "0"^^<http://www.w3.org/2001/XMLSchema#integer> <${context}> .
<${domain}${context}/3> <${domain}name> "RLogical" <${context}> .
<${domain}${context}/0> <${domain}vertices> <${domain}${context}/4> <${context}> .
<${domain}${context}/4> <${domain}id> "1"^^<http://www.w3.org/2001/XMLSchema#integer> <${context}> .
<${domain}${context}/4> <${domain}name> "RNumber" <${context}> .
<${domain}${context}/0> <${domain}edges> <${domain}${context}/5> <${context}> .
<${domain}${context}/5> <${domain}next> <${domain}${context}/6> <${context}> .
<${domain}${context}/5> <${domain}from> "1"^^<http://www.w3.org/2001/XMLSchema#integer> <${context}> .
<${domain}${context}/5> <${domain}to> "0"^^<http://www.w3.org/2001/XMLSchema#integer> <${context}> .
<${domain}${context}/5> <${domain}type> "CD" <${context}> .
<${domain}${context}/5> <${domain}when> "TRUE" <${context}> .
<${domain}${context}/0> <${domain}edges> <${domain}${context}/6> <${context}> .
<${domain}${context}/6> <${domain}next> <${domain}${context}/7> <${context}> .
<${domain}${context}/6> <${domain}from> "0"^^<http://www.w3.org/2001/XMLSchema#integer> <${context}> .
<${domain}${context}/6> <${domain}to> "3"^^<http://www.w3.org/2001/XMLSchema#integer> <${context}> .
<${domain}${context}/6> <${domain}type> "FD" <${context}> .
<${domain}${context}/0> <${domain}edges> <${domain}${context}/7> <${context}> .
<${domain}${context}/7> <${domain}next> <${domain}${context}/8> <${context}> .
<${domain}${context}/7> <${domain}from> "3-exit" <${context}> .
<${domain}${context}/7> <${domain}to> "1"^^<http://www.w3.org/2001/XMLSchema#integer> <${context}> .
<${domain}${context}/7> <${domain}type> "FD" <${context}> .
<${domain}${context}/0> <${domain}edges> <${domain}${context}/8> <${context}> .
<${domain}${context}/8> <${domain}from> "3-exit" <${context}> .
<${domain}${context}/8> <${domain}to> "0"^^<http://www.w3.org/2001/XMLSchema#integer> <${context}> .
<${domain}${context}/8> <${domain}type> "CD" <${context}> .
<${domain}${context}/8> <${domain}when> "FALSE" <${context}> .
<${domain}${context}/0> <${domain}entryPoints> "3"^^<http://www.w3.org/2001/XMLSchema#integer> <${context}> .
<${domain}${context}/0> <${domain}exitPoints> "3-exit" <${context}> .
`);
	});
}));