// FILE: apps/frontend/components/ShopStorefront.tsx (NEW FILE)
//
// Pure presentational SVG illustration. Five tiers, each layering on top
// of the previous one (a higher tier never removes what a lower tier
// already showed) so progress always reads as "more," never "different."
// Server component — no interactivity, just conditional rendering based
// on the numeric tier passed in.

type ShopStorefrontProps = {
    tier: number; // 1-5
    displayName: string;
  };
  
  export default function ShopStorefront({ tier, displayName }: ShopStorefrontProps) {
    const initial = displayName.trim().charAt(0).toUpperCase() || "R";
  
    return (
      <div className="relative rounded-2xl border border-white/10 bg-gradient-to-b from-[#150f36] to-[#1e1b4b] p-6 sm:p-8 overflow-hidden">
        {/* Ambient glow — brighter at higher tiers */}
        <div
          className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 h-40 w-64 rounded-full blur-3xl transition-opacity"
          style={{
            background: "radial-gradient(circle, rgba(240,171,252,0.5) 0%, rgba(240,171,252,0) 70%)",
            opacity: 0.15 + tier * 0.12,
          }}
        />
  
        <svg viewBox="0 0 320 200" className="relative z-10 w-full h-auto max-w-sm mx-auto">
          {/* Ground */}
          <rect x="0" y="170" width="320" height="30" fill="#0f0b26" />
          <rect x="0" y="168" width="320" height="3" fill="#3730a3" opacity="0.4" />
  
          {/* Building base — always present, from Tier 1 */}
          <rect x="60" y="80" width="200" height="90" rx="4" fill="#2e2a5e" stroke="#4c1d95" strokeWidth="2" />
  
          {/* Door */}
          <rect x="145" y="130" width="30" height="40" rx="2" fill="#1e1b4b" stroke="#6d28d9" strokeWidth="1.5" />
  
          {/* Window — dark at Tier 1, lit from Tier 2+ */}
          <rect
            x="80"
            y="100"
            width="45"
            height="35"
            rx="2"
            fill={tier >= 2 ? "#fde68a" : "#1e1b4b"}
            fillOpacity={tier >= 2 ? 0.85 : 1}
            stroke="#6d28d9"
            strokeWidth="1.5"
          />
          <rect
            x="195"
            y="100"
            width="45"
            height="35"
            rx="2"
            fill={tier >= 2 ? "#fde68a" : "#1e1b4b"}
            fillOpacity={tier >= 2 ? 0.85 : 1}
            stroke="#6d28d9"
            strokeWidth="1.5"
          />
  
          {/* Shelf silhouettes inside the lit windows — Tier 2+ */}
          {tier >= 2 && (
            <>
              <rect x="84" y="112" width="37" height="3" fill="#92400e" opacity="0.6" />
              <rect x="84" y="122" width="37" height="3" fill="#92400e" opacity="0.6" />
              <rect x="199" y="112" width="37" height="3" fill="#92400e" opacity="0.6" />
              <rect x="199" y="122" width="37" height="3" fill="#92400e" opacity="0.6" />
            </>
          )}
  
          {/* Roof — Tier 1+ */}
          <polygon points="50,80 160,45 270,80" fill="#4c1d95" stroke="#6d28d9" strokeWidth="2" />
  
          {/* Signboard with store initial — Tier 3+ */}
          {tier >= 3 && (
            <g>
              <rect x="130" y="58" width="60" height="22" rx="5" fill="#f0abfc" />
              <text x="160" y="74" textAnchor="middle" fontSize="14" fontWeight="800" fill="#4c1d95">
                {initial}
              </text>
            </g>
          )}
  
          {/* String lights along the roofline — Tier 4+ */}
          {tier >= 4 && (
            <g>
              <path d="M55,82 Q160,100 265,82" stroke="#f0abfc" strokeWidth="1.5" fill="none" opacity="0.6" />
              {[70, 110, 150, 190, 230, 250].map((cx, i) => (
                <circle key={cx} cx={cx} cy={82 + Math.sin(i) * 4 + 8} r="2.5" fill="#fde68a" />
              ))}
            </g>
          )}
  
          {/* Potted plant by the door — Tier 4+ */}
          {tier >= 4 && (
            <g>
              <rect x="130" y="155" width="10" height="15" rx="1" fill="#7c2d12" />
              <circle cx="135" cy="150" r="9" fill="#16a34a" />
            </g>
          )}
  
          {/* Customer silhouettes + sparkle accents — Tier 5 only */}
          {tier >= 5 && (
            <g>
              <circle cx="35" cy="160" r="7" fill="#c4b5fd" />
              <rect x="29" y="167" width="12" height="20" rx="4" fill="#c4b5fd" />
              <circle cx="285" cy="162" r="7" fill="#f0abfc" />
              <rect x="279" y="169" width="12" height="18" rx="4" fill="#f0abfc" />
              <text x="30" y="40" fontSize="16" fill="#fde68a">✦</text>
              <text x="270" y="30" fontSize="12" fill="#f0abfc">✦</text>
              <text x="290" y="55" fontSize="10" fill="#fde68a">✦</text>
            </g>
          )}
        </svg>
      </div>
    );
  }