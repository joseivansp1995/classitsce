import React from 'react';
import RegistroForm from './RegistroForm';

export default async function RegistroPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; email?: string }>;
}) {
  const params = await searchParams;
  const initialToken = params.token || '';
  const initialEmail = params.email || '';

  return (
    <div className="min-h-screen bg-[#F8FAFC] bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:20px_20px] flex items-center justify-center p-4">
      <RegistroForm initialToken={initialToken} initialEmail={initialEmail} />
    </div>
  );
}
