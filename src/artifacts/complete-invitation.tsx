import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import CompleteInvitation from '../components/auth/CompleteInvitation';

const CompleteInvitationPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const tokenParam = searchParams.get('token');
    if (tokenParam) {
      setToken(tokenParam);
    } else {
      // No token provided, redirect to home
      navigate('/');
    }
  }, [searchParams, navigate]);

  const handleComplete = () => {
    // Redirect to home page after successful completion
    navigate('/');
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-xl text-gray-600">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        <CompleteInvitation token={token} onComplete={handleComplete} />
      </div>
    </div>
  );
};

export default CompleteInvitationPage; 