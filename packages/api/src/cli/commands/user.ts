import type { Command } from 'commander'
import type { ApiOpts } from '../helpers.js'
import { api } from '../helpers.js'

export function registerUserCommands(program: Command, getOpts: () => ApiOpts): void {
	const callApi = (method: string, endpoint: string, body?: Record<string, unknown>) =>
		api(method, endpoint, getOpts, body)

	const user = program.command('user').description('Manage users')
	user.action(() => user.help())

	user
		.command('list')
		.description('List all registered users')
		.action(async () => {
			const data = await callApi('GET', '/users')
			const rows = data.users
			if (rows.length === 0) {
				console.log('No users registered.')
				return
			}
			const idW = Math.max(2, ...rows.map((r: any) => r.id.length))
			const nameW = Math.max(8, ...rows.map((r: any) => r.username.length))
			const roleW = Math.max(4, ...rows.map((r: any) => r.role.length))
			console.log(
				`${'ID'.padEnd(idW)}  ${'USERNAME'.padEnd(nameW)}  ${'ROLE'.padEnd(roleW)}  CREATED`,
			)
			for (const r of rows) {
				console.log(
					`${r.id.padEnd(idW)}  ${r.username.padEnd(nameW)}  ${r.role.padEnd(roleW)}  ${r.created_at}`,
				)
			}
		})

	user
		.command('reset-passkeys')
		.description('Remove all passkeys for a user (they can re-register on next login)')
		.argument('<id>', 'User ID')
		.action(async (id: string) => {
			const data = await callApi('POST', `/users/${id}/reset-passkeys`)
			console.log(
				`Reset passkeys for '${data.username}' (removed ${data.removedCredentials} credential(s)).`,
			)
			console.log('They will be prompted to register a new passkey on next login.')
		})

	user
		.command('delete')
		.description('Delete a user')
		.argument('<id>', 'User ID')
		.action(async (id: string) => {
			await callApi('DELETE', `/users/${id}`)
			console.log(`Deleted user: ${id}`)
		})
}
