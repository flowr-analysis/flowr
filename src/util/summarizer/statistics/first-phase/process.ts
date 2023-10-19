import fs from 'node:fs'
import path from 'node:path'
import { guard } from '../../../assert'

export class FileMigrator {
	private readonly writeHandles = new Map<string, fs.WriteStream>()
	private finished = false

	public async migrate(sourceFolder: string, targetFolder: string): Promise<void> {
		guard(!this.finished, () => 'migrator is already marked as finished!')
		if(!fs.existsSync(targetFolder)) {
			fs.mkdirSync(targetFolder, { recursive: true })
		}

		const files = fs.readdirSync(sourceFolder, { recursive: true })
		const promises: Promise<void>[] = []
		for(const f of files) {
			const source = path.join(sourceFolder, String(f))
			const target = path.join(targetFolder, String(f))

			// TODO: parallelize append and copy with an async and await all?
			if(fs.statSync(source).isDirectory()) {
				await this.migrate(source, target)
			} else if(fs.existsSync(target)) {
				// TODO: is there a faster way ?
				const targetStream = this.writeHandles.get(target)
				guard(targetStream !== undefined, () => `expected to have a write handle for ${target}`)
				promises.push(new Promise<void>((resolve, reject) => {
					fs.readFile(source, (err, data) => {
						if(err) {
							reject(err)
						} else {
							targetStream.write(data)
							resolve()
						}
					})
				}))
			} else {
				fs.copyFileSync(source, target)
				this.writeHandles.set(target, fs.createWriteStream(target, { flags: 'a' }))
			}
		}
		await Promise.all(promises)
	}

	public finish() {
		for(const handle of this.writeHandles.values()) {
			handle.close()
		}
		this.finished = true
	}
}

