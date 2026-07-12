import { useGetHouseholdMembers, useGetTodayAssignments, useGetUpcomingAssignments, useGetAssignmentHistory, useGetMyHousehold } from '@workspace/api-client-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { format, parseISO, isSameDay } from 'date-fns';
import { motion } from 'framer-motion';
import { CheckCircle2, Circle, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

export default function Dashboard() {
  const { data: members, isLoading: loadingMembers } = useGetHouseholdMembers();
  const { data: today, isLoading: loadingToday } = useGetTodayAssignments();
  const { data: upcoming, isLoading: loadingUpcoming } = useGetUpcomingAssignments();
  const { data: history, isLoading: loadingHistory } = useGetAssignmentHistory();
  const { data: household } = useGetMyHousehold();
  const { toast } = useToast();

  const isLoading = loadingMembers || loadingToday || loadingUpcoming || loadingHistory;

  const copyInvite = () => {
    if (household?.inviteCode) {
      navigator.clipboard.writeText(household.inviteCode);
      toast({ title: "Copied!", description: "Invite code copied to clipboard" });
    }
  };

  // Group upcoming by date
  const groupedUpcoming = upcoming?.reduce((acc, curr) => {
    if (!acc[curr.date]) acc[curr.date] = [];
    acc[curr.date].push(curr);
    return acc;
  }, {} as Record<string, typeof upcoming>);

  const upcomingDates = Object.keys(groupedUpcoming || {}).sort();

  return (
    <div className="w-full pt-4 md:pt-8 max-w-5xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-medium tracking-tight">Household Dashboard</h1>
          <p className="text-muted-foreground mt-1">See what's happening around the house.</p>
        </div>
        
        {household && (
          <div className="flex items-center gap-3 bg-card border rounded-2xl px-4 py-2 shadow-sm">
            <div className="text-sm">
              <span className="text-muted-foreground">Invite code: </span>
              <span className="font-mono font-medium tracking-wider">{household.inviteCode}</span>
            </div>
            <Button variant="ghost" size="icon" onClick={copyInvite} className="w-8 h-8 rounded-full">
              <Copy className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>

      <div className="flex gap-4 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0">
        {members?.map(member => (
          <div key={member.id} className="flex-shrink-0 flex items-center gap-3 bg-card border rounded-full pl-2 pr-4 py-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-serif text-sm font-medium">
              {member.name.charAt(0).toUpperCase()}
            </div>
            <span className="text-sm font-medium">{member.name}</span>
          </div>
        ))}
      </div>

      <Tabs defaultValue="today" className="w-full">
        <TabsList className="bg-transparent border-b rounded-none w-full justify-start h-auto p-0 space-x-6">
          <TabsTrigger value="today" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 py-3">Today</TabsTrigger>
          <TabsTrigger value="upcoming" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 py-3">Upcoming</TabsTrigger>
          <TabsTrigger value="history" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 py-3">History</TabsTrigger>
        </TabsList>

        <div className="mt-8">
          <TabsContent value="today" className="space-y-4">
            {isLoading ? (
              <Skeleton className="h-40 w-full rounded-[2rem]" />
            ) : today?.length === 0 ? (
              <div className="text-center py-12 bg-card rounded-[2rem] border border-dashed">
                <p className="text-muted-foreground">No chores assigned for today.</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {today?.map((assignment, i) => (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    key={assignment.id} 
                    className="bg-card rounded-[2rem] p-6 border shadow-sm flex flex-col justify-between"
                  >
                    <div className="flex justify-between items-start mb-6">
                      <h3 className="font-serif text-xl font-medium">{assignment.choreName}</h3>
                      {assignment.status === 'done' ? (
                        <CheckCircle2 className="text-accent w-6 h-6" />
                      ) : (
                        <Circle className="text-muted-foreground w-6 h-6" />
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center font-serif text-sm">
                        {assignment.userName.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm font-medium">{assignment.userName}</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="upcoming" className="space-y-8">
            {isLoading ? (
              <Skeleton className="h-64 w-full rounded-[2rem]" />
            ) : upcomingDates.length === 0 ? (
              <div className="text-center py-12 bg-card rounded-[2rem] border border-dashed">
                <p className="text-muted-foreground">No upcoming chores scheduled.</p>
              </div>
            ) : (
              upcomingDates.map((dateStr, groupIdx) => (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: groupIdx * 0.1 }}
                  key={dateStr} 
                  className="space-y-4"
                >
                  <h3 className="font-medium text-muted-foreground text-sm uppercase tracking-wider pl-2 border-l-2 border-primary/20">
                    {format(parseISO(dateStr), 'EEEE, MMM d')}
                  </h3>
                  <div className="bg-card rounded-[2rem] border overflow-hidden divide-y divide-border">
                    {groupedUpcoming?.[dateStr]?.map((assignment) => (
                      <div key={assignment.id} className="p-4 px-6 flex items-center justify-between hover:bg-muted/20 transition-colors">
                        <span className="font-medium">{assignment.choreName}</span>
                        <div className="flex items-center gap-3 text-muted-foreground">
                          <span className="text-sm">{assignment.userName}</span>
                          <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center font-serif text-xs text-foreground">
                            {assignment.userName.charAt(0).toUpperCase()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              ))
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            {isLoading ? (
              <Skeleton className="h-64 w-full rounded-[2rem]" />
            ) : history?.length === 0 ? (
              <div className="text-center py-12 bg-card rounded-[2rem] border border-dashed">
                <p className="text-muted-foreground">No chore history available.</p>
              </div>
            ) : (
              <div className="bg-card rounded-[2rem] border overflow-hidden divide-y divide-border">
                {history?.map((assignment, i) => (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.05 }}
                    key={assignment.id} 
                    className="p-4 px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-muted/20 transition-colors"
                  >
                    <div>
                      <span className="font-medium block">{assignment.choreName}</span>
                      <span className="text-xs text-muted-foreground">{format(parseISO(assignment.date), 'MMM d, yyyy')}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-muted-foreground">completed by</span>
                      <span className="font-medium">{assignment.userName}</span>
                      {assignment.status === 'done' && <CheckCircle2 className="w-4 h-4 text-accent ml-1" />}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
