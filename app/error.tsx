"use client";

/**
 * Filet de sécurité global.
 *
 * Sans lui, la moindre exception dans un composant efface toute la page et
 * laisse « Application error » — le message le plus inutile qui soit, puisqu'il
 * ne dit ni quoi, ni où. Ici on attrape l'erreur, on montre son message, et on
 * garde un bouton pour repartir. L'application reste debout.
 */
export default function Error({
  error, reset,
}: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ciel-50 p-6">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-carte ring-1 ring-ciel-100">
        <h1 className="font-display text-lg font-bold text-navy-900">Une erreur est survenue</h1>
        <p className="mt-2 text-sm text-acier">
          L'application a rencontré un problème en chargeant cette page. Rien n'est
          perdu : réessayez, ou revenez à l'accueil.
        </p>
        <pre className="mt-4 overflow-x-auto rounded-lg bg-ciel-50 p-3 text-xs text-red-700">
          {error.message || "Erreur inconnue"}
        </pre>
        <div className="mt-5 flex gap-2">
          <button
            onClick={reset}
            className="flex-1 rounded-lg bg-navy-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-700"
          >
            Réessayer
          </button>
          <a
            href="/"
            className="flex-1 rounded-lg border border-ciel-100 px-4 py-2.5 text-center text-sm text-navy-900 hover:bg-ciel-50"
          >
            Accueil
          </a>
        </div>
        {error.digest && (
          <p className="mt-3 font-mono text-[11px] text-ciel-300">Référence : {error.digest}</p>
        )}
      </div>
    </div>
  );
}
