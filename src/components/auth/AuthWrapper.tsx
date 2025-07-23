import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import LoginForm from './LoginForm';
import AuthSetup from './AuthSetup';
import CompleteInvitation from './CompleteInvitation';

interface AuthWrapperProps {
  children: React.ReactNode;
}

const AuthWrapper: React.FC<AuthWrapperProps> = ({ children }) => {
  const { isAuthenticated, isLoading, error, login, clearError } = useAuth();
  const [needsSetup, setNeedsSetup] = useState(false);
  const [checkingSetup, setCheckingSetup] = useState(true);
  const [invitationToken, setInvitationToken] = useState<string | null>(null);

  const API_BASE = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3000';

  // Check if authentication setup is needed and handle invitation tokens
  useEffect(() => {
    // Check for invitation token in URL
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    
    if (token && window.location.pathname === '/complete-invitation') {
      setInvitationToken(token);
      setCheckingSetup(false);
      return;
    }

    const checkAuthSetup = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/setup-auth`);
        const data = await response.json();
        
        // If tables don't exist or no setup is complete, show setup screen
        if (!data.usersTableExists || !data.matchesHasCreatedBy) {
          setNeedsSetup(true);
        } else {
          // Tables exist, check if we can find any superuser
          try {
            // Try a dummy login to see if authentication is working
            const authResponse = await fetch(`${API_BASE}/api/auth`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'verify', token: 'test' }),
            });
            
            // If we get a proper 401, auth system is working
            if (authResponse.status === 401) {
              setNeedsSetup(false);
            } else {
              // Unexpected response, might need setup
              setNeedsSetup(true);
            }
          } catch (error) {
            console.error('Auth check error:', error);
            setNeedsSetup(true);
          }
        }
      } catch (error) {
        console.error('Setup check error:', error);
        setNeedsSetup(true);
      } finally {
        setCheckingSetup(false);
      }
    };

    checkAuthSetup();
  }, []);

  const handleSetupComplete = () => {
    setNeedsSetup(false);
    // Refresh the page to reinitialize authentication
    window.location.reload();
  };

  const handleInvitationComplete = () => {
    setInvitationToken(null);
    // Clear URL params and redirect to login
    window.history.replaceState({}, document.title, '/');
    window.location.reload();
  };

  // Show loading spinner while checking setup or auth
  if (checkingSetup || isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Show invitation completion screen if token is present
  if (invitationToken) {
    return <CompleteInvitation token={invitationToken} onComplete={handleInvitationComplete} />;
  }

  // Show setup screen if needed
  if (needsSetup) {
    return <AuthSetup onSetupComplete={handleSetupComplete} />;
  }

  // Show login screen if not authenticated
  if (!isAuthenticated) {
    return (
      <LoginForm 
        onLogin={login} 
        isLoading={isLoading} 
        error={error} 
        onClearError={clearError} 
      />
    );
  }

  // User is authenticated, show the main app
  return <>{children}</>;
};

export default AuthWrapper; 