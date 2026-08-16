import flowr from '@eagleoutice/eslint-config-flowr';

export default [...flowr, {
	/* the browser stub for node built-ins is plain JS, outside the TypeScript project */
	ignores: ['scripts/playground/empty.js']
}, {
	rules: {},
}];
