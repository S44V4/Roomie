import { useEffect, useState } from 'react';
import {
  useListExpenses, useCreateExpense, useDeleteExpense,
  useGetHouseholdMembers, useGetMe, getListExpensesQueryKey, getGetBalancesQueryKey
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2, Receipt, Split } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { format, parseISO } from 'date-fns';
import { motion } from 'framer-motion';

const expenseSchema = z.object({
  amount: z.coerce.number().min(0.01, "Amount must be greater than 0"),
  description: z.string().min(1, "Description is required"),
  paidBy: z.coerce.number().min(1, "Select who paid"),
  splitAmong: z.array(z.coerce.number()).min(1, "Select at least one person"),
});

export default function Expenses() {
  const { data: user } = useGetMe();
  const { data: members } = useGetHouseholdMembers();
  const { data: expenses, isLoading } = useListExpenses();

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createExpense = useCreateExpense();
  const deleteExpense = useDeleteExpense();

  const [dialogOpen, setDialogOpen] = useState(false);

  const form = useForm<z.infer<typeof expenseSchema>>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      amount: 0,
      description: '',
      paidBy: 0,
      splitAmong: []
    }
  });

  // Set default values once data loads
  useEffect(() => {
    if (members && form.getValues().splitAmong.length === 0) {
      form.setValue('splitAmong', members.map(m => m.id));
    }
    if (user && form.getValues().paidBy === 0) {
      form.setValue('paidBy', user.id);
    }
  }, [members, user, form]);

  const amount = form.watch("amount");
  const splitAmong = form.watch("splitAmong");
  const sharePreview = amount && splitAmong.length > 0 ? (amount / splitAmong.length).toFixed(2) : "0.00";

  const onSubmit = (data: z.infer<typeof expenseSchema>) => {
    createExpense.mutate({ data }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListExpensesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetBalancesQueryKey() });
        toast({ title: "Expense logged", description: `${data.description} added.` });
        setDialogOpen(false);
        form.reset({
          amount: 0, description: '', paidBy: user?.id || 0, splitAmong: members?.map(m => m.id) || []
        });
      },
      onError: (err: any) => {
        toast({ title: "Error", description: err.error || "Failed to log expense", variant: "destructive" });
      }
    });
  };

  const handleDelete = (id: number) => {
    if (!confirm("Delete this expense? This will affect everyone's balances.")) return;
    deleteExpense.mutate({ expenseId: id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListExpensesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetBalancesQueryKey() });
        toast({ title: "Expense deleted" });
      }
    });
  };

  return (
    <div className="w-full pt-4 md:pt-8 max-w-5xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-medium tracking-tight">Expenses</h1>
          <p className="text-muted-foreground mt-1">Log shared purchases and track spending.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-xl gap-2 active-elevate">
              <Plus className="w-4 h-4" /> Add Expense
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md rounded-[2rem] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-serif text-2xl">Log an Expense</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                <FormField control={form.control} name="amount" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Total Amount</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                        <Input type="number" step="0.01" className="rounded-xl pl-8 text-lg" {...field} />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem>
                    <FormLabel>What was it for?</FormLabel>
                    <FormControl><Input placeholder="e.g. Groceries, Internet bill" className="rounded-xl" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="paidBy" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Who paid?</FormLabel>
                    <Select onValueChange={(val) => field.onChange(Number(val))} value={field.value ? String(field.value) : undefined}>
                      <FormControl>
                        <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select who paid" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {members?.map(m => (
                          <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="splitAmong" render={({ field }) => (
                  <FormItem className="pt-2">
                    <FormLabel className="flex justify-between items-end">
                      <span>Split among</span>
                      <span className="text-primary font-serif italic text-sm text-right">
                        <Split className="w-3 h-3 inline mr-1" />
                        ${sharePreview} per person
                      </span>
                    </FormLabel>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {members?.map(member => (
                        <div key={member.id} className="flex items-center space-x-2 bg-muted/30 p-3 rounded-xl border">
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
                          <span className="text-sm font-medium truncate">{member.name.split(' ')[0]}</span>
                        </div>
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )} />

                <Button type="submit" className="w-full rounded-xl mt-6" disabled={createExpense.isPending}>
                  {createExpense.isPending ? "Logging..." : "Log Expense"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <Skeleton className="h-40 w-full rounded-[2rem]" />
      ) : expenses?.length === 0 ? (
        <div className="text-center py-16 bg-card rounded-[2rem] border border-dashed flex flex-col items-center">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Receipt className="w-8 h-8 text-primary" />
          </div>
          <h3 className="font-serif text-xl font-medium mb-1">No expenses yet</h3>
          <p className="text-muted-foreground text-sm">Add shared bills or groceries to track who owes what.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {expenses?.map((expense, i) => (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              key={expense.id}
              className="bg-card rounded-2xl p-5 border shadow-sm flex items-center justify-between hover:shadow-md transition-all group"
            >
              <div className="flex items-center gap-5">
                <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center font-serif font-medium text-secondary-foreground text-lg shadow-sm border border-secondary-foreground/10">
                  {expense.paidByName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-medium text-lg leading-tight">{expense.description}</h3>
                  <div className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
                    <span>Paid by <span className="font-medium text-foreground">{expense.paidByName}</span></span>
                    <span>•</span>
                    <span>{format(parseISO(expense.date), 'MMM d, yyyy')}</span>
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col items-end gap-2">
                <div className="font-serif text-xl font-medium tracking-tight">
                  ${expense.amount.toFixed(2)}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Split className="w-3 h-3" /> {expense.splits.length}
                  </span>
                  {expense.paidBy === user?.id && (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => handleDelete(expense.id)} 
                      className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
