// ============================================================
// src/components/ScannerQR.js — Lecture du QR code de retrait
// ============================================================
// Utilise la caméra (webcam, ou caméra arrière sur tablette/téléphone)
// et décode l'image avec jsQR. La caméra n'est accessible que sur
// une page HTTPS (ou http://localhost en développement).
// ============================================================

import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { CameraOff, Loader2 } from 'lucide-react';

// Format des numéros générés par le serveur : TCP-<timestamp>-<6 hex>
const RE_NUMERO = /^TCP-\d+-[0-9A-F]{6}$/i;
const INTERVALLE_MS = 150;
const LARGEUR_ANALYSE = 640;

export default function ScannerQR({ onResultat }) {
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);
  const [etat, setEtat]     = useState('demarrage'); // demarrage | actif | erreur
  const [erreur, setErreur] = useState('');
  const [inconnu, setInconnu] = useState(false);
  const onResultatRef = useRef(onResultat);
  onResultatRef.current = onResultat;

  useEffect(() => {
    let flux = null;
    let minuterie = null;
    let termine = false;

    const arreter = () => {
      termine = true;
      clearTimeout(minuterie);
      flux?.getTracks().forEach(t => t.stop());
    };

    const analyser = () => {
      if (termine) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA && video.videoWidth) {
        const echelle = Math.min(1, LARGEUR_ANALYSE / video.videoWidth);
        canvas.width  = Math.round(video.videoWidth * echelle);
        canvas.height = Math.round(video.videoHeight * echelle);
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(image.data, image.width, image.height, { inversionAttempts: 'dontInvert' });
        if (code?.data) {
          const valeur = code.data.trim();
          if (RE_NUMERO.test(valeur)) {
            arreter();
            onResultatRef.current(valeur.toUpperCase());
            return;
          }
          setInconnu(true);
        }
      }
      minuterie = setTimeout(analyser, INTERVALLE_MS);
    };

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setErreur('La caméra n\'est disponible que sur une page sécurisée (https). Saisis le numéro à la main.');
        setEtat('erreur');
        return;
      }
      try {
        flux = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        if (termine) { flux.getTracks().forEach(t => t.stop()); return; }
        const video = videoRef.current;
        video.srcObject = flux;
        await video.play();
        setEtat('actif');
        analyser();
      } catch (err) {
        setErreur(err?.name === 'NotAllowedError'
          ? 'Accès à la caméra refusé. Autorise-le dans ton navigateur, ou saisis le numéro à la main.'
          : 'Aucune caméra disponible. Saisis le numéro à la main.');
        setEtat('erreur');
      }
    })();

    return arreter;
  }, []);

  if (etat === 'erreur') {
    return (
      <div className="tc-scanner tc-scanner-erreur" role="alert">
        <CameraOff size={22} />
        <span>{erreur}</span>
      </div>
    );
  }

  return (
    <div className="tc-scanner">
      <video ref={videoRef} muted playsInline aria-label="Image de la caméra" />
      <canvas ref={canvasRef} hidden />
      <div className="tc-scanner-viseur" aria-hidden="true" />
      <div className="tc-scanner-legende">
        {etat === 'demarrage'
          ? <><Loader2 size={14} className="tc-tourne" /> Ouverture de la caméra…</>
          : inconnu
            ? 'Ce QR code n\'est pas un QR code Take & Care.'
            : 'Place le QR code du client dans le cadre'}
      </div>
    </div>
  );
}
