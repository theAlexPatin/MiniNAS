import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ArrowLeft, Check, Copy, HardDrive, Key, Loader2, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import {
	useCreateWebDAVToken,
	useRevokeWebDAVToken,
	useWebDAVTokens,
} from '../hooks/useWebDAVTokens'
import { withBase } from '../lib/basePath'
import Tabs from './ui/Tabs'

const queryClient = new QueryClient({
	defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
})

function formatDate(dateStr: string | null): string {
	if (!dateStr) return 'Never'
	return new Date(dateStr).toLocaleDateString(undefined, {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
	})
}

const mainTabs = [
	{ id: 'guide', label: 'Setup Guide' },
	{ id: 'tokens', label: 'Access Tokens' },
]

const osTabs = [
	{ id: 'macos', label: 'macOS' },
	{ id: 'windows', label: 'Windows' },
	{ id: 'linux', label: 'Linux' },
]

function SetupGuide({ serverUrl, username }: { serverUrl: string; username?: string }) {
	const [osTab, setOsTab] = useState('macos')
	const [copied, setCopied] = useState(false)

	const handleCopy = async (text: string) => {
		await navigator.clipboard.writeText(text)
		setCopied(true)
		setTimeout(() => setCopied(false), 2000)
	}

	return (
		<div className="space-y-4">
			<div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
				<h3 className="text-sm font-semibold text-gray-900 mb-3">Server URL</h3>
				<div className="flex items-center gap-2">
					<code className="flex-1 bg-gray-50 border border-gray-200 rounded px-3 py-1.5 text-sm text-gray-800 font-mono">
						{serverUrl}
					</code>
					<button
						type="button"
						onClick={() => handleCopy(serverUrl)}
						className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
						title="Copy URL"
					>
						{copied ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
					</button>
				</div>
				{username && (
					<p className="mt-2 text-xs text-gray-400">
						Your username: <span className="font-mono text-gray-600">{username}</span>
					</p>
				)}
			</div>

			<div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
				<Tabs tabs={osTabs} activeTab={osTab} onChange={setOsTab} />
				<div className="p-5">
					{osTab === 'macos' && (
						<ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside">
							<li>Create an access token in the "Access Tokens" tab</li>
							<li>
								Open <strong>Finder</strong> &rarr; <strong>Go</strong> &rarr;{' '}
								<strong>Connect to Server</strong> (&#8984;K)
							</li>
							<li>Paste the server URL above and click Connect</li>
							<li>Enter your MiniNAS username and the generated token as the password</li>
						</ol>
					)}
					{osTab === 'windows' && (
						<ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside">
							<li>Create an access token in the "Access Tokens" tab</li>
							<li>
								Open <strong>File Explorer</strong> &rarr; right-click <strong>This PC</strong>{' '}
								&rarr; <strong>Map Network Drive</strong>
							</li>
							<li>Paste the server URL in the Folder field</li>
							<li>Check "Connect using different credentials"</li>
							<li>Enter your MiniNAS username and the generated token as the password</li>
						</ol>
					)}
					{osTab === 'linux' && (
						<ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside">
							<li>Create an access token in the "Access Tokens" tab</li>
							<li>
								Open your file manager and enter{' '}
								<code className="bg-gray-100 px-1 rounded text-xs">davs://</code> followed by the
								server address in the location bar
							</li>
							<li>
								Or mount via command line:{' '}
								<code className="bg-gray-100 px-1 rounded text-xs">
									sudo mount -t davfs {serverUrl} /mnt/mininas
								</code>
							</li>
							<li>Enter your MiniNAS username and the generated token as the password</li>
						</ol>
					)}
				</div>
			</div>
		</div>
	)
}

function AccessTokens() {
	const { data, isLoading } = useWebDAVTokens()
	const createMutation = useCreateWebDAVToken()
	const revokeMutation = useRevokeWebDAVToken()
	const [label, setLabel] = useState('')
	const [newToken, setNewToken] = useState<string | null>(null)
	const [copied, setCopied] = useState(false)

	const handleCreate = async () => {
		if (!label.trim()) return
		const result = await createMutation.mutateAsync(label.trim())
		setNewToken(result.token)
		setLabel('')
	}

	const handleCopy = async (text: string) => {
		await navigator.clipboard.writeText(text)
		setCopied(true)
		setTimeout(() => setCopied(false), 2000)
	}

	const handleRevoke = (id: string) => {
		if (confirm('Revoke this token? Any clients using it will be disconnected.')) {
			revokeMutation.mutate(id)
		}
	}

	return (
		<div className="space-y-4">
			{/* Create Token */}
			<div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
				<h3 className="text-sm font-semibold text-gray-900 mb-3">Create Access Token</h3>
				<div className="flex gap-2">
					<input
						type="text"
						value={label}
						onChange={(e) => setLabel(e.target.value)}
						onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
						placeholder="Token label (e.g. MacBook, Desktop)"
						className="flex-1 bg-gray-50 border border-gray-200 rounded-md px-3 py-1.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
					/>
					<button
						type="button"
						onClick={handleCreate}
						disabled={!label.trim() || createMutation.isPending}
						className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-brand-600 hover:bg-brand-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{createMutation.isPending ? (
							<Loader2 size={16} className="animate-spin" />
						) : (
							<Plus size={16} />
						)}
						Create
					</button>
				</div>

				{newToken && (
					<div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-lg p-4">
						<p className="text-sm font-medium text-emerald-800 mb-2">
							Token created! Copy it now -- it won't be shown again.
						</p>
						<div className="flex items-center gap-2">
							<code className="flex-1 bg-white border border-emerald-200 rounded px-3 py-1.5 text-sm font-mono text-emerald-900 break-all">
								{newToken}
							</code>
							<button
								type="button"
								onClick={() => handleCopy(newToken)}
								className="p-1.5 rounded-md hover:bg-emerald-100 text-emerald-600 transition-colors shrink-0"
								title="Copy token"
							>
								{copied ? <Check size={16} /> : <Copy size={16} />}
							</button>
						</div>
						<button
							type="button"
							onClick={() => setNewToken(null)}
							className="mt-2 text-xs text-emerald-600 hover:text-emerald-800 transition-colors"
						>
							Dismiss
						</button>
					</div>
				)}
			</div>

			{/* Token List */}
			<div className="bg-white border border-gray-200 rounded-lg shadow-sm">
				<div className="px-5 py-3 border-b border-gray-100">
					<h3 className="text-sm font-semibold text-gray-900">Active Tokens</h3>
				</div>
				{isLoading ? (
					<div className="flex justify-center py-8">
						<Loader2 size={20} className="animate-spin text-gray-400" />
					</div>
				) : !data?.tokens.length ? (
					<div className="text-center py-8 text-sm text-gray-400">
						No tokens yet. Create one to connect via WebDAV.
					</div>
				) : (
					<div className="divide-y divide-gray-100">
						{data.tokens.map((token) => (
							<div key={token.id} className="flex items-center justify-between px-5 py-3">
								<div className="flex items-center gap-3 min-w-0">
									<Key size={16} className="text-gray-400 shrink-0" />
									<div className="min-w-0">
										<p className="text-sm font-medium text-gray-800 truncate">{token.label}</p>
										<p className="text-xs text-gray-400">
											Created {formatDate(token.created_at)}
											{token.last_used_at && ` · Last used ${formatDate(token.last_used_at)}`}
										</p>
									</div>
								</div>
								<button
									type="button"
									onClick={() => handleRevoke(token.id)}
									disabled={revokeMutation.isPending}
									className="p-1.5 rounded-md hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors shrink-0"
									title="Revoke token"
								>
									<Trash2 size={16} />
								</button>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	)
}

function WebDAVTokensInner() {
	const { isAuthenticated, isLoading: authLoading, user } = useAuth()
	const [activeTab, setActiveTab] = useState('guide')

	if (authLoading) {
		return (
			<div className="flex items-center justify-center min-h-screen">
				<Loader2 size={32} className="animate-spin text-gray-400" />
			</div>
		)
	}

	if (!isAuthenticated) {
		if (typeof window !== 'undefined') window.location.href = withBase('/login')
		return null
	}

	const serverUrl =
		typeof window !== 'undefined'
			? `${window.location.protocol}//${window.location.host}${withBase('/dav/')}`
			: ''

	return (
		<div className="max-w-2xl mx-auto px-4 py-6">
			{/* Header */}
			<div className="flex items-center gap-3 mb-6">
				<a
					href={withBase('/')}
					className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
					title="Back to files"
				>
					<ArrowLeft size={18} />
				</a>
				<div className="flex items-center gap-2.5">
					<HardDrive size={22} className="text-gray-700" />
					<h1 className="text-xl font-semibold text-gray-900">Network Drive Access</h1>
				</div>
			</div>

			<Tabs tabs={mainTabs} activeTab={activeTab} onChange={setActiveTab} />

			<div className="mt-6">
				{activeTab === 'guide' && <SetupGuide serverUrl={serverUrl} username={user?.username} />}
				{activeTab === 'tokens' && <AccessTokens />}
			</div>
		</div>
	)
}

export default function WebDAVTokens() {
	return (
		<QueryClientProvider client={queryClient}>
			<WebDAVTokensInner />
		</QueryClientProvider>
	)
}
