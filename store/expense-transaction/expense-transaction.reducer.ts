import { createAction, createAsyncThunk, createReducer } from "@reduxjs/toolkit";
import type { RootState } from "@/store/store";
import type { CreateExpenseTransactionInput, ExpenseTransaction, UpdateExpenseTransactionInput } from "@/types/expense";
import {
  createExpenseTransaction,
  deleteExpenseTransaction,
  getExpenseTransactionById,
  getExpenseTransactions,
  updateExpenseTransaction,
} from "./expense-transaction.service";

export type ExpenseTransactionState = {
  transactions: ExpenseTransaction[];
  selectedTransaction: ExpenseTransaction | null;
  activeSalaryPlanId: string | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  success: string | null;
};

const getInitialState = (): ExpenseTransactionState => ({ transactions: [], selectedTransaction: null, activeSalaryPlanId: null, isLoading: false, isSaving: false, error: null, success: null });
export const clearExpenseTransactionState = createAction("expenseTransaction/CLEAR");

function sortTransactions(transactions: ExpenseTransaction[]) {
  return [...transactions].sort((a, b) => b.transactionDate.toMillis() - a.transactionDate.toMillis());
}

export const fetchExpenseTransactions = createAsyncThunk<ExpenseTransaction[], string, { rejectValue: string }>("expenseTransaction/FETCH_ALL", async (salaryPlanId, { rejectWithValue }) => { try { return await getExpenseTransactions(salaryPlanId); } catch (error) { return rejectWithValue(error instanceof Error ? error.message : "Could not load transactions."); } });
export const fetchExpenseTransactionById = createAsyncThunk<ExpenseTransaction | null, { salaryPlanId: string; transactionId: string }, { rejectValue: string }>("expenseTransaction/FETCH_BY_ID", async ({ salaryPlanId, transactionId }, { rejectWithValue }) => { try { return await getExpenseTransactionById(salaryPlanId, transactionId); } catch (error) { return rejectWithValue(error instanceof Error ? error.message : "Could not load transaction."); } });
export const createExpenseTransactionThunk = createAsyncThunk<ExpenseTransaction, { salaryPlanId: string; input: CreateExpenseTransactionInput }, { rejectValue: string }>("expenseTransaction/CREATE", async ({ salaryPlanId, input }, { rejectWithValue }) => { try { return await createExpenseTransaction(salaryPlanId, input); } catch (error) { return rejectWithValue(error instanceof Error ? error.message : "Could not create transaction."); } });
export const updateExpenseTransactionThunk = createAsyncThunk<ExpenseTransaction, { salaryPlanId: string; transactionId: string; input: UpdateExpenseTransactionInput }, { rejectValue: string }>("expenseTransaction/UPDATE", async ({ salaryPlanId, transactionId, input }, { rejectWithValue }) => { try { return await updateExpenseTransaction(salaryPlanId, transactionId, input); } catch (error) { return rejectWithValue(error instanceof Error ? error.message : "Could not update transaction."); } });
export const deleteExpenseTransactionThunk = createAsyncThunk<string, { salaryPlanId: string; transactionId: string }, { rejectValue: string }>("expenseTransaction/DELETE", async ({ salaryPlanId, transactionId }, { rejectWithValue }) => { try { await deleteExpenseTransaction(salaryPlanId, transactionId); return transactionId; } catch (error) { return rejectWithValue(error instanceof Error ? error.message : "Could not delete transaction."); } });

export const expenseTransactionReducer = createReducer(getInitialState(), (builder) => {
  builder
    .addCase(fetchExpenseTransactions.pending, (state, action) => { state.isLoading = true; state.activeSalaryPlanId = action.meta.arg; state.error = null; state.success = null; })
    .addCase(fetchExpenseTransactions.fulfilled, (state, action) => { state.isLoading = false; state.transactions = sortTransactions(action.payload); })
    .addCase(fetchExpenseTransactions.rejected, (state, action) => { state.isLoading = false; state.error = action.payload ?? "Could not load transactions."; })
    .addCase(fetchExpenseTransactionById.pending, (state) => { state.isLoading = true; state.error = null; })
    .addCase(fetchExpenseTransactionById.fulfilled, (state, action) => { state.isLoading = false; state.selectedTransaction = action.payload; })
    .addCase(fetchExpenseTransactionById.rejected, (state, action) => { state.isLoading = false; state.error = action.payload ?? "Could not load transaction."; })
    .addCase(createExpenseTransactionThunk.pending, (state) => { state.isSaving = true; state.error = null; state.success = null; })
    .addCase(createExpenseTransactionThunk.fulfilled, (state, action) => { state.isSaving = false; state.transactions = sortTransactions([...state.transactions, action.payload]); state.selectedTransaction = action.payload; state.success = "Expense transaction created."; })
    .addCase(createExpenseTransactionThunk.rejected, (state, action) => { state.isSaving = false; state.error = action.payload ?? "Could not create transaction."; })
    .addCase(updateExpenseTransactionThunk.pending, (state) => { state.isSaving = true; state.error = null; state.success = null; })
    .addCase(updateExpenseTransactionThunk.fulfilled, (state, action) => { state.isSaving = false; state.transactions = sortTransactions(state.transactions.map((item) => item.id === action.payload.id ? action.payload : item)); state.selectedTransaction = action.payload; state.success = "Expense transaction updated."; })
    .addCase(updateExpenseTransactionThunk.rejected, (state, action) => { state.isSaving = false; state.error = action.payload ?? "Could not update transaction."; })
    .addCase(deleteExpenseTransactionThunk.pending, (state) => { state.isSaving = true; state.error = null; state.success = null; })
    .addCase(deleteExpenseTransactionThunk.fulfilled, (state, action) => { state.isSaving = false; state.transactions = state.transactions.filter((item) => item.id !== action.payload); state.success = "Expense transaction deleted."; })
    .addCase(deleteExpenseTransactionThunk.rejected, (state, action) => { state.isSaving = false; state.error = action.payload ?? "Could not delete transaction."; })
    .addCase(clearExpenseTransactionState, () => getInitialState());
});

export const selectExpenseTransactions = (state: RootState) => state.expenseTransaction.transactions;
export const selectExpenseTransactionLoading = (state: RootState) => state.expenseTransaction.isLoading;
export const selectExpenseTransactionError = (state: RootState) => state.expenseTransaction.error;
