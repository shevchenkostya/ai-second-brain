import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900">AI Second Brain</h1>
        <p className="mt-2 text-gray-500">Personal AI-powered engineering workspace</p>
        <div className="mt-8 flex gap-4 justify-center">
          <Link
            href="/documents"
            className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-700"
          >
            Documents
          </Link>
        </div>
      </div>
    </main>
  );
}
