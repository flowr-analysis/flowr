import flowr from '@eagleoutice/eslint-config-flowr';

export default [...flowr, {
	/* what the browser build puts in place of node's built-ins is plain JS, outside the TypeScript project */
	ignores: ['scripts/playground/empty.js', 'scripts/playground/path-shim.js']
}, {
	rules: {},
}];
