import { SipContextProvider } from './sip-context';
import { useJsSip } from '@/hooks/useJsSip';

export function SipProvider({ children }: { children: React.ReactNode }) {
  const sip = useJsSip();
  return <SipContextProvider value={sip}>{children}</SipContextProvider>;
}
