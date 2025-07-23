import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider, createBrowserRouter } from 'react-router-dom';
import Layout from './components/layout';
import CompleteInvitationPage from './pages/invitation';
import ChampionshipApp from './artifacts/index';
import './index.css';

const router = createBrowserRouter([
  {
    path: '/complete-invitation',
    element: <CompleteInvitationPage />,
  },
  {
    path: '/',
    element: <Layout><ChampionshipApp /></Layout>,
  },
  {
    path: '*',
    element: <Layout><ChampionshipApp /></Layout>,
  }
], {
  future: {
    v7_relativeSplatPath: true,
    v7_fetcherPersist: true,
    v7_normalizeFormMethod: true,
    v7_partialHydration: true,
    v7_skipActionErrorRevalidation: true
  }
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);