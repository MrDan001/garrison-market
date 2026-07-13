// app/loading.tsx
export default function Loading() {
    return (
      <div className="min-h-screen bg-[#0D1527] flex flex-col items-center justify-center">
        {/* Brand Logo Animation */}
        <div className="relative w-16 h-16 flex items-center justify-center bg-[#F1EEE3] rounded-sm animate-pulse mb-6">
          <span className="text-[#0D1527] font-bold text-2xl" style={{ fontFamily: "var(--font-display)" }}>G</span>
          <div className="absolute inset-0 border-4 border-transparent border-t-[#E55345] rounded-sm animate-spin"></div>
        </div>
        
        {/* Loading Text */}
        <p className="text-[#F1EEE3] text-xs font-bold tracking-[0.2em] uppercase animate-bounce" style={{ fontFamily: "var(--font-mono)" }}>
          Loading Market...
        </p>
      </div>
    );
  }