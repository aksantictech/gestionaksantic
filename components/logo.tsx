"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/**
 * La marque Aksantic, reconstruite en SVG.
 *
 * Pourquoi pas le JPEG : il a un fond blanc opaque (71 % du fichier), il ferait
 * une tache sur le panneau navy, et une image plate ne tourne pas.
 *
 * Le principe est celui du logo : une sphère de nids d'abeille, dense à gauche,
 * qui se disloque en hexagones libres vers la droite. Ici la sphère tourne
 * réellement — les hexagones sont projetés depuis des coordonnées sphériques,
 * pas dessinés en trompe-l'œil.
 *
 * Palette extraite du logo :
 *   #03357E navy · #0F3161 · #2A427E · #4079B2 acier · #74A0C9 ciel
 */

const PALETTE = ["#03357E", "#0F3161", "#2A427E", "#4079B2", "#5A8CC0", "#74A0C9"];
const PALETTE_CLAIRE = ["#74A0C9", "#5A8CC0", "#4079B2", "#93B8DA", "#2A427E", "#A9C6E3"];

/** Aléatoire déterministe : le serveur et le client doivent dessiner pareil. */
function rand(seed: number) {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

type Cell = { lat: number; lon: number; teinte: number; jitterX: number; jitterY: number };

/** Grille sphérique : les rangées se resserrent vers les pôles. */
function construireGrille(): Cell[] {
  const cells: Cell[] = [];
  let seed = 1;
  for (let i = -3; i <= 3; i++) {
    const lat = (i * 21 * Math.PI) / 180;
    const n = Math.max(3, Math.round(11 * Math.cos(lat)));
    for (let j = 0; j < n; j++) {
      const lon = (j / n) * Math.PI * 2 + (i % 2 ? Math.PI / n : 0);
      cells.push({
        lat, lon,
        teinte: Math.floor(rand(seed++) * PALETTE.length),
        jitterX: rand(seed++) - 0.5,
        jitterY: rand(seed++) - 0.5,
      });
    }
  }
  return cells;
}

/** Les hexagones échappés, ceux qui flottent à droite de la sphère. */
const LIBRES = Array.from({ length: 7 }, (_, i) => ({
  x: 66 + rand(i * 3 + 40) * 30,
  y: 16 + rand(i * 3 + 41) * 62,
  r: 3 + rand(i * 3 + 42) * 3.4,
  teinte: Math.floor(rand(i * 3 + 43) * PALETTE.length),
  delai: rand(i * 3 + 44) * 4,
  duree: 3.5 + rand(i * 3 + 45) * 3,
}));

const hexagone = (cx: number, cy: number, r: number) =>
  Array.from({ length: 6 }, (_, k) => {
    const a = (Math.PI / 3) * k - Math.PI / 2;
    return `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`;
  }).join(" ");

export function AksanticMark({
  size = 40,
  clair = false,
  anime = true,
  className = "",
}: { size?: number; clair?: boolean; anime?: boolean; className?: string }) {
  const grille = useMemo(construireGrille, []);
  const palette = clair ? PALETTE_CLAIRE : PALETTE;
  const [rot, setRot] = useState(0);
  const raf = useRef<number>();

  useEffect(() => {
    if (!anime) return;
    // Le mouvement est un agrément, jamais une obligation.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let dernier = 0;
    const boucle = (t: number) => {
      // ~24 images/s : la rotation reste fluide à l'œil et laisse le processeur
      // tranquille sur une machine modeste.
      if (t - dernier > 42) {
        setRot((r) => (r + 0.022) % (Math.PI * 2));
        dernier = t;
      }
      raf.current = requestAnimationFrame(boucle);
    };
    raf.current = requestAnimationFrame(boucle);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [anime]);

  const CX = 40, CY = 50, R = 31;

  const faces = grille
    .map((c, i) => {
      const lon = c.lon + rot;
      const x3 = Math.cos(c.lat) * Math.sin(lon);
      const z3 = Math.cos(c.lat) * Math.cos(lon);
      const y3 = Math.sin(c.lat);
      if (z3 <= 0.02) return null; // hémisphère arrière : invisible

      // Dislocation : plus l'hexagone part vers la droite, plus il s'efface
      // et s'écarte. C'est la signature du logo.
      const d = Math.max(0, Math.min(1, (x3 + 0.15) / 0.85));
      const opacite = (1 - d * d) * (0.35 + 0.65 * z3);
      if (opacite < 0.06) return null;

      const ecart = d * d * 14;
      return {
        key: i,
        cx: CX + R * x3 + c.jitterX * ecart,
        cy: CY - R * y3 + c.jitterY * ecart,
        r: (2.6 + 1.7 * z3) * (1 - d * 0.35),
        fill: palette[c.teinte],
        opacite,
        z: z3,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a!.z - b!.z); // les plus proches par-dessus

  return (
    <svg
      viewBox="0 0 100 100" width={size} height={size} className={className}
      role="img" aria-label="Aksantic Technology"
    >
      {faces.map((f) => (
        <polygon
          key={f!.key} points={hexagone(f!.cx, f!.cy, f!.r)}
          fill={f!.fill} opacity={f!.opacite}
        />
      ))}

      {LIBRES.map((h, i) => (
        <polygon
          key={`libre-${i}`} points={hexagone(h.x, h.y, h.r)}
          fill={palette[h.teinte]} opacity={0.5}
          className={anime ? "hex-flotte" : undefined}
          style={anime ? { animationDelay: `${h.delai}s`, animationDuration: `${h.duree}s` } : undefined}
        />
      ))}
    </svg>
  );
}

/** La marque avec son nom, telle qu'elle apparaît sur le logo. */
export function AksanticLogo({
  size = 36, clair = false, sousTitre = true,
}: { size?: number; clair?: boolean; sousTitre?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <AksanticMark size={size} clair={clair} />
      <div className="leading-none">
        <p className={`text-lg font-bold tracking-tight ${clair ? "text-white" : "text-navy-900"}`}>
          AKSANTIC
        </p>
        {sousTitre && (
          <p className={`mt-0.5 text-[9px] font-medium tracking-[0.3em] ${clair ? "text-ciel-300" : "text-acier"}`}>
            TECHNOLOGY
          </p>
        )}
      </div>
    </div>
  );
}
