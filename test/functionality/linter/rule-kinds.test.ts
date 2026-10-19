import { assert, describe, test } from 'vitest';
import { type LintingRuleNames, LintingRules } from '../../../src/linter/linter-rules';
import { LintingRuleTag } from '../../../src/linter/linter-tags';

describe('the kind of each linting rule', () => {
	const kinds: readonly LintingRuleTag[] = [LintingRuleTag.Bug, LintingRuleTag.Smell, LintingRuleTag.Style];
	const rules = Object.keys(LintingRules) as LintingRuleNames[];
	const tagsOf = (r: LintingRuleNames) => LintingRules[r].info.tags as readonly LintingRuleTag[];
	test('no rule has two kinds', () => {
		assert.deepStrictEqual(rules.filter(r => tagsOf(r).filter(t => kinds.includes(t)).length > 1), []);
	});
	test('only rules checking the files of a package have no kind', () => {
		assert.deepStrictEqual(rules.filter(r => !tagsOf(r).some(t => kinds.includes(t)) && !tagsOf(r).includes(LintingRuleTag.CmdCheck)), []);
	});
	test('every description says what the rule finds', () => {
		assert.deepStrictEqual(rules.filter(r => !LintingRules[r].info.description.startsWith('Finds ')), []);
	});
});
