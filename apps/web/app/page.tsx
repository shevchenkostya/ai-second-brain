export default function Home() {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-indigo-500 flex items-center justify-center text-white text-2xl font-bold mx-auto mb-6">
          AI
        </div>
        <h1 className="text-2xl font-semibold text-gray-900">AI Second Brain</h1>
        <p className="mt-2 text-gray-400 text-sm max-w-xs mx-auto">
          Upload documents, index them, and chat with your knowledge base
        </p>
        <div className="mt-8 flex gap-3 justify-center">
          <a
            href="/documents"
            className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Documents
          </a>
          <a
            href="/chat"
            className="px-4 py-2 rounded-lg bg-indigo-500 text-white text-sm font-medium hover:bg-indigo-600 transition-colors"
          >
            Start chatting
          </a>
        </div>
      </div>
    </div>
  );
}
