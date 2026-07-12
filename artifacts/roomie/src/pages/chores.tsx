import { useState } from 'react';
import {
  useListChores, useCreateChore, useDeleteChore,
  useGetHouseholdMembers, useGetMyHousehold, useGetMe,
  getListChoresQueryKey
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2, Info, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { motion } from 'framer-motion';

const choreSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  frequency: z.enum(["daily", "weekly", "custom"]),
  customDays: z.string().optional().nullable(),
  rotationOrder: z.array(z.number()).min(1, "Select at least one member")
});

export default function Chores() {
  const { data: household } = useGetMyHousehold();
  const { data: user } = useGetMe();
  const { data: members } = useGetHouseholdMembers();
  const { data: chores, isLoading } = useListChores();

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createChore = useCreateChore();
  const deleteChore = useDeleteChore();

  const [dialogOpen, setDialogOpen] = useState(false);

  const isAdmin = user?.id === household?.adminUserId || user?.isAdmin;

  const form = useForm<z.infer<typeof choreSchema>>({
    resolver: zodResolver(choreSchema),
    defaultValues: {
      name: '',
      description: '',
      frequency: 'weekly',
      customDays: '',
      rotationOrder: []
    }
  });

  const onSubmit = (data: z.infer<typeof choreSchema>) => {
    // If frequency is not custom, we can clear out customDays
    if (data.frequency !== 'custom') {
      data.customDays = null;
    }

    createChore.mutate({ data }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListChoresQueryKey() });
        toast({ title: "Chore created", description: `${data.name} added to rotation.` });
        setDialogOpen(false);
        form.reset();
      },
      onError: (err: any) => {
        toast({ title: "Error", description: err.error || "Failed to create chore", variant: "destructive" });
      }
    });
  };

  const handleDelete = (id: number) => {
    if (!confirm("Are you sure you want to delete this chore?")) return;
    deleteChore.mutate({ choreId: id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListChoresQueryKey() });
        toast({ title: "Chore deleted" });
      }
    });
  };

  return (
    <div className="w-full pt-4 md:pt-8 max-w-5xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-medium tracking-tight">Household Chores</h1>
          <p className="text-muted-foreground mt-1">Manage tasks and rotation schedules.</p>
        </div>
        {isAdmin && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-xl gap-2 active-elevate">
                <Plus className="w-4 h-4" /> Add Chore
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md rounded-[2rem]">
              <DialogHeader>
                <DialogTitle className="font-serif text-2xl">New Chore</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Chore Name</FormLabel>
                      <FormControl><Input placeholder="e.g. Take out trash" className="rounded-xl" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="frequency" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Frequency</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select frequency" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="custom">Custom (Specific Days)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />

                  {form.watch("frequency") === "custom" && (
                    <FormField control={form.control} name="customDays" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Custom Days</FormLabel>
                        <FormControl><Input placeholder="e.g. 1,3,5 for Mon,Wed,Fri" className="rounded-xl" {...field} value={field.value || ''} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  )}

                  <FormField control={form.control} name="rotationOrder" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rotation Order</FormLabel>
                      <div className="text-sm text-muted-foreground mb-2">Select members in the order they should rotate:</div>
                      <div className="space-y-2 max-h-40 overflow-y-auto p-2 bg-muted/30 rounded-xl border">
                        {members?.map(member => (
                          <div key={member.id} className="flex items-center space-x-3 bg-card p-2 rounded-lg border shadow-sm">
                            <Checkbox
                              checked={field.value.includes(member.id)}
                              onCheckedChange={(checked) => {
                                const current = field.value;
                                if (checked) {
                                  field.onChange([...current, member.id]);
                                } else {
                                  field.onChange(current.filter(id => id !== member.id));
                                }
                              }}
                            />
                            <div className="text-sm font-medium">{member.name}</div>
                            {field.value.includes(member.id) && (
                              <div className="ml-auto text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">
                                #{field.value.indexOf(member.id) + 1}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <Button type="submit" className="w-full rounded-xl mt-4" disabled={createChore.isPending}>
                    {createChore.isPending ? "Saving..." : "Save Chore"}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {!isAdmin && (
        <div className="bg-muted/50 border border-border border-dashed rounded-[2rem] p-6 flex items-start gap-4">
          <Info className="w-6 h-6 text-muted-foreground shrink-0 mt-1" />
          <div>
            <h3 className="font-medium">Read-only view</h3>
            <p className="text-sm text-muted-foreground">Only your household admin can manage chores. Contact them to make changes to the schedule.</p>
          </div>
        </div>
      )}

      {isLoading ? (
        <Skeleton className="h-40 w-full rounded-[2rem]" />
      ) : chores?.length === 0 ? (
        <div className="text-center py-16 bg-card rounded-[2rem] border border-dashed">
          <p className="text-muted-foreground">No chores have been added yet.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {chores?.map((chore, i) => (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              key={chore.id}
              className="bg-card rounded-[2rem] p-6 border shadow-sm flex flex-col"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-serif text-xl font-medium">{chore.name}</h3>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs font-medium px-2 py-1 rounded-full bg-secondary text-secondary-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {chore.frequency === 'custom' ? `Custom: ${chore.customDays}` : chore.frequency}
                    </span>
                  </div>
                </div>
                {isAdmin && (
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(chore.id)} className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 -mr-2 -mt-2 rounded-full">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>

              <div className="mt-auto pt-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-3">Rotation</p>
                <div className="flex flex-wrap gap-2">
                  {chore.rotationOrder.map((userId, idx) => {
                    const member = members?.find(m => m.id === userId);
                    return (
                      <div key={idx} className="flex items-center gap-2 bg-muted/50 border rounded-full pl-1 pr-3 py-1 text-sm">
                        <div className="w-6 h-6 rounded-full bg-background flex items-center justify-center font-serif text-xs font-medium text-foreground shadow-sm border">
                          {member ? member.name.charAt(0).toUpperCase() : '?'}
                        </div>
                        <span className="truncate max-w-[80px] text-xs font-medium">{member ? member.name.split(' ')[0] : 'Unknown'}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
