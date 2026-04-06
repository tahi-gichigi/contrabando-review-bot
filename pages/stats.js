// Redirect old /stats URL to home — stats is now a tab on the main page
import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function StatsRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/'); }, [router]);
  return null;
}
