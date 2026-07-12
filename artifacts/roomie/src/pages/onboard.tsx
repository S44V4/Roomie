import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCreateHousehold, useJoinHousehold, useGetMe, useLogout, getGetMeQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { KeyRound, Plus, LogOut, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const createSchema = z.object({
  name: z.string().min(1, { message: "Household name is required" }),
});

const joinSchema = z.object({
  inviteCode: z.string().min(1, { message: "Invite code is required" }),
});

type Step = 'choose' | 'create' | 'join';

export default function Onboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>('choose');

  const createMutation = useCreateHousehold();
  const joinMutation = useJoinHousehold();
  const logout = useLogout();

  const { data: user, isLoading } = useGetMe();

  useEffect(() => {
    if (!isLoading && !user) setLocation('/login');
    if (user?.householdId) setLocation('/');
  }, [user, isLoading, setLocation]);

  const createForm = useForm<z.infer<typeof createSchema>>({
    resolver: zodResolver(createSchema),
    defaultValues: { name: '' },
  });

  const joinForm = useForm<z.infer<typeof joinSchema>>({
    resolver: zodResolver(joinSchema),
    defaultValues: { inviteCode: '' },
  });

  const onCreate = (data: z.infer<typeof createSchema>) => {
    createMutation.mutate({ data }, {
      onSuccess: (household) => {
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        toast({ title: "Welcome home!", description: `Created household: ${household.name}` });
        setLocation('/');
      },
      onError: (err: any) => {
        toast({ title: "Error", description: err.error || "Failed to create household", variant: "destructive" });
      }
    });
  };

  const onJoin = (data: z.infer<typeof joinSchema>) => {
    joinMutation.mutate({ data }, {
      onSuccess: (household) => {
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        toast({ title: "Welcome home!", description: `Joined household: ${household.name}` });
        setLocation('/');
      },
      onError: (err: any) => {
        toast({ title: "Error", description: err.error || "Failed to join household", variant: "destructive" });
      }
    });
  };

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        queryClient.clear();
        setLocation('/login');
      }
    });
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-muted/30">
      <header className="p-6 flex justify-between items-center">
        <h1 className="font-serif text-2xl font-medium tracking-tight text-foreground">Roomie</h1>
        <Button variant="ghost" onClick={handleLogout} className="text-muted-foreground rounded-full">
          <LogOut className="w-4 h-4 mr-2" /> Log out
        </Button>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <AnimatePresence mode="wait">

          {/* ── Step 1: choose ── */}
          {step === 'choose' && (
            <motion.div
              key="choose"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.3 }}
              className="w-full max-w-sm flex flex-col items-center gap-6"
            >
              <div className="text-center mb-2">
                <h2 className="font-serif text-3xl font-medium text-foreground mb-3">Let's set up your home</h2>
                <p className="text-muted-foreground text-sm">Create a new household or join one with an invite code.</p>
              </div>

              <button
                onClick={() => setStep('create')}
                className="w-full bg-card rounded-2xl p-6 border border-border shadow-sm flex items-center gap-4 hover:border-primary/40 hover:shadow-md transition-all text-left group"
              >
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                  <Plus className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Create a household</p>
                  <p className="text-sm text-muted-foreground mt-0.5">Start fresh and invite roommates</p>
                </div>
              </button>

              <button
                onClick={() => setStep('join')}
                className="w-full bg-card rounded-2xl p-6 border border-border shadow-sm flex items-center gap-4 hover:border-primary/40 hover:shadow-md transition-all text-left group"
              >
                <div className="w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center shrink-0 group-hover:bg-accent/20 transition-colors">
                  <KeyRound className="w-6 h-6 text-accent" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Join a household</p>
                  <p className="text-sm text-muted-foreground mt-0.5">Enter an invite code from a roommate</p>
                </div>
              </button>
            </motion.div>
          )}

          {/* ── Step 2a: create form ── */}
          {step === 'create' && (
            <motion.div
              key="create"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.3 }}
              className="w-full max-w-sm"
            >
              <div className="bg-card rounded-[2rem] p-8 border border-border shadow-sm">
                <button
                  onClick={() => setStep('choose')}
                  className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
                >
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-6">
                  <Plus className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-medium mb-1">Create a household</h3>
                <p className="text-sm text-muted-foreground mb-6">Give your home a name to get started.</p>

                <Form {...createForm}>
                  <form onSubmit={createForm.handleSubmit(onCreate)} className="space-y-4">
                    <FormField
                      control={createForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Household Name</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. 123 Main St" className="rounded-xl h-12 bg-muted/30" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" className="w-full rounded-xl h-12" disabled={createMutation.isPending}>
                      {createMutation.isPending ? "Creating..." : "Create Household"}
                    </Button>
                  </form>
                </Form>
              </div>
            </motion.div>
          )}

          {/* ── Step 2b: join form ── */}
          {step === 'join' && (
            <motion.div
              key="join"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.3 }}
              className="w-full max-w-sm"
            >
              <div className="bg-card rounded-[2rem] p-8 border border-border shadow-sm">
                <button
                  onClick={() => setStep('choose')}
                  className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
                >
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <div className="w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center mb-6">
                  <KeyRound className="w-6 h-6 text-accent" />
                </div>
                <h3 className="text-xl font-medium mb-1">Join a household</h3>
                <p className="text-sm text-muted-foreground mb-6">Enter the invite code your roommate shared with you.</p>

                <Form {...joinForm}>
                  <form onSubmit={joinForm.handleSubmit(onJoin)} className="space-y-4">
                    <FormField
                      control={joinForm.control}
                      name="inviteCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Invite Code</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter code" className="rounded-xl h-12 bg-muted/30" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" className="w-full rounded-xl h-12" disabled={joinMutation.isPending}>
                      {joinMutation.isPending ? "Joining..." : "Join Household"}
                    </Button>
                  </form>
                </Form>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
