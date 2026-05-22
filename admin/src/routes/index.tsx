import { createBrowserRouter } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { PublicRoute } from '../components/PublicRoute';
import { Dashboard } from '../pages/Dashboard';
import { NotFound } from '../pages/NotFound';
import { SignIn } from '../pages/SignIn';
import { ForgotPassword } from '../pages/ForgotPassword';
import { LinkSent } from '../pages/LinkSent';
import { Success } from '../pages/Success';
import { CreateNewPassword } from '../pages/CreateNewPassword';
import { ContentManagement } from '../pages/ContentManagement';
import { Journey40Day } from '../pages/Journey40Day';
import { TemptationDetails } from '../pages/TemptationDetails';
import { CreateTemptation } from '../pages/CreateTemptation';
import { Settings } from '../pages/Settings';
import { TermsAndPrivacy } from '../pages/TermsAndPrivacy';
import { DeepLinkRedirect } from '../pages/DeepLinkRedirect';

export const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <PublicRoute>
        <SignIn />
      </PublicRoute>
    ),
  },
  {
    path: '/signin',
    element: (
      <PublicRoute>
        <SignIn />
      </PublicRoute>
    ),
  },
  {
    path: '/forgot-password',
    element: (
      <PublicRoute>
        <ForgotPassword />
      </PublicRoute>
    ),
  },
  {
    path: '/link-sent',
    element: (
      <PublicRoute>
        <LinkSent />
      </PublicRoute>
    ),
  },
  {
    path: '/success',
    element: (
      <PublicRoute>
        <Success />
      </PublicRoute>
    ),
  },
  {
    path: '/create-new-password',
    element: (
      <PublicRoute>
        <CreateNewPassword />
      </PublicRoute>
    ),
  },
  {
    path: '/reset-password',
    element: <DeepLinkRedirect />,
  },
  {
    path: '/invitation',
    element: <DeepLinkRedirect />,
  },
  {
    path: '/dashboard',
    element: (
      <ProtectedRoute>
        <Layout />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <Dashboard />,
      },
      {
        path: 'content-management',
        element: <ContentManagement />,
      },
      {
        path: 'settings',
        element: <Settings />,
      },
      {
        path: 'terms-and-privacy',
        element: <TermsAndPrivacy />,
      },
      {
        path: 'journey-40-day/:id?',
        element: <Journey40Day />,
      },
      {
        path: 'create-journey-40-day',
        element: <Journey40Day />,
      },
      {
        path: '*',
        element: <NotFound />,
      },
    ],
  },
  {
    path: '/content-management',
    element: (
      <ProtectedRoute>
        <Layout />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <ContentManagement />,
      },
      {
        path: 'temptation-details',
        element: <TemptationDetails />,
      },
      {
        path: 'create-40-temptations',
        element: <CreateTemptation />,
      },
      {
        path: 'journey-40-day/:id?',
        element: <Journey40Day />,
      },
      {
        path: 'create-journey-40-day',
        element: <Journey40Day />,
      },
      {
        path: '*',
        element: <NotFound />,
      },
    ],
  },
  {
    path: '/settings',
    element: (
      <ProtectedRoute>
        <Layout />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <Settings />,
      },
      {
        path: '*',
        element: <NotFound />,
      },
    ],
  },
  {
    path: '/terms-and-privacy',
    element: (
      <ProtectedRoute>
        <Layout />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <TermsAndPrivacy />,
      },
      {
        path: '*',
        element: <NotFound />,
      },
    ],
  },
]);
