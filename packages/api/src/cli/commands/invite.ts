import type { Command } from 'commander'
import type { ApiOpts } from '../helpers.js'
import { api } from '../helpers.js'

export function registerInviteCommands(program: Command, getOpts: () => ApiOpts): void {
	const callApi = (method: string, endpoint: string, body?: Record<string, unknown>) =>
		api(method, endpoint, getOpts, body)

	const invite = program.command('invite').description('Manage invite tokens')
	invite.action(() => invite.help())

	invite
		.command('create')
		.description('Create an invite token')
		.argument('<username>', 'Username for the invite')
		.option('--expires <hours>', 'Expiration in hours', '72')
		.action(async (username: string, opts: { expires: string }) => {
			const expiresInHours = parseInt(opts.expires, 10)
			if (isNaN(expiresInHours) || expiresInHours <= 0) {
				console.error('--expires must be a positive number of hours.')
				process.exit(1)
			}

			const data = await callApi('POST', '/invites', {
				username,
				expiresInHours,
			})
			const inv = data.invite
			console.log(`Invite created for '${username}':`)
			console.log(`  Token: ${inv.id}`)
			console.log(`  Expires: ${inv.expires_at}`)
		})

	invite
		.command('list')
		.description('List all invite tokens')
		.action(async () => {
			const data = await callApi('GET', '/invites')
			const rows = data.invites
			if (rows.length === 0) {
				console.log('No invites.')
				return
			}
			const idW = Math.max(5, ...rows.map((r: any) => r.id.length))
			const nameW = Math.max(8, ...rows.map((r: any) => r.username.length))
			console.log(`${'TOKEN'.padEnd(idW)}  ${'USERNAME'.padEnd(nameW)}  STATUS       EXPIRES`)
			for (const r of rows) {
				const status = r.used_by
					? 'used'
					: new Date(r.expires_at) < new Date()
						? 'expired'
						: 'pending'
				console.log(
					`${r.id.padEnd(idW)}  ${r.username.padEnd(nameW)}  ${status.padEnd(11)}  ${r.expires_at}`,
				)
			}
		})

	invite
		.command('delete')
		.description('Delete an invite token')
		.argument('<id>', 'Invite token ID')
		.action(async (id: string) => {
			await callApi('DELETE', `/invites/${id}`)
			console.log(`Deleted invite: ${id}`)
		})
}
