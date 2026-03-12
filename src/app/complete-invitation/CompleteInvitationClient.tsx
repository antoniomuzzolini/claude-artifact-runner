"use client";

import { useRouter } from 'next/navigation';
import CompleteInvitation from '../../components/auth/CompleteInvitation';

interface CompleteInvitationClientProps {
  token: string;
}

export default function CompleteInvitationClient({ token }: CompleteInvitationClientProps) {
  const router = useRouter();

  const handleComplete = () => {
    router.replace('/');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        <CompleteInvitation token={token} onComplete={handleComplete} />
      </div>
    </div>
  );
}
