interface LogoProps {
  variant?: "icon" | "full";
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizes = { sm: 24, md: 32, lg: 44 };

export default function Logo({ variant = "full", size = "md", className = "" }: LogoProps) {
  const px = sizes[size];

  if (variant === "icon") {
    return (
      <div className={`logo-s2g logo-s2g--icon ${className}`} style={{ width: px, height: px }} aria-hidden>
        <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
          <rect width="48" height="48" rx="10" fill="var(--color-accent-muted)" />
          <text x="24" y="32" textAnchor="middle" fill="var(--color-accent)" fontSize="22" fontWeight="700" fontFamily="var(--font-sans)">S2G</text>
        </svg>
      </div>
    );
  }

  return (
    <div className={`logo-s2g logo-s2g--full ${className}`} aria-hidden>
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: px, height: px, flexShrink: 0 }}>
        <rect width="48" height="48" rx="10" fill="var(--color-accent-muted)" />
        <text x="24" y="30" textAnchor="middle" fill="var(--color-accent)" fontSize="18" fontWeight="700" fontFamily="var(--font-sans)">S2G</text>
      </svg>
      <div className="logo-s2g__text">
        <span className="logo-s2g__brand">S2G</span>
        <span className="logo-s2g__maroc">Maroc</span>
      </div>
    </div>
  );
}
