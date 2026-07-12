import { useGetBalances, useGetSettleUp } from '@workspace/api-client-react';
import { Skeleton } from '@/components/ui/skeleton';
import { motion } from 'framer-motion';
import { Wallet, ArrowRight, CheckCircle2 } from 'lucide-react';

export default function Settle() {
  const { data: balances, isLoading: loadingBalances } = useGetBalances();
  const { data: settlements, isLoading: loadingSettlements } = useGetSettleUp();

  const isLoading = loadingBalances || loadingSettlements;

  return (
    <div className="w-full pt-4 md:pt-8 max-w-5xl mx-auto space-y-12">
      <div className="text-center max-w-lg mx-auto mb-8">
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4 mx-auto">
          <Wallet className="w-8 h-8 text-primary" />
        </div>
        <h1 className="font-serif text-3xl font-medium tracking-tight">Settle Up</h1>
        <p className="text-muted-foreground mt-2">Current balances and the easiest way to square up.</p>
      </div>

      <div className="space-y-6">
        <h2 className="text-sm uppercase tracking-widest text-muted-foreground font-medium pl-2">Current Balances</h2>
        {isLoading ? (
          <Skeleton className="h-40 w-full rounded-[2rem]" />
        ) : balances?.length === 0 ? (
          <div className="text-center py-10 bg-card rounded-[2rem] border">
            <p className="text-muted-foreground">No balances to track.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {balances?.map((balance, i) => (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                key={balance.userId}
                className="bg-card rounded-[2rem] p-6 border shadow-sm flex flex-col items-center text-center relative overflow-hidden"
              >
                <div className={`absolute top-0 w-full h-1 ${
                  balance.balance > 0 ? 'bg-accent' : balance.balance < 0 ? 'bg-destructive' : 'bg-muted'
                }`} />
                <div className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center font-serif text-xl font-medium mb-3 shadow-sm border border-secondary-foreground/10">
                  {balance.userName.charAt(0).toUpperCase()}
                </div>
                <div className="font-medium text-lg">{balance.userName}</div>
                <div className={`mt-2 font-serif text-2xl font-medium tracking-tight ${
                  balance.balance > 0 ? 'text-accent' : balance.balance < 0 ? 'text-destructive' : 'text-muted-foreground'
                }`}>
                  {balance.balance > 0 ? `Gets $${balance.balance.toFixed(2)}` : balance.balance < 0 ? `Owes $${Math.abs(balance.balance).toFixed(2)}` : 'Settled'}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-6">
        <h2 className="text-sm uppercase tracking-widest text-muted-foreground font-medium pl-2">How to settle</h2>
        {isLoading ? (
          <Skeleton className="h-40 w-full rounded-[2rem]" />
        ) : settlements?.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-accent/10 border border-accent/20 rounded-[2rem] p-10 text-center flex flex-col items-center shadow-sm"
          >
            <CheckCircle2 className="w-12 h-12 text-accent mb-4" />
            <h3 className="font-serif text-2xl font-medium text-foreground mb-2">You're all squared up!</h3>
            <p className="text-accent text-sm font-medium">No one owes anything.</p>
          </motion.div>
        ) : (
          <div className="bg-card rounded-[2rem] border overflow-hidden divide-y divide-border shadow-sm">
            {settlements?.map((tx, i) => (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.1 }}
                key={i}
                className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-muted/20 transition-colors"
              >
                <div className="flex items-center gap-4 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-destructive/10 text-destructive flex items-center justify-center font-serif text-sm font-bold border border-destructive/20">
                      {tx.fromUserName.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-medium text-lg">{tx.fromUserName.split(' ')[0]}</span>
                  </div>
                  <ArrowRight className="w-5 h-5 text-muted-foreground shrink-0" />
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-accent/10 text-accent flex items-center justify-center font-serif text-sm font-bold border border-accent/20">
                      {tx.toUserName.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-medium text-lg">{tx.toUserName.split(' ')[0]}</span>
                  </div>
                </div>
                <div className="font-serif text-2xl font-medium bg-muted/50 px-5 py-2 rounded-xl border">
                  ${tx.amount.toFixed(2)}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
