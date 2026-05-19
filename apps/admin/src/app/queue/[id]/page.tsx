import { createSupabaseServerClient } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { claimQueueItem, releaseClaim } from "./actions";

interface PageProps {
  params: Promise<{ id: string }>;
}

const CLAIM_TTL_MS = 30 * 60 * 1000;

export default async function QueueDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const currentEmail = user?.email ?? null;

  const { data: experience, error } = await supabase
    .from("experiences")
    .select(
      "id, title, one_liner, why_it_matters, category, city_code, confidence_level, status, created_at, updated_at",
    )
    .eq("id", id)
    .eq("status", "candidate")
    .single();

  if (error || !experience) {
    notFound();
  }

  const { data: sources } = await supabase
    .from("sources")
    .select("id, source_type, source_url, weight, verified_at")
    .eq("experience_id", id)
    .order("weight", { ascending: false });

  const { data: queueRow } = await supabase
    .from("editor_queue")
    .select("claimed_by, claimed_at")
    .eq("experience_id", id)
    .maybeSingle();

  const now = Date.now();
  const claimedAt = queueRow?.claimed_at ? new Date(queueRow.claimed_at).getTime() : null;
  const isClaimActive = claimedAt !== null && now - claimedAt < CLAIM_TTL_MS;
  const claimedBy = isClaimActive ? (queueRow?.claimed_by ?? null) : null;
  const isClaimedByMe = claimedBy !== null && claimedBy === currentEmail;
  const isClaimedByOther = claimedBy !== null && !isClaimedByMe;

  const claimAction = claimQueueItem.bind(null, id);
  const releaseAction = releaseClaim.bind(null, id);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="border-b border-gray-800 px-6 py-4 flex items-center gap-4">
        <Link href="/queue" className="text-gray-400 hover:text-gray-200 text-sm transition-colors">
          ← Queue
        </Link>
        <h1 className="text-xl font-semibold truncate">{experience.title}</h1>

        <div className="ml-auto flex items-center gap-3">
          {isClaimedByMe && (
            <span className="text-xs bg-green-900 text-green-300 px-2.5 py-1 rounded font-medium">
              Claimed by you
            </span>
          )}
          {isClaimedByOther && (
            <span className="text-xs bg-yellow-900 text-yellow-300 px-2.5 py-1 rounded font-medium">
              Claimed by {claimedBy}
            </span>
          )}

          {!isClaimedByOther && !isClaimedByMe && (
            <form action={claimAction}>
              <button
                type="submit"
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-sm font-medium transition-colors"
              >
                Claim
              </button>
            </form>
          )}

          {isClaimedByMe && (
            <form action={releaseAction}>
              <button
                type="submit"
                className="px-4 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm font-medium transition-colors"
              >
                Release
              </button>
            </form>
          )}
        </div>
      </header>

      <div className="px-6 py-6 max-w-3xl space-y-6">
        <section className="space-y-2">
          <div className="flex gap-3 flex-wrap">
            <Tag label={experience.category} />
            <Tag label={experience.city_code || "unknown"} variant="city" />
            <Tag label={`confidence ${experience.confidence_level}/5`} variant="confidence" />
          </div>
          <p className="text-gray-300">{experience.one_liner}</p>
          <p className="text-gray-400 text-sm">{experience.why_it_matters}</p>
        </section>

        <section>
          <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-3">
            Sources ({sources?.length ?? 0})
          </h2>
          {sources && sources.length > 0 ? (
            <ul className="space-y-2">
              {sources.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between bg-gray-900 rounded px-4 py-2 text-sm"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-gray-400 font-mono text-xs w-24">{s.source_type}</span>
                    <a
                      href={s.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 truncate max-w-xs"
                    >
                      {s.source_url}
                    </a>
                  </div>
                  <span className="text-gray-500 text-xs ml-4">weight {s.weight}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500 text-sm">No sources attached.</p>
          )}
        </section>

        <section className="text-xs text-gray-500 space-y-1">
          <p>Created: {new Date(experience.created_at).toLocaleString()}</p>
          <p>Updated: {new Date(experience.updated_at).toLocaleString()}</p>
          <p>
            ID: <span className="font-mono">{experience.id}</span>
          </p>
        </section>
      </div>
    </div>
  );
}

function Tag({
  label,
  variant = "default",
}: {
  label: string;
  variant?: "default" | "city" | "confidence";
}) {
  const cls =
    variant === "city"
      ? "bg-purple-900 text-purple-300"
      : variant === "confidence"
        ? "bg-blue-900 text-blue-300"
        : "bg-gray-800 text-gray-300";
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}
