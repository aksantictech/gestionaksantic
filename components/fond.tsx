/**
 * Arrière-plans.
 *
 * Le motif reprend la trame du logo : un nid d'abeille. Il reste très en
 * retrait — un fond doit se remarquer une fois, à la première seconde, puis
 * disparaître. Un fond qu'on voit encore au bout d'une heure de saisie est un
 * fond raté.
 */

function TrameHex({ id, couleur, opacite }: { id: string; couleur: string; opacite: number }) {
  return (
    <pattern id={id} width="56" height="48.5" patternUnits="userSpaceOnUse" patternTransform="scale(1.4)">
      <path
        d="M14 0 L28 8 L28 24 L14 32 L0 24 L0 8 Z M42 0 L56 8 L56 24 L42 32 L28 24 L28 8 Z M14 32 L28 40 L28 56 L14 64 L0 56 L0 40 Z"
        fill="none" stroke={couleur} strokeWidth="1" opacity={opacite}
      />
    </pattern>
  );
}

/** Panneau navy de la page de connexion : trame claire + halo. */
export function FondNavy() {
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
      <defs>
        <TrameHex id="trame-navy" couleur="#74A0C9" opacite={0.22} />
        <radialGradient id="halo" cx="50%" cy="45%" r="70%">
          <stop offset="0%" stopColor="#4079B2" stopOpacity="0.5" />
          <stop offset="60%" stopColor="#03357E" stopOpacity="0.1" />
          <stop offset="100%" stopColor="#02224F" stopOpacity="0.35" />
        </radialGradient>
        {/* Une pointe d'orchidée en bas à droite. Le violet du logo, à dose homéopathique. */}
        <radialGradient id="orchidee-coin" cx="88%" cy="92%" r="45%">
          <stop offset="0%" stopColor="#C38CD4" stopOpacity="0.20" />
          <stop offset="100%" stopColor="#C38CD4" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#trame-navy)" />
      <rect width="100%" height="100%" fill="url(#halo)" />
      <rect width="100%" height="100%" fill="url(#orchidee-coin)" />
    </svg>
  );
}

/** Fond de l'application : la même trame, presque effacée. */
export function FondClair() {
  return (
    <svg className="pointer-events-none fixed inset-0 -z-10 h-full w-full" aria-hidden="true">
      <defs>
        <TrameHex id="trame-claire" couleur="#4079B2" opacite={0.13} />
        <radialGradient id="halo-clair" cx="85%" cy="0%" r="60%">
          <stop offset="0%" stopColor="#74A0C9" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#74A0C9" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#trame-claire)" />
      <rect width="100%" height="100%" fill="url(#halo-clair)" />
    </svg>
  );
}
