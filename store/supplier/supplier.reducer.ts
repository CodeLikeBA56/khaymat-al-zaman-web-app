import {
  createAction,
  createAsyncThunk,
  createReducer,
} from "@reduxjs/toolkit";
import {
  activateSupplierService,
  createSupplierService,
  deactivateSupplierService,
  getSupplierByIdService,
  listSuppliersPageService,
  updateSupplierService,
} from "@/store/supplier/supplier.service";
import type {
  CreateSupplierInput,
  Supplier,
  UpdateSupplierInput,
} from "@/types/supplier";

type SupplierState = {
  suppliers: Supplier[];
  isLoading: boolean;
  isSaving: boolean;
  loadedAt: number | null;
  error: string | null;
};

const getInitialState = (): SupplierState => ({
  suppliers: [],
  isLoading: false,
  isSaving: false,
  loadedAt: null,
  error: null,
});

const initialState = getInitialState();

export const clearSupplierState = createAction("supplier/CLEAR");

function sortSuppliers(suppliers: Supplier[]) {
  return [...suppliers].sort((a, b) => a.name.localeCompare(b.name));
}

function upsertSupplier(suppliers: Supplier[], nextSupplier: Supplier) {
  const index = suppliers.findIndex(
    (supplier) => supplier.id === nextSupplier.id,
  );
  if (index === -1) {
    return sortSuppliers([...suppliers, nextSupplier]);
  }

  const next = [...suppliers];
  next[index] = nextSupplier;
  return sortSuppliers(next);
}

export const fetchSuppliers = createAsyncThunk<
  Supplier[],
  { force?: boolean } | undefined,
  { rejectValue: string }
>(
  "supplier/FETCH_ALL",
  async (_, { rejectWithValue }) => {
    try {
      const suppliers: Supplier[] = [];
      let cursor: string | null = null;

      while (true) {
        const page = await listSuppliersPageService({
          status: "all",
          pageSize: 100,
          ...(cursor ? { cursor } : {}),
        });

        suppliers.push(...page.suppliers);

        if (!page.hasMore || !page.nextCursor) {
          break;
        }

        cursor = page.nextCursor;
      }

      return sortSuppliers(suppliers);
    } catch (error) {
      if (error instanceof Error) return rejectWithValue(error.message);
      return rejectWithValue("Could not load suppliers.");
    }
  },
  {
    condition: (args, { getState }) => {
      if (args?.force) return true;
      const state = getState() as { supplier?: SupplierState };
      if (!state.supplier) return true;
      if (state.supplier.isLoading) return false;
      if (
        state.supplier.loadedAt &&
        Date.now() - state.supplier.loadedAt < 60_000
      ) {
        return false;
      }
      return true;
    },
  },
);

export const createSupplier = createAsyncThunk<
  Supplier,
  CreateSupplierInput,
  { rejectValue: string }
>("supplier/CREATE", async (input, { rejectWithValue }) => {
  try {
    const supplierId = await createSupplierService(input);
    const createdSupplier = await getSupplierByIdService(supplierId);
    if (!createdSupplier) {
      return rejectWithValue("Could not load the created vendor.");
    }

    return createdSupplier;
  } catch (error) {
    if (error instanceof Error) return rejectWithValue(error.message);
    return rejectWithValue("Could not create vendor.");
  }
});

export const updateSupplier = createAsyncThunk<
  Supplier,
  { supplierId: string; input: UpdateSupplierInput },
  { rejectValue: string }
>("supplier/UPDATE", async ({ supplierId, input }, { rejectWithValue }) => {
  try {
    await updateSupplierService(supplierId, input);
    const updatedSupplier = await getSupplierByIdService(supplierId);
    if (!updatedSupplier) {
      return rejectWithValue("Could not load the updated vendor.");
    }

    return updatedSupplier;
  } catch (error) {
    if (error instanceof Error) return rejectWithValue(error.message);
    return rejectWithValue("Could not update vendor.");
  }
});

export const setSupplierActivation = createAsyncThunk<
  { supplierId: string; isActive: boolean },
  { supplierId: string; isActive: boolean },
  { rejectValue: string }
>(
  "supplier/SET_ACTIVATION",
  async ({ supplierId, isActive }, { rejectWithValue }) => {
    try {
      if (isActive) {
        await activateSupplierService(supplierId);
      } else {
        await deactivateSupplierService(supplierId);
      }

      return { supplierId, isActive };
    } catch (error) {
      if (error instanceof Error) return rejectWithValue(error.message);
      return rejectWithValue("Could not update vendor status.");
    }
  },
);

export const supplierReducer = createReducer(initialState, (builder) => {
  builder
    .addCase(fetchSuppliers.pending, (state) => {
      state.isLoading = true;
      state.error = null;
    })
    .addCase(fetchSuppliers.fulfilled, (state, action) => {
      state.isLoading = false;
      state.error = null;
      state.suppliers = action.payload;
      state.loadedAt = Date.now();
    })
    .addCase(fetchSuppliers.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload ?? "Could not load suppliers.";
    })

    .addCase(createSupplier.pending, (state) => {
      state.isSaving = true;
      state.error = null;
    })
    .addCase(createSupplier.fulfilled, (state, action) => {
      state.isSaving = false;
      state.error = null;
      state.suppliers = upsertSupplier(state.suppliers, action.payload);
    })
    .addCase(createSupplier.rejected, (state, action) => {
      state.isSaving = false;
      state.error = action.payload ?? "Could not create vendor.";
    })

    .addCase(updateSupplier.pending, (state) => {
      state.isSaving = true;
      state.error = null;
    })
    .addCase(updateSupplier.fulfilled, (state, action) => {
      state.isSaving = false;
      state.error = null;
      state.suppliers = upsertSupplier(state.suppliers, action.payload);
    })
    .addCase(updateSupplier.rejected, (state, action) => {
      state.isSaving = false;
      state.error = action.payload ?? "Could not update vendor.";
    })

    .addCase(setSupplierActivation.pending, (state) => {
      state.isSaving = true;
      state.error = null;
    })
    .addCase(setSupplierActivation.fulfilled, (state, action) => {
      state.isSaving = false;
      state.error = null;
      state.suppliers = state.suppliers.map((supplier) =>
        supplier.id === action.payload.supplierId
          ? { ...supplier, isActive: action.payload.isActive }
          : supplier,
      );
    })
    .addCase(setSupplierActivation.rejected, (state, action) => {
      state.isSaving = false;
      state.error = action.payload ?? "Could not update vendor status.";
    })

    .addCase(clearSupplierState, () => getInitialState());
});
