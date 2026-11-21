import { assert, describe, test } from 'vitest';
import { type LintingRuleNames, LintingRules, lintingRuleFile } from '../../../src/linter/linter-rules';
import fs from 'fs';
import path from 'path';
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
	test('every rule follows the naming convention of lintingRuleFile', async() => {
		const wrong: string[] = [];
		for(const name of rules) {
			const file = lintingRuleFile(name);
			const module = await import(`../../../src/linter/rules/${file}`) as Record<string, unknown>;
			const config = name.split('-').map(part => part[0].toUpperCase() + part.slice(1)).join('') + 'Config';
			const source = fs.readFileSync(path.join(__dirname, `../../../src/linter/rules/${file}.ts`), 'utf8');
			const test = path.join(__dirname, file.replace(/[^/]+$/, base => `lint-${base}.test.ts`));
			if(module[name.toUpperCase().replaceAll('-', '_')] !== LintingRules[name] || !new RegExp(`export (interface|type) ${config}\\b`).test(source) || !fs.existsSync(test)) {
				wrong.push(name);
			}
		}
		assert.deepStrictEqual(wrong, []);
	});
});
