import { Loader2 } from 'lucide-react';

export default function LoadingSpinner({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <Loader2 className="w-8 h-8 text-cyan-500 animate-spin mb-3" />
      <p className="text-sm text-slate-500">{message}</p>
    </div>
  );
}
