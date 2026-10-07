import {
  createAction,
  createReducer,
  createAsyncThunk,
} from "@reduxjs/toolkit";
import type { UserDocument } from "@/types/user";
import { fetchEmployeesService } from "@/store/employee/employee.service";

type EmployeeState = {
  isLoading: boolean;
  error: string | null;
  loadedAt: number | null;
  employees: UserDocument[];
};

const getInitialState = (): EmployeeState => ({
  employees: [],
  isLoading: false,
  loadedAt: null,
  error: null,
});

const initialState = getInitialState();

export const clearEmployeeState = createAction("employee/CLEAR");

export const fetchEmployees = createAsyncThunk<
  UserDocument[],
  { force?: boolean } | undefined,
  { rejectValue: string }
>(
  "employee/FETCH_EMPLOYEES",
  async (_, { rejectWithValue }) => {
    try {
      return await fetchEmployeesService();
    } catch (error) {
      if (error instanceof Error) {
        return rejectWithValue(error.message);
      }
      return rejectWithValue("Could not load employees.");
    }
  },
  {
    condition: (args, { getState }) => {
      if (args?.force) return true;
      const state = getState() as { employee?: EmployeeState };
      if (!state.employee) return true;
      if (state.employee.isLoading) return false;
      if (
        state.employee.loadedAt &&
        Date.now() - state.employee.loadedAt < 60_000
      ) {
        return false;
      }
      return true;
    },
  },
);

export const employeeReducer = createReducer(initialState, (builder) => {
  builder
    .addCase(fetchEmployees.pending, (state) => {
      state.error = null;
      state.isLoading = true;
    })
    .addCase(fetchEmployees.fulfilled, (state, action) => {
      state.isLoading = false;
      state.error = null;
      state.employees = action.payload;
      state.loadedAt = Date.now();
    })
    .addCase(fetchEmployees.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload ?? "Could not load employees.";
    })
    .addCase(clearEmployeeState, () => getInitialState());
});
