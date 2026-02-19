import { assert, describe, test } from 'vitest';
import type { RAuthorInfo } from '../../../src/util/r-author';
import { parseTextualAuthorString, parseRAuthorString, AuthorRole } from '../../../src/util/r-author';

describe('R Author Parsing', function() {
	const cases = [
		{
			input:  'person("First", "Last", , "first.last@example.com", role = c("aut", "cre"))',
			expect: [{
				name:  ['First', 'Last'],
				email: 'first.last@example.com',
				roles: [AuthorRole.Author, AuthorRole.Creator]
			}] satisfies RAuthorInfo[]
		},
		{
			input:  'person("First", "Last", "Middle", "first.last@example.com", role = c("aut", "cre"))',
			expect: [{
				name:  ['First', 'Middle', 'Last'],
				email: 'first.last@example.com',
				roles: [AuthorRole.Author, AuthorRole.Creator]
			}] satisfies RAuthorInfo[]
		},
		{
			input:  'person("First", "Last", "Middle", "first.last@example.com", comment=c("Some comment"))',
			expect: [{
				name:    ['First', 'Middle', 'Last'],
				email:   'first.last@example.com',
				roles:   [],
				comment: ['Some comment']
			}] satisfies RAuthorInfo[]
		},
		{
			input:  'person("First", "Last", "Middle", "first.last@example.com", comment=c("Some comment", "Another Comment"))',
			expect: [{
				name:    ['First', 'Middle', 'Last'],
				email:   'first.last@example.com',
				roles:   [],
				comment: ['Some comment', 'Another Comment']
			}] satisfies RAuthorInfo[]
		},
		{
			input:  'person("First", "Last", "Middle", "first.last@example.com", comment=c("Some comment", ORCID="0000-0001-2345-6789", "Another Comment"))',
			expect: [{
				name:    ['First', 'Middle', 'Last'],
				email:   'first.last@example.com',
				roles:   [],
				comment: ['Some comment', 'Another Comment'],
				orcid:   '0000-0001-2345-6789'
			}] satisfies RAuthorInfo[]
		},
		{
			input:  'person("First", email="first.last@example.com", role = c("fnd"), "Last")',
			expect: [{
				name:  ['First', 'Last'],
				email: 'first.last@example.com',
				roles: [AuthorRole.Funder]
			}] satisfies RAuthorInfo[]
		},
		{
			input:  'person("First", email="first.last@example.com", role = "fnd", "Last")',
			expect: [{
				name:  ['First', 'Last'],
				email: 'first.last@example.com',
				roles: [AuthorRole.Funder]
			}] satisfies RAuthorInfo[]
		},
		{
			input:  'person(family="First", given="Last", , "first.last@example.com", role = c("aut", "cre"))',
			expect: [{
				name:  ['Last', 'First'],
				email: 'first.last@example.com',
				roles: [AuthorRole.Author, AuthorRole.Creator]
			}] satisfies RAuthorInfo[]
		},
		{
			input:  'c(person("First", "Last", , "first.last@example.com", role = c("aut", "cre")))',
			expect: [{
				name:  ['First', 'Last'],
				email: 'first.last@example.com',
				roles: [AuthorRole.Author, AuthorRole.Creator]
			}] satisfies RAuthorInfo[]
		},
		{
			input:  'c(person("First", "Last", , "first.last@example.com", role = c("aut", "cre")), person("First", "Last2", , "first.last2@example.com", role = c("fnd")))',
			expect: [{
				name:  ['First', 'Last'],
				email: 'first.last@example.com',
				roles: [AuthorRole.Author, AuthorRole.Creator]
			}, {
				name:  ['First', 'Last2'],
				email: 'first.last2@example.com',
				roles: [AuthorRole.Funder]
			}] satisfies RAuthorInfo[]
		},
	];
	test.each(cases)('parse($input)', ({ input, expect }) => {
		const result = parseRAuthorString(input);
		assert.deepStrictEqual(result, expect);
	});

	describe('classical parsing', () => {
		const classicalCases = [
			{
				input:  'First Last <first.last@email.com> [aut, cre]',
				expect: [{
					name:  ['First', 'Last'],
					email: 'first.last@email.com',
					roles: [AuthorRole.Author, AuthorRole.Creator]
				}] satisfies RAuthorInfo[]
			},
			{
				input:  'First Last [aut, cre] <first.last@email.com>',
				expect: [{
					name:  ['First', 'Last'],
					email: 'first.last@email.com',
					roles: [AuthorRole.Author, AuthorRole.Creator]
				}] satisfies RAuthorInfo[]
			},
			{
				input:  'First Last (ORCID: 0000-0001-2345-6789) <foo.bar@x>',
				expect: [{
					name:  ['First', 'Last'],
					email: 'foo.bar@x',
					roles: [],
					orcid: '0000-0001-2345-6789'
				}] satisfies RAuthorInfo[]
			},
			{
				input:  'First Last (ORCID: 0000-0001-2345-6789, and stuff) <foo.bar@x>',
				expect: [{
					name:    ['First', 'Last'],
					email:   'foo.bar@x',
					roles:   [],
					orcid:   '0000-0001-2345-6789',
					comment: ['and stuff']
				}] satisfies RAuthorInfo[]
			},
			{
				input:  'First Last (stuff and, ORCID: 0000-0001-2345-6789) <foo.bar@x>',
				expect: [{
					name:    ['First', 'Last'],
					email:   'foo.bar@x',
					roles:   [],
					orcid:   '0000-0001-2345-6789',
					comment: ['stuff and']
				}] satisfies RAuthorInfo[]
			},
			{
				input:  'First Last (stuff and, ORCID: 0000-0001-2345-6789, and stuff) <foo.bar@x>',
				expect: [{
					name:    ['First', 'Last'],
					email:   'foo.bar@x',
					roles:   [],
					orcid:   '0000-0001-2345-6789',
					comment: ['stuff and', 'and stuff']
				}] satisfies RAuthorInfo[]
			},
			{
				input:  'First Last <first.last@email.com> (Comment)',
				expect: [{
					name:    ['First', 'Last'],
					email:   'first.last@email.com',
					roles:   [],
					comment: ['Comment']
				}]
			},
			{
				input:  'A B. c <abc@b.edu> and A D. e <lol>',
				expect: [{
					name:  ['A', 'B.', 'c'],
					email: 'abc@b.edu',
					roles: [],
				}, {
					name:  ['A', 'D.', 'e'],
					email: 'lol',
					roles: [],
				}]
			},
			{
				input:  'A B. c (Comment) <abc@b.edu> and A D. e [ctb, cph] <lol>',
				expect: [{
					name:    ['A', 'B.', 'c'],
					email:   'abc@b.edu',
					roles:   [],
					comment: ['Comment']
				}, {
					name:  ['A', 'D.', 'e'],
					email: 'lol',
					roles: [AuthorRole.Contributor, AuthorRole.CopyrightHolder]
				}]
			}
		];
		test.each(classicalCases)('parseTextual($input)', ({ input, expect }) => {
			const result = parseTextualAuthorString(input);
			assert.deepStrictEqual(result, expect);
		});
	});
});