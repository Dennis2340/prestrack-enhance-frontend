export default function DashboardOverview() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Overview</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4 text-gray-700">Patients: —</div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 text-gray-700">Conversations: —</div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 text-gray-700">Tasks (Reminders): —</div>
      </div>
      <div className="rounded-lg border border-gray-200 bg-white p-6 text-gray-500">Recent activity will appear here.</div>
    </div>
  );
}
