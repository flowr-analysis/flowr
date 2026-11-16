import { assert, describe, test } from 'vitest';
import { DefaultBuiltinConfig } from '../../../../src/dataflow/environments/default-builtin-config';
import { Identifier, PkgName } from '../../../../src/dataflow/environments/identifier';
import { SemanticCallTag } from '../../../../src/dataflow/environments/built-in-props';
import { label } from '../../_helper/label';

/* the `ellmer` constructors flowR models, the same set the taint analysis watches (see `secret-analysis.ts`) */
const EllmerFns = ['chat', 'chat_openai', 'chat_anthropic', 'chat_claude', 'chat_gemini', 'chat_google_gemini', 'chat_ollama', 'chat_mistral', 'chat_groq', 'chat_azure_openai', 'chat_bedrock'];

/* every definition the default configuration states for the `ellmer` package */
const EllmerDefs = DefaultBuiltinConfig.flatMap(d => d.type === 'constant' ? [] : (d.names as readonly Identifier[])
	.filter(id => Identifier.getNamespace(id) === PkgName.Ellmer)
	.map(id => ({ name: Identifier.getName(id), config: d.config })));

describe('ellmer side effects', () => {
	test(label('every known ellmer constructor is modeled', ['name-normal'], ['dataflow']), () => {
		assert.deepStrictEqual(EllmerDefs.map(d => d.name).sort(), [...EllmerFns].sort());
	});
	test(label('every ellmer call is an unknown network read', ['name-normal'], ['dataflow']), () => {
		for(const { name, config } of EllmerDefs) {
			assert.isTrue(config?.hasUnknownSideEffects === true, `${name} is not marked as an unknown side effect`);
			assert.includeMembers(config?.tags ?? [], [SemanticCallTag.Network, SemanticCallTag.Reads], `${name} is not tagged as a network read`);
		}
	});
});
