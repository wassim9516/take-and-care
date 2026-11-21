import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Administration from './pages/Administration';
import ScannerQR from './components/ScannerQR';
import { RetoursProvider } from './components/ui';
import * as api from './api/client';

jest.mock('./api/client', () => ({
  getPharmaciesAdmin: jest.fn(),
  changerValidationPharmacie: jest.fn(),
  getStatsAdmin: jest.fn(),
  setDeconnexionCallback: jest.fn(),
  getMoi: jest.fn(),
}));
jest.mock('./context/AuthContext', () => ({
  useAuth: () => ({ pharmacien: { prenom: 'Ada', nom: 'Admin', estAdmin: true }, seDeconnecter: jest.fn() }),
}));

const pharmacie = {
  id: 7, nom: 'Pharmacie des Tests', adresse: '3 rue du Test, Lyon', telephone: '+33400000000',
  latitude: 45.76, longitude: 4.83, valide: false, createdAt: '2026-11-20T10:00:00Z', nbOffres: 0,
  pharmaciens: [{ id: 3, prenom: 'Paul', nom: 'Martin', email: 'paul@test.fr', telephone: null }],
};

beforeEach(() => {
  api.getPharmaciesAdmin.mockResolvedValue([pharmacie]);
  api.getStatsAdmin.mockResolvedValue({
    clients: 12, pharmaciesValidees: 3, pharmaciesEnAttente: 1, offresEnLigne: 9,
    reservations: { retiree: 4, confirmee: 2 }, volume: 120, commissions: 6,
  });
  api.changerValidationPharmacie.mockResolvedValue({ message: 'Pharmacie validée.' });
});

test('liste les pharmacies en attente et permet de les valider', async () => {
  render(<RetoursProvider><Administration /></RetoursProvider>);
  expect(await screen.findByText('Pharmacie des Tests')).toBeInTheDocument();
  expect(screen.getByText('paul@test.fr')).toBeInTheDocument();
  expect(screen.getByText('Clients')).toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: /^Valider$/ }));
  // Fenêtre de confirmation, puis appel à l'API
  const boutons = await screen.findAllByRole('button', { name: /^Valider$/ });
  await userEvent.click(boutons[boutons.length - 1]);
  await waitFor(() => expect(api.changerValidationPharmacie).toHaveBeenCalledWith(7, true));
  // La liste est rechargée après la validation
  await waitFor(() => expect(api.getPharmaciesAdmin).toHaveBeenCalledTimes(2));
  expect(await screen.findByText('Pharmacie validée.')).toBeInTheDocument();
});

test('sans accès caméra, le scanner propose la saisie manuelle', async () => {
  render(<ScannerQR onResultat={jest.fn()} />);
  expect(await screen.findByRole('alert')).toHaveTextContent(/https|caméra/);
});
