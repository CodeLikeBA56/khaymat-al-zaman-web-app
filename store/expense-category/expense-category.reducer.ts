import {
  createAction,
  createAsyncThunk,
  createReducer,
} from "@reduxjs/toolkit";
import type { RootState } from "@/store/store";
import {
  createExpenseCategory,
  deactivateExpenseCategory,
  getExpenseCategories,
  getExpenseCategoryById,
  updateExpenseCategory,
} from "./expense-category.service";
import type {
  CreateExpenseCategoryInput,
  ExpenseCategory,
  UpdateExpenseCategoryInput,
} from "@/types/expense";

export type ExpenseCategoryState = {
  categories: ExpenseCategory[];
  selectedCategory: ExpenseCategory | null;
  isLoading: boolean;
  isSaving: boolean;
  loadedAt: number | null;
  error: string | null;
  success: string | null;
};

const getInitialState = (): ExpenseCategoryState => ({
  categories: [],
  selectedCategory: null,
  isLoading: false,
  isSaving: false,
  loadedAt: null,
  error: null,
  success: null,
});

export const clearExpenseCategoryState = createAction("expenseCategory/CLEAR");

function upsert(categories: ExpenseCategory[], next: ExpenseCategory) {
  const index = categories.findIndex((item) => item.id === next.id);
  if (index === -1)
    return [...categories, next].sort((a, b) => a.name.localeCompare(b.name));
  const result = [...categories];
  result[index] = next;
  return result.sort((a, b) => a.name.localeCompare(b.name));
}

export const fetchExpenseCategories = createAsyncThunk<
  ExpenseCategory[],
  { force?: boolean } | undefined,
  { rejectValue: string }
>(
  "expenseCategory/FETCH_ALL",
  async (_, { rejectWithValue }) => {
    try {
      return await getExpenseCategories();
    } catch (error) {
      return rejectWithValue(
        error instanceof Error
          ? error.message
          : "Could not load expense categories.",
      );
    }
  },
  {
    condition: (args, { getState }) => {
      const state = getState() as RootState;
      if (state.expenseCategory?.isLoading) return false;
      if (args?.force) return true;
      if (!state.expenseCategory?.loadedAt) return true;
      return Date.now() - state.expenseCategory.loadedAt >= 60_000;
    },
  },
);

export const fetchExpenseCategoryById = createAsyncThunk<
  ExpenseCategory | null,
  string,
  { rejectValue: string }
>("expenseCategory/FETCH_BY_ID", async (categoryId, { rejectWithValue }) => {
  try {
    return await getExpenseCategoryById(categoryId);
  } catch (error) {
    return rejectWithValue(
      error instanceof Error
        ? error.message
        : "Could not load expense category.",
    );
  }
});

export const createExpenseCategoryThunk = createAsyncThunk<
  ExpenseCategory,
  CreateExpenseCategoryInput,
  { rejectValue: string }
>("expenseCategory/CREATE", async (input, { rejectWithValue }) => {
  try {
    return await createExpenseCategory(input);
  } catch (error) {
    return rejectWithValue(
      error instanceof Error
        ? error.message
        : "Could not create expense category.",
    );
  }
});

export const updateExpenseCategoryThunk = createAsyncThunk<
  ExpenseCategory,
  { categoryId: string; input: UpdateExpenseCategoryInput },
  { rejectValue: string }
>(
  "expenseCategory/UPDATE",
  async ({ categoryId, input }, { rejectWithValue }) => {
    try {
      return await updateExpenseCategory(categoryId, input);
    } catch (error) {
      return rejectWithValue(
        error instanceof Error
          ? error.message
          : "Could not update expense category.",
      );
    }
  },
);

export const deactivateExpenseCategoryThunk = createAsyncThunk<
  ExpenseCategory,
  string,
  { rejectValue: string }
>("expenseCategory/DEACTIVATE", async (categoryId, { rejectWithValue }) => {
  try {
    return await deactivateExpenseCategory(categoryId);
  } catch (error) {
    return rejectWithValue(
      error instanceof Error
        ? error.message
        : "Could not deactivate expense category.",
    );
  }
});

export const expenseCategoryReducer = createReducer(
  getInitialState(),
  (builder) => {
    builder
      .addCase(fetchExpenseCategories.pending, (state) => {
        state.isLoading = true;
        state.error = null;
        state.success = null;
      })
      .addCase(fetchExpenseCategories.fulfilled, (state, action) => {
        state.isLoading = false;
        state.categories = action.payload;
        state.loadedAt = Date.now();
      })
      .addCase(fetchExpenseCategories.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload ?? "Could not load expense categories.";
      })
      .addCase(fetchExpenseCategoryById.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchExpenseCategoryById.fulfilled, (state, action) => {
        state.isLoading = false;
        state.selectedCategory = action.payload;
      })
      .addCase(fetchExpenseCategoryById.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload ?? "Could not load expense category.";
      })
      .addCase(createExpenseCategoryThunk.pending, (state) => {
        state.isSaving = true;
        state.error = null;
        state.success = null;
      })
      .addCase(createExpenseCategoryThunk.fulfilled, (state, action) => {
        state.isSaving = false;
        state.categories = upsert(state.categories, action.payload);
        state.selectedCategory = action.payload;
        state.success = "Expense category created.";
      })
      .addCase(createExpenseCategoryThunk.rejected, (state, action) => {
        state.isSaving = false;
        state.error = action.payload ?? "Could not create expense category.";
      })
      .addCase(updateExpenseCategoryThunk.pending, (state) => {
        state.isSaving = true;
        state.error = null;
        state.success = null;
      })
      .addCase(updateExpenseCategoryThunk.fulfilled, (state, action) => {
        state.isSaving = false;
        state.categories = upsert(state.categories, action.payload);
        state.selectedCategory = action.payload;
        state.success = "Expense category updated.";
      })
      .addCase(updateExpenseCategoryThunk.rejected, (state, action) => {
        state.isSaving = false;
        state.error = action.payload ?? "Could not update expense category.";
      })
      .addCase(deactivateExpenseCategoryThunk.pending, (state) => {
        state.isSaving = true;
        state.error = null;
        state.success = null;
      })
      .addCase(deactivateExpenseCategoryThunk.fulfilled, (state, action) => {
        state.isSaving = false;
        state.categories = upsert(state.categories, action.payload);
        state.success = "Expense category deactivated.";
      })
      .addCase(deactivateExpenseCategoryThunk.rejected, (state, action) => {
        state.isSaving = false;
        state.error =
          action.payload ?? "Could not deactivate expense category.";
      })
      .addCase(clearExpenseCategoryState, () => getInitialState());
  },
);

export const selectExpenseCategories = (state: RootState) =>
  state.expenseCategory.categories;
export const selectExpenseCategoryLoading = (state: RootState) =>
  state.expenseCategory.isLoading;
export const selectExpenseCategoryError = (state: RootState) =>
  state.expenseCategory.error;
