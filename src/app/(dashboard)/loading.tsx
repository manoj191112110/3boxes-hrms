export default function DashboardLoading() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-green-500 via-emerald-500 to-teal-600 mb-4 shadow-xl shadow-green-500/20 animate-pulse ring-2 ring-green-400/10">
          <svg viewBox="0 0 30 30" className="w-7 h-7" fill="none">
            <path d="M15 2L3 8V16C3 24 8.1 31.2 15 33C21.9 31.2 27 24 27 16V8L15 2Z" fill="rgba(255,255,255,0.2)" stroke="white" strokeWidth="0.5"/>
            <path d="M9 23V11H12.5L20 20V11H23V23H19.5L12 14V23H9Z" fill="white"/>
          </svg>
        </div>
        <div className="space-y-2">
          <div className="h-3 w-32 bg-slate-200 rounded-full animate-pulse mx-auto" />
          <div className="h-2 w-24 bg-slate-100 rounded-full animate-pulse mx-auto" />
        </div>
      </div>
    </div>
  );
}
