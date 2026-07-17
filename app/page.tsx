"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-client";
import { SOCIETE } from "@/lib/money";
import { AksanticMark, AksanticLogo } from "@/components/logo";
import { FondNavy } from "@/components/fond";
import { Loader2, ArrowRight, ExternalLink } from "lucide-react";

const SITE = "https://www.aksantictech.com";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [mdp, setMdp] = useState("");
  const [erreur, setErreur] = useState("");
  const [charge, setCharge] = useState(false);

  const connecter = async (e: React.FormEvent) => {
    e.preventDefault();
    setErreur("");
    setCharge(true);

    // try/catch/finally obligatoire : sans lui, la moindre exception laisse le
    // bouton tourner indéfiniment, sans un mot. Un écran qui échoue en silence
    // est un écran cassé.
    try {
      const supabase = supabaseBrowser();

      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: mdp,
      });

      if (error) {
        // On ne dit jamais lequel des deux est faux : ça révélerait quels
        // comptes existent.
        setErreur(
          error.message.toLowerCase().includes("fetch")
            ? "Serveur injoignable. Vérifiez votre connexion."
            : "Adresse ou mot de passe incorrect.",
        );
        setCharge(false);
        return;
      }

      // La vérification du compte se refait de toute façon côté serveur dans
      // app/page.tsx. Ici, c'est seulement pour donner un message clair plutôt
      // qu'un aller-retour muet.
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profil } = await supabase
          .from("profiles").select("is_active").eq("id", user.id).single();

        if (profil && !profil.is_active) {
          await supabase.auth.signOut();
          setErreur("Ce compte a été désactivé. Contactez un administrateur.");
          setCharge(false);
          return;
        }
      }

      // replace, pas push : on ne laisse pas la page de connexion dans
      // l'historique. Bouton Retour = retour au registre, pas au formulaire.
      router.replace("/");
      router.refresh();
    } catch (e) {
      console.error("Connexion :", e);
      setErreur(
        "La connexion a échoué. Si cela se reproduit, prévenez l'administrateur : " +
        (e as Error).message,
      );
      setCharge(false);
    }
  };

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[1.15fr_1fr]">
      {/* ------------------------------------------------ le panneau de marque */}
      <div className="relative hidden overflow-hidden bg-navy-900 lg:flex lg:flex-col">
        <FondNavy />

        <header className="relative z-10 px-12 pt-10">
          <AksanticLogo size={40} clair />
        </header>

        {/* La sphère est le sujet. Tout le reste lui laisse la place. */}
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-12">
          <div className="relative">
            <div className="respire absolute inset-0 -m-16 rounded-full bg-acier blur-3xl" />
            <AksanticMark size={300} clair className="relative" />
          </div>

          <div className="monte mt-10 max-w-md text-center">
            <h2 className="font-display text-3xl font-extrabold leading-tight tracking-tight text-white">
              Le registre de l'entreprise.
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-ciel-200">
              Clients, factures, encaissements, dépenses, contrats, courrier, équipe.
              Un seul endroit, à jour, consultable depuis Kinshasa comme d'ailleurs.
            </p>
          </div>
        </div>

        <footer className="relative z-10 flex items-end justify-between gap-6 border-t border-white/10 px-12 py-6">
          <dl className="space-y-1 font-mono text-[11px] text-ciel-300">
            <div className="flex gap-3"><dt className="w-12 text-acier-500">RCCM</dt><dd>{SOCIETE.rccm}</dd></div>
            <div className="flex gap-3"><dt className="w-12 text-acier-500">Id.Nat</dt><dd>{SOCIETE.idNat}</dd></div>
          </dl>
          <a
            href={SITE} target="_blank" rel="noreferrer"
            className="flex shrink-0 items-center gap-1.5 text-xs text-ciel-300 transition-colors hover:text-orchidee"
          >
            aksantictech.com <ExternalLink size={12} />
          </a>
        </footer>
      </div>

      {/* ------------------------------------------------------- le formulaire */}
      <div className="flex min-h-screen flex-col justify-center bg-white px-6 py-12 sm:px-12">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-10 flex justify-center lg:hidden">
            <AksanticLogo size={52} />
          </div>

          <div className="monte">
            <h1 className="font-display text-2xl font-extrabold tracking-tight">Connexion</h1>
            <p className="mt-1.5 text-sm text-acier">
              Avec l'adresse que votre administrateur vous a communiquée.
            </p>
          </div>

          <form onSubmit={connecter} className="monte monte-2 mt-9 space-y-5">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-acier">
                Adresse email
              </span>
              <input
                type="email" required autoComplete="email" autoFocus
                value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="prenom@aksantictech.com"
                className="champ"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-acier">
                Mot de passe
              </span>
              <input
                type="password" required autoComplete="current-password"
                value={mdp} onChange={(e) => setMdp(e.target.value)}
                className="champ"
              />
            </label>

            {erreur && (
              <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
                {erreur}
              </p>
            )}

            <button
              type="submit" disabled={charge}
              className="group flex w-full items-center justify-center gap-2 rounded-lg bg-navy-900 px-4 py-3 text-sm font-semibold text-white shadow-carte transition-all hover:bg-navy-700 hover:shadow-leve disabled:opacity-60"
            >
              {charge ? (
                <><Loader2 size={16} className="animate-spin" /> Connexion…</>
              ) : (
                <>Se connecter <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" /></>
              )}
            </button>
          </form>

          <div className="mt-10 border-t border-ciel-100 pt-6">
            <p className="text-xs leading-relaxed text-acier">
              Pas de compte ? Ils sont créés par un administrateur depuis l'onglet Admin.
              Le mot de passe se transmet de vive voix, jamais par message.
            </p>
            <a
              href={SITE} target="_blank" rel="noreferrer"
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-orchidee-600 transition-colors hover:text-navy-900"
            >
              www.aksantictech.com <ExternalLink size={12} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
