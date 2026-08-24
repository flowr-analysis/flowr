/* esbuild inlines these as data urls */
declare module '*.wasm' {
	const url: string;
	export default url;
}
