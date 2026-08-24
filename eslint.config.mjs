import flowr from '@eagleoutice/eslint-config-flowr';

/**
 * Rules that are about this repository rather than about TypeScript, so they live with it.
 */
const local = {
	rules: {
		/**
		 * Two doc comments in a row mean the first one documents nothing: it happens when a declaration is
		 * inserted between an existing comment and what it described, which silently re-labels both.
		 */
		'no-orphaned-doc-comment': {
			meta: {
				type:     'problem',
				docs:     { description: 'disallow a doc comment that is immediately followed by another one' },
				messages: { orphaned: 'this doc comment is followed by another one, so it describes nothing' },
				schema:   []
			},
			create(context) {
				const source = context.sourceCode ?? context.getSourceCode();
				return {
					Program() {
						const docs = source.getAllComments().filter(c => c.type === 'Block' && c.value.startsWith('*'));
						for(let at = 1; at < docs.length; at++) {
							const before = docs[at - 1];
							/*
							 * Directly one under the other, no blank line between: a file header standing above
							 * the first declaration of a file is a paragraph of its own and says something.
							 */
							if(/^[^\S\n]*\n[^\S\n]*$/.test(source.text.slice(before.range[1], docs[at].range[0]))) {
								context.report({ loc: before.loc, messageId: 'orphaned' });
							}
						}
					}
				};
			}
		}
	}
};

export default [...flowr, {
	/* what the browser build puts in place of node's built-ins is plain JS, outside the TypeScript project */
	ignores: ['scripts/playground/empty.js', 'scripts/playground/path-shim.js']
}, {
	plugins: { local },
	rules:   { 'local/no-orphaned-doc-comment': 'error' },
}];
