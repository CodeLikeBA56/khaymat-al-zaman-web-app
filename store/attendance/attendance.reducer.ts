import { createAction, createAsyncThunk, createReducer } from "@reduxjs/toolkit";
import { summarizeAttendance, toMonthId } from "@/lib/finance";
import type {
  AttendanceDocument,
  EmployeeAttendanceSummary,
} from "@/types/finance";
import {
  fetchMonthlyAttendanceService,
  upsertAttendanceService,
  type UpsertAttendanceInput,
} from "@/store/attendance/attendance.service";

type MonthAttendanceState = {
  records: AttendanceDocument[];
  summary: EmployeeAttendanceSummary;
};

type AttendanceState = {
  loading: boolean;
  saving: boolean;
  error: string | null;
  byUserMonth: Record<string, MonthAttendanceState>;
};

const getInitialState = (): AttendanceState => ({
  loading: false,
  saving: false,
  error: null,
  byUserMonth: {},
});

const initialState = getInitialState();

export const clearAttendanceState = createAction("attendance/CLEAR");

export const fetchMonthlyAttendance = createAsyncThunk<
  { userId: string; year: number; month: number; records: AttendanceDocument[] },
  { userId: string; year: number; month: number },
  { rejectValue: string }
>("attendance/FETCH_MONTHLY", async (args, { rejectWithValue }) => {
  try {
    const records = await fetchMonthlyAttendanceService(
      args.userId,
      args.year,
      args.month,
    );
    return { ...args, records };
  } catch (error) {
    if (error instanceof Error) return rejectWithValue(error.message);
    return rejectWithValue("Could not load attendance.");
  }
});

export const upsertAttendance = createAsyncThunk<
  UpsertAttendanceInput,
  UpsertAttendanceInput,
  { rejectValue: string }
>("attendance/UPSERT", async (input, { rejectWithValue }) => {
  try {
    await upsertAttendanceService(input);
    return input;
  } catch (error) {
    if (error instanceof Error) return rejectWithValue(error.message);
    return rejectWithValue("Could not save attendance.");
  }
});

function setMonthState(
  state: AttendanceState,
  userId: string,
  year: number,
  month: number,
  records: AttendanceDocument[],
) {
  const key = `${userId}_${toMonthId(year, month)}`;
  state.byUserMonth[key] = {
    records,
    summary: summarizeAttendance(records),
  };
}

export const attendanceReducer = createReducer(initialState, (builder) => {
  builder
    .addCase(fetchMonthlyAttendance.pending, (state) => {
      state.loading = true;
      state.error = null;
    })
    .addCase(fetchMonthlyAttendance.fulfilled, (state, action) => {
      state.loading = false;
      state.error = null;
      setMonthState(
        state,
        action.payload.userId,
        action.payload.year,
        action.payload.month,
        action.payload.records,
      );
    })
    .addCase(fetchMonthlyAttendance.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload ?? "Could not load attendance.";
    })
    .addCase(upsertAttendance.pending, (state) => {
      state.saving = true;
      state.error = null;
    })
    .addCase(upsertAttendance.fulfilled, (state) => {
      state.saving = false;
      state.error = null;
    })
    .addCase(upsertAttendance.rejected, (state, action) => {
      state.saving = false;
      state.error = action.payload ?? "Could not save attendance.";
    })
    .addCase(clearAttendanceState, () => getInitialState());
});
