/* stands in for node built-ins and for the parts of flowR a browser never reaches */
const stub = new Proxy(function() {}, {
	get(_target, key) {
		switch(key) {
			case '__esModule': return false;
			case 'then':       return undefined;
			case 'valueOf':    return () => 0;
			case 'toString':   return () => '';
			case Symbol.toPrimitive: return () => 0;
			case Symbol.toStringTag: return 'stub';
			case Symbol.iterator: return function* () { /* nothing to iterate */ };
			default:           return stub;
		}
	},
	apply:     () => stub,
	construct: () => ({})
});
module.exports = stub;
