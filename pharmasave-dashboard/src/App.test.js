import { render, screen } from '@testing-library/react';
import App from './App';
import { erreurMotDePasse } from './utils/validation';
import { ecrireHoraires, lireHoraires, semaineParDefaut } from './utils/horaires';

beforeEach(() => localStorage.clear());

test('sans session, affiche la page de connexion', async () => {
  render(<App />);
  expect(await screen.findByText(/Bon retour/i)).toBeInTheDocument();
  expect(screen.getByText(/Mot de passe oublié/i)).toBeInTheDocument();
});

test('règle du mot de passe identique au serveur', () => {
  expect(erreurMotDePasse('court1')).toMatch(/8 caractères/);
  expect(erreurMotDePasse('sanschiffre')).toMatch(/chiffre/);
  expect(erreurMotDePasse('motdepasse1')).toBeNull();
});

test('les horaires écrits se relisent à l\'identique', () => {
  const semaine = semaineParDefaut();
  const texte = ecrireHoraires(semaine);
  expect(texte).toBe('Lun–Ven 9h00–19h30 · Sam 9h00–13h00 · Dim fermé');
  expect(lireHoraires(texte)).toEqual(semaine);
});
