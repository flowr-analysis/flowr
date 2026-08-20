import { describe } from 'vitest';
import { withTreeSitter } from '../_helper/shell';
import { assertLinter } from '../_helper/linter';
import { LintingResultCertainty } from '../../../src/linter/linter-format';

describe('flowR linter', withTreeSitter(parser => {
	describe('no-leaked-credentials', () => {
		assertLinter('no credentials', parser, 'x <- 42',
			'no-leaked-credentials',
			[],
			{ totalChecked: 1 }
		);

		assertLinter('password assignment', parser, 'password <- "s3cr3t"',
			'no-leaked-credentials',
			[{ certainty: LintingResultCertainty.Uncertain, variableName: 'password', loc: [1, 1, 1, 8] }],
			{ totalChecked: 1 }
		);

		assertLinter('api_key assignment', parser, 'api_key <- "abc123-xyz"',
			'no-leaked-credentials',
			[{ certainty: LintingResultCertainty.Uncertain, variableName: 'api_key', loc: [1, 1, 1, 7] }],
			{ totalChecked: 1 }
		);

		assertLinter('token assignment', parser, 'auth_token <- "Bearer abc123"',
			'no-leaked-credentials',
			[{ certainty: LintingResultCertainty.Uncertain, variableName: 'auth_token', loc: [1, 1, 1, 10] }],
			{ totalChecked: 1 }
		);

		assertLinter('case insensitive match', parser, 'PASSWORD <- "hunter2"',
			'no-leaked-credentials',
			[{ certainty: LintingResultCertainty.Uncertain, variableName: 'PASSWORD', loc: [1, 1, 1, 8] }],
			{ totalChecked: 1 }
		);

		assertLinter('non-string value not flagged', parser, 'password <- getPass()',
			'no-leaked-credentials',
			[],
			{ totalChecked: 1 }
		);

		assertLinter('numeric value not flagged', parser, 'secret <- 42',
			'no-leaked-credentials',
			[],
			{ totalChecked: 1 }
		);

		assertLinter('unrelated variable with plain string not flagged', parser, 'greeting <- "hello world"',
			'no-leaked-credentials',
			[],
			{ totalChecked: 1 }
		);

		assertLinter('multiple assignments', parser, 'x <- "hello"\npassword <- "mypass"\ny <- 1',
			'no-leaked-credentials',
			[{ certainty: LintingResultCertainty.Uncertain, variableName: 'password', loc: [2, 1, 2, 8] }],
			{ totalChecked: 3 }
		);

		assertLinter('api.key with dot separator', parser, 'api.key <- "tok_12345"',
			'no-leaked-credentials',
			[{ certainty: LintingResultCertainty.Uncertain, variableName: 'api.key', loc: [1, 1, 1, 7] }],
			{ totalChecked: 1 }
		);

		assertLinter('custom name pattern', parser, 'mysupersecretvar <- "secret"',
			'no-leaked-credentials',
			[{ certainty: LintingResultCertainty.Uncertain, variableName: 'mysupersecretvar', loc: [1, 1, 1, 16] }],
			{ totalChecked: 1 },
			{ credentialNamePattern: 'mysupersecretvar' }
		);

		assertLinter('aws access key id detected by value', parser, 'x <- "AKIAIOSFODNN7EXAMPLE"',
			'no-leaked-credentials',
			[{ certainty: LintingResultCertainty.Uncertain, variableName: 'x', loc: [1, 1, 1, 1] }],
			{ totalChecked: 1 }
		);

		assertLinter('github pat detected by value', parser, 'connection <- "ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"',
			'no-leaked-credentials',
			[{ certainty: LintingResultCertainty.Uncertain, variableName: 'connection', loc: [1, 1, 1, 10] }],
			{ totalChecked: 1 }
		);

		assertLinter('pem private key detected by value', parser, 'data <- "-----BEGIN RSA PRIVATE KEY-----"',
			'no-leaked-credentials',
			[{ certainty: LintingResultCertainty.Uncertain, variableName: 'data', loc: [1, 1, 1, 4] }],
			{ totalChecked: 1 }
		);

		assertLinter('slack token detected by value', parser, 'bot <- "xoxb-1234567890-abcdefghijklmn"',
			'no-leaked-credentials',
			[{ certainty: LintingResultCertainty.Uncertain, variableName: 'bot', loc: [1, 1, 1, 3] }],
			{ totalChecked: 1 }
		);

		assertLinter('stripe key detected by value', parser, 'client <- "sk_live_12345abcdefghijklmnopqrs"',
			'no-leaked-credentials',
			[{ certainty: LintingResultCertainty.Uncertain, variableName: 'client', loc: [1, 1, 1, 6] }],
			{ totalChecked: 1 }
		);

		assertLinter('name and value both match', parser, 'api_key <- "AKIAIOSFODNN7EXAMPLE"',
			'no-leaked-credentials',
			[{ certainty: LintingResultCertainty.Uncertain, variableName: 'api_key', loc: [1, 1, 1, 7] }],
			{ totalChecked: 1 }
		);
	});
}));
