/**
 * Portable, streaming, non-cryptographic 64-bit hash (cyrb53), emitted as 16 hex chars. Feed it in
 * chunks with {@link update} (so callers can hash data larger than a single string) and read the result
 * with {@link digest}. Used for content/update detection where a stable, fast digest is enough; browser-safe
 * (no node `crypto`, so it also works in the bundled/web build).
 *
 * cyrb53 is a public-domain hash by `bryc`.
 */
export class Hash53 {
	private h1 = 0xdeadbeef;
	private h2 = 0x41c6ce57;

	public update(str: string): this {
		for(let i = 0; i < str.length; i++) {
			const ch = str.charCodeAt(i);
			this.h1 = Math.imul(this.h1 ^ ch, 2654435761);
			this.h2 = Math.imul(this.h2 ^ ch, 1597334677);
		}
		return this;
	}

	public digest(): string {
		const h1 = Math.imul(this.h1 ^ (this.h1 >>> 16), 2246822507) ^ Math.imul(this.h2 ^ (this.h2 >>> 13), 3266489909);
		const h2 = Math.imul(this.h2 ^ (this.h2 >>> 16), 2246822507) ^ Math.imul(this.h1 ^ (this.h1 >>> 13), 3266489909);
		// `^` yields a *signed* int32, so coerce each half to unsigned (`>>> 0`) before hex, else a high bit prints a `-`
		return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
	}
}
