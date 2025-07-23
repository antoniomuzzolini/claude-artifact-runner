import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider, createBrowserRouter } from 'react-router-dom';
import routes from 'virtual:generated-pages-react';
import Layout from './components/layout';
import CompleteInvitationPage from './pages/invitation';
import './index.css';

// Manual routes for special pages that don't need layout
const manualRoutes = [
  {
    path: '/complete-invitation',
    element: <CompleteInvitationPage />,
  },
];

// Combine auto-generated routes (with layout) and manual routes (without layout)
const allRoutes = [
  ...manualRoutes,
  ...routes.map((route) => ({
    ...route,
    element: <Layout>{route.element}</Layout>,
  }))
];

const router = createBrowserRouter(allRoutes, {
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