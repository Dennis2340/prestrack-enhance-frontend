export default function MedicationsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Medications</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-lg border border-gray-200 bg-white p-6 text-gray-700">
          Prescriptions: —
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-6 text-gray-700">
          Upcoming reminders: —
        </div>
      </div>
      <div className="rounded-lg border border-gray-200 bg-white p-6 text-gray-500">Create prescriptions and schedules will appear here.</div>
    </div>
  );
}
