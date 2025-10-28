import { describe } from 'vitest';
import { assertReplCompletions } from '../../_helper/repl';
import { SupportedQueries } from '../../../../src/queries/query';
import { fileProtocol } from '../../../../src/r-bridge/retriever';
import { LintingRules } from '../../../../src/linter/linter-rules';

describe('Linter Query REPL Completions', () => {
	const c = SupportedQueries['linter'].completer;
	const r = Object.keys(LintingRules);
	assertReplCompletions(c, 'empty arguments',                  true,   [''],                                    ['rules:']);
	assertReplCompletions(c, 'partial prefix',                   false,  ['r'],                                   ['rules:']);
	assertReplCompletions(c, 'no rules',                         false,  ['rules:'],                              r);
	assertReplCompletions(c, 'partial rule',                     false,  ['rules:d'],                             r);
	assertReplCompletions(c, 'partial unique rule',              false,  ['rules:dead'],                          r);
	assertReplCompletions(c, 'multiple rules, one partial',      false,  ['rules:dead-code,file-path-val'],       r.filter(l => !(l === 'dead-code')));
	assertReplCompletions(c, 'multiple rules, no new one',       false,  ['rules:dead-code,file-path-validity'],  [',']);
	assertReplCompletions(c, 'multiple rules, starting new one', false,  ['rules:dead-code,file-path-validity,'], r.filter(l => !['dead-code','file-path-validity'].includes(l)));
	assertReplCompletions(c, 'all rules used',                   false,  [`rules:${r.join(',')}`],       [' ']);
	assertReplCompletions(c, 'rules finished', 		           true,   ['rules:dead'],                          [fileProtocol]);
});
