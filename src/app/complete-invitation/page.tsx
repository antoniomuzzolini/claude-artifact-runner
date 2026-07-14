import { redirect } from 'next/navigation';
import CompleteInvitationClient from './CompleteInvitationClient';

export const dynamic = 'force-dynamic';

interface CompleteInvitationPageProps {
  // Next 15+: searchParams is async and must be awaited — reading it
  // synchronously yields undefined, which sent every invitation link
  // straight back to the login page
  searchParams: Promise<{ token?: string | string[] }>;
}

export default async function CompleteInvitationPage({ searchParams }: CompleteInvitationPageProps) {
  const params = await searchParams;
  const tokenParam = params?.token;
  const token = Array.isArray(tokenParam) ? tokenParam[0] : tokenParam;

  if (!token) {
    redirect('/');
  }

  return <CompleteInvitationClient token={token} />;
}
