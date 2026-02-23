import fs from 'node:fs'
import path from 'node:path'
import type { Command } from 'commander'
import {
	configDir,
	configPath,
	exec,
	prompt,
	readConfigFile,
	readMergedConfig,
	writeConfigFile,
} from '../helpers.js'

export function registerDoctorCommand(program: Command, envPath: string): void {
	program
		.command('doctor')
		.description('Diagnose and fix common MiniNAS issues')
		.option('-y, --yes', 'Auto-accept all fixes')
		.action(async (opts: { yes?: boolean }) => {
			console.log('\n  MiniNAS Doctor\n')

			const autoYes = opts.yes ?? false
			const dbPath = path.join(configDir, 'data', 'mininas.db')
			// biome-ignore lint/suspicious/noExplicitAny: dynamic import of better-sqlite3
			let db: any = null
			let configChanged = false

			async function confirm(question: string): Promise<boolean> {
				if (autoYes) return true
				const answer = await prompt(question)
				return answer === '' || answer.toLowerCase().startsWith('y')
			}

			// 1. Database accessible
			if (!fs.existsSync(dbPath)) {
				console.log('  [✗] Database not found')
				console.log(`      Expected: ${dbPath}`)
				console.log("      Run 'mininas setup' to initialize.\n")
			} else {
				try {
					const { default: Database } = await import('better-sqlite3')
					db = new Database(dbPath)
					db.pragma('journal_mode = WAL')
					db.prepare('SELECT 1').get()
					const userCount = (db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }).c
					const credCount = (
						db.prepare('SELECT COUNT(*) as c FROM credentials').get() as { c: number }
					).c
					console.log(
						`  [✓] Database accessible (${userCount} user(s), ${credCount} credential(s))`,
					)
				} catch (e: any) {
					console.log(`  [✗] Database error: ${e.message}`)
					console.log("      Run 'mininas setup' to reinitialize.\n")
					db = null
				}
			}

			// 2. Session secret
			const cfg = readMergedConfig(envPath)
			if (!cfg.SESSION_SECRET || cfg.SESSION_SECRET === 'change-me') {
				console.log('  [!] Session secret not configured')
				console.log("      Run 'mininas setup' to generate one.")
			} else {
				console.log('  [✓] Session secret configured')
			}

			// 3. Tailscale connection
			let tsHostname = ''
			const tsJson = exec('tailscale status --json')
			if (!tsJson.ok) {
				console.log('  [✗] Tailscale not connected')
				console.log("      Install Tailscale and run 'tailscale up'.")
			} else {
				const tsInfo = JSON.parse(tsJson.stdout)
				tsHostname = (tsInfo.Self?.DNSName ?? '').replace(/\.$/, '')
				if (!tsHostname) {
					console.log('  [!] Tailscale connected but hostname unavailable')
				} else {
					console.log(`  [✓] Tailscale connected (${tsHostname})`)
				}
			}

			// 4. Hostname match
			let hostnameChanged = false
			let oldHostname = ''
			if (tsHostname && cfg.BASE_URL) {
				try {
					oldHostname = new URL(cfg.BASE_URL).hostname
				} catch {
					oldHostname = ''
				}

				if (oldHostname && oldHostname !== tsHostname) {
					hostnameChanged = true
					console.log('  [!] Hostname mismatch')
					console.log(`      Config:  ${cfg.BASE_URL}`)
					console.log(`      Current: ${tsHostname}`)
					console.log()

					if (await confirm(`      Update BASE_URL to https://${tsHostname}? [Y/n]: `)) {
						const fileCfg = readConfigFile()
						fileCfg.BASE_URL = `https://${tsHostname}`

						// Also update PUBLIC_SHARE_URL if it references the old hostname
						if (fileCfg.PUBLIC_SHARE_URL && fileCfg.PUBLIC_SHARE_URL.includes(oldHostname)) {
							fileCfg.PUBLIC_SHARE_URL = fileCfg.PUBLIC_SHARE_URL.replace(oldHostname, tsHostname)
						}

						writeConfigFile(fileCfg)
						configChanged = true
						console.log(`      Updated ${configPath}`)
					}
				} else {
					console.log('  [✓] Hostname matches config')
				}
			} else if (!cfg.BASE_URL) {
				console.log('  [!] BASE_URL not set in config')
				console.log("      Run 'mininas setup' to configure.")
			}

			// 5. Passkey health
			if (db && hostnameChanged) {
				const credCount = (
					db.prepare('SELECT COUNT(*) as c FROM credentials').get() as { c: number }
				).c
				if (credCount > 0) {
					console.log('  [!] Passkey credentials invalid')
					console.log(`      ${credCount} passkey(s) registered to old hostname (${oldHostname})`)
					console.log('      These will NOT work with the new hostname.')
					console.log()

					if (
						await confirm('      Clear all passkeys? Users will re-register on next login. [Y/n]: ')
					) {
						const sessCount = (
							db.prepare('SELECT COUNT(*) as c FROM sessions').get() as { c: number }
						).c
						db.prepare('DELETE FROM credentials').run()
						db.prepare('DELETE FROM sessions').run()
						try {
							db.prepare('DELETE FROM challenges').run()
						} catch {}
						console.log(`      Cleared ${credCount} credential(s) and ${sessCount} session(s).`)
						console.log('      The first user to visit will re-register as admin.')
					}
				} else {
					console.log('  [✓] No passkey credentials to migrate')
				}
			} else if (db && !hostnameChanged) {
				console.log('  [✓] Passkey credentials OK')
			}

			// 6. Volumes exist
			if (db) {
				try {
					const volumes = db.prepare('SELECT id, label, path FROM volumes').all() as {
						id: string
						label: string
						path: string
					}[]
					if (volumes.length === 0) {
						console.log('  [✓] No volumes configured')
					} else {
						const missing = volumes.filter((v) => !fs.existsSync(v.path))
						if (missing.length === 0) {
							console.log(`  [✓] Volumes OK (${volumes.length}/${volumes.length} paths exist)`)
						} else {
							console.log(`  [!] ${missing.length}/${volumes.length} volume path(s) missing:`)
							for (const v of missing) {
								console.log(`      - ${v.label} (${v.id}): ${v.path}`)
							}
						}
					}
				} catch {
					// volumes table might not exist yet
					console.log('  [✓] No volumes configured')
				}
			}

			// 7. Server reachable
			const port = cfg.PORT || '3001'
			try {
				const res = await fetch(`http://localhost:${port}/api/v1/auth/setup-needed`, {
					signal: AbortSignal.timeout(2000),
				})
				if (res.ok) {
					console.log(`  [✓] Server reachable on port ${port}`)
				} else {
					console.log(`  [✓] Server reachable on port ${port} (status ${res.status})`)
				}
			} catch {
				console.log(`  [i] Server not reachable on port ${port}`)
			}

			// Close DB
			if (db) {
				try {
					db.close()
				} catch {}
			}

			// Summary
			console.log()
			if (configChanged) {
				console.log('  Done. Restart the server to apply config changes:')
				console.log('    brew services restart mininas')
			} else {
				console.log('  Done. No changes needed.')
			}
			console.log()
		})
}
