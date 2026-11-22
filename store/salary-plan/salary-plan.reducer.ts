import { createAction, createAsyncThunk, createReducer } from "@reduxjs/toolkit";
import type { RootState } from "@/store/store";
import type { CreateSalaryPlanInput, SalaryPlan, UpdateSalaryPlanInput } from "@/types/expense";
import {
  activateSalaryPlan,
  closeSalaryPlan,
  createSalaryPlan,
  getSalaryPlanById,
  getSalaryPlans,
  updateSalaryPlan,
} from "./salary-plan.service";

export type SalaryPlanState = {
  plans: SalaryPlan[];
  selectedPlan: SalaryPlan | null;
  isLoading: boolean;
  isSaving: boolean;
  loadedAt: number | null;
  error: string | null;
  success: string | null;
};

const getInitialState = (): SalaryPlanState => ({ plans: [], selectedPlan: null, isLoading: false, isSaving: false, loadedAt: null, error: null, success: null });
export const clearSalaryPlanState = createAction("salaryPlan/CLEAR");

function upsert(plans: SalaryPlan[], next: SalaryPlan) {
  const index = plans.findIndex((plan) => plan.id === next.id);
  if (index === -1) return [...plans, next].sort((a, b) => b.month.localeCompare(a.month));
  const result = [...plans]; result[index] = next;
  return result.sort((a, b) => b.month.localeCompare(a.month));
}

export const fetchSalaryPlans = createAsyncThunk<SalaryPlan[], { force?: boolean } | undefined, { rejectValue: string }>(
  "salaryPlan/FETCH_ALL",
  async (_, { rejectWithValue }) => { try { return await getSalaryPlans(); } catch (error) { return rejectWithValue(error instanceof Error ? error.message : "Could not load salary plans."); } },
  { condition: (args, { getState }) => { const state = getState() as RootState; if (state.salaryPlan?.isLoading) return false; if (args?.force) return true; if (!state.salaryPlan?.loadedAt) return true; return Date.now() - state.salaryPlan.loadedAt >= 60_000; } },
);
export const fetchSalaryPlanById = createAsyncThunk<SalaryPlan | null, string, { rejectValue: string }>("salaryPlan/FETCH_BY_ID", async (planId, { rejectWithValue }) => { try { return await getSalaryPlanById(planId); } catch (error) { return rejectWithValue(error instanceof Error ? error.message : "Could not load salary plan."); } });
export const createSalaryPlanThunk = createAsyncThunk<SalaryPlan, CreateSalaryPlanInput, { rejectValue: string }>("salaryPlan/CREATE", async (input, { rejectWithValue }) => { try { return await createSalaryPlan(input); } catch (error) { return rejectWithValue(error instanceof Error ? error.message : "Could not create salary plan."); } });
export const updateSalaryPlanThunk = createAsyncThunk<SalaryPlan, { planId: string; input: UpdateSalaryPlanInput }, { rejectValue: string }>("salaryPlan/UPDATE", async ({ planId, input }, { rejectWithValue }) => { try { return await updateSalaryPlan(planId, input); } catch (error) { return rejectWithValue(error instanceof Error ? error.message : "Could not update salary plan."); } });
export const activateSalaryPlanThunk = createAsyncThunk<SalaryPlan, string, { rejectValue: string }>("salaryPlan/ACTIVATE", async (planId, { rejectWithValue }) => { try { return await activateSalaryPlan(planId); } catch (error) { return rejectWithValue(error instanceof Error ? error.message : "Could not activate salary plan."); } });
export const closeSalaryPlanThunk = createAsyncThunk<SalaryPlan, string, { rejectValue: string }>("salaryPlan/CLOSE", async (planId, { rejectWithValue }) => { try { return await closeSalaryPlan(planId); } catch (error) { return rejectWithValue(error instanceof Error ? error.message : "Could not close salary plan."); } });

export const salaryPlanReducer = createReducer(getInitialState(), (builder) => {
  builder
    .addCase(fetchSalaryPlans.pending, (state) => { state.isLoading = true; state.error = null; state.success = null; })
    .addCase(fetchSalaryPlans.fulfilled, (state, action) => { state.isLoading = false; state.plans = action.payload; state.loadedAt = Date.now(); })
    .addCase(fetchSalaryPlans.rejected, (state, action) => { state.isLoading = false; state.error = action.payload ?? "Could not load salary plans."; })
    .addCase(fetchSalaryPlanById.pending, (state) => { state.isLoading = true; state.error = null; })
    .addCase(fetchSalaryPlanById.fulfilled, (state, action) => { state.isLoading = false; state.selectedPlan = action.payload; })
    .addCase(fetchSalaryPlanById.rejected, (state, action) => { state.isLoading = false; state.error = action.payload ?? "Could not load salary plan."; })
    .addCase(createSalaryPlanThunk.pending, (state) => { state.isSaving = true; state.error = null; state.success = null; })
    .addCase(createSalaryPlanThunk.fulfilled, (state, action) => { state.isSaving = false; state.plans = upsert(state.plans, action.payload); state.selectedPlan = action.payload; state.success = "Salary plan created."; })
    .addCase(createSalaryPlanThunk.rejected, (state, action) => { state.isSaving = false; state.error = action.payload ?? "Could not create salary plan."; })
    .addCase(updateSalaryPlanThunk.pending, (state) => { state.isSaving = true; state.error = null; state.success = null; })
    .addCase(updateSalaryPlanThunk.fulfilled, (state, action) => { state.isSaving = false; state.plans = upsert(state.plans, action.payload); state.selectedPlan = action.payload; state.success = "Salary plan updated."; })
    .addCase(updateSalaryPlanThunk.rejected, (state, action) => { state.isSaving = false; state.error = action.payload ?? "Could not update salary plan."; })
    .addCase(activateSalaryPlanThunk.pending, (state) => { state.isSaving = true; state.error = null; state.success = null; })
    .addCase(activateSalaryPlanThunk.fulfilled, (state, action) => { state.isSaving = false; state.plans = upsert(state.plans, action.payload); state.selectedPlan = action.payload; state.success = "Salary plan activated."; })
    .addCase(activateSalaryPlanThunk.rejected, (state, action) => { state.isSaving = false; state.error = action.payload ?? "Could not activate salary plan."; })
    .addCase(closeSalaryPlanThunk.pending, (state) => { state.isSaving = true; state.error = null; state.success = null; })
    .addCase(closeSalaryPlanThunk.fulfilled, (state, action) => { state.isSaving = false; state.plans = upsert(state.plans, action.payload); state.selectedPlan = action.payload; state.success = "Salary plan closed."; })
    .addCase(closeSalaryPlanThunk.rejected, (state, action) => { state.isSaving = false; state.error = action.payload ?? "Could not close salary plan."; })
    .addCase(clearSalaryPlanState, () => getInitialState());
});

export const selectSalaryPlans = (state: RootState) => state.salaryPlan.plans;
export const selectSalaryPlanLoading = (state: RootState) => state.salaryPlan.isLoading;
export const selectSalaryPlanError = (state: RootState) => state.salaryPlan.error;
