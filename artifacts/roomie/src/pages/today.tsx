import { useGetMe, useGetTodayAssignments, useMarkAssignmentDone, getGetTodayAssignmentsQueryKey, getGetUpcomingAssignmentsQueryKey, getGetAssignmentHistoryQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Circle, Sun, Leaf } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

export default function Today() {
  const { data: user } = useGetMe();
  const { data: assignments, isLoading } = useGetTodayAssignments();
  const markDone = useMarkAssignmentDone();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleMarkDone = (assignmentId: number) => {
    markDone.mutate(
      { assignmentId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetTodayAssignmentsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetUpcomingAssignmentsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetAssignmentHistoryQueryKey() });
          toast({ title: "Nice work!", description: "Chore marked as done." });
        },
        onError: (err: any) => {
          toast({ title: "Error", description: err.error || "Failed to mark as done", variant: "destructive" });
        }
      }
    );
  };

  const myAssignments = assignments?.filter(a => a.userId === user?.id) || [];
  const othersAssignments = assignments?.filter(a => a.userId !== user?.id) || [];

  const currentDate = new Date();
  
  return (
    <div className="max-w-3xl mx-auto w-full pt-4 md:pt-10">
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-10 text-center md:text-left"
      >
        <h1 className="font-serif text-4xl md:text-5xl font-medium tracking-tight text-foreground mb-2 flex items-center justify-center md:justify-start gap-3">
          <Sun className="w-8 h-8 text-primary" />
          {format(currentDate, 'EEEE, MMMM d')}
        </h1>
        <p className="text-muted-foreground text-lg">Good morning, {user?.name?.split(' ')[0]}.</p>
      </motion.div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full rounded-[2rem]" />
          <Skeleton className="h-32 w-full rounded-[2rem]" />
        </div>
      ) : (
        <div className="space-y-8">
          <section>
            <h2 className="text-sm uppercase tracking-widest text-muted-foreground font-medium mb-4 px-2">Your Focus Today</h2>
            
            {myAssignments.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-card/50 backdrop-blur border border-border border-dashed rounded-[2rem] p-10 text-center flex flex-col items-center"
              >
                <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mb-4">
                  <Leaf className="w-8 h-8 text-accent" />
                </div>
                <h3 className="font-serif text-2xl font-medium mb-2">You're free today</h3>
                <p className="text-muted-foreground">Enjoy your time off.</p>
              </motion.div>
            ) : (
              <div className="grid gap-4">
                <AnimatePresence>
                  {myAssignments.map((assignment, index) => (
                    <motion.div
                      key={assignment.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ delay: index * 0.1 }}
                      className={`relative overflow-hidden rounded-[2rem] p-6 md:p-8 flex flex-col md:flex-row md:items-center gap-6 shadow-sm border transition-all ${
                        assignment.status === 'done' 
                          ? 'bg-muted/30 border-transparent opacity-60' 
                          : 'bg-card border-border hover:shadow-md'
                      }`}
                    >
                      <div className="flex-1">
                        <h3 className={`font-serif text-2xl font-medium mb-1 ${assignment.status === 'done' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                          {assignment.choreName}
                        </h3>
                        <p className="text-muted-foreground text-sm">Assigned to you</p>
                      </div>
                      
                      <button
                        disabled={assignment.status === 'done' || markDone.isPending}
                        onClick={() => handleMarkDone(assignment.id)}
                        className={`flex items-center justify-center gap-3 px-6 py-4 rounded-xl font-medium transition-all w-full md:w-auto ${
                          assignment.status === 'done'
                            ? 'bg-accent/10 text-accent cursor-default'
                            : 'bg-primary text-primary-foreground hover:bg-primary/90 active-elevate'
                        }`}
                      >
                        {assignment.status === 'done' ? (
                          <>
                            <CheckCircle2 className="w-5 h-5" /> Done
                          </>
                        ) : (
                          <>
                            <Circle className="w-5 h-5" /> Mark as done
                          </>
                        )}
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </section>

          {othersAssignments.length > 0 && (
            <section className="mt-12">
              <h2 className="text-sm uppercase tracking-widest text-muted-foreground font-medium mb-4 px-2">Meanwhile in the house</h2>
              <div className="bg-card rounded-[2rem] border overflow-hidden">
                <div className="divide-y divide-border">
                  {othersAssignments.map(assignment => (
                    <div key={assignment.id} className="p-4 px-6 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-8 h-8 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center font-serif text-sm">
                          {assignment.userName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{assignment.choreName}</p>
                          <p className="text-xs text-muted-foreground">{assignment.userName}</p>
                        </div>
                      </div>
                      <div>
                        {assignment.status === 'done' ? (
                          <span className="text-xs font-medium px-2 py-1 rounded-full bg-accent/10 text-accent flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Done
                          </span>
                        ) : (
                          <span className="text-xs font-medium px-2 py-1 rounded-full bg-muted text-muted-foreground">
                            Pending
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
