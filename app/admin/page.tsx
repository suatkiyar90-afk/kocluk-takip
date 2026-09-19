import { adminListUsers } from "@/app/actions/admin-actions";
import { AdminPanel } from "./admin-panel";

export default async function AdminPage() {
  const result = await adminListUsers();

  if (result.success === false) {
    return (
      <main className="min-h-screen bg-gray-50 px-4 py-8">
        <div className="mx-auto w-full max-w-md">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            {result.message}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto w-full max-w-md">
        <AdminPanel
          initialTeachers={result.data.teachers}
          initialStudents={result.data.students}
        />
      </div>
    </main>
  );
}