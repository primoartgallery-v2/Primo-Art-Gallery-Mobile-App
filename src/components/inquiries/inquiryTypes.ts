export type ArtworkEnrichment = {
  imageUrl?: string | null;
  artistName?: string;
  price?: string;
  medium?: string;
  dimensions?: string;
  isLoading: boolean;
};

export function formatStatus(status: string, goldColor: string) {
  switch (status?.toLowerCase()) {
    case "contacted":
      return {
        label: "Curator Contacted",
        badgeBg: "rgba(46, 204, 113, 0.14)",
        badgeBorder: "rgba(46, 204, 113, 0.4)",
        textColor: "#2ECC71",
        icon: "chatbubbles-outline" as const,
        desc: "Our curatorial concierge has reached out to your contact on record.",
      };
    case "in_progress":
    case "under_review":
      return {
        label: "Dossier In Preparation",
        badgeBg: "rgba(52, 152, 219, 0.14)",
        badgeBorder: "rgba(52, 152, 219, 0.4)",
        textColor: "#3498DB",
        icon: "document-text-outline" as const,
        desc: "A bespoke valuation and condition dossier is currently being prepared.",
      };
    case "closed":
    case "acquired":
      return {
        label: "Acquisition Concluded",
        badgeBg: "rgba(142, 142, 147, 0.14)",
        badgeBorder: "rgba(142, 142, 147, 0.4)",
        textColor: "#8E8E93",
        icon: "checkmark-done-circle-outline" as const,
        desc: "This curatorial inquiry has been successfully fulfilled or archived.",
      };
    case "pending_review":
    default:
      return {
        label: "Under Curatorial Review",
        badgeBg: "rgba(212, 175, 55, 0.14)",
        badgeBorder: "rgba(212, 175, 55, 0.4)",
        textColor: goldColor,
        icon: "time-outline" as const,
        desc: "Our curatorial board is reviewing provenance, valuation, and custom logistics.",
      };
  }
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return "Recently Submitted";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "Recently Submitted";
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "Recently Submitted";
  }
}

export function formatDateTime(dateStr: string): string {
  if (!dateStr) return "Recently Submitted";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "Recently Submitted";
    return `${d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })} at ${d.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  } catch {
    return "Recently Submitted";
  }
}
