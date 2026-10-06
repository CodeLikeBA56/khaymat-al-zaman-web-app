import { createAction, createAsyncThunk, createReducer } from "@reduxjs/toolkit";
import {
  autoAllocateOldestOutstanding,
  getMonthDateRange,
  sumAllocations,
} from "@/lib/finance";
import type {
  SalaryAdjustmentType,
  SalaryAdvance,
  SalaryPayment,
  SalaryPaymentAllocation,
  SalaryPeriod,
  SalaryStatus,
} from "@/types/finance";
import {
  addSalaryAdjustmentService,
  createSalaryAdvanceService,
  createSalaryPaymentService,
  fetchEmployeeFinanceService,
  fetchOutstandingSalaryPeriodsService,
  generateSalaryPeriodService,
} from "@/store/finance/finance.service";

type EmployeeFinanceState = {
  salaryPeriods: SalaryPeriod[];
  salaryPayments: SalaryPayment[];
  salaryAdvances: SalaryAdvance[];
  outstandingPeriods: SalaryPeriod[];
  loading: boolean;
  submitting: boolean;
  error: string | null;
};

type FinanceState = {
  byUserId: Record<string, EmployeeFinanceState>;
};

const createUserFinanceState = (): EmployeeFinanceState => ({
  salaryPeriods: [],
  salaryPayments: [],
  salaryAdvances: [],
  outstandingPeriods: [],
  loading: false,
  submitting: false,
  error: null,
});

const initialState: FinanceState = {
  byUserId: {},
};

function createInitialFinanceState(): FinanceState {
  return { byUserId: {} };
}

function ensureUserState(state: FinanceState, userId: string) {
  if (!state.byUserId[userId]) {
    state.byUserId[userId] = createUserFinanceState();
  }
  return state.byUserId[userId];
}

export const clearFinanceState = createAction("finance/CLEAR");

export const fetchEmployeeFinance = createAsyncThunk<
  {
    userId: string;
    salaryPeriods: SalaryPeriod[];
    salaryPayments: SalaryPayment[];
    salaryAdvances: SalaryAdvance[];
  },
  { userId: string },
  { rejectValue: string }
>("finance/FETCH_EMPLOYEE_FINANCE", async (args, { rejectWithValue }) => {
  try {
    const data = await fetchEmployeeFinanceService(args.userId);
    return { userId: args.userId, ...data };
  } catch (error) {
    if (error instanceof Error) return rejectWithValue(error.message);
    return rejectWithValue("Could not load employee finance details.");
  }
});

export const fetchOutstandingSalaryPeriods = createAsyncThunk<
  { userId: string; periods: SalaryPeriod[] },
  { userId: string },
  { rejectValue: string }
>("finance/FETCH_OUTSTANDING_PERIODS", async ({ userId }, { rejectWithValue }) => {
  try {
    const periods = await fetchOutstandingSalaryPeriodsService(userId);
    return { userId, periods };
  } catch (error) {
    if (error instanceof Error) return rejectWithValue(error.message);
    return rejectWithValue("Could not fetch outstanding salary periods.");
  }
});

export const generateSalaryPeriod = createAsyncThunk<
  { userId: string },
  { userId: string; year: number; month: number; status?: SalaryStatus; baseSalaryOverride?: number; periodEndDay?: number },
  { rejectValue: string }
>("finance/GENERATE_SALARY_PERIOD", async (input, { rejectWithValue }) => {
  try {
    const { start, end } = getMonthDateRange(input.year, input.month);
    const periodEnd = input.periodEndDay
      ? new Date(Date.UTC(input.year, input.month - 1, input.periodEndDay))
      : end;

    await generateSalaryPeriodService({
      userId: input.userId,
      year: input.year,
      month: input.month,
      periodStart: start,
      periodEnd,
      status: input.status,
      baseSalaryOverride: input.baseSalaryOverride,
    });

    return { userId: input.userId };
  } catch (error) {
    if (error instanceof Error) return rejectWithValue(error.message);
    return rejectWithValue("Could not generate salary period.");
  }
});

export const addSalaryAdjustment = createAsyncThunk<
  { userId: string },
  {
    userId: string;
    salaryPeriodId: string;
    adjustmentType: SalaryAdjustmentType;
    amount: number;
    description?: string;
    referenceId?: string;
  },
  { rejectValue: string }
>("finance/ADD_SALARY_ADJUSTMENT", async (input, { rejectWithValue }) => {
  try {
    await addSalaryAdjustmentService({
      salaryPeriodId: input.salaryPeriodId,
      adjustmentType: input.adjustmentType,
      amount: input.amount,
      description: input.description,
      referenceId: input.referenceId,
    });

    return { userId: input.userId };
  } catch (error) {
    if (error instanceof Error) return rejectWithValue(error.message);
    return rejectWithValue("Could not add salary adjustment.");
  }
});

export const createSalaryAdvance = createAsyncThunk<
  { userId: string },
  {
    userId: string;
    amount: number;
    paymentMethod: "cash" | "bank_transfer" | "other";
    description?: string;
    paidBy: string;
    date?: Date;
  },
  { rejectValue: string }
>("finance/CREATE_ADVANCE", async (input, { rejectWithValue }) => {
  try {
    await createSalaryAdvanceService({
      userId: input.userId,
      amount: input.amount,
      paymentMethod: input.paymentMethod,
      description: input.description,
      paidBy: input.paidBy,
      date: input.date ?? new Date(),
    });

    return { userId: input.userId };
  } catch (error) {
    if (error instanceof Error) return rejectWithValue(error.message);
    return rejectWithValue("Could not create salary advance.");
  }
});

