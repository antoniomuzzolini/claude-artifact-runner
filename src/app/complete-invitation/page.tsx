import { redirect } from 'next/navigation';
import CompleteInvitationClient from './CompleteInvitationClient';

export const dynamic = 'force-dynamic';

interface CompleteInvitationPageProps {
  searchParams?: { token?: string | string[] };
}

export default function CompleteInvitationPage({ searchParams }: CompleteInvitationPageProps) {
  const tokenParam = searchParams?.token;
  const token = Array.isArray(tokenParam) ? tokenParam[0] : tokenParam;

  if (!token) {
    redirect('/');
  }

  return <CompleteInvitationClient token={token} />;
}
