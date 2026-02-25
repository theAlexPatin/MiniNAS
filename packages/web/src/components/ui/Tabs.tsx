interface Tab {
	id: string
	label: string
}

interface TabsProps {
	tabs: Tab[]
	activeTab: string
	onChange: (id: string) => void
}

export default function Tabs({ tabs, activeTab, onChange }: TabsProps) {
	return (
		<div className="flex border-b border-gray-200">
			{tabs.map((tab) => (
				<button
					key={tab.id}
					type="button"
					onClick={() => onChange(tab.id)}
					className={`px-4 py-2 text-sm font-medium transition-colors relative ${
						activeTab === tab.id
							? 'text-brand-600'
							: 'text-gray-500 hover:text-gray-700'
					}`}
				>
					{tab.label}
					{activeTab === tab.id && (
						<span className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-600" />
					)}
				</button>
			))}
		</div>
	)
}