export const createSalaryPayment = createAsyncThunk<
  { userId: string },
  {
    userId: string;
    amount: number;
    paymentMethod: "cash" | "bank_transfer" | "other";
    description?: string;
    allocations?: SalaryPaymentAllocation[];
    paidBy: string;
    date?: Date;
  },
  { rejectValue: string }
>("finance/CREATE_PAYMENT", async (input, { rejectWithValue }) => {
  try {
    await createSalaryPaymentService({
      userId: input.userId,
      amount: input.amount,
      paymentMethod: input.paymentMethod,
      description: input.description,
      allocations: input.allocations,
      paidBy: input.paidBy,
      date: input.date ?? new Date(),
    });

    return { userId: input.userId };
  } catch (error) {
    if (error instanceof Error) return rejectWithValue(error.message);
    return rejectWithValue("Could not create salary payment.");
  }
});

export type PaymentAllocationPreview = {
  allocations: SalaryPaymentAllocation[];
  totalAllocated: number;
  remainingAfterPayment: number;
};

export function buildAllocationPreview(
  outstandingPeriods: SalaryPeriod[],
  amount: number,
): PaymentAllocationPreview {
  const allocations = autoAllocateOldestOutstanding(
    outstandingPeriods.map((period) => ({
      id: period.id,
      remainingAmount: period.remainingAmount,
      year: period.year,
      month: period.month,
    })),
    amount,
  );

  const totalDue = outstandingPeriods.reduce(
    (sum, period) => sum + period.remainingAmount,
    0,
  );

  return {
    allocations,
    totalAllocated: sumAllocations(allocations),
    remainingAfterPayment: Math.max(totalDue - amount, 0),
  };
}

export const financeReducer = createReducer(initialState, (builder) => {
  builder
    .addCase(fetchEmployeeFinance.pending, (state, action) => {
      const finance = ensureUserState(state, action.meta.arg.userId);
      finance.loading = true;
      finance.error = null;
    })
    .addCase(fetchEmployeeFinance.fulfilled, (state, action) => {
      const finance = ensureUserState(state, action.payload.userId);
      finance.loading = false;
      finance.error = null;
      finance.salaryPeriods = action.payload.salaryPeriods;
      finance.salaryPayments = action.payload.salaryPayments;
      finance.salaryAdvances = action.payload.salaryAdvances;
    })
    .addCase(fetchEmployeeFinance.rejected, (state, action) => {
      const userId = action.meta.arg.userId;
      const finance = ensureUserState(state, userId);
      finance.loading = false;
      finance.error = action.payload ?? "Could not load employee finance details.";
    })

    .addCase(fetchOutstandingSalaryPeriods.pending, (state, action) => {
      const finance = ensureUserState(state, action.meta.arg.userId);
      finance.loading = true;
      finance.error = null;
    })
    .addCase(fetchOutstandingSalaryPeriods.fulfilled, (state, action) => {
      const finance = ensureUserState(state, action.payload.userId);
      finance.loading = false;
      finance.error = null;
      finance.outstandingPeriods = action.payload.periods;
    })
    .addCase(fetchOutstandingSalaryPeriods.rejected, (state, action) => {
      const finance = ensureUserState(state, action.meta.arg.userId);
      finance.loading = false;
      finance.error = action.payload ?? "Could not fetch outstanding salary periods.";
    })

    .addCase(generateSalaryPeriod.pending, (state, action) => {
      const finance = ensureUserState(state, action.meta.arg.userId);
      finance.submitting = true;
      finance.error = null;
    })
    .addCase(generateSalaryPeriod.fulfilled, (state, action) => {
      const finance = ensureUserState(state, action.payload.userId);
      finance.submitting = false;
      finance.error = null;
    })
    .addCase(generateSalaryPeriod.rejected, (state, action) => {
      const finance = ensureUserState(state, action.meta.arg.userId);
      finance.submitting = false;
      finance.error = action.payload ?? "Could not generate salary period.";
    })

    .addCase(addSalaryAdjustment.pending, (state, action) => {
      const finance = ensureUserState(state, action.meta.arg.userId);
      finance.submitting = true;
      finance.error = null;
    })
    .addCase(addSalaryAdjustment.fulfilled, (state, action) => {
      const finance = ensureUserState(state, action.payload.userId);
      finance.submitting = false;
      finance.error = null;
    })
    .addCase(addSalaryAdjustment.rejected, (state, action) => {
      const finance = ensureUserState(state, action.meta.arg.userId);
      finance.submitting = false;
      finance.error = action.payload ?? "Could not add salary adjustment.";
    })

    .addCase(createSalaryAdvance.pending, (state, action) => {
      const finance = ensureUserState(state, action.meta.arg.userId);
      finance.submitting = true;
      finance.error = null;
    })
    .addCase(createSalaryAdvance.fulfilled, (state, action) => {
      const finance = ensureUserState(state, action.payload.userId);
      finance.submitting = false;
      finance.error = null;
    })
    .addCase(createSalaryAdvance.rejected, (state, action) => {
      const finance = ensureUserState(state, action.meta.arg.userId);
      finance.submitting = false;
      finance.error = action.payload ?? "Could not create salary advance.";
    })

    .addCase(createSalaryPayment.pending, (state, action) => {
      const finance = ensureUserState(state, action.meta.arg.userId);
      finance.submitting = true;
      finance.error = null;
    })
    .addCase(createSalaryPayment.fulfilled, (state, action) => {
      const finance = ensureUserState(state, action.payload.userId);
      finance.submitting = false;
      finance.error = null;
    })
    .addCase(createSalaryPayment.rejected, (state, action) => {
      const finance = ensureUserState(state, action.meta.arg.userId);
      finance.submitting = false;
      finance.error = action.payload ?? "Could not create salary payment.";
    })

    .addCase(clearFinanceState, () => createInitialFinanceState());
});
